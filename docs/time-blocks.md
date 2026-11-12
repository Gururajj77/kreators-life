# Time blocks

The design for time blocks, day templates and the weekly pattern (the founder's ask of 2026-11-06). It is written so that four people can build it at once without guessing. Where this doc and CLAUDE.md disagree, CLAUDE.md wins. Rules only: there is no model and no cost, and nothing leaves the account.

## What it is, in one paragraph

A **time block** is a named stretch of the day with a tag, a colour, and optionally an area of life and a pillar. Examples are Deep work, Recovery and Sleep. A **day template** is a set of blocks laid on the clock: Deep work from 10:00 to 13:00, and so on. It also carries a lead pillar and a second pillar. A day template *is* the kind of day: "Deep work day" replaces the old "Deep work" kind, and the By context sort reads its lead and second pillar as before. The **weekly pattern** gives each weekday a template. Every day starts on the default template, "Everyday". A **single-date change** gives one date another template and leaves the pattern alone. Tasks fall into blocks in three ways. A person can pick the block in the task's form. Otherwise the task falls into the block its time sits in. Otherwise Plan my week suggests a block from the task's area of life and pillar. Daily can then group tasks into coloured boxes by time block or by area of life. The boxes can be opened and folded, and inside each one the priority comes first.

Ideas taken from align.day: a block is the one unit (name, start, end, colour); a single day can change without breaking the routine; each block's free room is shown inside it. Two things from align.day are deliberately not copied. Nothing here sits behind a paywall. Templates are not printable files; they are saved in the app and apply to real dates.

---

## 1. Data

### Migration `apps/api/migrations/0089_time_blocks.sql`

0086 to 0088 belong to another workflow, so this is 0089. Every table is owner-scoped by `user_id`. Code deletes child rows itself and never relies on the foreign key cascade alone.

```sql
-- 2026-11-06 (founder): time blocks, day templates, the weekly pattern. docs/time-blocks.md is the design.

-- A person's kinds of block (Deep work, Sleep, ...). `color` is a swatch KEY from TIME_BLOCK_SWATCHES in shared
-- (timeBlocks.ts), never a hex: CSS maps the key to a theme token. `seed` is the starting block's key when the app
-- made it (null for the person's own), so the starting set is added once and can be restored.
CREATE TABLE IF NOT EXISTS time_blocks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seed TEXT,
  name TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL,
  life_area TEXT,              -- a LIFE_AREA_ORDER key or NULL
  relationship TEXT,           -- a pillar key or NULL
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- Listing a person's blocks in their order (every read of the feature).
CREATE INDEX IF NOT EXISTS idx_time_blocks_user ON time_blocks(user_id, sort);
-- Seeding twice adds nothing: one starting block per key per person.
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_blocks_seed ON time_blocks(user_id, seed) WHERE seed IS NOT NULL;

-- Day templates: a set of slots plus the lead and second pillar the By context sort uses. `source_kind` is the old
-- DAY_TYPES key a starting template was made from (deep_work, family, ...), so an old day_types row still finds its
-- template; `why` and `source` keep that kind's line and book pages.
CREATE TABLE IF NOT EXISTS day_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seed TEXT,
  source_kind TEXT,
  name TEXT NOT NULL,
  lead TEXT NOT NULL,          -- a pillar key
  second TEXT,                 -- a pillar key or NULL
  why TEXT,
  source TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- Listing a person's templates in their order.
CREATE INDEX IF NOT EXISTS idx_day_templates_user ON day_templates(user_id, sort);
-- Seeding twice adds nothing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_day_templates_seed ON day_templates(user_id, seed) WHERE seed IS NOT NULL;
-- Exactly one default per person can exist; making another the default clears this one first, in the same batch.
CREATE UNIQUE INDEX IF NOT EXISTS idx_day_templates_default ON day_templates(user_id) WHERE is_default = 1;

-- A template's slots: a block from start_min to end_min (minutes after midnight, 0..1439). end_min < start_min
-- wraps past midnight (Sleep 23:00 to 07:00 is 1380 -> 420); end_min = 0 means "to midnight". Never equal.
CREATE TABLE IF NOT EXISTS day_template_slots (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES day_templates(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  block_id TEXT NOT NULL REFERENCES time_blocks(id) ON DELETE CASCADE,
  start_min INTEGER NOT NULL CHECK (start_min BETWEEN 0 AND 1439),
  end_min INTEGER NOT NULL CHECK (end_min BETWEEN 0 AND 1439 AND end_min <> start_min)
);
-- A template's slots in clock order (every resolved day).
CREATE INDEX IF NOT EXISTS idx_day_template_slots_tpl ON day_template_slots(template_id, start_min);
-- Deleting a block removes its slots, and the delete sheet counts the templates it leaves.
CREATE INDEX IF NOT EXISTS idx_day_template_slots_block ON day_template_slots(block_id);
-- The account delete and the export read by person.
CREATE INDEX IF NOT EXISTS idx_day_template_slots_user ON day_template_slots(user_id);

-- The weekly pattern: weekday 1 (Monday) .. 7 (Sunday) -> a template. No row means the default template.
CREATE TABLE IF NOT EXISTS week_patterns (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  template_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, weekday)
);

-- Single-date changes reuse day_types (0077). A new row carries template_id; `kind` stays NOT NULL and is written as the
-- template's source_kind, or 'template' for one with none. An old row (template_id NULL) finds its template by
-- source_kind = kind. A date row never changes the pattern.
ALTER TABLE day_types ADD COLUMN template_id TEXT;

-- The block a person picked for a task (NULL: by its time, or none).
ALTER TABLE nodes ADD COLUMN time_block_id TEXT;
-- Clearing a deleted block from tasks, and the `?block=` cut on GET /today.
CREATE INDEX IF NOT EXISTS idx_nodes_user_block ON nodes(user_id, time_block_id) WHERE time_block_id IS NOT NULL;

-- When the starting blocks and templates were added for this person (once; NULL until the first read; since 2026-11-07, until the first change).
ALTER TABLE users ADD COLUMN time_blocks_seeded_at TEXT;
```

### Export, delete, erase

- **Export** (`routes/me.ts`, the `[name, SQL]` list). Add `timeBlocks` (`time_blocks`), `dayTemplates` (`day_templates`), `dayTemplateSlots` (`day_template_slots`) and `weekPattern` (`week_patterns`), each `WHERE user_id = ?`. `dayTypes` is already there and now carries `template_id`. `nodes` already exports `time_block_id`, because it uses `SELECT *`; the builder checks this.
- **Delete** (`deleteAccount` in `apps/api/src/account.ts`). Add `DELETE FROM day_template_slots WHERE user_id = ?`, `week_patterns`, `day_templates` and `time_blocks`, in that order, beside the `day_types` line. Re-read the file before editing, because other workflows touch it.
- **Erase** (`POST /me/reset`) leaves blocks, templates, the pattern and date changes alone. They are settings, not progress, the same as `day_types` and the focus settings today. The tasks go, and their `time_block_id` goes with them.

---

## 2. Defaults

### The swatches

**Changed 2026-11-06 (the founder's colour wheel):** the picker is eleven colours round the wheel he gave, from amber clockwise (`TIME_BLOCK_SWATCHES`: amber, orange, vermilion, red, magenta, purple, indigo, blue, teal, green, lime; tokens `--wheel-*` in app.css; yellow was dropped at his ask and still renders), then a twelfth round button, your own colour: a white pipette that opens a small card just under it (`.tb-own-card`, not a dialog; a preview dot, one `FIELD_LINE` field with the example in its quiet line, an `IconButton` tick and a `CloseButton`; Enter, Escape and a tap outside work) to type a hex code or a colour name the browser knows (read to `#rrggbb` through a canvas), after which the button wears that colour and tapping it again does the same. A block's `color` is a `BlockColor`: a swatch key or a lower-case `#rrggbb` (`blockColorOf` and `hexColorOf` in shared are the one reader; anything else is refused). A hex is the person's own data, set inline as `--tb` (`tbClass` and `tbStyle` in `lib/blockColor.ts`). The older keys (yellow, sky, earth, gold, violet, silver, slate) still render and show in the own-colour button, but are no longer offered. The table below is the first version:

`TIME_BLOCK_SWATCHES` held 14 keys. Each maps to an existing token in app.css; no new colour is made:

| key | token | ink on the solid dot |
|---|---|---|
| red | `--color-r1` | white |
| orange | `--color-r2` | dark |
| yellow | `--color-r3` | dark |
| green | `--color-r4` | white |
| sky | `--color-r5` | white |
| indigo | `--color-r6` | white |
| purple | `--color-r7` | white |
| earth | `--color-earth` | white |
| blue | `--color-scale-blue` | white |
| gold | `--color-scale-gold` | dark |
| lime | `--color-scale-lime` | dark |
| violet | `--color-scale-violet` | white |
| silver | `--color-scale-silver` | dark |
| slate | `--color-ink-soft` | follows the theme |

### The starting blocks

The founder's ten come first, then Travel, then three blocks that only the starting templates use. The `seed` key is fixed.

| seed | name | tag | colour | area | pillar | slot in Everyday |
|---|---|---|---|---|---|---|
| hygiene | Morning hygiene | Self care | lime | physical | self | 07:00–08:00 |
| routine | Morning routine | Self care | purple | spiritual | divine | 08:00–10:00 |
| deep | Deep work | Focus | red | financial | servant_leader | 10:00–13:00 |
| recovery | Recovery | Recovery | green | physical | self | 13:00–15:00 |
| busy | Busy work | Admin | blue | financial | servant_leader | 15:00–17:00 |
| social | Fun/social | Social | orange | emotional | friendship | 17:00–19:00 |
| fun | Entertainment | Fun | gold | emotional | (none) | 19:00–21:00 |
| learn | Learn/explore | Growth | indigo | mental | guru | 21:00–22:00 |
| selflove | Self love | Self care | violet | emotional | self | 22:00–23:00 |
| sleep | Sleep | Recovery | slate | physical | self | 23:00–07:00 (8 hours) |
| travel | Travel | Travel | earth | (none) | (none) | none (used by Travel day) |
| family | Family time | Social | yellow | emotional | parent_child | none |
| date | Date | Social | green | emotional | lover_partner | none |
| reflect | Reflection | Self care | silver | mental | self | none |
| shoot | Shoot | Focus | amber | financial | servant_leader | none (Shoot day; added 2026-11-12) |
| edit | Edit | Focus | red | financial | servant_leader | none (Edit day) |
| plan | Plan and prep | Admin | blue | financial | servant_leader | none (Shoot day, Plan and post day) |
| post | Post | Social | teal | financial | servant_leader | none (Plan and post day) |

Why the areas and pillars are set this way:
- Hygiene, Recovery and Sleep are about the body, so they are physical and Yourself. The founder said Sleep's tag is Recovery.
- Morning routine holds the strategy session's practices (mantra, breathing, reading), which Lumen hosts, so it is spiritual and Faith.
- Deep work and Busy work are output and money, so they are financial and Servitude. The tags keep them apart: Focus and Admin. The suggestion rule below uses that difference.
- Fun/social is friends, so it is emotional and Friends.
- Entertainment is how you feel, with no one relationship behind it, so it has an area and no pillar.
- Learn/explore is learning, so it is mental and Teachers.
- Self love is emotional and Yourself.
- Travel has neither an area nor a pillar.
- Colours follow the pillar's own colour where that helps (Servitude red, Friends orange, Teachers indigo, Faith purple). Otherwise every block gets a different swatch. Only Recovery and Date share green, because there are fourteen blocks and fourteen swatches minus the one Travel takes. Recovery and Date both mean rest from work, and a person can change either. The four content blocks of 2026-11-12 take the colours of the work they are closest to: Edit red like Deep work, Shoot amber, Plan and prep blue like Busy work, Post teal.

### The starting templates

These are 17 templates (14 until 2026-11-12, when the three content days came), each labelled in the UI as a starting point the person can change. `source_kind` ties each one to an old `DAY_TYPES` kind. Each one's `lead`, `second`, `why` and `source` are copied from that kind word for word. Each template's slots never overlap. Gaps are allowed and show as free time.

| seed | name | source_kind | lead / second | slots |
|---|---|---|---|---|
| everyday | **Everyday** (is_default) | none | servant_leader / self; why "Work gets your best hours; your own care holds the rest."; source "The founder's own day" | the founder's ten, exactly as in the table above |
| deep | Deep work day | deep_work | from DAY_TYPES | hygiene 07–08, routine 08–09, deep 09–13, recovery 13–14, deep 14–16, busy 16–17, social 17–19, fun 19–21, learn 21–22, selflove 22–23, sleep 23–07 |
| create | Create day | create | from DAY_TYPES | Everyday, but deep 15–17 instead of busy |
| learning | Learning day | learning | from DAY_TYPES | hygiene 07–08, routine 08–10, learn 10–13, recovery 13–15, busy 15–17, social 17–19, fun 19–21, learn 21–22, selflove 22–23, sleep 23–07 |
| money | Money day | money | from DAY_TYPES | Everyday, but busy 10–11 and deep 11–13 |
| admin | Admin day | admin | from DAY_TYPES | Everyday, but busy 10–13 |
| family | Family day | family | from DAY_TYPES | hygiene 07–08, routine 08–09, family 09–13, recovery 13–15, family 15–19, fun 19–21, learn 21–22, selflove 22–23, sleep 23–07 |
| recovery | Recovery day | rest | from DAY_TYPES | sleep 22–08, hygiene 08–09, routine 09–10, recovery 10–13, social 13–15, recovery 15–18, fun 18–20, selflove 20–22 |
| social | Social day | friends | from DAY_TYPES | hygiene 07–08, routine 08–10, busy 10–12, recovery 12–14, social 14–22, selflove 22–23, sleep 23–07 |
| date | Date day | date | from DAY_TYPES | hygiene 07–08, routine 08–10, deep 10–13, recovery 13–15, busy 15–17, selflove 17–18, date 18–22, selflove 22–23, sleep 23–07 |
| reflection | Reflection day | reset | from DAY_TYPES | hygiene 07–08, routine 08–10, reflect 10–12, busy 12–13, recovery 13–15, learn 15–17, social 17–19, fun 19–21, reflect 21–22, selflove 22–23, sleep 23–07 |
| lowenergy | Low energy day | low_energy | from DAY_TYPES | sleep 22–08, hygiene 08–09, routine 09–10, deep 10–11, recovery 11–15, busy 15–16, social 16–18, fun 18–20, selflove 20–22 |
| selflove | Self love day | none | self / divine; why "Your own tasks come first. Fill the day with what refills you."; source "The app's own" | hygiene 07–08, routine 08–10, selflove 10–13, recovery 13–15, learn 15–17, social 17–19, fun 19–21, selflove 21–23, sleep 23–07 |
| travel | Travel day | none | self / friendship; why "Your own tasks come first. Keep the day light around the journey."; source "The app's own" | hygiene 06–07, travel 07–12, recovery 12–14, travel 14–18, social 18–20, selflove 20–22, sleep 22–06 |
| editday | Edit day | none | self / servant_leader, the Create kind's pillars; why "Your own craft comes first. Edit on a different day from the one you publish."; source the Create kind's pages | hygiene 07–08, routine 08–09, edit 09–13, recovery 13–14, edit 14–16, busy 16–17, social 17–19, fun 19–21, learn 21–22, selflove 22–23, sleep 23–07 |
| shootday | Shoot day | none | as Edit day; why "Your own craft comes first. Make it today, and publish it on a different day." | hygiene 07–08, plan 08–10, shoot 10–13, recovery 13–14, shoot 14–16, busy 16–17, reflect 17–18, social 18–19, fun 19–21, learn 21–22, selflove 22–23, sleep 23–07 |
| postday | Plan and post day | none | as Edit day; why "Your own craft comes first. Publish today, never what you made today." | hygiene 07–08, routine 08–09, plan 09–12, recovery 12–14, post 14–16, busy 16–17, social 17–19, fun 19–21, learn 21–22, selflove 22–23, sleep 23–07 |

All 11 book kinds are covered. Each template's `sort` is its place in this table.

### A kind's colour

**Added 2026-11-06 (the founder's choice, "Own colour per template"):** each day template wears its own colour, so the kinds of day are told apart wherever they are drawn. It is picked in the template's form (`TemplateEditor`, the field Colour after the two pillars and above Slots) with the block form's own picker (`components/timeblocks/SwatchPicker.tsx`: the eleven wheel colours and your own colour, a hex or a colour name) and saved on the template: `day_templates.color` (migration `0098_day_template_color.sql`, nullable), a `BlockColor` read through `blockColorOf` (a swatch key, or a person's own lower-case `#rrggbb`; anything else is refused by `dayTemplateProblem` with the block form's words). `POST /time-blocks/templates` and `PATCH /time-blocks/templates/:id` take `color` (null goes back to none); a new template sent no colour takes the first wheel colour none of the person's templates wears yet, else a copy keeps its source's. Every read returns `color` on `DayTemplate`, and the export already carries the column (`SELECT *`).

`templateColor` in `dayKinds.ts` is the one rule: the template's own colour first; only with none (null), the colour of its longest block over the day, leaving out the slots that cross midnight. Every kinds-of-day view uses it: Emerging's "Your kinds of day" strip and rows, the month calendar's dot beside the date, the Time blocks page's This month line, the week strip and the template list (a dot beside the name), the day's Kind of day select there, Daily's Kind of day select (the stored colour), and the Reviews tile.

The starting colours: no two kinds alike where the wheel allows. Fourteen templates over eleven colours meant three share (since 2026-11-12, seventeen and six pairs: the three content days take Deep work day's red, Family day's amber and Social day's orange, each the one it is least likely to be mistaken for on the same week), and the pairs are the ones least likely to be mistaken for each other:

| template | colour | shares with |
|---|---|---|
| Everyday | indigo | Low energy day: Everyday is the default and is never drawn as a kind (strip, calendar dots, This month, Reviews); a low energy day is picked rarely, on the day itself |
| Deep work day | red | |
| Create day | vermilion | Travel day: the rarest kind, which keeps its Travel block's colour |
| Learning day | teal | |
| Money day | lime | Self love day: two days far apart in meaning, so the name never reads as the other |
| Admin day | blue | |
| Family day | amber | |
| Recovery day | green | |
| Social day | orange | |
| Date day | magenta | |
| Reflection day | purple | |
| Low energy day | indigo | Everyday |
| Self love day | lime | Money day |
| Travel day | vermilion | Create day |
| Edit day | red | Deep work day: both are a day of focused making (2026-11-12) |
| Shoot day | amber | Family day: a day out with the kit against a day with family |
| Plan and post day | orange | Social day: both face other people |

The migration gives every existing starting template its colour by `seed`, then a template made from an old kind without a seed by `source_kind`; anything else stays null and keeps the longest-block colour. A shared test checks that every wheel colour is used, that only these pairs share (six since 2026-11-12), and that the migration's lines match `STARTING_TEMPLATES`.

### How the starting set is created

The starting set lives in code (`STARTING_BLOCKS`, `STARTING_TEMPLATES`) until the person's first change to a block or a template (2026-11-07, the founder's yes: 769 of the 1,076 rows a sign-up wrote were these). The fixed ids are the same in code and in rows:
- a block is `b-<seed>-<userId>`;
- a template is `t-<seed>-<userId>`;
- a slot is `<templateId>-<index>`, and exists only as a row.

Ids that a person makes are `crypto.randomUUID()`.

**Reading.** `users.time_blocks_seeded_at` empty means code, set means rows. `loadBlocking` reads it in its own batch and answers from `startingSet(userId)` when it is empty, through the same `toTimeBlock` and `toDayTemplate`, so the answer is the same byte for byte. `blockIdByName`, `templateIdByName`, `ownBlockId`, `ownTemplateId` and the route file's `ownBlock`, `ownTemplate` and `blockNames` do the same. A new read of these tables must too. `GET /insights` takes it from the session's row.

**A seed stays.** Everyone with no rows reads the starting set from code, so a change to `STARTING_BLOCKS` or `STARTING_TEMPLATES` changes their days the moment it deploys, and a person with rows keeps what they have. Never take a seed away or give it another meaning: tasks, dates and weekdays of people with no rows name it by id, and the row would be gone with no delete to clear them (a shared test holds the keys). A change of words or slots is a choice to make on purpose.

**What needs no rows.** A task's `time_block_id`, a `day_types` row and a `week_patterns` row each hold only an id, so `POST` and `PATCH /nodes`, `PUT /time-blocks/days`, `PUT /time-blocks/pattern` and `PUT /today/day-type` write only their own row.

**The first change.** `ensureTimeBlocks(db, user)` in `apps/api/src/timeBlocks.ts` is called just before the write, after every check, by the seven routes that change a block or a template (`POST`, `PATCH` and `DELETE` of each, and `PUT /blocks/order`). A refused request writes nothing.
- If `user.time_blocks_seeded_at` is set, it does nothing. The session's user row is already loaded, so this costs no read.
- Otherwise it runs one batch: `UPDATE users SET time_blocks_seeded_at = <a stamp no other batch holds> WHERE id = ? AND time_blocks_seeded_at IS NULL`, then every block, every template and every slot, each `INSERT OR IGNORE` and each only `WHERE` that stamp is the one on the account.
- So a tab that read the account before another tab's first change adds nothing, and a template deleted in between stays deleted.
- A slot written after that (`slotInsert` outside a claim) is left out when another tab deleted its block or template since the check, so a copy racing a delete keeps the slots it can and never answers 500. A `PATCH` of something deleted in that moment answers 404.

The most a person may keep counts the starting ones, rows or not. An erase of progress touches neither. With no rows the export has empty lists and `timeBlocksNote` saying why, since a day or a task can name a starting id.

`POST /time-blocks/restore` adds nothing for someone with no rows, since nothing can be missing. Otherwise it adds back any starting block or template whose seed the person no longer has. It reads which seeds exist, then inserts only the missing ones and their slots. It never touches a template that still exists, and it adds no week pattern rows.

---

## 3. Shared: `packages/shared/src/timeBlocks.ts`

A new file with a line in the barrel after `dayTypes.ts`: `export * from './timeBlocks.ts';`. It imports `DAY_TYPES` and `dayTypeOf` from `./dayTypes.ts`, `LIFE_AREA_ORDER` from `./life.ts`, `Priority` from `./tasks.ts` and `RelationshipKey` from `./core.ts`. It needs no new top-level call to a function defined later in the file. After the edit, `node --experimental-strip-types -e "import('./packages/shared/src/index.ts')"` must load.

```ts
// Limits
export const MAX_TIME_BLOCKS = 24;
export const MAX_DAY_TEMPLATES = 24;
export const MAX_TEMPLATE_SLOTS = 24;
export const BLOCK_NAME_MAX = 40;
export const BLOCK_TAG_MAX = 24;
export const TEMPLATE_NAME_MAX = 40;
export const MAX_APPLY_DATES = 31;
/** Tags offered as suggestions in the tag field (a person may type any other). */
export const TIME_BLOCK_TAGS = ['Focus', 'Admin', 'Self care', 'Recovery', 'Social', 'Fun', 'Growth', 'Travel'] as const;
/** The tag the suggestion rule and Plan my week treat as "deep work-like". Matched case-insensitively. */
export const FOCUS_TAG = 'Focus';

// Swatches
export const TIME_BLOCK_SWATCHES = ['red','orange','yellow','green','sky','indigo','purple','earth','blue','gold','lime','violet','silver','slate'] as const;
export type SwatchKey = (typeof TIME_BLOCK_SWATCHES)[number];
export const SWATCH_META: Record<SwatchKey, { name: string; darkInk: boolean }>; // name for aria-label: "Red", "Slate"...
export function isSwatch(v: unknown): v is SwatchKey;

// Types
export interface TimeBlock { id: string; seed: string | null; name: string; tag: string; color: SwatchKey; area: LifeAreaKey | null; pillar: RelationshipKey | null; sort: number }
export interface TemplateSlot { blockId: string; start: number; end: number }       // minutes, 0..1439, end may be < start (wraps)
export interface DayTemplate { id: string; seed: string | null; sourceKind: DayTypeKey | null; name: string; lead: RelationshipKey; second: RelationshipKey | null; why: string | null; source: string | null; isDefault: boolean; sort: number; slots: TemplateSlot[] }
export type DayFrom = 'date' | 'week' | 'default';
export interface ResolvedDay { date: string; weekday: number; templateId: string; from: DayFrom }
export interface TimeBlocksResponse {
  week: string;                       // the Monday asked about
  days: ResolvedDay[];                // seven, Monday first
  blocks: TimeBlock[];
  templates: DayTemplate[];           // with slots, in sort order
  defaultTemplateId: string;
  pattern: (string | null)[];         // seven entries, Monday first; null = the default
  overrides: { date: string; templateId: string }[];  // the date changes inside this week
}
/** The day's plan, on GET /today and inside the week plan. */
export interface DayPlan {
  date: string;
  template: { id: string; name: string; lead: RelationshipKey; second: RelationshipKey | null; why: string | null; source: string | null };
  from: DayFrom;
  slots: TemplateSlot[];              // clock order (slotOrder)
  blocks: TimeBlock[];                // every block of the person's, so a task picked into one not in today's plan can be named
}

// Starting set (data only)
export interface StartingBlock { seed: string; name: string; tag: string; color: SwatchKey; area: LifeAreaKey | null; pillar: RelationshipKey | null }
export interface StartingTemplate { seed: string; name: string; sourceKind: DayTypeKey | null; lead: RelationshipKey; second: RelationshipKey | null; why: string; source: string; isDefault: boolean; slots: { block: string; start: string; end: string }[] }
export const STARTING_BLOCKS: readonly StartingBlock[];
export const STARTING_TEMPLATES: readonly StartingTemplate[];   // lead/second/why/source of a book kind come from dayTypeOf(sourceKind)
export function startingTemplateFor(kind: DayTypeKey): StartingTemplate;  // every DAY_TYPE_KEYS has one (tested)

// Time
export function minuteOf(hhmm: unknown): number | null;     // strict /^([01]\d|2[0-3]):[0-5]\d$/ -> 0..1439
export function hhmm(min: number): string;                  // 0..1439 -> "07:00"
export function minuteLabel(min: number): string;           // "7:00 am" with LOCALE (a UTC Date, so no zone)
export function slotLength(s: { start: number; end: number }): number;  // wraps: (end - start + 1440) % 1440, end 0 = midnight
export function slotContains(s: { start: number; end: number }, minute: number): boolean; // [start, end), wrapping
export function slotsOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean;
export function slotOrder(slots: TemplateSlot[]): TemplateSlot[];  // by start ascending (a wrapping Sleep at 23:00 sorts last)
export function slotRangeLabel(s: { start: number; end: number }): string; // "10:00 am to 1:00 pm"

// Validation (the only readers of what a request sends)
export function timeBlockProblem(body: unknown, partial: boolean): string | null;
//   name 1..BLOCK_NAME_MAX after trim; tag 0..BLOCK_TAG_MAX; color isSwatch; area via lifeAreaProblem; pillar a RELATIONSHIPS key or null.
export function parseTimeBlockBody(body: unknown): Partial<Omit<TimeBlock, 'id' | 'seed' | 'sort'>>;
export function parseSlots(raw: unknown, blockIds: ReadonlySet<string>): { slots: TemplateSlot[] } | { problem: string };
//   raw: [{ blockId, start: "HH:MM", end: "HH:MM" }]; at most MAX_TEMPLATE_SLOTS; start !== end; a blockId the person owns;
//   no two overlap; the problem names both, e.g. "Deep work 10:00 am to 1:00 pm overlaps Recovery 12:00 pm to 3:00 pm".
//   (The names come from a second argument map when given: parseSlots(raw, blockIds, names?).) Returns slotOrder(slots).
export function dayTemplateProblem(body: unknown, partial: boolean): string | null;
//   name 1..TEMPLATE_NAME_MAX; lead a pillar key (required on create); second a pillar key or null and not equal to lead.

// Dates
export function weekdayOf(date: string): number;            // 1 Monday .. 7 Sunday, from the calendar date (no zone)
export function mondayOf(date: string): string;
export function weekDates(monday: string): string[];        // seven dates
export function templateForDate(
  date: string,
  ctx: { overrides: Readonly<Record<string, string>>; pattern: readonly (string | null)[]; defaultId: string; exists: (id: string) => boolean },
): { templateId: string; from: DayFrom };
//   A date change whose template still exists wins, then the pattern's weekday (if it exists), then the default.
export function overrideTemplateId(row: { kind: string; template_id: string | null }, templates: readonly Pick<DayTemplate, 'id' | 'sourceKind'>[]): string | null;
//   template_id when set, else the template whose sourceKind = kind (an old day_types row), else null (falls through).

// Tasks and blocks
export type BlockHow = 'picked' | 'time';
export function blockOfTask(task: { timeBlockId?: string | null; dueTime: string | null }, slots: readonly TemplateSlot[]): { blockId: string; how: BlockHow } | null;
//   picked: timeBlockId (even when that block has no slot today); else the slot whose range holds dueTime; else null.
export function suggestBlock(
  task: { lifeArea?: LifeAreaKey | null; relationship?: RelationshipKey; priority: Priority | null; estimateMin: number | null },
  slots: readonly TemplateSlot[], blocks: readonly TimeBlock[], usedMin?: Readonly<Record<string, number>>,
): string | null;
//   Candidates are only blocks with a slot that day, in clock order.
//   1. Matches: blocks whose area = the task's area (when it has one); if none match, blocks whose pillar = its pillar.
//   2. Among matches, P0, P1 or no priority take the first Focus-tagged match; P2 and P3 the first match that is not Focus;
//      either way, the first such match that still has room (usedMin[block] + estimate <= its minutes that day) wins, else
//      the first such match, else the first match with room, else the first match (2026-11-07).
//   3. No match: P0 and P1 go to the first Focus-tagged block of the day; anything else gets null.
//   A block whose every slot that day runs past midnight (slotCrossesMidnight: the night's sleep) is never a candidate (2026-11-07).
//   It writes nothing; a suggestion becomes the task's block only when the person keeps it.

// Block hints (packages/shared/src/blockHints.ts, the subpath export @kreators/shared/blockHints, chunk `block-hints`; 2026-11-07)
export function slotsLeft(slots, after?: number | null): TemplateSlot[];
//   For today only (`after` the device's minute now): the slots still to come; one that has ended is left out, one under way starts at
//   `after` rounded up to 15 minutes, one past midnight stays whole. Used for room and targets, never for which block a time falls in.
export function groupWithSuggestions<T extends GroupableTask>(list: T[], ctx: { slots; blocks; lead?; second?; used?: Record<string, number>; after?: number | null }): SuggestedGroup<T>[];
//   groupTasks(list, 'block', ctx), then every task in 'none' with no timeBlockId and no dueTime goes, as a suggestion, into the in-day
//   block suggestBlock picks for it over slotsLeft (in list order, so P0 claims room first; each suggestion adds its estimate to `used`
//   for the next), but only when that block still has room for it: a suggestion into a full or finished block would only be noise.
//   Suggestions sit after the block's placed tasks (in `tasks` and in `suggested`); plannedMin stays the placed tasks only, so a
//   suggestion never makes a block "over". A task with no suggestion stays in No block yet, which goes once empty.
//   `used` is blockUsedMin(slots, day.slotPlannedMin) (the server's per-slot sums, by block); without it, the placed tasks.
export function blockMismatch(task, slots, blocks, opts?: { used?; taken?; after? }): { block; better; start: 'HH:MM'; slot } | null;
//   Only a task in a block by its TIME (blockOfTask how 'time', never 'picked'), in a block with an area and/or a pillar, sharing
//   neither (blockFits: block.area === task.lifeArea, or block.pillar === task.relationship; a block with neither, like Travel, never
//   asks), when suggestBlock (over slotsLeft) picks a DIFFERENT block of the day that does fit (a Focus fallback is not enough), that
//   block still has room for the task's estimate, and moveStartIn finds a free start in it. Otherwise nothing is said.
//   start (Move it's time, moveStartIn(blockId, slots, taken, need, after)): the first start in the block's slots, in 15-minute steps
//   from the slot's start (from `after` today, so never a time gone), where the task fits whole before the slot ends (a task longer
//   than the slot takes it from its start) and overlaps none of the day's other timed tasks (`taken`: open that day, each from its time
//   for its estimate, 30 when none). No such start: null, and no prompt.
//   Daily and the task form pass the same opts (the form reads Daily's cached answer for that day when there is one), so both name the
//   same block and time.
//   blockMismatchLine: "Fun/social is for Friends. This fits Busy work, 3:00 pm to 5:00 pm." (the pillar's name, else "the <area> area").

// Grouping (Daily's boxes)
export const TASK_GROUP_NONE = 'none';
export interface TaskGroup<T> {
  key: string;                 // a block id, an area key, or 'none'
  kind: 'block' | 'area' | 'none';
  name: string;                // block name, LIFE_AREAS name, "No block yet" or "No area"
  color: SwatchKey | null;     // a block's swatch
  area: LifeAreaKey | null;
  ranges: { start: number; end: number }[];  // the block's slots that day (a block can appear twice, Deep work 09–13 and 14–16)
  inDay: boolean;              // false for a picked block that has no slot in today's template
  minutes: number;             // the block's minutes that day (0 when not in the day)
  plannedMin: number;          // sum of the tasks' estimates (30 when none, PLAN_DEFAULT_MINUTES)
  tasks: T[];
}
export function groupTasks<T extends GroupableTask>(list: T[], by: 'block' | 'area', ctx: { slots: readonly TemplateSlot[]; blocks: readonly TimeBlock[] }): TaskGroup<T>[];
//   block: one group per block in the order its first slot comes in the day, then picked blocks that are not in the day
//          (by the block's sort), then 'none'. Empty groups of the day ARE returned (so the box shows "Nothing here yet"), 'none' only when it has tasks.
//   area:  LIFE_AREA_ORDER, then 'none' ("No area"); only areas that have tasks.
//   Inside every group the tasks are in sortTasks(list, by, ctx) order.
```

`GroupableTask` is the existing `sortTasks` shape plus `timeBlockId?: string | null`, `lifeArea?: LifeAreaKey | null` and `relationship?`.

### Changes in `tasks.ts`

- `TASK_SORTS` gains two entries after `context`:
  - `{ key: 'block', name: 'By time block', blurb: 'Grouped by the blocks of your day; inside each, P0 first, then area, then day.' }`
  - `{ key: 'area', name: 'By area', blurb: 'Grouped by area of life; inside each, P0 first, then the block, then day.' }`
- `TaskContext` becomes `{ lead: RelationshipKey; second?: RelationshipKey | null; slots?: readonly TemplateSlot[]; blocks?: readonly TimeBlock[] }`. Use a type-only import from `timeBlocks.ts`; it has no runtime cycle, because `tasks.ts` loads first and the import is `import type`.
- `sortTasks`:
  - `block`: compare the group rank (the place of `blockOfTask`'s block in the day's slot order, then not-in-day picked blocks, then none), then priority, then area rank (`LIFE_AREA_ORDER` index, none last), then day, then time.
  - `area`: compare the area rank, then priority, then the block rank, then day, then time.
  - `context`: unchanged, and reads `lead` and `second` from the template.
  - In every view the priority is balanced first inside a group, and the day comes after it.
- `PlanTask` gains `timeBlockId?: string | null`, `lifeArea?: LifeAreaKey | null` and `dueTime?: string | null`.
- `WeekPlanSuggestion` gains `blockId: string | null`.
- `WeekPlanDay` gains `templateId?: string` and `templateName?: string`.
- `PlanAttention.kind` gains `'blockFull'` (a block's planned minutes on a day pass its length; `tasks` = those in it, `days` = [the day]) and `'blockEmpty'` (a Focus-tagged block has nothing planned on a day; `tasks` = up to five open tasks with no block, `days` = the days).
- `planWeek(today, tasks, capacityMin, blocking?: { days: { date: string; slots: TemplateSlot[]; templateId: string; templateName: string }[]; blocks: TimeBlock[] })`: without `blocking`, everything is exactly as today, so the existing tests and the golden output hold. With it, each suggestion gets `suggestBlock`, a task that already has a block keeps it, and the two new attention lines are added after the existing ones. Plan strength is unchanged.

### Shared tests: `packages/shared/src/timeBlocks.test.ts`

- **Swatches:**
  - every swatch has meta;
  - `isSwatch('constructor')` is false.
- **Time helpers:**
  - `minuteOf` refuses "24:00", "7:00" and "07:60";
  - `slotLength` of Sleep 23:00 to 07:00 is 480;
  - 22:00 to 00:00 is 120;
  - `slotContains` wraps (02:00 is inside Sleep; 07:00 is not).
- **Overlaps:**
  - `slotsOverlap` catches a wrap against an early morning slot;
  - touching ends do not overlap.
- **`parseSlots`:**
  - refuses an overlap with both names;
  - refuses an unknown block;
  - refuses more than the maximum;
  - sorts by start.
- **Starting set:**
  - Everyday holds exactly the founder's ten, at the founder's times;
  - it covers 1440 minutes;
  - every starting template is overlap-free;
  - every slot names a starting block;
  - every `DAY_TYPE_KEYS` has a template whose lead and second equal `DAY_TYPES`;
  - one template is the default.
- **`templateForDate`:**
  - the date change wins over the week;
  - the week wins over the default;
  - a deleted template falls through;
  - `overrideTemplateId` maps an old `kind` row.
- **Weekdays:** `weekdayOf` gives 2026-11-02 = 1 and 2026-11-08 = 7.
- **`blockOfTask`:** picked wins over time; a time at 10:30 falls in Deep work; no time gives null.
- **`suggestBlock`:**
  - a financial P0 goes to Deep work;
  - a financial P3 goes to Busy work;
  - a mental task goes to Learn/explore;
  - a P1 with no match goes to the first Focus block;
  - a P3 with no match gets null;
  - room moves a task to the second Deep work slot when the first is full.
- **`groupTasks` and `sortTasks`:**
  - block groups come in clock order;
  - a picked block not in the day comes after them;
  - 'none' comes last;
  - P0 stays first inside every group;
  - area groups follow `LIFE_AREA_ORDER`.
- **`planWeek`:**
  - with no `blocking`, the output equals the old output;
  - with it, suggestions carry a `blockId`, and `blockFull` and `blockEmpty` appear.

---

## 4. API contract

### New route file `apps/api/src/routes/timeBlocks.ts`, mounted at `/time-blocks`

This feature is core, like `/today`. It does **not** go in `MODULE_FOR_PREFIX`; add a comment line in `access.ts` saying it is left out on purpose, as the file does for `me/teams`. Every query filters by the session user id. Every id is checked as the person's own (`WHERE id = ? AND user_id = ?`), and an unknown id answers 404 `not found`. A date is checked with `DATE_RE` from db.ts. Every write calls `ensureTimeBlocks` first.

| method and path | body | answer |
|---|---|---|
| `GET /time-blocks?week=YYYY-MM-DD` | none | `TimeBlocksResponse`. The week is snapped to its Monday; with no `week`, the server snaps `?day=` (the device's day, `dayFromDevice`). |
| `POST /time-blocks/blocks` | `{ name, tag?, color, area?, pillar? }` | `{ block: TimeBlock }`; 400 with the problem; 409 `You have the most blocks you can keep (24).` |
| `PATCH /time-blocks/blocks/:id` | any of the same | `{ block }` |
| `DELETE /time-blocks/blocks/:id` | none | `{ ok: true, tasksCleared: number, templatesTouched: number }`. One batch removes its slots, sets `nodes.time_block_id = NULL` where it was this block (owner only), and deletes the block. |
| `PUT /time-blocks/blocks/order` | `{ ids: string[] }` (all of the person's, each once) | `{ ok: true }` |
| `POST /time-blocks/templates` | `{ name, lead, second?, slots?: [{blockId,start,end}], fromId? }` | `{ template: DayTemplate }`. With `fromId` and no `slots`, it copies that template's slots, lead and second (not `seed`, `sourceKind` or `source`). 409 at the maximum. |
| `PATCH /time-blocks/templates/:id` | `{ name?, lead?, second?, slots?, isDefault?: true }` | `{ template }`. `slots` replaces the whole set in one batch (delete, then insert). `isDefault: true` clears the old default and sets this one in the same batch. |
| `DELETE /time-blocks/templates/:id` | none | `{ ok: true, daysCleared: number, weekdaysReset: number }`. 409 `Make another template the default first.` for the default. One batch removes its slots, the date rows that point at it (`template_id = id`, or an old row whose `kind` = its `source_kind` with `template_id` NULL), and its weekday rows (those days go back to the default), then the template. |
| `PUT /time-blocks/pattern` | `{ weekdays: number[] (1..7), templateId: string \| null }` or `template` (a name) instead of the id | `{ pattern, previous: { weekday, templateId \| null }[] }`. null removes the rows, so those days follow the default. |
| `PUT /time-blocks/days` | `{ dates: string[] (1..MAX_APPLY_DATES), templateId: string \| null }` or `template` (a name) | `{ days: { date, templateId \| null, previous: string \| null }[] }`. A date row is an upsert into `day_types` with `template_id` and `kind` = the template's source_kind or `'template'`. null deletes the row, so the date follows the pattern again. Any real date is allowed. |
| `POST /time-blocks/restore` | none | `{ added: { blocks: number, templates: number } }` |

A name instead of an id (`template` on pattern and days, `timeBlock` on nodes) is matched case-insensitively and trimmed, against the person's own rows only. An unknown name answers 400 `No day template called that.` or `No time block called that.`. This exists for the assistant; screens send ids.

**Rate limits** (`apps/api/src/limits.ts`): every write above goes in `ROUTE_LIMITS` under the existing `prefs` limit (240 an hour per person): POST, PATCH and DELETE on `/time-blocks/blocks` and `/time-blocks/blocks/:id`, `PUT /time-blocks/blocks/order`, POST, PATCH and DELETE on templates, `PUT /time-blocks/pattern`, `PUT /time-blocks/days` and `POST /time-blocks/restore`. No new limit name is needed.

**Server helper** `apps/api/src/timeBlocks.ts`:
- `ensureTimeBlocks(db, user)`.
- `loadBlocking(db, userId, dates: string[]): Promise<{ blocks: TimeBlock[]; templates: DayTemplate[]; defaultId: string; pattern: (string|null)[]; overrides: Record<string,string> }>`. One `db.batch` reads the blocks, the templates, the slots, the pattern and the `day_types` rows `WHERE day IN (...)`.
- `dayPlan(blocking, date): DayPlan`, through the shared `templateForDate` and `overrideTemplateId`.
- Row mappers `toTimeBlock` and `toDayTemplate`.
- `blockIdByName(db, userId, name)`.

### Nodes (`routes/nodes.ts`, `db.ts`)

- `NodeRow` gains `time_block_id: string | null`. `toNode` sets `timeBlockId`. The shared `Node` (api.ts) gains `timeBlockId?: string | null`.
- `NodeBody` gains `timeBlockId?: string | null` and `timeBlock?: string` (a name).
  - On create and on `PATCH /nodes/:id`, a block id must be the person's own, else 400 `pick one of your time blocks`.
  - null or `''` clears it.
  - `timeBlock: 'none'` clears it too.
- `spawnNext` copies `time_block_id` to the next task of a repeat.
- `GET /nodes/:id` returns it (through `toNode`).

### `GET /today` (routes/today.ts)

- It calls `ensureTimeBlocks`, then `loadBlocking(db, user.id, [date])`. That read runs in the existing `Promise.all`; the six-task query waits for it.
- The By context order now binds the template's lead and second as parameters, in place of the `DAY_LEAD_SQL` and `DAY_SECOND_SQL` CASE expressions, which are removed. The context order applies when the day's `from` is `'date'`, or `'week'` with a template that is not the default. That keeps today's rule: a plain day sorts by day.
- New query parameters:
  - `?group=1`: the main list returns up to `DAILY_GROUPED_MAX` (60, in shared `timeBlocks.ts`) instead of 6, plus `tasksMore: boolean`. In SQL it is still ordered by priority, then day.
  - `?block=<id>|none` (kept for other callers; Daily's screen does not send it since the Block filter was taken out on 2026-11-06): cuts the main list and the not scheduled list to tasks in that block. A task is in the block when `n.time_block_id = ?`, or when `n.time_block_id IS NULL` and its `due_time`'s minute lies in one of that block's slots that day. The slot bounds are integers read from the person's own rows, written as SQL numbers, never typed text. `(CAST(substr(n.due_time,1,2) AS INTEGER)*60 + CAST(substr(n.due_time,4,2) AS INTEGER))` gives the minute. `none` means no picked block and not in any slot. It combines with `?area=`.
- `TodayResponse` gains:
  - `day: DayPlan`;
  - `tasksMore?: boolean`;
  - `block?: string | null` (the filter it was cut to).
  - Every `Node` in it carries `timeBlockId`.

### Old routes kept working

- `GET /today/day-type` answers `{ date, kind, templateId }`. `kind` is the template's `sourceKind`, or null.
- `PUT /today/day-type` takes `{ date, kind }` (today or tomorrow, as before) or `{ date, templateId }`. A kind maps through `startingTemplateFor`'s seed to the person's template with that `source_kind`. If they deleted it, the route answers 404 `That kind of day was removed; pick a day template.`. It writes the same `day_types` row as `PUT /time-blocks/days`.
- `routes/insights.ts` keeps reading `day_types.kind`. The new rows still carry the template's `source_kind` there, so `daytypeDone` keeps working for templates that came from a kind.

### `GET /today/week-plan`

- It calls `loadBlocking` for the seven dates and passes `blocking` to `planWeek`.
- `PlanTask` rows now carry `time_block_id`, `life_area` and `due_time`.
- The answer adds `blocks: TimeBlock[]` and, per day, `templateId` and `templateName`.

### The assistant (`apps/api/src/assistant/tools.ts`): one action, two callers

- `get_daily` adds the day's template name and its blocks ("Deep work 10:00 am to 1:00 pm"), and each task's block name when it has one.
- `add_to_pyramid` and `edit_pyramid_item` gain `block`, a block name. `'none'` clears it. It is sent as `timeBlock` to the same node routes. The undo body of `edit_pyramid_item` carries the old `timeBlockId`.
- New `get_time_blocks` (read): `GET /time-blocks?week=<device Monday>`. It lists the templates by name, the week's days and the blocks.
- New `set_day_template` (write): args `template` (a name, or `'week'` to follow the pattern again), and either `dates` or `weekdays`. It calls `PUT /time-blocks/days` or `PUT /time-blocks/pattern`. The undo route is the same call with `previous` from the answer. It is offered always, since the feature is core. Its refresh clears the keys `today`, `timeBlocks` and `weekPlan`.

---

## 5. Web

### Shared web pieces (`apps/web`)

- **`lib/api.ts`** (re-read it before editing; other steps touch it). Add:
  - `timeBlocks(week)`;
  - `createTimeBlock(body)`, `updateTimeBlock(id, body)`, `deleteTimeBlock(id)`, `orderTimeBlocks(ids)`;
  - `createDayTemplate(body)`, `updateDayTemplate(id, body)`, `deleteDayTemplate(id)`;
  - `setWeekPattern(body)`, `setDayTemplates(body)`, `restoreTimeBlocks()`.
  - `today(date, opts)` gains `group` (Daily has no Block filter, so the web client never sends `block`).
- **Query keys:**
  - `['timeBlocks', monday]`.
  - Every write invalidates `['timeBlocks']`, `keys.today`, `['weekPlan']` and `['dayType']`.
  - A block or template write also invalidates the node queries of open pillar pages (`['nodes']`).
- **`lib/useTimeBlocks.ts`:** `useTimeBlocks(week)` reads that query.
- **CSS**, a block at the end of app.css called "Time blocks" (re-read the file before editing):
  - `.tb-<key>` sets `--tb` to the token in the swatch table;
  - `.tb-box` is `background: color-mix(in oklab, var(--tb) 12%, var(--card-strong))` with `rounded-card`;
  - `.tb-dot` is a 12px solid `var(--tb)` circle with a hairline `border: 1px solid var(--separator)`, so silver shows on white;
  - `.tb-band` is a 4px bar in `var(--tb)`.
  - Text on a box stays `ink` and `ink-soft`, so AA does not depend on the swatch.
  - Use no new shadow, no hex and no new spacing value.
- **`components/SwatchPicker.tsx`:**
  - a `role="radiogroup"` labelled "Colour";
  - one 44px round button per swatch (`role="radio"`, `aria-checked`, `aria-label` the swatch name);
  - the picked one wears the accent ring;
  - arrow keys move through the swatches;
  - it wraps in a `fill-row`.
- **`components/BlockTag.tsx`:** an `IconTag`-style mark made of a `.tb-dot` and the block name. It is used in `TaskTags`, on Plan my week rows and in the timeline.
- **`components/TaskGroups.tsx`:** the coloured boxes (see Daily).
- **`components/DayTemplateSelect.tsx`:** replaces `DayTypeSelect` (`components/DayTypePicker.tsx` is kept as a thin re-export until every import moves).

### Page `/time-blocks` (`screens/TimeBlocks.tsx`, `lazyNamed`, inside `Shell`; not a module and not on Apps)

- `PageHeader` has `back="/today"`, the title "Time blocks" and the lede "Shape each day, then let tasks fall into place." With `back` and `lede` the cover is drawn, with art keyed `today`.
- The page has no solid button at rest. Each editor that is open owns the one solid Save.
- The URL holds `week` (a Monday) and `day` through `useParamState`, with `preventScrollReset`.
- **Section "This week":**
  - a row with the previous-week `IconButton`, the week's label (`periodLabel` for the week) and the next-week `IconButton`;
  - then the seven days:
    - on a phone, a list of rows: the weekday and date on the left, the template name and a `StatusTag` "Changed" (calm) when `from === 'date'`;
    - from `md`, a 7-column grid of buttons in the same order;
    - each day is a `<button>` with `aria-pressed` for the picked day; today is ringed.
  - Under the strip, the picked day:
    - **the timeline:** each slot in clock order is a row with a `.tb-band`, the block name, `slotRangeLabel`, its length ("3 h") and the tag; a gap of 15 minutes or more shows as "Free";
    - **"Kind of day"**, a `SELECT_SM` for this date: the first option is "Follow your week (<pattern template>)", which sends null, then every template. It writes `PUT /time-blocks/days`.
    - **a `Fold` "Use it on more days"**, which opens inline:
      - weekday tick rows, Mon to Sun;
      - a `Segmented` "Every week" (the pattern) or "This week only" (those dates);
      - the solid "Apply".
- **Section "Your usual week"** (a `Fold`, closed by default):
  - a "Default for every day" select, which sets `isDefault` on a template;
  - seven rows (Monday to Sunday), each a select whose first option is "Default (<name>)" (null) followed by the templates. A change saves at once through `PUT /time-blocks/pattern`, with a quiet line saying Saved.
- **Section "Day templates":**
  - Each template is a row card:
    - the name, plus a "Default" `StatusTag` in the corner;
    - the lead pillar as a tag in its soft colour;
    - a 24-hour strip of the slots as coloured segments, proportional and `aria-hidden`, with the slot list read out as text for screen readers;
    - its `why` line and `source` in `text-card-note`.
  - Tapping a row opens its editor inline under it (`aria-expanded`, `ToggleChevron`):
    - name (`FIELD`);
    - lead and second pillar selects;
    - the slot rows: a block select, start and end time inputs (`type="time"`, step 300), the length, and a 44px trash `IconButton` that removes the row from the unsaved draft without asking, because nothing is saved until Save;
    - "Add a slot", which starts where the last slot ends and lasts an hour;
    - an `ErrorLine` with `parseSlots`'s problem, checked as the person types;
    - the solid Save, an outline "Save as new";
    - a `MoreMenu` with Make default, Copy, and Delete.
  - Delete opens `ConfirmDelete`, with the red "Yes, delete it" and "Days that use it go back to your week." (it refuses the default).
  - A starting template carries the quiet line "A starting point. Change anything."
  - An outline "New template" in the section's header copies the picked day's template as "My day", then opens it.
- **Section "Blocks":**
  - An `fx-inset` list. Each row shows a `.tb-dot`, the name, the tag, and the area and pillar as small tags.
  - Tapping a row opens it inline:
    - name;
    - tag (`FIELD` with a `datalist` of `TIME_BLOCK_TAGS`);
    - `SwatchPicker`;
    - an area select ("No area", then `LIFE_AREA_ORDER`);
    - a pillar select ("No pillar", then the seven);
    - Save, and a Delete in a `MoreMenu`.
  - Delete opens `ConfirmDelete`: "Delete Deep work? Tasks keep; they lose this block. It also leaves 6 templates." The counts come from the page's data, and the yes reads "Yes, delete the block".
  - An "Add a block" `Fold` with `adds` holds the same form.
  - "Arrange" turns the list into a `SortableList` (`PUT /time-blocks/blocks/order`).
- At the foot: an outline "Bring back the starting set", then `HowItWorks page="timeBlocks"`.

### Entry points

- **Daily:** the Tasks header's `WeekPlanButton` gets a sibling outline `sm` link "Time blocks" to `/time-blocks`.
- **Plan my week** (`components/WeekPlan.tsx`): a round Settings `IconButton` in the sheet's header, labelled "Time blocks and day templates", links to `/time-blocks` and closes the sheet.

### Daily (`screens/Today.tsx`)

- **The kind-of-day picker** becomes `DayTemplateSelect`, in the same place. Its label is "Kind of day". It reads `today.day`. The first option is "Follow your week (<name>)", then the templates. It writes `PUT /time-blocks/days` for Daily's date (any date). `DayTypeNote` shows the template's `why` and `source`, plus a link "Edit in Time blocks".
- **Sort by** (the `TabRow`) gains "By time block" and "By area". "By context" is now always offered, because every day has a template. The default sort rule is the server's context rule, so the default stays Day on a plain day.
- **No Block filter** (the founder, 2026-11-06: "the dropdown for block needs to go, by time block is needed"). Folding the boxes of By time block does that job. The row is as it was before time blocks: Kind of day at the left, then the Area `FilterSelect` (`lg:w-[200px]`, only once a task carries an area), then Sort by, one line from `lg` and a line each below it, with `DayTypeNote` under them. An old `?block=` in Daily's address is ignored.
- **Grouped view.** With "By time block" or "By area" chosen, Daily asks `GET /today?group=1` and draws `TaskGroups` in place of the flat list.
  - Above the boxes: "N groups" on the left; outline "Open all" and "Fold all" on the right.
  - Each box is a `<section class="tb-box tb-<color>">` (an area box uses `background: var(--soft-<area's relationship>)` like `AppGroups`).
  - Its header is one `toy toy-flat` button with `aria-expanded`, at least 72px tall, showing:
    - a `.tb-dot`, or the area's `AppIcon`;
    - the name in `text-title3`;
    - in `text-footnote`, the ranges ("10:00 am to 1:00 pm") or the area's blurb, plus "Not in today's plan" when `inDay` is false;
    - a count pill (`bg-card-strong`, e.g. "3 tasks · 1 h 30 of 3 h");
    - a `ToggleChevron`.
  - The body is the same `DailyTask` rows, GSAP height (set under reduced motion).
  - An empty box of the day says "Nothing here yet." in `ink-soft`.
  - Open state is kept with `useKept`, scope `taskgroups:<user>`, by group key. Everything starts open.
  - `tasksMore` shows "Showing the first 60." under the boxes.
  - The body's contents sit on an inner `pt-xs` wrapper (never padding on the element GSAP takes to height 0), so the header's hover tint never meets the first row (2026-11-07).
  - **Suggested into a block** (2026-11-07, the founder: "put tasks inside of a time block as a suggestion even if it does not have a time"): By time block draws `groupWithSuggestions`. A suggested task is the ordinary row with one quiet line under it: a calm `StatusTag` "Suggested", why ("It fits here by its pillar, Friends.", "…by its area, Physical.", or "A top task with no match goes to a Focus block."), and an outline "Keep here" that saves `PATCH /nodes/:id { timeBlockId }`. On a phone the why is left out (`hidden sm:inline`), so a suggestion is one line: the tag and Keep here. Only a block with room that is not over today gets a suggestion, and never the night's sleep. The count pill counts the placed tasks ("1 task · 15 min of 2 h"), or "2 suggested" when a box holds only suggestions. Nothing is written until Keep here. By area is unchanged.
  - **A task in a block meant for others**: a task whose time put it there (`blockMismatch`) gets one quiet line under it, `blockMismatchLine`, with two outline actions: "Move it" (`PATCH { dueTime: start }`) and "Keep here" (`PATCH { timeBlockId: <this block> }`, so it is picked and never asked again; no new table). Words left, actions right, the actions wrapping under the words at the right (not full width: on a phone a list of full-width buttons swamped the tasks).
  - After a hint's tap the line goes (and Move it takes the row to another box), so focus moves to the task's Plan button where it now sits (`li[data-task-id]`), else to its box's header; never back to the page top.
  - `TaskGroups` is lazy (its own chunk with `block-hints`), and reads the tasks and the day itself.
- **`DayBlocks`** (rename its `COPY` title to "Your day" so it does not clash):
  - It draws the day's slots in clock order as bands with the block's colour.
  - Inside each band go the tasks that fall in it, by `blockOfTask`, with their times and a "Focused" bar as now.
  - Each band shows "45 min free" when its planned minutes are under its length, and "Over by 30 min" in the warn tone when they pass it.
  - Timed tasks outside any slot stay listed at their time.
  - Overlaps between tasks are still flagged.
- **`TaskTags`** shows a `BlockTag` when the task has `timeBlockId`, as one of `CheckRow`'s `marks`.
- **`TaskPlanFields`** (`components/TaskPlan.tsx`):
  - `Plan` gains `timeBlockId: string | null`; `planOf`, `planBody` and `planProblem` carry it.
  - A "Time block" select sits beside Area. The first option is "By its time", which is null. Then come the blocks of the task's do day (or Daily's day), under the optgroup "In the day", then "Other blocks".
  - The blocks come from `useTimeBlocks` for the week of that day.
  - Under the time (2026-11-07): with no block picked and a time set, when `blockMismatch` finds that time in a block meant for another area or pillar and a better block that day, one quiet line (`blockMismatchLine`) and a "Use <block>'s time" link that sets the time to the free start Daily's Move it would pick. It sits right under the time and minutes fields on a phone and under that whole row from the tablet width (`sm:order-last`), and reads Daily's cached answer for the day (load, timed tasks) and the time now, so it names the same block as Daily. Words only, never a popup, never stops a save. It needs the task's pillar (`pillar` on `TaskPlanFields`: Daily's panel, the pillar page's sheets, the month calendar's add form and Plan my week's own form pass it).

### Plan my week (`WeekPlanBody.tsx`)

- **Each suggestion row:**
  - shows a `BlockTag` for its `blockId` under the title, with a small select to change it. That select has a fixed width, like the day picker.
  - On Keep, the patch adds `timeBlockId` when the task had none. One `PATCH /nodes/:id` per task stays merged.
- **"Worth a look" gains two lines:**
  - `blockFull`, e.g. "Deep work on Tue holds 4 h 30 of 3 h.". Its Fix offers the existing move.
  - `blockEmpty`, e.g. "Deep work is empty on Tue and Thu.". Its Fix lists up to five open tasks with no block, and picking one stages that day plus that block.

---

## 6. Emergence and help

### Emerging (`packages/shared/src/insights.ts`)

One signal, kept cheap and honest. The rest is left for later.

- **`block-kept`** (app `today`, part `timeBlocks`):
  - Over the last 8 weeks, a block qualifies when 10 or more ticked tasks had it picked.
  - The signal counts how many of those tasks were ticked inside one of that block's slots on that day. The local minute comes from `completed_at` through `localStamp`. The day's template is resolved with `templateForDate`.
  - Line: "You ticked 14 of 20 Deep work tasks inside the block."
  - Basis: "Tasks you put in Deep work, ticked in the last 8 weeks." + `INSIGHT_BASIS_TAIL`.
  - Tag: good at 60% or more, calm under it. No cause words.
  - Action: outline "Open time blocks" to `/time-blocks`.
  - Facts: `InsightFacts.timeBlocks?: { blocks; templates; defaultId; pattern; overrides: Record<string,string> }` and `done` rows gain `timeBlockId`. The field is optional, so the golden test is unchanged when it is absent.
  - `routes/insights.ts` adds the reads with its `add(name, stmt)` pattern.
- Plan my week's `blockFull` and `blockEmpty` lines are the second connection. They are rules in `planWeek`, not insights.
- The link to pillars and areas: a block's area and pillar drive `suggestBlock`. A template's lead and second pillar drive By context. The area boxes use the area's pillar colour.

### Help (`packages/shared/src/help.ts`)

- **`TERMS`** gains three words:
  - `'time block'`: "A named stretch of your day with a colour and a tag, like Deep work from 10 am to 1 pm. A task can sit in one."
  - `'day template'`: "A day's blocks laid on the clock, with the pillar that leads. Deep work day, Family day, Travel day. It is your kind of day."
  - `'weekly pattern'`: "Which day template each weekday uses. A change to one date leaves it alone."
- `'day type'` is reworded to point at day templates: "The kind of day is now a day template. Sorted By context, P0 stays on top and each priority starts with the pillar the template leads with."
- All three go in `TERM_GROUPS` "Daily and progress", after `'day type'`.
- **`HOW_TO.today`:** step 3 becomes "Pick the kind of day, a day template. Sort By time block or By area to see tasks in coloured boxes; P0 stays first in each." Its terms gain the three words.
- **A new `HOW_TO.timeBlocks`** (a page entry, shown by `HowItWorks page="timeBlocks"`) has four steps:
  1. A block has a name, a tag, a colour and, if you like, an area and a pillar.
  2. A day template places blocks on the clock; slots may cross midnight and never overlap.
  3. Your usual week gives each weekday a template; a change to one date leaves the week alone.
  4. A task sits in the block you pick, else the one its time falls in; Plan my week suggests one from its area and pillar.
- The Help page needs nothing else: it lists the words and the how-tos from these lists.
- **Elsewhere:**
  - `apps/web/src/site/content.ts`: Daily's `more` lines gain "Time blocks and day templates for every weekday".
  - `docs/DECISIONS.md`: one line for 2026-11-06.
  - `docs/superfocus-study.md`: one line noting the time blocks moved from timed tasks only to the person's own blocks.
  - **Not touched here:** CLAUDE.md, which the lead updates; and `scripts/admin-guide/lessons/03-daily.md` and `01-signing-up.md`, which belong to the other workflow. They are listed as a follow-up.

---

## Who builds what (four builders in parallel)

| builder | owns |
|---|---|
| A: shared | `packages/shared/src/timeBlocks.ts`, its barrel line, the `tasks.ts` changes (`TASK_SORTS`, `TaskContext`, `sortTasks`, `PlanTask`, `planWeek`), `api.ts` types (`Node.timeBlockId`, `TodayResponse.day`, `tasksMore`, `block`), `help.ts`, `insights.ts` (`block-kept`), `timeBlocks.test.ts`, `site/content.ts`, `docs/DECISIONS.md` |
| B: API | migration 0089, `apps/api/src/timeBlocks.ts`, `routes/timeBlocks.ts` and its mount in index.ts, the `access.ts` comment, `limits.ts` lines, `routes/today.ts`, `routes/nodes.ts`, `db.ts` (`NodeRow`, `toNode`), `routes/me.ts` export, `account.ts` delete, `routes/insights.ts`, the assistant tools, the smoke checks in `scripts/smoke/smoke.mjs` |
| C: web page | `lib/api.ts` additions, `lib/useTimeBlocks.ts`, `screens/TimeBlocks.tsx` and its route in App.tsx, `SwatchPicker`, `BlockTag`, `DayTemplateSelect`, the app.css block |
| D: web Daily | `screens/Today.tsx`, `TaskGroups.tsx`, `DayBlocks.tsx`, `TaskPlan.tsx` (`TaskPlanFields`, `TaskTags`), `WeekPlan.tsx` and `WeekPlanBody.tsx` |

C and D build against the signatures in this doc. D imports `BlockTag`, `DayTemplateSelect` and `useTimeBlocks` from C by the paths named here. B's smoke checks:
- the first `GET /time-blocks` shows the starting set (18 blocks and 17 templates since 2026-11-12) from code and writes nothing, and the first change writes them with the same ids;
- Everyday's slots;
- an overlap answers 400;
- deleting a block clears it from a task;
- the default cannot be deleted;
- a date change wins over the pattern, and null goes back;
- an old `kind` row still resolves;
- `?block=` and `?group=1` on `/today`;
- `timeBlockId` on a node refuses another person's block;
- export and delete cover the four tables.

Run after building: `pnpm typecheck`, `pnpm --filter @kreators/shared test`, `bash scripts/scan.sh`, the smoke test, and over `shots.json` with `/time-blocks` added: the overflow, contrast (dark), target, lone, cut, rag and height probes.

## Left out on purpose

- **Not in this build:**
  - dragging a block to move or resize it on a timeline (the times are typed);
  - a reminder at a block's start;
  - ticking a block as done;
  - locking blocks;
  - reflowing later blocks.
- **Blocks in other places:** they do not reach the private calendar link (`buildCalendar`), Home or the month calendar.
- **Repeats:** no repeat of a single block on its own; blocks repeat only through templates and the weekly pattern.
- **Day boundaries:** a slot that crosses midnight belongs to the day it starts on; tasks after midnight are read against that same day's template.
- **Travel:** travel is not detected; a person picks Travel day.
- **Icons:** blocks have no icon; the colour and the name carry them.
- **No model:** suggestions and sorts are rules.
- **Admin guide:** the Admin guide lessons wait for the other workflow to finish.

## Content days, their steps and Place my day (2026-11-12)

The founder's decisions of 2026-11-12. Three starting templates for making content, for everyone: **Edit day**, **Shoot day** and **Plan and post day** (seeds `editday`, `shootday`, `postday`, `CONTENT_DAY_SEEDS`), over four new starting blocks (`shoot`, `edit`, `plan`, `post`, `CONTENT_BLOCK_SEEDS`; financial and Servitude) and the existing ones. They have no `sourceKind`, so the Create kind still maps to Create day; their lead and second and their source are the Create kind's (self, then Servitude; "The Relationship Method, p. 257 and 267; Dictionary of Mistakes for Creators, p. 44 and 180–182"), and each why restates its idea: make, edit and post on different days. An account seeded before them gets them with Bring back the starting set, which now goes through `startingToRestore`: templates first, in starting order, each only when it and its missing blocks fit under `MAX_DAY_TEMPLATES` and `MAX_TIME_BLOCKS`, then the other missing blocks while there is room. The first change's seeding writes about 41 rows more than before (4 blocks, 3 templates, 34 slots).

**Steps.** `CONTENT_STEPS` in the leaf `@kreators/shared/contentDays` (chunk `shared-content-days`) holds a short list for each content block of each content day (Edit: make the cut, back up and hand it on; Shoot: get ready, run the shot list, offload and back up, a light review; Plan: the next round; Post: share what is ready), read with `stepsFor(templateSeed, blockSeed)` through no-prototype lookups. On a day whose template is one of them (`DayPlan.template.seed`), Daily draws the list inside that block (`components/BlockSteps.tsx`, lazy): a closed fold, numbered, to read and never to tick. Its outline **Add to my tasks** asks once for a project of the person's own in the block's pillar (a select in place, the last pick kept on the device under `breakdownProjectKey`; with none, "Tasks need a project" and a link to Pillars) and calls `POST /nodes/breakdown` `{date, templateSeed, blockSeed, projectId}` (limit `create`): one task (`breakdownTask`: the list's title, the steps as its subtasks up to `MAX_SUBTASKS`, the do date that day, the block as its `timeBlockId`, the block's minutes that day as its estimate, the block's area), `origin` `breakdown:<template>:<block>`, made with its subtasks in one guarded batch (no second one for the same list and day while one is not let go; a second tap answers 409 with the first). Daily then says Added with Open it (`TodayResponse.breakdowns`). It pays like any task. No assistant tool yet.

**Place my day.** `autoPlace` in `@kreators/shared/blockHints` is the one placement rule, pure and tested: the Today tab's open tasks with no block and no time, ordered by priority (P0, P1, none, P2, P3), due date, from a pillar first, the longer estimate first, then id; each goes to the best live block of the day (an area match before a pillar match; P0 and P1 try Focus-tagged blocks first, P2 and P3 the others; never a block whose slots all cross midnight, never time already gone today), with room counted from the server's `slotPlannedMin` plus what the run placed, and a start in 15-minute steps (`moveStartIn`) that overlaps no timed task and no earlier placement; a task that fits nowhere is listed with why (`noRoomLine`). Daily shows the plan on read, in By time block and in Your day, each with a Placed tag and its start; nothing is written until the one outline **Place my day**, which sends it all to `POST /nodes/place` (limit `prefs`): one guarded `UPDATE … RETURNING` per call that sets only `due_time`, for rows still the person's, open, with no time, no block and the same day; the answer says how many were saved and which were skipped (`changed`, `gone`). One round trip whatever the count (up to `PLACE_DAY_MAX`, 60).


**After the review (2026-11-12).** The plan reads every timed task of the day from `timedSpans` on `GET /today` (built from the slot read that already counts each slot's room, so no new round trip), never the six shown, so any cut of the day (Area, sort, tab) gives the same plan and nothing lands on a timed task. On today a block's room counts only its slots still to come (`blockUsedMin(slots, slotPlannedMin, after)`: a slot that has ended adds nothing, one under way keeps its minutes), so a busy morning never makes an empty afternoon slot of the same block read as full; By time block's suggestions and the task form's hint use the same. The 50 loose tasks `GET /today` sends come in `autoPlaceOrder`, so the plan reads the 50 that matter most, and its line says how many wait past them. A task that repeats is never placed (reason `repeats`, tag "Not placed": `spawnNext` would carry the time to every next one, pinning a habit to one day's room), and `POST /nodes/place` refuses one too (`repeat_json IS NULL`). Bring back the starting set says by name what did not fit under 24 blocks and 24 templates (`leftOut`). The three content days' whys say only what the Create kind's cited line says: Edit day "Edit on a different day from the one you publish.", Shoot day "Make it today, and publish it on a different day.", Plan and post day "Publish today, never what you made today.", each after "Your own craft comes first."
