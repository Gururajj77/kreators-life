-- 0151: Onboarding lessons brought up to their files (2026-11-14, the founder): 05 says Your routine on Daily starts folded, with today's
-- count of morning steps beside it ("put routine tasks in a toggle on daily and keep it in non open state"); 15 and 20 name Show to my
-- coach, the switch at the top of each table ("in each table give toggle to show it to coach or not"); 14, 15 and 19 name Show to AI chat
-- and Profile's AI chat ("give one toggle for ai chat access just next to coach button too and even in profile section"), supplements and
-- protein included. Every lesson keeps its place.
-- Made with: node scripts/onboarding-guide/build.mjs --sync <this file> --only 05,14,15,19,20. Safe to run again.
UPDATE learning_items SET module_title = 'Daily, part two: habits, reminders and your routine', body = 'A good day is what you do again and again, and what you stay away from. This lesson covers the parts of Daily that work across many days: repeats and habits, the not to do list, Remember, water and reminders, and your routine.

In this lesson you''ll learn:

- How to make a task repeat, and when it counts as a habit.
- How the not to do list and its streaks work.
- How Remember and your own reminders reach you, and how your Inbox works.
- How your morning routine fits under Show up.

## Making a task repeat

Tap a task to open its plan. Under **Repeat**, pick Every day, Weekdays, Every week, Every month or Every year, or every two weeks, say. For a weekly task, pick the days. **Stop after** is an optional last day.

A repeat needs a do date or a due date to count from. When you tick the task, the next one appears by itself, with the same words, time and length. If you untick it, the new one goes away again.

A monthly task that starts on the 31st lands on the last day of a short month, then goes back to the 31st.

## Habits

While a repeat is set, the plan shows **Count it as a habit**. It is on to start, and the task wears the **Habit** tag. Turn it off if the task only comes back and is not really a habit, like paying a bill.

Further down Daily sits a section called **Habits**. Here the app sets a task you keep doing beside how those days went. It needs a few weeks of ticks, and enough days with the task and without it.

- If those days went clearly better, the task shows as a **Good habit**. You might see **Make it a habit**, which sets up a repeat.
- If they went clearly worse, it shows as a **Bad habit**. It can offer **Add to not to do**.
- If it is too soon to tell, it waits and keeps watching.

"Better" is read from your mood, sleep and stress, and from your other tasks and focus time, only from the apps you have on. The line always says things went together. It never says one caused the other.

> **Pro tip:** log your mood or sleep for a few weeks, even roughly. The more days you log, the sooner Habits can tell a good habit from a bad one.

## Not to do

The **Not to do** list holds the things you are staying away from, like "No phone in bed". You can keep up to seven.

1. Tap **Add one**, type it, and pick a pillar or leave it on Any pillar. Tap **Add**.
2. Each day, tick each one you kept. A kept day pays 5 xp and grows its streak.
3. The three-dot button opens the row in place. It shows your best run, **I slipped today** and **Remove from the list**.

A slip or a missed day starts the streak over. Forgot to mark yesterday? A quiet line under the list, **Yesterday: 2 not marked**, opens those items in place, each with **Kept** and **Slipped**. It works for yesterday only, never earlier. Removing an item asks first. The xp you earned stays. The same list shows on the Pillars tab, under your seven pillars.

## Remember

In a task''s plan, **Remember** is a tag for things you want to keep in mind.

- **With a day:** one note lands in your inbox on that day, at the task''s time, or at 9:00 when it has none.
- **With no day:** the task waits in **To remember** on Daily, always in sight. Pick a day to move it into Tasks, with its inbox note.

## Your Inbox

Every note the app sends you lands in one place. Tap the bell at the top of the app to open it. It shows your unread count. On a phone it sits at the top right, beside the theme button. On a tablet or a laptop it sits at the top of the sidebar.

- **The tabs:** **Everything** holds it all. Each note also sits in one tab of its own: **Replies and mentions**, **Following**, **Reminders**, **Events**, **Friends**, **Work**, **Shop and money** or **School and coaching**. **Agency** shows while you use it.
- **Tap a note:** it opens the page and the section it is about.
- **Mark all read:** it marks every note in the tab you are on.
- **Archive read items:** it puts away what you have read. After you archive one note, **Undo** stays for a few seconds.
- **The date and time:** they sit at the bottom right of each card.

## Water and your reminders

