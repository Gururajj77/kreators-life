-- 0148: Onboarding lessons 13, 14, 15 and 19 brought up to their files after the review of All tables (2026-11-13): money in Finance and
-- the journal are no longer called "only you" now that a person may share those tables with a life coach, the movement note is "A note",
-- and All tables shows "your own lists", never "any list". Made with: node scripts/onboarding-guide/build.mjs --sync <this file> --only
-- 13,14,15,19. Safe to run again.
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
6. Add **A note**, if you like, and tap **Save movement**.

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
6. Add **A note**, if you like, and tap **Save movement**.

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

Xp shows effort, points buy things, badges mark the road, and trust grows from what you prove. None of it can be bought or typed in. Show up, spend on what you will use, and keep your real money in Finance.' WHERE id = 'prog-onboarding-l13' AND program_id = 'prog-onboarding';
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

Xp shows effort, points buy things, badges mark the road, and trust grows from what you prove. None of it can be bought or typed in. Show up, spend on what you will use, and keep your real money in Finance.', 16, 1);
UPDATE learning_items SET module_title = 'The assistant and the Companion', body = 'Some days you want to say "log my sleep and add a task for Friday" and be done. Other days you just want to talk the day through. The assistant does the first. The Companion does the second.

In this lesson you''ll learn:

- What the assistant does for free, and what needs a plan.
- How plans and credits work, in plain words.
- How every change can be undone.
- What the Companion is, and what it is not.
- Where to turn if you are ever in danger.

## Meet the assistant

The round button with Bumling in it, at the bottom right of every screen, is the assistant. On a phone it sits above the tab bar. Tap it, and the **Bumling AI assistant** panel opens. The page under it stays in view, so you can watch things land.

**Close** folds the panel back into the button and keeps your chat.

## The free half: flows

Flows are short taps that cost nothing. Each one says where its answer lands. A few of them:

- **Check in for today** and **Mark the small act done**, which land on Daily.
- **Add a task** and **Add to a pyramid**, which land in Pillars.
- **Mark my not to do list** and **Add to my not to do list**.
- **Log my mood**, **Log my sleep**, **Log my stress** and **Log mindful minutes**.
- **Write in my journal**, which nobody else sees unless you share it.
- **Add money in or out** and **Set a money goal**, when Finance is on.

A flow for an app you have hidden does not show. Flows use the same steps as your own taps, so the same rules apply.

## The paid half: typing

Typing a line, like "move my edit task to Friday", needs a plan.

1. Type what you want in the box at the bottom.
2. Bumling does it in the app, as you, with the same rules as your own taps.
3. Each change comes back as a row with **Undo**.
4. Removing something, or settling money owed, waits for you to tap **Confirm**.
5. While it works, the send arrow turns into a **Stop** square. What was already done stays, each with its Undo.

It can also log movement, your eating check-in and the day''s gratitude. It never reads your supplements.

Each typed reply says **Answered by** and the model''s name, so you always know it came from a model and not a built-in line.

Without a plan, you can still type a question about a word, like "what is a layer?", and get a plain answer.

## Privacy and the model

When a model is connected, a model picker shows under the panel''s header. Some models keep nothing you send. Only with one of those can the assistant read your journal and your trackers, and it reads the journal only when you ask about it. The panel tells you under the picker what the chosen model may read.

If you took the Discover quiz, you choose whether the assistant learns from it. Find **Let your results help** on your Discover results.

## Plans and credits, in plain words

Open the **Profile** tab and tap **Plans and credits**.

- **A credit** is a tiny slice of what the model costs to run, worked out from the words it reads and writes.
- **A plan** gives you a set number of credits for 30 days. Pro is ₹1,499 for 10,000 credits, Pro Max is ₹12,499 for 100,000, and Ultra is ₹49,999 for 400,000. Credits left at the end of a plan do not carry over.
- **A top up** adds extra credits on top of a plan. They are used after the plan''s own and stay until you use them.

The page shows your plan, what you used today and every credit in and out. Some free models cost no credits at all, but typing still needs a plan. Payments are not live yet, so picking a plan charges nothing, and the page tells you so.

## Meet the Companion

