---
name: workflow-b64c928f-framerschool-video-editing-template
description: FramerSchool 2.0 video editing template. Turns a webcam + screen-recording tutorial (Framer, AI site builds, Notion, KnotCMS and similar) into a chaptered 16:9 YouTube master plus one 9:16 reel per script section, in the 2.0 look - near-black canvas, off-white wireframes with one accent colour, paper "Framer canvas" chapter cards, animated speaker moves, phone-framed reel diagrams, plain captions and a barely-there music bed. Use when the creator says "FramerSchool 2.0", "same as the PG site video", or brings a new tutorial for the channel.
---

# FramerSchool 2.0: YouTube master + reels

Version 2.0 replaces the 1.0 red/black template. It was built and approved on the "PG site"
tutorial (Oct 2026): one 16:9 master and 15 reels (one split into two parts). Everything below is
what the creator approved or asked for along the way, so follow it as the default and only ask
about what is genuinely new.

Save the creator from repeating themselves: if a rule here answers a question, do not ask it.

## Inputs to gather first (one form, only what is missing)

- **Source files**: webcam recording(s) and screen recording(s) of the same session. Several
  parts (part-1, part-2...) are normal. Check simultaneity yourself (step 1).
- **The written script** (highest value). It defines sections, chapter titles, reel posting order,
  reel-end lines, long-version-only lines and product spellings.
- **The motion graphics guide / cue sheet**, if any. Follow its cue list and its pieces. Its rule
  "captions carry every spoken word; graphics only show what words can't" is part of 2.0.
- **This video's accent colour.** The 2.0 system is fixed except the accent, which changes per
  video (PG site: lime #D7F36B, plus cobalt #2447D5 only for the site's own colours). Ask only if
  the guide doesn't give one.
- **Design Style**: apply the saved style "FramerSchool Tutorial (PG site)" (or a copy with the new
  accent) instead of re-deriving colours and fonts.

## Workflow

### 1. Align the recordings
- Cross-correlate webcam and screen audio over the whole length. Screen recorders drop audio in
  silent gaps, so the offset can step mid-session; map it in pieces and keep cuts off the jumps.
- The screen recording may end before the webcam; speaker-only lines at the end are fine.

### 2. Transcribe and fix names
- Fix transcript words (not audio) so captions everywhere update: product names, spoken numbers
  (rupees as ₹11,000), stray fragments at cut edges.

### 3. Cut the speech against the script
- Fillers and pauses tightened to about 0.25 s; best complete take of each line (prefer the later
  take unless broken); never stitch a lead-in from a failed take.
- This creator restates a lot: remove repeated "So..." openers, padding, a sentence said twice,
  self-talk. Expect a second cleanup pass.
- Reel-end lines are cut from the master and kept at the end of their reel. Long-version-only lines
  stay out of reels.
- Confirm the cut before building anything on top of it.

### 4. Mirror the screen track
Each screen clip matches its speaker clip's start, length and source offset (plus the measured
sync offset). Screen is muted; the webcam carries the voice.

### 5. Master layout (16:9)
See [references/master.md](references/master.md). Key 2.0 rules:
- Layout per section from measured screen activity: speaker full frame / split / screen dominant.
- **Layout changes that happen in view are animated**: the whole webcam frame shrinks into its inset
  slot or grows back to full frame over 30 frames, ease-out cubic, with the screen already sitting
  underneath. Never a hard cut. (Changes hidden behind a chapter card need no animation.)
- **A panel graphic replaces the screen recording** for its span (remove those screen pieces); the
  speaker goes full frame beside it. Never stack graphic + recording + inset (too much load, looks
  lopsided). Screen callouts that annotate the recording are the exception.
- **Speaker beside a graphic**: shift the head to the free side by moving the crop window at normal
  framing size. Never punch in to do it ("my head is too large").
- Speaker punch-ins (hard cut, about 12 to 15% tighter) alternate at cuts in speaker-full sections.

### 6. Titles (master)
- **Chapter card**: the paper "Framer canvas" card (see examples/graphics/ChapterCard.tsx):
  #F2EFE8 paper, the title in Bebas Neue inside a Framer-style selection box with handles, a cursor
  labelled with the creator's name ("Gururaj"), a layer tag, part number "NN / total" and progress
  bars. Heavier whoosh in, lighter out.
- **Part tag** top-left between cards (examples/graphics/PartTag.tsx): quiet translucent pill,
  Bebas number "NN / total", Inter part name.
- Use the script's section names exactly for cards, tags and chapter markers.

### 7. Motion graphics
Full system in [references/look-and-graphics.md](references/look-and-graphics.md).
- Flat only: near-black #0E0E10 canvas, off-white #F4F3EF 1 px lines (3 px in reels), one accent
  per video, Phosphor thin icons, Geist Mono for numbers. No gradients, glows or shadows.
- Graphics never put a spoken word on screen. The only text allowed: numbers with units and text
  that is part of the site being shown. Wireframes and diagrams are icon-only.
- Only the cues in the guide; most lines get no graphic, on purpose. One graphic at a time.
- Author each as an editable Remotion Motion Graphic; reuse and adapt the sources in
  examples/graphics rather than starting from scratch. Beat timings are props measured from the
  graphic's own start.
- Spacing values only: 8, 12, 16, 32, 64, 120.

### 8. Captions
Inter Bold, white, on about 72% black rounded box, max two lines, **no active-word highlight**
(the red word box was "too contrasty"). Hide captions generated from screen-recording audio.
Master: just below the panels. Reels: size 0.045, card top 1350. Nothing covers the caption band.

### 9. Reels
Full spec in [references/reels.md](references/reels.md). Summary:
- One 9:16 timeline per reel section, built from the cleaned master, named "Reel N - Title".
- **Build two sample reels first** (one talk-heavy, one screen-heavy), get approval, then batch the
  rest by duplicating the approved sample timeline (keeps tracks, ducking and caption style),
  clearing its items and rebuilding from the master.
- Content starts at frame 0. The paper intro card plays over the first 2 s of speech (no separate
  beat); captions under it are hidden. Top-left "NN / 15" counter. A thin progress line along the
  bottom edge fills over the whole reel. Paper outro card (shield +
  "PART NN NEXT", 2.5 s) after the last line.
- Two layout states (FULL speaker / STACKED speaker over screen) with 20-frame eased moves between
  them; short runs are smoothed away so the layout doesn't flicker.
- Every graphic on its own full-frame #0E0E10 card above the speaker. Page wireframes are redrawn
  inside a flat outline **phone** for 9:16.
- **Long diagram cards get broken up**: anything over about 10 s is split with 2 to 5 s full-frame
  talking-head moments on direct-to-camera lines between diagram steps; each card resumes at the
  step it left off on.
- A reel over about 2 min, or with two distinct halves, is split into "(1/2)" and "(2/2)" at a
  natural boundary; part 1's outro says "Part NN continues".
- The speaker appears in every reel and every reel ends on the speaker.

### 10. Sound
See [references/sound.md](references/sound.md).
- Music: one mellow instrumental bed reused everywhere, **very low**: -26 dB gain plus 8 dB ducking
  under the webcam voice (about 27 dB under speech). The creator lowered it twice; start here.
- Reels: speaker -3 dB, music starts at a different point per reel, fade in 15 / out 45 frames.
- Whooshes: deep short on the intro card, airy short as it leaves and on the outro, simple whoosh on
  layout moves (skip if within 1.5 s of another).
- Voice isolation on every webcam clip (not music or SFX) before export.

### 11. Export and post copy
- 1080p 30 fps, "Master - <title>.mp4" and "Reel N - <section>.mp4"; check size and duration.
- YouTube description with chapter list from the markers (from 0:00); one Instagram caption per
  reel. The creator's voice: simple, direct, "you", short sentences, ₹ amounts, "to" for ranges,
  no em dashes. Deliver copy-ready blocks plus a CSV.

## Rules
- Spacing values only 8, 12, 16, 32, 64, 120.
- Flat design only. One accent element moving at a time.
- Graphics never repeat captions; graphics replace the screen recording, never sit over it.
- In-view layout changes are animated moves (30 frames master, 20 frames reels), never cuts.
  Punch-ins are cuts, never zooms. Never punch in to make room for a graphic.
- Captions without word highlight. Music barely there.
- Recompute everything downstream (cards, tags, graphics' internal beats, markers, reels, moves)
  after any speech change.
- Flag script/footage mismatches; on-screen numbers match what is spoken.
- A graphic never runs past the end of its reel or into the caption band.

## Final checks
- Speaker and screen frame-locked, no gaps, no black frames.
- Every layout move checked on its first, middle and landing frames.
- Every graphic checked in a composed frame (entry, settled, exit) in master and reels.
- Every reel: intro over speech, counter, at least one speaker moment, ends on the speaker, outro.
- Long cards broken up; resumed cards show the right step.
- Captions spelled right, nothing covering them.
- Music under speech in all timelines; voice isolation applied; say plainly what still needs a
  listen or a playback scrub.

## Practical build notes
ChatCut-specific techniques and gotchas are in [references/build-notes.md](references/build-notes.md).
Helper scripts: [scripts/layout_move.py](scripts/layout_move.py) (1-frame-piece animated moves),
[scripts/reel_diagram_spec.py](scripts/reel_diagram_spec.py) (convert a 16:9 diagram spec into the
phone-framed reel version).

---

<!-- file: references/build-notes.md -->

# Build notes (ChatCut techniques that worked)

- **No keyframes**: animate panel moves by splitting the clip into 1-frame pieces with interpolated
  geometry (scripts/layout_move.py). Merge contiguous screen pieces afterwards.
- **Builder script**: generate each reel's items from the master timeline JSON with a script
  (clips split at card bounds, hook and ending; state per clip; smoothing; moves; cards; callouts;
  titles; SFX; music) and send them with edit_item. Keep generated payloads under about 30 KB per
  call (split into chunks); short 10-character ID prefixes work for ids, assetIds and trackIds.
- For re-builds, diff against the live timeline and only delete/add what changed, so untouched
  items keep their IDs. Leave title items (intro, counter, outro) alone if they are unchanged.
- **Duplicating a sample reel** keeps its tracks, ducking and caption style; then delete all items
  and re-add.
- **Preview** only renders the timeline currently showing in the editor: switch to it first.
- **Captions** edits apply to the active timeline: switch before set_card_layout / set_card_text.
- **Motion Graphic assets**: an item can't be longer than its asset (extend the asset duration,
  e.g. the counter to 300 s). Relative imports inside an MG may fail to resolve at render
  ("import not found"): inline helper maps (icons) into the entry file. Update code in place with
  edit_asset codeFile so every placed instance picks it up.
- **Shaders on MG items** don't show in the timeline preview; confirm in the editor.
- Spec-driven diagrams: keep step timings as frames from the graphic's own start so cards can be
  split and resumed with an offset.
- Design Style specs use colors[].value and styleGuide (not hex / guidance).
- **Merging clips when building reels**: only merge neighbouring master clips into one reel clip when
  their source timing is continuous. Merging across a cut (e.g. a 1-frame move piece followed by a
  clip that starts later in the recording) silently plays the wrong part of the take. After building,
  compare every reel's played source ranges against the master's for the same span; they must match.
- **Caption slivers**: words that play for under ~20 ms at a clip edge are inaudible but still appear
  in auto captions ("Um,", a stray "I"). Hide those tokens before export.

---

<!-- file: references/look-and-graphics.md -->

# Look and graphics (2.0)

One fixed system for the channel. Only the accent changes per video. Saved as the Design Style
"FramerSchool Tutorial (PG site)".

## Palette

| Role | Value | Rule |
| --- | --- | --- |
| Canvas | #0E0E10 | Full-screen diagram cards, dim overlays, reel backdrops |
| Lines | #F4F3EF | Wireframe blocks, frames, icons |
| Muted | #F4F3EF at 30% | Blocks that aren't the point right now |
| Accent (per video) | PG site: #D7F36B lime | The one thing to look at: an outline, a flow line, a measure line |
| Second accent (per video) | PG site: #2447D5 cobalt | Only when showing the site's own colours |
| Phone screen (reels) | #151517 | Inside the phone outline |
| Paper cards | #F2EFE8 paper, #141414 ink, #6B675F muted, #E5352B red, #2F5BFF selection blue | Chapter card, reel intro, reel outro |

## Type
- Bebas Neue: chapter titles, part numbers, the reel counter, outro wordmark.
- Inter: captions (Bold), part names, cursor label.
- Geist Mono: numbers inside graphics (sizes, ratios, hex codes) and paper-card labels.

## Graphic rules
- Captions carry every spoken word. A graphic shows only what words can't: where to look, how a
  layout works, how data moves, how big something is, what changed. If the caption already says it,
  no graphic.
- Only text inside graphics: numbers with units, and text that is part of the site itself.
- Icons: Phosphor thin, off-white. The same icon always names the same block (map-pin = hero /
  location, bed = rooms, wifi-high = facilities, currency-inr = price, fork-knife = food, phone = call
  CTA, whatsapp-logo, images, list-bullets, database = CMS, question = FAQ, list-checks = rules,
  credit-card = payment, envelope-simple = contact form).
- Master: 1 px strokes, sharp corners. Reels: 3 px strokes, rounded blocks (radius 12) inside the
  phone (approved for 9:16 readability).
- No shadows, gradients, glows, stamps, shakes, bounces or big scale pops.
- One graphic at a time; if two cues overlap, the first exits (200 ms) before the next lands.
- Minimum text sizes: YouTube big 96 / body 40 / labels 28 px; reels big 112 / body 48 / labels 32 px.
- Reels: everything inside the middle band, clear of the top 250 and bottom 250 px and of the
  caption band.

## Motion timings

| Move | Duration | Easing |
| --- | --- | --- |
| Snap (outline, highlight, block landing) | 150 ms | ease-out |
| Move (slide, wipe, grow, block reorder) | 250 ms | cubic-bezier(0.2, 0.8, 0.2, 1) |
| Draw (flow line, measure line) | 400 ms | ease-in-out |
| Reveal (dim, frame open) | 400 ms | ease-in-out |
| Exit | 200 ms | ease-in, always faster than the entry |
| Reel card entrance | 14 frames, rise 32 px + fade | cubic-bezier(0.16, 1, 0.3, 1) |

## The pieces (sources in ../examples/graphics)

| Piece | File | Use |
| --- | --- | --- |
| Chapter card | ChapterCard.tsx | Master section changes. Paper Framer canvas: title in a selection box with handles, named cursor, layer tag, NN / total, progress bars |
| Part tag | PartTag.tsx | Master, top-left between chapter cards |
| Reel intro | ReelIntro.tsx | Reel frames 0 to 60 over speech; vertical version of the chapter card with 15 progress bars |
| Reel counter | SeriesStrip.tsx | Reel top-left "NN / 15" in Bebas Neue, slides down once then holds |
| Reel outro | ReelOutro.tsx | Paper card, FramerSchool shield draws its three bars, wordmark, "PART NN NEXT" |
| Progress bar | ProgressBar.tsx | Every reel: thin bottom line filling over the whole reel (white; ink over paper cards) |
| Backdrop | Backdrop.tsx | Flat full-frame card behind every reel graphic |
| Screen callout | Callout.tsx | Dims the screen to 40% except one rectangle; accent box (150 ms) or line bar. No labels |
| Keyword select | KeywordSelect.tsx | Selection box snapping around a word that is part of the site |
| Wireframe | Wireframe.tsx | Page as a column of icon blocks; hatched = AI defaults, hatch clears block by block |
| Diagram | Diagram.tsx | Step-based layout diagram (blocks tween, flow lines with travelling dot, measure line). Master |
| Reel diagram | ReelDiagram.tsx | 9:16 phone-framed version of Diagram with an `offset` prop for resumed cards |
| Contrast chip | ContrastChip.tsx | "Can you read this": price on a colour chip + measured ratio in Geist Mono |

