-- 0152: Admin guide lessons brought up to their files (2026-11-14, the founder): 03 says the morning routine on Daily starts folded, with
-- today's count of steps beside it; 11 names Show to my coach, the switch at the top of each table a student may turn on for a coach; 20 and
-- 25 say the assistant and the Companion read a whole table, supplements and protein included, only when it is switched on with Show to AI
-- chat. Every lesson keeps its place. Made with: node scripts/admin-guide/build.mjs --sync <this file> --only 03,11,20,25. Safe to run again.
UPDATE learning_items SET sequence = 1 WHERE id = 'prog-admin-guide-l01' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 2 WHERE id = 'prog-admin-guide-l02' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET module_title = 'Daily: the boxes, the tasks and the week', body = 'Riya''s pillars are built. Now she needs one place to see what to do today. That is the Daily tab. It is where her plan turns into ticks.

In this lesson you''ll learn:

- How Riya checks in and does her small act.
- How she plans a task: do date, due date, repeat, priority and area of life.
- How the month calendar, Plan my week and time blocks help.
- How the not to do list and Habits work, and what an admin can do.

## Step one: show up

At the top of Daily is **Show up**.

1. Riya taps **I showed up today**. That is her check-in. It pays 10 xp and 10 points and keeps her streak. Every seventh day in a row pays a bonus of 50 points.
2. Under it is her morning routine from the strategy session, folded shut, with today''s count of steps beside it. She taps it open and ticks each step. A day counts only when every morning step is ticked.

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
2. Under it is her morning routine from the strategy session, folded shut, with today''s count of steps beside it. She taps it open and ticks each step. A day counts only when every morning step is ticked.

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
UPDATE learning_items SET sequence = 4 WHERE id = 'prog-admin-guide-l24' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 5 WHERE id = 'prog-admin-guide-l04' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 6 WHERE id = 'prog-admin-guide-l05' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 7 WHERE id = 'prog-admin-guide-l06' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 8 WHERE id = 'prog-admin-guide-l07' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET module_title = 'Fitness and supplements', body = 'Riya sits at a desk all day, and she wants to see whether she is moving at all. Fitness logs her movement and a short eating check-in. It also holds her own list of supplements, if she wants one.

In this lesson you''ll learn:

- How Riya logs a walk and does her eating check-in.
- How she keeps a supplement on her own list.
- What an admin checks, and what no staff screen ever shows.

## Find it

Fitness starts hidden on a new account, unless the setup chat showed it for her. Riya opens **Apps**, opens the **Reflection** group, opens **Hidden apps** at its end and taps the eye beside **Fitness**.

## Step by step: an evening walk

1. Under **Log movement**, she picks **Today** and **Walk**.
2. She sets 40 minutes on the ruler and types 3 in **Distance in km**.
3. She taps how hard it felt, from Easy to All out.
4. She taps **Save movement**.

The eight kinds are Run, Walk, Cycle, Swim, Yoga, Gym, Sport and Other. A hundred and fifty active minutes in seven days gives full marks for movement in Life.

## Step by step: how she ate

Once a day, under **How you ate**:

1. Under **Meals today**, she ticks Lunch and Dinner, or **Fasting today**.
2. Under each meal she taps **Good fuel**, **Tasty** or both.
3. She sets **Fruit** and **Vegetables and greens**.
4. She opens **Protein** and taps what she ate, such as Dal or Egg. Each tap adds one serving, and the grams are rough amounts from India''s food tables.
5. **More** holds packaged, fried or sweet, how full she felt, meals without a screen and a note.
6. She taps **Save this day**.

The score reads fruit and vegetables, packaged food and meals without a screen. Tasty and how full she felt never move it. What she leaves out does not count, but a score needs her fruit and vegetables, even if the answer is 0, and a fasting day has no score. Older days keep the scores they already have. The app never asks for calories or a photo.

