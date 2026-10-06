from app.adapters.question_generator.base import BaseQuestionGenerator
from app.adapters.question_generator.mock_generator import MockQuestionGenerator
from app.adapters.question_generator.llm_generator import MultiLLMQuestionGenerator
from app.core.config import settings


def get_question_generator() -> BaseQuestionGenerator:
    """Factory creating question generator provider based on configured settings."""
    provider_name = (settings.LLM_PROVIDER or "gemini").lower().strip()
    if provider_name == "mock":
        return MockQuestionGenerator()
    # Default to centralized MultiLLMQuestionGenerator with free failover
    return MultiLLMQuestionGenerator()
