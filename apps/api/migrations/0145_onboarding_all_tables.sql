-- 0145: Onboarding lessons 07, 13, 15, 16, 19 and 20 brought up to their files for All tables (2026-11-13): a life coach sees a table only
-- when the person switches it on, a super admin may read a member's tables but never the journal, gratitude or body and mind, and All tables
-- joins the Essentials. Made with: node scripts/onboarding-guide/build.mjs --sync <this file> --only 07,13,15,16,19,20. Safe to run again.
UPDATE learning_items SET module_title = 'Journal, trackers and the five areas of life', body = 'You can tell when a hard week hits you. You sleep late, your mood dips and your stress climbs. These apps turn that feeling into a few taps a day, so you can see it change.

In this lesson you''ll learn:

- How to write in the Journal, how Prompt me helps when you are stuck, and how Gratitude for today works.
- How Mood, Sleep and Stress take a minute a day.
- How Wellbeing turns them into one score.
- How Life scores the five areas of life, and why they come in that order.

## Why these apps are there

Your pillars are about what you do. These apps are about how you are. They are all private. Your journal and your wellbeing numbers never reach a brand, the team or the leaderboard. A life coach sees your numbers only if you let them, and your journal only if you switch its table on for them.

## Find them

Journal and Life show on every new account. Mood, Sleep, Stress and Wellbeing start hidden on a new account, unless the setup chat showed one for you. Open **Apps**, open the **Reflection** group, open **Hidden apps** at its end and tap the eye beside each one.

## The Journal

1. Open **Journal** and tap **New entry**.
2. Give it a **Title**.
3. In **Say anything that is on your mind**, write as much or as little as you like.
4. Under **Emotion**, tap a face: Low, Sad, Neutral, Happy or Overjoyed.
5. Move the **Stress level** slider, and tap any **Stressor** that fits, such as Work, Money or Sleep.
6. Tap **Save entry**.

Your entries show under **My journals**. Once you have one, a calendar called **This month** shows up. Tap a past day to read it, or to write an entry for that day.

To change an entry, tap it and **Save changes**. To remove it, tap **Delete entry**. A box asks first, with a red yes.

## Prompt me

Some nights the box stays empty. Further down the page is **Not sure what to write?**

- Pick a **Category**, or leave it on Every category. There are sixteen, from Shadow work and Inner child to Gratitude and joy and Weekly reset.
- Tap **Prompt me**. A card shows a question and about how long it takes.
- Open **Why this prompt** and **What to expect** if you want to know more.
- Tap **Write about this** to start an entry with the prompt as its title.
- Tap **Another prompt** if it does not fit.

No prompt comes back until you have seen the whole set. The heavier categories end with a care note: if it gets too much, stop and talk to a professional or someone you trust.

## Gratitude for today

Right under **New entry** sits **Gratitude for today**: three short lines on what went right. Each line has its own prompt, from one of your seven pillars or from the day itself.

- **It saves as you type.** There is no button to tap.
- **Today or yesterday only.** Older days are read only.
- **A dot on the calendar** marks a day with gratitude. Tap the day to read its lines.
- **Pick another pillar:** on an empty line, tap the pillar''s name and choose from the list.
- **Another prompt:** the round arrows give you a new one from the same pillar.
- **Your usual three:** **Make these my usual three** keeps those pillars for each new day. **Stop my usual three** mixes them again.

A prompt you wrote under or skipped comes back only after the rest of that pillar''s prompts. It pays nothing, on purpose. You write these lines for yourself, not for xp.

## Mood, Sleep and Stress

Each takes about a minute.

- **Mood:** under "How are you feeling today?", tap a face and **Set mood**. Three sliders ask how active you were, how well you ate and how you slept. Then **Save today''s mood**.
- **Sleep:** under **Last night**, drag the ruler to the hours you slept and pick a **Quality**. Then **Save last night**. Seven to eight hours scores full marks.
- **Stress:** under **Right now**, move the slider from Calm to Overwhelmed. Under **What is behind it**, tap what is weighing on you. Then **Save today**.

Each app shows a line over the last 30 days. Mood also has a month calendar, so you can fill in a day you missed.

> **Pro tip:** log for one full week before you judge any score. Seven days of mood, sleep and stress make every chart honest.

## Wellbeing: one score

Wellbeing pulls the trackers into one number out of 100, from the last seven days. Mood counts most, then sleep, then stress, then your mindful minutes and your check-in streak. If you have not logged mood, sleep or stress yet, that part counts as middling, so a blank week does not drag you down. From Wellbeing you can jump to Journal to write it down, or to the Companion to talk it through.

## Life and the five areas

Life scores five areas of life, always in this order: physical, financial, mental, emotional, spiritual.

The order is the point. Each area holds up the next one. When your body is worn out, money choices get worse. When money is tight, your mind gets loud. A loud mind pulls your feelings down, and low feelings make it hard to feel any meaning. It works the other way too. A strong area lifts the one after it. So when one area slips, look at the one before it first.

Each area is built from what you already log:

- **Physical:** sleep, movement, mindful minutes and, once you log it in Fitness, eating.
- **Financial:** this month''s money, budgets, invoices and goals, from Finance.
- **Mental:** stress, the tasks you ticked, and your progress in School.
- **Emotional:** mood, your journal, and your friends, love and family pillars.
- **Spiritual:** stillness, small acts, and your teachers and faith pillars.

A task you tag with an area on Daily counts toward that area too. A part with nothing logged says so and does not count against you. Movement is logged right on the Life page: type the minutes under **Log movement** and tap **Add minutes**. Fitness logs the same minutes with their kind, distance and effort. A hundred and fifty a week gives full marks.

## What emerges over time

After a month, you see your own shape: the nights that wreck the next day, the stress that comes back every month end. Emerging, a later lesson, points at what tends to go together.

## What develops

You get better at naming how you feel. That is where change starts. You stop guessing why a week went wrong, and see which area pulled the next one down.

> **Result:** a few taps a day give you a private record of how you are, one score for your wellbeing, and a clear view of the five areas of your life.

## The bottom line

Write when you need to, log a minute a day, and let Life show you which area needs care first. Start at the front of the order, with your body, and the rest has something to stand on.' WHERE id = 'prog-onboarding-l07' AND program_id = 'prog-onboarding';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-onboarding-l07', 'prog-onboarding', 'Journal, trackers and the five areas of life', 'lesson', NULL, 'You can tell when a hard week hits you. You sleep late, your mood dips and your stress climbs. These apps turn that feeling into a few taps a day, so you can see it change.

In this lesson you''ll learn:

- How to write in the Journal, how Prompt me helps when you are stuck, and how Gratitude for today works.
- How Mood, Sleep and Stress take a minute a day.
- How Wellbeing turns them into one score.
- How Life scores the five areas of life, and why they come in that order.

## Why these apps are there

Your pillars are about what you do. These apps are about how you are. They are all private. Your journal and your wellbeing numbers never reach a brand, the team or the leaderboard. A life coach sees your numbers only if you let them, and your journal only if you switch its table on for them.

## Find them

Journal and Life show on every new account. Mood, Sleep, Stress and Wellbeing start hidden on a new account, unless the setup chat showed one for you. Open **Apps**, open the **Reflection** group, open **Hidden apps** at its end and tap the eye beside each one.

## The Journal

1. Open **Journal** and tap **New entry**.
2. Give it a **Title**.
3. In **Say anything that is on your mind**, write as much or as little as you like.
4. Under **Emotion**, tap a face: Low, Sad, Neutral, Happy or Overjoyed.
5. Move the **Stress level** slider, and tap any **Stressor** that fits, such as Work, Money or Sleep.
6. Tap **Save entry**.

Your entries show under **My journals**. Once you have one, a calendar called **This month** shows up. Tap a past day to read it, or to write an entry for that day.

To change an entry, tap it and **Save changes**. To remove it, tap **Delete entry**. A box asks first, with a red yes.

## Prompt me

Some nights the box stays empty. Further down the page is **Not sure what to write?**

- Pick a **Category**, or leave it on Every category. There are sixteen, from Shadow work and Inner child to Gratitude and joy and Weekly reset.
- Tap **Prompt me**. A card shows a question and about how long it takes.
- Open **Why this prompt** and **What to expect** if you want to know more.
- Tap **Write about this** to start an entry with the prompt as its title.
- Tap **Another prompt** if it does not fit.

