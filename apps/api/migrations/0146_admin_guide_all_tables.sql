-- 0146: Admin guide lessons 06, 11, 21, 23, 24 and 25 brought up to their files for All tables (2026-11-13): the Tables action in People,
-- what a coach may now see as a whole table, and what still never reaches staff. Every lesson keeps its place in the reading order.
-- Made with: node scripts/admin-guide/build.mjs --sync <this file> --only 06,11,21,23,24,25. Safe to run again.
UPDATE learning_items SET sequence = 1 WHERE id = 'prog-admin-guide-l01' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 2 WHERE id = 'prog-admin-guide-l02' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 3 WHERE id = 'prog-admin-guide-l03' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET module_title = 'Time blocks: the shape of a member''s day', body = 'Riya''s tasks have dates now. But a date does not say when in the day. Time blocks give her day a shape: Deep work in the morning, Recovery after lunch, Sleep at night. Her tasks then fall into those blocks.

In this lesson you''ll learn:

- What Riya sets up: blocks, day templates, her usual week and one-day changes.
- How her tasks fall into blocks, and how Daily and Plan my week use them.
- What emerges from it, and what stays private.
- What to check when a member asks for help, and why nothing here is staff-only.

## Where it lives

Time blocks is a page under Daily, not an app. It is core, like Daily, so it is always on. It is not on Apps, and it is not in **What does this person see?**. Nobody can switch it off, and no admin screen lists what is on it.

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

Nothing here is staff-only. There is no admin screen for blocks, templates or the week, no switch, and no override. When a member asks, you guide them on their own screen.

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

Time blocks is a page under Daily, not an app. It is core, like Daily, so it is always on. It is not on Apps, and it is not in **What does this person see?**. Nobody can switch it off, and no admin screen lists what is on it.

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

Nothing here is staff-only. There is no admin screen for blocks, templates or the week, no switch, and no override. When a member asks, you guide them on their own screen.

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
UPDATE learning_items SET module_title = 'Journal and prompts', body = 'Riya edits videos all day. By night her head is full of client notes, cuts and half ideas. The Journal is where she puts it down, and nobody else ever reads it. Not a brand. Not a coach. Not you, the admin.

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
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-admin-guide-l06', 'prog-admin-guide', 'Journal and prompts', 'lesson', NULL, 'Riya edits videos all day. By night her head is full of client notes, cuts and half ideas. The Journal is where she puts it down, and nobody else ever reads it. Not a brand. Not a coach. Not you, the admin.

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

Protein is its own number, such as "42 g of 60 g today". **Daily goal** works one out from what she weighs. Only the goal is saved, and what she weighs is never sent. Nobody else sees the goal. The grams reach a coach only in the Eating table, when she switches it on for them, and never staff, Emerging or Reviews. So if a member asks, there is nothing here to look up for them. The line beside it says to check with a doctor if you have a kidney condition or are pregnant.

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
- **Supplements:** they never reach the assistant, Emerging, search or the calendar link, and a coach only as their tables, when she switches them on.
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

Protein is its own number, such as "42 g of 60 g today". **Daily goal** works one out from what she weighs. Only the goal is saved, and what she weighs is never sent. Nobody else sees the goal. The grams reach a coach only in the Eating table, when she switches it on for them, and never staff, Emerging or Reviews. So if a member asks, there is nothing here to look up for them. The line beside it says to check with a doctor if you have a kidney condition or are pregnant.

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
- **Supplements:** they never reach the assistant, Emerging, search or the calendar link, and a coach only as their tables, when she switches them on.
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

The six switches never show her journal, gratitude, a tracker''s note, her money, water, supplements, the Companion or a review''s snapshot. She can also switch on whole tables for one coach under **Tables your coach can see**, each off until she turns it on. The coach reads them from a **Tables** link on her page and can never change them. The Companion and a review''s snapshot are never a table. With Pillars and pyramids on, a coach can add and edit tasks under her projects. Those tasks wear the tag From your coach. A coach never ticks or removes them.

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

The six switches never show her journal, gratitude, a tracker''s note, her money, water, supplements, the Companion or a review''s snapshot. She can also switch on whole tables for one coach under **Tables your coach can see**, each off until she turns it on. The coach reads them from a **Tables** link on her page and can never change them. The Companion and a review''s snapshot are never a table. With Pillars and pyramids on, a coach can add and edit tasks under her projects. Those tasks wear the tag From your coach. A coach never ticks or removes them.

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
- **Never shown:** the panel never shows anyone''s journal, wellbeing, Finance or Discover answers.
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
- **Never shown:** the panel never shows anyone''s journal, wellbeing, Finance or Discover answers.
- **Their tables:** **Tables** on a row opens that member''s tables, read only, with your own session, never the admin key. It never opens the journal, gratitude or a body and mind table, and never a deleted member. Each table you open or download is written to the audit log, and their export lists when. Open one only when you need to, such as to answer their question.

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

> **Pro tip:** before you switch an app on for everyone, look at its card on the build map. If it says it needs a key, set the key first.

> **Result:** Riya gets new apps when they are ready, her choices stick, and her private things stay private.

## The bottom line

Flags decide what is live. Dev Tools and Logs show what is happening. Privacy is a duty, not a setting: check the Contact page, let people manage their own data, and never look where staff do not belong.', 25, 1);
