-- More cards inside the games people already have (2026-11-03). INSERTs only, each deck going on after its own last card,
-- so nothing seeded by 0042 or fixed by 0068 moves. Every line is written for the app in each deck's own voice: easy,
-- for two to ten people, alcohol-neutral (no card needs, assumes or rewards drinking), and never making fun of an accent,
-- a body or a group. FunFlow gets twelve more per deck (Group Night stays as it is), HealFlow eight per deck, The
-- Relationship Method Challenge seven per pillar (the same "Daily ..." shape with the minutes in the text), WorkFlow ten
-- each in Truth or Truth and Two Truths and a Lie, and DateFlow Connect eight per deck, each with its This and its That.
-- ShadowFlow, DateGuru (52 is the deck), Roast or Flirt and Ulta Seedha are left alone.

-- funflow / endorphins
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('funflow', 'endorphins', 13, 'Slow-Motion Replay', NULL, 'Act out something from today in slow motion. The others call it like the last over of a cricket final.', '["Waking up to the alarm", "Catching a bus just in time", "Opening the fridge for a snack", "Finding your keys", "Sending a text you were nervous about"]', NULL, NULL),
  ('funflow', 'endorphins', 14, 'Straight Face', NULL, 'One player pulls silly faces without a sound. The first person to laugh takes over.', NULL, NULL, NULL),
  ('funflow', 'endorphins', 15, 'Invisible Ball', NULL, 'Toss an imaginary ball round the circle. Whoever catches it changes how big or heavy it is, then throws it on.', NULL, NULL, NULL),
  ('funflow', 'endorphins', 16, 'Hum and Guess', NULL, 'Hum a song with your mouth closed. The others guess it. Fewer notes win more points.', NULL, NULL, NULL),
  ('funflow', 'endorphins', 17, 'Laugh Ladder', NULL, 'Start with a tiny giggle. Each person laughs a little bigger than the last, until the whole room is laughing.', NULL, NULL, NULL),
  ('funflow', 'endorphins', 18, 'Weather Dance', NULL, 'Someone calls out the weather. Everyone dances like it.', '["Light rain", "A thunderstorm", "A hot summer day", "A windy evening", "Snow falling slowly", "A rainbow after the rain"]', NULL, NULL),
  ('funflow', 'endorphins', 19, 'Shake It Off', NULL, 'Shake each arm and each leg eight times, then seven, then six, down to one. Go faster each round.', NULL, NULL, NULL),
  ('funflow', 'endorphins', 20, 'Freeze Dance', NULL, 'Play a song and dance. When the music stops, freeze in a funny shape. The first to move picks the next song.', NULL, NULL, NULL),
  ('funflow', 'endorphins', 21, 'Keep It Up', NULL, 'Keep a balloon or a rolled-up sock in the air together without letting it touch the floor. Count the taps.', NULL, NULL, NULL),
  ('funflow', 'endorphins', 22, 'Fake Laugh Contest', NULL, 'Each player does their best fake laugh. The one who makes the others laugh for real wins.', NULL, NULL, NULL),
  ('funflow', 'endorphins', 23, 'Animal Walk', NULL, 'Cross the room moving like the animal someone names.', '["A crab", "A frog", "A penguin", "An elephant", "A flamingo", "A sloth", "A kangaroo"]', NULL, NULL),
  ('funflow', 'endorphins', 24, 'Tiny Talk Show', NULL, 'One player hosts a talk show. The guest is a world champion of something silly, like folding socks. Ask them three questions.', NULL, NULL, NULL);
