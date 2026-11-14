-- 0167: Onboarding lessons 03, 12, 15 and 16 brought up to their files (2026-11-14): the routine's blocks fit the real day (when work runs
-- late, people and learning move to the time that is left, nothing runs past lights out) and the life map refuses a block that would end
-- before it starts or start while the person is asleep; a product's money price goes up to ₹10,00,000; every group in All tables starts
-- closed, whatever Profile's "Starts open on Apps and in the menu" says. Every lesson keeps its place.
-- Made with: node scripts/onboarding-guide/build.mjs --sync <this file> --only 03,12,15,16. Safe to run again.
UPDATE learning_items SET module_title = 'The strategy session and your life map', body = 'Some days you want the whole picture: where each relationship stands, what drags you down, and what to work on first. That is what the strategy session is for. It takes a few minutes, and you leave with a map, a routine and a plan.

In this lesson you''ll learn:

- How the session places all seven relationships on a map.
- What your core, your floor and the Courage line mean.
- How your focus, routine and contract are built.
- Where your life map lives, and how to run it again.

## Starting the session

On the **Pillars** tab, tap the dark card **Set up your pillars: the strategy session**. It opens as a chat, like the setup chat. Bumling hosts most of it. Lumen, guide to faith, hosts the part about practices. Each pillar''s own guide asks that pillar''s questions.

The header has **Start over** and **Close**. What you finish stays saved, so you can come back later.

## Part one: your map

For each relationship, you see a list of feelings, from Shame and Fear up through Courage to Oneness. Each one comes with how it sounds in your head, like "I''m scared and I''m doing it anyway" for Courage.

1. Tick every feeling you have in that relationship, on good days and on bad ones. Each feeling carries two tags: its number on the scale and its dimension. You still pick by the words.
2. If words come easier than lists, open **Say it in your own words**. Type how it feels, then tap **Read my words**. It suggests feelings, and you choose which to tick. With a plan, **Read with AI** does the same with a model.
3. Love, Teachers and Faith have a switch, **Not part of my life right now**. Set one aside and it stays out of your focus and gets no pyramid.

When all seven are done, tap **That is my map**.

## Core, floor and Courage

From your ticks, the app finds two points for each relationship.

- **Your core:** where you usually live. It is where most of your ticks sit.
- **Your floor:** where you drop under stress. It is the lowest feeling you ticked.

Courage is the line that matters most. Below it, fear, blame or shame run the show. At Courage and above, you show up even when it is hard.

- **A floor under Courage** marks that relationship as a good place to start.
- **A big drop**, more than 150 between floor and core, gets a note to check it weekly.
- **A core at Inner light or higher** asks for proof: one thing you did last week that shows it. Without it, the core is placed at Acceptance.

> **Pro tip:** tick the hard feelings too. A map that only shows good days cannot help you on bad ones.

## Part two: what gets in the way, and your scores

Next, you name your fears and insecurities, each tied to a pillar, and pick how heavy each feels. Naming them early lets the plan answer them.

Then comes a scorecard with stars, from Very poor to Great, for your health, your wealth and the seven relationships.

## Part three: your real day

You say when you wake up, when the lights go out, and your work hours. The routine is built from this real day, not a perfect one.

## Part four: your focus

Bumling shows your map and suggests up to two relationships to work on first. Floors under Courage come first. You can keep the picks or choose your own, then tap **Work on these**. Two at a time works better than seven at once.

## Part five: routine, practices and the contract

- **Your routine:** six blocks for the day. They are the morning routine, food and water, work, people, learning and reflection, and lights out. Only the morning has steps to tick. Each block fits your real day: if work runs late, people and learning move to the time that is left, and nothing runs past lights out. Each week you keep your deal, wake-up moves thirty minutes earlier, toward 6:30.
- **Practices:** Lumen offers a mantra, a breathing exercise, a line to say and something to read. You can use your own words, or none for now.
- **The contract:** how many days a week you will keep the routine (five to start), a check-in time, and what a short week costs. You pick from three: the streak breaks, unlocks wait, or the coach sees it. You sign by typing your name, then tap **Sign it**.
- **The live call:** a switch on the same card, **I would like a live call with a coach**. A person goes through your answers with you, for ₹10,000. Say yes and your ask goes to the team, who write to you to set a time. Nothing is charged yet, and saying no changes nothing. You can also ask later from the contract on your life map.

On your check-in time, a reminder lands in your inbox on any day you have not checked in.

## Part six: your pillars

