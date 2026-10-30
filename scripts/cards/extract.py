"""Step 1 of 3. Reads the card PDFs (one page per card) and writes decks.json, the raw text blocks of every page.

    python3 -m venv v && v/bin/pip install pymupdf
    v/bin/python scripts/cards/extract.py "/path/to/All Games" decks.json

Run this only when the PDFs change, and keep decks.json out of the repo: the card text lives in D1 (migration 0042), which is
the source once it is applied. A new batch of cards goes in as a new migration made by seed.py, never as a file in the Worker.
"""
import glob, json, os, re, sys
import pymupdf

base = os.path.expanduser(sys.argv[1])
out = {}
for f in sorted(glob.glob(base + "/*/*.pdf")):
    rel = f.replace(base + "/", "")
    if rel.endswith("Box.pdf"):
        continue
    pages = []
    for p in pymupdf.open(f):
        blocks = []
        for b in sorted(p.get_text("blocks"), key=lambda b: (round(b[1] / 20), b[0])):
            t = re.sub(r"\s*\n\s*", " ", b[4]).strip()
            if not t or re.search(r"fyndf?low\.com", t, re.I) or re.fullmatch(r"\d{1,3}", t):
                continue
            blocks.append(t)
        pages.append(blocks)
    out[rel] = pages
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