-- funflow / oxytocin
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('funflow', 'oxytocin', 14, 'Back-to-Back Drawing', NULL, 'Sit back to back. One person describes a simple picture. The other draws it without looking. Then compare.', NULL, NULL, NULL),
  ('funflow', 'oxytocin', 15, 'Same Answer', NULL, 'Read a prompt. Both of you write an answer in secret, then show them. Score a point when they match.', '["A colour that feels happy", "A food for a rainy day", "A place for a first trip together", "A song everyone knows", "A word for this week", "A smell from childhood", "Something you always forget", "The best time of day"]', NULL, NULL),
  ('funflow', 'oxytocin', 16, 'Hand-Me-Down Story', NULL, 'Pick something you own that came from someone else. Tell its story and what it means to you.', NULL, NULL, NULL),
  ('funflow', 'oxytocin', 17, 'Three Good Things', NULL, 'Say three good things from your week. Your partner asks one question about any of them.', NULL, NULL, NULL),
  ('funflow', 'oxytocin', 18, 'Story of Your Name', NULL, 'Tell how you got your name, and one thing you like about it.', NULL, NULL, NULL),
  ('funflow', 'oxytocin', 19, 'Song for You', NULL, 'Pick a song for the other person and say why it fits them.', NULL, NULL, NULL),
  ('funflow', 'oxytocin', 20, 'Eye Contact Minute', NULL, 'Sit facing each other and hold eye contact for thirty seconds. Then each say one thing you noticed.', NULL, NULL, NULL),
  ('funflow', 'oxytocin', 21, 'Teach Me in Two Minutes', NULL, 'Teach the other person something you know well in two minutes. Then swap.', NULL, NULL, NULL),
  ('funflow', 'oxytocin', 22, 'Firsts', NULL, 'Share one of your firsts, and how it felt.', '["Your first friend", "Your first job", "Your first trip without family", "The first thing you cooked", "The first gift you bought someone"]', NULL, NULL),
  ('funflow', 'oxytocin', 23, 'Thank-You Round', NULL, 'Thank the person on your right for something real and specific. Keep going round.', NULL, NULL, NULL),
  ('funflow', 'oxytocin', 24, 'Dream Day Together', NULL, 'Plan a perfect day you would spend together, from breakfast to bedtime. Take turns adding one part.', NULL, NULL, NULL),
  ('funflow', 'oxytocin', 25, 'Highs and Lows', NULL, 'Share the best and the hardest moment of your week. The others listen and do not try to fix it.', NULL, NULL, NULL);
-- funflow / serotonin
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('funflow', 'serotonin', 13, 'Proud Minute', NULL, 'Talk for one minute about something you did this year that you are proud of. Listeners may only say "tell me more".', NULL, NULL, NULL),
  ('funflow', 'serotonin', 14, 'Strength Spotting', NULL, 'Name a strength you saw in the player on your left this week, and the moment you saw it.', NULL, NULL, NULL),
  ('funflow', 'serotonin', 15, 'Small Wins', NULL, 'Share three small wins from this week, however small they seem.', NULL, NULL, NULL),
  ('funflow', 'serotonin', 16, 'Future Me Postcard', NULL, 'Say the postcard your future self sends you one year from now. What do they thank you for?', NULL, NULL, NULL),
  ('funflow', 'serotonin', 17, 'Then and Now', NULL, 'Share something you could not do five years ago that you can do now.', NULL, NULL, NULL),
  ('funflow', 'serotonin', 18, 'Brag Swap', NULL, 'Tell your partner one thing you are proud of. They tell it back to the group, bragging about you.', NULL, NULL, NULL),
  ('funflow', 'serotonin', 19, 'Kind Words Back', NULL, 'Repeat a kind thing someone once said to you, and say how it made you feel.', NULL, NULL, NULL),
  ('funflow', 'serotonin', 20, 'Best Advice', NULL, 'Share the best advice you ever got, and whether you still use it.', NULL, NULL, NULL),
  ('funflow', 'serotonin', 21, 'My Happy List', NULL, 'Name five small things that always lift your mood. See which ones you share.', NULL, NULL, NULL),
  ('funflow', 'serotonin', 22, 'Superpower Talk', NULL, 'Name a real skill you are good at and call it your superpower. The others give it a hero name.', NULL, NULL, NULL),
  ('funflow', 'serotonin', 23, 'Good News Only', NULL, 'For two minutes, share only good news, from your life or from the world.', NULL, NULL, NULL),
  ('funflow', 'serotonin', 24, 'Hard Thing I Did', NULL, 'Share a hard thing you did anyway, and what helped you do it.', NULL, NULL, NULL);
