-- 0170: Onboarding lessons 01, 07, 08, 15 and 19 brought up to their files (2026-11-14): All tables lets a person change and remove their own
-- rows (Edit one row at a time, the remove in the app's own word, a second tap or a sheet as the app asks, Select all a hundred at a time with
-- Do the next 100, records greyed with the reason, a done task's xp kept, older days of water, gratitude, supplement ticks and routine days),
-- and only they can; a mindful session's minutes change there; Back to top sits left of the assistant's button on a long page, and the top
-- right holds the bell, the theme and the apps menu. Every lesson keeps its place.
-- Made with: node scripts/onboarding-guide/build.mjs --sync <this file> --only 01,07,08,15,19. Safe to run again.
UPDATE learning_items SET module_title = 'Welcome and your first steps', body = 'Most apps hand you a long list of buttons on day one. kreators.app starts with a short chat instead. You tell it who you are and what you want, and it shows the apps that fit. Everything else waits until you need it.

In this lesson you''ll learn:

- How to get from Welcome to Home.
- What the setup chat asks, and why.
- Which apps you get, and how to change them later.
- How to find your way around the tabs.

## Step one: Welcome

When you open the app for the first time, you land on Welcome. It says "Seven relationships. One you." There is one big button.

While joining is by invite, Welcome first asks for an invite code. If you came from an invite link, your code is already in, and Welcome goes on as below. If not, type the code you were given. No code yet? **Join the waitlist** takes your name and email, and the team emails you a code when there is a place. Each code makes one account, once.

1. Tap **Start with a short chat**.
2. The app opens a session on your device, so nothing you say gets lost.
3. The setup chat opens. Your guide is Bumling, a friendly grey robot with a gold antenna. Bumling is the app''s own guide, not one of the seven.

If you stop halfway, no problem. Next time the button says **Carry on setting up**, and you pick up where you left off.

## Step two: your account

Bumling asks for your account first, in two small cards.

- **The first card:** your name, your email, and a password typed twice. Then tap **Next**.
- **The second card:** your phone number and your date of birth. You must be 18 or older to join. Nobody else ever sees these two details.
- **The terms box:** it starts unticked. You tick it yourself, then tap **Make my account**.

## Step three: a few questions

Now Bumling asks a few quick questions. Each one comes as small groups of chips. Tap what fits, then tap **Next**.

1. **What you want:** pick up to three goals, like "Learn a new skill", "Meet new people" or "Feel better day to day".
2. **Who you are:** chips like "I''m a student", "I make content" or "I look after family". Pick as many as fit, or tap **None of these**.
3. **What you make:** this one only shows if you make things, for yourself or for clients.
4. **What gets in your way:** chips like "Not enough time" or "Hard to focus (ADHD counts)". You can tap **Nothing, skip**.

After each answer, Bumling says it back in plain words. That way you know it heard you right.

Under every question you will see two small links:

- **Tell me more** explains why the question is there.
- **Change my last answer** takes you one step back.

The typing box at the bottom works at any time. Type "what is School?" and you get a plain answer. Then your choices come back, just as you left them.

> **Pro tip:** be honest about what gets in your way. If time is short or focus is hard, Bumling shows fewer apps. A short list you use beats a long list you ignore.

## Step four: your apps

Bumling now shows a short list of apps, at most five. Each one has a single line about what it does. Tap **Why these apps?** to see the reason for each one.

- Untick any app you do not want.
- Tap the button, like **Show 3 apps**.

The apps that fit are shown. Most of the others are hidden. Nothing is lost: you can show any app later.

The last card offers a few next steps. You may see **Go to Home**, an app to open, **Start the strategy session**, **Take the Discover quiz** and **Add my interests**. Pick whichever feels right today.

## Finding your way around

On a phone, the tab bar sits at the bottom with five tabs:

- **Home:** your day at a glance, and the daily brief.
- **Daily:** what to do today, and where you tick it off.
- **Pillars:** your seven relationships, each built as a pyramid.
- **Apps:** every app you have, in groups.
- **Profile:** your tags, your account, your badges and your data.

At the top left sits the kreators.app logo, which takes you Home. At the top right are three buttons: the bell for your Inbox, the theme switch, for light or dark, and the apps menu. On a laptop, the tabs and your apps live in a sidebar on the left. You can fold it into a thin row of icons.

The round button with Bumling at the bottom right is the assistant. A later lesson covers it. On a long page, once you scroll down, a smaller round button with an up arrow shows just left of it. Tap it to go back to the top. Its thin ring fills as you scroll.

## Getting started

For your first two weeks, Home shows a short list called **Getting started**. It has seven small steps, like "Check in on Daily", "Tick your first task" and "Choose your username". Each one ticks itself when you do the real thing. It pays nothing. It only points the way. You can fold it away whenever you like.

## Why it works this way

The app is big. It has apps for learning, earning, money, friends, calm and more. If all of them showed at once, you would not know where to start. The chat keeps your first week small, so you can build a habit before you add more.

## What develops over time

Your first answers are not set in stone. As you change, your apps can change too.

- On the **Profile** tab, **Match my apps again** runs the same chat again, with your last answers filled in.
- Under **Profile**, then **Features**, every app can be hidden or unhidden. Apps that suit your answers say "Fits you".
- On the **Apps** tab, open a group to see its apps, hide one, or show one again under **Hidden apps**.

Your tags mark the apps that fit you. Tap a tile under **Who you are** to change one. They never show on your public page.

> **Result:** you have an account, a few apps that fit you, and a clear way around. Home is open.

## The bottom line

Start with the chat, keep your first apps few, and let Getting started point the way. You can change your tags and apps any time from Profile.' WHERE id = 'prog-onboarding-l01' AND program_id = 'prog-onboarding';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-onboarding-l01', 'prog-onboarding', 'Welcome and your first steps', 'lesson', NULL, 'Most apps hand you a long list of buttons on day one. kreators.app starts with a short chat instead. You tell it who you are and what you want, and it shows the apps that fit. Everything else waits until you need it.

In this lesson you''ll learn:

- How to get from Welcome to Home.
- What the setup chat asks, and why.
- Which apps you get, and how to change them later.
- How to find your way around the tabs.

## Step one: Welcome

When you open the app for the first time, you land on Welcome. It says "Seven relationships. One you." There is one big button.

While joining is by invite, Welcome first asks for an invite code. If you came from an invite link, your code is already in, and Welcome goes on as below. If not, type the code you were given. No code yet? **Join the waitlist** takes your name and email, and the team emails you a code when there is a place. Each code makes one account, once.

1. Tap **Start with a short chat**.
2. The app opens a session on your device, so nothing you say gets lost.
3. The setup chat opens. Your guide is Bumling, a friendly grey robot with a gold antenna. Bumling is the app''s own guide, not one of the seven.

If you stop halfway, no problem. Next time the button says **Carry on setting up**, and you pick up where you left off.

## Step two: your account

Bumling asks for your account first, in two small cards.

- **The first card:** your name, your email, and a password typed twice. Then tap **Next**.
- **The second card:** your phone number and your date of birth. You must be 18 or older to join. Nobody else ever sees these two details.
- **The terms box:** it starts unticked. You tick it yourself, then tap **Make my account**.

## Step three: a few questions

Now Bumling asks a few quick questions. Each one comes as small groups of chips. Tap what fits, then tap **Next**.

1. **What you want:** pick up to three goals, like "Learn a new skill", "Meet new people" or "Feel better day to day".
2. **Who you are:** chips like "I''m a student", "I make content" or "I look after family". Pick as many as fit, or tap **None of these**.
3. **What you make:** this one only shows if you make things, for yourself or for clients.
4. **What gets in your way:** chips like "Not enough time" or "Hard to focus (ADHD counts)". You can tap **Nothing, skip**.

After each answer, Bumling says it back in plain words. That way you know it heard you right.

Under every question you will see two small links:

- **Tell me more** explains why the question is there.
- **Change my last answer** takes you one step back.

The typing box at the bottom works at any time. Type "what is School?" and you get a plain answer. Then your choices come back, just as you left them.

> **Pro tip:** be honest about what gets in your way. If time is short or focus is hard, Bumling shows fewer apps. A short list you use beats a long list you ignore.

## Step four: your apps

Bumling now shows a short list of apps, at most five. Each one has a single line about what it does. Tap **Why these apps?** to see the reason for each one.

- Untick any app you do not want.
- Tap the button, like **Show 3 apps**.

The apps that fit are shown. Most of the others are hidden. Nothing is lost: you can show any app later.

The last card offers a few next steps. You may see **Go to Home**, an app to open, **Start the strategy session**, **Take the Discover quiz** and **Add my interests**. Pick whichever feels right today.

## Finding your way around

On a phone, the tab bar sits at the bottom with five tabs:

- **Home:** your day at a glance, and the daily brief.
- **Daily:** what to do today, and where you tick it off.
- **Pillars:** your seven relationships, each built as a pyramid.
- **Apps:** every app you have, in groups.
- **Profile:** your tags, your account, your badges and your data.

At the top left sits the kreators.app logo, which takes you Home. At the top right are three buttons: the bell for your Inbox, the theme switch, for light or dark, and the apps menu. On a laptop, the tabs and your apps live in a sidebar on the left. You can fold it into a thin row of icons.

The round button with Bumling at the bottom right is the assistant. A later lesson covers it. On a long page, once you scroll down, a smaller round button with an up arrow shows just left of it. Tap it to go back to the top. Its thin ring fills as you scroll.

## Getting started

For your first two weeks, Home shows a short list called **Getting started**. It has seven small steps, like "Check in on Daily", "Tick your first task" and "Choose your username". Each one ticks itself when you do the real thing. It pays nothing. It only points the way. You can fold it away whenever you like.

## Why it works this way

The app is big. It has apps for learning, earning, money, friends, calm and more. If all of them showed at once, you would not know where to start. The chat keeps your first week small, so you can build a habit before you add more.

## What develops over time

Your first answers are not set in stone. As you change, your apps can change too.

- On the **Profile** tab, **Match my apps again** runs the same chat again, with your last answers filled in.
- Under **Profile**, then **Features**, every app can be hidden or unhidden. Apps that suit your answers say "Fits you".
- On the **Apps** tab, open a group to see its apps, hide one, or show one again under **Hidden apps**.

Your tags mark the apps that fit you. Tap a tile under **Who you are** to change one. They never show on your public page.

> **Result:** you have an account, a few apps that fit you, and a clear way around. Home is open.

## The bottom line

Start with the chat, keep your first apps few, and let Getting started point the way. You can change your tags and apps any time from Profile.', 1, 1);
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
- **Today or yesterday here.** On Journal, older days are read only. In **All tables**, you can change or clear an older day.
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
- **Today or yesterday here.** On Journal, older days are read only. In **All tables**, you can change or clear an older day.
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
- **Tick what you took,** for today or yesterday. **Mark all taken** ticks a whole part of the day. You can Pause one, or Change it. In **All tables**, you can untick an older day.
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
- **Tick what you took,** for today or yesterday. **Mark all taken** ticks a whole part of the day. You can Pause one, or Change it. In **All tables**, you can untick an older day.
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
UPDATE learning_items SET module_title = 'Mindfulness: breathe, then focus', body = 'You sit down to work and your mind is already in five places. An hour goes by and the big task has not moved. Mindfulness gives you two simple tools for that moment: a breath to settle, and a clock to work against.

In this lesson you''ll learn:

- How the four tabs of Breathe and focus work.
- How a focus session is counted, kept or thrown away.
- How the clock follows you around the app.
- What your focus numbers show over time.

## Why it is there

Busy days are not the problem. Scattered days are. A few slow breaths calm your body before you start. A clock with a clear end makes one task feel small enough to begin. Together they turn "I should work on that" into "I am working on that, for 25 minutes".

## Find it

Mindfulness starts hidden on a new account, unless the setup chat showed it for you. Open **Apps**, open the **Reflection** group, open **Hidden apps** at its end and tap the eye beside **Mindfulness**. The same panel, **Breathe and focus**, also shows on Home while Mindfulness is not hidden, so you can start a clock from either place.

The page opens with your mindful minutes this week. Under it sits the panel, a dark card with four tabs: **Breathe**, **Timer**, **Pomodoro** and **Stopwatch**. Pick one, then tap the orange **Start**. While it runs, the button reads **Pause**, then **Resume**.

## Breathe

You breathe with a row of circles, one for each step of the breath. The current circle fills up as you count. Pick a **Pattern**:

- **Calm exhale** is first: in for 4, hold for 4, out for 6, rest for 2.
- **Box**, **4-7-8**, **Even**, **Triangle**, **Longer out**, **Pranayam** and **Sigh** are the others.

Pick a cue for each step: **Soft chime**, **Bell**, **Voice** or **No cue**. Choose a length with the quick buttons (1, 3, 5 or 10 minutes) or the ruler, up to 30. If the counts feel fast, tap the small "per count" button and slow each count down, up to five seconds. A finished breath always adds to your mindful minutes.

## Timer, Pomodoro and Stopwatch

- **Timer:** one countdown, no breaks. Good for a single block of work.
- **Pomodoro:** focus parts with breaks between them. Set the focus length on the ruler, from 5 to 120 minutes. Four small pickers set the **Short break**, the **Long break**, the **Sessions between long breaks** and the **Total sessions**. The card shows "Session 2 of 4" and a dot for each one. **Skip** jumps to the next part.
- **Stopwatch:** counts up from zero, for work with no set end. **Stop** keeps the whole minutes. **Reset** keeps nothing.

While a Timer or Pomodoro part runs, the **This part** buttons add or take off one or five minutes.

## Stop, keep or throw away

Life interrupts. If you tap stop on a focus part after a minute or more, the clock pauses and asks **Stop here?** You pick **Keep** with the minutes, or **Throw it away**. Close the box to carry on. A skipped part counts for nothing.

When a focus session ends, a small row asks **How focused were you?**, from Scattered to Deep. It is private, pays nothing and never changes what was kept. Tap **Skip** if you would rather not say.

## The round buttons

Five round buttons sit beside the panel''s heading:

- **Focus on a task:** pick one of your open tasks, from recent ones or a search. Its name shows on the clock and in your browser tab.
- **Timer settings:** a ready plan, **Classic 25/5**, **Deep 50/10** or **Light 15/3**, and your switches.
- **Sounds:** one switch for every chime, beat and buzz.
- **Background music:** rain, ocean, wind, a soft hum or lo-fi, with a volume.
- **Full screen:** the panel covers the page, and everything else steps aside.

In **Timer settings**, finished focus sessions count as mindful minutes to start with. Breaks do not, unless you switch that on. You can also set **A daily focus goal** and **Remind me to focus**, which sends one note to your Inbox on the days you pick. Your choices are saved to your account, so they follow you to every device.

> **Pro tip:** plan a task''s length on Daily, then tap **Start focus** there. Mindfulness opens with the task picked and the first part set to that length.

## The clock follows you

You can leave the page while a clock runs. It keeps going. A small pill shows the time left in the top corner of the screen. Its colour tells you where you are: blue with more than half left, green past halfway, orange in the last five minutes and red in the last minute. A break is violet. Tap the pill to go back to the clock.

A second tab shows the clock as "Running in another tab", so a session is never counted twice.

## Today and your numbers

Under the panel, **Today** lists your sessions, newest first. Tap one to change its length or task, or to delete it. **Continue** starts the same clock again. **Add a session I forgot** adds one for today or yesterday.

Further down, **How productive you were** shows your focus time by day, week or month, in minutes or hours, beside the tasks you ticked. **Sessions** lists your mindful minutes. Deleting one asks first. To change one''s minutes, open its table in **All tables**.

## What emerges over time

After a few weeks you can see your real working hours, not the ones you hoped for. You see which days you focus and which you drift. Emerging may notice that on days with a focus session you tick more tasks.

## What develops

The first sessions feel long. Then 25 minutes becomes normal, and 50 feels possible. You learn to start before you feel ready. Your mindful minutes also feed the physical and spiritual areas of Life.

> **Result:** one breath to settle, one clock to work against, a task named on it, and a record of real focus that follows you to every device.

## The bottom line

Breathe first, then pick a task and start a clock. Keep what you did, throw away what you did not, and let the numbers show you how your focus grows.' WHERE id = 'prog-onboarding-l08' AND program_id = 'prog-onboarding';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-onboarding-l08', 'prog-onboarding', 'Mindfulness: breathe, then focus', 'lesson', NULL, 'You sit down to work and your mind is already in five places. An hour goes by and the big task has not moved. Mindfulness gives you two simple tools for that moment: a breath to settle, and a clock to work against.

In this lesson you''ll learn:

- How the four tabs of Breathe and focus work.
- How a focus session is counted, kept or thrown away.
- How the clock follows you around the app.
- What your focus numbers show over time.

## Why it is there

Busy days are not the problem. Scattered days are. A few slow breaths calm your body before you start. A clock with a clear end makes one task feel small enough to begin. Together they turn "I should work on that" into "I am working on that, for 25 minutes".

## Find it

Mindfulness starts hidden on a new account, unless the setup chat showed it for you. Open **Apps**, open the **Reflection** group, open **Hidden apps** at its end and tap the eye beside **Mindfulness**. The same panel, **Breathe and focus**, also shows on Home while Mindfulness is not hidden, so you can start a clock from either place.

The page opens with your mindful minutes this week. Under it sits the panel, a dark card with four tabs: **Breathe**, **Timer**, **Pomodoro** and **Stopwatch**. Pick one, then tap the orange **Start**. While it runs, the button reads **Pause**, then **Resume**.

## Breathe

You breathe with a row of circles, one for each step of the breath. The current circle fills up as you count. Pick a **Pattern**:

- **Calm exhale** is first: in for 4, hold for 4, out for 6, rest for 2.
- **Box**, **4-7-8**, **Even**, **Triangle**, **Longer out**, **Pranayam** and **Sigh** are the others.

Pick a cue for each step: **Soft chime**, **Bell**, **Voice** or **No cue**. Choose a length with the quick buttons (1, 3, 5 or 10 minutes) or the ruler, up to 30. If the counts feel fast, tap the small "per count" button and slow each count down, up to five seconds. A finished breath always adds to your mindful minutes.

## Timer, Pomodoro and Stopwatch

- **Timer:** one countdown, no breaks. Good for a single block of work.
- **Pomodoro:** focus parts with breaks between them. Set the focus length on the ruler, from 5 to 120 minutes. Four small pickers set the **Short break**, the **Long break**, the **Sessions between long breaks** and the **Total sessions**. The card shows "Session 2 of 4" and a dot for each one. **Skip** jumps to the next part.
- **Stopwatch:** counts up from zero, for work with no set end. **Stop** keeps the whole minutes. **Reset** keeps nothing.

While a Timer or Pomodoro part runs, the **This part** buttons add or take off one or five minutes.

## Stop, keep or throw away

Life interrupts. If you tap stop on a focus part after a minute or more, the clock pauses and asks **Stop here?** You pick **Keep** with the minutes, or **Throw it away**. Close the box to carry on. A skipped part counts for nothing.

When a focus session ends, a small row asks **How focused were you?**, from Scattered to Deep. It is private, pays nothing and never changes what was kept. Tap **Skip** if you would rather not say.

## The round buttons

Five round buttons sit beside the panel''s heading:

- **Focus on a task:** pick one of your open tasks, from recent ones or a search. Its name shows on the clock and in your browser tab.
- **Timer settings:** a ready plan, **Classic 25/5**, **Deep 50/10** or **Light 15/3**, and your switches.
- **Sounds:** one switch for every chime, beat and buzz.
- **Background music:** rain, ocean, wind, a soft hum or lo-fi, with a volume.
- **Full screen:** the panel covers the page, and everything else steps aside.

In **Timer settings**, finished focus sessions count as mindful minutes to start with. Breaks do not, unless you switch that on. You can also set **A daily focus goal** and **Remind me to focus**, which sends one note to your Inbox on the days you pick. Your choices are saved to your account, so they follow you to every device.

> **Pro tip:** plan a task''s length on Daily, then tap **Start focus** there. Mindfulness opens with the task picked and the first part set to that length.

## The clock follows you

You can leave the page while a clock runs. It keeps going. A small pill shows the time left in the top corner of the screen. Its colour tells you where you are: blue with more than half left, green past halfway, orange in the last five minutes and red in the last minute. A break is violet. Tap the pill to go back to the clock.

A second tab shows the clock as "Running in another tab", so a session is never counted twice.

## Today and your numbers

Under the panel, **Today** lists your sessions, newest first. Tap one to change its length or task, or to delete it. **Continue** starts the same clock again. **Add a session I forgot** adds one for today or yesterday.

Further down, **How productive you were** shows your focus time by day, week or month, in minutes or hours, beside the tasks you ticked. **Sessions** lists your mindful minutes. Deleting one asks first. To change one''s minutes, open its table in **All tables**.

## What emerges over time

After a few weeks you can see your real working hours, not the ones you hoped for. You see which days you focus and which you drift. Emerging may notice that on days with a focus session you tick more tasks.

## What develops

The first sessions feel long. Then 25 minutes becomes normal, and 50 feels possible. You learn to start before you feel ready. Your mindful minutes also feed the physical and spiritual areas of Life.

> **Result:** one breath to settle, one clock to work against, a task named on it, and a record of real focus that follows you to every device.

## The bottom line

Breathe first, then pick a task and start a clock. Keep what you did, throw away what you did not, and let the numbers show you how your focus grows.', 10, 1);
UPDATE learning_items SET module_title = 'Your privacy and your data', body = 'You write things here that you would not post: how you slept, what stressed you, a page in your journal. So you should know who sees what. Most of it is yours alone, and you hold the switches for the rest.

In this lesson you''ll learn:

- What only you see, and what the team may read.
- What others may see, and the switch for each part.
- How your devices and your password work.
- How to see all your data as tables, change it, take it with you, or wipe it.

## What only you see

Some things in the app are for your eyes only. They never reach brands, the team, the leaderboard or your public page. A coach sees one only if you switch it on for them.

- **Your journal:** every entry, every prompt you wrote about, and your gratitude lines. A coach sees them only if you switch that table on for them, and the assistant only if you switch it on with **Show to AI chat**.
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

You can also share whole tables with one coach, one at a time, under **Tables your coach can see** on the Profile tab, or with **Show to my coach** at the top of each table. Each starts off, and a coach can read a table but never change it. A table that holds other people''s details, such as your buyers, guests, clients or chats, is never offered to a coach. Turn any part or table off, or end the link, at any time.

### Your tables and the team

**All tables** shows your own lists, from tasks and moods to money, clients and events, as tables. They sit in the same groups as the Apps page, each closed until you open it, and a table shows only while its app does. A super admin on the team can open your tables to help you or to look into a problem. They can read them, never change them, and never open your journal, gratitude or body and mind tables. They never see a table that holds other people''s details either: those are for you and AI chat alone. Each table they open or download is written in a log, and your export lists when. Your money in Finance is one of the tables they can read.

### The assistant

The assistant reads your journal and gratitude only when you ask it about them, and only while you have switched on **Show to AI chat** for each of their tables. Each one starts off. Even then, only a model that keeps nothing may read them, and the picker marks those models "keeps nothing". Switch a table off and any answer that read it is left out of what the chat sends next. Discover reaches it only as a short summary, and only if you switch on **Let the assistant learn from them**. Your Discover tables need that switch too.

A whole table from **All tables** reaches the assistant and the Companion only if you switch on **Show to AI chat** for it, at the top of the table or under **AI chat** on the Profile tab. Each one starts off. They can read it, but never change it. The journal, gratitude, the body and mind tables and any table with other people''s details still go only to a model that keeps nothing.

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

You can change your own rows there too, and only you can.

- **Edit:** tap a cell under a pencil, or tick one row and tap **Edit** to change it in a form. Edit works on one row at a time.
- **Remove:** the button beside **Edit** uses the app''s own word, such as **Delete**, **Withdraw** or **Leave**. A small thing of your own, like a mood, asks for a second tap. Several rows, or anything with money, history or someone else''s access, ask in a sheet that counts what will happen first.
- **Select all:** it takes every row that matches, a hundred at a time. **Do the next 100** goes on.
- **Records stay:** xp, points, orders, badges and signed paper are greyed, with the reason beside them. A done task can go, and its xp stays.
- **Older days:** water, gratitude, supplement ticks and routine days keep to today and yesterday on their own screens. Here, an older day can change or go too.

Every change goes through the app''s own screen, so its rules and waits still apply. A coach, AI chat and a super admin can only read the tables the rules above let them see, and never change a row.

On the Profile tab, the **Your data** card has three buttons.

1. **Export my data:** everything we hold about you, as one file you can keep.
2. **Erase everything:** your pillars, xp, streak and badges go, and you start over. A sheet asks first, with a red **Yes, erase everything** and **Keep my progress**. After it, the setup chat opens again. Your journal, gratitude, trackers and Fitness logs stay.
3. **Delete my account:** a sheet lists what happens. You type DELETE, then tap **Delete my account**. Your name, page, pillars, logs, journal and messages are gone. Your events, runs and sessions still to come are cancelled, and whoever was coming is told. What you never sold goes, and what you sold is archived for the people who bought it. Money records and what others rely on stay, without your name. A note already in someone else''s inbox keeps the words it was written with.

> **Result:** you know what is yours alone, which switch shares each part, how to change your own rows, and how to leave with your data.

## The bottom line

Your inner life stays yours: journal, wellbeing, Discover and your tags. Everything you share has a switch you own. And you can take your data with you, or wipe it, at any time.' WHERE id = 'prog-onboarding-l15' AND program_id = 'prog-onboarding';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-onboarding-l15', 'prog-onboarding', 'Your privacy and your data', 'lesson', NULL, 'You write things here that you would not post: how you slept, what stressed you, a page in your journal. So you should know who sees what. Most of it is yours alone, and you hold the switches for the rest.

In this lesson you''ll learn:

- What only you see, and what the team may read.
- What others may see, and the switch for each part.
- How your devices and your password work.
- How to see all your data as tables, change it, take it with you, or wipe it.

## What only you see

Some things in the app are for your eyes only. They never reach brands, the team, the leaderboard or your public page. A coach sees one only if you switch it on for them.

- **Your journal:** every entry, every prompt you wrote about, and your gratitude lines. A coach sees them only if you switch that table on for them, and the assistant only if you switch it on with **Show to AI chat**.
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

You can also share whole tables with one coach, one at a time, under **Tables your coach can see** on the Profile tab, or with **Show to my coach** at the top of each table. Each starts off, and a coach can read a table but never change it. A table that holds other people''s details, such as your buyers, guests, clients or chats, is never offered to a coach. Turn any part or table off, or end the link, at any time.

### Your tables and the team

**All tables** shows your own lists, from tasks and moods to money, clients and events, as tables. They sit in the same groups as the Apps page, each closed until you open it, and a table shows only while its app does. A super admin on the team can open your tables to help you or to look into a problem. They can read them, never change them, and never open your journal, gratitude or body and mind tables. They never see a table that holds other people''s details either: those are for you and AI chat alone. Each table they open or download is written in a log, and your export lists when. Your money in Finance is one of the tables they can read.

### The assistant

The assistant reads your journal and gratitude only when you ask it about them, and only while you have switched on **Show to AI chat** for each of their tables. Each one starts off. Even then, only a model that keeps nothing may read them, and the picker marks those models "keeps nothing". Switch a table off and any answer that read it is left out of what the chat sends next. Discover reaches it only as a short summary, and only if you switch on **Let the assistant learn from them**. Your Discover tables need that switch too.

A whole table from **All tables** reaches the assistant and the Companion only if you switch on **Show to AI chat** for it, at the top of the table or under **AI chat** on the Profile tab. Each one starts off. They can read it, but never change it. The journal, gratitude, the body and mind tables and any table with other people''s details still go only to a model that keeps nothing.

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

You can change your own rows there too, and only you can.

- **Edit:** tap a cell under a pencil, or tick one row and tap **Edit** to change it in a form. Edit works on one row at a time.
- **Remove:** the button beside **Edit** uses the app''s own word, such as **Delete**, **Withdraw** or **Leave**. A small thing of your own, like a mood, asks for a second tap. Several rows, or anything with money, history or someone else''s access, ask in a sheet that counts what will happen first.
- **Select all:** it takes every row that matches, a hundred at a time. **Do the next 100** goes on.
- **Records stay:** xp, points, orders, badges and signed paper are greyed, with the reason beside them. A done task can go, and its xp stays.
- **Older days:** water, gratitude, supplement ticks and routine days keep to today and yesterday on their own screens. Here, an older day can change or go too.

Every change goes through the app''s own screen, so its rules and waits still apply. A coach, AI chat and a super admin can only read the tables the rules above let them see, and never change a row.

On the Profile tab, the **Your data** card has three buttons.

1. **Export my data:** everything we hold about you, as one file you can keep.
2. **Erase everything:** your pillars, xp, streak and badges go, and you start over. A sheet asks first, with a red **Yes, erase everything** and **Keep my progress**. After it, the setup chat opens again. Your journal, gratitude, trackers and Fitness logs stay.
3. **Delete my account:** a sheet lists what happens. You type DELETE, then tap **Delete my account**. Your name, page, pillars, logs, journal and messages are gone. Your events, runs and sessions still to come are cancelled, and whoever was coming is told. What you never sold goes, and what you sold is archived for the people who bought it. Money records and what others rely on stay, without your name. A note already in someone else''s inbox keeps the words it was written with.

> **Result:** you know what is yours alone, which switch shares each part, how to change your own rows, and how to leave with your data.

## The bottom line

Your inner life stays yours: journal, wellbeing, Discover and your tags. Everything you share has a switch you own. And you can take your data with you, or wipe it, at any time.', 18, 1);
