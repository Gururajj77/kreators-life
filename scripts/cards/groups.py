"""The FunFlow 'Group Night' deck: easy, low-stakes party-game cards for bigger groups (4 to 10 or more), built on the
mechanics (never the wording) of well-known improv game formats. Original text in the app's own house voice. Alcohol-neutral
on purpose: no card assumes, requires or rewards drinking, since this app is for wellbeing and relationships.

    python3 scripts/cards/groups.py groups.json
    python3 scripts/cards/seed.py groups.json apps/api/migrations/0068_card_games_groups.sql --incremental
"""
import json, sys

def c(title, text, list=None):
    card = {"title": title, "text": text}
    if list:
        card["list"] = list
    return card

cards = [
    # Freeze: tap someone out of a frozen pose and start a new beat from it.
    c("Freeze Frame", "Two people act out a little moment. Anyone watching can call Freeze, tap one of them on the shoulder, copy their exact pose, and start a brand new scene from right there.",
      ["Two people arguing over the last slice of pizza", "A photographer directing an awkward photo", "Someone trying to parallel park"]),
    c("Statue Swap", "Everyone freezes in a pose when the timer goes off. The next player walks up, takes over one person's exact pose, and leads the group into a completely different scene.",
      ["A team huddle before a big match", "A family posing for a photo", "A queue that has been waiting far too long"]),
    c("Opposite Freeze", "Play out a short moment together. The instant someone calls Freeze, the next player steps into the same pose but plays the exact opposite mood: calm becomes panicked, proud becomes embarrassed."),
    c("Freeze on the Word", "Pick a word before you start, like \"actually\" or \"wait\". The instant someone says it, call Freeze, tap them out, and begin a new scene from their pose."),
    c("Machine Freeze", "The whole group becomes one slow, moving machine, each person adding a small repeating motion. On Freeze, swap any two people's spots and switch the machine on again."),
    c("Freeze and Confess", "Act out an everyday moment. When someone calls Freeze, the frozen player says one true, small thing about themselves before the next player takes their pose and runs with it."),
    # Questions Only: reply only in questions until someone slips.
    c("Twenty Questions, Zero Answers", "Two players have a conversation using only questions. The first person to answer, state a fact, or go quiet for too long is out."),
    c("Interview, Questions Only", "One player is interviewed about their day, their dream job or their last trip. Both the interviewer and the guest may only speak in questions."),
    c("The Waiter Who Only Asks", "Act out ordering food at a restaurant, but the customer and the waiter can only ever reply with a question."),
    c("Question Tag", "Stand in a circle. Ask the person next to you a question. They answer with a new question aimed at someone else, and so on, as fast as you can keep it going."),
    c("A Small Disagreement, Questions Only", "Two players argue about something small, like whose turn it is to pick the music, using nothing but questions, getting more dramatic each round."),
    c("The Check-Up, Questions Only", "Act out a visit to the doctor's. Patient and doctor can only speak in questions, however confusing that gets."),
    # Letter chain: each line starts with the next letter of the alphabet.
    c("Story, A to Z", "Tell a group story one sentence at a time. Each new sentence must start with the next letter of the alphabet, starting from A."),
    c("Introductions, A to Z", "Go around the circle. Each person says their name plus one fact about themselves, starting with the next letter of the alphabet."),
    c("Excuses, A to Z", "Take turns giving an excuse for being late, each one starting with the next letter of the alphabet. The silliest excuse wins the round."),
    c("Compliments, A to Z", "Go around the group giving the person next to you a compliment that starts with the next letter of the alphabet."),
    c("Shopping List, A to Z", "Build a shopping list together out loud. Each new item starts with the next letter of the alphabet, and everyone repeats the whole list so far before adding theirs."),
    c("Weekend Plans, Z to A", "Hold a short conversation about your weekend plans where each line starts with the next letter of the alphabet, going backward from Z to A."),
    # Scenes from a hat: build a moment from a drawn prompt.
    c("Scene from a Hat: The Place", "Write a place on a scrap of paper (a waiting room, a spaceship, a wedding). Draw one, and two players set a scene there without saying the place out loud."),
    c("Scene from a Hat: The Problem", "Write a small problem on a scrap of paper (the Wi-Fi is down, someone forgot the cake). Draw one and act out how the group solves it."),
    c("Scene from a Hat: The Relationship", "Write a pair of people on a scrap of paper (two rivals, old school friends, a boss and a new hire). Draw one and play out their first thirty seconds together."),
    c("Scene from a Hat: The Object", "Write down an everyday object. Draw one and build a whole scene around someone who is completely obsessed with it."),
    c("Scene from a Hat: The Strange Event", "Write a strange little event on a scrap of paper (the lights keep flickering, a shoe has gone missing). Draw one and improvise how the group reacts."),
    c("Scene from a Hat: The Job", "Write down an unusual job (a professional apologiser, a cloud namer). Draw one and act out their first day at work."),
    # Yes, And: always accept and build on the last person's idea.
    c("Yes, And: Build the Trip", "One person starts planning an imaginary trip. Everyone else can only add to it with \"Yes, and...\", never shutting an idea down."),
    c("Yes, And: Build the Business", "Someone pitches a ridiculous business idea. The rest of the group can only reply with \"Yes, and...\" to grow it, however strange it gets."),
    c("Yes, And: Build the Excuse", "One player starts an excuse for being late. Each person adds to it with \"Yes, and...\" until the excuse is completely out of hand."),
    c("Yes, And: Build the Party", "Someone describes a party they are throwing. Everyone else keeps adding details with \"Yes, and...\", making it stranger each round."),
    c("Yes, And: Build the Gift", "One player describes a gift they are giving someone in the group. The rest keep adding to it with \"Yes, and...\" until it is the strangest gift ever."),
    c("Yes, And: Build the Rumor", "Start a harmless, obviously made-up rumor about a made-up person. Everyone else builds on it with \"Yes, and...\", each making it more over the top."),
    # World's Worst: take turns giving the worst possible version of something.
    c("World's Worst First Date Line", "Take turns giving the worst possible thing to say on a first date. The group decides who wins the title."),
    c("World's Worst Way to Explain a Lesson", "Take turns acting out the worst possible way to explain a simple lesson to a class."),
    c("World's Worst Tour Guide Fact", "Take turns giving the worst possible one-line fact about a famous landmark."),
    c("World's Worst Thing a Waiter Could Say", "Take turns giving the worst possible thing a waiter could say while taking an order."),
    c("World's Worst Way to Hand Someone a Gift", "Take turns acting out the worst possible way to hand someone a gift."),
    c("World's Worst Wedding Speech Opener", "Take turns giving the worst possible opening line for a wedding speech."),
    # One Word Story: build a story one word at a time around the circle.
    c("One Word Story: A Holiday", "Tell the story of an imaginary holiday, one word at a time, going around the circle. Keep it moving; nobody plans ahead."),
    c("One Word Story: A Rescue", "Tell the story of a daring rescue, one word per person, around the circle, as fast as you can."),
    c("One Word Story: The New Pet", "Tell the story of someone bringing home a very unusual new pet, one word at a time around the group."),
    c("One Word Story: The Lost Phone", "Tell the story of a phone that goes missing and everything that happens trying to find it, one word at a time."),
    c("One Word Story: The Wrong Party", "Tell the story of someone who walks into the wrong party by mistake, one word at a time around the circle."),
    c("One Word Story: The Time Machine", "Tell the story of a homemade time machine that almost works, one word per person, around the group."),
    # Props: mime an everyday object as something else, group guesses.
    c("What Is This, Really?", "Pick up any object in the room and mime using it as something completely different. The group calls out guesses until someone gets it."),
    c("Prop Relay", "Mime using an object as one thing, then pass it to the next person, who must mime it as something else entirely."),
    c("The Object's Secret Life", "Mime an everyday object coming alive with its own tiny personality, no words allowed, until the group names it."),
    c("Mystery Tool", "Mime inventing a brand-new gadget out of an everyday object, and let the group guess what problem it solves."),
    c("Not What It Looks Like", "Pick an object and mime the single strangest possible use for it. The first correct guess passes the object on."),
    c("Shrink or Grow", "Mime an everyday object as if it were either giant-sized or tiny, and let the group guess both the object and its new size."),
    # Emotional Rollercoaster: replay a moment while someone calls out a new mood each time.
    c("Rollercoaster: The Apology", "Replay a short apology scene. Someone outside the scene calls out a new mood every few seconds, like smug, heartbroken or thrilled, and the players switch instantly."),
    c("Rollercoaster: The Phone Call", "Act out answering a phone call. Someone calls out a new mood every few seconds and the caller's whole tone has to flip right away."),
    c("Rollercoaster: The Surprise", "Replay someone opening a surprise gift. A caller shouts a new mood every few seconds, from bored to thrilled to suspicious."),
    c("Rollercoaster: The Goodbye", "Act out saying goodbye at the door. Someone calls out a new mood every few seconds, and the goodbye has to match it instantly."),
    c("Rollercoaster: The Interview Answer", "Replay one answer from a job interview. A caller shouts a new mood every few seconds, from nervous to overconfident to sleepy."),
    c("Rollercoaster: The Toast", "Give a short toast at an imaginary celebration. Someone calls out a new mood every few seconds and the toast has to shift with it."),
]

data = {
    "funflow": {
        "key": "funflow",
        "decks": [
            {
                "key": "groupnight",
                "name": "Group Night",
                "hint": "Best for 4 to 10 or more",
                "position": 4,
                "cards": cards,
            }
        ],
    }
}

if len(sys.argv) > 1:
    json.dump(data, open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
    print(len(cards), "cards")
else:
    print(len(cards), "cards (pass an output path to write the JSON)")
