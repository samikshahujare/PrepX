import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)


def test_avatar_status():
    response = client.get("/api/v1/avatar/status")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["active_provider"] == "local"
    assert data["data"]["configured"] is True
    assert "Sarah Jenkins" in data["data"]["target_persona"]
    assert data["data"]["reference_image_url"] == "/avatars/sarah-reference.png"


def test_avatar_session_local():
    response = client.post("/api/v1/avatar/session", json={"session_id": "test-session"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["configured"] is True
    assert data["data"]["status"] == "ready"
    assert data["data"]["vendor"] == "local"
    assert data["data"]["session_token"] == "test-session"
