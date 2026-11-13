-- 0150: Admin guide lessons 02, 03, 08, 09, 19, 21 and 24 brought up to their files after the second review of All tables (2026-11-13):
-- they no longer say no admin screen shows a member's map, tasks, reviews, Finance or time blocks (a super admin reads those as the member's
-- tables, read only, each look in the audit log), and they name the tables a student may switch on for a coach. Every lesson keeps its place.
-- Made with: node scripts/admin-guide/build.mjs --sync <this file> --only 02,03,08,09,19,21,24. Safe to run again.
UPDATE learning_items SET sequence = 1 WHERE id = 'prog-admin-guide-l01' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET module_title = 'Pillars and the strategy session', body = 'Riya has her apps. But apps alone do not tell her where her life needs work. The Pillars tab does. It holds the seven relationships of her life, and the strategy session sets them up in one sitting.

In this lesson you''ll learn:

- How Riya runs the strategy session, part by part.
- What the pyramid is, and its six layers.
- Where the life map, the routine and the contract live after.
- What an admin can and cannot see.

## The seven pillars

Riya opens the **Pillars** tab. It reads "Your seven pillars". Each pillar is one relationship: Servitude, Friends, Family, Love, Yourself, Teachers and Faith. Each has its own guide, like Ember for Servitude and Dew for Yourself.

Before the session, a dark card sits near the top: **Set up your pillars: the strategy session**. She taps it.

## Step one: the map

The session is one chat, hosted by Bumling. First comes the map.

1. A row of seven faces sits at the top, one per relationship.
2. For each one, Riya ticks every feeling she knows from it, on good days and bad ones. Each feeling carries two tags, its number on the scale and its dimension, and she still picks by the words.
3. The feelings come in three groups: **Stuck**, **Owning it** and **At ease**.
4. Love, Teachers or Faith can be set aside with **Not part of my life right now**.
5. If ticking is hard, **Say it in your own words** opens a box. **Read my words** suggests feelings for free. **Read with AI** shows only with a plan.
6. She taps **That is my map**.

From her ticks, the app works out where she usually is and where she drops under stress. The key line is **Courage**. A relationship that drops below it is a good place to start. If she places one at Inner light or higher, she is asked for one thing she did last week that shows it.

## Step two: what gets in the way

Next she names fears and insecurities. A fear shows up when she is about to act. An insecurity is what she worries others notice. She picks the relationship each one touches, then taps **That is what gets in the way**. Sending it empty is fine.

## Step three: the scorecard and her real day

1. She rates her health, her wealth and each relationship from one to five stars, then taps **Those are my stars**.
2. If a high score does not match her map, one quick question asks how many days last week she acted with courage there.
3. She fills in a normal day as it is now: **Wake up**, **Lights out**, **Work starts**, **Work ends** and a few more. Then **That is my day**.

## Step four: focus, routine and practices

1. Bumling shows her map and suggests where to start. Riya keeps the picks or chooses her own, up to two, and taps **Work on these**.
2. Her routine appears. It has six blocks, built from her real day. Only the morning has steps to tick. She taps **Looks right**.
3. Lumen, guide to faith, asks for her morning practices: a mantra, a breathing exercise, a line to say and something to read. **Those are my practices**.

For every week she keeps the routine on five days, her wake-up time moves thirty minutes earlier, until half past six.

## Step five: the contract

The contract turns the plan into a promise.

- **Days a week, at least:** five to start with.
- **Daily check-in time:** a reminder lands in her inbox at that time on any day she has not checked in.
- **When a week falls short:** The streak breaks, Unlocks wait, or The coach sees it.
- **Type your name to sign:** she types "Riya" and taps **Sign it**.

A switch offers a live call with a coach, for ₹10,000. Saying yes asks the team and charges nothing while payments are off. Saying no changes nothing.

## Step six: the pyramids

Each focus pillar gets a pyramid. A pyramid has six layers, from the top down:

1. **Foundation:** one thing she will not let break, ever.
2. **Guiding principle:** a line she lives by, so the foundation holds.
3. **Value goal:** how she wants to feel more often.
4. **Goal outcome:** what she would see when the value goal is real.
5. **Project:** a bunch of tasks with a finish line.
6. **Task:** the point at the bottom, one small thing she can tick today.

Each pillar''s guide asks three quick questions. **Write my own** lets her answer in her own words. Then she picks a value goal and a project for each pillar, from six of each, each with a plain why, and taps **Build my pillars**. The chat ends with **Open my pillars** or **Add my interests**.

> **Pro tip:** a person who skips the session can still build a pillar by hand. On a pillar''s page, **Set up this pillar** offers the guide''s ready pyramid, or **Or start by hand with a foundation**.

## After the session

- **Pillar cards:** each card on Pillars now shows where that relationship sits on the map.
- **A pillar''s page:** **Tasks to do** with **Add a task**, then **The pyramid**, where each layer opens to change it or add to it.
- **The life map:** at the bottom of Pillars, under "Your life map". It holds Month one, Where each one sits, Part of your life?, The whole map, Day zero scores, What gets in the way, Your routine and The contract.
- **Your routine:** she can change any block''s times, add or remove morning steps and set their minutes.
- **Again later:** **Run the session again** and **Build the pillars for your focus** sit at the top of the life map.

> **Result:** Riya has a map, one or two focus pillars, a routine, a signed contract and her first pyramids. Her first tasks will show on Daily.

## What an admin checks

The strategy session and Pillars are core. You cannot switch them off for anyone, and they are always open.

1. **Privacy:** her map, scores, fears and contract are hers. The one door is **Tables** in **People**: a super admin can read them there, never change them, and each table you open goes in the audit log. Open one only to answer her question.
2. **Coaches:** a life coach sees only what Riya shares on that link. There are six switches: Daily and streaks, Pillars and pyramids, Routine and contract, Life map answers, Reflection and Patterns. She can turn any off. She can also switch on whole tables for them, one by one, read only.
3. **Making a coach:** use the **Life coaches** tab in Admin to answer people who asked to coach.
4. **The live call:** a person asks from the contract or the life map, every admin hears once in the inbox, and the team writes to set a time. Once payments are live it is paid first, and only the signed webhook marks it paid.

## The bottom line

Pillars is the heart of the app. One session gives Riya her map, her routine, her contract and her pyramids. As an admin, you keep it open, make coaches carefully, and never look inside.', sequence = 2 WHERE id = 'prog-admin-guide-l02' AND program_id = 'prog-admin-guide';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-admin-guide-l02', 'prog-admin-guide', 'Pillars and the strategy session', 'lesson', NULL, 'Riya has her apps. But apps alone do not tell her where her life needs work. The Pillars tab does. It holds the seven relationships of her life, and the strategy session sets them up in one sitting.

In this lesson you''ll learn:

- How Riya runs the strategy session, part by part.
- What the pyramid is, and its six layers.
- Where the life map, the routine and the contract live after.
- What an admin can and cannot see.

## The seven pillars

Riya opens the **Pillars** tab. It reads "Your seven pillars". Each pillar is one relationship: Servitude, Friends, Family, Love, Yourself, Teachers and Faith. Each has its own guide, like Ember for Servitude and Dew for Yourself.

Before the session, a dark card sits near the top: **Set up your pillars: the strategy session**. She taps it.

## Step one: the map

The session is one chat, hosted by Bumling. First comes the map.

1. A row of seven faces sits at the top, one per relationship.
2. For each one, Riya ticks every feeling she knows from it, on good days and bad ones. Each feeling carries two tags, its number on the scale and its dimension, and she still picks by the words.
3. The feelings come in three groups: **Stuck**, **Owning it** and **At ease**.
4. Love, Teachers or Faith can be set aside with **Not part of my life right now**.
5. If ticking is hard, **Say it in your own words** opens a box. **Read my words** suggests feelings for free. **Read with AI** shows only with a plan.
6. She taps **That is my map**.

From her ticks, the app works out where she usually is and where she drops under stress. The key line is **Courage**. A relationship that drops below it is a good place to start. If she places one at Inner light or higher, she is asked for one thing she did last week that shows it.

## Step two: what gets in the way

Next she names fears and insecurities. A fear shows up when she is about to act. An insecurity is what she worries others notice. She picks the relationship each one touches, then taps **That is what gets in the way**. Sending it empty is fine.

## Step three: the scorecard and her real day

1. She rates her health, her wealth and each relationship from one to five stars, then taps **Those are my stars**.
2. If a high score does not match her map, one quick question asks how many days last week she acted with courage there.
3. She fills in a normal day as it is now: **Wake up**, **Lights out**, **Work starts**, **Work ends** and a few more. Then **That is my day**.

## Step four: focus, routine and practices

1. Bumling shows her map and suggests where to start. Riya keeps the picks or chooses her own, up to two, and taps **Work on these**.
2. Her routine appears. It has six blocks, built from her real day. Only the morning has steps to tick. She taps **Looks right**.
3. Lumen, guide to faith, asks for her morning practices: a mantra, a breathing exercise, a line to say and something to read. **Those are my practices**.

For every week she keeps the routine on five days, her wake-up time moves thirty minutes earlier, until half past six.

## Step five: the contract

The contract turns the plan into a promise.

- **Days a week, at least:** five to start with.
- **Daily check-in time:** a reminder lands in her inbox at that time on any day she has not checked in.
- **When a week falls short:** The streak breaks, Unlocks wait, or The coach sees it.
- **Type your name to sign:** she types "Riya" and taps **Sign it**.

A switch offers a live call with a coach, for ₹10,000. Saying yes asks the team and charges nothing while payments are off. Saying no changes nothing.

## Step six: the pyramids

Each focus pillar gets a pyramid. A pyramid has six layers, from the top down:

1. **Foundation:** one thing she will not let break, ever.
2. **Guiding principle:** a line she lives by, so the foundation holds.
3. **Value goal:** how she wants to feel more often.
4. **Goal outcome:** what she would see when the value goal is real.
5. **Project:** a bunch of tasks with a finish line.
6. **Task:** the point at the bottom, one small thing she can tick today.

Each pillar''s guide asks three quick questions. **Write my own** lets her answer in her own words. Then she picks a value goal and a project for each pillar, from six of each, each with a plain why, and taps **Build my pillars**. The chat ends with **Open my pillars** or **Add my interests**.

> **Pro tip:** a person who skips the session can still build a pillar by hand. On a pillar''s page, **Set up this pillar** offers the guide''s ready pyramid, or **Or start by hand with a foundation**.

## After the session

- **Pillar cards:** each card on Pillars now shows where that relationship sits on the map.
- **A pillar''s page:** **Tasks to do** with **Add a task**, then **The pyramid**, where each layer opens to change it or add to it.
- **The life map:** at the bottom of Pillars, under "Your life map". It holds Month one, Where each one sits, Part of your life?, The whole map, Day zero scores, What gets in the way, Your routine and The contract.
- **Your routine:** she can change any block''s times, add or remove morning steps and set their minutes.
- **Again later:** **Run the session again** and **Build the pillars for your focus** sit at the top of the life map.

> **Result:** Riya has a map, one or two focus pillars, a routine, a signed contract and her first pyramids. Her first tasks will show on Daily.

## What an admin checks

The strategy session and Pillars are core. You cannot switch them off for anyone, and they are always open.

1. **Privacy:** her map, scores, fears and contract are hers. The one door is **Tables** in **People**: a super admin can read them there, never change them, and each table you open goes in the audit log. Open one only to answer her question.
2. **Coaches:** a life coach sees only what Riya shares on that link. There are six switches: Daily and streaks, Pillars and pyramids, Routine and contract, Life map answers, Reflection and Patterns. She can turn any off. She can also switch on whole tables for them, one by one, read only.
3. **Making a coach:** use the **Life coaches** tab in Admin to answer people who asked to coach.
4. **The live call:** a person asks from the contract or the life map, every admin hears once in the inbox, and the team writes to set a time. Once payments are live it is paid first, and only the signed webhook marks it paid.

## The bottom line

Pillars is the heart of the app. One session gives Riya her map, her routine, her contract and her pyramids. As an admin, you keep it open, make coaches carefully, and never look inside.', 2, 1);
UPDATE learning_items SET module_title = 'Daily: the boxes, the tasks and the week', body = 'Riya''s pillars are built. Now she needs one place to see what to do today. That is the Daily tab. It is where her plan turns into ticks.

In this lesson you''ll learn:

- How Riya checks in and does her small act.
- How she plans a task: do date, due date, repeat, priority and area of life.
- How the month calendar, Plan my week and time blocks help.
- How the not to do list and Habits work, and what an admin can do.

## Step one: show up

At the top of Daily is **Show up**.

1. Riya taps **I showed up today**. That is her check-in. It pays 10 xp and 10 points and keeps her streak. Every seventh day in a row pays a bonus of 50 points.
2. Under it is her morning routine from the strategy session. She ticks each step. A day counts only when every morning step is ticked.

## Step two: the small act

Next is her guide''s small act for today, like "Dew''s small act for today". It is one two-minute thing for her weakest pillar. Ticking it pays 15 xp.

## Step three: tasks

Under **Tasks** sit the tasks from her pillars. A task pays 20 xp when ticked. Her first three ticks have no wait. After that, a task must be ten minutes old and ten minutes after her last tick.

She ticks a task with the box at its left. To plan one, she taps the task itself. The plan opens right under the task. Its first field, **Task**, is the task''s name, so she can change the words there. **Delete task**, at the plan''s foot, asks first.

1. **Do on:** the do date. The task shows on Daily from that day, and cannot be ticked before. **Tomorrow** and **Next week** are quick picks.
2. **Due by:** the deadline. After it the task shows Overdue, but it never stops a tick.
3. **Repeat:** Every day, Weekdays, Every week, Every month or Every year, every one or more. She can pick the days of the week and a **Stop after** day.
4. **Count it as a habit:** shows while a repeat is set, and is on to start. The task then wears the Habit tag.
5. **Priority:** P0 Do now, P1 Important, P2 Normal or P3 Whenever. It sorts the list and never changes what a tick pays.
6. **Area of life:** No area, or Physical, Financial, Mental, Emotional or Spiritual. The task wears that tag, and a tick counts toward that area in Life.
7. **Remember:** a tag. With a day, one note lands in her inbox on that day, at the task''s time, or at 9:00 when it has none.
8. **Bring it to my review:** the task waits for her next review.
9. **Time** and **Minutes:** when she will do it and how long it should take.

She taps **Save plan**. With minutes set, **Start focus** opens Mindfulness with the task picked and the timer set to that length.

Riya plans "Edit the brand reel": do date Thursday, due Friday, P1, Financial, 90 minutes.

> **Pro tip:** the do date and the due date are not the same. The do date is when she will work on it. The due date is when it must be done. The do date cannot come after the due date.

## Step four: sort and kind of day

- **Kind of day:** a dropdown of her day templates. It starts on **Follow your week**, with the template her week gives that day, like Everyday. Riya picks Deep work day on edit days, and only that date changes. The next lesson covers day templates and her usual week.
- **Area:** once a task has an area, a filter shows every area, one area, or No area.
- **Sort:** Day, Priority, Due date, By context, By time block or By area, at the right beside **Area**. By context keeps P0 first, and inside each priority puts the pillars her day template leads with first. Above the list sit three tabs, **Today**, **Past due** and **Upcoming**, each with its count; **Past due** keeps its own sort, and the eye, **View**, hides the parts of Daily she does not use.
- **By time block** and **By area** draw her tasks in coloured boxes that open and fold, with P0 first in each box.

## Step five: the month and the week

1. **Month calendar** opens a month grid. Each day shows how many tasks are left. She taps a day to see its tasks, or to **Add a task on this day**. Each day wears its kind of day''s colour, and in a day''s sheet she can set that date''s Kind of day, past or future, or pick Follow your week to clear it. **Print this month** gives a clean paper page.
2. **Add a task**, under the list, asks "What is the task?" and "Which project does it hold up?".
3. **Plan my week**, beside the Tasks heading, gives each task with no day a suggested day in the next seven, and a time block. She sets **Hours of planned work a day**. **Worth a look** lists problems, each with a **Fix**. **Add your own** finds any open task. Nothing changes until she taps **Keep what fits**.
4. **Time blocks**, beside Plan my week, opens the page where she shapes her days. On Daily, the **Your day** fold shows each block of her day as a band, with its tasks inside, the free time left and any block that runs over.

## Step six: the lists below

- **To remember:** Remember tasks with no day yet. She picks a day to move one into Tasks.
- **Not scheduled yet:** tasks with no do date and no due date. They never join the main list until she picks a day.
- **Done today:** what she ticked, struck through with the time. It starts folded, with the day''s count beside it. Tapping one unticks it and takes back its xp. It shows ten at a time, with 25 or 50 and the next page under it, so a long day never makes a long page. A pillar''s done tasks and a coach''s view of her day page the same way.

## Step seven: close the unfinished

Riya keeps thinking about a course she stopped and a talk she put off with her sister. Both are tasks already, so she marks them.

1. She taps "Finish the colour course" and picks **Unfinished** under **Bottleneck**, then **Save plan**. "Talk to Meera about Diwali" gets **Unresolved**. A third kind, **Undecided**, is for a choice she keeps turning over.
2. On Home she taps **Close the unfinished**, which shows on the Daily card while a marked task is open. Daily opens with **Bottlenecks** picked in **Sort**: only the marked tasks, one coloured box for each kind, each with its one question.
3. She ends each one from its panel, under **End it**. The course: **Give it a time and date**, Saturday at 10:00, which turns Remember on, so a note comes that day. The talk: **Do it**, which puts it on today. An old guitar plan: **Let it go**, on a second tap. It leaves her lists and reminders and waits under **Let go**, below the boxes, where **Bring back** returns it.

The kind is a tag like the area: it never changes what a tick pays, and **By context** puts these tasks after every priority. Letting go is the archive a task already had, so nothing new is stored but the kind.

## Step eight: not to do and Habits

**Not to do** is the list of things she stays away from, up to seven. Riya adds "No phone in bed" and taps **Add**. Each day she ticks the ones she kept. A kept day pays 5 xp and grows the streak. The three-dot button opens **I slipped today** and **Remove from the list**. A quiet line under the list, **Yesterday: 2 not marked**, marks yesterday in place, and never an earlier day.

**Habits** sits under it. When a task she ticked on three or more days in eight weeks lines up with better or worse days, it shows as a **Good habit** or a **Bad habit**. A line says what went together, never what caused what. A bad one can go to the not to do list.

> **Result:** Riya opens Daily, ticks the check-in, her routine, her small act and her edit task. Her week is planned, and her phone stays out of bed.

## What an admin checks

Daily is core and always on. You cannot switch it off for anyone.

1. **Privacy:** her tasks, not to do list, habits and unfinished business are hers. Only **Tables** in **People** shows them to a super admin, read only, and each table you open goes in the audit log.
2. **Coaches:** a coach sees Daily and streaks only if Riya shares it on their link, or switches its tables on for them.
3. **XP by hand:** in **Admin**, **People**, tap her row. Under **XP**, add or take away xp with a note. The note and your name go to the audit log.
4. **Reviews:** Reviews starts hidden. Riya unhides it herself under **Apps** (Reflection). **What does this person see?** only allows or blocks an app; it never unhides one for her.
5. **Wait and cap:** after her first three ticks, a task must be ten minutes old and ten minutes after her last tick, and only six ticks a day pay xp. These guard against people gaming the boxes.

