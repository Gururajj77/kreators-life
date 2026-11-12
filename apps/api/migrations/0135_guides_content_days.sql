-- 2026-11-12: the guides' time blocks lessons (onboarding 18, Admin guide 24) say 18 blocks and 17 templates and name the three content days,
-- made with build.mjs --sync --only 18 and --only 24 (a committed migration is never edited again).
UPDATE learning_items SET module_title = 'Daily, part three: time blocks and the shape of your day', body = 'A list of tasks says what to do. It does not say when. Time blocks give your day a shape, so each task has a place to land. This lesson covers blocks, day templates, your usual week, and how tasks fall into blocks.

In this lesson you''ll learn:

- What a time block is, and how to make one in your own colour.
- How a day template sets your kind of day.
- How your usual week works, and how to change just one day.
- How tasks fall into blocks, and how to see them in coloured boxes on Daily.
- How Plan my week suggests a block for each task.

## Where to find it

On Daily, tap **Time blocks** beside the Tasks heading. The same page opens from **Edit kind of day** under the sort row, and from the gear at the top of Plan my week. It is part of Daily, so it is always on. Nothing on it costs points or credits.

## Blocks

A time block is a named stretch of your day, like Deep work or Sleep. Each block has:

- **A name**, like Deep work.
- **A tag**, a word or two that groups blocks, like Focus, Admin, Self care or Recovery. You can type your own.
- **A colour.** Its boxes and bands on Daily wear it.
- **An area of life and a pillar**, if you like. They help the app suggest a block for a task.

You start with 18 blocks. Ten of them make up a normal day, from Morning hygiene at 7 am to Sleep at 11 pm. Eight more are used by some of the day templates: Travel, Family time, Date, Reflection, and four for making content, Shoot, Edit, Plan and prep, and Post. You can keep up to 24.

Under **Blocks**, tap a block to change it, then tap **Save**. **Add a block** makes a new one. **Arrange** lets you change their order. To delete a block, open it and tap the bin beside **Save**. It asks first. Your tasks stay; they just lose that block.

## Your own colour

The colour row holds eleven colours round a wheel, from amber to lime. The last button, with a pipette, is your own colour.

1. Tap the pipette. A small card opens just under it.
2. Type a hex code like 1E90FF, or a colour name like teal. A dot shows how it looks.
3. Tap the tick. The button now wears your colour, and so does the block.

Tap the pipette again any time to change it.

## Day templates: your kind of day

A day template lays your blocks on the clock. Deep work from 10 am to 1 pm, Recovery from 1 pm to 3 pm, and so on. It also names the pillar that leads the day, and a second one.

A day template is your kind of day. You start with 17, like Everyday, Deep work day, Family day, Recovery day, Low energy day and Travel day. Each one is a starting point. Change anything.

Three of them are for making content: **Edit day**, **Shoot day** and **Plan and post day**. You make, edit and post on different days. On a day set to one of them, Daily shows a short list of steps inside each of its content blocks, like "Write the shot list" and "Charge every battery". The list is there to read, not to tick. **Add to my tasks** under it makes one task for that block, on that day, with the steps as its subtasks. Pick the project it goes under once; the app remembers your pick.

Tap a template under **Day templates** to open it.

1. Change its name, **Pillar that leads**, **Second pillar** and **Colour**, the same picker as a block''s.
2. Each slot is a block with a start and an end. An end before the start runs past midnight, like Sleep from 11 pm to 7 am.
3. Slots can never overlap. A gap is fine and shows as free time.
4. Tap **Save**, or **Save as new** to keep a copy.

The three dots hold **Make it the default**, **Copy** and **Delete**. You can keep up to 24 templates. Your default cannot be deleted until another one is the default.

> **Pro tip:** do not build a perfect week on day one. Use Everyday for a week. Then change only the block that kept going wrong.

## Your usual week, and one-day changes

Every day starts on your default template, **Everyday**. Under **Your usual week**, open **Set each weekday** to give a weekday its own template. Say Sunday is Family day. Each change saves at once.

Some days do not fit the pattern. A trip, a sick day, a launch. Change just that day, and your week stays as it was:

- **On Daily**, the **Kind of day** dropdown starts on **Follow your week**. Pick another template, and it is for that date only.
- **In the month calendar on Daily**, each day shows the colour of its kind. Tap a day, past or future, and pick its **Kind of day** in the sheet. **Follow your week** clears it. The sheet also says whether the day was set for this day only or comes from your usual week.
- **On the Time blocks page**, tap a day under **This week**. You see its blocks in order, with the free time between. Its **Kind of day** works the same way. A changed day wears a **Changed** tag.
- **Use it on more days** puts that template on other weekdays. Pick **Every week** to change your pattern, or **This week only** for just those dates. Then tap the **Apply** button, which says how many days.

