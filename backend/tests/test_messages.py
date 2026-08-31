from unittest.mock import patch, MagicMock


def register_and_login(client, email: str, password: str = "StrongPass1") -> str:
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    login_resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return login_resp.json()["access_token"]


FAKE_ML_RESPONSE = {
    "verdict": "scam",
    "scam_probability": 0.91,
    "risk_level": "high",
    "scam_category": "banking_fraud",
    "confidence_score": 0.82,
    "threat_score": 0.95,
    "top_contributing_tokens": [{"token": "verify", "weight": 0.5}],
    "model_name": "naive_bayes",
    "model_version": "v1",
    "latency_ms": 3.2,
}


def _mock_httpx_post(*args, **kwargs):
    mock_response = MagicMock()
    mock_response.json.return_value = FAKE_ML_RESPONSE
    mock_response.raise_for_status.return_value = None
    return mock_response


def test_analyze_requires_auth(client):
    response = client.post("/api/v1/messages/analyze", json={"text": "hello"})
    assert response.status_code == 401


def test_analyze_persists_and_returns_result(client):
    token = register_and_login(client, "analyze@example.com")
    with patch("app_service.services.message_service.httpx.post", side_effect=_mock_httpx_post):
        response = client.post(
            "/api/v1/messages/analyze",
            json={"text": "Urgent verify your account now"},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "scam"
    assert data["text"] == "Urgent verify your account now"
    assert data["user_feedback"] is None


def test_history_returns_persisted_analyses(client):
    token = register_and_login(client, "history@example.com")
    with patch("app_service.services.message_service.httpx.post", side_effect=_mock_httpx_post):
        client.post(
            "/api/v1/messages/analyze",
            json={"text": "message one"},
            headers={"Authorization": f"Bearer {token}"},
        )

    response = client.get("/api/v1/messages/history", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["text"] == "message one"


def test_history_is_scoped_to_user(client):
    token_a = register_and_login(client, "usera@example.com")
    token_b = register_and_login(client, "userb@example.com")
    with patch("app_service.services.message_service.httpx.post", side_effect=_mock_httpx_post):
        client.post(
            "/api/v1/messages/analyze",
            json={"text": "user a message"},
            headers={"Authorization": f"Bearer {token_a}"},
        )

    response = client.get("/api/v1/messages/history", headers={"Authorization": f"Bearer {token_b}"})
    assert response.json() == []


def test_feedback_updates_prediction(client):
    token = register_and_login(client, "feedback@example.com")
    with patch("app_service.services.message_service.httpx.post", side_effect=_mock_httpx_post):
        analyze_resp = client.post(
            "/api/v1/messages/analyze",
            json={"text": "feedback test"},
            headers={"Authorization": f"Bearer {token}"},
        )
    prediction_id = analyze_resp.json()["id"]

    response = client.patch(
        f"/api/v1/messages/{prediction_id}/feedback",
        json={"is_accurate": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["user_feedback"] is True


def test_feedback_on_missing_prediction_returns_404(client):
    import uuid

    token = register_and_login(client, "missingfeedback@example.com")
    response = client.patch(
        f"/api/v1/messages/{uuid.uuid4()}/feedback",
        json={"is_accurate": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404


def test_analyze_returns_503_when_ml_service_unavailable(client):
    token = register_and_login(client, "unavailable@example.com")
    import httpx as httpx_module

    with patch(
        "app_service.services.message_service.httpx.post",
        side_effect=httpx_module.ConnectError("connection refused"),
    ), patch(
        "app_service.services.message_service.get_in_process_prediction_service",
        side_effect=RuntimeError("in-process model unavailable"),
    ):
        response = client.post(
            "/api/v1/messages/analyze",
            json={"text": "test"},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 503
