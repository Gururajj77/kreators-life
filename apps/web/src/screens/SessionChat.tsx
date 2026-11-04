import {
  affirmationFor,
  BAND_STATEMENTS,
  BREATHING,
  CONTRACT_MIN_DAYS_DEFAULT,
  COURAGE,
  DEFAULT_REAL_DAY,
  DRIVES,
  FEAR_OPTIONS,
  firstQuestionId,
  KIND_META,
  ladderOptions,
  levelByValue,
  MANTRAS,
  mantraLine,
  OWN_MANTRA_MAX,
  INSECURITY_WEIGHTS,
  weightWord,
  STAR_WORDS,
  scoreOfStars,
  MAP_BAND_META,
  MAP_BANDS,
  MAP_LEVELS,
  MAX_FEARS,
  MAX_INSECURITIES,
  nextQuestionId,
  PENALTIES,
  isOptionalPillar,
  pickFocus,
  picksOfPlacement,
  placementFlags,
  placementFromPicks,
  priorityOrder,
  readFeelings,
  QUESTION_BY_ID,
  RELATIONSHIP_BY_KEY,
  RELATIONSHIPS,
  awayPlacement,
  routineFor,
  SCORE_LABEL,
  SCORECARD,
  type Contract,
  type Drives,
  type Fear,
  type Insecurity,
  type LadderPicks,
  type NodeKind,
  type OnboardingResponse,
  type Placement,
  type Practices,
  type RealDay,
  type RelationshipKey,
  type Scores,
  type Host,
  type IconName,
  type Question,
  characterHello,
  LIVE_CALL_CENTS,
  money,
  PLAN_CURRENCY,
} from '@kreators/shared';
import { Check } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AccountForm } from '../components/AccountForm';
import { ProfileCard } from '../components/ProfileCard';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Fold } from '../components/Fold';
import { Icon } from '../components/Icon';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { Toggle } from '../components/Toggle';
import { ConsciousnessMap, PlacementChart } from '../components/LifeMap';
import { Pyramid } from '../components/Pyramid';
import { Sheet } from '../components/Sheet';
import { ChatActions, ChatLinks, ChatScreen, ChoiceChips, ChoiceGroups, chip, typingTime } from '../components/Chat';
import { api, errorText } from '../lib/api';
import { FIELD } from '../lib/ui';
import { todayLocal } from '../lib/date';
import { useAuthed, useMe, useRefreshAll } from '../lib/queries';
import { useAssistantModel, useSession } from '../lib/store';
import { explainTyped } from '../lib/explain';
import { forgetKept, useKept, useKeptRef } from '../lib/kept';

// ---------------------------------------------------------------------------
// The hosts. Each part is run by one of the seven, in that character's own voice: Dew calm and clear, Ember
// direct, Pip warm and playful, Sunny caring and practical, Lumen quiet, Sage the mentor who sees the whole.
// ---------------------------------------------------------------------------


/**
 * The parts the header names and the progress bar counts: eight, plus the account when there is none. The frame opens
 * the map, what gets in the way is part of the map, the live call is a line in the contract, and the first steps are
 * part of the pillars. The header shows a name and a bar, never "part 3 of 8".
 */
const PARTS = ['account', 'map', 'scorecard', 'day', 'focus', 'plan', 'contract', 'pillars', 'done'] as const;
type Part = (typeof PARTS)[number];
const PART_NAME: Record<Part, string> = {
  account: 'Your account',
  map: 'Your map',
  scorecard: 'How things are going',
  day: 'Your real day',
  focus: 'Your focus',
  plan: 'Routine and practices',
  contract: 'Your plan',
  pillars: 'Your pillars',
  done: 'What comes next',
};

// ---------------------------------------------------------------------------
// Messages, asks and the stage.
// ---------------------------------------------------------------------------

interface Msg {
  id: number;
  from: 'bot' | 'you';
  host?: Host;
  text?: string;
  node?: ReactNode;
}
/** A chip with a blurb is drawn as a card, the way the card flow drew it; without one it is a pill. */
type Chip = { label: string; value: string; icon?: IconName; blurb?: string };
type Send = (value: Record<string, string>, label: string) => void;
type Ask =
  | { kind: 'chips'; chips: Chip[]; more?: string }
  | { kind: 'multi'; chips: Chip[]; min: number; max: number; done: string; more?: string }
  | { kind: 'form'; render: (send: Send) => ReactNode; more?: string }
  | { kind: 'wait'; text: string };

type Stage =
  | { part: 'account' }
  | { part: 'hello' }
  | { part: 'map'; sub: 'all' | 'evidence' }
  | { part: 'way' }
  | { part: 'scorecard'; sub: 'all' | 'behaviour'; checks: RelationshipKey[] }
  | { part: 'day' }
  | { part: 'focus' }
  | { part: 'plan'; sub: 'routine' | 'practices' }
  | { part: 'contract' }
  | { part: 'pillars'; id: string; history: string[]; own?: boolean }
  | { part: 'steps' }
  | { part: 'done' };
/** Which named part each stage belongs to. */
const PART_OF: Record<Stage['part'], Part> = { account: 'account', hello: 'map', map: 'map', way: 'map', scorecard: 'scorecard', day: 'day', focus: 'focus', plan: 'plan', contract: 'contract', pillars: 'pillars', steps: 'pillars', done: 'done' };

interface Data {
  placements: Partial<Record<RelationshipKey, Placement>>;
  /** Love, teachers or faith set aside as not part of life right now: placed at Neutrality, left out of the focus. */
  away: RelationshipKey[];
  fears: Fear[];
  insecurities: Insecurity[];
  scores: Scores;
  behaviour: Partial<Record<RelationshipKey, number>>;
  realDay: RealDay;
  focus: RelationshipKey[];
  practices: Practices;
  contract: Pick<Contract, 'minDays' | 'checkinTime' | 'penalty' | 'signedName'>;
  answers: Record<string, number>;
  picks: LadderPicks;
  result: OnboardingResponse | null;
}
const EMPTY: Data = {
  placements: {},
  away: [],
  fears: [],
  insecurities: [],
  scores: {},
  behaviour: {},
  realDay: DEFAULT_REAL_DAY,
  focus: [],
  practices: { mantra: 'none', breathing: 'box', affirmation: '', reading: '' },
  contract: { minDays: CONTRACT_MIN_DAYS_DEFAULT, checkinTime: '21:00', penalty: 'streak', signedName: '' },
  answers: {},
  picks: {},
  result: null,
};
interface Chat {
  log: Msg[];
  stage: Stage;
  data: Data;
  ask: Ask | null;
}

const who = (k: RelationshipKey) => RELATIONSHIP_BY_KEY[k].character;
/** A pillar's name as it reads in a sentence, in quotes so a name like “With the divine” reads right. */
const pillar = (k: RelationshipKey) => `“${RELATIONSHIP_BY_KEY[k].name}”`;
/** Which pillars drop below Courage, said by name for one or two and by count when there are more. */
const belowCourage = (keys: RelationshipKey[]) =>
  keys.length === 0
    ? ''
    : keys.length === RELATIONSHIPS.length
      ? 'All seven drop below Courage under stress, so any of them is a good place to start.'
      : keys.length > 2
        ? `${keys.length} of the seven drop below Courage under stress, so any of them is a good place to start.`
        : `${listOf(keys.map(pillar))} ${keys.length === 1 ? 'drops' : 'drop'} below Courage under stress, so ${keys.length === 1 ? 'it is' : 'they are'} a good place to start.`;
const listOf = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
/** The last step: open Pillars, or add your interests to your profile first. */
const DONE_CHIPS: Chip[] = [
  { label: 'Open my pillars', value: 'go' },
  { label: 'Add my interests', value: 'profile' },
];
/** How a host introduces itself: its name and what it looks after. */
const hello = characterHello;
const placedOf = (d: Data) => RELATIONSHIPS.map((r) => d.placements[r.key]).filter((p): p is Placement => Boolean(p));
const card = (on: boolean) => `toy toy-flat w-full rounded-tile border-2 p-sm text-left ${on ? 'border-ink bg-card' : 'border-line bg-card'}`;
const levelName = (v: number | undefined) => (v === undefined ? '' : (levelByValue(v)?.name ?? ''));

// ---------------------------------------------------------------------------
// The cards. Each is one part answered in one go, drawn the way the card flow drew it.
// ---------------------------------------------------------------------------

