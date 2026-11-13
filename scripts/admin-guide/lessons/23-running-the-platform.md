# Running the platform

Riya never sees most of what keeps the app running. She sees an app appear, a page that loads, and a privacy card that asks once. Behind that, the team decides what is live, watches for trouble and keeps her data where it belongs.

In this lesson you'll learn:

- How to switch an app on for everyone, a share of people or one person.
- How to read Dev Tools, the build map and the Logs.
- Your duties for privacy: the privacy card, data requests and the Grievance Officer.
- What must never reach staff.

## Feature flags

Every app is a module with a switch the team controls. A person's own Hide and Show is only a preference. If the team switches an app off, the server refuses it, not only the screen.

1. Open Admin and the **Flags** tab. The heading is **Feature flags**.
2. Each app is a row: **Module, Group, On, Minimum role, Rollout % and Overrides**.
3. Turn **On** off to hide an app for everyone.
4. Set **Minimum role** so only staff or admins can open it.
5. Set **Rollout %** to show it to a steady share of people.

A change takes a few seconds to reach everyone.

## Try an app with Riya first

Say the team wants to test Run with a small group before everyone gets it.

1. Set Run's **Rollout %** to 10.
2. Tap **Add override** on Run's row.
3. Under **For**, pick **One person (user id)** and paste Riya's id.
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
- **People:** accounts, newest first. Only an admin changes a role from a row's menu, and a sheet asks first.

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

Every admin's inbox hears about bursts of failed sign-ins, too many requests, server errors and role changes, under the **Team** tab. Each kind comes at most once an hour. Each new note also goes out as one private email, with counts only. Until mail is set up on the server, the note says the inbox is the only alert. A copyright notice from the public site lands there too.

The shared admin key has a limit of its own: ten tries in ten minutes from one address. Past that, even the right key waits. A signed-in admin is never counted.

## The privacy card

A visitor and a new member see a small card called **Your privacy**. It asks once about three things: the tracked-link cookie, videos from YouTube and Vimeo, and marketing email.

- **All three start off.** **Reject all** and **Accept all** are equal, side by side.
- **Choose for each** opens the three switches.
- **Riya changes them any time** on the Profile tab, under **Privacy choices**. The footer's **Privacy choices** button brings the card back.

If a browser sends Global Privacy Control, the tracked-link cookie is never set, even after an earlier yes. Marketing email goes only with a recorded yes.

## Data requests

Riya owns her data. On the Profile tab, **Your data** holds **Export my data**, **Erase everything** and **Delete my account**.

- **Each one asks first** in a sheet.
- **Each request is logged without a name.** Those rows are kept for three years.
- **You never do it for her by hand.** If she writes in, point her to that row. Deleting an account from Admin, People is the same delete.

## The Grievance Officer

India's privacy law asks for a named person to take complaints. The business's details, the Grievance Officer's name and email among them, are set on the server by whoever deploys the app. They are never typed into the code.

1. Open the public **Contact** page.
2. Check that the Grievance Officer's name and email show.
3. If a field says "not set yet", ask whoever deploys to set it before launch.

The privacy card points questions to that officer. Never state a reply time unless the business sets one. Never claim a certification, a compliance label or an uptime number in any copy.

## What never reaches staff

- **The journal and wellbeing:** never to brands, staff, the leaderboard or Club selection.
- **Discover answers and results:** only the owner sees them.
- **The Companion's chats:** private to the person.
- **The Finance app:** private to the person, but a super admin can read its tables from Admin, **People**, **Tables**, read only, with each one in the audit log.
- **Fitness and supplements:** private to the person.
- **Agency clients, fees and notes:** owner only.
- **A life coach:** sees only what the student switched on: the six parts, and whole tables one by one, read only. The journal and supplements reach a coach only that way.

> **Pro tip:** before you switch an app on for everyone, look at its card on the build map. If it says it needs a key, set the key first.

> **Result:** Riya gets new apps when they are ready, her choices stick, and her private things stay private.

## The bottom line

Flags decide what is live. Dev Tools and Logs show what is happening. Privacy is a duty, not a setting: check the Contact page, let people manage their own data, and never look where staff do not belong.
