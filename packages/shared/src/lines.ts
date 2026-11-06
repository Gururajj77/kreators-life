// ---- The line of the day: a thought from a philosopher or from the app, one a day, none back until all have been shown ----

/** Lines from philosophers and thinkers, each with who said it. Translations vary; these are the common English renderings. */
const PHILOSOPHER_LINES: readonly (readonly [string, string])[] = [
  ['The soul becomes dyed with the color of its thoughts.', 'Marcus Aurelius'],
  ['If it is not right, do not do it; if it is not true, do not say it.', 'Marcus Aurelius'],
  ['What stands in the way becomes the way.', 'Marcus Aurelius'],
  ['Waste no more time arguing about what a good man should be. Be one.', 'Marcus Aurelius'],
  ['Very little is needed to make a happy life; it is all within yourself, in your way of thinking.', 'Marcus Aurelius'],
  ['Do every act of your life as though it were your last.', 'Marcus Aurelius'],
  ['Our life is what our thoughts make it.', 'Marcus Aurelius'],
  ['Loss is nothing else but change, and change is nature’s delight.', 'Marcus Aurelius'],
  ['Accept the things to which fate binds you, and love the people with whom fate brings you together, but do so with all your heart.', 'Marcus Aurelius'],
  ['Never esteem anything as of advantage to you that will make you break your word or lose your self-respect.', 'Marcus Aurelius'],
  ['Look well into thyself; there is a source of strength which will always spring up if thou wilt always look.', 'Marcus Aurelius'],
  ['We suffer more often in imagination than in reality.', 'Seneca'],
  ['It is not that we have a short time to live, but that we waste much of it.', 'Seneca'],
  ['While we are postponing, life speeds by.', 'Seneca'],
  ['No man was ever wise by chance.', 'Seneca'],
  ['Difficulties strengthen the mind, as labor does the body.', 'Seneca'],
  ['If a man knows not to which port he sails, no wind is favorable.', 'Seneca'],
  ['Begin at once to live, and count each separate day as a separate life.', 'Seneca'],
  ['He suffers more than necessary who suffers before it is necessary.', 'Seneca'],
  ['Life is long if you know how to use it.', 'Seneca'],
  ['True happiness is to enjoy the present, without anxious dependence upon the future.', 'Seneca'],
  ['Associate with people who are likely to improve you.', 'Seneca'],
  ['It is a rough road that leads to the heights of greatness.', 'Seneca'],
  ['Sometimes even to live is an act of courage.', 'Seneca'],
  ['Men are disturbed not by things, but by the views they take of them.', 'Epictetus'],
  ['First say to yourself what you would be; and then do what you have to do.', 'Epictetus'],
  ['No man is free who is not master of himself.', 'Epictetus'],
  ['Wealth consists not in having great possessions, but in having few wants.', 'Epictetus'],
  ['It is impossible for a man to learn what he thinks he already knows.', 'Epictetus'],
  ['If you want to improve, be content to be thought foolish and stupid.', 'Epictetus'],
  ['Make the best use of what is in your power, and take the rest as it happens.', 'Epictetus'],
  ['How long will you wait before you demand the best for yourself?', 'Epictetus'],
  ['Only the educated are free.', 'Epictetus'],
  ['A journey of a thousand miles begins with a single step.', 'Lao Tzu'],
  ['Knowing others is intelligence; knowing yourself is true wisdom.', 'Lao Tzu'],
  ['He who knows he has enough is rich.', 'Lao Tzu'],
  ['Nature does not hurry, yet everything is accomplished.', 'Lao Tzu'],
  ['The softest things in the world overcome the hardest things in the world.', 'Lao Tzu'],
  ['Mastering others is strength; mastering yourself is true power.', 'Lao Tzu'],
  ['The best of people is like water.', 'Lao Tzu'],
  ['Do the difficult things while they are easy, and do the great things while they are small.', 'Lao Tzu'],
  ['It does not matter how slowly you go as long as you do not stop.', 'Confucius'],
  ['To know what you know and what you do not know, that is true knowledge.', 'Confucius'],
  ['The man who moves a mountain begins by carrying away small stones.', 'Confucius'],
  ['Everything has beauty, but not everyone sees it.', 'Confucius'],
  ['He who learns but does not think is lost; he who thinks but does not learn is in great danger.', 'Confucius'],
  ['Wherever you go, go with all your heart.', 'Confucius'],
  ['The gem cannot be polished without friction, nor man perfected without trials.', 'Confucius'],
  ['We are what we repeatedly do. Excellence, then, is not an act but a habit.', 'Will Durant, on Aristotle'],
  ['Happiness depends upon ourselves.', 'Aristotle'],
  ['The roots of education are bitter, but the fruit is sweet.', 'Aristotle'],
  ['Pleasure in the job puts perfection in the work.', 'Aristotle'],
  ['Well begun is half done.', 'Aristotle'],
  ['Hope is a waking dream.', 'Aristotle'],
  ['The aim of the wise is not to secure pleasure, but to avoid pain.', 'Aristotle'],
  ['Friendship is a single soul dwelling in two bodies.', 'Aristotle'],
  ['In all things of nature there is something of the marvelous.', 'Aristotle'],
  ['The unexamined life is not worth living.', 'Socrates'],
  ['I neither know nor think that I know.', 'Socrates'],
  ['Know thyself.', 'Socrates'],
  ['Be as you wish to seem.', 'Socrates'],
  ['The beginning is the most important part of the work.', 'Plato'],
  ['Courage is knowing what not to fear.', 'Plato'],
  ['Wonder is the feeling of a philosopher, and philosophy begins in wonder.', 'Plato'],
  ['No man ever steps in the same river twice.', 'Heraclitus'],
  ['Character is destiny.', 'Heraclitus'],
  ['Change is the only constant.', 'Heraclitus'],
  ['All that we are is the result of what we have thought.', 'The Buddha'],
  ['Better than a thousand hollow words is one word that brings peace.', 'The Buddha'],
  ['Hatred does not cease by hatred, but only by love.', 'The Buddha'],
  ['Three things cannot be long hidden: the sun, the moon and the truth.', 'The Buddha'],
  ['Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment.', 'The Buddha'],
  ['Happiness is the absence of the striving for happiness.', 'Zhuangzi'],
  ['The fish trap exists because of the fish. Once you have the fish, you can forget the trap.', 'Zhuangzi'],
  ['Nothing great was ever achieved without enthusiasm.', 'Ralph Waldo Emerson'],
  ['Every wall is a door.', 'Ralph Waldo Emerson'],
  ['Trust thyself: every heart vibrates to that iron string.', 'Ralph Waldo Emerson'],
  ['It is not length of life, but depth of life.', 'Ralph Waldo Emerson'],
  ['Go confidently in the direction of your dreams. Live the life you have imagined.', 'Henry David Thoreau'],
  ['It is not what you look at that matters, it is what you see.', 'Henry David Thoreau'],
  ['The man who goes alone can start today; but he who travels with another must wait till that other is ready.', 'Henry David Thoreau'],
  ['Our life is frittered away by detail. Simplify, simplify.', 'Henry David Thoreau'],
  ['He who has a why to live can bear almost any how.', 'Friedrich Nietzsche'],
  ['You must have chaos within you to give birth to a dancing star.', 'Friedrich Nietzsche'],
  ['Without music, life would be a mistake.', 'Friedrich Nietzsche'],
  ['There are no facts, only interpretations.', 'Friedrich Nietzsche'],
  ['Become who you are.', 'Friedrich Nietzsche'],
  ['Life can only be understood backwards; but it must be lived forwards.', 'Søren Kierkegaard'],
  ['Anxiety is the dizziness of freedom.', 'Søren Kierkegaard'],
  ['To dare is to lose one’s footing momentarily. Not to dare is to lose oneself.', 'Søren Kierkegaard'],
  ['My life has been full of terrible misfortunes, most of which never happened.', 'Michel de Montaigne'],
  ['The greatest thing in the world is to know how to belong to oneself.', 'Michel de Montaigne'],
  ['All of humanity’s problems stem from man’s inability to sit quietly in a room alone.', 'Blaise Pascal'],
  ['Do not weep; do not wax indignant. Understand.', 'Baruch Spinoza'],
  ['Peace is not an absence of war, it is a virtue, a state of mind, a disposition for benevolence, confidence and justice.', 'Baruch Spinoza'],
  ['Not what we have but what we enjoy constitutes our abundance.', 'Epicurus'],
  ['Do not spoil what you have by desiring what you have not.', 'Epicurus'],
  ['Of all the things wisdom provides to make life happy, the greatest by far is friendship.', 'Epicurus'],
  ['The wound is the place where the light enters you.', 'Rumi'],
  ['Yesterday I was clever, so I wanted to change the world. Today I am wise, so I am changing myself.', 'Rumi'],
  ['What you seek is seeking you.', 'Rumi'],
  ['Act only according to that maxim whereby you can at the same time will that it should become a universal law.', 'Immanuel Kant'],
  ['The greatest weapon against stress is our ability to choose one thought over another.', 'William James'],
  ['Act as if what you do makes a difference. It does.', 'William James'],
  ['My experience is what I agree to attend to.', 'William James'],
  ['Talent hits a target no one else can hit; genius hits a target no one else can see.', 'Arthur Schopenhauer'],
  ['The limits of my language mean the limits of my world.', 'Ludwig Wittgenstein'],
  ['If you have a garden and a library, you have everything you need.', 'Cicero'],
  ['While there is life, there is hope.', 'Cicero'],
  ['I am a citizen of the world.', 'Diogenes'],
  ['The mind is not a vessel to be filled but a fire to be kindled.', 'Plutarch'],
  ['Attention is the rarest and purest form of generosity.', 'Simone Weil'],
  ['When we are no longer able to change a situation, we are challenged to change ourselves.', 'Viktor Frankl'],
  ['In the midst of winter, I found there was, within me, an invincible summer.', 'Albert Camus'],
  ['The struggle itself toward the heights is enough to fill a man’s heart.', 'Albert Camus'],
  ['Man is condemned to be free.', 'Jean-Paul Sartre'],
  ['Commitment is an act, not a word.', 'Jean-Paul Sartre'],
  ['The only way to make sense out of change is to plunge into it, move with it, and join the dance.', 'Alan Watts'],
  ['The good life is one inspired by love and guided by knowledge.', 'Bertrand Russell'],
  ['It is better to be a human being dissatisfied than a pig satisfied.', 'John Stuart Mill'],
  ['Smile, breathe and go slowly.', 'Thich Nhat Hanh'],
  ['The present moment is the only moment available to us, and it is the door to all moments.', 'Thich Nhat Hanh'],
  ['Be a philosopher; but, amidst all your philosophy, be still a man.', 'David Hume'],
  ['Doubt is not a pleasant condition, but certainty is absurd.', 'Voltaire'],
  ['It is not enough to have a good mind; the main thing is to use it well.', 'René Descartes'],
  ['Man conquers the world by conquering himself.', 'Zeno of Citium'],
  ['Knowledge itself is power.', 'Francis Bacon'],
  ['Read not to contradict and confute; nor to believe and take for granted; but to weigh and consider.', 'Francis Bacon'],
  ['You have a right to your actions, but never to your actions’ fruits.', 'The Bhagavad Gita'],
  ['Set thy heart upon thy work, but never on its reward.', 'The Bhagavad Gita'],
  ['Arise, awake, and stop not till the goal is reached.', 'Swami Vivekananda'],
];