No prompt comes back until you have seen the whole set. The heavier categories end with a care note: if it gets too much, stop and talk to a professional or someone you trust.

## Gratitude for today

Right under **New entry** sits **Gratitude for today**: three short lines on what went right. Each line has its own prompt, from one of your seven pillars or from the day itself.

- **It saves as you type.** There is no button to tap.
- **Today or yesterday only.** Older days are read only.
- **A dot on the calendar** marks a day with gratitude. Tap the day to read its lines.
- **Pick another pillar:** on an empty line, tap the pillar''s name and choose from the list.
- **Another prompt:** the round arrows give you a new one from the same pillar.
- **Your usual three:** **Make these my usual three** keeps those pillars for each new day. **Stop my usual three** mixes them again.

A prompt you wrote under or skipped comes back only after the rest of that pillar''s prompts. It pays nothing, on purpose. You write these lines for yourself, not for xp.

## Mood, Sleep and Stress

Each takes about a minute.

- **Mood:** under "How are you feeling today?", tap a face and **Set mood**. Three sliders ask how active you were, how well you ate and how you slept. Then **Save today''s mood**.
- **Sleep:** under **Last night**, drag the ruler to the hours you slept and pick a **Quality**. Then **Save last night**. Seven to eight hours scores full marks.
- **Stress:** under **Right now**, move the slider from Calm to Overwhelmed. Under **What is behind it**, tap what is weighing on you. Then **Save today**.

Each app shows a line over the last 30 days. Mood also has a month calendar, so you can fill in a day you missed.

> **Pro tip:** log for one full week before you judge any score. Seven days of mood, sleep and stress make every chart honest.

## Wellbeing: one score

Wellbeing pulls the trackers into one number out of 100, from the last seven days. Mood counts most, then sleep, then stress, then your mindful minutes and your check-in streak. If you have not logged mood, sleep or stress yet, that part counts as middling, so a blank week does not drag you down. From Wellbeing you can jump to Journal to write it down, or to the Companion to talk it through.

## Life and the five areas

Life scores five areas of life, always in this order: physical, financial, mental, emotional, spiritual.

The order is the point. Each area holds up the next one. When your body is worn out, money choices get worse. When money is tight, your mind gets loud. A loud mind pulls your feelings down, and low feelings make it hard to feel any meaning. It works the other way too. A strong area lifts the one after it. So when one area slips, look at the one before it first.

Each area is built from what you already log:

- **Physical:** sleep, movement, mindful minutes and, once you log it in Fitness, eating.
- **Financial:** this month''s money, budgets, invoices and goals, from Finance.
- **Mental:** stress, the tasks you ticked, and your progress in School.
- **Emotional:** mood, your journal, and your friends, love and family pillars.
- **Spiritual:** stillness, small acts, and your teachers and faith pillars.

A task you tag with an area on Daily counts toward that area too. A part with nothing logged says so and does not count against you. Movement is logged right on the Life page: type the minutes under **Log movement** and tap **Add minutes**. Fitness logs the same minutes with their kind, distance and effort. A hundred and fifty a week gives full marks.

## What emerges over time

After a month, you see your own shape: the nights that wreck the next day, the stress that comes back every month end. Emerging, a later lesson, points at what tends to go together.

## What develops

You get better at naming how you feel. That is where change starts. You stop guessing why a week went wrong, and see which area pulled the next one down.

> **Result:** a few taps a day give you a private record of how you are, one score for your wellbeing, and a clear view of the five areas of your life.

## The bottom line

Write when you need to, log a minute a day, and let Life show you which area needs care first. Start at the front of the order, with your body, and the rest has something to stand on.', 8, 1);
UPDATE learning_items SET module_title = 'Fitness: moving, eating and your supplements', body = 'You went for a walk and had a good lunch, and by Friday you cannot say how the week went. Fitness keeps it simple: a few taps for how you moved, and a short card for how you ate. There is nothing to weigh and nothing to count.

In this lesson you''ll learn:

- How to log movement in a few taps.
- How the eating check-in works, and why it never grades your day.
- How to keep your own supplement list, if you take any.
- Where these logs go, and who can see them.

## Find it

Fitness starts hidden on a new account, unless the setup chat showed it for you. Open **Apps**, open the **Reflection** group, open **Hidden apps** at its end and tap the eye beside **Fitness**. The setup chat offers it to runners, swimmers, gym regulars, people who do yoga and anyone who picks Move more or Eat well.

## Log movement

1. Pick **Today** or **Yesterday**.
2. Pick what you did: Run, Walk, Cycle, Swim, Yoga, Gym, Sport or Other.
3. Set the minutes on the ruler.
4. For a run, walk, ride or swim, you can add **Distance in km**.
5. Tap how hard it felt, from Easy to All out, if you like.
6. Add **A note only you see**, if you like, and tap **Save movement**.

**Your movement** lists what you logged, newest first. A run from a club reads **Club run**. It can be removed here, but not changed. Kreators Run''s own **Log a run or walk** writes the same minutes.

## How you ate

This is one short card, once a day. Every part is optional.

1. Under **Meals today**, tick Breakfast, Lunch, Evening snack or chai, Dinner or Something else. Or tick **Fasting today**.
2. Under each meal, tap **Good fuel**, **Tasty** or both. Neither reads Just ate.
3. Set **Fruit** and **Vegetables and greens**. A serving is about a fistful or a katori, and five together is a soft mark to aim for.
4. Open **Protein** if you want to add it up. Tap what you ate: Dal, Egg, Curd, Milk, Paneer, Chicken, or the rest under **More foods**. Each tap adds one serving, and the row keeps the number even when it is closed.
5. Open **More** if you want to say how much was packaged, fried or sweet, how full you felt, how many meals had no screen, or add a note.

With nothing logged for the day, **Same as yesterday** copies your last check-in into the card for you to check. It never saves by itself.

## The score, and why it is gentle

Your day gets a score from three things: fruit and vegetables, packaged food, and meals without a screen. Tasty and how full you felt never move it, so a meal you loved never counts against you. What you leave out does not count, and the rest share its weight, so a day with **More** left closed can still score full marks. A score does need your fruit and vegetables, even if the answer is 0. A fasting day has no score at all. Older days keep the scores they already have.

The app asks about meals. It never asks for calories or a photo, so a day is never a grade. How it works, at the foot of the page, has the half plate and how to read a label.

## Protein, its own number

Protein is not part of the score. You add it up by what you ate, so nothing needs weighing.

- **The grams are rough.** A katori of dal is about 7 g and an egg about 7 g. They come from India''s food tables. A label beats them, so you can type a number from a label under **More foods**, and change the grams in your scoop.
- **The number:** with a goal it reads "42 g of 60 g today" with a plain bar. There is no fail in it, and going over reads the same.
- **The goal:** open **Daily goal** and type what you weigh. ICMR-NIN gives adults about 0.83 g a day for each kg, and 1 g when most meals are rice or roti. Tap **Use** on one, change it if you like, then tap **Save goal**.
- **What is kept:** only the goal. What you weigh is never sent or saved, and it goes when you close the fold.
- **Who sees it:** only you. Not Emerging or Reviews, and not a coach, even with Reflection shared, unless you switch the Eating table on for them.

Check with a doctor if you have a kidney condition or are pregnant.

> **Pro tip:** do the check-in after dinner, when you can see the whole day. It takes about thirty seconds, and rough answers are fine.

## Your supplements

**Track supplements** starts off. Turn it on only if you already take something and want a list.

- **Your own list:** up to twelve. Each has a name as it says on the label, a kind, an amount as you type it, when you take it and on which days.
- **Tick what you took,** for today or yesterday. **Mark all taken** ticks a whole part of the day. You can Pause one, or Change it.
- **Copy my list** gives you the whole list as text, for a doctor or pharmacist.
- **Show on Daily** and **Reminders** each stay off until you say.

The app gives no starter list and no picks, and it has no words of its own about what any supplement does. The only words about one are the ones you typed. Please read these lines, which show on the screen too:

> The app does not check amounts or mixes. Ask a doctor or pharmacist before you start, stop or change one, more so if you take medicines or are pregnant.

Under **Before you add one**:

- Natural does not mean safe.
- Follow the label or what your doctor said. More is not better.
- Show this list to your doctor or pharmacist. It helps them spot a clash with your medicines.

