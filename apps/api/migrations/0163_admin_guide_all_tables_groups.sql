-- 0163: Admin guide lessons 10, 11, 18, 20, 21 and 23 brought up to their files after All tables took in every record of a person's own
-- use of the app (2026-11-14, the founder: "ok, add them", then "put them in toggles based on categories in every place they occur"): a
-- member's tables never list one that holds other people's details (buyers, guests, clients, chats, Agency, Discover, the Companion), which
-- reach only the person and AI chat on a model that keeps nothing, never a coach; Discover's tables need its own assistant switch too; a
-- member's tables sit in the Apps page's groups and show only while their app is on. Every lesson keeps its place.
-- Made with: node scripts/admin-guide/build.mjs --sync <this file> --only 10,11,18,20,21,23. Safe to run again.
UPDATE learning_items SET sequence = 1 WHERE id = 'prog-admin-guide-l01' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 2 WHERE id = 'prog-admin-guide-l02' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 3 WHERE id = 'prog-admin-guide-l03' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 4 WHERE id = 'prog-admin-guide-l24' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 5 WHERE id = 'prog-admin-guide-l04' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 6 WHERE id = 'prog-admin-guide-l05' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 7 WHERE id = 'prog-admin-guide-l06' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 8 WHERE id = 'prog-admin-guide-l07' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 9 WHERE id = 'prog-admin-guide-l25' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 10 WHERE id = 'prog-admin-guide-l08' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 11 WHERE id = 'prog-admin-guide-l09' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET module_title = 'Discover: the quiz and its add-ons', body = 'Riya knows she is good at editing. She is less sure why some weeks she finishes everything and other weeks she starts five things and ends none. Discover is a quiz on how she thinks, feels and acts. It shows her strengths across the seven relationships, and it never compares her with anyone else.

In this lesson you''ll learn:

- How Riya takes the main quiz, part by part.
- How she reads her result and decides what it may shape.
- How the add-ons work, from 16 personality types to Human design and numerology.
- What an admin can see, and what stays with Riya.

## Find it

Discover starts hidden on a new account, unless the setup chat showed it for her. Riya can find it in two ways:

- **From Apps:** she opens the **Reflection** group, opens **Hidden apps** at its end and taps the eye beside **Discover**.
- **From the setup chat:** its last step offers **Take the Discover quiz**, which shows the app first.

## Step by step: the main quiz

1. Riya opens **Discover**. A sky blue card says "Find out what you are good at".
2. She taps **Start the quiz**. The quiz has five short parts and saves as she goes, so she can stop and come back.
3. **Priorities and preferences:** three statements at a time. She picks the one most like her and the one least like her.
4. **Puzzles, part 1:** pictures to solve. They get harder when she does well and easier when she does not. There is no time limit.
5. **You, in words:** ten words at a time. She picks three most like her and three least like her.
6. **Puzzles, part 2:** more puzzles that keep adjusting to her.
7. **Real situations:** she picks the most and the least effective way to handle each case.
8. She moves with **Back** and **Next**.

After the five parts, a card says "Your strengths are ready". She can tap **Add emotional intelligence**, tap **See my strengths now**, or tap **Go back**.

The emotional intelligence add-on has three more parts: Your feelings, Reading people and With people. It counts only when all of it is answered.

## Reading the result

The result opens with tabs:

- **Strengths:** her top three of seven, such as Getting it done, Connecting or Learning, plus her quietest strength and a link to its pillar.
- **Personality:** her five traits (Curiosity, Follow-through, Energy with people, Warmth and Calm) with what each means for her.
- **Reasoning:** the level her puzzles settled at. It says plainly that this is not an IQ score.
- **Emotional intelligence:** only if she took it.
- **16 types, love, mind:** the add-ons.
- **Use my results:** her switches.

At the foot she can tap **Take it again** or **Delete this result**. Delete asks first and is final.

## Use my results

1. Riya opens **Use my results**, under **Let your results help**.
2. **Shape my next steps** is on to start. Home''s daily brief then picks steps that fit her. It is plain rules, no AI.
3. **Let the assistant learn from them** is off until she turns it on. Only a model that keeps no data can read the short summary.
4. **Include how my mind works** is off until she turns it on. It never names a condition.

## The add-ons

Under **More ways to know yourself**, four self-checks sit as cards. Each says Not taken yet, how far she got, or when she took it. Its button reads **Start**, **Carry on** or **See my result**.

- **16 personality types:** a free check in the style of the Myers-Briggs test, not the official one. Twenty-four lines give a four-letter type.
- **Love languages:** twenty choices between two lines. Ten on how she likes to be shown love, ten on how she shows it. The gap is said plainly.
- **How your mind works:** twenty-four lines on attention, energy and impulse, and patterns and senses. It is never a diagnosis, and says so.
- **Human design:** a form, explained below.

## Step by step: Human design and numerology

1. Riya opens the **Human design** card.
2. She fills **Birth date**, **Birth time** and the **Time zone of the place you were born**, such as Kolkata.
3. For numerology she can add her **Full name on your birth record**. It is optional.
4. She taps **Work out my chart**.
5. She picks the zodiac: **Tropical** or **Sidereal (Fagan-Bradley)**. The sidereal reading is marked as an experiment.
6. She picks a layer: **3D · Body and day**, **5D · Mind and people**, **7D · Purpose** or **Numerology**.
7. Under **Goals you can do and count**, she taps **Add as a task**. It lands under that pillar''s project, in Not scheduled yet on Daily.

Human design and numerology are shown as systems for reflection, not science. They never predict.

> **Pro tip:** tell people to take the main quiz first. Numerology then compares its numbers with their own Discover answers, instead of only offering an invitation.

> **Result:** Riya knows her top strengths, why she starts many things, and has one small task from her chart waiting on Daily.

## What the admin checks

- **Owner only:** Discover answers and results are like the journal. They are never shown to brands, staff, the leaderboard or a coach.
- **The assistant:** it sees only a short profile, and only while the person''s switch is on.
- **Its tables:** in **All tables**, results and add-ons are tables only the person and AI chat read, never a coach or staff. AI chat reads them only while that switch and **Show to AI chat** are both on, on a model that keeps nothing.
- **Birth details:** they stay on the person''s own table. Only type, strategy, authority and profile can reach the assistant or next steps.
- **Dev Tools:** it counts each add-on finished and how many switched how your mind works on. Counts only, no names or answers.
- **Switches:** in Admin, **Flags**, the Discover row sets On, Minimum role, Rollout % and Overrides. In **People**, **What does this person see?** sets it for one person.
- **Data:** the answers are in the person''s export and go with erase and delete.

If someone asks whether their score is good or bad, the answer is that Discover has no pass mark. It only shows what they lean on most.

## The bottom line

Discover helps people see their own strengths in plain words. Teach them to finish the five parts, then decide what the result may shape. As an admin, keep it switched on, and never ask anyone to share what it found.', sequence = 12 WHERE id = 'prog-admin-guide-l10' AND program_id = 'prog-admin-guide';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-admin-guide-l10', 'prog-admin-guide', 'Discover: the quiz and its add-ons', 'lesson', NULL, 'Riya knows she is good at editing. She is less sure why some weeks she finishes everything and other weeks she starts five things and ends none. Discover is a quiz on how she thinks, feels and acts. It shows her strengths across the seven relationships, and it never compares her with anyone else.

In this lesson you''ll learn:

- How Riya takes the main quiz, part by part.
- How she reads her result and decides what it may shape.
- How the add-ons work, from 16 personality types to Human design and numerology.
- What an admin can see, and what stays with Riya.

## Find it

Discover starts hidden on a new account, unless the setup chat showed it for her. Riya can find it in two ways:

- **From Apps:** she opens the **Reflection** group, opens **Hidden apps** at its end and taps the eye beside **Discover**.
- **From the setup chat:** its last step offers **Take the Discover quiz**, which shows the app first.

## Step by step: the main quiz

1. Riya opens **Discover**. A sky blue card says "Find out what you are good at".
2. She taps **Start the quiz**. The quiz has five short parts and saves as she goes, so she can stop and come back.
3. **Priorities and preferences:** three statements at a time. She picks the one most like her and the one least like her.
4. **Puzzles, part 1:** pictures to solve. They get harder when she does well and easier when she does not. There is no time limit.
5. **You, in words:** ten words at a time. She picks three most like her and three least like her.
6. **Puzzles, part 2:** more puzzles that keep adjusting to her.
7. **Real situations:** she picks the most and the least effective way to handle each case.
8. She moves with **Back** and **Next**.

After the five parts, a card says "Your strengths are ready". She can tap **Add emotional intelligence**, tap **See my strengths now**, or tap **Go back**.

The emotional intelligence add-on has three more parts: Your feelings, Reading people and With people. It counts only when all of it is answered.

## Reading the result

The result opens with tabs:

- **Strengths:** her top three of seven, such as Getting it done, Connecting or Learning, plus her quietest strength and a link to its pillar.
- **Personality:** her five traits (Curiosity, Follow-through, Energy with people, Warmth and Calm) with what each means for her.
- **Reasoning:** the level her puzzles settled at. It says plainly that this is not an IQ score.
- **Emotional intelligence:** only if she took it.
- **16 types, love, mind:** the add-ons.
- **Use my results:** her switches.

At the foot she can tap **Take it again** or **Delete this result**. Delete asks first and is final.

## Use my results

1. Riya opens **Use my results**, under **Let your results help**.
2. **Shape my next steps** is on to start. Home''s daily brief then picks steps that fit her. It is plain rules, no AI.
3. **Let the assistant learn from them** is off until she turns it on. Only a model that keeps no data can read the short summary.
4. **Include how my mind works** is off until she turns it on. It never names a condition.

## The add-ons

Under **More ways to know yourself**, four self-checks sit as cards. Each says Not taken yet, how far she got, or when she took it. Its button reads **Start**, **Carry on** or **See my result**.

