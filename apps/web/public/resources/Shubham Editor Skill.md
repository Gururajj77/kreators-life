---
name: workflow-1125a3d5-shubham-editor-skill
description: Two-mode vox-pop and advertorial video workflow. Mode A segments a long multi-interview master into self-contained editorial building blocks with timeline markers and a metadata table. Mode B cuts a finished vertical short-form video (Reels / Shorts / TikTok) under a retention-and-advertorial rulebook. Use for any vox-pop or street-interview master, and for any short-form advertorial cut-down.
---

# Shubham Editor Skill

Two modes. They are mutually exclusive, and several of their rules directly contradict
each other by design. Pick the mode before touching anything.

- [references/shared-invariants.md](references/shared-invariants.md) — rules that hold in **both** modes. Read first.
- [references/segmentation-mode.md](references/segmentation-mode.md) — Mode A detail.
- [references/finishing-mode.md](references/finishing-mode.md) — Mode B rulebook.
- [references/qa-checklist.md](references/qa-checklist.md) — the gate for both modes.
- [references/detection-toolkit.md](references/detection-toolkit.md) — proven techniques: scene-change detection, lossless export, verification.
- [references/reframing-and-zoom.md](references/reframing-and-zoom.md) — Mode B framing system: frame scanning, the centering maths, instant zooms, rotation.
- [references/polish-and-mix.md](references/polish-and-mix.md) — Mode B polish: captions, MGs, SFX, music, mix verification, colour grade, export.
- [references/field-notes.md](references/field-notes.md) — failures from real runs. Read before the first write.

## Standing rule: propose, then wait

**Before any step that changes the project, say what you intend to do and wait for
approval.** This applies at every phase boundary, not once at the start. Never bundle a
plan and its execution into the same turn.

**Read-only work is exempt and must not be interrupted.** Reading transcripts, sampling
frames, running scans, measuring levels — do all of it without asking. Pausing mid-analysis
to check in stalls an approved task and reads as refusing to work. Run the analysis to
completion, then pause before writing.

When a writing phase finishes, report what changed and propose the next one. Do not roll
straight into another write because it seems obvious.

## Mode gate

|  | Mode A — Segmentation Pass | Mode B — Short-Form Finishing |
| --- | --- | --- |
| Input | Long multi-interview master | One chosen segment, or a clear brief |
| Cut model | Three operations: cohort cuts, contextual beats, edge trims | One cut list |
| Output | Timeline markers + metadata table | A finished, exported video |
| Duration | Whatever the narrative needs | 45–60s target, 90s hard ceiling |
| Hook | Never build one | Always build one |
| Captions, SFX, music, zooms, graphics | Never | Yes |
| Zoom style | n/a | Instant ratio changes only — never a moving push |
| Reordering dialogue | Never | Allowed |
| Pauses and silence | Keep | Trim only what genuinely hurts pacing |

**If the mode is not obvious from the request, ask. Never assume one.**

Mode A signals: a long master, several participants or sessions, "find the videos in
this", "what's usable", "segment this".

Mode B signals: a segment already chosen, an approved segment from a prior Mode A pass,
a stated platform and duration, "make the video", "cut this down".

A single job often runs A then B, with the user choosing segments in between. Never run
them back to back without approval at the boundary.

## Priority when decisions conflict

1. Advertorial / brand requirements
2. Comprehension
3. Retention
4. Emotional impact
5. Pacing
6. Visual stimulation
7. Effects

An editor optimising purely for viral retention makes exactly the wrong call: it cuts
the product handling, tasting, reaction, packaging shot, or silent demonstration that
makes the advertisement work.

## Measure before you frame

On locked-off interview footage there are no cutaways — the cut and the framing are the
only visual tools available. Framing is therefore load-bearing, and it is **arithmetic
before it is taste**:

- Measure each subject's position from a full-resolution single frame, once per source.
- A subject at normalised x cannot be centred below `1 / (2·x)` magnification.
- Sample a frame from every source before planning structure; separate shooting rigs hide
  inside one folder and crossing them mid-story breaks continuity.

Details in [references/reframing-and-zoom.md](references/reframing-and-zoom.md).

## The question to ask at every moment

Not "what effect can I add here?" but: *what is the viewer supposed to feel, understand,
or become curious about at this exact moment, and what is the simplest edit that
produces that outcome?*

---

<!-- file: references/detection-toolkit.md -->

# Detection Toolkit

Concrete techniques that worked on a real 3h11m 4K vox-pop master. Use these rather than
re-deriving them.

## Scene-change detection (frame-accurate cohort cuts)

The camera stops and restarts between street interviews. That hard cut is the only
frame-accurate boundary signal.

**Method.** Sample frames, downscale hard (64×114 is enough), convert to linear grey,
and take mean absolute difference against the previous sample. A hard cut spikes;
within-shot motion does not.

**Observed values on real footage:** baseline ~5, hard cuts **20–62**. Threshold at
`median + 8 × MAD` separated them cleanly with no tuning.

**Two-pass refinement:**
1. Coarse — scan ±30s around the estimate at 1s steps, take the max-scoring sample.
2. Fine — rescan that sample's neighbourhood (−1.2s to +0.2s) at 1/30s, take the max if
   it holds ≥80% of the coarse score.

**Confidence.** Report any boundary scoring below ~16 as low-confidence and flag it for
human review — both in the marker text and in the exported filename.

**Performance.** Roughly 5 samples/sec against a 14GB 4K file, so scan targeted windows
around known estimates rather than the whole file. A full-file pass at 1s is ~35–50
minutes; 39 targeted windows with refinement is a few minutes.

Implement with AVFoundation (`AVAssetImageGenerator` with zero time tolerance and a small
`maximumSize`) compiled via the system `swiftc`. No third-party dependency needed.

## Lossless per-segment export

Do **not** re-encode to cut segments, and do not require the user to install ffmpeg.

`AVAssetExportSession` with `AVAssetExportPresetPassthrough` and a `timeRange` copies the
original bytes. On a 3h11m 4K master this cut 40 segments in ~50 seconds at full source
quality. `swiftc` is present on macOS; Homebrew often is not, and prebuilt ffmpeg binaries
may be the wrong architecture.

Note the trade-off: passthrough snaps to sync samples, so a cut can land within a GOP of
the request. That is fine for segment boundaries already placed on real scene cuts.

## Verification that actually proves something

For a segmentation that tiles a master, the decisive check is:

> **summed duration of all segments == master duration**

Report the delta explicitly. Also confirm the final clip's source range ends on the
master's end, and that every output kept the source resolution.

A tool returning success is not verification. Probe the written files.

## Transcript timestamp lookup at scale

Transcript tools return segment ids without times. To map many segments to frames cheaply:
query a recurring phrase with a high limit and pair the Nth transcript occurrence with the
Nth returned timestamp, then interpolate between those anchors. ~130 anchors across 6000
segments gave usable second-level estimates — good enough to *locate* things, never good
enough to *place* a cut.

## Measuring dead air

Take pause length from the transcript's **silence markers**, not from interpolated frame
positions. Anchor interpolation is linear between sparse anchors, so it smooths silence
away entirely — a 16.8s pause reads as ~0s of frame delta and the trim never fires.

Parse standalone silence lines as well as inline ones, and attach each pause to the line
that follows it. Then compute the trim from the measured seconds directly.

## Marker layering on the ruler

Cohort markers as **ranges**; beat markers as **points** with a `↳` prefix and the cohort
id in the text. The ruler then reads as a two-level structure. Create them in batches, and
always pass `timelineId` explicitly.

---

<!-- file: references/field-notes.md -->

# Field Notes

Failures from real runs, and what they cost. Read before the first write.

## The central lesson: match the method to the question

Three different questions need three different instruments. Every serious failure in this
project came from using one to answer another.

- *Where does the cohort change?* → scene-change detection. Not the transcript, not a
  frame grid.
- *Who is in this segment, and what is it about?* → visual frame sampling.
- *What are the beats inside it?* → transcript.

Using the transcript to find cohorts merged eleven minutes containing **five different
sets of people** into one segment. Using a visual grid to *place* those boundaries left a
mean error of 11.5s and a maximum of 29.3s. Both looked convincing at the time.

## Lexical detection is blind wherever the speaker improvises

A phrase-based detector only fires when someone says the phrase. A street interviewer who
just starts asking questions produces no signal at all.

Failure signature: a long stretch with no detected hits inside it. That is not evidence
of a single unified segment — it is evidence the detector saw nothing. Check the picture.

The same blindness applies to beat detection: cohorts where the interviewer goes off
script return zero beats. Report those as unverified, not as beat-free.

## Trimming to "the first real question" destroys buildup

An edge-trim pass that advanced each segment to its first substantive question removed
**11.5 minutes** and was rejected outright. The reason is structural: a cohort segment
later becomes *several* videos, one per question, so the run-in to every question is the
opening of a future video. Only filler and dead air are trash.

The corrected pass removed **70 seconds** across the same master — a few seconds per
segment. Magnitude is the tell: edge trim measured in minutes is cutting content.

Same root cause as the cohort failure — a lexical rule that looked reasonable and was
applied far past what the evidence supported.

## Duration heuristics quietly destroy real boundaries

A 35s merge floor and a 150s minimum-piece rule each dissolved genuine cohort changes.
Duration rules may suppress noise *within* a cohort and nothing else.

Related: never let a target segment count shape the output. Segment count is a result.

## Survey a master for multiple campaigns before assuming one shoot

One 3-hour master held **four brands** interleaved with no ordering — a marketplace, an
innerwear brand, a bread brand, and a supplements brand. Two of them recurred after long
gaps.

Find brand reveals with the interviewer's reveal phrases rather than guessing brand names.
**Match every variant** — "it's called", "**is** called", "the name of the brand is",
"a brand called", "we work with", "we have another company". Matching only "it's called"
missed a whole brand whose reveal was "this **is** called Hack Daily".

Two brands were found only after the user pointed them out: a fourth via the reveal phrase,
and a fifth that the phrase variant hid. Assume the brand list is incomplete until a
reveal-phrase sweep across **all** variants returns nothing new.

Worse, a pitch can run with **no brand name at all** — a second-hand marketplace was sold
for a full minute as "what if you could get that washing machine used, for half the price?"
without ever naming the brand. Keyword scans cannot see those. Look for the *pitch shape*
(a hypothetical offer, a price comparison, a product demo) as well as the name.

Use tight keywords per campaign — loose ones appear in several at once and produce a
useless map.

