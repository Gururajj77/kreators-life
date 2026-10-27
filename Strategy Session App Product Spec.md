# Strategy Session App: Product Spec

Oct 27, 2026 · @Gururaj · Updated the same day: onboarding is built as this session. Section "Onboarding, as built" is the integration spec.

## Why this is an app

A live strategy session is about 25 minutes of fixed script inside an hour of talk. The script is what changes the student, and the script is repeatable. An app runs it the same way for every student, keeps the data, and saves the coach for the moments only a person can handle.

**What a good session does**

- Gives a fixed frame: three life areas (health, wealth, relationships) and the seven relationships.
- Places the student honestly on the consciousness map, one relationship at a time.
- Scores stress, sleep, learning, emotional control and each relationship, out of 10.
- Produces one concrete output: a 5-day-a-week routine and a review rhythm.
- Seals it with an accountability contract that has a stated consequence.

**Where live sessions break, and the app must not**

- **Demo before diagnosis.** Showing every feature before knowing the student overwhelms them.
- **A framework that shifts while it's explained.** Categories that change mid-session leave nothing to build on. The app ships one versioned template.
- **Scores collected but never used.** Every low score either drives an action or is explicitly parked.
- **Insecurities asked last.** Whatever is asked last can't shape the plan. The app asks early.
- **A template routine, not the student's day.** Jumping from a 10:30 wake-up to 8 a.m. on day one fails. The app ramps from the student's real day.
- **Self-report taken at face value.** Students place themselves higher on the map than their behavior shows. The app checks claims with behavior questions.
- **Nothing written down.** If the plan lives in a recording, it doesn't exist. In the app, the plan is the record.

## The session, decomposed

Strip the talk and any strategy session is eight steps a student can walk through alone. Every step either collects a number or produces a commitment.

1. **Frame.** Life = health (physical, mental), wealth (money, time), relationships. Relationships expand to seven: servant-leader (work), friendship, parent-child, lover-partner, self, guru, divine.
2. **Emotional baseline.** Student picks where they usually operate on the consciousness map: Shame 20, Guilt 30, Apathy 50, Grief 75, Fear 100, Desire 125, Anger 150, Pride 175, Courage 200, Neutrality 250, Willingness 310, Acceptance 350, Inner Light 400, Inner Wisdom 440, and on up to 1000. Rule: you must operate from Courage (200) or above.
3. **Fears.** Name the fears that show up (fear of trying new things, of not being accepted) and whether they drive decisions.
4. **Current day.** Wake time, work hours, evening habit, what fills the last hour before sleep.
5. **Scorecard.** Rate out of 10: positive stress, negative stress, emotional state, control over feelings, learning, sleep, nutrition, passive income, spiritual practice, and each of the seven relationships.
6. **Insecurities.** Name them and rate their weight out of 10. Common ones: social awkwardness, looks, relationship inexperience, overthinking.
7. **Design the day.** Two day types (general, exceptional). Template anchors: sleep by 12, 9 to 11 p.m. for learning and reflection, last meal by 8, gym before dinner, a morning block (meditation, breathing, visualization, movement, reading).
8. **Contract.** Six tracked blocks (morning routine, nutrition and water, office work, passive skills, social upskilling, sleep). Five days a week minimum. Daily check-in to the coach. Monthly review. Penalty for misses.

Add-ons assigned at the end: one mantra (Om Namah Shivaya for material path, Hare Krishna for spiritual), 5 to 10 minutes. Affirmations twice a day, on waking and before sleep.

## Status: what is built, what is not

The session is in kreators.app as the onboarding flow at `/session`, self-serve, no coach needed. The build follows this document; where the code decided something this document left open, the section below says so.

