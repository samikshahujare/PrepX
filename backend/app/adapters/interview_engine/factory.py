from typing import Optional
from app.adapters.interview_engine.base import BaseInterviewEngine
from app.adapters.interview_engine.llm_engine import MultiLLMInterviewEngine
from app.adapters.interview_engine.mock_engine import MockInterviewEngine
from app.core.config import settings


def get_interview_engine(provider: Optional[str] = None) -> BaseInterviewEngine:
    """Factory function returning the configured interview engine."""
    prov = (provider or settings.LLM_PROVIDER or "gemini").lower()
    if prov == "mock":
        return MockInterviewEngine()
    # Default to centralized MultiLLMInterviewEngine with free failover
    return MultiLLMInterviewEngine()
