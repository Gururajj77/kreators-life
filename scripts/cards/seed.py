"""Step 3 of 3. Turns the cards JSON (from build.py) into a D1 migration that holds the card text.

    python3 scripts/cards/seed.py cards.json apps/api/migrations/0042_card_content.sql

Once a migration is applied, D1 is the source of the text: edit the rows (or write a new migration), not this file.
"""
import json, sys

data = json.load(open(sys.argv[1]))
q = lambda s: "NULL" if s is None else "'" + str(s).replace("'", "''") + "'"
out = [
    "-- The card text for the card games. It is the sensitive part of the catalog, so it lives in D1 and is served only to a person who unlocked",
    "-- the game (or to the team). Names, prices and pictures are public and stay in code (CARD_GAMES in shared). Seeded once from the founder's print files.",
    "CREATE TABLE card_games (game_key TEXT PRIMARY KEY, how_to TEXT NOT NULL, special_json TEXT, special_note TEXT, rules_json TEXT);",
    "CREATE TABLE card_decks (game_key TEXT NOT NULL, deck_key TEXT NOT NULL, name TEXT NOT NULL, hint TEXT, position INTEGER NOT NULL, PRIMARY KEY (game_key, deck_key));",
    "CREATE TABLE cards (game_key TEXT NOT NULL, deck_key TEXT NOT NULL, position INTEGER NOT NULL, title TEXT, label TEXT, text TEXT NOT NULL, list_json TEXT, alt_label TEXT, alt_text TEXT, PRIMARY KEY (game_key, deck_key, position));",
    "",
]
for gk, g in data.items():
    j = lambda v: None if v is None else json.dumps(v, ensure_ascii=False)
    out.append(f"INSERT INTO card_games (game_key, how_to, special_json, special_note, rules_json) VALUES ({q(gk)}, {q(g['howTo'])}, {q(j(g.get('special')))}, {q(g.get('specialNote'))}, {q(j(g.get('rules')))});")
    for dp, d in enumerate(g["decks"]):
        out.append(f"INSERT INTO card_decks (game_key, deck_key, name, hint, position) VALUES ({q(gk)}, {q(d['key'])}, {q(d['name'])}, {q(d.get('hint'))}, {dp});")
        rows = []
        for cp, c in enumerate(d["cards"]):
            alt = c.get("alt") or {}
            rows.append(f"({q(gk)}, {q(d['key'])}, {cp}, {q(c.get('title'))}, {q(c.get('label'))}, {q(c.get('text', ''))}, {q(j(c.get('list')))}, {q(alt.get('label'))}, {q(alt.get('text'))})")
        for i in range(0, len(rows), 25):
            out.append("INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES\n  " + ",\n  ".join(rows[i : i + 25]) + ";")
open(sys.argv[2], "w").write("\n".join(out) + "\n")