Expose text, colours and beat timings as props. A Motion Graphic item cannot outlast its asset, so
make long-holding pieces (counter, tag, backdrop) long enough (the counter asset is 300 s).
Inline helpers such as icon maps into the entry file: relative imports may not resolve at render.

---

<!-- file: references/master.md -->

# Master (16:9, 1920x1080)

Measured from the approved PG site master.

## Layout slots

| State | Screen panel | Speaker panel | When |
| --- | --- | --- | --- |
| Speaker full frame | none | 0,0 1920x1080, radius 0 | Talk, static screen, and every span where a panel graphic is up |
| Split | 32,210 1412x670, radius 16 (top-anchored, bottom cropped) | 4:5 at 1460,345 428x535, radius 16 | Medium activity, or the speaker refers to the screen |
| Screen dominant | 32,104 1633x776, radius 16 | 3:4 inset at 1681,604 207x276, radius 16 | Live demo |

- Content baseline y 880; margins 32; panel gap 16. Captions centred around y 945 to 1015.
- Part tag at 32,32.

## Animated layout moves (in view)
- Whole webcam frame scales and slides as one piece between slots: 30 frames (1.0 s), ease-out
  cubic. The creator's reference: "Webflow vs Framer: Which is right for you in 2025" (0:02, 4:12).
- Shrink moves: the screen panel is already underneath. Grow moves: keep a screen piece underneath
  for the 30 frames.
- Interpolate display rect + crop window (keep the 4:3 source aspect) + border radius per frame.
  ChatCut has no keyframes, so split the incoming webcam clip into 1-frame pieces
  ([../scripts/layout_move.py](../scripts/layout_move.py)).
- Changes hidden behind a chapter card need no animation.
- A separate "SFX moves" track carries a soft whoosh on each move.

## Speaker framing (PG site room)
- Normal crop: crop width 0.60, crop height 0.45, top 0.30 of the 4:3 webcam, centred per clip on
  the measured median face position.
- Punch-in: about 12 to 15% tighter, hard cut, alternate at speech cuts longer than about 1 s, only
  in speaker-full states.
- Beside a graphic on the left: shift cropLeft down (to about 0.165, never lower: the switchboard and
  hanging cables sit at source x 0.03 to 0.165) so the head moves right at the same size. Change
  framing on clip boundaries that coincide with the graphic's start and end.
- Keep crops clear of background clutter; report how often hair touches the top edge.

## Graphics in the master
- Panel graphic at left 32, natural size; wide panels scaled so they end before about x 700 and
  never touch the face.
- Remove the screen pieces inside each graphic span (the screen track is muted, so audio is safe).
  Any later re-sync must not re-add screen clips inside graphic spans.
- Screen callouts (dim + accent box on the recording) stay over the recording.

## Titles
- Chapter card at each section change except the first (examples/graphics/ChapterCard.tsx).
- Part tag between cards (examples/graphics/PartTag.tsx); it fades in after the card wipes away and
  fades out just before the next card.
- Chapter markers tile the master and use the script's section names.

---

<!-- file: references/reels.md -->

# Reels (9:16, 1080x1920, 30 fps)

Approved on PG site Reels 1 and 7, then applied to all 15.

## Timeline
- Track order (bottom to top): Screen (muted), Speaker, Card, Graphics, Overlay (callouts),
  Titles, Progress; audio SFX, Music. Ducking on Music with the Speaker track as anchor.
- Reel content = the master's cleaned speech for that section, starting at frame 0.
- Frames 0 to 60: paper intro card (part number, title, 15 progress bars, layer tag "Part NN")
  plays OVER the speech. Hide caption cards that start before 2 s.