Protein is its own number, such as "42 g of 60 g today". **Daily goal** works one out from what she weighs. Only the goal is saved, and what she weighs is never sent. Nobody else sees the goal. The grams reach a coach only in the Eating table, when she switches it on for them, and AI chat only when she switches on **Show to AI chat** for it, on a model that keeps nothing. They never reach staff, Emerging or Reviews. So if a member asks, there is nothing here to look up for them. The line beside it says to check with a doctor if you have a kidney condition or are pregnant.

## Her supplement list

**Track supplements** starts off. Riya turns it on and taps **Add a supplement**. She types her vitamin''s name as it says on the label, picks a kind, types the amount and picks when she takes it. Each day she ticks it. **Copy my list** gives her the list as text to show a doctor. **Show on Daily** and **Reminders** each stay off until she says.

The app gives no starter list and no picks. Its only caution reads: "The app does not check amounts or mixes. Ask a doctor or pharmacist before you start, stop or change one, more so if you take medicines or are pregnant."

> **Pro tip:** point someone who worries about food to How it works, not to a number.

> **Result:** Riya sees her week of walks and how she ate, and she has a list she can show her doctor.

## What the admin checks

- **No staff screen:** none shows any of this. It never reaches brands, the leaderboard or Club.
- **Logs:** they keep only a bare error line for Fitness and for Kreators Run''s own tool, with no person and no path.
- **Switches:** in Admin, **Flags**, and **What does this person see?** work as for any app.
- **Nothing to police:** nothing here pays. The Fitness badge family counts club entries only.
- **Supplements:** they never reach Emerging, search or the calendar link. A coach sees them only as their tables, and the assistant only with **Show to AI chat** on a model that keeps nothing, each when she switches them on.
- **A coach:** sees minutes, days moved and the eating number only under the student''s Reflection switch, never a note, unless she switches a whole table on for them.
- **Their data:** it is in the export and goes with the account. An erase of progress keeps it.

If a member asks whether a supplement is safe, the answer is always a doctor or pharmacist, never the team.

## The bottom line

Fitness is a private log that pays nothing. As an admin, you keep the app available and send every health question to a doctor or pharmacist.', sequence = 9 WHERE id = 'prog-admin-guide-l25' AND program_id = 'prog-admin-guide';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-admin-guide-l25', 'prog-admin-guide', 'Fitness and supplements', 'lesson', NULL, 'Riya sits at a desk all day, and she wants to see whether she is moving at all. Fitness logs her movement and a short eating check-in. It also holds her own list of supplements, if she wants one.

In this lesson you''ll learn:

- How Riya logs a walk and does her eating check-in.
- How she keeps a supplement on her own list.
- What an admin checks, and what no staff screen ever shows.

## Find it

Fitness starts hidden on a new account, unless the setup chat showed it for her. Riya opens **Apps**, opens the **Reflection** group, opens **Hidden apps** at its end and taps the eye beside **Fitness**.

## Step by step: an evening walk

1. Under **Log movement**, she picks **Today** and **Walk**.
2. She sets 40 minutes on the ruler and types 3 in **Distance in km**.
3. She taps how hard it felt, from Easy to All out.
4. She taps **Save movement**.

The eight kinds are Run, Walk, Cycle, Swim, Yoga, Gym, Sport and Other. A hundred and fifty active minutes in seven days gives full marks for movement in Life.

## Step by step: how she ate

Once a day, under **How you ate**:

1. Under **Meals today**, she ticks Lunch and Dinner, or **Fasting today**.
2. Under each meal she taps **Good fuel**, **Tasty** or both.
3. She sets **Fruit** and **Vegetables and greens**.
4. She opens **Protein** and taps what she ate, such as Dal or Egg. Each tap adds one serving, and the grams are rough amounts from India''s food tables.
5. **More** holds packaged, fried or sweet, how full she felt, meals without a screen and a note.
6. She taps **Save this day**.

The score reads fruit and vegetables, packaged food and meals without a screen. Tasty and how full she felt never move it. What she leaves out does not count, but a score needs her fruit and vegetables, even if the answer is 0, and a fasting day has no score. Older days keep the scores they already have. The app never asks for calories or a photo.

