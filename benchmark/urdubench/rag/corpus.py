"""Fetch a small Urdu Wikipedia corpus (CC BY-SA 4.0) on Pakistan-related topics.

Articles are chosen by topic area (the nine T3 categories), not per benchmark question. English titles
are mapped to their Urdu articles through Wikipedia's language links, which avoids guessing Urdu titles.
"""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from collections.abc import Callable
from pathlib import Path

USER_AGENT = "UrduBench/0.1 (research benchmark; https://github.com/RohitMaheshwari21/Urdubench)"
LICENSE = "CC BY-SA 4.0"
MAX_CHARS = 30_000  # per article; keeps the corpus small enough for the Neon free tier

TOPICS: dict[str, list[str]] = {
    "history": [
        "Pakistan Movement", "Lahore Resolution", "Partition of India", "Muhammad Ali Jinnah",
        "Liaquat Ali Khan", "Mughal Empire", "Akbar", "Indus Valley Civilisation", "Mohenjo-daro",
        "Harappa", "Constitution of Pakistan", "All-India Muslim League", "Syed Ahmad Khan",
        "Aligarh Movement", "Allahabad Address", "Taxila", "Delhi Sultanate", "Independence Day (Pakistan)",
    ],
    "geography": [
        "Pakistan", "Indus River", "K2", "Nanga Parbat", "Karakoram", "Hindu Kush", "Thar Desert",
        "Balochistan, Pakistan", "Punjab, Pakistan", "Sindh", "Khyber Pakhtunkhwa", "Gilgit-Baltistan",
        "Azad Kashmir", "Islamabad", "Karachi", "Lahore", "Peshawar", "Quetta", "Multan", "Faisalabad",
        "Rawalpindi", "Tarbela Dam", "Mangla Dam", "Karakoram Highway", "Deosai National Park",
        "Khewra Salt Mine", "Hunza Valley", "Swat District", "Jhelum River", "Chenab River",
        "Khyber Pass", "Gwadar",
    ],
    "language-literature": [
        "Urdu", "Urdu poetry", "Ghazal", "Muhammad Iqbal", "Mirza Ghalib", "Faiz Ahmad Faiz",
        "Mir Taqi Mir", "Saadat Hasan Manto", "Ahmad Faraz", "Parveen Shakir", "Bulleh Shah", "Waris Shah",
        "Heer Ranjha", "Shah Abdul Latif Bhittai", "Nastaliq", "Punjabi language", "Sindhi language",
        "Pashto", "Balochi language", "Bano Qudsia", "Intizar Hussain", "Tarana-e-Pakistan",
    ],
    "religion-festivals": [
        "Eid al-Fitr", "Eid al-Adha", "Ramadan", "Muharram", "Mawlid", "Shab-e-Barat", "Basant",
        "Badshahi Mosque", "Faisal Mosque", "Sufism", "Lal Shahbaz Qalandar", "Data Darbar",
    ],
    "food": [
        "Pakistani cuisine", "Biryani", "Nihari", "Haleem", "Karahi", "Chapli kebab", "Sajji", "Paya (food)",
        "Halwa puri", "Lassi", "Gulab jamun", "Jalebi", "Samosa", "Kheer", "Sheer khurma", "Masala chai",
    ],
    "sports": [
        "Cricket", "Pakistan national cricket team", "1992 Cricket World Cup", "Imran Khan", "Field hockey",
        "Pakistan men's national field hockey team", "Squash (sport)", "Jahangir Khan", "Jansher Khan",
        "Kabaddi", "Polo", "Pakistan Super League", "Wasim Akram", "Arshad Nadeem", "Hockey World Cup",
    ],
    "daily-life-customs": [
        "Shalwar kameez", "Sherwani", "Mehndi", "Walima", "Truck art in South Asia", "Jirga", "Ajrak",
        "Peshawari chappal", "Dupatta", "Kite flying", "Auto rickshaw",
    ],
    "famous-personalities": [
        "Abdul Sattar Edhi", "Malala Yousafzai", "Abdus Salam", "Nusrat Fateh Ali Khan", "Noor Jehan",
        "Benazir Bhutto", "Zulfikar Ali Bhutto", "Fatima Jinnah", "Abdul Qadeer Khan", "Mehdi Hassan",
        "Arfa Karim", "Ruth Pfau", "Edhi Foundation",
    ],
    "institutions": [
        "National Assembly of Pakistan", "Senate of Pakistan", "Supreme Court of Pakistan",
        "State Bank of Pakistan", "Pakistan Armed Forces", "Pakistan International Airlines",
        "Pakistan Railways", "University of the Punjab", "Pakistan Television Corporation", "Radio Pakistan",
        "Election Commission of Pakistan", "Higher Education Commission (Pakistan)",
        "Water and Power Development Authority", "Pakistan Post", "Parliament of Pakistan",
    ],
}

