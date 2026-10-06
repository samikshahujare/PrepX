from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class BaseLLMProvider(ABC):
    """Abstract Base Class for AI Large Language Model providers."""

    @abstractmethod
    def generate_questions(
        self,
        domain: str,
        difficulty: str,
        company: Optional[str] = None,
        resume_context: Optional[str] = None,
        count: int = 5,
    ) -> List[Dict[str, Any]]:
        """Generate structured interview questions."""
        pass

    @abstractmethod
    def generate_follow_up(
        self,
        question: str,
        candidate_response: str,
    ) -> Dict[str, Any]:
        """Generate an adaptive follow-up question based on candidate response."""
        pass

    @abstractmethod
    def evaluate_response(
        self,
        question: str,
        candidate_response: str,
        target_domain: str,
    ) -> Dict[str, Any]:
        """Evaluate response for correctness, clarity, depth, and grammar."""
        pass