| Part of this spec | Status | Where |
| --- | --- | --- |
| Onboarding, steps 1 to 11 | Built | `apps/web/src/screens/Session.tsx`, `apps/api/src/routes/session.ts`, migration `0029_strategy_session.sql` |
| Placement rules, focus rule, score settling, ramp | Built as pure functions with unit tests | `placementFlags`, `pickFocus`, `settleScore`, `rampTime`, `routineFor` in `packages/shared` |
| Daily loop: morning block as ticks, day type, timeline, week dots | Built, under Show up on Daily | `apps/web/src/components/RoutineSection.tsx` |
| Daily check-in reminder at the contract time | Built, sent by the cron | `sendReminders` in `apps/api/src/cron.ts` |
| The seven pyramids for the focus pillars | Built: the session hands its focus to the existing vibe check | `/vibe-check?floors=a,b` |
| The life map: every answer in one place, inside Pillars | Built: the map ladder with all seven placed, the bars, the focus, the scorecard, fears, insecurities, routine, practices and contract; a card on Pillars and a line on each pillar page; run again, keeping last time's map or placing afresh | the `#life-map` section at the bottom of `/tower`; `components/LifeMapPanel.tsx`, `components/LifeMap.tsx` |
| Resume: leaving halfway never restarts | Built: `/onboarding` reads the saved session and sends the person to the right step; the session opens on its saved answers | `apps/web/src/screens/Onboarding.tsx`, `lib/onboarding.ts` |
| Weekly loop: streak against the contract, heatmap, three questions, ramp step, unlocks | Partly: the week's dots and the count against the minimum show on Daily. The Sunday review, the heatmap, the ramp step and focus-tied unlocks are not built | |
| Monthly, quarterly, bi-annual reviews | The generic Reviews app exists (period numbers, prompts, a saved snapshot). The re-run of the map and the radar against day zero are not built | `/reviews` |
| Coach side: roster, exceptions, prep page, template editor, penalty rules, notes | Not built. One template is hardcoded in shared | |
| Live call booking and payment | A note, not a checkout: the last card offers the call and points at Help until a payment provider is live | |
| Module hiding until week one | Not built. Apps keep their own on/off; the session does not gate them | |

The table that used to sit here compared the spec with the coach's demo. It is replaced by the list above; the demo it described is gone.

## The consciousness map and the seven relationships

Onboarding uses this map as its placement screen. Each of the seven relationships is placed on it separately, because a student can live at Acceptance with their parents and at Fear with a partner. One overall placement averages that gap away.

&#91;image: Map of consciousness: levels 20 to 1000 in three categories\]

**How the map lines up with the seven relationships.** The app uses the map's three categories as bands. Health sits inside Self, and work and wealth sit inside Servant-leader, so all nine life areas land on seven rows. In each relationship, the student picks the statement that sounds most like them.

| Relationship | Victim/Abuser (20 to 199) | Self-Empowerment (200 to 399) | Self-Realization (400 and up) |
| --- | --- | --- | --- |
| Self (body, health, mind) | Shame about looks or body, self-attack, numbing out, constant comparison | Keeps promises to self, holds routines through moods, owns mistakes | Self-respect that needs no proof; rest and discipline feel the same |
| Lover-partner | Avoids approaching, or stays from fear of being alone; jealousy, control, neediness | Initiates honestly, states needs, survives rejection without collapse | Loves without keeping score, gives the other person freedom |
| Friendship | Isolates or people-pleases; envy; friends of convenience | Shows up, reaches out first, disagrees honestly | Friendship as service; celebrates others' wins fully |
| Parent-child | Resentment, blame, guilt-driven duty, harshness | Clear boundaries, responsibility, respectful contact | Gratitude and forgiveness; teaches by example, not lectures |
| Servant-leader (work, wealth) | Works from fear of loss, blames the boss, money anxiety drives choices | Owns outcomes, keeps learning, builds income on purpose | Work as service; leads by example; wealth as a tool for others |
| Guru (teacher, mentor, coach) | Rejects all guidance, or depends blindly; shops for validation | Seeks feedback, applies it, stays coachable and critical | Student and teacher at once; passes it on |
| Divine (practice, purpose) | Fear of punishment, bargaining, no practice, or spiritual pride | Regular practice (prayer, mantra, reading), searching for meaning | Surrender and presence; practice is a way of living |

The three bands also match the map's self-identification column: Lower Ego Self (20 to 199), Rational Linear Emotional Self (200 to 399), Higher Self (400 to 539).

