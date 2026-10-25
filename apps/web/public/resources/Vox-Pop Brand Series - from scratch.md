---
name: workflow-7ef08840-vox-pop-brand-series-from-scratch
description: End-to-end runbook for building a multi-reel vox-pop series for a brand from scratch — brand skill, footage audit, one locked reference reel, batching the rest, finishing, export. Use when starting a street-interview or vox-pop reel series for a new brand, or when asked to replicate the Clotrio process for another client. Gated: each phase needs explicit user confirmation before it runs.
---

# Vox-Pop Brand Series — from scratch

A phase-gated runbook for taking a brand from "here is some street-interview footage and a
strategy deck" to a batch of finished, exported reels.

Distilled from the Clotrio "No Rules. Just Comfort." series and corrected against the Breadberry
trial-month batch and the HackDaily six-reel batch. The order below is the **corrected** order —
the real runs took many more rounds because several phases were done out of sequence. The section
"Where the rounds actually go" names each detour so this run can skip them.

## The gate — read this before anything else

**Do not start a phase until the user has explicitly confirmed the previous one.**

This is not a politeness convention. Each phase's output is the input to the next, and the
expensive failures in this workflow are all the same shape: work built on an unconfirmed
foundation, discovered three phases later, rebuilt from scratch.

At the end of each phase:

1. State what was produced, in one short paragraph.
2. State the specific decisions the next phase will depend on.
3. Stop. Ask for confirmation to proceed.

Do not roll two phases into one turn because the first "obviously" succeeded. Do not begin
Phase 5 finishing work because Phase 4 looks fine to you — the user has to say the cut is
locked, because Phase 5 is the point of no return (see the freeze rule in Phase 5).

The one exception: inside a phase, execute the whole phase. Gating is between phases, not
between steps.

## Phase 0 — Build the brand skill

Before any footage is touched.

1. **Ask for the client's own delivered cuts first.** If their editor has already cut anything
   in this series — even one reel, even a rough `vol1` — that file outranks the brief, the deck
   and your judgement on structure, pacing, length and language. Ask for it explicitly at the
   start; do not wait to be handed it three rounds in. See "Decode the reference cuts" below.
2. **Scaffold from an existing series skill.** Copy the structure — `SKILL.md` plus
   `references/brand-and-graphics.md`, `formats.md`, `hooks.md`, `interview-system.md`. You are
   copying shape, not content.
3. **Populate from the brand's own materials only**: website, strategy deck, logo artwork, font
   files. Not from inference about the category.
4. **Measure the brand, do not describe it.** Exact hex values pulled from artwork. Compare the
   wordmark's letterform metrics against the supplied font — if they match, it can be set as live
   type and you never need an image asset for it. Where the mark is drawn rather than set, say so
   and require the artwork file.
5. **Render a proof frame for every supplied font.** A font can register successfully and still
   fall back silently to a serif at render time. The catalogue lookup is not proof — the only
   proof is glyphs on a rendered frame. Do this before any card or caption is designed.
6. **Confirm commercial facts with the user, not the deck.** Pricing in a strategy PDF is
   routinely stale.
7. **Write the hard rules in now**: locked tagline, banned topics, anything that may never appear
   on screen or in audio. Include the **spelling of every brand term** — the product name, the
   domain, the ingredient names. ASR will mangle all of them and they recur in every reel.
8. **Build the end card as a real asset** and get it approved here, not later. If the client has
   a finished reel, the fastest correct end card is usually a trimmed copy of theirs — find the
   first fully settled frame after the dissolve and start there.

**Gate:** show the brand facts you measured and the hard-rule list. Confirm before ingesting
footage.

### Decode the reference cuts

When delivered cuts exist, transcribe them **word-level with timings** and build a beat map
before writing a single rule of your own. Measure, in this order:

- **Duration of every reel.** This is the real target, not the brief's number. On Breadberry the
  brief said 30-40s and the editor delivered 48-85s
- **Where silences sit and how long they are.** See the pacing rule in Phase 3
- **Whether fillers survive**
- **How long the single longest uninterrupted answer runs**, and where it sits
- **The closing CTA, verbatim.** It is usually near-identical across reels and is the single most
  copyable asset in the batch
- **When the brand is first named.** Often much later than the brief demands

Where the delivered cut and the written brief disagree, **say so to the client** and follow the
delivered cut unless told otherwise. Do not silently pick one.

## Phase 1 — Understand the material

9. **One master timeline with every source on it.** Read every transcript end to end. Never cut
   from excerpts.
10. **Audit for exclusions.** Expect at least one mislabelled or wrong-brand source. Identify it
    now, not after it is in three reels. Expect also at least one source that is *partly* damaged
    — a self-invalidated test, production chatter, an on-camera product defect — and record which
    fragments are salvageable rather than excluding the whole clip.
11. **Measure every source's framing once** — group span as fractions of frame width, eyeline
    height, who stands where, who is the interviewer. Record it.

Step 11 is the highest-leverage prep in the whole runbook and the easiest to skip. Every reframe
in Phase 5 reads from this table. Doing it late means measuring the same shots repeatedly from
rendered frames.

**Gate:** present the source inventory, the exclusions, and the framing table. Confirm before
deciding the series shape.

### The transcript is not the whole shoot

ASR logs speech. It does not log **performed action**, and vox pop is full of it — a walk, a
gesture, a taste, a reveal. Those stretches come back as silence or as a single stray word, and a
cut driven only by the transcript will trim straight through them.

Seen twice on real runs: a chanted run-through cut off mid-performance because the transcript
ended early, and a ramp walk logged as the single word "Um." spanning nearly five seconds. Where a
clip's transcript looks thin but the duration is long, look at the frames before trimming.

## Phase 2 — Agree the series shape

12. **Decide the format explicitly.** Is this a *proof* format — a physical demonstration that
    makes a claim provable — or an opinion montage? They are different edits. Ask; do not infer
    from the deck's vocabulary.
13. **Fix the speech ratio — from the delivered cuts, not from a rule of thumb.** Measure the
    client's own reel and use that number. See "The ratio is not what you think" below.
14. **Assign one distinct angle per reel**, and write each as a *goal* worked backwards:
    goal → seed → question → faces → landing.

**Gate:** present the format decision, the ratio, and the one-line angle for each reel. This is
the most important gate in the runbook. Confirm before cutting anything.