-- funflow / dopamine
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('funflow', 'dopamine', 13, 'Category Sprint', NULL, 'You have thirty seconds. Name as many things as you can in the category. Beat the last score.', '["Things in a kitchen", "Animals that swim", "Words that rhyme with \"day\"", "Fruits", "Things that are round", "Sports", "Things you find in a bag", "Cities in India", "Things that make noise", "Colours"]', NULL, NULL),
  ('funflow', 'dopamine', 14, 'Spot the Change', NULL, 'Everyone closes their eyes. One player changes three small things in the room. The others find them.', NULL, NULL, NULL),
  ('funflow', 'dopamine', 15, 'Number Chain', NULL, 'Count round the circle. Say a word instead of every number you can divide by three. Miss it and start again.', NULL, NULL, NULL),
  ('funflow', 'dopamine', 16, 'Odd One Out', NULL, 'Say four words. Three belong together. The other player spots the odd one out and says why.', '["Apple, mango, carrot, banana", "Train, bus, plane, bicycle", "Red, blue, chair, green", "Cat, dog, rose, cow", "Piano, drum, guitar, spoon"]', NULL, NULL),
  ('funflow', 'dopamine', 17, 'Last Letter Chain', NULL, 'Say a word that starts with the last letter of the word before. You have three seconds.', NULL, NULL, NULL),
  ('funflow', 'dopamine', 18, 'Quick Maths Duel', NULL, 'One player calls out two small numbers to add. The first right answer wins a point. First to five wins.', NULL, NULL, NULL),
  ('funflow', 'dopamine', 19, 'Memory Tray', NULL, 'Put eight small things on a table. Look for twenty seconds, then cover them. Name as many as you can.', NULL, NULL, NULL),
  ('funflow', 'dopamine', 20, 'Clap Pattern', NULL, 'Clap a short rhythm. The other player claps it back. Add one clap each round until someone slips.', NULL, NULL, NULL),
  ('funflow', 'dopamine', 21, 'Word in a Word', NULL, 'Pick a long word. Find as many small words hidden in it as you can in one minute.', '["Celebration", "Friendship", "Adventure", "Breakfast", "Understanding", "Playground"]', NULL, NULL),
  ('funflow', 'dopamine', 22, 'Backwards Spelling', NULL, 'Spell a word backwards. The words get longer each round.', NULL, NULL, NULL),
  ('funflow', 'dopamine', 23, 'Hidden Object Hunt', NULL, 'One player hides a small thing in the room. The other finds it, helped only by "warmer" and "colder".', NULL, NULL, NULL),
  ('funflow', 'dopamine', 24, 'Guess the Price', NULL, 'Name an everyday thing. Everyone guesses what it costs. The closest guess wins the round.', NULL, NULL, NULL);
-- healflow / emotions
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('healflow', 'emotions', 10, 'Weather Report', NULL, 'Say how you feel today as a weather forecast. Sunny spells? A storm on the way? Others ask what caused it.', NULL, NULL, NULL),
  ('healflow', 'emotions', 11, 'Feeling Colours', NULL, 'Pick a colour for how you feel today. Say why you chose it.', NULL, NULL, NULL),
  ('healflow', 'emotions', 12, 'Body Clues', NULL, 'Pick a feeling and say where you feel it in your body. Worry in the tummy? Anger in the hands?', NULL, NULL, NULL),
  ('healflow', 'emotions', 13, 'Feeling Faces', NULL, 'Draw a face that shows how your day felt. The family guesses the feeling, then you tell the story.', NULL, NULL, NULL),
  ('healflow', 'emotions', 14, 'Big and Small Feelings', NULL, 'Share one big feeling and one small feeling from today. Both count.', NULL, NULL, NULL),
  ('healflow', 'emotions', 15, 'What Helps Me Calm Down', NULL, 'Each person shares one thing that helps when they are upset. Make a family calm-down list together.', NULL, NULL, NULL),
  ('healflow', 'emotions', 16, 'Feeling Thermometer', NULL, 'Rate how strong a feeling is from 1 to 10. Say what would move it one step lower.', NULL, NULL, NULL),
  ('healflow', 'emotions', 17, 'Find the Word', NULL, 'Share a time a feeling was hard to name. Together, find the best word for it.', NULL, NULL, NULL);
-- healflow / stories
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('healflow', 'stories', 10, 'How We Met', NULL, 'A parent or grandparent tells how they met someone important to them. The kids ask questions.', NULL, NULL, NULL),
  ('healflow', 'stories', 11, 'The Funniest Day', NULL, 'Tell the story of the day your family laughed the most.', NULL, NULL, NULL),
  ('healflow', 'stories', 12, 'Lost and Found', NULL, 'Share a story of something that was lost and then found. How did it feel to get it back?', NULL, NULL, NULL),
  ('healflow', 'stories', 13, 'When I Was Your Age', NULL, 'A grown-up shares a story from when they were the age of the youngest child in the room.', NULL, NULL, NULL),
  ('healflow', 'stories', 14, 'Family Recipe Story', NULL, 'Tell the story behind a dish your family cooks. Who made it first?', NULL, NULL, NULL),
  ('healflow', 'stories', 15, 'Kind Stranger', NULL, 'Share a time someone you did not know was kind to you.', NULL, NULL, NULL),
  ('healflow', 'stories', 16, 'Brave Moment', NULL, 'Share a time you were scared but did it anyway. What helped you?', NULL, NULL, NULL),
  ('healflow', 'stories', 17, 'Our Family Motto', NULL, 'Tell a story that shows what your family stands for. Then make up a family motto together.', NULL, NULL, NULL);
