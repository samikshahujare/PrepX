import uuid
from datetime import datetime, timedelta, timezone
import pytest
from app.models.user import User
from app.models.interview import InterviewSession, InterviewTranscript, Question
from app.services.interview_service import InterviewService
from app.services.feedback_service import FeedbackService


def test_duration_budgets_15m_30m_60m_deadline_computation(db_session, test_user):
    """Verify 15, 30, and 60 minute duration budgets compute authoritative deadlines correctly."""
    user = db_session.query(User).filter_by(email=test_user["email"]).first()
    assert user is not None
    service = InterviewService(db_session)

    for duration in [15, 30, 60]:
        session = InterviewSession(
            id=uuid.uuid4(),
            user_id=user.id,
            domain="Full Stack Software Engineering",
            company="Google",
            difficulty="High",
            duration_minutes=duration,
            status="active",
            interview_status="active",
            started_at=datetime.now(timezone.utc),
            current_question_index=1,
        )
        db_session.add(session)
        db_session.commit()

        deadline, remaining = service._compute_deadline_and_remaining(session)
        assert deadline is not None
        assert remaining is not None
        expected_seconds = duration * 60
        assert abs(remaining - expected_seconds) < 5


def test_pause_and_resume_duration_accounting(db_session, test_user):
    """Verify pause and resume accumulates total_paused_seconds and preserves remaining duration."""
    user = db_session.query(User).filter_by(email=test_user["email"]).first()
    assert user is not None
    service = InterviewService(db_session)

    session = InterviewSession(
        id=uuid.uuid4(),
        user_id=user.id,
        domain="Backend Systems",
        company="Stripe",
        difficulty="High",
        duration_minutes=30,
        status="active",
        interview_status="active",
        started_at=datetime.now(timezone.utc) - timedelta(minutes=5),
        current_question_index=1,
    )
    db_session.add(session)
    db_session.commit()

    # Pause interview
    paused = service.pause_interview(session_id=session.id, user_id=user.id)
    assert paused.interview_status == "paused"
    assert paused.paused_at is not None

    # Simulate 2 minutes paused
    paused.paused_at = datetime.now(timezone.utc) - timedelta(seconds=120)
    db_session.commit()

    # Resume interview
    resumed = service.resume_interview(session_id=session.id, user_id=user.id)
    assert resumed.interview_status == "active"
    assert resumed.total_paused_seconds >= 120

    # Ensure deadline extended by paused duration
    deadline, remaining = service._compute_deadline_and_remaining(resumed)
    assert remaining is not None
    assert remaining > 0


def test_dynamic_question_generation_on_duration_budget(db_session, test_user):
    """Verify that when predefined questions are exhausted but time remains (>90s), dynamic questions generate."""
    user = db_session.query(User).filter_by(email=test_user["email"]).first()
    assert user is not None
    service = InterviewService(db_session)

    session = InterviewSession(
        id=uuid.uuid4(),
        user_id=user.id,
        domain="Machine Learning Systems",
        company="OpenAI",
        difficulty="High",
        duration_minutes=30,
        status="active",
        interview_status="active",
        started_at=datetime.now(timezone.utc) - timedelta(minutes=5),
        current_question_index=2,
        topic_coverage={"model_serving": False, "distributed_training": False},
    )
    db_session.add(session)
    db_session.commit()

    # Predefined question 1 and 2
    q1 = Question(id=uuid.uuid4(), session_id=session.id, question_text="Q1", sequence_number=1, category="Opening", difficulty="Medium", source="ai_generated")
    q2 = Question(id=uuid.uuid4(), session_id=session.id, question_text="Q2", sequence_number=2, category="Technical", difficulty="High", source="ai_generated")
    db_session.add_all([q1, q2])
    db_session.commit()

    # Submitting response to Q2 with 25 minutes left should generate Q3 dynamically instead of terminating prematurely
    result = service.process_candidate_response(
        session_id=session.id,
        user_id=user.id,
        candidate_response="I scaled training across 64 H100 GPUs using Megatron-LM tensor and pipeline parallelism with zero redundancy optimizer.",
    )

    assert result.is_completed is False
    assert result.current_question_index >= 2
    assert result.interviewer_message is not None
    assert len(result.interviewer_message) > 0


def test_comprehensive_feedback_generation_and_persistence(db_session, test_user):
    """Verify 9-section feedback report is generated, scored out of 5.0, and persisted on session."""
    user = db_session.query(User).filter_by(email=test_user["email"]).first()
    assert user is not None
    service = InterviewService(db_session)

    session = InterviewSession(
        id=uuid.uuid4(),
        user_id=user.id,
        domain="Cloud & Distributed Systems",
        company="Amazon Web Services",
        difficulty="High",
        duration_minutes=30,
        status="completed",
        interview_status="completed",
        started_at=datetime.now(timezone.utc) - timedelta(minutes=18),
        ended_at=datetime.now(timezone.utc),
        current_question_index=3,
    )
    db_session.add(session)
    db_session.commit()

    # Add transcripts
    t1 = InterviewTranscript(id=uuid.uuid4(), session_id=session.id, speaker="interviewer", message="Tell me about your distributed cache architecture.", sequence_number=1)
    t2 = InterviewTranscript(id=uuid.uuid4(), session_id=session.id, speaker="candidate", message="In my previous system at FinTech Corp, I designed a multi-region Redis cluster using consistent hashing and write-through caching to handle 45,000 requests per second with sub-5ms P99 latency.", sequence_number=2)
    t3 = InterviewTranscript(id=uuid.uuid4(), session_id=session.id, speaker="interviewer", message="How did you handle cache stampede and network partitions?", sequence_number=3)
    t4 = InterviewTranscript(id=uuid.uuid4(), session_id=session.id, speaker="candidate", message="We implemented probabilistic early expiration with mutex locks on key regeneration and graceful degradation to a read-replica fallback tier.", sequence_number=4)
    db_session.add_all([t1, t2, t3, t4])
    db_session.commit()

    report = service.get_feedback(session_id=session.id, user_id=user.id)
    assert report is not None
    assert "overall_score" in report
    assert 1.0 <= report["overall_score"] <= 5.0
    assert "category_scores" in report
    assert len(report["category_scores"]) == 8
    assert "strengths" in report
    assert len(report["strengths"]) > 0
    assert "weaknesses_and_mistakes" in report
    assert "skills_to_improve" in report
    assert "better_answer_guidance" in report
    assert "action_plan" in report
    assert "interview_summary" in report

    # Verify report is persisted on session
    db_session.refresh(session)
    assert session.feedback is not None
    assert session.feedback["overall_score"] == report["overall_score"]
