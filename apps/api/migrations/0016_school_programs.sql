-- Two real School programs, built from the skill files in apps/web/public/resources.
-- Each lesson links the full skill file it was rewritten from. Idempotent: safe to re-run.

-- The placeholder programs the smoke test used to create, if any are around.
DELETE FROM programs WHERE name = 'Editing fundamentals' AND description = 'Four weeks, two sessions a week.' AND id NOT LIKE 'prog-%';

INSERT OR IGNORE INTO programs (id, name, description, price_points, price_cents, currency, delivery_mode, published, outcomes, prerequisites, created_by, created_at) VALUES ('prog-editing-fundamentals', 'Editing fundamentals', 'Seven lessons on the cut itself: what to keep, how to frame, what order to finish in. Built from real editing runs, not theory. Each lesson links the full skill file it came from.', 0, 0, 'INR', 'online', 1, 'You can take a raw talking-head or street-interview recording to a finished master and a reel, and say what you verified.', 'Any editor. ChatCut helps but is not required.', NULL, '2026-10-25T00:00:00.000Z');
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-editing-fundamentals-l01', 'prog-editing-fundamentals', 'Propose, then cut', 'lesson', '/resources/Shubham%20Editor%20Skill.md', 'Most editors don''t lose a client on the cut. They lose them on the surprise.

The client opens the timeline and finds a hook they never asked for, three clips gone, and music on a video that was meant to be silent. Every single choice may have been good. It doesn''t matter. Work nobody agreed to is work nobody trusts.

In this lesson you''ll learn:

- The one standing rule that keeps an edit safe: propose, then wait.
- The question to ask at every moment of a cut.
- The order that settles a fight between brand, retention and effects.

## The standing rule

Before any step that changes the project, say what you intend to do. Then wait.

This isn''t politeness. Each phase of an edit is the foundation of the next. When the foundation was never confirmed, you find out three phases later, and you rebuild everything.

- **Say it in one paragraph:** what you''re about to change, and why.
- **Name the decisions the next step depends on:** the cut is locked, the ratio is agreed, the hook is this line.
- **Stop:** ask for a yes before you touch the timeline.

Reading is free. Reading transcripts, sampling frames, measuring levels: do all of it without asking. Pausing to check in mid-analysis reads as refusing to work. Run the analysis to the end, then pause before writing.

> **Pro tip:** never bundle a plan and its execution into the same message. "Here''s what I''ll do, and I did it" is the surprise in a different coat.

## The question to ask at every moment

Not "what effect can I add here?"

Ask this instead: what is the viewer supposed to feel, understand, or get curious about at this exact moment, and what is the simplest edit that gets them there?

Think of it like cooking for a guest. You don''t add every spice you own. You add the one the dish needs.

## When decisions conflict, this order wins

1. Brand and advertorial requirements. The product moment stays, always.
2. Comprehension. If they can''t follow it, nothing else counts.
3. Retention.
4. Emotional impact.
5. Pacing.
6. Visual stimulation.
7. Effects.

An editor chasing pure retention makes exactly the wrong call. They cut the tasting, the reaction, the packaging shot, the silent demonstration. Those are the parts that make an advert work.

> **Result:** on a real street-interview batch, every expensive failure had the same shape. Work built on an unconfirmed decision, discovered late, rebuilt from scratch. The rule above is what skips those rounds.

## Never report done on an unmet rule

If a hard rule is still unmet, the work isn''t finished. Say so and name what remains. Flagging a gap in passing and then calling the job complete is the same failure as not flagging it.

## The bottom line

Propose, then wait. Ask what the viewer needs at this moment. Let brand and clarity beat effects every time. Do that and the client sees their own decisions on screen, which is the only edit they ever trust.', 1, 1);
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-editing-fundamentals-l02', 'prog-editing-fundamentals', 'Silence is not dead air', 'lesson', '/resources/Shubham%20Editor%20Skill.md', 'A client''s own editor cut five street-interview reels. Every reel kept silences of 1.2, 1.4, 1.5, 2.7 and 3.2 seconds. Every one of those silences sat over a physical action.

Most editors would have compressed all of them to a quarter of a second. And deleted the proof.

In this lesson you''ll learn:

- Why silence often carries the most valuable footage in a video.
- Which gaps you may compress, and which you must never touch.
- Why the client''s delivered cut outranks their written brief.

## Look before you cut

Never remove a stretch because nobody is talking. Before cutting any silence, look at what is on screen.

Keep silence that holds:

- **A product moment:** shown, opened, touched, worn, tasted. Chewing counts.
- **A reaction:** confusion, surprise, laughter, hesitation, a person thinking.
- **A demonstration:** any action that carries the story.

Judge every stretch on audio plus picture. A transcript shows a bite and an empty pause as the same thing: nothing. So never decide from the transcript alone. Look at the frames.

## Compress only one kind of gap

Compress speech-to-speech gaps inside a single answer. That''s it.

Not the pause before an answer. Not the beat where the slices are held up to the camera. Not the handover of a gift. In a proof format, the silence is the evidence. Compress it and you''re left with people talking about proof instead of showing it.

> **Pro tip:** if you can''t tell whether a silence is dead air or a beat, render the frame. Thirty seconds of looking saves a rebuild.

## Fillers are not always trash

For a talking-head tutorial, cut the "um" and the "so, basically". For a street interview, keep "uh", "ah" and "yeah, yeah". They read as real capture. Strip them and the reel sounds scripted, which is the one thing vox pop must never sound.

The rule isn''t "remove fillers". The rule is "match the format".

## The delivered cut outranks the brief

A brief said 30 to 40 seconds per video. The client''s own editor delivered 48 to 85 seconds, none of them inside the brief. Cutting to the brief''s number would have been wrong on every deliverable.

So ask for anything the client has already cut, even one rough reel, before you build. Measure it: duration, where the silences sit, whether fillers survive, how long the longest answer runs, the closing line word for word, and when the brand is first named. Those numbers are the real target.

When the cut and the brief disagree, say so to the client. Don''t pick one quietly.

## Keep context together

Question, response, reaction stay together. Setup, product moment, reaction stay together. Never hand back a reaction without the thing that caused it.

When you''re unsure whether two pieces belong together, keep them together. It''s always cheaper to hand back a little too much than to destroy context you need later.

## The bottom line

