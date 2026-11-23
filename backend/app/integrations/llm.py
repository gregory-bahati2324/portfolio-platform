"""Provider-neutral LLM interface. Add another provider by implementing `generate`."""
from dataclasses import dataclass
from typing import Protocol


class LLMError(Exception):
    """kind: timeout | rate_limited | blocked | unavailable | invalid. Messages never contain secrets."""

    def __init__(self, kind: str, message: str = ""):
        super().__init__(message or kind)
        self.kind = kind


@dataclass
class Turn:
    role: str  # "user" | "assistant"
    text: str


class LLMProvider(Protocol):
    def generate(self, system: str, turns: list[Turn], *, model: str, max_tokens: int, temperature: float, timeout: float) -> str: ...
