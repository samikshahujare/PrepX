from typing import Any, Dict, List, Optional
from app.adapters.ai.base import BaseLLMProvider


class OpenAIProvider(BaseLLMProvider):
    """OpenAI GPT Provider Implementation."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    def generate_questions(
        self,
        domain: str,
        difficulty: str,
        company: Optional[str] = None,
        resume_context: Optional[str] = None,
        count: int = 5,
    ) -> List[Dict[str, Any]]:
        # Ready for Phase 2 implementation
        raise NotImplementedError("AI Question Generation is enabled in Phase 2")

    def generate_follow_up(
        self,
        question: str,
        candidate_response: str,
    ) -> Dict[str, Any]:
        # Ready for Phase 3 implementation
        raise NotImplementedError("Dynamic follow-up generation is enabled in Phase 3")

    def evaluate_response(
        self,
        question: str,
        candidate_response: str,
        target_domain: str,
    ) -> Dict[str, Any]:
        # Ready for Phase 4 implementation
        raise NotImplementedError("Response evaluation is enabled in Phase 4")
