
import threading
import time

from app.core.config import get_settings
from app.services.chatbot import effective, get_config_row, get_provider


CACHE_SECONDS = 300
_lock = threading.Lock()

_cached_result: dict | None = None
_cached_at = 0.0


def check_gemini(db) -> dict:
    global _cached_result, _cached_at

    settings = get_settings()
    row = get_config_row(db)
    cfg = effective(row)

    if not cfg.enabled:
        return {"status": "disabled"}

    if not settings.gemini_api_key:
        return {"status": "unconfigured"}

    now = time.monotonic()

    with _lock:
        if (
            _cached_result is not None
            and now - _cached_at < CACHE_SECONDS
            and _cached_result.get("model") == cfg.model
        ):
            return _cached_result

        provider = get_provider()
        status = provider.check_model(cfg.model, timeout=5.0)

        _cached_result = {
            "status": status,
            "model": cfg.model,
        }
        _cached_at = now

        return _cached_result
