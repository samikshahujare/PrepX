import pytest
from app.models.user import User
from app.models.gd import GDSession, GDParticipant, GDTranscript
from app.services.gd_service import GDService
from app.services.gd_moderator_service import GDModeratorService
from app.schemas.gd import GDSessionCreate


def test_gd_moderator_service_lifecycle(db_session):
    # Setup user and session
    user = User(email="sarah_mod@prepx.ai", password_hash="fakehash", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    gd_service = GDService(db_session)
    session = gd_service.create_session(
        creator_id=user.id,
        data=GDSessionCreate(
            topic="Should engineering teams prioritize code velocity over full test coverage in early-stage startups?",
            topic_category="Technology & AI",
            duration_minutes=15,
            max_participants=6,
        ),
        host_name="Alex Host",
    )
    participant = session.participants[0]

    moderator_service = GDModeratorService(db_session)

    # 1. Opening statement test
    opening = moderator_service.generate_opening(
        topic=session.topic,
        duration_minutes=session.duration_minutes,
    )
    assert opening is not None
    assert "topic" in opening.lower() or "welcome" in opening.lower() or "discussion" in opening.lower()
    assert len(opening) > 40

    # 2. Record transcript segment
    saved_t = moderator_service.record_transcript(
        session_id=session.id,
        participant_id=participant.id,
        speaker_name=participant.display_name,
        message="Speed is essential early on to find product-market fit before runway runs out.",
        timestamp_seconds=24.0,
        is_moderator=False,
    )
    assert saved_t.id is not None
    assert saved_t.sequence_number == 1
    assert saved_t.message.startswith("Speed is essential")

    # 3. Moderation decision with cooldown protection test
    # First intervention
    intervention1 = moderator_service.evaluate_moderation_turn(
        session=session,
        recent_transcripts=[saved_t],
        elapsed_seconds=120.0,
        remaining_seconds=780.0,
        force=True,
    )
    assert intervention1 is not None
    assert "text" in intervention1

    # Second immediate intervention should be blocked by cooldown (force=False)
    intervention2 = moderator_service.evaluate_moderation_turn(
        session=session,
        recent_transcripts=[saved_t],
        elapsed_seconds=130.0,
        remaining_seconds=770.0,
        force=False,
    )
    assert intervention2 is None  # Cooldown active!

    # 4. Closing statement test
    closing = moderator_service.generate_closing(
        topic=session.topic,
        transcripts=[saved_t],
    )
    assert closing is not None
    assert len(closing) > 30


def test_gd_moderator_silence_and_quieter_speaker_targeting(db_session):
    user = User(email="silence_test@prepx.ai", password_hash="fakehash", is_active=True)
    db_session.add(user)
    db_session.commit()

    gd_service = GDService(db_session)
    session = gd_service.create_session(
        creator_id=user.id,
        data=GDSessionCreate(
            topic="Should AI models be open-source or proprietary?",
            topic_category="Technology & AI",
            duration_minutes=10,
            max_participants=4,
        ),
        host_name="Host Sam",
    )
    mod_svc = GDModeratorService(db_session)

    # When silence exceeds 22s and quieter participant is identified
    res = mod_svc.evaluate_moderation_turn(
        session=session,
        recent_transcripts=[],
        elapsed_seconds=180.0,
        remaining_seconds=420.0,
        silence_seconds=25.0,
        quieter_participant_name="Elena",
        force=True,
    )
    assert res is not None
    assert "Elena" in res["text"]
    assert res["reason"] == "silence_breaker_quiet_participant"


def test_gd_moderator_candidate_speaking_lock(db_session):
    user = User(email="lock_test@prepx.ai", password_hash="fakehash", is_active=True)
    db_session.add(user)
    db_session.commit()

    gd_service = GDService(db_session)
    session = gd_service.create_session(
        creator_id=user.id,
        data=GDSessionCreate(
            topic="Is remote work better for software quality?",
            topic_category="Technology & AI",
            duration_minutes=10,
            max_participants=4,
        ),
        host_name="Host Jordan",
    )
    mod_svc = GDModeratorService(db_session)

    # When candidate is speaking, Sarah must NEVER interrupt
    res = mod_svc.evaluate_moderation_turn(
        session=session,
        recent_transcripts=[],
        elapsed_seconds=180.0,
        remaining_seconds=420.0,
        silence_seconds=30.0,
        is_candidate_speaking=True,
        force=True,
    )
    assert res is None


def test_gd_room_participation_and_dominant_speaker():
    from app.services.gd_room_manager import GDRoom

    room = GDRoom("TESTCODE")
    room.add_participant("p1", None, "Alice", is_host=True)
    room.add_participant("p2", None, "Bob", is_host=False)
    room.add_participant("p3", None, "Charlie", is_host=False)

    # Simulate speaking activity
    for _ in range(5):
        room.record_transcript_chunk("p1", "This is my dominant opinion on the architecture.", is_moderator=False)
    room.record_transcript_chunk("p2", "I agree with part of that.", is_moderator=False)

    # Check dominant participant
    dominant = room.get_dominant_participant()
    assert dominant is not None
    assert dominant["display_name"] == "Alice"

    # Check quieter participant
    quieter = room.get_quieter_participant()
    assert quieter is not None
    assert quieter["display_name"] == "Charlie"
    assert quieter["turn_count"] == 0