-- healflow / activities
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('healflow', 'activities', 12, 'Family Walk Talk', NULL, 'Go for a ten-minute walk together. Each person picks one thing to talk about.', NULL, NULL, NULL),
  ('healflow', 'activities', 13, 'Kind Notes', NULL, 'Write a kind note for a family member and hide it where they will find it tomorrow.', NULL, NULL, NULL),
  ('healflow', 'activities', 14, 'Chore Swap', NULL, 'Swap one chore for a day. Then share what you learned about each other.', NULL, NULL, NULL),
  ('healflow', 'activities', 15, 'Phone-Free Hour', NULL, 'Put every phone away for one hour and do something together.', NULL, NULL, NULL),
  ('healflow', 'activities', 16, 'Cook Together', NULL, 'Cook a simple dish together. Everyone gets one job, even the youngest.', NULL, NULL, NULL),
  ('healflow', 'activities', 17, 'Plant Something', NULL, 'Plant a seed together. Take turns caring for it, and talk about how it grows.', NULL, NULL, NULL),
  ('healflow', 'activities', 18, 'Saying Sorry Well', NULL, 'Practise a good sorry: what I did, how it may have hurt, and what I will do next time.', NULL, NULL, NULL),
  ('healflow', 'activities', 19, 'Help Map', NULL, 'Each person names one thing they could use help with this week. Others offer how they can help.', NULL, NULL, NULL);
-- healflow / improv
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('healflow', 'improv', 11, 'Family Talk Show', NULL, 'One person hosts a talk show. Another is the guest expert on something silly. Everyone else is the audience.', NULL, NULL, NULL),
  ('healflow', 'improv', 12, 'Robot Family', NULL, 'Act out the family morning as robots. Brushing teeth, breakfast, and finding shoes, all in robot moves.', NULL, NULL, NULL),
  ('healflow', 'improv', 13, 'Opposite Day', NULL, 'Act out a normal family scene where everyone does the opposite of what they usually do.', NULL, NULL, NULL),
  ('healflow', 'improv', 14, 'Animal Dinner', NULL, 'Act out dinner time as a family of animals. Others guess which animal each person is.', NULL, NULL, NULL),
  ('healflow', 'improv', 15, 'The Lost Remote', NULL, 'Act out a scene where the TV remote is lost. Everyone has a wilder idea of where it went.', NULL, NULL, NULL),
  ('healflow', 'improv', 16, 'Superhero Family', NULL, 'Each person picks a silly superpower. Together, save the day from a messy-room monster.', NULL, NULL, NULL),
  ('healflow', 'improv', 17, 'Gibberish Talk', NULL, 'Act out a scene using only made-up words. The others guess what happened.', NULL, NULL, NULL),
  ('healflow', 'improv', 18, 'Time Travel Morning', NULL, 'Act out a family morning from a hundred years ago, or a hundred years from now.', NULL, NULL, NULL);
-- healflow / inner
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('healflow', 'inner', 9, 'First Time I...', NULL, 'Share a memory of the first time you did something. What did it teach you?', NULL, NULL, NULL),
  ('healflow', 'inner', 10, 'Favourite Snack Then', NULL, 'Share a snack you loved as a child, and why you loved it.', NULL, NULL, NULL),
  ('healflow', 'inner', 11, 'Hide and Seek', NULL, 'Play one round of hide and seek. The grown-ups play too.', NULL, NULL, NULL),
  ('healflow', 'inner', 12, 'Blanket Fort', NULL, 'Build a fort from blankets and pillows together. Tell stories inside it.', NULL, NULL, NULL),
  ('healflow', 'inner', 13, 'What I Needed to Hear', NULL, 'Share one thing you wish someone had told you as a child. The family says it to you now.', NULL, NULL, NULL),
  ('healflow', 'inner', 14, 'Silly Song Time', NULL, 'Sing a song you loved as a kid, all together, as loud as you like.', NULL, NULL, NULL),
  ('healflow', 'inner', 15, 'Childhood Hero', NULL, 'Who was your hero as a child? Share why, and what you learned from them.', NULL, NULL, NULL),
  ('healflow', 'inner', 16, 'Pretend Shop', NULL, 'The kids run a pretend shop. The grown-ups are the customers and pay with paper money.', NULL, NULL, NULL);