On a phone or a tablet, Daily has a **Water and reminders** section. Tap **+ Glass** each time you drink. On a laptop, the same panel opens from a small bubble at the left of the screen.

Open it and you get one card with three round buttons: Water, Reminders and Settings.

- **Water:** a glass fills toward your daily goal. Pick an amount and add it, or undo the last one. Below it, the last seven days show which days met the goal.
- **Settings:** your daily goal and the size of your glass.
- **Reminders:** your own reminders, like "Stretch for five minutes". Each has a time and the days it repeats. You can keep up to twelve.

Water pays no xp. It is there to help you keep one simple goal. The app does not remind you to drink. If you want a nudge, add your own reminder.

## Your routine under Show up

If you did the strategy session, **Your routine** sits right under Show up. It starts folded, with today''s count of morning steps beside it. Tap it to open it.

- The dots show this week, and the line says how many days you kept against your deal.
- Pick **Normal day** or **Exceptional day**, for days that do not follow the usual shape.
- Tick each morning step as you do it. Each one shows its minutes. The day counts only when every morning step is ticked.
- The rest of the day is shown as a timeline of blocks, like work, people and lights out.

If you have not done the session yet, this spot offers **Run the strategy session** instead.

## Why it works this way

Willpower comes and goes. Repeats, reminders and streaks carry you on the days it is low. What you stay away from matters as much as what you do.

## What emerges and what develops

Over weeks, streaks build, and Habits starts to show which tasks lift your days. Wake-up moves a little earlier each week you keep the deal. What develops is a calmer default: you keep promises to yourself without having to think about it.

> **Result:** your good tasks repeat by themselves, the things you avoid have streaks, and reminders reach you at the right time.

## The bottom line

Make the tasks that matter repeat, keep a short not to do list, and let Remember and your reminders do the remembering. Then tick your morning routine and let the streaks grow.' WHERE id = 'prog-onboarding-l05' AND program_id = 'prog-onboarding';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-onboarding-l05', 'prog-onboarding', 'Daily, part two: habits, reminders and your routine', 'lesson', NULL, 'A good day is what you do again and again, and what you stay away from. This lesson covers the parts of Daily that work across many days: repeats and habits, the not to do list, Remember, water and reminders, and your routine.

In this lesson you''ll learn:

- How to make a task repeat, and when it counts as a habit.
- How the not to do list and its streaks work.
- How Remember and your own reminders reach you, and how your Inbox works.
- How your morning routine fits under Show up.

## Making a task repeat

Tap a task to open its plan. Under **Repeat**, pick Every day, Weekdays, Every week, Every month or Every year, or every two weeks, say. For a weekly task, pick the days. **Stop after** is an optional last day.

A repeat needs a do date or a due date to count from. When you tick the task, the next one appears by itself, with the same words, time and length. If you untick it, the new one goes away again.

A monthly task that starts on the 31st lands on the last day of a short month, then goes back to the 31st.

## Habits

While a repeat is set, the plan shows **Count it as a habit**. It is on to start, and the task wears the **Habit** tag. Turn it off if the task only comes back and is not really a habit, like paying a bill.

Further down Daily sits a section called **Habits**. Here the app sets a task you keep doing beside how those days went. It needs a few weeks of ticks, and enough days with the task and without it.

- If those days went clearly better, the task shows as a **Good habit**. You might see **Make it a habit**, which sets up a repeat.
- If they went clearly worse, it shows as a **Bad habit**. It can offer **Add to not to do**.
- If it is too soon to tell, it waits and keeps watching.

"Better" is read from your mood, sleep and stress, and from your other tasks and focus time, only from the apps you have on. The line always says things went together. It never says one caused the other.

> **Pro tip:** log your mood or sleep for a few weeks, even roughly. The more days you log, the sooner Habits can tell a good habit from a bad one.

## Not to do

The **Not to do** list holds the things you are staying away from, like "No phone in bed". You can keep up to seven.

1. Tap **Add one**, type it, and pick a pillar or leave it on Any pillar. Tap **Add**.
2. Each day, tick each one you kept. A kept day pays 5 xp and grows its streak.
3. The three-dot button opens the row in place. It shows your best run, **I slipped today** and **Remove from the list**.

A slip or a missed day starts the streak over. Forgot to mark yesterday? A quiet line under the list, **Yesterday: 2 not marked**, opens those items in place, each with **Kept** and **Slipped**. It works for yesterday only, never earlier. Removing an item asks first. The xp you earned stays. The same list shows on the Pillars tab, under your seven pillars.