**Levels inside a band.** After picking the band, the student narrows to a level by what it sounds like in their own head.

| Level | Name | Sounds like |
| --- | --- | --- |
| 20 | Shame | "I am the problem." |
| 30 | Guilt | "I always mess this up." |
| 50 | Apathy | "What's the point." |
| 75 | Grief | "It's gone and I can't get it back." |
| 100 | Fear | "What if it goes wrong? I'll avoid it." |
| 125 | Desire | "I need this to feel okay." |
| 150 | Anger | "It's their fault." |
| 175 | Pride | "I'm above this." |
| 200 | Courage | "I'm scared and I'm doing it anyway." |
| 250 | Neutrality | "Fine either way." |
| 310 | Willingness | "I'll show up and do the work." |
| 350 | Acceptance | "This is mine to own." |
| 400 | Inner Light | "I can see how this works." |
| 440 | Inner Wisdom | "I know why, and I act from that." |
| 500 | Inner Love | "I act from care, not need." |
| 540 | Oneness | "Your good is my good." |

Levels above 540 (Presence through Full Consciousness) are not offered in self-placement.

**Placement rules**

1. Two placements per relationship: **core** (where you usually live) and **floor** (where you drop under stress).
2. Any floor below Courage (200) makes that relationship a required month-one focus.
3. A gap of more than 150 between floor and core flags the relationship as volatile, with a weekly check.
4. A core of 400 or above needs one evidence answer: "What did you do last week that shows this?" Without one, it is capped at Acceptance (350).
5. Students see level names, never numbers. The map's Hell, Purgatory and Heaven labels stay off student screens.

&#91;embedded content: example placement · 7 relationships\]

An example of one student's output: five relationships hold at Courage or above, and two drop to Fear. Those two become month one.

**What moves a student up the map**

The practice has to match the band the floor sits in, not the level the student wants to reach. A practice built for Inner Light won't lift a floor stuck at Fear.

| Where the floor is | What moves it | What doesn't |
| --- | --- | --- |
| Victim/Abuser (below 200) | Doing the feared thing in small, logged steps, with coach or peer support | Affirmations or mantra alone |
| Self-Empowerment (200 to 399) | Routine held 5 of 7 days, skills, honest feedback, owning outcomes | More insight with no action |
| Self-Realization (400 and up) | Contemplative practice compounds: mantra, meditation, scripture, service | Chasing levels as goals |

**The default six-month path**

1. **Months 1 to 2:** every floor up to Courage (200).
2. **Months 3 to 4:** every core up to Willingness (310).
3. **Months 5 to 6:** focus relationships up to Acceptance (350).

Inner Wisdom (440) and above are not six-month targets. Treating them as targets produces fake wins.

**A caveat on the map.** It builds on David Hawkins' Map of Consciousness. Its numbers can't be measured; Hawkins calibrated them by muscle testing. Use it as a shared language and an order of levels, not a measurement. The product should never show a student a number as though it were a lab result.

## Onboarding, as built: the self-serve strategy session

Onboarding is the strategy call, fully self-serve: eleven cards, one at a time, twenty to thirty minutes, ending in a signed plan. It starts from the Welcome screen after sign-up (`/start`, button "Start the strategy session") and runs at `/session`. A live call with the coach is an optional paid add-on at the end, never a gate. The order is the spec's: emotions and insecurities first, the routine last, so the routine answers what the person said.

**How the flow is built.** One screen (`Session.tsx`) holds a stage machine over the eleven steps. Every card has the step count on top ("Step 4 of 11"), a Close (to the life map for someone already in the app, to Welcome otherwise), Back, and one forward button. Nothing is saved until step 6 ends; steps 1 to 6 are collected on the screen and sent as one assessment, steps 7 to 10 as one plan. On open the screen loads the latest saved session: a half-done run (assessment saved, no contract) jumps to step 7 with its answers; a person running it again finds every answer filled in and a button on the first card to keep last time's map and go straight to the focus. Anyone who leaves is brought back to the right step by `/onboarding`, which every app route redirects to until onboarding is done. Reduced motion is respected. People see level names, never numbers; the map's Hell, Purgatory and Heaven labels never appear.