## Where it goes

- **Active minutes and eating** feed Life, the numbers on Reviews, Emerging and your daily brief.
- **Moving** can show on Emerging as a good habit. It is only ever a good one.
- **A life coach** sees your minutes, your days moved and your eating number only under your Reflection switch, never a note. Your supplements, your notes and the whole of a table reach a coach only if you switch that table on for them.
- **A count of your supplements** shows in your own review, and nowhere else.

## It pays nothing

Fitness pays no xp and no points, and it earns no badge. That is on purpose. Nothing here pushes you to log more than is true.

## What emerges over time

After some weeks you can see the shape of your weeks: **Last 7 days**, a line over thirty days, the kinds you do most and a month you can tap through. A hundred and fifty active minutes in seven days gives full marks for movement in Life.

## What develops

You stop guessing. You see which days you tend to move and how you ate on the days that went well, and you choose more of what suits you.

> **Result:** a few taps a day give you a private record of how you move and eat, and a list of your supplements that is ready to show your doctor.

## The bottom line

Log what you did, tick your meals, and keep your supplement list only if you need one. It is all yours, it pays nothing, and it never grades you.' WHERE id = 'prog-onboarding-l19' AND program_id = 'prog-onboarding';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-onboarding-l19', 'prog-onboarding', 'Fitness: moving, eating and your supplements', 'lesson', NULL, 'You went for a walk and had a good lunch, and by Friday you cannot say how the week went. Fitness keeps it simple: a few taps for how you moved, and a short card for how you ate. There is nothing to weigh and nothing to count.

In this lesson you''ll learn:

- How to log movement in a few taps.
- How the eating check-in works, and why it never grades your day.
- How to keep your own supplement list, if you take any.
- Where these logs go, and who can see them.

## Find it

Fitness starts hidden on a new account, unless the setup chat showed it for you. Open **Apps**, open the **Reflection** group, open **Hidden apps** at its end and tap the eye beside **Fitness**. The setup chat offers it to runners, swimmers, gym regulars, people who do yoga and anyone who picks Move more or Eat well.

## Log movement

1. Pick **Today** or **Yesterday**.
2. Pick what you did: Run, Walk, Cycle, Swim, Yoga, Gym, Sport or Other.
3. Set the minutes on the ruler.
4. For a run, walk, ride or swim, you can add **Distance in km**.
5. Tap how hard it felt, from Easy to All out, if you like.
6. Add **A note only you see**, if you like, and tap **Save movement**.

**Your movement** lists what you logged, newest first. A run from a club reads **Club run**. It can be removed here, but not changed. Kreators Run''s own **Log a run or walk** writes the same minutes.

## How you ate

This is one short card, once a day. Every part is optional.

1. Under **Meals today**, tick Breakfast, Lunch, Evening snack or chai, Dinner or Something else. Or tick **Fasting today**.
2. Under each meal, tap **Good fuel**, **Tasty** or both. Neither reads Just ate.
3. Set **Fruit** and **Vegetables and greens**. A serving is about a fistful or a katori, and five together is a soft mark to aim for.
4. Open **Protein** if you want to add it up. Tap what you ate: Dal, Egg, Curd, Milk, Paneer, Chicken, or the rest under **More foods**. Each tap adds one serving, and the row keeps the number even when it is closed.
5. Open **More** if you want to say how much was packaged, fried or sweet, how full you felt, how many meals had no screen, or add a note.

With nothing logged for the day, **Same as yesterday** copies your last check-in into the card for you to check. It never saves by itself.

## The score, and why it is gentle

Your day gets a score from three things: fruit and vegetables, packaged food, and meals without a screen. Tasty and how full you felt never move it, so a meal you loved never counts against you. What you leave out does not count, and the rest share its weight, so a day with **More** left closed can still score full marks. A score does need your fruit and vegetables, even if the answer is 0. A fasting day has no score at all. Older days keep the scores they already have.

The app asks about meals. It never asks for calories or a photo, so a day is never a grade. How it works, at the foot of the page, has the half plate and how to read a label.

## Protein, its own number

Protein is not part of the score. You add it up by what you ate, so nothing needs weighing.

- **The grams are rough.** A katori of dal is about 7 g and an egg about 7 g. They come from India''s food tables. A label beats them, so you can type a number from a label under **More foods**, and change the grams in your scoop.
- **The number:** with a goal it reads "42 g of 60 g today" with a plain bar. There is no fail in it, and going over reads the same.
- **The goal:** open **Daily goal** and type what you weigh. ICMR-NIN gives adults about 0.83 g a day for each kg, and 1 g when most meals are rice or roti. Tap **Use** on one, change it if you like, then tap **Save goal**.
- **What is kept:** only the goal. What you weigh is never sent or saved, and it goes when you close the fold.
- **Who sees it:** only you. Not Emerging or Reviews, and not a coach, even with Reflection shared, unless you switch the Eating table on for them.

Check with a doctor if you have a kidney condition or are pregnant.

> **Pro tip:** do the check-in after dinner, when you can see the whole day. It takes about thirty seconds, and rough answers are fine.

## Your supplements

**Track supplements** starts off. Turn it on only if you already take something and want a list.

- **Your own list:** up to twelve. Each has a name as it says on the label, a kind, an amount as you type it, when you take it and on which days.
- **Tick what you took,** for today or yesterday. **Mark all taken** ticks a whole part of the day. You can Pause one, or Change it.
- **Copy my list** gives you the whole list as text, for a doctor or pharmacist.
- **Show on Daily** and **Reminders** each stay off until you say.

The app gives no starter list and no picks, and it has no words of its own about what any supplement does. The only words about one are the ones you typed. Please read these lines, which show on the screen too:

> The app does not check amounts or mixes. Ask a doctor or pharmacist before you start, stop or change one, more so if you take medicines or are pregnant.

Under **Before you add one**:

- Natural does not mean safe.
- Follow the label or what your doctor said. More is not better.
- Show this list to your doctor or pharmacist. It helps them spot a clash with your medicines.

## Where it goes

- **Active minutes and eating** feed Life, the numbers on Reviews, Emerging and your daily brief.
- **Moving** can show on Emerging as a good habit. It is only ever a good one.
- **A life coach** sees your minutes, your days moved and your eating number only under your Reflection switch, never a note. Your supplements, your notes and the whole of a table reach a coach only if you switch that table on for them.
- **A count of your supplements** shows in your own review, and nowhere else.

## It pays nothing

Fitness pays no xp and no points, and it earns no badge. That is on purpose. Nothing here pushes you to log more than is true.

## What emerges over time

After some weeks you can see the shape of your weeks: **Last 7 days**, a line over thirty days, the kinds you do most and a month you can tap through. A hundred and fifty active minutes in seven days gives full marks for movement in Life.

## What develops

You stop guessing. You see which days you tend to move and how you ate on the days that went well, and you choose more of what suits you.

> **Result:** a few taps a day give you a private record of how you move and eat, and a list of your supplements that is ready to show your doctor.

## The bottom line

Log what you did, tick your meals, and keep your supplement list only if you need one. It is all yours, it pays nothing, and it never grades you.', 9, 1);
UPDATE learning_items SET module_title = 'Working with a life coach', body = 'Some goals are easier with a person beside you. A life coach is someone who asks how the week went, notices what you missed and helps you pick the next step. Here, a coach only ever sees what you choose to share, and you can stop at any time.

In this lesson you''ll learn:

- How to find a coach, or say yes when one asks.
- What a coach can see, and the switch for each part.
- What a coach can do, and what stays yours.
- How to work as a coach, if that is you.

## Find it

Coaching starts hidden on a new account, unless the setup chat showed it for you. Open **Apps**, open the **Reflection** group, open **Hidden apps** at its end and tap the eye beside **Coaching**.

## Finding a coach

There are three ways in, and nothing is shared before you say yes.

- **Ask one:** under **Find a life coach**, tap **Ask to be coached**. The coach says yes or no.
- **Say yes when one asks:** a coach can ask you by email, @username or friend code. You tap **Say yes** or **Say no**.
- **Open an invite link:** a coach may send you a link or show a QR code. Open it, sign in, pick what they see, then tap **Yes**.

You can have up to three coaches at once. After a no, the same coach can ask again in thirty days.

## What they see

You choose in six parts, under **What they see**:

