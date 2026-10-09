from urdubench.generation.filters import check_batch, check_item, filter_candidates


def mcq(**over):
    base = {
        "id": "t3-101", "task": "T3", "language": "ur", "category": "geography",
        "question": "پاکستان کا دارالحکومت کون سا شہر ہے؟",
        "choices": ["کراچی", "لاہور", "اسلام آباد", "پشاور"], "answer": "C",
        "source": "s", "license": "CC-BY-4.0", "difficulty": "easy", "validated": False,
    }
    return {**base, **over}


def t1(**over):
    base = {
        "id": "t1-101", "task": "T1", "language": "ur", "category": "narrative",
        "passage": "احمد روزانہ صبح چھ بجے اٹھتا ہے اور نماز کے بعد سیر کے لیے پارک جاتا ہے۔",
        "question": "احمد صبح کتنے بجے اٹھتا ہے؟", "answer": ["چھ بجے"],
        "source": "s", "license": "CC-BY-4.0", "difficulty": "easy", "validated": False,
    }
    return {**base, **over}


def t2(**over):
    base = {
        "id": "t2-101", "task": "T2", "language": "roman-ur", "category": "plain",
        "question": "Yeh film bohat acha thi", "label_set": ["positive", "negative", "neutral"],
        "answer": "positive", "source": "s", "license": "CC-BY-4.0", "difficulty": "easy",
        "validated": False,
    }
    return {**base, **over}


def codes(findings, severity=None):
    return {f.code for f in findings if severity in (None, f.severity)}


def test_clean_items_have_no_errors():
    for item in (mcq(), t1(), t2()):
        assert codes(check_item(item), "error") == set()


def test_arabic_letter_variants_and_digits_rejected():
    assert "arabic_variant" in codes(check_item(mcq(question="پاكستان كا دارالحکومت کیا ہے؟")), "error")
    assert "non_ascii_digits" in codes(check_item(mcq(question="سال ١٩٤٧ میں کیا ہوا؟")), "error")


def test_latin_in_urdu_is_only_a_warning():
    f = check_item(mcq(question="یہ ایک test سوال ہے؟"))
    assert "latin_in_urdu" in codes(f, "warn") and "latin_in_urdu" not in codes(f, "error")


def test_roman_urdu_with_arabic_script_rejected():
    assert "script_mix" in codes(check_item(t2(question="Yeh film بہت acha thi")), "error")


def test_pii_detected():
    for text in ("rabta karein a@b.com", "dekhein https://x.pk", "call 0300 1234567 abhi"):
        assert "pii" in codes(check_item(t2(question=text)), "error")


def test_length_limits():
    assert "too_short" in codes(check_item(mcq(question="کیا؟")), "error")
    assert "too_long" in codes(check_item(mcq(question="الف " * 100)), "error")


def test_answer_leak_and_choice_quality():
    assert "answer_in_question" in codes(
        check_item(mcq(question="کیا اسلام آباد پاکستان کا دارالحکومت ہے؟")), "error"
    )
    assert "duplicate_choices" in codes(
        check_item(mcq(choices=["کراچی", "لاہور", "اسلام آباد", "اسلام آباد۔"])), "error"
    )
    assert "all_none_of_above" in codes(
        check_item(mcq(choices=["کراچی", "لاہور", "اسلام آباد", "ان میں سے کوئی نہیں"])), "error"
    )
    long = mcq(choices=["کراچی", "لاہور", "اسلام آباد جو پاکستان کا خوبصورت شہر ہے", "پشاور"])
    assert "length_cue" in codes(check_item(long), "warn")
    overlap = mcq(choices=["کراچی", "لاہور", "اسلام آباد", "اسلام"])
    assert "overlapping_choices" in codes(check_item(overlap), "warn")


def test_t1_rules():
    assert "answer_in_question" in codes(
        check_item(t1(question="کیا احمد چھ بجے اٹھتا ہے؟", answer=["چھ بجے"])), "error"
    )
    assert "yes_no" in codes(check_item(t1(question="کیا احمد سیر کرتا ہے؟", answer=["ہاں"])), "error")
    assert "answer_not_in_passage" in codes(check_item(t1(answer=["سات بجے"])), "warn")


def test_t2_label_leak_warning():
    assert "label_leak" in codes(check_item(t2(question="This is positive vibes yaar")), "warn")


def test_duplicates_and_near_duplicates():
    a = mcq()
    exact = mcq(id="t3-102")
    near = mcq(id="t3-103", question="پاکستان کا دارالحکومت کون سا شہر ہے بتائیے؟")
    other = mcq(id="t3-104", question="دریائے راوی کس شہر کے کنارے آباد ہے؟")
    f = check_batch([a, exact, near, other])
    by_id = {(x.item_id, x.code) for x in f}
    assert ("t3-102", "duplicate") in by_id
    assert ("t3-103", "near_duplicate") in by_id
    assert not any(x.item_id == "t3-104" for x in f)


def test_duplicate_against_reference_and_ids():
    ref = [mcq(id="t3-001")]
    f = check_batch([mcq(id="t3-101")], ref)
    assert "duplicate" in codes(f, "error")
    f2 = check_batch([mcq(id="t3-001", question="بالکل مختلف سوال یہاں ہے؟")], ref)
    assert "duplicate_id" in codes(f2, "error")


def test_same_text_in_other_language_is_not_a_duplicate():
    f = check_batch([mcq(id="t4-101-ur", task="T4", pair_id="t4-101"),
                     mcq(id="t4-101-en", task="T4", language="en", pair_id="t4-101")])
    assert "duplicate" not in codes(f)


def test_answer_position_bias_warning():
    items = [mcq(id=f"t3-{200 + i}", question=f"سوال نمبر {i} بالکل الگ ہے؟" + "الف" * i, answer="B")
             for i in range(25)]
    assert "answer_position_bias" in codes(check_batch(items), "warn")


def test_filter_candidates_rejects_whole_pair():
    ur = mcq(id="t4-101-ur", task="T4", pair_id="t4-101")
    en = mcq(id="t4-101-en", task="T4", language="en", pair_id="t4-101",
             question="What is the capital of Pakistan?", choices=["Karachi", "Lahore", "Islamabad", "Peshawar"])
    bad_ur = {**ur, "question": "پاكستان كا"}  # Arabic variants: error on the ur side only
    result = filter_candidates([bad_ur, en])
    assert result.accepted == [] and len(result.rejected) == 2
    good = filter_candidates([ur, en])
    assert len(good.accepted) == 2 and good.rejected == []
