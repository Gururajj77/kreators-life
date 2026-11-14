-- 0168: Admin guide lessons 02, 05 and 16 brought up to their files (2026-11-14): the routine's blocks fit the real day, the life map
-- refuses a block that would end before it starts or start while she is asleep, and a routine saved before with a block that ran backwards
-- or an empty one is put right the next time it is opened; Profile's "Starts open on Apps and in the menu" sets the Apps page and the menu
-- only, since every group in All tables starts closed; a product's money price goes up to ₹10,00,000 and a higher one is refused in words.
-- Made with: node scripts/admin-guide/build.mjs --sync <this file> --only 02,05,16. Safe to run again.
UPDATE learning_items SET sequence = 1 WHERE id = 'prog-admin-guide-l01' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET module_title = 'Pillars and the strategy session', body = 'Riya has her apps. But apps alone do not tell her where her life needs work. The Pillars tab does. It holds the seven relationships of her life, and the strategy session sets them up in one sitting.

In this lesson you''ll learn:

- How Riya runs the strategy session, part by part.
- What the pyramid is, and its six layers.
- Where the life map, the routine and the contract live after.
- What an admin can and cannot see.

## The seven pillars

Riya opens the **Pillars** tab. It reads "Your seven pillars". Each pillar is one relationship: Servitude, Friends, Family, Love, Yourself, Teachers and Faith. Each has its own guide, like Ember for Servitude and Dew for Yourself.

Before the session, a dark card sits near the top: **Set up your pillars: the strategy session**. She taps it.

## Step one: the map

The session is one chat, hosted by Bumling. First comes the map.

1. A row of seven faces sits at the top, one per relationship.
2. For each one, Riya ticks every feeling she knows from it, on good days and bad ones. Each feeling carries two tags, its number on the scale and its dimension, and she still picks by the words.
3. The feelings come in three groups: **Stuck**, **Owning it** and **At ease**.
4. Love, Teachers or Faith can be set aside with **Not part of my life right now**.
5. If ticking is hard, **Say it in your own words** opens a box. **Read my words** suggests feelings for free. **Read with AI** shows only with a plan.
6. She taps **That is my map**.

From her ticks, the app works out where she usually is and where she drops under stress. The key line is **Courage**. A relationship that drops below it is a good place to start. If she places one at Inner light or higher, she is asked for one thing she did last week that shows it.

## Step two: what gets in the way

Next she names fears and insecurities. A fear shows up when she is about to act. An insecurity is what she worries others notice. She picks the relationship each one touches, then taps **That is what gets in the way**. Sending it empty is fine.

## Step three: the scorecard and her real day

1. She rates her health, her wealth and each relationship from one to five stars, then taps **Those are my stars**.
2. If a high score does not match her map, one quick question asks how many days last week she acted with courage there.
3. She fills in a normal day as it is now: **Wake up**, **Lights out**, **Work starts**, **Work ends** and a few more. Then **That is my day**.

## Step four: focus, routine and practices

1. Bumling shows her map and suggests where to start. Riya keeps the picks or chooses her own, up to two, and taps **Work on these**.
2. Her routine appears. It has six blocks, built from her real day. Only the morning has steps to tick. She taps **Looks right**.
3. Lumen, guide to faith, asks for her morning practices: a mantra, a breathing exercise, a line to say and something to read. **Those are my practices**.

For every week she keeps the routine on five days, her wake-up time moves thirty minutes earlier, until half past six.

## Step five: the contract

The contract turns the plan into a promise.

- **Days a week, at least:** five to start with.
- **Daily check-in time:** a reminder lands in her inbox at that time on any day she has not checked in.
- **When a week falls short:** The streak breaks, Unlocks wait, or The coach sees it.
- **Type your name to sign:** she types "Riya" and taps **Sign it**.

A switch offers a live call with a coach, for ₹10,000. Saying yes asks the team and charges nothing while payments are off. Saying no changes nothing.

## Step six: the pyramids

Each focus pillar gets a pyramid. A pyramid has six layers, from the top down:

1. **Foundation:** one thing she will not let break, ever.
2. **Guiding principle:** a line she lives by, so the foundation holds.
3. **Value goal:** how she wants to feel more often.
4. **Goal outcome:** what she would see when the value goal is real.
5. **Project:** a bunch of tasks with a finish line.
6. **Task:** the point at the bottom, one small thing she can tick today.

Each pillar''s guide asks three quick questions. **Write my own** lets her answer in her own words. Then she picks a value goal and a project for each pillar, from six of each, each with a plain why, and taps **Build my pillars**. The chat ends with **Open my pillars** or **Add my interests**.