1. **Daily and streaks:** check-ins, streaks, xp, the tasks you ticked and your not to do list.
2. **Pillars and pyramids:** every layer of your pyramids, and how each project keeps pace.
3. **Routine and contract:** your routine, the days you kept it and the deal you signed.
4. **Life map answers:** where each pillar sits, your scores, your fears and what weighs on you.
5. **Reflection:** mood, sleep, stress, mindful minutes, movement, how you ate and your saved reviews.
6. **Patterns:** what the app finds in the parts above.

All six are on for a new coach, and Patterns is off for a coach you had before. A coach can ask once a week to see your patterns, and the choice stays yours. Change any part, or tap **End coaching**, under **Your life coach** on the Profile tab.

These six parts never show your journal, gratitude, supplements, money or a note.

## Whole tables

You can also share whole tables from **All tables** with one coach, one table at a time: your tasks, your money, your journal or any other. Open **Tables your coach can see** under **Your life coach** on the Profile tab and switch on the ones you want. Each one starts off. **Share all** and **Share none** change them all at once. A coach can read a table, but never change it, and the change log names the tables you switched, never what is in them.

> **Pro tip:** start with only the parts you want to talk about. You can turn on more once you trust them.

## Patterns

Patterns are found by plain rules, only in what you share, and kept nowhere. They say what goes together, never why. Your coach reads them as a way to ask better questions, and you stay the one who knows your life.

## What a coach does

- **Notes:** they land under **Notes from your coach** and in your inbox.
- **Tasks:** a coach can add a task under one of your projects, while your Pillars switch is on. It wears **From your coach** and can carry dates, a priority, a repeat and a length, never a time block. Only you tick it, and it pays the same as your own.
- **The change log:** every ask, yes, note and task change, with when it happened. You both read the same lines.

## If you are a coach

Say so in the setup chat, on your Profile tab, or under **Are you a life coach?** The team checks first. Once they say yes, your badge reads Life coach.

- **First steps:** a short list on Coaching. Each one ticks itself when you do it.
- **Add a student:** type an @username, a friend code or an email. Each person must say yes.
- **Your invite link:** one link for anyone you coach, with a QR code for a slide or a poster. **Make a new link** closes the old one.
- **Each student''s report:** pick a day, a week, a month or a quarter. **Show on this page** folds away what you do not need.
- **Suggestions:** they can fill a note or a task for you, and nothing goes until you send it. No line is ever made about eating.
- **Tables:** the outline **Tables** link on a student''s page opens the tables they switched on for you. You can sort, filter, search, copy and download them, and never change them.

A short week shows on your list as **Below the plan last week** only if that person''s contract picked The coach sees it.

## What grows over time

The change log turns into a plain record of the work you did together. Over months, your coach''s notes and your own ticks tell the same story, and you can see which small steps stuck.

## What develops

You learn to ask for help on your own terms. You share what is useful, keep what is yours, and end it when it stops helping.

> **Result:** you have a coach who sees only what you chose, or you know how to find one, and you can change your mind at any time.

## The bottom line

A coach helps most when you set the terms. Say yes only when you want to, pick what they see, and keep the switch in your own hands. Your journal stays yours: a coach sees it only if you switch its table on.' WHERE id = 'prog-onboarding-l20' AND program_id = 'prog-onboarding';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-onboarding-l20', 'prog-onboarding', 'Working with a life coach', 'lesson', NULL, 'Some goals are easier with a person beside you. A life coach is someone who asks how the week went, notices what you missed and helps you pick the next step. Here, a coach only ever sees what you choose to share, and you can stop at any time.

In this lesson you''ll learn:

- How to find a coach, or say yes when one asks.
- What a coach can see, and the switch for each part.
- What a coach can do, and what stays yours.
- How to work as a coach, if that is you.

## Find it

Coaching starts hidden on a new account, unless the setup chat showed it for you. Open **Apps**, open the **Reflection** group, open **Hidden apps** at its end and tap the eye beside **Coaching**.

## Finding a coach

There are three ways in, and nothing is shared before you say yes.

- **Ask one:** under **Find a life coach**, tap **Ask to be coached**. The coach says yes or no.
- **Say yes when one asks:** a coach can ask you by email, @username or friend code. You tap **Say yes** or **Say no**.
- **Open an invite link:** a coach may send you a link or show a QR code. Open it, sign in, pick what they see, then tap **Yes**.

You can have up to three coaches at once. After a no, the same coach can ask again in thirty days.

## What they see

You choose in six parts, under **What they see**:

1. **Daily and streaks:** check-ins, streaks, xp, the tasks you ticked and your not to do list.
2. **Pillars and pyramids:** every layer of your pyramids, and how each project keeps pace.
3. **Routine and contract:** your routine, the days you kept it and the deal you signed.
4. **Life map answers:** where each pillar sits, your scores, your fears and what weighs on you.
5. **Reflection:** mood, sleep, stress, mindful minutes, movement, how you ate and your saved reviews.
6. **Patterns:** what the app finds in the parts above.

All six are on for a new coach, and Patterns is off for a coach you had before. A coach can ask once a week to see your patterns, and the choice stays yours. Change any part, or tap **End coaching**, under **Your life coach** on the Profile tab.

These six parts never show your journal, gratitude, supplements, money or a note.

## Whole tables

You can also share whole tables from **All tables** with one coach, one table at a time: your tasks, your money, your journal or any other. Open **Tables your coach can see** under **Your life coach** on the Profile tab and switch on the ones you want. Each one starts off. **Share all** and **Share none** change them all at once. A coach can read a table, but never change it, and the change log names the tables you switched, never what is in them.

> **Pro tip:** start with only the parts you want to talk about. You can turn on more once you trust them.

## Patterns

Patterns are found by plain rules, only in what you share, and kept nowhere. They say what goes together, never why. Your coach reads them as a way to ask better questions, and you stay the one who knows your life.

## What a coach does

- **Notes:** they land under **Notes from your coach** and in your inbox.
- **Tasks:** a coach can add a task under one of your projects, while your Pillars switch is on. It wears **From your coach** and can carry dates, a priority, a repeat and a length, never a time block. Only you tick it, and it pays the same as your own.
- **The change log:** every ask, yes, note and task change, with when it happened. You both read the same lines.

## If you are a coach

Say so in the setup chat, on your Profile tab, or under **Are you a life coach?** The team checks first. Once they say yes, your badge reads Life coach.

- **First steps:** a short list on Coaching. Each one ticks itself when you do it.
- **Add a student:** type an @username, a friend code or an email. Each person must say yes.
- **Your invite link:** one link for anyone you coach, with a QR code for a slide or a poster. **Make a new link** closes the old one.
- **Each student''s report:** pick a day, a week, a month or a quarter. **Show on this page** folds away what you do not need.
- **Suggestions:** they can fill a note or a task for you, and nothing goes until you send it. No line is ever made about eating.
- **Tables:** the outline **Tables** link on a student''s page opens the tables they switched on for you. You can sort, filter, search, copy and download them, and never change them.

A short week shows on your list as **Below the plan last week** only if that person''s contract picked The coach sees it.

## What grows over time

The change log turns into a plain record of the work you did together. Over months, your coach''s notes and your own ticks tell the same story, and you can see which small steps stuck.

## What develops

You learn to ask for help on your own terms. You share what is useful, keep what is yours, and end it when it stops helping.

> **Result:** you have a coach who sees only what you chose, or you know how to find one, and you can change your mind at any time.

## The bottom line

A coach helps most when you set the terms. Say yes only when you want to, pick what they see, and keep the switch in your own hands. Your journal stays yours: a coach sees it only if you switch its table on.', 14, 1);
UPDATE learning_items SET module_title = 'Xp, points, badges and your money', body = 'You have been checking in for a few weeks. Xp, points, a streak and a few badges are piling up. What are they for? This lesson sorts them out, then shows you Finance, the private book for your real money.

In this lesson you''ll learn:

- The difference between xp and points, and how each is earned.
- What points can buy, from rewards to card games.
- How badges and honors work, and which ones stay private.
- How the Leaderboard works, and why it is your choice.
- What your trust score is made of.
- How Finance keeps your real money, in your own currency.

## Xp and points are not the same

- **Xp shows effort.** You earn it by doing things: a check-in, the small act, a ticked task, a post, an event. It moves your level, your stage and your pillars.
- **Points can be spent.** You earn them more slowly, and you trade them for real things.