const APP_LINES: readonly string[] = [
  "You are not late. You are exactly on the only schedule your life has ever had.",
  "Time is the one thing you spend every day without ever seeing a receipt.",
  "Nobody is watching as closely as you think. That is the good news.",
  "The person you will be in five years is being decided in the next five minutes.",
  "You will never find time. You can only decide what the time you have is for.",
  "Busy is not a measure of importance. It is often a way to avoid the one hard thing.",
  "A year from now you will wish you had started today. So start today.",
  "Today is the oldest you have ever been and the youngest you will ever be again.",
  "The days feel long and the years feel short because the days are where you decide.",
  "Your future self is a stranger you are building a home for. Be a good host.",
  "You are always one hour away from a different day.",
  "Waiting for the right moment is a moment spent.",
  "There is no later. There is only a pile of nows you did not use.",
  "Five minutes a day is thirty hours a year. Ask what thirty hours could build.",
  "The clock does not care how you feel. That is why a small plan beats a strong mood.",
  "You do not rise to the level of your goals. You fall to the level of your daily acts.",
  "Motivation is a visitor. A routine is a resident. Build for the resident.",
  "A goal is a wish with a deadline. A system is a wish with a Tuesday.",
  "Big change is small changes that nobody clapped for.",
  "What you do once is an event. What you do daily is who you are.",
  "You are always practising something. The question is what.",
  "The hardest part of any task is the thirty seconds before it.",
  "If you can do it badly, you can do it. Do it badly first.",
  "Perfect is a way of never starting that sounds like a standard.",
  "Most of life is decided in the first step you almost did not take.",
  "A small win each day is an unfair advantage.",
  "Slow progress is still the only kind of progress there is.",
  "Effort feels like hard work. It is also what building feels like from the inside.",
  "The pain of starting lasts a minute. The pain of never starting lasts years.",
  "You can only be consistent with something that is small enough to do on a bad day.",
  "Do not trust a plan that needs you to feel great.",
  "Done is a skill, and it is learned only by finishing.",
  "The thing you keep postponing is usually the thing you most need.",
  "Progress hides. Look back, not at your feet.",
  "You are one habit away from a different life, and one excuse away from the same one.",
  "What gets measured gets attention. What gets attention gets better.",
  "You become what you rehearse.",
  "Growth is not a feeling. It is a result you notice later.",
  "Wherever your attention goes for a year is where your life goes.",
  "You are the only person who has ever heard every thought you have had. Be careful what you say to yourself.",
  "A mind in a hurry sees little. A mind at rest sees what matters.",
  "What you pay attention to grows. Choose what you water.",
  "Most worries are rehearsals for plays that never open.",
  "You have been practising your mood for years. Practise another one.",
  "A thought is not a fact. It is a weather report from a very small corner of you.",
  "You cannot think your way out of a feeling, but you can walk your way out.",
  "Your phone is a window or a mirror. Notice which one you are using.",
  "If your attention is the product, you are the thing being sold. Take it back for an hour.",
  "The mind is a brilliant servant and a terrible master.",
  "Silence is not empty. It is where the answers wait.",
  "Boredom is the doorway to an idea. Stop shutting it.",
  "You are not your anxious thought. You are the one who hears it.",
  "Notice that you can notice. That is the part of you that is free.",
  "Most arguments are won in the first sentence, and lost in the second.",
  "If a thought makes you smaller, question it. If it makes you honest, follow it.",
  "Changing your mind is not weakness. It is the proof that you are still learning.",
  "Certainty feels like knowledge. It is usually only comfort.",
  "The brain that worries is the brain that cares. Teach it where to put that care.",
  "Fear is a compass pointing at what matters. Follow it carefully, not blindly.",
  "Courage is not feeling fear. It is the work you do while feeling it.",
  "What you avoid grows teeth. What you face grows smaller.",
  "The cost of safety is a smaller life.",
  "One brave minute can change the shape of a week.",
  "You are not stuck. You are standing in front of a decision you have not made.",
  "What would you do if you knew you could not fail? Now do a small version, knowing you might.",
  "Regret is mostly about what we did not try.",
  "Discomfort is the sound of your edges stretching.",
  "Nobody feels ready. The ready ones simply began.",
  "The first draft of anything is a brave act.",
  "Be willing to be a beginner. It is the only door to the next level.",
  "Say the thing you have been rehearsing in your head. It will be shorter out loud.",
  "Doubt is a sign you are near something that matters.",
  "You have survived every bad day so far. That is a perfect record.",
  "Rich is a number. Enough is a feeling. Know which one you are chasing.",
  "Money is stored time. Spend it like it is.",
  "Pay yourself first, and your future self will pay you back.",
  "Your work is a gift only if it is given. Ship it.",
  "Nobody has ever been moved by a perfect plan. They are moved by a finished thing.",
  "Make something this week that you would be proud to be known for.",
  "The best marketing is a person who can finally do what they could not do last month.",
  "A career is the sum of small hours nobody saw.",
  "If you want to be good at your work, be useful before you are visible.",
  "You do not need an audience to start. You need one person you can help.",
  "Make it good, make it kind, make it again.",
  "What would you make if no one was going to rate it?",
  "The best idea you have is the one you finish.",
  "Learn in public. Everyone is more patient than you fear.",
  "Price your work by what it gives, not by what it costs you in hours.",
  "A deadline is a friend that tells the truth about time.",
  "Do work that makes tomorrow easier for someone.",
  "Ask what the work needs, not what you feel like doing.",
  "You are allowed to be paid for what comes easily to you. It does not come easily to everyone.",
  "A creative life is built on boring mornings.",
  "The people you are closest to are quietly writing your next chapter.",
  "Most people are not waiting to judge you. They are waiting to be noticed by you.",
  "A friend is someone who remembers the question you did not ask.",
  "Listening is the cheapest gift and the rarest.",
  "You teach people how to treat you by what you quietly allow.",
  "Love is not a feeling you wait for. It is a series of small decisions made at inconvenient times.",
  "The way you speak when you are tired is who you are.",
  "Call the person you keep meaning to call. The window does close.",
  "Parents were once as unsure as you are now. Be gentle with them, and with yourself.",
  "Your family has a story about you. You are allowed to write the next page.",
  "You cannot pour from an empty cup, but you can ask someone for a refill.",
  "Most conflicts are two people defending a hurt. Ask about the hurt.",
  "Keep your promises to people who will never find out. That is character.",
  "The kindest thing is often the plain thing, said early.",
  "People remember how you made them feel, and how you made them wait.",
  "Be the person who makes the room a little more honest.",
  "The quality of your life is the quality of your closest relationships, multiplied by your attention to them.",
  "Show up for the small things in other people’s lives. That is where trust lives.",
  "Forgiveness is a door you open for yourself.",
  "Say I love you in a way they can feel, not only in a way you would like.",
  "Rest is not the reward for finishing. It is part of what makes finishing possible.",
  "Your body keeps the minutes you do not. Treat it like a partner in the work.",
  "Sleep is the cheapest performance tool you will ever be given.",
  "Walk before you decide. Your thoughts will be easier to carry.",
  "You do not get a spare body or a spare life. Maintenance is love.",
  "If you would not say it to a friend, do not say it to yourself.",
  "Water, sleep and sunlight fix more problems than they get credit for.",
  "Burnout is what happens when you give your future away to pay for today.",
  "A day with nothing in it is not wasted. It is rest doing its work.",
  "You are not a machine, and a good plan accounts for that.",
  "Take care of the person you are going to be at sixty. They are counting on you.",
  "A tired mind lies. Do not trust your worst hour.",
  "The best version of you is rested, fed and unhurried. Protect that version.",
  "Boundaries are how you love people for longer.",
  "There is no finish line for self-care. That is the point of it.",
  "Everyone you admire had a teacher. Go and find yours.",
  "The best way to learn something is to explain it to a child, or to a wall.",
  "You do not need to know everything. You need to know who to ask and how to keep going.",
  "Read one page of something that disagrees with you.",
  "A good question is worth ten answers.",
  "The expert was once the person who did not give up on being confused.",
  "You learn most from the people who make you slightly uncomfortable.",
  "Your teachers are not only in classrooms. They are in anyone who knows a little more than you about one thing.",
  "Teaching is the fastest way to find the holes in your own understanding.",
  "Be a student for long enough that you stop being embarrassed by it.",
  "What you learn is only yours when you use it.",
  "The point of knowledge is not to be right. It is to be useful.",
  "Curiosity is a muscle. Use it daily or lose it quietly.",
  "The more you know, the more you see what you do not. That is progress, not failure.",
  "Ask one more question than you are comfortable with.",
  "What would still matter to you if no one ever knew you did it?",
  "The meaning of a life is rarely found. It is built, one choice at a time.",
  "You are small, and the universe is vast, and your kindness still counts.",
  "Ask not what the world owes you, but what you want to leave in it.",
  "A good life is less about what you gather and more about what you give away.",
  "Gratitude is the only feeling that makes you richer without taking from anyone.",
  "Awe is free. Look at a tree for a full minute.",
  "Faith is not knowing. It is acting well while you do not know.",
  "What you worship is what you organise your day around. Look at your day.",
  "The question is not whether you will die. It is what you will do with the days before.",
  "Everything you have is on loan, including your time.",
  "Some things only make sense when you stop trying to make them make sense.",
  "If your life were a letter to the world, what would today’s line say?",
  "You are part of something larger than your list. Remember that, and then do the list.",
  "Silence, prayer, or a walk: pick a way to ask what it is all for.",
  "Be the reason someone breathes a little easier today.",
  "A kind act is a prayer with hands.",
  "At the end, nobody counts their likes. They count who sat by the bed.",
  "What would a wise old you tell you today?",
  "If you could only do one thing today that mattered, which would it be?",
  "You are not who you were. You are not yet who you will be. Today you get to choose which way to lean.",
  "Every day you vote for a type of person. Cast a good vote.",
  "You are the author, and you keep forgetting you are holding the pen.",
  "The story you tell about yourself is the one you will live. Edit it kindly.",
  "Do not wait to become confident. Act, and confidence will catch up.",
  "Your identity is a habit of choosing. Choose slightly differently today.",
  "Become the person who would find your goals easy.",
  "You are not behind. You are not ahead. You are on your road, and comparing it to others is like comparing two maps.",
  "Strong people are not hard on themselves. They are honest with themselves.",
  "A small change in who you think you are changes a hundred small choices.",
  "You can be proud of who you are and still be curious about who you could be.",
  "Your past is a place you visit. It is not a place you live.",
  "Today’s version of you is a draft. Drafts are meant to be improved.",
  "You are never too late to become what you intend to become.",
  "Act like the person you are becoming, a little at a time.",
  "The fastest way to feel less busy is to finish one thing.",
  "The more you chase certainty, the less you live.",
  "You cannot get ahead by looking behind, and you cannot learn without it.",
  "Sometimes the most productive thing you can do is stop.",
  "You often get what you want by first being willing not to get it.",
  "The things you own end up owning your time.",
  "If you only do what you are comfortable with, you will be comfortable and stuck.",
  "The harder you push on a stuck door, the less likely you are to notice that it opens the other way.",
  "Everything you have ever wanted is on the other side of a little fear and a lot of ordinary days.",
  "Less is often the answer, and we keep asking for more.",
  "You are not what you do, and what you do is how you become who you are.",
  "Say no to the good so you have room for the great.",
  "A closed door is a kind of map.",
  "What you resist persists, and what you accept can change.",
  "You can be very busy and make no progress at all, and you can do almost nothing and move mountains.",
  "Choosing one thing means letting go of a hundred others. That is the price, and the point.",
  "Other people’s opinions of you are mostly about them.",
  "You can only lose what you were afraid to use.",
  "The opposite of fear is not courage. It is curiosity.",
  "Doing nothing is also a decision, and it is one that gets made for you.",
  "Your biggest limit is usually a story you have told so often you stopped checking it.",
  "Your best ideas arrive when you stop forcing them, which is why you need to leave space.",
  "The best way to be heard is to listen first.",
  "If you cannot find the right words, the right thing is often silence and a hand on the shoulder.",
  "What you call luck is mostly preparation meeting a door you remembered to open.",
  "The smallest unit of change is a single honest decision.",
  "If everything is important, nothing is. Pick the one.",
  "You are surrounded by the people and things you have been choosing, whether you noticed or not.",
  "Ask not what you are good at, but what you are willing to be bad at for long enough.",
  "The map is not the road. Start walking and the map will update.",
  "Be gentle. You are doing something hard, which is being a person.",
  "The world needs the version of you that does not give up quietly.",
  "Look at what you carried yesterday and notice that you are still here.",
  "Small and steady wins the long game.",
  "Let the day be ordinary and do one thing well.",
  "Finish the day with one honest line to yourself: what mattered?",
  "Whatever you did today, you can begin again tomorrow.",
  "A good day is a day you can look back on without flinching.",
  "You do not have to be extraordinary to do something extraordinary. You have to keep going.",
  "The next small step is enough.",
  "Most people overestimate what they can do in a day and underestimate what they can do in a year.",
  "The gap between who you are and who you want to be is closed one ordinary Tuesday at a time.",
  "If you are tired of starting over, stop quitting in the middle.",
  "A decision made with calm will outlast a decision made with heat.",
  "Ask yourself: will this matter in ten days, ten months, ten years? Spend your worry accordingly.",
  "You are allowed to outgrow a place, a plan or a version of yourself.",
  "The most honest thing you will do all day is look at your schedule and see what you really value.",
  "Pay attention to what energises you after you have done it, not before.",
  "A good question asked kindly can change a whole conversation.",
  "Compare yourself to who you were last year, and be fair about it.",
  "What you repeat in private becomes what you are in public.",
  "You will never feel completely ready, and you will do it anyway. So do it now.",
  "Everything difficult becomes ordinary with enough ordinary days.",
  "The quiet work you do when no one thanks you is the work that builds you.",
  "A life is made of Tuesdays. Make them count.",
  "One honest hour beats ten distracted ones.",
  "Do not confuse movement with progress. Check the direction first.",
  "The things you cannot control are not your job today. The next step is.",
  "Remember that the kind person you are looking for is also you.",
  "Some days the biggest thing you can do is the smallest thing, done on purpose.",
  "You do not owe anyone a perfect version of yourself. You owe yourself an honest one.",
  "Care about the work, and care about the people the work is for.",
  "If it is worth doing, it is worth doing slowly enough to do well.",
  "Every master was once a beginner who kept showing up on the days that felt pointless.",
  "The best time to be kind to yourself is when you least feel like it.",
];

