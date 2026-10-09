# Gap analysis: existing Urdu / Roman Urdu LLM evaluation resources

Survey date: 2026-10-10. Sources are linked. Where a claim could not be checked at the source, it is marked **unverified**. Dataset licenses must be re-checked before any item is reused (Phase 3).

## 1. What exists

| Resource | What it measures | Size | Roman Urdu | License / availability |
|---|---|---|---|---|
| [UrduMMLU](https://arxiv.org/abs/2606.07167) (MBZUAI, 2026) · [HF](https://huggingface.co/datasets/MBZUAI/UrduMMLU) · [code](https://github.com/mbzuai-nlp/UrduMMLU) | Knowledge and reasoning, native Urdu MCQs from Pakistani SSC to HSSC exam material, 26 subjects | 26,431 (HF card; the arXiv text says 26,389) | No | CC BY 4.0, public, test split only. Items come from exam-prep sites (Ustad 360, MCQ Times, TestPoint PK, FBISE and others), so third-party copyright on the sources is **unverified**. |
| [UrduBench](https://arxiv.org/abs/2601.21000) (2026) | Reasoning: Urdu translations of MGSM, MATH-500, CommonsenseQA, OpenBookQA | not stated | No | Paper CC BY 4.0. The page says data "will be publicly released"; no link seen. |
| [Pak3H](https://arxiv.org/abs/2608.30065) (2026) | Alignment: helpfulness, harmlessness, honesty with Pakistani context (PakAlpaca, PakBeaverTails, PakTruthfulQA) | not stated | No | Paper CC BY 4.0. No data link seen. |
| [UrBLiMP](https://arxiv.org/abs/2508.01006) (2025) | Grammatical competence, minimal pairs | 5,696 pairs | No | Release location not checked. |
| [UrduFactCheck](https://arxiv.org/abs/2505.15063) (2025) | Fact-checking and factual QA (UrduFactBench, UrduFactQA) | not checked | No | Release not checked. |
| [Benchmarking LLMs across Urdu NLP tasks](https://arxiv.org/abs/2405.15453) (2024) | 14 tasks from 15 existing datasets, zero-shot, older models | n/a | Not checked | Study, not a maintained benchmark. |
| [Alif](https://arxiv.org/abs/2510.09051) (2025) | A tuned Urdu model plus a small eval set | about 150 per task | Not checked | Eval set is a by-product of a model paper. |
| [UQuAD 1.0](https://arxiv.org/abs/2111.01543) | Reading comprehension | about 45,000 machine-translated SQuAD1 pairs plus about 4,000 crowdsourced | No | License **not stated** in the sources I saw. Human part uses Wikipedia and Cambridge O-level worksheets. |
| [UQA](https://arxiv.org/abs/2405.01458) · [HF](https://huggingface.co/datasets/uqa/UQA) | Reading comprehension, machine-translated SQuAD2.0 | not checked | No | HF card has no license field. Upstream SQuAD2.0 terms apply (believed CC BY-SA 4.0, **unverified**). |
| [community-datasets/roman_urdu](https://huggingface.co/datasets/community-datasets/roman_urdu) | Roman Urdu sentiment (positive / negative / neutral) | 20,229 | Yes | `license: unknown`, card mostly unfilled, original source not documented. |
| [roman_urdu_hate_speech](https://huggingface.co/datasets/community-datasets/roman_urdu_hate_speech) | Roman Urdu hate speech | not checked | Yes | MIT per HF metadata. |
| Small HF community sets (for example `Khubaib01/RomanUrdu-NLP-Sentiment-Corpus`, `mteb/urdu_roman_sentiment`) | Sentiment, toxicity, safety probes | small | Yes | Mixed; provenance undocumented. |
| [community-datasets/urdu_sentiment_corpus](https://huggingface.co/datasets/community-datasets/urdu_sentiment_corpus) | Urdu sentiment | not checked | No | `license: unknown`. |

The Hugging Face search was by download count and keyword, so it is not exhaustive. A paper-by-paper sweep of ACL Anthology and arXiv cs.CL should be repeated before the write-up in Phase 9.

## 2. What this means for Urdu-Bench

**The Urdu knowledge-MCQ space is no longer empty.** UrduMMLU is large, native, human-verified and openly licensed, and it already contains Pakistan Studies (1,895 items), geography (630), current affairs (437), Urdu literature (5,859) and Islamic Studies (1,497). A 300-item "cultural knowledge" set (T3) cannot compete on size or breadth, and should not claim to.

**What the surveyed resources do not appear to cover:**

1. **Roman Urdu as an LLM evaluation target.** The Roman Urdu resources are classic NLP corpora with unknown or mixed licensing and no documented provenance, built before instruction-tuned LLMs. None of the benchmarks above covers Roman Urdu. Spelling variation (`acha` / `achha` / `accha`) has no systematic treatment as a measured failure mode.
2. **Controlled Urdu-versus-English parity.** UrduMMLU reports results under English and Urdu *prompts*. A paired design, identical question and options in both languages with the gap as the headline number, is not part of the benchmarks surveyed (T4).
3. **Contamination resistance.** UrduMMLU and the translated sets are fully public, so training-data leakage is a plausible risk for later models. A frozen test split whose answers are held back is a different design (Phase 3 decision).
4. **Everyday, non-exam content.** Existing MCQs follow school curricula. Food, customs, daily life and local usage are only thinly covered by exam material.
5. **Human preference data and a live product.** None of the surveyed resources ships a blind arena, a public leaderboard that stays up to date, or a chat channel people actually use.
6. **Cost and latency next to accuracy.** Not reported in the surveyed papers.

## 3. "What we add" statement (draft)

> Urdu-Bench is a small, original, contamination-resistant benchmark focused on what existing Urdu benchmarks leave out: Roman Urdu understanding with explicit spelling-variation analysis, paired Urdu/English parity measurement, and everyday local knowledge written from scratch rather than taken from exams. It is paired with a live leaderboard, a blind model arena that collects human preference, and a WhatsApp quiz, and reports cost and latency alongside accuracy.

## 4. Consequences for the plan (decisions for the project owner)

- **Positioning:** claim depth and novelty (T2, T4, original T3), not coverage. Do not describe Urdu-Bench as "the first Urdu benchmark".
- **T3:** items must be original, written from everyday knowledge, not copied or paraphrased from exam banks. Overlap with UrduMMLU topics is acceptable; overlap with its items is not. Phase 3 should include a duplicate check against UrduMMLU (CC BY 4.0, usable for that purpose with attribution).
- **T1 (reading comprehension):** no reusable Urdu QA set with a clear license was found. Write original passages (the 30 samples already do) and treat UQuAD/UQA only as an optional reference after a license check.
- **T2:** do not reuse `community-datasets/roman_urdu` (unknown license, undocumented source). Write original sentences, or use sets with a clear license after verifying their provenance.
- **Optional external anchor:** report one UrduMMLU subset score per model so Urdu-Bench results can be compared with a published benchmark. This needs approval for cost.

## 5. Not verified in this pass

- Release status and licenses of UrduBench, Pak3H, UrBLiMP and UrduFactCheck data.
- UQuAD and UQA licenses.
- Whether UrduMMLU's source websites permit redistribution (relevant only if anyone wants to reuse its items; we do not).
- Roman Urdu dataset provenance for the small community sets.