This also creates false positives for word-removal rules: one campaign used "object" as
its actual subject matter.

## One cohort can hold several brand pitches

Labelling each cohort with a single brand produced three wrong labels: a segment tagged
BREADBERRY actually held Orgaheal, Circle and HackDaily back to back with the same
participant; another tagged CLOTRIO held Orgaheal then Circle.

The brand-region smoothing that assigned one label per cohort caused this — it takes a
majority vote and discards the minority brands entirely. Detect **all** brands present in
a cohort, then split on the interviewer's pivot, then label each piece separately.

## "One last question" means the opposite of what it sounds like

This interviewer uses "one last question" to **change context**, not to wrap up. Reading
it as an ending put a boundary 61s late and let an Orgaheal segment swallow the start of a
Circle pitch.

Search every variant — "last question", "one last", "one last important question",
"one interesting question" — and cut immediately before the phrase. But check the noun:
"one last **line**" is a tagline cue and must not trigger a split.

There is a matching **closer** vocabulary — "that's about it", "thank you so much, that
was an interesting conversation" — and the wrap between closer and next opener can run
10–15s. Cutting on the closer strands that wrap at the head of the next segment; cutting
on the opener is correct. Getting this wrong put a HackDaily segment 14s early.

**But it is a candidate, not a rule.** The same phrase is also used for rapport or simply
the next beat of the same pitch. Splitting on it unconfirmed wrongly divided two Clotrio
interviews. Always read what follows and split only on a genuine product/context change.

**And the reverse trap:** a pivot can be disguised as small talk. "How long have you been
in Bangalore?" sounds like rapport, but for the marketplace brand it opens the pitch —
belonging → moving house → furniture → second-hand. Missing it left a segment 34s long.
Judge by where the conversation *ends up*, not how the question sounds.

General lesson: an interviewer's verbal habits are load-bearing signals, and their plain
meaning can be inverted. **Ask the user for their transition vocabulary up front** — they
know their own phrasing, and it cannot be inferred reliably. Phrases they name may not
appear in the current master at all ("drastic turn", "full swing" were absent here) but
still belong in the skill for the next one.

## Diarisation is unreliable

Speaker labels frequently collapse to two tags with interviewer and respondent mixed
under one. Identify the speaker from content. This matters for framing — cropping to the
wrong person puts the speaker off-screen.

## Splits cannot be moved

`split_item` is one-way. A wrong boundary means rebuilding the whole timeline. Get
boundaries detected — not estimated — *before* splitting.

## Timeline targeting goes stale mid-turn

After creating or switching a timeline, `manage_markers` and `preview_timeline` may still
target the previous one while `edit_item` uses the new one, even when the list confirms
the new timeline is active. Pass `timelineId` explicitly on every call, and read back what
each tool reports as its target.

## Verify audio, not just picture

The most common quality failure is checking every frame and never checking the mix.

- Level-match SFX against measured dialogue loudness. Library SFX at default gain punches
  straight over −10 LUFS dialogue.
- "Below speech" is not the goal — **audible but below speech** is. A bed set too
  conservatively is as wrong as one set too loud.
- Run noise reduction and normalisation as an actual step, early. If blocked, say so then,
  not at export.
- **State plainly that playback cannot be heard.** Levels set without listening are
  judgement, not verification.

## Reframing full-body shots

Check source headroom first — 4K into 1080×1920 gives 2x, so punch-ins to 200% are free.

Derive framing from measured positions in a **full-resolution single frame**, never from
eyeballing a contact sheet — cell-relative estimates were wrong by 0.08–0.15 in normalised
x across several assets, which is enough to crop the speaker out. One `inspect_asset` call
with a single `sourceTimesMs` entry per asset. Measure, compute, render, confirm.

**The centering constraint is arithmetic, not taste.** A subject at normalised x cannot be
centred at any magnification below `1 / (2·x)` — the crop clamps to the source edge and
slides them off frame. Four separate rounds of "the speaker isn't visible" all traced back
to magnification set below that floor. Full method in
[reframing-and-zoom.md](reframing-and-zoom.md).

`focalMode: "auto"` is not a safe default. At low magnification it centres between the two
people; at high magnification it locks onto whoever it judges dominant — in this footage
the interviewer — and crops the actual speaker out.

## Zoom animation: the frames fields don't zero it

`easeInFrames: 0` and `easeOutFrames: 0` leave a springy in-and-out. The fields that
actually stop the animation are **`easeInDurationInSeconds`** and
**`easeOutDurationInSeconds`**. Setting only the frames variant produced a bouncing zoom on
every short clip and was rejected twice before the cause was found.

Related preference, now standing: **instant ratio changes, no moving pushes, and never an
in-and-out on the same clip.**

## propertyOverrides replaces, it does not patch

Documented as patch semantics — "send only the keys you want to change" — but a partial
update **deletes every key you omit**. Sending `{magnification, easeIn…, easeOut…}` to 15
effects silently stripped `shape`, `focalMode`, `focalPointX` and `focalPointY` off all of
them, dropping every clip back to default centre framing and cropping people out.

The tool returned success and echoed only the keys sent, so nothing surfaced the loss. It
was found only by re-reading an effect and noticing the focal fields were gone.

**Always resend the complete property set. After a batch update, read one effect back and
confirm the focal fields survived.**

## Effects only attach to the active timeline

`edit_item` refuses to attach an effect to an item on a non-active timeline. Switch first,
then edit. And the **Preview pane lags the switch by one step** — a viewer render right
after switching returns "the Preview is showing timeline X". Switch again and retry before
concluding anything about how a cut looks.

## Two rigs can hide inside one asset set

A single folder of "the same shoot" held **two different interviewers** in two different
locations — one with a green scarf on a tree-lined street, one in a white jacket at a blue
utility box at night. Cutting across them mid-story swaps the interviewer and the location
on one cut and destroys continuity.

This was invisible in the transcript and only appeared once frames were sampled per asset.
**Sample a frame from every source before planning structure**, and group by rig before
grouping by theme. Crossing rigs is fine as a deliberate montage device (many faces, one
question); it is not fine inside a single person's story.

## Shoot the tagline with everyone

Only two of thirteen participants were ever asked to deliver the sign-off line to camera.
Every other "outro" available was a conversational reaction to the pitch, which does not
land the same way. Five reels could not be given five equivalent endings because the
material did not exist.

Where a sign-off exists in several takes, use the **final** one and cut the interviewer's
"on the count of three" setup. Where it does not exist, say so rather than grafting one
participant's tagline onto another's piece.

## Script apply is strict about substrings

Every line written back must be a **contiguous substring** of its source segment. To drop
words from the middle, keep the whole line and wrap the unwanted words in `~~…~~`; to drop
from an end, rewrite the line as the kept slice. Rewriting the words themselves is
rejected. Several applies failed on lines that had been "tidied" by a word or two.

Also: when pulling a whole source onto the timeline as a string-out, the **final segment of
each asset can overrun the asset duration by a rounding frame** and abort the apply. Drop
the last row of each source when building a full string-out.

## Caption span overrides don't follow track-level changes

A per-word colour override keeps its own colour; changing the track highlight colour will
not update it. Re-set every span. Adding a background box makes the stroke redundant.

## Read-only work needs no approval

The propose-and-wait rule covers project *changes*. Applying it to reading, sampling
frames, or scanning stalls an approved task and reads as the agent refusing to work. Do
the analysis; pause before writing.

## Never report done on an unmet rule

Flagging a gap and calling the work complete in the same breath reads as finished. If a
hard rule is unmet, say the work is **not** finished and name what remains.

## The mix was clipping before anything was added

Measuring the exported WAV showed 0.0 dBFS peaks across ~0.19% of samples. The instinct was
to blame the newly added music; two exports at music levels 5 dB apart showed **near
identical clipping counts**, which proved the source dialogue was driving the sum into the
ceiling on its own.

Never assume the last thing you added caused the problem. Measure, then compare two states.

Fix was gain staging — −3 dB on speech, −2 dB on brand assets, music rebalanced — not
limiting. Result: zero near-full-scale samples, −2 dBFS peak.

## You cannot hear the mix, so measure it

Export `format:"audio", codec:"wav"` and analyse with the Python stdlib `wave` module.
Short-window RMS, peak, and a near-full-scale sample count are all obtainable with no
ffmpeg installed. A full-frame graphic makes an ideal music-only probe region.

State every time that levels were measured and not heard.

## Music level: both directions were wrong before it was right

Bed at 9.5 dB under speech in the clear → user reported it inaudible. Raised to 1.8 dB
under → it fought the dialogue. **4.5 dB under in the clear, ~10.5 dB under while talking**
was correct. Do not start conservative; start at 4–6 dB and adjust.

Generated music also ignores requested length — a 40s request returned 2m44s.

## Caption glow is not colour-aware

`shadowStrength` renders a black shadow regardless of accent. `wordGlow` cannot be set via
`style` and lands in `ignoredFields`; it belongs to built-in presets only. Use
`strokeColor` at partial opacity for a coloured halo and describe it accurately as a
stroke, not a glow.

## The colour library may contain nothing usable

Only two LUTs existed, both camera log conversions that would destroy already-Rec.709
footage. "Stylized looks" were CRT, ASCII rain, blur and a magnifier. A real grade had to
be generated — and a generated grade is an *effect* asset, so `edit_asset sourceLut`
rejects it; apply per item instead.

Generated grades run hot. Test on one clip, render, and expect to pull intensity to ~0.9.

## Zoom past source headroom cannot be exported away

4K source into a 1080 canvas is exactly 2× of budget. Five shots magnified 2.05–2.20×
stayed soft at 4K export because the detail was never there. When the centering minimum
for a subject approaches the headroom ceiling, sharpness and centering are in direct
conflict — surface the trade-off instead of choosing silently.

## A schema change on a shared effect asset black-framed every graded clip

Rewriting a colour-grade asset's code to a new version dropped one property key
(`contrast`) that ~110 already-placed effect instances still carried in their
`propertyOverrides`. Every graded clip rendered **pure black**. `edit_asset` returned
`isValid: true` — the validator checks the code, not the overrides sitting on the timeline.

Found it by rendering a clip with **no** grade on it (a full-frame question card): that
rendered fine while the graded ones were black, which isolated the effect immediately. Fix
was to re-add the dropped key to the schema and give it a real job in the shader.

**Rule: when replacing a shared effect's code, the new property schema must be a superset
of the old one, or you must clear the stale overrides first.**

## local_export renders the Preview, not the timeline you think