Now each focus pillar''s guide asks its short questions. A question with choices also has **Write my own**. Then one card lets you pick the value goal and project for each pillar, from six of each, each with a plain why. Tap **Build my pillars**, and the pyramids are made. The chat ends with **Open my pillars**, or **Add my interests** first.

## Your life map

Everything the session found is kept on the Pillars tab, under the pillar list, as **Your life map**.

- **Month one:** your focus pillars.
- **Where each one sits:** a bar from floor to core for each relationship, with a thin line for Courage.
- **Day zero scores**, **What gets in the way**, **Your routine** and **The contract**.

You can change the routine right there. A block that would end before it starts, or start while you are asleep, is not saved, and the field says why. Each pillar card above it also shows its line from floor to core.

## What emerges and what develops

The first map is a starting point, not a grade. Over weeks, your routine streak grows, wake-up moves earlier, and your focus pillars fill with xp. When you are ready, tap **Run the session again** and place yourself afresh. The real growth is a floor that rises: dropping less far on hard days.

> **Result:** you have a map of all seven relationships, a focus of one or two, a routine from your real day, and a signed plan.

## The bottom line

The strategy session shows where you usually live and where you drop. It points you to start where the floor is lowest, and builds a routine and a contract around your real day. Run it again whenever you want to see how far you have come.' WHERE id = 'prog-onboarding-l03' AND program_id = 'prog-onboarding';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-onboarding-l03', 'prog-onboarding', 'The strategy session and your life map', 'lesson', NULL, 'Some days you want the whole picture: where each relationship stands, what drags you down, and what to work on first. That is what the strategy session is for. It takes a few minutes, and you leave with a map, a routine and a plan.

In this lesson you''ll learn:

- How the session places all seven relationships on a map.
- What your core, your floor and the Courage line mean.
- How your focus, routine and contract are built.
- Where your life map lives, and how to run it again.

## Starting the session

On the **Pillars** tab, tap the dark card **Set up your pillars: the strategy session**. It opens as a chat, like the setup chat. Bumling hosts most of it. Lumen, guide to faith, hosts the part about practices. Each pillar''s own guide asks that pillar''s questions.

The header has **Start over** and **Close**. What you finish stays saved, so you can come back later.

## Part one: your map

For each relationship, you see a list of feelings, from Shame and Fear up through Courage to Oneness. Each one comes with how it sounds in your head, like "I''m scared and I''m doing it anyway" for Courage.

1. Tick every feeling you have in that relationship, on good days and on bad ones. Each feeling carries two tags: its number on the scale and its dimension. You still pick by the words.
2. If words come easier than lists, open **Say it in your own words**. Type how it feels, then tap **Read my words**. It suggests feelings, and you choose which to tick. With a plan, **Read with AI** does the same with a model.
3. Love, Teachers and Faith have a switch, **Not part of my life right now**. Set one aside and it stays out of your focus and gets no pyramid.

When all seven are done, tap **That is my map**.

## Core, floor and Courage

From your ticks, the app finds two points for each relationship.

- **Your core:** where you usually live. It is where most of your ticks sit.
- **Your floor:** where you drop under stress. It is the lowest feeling you ticked.

Courage is the line that matters most. Below it, fear, blame or shame run the show. At Courage and above, you show up even when it is hard.

- **A floor under Courage** marks that relationship as a good place to start.
- **A big drop**, more than 150 between floor and core, gets a note to check it weekly.
- **A core at Inner light or higher** asks for proof: one thing you did last week that shows it. Without it, the core is placed at Acceptance.

> **Pro tip:** tick the hard feelings too. A map that only shows good days cannot help you on bad ones.

## Part two: what gets in the way, and your scores

Next, you name your fears and insecurities, each tied to a pillar, and pick how heavy each feels. Naming them early lets the plan answer them.

Then comes a scorecard with stars, from Very poor to Great, for your health, your wealth and the seven relationships.

## Part three: your real day

You say when you wake up, when the lights go out, and your work hours. The routine is built from this real day, not a perfect one.

## Part four: your focus

Bumling shows your map and suggests up to two relationships to work on first. Floors under Courage come first. You can keep the picks or choose your own, then tap **Work on these**. Two at a time works better than seven at once.

## Part five: routine, practices and the contract

