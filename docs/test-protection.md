# How the test split is protected (decision, Phase 3)

## Decision

- **Dev split is public.** `data/dev/*.jsonl` is in the repository and will be published on Hugging Face.
- **Test split is private.** Its items and answers are never committed to git and never published. `data/test/` and `data/candidates/` are gitignored (the only tracked file under `data/test/` is `.gitkeep`).
- **Only aggregates are public for test.** `urdubench report --split test` writes `leaderboard.json` only. Per-item outputs and correctness are never exported for the test split (enforced in code and tested).
- **Maintainers run the models.** There is no submission server. Anyone who wants a model on the leaderboard asks a maintainer to run `urdubench run --split test`.
- **Frozen and verifiable.** `data/MANIFEST.json` (public) holds the dataset version, item counts, and one SHA-256 per task over all of that task's items. `urdubench run --split test` refuses to run unless the private files match the manifest, so a silent edit cannot change published scores. Per-item hashes are deliberately not published, because a 4-option item could be brute-forced from its question and its hash.
- **Canary string.** The dataset card carries a canary GUID so that training-data filters and later audits can detect leakage.

## Where the private files should live

Right now the only copy of the candidates is on the maintainer's computer. Before volunteers or collaborators are involved:

1. Create a **private** repository (GitHub private or a private Hugging Face dataset) for `data/test/` only. Do not use the public repository.
2. Keep an offline backup of the files. A lost test set cannot be recreated identically.
3. Share reviewer sheets individually (one sheet per reviewer, never the answer key).

## Known weaknesses (be honest in the write-up)

- **Provider logging.** Running a closed model sends test prompts to its provider. Some providers may retain or train on API inputs unless the account terms say otherwise. Check each provider's data terms before the full run, and note which models were run under no-training terms.
- **Reviewer leakage.** Reviewers see the questions (not the key). They must agree not to publish or reuse them.
- **Finite lifetime.** A test split loses value once it leaks or models improve. Plan: after the first full benchmark round, release that test split as part of the open dev data of the next dataset version and write a new test split.
- **Single author family.** See the dataset card: items were drafted by one model family.

## Options considered

| Option | Verdict |
|---|---|
| Public test set with answers | Rejected: leaks into training data quickly |
| Public questions, private answers on a server | Rejected for now: needs a hosted service (cost, abuse handling) |
| Private test files, maintainers run models, public aggregates + checksum manifest | **Chosen** |
| Encrypted test files committed to the public repo | Rejected: key management is hard and a single leak exposes everything |