A 65s reel exported as a 35.8s file containing a *different reel*. `manage_timelines
switch` had reported success, but the editor Preview was still on the previous timeline and
the export followed the Preview.

The call returns a correct-looking path and no error. Only the file size looked wrong for
the runtime.

**Rule: render a viewer frame to confirm the Preview is really on the target timeline
before exporting, and parse `mvhd` duration out of every finished file and compare it to
`durationInFrames / fps`.** Pure-stdlib `struct` does this with no ffmpeg installed.

## Ask for the safe-zone template instead of guessing margins

A supplied Reels template gave hard numbers: top 250px, bottom 1500px, left 70px, right
55px upper but **193px lower** where the like/comment/share column sits. A title lockup had
been placed at y=104 — entirely inside the Reels header. The asymmetric lower-right margin
is the one that gets missed; a centred full-width caption box can overlap the icon column
while the top of frame looks fine.

## Five parallel 4K exports killed all five

Submitted `local_export` for all five reels back to back to save time. Every job returned a
taskId and a path; the app showed them complete; the user told me they were complete. On
disk there were five Chromium temp files frozen between 3 and 44 MB against an expected
77-150 MB, and zero final files. The same five timelines had exported fine one at a time
minutes earlier.

**Lesson:** exports are serial work. One at a time, poll for the file, verify `mvhd`, then
the next. And never trust a status — trust the bytes.

## The MCP turn expires mid-batch

Twice during a five-reel export run the next `manage_timelines switch` came back with
"This pinned MCP turn is no longer active." Everything already committed stayed committed;
everything queued was lost.

**Lesson:** make each reel's edit-verify-export-cleanup a self-contained unit, so a dropped
turn always leaves a coherent state rather than half a set. Report exactly which reels
landed and which did not — do not imply the batch finished.

## A hyphen splits a caption token

`for pre-owned goods` rendered as `for pre- owned goods` — the caption tokenizer splits on
the hyphen and rejoins with a space. Any hyphen in caption display text does this.

**Lesson:** write caption text without hyphens. The user had typed "pre owned" anyway.

## Stray frames hide at clip boundaries

The user reported "1 or 2 frames at the end which are not from this video" in two places.
Both were the same thing: the clip's source range ran a few frames past its subject, so the
tail showed a different pair of people in a different location. Neither was visible while
scrubbing.

**Lesson:** when the user says a frame "isn't from this video", do not look for a stray
item on the timeline — look at the tail of the clip that is already there. Render the
boundary frames, trim the bad ones, and pull the next item's head back by the same amount
with a matching `videoStartFromInSeconds` shift so nothing downstream moves.

## ASR mangles the interviewer's own CTA lines hardest

Across three reels the errors clustered in exactly the lines the brand cares about most:
`cercle` for Circle, `see to see market place for free on goods` for a C2C marketplace for
pre-owned goods, `to buy yourself` for "to buy or sell", `to look faith` for "to look for
it", `store in` for circlestore.in, `blog` for "block".

**Lesson:** proof the CTA and brand lines by ear before delivery, every time. They are the
lines a client will notice and the lines ASR gets wrong most.

## The zoom effect animates. All of it. Always.

Four rounds were lost to this. The user reported "choppy", then "zooms and zooms out", then
"why is there a zoom animation in that clip". Each time I adjusted magnifications, focal
points, shapes and ease values, and each time it came back.

`builtin:zoom` animates under every shape with every ease zeroed. `instant` pulls wide across
the clip; `hold` goes wide-tight-wide. Nothing in the schema turns it off.

**Lesson:** when a user says framing is moving and you did not ask it to move, do not tune
the effect. Prove it on a single-take raw clip by rendering four frames inside one item, then
switch to a static item crop and say plainly that the effect cannot do what they want. I also
briefly talked myself out of the correct conclusion because a pre-edited source was
confounding the test — pick a clean source before running the experiment.

## Diagnose with ffmpeg before touching anything

The user had to say "so many glitches still present" before I stopped eyeballing frames and
ran scene detection. It took one command and produced the complete, exact cut list; three of
my by-eye "fixes" had been off by a frame or two and one had made a clip worse.

**Lesson:** a glitch report is a measurement problem. Measure first.

## Do not hand back a mixture and call it the user's work

After rebuilding, I told the user I would restore the 19 zoom values they had hand-set. What
I actually restored was a track effect list that mixed their edits with leftovers from my own
mis-bound effect batches — and I could not tell them apart. They spotted it immediately:
"they are not from my edits previously."

**Lesson:** if you are about to destroy user work, either capture it in a form you can
verify, or tell them upfront it will not survive. Never claim preservation you cannot
actually deliver, and when you get it wrong, say which part was yours rather than defending
the mixture.

## Swapping a pre-edited source for raw is a re-cut, not a swap

Word-level timing showed v1's offset against the raw file drifting from 17.76s to 18.20s
across one line, because the earlier edit had internal trims. A same-duration asset swap
would have drifted lip sync.

**Lesson:** the only correct path is rebuilding the affected rows through Script from the raw
sources, accepting that durations shift and every finishing element needs re-syncing
afterwards. Say that before starting, not halfway through.

---

<!-- file: references/finishing-mode.md -->

# Mode B — Short-Form Finishing

Cut a finished vertical short-form video. Optimise for retention, comprehension and
emotional engagement — never for effect count. Read
[shared-invariants.md](shared-invariants.md) first; those rules still bind here.

## Defaults

- Platform **Instagram Reels**, **9:16 vertical**, platform-native resolution and fps.
- Duration target **45–60s**, hard ceiling **90s**. Go shorter (35–45s) if the footage
  supports a stronger edit there. Never pad to reach a target.
- Captions **on**, from actual dialogue, inside the safe zone.
- Approval required at every phase boundary (see the standing rule in SKILL.md).

## Inputs to gather

Objective and key message; product/brand and required integration, claims or disclosure;
claims that must stay accurate; claims that must not be made; competitors; sections that
must not be edited; footage that must not be used; CTA; audience and desired emotional
response.

Read the transcript and pull frames yourself. Never ask the user what the video is about.

## Workflow

### 1. Rank the footage first

Score every usable segment on performance, expression, emotional intensity, speech
clarity, relevance, framing, uniqueness and hook potential. Prefer the strongest
**performance** over the cleanest technical take. With multiple takes, pick the best —
not the first usable one.

### 2. Choose the hook mechanism from the footage

Pick what the footage supports: curiosity, contrarian claim, unexpected result, strong
opinion, question, problem, transformation, before/after, mistake, challenge,
comparison, secret, demonstration, emotional reaction, shock, story, confession,
authority. Do not apply one formula to every video.

The hook must combine **visual + auditory + emotional + textual** stimulus. Never
dialogue alone; never text alone. Never clickbait that contradicts the content. Open on
the strongest available relevant visual — if a later moment is substantially stronger,
cold-open on it and return to chronological order.

Kill generic openings: "Hey guys", "Today we're going to", "So basically", greetings, and
any setup that delays the interesting moment.

**On-screen hook text is mandatory.** The premise must be readable with sound off. It
must state the specific situation, claim, question, conflict, result or curiosity gap —
not transcribe the dialogue. Keep it short enough to read instantly and out of platform
UI. A cut without it is not finished.

### 3. Rough cut

Structure first, timing second, polish third.

**Interview question discipline** — for any interview-led cut:

- **Every question must come from the same clip as the answer that follows it.** Cutting
  one person's question in front of another person's answer puts the wrong face on screen
  being asked, and the viewer loses who is answering what.
- **Question count depends on the format.** For a single-subject piece, no more than two
  interviewer questions — beyond that it reads as a transcript rather than an edit. **For a
  vox-pop montage the ceiling is higher.** A delivered 48s street-interview reel carried four
  question beats, because in a montage one question is amortised across several people
  answering it in turn. Take the count from the client's own delivered cut, never from a
  fixed number.
- **Keep camera directions aimed at the participant.** "Show both slices to the camera"
  looks like a production instruction but functions as a *viewer* instruction — it tells the
  audience where to look one beat before the thing appears. A delivered reel opened on
  exactly this line.
- **Anchor on one long answer, then stack short ones.** The commonest bad first cut is a
  string of two-second fragments from many people; it reads as random because nobody
  finishes a thought, however good each line is. Delivered cuts instead let one participant
  run a long, specific, personal answer early — on one 48s reel, 5.8s to 19.5s, nearly 30% of
  the runtime — and stack shorter corroborations from other faces after it. Find the most
  concrete and most numeric answer in the footage and let it play whole.
- **Each question must lead to a payoff.** A question whose answer trails off is worse
  than no question.
- **Mid-video answers need their setup too.** Context is usually missing in the middle
  weight of a piece, not at the top — an answer dropped in without its question reads as
  a non-sequitur.
- **CTA comes after the payoff**, never before it and never instead of it.

**Outro takes** — where a sign-off was shot several times, use the **final** take. Cut the
interviewer's setup ("say it on the count of three, 3, 2, 1") entirely and land on the
line itself. If a sign-off was only recorded with some participants, say so — do not
graft one person's tagline onto another person's piece. Remove dead air and repeated
statements that hurt pacing — but keep natural speech where removing it makes the speaker
sound unnatural.

**In vox pop, keep the fillers and the verbal repeats.** Delivered street-interview cuts
retain "uh", "ah", "yeah, yeah" and doubled emphasis such as "Always matters. Always."
Stripping them makes the piece sound scripted, which is the one thing vox pop must never
sound. **Never run blanket filler removal or blanket pause compression on this material** —
that is a talking-head habit and it is wrong here. Cut on conversational rhythm. Prefer cuts that hold
visual continuity. Never cut purely for speed. Every cut must improve pacing, clarity,
emotion, visual stimulation or narrative progression.

Then stop and get approval before any polish.

### 4. Captions

From actual dialogue, broken on natural speech rather than word counts. Inside the safe
zone, off faces, off product information, never competing with hook text. Highlight
important words selectively; do not animate every word. Correct ASR errors in the caption
display text — the audio is what was said, the caption is what is read.

### 5. Dynamic camera

**Instant ratio changes, not moves.** The cut lands on a new framing; nothing drifts,
pushes or springs. This supersedes earlier pan-zoom / Ken Burns guidance — a moving push
on a 1–2s vox-pop clip reads as cheap, and a push that returns is worse.

Full method, including how to measure subject positions, the magnification needed to
actually centre someone, rotation and the property-overrides trap:
[reframing-and-zoom.md](reframing-and-zoom.md). The essentials:

- Measure the subject from a **full-resolution single frame** before choosing any ratio.
  Contact-sheet estimates are not accurate enough and put speakers out of frame.
- A subject at normalised x needs magnification **≥ 1 / (2·x)** to be centred at all.
  Below that the crop clamps to the frame edge and crops them out.
- `shape: "instant"` with `easeInDurationInSeconds: 0` and `easeOutDurationInSeconds: 0`.
  The frames-based ease fields do not stop the animation.
- Aim at whoever is speaking. `focalMode: "auto"` picks the wrong person at high
  magnification — use manual with measured focal points.
- Step the ratio 0.1–0.2 between neighbouring clips so same-angle jump cuts read as
  reframes. Never repeat a ratio back to back. Some clients want a run of jump cuts from one
  moment to read as one sentence and ask for **zoom-ins only** — then each cut in the run goes
  slightly tighter (~6%, capped ~1.25x) and never back out; see the Vox-Pop Brand Series
  runbook, finishing.md → "Zoom in only".
- In group vox pop, everyone stays in frame — bodies may be cut, people may not. Check the
  tightest punch-in and the widest group shot.
- Leave the first and last clip un-zoomed for perspective, unless the frame reads crooked
  — then rotate and zoom in to crop the corners.
- Never magnify enough to soften the image or distort facial proportions.

### 6. Sound

SFX must correspond to a real visual, comedic, emotional or narrative event. Sparse,
contemporary, never repeated in one video unless it is a deliberate motif, never over
dialogue, always level-matched against measured dialogue loudness.

Music sits below speech but must remain audible. Match the emotional tone. Skip music
entirely when it would cost authenticity.

Audio quality is not optional: dialogue intelligible, obvious background noise reduced,
dialogue levels normalised, no clipping, natural voice character preserved, no
over-processing or denoise artefacts. Attempt this **early** — if it is blocked, say so
before the polish phase, not at export.

### 7. Visual quality

Correct obvious exposure and white balance. Keep skin tones consistent. Avoid excessive
sharpening or saturation and artificial skin processing. Preserve quality through digital
zoom. Keep visual treatment consistent across shots — sessions shot at different times
will not match without a pass.

### 8. Graphics, transitions, ending

Default transition is a clean cut; anything else must solve a narrative or continuity
problem. All graphics safe-zone compliant and brand-consistent. End immediately after
the payoff. CTA only if required, concise, inside the safe zone. Prefer an open loop over
a forced "like and subscribe".

### 9. QA, then export

Run [qa-checklist.md](qa-checklist.md) in full — including the audio gate. Enable the
safe-zone overlay, verify every text element, caption, logo, graphic and important face,
then disable it before export.

Export per platform: resolution, aspect ratio, frame rate, codec, bitrate, audio format
and sample rate, max duration, file naming, safe-zone preset.

## Safe-zone system

Platform UI areas are protected regions. No important text, caption, logo or CTA may
overlap them. Never put critical information in the lower-right interaction area or under
platform-generated captions. Keep padding off the boundary rather than sitting against
it. Important faces should not be needlessly obscured.

Maintain a safe-zone overlay per platform (Reels, Shorts, TikTok, others) and validate
against it before every export.

## Pacing and retention

Avoid long stretches without meaningful visual or auditory change, but never introduce
artificial change to hit a frequency target. Front-load the premise, delay unnecessary
exposition, preserve curiosity, build to a payoff, and end right after it.

Evaluate: strength of first frame, strength of first spoken line, context clarity,
curiosity gap, emotional tension, information density, visual variation, narrative
progression, payoff, rewatch potential, shareability, comment potential. More effects do
not increase virality.

## B-roll

Must be contextually relevant. Never visually attractive but semantically unrelated.
Never another brand's product as substitute footage without authorisation. Never fabricate
product characteristics through misleading B-roll. B-roll clarifies, illustrates or
intensifies what is said.

**Meme / GIF B-roll** (only when requested): real, recognisable memes rather than stock
reaction clips; watermark-free, checked at native size at the start, middle and end of the
clip; placed only on dead moments, never over a participant's genuine reaction; a few per reel,
not one every few seconds. Shown as a card over the live footage rather than a full-frame
cutaway, so the scene stays visible. Full rules in the Vox-Pop Brand Series runbook,
finishing.md → "Reaction memes".

## Required asset libraries

**Must have:** platform safe-zone overlays; caption presets; brand fonts, colours, logos;
zoom presets; SFX library; music library; transition presets; motion graphics; hook
references; reference videos; negative reference videos; B-roll; product footage and
images; platform export presets.

**Recommended:** hook database; SFX and music metadata including licensing; caption style
variations; lower-third, CTA and end-card presets; brand motion guidelines; colour/LUT
presets; audio-processing and noise-reduction presets; speaker-ID presets; product
callout presets; negative editing examples; competitor/forbidden asset list.

Zoom presets should each define starting scale, ending scale, duration, easing, maximum
movement and use case: slow push-in, slow pull-out, face push-in, face pull-out,
left-to-right and right-to-left pan + zoom, centre push-in, reaction emphasis,
product/detail emphasis, subtle idle movement, comedic emphasis, dramatic emphasis.

Suggested folder structure: `01_BRAND`, `02_SAFE_ZONES`, `03_CAPTIONS`, `04_ZOOMS`,
`05_SFX`, `06_MUSIC`, `07_TRANSITIONS`, `08_MOTION_GRAPHICS`, `09_BROLL`,
`10_REFERENCES`, `11_NEGATIVE_REFERENCES`, `12_HOOK_LIBRARY`, `13_PLATFORM_PRESETS`.

**If a required preset or brand asset does not exist, say so — do not improvise a
substitute and present it as brand-compliant.**

## Reference and negative-reference libraries

Learn principles from references; never copy them blindly. Document per reference: why it
works, hook style, cut frequency, caption style, zoom behaviour, SFX behaviour, music
behaviour, B-roll behaviour, CTA behaviour, overall pacing.

Negative references define the decision boundary: excessive zooms or captions, bad
captions, SFX overuse, generic hooks, slow openings, poor framing, text outside the safe
zone, excessive transitions, misleading editing, aggressive jump cuts, unnatural facial
zooms, distracting music, poor B-roll, over-editing.

---

<!-- file: references/polish-and-mix.md -->

# Polish, Mix and Delivery

Everything after the rough cut: captions, motion graphics, sound effects, music, mix
verification, colour, and export. Mode B only.

## 1. Captions

Word-level highlight is the default for short-form. Set track-wide style, then refresh.

Fields that work as documented: `font`, `fontSizeRatio` / `sizePx`, `fontWeight`, `color`,
`opacity`, `highlightColor`, `strokeColor`, `strokeWidth`, `strokeOpacity`,
`backgroundColor`, `shadowStrength`.

**Two traps:**

- **`shadowStrength` is a black drop shadow, not a coloured glow.** It renders as
  `rgba(0,0,0,α)` no matter what accent you want. There is no colour parameter.
- **`wordGlow` is preset-owned and cannot be set** through `style` — it silently lands in
  `ignoredFields`. Only built-in presets that ship with it (e.g. Bubble Pop) have a real
  glow.

**To get a coloured glow**, use `strokeColor` at partial opacity — a 2px accent stroke at
~60% reads as a soft halo around white text. Keep a low `shadowStrength` underneath for
legibility against footage. Say plainly that it is a stroke halo, not a blur glow.

Working values for a 1080×1920 reel: `fontSizeRatio` 0.06–0.065, `fontWeight` 700, white
base, brand accent on `highlightColor`, accent `strokeColor` at 0.6 opacity, width ~2.

`highlightColor` auto-enables `highlightUnit: "word"`. Always `refresh` after styling.

## 2. Motion graphics for a series

Two recurring components cover most reels:

- **Title card** — persistent series lockup. Natural box only as large as the lockup
  (e.g. 860×110), placed top of frame, on a video track above the footage. Entrance must
  complete in the first ~1s and then hold static; it is on screen for the whole reel.
- **Question / CTA card** — a full-frame beat before the end card. Timeline-sized asset
  because the design intentionally fills the frame.

Take the visual language from the brand's own end card if one exists — its geometry,
mark and palette are already approved. Do not invent a second design language.

Leave the brand end card and any full-frame brand graphic **out of the colour grade** so
brand colours stay exact.

## 3. Sound effects

Level-match against measured dialogue loudness; the asset list reports LUFS per item.

- An SFX item cannot be longer than its asset. A 312ms asset at 30fps is **9 frames max** —
  asking for 10 fails validation.
- Trim long stingers to the attack rather than letting them ring under the next line.
- Repetition is only allowed as a deliberate motif — e.g. the same soft pop on each answer
  in a list. Everything else appears once.
- Nothing over the emotional payoff. Leave the strongest line clean.

Check the library register before planning: a meme-oriented SFX pack (bonk, gunshot,
cricket, buzzer) will undercut an emotional piece. Say so rather than forcing four cues in.

## 4. Music

Generated beds come back **much longer than requested** — a 40s request returned 2m44s.
Trim to the reel and fade.

Set ducking with track roles, not item gain: `role: "anchor"` on the track carrying speech
(for talking-head this is the **video** track with embedded audio, not an audio track), and
`role: "follower"` on the music track. `audioRouting` reads back `null` after setting the
role, so **set `duckDepthDb` explicitly** rather than trusting derivation.

**Level targets that actually landed**, measured as RMS on the exported mix:

| | Value |
| --- | --- |
| Speech | −20 to −24 dBFS |
| Music in the clear | 4–6 dB below speech |
| Music while talking | 10–12 dB below speech |
| Duck depth | −6 dB |

Calibration from a real run: music at **9.5 dB below speech in the clear was reported as
inaudible** by the user; at **1.8 dB below it fought the dialogue**; **4.5 dB below** was
correct. Start there.

## 5. Verify the mix numerically — you cannot hear it

This is the only real check available, and it catches things eyes never will.

Export `format:"audio", codec:"wav"` and analyse with the Python stdlib `wave` module —
no ffmpeg needed:

- Short-window RMS across known speech regions vs a known music-only region (a full-frame
  card works perfectly as a music-only probe).
- Peak dBFS and a count of near-full-scale samples (`abs(sample) >= 32700`).

**A real finding from this workflow:** the mix was clipping at 0.0 dBFS across ~0.19% of
samples — and it was clipping *before* any music was added. Source dialogue at −9 to
−10 LUFS was driving the sum into the ceiling. Comparing two exports at different music
levels proved the music was not the cause.