Pick **Follow your week** again to undo a one-day change.

**This month** on the Time blocks page counts how many days of each kind you have had so far this month. Days on Everyday are not counted.

## How tasks fall into blocks

A task finds its block in one of four ways.

1. **You pick it.** In a task''s plan, the **Time block** select lists the blocks of that day first, then your other blocks.
2. **By its time.** Leave it on **By its time**, and a task at 11 am sits in the block that covers 11 am.
3. **Plan my week suggests one**, from the task''s area of life and pillar.
4. **Daily suggests one.** A task with no block and no time shows inside the block that fits, until you say.

## Seeing your day in blocks

On Daily, **Sort by** now has six choices: Day, Priority, Due date, By context, By time block and By area.

- **By time block** shows your tasks in coloured boxes, one per block, in clock order. Each box shows its times and a count, like "3 tasks · 1 h 30 of 3 h". A task with no block and no time shows as **Suggested** inside the block that fits, with **Keep here**. Nothing is saved until you tap. It never suggests your night''s sleep, a full block or a block already over. Tasks with no block sit in **No block yet**.
- **A task in the wrong block:** a timed task in a block meant for something else gets one quiet line, with **Move it** or **Keep here**. The task''s form says the same under its time.
- **By area** shows a box for each area of life that has tasks, in the order physical, financial, mental, emotional and spiritual. Tasks with no area sit in **No area**.
- Inside every box, P0 comes first.
- Tap a box to fold it. **Open all** and **Fold all** sit above them.
- These two views show up to 60 tasks, not six, so you can see the whole day.

**By context** reads the pillar your day template leads with. On a Family day, family tasks come first inside each priority. On a day that follows your default, the list sorts by day, unless you pick another sort.

Just above the list, **Your day** is a fold that shows each block as a band, with its tasks inside. It says how much room is left, like "45 min free", or "Over by 30 min" when you planned too much. A line like **3 tasks have no time or block yet** opens those tasks, each with a block picker.

## Plan my week suggests a block

Plan my week now gives each task a day and a block. It leans on the block''s area and pillar:

- A task in the financial area goes to a financial block, like Deep work or Busy work. A task with no area goes by its pillar.
- P0 and P1 tasks lean to a block tagged Focus. P2 and P3 tasks lean to the others.
- A block with room left wins over a full one.

Each suggestion shows its block under the title, with a select to change it. **Worth a look** adds two new lines. One says when a block is too full, like "Deep work on Tue holds 4h 30m of 3h." The other says when a Focus block is empty, and its **Fix** lets you drop a task in. Nothing changes until you tap **Keep what fits**.

## Why it works this way

A day has only so many hours. When you see the day as blocks, you see the room before you fill it. A day template saves you from planning the same shape again and again. And a one-day change means a bad day never breaks your week.

## What emerges and what develops

After a few weeks, Emerging on Daily starts to read your blocks back to you. It may say "You ticked 14 of 20 Deep work tasks inside the block." It also sets the tasks you tick on one kind of day beside your other days.

**Your kinds of day** shows your last four weeks by kind, each in its own colour, and how each kind went beside your other days: tasks ticked, and focus minutes and mood while those apps are on. A day counts as the kind you set for it, else the one your week gives it. Days on Everyday count as no kind. You see it on Daily, on the Time blocks page, under Emerging and on Reviews. Each line says what went together, never what caused what.

What develops is a sense of your own rhythm. You learn which hours are for deep work and which are for rest, and you plan around them.

> **Result:** your day has a shape. Each weekday has its kind of day, one-off days are easy to change, and your tasks fall into the blocks where they fit.

## The bottom line

Blocks are the parts of your day. A day template puts them on the clock and is your kind of day. Your usual week picks one for each weekday, and one date can change without touching the rest. Let tasks fall into blocks, and sort By time block to see where your day goes.' WHERE id = 'prog-onboarding-l18' AND program_id = 'prog-onboarding';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-onboarding-l18', 'prog-onboarding', 'Daily, part three: time blocks and the shape of your day', 'lesson', NULL, 'A list of tasks says what to do. It does not say when. Time blocks give your day a shape, so each task has a place to land. This lesson covers blocks, day templates, your usual week, and how tasks fall into blocks.

In this lesson you''ll learn:

- What a time block is, and how to make one in your own colour.
- How a day template sets your kind of day.
- How your usual week works, and how to change just one day.
- How tasks fall into blocks, and how to see them in coloured boxes on Daily.
- How Plan my week suggests a block for each task.