- **16 personality types:** a free check in the style of the Myers-Briggs test, not the official one. Twenty-four lines give a four-letter type.
- **Love languages:** twenty choices between two lines. Ten on how she likes to be shown love, ten on how she shows it. The gap is said plainly.
- **How your mind works:** twenty-four lines on attention, energy and impulse, and patterns and senses. It is never a diagnosis, and says so.
- **Human design:** a form, explained below.

## Step by step: Human design and numerology

1. Riya opens the **Human design** card.
2. She fills **Birth date**, **Birth time** and the **Time zone of the place you were born**, such as Kolkata.
3. For numerology she can add her **Full name on your birth record**. It is optional.
4. She taps **Work out my chart**.
5. She picks the zodiac: **Tropical** or **Sidereal (Fagan-Bradley)**. The sidereal reading is marked as an experiment.
6. She picks a layer: **3D · Body and day**, **5D · Mind and people**, **7D · Purpose** or **Numerology**.
7. Under **Goals you can do and count**, she taps **Add as a task**. It lands under that pillar''s project, in Not scheduled yet on Daily.

Human design and numerology are shown as systems for reflection, not science. They never predict.

> **Pro tip:** tell people to take the main quiz first. Numerology then compares its numbers with their own Discover answers, instead of only offering an invitation.

> **Result:** Riya knows her top strengths, why she starts many things, and has one small task from her chart waiting on Daily.

## What the admin checks

- **Owner only:** Discover answers and results are like the journal. They are never shown to brands, staff, the leaderboard or a coach.
- **The assistant:** it sees only a short profile, and only while the person''s switch is on.
- **Its tables:** in **All tables**, results and add-ons are tables only the person and AI chat read, never a coach or staff. AI chat reads them only while that switch and **Show to AI chat** are both on, on a model that keeps nothing.
- **Birth details:** they stay on the person''s own table. Only type, strategy, authority and profile can reach the assistant or next steps.
- **Dev Tools:** it counts each add-on finished and how many switched how your mind works on. Counts only, no names or answers.
- **Switches:** in Admin, **Flags**, the Discover row sets On, Minimum role, Rollout % and Overrides. In **People**, **What does this person see?** sets it for one person.
- **Data:** the answers are in the person''s export and go with erase and delete.

If someone asks whether their score is good or bad, the answer is that Discover has no pass mark. It only shows what they lean on most.

## The bottom line

Discover helps people see their own strengths in plain words. Teach them to finish the five parts, then decide what the result may shape. As an admin, keep it switched on, and never ask anyone to share what it found.', 12, 1);
UPDATE learning_items SET module_title = 'Companion, Coaching and Emerging', body = 'Some days Riya wants to talk a day through. Some months she wants a real person to keep her on track. And sometimes she wants to know what her own logs are telling her. Three parts of the app cover this: the Companion, Coaching and Emerging.

In this lesson you''ll learn:

- How Riya chats with the Companion, and when it uses credits.
- How she finds a life coach and picks what the coach sees.
- How Emerging shows her patterns, including good and bad habits.
- What an admin does for each.

## The Companion

The Companion is a chat that knows how her day is going. It is not a therapist, and not for emergencies. It starts hidden, so Riya unhides it under **Apps**, in the **Reflection** group.

1. Riya opens **Companion**. The hero shows her check-in streak.
2. With no lines yet, she can tap a starter, such as "I feel tired today" or "I am stressed about work".
3. Or she types in **Say what is on your mind** and sends it.
4. While it answers, she can tap the stop square.
5. To clear the chat, she taps the trash button. A sheet asks "Clear this conversation?" and says it cannot be undone.

Each reply says who answered. With a plan, credits and room in the day''s cap, a model answers and she can pick it. Without a plan, or when credits or the day''s cap run out, the built-in companion answers for free. It never shows a paywall.

If her words show she may be in danger, it tells her to call the local emergency number, go to the nearest hospital, or call Tele-MANAS on 14416 in India.

## Coaching: finding a life coach

Coaching starts hidden too. Riya unhides it in the **Reflection** group.

1. Riya opens **Coaching** and scrolls to **Find a life coach**. It lists coaches the team chose who are taking new students.
2. She taps **Ask to be coached** on one. The coach says yes or no.
3. Once the coach says yes, her coach shows under **Your life coach**, here and on her **Profile** tab.
4. Under **What they see**, she picks from six switches: Daily and streaks, Pillars and pyramids, Routine and contract, Life map answers, Reflection and Patterns. Patterns is on for a link she says yes to, and off on older links.
5. She can tap **End coaching** at any time. A sheet asks first.

A coach can also ask her, by email, @username or friend code. She then taps **Say yes** or **Say no**. She can have up to three coaches. After a no, the same coach can ask again in thirty days.

The six switches never show her journal, gratitude, a tracker''s note, her money, water, supplements, the Companion or a review''s snapshot. She can also switch on whole tables for one coach under **Tables your coach can see**, or with **Show to my coach** at the top of a table, each off until she turns it on. The coach reads them from a **Tables** link on her page and can never change them. A table that holds other people''s details, such as her buyers, guests, clients or chats, is never offered to a coach, and neither are her Discover and Companion tables. A review''s snapshot is never a table. With Pillars and pyramids on, a coach can add and edit tasks under her projects. Those tasks wear the tag From your coach. A coach never ticks or removes them.

**Notes from your coach** lists every note, and each one lands in her inbox. The **Change log** shows every ask, yes, note and task change, with the time.

## Becoming a coach

If Riya coaches other editors, she can ask under **Are you a life coach?** She writes who she coaches and taps **Ask the team**. She can also say "I''m a life coach" in the setup chat.

Once she is one, she adds a student by @username, friend code or email, or shares her invite link, and each one must say yes. Each student has a report by day, week, month or quarter. **Show on this page** folds away what she does not need. Suggestions fill a note or a task, and nothing goes until she sends it.

## Emerging: patterns in her own logs

Emerging reads across the apps Riya uses and finds things that happen together. It never says one thing causes another. There is nothing to switch on.

1. On Home, under **Emerging**, Riya sees her top patterns, or one quiet line while nothing is ready. She taps **See all**.
2. At the top of the **Emerging** page she can pick a day, a week, a month, a quarter, a half year or a year. With none picked, it stays on the last 8 weeks.
3. **Your life** shows that period: the five areas of life, then the seven pillars, each next to the period before.
4. Two counts follow, Patterns found and Still watching.
5. **What stands out** lists patterns by area of life, strongest first.
6. **Good and bad habits** compares the days she ticked a task with the days she did not, using mood, sleep, stress, tasks and focus.
7. **Still watching** says what each pattern still needs.

Each card has a number, a tag, one sentence, a small chart and one action:

- **Good habit:** her "Evening walk" goes with better mood. She taps **Make it a habit**, checks the repeat, the first day and the time, then taps **Keep**.
- **Bad habit:** a habit that goes with worse days. She taps **Add to not to do** to put it on her not to do list.
- **More:** **Not now** hides a card on this device. **Show again** brings it back.

On Daily, a **Habits** section sits under Not to do with her good and bad habits.

> **Pro tip:** a habit needs a task ticked on at least three days in eight weeks, and at least five days with it and seven without, before it can be called good or bad. Tell people to keep logging mood and sleep. Emerging can only compare what they log.

> **Result:** Riya talks her day through, has a coach who sees only what she allows, and knows which habits lift her days.

## What the admin checks

- **Companion plans:** in Admin, **People**, the Plan column starts or ends a plan, and the Credits column shows what is left. Plans are only started by an admin until payments go live.
- **Life coaches:** in Admin, **Life coaches**, the table **Asked to be a life coach** lists asks. Tick rows and tap **Make life coach**, or **Say no**. The person is told.
- **Taking the badge:** in the **Life coaches** table, **Take the badge** ends every link that coach has, and their students are told. It asks first.
- **Linking:** open **Connect people** in Admin, pick **Life coach and student**, enter both and choose **Ask them** or **Link now**. Use Link now only if the student already agreed.
- **Emerging:** it is computed when read and stored nowhere. No staff screen shows it. It reaches a coach only through the student''s own Patterns switch, and never the assistant or the leaderboard.
- **Switches:** in Admin, **Flags**, the Companion and Coaching rows set On, Minimum role, Rollout % and Overrides.

## The bottom line

The Companion listens, a coach guides, and Emerging shows what Riya''s days already say. As an admin, choose coaches with care, keep plans and credits honest, and leave the patterns to the person they belong to.', sequence = 13 WHERE id = 'prog-admin-guide-l11' AND program_id = 'prog-admin-guide';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-admin-guide-l11', 'prog-admin-guide', 'Companion, Coaching and Emerging', 'lesson', NULL, 'Some days Riya wants to talk a day through. Some months she wants a real person to keep her on track. And sometimes she wants to know what her own logs are telling her. Three parts of the app cover this: the Companion, Coaching and Emerging.

In this lesson you''ll learn:

- How Riya chats with the Companion, and when it uses credits.
- How she finds a life coach and picks what the coach sees.
- How Emerging shows her patterns, including good and bad habits.
- What an admin does for each.

## The Companion

The Companion is a chat that knows how her day is going. It is not a therapist, and not for emergencies. It starts hidden, so Riya unhides it under **Apps**, in the **Reflection** group.

1. Riya opens **Companion**. The hero shows her check-in streak.
2. With no lines yet, she can tap a starter, such as "I feel tired today" or "I am stressed about work".
3. Or she types in **Say what is on your mind** and sends it.
4. While it answers, she can tap the stop square.
5. To clear the chat, she taps the trash button. A sheet asks "Clear this conversation?" and says it cannot be undone.

Each reply says who answered. With a plan, credits and room in the day''s cap, a model answers and she can pick it. Without a plan, or when credits or the day''s cap run out, the built-in companion answers for free. It never shows a paywall.

