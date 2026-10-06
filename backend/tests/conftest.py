import os
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure backend root is in sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Set test environment
os.environ["APP_ENV"] = "testing"
os.environ["SECRET_KEY"] = "test_super_secret_key_for_jwt_tokens_12345"

from app.db.session import Base, get_db
from app.main import app

# In-memory SQLite for high-speed deterministic test suite
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database for each test function."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Override get_db dependency and return FastAPI TestClient."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_user(client):
    """Fixture that creates and returns a test user."""
    payload = {
        "email": "candidate@prepx.ai",
        "password": "SecurePassword123!",
        "full_name": "Test Candidate",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    return payload


@pytest.fixture(scope="function")
def auth_headers(client, test_user):
    """Fixture that logs in the test user and returns authorization bearer headers."""
    login_payload = {
        "email": test_user["email"],
        "password": test_user["password"],
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    token = response.json()["data"]["access_token"]
    return {
        "Authorization": f"Bearer {token}",
        "refresh_token": response.json()["data"]["refresh_token"],
    }
