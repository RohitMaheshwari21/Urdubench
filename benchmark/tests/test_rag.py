import io
import itertools
import json
import math
import urllib.error

import pytest

from urdubench.rag import EMBED_DIMS
from urdubench.rag.chunk import CHUNK_CHARS, chunk_article, chunk_text, sections
from urdubench.rag.corpus import fetch_article, urdu_titles
from urdubench.rag.embed import GeminiEmbedder, Index, build_index, normalize, pack, unpack
from urdubench.rag.evaluate import answer_in_context, bootstrap_diff, rag_prompt, to_markdown

ARTICLE = {
    "id": "wiki-001",
    "title": "لاہور",
    "url": "https://ur.wikipedia.org/wiki/لاہور",
    "text": (
        "لاہور پنجاب کا دارالحکومت ہے اور پاکستان کا دوسرا بڑا شہر ہے۔\n\n== تاریخ ==\n"
        "لاہور بہت پرانا شہر ہے اور مغلوں کے دور میں بہت اہم تھا۔\n\n== حوالہ جات ==\nکتاب ۱"
    ),
}


def test_sections_split_on_headings_and_keep_lead():
    s = sections(ARTICLE["text"])
    assert [h for h, _ in s] == ["", "تاریخ", "حوالہ جات"]
    assert s[0][1].startswith("لاہور پنجاب کا دارالحکومت ہے")


def test_chunk_article_skips_reference_sections_and_tiny_fragments():
    chunks = chunk_article({**ARTICLE, "text": ARTICLE["text"] + "\n\n== جغرافیہ ==\nمختصر"})
    # the reference section is skipped and the 5-character "مختصر" section is too short to keep
    assert [c["section"] for c in chunks] == ["", "تاریخ"]
    assert all("کتاب" not in c["text"] for c in chunks)
    assert all(c["url"] == ARTICLE["url"] and c["id"].startswith("wiki-001-") for c in chunks)


def test_chunk_text_respects_size_and_overlaps_at_word_boundaries():
    words = [f"لفظ{i}" for i in range(600)]
    body = "۔ ".join(" ".join(words[i : i + 12]) for i in range(0, 600, 12)) + "۔"
    chunks = chunk_text(body)
    assert len(chunks) > 3
    assert all(len(c) <= CHUNK_CHARS for c in chunks)
    for prev, cur in itertools.pairwise(chunks):
        first_word = cur.split(" ")[0]
        assert first_word in prev.split(" ") or first_word.rstrip("۔") in prev  # overlap starts on a word


def test_chunk_text_hard_splits_text_without_boundaries():
    chunks = chunk_text("ا" * (CHUNK_CHARS * 2 + 5), overlap=0)
    assert [len(c) for c in chunks] == [CHUNK_CHARS, CHUNK_CHARS, 5]


def test_urdu_titles_follows_redirects_and_skips_missing():
    def http(url):
        return {"query": {
            "redirects": [{"from": "Lahore Resolution", "to": "Pakistan Resolution"}],
            "pages": [
                {"title": "Pakistan Resolution", "langlinks": [{"lang": "ur", "title": "قرارداد پاکستان"}]},
                {"title": "Nowhere"},
            ],
        }}
    assert urdu_titles(["Lahore Resolution", "Nowhere"], http) == {"Lahore Resolution": "قرارداد پاکستان"}


def test_fetch_article_records_source_and_license():
    def http(url):
        return {"query": {"pages": [{"title": "K2", "extract": "کے ٹو", "revisions": [{"revid": 42}]}]}}
    a = fetch_article("K2", http)
    assert a["revid"] == 42 and a["license"] == "CC BY-SA 4.0" and a["url"].endswith("/K2")
    assert fetch_article("x", lambda url: {"query": {"pages": [{"title": "x", "missing": True}]}}) is None


def test_pack_roundtrip_and_normalize():
    v = normalize([3.0, 4.0])
    assert v == pytest.approx([0.6, 0.8])
    assert unpack(pack(v)) == pytest.approx(v, abs=1e-6)


class FakePost:
    def __init__(self, fail_first=0):
        self.calls = []
        self.fail_first = fail_first

    def __call__(self, url, body, headers):
        self.calls.append(body)
        if self.fail_first:
            self.fail_first -= 1
            raise urllib.error.HTTPError(url, 429, "rate", {}, io.BytesIO())
        out = []
        for r in body["requests"]:
            assert r["outputDimensionality"] == EMBED_DIMS
            t = r["content"]["parts"][0]["text"]
            out.append({"values": [float(len(t)), 1.0] + [0.0] * (EMBED_DIMS - 2)})
        return {"embeddings": out}


def test_embedder_batches_normalizes_and_retries_rate_limits():
    post = FakePost(fail_first=1)
    slept = []
    e = GeminiEmbedder("key", post=post, sleep=slept.append)
    vecs = e.embed(["a"] * 150, "RETRIEVAL_DOCUMENT")
    assert len(vecs) == 150
    assert all(math.isclose(sum(x * x for x in v), 1.0) for v in vecs)
    assert [len(c["requests"]) for c in post.calls] == [25] * 7  # 6 batches, the first retried after a 429
    assert slept[0] == 5


def test_build_index_resumes_and_search_ranks(tmp_path):
    chunks = [{"id": f"c{i}", "title": "t", "text": "x" * (i + 1)} for i in range(3)]
    out = tmp_path / "index.jsonl"
    post = FakePost()
    build_index(chunks[:2], GeminiEmbedder("k", post=post, sleep=lambda s: None), out, log=lambda m: None)
    build_index(chunks, GeminiEmbedder("k", post=post, sleep=lambda s: None), out, log=lambda m: None)
    assert sum(len(c["requests"]) for c in post.calls) == 3  # nothing embedded twice
    idx = Index.load(out)
    assert [c["id"] for c in idx.chunks] == ["c0", "c1", "c2"]
    q = idx.vectors[2]
    assert idx.search(q, 1)[0][1]["id"] == "c2"


def test_rag_prompt_and_answer_in_context():
    item = {"question": "کے ٹو کہاں ہے؟", "choices": ["قراقرم", "ہمالیہ", "ہندوکش", "سلیمان"], "answer": "A"}
    passages = [{"title": "کے ٹو", "text": "کے ٹو قراقرم میں ہے۔"}]
    msg = rag_prompt(item, passages)[0]["content"]
    assert "[1] کے ٹو" in msg and "A. قراقرم" in msg
    assert answer_in_context(item, passages)
    assert not answer_in_context({**item, "answer": "B"}, passages)


def test_bootstrap_diff_and_markdown():
    lo, hi = bootstrap_diff([False] * 10, [True] * 10)
    assert lo == hi == 1.0
    md = to_markdown({"n": 2, "k": 4, "answer_in_context_rate": 0.5, "mean_top1_similarity": 0.7,
                      "models": {"groq/x": {"plain": 0.5, "rag": 1.0, "gain": 0.5, "gain_ci95": [0, 1],
                                            "plain_when_answer_in_context": None,
                                            "rag_when_answer_in_context": None}}})
    assert "| x | 0.50 | 1.00 | +0.50" in md
    json.dumps(md)