## Remember

In a task''s plan, **Remember** is a tag for things you want to keep in mind.

- **With a day:** one note lands in your inbox on that day, at the task''s time, or at 9:00 when it has none.
- **With no day:** the task waits in **To remember** on Daily, always in sight. Pick a day to move it into Tasks, with its inbox note.

## Your Inbox

Every note the app sends you lands in one place. Tap the bell at the top of the app to open it. It shows your unread count. On a phone it sits at the top right, beside the theme button. On a tablet or a laptop it sits at the top of the sidebar.

- **The tabs:** **Everything** holds it all. Each note also sits in one tab of its own: **Replies and mentions**, **Following**, **Reminders**, **Events**, **Friends**, **Work**, **Shop and money** or **School and coaching**. **Agency** shows while you use it.
- **Tap a note:** it opens the page and the section it is about.
- **Mark all read:** it marks every note in the tab you are on.
- **Archive read items:** it puts away what you have read. After you archive one note, **Undo** stays for a few seconds.
- **The date and time:** they sit at the bottom right of each card.

## Water and your reminders

On a phone or a tablet, Daily has a **Water and reminders** section. Tap **+ Glass** each time you drink. On a laptop, the same panel opens from a small bubble at the left of the screen.

Open it and you get one card with three round buttons: Water, Reminders and Settings.

- **Water:** a glass fills toward your daily goal. Pick an amount and add it, or undo the last one. Below it, the last seven days show which days met the goal.
- **Settings:** your daily goal and the size of your glass.
- **Reminders:** your own reminders, like "Stretch for five minutes". Each has a time and the days it repeats. You can keep up to twelve.

Water pays no xp. It is there to help you keep one simple goal. The app does not remind you to drink. If you want a nudge, add your own reminder.

## Your routine under Show up

If you did the strategy session, **Your routine** sits right under Show up. It starts folded, with today''s count of morning steps beside it. Tap it to open it.

- The dots show this week, and the line says how many days you kept against your deal.
- Pick **Normal day** or **Exceptional day**, for days that do not follow the usual shape.
- Tick each morning step as you do it. Each one shows its minutes. The day counts only when every morning step is ticked.
- The rest of the day is shown as a timeline of blocks, like work, people and lights out.

If you have not done the session yet, this spot offers **Run the strategy session** instead.

## Why it works this way

Willpower comes and goes. Repeats, reminders and streaks carry you on the days it is low. What you stay away from matters as much as what you do.

## What emerges and what develops

Over weeks, streaks build, and Habits starts to show which tasks lift your days. Wake-up moves a little earlier each week you keep the deal. What develops is a calmer default: you keep promises to yourself without having to think about it.

> **Result:** your good tasks repeat by themselves, the things you avoid have streaks, and reminders reach you at the right time.

## The bottom line

Make the tasks that matter repeat, keep a short not to do list, and let Remember and your reminders do the remembering. Then tick your morning routine and let the streaks grow.', 5, 1);
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
- **Who sees it:** only you. Not Emerging or Reviews, and not a coach, even with Reflection shared, unless you switch the Eating table on for them. The assistant and the Companion see it only if you switch on **Show to AI chat** for that table, and then only on a model that keeps nothing.

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
- **AI chat**, the assistant and the Companion, reads a whole table only if you switch on **Show to AI chat** for it, and the body and mind tables only on a model that keeps nothing.
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
- **Who sees it:** only you. Not Emerging or Reviews, and not a coach, even with Reflection shared, unless you switch the Eating table on for them. The assistant and the Companion see it only if you switch on **Show to AI chat** for that table, and then only on a model that keeps nothing.

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
- **AI chat**, the assistant and the Companion, reads a whole table only if you switch on **Show to AI chat** for it, and the body and mind tables only on a model that keeps nothing.
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

You can also share whole tables from **All tables** with one coach, one table at a time: your tasks, your money, your journal or any other. Open **Tables your coach can see** under **Your life coach** on the Profile tab and switch on the ones you want. Or open the table itself and switch on **Show to my coach** at the top. Each one starts off. **Share all** and **Share none** change them all at once. A coach can read a table, but never change it, and the change log names the tables you switched, never what is in them.

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

