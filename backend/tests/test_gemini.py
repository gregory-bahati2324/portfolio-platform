
from unittest.mock import Mock, patch

import httpx
import pytest

from app.integrations.gemini.client import GeminiProvider
from app.integrations.llm import LLMError, Turn


def make_response(status_code, body=None, headers=None):
    return httpx.Response(
        status_code,
        json=body or {},
        headers=headers,
        request=httpx.Request("POST", "https://example.com"),
    )


def generate(provider, model="gemini-3.5-flash-lite"):
    return provider.generate(
        "You are a helpful assistant.",
        [Turn(role="user", text="Hello")],
        model=model,
        max_tokens=200,
        temperature=0.4,
        timeout=30,
    )


def test_success_on_first_attempt():
    client = Mock()
    client.post.return_value = make_response(
        200,
        {
            "candidates": [
                {
                    "content": {
                        "parts": [{"text": "Hello!"}]
                    }
                }
            ]
        },
    )

    provider = GeminiProvider("test-key", client=client)

    with patch("app.integrations.gemini.client.time.sleep") as sleep:
        result = generate(provider)

    assert result == "Hello!"
    assert client.post.call_count == 1
    sleep.assert_not_called()


def test_retries_temporary_503_then_succeeds():
    client = Mock()
    client.post.side_effect = [
        make_response(503),
        make_response(
            200,
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [{"text": "Recovered!"}]
                        }
                    }
                ]
            },
        ),
    ]

    provider = GeminiProvider("test-key", client=client)

    with patch("app.integrations.gemini.client.time.sleep") as sleep:
        result = generate(provider)

    assert result == "Recovered!"
    assert client.post.call_count == 2
    sleep.assert_called_once_with(1.0)


def test_retries_429_and_then_reports_rate_limit():
    client = Mock()
    client.post.side_effect = [
        make_response(429),
        make_response(429),
        make_response(429),
    ]

    provider = GeminiProvider("test-key", client=client)

    with patch("app.integrations.gemini.client.time.sleep") as sleep:
        with pytest.raises(LLMError) as exc:
            generate(provider)

    assert exc.value.kind == "rate_limited"
    assert client.post.call_count == 3
    assert [call.args[0] for call in sleep.call_args_list] == [1.0, 2.0]


def test_invalid_model_is_not_retried():
    client = Mock()
    provider = GeminiProvider("test-key", client=client)

    with patch("app.integrations.gemini.client.time.sleep") as sleep:
        with pytest.raises(LLMError) as exc:
            generate(provider, model="invalid model name!")

    assert exc.value.kind == "invalid"
    client.post.assert_not_called()
    sleep.assert_not_called()