## The bottom line

Daily is three kinds of boxes and one list of tasks. A do date says when, a due date says by when, and the plan says the rest. As an admin, you keep its rules fair and leave the tasks to their owner.', sequence = 3 WHERE id = 'prog-admin-guide-l03' AND program_id = 'prog-admin-guide';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-admin-guide-l03', 'prog-admin-guide', 'Daily: the boxes, the tasks and the week', 'lesson', NULL, 'Riya''s pillars are built. Now she needs one place to see what to do today. That is the Daily tab. It is where her plan turns into ticks.

In this lesson you''ll learn:

- How Riya checks in and does her small act.
- How she plans a task: do date, due date, repeat, priority and area of life.
- How the month calendar, Plan my week and time blocks help.
- How the not to do list and Habits work, and what an admin can do.

## Step one: show up

At the top of Daily is **Show up**.

1. Riya taps **I showed up today**. That is her check-in. It pays 10 xp and 10 points and keeps her streak. Every seventh day in a row pays a bonus of 50 points.
2. Under it is her morning routine from the strategy session. She ticks each step. A day counts only when every morning step is ticked.

## Step two: the small act

Next is her guide''s small act for today, like "Dew''s small act for today". It is one two-minute thing for her weakest pillar. Ticking it pays 15 xp.

## Step three: tasks

Under **Tasks** sit the tasks from her pillars. A task pays 20 xp when ticked. Her first three ticks have no wait. After that, a task must be ten minutes old and ten minutes after her last tick.

She ticks a task with the box at its left. To plan one, she taps the task itself. The plan opens right under the task. Its first field, **Task**, is the task''s name, so she can change the words there. **Delete task**, at the plan''s foot, asks first.

1. **Do on:** the do date. The task shows on Daily from that day, and cannot be ticked before. **Tomorrow** and **Next week** are quick picks.
2. **Due by:** the deadline. After it the task shows Overdue, but it never stops a tick.
3. **Repeat:** Every day, Weekdays, Every week, Every month or Every year, every one or more. She can pick the days of the week and a **Stop after** day.
4. **Count it as a habit:** shows while a repeat is set, and is on to start. The task then wears the Habit tag.
5. **Priority:** P0 Do now, P1 Important, P2 Normal or P3 Whenever. It sorts the list and never changes what a tick pays.
6. **Area of life:** No area, or Physical, Financial, Mental, Emotional or Spiritual. The task wears that tag, and a tick counts toward that area in Life.
7. **Remember:** a tag. With a day, one note lands in her inbox on that day, at the task''s time, or at 9:00 when it has none.
8. **Bring it to my review:** the task waits for her next review.
9. **Time** and **Minutes:** when she will do it and how long it should take.

She taps **Save plan**. With minutes set, **Start focus** opens Mindfulness with the task picked and the timer set to that length.

Riya plans "Edit the brand reel": do date Thursday, due Friday, P1, Financial, 90 minutes.

> **Pro tip:** the do date and the due date are not the same. The do date is when she will work on it. The due date is when it must be done. The do date cannot come after the due date.

## Step four: sort and kind of day

- **Kind of day:** a dropdown of her day templates. It starts on **Follow your week**, with the template her week gives that day, like Everyday. Riya picks Deep work day on edit days, and only that date changes. The next lesson covers day templates and her usual week.
- **Area:** once a task has an area, a filter shows every area, one area, or No area.
- **Sort:** Day, Priority, Due date, By context, By time block or By area, at the right beside **Area**. By context keeps P0 first, and inside each priority puts the pillars her day template leads with first. Above the list sit three tabs, **Today**, **Past due** and **Upcoming**, each with its count; **Past due** keeps its own sort, and the eye, **View**, hides the parts of Daily she does not use.
- **By time block** and **By area** draw her tasks in coloured boxes that open and fold, with P0 first in each box.

## Step five: the month and the week

1. **Month calendar** opens a month grid. Each day shows how many tasks are left. She taps a day to see its tasks, or to **Add a task on this day**. Each day wears its kind of day''s colour, and in a day''s sheet she can set that date''s Kind of day, past or future, or pick Follow your week to clear it. **Print this month** gives a clean paper page.
2. **Add a task**, under the list, asks "What is the task?" and "Which project does it hold up?".
3. **Plan my week**, beside the Tasks heading, gives each task with no day a suggested day in the next seven, and a time block. She sets **Hours of planned work a day**. **Worth a look** lists problems, each with a **Fix**. **Add your own** finds any open task. Nothing changes until she taps **Keep what fits**.
4. **Time blocks**, beside Plan my week, opens the page where she shapes her days. On Daily, the **Your day** fold shows each block of her day as a band, with its tasks inside, the free time left and any block that runs over.

## Step six: the lists below

- **To remember:** Remember tasks with no day yet. She picks a day to move one into Tasks.
- **Not scheduled yet:** tasks with no do date and no due date. They never join the main list until she picks a day.
- **Done today:** what she ticked, struck through with the time. It starts folded, with the day''s count beside it. Tapping one unticks it and takes back its xp. It shows ten at a time, with 25 or 50 and the next page under it, so a long day never makes a long page. A pillar''s done tasks and a coach''s view of her day page the same way.

## Step seven: close the unfinished

Riya keeps thinking about a course she stopped and a talk she put off with her sister. Both are tasks already, so she marks them.

1. She taps "Finish the colour course" and picks **Unfinished** under **Bottleneck**, then **Save plan**. "Talk to Meera about Diwali" gets **Unresolved**. A third kind, **Undecided**, is for a choice she keeps turning over.
2. On Home she taps **Close the unfinished**, which shows on the Daily card while a marked task is open. Daily opens with **Bottlenecks** picked in **Sort**: only the marked tasks, one coloured box for each kind, each with its one question.
3. She ends each one from its panel, under **End it**. The course: **Give it a time and date**, Saturday at 10:00, which turns Remember on, so a note comes that day. The talk: **Do it**, which puts it on today. An old guitar plan: **Let it go**, on a second tap. It leaves her lists and reminders and waits under **Let go**, below the boxes, where **Bring back** returns it.

The kind is a tag like the area: it never changes what a tick pays, and **By context** puts these tasks after every priority. Letting go is the archive a task already had, so nothing new is stored but the kind.

## Step eight: not to do and Habits

**Not to do** is the list of things she stays away from, up to seven. Riya adds "No phone in bed" and taps **Add**. Each day she ticks the ones she kept. A kept day pays 5 xp and grows the streak. The three-dot button opens **I slipped today** and **Remove from the list**. A quiet line under the list, **Yesterday: 2 not marked**, marks yesterday in place, and never an earlier day.

**Habits** sits under it. When a task she ticked on three or more days in eight weeks lines up with better or worse days, it shows as a **Good habit** or a **Bad habit**. A line says what went together, never what caused what. A bad one can go to the not to do list.

> **Result:** Riya opens Daily, ticks the check-in, her routine, her small act and her edit task. Her week is planned, and her phone stays out of bed.

## What an admin checks

Daily is core and always on. You cannot switch it off for anyone.

1. **Privacy:** her tasks, not to do list, habits and unfinished business are hers. Only **Tables** in **People** shows them to a super admin, read only, and each table you open goes in the audit log.
2. **Coaches:** a coach sees Daily and streaks only if Riya shares it on their link, or switches its tables on for them.
3. **XP by hand:** in **Admin**, **People**, tap her row. Under **XP**, add or take away xp with a note. The note and your name go to the audit log.
4. **Reviews:** Reviews starts hidden. Riya unhides it herself under **Apps** (Reflection). **What does this person see?** only allows or blocks an app; it never unhides one for her.
5. **Wait and cap:** after her first three ticks, a task must be ten minutes old and ten minutes after her last tick, and only six ticks a day pay xp. These guard against people gaming the boxes.

## The bottom line

Daily is three kinds of boxes and one list of tasks. A do date says when, a due date says by when, and the plan says the rest. As an admin, you keep its rules fair and leave the tasks to their owner.', 3, 1);
UPDATE learning_items SET module_title = 'Time blocks: the shape of a member''s day', body = 'Riya''s tasks have dates now. But a date does not say when in the day. Time blocks give her day a shape: Deep work in the morning, Recovery after lunch, Sleep at night. Her tasks then fall into those blocks.

In this lesson you''ll learn:

- What Riya sets up: blocks, day templates, her usual week and one-day changes.
- How her tasks fall into blocks, and how Daily and Plan my week use them.
- What emerges from it, and what stays private.
- What to check when a member asks for help, and why nothing here is staff-only.

## Where it lives

Time blocks is a page under Daily, not an app. It is core, like Daily, so it is always on. It is not on Apps, and it is not in **What does this person see?**. Nobody can switch it off. A super admin sees its blocks and templates only as the member''s tables, read only.

Riya reaches it three ways:

1. **Time blocks**, beside **Plan my week** at the Tasks heading on Daily.
2. **Edit kind of day**, the small link under Daily''s sort row.
3. The gear at the top of Plan my week.

## Step one: the starting set

The first time Riya opens Daily or the page, the app gives her a starting set, once:

- **18 blocks.** Ten make up a normal day, from Morning hygiene at 7 am to Sleep at 11 pm. Travel, Family time, Date, Reflection, Shoot, Edit, Plan and prep, and Post are used by some templates.
- **17 day templates.** Everyday is the default. The rest are Deep work day, Create day, Learning day, Money day, Admin day, Family day, Recovery day, Social day, Date day, Reflection day, Low energy day, Self love day, Travel day, Edit day, Shoot day and Plan and post day. The last three carry a list of steps in each content block, which Daily shows, and **Add to my tasks** turns one list into one task with subtasks. Someone set up before them gets them with **Bring back the starting set**, which never goes past 24 blocks or 24 templates.

