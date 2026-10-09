import json
from collections import Counter

import pytest

from urdubench.generation.generators import (
    FileGenerator,
    LLMGenerator,
    Spec,
    materialize,
    parse_json_array,
)
from urdubench.generation.pipeline import run_pipeline
from urdubench.models.base import Completion
from urdubench.validate import validate_items

try:
    import langgraph  # noqa: F401

    HAVE_LANGGRAPH = True
except ImportError:  # pragma: no cover
    HAVE_LANGGRAPH = False


def t3_raw(i, category="geography"):
    return {
        "category": category,
        "question": f"فرضی سوال نمبر {i} جس میں شہر کا نام پوچھا گیا ہے؟",
        "correct": f"درست جواب {i}",
        "distractors": [f"غلط الف {i}", f"غلط ب {i}", f"غلط ج {i}"],
        "difficulty": "easy",
    }


def t4_raw(i):
    return {
        "category": "science",
        "ur": {"question": f"اردو سوال {i} کون سی گیس ہے؟", "correct": "آکسیجن",
               "distractors": ["نائٹروجن", "ہیلیم", "ہائیڈروجن"]},
        "en": {"question": f"English question {i}: which gas is it?", "correct": "Oxygen",
               "distractors": ["Nitrogen", "Helium", "Hydrogen"]},
    }


def test_materialize_t3_balanced_valid_and_correct_answer_kept():
    raws = [t3_raw(i) for i in range(40)]
    items = materialize("T3", raws, 101, seed=1)
    assert [i["id"] for i in items][:2] == ["t3-101", "t3-102"]
    assert validate_items(items)[0] == []
    assert set(Counter(i["answer"] for i in items).values()) == {10}  # exactly balanced
    for raw, item in zip(raws, items, strict=True):
        assert item["choices"]["ABCD".index(item["answer"])] == raw["correct"]
        assert sorted(item["choices"]) == sorted([raw["correct"], *raw["distractors"]])
    assert all(i["validated"] is False for i in items)


def test_materialize_t4_pairs_share_slot_and_order():
    items = materialize("T4", [t4_raw(i) for i in range(8)], 101)
    assert validate_items(items)[0] == []
    ur, en = items[0], items[1]
    assert (ur["id"], en["id"]) == ("t4-101-ur", "t4-101-en") and ur["answer"] == en["answer"]
    assert ur["choices"].index("آکسیجن") == en["choices"].index("Oxygen")


def test_materialize_t1_t2():
    t1 = materialize("T1", [{"category": "c", "passage": "پاکستان کا شہر لاہور ہے۔" * 3,
                             "question": "شہر کون سا ہے؟", "answers": ["لاہور"]}], 101)
    t2 = materialize("T2", [{"category": "plain", "text": "Yeh bohat acha hai", "label": "positive"}], 101)
    assert validate_items(t1 + t2)[0] == []
    with pytest.raises(ValueError):
        materialize("T9", [{}], 1)


def test_parse_json_array_variants():
    assert parse_json_array('[{"a": 1}]') == [{"a": 1}]
    assert parse_json_array('```json\n[{"a": 1}, 5]\n```') == [{"a": 1}]
    assert parse_json_array("no json here") == []
    assert parse_json_array("[{broken") == []


def test_file_generator_serves_each_draft_once_by_category(tmp_path):
    path = tmp_path / "d.jsonl"
    rows = [t3_raw(i, "history") for i in range(3)] + [t3_raw(9, "food")]
    path.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows), "utf-8")
    g = FileGenerator(path)
    assert len(g.generate(Spec("T3", "history", 2))) == 2
    assert len(g.generate(Spec("T3", "history", 5))) == 1
    assert g.generate(Spec("T3", "history", 5)) == []
    assert len(g.generate(Spec("T3", "food", 5))) == 1


class ScriptedClient:
    name = "scripted"

    def __init__(self, replies):
        self.replies, self.prompts = list(replies), []

    def complete(self, messages, *, max_tokens, temperature):
        self.prompts.append(messages[-1]["content"])
        return Completion(text=self.replies.pop(0))


def test_llm_generator_prompt_and_parse():
    client = ScriptedClient([json.dumps([t3_raw(1)], ensure_ascii=False)])
    g = LLMGenerator(client)
    out = g.generate(Spec("T3", "history", 1, avoid=["پرانا سوال"], feedback=["duplicate"]))
    assert len(out) == 1
    p = client.prompts[0]
    assert "task T3" in p and "history" in p and "پرانا سوال" in p and "duplicate" in p
    assert LLMGenerator(ScriptedClient(["garbage"])).generate(Spec("T3", "x", 1)) == []


@pytest.mark.parametrize("use_graph", [False, pytest.param(True, marks=pytest.mark.skipif(
    not HAVE_LANGGRAPH, reason="langgraph not installed"))])
def test_pipeline_filters_and_retries_until_target(use_graph, tmp_path):
    good1 = [t3_raw(i) for i in range(3)]
    bad = {**t3_raw(50), "question": "پاكستان كا شہر؟ بتائیں اب"}  # Arabic variants -> rejected
    dup = good1[0]  # exact duplicate of an accepted draft -> rejected
    good2 = [t3_raw(i) for i in range(10, 12)]
    path = tmp_path / "d.jsonl"
    # round 1 serves 3 (need 4): 2 good + bad ; round 2 serves rest
    rows = [good1[0], good1[1], bad, dup, good2[0], good2[1]]
    path.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows), "utf-8")
    res = run_pipeline(FileGenerator(path), {("T3", "geography"): 4}, {"T3": 101}, max_rounds=3,
                       use_langgraph=use_graph)
    assert len(res.accepted) == 4 and res.shortfalls == {}
    assert {f.code for f in res.findings if f.severity == "error"} >= {"arabic_variant", "duplicate"}
    assert len({i["id"] for i in res.accepted}) == 4
    assert validate_items(res.accepted)[0] == []


def test_pipeline_reports_shortfall_when_generator_runs_dry(tmp_path):
    path = tmp_path / "d.jsonl"
    path.write_text(json.dumps(t3_raw(1), ensure_ascii=False), "utf-8")
    res = run_pipeline(FileGenerator(path), {("T3", "geography"): 3}, {"T3": 101})
    assert len(res.accepted) == 1 and res.shortfalls == {"T3/geography": 2}


def test_pipeline_t4_counts_pairs_and_checks_reference(tmp_path):
    path = tmp_path / "d.jsonl"
    path.write_text("\n".join(json.dumps(t4_raw(i), ensure_ascii=False) for i in range(3)), "utf-8")
    ref = materialize("T4", [t4_raw(0)], 1)  # same text as draft 0 -> duplicate
    res = run_pipeline(FileGenerator(path), {("T4", "science"): 2}, {"T4": 101}, reference=ref)
    assert len(res.accepted) == 4 and res.shortfalls == {}  # 2 pairs = 4 items
    assert len(res.rejected) == 2
