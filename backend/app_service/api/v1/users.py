from uuid import UUID
from pathlib import Path
import shutil

from fastapi import APIRouter, Depends, Request, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func

try:
    from fastapi_cache.decorator import cache
except ImportError:
    def cache(*args, **kwargs):
        def decorator(func):
            return func
        return decorator

from app_service.api.deps import get_current_user, require_admin
from app_service.core.rate_limit import limiter
from app_service.db.postgres.models import User, Prediction, Message, RiskLevel
from app_service.db.session import get_db
from app_service.schemas.user import UserRead, UserUpdateRole, UserUpdate
from app_service.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
@limiter.limit("60/minute")
def read_current_user(request: Request, current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


@router.patch("/me", response_model=UserRead)
@limiter.limit("30/minute")
def update_current_user(
    request: Request,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> UserRead:
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.preferences is not None:
        current_user.preferences = payload.preferences
    db.commit()
    db.refresh(current_user)
    return UserRead.model_validate(current_user)


@router.post("/me/avatar")
@limiter.limit("10/minute")
def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    upload_dir = Path("uploads/avatars")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    file_extension = file.filename.split(".")[-1] if "." in file.filename else "png"
    file_path = upload_dir / f"{current_user.id}.{file_extension}"
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    avatar_url = f"/uploads/avatars/{current_user.id}.{file_extension}"
    current_user.avatar_url = avatar_url
    db.commit()
    db.refresh(current_user)
    return {"avatar_url": avatar_url}


@router.get("/admin/stats")
@limiter.limit("30/minute")
@cache(expire=60)
def get_admin_stats(
    request: Request,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin)
):
    users_count = db.query(func.count(User.id)).scalar()
    scans_count = db.query(func.count(Prediction.id)).scalar()
    
    high_risk_count = db.query(func.count(Prediction.id)).filter(
        Prediction.risk_level == RiskLevel.HIGH
    ).scalar()
    
    medium_risk_count = db.query(func.count(Prediction.id)).filter(
        Prediction.risk_level == RiskLevel.MEDIUM
    ).scalar()
    
    low_risk_count = db.query(func.count(Prediction.id)).filter(
        Prediction.risk_level == RiskLevel.LOW
    ).scalar()

    return {
        "users_count": users_count or 0,
        "scans_count": scans_count or 0,
        "threat_counts": {
            "high": high_risk_count or 0,
            "medium": medium_risk_count or 0,
            "low": low_risk_count or 0
        }
    }


@router.get("", response_model=list[UserRead])
@limiter.limit("60/minute")
def list_users(
    request: Request,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[UserRead]:
    service = UserService(db)
    users = service.list_users(skip=skip, limit=limit)
    return [UserRead.model_validate(user) for user in users]


@router.get("/{user_id}", response_model=UserRead)
@limiter.limit("60/minute")
def get_user(
    request: Request,
    user_id: UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> UserRead:
    service = UserService(db)
    user = service.get_user(user_id)
    return UserRead.model_validate(user)


@router.patch("/{user_id}/role", response_model=UserRead)
@limiter.limit("30/minute")
def update_user_role(
    request: Request,
    user_id: UUID,
    payload: UserUpdateRole,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> UserRead:
    service = UserService(db)
    user = service.update_role(actor_id=admin.id, target_user_id=user_id, new_role=payload.role)
    return UserRead.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
def deactivate_user(
    request: Request,
    user_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    service = UserService(db)
    service.deactivate_user(actor_id=admin.id, target_user_id=user_id)
