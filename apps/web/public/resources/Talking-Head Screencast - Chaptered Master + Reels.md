---
name: workflow-eab77f10-talking-head-screencast-chaptered-master-reels
description: Edit a long-form single-speaker screencast tutorial (webcam + screen recording, two simultaneous sources) into a chaptered master and vertical reel timelines. Use for course lessons, software walkthroughs, build-along tutorials, and any talking-head video where a screen capture runs alongside the speaker.
---

# Talking-Head Screencast → Chaptered Master + Reels

Turns a raw two-source recording (webcam speaker + screen capture) into a finished long-form
master with chapters, layout modes, motion graphics and captions — and optionally a set of
vertical reel timelines cut from it.

## When to use

- A tutorial, course lesson, or software walkthrough recorded as **two simultaneous files**:
  a webcam of the speaker and a screen capture.
- The creator wants a publishable long edit, usually plus short vertical cuts.
- Speech drives the cut; the screen is evidence for what is being said.

Not for: single-source talking head with no screen capture, multi-speaker interviews,
scripted promos, or footage where the screen is B-roll rather than the subject.

## Inputs to gather first

- **Both source files**, and whether they were recorded simultaneously.
- **The creator's written script or outline, if one exists.** This is the highest-value input
  in the whole workflow — it gives you ground truth for chapter structure, chapter titles,
  correct spelling of product and place names, and what the video is *supposed* to say.
  Ask for it before inventing structure from the transcript.
- Target platform and whether vertical cuts are wanted.
- Any brand palette. If none is given, take the palette from what is on screen in the
  recording rather than reaching for a default gradient.

## Workflow

### 1. Verify the two sources are actually simultaneous

Do not infer this from filenames — filename timestamps can differ by seconds while the
recordings are aligned, and vice versa. Check that durations match to within a few tens of
milliseconds, then confirm with a content event: find a moment where the speaker references
something changing on screen, and check the on-screen change lands slightly *before* the words.
State the assumption explicitly if you cannot prove it.

### 2. Transcribe the speech source only

Transcribe the webcam. The screen capture rarely needs its own transcript.

### 3. Cut the speech first, in two distinct passes

**Mechanical pass** — fixed filler tokens and pause compression. Cheap and safe.

**Semantic pass** — this is where the real work is, and where it is easy to under-deliver:

- String similarity only catches near-verbatim restarts. It will *not* catch the same idea
  restated in different words. Read the transcript and look for arguments delivered two or
  three times across separate takes — a long recording often contains the same point made
  at the top of a section, again in the middle, and again as a summary.
- **Never keep a lead-in fragment from a failed take and stitch it onto a different take.**
  This produces an audible stumble. Detect it: compare kept vs. removed source segments,
  and flag any kept segment that does not end on terminal punctuation and is immediately
  followed by removed speech. Review each flag by reading what was removed.
- Fix ASR errors against the creator's script, not just a dictionary. A dictionary only finds
  non-words; the damaging errors are real words in the wrong place (a brand name heard as a
  common noun, an acronym heard as another acronym). Correct these as transcript fixes so the
  audio is untouched and only the captions change.

Confirm the speech edit with the creator before building anything on top of it. Everything
downstream — chapters, graphics, captions, reels — assumes it is final.

### 4. Mirror the cut onto the screen track

Rebuild the screen track so every clip matches the speech track's start, duration and source
offset exactly. Verify zero mismatches before continuing; this frame-lock is what keeps picture
and audio together for the rest of the edit.

### 5. Chapter from the script's structure

Anchor each chapter to a distinctive spoken phrase, look up its frame, and tile chapter markers
with no gaps or overlaps. Re-derive these after any later change to the speech edit — chapter
positions are downstream of the cut.

### 6. Choose layout per chapter from *measured* screen activity

Sample the screen recording and measure how much it changes over time. Classify each chapter:

| Activity | Mode | Layout |
| --- | --- | --- |
| low | speaker | speaker fills the frame, screen hidden |
| medium | split | screen and speaker side by side, shared baseline |
| high | screen | screen dominant, speaker as a small inset |

Measure this rather than guessing from the transcript — what the speaker *talks* about and what
is *happening* on screen diverge often.

See `references/layout-and-framing.md` for band layout, face framing, and crop mathematics.

### 7. Finish in order

Screen zoom on high-activity chapters → motion graphics → captions → sound. Each depends on the
previous being settled.

- Zoom the screen toward mouse activity on screen-heavy chapters. Use eased ramps, and drop any
  zoom whose active run is shorter than about two seconds — brief punches read as noise.
- Chapter titles: a persistent compact tag, plus a full-frame card at each chapter change.
- Captions: sit them close to the footage with clear space below for platform UI.
- Whoosh on chapter transitions: a heavier one on the card entrance, a lighter one on the
  layout reveal as the card exits.

### 8. Reels (optional)

One vertical timeline per **part** of the script, not per chapter — parts are already coherent
topics. Duplicate the master, switch canvas to 9:16, delete everything outside the part, shift
the remainder to start at zero, and restack: speaker above, screen below.

Read `references/pitfalls.md` before scripting this — duplicated timelines behave in ways that
will silently no-op your edits.

## Rules that prevent the common failures

- **Verify before declaring done.** Render actual frames in every layout mode. A tool reporting
  success is not evidence the composition is right.
- **Re-derive everything downstream after a speech change.** A two-segment deletion invalidates
  the mirror, the chapter positions, the graphics, and the captions.
- **Do not reuse geometry values across layout revisions.** Recompute the whole set from the
  current band layout. Mixing values from two iterations puts panels on different baselines —
  it looks like a sync problem and is not.
- **State assumptions you have not proven**, especially source alignment and anything only
  checked in stills rather than in motion.

## Final checks

- Mirrored tracks: equal clip counts, zero timing or source-offset mismatches.
- No gaps or overlaps on any track.
- Chapter markers tile the full duration with no breaks.
- Full-timeline elements (backdrop, captions) span the current duration after any retime.
- Frames rendered in each layout mode, plus one at a chapter boundary.
- Say plainly what was verified in stills only and still needs a scrub.

---

<!-- file: references/layout-and-framing.md -->

# Layout bands, face framing, and crop mathematics

## Reserve bands before placing anything

Decide the horizontal bands once, then compute every layout mode from them:

```
title band          persistent chapter tag
content band        speaker and/or screen, all modes share this top and height
caption band        sits close to the footage, not floating at the frame edge
clear space         bottom margin kept empty for the platform's control bar
```

Every mode's geometry derives from the same content band, so panels always share a baseline.
When the bands change, recompute **all** modes — never carry values over from a previous
revision, or two panels end up on different baselines.

Give the platform UI real room at the bottom. Captions pushed to the frame edge get covered by
player controls.

## Sizing panels that sit side by side

For two panels sharing a content-band height `H`, with per-panel display aspect `a` (width ÷ height):

```
total width needed = H * (a_screen + a_speaker) + margins
```

Solve for `H` against the available frame width — the frame width, not the band height, is
usually the binding constraint.

## Face framing: measure, never eyeball

Landmarks read off a single frame will be wrong, because the speaker moves throughout the take.

1. Take a small patch around the eyes from one sharp reference frame.
2. Template-match it across the whole recording at a coarse interval, keeping only confident
   matches.
3. Use the **median** position to centre the crop, and the **spread** to size it.

Report the spread honestly. A speaker who traverses most of the crop width cannot be held
centred by any static crop; the frame will be right on average and wrong much of the time.
Face tracking is the only real fix, and it is a separate job worth naming rather than
silently approximating.

### Head-in-frame beats a textbook eyeline

Rule-of-thirds says put the eyes on the upper third line. With a close-framed speaker this
pulls the crop down far enough to clip the top of the head on a large fraction of frames.

