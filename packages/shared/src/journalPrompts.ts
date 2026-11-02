// ---------------------------------------------------------------------------
// kreators.app: journal prompts: a question to write about, with why it helps and what to expect.
//
// The prompts follow the ideas behind four journaling traditions (shadow work, light work, manifestation scripting and 3-6-9 writing). Only the
// themes and methods are used. Every line below is our own wording. Nothing here is copied from a book, and none of it is medical advice.
//
// Private by design: which prompt a person was shown, and which category they chose, stay on their own device. Nothing about prompts goes to the server.
// ---------------------------------------------------------------------------
import type { RelationshipKey } from './index';

export type JournalPromptCategoryKey =
  | 'shadow'
  | 'child'
  | 'triggers'
  | 'selftalk'
  | 'worth'
  | 'release'
  | 'joy'
  | 'energy'
  | 'purpose'
  | 'script'
  | 'm369'
  | 'love'
  | 'money'
  | 'body'
  | 'future'
  | 'weekly';

/** Where a category's ideas come from. */
export type JournalPromptTradition = 'Shadow work' | 'Light work' | 'Manifestation scripting' | '3-6-9 writing' | 'Reflection';

export interface JournalPromptCategory {
  key: JournalPromptCategoryKey;
  name: string;
  /** One line on what the category is for. */
  meaning: string;
  tradition: JournalPromptTradition;
  /** How to write in this tradition, in a line or two: the same advice for every prompt in the category. */
  howTo: string;
  /** The relationship colour this category wears. */
  accent: RelationshipKey;
  /** `heavy` categories can stir strong feelings, so every prompt in them carries a gentle note to stop and get support. `plan` ones are about hopes, so every prompt says it is a planning tool and not a promise. */
  care: 'heavy' | 'plan' | 'none';
}

export interface JournalPrompt {
  /** Stable, like `shadow-03`. */
  id: string;
  category: JournalPromptCategoryKey;
  /** The question or task itself, in the second person. */
  text: string;
  /** What this prompt is for and how to approach it. */
  why: string;
  /** What a person can reasonably expect. Realistic, and never a promise. */
  expect: string;
  /** About how long it takes. */
  minutes: number;
  /** For a prompt with several parts, the parts in order. */
  steps?: string[];
}

/** The note every prompt in a heavy category ends with. */
export const JOURNAL_CARE_NOTE = 'If this brings up something too heavy, stop, take a few slow breaths, and talk with a professional or someone you trust.';
/** The note every prompt about hopes and goals ends with. */
export const JOURNAL_PLAN_NOTE = 'This is a reflection and planning tool, not a guarantee.';
export { JOURNAL_PROMPT_CREDIT } from './index';
/** Said on the card, because a prompt is not therapy. */
export const JOURNAL_PROMPT_SAFETY = 'Prompts are for reflection. They are not therapy or medical advice. If you feel unsafe, call your local emergency number. In India, Tele-MANAS is 14416.';

export const JOURNAL_PROMPT_CATEGORIES: readonly JournalPromptCategory[] = [
  { key: 'shadow', name: 'Shadow work', meaning: 'Meet the parts of you that you hide, deny or push away.', tradition: 'Shadow work', howTo: 'Write fast and plain, and stay curious instead of harsh. You are looking at a part of you, not putting it on trial. Stop whenever you need to.', accent: 'divine', care: 'heavy' },
  { key: 'child', name: 'Inner child', meaning: 'Listen to the younger you who still shapes how you feel.', tradition: 'Shadow work', howTo: 'Write in the present tense, as if the younger you is in the room. Use simple words. Be the calm adult who listens and does not fix.', accent: 'parent_child', care: 'heavy' },
  { key: 'triggers', name: 'Triggers and patterns', meaning: 'Spot what sets you off and what you do next.', tradition: 'Shadow work', howTo: 'Start with what happened, then what you felt, then what you told yourself. Facts first keeps you steady. Look for patterns over time, not one perfect answer.', accent: 'servant_leader', care: 'heavy' },
  { key: 'selftalk', name: 'Self-talk and reframing', meaning: 'Notice the words you use on yourself and try fairer ones.', tradition: 'Reflection', howTo: 'Write the exact words you use, then try a fairer version. The new line should be true enough to believe, not forced cheer.', accent: 'self', care: 'none' },
  { key: 'worth', name: 'Self-worth', meaning: 'Build respect for yourself as you are, not only for what you do.', tradition: 'Shadow work', howTo: 'Write as a fair friend would, with real examples. Do not argue with a kind line. Let it sit on the page for a minute.', accent: 'lover_partner', care: 'heavy' },
  { key: 'release', name: 'Forgiveness and release', meaning: 'Set down what you carry, one thing at a time.', tradition: 'Shadow work', howTo: 'Go slowly and keep it for the page only. You do not need to send or say anything. Letting go is a choice you can make a little at a time.', accent: 'divine', care: 'heavy' },
  { key: 'joy', name: 'Gratitude and joy', meaning: 'Find what is already good, and make more room for it.', tradition: 'Light work', howTo: 'Be specific. A small detail lands better than a big word. Notice how your body feels as you write, and let the good moment stay a little longer.', accent: 'friendship', care: 'none' },
  { key: 'energy', name: 'Energy and boundaries', meaning: 'See what fills you, what drains you, and where to draw a line.', tradition: 'Light work', howTo: 'Use numbers and short lists. You are tracking facts about your time and energy, then choosing one small change.', accent: 'self', care: 'none' },
  { key: 'purpose', name: 'Purpose and calling', meaning: 'Find the work and giving that fit your strengths and values.', tradition: 'Light work', howTo: 'Think in themes, not job titles. Look for what repeats in your answers. Treat each answer as a draft you can change.', accent: 'guru', care: 'none' },
  { key: 'script', name: 'Manifestation scripting', meaning: 'Write the life you want in the present tense, then plan the steps.', tradition: 'Manifestation scripting', howTo: 'Write in the present tense with senses and feelings. Add the steps you would take, so the page turns into a plan. Keep it honest enough that you can believe it.', accent: 'lover_partner', care: 'plan' },
  { key: 'm369', name: '3-6-9 writing', meaning: 'Write one intention 3 times in the morning, 6 at midday and 9 at night.', tradition: '3-6-9 writing', howTo: 'Write by hand if you can, in one calm sitting for each round. Keep the same short line all day. Count the lines, and let your mind rest on the words as you write.', accent: 'guru', care: 'plan' },
  { key: 'love', name: 'Relationships and love', meaning: 'Look at how you give, receive and stay close.', tradition: 'Reflection', howTo: 'Write about your own side first, with lines that start with I. Keep it kind, since you may use this to start a real talk.', accent: 'lover_partner', care: 'none' },
  { key: 'money', name: 'Money and abundance mindset', meaning: 'Look at how you think, feel and act around money.', tradition: 'Manifestation scripting', howTo: 'Mix feelings with facts. Write what you believe, then what you can check. Treat figures as information, not a verdict on you.', accent: 'servant_leader', care: 'plan' },
  { key: 'body', name: 'Body and rest', meaning: 'Listen to sleep, movement, food and the signals your body sends.', tradition: 'Light work', howTo: 'Check in with your body as you write. Short, simple notes are enough. If something worries you, talk to a doctor.', accent: 'self', care: 'none' },
  { key: 'future', name: 'Future self', meaning: 'Picture who you are growing into, and what to do today.', tradition: 'Manifestation scripting', howTo: 'Write in the present tense from a future day, then come back to today and pick one step. The step matters most.', accent: 'guru', care: 'plan' },
  { key: 'weekly', name: 'Weekly reset', meaning: 'Look back, clear space and set up the days ahead.', tradition: 'Reflection', howTo: 'Set a timer, keep answers short and end by picking one change for next week. Do it on the same day each week.', accent: 'friendship', care: 'none' },
];

type P = [text: string, why: string, expect: string, minutes: number, steps?: string[]];

