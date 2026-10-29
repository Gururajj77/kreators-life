# Copy brief: the kreators.app public site

This is the one brief for rewriting `/`, `/features`, every `/features/<app>` page, `/7rp` and the pricing card. It takes what still holds from CopyOS and drops the parts that would break our rules. When this brief and CopyOS disagree, this brief wins. When this brief and CLAUDE.md disagree, CLAUDE.md wins.

Source files: `apps/web/src/site/Home.tsx`, `content.ts` (`FEATURES`, `BRAND_PITCH`), `Features.tsx`, `Feature.tsx`, `SevenRP.tsx`, `SiteLayout.tsx`, `Explore.tsx`, and the pricing part of `Policy.tsx`.

## 1. Diagnosis

**Awareness (Schwartz).** Most people who land on `/` are problem aware. They feel the grind, the ten apps and the money worries, but they have never heard of "a daily game for seven relationships". So `/` opens with a scene or a problem they know, and the product name comes after. Feature pages get product- and solution-aware readers who came for one app, so they open with the promise and the three steps. Anyone with a session is most aware and only needs "Go to app".

**Sophistication (stage 4 to 5).** "Build better habits", "all-in-one creator app" and "grow your audience" have been said too often. Readers skip them. We lead with **the mechanism** (stage 4) and **identification** (stage 5): the reader sees their own week, then sees how the pyramid works.

**Big idea (type: Twist, backed by Mistake and Shortcut).** *Work is one of seven relationships. When it eats the other six, the work suffers too.* Twist: what you think is falling behind (the work) is not what is really falling behind. Mistake: most tools track one part of your life, so they don't stick. Shortcut: three taps a day. Don't use the Discovery type (we have no study) or the Conspiracy type (we have no hidden enemy).

**Unique mechanism.** Each pillar is a pyramid standing on its point. A tick on today's task lands at the point and climbs through the project, the goal outcome, the value goal and the guiding principle to the foundation. Every day is three moves: check in, one small act, one task. Creator apps sit on top, each off until you switch it on. Test: a stranger asks "how does it work?" and two sentences answer it.

**The one reader.** One "you": 18 or over, often in India, making something of their own (a creator, a freelancer, a student with a side project), who works alone and juggles money, family, friends and themselves. The sharpest pains go first: money that comes late or not at all, and burnout. Brands are a second reader with their own block. They are product aware, so they get rules and terms, not the story.

**Core promise.** A result the app really gives, a real time frame, and a real ease:
> Today: check in, do one small act, tick one task. By Sunday: your first week review.

**Touchstone** (one phrase, word for word, in the hero, the offer, the final CTA and the meta description). Pick one from testing. Default:
> **One small act a day, for all seven. Free to start, free to stay.**

## 2. Voice rules

1. **Plain words.** Flesch 60 or above on every file (`python3 -I scripts/flesch.py <file>`, `--strings` for `.tsx`). Sentences average 15 words or fewer, almost none over 25. No paragraph over three sentences. Headlines are 12 words or fewer.
2. **Calm, warm, honest.** It should sound like Bumling in the setup chat. No caps, no "!!!", no slang or swearing. Write "you", "your pillars", "your page", "your shop".
3. **Not the reader's fault.** Blame the setup, never the person. Never write "you lack discipline".
4. **Enemies are ideas.** The five villains are patterns. Never name a rival app, brand or person. Never write "secret", "they hide" or "what X doesn't want you to know".
5. **Every claim is something the app does today.** You must be able to point to a route, a rule or a constant. If you can't, cut the claim.
6. **No fake proof, ever.** That means no testimonial, quote, name, persona ("Priya, 24, Mumbai"), rating, download count, percentage, "thousands of creators", logo or "as seen in". No countdown, "spots left", "price goes up", deadline or bonus with a value on it.
7. **No hype words.** That includes revolutionary, ultimate, secret, shocking, proven, guaranteed, game-changing, transform your life, finally, insane, no-brainer, best and only (unless it can be checked).
8. **A true "because".** Every claim or ask carries a reason (because, so, to), and the reason is how the product really works.
9. **Fixed words.** Use these exactly: pillars, pyramid, layers (foundation, guiding principle, value goal, goal outcome, project, task), small act, not to do, reviews, period, the Daily tab, the Profile tab. Never use tower, floor, rung, ladder, spark, habits, sprint, retro, "Today" as a screen name or "You" as a tab. Explain each word in a plain clause the first time it appears, using the `TERMS` wording.
10. **Product name.** Always `kreators.app`, lowercase with the dot. Each character is named with their role the first time ("Dew, guide to yourself", `characterTitle`).
11. **Keep money words and people words apart.** Money language belongs to Work, Army, Win, Shop and Finance. Circles, Run, Party, Community and coaching are described in social words, never with a price or a value.
12. **Mind the mix.** About 60% of `/` is positive, and the negative stays in Problem and Villains. Each cost line is mild and true: no burnout-to-illness spiral, no divorce, no family guilt.

