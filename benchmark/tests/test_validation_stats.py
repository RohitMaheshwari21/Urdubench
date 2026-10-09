import pytest

from urdubench.validation import cohen_kappa, fleiss_kappa, mean_pairwise_kappa, percent_agreement


def test_cohen_kappa_hand_computed():
    a = ["y", "y", "n", "n"]
    b = ["y", "n", "n", "n"]
    # observed 0.75, expected 0.5*0.25 + 0.5*0.75 = 0.5
    assert cohen_kappa(a, b) == pytest.approx(0.5)
    assert percent_agreement(a, b) == 0.75


def test_cohen_kappa_extremes():
    x = ["a", "b", "c", "a"]
    assert cohen_kappa(x, x) == 1.0
    assert cohen_kappa(["a", "a"], ["a", "a"]) == 1.0  # single shared label, no variance
    assert cohen_kappa(["a", "b", "a", "b"], ["b", "a", "b", "a"]) == pytest.approx(-1.0)


def test_cohen_kappa_input_errors():
    with pytest.raises(ValueError):
        cohen_kappa(["a"], ["a", "b"])
    with pytest.raises(ValueError):
        cohen_kappa([], [])


def test_fleiss_kappa_hand_computed():
    ratings = [["a", "a", "a"], ["a", "a", "b"], ["b", "b", "b"], ["b", "a", "b"]]
    # P_bar = (1 + 1/3 + 1 + 1/3) / 4 = 2/3 ; Pe = 0.5 ; kappa = (2/3 - 1/2) / 0.5 = 1/3
    assert fleiss_kappa(ratings) == pytest.approx(1 / 3)


def test_fleiss_perfect_and_errors():
    assert fleiss_kappa([["a", "a", "a"], ["b", "b", "b"]]) == 1.0
    with pytest.raises(ValueError):
        fleiss_kappa([["a", "a"], ["a", "a", "a"]])
    with pytest.raises(ValueError):
        fleiss_kappa([])


def test_mean_pairwise_kappa_uses_shared_items_only():
    by_rater = {
        "r1": {"i1": "A", "i2": "B", "i3": "A"},
        "r2": {"i1": "A", "i2": "B", "i3": "B"},
        "r3": {"i9": "A"},  # shares nothing with the others
    }
    kappa, pairs = mean_pairwise_kappa(by_rater)
    assert pairs == 1 and kappa == pytest.approx(cohen_kappa(["A", "B", "A"], ["A", "B", "B"]))
    assert mean_pairwise_kappa({"r1": {"i1": "A"}, "r2": {"i1": "A"}}) is None  # < 2 shared items