The Companion is a chat that knows how you are doing. It is not a therapist. It lives in the **Reflection** group and starts hidden, so show it under **Apps**.

1. Open **Companion**.
2. Tap a starter, like "I feel tired today", or type in **Say what is on your mind**.
3. It answers in a few warm, short lines.

With a plan and credits left, a model answers. Without them, the built-in companion answers for free. You never hit a paywall here. Each line says who answered. The Companion only reads: it never adds, ticks or removes anything for you.

Your mood, sleep and wellbeing reach only a model that keeps nothing. To clear the chat, tap the trash button. A sheet asks first, because it cannot be undone.

## If you are ever in danger

The Companion watches for words that sound like danger, before any model sees them. If it hears them, it tells you to talk to a person right now. If you are in immediate danger, call your local emergency number or go to the nearest hospital. In India you can call Tele-MANAS on 14416, at any hour. Tell someone you trust too.

kreators.app cannot help in an emergency. A real person can.

## What grows over time

The more you use the app, the more the assistant has to work with, always as you and never past your own rules. The Companion reads your day and your routine, so its answers fit. And you get time back for the things only you can do.

> **Pro tip:** start with the free flows for a week. When you notice you keep wishing you could just type it, that is the moment a plan is worth it.

> **Result:** you log a whole evening in one panel, undo anything you did not mean, and have a quiet place to talk when the day was heavy.

## The bottom line

The flows are free for everyone. Typing needs a plan, and credits pay for the model. Every change has an Undo, and nothing leaves your own rules. The Companion listens, and never charges you to talk. And in danger, a real person always comes first.' WHERE id = 'prog-onboarding-l14' AND program_id = 'prog-onboarding';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-onboarding-l14', 'prog-onboarding', 'The assistant and the Companion', 'lesson', NULL, 'Some days you want to say "log my sleep and add a task for Friday" and be done. Other days you just want to talk the day through. The assistant does the first. The Companion does the second.

In this lesson you''ll learn:

- What the assistant does for free, and what needs a plan.
- How plans and credits work, in plain words.
- How every change can be undone.
- What the Companion is, and what it is not.
- Where to turn if you are ever in danger.

## Meet the assistant

The round button with Bumling in it, at the bottom right of every screen, is the assistant. On a phone it sits above the tab bar. Tap it, and the **Bumling AI assistant** panel opens. The page under it stays in view, so you can watch things land.

**Close** folds the panel back into the button and keeps your chat.

## The free half: flows

Flows are short taps that cost nothing. Each one says where its answer lands. A few of them:

- **Check in for today** and **Mark the small act done**, which land on Daily.
- **Add a task** and **Add to a pyramid**, which land in Pillars.
- **Mark my not to do list** and **Add to my not to do list**.
- **Log my mood**, **Log my sleep**, **Log my stress** and **Log mindful minutes**.
- **Write in my journal**, which nobody else sees unless you share it.
- **Add money in or out** and **Set a money goal**, when Finance is on.

A flow for an app you have hidden does not show. Flows use the same steps as your own taps, so the same rules apply.

## The paid half: typing

Typing a line, like "move my edit task to Friday", needs a plan.

1. Type what you want in the box at the bottom.
2. Bumling does it in the app, as you, with the same rules as your own taps.
3. Each change comes back as a row with **Undo**.
4. Removing something, or settling money owed, waits for you to tap **Confirm**.
5. While it works, the send arrow turns into a **Stop** square. What was already done stays, each with its Undo.

It can also log movement, your eating check-in and the day''s gratitude. It never reads your supplements.

Each typed reply says **Answered by** and the model''s name, so you always know it came from a model and not a built-in line.

Without a plan, you can still type a question about a word, like "what is a layer?", and get a plain answer.

## Privacy and the model

When a model is connected, a model picker shows under the panel''s header. Some models keep nothing you send. Only with one of those can the assistant read your journal and your trackers, and it reads the journal only when you ask about it. The panel tells you under the picker what the chosen model may read.

If you took the Discover quiz, you choose whether the assistant learns from it. Find **Let your results help** on your Discover results.

## Plans and credits, in plain words

Open the **Profile** tab and tap **Plans and credits**.

