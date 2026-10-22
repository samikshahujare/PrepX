import uuid
from app.models.user import User
from app.services.gd_service import GDService
from app.schemas.gd import GDSessionCreate


def test_gd_service_create_session_and_invitation(db_session):
    # Setup test user
    user = User(
        email="host@prepx.ai",
        password_hash="fakehash",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    gd_service = GDService(db_session)

    # 1. Topic generation test
    topic_data = gd_service.generate_topic(
        category="Technology & AI",
        role_context="Software Engineering",
    )
    assert topic_data is not None
    assert "topic" in topic_data
    assert len(topic_data["topic"]) > 5
    assert "briefing" in topic_data

    # 2. Session creation test
    create_schema = GDSessionCreate(
        topic=topic_data["topic"],
        topic_category="Technology & AI",
        topic_context="Software Engineering role simulation",
        duration_minutes=15,
        max_participants=6,
    )
    session = gd_service.create_session(creator_id=user.id, data=create_schema, host_name="Sarah Host")
    assert session.id is not None
    assert session.session_code.startswith("PREPX-GD-")
    assert session.status == "waiting_for_participants"
    assert len(session.participants) == 1
    assert session.participants[0].is_host is True
    assert session.participants[0].display_name == "Sarah Host"

    # 3. Create Invitation Token test
    invite = gd_service.create_invitation(session_id=session.id)
    assert invite is not None
    assert len(invite.token) >= 32
    assert invite.is_active is True

    # 4. Validate Invitation test
    validated = gd_service.validate_invitation(invite.token)
    assert validated["is_valid"] is True
    assert validated["session"]["session_code"] == session.session_code
    assert validated["session"]["topic"] == session.topic
    assert validated["current_participants"] == 1
    assert validated["max_participants"] == 6

    # 5. Join Session via invitation test
    guest_join = gd_service.join_participant(
        session_id=session.id,
        display_name="Guest Alex",
        user_id=None,
        guest_id="guest-uuid-1234",
    )
    assert guest_join.id is not None
    assert guest_join.display_name == "Guest Alex"
    assert guest_join.is_host is False

    # 6. Duplicate Join idempotency test: same guest reconnecting should not duplicate
    rejoin = gd_service.join_participant(
        session_id=session.id,
        display_name="Guest Alex Updated",
        user_id=None,
        guest_id="guest-uuid-1234",
    )
    assert rejoin.id == guest_join.id
