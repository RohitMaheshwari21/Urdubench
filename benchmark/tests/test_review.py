import csv

import pytest

from urdubench.generation.generators import materialize
from urdubench.review import (
    Review,
    assign,
    decide,
    export_review_sheets,
    ingest_reviews,
    read_sheet,
    validation_report_markdown,
)


def t3_items(n=12):
    raws = [
        {"category": "history", "question": f"سوال نمبر {i} کا جواب کیا ہے؟",
         "correct": f"درست {i}", "distractors": [f"الف {i}", f"ب {i}", f"ج {i}"]}
        for i in range(n)
    ]
    return materialize("T3", raws, 101)


def t4_items(n=2):
    raws = [
        {"category": "science",
         "ur": {"question": f"اردو {i}؟", "correct": "ایک", "distractors": ["دو", "تین", "چار"]},
         "en": {"question": f"English {i}?", "correct": "one", "distractors": ["two", "three", "four"]}}
        for i in range(n)
    ]
    return materialize("T4", raws, 101)


def rv(reviewer, item_id, answer, verdict="ok", issue=""):
    return Review(reviewer, item_id, answer, verdict, issue)


def test_assign_gives_every_item_enough_reviewers_and_keeps_pairs_together():
    items = t3_items(20) + t4_items(5)
    out = assign(items, ["a", "b", "c"], per_item=2, sample_fraction=0.2, seed=1)
    holders = {}
    for reviewer, assigned in out.items():
        for it in assigned:
            holders.setdefault(it["id"], set()).add(reviewer)
    assert set(holders) == {i["id"] for i in items}
    assert all(len(h) >= 2 for h in holders.values())
    assert sum(1 for h in holders.values() if len(h) == 3) >= 4  # the all-reviewer sample
    for k in range(5):
        assert holders[f"t4-{101 + k}-ur"] == holders[f"t4-{101 + k}-en"]


def test_assign_needs_two_reviewers():
    with pytest.raises(ValueError):
        assign(t3_items(), ["only"])


def test_export_never_leaks_the_answer_to_reviewers(tmp_path):
    items = t3_items(10)
    paths = export_review_sheets(items, tmp_path, ["a", "b", "c"])
    key = paths["key"].read_text("utf-8-sig")
    assert all(i["id"] in key for i in items)
    for name in ("a", "b", "c"):
        text = paths[name].read_text("utf-8-sig")
        header = text.splitlines()[0]
        assert "answer" not in header.replace("reviewer_answer", "")
        with paths[name].open(encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))
        assert rows and all(r["reviewer_answer"] == "" for r in rows)


def fill(path, answer_for):
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["reviewer_answer"], r["verdict"] = answer_for(r["item_id"]), "ok"
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)


def test_end_to_end_sheets_to_decision_and_report(tmp_path):
    items = t3_items(12)
    key = {i["id"]: i["answer"] for i in items}
    paths = export_review_sheets(items, tmp_path, ["a", "b", "c"], sample_fraction=0.5)
    wrong = {"t3-103"}  # reviewer c gets this one wrong
    fill(paths["a"], key.get)
    fill(paths["b"], key.get)
    fill(paths["c"], lambda i: "A" if (i in wrong and key[i] != "A") else ("B" if i in wrong else key[i]))
    outcome = ingest_reviews(items, [paths["a"], paths["b"], paths["c"]])
    assert set(outcome.accepted) == set(key)  # one dissenter in 3 still passes (2/3)
    s = outcome.stats["T3"]
    assert s["reviewed"] == 12 and s["accepted"] == 12 and 0.9 < s["agreement_with_key"] <= 1.0
    assert "cohen_kappa_mean" in s and "fleiss_kappa" in s
    md = validation_report_markdown(outcome, "draft")
    assert "| T3 |" in md and "Fleiss" in md


