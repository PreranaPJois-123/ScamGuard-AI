from uuid import UUID

from fastapi import APIRouter, Depends, Request, UploadFile, File, Form
from sqlalchemy.orm import Session

from app_service.api.deps import get_current_user
from app_service.core.rate_limit import limiter
from app_service.db.postgres.models import User
from app_service.db.session import get_db
from app_service.schemas.message import AnalysisResult, AnalyzeRequest, FeedbackRequest
from app_service.services.message_service import MessageService
from app_service.services.extraction import ExtractionService

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("/analyze", response_model=AnalysisResult)
@limiter.limit("30/minute")
def analyze_message(
    request: Request,
    payload: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalysisResult:
    service = MessageService(db)
    return service.analyze(current_user.id, payload.text, payload.input_type)

@router.post("/scan", response_model=AnalysisResult)
@limiter.limit("30/minute")
def scan_message(
    request: Request,
    file: UploadFile = File(None),
    text: str = Form(None),
    input_type: str = Form("TEXT"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalysisResult:
    try:
        extracted_text, metadata = ExtractionService.extract(file, text, input_type)
    except ValueError as e:
        from app_service.core.exceptions import ValidationAppError
        raise ValidationAppError(str(e)) from e

    if not extracted_text or not extracted_text.strip():
        from app_service.core.exceptions import ValidationAppError
        raise ValidationAppError("No text could be extracted from the provided input.")

    service = MessageService(db)
    return service.analyze(current_user.id, extracted_text, input_type, metadata)


@router.get("/history", response_model=list[AnalysisResult])
@limiter.limit("60/minute")
def get_history(
    request: Request,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AnalysisResult]:
    service = MessageService(db)
    return service.list_history(current_user.id, skip=skip, limit=limit)


@router.patch("/{prediction_id}/feedback", response_model=AnalysisResult)
@limiter.limit("30/minute")
def submit_feedback(
    request: Request,
    prediction_id: UUID,
    payload: FeedbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalysisResult:
    service = MessageService(db)
    return service.record_feedback(current_user.id, prediction_id, payload.is_accurate)

@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
def clear_history(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    service = MessageService(db)
    service.clear_history(current_user.id)

@router.delete("/{prediction_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
def delete_prediction(
    request: Request,
    prediction_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    service = MessageService(db)
    service.delete_prediction(current_user.id, prediction_id)