If her words show she may be in danger, it tells her to call the local emergency number, go to the nearest hospital, or call Tele-MANAS on 14416 in India.

## Coaching: finding a life coach

Coaching starts hidden too. Riya unhides it in the **Reflection** group.

1. Riya opens **Coaching** and scrolls to **Find a life coach**. It lists coaches the team chose who are taking new students.
2. She taps **Ask to be coached** on one. The coach says yes or no.
3. Once the coach says yes, her coach shows under **Your life coach**, here and on her **Profile** tab.
4. Under **What they see**, she picks from six switches: Daily and streaks, Pillars and pyramids, Routine and contract, Life map answers, Reflection and Patterns. Patterns is on for a link she says yes to, and off on older links.
5. She can tap **End coaching** at any time. A sheet asks first.

A coach can also ask her, by email, @username or friend code. She then taps **Say yes** or **Say no**. She can have up to three coaches. After a no, the same coach can ask again in thirty days.

The six switches never show her journal, gratitude, a tracker''s note, her money, water, supplements, the Companion or a review''s snapshot. She can also switch on whole tables for one coach under **Tables your coach can see**, or with **Show to my coach** at the top of a table, each off until she turns it on. The coach reads them from a **Tables** link on her page and can never change them. A table that holds other people''s details, such as her buyers, guests, clients or chats, is never offered to a coach, and neither are her Discover and Companion tables. A review''s snapshot is never a table. With Pillars and pyramids on, a coach can add and edit tasks under her projects. Those tasks wear the tag From your coach. A coach never ticks or removes them.

**Notes from your coach** lists every note, and each one lands in her inbox. The **Change log** shows every ask, yes, note and task change, with the time.

## Becoming a coach

If Riya coaches other editors, she can ask under **Are you a life coach?** She writes who she coaches and taps **Ask the team**. She can also say "I''m a life coach" in the setup chat.

Once she is one, she adds a student by @username, friend code or email, or shares her invite link, and each one must say yes. Each student has a report by day, week, month or quarter. **Show on this page** folds away what she does not need. Suggestions fill a note or a task, and nothing goes until she sends it.

## Emerging: patterns in her own logs

Emerging reads across the apps Riya uses and finds things that happen together. It never says one thing causes another. There is nothing to switch on.

1. On Home, under **Emerging**, Riya sees her top patterns, or one quiet line while nothing is ready. She taps **See all**.
2. At the top of the **Emerging** page she can pick a day, a week, a month, a quarter, a half year or a year. With none picked, it stays on the last 8 weeks.
3. **Your life** shows that period: the five areas of life, then the seven pillars, each next to the period before.
4. Two counts follow, Patterns found and Still watching.
5. **What stands out** lists patterns by area of life, strongest first.
6. **Good and bad habits** compares the days she ticked a task with the days she did not, using mood, sleep, stress, tasks and focus.
7. **Still watching** says what each pattern still needs.

Each card has a number, a tag, one sentence, a small chart and one action:

- **Good habit:** her "Evening walk" goes with better mood. She taps **Make it a habit**, checks the repeat, the first day and the time, then taps **Keep**.
- **Bad habit:** a habit that goes with worse days. She taps **Add to not to do** to put it on her not to do list.
- **More:** **Not now** hides a card on this device. **Show again** brings it back.

On Daily, a **Habits** section sits under Not to do with her good and bad habits.

> **Pro tip:** a habit needs a task ticked on at least three days in eight weeks, and at least five days with it and seven without, before it can be called good or bad. Tell people to keep logging mood and sleep. Emerging can only compare what they log.

> **Result:** Riya talks her day through, has a coach who sees only what she allows, and knows which habits lift her days.

## What the admin checks

- **Companion plans:** in Admin, **People**, the Plan column starts or ends a plan, and the Credits column shows what is left. Plans are only started by an admin until payments go live.
- **Life coaches:** in Admin, **Life coaches**, the table **Asked to be a life coach** lists asks. Tick rows and tap **Make life coach**, or **Say no**. The person is told.
- **Taking the badge:** in the **Life coaches** table, **Take the badge** ends every link that coach has, and their students are told. It asks first.
- **Linking:** open **Connect people** in Admin, pick **Life coach and student**, enter both and choose **Ask them** or **Link now**. Use Link now only if the student already agreed.
- **Emerging:** it is computed when read and stored nowhere. No staff screen shows it. It reaches a coach only through the student''s own Patterns switch, and never the assistant or the leaderboard.
- **Switches:** in Admin, **Flags**, the Companion and Coaching rows set On, Minimum role, Rollout % and Overrides.

## The bottom line

The Companion listens, a coach guides, and Emerging shows what Riya''s days already say. As an admin, choose coaches with care, keep plans and credits honest, and leave the patterns to the person they belong to.', 13, 1);
UPDATE learning_items SET sequence = 14 WHERE id = 'prog-admin-guide-l12' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 15 WHERE id = 'prog-admin-guide-l13' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 16 WHERE id = 'prog-admin-guide-l14' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 17 WHERE id = 'prog-admin-guide-l15' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 18 WHERE id = 'prog-admin-guide-l16' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 19 WHERE id = 'prog-admin-guide-l17' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET module_title = 'Agency: clients, pipeline and paperwork', body = 'Riya edits videos in Pune. She makes her own content, and brands pay her to make videos too. Her clients lived in chats and a folder of invoices. Agency puts them in one place.

In this lesson you''ll learn:

- How Riya sets up her business details once.
- How she adds a client, moves them through the stages and sends paperwork.
- How the client link, the team link and the team work.
- What you, as an admin, can check and change.

## Find Agency

Agency starts hidden on a new account, unless the setup chat showed it for her. It sits in the Contribution group.

1. Riya opens the Apps tab and opens the Contribution group.
2. She opens **Hidden apps** at its end and taps the eye beside Agency.
3. She taps Agency to open it.

The screen has five tabs: **Overview, Pipeline, Clients, Paperwork and Team**. A round gear at the top opens **Agency settings**. Each number on Overview opens the list of exactly what it counts, so **Late** opens the pieces that are late.

## Set up the business once

Riya types her business only once. Every invoice, agreement and note is filled from it.

1. She taps the gear to open Agency settings.
2. She types her details right on the sample invoice and agreement paper: her name, business name, address, emails, phones and website.
3. Under **Packages and pricing** she types what a package counts, like Videos, and a row for each package with its count and fee.
4. Under **Signatures and courts** she adds her designation and the city for courts.
5. She opens **Currency and hours** and sets her currency and the hours she works in a week.

It saves as she types. A quiet line says Saved, with Undo.

## Add a client

1. On Overview or Clients, Riya taps **Add client**.
2. In **Add a client** she types the brand name and the contact''s email.
3. She sets a **Password for their page**, or taps **Generate one**.
4. She opens **More details** for the retainer a month, deliverables a month, hours and billing.
5. She saves. The password shows once, so she copies it now.

The app never sends a password. Riya shares it with the brand another way, like a call or a message.

## Move a client through the stages

A client goes through nine stages: **Enquiry, Agreement sent, Agreement signed, Strategy session, Trial video, Pilot month, Retainer proposed, Retainer active and Monthly delivery.**

1. Riya opens the client. The stage card sits at the top.
2. It says what the client does now and what she does now.
3. When a step is done, she taps **Move to** and the next stage''s name.
4. **Stage details** folds open the checklist.

Sending or signing an agreement moves the stage forward by itself. The app never moves a client back on its own. A step back sticks: an agreement already out moves them on only if it is sent or signed again.

The client page has four parts: **Work, Money, Paper and Link**. Above them, the tile **For them to look at** holds two links. The waiting number opens Work on In review, and the late number opens it on Late.

## Plan the work in the pipeline

1. On the Pipeline tab, Riya taps **Add deliverable**.
2. Each piece goes through **Idea, Script, Making, In review, Approved and Published**.
3. A switch picks **List** or **Board**. On the board she drags a card, or taps its Move button and picks a column.

## Send paperwork

Paperwork has three parts: **Invoices, Agreements and Documents**.

1. Riya taps **New agreement**, picks the client and a template: built in, her own or a house template.
2. The paper opens. She edits it right on the page, and it saves as she types.
3. In the More menu she taps **Fill in the details** to fill every blank in one list.
4. She taps **Send to client**. The brand reads it at their link and accepts by typing their name.

The screen says plainly that a typed name is not a certified e-signature.

- **Under the header:** while a paper can change, a bar holds **Who it is for** and the **Write comments** switch.
- **Under the paper:** a fold, **Password for** and the client''s name, holds the password for their link.
- **The brief:** the client''s answers save as they type, and Riya sees them on her page.
- **Print this section:** it sits in a section''s menu, and it works on a signed agreement too. It never changes the words.
- **Email a copy:** in More. It opens a note written for her to change, naming each paper with its own link. Nothing is attached. A first send names the agreement and the invoice together, from whichever she opened it on. If one has no link yet, the note says it will follow in a separate email, and the sheet says why, with a way to it. Other notes cover a change to the paper, a reply about clauses and a payment reminder. A note never holds the client''s password.

For money, she taps **New invoice**, fills the lines, then **Send to client**. When the brand pays, she taps **Mark paid**. A sent invoice can be voided from More, and **Restore** brings it back with the same number.

## The client link and the team link

The **Link** part holds the client link.

- **Copy link** copies it. **Switch it on** opens it again when it is off.
- **What your client sees** sets which parts show and what they can do.
- More has **Make a fresh link** and **Switch the link off**, which asks first.

A new client first sees a short form: legal name, brands, address, PIN code, state, tax numbers and contact. What the client''s record already holds fills itself in, so they are not asked twice. When they send it, their details land on the record and the trial agreement is made.

The brand''s junior staff get the **team link**. Riya taps **Switch the team link on** and must set a password first. It never shows invoices, agreements, money or private notes.

If a brand loses its password, it can ask for a new one. Riya then sees **Set a new password** as the page''s main button.