**Integration contract, in short**

| Step | Card | Input collected | Rule applied | Saved by |
| --- | --- | --- | --- | --- |
| 1 | The frame | nothing | | |
| 2 | The map, seven times | core band, core level, floor band, floor level, evidence | placement rules 1 to 5 | `POST /session/assessment` at step 6 |
| 3 | Fears | text, pillar, drives (yes, sometimes, no) | at most 8 | same |
| 4 | Insecurities | text, weight 0 to 10, pillar | at most 8 | same |
| 5 | Scorecard | 17 sliders, 0 to 10; behaviour days when asked | settle rule | same |
| 6 | Your real day | wake, lights out, work start, work end, gym, evening habit | | `POST /session/assessment` |
| 7 | Your focus | up to two pillars | required floors locked | `POST /session/plan` at step 10 |
| 8 | Your routine | day type to preview | ramp rule | same |
| 9 | Practices | mantra, breathing, line, reading | defaults | same |
| 10 | The contract | min days, check-in time, penalty, typed name | signature required | `POST /session/plan` |
| 11 | The live call | nothing | | hands focus to `/vibe-check` |

### Step 1. The frame

One card. Life is health (body, mind), wealth (money, time) and relationships. Under the seven, the whole map as a ladder: sixteen named levels in three bands, Oneness on top, Shame at the bottom, the Courage line marked, so the span of the map is seen before anything is placed on it. Relationships are seven, listed with their characters: servant leader (work, money, time sit here), friendship, parent and child, lover and partner, with yourself (body, health and mind sit here), guru, divine. No editing. The card ends: "Next you place each one on a map of how you operate, from stuck to at ease. Twice: where you usually live, and where you drop under stress. You see names, never numbers."

### Step 2. The map, one relationship at a time

For each of the seven relationships, in the app's order, four taps and sometimes a line of text:

1. **Core band.** "Where do you usually live with friendship?" Three cards, one per band, each with the band name and that relationship's statement from the relationship table below. The band names on screen are Stuck (20 to 199), Owning it (200 to 399) and At ease (400 to 540).
2. **Core level.** "Which line sounds most like your head there?" The levels inside the picked band, each with its name and its "sounds like" line.
3. **Floor band.** "Under stress, where do you drop to?" The same three cards.
4. **Floor level.** "And what does that sound like?" The levels inside that band.
5. **Evidence**, only when the core level is 400 or over. "What did you do last week that shows this?" A text box, up to 500 characters, with the note that an empty answer holds the placement at Acceptance.

The placement rules run in one shared function, `placementFlags`, on the screen and again on the server:

- A core of 400 or over with fewer than ten characters of evidence is capped at 350 (Acceptance) and marked `capped`.
- A floor is never above the core; it is pulled down to the core if it is.
- A floor under 200 (Courage) marks the pillar `required`: a month-one focus the person cannot unpick.
- A gap of more than 150 between core and floor marks the pillar `volatile`, shown as "a big drop under stress, so a weekly check".

Output, shown at step 7: a bar per relationship from floor to core on a 20 to 540 track with the Courage line marked, labelled "Fear to Willingness", never with numbers, in the relationship's colour.

### Step 3. Fears

"What shows up when you are about to act?" Eight chips to toggle (Trying new things, Being rejected, Being judged, Failing in public, Being alone, Losing money, Letting people down, Being seen) plus a free-text field. Each picked fear becomes a card with two settings: the pillar it pulls down (a select over the seven) and "Does it drive your decisions?" (yes, sometimes, no). At most eight. None is an accepted answer.

### Step 4. Insecurities

"What do you worry people see?" Free text, one at a time. Each becomes a card with a weight slider from 0 to 10 and the pillar it sits in. At most eight. Asked here, before the scorecard and the routine, so the weight can shape the focus in step 7.

### Step 5. Scorecard

Seventeen sliders out of ten under three headings: Health (sleep, food, movement, good stress, bad stress, control over your feelings), Wealth (income, money that comes in without your hours, learning, time that is yours), and the seven relationships. Every slider starts at 5.