/** A small seeded shuffle, so every person sees the same order on the same day. */
function seededShuffle<T>(list: readonly T[], seed: number): T[] {
  const out = [...list];
  let a = (seed * 2654435761) >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
export interface DailyLine {
  text: string;
  /** Who said it: a philosopher. Empty for a line written for the app, which carries no name. */
  by: string;
  /** True for a line written for the app. */
  own: boolean;
}
export const DAILY_LINE_COUNT = PHILOSOPHER_LINES.length + APP_LINES.length;
/** The order of one round: every line once, a philosopher and then the app and so on, shuffled afresh each round. */
function lineOrder(round: number): number[] {
  const p = seededShuffle(PHILOSOPHER_LINES.map((_, i) => i), round * 2 + 11);
  const a = seededShuffle(APP_LINES.map((_, i) => PHILOSOPHER_LINES.length + i), round * 2 + 12);
  const out: number[] = [];
  let first = round % 2 === 0 ? p : a;
  let second = round % 2 === 0 ? a : p;
  while (first.length || second.length) {
    if (first.length) out.push(first.shift()!);
    if (second.length) out.push(second.shift()!);
  }
  return out;
}
/**
 * The line for a day (YYYY-MM-DD, the person's own day). Every line is shown once before any is shown again, so none comes back for as many days as
 * there are lines (about a year); the lines alternate between a philosopher and the app, and each round is shuffled anew. The first line of a round
 * is never the last of the one before. Nothing is stored: the same day always gives the same line.
 */
export function lineForDay(day: string): DailyLine & { key: string; round: number; position: number } {
  const [y, m, d] = day.split('-').map(Number);
  const n = Math.floor(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1) / 86_400_000) - Math.floor(Date.UTC(2026, 0, 1) / 86_400_000);
  const size = DAILY_LINE_COUNT;
  const round = Math.floor(n / size);
  const position = n - round * size;
  const order = lineOrder(round);
  // The round must not start with the line the last round ended on.
  if (position <= 1 && round > -1000000) {
    const lastBefore = lineOrder(round - 1)[size - 1]!;
    if (order[0] === lastBefore) [order[0], order[1]] = [order[1]!, order[0]!];
  }
  const idx = order[position]!;
  const key = idx < PHILOSOPHER_LINES.length ? `p${idx}` : `a${idx - PHILOSOPHER_LINES.length}`;
  return idx < PHILOSOPHER_LINES.length ? { text: PHILOSOPHER_LINES[idx]![0], by: PHILOSOPHER_LINES[idx]![1], own: false, key, round, position } : { text: APP_LINES[idx - PHILOSOPHER_LINES.length]!, by: '', own: true, key, round, position };
}

