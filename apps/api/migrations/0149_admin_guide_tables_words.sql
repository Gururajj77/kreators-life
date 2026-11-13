-- 0149: Admin guide lesson 06 brought up to its file after the review of All tables (2026-11-13): its opening no longer says a coach never
-- reads the journal (a person may share that table with their coach; an admin never reads it). Every lesson keeps its place in the reading
-- order. Made with: node scripts/admin-guide/build.mjs --sync <this file> --only 06. Safe to run again.
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

A prompt she wrote under or skipped comes back only after the rest of that pillar''s prompts. Only today and yesterday can change. Older days are read only, and a dot on the calendar marks a day with lines. It pays nothing.

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
- **The assistant:** it reads the journal only for its owner, only when the owner asks about it, and only through a model that keeps no data.
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

A prompt she wrote under or skipped comes back only after the rest of that pillar''s prompts. Only today and yesterday can change. Older days are read only, and a dot on the calendar marks a day with lines. It pays nothing.

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
- **The assistant:** it reads the journal only for its owner, only when the owner asks about it, and only through a model that keeps no data.
- **Logs stay clean:** the Logs page never holds journal words. At most it keeps a bare error line with no person and no path.
- **Switching it:** in Admin, **Flags**, you can turn the Journal off for everyone, set a rollout share or a minimum role. Use this with care, since it is on for all new accounts.
- **One person:** in Admin, **People**, open a person and use **What does this person see?** to tick or untick Journal for them.
- **Their data, their call:** a person''s export holds their entries and gratitude, and deleting the account deletes them.

If a member writes to Help about a lost entry, you cannot restore it. A deleted entry is gone for good, and the app says so before it goes.

## The bottom line

The Journal is Riya''s alone. Your job as an admin is to keep it switched on and to keep it private. Help people find Prompt me and the calendar, and never ask them to share what they wrote.', 7, 1);
UPDATE learning_items SET sequence = 8 WHERE id = 'prog-admin-guide-l07' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 9 WHERE id = 'prog-admin-guide-l25' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 10 WHERE id = 'prog-admin-guide-l08' AND program_id = 'prog-admin-guide';
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
UPDATE learning_items SET sequence = 23 WHERE id = 'prog-admin-guide-l21' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 24 WHERE id = 'prog-admin-guide-l22' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 25 WHERE id = 'prog-admin-guide-l23' AND program_id = 'prog-admin-guide';