When a relationship slider is 8 or more and that relationship's floor from step 2 is under Courage, one behaviour question appears under the sliders: "In the last seven days, how many days did you act from courage with friendship instead of avoiding it?" Answered 0 to 7. The server applies `settleScore`: fewer than four days caps that score at 6. The settled scores are what is saved.

### Step 6. Your real day

Wake up, lights out, work starts, work ends, gym or movement time if any, and what fills the last hour before sleep. Defaults are 08:30, 00:30, 10:00 and 18:30 so the card is never empty. The forward button, "See my focus", sends steps 2 to 6 as one request to `POST /session/assessment`. The server checks that all seven relationships are placed with valid level values, recomputes the flags, settles the scores, stores the assessment and its seven placements, and answers with a suggested focus.

### Step 7. Your focus

The placement chart from step 2 sits on top with the flags written under any bar that has one. Below it, seven chips. The server's suggestion is pre-picked by `pickFocus`: every pillar with a floor under Courage first (lowest floor first); if fewer than two, the lowest cores next, each core lowered by ten times the insecurity weight sitting in that pillar. Required pillars are locked and labelled "(required)". The person can swap the rest. At most two. At least one to go on.

### Step 8. Your routine

A preview of what step 10 will sign, built on the screen by `routineFor` from the real day, with a toggle between a normal day and an exceptional day. Six blocks:

| Block | Normal day | Exceptional day |
| --- | --- | --- |
| Morning routine | from wake-up for one hour: mantra five to ten minutes, three breathing rounds, two minutes of seeing the day go well, ten minutes of movement, one page of reading | twenty minutes: mantra five minutes, one breathing round, five minutes of movement |
| Food and water | to 20:00; water through the day, last meal by eight | same |
| Work | the person's work hours; gym before dinner, at their gym time if they gave one | same |
| People | work end to 21:00; a required floor gets "one small scary thing a day for lover and partner, log it", otherwise one real conversation a day for the focus | same |
| Learning and reflection | 21:00 to 23:00; a lesson, then the journal: mood, stress, where you were on the map today | 22:00 on, the journal only |
| Lights out | the sleep time | same |

The ramp is one pure function, `rampTime`: wake-up and lights-out move thirty minutes earlier for each week the contract was kept, stopping at 06:30 and 23:30. At onboarding the week count is zero, so the routine starts exactly on the person's own day. Nobody moves a 10:30 wake-up to 8 on day one. (Advancing the step after a kept week is not yet automated; see the status table.)

### Step 9. Practices

Mantra: Om Namah Shivaya (the material path), Hare Krishna (the spiritual path), or none yet. Breathing: box, four seven eight, or alternate nostril, each with its pattern written under it. A line to say on waking and before sleep, pre-filled from the focus ("I show up for friendship and guru today, scared or not. Courage first; the rest follows."), editable. One page a morning, from a book, a scripture or an essay the person names.

### Step 10. The contract

Days a week, at least: 3 to 7, default 5. Daily check-in time, default 21:00, with the note that a reminder lands in the inbox at that time on any day not checked in. What a short week costs, one of three: the streak breaks, the next unlock waits, the coach sees it. The next weekly check (the coming Sunday) and the monthly review (thirty days out) are stated. A typed name is required; the forward button is "Sign it".

`POST /session/plan` takes the focus, practices and contract and the person's date. The server adds every required floor to the focus whatever was asked, trims to two, builds both day types with `routineFor`, fills practice defaults, writes the routine and the contract, and writes the check-in time to the person's reminder time. From then on the cron sends one reminder within the hour after that time in the person's zone on any day without a check-in, never twice for one due time.

### Step 11. The optional live call

"Your plan is in. One more thing, optional." A live strategy call with the coach, US$100 or ₹10,000 in India, offered once. Until a payment provider is connected the button opens a note that points at Help to set a time by hand. Skipping it changes nothing. The forward button, "Build my pillars", goes to `/vibe-check?floors=<focus>`: the existing three-tap vibe check runs for the focus pillars only and builds their pyramids; the other five wait on Pillars.

### After the session: the life map under Pillars

