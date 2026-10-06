def test_get_current_user_profile_success(client, auth_headers, test_user):
    response = client.get("/api/v1/users/me", headers={"Authorization": auth_headers["Authorization"]})
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert json_data["data"]["email"] == test_user["email"]
    assert json_data["data"]["profile"]["full_name"] == test_user["full_name"]


def test_get_current_user_unauthorized(client):
    response = client.get("/api/v1/users/me")
    assert response.status_code == 401


def test_update_profile_success(client, auth_headers):
    update_payload = {
        "full_name": "Updated Candidate Name",
        "target_domain": "Full Stack Software Engineer",
        "experience_level": "Fresher",
        "bio": "Enthusiastic computer science graduate preparing for technical interviews.",
    }
    response = client.put(
        "/api/v1/users/me/profile",
        json=update_payload,
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert json_data["data"]["full_name"] == "Updated Candidate Name"
    assert json_data["data"]["target_domain"] == "Full Stack Software Engineer"
    assert json_data["data"]["experience_level"] == "Fresher"
    assert json_data["data"]["bio"] == "Enthusiastic computer science graduate preparing for technical interviews."

    # Verify retrieval reflects update
    me_response = client.get("/api/v1/users/me", headers={"Authorization": auth_headers["Authorization"]})
    assert me_response.json()["data"]["profile"]["target_domain"] == "Full Stack Software Engineer"
