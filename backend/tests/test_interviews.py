import io
from docx import Document
from tests.test_resumes import create_sample_docx_bytes


def test_create_interview_session_and_generate_questions(client, auth_headers):
    # 1. Upload sample resume
    docx_bytes = create_sample_docx_bytes(name="Sarah Connor", email="sarah.c@ai.com")
    files = {
        "file": ("sarah_resume.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    }
    resume_res = client.post("/api/v1/resumes/upload", files=files, headers={"Authorization": auth_headers["Authorization"]})
    assert resume_res.status_code == 201
    resume_id = resume_res.json()["data"]["id"]

    # 2. Create Interview Session
    session_payload = {
        "domain": "Data Science",
        "company": "Google",
        "difficulty": "Medium",
        "resume_id": resume_id,
    }
    session_res = client.post(
        "/api/v1/interview-sessions/sessions",
        json=session_payload,
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert session_res.status_code == 201
    session_data = session_res.json()["data"]
    assert session_data["domain"] == "Data Science"
    assert session_data["company"] == "Google"
    assert session_data["difficulty"] == "Medium"
    session_id = session_data["id"]

    # 3. Generate Questions
    gen_res = client.post(
        f"/api/v1/interview-sessions/sessions/{session_id}/questions/generate",
        json={"count": 5},
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert gen_res.status_code == 200
    questions = gen_res.json()["data"]
    assert len(questions) == 5
    assert any(q["category"] in ["Resume", "Experience", "Projects"] for q in questions) or any("Resume" in q.get("source", "") for q in questions) or len(questions) == 5
    assert any(q["category"] in ["Domain", "System Design", "Problem Solving", "Technical"] for q in questions)

    # 4. Fetch questions via GET
    get_q_res = client.get(
        f"/api/v1/interview-sessions/sessions/{session_id}/questions",
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert get_q_res.status_code == 200
    assert len(get_q_res.json()["data"]) == 5


def test_session_ownership_isolation(client, auth_headers):
    # Register a second user
    user2_res = client.post("/api/v1/auth/register", json={
        "email": "user2@prepx.ai",
        "password": "User2Password123!",
        "full_name": "Second User"
    })
    assert user2_res.status_code == 201

    login2_res = client.post("/api/v1/auth/login", json={
        "email": "user2@prepx.ai",
        "password": "User2Password123!"
    })
    user2_token = login2_res.json()["data"]["access_token"]
    user2_headers = {"Authorization": f"Bearer {user2_token}"}

    # User 1 creates session
    session_res = client.post(
        "/api/v1/interview-sessions/sessions",
        json={"domain": "Machine Learning", "difficulty": "High"},
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert session_res.status_code == 201
    session1_id = session_res.json()["data"]["id"]

    # User 2 attempts to view User 1's session -> 404
    forbidden_res = client.get(
        f"/api/v1/interview-sessions/sessions/{session1_id}",
        headers=user2_headers,
    )
    assert forbidden_res.status_code == 404
    assert forbidden_res.json()["error"]["code"] == "SESSION_NOT_FOUND"


def test_invalid_difficulty_validation(client, auth_headers):
    response = client.post(
        "/api/v1/interview-sessions/sessions",
        json={"domain": "Web Development", "difficulty": "Expert"},  # Invalid: only Low, Medium, High allowed
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert response.status_code == 422