Silence is footage. Compress only the gaps inside one answer, keep the fillers the format needs, and let the client''s delivered cut set the numbers. The editor who looks before cutting ships the reel that keeps the proof in.', 2, 1);
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-editing-fundamentals-l03', 'prog-editing-fundamentals', 'Cut the speech first, in two passes', 'lesson', '/resources/Talking-Head%20Screencast%20-%20Chaptered%20Master%20%2B%20Reels.md', 'A long tutorial recording holds the same point three times: once at the top of a section, once in the middle, and once as a summary. A string-similarity tool catches none of them, because the words are different each time.

That''s why the speech cut takes two passes, not one.

In this lesson you''ll learn:

- The mechanical pass and the semantic pass, and why both matter.
- The one stitch that always produces an audible stumble.
- Why nothing gets built until the speech cut is confirmed.

## Gather the script first

The creator''s written script or outline is the highest-value input in the whole job. It gives you the chapter structure, the chapter titles, the right spelling of every product name, and what the video is supposed to say. Ask for it before you invent structure from a transcript.

Then check that your two sources are really simultaneous. Don''t trust filenames. Compare durations to within a few tens of milliseconds, then find a moment where the speaker points at something changing on screen and confirm the change lands slightly before the words.

## Pass one: mechanical

Fixed filler words and pause compression. Pauses tightened to about a quarter of a second. Cheap, safe, boring.

## Pass two: semantic

This is where the real work is, and where it''s easy to under-deliver.

- **Read the whole transcript:** look for the same argument delivered two or three times across takes. Keep the best complete take, usually the later one unless it''s broken.
- **Cut the restarts:** repeated "So..." openers, padding, a sentence said twice, self-talk.
- **Expect a second cleanup pass:** creators restate more than they think.

> **Pro tip:** never keep the lead-in of a failed take and stitch it onto a different take. It produces an audible stumble every time. Catch it by flagging any kept segment that doesn''t end on a full stop and is followed by removed speech. Then read what was removed.

## Fix the transcript, not the audio

Fix ASR errors against the script, not a dictionary. A dictionary only finds non-words. The damaging errors are real words in the wrong place: a brand name heard as a common noun, a number heard as another number. Correct them as transcript fixes so captions update everywhere and the audio stays untouched.

Watch the lines the brand cares about most. Across three reels on one job, the errors clustered in the call-to-action lines: the brand name, the website, the offer. Proof those by ear before delivery, every time.

## Confirm before you build

Everything downstream assumes the speech cut is final: chapters, graphics, captions, reels. So confirm it with the creator before building anything on top.

A two-segment deletion later invalidates the mirrored screen track, every chapter position, every graphic beat and every caption. Re-derive all of it after any speech change. Don''t patch around it.

## Mirror the screen track

Rebuild the screen track so every clip matches the speech track''s start, duration and source offset exactly. Verify zero mismatches. This frame lock is what keeps picture and sound together for the rest of the edit.

> **Result:** on a real tutorial, this order produced one confirmed speech cut and zero rebuilds. The previous order produced three.

## The bottom line

Get the script. Prove the sources line up. Do the cheap pass, then the careful pass. Never stitch a failed lead-in. Confirm, then mirror. The speech cut is the foundation, so pour it once.', 3, 1);
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-editing-fundamentals-l04', 'prog-editing-fundamentals', 'Measure before you frame', 'lesson', '/resources/Shubham%20Editor%20Skill.md', 'Four rounds of "the speaker isn''t visible" on one job traced back to the same cause. The zoom was set below the number the arithmetic demanded. Nobody had done the arithmetic.

On locked-off interview footage there are no cutaways. The cut and the frame are the only visual tools you have. So framing is load-bearing, and it is maths before it is taste.

In this lesson you''ll learn:

- The centering rule that decides the minimum zoom for any subject.
- Why you measure from one full-size frame, never from a contact sheet.
- How to step the zoom so jump cuts read as reframes.

## Measure from one real frame

Never read positions off a contact sheet. Cell-relative guesses have been wrong by 0.08 to 0.15 of frame width, which is enough to push a speaker off the edge.

Take one full-resolution frame per source at a settled moment. Read the subject''s head position as a fraction of frame width and height. Record subject and interviewer for every asset. The camera is locked off, so one measurement serves the whole interview.

## The centering rule

A crop can''t extend past the source edge. So a subject standing at normalised x can only be centred if the crop is narrow enough.

**Minimum zoom = 1 divided by (2 times x).** For a person at x = 0.26, that''s 1.92x. Below it the crop clamps to the edge and the subject slides out of frame. For someone on the right, mirror it: 1 divided by (2 times (1 minus x)).

> **Pro tip:** if the required zoom is higher than the footage can carry without going soft, say so. Don''t ship a cropped-out speaker and don''t ship a blurry one. Name the trade-off.

## Headroom is finite

A 4K source into a 1080-wide canvas gives exactly 2x before you''re inventing pixels. Past that the image softens and no export setting brings the detail back. When a subject''s centering minimum sits near 2x, sharpness and centering are in direct conflict.

## Aim at the person speaking

Automatic focus modes pick the wrong person. At low zoom they centre between two people. At high zoom they lock on whoever looks dominant, usually the interviewer, and crop the actual speaker out. Use manual focal points from your measurements.

## Change the ratio, don''t animate it

The cut lands on a new framing. Nothing drifts, pushes or springs. A moving push on a two-second clip reads as cheap, and a push that comes back is the most rejected move in this whole workflow.

- **Step 0.1 to 0.2 between neighbours:** consecutive clips from the same interview are jump cuts. A new ratio each time reads as a reframe.
- **Never repeat a ratio back to back.** A three-value cycle guarantees it.
- **Step at jump cuts, not every clip:** where the footage runs continuously, a size change adds a pop to a seam nobody would have noticed.
- **Leave the first and last clips wide.** They carry the environment.

Hold one value across consecutive segments of the same shot with the same person talking. Fifteen slightly different zooms across a reel reads as choppy, even when each number is fine. Spend the punch on real beats: the number reveal, the brand name, the payoff line.

## Group shots have their own rule

In street interviews, everyone stays in frame. Bodies may be cut at the waist. People may not be cut at all. Measure the outer body edges, not the faces, and check the widest group shot and the tightest punch-in. Those are where it fails.

