# The assistant, plans and credits

Riya has a long day of edits. She wants to log her sleep, add a task to a pyramid and note a payment, without opening three apps. Bumling, the app's own guide, does it for her from one panel.

In this lesson you'll learn:

- What the assistant does for free and what needs a plan.
- How Riya picks a plan, reads her credits and undoes a change.
- How models and privacy work.
- How an admin starts a plan or adds credits.

## Open the assistant

The assistant is a round button with Bumling in it, at the bottom right of every screen in the app. On a phone it sits above the tab bar.

1. Riya taps the button.
2. A panel opens called **Bumling AI assistant**.
3. The page under it stays in view and updates as things change.

Close folds the panel back into the button and keeps the chat.

## The free half: flows

Flows are short forms that cost nothing. They write through the same steps a tap on a screen uses. Each one says where its answer lands.

Some of them:

- **Check in for today** and **Mark the small act done**, which land on the Daily tab.
- **Add to a pyramid**, which lands on that pillar in Pillars.
- **Mark my not to do list** and **Add to my not to do list**.
- **Log my sleep**, **Log my stress** and **Log mindful minutes**.
- **Add money in or out** and **Note money owed**, when Finance is on.
- **Write a review**, when Reviews is on.

A flow is hidden while its app is off. The screen under the panel picks the first few.

## The paid half: typing

Typing what you want, like "move my edit task to Friday", needs a plan.

1. Riya types a line in the box at the bottom.
2. Bumling does it in the app as Riya, with the same rules as her own taps.
3. Each change comes back as a row with **Undo**.
4. Removing something, or settling money owed, waits for her to tap **Confirm** or **Cancel**.
5. While it works, the send arrow turns into a **Stop** square. What was done before the stop stays, each with Undo.

Each reply says **Answered by** and the model's name, so it is never mixed up with a built-in line.

Without a plan, she can still ask what a word means, like "what is a layer?". Anything else shows the plan card.

## Models and privacy

When a model is connected on the server, a model picker shows under the panel's header. The list holds free models that can use the app's tools.

- **A free model costs no credits**, but typing still needs a plan.
- **Some models keep nothing.** Only with one of those can the assistant read the journal and the trackers.
- **The journal is read only when asked.** The assistant reads it only when Riya asks about it.

The panel says under the picker what the chosen model may read.

## Pick a plan

1. Riya opens the Profile tab and taps **Plans and credits**.
2. She sees her **Plan** and what she **Used today**.
3. Under **Plans** she reads the three plans, all in rupees, each for 30 days:

- **Pro:** ₹1,499 for 10,000 credits.
- **Pro Max:** ₹12,499 for 100,000 credits.
- **Ultra:** ₹49,999 for 400,000 credits.

Plan credits that are left at the end do not carry over.

Under **Top up** are extra credits: ₹899 for 8,000, ₹2,299 for 20,000 and ₹4,499 for 40,000. They are used after the plan's own and stay until used.

Payments are not live yet. Picking a plan or a top-up charges nothing, and the page says so. Until payments are live, the team switches plans on.

## Read the credits

- **One credit** is a tenth of a US cent of model use, worked out from the words the model read and wrote.
- **Credits used** shows each day for the last thirty days.
- **Limits by plan** shows what each agent may read and spend, with Riya's column marked.
- **History** lists every credit in and out, newest first.

The Companion uses the same plan and credits. Without a plan, or once credits run out, it still answers free in its built-in way.

## What an admin does

You start plans by hand until payments are live.

1. Open Admin, then the **People** tab.
2. Search for Riya and tap her row.
3. Under **Plan and credits**, pick a plan and the number of days, then tap **Start**.
4. To add extra credits, type the number and tap **Add credits**. Add a line under "Why, for the history" if you like.
5. To end a plan, pick **No plan** and tap **End plan**. A sheet asks first. Plan credits go; extra credits stay.

You can also tick several rows and use **Start Pro** or **End plan** for all of them. Every change is written to the audit log.

## What an admin checks

- **The model key:** the model is set on the server. Until it is, the picker does not show.
- **The switch:** the assistant is on for everyone. The team can switch it off under Flags.
- **Its records:** the assistant keeps tool names, ids and short labels for Undo, never journal text.

> **Pro tip:** when you start a plan for a tester, add a few extra credits with a note. The note shows in their History, so they know where it came from.

> **Result:** Riya logs, plans and fixes things by typing one line, and every change has an Undo.

## The bottom line

The flows are free for everyone. Typing needs a plan, and credits pay for the model. Until payments go live, plans start from Admin, People, and every change you make there is in the audit log.