> **Pro tip:** a person who skips the session can still build a pillar by hand. On a pillar''s page, **Set up this pillar** offers the guide''s ready pyramid, or **Or start by hand with a foundation**.

## After the session

- **Pillar cards:** each card on Pillars now shows where that relationship sits on the map.
- **A pillar''s page:** **Tasks to do** with **Add a task**, then **The pyramid**, where each layer opens to change it or add to it.
- **The life map:** at the bottom of Pillars, under "Your life map". It holds Month one, Where each one sits, Part of your life?, The whole map, Day zero scores, What gets in the way, Your routine and The contract.
- **Your routine:** she can change any block''s times, add or remove morning steps and set their minutes. A block that would end before it starts, or start while she is asleep, is not saved, and the field says why.
- **Again later:** **Run the session again** and **Build the pillars for your focus** sit at the top of the life map.

> **Result:** Riya has a map, one or two focus pillars, a routine, a signed contract and her first pyramids. Her first tasks will show on Daily.

## What an admin checks

The strategy session and Pillars are core. You cannot switch them off for anyone, and they are always open.

1. **Privacy:** her map, scores, fears and contract are hers. The one door is **Tables** in **People**: a super admin can read them there, never change them, and each table you open goes in the audit log. Open one only to answer her question.
2. **Coaches:** a life coach sees only what Riya shares on that link. There are six switches: Daily and streaks, Pillars and pyramids, Routine and contract, Life map answers, Reflection and Patterns. She can turn any off. She can also switch on whole tables for them, one by one, read only.
3. **Making a coach:** use the **Life coaches** tab in Admin to answer people who asked to coach.
4. **The live call:** a person asks from the contract or the life map, every admin hears once in the inbox, and the team writes to set a time. Once payments are live it is paid first, and only the signed webhook marks it paid.
5. **An older routine:** each block now fits the real day, so when work runs late, people and learning move to the time that is left. A routine saved before 14 November 2026 with a block that ran backwards, or an empty one, is put right the next time it is opened. If a member asks why an evening block moved, that is why.

## The bottom line

Pillars is the heart of the app. One session gives Riya her map, her routine, her contract and her pyramids. As an admin, you keep it open, make coaches carefully, and never look inside.', sequence = 2 WHERE id = 'prog-admin-guide-l02' AND program_id = 'prog-admin-guide';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-admin-guide-l02', 'prog-admin-guide', 'Pillars and the strategy session', 'lesson', NULL, 'Riya has her apps. But apps alone do not tell her where her life needs work. The Pillars tab does. It holds the seven relationships of her life, and the strategy session sets them up in one sitting.

In this lesson you''ll learn:

- How Riya runs the strategy session, part by part.
- What the pyramid is, and its six layers.
- Where the life map, the routine and the contract live after.
- What an admin can and cannot see.

## The seven pillars

Riya opens the **Pillars** tab. It reads "Your seven pillars". Each pillar is one relationship: Servitude, Friends, Family, Love, Yourself, Teachers and Faith. Each has its own guide, like Ember for Servitude and Dew for Yourself.

Before the session, a dark card sits near the top: **Set up your pillars: the strategy session**. She taps it.

## Step one: the map

The session is one chat, hosted by Bumling. First comes the map.

1. A row of seven faces sits at the top, one per relationship.
2. For each one, Riya ticks every feeling she knows from it, on good days and bad ones. Each feeling carries two tags, its number on the scale and its dimension, and she still picks by the words.
3. The feelings come in three groups: **Stuck**, **Owning it** and **At ease**.
4. Love, Teachers or Faith can be set aside with **Not part of my life right now**.
5. If ticking is hard, **Say it in your own words** opens a box. **Read my words** suggests feelings for free. **Read with AI** shows only with a plan.
6. She taps **That is my map**.

From her ticks, the app works out where she usually is and where she drops under stress. The key line is **Courage**. A relationship that drops below it is a good place to start. If she places one at Inner light or higher, she is asked for one thing she did last week that shows it.

## Step two: what gets in the way

Next she names fears and insecurities. A fear shows up when she is about to act. An insecurity is what she worries others notice. She picks the relationship each one touches, then taps **That is what gets in the way**. Sending it empty is fine.

## Step three: the scorecard and her real day

1. She rates her health, her wealth and each relationship from one to five stars, then taps **Those are my stars**.
2. If a high score does not match her map, one quick question asks how many days last week she acted with courage there.
3. She fills in a normal day as it is now: **Wake up**, **Lights out**, **Work starts**, **Work ends** and a few more. Then **That is my day**.

## Step four: focus, routine and practices