The bottom of Pillars keeps everything the session found: the focus pillars (tap one to open it), the placement bars, the map ladder with all seven placed (a full character where it lives, a faded one where it drops), the day-zero scores as three rings (health, wealth, relationships) and a row per item, fears with whether they drive decisions, insecurities with their weight, the routine with its times and practices, and the contract with this week's count. Two buttons: run the session again, and build the pillars for the focus when they are not built yet. On Pillars each pillar card carries its own map line (floor to core, the Courage mark, a Focus tag) under one summary line that jumps to the life map below; before the session, one ink card starts it. Each pillar page carries one line: where it lives, where it drops, what that means.

### After the session: Daily

Daily carries the routine under Show up. The week's seven dots (done, not all steps, nothing yet) and "3 of 7 this week, 5 is the deal". The line to say. The day type toggle. The morning steps as tick rows; `POST /session/day` stores the ticks, and the day is done only when every morning step of that day type is ticked (steps not in the routine are ignored). The day's other blocks as a timeline with their notes. Without a session, one row leads to it. `GET /session?date=` answers the whole state in one call: the assessment with its flagged placements, the routine, the contract, today's ticks and the week.

**What onboarding must not do:** show events, campaigns, cohorts, or clubs. The session shows none. Hiding them elsewhere until week one is not built; the apps keep their own on and off.

## Daily loop

*Status: the morning block, the day type, the timeline and the week count are built on Daily (see above). The guided player with minutes per step, the waking and lights-out buttons, and the evening ladder tap are not.*

The day is two check-ins and one timeline, under 3 minutes of input total. The coach needs one thing daily: was the morning routine done, 100% or not.

| When | What the student sees | What it records |
| --- | --- | --- |
| On waking | Affirmation on screen, read aloud. Today's day type: general or exceptional | Wake time, affirmation done |
| Morning block | Guided player: mantra 5 to 10 min, three breathing techniques, visualization, 10 min movement, one page of reading | Each step done or skipped, minutes |
| Through the day | Timeline of blocks with nudges: water, last meal by 8, gym before dinner | Ticks per block |
| 9 to 11 p.m. | Learning and reflection: journal prompt tied to today's focus, mood, stress, emotional ladder tap | Journal, mood, ladder level |
| Before sleep | Evening affirmation. "Lights out" button | Sleep time |

One completion rule per day: the morning routine counts as done only if every step is ticked. Points come from the existing task system. The coach's dashboard gets a green, amber or red dot per student by 11 a.m.

## Weekly loop

*Status: the streak against the minimum shows on Daily. The Sunday review, the heatmap, the ramp proposal and the unlocks are not built; the data for them is in `routine_days`.*

The week is where the contract lives: five days or a flag. Sunday night is a 5 minute review, not a session.

- **Streak check.** Days the morning routine was fully done, out of 7. Below the minimum (default 5) triggers the penalty flow and a note to the coach.
- **Block heatmap.** Seven days by seven blocks. Shows which block breaks first.
- **Three questions.** What went well? What broke, and when in the day? What changes next week?
- **Routine ramp.** If the student hit the minimum, the app proposes the next step of the ramp (wake 30 minutes earlier, add one morning step). The student accepts or holds.
- **One relationship task.** Pick one of the seven relationships and add one task in its pyramid for next week.
- **Unlocks.** After week one, the modules tied to the student's focus open (clubs and events for social upskilling, cohorts for passive skills).

## Monthly review

*Status: not built as a flow. The Reviews app covers the period numbers and prompts; the re-run of the map and the radar against day zero would be a second assessment of kind `monthly` in the same tables.*

The monthly review is a 15 minute guided flow the student runs alone, or before a booked live call. The student arrives with data, so the call is spent on decisions, not recall.

- **Re-run the scorecard.** Same sliders and the same map placement as onboarding. Radar chart shows day zero against now.
- **Adherence summary.** Days per week across the four weeks, by block. Penalties triggered.
- **Emotional ladder trend.** Daily ladder taps as a line over the month. Is the student holding courage or above?
- **Insecurity re-rate.** Each insecurity from onboarding, re-weighted out of 10, with one line on what changed.
- **Routine edits.** Propose changes to block times, day types, or practices. The coach approves, async or in a booked call.
- **Next month's focus.** Keep the two focus areas or swap one.
- **Coach call agenda.** Auto-built from the three biggest moves (up or down) and any red weeks.