Here is what the everyday things pay:

- **Check in:** 10 xp and 10 points. The first box on Daily.
- **A week in a row:** every seventh day of a check-in streak pays 50 points more.
- **The small act:** 15 xp.
- **A task:** 20 xp. Six a day pay, and the rest still count as done.
- **A kept day on the not to do list:** 5 xp.
- **Clearing a project:** 30 xp, when every task in it is done.

Posts, events and runs pay a little more. Two more pay when people come together:

- **Someone you invited:** if the team lets you make invite codes, under **Invite people** on the Profile tab, a person who joins with yours pays you 50 xp and 20 points once they have used the app on three different days.
- **A connection the team made:** when it comes true, such as you and a friend both saying yes, it pays each of you 10 xp, once for each pair.

An admin earns neither. The full list is in **Help**, under **How you earn**.

Your stage grows with xp and days together. You start as a Seed, become a Sprout at 300 xp and 3 days, and grow on up to Luminary. A stage cannot be rushed.

## What points buy

On the **Profile** tab, find **Points**. It has two buttons: **Rewards** and **Rank**.

1. Tap **Rewards**. **Your balance** shows at the top.
2. Scroll the **Catalog**. Its shelves include Books, Games, Apparel and wearables, Tech accessories and Experiences.
3. Tap **Reserve** on a thing you want. A sheet asks again before any points move.
4. It shows under **Your reservations**. Gear stays a reservation until a drop ships.

The **Games** shelf is different. A card game opens at once and is yours for good, so it cannot be cancelled. Some games also ask for some xp first, and a locked one says what is missing.

Points also pay for things priced in points in the Shop, School and Party, and for a featured week in the Store.

## Badges and honors

Badges are medals the app gives by its own count. Find them on the **Profile** tab, under **Badges**.

- **About sixty badges** in ten families, from Daily habits to Milestones.
- **Four tiers:** bronze, silver, gold and platinum.
- **One rule each:** a single count reaching a number. Tap a badge to see its next step and a bar.
- **Kept for good:** once earned, the app never takes a badge back on its own (only Erase everything clears them).
- **Some stay private:** the Reflection, Focus and Money families show only to you. They never appear on your page or the Leaderboard.
- **People count too:** Community holds Opened the door, for someone you invited who used the app on three different days, up to Fifty through the door, and Connected and Well connected, for connections the team made for you that came true.

A badge pays nothing, but some products, games and tools ask for one before they open.

Honors are different. They come from time in the app, like One week in and One year in, or from the team. They show under **Awarded**.

## The Leaderboard is your choice

The Leaderboard is on for everyone, but you are not on it until you say so.

1. On the **Profile** tab, tick **Show me on the leaderboard**.
2. Tap **Save profile**, or use **Show me on the boards** on the Leaderboard itself.
3. Tap **Rank** under Points to open it.

Pick a **Board**: Everyone, By goal, By pillar, By city, By who they are or By experience. Then pick **Rank by**: All time, This month, Streak or Badges. Each month is a season, and its top three get the Season top three honor.

Your journal, wellbeing and date of birth are never used. Nobody you blocked, and nobody who blocked you, is listed.

## Trust: what your work proves

Your trust score is one number out of a hundred. It reads New here, Getting known, Trusted or Well trusted. It is built only from what you earned: xp, points earned, your best streak, time here, sales and their rating, and honors. Nothing in it can be typed in. People see it on your public page, your products and your pre-owned listings. Tap it to see what it is made of.

## Finance: your real money

Points are the app''s. Finance is for your own money. It starts hidden on a new account, in the **Creation** group. No brand or leaderboard sees it. A coach sees it only if you switch its table on for them, and a super admin can read it to help you, with each look logged.

1. First, pick your currency. Open the **Public page** app, find **Currency** and save. It is rupees unless you change it.
2. Open **Finance**. Tap **Money in** or **Money out**, type the amount and who it was with, and save.
3. Use **Owed** for money someone owes you, or you owe them. **Monthly** posts a bill on the same day each month. **Goal** saves toward something. **Budgets** watches your spending.

Finance adds up only your currency. Other currencies are listed but not added in. If you use Agency, your sent invoices show as owed to you.

## What grows over time

Your level climbs, your badges fill in family by family, and your trust grows as you keep showing up. Finance turns a messy month into one clear line: what came in, what went out and what you kept.

> **Pro tip:** check in every day for your first week before you spend a single point. The seventh day pays the bonus, and you will know what you actually want by then.

> **Result:** you know what xp and points are for, you have reserved something real, you chose whether to be on the Leaderboard, and your money has one private home.

## The bottom line

Xp shows effort, points buy things, badges mark the road, and trust grows from what you prove. None of it can be bought or typed in. Show up, spend on what you will use, and keep your real money in Finance, where only you can see it.' WHERE id = 'prog-onboarding-l13' AND program_id = 'prog-onboarding';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-onboarding-l13', 'prog-onboarding', 'Xp, points, badges and your money', 'lesson', NULL, 'You have been checking in for a few weeks. Xp, points, a streak and a few badges are piling up. What are they for? This lesson sorts them out, then shows you Finance, the private book for your real money.

In this lesson you''ll learn:

- The difference between xp and points, and how each is earned.
- What points can buy, from rewards to card games.
- How badges and honors work, and which ones stay private.
- How the Leaderboard works, and why it is your choice.
- What your trust score is made of.
- How Finance keeps your real money, in your own currency.

## Xp and points are not the same

- **Xp shows effort.** You earn it by doing things: a check-in, the small act, a ticked task, a post, an event. It moves your level, your stage and your pillars.
- **Points can be spent.** You earn them more slowly, and you trade them for real things.

Here is what the everyday things pay:

- **Check in:** 10 xp and 10 points. The first box on Daily.
- **A week in a row:** every seventh day of a check-in streak pays 50 points more.
- **The small act:** 15 xp.
- **A task:** 20 xp. Six a day pay, and the rest still count as done.
- **A kept day on the not to do list:** 5 xp.
- **Clearing a project:** 30 xp, when every task in it is done.

Posts, events and runs pay a little more. Two more pay when people come together:

- **Someone you invited:** if the team lets you make invite codes, under **Invite people** on the Profile tab, a person who joins with yours pays you 50 xp and 20 points once they have used the app on three different days.
- **A connection the team made:** when it comes true, such as you and a friend both saying yes, it pays each of you 10 xp, once for each pair.

An admin earns neither. The full list is in **Help**, under **How you earn**.

Your stage grows with xp and days together. You start as a Seed, become a Sprout at 300 xp and 3 days, and grow on up to Luminary. A stage cannot be rushed.

## What points buy

On the **Profile** tab, find **Points**. It has two buttons: **Rewards** and **Rank**.

1. Tap **Rewards**. **Your balance** shows at the top.
2. Scroll the **Catalog**. Its shelves include Books, Games, Apparel and wearables, Tech accessories and Experiences.
3. Tap **Reserve** on a thing you want. A sheet asks again before any points move.
4. It shows under **Your reservations**. Gear stays a reservation until a drop ships.

The **Games** shelf is different. A card game opens at once and is yours for good, so it cannot be cancelled. Some games also ask for some xp first, and a locked one says what is missing.

Points also pay for things priced in points in the Shop, School and Party, and for a featured week in the Store.

## Badges and honors

Badges are medals the app gives by its own count. Find them on the **Profile** tab, under **Badges**.

- **About sixty badges** in ten families, from Daily habits to Milestones.
- **Four tiers:** bronze, silver, gold and platinum.
- **One rule each:** a single count reaching a number. Tap a badge to see its next step and a bar.
- **Kept for good:** once earned, the app never takes a badge back on its own (only Erase everything clears them).
- **Some stay private:** the Reflection, Focus and Money families show only to you. They never appear on your page or the Leaderboard.
- **People count too:** Community holds Opened the door, for someone you invited who used the app on three different days, up to Fifty through the door, and Connected and Well connected, for connections the team made for you that came true.

A badge pays nothing, but some products, games and tools ask for one before they open.

Honors are different. They come from time in the app, like One week in and One year in, or from the team. They show under **Awarded**.

## The Leaderboard is your choice

The Leaderboard is on for everyone, but you are not on it until you say so.

