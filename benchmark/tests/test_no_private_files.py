"""Guard: private benchmark data must never be tracked by git (the repository is public)."""

import shutil
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]

FORBIDDEN_PARTS = ("candidates/", "answer_key", "review_reviewer", ".env.local")


def tracked_files() -> list[str]:
    out = subprocess.run(
        ["git", "ls-files"], cwd=REPO, capture_output=True, text=True, check=True, encoding="utf-8"
    )
    return [line.replace("\\", "/") for line in out.stdout.splitlines()]


@pytest.mark.skipif(shutil.which("git") is None or not (REPO / ".git").exists(), reason="needs a git checkout")
def test_no_private_files_are_tracked():
    bad = [f for f in tracked_files() if any(part in f for part in FORBIDDEN_PARTS)]
    assert bad == [], f"private files are tracked by git: {bad[:5]}"


@pytest.mark.skipif(shutil.which("git") is None or not (REPO / ".git").exists(), reason="needs a git checkout")
def test_only_gitkeep_is_tracked_under_data_test():
    extra = [f for f in tracked_files() if f.startswith("data/test/") and not f.endswith(".gitkeep")]
    assert extra == []