- **Your routine:** six blocks for the day. They are the morning routine, food and water, work, people, learning and reflection, and lights out. Only the morning has steps to tick. Each block fits your real day: if work runs late, people and learning move to the time that is left, and nothing runs past lights out. Each week you keep your deal, wake-up moves thirty minutes earlier, toward 6:30.
- **Practices:** Lumen offers a mantra, a breathing exercise, a line to say and something to read. You can use your own words, or none for now.
- **The contract:** how many days a week you will keep the routine (five to start), a check-in time, and what a short week costs. You pick from three: the streak breaks, unlocks wait, or the coach sees it. You sign by typing your name, then tap **Sign it**.
- **The live call:** a switch on the same card, **I would like a live call with a coach**. A person goes through your answers with you, for ₹10,000. Say yes and your ask goes to the team, who write to you to set a time. Nothing is charged yet, and saying no changes nothing. You can also ask later from the contract on your life map.

On your check-in time, a reminder lands in your inbox on any day you have not checked in.

## Part six: your pillars

Now each focus pillar''s guide asks its short questions. A question with choices also has **Write my own**. Then one card lets you pick the value goal and project for each pillar, from six of each, each with a plain why. Tap **Build my pillars**, and the pyramids are made. The chat ends with **Open my pillars**, or **Add my interests** first.

## Your life map

Everything the session found is kept on the Pillars tab, under the pillar list, as **Your life map**.

- **Month one:** your focus pillars.
- **Where each one sits:** a bar from floor to core for each relationship, with a thin line for Courage.
- **Day zero scores**, **What gets in the way**, **Your routine** and **The contract**.

You can change the routine right there. A block that would end before it starts, or start while you are asleep, is not saved, and the field says why. Each pillar card above it also shows its line from floor to core.

## What emerges and what develops

The first map is a starting point, not a grade. Over weeks, your routine streak grows, wake-up moves earlier, and your focus pillars fill with xp. When you are ready, tap **Run the session again** and place yourself afresh. The real growth is a floor that rises: dropping less far on hard days.

> **Result:** you have a map of all seven relationships, a focus of one or two, a routine from your real day, and a signed plan.

## The bottom line

The strategy session shows where you usually live and where you drop. It points you to start where the floor is lowest, and builds a routine and a contract around your real day. Run it again whenever you want to see how far you have come.', 3, 1);
UPDATE learning_items SET module_title = 'Creation and contribution: learn, make and earn', body = 'You are good at something. Maybe you edit, write, shoot or teach. The Contribution and Creation apps are where that skill turns into learning, work and income. You do not need all of them. Pick the two or three that match what you do this year.

In this lesson you''ll learn:

- What each app in Contribution and Creation is for, in a line or two.
- Which ones show from the start and which you unhide.
- How work here gets checked by a real person before it pays.
- What grows as you use them.

## What shows from the start

A new account starts with **School**, **Work**, **Army** and the **Shop** on. The rest start hidden on a new account, unless the setup chat showed them for you. Open **Apps**, open the **Contribution** or **Creation** group, open **Hidden apps** at its end and tap the eye beside each app you want.

## Contribution: learn and earn

These apps are about giving your skill to others and getting better at it.

- **School:** cohorts with lessons, assignments, live sessions and a mentor''s feedback. Tap **Enrol** beside a cohort. You are in one right now: this program lives in School. A program priced in points asks again before it spends. A lesson ends in its ways in, up to six: **Download resource**, **Watch video**, **Open resource** or a book. A video plays right in the lesson. Each cohort has its own **Discussion**, where you stay private unless you pick Public.
- **Work:** opportunities from brands and the team. Write **A short note** and tap **Send application**. Your public portfolio and skills go with it, one application per person. You can **Withdraw** later.
- **Army:** brand campaigns from brief to delivery. You see a brief once the team assigns you to it. Then you tap **Upload a version**, and the brand approves it or asks for changes.
- **Win:** content rewards. A brand funds a pool, you post a video about them, and verified views turn into points. Each reward has **What could I earn?** so you can see the payout first. When your video is up, tap **Submit my video**.
- **Agency:** for a content agency or a freelance creator. Clients, content pieces from idea to published, retainers, time, approvals and invoices, in one place. Each client gets their own page to approve work.

## Creation: make and sell

These apps are about making things and running your own small business.

- **Shop:** sell downloads, courses, memberships, sessions, events and more. Points work today. Paying with money is in test mode until a payment provider is connected.
- **Store:** gear new from partners, or pre-owned from other creators. Tap **Sell something** to list your old camera. Buyers make offers, and you settle the money and the handover between you. A week at the top costs 200 points.
- **Tools:** a directory of creator tools, checked by the team. **Get it** goes through a partner link, and the card says so. Know a good one? Tap **Suggest a tool**.
- **Content:** a strategist for every brand you work on. Feed a folder links, let it research, and get plans, calendars, hooks and scripts back.
- **My purchases:** everything you bought, in one list.
- **Knowledge:** short reads and exercises from the guides. Each takes a few minutes.
- **TV** and **Fund:** pitch a series, or apply for backing for a project.