// ---- Shadow work: the parts of you that you hide, deny or push away ----
const SHADOW: P[] = [
  ['Think of a trait in another person that bothers you a lot. Where might a small piece of it live in you?', 'Strong dislike often points at something we have not owned in ourselves. This prompt turns the finger around, gently. You are not saying you are that person. You are asking what the trait might be trying to show you.', 'A clearer view of why one kind of person gets under your skin, and maybe a softer way to meet them.', 8],
  ['Which quality were you told as a child to hide or tone down? Write what it cost you to hide it.', 'Many of us learn early that a feeling or a trait is not welcome, so we tuck it away. Naming it is the first step to seeing what hiding it has cost. Write the facts first, then how it feels now.', 'A short list of qualities you buried and an idea of where to let one back in.', 10],
  ['Finish this line ten times: "I would be embarrassed if people knew that I..." Then circle the one that feels most alive.', 'Shame lives in what we keep out of sight. Writing it for your eyes only lets some of the weight out. You do not have to share any of it.', 'Relief from saying it plainly on the page, and one thread worth following further.', 10, ['Write the line at the top of the page.', 'Finish it ten times without stopping to judge.', 'Circle the one that feels most alive.', 'Write two sentences on why that one stays hidden.']],
  ['Write about a time you were harsh with someone and felt a flash of satisfaction. What need was hiding under it?', 'We all have a part that can be sharp, proud or cold. That part usually protects something soft. Look at the need first, such as respect, safety or control, before you judge the act.', 'A kinder read on your own sharp edges and what they guard.', 10],
  ['What do you envy in other people? Pick one person and list what exactly you want from their life.', 'Envy is often a map of wishes we have not allowed ourselves. The details matter: it may be the freedom, the praise or the rest, not the whole life. This prompt turns envy into direction.', 'A concrete wish you can act on, and less sting the next time envy shows up.', 8],
  ['If your anger could talk for five minutes, what would it say it is protecting?', 'Anger is rarely the first feeling. It often stands in front of hurt, fear or a boundary that was crossed. Let it speak in the first person, without cleaning it up.', 'A better sense of what your anger guards, which makes it easier to respond instead of react.', 8],
  ['Describe the "good person" mask you wear most. What does it let you avoid saying or feeling?', 'A mask is not a lie. It is a tool that helped you fit in. The question is where it now keeps people, and you, from the real thing.', 'Awareness of one habit of pleasing or performing, and one place you could drop it this week.', 10],
  ['Write a short talk between the part of you that wants to rest and the part that says you must keep going.', 'Parts of us often pull in opposite directions. Giving each part a voice lets you hear both instead of letting the loudest win. Write the talk like a script, line by line.', 'A fairer deal between rest and drive, and maybe a plan that honours both.', 10],
  ['What do you judge in yourself most harshly? Write who first taught you that judgement.', 'Many of our harsh inner rules are borrowed from someone else. Seeing where a rule came from can loosen its hold. Ask if it is still true and still useful.', 'A rule you can question, and some distance between you and a voice that is not really yours.', 10],
  ['Write about a secret strength you hide so that others do not feel small. What would happen if you let it show?', 'The shadow is not only dark. Gifts can be pushed down too, out of fear of being too much. This prompt looks at power you dim to stay safe.', 'A gift you are ready to use more openly, and a small first step.', 8],
  ['Where do you say yes while your body says no? Describe the last time, and what you feared would happen if you said no.', 'A hidden no often shows up as a tight chest, a sigh or a sudden tiredness. Listening to it gives you facts about your limits. Link the fear to the fact.', 'A cleaner sense of your real limits and one place to practise a clear no.', 8],
  ['What story do you tell about yourself that you have never checked? Write three facts that support it and three that do not.', 'Old stories feel like truth because we have repeated them for years. Checking the evidence on both sides keeps the story honest. Stay with facts, not feelings, for this one.', 'A looser, more accurate story, and a sense of room to change.', 12, ['Write the story in one sentence.', 'List three facts that support it.', 'List three facts that do not.', 'Rewrite the story so that it fits all six.']],
  ['Which feeling do you find hardest to sit with: sadness, fear, anger, shame or joy? Write how you usually run from it.', 'Most of us have one feeling we avoid with work, food, scrolling or humour. Naming your escape route is not a fault. It is a step toward choosing something else.', 'A clear view of your main escape, so you can notice it in the moment.', 8],
  ['Write a short note to the part of you that you like the least. Begin with "I see you, and..."', 'We rarely talk to the parts we dislike, so they stay stuck. A note of simple attention can shift the tone. You do not need to like it. You only need to meet it.', 'A calmer feeling toward a part you used to push away.', 8],
  ['Describe a dream, a daydream or a fear that keeps coming back. What might it be asking for?', 'Repeating images are worth a look. They do not predict anything. They can point at a feeling or need you have been skipping.', 'One possible meaning to try on, held lightly, and a question to carry for the week.', 10],
  ['When did you last act in a way that did not match your values? Write what led up to it and what you needed.', 'Slips are information, not verdicts. Looking at the build-up shows what was missing, such as sleep, support or time. This is how you learn without shaming yourself.', 'A clear pattern behind the slip and one small fix.', 10],
  ['What do you pretend not to want? Write it out in full, even if it seems selfish.', 'Wants we call selfish often go underground. Writing one in full does not mean you must act on it. It means you stop wasting energy on hiding it from yourself.', 'Honesty about a real want, and a calmer way to decide what to do with it.', 8],
  ['Imagine your shadow is a character in a story. Give it a name, a look and a job. What does it want for you?', 'Giving a shape to what is hidden makes it easier to talk with. Many people find that the character is more protective than scary. Be playful here.', 'A friendlier picture of your hidden side that you can return to.', 12],
  ['What do you do when no one is watching that you would not do in front of others? What does that tell you?', 'The gap between private and public life can show where we hold back. This is not a call to be on show all the time. It asks which part of you wants more room.', 'A small insight on where you could be more at ease in public.', 8],
  ['Write about a time you were praised and felt uncomfortable. What did the praise touch?', 'Praise can bring up feelings of unworthiness or pressure. Looking at your reaction shows how you relate to being seen. Note the body sensations too.', 'More ease with being noticed, and a clue about a belief you hold.', 8],
  ['Which of your fears is really about being rejected? Write the scene you picture, and what you would say to a friend in it.', 'Fear of rejection quietly steers many choices. Writing the scene in detail makes it smaller. Then speak to yourself as you would to a friend.', 'Less charge around one fear, and a kinder script for the moment it shows up.', 10],
  ['What would you do differently this month if you were not afraid of being judged?', 'This prompt points at the choices your shadow is making for you. Pick actions that are small and real. You may find a few are easier than you think.', 'One bold but small action to try this week.', 6],
  ['End the day by writing: "Today I met a hidden part of me when..." Then thank it for what it was protecting.', 'This is a simple closing ritual for shadow work. It trains you to spot hidden parts as they show up in daily life. Thanks helps the part relax.', 'A growing habit of noticing, and a calmer end to the day.', 5],
];
// ---- Inner child: the young you who still shapes how you feel ----
const CHILD: P[] = [
  ['Picture yourself at seven. What are you wearing, where are you, and what do you need most in that moment?', 'Picking a clear age and scene makes the memory easy to reach. Notice small details like the room, the light and the sounds. Then ask what that child needed and did not get.', 'A warm, specific picture of your younger self and one need you can now meet as an adult.', 10],
  ['Write about a game you loved as a child. What did it feel like in your body, and where can you find that feeling now?', 'Play shows us what we find joyful before the world tells us what to want. This prompt brings that feeling forward into your adult life. Think of the feeling, not the game itself.', 'A small idea for adding play to your week.', 8],
  ['What did you hear most often at home about money, feelings or success? Write three sayings, and whether you still repeat them.', 'Early sayings become our inner rules without our noticing. Writing them down lets you test them as an adult. Keep what helps, and set down what does not.', 'A list of inherited rules and a choice about which to keep.', 10, ['Write three sayings you heard growing up.', 'Next to each, write who said it.', 'Mark each one keep, change or let go.']],
  ['Write a short letter from your adult self to you at ten. Tell that child what you wish someone had said.', 'Words from an adult who understands can reach a place that logic cannot. Write in the simple words a ten-year-old would follow. Read it back once, slowly.', 'A softer feeling toward your younger self, and often a deep breath or a few tears.', 12],
  ['Finish: "When I was small, I learned that to be loved I had to..." What would change if that were not true?', 'Children work out how to get love and keep it. The method may have worked then and may be heavy now. Seeing it plainly gives you the choice to try something else.', 'Clarity about a pattern of earning love, and a new idea to test.', 10],
  ['What did you want to be when you were small? Write what you liked about it, beyond the job itself.', 'Early dreams carry clues about your values. The job may have changed, but the reason you liked it can still guide you. Look for the verbs, such as build, help or explore.', 'A theme you can bring into your work or free time today.', 8],
  ['Recall a time you felt proud as a kid and no one noticed. Write what you would say to that child now.', 'Unseen moments leave a quiet mark. You can give the missing notice now. Be specific about what that child did well.', 'A small lift in self-regard, built on a real memory.', 8],
  ['Where in your life today do you feel like a small child again? Write what that moment needs from the adult you.', 'Some moments, like meetings or family visits, pull us back to old feelings. Spot them early, and you can step in as the adult. Ask what care or safety is missing.', 'A plan for one trigger spot, with a kind line to say to yourself.', 10],
  ['Make a list of five comforts you loved as a child. Which one can you give yourself this week?', 'Comfort does not need to be grand. A food, a song, a blanket or a walk can bring back safety. This prompt is about giving yourself what you once needed.', 'A simple, real act of care you can do within days.', 6],
  ['What was it like when you were upset as a child? Who came, or did no one? Write what you needed and what you learned.', 'How adults answered our feelings shapes how we treat our own. This is a gentle look, not a case against anyone. Write what happened, then what you needed.', 'Insight into how you handle your own upset today.', 12],
  ['Draw or describe a safe place from your childhood or your imagination. What is in it, and who is there?', 'A safe place in the mind is a tool you can return to when things feel rough. Add senses: what you can see, hear and feel. The more detail, the easier it is to call up.', 'A calm scene you can use for a minute of rest when stress rises.', 8],
  ['Write down three things that child in you is still waiting to hear. Say them out loud when you are done.', 'Some words are waiting for a voice, such as you are safe, it was not your fault, or you are enough. Reading them aloud adds weight. Take your time and breathe between each line.', 'A felt sense of being cared for by yourself.', 8],
  ['What made you feel small or left out at school? Write what you wish you had known then.', 'School memories carry strong feelings about fitting in. Looking back with more knowledge helps you see that the problem was rarely you. Write as a wise older friend.', 'Less sting from an old memory and more clarity about your belonging today.', 10],
  ['Which toy, place or smell takes you back to feeling safe? Write about it with all five senses.', 'Sense memories reach us faster than thoughts. Writing them down helps you find them when you need them. It also feeds a sense of safety.', 'A small tool for calm that you can use on a rough day.', 6],
  ['Write a conversation between you now and you as a child. Let the child ask three questions.', 'A short script helps a quiet part speak up. Let the child be curious and blunt. Answer in the kindest plain words you have.', 'Surprising questions, and the feeling of having listened to yourself.', 12],
  ['What did you stop doing as a child because it was not safe or not welcome, such as singing, dancing or speaking up? Which one could return in a small way?', 'We often put away parts of our joy to fit in. You can bring one back gently and on your terms. Start small and private.', 'A tiny act of play or expression you can add this week.', 8],
  ['Write about someone who made you feel seen as a child. What exactly did they do?', 'One kind adult can change a life. Naming what they did gives you a recipe to use for yourself and for others. Be as specific as you can.', 'A model of care you can copy, and a sense of thanks.', 8],
  ['List the feelings you were allowed to show at home and the ones you were not. How does that list show up today?', 'Families have unspoken rules about which feelings are fine. The ones that were not welcome often stay stuck. Seeing the list helps you make new rules for yourself.', 'A clearer picture of the feeling you most need to give room.', 10],
  ['What would your child self be proud of in your life now? What would they be worried about?', 'Two views side by side can be fair and balanced. Pride builds trust in your path. Worry points at needs you can still look after.', 'Both a boost of pride and one useful action to take.', 8],
  ['Write about a time you were told "stop crying" or "you are too much". What would you say to that child now?', 'Words like these can stay with us for years. You can answer them now in your own voice. Keep your reply simple and warm.', 'A little release from an old sting, and a new line you can tell yourself.', 10],
  ['Plan a small outing for your inner child: where would you go, what would you do, who would be invited?', 'Care works best when it is acted on, not only written. Plan something simple and doable. Put it on your Daily list if you like.', 'A plan you can enjoy, and a lighter mood while you look forward to it.', 6],
  ['Close the page with a promise to your younger self. Write one thing you will do for them this month.', 'A promise is a way to rebuild trust with yourself. Keep it small enough that you can keep it. Keeping it is what heals the trust.', 'A simple vow that supports self-trust.', 5],
];

// ---- Triggers and patterns: what sets you off, and what you do next ----
const TRIGGERS: P[] = [
  ['Describe the last time you felt a sudden jolt of upset. What happened just before it, in plain facts?', 'A trigger is a moment that sets off a big reaction. Start with facts only: who, where, what was said. Facts keep you steady and show where it really starts.', 'A clear picture of one trigger, free of guesses.', 8],
  ['What did your body do when you were triggered: heat, tight jaw, empty stomach, shaky hands? Write the signs in order.', 'The body often reacts before the mind. Knowing your early signs gives you a few extra seconds to choose. Learn your own order of signs.', 'A personal early warning list you can spot in real time.', 6],
  ['Write the story you told yourself in the moment you were triggered. Then write a second story that is also possible.', 'Triggers come with fast stories, such as "they do not respect me". A second story, even if you are not sure, loosens the first. You are not forced to believe it.', 'A little breathing room between an event and your reading of it.', 10, ['Write what happened as a camera would see it.', 'Write the story your mind added.', 'Write a second, calmer story that could also be true.', 'Notice how your body feels with each.']],
  ['List the people, places or topics that most often set you off. Which two come up most?', 'Patterns are easier to change than single events. A list shows the repeats. Pick the two that cost you the most energy.', 'A short list to watch, and a focus for the week.', 8],
  ['Finish: "When someone ignores me, I feel ____, and then I usually ____." What do you wish you did instead?', 'This simple map links a trigger to a feeling and a habit of response. Once it is on the page, you can design a better response. Keep the new response small.', 'One new response to try the next time it happens.', 8],
  ['What old moment does your most common trigger remind you of? Write the earliest memory that fits.', 'Today\'s reactions often echo older ones. Spotting the echo can lower the charge, because you see that you are partly reacting to then, not only to now. Go gently here.', 'A link between an old hurt and a present reaction.', 12],
  ['Write what you need when you feel triggered, in three words or fewer. Then list who or what could give it.', 'Under every trigger sits a need, like safety, respect or rest. Naming it in few words makes it clear. Then you can ask for it or give it to yourself.', 'A short phrase you can say to yourself, and a way to meet the need.', 6],
  ['Plan a pause: what three actions will you take in the first minute after you feel triggered?', 'A plan made while calm works better than a plan made in the heat. Pick actions that are physical and simple, like a long exhale, a glass of water or stepping outside. Practise once today.', 'A ready-made pause that you can use at once.', 6],
  ['Which trigger of yours is really a tired or hungry body in disguise? Write the times of day it hits.', 'Low sleep, low food and long screens make triggers stronger. Seeing the times of day shows what to adjust. This can be the easiest fix.', 'A schedule tweak that can reduce a pattern.', 8],
  ['Describe a time you reacted and later wished you had not. What would you want to say to that person now?', 'Looking back with kindness helps you learn without piling on shame. Write the line you would say if you could. You do not have to send it.', 'A repair idea, and a lesson for next time.', 10],
  ['Write about a pattern you repeat in friendships, work or love. When did it start?', 'A pattern is a story that repeats. Look for the first time you can remember it. Seeing its start often shows why you still do it.', 'A name for the pattern, and a sense of where it began.', 12],
  ['What do you do when you feel hurt: withdraw, attack, joke, fix, freeze? Write a recent example.', 'Most of us have a go-to move. It protects us but can cost us closeness. Naming yours is the first step to adding a second choice.', 'Awareness of your go-to move, and one new option.', 8],
  ['Make a "glimmer" list: the small things that calm you or lift your mood. Add three you can reach in five minutes.', 'A glimmer is a tiny moment that makes you feel safe or glad. A list helps when your mind goes blank under stress. Keep it handy, and add to it over time.', 'A personal list of quick calm tools.', 8],
  ['Which of your triggers is about control? Write what you are afraid will happen if you let go of it.', 'Control feels like safety. Looking at the fear behind it shows which parts you can truly shape and which you cannot. Be kind to the part that wants to hold on.', 'A clearer line between what is yours to handle and what is not.', 10],
  ['Think of someone who triggers you. Write three things you respect about them and one thing you need from them.', 'Balanced views reduce the heat. Respect and need can exist beside upset. The need becomes a request you can make.', 'A calmer plan for a hard relationship, built on a clear ask.', 10],
  ['Rate your trigger load this week from 1 to 10, and write what drove the number.', 'A simple number lets you see change over time. The reasons tell you what to adjust. Keep the same scale each week.', 'A baseline to compare with next week.', 5],
  ['Write a script for a tough talk about something that bothers you. Start with "When ... I feel ... and I need ..."', 'A simple script keeps a hard talk clear and kind. It places the focus on your feeling and need, not on blame. Practise it out loud before using it.', 'A short, calm script you can use in real life.', 10],
  ['What triggers you online? Write what you read or see, how you feel after, and one rule you could set.', 'Feeds can poke our worries on purpose. Noticing what it does to your mood gives you power to set rules. Be honest about how you feel afterward.', 'One useful rule for your screen time.', 8],
  ['Write about a trigger you have outgrown. How did you change, and what helped?', 'Proof of change is useful. It shows that patterns can shift. Use your own steps as a guide for the next one.', 'A boost of confidence, and a method you can reuse.', 8],
  ['What does your inner critic say right after you are triggered? Write its exact words and answer it as a good friend would.', 'Triggers often lead to a second hit from self-blame. Catching the critic\'s words lets you answer them. Keep the reply short and firm.', 'A softer second reaction after a hard moment.', 8],
  ['Choose one trigger to work on for the next seven days. Write what you will notice, what you will try and how you will check it.', 'Small tests beat big resolutions. A clear plan with a check-in makes it real. Add it as a task on Daily if that helps.', 'A focused one-week experiment and a way to see progress.', 8],
];