Every one is hers to change. The page says so above the templates: "The starting ones are yours to change."

## Step two: her blocks

A block has a name, a tag, a colour and, if she likes, an area of life and a pillar. Under **Blocks**, Riya taps Deep work and changes it.

1. **Tag:** a word or two, like Focus, Admin, Self care or Recovery. She can type her own.
2. **Colour:** eleven colours round a wheel, from amber to lime. The twelfth button, the pipette, opens a small card for her own colour. She types a hex code like 1E90FF, or a colour name like teal, and taps the tick. A day template picks its colour the same way.
3. **Area of life** and **Pillar:** tasks in that area, or of that pillar, are suggested for this block.
4. She taps **Save**.

**Add a block** makes a new one, and **Arrange** changes the order. Deleting a block asks first. Her tasks stay; they only lose the block. She can keep up to 24 blocks.

## Step three: her day templates

A day template lays blocks on the clock, with the pillar that leads, a second pillar and a colour of its own. It is her kind of day. Riya opens Deep work day under **Day templates**.

1. Each slot is a block with a start and an end. An end before the start runs past midnight, like Sleep from 11 pm to 7 am.
2. Slots never overlap. If two do, a line names both, and **Save** waits until she fixes it. A gap shows as free time.
3. **Save** keeps the change. **Save as new** keeps a copy instead.
4. The three dots hold **Make it the default**, **Copy** and **Delete**.

She can keep up to 24 templates, each with up to 24 slots. **New template** copies the day she is looking at as "My day".

## Step four: her usual week, and one-day changes

Every day starts on her default, Everyday. Under **Your usual week**, Riya opens **Set each weekday** and gives Sunday Family day. Each change saves at once.

Some days do not fit. For one date only, she picks another template in **Kind of day**, on Daily or under the day she taps in **This week**, or in the month calendar on Daily: she taps any day, past or future, and picks its Kind of day. A changed day wears a **Changed** tag, and her week stays as it was. **Use it on more days** puts a template on other weekdays, **Every week** or **This week only**. **Follow your week** undoes a one-day change.

## Step five: tasks in blocks

A task finds its block in one of four ways:

1. She picks it in the task''s plan, under **Time block**.
2. Left on **By its time**, a task sits in the block its time falls in.
3. Plan my week suggests one, from the task''s area of life, else its pillar. P0 and P1 lean to a block tagged Focus. P2 and P3 lean to the others.
4. Daily suggests one. Under **By time block**, a task with no block and no time shows as **Suggested** inside the block that fits, with **Keep here**. Nothing is saved until she taps. It never suggests her night''s sleep, a full block or a block already over.

A timed task in a block meant for something else gets one quiet line, with **Move it** or **Keep here**. The task''s form says the same under its time.

On Daily, **Sort** has **By time block** and **By area**. Each draws her tasks in coloured boxes, up to 60 tasks, with P0 first in every box. **By context** reads the pillar her day template leads with. **Your day**, a fold above the list, shows each block as a band with "45 min free" or "Over by 30 min".

In Plan my week, each suggestion shows its block, with a select to change it. **Worth a look** says when a block holds too much on a day, or when a Focus block is empty. Nothing changes until she taps **Keep what fits**.

> **Pro tip:** when a member says Daily feels like a wall of tasks, point them to **By time block**. Seeing the day as boxes often does more than another rule.

## What emerges

After some weeks, Emerging on Daily reads her blocks back to her. It may say "You ticked 14 of 20 Deep work tasks inside the block." It also sets the tasks she ticks on one kind of day beside her other days.

**Your kinds of day** shows her last four weeks by kind, each in its own colour, and how each kind went beside her other days: tasks ticked, and focus minutes and mood while those apps are on. She sees it on Daily, on the Time blocks page, under Emerging and on Reviews. A day counts as the kind set for that date, else the one her week gives it. Days on Everyday count as no kind. Reviews also has a **Kinds of day** tile for the period, and **This month** on the Time blocks page counts her days of each kind so far. Every line says what went together, never what caused what.

> **Result:** Riya''s Monday is a Deep work day, her Sunday a Family day, and her tasks sit in the blocks where they fit. When a trip comes up, she changes one date and her week stays whole.

## What an admin checks

Nothing here is staff-only. There is no switch and no override, and you change nothing for them. A super admin can read a member''s blocks and templates under **Tables** in **People**, read only, and each look goes in the audit log. When a member asks, you guide them on their own screen.

1. **"My starting blocks are gone."** At the foot of the page, **Bring back the starting set** adds back any starting block or template they deleted. Their own stay as they are.
2. **"I can''t delete a template."** It is the default. They make another one the default first.
3. **"I can''t add a block."** They have 24, the most anyone can keep. Templates stop at 24 too.
4. **"A slot won''t save."** Two slots overlap. The line under them names both.
5. **"A task is in the wrong block."** A block picked in the task''s plan wins over its time. They set it back to **By its time**. A task with no block and no time shows as Suggested until they keep it.
6. **"My Everyday days are not counted."** Everyday is the default, and a day on it counts as no kind. They give a day a kind on Daily or in the month calendar, or set a weekday''s template in their usual week.
7. **"Daily sorts in an odd order."** On a day that follows the default, Daily sorts by day. A changed date or another weekday template sorts By context. Any sort they pick stays theirs.
8. **The assistant:** with a plan, it can read their blocks and set a day''s template for them, each with Undo.
9. **Privacy:** a coach sees blocks or templates only as the Time blocks or Day templates table, when the person switches it on for them. The Logs show that a change was made, never which template.
10. **Their data:** blocks, templates and the week are in their export. **Erase everything** keeps them, since they are settings, not progress. Deleting the account removes them.

## The bottom line

Time blocks give a member''s day a shape, and a day template is their kind of day. It is theirs from end to end. As an admin, you know where each button is, so you can guide them, and you leave the blocks to their owner.', sequence = 4 WHERE id = 'prog-admin-guide-l24' AND program_id = 'prog-admin-guide';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-admin-guide-l24', 'prog-admin-guide', 'Time blocks: the shape of a member''s day', 'lesson', NULL, 'Riya''s tasks have dates now. But a date does not say when in the day. Time blocks give her day a shape: Deep work in the morning, Recovery after lunch, Sleep at night. Her tasks then fall into those blocks.

In this lesson you''ll learn:

- What Riya sets up: blocks, day templates, her usual week and one-day changes.
- How her tasks fall into blocks, and how Daily and Plan my week use them.
- What emerges from it, and what stays private.
- What to check when a member asks for help, and why nothing here is staff-only.

## Where it lives

Time blocks is a page under Daily, not an app. It is core, like Daily, so it is always on. It is not on Apps, and it is not in **What does this person see?**. Nobody can switch it off. A super admin sees its blocks and templates only as the member''s tables, read only.

Riya reaches it three ways:

1. **Time blocks**, beside **Plan my week** at the Tasks heading on Daily.
2. **Edit kind of day**, the small link under Daily''s sort row.
3. The gear at the top of Plan my week.

## Step one: the starting set

The first time Riya opens Daily or the page, the app gives her a starting set, once:

- **18 blocks.** Ten make up a normal day, from Morning hygiene at 7 am to Sleep at 11 pm. Travel, Family time, Date, Reflection, Shoot, Edit, Plan and prep, and Post are used by some templates.
- **17 day templates.** Everyday is the default. The rest are Deep work day, Create day, Learning day, Money day, Admin day, Family day, Recovery day, Social day, Date day, Reflection day, Low energy day, Self love day, Travel day, Edit day, Shoot day and Plan and post day. The last three carry a list of steps in each content block, which Daily shows, and **Add to my tasks** turns one list into one task with subtasks. Someone set up before them gets them with **Bring back the starting set**, which never goes past 24 blocks or 24 templates.

Every one is hers to change. The page says so above the templates: "The starting ones are yours to change."

## Step two: her blocks

A block has a name, a tag, a colour and, if she likes, an area of life and a pillar. Under **Blocks**, Riya taps Deep work and changes it.

1. **Tag:** a word or two, like Focus, Admin, Self care or Recovery. She can type her own.
2. **Colour:** eleven colours round a wheel, from amber to lime. The twelfth button, the pipette, opens a small card for her own colour. She types a hex code like 1E90FF, or a colour name like teal, and taps the tick. A day template picks its colour the same way.
3. **Area of life** and **Pillar:** tasks in that area, or of that pillar, are suggested for this block.
4. She taps **Save**.

**Add a block** makes a new one, and **Arrange** changes the order. Deleting a block asks first. Her tasks stay; they only lose the block. She can keep up to 24 blocks.

## Step three: her day templates

A day template lays blocks on the clock, with the pillar that leads, a second pillar and a colour of its own. It is her kind of day. Riya opens Deep work day under **Day templates**.

1. Each slot is a block with a start and an end. An end before the start runs past midnight, like Sleep from 11 pm to 7 am.
2. Slots never overlap. If two do, a line names both, and **Save** waits until she fixes it. A gap shows as free time.
3. **Save** keeps the change. **Save as new** keeps a copy instead.
4. The three dots hold **Make it the default**, **Copy** and **Delete**.

She can keep up to 24 templates, each with up to 24 slots. **New template** copies the day she is looking at as "My day".

## Step four: her usual week, and one-day changes

Every day starts on her default, Everyday. Under **Your usual week**, Riya opens **Set each weekday** and gives Sunday Family day. Each change saves at once.

Some days do not fit. For one date only, she picks another template in **Kind of day**, on Daily or under the day she taps in **This week**, or in the month calendar on Daily: she taps any day, past or future, and picks its Kind of day. A changed day wears a **Changed** tag, and her week stays as it was. **Use it on more days** puts a template on other weekdays, **Every week** or **This week only**. **Follow your week** undoes a one-day change.