### The ratio is not what you think

**Do not import a participant-speech target from another client's series.** Clotrio ran 80/20
participant. Breadberry's delivered cuts run roughly **45% participant / 55% interviewer** — and
chasing 80% there produced a cut the client called "random", because stripping the interviewer
removes the questions, and the questions are what make a blind test legible.

Measure the ratio on the client's own delivered reel and hold that number.

When counting, separate three different things the interviewer does:

- **Questions and camera directions** — structure. Keep them. A camera direction like "show both
  slices to the camera" doubles as a viewer instruction telling the audience where to look
- **The closing CTA** — brand copy, not facilitation. Count it separately or it distorts the ratio
- **Explaining the product, or breaking the fourth wall** — cut absolutely, always

The failure mode is never "the interviewer spoke". It is "the interviewer sold".

## Phase 3 — Cut ONE reel to lock

15. Build a single reel to the agreed beat structure.
16. **Iterate that one reel until the user says it is right.** Every editorial rule the series
    needs will surface here — question count, banned mentions, fragment handling, how many faces
    the proof needs. Learning them on one reel makes them free on the rest.
17. **Audio smoothing only.** Do not run blanket pause compression — see below.

**Gate:** the user must say this reel is locked. It becomes the template.

### Anchor answers, not fragments

The commonest bad first cut is a string of two-second fragments from many people. It reads as
random because no one finishes a thought, and it fails no matter how good the individual lines
are.

The delivered cuts do the opposite: **one participant carries a long, specific, personal answer
early** — on Breadberry, 5.8s to 19.5s of a 48s reel, nearly 30%, one person explaining she makes
four small slices to fill up but only three of the bigger ones. Short corroborations from other
faces stack *after* that anchor.

Find the most concrete, most numeric, most personal answer in the footage. Let it run whole. Then
stack.

### Never blanket-compress silence

**This supersedes any instruction to run pause compression as a routine step.**

In a proof format the long silences are the evidence. The delivered Breadberry cuts keep silences
of **1.2s, 1.36s, 1.52s, 2.72s and 3.21s** — and every one covers a physical action: the slices
held up to camera, the bite, the giveaway handover, the blindfold going on. Compressing them to
250ms deletes the proof and leaves only people talking about proof.

- Compress only speech-to-speech gaps **inside a single answer**
- Never touch a pause that covers an action, a reveal, or a reaction shot
- If unsure whether a silence is dead air or a beat, look at the frames before deciding

### Do not strip fillers

"uh", "ah", "yeah, yeah" survive in the delivered cuts. They read as genuine street capture.
Removing them makes the reel sound scripted, which destroys the only thing vox pop has that a
studio ad does not. Filler removal is a talking-head habit and it is wrong here.

### Take the timestamps literally

When the user lists clips to remove by timestamp, remove **exactly those** and nothing adjacent.
Deleting a whole clip because it contains an unwanted word — rather than trimming past the word —
loses material they wanted kept, and it is the correction most likely to be issued twice.

Their timestamps also **go stale the moment the cut changes.** A note written against an earlier
version points at different footage after a deletion. When a timestamped instruction arrives after
structural edits, check what is actually at that time now and say so rather than acting on the
old assumption.

## Phase 4 — Batch the rest

18. Build the remaining reels from the locked one, varying source allocation so reels do not
    share footage where avoidable.
19. **Validate each structurally**: every clip's end frame equals the next clip's start. No
    overlaps, no gaps.

**Gate:** confirm the batch reads right before any finishing work. After the next phase begins,
changing a cut is expensive.

## Phase 5 — Finishing, in this exact order

**Freeze rule: once finishing starts, the A-roll is frozen.** A script-level edit rebuilds the
track and silently drops every item-bound effect and transition placed on it. If a cut genuinely
must change after this point, expect to redo the finishing pass too — say so before starting.

20. **Denoise the speech first — lightly — then level every clip.** Street noise sits in the same
    range as a music bed. But **do not run AI voice isolation / speech enhance on street
    footage**: it keeps only the voice nearest the mic and strips the participants and the crowd,
    which are the format. Use light denoise and per-clip gain levelling instead (numbers in
    [references/finishing.md](references/finishing.md), "Voice isolation").
21. **Reframe every clip.** Instant reframes only. Group-first — **every shot a two-shot or group
    shot, never a single-person close-up**, everyone in frame (bodies may be cut, people may not)
    — with the client's vertical anchor held level across cuts (eyes or tops of foreheads on
    `y = 640` by default; one client moved it 50–100 px higher; ask which). Step the zoom at jump
    cuts; where the client wants a run to read as one sentence, punch in **only tighter** within
    it (finishing.md → "Zoom in only"). The one exception is the hook shot at frame 0, which may
    punch in on whoever delivers the hook.
22. **Captions.** Style, then proof every card against the audio — brand and giveaway lines first.
23. **Title card**, persistent, ending exactly at the first frame of the end card.
24. **SFX**, on a track with no ducking role — placed, then levelled against each file's measured
    loudness, then faded. Check the **largest gap between cues**, not just the count — one client
    rule is "at least one cue every 7–9 seconds".
25. **Music last** — one bed per reel, and set the level **by item gain from measured loudness**.
    Ducking roles did not measurably attenuate the bed in a Desktop export (see finishing.md), so
    the item gain is what the viewer hears. Verify the bed level in the exported mix, not in the
    settings.
26. **Check frame 0 of every reel.** The first clip usually carries a default video fade, so the
    reel opens on black. Zero it and render frame 0 to confirm.
26b. **Meme B-roll only if asked** — real, watermark-free memes as cards, 2–4 per reel, only over
    dead moments, never over a genuine reaction (finishing.md → "Reaction memes").

See [references/finishing.md](references/finishing.md) for the framing geometry, caption spec,
voice-isolation batching, SFX levelling, music levels, export verification, and the traps in each
of these.

**Gate:** confirm the finished look on one reel before applying to the batch.

## Phase 6 — Export