## A course of your own

Say you cut reels that keep people watching, and friends keep asking how. In the **Shop**, you can turn that into a course.

1. Tap **New product** and pick **Course**.
2. Add a title and a price in points, or zero to make it free. You can add a money price too, up to ₹10,00,000.
3. Add your lessons.
4. Choose who can see it.

A course has four states. **Draft** is only for you. **Private** is only for the people you invite. **Public** is open to anyone. **Archived** is hidden, and buyers keep what they bought. Start private with a few friends, fix what confuses them, then make it public.

You can also ask for a lock: some xp, some points, or a badge before someone can buy. Locks reward the people who show up.

## A person checks before anything pays

Nothing here pays on a claim alone. A mentor reads your hand-in in School. A brand approves your version in Army. A reviewer checks your views in Win. Money from a sale is paid only once the payment provider confirms it. This is slower than a button that pays at once. It is also why the points and the work here mean something.

## The roles you grow into

These apps need people on both sides. Learners need mentors. Brands need creators. Buyers need sellers they trust. As you deliver good work, you may be asked to mentor a cohort, run campaigns or teach a course. Nobody is born into these roles. They come from showing up and doing the work well.

## What grows over time

- **Your trust score:** sales and good ratings feed it, beside your xp and streaks. Buyers see it on your products and listings.
- **Your badges:** the Creator family counts products, sales and content rewards. The Learning family counts lessons finished and certificates earned.
- **Your Servitude pillar:** its question is "Who did you serve today?" A client, a learner or a brand counts. Put that work in its pyramid as projects and tasks.
- **You:** a skill shared becomes a skill sharpened. Teaching what you know is one of the fastest ways to learn it better.

> **Pro tip:** do not keep every app here showing at once. Pick one way to learn and one way to earn. Add a third only when those two feel easy.

> **Result:** you know which apps fit your work, you have one showing to learn and one to earn, and you know who checks your work before it pays.

## The bottom line

