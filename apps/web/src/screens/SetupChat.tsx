import {
  characterHello,
  IDENTITY_BY_KEY,
  identitiesOf,
  identityLabel,
  identityLine,
  matchSetup,
  MAX_SETUP_GOALS,
  MODULE_BY_KEY,
  MODULE_GROUP_ACCENT,
  readAbout,
  SETUP_APP_LINES,
  SETUP_BLOCKER_BY_KEY,
  SETUP_BLOCKER_GROUPS,
  SETUP_GOAL_BY_KEY,
  SETUP_GOAL_GROUPS,
  SETUP_ROLE_GROUPS,
  setupSwitchable,
  type AppPick,
  type ChoiceGroup,
  type IdentityKind,
  type SetupAnswers,
  type SetupMatch,
} from '@kreators/shared';
import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { PrivateCard, SignInCard } from '../components/AccountForm';
import { ProfileCard } from '../components/ProfileCard';
import { ChatActions, ChatLinks, ChatScreen, ChoiceChips, ChoiceGroups, typingTime, type ChatChoice, type ChatChoiceGroup, type ChatLine } from '../components/Chat';
import { api } from '../lib/api';
import { explainTyped, isQuestion } from '../lib/explain';
import { forgetKept, useKept, useKeptRef } from '../lib/kept';
import { useModules } from '../lib/modules';
import { useMe, useRefreshAll } from '../lib/queries';
import { useSession } from '../lib/store';

// ---------------------------------------------------------------------------
// One guide, a few taps. Dew asks what brings you here, which of a few things sound like you, what you make
// (only when you make things), and what gets in your way. Every list comes in small groups. You can type an
// answer, or a question about anything you see, at any point.
// ---------------------------------------------------------------------------

type Part = 'account' | 'private' | 'hello' | 'goals' | 'who' | 'work' | 'way' | 'match' | 'done';
type Question = 'goals' | 'who' | 'work' | 'way';
type Line = string | { node: ReactNode };
type Send = (value: Record<string, string>, label: string) => void;
type Ask =
  | { kind: 'chips'; chips: ChatChoice[]; more?: string }
  | { kind: 'groups'; groups: ChatChoiceGroup[]; max?: number; min?: number; done: string; skip?: string; more?: string }
  | { kind: 'form'; render: (send: Send) => ReactNode; more?: string }
  | { kind: 'wait'; text: string };
interface Chat {
  log: ChatLine[];
  part: Part;
  /** The first account card, kept until the second one sends. Never saved anywhere else. */
  signIn?: Record<string, string>;
  answers: SetupAnswers;
  /** The questions already answered, by a tap or by something typed. */
  asked: Question[];
  ask: Ask | null;
  /** The choices at the end, kept so they come back after the profile card. */
  doneChips?: ChatChoice[];
}
const EMPTY: SetupAnswers = { identities: [], goals: [], blockers: [] };

