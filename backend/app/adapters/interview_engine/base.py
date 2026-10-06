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


class BaseInterviewEngine(ABC):
    """Abstract interface for AI Mock Interview engines."""

    @abstractmethod
    def generate_initial_greeting(
        self, session: InterviewSession, first_question: Question
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
    ) -> InterviewEngineResponse:
        """Process candidate's spoken/text response and generate the interviewer's next statement or question."""
        pass
