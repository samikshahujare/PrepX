def test_register_user_success(client):
    payload = {
        "email": "newuser@prepx.ai",
        "password": "StrongPassword999!",
        "full_name": "Alice Candidate",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    json_data = response.json()
    assert json_data["success"] is True
    assert json_data["data"]["email"] == "newuser@prepx.ai"
    assert json_data["data"]["profile"]["full_name"] == "Alice Candidate"
    assert "password" not in json_data["data"]
    assert "password_hash" not in json_data["data"]


def test_register_duplicate_email_fails(client, test_user):
    payload = {
        "email": test_user["email"],
        "password": "AnotherPassword123!",
        "full_name": "Duplicate User",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409
    json_data = response.json()
    assert json_data["success"] is False
    assert json_data["error"]["code"] == "USER_ALREADY_EXISTS"


def test_login_success(client, test_user):
    payload = {
        "email": test_user["email"],
        "password": test_user["password"],
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert "access_token" in json_data["data"]
    assert "refresh_token" in json_data["data"]
    assert json_data["data"]["token_type"] == "bearer"


def test_login_wrong_password_fails(client, test_user):
    payload = {
        "email": test_user["email"],
        "password": "IncorrectPassword!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    json_data = response.json()
    assert json_data["success"] is False
    assert json_data["error"]["code"] == "INVALID_CREDENTIALS"


def test_token_refresh_success(client, auth_headers):
    refresh_token = auth_headers["refresh_token"]
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert "access_token" in json_data["data"]


def test_token_refresh_invalid_fails(client):
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "invalid_fake_jwt_token_string"},
    )
    assert response.status_code == 401
    json_data = response.json()
    assert json_data["success"] is False
    assert json_data["error"]["code"] == "INVALID_TOKEN"


def test_logout_and_subsequent_refresh_fails(client, auth_headers):
    refresh_token = auth_headers["refresh_token"]

    # Logout (revokes refresh token)
    logout_res = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": refresh_token},
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert logout_res.status_code == 200
    assert logout_res.json()["data"]["revoked"] is True

    # Attempting to refresh with revoked token should fail
    refresh_res = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_res.status_code == 401
    assert refresh_res.json()["error"]["code"] == "INVALID_TOKEN"