1. On the **Profile** tab, tick **Show me on the leaderboard**.
2. Tap **Save profile**, or use **Show me on the boards** on the Leaderboard itself.
3. Tap **Rank** under Points to open it.

Pick a **Board**: Everyone, By goal, By pillar, By city, By who they are or By experience. Then pick **Rank by**: All time, This month, Streak or Badges. Each month is a season, and its top three get the Season top three honor.

Your journal, wellbeing and date of birth are never used. Nobody you blocked, and nobody who blocked you, is listed.

## Trust: what your work proves

Your trust score is one number out of a hundred. It reads New here, Getting known, Trusted or Well trusted. It is built only from what you earned: xp, points earned, your best streak, time here, sales and their rating, and honors. Nothing in it can be typed in. People see it on your public page, your products and your pre-owned listings. Tap it to see what it is made of.

## Finance: your real money

Points are the app''s. Finance is for your own money. It starts hidden on a new account, in the **Creation** group. No brand or leaderboard sees it. A coach sees it only if you switch its table on for them, and a super admin can read it to help you, with each look logged.

1. First, pick your currency. Open the **Public page** app, find **Currency** and save. It is rupees unless you change it.
2. Open **Finance**. Tap **Money in** or **Money out**, type the amount and who it was with, and save.
3. Use **Owed** for money someone owes you, or you owe them. **Monthly** posts a bill on the same day each month. **Goal** saves toward something. **Budgets** watches your spending.

Finance adds up only your currency. Other currencies are listed but not added in. If you use Agency, your sent invoices show as owed to you.

## What grows over time

Your level climbs, your badges fill in family by family, and your trust grows as you keep showing up. Finance turns a messy month into one clear line: what came in, what went out and what you kept.

> **Pro tip:** check in every day for your first week before you spend a single point. The seventh day pays the bonus, and you will know what you actually want by then.

> **Result:** you know what xp and points are for, you have reserved something real, you chose whether to be on the Leaderboard, and your money has one private home.

## The bottom line

Xp shows effort, points buy things, badges mark the road, and trust grows from what you prove. None of it can be bought or typed in. Show up, spend on what you will use, and keep your real money in Finance, where only you can see it.', 16, 1);
UPDATE learning_items SET module_title = 'Your privacy and your data', body = 'You write things here that you would not post: how you slept, what stressed you, a page in your journal. So you should know who sees what. Most of it is yours alone, and you hold the switches for the rest.

In this lesson you''ll learn:

- What only you see, and what the team may read.
- What others may see, and the switch for each part.
- How your devices and your password work.
- How to see all your data as tables, take it with you, or wipe it.

## What only you see

Some things in the app are for your eyes only. They never reach brands, the team, the leaderboard or your public page. A coach sees one only if you switch it on for them.

- **Your journal:** every entry, every prompt you wrote about, and your gratitude lines. A coach sees them only if you switch that table on for them.
- **Your wellbeing logs:** mood, sleep, stress, mindful minutes, your movement and how you ate, and the one wellbeing score. Only a coach you said yes to can see the numbers, and only while you allow it.
- **Your supplements:** if you keep the list in Fitness, only you see it. Never the assistant, and a coach only if you switch its table on.
- **Discover:** your quiz answers, your results and the add-ons, like love languages and how your mind works.
- **Your phone and date of birth:** asked once at sign-up, never shown to anyone.
- **Your year:** the grid of days on the Profile tab.
- **Emerging:** the patterns the app notices. They are worked out fresh each time you look, and never saved. A coach sees them only if you switch Patterns on.

Your tags, the words you picked on Profile or in the setup chat, mark the apps that fit you. They never show on your public page. Some badges are private too. The Focus, Reflection and Money families show only to you, and only counts are used for them, never what you wrote.

## What others may see, and your switch for it

### Your public page

Your public page is your front door. On the Profile tab, **See my public page** shows it and **Edit page** changes it.

Under **What is public** there are ten switches. **My page is public** comes first. Turn it off and the whole page hides from everyone but you. The rest need it on:

- **Show my social icons**, **Show my links**, **Show my portfolio** and **Show what I sell**.
- **Show my posts** and **Show my badges**.
- **Show my activity:** your level, streak and how many pillars are set up. This one starts off.
- **Let people add me as a friend** and **Let friends start a chat**.

Tap **Save profile** when you are done.

### The leaderboard

You are not on it until you tick **Show me on the leaderboard** on the Profile tab. Your journal and wellbeing never count there.

### A life coach

If you work with a coach, you pick what they see, in six parts: Daily and streaks, pillars and pyramids, routine and contract, life map answers, reflection and patterns. All are on for a new coach, and Patterns is off for a coach you had before. Reflection is your wellbeing numbers and saved reviews. The six parts never show your journal, gratitude, supplements, money or a note.

You can also share whole tables with one coach, one at a time, under **Tables your coach can see**. Each starts off, and a coach can read a table but never change it. Turn any part or table off, or end the link, at any time.

### Your tables and the team

**All tables** shows each list you keep, from tasks and moods to money and badges, as a table. A super admin on the team can open your tables to help you or to look into a problem. They can read them, never change them, and never open your journal, gratitude or body and mind tables. Each table they open or download is written in a log, and your export lists when. Your money in Finance is one of the tables they can read.

### The assistant

The assistant reads your journal only when you ask it about your journal. Even then, only a model that keeps nothing may read it, and the picker marks those models "keeps nothing". Discover reaches it only as a short summary, and only if you switch on **Let the assistant learn from them**.

### People you talk to

- **Post anonymously:** in Community you can post or reply under a made-up name. Others never see who you are.
- **Block:** in Bond, block anyone. Neither of you sees the other''s posts or friend asks. **People you blocked** lets you lift it later.
- **No live links:** a web address in a post or a chat shows as plain text.

## Your privacy choices

The first time you visit, a small card called **Your privacy** asks about three things. All three start off.

- **Remember which link brought me:** a cookie for thirty days that tells a creator which link sent you.
- **Show videos from YouTube and Vimeo:** off means a video waits until you tap it.
- **Send me news and offers by email:** off means only the mail you need, like receipts.

**Reject all** and **Accept all** look the same, so neither is pushed. **Choose for each** opens the three switches. To change your mind later, open **Privacy choices** on the Profile tab. Each tick saves at once.

## Your devices and your password

- **Three devices at once:** your account can be open on three phones or laptops. Sign in on a fourth and the oldest one is signed out. That device then says why.
- **Change password:** on the Profile tab, under Account. Every other device is then signed out.
- **Forgot it:** the sign-in screen has **Forgot your password?** It mails you a link that works for thirty minutes.
- **Your clock:** on the Profile tab, **Dates and times** sets your time zone and how dates and clocks read. Every screen and every reminder follows it, and printed paper keeps its own. If your device is on another clock, **Use this zone** moves you to it.
- **Your calendar:** under **Calendar**, **Show my tasks in my calendar** starts off. It shows task titles, pillars, priorities and times, never your notes or journal. **Make a fresh link** stops the old one.

> **Pro tip:** if you lose a phone, change your password from any other device. That one step signs the lost phone out.

## Take it with you, or wipe it

Open **All tables** to see any list as a table. Sort it, filter it, search it, then copy the rows you tick or download them as a CSV file.

On the Profile tab, the **Your data** card has three buttons.

1. **Export my data:** everything we hold about you, as one file you can keep.
2. **Erase everything:** your pillars, xp, streak and badges go, and you start over. A sheet asks first, with a red **Yes, erase everything** and **Keep my progress**. After it, the setup chat opens again. Your journal, gratitude, trackers and Fitness logs stay.
3. **Delete my account:** a sheet lists what happens. You type DELETE, then tap **Delete my account**. Your name, page, pillars, logs, journal and messages are gone. Your events, runs and sessions still to come are cancelled, and whoever was coming is told. What you never sold goes, and what you sold is archived for the people who bought it. Money records and what others rely on stay, without your name. A note already in someone else''s inbox keeps the words it was written with.

> **Result:** you know what is yours alone, which switch shares each part, and how to leave with your data.

## The bottom line

Your inner life stays yours: journal, wellbeing, Discover and your tags. Everything you share has a switch you own. And you can take your data with you, or wipe it, at any time.' WHERE id = 'prog-onboarding-l15' AND program_id = 'prog-onboarding';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-onboarding-l15', 'prog-onboarding', 'Your privacy and your data', 'lesson', NULL, 'You write things here that you would not post: how you slept, what stressed you, a page in your journal. So you should know who sees what. Most of it is yours alone, and you hold the switches for the rest.