// ---- Self-talk and reframing: the words you use on yourself ----
const SELFTALK: P[] = [
  ['Write down the harshest thing you said to yourself this week. How would you say it to a friend instead?', 'We speak to ourselves in ways we would never speak to someone we love. Writing the exact words makes them visible. The swap shows how much tone matters.', 'A gentler version of a line you use often.', 6],
  ['Pick one "I should" from today. Rewrite it as "I could" or "I choose to" and see how it feels.', 'The word "should" carries pressure and guilt. Choice words return your power. If you cannot honestly choose it, ask if it is worth doing.', 'A lighter feeling about a task, or the freedom to drop it.', 5],
  ['Write about a time your fear of a bad outcome was bigger than what truly happened. What did you learn?', 'Our minds practise worst cases. A real comparison of the fear with the result trains a more balanced view. Look at what you did to cope.', 'More trust in your ability to handle things.', 8],
  ['Choose a worry. Write the worst case, the best case and the most likely case.', 'Three cases break the habit of seeing only one end. The most likely case is usually calmer than the worst and less rosy than the best. It helps with planning.', 'A calmer, more realistic view of one worry.', 8, ['Name the worry in one line.', 'Write the worst case.', 'Write the best case.', 'Write the most likely case and one step you can take.']],
  ['Catch one all-or-nothing thought, like "always" or "never". Rewrite it using "sometimes" and add an example.', 'Words like always and never flatten real life. Adding sometimes brings the facts back. Use real examples from your week.', 'A fairer thought to replace a harsh one.', 6],
  ['What label do you put on yourself, such as lazy, clumsy or too sensitive? List three times the label was not true.', 'Labels turn a moment into an identity. Counter-examples break their spell. You do not need to prove the label wrong, just not always right.', 'A looser label, and a more open view of who you are.', 8],
  ['Write the kindest thing a close friend could say about you. Then write which part you find hardest to believe.', 'The part you find hard to believe shows where your self-talk is strongest. It tells you where to look next. Be honest with yourself, not modest.', 'A pointer to one belief about yourself that needs care.', 8],
  ['Replace "I have to" with "I get to" in five lines from your day. Which ones still feel false?', 'This shift can reveal what you value in a day. It also shows what is not really a choice you want. Honesty matters more than cheer.', 'A clearer sense of what you value and what you want to change.', 6],
  ['Write about a mistake you keep replaying. What would you tell a friend who made it?', 'Replaying is a way of punishing ourselves. Friend advice cuts through the loop. Write it as a short, kind note.', 'A calmer view of a past mistake, and permission to move on.', 8],
  ['What do you tell yourself before something new and scary? Write a new line for the moment before you start.', 'The last line you hear before a challenge matters. A short, steady line works best. Test it out loud.', 'A short phrase to use before the next hard thing.', 6],
  ['List five things your inner voice says about money, work or love. Which ones are facts and which are fears?', 'Sorting facts from fears is a core skill. Facts can be checked. Fears can be soothed. Treat each one by its type.', 'A cleaner mind on one important topic.', 8],
  ['Write a sentence that starts with "Even though I feel ___, I can still ___."', 'This pairs a hard feeling with a possible action. It allows both to be true. It is a good way to hold stress and keep moving.', 'A practical line to use when you feel stuck.', 5],
  ['Describe the voice of your inner critic. Is it loud, quick, calm, someone you know? Give it a name and a limit.', 'Making the critic a character makes it easier to talk back to. A named voice is easier to notice. A limit means it cannot run the whole day.', 'A way to spot the critic as it speaks, and a boundary for it.', 8],
  ['What are you telling yourself about your age, background or past that holds you back? Write the counter-evidence.', 'Limits we place on ourselves feel like facts. Looking for counter-evidence is a fair test. People of all backgrounds do what you want to do.', 'A stronger case for your own path.', 10],
  ['Write the compliment you most often wave away. What would happen if you said "thank you" instead?', 'Brushing off praise keeps good news from landing. Practising a simple thank you builds the habit of receiving. Try it with someone today.', 'More ease with receiving kind words.', 6],
  ['Turn a complaint from today into a request. Who could you ask, and how?', 'Complaints are wishes in disguise. Rephrasing them as asks gives them a path. Keep the ask clear and specific.', 'One real ask you can make, instead of a quiet grumble.', 6],
  ['Write three things you did well today, even if small. Then write what each shows about you.', 'The mind notices errors more than wins. This trains your attention on what works. The "what it shows" step turns acts into strengths.', 'A steadier view of yourself at the end of the day.', 6],
  ['What do you say to yourself when you rest? Write the words and decide if you believe them.', 'Many people feel guilty when they stop. Seeing the words helps you change them. Rest is part of doing well.', 'Less guilt and a kinder way to rest.', 6],
  ['Choose a belief you want to try on, such as "I can learn this". Write three small proofs from your past.', 'New beliefs need evidence, and your past has more than you think. Small proofs count. List them and read them again tomorrow.', 'A firmer new belief grounded in real events.', 8],
  ['Imagine your best friend wrote down everything you tell yourself in a day. What would they say to you?', 'Seeing your self-talk through a friend\'s eyes can be eye-opening. It makes tone and content clear. Write their reaction and what they would ask you to change.', 'A fresh view of how you speak to yourself.', 8],
  ['Write a new rule for how you will speak to yourself this week, and one way you will remember it.', 'A simple rule gives your attention a task. Pair it with a cue, like a note on your phone. Review it at the end of the week.', 'A steady shift in tone, with a check-in.', 5],
];
// ---- Self-worth: valuing yourself as you are ----
const WORTH: P[] = [
  ['Write ten things about you that have nothing to do with what you do or own.', 'Worth that depends on output is fragile. This list looks at who you are when no one is clapping. Include small things, like how you listen or what makes you laugh.', 'A steadier base for your self-respect.', 8],
  ['When do you feel you must earn rest, love or praise? Write one example and what it costs you.', 'Many people work for worth as if it were a wage. Noticing the trade shows its price. Then you can ask if the price is fair.', 'Awareness of one place where you overwork for approval.', 10],
  ['Write about a time someone treated you as if you mattered. What did they do, and what did it say about your worth?', 'Good treatment is a mirror. It reminds you of what you are worth to others. Let yourself take it in without arguing.', 'A real memory you can lean on when doubt creeps in.', 8],
  ['What do you believe you do not deserve? Write where that belief came from and one fact that argues with it.', 'Beliefs about what we deserve often shape what we reach for. Tracing the source weakens the grip. Facts give you something to hold.', 'A crack in a limiting belief and a firm counter-fact.', 10],
  ['List five boundaries you would set if you fully believed your time was valuable.', 'Self-worth shows up as boundaries. Writing them while calm tells you what you truly want. You do not need to set all five today.', 'A first step toward one boundary.', 8],
  ['Write a short thank-you note to your body for one thing it did for you this week.', 'Many of us only notice our bodies when they annoy us. Thanks builds respect. It is a gentle way to practise valuing yourself.', 'A warmer feeling toward your body.', 5],
  ['Who do you try hardest to impress? Write what you hope they will think and what you will do if they do not.', 'Seeking approval is human. Seeing the stakes lets you choose how much effort to spend. The last question helps you plan for the case where the answer is no.', 'Less pressure around one relationship.', 10],
  ['Name three times you stood up for yourself, even a little. What gave you courage?', 'Memories of courage are proof. Pulling out the source of your courage gives you a recipe. Small acts count.', 'A reminder that you can speak up, and what helps you do it.', 8],
  ['Finish ten times: "I am worthy of..."', 'Short, repeated lines can open up what you really want. Some will feel odd. Notice which ones stir a feeling and which ones you want to argue with.', 'A set of wishes you take seriously, and a sense of which ones need more care.', 8],
  ['Write about a compliment you received this month and how you answered. How would you like to answer next time?', 'Receiving well is a skill. Replaying a recent example helps you plan a better reply. It also helps you hold the good words longer.', 'A ready reply for next time.', 6],
  ['What do you hide because you are afraid it will make you look weak? Write it, then write how a brave friend might see it.', 'What we call weak is often only human. A brave friend sees the honest part. Try to write from their view.', 'More respect for your own softer side.', 10],
  ['Write down your five best qualities. Ask one person you trust to name one more, and write what they said.', 'We are often blind to our own gifts. A trusted view adds a missing piece. It is also a nice way to connect.', 'A fuller and more accurate list of your strengths.', 10],
  ['Describe a day where you treat yourself as you would treat someone you deeply respect. What changes from morning to night?', 'This is a gentle design exercise. It sets a standard of care and shows the gap between it and today. Pick the smallest change to start.', 'A picture of daily self-respect and one first change.', 12],
  ['Where do you shrink to make others comfortable? Write what you would say or do if you took up your full space.', 'Shrinking can look like staying quiet, laughing off ideas or saying sorry too much. Seeing where you do it is the first step. Write in the first person and be specific.', 'A clearer sense of where to speak up with ease.', 8],
  ['Make a list of things you forgive yourself for, starting with the small ones.', 'Self-worth needs room to be imperfect. Forgiveness is practice, and small items are a good place to start. Each line is a small release.', 'A lighter load and a gentler tone.', 8],
  ['What do you wish people knew about how hard you try? Write it as a short speech.', 'Effort often goes unseen. Saying it on the page makes it real. It can also show you which effort you want to put down.', 'Relief from being understood by yourself.', 8],
  ['Write a list of 20 small wins from the past year, from big to tiny.', 'Our memory favours failure. A long list pushes back and shows real progress. The tiny wins matter as much as the big ones.', 'A surprising list of progress to be proud of.', 12],
  ['Compare yourself to who you were two years ago. What has grown, softened or become wiser?', 'Comparing with your past self is fairer than comparing with others. It shows growth that daily life hides. Look at skills, but also at values and calm.', 'A sense of your own journey and where you are going.', 10],
  ['Write about a decision you made that you are proud of, even if no one saw it. What did it show about your values?', 'Quiet choices reveal who we are. Looking back at one shows your character at work. Name the value behind it.', 'A clear value to lean on in the next hard choice.', 8],
  ['What would change this week if you believed you were already enough? Write three small actions.', 'This prompt moves from belief to behaviour. You do not need to feel fully enough to act as if you are. Pick actions that are small and real.', 'Three concrete steps that match the worth you are building.', 8],
  ['Write yourself a short and kind reference letter, as if for a job you deeply want.', 'References are written with warm facts. Doing it for yourself gives you a fair and specific view. Use real examples.', 'A page you can reread when doubt shows up.', 12],
];