def test_decision_rules():
    it = t3_items(1)[0]
    right, other = it["answer"], next(c for c in "ABCD" if c != it["answer"])
    assert decide([it], [rv("a", it["id"], right), rv("b", it["id"], right)]).accepted == [it["id"]]
    assert decide([it], [rv("a", it["id"], right), rv("b", it["id"], other)]).rejected  # 1/2
    three = [rv("a", it["id"], right), rv("b", it["id"], right), rv("c", it["id"], other)]
    assert decide([it], three).accepted == [it["id"]]
    two_wrong = [rv("a", it["id"], right), rv("b", it["id"], other), rv("c", it["id"], other)]
    assert "matched the key" in decide([it], two_wrong).rejected[it["id"]]
    rej = [rv("a", it["id"], right), rv("b", it["id"], right, "reject", "two-answers")]
    assert "two-answers" in decide([it], rej).rejected[it["id"]]
    assert "needs 2+" in decide([it], [rv("a", it["id"], right)]).rejected[it["id"]]
    assert "invalid verdict" in decide(
        [it], [rv("a", it["id"], right, "maybe"), rv("b", it["id"], right)]
    ).rejected[it["id"]]
    lower = [rv("a", it["id"], right.lower()), rv("b", it["id"], f" {right} ")]
    assert decide([it], lower).accepted == [it["id"]]  # case and spaces tolerated


def test_t4_pair_stands_or_falls_together():
    ur, en = t4_items(1)
    good = [rv("a", ur["id"], ur["answer"]), rv("b", ur["id"], ur["answer"])]
    bad = [rv("a", en["id"], "ABCD".replace(en["answer"], "")[0]), rv("b", en["id"], "ABCD".replace(en["answer"], "")[0])]
    out = decide([ur, en], good + bad)
    assert out.accepted == [] and set(out.rejected) == {ur["id"], en["id"]}
    assert "pair member failed" in out.rejected[ur["id"]]


def test_t1_free_text_matches_key_by_f1():
    item = {"id": "t1-101", "task": "T1", "language": "ur", "category": "c", "passage": "p" * 40,
            "question": "q" * 10, "answer": ["دریائے راوی"], "source": "s", "license": "l",
            "difficulty": "easy", "validated": False}
    ok = [rv("a", item["id"], "دریائے راوی"), rv("b", item["id"], "راوی دریائے")]
    assert decide([item], ok).accepted == [item["id"]]
    miss = [rv("a", item["id"], "چناب"), rv("b", item["id"], "جہلم")]
    assert decide([item], miss).rejected


def test_t2_labels_case_insensitive():
    item = {"id": "t2-101", "task": "T2", "language": "roman-ur", "category": "plain",
            "question": "acha hai", "label_set": ["positive", "negative", "neutral"],
            "answer": "positive", "source": "s", "license": "l", "difficulty": "easy", "validated": False}
    out = decide([item], [rv("a", item["id"], "Positive"), rv("b", item["id"], "positive")])
    assert out.accepted == [item["id"]]


def test_read_sheet_skips_unfilled_rows_and_unknown_ids_fail(tmp_path):
    items = t3_items(4)
    paths = export_review_sheets(items, tmp_path, ["a", "b"])
    assert read_sheet(paths["a"]) == []
    with paths["a"].open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    rows[0]["item_id"], rows[0]["reviewer_answer"], rows[0]["verdict"] = "t3-999", "A", "ok"
    with paths["a"].open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    with pytest.raises(ValueError, match="unknown item ids"):
        ingest_reviews(items, [paths["a"]])


def test_sheet_hides_t2_category_and_shuffles_rows(tmp_path):
    items = t3_items(40)
    t2 = [
        {"id": f"t2-{101 + i}", "task": "T2", "language": "roman-ur", "category": "sarcasm",
         "question": f"jumla number {i}", "label_set": ["positive", "negative", "neutral"],
         "answer": "negative", "source": "s", "license": "l", "difficulty": "hard", "validated": False}
        for i in range(30)
    ]
    paths = export_review_sheets(items + t2 + t4_items(6), tmp_path, ["a", "b", "c"])
    with paths["a"].open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    assert all(r["category"] == "" for r in rows if r["task"] == "T2")
    assert any(r["category"] for r in rows if r["task"] == "T3")  # other tasks keep context
    ids = [r["item_id"] for r in rows if r["task"] == "T3"]
    assert ids != sorted(ids)  # not in drafting order
    # T4 members stay adjacent with Urdu first
    t4 = [r for r in rows if r["task"] == "T4"]
    for i in range(0, len(t4), 2):
        assert t4[i]["language"] == "ur" and t4[i + 1]["language"] == "en"
        assert t4[i]["item_id"].split("-")[1] == t4[i + 1]["item_id"].split("-")[1]
    # same seed, same reviewer -> same order (reproducible exports)
    again = export_review_sheets(items + t2 + t4_items(6), tmp_path / "x", ["a", "b", "c"])
    assert again["a"].read_text("utf-8-sig") == paths["a"].read_text("utf-8-sig")