## Quarterly review

*Status: not built. Cut from v1.*

The quarter is where the relationship pyramids get rebuilt. Routines prove themselves in a month; relationships need three.

- **Pyramid audit, all seven relationships.** For each: is the foundation still true? Which goal outcomes were hit? Which projects stalled? Archive dead tasks.
- **Area balance.** Health, wealth, relationships as three bars. The weakest one becomes a named quarter goal.
- **Day-type review.** How many exceptional days happened? If more than one in four, the general day is the wrong design.
- **Practice check.** Is the mantra still the right one (material path or spiritual path)? Keep or switch.
- **Wealth line.** A low wealth score is easy to log and ignore. The quarter forces one wealth goal with a project and tasks, or an explicit "not this quarter".
- **Coach session.** Longer, 45 to 60 minutes, sets three quarter goals.

## Bi-annual review

*Status: not built. Cut from v1.*

Six months is the full re-run of the strategy session. The student is not the person who onboarded, so the plan should not be either.

- **Full onboarding again,** steps 2 to 7, with day-zero answers shown beside each question.
- **Identity statement.** The student writes one: who am I becoming? It sits on the home screen for the next six months.
- **Before and after report.** Radar at day zero, month 3, month 6. Ladder trend. Insecurity weights. Routine adherence. Exportable as a PDF the student keeps.
- **Program decision.** Continue, change coach tier, or graduate to self-run mode with no daily check-in to the coach.
- **Testimonial prompt.** Only if scores improved. This is the coach's content engine, and the data makes it honest.

## Coach side

*Status: not built. The template is hardcoded in shared; the penalty is chosen by the student from three fixed options.*

The coach's job shrinks from running every session to reviewing exceptions. One coach can then hold 50 students instead of 10.

- **Roster.** Each student with today's dot (green, amber, red), streak, current focus, days to next review.
- **Exceptions inbox.** Only what needs a human: baseline below courage, a missed week, a new insecurity above 7/10, a journal entry the student flagged for the coach.
- **Session prep.** One page per student before any call: score deltas, adherence, auto-built agenda.
- **Template editor.** The coach edits the framework once (ladder bands, scorecard items, default routine, mantra options, affirmation text). Every new student gets it. This stops the drift of a live explanation, where categories change mid-sentence.
- **Penalty rules.** Configurable: what a miss costs (a delayed unlock or a broken streak), how many misses before it applies, a grace period for month one.
- **Private notes.** Never visible to the student. Bookings: the coach sets weekly slots and sees each paid call with its prep page attached.

## Pricing: self-serve, with an optional live call

*Status: the offer is on the last card; booking and payment wait for the payment provider.*

The app is the program; the live call is a paid add-on at US$100 or ₹10,000. A student can complete onboarding, the daily loop and every review without ever speaking to the coach.

| Buyer | Live call price | Charged in |
| --- | --- | --- |
| India | ₹10,000 | INR (UPI, cards) |
| Everywhere else | US$100 | USD (cards) |

**Where the call is offered**

- End of onboarding (step 11), once.
- On the monthly, quarterly and bi-annual review screens: "go through this with the coach", with the prep page attached.
- After two red weeks in a row. An offer, never a push notification.

**How a booking works**

1. The student picks a slot from the coach's availability, shown in the student's timezone.
2. Currency is set by the card's billing country, not by IP or a dropdown, so the parity price can't be gamed.
3. The coach gets the prep page: map placement, scorecard, insecurities, adherence, the student's own questions.
4. After the call, the coach edits the plan in the app. Changes are tagged "from your live call".