1. Bumling shows her map and suggests where to start. Riya keeps the picks or chooses her own, up to two, and taps **Work on these**.
2. Her routine appears. It has six blocks, built from her real day. Only the morning has steps to tick. She taps **Looks right**.
3. Lumen, guide to faith, asks for her morning practices: a mantra, a breathing exercise, a line to say and something to read. **Those are my practices**.

For every week she keeps the routine on five days, her wake-up time moves thirty minutes earlier, until half past six.

## Step five: the contract

The contract turns the plan into a promise.

- **Days a week, at least:** five to start with.
- **Daily check-in time:** a reminder lands in her inbox at that time on any day she has not checked in.
- **When a week falls short:** The streak breaks, Unlocks wait, or The coach sees it.
- **Type your name to sign:** she types "Riya" and taps **Sign it**.

A switch offers a live call with a coach, for ₹10,000. Saying yes asks the team and charges nothing while payments are off. Saying no changes nothing.

## Step six: the pyramids

Each focus pillar gets a pyramid. A pyramid has six layers, from the top down:

1. **Foundation:** one thing she will not let break, ever.
2. **Guiding principle:** a line she lives by, so the foundation holds.
3. **Value goal:** how she wants to feel more often.
4. **Goal outcome:** what she would see when the value goal is real.
5. **Project:** a bunch of tasks with a finish line.
6. **Task:** the point at the bottom, one small thing she can tick today.

Each pillar''s guide asks three quick questions. **Write my own** lets her answer in her own words. Then she picks a value goal and a project for each pillar, from six of each, each with a plain why, and taps **Build my pillars**. The chat ends with **Open my pillars** or **Add my interests**.

> **Pro tip:** a person who skips the session can still build a pillar by hand. On a pillar''s page, **Set up this pillar** offers the guide''s ready pyramid, or **Or start by hand with a foundation**.

## After the session

- **Pillar cards:** each card on Pillars now shows where that relationship sits on the map.
- **A pillar''s page:** **Tasks to do** with **Add a task**, then **The pyramid**, where each layer opens to change it or add to it.
- **The life map:** at the bottom of Pillars, under "Your life map". It holds Month one, Where each one sits, Part of your life?, The whole map, Day zero scores, What gets in the way, Your routine and The contract.
- **Your routine:** she can change any block''s times, add or remove morning steps and set their minutes. A block that would end before it starts, or start while she is asleep, is not saved, and the field says why.
- **Again later:** **Run the session again** and **Build the pillars for your focus** sit at the top of the life map.

> **Result:** Riya has a map, one or two focus pillars, a routine, a signed contract and her first pyramids. Her first tasks will show on Daily.

## What an admin checks

The strategy session and Pillars are core. You cannot switch them off for anyone, and they are always open.

1. **Privacy:** her map, scores, fears and contract are hers. The one door is **Tables** in **People**: a super admin can read them there, never change them, and each table you open goes in the audit log. Open one only to answer her question.
2. **Coaches:** a life coach sees only what Riya shares on that link. There are six switches: Daily and streaks, Pillars and pyramids, Routine and contract, Life map answers, Reflection and Patterns. She can turn any off. She can also switch on whole tables for them, one by one, read only.
3. **Making a coach:** use the **Life coaches** tab in Admin to answer people who asked to coach.
4. **The live call:** a person asks from the contract or the life map, every admin hears once in the inbox, and the team writes to set a time. Once payments are live it is paid first, and only the signed webhook marks it paid.
5. **An older routine:** each block now fits the real day, so when work runs late, people and learning move to the time that is left. A routine saved before 14 November 2026 with a block that ran backwards, or an empty one, is put right the next time it is opened. If a member asks why an evening block moved, that is why.

## The bottom line

Pillars is the heart of the app. One session gives Riya her map, her routine, her contract and her pyramids. As an admin, you keep it open, make coaches carefully, and never look inside.', 2, 1);
UPDATE learning_items SET sequence = 3 WHERE id = 'prog-admin-guide-l03' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 4 WHERE id = 'prog-admin-guide-l24' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 5 WHERE id = 'prog-admin-guide-l04' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET module_title = 'Profile, apps and the public page', body = 'Riya wants two things now. She wants the app to show only what she uses. And she wants brands to find her work in one link. The Profile tab does the first. Her public page does the second.

In this lesson you''ll learn:

- What sits on the Profile tab, from top to bottom.
- How Riya hides and unhides apps, sets how groups open and puts apps in her own order.
- How she builds her public page, with links and switches.
- Where her badges and her year live, and what an admin can do.

## Step one: the Profile tab