Contribution and Creation are where your skill meets other people. Learn in School, earn in Work, Army and Win, and build your own thing in the Shop and Agency. Start with two, do them well, and let your trust grow with each piece you deliver.' WHERE id = 'prog-onboarding-l12' AND program_id = 'prog-onboarding';
INSERT OR IGNORE INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES ('prog-onboarding-l12', 'prog-onboarding', 'Creation and contribution: learn, make and earn', 'lesson', NULL, 'You are good at something. Maybe you edit, write, shoot or teach. The Contribution and Creation apps are where that skill turns into learning, work and income. You do not need all of them. Pick the two or three that match what you do this year.

In this lesson you''ll learn:

- What each app in Contribution and Creation is for, in a line or two.
- Which ones show from the start and which you unhide.
- How work here gets checked by a real person before it pays.
- What grows as you use them.

## What shows from the start

A new account starts with **School**, **Work**, **Army** and the **Shop** on. The rest start hidden on a new account, unless the setup chat showed them for you. Open **Apps**, open the **Contribution** or **Creation** group, open **Hidden apps** at its end and tap the eye beside each app you want.

## Contribution: learn and earn

These apps are about giving your skill to others and getting better at it.

- **School:** cohorts with lessons, assignments, live sessions and a mentor''s feedback. Tap **Enrol** beside a cohort. You are in one right now: this program lives in School. A program priced in points asks again before it spends. A lesson ends in its ways in, up to six: **Download resource**, **Watch video**, **Open resource** or a book. A video plays right in the lesson. Each cohort has its own **Discussion**, where you stay private unless you pick Public.
- **Work:** opportunities from brands and the team. Write **A short note** and tap **Send application**. Your public portfolio and skills go with it, one application per person. You can **Withdraw** later.
- **Army:** brand campaigns from brief to delivery. You see a brief once the team assigns you to it. Then you tap **Upload a version**, and the brand approves it or asks for changes.
- **Win:** content rewards. A brand funds a pool, you post a video about them, and verified views turn into points. Each reward has **What could I earn?** so you can see the payout first. When your video is up, tap **Submit my video**.
- **Agency:** for a content agency or a freelance creator. Clients, content pieces from idea to published, retainers, time, approvals and invoices, in one place. Each client gets their own page to approve work.

## Creation: make and sell

These apps are about making things and running your own small business.

- **Shop:** sell downloads, courses, memberships, sessions, events and more. Points work today. Paying with money is in test mode until a payment provider is connected.
- **Store:** gear new from partners, or pre-owned from other creators. Tap **Sell something** to list your old camera. Buyers make offers, and you settle the money and the handover between you. A week at the top costs 200 points.
- **Tools:** a directory of creator tools, checked by the team. **Get it** goes through a partner link, and the card says so. Know a good one? Tap **Suggest a tool**.
- **Content:** a strategist for every brand you work on. Feed a folder links, let it research, and get plans, calendars, hooks and scripts back.
- **My purchases:** everything you bought, in one list.
- **Knowledge:** short reads and exercises from the guides. Each takes a few minutes.
- **TV** and **Fund:** pitch a series, or apply for backing for a project.

## A course of your own

Say you cut reels that keep people watching, and friends keep asking how. In the **Shop**, you can turn that into a course.

1. Tap **New product** and pick **Course**.
2. Add a title and a price in points, or zero to make it free. You can add a money price too, up to ₹10,00,000.
3. Add your lessons.
4. Choose who can see it.

A course has four states. **Draft** is only for you. **Private** is only for the people you invite. **Public** is open to anyone. **Archived** is hidden, and buyers keep what they bought. Start private with a few friends, fix what confuses them, then make it public.

You can also ask for a lock: some xp, some points, or a badge before someone can buy. Locks reward the people who show up.

## A person checks before anything pays

Nothing here pays on a claim alone. A mentor reads your hand-in in School. A brand approves your version in Army. A reviewer checks your views in Win. Money from a sale is paid only once the payment provider confirms it. This is slower than a button that pays at once. It is also why the points and the work here mean something.

## The roles you grow into

These apps need people on both sides. Learners need mentors. Brands need creators. Buyers need sellers they trust. As you deliver good work, you may be asked to mentor a cohort, run campaigns or teach a course. Nobody is born into these roles. They come from showing up and doing the work well.

## What grows over time

- **Your trust score:** sales and good ratings feed it, beside your xp and streaks. Buyers see it on your products and listings.
- **Your badges:** the Creator family counts products, sales and content rewards. The Learning family counts lessons finished and certificates earned.
- **Your Servitude pillar:** its question is "Who did you serve today?" A client, a learner or a brand counts. Put that work in its pyramid as projects and tasks.
- **You:** a skill shared becomes a skill sharpened. Teaching what you know is one of the fastest ways to learn it better.

> **Pro tip:** do not keep every app here showing at once. Pick one way to learn and one way to earn. Add a third only when those two feel easy.

> **Result:** you know which apps fit your work, you have one showing to learn and one to earn, and you know who checks your work before it pays.

## The bottom line

Contribution and Creation are where your skill meets other people. Learn in School, earn in Work, Army and Win, and build your own thing in the Shop and Agency. Start with two, do them well, and let your trust grow with each piece you deliver.', 15, 1);
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
- **Starts open on Apps and in the menu:** each group has this switch. Turn it on for the groups you use most. By default, Contribution and Essentials start open, and the rest start closed. It never changes **All tables**, where every group starts closed.
- **Arrange apps:** tap it and each app gets a drag handle, plus **Move up** and **Move down** buttons. Put the app you use most at the top. Apps move only inside their own group. Tap **Done** when you are happy.

A group you arranged also gets **Reset order** in its More menu, in case you want the old order back.

> **Pro tip:** your order and your open groups are saved on your account, not on one phone. Sign in on a laptop and the sidebar is already set up your way.

## What happens when you hide an app

Hiding deletes nothing.

- Your pages, logs and tasks stay put. Show the app again and they are there.
- A hidden app leaves the sidebar, the phone menu and Home.
- The tables that belong to it leave **All tables** too, and come back when you show it.
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
- **Starts open on Apps and in the menu:** each group has this switch. Turn it on for the groups you use most. By default, Contribution and Essentials start open, and the rest start closed. It never changes **All tables**, where every group starts closed.
- **Arrange apps:** tap it and each app gets a drag handle, plus **Move up** and **Move down** buttons. Put the app you use most at the top. Apps move only inside their own group. Tap **Done** when you are happy.

A group you arranged also gets **Reset order** in its More menu, in case you want the old order back.

> **Pro tip:** your order and your open groups are saved on your account, not on one phone. Sign in on a laptop and the sidebar is already set up your way.

## What happens when you hide an app

Hiding deletes nothing.

- Your pages, logs and tasks stay put. Show the app again and they are there.
- A hidden app leaves the sidebar, the phone menu and Home.
- The tables that belong to it leave **All tables** too, and come back when you show it.
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