function FrameCard() {
  return (
    <ul className="m-0 flex list-none flex-col gap-xs p-0">
      {RELATIONSHIPS.map((r) => (
        <li key={r.key} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
          <Avatar relationship={r.key} size={36} decorative still />
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold">
              {r.name} <span className="font-semibold text-ink-soft">· {r.character}</span>
            </span>
            <span className="block text-[14px] font-semibold text-ink-soft">{coversLine(r)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The whole scale the map comes from, folded so the card stays light. Feelings are picked by name; the numbers only show the order. */
function MapPicture() {
  return (
    <Fold title="See the whole map">
      <p className="m-0 mb-xs text-[14px] text-ink-soft">From Shame at the bottom to Full Consciousness at the top.</p>
      <ConsciousnessMap />
    </Fold>
  );
}

/** An answer of your own: a short line, or back to the choices. */
function OwnAnswerCard({ foundation, onSend }: { foundation: boolean; onSend: Send }) {
  const [text, setText] = useState('');
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <label className="block">
        <span className="block text-[14px] font-bold">{foundation ? 'Your foundation' : 'Your answer'}</span>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={120} placeholder={foundation ? 'Like: Sunday lunch with family, every week' : 'In a few words'} className={FIELD} />
      </label>
      <ChatActions full skip="Go back" onSkip={() => onSend({ back: '1' }, 'Go back to the choices')} next="Use my words" ready={text.trim().length > 1} onNext={() => onSend({ text: text.trim() }, text.trim())} />
    </div>
  );
}

/** Your own answer to a question in the pillars part counts as the choice nearest the middle, two points. */
const ownValue = (q: Question) => {
  const opts = q.options ?? [];
  let best = 0;
  opts.forEach((o, i) => {
    if (Math.abs((o.points ?? 0) - 2) < Math.abs((opts[best]?.points ?? 0) - 2)) best = i;
  });
  return best;
};

/** What a relationship covers, said under its name. */
const coversLine = (r: (typeof RELATIONSHIPS)[number]) => (r.key === 'self' ? 'Your body, your health and your mind.' : r.key === 'servant_leader' ? 'Your work, your money and your time.' : r.question);

/**
 * The map, one relationship at a time. For each, tick every feeling you know from it, on good days and bad ("Pick all that
 * you feel"); the core and the floor are worked out from the ticks (`placementFromPicks`). Your own words can suggest ticks
 * (`readFeelings`, rules only), which you then confirm. Love, teachers and faith can be set aside as not part of your life
 * right now. One card for the whole map, sent once when all seven are done.
 */
function MapForm({ initial, initialAway, onSend }: { initial: Partial<Record<RelationshipKey, Placement>>; initialAway: RelationshipKey[]; onSend: Send }) {
  const [picks, setPicks] = useState<Partial<Record<RelationshipKey, number[]>>>(() => Object.fromEntries(RELATIONSHIPS.filter((r) => initial[r.key] && !initialAway.includes(r.key)).map((r) => [r.key, picksOfPlacement(initial[r.key]!)])));
  const [away, setAway] = useState<RelationshipKey[]>(initialAway);
  const done = (k: RelationshipKey) => away.includes(k) || (picks[k]?.length ?? 0) > 0;
  const [at, setAt] = useState(() => Math.max(0, RELATIONSHIPS.findIndex((r) => !done(r.key))));
  const [words, setWords] = useState('');
  const [suggested, setSuggested] = useState<number[] | null>(null);
  // "Read with AI": only with a plan and a model that keeps nothing. The rules above stay the default and free.
  const status = useAuthed(['assistant'], api.assistantStatus);
  const picked = useAssistantModel((m) => m.model);
  const privateModels = (status.data?.connected ? status.data.models : []).filter((m) => m.private);
  const aiModel = privateModels.find((m) => m.id === picked) ?? privateModels[0] ?? null;
  const canAi = Boolean(aiModel && status.data && status.data.account.plan !== 'none' && status.data.account.total > 0);
  const [reading, setReading] = useState(false);
  const [readBy, setReadBy] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState('');
  const readWithAi = async () => {
    if (!aiModel) return;
    setReading(true);
    setAiNote('');
    try {
      const out = await api.readFeelingsAi({ text: words, relationship: r.key, model: aiModel.id });
      setSuggested(out.levels);
      setReadBy(out.model);
    } catch (e) {
      setAiNote(errorText(e, 'The AI could not read that. Tap Read my words instead.'));
    } finally {
      setReading(false);
    }
  };
  const top = useRef<HTMLDivElement>(null);
  const r = RELATIONSHIPS[at]!;
  const mine = picks[r.key] ?? [];
  const isAway = away.includes(r.key);
  const placed = isAway ? null : placementFromPicks(r.key, mine);
  const allDone = RELATIONSHIPS.every((x) => done(x.key));
  const go = (i: number) => {
    setAt(i);
    setWords('');
    setSuggested(null);
    setReadBy(null);
    setAiNote('');
    top.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const toggle = (v: number) => setPicks((p) => ({ ...p, [r.key]: mine.includes(v) ? mine.filter((x) => x !== v) : [...mine, v] }));
  const setAside = (on: boolean) => setAway((a) => (on ? [...a, r.key] : a.filter((k) => k !== r.key)));
  const nextOpen = () => {
    const after = RELATIONSHIPS.findIndex((x, i) => i > at && !done(x.key));
    return after >= 0 ? after : RELATIONSHIPS.findIndex((x) => !done(x.key));
  };
  const send = () => {
    const rec: Record<string, string> = { away: JSON.stringify(away) };
    const said: string[] = [];
    for (const x of RELATIONSHIPS) {
      if (away.includes(x.key)) {
        said.push(`${x.name}: not part of my life right now`);
        continue;
      }
      const p = placementFromPicks(x.key, picks[x.key] ?? [])!;
      rec[`${x.key}.core`] = String(p.core);
      rec[`${x.key}.floor`] = String(p.floor);
      said.push(p.core === p.floor ? `${x.name}: ${levelName(p.core)}` : `${x.name}: ${levelName(p.floor)} to ${levelName(p.core)}`);
    }
    onSend(rec, said.join('. '));
  };
  const following = nextOpen();
  const last = allDone || following < 0 || following === at;
  return (
    <div ref={top} className="scroll-mt-[120px]">
      {/* The seven, as a row of faces: where you are, and which are done. */}
      <ol className="m-0 grid list-none grid-cols-7 gap-xs p-0" aria-label="The seven relationships">
        {RELATIONSHIPS.map((x, i) => (
          <li key={x.key} data-pillar={x.key}>
            <button type="button" onClick={() => go(i)} aria-current={i === at ? 'step' : undefined} aria-label={`${x.name}${done(x.key) ? ', done' : ''}`} className={`toy toy-flat relative flex min-h-[48px] w-full items-center justify-center rounded-tile border-2 ${i === at ? 'border-ink bg-card' : 'border-transparent'}`}>
              <Avatar relationship={x.key} size={32} decorative still />
              {done(x.key) && (
                <span aria-hidden="true" className="absolute right-[2px] top-[2px] flex size-[16px] items-center justify-center rounded-pill bg-ink text-on-ink">
                  <Icon icon={Check} size={12} strokeWidth={3} />
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>

      <div data-pillar={r.key} className="mt-sm rounded-tile bg-card p-sm shadow-toy-soft">
        <div className="flex items-center gap-sm">
          <Avatar relationship={r.key} size={40} decorative still />
          <span className="min-w-0 flex-1">
            <span className="block text-[18px] font-bold">{r.name}</span>
            <span className="block text-[14px] font-semibold text-ink-soft">{coversLine(r)}</span>
          </span>
        </div>
        {isOptionalPillar(r.key) && (
          <div className="mt-sm">
            <Toggle compact on={isAway} onChange={setAside} label="Not part of my life right now" />
          </div>
        )}
        {isAway ? (
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Set aside for now. It sits at Neutrality, stays out of your focus and gets no pyramid. You can turn it back on from your life map under Pillars.</p>
        ) : (
          <>
            <p className="mt-sm m-0 text-[14px] font-bold">Pick all that you feel here, on good days and on bad ones.</p>
            {[...MAP_BANDS].reverse().map((b) => (
              <div key={b} className="mt-sm">
                <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{MAP_BAND_META[b].name}</p>
                <p className="m-0 text-[12px] font-semibold text-ink-soft">{BAND_STATEMENTS[r.key][b]}</p>
                <ul className="fx-inset mt-xs">
                  {MAP_LEVELS.filter((l) => l.band === b)
                    .slice()
                    .reverse()
                    .map((l) => {
                      const on = mine.includes(l.value);
                      return (
                        <li key={l.value}>
                          <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(l.value)} className="fx-row">
                            <span aria-hidden="true" className={`flex size-[24px] shrink-0 items-center justify-center rounded-[8px] border-2 ${on ? 'border-ink bg-ink text-on-ink' : 'border-line'}`}>
                              {on && <Icon icon={Check} size={16} strokeWidth={3} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[16px] font-bold">{l.name}</span>
                              <span className="block text-[14px] font-semibold text-ink-soft">“{l.sounds}”</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
            <Fold className="mt-sm" title="Say it in your own words">
              <p className="m-0 mb-xs text-[14px] text-ink-soft">I read your words and suggest feelings. You choose which to tick. Read my words is free and stays on this page.</p>
              <label className="block">
                <span className="sr-only">How {r.name.toLowerCase()} feels for you</span>
                <textarea value={words} onChange={(e) => setWords(e.target.value)} rows={2} maxLength={600} placeholder="Like: I get scared to call, but I keep trying" className={FIELD} />
              </label>
              <div className="mt-xs flex flex-wrap gap-xs">
                <Button
                  type="button"
                  variant="outline"
                  disabled={words.trim().length < 3}
                  onClick={() => {
                    setSuggested(readFeelings(words));
                    setReadBy(null);
                    setAiNote('');
                  }}
                >
                  Read my words
                </Button>
                {canAi && (
                  <Button type="button" variant="outline" disabled={words.trim().length < 3 || reading} onClick={() => void readWithAi()}>
                    {reading ? 'Reading' : 'Read with AI'}
                  </Button>
                )}
              </div>
              {canAi && <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">Read with AI sends your words to {aiModel!.name}. Uses a few credits. The model keeps nothing.</p>}
              {aiNote && (
                <p className="mt-xs m-0 text-[14px] font-semibold" role="alert">
                  {aiNote}
                </p>
              )}
              {suggested && (
                <div className="mt-xs" role="status">
                  {suggested.length === 0 ? (
                    <p className="m-0 text-[14px] font-semibold text-ink-soft">I could not find a feeling in that. Try words like scared, fine or grateful, or tick the list above.</p>
                  ) : (
                    <>
                      <p className="m-0 text-[14px] font-semibold">That sounds like {listOf(suggested.map((v) => levelName(v)))}. Is that right?</p>
                      {readBy && <p className="m-0 text-[12px] font-semibold text-ink-soft">Read with AI by {readBy}.</p>}
                      <div className="mt-xs flex flex-wrap gap-xs">
                        <Button
                          type="button"
                          onClick={() => {
                            setPicks((p) => ({ ...p, [r.key]: [...new Set([...mine, ...suggested])] }));
                            setSuggested(null);
                          }}
                        >
                          Yes, tick these
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setSuggested(null)}>
                          No, I will pick
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </Fold>
            {placed && (
              <p className="mt-sm m-0 rounded-tile bg-paper p-sm text-[14px] font-bold" role="status">
                {placed.core === placed.floor ? `You usually sit at ${levelName(placed.core)}.` : `You usually sit at ${levelName(placed.core)}, and drop to ${levelName(placed.floor)} under stress.`}
              </p>
            )}
          </>
        )}
      </div>
      {last ? (
        <ChatActions full skip={at > 0 ? 'Back' : undefined} onSkip={() => go(at - 1)} next="That is my map" ready={allDone} onNext={send} />
      ) : (
        <ChatActions full skip={at > 0 ? 'Back' : undefined} onSkip={() => go(at - 1)} next={`Next: ${RELATIONSHIPS[following]!.name}`} ready={done(r.key)} onNext={() => go(following)} />
      )}
    </div>
  );
}

function EvidenceForm({ keys, onSend }: { keys: RelationshipKey[]; onSend: Send }) {
  const [v, setV] = useState<Record<string, string>>({});
  return (
    <div>
      <ul className="m-0 flex list-none flex-col gap-xs p-0">
        {keys.map((k) => (
          <li key={k} className="rounded-tile bg-card p-sm shadow-toy-soft">
            <label className="block">
              <span className="flex items-center gap-xs text-[14px] font-bold">
                <Avatar relationship={k} size={24} decorative still />
                {RELATIONSHIP_BY_KEY[k].name}: one thing from last week that shows it
              </span>
              <textarea value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} rows={2} maxLength={500} placeholder="What you did, not what you believe" className={FIELD} />
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">Leave one empty and that pillar is held at Acceptance until there is something to show.</p>
      <ChatActions full next="Send" onNext={() => onSend(v, keys.map((k) => `${RELATIONSHIP_BY_KEY[k].name}: ${v[k]?.trim() ? v[k] : 'nothing yet'}`).join('. '))} />
    </div>
  );
}

/** Fears and insecurities in one card: pick, add your own, say where each sits and whether it drives you. */
function WayForm({ onSend }: { onSend: Send }) {
  const [fears, setFears] = useState<Fear[]>([]);
  const [own, setOwn] = useState('');
  const [ins, setIns] = useState<Insecurity[]>([{ text: '', weight: 5, relationship: 'self' }]);
  const has = (t: string) => fears.some((f) => f.text === t);
  const toggle = (t: string) => setFears((f) => (has(t) ? f.filter((x) => x.text !== t) : f.length < MAX_FEARS ? [...f, { text: t, relationship: 'self', drives: 'sometimes' }] : f));
  const addOwn = () => {
    const t = own.trim();
    if (t && !has(t) && fears.length < MAX_FEARS) setFears([...fears, { text: t, relationship: 'self', drives: 'sometimes' }]);
    setOwn('');
  };
  const pillarSelect = (value: RelationshipKey, onChange: (k: RelationshipKey) => void, label: string) => (
    <label className="block text-[12px] font-bold text-ink-soft">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value as RelationshipKey)} className={FIELD}>
        {RELATIONSHIPS.map((r) => (
          <option key={r.key} value={r.key}>
            {r.name}
          </option>
        ))}
      </select>
    </label>
  );
  const kept = ins.filter((i) => i.text.trim());
  return (
    <div>
      <p className="m-0 text-[14px] font-bold">Fears. What shows up when you are about to act?</p>
      <div className="mt-xs flex flex-wrap gap-xs">
        {FEAR_OPTIONS.map((f) => (
          <button key={f} type="button" aria-pressed={has(f)} className={chip(has(f))} onClick={() => toggle(f)}>
            {f}
          </button>
        ))}
      </div>
      <div className="mt-xs flex gap-xs">
        <input value={own} onChange={(e) => setOwn(e.target.value)} maxLength={120} placeholder="Or your own words" className="min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOwn(); } }} />
        <Button type="button" variant="outline" onClick={addOwn} disabled={!own.trim()}>
          Add
        </Button>
      </div>
      {fears.length > 0 && (
        <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
          {fears.map((f, i) => (
            <li key={f.text} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-[14px] font-bold">{f.text}</p>
              <div className="grid gap-xs md:grid-cols-2">
                {pillarSelect(f.relationship, (k) => setFears(fears.map((x, j) => (j === i ? { ...x, relationship: k } : x))), 'Pulls down')}
                <label className="block text-[12px] font-bold text-ink-soft">
                  Drives your decisions?
                  <select value={f.drives} onChange={(e) => setFears(fears.map((x, j) => (j === i ? { ...x, drives: e.target.value as Drives } : x)))} className={FIELD}>
                    {DRIVES.map((d) => (
                      <option key={d} value={d}>
                        {d === 'yes' ? 'Yes, often' : d === 'sometimes' ? 'Sometimes' : 'Not really'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-md m-0 text-[14px] font-bold">Insecurities. What do you worry people see?</p>
      <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">Common ones: being awkward around people, looks, little experience with relationships, overthinking. Leave it empty if nothing comes.</p>
      <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
        {ins.map((it, i) => (
          <li key={i} className="rounded-tile bg-card p-sm shadow-toy-soft">
            <input value={it.text} onChange={(e) => setIns(ins.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} maxLength={120} placeholder="In a few words" className="w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
            {it.text.trim() && (
              <div className="grid gap-xs md:grid-cols-2">
                <label className="block text-[12px] font-bold text-ink-soft">
                  How heavy does it feel?
                  <span className="mt-xs flex flex-wrap gap-xs" role="group" aria-label="How heavy it feels">
                    {INSECURITY_WEIGHTS.map((w) => (
                      <button key={w.weight} type="button" aria-pressed={weightWord(it.weight) === w.name} className={chip(weightWord(it.weight) === w.name)} onClick={() => setIns(ins.map((x, j) => (j === i ? { ...x, weight: w.weight } : x)))}>
                        {w.name}
                      </button>
                    ))}
                  </span>
                </label>
                {pillarSelect(it.relationship, (k) => setIns(ins.map((x, j) => (j === i ? { ...x, relationship: k } : x))), 'Sits in')}
              </div>
            )}
          </li>
        ))}
      </ul>
      {ins.length < MAX_INSECURITIES && kept.length === ins.length && (
        <button type="button" onClick={() => setIns([...ins, { text: '', weight: 5, relationship: 'self' }])} className="mt-xs text-[14px] font-bold text-ink-soft underline underline-offset-4">
          Add one more
        </button>
      )}
      <ChatActions full next="That is what gets in the way" onNext={() => onSend({ fears: JSON.stringify(fears), insecurities: JSON.stringify(kept.map((i) => ({ ...i, text: i.text.trim() }))) }, [fears.length ? `Fears: ${fears.map((f) => f.text).join(', ')}` : 'No fears named', kept.length ? `Insecurities: ${kept.map((i) => i.text.trim()).join(', ')}` : 'no insecurities named'].join('. '))} />
    </div>
  );
}

/** Five stars to tap. Each star is two points out of ten, so the score rules work as before. */
function Stars({ value, onChange, label, color }: { value: number; onChange: (stars: number) => void; label: string; color: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-[2px]">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}: ${STAR_WORDS[n - 1]}`} onClick={() => onChange(n)} className="toy toy-flat flex size-[44px] items-center justify-center rounded-pill">
          <span style={{ color: n <= value ? color : 'var(--color-ink-mute)' }}>
            <AnimatedIcon name="star" size={28} active={n <= value} />
          </span>
        </button>
      ))}
    </div>
  );
}

function ScoreForm({ away, onSend }: { away: RelationshipKey[]; onSend: Send }) {
  // A pillar set aside as not part of life right now is not rated.
  const seven = RELATIONSHIPS.filter((r) => !away.includes(r.key)).map((r) => r.key);
  const keys = [...SCORECARD.health, ...SCORECARD.wealth, ...seven];
  const labels: Record<string, string> = { ...SCORE_LABEL, ...Object.fromEntries(RELATIONSHIPS.map((r) => [r.key, r.name])) };
  // Stars, one to five; three to start.
  const [v, setV] = useState<Record<string, number>>(Object.fromEntries(keys.map((k) => [k, 3])));
  const group = (title: string, ks: readonly string[], color: string, pillar: RelationshipKey) => (
    <div data-pillar={pillar}>
      <h3 className="text-[16px]">{title}</h3>
      <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
        {ks.map((k) => (
          <li key={k} className="rounded-tile bg-card p-sm shadow-toy-soft">
            <p className="m-0 flex items-baseline justify-between gap-sm text-[14px] font-bold">
              <span>{labels[k]}</span>
              <span className="shrink-0 text-ink-soft">{STAR_WORDS[(v[k] ?? 3) - 1]}</span>
            </p>
            <div className="mt-xs">
              <Stars value={v[k] ?? 3} onChange={(n) => setV({ ...v, [k]: n })} label={labels[k] ?? k} color={color} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
  const avg = (ks: readonly string[]) => (ks.reduce((a, k) => a + (v[k] ?? 0), 0) / ks.length).toFixed(1);
  return (
    <div className="flex flex-col gap-md">
      {group('Health', SCORECARD.health, 'var(--deep-self)', 'self')}
      {group('Wealth', SCORECARD.wealth, 'var(--deep-servant_leader)', 'servant_leader')}
      {group(away.length ? 'Your relationships' : 'The seven', seven, 'var(--deep-friendship)', 'friendship')}
      <ChatActions full next="Those are my stars" onNext={() => onSend(Object.fromEntries(keys.map((k) => [k, String(scoreOfStars(v[k] ?? 3))])), `Health ${avg(SCORECARD.health)} stars, wealth ${avg(SCORECARD.wealth)} stars, relationships ${avg(seven)} stars on average`)} />
    </div>
  );
}

function DayForm({ initial, onSend }: { initial: RealDay; onSend: Send }) {
  const [d, setD] = useState<RealDay>(initial);
  const t = (key: keyof RealDay, label: string) => (
    <label key={key} className="block">
      <span className="block text-[14px] font-bold">{label}</span>
      <input type="time" value={d[key]} onChange={(e) => setD({ ...d, [key]: e.target.value })} className={FIELD} />
    </label>
  );
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="grid grid-cols-2 gap-xs md:grid-cols-4">
        {t('wake', 'Wake up')}
        {t('sleep', 'Lights out')}
        {t('workStart', 'Work starts')}
        {t('workEnd', 'Work ends')}
      </div>
      <div className="mt-xs grid gap-xs md:grid-cols-2">
        <label className="block">
          <span className="block text-[14px] font-bold">Gym or movement, if any</span>
          <input type="time" value={d.gym} onChange={(e) => setD({ ...d, gym: e.target.value })} className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">The last hour before sleep is usually</span>
          <input value={d.evening} onChange={(e) => setD({ ...d, evening: e.target.value })} maxLength={200} placeholder="Scrolling, a show, work mail" className={FIELD} />
        </label>
      </div>
      <ChatActions full next="That is my day" onNext={() => onSend({ ...d }, `Up at ${d.wake}, lights out ${d.sleep}, work ${d.workStart} to ${d.workEnd}${d.gym ? `, gym ${d.gym}` : ''}${d.evening ? `, evenings: ${d.evening}` : ''}`)} />
    </div>
  );
}

function RoutineCard({ data }: { data: Data }) {
  const [dayType, setDayType] = useState<'general' | 'exceptional'>('general');
  const routine = routineFor(data.realDay, 0, data.focus, placedOf(data));
  const blocks = dayType === 'general' ? routine.general : routine.exceptional;
  return (
    <div>
      <div className="flex gap-xs">
        {(['general', 'exceptional'] as const).map((d) => (
          <button key={d} type="button" className={chip(dayType === d)} onClick={() => setDayType(d)}>
            {d === 'general' ? 'A normal day' : 'An exceptional day'}
          </button>
        ))}
      </div>
      <ol className="mt-sm m-0 flex list-none flex-col gap-xs p-0">
        {blocks.map((b) => (
          <li key={b.key} className="rounded-tile bg-card p-sm shadow-toy-soft">
            <p className="m-0 flex items-center justify-between text-[16px] font-bold">
              <span>{b.name}</span>
              <span className="text-[12px] text-ink-soft">
                {b.start} to {b.end}
              </span>
            </p>
            {b.steps.length > 0 && (
              <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0 text-[14px] font-semibold">
                {b.steps.map((s) => (
                  <li key={s}>• {s}</li>
                ))}
              </ul>
            )}
            <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{b.note}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PracticesForm({ focus, onSend }: { focus: RelationshipKey[]; onSend: Send }) {
  const [p, setP] = useState<Practices>({ mantra: 'none', ownMantra: '', breathing: 'box', affirmation: affirmationFor(focus), reading: '' });
  const option = (m: (typeof MANTRAS)[number]) => (
    <button type="button" aria-pressed={p.mantra === m.key} onClick={() => setP({ ...p, mantra: m.key })} className={`${card(p.mantra === m.key)} h-full`}>
      <span className="block text-[16px] font-bold">{m.name}</span>
      <span className="block text-[14px] font-semibold text-ink-soft">{m.blurb}</span>
    </button>
  );
  const own = p.mantra === 'own';
  return (
    <div>
      <p className="m-0 text-[14px] font-bold">Mantra, five to ten minutes</p>
      <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
        {MANTRAS.filter((m) => m.key !== 'own' && m.key !== 'none').map((m) => (
          <li key={m.key}>{option(m)}</li>
        ))}
        {/* Your own words on the left, none yet on the right. */}
        <li className="grid grid-cols-2 gap-xs">
          {MANTRAS.filter((m) => m.key === 'own' || m.key === 'none').map((m) => (
            <span key={m.key}>{option(m)}</span>
          ))}
        </li>
      </ul>
      {own && (
        <label className="mt-xs block">
          <span className="block text-[14px] font-bold">Your mantra</span>
          <input value={p.ownMantra ?? ''} onChange={(e) => setP({ ...p, ownMantra: e.target.value })} maxLength={OWN_MANTRA_MAX} placeholder="The words you want to repeat" className={FIELD} />
        </label>
      )}
      <p className="mt-md m-0 text-[14px] font-bold">Breathing, three rounds</p>
      <div className="mt-xs flex flex-wrap gap-xs">
        {BREATHING.map((b) => (
          <button key={b.key} type="button" aria-pressed={p.breathing === b.key} className={chip(p.breathing === b.key)} onClick={() => setP({ ...p, breathing: b.key })} title={b.blurb}>
            {b.name}
          </button>
        ))}
      </div>
      <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{BREATHING.find((b) => b.key === p.breathing)?.blurb}</p>
      <label className="mt-md block">
        <span className="block text-[14px] font-bold">Your line, on waking and before sleep</span>
        <textarea value={p.affirmation} onChange={(e) => setP({ ...p, affirmation: e.target.value })} rows={2} maxLength={240} className={FIELD} />
      </label>
      <label className="mt-xs block">
        <span className="block text-[14px] font-bold">One page a morning, from</span>
        <input value={p.reading} onChange={(e) => setP({ ...p, reading: e.target.value })} maxLength={120} placeholder="A book, a scripture, a long essay" className={FIELD} />
      </label>
      <ChatActions
        full
        next="Those are my practices"
        ready={!own || Boolean(p.ownMantra?.trim())}
        onNext={() => onSend({ ...p, ownMantra: own ? (p.ownMantra ?? '').trim() : '' }, `${mantraLine(p)}, ${BREATHING.find((b) => b.key === p.breathing)?.name?.toLowerCase()}, “${p.affirmation.trim() || affirmationFor(focus)}”${p.reading.trim() ? `, a page of ${p.reading.trim()}` : ''}`)}
      />
    </div>
  );
}

function ContractForm({ initial, placeholder, onSend }: { initial: Data['contract']; placeholder: string; onSend: Send }) {
  const [c, setC] = useState(initial);
  const [call, setCall] = useState(false);
  return (
    <div>
      <p className="m-0 text-[14px] font-bold">Days a week, at least</p>
      <div className="mt-xs flex flex-wrap gap-xs">
        {[3, 4, 5, 6, 7].map((n) => (
          <button key={n} type="button" aria-pressed={c.minDays === n} className={chip(c.minDays === n)} onClick={() => setC({ ...c, minDays: n })}>
            {n}
          </button>
        ))}
      </div>
      <label className="mt-md block">
        <span className="block text-[14px] font-bold">Daily check-in time</span>
        <input type="time" value={c.checkinTime} onChange={(e) => setC({ ...c, checkinTime: e.target.value })} className={FIELD} />
        <span className="mt-xs block text-[12px] font-bold text-ink-soft">A reminder lands in your inbox at this time on any day you have not checked in.</span>
      </label>
      <p className="mt-md m-0 text-[14px] font-bold">When a week falls short</p>
      <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
        {PENALTIES.map((p) => (
          <li key={p.key}>
            <button type="button" aria-pressed={c.penalty === p.key} onClick={() => setC({ ...c, penalty: p.key })} className={card(c.penalty === p.key)}>
              <span className="block text-[16px] font-bold">{p.name}</span>
              <span className="block text-[14px] font-semibold text-ink-soft">{p.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-md m-0 text-[14px] font-semibold text-ink-soft">Weekly check on Sunday night, five minutes. Monthly review in thirty days. The app keeps both dates.</p>
      <label className="mt-xs block">
        <span className="block text-[14px] font-bold">Type your name to sign</span>
        <input value={c.signedName} onChange={(e) => setC({ ...c, signedName: e.target.value })} maxLength={80} placeholder={placeholder} className={FIELD} />
      </label>
      {/* The live call, once and optional: a line in the plan rather than a step of its own. */}
      <div className="mt-md">
        <Toggle on={call} onChange={setCall} label="I would like a live call with a coach" hint={`A person goes through your answers with you, for ${money(LIVE_CALL_CENTS, PLAN_CURRENCY)}. The app works without it, and saying no changes nothing.`} />
      </div>
      <ChatActions full next="Sign it" ready={Boolean(c.signedName.trim())} onNext={() => onSend({ minDays: String(c.minDays), checkinTime: c.checkinTime, penalty: c.penalty, signedName: c.signedName.trim(), call: call ? 'yes' : 'no' }, `${c.minDays} days a week, check-in at ${c.checkinTime}, ${PENALTIES.find((p) => p.key === c.penalty)?.name.toLowerCase()}. Signed ${c.signedName.trim()}.${call ? ' And I would like a live call.' : ''}`)} />
    </div>
  );
}

/** The value goal and project for every focus pillar, in one card. */
function PicksForm({ focus, result, own: ownWords = {}, onSend }: { focus: RelationshipKey[]; result: OnboardingResponse; own?: LadderPicks; onSend: Send }) {
  const [v, setV] = useState<LadderPicks>(Object.fromEntries(focus.map((k) => [k, { valueGoal: result.ladders[k].valueGoal, project: result.ladders[k].project }])));
  const [own, setOwn] = useState<Record<string, boolean>>({});
  const pick = (k: RelationshipKey, f: 'valueGoal' | 'project', list: string[]) => {
    const cur = v[k]?.[f] ?? '';
    const isOwn = own[`${k}.${f}`] || (cur !== '' && !list.includes(cur));
    return (
      <label className="block text-[12px] font-bold text-ink-soft">
        {f === 'valueGoal' ? KIND_META.value_goal.label : KIND_META.project.label}
        <select value={isOwn ? '__own' : cur} onChange={(e) => { if (e.target.value === '__own') { setOwn({ ...own, [`${k}.${f}`]: true }); setV({ ...v, [k]: { ...v[k], [f]: '' } }); } else { setOwn({ ...own, [`${k}.${f}`]: false }); setV({ ...v, [k]: { ...v[k], [f]: e.target.value } }); } }} className={FIELD}>
          {list.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value="__own">Write my own</option>
        </select>
        {isOwn && <input value={cur} onChange={(e) => setV({ ...v, [k]: { ...v[k], [f]: e.target.value } })} maxLength={120} placeholder="Your words" className={FIELD} />}
      </label>
    );
  };
  const ready = focus.every((k) => (v[k]?.valueGoal ?? '').trim() && (v[k]?.project ?? '').trim());
  return (
    <div>
      <ul className="m-0 flex list-none flex-col gap-xs p-0">
        {focus.map((k) => {
          const l = result.ladders[k];
          const o = ladderOptions(k);
          return (
            <li key={k} data-pillar={k} className="rounded-card p-md" style={{ background: `var(--soft-${k})` }}>
              <div className="flex items-start gap-sm">
                <Avatar relationship={k} size={44} decorative still />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[14px] font-bold" style={{ color: `var(--deep-${k})` }}>
                    {who(k)}, {result.scores[k]}%, {l.branch === 'low' ? 'gentle start' : 'stretch tasks'}
                  </p>
                  <p className="mt-xs m-0 text-[14px] font-semibold">
                    {KIND_META.pillar.label}: {ownWords[k]?.pillar || l.pillar}. {KIND_META.principle.label}: {l.principle}. {KIND_META.outcome.label}: {l.outcome}.
                  </p>
                </div>
              </div>
              <div className="mt-xs grid gap-xs md:grid-cols-2">
                {pick(k, 'valueGoal', o.valueGoals)}
                {pick(k, 'project', o.projects)}
              </div>
            </li>
          );
        })}
      </ul>
      <ChatActions full next="Build my pillars" ready={ready} onNext={() => onSend({ picks: JSON.stringify(v) }, focus.map((k) => `${RELATIONSHIP_BY_KEY[k].name}: ${v[k]?.valueGoal}, ${v[k]?.project}`).join('. '))} />
    </div>
  );
}

/** The pyramids themselves, one per focus pillar, with the words the answers gave them. */
function PyramidsCard({ focus, result, picks }: { focus: RelationshipKey[]; result: OnboardingResponse; picks: LadderPicks }) {
  return (
    <div className="grid gap-sm md:grid-cols-2">
      {focus.map((k) => {
        const l = result.ladders[k];
        const words: Partial<Record<NodeKind, string>> = { pillar: picks[k]?.pillar || l.pillar, principle: l.principle, value_goal: picks[k]?.valueGoal || l.valueGoal, outcome: l.outcome, project: picks[k]?.project || l.project, task: l.tasks[0] ?? 'Your first task' };
        return (
          <div key={k} className="rounded-card bg-card p-md shadow-toy-soft">
            <p className="m-0 flex items-center gap-xs text-[14px] font-bold" style={{ color: `var(--deep-${k})` }}>
              <Avatar relationship={k} size={24} decorative still />
              {RELATIONSHIP_BY_KEY[k].name}
            </p>
            <div className="mt-sm">
              <Pyramid relationship={k} words={words} compact />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NextStepsCard({ order, focus }: { order: { key: RelationshipKey; why: string }[]; focus: RelationshipKey[] }) {
  return (
    <ol className="m-0 flex list-none flex-col gap-xs p-0">
      {order.map((o, i) => (
        <li key={o.key} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
          <span className="w-[24px] shrink-0 text-center font-display text-[16px] font-extrabold text-ink-soft">{i + 1}</span>
          <Avatar relationship={o.key} size={32} decorative still />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold">
              {RELATIONSHIP_BY_KEY[o.key].name}
              {focus.includes(o.key) ? <span className="ml-xs rounded-pill bg-ink px-xs text-[11px] font-extrabold uppercase tracking-wide text-on-ink">month one</span> : null}
            </span>
            <span className="block text-[12px] font-semibold text-ink-soft">{o.why}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// The screen.
// ---------------------------------------------------------------------------

/**
 * The strategy session as one conversation in a few named parts, hosted by Bumling (Lumen hosts the practices, and
 * each focus pillar's questions are asked by its character), each answered in one go on a single card. The map is
 * placed one relationship at a time on one card and the focus is derived from the whole; the chat ends with the vibe check for the focus pillars,
 * their pyramids drawn, and the order to work on all seven.
 */
export function SessionChat() {
  const nav = useNavigate();
  const me = useMe();
  const refresh = useRefreshAll();
  const reduce = useReducedMotion();
  const saved = useAuthed(['session', todayLocal()], () => api.session(todayLocal()));
  // The session is the pillars' own setup: Close goes back to Pillars, to the life map once there is one.
  const closeTo = !me.data?.user.onboardedAt ? '/onboarding' : saved.data?.assessment ? '/tower#life-map' : '/tower';
  const setToken = useSession((st) => st.setToken);

  // The conversation is kept for the tab, per person, so leaving for another screen and coming back
  // picks up on the same line. Start over clears it; what was already saved stays on the server.
  const scope = `session:${me.data?.user.id ?? 'none'}`;
  const [round, setRound] = useState(0);
  const [chat, setChat] = useKept<Chat>(scope, 'chat', () => ({ log: [], stage: { part: 'hello' }, data: EMPTY, ask: null }));
  const [history, setHistory] = useKept<Chat[]>(scope, 'history', []);
  const [typing, setTyping] = useKept<Host | null>(scope, 'typing', null);
  const [notice, setNotice] = useKept<string | null>(scope, 'notice', null);
  const [callOpen, setCallOpen] = useState(false);
  const [multi, setMulti] = useKept<string[]>(scope, 'multi', []);
  const ids = useKeptRef(scope, 'ids', 0);
  const timers = useKeptRef<number[]>(scope, 'timers', []);
  const started = useKeptRef(scope, 'started', false);
  const chatRef = useKeptRef<Chat>(scope, 'chatRef', chat);
  chatRef.current = chat;
  const host: Host = (() => {
    const s = chat.stage;
    if (s.part === 'pillars') return QUESTION_BY_ID[s.id]?.relationship ?? 'bumling';
    if (s.part === 'plan') return s.sub === 'routine' ? 'bumling' : 'divine';
    return 'bumling';
  })();

  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };

  /** The host says a few lines, one after another at a typing pace, then the dock opens with the next ask. */
  const say = useCallback(
    (h: Host, lines: (string | { node: ReactNode })[], next: { stage?: Stage; ask: Ask | null; data?: Partial<Data> }) => {
      clearTimers();
      setChat((c) => ({ ...c, ask: null, ...(next.stage ? { stage: next.stage } : {}), ...(next.data ? { data: { ...c.data, ...next.data } } : {}) }));
      setTyping(h);
      let at = reduce ? 0 : 450;
      lines.forEach((line, i) => {
        at += reduce ? 0 : typingTime(line);
        timers.current.push(
          window.setTimeout(() => {
            const id = (ids.current += 1);
            setChat((c) => ({ ...c, log: [...c.log, typeof line === 'string' ? { id, from: 'bot', host: h, text: line } : { id, from: 'bot', host: h, node: line.node }] }));
            if (i === lines.length - 1) {
              setTyping(null);
              setChat((c) => ({ ...c, ask: next.ask }));
            }
          }, at),
        );
      });
      if (lines.length === 0) {
        setTyping(null);
        setChat((c) => ({ ...c, ask: next.ask }));
      }
    },
    // The scope is part of it: lines written before the account loaded would land in the wrong chat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reduce, scope],
  );

  /** Every answer, tapped or sent from a card, is written into the chat as your line. */
  const you = (label: string) => {
    const id = (ids.current += 1);
    setChat((c) => ({ ...c, log: [...c.log, { id, from: 'you', text: label }], ask: null }));
    setMulti([]);
  };

  // ---- the parts

  /** The first card: the frame in a few lines, then the map straight away. There is no "Let's start" to tap first. */
  const goHello = (greet: string[]) => goMap(greet);
  const submitAccount = (rec: Record<string, string>) => {
    say('bumling', [], { ask: { kind: 'wait', text: 'Making your account' } });
    api
      .signup({ email: rec.email ?? '', password: rec.password ?? '', displayName: rec.name || undefined, phone: rec.phone ?? '', birthDate: rec.birthDate ?? '', acceptTerms: rec.acceptTerms === 'yes' })
      .then(async (r) => {
        setToken(r.token);
        await refresh();
        resumeRef.current(['Your account is made. Everything you tell me from now on is saved to it.']);
      })
      .catch((e) => {
        setNotice(errorText(e, 'That did not work.'));
        say('bumling', ['That did not go through. The note below says why.'], { stage: { part: 'account' }, ask: { kind: 'form', render: (send) => <AccountForm initialName={rec.name ?? ''} onSend={send} /> } });
      });
  };

  const goMap = (greet?: string[]) =>
    say(
      'bumling',
      [
        ...(greet
          ? [...greet, 'This is your strategy session. By the end you will have a map, one or two pillars to focus on, a daily routine and a plan you sign.', 'A good life rests on health, wealth and your seven relationships. Health sits under “Yourself”, and wealth sits under “Servitude”.', { node: <FrameCard /> }]
          : []),
        'Let’s start with your map. It shows how you show up in each relationship, one at a time.',
        'For each one, tick every feeling you know from it, on good days and on bad ones. I work out where you usually are and where you drop under stress.',
        { node: <MapPicture /> },
        'There are no wrong answers. An honest answer helps you more than an impressive one.',
      ],
      { stage: { part: 'map', sub: 'all' }, ask: { kind: 'form', render: (send) => <MapForm initial={chatRef.current.data.placements} initialAway={chatRef.current.data.away} onSend={send} />, more: 'If love, teachers or faith are not part of your life right now, you can set them aside. The feelings come in three groups. Stuck, below Courage: fear, blame or shame are in charge. Owning it: you show up and keep your word. At ease: things flow and you give without keeping score. The key line is Courage. If you drop below it when you are stressed, that relationship is a good place to start. A pillar you set aside sits at Neutrality, “fine either way”, and stays out of your focus until you turn it back on. Made a mistake? Tap “Change my last answer” under any card. If you close the chat, everything you already sent is saved.' } },
    );

  const goWay = (data: Data) => {
    const starts = placedOf(data).filter((p) => placementFlags(p).required).map((p) => p.relationship);
    say('bumling', [starts.length ? belowCourage(starts) : 'Nothing drops below Courage, even under stress. That is a strong start.', 'Still on your map: what gets in your way. Fears show up when you are about to act, and insecurities are what you worry other people notice.', 'Pick any that fit, or add your own words. If nothing fits, just send the card. That is a fine answer.'], { stage: { part: 'way' }, ask: { kind: 'form', render: (send) => <WayForm onSend={send} />, more: 'A fear is like the fear of being judged. For each fear, pick the relationship it holds back, and say how often it decides things for you. For each insecurity, pick how heavy it feels, from a little to very heavy, and the relationship it touches. The heavier it is, the more it pulls that relationship towards your focus.' } });
  };

  const goScorecard = () =>
    say('bumling', ['Now rate how things are going right now, from one star to five. One star means very poor. Five stars means great.', 'There are three groups: your health, your wealth, and your seven relationships. Go with your first feeling.'], { stage: { part: 'scorecard', sub: 'all', checks: [] }, ask: { kind: 'form', render: (send) => <ScoreForm away={chatRef.current.data.away} onSend={send} />, more: 'If a high score does not match your map, I will ask one quick question about last week to check it. Being honest never counts against you.' } });

  const goDay = () =>
    say('bumling', ['Next, tell me about a normal day as it is now, not the day you wish you had.', 'Your routine starts from this day and changes slowly, by half an hour a week. Nobody jumps from waking at 10:30 to waking at 8 on day one.'], { stage: { part: 'day' }, ask: { kind: 'form', render: (send) => <DayForm initial={chatRef.current.data.realDay} onSend={send} /> } });

  const goFocus = (suggested: RelationshipKey[], data: Data) => {
    const placed = placedOf(data);
    const starts = placed.filter((p) => placementFlags(p).required).map((p) => p.relationship);
    say('bumling', ['Here is your map: all seven relationships, from where you drop under stress to where you usually are.', { node: <PlacementChart placements={placed} focus={suggested} away={data.away} /> }, `${starts.length ? `${belowCourage(starts)} ` : ''}After that, I look at your lowest levels and at what weighs on you most. My suggestion: ${listOf(suggested.map(pillar))}.`, ...(data.away.length ? [`${listOf(data.away.map(pillar))} ${data.away.length === 1 ? 'is' : 'are'} set aside, so ${data.away.length === 1 ? 'it is' : 'they are'} not in the list.`] : []), 'Which relationships do you want to work on first? Keep my picks or choose your own, up to two.'], { stage: { part: 'focus' }, ask: { kind: 'multi', chips: RELATIONSHIPS.filter((r) => !data.away.includes(r.key)).map((r) => ({ label: r.name, value: r.key })), min: 1, max: 2, done: 'Work on these', more: 'Two at a time works better than seven at once. The others stay on your map, and you can change your focus later. In the first month, the aim is to stay at Courage or above in your focus relationships, even on hard days.' } });
    setMulti(suggested);
  };

  const goRoutine = (data: Data) =>
    say('bumling', ['Here is your routine. It is built from the day you described, not from a template.', { node: <RoutineCard data={data} /> }, 'The day has six blocks. Only the morning has steps to tick, and a day counts only when every morning step is ticked.', 'For every week you keep it on five days, your wake-up time moves thirty minutes earlier, until it reaches half past six.'], { stage: { part: 'plan', sub: 'routine' }, ask: { kind: 'chips', chips: [{ label: 'Looks right', value: 'ok' }], more: 'An exceptional day is a day you do not control, like travel, a crisis or a late night. Its morning is only twenty minutes, so one bad day does not break your week.' } });

  const goPractices = (data: Data) =>
    say('divine', [`${hello('divine')} Now your morning practices: a mantra to repeat, a breathing exercise, a line to say, and something to read.`, 'Pick one of each on the card below. You can also use a mantra of your own, or none for now.'], { stage: { part: 'plan', sub: 'practices' }, ask: { kind: 'form', render: (send) => <PracticesForm focus={data.focus} onSend={send} />, more: 'Om Namah Shivaya suits the material path: work, money and the body. Hare Krishna suits the spiritual path: practice, surrender and meaning. Neither one is a test of belief, and words of your own work just as well.' } });

  const goContract = () =>
    say('bumling', ['The last step of the plan is the contract. Signing it turns this plan into a promise to yourself.', 'Choose how many days a week you will keep the routine, when you want your daily check-in, and what happens if you miss. Then type your name to sign.'], { stage: { part: 'contract' }, ask: { kind: 'form', render: (send) => <ContractForm initial={chatRef.current.data.contract} placeholder={me.data?.user.displayName || 'Your name'} onSend={send} />, more: 'The contract is counted by the week. If you keep the routine on fewer days than you chose, the penalty you picked applies. A weekly check comes every Sunday, and a monthly review in thirty days.' } });

  const goPillars = (data: Data, lead: string[] = []) => {
    const first = data.focus[0];
    if (!first) return goSteps(data);
    say('bumling', [...lead, 'Last part: your pillars. Each relationship you chose gets its own pyramid: a foundation, a guiding principle, a value goal, a goal outcome, a project and a first task.', 'Answer three quick questions for each one, and the pyramid is built from your answers.', `${who(first)}, ${RELATIONSHIP_BY_KEY[first].role}, asks first.`], { stage: { part: 'pillars', id: firstQuestionId(first), history: [] }, ask: null });
    timers.current.push(window.setTimeout(() => askQuestion(firstQuestionId(first), [], true), reduce ? 0 : 1100));
  };

  const askQuestion = (id: string, history: string[], intro: boolean) => {
    const q = QUESTION_BY_ID[id];
    if (!q) return goSteps(chatRef.current.data);
    const r = RELATIONSHIP_BY_KEY[q.relationship];
    // A pick question can always be answered in your own words; a scale stays a scale.
    const chips: Chip[] = q.format === 'pick' && q.options ? [...q.options.map((o, i) => ({ label: o.label, value: String(i) })), { label: 'Write my own', value: 'own', icon: 'PenLine' }] : q.format === 'scale' && q.scale ? q.scale.labels.map((l, i) => ({ label: l, value: String(i) })) : [{ label: 'Yes', value: '1' }, { label: 'Not yet', value: '0' }];
    const lead = intro ? [r.greeting] : [];
    const foundation = q.role === 'foundation' ? ['This one becomes the foundation of my pyramid, its first layer. The rest is built from it.'] : [];
    say(q.relationship, [...lead, ...foundation, q.prompt], { stage: { part: 'pillars', id, history }, ask: { kind: 'chips', chips } });
  };

  /** Your own words for a pick question: a foundation in your words, or an answer of your own. */
  const askOwn = (q: Question, history: string[]) =>
    say(q.relationship, [q.role === 'foundation' ? 'Write the foundation in your own words: the one thing you will not let break in this relationship. Keep it short, like the choices above.' : 'Say it in your own words. A short line is plenty.'], { stage: { part: 'pillars', id: q.id, history, own: true }, ask: { kind: 'form', render: (send) => <OwnAnswerCard foundation={q.role === 'foundation'} onSend={send} /> } });

  const goSteps = (data: Data) => {
    if (!data.result) return goDone(data);
    say('bumling', ['Here is what your answers built. For each pillar, pick a value goal (how you want to feel) and a project (what you will work on), or write your own.'], { stage: { part: 'steps' }, ask: { kind: 'form', render: (send) => <PicksForm focus={data.focus} result={data.result!} own={data.picks} onSend={send} />, more: 'The value goal is how you want to feel more often. The project is a few weeks of small tasks. Your first task shows up on Daily tomorrow.' } });
  };

  const goDone = (data: Data) => {
    const order = priorityOrder(placedOf(data), data.insecurities, data.away);
    const lines: (string | { node: ReactNode })[] = ['Your pillars are ready. Each one is a pyramid: the foundation at the top, down to your first task at the point.'];
    if (data.result) lines.push({ node: <PyramidsCard focus={data.focus} result={data.result} picks={data.picks} /> });
    lines.push(`Here is the order to work through all seven. Start with ${listOf(data.focus.map(pillar))} this month. When those hold at Courage, move on to the next one on the list.`, { node: <NextStepsCard order={order} focus={data.focus} /> }, ...(data.away.length ? [`${listOf(data.away.map(pillar))} ${data.away.length === 1 ? 'is' : 'are'} set aside, so ${data.away.length === 1 ? 'it stays' : 'they stay'} out of the list. Turn ${data.away.length === 1 ? 'it' : 'them'} back on from your life map whenever you like.`] : []), 'From tomorrow, tick your morning routine on Daily. On Sunday night, take five minutes for the weekly check. In thirty days you will do a review. Everything from this session is saved at the bottom of Pillars, as your life map.', 'What would you like to do now? You can open your pillars, or add your interests so people with the same interests can find you.');
    say('bumling', lines, { stage: { part: 'done' }, ask: { kind: 'chips', chips: DONE_CHIPS } });
  };

  const goProfile = () =>
    say('bumling', ['Pick what you are into, up to ten, and add your city. People with the same interests can then find you, for example in Circles.', 'You can add a short line about yourself too. All of it shows on your profile, and you can change it there anytime.'], { stage: { part: 'done' }, ask: { kind: 'form', render: (send) => <ProfileCard full onSend={send} /> } });

  const saveProfile = (rec: Record<string, string>) => {
    say('bumling', [], { ask: { kind: 'wait', text: 'Saving your profile' } });
    let interests: string[] = [];
    try {
      interests = JSON.parse(rec.interests ?? '[]') as string[];
    } catch {
      interests = [];
    }
    api
      .updateMe({ interests, city: rec.city ?? '', bio: rec.bio ?? '' })
      .then(async () => {
        await refresh();
        say('bumling', ['Saved to your profile! 🎉', 'Ready to see your pillars?'], { stage: { part: 'done' }, ask: { kind: 'chips', chips: DONE_CHIPS.filter((c) => c.value !== 'profile') } });
      })
      .catch((e) => {
        setNotice(errorText(e, 'That did not work.'));
        goProfile();
      });
  };

  // ---- server calls

  const submitAssessment = (data: Data) => {
    say('bumling', [], { ask: { kind: 'wait', text: 'Bumling is working out your focus' } });
    api
      .submitAssessment({ placements: placedOf(data), away: data.away, fears: data.fears, insecurities: data.insecurities, scores: data.scores, behaviour: data.behaviour, realDay: data.realDay })
      .then((r) => goFocus(r.suggestedFocus, data))
      .catch((e) => {
        setNotice(errorText(e, 'That did not work.'));
        goDay();
      });
  };

  const submitPlan = (data: Data, call: boolean) => {
    say('bumling', [], { ask: { kind: 'wait', text: 'Filing the contract' } });
    api
      .submitPlan({ focus: data.focus, practices: { ...data.practices, affirmation: data.practices.affirmation || affirmationFor(data.focus) }, contract: data.contract, date: todayLocal() })
      .then(async () => {
        await refresh();
        if (call) setCallOpen(true);
        goPillars(data, ['Signed! Your plan is saved, and Daily will show your routine from tomorrow morning.', ...(call ? ['I opened the details for a live call. Read them when you like; the chat waits here.'] : [])]);
      })
      .catch((e) => {
        setNotice(errorText(e, 'That did not work.'));
        goContract();
      });
  };

  const submitVibe = (data: Data) => {
    say('bumling', [], { ask: { kind: 'wait', text: 'Working out your pyramids' } });
    api
      .onboard({ answers: Object.entries(data.answers).map(([questionId, value]) => ({ questionId, value })), displayName: me.data?.user.displayName })
      .then((result) => {
        const next = { ...data, result };
        setChat((c) => ({ ...c, data: { ...c.data, result } }));
        goSteps(next);
      })
      .catch((e) => {
        setNotice(errorText(e, 'That did not work.'));
        goPillars(data);
      });
  };

  const submitBuild = (data: Data) => {
    say('bumling', [], { ask: { kind: 'wait', text: 'Building your pillars' } });
    api
      .build(data.focus, todayLocal(), data.picks)
      .then(async () => {
        await refresh();
        goDone(data);
      })
      .catch((e) => {
        setNotice(errorText(e, 'That did not work.'));
        goSteps(data);
      });
  };

  // ---- one answer, routed by the stage

  const answer = (value: string | string[] | Record<string, string>, label: string) => {
    const c = chatRef.current;
    setHistory((h) => [...h.slice(-30), c]);
    you(label);
    setNotice(null);
    const s = c.stage;
    const d = c.data;
    const str = typeof value === 'string' ? value : '';
    const list = Array.isArray(value) ? value : [];
    const rec = !Array.isArray(value) && typeof value === 'object' ? value : {};
    const keep = (data: Data) => setChat((x) => ({ ...x, data }));

    if (s.part === 'account') return submitAccount(rec);

    if (s.part === 'hello') {
      if (str === 'keep') return goFocus(d.focus.length ? d.focus.filter((k) => !d.away.includes(k)) : pickFocus(placedOf(d), d.insecurities, d.away), d);
      if (str === 'pillars') return goPillars(d);
      return goMap();
    }

    if (s.part === 'map') {
      if (s.sub === 'all') {
        let away: RelationshipKey[] = [];
        try {
          away = (JSON.parse(rec.away ?? '[]') as RelationshipKey[]).filter(isOptionalPillar);
        } catch {
          away = [];
        }
        const placements = Object.fromEntries(RELATIONSHIPS.map((r) => [r.key, away.includes(r.key) ? awayPlacement(r.key) : { relationship: r.key, core: Number(rec[`${r.key}.core`]), floor: Number(rec[`${r.key}.floor`]), evidence: d.placements[r.key]?.evidence ?? '' }])) as Record<RelationshipKey, Placement>;
        const data = { ...d, placements, away };
        keep(data);
        const high = RELATIONSHIPS.filter((r) => placements[r.key].core >= 400).map((r) => r.key);
        if (high.length) return say('bumling', [`You placed ${listOf(high.map(pillar))} at Inner light or higher. That is great.`, 'To keep the map honest, write one thing you did last week that shows it. If you leave it empty, I will hold that relationship at Acceptance for now.'], { stage: { part: 'map', sub: 'evidence' }, ask: { kind: 'form', render: (send) => <EvidenceForm keys={high} onSend={send} />, more: 'Without something that shows it, the map holds that pillar at Acceptance. Not a punishment: the plan is built from where you act, not where you hope.' } });
        return goWay(data);
      }
      const placements = { ...d.placements };
      for (const [k, text] of Object.entries(rec)) if (placements[k as RelationshipKey]) placements[k as RelationshipKey] = { ...placements[k as RelationshipKey]!, evidence: text.trim() };
      const data = { ...d, placements };
      keep(data);
      return goWay(data);
    }

    if (s.part === 'way') {
      const parse = <T,>(v: string | undefined, fb: T): T => {
        try {
          return v ? (JSON.parse(v) as T) : fb;
        } catch {
          return fb;
        }
      };
      const data = { ...d, fears: parse<Fear[]>(rec.fears, []).slice(0, MAX_FEARS), insecurities: parse<Insecurity[]>(rec.insecurities, []).slice(0, MAX_INSECURITIES) };
      keep(data);
      return goScorecard();
    }

    if (s.part === 'scorecard') {
      if (s.sub === 'behaviour') {
        const [k, ...rest] = s.checks;
        const data = { ...d, behaviour: { ...d.behaviour, [k!]: Number(str) } };
        keep(data);
        if (rest.length) return say('bumling', [`And for ${pillar(rest[0]!)}: in the last seven days, on how many days did you act with courage there, instead of avoiding it?`], { stage: { part: 'scorecard', sub: 'behaviour', checks: rest }, ask: { kind: 'chips', chips: [0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({ label: `${n}`, value: String(n) })) } });
        return goDay();
      }
      const scores: Scores = Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, Number(v)]));
      const data = { ...d, scores };
      keep(data);
      const checks = RELATIONSHIPS.filter((r) => (scores[r.key] ?? 5) >= 8 && d.placements[r.key] && placementFlags(d.placements[r.key]!).floor < COURAGE).map((r) => r.key);
      if (checks.length) return say('bumling', [`One quick check. You gave ${pillar(checks[0]!)} four stars or more, but on your map it drops below Courage under stress.`, 'In the last seven days, on how many days did you act with courage there, instead of avoiding it? Tap a number.'], { stage: { part: 'scorecard', sub: 'behaviour', checks }, ask: { kind: 'chips', chips: [0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({ label: `${n}`, value: String(n) })), more: 'What you did counts more than how it feels. If you acted with courage on fewer than four of the seven days, I count that score as three stars for now.' } });
      return goDay();
    }

    if (s.part === 'day') {
      const realDay: RealDay = { wake: rec.wake ?? d.realDay.wake, sleep: rec.sleep ?? d.realDay.sleep, workStart: rec.workStart ?? d.realDay.workStart, workEnd: rec.workEnd ?? d.realDay.workEnd, gym: rec.gym ?? '', evening: rec.evening ?? '' };
      const data = { ...d, realDay };
      keep(data);
      return submitAssessment(data);
    }

    if (s.part === 'focus') {
      const data = { ...d, focus: list as RelationshipKey[] };
      keep(data);
      return goRoutine(data);
    }

    if (s.part === 'plan') {
      if (s.sub === 'routine') return goPractices(d);
      const mantra = (rec.mantra as Practices['mantra']) ?? 'none';
      const ownMantra = (rec.ownMantra ?? '').trim();
      const practices: Practices = { mantra: mantra === 'own' && !ownMantra ? 'none' : mantra, ...(mantra === 'own' && ownMantra ? { ownMantra } : {}), breathing: (rec.breathing as Practices['breathing']) ?? 'box', affirmation: (rec.affirmation ?? '').trim(), reading: (rec.reading ?? '').trim() };
      const data = { ...d, practices };
      keep(data);
      return goContract();
    }

    if (s.part === 'contract') {
      const data = { ...d, contract: { minDays: Number(rec.minDays ?? CONTRACT_MIN_DAYS_DEFAULT), checkinTime: rec.checkinTime ?? d.contract.checkinTime, penalty: (rec.penalty as Contract['penalty']) ?? 'streak', signedName: (rec.signedName ?? '').trim() } };
      keep(data);
      return submitPlan(data, rec.call === 'yes');
    }

    if (s.part === 'pillars') {
      const q = QUESTION_BY_ID[s.id]!;
      if (str === 'own') return askOwn(q, s.history);
      if (s.own && rec.back) return askQuestion(q.id, s.history, false);
      const words = s.own ? (rec.text ?? '').trim() : '';
      // Your own words count as the first foundation, whose words they replace, or as a middle answer to a question.
      const v = s.own ? (q.role === 'foundation' ? 0 : ownValue(q)) : Number(str);
      const picks: LadderPicks = words && q.role === 'foundation' ? { ...d.picks, [q.relationship]: { ...d.picks[q.relationship], pillar: words } } : d.picks;
      const data = { ...d, answers: { ...d.answers, [q.id]: v }, picks };
      keep(data);
      const nextId =
        nextQuestionId(q, v) ??
        (() => {
          const k = d.focus[d.focus.indexOf(q.relationship) + 1];
          return k ? firstQuestionId(k) : null;
        })();
      if (nextId) {
        const nq = QUESTION_BY_ID[nextId]!;
        return askQuestion(nextId, [...s.history, q.id], nq.relationship !== q.relationship);
      }
      return submitVibe(data);
    }

    if (s.part === 'steps') {
      let picks: LadderPicks = {};
      try {
        picks = rec.picks ? (JSON.parse(rec.picks) as LadderPicks) : {};
      } catch {
        picks = {};
      }
      // The foundation in your own words, from the pillars part, stays with the picks.
      const merged: LadderPicks = Object.fromEntries(d.focus.map((k) => [k, { ...d.picks[k], ...picks[k] }]));
      const data = { ...d, picks: merged };
      keep(data);
      return submitBuild(data);
    }

    if (s.part === 'done') {
      if (str === 'profile') return goProfile();
      if (rec.skip) return say('bumling', ['No problem. You can add your interests anytime in Profile.'], { stage: { part: 'done' }, ask: { kind: 'chips', chips: DONE_CHIPS.filter((c) => c.value !== 'profile') } });
      if (rec.interests !== undefined) return saveProfile(rec);
      nav('/tower', { replace: true });
    }
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    clearTimers();
    setTyping(null);
    setHistory((h) => h.slice(0, -1));
    setChat(prev);
    setMulti([]);
  };

  const tellMore = (more: string) => {
    const id = (ids.current += 1);
    setChat((c) => ({ ...c, log: [...c.log, { id, from: 'bot', host, text: more }], ask: c.ask && 'more' in c.ask ? { ...c.ask, more: undefined } : c.ask }));
  };

  // ---- start, and resume from what the server holds. An account without an email makes one first.
  const resume = (greet: string[]) => {
    const sd = saved.data;
    const u = me.data?.user;
    if (!sd || !u) return;
    const a = sd.assessment;
    if (a) {
      const data: Data = {
        ...EMPTY,
        placements: Object.fromEntries(a.placements.map((p) => [p.relationship, { relationship: p.relationship, core: p.core, floor: p.floor, evidence: p.evidence }])),
        away: a.away ?? [],
        fears: a.fears,
        insecurities: a.insecurities,
        scores: a.scores,
        realDay: a.realDay,
        focus: a.focus,
        practices: sd.routine?.practices ?? EMPTY.practices,
        contract: sd.contract ? { minDays: sd.contract.minDays, checkinTime: sd.contract.checkinTime, penalty: sd.contract.penalty, signedName: sd.contract.signedName } : EMPTY.contract,
      };
      setChat((c) => ({ ...c, data }));
      // Where it stopped, from what the server holds: a contract without the focus pyramids means the vibe
      // check is next; no contract yet means the focus is.
      const built = a.focus.length > 0 && a.focus.every((k) => (me.data?.relationships.find((r) => r.key === k)?.pillars ?? 0) > 0);
      // The next step comes first, and placing all seven again is always there.
      const again = { label: 'Place me again', value: 'again' };
      if (sd.contract && !built) {
        say('bumling', [...greet, `${hello('bumling')} Your plan is signed. The last step is building the pyramids for ${listOf(a.focus.map(pillar))}.`], { stage: { part: 'hello' }, ask: { kind: 'chips', chips: [{ label: 'Build my pillars', value: 'pillars' }, again] } });
        return;
      }
      if (!sd.contract) {
        say('bumling', [...greet, `${hello('bumling')} Welcome back! Your map is saved. You can carry on from the focus step, or place all seven again.`], { stage: { part: 'hello' }, ask: { kind: 'chips', chips: [{ label: 'Keep my map, go to the focus', value: 'keep' }, again] } });
        return;
      }
      say('bumling', [...greet, `${hello('bumling')} You have done this session before. You can keep your map and go straight to the focus, or place all seven again.`], { stage: { part: 'hello' }, ask: { kind: 'chips', chips: [{ label: 'Keep my map, go to the focus', value: 'keep' }, again] } });
      return;
    }
    goHello([...greet, hello('bumling')]);
  };
  const resumeRef = useKeptRef(scope, 'resume', resume);
  resumeRef.current = resume;

  /** A fresh conversation. Answers already saved stay saved, so it resumes from them. */
  const startOver = () => {
    forgetKept(scope);
    setRound((r) => r + 1);
  };

  useEffect(() => {
    if (started.current || !saved.data || !me.data) return;
    started.current = true;
    const first = me.data.user.displayName ? `Hi ${me.data.user.displayName}.` : 'Hi.';
    if (!me.data.user.email) {
      // A device session, from Welcome or from inside the app: the account is the first card, so nothing is lost.
      say('bumling', [`${first} ${hello('bumling')}`, 'Before we start, let’s make your account, so everything you tell me is saved. Fill in the card below. Your phone number and date of birth are never shown to anyone.'], { stage: { part: 'account' }, ask: { kind: 'form', render: (send) => <AccountForm initialName={me.data?.user.displayName ?? ''} onSend={send} />, more: 'You need to be 18 or older to join. Your password needs eight or more letters, numbers or signs, and it cannot be your email or a common one. You can change your phone number later in Profile, but not your date of birth.' } });
      return;
    }
    resume([first]);
  }, [saved.data, me.data, say, reduce, round]);

  // Arriving with ?fresh (Run the session again) always starts a new conversation.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (!params.has('fresh') || !me.data) return;
    setParams({}, { replace: true });
    startOver();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, me.data]);

  // ---- a question typed at any point gets a plain answer, and the card waits under it.
  const askAbout = (text: string) => {
    const c = chatRef.current;
    const id = (ids.current += 1);
    setChat((x) => ({ ...x, log: [...x.log, { id, from: 'you', text }] }));
    const lines = explainTyped(text);
    say(host, lines.length ? [...lines, 'Anything else? If not, carry on below.'] : ['I can explain any word you see here, like core, floor, Courage or any of the seven. To answer, use the card below.'], { ask: c.ask });
  };

  // ---- what shows under the last lines: the choices or the card, then the small links.
  const part = PARTS.indexOf(PART_OF[chat.stage.part]);
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
        <ChoiceChips choices={ask.chips} onPick={(c) => answer(c.value, c.label)} full />
      ) : ask.kind === 'multi' ? (
        <ChoiceGroups
          groups={[{ choices: ask.chips }]}
          picked={multi}
          onPicked={setMulti}
          min={ask.min}
          max={ask.max}
          done={ask.done}
          onDone={(v, l) => answer(v, l.length ? l.join(' and ') : 'None')}
          full
        />
      ) : (
        ask.render((v, label) => answer(v, label))
      );
    const links = [...(ask.more ? [{ label: 'Tell me more', onClick: () => tellMore(ask.more!) }] : []), ...(history.length > 0 ? [{ label: 'Change my last answer', onClick: undo }] : [])];
    return (
      <>
        {body}
        <ChatLinks items={links} />
      </>
    );
  })();

  return (
    <>
      <ChatScreen
        title="Strategy session"
        step={PART_NAME[PART_OF[chat.stage.part]]}
        progress={(part + 1) / PARTS.length}
        closeTo={closeTo}
        onStartOver={startOver}
        log={chat.log}
        typing={typing}
        answer={answerNode}
        answerKey={`${chat.stage.part}:${chat.log.filter((m) => m.from === 'you').length}`}
        notice={notice}
        composer={{ placeholder: 'Ask about any word', onSend: askAbout, disabled: Boolean(typing) || chat.stage.part === 'account' }}
      />
      <Sheet open={callOpen} onClose={() => setCallOpen(false)} title="Book a live call">
        <p className="m-0 text-[16px] font-semibold text-ink-soft">A live strategy call with the coach is {money(LIVE_CALL_CENTS, PLAN_CURRENCY)}. Booking opens once payments are connected. Until then, write to the team under Help and we will set a time by hand.</p>
        <Link to="/help" className="toy mt-md inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md text-[16px] font-bold text-on-ink">
          Write to the team
        </Link>
      </Sheet>
    </>
  );
}