- From frame 60: "NN / 15" counter at left 64, top 256, 600x64, until the outro.
- After the last line (END): paper outro, 75 frames, next line "Part NN next" (last reel: "Full
  video on YouTube"; a split reel's first half: "Part NN continues").
- Progress bar: a thin 8 px line along the very bottom edge on its own top track ("Progress"),
  frame 0 to the end of the outro, filling left to right; white with a 20% track, dark ink over the
  paper intro (60 frames) and outro (75 frames) so it stays visible (examples/graphics/ProgressBar.tsx).
- Hook: the first line after 2 s. Ending: the last line at least 3 s before the section end is the
  reel-end line; both play full frame.

## Layout states

| State | Speaker | Screen |
| --- | --- | --- |
| FULL | panel 32,300 1016x1170, radius 16, alternating normal / punch crop at cuts (30+ frames) | none |
| STACKED | 280,320 520x390, radius 16, one fixed crop | 32,726 1016x571, radius 16 (1672-wide source: top 654, height 656, cropTop 0.1093, cropBottom 0.1551) |
| CARD | speaker full underneath | graphic on a #0E0E10 full-frame card above |

- State per clip: card if a graphic is up; full for hook and ending; otherwise the master's state
  (master speaker full = FULL, anything showing the screen = STACKED).
- Smoothing: stacked runs under 200 frames become full; full runs under 90 frames squeezed between
  stacked/card neighbours (at least one stacked) become stacked. Re-check that no move lands within
  about 4 s before a card; a card starting in the last 4 s extends the ending to the card's end.
- Every FULL <-> STACKED change is a 20-frame eased move (ease-out cubic, 1-frame pieces) with the
  screen underneath for the move's frames. Card in/out is a cut behind the card.
- Captions: Inter Bold 0.045, card layout left 81, top 1350, width 918, height 100, no highlight.

## Graphics on cards
- Every graphic sits on a full-frame #0E0E10 card (Card track) with the graphic on the Graphics track.
  Back-to-back graphics share one card. Nothing past the reel end or into the caption band.
- Generic panels: scale = min(952/w, 860/h, 1.6), centred horizontally, centred in y 320 to 1180.
- Screen callouts: remapped from master screen coordinates to the reel screen panel; skip any that
  fall outside the visible crop or land during a FULL state.

## Phone-framed wireframes (2.0)
Page wireframes and page diagrams are redrawn for vertical instead of scaling the square panel:
- Flat outline phone 512x966 at top 352 (centred; shifted left when a block sits beside it), radius
  64, line 4 px; bezel 16 sides / 64 top (speaker pill 128x12) / 32 bottom; screen #151517 radius 32.
- Blocks are full-width rows inside the screen (16 padding), radius 12, 3 px lines; vertical
  scale about 1.28 of the 16:9 spec; small gaps snap to 8/12/16/32. Icons 0.6 x the block's short
  side (40 to 96 px); small floating icons 80 px.
- Blocks that live outside the page (e.g. the CMS database) sit 64 px to the right of the phone,
  160 px square, with accent flow lines into the page.
- Entrance: phone rises 32 px and fades (14 frames), content wipes down the screen; exit fades with
  a 12 px lift over the last 8 frames.
- Convert 16:9 specs with [../scripts/reel_diagram_spec.py](../scripts/reel_diagram_spec.py); render
  with examples/graphics/ReelDiagram.tsx.

## Breaking up long diagram cards (2.0)
- A card longer than about 10 s is split. Put 2 to 5 s full-frame talking-head moments on
  direct-to-camera lines between diagram steps (e.g. "So that's the order I'm taking, from top to
  bottom.", "You don't need them to bloat up the website."). Don't place a break where the key
  visual change of a step would be missed; if the rest of a card is static, end the card and stay on
  the speaker.
- Each resumed card plays its entrance again and continues at the right step: pass
  offset = resume frame - original card start, and trim the spec to the step active just before the
  offset plus the later steps.
- Break clips are forced FULL (not stacked), with alternating punch.

## Splitting a long reel
- If a section runs over about 2 min or has two distinct halves, split it at the natural boundary
  into "Title (1/2)" and "(2/2)", same part number with letters A and B: the intro card and the top counter show "03A / 15" and "03B / 15", the layer tag reads "Part 03A" / "Part 03B" (timeline names "Reel 3A" / "Reel 3B"). Part 1 ends on a
  line about 3 s before the split; part 2's hook is the first line after 3 s.

## Batch process
1. Build two samples (one talk-heavy, one screen-heavy) and get approval.
2. For each remaining reel, duplicate the approved sample timeline (it keeps tracks, ducking and the
   caption style), rename it "Reel N - Title", delete its items, add the generated items.
3. Fix caption layout (top 1350) and hide the hook captions under the intro card.
4. Verify stills: intro, hook, every move (first/mid/landing), stacked, each card, each callout,
   each break, ending, outro.

---

<!-- file: references/sound.md -->

# Sound

- **Voice**: webcam carries all speech; screen audio muted. Reels: speaker clips -3 dB ("my
  talking volume a bit too much"). AI voice isolation on every webcam clip in master and reels
  before export (never on music or SFX).
- **Music**: one mellow instrumental bed (soft keys, light pad, gentle beat, about 80 BPM, no vocals,
  no drops). Generate once and reuse.
  - Level: -26 dB gain with 8 dB ducking under the webcam voice: about 27 dB under speech while
    talking, 19 dB in pauses. The creator asked for "very low mellow music that doesn't distract"
    and then said "lower" twice; do not start louder.
  - Master: loop with about 3 s crossfades to cover the full length.
  - Reels: start each reel at a different offset into the track, fade in 15 frames, fade out 45.
    If a reel is longer than the track, continue with a second piece from about 30 s in, crossfaded.
- **Whooshes (reels)**: deep short whoosh at frame 7 (0.54), airy short at frame 54 (0.315) as the
  intro leaves and at END+7 for the outro (0.315), simple whoosh 5 frames into each layout move
  (0.36), skipped within 45 frames of another whoosh.
- **Master**: heavier whoosh on chapter-card entry, quieter on exit; soft whoosh on in-view moves.
- Say plainly that levels were set from measured loudness and need a listen.

---

## File: examples/graphics/Backdrop.tsx

```tsx
import React from "react";
import { AbsoluteFill } from "remotion";

// Flat full-frame card behind a reel graphic, so the graphic never sits on the speaker.

type Props = { color: string };

export default function Backdrop({ item }: { item: { props: Props } }) {
  return <AbsoluteFill style={{ backgroundColor: item.props.color }} />;
}
```

---

## File: examples/graphics/Callout.tsx

```tsx
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Piece 1 "Screen callout" and piece 2 "Prompt line" from the motion graphics guide.
// The screen panel dims to 40% except one rectangle (400 ms). Box mode: a lime outline
// snaps around it (150 ms). Line mode: a lime bar sits behind the line at 25% (150 ms).
// No labels. Undims over the last 400 ms.

type Props = {
  mode: string; // "box" | "line"
  dimX: number; dimY: number; dimW: number; dimH: number;
  x: number; y: number; w: number; h: number;
  pad: number;
  accentColor: string;
  dimOpacity: number;
  lineWidth: number;
};

const INOUT = Easing.inOut(Easing.cubic);
const OUT = Easing.out(Easing.cubic);
const ramp = (f: number, a: number, b: number, e = INOUT) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

export default function Callout({ item }: { item: { props: Props } }) {
  const props = item.props;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const ms = (v: number) => (v / 1000) * fps;

  const dimIn = ramp(frame, 0, ms(400));
  const dimOut = ramp(frame, durationInFrames - ms(400), durationInFrames);
  const dim = dimIn * (1 - dimOut);
  const snap = ramp(frame, ms(400), ms(550), OUT) * (1 - dimOut);

  const hx = props.x - props.pad, hy = props.y - props.pad, hw = props.w + props.pad * 2, hh = props.h + props.pad * 2;
  const dx = props.dimX, dy = props.dimY, dw = props.dimW, dh = props.dimH;
  const shade = `rgba(0,0,0,${props.dimOpacity * dim})`;
  const r = (left: number, top: number, width: number, height: number, key: string) =>
    width > 0 && height > 0 ? <div key={key} style={{ position: "absolute", left, top, width, height, background: shade }} /> : null;

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      {r(dx, dy, dw, Math.max(0, hy - dy), "t")}
      {r(dx, hy + hh, dw, Math.max(0, dy + dh - (hy + hh)), "b")}
      {r(dx, hy, Math.max(0, hx - dx), hh, "l")}
      {r(hx + hw, hy, Math.max(0, dx + dw - (hx + hw)), hh, "r")}
      {props.mode === "line" ? (
        <div style={{ position: "absolute", left: hx, top: hy, width: hw, height: hh, background: props.accentColor, opacity: 0.25 * snap }} />
      ) : (
        <div style={{ position: "absolute", left: hx, top: hy, width: hw, height: hh, border: `${Math.max(1, props.lineWidth)}px solid ${props.accentColor}`, boxSizing: "border-box", opacity: snap }} />
      )}
    </AbsoluteFill>
  );
}
```

---

## File: examples/graphics/ChapterCard.tsx

```tsx
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

type Props = {
  partNumber: number;
  totalParts: number;
  title: string;
  layerTag: string;
  cursorName: string;
  cursorColor: string;
  cursorFont: string;
  showProgress: boolean;
  backgroundColor: string;
  inkColor: string;
  mutedColor: string;
  selectionColor: string;
  accentColor: string;
  titleFont: string;
  monoFont: string;
};

const OUT = Easing.bezier(0.16, 1, 0.3, 1);
const IN = Easing.bezier(0.7, 0, 0.84, 0);

const ramp = (f: number, a: number, b: number, ease = OUT) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

const pad = (n: number) => String(Math.max(0, Math.round(n))).padStart(2, "0");

const Handle = ({ x, y, color, o }: { x: string; y: string; color: string; o: number }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: 12,
      height: 12,
      marginLeft: -6,
      marginTop: -6,
      background: "#FFFFFF",
      border: `2px solid ${color}`,
      boxSizing: "border-box",
      opacity: o,
      transform: `scale(${0.6 + 0.4 * o})`,
    }}
  />
);

export default function ChapterCard({ item }: { item: { props: Props } }) {
  const p = item.props;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Card wipes up from the bottom, holds, then wipes out through the top.
  const exitStart = durationInFrames - 12;
  const enter = ramp(frame, 0, 14);
  const exit = ramp(frame, exitStart, durationInFrames, IN);
  const clipTop = 100 * exit;
  const clipBottom = 100 * (1 - enter);

  // Content beats (frames from the card's own start).
  const meta = ramp(frame, 6, 20);
  const title = ramp(frame, 8, 24);
  // Marquee drag from the right edge to the left, then the selection settles.
  const select = ramp(frame, 16, 34, Easing.bezier(0.45, 0, 0.2, 1));
  const handles = ramp(frame, 33, 40);
  // Cursor: appears at the right edge, leads the drag, then lets go and drifts away.
  const cursorIn = ramp(frame, 8, 16);
  const cursorOut = ramp(frame, 40, 52, IN);
  const fill = ramp(frame, 26, 44);
  const contentLift = -24 * exit;

  // Keep every title on one line: Bebas Neue averages ~0.36em per character, so shrink
  // only titles that would overflow the 1680px column.
  const titleSize = Math.min(184, Math.floor(1680 / (Math.max(1, p.title.length) * 0.37)));

  const total = Math.max(1, Math.round(p.totalParts));
  const current = Math.min(total, Math.max(0, Math.round(p.partNumber)));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: p.backgroundColor,
        clipPath: `inset(${clipTop}% 0 ${clipBottom}% 0)`,
        fontFamily: `"${p.titleFont}", sans-serif`,
        color: p.inkColor,
      }}
    >
      {/* Canvas dot grid, like a design tool artboard background */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${p.inkColor}1F 1.5px, transparent 1.6px)`,
          backgroundSize: "32px 32px",
          backgroundPosition: "16px 16px",
          opacity: 0.9,
        }}
      />

      <AbsoluteFill
        style={{
          padding: 120,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          transform: `translateY(${contentLift}px)`,
        }}
      >
        {/* Top row: part counter */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "baseline",
            gap: 12,
            fontFamily: `"${p.titleFont}", sans-serif`,
            fontSize: 62,
            lineHeight: 1,
            letterSpacing: 2,
            opacity: meta,
            transform: `translateY(${16 * (1 - meta)}px)`,
          }}
        >
          <span style={{ color: p.inkColor }}>{pad(current)}</span>
          <span style={{ color: p.mutedColor }}>/ {pad(total)}</span>
        </div>

        {/* Title block, framed like a selected layer */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32, alignItems: "flex-start" }}>
          <div style={{ position: "relative", width: "fit-content", maxWidth: 1680 }}>
            {/* Layer tag */}
            <div
              style={{
                position: "absolute",
                left: -2,
                top: -64,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: p.selectionColor,
                color: "#FFFFFF",
                fontFamily: `"${p.monoFont}", monospace`,
                fontSize: 22,
                letterSpacing: 1,
                opacity: handles,
                transform: `translateY(${8 * (1 - handles)}px)`,
              }}
            >
              {p.layerTag}
            </div>

            {/* Selection marquee: dragged from the right edge to the left */}
            <div
              style={{
                position: "absolute",
                top: -16,
                bottom: -16,
                right: -32,
                left: `calc(${(1 - select) * 100}% - ${32 * select}px)`,
                border: `2px solid ${p.selectionColor}`,
                background: `${p.selectionColor}${Math.round(0x1f * (1 - handles)).toString(16).padStart(2, "0")}`,
                opacity: select > 0 ? 1 : 0,
              }}
            >
              <Handle x="0%" y="0%" color={p.selectionColor} o={handles} />
              <Handle x="100%" y="0%" color={p.selectionColor} o={handles} />
              <Handle x="0%" y="100%" color={p.selectionColor} o={handles} />
              <Handle x="100%" y="100%" color={p.selectionColor} o={handles} />
            </div>

            {/* Figma-style multiplayer cursor with a name tag, leading the marquee's bottom-left corner */}
            <div
              style={{
                position: "absolute",
                left: `calc(${(1 - select) * 100}% - ${32 * select}px)`,
                top: "calc(100% + 16px)",
                zIndex: 3,
                opacity: cursorIn * (1 - cursorOut),
                transform: `translate(${-16 * cursorOut}px, ${24 * cursorOut}px)`,
              }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                style={{ position: "absolute", left: -4, top: -4, overflow: "visible" }}
              >
                <path
                  d="M3 2.5 L19.5 9 L12 11.8 L9.2 19.5 Z"
                  fill={p.cursorColor}
                  stroke="#FFFFFF"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  left: 32,
                  top: 32,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: p.cursorColor,
                  color: "#FFFFFF",
                  fontFamily: `"${p.cursorFont}", sans-serif`,
                  fontSize: 24,
                  fontWeight: 600,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                }}
              >
                {p.cursorName}
              </div>
            </div>

            {/* Title rises out of a mask */}
            <div style={{ overflow: "hidden", padding: "0 0 8px 0" }}>
              <div
                style={{
                  fontSize: titleSize,
                  fontWeight: 400,
                  letterSpacing: 2,
                  lineHeight: 0.9,
                  whiteSpace: "nowrap",
                  transform: `translateY(${110 * (1 - title)}%)`,
                }}
              >
                {p.title}
              </div>
            </div>
          </div>

        </div>

        {/* Progress strip: one segment per part, the current one unlocks. Lifted clear of the caption band. */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 120, opacity: p.showProgress ? meta : 0 }}>
          {Array.from({ length: total }, (_, i) => {
            const n = i + 1;
            const done = n < current;
            const isNow = n === current;
            return (
              <div
                key={n}
                style={{ width: 17, height: 128, background: `${p.inkColor}2E`, position: "relative", overflow: "hidden" }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: done ? p.inkColor : p.accentColor,
                    transformOrigin: "center bottom",
                    transform: `scaleY(${done ? 1 : isNow ? fill : 0})`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
```

---

## File: examples/graphics/ContrastChip.tsx

```tsx
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Piece 8 "Contrast chip": can you read this? A failing pair stays muted, a passing pair
// gets a lime outline. Only text: the site's own price and the measured ratio.

type Props = {
  price: string;
  failBg: string; failFg: string; failRatio: string;
  passBg: string; passFg: string; passRatio: string;
  secondAt: number;
  canvasColor: string; lineColor: string; accentColor: string;
  priceFont: string; monoFont: string; lineWidth: number;
};

const MOVE = Easing.bezier(0.2, 0.8, 0.2, 1);
const INOUT = Easing.inOut(Easing.cubic);
const IN = Easing.in(Easing.cubic);
const OUT = Easing.out(Easing.cubic);
const ramp = (f: number, a: number, b: number, e = MOVE) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

export default function ContrastChip({ item }: { item: { props: Props } }) {
  const props = item.props;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const ms = (v: number) => (v / 1000) * fps;
  const lw = Math.max(1, props.lineWidth);

  const reveal = ramp(frame, 0, ms(400), INOUT);
  const exit = ramp(frame, durationInFrames - ms(200), durationInFrames, IN);
  const c1 = ramp(frame, ms(200), ms(450));
  const c2 = ramp(frame, props.secondAt, props.secondAt + ms(250));
  const ok = ramp(frame, props.secondAt + ms(250), props.secondAt + ms(400), OUT);

  const chip = (bg: string, fg: string, ratio: string, x: number, t: number, pass: boolean) => (
    <div style={{ position: "absolute", left: x, top: 96, width: 240, opacity: t, transform: `translateY(${16 * (1 - t)}px)` }}>
      <div
        style={{
          height: 160,
          background: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: `"${props.priceFont}", sans-serif`,
          fontWeight: 600,
          fontSize: 48,
          color: fg,
          outline: pass ? `${lw}px solid ${props.accentColor}` : "none",
          outlineOffset: 8,
          outlineColor: pass ? `rgba(215,243,107,${ok})` : "transparent",
        }}
      >
        {props.price}
      </div>
      <div
        style={{
          marginTop: 32,
          textAlign: "center",
          fontFamily: `"${props.monoFont}", monospace`,
          fontSize: 32,
          color: props.lineColor,
          opacity: pass ? 1 : 0.3,
        }}
      >
        {ratio}
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: props.canvasColor, clipPath: `inset(0 0 ${100 * (1 - reveal)}% 0)`, opacity: 1 - exit }}>
      {chip(props.failBg, props.failFg, props.failRatio, 64, c1, false)}
      {chip(props.passBg, props.passFg, props.passRatio, 336, c2, true)}
    </AbsoluteFill>
  );
}
```

---

## File: examples/graphics/Diagram.tsx

```tsx
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Generic layout diagram for the PG site video (wireframes + flow lines + measure line).
// Driven by a JSON "spec": a list of steps, each the full state of the diagram at a moment.
// Blocks tween between steps in 250 ms (move), flow lines draw in 400 ms with a dot that
// travels once, and the target outlines in the accent when the dot arrives.
// No text: icons only (Phosphor thin), per the motion graphics guide.

const ICONS: Record<string, string> = {"bed": "M216,76H28V48a4,4,0,0,0-8,0V208a4,4,0,0,0,8,0V172H244v36a4,4,0,0,0,8,0V112A36,36,0,0,0,216,76ZM28,84h80v80H28Zm88,80V84H216a28,28,0,0,1,28,28v52Z", "credit-card": "M224,52H32A12,12,0,0,0,20,64V192a12,12,0,0,0,12,12H224a12,12,0,0,0,12-12V64A12,12,0,0,0,224,52ZM32,60H224a4,4,0,0,1,4,4V92H28V64A4,4,0,0,1,32,60ZM224,196H32a4,4,0,0,1-4-4V100H228v92A4,4,0,0,1,224,196Zm-20-28a4,4,0,0,1-4,4H168a4,4,0,0,1,0-8h32A4,4,0,0,1,204,168Zm-64,0a4,4,0,0,1-4,4H120a4,4,0,0,1,0-8h16A4,4,0,0,1,140,168Z", "currency-inr": "M204,80a4,4,0,0,1-4,4H163.42a57,57,0,0,1,.58,8,56.06,56.06,0,0,1-56,56H82.35l80.34,73a4,4,0,1,1-5.38,5.92l-88-80A4,4,0,0,1,72,140h36a48,48,0,0,0,47.32-56H72a4,4,0,0,1,0-8h81.25A48.09,48.09,0,0,0,108,44H72a4,4,0,0,1,0-8H200a4,4,0,0,1,0,8H136.81a56.24,56.24,0,0,1,24.85,32H200A4,4,0,0,1,204,80Z", "database": "M192.14,42.55C174.94,33.17,152.16,28,128,28S81.06,33.17,63.86,42.55C45.89,52.35,36,65.65,36,80v96c0,14.35,9.89,27.65,27.86,37.45,17.2,9.38,40,14.55,64.14,14.55s46.94-5.17,64.14-14.55c18-9.8,27.86-23.1,27.86-37.45V80C220,65.65,210.11,52.35,192.14,42.55ZM212,176c0,11.29-8.41,22.1-23.69,30.43C172.27,215.18,150.85,220,128,220s-44.27-4.82-60.31-13.57C52.41,198.1,44,187.29,44,176V149.48c4.69,5.93,11.37,11.34,19.86,16,17.2,9.38,40,14.55,64.14,14.55s46.94-5.17,64.14-14.55c8.49-4.63,15.17-10,19.86-16Zm0-48c0,11.29-8.41,22.1-23.69,30.43C172.27,167.18,150.85,172,128,172s-44.27-4.82-60.31-13.57C52.41,150.1,44,139.29,44,128V101.48c4.69,5.93,11.37,11.34,19.86,16,17.2,9.38,40,14.55,64.14,14.55s46.94-5.17,64.14-14.55c8.49-4.63,15.17-10,19.86-16Zm-23.69-17.57C172.27,119.18,150.85,124,128,124s-44.27-4.82-60.31-13.57C52.41,102.1,44,91.29,44,80s8.41-22.1,23.69-30.43C83.73,40.82,105.15,36,128,36s44.27,4.82,60.31,13.57C203.59,57.9,212,68.71,212,80S203.59,102.1,188.31,110.43Z", "envelope-simple": "M224,52H32a4,4,0,0,0-4,4V192a12,12,0,0,0,12,12H216a12,12,0,0,0,12-12V56A4,4,0,0,0,224,52Zm-10.28,8L128,138.57,42.28,60ZM216,196H40a4,4,0,0,1-4-4V65.09L125.3,147a4,4,0,0,0,5.4,0L220,65.09V192A4,4,0,0,1,216,196Z", "fork-knife": "M76,88V40a4,4,0,0,1,8,0V88a4,4,0,0,1-8,0ZM212,40V224a4,4,0,0,1-8,0V172H152a4,4,0,0,1-4-4,264.27,264.27,0,0,1,7.11-55.94c9.47-39.22,27.21-65.41,51.31-75.74A4,4,0,0,1,212,40Zm-8,6.46C162.25,70.33,156.81,145.75,156.1,164H204Zm-88-7.12a4,4,0,0,0-7.9,1.32l8,47.66a36,36,0,0,1-72,0l8-47.66a4,4,0,0,0-7.9-1.32l-8,48A4.89,4.89,0,0,0,36,88a44.06,44.06,0,0,0,40,43.81V224a4,4,0,0,0,8,0V131.81A44.06,44.06,0,0,0,124,88a4.89,4.89,0,0,0,0-.66Z", "images": "M216,44H72A12,12,0,0,0,60,56V76H40A12,12,0,0,0,28,88V200a12,12,0,0,0,12,12H184a12,12,0,0,0,12-12V180h20a12,12,0,0,0,12-12V56A12,12,0,0,0,216,44ZM68,56a4,4,0,0,1,4-4H216a4,4,0,0,1,4,4v72.4l-16.89-16.89a12,12,0,0,0-17,0l-22.83,22.83L116.49,87.51a12,12,0,0,0-17,0L68,119ZM188,200a4,4,0,0,1-4,4H40a4,4,0,0,1-4-4V88a4,4,0,0,1,4-4H60v84a12,12,0,0,0,12,12H188Zm28-28H72a4,4,0,0,1-4-4V130.34l37.17-37.17a4,4,0,0,1,5.66,0l49.66,49.66a4,4,0,0,0,5.65,0l25.66-25.66a4,4,0,0,1,5.66,0L220,139.71V168A4,4,0,0,1,216,172ZM164,84a8,8,0,1,1,8,8A8,8,0,0,1,164,84Z", "list-bullets": "M84,64a4,4,0,0,1,4-4H216a4,4,0,0,1,0,8H88A4,4,0,0,1,84,64Zm132,60H88a4,4,0,0,0,0,8H216a4,4,0,0,0,0-8Zm0,64H88a4,4,0,0,0,0,8H216a4,4,0,0,0,0-8ZM44,120a8,8,0,1,0,8,8A8,8,0,0,0,44,120Zm0-64a8,8,0,1,0,8,8A8,8,0,0,0,44,56Zm0,128a8,8,0,1,0,8,8A8,8,0,0,0,44,184Z", "list-checks": "M220,128a4,4,0,0,1-4,4H128a4,4,0,0,1,0-8h88A4,4,0,0,1,220,128ZM128,68h88a4,4,0,0,0,0-8H128a4,4,0,0,0,0,8Zm88,120H128a4,4,0,0,0,0,8h88a4,4,0,0,0,0-8ZM85.17,45.17,56,74.34,42.83,61.17a4,4,0,0,0-5.66,5.66l16,16a4,4,0,0,0,5.66,0l32-32a4,4,0,0,0-5.66-5.66Zm0,64L56,138.34,42.83,125.17a4,4,0,1,0-5.66,5.66l16,16a4,4,0,0,0,5.66,0l32-32a4,4,0,0,0-5.66-5.66Zm0,64L56,202.34,42.83,189.17a4,4,0,0,0-5.66,5.66l16,16a4,4,0,0,0,5.66,0l32-32a4,4,0,0,0-5.66-5.66Z", "list": "M220,128a4,4,0,0,1-4,4H40a4,4,0,0,1,0-8H216A4,4,0,0,1,220,128ZM40,68H216a4,4,0,0,0,0-8H40a4,4,0,0,0,0,8ZM216,188H40a4,4,0,0,0,0,8H216a4,4,0,0,0,0-8Z", "map-pin": "M128,68a36,36,0,1,0,36,36A36,36,0,0,0,128,68Zm0,64a28,28,0,1,1,28-28A28,28,0,0,1,128,132Zm0-112a84.09,84.09,0,0,0-84,84c0,30.42,14.17,62.79,41,93.62a250,250,0,0,0,40.73,37.66,4,4,0,0,0,4.58,0A250,250,0,0,0,171,197.62c26.81-30.83,41-63.2,41-93.62A84.09,84.09,0,0,0,128,20Zm37.1,172.23A254.62,254.62,0,0,1,128,227a254.62,254.62,0,0,1-37.1-34.81C73.15,171.8,52,139.9,52,104a76,76,0,0,1,152,0C204,139.9,182.85,171.8,165.1,192.23Z", "phone": "M220.78,162.13,173.56,141A12,12,0,0,0,162.18,142a3.37,3.37,0,0,0-.38.28L137,163.42a3.93,3.93,0,0,1-3.7.21c-16.24-7.84-33.05-24.52-40.89-40.57a3.9,3.9,0,0,1,.18-3.69l21.2-25.21c.1-.12.19-.25.28-.38a12,12,0,0,0,1-11.36L93.9,35.28a12,12,0,0,0-12.48-7.19A52.25,52.25,0,0,0,36,80c0,77.2,62.8,140,140,140a52.25,52.25,0,0,0,51.91-45.42A12,12,0,0,0,220.78,162.13ZM220,173.58A44.23,44.23,0,0,1,176,212C103.22,212,44,152.78,44,80A44.23,44.23,0,0,1,82.42,36a3.87,3.87,0,0,1,.48,0,4,4,0,0,1,3.67,2.49l21.11,47.14a4,4,0,0,1-.23,3.6l-21.19,25.2c-.1.13-.2.25-.29.39a12,12,0,0,0-.78,11.75c8.69,17.79,26.61,35.58,44.6,44.27a12,12,0,0,0,11.79-.87l.37-.28,24.83-21.12a3.93,3.93,0,0,1,3.57-.27l47.21,21.16A4,4,0,0,1,220,173.58Z", "question": "M136,180a8,8,0,1,1-8-8A8,8,0,0,1,136,180ZM128,76c-19.85,0-36,14.36-36,32v4a4,4,0,0,0,8,0v-4c0-13.23,12.56-24,28-24s28,10.77,28,24-12.56,24-28,24a4,4,0,0,0-4,4v8a4,4,0,0,0,8,0v-4.2c18-1.77,32-15.36,32-31.8C164,90.36,147.85,76,128,76Zm100,52A100,100,0,1,1,128,28,100.11,100.11,0,0,1,228,128Zm-8,0a92,92,0,1,0-92,92A92.1,92.1,0,0,0,220,128Z", "whatsapp-logo": "M185.79,148.42l-32-16a4,4,0,0,0-4,.25l-16.64,11.1a44.56,44.56,0,0,1-20.91-20.91l11.1-16.64a4,4,0,0,0,.25-4l-16-32A4,4,0,0,0,104,68a36,36,0,0,0-36,36,84.09,84.09,0,0,0,84,84,36,36,0,0,0,36-36A4,4,0,0,0,185.79,148.42ZM152,180a76.08,76.08,0,0,1-76-76,28,28,0,0,1,25.58-27.9l13.8,27.61-11,16.54A4,4,0,0,0,104,124a52.43,52.43,0,0,0,28,28,4,4,0,0,0,3.76-.37l16.54-11,27.61,13.8A28,28,0,0,1,152,180ZM128,28A100,100,0,0,0,40.53,176.5l-11.9,35.69a12,12,0,0,0,15.18,15.18l35.69-11.9A100,100,0,1,0,128,28Zm0,192a92,92,0,0,1-46.07-12.35,4.05,4.05,0,0,0-2-.54,3.93,3.93,0,0,0-1.27.21L41.28,219.78a4,4,0,0,1-5.06-5.06l12.46-37.38a4,4,0,0,0-.33-3.27A92,92,0,1,1,128,220Z", "wifi-high": "M136,204a8,8,0,1,1-8-8A8,8,0,0,1,136,204ZM234.54,90.1a168,168,0,0,0-213.08,0,4,4,0,1,0,5.08,6.18,160,160,0,0,1,202.92,0,4,4,0,0,0,5.08-6.18Zm-32.06,35.81a120,120,0,0,0-149,0,4,4,0,0,0,5,6.27,112,112,0,0,1,139,0,4,4,0,0,0,5-6.27Zm-32.13,35.86a72,72,0,0,0-84.7,0,4,4,0,1,0,4.7,6.46,64.07,64.07,0,0,1,75.3,0,4,4,0,0,0,5.58-.87A4,4,0,0,0,170.35,161.77Z"};

type Block = { x: number; y: number; w: number; h: number; icon?: string; border?: boolean; hatch?: boolean; outline?: boolean; dim?: boolean; iconSize?: number };
type Step = { at: number; blocks: Record<string, Block>; flows?: [string, string][]; measure?: { x: number; y1: number; y2: number } | null };
type Spec = { steps: Step[] };
type Props = { spec: string; canvasColor: string; lineColor: string; accentColor: string; lineWidth: number; showCanvas: boolean; panelW: number; panelH: number };

const MOVE = Easing.bezier(0.2, 0.8, 0.2, 1);
const INOUT = Easing.inOut(Easing.cubic);
const IN = Easing.in(Easing.cubic);
const OUT = Easing.out(Easing.cubic);
const ramp = (f: number, a: number, b: number, e = MOVE) =>
  b <= a ? (f >= a ? 1 : 0) : interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function centerBottom(b: Block) { return [b.x + b.w / 2, b.y + b.h]; }
function centerTop(b: Block) { return [b.x + b.w / 2, b.y]; }

export default function Diagram({ item }: { item: { props: Props } }) {
  const props = item.props;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const ms = (v: number) => (v / 1000) * fps;
  let spec: Spec = { steps: [] };
  try { spec = JSON.parse(props.spec); } catch (e) {}
  const steps = spec.steps || [];
  const lw = Math.max(1, props.lineWidth);

  let k = 0;
  for (let i = 0; i < steps.length; i++) if (steps[i].at <= frame) k = i;
  const cur = steps[k] || { at: 0, blocks: {} };
  const prev = k > 0 ? steps[k - 1] : null;
  const t = prev ? ramp(frame, cur.at, cur.at + ms(250)) : 1;
  const snap = prev ? ramp(frame, cur.at, cur.at + ms(150), OUT) : 1;

  const reveal = ramp(frame, 0, ms(400), INOUT);
  const exit = ramp(frame, durationInFrames - ms(200), durationInFrames, IN);
  const firstLand = (i: number) => ramp(frame, ms(200) + i * 2, ms(200) + i * 2 + ms(150), OUT);

  // When was each flow first drawn?
  const flowBorn: Record<string, number> = {};
  steps.forEach((s) => (s.flows || []).forEach(([a, b]) => { const key = a + ">" + b; if (!(key in flowBorn)) flowBorn[key] = s.at; }));

  // Target outline from flows whose dot has arrived.
  const arrived: Record<string, number> = {};
  (cur.flows || []).forEach(([a, b]) => {
    const born = flowBorn[a + ">" + b];
    const v = ramp(frame, born + ms(400) + ms(60), born + ms(400) + ms(60) + ms(150), OUT);
    arrived[b] = Math.max(arrived[b] || 0, v);
  });

  const ids = Array.from(new Set([...Object.keys(prev ? prev.blocks : {}), ...Object.keys(cur.blocks)]));
  const blockEls = ids.map((id, idx) => {
    const a = prev ? prev.blocks[id] : undefined;
    const b = cur.blocks[id];
    const from = a || b!;
    const to = b || a!;
    const presentA = !!a || !prev;
    const presentB = !!b;
    let op = presentA && presentB ? 1 : presentB ? t : 1 - t;
    if (!prev) op = firstLand(idx);
    const x = lerp(from.x, to.x, t), y = lerp(from.y, to.y, t), w = lerp(from.w, to.w, t), h = lerp(from.h, to.h, t);
    const border = lerp(from.border === false ? 0 : 1, to.border === false ? 0 : 1, t);
    const hatch = lerp(from.hatch ? 1 : 0, to.hatch ? 1 : 0, prev ? snap : 1);
    const dim = lerp(from.dim ? 1 : 0, to.dim ? 1 : 0, prev ? snap : 1);
    const outl = Math.max(lerp(from.outline ? 1 : 0, to.outline ? 1 : 0, prev ? snap : 1), arrived[id] || 0);
    const icon = to.icon || from.icon;
    const iconSize = to.iconSize || Math.min(72, Math.max(28, h * 0.55));
    const enterY = presentB && !presentA ? 8 * (1 - t) : 0;
    const color = outl > 0.5 ? props.accentColor : props.lineColor;
    return (
      <div key={id} style={{ position: "absolute", left: x, top: y + enterY, width: w, height: h, opacity: op * (1 - 0.7 * dim) }}>
        <div style={{ position: "absolute", inset: 0, border: `${lw}px solid ${color}`, opacity: Math.max(border, outl), boxSizing: "border-box" }} />
        {hatch > 0.01 && (
          <svg width={w} height={h} style={{ position: "absolute", inset: 0, opacity: 0.5 * hatch }}>
            {Array.from({ length: Math.ceil((w + h) / 14) }, (_, j) => (
              <line key={j} x1={-h + j * 14} y1={h} x2={-h + j * 14 + h} y2={0} stroke={props.lineColor} strokeWidth={lw} />
            ))}
          </svg>
        )}
        {icon && (
          <svg viewBox="0 0 256 256" width={iconSize} height={iconSize} style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
            <path d={ICONS[icon] || ""} fill={outl > 0.5 ? props.accentColor : props.lineColor} />
          </svg>
        )}
      </div>
    );
  });

  // Flow lines
  const flowEls = (cur.flows || []).map(([a, b]) => {
    const A = cur.blocks[a], B = cur.blocks[b];
    if (!A || !B) return null;
    const born = flowBorn[a + ">" + b];
    const d = ramp(frame, born, born + ms(400), INOUT);
    let x1: number, y1: number, x2: number, y2: number, vertical = true;
    if (B.y >= A.y + A.h) { [x1, y1] = centerBottom(A); [x2, y2] = centerTop(B); }
    else if (B.y + B.h <= A.y) { [x1, y1] = centerTop(A); [x2, y2] = centerBottom(B); }
    else if (B.x >= A.x + A.w) { vertical = false; x1 = A.x + A.w; y1 = A.y + A.h / 2; x2 = B.x; y2 = B.y + B.h / 2; }
    else { vertical = false; x1 = A.x; y1 = A.y + A.h / 2; x2 = B.x + B.w; y2 = B.y + B.h / 2; }
    const c1 = vertical ? [x1, (y1 + y2) / 2] : [(x1 + x2) / 2, y1];
    const c2 = vertical ? [x2, (y1 + y2) / 2] : [(x1 + x2) / 2, y2];
    const path = `M ${x1} ${y1} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${x2} ${y2}`;
    // point on cubic for the travelling dot
    const u = d, m = 1 - u;
    const px = m * m * m * x1 + 3 * m * m * u * c1[0] + 3 * m * u * u * c2[0] + u * u * u * x2;
    const py = m * m * m * y1 + 3 * m * m * u * c1[1] + 3 * m * u * u * c2[1] + u * u * u * y2;
    const len = 2000;
    return (
      <g key={a + ">" + b}>
        <path d={path} fill="none" stroke={props.accentColor} strokeWidth={lw} strokeDasharray={len} strokeDashoffset={len * (1 - d)} pathLength={len} />
        {d > 0 && d < 1 && <circle cx={px} cy={py} r={6} fill={props.accentColor} />}
      </g>
    );
  });

  // Measure line (vertical), grows from its centre on first appearance, then resizes with steps.
  let measureEl = null;
  const mCur = cur.measure, mPrev = prev ? prev.measure : null;
  if (mCur) {
    const firstIdx = steps.findIndex((s) => !!s.measure);
    const grow = ramp(frame, steps[firstIdx].at, steps[firstIdx].at + ms(400), INOUT);
    const tick = ramp(frame, steps[firstIdx].at + ms(400), steps[firstIdx].at + ms(550), OUT);
    const y1 = mPrev ? lerp(mPrev.y1, mCur.y1, t) : mCur.y1;
    const y2 = mPrev ? lerp(mPrev.y2, mCur.y2, t) : mCur.y2;
    const cy = (y1 + y2) / 2, half = ((y2 - y1) / 2) * grow;
    measureEl = (
      <g stroke={props.accentColor} strokeWidth={lw}>
        <line x1={mCur.x} y1={cy - half} x2={mCur.x} y2={cy + half} />
        <line x1={mCur.x - 10} y1={cy - half} x2={mCur.x + 10} y2={cy - half} opacity={tick} />
        <line x1={mCur.x - 10} y1={cy + half} x2={mCur.x + 10} y2={cy + half} opacity={tick} />
      </g>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent", opacity: 1 - exit }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: props.panelW, height: props.panelH, overflow: "hidden", clipPath: `inset(0 0 ${100 * (1 - reveal)}% 0)`, backgroundColor: props.showCanvas ? props.canvasColor : "transparent" }}>
      {blockEls}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
        {flowEls}
        {measureEl}
      </svg>
      </div>
    </AbsoluteFill>
  );
}
```

---

## File: examples/graphics/KeywordSelect.tsx

```tsx
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Piece 4 "Keyword select" from the PG site motion graphics doc.
// The word appears on the spoken keyword, a selection box snaps around it,
// handles pop 60 ms later, the word lands at 1.04 and settles, holds, then exits in 200 ms.

type Props = {
  text: string;
  textColor: string;
  accentColor: string;
  font: string;
  fontSize: number;
  lineWidth: number;
  maxWidth: number;
};

const OUT = Easing.out(Easing.cubic);
const IN = Easing.in(Easing.cubic);
const ramp = (f: number, a: number, b: number, ease = OUT) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

export default function KeywordSelect({ item }: { item: { props: Props } }) {
  const p = item.props;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const ms = (v: number) => (v / 1000) * fps;

  const snap = ramp(frame, 0, ms(150));                  // corners draw: 150 ms snap
  const handles = ramp(frame, ms(60), ms(60) + ms(150));  // handles pop 60 ms after
  const settle = ramp(frame, 0, ms(120));                 // 1.04 -> 1.0 in 120 ms
  const scale = 1.04 - 0.04 * settle;
  const exit = ramp(frame, durationInFrames - ms(200), durationInFrames, IN); // 200 ms exit
  const lw = Math.max(1, p.lineWidth);

  // Each corner bracket grows along both edges until the four meet as one rectangle.
  const arm = `${50 * snap}%`;
  const corner = (pos: React.CSSProperties, h: "left" | "right", v: "top" | "bottom") => (
    <>
      <div style={{ position: "absolute", ...pos, width: arm, height: lw, background: p.accentColor, [v]: 0, [h]: 0 }} />
      <div style={{ position: "absolute", ...pos, width: lw, height: arm, background: p.accentColor, [v]: 0, [h]: 0 }} />
    </>
  );
  const handle = (x: string, y: string) => (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 12,
        height: 12,
        marginLeft: -6,
        marginTop: -6,
        background: p.accentColor,
        transform: `scale(${handles})`,
      }}
    />
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent", justifyContent: "center", alignItems: "flex-start", padding: 32 }}>
      <div
        style={{
          position: "relative",
          maxWidth: p.maxWidth,
          opacity: (frame >= 0 ? 1 : 0) * (1 - exit),
          transform: `scale(${scale * (1 - 0.03 * exit)})`,
          transformOrigin: "left center",
        }}
      >
        <div style={{ position: "absolute", inset: -16 }}>
          {corner({}, "left", "top")}
          {corner({}, "right", "top")}
          {corner({}, "left", "bottom")}
          {corner({}, "right", "bottom")}
          {handle("0%", "0%")}
          {handle("100%", "0%")}
          {handle("0%", "100%")}
          {handle("100%", "100%")}
        </div>
        <div
          style={{
            fontFamily: `"${p.font}", sans-serif`,
            fontWeight: 600,
            fontSize: p.fontSize,
            lineHeight: 1.0,
            letterSpacing: -2,
            color: p.textColor,
            whiteSpace: "normal",
            overflowWrap: "break-word",
          }}
        >
          {p.text}
        </div>
      </div>
    </AbsoluteFill>
  );
}
```

---

## File: examples/graphics/PartTag.tsx

```tsx
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Persistent "you are here" tag shown between chapter cards: a quiet pill, top left.
// Part number in the chapter card's title font, part name in Inter. Fades in after the
// card wipes away, fades out just before the next card.

type Props = {
  partNumber: number;
  totalParts: number;
  title: string;
  numberFont: string;
  titleFont: string;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
};

const OUT = Easing.out(Easing.cubic);
const IN = Easing.in(Easing.cubic);
const ramp = (f: number, a: number, b: number, e = OUT) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });
const pad = (n: number) => String(Math.max(0, Math.round(n))).padStart(2, "0");