// ---- Forgiveness and release: setting down what you carry ----
const RELEASE: P[] = [
  ['Write the name of someone you are still upset with. What do you wish they had done?', 'Naming a wish clarifies the hurt. Often we want an apology or care that never came. Seeing it plainly is the first step to not waiting for it.', 'A clearer sense of what is still open, and what you can let go of.', 10],
  ['What are you holding onto that no longer serves you? Write what it gave you at first and what it costs you now.', 'Everything we carry once had a reason. Seeing both sides lets you choose with respect for your past. Letting go is easier when you honour why you held on.', 'A calm decision about one thing to put down.', 10],
  ['Write an unsent letter to someone who hurt you. Say everything. Do not send it.', 'The page can hold what you cannot say out loud. Unsent letters let anger and sadness move out of your body. Burn, delete or keep it, as you like.', 'A sense of release and a lighter chest. It can also bring tears.', 15],
  ['Write an unsent letter to someone you hurt. What do you want them to know?', 'Owning our part is a quiet form of strength. You do not need to send it. It is about being honest with yourself.', 'Less weight from guilt and a possible plan for repair.', 15],
  ['List three things you are still blaming yourself for. Next to each, write what you knew back then.', 'Hindsight makes old choices look simple. Writing what you knew at the time is fair to the person you were. It is the heart of self-forgiveness.', 'A kinder view of your younger decisions.', 10],
  ['Finish: "I forgive myself for..." Write until you run out of lines.', 'Forgiveness is not forgetting. It is deciding not to punish yourself any more. Let the list grow without edits.', 'A lighter feeling and a list you can reread.', 10],
  ['What is the difference between forgiving someone and trusting them again? Write how it applies to one person.', 'You can forgive and still keep distance. These are separate choices. Clarity helps you protect yourself while you heal.', 'A boundary that sits beside peace.', 8],
  ['What do you need before you can let go of a grudge? Write three things, big or small.', 'Letting go often needs something first, such as being heard, time or a changed situation. Naming the need makes it a plan. Some needs you can give yourself.', 'A clear path through a stuck feeling.', 8],
  ['Write about a time you were forgiven and what it felt like.', 'Remembering receiving grace makes giving it easier. Notice the body sensations. Use them as a guide.', 'More openness to forgive, based on your own experience.', 8],
  ['What old story do you tell about being wronged? Write it once in full, then write it again in three short lines.', 'The long version holds the pain, and the short version holds the lesson. Moving from long to short is a form of release. You choose what stays.', 'A shorter, lighter story you can live with.', 10, ['Write the whole story as you tell it now.', 'Cut it down to three plain lines.', 'Add one line about what you want next.']],
  ['Where in your body do you hold old hurt? Rest a hand there and write what comes up.', 'The body keeps count of stress and sadness. Paying kind attention can soften it. Stay short and gentle if it feels heavy.', 'A little more ease in the body and a sense of what needs care.', 8],
  ['List the things you are waiting for an apology about. Which could you let go of without one?', 'Waiting for an apology can keep us tied to the person. Some hurts can be put down without it. Choose the ones that fit.', 'Freedom from at least one waiting game.', 8],
  ['Write a closing note to a chapter of your life that is over. Thank it for what it gave you, and say goodbye.', 'Endings need marks. A note of thanks lets you leave with respect. This works for jobs, homes, friendships and seasons.', 'A sense of closure and room for the next chapter.', 12],
  ['What would you do with the energy you spend on resentment if it were yours again?', 'Resentment takes a daily share of your attention. Imagining what you would do with it is motivating. Aim for specific, small plans.', 'A reason to let go that feels positive, not forced.', 8],
  ['Write about a relationship that ended without a talk. What do you wish you had said?', 'Unfinished talks stay in the mind. Saying it now on the page lets you close the loop. Add what you would want to hear back.', 'Some peace with an open ending.', 12],
  ['Think of a person who is hard to forgive. Write three facts about their life that explain, but do not excuse, what they did.', 'Understanding is not approval. Context can lower the heat and let you move on. If it feels too much, stop and come back another day.', 'Less intensity around a hard memory.', 10],
  ['Make a list of what you want to leave behind this month, and one small act for each.', 'Release works best with a physical act. It can be deleting a number, clearing a shelf or sending a short text. Pick acts that feel right.', 'A short plan to clear space.', 8],
  ['Write about a grief you have not fully made room for. What would help you honour it?', 'Grief does not follow rules. Writing about it gives it a place to be. Honour it with a ritual, a walk, a song or a call.', 'A calm sense of being allowed to feel it.', 12],
  ['What would it feel like to forgive without telling the person? Write the scene.', 'Forgiveness can be private. Imagining it shows if you are ready and what it would change. It is for you, not for them.', 'A felt sense of peace you can work toward.', 8],
  ['Write down what you learned from someone who hurt you. Then write a line of thanks for the lesson, not for the pain.', 'Finding a lesson does not make the hurt right. It lets you take something back. Keep the thanks for the learning only.', 'A sense of power gained from a hard time.', 8],
  ['Finish the week with this line: "This week I let go of..." Then write how you will mark it.', 'A weekly act of release prevents build-up. Marking it with a small act makes it real. Keep it light.', 'A regular, easy way to clear mental clutter.', 5],
];

// ---- Gratitude and joy: finding what is already good ----
const JOY: P[] = [
  ['Write five things you are grateful for today, and one detail about each.', 'Detail makes gratitude real. "My friend" is flat, while "my friend sent a joke at noon" is alive. Details help the good moment sink in.', 'A brighter mood and sharper eyes for what is good.', 6],
  ['What small moment made you smile in the last 24 hours? Write it as a scene.', 'Small joys are easy to miss. Writing the scene lets you enjoy it twice. Notice the sounds, colours and feelings.', 'A warm feeling and a habit of spotting small joys.', 5],
  ['Who made your life easier this month? Write a thank-you message to one of them. Send it if you wish.', 'Thanking people strengthens bonds. A few honest lines are enough. Say what they did and what it meant.', 'A closer link with someone, and a good feeling for you both.', 8],
  ['List ten things you enjoy that cost nothing.', 'Joy does not need a budget. A list reminds you that rich days can be simple. Keep it where you can see it.', 'A free menu of mood lifters.', 6],
  ['Describe your perfect ordinary day. What time do you wake and what makes it good?', 'Ordinary days make up most of life. Designing a good one shows what you actually value. Use it to improve a real day.', 'One or two changes that can brighten your normal week.', 10],
  ['What are you looking forward to in the next seven days? If nothing, plan one thing.', 'Anticipation is a source of joy. Having something small ahead lifts the mood now. Plan it so that it is easy to do.', 'A planned moment of joy and a lighter week.', 5],
  ['Write about a place that makes you feel at peace. What is there, and how can you visit it, even in your mind?', 'Places hold feelings. Naming what it is about a place helps you recreate it. A quick mental visit can calm you.', 'A calm tool you can use in a short break.', 8],
  ['What is something you have now that your younger self wished for? Write how it feels to have it.', 'We adapt quickly to what we gain. Remembering the wish brings the value back. It is a strong gratitude trigger.', 'A fresh thankfulness for something familiar.', 8],
  ['Write about a time you laughed so hard you cried. What made it special?', 'Laughter is a clue about the people and settings that suit you. Recalling it helps you seek more. It also lifts your mood in the moment.', 'A better mood and an idea for who to call.', 6],
  ['Name three things your body did for you today without being asked.', 'Breath, heartbeat and sight are daily gifts. Thanks for them is humbling and grounding. It shifts focus from flaws to function.', 'Respect for your body and a calmer mind.', 5],
  ['What is a difficulty from last year that you are now glad happened? Write what it gave you.', 'Looking back often reveals gifts that were hidden at the time. You do not have to like what happened. You can still see what grew.', 'A more balanced view of hard times.', 10],
  ['Describe a meal, a drink or a snack you enjoyed this week using all five senses.', 'Slowing down to sense a small pleasure trains attention. It also makes ordinary moments feel richer. Choose something simple.', 'More savouring and less rushing.', 5],
  ['List three people who would be happy to hear from you today. Pick one and send a message.', 'Reaching out is a source of joy for both sides. People often feel pleased to be remembered. A short note is enough.', 'A fresh link with someone and a boost to your day.', 6],
  ['Write about a win from this week, however small. How did you help it happen?', 'Wins grow when we notice them. Looking at your part builds a sense of skill. Take a moment to enjoy it.', 'A confidence boost grounded in real facts.', 5],
  ['If joy were a colour, a sound and a smell, what would it be for you? Write how to bring all three into this week.', 'Using senses makes joy easier to find. This prompt is playful and creative. Pick small ways to add each one.', 'Three simple ways to bring more joy into daily life.', 8],
  ['Write down five glimmers from today: tiny moments that felt calm, kind or bright.', 'A glimmer is a short moment of safety or delight. Tracking them trains your attention to find more. Do this each night for a week.', 'A brighter view of the day, and a growing list of what helps.', 5],
  ['What do you appreciate about your home, your work and your community? Write one line for each.', 'Widening the lens helps you see the many places support lives. It is a good prompt for a flat mood. Be specific in each line.', 'A broader sense of support.', 8],
  ['Who taught you something that you use every day? Write what they taught and how you use it.', 'We often forget how many people shaped us. Naming a teacher honours them. It can also inspire you to teach someone else.', 'A moment of thanks and a link to the people who shaped you.', 8],
  ['Write a short love letter to your life as it is right now, with the flaws included.', 'Loving a life that is not perfect is a skill. This is not about denying problems. It is about holding thanks and wishes together.', 'A warm feeling toward the present.', 12],
  ['What makes you feel most alive? Write about the last time and how to get more of it.', 'Aliveness points to your values and interests. Look at what you were doing, who you were with and what the setting was. Aim for a simple repeat.', 'A pattern that you can plan into your week.', 10],
  ['Make a list of 15 small pleasures from your day and mark which ones you can repeat tomorrow.', 'A long list proves that your days hold more pleasure than you notice. Marking repeats turns noticing into planning. Keep it light.', 'A better mood and a to-do list that is nice to follow.', 8],
  ['Write a gratitude line for something that did not go well, such as what it taught you or protected you from.', 'This is advanced gratitude. It is not about pretending. It is about finding the use in a rough moment, if one exists.', 'A little more peace with a setback.', 8],
];
// ---- Energy and boundaries: what fills you, what drains you, and where you draw the line ----
const ENERGY: P[] = [
  ['List what gave you energy this week and what took it. Which list is longer?', 'Your energy is a budget. A plain list shows where it goes. Count the items and note the surprise entries.', 'A clear picture of your energy gains and drains.', 8],
  ['Rate your energy from 1 to 10 at morning, noon and night for a day. What drove each number?', 'Energy changes through the day. Three readings reveal your rhythm. Use it to place hard tasks at your best hour.', 'Your daily energy pattern and a better plan for your Daily list.', 6, ['Note a number from 1 to 10 in the morning.', 'Note it again at noon.', 'Note it at night.', 'Write what drove each number.']],
  ['Who leaves you feeling lighter after you meet? Who leaves you tired? Write what each person does differently.', 'Time with people changes our energy. This is not about blame. It is about choosing how much time and what kind of time to give.', 'Better choices about who gets your time and how.', 10],
  ['Write the three boundaries you most need right now. Which is the easiest to set first?', 'Starting with the easiest builds confidence. A boundary is a clear line about what you will and will not do. Keep each line short.', 'A starting boundary and a plan for two more.', 8],
  ['Write the exact words you would use to say no to a request this week, kindly and clearly.', 'Having words ready makes a no easier. Short beats long. You do not owe a long reason.', 'A ready-made line for a real moment.', 6],
  ['Where do you say sorry for things that are not your fault? Replace each with a different phrase.', 'Over-apologising can drain you and blur your meaning. "Thank you for waiting" is often a better line than "sorry I am late". Practise swaps.', 'Cleaner, more confident speech.', 6],
  ['What is the one task you keep doing that someone else could do? Write how you would hand it off.', 'Holding on to everything wastes energy. A hand-off plan makes letting go feel safer. Be clear about what done looks like.', 'A task off your list.', 8],
  ['Describe a time you overstretched yourself. What were the first signs, and what would you do differently?', 'Early signs of burnout are easy to miss. Naming them helps you act sooner. Write them as a short checklist.', 'A personal warning list for overload.', 10],
  ['What do you need less of in your life? Write three things and one step to reduce each.', 'Less is a powerful goal. Removing a drain often gives more than adding a boost. Start with one small cut.', 'A short list of cuts that free up energy.', 8],
  ['Write about a boundary you set that went well. What made it work?', 'Success leaves clues. Look at your timing, tone and words. Use them to set the next one.', 'A recipe for setting a good boundary.', 8],
  ['How do you recharge: alone, with people, in nature, through movement? Write the top three ways and when you last did them.', 'Different people refill in different ways. Knowing yours helps you plan the week. If it has been a while, add one to your Daily list.', 'A plan to refill your tank.', 8],
  ['What does your phone take from you each day? Write one change that would give back an hour.', 'Screen time can hide in small gaps. Pick a change that is simple, like a phone-free first hour. Test it for a week.', 'A new rule for your phone and more time for yourself.', 8],
  ['Write the ways you give your energy away to be liked. Which could you stop?', 'People-pleasing costs energy and can hide your real self. Picking one place to stop is enough for now. Think about what you might gain.', 'More energy and more honest relationships.', 10],
  ['Describe your ideal morning in six steps. Which step could you do tomorrow?', 'A good morning sets the tone. Small steps are easier to repeat than a big plan. Pair it with the routine on Daily if you use it.', 'A simple morning plan with a real first step.', 8],
  ['What are you tolerating that you do not have to? Write five items, from small to large.', 'Little annoyances add up. Lists of things we put up with show what can be fixed. Fix the small ones first.', 'Quick wins that clear mental clutter.', 8],
  ['Write about a place, such as a room or a corner, that feels calm. How can you protect it?', 'Spaces affect our energy. A calm place is a resource worth guarding. Think about light, noise and order.', 'A safe spot for rest.', 6],
  ['When does your work spill into your rest? Write one rule that would draw a clearer line.', 'Work that never ends drains you. A simple rule, like a shut-down time, helps. Share the rule with the people it affects.', 'A better balance of work and rest.', 8],
  ['Which of your commitments no longer match who you are? Write a kind way to step back from one.', 'Our lives get full of old yeses. Reviewing them is healthy. A kind message can end a commitment with respect.', 'A lighter calendar and a plan to say it well.', 10],
  ['What helps you feel safe in your body? Write three things you can do in two minutes.', 'Quick tools matter in the moment. Examples are slow breathing, cold water or pressing your feet into the floor. Test them today.', 'A short toolkit for calm.', 6],
  ['Write a letter to your future self about the boundaries you want to keep.', 'A letter to your future self gives you support when you wobble. State your reasons clearly. Put the date on it to read again.', 'A message of support at the time you need it.', 10],
  ['Write about what you do when someone crosses a line. How would you like to respond?', 'Knowing your response before it happens helps you stay calm. Plan a few words and a few actions. Keep them clear and fair.', 'A response plan for a hard moment.', 8],
  ['Name one yes you want to give more of this month. What would you need to say no to make room?', 'Every yes costs a no somewhere. Choosing which yes you want makes your no easier. Write both sides of the trade.', 'A clear priority and a way to protect it.', 8],
];

