import uuid


def test_gd_api_lifecycle(client, auth_headers):
    # 1. Create a GD session
    create_payload = {
        "topic": "Can autonomous AI agents collaborate effectively without human oversight?",
        "topic_category": "Technology & AI",
        "topic_context": "Distributed systems engineering",
        "duration_minutes": 15,
        "max_participants": 6,
    }
    create_res = client.post(
        "/api/v1/gd/sessions",
        json=create_payload,
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert create_res.status_code == 201
    created_data = create_res.json()["data"]
    session_id = created_data["id"]
    session_code = created_data["session_code"]
    assert session_code.startswith("PREPX-GD-")
    assert len(created_data["participants"]) == 1
    assert created_data["participants"][0]["is_host"] is True

    # 2. List user GD sessions
    list_res = client.get(
        "/api/v1/gd/sessions",
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert list_res.status_code == 200
    sessions_list = list_res.json()["data"]
    assert any(s["id"] == session_id for s in sessions_list)

    # 3. Get session by ID
    get_res = client.get(
        f"/api/v1/gd/sessions/{session_id}",
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert get_res.status_code == 200
    assert get_res.json()["data"]["session_code"] == session_code

    # 4. Generate Topic via API
    gen_topic_res = client.post(
        f"/api/v1/gd/sessions/{session_id}/generate-topic",
        json={"category": "Technology & AI", "role_context": "Senior Architect"},
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert gen_topic_res.status_code == 200
    assert "topic" in gen_topic_res.json()["data"]

    # 5. Create Invitation Token & Share URLs
    invite_res = client.post(
        f"/api/v1/gd/sessions/{session_id}/invitations",
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert invite_res.status_code == 201
    invite_data = invite_res.json()["data"]
    token = invite_data["token"]
    assert "whatsapp_share_url" in invite_data
    assert "api.whatsapp.com" in invite_data["whatsapp_share_url"]
    assert "join_url" in invite_data

    # 6. Validate invitation publicly (no auth required for guest validation)
    val_res = client.get(f"/api/v1/gd/invitations/{token}/validate")
    assert val_res.status_code == 200
    val_data = val_res.json()["data"]
    assert val_data["is_valid"] is True
    assert val_data["session"]["session_code"] == session_code

    # 7. Join via invitation (as an invited peer/guest)
    join_res = client.post(
        f"/api/v1/gd/invitations/{token}/join",
        json={"display_name": "Jordan Peer", "guest_id": "guest_peer_999"},
    )
    assert join_res.status_code == 200
    participant = join_res.json()["data"]
    assert participant["display_name"] == "Jordan Peer"
    assert participant["is_host"] is False
    peer_participant_id = participant["id"]

    # 8. Guest retrieves session details using participant_id without user JWT
    guest_get_res = client.get(
        f"/api/v1/gd/sessions/{session_id}?participant_id={peer_participant_id}"
    )
    assert guest_get_res.status_code == 200
    assert guest_get_res.json()["data"]["session_code"] == session_code

    # 9. Unauthenticated request without participant_id fails with 401
    unauth_res = client.get(f"/api/v1/gd/sessions/{session_id}")
    assert unauth_res.status_code == 401

    # 10. Guest retrieves their personal evaluation report using participant_id
    guest_eval_res = client.get(
        f"/api/v1/gd/sessions/{session_id}/evaluations/me?participant_id={peer_participant_id}"
    )
    assert guest_eval_res.status_code == 200
    assert guest_eval_res.json()["data"]["participant_id"] == peer_participant_id
    assert "overall_score" in guest_eval_res.json()["data"]


def test_gd_invitation_public_vs_local_origin(client, auth_headers):
    from app.core.config import settings

    # Create session
    create_res = client.post(
        "/api/v1/gd/sessions",
        json={
            "topic": "Public Origin Consistency Test",
            "topic_category": "Technology & AI",
            "duration_minutes": 15,
            "max_participants": 4,
        },
        headers={"Authorization": auth_headers["Authorization"]},
    )
    session_id = create_res.json()["data"]["id"]

    # Case A: Explicit public URL configured
    orig_pub = settings.APP_PUBLIC_URL
    try:
        settings.APP_PUBLIC_URL = "https://arena.prepx.ai"
        pub_invite_res = client.post(
            f"/api/v1/gd/sessions/{session_id}/invitations",
            headers={"Authorization": auth_headers["Authorization"]},
        )
        assert pub_invite_res.status_code == 201
        data = pub_invite_res.json()["data"]
        assert data["join_url"].startswith("https://arena.prepx.ai/gd/join/")
        assert data["is_public"] is True
        assert "https%3A%2F%2Farena.prepx.ai%2Fgd%2Fjoin%2F" in data["whatsapp_share_url"] or "https://arena.prepx.ai/gd/join/" in data["whatsapp_share_url"]
        assert "https://arena.prepx.ai/gd/join/" in data["email_share_body"]

        # Case B: Local development origin
        settings.APP_PUBLIC_URL = None
        settings.FRONTEND_URL = "http://localhost:3000"
        loc_invite_res = client.post(
            f"/api/v1/gd/sessions/{session_id}/invitations",
            headers={
                "Authorization": auth_headers["Authorization"],
                "Origin": "http://localhost:3000",
            },
        )
        assert loc_invite_res.status_code == 201
        loc_data = loc_invite_res.json()["data"]
        assert loc_data["join_url"].startswith("http://localhost:3000/gd/join/")
        assert loc_data["is_public"] is False
    finally:
        settings.APP_PUBLIC_URL = orig_pub


def test_gd_invalid_and_expired_tokens(client, auth_headers, db_session):
    from datetime import datetime, timezone, timedelta
    from app.models.gd import GDInvitationToken

    # Validate nonexistent token returns 400 with helpful message
    invalid_res = client.get("/api/v1/gd/invitations/nonexistent-token-xyz/validate")
    assert invalid_res.status_code == 400
    assert "invalid or has been revoked" in invalid_res.json()["message"].lower()

    # Create session and invitation, then artificially expire it
    create_res = client.post(
        "/api/v1/gd/sessions",
        json={
            "topic": "Token Expiration Test",
            "topic_category": "Social & Ethics",
            "duration_minutes": 10,
            "max_participants": 4,
        },
        headers={"Authorization": auth_headers["Authorization"]},
    )
    session_id = create_res.json()["data"]["id"]
    invite_res = client.post(
        f"/api/v1/gd/sessions/{session_id}/invitations",
        headers={"Authorization": auth_headers["Authorization"]},
    )
    token = invite_res.json()["data"]["token"]

    # Expire token in DB
    db_token = db_session.query(GDInvitationToken).filter(GDInvitationToken.token == token).first()
    db_token.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    db_session.commit()

    # Validation should now fail with expired message
    expired_res = client.get(f"/api/v1/gd/invitations/{token}/validate")
    assert expired_res.status_code == 400
    assert "expired" in expired_res.json()["message"].lower()


def test_gd_guest_isolation_from_private_endpoints(client, auth_headers):
    # 1. Create session and join as guest
    create_res = client.post(
        "/api/v1/gd/sessions",
        json={
            "topic": "Security Isolation Test",
            "topic_category": "Business & Economy",
            "duration_minutes": 15,
            "max_participants": 4,
        },
        headers={"Authorization": auth_headers["Authorization"]},
    )
    session_id = create_res.json()["data"]["id"]
    invite_res = client.post(
        f"/api/v1/gd/sessions/{session_id}/invitations",
        headers={"Authorization": auth_headers["Authorization"]},
    )
    token = invite_res.json()["data"]["token"]

    join_res = client.post(
        f"/api/v1/gd/invitations/{token}/join",
        json={"display_name": "Untrusted Guest", "guest_id": "guest_untrusted_1"},
    )
    guest_id = join_res.json()["data"]["id"]

    # 2. Guest presenting X-Participant-Id cannot access user profile
    res1 = client.get("/api/v1/users/me", headers={"X-Participant-Id": guest_id})
    assert res1.status_code == 401

    # 3. Guest presenting X-Participant-Id cannot access user resumes
    res2 = client.get("/api/v1/resumes", headers={"X-Participant-Id": guest_id})
    assert res2.status_code == 401

    # 4. Guest presenting X-Participant-Id cannot access interview sessions
    res3 = client.get("/api/v1/interview-sessions/sessions", headers={"X-Participant-Id": guest_id})
    assert res3.status_code == 401

    # 5. Guest cannot generate new invitations
    res4 = client.post(f"/api/v1/gd/sessions/{session_id}/invitations", headers={"X-Participant-Id": guest_id})
    assert res4.status_code == 401

    # 6. Guest cannot create new sessions
    res5 = client.post(
        "/api/v1/gd/sessions",
        json={"topic": "Unauthorized Session", "topic_category": "Social & Ethics", "duration_minutes": 15, "max_participants": 4},
        headers={"X-Participant-Id": guest_id},
    )
    assert res5.status_code == 401

    # 7. Unauthenticated request without participant ID returns 401
    res6 = client.get(f"/api/v1/gd/sessions/{session_id}/evaluations/me")
    assert res6.status_code == 401

    # 8. Fake or unrelated participant ID cannot read evaluations (returns 404 Not Found)
    fake_pid = str(uuid.uuid4())
    res7 = client.get(
        f"/api/v1/gd/sessions/{session_id}/evaluations/me?participant_id={fake_pid}"
    )
    assert res7.status_code == 404