The Profile tab opens with a cover: her picture, her name and a small badge for her role. **Sign out** sits at the top right and always asks first. Three buttons sit on the cover: **See my public page**, **Edit page** and **Plans and credits**.

## Step two: who you are

Under **Who you are**, every tag is a tile to pick, like Content creator and Freelancer.

1. She now shoots for brands too, so under **For clients** she taps the **Videographer** tile. It saves at once.
2. Tags mark the apps that fit her. Picking one never changes her apps.
3. To change her apps by her answers, she taps **Match my apps again**. The setup chat opens with her last answers filled in, and only the chat shows and hides apps for her.

Tags never show on her public page.

## Step three: Appearance and Features

**Appearance** has three buttons: **Match device**, **Light** and **Dark**.

**Features** lists her apps in groups, always in this order: Contribution, Reflection, Connection, Creation and Essentials. A sixth group, Operations, is for the team only.

1. Each group shows how many apps it shows, like "3 of 7 shown". Riya opens Creation.
2. Each app has a round eye that hides it, and hidden apps wait under **Hidden apps** at the end of the group. Nothing is deleted.
3. An app that fits her answers says **Fits you**, and why.
4. Each group has a switch, **Starts open on Apps and in the menu**. She turns it on for Contribution and Creation, the two she uses most. It sets the Apps page and the menu only: the groups in **All tables** always start closed.
5. She taps **Arrange apps**. Now she can drag an app by its handle, or use **Move up** and **Move down**. Apps stay inside their group. She taps **Done**.
6. To undo an order, the group''s More menu has **Reset order**.

> **Pro tip:** the order and the open groups are saved on her account, so they follow her to every device. The Apps page and the menu use them too.

## Step four: privacy, account and data

- **Privacy choices:** the same three choices as the first privacy card. Each tick saves at once.
- **Account:** her email, **Change password** and **Sign out**.
- **Your data:** **Export my data** gives everything as one file. **Erase everything** clears her pillars, xp, streak and badges, and asks first. **Delete my account** asks her to type DELETE.

## Step five: points, her year and badges

1. **Points** shows her balance, with **Rewards** to spend them and **Rank** for the leaderboard.
2. **Your year** is a grid of days, like a calendar for the whole year. It shows xp or tasks ticked each day. Only she sees it.
3. **Badges** are medals the app earns for her by its own count. She taps one to see the next step. Some families, like Focus and Money, show only to her.
4. **Awarded** lists honors the team gave her, or that time in the app unlocked.

Lower down, the profile form has **Show me on the leaderboard**. She ticks it and taps **Save profile**.

## Step six: the public page

Riya taps **Edit page**. This is the Public page app.

1. **Username:** her page address, like /u/riya_edits. Three to twenty letters, numbers or underscores.
2. **Bio**, **Photo link** and **Links** for Instagram, YouTube and a website.
3. **Dates and times** (time zone, date format, time format), **Currency** and **City**. The Profile tab has the same **Dates and times**, and every screen and reminder follows it.
4. **What is public:** ten switches. **My page is public** comes first, and every other switch needs it on. The rest are social icons, links, portfolio, what she sells, posts, activity, badges, friend requests and chats.
5. She taps **Save profile**. At the top, **Copy** copies her page link and **Open** shows it.

Then she builds the **Links** part, like a link-in-bio page.

1. She adds a block: **Link**, **Header**, **Text**, **Image**, **Video** or **Carousel**.
2. For her showreel she picks **Link**, adds the button text and the https address, and ticks **Featured: big and in colour**.
3. She taps **Add to my page**. Each change saves on its own.
4. **Hide** takes a block off the page without deleting it.
5. Each block shows how many taps it got, for her eyes only.

Her journal and wellbeing never appear on her page. The page ends with "Made with kreators.app".

> **Result:** Riya sees only her apps, in her order. Brands get one link with her showreel on top, and she can see which links they tap.

## What an admin checks

1. **One person''s apps:** in **Admin**, **People**, tap her row. Under **What does this person see?** tick to allow and untick to block. A struck-through app is not allowed for her. **Reset** brings the usual rules back. Locked apps, like Daily, cannot be blocked.
2. **Everyone''s apps:** the **Flags** tab sets an app''s on or off, its **Minimum role** and its **Rollout %**. An override can force it for one person, one role or one brand, and can expire.
3. **Badges and honors:** in her row, **Badges given by hand** and **Honors**. A badge she earned is never taken away there.
4. **Her page:** you cannot change her page. If a page breaks the terms, the account can be deleted from People, after a sheet asks first.
5. **Her tags:** tags are private. They never reach her public page.