Derive the head's bounding box per sampled frame (eye position plus measured offsets to hairline
and chin) and compute what percentage of frames a candidate crop fully contains. Then choose
against that number rather than against the rule. Ask the creator which they prefer when the
two conflict — and tell them the cost in percentage terms, not vaguely.

Where the subject's head nearly touches a background boundary in the source (a ceiling line, a
wall edge), there may be **no** crop that both excludes that boundary and keeps the head whole.
Say so plainly and let the creator choose; do not silently pick one.

## Crop mathematics

Item `width`/`height` describe the **box**. Crop fractions cut into that box:

```
displayed_width  = box_width  * (1 - cropLeft - cropRight)
displayed_height = box_height * (1 - cropTop  - cropBottom)
displayed_left   = box_left + box_width  * cropLeft
displayed_top    = box_top  + box_height * cropTop
```

To place a cropped panel at a target display rect, invert these: divide the target size by the
visible fraction to get the box, then subtract the crop offset to get the box position.

The box must keep the **source** aspect ratio, not the cropped display ratio.

## Two-pass crop updates

Setting dimensions and crops in one update trips the aspect-ratio validator, because it checks
the new dimensions against the crop state already stored.

```
pass 1  clear all crops, set box size and position
pass 2  set crops only, touching no dimensions
```

For aspect-locked items (motion graphics sized to the canvas), pass **one** dimension only and
let the other be computed. To cover a portrait frame with a landscape asset, set the height and
give it a negative horizontal offset.

---

<!-- file: references/pitfalls.md -->

# Pitfalls when scripting bulk edits

Each of these produced a silent or misleading failure in practice.

## Duplicated timelines

- **A duplicate gets entirely new track ids.** Reusing the source timeline's track ids returns
  "track not found", which reads as an empty track — so reads come back empty, nothing is
  deleted or repositioned, and the run *reports success*. Always resolve tracks per timeline,
  by order and type.
- **A duplicate may carry an extra empty audio track.** Picking the first audio track by index
  can select the empty one and leave sound effects untrimmed — visible as a timeline that is
  still full-length after trimming. Pick the audio track that actually contains items.
- Reading through one workspace while the write tool reads another silently no-ops. Confirm the
  read and the write are addressing the same place before trusting a zero-change result.

## Batch edits

- Batches are **atomic per call**. One invalid entry rolls back the entire chunk, including the
  valid entries beside it. Check the returned count against what was sent; do not assume.
- After very large batches the editor's timeline panel may not repaint even though the data is
  correct. Verify by reading state and rendering a frame — if those are right, tell the user to
  reload rather than rebuilding anything.

## Transcript and script caches

After correcting the source transcript, the script view may still serve pre-fix text. Refresh
its cache before editing, or the edit will be rejected for not matching the source.

## Verification that actually verifies

- Frame-lock between mirrored tracks: compare clip counts **and** per-clip start, duration and
  source offset. A matching count alone proves nothing.
- Deduplicate paginated reads before counting. The same effect appearing on every page inflates
  totals by the page count.
- Rendering a frame is the only proof the composition is right. Tool success is not.

## Exports in progress look exactly like crashed ones

A running export writes to a sandbox temp file (`output.mp4.sb-…`) inside a temp folder, and
creates the real `output.mp4` only on completion. Until then the output file is zero bytes.

So "no output file exists" is **not** evidence the render failed. Before concluding anything —
and absolutely before deleting a temp folder or restarting the job — check for a live process:

- Look for an open write handle on the temp folder.
- Sample the temp file's size twice a few seconds apart and confirm it is growing.

Getting this wrong is expensive in both directions: you can destroy an almost-finished render,
or start a duplicate that competes with the original for CPU and slows both down. Renders are
dedicated worker processes separate from the editor, so a duplicate can run unnoticed for a
long time.

If a duplicate is already running, keep the one that is furthest along and stop the other, then
clean up only the temp folder whose process has actually exited.