27. Export at the resolution the user asks for (native source resolution only when they have not
    said). Pass the timeline explicitly on every export call — the export tool takes a timeline
    argument, so a batch no longer needs switching. **Render one reel at a time**: parallel
    renders crashed, and a stuck GPU renderer needed an app restart (finishing.md → "Export and
    verification"). Put the version first in the filename and never write "final".
28. **Verify the written files** — resolution against what was asked, and **duration against the
    timeline each file is named after.** Reels have distinct durations, so that comparison is what
    catches a misfiled render.

**Gate:** confirm before writing back to skills.

## Phase 7 — Write it back

29. Brand-specific learnings go in the brand skill. General craft goes here or in the editing
    skill. If the brand has no skill yet, create one — the per-brand skill is where hooks,
    vocabulary, spellings and the end card live, and without it those learnings have no home.
30. **Read the existing skill before updating it.** An update replaces the package; writing from
    memory silently drops whatever you did not remember.
31. **Correct superseded rules rather than appending.** A skill that contains both the old rule
    and its replacement will produce the old behaviour again.

## Where the rounds actually go

The detours that cost the most on the real runs, in order:

1. **Not asking for the client's own delivered cuts.** Everything below was re-derived expensively
   from a brief when one reference file would have settled it in a single pass. Ask on turn one.
2. **Cutting before agreeing the format.** Built opinion montages; the brief wanted proof scenes.
   All reels rebuilt.
3. **Cutting before agreeing the speech ratio** — or importing another client's ratio. Both fail.
   One run was ~90% interviewer; another chased 80% participant and stripped out the context that
   made the reel legible.
4. **Cutting fragments instead of anchor answers.** Produces a cut the client calls "random" or
   "abrupt" even when every line is individually good.
5. **Running blanket pause compression.** Deletes the action beats that make a proof format work.
6. **Finishing before the cut was locked.** Effects destroyed by a later script edit.
7. **Framing to the speaker instead of the group.** Correct for talking-head, wrong for vox pop —
   it crops the other participants, who are the format.
8. **Briefing music as "understated" / "sits low".** Produces tracks with nothing in them. No
   fader rescues an empty bed.
9. **Deleting picture without re-checking the audio tracks.** Ripple moves only its own track, so
   every A-roll deletion slides the SFX and music out of sync under the picture.
10. **Levelling SFX by ear or with a flat trim.** The complaint is almost never "too loud", it is
    "uneven" — and a flat trim preserves the unevenness exactly.
11. **Guessing what a client's named sound means.** Getting a sting's emotion backwards makes
    every placement wrong at once.
12. **Shipping a reel that opens on black.** A default fade on the frame-0 clip survived a whole
    export round on one batch before anyone looked.
13. **Fixing lip-sync by sliding the audio window.** Eats the first fraction of a second of speech
    at every corrected cut, invisibly. Move the picture instead — see the sync section in
    [references/finishing.md](references/finishing.md).
14. **Verifying a sync fix with the editor's own frame reader.** That is circular — it renders
    through the same mapping being tested, so it agrees with itself and proves nothing. Export and
    pixel-match against the source file.
15. **Chasing a sync complaint with more offset.** When every objective measurement says the export
    reproduces the master, stop adding milliseconds and say so. Several rounds went into tuning a
    ladder for a drift that no measurement could find.
16. **Varying the zoom per clip instead of per jump cut.** Puts a size pop on seams where the
    footage runs continuously.
17. **Answering "the zooms don't land" with deeper zooms.** Usually it is shot length, not
    magnification — add cuts on speech beats inside the long takes.
18. **Running AI voice isolation on street footage.** On the Circle "Guess the Price" batch it cut
    the participants' and crowd voices by 7–14 dB, with 35 dB+ dropouts at line ends; the client
    reported "a lot of audience sound is not audible". Light denoise plus per-clip gain fixed it.
19. **Trusting ducking roles to set the bed level.** A bed at ~15 dB under speech was called
    "overpowering" while the ducking settings said it should have been far lower — the export
    showed no measurable duck. Set and verify the level by item gain.
20. **Single-person close-ups in a two-hander.** The client wanted both people in frame in every
    shot; the punch-ins had to be rebuilt as two-shots across all four reels.
21. **Memes that covered real reactions, carried watermarks, or were stock.** Three rounds:
    stock reactions "not blending in", then watermarked TV clips, then too many memes over genuine
    emotion. Pick real, clean memes and place them only on dead moments, few per reel.
22. **A guess after the reveal, and two intros for one product.** Both read as broken to the
    client. Every guess before the one reveal; one setup per reel with its full context.
23. **Hand-over shots of the presenter instead of the participants.** A freebie montage must show
    the people receiving the gift — and keep everyone in that shot in frame.
24. **Punch-ins that zoomed back out, or zoomed until someone left frame.** Zoom in only across a
    same-moment run, capped, and render the tightest clip of each run.

Every one of these is a Phase 0-2 decision discovered in Phase 3-5, or a Phase 5 assumption never
verified against a frame.

## Rules

- Ask for the client's delivered cuts before building anything. They outrank the brief.
- Never begin a phase without explicit confirmation of the previous one.
- Never report a phase complete on an unverified result. Render frames, read files, check
  durations.
- Never run blanket pause compression or filler removal on a vox-pop cut.
- Never import a speech ratio, a duration, or a caption style from a different client's series.
- Re-read timeline structure at the start of every pass. The user edits between turns, and acting
  on a stale picture either fails or silently undoes their work.
- When the user says they deleted or changed something, verify it actually committed before
  building on it. It frequently has not.
- Ripple moves only the track it is on. Re-check every other track after any structural edit.
- Never verify an edit with the tool that produced it. A frame reader that shares the renderer's
  mapping cannot falsify a mapping bug; export and measure against the source instead.
- When a correction request would change the treatment rather than tune it — a zoom past the point
  both people fit, for instance — say so before executing, and offer the intermediate option.
- Remove exactly the clips the user named, and nothing adjacent to them.
- After any edit that follows an export, state plainly which delivered files are now stale.
- Do not claim a mix was auditioned. Where levels were set from measured loudness, say that.
- Surface a blocked capability immediately, not after designing around it.
- When the brief and the delivered cut disagree, surface the conflict rather than silently
  choosing.
- In reveal formats, every guess plays before the reveal, and each reel has one setup.
- Render exports one at a time; after two identical render failures, stop and ask for an app
  restart instead of retrying.

---

<!-- file: references/finishing.md -->

# Finishing — the settled numbers

Values proven on a 7-reel vertical series, 1080x1920 canvas, 2160x3840 source. Starting points,
not gospel — but they landed after several wrong attempts each, and the wrong attempts are
recorded so they are not repeated.

## Order is not negotiable

Denoise → reframe → captions → title card → SFX → music. Each step's correct setting depends on
the one before it. Balancing music before denoising is the classic failure: the traffic, not the
fader, is what buries the bed.

## Lip-sync correction — move the picture, never the audio window

When a client reports the voice arriving before the lips, the correction is a per-clip offset. There
are two ways to apply it and **only one of them is safe**.

**Wrong: slide the audio window inside its fixed slot.** Leave the clip where it is on the timeline
and push the audio's `sourceStartFromInSeconds` forward by the offset. The sync relationship is
right, but the clip's audio now *starts later in the source than the cut intended* — so the first
N milliseconds of speech at every corrected cut are simply gone. At 675 ms that is a whole word.
This is invisible in the timeline and only shows up as "that line got clipped".

**Right: pull the picture back.** Keep the audio on the cut point the edit was designed around and
move the *video* earlier by the offset instead:

```text
newAudioStart = the original designed cut point
newVideoStart = that cut point − offset
```

Same sync relationship, nothing lost. Picture has no word boundaries, so sliding it costs nothing;
the extra frames at the head are just the speaker a moment earlier.

**A ramped offset needs the picture split, not the audio.** When the drift grows across one long
take, the instinct is to cut the audio into segments and step each one. Every one of those seams
drops the audio between segment *n*'s end and segment *n+1*'s start — a 200 ms hole mid-sentence on
the run where this happened. Instead **split the video** at the same boundaries, keep the audio as
one continuous run, and pull each picture piece back by its own offset. The picture pieces overlap
by the step size, which on a static two-shot is an invisible one- or two-frame repeat.

**Auditing an existing reel takes one read.** Compare each clip's audio `sourceStart` against its
video `sourceStart`. Equal means untouched. Audio *later* than video means the window was slid and
speech is being eaten. Video *earlier* than audio by a constant means it was done correctly.

## Framing

**Instant reframes only.** Set the item's `width` / `height` / `left` / `top` directly. Animated
zoom presets draw attention to themselves and fight a fast-cut rhythm.

**Group-first for vox pop.** Everyone stays in frame, every clip. Cropping a participant to favour
whoever is talking breaks the format — the reactions are the content. This overrides the
talking-head instinct to aim at the speaker.

**The eyeline governs the vertical only.** Speaker's eyes on the upper third — `y = 640` on a
1080x1920 canvas. Horizontal is decided by the group's span.

**Some clients anchor the forehead, not the eyes.** Circle's note was "move them up to touch the
foreheads on the 1st grid line" — the top of the forehead (hairline) on `y = 640`, which sits the
faces noticeably higher than an eyeline rule. A later round raised it again — "move each frame by
the head 50px to 100px up match the frames" — so the delivered anchor is ≈ `y = 565`, applied as a
uniform −75 px on every footage item (V1 and cutaways). Ask which anchor the client means before
the pass, and keep head height level from cut to cut.

**"Everyone in frame" means people, not bodies.** "Body halves can be cut but try keeping people in
frame." Cropping at the waist or knees is fine; a face or a person half out of frame is not. The
widest group shot and the tightest punch-in of a run are where this fails — render those.

**Measure the anchor on rendered frames with a temporary grid overlay** rather than estimating from
source fractions. Push an SVG with labelled horizontal lines every 80px (320–1120) and a heavy line
at 640, lay it on a temporary top track for the whole reel, render the **mid frame of every V1 clip**
(9–12 per sheet reads cleanly; 25 per sheet is too small to read to ±20px), read the anchor `y` for
each person, average the two, then:

```text
top_new = clamp(top + (640 - anchorY), 1920 - height, 0)
```

If the clamp stops it short, change `m` instead (a larger `height` lowers the face at `top = 0`;
re-centre `left` so every face stays inside x 40–1040). Re-render the same frames to confirm, then
delete the grid item **and** its track. People move inside a long clip — measure at the clip's mid
frame and say that drift elsewhere in the clip is unverified.

**The hook shot is the exception to group-first.** At frame 0 the client may want the frame punched
in on whoever delivers the hook — a wide four-person group shot reads as a weak visual hook. On the
Circle batch that was ~2.25x on the speaker plus the person beside him, his forehead on the line.

Measure the group's outer **body** edges `[uL, uR]`, centre `uC`, eyeline `v`, as fractions of the
source frame:

```text
width  = 1080 * m
height = 1920 * m
left   = clamp(540 - uC * 1080 * m,  1080 * (1 - m),  0)
top    = clamp(640 - v  * 1920 * m,  1920 * (1 - m),  0)
```

Verify both outer edges clear the canvas:

```text
uL * 1080 * m + left  >=  40
uR * 1080 * m + left  <=  1040
```

Which bounds `m`:

- **Upper**, so nobody is cropped: `m <= 1000 / ((uR - uL) * 1080)`
- **Lower**, so the eyes can reach the line: `m >= 640 / (v * 1920)`

If the lower bound exceeds the upper, the shot is too wide to place the eyeline exactly. Take the
widest `m` that keeps everyone in and let the eyes sit high. Never crop a person to hit the line.

**Measure body edges, not faces.** Reading the span off head positions and forgetting an
outstretched arm is the commonest cause of "someone is still going out of frame".

**Vary `m` between consecutive clips from the same camera** so each cut reads as a reframe. Wide
group shots leave almost no room — a five-hander caps near 1.05x — and those cuts will look alike.
That is the honest cost of keeping everyone visible.

### Step the zoom at jump cuts, not at every clip

Varying `m` by clip *index* is wrong: it also changes size across cuts where the footage runs
continuously, which adds a visible pop to a seam the viewer would never otherwise notice.

Classify every boundary first — compare this clip's source start against the previous clip's source
end:

```text
|srcStart[i] − srcEnd[i−1]|  >  0.1s   →  jump cut,   step the zoom (it needs covering)
                            ≤  0.1s   →  continuous,  hold the zoom (there is nothing to cover)
```

On a real batch that was 17–21 steps and 0–9 holds per reel; the reels with the most holds are the
ones with long unbroken answers. A three-value cycle (e.g. 1.30 / 1.38 / 1.45) advanced only at
jumps guarantees no two neighbours match.

**The exception is a deliberate punch-in** — see "Cut density" below — where you *want* the size to
change on continuous picture.

### Zoom in only — when the client wants one sentence

Circle's note: "when overlapping frames from same footage appears use only zoom ins to show
transitions as one sentence". A cycle like 1.30 / 1.38 / 1.45 / 1.30 zooms back *out* every third
cut; this client wanted each jump cut inside one moment to read as a push forward. Method used:

1. Group consecutive clips into **runs**: same source asset, adjacent on the timeline, and
   continuous in the source (gap between −0.5 s and 6 s). A new person or a new moment starts a new
   run, even from the same file.
2. Keep the run's first framing. Each next clip is `max(its own width, previous × 1.06)`, capped at
   **1.25× the run's first width** — never smaller than the clip before it.
3. Scale around the faces (anchor ≈ x 540, y 760), keep the source aspect exactly (width a multiple
   of 9 for 9:16 sources), then apply the head-height offset and clamp to cover the canvas.
4. Render the tightest clip of every run. Where the pair stand far apart the cap is still too deep —
   on one wide fence two-shot it pushed a face off the edge. Ease the step (~3%) and pan toward the
   person nearest the edge rather than cropping them.

The uncapped first version reached ~2× on six-clip runs; most faces survived but the deepest
crops did not. The cap and the source-continuity test are what made it safe to apply in bulk.

### Cut density governs how much work the zoom can do

A 16-second unbroken answer gets one framing and reads flat no matter how well chosen it is. If the
client says the zooms are not landing, the fix is usually **more cuts**, not bigger zooms.

Add cuts inside long takes on speech beats — speaker turns, sentence starts, pauses over ~0.5s —
and let each new piece take the next zoom. Because the source runs continuously across those cuts,
the picture does not jump; only the size changes, which reads as a punch-in. One reel went 13 → 27
clips this way, average shot 8.9s → 2.6s, with no new jump cuts introduced.

### Above ~1.5x the group rule breaks and the treatment changes

The "everyone in frame" rule has a hard ceiling set by the pair's span: `m ≤ 1000 / ((uR−uL)·1080)`.
On these two-shots that lands between **1.12x and 1.43x** depending on how far apart they stand.
Past that the frame physically cannot hold both people.

If the client asks for deeper than that, say so plainly — it is not a tuning request, it is a change
of treatment to **speaker-following**, and that needs two more inputs:

- **Who is speaking per clip** — available from ASR diarization as `speakerId` on the transcript
  read. Free; do not try to infer it from the words.
- **Which side each speaker stands on** — the interviewer holds the mic. Two source frames settle
  it: at their own mouth while asking, pointed at the other person while listening.

Clips where the speaker changes mid-clip must be split at the turn so the frame follows on the word.

**A middle setting exists**: keep both in frame but bias the window toward whoever is speaking,
clamped so the other person's face stays ≥50px inside the edge. That buys roughly 240–305px of
travel at 1.30–1.45x. Offer it before committing to full speaker-following — one client asked for
it and then decided a locked centre read better.

**At deeper zooms the binding constraint moves from bodies to faces.** The "measure body edges"
rule above is for the no-crop case. Once outer shoulders and bags are allowed to clip, measure the
**face** span `[fL, fR]` and constrain on that instead — bodies can leave, faces cannot.

**Measure every reel from its own footage, and every take within a reel.** One reel that cut between
two separate takes needed two framing profiles; using one for both put the pair off-centre for half
the runtime.

**The emotion punch is the one exception.** When the interviewee is speaking and the line carries
real feeling, punch deep and let the interviewer leave frame. Three or four beats per reel, never
two in a row, never on the interviewer. Needs `m >= 0.5 / u`; lands around 1.6–1.75x on a
two-hander.

**Product push-ins** when the line is about the object: 1.8–1.9x centred on it, placed near
`y = 860` so it clears the caption band. No eyeline rule applies.

**The brand trap.** Never push in where another brand's mark becomes legible. Handled samples are
often competitor or manufacturing-partner goods; a printed waistband is invisible wide and the
clearest text on screen at product scale. Render the pushed frame and read it before committing.
On the real run only two of seven proof beats survived this test. Also sweep the **wide** frames —
a mark can already be legible without any push, which is a pre-existing exposure the client must
decide about.

**Silence beats are framing beats.** Where the cut holds a long silence over a physical action —
a slice held to camera, a bite, a handover — that is the moment to be wide enough to see the
object, not pushed into a face. Read the pacing rule in Phase 3 before choosing `m` for those
clips.

## The first frame

**Check the first clip's `fadeIn` before delivering.** A clip placed at frame 0 commonly carries a
default video fade — 0.25s on the run where this surfaced, which is roughly 7 frames ramping up
from black. Every reel in the batch had it, and it survived a full export round before anyone
looked at frame 0.

A reel that opens on black has already spent its most valuable frames. Set `fadeIn: 0` on the
frame-0 item of every timeline and render frame 0 to confirm.

Leave the **audio** fade-in alone. It is around a tenth of a second, exists only to stop the first
sample clicking, and has nothing to do with the black picture.

## Captions

| Setting | Value |
| --- | --- |
| Size | `fontSizeRatio` 0.064 |
| Base colour | white |
| Outline | brand dark, width 7, 0.85 opacity |
| Spoken word | accent colour, `highlightUnit: word` |
| Layout | `top: 1315` |

The outline, not a background pill, is what keeps white legible over bright daylight street
footage.

**Correct the ASR, not the speaker.** Fix spelling, fused words, homophones, missing apostrophes.
Leave the speaker's own grammar — rewriting it puts words on screen they did not say.

**Never add words to make a line read better.** The highlight is word-timed; an extra word desyncs
it. If a card ends on a fragment, it ends on a fragment.

**Patching card text cannot fix card timing.** If a cue is missing, adding the words to a
neighbouring card gives them that card's timing — they appear and highlight before they are
spoken. A genuinely missing cue needs the program rebuilt.

**Enabling captions grabs every audible track.** `enable` resolves its default scope to *all* audible
timeline sources — on a finished reel that is the picture track, the detached speech track, the SFX
track and the music bed. Because the picture and the detached speech carry the same words, you get
**doubled cards on screen**. Always follow `enable` with `set_sources` scoped to the single detached
speech track, then `refresh`, before touching any card text.

It also re-attaches itself later. Any structural edit — voice isolation, a reframe pass, splits —
can silently put the picture track back in scope. The tell is doubled cards *and* every card id
rehashing, so a queued batch of `set_card_text` calls fails with "cue ref not found". Re-scope,
re-read for fresh ids, then edit in small batches.

**The deleted-track trap.** Captions enabled while two video tracks existed keep both as sources.
Delete one later and the program still references it — no error, cards still read back fine, but
cues get silently dropped. Symptom is a truncated phrase followed by silence. `refresh` reports
zero changes because the program believes it is canonical. Fix with `set_sources` on the live
speech track, and check every reel where a track was ever deleted.

**Banned brand vocabulary is a caption problem too.** Where a participant says a word the brand
forbids, the caption is display text and need not transcribe it — but the audio still carries it.
Flag it to the client rather than deciding alone.

## Title card

Persistent per-reel lockup, top of frame. Natural box 900x110, placed at **1.35x — 1215x148,
`top: 192`**, horizontally centred so `left` goes negative (correct: the pill inside is narrower
than the box).

One shared asset with the reel title passed as a property override, not an asset per reel.
Place on the highest video track. Entrance completes inside the first second, then holds static.
**Ends at the first frame of the end card**, never over it.

A full-frame title card at 0s is a retention bug — it delays the hook. The persistent bar carries
identity continuously instead of blocking the opening once.

## Voice isolation

**Default for street vox pop: do not use AI voice isolation / speech enhance.** It keeps only the
voice nearest the mic. On the Circle "Guess the Price" batch it cut the participants' and the
crowd's voices by 7–14 dB, with 35 dB+ dropouts at the ends of lines — measured by comparing the
export against the source in 0.25s RMS windows — and the client's note was "a lot of audience sound
is not audible". What fixed it:

1. Replace the processing on every speech clip with **denoise at strength ~0.35** only. That stayed
   within 1–3 dB of the source.
2. **Level each clip by gain**, from its measured source loudness (`volumedetect` mean over the
   clip's source range, 120 Hz high-pass):
   `decibelAdjustment = (-18 - meandB) + 1`, capped at `+12`, floored at `-3`, and limited so
   `maxdB + gain <= -1`. Skip anything under 1.5 dB. Off-mic guest and crowd clips typically need
   +6 to +12 dB; host-on-mic clips need nothing.
3. **Do not use the loudness-normalization processor for this.** It pulled the clips ~5 dB *down*
   rather than levelling them.

Processing settings replace the whole configuration, so writing `{denoise}` also removes a previous
speech-enhance entry. Leave the end card's audio unprocessed.

The notes below apply only where voice isolation is genuinely wanted (single on-mic speaker, no
crowd that matters).

Where it works, run it on **every** speech clip in the reel, and skip anything with no speech —
an end card or a product shot gets distorted, not cleaned.

**It is one pass over the whole source, cached per source asset.** Once the cache is warm the
remaining clips resolve instantly, and every clip pulls from the same cleaned take, so there is
no processing seam at the cuts. That is what makes it safe on a reel cut into sixty pieces.

**Do not fan out a large parallel batch onto a cold cache.** The first two or three calls start
before any cache entry or compressed proxy exists, each renders its own denoised asset off the
**uncompressed** source, and those clips end up on a different render from the rest of the reel.
The tell is `sourceWasCompressed: false` and a distinct denoised asset id in the result.

The fix is cheap and worth doing every time: after the batch completes, **re-apply the handful
that reported the uncompressed source.** They then resolve to the same cached render as everything
else. Check the whole reel lands on one denoised asset id before calling it done.

Occasionally one clip **will not converge** — it keeps resolving to its own cache entry even after
clear-and-reapply. Both renders are the same engine over the same source, so the difference is a
duplicate file rather than a different sound. Note it and move on; do not burn a round on it.

It can also **fail on an entire shoot** — seen returning `mask output contains a non-finite value`
on every clip across multiple sources, with no fallback. Surface that before designing the mix
around clean speech.

## SFX

On a track with **no ducking role** so they are never attenuated.

**Cue count is the client's call, not a house number.** One run wanted five to seven; another
asked for a minimum of ten per reel, spread from the opening rather than back-loaded; Circle asked
for "at least one every 7 to 9 seconds". Ask — and when the rule is a spacing rule, list the cue
start frames and check the **largest gap**, including the last cue to the reel end.

**`fromFrame` is the anchor, not the start.** The item shifts back so the hit lands on that frame.
A 3-second riser at frame 1081 begins near 997. Check the previous cue's end before batching.
**The anchor is per file, and some library cues anchor at their start.** The built-in short drum
roll landed *after* the reveal when placed with `fromFrame` at the reveal; place a lead-in cue with
an explicit `startFrame = reveal - durationFrames` instead, and read the returned start frames.

**Two SFX tracks, alternating, when cues sit close.** Same-track items cannot overlap, and pops on
consecutive guesses can be under a second apart.

**A working vocabulary for a price-guess format** (built-in library): synthetic bubble pop on every
guessed-number pop-up, airy short whoosh as the product card enters, simple whoosh on cuts to fill
gaps, short drum roll into the reveal, cash register on the reveal, clean ding on the end card.
Levels used: pops −6, whooshes −8/−9, drum roll −8, cash register −6, ding −6 (not yet measured
against file loudness — level them properly on the next pass).

**A large meme SFX library is not permission to use it.** Where the brief says minimal, most of a
buzzer-and-quack library is off-brand for a premium or appetising edit. Use sparingly and only
where a reaction genuinely lands.

### The opening cue is its own problem

Every reel should open on the same cue so the batch reads as a series. Two things decide whether it
lands, and length is the one clients name first:

- **A sub-second blip does not register.** A 0.76s whoosh at frame 0 was described as "doesn't
  land"; a **2.8s riser** in the same slot did. Prefer a cue whose energy ramps from near-silence —
  it builds *under* the opening line instead of covering it, which a front-loaded hit cannot do.
- **The opener sits hotter than the bed.** Mid-reel cues normalise to ≈ −24 LUFS; the opener wants
  roughly **−20 LUFS** (about 4 dB up). It is a hook accent, not background texture.

A riser resolves at its *end*, so placing one at frame 0 means it arrives a few seconds in, not on
the first frame. That reads as a launch into the reel. Timing it to resolve on a specific cut is
per-reel work — the first cut lands somewhere different on every reel — so only do it if asked.

**Check the SFX track for collisions before swapping the opener in.** A longer opener can overlap a
cue already placed on a beat. Give the opener its own track on those reels rather than moving a cue
the client positioned deliberately.

### Normalise against measured loudness, not by ear and not by a flat trim

A stock SFX folder is wildly uneven. One measured library spanned **−4.4 to −26.8 LUFS — a 22 dB
spread**. Placed at unity, the mix is not uniformly loud, it is *uneven*: two or three cues stab
and the rest sit fine. Pulling the whole track down preserves the spread and therefore preserves
the problem.

Read each asset's loudness and set the item gain per cue:

```text
decibelAdjustment = target − assetLUFS,   target ≈ −24 LUFS,   never boost above 0
```

On the measured library that produced roughly −20 dB on the hottest sting, −9 on a mid ding, and
−4 to 0 on the already-quiet ambiences. Average drop about 10 dB, and nothing protrudes.

**Fade every cue.** Butt-cut effects click at both ends, and that click is a large part of what
gets described as "jarring". Run the audio-smoothing sweep over the SFX track — it is idempotent,
it clamps fades to clip length, and it skips anything already faded. Three frames each side.

If effects still crowd the voice after levelling, the next lever is a different kind: give the SFX
track a follower role so it ducks under speech. Reach for that only after levelling, not instead
of it.

### Semantic cues belong to the client — pin them before placing

Where the client has named sounds, get the meaning explicitly and write it down. On one run a
"faa" meant *disappointment* and a "quack" meant *failure* — both had been placed as surprise and
as a win, which made every single placement wrong and required a full re-pass.

**A cue tied to an emotion has to be verified against the picture.** The same run added the rule
that a disappointment sting may only land on a face visibly showing it. Rendering the frames found
two of three placements sitting over hands and a phone, and one over the subject mid-sentence.
Render the frame before committing an emotional cue.

**Never end a reel on a negative cue.** Land the close on the positive one over the end card.

### Anchoring positive cues to brand moments

Search the transcript for the brand name, the product name and the ingredient or feature words,
and anchor a positive cue on each hit; the end card is the last one. That covers the moments the
viewer *hears* the brand.

**The limit worth knowing:** transcript search only finds *spoken* brand moments. A shot where the
product is physically handed over or held to camera with nothing said about it will not surface,
and on one run that was the strongest product beat in the reel. Sweep the picture for those
separately. Note also that the search only covers sources with word-level transcripts — assets
without them are skipped silently, so a null result is not proof of absence.

## Music

**One bed per reel.** Never reuse across a series — seven reels sharing a track reads as one video
cut seven ways. Keep one sonic family and vary the character per reel's angle.

**Do not brief a bed as "understated", "restrained", "sits low", or "no lead melody competing with
speech".** That produces a track with nothing in it; attenuate it for the mix and it is silent.
Brief something genuinely musical and clearly audible under speech, then control it with level.

A house style that worked for street vox pop: uplifting lo-fi hip hop — swung boom-bap drums, warm
bass, dusty Rhodes, tape saturation, vinyl crackle — with a jazz, rock, or afrobeat top line per
reel.

**Roles and levels are two separate steps.**

| Setting | Value | Where |
| --- | --- | --- |
| Speech role | `anchor` | the **video** track with embedded speech, usually V1 |
| Music role | `follower` | the music track |
| Music level | `decibelAdjustment = targetBedLUFS − trackLUFS` (target is a per-client number, see below) | the item, not the track |
| Duck depth | `duckDepthDb: -5` to `-8` | `audioRouting` on the music track |

Two proven pairs, from different runs, both on beds mastered near −10 LUFS: **−5 / −5** on the
7-reel series, confirmed by ear; and **−6 / −8** on the HackDaily batch, set from measured file
loudness and *not* auditioned. Do not copy these gains to a bed mastered at a different loudness —
convert to a target bed LUFS first. Start
from −5 / −5 where the reel has any breathing room in the speech, and go deeper only if the bed
is genuinely fighting the voice.

Assigning roles switches ducking on, but a freshly placed music item sits at 0 dB — full level.
Generated beds master near -10 LUFS and street speech runs -9 to -11, so an unadjusted bed is as
loud as the dialogue and ducking only makes it slightly less loud. That reads as "ducking isn't
working" when the roles are in fact correct.

**The duck is permanent, not momentary — budget item gain and duck depth as a sum.** This is the
mechanism behind every "the music disappeared" report. In a tightly cut vox-pop reel the speech
items butt up against each other across the entire timeline, so a follower track never gets an
un-ducked moment. Item gain and duck depth stop being two independent controls and become one
constant attenuation.

So `-12` with a `-9` duck is not "quiet under speech", it is −21 dB everywhere — and it vanished.
`-14` with a *derived* duck vanished the same way on a later run. `-6` with an explicit `-8` lands.

Set the depth explicitly rather than leaving it derived — derived depth is invisible in the item
data, so nothing in a read can confirm ducking is doing anything.

**Then measure whether the duck happened at all.** On the Circle "Guess the Price" batch (Desktop,
speech on a detached audio track as `anchor`, bed track `follower`, `duckDepthDb` 14) the export
showed **no measurable duck**: projecting a music-only render onto the full mix gave the bed at
0.1 dB of its un-ducked level. So item gain alone set the balance, and the earlier "permanent duck"
model above may not hold on every build or routing. The method, which takes one render:

1. Mute the speech and SFX tracks, export a WAV of a speech-heavy section, unmute.
2. Least-squares project that music-only WAV onto the same section of the exported mix, searching a
   ±100 ms lag for AAC priming. The fitted gain is the bed's level in the mix relative to un-ducked.
3. Bed LUFS in the mix ≈ music-only LUFS + 20·log10(gain). Compare against the mix's speech LUFS.

**Bed level is a client number — and they differ by a lot.** Circle called a bed ~15 dB under the
speech "overpowering"; the delivered batch sits ~20 dB under (bed ≈ −34 LUFS against ≈ −14 LUFS
speech, item gain = −34.5 − the track's LUFS over the used range). Another client found ~21 dB under
"vanished". Ask, set it from measurement, and record the number per brand.

**Skip the generated track's intro.** Generated beds often open with 6–9 s of near-silence before
the groove; start the item's `sourceIn` where the groove starts (scan 3 s windows with
`volumedetect`), with a 6-frame fade-in and a ~40-frame fade-out over the end card.

**One bed per reel means one generation per reel.** Brief each to the reel's product or angle
(fashion → nu-disco funk, home → warm chill-hop, tech → sleek electronic) within one sonic family.

**Where the client names a track from a subscription library** (a Canva Pro tune, a stock cue),
it usually cannot be pulled programmatically. Either the client exports it or a substitute is
generated and approved — surface this early rather than designing the mix around it.

## Reaction memes

Only when the client asks for meme or GIF B-roll. What one client accepted after three rejected
rounds (Circle, Oct 2026):

- **Real, recognisable internet memes**, not stock reaction footage — stock 3D/cartoon reactions
  were "not blending in". Giphy MP4s (`media.giphy.com/media/<id>/giphy.mp4`) are quick to pull.
- **Watermark-free, verified at native size** on the first, middle and last frame of each clip —
  channel and network bugs or meme-site tags disqualify it. Most Indian TV clips carry a channel
  bug; film clips from official studio uploads are often clean. A tiny site tag on an edge strip
  may be cropped off; never crop out a rights-holder's logo — pick another clip.
- **Only on dead moments** — the host talking, a flat guess, an explanation. Never over a genuine
  reaction: "too many memes covering actual emotions of people on screen, only use to fill dead
  emotions or space". Hide the meme track and render the footage under every slot first.
- **Few** — 2–4 per ~1-minute reel ended up right; one reel was cut from 4 to 2 on request.
- **As a card over live footage**, not a full-frame cutaway (480 px sources go soft full-frame): white
  border, rounded corners, alpha render (ProRes 4444), ~960 px wide, centred between the top
  overlays and the caption band; pop in from 80% over 5 frames with ease-out-back, 3-frame fade
  out, ~1.2 s, silent.
- Keep a client's banned list (one client banned the confused-Travolta meme) and flag the
  copyright/mute risk of film and TV clips once.

## Reordering a reveal format

In game formats (price guess, quiz, blind test) the **story order** is a correctness rule, not
taste:

- **Every guess before the reveal.** Intercut several groups' guesses first, then one reveal. A
  guess heard after the answer is out reads as broken, and a second group's own "this is actually
  X" becomes a duplicate reveal — drop it.
- **One setup per reel.** Two people introducing the same product back to back is a repeat; keep
  one intro (the client picks which) with its full sentence so the context survives.
- **Hand-over shots must show the participant with the gift**, not the presenter holding it.
- A reorder is a multi-track edit: split the clip at word boundaries, move or delete pieces, move
  the overlays and SFX that belong to each line, shift every later item on **every** track by the
  same delta, trim the music, then re-read the captions (moved and split clips can lose earlier
  card fixes).

## Export and verification

**Pass the timeline on every export call.** The export tool takes a timeline argument and an
explicit resolution/fps, so a batch can be exported without switching the active timeline, and
export progress can be tracked and waited on. (Older builds rendered only the active timeline; if
the argument is ever missing, switch per call and expect a wrong order to produce a
correctly-named file with the wrong content.) A wait can be interrupted by a new user message —
re-check status rather than assuming the renders failed. Existing files are never overwritten, so
give each round a new version prefix.

**Render one reel at a time.** Four parallel 1080p renders on Windows killed one with "native host
exited". Later, renders failed back to back on two different timelines with "failed to acquire
PixelFrame SharedImage" — a stuck GPU renderer, not a timeline problem. Stop after the second
identical failure, ask the user to restart ChatCut, then export sequentially; after the restart all
four rendered cleanly one by one.

**Look at the export folder before reporting files.** The user may tidy it between rounds — on one
batch every earlier version had gone and only renamed files remained. Report what is actually on
disk, never delete their files, and re-export anything they will need.

**Verify every written file, and use duration as the identity check.** Reels in a batch have
distinct durations, so comparing each file's duration against the timeline it is named after
catches a misfiled render immediately. Match to within a frame — the container rounds.

`ffprobe` is frequently not installed. On macOS, `mdls` needs nothing:

```bash
mdls -raw -name kMDItemDurationSeconds -name kMDItemPixelWidth -name kMDItemPixelHeight file.mp4
```

On Windows, `ffprobe` / `ffmpeg` are often present via Chocolatey and give width, height, duration
and integrated loudness in one pass per file.

Native renders return as soon as they are **queued**, not when they finish. Track them with the
export progress tool by task id; poll for the files only on builds without it.

**A project edit silently invalidates every already-exported file.** After any change following an
export, say plainly which files on disk are now stale. Re-export by deleting the old files first
so the new renders write to clean paths rather than colliding.

Frame-accurate structure is all this proves. It does not prove the mix. Where levels were set from
measured loudness rather than by ear, say so rather than implying the render was auditioned.

## Traps that block edits

**Ripple only moves the track it is on.** Deleting A-roll on the video track does not shift the
SFX or music sitting under it, so every clip deletion silently slides the whole audio design out
of sync with the picture. Either re-place the affected cues or compute the cumulative shift and
move them explicitly — and re-check the audio tracks after *any* structural edit.

**Stale transitions.** Audio crossfades survive a manual reorder. Once their endpoints are no
longer adjacent they reject *any* batch touching those clips — including a pure reframe that moves
nothing. The error names one per attempt; delete them in the same call and resubmit until it
passes. Four rounds on one timeline was normal.

**Same-track overlap.** `editor-core rejected timeline` or `invalid_source: track_overlap` means
two items share frames. When closing one, check what the user's other edits imply — a downstream
clip positioned to follow a duplicate collides again the moment the duplicate is removed, so the
whole chain needs re-contacting along with the end card, title card, music length and tail SFX.

**Motion Graphics cannot use locally-registered images.** MG image properties require a
cloud-hosted asset and reject both `data:` URIs and external URLs. A logo imported from the user's
machine is terminal `local-only` and will not composite inside an MG. Place it as a plain image
item instead, or reuse the client's own rendered card.

**Custom fonts can render without appearing in the catalogue** — and can fail to render while
reporting a successful import. Neither the catalogue nor the import result is proof. Render a
frame with the glyphs and look at it.