// ---- Purpose and calling: what you are here to build and give ----
const PURPOSE: P[] = [
  ['List the talents people thank you for. Which one feels most like you?', 'Others often see our gifts before we do. Look for repeated thanks and small compliments. The gift that feels easy to you is a strong clue.', 'A shortlist of strengths to build on.', 8],
  ['What problem in the world makes you care the most? Write why it matters to you.', 'Purpose often grows from what upsets us in a useful way. Naming the problem and your reason ties your values to action. You do not need to fix it all.', 'A theme for your work and giving.', 10],
  ['Describe a day when you felt fully absorbed in what you were doing. What was the task, and what was the setting?', 'Deep focus points to work that suits you. Look at the type of task, the people and the time of day. Use these clues to shape your week.', 'A pattern to seek out in your work.', 10],
  ['Write your answer to "Who do I help, and how?" in two lines. Then shorten it to one.', 'A short line of purpose helps you decide what to say yes to. It can change over time. It is a working draft, not a promise.', 'A clear line you can use to guide choices.', 8],
  ['What would you do if money were not a worry for a year? Write the first week in detail.', 'This takes away the pressure of survival so that wants show up. The first week reveals what you reach for. Look for themes, not one big dream.', 'A glimpse of what you value most.', 10],
  ['What have you done that you hope people remember? Write it in a few lines.', 'Legacy is a way of looking at purpose. Even a small thing can count. Ask what you want to add.', 'A clearer sense of what matters.', 8],
  ['Write about a person you admire. What do they do that you would like to learn?', 'Admiration is a signpost. It points at the qualities you want to grow. List behaviours, not just the person\'s fame.', 'Three habits or skills to try.', 8],
  ['What would you like to be known for in your field, community or family? Write three words and a short reason for each.', 'Reputation is a result of daily choices. Picking words gives you a compass. Check each week if your actions match.', 'Three guiding words for your choices.', 8],
  ['List five things you would do for free. Which could become part of your work or your giving?', 'What you do for love often points to a calling. It does not have to become a job. Think of ways to include it in your life.', 'Ideas for bringing love into your work.', 8],
  ['Write about a time you helped someone and felt that it mattered. What exactly did you do?', 'Helping moments reveal what kind of impact feels meaningful. Look at your role, your skill and the result. Repeat what worked.', 'A clue about how you like to contribute.', 8],
  ['Name your top five values. Then name where each one shows up in your week and where it is missing.', 'Values are the base of a good life. Checking against your week shows gaps. Missing values often cause a vague sense of unease.', 'A values check with one gap to fix.', 12, ['List your top five values.', 'Write where each shows up this week.', 'Mark the one that is most missing.', 'Write one action to bring it in.']],
  ['What are you doing now that does not match your purpose? What would a first step away look like?', 'Honest checks protect you from drifting. You do not have to quit anything today. A first step might be a talk, a plan or a small test.', 'A realistic first move toward a better fit.', 10],
  ['Write the story of your work so far as a short adventure. Where are you in it?', 'Seeing your path as a story shows its plot. You may see strengths and turning points. Add what the next chapter could be.', 'A bigger view of your path.', 12],
  ['What project would you start if you knew you could not fail? Write the first three steps.', 'Removing fear of failure shows where your energy goes. The three steps make it concrete. Choose one to do this week.', 'A project idea and a first real move.', 8],
  ['Describe your dream workday from morning to evening. Who is around, and what do you create?', 'A detailed picture shows what matters. You can compare it with today to find gaps. Pick the easiest gap to close.', 'A target day and a small step toward it.', 10],
  ['What do you want to learn in the next year? Write why, and who could teach you.', 'Learning is a path to purpose. A reason keeps you going and a teacher speeds you up. School and Knowledge in the app can help.', 'A learning goal with a plan.', 8],
  ['How can you serve one person this week using what you are best at?', 'Purpose lives in action. Choosing one person makes it simple. Think of a small and real gift of time or skill.', 'A planned act of service.', 6],
  ['Write about a failure that pointed you toward something better. What did it clear away?', 'Detours often lead to a fit. Seeing the pattern builds trust in your path. Note what you carry forward.', 'More faith in the way forward.', 10],
  ['List your three biggest goals. Next to each, write whether it comes from your own wish or from other people\'s expectations.', 'Goals from other people do not give lasting satisfaction. Separating them is clarifying. You can still keep a goal that began elsewhere if you now own it.', 'Goals that are truly yours.', 10],
  ['What would you teach if you had to give a talk tomorrow? Write the title and three points.', 'What you would teach shows what you know and care about. Even a rough outline reveals your voice. Share it with a friend if you like.', 'A topic you can write, speak or build around.', 10],
  ['Write about the kind of impact you want to have on your family, friends and work. One line each.', 'Impact starts close to home. Thinking about the people nearest you keeps purpose human. Compare the lines and see where your time goes.', 'A balanced view of your goals.', 8],
  ['Pick one pillar from your map. Write what a meaningful next project in it would be.', 'The pillars give shape to your life. A project turns a wish into action. Make it small enough to start this month.', 'A project idea that fits a pillar you care about.', 8],
];

