"""Inter-annotator agreement statistics."""

from __future__ import annotations

from collections import Counter
from collections.abc import Sequence
from itertools import combinations


def percent_agreement(a: Sequence[str], b: Sequence[str]) -> float:
    if len(a) != len(b):
        raise ValueError("sequences must have equal length")
    return sum(x == y for x, y in zip(a, b, strict=True)) / len(a) if a else 0.0


def cohen_kappa(a: Sequence[str], b: Sequence[str]) -> float:
    """Cohen's kappa for two raters. Returns 1.0 when both raters use one identical label."""
    if len(a) != len(b):
        raise ValueError("sequences must have equal length")
    n = len(a)
    if n == 0:
        raise ValueError("no ratings")
    observed = percent_agreement(a, b)
    ca, cb = Counter(a), Counter(b)
    expected = sum(ca[k] * cb[k] for k in set(ca) | set(cb)) / (n * n)
    if expected == 1.0:
        return 1.0
    return (observed - expected) / (1 - expected)


def fleiss_kappa(ratings: Sequence[Sequence[str]]) -> float:
    """Fleiss' kappa. `ratings[i]` is the list of labels given to item i; every item must have
    the same number (>= 2) of ratings."""
    if not ratings:
        raise ValueError("no ratings")
    m = len(ratings[0])
    if m < 2 or any(len(r) != m for r in ratings):
        raise ValueError("every item needs the same number (>= 2) of ratings")
    n = len(ratings)
    totals: Counter[str] = Counter()
    p_items = []
    for r in ratings:
        c = Counter(r)
        totals.update(c)
        p_items.append((sum(v * v for v in c.values()) - m) / (m * (m - 1)))
    p_bar = sum(p_items) / n
    p_e = sum((v / (n * m)) ** 2 for v in totals.values())
    if p_e == 1.0:
        return 1.0
    return (p_bar - p_e) / (1 - p_e)


def mean_pairwise_kappa(by_rater: dict[str, dict[str, str]]) -> tuple[float, int] | None:
    """Average Cohen's kappa over rater pairs, on the items both raters labelled.

    `by_rater[rater][item_id] = label`. Returns (mean kappa, number of pairs used) or None.
    """
    values = []
    for r1, r2 in combinations(sorted(by_rater), 2):
        shared = sorted(set(by_rater[r1]) & set(by_rater[r2]))
        if len(shared) >= 2:
            values.append(cohen_kappa([by_rater[r1][i] for i in shared], [by_rater[r2][i] for i in shared]))
    return (sum(values) / len(values), len(values)) if values else None