The eyeline sets the vertical: eyes on the upper third. Some clients anchor the forehead instead. Ask which, and keep head height level from cut to cut.

## The bottom line

Measure once from a real frame. Respect the centering minimum and the 2x headroom. Aim at the speaker by hand. Step the ratio at jump cuts and leave the ends wide. Framing done by arithmetic looks like taste. Framing done by taste alone looks like a mistake.', 4, 1);
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-editing-fundamentals-l05', 'prog-editing-fundamentals', 'Chapters and layouts from what the screen is doing', 'lesson', '/resources/Talking-Head%20Screencast%20-%20Chaptered%20Master%20%2B%20Reels.md', 'What a speaker talks about and what is happening on their screen diverge far more often than you''d think. Choose a layout from the transcript and you''ll show a static desktop while they describe the most exciting part of the build.

Measure the screen instead.

In this lesson you''ll learn:

- How to place chapters from the script, not from guesswork.
- Three layout modes, chosen from measured screen activity.
- Why in-view layout changes are animated moves, and why punch-ins are cuts.

## Chapters come from the script

Anchor each chapter to a distinctive spoken phrase. Look up its frame. Tile the chapter markers across the whole video with no gaps and no overlaps, using the script''s section names exactly.

Chapter positions sit downstream of the speech cut. After any change to the cut, re-derive them. Don''t nudge them by hand.

## Measure the screen, then pick a layout

Sample the screen recording and measure how much it changes over time. Then classify each chapter:

- **Low activity, speaker mode:** the speaker fills the frame and the screen is hidden.
- **Medium activity, split mode:** screen and speaker side by side on a shared baseline.
- **High activity, screen mode:** screen dominant, speaker as a small inset.

Decide the horizontal bands once, then compute every mode from the same content band so panels always share a baseline. When the bands change, recompute all modes. Never carry a number over from an earlier revision. Mixing two revisions puts panels on different baselines, which looks like a sync problem and isn''t.

Give the platform''s own controls real room at the bottom. Captions pushed to the frame edge get covered by the player.

## In view, animate. Behind a card, cut.

A layout change that happens while the viewer is watching is a move: the whole webcam frame shrinks into its slot or grows back over about a second, eased, with the screen already sitting underneath. Never a hard jump.

A change hidden behind a chapter card needs no animation at all.

> **Pro tip:** when a panel graphic is on screen, it replaces the screen recording for its span and the speaker goes full frame beside it. Never stack graphic plus recording plus inset. It''s too much to read and it looks lopsided.

## Punch-ins are cuts

A punch-in is a hard cut about 12 to 15 percent tighter, alternating at speech cuts longer than a second, only in speaker-full sections. It is never a zoom.

And never punch in to make room for a graphic. Shift the head to the free side by moving the crop window at normal size instead. Creators notice when their head gets bigger.

## Face framing: measure, never eyeball

Landmarks read from a single frame are wrong, because the speaker moves through the take. Match a small patch around the eyes across the whole recording, use the median position to centre the crop and the spread to size it.

Report the spread honestly. A speaker who wanders across most of the crop can''t be held centred by any static crop. Say so and name the real fix, which is tracking, rather than quietly approximating.

Rule of thirds says eyes on the upper line. With a close-framed speaker that clips the top of the head on a large share of frames. Count the share. Then let the creator choose, with the cost in percent, not in vague words.

> **Result:** chapters from the script, layouts from measured activity, moves in view and cuts behind cards. The tutorial reads as one designed thing instead of a slideshow.

## The bottom line

Don''t guess the layout from the words. Measure the screen. Compute every mode from one band layout, animate what the viewer sees change, and keep punch-ins as cuts. The viewer never notices any of it, which is the point.', 5, 1);
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-editing-fundamentals-l06', 'prog-editing-fundamentals', 'Finish in order: captions, titles, sound, export', 'lesson', '/resources/Vox-Pop%20Brand%20Series%20-%20from%20scratch.md', 'Here''s a mistake that costs a whole round: balancing the music before denoising the speech. The traffic, not the fader, is what buries the bed. Fix the traffic first and the fader was fine all along.

Finishing has an order. Each step''s correct setting depends on the one before it.

In this lesson you''ll learn:

- The finishing order, and why it isn''t negotiable.
- The caption rules that keep words honest.
- How to set sound levels you can''t hear.

## The order

1. Denoise the speech lightly, then level every clip by gain.
2. Reframe every clip.
3. Captions.
4. Title card.
5. Sound effects.
6. Music last.
7. Check frame 0.

Once finishing starts, the cut is frozen. A script-level edit rebuilds the track and silently drops every effect placed on it. If the cut truly must change, say that the finishing pass will be redone too.

## Captions: correct the machine, not the speaker

Fix spelling, fused words, homophones and missing apostrophes. Leave the speaker''s own grammar alone. Rewriting it puts words on screen they never said.

- **Never add words to make a line read better:** the highlight is timed per word, so an extra word knocks the whole card out of sync.
- **Avoid hyphens in caption text:** the tokenizer splits "pre-owned" into "pre owned" with a gap.
- **Proof the brand lines first:** the call to action, the website, the product name. These are the lines the client reads and the lines the machine gets wrong most.

A full-frame title at 0 seconds is a retention bug. It delays the hook. Use a persistent bar that holds identity through the reel and ends on the first frame of the end card.

## Sound: audible but below speech

"Below speech" is not the goal. Audible and below speech is. A bed set too quietly is as wrong as one set too loud.

Numbers that landed on real reels: music 4 to 6 dB under speech in the clear, 10 to 12 dB under while someone is talking. One run started the bed 9.5 dB under and the client called it inaudible. At 1.8 dB under it fought the dialogue. 4.5 dB under was right. Start there, not conservative.

Sound effects must match a real event on screen. Level them against measured loudness, not by ear. A stock library can span 22 dB between its quietest and loudest file. Pull the whole track down and you keep the unevenness exactly. Set each cue''s gain from its own measurement, then fade every cue a few frames each side so nothing clicks.

> **Pro tip:** you can''t hear the mix. So measure it. Export a WAV and check peak level and the count of samples at full scale. On one job the mix was clipping before any music was added. The dialogue alone was driving the sum into the ceiling. Comparing two exports at different music levels proved it.

Always say plainly that levels were measured, not heard.

## Frame 0