// ---- Manifestation scripting: writing the life you want as if it is happening ----
const SCRIPT: P[] = [
  ['Write a paragraph in the present tense: "It is a normal morning in my life, a year from now..."', 'Writing in the present tense helps your mind picture and plan. Describe small things like what you eat, wear and feel. This is a planning and focus tool, not magic.', 'A clear picture of the life you want, and often a few ideas for action.', 12],
  ['Write a thank-you note for something you hope will happen, as if it already did. Say what it means to you.', 'Scripting uses thanks to give a goal an emotional tone. Be honest about the hope. Notice what the note shows you about why it matters.', 'A clearer feeling of why you want this goal.', 8],
  ['Script a conversation where you receive good news about your work. Who tells you, and what do they say?', 'Imagining news helps you see the goal as a real event. Write the scene with sound and feeling. Add the steps you took that led there.', 'A vivid goal and a list of steps to try.', 10],
  ['Describe the home you are building towards. Walk through each room.', 'A walk-through is a concrete way to dream. It uncovers details you care about. Note which parts you can start on now.', 'A clear vision of your space and a few steps to move toward it.', 12],
  ['Write the story of how you became the person you want to be, as if looking back from five years ahead.', 'Looking back from the future gives you a sense of the path. Be sure to include the hard parts and what you did. It makes the story believable.', 'A plan that feels honest and doable.', 15],
  ['Write ten lines that begin "I am" about the life you are building, using words you can believe today.', 'Lines you cannot believe make your mind argue. Choose words that feel true enough. Stretch a little, not a lot.', 'A set of statements you can read each morning.', 8],
  ['Script your ideal week. What are you doing on Monday, Wednesday and Saturday?', 'Dreaming about ordinary days is more useful than dreaming about one big day. It shows the routine that fits your goal. Compare it with this week.', 'A week to aim for and one change to make now.', 10],
  ['Write a letter from the person you want to become, to you now. What do they say about what they learned?', 'This is a way to hear advice from your own wisdom. Write in their voice. Use plain, warm words.', 'Advice you can use, and motivation to act.', 12],
  ['What one goal do you want to focus on in the next 90 days? Write it in the present tense and add two actions.', 'A narrow focus beats a long list. Present tense makes the goal feel close. Actions turn the wish into a plan.', 'A single, active goal with a clear first move.', 10],
  ['Script how you feel when you reach a goal. Where are you, who is there, what do you say?', 'Feeling is a strong fuel. Describe the body as well as the mind. Use it when your drive is low.', 'A refill of motivation.', 8],
  ['Write about your relationship with your work in a year. How do people talk about you, and how do you start your day?', 'This blends vision with identity. It is about how you want to be as well as what you do. Add the habits that match.', 'A clearer working identity.', 10],
  ['Imagine a day of ease and flow. Write what you do and notice about it, hour by hour.', 'Flow is what happens when challenge and skill meet. Writing about it shows the conditions you need. Pick one to set up this week.', 'A recipe for a smoother day.', 10],
  ['Write a short scene of you saying yes to an opportunity you are not sure you are ready for.', 'Practising a yes in your mind lowers fear. Include your doubts and your reply to them. Notice which step you could take for real.', 'Less fear and a possible next move.', 8],
  ['Script a day of showing up fully with your family or friends. What do you do and say?', 'Relationships benefit from planned presence. Describe small acts, like listening and putting your phone away. Choose one to try this week.', 'A simple plan for being more present.', 8],
  ['Write down what you believe stands between you and your goal. Then script how you move past it.', 'Naming a block takes away some of its power. The script gives you a path. Make the path realistic.', 'A plan for the main obstacle.', 10],
  ['Write the headline and first paragraph of an article about your success. What are you proud of?', 'Seeing the goal as news shows its core. The headline makes you pick the main point. Keep it honest and specific.', 'A clear and compact picture of your aim.', 8],
  ['List 20 things you want to experience in the next three years. Mark the three that matter most.', 'Lists reveal your wants. Ranking helps you focus. Revisit it each quarter.', 'A bucket list with priorities.', 10],
  ['Script a day where you feel safe, loved and calm. Describe the details of how that feels in your body.', 'Feelings of safety can be rehearsed. Writing the body details gives you something to recall. It helps most on days when you are anxious.', 'A calming scene for your mind.', 10],
  ['Write down a goal, then write how you will know it has happened. Give three signs you could measure.', 'Clear signs turn wishes into targets. Signs should be observable, like numbers or events. This helps you notice progress.', 'A goal that you can track.', 8],
  ['Write yourself a "permission slip" for something you want to try. Date and sign it.', 'Permission slips are playful and effective. They give you a firm yes. Keep it where you can see it.', 'A nudge to start something you have been delaying.', 5],
  ['Script a morning routine that matches the person you are becoming. Which part will you try tomorrow?', 'Routine is how a vision becomes real. Choose the one step that feels most exciting. Tell yourself you can adjust it.', 'A small, real step into the new routine.', 8],
  ['Write about what you would do if you were sure that things would work out. Then pick one thing to do anyway.', 'Imagined certainty can show where fear is steering. You do not have it, but you can take a step as if you did. This is a reflection and planning tool, not a promise.', 'A first action that is braver than usual.', 8],
];
// ---- 3-6-9 writing: one intention, written 3 times in the morning, 6 at noon and 9 at night ----
const M369: P[] = [
  ['Start the practice: pick one intention for today and write it as one short sentence in the present tense.', 'The 3-6-9 method is a simple focus ritual. You pick one intention and write it by hand three times in the morning, six at midday and nine at night. Keep the sentence short, positive and in your own words.', 'A clear sentence to carry through the day, and a sense of calm focus.', 5, ['Choose one thing that matters today.', 'Write it as a short sentence in the present tense.', 'Check that it sounds like you and feels believable.']],
  ['Morning round: write your intention three times. After each line, write one word for how it feels.', 'The morning round sets your direction. Three slow lines are enough. The feeling word makes you pay attention, not just copy.', 'A calm start and a clearer mind for the day.', 5, ['Write the intention once.', 'Write one word about how it feels.', 'Repeat two more times.']],
  ['Midday round: write your intention six times. Between lines, take one slow breath.', 'Midday is when focus fades. Six lines with a breath between work as a reset. If your day is busy, a quiet two minutes is enough.', 'A mid-day reset and a return to your aim.', 6, ['Find a quiet spot for two minutes.', 'Write the intention six times.', 'Take one slow breath between each line.']],
  ['Night round: write your intention nine times. Then list three things that moved you toward it today.', 'The night round closes the day. Nine lines let the idea settle before sleep. The list ties the words to real actions.', 'A calm close to the day and proof that you moved forward.', 10, ['Write the intention nine times by hand.', 'List three things that moved you toward it.', 'Note one thing for tomorrow.']],
  ['Write the full 3-6-9 for a goal you have right now. Mark how you feel after each round.', 'Doing the full method for one day shows how it works for you. Notice which round helps most. This is a focus tool, and the benefit comes from attention and action, not from the numbers themselves.', 'A felt sense of the practice and a baseline for the week.', 15, ['Morning: write the line 3 times.', 'Midday: write it 6 times.', 'Night: write it 9 times.', 'Mark how you feel after each round.']],
  ['Choose an intention about how you want to feel this week. Write it three times and say why it matters.', 'Feelings make strong intentions. "I feel steady and kind" is a good example. The why keeps it from being a slogan.', 'A mood target for the week.', 5],
  ['Write an intention about your health in the present tense. Add one small action you will do to back it up.', 'Words work best when matched with action. Pair the line with one simple step, like a walk. Health goals are about care, not guarantees.', 'A line you can repeat and a step you can take.', 6],
  ['Write an intention about work or a project. Pick words that describe the effort, not only the result.', 'You control the effort more than the result. An intention like "I do focused work for an hour" is within reach. It is easier to keep than one about outcomes you cannot control.', 'A steadier drive that is not tied to luck.', 6],
  ['Write an intention about a relationship. Describe how you want to show up, not how you want them to act.', 'You can only change your own part. A line like "I listen with patience" is yours to keep. It can quietly shape the relationship.', 'A clear way to behave and a calmer mind in a hard bond.', 6],
  ['Write an intention about money. Use a sentence about your actions, such as saving, learning or asking.', 'A money line works best with a task. "I check my spending each Friday" is practical. It turns worry into a routine.', 'A concrete habit around money.', 6],
  ['Look at your last seven intentions. What do they have in common, and what do they show you?', 'Patterns across intentions reveal what you really want. Look for repeated words. Use them to shape the next week.', 'A theme for your goals.', 8],
  ['Write your intention nine times at night, and after the last line write what you are letting go of today.', 'Evening writing can double as release. Nine lines build calm, and naming what you let go of clears the mind. It makes sleep easier for many people.', 'A calm mind before bed.', 10],
  ['Write an intention that starts with "I choose to..." three times. Notice any line that you resist.', 'Resistance is information. A line that sticks might be too big, too vague or not truly yours. Adjust it until it sits right.', 'A refined intention that suits you.', 6],
  ['Write a thank-you line for the day three times in the morning, as if it were already a good day.', 'A thankful tone can set a positive mood. It is a way of focusing on what you value. It does not predict the day, it sets your attention.', 'A lighter outlook for the hours ahead.', 5],
  ['Write six lines at midday about what is working well in your day so far.', 'Midday is a good time to check what is going right. Six lines force you to look beyond the first thoughts. It resets your attention.', 'A brighter midday mood and some fresh energy.', 6],
  ['Write nine lines at night starting with "Today I..." Stay with facts, then end with one line about tomorrow.', 'This is a wrap-up. Nine facts, large and small, give a full picture of the day. The last line sets a gentle direction.', 'A sense of completion and a calmer evening.', 10],
  ['Choose a word for the day, such as calm or brave. Write it three times in the morning, six at noon, nine at night.', 'A single word is easy to remember. Repeating it makes it a thread through the day. Try it for a week and see what it does for you.', 'A simple focus anchor that is easy to keep.', 8, ['Pick one word.', 'Write it 3 times in the morning.', 'Write it 6 times at noon.', 'Write it 9 times at night.']],
  ['Write a 3-6-9 for something you are afraid of. Use a line about courage, not about the fear going away.', 'Courage is acting with fear present. A line like "I take one step even when I am nervous" is honest. The rounds help you practise the stance.', 'More steadiness before a hard task.', 10],
  ['Write your intention in three different ways, then pick the one that feels strongest.', 'Rewording helps find the version you believe. Try short, long and playful. The best one is the one you want to read again.', 'A well-crafted intention.', 6],
  ['Write about the 3-6-9 practice itself: what do you like, what feels odd, and what would you change?', 'A practice should suit you. Your honest review lets you adjust the times or the numbers. Not everyone enjoys it, and that is fine.', 'A practice tuned to your life.', 8],
  ['Write down the numbers in your day: three things you need, six you want, nine you are grateful for.', 'This is a creative version of the method. It sorts needs, wants and thanks. The exercise is a way to think, and the numbers are just a frame.', 'A balanced view of your day and a lighter mood.', 10],
  ['After seven days of 3-6-9, write what changed in your mood, focus or actions. Be honest if it did nothing.', 'A review keeps you honest. Some people find calm, some find clarity and some find nothing. This is a reflection tool and there are no promised results.', 'A fair verdict on whether to keep the practice.', 12],
];

// ---- Relationships and love: how you give, receive and stay close ----
const LOVE: P[] = [
  ['How do you like to be shown love? Write three examples from times you felt loved.', 'People feel loved in different ways, through words, time, touch, help or gifts. Real examples are more useful than labels. Use them to ask for what you need.', 'A clear picture of how you receive love.', 8],
  ['How do you show love to others? Write three examples and ask if the other person felt it.', 'We often give love in the way we want it. Checking helps you meet others where they are. You can ask them.', 'A better fit between how you give and how they receive.', 8],
  ['Write about a conversation you have been avoiding with someone close. What is the first sentence?', 'Starting lines are the hardest. Writing the first sentence lowers the barrier. Keep it kind and plain.', 'A start for a conversation that matters.', 8],
  ['What do you need from your closest relationship that you have not asked for?', 'Unspoken needs often become resentments. Writing the need makes it clear and askable. Think about when and how to ask.', 'A clear ask and a plan to make it.', 8],
  ['Describe your ideal friendship. How do you spend time, and what do you share?', 'Knowing what you want helps you build it. It also helps you see which friendships are close to it. Look for one to invest in.', 'A guide for friendships you want to grow.', 8],
  ['Write about a time you felt truly listened to. What did the listener do?', 'Good listening is a skill you can learn. Seeing what worked gives you a model. Try one habit this week.', 'A listening skill you can practise.', 8],
  ['When do you pull away in a relationship? Write what you are afraid will happen if you stay close.', 'Distance can be a defence. Seeing the fear helps you choose to stay. Stay curious and kind.', 'Insight into your pattern of closeness.', 10],
  ['What are your deal-breakers in love, and what are your preferences? Write them in two lists.', 'Mixing the two causes trouble. A deal-breaker protects your safety or values. A preference is a nice-to-have. Be fair in both lists.', 'A clearer set of standards.', 10],
  ['Write about how your parents or carers showed love to each other. What do you want to copy and what do you want to change?', 'We learn about love by watching. Reviewing it helps you make your own choices. Be fair and kind about both sides.', 'A conscious plan for your own relationships.', 12],
  ['Write down three qualities you bring to love. Then three things you are working on.', 'Balanced self-views help you grow without shame. Be honest about your work-in-progress. A partner or friend can help.', 'A fair and hopeful view of yourself in relationships.', 8],
  ['Think of a recent argument. Write what each person needed, without blame.', 'Seeing needs under arguments changes the tone. Needs are shared, even when words clash. Use this to plan a repair.', 'A calmer view of a conflict and a way to mend it.', 10],
  ['Who in your life do you want to be closer to? Write one thing you could do this week.', 'Closeness grows from small acts. A short message, a call or a walk counts. Put it on your Daily list.', 'A planned step toward a closer bond.', 5],
  ['Write about a time you apologised well, or wish you had. What would a good apology look like?', 'A good apology names the act, owns it and offers repair. It does not explain too much. Practising it makes it easier.', 'A model for a clear apology.', 8],
  ['What does trust mean to you? Write what builds it and what breaks it.', 'Trust is the base of any bond. Knowing your own rules helps you talk about them. Share them with someone close.', 'A shared language for trust.', 8],
  ['Write about being alone versus being lonely. When did you last feel each one?', 'They are not the same. Aloneness can feel restful, loneliness feels like a gap. Seeing which you feel helps you respond.', 'A clearer way to meet your need for company.', 8],
  ['What would you like to say to someone you love but rarely say? Write it, then say it if you can.', 'Love unsaid can be missed. Writing it first helps you find the words. Short and honest works best.', 'A message to share and a warm moment.', 8],
  ['Describe your ideal partner as a set of values and behaviours, not looks or jobs.', 'Values predict long-term fit better than surface traits. Writing behaviours, like "listens when I am upset", makes the picture usable. Check it against your own habits too.', 'A clearer guide for dating or for your current bond.', 10],
  ['How do you handle jealousy? Write about the last time and the need that was behind it.', 'Jealousy points at a need for security, attention or worth. Seeing the need gives you something to act on. It does not make you wrong or bad.', 'A calmer response to jealousy.', 10],
  ['Write about a way you can be a better friend, family member or partner this month.', 'Small improvements add up. Pick one clear action. Ask a person if it helps.', 'A real step that improves a relationship.', 6],
  ['What did you learn from your most important past relationship? Write three lessons.', 'Past bonds are teachers. Lessons keep you from repeating old patterns. Be fair to both people.', 'Practical wisdom for the future.', 10],
  ['Write about the ways you take care of your friends\' or family\'s feelings. Where do you also need care?', 'Caregivers often forget themselves. Seeing the gap helps you ask for support. Choose one person to ask.', 'A balanced view of giving and receiving.', 8],
  ['Plan a small date or time together with someone you care about. Where, when and what will you do?', 'Time together builds closeness. Planning makes it likely to happen. Keep it simple and set a date.', 'A plan for a nice moment.', 5],
];