## Step five: tasks in blocks

A task finds its block in one of four ways:

1. She picks it in the task''s plan, under **Time block**.
2. Left on **By its time**, a task sits in the block its time falls in.
3. Plan my week suggests one, from the task''s area of life, else its pillar. P0 and P1 lean to a block tagged Focus. P2 and P3 lean to the others.
4. Daily suggests one. Under **By time block**, a task with no block and no time shows as **Suggested** inside the block that fits, with **Keep here**. Nothing is saved until she taps. It never suggests her night''s sleep, a full block or a block already over.

A timed task in a block meant for something else gets one quiet line, with **Move it** or **Keep here**. The task''s form says the same under its time.

On Daily, **Sort** has **By time block** and **By area**. Each draws her tasks in coloured boxes, up to 60 tasks, with P0 first in every box. **By context** reads the pillar her day template leads with. **Your day**, a fold above the list, shows each block as a band with "45 min free" or "Over by 30 min".

In Plan my week, each suggestion shows its block, with a select to change it. **Worth a look** says when a block holds too much on a day, or when a Focus block is empty. Nothing changes until she taps **Keep what fits**.

> **Pro tip:** when a member says Daily feels like a wall of tasks, point them to **By time block**. Seeing the day as boxes often does more than another rule.

## What emerges

After some weeks, Emerging on Daily reads her blocks back to her. It may say "You ticked 14 of 20 Deep work tasks inside the block." It also sets the tasks she ticks on one kind of day beside her other days.

**Your kinds of day** shows her last four weeks by kind, each in its own colour, and how each kind went beside her other days: tasks ticked, and focus minutes and mood while those apps are on. She sees it on Daily, on the Time blocks page, under Emerging and on Reviews. A day counts as the kind set for that date, else the one her week gives it. Days on Everyday count as no kind. Reviews also has a **Kinds of day** tile for the period, and **This month** on the Time blocks page counts her days of each kind so far. Every line says what went together, never what caused what.

> **Result:** Riya''s Monday is a Deep work day, her Sunday a Family day, and her tasks sit in the blocks where they fit. When a trip comes up, she changes one date and her week stays whole.

## What an admin checks

Nothing here is staff-only. There is no switch and no override, and you change nothing for them. A super admin can read a member''s blocks and templates under **Tables** in **People**, read only, and each look goes in the audit log. When a member asks, you guide them on their own screen.

1. **"My starting blocks are gone."** At the foot of the page, **Bring back the starting set** adds back any starting block or template they deleted. Their own stay as they are.
2. **"I can''t delete a template."** It is the default. They make another one the default first.
3. **"I can''t add a block."** They have 24, the most anyone can keep. Templates stop at 24 too.
4. **"A slot won''t save."** Two slots overlap. The line under them names both.
5. **"A task is in the wrong block."** A block picked in the task''s plan wins over its time. They set it back to **By its time**. A task with no block and no time shows as Suggested until they keep it.
6. **"My Everyday days are not counted."** Everyday is the default, and a day on it counts as no kind. They give a day a kind on Daily or in the month calendar, or set a weekday''s template in their usual week.
7. **"Daily sorts in an odd order."** On a day that follows the default, Daily sorts by day. A changed date or another weekday template sorts By context. Any sort they pick stays theirs.
8. **The assistant:** with a plan, it can read their blocks and set a day''s template for them, each with Undo.
9. **Privacy:** a coach sees blocks or templates only as the Time blocks or Day templates table, when the person switches it on for them. The Logs show that a change was made, never which template.
10. **Their data:** blocks, templates and the week are in their export. **Erase everything** keeps them, since they are settings, not progress. Deleting the account removes them.

## The bottom line

Time blocks give a member''s day a shape, and a day template is their kind of day. It is theirs from end to end. As an admin, you know where each button is, so you can guide them, and you leave the blocks to their owner.', 4, 1);
UPDATE learning_items SET sequence = 5 WHERE id = 'prog-admin-guide-l04' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 6 WHERE id = 'prog-admin-guide-l05' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 7 WHERE id = 'prog-admin-guide-l06' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 8 WHERE id = 'prog-admin-guide-l07' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 9 WHERE id = 'prog-admin-guide-l25' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET module_title = 'Mindfulness: breathe and focus', body = 'Riya has a forty-minute edit to finish before lunch. Her phone buzzes and her mind wanders. Mindfulness gives her one calm place to breathe for two minutes, then focus on that one task with a clock that keeps going even when she leaves the page.

In this lesson you''ll learn:

- How Riya breathes with the circles and logs mindful minutes.
- How she runs a Timer, a Pomodoro and a Stopwatch on a task.
- How she sets sounds, a daily goal and a nudge.
- What an admin can switch and check for this app.

## Find it

Mindfulness starts hidden on a new account, unless the setup chat showed it for her. Riya opens **Apps**, opens the **Reflection** group, opens **Hidden apps** at its end and taps the eye beside **Mindfulness**. The screen opens from Wellbeing too.

The hero shows her mindful minutes this week. Under it is one dark card called **Breathe and focus**, with four tabs: **Breathe**, **Timer**, **Pomodoro** and **Stopwatch**.

## Step by step: Breathe

1. Riya taps the **Breathe** tab.
2. She picks a pattern. Calm exhale is first: in for 4, hold for 4, out for 6, rest for 2. Others are Box, 4-7-8, Even, Triangle, Longer out, Pranayam and Sigh.
3. She picks a cue: Soft chime, Bell, Voice or No cue.
4. She taps a quick length, such as 3 minutes, or drags the ruler from 1 to 30.
5. She taps **Start**. A row of glass circles fills one step at a time, each with the word and the seconds left.

A finished breath always logs mindful minutes. If a count feels too fast, she taps the "per count" button beside the total and drags the ruler to hold each count longer.

## Step by step: Timer on a task

1. Riya taps the round **Focus on a task** button at the top right of the section.
2. The sheet shows her recent tasks and a search. She picks "Cut the brand reel". She could pick **No task** instead.
3. She taps the **Timer** tab and sets 40 minutes on the ruler.
4. She taps **Start**. The tab title now shows the time and her task.

If she taps Stop past a whole minute, a sheet asks **Stop here?** She picks **Keep 23 minutes** or **Throw it away**. Under a minute, nothing is kept.

On Daily, a task with a time estimate shows **Start focus** with its minutes. That opens Mindfulness with the task picked and the first round set to that length.

## Pomodoro and Stopwatch

- **Pomodoro:** focus parts with short and long breaks. Riya picks Short break, Long break, Sessions between long breaks and Total sessions from four small chips. **Skip** moves to the next part. **Stop** goes back to session one.
- **This part:** while a part runs, plus or minus 1 and 5 nudge its length.
- **Stopwatch:** counts up. Stop keeps the whole minutes, if that switch is on. Reset keeps nothing.
- **Rate it:** after a focus session she can tap how focused she was, from Scattered to Deep, or Skip. It pays nothing and only she sees it.

## The clock follows her

When Riya leaves Mindfulness, the clock keeps running. A small pill shows the time in a corner. Its colour moves from blue to green to orange to red as time runs out, and turns violet in a break. On a laptop she can pause, restart or stop from it.

If she opens the same clock in two tabs, only one tab logs it. The other shows "Running in another tab".

## Settings and sounds

1. Riya taps the round **Timer settings** button.
2. Under **Your plan** she picks Classic 25/5, Deep 50/10 or Light 15/3.
3. She checks three switches. Finished focus sessions count as mindful minutes by default. Breaks do not. Starting the next part by itself is off.
4. She turns on **A daily focus goal** and sets 90 minutes. It shows under the timer as "50 of 90 minutes today". There is no streak to lose.
5. She turns on **Remind me to focus**, picks a time and the days. One inbox note comes on those days, and none on a day she already focused.

The round sound button is the master switch for every sound. The **Background music** button opens Rain, Ocean, Wind, Soft hum or Lo-fi, with a volume. All of them are made in the browser. **Full screen** makes the section cover the page.

These settings are saved on her account, so they follow her to her laptop.

## Today, the dashboard and Sessions

- **Today:** under the panel, today''s sessions, newest first. Each has **Continue** to start the same clock again. She taps a row to change its length or task, or to delete it.
- **Add a session I forgot:** adds one for today or yesterday.
- **How productive you were:** focus time and tasks ticked, by Days, Weeks or Months, in Minutes or Hours.
- **Sessions:** her mindful logs. Each has a trash button. One tap turns it red with **Tap again to delete**; a second tap deletes the session, and a wait of a few seconds puts it back.

> **Pro tip:** on a laptop, Space starts or pauses, S stops and K skips in Pomodoro. Press ? to see the list. Keys never fire while she types in a box.

> **Result:** Riya breathes for three minutes, focuses for forty on one task, and sees her focus time add up across the week.

## What the admin checks

- **No pay to police:** logging mindful minutes pays no xp. Deleting a session takes nothing back.
- **Private numbers:** mindful minutes are wellbeing data. They reach a coach only through the student''s Reflection switch or a table she switches on for them. They never reach a brand or a staff screen, not even a member''s tables.
- **Switches:** in Admin, **Flags**, the Mindfulness row sets On, Minimum role, Rollout % and Overrides. In **People**, **What does this person see?** sets it for one person.
- **Sound help:** if someone hears nothing, ask them to tap Start once. Browsers only allow sound after a tap. Then check the master sound switch.
- **Fullscreen help:** Escape, the same button, or leaving the page ends full screen.

## The bottom line

