"""
Test suite validating human-like AI interviewer behavior, candidate answer handling,
resume/JD context grounding, and single concise question enforcement.
"""

from types import SimpleNamespace
import pytest
from app.adapters.interview_engine.base import InterviewEngineResponse
from app.adapters.interview_engine.mock_engine import MockInterviewEngine
from app.adapters.question_generator.mock_generator import MockQuestionGenerator


def create_dummy_session(company="Goldman Sachs", target_role="Machine Learning Engineer", domain="Machine Learning"):
    return SimpleNamespace(
        id="test-session-id",
        company=company,
        target_role=target_role,
        domain=domain,
        interview_mode="Company-Specific",
        difficulty="Medium",
        duration_minutes=30,
        allowed_attempts=1,
        current_attempt=1,
    )


def create_dummy_question(text, category="Technical", seq=1):
    return SimpleNamespace(
        id=f"q-{seq}",
        question_text=text,
        category=category,
        sequence_number=seq,
        difficulty="Medium",
    )


def test_fixed_opening_question():
    """Requirement: The opening question must strictly be 'Tell me about yourself.'"""
    generator = MockQuestionGenerator()
    questions = generator.generate_questions(
        domain="Machine Learning",
        difficulty="Medium",
        count=5,
    )
    assert len(questions) == 5
    assert questions[0]["question_text"] == "Tell me about yourself."
    assert questions[0]["category"] == "Opening"
    assert questions[0]["sequence_number"] == 1


def test_one_concise_question_per_turn():
    """Requirement: Each interviewer question must be one concise question, not multi-question paragraphs."""
    generator = MockQuestionGenerator()
    questions = generator.generate_questions(
        domain="Full Stack",
        difficulty="Hard",
        candidate_skills=["React", "TypeScript", "Python"],
        candidate_projects=["E-Commerce Platform", "Real-Time Chat"],
        count=10,
    )
    for q in questions:
        text = q["question_text"]
        # Must not be multiple paragraphs
        assert "\n" not in text
        # Must have at most one question mark
        assert text.count("?") <= 1
        # Word count must be concise (< 35 words)
        words = text.split()
        assert len(words) < 35, f"Question too long ({len(words)} words): {text}"


def test_candidate_repeat_request_handling():
    """
    Requirement Example 1:
    Candidate says 'What could you please?' or 'Could you repeat that?'
    Sarah repeats the same question verbatim, does NOT advance or praise.
    """
    engine = MockInterviewEngine()
    session = create_dummy_session()
    current_q = create_dummy_question("Tell me about yourself.", category="Opening", seq=1)
    next_q = create_dummy_question("Tell me about a key production system you built using Python.", seq=2)

    for repeat_phrase in ["What could you please?", "Could you repeat that?", "Pardon me?"]:
        res = engine.process_candidate_response(
            session=session,
            current_question=current_q,
            candidate_response=repeat_phrase,
            conversation_history=[],
            next_question=next_q,
        )
        assert res.intent == "repeat_request"
        assert res.answer_sufficiency == "unclear"
        assert res.question_action == "repeat"
        assert "Tell me about yourself." in res.interviewer_message
        assert res.is_followup is False
        assert "praise" not in res.interviewer_message.lower()
        assert "excellent" not in res.interviewer_message.lower()


def test_candidate_empty_or_silence_handling():
    """
    Requirement Example 2:
    Candidate provides empty response or silence.
    Sarah gently repeats without advancing question.
    """
    engine = MockInterviewEngine()
    session = create_dummy_session()
    current_q = create_dummy_question("Tell me about yourself.", category="Opening", seq=1)
    next_q = create_dummy_question("Next question", seq=2)

    for empty_input in ["", "   "]:
        res = engine.process_candidate_response(
            session=session,
            current_question=current_q,
            candidate_response=empty_input,
            conversation_history=[],
            next_question=next_q,
        )
        assert res.intent == "empty_or_no_answer"
        assert res.answer_sufficiency == "empty"
        assert res.question_action == "repeat"
        assert "Tell me about yourself." in res.interviewer_message