Protein is its own number, such as "42 g of 60 g today". **Daily goal** works one out from what she weighs. Only the goal is saved, and what she weighs is never sent. Nobody else sees the goal. The grams reach a coach only in the Eating table, when she switches it on for them, and AI chat only when she switches on **Show to AI chat** for it, on a model that keeps nothing. They never reach staff, Emerging or Reviews. So if a member asks, there is nothing here to look up for them. The line beside it says to check with a doctor if you have a kidney condition or are pregnant.

## Her supplement list

**Track supplements** starts off. Riya turns it on and taps **Add a supplement**. She types her vitamin''s name as it says on the label, picks a kind, types the amount and picks when she takes it. Each day she ticks it. **Copy my list** gives her the list as text to show a doctor. **Show on Daily** and **Reminders** each stay off until she says.

The app gives no starter list and no picks. Its only caution reads: "The app does not check amounts or mixes. Ask a doctor or pharmacist before you start, stop or change one, more so if you take medicines or are pregnant."

> **Pro tip:** point someone who worries about food to How it works, not to a number.

> **Result:** Riya sees her week of walks and how she ate, and she has a list she can show her doctor.

## What the admin checks

- **No staff screen:** none shows any of this. It never reaches brands, the leaderboard or Club.
- **Logs:** they keep only a bare error line for Fitness and for Kreators Run''s own tool, with no person and no path.
- **Switches:** in Admin, **Flags**, and **What does this person see?** work as for any app.
- **Nothing to police:** nothing here pays. The Fitness badge family counts club entries only.
- **Supplements:** they never reach Emerging, search or the calendar link. A coach sees them only as their tables, and the assistant only with **Show to AI chat** on a model that keeps nothing, each when she switches them on.
- **A coach:** sees minutes, days moved and the eating number only under the student''s Reflection switch, never a note, unless she switches a whole table on for them.
- **Their data:** it is in the export and goes with the account. An erase of progress keeps it.

If a member asks whether a supplement is safe, the answer is always a doctor or pharmacist, never the team.

## The bottom line

Fitness is a private log that pays nothing. As an admin, you keep the app available and send every health question to a doctor or pharmacist.', 9, 1);
UPDATE learning_items SET sequence = 10 WHERE id = 'prog-admin-guide-l08' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 11 WHERE id = 'prog-admin-guide-l09' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 12 WHERE id = 'prog-admin-guide-l10' AND program_id = 'prog-admin-guide';
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

The six switches never show her journal, gratitude, a tracker''s note, her money, water, supplements, the Companion or a review''s snapshot. She can also switch on whole tables for one coach under **Tables your coach can see**, or with **Show to my coach** at the top of a table, each off until she turns it on. The coach reads them from a **Tables** link on her page and can never change them. The Companion and a review''s snapshot are never a table. With Pillars and pyramids on, a coach can add and edit tasks under her projects. Those tasks wear the tag From your coach. A coach never ticks or removes them.

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

The six switches never show her journal, gratitude, a tracker''s note, her money, water, supplements, the Companion or a review''s snapshot. She can also switch on whole tables for one coach under **Tables your coach can see**, or with **Show to my coach** at the top of a table, each off until she turns it on. The coach reads them from a **Tables** link on her page and can never change them. The Companion and a review''s snapshot are never a table. With Pillars and pyramids on, a coach can add and edit tasks under her projects. Those tasks wear the tag From your coach. A coach never ticks or removes them.

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
UPDATE learning_items SET sequence = 20 WHERE id = 'prog-admin-guide-l18' AND program_id = 'prog-admin-guide';
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
- **A whole table only when she opens it.** The assistant and the Companion read a table from All tables only when Riya switches on **Show to AI chat** for it, at the top of the table or under **AI chat** on her Profile tab. They never change it.

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
- **A whole table only when she opens it.** The assistant and the Companion read a table from All tables only when Riya switches on **Show to AI chat** for it, at the top of the table or under **AI chat** on her Profile tab. They never change it.

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
UPDATE learning_items SET sequence = 23 WHERE id = 'prog-admin-guide-l21' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 24 WHERE id = 'prog-admin-guide-l22' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 25 WHERE id = 'prog-admin-guide-l23' AND program_id = 'prog-admin-guide';