## The bottom line

Profile is Riya''s control room: tags, apps, privacy, data and badges. The public page is her front door, built from blocks and guarded by switches she owns. As an admin, you change what apps people can open, and leave their page and tags to them.', sequence = 6 WHERE id = 'prog-admin-guide-l05' AND program_id = 'prog-admin-guide';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-admin-guide-l05', 'prog-admin-guide', 'Profile, apps and the public page', 'lesson', NULL, 'Riya wants two things now. She wants the app to show only what she uses. And she wants brands to find her work in one link. The Profile tab does the first. Her public page does the second.

In this lesson you''ll learn:

- What sits on the Profile tab, from top to bottom.
- How Riya hides and unhides apps, sets how groups open and puts apps in her own order.
- How she builds her public page, with links and switches.
- Where her badges and her year live, and what an admin can do.

## Step one: the Profile tab

The Profile tab opens with a cover: her picture, her name and a small badge for her role. **Sign out** sits at the top right and always asks first. Three buttons sit on the cover: **See my public page**, **Edit page** and **Plans and credits**.

## Step two: who you are

Under **Who you are**, every tag is a tile to pick, like Content creator and Freelancer.

1. She now shoots for brands too, so under **For clients** she taps the **Videographer** tile. It saves at once.
2. Tags mark the apps that fit her. Picking one never changes her apps.
3. To change her apps by her answers, she taps **Match my apps again**. The setup chat opens with her last answers filled in, and only the chat shows and hides apps for her.

Tags never show on her public page.

## Step three: Appearance and Features

**Appearance** has three buttons: **Match device**, **Light** and **Dark**.

**Features** lists her apps in groups, always in this order: Contribution, Reflection, Connection, Creation and Essentials. A sixth group, Operations, is for the team only.

1. Each group shows how many apps it shows, like "3 of 7 shown". Riya opens Creation.
2. Each app has a round eye that hides it, and hidden apps wait under **Hidden apps** at the end of the group. Nothing is deleted.
3. An app that fits her answers says **Fits you**, and why.
4. Each group has a switch, **Starts open on Apps and in the menu**. She turns it on for Contribution and Creation, the two she uses most. It sets the Apps page and the menu only: the groups in **All tables** always start closed.
5. She taps **Arrange apps**. Now she can drag an app by its handle, or use **Move up** and **Move down**. Apps stay inside their group. She taps **Done**.
6. To undo an order, the group''s More menu has **Reset order**.

> **Pro tip:** the order and the open groups are saved on her account, so they follow her to every device. The Apps page and the menu use them too.

## Step four: privacy, account and data

- **Privacy choices:** the same three choices as the first privacy card. Each tick saves at once.
- **Account:** her email, **Change password** and **Sign out**.
- **Your data:** **Export my data** gives everything as one file. **Erase everything** clears her pillars, xp, streak and badges, and asks first. **Delete my account** asks her to type DELETE.

## Step five: points, her year and badges

1. **Points** shows her balance, with **Rewards** to spend them and **Rank** for the leaderboard.
2. **Your year** is a grid of days, like a calendar for the whole year. It shows xp or tasks ticked each day. Only she sees it.
3. **Badges** are medals the app earns for her by its own count. She taps one to see the next step. Some families, like Focus and Money, show only to her.
4. **Awarded** lists honors the team gave her, or that time in the app unlocked.

Lower down, the profile form has **Show me on the leaderboard**. She ticks it and taps **Save profile**.

## Step six: the public page

Riya taps **Edit page**. This is the Public page app.

1. **Username:** her page address, like /u/riya_edits. Three to twenty letters, numbers or underscores.
2. **Bio**, **Photo link** and **Links** for Instagram, YouTube and a website.
3. **Dates and times** (time zone, date format, time format), **Currency** and **City**. The Profile tab has the same **Dates and times**, and every screen and reminder follows it.
4. **What is public:** ten switches. **My page is public** comes first, and every other switch needs it on. The rest are social icons, links, portfolio, what she sells, posts, activity, badges, friend requests and chats.
5. She taps **Save profile**. At the top, **Copy** copies her page link and **Open** shows it.

Then she builds the **Links** part, like a link-in-bio page.

1. She adds a block: **Link**, **Header**, **Text**, **Image**, **Video** or **Carousel**.
2. For her showreel she picks **Link**, adds the button text and the https address, and ticks **Featured: big and in colour**.
3. She taps **Add to my page**. Each change saves on its own.
4. **Hide** takes a block off the page without deleting it.
5. Each block shows how many taps it got, for her eyes only.

