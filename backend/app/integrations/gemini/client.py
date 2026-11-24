
import logging
import re
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote

import httpx

from app.integrations.llm import LLMError, Turn

log = logging.getLogger("app.gemini")
BASE = "https://generativelanguage.googleapis.com/v1beta"
MODEL_RE = re.compile(r"^[A-Za-z0-9._-]{1,80}$")

MAX_ATTEMPTS = 3
INITIAL_RETRY_DELAY = 1.0
MAX_RETRY_AFTER = 10.0

RETRYABLE_STATUSES = {408, 429, 500, 502, 503, 504}


def _retry_delay(response: httpx.Response | None, attempt: int) -> float:
    """Return a bounded Retry-After delay or exponential fallback."""
    if response is not None:
        value = response.headers.get("Retry-After", "").strip()

        if value:
            try:
                return min(MAX_RETRY_AFTER, max(0.0, float(value)))
            except ValueError:
                try:
                    retry_at = parsedate_to_datetime(value)
                    if retry_at.tzinfo is None:
                        retry_at = retry_at.replace(tzinfo=timezone.utc)
                    seconds = (retry_at - datetime.now(timezone.utc)).total_seconds()
                    return min(MAX_RETRY_AFTER, max(0.0, seconds))
                except (TypeError, ValueError, OverflowError):
                    pass

    return INITIAL_RETRY_DELAY * (2 ** attempt)


class GeminiProvider:
    """Google AI Studio (Gemini) over REST.

    The API key is sent in a header, never in the URL or logs.
    Temporary failures are retried with bounded exponential backoff.
    """

    def __init__(
        self,
        api_key: str,
        client: httpx.Client | None = None,
        base_url: str = BASE,
    ):
        self._key = api_key
        self._base = base_url.rstrip("/")
        self._client = client or httpx.Client()

    def generate(
        self,
        system: str,
        turns: list[Turn],
        *,
        model: str,
        max_tokens: int,
        temperature: float,
        timeout: float,
    ) -> str:
        if not MODEL_RE.match(model):
            raise LLMError("invalid", "Invalid model name")

        body = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [
                {
                    "role": "user" if t.role == "user" else "model",
                    "parts": [{"text": t.text}],
                }
                for t in turns
            ],
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "temperature": temperature,
            },
        }

        url = f"{self._base}/models/{quote(model, safe='')}:generateContent"
        headers = {
            "x-goog-api-key": self._key,
            "Content-Type": "application/json",
        }

        response = None

        for attempt in range(MAX_ATTEMPTS):
            try:
                response = self._client.post(
                    url,
                    json=body,
                    headers=headers,
                    timeout=timeout,
                )

            except httpx.TimeoutException:
                if attempt < MAX_ATTEMPTS - 1:
                    delay = _retry_delay(None, attempt)
                    log.warning(
                        "Gemini request timed out; retrying",
                        extra={"attempt": attempt + 1},
                    )
                    time.sleep(delay)
                    continue

                raise LLMError(
                    "timeout", "Model request timed out after retries"
                ) from None

            except httpx.HTTPError:
                if attempt < MAX_ATTEMPTS - 1:
                    delay = _retry_delay(None, attempt)
                    log.warning(
                        "Gemini network error; retrying",
                        extra={"attempt": attempt + 1},
                    )
                    time.sleep(delay)
                    continue

                raise LLMError(
                    "unavailable", "Could not reach the model service"
                ) from None

            if response.status_code in RETRYABLE_STATUSES:
                if attempt < MAX_ATTEMPTS - 1:
                    delay = _retry_delay(response, attempt)
                    log.warning(
                        "Gemini returned a temporary error; retrying",
                        extra={
                            "status": response.status_code,
                            "attempt": attempt + 1,
                        },
                    )
                    time.sleep(delay)
                    continue

                if response.status_code == 429:
                    raise LLMError("rate_limited", "Model quota exceeded")

                if response.status_code == 408:
                    raise LLMError("timeout", "Model request timed out")

                raise LLMError("unavailable", "Model service error")

            if response.status_code in (400, 404):
                log.error(
                    "Gemini rejected request",
                    extra={"status": response.status_code},
                )
                raise LLMError(
                    "invalid", "Model rejected the request (check GEMINI_MODEL)"
                )

            if response.status_code in (401, 403):
                log.error(
                    "Gemini authentication failed",
                    extra={"status": response.status_code},
                )
                raise LLMError("unavailable", "Model authentication failed")

            if response.status_code >= 500:
                raise LLMError("unavailable", "Model service error")

            break

        try:
            data = response.json()

            if data.get("promptFeedback", {}).get("blockReason"):
                raise LLMError(
                    "blocked",
                    "Message was blocked by the model's safety filter",
                )

            cand = data["candidates"][0]
            text = "".join(
                p.get("text", "")
                for p in cand.get("content", {}).get("parts", [])
            ).strip()

        except LLMError:
            raise
        except Exception:
            raise LLMError("invalid", "Unexpected model response") from None

        if not text:
            raise LLMError(
                "blocked"
                if cand.get("finishReason") in ("SAFETY", "RECITATION")
                else "invalid",
                "Empty model response",
            )

        return text