## Where to find it

On Daily, tap **Time blocks** beside the Tasks heading. The same page opens from **Edit kind of day** under the sort row, and from the gear at the top of Plan my week. It is part of Daily, so it is always on. Nothing on it costs points or credits.

## Blocks

A time block is a named stretch of your day, like Deep work or Sleep. Each block has:

- **A name**, like Deep work.
- **A tag**, a word or two that groups blocks, like Focus, Admin, Self care or Recovery. You can type your own.
- **A colour.** Its boxes and bands on Daily wear it.
- **An area of life and a pillar**, if you like. They help the app suggest a block for a task.

You start with 18 blocks. Ten of them make up a normal day, from Morning hygiene at 7 am to Sleep at 11 pm. Eight more are used by some of the day templates: Travel, Family time, Date, Reflection, and four for making content, Shoot, Edit, Plan and prep, and Post. You can keep up to 24.

Under **Blocks**, tap a block to change it, then tap **Save**. **Add a block** makes a new one. **Arrange** lets you change their order. To delete a block, open it and tap the bin beside **Save**. It asks first. Your tasks stay; they just lose that block.

## Your own colour

The colour row holds eleven colours round a wheel, from amber to lime. The last button, with a pipette, is your own colour.

1. Tap the pipette. A small card opens just under it.
2. Type a hex code like 1E90FF, or a colour name like teal. A dot shows how it looks.
3. Tap the tick. The button now wears your colour, and so does the block.

Tap the pipette again any time to change it.

## Day templates: your kind of day

A day template lays your blocks on the clock. Deep work from 10 am to 1 pm, Recovery from 1 pm to 3 pm, and so on. It also names the pillar that leads the day, and a second one.

A day template is your kind of day. You start with 17, like Everyday, Deep work day, Family day, Recovery day, Low energy day and Travel day. Each one is a starting point. Change anything.

Three of them are for making content: **Edit day**, **Shoot day** and **Plan and post day**. You make, edit and post on different days. On a day set to one of them, Daily shows a short list of steps inside each of its content blocks, like "Write the shot list" and "Charge every battery". The list is there to read, not to tick. **Add to my tasks** under it makes one task for that block, on that day, with the steps as its subtasks. Pick the project it goes under once; the app remembers your pick.

Tap a template under **Day templates** to open it.

1. Change its name, **Pillar that leads**, **Second pillar** and **Colour**, the same picker as a block''s.
2. Each slot is a block with a start and an end. An end before the start runs past midnight, like Sleep from 11 pm to 7 am.
3. Slots can never overlap. A gap is fine and shows as free time.
4. Tap **Save**, or **Save as new** to keep a copy.

The three dots hold **Make it the default**, **Copy** and **Delete**. You can keep up to 24 templates. Your default cannot be deleted until another one is the default.

> **Pro tip:** do not build a perfect week on day one. Use Everyday for a week. Then change only the block that kept going wrong.

## Your usual week, and one-day changes

Every day starts on your default template, **Everyday**. Under **Your usual week**, open **Set each weekday** to give a weekday its own template. Say Sunday is Family day. Each change saves at once.

Some days do not fit the pattern. A trip, a sick day, a launch. Change just that day, and your week stays as it was:

- **On Daily**, the **Kind of day** dropdown starts on **Follow your week**. Pick another template, and it is for that date only.
- **In the month calendar on Daily**, each day shows the colour of its kind. Tap a day, past or future, and pick its **Kind of day** in the sheet. **Follow your week** clears it. The sheet also says whether the day was set for this day only or comes from your usual week.
- **On the Time blocks page**, tap a day under **This week**. You see its blocks in order, with the free time between. Its **Kind of day** works the same way. A changed day wears a **Changed** tag.
- **Use it on more days** puts that template on other weekdays. Pick **Every week** to change your pattern, or **This week only** for just those dates. Then tap the **Apply** button, which says how many days.

Pick **Follow your week** again to undo a one-day change.

**This month** on the Time blocks page counts how many days of each kind you have had so far this month. Days on Everyday are not counted.

## How tasks fall into blocks

A task finds its block in one of four ways.

1. **You pick it.** In a task''s plan, the **Time block** select lists the blocks of that day first, then your other blocks.
2. **By its time.** Leave it on **By its time**, and a task at 11 am sits in the block that covers 11 am.
3. **Plan my week suggests one**, from the task''s area of life and pillar.
4. **Daily suggests one.** A task with no block and no time shows inside the block that fits, until you say.

## Seeing your day in blocks