Her journal and wellbeing never appear on her page. The page ends with "Made with kreators.app".

> **Result:** Riya sees only her apps, in her order. Brands get one link with her showreel on top, and she can see which links they tap.

## What an admin checks

1. **One person''s apps:** in **Admin**, **People**, tap her row. Under **What does this person see?** tick to allow and untick to block. A struck-through app is not allowed for her. **Reset** brings the usual rules back. Locked apps, like Daily, cannot be blocked.
2. **Everyone''s apps:** the **Flags** tab sets an app''s on or off, its **Minimum role** and its **Rollout %**. An override can force it for one person, one role or one brand, and can expire.
3. **Badges and honors:** in her row, **Badges given by hand** and **Honors**. A badge she earned is never taken away there.
4. **Her page:** you cannot change her page. If a page breaks the terms, the account can be deleted from People, after a sheet asks first.
5. **Her tags:** tags are private. They never reach her public page.

## The bottom line

Profile is Riya''s control room: tags, apps, privacy, data and badges. The public page is her front door, built from blocks and guarded by switches she owns. As an admin, you change what apps people can open, and leave their page and tags to them.', 6, 1);
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
UPDATE learning_items SET module_title = 'Shop, Store, Tools and Content: selling and making', body = 'Riya cuts reels that keep people watching, and other creators keep asking how. Here she turns that skill into a course, sells sessions, lists her old camera and plans content for a brand.

In this lesson you''ll learn:

- How Riya makes a product and a course in the Shop.
- How a course moves through Draft, Private, Public and Archived, with invites.
- How coupons and bookings work.
- How the Store, Tools and Content apps help her.
- What an admin can see and change.

## The Shop

The Shop is on for a new account. Its sections are **Overview**, **My page**, **Customers**, **Bookings**, **Content**, **Priority DMs**, **Reviews**, **Audience** and **Auto-DM**. Points work today. Money checkout is in test mode until a payment provider is connected, and a money order is paid only once the provider confirms it.

First, Riya picks her page name under **My page**, so people can find her products.

## Step by step: Riya''s course

1. On **Overview**, she taps **New product**.
2. Under **What are you selling?** she picks **Course**. Other kinds are Download, Membership, Session, Event, Link, Payment link, Bundle, Locked post and Priority DM.
3. She types the **Title**, "Reels that hold", and a **Price in points**. Zero makes it free.
4. She taps **Create draft**. The product page opens.
5. Under **Lessons** she taps **Add lesson**, or **Draft from notes** to turn an outline into draft lessons. Each lesson has text, an optional video link, a drip day and an optional quiz.
6. In the form she can add a money price, up to ₹10,00,000, and set **Who can buy**: **Xp of at least**, **Points of at least** and **Holds the badge**. Empty means anyone. A higher money price is not saved, and the form says why.

## The four states of a course

At the top of the product page, **Who can see it** shows the state. A course has four:

- **Draft:** only Riya can see it. Nobody can buy it yet.
- **Private:** only the people she invites can see it and enrol. It is in no list, search or public page, and never in a bundle.
- **Public:** anyone can find it and enrol.
- **Archived:** hidden from everyone, and nobody new can buy it. Buyers keep what they have.

Every other kind has three: Draft, Live and Archived.

Riya wants three students to test her course first.

1. She taps **Private**.
2. **Invite people** opens. She types an email, @username or friend code and taps **Invite**. Each person gets an inbox note.
3. Later she taps **Public**, or **Publish** while it is a draft.
4. **Remove** takes an invite back, after a sheet asks. Anyone who already enrolled keeps what they have.

When she makes a new version, she taps **Archived** on the old one. **Delete for good** appears in the **More** menu only once it is archived, and asks first. A product someone has bought is never deleted; it stays archived so their order and access stay.

## Coupons and bookings

- **Coupons:** on the product page, type a **Code** like LAUNCH20 and a **% off**, then **Add**. **Remove** asks first. A buyer can also type a team discount code; Riya is still paid the full price.
- **Sessions:** a Session product sets its length, buffer, notice and how far ahead people can book. Under **Bookings**, **Availability** holds her weekly windows: a day, **From** and **To**, then **Add**. She can block a date or give it its own hours. A request shows with **Confirm**, which takes an optional meeting link, and **Decline**, which asks first.

## The Store

The Store starts hidden on a new account. It has three shelves: new gear picked by the team, pre-owned gear from creators, and kits by budget.

1. Riya taps **Sell something** to list her old camera.
2. She fills in **What is it**, **Category**, **Condition**, **Asking price**, and optional extras like **What comes with it** and picture links.
3. She taps **List it**.
4. A buyer taps her listing, types an amount and taps **Make the offer**.
5. Riya taps **Accept** or **Decline**. A chat opens for the handover.
6. When it is done she taps **Mark as sold**.