- **A credit** is a tiny slice of what the model costs to run, worked out from the words it reads and writes.
- **A plan** gives you a set number of credits for 30 days. Pro is ₹1,499 for 10,000 credits, Pro Max is ₹12,499 for 100,000, and Ultra is ₹49,999 for 400,000. Credits left at the end of a plan do not carry over.
- **A top up** adds extra credits on top of a plan. They are used after the plan''s own and stay until you use them.

The page shows your plan, what you used today and every credit in and out. Some free models cost no credits at all, but typing still needs a plan. Payments are not live yet, so picking a plan charges nothing, and the page tells you so.

## Meet the Companion

The Companion is a chat that knows how you are doing. It is not a therapist. It lives in the **Reflection** group and starts hidden, so show it under **Apps**.

1. Open **Companion**.
2. Tap a starter, like "I feel tired today", or type in **Say what is on your mind**.
3. It answers in a few warm, short lines.

With a plan and credits left, a model answers. Without them, the built-in companion answers for free. You never hit a paywall here. Each line says who answered. The Companion only reads: it never adds, ticks or removes anything for you.

Your mood, sleep and wellbeing reach only a model that keeps nothing. To clear the chat, tap the trash button. A sheet asks first, because it cannot be undone.

## If you are ever in danger

The Companion watches for words that sound like danger, before any model sees them. If it hears them, it tells you to talk to a person right now. If you are in immediate danger, call your local emergency number or go to the nearest hospital. In India you can call Tele-MANAS on 14416, at any hour. Tell someone you trust too.

kreators.app cannot help in an emergency. A real person can.

## What grows over time

The more you use the app, the more the assistant has to work with, always as you and never past your own rules. The Companion reads your day and your routine, so its answers fit. And you get time back for the things only you can do.

> **Pro tip:** start with the free flows for a week. When you notice you keep wishing you could just type it, that is the moment a plan is worth it.

> **Result:** you log a whole evening in one panel, undo anything you did not mean, and have a quiet place to talk when the day was heavy.

## The bottom line

The flows are free for everyone. Typing needs a plan, and credits pay for the model. Every change has an Undo, and nothing leaves your own rules. The Companion listens, and never charges you to talk. And in danger, a real person always comes first.', 17, 1);
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

**All tables** shows your own lists, from tasks and moods to money and badges, as tables. A super admin on the team can open your tables to help you or to look into a problem. They can read them, never change them, and never open your journal, gratitude or body and mind tables. Each table they open or download is written in a log, and your export lists when. Your money in Finance is one of the tables they can read.

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

Open **All tables** to see your tasks, trackers, money and more as tables. Sort it, filter it, search it, then copy the rows you tick or download them as a CSV file.

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

**All tables** shows your own lists, from tasks and moods to money and badges, as tables. A super admin on the team can open your tables to help you or to look into a problem. They can read them, never change them, and never open your journal, gratitude or body and mind tables. Each table they open or download is written in a log, and your export lists when. Your money in Finance is one of the tables they can read.

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

Open **All tables** to see your tasks, trackers, money and more as tables. Sort it, filter it, search it, then copy the rows you tick or download them as a CSV file.

On the Profile tab, the **Your data** card has three buttons.

1. **Export my data:** everything we hold about you, as one file you can keep.
2. **Erase everything:** your pillars, xp, streak and badges go, and you start over. A sheet asks first, with a red **Yes, erase everything** and **Keep my progress**. After it, the setup chat opens again. Your journal, gratitude, trackers and Fitness logs stay.
3. **Delete my account:** a sheet lists what happens. You type DELETE, then tap **Delete my account**. Your name, page, pillars, logs, journal and messages are gone. Your events, runs and sessions still to come are cancelled, and whoever was coming is told. What you never sold goes, and what you sold is archived for the people who bought it. Money records and what others rely on stay, without your name. A note already in someone else''s inbox keeps the words it was written with.

> **Result:** you know what is yours alone, which switch shares each part, and how to leave with your data.

## The bottom line

Your inner life stays yours: journal, wellbeing, Discover and your tags. Everything you share has a switch you own. And you can take your data with you, or wipe it, at any time.', 18, 1);