-- relationship_method / servitude
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('relationship_method', 'servitude', 7, 'Daily Deep Work Block', NULL, 'Spend 45 minutes on your most important task each day, with your phone in another room.', NULL, NULL, NULL),
  ('relationship_method', 'servitude', 8, 'Daily Thank-You Note', NULL, 'Take 5 minutes each day to thank one colleague or helper in writing, for something specific.', NULL, NULL, NULL),
  ('relationship_method', 'servitude', 9, 'Daily Mentor Moment', NULL, 'Spend 10 minutes each day helping someone learn a thing you know well.', NULL, NULL, NULL),
  ('relationship_method', 'servitude', 10, 'Daily Plan the Day', NULL, 'Take 5 minutes each morning to write the three tasks that matter most today.', NULL, NULL, NULL),
  ('relationship_method', 'servitude', 11, 'Daily Feedback Ask', NULL, 'Ask one person each day for one thing you could do better. Listen for 5 minutes and thank them.', NULL, NULL, NULL),
  ('relationship_method', 'servitude', 12, 'Daily Small Service', NULL, 'Give 10 minutes each day to help your street, your building or a cause you care about.', NULL, NULL, NULL),
  ('relationship_method', 'servitude', 13, 'Daily End-of-Day Review', NULL, 'Take 10 minutes each evening: what got done, what got in the way, and the first task for tomorrow.', NULL, NULL, NULL);
-- relationship_method / friendships
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('relationship_method', 'friendships', 7, 'Daily Voice Note', NULL, 'Send one friend a two-minute voice note about something that made you think of them.', NULL, NULL, NULL),
  ('relationship_method', 'friendships', 8, 'Daily Old Friend Check-In', NULL, 'Take 5 minutes to message a friend you have not spoken to in a while.', NULL, NULL, NULL),
  ('relationship_method', 'friendships', 9, 'Daily Listening Call', NULL, 'Call a friend for 15 minutes and ask more than you tell.', NULL, NULL, NULL),
  ('relationship_method', 'friendships', 10, 'Daily Memory Share', NULL, 'Spend 5 minutes sharing an old photo or memory with a friend who was there.', NULL, NULL, NULL),
  ('relationship_method', 'friendships', 11, 'Daily Good News Cheer', NULL, 'Spend 5 minutes noticing a friend''s good news and cheering them on.', NULL, NULL, NULL),
  ('relationship_method', 'friendships', 12, 'Daily Plan to Meet', NULL, 'Spend 5 minutes setting a day and time to meet a friend in person.', NULL, NULL, NULL),
  ('relationship_method', 'friendships', 13, 'Daily Shared Laugh', NULL, 'Take 2 minutes to send a friend something that will make them smile.', NULL, NULL, NULL);
-- relationship_method / caretakers
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('relationship_method', 'caretakers', 7, 'Daily Family Call', NULL, 'Call a parent, grandparent or sibling for 10 minutes each day.', NULL, NULL, NULL),
  ('relationship_method', 'caretakers', 8, 'Daily Shared Meal', NULL, 'Eat one meal together each day for 20 minutes, with phones away.', NULL, NULL, NULL),
  ('relationship_method', 'caretakers', 9, 'Daily Help at Home', NULL, 'Spend 15 minutes each day on a chore that makes life easier for someone at home.', NULL, NULL, NULL),
  ('relationship_method', 'caretakers', 10, 'Daily Family Story', NULL, 'Ask an elder for one story from their life and listen for 10 minutes.', NULL, NULL, NULL),
  ('relationship_method', 'caretakers', 11, 'Daily Thank You at Home', NULL, 'Thank one family member each day for something specific they did.', NULL, NULL, NULL),
  ('relationship_method', 'caretakers', 12, 'Daily Pause Before Answering', NULL, 'When a family talk gets tense, take three slow breaths before you answer. Reflect for 5 minutes at night.', NULL, NULL, NULL),
  ('relationship_method', 'caretakers', 13, 'Daily Photo Memories', NULL, 'Spend 5 minutes looking through old family photos together and sharing what you remember.', NULL, NULL, NULL);