Mindfulness is one card with four clocks. Teach people to pick a task first, then pick a clock. As an admin, keep it switched on, and point people to the settings sheet before they ask for a feature that is already there.', sequence = 10 WHERE id = 'prog-admin-guide-l08' AND program_id = 'prog-admin-guide';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-admin-guide-l08', 'prog-admin-guide', 'Mindfulness: breathe and focus', 'lesson', NULL, 'Riya has a forty-minute edit to finish before lunch. Her phone buzzes and her mind wanders. Mindfulness gives her one calm place to breathe for two minutes, then focus on that one task with a clock that keeps going even when she leaves the page.

In this lesson you''ll learn:

- How Riya breathes with the circles and logs mindful minutes.
- How she runs a Timer, a Pomodoro and a Stopwatch on a task.
- How she sets sounds, a daily goal and a nudge.
- What an admin can switch and check for this app.

## Find it

Mindfulness starts hidden on a new account, unless the setup chat showed it for her. Riya opens **Apps**, opens the **Reflection** group, opens **Hidden apps** at its end and taps the eye beside **Mindfulness**. The screen opens from Wellbeing too.

The hero shows her mindful minutes this week. Under it is one dark card called **Breathe and focus**, with four tabs: **Breathe**, **Timer**, **Pomodoro** and **Stopwatch**.

## Step by step: Breathe

1. Riya taps the **Breathe** tab.
2. She picks a pattern. Calm exhale is first: in for 4, hold for 4, out for 6, rest for 2. Others are Box, 4-7-8, Even, Triangle, Longer out, Pranayam and Sigh.
3. She picks a cue: Soft chime, Bell, Voice or No cue.
4. She taps a quick length, such as 3 minutes, or drags the ruler from 1 to 30.
5. She taps **Start**. A row of glass circles fills one step at a time, each with the word and the seconds left.

A finished breath always logs mindful minutes. If a count feels too fast, she taps the "per count" button beside the total and drags the ruler to hold each count longer.

## Step by step: Timer on a task

1. Riya taps the round **Focus on a task** button at the top right of the section.
2. The sheet shows her recent tasks and a search. She picks "Cut the brand reel". She could pick **No task** instead.
3. She taps the **Timer** tab and sets 40 minutes on the ruler.
4. She taps **Start**. The tab title now shows the time and her task.

If she taps Stop past a whole minute, a sheet asks **Stop here?** She picks **Keep 23 minutes** or **Throw it away**. Under a minute, nothing is kept.

On Daily, a task with a time estimate shows **Start focus** with its minutes. That opens Mindfulness with the task picked and the first round set to that length.

## Pomodoro and Stopwatch

- **Pomodoro:** focus parts with short and long breaks. Riya picks Short break, Long break, Sessions between long breaks and Total sessions from four small chips. **Skip** moves to the next part. **Stop** goes back to session one.
- **This part:** while a part runs, plus or minus 1 and 5 nudge its length.
- **Stopwatch:** counts up. Stop keeps the whole minutes, if that switch is on. Reset keeps nothing.
- **Rate it:** after a focus session she can tap how focused she was, from Scattered to Deep, or Skip. It pays nothing and only she sees it.

## The clock follows her

When Riya leaves Mindfulness, the clock keeps running. A small pill shows the time in a corner. Its colour moves from blue to green to orange to red as time runs out, and turns violet in a break. On a laptop she can pause, restart or stop from it.

If she opens the same clock in two tabs, only one tab logs it. The other shows "Running in another tab".

## Settings and sounds

1. Riya taps the round **Timer settings** button.
2. Under **Your plan** she picks Classic 25/5, Deep 50/10 or Light 15/3.
3. She checks three switches. Finished focus sessions count as mindful minutes by default. Breaks do not. Starting the next part by itself is off.
4. She turns on **A daily focus goal** and sets 90 minutes. It shows under the timer as "50 of 90 minutes today". There is no streak to lose.
5. She turns on **Remind me to focus**, picks a time and the days. One inbox note comes on those days, and none on a day she already focused.

The round sound button is the master switch for every sound. The **Background music** button opens Rain, Ocean, Wind, Soft hum or Lo-fi, with a volume. All of them are made in the browser. **Full screen** makes the section cover the page.

These settings are saved on her account, so they follow her to her laptop.

## Today, the dashboard and Sessions

- **Today:** under the panel, today''s sessions, newest first. Each has **Continue** to start the same clock again. She taps a row to change its length or task, or to delete it.
- **Add a session I forgot:** adds one for today or yesterday.
- **How productive you were:** focus time and tasks ticked, by Days, Weeks or Months, in Minutes or Hours.
- **Sessions:** her mindful logs. Each has a trash button. One tap turns it red with **Tap again to delete**; a second tap deletes the session, and a wait of a few seconds puts it back.

> **Pro tip:** on a laptop, Space starts or pauses, S stops and K skips in Pomodoro. Press ? to see the list. Keys never fire while she types in a box.

> **Result:** Riya breathes for three minutes, focuses for forty on one task, and sees her focus time add up across the week.

## What the admin checks

- **No pay to police:** logging mindful minutes pays no xp. Deleting a session takes nothing back.
- **Private numbers:** mindful minutes are wellbeing data. They reach a coach only through the student''s Reflection switch or a table she switches on for them. They never reach a brand or a staff screen, not even a member''s tables.
- **Switches:** in Admin, **Flags**, the Mindfulness row sets On, Minimum role, Rollout % and Overrides. In **People**, **What does this person see?** sets it for one person.
- **Sound help:** if someone hears nothing, ask them to tap Start once. Browsers only allow sound after a tap. Then check the master sound switch.
- **Fullscreen help:** Escape, the same button, or leaving the page ends full screen.

## The bottom line

Mindfulness is one card with four clocks. Teach people to pick a task first, then pick a clock. As an admin, keep it switched on, and point people to the settings sheet before they ask for a feature that is already there.', 10, 1);
UPDATE learning_items SET module_title = 'Reviews: looking back by period', body = 'Riya worked hard last month. But did she move the things that matter, or only the urgent ones? A review answers that. The app brings the numbers from every app she uses, and one layer of her own pyramids. She brings the words.

In this lesson you''ll learn:

- How Riya picks one of the six periods and writes her first review.
- How templates give each kind of review its own questions.
- How the review calendar reminds her on the day.
- How a task is brought to a review, and how business metrics work.
- What an admin can check.

## Find it

Reviews starts hidden on a new account, unless the setup chat showed it for her. Riya opens **Apps**, opens the **Reflection** group, opens **Hidden apps** at its end and taps the eye beside **Reviews**.

## The six periods

A review covers one period, and each period walks one layer of her pyramids, pillar by pillar.

- **Day:** the Daily review walks her tasks.
- **Week:** Monday to Sunday. The Weekly review walks her projects.
- **Month:** a calendar month. The Monthly review walks her goal outcomes.
- **Quarter:** three months. The Quarterly review walks her value goals.
- **Half year:** her guiding principles, in two parts. The **Mid-year check-in** opens in July. The **Start-of-year setting** opens in January, beside the yearly review.
- **Year:** the Yearly review walks her foundations.

Each period has one review per person. A period that has not started yet cannot be reviewed. Picking Half year or Year opens the one whose end is nearer.

## Step by step: Riya''s first monthly review

1. Riya opens **Reviews** and uses the period control at the top to choose Month and last month.
2. Under **The numbers**, each tile sits next to the month before. She taps a tile to go where it comes from. Water, habits and more sit here too, and focus and budgets show while Mindfulness and Finance are on.
3. **Day by day** shows her xp per day, and a ring of xp by pillar.
4. **Your goal outcomes, that month** lists the layer this review walks. **Add to my answer** puts a line under the first question.
5. **Tasks you brought** lists any task she flagged.
6. Under **Your monthly review**, she answers one question at a time. Each has a small line naming its idea, such as CBT, ACT or the Gita. Short answers are fine, and she can skip a heavy one.
7. Under **How did it go?** she taps a face, and writes **The one thing to remember**.
8. She taps **Save this review**.

The review is saved with the numbers as they were. New data or a changed template never rewrites it. She can change her words and save again. Her saved reviews show under **Past reviews**, and daily ones fold apart under **Daily reviews**.

The Monthly review opens with "Look at your goal outcomes, pillar by pillar. What did you see this month that shows one is working?" A review is a look back, not therapy. If a member says a question felt heavy, tell them it can be skipped.

**See what''s emerging**, beside The numbers, opens Emerging on the same period.

## Templates

Each period''s built-in set stays, and cannot be edited or removed. Riya reads them all under **Templates**, in **Questions for each period**.

1. **Make my own copy** copies a built-in set so she can change it.
2. Or she taps **New template**. In **Name** she types "Money month".
3. In **Comes back every** she picks Month.
4. In **Questions, one per line** she writes "What did I earn?" and "What did I waste?"
5. She taps **Add template**.

Next month, a **Questions from** box lets her choose between the built-in questions and hers. She can keep up to twelve templates.

## The review calendar

1. Under **Review calendar**, Riya taps **Schedule a review**, or taps a day on the calendar.
2. Under **Which review** she picks Month.
3. She sets **First day** and **Time**, and an optional name.
4. Under **Repeat** she picks Every month. It can also be Every day, Weekdays, Every week on chosen days or Every year, with an end day.
5. She taps **Schedule it**.

On that day, at that time, one note lands in her inbox. On the first day of a period, it opens the one that just ended. A half year or a year goes by the nearer end, so a yearly note on 5 January opens the year just gone. A bell on the calendar is a reminder. A tick is a review she wrote. A daily review takes a dot, not a tick, and rings no bell. Each scheduled review has a **Remind me** switch, and removing one takes a second tap. Reviews she wrote stay. She can schedule up to twenty.

## Bring a task to the review

Riya has a task, "Raise my day rate", that she wants to think about at month end.