Fix with gain, not limiting: −3 dB on speech items, −2 dB on brand assets, and rebalance
music. Re-export and confirm **zero** near-full-scale samples and about −2 dBFS peak.

Always state that levels were measured, not heard.

## 6. Zoom is capped by source headroom

```text
zoom budget = source width / canvas width
```

4K source (2160 wide) into a 1080-wide canvas gives exactly **2× before upsampling
begins**. Magnification beyond that invents pixels and reads as softness; no export
resolution recovers it.

When a subject's centering minimum (`1 / (2·x)`, see
[reframing-and-zoom.md](reframing-and-zoom.md)) is close to the headroom ceiling, that
subject cannot be both centred and sharp. Name the trade-off; do not silently pick one.

## 6b. Safe zones are measured, not assumed

Get the platform safe-zone template from the client and read the pixel margins off it
rather than eyeballing. A real Reels template measured, at 1080x1920:

| Boundary | Value |
| --- | --- |
| Top (below the Reels header) | **250px** |
| Bottom (above the caption/audio strip) | 1500px (420px margin) |
| Left | 70px |
| Right, upper area | 55px |
| Right, lower area (like/comment/share column) | **193px** |

A title lockup placed at y=104 sat entirely inside the header strip and had to move to
~248-296. Check the **lower**-right margin separately: a full-width caption box can run
past 887px and collide with the interaction icons even when the top of frame is clean.

## 7. Colour grade

Check the catalog first — but expect to generate. A library may hold only **camera log
conversions** (S-Log3→S709 and similar), which will wreck footage that is already Rec.709.
"Stylized looks" are usually gimmicks (CRT, ASCII), not grades.

Generating a grade via `submit_shader` is **beta — warn and get explicit confirmation
before spending it.**

A generated grade is an *effect* asset, not a LUT asset, so `edit_asset sourceLut` will
reject it. Apply per item with `edit_item` effect adds.

Prompt for the specific footage: state the source colour space, the lighting conditions,
what to protect (skin tone, highlights, foliage), and ask for an `intensity` property so
the whole thing can be dialled back.

Test on **one** clip and render before committing to the batch. A grade at full generated
strength commonly runs hot — 0.9 intensity was right where 1.0 was pushing whites to cream.

### Updating a grade already applied to many clips

Do **not** delete and re-add a hundred effect instances. Generate the replacement shader,
read its code with `inspect_asset includeCode:true`, and write that code into the
**existing** asset with `edit_asset`. Every placed instance picks it up in one call.

**The trap that costs you a black frame:** effect instances keep their original
`propertyOverrides`. If the new code's property schema drops a key the old overrides still
carry, the shader fails at runtime and every graded clip renders **pure black** — while
`edit_asset` still reports `isValid: true`, because the validator only checks the code, not
the overrides already sitting on the timeline.

Keep every old property key in the new schema, even if you have to give it a job, or clear
the stale overrides first. Diagnose a black frame by rendering a clip that has **no** grade
on it (a full-frame card works): if that renders and the graded ones don't, it is the
effect, not the timeline.

### Denoise and the "DSLR" look

Grain in night footage is sensor noise amplified by contrast and saturation, and made worse
by any zoom past source headroom. A generated grade can genuinely fix a lot of it: ask for
a **bilateral / edge-preserving blur weighted toward the shadows**, chroma desaturation in
the darks, restrained S-curve, a soft highlight shoulder, and explicitly **no added film
grain or texture overlay**. Say "smooth the noise, never the face" — the useful shader
tapers denoise off above ~0.6 luma so skin texture survives.

## 8. Export

Local export supports 480p / 720p / 1080p / **4K**. Export at 4K when the source is 4K:
it roughly doubles the delivered data.

Be honest about what 4K does and does not fix. It preserves detail in wide and moderate
shots; it cannot restore detail in shots already magnified past the headroom ceiling.
**4K is the ceiling** — there is no higher setting to reach for when asked for "maximum
quality".

### Export one at a time. Never batch.

Submitting five 4K exports back to back **silently destroyed all five**. Each job wrote a
Chromium temp file into the output directory, all of them stopped growing between 3 and
44 MB against an expected 77-150 MB, and not one final `.mp4` was ever written. `local_export`
returned a taskId and a path for every call; the app's Export History showed them as
complete. The user said "the renders are complete already" while the folder held nothing
but abandoned temp files.

The loop that works:

1. Switch to the timeline.
2. Render one viewer frame and confirm the returned `timelineId` matches.
3. `local_export`.
4. Wait for the **file** — poll until it exists and its mtime has been stable ~10s.
5. Parse `mvhd` and compare to `durationInFrames / fps`.
6. Only then move to the next reel.

Do not switch the active timeline while a render is in flight — the exporter renders the
Preview, so switching mid-render corrupts the job you already started.

**Never delete an old version until its replacement is verified on disk.** A dropped
connection between "delete v4" and "export v5" leaves the user with nothing.

### The app's success status is not evidence

Export History reporting "complete" and `local_export` returning a path both mean the job
was *accepted*, not that pixels reached disk. The only proof is the file: it exists, its
size is plausible for the runtime, `moov` parses, and the duration matches. `find` for
leftover `.org.chromium.Chromium.*` files in the output folder — they are the signature of
a render that died partway.

### Verify every export against its timeline length

Export duration is the cheapest correctness check available and it catches a specific,
silent failure: **`local_export` renders whatever the editor Preview is showing, which can
lag a `manage_timelines switch` by a step.** A 65s reel exported as a 35s file because the
Preview was still on a different timeline; the call reported success and the path was
correct.

Parse `mvhd` from the mp4 with the Python stdlib (`struct`, no ffmpeg) and compare against
`durationInFrames / fps` for every file before reporting done. A size that looks wrong for
the runtime is the tell. Render a viewer frame first to confirm the Preview is actually on
the intended timeline, then export.

### Naming

Put the version at the **front** of the filename (`v4_R1_Name.mp4`), never the word
"final". Bump the number for every delivered round and delete the previous set once each
replacement is verified — a folder holding two versions of the same reel is the exact
confusion the prefix exists to prevent.

When a file's content is already current and only its version label is stale, **rename it
instead of re-rendering**. A 4K render costs minutes; `mv` costs nothing. Say plainly that
you renamed rather than re-rendered so the user knows it was not regenerated.

---

<!-- file: references/qa-checklist.md -->

# QA Checklist

Run before telling the user anything is done. Fix what is fixable; surface what is not.
A successful tool call is not verification.

## Mode A — segmentation validation

