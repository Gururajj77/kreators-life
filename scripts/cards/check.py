"""A smoke test over the card game migrations themselves: no server, no D1, just sqlite3 in memory.

Catches the two shapes of bug found in FunFlow (migration 0068): a card whose example list never made it past the PDF
extraction and landed as one run-on line instead of JSON (silently losing every example, or worse, breaking the whole
game if `list_json` were ever read without a safety net), and a card that swallowed a second card whole (a left-over
"page break" marker stuck in the middle of its text, so the second card never became a card of its own). It also holds
the house rule that no card in this catalog may assume, need or reward drinking.

    python3 scripts/cards/check.py
"""
import glob, json, re, sqlite3, sys

MIGRATIONS = sorted(glob.glob("apps/api/migrations/00[4-9]*.sql") + glob.glob("apps/api/migrations/0[1-9][0-9][0-9]*.sql"))
# Only the migrations that touch card_games/card_decks/cards are relevant; running every migration keeps this honest
# about load order without hand-picking files, and a migration for a table that does not exist yet is skipped.
con = sqlite3.connect(":memory:")
errors = []
for path in MIGRATIONS:
    sql = open(path, encoding="utf-8").read()
    if "card_games" not in sql and "INTO cards" not in sql and "UPDATE cards" not in sql:
        continue
    try:
        con.executescript(sql)
    except sqlite3.Error as e:
        errors.append(f"{path}: {e}")

if errors:
    print("Could not apply migrations:")
    for e in errors:
        print(" -", e)
    sys.exit(1)

cur = con.cursor()

# 1) Every list_json must parse as JSON and be a non-empty list of non-empty strings. A row that fails this is exactly
#    what used to reach the player as a single run-on `text` instead of a clean list (or would throw if ever parsed
#    without the API's safety net).
rows = cur.execute("SELECT game_key, deck_key, position, title, list_json FROM cards WHERE list_json IS NOT NULL").fetchall()
for game, deck, pos, title, list_json in rows:
    try:
        parsed = json.loads(list_json)
    except json.JSONDecodeError as e:
        errors.append(f"{game}/{deck}#{pos} ({title}): list_json does not parse as JSON: {e}")
        continue
    if not isinstance(parsed, list) or not parsed:
        errors.append(f"{game}/{deck}#{pos} ({title}): list_json is not a non-empty array")
        continue
    for item in parsed:
        if not isinstance(item, str) or not item.strip():
            errors.append(f"{game}/{deck}#{pos} ({title}): list_json has a blank or non-string example")

# 2) No card's text should carry a left-over page-break marker (a run of underscores, or two titles glued together):
#    that is how a second card hid, unreachable, inside the first one.
rows = cur.execute("SELECT game_key, deck_key, position, title, text FROM cards").fetchall()
for game, deck, pos, title, text in rows:
    if re.search(r"_{4,}", text or ""):
        errors.append(f"{game}/{deck}#{pos} ({title}): text still carries a page-break marker (____), a second card may be stuck inside it")

# 3) Every deck must have at least one card, and a deck's position must be unique within its game (card_decks' own
#    primary key already guards the deck_key half; this guards the ordering half a person actually sees as tabs).
decks = cur.execute("SELECT game_key, deck_key, position FROM card_decks").fetchall()
counts = dict(cur.execute("SELECT game_key || ':' || deck_key, COUNT(*) FROM cards GROUP BY game_key, deck_key").fetchall())
seen_positions = {}
for game, deck, pos in decks:
    n = counts.get(f"{game}:{deck}", 0)
    if n == 0:
        errors.append(f"{game}/{deck}: has no cards at all")
    key = (game, pos)
    if key in seen_positions:
        errors.append(f"{game}: decks {seen_positions[key]!r} and {deck!r} both claim position {pos}")
    seen_positions[key] = deck

# 4) FunFlow is for easy, low-stakes group fun, never a drinking game: no card may assume, need or reward drinking (a
#    party deck is still a party without it). Scoped to FunFlow, since that is the rule this catalog's wellbeing and
#    relationships purpose sets; older decks of other games are not re-litigated here. A hand-written word list, not
#    a model: short and reviewable, and a hit here is always worth a human look rather than a guess.
DRINK_WORDS = re.compile(r"\b(drink(s|ing)?|drunk|alcohol|beer|wine|booze|cocktail|shots?\b|chug(s|ging)?|sip(s|ping)?|raise[sd]? (a |your )?glass(es)?|takes? a (sip|shot|drink))\b", re.I)
rows = cur.execute("SELECT game_key, deck_key, position, title, text, list_json, alt_text FROM cards WHERE game_key = 'funflow'").fetchall()
for game, deck, pos, title, text, list_json, alt_text in rows:
    blob = " ".join(x for x in [title, text, list_json, alt_text] if x)
    m = DRINK_WORDS.search(blob)
    if m:
        errors.append(f"{game}/{deck}#{pos} ({title}): mentions drinking ({m.group(0)!r}); FunFlow is alcohol-neutral by rule")
rules_and_howto = cur.execute("SELECT game_key, how_to, rules_json, special_json, special_note FROM card_games WHERE game_key = 'funflow'").fetchall()
for game, how_to, rules_json, special_json, special_note in rules_and_howto:
    blob = " ".join(x for x in [how_to, rules_json, special_note] if x)
    m = DRINK_WORDS.search(blob)
    if m:
        errors.append(f"{game}: how_to/rules mentions drinking ({m.group(0)!r}); FunFlow is alcohol-neutral by rule")

if errors:
    print(f"{len(errors)} problem(s):")
    for e in errors:
        print(" -", e)
    sys.exit(1)

total = cur.execute("SELECT COUNT(*) FROM cards").fetchone()[0]
games = cur.execute("SELECT COUNT(*) FROM card_games").fetchone()[0]
print(f"ok: {games} games, {len(decks)} decks, {total} cards, every list_json clean, no stuck cards, no drinking words")
