import uuid

import httpx
from sqlalchemy.orm import Session

from app_service.core.config import get_settings
from app_service.core.exceptions import NotFoundError, ValidationAppError
from app_service.db.postgres.models import Prediction
from app_service.repositories.message_repository import MessageRepository, PredictionRepository
from app_service.schemas.message import AnalysisResult

settings = get_settings()


class MlServiceUnavailableError(ValidationAppError):
    status_code = 503
    error_code = "MODEL_UNAVAILABLE"


class MessageService:
    def __init__(self, db: Session):
        self.db = db
        self.messages = MessageRepository(db)
        self.predictions = PredictionRepository(db)

    def analyze(self, user_id: uuid.UUID | None, text: str, input_type: str = "TEXT", metadata: dict | None = None) -> AnalysisResult:
        # Clamp text to 4000 characters to strictly respect database and ML schema constraints
        if text and len(text) > 4000:
            text = text[:4000]

        data = None
        last_exc = None
        for attempt in range(2):
            try:
                response = httpx.post(
                    f"{settings.ML_SERVICE_URL}/api/v1/internal/predict",
                    json={"text": text, "input_type": input_type, "metadata": metadata},
                    timeout=50.0,
                )
                response.raise_for_status()
                data = response.json()
                break
            except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.ConnectError) as exc:
                last_exc = exc
                if attempt == 0:
                    import time
                    time.sleep(2.5)
                    continue
                break
            except (httpx.HTTPError, ValueError) as exc:
                last_exc = exc
                break

        if data is None:
            raise MlServiceUnavailableError(
                "The scam-detection model is temporarily unavailable. Please try again shortly."
            ) from last_exc

        message = self.messages.create(user_id, text)
        prediction = Prediction(
            message_id=message.id,
            model_name=data["model_name"],
            model_version=data["model_version"],
            verdict=data["verdict"],
            scam_probability=data["scam_probability"],
            risk_level=data["risk_level"],
            scam_category=data.get("scam_category"),
            confidence_score=data["confidence_score"],
            threat_score=data["threat_score"],
            top_tokens=data["top_contributing_tokens"],
            latency_ms=int(data["latency_ms"]),
            ai_explanation=data.get("ai_explanation"),
            executive_summary=data.get("executive_summary"),
            technical_explanation=data.get("technical_explanation"),
            threat_level=data.get("threat_level"),
            risk_breakdown=data.get("risk_breakdown"),
            recommended_actions=data.get("recommended_actions"),
            highlighted_entities=data.get("highlighted_entities"),
            similar_patterns=data.get("similar_patterns"),
            input_type=input_type,
            metadata_=metadata,
        )
        prediction = self.predictions.create(prediction)

        return self._to_result(prediction, text)

    def list_history(self, user_id: uuid.UUID, skip: int = 0, limit: int = 50) -> list[AnalysisResult]:
        predictions = self.predictions.list_for_user(user_id, skip=skip, limit=limit)
        return [self._to_result(p, p.message.text) for p in predictions]

    def record_feedback(self, user_id: uuid.UUID, prediction_id: uuid.UUID, is_accurate: bool) -> AnalysisResult:
        prediction = self.predictions.get_for_user(prediction_id, user_id)
        if prediction is None:
            raise NotFoundError("Prediction not found")
        prediction.user_feedback = is_accurate
        prediction = self.predictions.save(prediction)
        return self._to_result(prediction, prediction.message.text)

    def clear_history(self, user_id: uuid.UUID) -> None:
        predictions = self.predictions.list_for_user(user_id, skip=0, limit=1000)
        for p in predictions:
            # Delete message will cascade
            self.messages.delete(p.message)

    def delete_prediction(self, user_id: uuid.UUID, prediction_id: uuid.UUID) -> None:
        prediction = self.predictions.get_for_user(prediction_id, user_id)
        if prediction is None:
            raise NotFoundError("Prediction not found")
        self.messages.delete(prediction.message)

    @staticmethod
    def _to_result(prediction: Prediction, text: str) -> AnalysisResult:
        return AnalysisResult(
            id=prediction.id,
            text=text,
            input_type=prediction.input_type,
            metadata=prediction.metadata_,
            verdict=prediction.verdict.value,
            scam_probability=prediction.scam_probability,
            risk_level=prediction.risk_level.value,
            scam_category=prediction.scam_category,
            confidence_score=prediction.confidence_score,
            threat_score=prediction.threat_score,
            top_contributing_tokens=prediction.top_tokens,
            model_name=prediction.model_name,
            model_version=prediction.model_version,
            latency_ms=prediction.latency_ms,
            user_feedback=prediction.user_feedback,
            ai_explanation=prediction.ai_explanation,
            executive_summary=prediction.executive_summary,
            technical_explanation=prediction.technical_explanation,
            threat_level=prediction.threat_level,
            risk_breakdown=prediction.risk_breakdown,
            recommended_actions=prediction.recommended_actions,
            highlighted_entities=prediction.highlighted_entities,
            similar_patterns=prediction.similar_patterns,
            created_at=prediction.created_at,
        )
