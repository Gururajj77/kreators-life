-- 0171: Admin guide lessons 06, 08 and 21 brought up to their files (2026-11-14): a member changes and removes their own rows in All tables
-- (an older day of gratitude, a mindful session's minutes), while a super admin's view of a member's tables, like a coach's and AI chat's, only
-- reads: no Edit and no remove, only Copy and CSV; a big clean-up that stops at the hour's limit says how many were done.
-- Made with: node scripts/admin-guide/build.mjs --sync <this file> --only 06,08,21. Safe to run again.
UPDATE learning_items SET sequence = 1 WHERE id = 'prog-admin-guide-l01' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 2 WHERE id = 'prog-admin-guide-l02' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 3 WHERE id = 'prog-admin-guide-l03' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 4 WHERE id = 'prog-admin-guide-l24' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 5 WHERE id = 'prog-admin-guide-l04' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 6 WHERE id = 'prog-admin-guide-l05' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET module_title = 'Journal and prompts', body = 'Riya edits videos all day. By night her head is full of client notes, cuts and half ideas. The Journal is where she puts it down, and nobody else reads it unless she shares it with her coach. Not a brand, and never you, the admin.

In this lesson you''ll learn:

- How Riya opens the Journal and writes her first entry.
- How the calendar lets her add or fix any past day.
- How Prompt me gives her a question when she does not know what to write.
- How Gratitude for today keeps three short lines a day.
- What an admin can and cannot do with the Journal.

## Where the Journal lives

The Journal is in the Reflection group of apps. It shows on every new account, so Riya does not need to unhide it. She finds it under Apps, in the Reflection group, or she taps Journal from the Wellbeing screen.

The screen opens with a back link to Wellbeing and the title Journal. Under it sits the water and reminders section. On a laptop it is a small bubble at the left instead.

## Step by step: Riya''s first entry

1. Riya opens the Journal and taps **New entry**. It is the one solid button on the screen.
2. In **Title** she types "Long edit day".
3. In **Say anything that is on your mind** she writes a few lines. A count of her words shows beside the label.
4. Under **Emotion** she taps a face: Low, Sad, Neutral, Happy or Overjoyed. She can tap it again to clear it.
5. She moves the **Stress level** slider from 1 to 5.
6. Under **Stressor** she taps Work. She can pick more than one, from Work, Money, Family, Health, Loneliness, Relationship, Sleep and Something else.
7. She taps **Save entry**.

The entry now shows under **My journals**, with its face, the time, the stressors she picked and the first lines of what she wrote.

## The hero and the calendar

Once Riya has an entry, a sky blue card shows at the top. It says how many entries she has so far and how many this month. Two small pills count the positive entries and the heavy ones.

Inside the card is **This month**, a calendar. Every day is a button.

1. Riya taps last Tuesday. A panel opens right under the calendar, never in a popup.
2. It lists what she wrote that day. She taps one to open it.
3. If the day is empty, she taps **Write an entry for this day**. If it has entries, the button reads **Add another entry for this day**.
4. She closes the day with the round close button, or with Escape.

A day in the future cannot take an entry. The server refuses it.

## Prompt me

Some nights Riya stares at the box. Further down the page is a section called **Not sure what to write?**

1. She picks a **Category** from the dropdown, or leaves it on Every category.
2. She taps **Prompt me**.
3. A card shows the prompt, its category, and about how many minutes it takes.
4. She opens **Why this prompt** to see why it helps and how to write it.
5. She opens **What to expect** to see what may come up.
6. She taps **Write about this**. The entry sheet opens with the prompt as its title and first line.
7. If it does not fit, she taps **Another prompt**.

There are sixteen categories, such as Shadow work, Inner child, Gratitude and joy, Energy and boundaries, Money and abundance mindset, 3-6-9 writing and Weekly reset. A line under the card says how many she has seen. None comes back until she has seen them all.

Which prompts she has seen stays on her own device. It is never sent to the server. The heavy categories end with a care note: stop, and talk to a professional or someone you trust.

## Gratitude for today

Right under **New entry** sits **Gratitude for today**: three short lines, each under its own prompt, from one of the seven pillars or the day itself.

1. Riya types a line. It saves as she types, with no button to tap.
2. On an empty line, she taps the pillar''s name to pick another. The round arrows give her **Another prompt** from the same pillar.
3. **Make these my usual three** keeps those pillars for each new day.

A prompt she wrote under or skipped comes back only after the rest of that pillar''s prompts. On Journal only today and yesterday can change, and a dot on the calendar marks a day with lines. In **All tables**, Riya can change or clear an older day herself, never a day still to come or one before she joined. It pays nothing.

## Changing or deleting an entry

1. Riya taps an entry in My journals. The sheet opens with her words.
2. She changes what she likes and taps **Save changes**.
3. To remove it, she taps **Delete entry**. It turns red and reads **Tap again to delete**.
4. A second tap deletes it. If she waits a few seconds instead, it goes back to **Delete entry** and nothing changes.

## The rest of the screen

- **By period:** a block that picks a day, a week, a month, a quarter or a half year and shows her journal and wellbeing numbers for it.
- **Emerging:** patterns from her own logs, when there is one ready. It reads when she wrote, never what she wrote.
- **How it works:** the steps of the app, folded at the foot.

> **Pro tip:** tell new people to pick an emotion on every entry. The Life app''s emotional area and the Journal''s hero both read it. An entry with no emotion still counts as written, but says less.

> **Result:** Riya has a private page for her thoughts, a calendar to fill any past day, and a prompt whenever she is stuck.

## What the admin checks

The Journal is the most private part of the app. You cannot read it, and you should never try to.

- **No staff view:** no admin screen shows a journal entry or a gratitude line, not even a member''s tables, which leave both out. Journal data never reaches brands, staff, the leaderboard or Club picks.
- **A coach only if she shares it:** a life coach sees the journal or gratitude only as a whole table she switches on for that coach, read only. Nobody can switch it on for her.
- **The assistant:** it reads the journal only for its owner, only when the owner asks about it, and only through a model that keeps no data. It also needs her yes: **Show to AI chat** on the Journal entries table, and on the Gratitude table for her gratitude lines. Both start off.
- **Logs stay clean:** the Logs page never holds journal words. At most it keeps a bare error line with no person and no path.
- **Switching it:** in Admin, **Flags**, you can turn the Journal off for everyone, set a rollout share or a minimum role. Use this with care, since it is on for all new accounts.
- **One person:** in Admin, **People**, open a person and use **What does this person see?** to tick or untick Journal for them.
- **Their data, their call:** a person''s export holds their entries and gratitude, and deleting the account deletes them.

If a member writes to Help about a lost entry, you cannot restore it. A deleted entry is gone for good, and the app says so before it goes.

## The bottom line

The Journal is Riya''s alone. Your job as an admin is to keep it switched on and to keep it private. Help people find Prompt me and the calendar, and never ask them to share what they wrote.', sequence = 7 WHERE id = 'prog-admin-guide-l06' AND program_id = 'prog-admin-guide';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-admin-guide-l06', 'prog-admin-guide', 'Journal and prompts', 'lesson', NULL, 'Riya edits videos all day. By night her head is full of client notes, cuts and half ideas. The Journal is where she puts it down, and nobody else reads it unless she shares it with her coach. Not a brand, and never you, the admin.

In this lesson you''ll learn:

- How Riya opens the Journal and writes her first entry.
- How the calendar lets her add or fix any past day.
- How Prompt me gives her a question when she does not know what to write.
- How Gratitude for today keeps three short lines a day.
- What an admin can and cannot do with the Journal.

## Where the Journal lives

The Journal is in the Reflection group of apps. It shows on every new account, so Riya does not need to unhide it. She finds it under Apps, in the Reflection group, or she taps Journal from the Wellbeing screen.

The screen opens with a back link to Wellbeing and the title Journal. Under it sits the water and reminders section. On a laptop it is a small bubble at the left instead.

## Step by step: Riya''s first entry

1. Riya opens the Journal and taps **New entry**. It is the one solid button on the screen.
2. In **Title** she types "Long edit day".
3. In **Say anything that is on your mind** she writes a few lines. A count of her words shows beside the label.
4. Under **Emotion** she taps a face: Low, Sad, Neutral, Happy or Overjoyed. She can tap it again to clear it.
5. She moves the **Stress level** slider from 1 to 5.
6. Under **Stressor** she taps Work. She can pick more than one, from Work, Money, Family, Health, Loneliness, Relationship, Sleep and Something else.
7. She taps **Save entry**.

The entry now shows under **My journals**, with its face, the time, the stressors she picked and the first lines of what she wrote.

## The hero and the calendar

Once Riya has an entry, a sky blue card shows at the top. It says how many entries she has so far and how many this month. Two small pills count the positive entries and the heavy ones.

Inside the card is **This month**, a calendar. Every day is a button.

1. Riya taps last Tuesday. A panel opens right under the calendar, never in a popup.
2. It lists what she wrote that day. She taps one to open it.
3. If the day is empty, she taps **Write an entry for this day**. If it has entries, the button reads **Add another entry for this day**.
4. She closes the day with the round close button, or with Escape.

A day in the future cannot take an entry. The server refuses it.

## Prompt me

Some nights Riya stares at the box. Further down the page is a section called **Not sure what to write?**

1. She picks a **Category** from the dropdown, or leaves it on Every category.
2. She taps **Prompt me**.
3. A card shows the prompt, its category, and about how many minutes it takes.
4. She opens **Why this prompt** to see why it helps and how to write it.
5. She opens **What to expect** to see what may come up.
6. She taps **Write about this**. The entry sheet opens with the prompt as its title and first line.
7. If it does not fit, she taps **Another prompt**.

There are sixteen categories, such as Shadow work, Inner child, Gratitude and joy, Energy and boundaries, Money and abundance mindset, 3-6-9 writing and Weekly reset. A line under the card says how many she has seen. None comes back until she has seen them all.

Which prompts she has seen stays on her own device. It is never sent to the server. The heavy categories end with a care note: stop, and talk to a professional or someone you trust.

## Gratitude for today

Right under **New entry** sits **Gratitude for today**: three short lines, each under its own prompt, from one of the seven pillars or the day itself.

1. Riya types a line. It saves as she types, with no button to tap.
2. On an empty line, she taps the pillar''s name to pick another. The round arrows give her **Another prompt** from the same pillar.
3. **Make these my usual three** keeps those pillars for each new day.

A prompt she wrote under or skipped comes back only after the rest of that pillar''s prompts. On Journal only today and yesterday can change, and a dot on the calendar marks a day with lines. In **All tables**, Riya can change or clear an older day herself, never a day still to come or one before she joined. It pays nothing.

## Changing or deleting an entry

1. Riya taps an entry in My journals. The sheet opens with her words.
2. She changes what she likes and taps **Save changes**.
3. To remove it, she taps **Delete entry**. It turns red and reads **Tap again to delete**.
4. A second tap deletes it. If she waits a few seconds instead, it goes back to **Delete entry** and nothing changes.

## The rest of the screen

- **By period:** a block that picks a day, a week, a month, a quarter or a half year and shows her journal and wellbeing numbers for it.
- **Emerging:** patterns from her own logs, when there is one ready. It reads when she wrote, never what she wrote.
- **How it works:** the steps of the app, folded at the foot.

> **Pro tip:** tell new people to pick an emotion on every entry. The Life app''s emotional area and the Journal''s hero both read it. An entry with no emotion still counts as written, but says less.

> **Result:** Riya has a private page for her thoughts, a calendar to fill any past day, and a prompt whenever she is stuck.

## What the admin checks

The Journal is the most private part of the app. You cannot read it, and you should never try to.

- **No staff view:** no admin screen shows a journal entry or a gratitude line, not even a member''s tables, which leave both out. Journal data never reaches brands, staff, the leaderboard or Club picks.
- **A coach only if she shares it:** a life coach sees the journal or gratitude only as a whole table she switches on for that coach, read only. Nobody can switch it on for her.
- **The assistant:** it reads the journal only for its owner, only when the owner asks about it, and only through a model that keeps no data. It also needs her yes: **Show to AI chat** on the Journal entries table, and on the Gratitude table for her gratitude lines. Both start off.
- **Logs stay clean:** the Logs page never holds journal words. At most it keeps a bare error line with no person and no path.
- **Switching it:** in Admin, **Flags**, you can turn the Journal off for everyone, set a rollout share or a minimum role. Use this with care, since it is on for all new accounts.
- **One person:** in Admin, **People**, open a person and use **What does this person see?** to tick or untick Journal for them.
- **Their data, their call:** a person''s export holds their entries and gratitude, and deleting the account deletes them.

If a member writes to Help about a lost entry, you cannot restore it. A deleted entry is gone for good, and the app says so before it goes.

## The bottom line

The Journal is Riya''s alone. Your job as an admin is to keep it switched on and to keep it private. Help people find Prompt me and the calendar, and never ask them to share what they wrote.', 7, 1);
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
- **Sessions:** her mindful logs. Each has a trash button. One tap turns it red with **Tap again to delete**; a second tap deletes the session, and a wait of a few seconds puts it back. To change a session''s minutes, she opens its table in **All tables**.

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
- **Sessions:** her mindful logs. Each has a trash button. One tap turns it red with **Tap again to delete**; a second tap deletes the session, and a wait of a few seconds puts it back. To change a session''s minutes, she opens its table in **All tables**.

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
UPDATE learning_items SET sequence = 11 WHERE id = 'prog-admin-guide-l09' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 12 WHERE id = 'prog-admin-guide-l10' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 13 WHERE id = 'prog-admin-guide-l11' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 14 WHERE id = 'prog-admin-guide-l12' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 15 WHERE id = 'prog-admin-guide-l13' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 16 WHERE id = 'prog-admin-guide-l14' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 17 WHERE id = 'prog-admin-guide-l15' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 18 WHERE id = 'prog-admin-guide-l16' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 19 WHERE id = 'prog-admin-guide-l17' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 20 WHERE id = 'prog-admin-guide-l18' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 21 WHERE id = 'prog-admin-guide-l19' AND program_id = 'prog-admin-guide';
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
- **Their tables:** **Tables** on a row opens that member''s tables, read only, with your own session, never the admin key. It never opens the journal, gratitude or a body and mind table, and never a deleted member. It never lists a table that holds other people''s details either, such as their buyers, guests, clients, chats, Agency, Discover or the Companion: those are theirs and AI chat''s alone. The tables sit in the same groups as the Apps page, and a table shows only while its app is on for them. Each table you open or download is written to the audit log, and their export lists when. Open one only when you need to, such as to answer their question.
- **Only the member changes them:** your view has no **Edit** and no remove, only Copy and CSV, and the same holds for a coach and AI chat. The member ticks a row in **All tables** and taps **Edit**, or the button beside it in the app''s own word, such as **Delete** or **Withdraw**. A small thing asks for a second tap, and several rows, money, history or someone''s access ask in a sheet. Records such as xp, points, orders and badges stay greyed, with the reason. If a member says a big clean-up stopped, it hit the hour''s limit: the screen says how many were done, and the rest stay ticked for another try later.

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
- **Only the member changes them:** your view has no **Edit** and no remove, only Copy and CSV, and the same holds for a coach and AI chat. The member ticks a row in **All tables** and taps **Edit**, or the button beside it in the app''s own word, such as **Delete** or **Withdraw**. A small thing asks for a second tap, and several rows, money, history or someone''s access ask in a sheet. Records such as xp, points, orders and badges stay greyed, with the reason. If a member says a big clean-up stopped, it hit the hour''s limit: the screen says how many were done, and the rest stay ticked for another try later.

> **Pro tip:** give a permission, not a role, wherever you can. A creator with Moderator is a guide, and nothing else about their account changes.

> **Result:** Riya is now a mentor and a guide, has a thank-you badge, and sees the apps the team meant her to see.

## The bottom line

People is where you give jobs and thanks. Search, tap the row, and use the panel. Give the smallest power that does the job, and trust the audit log to keep a record of each change.', 23, 1);
UPDATE learning_items SET sequence = 24 WHERE id = 'prog-admin-guide-l22' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 25 WHERE id = 'prog-admin-guide-l23' AND program_id = 'prog-admin-guide';