You can also share whole tables from **All tables** with one coach, one table at a time: your tasks, your money, your journal or any other. Open **Tables your coach can see** under **Your life coach** on the Profile tab and switch on the ones you want. Or open the table itself and switch on **Show to my coach** at the top. Each one starts off. **Share all** and **Share none** change them all at once. A coach can read a table, but never change it, and the change log names the tables you switched, never what is in them.

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

It can also log movement, your eating check-in and the day''s gratitude. It reads your supplements only if you switch their table on with **Show to AI chat**, and then only on a model that keeps nothing.

Each typed reply says **Answered by** and the model''s name, so you always know it came from a model and not a built-in line.

Without a plan, you can still type a question about a word, like "what is a layer?", and get a plain answer.

## Privacy and the model

When a model is connected, a model picker shows under the panel''s header. Some models keep nothing you send. Only with one of those can the assistant read your journal and your trackers, and it reads the journal only when you ask about it. The panel tells you under the picker what the chosen model may read.

It can also read a whole table from **All tables**, but only one you open to it. Switch on **Show to AI chat** at the top of the table, or under **AI chat** on the Profile tab. Each one starts off, and the assistant and the Companion can read it but never change it.

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

It can also log movement, your eating check-in and the day''s gratitude. It reads your supplements only if you switch their table on with **Show to AI chat**, and then only on a model that keeps nothing.

Each typed reply says **Answered by** and the model''s name, so you always know it came from a model and not a built-in line.

Without a plan, you can still type a question about a word, like "what is a layer?", and get a plain answer.

## Privacy and the model

When a model is connected, a model picker shows under the panel''s header. Some models keep nothing you send. Only with one of those can the assistant read your journal and your trackers, and it reads the journal only when you ask about it. The panel tells you under the picker what the chosen model may read.

It can also read a whole table from **All tables**, but only one you open to it. Switch on **Show to AI chat** at the top of the table, or under **AI chat** on the Profile tab. Each one starts off, and the assistant and the Companion can read it but never change it.

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
- **Your supplements:** if you keep the list in Fitness, only you see it. A coach sees it only if you switch its table on for them, and the assistant only if you switch it on with **Show to AI chat**, on a model that keeps nothing.
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

You can also share whole tables with one coach, one at a time, under **Tables your coach can see** on the Profile tab, or with **Show to my coach** at the top of each table. Each starts off, and a coach can read a table but never change it. Turn any part or table off, or end the link, at any time.

### Your tables and the team

**All tables** shows your own lists, from tasks and moods to money and badges, as tables. A super admin on the team can open your tables to help you or to look into a problem. They can read them, never change them, and never open your journal, gratitude or body and mind tables. Each table they open or download is written in a log, and your export lists when. Your money in Finance is one of the tables they can read.

### The assistant

The assistant reads your journal only when you ask it about your journal. Even then, only a model that keeps nothing may read it, and the picker marks those models "keeps nothing". Discover reaches it only as a short summary, and only if you switch on **Let the assistant learn from them**.

A whole table from **All tables** reaches the assistant and the Companion only if you switch on **Show to AI chat** for it, at the top of the table or under **AI chat** on the Profile tab. Each one starts off. They can read it, but never change it. The journal, gratitude and the body and mind tables still go only to a model that keeps nothing.

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
- **Your supplements:** if you keep the list in Fitness, only you see it. A coach sees it only if you switch its table on for them, and the assistant only if you switch it on with **Show to AI chat**, on a model that keeps nothing.
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

You can also share whole tables with one coach, one at a time, under **Tables your coach can see** on the Profile tab, or with **Show to my coach** at the top of each table. Each starts off, and a coach can read a table but never change it. Turn any part or table off, or end the link, at any time.

### Your tables and the team

**All tables** shows your own lists, from tasks and moods to money and badges, as tables. A super admin on the team can open your tables to help you or to look into a problem. They can read them, never change them, and never open your journal, gratitude or body and mind tables. Each table they open or download is written in a log, and your export lists when. Your money in Finance is one of the tables they can read.

### The assistant

The assistant reads your journal only when you ask it about your journal. Even then, only a model that keeps nothing may read it, and the picker marks those models "keeps nothing". Discover reaches it only as a short summary, and only if you switch on **Let the assistant learn from them**.

A whole table from **All tables** reaches the assistant and the Companion only if you switch on **Show to AI chat** for it, at the top of the table or under **AI chat** on the Profile tab. Each one starts off. They can read it, but never change it. The journal, gratitude and the body and mind tables still go only to a model that keeps nothing.

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