export default function PartTag({ item }: { item: { props: Props } }) {
  const p = item.props;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const ms = (v: number) => (v / 1000) * fps;

  const enter = ramp(frame, ms(200), ms(700));
  const exit = ramp(frame, durationInFrames - ms(300), durationInFrames, IN);
  const t = enter * (1 - exit);

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent", alignItems: "flex-start", justifyContent: "flex-start" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          height: 48,
          padding: "0 16px",
          borderRadius: 8,
          background: p.backgroundColor,
          border: `1px solid ${p.borderColor}`,
          boxSizing: "border-box",
          opacity: t,
          transform: `translateY(${-8 * (1 - enter)}px)`,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontFamily: `"${p.numberFont}", sans-serif`, fontSize: 30, lineHeight: 1, letterSpacing: 1, color: p.textColor, opacity: 0.9 }}>
          {pad(p.partNumber)}
          <span style={{ opacity: 0.45 }}> / {pad(p.totalParts)}</span>
        </span>
        <span style={{ width: 1, height: 20, background: p.textColor, opacity: 0.25 }} />
        <span style={{ fontFamily: `"${p.titleFont}", sans-serif`, fontWeight: 500, fontSize: 22, lineHeight: 1, color: p.textColor, opacity: 0.75 }}>
          {p.title}
        </span>
      </div>
    </AbsoluteFill>
  );
}
```

---

## File: examples/graphics/ProgressBar.tsx

```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

