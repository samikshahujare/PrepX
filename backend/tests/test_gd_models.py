import uuid
from datetime import datetime, timezone
from app.models.user import User
from app.models.gd import (
    GDSession,
    GDParticipant,
    GDInvitationToken,
    GDTranscript,
    GDEvaluation,
)


def test_create_and_query_gd_models(db_session):
    # 1. Create a user
    user = User(
        email="moderator@prepx.ai",
        password_hash="fakehashedpassword",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # 2. Create GDSession
    session = GDSession(
        creator_id=user.id,
        session_code="PREPX-GD-TEST1",
        topic="Is AI replacing human judgment in technical recruitment?",
        topic_category="Technology & AI",
        duration_minutes=15,
        max_participants=6,
        status="waiting_for_participants",
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    assert session.id is not None
    assert session.session_code == "PREPX-GD-TEST1"
    assert session.status == "waiting_for_participants"

    # 3. Create GDParticipant
    participant = GDParticipant(
        session_id=session.id,
        user_id=user.id,
        display_name="Alex Morgan",
        is_host=True,
    )
    db_session.add(participant)
    db_session.commit()
    db_session.refresh(participant)

    assert participant.id is not None
    assert participant.is_host is True

    # 4. Create GDInvitationToken
    token = GDInvitationToken(
        session_id=session.id,
        token="test_secure_token_1234567890",
        expires_at=datetime.now(timezone.utc),
        is_active=True,
    )
    db_session.add(token)
    db_session.commit()
    db_session.refresh(token)

    assert token.token == "test_secure_token_1234567890"

    # 5. Create GDTranscript
    transcript = GDTranscript(
        session_id=session.id,
        participant_id=participant.id,
        speaker_name="Alex Morgan",
        is_moderator=False,
        message="I believe AI augments interviewers rather than replacing human empathy.",
        timestamp_seconds=12.5,
        sequence_number=1,
    )
    db_session.add(transcript)
    db_session.commit()
    db_session.refresh(transcript)

    assert transcript.sequence_number == 1

    # 6. Create GDEvaluation
    eval_report = GDEvaluation(
        session_id=session.id,
        participant_id=participant.id,
        user_id=user.id,
        overall_score=4.2,
        category_scores={"communication_clarity": 4.5, "listening": 4.0},
        strengths=["Clear thesis statement", "Grounded rebuttal"],
        areas_for_improvement=["Could invite quieter participants"],
        communication_feedback="Very structured and articulate.",
        reasoning_feedback="Good logical flow.",
        listening_feedback="Acknowledged prior peer points.",
        missed_opportunities=["Could provide quantitative industry benchmarks"],
        example_strong_response="For instance, 68% of tech hiring managers use AI for pre-screening.",
        personalized_plan={"recommended_drills": ["Active listening", "Consensus building"]},
    )
    db_session.add(eval_report)
    db_session.commit()
    db_session.refresh(eval_report)

    assert eval_report.overall_score == 4.2
    assert eval_report.category_scores["communication_clarity"] == 4.5