-- relationship_method / lover
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('relationship_method', 'lover', 7, 'Daily Check-In', NULL, 'Spend 10 minutes each day asking: how are you really, and what do you need today?', NULL, NULL, NULL),
  ('relationship_method', 'lover', 8, 'Daily Love Note', NULL, 'Take 2 minutes to leave your partner a short note or message.', NULL, NULL, NULL),
  ('relationship_method', 'lover', 9, 'Daily Phone-Free Time', NULL, 'Spend 30 minutes together each day with both phones away.', NULL, NULL, NULL),
  ('relationship_method', 'lover', 10, 'Daily Long Hug', NULL, 'Share one hug each day that lasts at least twenty seconds.', NULL, NULL, NULL),
  ('relationship_method', 'lover', 11, 'Daily Love Language', NULL, 'Spend 10 minutes each day doing one thing in your partner''s love language.', NULL, NULL, NULL),
  ('relationship_method', 'lover', 12, 'Daily Dream Share', NULL, 'Take 10 minutes to share one dream or hope with your partner, big or small.', NULL, NULL, NULL),
  ('relationship_method', 'lover', 13, 'Daily Repair Moment', NULL, 'Take 10 minutes each evening to kindly name anything that hurt today, and say sorry where you need to.', NULL, NULL, NULL);
-- relationship_method / self
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('relationship_method', 'self', 7, 'Daily Morning Pages', NULL, 'Write freely for 10 minutes each morning, before you look at your phone.', NULL, NULL, NULL),
  ('relationship_method', 'self', 8, 'Daily Screen Sunset', NULL, 'Turn off screens 30 minutes before bed each night.', NULL, NULL, NULL),
  ('relationship_method', 'self', 9, 'Daily Walk Outside', NULL, 'Take a 20-minute walk in daylight each day.', NULL, NULL, NULL),
  ('relationship_method', 'self', 10, 'Daily Kind Self-Talk', NULL, 'Spend 5 minutes each day noticing one harsh thought and writing it again, kindly.', NULL, NULL, NULL),
  ('relationship_method', 'self', 11, 'Daily Stretch Break', NULL, 'Stretch for 10 minutes each day, slowly, from head to toe.', NULL, NULL, NULL),
  ('relationship_method', 'self', 12, 'Daily New Skill', NULL, 'Spend 15 minutes each day learning something new.', NULL, NULL, NULL),
  ('relationship_method', 'self', 13, 'Daily Tidy Corner', NULL, 'Spend 10 minutes each day tidying one small corner of your space.', NULL, NULL, NULL);
-- relationship_method / guru
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('relationship_method', 'guru', 7, 'Daily Silent Sitting', NULL, 'Sit in silence for 10 minutes each day with one teaching in mind.', NULL, NULL, NULL),
  ('relationship_method', 'guru', 8, 'Daily Teaching Journal', NULL, 'Spend 10 minutes writing one line from your teacher and how you used it today.', NULL, NULL, NULL),
  ('relationship_method', 'guru', 9, 'Daily Thanks to a Teacher', NULL, 'Take 5 minutes to thank a teacher, in person, in a message or in your journal.', NULL, NULL, NULL),
  ('relationship_method', 'guru', 10, 'Daily Question to Ask', NULL, 'Spend 5 minutes writing one question you would like to ask your teacher.', NULL, NULL, NULL),
  ('relationship_method', 'guru', 11, 'Daily Living the Teaching', NULL, 'Pick one teaching and live it for the day. Reflect on it for 10 minutes at night.', NULL, NULL, NULL),
  ('relationship_method', 'guru', 12, 'Daily Satsang Listening', NULL, 'Listen to a talk by your teacher for 20 minutes each day.', NULL, NULL, NULL),
  ('relationship_method', 'guru', 13, 'Daily Humble Learning', NULL, 'Spend 10 minutes each day learning from someone younger or newer than you.', NULL, NULL, NULL);
-- relationship_method / divine
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('relationship_method', 'divine', 7, 'Daily Morning Offering', NULL, 'Take 5 minutes when you wake up to offer your day, and ask for help to live it well.', NULL, NULL, NULL),
  ('relationship_method', 'divine', 8, 'Daily Sunrise Pause', NULL, 'Spend 10 minutes watching the sunrise or sunset in silence.', NULL, NULL, NULL),
  ('relationship_method', 'divine', 9, 'Daily Mantra Practice', NULL, 'Repeat a mantra for 10 minutes each day, or 108 times with a mala.', NULL, NULL, NULL),
  ('relationship_method', 'divine', 10, 'Daily Quiet Kindness', NULL, 'Do one kind act each day without telling anyone. It can take just 10 minutes.', NULL, NULL, NULL),
  ('relationship_method', 'divine', 11, 'Daily Evening Prayer', NULL, 'Spend 10 minutes in prayer before you sleep.', NULL, NULL, NULL),
  ('relationship_method', 'divine', 12, 'Daily Sacred Music', NULL, 'Listen to devotional music or chanting for 15 minutes each day.', NULL, NULL, NULL),
  ('relationship_method', 'divine', 13, 'Daily Letting Go', NULL, 'Take 5 minutes to write one worry, then hand it over in prayer.', NULL, NULL, NULL);
