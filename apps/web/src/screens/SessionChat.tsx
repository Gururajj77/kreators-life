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
  pickFocus,
  placementFlags,
  QUESTION_BY_ID,
  RELATIONSHIP_BY_KEY,
  RELATIONSHIPS,
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
  type Question,
  characterHello,
} from '@kreators/shared';
import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AccountForm } from '../components/AccountForm';
import { ProfileCard } from '../components/ProfileCard';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { ConsciousnessMap, PlacementChart } from '../components/LifeMap';
import { Pyramid } from '../components/Pyramid';
import { Sheet } from '../components/Sheet';
import { ChatActions, ChatLinks, ChatScreen, ChoiceChips, ChoiceGroups, typingTime } from '../components/Chat';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useAuthed, useMe, useRefreshAll } from '../lib/queries';
import { useSession } from '../lib/store';
import { explainTyped } from '../lib/explain';
import { forgetKept, useKept, useKeptRef } from '../lib/kept';

// ---------------------------------------------------------------------------
// The hosts. Each part is run by one of the seven, in that character's own voice: Dew calm and clear, Ember
// direct, Pip warm and playful, Sunny caring and practical, Lumen quiet, Sage the mentor who sees the whole.
// ---------------------------------------------------------------------------


const PARTS = ['account', 'hello', 'map', 'way', 'scorecard', 'day', 'focus', 'plan', 'contract', 'call', 'pillars', 'steps', 'done'] as const;
type Part = (typeof PARTS)[number];
const PART_NAME: Record<Part, string> = {
  account: 'Your account',
  hello: 'The frame',
  map: 'The map',
  way: 'What gets in the way',
  scorecard: 'Scorecard',
  day: 'Your real day',
  focus: 'Your focus',
  plan: 'Routine and practices',
  contract: 'The contract',
  call: 'A live call',
  pillars: 'Your pillars',
  steps: 'First steps',
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
type Chip = { label: string; value: string; emoji?: string; blurb?: string };
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
  | { part: 'call' }
  | { part: 'pillars'; id: string; history: string[]; own?: boolean }
  | { part: 'steps' }
  | { part: 'done' };

interface Data {
  placements: Partial<Record<RelationshipKey, Placement>>;
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

const err = (e: unknown) => (e instanceof Error ? e.message : 'That did not work.');
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
const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const pill = (on: boolean) => `min-h-[44px] rounded-pill border-2 px-sm text-[14px] font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`;
const card = (on: boolean) => `toy toy-flat w-full rounded-tile border-2 p-sm text-left ${on ? 'border-ink bg-card' : 'border-line bg-card'}`;
const levelName = (v: number | undefined) => (v === undefined ? '' : (levelByValue(v)?.name ?? ''));

/** The seven in order of what to work on: floors under Courage first (lowest first), then the lowest cores weighted by what weighs there. */
function priorityOrder(placements: Placement[], insecurities: Insecurity[]): { key: RelationshipKey; why: string }[] {
  const weight = (k: RelationshipKey) => insecurities.filter((i) => i.relationship === k).reduce((a, i) => a + i.weight, 0);
  const rows = placements.map((p) => ({ key: p.relationship, f: placementFlags(p), w: weight(p.relationship) }));
  const required = rows.filter((r) => r.f.required).sort((a, b) => a.f.floor - b.f.floor);
  const rest = rows.filter((r) => !r.f.required).sort((a, b) => a.f.core - a.w * 10 - (b.f.core - b.w * 10));
  return [
    ...required.map((r) => ({ key: r.key, why: `drops to ${levelName(r.f.floor)} under stress, below Courage. A good place to start.` })),
    ...rest.map((r) => ({ key: r.key, why: `${r.f.volatile ? 'a big drop under stress, check it weekly' : `lives at ${levelName(r.f.core)}`}${r.w ? ', and something you named weighs here' : ''}.` })),
  ];
}

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
            <span className="block text-[14px] font-semibold text-ink-soft">{r.key === 'self' ? 'Body, health, mind.' : r.key === 'servant_leader' ? 'Work, money, time.' : r.question}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** An answer of your own: a short line, or back to the choices. */
function OwnAnswerCard({ foundation, onSend }: { foundation: boolean; onSend: Send }) {
  const [text, setText] = useState('');
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <label className="block">
        <span className="block text-[14px] font-bold">{foundation ? 'Your foundation' : 'Your answer'}</span>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={120} placeholder={foundation ? 'Like: Sunday lunch with family, every week' : 'In a few words'} className={field} />
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

/** All seven placed in one go: for each, where you usually live and where you drop, the levels grouped by band. */
function MapForm({ initial, onSend }: { initial: Partial<Record<RelationshipKey, Placement>>; onSend: Send }) {
  const [v, setV] = useState<Partial<Record<RelationshipKey, { core?: number; floor?: number }>>>(Object.fromEntries(Object.entries(initial).map(([k, p]) => [k, { core: p?.core, floor: p?.floor }])));
  const ready = RELATIONSHIPS.every((r) => v[r.key]?.core !== undefined && v[r.key]?.floor !== undefined);
  const set = (k: RelationshipKey, which: 'core' | 'floor', value: string) => setV((x) => ({ ...x, [k]: { ...x[k], [which]: value === '' ? undefined : Number(value) } }));
  const select = (k: RelationshipKey, which: 'core' | 'floor') => (
    <label className="block">
      <span className="block text-[12px] font-bold text-ink-soft">{which === 'core' ? 'Where you usually live' : 'Where you drop under stress'}</span>
      <select value={v[k]?.[which] ?? ''} onChange={(e) => set(k, which, e.target.value)} className={field}>
        <option value="">Pick a level</option>
        {/* Top down, like the map: At ease first, Shame last. */}
        {[...MAP_BANDS].reverse().map((b) => (
          <optgroup key={b} label={`${MAP_BAND_META[b].name}: ${BAND_STATEMENTS[k][b]}`}>
            {MAP_LEVELS.filter((l) => l.band === b)
              .reverse()
              .map((l) => (
                <option key={l.value} value={l.value}>
                  {l.name}. {l.sounds}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
  return (
    <div>
      <ul className="m-0 flex list-none flex-col gap-xs p-0">
        {RELATIONSHIPS.map((r) => (
          <li key={r.key} className="rounded-tile bg-card p-sm shadow-toy-soft">
            <div className="flex items-center gap-sm">
              <Avatar relationship={r.key} size={40} decorative still />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold">{r.name}</span>
                <span className="block text-[14px] font-semibold text-ink-soft">{r.key === 'self' ? 'Body, health and mind sit here.' : r.key === 'servant_leader' ? 'Work, money and time sit here.' : r.question}</span>
              </span>
            </div>
            <div className="mt-xs grid gap-xs md:grid-cols-2">
              {select(r.key, 'core')}
              {select(r.key, 'floor')}
            </div>
          </li>
        ))}
      </ul>
      <ChatActions full next="That is my map" ready={ready} onNext={() => onSend(Object.fromEntries(RELATIONSHIPS.flatMap((r) => [[`${r.key}.core`, String(v[r.key]!.core)], [`${r.key}.floor`, String(v[r.key]!.floor)]])), RELATIONSHIPS.map((r) => `${r.name}: ${levelName(v[r.key]?.floor)} to ${levelName(v[r.key]?.core)}`).join('. '))} />
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
              <textarea value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} rows={2} maxLength={500} placeholder="What you did, not what you believe" className={field} />
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
      <select value={value} onChange={(e) => onChange(e.target.value as RelationshipKey)} className={field}>
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
          <button key={f} type="button" aria-pressed={has(f)} className={pill(has(f))} onClick={() => toggle(f)}>
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
                  <select value={f.drives} onChange={(e) => setFears(fears.map((x, j) => (j === i ? { ...x, drives: e.target.value as Drives } : x)))} className={field}>
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
                      <button key={w.weight} type="button" aria-pressed={weightWord(it.weight) === w.name} className={pill(weightWord(it.weight) === w.name)} onClick={() => setIns(ins.map((x, j) => (j === i ? { ...x, weight: w.weight } : x)))}>
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
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}: ${STAR_WORDS[n - 1]}`} onClick={() => onChange(n)} className="toy toy-flat flex size-[40px] items-center justify-center rounded-pill">
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            <path d="M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17.1 6.4 20l1.1-6.2-4.6-4.4 6.3-.9z" strokeWidth="1.6" strokeLinejoin="round" style={n <= value ? { fill: color, stroke: color } : { fill: 'none', stroke: 'var(--color-ink-mute)' }} />
          </svg>
        </button>
      ))}
    </div>
  );
}

function ScoreForm({ onSend }: { onSend: Send }) {
  const keys = [...SCORECARD.health, ...SCORECARD.wealth, ...RELATIONSHIPS.map((r) => r.key)];
  const labels: Record<string, string> = { ...SCORE_LABEL, ...Object.fromEntries(RELATIONSHIPS.map((r) => [r.key, r.name])) };
  // Stars, one to five; three to start.
  const [v, setV] = useState<Record<string, number>>(Object.fromEntries(keys.map((k) => [k, 3])));
  const group = (title: string, ks: readonly string[], color: string) => (
    <div>
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
      {group('Health', SCORECARD.health, 'var(--deep-self)')}
      {group('Wealth', SCORECARD.wealth, 'var(--deep-servant_leader)')}
      {group('The seven', RELATIONSHIPS.map((r) => r.key), 'var(--deep-friendship)')}
      <ChatActions full next="Those are my stars" onNext={() => onSend(Object.fromEntries(keys.map((k) => [k, String(scoreOfStars(v[k] ?? 3))])), `Health ${avg(SCORECARD.health)} stars, wealth ${avg(SCORECARD.wealth)} stars, the seven ${avg(RELATIONSHIPS.map((r) => r.key))} stars on average`)} />
    </div>
  );
}

function DayForm({ initial, onSend }: { initial: RealDay; onSend: Send }) {
  const [d, setD] = useState<RealDay>(initial);
  const t = (key: keyof RealDay, label: string) => (
    <label key={key} className="block">
      <span className="block text-[14px] font-bold">{label}</span>
      <input type="time" value={d[key]} onChange={(e) => setD({ ...d, [key]: e.target.value })} className={field} />
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
          <input type="time" value={d.gym} onChange={(e) => setD({ ...d, gym: e.target.value })} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">The last hour before sleep is usually</span>
          <input value={d.evening} onChange={(e) => setD({ ...d, evening: e.target.value })} maxLength={200} placeholder="Scrolling, a show, work mail" className={field} />
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
          <button key={d} type="button" className={pill(dayType === d)} onClick={() => setDayType(d)}>
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
          <input value={p.ownMantra ?? ''} onChange={(e) => setP({ ...p, ownMantra: e.target.value })} maxLength={OWN_MANTRA_MAX} placeholder="The words you want to repeat" className={field} />
        </label>
      )}
      <p className="mt-md m-0 text-[14px] font-bold">Breathing, three rounds</p>
      <div className="mt-xs flex flex-wrap gap-xs">
        {BREATHING.map((b) => (
          <button key={b.key} type="button" aria-pressed={p.breathing === b.key} className={pill(p.breathing === b.key)} onClick={() => setP({ ...p, breathing: b.key })} title={b.blurb}>
            {b.name}
          </button>
        ))}
      </div>
      <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{BREATHING.find((b) => b.key === p.breathing)?.blurb}</p>
      <label className="mt-md block">
        <span className="block text-[14px] font-bold">Your line, on waking and before sleep</span>
        <textarea value={p.affirmation} onChange={(e) => setP({ ...p, affirmation: e.target.value })} rows={2} maxLength={240} className={field} />
      </label>
      <label className="mt-xs block">
        <span className="block text-[14px] font-bold">One page a morning, from</span>
        <input value={p.reading} onChange={(e) => setP({ ...p, reading: e.target.value })} maxLength={120} placeholder="A book, a scripture, a long essay" className={field} />
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
  return (
    <div>
      <p className="m-0 text-[14px] font-bold">Days a week, at least</p>
      <div className="mt-xs flex flex-wrap gap-xs">
        {[3, 4, 5, 6, 7].map((n) => (
          <button key={n} type="button" aria-pressed={c.minDays === n} className={pill(c.minDays === n)} onClick={() => setC({ ...c, minDays: n })}>
            {n}
          </button>
        ))}
      </div>
      <label className="mt-md block">
        <span className="block text-[14px] font-bold">Daily check-in time</span>
        <input type="time" value={c.checkinTime} onChange={(e) => setC({ ...c, checkinTime: e.target.value })} className={field} />
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
        <input value={c.signedName} onChange={(e) => setC({ ...c, signedName: e.target.value })} maxLength={80} placeholder={placeholder} className={field} />
      </label>
      <ChatActions full next="Sign it" ready={Boolean(c.signedName.trim())} onNext={() => onSend({ minDays: String(c.minDays), checkinTime: c.checkinTime, penalty: c.penalty, signedName: c.signedName.trim() }, `${c.minDays} days a week, check-in at ${c.checkinTime}, ${PENALTIES.find((p) => p.key === c.penalty)?.name.toLowerCase()}. Signed ${c.signedName.trim()}.`)} />
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
        <select value={isOwn ? '__own' : cur} onChange={(e) => { if (e.target.value === '__own') { setOwn({ ...own, [`${k}.${f}`]: true }); setV({ ...v, [k]: { ...v[k], [f]: '' } }); } else { setOwn({ ...own, [`${k}.${f}`]: false }); setV({ ...v, [k]: { ...v[k], [f]: e.target.value } }); } }} className={field}>
          {list.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value="__own">Write my own</option>
        </select>
        {isOwn && <input value={cur} onChange={(e) => setV({ ...v, [k]: { ...v[k], [f]: e.target.value } })} maxLength={120} placeholder="Your words" className={field} />}
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
            <li key={k} className="rounded-card p-md" style={{ background: `var(--soft-${k})` }}>
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
 * The strategy session as one conversation: twelve parts, each hosted by one of the seven characters, each
 * answered in one go on a single card drawn the way the card flow drew it. The map is placed for all seven
 * at once and the focus is derived from the whole; the chat ends with the vibe check for the focus pillars,
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

  const goHello = (greet: string[]) =>
    say(
      'bumling',
      [...greet, 'This is your strategy session. It sets up your pillars: the seven relationships the app is built around.', 'Each step is one card. Fill it in and send it, and I will take you to the next one. By the end you will have a map of where you are, one or two pillars to focus on, a daily routine and a plan you sign.', 'First, the big picture. A good life rests on three things: your health, your wealth and your relationships. Health means your body and your mind. Wealth means your money and your time. Here are the seven relationships. Health is part of “With yourself”, and work and money are part of “Servant leader”.', { node: <FrameCard /> }, 'There are no wrong answers. An honest answer helps you more than an impressive one.'],
      { stage: { part: 'hello' }, ask: { kind: 'chips', chips: [{ label: "Let's start", value: 'go' }], more: 'There are twelve steps: the map, what gets in your way, your scores, your normal day, your focus, your routine, your morning practices, the plan you sign, an optional call, your pillars, your first steps, and what comes next. Made a mistake? Tap “Change my last answer” under any card. If you close the chat, everything you already sent is saved.' } },
    );

  const submitAccount = (rec: Record<string, string>) => {
    say('bumling', [], { ask: { kind: 'wait', text: 'Making your account' } });
    api
      .signup({ email: rec.email ?? '', password: rec.password ?? '', displayName: rec.name || undefined, phone: rec.phone ?? '', birthDate: rec.birthDate ?? '' })
      .then(async (r) => {
        setToken(r.token);
        await refresh();
        resumeRef.current(['Your account is made. Everything you tell me from now on is saved to it.']);
      })
      .catch((e) => {
        setNotice(err(e));
        say('bumling', ['That did not go through. The note below says why.'], { stage: { part: 'account' }, ask: { kind: 'form', render: (send) => <AccountForm initialName={rec.name ?? ''} onSend={send} /> } });
      });
  };

  const goMap = () =>
    say(
      'bumling',
      ['Step one is your map. It shows how you show up in each of your seven relationships.', 'For each relationship you pick two levels. First, where you usually are on a normal day. Then, where you drop to when you are stressed or upset.', 'The picture shows the whole scale, from Shame at the bottom to Full Consciousness at the top. You pick by name, from Shame up to Oneness. The numbers only show the order.', { node: <ConsciousnessMap /> }, 'Take your time. Pick the levels that are true for you now, not the ones you wish were true.'],
      { stage: { part: 'map', sub: 'all' }, ask: { kind: 'form', render: (send) => <MapForm initial={chatRef.current.data.placements} onSend={send} />, more: 'The levels come in three groups. Stuck, below 200: fear, blame or shame are in charge. Owning it, from 200 to 399: you show up and keep your word. At ease, 400 and up: things flow and you give without keeping score. The key line is Courage, at 200. If you drop below Courage when you are stressed, that relationship is a good place to start.' } },
    );

  const goWay = (data: Data) => {
    const starts = placedOf(data).filter((p) => placementFlags(p).required).map((p) => p.relationship);
    say('bumling', [starts.length ? belowCourage(starts) : 'Nothing drops below Courage, even under stress. That is a strong start.', 'Next: what gets in your way. There are two kinds of things. Fears show up when you are about to act, like the fear of being judged. Insecurities are things you worry other people notice about you.', 'Pick any that fit, or add your own words. If nothing fits, just send the card. That is a fine answer.'], { stage: { part: 'way' }, ask: { kind: 'form', render: (send) => <WayForm onSend={send} />, more: 'For each fear, pick the relationship it holds back, and say how often it decides things for you. For each insecurity, pick how heavy it feels, from a little to very heavy, and the relationship it touches. The heavier it is, the more it pulls that relationship towards your focus.' } });
  };

  const goScorecard = () =>
    say('bumling', ['Now rate how things are going right now, from one star to five. One star means very poor. Five stars means great.', 'There are three groups: your health, your wealth, and your seven relationships. Go with your first feeling.'], { stage: { part: 'scorecard', sub: 'all', checks: [] }, ask: { kind: 'form', render: (send) => <ScoreForm onSend={send} />, more: 'If a high score does not match your map, I will ask one quick question about last week to check it. Being honest never counts against you.' } });

  const goDay = () =>
    say('bumling', ['Next, tell me about a normal day as it is now, not the day you wish you had.', 'Your routine starts from this day and changes slowly, by half an hour a week. Nobody jumps from waking at 10:30 to waking at 8 on day one.'], { stage: { part: 'day' }, ask: { kind: 'form', render: (send) => <DayForm initial={chatRef.current.data.realDay} onSend={send} /> } });

  const goFocus = (suggested: RelationshipKey[], data: Data) => {
    const placed = placedOf(data);
    const starts = placed.filter((p) => placementFlags(p).required).map((p) => p.relationship);
    say('bumling', ['Here is your map: all seven relationships, from where you drop under stress to where you usually are.', { node: <PlacementChart placements={placed} focus={suggested} /> }, `${starts.length ? `${belowCourage(starts)} ` : ''}After that, I look at your lowest levels and at what weighs on you most. My suggestion: ${listOf(suggested.map(pillar))}.`, 'Which relationships do you want to work on first? Keep my picks or choose your own, up to two.'], { stage: { part: 'focus' }, ask: { kind: 'multi', chips: RELATIONSHIPS.map((r) => ({ label: r.name, value: r.key })), min: 1, max: 2, done: 'Work on these', more: 'Two at a time works better than seven at once. The others stay on your map, and you can change your focus later. In the first month, the aim is to stay at Courage or above in your focus relationships, even on hard days.' } });
    setMulti(suggested);
  };

  const goRoutine = (data: Data) =>
    say('bumling', ['Here is your routine. It is built from the day you described, not from a template.', { node: <RoutineCard data={data} /> }, 'The day has six blocks. Only the morning has steps to tick, and a day counts only when every morning step is ticked.', 'For every week you keep it on five days, your wake-up time moves thirty minutes earlier, until it reaches half past six.'], { stage: { part: 'plan', sub: 'routine' }, ask: { kind: 'chips', chips: [{ label: 'Looks right', value: 'ok' }], more: 'An exceptional day is a day you do not control, like travel, a crisis or a late night. Its morning is only twenty minutes, so one bad day does not break your week.' } });

  const goPractices = (data: Data) =>
    say('divine', [`${hello('divine')} Now your morning practices: a mantra to repeat, a breathing exercise, a line to say, and something to read.`, 'Pick one of each on the card below. You can also use a mantra of your own, or none for now.'], { stage: { part: 'plan', sub: 'practices' }, ask: { kind: 'form', render: (send) => <PracticesForm focus={data.focus} onSend={send} />, more: 'Om Namah Shivaya suits the material path: work, money and the body. Hare Krishna suits the spiritual path: practice, surrender and meaning. Neither one is a test of belief, and words of your own work just as well.' } });

  const goContract = () =>
    say('bumling', ['The last step of the plan is the contract. Signing it turns this plan into a promise to yourself.', 'Choose how many days a week you will keep the routine, when you want your daily check-in, and what happens if you miss. Then type your name to sign.'], { stage: { part: 'contract' }, ask: { kind: 'form', render: (send) => <ContractForm initial={chatRef.current.data.contract} placeholder={me.data?.user.displayName || 'Your name'} onSend={send} />, more: 'The contract is counted by the week. If you keep the routine on fewer days than you chose, the penalty you picked applies. A weekly check comes every Sunday, and a monthly review in thirty days.' } });

  const goCall = () =>
    say('bumling', ['Signed! Your plan is saved, and Daily will show your routine from tomorrow morning.', 'One offer, just once: a live strategy call with a coach, for US$100, or ₹10,000 in India. The app works without it. On the call, a person goes through your answers with you. Saying no changes nothing.'], { stage: { part: 'call' }, ask: { kind: 'chips', chips: [{ label: 'Book a live call', value: 'book' }, { label: 'Not now', value: 'skip' }] } });

  const goPillars = (data: Data) => {
    const first = data.focus[0];
    if (!first) return goSteps(data);
    say('bumling', ['Last part: your pillars. Each relationship you chose gets its own pyramid: a foundation, a guiding principle, a value goal, a goal outcome, a project and a first task.', 'Answer three quick questions for each one, and the pyramid is built from your answers.', `${who(first)}, ${RELATIONSHIP_BY_KEY[first].role}, asks first.`], { stage: { part: 'pillars', id: firstQuestionId(first), history: [] }, ask: null });
    timers.current.push(window.setTimeout(() => askQuestion(firstQuestionId(first), [], true), reduce ? 0 : 1100));
  };

  const askQuestion = (id: string, history: string[], intro: boolean) => {
    const q = QUESTION_BY_ID[id];
    if (!q) return goSteps(chatRef.current.data);
    const r = RELATIONSHIP_BY_KEY[q.relationship];
    // A pick question can always be answered in your own words; a scale stays a scale.
    const chips: Chip[] = q.format === 'pick' && q.options ? [...q.options.map((o, i) => ({ label: o.label, value: String(i), emoji: o.emoji })), { label: 'Write my own', value: 'own', emoji: '✍️' }] : q.format === 'scale' && q.scale ? q.scale.labels.map((l, i) => ({ label: l, value: String(i) })) : [{ label: 'Yes', value: '1' }, { label: 'Not yet', value: '0' }];
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
    const order = priorityOrder(placedOf(data), data.insecurities);
    const lines: (string | { node: ReactNode })[] = ['Your pillars are ready. Each one is a pyramid: the foundation at the top, down to your first task at the point.'];
    if (data.result) lines.push({ node: <PyramidsCard focus={data.focus} result={data.result} picks={data.picks} /> });
    lines.push(`Here is the order to work through all seven. Start with ${listOf(data.focus.map(pillar))} this month. When those hold at Courage, move on to the next one on the list.`, { node: <NextStepsCard order={order} focus={data.focus} /> }, 'From tomorrow, tick your morning routine on Daily. On Sunday night, take five minutes for the weekly check. In thirty days you will do a review. Everything from this session is saved at the bottom of Pillars, as your life map.', 'What would you like to do now? You can open your pillars, or add your interests so people with the same interests can find you.');
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
        setNotice(err(e));
        goProfile();
      });
  };

  // ---- server calls

  const submitAssessment = (data: Data) => {
    say('bumling', [], { ask: { kind: 'wait', text: 'Bumling is working out your focus' } });
    api
      .submitAssessment({ placements: placedOf(data), fears: data.fears, insecurities: data.insecurities, scores: data.scores, behaviour: data.behaviour, realDay: data.realDay })
      .then((r) => goFocus(r.suggestedFocus, data))
      .catch((e) => {
        setNotice(err(e));
        goDay();
      });
  };

  const submitPlan = (data: Data) => {
    say('bumling', [], { ask: { kind: 'wait', text: 'Filing the contract' } });
    api
      .submitPlan({ focus: data.focus, practices: { ...data.practices, affirmation: data.practices.affirmation || affirmationFor(data.focus) }, contract: data.contract, date: todayLocal() })
      .then(async () => {
        await refresh();
        goCall();
      })
      .catch((e) => {
        setNotice(err(e));
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
        setNotice(err(e));
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
        setNotice(err(e));
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
      if (str === 'keep') return goFocus(d.focus.length ? d.focus : pickFocus(placedOf(d), d.insecurities), d);
      if (str === 'pillars') return goPillars(d);
      return goMap();
    }

    if (s.part === 'map') {
      if (s.sub === 'all') {
        const placements = Object.fromEntries(RELATIONSHIPS.map((r) => [r.key, { relationship: r.key, core: Number(rec[`${r.key}.core`]), floor: Number(rec[`${r.key}.floor`]), evidence: d.placements[r.key]?.evidence ?? '' }])) as Record<RelationshipKey, Placement>;
        const data = { ...d, placements };
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
      return submitPlan(data);
    }

    if (s.part === 'call') {
      if (str === 'book') setCallOpen(true);
      return goPillars(d);
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
  const part = PARTS.indexOf(chat.stage.part) + 1;
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
        step={`Part ${part} of ${PARTS.length}: ${PART_NAME[chat.stage.part]}`}
        progress={part / PARTS.length}
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
        <p className="m-0 text-[16px] font-semibold text-ink-soft">A live strategy call with the coach is US$100, or ₹10,000 in India. Booking opens once payments are connected. Until then, write to the team under Help and we will set a time by hand.</p>
        <Link to="/help" className="toy mt-md inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md text-[16px] font-bold text-on-ink">
          Write to the team
        </Link>
      </Sheet>
    </>
  );
}