// Reel progress bar: a thin line along the bottom edge that fills left to right over the whole
// reel (ink over the paper intro/outro cards), so viewers see how much is left. Place it full-frame across the entire reel (frame 0 to
// the end of the outro) on the top track. Linear fill, no easing, no labels.

type Props = {
  lineColor: string;
  trackOpacity: number;
  thickness: number;
  lightColor: string;
  introFrames: number;
  outroFrames: number;
};

export default function ProgressBar({ item }: { item: { props: Props } }) {
  const p = item.props;
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const t = Math.min(1, Math.max(0, (frame + 1) / Math.max(1, durationInFrames)));
  const h = Math.max(1, p.thickness);
  // Over the paper intro and outro cards the line switches to ink so it stays visible.
  const onPaper = frame < (p.introFrames || 0) || frame >= durationInFrames - (p.outroFrames || 0);
  const color = onPaper ? p.lightColor : p.lineColor;

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <div style={{ position: "absolute", left: 0, top: height - h, width, height: h, backgroundColor: color, opacity: p.trackOpacity }} />
      <div style={{ position: "absolute", left: 0, top: height - h, width: width * t, height: h, backgroundColor: color }} />
    </AbsoluteFill>
  );
}
```

---

## File: examples/graphics/ReelDiagram.tsx

```tsx
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const ICONS: Record<string, string> = {"bed": "M216,76H28V48a4,4,0,0,0-8,0V208a4,4,0,0,0,8,0V172H244v36a4,4,0,0,0,8,0V112A36,36,0,0,0,216,76ZM28,84h80v80H28Zm88,80V84H216a28,28,0,0,1,28,28v52Z", "credit-card": "M224,52H32A12,12,0,0,0,20,64V192a12,12,0,0,0,12,12H224a12,12,0,0,0,12-12V64A12,12,0,0,0,224,52ZM32,60H224a4,4,0,0,1,4,4V92H28V64A4,4,0,0,1,32,60ZM224,196H32a4,4,0,0,1-4-4V100H228v92A4,4,0,0,1,224,196Zm-20-28a4,4,0,0,1-4,4H168a4,4,0,0,1,0-8h32A4,4,0,0,1,204,168Zm-64,0a4,4,0,0,1-4,4H120a4,4,0,0,1,0-8h16A4,4,0,0,1,140,168Z", "currency-inr": "M204,80a4,4,0,0,1-4,4H163.42a57,57,0,0,1,.58,8,56.06,56.06,0,0,1-56,56H82.35l80.34,73a4,4,0,1,1-5.38,5.92l-88-80A4,4,0,0,1,72,140h36a48,48,0,0,0,47.32-56H72a4,4,0,0,1,0-8h81.25A48.09,48.09,0,0,0,108,44H72a4,4,0,0,1,0-8H200a4,4,0,0,1,0,8H136.81a56.24,56.24,0,0,1,24.85,32H200A4,4,0,0,1,204,80Z", "database": "M192.14,42.55C174.94,33.17,152.16,28,128,28S81.06,33.17,63.86,42.55C45.89,52.35,36,65.65,36,80v96c0,14.35,9.89,27.65,27.86,37.45,17.2,9.38,40,14.55,64.14,14.55s46.94-5.17,64.14-14.55c18-9.8,27.86-23.1,27.86-37.45V80C220,65.65,210.11,52.35,192.14,42.55ZM212,176c0,11.29-8.41,22.1-23.69,30.43C172.27,215.18,150.85,220,128,220s-44.27-4.82-60.31-13.57C52.41,198.1,44,187.29,44,176V149.48c4.69,5.93,11.37,11.34,19.86,16,17.2,9.38,40,14.55,64.14,14.55s46.94-5.17,64.14-14.55c8.49-4.63,15.17-10,19.86-16Zm0-48c0,11.29-8.41,22.1-23.69,30.43C172.27,167.18,150.85,172,128,172s-44.27-4.82-60.31-13.57C52.41,150.1,44,139.29,44,128V101.48c4.69,5.93,11.37,11.34,19.86,16,17.2,9.38,40,14.55,64.14,14.55s46.94-5.17,64.14-14.55c8.49-4.63,15.17-10,19.86-16Zm-23.69-17.57C172.27,119.18,150.85,124,128,124s-44.27-4.82-60.31-13.57C52.41,102.1,44,91.29,44,80s8.41-22.1,23.69-30.43C83.73,40.82,105.15,36,128,36s44.27,4.82,60.31,13.57C203.59,57.9,212,68.71,212,80S203.59,102.1,188.31,110.43Z", "envelope-simple": "M224,52H32a4,4,0,0,0-4,4V192a12,12,0,0,0,12,12H216a12,12,0,0,0,12-12V56A4,4,0,0,0,224,52Zm-10.28,8L128,138.57,42.28,60ZM216,196H40a4,4,0,0,1-4-4V65.09L125.3,147a4,4,0,0,0,5.4,0L220,65.09V192A4,4,0,0,1,216,196Z", "fork-knife": "M76,88V40a4,4,0,0,1,8,0V88a4,4,0,0,1-8,0ZM212,40V224a4,4,0,0,1-8,0V172H152a4,4,0,0,1-4-4,264.27,264.27,0,0,1,7.11-55.94c9.47-39.22,27.21-65.41,51.31-75.74A4,4,0,0,1,212,40Zm-8,6.46C162.25,70.33,156.81,145.75,156.1,164H204Zm-88-7.12a4,4,0,0,0-7.9,1.32l8,47.66a36,36,0,0,1-72,0l8-47.66a4,4,0,0,0-7.9-1.32l-8,48A4.89,4.89,0,0,0,36,88a44.06,44.06,0,0,0,40,43.81V224a4,4,0,0,0,8,0V131.81A44.06,44.06,0,0,0,124,88a4.89,4.89,0,0,0,0-.66Z", "images": "M216,44H72A12,12,0,0,0,60,56V76H40A12,12,0,0,0,28,88V200a12,12,0,0,0,12,12H184a12,12,0,0,0,12-12V180h20a12,12,0,0,0,12-12V56A12,12,0,0,0,216,44ZM68,56a4,4,0,0,1,4-4H216a4,4,0,0,1,4,4v72.4l-16.89-16.89a12,12,0,0,0-17,0l-22.83,22.83L116.49,87.51a12,12,0,0,0-17,0L68,119ZM188,200a4,4,0,0,1-4,4H40a4,4,0,0,1-4-4V88a4,4,0,0,1,4-4H60v84a12,12,0,0,0,12,12H188Zm28-28H72a4,4,0,0,1-4-4V130.34l37.17-37.17a4,4,0,0,1,5.66,0l49.66,49.66a4,4,0,0,0,5.65,0l25.66-25.66a4,4,0,0,1,5.66,0L220,139.71V168A4,4,0,0,1,216,172ZM164,84a8,8,0,1,1,8,8A8,8,0,0,1,164,84Z", "list-bullets": "M84,64a4,4,0,0,1,4-4H216a4,4,0,0,1,0,8H88A4,4,0,0,1,84,64Zm132,60H88a4,4,0,0,0,0,8H216a4,4,0,0,0,0-8Zm0,64H88a4,4,0,0,0,0,8H216a4,4,0,0,0,0-8ZM44,120a8,8,0,1,0,8,8A8,8,0,0,0,44,120Zm0-64a8,8,0,1,0,8,8A8,8,0,0,0,44,56Zm0,128a8,8,0,1,0,8,8A8,8,0,0,0,44,184Z", "list-checks": "M220,128a4,4,0,0,1-4,4H128a4,4,0,0,1,0-8h88A4,4,0,0,1,220,128ZM128,68h88a4,4,0,0,0,0-8H128a4,4,0,0,0,0,8Zm88,120H128a4,4,0,0,0,0,8h88a4,4,0,0,0,0-8ZM85.17,45.17,56,74.34,42.83,61.17a4,4,0,0,0-5.66,5.66l16,16a4,4,0,0,0,5.66,0l32-32a4,4,0,0,0-5.66-5.66Zm0,64L56,138.34,42.83,125.17a4,4,0,1,0-5.66,5.66l16,16a4,4,0,0,0,5.66,0l32-32a4,4,0,0,0-5.66-5.66Zm0,64L56,202.34,42.83,189.17a4,4,0,0,0-5.66,5.66l16,16a4,4,0,0,0,5.66,0l32-32a4,4,0,0,0-5.66-5.66Z", "list": "M220,128a4,4,0,0,1-4,4H40a4,4,0,0,1,0-8H216A4,4,0,0,1,220,128ZM40,68H216a4,4,0,0,0,0-8H40a4,4,0,0,0,0,8ZM216,188H40a4,4,0,0,0,0,8H216a4,4,0,0,0,0-8Z", "map-pin": "M128,68a36,36,0,1,0,36,36A36,36,0,0,0,128,68Zm0,64a28,28,0,1,1,28-28A28,28,0,0,1,128,132Zm0-112a84.09,84.09,0,0,0-84,84c0,30.42,14.17,62.79,41,93.62a250,250,0,0,0,40.73,37.66,4,4,0,0,0,4.58,0A250,250,0,0,0,171,197.62c26.81-30.83,41-63.2,41-93.62A84.09,84.09,0,0,0,128,20Zm37.1,172.23A254.62,254.62,0,0,1,128,227a254.62,254.62,0,0,1-37.1-34.81C73.15,171.8,52,139.9,52,104a76,76,0,0,1,152,0C204,139.9,182.85,171.8,165.1,192.23Z", "phone": "M220.78,162.13,173.56,141A12,12,0,0,0,162.18,142a3.37,3.37,0,0,0-.38.28L137,163.42a3.93,3.93,0,0,1-3.7.21c-16.24-7.84-33.05-24.52-40.89-40.57a3.9,3.9,0,0,1,.18-3.69l21.2-25.21c.1-.12.19-.25.28-.38a12,12,0,0,0,1-11.36L93.9,35.28a12,12,0,0,0-12.48-7.19A52.25,52.25,0,0,0,36,80c0,77.2,62.8,140,140,140a52.25,52.25,0,0,0,51.91-45.42A12,12,0,0,0,220.78,162.13ZM220,173.58A44.23,44.23,0,0,1,176,212C103.22,212,44,152.78,44,80A44.23,44.23,0,0,1,82.42,36a3.87,3.87,0,0,1,.48,0,4,4,0,0,1,3.67,2.49l21.11,47.14a4,4,0,0,1-.23,3.6l-21.19,25.2c-.1.13-.2.25-.29.39a12,12,0,0,0-.78,11.75c8.69,17.79,26.61,35.58,44.6,44.27a12,12,0,0,0,11.79-.87l.37-.28,24.83-21.12a3.93,3.93,0,0,1,3.57-.27l47.21,21.16A4,4,0,0,1,220,173.58Z", "question": "M136,180a8,8,0,1,1-8-8A8,8,0,0,1,136,180ZM128,76c-19.85,0-36,14.36-36,32v4a4,4,0,0,0,8,0v-4c0-13.23,12.56-24,28-24s28,10.77,28,24-12.56,24-28,24a4,4,0,0,0-4,4v8a4,4,0,0,0,8,0v-4.2c18-1.77,32-15.36,32-31.8C164,90.36,147.85,76,128,76Zm100,52A100,100,0,1,1,128,28,100.11,100.11,0,0,1,228,128Zm-8,0a92,92,0,1,0-92,92A92.1,92.1,0,0,0,220,128Z", "whatsapp-logo": "M185.79,148.42l-32-16a4,4,0,0,0-4,.25l-16.64,11.1a44.56,44.56,0,0,1-20.91-20.91l11.1-16.64a4,4,0,0,0,.25-4l-16-32A4,4,0,0,0,104,68a36,36,0,0,0-36,36,84.09,84.09,0,0,0,84,84,36,36,0,0,0,36-36A4,4,0,0,0,185.79,148.42ZM152,180a76.08,76.08,0,0,1-76-76,28,28,0,0,1,25.58-27.9l13.8,27.61-11,16.54A4,4,0,0,0,104,124a52.43,52.43,0,0,0,28,28,4,4,0,0,0,3.76-.37l16.54-11,27.61,13.8A28,28,0,0,1,152,180ZM128,28A100,100,0,0,0,40.53,176.5l-11.9,35.69a12,12,0,0,0,15.18,15.18l35.69-11.9A100,100,0,1,0,128,28Zm0,192a92,92,0,0,1-46.07-12.35,4.05,4.05,0,0,0-2-.54,3.93,3.93,0,0,0-1.27.21L41.28,219.78a4,4,0,0,1-5.06-5.06l12.46-37.38a4,4,0,0,0-.33-3.27A92,92,0,1,1,128,220Z", "wifi-high": "M136,204a8,8,0,1,1-8-8A8,8,0,0,1,136,204ZM234.54,90.1a168,168,0,0,0-213.08,0,4,4,0,1,0,5.08,6.18,160,160,0,0,1,202.92,0,4,4,0,0,0,5.08-6.18Zm-32.06,35.81a120,120,0,0,0-149,0,4,4,0,0,0,5,6.27,112,112,0,0,1,139,0,4,4,0,0,0,5-6.27Zm-32.13,35.86a72,72,0,0,0-84.7,0,4,4,0,1,0,4.7,6.46,64.07,64.07,0,0,1,75.3,0,4,4,0,0,0,5.58-.87A4,4,0,0,0,170.35,161.77Z"};