-- workflow / truth
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('workflow', 'truth', 10, NULL, NULL, '', '["Have you ever replied all by mistake?", "Have you ever joined a call without knowing what it was about?"]', NULL, NULL),
  ('workflow', 'truth', 11, NULL, NULL, '', '["Have you ever blamed slow internet to leave a call early?", "Have you ever forgotten a colleague''s name right after meeting them?"]', NULL, NULL),
  ('workflow', 'truth', 12, NULL, NULL, '', '["Have you ever said \"let''s take this offline\" just to end a talk?", "Have you ever nodded along in a meeting without following a word?"]', NULL, NULL),
  ('workflow', 'truth', 13, NULL, NULL, '', '["Have you ever worked from bed on a work-from-home day?", "Have you ever kept your camera off because you were not ready?"]', NULL, NULL),
  ('workflow', 'truth', 14, NULL, NULL, '', '["Have you ever rewritten an email five times before sending it?", "Have you ever sent a message to the wrong group chat?"]', NULL, NULL),
  ('workflow', 'truth', 15, NULL, NULL, '', '["Have you ever cried at work, even a little?", "Have you ever stayed late only to look busy?"]', NULL, NULL),
  ('workflow', 'truth', 16, NULL, NULL, '', '["Have you ever searched for a word your boss used in a meeting?", "Have you ever said you read a document you never opened?"]', NULL, NULL),
  ('workflow', 'truth', 17, NULL, NULL, '', '["Have you ever hoped a meeting would be cancelled?", "Have you ever marked an email unread to deal with later, then forgot it?"]', NULL, NULL),
  ('workflow', 'truth', 18, NULL, NULL, '', '["Have you ever felt you did not deserve a promotion you got?", "Have you ever compared your pay with a friend''s?"]', NULL, NULL),
  ('workflow', 'truth', 19, NULL, NULL, '', '["Have you ever said yes to a task you had no idea how to do?", "Have you ever felt proud of work nobody noticed?"]', NULL, NULL);
-- workflow / twotruths
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('workflow', 'twotruths', 10, NULL, NULL, '', '["Have you ever fallen asleep in an online meeting?", "Have you ever sent a meme to your boss by mistake?", "Have you ever worn pyjama bottoms on a video call?"]', NULL, NULL),
  ('workflow', 'twotruths', 11, NULL, NULL, '', '["Have you ever eaten office birthday cake without knowing whose birthday it was?", "Have you ever practised a speech in the mirror before a meeting?", "Have you ever quit a job before telling your family?"]', NULL, NULL),
  ('workflow', 'twotruths', 12, NULL, NULL, '', '["Have you ever pretended to know software you had never used?", "Have you ever taken a work call from the bathroom?", "Have you ever talked for a full minute on mute?"]', NULL, NULL),
  ('workflow', 'twotruths', 13, NULL, NULL, '', '["Have you ever had a crush on a coworker?", "Have you ever skipped lunch to finish a slide deck?", "Have you ever turned down a job offer in one line?"]', NULL, NULL),
  ('workflow', 'twotruths', 14, NULL, NULL, '', '["Have you ever worked a whole weekend and told no one?", "Have you ever walked into the wrong meeting room?", "Have you ever named a file \"final_final_v3\"?"]', NULL, NULL),
  ('workflow', 'twotruths', 15, NULL, NULL, '', '["Have you ever laughed at a joke you did not get in a meeting?", "Have you ever had a dream about work that felt real?", "Have you ever asked a question you knew the answer to, just to be seen?"]', NULL, NULL),
  ('workflow', 'twotruths', 16, NULL, NULL, '', '["Have you ever been praised for something a teammate did?", "Have you ever booked a fake meeting to get time for yourself?", "Have you ever answered a work message at a wedding?"]', NULL, NULL),
  ('workflow', 'twotruths', 17, NULL, NULL, '', '["Have you ever applied for a job you were not ready for, and got it?", "Have you ever left your laptop charger at home on the day of a big meeting?", "Have you ever hidden from your boss in a corridor?"]', NULL, NULL),
  ('workflow', 'twotruths', 18, NULL, NULL, '', '["Have you ever written a letter to quit and never sent it?", "Have you ever learned a work skill only from videos?", "Have you ever written \"as per my last email\" and meant it sharply?"]', NULL, NULL),
  ('workflow', 'twotruths', 19, NULL, NULL, '', '["Have you ever started a side project in work hours?", "Have you ever been late because you changed your outfit twice?", "Have you ever made a big mistake that turned out well?"]', NULL, NULL);