In this lesson you''ll learn:

- What only you see, and what the team may read.
- What others may see, and the switch for each part.
- How your devices and your password work.
- How to see all your data as tables, take it with you, or wipe it.

## What only you see

Some things in the app are for your eyes only. They never reach brands, the team, the leaderboard or your public page. A coach sees one only if you switch it on for them.

- **Your journal:** every entry, every prompt you wrote about, and your gratitude lines. A coach sees them only if you switch that table on for them.
- **Your wellbeing logs:** mood, sleep, stress, mindful minutes, your movement and how you ate, and the one wellbeing score. Only a coach you said yes to can see the numbers, and only while you allow it.
- **Your supplements:** if you keep the list in Fitness, only you see it. Never the assistant, and a coach only if you switch its table on.
- **Discover:** your quiz answers, your results and the add-ons, like love languages and how your mind works.
- **Your phone and date of birth:** asked once at sign-up, never shown to anyone.
- **Your year:** the grid of days on the Profile tab.
- **Emerging:** the patterns the app notices. They are worked out fresh each time you look, and never saved. A coach sees them only if you switch Patterns on.

Your tags, the words you picked on Profile or in the setup chat, mark the apps that fit you. They never show on your public page. Some badges are private too. The Focus, Reflection and Money families show only to you, and only counts are used for them, never what you wrote.

## What others may see, and your switch for it

### Your public page

Your public page is your front door. On the Profile tab, **See my public page** shows it and **Edit page** changes it.

Under **What is public** there are ten switches. **My page is public** comes first. Turn it off and the whole page hides from everyone but you. The rest need it on:

- **Show my social icons**, **Show my links**, **Show my portfolio** and **Show what I sell**.
- **Show my posts** and **Show my badges**.
- **Show my activity:** your level, streak and how many pillars are set up. This one starts off.
- **Let people add me as a friend** and **Let friends start a chat**.

Tap **Save profile** when you are done.

### The leaderboard

You are not on it until you tick **Show me on the leaderboard** on the Profile tab. Your journal and wellbeing never count there.

### A life coach

If you work with a coach, you pick what they see, in six parts: Daily and streaks, pillars and pyramids, routine and contract, life map answers, reflection and patterns. All are on for a new coach, and Patterns is off for a coach you had before. Reflection is your wellbeing numbers and saved reviews. The six parts never show your journal, gratitude, supplements, money or a note.

You can also share whole tables with one coach, one at a time, under **Tables your coach can see**. Each starts off, and a coach can read a table but never change it. Turn any part or table off, or end the link, at any time.

### Your tables and the team

**All tables** shows each list you keep, from tasks and moods to money and badges, as a table. A super admin on the team can open your tables to help you or to look into a problem. They can read them, never change them, and never open your journal, gratitude or body and mind tables. Each table they open or download is written in a log, and your export lists when. Your money in Finance is one of the tables they can read.

### The assistant

The assistant reads your journal only when you ask it about your journal. Even then, only a model that keeps nothing may read it, and the picker marks those models "keeps nothing". Discover reaches it only as a short summary, and only if you switch on **Let the assistant learn from them**.

### People you talk to

- **Post anonymously:** in Community you can post or reply under a made-up name. Others never see who you are.
- **Block:** in Bond, block anyone. Neither of you sees the other''s posts or friend asks. **People you blocked** lets you lift it later.
- **No live links:** a web address in a post or a chat shows as plain text.

## Your privacy choices

The first time you visit, a small card called **Your privacy** asks about three things. All three start off.

- **Remember which link brought me:** a cookie for thirty days that tells a creator which link sent you.
- **Show videos from YouTube and Vimeo:** off means a video waits until you tap it.
- **Send me news and offers by email:** off means only the mail you need, like receipts.

**Reject all** and **Accept all** look the same, so neither is pushed. **Choose for each** opens the three switches. To change your mind later, open **Privacy choices** on the Profile tab. Each tick saves at once.

## Your devices and your password

- **Three devices at once:** your account can be open on three phones or laptops. Sign in on a fourth and the oldest one is signed out. That device then says why.
- **Change password:** on the Profile tab, under Account. Every other device is then signed out.
- **Forgot it:** the sign-in screen has **Forgot your password?** It mails you a link that works for thirty minutes.
- **Your clock:** on the Profile tab, **Dates and times** sets your time zone and how dates and clocks read. Every screen and every reminder follows it, and printed paper keeps its own. If your device is on another clock, **Use this zone** moves you to it.
- **Your calendar:** under **Calendar**, **Show my tasks in my calendar** starts off. It shows task titles, pillars, priorities and times, never your notes or journal. **Make a fresh link** stops the old one.

> **Pro tip:** if you lose a phone, change your password from any other device. That one step signs the lost phone out.

## Take it with you, or wipe it

Open **All tables** to see any list as a table. Sort it, filter it, search it, then copy the rows you tick or download them as a CSV file.

On the Profile tab, the **Your data** card has three buttons.

1. **Export my data:** everything we hold about you, as one file you can keep.
2. **Erase everything:** your pillars, xp, streak and badges go, and you start over. A sheet asks first, with a red **Yes, erase everything** and **Keep my progress**. After it, the setup chat opens again. Your journal, gratitude, trackers and Fitness logs stay.
3. **Delete my account:** a sheet lists what happens. You type DELETE, then tap **Delete my account**. Your name, page, pillars, logs, journal and messages are gone. Your events, runs and sessions still to come are cancelled, and whoever was coming is told. What you never sold goes, and what you sold is archived for the people who bought it. Money records and what others rely on stay, without your name. A note already in someone else''s inbox keeps the words it was written with.

> **Result:** you know what is yours alone, which switch shares each part, and how to leave with your data.

## The bottom line

Your inner life stays yours: journal, wellbeing, Discover and your tags. Everything you share has a switch you own. And you can take your data with you, or wipe it, at any time.', 18, 1);
UPDATE learning_items SET module_title = 'Hiding and unhiding your apps', body = 'kreators.app holds about forty apps. Nobody needs them all. A student needs different ones from a video editor. So every app can be hidden, and the app works best when you keep showing only the ones you use.

In this lesson you''ll learn:

- How the apps are grouped, and which ones are always there.
- How to hide and unhide an app, and what happens to your data.
- How to choose which groups start open, and put apps in your own order.
- Why fewer apps often means more grows.

## The five groups

Every app lives in one group. The groups always come in the same order, on every screen.

- **Contribution:** work for others and for pay, like School, Work, Army, Win and Agency.
- **Reflection:** looking inward, like Journal, Life, Mood, Sleep, Stress, Fitness, Mindfulness, Reviews, Discover, the Companion and Coaching.
- **Connection:** people, like Community, Bond, Party, Kreators Run, Circles, Club and Games.
- **Creation:** making and selling, like your Public page, Shop, Store, Finance, Knowledge and Tools.
- **Essentials:** the Leaderboard, Inbox, All tables and Help.

A few parts cannot be hidden, because the app is built on them. Home, Daily, Pillars, Search and the assistant are always there, so they do not show in the lists.

## Where your first apps came from

You did not start with a blank list. A new account comes with a few apps showing, like School, Work, Journal, Life and Shop. Then the setup chat read your answers and showed the apps that fit you, up to five. It hid the other apps it can, so your screen starts calm.

That was a first guess, not a rule. You can change it at any time, in two places.

## The Apps page

The **Apps** tab is the quick way.

1. Open **Apps**. The line at the top counts them, like "3 shown, 20 hidden".
2. Each group is one big card that says something like "3 of 7 shown". Tap it to open it.
3. Each app shows its icon, its name and one line on what it does. Tap its name to open it.
4. Tap the round eye at its right to hide it.
5. **Hidden apps**, at the end of the group, holds the rest. Open it and tap the eye beside an app to show it again.

While an app is hidden, a round **Hidden apps** button sits beside the count. It opens every hidden app in one place, so you can bring one back without opening its group. Home''s **Go to** has the same button.

To change several at once, tap **Select** beside the count. Each eye becomes a tick box. Tick the apps you want, or tap **Select all** for every app on the page. **Hide** and **Show** come up beside it, each with how many it will change. Tap one, and tap **Done** when you finish.