The two of them settle the money and the handover; kreators.app takes nothing. **Feature for 7 days · 200 points** puts her listing at the top for a week. She can have up to twenty open listings.

New gear goes out through a partner link, and the card says "Partner link. Kreators may earn a share."

## Tools

Tools is a directory checked by the team. **Get it** goes through a partner link, **Open** goes straight to the tool. Riya taps **Suggest a tool**, fills in **Name**, **Link**, **Category** and **What it is good for**, and sends it. She sees it at once; everyone else sees it after a reviewer checks it.

## Content: the strategist

Riya edits for a chai brand. Content gives her a folder for it.

1. She opens **Content** and taps **New brand**.
2. She fills in **Brand**, **Niche**, **What it is** and **How it sounds**, and taps **Make the folder**.
3. Under **Links** she adds the brand''s site and channels, and ticks **This is a competitor** for rivals.
4. Under **Research** she picks a kind and taps **Run it**.
5. Under **Create** she picks a piece, like Hooks or Four-week calendar, and writes the brief. **Research first** reads unread links before writing.

Eight strategy steps guide the order, from the brand''s voice to a month of posts. Only that folder goes to the model, never her journal or customers.

> **Pro tip:** keep a new course Private for a week with a few invited testers. Fix what confuses them, then make it Public.

> **Result:** Riya has a course her testers finished, sessions people book from her hours, a camera sold to another editor, and a month of posts planned for her client.

## What the admin checks

1. **Every course:** an admin sees and changes every product of every creator, in every state. A change to someone else''s product goes to the audit log.
2. **Store shelves:** staff see **Team actions** on the Store, with **Add a product** and **Make a kit**.
3. **Tools:** a reviewer''s **More** menu on a tool has **Verify**, **Mark as partner link**, **Feature for a week** and **Remove**.
4. **Discount codes:** made under **Admin**, **Discount codes**, which needs the Finance permission.
5. **Orders:** **Admin**, **Orders** shows each order with a timeline and a refund.
6. **Switches:** in **Flags**, each app''s row sets **On**, **Minimum role**, **Rollout %** and **Overrides**.

## The bottom line

The Shop lets a creator start small and grow: draft, test with invites, open to all, archive when done. Teach creators to use Private before Public. As an admin, you can open any course in any state, so use that power to help, and let the audit log show it.', sequence = 18 WHERE id = 'prog-admin-guide-l16' AND program_id = 'prog-admin-guide';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-admin-guide-l16', 'prog-admin-guide', 'Shop, Store, Tools and Content: selling and making', 'lesson', NULL, 'Riya cuts reels that keep people watching, and other creators keep asking how. Here she turns that skill into a course, sells sessions, lists her old camera and plans content for a brand.

In this lesson you''ll learn:

- How Riya makes a product and a course in the Shop.
- How a course moves through Draft, Private, Public and Archived, with invites.
- How coupons and bookings work.
- How the Store, Tools and Content apps help her.
- What an admin can see and change.

## The Shop

The Shop is on for a new account. Its sections are **Overview**, **My page**, **Customers**, **Bookings**, **Content**, **Priority DMs**, **Reviews**, **Audience** and **Auto-DM**. Points work today. Money checkout is in test mode until a payment provider is connected, and a money order is paid only once the provider confirms it.

First, Riya picks her page name under **My page**, so people can find her products.

## Step by step: Riya''s course

1. On **Overview**, she taps **New product**.
2. Under **What are you selling?** she picks **Course**. Other kinds are Download, Membership, Session, Event, Link, Payment link, Bundle, Locked post and Priority DM.
3. She types the **Title**, "Reels that hold", and a **Price in points**. Zero makes it free.
4. She taps **Create draft**. The product page opens.
5. Under **Lessons** she taps **Add lesson**, or **Draft from notes** to turn an outline into draft lessons. Each lesson has text, an optional video link, a drip day and an optional quiz.
6. In the form she can add a money price, up to ₹10,00,000, and set **Who can buy**: **Xp of at least**, **Points of at least** and **Holds the badge**. Empty means anyone. A higher money price is not saved, and the form says why.

## The four states of a course

At the top of the product page, **Who can see it** shows the state. A course has four:

- **Draft:** only Riya can see it. Nobody can buy it yet.
- **Private:** only the people she invites can see it and enrol. It is in no list, search or public page, and never in a bundle.
- **Public:** anyone can find it and enrol.
- **Archived:** hidden from everyone, and nobody new can buy it. Buyers keep what they have.