// 9:16 version of the PG site layout diagram. Full-frame (1080 x 1920) canvas, block coordinates
// are canvas pixels. Optional flat phone outline frames the page wireframe, so a vertical reel
// reads it as "the site on a tenant's phone". Same step model as the long-version Diagram:
// blocks tween between steps, flow lines draw with a travelling dot, the target outlines in the
// accent when the dot arrives, a measure line grows from its centre. No text, icons only.
// `offset` (frames) lets a card resume part-way through the spec after a talking-head break:
// steps run on frame + offset, while the entrance and exit always run on the item's own frames.

type Block = { x: number; y: number; w: number; h: number; icon?: string; border?: boolean; hatch?: boolean; outline?: boolean; dim?: boolean; iconSize?: number };
type Step = { at: number; blocks: Record<string, Block>; flows?: [string, string][]; measure?: { x: number; y1: number; y2: number } | null };
type Spec = { steps: Step[] };
type Props = {
  spec: string;
  offset: number;
  phoneX: number;
  phoneY: number;
  phoneW: number;
  phoneH: number;
  screenColor: string;
  lineColor: string;
  accentColor: string;
  lineWidth: number;
  blockRadius: number;
};

const ENTER = Easing.bezier(0.16, 1, 0.3, 1);
const EXIT = Easing.bezier(0.7, 0, 0.84, 0);
const MOVE = Easing.bezier(0.2, 0.8, 0.2, 1);
const INOUT = Easing.inOut(Easing.cubic);
const OUT = Easing.out(Easing.cubic);
const ramp = (f: number, a: number, b: number, e = MOVE) =>
  b <= a ? (f >= a ? 1 : 0) : interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Phone frame insets: 16 at the sides, 64 top bezel (speaker pill), 32 bottom bezel.
const SIDE = 16, TOP = 64, BOTTOM = 32;

export default function ReelDiagram({ item }: { item: { props: Props } }) {
  const p = item.props;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const ms = (v: number) => (v / 1000) * fps;
  const F = frame + (p.offset || 0);
  let spec: Spec = { steps: [] };
  try { spec = JSON.parse(p.spec); } catch (e) {}
  const steps = spec.steps || [];
  const lw = Math.max(1, p.lineWidth);
  const r = Math.max(0, p.blockRadius);

  let k = 0;
  for (let i = 0; i < steps.length; i++) if (steps[i].at <= F) k = i;
  const cur = steps[k] || { at: 0, blocks: {} };
  const prev = k > 0 ? steps[k - 1] : null;
  const t = prev ? ramp(F, cur.at, cur.at + ms(250)) : 1;
  const snap = prev ? ramp(F, cur.at, cur.at + ms(150), OUT) : 1;

  // Entrance: rise 32 px and fade (expo-out, 14 frames). Content wipes down the screen just after.
  const enter = ramp(frame, 0, 14, ENTER);
  const wipe = ramp(frame, 4, 4 + ms(400), INOUT);
  const exit = ramp(frame, durationInFrames - 8, durationInFrames, EXIT);
  const firstLand = (i: number) => ramp(F, ms(200) + i * 2, ms(200) + i * 2 + ms(150), OUT);

  const flowBorn: Record<string, number> = {};
  steps.forEach((s) => (s.flows || []).forEach(([a, b]) => { const key = a + ">" + b; if (!(key in flowBorn)) flowBorn[key] = s.at; }));
  const arrived: Record<string, number> = {};
  (cur.flows || []).forEach(([a, b]) => {
    const born = flowBorn[a + ">" + b];
    const v = ramp(F, born + ms(460), born + ms(610), OUT);
    arrived[b] = Math.max(arrived[b] || 0, v);
  });

  const ids = Array.from(new Set([...Object.keys(prev ? prev.blocks : {}), ...Object.keys(cur.blocks)]));
  const blockEls = ids.map((id, idx) => {
    const a = prev ? prev.blocks[id] : undefined;
    const b = cur.blocks[id];
    const from = a || b!;
    const to = b || a!;
    const presentA = !!a || !prev;
    const presentB = !!b;
    let op = presentA && presentB ? 1 : presentB ? t : 1 - t;
    if (!prev) op = firstLand(idx);
    const x = lerp(from.x, to.x, t), y = lerp(from.y, to.y, t), w = lerp(from.w, to.w, t), h = lerp(from.h, to.h, t);
    const border = lerp(from.border === false ? 0 : 1, to.border === false ? 0 : 1, t);
    const hatch = lerp(from.hatch ? 1 : 0, to.hatch ? 1 : 0, prev ? snap : 1);
    const dim = lerp(from.dim ? 1 : 0, to.dim ? 1 : 0, prev ? snap : 1);
    const outl = Math.max(lerp(from.outline ? 1 : 0, to.outline ? 1 : 0, prev ? snap : 1), arrived[id] || 0);
    const icon = to.icon || from.icon;
    const sizeOf = (q: Block) => q.iconSize || Math.min(96, Math.max(40, Math.min(q.w, q.h) * 0.6));
    const iconSize = lerp(sizeOf(from), sizeOf(to), t);
    const enterY = presentB && !presentA ? 16 * (1 - t) : 0;
    const color = outl > 0.5 ? p.accentColor : p.lineColor;
    return (
      <div key={id} style={{ position: "absolute", left: x, top: y + enterY, width: w, height: h, opacity: op * (1 - 0.7 * dim) }}>
        <div style={{ position: "absolute", inset: 0, border: `${lw}px solid ${color}`, borderRadius: r, opacity: Math.max(border, outl), boxSizing: "border-box" }} />
        {hatch > 0.01 && (
          <div style={{ position: "absolute", inset: 0, borderRadius: r, overflow: "hidden", opacity: 0.45 * hatch }}>
            <svg width={w} height={h}>
              {Array.from({ length: Math.ceil((w + h) / 16) }, (_, j) => (
                <line key={j} x1={-h + j * 16} y1={h} x2={-h + j * 16 + h} y2={0} stroke={p.lineColor} strokeWidth={lw} />
              ))}
            </svg>
          </div>
        )}
        {icon && (
          <svg viewBox="0 0 256 256" width={iconSize} height={iconSize} style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
            <path d={ICONS[icon] || ""} fill={color} />
          </svg>
        )}
      </div>
    );
  });

  const flowEls = (cur.flows || []).map(([a, b]) => {
    const A = cur.blocks[a], B = cur.blocks[b];
    if (!A || !B) return null;
    const born = flowBorn[a + ">" + b];
    const d = ramp(F, born, born + ms(400), INOUT);
    let x1: number, y1: number, x2: number, y2: number, vertical = true;
    if (B.y >= A.y + A.h) { x1 = A.x + A.w / 2; y1 = A.y + A.h; x2 = B.x + B.w / 2; y2 = B.y; }
    else if (B.y + B.h <= A.y) { x1 = A.x + A.w / 2; y1 = A.y; x2 = B.x + B.w / 2; y2 = B.y + B.h; }
    else if (B.x >= A.x + A.w) { vertical = false; x1 = A.x + A.w; y1 = A.y + A.h / 2; x2 = B.x; y2 = B.y + B.h / 2; }
    else { vertical = false; x1 = A.x; y1 = A.y + A.h / 2; x2 = B.x + B.w; y2 = B.y + B.h / 2; }
    const c1 = vertical ? [x1, (y1 + y2) / 2] : [(x1 + x2) / 2, y1];
    const c2 = vertical ? [x2, (y1 + y2) / 2] : [(x1 + x2) / 2, y2];
    const path = `M ${x1} ${y1} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${x2} ${y2}`;
    const u = d, m = 1 - u;
    const px = m * m * m * x1 + 3 * m * m * u * c1[0] + 3 * m * u * u * c2[0] + u * u * u * x2;
    const py = m * m * m * y1 + 3 * m * m * u * c1[1] + 3 * m * u * u * c2[1] + u * u * u * y2;
    const len = 2000;
    return (
      <g key={a + ">" + b}>
        <path d={path} fill="none" stroke={p.accentColor} strokeWidth={lw} strokeDasharray={len} strokeDashoffset={len * (1 - d)} pathLength={len} />
        {d > 0 && d < 1 && <circle cx={px} cy={py} r={8} fill={p.accentColor} />}
      </g>
    );
  });

  let measureEl = null;
  const mCur = cur.measure, mPrev = prev ? prev.measure : null;
  if (mCur) {
    const firstIdx = steps.findIndex((s) => !!s.measure);
    const grow = ramp(F, steps[firstIdx].at, steps[firstIdx].at + ms(400), INOUT);
    const tick = ramp(F, steps[firstIdx].at + ms(400), steps[firstIdx].at + ms(550), OUT);
    const y1 = mPrev ? lerp(mPrev.y1, mCur.y1, t) : mCur.y1;
    const y2 = mPrev ? lerp(mPrev.y2, mCur.y2, t) : mCur.y2;
    const cy = (y1 + y2) / 2, half = ((y2 - y1) / 2) * grow;
    measureEl = (
      <g stroke={p.accentColor} strokeWidth={lw}>
        <line x1={mCur.x} y1={cy - half} x2={mCur.x} y2={cy + half} />
        <line x1={mCur.x - 12} y1={cy - half} x2={mCur.x + 12} y2={cy - half} opacity={tick} />
        <line x1={mCur.x - 12} y1={cy + half} x2={mCur.x + 12} y2={cy + half} opacity={tick} />
      </g>
    );
  }

  const hasPhone = p.phoneW > 0 && p.phoneH > 0;
  const sx = p.phoneX + SIDE, sy = p.phoneY + TOP, sw = p.phoneW - 2 * SIDE, sh = p.phoneH - TOP - BOTTOM;
  // Wipe reveals content top to bottom across the screen (or the whole canvas without a phone).
  const wipeTop = hasPhone ? sy : 0, wipeH = hasPhone ? sh : 1920;
  const clipBottom = 1920 - (wipeTop + wipeH * wipe);

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent", opacity: enter * (1 - exit), transform: `translateY(${32 * (1 - enter) - 12 * exit}px)` }}>
      {hasPhone && (
        <>
          <div style={{ position: "absolute", left: p.phoneX, top: p.phoneY, width: p.phoneW, height: p.phoneH, borderRadius: 64, border: `${lw + 1}px solid ${p.lineColor}`, boxSizing: "border-box" }} />
          <div style={{ position: "absolute", left: sx, top: sy, width: sw, height: sh, borderRadius: 32, backgroundColor: p.screenColor }} />
          <div style={{ position: "absolute", left: p.phoneX + p.phoneW / 2 - 64, top: p.phoneY + 32 - 6, width: 128, height: 12, borderRadius: 6, backgroundColor: p.lineColor, opacity: 0.5 }} />
        </>
      )}
      <AbsoluteFill style={{ clipPath: `inset(0 0 ${Math.max(0, clipBottom)}px 0)` }}>
        {blockEls}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
          {flowEls}
          {measureEl}
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
```

---

## File: examples/graphics/ReelIntro.tsx

```tsx
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

type Props = {
  partNumber: number;
  suffix: string;
  totalParts: number;
  title: string;
  layerTag: string;
  cursorName: string;
  cursorColor: string;
  cursorFont: string;
  showProgress: boolean;
  backgroundColor: string;
  inkColor: string;
  mutedColor: string;
  selectionColor: string;
  accentColor: string;
  titleFont: string;
  monoFont: string;
};

const OUT = Easing.bezier(0.16, 1, 0.3, 1);
const IN = Easing.bezier(0.7, 0, 0.84, 0);

const ramp = (f: number, a: number, b: number, ease = OUT) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

const pad = (n: number) => String(Math.max(0, Math.round(n))).padStart(2, "0");

const Handle = ({ x, y, color, o }: { x: string; y: string; color: string; o: number }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: 12,
      height: 12,
      marginLeft: -6,
      marginTop: -6,
      background: "#FFFFFF",
      border: `2px solid ${color}`,
      boxSizing: "border-box",
      opacity: o,
      transform: `scale(${0.6 + 0.4 * o})`,
    }}
  />
);