## Offer a retainer

1. After the pilot, on the client''s **Money** part, Riya taps **Offer a retainer**.
2. She offers up to four lengths, each from 1 to 24 months, with an optional discount.
3. The brand picks one at their link.
4. Riya taps **Confirm and start**.
5. **Send each month''s invoice by itself** decides whether each month''s invoice goes out or waits as a draft.

## Bring in a team

1. On the Team tab, Riya taps **Invite member**.
2. She types an email, @username or friend code.
3. She picks a role: **Content creator, Videographer, Video editor or Client**.
4. Under **What they can open**, she sets each tab to Off, View or Edit.
5. She taps **Send invite**.

A team can hold up to 25 people. A member never sees her bank, fees, private notes or the client link.

## What an admin checks

- **Allowing or blocking it:** in Admin, People, tap a row and use **What does this person see?** to allow or block Agency for that person. For a whole brand, add an override on Agency under Flags, for a brand. An override never unhides it: the person then unhides it from **Apps** (Contribution), as under Find Agency.
- **House templates:** only a super admin saves one, from their own paper, with **Save as house template** in More. They are listed under the **Agency templates** tab.
- **Counts only:** Dev Tools shows how much Agency is used. It never shows client names, amounts or notes.
- **Owner only:** no staff member or admin can open Riya''s clients, fees or notes. Her Agency tables in **All tables** are hers and AI chat''s alone, never a coach''s or yours.

> **Pro tip:** ask a new Agency user to fill Agency settings first. Every paper after that fills itself, and the "Not filled yet" marks go away.

> **Result:** Riya runs each brand from first enquiry to monthly delivery, with paperwork, passwords and a team in one place.

## The bottom line

Agency is Riya''s business desk. She types her business once, adds a client with a password, moves them stage by stage and sends paper that fills itself. You keep it switched on for the right people and never need to see what is inside.', sequence = 20 WHERE id = 'prog-admin-guide-l18' AND program_id = 'prog-admin-guide';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-admin-guide-l18', 'prog-admin-guide', 'Agency: clients, pipeline and paperwork', 'lesson', NULL, 'Riya edits videos in Pune. She makes her own content, and brands pay her to make videos too. Her clients lived in chats and a folder of invoices. Agency puts them in one place.

In this lesson you''ll learn:

- How Riya sets up her business details once.
- How she adds a client, moves them through the stages and sends paperwork.
- How the client link, the team link and the team work.
- What you, as an admin, can check and change.

## Find Agency

Agency starts hidden on a new account, unless the setup chat showed it for her. It sits in the Contribution group.

1. Riya opens the Apps tab and opens the Contribution group.
2. She opens **Hidden apps** at its end and taps the eye beside Agency.
3. She taps Agency to open it.

The screen has five tabs: **Overview, Pipeline, Clients, Paperwork and Team**. A round gear at the top opens **Agency settings**. Each number on Overview opens the list of exactly what it counts, so **Late** opens the pieces that are late.

## Set up the business once

Riya types her business only once. Every invoice, agreement and note is filled from it.

1. She taps the gear to open Agency settings.
2. She types her details right on the sample invoice and agreement paper: her name, business name, address, emails, phones and website.
3. Under **Packages and pricing** she types what a package counts, like Videos, and a row for each package with its count and fee.
4. Under **Signatures and courts** she adds her designation and the city for courts.
5. She opens **Currency and hours** and sets her currency and the hours she works in a week.

It saves as she types. A quiet line says Saved, with Undo.

## Add a client

1. On Overview or Clients, Riya taps **Add client**.
2. In **Add a client** she types the brand name and the contact''s email.
3. She sets a **Password for their page**, or taps **Generate one**.
4. She opens **More details** for the retainer a month, deliverables a month, hours and billing.
5. She saves. The password shows once, so she copies it now.

The app never sends a password. Riya shares it with the brand another way, like a call or a message.

## Move a client through the stages

A client goes through nine stages: **Enquiry, Agreement sent, Agreement signed, Strategy session, Trial video, Pilot month, Retainer proposed, Retainer active and Monthly delivery.**

1. Riya opens the client. The stage card sits at the top.
2. It says what the client does now and what she does now.
3. When a step is done, she taps **Move to** and the next stage''s name.
4. **Stage details** folds open the checklist.

Sending or signing an agreement moves the stage forward by itself. The app never moves a client back on its own. A step back sticks: an agreement already out moves them on only if it is sent or signed again.

The client page has four parts: **Work, Money, Paper and Link**. Above them, the tile **For them to look at** holds two links. The waiting number opens Work on In review, and the late number opens it on Late.

## Plan the work in the pipeline

1. On the Pipeline tab, Riya taps **Add deliverable**.
2. Each piece goes through **Idea, Script, Making, In review, Approved and Published**.
3. A switch picks **List** or **Board**. On the board she drags a card, or taps its Move button and picks a column.

## Send paperwork

Paperwork has three parts: **Invoices, Agreements and Documents**.

1. Riya taps **New agreement**, picks the client and a template: built in, her own or a house template.
2. The paper opens. She edits it right on the page, and it saves as she types.
3. In the More menu she taps **Fill in the details** to fill every blank in one list.
4. She taps **Send to client**. The brand reads it at their link and accepts by typing their name.

The screen says plainly that a typed name is not a certified e-signature.

- **Under the header:** while a paper can change, a bar holds **Who it is for** and the **Write comments** switch.
- **Under the paper:** a fold, **Password for** and the client''s name, holds the password for their link.
- **The brief:** the client''s answers save as they type, and Riya sees them on her page.
- **Print this section:** it sits in a section''s menu, and it works on a signed agreement too. It never changes the words.
- **Email a copy:** in More. It opens a note written for her to change, naming each paper with its own link. Nothing is attached. A first send names the agreement and the invoice together, from whichever she opened it on. If one has no link yet, the note says it will follow in a separate email, and the sheet says why, with a way to it. Other notes cover a change to the paper, a reply about clauses and a payment reminder. A note never holds the client''s password.

For money, she taps **New invoice**, fills the lines, then **Send to client**. When the brand pays, she taps **Mark paid**. A sent invoice can be voided from More, and **Restore** brings it back with the same number.

## The client link and the team link

The **Link** part holds the client link.

- **Copy link** copies it. **Switch it on** opens it again when it is off.
- **What your client sees** sets which parts show and what they can do.
- More has **Make a fresh link** and **Switch the link off**, which asks first.

A new client first sees a short form: legal name, brands, address, PIN code, state, tax numbers and contact. What the client''s record already holds fills itself in, so they are not asked twice. When they send it, their details land on the record and the trial agreement is made.

The brand''s junior staff get the **team link**. Riya taps **Switch the team link on** and must set a password first. It never shows invoices, agreements, money or private notes.

If a brand loses its password, it can ask for a new one. Riya then sees **Set a new password** as the page''s main button.

## Offer a retainer

1. After the pilot, on the client''s **Money** part, Riya taps **Offer a retainer**.
2. She offers up to four lengths, each from 1 to 24 months, with an optional discount.
3. The brand picks one at their link.
4. Riya taps **Confirm and start**.
5. **Send each month''s invoice by itself** decides whether each month''s invoice goes out or waits as a draft.

## Bring in a team

1. On the Team tab, Riya taps **Invite member**.
2. She types an email, @username or friend code.
3. She picks a role: **Content creator, Videographer, Video editor or Client**.
4. Under **What they can open**, she sets each tab to Off, View or Edit.
5. She taps **Send invite**.

A team can hold up to 25 people. A member never sees her bank, fees, private notes or the client link.

## What an admin checks

- **Allowing or blocking it:** in Admin, People, tap a row and use **What does this person see?** to allow or block Agency for that person. For a whole brand, add an override on Agency under Flags, for a brand. An override never unhides it: the person then unhides it from **Apps** (Contribution), as under Find Agency.
- **House templates:** only a super admin saves one, from their own paper, with **Save as house template** in More. They are listed under the **Agency templates** tab.
- **Counts only:** Dev Tools shows how much Agency is used. It never shows client names, amounts or notes.
- **Owner only:** no staff member or admin can open Riya''s clients, fees or notes. Her Agency tables in **All tables** are hers and AI chat''s alone, never a coach''s or yours.

> **Pro tip:** ask a new Agency user to fill Agency settings first. Every paper after that fills itself, and the "Not filled yet" marks go away.

> **Result:** Riya runs each brand from first enquiry to monthly delivery, with paperwork, passwords and a team in one place.

## The bottom line

Agency is Riya''s business desk. She types her business once, adds a client with a password, moves them stage by stage and sends paper that fills itself. You keep it switched on for the right people and never need to see what is inside.', 20, 1);
UPDATE learning_items SET sequence = 21 WHERE id = 'prog-admin-guide-l19' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET module_title = 'The assistant, plans and credits', body = 'Riya has a long day of edits. She wants to log her sleep, add a task to a pyramid and note a payment, without opening three apps. Bumling, the app''s own guide, does it for her from one panel.

In this lesson you''ll learn:

- What the assistant does for free and what needs a plan.
- How Riya picks a plan, reads her credits and undoes a change.
- How models and privacy work.
- How an admin starts a plan or adds credits.

## Open the assistant

The assistant is a round button with Bumling in it, at the bottom right of every screen in the app. On a phone it sits above the tab bar.

1. Riya taps the button.
2. A panel opens called **Bumling AI assistant**.
3. The page under it stays in view and updates as things change.

Close folds the panel back into the button and keeps the chat.

## The free half: flows

Flows are short forms that cost nothing. They write through the same steps a tap on a screen uses. Each one says where its answer lands.

Some of them:

- **Check in for today** and **Mark the small act done**, which land on the Daily tab.
- **Add to a pyramid**, which lands on that pillar in Pillars.
- **Mark my not to do list** and **Add to my not to do list**.
- **Log my sleep**, **Log my stress** and **Log mindful minutes**.
- **Add money in or out** and **Note money owed**, when Finance is on.
- **Write a review**, when Reviews is on.