1. On Daily, she opens the task''s plan.
2. She turns on **Bring it to my review**.
3. In that month''s review, it shows under **Tasks you brought**, done or still open.
4. She taps **Add to my answer**. It adds a line to her answer and never overwrites it.

A repeating task carries the flag to the next one.

## Business metrics

Riya runs her freelance work like a small studio, so she uses this.

1. Below The numbers on Reviews, under **Business metrics**, she turns on **Show business metrics**. It is off until she does.
2. She taps **Add a metric**.
3. In **Where does the number come from**, she picks **I type it in**, or a number read from Agency, such as Pieces published, Approved first time, Published on time, Billable hours, Utilisation, Invoiced, Paid or New clients.
4. She names it, sets a target and says whether more or less is better.
5. She taps **Add this metric**.

Each metric then sits against its target for the period on screen, from the week to the year. A day is too short for a business number, so it does not show there. She can keep up to twelve.

> **Pro tip:** schedule the weekly review for Sunday evening and the monthly one for the first of the month. The note opens the right period, so it takes one tap to start.

> **Result:** Riya has a review for every month, walking her goal outcomes, a reminder on the day, and the tasks she flagged waiting for her.

## What the admin checks

- **Private words:** a review is the owner''s. Journal and wellbeing numbers in it go only to its owner. A super admin can read her saved answers only through **Tables** in **People**, read only, never the numbers kept with them, and each look goes in the audit log.
- **Coaches:** a coach sees saved reviews only while the student''s Reflection switch or her Reviews table is on for them, and never the snapshot of numbers.
- **Business metrics:** the switch is the person''s own. While it is off, the server refuses everything but the switch. The Agency numbers come from that person''s own Agency records.
- **Reminders:** the cron sends each reminder once. A day missed while nothing ran is skipped, never sent late.
- **Switches:** in Admin, **Flags**, the Reviews row sets On, Minimum role, Rollout % and Overrides. In **People**, **What does this person see?** sets it for one person.

If someone says a reminder did not come, check that the scheduled review''s **Remind me** switch is on and its time is in their own zone.

## The bottom line

Reviews turn a busy month into a clear look back. Teach people to pick a period, answer a few questions and schedule the next one. As an admin, keep Reviews switched on for those who want them, and remember the words are theirs alone.', sequence = 11 WHERE id = 'prog-admin-guide-l09' AND program_id = 'prog-admin-guide';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-admin-guide-l09', 'prog-admin-guide', 'Reviews: looking back by period', 'lesson', NULL, 'Riya worked hard last month. But did she move the things that matter, or only the urgent ones? A review answers that. The app brings the numbers from every app she uses, and one layer of her own pyramids. She brings the words.

In this lesson you''ll learn:

- How Riya picks one of the six periods and writes her first review.
- How templates give each kind of review its own questions.
- How the review calendar reminds her on the day.
- How a task is brought to a review, and how business metrics work.
- What an admin can check.

## Find it

Reviews starts hidden on a new account, unless the setup chat showed it for her. Riya opens **Apps**, opens the **Reflection** group, opens **Hidden apps** at its end and taps the eye beside **Reviews**.

## The six periods

A review covers one period, and each period walks one layer of her pyramids, pillar by pillar.

- **Day:** the Daily review walks her tasks.
- **Week:** Monday to Sunday. The Weekly review walks her projects.
- **Month:** a calendar month. The Monthly review walks her goal outcomes.
- **Quarter:** three months. The Quarterly review walks her value goals.
- **Half year:** her guiding principles, in two parts. The **Mid-year check-in** opens in July. The **Start-of-year setting** opens in January, beside the yearly review.
- **Year:** the Yearly review walks her foundations.

Each period has one review per person. A period that has not started yet cannot be reviewed. Picking Half year or Year opens the one whose end is nearer.

## Step by step: Riya''s first monthly review

1. Riya opens **Reviews** and uses the period control at the top to choose Month and last month.
2. Under **The numbers**, each tile sits next to the month before. She taps a tile to go where it comes from. Water, habits and more sit here too, and focus and budgets show while Mindfulness and Finance are on.
3. **Day by day** shows her xp per day, and a ring of xp by pillar.
4. **Your goal outcomes, that month** lists the layer this review walks. **Add to my answer** puts a line under the first question.
5. **Tasks you brought** lists any task she flagged.
6. Under **Your monthly review**, she answers one question at a time. Each has a small line naming its idea, such as CBT, ACT or the Gita. Short answers are fine, and she can skip a heavy one.
7. Under **How did it go?** she taps a face, and writes **The one thing to remember**.
8. She taps **Save this review**.

The review is saved with the numbers as they were. New data or a changed template never rewrites it. She can change her words and save again. Her saved reviews show under **Past reviews**, and daily ones fold apart under **Daily reviews**.

The Monthly review opens with "Look at your goal outcomes, pillar by pillar. What did you see this month that shows one is working?" A review is a look back, not therapy. If a member says a question felt heavy, tell them it can be skipped.

**See what''s emerging**, beside The numbers, opens Emerging on the same period.

## Templates

Each period''s built-in set stays, and cannot be edited or removed. Riya reads them all under **Templates**, in **Questions for each period**.

1. **Make my own copy** copies a built-in set so she can change it.
2. Or she taps **New template**. In **Name** she types "Money month".
3. In **Comes back every** she picks Month.
4. In **Questions, one per line** she writes "What did I earn?" and "What did I waste?"
5. She taps **Add template**.

Next month, a **Questions from** box lets her choose between the built-in questions and hers. She can keep up to twelve templates.

## The review calendar

1. Under **Review calendar**, Riya taps **Schedule a review**, or taps a day on the calendar.
2. Under **Which review** she picks Month.
3. She sets **First day** and **Time**, and an optional name.
4. Under **Repeat** she picks Every month. It can also be Every day, Weekdays, Every week on chosen days or Every year, with an end day.
5. She taps **Schedule it**.

On that day, at that time, one note lands in her inbox. On the first day of a period, it opens the one that just ended. A half year or a year goes by the nearer end, so a yearly note on 5 January opens the year just gone. A bell on the calendar is a reminder. A tick is a review she wrote. A daily review takes a dot, not a tick, and rings no bell. Each scheduled review has a **Remind me** switch, and removing one takes a second tap. Reviews she wrote stay. She can schedule up to twenty.

## Bring a task to the review

Riya has a task, "Raise my day rate", that she wants to think about at month end.

1. On Daily, she opens the task''s plan.
2. She turns on **Bring it to my review**.
3. In that month''s review, it shows under **Tasks you brought**, done or still open.
4. She taps **Add to my answer**. It adds a line to her answer and never overwrites it.

A repeating task carries the flag to the next one.

## Business metrics

Riya runs her freelance work like a small studio, so she uses this.

1. Below The numbers on Reviews, under **Business metrics**, she turns on **Show business metrics**. It is off until she does.
2. She taps **Add a metric**.
3. In **Where does the number come from**, she picks **I type it in**, or a number read from Agency, such as Pieces published, Approved first time, Published on time, Billable hours, Utilisation, Invoiced, Paid or New clients.
4. She names it, sets a target and says whether more or less is better.
5. She taps **Add this metric**.

Each metric then sits against its target for the period on screen, from the week to the year. A day is too short for a business number, so it does not show there. She can keep up to twelve.

> **Pro tip:** schedule the weekly review for Sunday evening and the monthly one for the first of the month. The note opens the right period, so it takes one tap to start.

> **Result:** Riya has a review for every month, walking her goal outcomes, a reminder on the day, and the tasks she flagged waiting for her.

## What the admin checks

- **Private words:** a review is the owner''s. Journal and wellbeing numbers in it go only to its owner. A super admin can read her saved answers only through **Tables** in **People**, read only, never the numbers kept with them, and each look goes in the audit log.
- **Coaches:** a coach sees saved reviews only while the student''s Reflection switch or her Reviews table is on for them, and never the snapshot of numbers.
- **Business metrics:** the switch is the person''s own. While it is off, the server refuses everything but the switch. The Agency numbers come from that person''s own Agency records.
- **Reminders:** the cron sends each reminder once. A day missed while nothing ran is skipped, never sent late.
- **Switches:** in Admin, **Flags**, the Reviews row sets On, Minimum role, Rollout % and Overrides. In **People**, **What does this person see?** sets it for one person.

If someone says a reminder did not come, check that the scheduled review''s **Remind me** switch is on and its time is in their own zone.

## The bottom line

Reviews turn a busy month into a clear look back. Teach people to pick a period, answer a few questions and schedule the next one. As an admin, keep Reviews switched on for those who want them, and remember the words are theirs alone.', 11, 1);
UPDATE learning_items SET sequence = 12 WHERE id = 'prog-admin-guide-l10' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 13 WHERE id = 'prog-admin-guide-l11' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 14 WHERE id = 'prog-admin-guide-l12' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 15 WHERE id = 'prog-admin-guide-l13' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 16 WHERE id = 'prog-admin-guide-l14' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 17 WHERE id = 'prog-admin-guide-l15' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 18 WHERE id = 'prog-admin-guide-l16' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 19 WHERE id = 'prog-admin-guide-l17' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 20 WHERE id = 'prog-admin-guide-l18' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET module_title = 'Finance: money in, money out and what is owed', body = 'Riya gets paid by brands, sells a small course and pays an editor friend to help on busy weeks. At the end of each month she could never say what she kept. Finance answers that in one screen, and only she can see it.

In this lesson you''ll learn:

- How Riya picks her currency and logs money in and out.
- How she tracks what is owed, what repeats, her budgets and her goals.
- How Agency invoices show up in Finance.
- What an admin can and cannot see here.

## Find Finance

Finance starts hidden on a new account, unless the setup chat showed it for her. It sits in the Creation group.

