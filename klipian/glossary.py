"""Term glossary.

Solves the most common issues in Indonesian language transcription: proper
names, brand names, and technical terms that the model mishears. Used twice
in a pipeline:

1. As `initial_prompt` to Whisper -- the model is "primed" with terms that
   will appear, making it more likely to transcribe them correctly.
2. As find-replace corrections after transcription, for terms that still
   slip through.

File format (prompts/glossary.txt):

    # lines starting with # are comments
    Pegadaian                 <- term, included in initial_prompt
    LoadRunner
    pegadean => Pegadaian     <- fix, misspelling on the left, correct on the right
"""

from __future__ import annotations

import re
from pathlib import Path


def _bounded(word: str) -> str:
    r"""Wrap \b only on sides that are word characters.

    Without this, entries like "c++" become \bc\+\+\b -- and the \b after "+"
    requires a word character after it, so the fix never actually matches
    and nobody gets notified.
    """
    left = r"\b" if word[:1].isalnum() or word[:1] == "_" else ""
    right = r"\b" if word[-1:].isalnum() or word[-1:] == "_" else ""
    return left + re.escape(word) + right


class Glossary:
    def __init__(self, terms: list[str] | None = None,
                 fixes: list[tuple[str, str]] | None = None):
        self.terms = terms or []
        self.fixes = fixes or []
        # Pattern and mapping are built once here, not on every apply().
        # apply() is called once per word: a 40-minute podcast means thousands
        # of rebuilds of a pattern that never changes content.
        # Sorted by LONGEST first: regex alternation is leftmost-first,
        # so "c" before "c++" would shadow "c++". Longer patterns must be
        # tried first so the longest match wins.
        sorted_fixes = sorted(self.fixes, key=lambda wr: len(wr[0]), reverse=True)
        self._pattern = re.compile(
            "|".join(_bounded(w) for w, _ in sorted_fixes), re.IGNORECASE
        ) if self.fixes else None
        self._mapping = {w.lower(): r for w, r in self.fixes}

    def __bool__(self) -> bool:
        return bool(self.terms or self.fixes)

    @classmethod
    def load(cls, path: Path | None) -> "Glossary":
        if not path:
            return cls()
        path = Path(path)
        if not path.exists():
            return cls()

        terms: list[str] = []
        fixes: list[tuple[str, str]] = []
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if "=>" in line:
                wrong, _, right = line.partition("=>")
                wrong, right = wrong.strip(), right.strip()
                if wrong and right:
                    fixes.append((wrong, right))
                    if right not in terms:
                        terms.append(right)
            else:
                terms.append(line)
        return cls(terms, fixes)

    def initial_prompt(self, language: str = "id") -> str | None:
        """Opening sentence for Whisper. Written naturally, not as a rigid list --
        the model responds better to sentence-shaped context."""
        if not self.terms:
            return None
        joined = ", ".join(self.terms)
        if language == "id":
            return f"Percakapan ini menyebut istilah dan nama berikut: {joined}."
        return f"This conversation mentions the following terms and names: {joined}."

    def hotwords(self) -> str | None:
        """Term list for faster-whisper's `hotwords` parameter.

        Unlike initial_prompt which only affects the first window, hotwords
        are re-injected every 30-second window -- so terms stay recognized
        until the end of the podcast, not just the opening minutes.
        """
        return ", ".join(self.terms) if self.terms else None

    def apply(self, text: str) -> str:
        """Find-replace correction, case-insensitive but preserving word boundaries.

        All fixes are applied in a single pass to avoid cascading
        (fix 1 producing text that then triggers fix 2).
        """
        if not self._pattern:
            return text
        # Single combined regex (built in __init__): \bpegadean\b|\bloadrunner\b|...
        # re.sub with a callable replaces based on match order in text,
        # not list order -- so there is no cascading.
        def _swap(m: re.Match) -> str:
            return self._mapping[m.group(0).lower()]

        return self._pattern.sub(_swap, text)