/**
 * Tips for the line of the day's "Another one" (the founder, 2026-11-06: "shuffle between tip or quotes", "make sense in the context of
 * what we are building"): small things to do for the seven relationships, the work and the day, in the app's plain words. No claim, no
 * promise. A new tip is added here and nowhere else.
 */
const TIP_LINES: readonly string[] = [
  'Pick one small act for a pillar that has gone quiet. Two minutes is enough to start.',
  'Tick a task only on the day you did it. A tick is a record, not a wish.',
  'Name one thing to stay away from this week, and put it on your not to do list.',
  'Give each task a length. A plan with times in it is easier to keep than a list.',
  'At the end of the week, ask which of your seven relationships got none of your time.',
  'Drink a glass of water before your first coffee.',
  'A short review at the end of the month shows what a busy month hid.',
  'When a day goes wrong, keep the bar low: one check-in still counts.',
  'Call someone in your family this week, for no reason at all.',
  'Keep your phone in another room for the first hour of work.',
  'Plan the week on one day, then only look at it each morning.',
  'Write the reason under each goal. A goal without a why is easy to drop.',
  'Do the hardest task before you open any messages.',
  'Finish one task before you start the next. Half-done work weighs on you.',
  'A focus round of 25 minutes is long enough to start and short enough to keep.',
  'When you feel rushed, breathe out for longer than you breathe in.',
  'Go to sleep at the same time on weekdays and weekends.',
  'Thank a teacher, coach or mentor in writing this month.',
  'Spend time with a friend where neither of you is working on anything.',
  'Tell your partner one thing they did for you this week.',
  'Move a set amount to savings on the day money comes in, before you spend.',
  'Send an invoice on the day the work is done, not at the end of the month.',
  'Post less, and finish what you post. One good piece beats three rushed ones.',
  'Keep a list of ideas and pick from it, instead of waiting for one to arrive.',
  'Learn one skill at a time, until you can use it without notes.',
  'When work feels endless, ask who it serves. Work that serves someone is easier to start.',
  'Put a rest day in the week before the week fills it for you.',
  'Write three lines tonight: what went well, what did not, and what comes next.',
  'Walk for ten minutes after lunch. A short walk counts.',
  'Tell one person your goal. A goal someone knows about is harder to drop quietly.',
  'Clear your desk at the end of the day, so the next one starts clean.',
  'Say no to one thing this week that does not serve your seven relationships.',
  'Check in on a friend who has gone quiet. People rarely ask first.',
  'Spend five quiet minutes on what you believe in, before the day gets loud.',
  'Count what you finished this week, not only what is left.',
  'If a task keeps moving to tomorrow, make it smaller.',
  'Turn off the alerts you do not need. Each one is someone else’s plan for your time.',
  'Eat one meal today without a screen.',
  'When a task feels pointless, follow it up your pyramid to the reason you started.',
  'Read ten pages of a book instead of ten minutes of a feed.',
  'Ask a client about their goal before you start the work.',
  'Keep one evening a week for family, and guard it like a meeting.',
  'Set a time to stop work today, and stop at it.',
  'Notice the days that feel good, and do more of what they had in common.',
];