The first clip on a timeline usually carries a default fade from black. Every reel in one batch opened on seven black frames and survived a full export round before anyone looked. Zero the video fade on the frame-0 clip and render frame 0 to prove it. Leave the tiny audio fade alone; it only stops a click.

## Export one at a time

Five parallel exports once killed all five. The app said complete. The folder held five frozen temp files and no videos. Export one reel at a time, wait for the file, then compare its duration to the timeline''s. Reels in a batch have different lengths, so a mismatch catches a misfiled render in one look.

Put the version at the front of the filename. Never write "final".

## The bottom line

Denoise, reframe, captions, title, effects, music, frame 0. Keep the speaker''s words and fix the machine''s. Set levels by measurement and say so. Export one at a time and trust the file, not the status.', 6, 1);
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-editing-fundamentals-l07', 'prog-editing-fundamentals', 'Reels from a master', 'lesson', '/resources/FramerSchool%20video%20editing%20template.md', 'Fifteen reels from one tutorial. The creator approved two and the rest were built in an afternoon. That wasn''t luck. It was order.

In this lesson you''ll learn:

- Why you build two sample reels before you batch anything.
- What every reel must contain, from frame 0 to the outro.
- How to keep text out of the platform''s own buttons.

## One reel per part, not per chapter

A script''s parts are already coherent topics. Build one vertical timeline per part. Duplicate the master, switch the canvas to 9:16, delete everything outside the part, shift it to start at zero and restack: speaker above, screen below.

## Two samples first

Build one talk-heavy reel and one screen-heavy reel. Get them approved. Every rule the series needs surfaces on those two, so it''s free on the other thirteen.

Then batch: duplicate the approved sample timeline, which keeps its tracks, its ducking and its caption style. Clear its items. Rebuild from the master.

> **Pro tip:** a duplicated timeline gets entirely new track ids. Reuse the old ids and every read comes back empty, nothing is deleted, and the run still reports success. Resolve tracks per timeline, by order and type, every time.

## What every reel contains

- **Content from frame 0.** The intro card plays over the first two seconds of speech, not before it.
- **A hook:** the first full line after the intro card, speaker full frame.
- **A counter:** "03 / 15" top left, so the viewer knows where they are in the series.
- **A progress line** along the bottom edge that fills over the whole reel.
- **At least one speaker moment,** and the reel ends on the speaker. Always.
- **An outro card** after the last line: "Part 04 next".

## Break up long cards

A diagram card that runs longer than about ten seconds loses people. Split it with two to five second talking-head moments on direct-to-camera lines, and let each card resume at the step it left off. Don''t place a break where the key change of a step would be missed.

A reel over about two minutes, or one with two clear halves, becomes "(1/2)" and "(2/2)" at a natural boundary. Part one''s outro says "continues".

## Layout states, smoothed

Two states: speaker full, or speaker stacked over the screen. Every change between them is a short eased move with the screen underneath. Short runs get smoothed away so the layout doesn''t flicker. No move lands in the last few seconds before a card.

## Safe zones are measured, not assumed

Get the platform''s safe-zone template and read the pixels off it. One real template measured 250 px at the top, 420 px of margin at the bottom, and 193 px on the lower right where the like, comment and share column sits. A title placed at y = 104 sat entirely inside the header strip.

The asymmetric lower-right margin is the one everybody misses. A centred full-width caption box can overlap the icon column while the top of the frame looks clean.

## Sound for reels

Speaker at minus 3 dB. One mellow bed, very low, with ducking under the voice. A deep short whoosh on the intro card, an airy one as it leaves and on the outro, a simple one on each layout move, skipped when another sits within a second and a half.

> **Result:** two approved samples, thirteen batched reels, every one verified on its intro, hook, each move, each card, the ending and the outro.

## The bottom line

