import pytest
from app.models.user import User
from app.models.gd import GDSession, GDParticipant, GDTranscript, GDEvaluation
from app.services.gd_service import GDService
from app.services.gd_moderator_service import GDModeratorService
from app.services.gd_evaluator_service import GDEvaluatorService
from app.schemas.gd import GDSessionCreate


def test_individualized_gd_evaluation(db_session, client, auth_headers):
    # Setup Host User
    user_a = db_session.query(User).filter(User.email == "candidate@prepx.ai").first()
    if not user_a:
        user_a = User(email="candidate@prepx.ai", password_hash="fakehash", is_active=True)
        db_session.add(user_a)
        db_session.commit()
        db_session.refresh(user_a)

    gd_service = GDService(db_session)
    session = gd_service.create_session(
        creator_id=user_a.id,
        data=GDSessionCreate(
            topic="Is technical debt inevitable in high-growth software engineering organizations?",
            topic_category="Technology & AI",
            duration_minutes=15,
            max_participants=6,
        ),
        host_name="Alex A",
    )
    participant_a = session.participants[0]

    # Add Participant B
    participant_b = gd_service.join_participant(
        session_id=session.id,
        display_name="Taylor B",
        guest_id="guest_b_test",
    )

    # Insert transcripts with distinct contributions
    mod_svc = GDModeratorService(db_session)
    mod_svc.record_transcript(
        session_id=session.id,
        participant_id=participant_a.id,
        speaker_name="Alex A",
        message="I believe technical debt is a conscious financial-like instrument: taking on leverage accelerates time-to-market.",
        timestamp_seconds=20.0,
    )
    mod_svc.record_transcript(
        session_id=session.id,
        participant_id=participant_b.id,
        speaker_name="Taylor B",
        message="I respectfully disagree with Alex; unmanaged technical debt increases interest payments until engineering halts completely.",
        timestamp_seconds=50.0,
    )
    mod_svc.record_transcript(
        session_id=session.id,
        participant_id=participant_a.id,
        speaker_name="Alex A",
        message="That's a valid caution, Taylor. To mitigate that, Martin Fowler suggests paying down interest in 20% dedicated refactoring sprints.",
        timestamp_seconds=80.0,
    )

    eval_service = GDEvaluatorService(db_session)

    # 1. Evaluate Participant A
    eval_a = eval_service.evaluate_participant(
        session_id=session.id,
        participant_id=participant_a.id,
    )
    assert eval_a.overall_score >= 1.0 and eval_a.overall_score <= 5.0
    assert "communication_clarity" in eval_a.category_scores
    assert "listening_and_response" in eval_a.category_scores
    assert len(eval_a.strengths) > 0
    assert eval_a.example_strong_response is not None

    # 2. Evaluate Participant B
    eval_b = eval_service.evaluate_participant(
        session_id=session.id,
        participant_id=participant_b.id,
    )
    assert eval_b.overall_score >= 1.0 and eval_b.overall_score <= 5.0
    # Confirm individualization: distinct records
    assert eval_b.participant_id != eval_a.participant_id

    # 3. Test API endpoint GET /api/v1/gd/sessions/{session_id}/evaluations/me
    res = client.get(
        f"/api/v1/gd/sessions/{session.id}/evaluations/me",
        headers={"Authorization": auth_headers["Authorization"]},
    )
    assert res.status_code == 200
    report = res.json()["data"]
    assert report["participant_id"] == str(participant_a.id)
    assert report["overall_score"] == eval_a.overall_score


def test_silent_participant_evaluation(db_session):
    user = User(email="silent_user@prepx.ai", password_hash="fakehash", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    gd_service = GDService(db_session)
    session = gd_service.create_session(
        creator_id=user.id,
        data=GDSessionCreate(
            topic="Should artificial intelligence be regulated globally?",
            topic_category="Technology & AI",
            duration_minutes=10,
            max_participants=4,
        ),
        host_name="Silent Sam",
    )
    participant = session.participants[0]

    # No transcripts added for this participant (completely silent)
    eval_service = GDEvaluatorService(db_session)
    eval_report = eval_service.evaluate_participant(
        session_id=session.id,
        participant_id=participant.id,
    )

    # Must be 1.0, strengths must be empty, and plan must state no speech
    assert eval_report.overall_score == 1.0
    assert len(eval_report.strengths) == 0
    assert eval_report.personalized_plan["speaking_turns"] == 0
    assert eval_report.personalized_plan["participation_status"] == "No recorded verbal contribution"
    assert "No recorded verbal contribution" in eval_report.communication_feedback


def test_minimal_participant_evaluation(db_session):
    user = User(email="minimal_user@prepx.ai", password_hash="fakehash", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    gd_service = GDService(db_session)
    session = gd_service.create_session(
        creator_id=user.id,
        data=GDSessionCreate(
            topic="Remote work vs in-office collaboration",
            topic_category="Management",
            duration_minutes=10,
            max_participants=4,
        ),
        host_name="Minimal Mary",
    )
    participant = session.participants[0]

    # Exactly 1 short utterance
    mod_svc = GDModeratorService(db_session)
    mod_svc.record_transcript(
        session_id=session.id,
        participant_id=participant.id,
        speaker_name="Minimal Mary",
        message="I prefer remote work.",
        timestamp_seconds=15.0,
    )

    eval_service = GDEvaluatorService(db_session)
    eval_report = eval_service.evaluate_participant(
        session_id=session.id,
        participant_id=participant.id,
    )

    assert eval_report.overall_score == 2.0
    assert eval_report.personalized_plan["speaking_turns"] == 1
    assert len(eval_report.strengths) == 1
    assert "I prefer remote work." in eval_report.strengths[0]