**Tier 1 — cohort cuts**
- Is every boundary snapped to a **detected scene cut**, or explicitly flagged as an estimate?
- Any boundary below the confidence threshold flagged in both the marker and the filename?
- Do the segments **tile the master exactly** — summed duration == master total frames?
- Does the final clip end on the master's exact end?
- Was any group interview split because a second person was named? (It shouldn't be.)
- Did any duration or merge rule dissolve a cohort boundary? (It mustn't.)

**Brand-pitch cuts**
- Was every cohort scanned for **more than one brand**? One cohort often holds two or three.
- Did a reveal-phrase sweep cover all variants ("it's called", "is called", "brand called",
  "we work with")? A single-phrase sweep hides brands.
- Any pitch that never names its brand (hypothetical offer, price comparison, demo)?
- Does each split piece carry **its own** brand label, not the cohort's majority brand?
- Was every **"one last question"** style pivot found, and **confirmed** by an actual
  product/context change before splitting? Unconfirmed phrases must not split.
- Any pivot **disguised as rapport** ("how long have you been in...") that opens a pitch?
- Were "one last **line**" tagline cues correctly **excluded** from splitting?
- Does each segment **keep its own closer** ("that's about it", the thank-you wrap) rather
  than leaving it at the head of the next segment?
- Was the cut placed just before the **opener**, not on the closer?

**Edge trims**
- Is the total trim measured in **seconds**, not minutes? Minutes means content was cut.
- Was anything removed that carries content words? Only filler tokens and dead air qualify.
- Was any question buildup removed? It must not be — each question becomes its own video.
- Was anything trimmed from *between* the edges? Only the two outer edges may be touched.
- Does each clip's source time still equal its timeline time (no drift)?

**Tier 2 — contextual beats**
- Are beats marked as points nested under their cohort?
- Are cohorts with **zero detected beats** reported as unverified rather than beat-free?

**Both**
- Was the whole timeline reviewed, visually as well as textually?
- Is any context-dependent reaction separated from its setup?
- Did meaningful silent visual moments survive?
- Were brand changes wrongly treated as boundaries?
- Is every competitor appearance marked rather than removed?
- Is every occurrence of "object" marked rather than removed?
- Were uncertain calls resolved conservatively?


## Mode B — interview structure

- Does **every** question come from the same clip as the answer that follows it?
- Are there **two or fewer** interviewer questions in the whole video?
- Does each question lead to a payoff rather than trailing off?
- Do the mid-video answers carry their setup question, not just the opening ones?
- Does the CTA land **after** the payoff?
- Where a sign-off had multiple takes, is the **final** take used, with the interviewer's
  count-in cut?

## Mode B — hook

- Is the first moment compelling?
- Is the premise immediately understandable?
- Visual + auditory + emotional stimulation present?
- **Is there on-screen hook text?** Without it the cut is not finished.

## Mode B — retention

- Unnecessary dead time? Weak sections?
- Does pacing support the story? Does every section contribute?

## Mode B — captions

- Accurate, including ASR errors corrected in display text?
- Synchronised? Readable without pausing?
- Inside the safe zone? Obscuring faces or product?

## Mode B — visuals

- Important visuals visible? Exposure, white balance and treatment consistent across shots?

**Framing — check every clip, not a sample**

- Was each subject position measured from a **full-resolution single frame**, not a
  contact sheet?
- Is every speaker **in frame with a readable face**, nobody sliced at an edge?
- Does each clip's magnification clear the centering floor `1 / (2·x)` for whoever is
  speaking in it?
- Is the focal point aimed at the person **speaking** in that clip, and is `focalMode`
  set to `manual`?

**Zoom behaviour**

- Is every zoom `shape: "instant"` — no drifting pushes, no in-and-out on one clip?
- Are **`easeInDurationInSeconds` and `easeOutDurationInSeconds`** both 0? (The frames
  fields do not stop the animation.)
- Does the ratio step 0.1–0.2 between neighbouring clips, with no ratio repeated back to
  back inside an interview?
- After any batch effect update, was one effect **read back** to confirm
  `shape`/`focalMode`/focal points survived? (`propertyOverrides` replaces, not patches.)

**Opening, closing and rotation**

- Are the first and last clips un-zoomed for perspective — or deliberately rotated?
- If rotated: does the scale clear the black-corner minimum, and was a frame rendered to
  confirm no black edge?

## Mode B — audio gate

Do not skip this half. It is the one most often ignored.

**Measured, not guessed** — export a WAV and analyse it:

- Zero near-full-scale samples (`abs >= 32700`)? Peak around −2 dBFS?
- Was clipping checked **before** blaming the most recently added element?
- Music 4–6 dB under speech in the clear, 10–12 dB under while talking?
- Duck set via track roles with an **explicit** `duckDepthDb` (it reads back null)?
- Is every SFX within its asset length, and is any repetition a deliberate motif?
- Was it stated plainly that levels were measured and not heard?

- Is dialogue intelligible, normalised and free of clipping?
- Was background noise actually reduced, or merely never attempted?
- Is music **audible** and still below speech?
- Are SFX level-matched against measured dialogue loudness?
- Are SFX intentional, motivated and unrepeated?
- If the mix could not be heard, was that stated rather than implied as verified?

## Mode B — branding

- Brand assets, colours, fonts and logo placement correct?
- Are they from a real supplied brand kit, or improvised? Say which.
- Any prohibited brand present?

## Mode B — safe zone

Enable the overlay, check, disable before export.

- All critical text, captions and graphics inside the safe zone?
- Important visual information clear of platform UI?

## Shared — advertorial integrity

- Is every required product integration still present?
- Were silent product or reaction moments cut? Restore them.
- Is every competitor appearance marked and surfaced for the user's decision?
- Is every "object" occurrence handled per mode?

## Mode B — duration

- At or below 90s? Roughly 45–60s where appropriate?
- Could any section go without reducing value?

## Mode B — colour and delivery

- Was the LUT/effect catalog checked before generating? Were log-conversion LUTs correctly
  rejected for Rec.709 footage?
- Was a generated grade confirmed as beta spend before submitting?
- Was the grade tested on one clip and rendered before the batch?
- Is intensity pulled back from the generated default where it ran hot?
- Are brand assets (end card, brand graphics) **excluded** from the grade?
- If a shared grade's code was replaced, is the new property schema a **superset** of the
  old keys? Was a graded frame rendered to prove it isn't black?
- Were safe-zone margins read off the client's template rather than estimated, including
  the asymmetric lower-right margin?
- Exported at 4K when the source is 4K?
- Were shots magnified past the source headroom ceiling named as unfixable by resolution?

## Mode B — clip boundaries

- [ ] Scan the **last 2-3 frames of every clip** at a cut. A source range that runs a few
      frames past the subject flashes foreign content — a different person, a different
      location, a framing that drops out. It is invisible while scrubbing and obvious on
      playback, and the user will describe it as "1 or 2 frames that aren't from this video".
- [ ] Fix by trimming those frames off, then absorb the gap by pulling the **next** item's
      head earlier and rolling its `videoStartFromInSeconds` back by the same amount.
      That keeps everything downstream in place — no ripple, no drift against music or SFX.
- [ ] Where the next element is a card or graphic, just start it earlier and lengthen it;
      its entrance animation completes early and holds.

## Mode B — export integrity

- Was a viewer frame rendered to confirm the Preview is on the **intended** timeline before
  exporting? (`local_export` follows the Preview, which lags `switch`.)
- Was every finished file's `mvhd` duration compared against `durationInFrames / fps`?
- Does any file's size look wrong for its runtime?
- Is the version at the **front** of the filename, and were prior versions left in place?

## Mode B — delivery hygiene

- [ ] Exactly one file per reel in the output folder, all at the same version prefix.
- [ ] Every file: `moov` parses, encoded dimensions are the intended resolution, both a
      `vide` and a `soun` track are present, duration matches `durationInFrames / fps`.
- [ ] No `.org.chromium.Chromium.*` leftovers in the folder.
- [ ] Prior version deleted only after its replacement passed all of the above.

## Final decision

- Would the first frame stop the target viewer scrolling?
- Can the viewer understand the premise without sound?
- Does it feel native to short-form social?
- Does every editing choice have a purpose?
- Is this the strongest possible version of the supplied footage?
- **Is any hard rule still unmet? If so, do not call it done.**

---

<!-- file: references/reframing-and-zoom.md -->

# Reframing, Zoom and Rotation

Locked-off vox-pop footage has no cutaways. The **only** visual change a viewer gets is
the cut between interviews and the framing you impose. That makes reframing the primary
visual tool in Mode B, not a garnish.

This file supersedes any older "pan + zoom / Ken Burns" guidance. See
[field-notes.md](field-notes.md) for the failures that produced these rules.

## 1. Scan the frames before touching a zoom

Never derive framing from a contact sheet. `sourceFrameCount` grids and multi-cell
renders are for *identifying* content; their cell-relative geometry is unreliable and
estimates taken off them have been wrong by 0.08–0.15 in normalised x — enough to push a
speaker out of frame entirely.

**Always measure from a full-resolution single frame**: `inspect_asset` with exactly one
entry in `sourceTimesMs`. Read the subject's head position as a fraction of frame width
and height.

Do this once per source asset, at a moment where the subject is settled. The camera is
locked off, so one measurement serves the whole interview.

Record for each asset: subject x/y, interviewer x/y.

## 2. The centering constraint

A zoom crop cannot extend past the source edge. So a subject standing left of centre can
only be centred if the crop is narrow enough:

```text
minimum magnification to centre a subject at normalised x  =  1 / (2 · x)
```

Below that value the crop clamps to the frame edge and the subject slides toward — and
then out of — the side of frame. This is the single most common cause of "the speaker
isn't visible".

Worked examples from a real shoot (subject standing left, interviewer right):

| Subject at x | Minimum magnification | Comfortable range |
| --- | --- | --- |
| 0.255 | 1.96x | 2.0 – 2.2x |
| 0.26 | 1.92x | 1.95 – 2.35x |
| 0.283 | 1.77x | 1.85 – 2.05x |
| 0.317 | 1.58x | 1.7 – 2.05x |
| 0.327 | 1.53x | 1.65 – 2.1x |
| 0.346 | 1.45x | 1.55 – 2.05x |
| 0.39 | 1.28x | 1.55 – 1.95x |
| 0.48 | 1.05x | 1.5 – 1.8x |

Same formula vertically with y; horizontal is almost always the binding constraint.

For a right-standing interviewer, mirror it: `1 / (2 · (1 − x))`.

If the required magnification is higher than the footage can carry without softening,
say so — do not ship a cropped-out speaker.

## 3. Focal mode

- **`focalMode: "manual"` with a measured `focalPointX` / `focalPointY`.** This is the
  default for every clip.
- **`focalMode: "auto"` is not a shortcut.** It centres between the two people at low
  magnification, and at high magnification it locks onto whichever person it judges
  dominant — routinely the interviewer — cropping the actual speaker out.

Aim at whoever is *speaking* in that clip. When the interviewer asks, aim at the
interviewer.

## 4. Instant zooms, not moves

**Change the ratio, do not animate it.** The cut lands on a new framing; nothing drifts.

```text
shape: "instant"
easeInDurationInSeconds: 0
easeOutDurationInSeconds: 0
```

- **`easeInFrames: 0` / `easeOutFrames: 0` do NOT stop the animation.** The seconds-based
  fields are the ones that actually zero it. Setting only the frames variant leaves a
  springy in-and-out that reads as cheap, especially on sub-2s clips.
- **No zoom in-and-out on the same clip.** A push that returns is the most-rejected move
  in this workflow.
- Reserve any moving zoom for a genuinely long segment, and only when asked for.

## 5. Ratio ladder to mask jump cuts

Consecutive clips from the same interview are same-angle jump cuts. Step the magnification
**0.1–0.2 between neighbours** so each cut reads as a reframe rather than a jump. Never
repeat the same ratio twice in a row within one interview.

Ratios that read correctly in practice:

- Interviewer / question beats: **1.4 – 1.6x**
- Subject / answer beats: **1.55 – 2.2x**
- Emotional peak: top of the subject's range, still obeying the centering minimum

Higher is not better. Excess magnification softens the image and distorts facial
proportions. 4K source into 1080×1920 gives roughly 2x of free headroom; past that,
quality degrades.

## 6. Opening and closing frames

Leave the first and last clip of a cut **un-zoomed** — they carry the environment and give
the piece perspective.

**Exception:** if the opening or closing frame reads crooked to the eye because of
background geometry, correct it with rotation, which requires zooming in to crop the
corners. Rotation overrides the no-zoom rule.

## 7. Rotation

`rotation` is an **item** property (degrees, wrapping — `356.84` is −3.16°), not an
effect property. The zoom effect does not rotate.

Rotating exposes black corners unless the item is scaled up. Minimum scale to cover:

```text
scale ≥ ( W·|cos θ| + H·|sin θ| ) / W        (width-limited, the usual binding case)
scale ≥ ( W·|sin θ| + H·|cos θ| ) / H        (height-limited)
```

For 1080×1920 at 3.16°, that is **≥ 1.097**. A working value used in practice is
**1.416** — comfortably clear of black, with the surplus acting as the punch-in.

Set `width`, `height`, `left` and `top` together; offset `left`/`top` to keep the subject
framed after the rotation, not just to centre the enlarged image.

Verify by rendering the frame. Never assume the overscale was enough.

## 8. The property-overrides trap

**`propertyOverrides` replaces the whole object. It does not patch it**, despite being
documented as patch semantics.

Sending a partial update to change one value silently deletes `shape`, `focalMode`,
`focalPointX` and `focalPointY`, dropping the effect back to default centre framing. The
tool reports success and echoes only the keys you sent, so the loss is invisible.

**Always resend the complete property set on every update.** After any batch update,
re-read one effect and confirm the focal fields survived.

## 9. Verification loop

1. Render a frame from the middle of **every** clip, not a sample.
2. Confirm for each: the speaker is in frame, face readable, nobody sliced at an edge.
3. Confirm no two neighbouring clips share a ratio.
4. Confirm the opening and closing frames are wide, or deliberately rotated.

The Preview pane can lag a timeline switch by one step — if a render returns "the Preview
is showing timeline X", switch again and retry before trusting anything.

## 10. Check the source for baked-in movement first

Before blaming any zoom setting, confirm the source is actually static. A source that is
itself a previous cut — anything named `..._v1.mov`, an export, a rough assembly — can carry
the earlier edit's zoom moves **rendered into the pixels**.

Test it with `inspect_asset` and `sourceTimesMs` at four or five points inside one clip's
source range. No timeline effect is involved, so any change in framing is baked in.

The tell, and it cost a long detour once: framing drifts **non-monotonically** inside a
single clip — tighter, then wider, then tighter. A real ease-in only ever ramps one way.
When you see that, no combination of `shape`, ease, or static crop will fix it, because you
are stacking your layer on top of a move that is already in the footage. The only real fix
is to re-cut those segments from the raw camera files.

Raw-source reels and pre-edited-source reels cannot be made to match on framing. Say so
rather than burning passes trying.

## 11. Effect binding resolves against the CURRENT layout

`edit_item` effect adds are track-bound: `trackId` + `trackBoundFrom` +
`trackBoundDurationInFrames`. The tool resolves that frame range to whichever item occupies
it **at the moment of the call**.

If anything trimmed since your last read — including the user nudging a clip in the browser —
your frame numbers are stale, and effects bind to the wrong items with clipped durations.
**The call still reports success.** Once this silently attached fifteen effects to the wrong
clips and left the rest floating.

- Re-read the track immediately before adding effects, never from memory.
- Check every response: `targetItemId` and `durationInFrames` must match what you intended.
  `from` should be `0` for a whole-item effect.
- Add in small batches so a bad batch is cheap to delete and redo.
- There is no item-targeted form — passing `itemId` errors and tells you to use `trackId`.

## 12. `builtin:zoom` always animates. There is no static setting.

Tested on raw single-take footage with nothing baked in, so there is no ambiguity:

| shape | Behaviour across one clip |
| --- | --- |
| `instant` | starts tight, pulls wide by the end |
| `hold` | starts wide, goes tight, ends widest |

Setting `easeInFrames`, `easeOutFrames`, `easeInDurationInSeconds` and
`easeOutDurationInSeconds` all to `0` changes nothing. `hold` is the default shape, and
`"instant"` is an active choice — but neither is static.

**For framing that genuinely does not move, scale the item instead of adding an effect:**

```
width  = canvasW * M
height = canvasH * M
left   = canvasW/2 - focalX * width
top    = canvasH/2 - focalY * height
```

Verified pixel-identical across frames inside one clip. The trade-off is that there is no
effect object to nudge in the UI — reframing means editing those four numbers.

Say this plainly when a user reports choppy or drifting zooms. Chasing `shape` and ease
values will not fix it, and several rounds can be lost pretending otherwise.

## 13. Wide framing needs different numbers than tight framing

Where subjects stand full-body in a vertical frame, faces sit high — around 0.35 of frame
height. Two consequences:

- **Focusing on the face centres it**, which looks wrong and pushes everyone else out of
  frame. Focus *below* the face: `focalPointY ≈ 0.45–0.47` lands faces on the upper third.
- **Magnification has a hard ceiling** set by the widest pair of subjects who must both stay
  in frame. For a three-hander spanning x = 0.22 to 0.75, centring at 0.48 caps you at about
  1.6×. Past that someone is cropped out.

Formula, with the face at `y_face` in the source and a target of the upper third:
`focalPointY = y_face + 0.17 / magnification`

## 14. Jitter reads as choppy

Fifteen slightly different magnifications across a reel makes the frame nudge at every cut
for no reason, and the user will call it choppy even though each individual value is fine.

Hold **one** value across consecutive segments of the same shot with the same person
speaking. Use two states: a resting frame and a punch, and spend the punch only on real
story beats — the number reveal, the brand name, the payoff line. The frame should move only
when the story moves.

## 15. Find cuts with ffmpeg, not with your eyes

ChatCut bundles ffmpeg:

```
/Applications/ChatCut.app/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-ffprobe-static/ffmpeg
```

Get an exact cut list for any source:

```
"$FF" -hide_banner -loglevel error -i SOURCE \
  -vf "select='gt(scene,0.15)',metadata=print:file=-" -an -f null - 2>&1 \
  | grep pts_time
```

Frame sampling misses cuts and mis-estimates the ones it finds — three separate "fixes" by
eye were each off by one to three frames, and one made a clip worse. The ffmpeg list is
exact. Use it the first time a user reports a glitch, not the fourth.

Also run it on the *raw* sources to prove they are clean; that is what tells you the problem
is the pre-edited asset and not your timeline.

## 16. `apply_script` destroys item-bound effects

A rebuild reports `Dropped N effect(s) — target item was removed`. Grades, zooms, everything
item-bound is gone, and there is no migration path to the rebuilt items.

Before rebuilding: record every effect's values **and** which spoken line it sits on, because
item ids will not survive. After rebuilding: re-add grade first, then framing.

Two hard-won cautions:

- **A track's effect list is not a reliable record of the user's intent.** It also contains
  anything you mis-bound earlier. If you cannot separate their edits from your mistakes, say
  so rather than presenting the mixture back to them as theirs.
- **Values tuned against a pre-edited source will not transfer to raw footage.** The pre-edit
  is already pushed in, so the same magnification lands far tighter — 2.95× that framed a
  subject in the edit cropped to his shoulder in the raw file. Re-derive from the raw framing
  and tell the user why their numbers cannot simply be carried over.

## 17. Re-sync everything after any user trim

A trim of a few frames moves every downstream element. Each time the user says they made a
change, re-read the timeline and fix, in this order:

1. Title card duration → the question card's start frame
2. Music bed duration → the end card's end frame
3. Every SFX cue after the edit point → back onto its beat
4. `edit_captions refresh`
5. Re-export the WAV and re-check peak / full-scale count

Skipping step 5 has caught real clipping more than once. Never assume levels survived an
edit.

---

<!-- file: references/segmentation-mode.md -->

# Mode A — Segmentation Pass

You are a **content segmentation editor**, not a short-form editor. You are mining a long
vox-pop master into self-contained editorial building blocks for a human editor.

Do not try to make anything viral here. Your job is deciding where each usable piece of
content starts and ends — and marking what is inside it.

## The three cut operations

A master needs **three distinct operations**. They have different definitions, different
detection methods, and wildly different magnitudes. Conflating any two of them is the
failure that costs a rebuild.

| | 1. Cohort cut | 2. Contextual beat | 3. Edge trim |
| --- | --- | --- | --- |
| What | The set of participants changes | A narrative beat inside a cohort | Trash at a segment's two outer edges |
| Accuracy | **Frame-accurate. Non-negotiable.** | Approximate | Sub-second |
| Detected from | Scene-change detection | Transcript patterns | Filler vocabulary + measured silence |
| Magnitude | Defines the segments | ~5 per cohort | **Seconds per segment** |
| Becomes | Split + range marker | Point marker | Head/tail trim on the clip |

A cohort is **one set of people**, however many are in frame. Two or three answering
together is a single cohort. The cohort boundary is where the *set* changes — not where a
second name is spoken, and not where a question changes.

## A cohort is not one brand — split on brand pitch

**One cohort routinely contains several brand pitches.** The interviewer keeps the same
participant and runs a second and third product in the same take: protein, then a
second-hand marketplace, then a pre-workout. Each pitch becomes its **own video**, so each
is its own segment.

This is a **fourth cut**, sitting between cohort cuts and contextual beats:

| | Cohort cut | **Brand-pitch cut** | Contextual beat |
| --- | --- | --- | --- |
| Trigger | Set of people changes | Interviewer pivots to another product | Beat inside one pitch |
| Evidence | Scene detection | Topic pivot in transcript | Transcript patterns |
| Camera cut? | Yes | **Usually none** — same take | No |

Because there is no camera cut, scene detection will not find these. Find them by scanning
each cohort for **more than one brand** and locating the interviewer's pivot question.

### "One last question" is a pivot, not an ending

**When this interviewer says "one last question" / "last question" / "one last important
question" / "I have this one interesting question", he is often changing context — not
closing the interview.** It reads as the opposite of what it means.

### These phrases are candidates, never automatic splits

**This is not a hard rule.** The same phrasing is also used as an ordinary conversational
device — rapport-building, or simply the next question in the *same* pitch. Splitting on
the phrase alone over-segments.

**Confirm before cutting.** Read what follows the phrase and split only if the content
genuinely moves to a different product or context:

- Split — "one last question" → "how long have you been in Bangalore?" → belonging →
  marketplace pitch. Different brand, real boundary.
- **Do not split** — "one last important question" → the regret/experience question inside
  the same innerwear interview. Same pitch, just the next beat.

Splitting on unconfirmed phrases wrongly divided two Clotrio interviews that were single
continuous pitches. When the content after the phrase continues the same pitch, it is a
**contextual beat**, not a segment boundary.

When confirmed, **cut immediately before the phrase** so the new segment opens on its own
setup.

### The rapport question can itself be the pivot

"How long have you been in Bangalore?" reads like small talk, but for the marketplace
brand it *is* the opening of the pitch — belonging leads to moving house leads to buying
furniture leads to second-hand. Missing it left an Orgaheal segment 34s long into the
Circle context.

The lesson generalises: a pivot may be disguised as rapport. Judge by **where the
conversation ends up**, not by how the question sounds.

Distinguish it from the tagline cue: "one last **line**" / "say one line for the camera"
is the outro of the current pitch, **not** a pivot. The discriminator is *question* vs
*line*.

### The interviewer's transition vocabulary

Two kinds of marker, and they sit on **opposite sides** of the boundary:

**Closers — the previous pitch ends here. Keep them with the segment that is ending.**
- "that's about it"
- "thank you so much, that was an interesting conversation"
- "one last **line**" / "say one line for the camera" (tagline cue)

**Openers — the next pitch starts here. Cut immediately before them.**
- "one last question" / "last question" / "one last important question"
- "I have this one interesting question"
- "I'm going to take a drastic turn" / "let's go full swing" / "let me change the question"
- "what's the first thing you bought for your home?"
- "you want to try one?" / "I have a pre-workout also with me"
- "so we have another company we work with"

**The gap between a closer and the next opener is not empty.** A wrap-up can run 10–15
seconds — "that's about it, thank you so much, that was an interesting conversation" — and
it belongs to the **closing** segment. Cutting on the closer itself leaves that wrap
stranded at the head of the next segment. Find the closer, let it finish, then cut just
before the opener.

That mistake put a HackDaily segment 14 seconds early and gave it the tail of a Circle
pitch.

Missing one of these put a boundary **61 seconds late** — the Orgaheal segment swallowed
the opening of the Circle pitch, and the error was invisible because the cut still landed
on a plausible-looking question.

Label each piece with its own brand. A cohort labelled with a single brand when it
contains three is a naming error that misleads everyone downstream.

## Edge trim — remove trash only, never buildup

**A cohort segment will later yield several separate videos**, one per question or theme.
One Clotrio interview holds 5–7 comparison questions; a Breadberry session holds bread,
bun, size and ingredients; an Orgaheal session holds two. **The buildup to every one of
those questions is content**, because each becomes the opening of its own video.

Therefore edge trim removes only:

- **Filler tokens** — okay, ok, cool, yeah, yes, no, hi, hello, thank you, thanks, ready,
  pause, start, um, uh, ah, mm, right, sure, perfect, awesome, great, nice, done, bye,
  wow, alright, got it.
- **Measured dead air** at the very edge.

It never removes: the interviewer's setup, the run-in to a question, a participant's
hesitation before answering, or anything with content words in it.

**Walk in from each outer edge, drop lines only while they are pure filler or silence, and
stop at the first line carrying meaning.** Nothing between the edges is ever touched.

**Magnitude is the sanity check.** Correct edge trim on a 3-hour master is on the order of
**~70 seconds total**, a few seconds per segment. If a trim pass is removing minutes, it is
cutting content and must be rejected — trimming to "the first real question" removed 11.5
minutes and destroyed the buildup for every first video.

## Detection hierarchy — three methods, three jobs

Each method answers one question. Substituting one for another is the failure that costs
a whole rebuild.

1. **Scene-change detection → WHERE the cohort cut is.**
   The camera stops and restarts between interviews. That hard cut is the boundary, and
   it is the only frame-accurate source. See [detection-toolkit.md](detection-toolkit.md).

2. **Visual frame sampling → WHO the cohort is, and what the segment is about.**
   A 45s grid tells you the people, clothing, lighting, location, product in hand, brand.
   It is **±20–30s on placement** and must never be used to set a boundary.

3. **Transcript → WHAT the beats are inside the cohort, and WHERE the filler edges are.**
   Question structure, reveals, giveaways, taglines. Never use it for cohort boundaries;
   an interviewer who doesn't announce a new subject leaves no lexical trace at all.

**The chain:** sample the grid to identify cohorts → detect cuts near each estimate →
snap the boundary to the detected cut frame → refine to 1/30s → then read the transcript
for beats inside.

## Why estimation is not good enough

Placing boundaries from a visual grid produced a mean error of **11.5s and a maximum of
29.3s** across 39 boundaries on a real master. Every one of them looked right on the
contact sheet. Snapping to detected cuts fixed all of them.

If a boundary was not snapped to a detected cut, it is an estimate — say so.

## Preserve context

Start each segment early enough that the interaction makes sense. Never hand back a
reaction without what caused it.

Keep together: QUESTION → RESPONSE → REACTION. Keep together: SETUP → PRODUCT
INTERACTION → REACTION. Keep together: BRAND A → BRAND B INTRODUCED → COMPARISON →
PREFERENCE.

## Start a new segment when

The set of participants changes. Also: a new recording setup, location, or session; a
completed conversation followed by an independent one; a clear reset by the interviewer.

Corroborating visual evidence for a real block change: a lighting shift (daylight to
evening), a change of background or location, weather (umbrellas up), a change of
interviewer wardrobe, or a different product in hand.

## Do not start a new segment when

The speaker pauses; another brand is mentioned; the camera angle changes; there is a
reaction; the interviewer asks a follow-up; the participant thinks; the conversation
becomes visual rather than verbal; a second person in the same group is named.

Do not fragment because individual sentences look independently usable.

**No minimum-duration or merge rule may dissolve a cohort boundary.** Duration floors
suppress noise *inside* a cohort only.

## Segment boundaries

**Beginning** — the detected cut. Do not trim in to manufacture a hook; the human editor
decides the hook later.

**End** — the next cohort's detected cut. Segments tile the master with no gaps.

## Tier-2 beat taxonomy

For a scripted vox-pop interviewer, the arc repeats and is worth typing explicitly:

`PREMISE → PRIORITY → DISCOMFORT → REGRET → GUARANTEE → HANDOVER → VERDICT → REVEAL →
GIVEAWAY → TAGLINE`, plus `TASTE` for blind food tests.

Mark each beat as a point marker nested under its cohort (a `↳` prefix reads well on the
ruler). A complete interview then reads: premise → priority → discomfort → regret →
guarantee → handover → verdict → mind-change → reveal → giveaway → tagline.

**Where the interviewer improvises rather than running the script, lexical beat detection
finds nothing.** Report those cohorts as unverified and needing a manual pass — do not
report zero beats as if the segment had none.

## Do not, at this stage

Add hooks, rewrite or rearrange dialogue, add captions, music, SFX, VFX, transitions,
zooms, graphics, or CTA; colour grade; apply viral patterns; speed-ramp; remove pauses or
silence; force anything toward a target length; or make final creative decisions.

## Runbook

1. **Read-only survey.** Check for multiple campaigns/brands in one master. Run the visual
   grid at 45s. Identify cohorts, brands, products, locations, lighting blocks.
2. **Propose** the segment map and wait for approval before writing. Reading is not a
   change and needs no approval — do not stall on it.
3. **Detect cuts** near each approximate boundary; snap and refine to the frame.
4. **Split** at the refined frames. Splits cannot be moved afterwards, so do not split
   until the boundaries are detected, not estimated.
5. **Write both marker layers** — cohort ranges and beat points. Pass `timelineId`
   explicitly.
6. **Verify** summed segment duration against the master's total frame count, and confirm
   the last clip ends exactly on the master's end.
7. **Export** per segment (see detection-toolkit) and verify summed duration again.
8. **Edge-trim** each segment: filler and dead air only, from the two outer edges. Verify
   the total is seconds, not minutes.
9. Mark — never remove — every competitor appearance and every occurrence of "object".

## Metadata per segment

Segment ID, START → END timecode, primary topic, brands present, participants,
interaction type, important non-verbal visual events, one or two sentences of context,
and potential rated HIGH / MEDIUM / LOW.

Potential rates whether there is enough material for a human editor to build a strong
short-form video. It is not a virality prediction.

## Final validation

Whole timeline reviewed; every boundary snapped to a detected cut or explicitly flagged
as an estimate; no context-dependent reaction separated from its setup; silent visual
moments preserved; brand changes not treated as boundaries; group interviews not split
by name; segments tile the master exactly; low-confidence cuts flagged for human review.

---

<!-- file: references/shared-invariants.md -->

# Shared Invariants

These hold in **both** modes. Where the modes differ it is only in *how* the rule is
applied — never in whether it applies.

## Silence is not dead air

Never remove a section because nobody is speaking. Silence routinely carries the most
valuable footage in advertorial work.

Before cutting any silent stretch, look at what is on screen. Preserve silence
containing: product being shown, opened, touched, handled, worn, tasted; chewing;
facial reaction; confusion; surprise; laughter; hesitation; body language; a participant
thinking, comparing products, or considering an answer; visual demonstration; any action
that carries the narrative.

Judge every stretch on **audio information + visual information** before calling it
disposable.

- Mode A: keep the silence inside the segment.
- Mode B: keep it unless it genuinely damages pacing, and never if it holds any of the above.

**Measured evidence, so this is not a matter of taste.** Delivered street-interview reels cut
by a client's own editor keep silences of **1.2s, 1.36s, 1.52s, 2.72s and 3.21s** — and every
one sits over a physical action: slices held up to camera, the bite, the giveaway handover,
the blindfold going on. In a proof format the silence *is* the evidence. Compressing those to
250ms deletes the proof and leaves only people talking about proof.

Compress only speech-to-speech gaps **inside a single answer**. If you cannot tell whether a
silence is dead air or a beat, look at the frames before deciding — never decide from the
transcript alone, because a transcript renders a bite and an empty pause identically.

## The client's delivered cut outranks the brief

Where a client's editor has already cut anything in the series — even one rough reel — that
file is the authority on duration, pacing, speech ratio, question count and closing language.
Ask for it before building anything.

Measured example: a brief specified 30-40s per video; the same client's editor delivered
48-85s across five reels, none of them inside the brief. Cutting to the brief's number would
have been wrong on every single deliverable.

When the delivered cut and the written brief disagree, surface the conflict to the client
rather than silently choosing one.

## Advertorial precedence

Advertorial footage outranks generic retention optimisation.

Never sacrifice required brand integration to raise cut frequency. Never remove product
interaction because the speaker is silent. Never swap a visually meaningful product
moment for a faster talking-head cut. Preserve enough visual context that the viewer
understands the product's role in the scene.

## Visual storytelling overrides dialogue-based editing

Absence of speech does not mean the footage is disposable. A silent visual sequence can
be essential and must be retained when it carries the advertorial story.

## Competing brands — mark, never auto-strip

**This supersedes any earlier instruction to strip every competitor mention.**

In both modes:

- Never promote, emphasise, caption, or zoom into a competing brand.
- Never intentionally extend or draw attention to a competitor mention.
- Never discard otherwise valuable material just because a competitor appears.
- **Mark every competitor appearance — spoken, visual, or on packaging — and surface it
  for the user's decision. Do not remove it on your own initiative.**

Mode A additionally: a competitor mention is not a reason to split a segment unless the
conversation genuinely changes context.

Mode B additionally: if the user has explicitly approved removing a specific mention,
remove it only where the cut stays natural. If it cannot come out without breaking the
sentence, flag it rather than shipping a broken splice.

Competitor visibility that cannot be reframed out is a **decision for the user**, not
something to silently accept or silently fix.

## The word "object"

The word "object" is unwanted in final output.

- Mode A: mark every occurrence for later removal. Never destroy surrounding context to
  get rid of it at this stage.
- Mode B: remove it from dialogue and captions where the cut stays clean. Never create an
  awkward audio splice to do it. Where it cannot come out cleanly, flag it.

Watch for false positives: a different campaign in the same master may use "object"
as genuine subject matter.

## Conservative when uncertain

When unsure whether two sections belong together, keep them together. When unsure
whether something is disposable, keep it. It is always cheaper to hand back slightly too
much context than to destroy context that later proves necessary.

Do not optimise for minimum duration. Optimise for editorial usability.

## Never report done on an unmet rule

If a stated hard rule is still unsatisfied, say so plainly instead of describing the
work as finished. Flagging a gap in passing and then calling the job complete is the
same failure as not flagging it.