## 3. Plan for `/`, section by section (PASTOR)

The salesman's six steps run under PASTOR: qualify (hero), diagnose (problem, villains), present (story, five Ws, transformation), prove (before/after, live numbers), handle objections (offer, FAQ), ask (response). Each section ends on a one-line bridge into the next.

| Section | Job | Framework | Current copy: keep / fix |
|---|---|---|---|
| **Hero** | Qualify the reader, name the desire, show the mechanism, give one action | Triple function (select, promise, capture); desire headline + vehicle subhead; Johnson box (what it is, free, button on the first phone screen) | Keep "Grow your work without losing your life": it is the big idea in one line. Keep the eyebrow "For creators who want a full life, not just a full feed", but widen it to freelancers and students. **Fix** "Free to start: an email and a password, nothing else": it is false, because sign-up also asks for a phone number and a date of birth. **Fix** the second button "#story": make it a quiet link. Only "Start free" is solid. |
| **Problem** | Name the pain in their words, say it isn't their fault | P-A-S + justification; SPIN situation ("If you...") | Keep "The work grows. The rest of your life slips." Add one line that takes the blame off them: "It isn't you. It's the setup." |
| **Amplify (villains)** | Five concept enemies, each with one true cost | Villain card (name, what it does, what it costs); self-check ("Which of these sounds like your week?") | The lines are good and in the reader's voice ("one more video, one more hour", "Brands want views; you want rent"). Keep them. **Fix** "Left alone, they win": it ends on pain. Add a bridge: "Each one has a fix. The setup chat asks which ones you face." |
| **Story** | The reader is the hero; Bumling and the seven are guides | Epiphany bridge in second person (old belief, small discovery, new belief); story lead with a bridge; break the vehicle, internal and external false beliefs | Keep "You are the hero. Every hero needs a guide." and the guide pills with roles. Keep the three steps. Add one short second-person scene ("Monday. You open the Daily tab...") showing a tick climbing the pyramid. No numbers in the story. |
| **Five Ws** | Introduce it to someone who knows tools like it | Short facts, one per W; a self-qualifying "for you if / not for you if" | Good. **Fix** "Where": say "nothing to install" only because it's a web app you can add to your home screen. Add the "not for you if you want a plain calendar" line. |
| **Transformation (how each villain is beaten)** | One answer per villain, with the apps that do it | Offer stack (obstacle → app → rule); feature → mechanism → benefit | The structure is right. **Fix** "your own shop with fair fees": "fair" is an opinion, so state the fee (5% of each sale, from `feeBps`). **Fix** "More ways to earn": write the rule instead ("Win pays per verified view, after a reviewer checks"). Each app chip links to its feature page, which delivers what the line promised. |
| **Before / after + live numbers** | Make the change visible; give the only social proof we have | Before/after recap; progression ("Today... Sunday... in three months..."); live-number line | Keep the lists. "Up at three in the morning, editing again" is vivid, so keep it. Keep the four live stats, rendered only when the API answers. Label them "Live from the app", never round them, and hide a tile at zero. Add the real cadence line: today a tick, Sunday a week review, each quarter a quarter review. |
| **Offer** | Value first, then price, then the one paid thing, then the step | Value before price; honest reason why it's free; risk reversal box | Keep "Free to start. Free to stay." **Fix**: name *every* cost in plain words. Typing to the AI assistant needs a plan (none is on sale yet, and nothing is charged), and the Shop takes 5% of each sale. Today the pricing card lists the fee but not the plans, while `/` names the plan but not the fee, so the two pages must agree. Add "You can always: switch any app off, export, erase or delete from the Profile tab." |
| **Brands** | A separate reader, product aware | Brand line: what they pay for + the rule that protects them; soft CTA | **Fix** the "Start free" button here: brands need their own action ("Post a brief"). Lead with "Pay for views that are checked, not claimed." Make no promise of reach or return. **Check** the contact address on the pricing page (`brandingbum@gmail.com`) against the product name rule before it is shown again. |
| **FAQ** | Answer the ten objections (section 6) | Accept the worry, answer it, point to a next step; 40 to 90 words each | It pulls from `HELP_FAQ`, which is app help, not buyer doubts. Give the site its own list, most common first. |
| **Response** | One next step | Window-of-change CTA; command + where it goes + ease; respectful close | "The villains have had enough time. Your turn." is fine. Under the button add the three true next steps (three questions, apps switched on, first tick today) and the no-pressure exit: "If it isn't for you, delete your account from the Profile tab." |