A flow is hidden while its app is off. The screen under the panel picks the first few.

## The paid half: typing

Typing what you want, like "move my edit task to Friday", needs a plan.

1. Riya types a line in the box at the bottom.
2. Bumling does it in the app as Riya, with the same rules as her own taps.
3. Each change comes back as a row with **Undo**.
4. Removing something, or settling money owed, waits for her to tap **Confirm** or **Cancel**.
5. While it works, the send arrow turns into a **Stop** square. What was done before the stop stays, each with Undo.

It can also log movement, the eating check-in and the day''s gratitude. It reads supplements only if Riya switches their table on with **Show to AI chat**, and then only on a model that keeps nothing.

Each reply says **Answered by** and the model''s name, so it is never mixed up with a built-in line.

Without a plan, she can still ask what a word means, like "what is a layer?". Anything else shows the plan card.

## Models and privacy

When a model is connected on the server, a model picker shows under the panel''s header. The list holds free models that can use the app''s tools.

- **A free model costs no credits**, but typing still needs a plan.
- **Some models keep nothing.** Only with one of those can the assistant read the journal and the trackers.
- **The journal is read only when asked.** The assistant reads it only when Riya asks about it.
- **A whole table only when she opens it.** The assistant and the Companion read a table from All tables only when Riya switches on **Show to AI chat** for it, at the top of the table or under **AI chat** on her Profile tab. They never change it. The journal, the body and mind tables and any table with other people''s details go only to a model that keeps nothing.

The panel says under the picker what the chosen model may read.

## Pick a plan

1. Riya opens the Profile tab and taps **Plans and credits**.
2. She sees her **Plan** and what she **Used today**.
3. Under **Plans** she reads the three plans, all in rupees, each for 30 days:

- **Pro:** ₹1,499 for 10,000 credits.
- **Pro Max:** ₹12,499 for 100,000 credits.
- **Ultra:** ₹49,999 for 400,000 credits.

Plan credits that are left at the end do not carry over.

Under **Top up** are extra credits: ₹899 for 8,000, ₹2,299 for 20,000 and ₹4,499 for 40,000. They are used after the plan''s own and stay until used.

Payments are not live yet. Picking a plan or a top-up charges nothing, and the page says so. Until payments are live, the team switches plans on.

## Read the credits

- **One credit** is a tenth of a US cent of model use, worked out from the words the model read and wrote.
- **Credits used** shows each day for the last thirty days.
- **Limits by plan** shows what each agent may read and spend, with Riya''s column marked.
- **History** lists every credit in and out, newest first.

The Companion uses the same plan and credits. Without a plan, or once credits run out, it still answers free in its built-in way.

## What an admin does

You start plans by hand until payments are live.

1. Open Admin, then the **People** tab.
2. Search for Riya and tap her row.
3. Under **Plan and credits**, pick a plan and the number of days, then tap **Start**.
4. To add extra credits, type the number and tap **Add credits**. Add a line under "Why, for the history" if you like.
5. To end a plan, pick **No plan** and tap **End plan**. A sheet asks first. Plan credits go; extra credits stay.

You can also tick several rows and use **Start Pro** or **End plan** for all of them. Every change is written to the audit log.

## What an admin checks

- **The model key:** the model is set on the server. Until it is, the picker does not show.
- **The switch:** the assistant is on for everyone. The team can switch it off under Flags.
- **Its records:** the assistant keeps tool names, ids and short labels for Undo, never journal text.

> **Pro tip:** when you start a plan for a tester, add a few extra credits with a note. The note shows in their History, so they know where it came from.

> **Result:** Riya logs, plans and fixes things by typing one line, and every change has an Undo.

## The bottom line

The flows are free for everyone. Typing needs a plan, and credits pay for the model. Until payments go live, plans start from Admin, People, and every change you make there is in the audit log.', sequence = 22 WHERE id = 'prog-admin-guide-l20' AND program_id = 'prog-admin-guide';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-admin-guide-l20', 'prog-admin-guide', 'The assistant, plans and credits', 'lesson', NULL, 'Riya has a long day of edits. She wants to log her sleep, add a task to a pyramid and note a payment, without opening three apps. Bumling, the app''s own guide, does it for her from one panel.

In this lesson you''ll learn:

- What the assistant does for free and what needs a plan.
- How Riya picks a plan, reads her credits and undoes a change.
- How models and privacy work.
- How an admin starts a plan or adds credits.

## Open the assistant

The assistant is a round button with Bumling in it, at the bottom right of every screen in the app. On a phone it sits above the tab bar.

1. Riya taps the button.
2. A panel opens called **Bumling AI assistant**.
3. The page under it stays in view and updates as things change.

Close folds the panel back into the button and keeps the chat.

## The free half: flows

Flows are short forms that cost nothing. They write through the same steps a tap on a screen uses. Each one says where its answer lands.

Some of them:

- **Check in for today** and **Mark the small act done**, which land on the Daily tab.
- **Add to a pyramid**, which lands on that pillar in Pillars.
- **Mark my not to do list** and **Add to my not to do list**.
- **Log my sleep**, **Log my stress** and **Log mindful minutes**.
- **Add money in or out** and **Note money owed**, when Finance is on.
- **Write a review**, when Reviews is on.

A flow is hidden while its app is off. The screen under the panel picks the first few.

## The paid half: typing

Typing what you want, like "move my edit task to Friday", needs a plan.

1. Riya types a line in the box at the bottom.
2. Bumling does it in the app as Riya, with the same rules as her own taps.
3. Each change comes back as a row with **Undo**.
4. Removing something, or settling money owed, waits for her to tap **Confirm** or **Cancel**.
5. While it works, the send arrow turns into a **Stop** square. What was done before the stop stays, each with Undo.

It can also log movement, the eating check-in and the day''s gratitude. It reads supplements only if Riya switches their table on with **Show to AI chat**, and then only on a model that keeps nothing.

Each reply says **Answered by** and the model''s name, so it is never mixed up with a built-in line.

Without a plan, she can still ask what a word means, like "what is a layer?". Anything else shows the plan card.

## Models and privacy

When a model is connected on the server, a model picker shows under the panel''s header. The list holds free models that can use the app''s tools.

- **A free model costs no credits**, but typing still needs a plan.
- **Some models keep nothing.** Only with one of those can the assistant read the journal and the trackers.
- **The journal is read only when asked.** The assistant reads it only when Riya asks about it.
- **A whole table only when she opens it.** The assistant and the Companion read a table from All tables only when Riya switches on **Show to AI chat** for it, at the top of the table or under **AI chat** on her Profile tab. They never change it. The journal, the body and mind tables and any table with other people''s details go only to a model that keeps nothing.

The panel says under the picker what the chosen model may read.

## Pick a plan

1. Riya opens the Profile tab and taps **Plans and credits**.
2. She sees her **Plan** and what she **Used today**.
3. Under **Plans** she reads the three plans, all in rupees, each for 30 days:

- **Pro:** ₹1,499 for 10,000 credits.
- **Pro Max:** ₹12,499 for 100,000 credits.
- **Ultra:** ₹49,999 for 400,000 credits.

Plan credits that are left at the end do not carry over.

Under **Top up** are extra credits: ₹899 for 8,000, ₹2,299 for 20,000 and ₹4,499 for 40,000. They are used after the plan''s own and stay until used.

Payments are not live yet. Picking a plan or a top-up charges nothing, and the page says so. Until payments are live, the team switches plans on.

## Read the credits

- **One credit** is a tenth of a US cent of model use, worked out from the words the model read and wrote.
- **Credits used** shows each day for the last thirty days.
- **Limits by plan** shows what each agent may read and spend, with Riya''s column marked.
- **History** lists every credit in and out, newest first.

The Companion uses the same plan and credits. Without a plan, or once credits run out, it still answers free in its built-in way.

## What an admin does

You start plans by hand until payments are live.

1. Open Admin, then the **People** tab.
2. Search for Riya and tap her row.
3. Under **Plan and credits**, pick a plan and the number of days, then tap **Start**.
4. To add extra credits, type the number and tap **Add credits**. Add a line under "Why, for the history" if you like.
5. To end a plan, pick **No plan** and tap **End plan**. A sheet asks first. Plan credits go; extra credits stay.

You can also tick several rows and use **Start Pro** or **End plan** for all of them. Every change is written to the audit log.

## What an admin checks

- **The model key:** the model is set on the server. Until it is, the picker does not show.
- **The switch:** the assistant is on for everyone. The team can switch it off under Flags.
- **Its records:** the assistant keeps tool names, ids and short labels for Undo, never journal text.

> **Pro tip:** when you start a plan for a tester, add a few extra credits with a note. The note shows in their History, so they know where it came from.

> **Result:** Riya logs, plans and fixes things by typing one line, and every change has an Undo.

## The bottom line

The flows are free for everyone. Typing needs a plan, and credits pay for the model. Until payments go live, plans start from Admin, People, and every change you make there is in the audit log.', 22, 1);
UPDATE learning_items SET module_title = 'Admin: People', body = 'Riya has been on the app for a few months. She helps new editors in Community, and the team wants her to give feedback in the editing program. That means a new job, maybe a badge and a plan. All of it happens in one place: Admin, People.

In this lesson you''ll learn:

- How to open Admin and find a person.
- What roles and permissions are, and how to give them.
- How to give xp, points, honors and badges.
- How to set what a person sees, start a plan and delete an account.
- How to connect two people, and how invites and the waitlist work.

## Open Admin

Admin is in the Operations group, which only the team sees.

1. Open the Apps tab and open the Operations group.
2. Tap **Admin**.
3. Signed in as an admin, no key is needed. The cover says so.

The sections are tabs: **People, Connect people, Invites, Listings, Redemptions, Orders, KYC, Life coaches, Flags, Discount codes, Attendee codes, Agency templates, Audit, Webhooks and Ops**. The row shows what fits, and **All** lists the rest.