-- dateflow_connect / ice
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('dateflow_connect', 'ice', 16, NULL, 'This', 'Share the last thing that made you laugh out loud.', NULL, 'That', 'Act it out and let the other person guess what it was.'),
  ('dateflow_connect', 'ice', 17, NULL, 'This', 'What would your dream sandwich have in it?', NULL, 'That', 'Build an imaginary sandwich together, one layer each.'),
  ('dateflow_connect', 'ice', 18, NULL, 'This', 'Share the best gift you ever got.', NULL, 'That', 'Give each other an imaginary gift and say why you chose it.'),
  ('dateflow_connect', 'ice', 19, NULL, 'This', 'What small thing makes your day better?', NULL, 'That', 'Do that small thing for each other right now, if you can.'),
  ('dateflow_connect', 'ice', 20, NULL, 'This', 'If you could have any job for one day, what would it be?', NULL, 'That', 'Interview each other for that job for one minute.'),
  ('dateflow_connect', 'ice', 21, NULL, 'This', 'Share your go-to karaoke song.', NULL, 'That', 'Hum the tune and let the other person guess it.'),
  ('dateflow_connect', 'ice', 22, NULL, 'This', 'What is your favourite way to spend a rainy day?', NULL, 'That', 'Plan a rainy day together, hour by hour.'),
  ('dateflow_connect', 'ice', 23, NULL, 'This', 'Name three emojis that sum up your week.', NULL, 'That', 'Act out the three emojis for the other person to guess.');
-- dateflow_connect / bond
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('dateflow_connect', 'bond', 16, NULL, 'This', 'Share a skill you would love to learn together.', NULL, 'That', 'Plan your first lesson together.'),
  ('dateflow_connect', 'bond', 17, NULL, 'This', 'Which place from your childhood would you like to show the other person?', NULL, 'That', 'Take them on a walk through it in words, step by step.'),
  ('dateflow_connect', 'bond', 18, NULL, 'This', 'What does a perfect Sunday look like for you?', NULL, 'That', 'Swap one part of your perfect Sunday with theirs.'),
  ('dateflow_connect', 'bond', 19, NULL, 'This', 'Share a song that reminds you of a good time.', NULL, 'That', 'Make a short playlist of five songs together.'),
  ('dateflow_connect', 'bond', 20, NULL, 'This', 'Talk about a friend who changed your life.', NULL, 'That', 'Write them a short thank-you message together.'),
  ('dateflow_connect', 'bond', 21, NULL, 'This', 'What small habit of the other person do you like?', NULL, 'That', 'Copy that habit for one minute.'),
  ('dateflow_connect', 'bond', 22, NULL, 'This', 'If you started a small business together, what would it be?', NULL, 'That', 'Pitch it to each other in thirty seconds.'),
  ('dateflow_connect', 'bond', 23, NULL, 'This', 'Share a food you have never tried but want to.', NULL, 'That', 'Plan a date to try it together.');
-- dateflow_connect / deep
INSERT INTO cards (game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text) VALUES
  ('dateflow_connect', 'deep', 16, NULL, 'This', 'When do you feel most like yourself?', NULL, 'That', 'Plan one way to have more of those moments together.'),
  ('dateflow_connect', 'deep', 17, NULL, 'This', 'What have you forgiven, or are still learning to forgive?', NULL, 'That', 'Each write one kind line to yourself about it.'),
  ('dateflow_connect', 'deep', 18, NULL, 'This', 'What do you need after a hard day?', NULL, 'That', 'Practise giving each other that for one minute.'),
  ('dateflow_connect', 'deep', 19, NULL, 'This', 'Share a belief you changed your mind about.', NULL, 'That', 'Each say what helped you change.'),
  ('dateflow_connect', 'deep', 20, NULL, 'This', 'What fear would you like to let go of this year?', NULL, 'That', 'Write it on paper, fold it, and put it away together.'),
  ('dateflow_connect', 'deep', 21, NULL, 'This', 'What makes you feel truly heard?', NULL, 'That', 'Take two minutes each to listen without speaking.'),
  ('dateflow_connect', 'deep', 22, NULL, 'This', 'Who taught you the most about love?', NULL, 'That', 'Share one lesson from them and how you use it now.'),
  ('dateflow_connect', 'deep', 23, NULL, 'This', 'Where do you see yourself in ten years?', NULL, 'That', 'Write a short letter to your future selves together.');