// ---- Money and abundance mindset: how you think, feel and act around money ----
const MONEY: P[] = [
  ['Write down your first memory about money. What did you learn from it?', 'Early memories form our money beliefs. Seeing them lets you test them. Write the scene and your feelings then and now.', 'A clearer view of where your money story began.', 10],
  ['Finish: "Money is..." five different ways. Which lines are helpful and which are heavy?', 'The words we use around money shape our choices. Writing several versions shows hidden beliefs. Keep what helps and rewrite what does not.', 'A lighter money story.', 8],
  ['List what you spent on last week. Which items match your values, and which do not?', 'Spending is a mirror of values. A simple review shows the gap. No guilt, just facts. This is not financial advice.', 'A simple spending check and one change to try.', 10],
  ['What do you feel when you check your bank balance? Write the feeling and the thought behind it.', 'Avoiding money often comes from fear or shame. Naming the feeling makes it smaller. Plan a regular and calm time to look.', 'Less dread around money checks.', 8],
  ['Describe what financial peace looks like to you in one day of your life.', 'A picture of peace makes goals real. It may be about security, not luxury. Use it to set your next money step.', 'A target to aim for.', 8],
  ['Write about a time you gave or received money in a way that felt good. What made it good?', 'Money is also a tool for care. Good experiences show your values. Aim to repeat them.', 'A positive view of money in your life.', 8],
  ['What is one small money step you will take this week, such as saving, tracking or asking for pay? Write the plan.', 'Small steps beat big plans. Choose one that is clear and doable. Finance in the app can help you track it.', 'A real action and a feeling of control.', 6],
  ['What do you believe about people who have a lot of money? Write it and ask if it is true.', 'Beliefs about the rich can block our own growth. Testing them frees you to build wealth in a way you respect. Note the kind of person you want to be with more money.', 'Healthier beliefs and a clearer idea of how you want to earn.', 10],
  ['Write about how you value your time and skills. What is a fair rate for your work, and why?', 'Many people undercharge. Writing the reasons builds confidence. It is also a good first step toward asking for more.', 'A fair figure to aim for and reasons to support it.', 10],
  ['What is something you do with money out of habit that no longer serves you?', 'Old money habits can sneak on. Spotting one is the first step. Consider a replacement that fits your life now.', 'One thing to change.', 8],
  ['Write down three ways you could add to your income in the next year, and a first step for each.', 'Ideas are cheap, and first steps are what matter. Pick realistic ones. Choose the one you could start this week.', 'A short plan for earning more.', 10],
  ['Describe how you feel when you spend money on yourself. What changes if you imagine it as care, not waste?', 'Guilt around spending can come from the past. Seeing it as care, within your means, might shift your view. Keep it fair and balanced.', 'More ease with sensible self-spending.', 8],
  ['Write a letter to your money, thanking it for what it has done and telling it what you want next.', 'Talking to money is playful. It makes a vague idea clear. It also invites you to take a fresh view.', 'A friendlier relationship with money.', 8],
  ['List what "enough" looks like for you in housing, food, travel, savings and fun.', 'Without a sense of enough, we may chase more forever. Writing figures gives you a target. It can calm the urge to compare.', 'A defined number or goal for each area.', 12],
  ['What does generosity mean to you? Write one way to be generous without hurting your budget.', 'Generosity can be time, skill, or attention. It also builds a sense of abundance. Pick something small and real.', 'A generous act that fits your life.', 6],
  ['Write about a money mistake and what it taught you. How would you advise a friend in the same place?', 'Mistakes are common and often fixable. Advice to a friend is kinder than what we tell ourselves. Write the lesson in one line.', 'Less shame and a lesson you can use.', 8],
  ['What do you want to be able to say yes to in a year? Write five things and the cost of each.', 'Linking wants to costs shows what to save for. It also helps you choose. Be honest with the figures.', 'A clear goal list with prices.', 10],
  ['Write about the difference between being rich and feeling rich. What gives you each?', 'Feeling rich is partly about what you notice. Gratitude and security count. This can steady you while you build income.', 'A calmer, more grounded outlook.', 8],
  ['Imagine you receive an unexpected sum. Write what you would do with the first hour, the first week and the first year.', 'A thought experiment reveals priorities. It also helps you build plans before you need them. Be realistic and kind to yourself.', 'A clearer view of your money values.', 10],
  ['What would change in your work if you asked for what you are worth? Write the script for the ask.', 'A script makes a hard ask easier. State your value with facts, then the number. Practise out loud.', 'A ready script for a pay or price talk.', 10],
  ['Write about people who earn money in ways you admire. What can you learn and try?', 'Models show what is possible. Look at actions, not just results. Pick one to test yourself.', 'New ideas for earning in a way you respect.', 8],
  ['End the month by writing three money wins, one lesson and one plan for next month.', 'A monthly check-in keeps things calm. Wins boost your drive and lessons teach. A plan keeps you moving. This is a reflection tool, not financial advice.', 'A steady rhythm of review.', 8],
];
// ---- Body and rest: sleep, movement, food and the signals your body sends ----
const BODY: P[] = [
  ['Scan your body from head to toe. Write what each part feels like right now, without trying to fix it.', 'A body scan trains attention. Simply naming sensations is enough. It often brings a sense of calm.', 'A closer link with your body and a few moments of calm.', 6, ['Sit comfortably and breathe slowly.', 'Move your attention from head to toes.', 'Write one line for each area.', 'Note where you feel most tense.']],
  ['How did you sleep last night, and what do you think shaped it? Write three possible reasons.', 'Sleep depends on light, food, stress and routine. Looking for causes gives you things to test. Track it for a week.', 'A guess you can test about your sleep.', 6],
  ['Design a wind-down routine for the last hour of your day. Write the steps and the time for each.', 'A steady routine tells your body that sleep is coming. Choose gentle steps, like dim lights and a warm drink. Try it for a week.', 'A bedtime plan you can follow.', 8],
  ['When do you feel tired in the day? Write the times and what you tend to do about it.', 'Energy dips are normal. Seeing your pattern lets you plan rest and tasks. Short breaks can beat another coffee.', 'A smarter schedule around your dips.', 6],
  ['Write about a kind of movement you enjoy. When did you last do it, and what stops you?', 'Movement you like is movement you repeat. Finding the blocks lets you plan around them. Start tiny, like ten minutes.', 'A plan for easy, enjoyable movement.', 8],
  ['What does your body do when you are stressed? Write your signs, and one thing that helps each.', 'The body is an early warning system. Signs like a tight neck or a shallow breath can guide you. Pair each sign with a simple relief.', 'A personal stress map.', 10],
  ['Describe how you eat when you are calm versus when you are stressed. What do you notice?', 'Eating can reflect mood. Looking without judgment shows patterns. This is about awareness, not rules.', 'Awareness that helps you choose with care.', 8],
  ['Write about a time you pushed through exhaustion. What did it cost you?', 'Overdoing it can be a pattern. Looking at the cost helps you value rest. Write what you would do differently.', 'More respect for your limits.', 8],
  ['What does rest mean to you? List five ways to rest that are not sleep or screens.', 'Rest has many forms, such as a quiet walk, music, a bath or sitting outside. A list helps you pick on tired days. Try one today.', 'A menu of real rest.', 6],
  ['Check in with your breath for one minute. Write how it moves and what you notice after three slow breaths.', 'Breath is always with you. A short check shows your state. Slow, long exhales help many people settle.', 'A quick calm tool you can use anywhere.', 4],
  ['Write a thank-you to a part of your body that you usually criticise.', 'Gratitude can soften the way we see ourselves. Name what that part does for you. Be sincere and simple.', 'A kinder view of your body.', 6],
  ['How much water, sunlight and fresh air did you get today? Write one change for tomorrow.', 'Basics are easy to skip. A small change, like a glass on waking, can help. Water tracking in the app can help you see it.', 'A simple health boost.', 4],
  ['Write about your relationship with screens at night. What would be a good limit?', 'Late screens can delay sleep. A clear limit is easier to keep than a vague wish. Plan what you will do instead.', 'A bedtime screen rule.', 6],
  ['Which sounds, smells and textures calm you? Write a list and make a small kit for hard days.', 'Senses can calm the body fast. A kit makes help easy to find. It could be a tea, a scarf or a playlist.', 'A comfort kit for tough moments.', 8],
  ['Write a letter to your body about how you want to care for it this month.', 'Care is a relationship. A letter turns vague plans into promises. Keep your promises few and clear.', 'A set of commitments to your health.', 8],
  ['What is one thing you do that you know hurts your sleep or energy? Write what you get from it.', 'Most habits give us something. Seeing the gain lets you find a swap. No shame, just honesty.', 'A smarter swap for one habit.', 8],
  ['Plan a "slow day" with no goals. What would you do, and what would you skip?', 'Rest days help the mind and body. Planning one protects it from filling up. Even half a day counts.', 'A real break on your calendar.', 6],
  ['How does your body feel after you move? Write what you notice in the hour afterward.', 'Linking movement to mood builds motivation. The feeling afterward is a strong reward. Use it as your reason next time.', 'A clearer reason to keep moving.', 5],
  ['Write about what your body needs most right now, and one small act to meet it.', 'Listening to the body is a skill. It might need sleep, food, water or a stretch. Act on one need today.', 'A caring act that takes only a few minutes.', 5],
  ['Describe your ideal weekend recovery. What helps you reset for the week?', 'Weekends can either restore or drain us. Knowing what resets you helps you plan. Protect it like any appointment.', 'A better reset plan.', 8],
  ['Write about a time your body gave you a clear message, like a gut feeling or a sudden tiredness. What did you do?', 'Body signals often have a reason. Looking back at one shows how reliable your cues are. If a symptom worries you, talk to a doctor.', 'More trust in your own signals.', 8],
];

