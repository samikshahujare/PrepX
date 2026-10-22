import pytest
from tests.test_resumes import create_sample_docx_bytes


@pytest.fixture
def active_interview_session(client, auth_headers):
    # 1. Upload sample resume
    docx_bytes = create_sample_docx_bytes(name="Alex Rivera", email="alex.r@prepx.ai")
    files = {
        "file": ("alex_resume.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    }
    resume_res = client.post("/api/v1/resumes/upload", files=files, headers={"Authorization": auth_headers["Authorization"]})
    assert resume_res.status_code == 201
    resume_id = resume_res.json()["data"]["id"]

    # 2. Create Interview Session
    session_res = client.post(
        "/api/v1/interview-sessions/sessions",
        json={
            "domain": "Software Engineering (Full Stack)",
            "company": "Stripe",
            "difficulty": "Medium",
            "resume_id": resume_id,
        },
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert session_res.status_code == 201
    session_id = session_res.json()["data"]["id"]

    # 3. Generate Questions
    gen_res = client.post(
        f"/api/v1/interview-sessions/sessions/{session_id}/questions/generate",
        json={"count": 3},
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert gen_res.status_code == 200
    assert len(gen_res.json()["data"]) == 3

    return session_id


def test_start_interview_flow(client, auth_headers, active_interview_session):
    session_id = active_interview_session

    # Start the interview
    start_res = client.post(
        f"/api/v1/interview-sessions/sessions/{session_id}/start",
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert start_res.status_code == 200
    data = start_res.json()["data"]
    assert data["interview_status"] == "active"
    assert data["current_question_index"] == 1
    assert data["total_questions"] == 3
    assert data["current_question"] is not None
    assert "Sarah" in data["interviewer_message"]
    assert data["started_at"] is not None

    # Check that transcript has recorded the initial interviewer greeting
    transcripts_res = client.get(
        f"/api/v1/interview-sessions/sessions/{session_id}/transcripts",
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert transcripts_res.status_code == 200
    transcripts = transcripts_res.json()["data"]
    assert len(transcripts) >= 1
    assert transcripts[0]["speaker"] == "interviewer"
    assert transcripts[0]["sequence_number"] == 1


def test_submit_candidate_response_with_followup_and_sequencing(client, auth_headers, active_interview_session):
    session_id = active_interview_session

    # 1. Start interview
    client.post(
        f"/api/v1/interview-sessions/sessions/{session_id}/start",
        headers={"Authorization": auth_headers["Authorization"]},
    )

    # 2. Submit response mentioning tech keyword (e.g. 'PostgreSQL') to trigger follow-up
    resp1 = client.post(
        f"/api/v1/interview-sessions/sessions/{session_id}/response",
        json={"candidate_response": "I designed the data models in PostgreSQL using indexing to optimize queries."},
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert resp1.status_code == 200
    data1 = resp1.json()["data"]
    if data1["is_followup"]:
        assert any(term in data1["interviewer_message"].lower() for term in ["database", "index", "shard", "postgresql", "trade", "data", "arch", "query", "table", "schema", "how", "what", "could", "why"])
        assert data1["current_question_index"] == 1  # still on Question 1 during follow-up

        # 3. Answer follow-up question(s)
        resp2 = client.post(
            f"/api/v1/interview-sessions/sessions/{session_id}/response",
            json={"candidate_response": "We analyzed query execution plans and avoided composite indices on write-heavy tables."},
            headers={"Authorization": auth_headers["Authorization"]},
        )
        assert resp2.status_code == 200
        data2 = resp2.json()["data"]
        while data2.get("is_followup") and not data2.get("is_completed"):
            resp2 = client.post(
                f"/api/v1/interview-sessions/sessions/{session_id}/response",
                json={"candidate_response": "We also partitioned historical records and tuned PostgreSQL shared_buffers for high write throughput."},
                headers={"Authorization": auth_headers["Authorization"]},
            )
            assert resp2.status_code == 200
            data2 = resp2.json()["data"]

        assert data2["current_question_index"] >= 2  # Advanced to Question 2
        assert data2["is_completed"] is False
    else:
        # LLM evaluated response as comprehensive and advanced to Question 2 directly
        assert data1["current_question_index"] >= 2

    # 4. Answer Question 2
    resp3 = client.post(
        f"/api/v1/interview-sessions/sessions/{session_id}/response",
        json={"candidate_response": "For load balancing, we deployed behind an Nginx reverse proxy with round-robin."},
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert resp3.status_code == 200
    data3 = resp3.json()["data"]
    # Check if moved to Question 3
    while data3.get("is_followup") and not data3.get("is_completed"):
        # answer follow-up
        resp3_follow = client.post(
            f"/api/v1/interview-sessions/sessions/{session_id}/response",
            json={"candidate_response": "We monitored latency and CPU utilization across clusters."},
            headers={"Authorization": auth_headers["Authorization"]},
        )
        assert resp3_follow.status_code == 200
        data3 = resp3_follow.json()["data"]

    assert data3["current_question_index"] >= 3

    # 5. Answer Question 3 (Final question)
    resp4 = client.post(
        f"/api/v1/interview-sessions/sessions/{session_id}/response",
        json={"candidate_response": "We maintained 99.9% uptime with automated integration tests and rollbacks."},
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert resp4.status_code == 200
    data4 = resp4.json()["data"]
    while data4.get("is_followup") and not data4.get("is_completed"):
        resp4 = client.post(
            f"/api/v1/interview-sessions/sessions/{session_id}/response",
            json={"candidate_response": "We used blue-green deployments with automated health checks."},
            headers={"Authorization": auth_headers["Authorization"]},
        )
        assert resp4.status_code == 200
        data4 = resp4.json()["data"]

    if data4.get("is_completed"):
        assert data4["interview_status"] == "completed"
    else:
        # Duration-aware engine: session continues generating relevant questions because duration remains!
        assert data4["current_question_index"] >= 4
        # Explicit end completes session and generates feedback
        end_res = client.post(
            f"/api/v1/interview-sessions/sessions/{session_id}/end",
            headers={"Authorization": auth_headers["Authorization"]},
        )
        assert end_res.status_code == 200
        assert end_res.json()["data"]["interview_status"] == "completed"

    # Verify transcripts contain full conversation with candidate and interviewer messages
    transcripts_res = client.get(
        f"/api/v1/interview-sessions/sessions/{session_id}/transcripts",
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert transcripts_res.status_code == 200
    transcripts = transcripts_res.json()["data"]
    assert len(transcripts) >= 6
    speakers = [t["speaker"] for t in transcripts]
    assert "interviewer" in speakers
    assert "candidate" in speakers


def test_pause_resume_and_end_interview(client, auth_headers, active_interview_session):
    session_id = active_interview_session

    # Start
    client.post(
        f"/api/v1/interview-sessions/sessions/{session_id}/start",
        headers={"Authorization": auth_headers["Authorization"]},
    )

    # Pause
    pause_res = client.post(
        f"/api/v1/interview-sessions/sessions/{session_id}/pause",
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert pause_res.status_code == 200
    assert pause_res.json()["data"]["interview_status"] == "paused"

    # Resume
    resume_res = client.post(
        f"/api/v1/interview-sessions/sessions/{session_id}/resume",
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert resume_res.status_code == 200
    assert resume_res.json()["data"]["interview_status"] == "active"

    # End
    end_res = client.post(
        f"/api/v1/interview-sessions/sessions/{session_id}/end",
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert end_res.status_code == 200
    assert end_res.json()["data"]["interview_status"] == "completed"
    assert end_res.json()["data"]["ended_at"] is not None


def test_cross_user_isolation_for_runtime_and_transcripts(client, auth_headers, active_interview_session):
    session_id = active_interview_session

    # Start interview by Owner
    client.post(
        f"/api/v1/interview-sessions/sessions/{session_id}/start",
        headers={"Authorization": auth_headers["Authorization"]},
    )

    # Register User 2
    client.post("/api/v1/auth/register", json={
        "email": "intruder@prepx.ai",
        "password": "IntruderPass123!",
        "full_name": "Intruder User"
    })
    login_res = client.post("/api/v1/auth/login", json={
        "email": "intruder@prepx.ai",
        "password": "IntruderPass123!"
    })
    user2_token = login_res.json()["data"]["access_token"]
    user2_headers = {"Authorization": f"Bearer {user2_token}"}

    # User 2 tries to access transcripts -> 404 / error
    unauth_transcripts = client.get(
        f"/api/v1/interview-sessions/sessions/{session_id}/transcripts",
        headers=user2_headers,
    )
    assert unauth_transcripts.status_code == 404

    # User 2 tries to submit response -> 404 / error
    unauth_resp = client.post(
        f"/api/v1/interview-sessions/sessions/{session_id}/response",
        json={"candidate_response": "I am an unauthorized user."},
        headers=user2_headers,
    )
    assert unauth_resp.status_code == 404


def test_invalid_response_submission(client, auth_headers, active_interview_session):
    session_id = active_interview_session

    client.post(
        f"/api/v1/interview-sessions/sessions/{session_id}/start",
        headers={"Authorization": auth_headers["Authorization"]},
    )

    # Empty candidate response -> 422
    invalid_resp = client.post(
        f"/api/v1/interview-sessions/sessions/{session_id}/response",
        json={"candidate_response": ""},
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert invalid_resp.status_code == 422