export default function ReelIntro({ item }: { item: { props: Props } }) {
  const p = item.props;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Card wipes up from the bottom, holds, then wipes out through the top.
  const exitStart = durationInFrames - 12;
  const enter = ramp(frame, 0, 14);
  const exit = ramp(frame, exitStart, durationInFrames, IN);
  const clipTop = 100 * exit;
  const clipBottom = 100 * (1 - enter);

  // Content beats (frames from the card's own start).
  const meta = ramp(frame, 6, 20);
  const title = ramp(frame, 8, 24);
  // Marquee drag from the right edge to the left, then the selection settles.
  const select = ramp(frame, 16, 34, Easing.bezier(0.45, 0, 0.2, 1));
  const handles = ramp(frame, 33, 40);
  // Cursor: appears at the right edge, leads the drag, then lets go and drifts away.
  const cursorIn = ramp(frame, 8, 16);
  const cursorOut = ramp(frame, 40, 52, IN);
  const fill = ramp(frame, 26, 44);
  const contentLift = -24 * exit;

  // Vertical card: the title wraps inside the 952px column; longest word decides the size.
  const longest = Math.max(1, ...p.title.split(" ").map((w) => w.length));
  const titleSize = Math.min(200, Math.floor(952 / (longest * 0.42)));

  const total = Math.max(1, Math.round(p.totalParts));
  const current = Math.min(total, Math.max(0, Math.round(p.partNumber)));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: p.backgroundColor,
        clipPath: `inset(${clipTop}% 0 ${clipBottom}% 0)`,
        fontFamily: `"${p.titleFont}", sans-serif`,
        color: p.inkColor,
      }}
    >
      {/* Canvas dot grid, like a design tool artboard background */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${p.inkColor}1F 1.5px, transparent 1.6px)`,
          backgroundSize: "32px 32px",
          backgroundPosition: "16px 16px",
          opacity: 0.9,
        }}
      />

      <AbsoluteFill
        style={{
          padding: "250px 64px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          transform: `translateY(${contentLift}px)`,
        }}
      >
        {/* Top row: part counter */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "baseline",
            gap: 12,
            fontFamily: `"${p.titleFont}", sans-serif`,
            fontSize: 62,
            lineHeight: 1,
            letterSpacing: 2,
            opacity: meta,
            transform: `translateY(${16 * (1 - meta)}px)`,
          }}
        >
          <span style={{ color: p.inkColor }}>{pad(current)}{p.suffix || ""}</span>
          <span style={{ color: p.mutedColor }}>/ {pad(total)}</span>
        </div>

        {/* Title block, framed like a selected layer */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32, alignItems: "flex-start" }}>
          <div style={{ position: "relative", width: "fit-content", maxWidth: 952 }}>
            {/* Layer tag */}
            <div
              style={{
                position: "absolute",
                left: -2,
                top: -64,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: p.selectionColor,
                color: "#FFFFFF",
                fontFamily: `"${p.monoFont}", monospace`,
                fontSize: 22,
                letterSpacing: 1,
                opacity: handles,
                transform: `translateY(${8 * (1 - handles)}px)`,
              }}
            >
              {p.layerTag}
            </div>

            {/* Selection marquee: dragged from the right edge to the left */}
            <div
              style={{
                position: "absolute",
                top: -16,
                bottom: -16,
                right: -32,
                left: `calc(${(1 - select) * 100}% - ${32 * select}px)`,
                border: `2px solid ${p.selectionColor}`,
                background: `${p.selectionColor}${Math.round(0x1f * (1 - handles)).toString(16).padStart(2, "0")}`,
                opacity: select > 0 ? 1 : 0,
              }}
            >
              <Handle x="0%" y="0%" color={p.selectionColor} o={handles} />
              <Handle x="100%" y="0%" color={p.selectionColor} o={handles} />
              <Handle x="0%" y="100%" color={p.selectionColor} o={handles} />
              <Handle x="100%" y="100%" color={p.selectionColor} o={handles} />
            </div>

            {/* Figma-style multiplayer cursor with a name tag, leading the marquee's bottom-left corner */}
            <div
              style={{
                position: "absolute",
                left: `calc(${(1 - select) * 100}% - ${32 * select}px)`,
                top: "calc(100% + 16px)",
                zIndex: 3,
                opacity: cursorIn * (1 - cursorOut),
                transform: `translate(${-16 * cursorOut}px, ${24 * cursorOut}px)`,
              }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                style={{ position: "absolute", left: -4, top: -4, overflow: "visible" }}
              >
                <path
                  d="M3 2.5 L19.5 9 L12 11.8 L9.2 19.5 Z"
                  fill={p.cursorColor}
                  stroke="#FFFFFF"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  left: 32,
                  top: 32,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: p.cursorColor,
                  color: "#FFFFFF",
                  fontFamily: `"${p.cursorFont}", sans-serif`,
                  fontSize: 24,
                  fontWeight: 600,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                }}
              >
                {p.cursorName}
              </div>
            </div>

            {/* Title rises out of a mask */}
            <div style={{ overflow: "hidden", padding: "0 0 8px 0" }}>
              <div
                style={{
                  fontSize: titleSize,
                  fontWeight: 400,
                  letterSpacing: 2,
                  lineHeight: 0.9,
                  whiteSpace: "normal",
                  transform: `translateY(${110 * (1 - title)}%)`,
                }}
              >
                {p.title}
              </div>
            </div>
          </div>

        </div>

        {/* Progress strip: one bar per reel, this reel unlocks */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 0, opacity: p.showProgress ? meta : 0 }}>
          {Array.from({ length: total }, (_, i) => {
            const n = i + 1;
            const done = n < current;
            const isNow = n === current;
            return (
              <div
                key={n}
                style={{ width: 17, height: 128, background: `${p.inkColor}2E`, position: "relative", overflow: "hidden" }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: done ? p.inkColor : p.accentColor,
                    transformOrigin: "center bottom",
                    transform: `scaleY(${done ? 1 : isNow ? fill : 0})`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
```

---

## File: examples/graphics/ReelOutro.tsx

```tsx
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

// Reel end card: same paper artboard as the intro card, the FramerSchool mark in the middle.
// The shield lands, its three bars draw left to right, then the wordmark and next-part line.
// Ends on a still frame (no exit), as the reel's last beat.

type Props = {
  wordmark: string;
  nextLine: string;
  backgroundColor: string;
  inkColor: string;
  mutedColor: string;
  titleFont: string;
};

const OUT = Easing.bezier(0.16, 1, 0.3, 1);
const ramp = (f: number, a: number, b: number) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT });

// Geometry copied from framerschool-logo.svg (413 x 503 viewBox).
const BARS = [
  { y: 57.5, w: 297 },
  { y: 163.5, w: 209 },
  { y: 269.5, w: 129 },
];

export default function ReelOutro({ item }: { item: { props: Props } }) {
  const p = item.props;
  const frame = useCurrentFrame();

  const enter = ramp(frame, 0, 14);
  const shield = ramp(frame, 4, 18);
  const word = ramp(frame, 24, 38);
  const next = ramp(frame, 32, 46);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: p.backgroundColor,
        clipPath: `inset(0 0 ${100 * (1 - enter)}% 0)`,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: `"${p.titleFont}", sans-serif`,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${p.inkColor}1F 1.5px, transparent 1.6px)`,
          backgroundSize: "32px 32px",
          backgroundPosition: "16px 16px",
          opacity: 0.9,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>
        <svg
          width={310}
          height={378}
          viewBox="0 0 413 503"
          style={{ opacity: shield, transform: `translateY(${32 * (1 - shield)}px) scale(${0.92 + 0.08 * shield})` }}
        >
          <path d="M0 0H413V403.271L208.5 503L0 403.271V0Z" fill={p.inkColor} />
          {BARS.map((b, i) => (
            <rect key={i} x={58} y={b.y} height={71} width={b.w * ramp(frame, 12 + i * 4, 24 + i * 4)} fill="#FFFFFF" />
          ))}
        </svg>
        <div
          style={{
            fontSize: 120,
            lineHeight: 1,
            letterSpacing: 4,
            color: p.inkColor,
            opacity: word,
            transform: `translateY(${16 * (1 - word)}px)`,
          }}
        >
          {p.wordmark}
        </div>
        <div
          style={{
            fontSize: 48,
            lineHeight: 1,
            letterSpacing: 2,
            color: p.mutedColor,
            opacity: next,
            transform: `translateY(${16 * (1 - next)}px)`,
          }}
        >
          {p.nextLine}
        </div>
      </div>
    </AbsoluteFill>
  );
}
```

---

## File: examples/graphics/SeriesStrip.tsx

```tsx
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Reel counter "07 / 15" (or "03A / 15" with a suffix for split reels), top left. Same type as the chapter card counter.
// Slides down once, then stays still to the end of the reel.

type Props = {
  current: number;
  suffix: string;
  total: number;
  slideInAt: number;
  lineColor: string;
  numberFont: string;
};

const MOVE = Easing.bezier(0.2, 0.8, 0.2, 1);
const pad = (n: number) => String(Math.max(0, Math.round(n))).padStart(2, "0");

export default function SeriesStrip({ item }: { item: { props: Props } }) {
  const p = item.props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = interpolate(frame, [p.slideInAt, p.slideInAt + (250 / 1000) * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: MOVE,
  });
  const font = p.numberFont || "Bebas Neue";

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          fontFamily: `"${font}", sans-serif`,
          fontSize: 48,
          lineHeight: 1,
          letterSpacing: 2,
          opacity: t,
          transform: `translateY(${-16 * (1 - t)}px)`,
        }}
      >
        <span style={{ color: p.lineColor }}>{pad(p.current)}{p.suffix || ""}</span>
        <span style={{ color: p.lineColor, opacity: 0.45 }}>/ {pad(p.total)}</span>
      </div>
    </AbsoluteFill>
  );
}
```

---

## File: examples/graphics/Wireframe.tsx

```tsx
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Piece 5 "Wireframe" from the PG site motion graphics guide.
// The page as a column of 1 px off-white blocks on the near-black canvas, one Phosphor
// icon per block, no text. Reel 1: every block starts hatched (AI's defaults), then on
// "fewer gaps" the hatch clears block by block and each icon lands.