// ---- Future self: who you are growing into ----
const FUTURE: P[] = [
  ['Describe yourself one year from now in a few lines. What is different, and what is the same?', 'A year is close enough to feel real. Writing what changes and what stays shows what you want to protect. This is a planning aid, not a prediction.', 'A near-future picture that you can steer toward.', 8],
  ['Write a letter from you in ten years to you today. What do they thank you for?', 'This helps you see today\'s choices with long-term eyes. The thanks point to what matters. Keep the tone warm.', 'A longer view on small choices.', 12],
  ['What habit, started today, would your future self be most grateful for?', 'Small, steady acts compound over time. Choosing one gives you focus. Make it so small that you cannot skip it.', 'A single habit to start this week.', 6],
  ['Write the values your future self lives by. Which one do you already live by, and which needs work?', 'Values guide behaviour more than moods do. Seeing the gap shows where to grow. Pick one value to practise.', 'A value to build on.', 8],
  ['List three skills you will have in two years. Write how you will learn each one.', 'Skills come from time and method. A plan with steps beats a wish. Add it to School or your Daily list.', 'A learning plan that is real.', 10],
  ['Describe a hard moment you will face next year and how your future self handles it with grace.', 'Rehearsing a hard moment builds readiness. Include what you say and how you stay calm. It is a rehearsal, not a forecast.', 'More confidence for a likely challenge.', 10],
  ['What do you want your home life to feel like in five years? Write the sounds, smells and daily rhythms.', 'Feelings guide long-term choices. Details make the dream clear. Compare with today to find the first change.', 'A plan for a home you love.', 10],
  ['Imagine a mentor who knows your future. What three questions would you ask them?', 'Your questions reveal what worries or excites you most. Answering them yourself often brings new ideas. Treat the answers as options.', 'Useful questions and new angles.', 8],
  ['Write about someone you will help in the future because of what you are learning now.', 'Thinking about those you will help adds meaning to your effort. It makes hard work feel less lonely. Be specific about who they are.', 'A reason to keep going.', 8],
  ['Write down what you want to stop doing in the next year, and what you will do in its place.', 'Stopping needs a replacement to work. Naming both gives you a plan. Add it to your not to do list if it fits.', 'A clear swap to try.', 8],
  ['Draw a timeline of the next five years. Mark the three moments you most want to happen.', 'A timeline turns hopes into order. Marking moments helps you see what comes first. Keep the dates flexible.', 'A simple map of your next years.', 12],
  ['What would you tell your future self about the challenges you are facing today?', 'Today\'s worries often look small later. Writing to your future self gives some distance. It also records your feelings for later.', 'A calmer view of today.', 8],
  ['Write about the kind of friend, parent, partner or colleague your future self is.', 'Roles shape who we become. Describing your best self in each shows what to practise. Choose one role to focus on.', 'A role-based growth plan.', 10],
  ['Describe your future self\'s morning, noon and night. What do they eat, do and think?', 'Daily rhythms make up a life. Imagining them shows what to start. Try one part tomorrow.', 'A rhythm to try on for size.', 8],
  ['Write down a promise you want to keep to your future self over the next 90 days.', 'Promises build trust with yourself. Make it clear, small and checkable. Review it on a set date.', 'A commitment you can track.', 6],
  ['What do you hope to let go of by next year? Write three things and how you will know they are gone.', 'Letting go can be measured by signs. Writing the signs makes it real. Go gently with yourself.', 'A set of signs of growth.', 8],
  ['Write the first line of your future autobiography, then the first paragraph of the chapter you are in now.', 'Seeing yourself as an author adds perspective. The current chapter might hold the seeds of the next. Write it with kindness and humour.', 'A fresh view of your story.', 10],
  ['Which pillar, among your seven, will your future self thank you for working on? Write why.', 'The pillars give structure to growth. Choosing one to focus on avoids spreading too thin. Link it to a project or task.', 'A clear focus for the coming months.', 8],
  ['Write about a fear that holds you back from your future. Then write how your future self talks to it.', 'Your future self has faced this fear and knows it is manageable. Speak in their calm voice. It may offer helpful advice.', 'A steadier stance toward a fear.', 10],
  ['Imagine your life with one more hour a day. What would you do with it, and what can you do now with ten minutes?', 'Wishes for time show your true priorities. Ten minutes is real and can start today. Use it for what you named.', 'A small daily practice for what matters.', 6],
  ['Write down what you want to be true about your health, work and relationships on your next birthday.', 'A date makes a goal real. Three areas keep it balanced. Break each into one step.', 'Three clear goals with a deadline.', 10],
  ['Describe a day in your future life when everything is calm. What do you notice about your thoughts and body?', 'Calm is a feeling you can design for. Seeing what supports it shows what to protect. Pick one thing to start now.', 'A picture of calm to aim for and one step toward it.', 8],
];

// ---- Weekly reset: look back, clear space and set up the days ahead ----
const WEEKLY: P[] = [
  ['What were the three best moments of your week? Write why each one mattered.', 'Starting with the good sets a balanced tone. Spotting why they mattered points to what you want more of. It builds a fair view of the week.', 'A positive start to your review and ideas for the next week.', 6],
  ['What did you finish this week that you are proud of? Write how you did it.', 'Naming how you did it builds a method you can reuse. Include help from others. Small wins count too.', 'Confidence and a repeatable method.', 6],
  ['What did not go as planned this week? Write the cause without blame.', 'Looking at causes teaches more than looking at faults. Ask about time, energy and information. Pick one fix.', 'A clearer plan for next week.', 8],
  ['How was your energy this week? Write what gave you energy and what took it.', 'Energy decides what you can do. Seeing the pattern helps you plan. Adjust one thing for next week.', 'A smarter schedule.', 6],
  ['Which relationship needs more attention next week? Write one small action.', 'Relationships rarely fail from one big event. They fade from lack of attention. Pick one person and one act.', 'A planned act of care.', 5],
  ['Write about one thing that stressed you this week and how you handled it.', 'Stress is easier to manage when you review it. Note what helped. Choose one tool to use again.', 'A tested way to handle stress.', 8],
  ['List the tasks you carried over for more than a week. Which will you drop, shrink or schedule?', 'Old tasks drain energy. Deciding is a relief. Be honest about what is no longer worth doing.', 'A shorter, kinder task list.', 8],
  ['Write the three most important things for next week. What will you do first for each?', 'Three is enough to keep you focused. A first step makes it start. Add them to Daily.', 'A short, strong plan.', 6, ['Choose three things that matter most.', 'Write the first step for each.', 'Add them to Daily with a day.']],
  ['What did you learn about yourself this week? Write one lesson in a single sentence.', 'A lesson in one line is easy to recall. Learning is the point of a review. Share it with someone if you like.', 'A takeaway to carry.', 5],
  ['Write down any worry you still carry from the week. Next to each, write one thing you can do or let go.', 'A worry on paper is easier to handle. Each has a do or a drop. This clears the head for the weekend.', 'A lighter mind.', 8],
  ['How did you take care of your body this week? Write one thing to repeat and one to change.', 'Body care supports every other goal. A simple review keeps it on the radar. Pick small changes.', 'A basic health plan.', 6],
  ['What did you spend your time on that you will not miss? What did you not get to that you wish you had?', 'Time is a choice made in small steps. Spotting the gap helps you shift. Choose one thing to protect next week.', 'A time shift that matches your values.', 8],
  ['Write three things you are grateful for from the week, and one thing you want to say thanks for.', 'Thanks is a good way to close the week. Sending a note makes it count. Keep it short and warm.', 'A kind ending and a stronger bond.', 6],
  ['How did you do on your not to do list this week? Write what helped and what tripped you up.', 'Reviewing your list shows what is working. Look for cues and times of day. Adjust gently.', 'Better support for what you want to avoid.', 6],
  ['Write about a decision you are putting off. What is the next small step?', 'Putting off a decision costs energy. A small step reduces the weight. Set a day to take it.', 'A decision moved forward.', 6],
  ['What did you read, watch or hear this week that stayed with you? Write why.', 'What sticks shows what you care about. A short note helps you remember it. Share it with a friend.', 'A takeaway that shapes your thinking.', 6],
  ['How did you show up for your values this week? Write one example and one miss.', 'Values only matter in action. A fair review of both keeps you honest. The miss is a chance, not a failure.', 'A closer match between values and actions.', 8],
  ['Write a short message to next week\'s you. What do you want them to remember?', 'A note to your future self gives support. Use it to carry a lesson or a wish. Read it on Monday.', 'A helpful reminder to start well.', 5],
  ['Tidy one small space or list today, such as your desk, inbox or phone. Write how it feels.', 'External order can calm the mind. Pick something small and finish it. Notice the effect.', 'A tidy corner and a clearer head.', 8],
  ['Rate this week from 1 to 10 on mood, focus and connection. Write a line on each number.', 'Simple ratings help you track change. The line gives the reason. Compare with the weeks before.', 'A weekly record you can use in a review.', 6],
  ['What is one thing you will do differently next week? Write why and how you will remember.', 'One change is easier than ten. A cue helps you remember. Add the cue to Daily.', 'A single focused improvement.', 5],
  ['Write down what you need to feel ready for Monday. Which of those can you do on Sunday?', 'Feeling ready lowers the Sunday dread. Small preparations help, like laying out clothes or setting a top task. Do one now.', 'A calmer start to the week.', 6],
];

const BY_CATEGORY: Record<JournalPromptCategoryKey, P[]> = {
  shadow: SHADOW,
  child: CHILD,
  triggers: TRIGGERS,
  selftalk: SELFTALK,
  worth: WORTH,
  release: RELEASE,
  joy: JOY,
  energy: ENERGY,
  purpose: PURPOSE,
  script: SCRIPT,
  m369: M369,
  love: LOVE,
  money: MONEY,
  body: BODY,
  future: FUTURE,
  weekly: WEEKLY,
};

/** Turns a short result ("A calmer start.") into a hedged sentence: "You may come away with a calmer start." */
const hope = (result: string) => `You may come away with ${result.charAt(0).toLowerCase()}${result.slice(1)}`;

/** Every prompt, in a fixed order, with its id (`shadow-01`) and the right note on the end of what to expect. */
export const JOURNAL_PROMPTS: readonly JournalPrompt[] = JOURNAL_PROMPT_CATEGORIES.flatMap((c) =>
  BY_CATEGORY[c.key].map(([text, why, expect, minutes, steps], i): JournalPrompt => {
    const note = c.care === 'heavy' ? ` ${JOURNAL_CARE_NOTE}` : c.care === 'plan' ? ` ${JOURNAL_PLAN_NOTE}` : '';
    return { id: `${c.key}-${String(i + 1).padStart(2, '0')}`, category: c.key, text, why, expect: `${hope(expect)}${note}`, minutes, ...(steps ? { steps } : {}) };
  }),
);

export const JOURNAL_PROMPT_COUNT = JOURNAL_PROMPTS.length;

const CATEGORY_BY_KEY: Record<string, JournalPromptCategory> = Object.assign(Object.create(null), Object.fromEntries(JOURNAL_PROMPT_CATEGORIES.map((c) => [c.key, c])));
const PROMPT_BY_ID: Record<string, JournalPrompt> = Object.assign(Object.create(null), Object.fromEntries(JOURNAL_PROMPTS.map((p) => [p.id, p])));

export function promptCategory(key: string): JournalPromptCategory | undefined {
  return CATEGORY_BY_KEY[key];
}
export function promptById(id: string): JournalPrompt | undefined {
  return PROMPT_BY_ID[id];
}
/** The prompts in one category, or all of them. */
export function promptsIn(category: JournalPromptCategoryKey | 'all' = 'all'): readonly JournalPrompt[] {
  return category === 'all' ? JOURNAL_PROMPTS : JOURNAL_PROMPTS.filter((p) => p.category === category);
}

/** A small seeded shuffle (the same idea as the line of the day), so the same history and seed always give the same order. */
function shuffled<T>(list: readonly T[], seed: number): T[] {
  const out = [...list];
  let a = (Math.imul(seed | 0, 2654435761) >>> 0) || 1;
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
function hashText(s: string): number {
  let h = 17;
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * The next prompt to show. `history` is the ids already shown, oldest first. Within the chosen category (or all of them), no prompt comes back
 * until every prompt in that pool has been shown once; then a new round starts, shuffled afresh, and its first prompt is never the one just shown.
 * Ids that are not in the pool (another category, or one that no longer exists) are ignored. The same history, category and seed always give
 * the same prompt, and nothing is stored here: the caller keeps the history.
 */
export function nextPrompt(history: readonly string[], category: JournalPromptCategoryKey | 'all' = 'all', seed = 0): JournalPrompt {
  const pool = promptsIn(category);
  const size = pool.length;
  const ids = new Set(pool.map((p) => p.id));
  let seen = new Set<string>();
  let last: string | undefined;
  let count = 0;
  for (const id of history) {
    if (!ids.has(id)) continue;
    last = id;
    count += 1;
    seen.add(id);
    if (seen.size === size) seen = new Set();
  }
  let candidates = pool.filter((p) => !seen.has(p.id));
  // A new round must not open with the prompt the last round ended on.
  if (seen.size === 0 && last !== undefined && size > 1) candidates = candidates.filter((p) => p.id !== last);
  return shuffled(candidates, seed + count * 7919 + hashText(category))[0]!;
}

/** How many prompts of the pool have been shown in the round now under way, and how many there are. */
export function promptRound(history: readonly string[], category: JournalPromptCategoryKey | 'all' = 'all'): { shown: number; size: number } {
  const pool = promptsIn(category);
  const ids = new Set(pool.map((p) => p.id));
  let seen = new Set<string>();
  for (const id of history) {
    if (!ids.has(id)) continue;
    seen.add(id);
    if (seen.size === pool.length) seen = new Set();
  }
  return { shown: seen.size, size: pool.length };
}

/** A short title for an entry written from a prompt: the first sentence, cut at a word, within `max` characters. */
export function promptTitle(text: string, max = 60): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const first = clean.split(/(?<=[.?!])\s/)[0] ?? clean;
  if (first.length <= max) return first.replace(/[.]$/, '');
  const cut = first.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  return `${(at > 20 ? cut.slice(0, at) : cut).replace(/[\s,;:.]+$/, '')}…`;
}
/** The first line of an entry written from a prompt, so the entry keeps its question. */
export function promptBody(text: string): string {
  return `Prompt: ${text}\n\n`;
}
