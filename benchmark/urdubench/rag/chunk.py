"""Split articles into section-aware, overlapping chunks."""

from __future__ import annotations

import re

CHUNK_CHARS = 900
OVERLAP_CHARS = 150
MIN_CHARS = 40  # shorter fragments (stray list items, captions) are dropped

_HEADING = re.compile(r"^(={2,})\s*(.+?)\s*\1\s*$")
# reference and navigation sections carry no answerable content
SKIP_SECTIONS = {"حوالہ جات", "حوالے", "بیرونی روابط", "مزید دیکھیے", "مزید دیکھیں", "کتابیات", "مآخذ", "ماخذ"}
_SENTENCE_END = re.compile(r"(?<=[۔؟!?.])\s+")


def sections(text: str) -> list[tuple[str, str]]:
    """[(heading, body)] in order; the lead section has heading ''."""
    out: list[tuple[str, list[str]]] = [("", [])]
    for line in text.splitlines():
        m = _HEADING.match(line.strip())
        if m:
            out.append((m.group(2), []))
        else:
            out[-1][1].append(line)
    return [(h, "\n".join(b).strip()) for h, b in out if "\n".join(b).strip()]


def _pieces(body: str) -> list[str]:
    """Paragraphs, with over-long paragraphs split at sentence ends."""
    out: list[str] = []
    for para in (p.strip() for p in body.split("\n")):
        if not para:
            continue
        if len(para) <= CHUNK_CHARS:
            out.append(para)
            continue
        for sent in _SENTENCE_END.split(para):
            while len(sent) > CHUNK_CHARS:  # no sentence boundary at all: hard split
                out.append(sent[:CHUNK_CHARS])
                sent = sent[CHUNK_CHARS:]
            if sent:
                out.append(sent)
    return out


def chunk_text(body: str, size: int = CHUNK_CHARS, overlap: int = OVERLAP_CHARS) -> list[str]:
    """Pack paragraphs/sentences into chunks of at most `size` characters; each chunk after the
    first starts with the last `overlap` characters of the previous one."""
    chunks: list[str] = []
    cur = ""
    for piece in _pieces(body):
        if cur and len(cur) + 1 + len(piece) > size:
            chunks.append(cur)
            tail = cur[-overlap:] if overlap else ""
            if " " in tail and len(cur) > overlap:  # start the overlap at a word boundary
                tail = tail.split(" ", 1)[1]
            cur = (tail + " " + piece).strip() if len(tail) + 1 + len(piece) <= size else piece
        else:
            cur = f"{cur}\n{piece}" if cur else piece
    if cur:
        chunks.append(cur)
    return chunks


def chunk_article(article: dict) -> list[dict]:
    out = []
    for heading, body in sections(article["text"]):
        if heading in SKIP_SECTIONS:
            continue
        for text in chunk_text(body):
            if len(text) < MIN_CHARS:
                continue
            out.append({
                "id": f"{article['id']}-{len(out):03d}",
                "article_id": article["id"],
                "title": article["title"],
                "section": heading,
                "url": article["url"],
                "text": text,
            })
    return out
