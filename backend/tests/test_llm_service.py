import pytest
from unittest.mock import patch
from app.services.llm_service import LLMProviderManager, LLMResponse, ProviderStatus


@pytest.fixture
def clean_llm_manager(monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-gemini-key")
    monkeypatch.setattr(settings, "NVIDIA_API_KEY", "test-nvidia-key")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-groq-key")
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "test-openrouter-key")
    
    manager = LLMProviderManager()
    return manager


def test_gemini_primary_success(clean_llm_manager):
    with patch.object(clean_llm_manager, "_call_gemini") as mock_gemini:
        mock_gemini.return_value = LLMResponse(
            provider="gemini",
            model="gemini-2.5-flash",
            content="Hello from Gemini",
            success=True,
        )
        res = clean_llm_manager.generate("Test prompt")
        assert res.success is True
        assert res.provider == "gemini"
        assert res.content == "Hello from Gemini"


def test_gemini_fails_nvidia_used(clean_llm_manager):
    with patch.object(clean_llm_manager, "_call_gemini") as mock_gemini, \
         patch.object(clean_llm_manager, "_call_nvidia") as mock_nvidia:
        
        # Gemini fails with 429 quota exhausted
        mock_gemini.return_value = LLMResponse(
            provider="gemini",
            model="gemini-2.5-flash",
            content="",
            success=False,
            error_type="429 Resource has been exhausted (quota exceeded)",
        )
        # NVIDIA succeeds
        mock_nvidia.return_value = LLMResponse(
            provider="nvidia",
            model="meta/llama-3.2-11b-vision-instruct",
            content="Hello from NVIDIA NIM",
            success=True,
        )

        res = clean_llm_manager.generate("Test prompt")
        assert res.success is True
        assert res.provider == "nvidia"
        assert res.content == "Hello from NVIDIA NIM"
        # Gemini should be in COOLDOWN
        assert clean_llm_manager.provider_states["gemini"]["status"] == ProviderStatus.COOLDOWN


def test_gemini_nvidia_fail_groq_used(clean_llm_manager):
    with patch.object(clean_llm_manager, "_call_gemini") as mock_gemini, \
         patch.object(clean_llm_manager, "_call_nvidia") as mock_nvidia, \
         patch.object(clean_llm_manager, "_call_groq") as mock_groq:
        
        mock_gemini.return_value = LLMResponse(provider="gemini", model="", content="", success=False, error_type="429 quota")
        mock_nvidia.return_value = LLMResponse(provider="nvidia", model="", content="", success=False, error_type="500 Internal error")
        mock_groq.return_value = LLMResponse(
            provider="groq",
            model="qwen/qwen3.8-27b",
            content="Hello from Groq",
            success=True,
        )

        res = clean_llm_manager.generate("Test prompt")
        assert res.success is True
        assert res.provider == "groq"
        assert res.content == "Hello from Groq"


def test_gemini_nvidia_groq_fail_openrouter_used(clean_llm_manager):
    with patch.object(clean_llm_manager, "_call_gemini") as mock_gemini, \
         patch.object(clean_llm_manager, "_call_nvidia") as mock_nvidia, \
         patch.object(clean_llm_manager, "_call_groq") as mock_groq, \
         patch.object(clean_llm_manager, "_call_openrouter") as mock_openrouter:
        
        mock_gemini.return_value = LLMResponse(provider="gemini", model="", content="", success=False, error_type="429 quota")
        mock_nvidia.return_value = LLMResponse(provider="nvidia", model="", content="", success=False, error_type="500 error")
        mock_groq.return_value = LLMResponse(provider="groq", model="", content="", success=False, error_type="429 rate limit")
        mock_openrouter.return_value = LLMResponse(
            provider="openrouter",
            model="openrouter/free",
            content="Hello from OpenRouter",
            success=True,
        )

        res = clean_llm_manager.generate("Test prompt")
        assert res.success is True
        assert res.provider == "openrouter"
        assert res.content == "Hello from OpenRouter"


def test_all_four_providers_fail_graceful_error(clean_llm_manager):
    with patch.object(clean_llm_manager, "_call_gemini") as mock_gemini, \
         patch.object(clean_llm_manager, "_call_nvidia") as mock_nvidia, \
         patch.object(clean_llm_manager, "_call_groq") as mock_groq, \
         patch.object(clean_llm_manager, "_call_openrouter") as mock_openrouter:
        
        mock_gemini.return_value = LLMResponse(provider="gemini", model="", content="", success=False, error_type="429 quota")
        mock_nvidia.return_value = LLMResponse(provider="nvidia", model="", content="", success=False, error_type="503 timeout")
        mock_groq.return_value = LLMResponse(provider="groq", model="", content="", success=False, error_type="429 rate limit")
        mock_openrouter.return_value = LLMResponse(provider="openrouter", model="", content="", success=False, error_type="500 server error")

        res = clean_llm_manager.generate("Test prompt")
        assert res.success is False
        assert res.provider == "none"
        assert res.error_type == "all_providers_unavailable"


def test_auth_failure_marks_unavailable(clean_llm_manager):
    with patch.object(clean_llm_manager, "_call_gemini") as mock_gemini:
        mock_gemini.return_value = LLMResponse(
            provider="gemini",
            model="gemini-2.0-flash",
            content="",
            success=False,
            error_type="401 Unauthorized: Invalid API key",
        )
        clean_llm_manager.generate("Test prompt")
        assert clean_llm_manager.provider_states["gemini"]["status"] == ProviderStatus.UNAVAILABLE