## Profile, Features

The **Features** part of the Profile tab shows the same groups, all open. It adds three things the Apps page does not have.

- **Fits you:** an app that matches your setup answers says so, with the reason. It is a hint, never a push.
- **Starts open on Apps and in the menu:** each group has this switch. Turn it on for the groups you use most. By default, Contribution and Essentials start open, and the rest start closed.
- **Arrange apps:** tap it and each app gets a drag handle, plus **Move up** and **Move down** buttons. Put the app you use most at the top. Apps move only inside their own group. Tap **Done** when you are happy.

A group you arranged also gets **Reset order** in its More menu, in case you want the old order back.

> **Pro tip:** your order and your open groups are saved on your account, not on one phone. Sign in on a laptop and the sidebar is already set up your way.

## What happens when you hide an app

Hiding deletes nothing.

- Your pages, logs and tasks stay put. Show the app again and they are there.
- A hidden app leaves the sidebar, the phone menu and Home.
- Emerging stops reading it. A pattern only runs while every app it reads is showing, so hide Sleep and the app stops looking for links with your sleep.

If you want your data gone, that is a different step: **Erase everything** or **Delete my account** under Your data on the Profile tab. The privacy lesson covers both.

## Where your apps show up

Once an app is showing, it appears in a few places at once.

- **On a laptop:** the sidebar lists your apps under their groups. The round button on its edge folds it to a slim row of icons, and opens it again.
- **On a phone:** the button at the top right opens **Your apps**, the same groups in a menu.
- **On Home:** the **Go to** section shows every app you have not hidden, as picture tiles: a sideways row on a phone. **All apps** opens the Apps page.

Inside a group, every app keeps its place, so you find it where you last saw it. If you arranged the group, your own order comes first. The rest keep the app''s own order, with the ones that are showing on top.

Every app''s main screen ends with a **How it works** card. Tap it to read the steps and the words the app uses. **Help** has every word in one place, under **Words we use**.

## Run the setup chat again

Life changes. Maybe you started freelancing, or you joined a run club. On the Profile tab, under **Who you are**, tap **Match my apps again**. The setup chat opens with your last answers filled in. Change what is different, and it suggests a fresh set of apps.

Read its list before you say yes. Like the first time, it hides the other apps it can. Your data in them stays safe.

The tag tiles under **Who you are** never change your apps. They only mark the apps that fit you, and only the chat shows and hides apps for you.

Some apps also show by themselves when you earn them. Unlock a card game in Rewards, for example, and **Games** appears.

## Why fewer is better

Each app you add asks for some of your time. Three to five apps you open every week beat fifteen you forget. Start small, and add an app when you need it.

> **Result:** your screen shows the apps you use, in the groups you open, in the order you chose, on every device.

## The bottom line

Every app can be hidden, and hiding never deletes. Use the Apps page to hide and unhide fast, and Profile, Features to set which groups open and in what order. Keep the list short, and let it grow with you.' WHERE id = 'prog-onboarding-l16' AND program_id = 'prog-onboarding';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-onboarding-l16', 'prog-onboarding', 'Hiding and unhiding your apps', 'lesson', NULL, 'kreators.app holds about forty apps. Nobody needs them all. A student needs different ones from a video editor. So every app can be hidden, and the app works best when you keep showing only the ones you use.

In this lesson you''ll learn:

- How the apps are grouped, and which ones are always there.
- How to hide and unhide an app, and what happens to your data.
- How to choose which groups start open, and put apps in your own order.
- Why fewer apps often means more grows.

## The five groups

Every app lives in one group. The groups always come in the same order, on every screen.

- **Contribution:** work for others and for pay, like School, Work, Army, Win and Agency.
- **Reflection:** looking inward, like Journal, Life, Mood, Sleep, Stress, Fitness, Mindfulness, Reviews, Discover, the Companion and Coaching.
- **Connection:** people, like Community, Bond, Party, Kreators Run, Circles, Club and Games.
- **Creation:** making and selling, like your Public page, Shop, Store, Finance, Knowledge and Tools.
- **Essentials:** the Leaderboard, Inbox, All tables and Help.

A few parts cannot be hidden, because the app is built on them. Home, Daily, Pillars, Search and the assistant are always there, so they do not show in the lists.

## Where your first apps came from

You did not start with a blank list. A new account comes with a few apps showing, like School, Work, Journal, Life and Shop. Then the setup chat read your answers and showed the apps that fit you, up to five. It hid the other apps it can, so your screen starts calm.

That was a first guess, not a rule. You can change it at any time, in two places.

## The Apps page

The **Apps** tab is the quick way.

1. Open **Apps**. The line at the top counts them, like "3 shown, 20 hidden".
2. Each group is one big card that says something like "3 of 7 shown". Tap it to open it.
3. Each app shows its icon, its name and one line on what it does. Tap its name to open it.
4. Tap the round eye at its right to hide it.
5. **Hidden apps**, at the end of the group, holds the rest. Open it and tap the eye beside an app to show it again.

While an app is hidden, a round **Hidden apps** button sits beside the count. It opens every hidden app in one place, so you can bring one back without opening its group. Home''s **Go to** has the same button.

To change several at once, tap **Select** beside the count. Each eye becomes a tick box. Tick the apps you want, or tap **Select all** for every app on the page. **Hide** and **Show** come up beside it, each with how many it will change. Tap one, and tap **Done** when you finish.

## Profile, Features

The **Features** part of the Profile tab shows the same groups, all open. It adds three things the Apps page does not have.

- **Fits you:** an app that matches your setup answers says so, with the reason. It is a hint, never a push.
- **Starts open on Apps and in the menu:** each group has this switch. Turn it on for the groups you use most. By default, Contribution and Essentials start open, and the rest start closed.
- **Arrange apps:** tap it and each app gets a drag handle, plus **Move up** and **Move down** buttons. Put the app you use most at the top. Apps move only inside their own group. Tap **Done** when you are happy.

A group you arranged also gets **Reset order** in its More menu, in case you want the old order back.

> **Pro tip:** your order and your open groups are saved on your account, not on one phone. Sign in on a laptop and the sidebar is already set up your way.

## What happens when you hide an app

Hiding deletes nothing.

- Your pages, logs and tasks stay put. Show the app again and they are there.
- A hidden app leaves the sidebar, the phone menu and Home.
- Emerging stops reading it. A pattern only runs while every app it reads is showing, so hide Sleep and the app stops looking for links with your sleep.

If you want your data gone, that is a different step: **Erase everything** or **Delete my account** under Your data on the Profile tab. The privacy lesson covers both.

## Where your apps show up

Once an app is showing, it appears in a few places at once.

- **On a laptop:** the sidebar lists your apps under their groups. The round button on its edge folds it to a slim row of icons, and opens it again.
- **On a phone:** the button at the top right opens **Your apps**, the same groups in a menu.
- **On Home:** the **Go to** section shows every app you have not hidden, as picture tiles: a sideways row on a phone. **All apps** opens the Apps page.

Inside a group, every app keeps its place, so you find it where you last saw it. If you arranged the group, your own order comes first. The rest keep the app''s own order, with the ones that are showing on top.

Every app''s main screen ends with a **How it works** card. Tap it to read the steps and the words the app uses. **Help** has every word in one place, under **Words we use**.

## Run the setup chat again

Life changes. Maybe you started freelancing, or you joined a run club. On the Profile tab, under **Who you are**, tap **Match my apps again**. The setup chat opens with your last answers filled in. Change what is different, and it suggests a fresh set of apps.

Read its list before you say yes. Like the first time, it hides the other apps it can. Your data in them stays safe.

The tag tiles under **Who you are** never change your apps. They only mark the apps that fit you, and only the chat shows and hides apps for you.

Some apps also show by themselves when you earn them. Unlock a card game in Rewards, for example, and **Games** appears.

## Why fewer is better

Each app you add asks for some of your time. Three to five apps you open every week beat fifteen you forget. Start small, and add an app when you need it.

> **Result:** your screen shows the apps you use, in the groups you open, in the order you chose, on every device.

## The bottom line

Every app can be hidden, and hiding never deletes. Use the Apps page to hide and unhide fast, and Profile, Features to set which groups open and in what order. Keep the list short, and let it grow with you.', 19, 1);