On Daily, **Sort by** now has six choices: Day, Priority, Due date, By context, By time block and By area.

- **By time block** shows your tasks in coloured boxes, one per block, in clock order. Each box shows its times and a count, like "3 tasks · 1 h 30 of 3 h". A task with no block and no time shows as **Suggested** inside the block that fits, with **Keep here**. Nothing is saved until you tap. It never suggests your night''s sleep, a full block or a block already over. Tasks with no block sit in **No block yet**.
- **A task in the wrong block:** a timed task in a block meant for something else gets one quiet line, with **Move it** or **Keep here**. The task''s form says the same under its time.
- **By area** shows a box for each area of life that has tasks, in the order physical, financial, mental, emotional and spiritual. Tasks with no area sit in **No area**.
- Inside every box, P0 comes first.
- Tap a box to fold it. **Open all** and **Fold all** sit above them.
- These two views show up to 60 tasks, not six, so you can see the whole day.

**By context** reads the pillar your day template leads with. On a Family day, family tasks come first inside each priority. On a day that follows your default, the list sorts by day, unless you pick another sort.

Just above the list, **Your day** is a fold that shows each block as a band, with its tasks inside. It says how much room is left, like "45 min free", or "Over by 30 min" when you planned too much. A line like **3 tasks have no time or block yet** opens those tasks, each with a block picker.

## Plan my week suggests a block

Plan my week now gives each task a day and a block. It leans on the block''s area and pillar:

- A task in the financial area goes to a financial block, like Deep work or Busy work. A task with no area goes by its pillar.
- P0 and P1 tasks lean to a block tagged Focus. P2 and P3 tasks lean to the others.
- A block with room left wins over a full one.

Each suggestion shows its block under the title, with a select to change it. **Worth a look** adds two new lines. One says when a block is too full, like "Deep work on Tue holds 4h 30m of 3h." The other says when a Focus block is empty, and its **Fix** lets you drop a task in. Nothing changes until you tap **Keep what fits**.

## Why it works this way

A day has only so many hours. When you see the day as blocks, you see the room before you fill it. A day template saves you from planning the same shape again and again. And a one-day change means a bad day never breaks your week.

## What emerges and what develops

After a few weeks, Emerging on Daily starts to read your blocks back to you. It may say "You ticked 14 of 20 Deep work tasks inside the block." It also sets the tasks you tick on one kind of day beside your other days.

**Your kinds of day** shows your last four weeks by kind, each in its own colour, and how each kind went beside your other days: tasks ticked, and focus minutes and mood while those apps are on. A day counts as the kind you set for it, else the one your week gives it. Days on Everyday count as no kind. You see it on Daily, on the Time blocks page, under Emerging and on Reviews. Each line says what went together, never what caused what.

What develops is a sense of your own rhythm. You learn which hours are for deep work and which are for rest, and you plan around them.

> **Result:** your day has a shape. Each weekday has its kind of day, one-off days are easy to change, and your tasks fall into the blocks where they fit.

## The bottom line

Blocks are the parts of your day. A day template puts them on the clock and is your kind of day. Your usual week picks one for each weekday, and one date can change without touching the rest. Let tasks fall into blocks, and sort By time block to see where your day goes.', 6, 1);

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

On Daily, **Sort by** has **By time block** and **By area**. Each draws her tasks in coloured boxes, up to 60 tasks, with P0 first in every box. **By context** reads the pillar her day template leads with. **Your day**, a fold above the list, shows each block as a band with "45 min free" or "Over by 30 min".

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
9. **Privacy:** a coach never sees blocks or templates. The Logs show that a change was made, never which template.
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

On Daily, **Sort by** has **By time block** and **By area**. Each draws her tasks in coloured boxes, up to 60 tasks, with P0 first in every box. **By context** reads the pillar her day template leads with. **Your day**, a fold above the list, shows each block as a band with "45 min free" or "Over by 30 min".

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
9. **Privacy:** a coach never sees blocks or templates. The Logs show that a change was made, never which template.
10. **Their data:** blocks, templates and the week are in their export. **Erase everything** keeps them, since they are settings, not progress. Deleting the account removes them.

## The bottom line

Time blocks give a member''s day a shape, and a day template is their kind of day. It is theirs from end to end. As an admin, you know where each button is, so you can guide them, and you leave the blocks to their owner.', 4, 1);
UPDATE learning_items SET sequence = 5 WHERE id = 'prog-admin-guide-l04' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 6 WHERE id = 'prog-admin-guide-l05' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 7 WHERE id = 'prog-admin-guide-l06' AND program_id = 'prog-admin-guide';
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
