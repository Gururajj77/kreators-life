-- 0165: Onboarding lessons 14 and 15 brought up to their files after the assistant's journal read joined Show to AI chat (2026-11-14,
-- the founder's yes): read_journal reads journal entries only while the Journal entries table is open to AI chat and gratitude only while
-- the Gratitude table is, still only when asked and only on a model that keeps nothing; a part that is shut is said in words with where to
-- switch it on, and an answer that read a table since shut is left out of what the chat sends next. Every lesson keeps its place.
-- Made with: node scripts/onboarding-guide/build.mjs --sync <this file> --only 14,15. Safe to run again.
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

When a model is connected, a model picker shows under the panel''s header. Some models keep nothing you send. Only with one of those can the assistant read your trackers, your journal and your gratitude. It reads the journal and gratitude only when you ask about them, and only while you have switched on **Show to AI chat** for their tables. If one is off, it tells you so and where to switch it on. The panel tells you under the picker what the chosen model may read.

It can also read a whole table from **All tables**, but only one you open to it. Switch on **Show to AI chat** at the top of the table, or under **AI chat** on the Profile tab. Each one starts off, and the assistant and the Companion can read it but never change it. A table with other people''s details, such as your buyers, guests or chats, goes only to a model that keeps nothing, just like your journal.

If you took the Discover quiz, you choose whether the assistant learns from it. Find **Let your results help** on your Discover results. Your Discover tables reach AI chat only while that is on too.

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

When a model is connected, a model picker shows under the panel''s header. Some models keep nothing you send. Only with one of those can the assistant read your trackers, your journal and your gratitude. It reads the journal and gratitude only when you ask about them, and only while you have switched on **Show to AI chat** for their tables. If one is off, it tells you so and where to switch it on. The panel tells you under the picker what the chosen model may read.

It can also read a whole table from **All tables**, but only one you open to it. Switch on **Show to AI chat** at the top of the table, or under **AI chat** on the Profile tab. Each one starts off, and the assistant and the Companion can read it but never change it. A table with other people''s details, such as your buyers, guests or chats, goes only to a model that keeps nothing, just like your journal.

If you took the Discover quiz, you choose whether the assistant learns from it. Find **Let your results help** on your Discover results. Your Discover tables reach AI chat only while that is on too.

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

**All tables** shows your own lists, from tasks and moods to money, clients and events, as tables. They sit in the same groups as the Apps page, and a table shows only while its app does. A super admin on the team can open your tables to help you or to look into a problem. They can read them, never change them, and never open your journal, gratitude or body and mind tables. They never see a table that holds other people''s details either: those are for you and AI chat alone. Each table they open or download is written in a log, and your export lists when. Your money in Finance is one of the tables they can read.

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

**All tables** shows your own lists, from tasks and moods to money, clients and events, as tables. They sit in the same groups as the Apps page, and a table shows only while its app does. A super admin on the team can open your tables to help you or to look into a problem. They can read them, never change them, and never open your journal, gratitude or body and mind tables. They never see a table that holds other people''s details either: those are for you and AI chat alone. Each table they open or download is written in a log, and your export lists when. Your money in Finance is one of the tables they can read.

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

On the Profile tab, the **Your data** card has three buttons.

1. **Export my data:** everything we hold about you, as one file you can keep.
2. **Erase everything:** your pillars, xp, streak and badges go, and you start over. A sheet asks first, with a red **Yes, erase everything** and **Keep my progress**. After it, the setup chat opens again. Your journal, gratitude, trackers and Fitness logs stay.
3. **Delete my account:** a sheet lists what happens. You type DELETE, then tap **Delete my account**. Your name, page, pillars, logs, journal and messages are gone. Your events, runs and sessions still to come are cancelled, and whoever was coming is told. What you never sold goes, and what you sold is archived for the people who bought it. Money records and what others rely on stay, without your name. A note already in someone else''s inbox keeps the words it was written with.

> **Result:** you know what is yours alone, which switch shares each part, and how to leave with your data.

## The bottom line

Your inner life stays yours: journal, wellbeing, Discover and your tags. Everything you share has a switch you own. And you can take your data with you, or wipe it, at any time.', 18, 1);