One reel per part. Two samples before the batch. Content from frame 0, a counter, a progress line, and always end on the speaker. Measure the safe zone instead of trusting your eyes. The batch is only as good as the sample it was cloned from.', 7, 1);
INSERT OR IGNORE INTO course_assignments (id, program_id, title, instructions, rubric, due_days, sequence) VALUES ('prog-editing-fundamentals-a01', 'prog-editing-fundamentals', 'Cut one reel from a master', 'Take a talking-head or street-interview recording of at least ten minutes, yours or one you have permission to use. Cut one vertical reel of 45 to 60 seconds.

Before you cut, write three lines: the format, the speech ratio you measured from a reference, and the one angle of this reel. Then do the speech cut in two passes, frame it by measurement, finish in order, and export once.

Submit the link to the reel and a short note that says what you verified (frames rendered, duration checked, levels measured) and what you did not.', 'Hook on screen within the first second, readable with sound off. No silence cut that covered an action. Every face in frame, no ratio repeated back to back. Captions correct the machine, not the speaker. The note names what was measured and what was only looked at.', 14, 1);
INSERT OR IGNORE INTO cohorts (id, program_id, name, start_at, end_at, capacity, status, manager_user_id, created_at) VALUES ('coh-editing-open', 'prog-editing-fundamentals', 'Self-paced, open all year', '2026-10-25T00:00:00.000Z', '2027-12-31T00:00:00.000Z', 1000, 'running', NULL, '2026-10-25T00:00:00.000Z');

INSERT OR IGNORE INTO programs (id, name, description, price_points, price_cents, currency, delivery_mode, published, outcomes, prerequisites, created_by, created_at) VALUES ('prog-chatcut-ai', 'Skills using ChatCut and AI', 'Seven lessons on working with an AI editor through written skills: the gate, the brand skill, what transcripts miss, locking one reel then batching, hooks, retention writing, and verification. Each lesson links the full skill file.', 0, 0, 'INR', 'online', 1, 'You can write a skill a brand can reuse, run a phase-gated edit with ChatCut, and check the result like you cannot see or hear it.', 'Editing fundamentals, or one finished reel of your own.', NULL, '2026-10-25T00:00:00.000Z');
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-chatcut-ai-l01', 'prog-chatcut-ai', 'What a skill is, and why the gate comes first', 'lesson', '/resources/Vox-Pop%20Brand%20Series%20-%20from%20scratch.md', 'Give an AI editor a vague brief and it will make a hundred confident decisions you never agreed to. Give it a skill and it makes the same decisions you would, in the same order, every time.

A skill is a written runbook: the rules, the numbers, the order of work, and the places where it must stop and ask. This lesson is about the stopping.

In this lesson you''ll learn:

- What a skill actually contains.
- The gate between phases, and why it is not politeness.
- The difference between reading and writing.

## What''s in a skill

Think of it like a recipe written by someone who has burned the dish before. Not "make it tasty", but "the pan is too hot if the butter browns in under ten seconds".

- **Hard rules:** what may never appear on screen, the locked tagline, the banned words, the spelling of every brand term.
- **Measured numbers:** caption size, music level under speech, eyeline height, reel length taken from the client''s own cuts.
- **The order of work:** phases, each with its output and its gate.
- **Field notes:** what went wrong on real runs, so it never goes wrong twice.

## The gate

Do not start a phase until the previous one has been explicitly confirmed.

Each phase''s output is the input to the next. The expensive failures all have the same shape: work built on an unconfirmed foundation, discovered three phases later, rebuilt from scratch.

At the end of every phase:

1. State what was produced, in one short paragraph.
2. State the decisions the next phase depends on.
3. Stop. Ask for a yes.

Don''t roll two phases into one turn because the first "obviously" succeeded. Don''t start finishing because the cut looks fine to you. The client has to say the cut is locked, because finishing is the point of no return.

> **Pro tip:** gating is between phases, not between steps. Inside a phase, do the whole phase.

## Reading is free

Reading transcripts, sampling frames, measuring loudness, scanning for scene cuts: none of it changes the project, so none of it needs approval. Pausing to ask permission to read stalls an approved task and looks like refusing to work.

Do the analysis to the end. Then pause before the first write.

## Write it back

When a run teaches you something, it goes into the skill. Brand-specific learnings go in the brand''s own skill. General craft goes in the editing skill.

Two traps:

- **Read the existing skill before updating it.** An update replaces the package. Writing from memory silently drops whatever you forgot.
- **Correct superseded rules, don''t append.** A skill that holds both the old rule and its replacement produces the old behaviour again.

> **Result:** one street-interview series took many rounds the first time because phases ran out of order. The corrected skill names every detour. The next brand skipped all of them.

## The bottom line

A skill is the rules, the numbers, the order and the gates, written down by someone who has already paid for the mistakes. Read freely, write only after a yes, and put every lesson back into the file. That''s the whole craft of working with an AI editor.', 1, 1);
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-chatcut-ai-l02', 'prog-chatcut-ai', 'Build the brand skill before touching footage', 'lesson', '/resources/Vox-Pop%20Brand%20Series%20-%20from%20scratch.md', 'The single most expensive detour on a real brand series was not asking for the client''s own delivered cuts on day one. Everything got re-derived from a brief when one reference file would have settled it in a single pass.

So the brand skill comes first. Before any footage.

In this lesson you''ll learn:

- What to ask for on the first turn.
- How to measure a brand instead of describing it.
- How to decode a delivered cut into numbers you can hold.

## Ask for the delivered cuts first

If the client''s editor has cut anything in this series, even one rough reel, that file outranks the brief, the strategy deck and your own judgement on structure, pacing, length and language. Ask for it explicitly at the start. Don''t wait to be handed it three rounds in.

## Measure the brand, don''t describe it

- **Exact colours** pulled from the artwork, not "a warm red".
- **Fonts proven on a rendered frame.** A font can register successfully and still fall back to a serif at render time. The catalogue is not proof. Glyphs on a frame are.
- **The wordmark checked against the font.** If the letterforms match, set it as live type. If it''s drawn, say so and require the artwork file.
- **Commercial facts from the client, not the deck.** Prices in a strategy PDF are routinely stale.

Write the hard rules in now: the locked tagline, banned topics, anything that may never appear on screen or in audio. Include the spelling of every brand term. Transcription will mangle all of them, and they recur in every reel.

Build the end card as a real asset and get it approved here. If the client has a finished reel, the fastest correct end card is usually a trimmed copy of theirs.

> **Pro tip:** scaffold the new brand skill from an existing one. Copy the shape, never the content. The brand''s own website, deck, logo and font files fill it in. Not your guesses about the category.

## Decode the reference cuts

When delivered cuts exist, transcribe them word by word with timings and build a beat map before writing a single rule of your own. Measure, in this order:

1. **Duration of every reel.** This is the real target, not the brief''s number.
2. **Where the silences sit and how long they are.**
3. **Whether fillers survive.**
4. **The longest uninterrupted answer,** and where it sits.
5. **The closing line, word for word.** It is usually near-identical across reels and the most copyable asset in the batch.
6. **When the brand is first named.** Often much later than the brief demands.

Where the delivered cut and the written brief disagree, say so to the client and follow the cut unless told otherwise.

## The ratio is not what you think

Never import a speech ratio from another client''s series. One brand ran 80 percent participant. Another''s delivered cuts ran roughly 45 percent participant and 55 percent interviewer. Chasing 80 there produced a cut the client called "random", because stripping the interviewer removed the questions, and the questions are what made the blind test readable.

Separate three things the interviewer does. Questions and camera directions are structure: keep them. The closing call to action is brand copy: count it separately. Explaining the product or breaking the fourth wall: cut, always. The failure is never "the interviewer spoke". It''s "the interviewer sold".

> **Result:** the brand skill holds the colours, the fonts, the rules, the spellings, the end card, and the numbers from the client''s own cut. Every reel after that starts from the right place.

## The bottom line

Ask for the delivered cuts on turn one. Measure the brand instead of describing it. Decode the reference into durations, silences, the closing line and the ratio. Then, and only then, open the footage.', 2, 1);
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-chatcut-ai-l03', 'prog-chatcut-ai', 'The transcript is not the whole shoot', 'lesson', '/resources/Shubham%20Editor%20Skill.md', 'A transcript logs speech. It does not log a walk, a gesture, a taste or a reveal. Those come back as silence or as a single stray word. On one shoot, a ramp walk was logged as the word "Um." spanning nearly five seconds.

Cut from the transcript alone and you cut straight through the best footage you have.

In this lesson you''ll learn:

- Three questions, and the three different instruments that answer them.
- Why phrase matching goes blind exactly when the interviewer improvises.
- The interviewer''s own words that mean the opposite of what they sound like.

## Three questions, three instruments

Every serious failure on a three-hour street-interview master came from using one tool to answer another tool''s question.

- **Where does the group of people change?** Scene-change detection. The camera stops and restarts between interviews, and that hard cut is the only frame-accurate signal.
- **Who is in this segment, and what is it about?** Visual frame sampling. A grid of frames tells you the people, the clothes, the light, the product in hand. It is plus or minus 20 to 30 seconds on placement and must never set a boundary.
- **What are the beats inside it?** The transcript. Questions, reveals, giveaways, taglines.

Using the transcript to find groups merged eleven minutes holding five different sets of people into one segment. Using a frame grid to place boundaries left an average error of 11.5 seconds. Both looked convincing at the time.

## Detect, don''t estimate

Downscale frames hard, compare each to the previous one, and a hard cut spikes while motion inside a shot doesn''t. Scan around each estimate, then refine to a thirtieth of a second. Report any boundary scoring low as an estimate, in the marker and in the filename.

Splits can''t be moved afterwards. A wrong boundary means rebuilding the whole timeline. So detect before you split.

> **Pro tip:** the decisive check for a segmentation is one line. The summed duration of all segments equals the master''s duration. Report the difference explicitly. A tool returning success is not verification.

## Phrase matching goes blind

A phrase-based detector only fires when someone says the phrase. An interviewer who just starts asking questions produces no signal at all. A long stretch with no hits isn''t evidence of one unified segment. It''s evidence the detector saw nothing. Check the picture.

## Words that mean the opposite

One interviewer uses "one last question" to change the subject, not to end the interview. Reading it as an ending put a boundary 61 seconds late. His closers are different words: "that''s about it", "thank you so much". And the wrap between a closer and the next opener can run 15 seconds, and it belongs to the segment that is ending.

But the phrase is a candidate, never a rule. The same words are also used for rapport, or for the next beat of the same pitch. Read what follows and split only on a real change of product or context. And watch for the reverse: "how long have you been in Bangalore?" sounds like small talk, and for one brand it was the opening of the whole pitch.

Ask the interviewer for their transition vocabulary up front. They know their own phrasing. You can''t infer it reliably.

## One take can hold four brands

A single three-hour master held four brands interleaved, two of them recurring after long gaps. One pitch ran a full minute without ever naming the brand. Search every reveal variant: "it''s called", "is called", "a brand called", "we work with". Then look for the pitch shape too: a hypothetical offer, a price comparison, a demo. Label each piece with its own brand, never the cohort''s majority.

## Measure dead air from silence markers

Take pause lengths from the transcript''s silence markers, not from interpolated frame positions. Interpolation smooths silence away entirely. A 16.8-second pause read as zero and the trim never fired.

## Edge trim is measured in seconds

Trim only filler words and dead air from the two outer edges of a segment. A segment later becomes several videos, one per question, so the run-in to every question is the opening of a future video. One pass that trimmed to "the first real question" removed 11.5 minutes and was rejected outright. The corrected pass removed 70 seconds. Magnitude is the tell.

## The bottom line

Scene detection for where. Frames for who. Transcript for what. Treat the interviewer''s phrases as candidates, read what follows, and keep the buildup. The transcript is a map of the words, not a map of the shoot.', 3, 1);
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-chatcut-ai-l04', 'prog-chatcut-ai', 'Lock one reel, then batch', 'lesson', '/resources/FramerSchool%20video%20editing%20template.md', 'The commonest bad first cut is a string of two-second fragments from many people. It reads as random because nobody finishes a thought, and it fails no matter how good each line is.

The fix isn''t better fragments. It''s one reel, built and argued over until it''s right, then cloned.

In this lesson you''ll learn:

- The three decisions to agree before cutting anything.
- Why one locked reel makes every other reel cheap.
- The batch traps that report success while doing nothing.

## Agree the shape first

Three decisions, each with its own gate:

1. **The format.** Is this a proof format, a physical demonstration that makes a claim provable, or an opinion montage? They are different edits. Ask. Don''t infer it from the deck''s vocabulary.
2. **The speech ratio,** measured from the client''s own delivered reel.
3. **One distinct angle per reel,** written as a goal worked backwards: goal, seed, question, faces, landing.

This is the most important gate in the whole runbook. Confirm it before cutting.

## Anchor an answer, then stack

The delivered cuts do the opposite of fragments. One participant carries a long, specific, personal answer early. On a 48-second reel, one person explained for 14 seconds how she makes four small slices to fill up but only three of the bigger ones. Nearly 30 percent of the runtime, one voice. Short corroborations from other faces stack after it.

Find the most concrete, most numeric, most personal answer in the footage. Let it run whole. Then stack.

## Build one reel to lock

Iterate that single reel until the client says it''s right. Every rule the series needs surfaces here: question count, banned mentions, how many faces the proof needs, how long the silences stay. Learn them on one reel and they''re free on the rest.

The client must say this reel is locked. It becomes the template.

> **Pro tip:** in reveal formats, every guess plays before the answer, and the answer lands once. A guess heard after the reveal reads as broken. And one setup per reel. Two people introducing the same product back to back is a repeat.

## Batch by cloning

Duplicate the locked timeline. It keeps its tracks, its ducking and its caption style. Clear the items. Rebuild from the master, varying the source allocation so reels don''t share footage where you can avoid it. Validate each one structurally: every clip''s end frame equals the next clip''s start, no gaps, no overlaps.

## The traps that report success

- **A duplicate gets new track ids.** Reuse the source timeline''s ids and reads come back empty, nothing gets deleted, and the run reports success. Resolve tracks per timeline, by order and type.
- **A duplicate may carry an extra empty audio track.** Picking the first audio track by index selects the empty one and leaves effects untrimmed. Pick the track that holds items.
- **Batches are atomic per call.** One invalid entry rolls back the whole chunk, including the valid ones beside it. Check the returned count against what you sent.
- **Caches go stale.** After correcting a transcript, the script view may still serve old text and reject your edit. Refresh first.
- **Merging clips across a cut** silently plays the wrong part of the take. Only merge neighbours whose source timing is continuous, and compare every reel''s played source ranges against the master afterwards.
- **Keep payloads small.** Generated batches under about 30 KB per call, split into chunks. For rebuilds, diff against the live timeline and only change what changed, so untouched items keep their ids.

## Then freeze

Once finishing starts, the cut is frozen. A script-level rebuild drops every effect placed on it. If a cut must change later, say up front that the finishing pass goes with it.

> **Result:** one series went from "random" to approved on one reel, then produced the other six in a single batch that validated clean.

## The bottom line

Agree the format, the ratio and the angles. Anchor one long answer. Lock one reel. Clone it, rebuild the items, validate the structure, and read the returned counts instead of trusting the word "success".', 4, 1);
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-chatcut-ai-l05', 'prog-chatcut-ai', 'Hooks the AI cannot guess: the idea test and the review', 'lesson', '/resources/Kallaway%20Virality%20Skill.md', 'Same creator, same production quality, same length. One video did 14 million views. The other did 40 thousand. The only variable was whether the three parts of the hook meant the same thing.

Most people spend 5 percent of their effort on the hook. Spend 30 to 40.

In this lesson you''ll learn:

- The idea test that decides whether a video is worth cutting at all.
- The three components of a hook, in order of importance.
- The eleven questions to ask before you call a cut done.

## The idea test

Every idea is topic plus seed plus substance. The topic is the subject. The seed is the one-line premise or contrarian take that anchors everything. The substance is the facts, examples or emotional beats built around it.

Two questions decide whether it performs:

1. Is the topic relevant to the ideal viewer, not just to a big audience?
2. Are the seed and substance actually interesting or useful to that viewer?

Views from the wrong audience don''t become customers. When a topic has broad appeal and no fit to the buyer, say so before cutting.

## The hook is the whole video

Once someone scrolls past, nothing after that point matters. Short-form has no thumbnail, title or description. The hook is headline, intro and pitch in one.

Three components, in order of importance:

1. **Text hook:** what''s written on screen. Eyes go to text first. It matters most.
2. **Visual hook:** what''s shown. It stops the scroll or creates confusion.
3. **Spoken hook:** what''s said. Least important, because most short-form is watched with the sound off.

Most creators obsess over the spoken hook. Flip it.

> **Pro tip:** frame 0 should be on whoever delivers the hook. A wide group shot at the start spends your visual hook on background and small faces. Punch in on the hook speaker for the opening shot only.

## Alignment

All three components must mean the same thing. A split second of doubt between what''s said, shown and written is enough to lose a viewer, not because the content is bad, but because they can''t tell the time will be worth it.

The 14-million-view video: spoken "you can walk through your home before you build it", visual of people walking through a full-scale floor plan, text "Lifesize Floor Plans". Impossible to misunderstand. The 40-thousand-view video: spoken "shipping containers into space", visual of generic rockets, text "Space Cannons Are Awesome". Three different videos in three seconds.

## Every hook needs two things

- **Clarity:** within the first sentence the viewer knows what this is and whether it''s for them. Write at a fifth-grade level. Short, direct sentences.
- **A curiosity loop:** the gap between what the viewer believes and the new thing you''re about to show. The bigger the gap, the stronger the hook.

To build the loop: find a pain the viewer cares about, map their common belief, state your contrarian reality, say why it beats their belief, then give one fast hit of proof.

## The modern story arc

The school arc, with its rising action and single climax, doesn''t work on social. People leave before the rising action gets good.

- **0 to 5 seconds:** drop the viewer mid-story with about 70 percent of the context. Never start at zero.
- **5 to 15 seconds:** spike to 90 percent intensity. The contrarian claim, the shocking number, the turn.
- **15 to 45 seconds:** release for 10 to 15 seconds, then another peak. Stack mini-peaks. Rehook as often as you can.

There is no single climax. There is a stack of peaks. And dropping in mid-story doesn''t mean dropping the context: every reel in a batch still needs its own setup beat right after the hook, because a viewer who meets reel three first has seen none of the others.

## The eleven-point review

Run it against any cut before calling it done. If you wouldn''t watch it, they won''t.

1. Format: is this the most compelling way to tell it?
2. Topic: relevant to the ideal viewer, or only to us?
3. Seed: is the angle non-obvious?
4. Substance: tactically useful, or just entertaining?
5. Visual hook: contrast, movement, something unexpected? Is frame 0 on the hook speaker?
6. Text hook: does it create curiosity and match the other two?
7. Spoken hook: clarity and a loop in the first three seconds?
8. Structure: building anticipation, or listing facts?
9. Call to action: a clear next step?
10. Layout: does it suit the presenter''s real strengths?
11. Elements: do captions, cuts, music and pacing match the vibe? Energetic audio still sits under the speech.

Report honestly which points a cut fails. A recap that says everything passed is not a review.

## The bottom line

Test the idea before you cut. Put the hook''s three parts in the right order and make them agree. Open mid-story and stack peaks. Then run the eleven questions and answer them like a viewer, not like the person who made it.', 5, 1);
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-chatcut-ai-l06', 'prog-chatcut-ai', 'Write for retention: eight principles', 'lesson', '/resources/Kallaway%20Virality%20Skill.md', 'Attention is sand in an hourglass. It starts running the second the video opens, and you have about five seconds to give someone a reason to stay.

You may not be able to deliver the value in five seconds. You must signal it.

In this lesson you''ll learn:

- The eight principles that govern whether people keep watching.
- The reframing test that makes any line simpler and more interesting.
- Why sentence rhythm matters as much as content.

## 1. Curiosity and contrast

Storytelling is popping a question in the viewer''s head, answering it, then popping a new one, all the way down.

All curiosity is rooted in contrast. Expectation versus reality. What they thought versus what you think. Aim for at least one major contrast moment per script. Every extra non-obvious claim you can position as true deepens the hook.

## 2. Speed to value

For a story, value is something interesting worth hearing. For education, value is a non-obvious, usable solution. The more painful the problem, the more slack you get. But signal it fast.

## 3. Value density

Raise the ratio of value to non-value across the whole runtime. If the viewer doesn''t need to hear it, cut it. For a story, that''s how often something unexpected happens. For a lesson, it''s whether they can act on what you said.

## 4. Clarity and comprehension

Comprehension comes before value. A point that doesn''t stick can''t be acted on, so it isn''t valuable.

- **Word choice:** sixth grade or below. Terms are fine now and then, defined in plain words.
- **Active voice:** "the dog jumped", not "the jump was done by the dog".
- **Repeaters:** say every valuable point twice. Once precise, once stupid-simple with a metaphor.
- **Compression:** reduce each point to its smallest form. Every unneeded word is one more thing the brain filters in real time.

> **Pro tip:** the reframing test. Can you make the line two levels simpler and two levels more interesting? "This tool is the future of productivity" becomes "this tool lets your computer do work for you".

## 5. Absorption

Trust comes from the viewer using your advice and having it work. That needs absorption (did they get it?) and a short implementation distance (how far to acting on it?). Examples and frameworks that let someone see a known idea in a new way absorb best.

## 6. Anticipation

Tease a condition and the viewer waits to see it pay off. The more valuable the thing they''re waiting for, the longer they hold. Anticipation plus a non-obvious reveal is the strongest tactic there is.

In a reveal format, that means every guess plays before the answer, and the answer lands once.

## 7. Emotional resonance

Decide the emotion first. Then screen every word, image and sound against it. Fear and shock drive the most shares. Joy and surprise drive the most saves.

## 8. Rhythm, cadence and flow

Vary sentence length. Short, medium, long. Uniform length reads like a tumble dryer and puts people to sleep.

Online, mostly staccato wins. Short sentences let the brain hear, absorb, file, and get ready for the next one. Run-on sentences force it to delete the oldest thing to make room. Never trade clarity for rhythm, though.

## And one more: energy

Push your energy above your natural baseline. It signals that you actually want to be talking about this. A naturally punchy voice needs less lift. A soft or flat one needs more.

> **Result:** a script checked against these eight reads simpler, lands harder, and holds people past the point where the old version lost them.

## The bottom line

Pop a question, answer it, pop another. Signal value in five seconds. Cut what they don''t need. Say it simply, then say it again with a picture. Build anticipation, pick the emotion, vary the rhythm, and bring more energy than feels natural. That''s retention.', 6, 1);
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-chatcut-ai-l07', 'prog-chatcut-ai', 'Verify like you cannot see or hear it', 'lesson', '/resources/Shubham%20Editor%20Skill.md', 'Five 4K exports were sent back to back to save time. Every job returned a task id and a path. The app showed them complete. The client said they were complete. On disk sat five frozen temp files and zero videos.

A tool reporting success is not evidence. The file is.

In this lesson you''ll learn:

- What counts as proof for picture, for structure and for sound.
- The exports that look crashed but aren''t, and the ones that look done but are empty.
- The sentence to say when you couldn''t check something.

## Proof for picture

Render a frame. That''s the only proof a composition is right.

- Render from the middle of every clip, not a sample, and confirm the speaker is in frame with a readable face.
- Render the first, middle and landing frames of every layout move.
- Render frame 0 of every reel. A default fade from black survived a whole export round once.
- Render the last two or three frames before every cut. A source range that runs a few frames past its subject flashes a different person. Invisible while scrubbing, obvious on playback.

The preview can lag a timeline switch by one step. If a render says it''s showing a different timeline, switch again and retry before concluding anything.

## Proof for structure

- Mirrored tracks: equal clip counts and matching start, duration and source offset per clip. A matching count alone proves nothing.
- Segments that tile a master: the summed duration equals the master''s duration. Report the difference.
- Chapter markers tile the full length with no breaks.
- After any batch update, read one item back. A partial property update can replace the whole object and silently drop the fields you didn''t send. The tool echoes only what you sent, so the loss is invisible until you read.

## Proof for sound

You can''t hear the mix. So measure it.

Export a WAV. Check short-window loudness over speech and over a music-only region. Check the peak and count the samples at full scale. On one job the mix was clipping before any music was added; the dialogue alone was hitting the ceiling, and two exports at different music levels proved it.

> **Pro tip:** never assume the last thing you added caused the problem. Measure, then compare two states.

Then say it plainly: levels were measured, not heard. That''s judgement, not verification, and the client deserves to know which one they''re getting.

## Exports in progress look exactly like crashed ones

A running export writes to a temp file and creates the real file only on completion. Until then the output is zero bytes. So "no output file" is not evidence the render failed.

Before deleting a temp folder or restarting a job, check for a live process and sample the temp file''s size twice a few seconds apart. Getting this wrong is expensive both ways: you can destroy an almost-finished render, or start a duplicate that slows both.

## Export one at a time

Switch to the timeline. Render one frame and confirm the id matches. Export. Wait for the file to exist and stop growing. Read its duration and compare it to the timeline''s length. Only then move to the next reel.

Reels in a batch have different lengths, so a duration mismatch catches a misfiled render in one look. Don''t switch the active timeline while a render is in flight; the exporter follows the preview.

Never delete an old version until its replacement is verified on disk.

## Say what you did not check

If something was only checked in stills and still needs a scrub, say that. If a hard rule is unmet, the work is not done; say which rule. Flagging a gap and calling the job complete in the same breath is the same failure as not flagging it.

> **Result:** one export at a time, duration checked against the timeline, frames rendered at every boundary, the mix measured. Nothing in that list takes long. All of it is faster than the round it prevents.

## The bottom line

Trust the frame, the file and the number. Not the status, not the task id, not the app''s green tick. And when you couldn''t check something, say so in words the client can act on.', 7, 1);
INSERT OR IGNORE INTO course_assignments (id, program_id, title, instructions, rubric, due_days, sequence) VALUES ('prog-chatcut-ai-a01', 'prog-chatcut-ai', 'Write a one-page skill', 'Pick a brand, a format or a channel you edit for. Write a one-page skill for it: the hard rules, the measured numbers (caption size, music under speech, reel length from a real reference), the order of work with a gate after each phase, and three field notes from mistakes you have made or seen.

Then run one edit with ChatCut following it, and update the skill with what the run taught you. Correct superseded rules instead of adding new ones beside them.

Submit the skill as text or a link, and the link to the edit it produced.', 'Rules are specific enough to be checked. Numbers come from measurement, with the source named. Phases end with what was produced and what the next phase depends on. The post-run update replaces old rules rather than stacking them. The edit follows the skill.', 14, 1);
INSERT OR IGNORE INTO cohorts (id, program_id, name, start_at, end_at, capacity, status, manager_user_id, created_at) VALUES ('coh-chatcut-open', 'prog-chatcut-ai', 'Self-paced, open all year', '2026-10-25T00:00:00.000Z', '2027-12-31T00:00:00.000Z', 1000, 'running', NULL, '2026-10-25T00:00:00.000Z');
