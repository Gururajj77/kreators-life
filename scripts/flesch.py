#!/usr/bin/env python3 -I
"""Flesch reading ease for the words in a file. The app aims at 60 or above.

    python3 -I scripts/flesch.py apps/web/src/site/content.ts
    python3 -I scripts/flesch.py --strings packages/shared/src/index.ts   # only quoted strings

Without --strings the whole file is scored, which suits markdown and plain text. With it, only
the text inside single, double or backtick quotes is scored, which suits a TypeScript file."""
import re
import sys

VOWELS = re.compile(r"[aeiouy]+")


def syllables(word: str) -> int:
    w = word.lower().strip("'")
    if not w:
        return 0
    count = len(VOWELS.findall(w))
    if w.endswith("e") and not w.endswith(("le", "ee", "ye")) and count > 1:
        count -= 1
    return max(1, count)


def score(text: str) -> tuple[float, int, int]:
    sentences = [s for s in re.split(r"[.!?]+(?:\s|$)", text) if re.search(r"[A-Za-z]", s)]
    words = re.findall(r"[A-Za-z][A-Za-z']*", text)
    if not words or not sentences:
        return 0.0, 0, 0
    syl = sum(syllables(w) for w in words)
    ease = 206.835 - 1.015 * (len(words) / len(sentences)) - 84.6 * (syl / len(words))
    return round(ease, 1), len(words), len(sentences)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    strings_only = "--strings" in sys.argv
    if not args:
        print(__doc__)
        sys.exit(2)
    for path in args:
        with open(path, encoding="utf-8") as f:
            text = f.read()
        if strings_only:
            parts = re.findall(r"'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\"|`((?:[^`\\]|\\.)*)`", text)
            text = ". ".join(p for group in parts for p in group if len(p.split()) >= 3)
        ease, words, sentences = score(text)
        verdict = "ok" if ease >= 60 else "hard"
        print(f"{path}: {ease} ({words} words, {sentences} sentences) {verdict}")


if __name__ == "__main__":
    main()