const hello = characterHello;
const err = (e: unknown) => (e instanceof Error ? e.message : 'That did not work.');
const listed = (items: string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
/** Chip labels joined into one line that reads like a sentence: "Earn from my content and learn a new skill". */
const said = (labels: string[]) => listed(labels.map((l, i) => (i === 0 || /^I\b|^I'/.test(l) ? l : l.charAt(0).toLowerCase() + l.slice(1))));
const kindOf = (k: string): IdentityKind | 'own' => IDENTITY_BY_KEY[k]?.kind ?? 'own';
const uniq = <T,>(xs: T[]) => [...new Set(xs)];
const makes = (a: SetupAnswers) => a.identities.includes('creator') || a.identities.includes('freelancer');
/** "I'm a student" said back: "you're a student". */
const youSay = (k: string) => (IDENTITY_BY_KEY[k]?.blurb ?? k).replace(/^I'm /, "you're ").replace(/^I /, 'you ');

const groupsOf = (groups: readonly ChoiceGroup[], choice: (key: string) => ChatChoice): ChatChoiceGroup[] => groups.map((g) => ({ label: g.label, emoji: g.emoji, choices: g.keys.map(choice) }));
const goalChoice = (k: string): ChatChoice => ({ value: k, label: SETUP_GOAL_BY_KEY[k]!.label, emoji: SETUP_GOAL_BY_KEY[k]!.emoji });
const blockerChoice = (k: string): ChatChoice => ({ value: k, label: SETUP_BLOCKER_BY_KEY[k]!.label, emoji: SETUP_BLOCKER_BY_KEY[k]!.emoji });
/** Roles, crafts and services: the chip says what the person would say ("I'm a student", "Editing"). */
const tagChoice = (k: string): ChatChoice => ({ value: k, label: IDENTITY_BY_KEY[k]!.blurb, emoji: IDENTITY_BY_KEY[k]!.emoji });

function Check({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className={`flex size-[24px] shrink-0 items-center justify-center rounded-pill border-2 text-[12px] font-extrabold ${on ? 'border-ink bg-ink text-on-ink' : 'border-line'}`}>
      {on ? '✓' : ''}
    </span>
  );
}

/** What was picked up from something typed, as small pills inside one of Dew's lines. */
function Tags({ keys }: { keys: string[] }) {
  const text = (k: string) => {
    if (k.startsWith('goal:')) return `${SETUP_GOAL_BY_KEY[k.slice(5)]?.emoji} ${SETUP_GOAL_BY_KEY[k.slice(5)]?.label}`;
    if (k.startsWith('way:')) return `${SETUP_BLOCKER_BY_KEY[k.slice(4)]?.emoji} ${SETUP_BLOCKER_BY_KEY[k.slice(4)]?.label}`;
    return `${IDENTITY_BY_KEY[k]?.emoji ?? '🏷️'} ${identityLabel(k)}`;
  };
  return (
    <ul className="m-0 flex list-none flex-wrap gap-xs p-0" aria-label="What I picked up">
      {keys.map((k) => (
        <li key={k} className="rounded-pill bg-card px-sm py-xs text-[14px] font-bold shadow-toy-soft">
          {text(k)}
        </li>
      ))}
    </ul>
  );
}

/** The apps that fit, as tick rows: each says what it is in plain words, and why it is here one tap away. */
function MatchList({ answers, available, onSend }: { answers: SetupAnswers; available: string[]; onSend: Send }) {
  const m = useMemo(() => matchSetup(answers, available), [answers, available]);
  const [on, setOn] = useState<string[]>(m.apps.map((a) => a.key));
  const [more, setMore] = useState(false);
  const [why, setWhy] = useState(false);
  const adds = uniq([...m.profile.skills, ...m.profile.interests]);
  const row = (a: AppPick) => {
    const mod = MODULE_BY_KEY[a.key]!;
    const checked = on.includes(a.key);
    return (
      <li key={a.key}>
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          onClick={() => setOn((o) => (o.includes(a.key) ? o.filter((k) => k !== a.key) : [...o, a.key]))}
          className={`toy toy-flat flex w-full items-center gap-sm rounded-tile border-2 bg-card px-sm py-xs text-left ${checked ? 'border-ink' : 'border-line'}`}
        >
          <span aria-hidden="true" className="text-[22px] leading-none">
            {mod.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold">{mod.name}</span>
            <span className="block text-[14px] font-semibold leading-snug text-ink-soft">{SETUP_APP_LINES[a.key] ?? mod.blurb}</span>
            {why && (
              <span className="mt-xs block text-[12px] font-bold" style={{ color: `var(--deep-${MODULE_GROUP_ACCENT[mod.group]})` }}>
                {a.why}
              </span>
            )}
          </span>
          <Check on={checked} />
        </button>
      </li>
    );
  };
  return (
    <div>
      <ul className="m-0 flex list-none flex-col gap-xs p-0" aria-label="Apps for you">
        {m.apps.map(row)}
      </ul>
      {more && m.more.length > 0 && (
        <>
          <p className="mt-sm m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">Could fit too</p>
          <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">{m.more.map(row)}</ul>
        </>
      )}
      <div className="mt-xs flex flex-wrap gap-md">
        <button type="button" onClick={() => setWhy(!why)} className="min-h-[32px] text-[14px] font-bold underline underline-offset-4">
          {why ? 'Hide the reasons' : 'Why these apps?'}
        </button>
        {!more && m.more.length > 0 && (
          <button type="button" onClick={() => setMore(true)} className="min-h-[32px] text-[14px] font-bold underline underline-offset-4">
            Show {m.more.length} more
          </button>
        )}
      </div>
      <ChatActions next={on.length === 1 ? 'Switch on 1 app' : `Switch on ${on.length} apps`} ready={on.length > 0} onNext={() => onSend({ apps: JSON.stringify(on) }, `Switch on ${listed(on.map((k) => MODULE_BY_KEY[k]!.name))}`)} />
      <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">
        Everything else stays off for now. You can change it anytime.{adds.length > 0 ? ` I'll also add ${listed(adds)} to your profile.` : ''}
      </p>
    </div>
  );
}

/**
 * The first chat. The account comes first when there is none; then a few grouped taps; then the apps that fit,
 * switched on. The strategy session waits in Pillars and is offered at the end when the answers ask for it.
 */
export function SetupChat() {
  const nav = useNavigate();
  const me = useMe();
  const refresh = useRefreshAll();
  const reduce = useReducedMotion();
  const setToken = useSession((st) => st.setToken);
  const { modules, ready } = useModules();
  const available = useMemo(() => modules.filter((m) => setupSwitchable(m) && m.available).map((m) => m.key), [modules]);
  const onboarded = Boolean(me.data?.user.onboardedAt);

  // Kept for the tab, per person: leaving and coming back lands on the same line, with the same ticks.
  const scope = `setup:${me.data?.user.id ?? 'none'}`;
  const [round, setRound] = useState(0);
  const [chat, setChat] = useKept<Chat>(scope, 'chat', () => ({ log: [], part: 'goals', answers: EMPTY, asked: [], ask: null }));
  const [history, setHistory] = useKept<Chat[]>(scope, 'history', []);
  const [typing, setTyping] = useKept<boolean>(scope, 'typing', false);
  const [notice, setNotice] = useKept<string | null>(scope, 'notice', null);
  const [picks, setPicks] = useKept<string[]>(scope, 'picks', []);
  const ids = useKeptRef(scope, 'ids', 0);
  const timers = useKeptRef<number[]>(scope, 'timers', []);
  const started = useKeptRef(scope, 'started', false);
  const chatRef = useKeptRef<Chat>(scope, 'chatRef', chat);
  chatRef.current = chat;

  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };

  /** Dew says a few lines at a typing pace, then the next ask shows. */
  const say = useCallback(
    (lines: Line[], next: { part?: Part; ask: Ask | null; answers?: SetupAnswers; asked?: Question[]; picks?: string[] }) => {
      clearTimers();
      setChat((c) => ({ ...c, ask: null, ...(next.part ? { part: next.part } : {}), ...(next.answers ? { answers: next.answers } : {}), ...(next.asked ? { asked: next.asked } : {}) }));
      if (next.picks) setPicks(next.picks);
      setTyping(true);
      let at = reduce ? 0 : 300;
      lines.forEach((line, i) => {
        at += reduce ? 0 : typingTime(line);
        timers.current.push(
          window.setTimeout(() => {
            const id = (ids.current += 1);
            setChat((c) => ({ ...c, log: [...c.log, typeof line === 'string' ? { id, from: 'bot', host: 'bumling', text: line } : { id, from: 'bot', host: 'bumling', node: line.node }] }));
            if (i === lines.length - 1) {
              setTyping(false);
              setChat((c) => ({ ...c, ask: next.ask }));
            }
          }, at),
        );
      });
      if (lines.length === 0) {
        setTyping(false);
        setChat((c) => ({ ...c, ask: next.ask }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reduce, scope],
  );

  const you = (label: string) => {
    const id = (ids.current += 1);
    setChat((c) => ({ ...c, log: [...c.log, { id, from: 'you', text: label }], ask: null }));
  };

  // ---- the questions. Each one asks only what is still open, filled in with anything already said.

  const askGoals = (a: SetupAnswers, asked: Question[], lead: Line[]) =>
    say([...lead, 'First question: what do you want to get out of kreators.app? Pick up to three, then tap Next.'], {
      part: 'goals',
      answers: a,
      asked,
      picks: a.goals,
      ask: { kind: 'groups', groups: groupsOf(SETUP_GOAL_GROUPS, goalChoice), max: MAX_SETUP_GOALS, done: 'Next', more: 'Your answers decide which apps you get. If you want to earn, you get the apps that pay you. If you want to feel better, you get the trackers for mood, sleep and stress. “Work on myself” also adds the strategy session, a deeper setup for the seven relationships in your life.' },
    });

  const askWho = (a: SetupAnswers, asked: Question[], lead: Line[]) =>
    say([...lead, 'Next, tell me a little about yourself. Which of these describe you? Pick as many as fit, then tap Next.'], {
      part: 'who',
      answers: a,
      asked,
      picks: a.identities.filter((k) => kindOf(k) === 'role'),
      ask: { kind: 'groups', groups: groupsOf(SETUP_ROLE_GROUPS, tagChoice), done: 'Next', skip: 'None of these', more: 'This helps me suggest apps that fit your life. A student who edits videos needs different apps than a parent who wants to save money. You can pick more than one, or describe yourself in your own words in the box below.' },
    });

  const askWork = (a: SetupAnswers, asked: Question[], lead: Line[]) => {
    const creator = a.identities.includes('creator');
    const freelance = a.identities.includes('freelancer');
    const groups: ChatChoiceGroup[] = [
      ...(creator ? [{ label: 'Your own content', emoji: '🎬', choices: identitiesOf('craft').map((i) => tagChoice(i.key)) }] : []),
      ...(freelance ? [{ label: 'For clients', emoji: '🧳', choices: identitiesOf('service').map((i) => tagChoice(i.key)) }] : []),
    ];
    const q = creator && freelance ? 'You make things, so tell me more: what do you make, for yourself or for clients? Pick all that fit, then tap Next.' : creator ? 'You make content, so tell me more: what kind? Pick all that fit, then tap Next.' : 'You work for clients, so tell me more: what do you do for them? Pick all that fit, then tap Next.';
    say([...lead, q], {
      part: 'work',
      answers: a,
      asked,
      picks: a.identities.filter((k) => kindOf(k) === 'craft' || kindOf(k) === 'service'),
      ask: { kind: 'groups', groups, done: 'Next', skip: 'Skip this', more: 'This helps me pick the apps that pay you. Win pays you for videos about brands. Army runs campaigns with brands. Work lists paid gigs.' },
    });
  };

  const askWay = (a: SetupAnswers, asked: Question[], lead: Line[]) =>
    say([...lead, 'Last question, I promise. What usually stops you from getting things done? Pick any that fit, or tap “Nothing, skip”.'], {
      part: 'way',
      answers: a,
      asked,
      picks: a.blockers,
      ask: { kind: 'groups', groups: groupsOf(SETUP_BLOCKER_GROUPS, blockerChoice), done: 'Next', skip: 'Nothing, skip', more: 'Honest answers help me get this right. If you are busy or easily distracted, I switch on fewer apps. If you are tired or stressed, I add the trackers. If you feel alone in this, I add ways to meet people.' },
    });

  const showMatch = (a: SetupAnswers, asked: Question[], lead: Line[]) =>
    say([...lead, "Here are the apps I'd switch on for you, based on your answers. Untick any you don't want, then tap the button to switch them on."], {
      part: 'match',
      answers: a,
      asked,
      ask: { kind: 'form', render: (send) => <MatchList answers={a} available={available} onSend={send} />, more: 'Tap “Why these apps?” to see why each one is here. You can switch any app on or off later, in Profile, under Features.' },
    });

  /** The next open question, or the match when every one is answered. */
  const next = (a: SetupAnswers, asked: Question[], lead: Line[]) => {
    if (!asked.includes('goals')) return askGoals(a, asked, lead);
    if (!asked.includes('who')) return askWho(a, asked, lead);
    if (makes(a) && !asked.includes('work')) return askWork(a, asked, lead);
    if (!asked.includes('way')) return askWay(a, asked, lead);
    return showMatch(a, asked, lead);
  };

  const finish = (m: SetupMatch, on: string[], coach: 'coach' | 'asked' | 'waiting' | null = null) => {
    const top = on.map((k) => MODULE_BY_KEY[k]).find(Boolean);
    // Saying "I'm a life coach" asked the team to make you one; it is said plainly, so nobody waits wondering.
    const coachLine =
      coach === 'coach'
        ? 'You are a life coach here already: your badge says so. Coaching is where your students are.'
        : coach
          ? 'You said you are a life coach, so I asked the team to make you one. They check every coach first. The answer lands in your inbox, and then your badge says Life coach and students can find you in Coaching.'
          : null;
    const session =
      m.session === 'now'
        ? 'You said you want to work on yourself. The best start for that is the strategy session, in Pillars. It takes about ten minutes, and you leave with a routine and a plan.'
        : m.session === 'soon'
          ? 'When you feel ready, try the strategy session in Pillars. It builds a routine around your real day, with room for focus and energy.'
          : 'Want to go deeper some day? The strategy session in Pillars is there whenever you are.';
    // Discover is offered beside the strategy session every time: it is the quicker way in (about fifteen minutes) and it makes the next steps personal.
    const discoverChip: ChatChoice = { value: 'discover', label: 'Take the Discover quiz' };
    const chips: ChatChoice[] =
      m.session === 'now'
        ? [{ value: '/session', label: 'Start the strategy session' }, discoverChip, { value: '/home', label: 'Maybe later. Go to Home' }]
        : [{ value: '/home', label: 'Go to Home' }, ...(top ? [{ value: top.path, label: `Open ${top.name}` }] : []), ...(m.session === 'soon' ? [{ value: '/session', label: 'Start the strategy session' }] : []), discoverChip];
    setChat((c) => ({ ...c, doneChips: chips }));
    say(
      [
        `All set! 🎉 ${on.length === 1 ? "I've switched on your app." : `I've switched on your ${on.length} apps.`}`,
        'Five tabs are always there: Home, Daily, Pillars, Apps and Profile.',
        'Daily gives you three small things to do each day. Pillars is where you work on the seven relationships in your life: with yourself, your family, your friends, a partner, your work, your teachers and your faith.',
        ...(coachLine ? [coachLine] : []),
        session,
        'Or start with Discover. It is a quiz of about fifteen minutes with puzzles, personality and real situations. It shows your strengths and makes your next steps fit you.',
        'One more thing, if you like: add your interests, so people who like the same things can find you.',
      ],
      { part: 'done', ask: { kind: 'chips', chips: [...chips, { value: 'profile', label: 'Add my interests' }] } },
    );
  };

  const askProfile = () =>
    say(['Pick what you are into, up to ten, and add your city. People with the same interests can then find you, for example in Circles.', 'You can add a short line about yourself too. All of it shows on your profile, and you can change it there anytime.'], { part: 'done', ask: { kind: 'form', render: (send) => <ProfileCard onSend={send} /> } });

  const saveProfile = (rec: Record<string, string>) => {
    const after = chatRef.current.doneChips ?? [{ value: '/home', label: 'Go to Home' }];
    if (rec.skip) return say(['No problem. You can add your interests anytime in Profile. Where to next?'], { part: 'done', ask: { kind: 'chips', chips: after } });
    say([], { ask: { kind: 'wait', text: 'Saving your profile…' } });
    api
      .updateMe({ interests: parse(rec.interests), city: rec.city ?? '', bio: rec.bio ?? '' })
      .then(async () => {
        await refresh();
        say(['Saved to your profile! 🎉 Where to next?'], { part: 'done', ask: { kind: 'chips', chips: after } });
      })
      .catch((e) => {
        setNotice(err(e));
        askProfile();
      });
  };

  // ---- server calls

  const askSignIn = (lead: Line[], name: string) =>
    say([...lead, "I'll help you set up kreators.app so it fits you. It takes about two minutes.", "First, let's make your account, so nothing you tell me gets lost. Fill in the card below, then tap Next."], {
      part: 'account',
      ask: { kind: 'form', render: (send) => <SignInCard initialName={name} onSend={send} />, more: 'The password needs eight or more letters, numbers or signs. It cannot be your email or a common one, like 12345678.' },
    });

  const askPrivate = (name: string) =>
    say([`Thanks${name ? `, ${name}` : ''}! Just two more details: your phone number and your date of birth.`, 'You need to be 18 or older to join, which is why I ask for your birthday. Both stay private: nobody else ever sees them.'], {
      part: 'private',
      ask: { kind: 'form', render: (send) => <PrivateCard onSend={send} />, more: 'You can change your phone later in Profile. Your birthday stays as you set it.' },
    });

  const submitAccount = (rec: Record<string, string>) => {
    const first = chatRef.current.signIn ?? {};
    say([], { ask: { kind: 'wait', text: 'Making your account…' } });
    api
      .signup({ email: first.email ?? '', password: first.password ?? '', displayName: first.name || undefined, phone: rec.phone ?? '', birthDate: rec.birthDate ?? '' })
      .then(async (r) => {
        setChat((c) => ({ ...c, signIn: undefined }));
        setToken(r.token);
        await refresh();
        beginRef.current(r.user?.displayName ?? '', true);
      })
      .catch((e) => {
        // Most often the email is taken or the password too common: back to the first card.
        setNotice(err(e));
        setChat((c) => ({ ...c, signIn: undefined }));
        askSignIn(['That did not go through. The note below says why.'], first.name ?? '');
      });
  };

  const submitSetup = (a: SetupAnswers, apps: string[]) => {
    say([], { ask: { kind: 'wait', text: 'Switching on your apps…' } });
    api
      .setup({ ...a, apps })
      .then(async (r) => {
        await refresh();
        finish(r.match, r.on, r.coach);
      })
      .catch((e) => {
        setNotice(err(e));
        showMatch(a, chatRef.current.asked, []);
      });
  };

  // ---- a tap or a card, routed by the part

  const parse = (v: string | undefined): string[] => {
    try {
      const x = v ? (JSON.parse(v) as unknown) : [];
      return Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [];
    } catch {
      return [];
    }
  };

  const answer = (value: string | string[] | Record<string, string>, label: string) => {
    const c = chatRef.current;
    setHistory((h) => [...h.slice(-20), c]);
    you(label);
    setNotice(null);
    const a = c.answers;
    const list = Array.isArray(value) ? value : [];
    const rec = !Array.isArray(value) && typeof value === 'object' ? value : {};
    const str = typeof value === 'string' ? value : '';
    const asked = (q: Question): Question[] => uniq([...c.asked, q]);

    if (c.part === 'account') {
      setChat((x) => ({ ...x, signIn: rec }));
      return askPrivate(rec.name ?? '');
    }
    if (c.part === 'private') return submitAccount(rec);
    if (c.part === 'hello') {
      if (str === 'keep') return nav('/you');
      return next(a, [], ["Great. I've filled in what you said last time. Change anything you like."]);
    }
    if (c.part === 'goals') {
      const goals = list.slice(0, MAX_SETUP_GOALS);
      return next({ ...a, goals }, asked('goals'), [`Got it. You want to ${listed(goals.map((g) => SETUP_GOAL_BY_KEY[g]!.to))}.`]);
    }
    if (c.part === 'who') {
      const identities = uniq([...list, ...a.identities.filter((k) => kindOf(k) !== 'role')]);
      return next({ ...a, identities }, asked('who'), [list.length ? `So ${listed(list.map(youSay))}. Nice!` : 'No problem. You can tell me more in your own words anytime.']);
    }
    if (c.part === 'work') {
      const identities = uniq([...a.identities.filter((k) => kindOf(k) !== 'craft' && kindOf(k) !== 'service'), ...list]);
      return next({ ...a, identities }, asked('work'), [list.length ? 'Great, thanks.' : 'No problem.']);
    }
    if (c.part === 'way') {
      const b = list;
      const ack =
        b.length === 0
          ? 'Great, nothing in your way!'
          : b.includes('time')
            ? "You're busy, so I'll keep things light, with fewer apps to start."
            : b.includes('focus')
              ? "Got it. I'll keep things simple, with fewer apps to start."
              : b.includes('energy') || b.includes('sleep')
                ? "Fair enough. We'll start gently."
                : b.includes('stress')
                  ? "Thanks for telling me. I'll keep that in mind."
                  : b.includes('alone')
                    ? "You won't be on your own here."
                    : b.includes('cash')
                      ? "Then we'll keep an eye on money."
                      : "No worries. I'll show you where to start.";
      return next({ ...a, blockers: b }, asked('way'), [ack]);
    }
    if (c.part === 'match') return submitSetup(a, parse(rec.apps));
    if (c.part === 'done') {
      if (str === 'profile') return askProfile();
      // Discover is off until someone picks it, so this turns the app on and then opens it.
      if (str === 'discover') {
        void api.setModule('discover', true).then(() => {
          refresh();
          nav('/discover', { replace: true });
        });
        return;
      }
      if (rec.skip || rec.interests !== undefined) return saveProfile(rec);
      if (str) nav(str, { replace: true });
    }
  };

  // ---- anything typed: a question gets a plain answer; anything else is read for answers.

  const typed = (text: string) => {
    const c = chatRef.current;
    setHistory((h) => [...h.slice(-20), c]);
    you(text);
    setNotice(null);
    const keep = { part: c.part, ask: c.ask };
    if (c.part === 'account' || c.part === 'private') return say(["Let's make your account first. Then ask me anything."], keep);
    if (isQuestion(text)) {
      const lines = explainTyped(text);
      return say(lines.length ? [...lines, 'Anything else you want to know? If not, pick your answer below.'] : ['Good question! I can explain any app or word you see here. Try asking “What is Work?”'], keep);
    }
    if (c.part === 'done') return say(["You're all set! You can change your answers anytime in Profile."], keep);
    const read = readAbout(text);
    const got = [...read.goals.map((g) => `goal:${g}`), ...read.identities, ...read.custom, ...read.blockers.map((b) => `way:${b}`)];
    if (got.length === 0) return say(["Hmm, I couldn't match that to anything. Could you tap the closest options? You can also ask me what something means."], keep);
    const a = c.answers;
    const crafted = read.identities.some((k) => kindOf(k) === 'craft');
    const answers: SetupAnswers = {
      identities: uniq([...a.identities, ...(crafted && !a.identities.includes('creator') ? ['creator'] : []), ...read.identities, ...read.custom]),
      goals: uniq([...a.goals, ...read.goals]).slice(0, MAX_SETUP_GOALS),
      blockers: uniq([...a.blockers, ...read.blockers]),
    };
    const asked = uniq<Question>([
      ...c.asked,
      ...(read.goals.length ? (['goals'] as const) : []),
      ...(read.identities.some((k) => ['role', 'life'].includes(kindOf(k))) || read.custom.length ? (['who'] as const) : []),
      ...(read.identities.some((k) => kindOf(k) === 'craft' || kindOf(k) === 'service') ? (['work'] as const) : []),
      ...(read.blockers.length ? (['way'] as const) : []),
    ]);
    next(answers, asked, ['Got it. Here is what I picked up:', { node: <Tags keys={got} /> }]);
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    clearTimers();
    setTyping(false);
    setHistory((h) => h.slice(0, -1));
    setChat(prev);
  };

  const tellMore = (more: string) => {
    const id = (ids.current += 1);
    setChat((c) => ({ ...c, log: [...c.log, { id, from: 'bot', host: 'bumling', text: more }], ask: c.ask && 'more' in c.ask ? { ...c.ask, more: undefined } : c.ask }));
  };

  // ---- start: the account first when there is none; someone set up already is offered a second go.
  const begin = (name: string, afterAccount = false) => {
    const u = me.data?.user;
    const hi = afterAccount ? `You're in${name ? `, ${name}` : ''}! 🎉` : `Hey${name ? ` ${name}` : ' there'}! 👋 ${hello('bumling')}`;
    if (u?.onboardedAt && (u.identities.length || u.intake.goals.length)) {
      const before: SetupAnswers = { identities: u.identities, goals: u.intake.goals, blockers: u.intake.blockers };
      const line = identityLine(before);
      return say([hi, `You've set this up before.${line ? ` Last time you told me: ${line.charAt(0).toLowerCase()}${line.slice(1)}` : ''}`, "Want to change anything? I'll fill in your old answers, so it's quick."], {
        part: 'hello',
        answers: before,
        asked: [],
        ask: { kind: 'chips', chips: [{ value: 'go', label: 'Yes, change my answers' }, { value: 'keep', label: 'No, keep them as they are' }] },
      });
    }
    askGoals(EMPTY, [], [hi, "I'll ask you three or four quick questions. Your answers decide which apps I switch on for you.", 'Tap the answers that fit. You can also type in your own words, or ask me what anything means.']);
  };
  const beginRef = useKeptRef(scope, 'begin', begin);
  beginRef.current = begin;

  const startOver = () => {
    forgetKept(scope);
    setRound((r) => r + 1);
  };

  useEffect(() => {
    if (started.current || !me.data || !ready) return;
    started.current = true;
    const u = me.data.user;
    if (!u.email) {
      // A device session from Welcome: the account comes first, in two small cards, so nothing said here is lost.
      askSignIn([`Hey${u.displayName ? ` ${u.displayName}` : ' there'}! 👋 ${hello('bumling')}`], u.displayName ?? '');
      return;
    }
    beginRef.current(u.displayName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data, ready, say, round]);

  // Arriving with ?fresh (from Profile) always starts a new conversation.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (!params.has('fresh') || !me.data) return;
    setParams({}, { replace: true });
    startOver();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, me.data]);

  // ---- what shows under the last lines
  const ask = chat.ask;
  const answerNode = (() => {
    if (!ask) return null;
    if (ask.kind === 'wait') {
      return (
        <p role="status" className="m-0 text-[14px] font-bold text-ink-soft">
          {ask.text}
        </p>
      );
    }
    const body =
      ask.kind === 'chips' ? (
        <ChoiceChips choices={ask.chips} onPick={(c) => answer(c.value, c.label)} />
      ) : ask.kind === 'groups' ? (
        <ChoiceGroups groups={ask.groups} picked={picks} onPicked={setPicks} max={ask.max} min={ask.min} done={ask.done} skip={ask.skip} onDone={(v, l) => answer(v, l.length ? said(l) : (ask.skip ?? 'None'))} />
      ) : (
        ask.render((v, label) => answer(v, label))
      );
    const links = [
      ...(ask.more ? [{ label: 'Tell me more', onClick: () => tellMore(ask.more!) }] : []),
      ...(history.length > 0 && chat.part !== 'done' ? [{ label: 'Change my last answer', onClick: undo }] : []),
    ];
    return (
      <>
        {body}
        <ChatLinks items={links} />
      </>
    );
  })();

  const steps: Part[] = ['goals', 'who', ...(makes(chat.answers) ? (['work'] as Part[]) : []), 'way', 'match'];
  const at = steps.indexOf(chat.part);
  const step = chat.part === 'account' || chat.part === 'private' ? 'Your account' : chat.part === 'hello' ? 'Welcome back' : chat.part === 'done' ? 'All set' : chat.part === 'match' ? 'Your apps' : `Question ${at + 1} of ${steps.length - 1}`;
  const progress = chat.part === 'done' ? 1 : at < 0 ? 0 : at / steps.length;

  return (
    <ChatScreen
      title="Setting up"
      step={step}
      progress={progress}
      closeTo={onboarded ? '/you' : '/start'}
      onStartOver={startOver}
      log={chat.log}
      typing={typing ? 'bumling' : null}
      answer={answerNode}
      answerKey={`${chat.part}:${chat.log.filter((m) => m.from === 'you').length}`}
      notice={notice}
      composer={{ placeholder: chat.part === 'account' || chat.part === 'private' ? 'Make your account first' : 'Type or ask anything', onSend: typed, disabled: chat.part === 'account' || chat.part === 'private' || typing }}
    />
  );
}