// Phosphor icons, thin weight (viewBox 0 0 256 256).
const ICONS: Record<string, string> = {
 "bed": "M216,76H28V48a4,4,0,0,0-8,0V208a4,4,0,0,0,8,0V172H244v36a4,4,0,0,0,8,0V112A36,36,0,0,0,216,76ZM28,84h80v80H28Zm88,80V84H216a28,28,0,0,1,28,28v52Z",
 "credit-card": "M224,52H32A12,12,0,0,0,20,64V192a12,12,0,0,0,12,12H224a12,12,0,0,0,12-12V64A12,12,0,0,0,224,52ZM32,60H224a4,4,0,0,1,4,4V92H28V64A4,4,0,0,1,32,60ZM224,196H32a4,4,0,0,1-4-4V100H228v92A4,4,0,0,1,224,196Zm-20-28a4,4,0,0,1-4,4H168a4,4,0,0,1,0-8h32A4,4,0,0,1,204,168Zm-64,0a4,4,0,0,1-4,4H120a4,4,0,0,1,0-8h16A4,4,0,0,1,140,168Z",
 "currency-inr": "M204,80a4,4,0,0,1-4,4H163.42a57,57,0,0,1,.58,8,56.06,56.06,0,0,1-56,56H82.35l80.34,73a4,4,0,1,1-5.38,5.92l-88-80A4,4,0,0,1,72,140h36a48,48,0,0,0,47.32-56H72a4,4,0,0,1,0-8h81.25A48.09,48.09,0,0,0,108,44H72a4,4,0,0,1,0-8H200a4,4,0,0,1,0,8H136.81a56.24,56.24,0,0,1,24.85,32H200A4,4,0,0,1,204,80Z",
 "database": "M192.14,42.55C174.94,33.17,152.16,28,128,28S81.06,33.17,63.86,42.55C45.89,52.35,36,65.65,36,80v96c0,14.35,9.89,27.65,27.86,37.45,17.2,9.38,40,14.55,64.14,14.55s46.94-5.17,64.14-14.55c18-9.8,27.86-23.1,27.86-37.45V80C220,65.65,210.11,52.35,192.14,42.55ZM212,176c0,11.29-8.41,22.1-23.69,30.43C172.27,215.18,150.85,220,128,220s-44.27-4.82-60.31-13.57C52.41,198.1,44,187.29,44,176V149.48c4.69,5.93,11.37,11.34,19.86,16,17.2,9.38,40,14.55,64.14,14.55s46.94-5.17,64.14-14.55c8.49-4.63,15.17-10,19.86-16Zm0-48c0,11.29-8.41,22.1-23.69,30.43C172.27,167.18,150.85,172,128,172s-44.27-4.82-60.31-13.57C52.41,150.1,44,139.29,44,128V101.48c4.69,5.93,11.37,11.34,19.86,16,17.2,9.38,40,14.55,64.14,14.55s46.94-5.17,64.14-14.55c8.49-4.63,15.17-10,19.86-16Zm-23.69-17.57C172.27,119.18,150.85,124,128,124s-44.27-4.82-60.31-13.57C52.41,102.1,44,91.29,44,80s8.41-22.1,23.69-30.43C83.73,40.82,105.15,36,128,36s44.27,4.82,60.31,13.57C203.59,57.9,212,68.71,212,80S203.59,102.1,188.31,110.43Z",
 "envelope-simple": "M224,52H32a4,4,0,0,0-4,4V192a12,12,0,0,0,12,12H216a12,12,0,0,0,12-12V56A4,4,0,0,0,224,52Zm-10.28,8L128,138.57,42.28,60ZM216,196H40a4,4,0,0,1-4-4V65.09L125.3,147a4,4,0,0,0,5.4,0L220,65.09V192A4,4,0,0,1,216,196Z",
 "fork-knife": "M76,88V40a4,4,0,0,1,8,0V88a4,4,0,0,1-8,0ZM212,40V224a4,4,0,0,1-8,0V172H152a4,4,0,0,1-4-4,264.27,264.27,0,0,1,7.11-55.94c9.47-39.22,27.21-65.41,51.31-75.74A4,4,0,0,1,212,40Zm-8,6.46C162.25,70.33,156.81,145.75,156.1,164H204Zm-88-7.12a4,4,0,0,0-7.9,1.32l8,47.66a36,36,0,0,1-72,0l8-47.66a4,4,0,0,0-7.9-1.32l-8,48A4.89,4.89,0,0,0,36,88a44.06,44.06,0,0,0,40,43.81V224a4,4,0,0,0,8,0V131.81A44.06,44.06,0,0,0,124,88a4.89,4.89,0,0,0,0-.66Z",
 "images": "M216,44H72A12,12,0,0,0,60,56V76H40A12,12,0,0,0,28,88V200a12,12,0,0,0,12,12H184a12,12,0,0,0,12-12V180h20a12,12,0,0,0,12-12V56A12,12,0,0,0,216,44ZM68,56a4,4,0,0,1,4-4H216a4,4,0,0,1,4,4v72.4l-16.89-16.89a12,12,0,0,0-17,0l-22.83,22.83L116.49,87.51a12,12,0,0,0-17,0L68,119ZM188,200a4,4,0,0,1-4,4H40a4,4,0,0,1-4-4V88a4,4,0,0,1,4-4H60v84a12,12,0,0,0,12,12H188Zm28-28H72a4,4,0,0,1-4-4V130.34l37.17-37.17a4,4,0,0,1,5.66,0l49.66,49.66a4,4,0,0,0,5.65,0l25.66-25.66a4,4,0,0,1,5.66,0L220,139.71V168A4,4,0,0,1,216,172ZM164,84a8,8,0,1,1,8,8A8,8,0,0,1,164,84Z",
 "list-bullets": "M84,64a4,4,0,0,1,4-4H216a4,4,0,0,1,0,8H88A4,4,0,0,1,84,64Zm132,60H88a4,4,0,0,0,0,8H216a4,4,0,0,0,0-8Zm0,64H88a4,4,0,0,0,0,8H216a4,4,0,0,0,0-8ZM44,120a8,8,0,1,0,8,8A8,8,0,0,0,44,120Zm0-64a8,8,0,1,0,8,8A8,8,0,0,0,44,56Zm0,128a8,8,0,1,0,8,8A8,8,0,0,0,44,184Z",
 "list-checks": "M220,128a4,4,0,0,1-4,4H128a4,4,0,0,1,0-8h88A4,4,0,0,1,220,128ZM128,68h88a4,4,0,0,0,0-8H128a4,4,0,0,0,0,8Zm88,120H128a4,4,0,0,0,0,8h88a4,4,0,0,0,0-8ZM85.17,45.17,56,74.34,42.83,61.17a4,4,0,0,0-5.66,5.66l16,16a4,4,0,0,0,5.66,0l32-32a4,4,0,0,0-5.66-5.66Zm0,64L56,138.34,42.83,125.17a4,4,0,1,0-5.66,5.66l16,16a4,4,0,0,0,5.66,0l32-32a4,4,0,0,0-5.66-5.66Zm0,64L56,202.34,42.83,189.17a4,4,0,0,0-5.66,5.66l16,16a4,4,0,0,0,5.66,0l32-32a4,4,0,0,0-5.66-5.66Z",
 "list": "M220,128a4,4,0,0,1-4,4H40a4,4,0,0,1,0-8H216A4,4,0,0,1,220,128ZM40,68H216a4,4,0,0,0,0-8H40a4,4,0,0,0,0,8ZM216,188H40a4,4,0,0,0,0,8H216a4,4,0,0,0,0-8Z",
 "map-pin": "M128,68a36,36,0,1,0,36,36A36,36,0,0,0,128,68Zm0,64a28,28,0,1,1,28-28A28,28,0,0,1,128,132Zm0-112a84.09,84.09,0,0,0-84,84c0,30.42,14.17,62.79,41,93.62a250,250,0,0,0,40.73,37.66,4,4,0,0,0,4.58,0A250,250,0,0,0,171,197.62c26.81-30.83,41-63.2,41-93.62A84.09,84.09,0,0,0,128,20Zm37.1,172.23A254.62,254.62,0,0,1,128,227a254.62,254.62,0,0,1-37.1-34.81C73.15,171.8,52,139.9,52,104a76,76,0,0,1,152,0C204,139.9,182.85,171.8,165.1,192.23Z",
 "phone": "M220.78,162.13,173.56,141A12,12,0,0,0,162.18,142a3.37,3.37,0,0,0-.38.28L137,163.42a3.93,3.93,0,0,1-3.7.21c-16.24-7.84-33.05-24.52-40.89-40.57a3.9,3.9,0,0,1,.18-3.69l21.2-25.21c.1-.12.19-.25.28-.38a12,12,0,0,0,1-11.36L93.9,35.28a12,12,0,0,0-12.48-7.19A52.25,52.25,0,0,0,36,80c0,77.2,62.8,140,140,140a52.25,52.25,0,0,0,51.91-45.42A12,12,0,0,0,220.78,162.13ZM220,173.58A44.23,44.23,0,0,1,176,212C103.22,212,44,152.78,44,80A44.23,44.23,0,0,1,82.42,36a3.87,3.87,0,0,1,.48,0,4,4,0,0,1,3.67,2.49l21.11,47.14a4,4,0,0,1-.23,3.6l-21.19,25.2c-.1.13-.2.25-.29.39a12,12,0,0,0-.78,11.75c8.69,17.79,26.61,35.58,44.6,44.27a12,12,0,0,0,11.79-.87l.37-.28,24.83-21.12a3.93,3.93,0,0,1,3.57-.27l47.21,21.16A4,4,0,0,1,220,173.58Z",
 "question": "M136,180a8,8,0,1,1-8-8A8,8,0,0,1,136,180ZM128,76c-19.85,0-36,14.36-36,32v4a4,4,0,0,0,8,0v-4c0-13.23,12.56-24,28-24s28,10.77,28,24-12.56,24-28,24a4,4,0,0,0-4,4v8a4,4,0,0,0,8,0v-4.2c18-1.77,32-15.36,32-31.8C164,90.36,147.85,76,128,76Zm100,52A100,100,0,1,1,128,28,100.11,100.11,0,0,1,228,128Zm-8,0a92,92,0,1,0-92,92A92.1,92.1,0,0,0,220,128Z",
 "whatsapp-logo": "M185.79,148.42l-32-16a4,4,0,0,0-4,.25l-16.64,11.1a44.56,44.56,0,0,1-20.91-20.91l11.1-16.64a4,4,0,0,0,.25-4l-16-32A4,4,0,0,0,104,68a36,36,0,0,0-36,36,84.09,84.09,0,0,0,84,84,36,36,0,0,0,36-36A4,4,0,0,0,185.79,148.42ZM152,180a76.08,76.08,0,0,1-76-76,28,28,0,0,1,25.58-27.9l13.8,27.61-11,16.54A4,4,0,0,0,104,124a52.43,52.43,0,0,0,28,28,4,4,0,0,0,3.76-.37l16.54-11,27.61,13.8A28,28,0,0,1,152,180ZM128,28A100,100,0,0,0,40.53,176.5l-11.9,35.69a12,12,0,0,0,15.18,15.18l35.69-11.9A100,100,0,1,0,128,28Zm0,192a92,92,0,0,1-46.07-12.35,4.05,4.05,0,0,0-2-.54,3.93,3.93,0,0,0-1.27.21L41.28,219.78a4,4,0,0,1-5.06-5.06l12.46-37.38a4,4,0,0,0-.33-3.27A92,92,0,1,1,128,220Z",
 "wifi-high": "M136,204a8,8,0,1,1-8-8A8,8,0,0,1,136,204ZM234.54,90.1a168,168,0,0,0-213.08,0,4,4,0,1,0,5.08,6.18,160,160,0,0,1,202.92,0,4,4,0,0,0,5.08-6.18Zm-32.06,35.81a120,120,0,0,0-149,0,4,4,0,0,0,5,6.27,112,112,0,0,1,139,0,4,4,0,0,0,5-6.27Zm-32.13,35.86a72,72,0,0,0-84.7,0,4,4,0,1,0,4.7,6.46,64.07,64.07,0,0,1,75.3,0,4,4,0,0,0,5.58-.87A4,4,0,0,0,170.35,161.77Z"
};

type Props = {
  blocks: string;        // comma-separated icon names, top to bottom
  heights: string;       // comma-separated relative block heights
  hatched: boolean;      // start with every block hatched
  clearAt: number;       // frame (from the item start) when the hatch starts clearing; -1 = never
  clearStagger: number;  // frames between blocks while clearing
  canvasColor: string;
  lineColor: string;
  accentColor: string;
  lineWidth: number;
};

const OUT = Easing.bezier(0.2, 0.8, 0.2, 1);
const INOUT = Easing.inOut(Easing.cubic);
const IN = Easing.in(Easing.cubic);
const ramp = (f: number, a: number, b: number, ease = OUT) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

const PAD = 32;
const GAP = 8;

export default function Wireframe({ item }: { item: { props: Props } }) {
  const props = item.props;
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const ms = (v: number) => (v / 1000) * fps;

  const names = props.blocks.split(",").map((s) => s.trim()).filter(Boolean);
  const rel = props.heights.split(",").map((s) => Number(s.trim()) || 1);
  const relSum = names.reduce((a, _, i) => a + (rel[i] ?? 1), 0);
  const innerH = height - PAD * 2 - GAP * (names.length - 1);
  const lw = Math.max(1, props.lineWidth);
  const blockW = width - PAD * 2;

  const reveal = ramp(frame, 0, ms(400), INOUT);                       // reveal 400 ms
  const exit = ramp(frame, durationInFrames - ms(200), durationInFrames, IN); // exit 200 ms

  let y = PAD;
  const blocks = names.map((name, i) => {
    const h = (innerH * (rel[i] ?? 1)) / relSum;
    const top = y;
    y += h + GAP;
    const land = ramp(frame, ms(200) + i * 2, ms(200) + i * 2 + ms(150));  // snap 150 ms, 60 ms apart
    const clearStart = props.clearAt >= 0 ? props.clearAt + i * props.clearStagger : 1e9;
    const cleared = ramp(frame, clearStart, clearStart + ms(150));
    const hatch = props.hatched ? 1 - cleared : 0;
    const iconIn = props.hatched ? cleared : land;
    const iconSize = Math.min(96, h * 0.6);
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: PAD,
          right: PAD,
          top,
          height: h,
          border: `${lw}px solid ${props.lineColor}`,
          boxSizing: "border-box",
          opacity: land,
          transform: `translateY(${8 * (1 - land)}px)`,
          overflow: "hidden",
        }}
      >
        {/* Grey diagonal hatch: AI's default in every block */}
        <svg width={blockW} height={h} style={{ position: "absolute", inset: 0, opacity: 0.5 * hatch }}>
          {Array.from({ length: Math.ceil((blockW + h) / 14) }, (_, k) => {
            const x = -h + k * 14;
            return <line key={k} x1={x} y1={h} x2={x + h} y2={0} stroke={props.lineColor} strokeWidth={lw} />;
          })}
        </svg>
        <svg
          viewBox="0 0 256 256"
          width={iconSize}
          height={iconSize}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) scale(${0.9 + 0.1 * iconIn})`,
            opacity: iconIn,
          }}
        >
          <path d={ICONS[name] ?? ""} fill={props.lineColor} />
        </svg>
      </div>
    );
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: props.canvasColor,
        clipPath: `inset(0 0 ${100 * (1 - reveal)}% 0)`,
        opacity: 1 - exit,
      }}
    >
      {blocks}
    </AbsoluteFill>
  );
}
```

---

## File: scripts/layout_move.py

```python
# Animated layout move for ChatCut (no keyframes): split the incoming webcam clip into 1-frame
# pieces and give each piece an interpolated display rectangle + crop window.
# Item dicts use ChatCut fields: left, top, width, height, cropLeft/Right/Top/Bottom, borderRadius.
# Assumes a 4:3 webcam source (item box keeps the source aspect; crops cut into it).
N = 20  # reels: 20 frames. Master in-view moves: 30 frames.

def ease(t):  # ease-out cubic
    return 1 - (1 - t) ** 3

def disp(i):
    """Visible (displayed) rectangle and crop window of an item."""
    L = i.get('cropLeft') or 0; R = i.get('cropRight') or 0
    T = i.get('cropTop') or 0; B = i.get('cropBottom') or 0
    return dict(x=i['left'] + i['width'] * L, y=i['top'] + i['height'] * T,
                w=i['width'] * (1 - L - R), h=i['height'] * (1 - T - B),
                L=L, T=T, cw=1 - L - R, br=i.get('borderRadius') or 0)

def geom(a, b, e):
    """Item geometry at eased progress e between two disp() states."""
    g = {k: a[k] + (b[k] - a[k]) * e for k in a}
    cw = g['cw']; ch = g['h'] / g['w'] * cw / 0.75
    W = g['w'] / cw; H = W * 0.75
    return dict(left=round(g['x'] - W * g['L']), top=round(g['y'] - H * g['T']),
                width=round(W), height=round(H),
                cropLeft=round(g['L'], 4), cropRight=round(1 - g['L'] - cw, 4),
                cropTop=round(g['T'], 4), cropBottom=round(1 - g['T'] - ch, 4),
                borderRadius=round(g['br']))

def pieces(from_item, to_item, start_frame, n=N):
    """Geometry for frames start_frame .. start_frame+n-1 (one item per frame)."""
    a, b = disp(from_item), disp(to_item)
    return [(start_frame + k, geom(a, b, ease((k + 1) / n))) for k in range(n)]
```

---

## File: scripts/reel_diagram_spec.py

```python
# Convert a long-version Diagram spec (panel coordinates) into a ReelDiagram spec (1080x1920 canvas,
# page drawn inside a phone). Rows keep their order; small gaps snap to the 8/12/16/32 spacing set.
import json
PW,PH,PY=512,966,352
SIDE,TOP,PAD=16,64,16
KY=1.28
SNAP=[8,12,16,32,64,120]
def snap(v): return min(SNAP,key=lambda s:abs(s-v))

def convert(spec,panelW=640,screenW=None):
  steps=json.loads(spec)['steps'] if isinstance(spec,str) else spec['steps']
  screenW=screenW or panelW
  side=[ (k,b) for s in steps for k,b in s['blocks'].items() if b['x']>=screenW]
  extra=160 if side else 0
  phoneX=round(540-(PW+(64+extra if side else 0))/2)
  X0=phoneX+SIDE+PAD; Y0=PY+TOP+PAD
  kx=(PW-2*SIDE-2*PAD)/(screenW-64)
  out=[]
  for s in steps:
    bl={k:b for k,b in s['blocks'].items() if k!='page'}
    order=sorted(bl,key=lambda k:(bl[k]['y'],-bl[k]['w']*bl[k]['h']))
    pl={}
    for k in order:
      b=bl[k]
      if b['x']>=screenW:
        cy=Y0+(b['y']+b['h']/2-32)*KY
        pl[k]=dict(x=phoneX+PW+64,y=round(cy-extra/2),w=extra,h=extra); continue
      x=X0+(b['x']-32)*kx; w=b['w']*kx; h=b['h']*KY
      cont=[c for c in pl if c in bl and bl[c]['x']<=b['x'] and bl[c]['y']<=b['y'] and bl[c]['x']+bl[c]['w']>=b['x']+b['w'] and bl[c]['y']+bl[c]['h']>=b['y']+b['h']]
      if cont:
        c=cont[-1]; y=pl[c]['y']+(b['y']-bl[c]['y'])*KY
      else:
        pre=[c for c in pl if c in bl and bl[c]['y']+bl[c]['h']<=b['y'] and bl[c]['x']<b['x']+b['w'] and b['x']<bl[c]['x']+bl[c]['w'] and bl[c]['x']<screenW]
        pre=max(pre,key=lambda c:bl[c]['y']+bl[c]['h']) if pre else None
        gap=b['y']-(bl[pre]['y']+bl[pre]['h']) if pre else None
        if pre and gap<=32: y=pl[pre]['y']+pl[pre]['h']+snap(gap*KY)
        else: y=Y0+(b['y']-32)*KY
      nb={kk:v for kk,v in b.items() if kk not in('x','y','w','h')}
      if b.get('border') is False and b['w']<=128: nb['iconSize']=80
      elif h<64: nb['iconSize']=round(h*0.7)
      pl[k]=dict(x=round(x),y=round(y),w=round(w),h=round(h),**nb)
    for k in pl:
      if bl[k]['x']>=screenW: pl[k].update({kk:v for kk,v in bl[k].items() if kk not in('x','y','w','h')})
    st=dict(at=s['at'],blocks=pl)
    if s.get('flows'): st['flows']=s['flows']
    m=s.get('measure')
    if m:
      def my(v):
        hit=[k for k in bl if bl[k]['y']==v]
        return pl[hit[0]]['y'] if hit else Y0+(v-32)*KY
      st['measure']=dict(x=round(X0+(m['x']-32)*kx),y1=round(my(m['y1'])),y2=round(my(m['y2'])))
    out.append(st)
  return json.dumps({'steps':out},separators=(',',':')),phoneX
```