openpyxl = pytest.importorskip("openpyxl")


def _mixed_items():
    t2 = [
        {"id": f"t2-{101 + i}", "task": "T2", "language": "roman-ur", "category": "sarcasm",
         "question": f"jumla {i}", "label_set": ["positive", "negative", "neutral"], "answer": "negative",
         "source": "s", "license": "l", "difficulty": "hard", "validated": False}
        for i in range(6)
    ]
    t1 = [
        {"id": f"t1-{101 + i}", "task": "T1", "language": "ur", "category": "c", "passage": "لاہور پنجاب کا شہر ہے۔" * 2,
         "question": "لاہور کہاں ہے؟", "answer": ["پنجاب"], "source": "s", "license": "l",
         "difficulty": "easy", "validated": False}
        for i in range(6)
    ]
    return t3_items(8) + t2 + t1 + t4_items(4)


def test_xlsx_export_structure(tmp_path):
    paths = export_review_sheets(_mixed_items(), tmp_path, ["a", "b", "c"], fmt="xlsx")
    assert paths["a"].suffix == ".xlsx" and paths["key"].name == "answer_key.csv"
    wb = openpyxl.load_workbook(paths["a"])
    assert wb.sheetnames[0] == "Instructions"
    assert {"T1 Reading", "T2 Roman Urdu", "T3 Culture", "T4 Urdu-English"} >= set(wb.sheetnames[1:])
    ws = wb["T3 Culture"]
    header = [c.value for c in ws[1]]
    assert "answer" not in [h for h in header if h != "reviewer_answer"]  # no key column
    dv_formulas = {d.formula1 for d in ws.data_validations.dataValidation}
    assert '"A,B,C,D"' in dv_formulas and '"ok,reject"' in dv_formulas
    q = header.index("question") + 1
    assert ws.cell(row=2, column=q).alignment.readingOrder == 2  # Urdu cells are right-to-left
    t2 = wb["T2 Roman Urdu"]
    cat = [c.value for c in t2[1]].index("category") + 1
    assert all(t2.cell(row=r, column=cat).value in (None, "") for r in range(2, t2.max_row + 1))


def test_xlsx_round_trip_through_ingest(tmp_path):
    items = _mixed_items()
    key = {i["id"]: (i["answer"] if isinstance(i["answer"], str) else i["answer"][0]) for i in items}
    paths = export_review_sheets(items, tmp_path, ["a", "b", "c"], sample_fraction=1.0, fmt="xlsx")
    for name in ("a", "b", "c"):
        wb = openpyxl.load_workbook(paths[name])
        for ws in wb.worksheets[1:]:
            header = [c.value for c in ws[1]]
            ia, iv, ii = (header.index(h) + 1 for h in ("item_id", "reviewer_answer", "verdict"))
            for r in range(2, ws.max_row + 1):
                ws.cell(row=r, column=iv, value=key[ws.cell(row=r, column=ia).value])
                ws.cell(row=r, column=ii, value="ok")
        wb.save(paths[name])
    outcome = ingest_reviews(items, [paths["a"], paths["b"], paths["c"]])
    assert set(outcome.accepted) == set(key) and outcome.rejected == {}
    assert read_sheet(paths["a"])[0].reviewer == "reviewer_a" or read_sheet(paths["a"])[0].reviewer == "a"


def test_xlsx_unfilled_rows_are_skipped_and_reject_is_read(tmp_path):
    items = t3_items(6)
    paths = export_review_sheets(items, tmp_path, ["a", "b"], sample_fraction=1.0, fmt="xlsx")
    assert read_sheet(paths["a"]) == []
    wb = openpyxl.load_workbook(paths["a"])
    ws = wb["T3 Culture"]
    header = [c.value for c in ws[1]]
    iv, ii, ik = (header.index(h) + 1 for h in ("verdict", "issue", "reviewer_answer"))
    ws.cell(row=2, column=ik, value="B")
    ws.cell(row=2, column=iv, value="reject")
    ws.cell(row=2, column=ii, value="two-answers")
    wb.save(paths["a"])
    got = read_sheet(paths["a"])
    assert len(got) == 1 and got[0].verdict == "reject" and got[0].issue == "two-answers" and got[0].answer == "B"