Who is an admin? The founders'' email addresses are set on the server. Signing up or in with one of them gives the admin role, and that is written to the audit log.

## Find Riya

1. On the **People** tab, type her name, email, page or id in the search box.
2. Tap **Search**.
3. The table lists who matched. Sort by any column, filter, or page through.

You can change **Role** and **Plan** right in the row. Tap the row itself to open her panel.

## Roles and permissions

There are three roles:

- **Creator:** learns, works, connects and sells. Every new account is one.
- **Staff:** runs parts of the app, as far as their permissions go.
- **Admin:** everything, including roles, permissions and which features exist.

A permission is a job someone is trusted with. There are ten: **Talent manager, Cohort manager, Event host, Finance, Moderator, Support, Reviewer, Mentor, Life coach and Inviter.**

- **A creator can hold four:** Mentor, Life coach, Moderator and Inviter. The rest need the Staff role.
- **An admin holds all but Life coach.** Life coach is always given on purpose.
- **Only an admin changes a role,** and never their own.

## Give Riya a job

The team wants Riya to give feedback on assignments, and to help as a guide in Community.

1. Open her panel.
2. Under **Permissions**, tap **Mentor**. It turns on at once.
3. Tap **Moderator** too. Anyone with it is a guide in Community.
4. To take one away, tap it again. A sheet asks first.

Riya keeps the Creator role. She now gets the mentor tools in School and the guide tools in Community. The Manage screen is for staff only, so it stays closed to her.

## Give xp, points, honors and badges

Riya ran a free editing workshop, so the team thanks her.

1. Under **Honors**, pick one from the list, add a note if you like, and tap **Grant**. Tap an honor she holds to take it away; a sheet asks first.
2. Under **Points**, type an amount and tap **Add**.
3. Under **XP**, type an amount and tap **Add**. A minus number takes xp away, but never below zero.
4. Under **Badges given by hand**, pick a badge and tap **Give**.

A badge you gave shows on her profile and counts for unlocks and the leaderboard. Taking it away never touches a badge she earned herself.

## Start a plan or add credits

Payments are not live yet, so plans start here.

1. Under **Plan and credits**, pick a plan and the number of days.
2. Tap **Start**.
3. To add extra credits, type a number and tap **Add credits**, with a short reason.

## What does this person see?

1. Tap **What does this person see?** at the foot of her panel.
2. Every app is listed as a tick row.
3. Untick an app to block it for her. Tick it to allow it.
4. **Reset** removes what you set, and the usual rules decide again.

A struck-through app is one she is not allowed. A line under it says why: blocked for her, needs a higher role, not rolled out to her yet, or switched off for everyone. Locked apps cannot be blocked, and the server refuses it too.

This only decides what she may use. She still hides and unhides her own apps.

## Change many people at once

Tick several rows. The buttons that appear are **Make creator, Make staff, Make admin, Make life coach, Start Pro and End plan**. The ones that take power away ask first.

## Connect two people

Riya''s friend Kabir wants a life coach, and the team knows one who fits. Connect people, right after People, is where the team joins two people.

1. Open **Connect people**. Under **Kind of connection**, pick one: a life coach and a student, an Agency team member, a private School program, a private Shop course, a Club manager, a cohort manager, a brand team member, or two friends.
2. Find each person by email, @username, friend code or id. A small card shows their picture, name and @username, never their email or phone.
3. Pick **Ask them** or, where the kind allows it, **Link now**. Link now needs a line under **Why they are linked now**, kept only in the audit log.
4. Tap **Send this connection**.

Each kind runs the app''s own steps. A coach''s student says yes or no on their Profile tab. Two friends are both asked there, and become friends only when both say yes; nobody is told who said no. An Agency member answers in their inbox and sees nothing until the owner gives them access. A program or course invite shows the price, and nothing is bought for them. A Club manager is named at once, and the member is told. A cohort manager is named at once too, with a reason, and the new and the old manager are told. A brand team member says yes or no on their Profile tab, and joins only with a yes.

**Connections the team made** lists every one with its state: Asked, Connected, Said no or Ended. **Withdraw** takes back an ask, and **End** ends a link; both ask first. On People, the link icon in a row opens that person''s **Connections**, with **Connect to someone** to start from them.

A connection pays each side 10 xp when it comes true, but never the person who made it, and never a manager named to a job: a Club manager link pays the member only. An invite to a place its sender made or owns pays nobody, as the place''s own invite never did. Each pair pays once for a kind and a place, so one ended and made again pays nothing more, even after an erase.

Staff use it too, from **Manage**, then **Connect people**, but only for the jobs they hold. Cohorts covers School programs, Shop courses and cohort managers. Reviewer covers Club managers, Talent manager covers brand teams, and Moderator covers friends. A staff member sees only those kinds in the form and in the list. A coach and a student, and an Agency team, stay with admins.

Each place keeps its own rule there. Staff invite only to the private programs they made and the private courses they own; a creator''s is theirs and an admin''s. Staff end only what staff made. A row an admin made says so, and only an admin ends it, takes it back or changes it, here or on the place''s own page. On a place that is their own, a maker keeps that power.

## Invites and the waitlist

While **Invite only** is on, a new account needs an invite code. Signing in, and the founders'' own addresses, never need one. There are two ways in.

1. **The waitlist:** someone with no code leaves a name and email. Open **Invites**, find them under **Waitlist** and tap **Approve**. They get a code by email, and the code and its link show in place, with **Copy link** and **Copy code**, in case mail is not set up. **Decline**, tapped twice, sends nothing.
2. **Invite codes:** tap **Make codes**, pick **How many**, add a label for who they are for, and pick how long they stay open. Share each one as a link or as the code.

Each code works for one account, once, and an account uses one code at most. **Take it back** stops a code nobody has used; it asks first. The list shows who made each code and, once used, who joined with it.

Staff, and anyone you give the **Inviter** permission, make codes from **Invite people** on their own Profile tab. The person who joins is credited to whoever made the code, like an affiliate link. Once that person has used the app on three different days, ticking a task or checking in on Daily, the maker earns xp and points, unless the maker is an admin.

Turning **Invite only** off opens sign-up to everyone, so it asks first. Turning it on is one tap.

## Delete an account

Say Riya made a second account to test her page, and asks you to remove it.

1. Search for that account.
2. Tap the bin icon at the end of its row.
3. A sheet asks "Delete" and the name. Tap **Yes, delete it**, or **Keep this account**.

What is private goes. Their events, runs and sessions still to come are cancelled, and whoever was coming is told. Money records and what others rely on stay under "Deleted member", without their name. A buyer with a session or a paid question still open is told to write to the team under Help, and nothing refunds by itself, so you refund it from **Orders**. It cannot be undone. If a delete stops partway, ask again: nothing happens twice. An admin account, and your own, can never be deleted here.

## What an admin checks

- **The audit log:** every role, permission, honor, badge, xp, plan, connection, invite and delete is written to the **Audit** tab, with the before and after. So is each of a member''s tables you open or download.
- **Role changes are watched:** every admin''s inbox hears about role changes.
- **Never shown:** the panel never shows anyone''s journal, wellbeing or Discover answers. Their Finance shows only through **Tables**, below.
- **Their tables:** **Tables** on a row opens that member''s tables, read only, with your own session, never the admin key. It never opens the journal, gratitude or a body and mind table, and never a deleted member. It never lists a table that holds other people''s details either, such as their buyers, guests, clients, chats, Agency, Discover or the Companion: those are theirs and AI chat''s alone. The tables sit in the same groups as the Apps page, and a table shows only while its app is on for them. Each table you open or download is written to the audit log, and their export lists when. Open one only when you need to, such as to answer their question.

> **Pro tip:** give a permission, not a role, wherever you can. A creator with Moderator is a guide, and nothing else about their account changes.

> **Result:** Riya is now a mentor and a guide, has a thank-you badge, and sees the apps the team meant her to see.

## The bottom line

People is where you give jobs and thanks. Search, tap the row, and use the panel. Give the smallest power that does the job, and trust the audit log to keep a record of each change.', sequence = 23 WHERE id = 'prog-admin-guide-l21' AND program_id = 'prog-admin-guide';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-admin-guide-l21', 'prog-admin-guide', 'Admin: People', 'lesson', NULL, 'Riya has been on the app for a few months. She helps new editors in Community, and the team wants her to give feedback in the editing program. That means a new job, maybe a badge and a plan. All of it happens in one place: Admin, People.

In this lesson you''ll learn:

- How to open Admin and find a person.
- What roles and permissions are, and how to give them.
- How to give xp, points, honors and badges.
- How to set what a person sees, start a plan and delete an account.
- How to connect two people, and how invites and the waitlist work.

## Open Admin

Admin is in the Operations group, which only the team sees.

1. Open the Apps tab and open the Operations group.
2. Tap **Admin**.
3. Signed in as an admin, no key is needed. The cover says so.

The sections are tabs: **People, Connect people, Invites, Listings, Redemptions, Orders, KYC, Life coaches, Flags, Discount codes, Attendee codes, Agency templates, Audit, Webhooks and Ops**. The row shows what fits, and **All** lists the rest.

Who is an admin? The founders'' email addresses are set on the server. Signing up or in with one of them gives the admin role, and that is written to the audit log.

## Find Riya

1. On the **People** tab, type her name, email, page or id in the search box.
2. Tap **Search**.
3. The table lists who matched. Sort by any column, filter, or page through.

You can change **Role** and **Plan** right in the row. Tap the row itself to open her panel.

## Roles and permissions

There are three roles:

- **Creator:** learns, works, connects and sells. Every new account is one.
- **Staff:** runs parts of the app, as far as their permissions go.
- **Admin:** everything, including roles, permissions and which features exist.

A permission is a job someone is trusted with. There are ten: **Talent manager, Cohort manager, Event host, Finance, Moderator, Support, Reviewer, Mentor, Life coach and Inviter.**

