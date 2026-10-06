import json
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("prepx.llm_service")


class ProviderStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    COOLDOWN = "COOLDOWN"
    UNAVAILABLE = "UNAVAILABLE"


@dataclass
class LLMResponse:
    provider: str
    model: str
    content: str
    success: bool
    error_type: Optional[str] = None
    latency: float = 0.0
    usage: Optional[Dict[str, Any]] = None


class LLMProviderManager:
    """
    Central multi-provider LLM service with zero-cost failover:
    Priority 1: Google Gemini (Free tier)
    Priority 2: NVIDIA NIM (Free tier)
    Priority 3: Groq (Free tier)
    Priority 4: OpenRouter (Free tier)
    """

    def __init__(self):
        self.provider_states: Dict[str, Dict[str, Any]] = {
            "gemini": {"status": ProviderStatus.AVAILABLE, "cooldown_until": 0.0, "failure_count": 0},
            "nvidia": {"status": ProviderStatus.AVAILABLE, "cooldown_until": 0.0, "failure_count": 0},
            "groq": {"status": ProviderStatus.AVAILABLE, "cooldown_until": 0.0, "failure_count": 0},
            "openrouter": {"status": ProviderStatus.AVAILABLE, "cooldown_until": 0.0, "failure_count": 0},
        }
        self.cooldown_duration_secs = 60.0  # 60s cooldown on 429/quota limits
        self.request_timeout_secs = 12.0   # Fast failover on hangs

    def get_provider_health(self) -> Dict[str, str]:
        now = time.time()
        result = {}
        for p, info in self.provider_states.items():
            if info["status"] == ProviderStatus.COOLDOWN and now >= info["cooldown_until"]:
                info["status"] = ProviderStatus.AVAILABLE
            result[p] = info["status"].value
        return result

    def _is_provider_ready(self, provider: str) -> bool:
        now = time.time()
        info = self.provider_states.get(provider)
        if not info:
            return False

        # Reset cooldown if expired
        if info["status"] == ProviderStatus.COOLDOWN and now >= info["cooldown_until"]:
            info["status"] = ProviderStatus.AVAILABLE
            info["failure_count"] = 0

        # Check API key presence
        if provider == "gemini" and not settings.GEMINI_API_KEY:
            return False
        if provider == "nvidia" and not settings.NVIDIA_API_KEY:
            return False
        if provider == "groq" and not settings.GROQ_API_KEY:
            return False
        if provider == "openrouter" and not settings.OPENROUTER_API_KEY:
            return False

        return info["status"] == ProviderStatus.AVAILABLE

    def _mark_failure(self, provider: str, error_type: str, is_quota_or_rate: bool = False, is_auth: bool = False):
        info = self.provider_states.get(provider)
        if not info:
            return

        now = time.time()
        if is_auth:
            info["status"] = ProviderStatus.UNAVAILABLE
            logger.warning(f"[LLM Failover] Provider '{provider}' marked UNAVAILABLE due to invalid/rejected credentials.")
        elif is_quota_or_rate:
            info["status"] = ProviderStatus.COOLDOWN
            info["cooldown_until"] = now + self.cooldown_duration_secs
            logger.warning(f"[LLM Failover] Provider '{provider}' marked COOLDOWN for {self.cooldown_duration_secs}s due to quota/rate limit: {error_type}")
        else:
            info["failure_count"] += 1
            if info["failure_count"] >= 2:
                info["status"] = ProviderStatus.COOLDOWN
                info["cooldown_until"] = now + self.cooldown_duration_secs
                logger.warning(f"[LLM Failover] Provider '{provider}' entered COOLDOWN after repeated failures: {error_type}")

    def _mark_success(self, provider: str):
        info = self.provider_states.get(provider)
        if info:
            info["status"] = ProviderStatus.AVAILABLE
            info["failure_count"] = 0
            info["cooldown_until"] = 0.0

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        json_mode: bool = False,
        temperature: float = 0.7,
        max_tokens: int = 1500,
    ) -> LLMResponse:
        """
        Execute request with automatic 4-provider failover:
        Gemini -> NVIDIA NIM -> Groq -> OpenRouter
        """
        providers = ["gemini", "nvidia", "groq", "openrouter"]

        for provider in providers:
            if not self._is_provider_ready(provider):
                continue

            start_t = time.time()
            try:
                logger.info(f"[LLMService] Attempting generation with primary/fallback provider: {provider}")
                if provider == "gemini":
                    res = self._call_gemini(prompt, system_prompt, json_mode, temperature, max_tokens)
                elif provider == "nvidia":
                    res = self._call_nvidia(prompt, system_prompt, json_mode, temperature, max_tokens)
                elif provider == "groq":
                    res = self._call_groq(prompt, system_prompt, json_mode, temperature, max_tokens)
                elif provider == "openrouter":
                    res = self._call_openrouter(prompt, system_prompt, json_mode, temperature, max_tokens)
                else:
                    continue

                if res.success:
                    res.latency = round(time.time() - start_t, 3)
                    self._mark_success(provider)
                    logger.info(f"[LLMService] Successfully generated via {provider} in {res.latency}s")
                    return res
                else:
                    self._handle_call_error(provider, res.error_type or "unknown_error")
            except Exception as e:
                err_msg = str(e)
                logger.warning(f"[LLMService] Provider {provider} threw exception: {err_msg}")
                self._handle_call_error(provider, err_msg)

        logger.error("[LLMService] All configured free LLM providers failed or exhausted quota.")
        return LLMResponse(
            provider="none",
            model="none",
            content="",
            success=False,
            error_type="all_providers_unavailable",
            latency=0.0,
        )

    def _handle_call_error(self, provider: str, error_msg: str):
        lower = error_msg.lower()
        is_quota = "429" in lower or "quota" in lower or "rate" in lower or "resource_exhausted" in lower or "too many requests" in lower
        is_auth = "401" in lower or "403" in lower or "unauthorized" in lower or "invalid api key" in lower or "api_key_invalid" in lower
        self._mark_failure(provider, error_msg, is_quota_or_rate=is_quota, is_auth=is_auth)

    def _call_gemini(
        self, prompt: str, system_prompt: Optional[str], json_mode: bool, temperature: float, max_tokens: int
    ) -> LLMResponse:
        model_name = settings.GEMINI_MODEL or "gemini-2.5-flash"
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            return LLMResponse(provider="gemini", model=model_name, content="", success=False, error_type="missing_api_key")

        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)

            generation_config = {
                "temperature": temperature,
                "max_output_tokens": max_tokens,
            }
            if json_mode:
                generation_config["response_mime_type"] = "application/json"

            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=system_prompt if system_prompt else None,
                generation_config=generation_config,
            )

            res = model.generate_content(prompt)
            if res and res.text:
                return LLMResponse(
                    provider="gemini",
                    model=model_name,
                    content=res.text.strip(),
                    success=True,
                )
            return LLMResponse(provider="gemini", model=model_name, content="", success=False, error_type="empty_response")
        except Exception as e:
            return LLMResponse(provider="gemini", model=model_name, content="", success=False, error_type=str(e))

    def _call_nvidia(
        self, prompt: str, system_prompt: Optional[str], json_mode: bool, temperature: float, max_tokens: int
    ) -> LLMResponse:
        model_name = settings.NVIDIA_MODEL or "meta/llama-3.2-11b-vision-instruct"
        api_key = settings.NVIDIA_API_KEY
        if not api_key:
            return LLMResponse(provider="nvidia", model=model_name, content="", success=False, error_type="missing_api_key")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload: Dict[str, Any] = {
            "model": model_name,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        with httpx.Client(timeout=self.request_timeout_secs) as client:
            resp = client.post(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                json=payload,
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                choices = data.get("choices", [])
                if choices and "message" in choices[0]:
                    msg = choices[0]["message"]
                    content = (msg.get("content") or msg.get("reasoning") or "").strip()
                    if content:
                        return LLMResponse(
                            provider="nvidia",
                            model=model_name,
                            content=content,
                            success=True,
                            usage=data.get("usage"),
                        )
                return LLMResponse(
                    provider="nvidia",
                    model=model_name,
                    content="",
                    success=False,
                    error_type="empty_content",
                )
            return LLMResponse(
                provider="nvidia",
                model=model_name,
                content="",
                success=False,
                error_type=f"HTTP {resp.status_code}: {resp.text[:200]}",
            )

    def _call_groq(
        self, prompt: str, system_prompt: Optional[str], json_mode: bool, temperature: float, max_tokens: int
    ) -> LLMResponse:
        model_name = settings.GROQ_MODEL or "qwen/qwen3.8-27b"
        api_key = settings.GROQ_API_KEY
        if not api_key:
            return LLMResponse(provider="groq", model=model_name, content="", success=False, error_type="missing_api_key")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload: Dict[str, Any] = {
            "model": model_name,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        with httpx.Client(timeout=self.request_timeout_secs) as client:
            resp = client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                json=payload,
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                choices = data.get("choices", [])
                if choices and "message" in choices[0]:
                    msg = choices[0]["message"]
                    content = (msg.get("content") or msg.get("reasoning") or "").strip()
                    if content:
                        return LLMResponse(
                            provider="groq",
                            model=model_name,
                            content=content,
                            success=True,
                            usage=data.get("usage"),
                        )
                return LLMResponse(
                    provider="groq",
                    model=model_name,
                    content="",
                    success=False,
                    error_type="empty_content",
                )
            return LLMResponse(
                provider="groq",
                model=model_name,
                content="",
                success=False,
                error_type=f"HTTP {resp.status_code}: {resp.text[:200]}",
            )

    def _call_openrouter(
        self, prompt: str, system_prompt: Optional[str], json_mode: bool, temperature: float, max_tokens: int
    ) -> LLMResponse:
        model_name = settings.OPENROUTER_MODEL or "openrouter/free"
        api_key = settings.OPENROUTER_API_KEY
        if not api_key:
            return LLMResponse(provider="openrouter", model=model_name, content="", success=False, error_type="missing_api_key")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload: Dict[str, Any] = {
            "model": model_name,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://prepx.ai",
            "X-Title": "PrepX Interview System",
        }

        with httpx.Client(timeout=self.request_timeout_secs) as client:
            resp = client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                json=payload,
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                choices = data.get("choices", [])
                if choices and "message" in choices[0]:
                    msg = choices[0]["message"]
                    content = (msg.get("content") or msg.get("reasoning") or "").strip()
                    if content:
                        return LLMResponse(
                            provider="openrouter",
                            model=model_name,
                            content=content,
                            success=True,
                            usage=data.get("usage"),
                        )
                return LLMResponse(
                    provider="openrouter",
                    model=model_name,
                    content="",
                    success=False,
                    error_type="empty_content",
                )
            return LLMResponse(
                provider="openrouter",
                model=model_name,
                content="",
                success=False,
                error_type=f"HTTP {resp.status_code}: {resp.text[:200]}",
            )


llm_service = LLMProviderManager()