def test_candidate_minimal_yes_answer_handling():
    """
    Requirement Example 3:
    Candidate says 'Yes.' to a technical question.
    Sarah recognizes this is insufficient, does NOT praise, and asks clarification on the same topic.
    """
    engine = MockInterviewEngine()
    session = create_dummy_session()
    current_q = create_dummy_question("How did you evaluate your machine-learning model?", seq=2)
    next_q = create_dummy_question("Next topic", seq=3)

    res = engine.process_candidate_response(
        session=session,
        current_question=current_q,
        candidate_response="Yes.",
        conversation_history=[],
        next_question=next_q,
    )
    assert res.intent == "answer"
    assert res.answer_sufficiency == "insufficient"
    assert res.question_action == "clarify"
    assert res.is_followup is True
    # Does not praise a one-word answer
    assert "excellent" not in res.interviewer_message.lower()
    assert "great job" not in res.interviewer_message.lower()


def test_candidate_partial_answer_handling():
    """
    Requirement Example 4:
    Candidate gives partial answer: 'I used SMOTE.'
    Sarah acknowledges the specific detail and asks one targeted follow-up.
    """
    engine = MockInterviewEngine()
    session = create_dummy_session()
    current_q = create_dummy_question("How did you handle class imbalance?", seq=3)
    next_q = create_dummy_question("Next topic", seq=4)

    res = engine.process_candidate_response(
        session=session,
        current_question=current_q,
        candidate_response="I used SMOTE.",
        conversation_history=[],
        next_question=next_q,
    )
    assert res.intent == "answer"
    assert res.answer_sufficiency == "partial"
    assert res.question_action == "follow_up"
    assert res.is_followup is True
    assert "smote" in res.interviewer_message.lower()


def test_candidate_does_not_know_handling():
    """
    Requirement Example 6:
    Candidate says: 'I haven't studied that concept yet.'
    Sarah acknowledges neutrally and moves to the next topic without repeating endlessly.
    """
    engine = MockInterviewEngine()
    session = create_dummy_session()
    current_q = create_dummy_question("How does the transformer attention mechanism work internally?", seq=4)
    next_q = create_dummy_question("How do you handle feature engineering in Python?", seq=5)

    res = engine.process_candidate_response(
        session=session,
        current_question=current_q,
        candidate_response="I haven't studied that concept yet.",
        conversation_history=[],
        next_question=next_q,
    )
    assert res.intent == "unable_to_answer"
    assert res.question_action == "next_topic"
    assert res.is_followup is False
    assert "No problem" in res.interviewer_message or "completely fine" in res.interviewer_message
    assert "How do you handle feature engineering" in res.interviewer_message


def test_candidate_substantive_answer_handling():
    """
    Requirement Example 5:
    Candidate gives substantive explanation.
    Sarah acknowledges and moves on to the next planned topic.
    """
    engine = MockInterviewEngine()
    session = create_dummy_session()
    current_q = create_dummy_question("Why did you choose XGBoost over random forests for this dataset?", seq=5)
    next_q = create_dummy_question("Tell me about your approach to hyperparameter optimization.", seq=6)

    detailed_answer = (
        "We chose XGBoost because the dataset had significant tabular non-linearities and "
        "gradient boosting provided better convergence on our log-loss metric. Furthermore, "
        "built-in handling of sparse matrices reduced our inference latency by 40%."
    )
    res = engine.process_candidate_response(
        session=session,
        current_question=current_q,
        candidate_response=detailed_answer,
        conversation_history=[],
        next_question=next_q,
    )
    assert res.intent == "answer"
    assert res.answer_sufficiency == "sufficient"
    assert res.question_action == "next_topic"
    assert res.is_followup is False
    assert res.answer_quality is not None
    assert res.answer_quality.get("score", 0) >= 7.0
    assert "hyperparameter optimization" in res.interviewer_message


def test_canonical_interview_response_contract():
    """Verifies all required canonical fields exist on InterviewEngineResponse."""
    resp = InterviewEngineResponse(
        interviewer_message="Could you clarify which metric was used?",
        is_followup=True,
        is_completed=False,
        followup_question_text="Which metric was used?",
        state="SPEAKING",
        emotion="NEUTRAL",
        gesture="RESTING_DESK",
        mouth="SPEAKING",
        answer_quality={"score": 6.5},
        question_action="clarify",
        intent="answer",
        answer_sufficiency="insufficient",
    )
    assert resp.question_action == "clarify"
    assert resp.intent == "answer"
    assert resp.answer_sufficiency == "insufficient"
