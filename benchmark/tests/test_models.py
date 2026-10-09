import pytest

from urdubench.cache import ResponseCache, cache_key
from urdubench.models import get_client
from urdubench.models.base import Completion, complete_with_retries
from urdubench.models.mock import MockClient

MSG = [{"role": "user", "content": "hello"}]


class Flaky:
    name = "flaky"

    def __init__(self, fail_times):
        self.fail_times, self.calls = fail_times, 0

    def complete(self, messages, *, max_tokens, temperature):
        self.calls += 1
        if self.calls <= self.fail_times:
            raise TimeoutError("boom")
        return Completion(text="ok", input_tokens=3, output_tokens=1)


def test_retry_then_success_with_backoff():
    sleeps = []
    c = Flaky(2)
    comp = complete_with_retries(
        c, MSG, max_tokens=5, attempts=3, base_delay=1.0, sleep=sleeps.append
    )
    assert comp.text == "ok" and comp.error is None and c.calls == 3
    assert sleeps == [1.0, 2.0]
    assert comp.latency_s >= 0


def test_all_attempts_fail_returns_error_not_exception():
    sleeps = []
    comp = complete_with_retries(Flaky(99), MSG, max_tokens=5, attempts=3, sleep=sleeps.append)
    assert comp.error and "TimeoutError" in comp.error and comp.text == ""
    assert len(sleeps) == 2  # no sleep after the final attempt


def test_mock_models():
    prompt = [{"role": "user", "content": "Q\nA. x\nB. y\nC. z\nD. w\n\nAnswer:"}]
    assert MockClient("mock/first-choice").complete(prompt, max_tokens=5, temperature=0).text == "A"
    r1 = MockClient("mock/random").complete(prompt, max_tokens=5, temperature=0).text
    r2 = MockClient("mock/random").complete(prompt, max_tokens=5, temperature=0).text
    assert r1 == r2 and r1 in "ABCD"
    with pytest.raises(ValueError):
        MockClient("mock/nope")


def test_get_client_routes_mock():
    assert get_client("mock/random").name == "mock/random"


def test_cache_key_stable_and_sensitive():
    k = cache_key("m", MSG, 8, 0.0)
    assert k == cache_key("m", MSG, 8, 0.0)
    assert k != cache_key("m", MSG, 9, 0.0)
    assert k != cache_key("m2", MSG, 8, 0.0)
    assert k != cache_key("m", [{"role": "user", "content": "hello!"}], 8, 0.0)


def test_cache_persists_and_skips_errors(tmp_path):
    path = tmp_path / "c" / "r.jsonl"
    cache = ResponseCache(path)
    cache.put("k1", Completion(text="ا", input_tokens=1, output_tokens=1, cost_usd=0.1))
    cache.put("k2", Completion(error="fail"))
    again = ResponseCache(path)
    hit = again.get("k1")
    assert hit.text == "ا" and hit.cached is True and hit.cost_usd == 0.1
    assert again.get("k2") is None and again.get("missing") is None
