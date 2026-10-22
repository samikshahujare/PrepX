from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from app.models.interview import InterviewSession, Question


@dataclass
class InterviewEngineResponse:
    interviewer_message: str
    is_followup: bool
    is_completed: bool
    followup_question_text: Optional[str] = None
    state: str = "SPEAKING"
    emotion: str = "NEUTRAL"
    gesture: str = "RESTING_DESK"
    mouth: str = "SPEAKING"
    answer_quality: Optional[Dict[str, Any]] = None
    question_action: str = "next_topic"  # "repeat" | "clarify" | "follow_up" | "next_topic"
    intent: str = "answer"  # "answer" | "repeat_request" | "clarification_request" | "unable_to_answer"
    answer_sufficiency: str = "sufficient"  # "empty" | "unclear" | "insufficient" | "partial" | "sufficient"


class BaseInterviewEngine(ABC):
    """Abstract interface for AI Mock Interview engines."""

    @abstractmethod
    def generate_initial_greeting(
        self, session: InterviewSession, first_question: Question, **kwargs: Any
    ) -> str:
        """Generate the opening interviewer greeting and the first question."""
        pass

    @abstractmethod
    def process_candidate_response(
        self,
        session: InterviewSession,
        current_question: Optional[Question],
        candidate_response: str,
        conversation_history: List[Dict[str, Any]],
        next_question: Optional[Question],
        **kwargs: Any,
    ) -> InterviewEngineResponse:
        """Process candidate's spoken/text response and generate the interviewer's next statement or question."""
        pass