**Is ₹10,000 actually parity?** No. At about ₹96.5 per dollar (mid-market, July 2026, [Pluang](https://pluang.com/en/tools/currency-converter/usd-inr)), US$100 is about ₹9,650. So ₹10,000 is a straight currency conversion, slightly rounded up. Purchasing-power parity for India is roughly ₹20 to ₹22 per international dollar (approximate, from memory of World Bank figures), which would put the call near ₹2,000 to ₹2,500. Pick one and name it honestly:

- **Same real price everywhere:** keep ₹10,000 and call it local-currency pricing.
- **True parity:** about ₹2,500 in India. More Indian students can buy, at a quarter of the revenue per call.

**Policies to set before the first booking**

- [ ] Reschedule and no-show rule
- [ ] Refund window
- [ ] Is ₹10,000 inclusive of GST?
- [ ] Call length

## Data model, as built

Migration `0029_strategy_session.sql`. Every row is owned by a user id and read only by its owner. Streaks are derived from `routine_days` at read time; no counter is stored.

| Table | Key fields | Notes |
| --- | --- | --- |
| `assessments` | id, user_id, kind, fears_json, insecurities_json, scores_json, real_day_json, focus_json, created_at | One per run. Kind is `onboard` today; a monthly or bi-annual re-run is the same shape with another kind, so diffs are free |
| `placements` | id, assessment_id, user_id, relationship, core_level, floor_level, core_band, floor_band, evidence, created_at | Seven per assessment, unique per relationship. Flags are recomputed by `placementFlags` on read, never stored |
| `routines` | id, user_id, assessment_id, ramp_step, general_json, exceptional_json, practices_json, created_at | A new row per change, never edited in place |
| `contracts` | id, user_id, assessment_id, min_days, checkin_time, penalty, next_weekly, next_monthly, signed_name, signed_at | The check-in time is copied to `users.reminder_time` |
| `routine_days` | user_id, day, day_type, steps_json, done, updated_at | One row per person per local day; done only when every morning step is ticked |
| pyramid nodes | `nodes` | Already existed; the vibe check builds them for the focus pillars |

Not yet in the model: a versioned template (one is hardcoded in shared), coach, booking, and the append-only event log the spec proposed. `routine_days` carries what the daily and weekly loops need.

**Build notes that held**

- Streaks and adherence are derived at read time.
- The ramp is a pure function with tests.
- The reminder is one cron every fifteen minutes that queries due people by their own timezone, not a job per person.
- Journal text stays out of the session and out of any model call.

**Build notes still open**

- Offline-first for the morning player. The ticks post straight to the server today.

## Risks, open questions, and the v1 cut

The biggest risk is building the whole map before one student completes a month. v1 is onboarding, the daily loop, the weekly check, and the coach roster. Nothing else.

**Cut from v1:** quarterly and bi-annual flows (run them by hand for the first cohort), campaigns, clubs, events, cohorts, the PDF report, the template editor (hardcode one template).

**Risks**

- **Self-reported scores inflate.** A student can rate emotional state 8/10 and control over feelings 6/10 in the same sitting. Ask behavior questions ("how many nights this week did you sleep after 1?") next to every slider.
- **Penalties drive lying, not effort.** If a miss costs a coaching week, students will tick boxes they did not do. Consider rewarding honest reporting of a bad week. Also, "lose a coaching week" means nothing to a self-serve student who never booked one. The penalty needs a new lever: a delayed unlock, a broken streak, or a miss shown on the coach roster. *As built, the student picks one of exactly those three at step 10; none of them is enforced yet.*
- **Self-serve hides the moment that sold coaching.** In a live session, trust comes from a person reading the student back to themselves. A form does not do that by default. The placement chart and prep page have to do it, or the US$100 call will feel like a cost and not a next step.
- **Sensitive data.** Insecurities, relationship history, spiritual practice. This needs a privacy stance before the first paying student.

**Open questions**

- [x] Is this a module inside kreators.app or a separate app? Decided: inside kreators.app, as its onboarding.
- [ ] Who owns the framework, the coach or the platform? It decides whether other coaches can bring their own template.
- [ ] How many students does the coach have today, and how many does he want? That sets whether the roster or the onboarding is the first build.
- [ ] Does the ramp logic need coach approval, or can the app move a student's wake time on its own? (The function is ready; nothing calls it with a week count above zero yet.)