- **A creator can hold four:** Mentor, Life coach, Moderator and Inviter. The rest need the Staff role.
- **An admin holds all but Life coach.** Life coach is always given on purpose.
- **Only an admin changes a role,** and never their own.

## Give Riya a job

The team wants Riya to give feedback on assignments, and to help as a guide in Community.

1. Open her panel.
2. Under **Permissions**, tap **Mentor**. It turns on at once.
3. Tap **Moderator** too. Anyone with it is a guide in Community.
4. To take one away, tap it again. A sheet asks first.

Riya keeps the Creator role. She now gets the mentor tools in School and the guide tools in Community. The Manage screen is for staff only, so it stays closed to her.

## Give xp, points, honors and badges

Riya ran a free editing workshop, so the team thanks her.

1. Under **Honors**, pick one from the list, add a note if you like, and tap **Grant**. Tap an honor she holds to take it away; a sheet asks first.
2. Under **Points**, type an amount and tap **Add**.
3. Under **XP**, type an amount and tap **Add**. A minus number takes xp away, but never below zero.
4. Under **Badges given by hand**, pick a badge and tap **Give**.

A badge you gave shows on her profile and counts for unlocks and the leaderboard. Taking it away never touches a badge she earned herself.

## Start a plan or add credits

Payments are not live yet, so plans start here.

1. Under **Plan and credits**, pick a plan and the number of days.
2. Tap **Start**.
3. To add extra credits, type a number and tap **Add credits**, with a short reason.

## What does this person see?

1. Tap **What does this person see?** at the foot of her panel.
2. Every app is listed as a tick row.
3. Untick an app to block it for her. Tick it to allow it.
4. **Reset** removes what you set, and the usual rules decide again.

A struck-through app is one she is not allowed. A line under it says why: blocked for her, needs a higher role, not rolled out to her yet, or switched off for everyone. Locked apps cannot be blocked, and the server refuses it too.

This only decides what she may use. She still hides and unhides her own apps.

## Change many people at once

Tick several rows. The buttons that appear are **Make creator, Make staff, Make admin, Make life coach, Start Pro and End plan**. The ones that take power away ask first.

## Connect two people

Riya''s friend Kabir wants a life coach, and the team knows one who fits. Connect people, right after People, is where the team joins two people.

1. Open **Connect people**. Under **Kind of connection**, pick one: a life coach and a student, an Agency team member, a private School program, a private Shop course, a Club manager, a cohort manager, a brand team member, or two friends.
2. Find each person by email, @username, friend code or id. A small card shows their picture, name and @username, never their email or phone.
3. Pick **Ask them** or, where the kind allows it, **Link now**. Link now needs a line under **Why they are linked now**, kept only in the audit log.
4. Tap **Send this connection**.

Each kind runs the app''s own steps. A coach''s student says yes or no on their Profile tab. Two friends are both asked there, and become friends only when both say yes; nobody is told who said no. An Agency member answers in their inbox and sees nothing until the owner gives them access. A program or course invite shows the price, and nothing is bought for them. A Club manager is named at once, and the member is told. A cohort manager is named at once too, with a reason, and the new and the old manager are told. A brand team member says yes or no on their Profile tab, and joins only with a yes.

**Connections the team made** lists every one with its state: Asked, Connected, Said no or Ended. **Withdraw** takes back an ask, and **End** ends a link; both ask first. On People, the link icon in a row opens that person''s **Connections**, with **Connect to someone** to start from them.

A connection pays each side 10 xp when it comes true, but never the person who made it, and never a manager named to a job: a Club manager link pays the member only. An invite to a place its sender made or owns pays nobody, as the place''s own invite never did. Each pair pays once for a kind and a place, so one ended and made again pays nothing more, even after an erase.

Staff use it too, from **Manage**, then **Connect people**, but only for the jobs they hold. Cohorts covers School programs, Shop courses and cohort managers. Reviewer covers Club managers, Talent manager covers brand teams, and Moderator covers friends. A staff member sees only those kinds in the form and in the list. A coach and a student, and an Agency team, stay with admins.

Each place keeps its own rule there. Staff invite only to the private programs they made and the private courses they own; a creator''s is theirs and an admin''s. Staff end only what staff made. A row an admin made says so, and only an admin ends it, takes it back or changes it, here or on the place''s own page. On a place that is their own, a maker keeps that power.

## Invites and the waitlist

While **Invite only** is on, a new account needs an invite code. Signing in, and the founders'' own addresses, never need one. There are two ways in.

1. **The waitlist:** someone with no code leaves a name and email. Open **Invites**, find them under **Waitlist** and tap **Approve**. They get a code by email, and the code and its link show in place, with **Copy link** and **Copy code**, in case mail is not set up. **Decline**, tapped twice, sends nothing.
2. **Invite codes:** tap **Make codes**, pick **How many**, add a label for who they are for, and pick how long they stay open. Share each one as a link or as the code.

Each code works for one account, once, and an account uses one code at most. **Take it back** stops a code nobody has used; it asks first. The list shows who made each code and, once used, who joined with it.

Staff, and anyone you give the **Inviter** permission, make codes from **Invite people** on their own Profile tab. The person who joins is credited to whoever made the code, like an affiliate link. Once that person has used the app on three different days, ticking a task or checking in on Daily, the maker earns xp and points, unless the maker is an admin.

Turning **Invite only** off opens sign-up to everyone, so it asks first. Turning it on is one tap.

## Delete an account

Say Riya made a second account to test her page, and asks you to remove it.

1. Search for that account.
2. Tap the bin icon at the end of its row.
3. A sheet asks "Delete" and the name. Tap **Yes, delete it**, or **Keep this account**.

What is private goes. Their events, runs and sessions still to come are cancelled, and whoever was coming is told. Money records and what others rely on stay under "Deleted member", without their name. A buyer with a session or a paid question still open is told to write to the team under Help, and nothing refunds by itself, so you refund it from **Orders**. It cannot be undone. If a delete stops partway, ask again: nothing happens twice. An admin account, and your own, can never be deleted here.

## What an admin checks

- **The audit log:** every role, permission, honor, badge, xp, plan, connection, invite and delete is written to the **Audit** tab, with the before and after. So is each of a member''s tables you open or download.
- **Role changes are watched:** every admin''s inbox hears about role changes.
- **Never shown:** the panel never shows anyone''s journal, wellbeing or Discover answers. Their Finance shows only through **Tables**, below.
- **Their tables:** **Tables** on a row opens that member''s tables, read only, with your own session, never the admin key. It never opens the journal, gratitude or a body and mind table, and never a deleted member. It never lists a table that holds other people''s details either, such as their buyers, guests, clients, chats, Agency, Discover or the Companion: those are theirs and AI chat''s alone. The tables sit in the same groups as the Apps page, and a table shows only while its app is on for them. Each table you open or download is written to the audit log, and their export lists when. Open one only when you need to, such as to answer their question.

> **Pro tip:** give a permission, not a role, wherever you can. A creator with Moderator is a guide, and nothing else about their account changes.

> **Result:** Riya is now a mentor and a guide, has a thank-you badge, and sees the apps the team meant her to see.

## The bottom line

People is where you give jobs and thanks. Search, tap the row, and use the panel. Give the smallest power that does the job, and trust the audit log to keep a record of each change.', 23, 1);
UPDATE learning_items SET sequence = 24 WHERE id = 'prog-admin-guide-l22' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET module_title = 'Running the platform', body = 'Riya never sees most of what keeps the app running. She sees an app appear, a page that loads, and a privacy card that asks once. Behind that, the team decides what is live, watches for trouble and keeps her data where it belongs.

In this lesson you''ll learn:

- How to switch an app on for everyone, a share of people or one person.
- How to read Dev Tools, the build map and the Logs.
- Your duties for privacy: the privacy card, data requests and the Grievance Officer.
- What must never reach staff.

## Feature flags

Every app is a module with a switch the team controls. A person''s own Hide and Show is only a preference. If the team switches an app off, the server refuses it, not only the screen.

1. Open Admin and the **Flags** tab. The heading is **Feature flags**.
2. Each app is a row: **Module, Group, On, Minimum role, Rollout % and Overrides**.
3. Turn **On** off to hide an app for everyone.
4. Set **Minimum role** so only staff or admins can open it.
5. Set **Rollout %** to show it to a steady share of people.

A change takes a few seconds to reach everyone.

## Try an app with Riya first

Say the team wants to test Run with a small group before everyone gets it.

1. Set Run''s **Rollout %** to 10.
2. Tap **Add override** on Run''s row.
3. Under **For**, pick **One person (user id)** and paste Riya''s id.
4. Set **Force on**, add **Expires in days** if it should end, and a **Reason**.
5. Tap **Save override**.

The **Overrides** list shows every one, with **Remove**. **For** can also be **A role** or **A brand (organization id)**. In People, **What does this person see?** writes the same kind of override for one person in one tap.

## Dev Tools

Dev Tools is in the Operations group. Staff and admins can open it. It never shows journals or wellbeing.

- **People in numbers:** every account that is not deleted.
- **People per app:** how many have each app on.
- **Games, Discover and Agency:** counts only, never names, answers or amounts.
- **Daily and the ways in:** open bottlenecks by kind, own time blocks, people who came through an event and are not set up, and new QR codes.
- **Life coaches and School:** coach links by state, invite links, links the team made, programs by state, lesson resources and cohort talk.
- **What the team did:** in the last 30 days, people connected by kind and what was given by hand.
- **Invites:** whether Invite only is on, codes made, used, open, taken back and ended, how many joined with one this week and finished setup, and the waitlist by state.
- **The log, last 24 hours:** changes, refused requests and errors, counted.
- **People:** accounts, newest first. Only an admin changes a role from a row''s menu, and a sheet asks first.

## The build map

The **Build map** at the foot of Dev Tools shows the state of every part of the app.