1. Riya opens the Apps tab and opens the Creation group.
2. She opens **Hidden apps** at its end and taps the eye beside Finance.
3. She taps Finance to open it.

The cover shows four numbers for all time: **earned, spent, kept and platform points**. Under them are two solid buttons, **Money in** and **Money out**. Under those sit four quiet ones: **Owed, Monthly, Goal and Budgets**.

## Pick a currency first

Money is kept in one currency for each person. It is rupees unless the person changes it.

1. Riya opens the Public page app. Its screen is called Profile.
2. She finds **Currency** and picks one from the list.
3. She taps **Save profile**.

Finance adds up only that currency. An entry in another currency is listed, but never added in and never converted. The screen says so under the entries.

## Log money in

1. Riya taps **Money in**.
2. She types the **Amount** and **From whom**, like the brand''s name.
3. She picks a **Category**: Brand deal, Content reward, Courses, Products, Sessions, Affiliate, Ad revenue or Other income.
4. She checks the **Date** and adds a **Note** if she likes.
5. Under **Splits (optional)** she adds her editor''s share. A split stays owed until she marks it paid.
6. She taps **Save**.

## Log money out

1. Riya taps **Money out**.
2. She types the amount and **To whom**.
3. She picks a category: Equipment, Software, Travel, Team, Marketing, Fees, Taxes or Other expense.
4. She taps **Save**.

## Track what is owed

1. Riya taps **Owed**.
2. She picks **Someone owes me** or **I owe someone**.
3. She types **Who**, the **Amount**, **Due by** and a **Note**.
4. She saves it.

It now shows under **Owed**. When the money moves, she taps **Received** or **Paid** on that row. Settled ones fold away under **Settled**. **Remove** asks first.

If Agency is on, her sent invoices show here too, as **Owed to you, invoices**. When she marks an invoice paid in Agency, it counts as income.

## Set what repeats each month

1. Riya taps **Monthly**. The sheet is called **Repeats monthly**.
2. She adds her software plan: the amount, the **Day of the month** and a note.
3. It is posted on that day, every month, under **Repeats monthly**.

## Set budgets

1. Riya taps **Budgets**. The sheet is called **Monthly budgets**.
2. She types a number beside each kind of spending she wants to watch, like Software or Travel.
3. She taps **Save budgets**.

The **Budgets** part shows how each one is going this month.

## Save for a goal

1. Riya taps **Goal**. The sheet is called **New goal**.
2. Under **What for** she types "A new camera".
3. She sets a **Target** and, if she likes, a day under **By (optional)**.
4. Later, on the goal, she types an amount to put aside and taps **Add**.

## Read the month

The month view has arrows to go back and forward. It shows **in, out, net and platform points**, bars over recent months and a **By category** chart. **Entries** lists every line for the month. The **By period** block shows the same numbers for a day, a week, a month, a quarter or a half year.

Riya can also use the assistant. Its free flows include **Add money in or out**, **Note money owed**, **Settle something owed**, **Set a money goal** and **Add to a money goal**.

## What an admin checks

- **It is private:** Finance is the person''s own. Staff, brands and the leaderboard never see it. A super admin can read its tables through **Tables** in **People**, read only, and each look goes in the audit log. Open one only to answer her question.
- **A different Finance:** the **Finance** permission in Admin, People is a staff job. It approves bounty payouts and reviews money orders. It does not open anyone''s Finance app.
- **Turning it on:** use the Flags tab to switch Finance for everyone, a share of people or one person.
- **Their data:** a person''s Finance lists are in their own export, and they go when the account is deleted.

> **Pro tip:** tell a new user to set the currency before logging anything. Riya then sees one clean total instead of a list of entries that are not added in.

> **Result:** at the end of the month Riya can see what came in, what went out, what she kept and what is still owed to her.

## The bottom line

Finance is a private money book. Pick the currency, log money in and out, note what is owed, and let what repeats post itself. Your job as an admin is only to keep the app available. What is inside is never yours to read.', sequence = 21 WHERE id = 'prog-admin-guide-l19' AND program_id = 'prog-admin-guide';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-admin-guide-l19', 'prog-admin-guide', 'Finance: money in, money out and what is owed', 'lesson', NULL, 'Riya gets paid by brands, sells a small course and pays an editor friend to help on busy weeks. At the end of each month she could never say what she kept. Finance answers that in one screen, and only she can see it.

In this lesson you''ll learn:

- How Riya picks her currency and logs money in and out.
- How she tracks what is owed, what repeats, her budgets and her goals.
- How Agency invoices show up in Finance.
- What an admin can and cannot see here.

## Find Finance

Finance starts hidden on a new account, unless the setup chat showed it for her. It sits in the Creation group.

1. Riya opens the Apps tab and opens the Creation group.
2. She opens **Hidden apps** at its end and taps the eye beside Finance.
3. She taps Finance to open it.

The cover shows four numbers for all time: **earned, spent, kept and platform points**. Under them are two solid buttons, **Money in** and **Money out**. Under those sit four quiet ones: **Owed, Monthly, Goal and Budgets**.

## Pick a currency first

Money is kept in one currency for each person. It is rupees unless the person changes it.

1. Riya opens the Public page app. Its screen is called Profile.
2. She finds **Currency** and picks one from the list.
3. She taps **Save profile**.

Finance adds up only that currency. An entry in another currency is listed, but never added in and never converted. The screen says so under the entries.

## Log money in

1. Riya taps **Money in**.
2. She types the **Amount** and **From whom**, like the brand''s name.
3. She picks a **Category**: Brand deal, Content reward, Courses, Products, Sessions, Affiliate, Ad revenue or Other income.
4. She checks the **Date** and adds a **Note** if she likes.
5. Under **Splits (optional)** she adds her editor''s share. A split stays owed until she marks it paid.
6. She taps **Save**.

## Log money out

1. Riya taps **Money out**.
2. She types the amount and **To whom**.
3. She picks a category: Equipment, Software, Travel, Team, Marketing, Fees, Taxes or Other expense.
4. She taps **Save**.

## Track what is owed

1. Riya taps **Owed**.
2. She picks **Someone owes me** or **I owe someone**.
3. She types **Who**, the **Amount**, **Due by** and a **Note**.
4. She saves it.

It now shows under **Owed**. When the money moves, she taps **Received** or **Paid** on that row. Settled ones fold away under **Settled**. **Remove** asks first.

If Agency is on, her sent invoices show here too, as **Owed to you, invoices**. When she marks an invoice paid in Agency, it counts as income.

## Set what repeats each month

1. Riya taps **Monthly**. The sheet is called **Repeats monthly**.
2. She adds her software plan: the amount, the **Day of the month** and a note.
3. It is posted on that day, every month, under **Repeats monthly**.

## Set budgets

1. Riya taps **Budgets**. The sheet is called **Monthly budgets**.
2. She types a number beside each kind of spending she wants to watch, like Software or Travel.
3. She taps **Save budgets**.

The **Budgets** part shows how each one is going this month.

## Save for a goal

1. Riya taps **Goal**. The sheet is called **New goal**.
2. Under **What for** she types "A new camera".
3. She sets a **Target** and, if she likes, a day under **By (optional)**.
4. Later, on the goal, she types an amount to put aside and taps **Add**.

## Read the month

The month view has arrows to go back and forward. It shows **in, out, net and platform points**, bars over recent months and a **By category** chart. **Entries** lists every line for the month. The **By period** block shows the same numbers for a day, a week, a month, a quarter or a half year.

Riya can also use the assistant. Its free flows include **Add money in or out**, **Note money owed**, **Settle something owed**, **Set a money goal** and **Add to a money goal**.

## What an admin checks

- **It is private:** Finance is the person''s own. Staff, brands and the leaderboard never see it. A super admin can read its tables through **Tables** in **People**, read only, and each look goes in the audit log. Open one only to answer her question.
- **A different Finance:** the **Finance** permission in Admin, People is a staff job. It approves bounty payouts and reviews money orders. It does not open anyone''s Finance app.
- **Turning it on:** use the Flags tab to switch Finance for everyone, a share of people or one person.
- **Their data:** a person''s Finance lists are in their own export, and they go when the account is deleted.

> **Pro tip:** tell a new user to set the currency before logging anything. Riya then sees one clean total instead of a list of entries that are not added in.

> **Result:** at the end of the month Riya can see what came in, what went out, what she kept and what is still owed to her.

## The bottom line

Finance is a private money book. Pick the currency, log money in and out, note what is owed, and let what repeats post itself. Your job as an admin is only to keep the app available. What is inside is never yours to read.', 21, 1);
UPDATE learning_items SET sequence = 22 WHERE id = 'prog-admin-guide-l20' AND program_id = 'prog-admin-guide';
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
- **Their tables:** **Tables** on a row opens that member''s tables, read only, with your own session, never the admin key. It never opens the journal, gratitude or a body and mind table, and never a deleted member. Each table you open or download is written to the audit log, and their export lists when. Open one only when you need to, such as to answer their question.

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
- **Their tables:** **Tables** on a row opens that member''s tables, read only, with your own session, never the admin key. It never opens the journal, gratitude or a body and mind table, and never a deleted member. Each table you open or download is written to the audit log, and their export lists when. Open one only when you need to, such as to answer their question.

> **Pro tip:** give a permission, not a role, wherever you can. A creator with Moderator is a guide, and nothing else about their account changes.

> **Result:** Riya is now a mentor and a guide, has a thank-you badge, and sees the apps the team meant her to see.

## The bottom line

People is where you give jobs and thanks. Search, tap the row, and use the panel. Give the smallest power that does the job, and trust the audit log to keep a record of each change.', 23, 1);
UPDATE learning_items SET sequence = 24 WHERE id = 'prog-admin-guide-l22' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 25 WHERE id = 'prog-admin-guide-l23' AND program_id = 'prog-admin-guide';
