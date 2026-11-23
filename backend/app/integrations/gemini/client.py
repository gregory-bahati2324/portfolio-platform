import logging
import re
from urllib.parse import quote

import httpx

from app.integrations.llm import LLMError, Turn

log = logging.getLogger("app.gemini")
BASE = "https://generativelanguage.googleapis.com/v1beta"
MODEL_RE = re.compile(r"^[A-Za-z0-9._-]{1,80}$")


class GeminiProvider:
    """Google AI Studio (Gemini) over REST. The key is sent in a header, never in the URL,
    and never logged."""

    def __init__(self, api_key: str, client: httpx.Client | None = None, base_url: str = BASE):
        self._key = api_key
        self._base = base_url.rstrip("/")
        self._client = client or httpx.Client()

    def generate(self, system: str, turns: list[Turn], *, model: str, max_tokens: int, temperature: float, timeout: float) -> str:
        if not MODEL_RE.match(model):
            raise LLMError("invalid", "Invalid model name")
        body = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user" if t.role == "user" else "model", "parts": [{"text": t.text}]} for t in turns],
            "generationConfig": {"maxOutputTokens": max_tokens, "temperature": temperature},
        }
        try:
            r = self._client.post(
                f"{self._base}/models/{quote(model, safe='')}:generateContent",
                json=body, headers={"x-goog-api-key": self._key, "Content-Type": "application/json"}, timeout=timeout,
            )
        except httpx.TimeoutException:
            raise LLMError("timeout", "Model request timed out") from None
        except httpx.HTTPError:
            raise LLMError("unavailable", "Could not reach the model service") from None
        if r.status_code == 429:
            raise LLMError("rate_limited", "Model quota exceeded")
        if r.status_code in (400, 404):
            log.error("gemini rejected request", extra={"status": r.status_code})
            raise LLMError("invalid", "Model rejected the request (check GEMINI_MODEL)")
        if r.status_code in (401, 403):
            log.error("gemini authentication failed", extra={"status": r.status_code})
            raise LLMError("unavailable", "Model authentication failed")
        if r.status_code >= 500:
            raise LLMError("unavailable", "Model service error")
        try:
            data = r.json()
            if data.get("promptFeedback", {}).get("blockReason"):
                raise LLMError("blocked", "Message was blocked by the model's safety filter")
            cand = data["candidates"][0]
            text = "".join(p.get("text", "") for p in cand.get("content", {}).get("parts", [])).strip()
        except LLMError:
            raise
        except Exception:
            raise LLMError("invalid", "Unexpected model response") from None
        if not text:
            raise LLMError("blocked" if cand.get("finishReason") in ("SAFETY", "RECITATION") else "invalid", "Empty model response")
        return text