- **Green** is built and checked.
- **Yellow** needs a key.
- **Orange** is test mode, or not tried live.
- **Dashed** is not built.

**Where things live** lists the files to open when something needs changing. Read the map before you promise anyone a feature.

## Logs

Only a super admin opens Logs, because the lines name people.

1. On Dev Tools, tap **Logs** at the top.
2. Search a path, message or name.
3. Pick **Every line, Errors, Refused or Changes**.
4. Pick a person, or **Everyone**, and an area.

Lines are kept for thirty days. A line never holds what someone wrote. The journal, wellbeing, Fitness, the Companion, Discover and the assistant only ever leave a bare error line, with no person and no path.

## Alerts in your inbox

Every admin''s inbox hears about bursts of failed sign-ins, too many requests, server errors and role changes, under the **Team** tab. Each kind comes at most once an hour. Each new note also goes out as one private email, with counts only. Until mail is set up on the server, the note says the inbox is the only alert. A copyright notice from the public site lands there too.

The shared admin key has a limit of its own: ten tries in ten minutes from one address. Past that, even the right key waits. A signed-in admin is never counted.

## The privacy card

A visitor and a new member see a small card called **Your privacy**. It asks once about three things: the tracked-link cookie, videos from YouTube and Vimeo, and marketing email.

- **All three start off.** **Reject all** and **Accept all** are equal, side by side.
- **Choose for each** opens the three switches.
- **Riya changes them any time** on the Profile tab, under **Privacy choices**. The footer''s **Privacy choices** button brings the card back.

If a browser sends Global Privacy Control, the tracked-link cookie is never set, even after an earlier yes. Marketing email goes only with a recorded yes.

## Data requests

Riya owns her data. On the Profile tab, **Your data** holds **Export my data**, **Erase everything** and **Delete my account**.

- **Each one asks first** in a sheet.
- **Each request is logged without a name.** Those rows are kept for three years.
- **You never do it for her by hand.** If she writes in, point her to that row. Deleting an account from Admin, People is the same delete.

## The Grievance Officer

India''s privacy law asks for a named person to take complaints. The business''s details, the Grievance Officer''s name and email among them, are set on the server by whoever deploys the app. They are never typed into the code.

1. Open the public **Contact** page.
2. Check that the Grievance Officer''s name and email show.
3. If a field says "not set yet", ask whoever deploys to set it before launch.

The privacy card points questions to that officer. Never state a reply time unless the business sets one. Never claim a certification, a compliance label or an uptime number in any copy.

## What never reaches staff

- **The journal and wellbeing:** never to brands, staff, the leaderboard or Club selection.
- **Discover answers and results:** only the owner sees them.
- **The Companion''s chats:** private to the person.
- **The Finance app:** private to the person, but a super admin can read its tables from Admin, **People**, **Tables**, read only, with each one in the audit log.
- **Fitness and supplements:** private to the person.
- **Agency clients, fees and notes:** owner only.
- **A life coach:** sees only what the student switched on: the six parts, and whole tables one by one, read only. The journal and supplements reach a coach only that way.
- **Tables with other people''s details:** buyers, guests, leads, clients, applicants, chats, Agency, Discover and the Companion. Only the person and AI chat on a model that keeps nothing read them, never a coach or staff, not even a super admin.

> **Pro tip:** before you switch an app on for everyone, look at its card on the build map. If it says it needs a key, set the key first.

> **Result:** Riya gets new apps when they are ready, her choices stick, and her private things stay private.

## The bottom line

Flags decide what is live. Dev Tools and Logs show what is happening. Privacy is a duty, not a setting: check the Contact page, let people manage their own data, and never look where staff do not belong.', sequence = 25 WHERE id = 'prog-admin-guide-l23' AND program_id = 'prog-admin-guide';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-admin-guide-l23', 'prog-admin-guide', 'Running the platform', 'lesson', NULL, 'Riya never sees most of what keeps the app running. She sees an app appear, a page that loads, and a privacy card that asks once. Behind that, the team decides what is live, watches for trouble and keeps her data where it belongs.

In this lesson you''ll learn:

- How to switch an app on for everyone, a share of people or one person.
- How to read Dev Tools, the build map and the Logs.
- Your duties for privacy: the privacy card, data requests and the Grievance Officer.
- What must never reach staff.

## Feature flags

Every app is a module with a switch the team controls. A person''s own Hide and Show is only a preference. If the team switches an app off, the server refuses it, not only the screen.

1. Open Admin and the **Flags** tab. The heading is **Feature flags**.
2. Each app is a row: **Module, Group, On, Minimum role, Rollout % and Overrides**.
3. Turn **On** off to hide an app for everyone.
4. Set **Minimum role** so only staff or admins can open it.
5. Set **Rollout %** to show it to a steady share of people.

A change takes a few seconds to reach everyone.

## Try an app with Riya first

Say the team wants to test Run with a small group before everyone gets it.

1. Set Run''s **Rollout %** to 10.
2. Tap **Add override** on Run''s row.
3. Under **For**, pick **One person (user id)** and paste Riya''s id.
4. Set **Force on**, add **Expires in days** if it should end, and a **Reason**.
5. Tap **Save override**.

The **Overrides** list shows every one, with **Remove**. **For** can also be **A role** or **A brand (organization id)**. In People, **What does this person see?** writes the same kind of override for one person in one tap.

## Dev Tools

Dev Tools is in the Operations group. Staff and admins can open it. It never shows journals or wellbeing.

- **People in numbers:** every account that is not deleted.
- **People per app:** how many have each app on.
- **Games, Discover and Agency:** counts only, never names, answers or amounts.
- **Daily and the ways in:** open bottlenecks by kind, own time blocks, people who came through an event and are not set up, and new QR codes.
- **Life coaches and School:** coach links by state, invite links, links the team made, programs by state, lesson resources and cohort talk.
- **What the team did:** in the last 30 days, people connected by kind and what was given by hand.
- **Invites:** whether Invite only is on, codes made, used, open, taken back and ended, how many joined with one this week and finished setup, and the waitlist by state.
- **The log, last 24 hours:** changes, refused requests and errors, counted.
- **People:** accounts, newest first. Only an admin changes a role from a row''s menu, and a sheet asks first.

## The build map

The **Build map** at the foot of Dev Tools shows the state of every part of the app.

- **Green** is built and checked.
- **Yellow** needs a key.
- **Orange** is test mode, or not tried live.
- **Dashed** is not built.

**Where things live** lists the files to open when something needs changing. Read the map before you promise anyone a feature.

## Logs

Only a super admin opens Logs, because the lines name people.

1. On Dev Tools, tap **Logs** at the top.
2. Search a path, message or name.
3. Pick **Every line, Errors, Refused or Changes**.
4. Pick a person, or **Everyone**, and an area.

Lines are kept for thirty days. A line never holds what someone wrote. The journal, wellbeing, Fitness, the Companion, Discover and the assistant only ever leave a bare error line, with no person and no path.

## Alerts in your inbox

Every admin''s inbox hears about bursts of failed sign-ins, too many requests, server errors and role changes, under the **Team** tab. Each kind comes at most once an hour. Each new note also goes out as one private email, with counts only. Until mail is set up on the server, the note says the inbox is the only alert. A copyright notice from the public site lands there too.

The shared admin key has a limit of its own: ten tries in ten minutes from one address. Past that, even the right key waits. A signed-in admin is never counted.

## The privacy card

A visitor and a new member see a small card called **Your privacy**. It asks once about three things: the tracked-link cookie, videos from YouTube and Vimeo, and marketing email.

- **All three start off.** **Reject all** and **Accept all** are equal, side by side.
- **Choose for each** opens the three switches.
- **Riya changes them any time** on the Profile tab, under **Privacy choices**. The footer''s **Privacy choices** button brings the card back.

If a browser sends Global Privacy Control, the tracked-link cookie is never set, even after an earlier yes. Marketing email goes only with a recorded yes.

## Data requests

Riya owns her data. On the Profile tab, **Your data** holds **Export my data**, **Erase everything** and **Delete my account**.

- **Each one asks first** in a sheet.
- **Each request is logged without a name.** Those rows are kept for three years.
- **You never do it for her by hand.** If she writes in, point her to that row. Deleting an account from Admin, People is the same delete.

## The Grievance Officer

India''s privacy law asks for a named person to take complaints. The business''s details, the Grievance Officer''s name and email among them, are set on the server by whoever deploys the app. They are never typed into the code.

1. Open the public **Contact** page.
2. Check that the Grievance Officer''s name and email show.
3. If a field says "not set yet", ask whoever deploys to set it before launch.

The privacy card points questions to that officer. Never state a reply time unless the business sets one. Never claim a certification, a compliance label or an uptime number in any copy.

## What never reaches staff

- **The journal and wellbeing:** never to brands, staff, the leaderboard or Club selection.
- **Discover answers and results:** only the owner sees them.
- **The Companion''s chats:** private to the person.
- **The Finance app:** private to the person, but a super admin can read its tables from Admin, **People**, **Tables**, read only, with each one in the audit log.
- **Fitness and supplements:** private to the person.
- **Agency clients, fees and notes:** owner only.
- **A life coach:** sees only what the student switched on: the six parts, and whole tables one by one, read only. The journal and supplements reach a coach only that way.
- **Tables with other people''s details:** buyers, guests, leads, clients, applicants, chats, Agency, Discover and the Companion. Only the person and AI chat on a model that keeps nothing read them, never a coach or staff, not even a super admin.

> **Pro tip:** before you switch an app on for everyone, look at its card on the build map. If it says it needs a key, set the key first.

> **Result:** Riya gets new apps when they are ready, her choices stick, and her private things stay private.

## The bottom line

Flags decide what is live. Dev Tools and Logs show what is happening. Privacy is a duty, not a setting: check the Contact page, let people manage their own data, and never look where staff do not belong.', 25, 1);