/** A line by its key: `p<n>` a philosopher, `a<n>` one of the app's own thoughts, `t<n>` a tip. */
export interface LineOfDay extends DailyLine {
  key: string;
  /** True for a tip (something to do); false for a quote or a thought. */
  tip: boolean;
}
const LINE_KEYS: readonly string[] = [...PHILOSOPHER_LINES.map((_, i) => `p${i}`), ...APP_LINES.map((_, i) => `a${i}`), ...TIP_LINES.map((_, i) => `t${i}`)];
/** Every line "Another one" can show: the philosophers, the app's thoughts and the tips. */
export const LINE_POOL_SIZE = LINE_KEYS.length;
export const TIP_COUNT = TIP_LINES.length;

export function lineByKey(key: string): LineOfDay | null {
  const n = Number(key.slice(1));
  if (!Number.isInteger(n) || n < 0) return null;
  if (key[0] === 'p' && PHILOSOPHER_LINES[n]) return { text: PHILOSOPHER_LINES[n]![0], by: PHILOSOPHER_LINES[n]![1], own: false, tip: false, key };
  if (key[0] === 'a' && APP_LINES[n]) return { text: APP_LINES[n]!, by: '', own: true, tip: false, key };
  if (key[0] === 't' && TIP_LINES[n]) return { text: TIP_LINES[n]!, by: '', own: true, tip: true, key };
  return null;
}