`/features`: a problem-solution lead in four short paragraphs, then the groups. Each group opens with one line of what it does for you, with the strongest app first. `/7rp`: lead each relationship with its desire ("Keep your friends close"), then the apps, strongest first.

Feature pages run in this order: tagline, pitch, three steps, two or three app questions, "Start free". Fixes from the current `FEATURES`:
- `win` "we track the numbers" should become "views are checked, then a reviewer confirms".
- `circles` must keep only what the matching really does.
- `tower` "You never fill in a form" is fine.
- Taglines that are only feature lists, such as "Posts, replies, likes. By topic." and "Followers, leads, broadcasts.", need to climb the drill.
- `shop` "Points move instantly; money follows when payments are connected" is honest, so keep it.

## 4. Formulas, with kreators.app examples

**Headline.** Use the desire, the twist or the question, scored on Useful, Unique and Ultra-specific (out of 30, aim for 22 or more). Write at least 16 before choosing.
- Desire + steps: "Seven relationships, one daily game. Check in, do one small act, tick one task."
- Twist: "Your work isn't what's falling behind. It's the six other relationships."
- Problem-aware question: "Still starting over every Monday? It isn't you."

**Subhead.** Add what the headline left out (how it works, or who it's for). Never repeat it.
- "Each pillar is a pyramid. Tick today's task and it climbs to the reason you started. Switch on School, Work, Win or Shop when you need them."

**Bullets.** Each one carries a benefit, a specific, a feeling and a product rule as proof. Mix straight benefits (about half) with a reverse hook, a mistake bullet and a shortcut bullet.
- Straight: "Get paid for views that are checked, not claimed (Win)."
- Reverse hook: "Why one task a day moves more than a list of twenty."
- Mistake: "The mistake that keeps a plan on paper: a task with no day. Here a dated task can only be ticked on its day."

**Feature tagline.** Drill level 3 to 4 (feeling or life), one idea, 8 words or fewer.
- Circles: "Five strangers who fit. One table."
- Win: "Get paid for views that are real."

**Pitch.** Desire, then the app, then how, then the rule that keeps it fair. Two or three sentences.
- "You want people in your corner. Circles seats you with five people near you who fit. Everyone uses an alias, and names are shared only if you both say yes."

**Steps.** Verb first, levels 1 to 2, one rule each, and step 3 is the person's own result.
- Win: "1. Pick a reward and read the brief. 2. Post and submit the public link. 3. Once views are checked, points land in your balance."

**CTA.** A command, where it goes, and an ease or benefit line. The button is always "Start free" (or "Go to app" with a session).
- "Start free. Answer three questions and we switch on the apps that fit you."
- Brands: "Post a brief."

**Bridge lines.** "Here's the good news: each one has a fix." / "You might be asking who this is for." / "So what does it cost?" / "Now, the one next step."

## 5. Honest proof

The rule: claim size matches proof size. With no testimonials, keep claims small and mechanical, so the product itself proves them.

**Allowed**
- **Demonstration.** Real screens of the Daily tab, a tick climbing the pyramid (`Pyramid`), a review next to the period before, and the three steps shown as screens. This is our strongest tier.
- **Mechanism.** The pyramid explained in two sentences, and the three daily moves.
- **Specifics from constants.** Seven pillars, six layers, three questions (four if you make things), up to five apps picked for you (`SETUP_APPS_MAX`), up to seven not to do items (`MAX_NOT_TO_DO`), five at a circle table, a wake time that moves thirty minutes a week, 18 and over (`MIN_AGE`), a small act of two minutes for fifteen xp, a fourteen-day Getting started list, a Shop fee of 5%, and plans at US$15, US$125 and US$500 for 30 days. Import each number from shared where you can, and never type it by hand.
- **Live numbers.** Members, events coming, opportunities open and points paid out, exactly as `publicApi.stats` returns them. They are labelled live, hidden on error or at zero, and never put inside the story.
- **Rules the code keeps, said plainly.** Your journal and wellbeing never reach brands, staff, the leaderboard or Club. A coach sees only what you switch on, never the journal. Everything that pays out has a wait or a reviewer. Win pays only for checked views. No self-reported run ever pays. A reward's pool never drops under what was already paid. Partner links are labelled. On pre-owned gear Kreators takes nothing and never moves the money. Nobody under 18 gets an account. Link each one to Help, "How you earn" or the policy.
- **True risk reversal.** Free to start and free to stay, no card, switch any app off, export, erase or delete from the Profile tab. Repeat it near the hero button, in the offer, in the FAQ and at the final button.
- **Honest limits.** One to three of them: the assistant needs a plan, payments aren't live, and the Store never moves money between people.

**Banned**
- Testimonials, quotes, case studies, personas, composites and placeholder names.
- Ratings, stars, review counts, download counts, "thousands", percentages and outcome claims ("members earn more").
- Logos, "as seen in", borrowed experts and outside studies or benchmarks.
- Countdowns, spot counts, price rises, deadlines and "value" stacks.
- Real-time tickers ("12 people viewing").
- Income, follower or time-to-result promises.

The slot for a real quote stays empty until a real member, asked at a win moment, approves the edited text and agrees to be named. Even then it never goes on `/`.

## 6. Objections, and where each is answered

Answer each one in the body where the doubt comes up. Then the FAQ repeats the top ones, most common first.

| Objection (their words) | Answer | Where |
|---|---|---|
| "What's the catch?" | Free to start and free to stay. Typing to the AI assistant needs a plan because the model costs money, and plans aren't on sale yet. The Shop takes 5% of a sale. Store partner links may earn us a share, and the card says so. | Hero sub-line, Offer, FAQ 1 |
| "I don't have time for another app." | Three moves a day: check in, one small act, one task. If you can tick a box, you can play. | Story, Five Ws (When), FAQ 2 |
| "Who sees my journal?" | Only you. Never brands, staff, the leaderboard or Club. The assistant reads it only when you ask, and only through models that keep nothing. | Transformation (Drift), FAQ 3 |
| "I'm not a creator." | The daily game is for anyone 18 or over. The creator apps are optional. | Hero eyebrow, Five Ws (Who), FAQ 4 |
| "Apps like this never stick." | It wasn't you. Most track one thing and forget the other six. Here each tick climbs a pillar you chose. | Problem, Story, FAQ 5 |
| "Too many apps." | Only a few are on to start. Setup picks up to five more that fit, and any of them can be switched off. | Transformation (Scatter), FAQ 6 |
| "Is the pay real?" | Fair question. Views are checked before they pay, tasks have to wait, and a person reviews payouts. Win pays per verified view, not per follower count. | Transformation (Squeeze), Brands, FAQ 7 |
| "Will I be on my own?" | Bumling and the seven guides, "How it works" on every screen, Help, and a life coach if you want one. | Story, FAQ 8 |
| "Can I leave?" | Export everything, erase your progress, or delete your account from the Profile tab. | Offer, Response, FAQ 9 |
| "Why do you want my phone and birthday?" | So everyone here is 18 or over. Neither is ever shown to anyone. | Next to every sign-up, FAQ 10 |
| "Later." | Answer it with how small the first step is and the daily rhythm ("Today counts once you tick it"), never with guilt. | Response |

## 7. Reviewer checklist (pass or fail, for every string)

Any fail in A blocks publishing.

**A. Honesty gate**
- [ ] Each claim maps to a route, rule or constant that exists today.
- [ ] Each number is a shared constant or a live API value, shown exactly.
- [ ] No testimonial, quote, persona, rating, count claim, percentage, logo or "as seen in".
- [ ] No deadline, countdown, scarcity, value stack, crossed-out price or income promise.
- [ ] Wherever "free" appears, the paid parts (assistant plan, Shop fee) are named nearby, and the pricing card and `/` agree.
- [ ] Plans are shown only as US$15 / US$125 / US$500 for 30 days, credits don't carry over, and "not on sale yet" is said while `PAYMENTS_LIVE` is false.
- [ ] No rival app, brand or person is named or attacked.

**B. Words**
- [ ] Flesch 60 or above on each file. Headlines are 12 words or fewer, paragraphs 3 sentences or fewer.
- [ ] `kreators.app` is lowercase with the dot. The fixed words are used and no banned word appears.
- [ ] No hype words, no caps for emphasis, no "!!!".
- [ ] Each new product word is explained once. Each character has their role the first time.
- [ ] Each claim or ask has a true "because", "so" or "to".

**C. Structure**
- [ ] Hero: says who it's for, the desire, the mechanism, and one solid button on the first phone screen. Its 3-U score is written in the log.
- [ ] Problem and villains: no blame on the reader, one cost per villain, and a hopeful bridge within one scroll.
- [ ] Story: second person, the reader is the hero, no numbers, and one line each against the vehicle, internal and external beliefs.
- [ ] Each villain is matched to named apps, and each app chip's page delivers what the line promised.
- [ ] Live numbers sit in their own block, labelled live, hidden at zero or on error.
- [ ] Offer runs: value, then price, then the paid parts, then the risk reversal, then one button.
- [ ] FAQ: all ten objections covered, each answer 40 to 90 words, accepting the worry before answering it.
- [ ] The touchstone appears word for word in the hero, the offer and the final CTA.
- [ ] "Start free" goes to Welcome on `/` and on each feature page. Brands have their own action.
- [ ] Feature page: the tagline is at drill level 3 to 4, the steps at level 1 to 2, and the tagline is not a feature list.
- [ ] No sideways scroll at phone width, and the overflow probe returns 0 hits.

**D. Testing**
- [ ] One change ships at a time, judged by Start free clicks that turn into a finished setup chat, with a line in `docs/DECISIONS.md`.

## 8. Conflicts: CopyOS advice we don't follow

- **Invented proof** (the "realistic composite" testimonial, "2,400+ downloads", "47 companies", odd numbers "for believability"). It is banned. Use rules, demonstration and live counts instead.
- **Urgency and scarcity** (Ladeira's seven types, the "Urgent" U, deadlines, spots, price rises). A free app has no true deadline. Urgency comes only from "today" in the game. Real event times (a run code that opens thirty minutes before) stay on their own app pages as rules.
- **Value stacks, anchors and price-reveal theatre** ("Total value ₹X", "not ₹5,000... just..."). We state the real prices once, flat.
- **Guarantees with refunds or penalties.** There is nothing to refund and no outcome we can promise. Our risk reversal is free, export, erase and delete.
- **Income and identity fantasies at drill levels 4 to 5** ("₹1 lakh a month"). We keep identity ("someone who keeps their word") and drop money and follower figures.
- **Conspiracy and Discovery big ideas, borrowed authority and logos.** We have no study and no enemy company. Authority comes from the rules the code keeps and a clean page.
- **Fear future-pacing** (burnout, illness, divorce, regret) and the 60 to 70% loss frame in Doc 10, Part V. We follow its Part VI positive majority instead, because the audience comes for wellbeing.
- **Long form** (28-step letters, 6,000 to 12,000 words, a P.S.). We keep the order and drop the length. Each section runs 40 to 120 words.
- **Curiosity bullets that hide the payoff** ("page 47"). We name the mechanism. A tease is allowed only when the linked page delivers exactly what it promised.
- **Hiding the button until the value is shown, and no-exit funnels.** The button shows early and repeats after each reason. The three-page nav and "Go to app" stay.
- **Flattery, false "just for you", and Langer's "any reason works".** We use a shared situation instead, and every "because" is true.
- **The docs' conversion benchmarks** are unsourced: internal hints only. Call Masterson's "4 Pillars" his "four parts" so the word never leaks into site copy.