Http = Callable[[str], dict]


def http_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def _api(host: str, **params: str) -> str:
    q = {"format": "json", "formatversion": "2", **params}
    return f"https://{host}/w/api.php?{urllib.parse.urlencode(q)}"


def urdu_titles(en_titles: list[str], http: Http = http_json) -> dict[str, str]:
    """English title -> Urdu title, for the articles that have an Urdu version."""
    out: dict[str, str] = {}
    for i in range(0, len(en_titles), 50):
        batch = en_titles[i : i + 50]
        data = http(_api("en.wikipedia.org", action="query", prop="langlinks", lllang="ur",
                         lllimit="max", redirects="1", titles="|".join(batch)))
        q = data.get("query", {})
        # map redirected/normalized titles back to what we asked for
        back = {t: t for t in batch}
        for n in q.get("normalized", []) + q.get("redirects", []):
            back[n["to"]] = back.get(n["from"], n["from"])
        for page in q.get("pages", []):
            links = page.get("langlinks") or []
            if links:
                out[back.get(page["title"], page["title"])] = links[0]["title"]
    return out


def fetch_article(ur_title: str, http: Http = http_json) -> dict | None:
    data = http(_api("ur.wikipedia.org", action="query", prop="extracts|revisions", explaintext="1",
                     exsectionformat="wiki", rvprop="ids", redirects="1", titles=ur_title))
    pages = data.get("query", {}).get("pages", [])
    if not pages or pages[0].get("missing"):
        return None
    p = pages[0]
    text = (p.get("extract") or "").strip()
    if not text:
        return None
    return {
        "title": p["title"],
        "url": "https://ur.wikipedia.org/wiki/" + urllib.parse.quote(p["title"].replace(" ", "_")),
        "revid": (p.get("revisions") or [{}])[0].get("revid"),
        "license": LICENSE,
        "text": text[:MAX_CHARS],
    }


def fetch_corpus(out: Path, http: Http = http_json, delay: float = 0.3, log=print) -> list[dict]:
    """Write `articles.jsonl` (one article per line, with category and source URL)."""
    en = [t for titles in TOPICS.values() for t in titles]
    category = {t: c for c, titles in TOPICS.items() for t in titles}
    mapping = urdu_titles(en, http)
    log(f"{len(mapping)} of {len(en)} topics have an Urdu article")
    articles, seen = [], set()
    for en_title, ur_title in mapping.items():
        art = fetch_article(ur_title, http)
        time.sleep(delay)
        if not art or art["title"] in seen:
            continue
        seen.add(art["title"])
        articles.append({"id": f"wiki-{len(articles) + 1:03d}", "category": category[en_title],
                         "en_title": en_title, **art})
    out.mkdir(parents=True, exist_ok=True)
    with (out / "articles.jsonl").open("w", encoding="utf-8") as f:
        for a in articles:
            f.write(json.dumps(a, ensure_ascii=False) + "\n")
    log(f"wrote {len(articles)} articles, {sum(len(a['text']) for a in articles):,} characters")
    return articles