Every other kind has three: Draft, Live and Archived.

Riya wants three students to test her course first.

1. She taps **Private**.
2. **Invite people** opens. She types an email, @username or friend code and taps **Invite**. Each person gets an inbox note.
3. Later she taps **Public**, or **Publish** while it is a draft.
4. **Remove** takes an invite back, after a sheet asks. Anyone who already enrolled keeps what they have.

When she makes a new version, she taps **Archived** on the old one. **Delete for good** appears in the **More** menu only once it is archived, and asks first. A product someone has bought is never deleted; it stays archived so their order and access stay.

## Coupons and bookings

- **Coupons:** on the product page, type a **Code** like LAUNCH20 and a **% off**, then **Add**. **Remove** asks first. A buyer can also type a team discount code; Riya is still paid the full price.
- **Sessions:** a Session product sets its length, buffer, notice and how far ahead people can book. Under **Bookings**, **Availability** holds her weekly windows: a day, **From** and **To**, then **Add**. She can block a date or give it its own hours. A request shows with **Confirm**, which takes an optional meeting link, and **Decline**, which asks first.

## The Store

The Store starts hidden on a new account. It has three shelves: new gear picked by the team, pre-owned gear from creators, and kits by budget.

1. Riya taps **Sell something** to list her old camera.
2. She fills in **What is it**, **Category**, **Condition**, **Asking price**, and optional extras like **What comes with it** and picture links.
3. She taps **List it**.
4. A buyer taps her listing, types an amount and taps **Make the offer**.
5. Riya taps **Accept** or **Decline**. A chat opens for the handover.
6. When it is done she taps **Mark as sold**.

The two of them settle the money and the handover; kreators.app takes nothing. **Feature for 7 days · 200 points** puts her listing at the top for a week. She can have up to twenty open listings.

New gear goes out through a partner link, and the card says "Partner link. Kreators may earn a share."

## Tools

Tools is a directory checked by the team. **Get it** goes through a partner link, **Open** goes straight to the tool. Riya taps **Suggest a tool**, fills in **Name**, **Link**, **Category** and **What it is good for**, and sends it. She sees it at once; everyone else sees it after a reviewer checks it.

## Content: the strategist

Riya edits for a chai brand. Content gives her a folder for it.

1. She opens **Content** and taps **New brand**.
2. She fills in **Brand**, **Niche**, **What it is** and **How it sounds**, and taps **Make the folder**.
3. Under **Links** she adds the brand''s site and channels, and ticks **This is a competitor** for rivals.
4. Under **Research** she picks a kind and taps **Run it**.
5. Under **Create** she picks a piece, like Hooks or Four-week calendar, and writes the brief. **Research first** reads unread links before writing.

Eight strategy steps guide the order, from the brand''s voice to a month of posts. Only that folder goes to the model, never her journal or customers.

> **Pro tip:** keep a new course Private for a week with a few invited testers. Fix what confuses them, then make it Public.

> **Result:** Riya has a course her testers finished, sessions people book from her hours, a camera sold to another editor, and a month of posts planned for her client.

## What the admin checks

1. **Every course:** an admin sees and changes every product of every creator, in every state. A change to someone else''s product goes to the audit log.
2. **Store shelves:** staff see **Team actions** on the Store, with **Add a product** and **Make a kit**.
3. **Tools:** a reviewer''s **More** menu on a tool has **Verify**, **Mark as partner link**, **Feature for a week** and **Remove**.
4. **Discount codes:** made under **Admin**, **Discount codes**, which needs the Finance permission.
5. **Orders:** **Admin**, **Orders** shows each order with a timeline and a refund.
6. **Switches:** in **Flags**, each app''s row sets **On**, **Minimum role**, **Rollout %** and **Overrides**.

## The bottom line

The Shop lets a creator start small and grow: draft, test with invites, open to all, archive when done. Teach creators to use Private before Public. As an admin, you can open any course in any state, so use that power to help, and let the audit log show it.', 18, 1);
UPDATE learning_items SET sequence = 19 WHERE id = 'prog-admin-guide-l17' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 20 WHERE id = 'prog-admin-guide-l18' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 21 WHERE id = 'prog-admin-guide-l19' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 22 WHERE id = 'prog-admin-guide-l20' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 23 WHERE id = 'prog-admin-guide-l21' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 24 WHERE id = 'prog-admin-guide-l22' AND program_id = 'prog-admin-guide';
UPDATE learning_items SET sequence = 25 WHERE id = 'prog-admin-guide-l23' AND program_id = 'prog-admin-guide';
