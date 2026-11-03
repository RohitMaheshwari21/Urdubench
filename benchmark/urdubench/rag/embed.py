"""Gemini embeddings (free tier) and a small exact-search index.

Free-tier note: Google may use free-tier content to improve its products. Only public text (Wikipedia
chunks, public dev questions) is sent from here.
"""

from __future__ import annotations

import base64
import json
import math
import os
import struct
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from pathlib import Path

from urdubench.rag import EMBED_DIMS, EMBED_MODEL

API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:batchEmbedContents"
BATCH = 25  # small batches stay under the free tier's tokens-per-minute limit

Post = Callable[[str, dict, dict], dict]


def http_post(url: str, body: dict, headers: dict) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def normalize(v: list[float]) -> list[float]:
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


class GeminiEmbedder:
    def __init__(self, api_key: str | None = None, post: Post = http_post, sleep=time.sleep, pause: float = 4.0):
        self.key = api_key or os.environ.get("EMBEDDING_API_KEY") or os.environ.get("GEMINI_API_KEY", "")
        if not self.key:
            raise RuntimeError("set EMBEDDING_API_KEY (a Gemini API key)")
        self.post, self.sleep, self.pause = post, sleep, pause

    def embed(self, texts: list[str], task: str) -> list[list[float]]:
        """task: RETRIEVAL_DOCUMENT for chunks, RETRIEVAL_QUERY for questions."""
        out: list[list[float]] = []
        for i in range(0, len(texts), BATCH):
            body = {"requests": [
                {"model": f"models/{EMBED_MODEL}", "content": {"parts": [{"text": t}]},
                 "taskType": task, "outputDimensionality": EMBED_DIMS}
                for t in texts[i : i + BATCH]
            ]}
            for attempt in range(10):
                try:
                    data = self.post(API.format(model=EMBED_MODEL), body,
                                     {"x-goog-api-key": self.key, "Content-Type": "application/json"})
                    break
                except urllib.error.HTTPError as e:
                    if e.code not in (429, 500, 503) or attempt == 9:
                        raise
                    self.sleep(min(60, 5 * 2**attempt))
            out.extend(normalize(e["values"]) for e in data["embeddings"])
            self.sleep(self.pause)
        return out


def pack(v: list[float]) -> str:
    """float32 little-endian, base64: about 4 KB per 768-dim vector instead of ~15 KB of JSON."""
    return base64.b64encode(struct.pack(f"<{len(v)}f", *v)).decode()


def unpack(s: str) -> list[float]:
    raw = base64.b64decode(s)
    return list(struct.unpack(f"<{len(raw) // 4}f", raw))


def dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b, strict=True))


class Index:
    """Exact cosine search over normalized vectors (a few thousand chunks; no library needed)."""

    def __init__(self, chunks: list[dict], vectors: list[list[float]]):
        self.chunks, self.vectors = chunks, vectors

    @classmethod
    def load(cls, path: Path) -> Index:
        chunks, vectors = [], []
        for line in path.read_text(encoding="utf-8").splitlines():
            row = json.loads(line)
            vectors.append(unpack(row.pop("embedding")))
            chunks.append(row)
        return cls(chunks, vectors)

    def search(self, q: list[float], k: int = 4) -> list[tuple[float, dict]]:
        scored = sorted(((dot(q, v), i) for i, v in enumerate(self.vectors)), reverse=True)[:k]
        return [(s, self.chunks[i]) for s, i in scored]


def build_index(chunks: list[dict], embedder: GeminiEmbedder, out: Path, log=print) -> None:
    """Embed chunks, resuming from `out` if a previous run stopped part-way."""
    done: dict[str, str] = {}
    if out.exists():
        for line in out.read_text(encoding="utf-8").splitlines():
            row = json.loads(line)
            done[row["id"]] = row["embedding"]
    todo = [c for c in chunks if c["id"] not in done]
    log(f"{len(done)} chunks already embedded, {len(todo)} to go")
    with out.open("a", encoding="utf-8") as f:
        for i in range(0, len(todo), BATCH):
            batch = todo[i : i + BATCH]
            vecs = embedder.embed([f"{c['title']}: {c['text']}" for c in batch], "RETRIEVAL_DOCUMENT")
            for c, v in zip(batch, vecs, strict=True):
                f.write(json.dumps({**c, "embedding": pack(v)}, ensure_ascii=False) + "\n")
            f.flush()
            log(f"  embedded {min(i + BATCH, len(todo))} / {len(todo)}")