/**
 * The next line for "Another line", the one rule. `seen` is every key shown on this device in the current round (the day's own line
 * included), `last` the one showing now. It never gives a key in `seen`; it alternates a tip and a quote (a philosopher or one of the
 * app's thoughts) while both are left; the order is a shuffle seeded by `seed`, so the same history gives the same next line. When the
 * whole pool has been shown it starts a new round (`fresh`, and the caller clears `seen`), never opening on `last`. `fits` (optional)
 * says whether a line suits the place it is shown (the card on a laptop keeps the quote to one row, 2026-11-06, the founder: "never make
 * the quote more than one line on desktop"): a line that does not fit is passed over, and a round ends when only such lines are left.
 */
export function nextLine(seen: readonly string[], seed: number, last: string | null, fits?: (line: LineOfDay) => boolean): { line: LineOfDay; fresh: boolean } {
  const done = new Set(seen);
  const suits = (k: string) => !fits || fits(lineByKey(k)!);
  const order = seededShuffle(LINE_KEYS, seed);
  const wantTip = last ? !last.startsWith('t') : true;
  const left = order.filter((k) => !done.has(k) && suits(k));
  const pick = left.find((k) => k.startsWith('t') === wantTip) ?? left[0];
  if (pick) return { line: lineByKey(pick)!, fresh: false };
  const roomy = seededShuffle(LINE_KEYS, seed + 1).filter((k) => k !== last && suits(k));
  const again = roomy.find((k) => k.startsWith('t') === wantTip) ?? roomy[0] ?? LINE_KEYS.find((k) => k !== last)!;
  return { line: lineByKey(again)!, fresh: true };
}
