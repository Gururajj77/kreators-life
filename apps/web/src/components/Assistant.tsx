import {
  ASSISTANT_MODEL_BY_ID,
  centsFrom,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  KIND_META,
  KINDS,
  MAX_NOT_TO_DO,
  messagesFor,
  money,
  MOODS,
  NOT_TO_DO_TITLE_MAX,
  PERIOD_KINDS,
  PERIOD_META,
  periodFor,
  periodLabel,
  periodShift,
  PLANS,
  REVIEW_ANSWER_MAX,
  REVIEW_HIGHLIGHT_MAX,
  parentKind,
  RELATIONSHIP_BY_KEY,
  RELATIONSHIPS,
  STRESS_LEVELS,
  type AssistantPaywall,
  type AssistantReceipt,
  type AssistantTurn,
  type DayType,
  type FinanceDue,
  type FinanceGoal,
  type PeriodKind,
  type Node,
  type NodeKind,
  type NotToDo,
  type NotToDoStatus,
  type RelationshipKey,
  type Host,
  characterHello,
  hostName,
} from '@kreators/shared';
import { useQueryClient } from '@tanstack/react-query';
import gsap from 'gsap';
import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ChatActions, ChatComposer, ChatLinks, ChatTurns, ChoiceChips, ChoiceGroups, chip, countTurns, typingTime, useChatMotion } from './Chat';
import { api, ApiError } from '../lib/api';
import { prettyDate, todayLocal } from '../lib/date';
import { explainTyped, isQuestion } from '../lib/explain';
import { useModule, useModules } from '../lib/modules';
import { forgetKept, useKept, useKeptRef } from '../lib/kept';
import { useAuthed, useMe, useRefreshAll } from '../lib/queries';
import { useAssistantModel } from '../lib/store';
import { Avatar } from './Avatar';
import { Markdown } from './Markdown';
import { StartOver } from './StartOver';

/**
 * The assistant: the round button at the bottom right of every screen in the app, and the panel it opens over the
 * page. It holds what used to be the quick chat, the free flows that log something by answering a question or two
 * and save through the same calls the screens use, and, with a plan, a typing box: what is typed goes to a model
 * on the server that does it in the app as the person, through the same routes. Each change it made comes back as
 * a row with an Undo, and anything that removes or settles waits for Confirm. The page under the panel refreshes
 * as things land. The chat is kept for the tab (lib/kept.ts); Close folds it away, Start over begins it fresh.
 */

type TalkOrigin = 'home' | 'today' | 'tower' | 'reviews' | 'finance' | 'other';
type Flow = 'checkin' | 'spark' | 'tick' | 'routine' | 'notToDoDay' | 'notToDo' | 'task' | 'layer' | 'mood' | 'sleep' | 'stress' | 'mindful' | 'move' | 'journal' | 'money' | 'review' | 'due' | 'settle' | 'goal' | 'goalAdd';

interface FlowMeta {
  label: string;
  emoji: string;
  /** Where the answer shows up, said before anything is asked. */
  lands: string;
  to: string;
  host: Host;
  /** The app that must be on for the flow to show. Null means it is part of the core. */
  needs: string[] | null;
}

const TRACKERS = ['wellbeing', 'mood', 'sleep', 'stress', 'mindful', 'life'];
const FLOWS: Record<Flow, FlowMeta> = {
  checkin: { label: 'Check in for today', emoji: '✅', lands: 'Daily, under Show up, and your streak on Home', to: '/today', host: 'bumling', needs: null },
  spark: { label: 'Mark the small act done', emoji: '✨', lands: 'Daily, under the small act', to: '/today', host: 'bumling', needs: null },
  tick: { label: 'Tick tasks I did', emoji: '☑️', lands: 'Daily, under Tasks, and the pyramid each task holds up', to: '/today', host: 'bumling', needs: null },
  routine: { label: 'Tick my morning routine', emoji: '🌅', lands: 'Daily, under Your routine, and the week dots for your contract', to: '/today', host: 'bumling', needs: null },
  notToDoDay: { label: 'Mark my not to do list', emoji: '🚫', lands: 'Daily, under Not to do, with each streak', to: '/today', host: 'bumling', needs: null },
  notToDo: { label: 'Add to my not to do list', emoji: '➕', lands: 'Daily, under Not to do', to: '/today', host: 'bumling', needs: null },
  task: { label: 'Add a task', emoji: '📝', lands: 'the pyramid in Pillars, and Daily on the day it is due', to: '/tower', host: 'bumling', needs: null },
  layer: { label: 'Add to a pyramid', emoji: '🔺', lands: 'that pillar in Pillars', to: '/tower', host: 'bumling', needs: null },
  mood: { label: 'Log my mood', emoji: '🙂', lands: 'the trackers on Home, Mood and your Life score', to: '/home', host: 'bumling', needs: TRACKERS },
  sleep: { label: 'Log my sleep', emoji: '🌙', lands: 'the trackers on Home, Sleep and your Life score', to: '/home', host: 'bumling', needs: TRACKERS },
  stress: { label: 'Log my stress', emoji: '🌊', lands: 'the trackers on Home, Stress and your Life score', to: '/home', host: 'bumling', needs: TRACKERS },
  mindful: { label: 'Log mindful minutes', emoji: '🧘', lands: 'the trackers on Home, Mindful minutes and your Life score', to: '/home', host: 'divine', needs: TRACKERS },
  move: { label: 'Log time moving', emoji: '🏃', lands: 'the physical part of your Life score', to: '/life', host: 'self', needs: TRACKERS },
  journal: { label: 'Write in my journal', emoji: '📓', lands: 'your Journal. Only you can see it', to: '/journal', host: 'self', needs: ['journal'] },
  money: { label: 'Add money in or out', emoji: '💰', lands: 'Finance, and money this month on Home', to: '/finance', host: 'servant_leader', needs: ['finance'] },
  due: { label: 'Note money owed', emoji: '🤝', lands: 'Finance, under what is owed', to: '/finance', host: 'servant_leader', needs: ['finance'] },
  settle: { label: 'Settle something owed', emoji: '✔️', lands: 'Finance, under what is owed', to: '/finance', host: 'servant_leader', needs: ['finance'] },
  goal: { label: 'Set a money goal', emoji: '🎯', lands: 'Finance, under goals', to: '/finance', host: 'servant_leader', needs: ['finance'] },
  goalAdd: { label: 'Add to a money goal', emoji: '🪙', lands: 'Finance, under goals', to: '/finance', host: 'servant_leader', needs: ['finance'] },
  review: { label: 'Write a review', emoji: '📝', lands: 'Reviews, saved with that period\'s numbers', to: '/reviews', host: 'bumling', needs: ['reviews'] },
};
const ALL_FLOWS = Object.keys(FLOWS) as Flow[];
const FIRST: Record<TalkOrigin, Flow[]> = {
  today: ['checkin', 'spark', 'tick', 'routine', 'notToDoDay'],
  tower: ['layer', 'task', 'tick'],
  home: ['mood', 'sleep', 'stress', 'journal', 'checkin'],
  reviews: ['review', 'journal', 'mood'],
  finance: ['money', 'due', 'settle', 'goal', 'goalAdd'],
  other: ['checkin', 'tick', 'mood', 'journal', 'money'],
};
const ORIGIN: Record<TalkOrigin, { name: string; to: string; host: Host }> = {
  home: { name: 'Home', to: '/home', host: 'bumling' },
  today: { name: 'Daily', to: '/today', host: 'bumling' },
  tower: { name: 'Pillars', to: '/tower', host: 'bumling' },
  reviews: { name: 'Reviews', to: '/reviews', host: 'bumling' },
  finance: { name: 'Finance', to: '/finance', host: 'servant_leader' },
  other: { name: 'this screen', to: '', host: 'bumling' },
};
const who = hostName;
const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

interface Msg {
  id: number;
  from: 'bot' | 'you';
  host?: Host;
  text?: string;
  node?: ReactNode;
}
type Chip = { label: string; value: string; emoji?: string; blurb?: string };
type Ask =
  | { kind: 'chips'; chips: Chip[]; pick: (c: Chip) => void; more?: string }
  | { kind: 'multi'; chips: Chip[]; start: string[]; done: string; pick: (values: string[], label: string) => void; more?: string }
  | { kind: 'form'; render: () => ReactNode; more?: string }
  | { kind: 'wait'; text: string };

// ---------------------------------------------------------------------------
// The cards. Each is answered in one go, and sends one line back to the chat.
// ---------------------------------------------------------------------------

function CardShell({ children, onSubmit, send, disabled }: { children: ReactNode; onSubmit: () => void; send: string; disabled?: boolean }) {
  return (
    <form
      className="rounded-tile bg-card p-sm shadow-toy-soft"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onSubmit();
      }}
    >
      <div className="flex flex-col gap-sm">{children}</div>
      <ChatActions next={send} ready={!disabled} submit />
    </form>
  );
}

function TaskForm({ projects, today, onSend }: { projects: Node[]; today: string; onSend: (v: { parentId: string; title: string; due: string; time: string; minutes: number | null }, label: string) => void }) {
  const [parentId, setParentId] = useState(projects[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(today);
  const [time, setTime] = useState('');
  const [minutes, setMinutes] = useState('');
  return (
    <CardShell send="Add the task" disabled={!title.trim() || !parentId} onSubmit={() => onSend({ parentId, title: title.trim(), due, time, minutes: Number(minutes) > 0 ? Number(minutes) : null }, `${title.trim()}, due ${prettyDate(due)}${time ? ` at ${time}` : ''}`)}>
      {projects.length > 1 && (
        <label className="block">
          <span className="block text-[14px] font-bold">Which project does it move?</span>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={field}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <span className="block text-[14px] font-bold">The task</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder={KIND_META.task.prompt} className={field} />
      </label>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
        <label className="block">
          <span className="block text-[14px] font-bold">Due</span>
          <input type="date" value={due} min={today} onChange={(e) => setDue(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Time, if any</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Minutes, if any</span>
          <input type="number" min={5} max={600} step={5} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="20" className={field} />
        </label>
      </div>
    </CardShell>
  );
}

function LayerForm({ kind, parents, onSend }: { kind: NodeKind; parents: Node[]; onSend: (v: { parentId: string | null; title: string }, label: string) => void }) {
  const meta = KIND_META[kind];
  const up = parentKind(kind);
  const [parentId, setParentId] = useState(parents[0]?.id ?? '');
  const [title, setTitle] = useState('');
  return (
    <CardShell send={`Add the ${meta.label.toLowerCase()}`} disabled={!title.trim() || Boolean(up && !parentId)} onSubmit={() => onSend({ parentId: up ? parentId : null, title: title.trim() }, title.trim())}>
      <label className="block">
        <span className="block text-[14px] font-bold">{meta.hint}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder={meta.prompt} className={field} />
        <span className="mt-xs block text-[12px] font-semibold text-ink-soft">For example: {meta.example}</span>
      </label>
      {up && parents.length > 1 && (
        <label className="block">
          <span className="block text-[14px] font-bold">Which {KIND_META[up].label.toLowerCase()} does it hold up?</span>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={field}>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      )}
    </CardShell>
  );
}

function NotToDoForm({ onSend }: { onSend: (v: { title: string; relationship: RelationshipKey | null }, label: string) => void }) {
  const [title, setTitle] = useState('');
  const [rel, setRel] = useState<RelationshipKey | ''>('');
  return (
    <CardShell send="Add it to the list" disabled={!title.trim()} onSubmit={() => onSend({ title: title.trim(), relationship: rel || null }, title.trim())}>
      <label className="block">
        <span className="block text-[14px] font-bold">What will you stay away from?</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={NOT_TO_DO_TITLE_MAX} placeholder="Phone in bed" className={field} />
      </label>
      <label className="block">
        <span className="block text-[14px] font-bold">Which pillar does it protect? Optional.</span>
        <select value={rel} onChange={(e) => setRel(e.target.value as RelationshipKey | '')} className={field}>
          <option value="">No pillar</option>
          {RELATIONSHIPS.map((r) => (
            <option key={r.key} value={r.key}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
    </CardShell>
  );
}

function NotToDoDayForm({ items, onSend }: { items: NotToDo[]; onSend: (v: Record<string, NotToDoStatus>, label: string) => void }) {
  const [marks, setMarks] = useState<Record<string, NotToDoStatus>>(() => Object.fromEntries(items.filter((i) => i.today).map((i) => [i.id, i.today as NotToDoStatus])));
  const count = Object.keys(marks).length;
  const kept = Object.values(marks).filter((s) => s === 'kept').length;
  return (
    <CardShell send="Save today" disabled={count === 0} onSubmit={() => onSend(marks, `${kept} kept, ${count - kept} slipped`)}>
      <ul className="m-0 flex list-none flex-col gap-sm p-0">
        {items.map((i) => (
          <li key={i.id}>
            <p className="m-0 text-[16px] font-bold">{i.title}</p>
            <div className="mt-xs flex flex-wrap gap-xs" role="group" aria-label={i.title}>
              {(['kept', 'slipped'] as const).map((s) => (
                <button key={s} type="button" aria-pressed={marks[i.id] === s} className={chip(marks[i.id] === s)} onClick={() => setMarks((m) => ({ ...m, [i.id]: s }))}>
                  {s === 'kept' ? 'Kept away' : 'Slipped'}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

const QUALITY = ['Poor', 'Restless', 'Okay', 'Good', 'Deep'];
function SleepForm({ onSend }: { onSend: (v: { hours: number; quality: number }, label: string) => void }) {
  const [hours, setHours] = useState(7);
  const [quality, setQuality] = useState(3);
  return (
    <CardShell send="Log my sleep" onSubmit={() => onSend({ hours, quality }, `${hours} hours, ${QUALITY[quality - 1]!.toLowerCase()}`)}>
      <label className="block">
        <span className="flex items-baseline justify-between text-[14px] font-bold">
          <span>Hours slept</span>
          <span className="font-display text-[20px] font-extrabold">{hours}</span>
        </span>
        <input type="range" min={0} max={14} step={0.5} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="mt-xs w-full accent-ink" />
      </label>
      <div>
        <p className="m-0 text-[14px] font-bold">How it felt</p>
        <div className="mt-xs flex flex-wrap gap-xs" role="group" aria-label="Sleep quality">
          {QUALITY.map((q, i) => (
            <button key={q} type="button" aria-pressed={quality === i + 1} className={chip(quality === i + 1)} onClick={() => setQuality(i + 1)}>
              {q}
            </button>
          ))}
        </div>
      </div>
    </CardShell>
  );
}

function JournalForm({ onSend }: { onSend: (v: { title: string; body: string; emotion: number | null }, label: string) => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [emotion, setEmotion] = useState<number | null>(null);
  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  return (
    <CardShell send="Save the entry" disabled={!body.trim()} onSubmit={() => onSend({ title: title.trim(), body: body.trim(), emotion }, title.trim() || `${body.trim().slice(0, 60)}${body.trim().length > 60 ? '…' : ''}`)}>
      <label className="block">
        <span className="block text-[14px] font-bold">A title. Optional.</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Today" className={field} />
      </label>
      <label className="block">
        <span className="block text-[14px] font-bold">What is on your mind?</span>
        <textarea
          value={body}
          rows={4}
          onChange={(e) => {
            setBody(e.target.value);
            grow(e.currentTarget);
          }}
          placeholder="Write it the way you would say it."
          className={`${field} resize-none overflow-hidden`}
        />
      </label>
      <div>
        <p className="m-0 text-[14px] font-bold">How does it feel? Optional.</p>
        <div className="mt-xs flex flex-wrap gap-xs" role="group" aria-label="Emotion">
          {MOODS.map((m) => (
            <button key={m.value} type="button" aria-pressed={emotion === m.value} className={chip(emotion === m.value)} onClick={() => setEmotion(emotion === m.value ? null : m.value)}>
              {m.emoji} {m.name}
            </button>
          ))}
        </div>
      </div>
    </CardShell>
  );
}

function MoneyForm({ onSend }: { onSend: (v: { kind: 'income' | 'expense'; cents: number; category: string; counterparty: string; note: string }, label: string) => void }) {
  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const cats: readonly string[] = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [counterparty, setCounterparty] = useState('');
  const [note, setNote] = useState('');
  const cents = centsFrom(amount);
  return (
    <CardShell send="Add it" disabled={cents === null} onSubmit={() => cents !== null && onSend({ kind, cents, category, counterparty: counterparty.trim(), note: note.trim() }, `${kind === 'income' ? 'In' : 'Out'}: ${money(cents)}, ${category.toLowerCase()}`)}>
      <div className="flex flex-wrap gap-xs" role="group" aria-label="In or out">
        {(['income', 'expense'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            className={chip(kind === k)}
            onClick={() => {
              setKind(k);
              setCategory((k === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)[0]);
            }}
          >
            {k === 'income' ? 'Money in' : 'Money out'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <label className="block">
          <span className="block text-[14px] font-bold">How much</span>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1250" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">What for</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
            {cats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Who, if anyone</span>
          <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} maxLength={80} placeholder={kind === 'income' ? 'A brand' : 'A shop'} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">A note, if any</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={field} />
        </label>
      </div>
    </CardShell>
  );
}

function ReviewForm({ prompts, start, onSend }: { prompts: string[]; start: { answers: string[]; rating: number | null; highlight: string }; onSend: (v: { answers: string[]; rating: number | null; highlight: string }, label: string) => void }) {
  const [answers, setAnswers] = useState<string[]>(() => prompts.map((_, i) => start.answers[i] ?? ''));
  const [rating, setRating] = useState<number | null>(start.rating);
  const [highlight, setHighlight] = useState(start.highlight);
  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  const filled = answers.filter((a) => a.trim()).length;
  return (
    <CardShell send="Save the review" disabled={filled === 0 && !highlight.trim()} onSubmit={() => onSend({ answers: answers.map((a) => a.trim()), rating, highlight: highlight.trim() }, `${filled} of ${prompts.length} answered${rating ? `, felt ${MOODS[rating - 1]!.name.toLowerCase()}` : ''}`)}>
      {prompts.map((p, i) => (
        <label key={i} className="block">
          <span className="block text-[14px] font-bold">{p}</span>
          <textarea
            value={answers[i]}
            rows={2}
            maxLength={REVIEW_ANSWER_MAX}
            ref={(el) => {
              if (el) grow(el);
            }}
            onChange={(e) => {
              const v = e.target.value;
              setAnswers((a) => a.map((x, j) => (j === i ? v : x)));
              grow(e.currentTarget);
            }}
            className={`${field} resize-none overflow-hidden`}
          />
        </label>
      ))}
      <div>
        <p className="m-0 text-[14px] font-bold">How did the period feel? Optional.</p>
        <div className="mt-xs flex flex-wrap gap-xs" role="group" aria-label="How it felt">
          {MOODS.map((m) => (
            <button key={m.value} type="button" aria-pressed={rating === m.value} className={chip(rating === m.value)} onClick={() => setRating(rating === m.value ? null : m.value)}>
              {m.emoji} {m.name}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="block text-[14px] font-bold">The one thing worth keeping. Optional.</span>
        <input value={highlight} onChange={(e) => setHighlight(e.target.value)} maxLength={REVIEW_HIGHLIGHT_MAX} placeholder="Shipped the first video" className={field} />
      </label>
    </CardShell>
  );
}

function DueForm({ today, onSend }: { today: string; onSend: (v: { direction: 'owe' | 'owed'; counterparty: string; cents: number; dueDate: string | null; note: string }, label: string) => void }) {
  const [direction, setDirection] = useState<'owe' | 'owed'>('owed');
  const [counterparty, setCounterparty] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const cents = centsFrom(amount);
  return (
    <CardShell send="Note it" disabled={cents === null || !counterparty.trim()} onSubmit={() => cents !== null && onSend({ direction, counterparty: counterparty.trim(), cents, dueDate: dueDate || null, note: note.trim() }, `${direction === 'owed' ? `${counterparty.trim()} owes me` : `I owe ${counterparty.trim()}`} ${money(cents)}`)}>
      <div className="flex flex-wrap gap-xs" role="group" aria-label="Which way">
        {(['owed', 'owe'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={direction === k} className={chip(direction === k)} onClick={() => setDirection(k)}>
            {k === 'owed' ? 'Someone owes me' : 'I owe someone'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <label className="block">
          <span className="block text-[14px] font-bold">Who</span>
          <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} maxLength={80} placeholder="A brand or a friend" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">How much</span>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Due by, if any</span>
          <input type="date" value={dueDate} min={today} onChange={(e) => setDueDate(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">A note, if any</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={field} />
        </label>
      </div>
    </CardShell>
  );
}

function GoalForm({ today, onSend }: { today: string; onSend: (v: { title: string; kind: 'save' | 'earn'; cents: number; deadline: string | null }, label: string) => void }) {
  const [kind, setKind] = useState<'save' | 'earn'>('save');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const cents = centsFrom(amount);
  return (
    <CardShell send="Set the goal" disabled={cents === null || !title.trim()} onSubmit={() => cents !== null && onSend({ title: title.trim(), kind, cents, deadline: deadline || null }, `${title.trim()}: ${kind} ${money(cents)}${deadline ? ` by ${prettyDate(deadline)}` : ''}`)}>
      <div className="flex flex-wrap gap-xs" role="group" aria-label="Save or earn">
        {(['save', 'earn'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} className={chip(kind === k)} onClick={() => setKind(k)}>
            {k === 'save' ? 'Save up' : 'Earn'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
        <label className="block">
          <span className="block text-[14px] font-bold">What for</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="A new camera" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">How much</span>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="60000" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">By when, if any</span>
          <input type="date" value={deadline} min={today} onChange={(e) => setDeadline(e.target.value)} className={field} />
        </label>
      </div>
    </CardShell>
  );
}

function AmountForm({ send, onSend }: { send: string; onSend: (cents: number, label: string) => void }) {
  const [amount, setAmount] = useState('');
  const cents = centsFrom(amount);
  return (
    <CardShell send={send} disabled={cents === null} onSubmit={() => cents !== null && onSend(cents, money(cents))}>
      <label className="block">
        <span className="block text-[14px] font-bold">How much</span>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2000" className={field} />
      </label>
    </CardShell>
  );
}

/** Where the answer went, as a link to that place. */
function Landed({ meta }: { meta: FlowMeta }) {
  const here = useLocation().pathname === meta.to;
  if (here)
    return (
      <p className="m-0 flex items-center gap-sm rounded-tile bg-card p-sm text-[14px] font-bold shadow-toy-soft">
        <span aria-hidden="true" className="text-[22px]">
          {meta.emoji}
        </span>
        <span>Saved. It is on this page now.</span>
      </p>
    );
  return (
    <Link to={meta.to} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm text-ink shadow-toy-soft">
      <span aria-hidden="true" className="text-[22px]">
        {meta.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold">Saved. It shows up on {meta.lands.split('. ')[0]}.</span>
        <span className="block text-[12px] font-semibold text-ink-soft">Tap to see it there.</span>
      </span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}

/**
 * The panel's close: a round ×. Pointed at with a mouse, or reached with the keyboard, it opens out to
 * "Close" beside the ×, so you see what it does before you click. A tap on a phone closes it straight away.
 */
function CloseButton({ onClose }: { onClose: () => void }) {
  const reduce = useReducedMotion();
  const label = useRef<HTMLSpanElement>(null);
  const show = (on: boolean) => {
    const el = label.current;
    if (!el) return;
    const to = { width: on ? 'auto' : 0, opacity: on ? 1 : 0, marginRight: on ? 8 : 0 };
    if (reduce) gsap.set(el, to);
    else gsap.to(el, { ...to, duration: 0.2, ease: 'power2.out', overwrite: true });
  };
  return (
    <button
      type="button"
      onClick={onClose}
      onPointerEnter={(e) => e.pointerType === 'mouse' && show(true)}
      onPointerLeave={() => show(false)}
      onFocus={(e) => e.currentTarget.matches(':focus-visible') && show(true)}
      onBlur={() => show(false)}
      className="toy toy-soft inline-flex h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-pill bg-card px-sm text-ink-soft hover:text-ink"
    >
      <span ref={label} className="block overflow-hidden whitespace-nowrap text-[14px] font-bold" style={{ width: 0, opacity: 0 }}>
        Close
      </span>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" className="shrink-0">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}


// ---------------------------------------------------------------------------
// What typing did: a row per change with Undo, a card for anything waiting on Confirm, and the plan card.
// ---------------------------------------------------------------------------

const scopeOf = (userId: string | undefined) => `assistant:${userId ?? 'none'}`;

/** Clears the screens that show these changes, so the page under the panel catches up, and the credits line too. */
function useRefreshKeys() {
  const qc = useQueryClient();
  return useCallback(
    (keys: readonly string[]) => {
      for (const k of new Set([...keys, 'assistant', 'credits'])) void qc.invalidateQueries({ queryKey: [k] });
    },
    [qc],
  );
}

const MARK: Record<AssistantReceipt['status'], string> = { done: '✓', failed: '!', undone: '↺', cancelled: '–', pending: '?' };

function Receipts({ scope, ids }: { scope: string; ids: string[] }) {
  const [map, setMap] = useKept<Record<string, AssistantReceipt>>(scope, 'receipts', {});
  const refresh = useRefreshKeys();
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<Record<string, string>>({});
  const act = async (id: string, fn: () => Promise<{ receipt: AssistantReceipt }>) => {
    setBusy(id);
    setSaid((s) => ({ ...s, [id]: '' }));
    try {
      const { receipt } = await fn();
      setMap((m) => ({ ...m, [id]: receipt }));
      refresh(receipt.refresh);
    } catch (e) {
      const receipt = e instanceof ApiError ? (e.data.receipt as AssistantReceipt | undefined) : undefined;
      if (receipt) setMap((m) => ({ ...m, [id]: receipt }));
      setSaid((s) => ({ ...s, [id]: errorText(e) }));
    } finally {
      setBusy(null);
    }
  };
  const rows = ids.map((id) => map[id]).filter((r): r is AssistantReceipt => Boolean(r));
  if (!rows.length) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-xs p-0" aria-label="What changed">
      {rows.map((r) =>
        r.status === 'pending' ? (
          <li key={r.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
            <p className="m-0 text-[14px] font-bold">{r.label}?</p>
            <ChatActions skip="Cancel" onSkip={() => void act(r.id, () => api.assistantCancel(r.id))} next="Confirm" ready={busy !== r.id} onNext={() => void act(r.id, () => api.assistantConfirm(r.id, todayLocal()))} />
            {said[r.id] && (
              <p role="alert" className="mt-xs m-0 text-[12px] font-bold text-ink-soft">
                {said[r.id]}
              </p>
            )}
          </li>
        ) : (
          <li key={r.id} className="flex items-center gap-sm rounded-tile bg-card px-sm py-xs shadow-toy-soft">
            <span aria-hidden="true" className={`flex size-[24px] shrink-0 items-center justify-center rounded-pill text-[12px] font-extrabold ${r.status === 'done' ? 'bg-ink text-on-ink' : 'bg-paper text-ink-soft'}`}>
              {MARK[r.status]}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-[14px] font-bold ${r.status === 'undone' || r.status === 'cancelled' ? 'text-ink-soft line-through' : ''}`}>{r.label}</span>
              {r.status === 'failed' && <span className="block text-[12px] font-semibold text-ink-soft">Not done. {r.error}</span>}
              {r.status === 'cancelled' && <span className="block text-[12px] font-semibold text-ink-soft">Cancelled. Nothing changed.</span>}
              {said[r.id] && (
                <span role="alert" className="block text-[12px] font-semibold text-ink-soft">
                  {said[r.id]}
                </span>
              )}
            </span>
            {r.undo && (
              <button type="button" disabled={busy === r.id} onClick={() => void act(r.id, () => api.assistantUndo(r.id, todayLocal()))} className="toy toy-soft min-h-[32px] shrink-0 rounded-pill border-2 border-line bg-paper px-sm text-[12px] font-bold disabled:opacity-60">
                Undo
              </button>
            )}
            {r.status === 'undone' && <span className="shrink-0 text-[12px] font-bold text-ink-soft">Undone</span>}
          </li>
        ),
      )}
    </ul>
  );
}

const PAYWALL: Record<AssistantPaywall, { title: string; line: string }> = {
  plan: {
    title: 'Typing is part of a plan',
    line: `Pro is ${money(PLANS.pro.priceCents, 'USD')} a month for ${PLANS.pro.credits.toLocaleString('en-US')} credits, about ${messagesFor(PLANS.pro.credits).toLocaleString('en-US')} messages. The flows stay free. See Plans and credits in the Profile tab.`,
  },
  credits: { title: 'Out of credits', line: 'Top up, or wait for your plan to start again. The flows stay free.' },
  day: { title: "Today's limit is used", line: 'It frees up over the next 24 hours, and a bigger plan has more room. The flows stay free.' },
};

/** A reply from the model: its small markdown, and which model wrote it, so it is never mistaken for a built-in line. */
function ModelReply({ text, model }: { text: string; model: string }) {
  const name = ASSISTANT_MODEL_BY_ID[model]?.name ?? model;
  return (
    <div>
      <Markdown text={text} className="text-[16px] font-semibold leading-relaxed" />
      <p className="m-0 mt-xs text-[12px] font-bold text-ink-mute">Answered by {name}</p>
    </div>
  );
}

function PlanCard({ reason }: { reason: AssistantPaywall }) {
  const p = PAYWALL[reason];
  return (
    <Link to="/plans" className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm text-ink shadow-toy-soft">
      <span aria-hidden="true" className="text-[22px]">
        🪄
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold">{p.title}</span>
        <span className="block text-[12px] font-semibold text-ink-soft">{p.line}</span>
      </span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// The panel.
// ---------------------------------------------------------------------------

function AssistantPanel({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const loc = useLocation();
  const panel = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const refresh = useRefreshAll();
  const refreshKeys = useRefreshKeys();
  const qc = useQueryClient();
  const { modules, ready } = useModules();
  const date = todayLocal();
  const status = useAuthed(['assistant'], api.assistantStatus);
  // The plan may have changed while the panel was shut (a team grant): look again each time it opens.
  useEffect(() => {
    void qc.invalidateQueries({ queryKey: ['assistant'] });
  }, [qc]);
  const account = status.data?.account;
  const canType = Boolean(status.data?.connected && account && account.plan !== 'none');
  // The model, picked here while models are being tried out. A pick the server no longer offers falls back to its default.
  const picked = useAssistantModel((m) => m.model);
  const setPicked = useAssistantModel((m) => m.setModel);
  const models = status.data?.models ?? [];
  const model = models.find((m) => m.id === picked) ?? models.find((m) => m.id === status.data?.model) ?? models[0] ?? null;

  // The flows offered first are the ones for the screen under the panel.
  const from: TalkOrigin = (['home', 'today', 'tower', 'reviews', 'finance'] as const).find((o) => loc.pathname === ORIGIN[o].to || loc.pathname.startsWith(`${ORIGIN[o].to}/`)) ?? 'other';
  const origin = ORIGIN[from];

  // Kept for the tab, per person, so moving around the app finds the same chat.
  const scope = scopeOf(useMe().data?.user.id);
  const [round, setRound] = useState(0);
  const [log, setLog] = useKept<Msg[]>(scope, 'log', []);
  const [ask, setAsk] = useKept<Ask | null>(scope, 'ask', null);
  const [typing, setTyping] = useKept<Host | null>(scope, 'typing', null);
  const [host, setHost] = useKept<Host>(scope, 'host', origin.host);
  const [multi, setMulti] = useKept<string[]>(scope, 'multi', []);
  const [flow, setFlow] = useKept<Flow | null>(scope, 'flow', null);
  const [talk, setTalk] = useKept<AssistantTurn[]>(scope, 'talk', []);
  const [receipts, setReceipts] = useKept<Record<string, AssistantReceipt>>(scope, 'receipts', {});
  const [thinking, setThinking] = useKept(scope, 'thinking', false);
  // The running message's id, for Stop, and whether Stop was tapped.
  const run = useKeptRef<string | null>(scope, 'run', null);
  const [stopping, setStopping] = useKept(scope, 'stopping', false);
  const ids = useKeptRef(scope, 'ids', 0);
  const timers = useKeptRef<number[]>(scope, 'timers', []);
  const started = useKeptRef(scope, 'started', false);
  const lastHost = useKeptRef<Host | null>(scope, 'lastHost', null);

  const isOn = (keys: string[] | null) => !keys || keys.some((k) => modules.find((m) => m.key === k && m.available && m.on));
  const flowsOn = ALL_FLOWS.filter((f) => isOn(FLOWS[f].needs));

  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };

  /** The host says a few lines at a typing pace, then the next ask opens. */
  const say = useCallback(
    (h: Host, lines: (string | { node: ReactNode })[], next: Ask | null) => {
      clearTimers();
      setAsk(null);
      setHost(h);
      lastHost.current = h;
      setTyping(lines.length ? h : null);
      let at = reduce ? 0 : 300;
      lines.forEach((line, i) => {
        at += reduce ? 0 : typingTime(line);
        timers.current.push(
          window.setTimeout(() => {
            const id = (ids.current += 1);
            setLog((l) => [...l, typeof line === 'string' ? { id, from: 'bot', host: h, text: line } : { id, from: 'bot', host: h, node: line.node }]);
            if (i === lines.length - 1) {
              setTyping(null);
              setAsk(next);
            }
          }, at),
        );
      });
      if (lines.length === 0) setAsk(next);
    },
    // The scope is part of it: lines written before the account loaded would land in the wrong chat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reduce, scope],
  );

  /** Every answer is written into the chat as your line. */
  const you = (label: string) => {
    const id = (ids.current += 1);
    setLog((l) => [...l, { id, from: 'you', text: label }]);
    setAsk(null);
    setMulti([]);
  };

  // ---- the menu: which flow to begin

  const menu = (first: boolean, all = false) => {
    setFlow(null);
    const list = all ? flowsOn : FIRST[from].filter((f) => flowsOn.includes(f));
    const chips: Chip[] = list.map((f) => ({ label: FLOWS[f].label, value: f, emoji: FLOWS[f].emoji, blurb: `Shows up on ${FLOWS[f].lands}.` }));
    if (!all) chips.push({ label: 'Something else', value: 'all', emoji: '🗂️', blurb: 'Every flow the chat can do, with where each one shows up.' });
    chips.push({ label: 'Nothing now, close the chat', value: 'close' });
    const lines = first
      ? [
          `${characterHello(origin.host)} Tap what you want to log and I will put it in the right place. Each one says where it will show up.`,
          canType
            ? 'Or type below to add or change something. Each change shows here with an Undo.'
            : status.data?.connected
              ? 'Typing below to add or change things is part of a plan. The flows are free.'
              : 'Tap a flow to log something.',
        ]
      : all
        ? ['Here is everything I can take in a chat. Pick one.']
        : ['What next?'];
    say(origin.host, lines, {
      kind: 'chips',
      chips,
      more: 'Each flow asks one or two short questions, then saves the answer the same way the screen would. The points and xp are the same too. Close at any time: anything already saved stays saved.',
      pick: (c) => {
        you(`${c.emoji ? `${c.emoji} ` : ''}${c.label}`);
        if (c.value === 'close') return close();
        if (c.value === 'all') return menu(false, true);
        start(c.value as Flow);
      },
    });
  };

  // Close folds the panel back into its button and keeps the chat, so the next open is where you left it.
  // Start over is what begins it fresh.
  const close = () => onClose();
  const startOver = () => {
    forgetKept(scope);
    setRound((r) => r + 1);
  };

  /** After a save: say where it went, then offer another flow. */
  const done = (f: Flow, lines: string[]) => {
    refresh();
    const meta = FLOWS[f];
    say(meta.host, [...lines, { node: <Landed meta={meta} /> }], {
      kind: 'chips',
      chips: [
        { label: 'Log something else', value: 'more' },
        { label: 'Close the chat', value: 'back' },
      ],
      pick: (c) => {
        you(c.label);
        if (c.value === 'back') close();
        else menu(false);
      },
    });
  };

  /** A save that failed says why and offers the flow again. */
  const failed = (f: Flow, e: unknown) =>
    say(FLOWS[f].host, [`That did not save. ${errorText(e)}`], {
      kind: 'chips',
      chips: [
        { label: 'Try again', value: 'again' },
        { label: 'Pick another', value: 'menu' },
      ],
      pick: (c) => {
        you(c.label);
        if (c.value === 'again') start(f);
        else menu(false);
      },
    });

  const back = (f: Flow, lines: string[], extra: Chip[] = []) =>
    say(FLOWS[f].host, lines, {
      kind: 'chips',
      chips: [...extra, { label: 'Pick another', value: 'menu' }, { label: 'Close the chat', value: 'back' }],
      pick: (c) => {
        you(c.label);
        if (c.value === 'menu') menu(false);
        else if (c.value === 'back') close();
        else if (c.value.startsWith('/')) nav(c.value);
        else start(c.value as Flow);
      },
    });

  const wait = (f: Flow, text: string) => say(FLOWS[f].host, [], { kind: 'wait', text });
  const form = (f: Flow, lines: string[], render: () => ReactNode, more?: string) => say(FLOWS[f].host, lines, { kind: 'form', render, more });

  // ---- the flows

  const start = async (f: Flow) => {
    setFlow(f);
    const meta = FLOWS[f];
    const intro = meta.host === lastHost.current ? `This goes to ${meta.lands}.` : `${characterHello(meta.host)} This goes to ${meta.lands}.`;
    try {
      if (f === 'checkin' || f === 'spark' || f === 'tick' || f === 'notToDoDay' || f === 'notToDo') {
        wait(f, 'Looking at your day');
        const t = await api.today(date);
        if (f === 'checkin') {
          if (t.checkedIn) return back(f, [intro, `You already checked in today. Day ${t.streak} in a row. Come back tomorrow.`]);
          return say(meta.host, [intro, 'Checking in says you showed up today. It pays 10 xp and 10 points, and fifty bonus points every seventh day in a row.'], {
            kind: 'chips',
            chips: [{ label: 'I showed up today', value: 'yes' }, { label: 'Not yet', value: 'no' }],
            pick: async (c) => {
              you(c.label);
              if (c.value === 'no') return menu(false);
              wait(f, 'Checking you in');
              try {
                const r = await api.checkin(date);
                done(f, [r.alreadyCheckedIn ? 'You were already in.' : `Day ${r.streak}. Plus ${r.awarded} xp and ${r.points} points.${r.streakBonus > 0 ? ' Streak bonus too.' : ''}`]);
              } catch (e) {
                failed(f, e);
              }
            },
          });
        }
        if (f === 'spark') {
          const rel = RELATIONSHIP_BY_KEY[t.spark.relationship];
          if (t.spark.done) return back(f, [intro, `Today's small act is done. ${rel.character} is glowing. A new one comes tomorrow.`]);
          return say(meta.host, [intro, `Today's small act is from ${rel.character}, for ${rel.name.toLowerCase()}: "${t.spark.text}"`, 'It takes two minutes and pays 15 xp. Did you do it?'], {
            kind: 'chips',
            chips: [{ label: 'Done', value: 'yes' }, { label: 'Not yet', value: 'no' }],
            pick: async (c) => {
              you(c.label);
              if (c.value === 'no') return back(f, ['Fine. It waits for you on Daily until tonight.']);
              wait(f, 'Saving');
              try {
                const r = await api.spark(date);
                done(f, [r.alreadyDone ? 'It was already marked.' : `Plus ${r.awarded} xp.`]);
              } catch (e) {
                failed(f, e);
              }
            },
          });
        }
        if (f === 'tick') {
          const now = Date.now();
          const ready = t.tasks.filter((n) => (!n.dueDate || n.dueDate <= date) && (!n.readyAt || Date.parse(n.readyAt) <= now));
          const later = t.tasks.length - ready.length;
          if (!ready.length)
            return back(f, [intro, t.tasks.length ? `None of your ${t.tasks.length} tasks can be ticked yet. A task is ticked on its day, and a new one ten minutes after you write it.` : 'No tasks are waiting. Tasks come from the pillars you set up.'], [{ label: 'Add a task', value: 'task' }]);
          return say(meta.host, [intro, `Pick every task you did. Each one is 20 xp and makes its pyramid stronger.${later ? ` ${later} more cannot be ticked yet, so they are not shown.` : ''}`], {
            kind: 'multi',
            chips: ready.map((n) => ({ label: n.title, value: n.id, blurb: RELATIONSHIP_BY_KEY[n.relationship].name })),
            start: [],
            done: 'Tick these',
            pick: async (picked, label) => {
              you(label);
              wait(f, 'Ticking');
              let xp = 0;
              let capped = false;
              try {
                for (const id of picked) {
                  const r = await api.complete(id, date);
                  xp += r.totalXp;
                  capped ||= r.capped;
                }
                done(f, [`${picked.length} ticked, plus ${xp} xp.${capped ? ' You hit the daily xp limit, so some of it was just for you.' : ''}`]);
              } catch (e) {
                refresh();
                failed(f, e);
              }
            },
          });
        }
        if (f === 'notToDoDay') {
          if (!t.notToDo.length) return back(f, [intro, 'Your not to do list is empty. Add the first thing you want to stay away from.'], [{ label: 'Add to the list', value: 'notToDo' }]);
          return form(f, [intro, 'For each one, did you keep away from it today? A kept day is 5 xp and grows its streak. A slip ends the streak, and that is fine. Honest beats perfect.'], () => (
            <NotToDoDayForm
              items={t.notToDo}
              onSend={async (marks, label) => {
                you(label);
                wait(f, 'Saving today');
                try {
                  let xp = 0;
                  for (const [id, status] of Object.entries(marks)) xp += (await api.notToDoDay(id, date, date, status)).awarded;
                  done(f, [xp ? `Plus ${xp} xp for the kept days.` : 'Saved.']);
                } catch (e) {
                  failed(f, e);
                }
              }}
            />
          ));
        }
        // notToDo
        if (t.notToDo.length >= MAX_NOT_TO_DO) return back(f, [intro, `Your list is full at ${MAX_NOT_TO_DO}. Remove one on Daily to add another.`]);
        return form(f, [intro, 'Name one thing to stay away from, in a few words. You can tie it to a pillar it protects.'], () => (
          <NotToDoForm
            onSend={async (v, label) => {
              you(label);
              wait(f, 'Adding');
              try {
                await api.notToDoAdd(v.title, v.relationship);
                done(f, ['On the list. Mark it each day, kept or slipped.']);
              } catch (e) {
                failed(f, e);
              }
            }}
          />
        ));
      }

      if (f === 'routine') {
        wait(f, 'Finding your routine');
        const s = await api.session(date);
        if (!s.routine) return back(f, [intro, 'You have no routine yet. It comes from the strategy session, which builds it from your real day.'], [{ label: 'Run the strategy session', value: '/session' }]);
        const routine = s.routine;
        return say(meta.host, [intro, 'First, what kind of day is it?'], {
          kind: 'chips',
          chips: [
            { label: 'A general day', value: 'general', blurb: 'Your usual day.' },
            { label: 'An exceptional day', value: 'exceptional', blurb: 'Travel, a shoot, a late night. The lighter plan.' },
          ],
          pick: (c) => {
            you(c.label);
            const dayType = c.value as DayType;
            const steps = (dayType === 'general' ? routine.general : routine.exceptional).find((b) => b.key === 'morning')?.steps ?? [];
            if (!steps.length) return back(f, ['That day has no morning steps to tick.']);
            const already = s.today?.dayType === dayType ? s.today.steps : [];
            setMulti(already);
            say(meta.host, ['Pick every morning step you did. The day counts only when all of them are ticked.'], {
              kind: 'multi',
              chips: steps.map((st) => ({ label: st, value: st })),
              start: already,
              done: 'Save my morning',
              pick: async (picked, label) => {
                you(label);
                wait(f, 'Saving');
                try {
                  const r = await api.markRoutineDay({ date, dayType, steps: picked });
                  done(f, [r.today?.done ? `Morning done. ${r.week.done} of 7 this week.` : `${picked.length} of ${steps.length} ticked. Tick the rest to count the day.`]);
                } catch (e) {
                  failed(f, e);
                }
              },
            });
          },
        });
      }

      if (f === 'task' || f === 'layer') {
        wait(f, 'Looking at your pillars');
        const { nodes } = await api.nodes();
        const active = nodes.filter((n) => n.status === 'active');
        if (f === 'task') {
          const withProjects = RELATIONSHIPS.filter((r) => active.some((n) => n.relationship === r.key && n.kind === 'project'));
          if (!withProjects.length) return back(f, [intro, 'A task hangs under a project, and you have no project yet. Add one to a pyramid first.'], [{ label: 'Add to a pyramid', value: 'layer' }]);
          return say(meta.host, [intro, 'Which pillar is it for? Only pillars with a project are shown, because a task moves a project.'], {
            kind: 'chips',
            chips: withProjects.map((r) => ({ label: r.name, value: r.key })),
            pick: (c) => {
              you(c.label);
              const rel = c.value as RelationshipKey;
              const projects = active.filter((n) => n.relationship === rel && n.kind === 'project');
              form(f, [projects.length === 1 ? `It goes under "${projects[0]!.title}". Name the task and its day. A time and a length put it on your day plan.` : 'Pick the project, name the task and its day. A time and a length put it on your day plan.'], () => (
                <TaskForm
                  projects={projects}
                  today={date}
                  onSend={async (v, label) => {
                    you(label);
                    wait(f, 'Adding the task');
                    try {
                      await api.createNode({ kind: 'task', parentId: v.parentId, relationship: rel, title: v.title, dueDate: v.due || null, dueTime: v.time || null, estimateMin: v.minutes });
                      done(f, [v.due === date ? 'It is on Daily now. You can tick it ten minutes from now, once you have done it.' : `It shows up on Daily on ${prettyDate(v.due)}.`]);
                    } catch (e) {
                      failed(f, e);
                    }
                  }}
                />
              ), 'A task can be ticked only on its day, and only ten minutes after you write it. That wait keeps the xp honest.');
            },
          });
        }
        // layer
        return say(meta.host, [intro, 'Which pillar?'], {
          kind: 'chips',
          chips: RELATIONSHIPS.map((r) => ({ label: r.name, value: r.key })),
          pick: (c) => {
            you(c.label);
            const rel = c.value as RelationshipKey;
            const mine = active.filter((n) => n.relationship === rel);
            const open = KINDS.filter((k) => k !== 'task' && (parentKind(k) === null || mine.some((n) => n.kind === parentKind(k))));
            const shut = KINDS.filter((k) => k !== 'task' && !open.includes(k)).length;
            say(meta.host, [`Which layer? A pyramid is built from the foundation${shut ? ', so a layer shows only once the one before it is there' : ''}.`], {
              kind: 'chips',
              chips: open.map((k) => ({ label: KIND_META[k].label, value: k, blurb: KIND_META[k].hint })),
              more: 'Foundation is the one thing you will not let break. A guiding principle keeps it standing. A value goal is how you want to feel. A goal outcome is the result you can see. A project is the work that gets you there, and tasks hang under it.',
              pick: (c2) => {
                you(c2.label);
                const kind = c2.value as NodeKind;
                const up = parentKind(kind);
                const parents = up ? mine.filter((n) => n.kind === up) : [];
                form(f, [`Name the ${KIND_META[kind].label.toLowerCase()}. Short is best.`], () => (
                  <LayerForm
                    kind={kind}
                    parents={parents}
                    onSend={async (v, label) => {
                      you(label);
                      wait(f, 'Adding');
                      try {
                        await api.createNode({ kind, parentId: v.parentId, relationship: rel, title: v.title });
                        done(f, [`Added to ${RELATIONSHIP_BY_KEY[rel].name}.${kind === 'project' ? ' Tasks can hang under it now.' : ''}`]);
                      } catch (e) {
                        failed(f, e);
                      }
                    }}
                  />
                ));
              },
            });
          },
        });
      }

      if (f === 'mood') {
        return say(meta.host, [intro, 'How are you feeling right now? One a day. Logging again replaces it.'], {
          kind: 'chips',
          chips: MOODS.map((m) => ({ label: m.name, value: String(m.value), emoji: m.emoji })),
          pick: async (c) => {
            you(`${c.emoji} ${c.label}`);
            wait(f, 'Logging');
            try {
              await api.log('mood', { date, value: Number(c.value) });
              done(f, [Number(c.value) <= 2 ? 'Thank you for saying it. A low day is still a logged day.' : 'Logged.']);
            } catch (e) {
              failed(f, e);
            }
          },
        });
      }
      if (f === 'stress') {
        return say(meta.host, [intro, 'How tense do you feel today?'], {
          kind: 'chips',
          chips: STRESS_LEVELS.map((s, i) => ({ label: s, value: String(i + 1) })),
          pick: async (c) => {
            you(c.label);
            wait(f, 'Logging');
            try {
              await api.log('stress', { date, value: Number(c.value) });
              done(f, [Number(c.value) >= 4 ? 'Logged. Two minutes of slow breathing helps. Mindful minutes has a timer.' : 'Logged.']);
            } catch (e) {
              failed(f, e);
            }
          },
        });
      }
      if (f === 'sleep') {
        return form(f, [intro, 'How long did you sleep last night, and how did it feel?'], () => (
          <SleepForm
            onSend={async (v, label) => {
              you(label);
              wait(f, 'Logging');
              try {
                await api.log('sleep', { date, value: v.hours, extra: { quality: v.quality } });
                done(f, ['Logged.']);
              } catch (e) {
                failed(f, e);
              }
            }}
          />
        ));
      }
      if (f === 'mindful' || f === 'move') {
        return say(meta.host, [intro, f === 'mindful' ? 'How many minutes of quiet or breathing?' : 'How many minutes did you move: a walk, a run, a workout?'], {
          kind: 'chips',
          chips: (f === 'mindful' ? [2, 5, 10, 20] : [15, 30, 45, 60]).map((m) => ({ label: `${m} minutes`, value: String(m) })),
          pick: async (c) => {
            you(c.label);
            wait(f, 'Logging');
            try {
              await api.log(f, { date, value: Number(c.value), extra: f === 'mindful' ? { kind: 'chat' } : {} });
              done(f, ['Logged.']);
            } catch (e) {
              failed(f, e);
            }
          },
        });
      }
      if (f === 'journal') {
        return form(f, [intro, 'Write it the way you would say it. Nothing here goes to brands, staff or the leaderboard.'], () => (
          <JournalForm
            onSend={async (v, label) => {
              you(label);
              wait(f, 'Saving');
              try {
                await api.createEntry({ title: v.title, body: v.body, emotion: v.emotion });
                done(f, ['Saved in your journal.']);
              } catch (e) {
                failed(f, e);
              }
            }}
          />
        ));
      }
      if (f === 'review') {
        return say(meta.host, [intro, 'Which kind of review? Each one pulls the numbers for its period from every app you use, and saves them next to your words.'], {
          kind: 'chips',
          chips: PERIOD_KINDS.map((k) => ({ label: PERIOD_META[k].name, value: k, blurb: PERIOD_META[k].blurb })),
          pick: (c) => {
            you(c.label);
            const kind = c.value as PeriodKind;
            const now = periodFor(kind, date);
            const before = periodShift(now, -1);
            say(meta.host, ['Which one?'], {
              kind: 'chips',
              chips: [
                { label: `This ${PERIOD_META[kind].short.toLowerCase()}, ${periodLabel(now)}`, value: now.start },
                { label: `The one before, ${periodLabel(before)}`, value: before.start },
              ],
              pick: async (c2) => {
                you(c2.label);
                wait(f, 'Adding up the numbers');
                try {
                  const r = await api.reviews(kind, c2.value);
                  const t = r.templates.find((x) => (r.review ? (r.review.templateId ?? `builtin:${kind}`) === x.id : x.builtIn)) ?? r.templates[0];
                  const s = r.summary.now;
                  const numbers = `For ${periodLabel(r.period)}: ${s.xp} xp, ${s.tasksDone} tasks done, checked in ${s.checkins} of ${s.days} days.`;
                  const write = (prompts: string[], templateId: string | null) =>
                    form(f, [numbers, r.review ? 'You wrote this one before. Your answers are filled in, so change what you like.' : 'Answer what you can. One line each is plenty.'], () => (
                      <ReviewForm
                        prompts={prompts}
                        start={r.review && (r.review.templateId ?? null) === templateId ? r.review : { answers: [], rating: null, highlight: '' }}
                        onSend={async (v, label) => {
                          you(label);
                          wait(f, 'Saving the review');
                          try {
                            await api.saveReview({ kind, date: r.period.start, templateId, answers: v.answers, rating: v.rating, highlight: v.highlight });
                            done(f, ['Saved, with a snapshot of the numbers. A new template or new data never rewrites it.']);
                          } catch (e) {
                            failed(f, e);
                          }
                        }}
                      />
                    ));
                  const custom = r.templates.filter((x) => !x.builtIn && x.kind === kind);
                  if (!custom.length || !t) return write(t?.prompts ?? [], null);
                  say(meta.host, ['You have your own templates for this. Which one?'], {
                    kind: 'chips',
                    chips: r.templates.filter((x) => x.kind === kind).map((x) => ({ label: x.name, value: x.id })),
                    pick: (c3) => {
                      you(c3.label);
                      const chosen = r.templates.find((x) => x.id === c3.value)!;
                      write(r.review && (r.review.templateId ?? `builtin:${kind}`) === chosen.id ? r.review.prompts : chosen.prompts, chosen.builtIn ? null : chosen.id);
                    },
                  });
                } catch (e) {
                  failed(f, e);
                }
              },
            });
          },
        });
      }

      if (f === 'due') {
        return form(f, [intro, 'Who owes whom, how much, and by when. Only you see it.'], () => (
          <DueForm
            today={date}
            onSend={async (v, label) => {
              you(label);
              wait(f, 'Noting it');
              try {
                await api.addDue({ direction: v.direction, counterparty: v.counterparty, amountCents: v.cents, dueDate: v.dueDate, note: v.note || undefined });
                done(f, ['Noted. Settle it here or on Finance once the money moves.']);
              } catch (e) {
                failed(f, e);
              }
            }}
          />
        ));
      }
      if (f === 'settle' || f === 'goalAdd') {
        wait(f, 'Looking at Finance');
        const fin = await api.finance();
        if (f === 'settle') {
          const open = fin.dues.filter((d: FinanceDue) => d.status === 'open');
          if (!open.length) return back(f, [intro, 'Nothing is owed either way right now.'], [{ label: 'Note money owed', value: 'due' }]);
          return say(meta.host, [intro, 'Which one is settled? Settling marks it done. It does not move any money.'], {
            kind: 'chips',
            chips: open.map((d: FinanceDue) => ({ label: `${d.direction === 'owed' ? `${d.counterparty} owes you` : `You owe ${d.counterparty}`} ${money(d.amountCents, d.currency)}`, value: d.id })),
            pick: async (c) => {
              you(c.label);
              wait(f, 'Settling');
              try {
                await api.settleDue(c.value);
                done(f, ['Settled.']);
              } catch (e) {
                failed(f, e);
              }
            },
          });
        }
        if (!fin.goals.length) return back(f, [intro, 'You have no money goal yet.'], [{ label: 'Set a money goal', value: 'goal' }]);
        return say(meta.host, [intro, 'Which goal?'], {
          kind: 'chips',
          chips: fin.goals.map((g: FinanceGoal) => ({ label: g.title, value: g.id, blurb: `${money(g.progressCents, fin.currency)} of ${money(g.targetCents, fin.currency)}` })),
          pick: (c) => {
            you(c.label);
            form(f, ['How much goes towards it?'], () => (
              <AmountForm
                send="Add it"
                onSend={async (cents, label) => {
                  you(label);
                  wait(f, 'Adding');
                  try {
                    await api.addToGoal(c.value, cents);
                    done(f, ['Added. Every bit counts.']);
                  } catch (e) {
                    failed(f, e);
                  }
                }}
              />
            ));
          },
        });
      }
      if (f === 'goal') {
        return form(f, [intro, 'Name it, set the amount, and a date if you have one.'], () => (
          <GoalForm
            today={date}
            onSend={async (v, label) => {
              you(label);
              wait(f, 'Setting the goal');
              try {
                await api.addGoal({ title: v.title, kind: v.kind, targetCents: v.cents, deadline: v.deadline });
                done(f, ['Set. Add to it whenever money goes its way.']);
              } catch (e) {
                failed(f, e);
              }
            }}
          />
        ));
      }
      // money
      return form(f, [intro, 'Money in or out, how much, and what for. Only you see it.'], () => (
        <MoneyForm
          onSend={async (v, label) => {
            you(label);
            wait(f, 'Adding');
            try {
              await api.addTransaction({ kind: v.kind, amountCents: v.cents, category: v.category, counterparty: v.counterparty || undefined, note: v.note || undefined, date });
              done(f, ['Added to this month.']);
            } catch (e) {
              failed(f, e);
            }
          }}
        />
      ));
    } catch (e) {
      failed(f, e);
    }
  };

  useEffect(() => {
    if (started.current || !ready || status.isPending) return;
    started.current = true;
    menu(true);
    // The first menu opens once the apps and the plan are known; later menus are opened by the answers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, round, status.isPending]);

  /** "Tell me more" says the longer line right away and keeps the question, and anything already ticked. */
  const tellMore = (more: string) => {
    const id = (ids.current += 1);
    setLog((l) => [...l, { id, from: 'bot', host, text: more }]);
    setAsk((a) => (a && a.kind !== 'wait' ? { ...a, more: undefined } : a));
  };


  /**
   * A typed line. With a plan it goes to the model, which acts through the app's own routes and answers with what
   * it changed. Without one, a question about a word still gets the plain answer, and anything else gets the plan
   * card. The line is written into the chat as yours either way.
   */
  const send = async (text: string) => {
    clearTimers();
    setFlow(null);
    you(text);
    if (!canType) {
      const answers = isQuestion(text) ? explainTyped(text) : [];
      if (answers.length) return say('bumling', answers, null);
      if (!status.data?.connected) return say('bumling', ['Typing to me is not switched on here yet, because no AI model is connected. You can tap one of the flows instead. They are free and work now.'], null);
      return say('bumling', ['I can do that for you with a plan. Typing to me is part of one; the flows here stay free.', { node: <PlanCard reason="plan" /> }], null);
    }
    // Each earlier reply says what it did as things stand now, so an Undo since then is not news to the model.
    const now = (t: AssistantTurn): AssistantTurn => {
      if (t.role !== 'assistant' || !t.actions?.length) return t;
      const rows = t.actions.map((id) => receipts[id]).filter((r): r is AssistantReceipt => Boolean(r));
      return rows.length ? { ...t, note: rows.map((r) => `${r.status} ${r.tool}: ${r.label}`).join('; ') } : t;
    };
    const before = talk;
    const turns: AssistantTurn[] = [...talk.map(now), { role: 'user' as const, text }].slice(-40);
    setTalk(turns);
    setThinking(true);
    setStopping(false);
    setTyping('bumling');
    const runId = crypto.randomUUID();
    run.current = runId;
    const line = (m: Omit<Msg, 'id'>): Msg => ({ ...m, id: (ids.current += 1) });
    try {
      const r = await api.assistantSend({ messages: turns, runId, context: { path: loc.pathname, date: todayLocal(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }, ...(model ? { model: model.id } : {}) });
      setTalk((t) => [...t, { role: 'assistant' as const, text: r.text, note: r.note, actions: r.receipts.map((x) => x.id) }].slice(-40));
      setReceipts((m) => ({ ...m, ...Object.fromEntries(r.receipts.map((x) => [x.id, x])) }));
      refreshKeys(r.receipts.flatMap((x) => x.refresh));
      setLog((l) => [
        ...l,
        line({ from: 'bot', host: 'bumling', node: <ModelReply text={r.text} model={r.model} /> }),
        ...(r.receipts.length ? [line({ from: 'bot', host: 'bumling', node: <Receipts scope={scope} ids={r.receipts.map((x) => x.id)} /> })] : []),
        ...(r.stopped === 'credits' ? [line({ from: 'bot', host: 'bumling', node: <PlanCard reason="credits" /> })] : []),
      ]);
    } catch (e) {
      // Nothing was done, so the line is not kept for the model either.
      setTalk(before);
      const paywall = e instanceof ApiError ? (e.data.paywall as AssistantPaywall | undefined) : undefined;
      setLog((l) => [
        ...l,
        line({ from: 'bot', host: 'bumling', text: paywall ? errorText(e) : `That did not go through. ${errorText(e)}` }),
        ...(paywall ? [line({ from: 'bot', host: 'bumling', node: <PlanCard reason={paywall} /> })] : []),
      ]);
    } finally {
      setTyping(null);
      setThinking(false);
      setStopping(false);
      run.current = null;
      refreshKeys([]);
    }
  };

  /**
   * Stop the message on its way. The request is not cut off: the server ends before its next model call or tool and
   * answers with whatever it had already done, each with its Undo, so nothing done goes unseen.
   */
  const stop = () => {
    const id = run.current;
    if (!id || stopping) return;
    setStopping(true);
    setLog((l) => [...l, { id: (ids.current += 1), from: 'bot', host: 'bumling', text: 'Stopping after this step. Anything already done stays, with an Undo.' }]);
    void api.assistantStop(id).catch(() => setStopping(false));
  };

  // The conversation scrolls in its own box. Each new turn is lifted to the top of it, and the last turn is at
  // least as tall as the box so the lift always has room.
  const lastTurn = useRef<HTMLElement>(null);
  const [room, setRoom] = useState(240);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setRoom(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useChatMotion({ count: countTurns(log), lines: log.length, lastTurn, root: box, scroller: box });

  // The panel rises out of its button.
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;
    if (reduce) gsap.set(el, { opacity: 1, y: 0 });
    else gsap.fromTo(el, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });
  }, [reduce]);

  // The small link is only for asks that do not already offer the list as a choice.
  const offersMenu = Boolean(ask && ask.kind === 'chips' && ask.chips.some((c) => c.value === 'menu' || c.value === 'more' || c.value === 'all'));
  const showMenuLink = log.length > 2 && !offersMenu;
  const answer = (() => {
    if (!ask) {
      if (log.length < 2 || typing) return null;
      return (
        <ChatLinks
          items={[
            {
              label: 'Show the flows',
              onClick: () => {
                you('Show the flows');
                menu(false);
              },
            },
          ]}
        />
      );
    }
    if (ask.kind === 'wait') {
      return (
        <p role="status" className="m-0 text-[14px] font-bold text-ink-soft">
          {ask.text}
        </p>
      );
    }
    const body =
      ask.kind === 'chips' ? (
        <ChoiceChips choices={ask.chips} onPick={(c) => ask.pick(c)} />
      ) : ask.kind === 'multi' ? (
        <ChoiceGroups groups={[{ choices: ask.chips }]} picked={multi} onPicked={setMulti} done={ask.done} onDone={(values, labels) => ask.pick(values, labels.join(', '))} />
      ) : (
        <div data-form>{ask.render()}</div>
      );
    const links = [
      ...(ask.more ? [{ label: 'Tell me more', onClick: () => tellMore(ask.more!) }] : []),
      ...(showMenuLink
        ? [
            {
              label: 'Pick another',
              onClick: () => {
                you('Pick another');
                menu(false);
              },
            },
          ]
        : []),
    ];
    return (
      <>
        {body}
        <ChatLinks items={links} />
      </>
    );
  })();

  const credits = !status.data ? '' : !status.data.connected ? 'Tap a flow to log something' : !account || account.plan === 'none' ? 'Typing needs a plan' : `${account.planName} · ${account.total.toLocaleString('en-US')} credits left`;

  return (
    <section
      ref={panel}
      aria-label={`Bumling AI assistant, with ${who(host)}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className="fixed inset-x-sm bottom-[calc(var(--spacing-xl)+var(--spacing-sm)+env(safe-area-inset-bottom))] z-40 flex h-[max(50dvh,320px)] flex-col overflow-hidden rounded-card border-2 border-line bg-card-strong shadow-toy-soft md:left-auto md:right-md md:bottom-md md:h-[min(640px,calc(100dvh-32px))] md:w-[400px]"
    >
      <header className="flex items-center gap-xs border-b-2 border-line py-xs pr-sm pl-md">
        {/* The name and the line under it wrap on a narrow phone rather than being cut short. */}
        <div className="min-w-0 flex-1 break-words">
          <p className="m-0 text-[14px] font-extrabold leading-snug">Bumling AI assistant</p>
          <p className="m-0 text-[12px] font-bold leading-snug text-ink-soft">{flow ? FLOWS[flow].label : credits}</p>
        </div>
        {log.length > 2 && <StartOver onConfirm={startOver} />}
        <CloseButton onClose={onClose} />
      </header>
      {status.data?.connected && models.length > 1 && model && (
        <div className="border-b-2 border-line px-md py-xs">
          {/* The picker sits beside "Model" when there is room for its longest name, and on a line of its own when not. */}
          <label className="flex flex-wrap items-center gap-xs text-[12px] font-bold text-ink-soft">
            <span className="shrink-0">Model</span>
            <select value={model.id} onChange={(e) => setPicked(e.target.value)} disabled={thinking} className="min-h-[32px] min-w-0 flex-1 basis-[240px] rounded-pill border-2 border-line bg-card px-xs text-[12px] font-bold text-ink">
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}, {m.by}
                  {m.private ? ', keeps nothing' : ''}
                </option>
              ))}
            </select>
          </label>
          <p className="m-0 mt-xs text-[12px] font-semibold text-ink-soft">
            {!canType ? 'Needs a plan. ' : ''}
            {model.private ? 'Keeps nothing you send.' : 'May keep what you type, so your journal stays out.'}
          </p>
        </div>
      )}
      <div ref={box} className="min-h-0 flex-1 overflow-y-auto px-md" aria-live="polite">
        <ChatTurns log={log} typing={typing} answer={answer} answerKey={`${log.filter((m) => m.from === 'you').length}:${ask?.kind ?? ''}`} room={`${room}px`} lastTurn={lastTurn} />
      </div>
      <div className="border-t-2 border-line p-xs">
        <ChatComposer placeholder={canType ? 'Add or change something' : status.data?.connected ? 'Needs a plan' : 'Ask what something means'} onStop={thinking ? stop : undefined} stopping={stopping} onSend={(t) => void send(t)} disabled={thinking || ask?.kind === 'wait'} maxLength={2000} />
      </div>
    </section>
  );
}

const INVITE_GAP_MS = 60_000;
let lastInvite = 0;

/**
 * The round button at the bottom right, on every screen inside the app: above the tab bar on a phone, in the
 * corner on a laptop. Bumling sits in it, bobbing and blinking, and gives a small hop every few seconds; pointing at
 * it (or reaching it with the keyboard) makes him jump and brings up "Chat with AI assistant" above it; a phone has no
 * hover, so there both play on their own when a screen opens, at most once a minute. It opens the
 * panel over the page. Hidden on the Companion, which is a chat of its own, and when the team has switched the
 * assistant off. Motion is GSAP; with reduced motion he stays put and the bubble just appears.
 */
export function Assistant() {
  const me = useMe();
  const loc = useLocation();
  const mod = useModule('assistant');
  const [open, setOpen] = useKept(`assistant-open:${me.data?.user.id ?? 'none'}`, 'open', false);
  const button = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [eager, setEager] = useState(false);
  const reduce = useReducedMotion();

  // He pops in, then every few seconds gives a little hop and a wiggle, so the button reads as someone to talk to.
  useLayoutEffect(() => {
    const el = button.current;
    const him = body.current;
    if (!el || !him) return;
    if (reduce) {
      gsap.set(el, { scale: 1, opacity: 1 });
      gsap.set(him, { y: 0, rotation: 0 });
      return;
    }
    // Once in, the inline transform goes, so the button's own hover lift (the toy class) works again.
    gsap.fromTo(el, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2.2)', onComplete: () => void gsap.set(el, { clearProps: 'transform,opacity' }) });
    const idle = gsap
      .timeline({ repeat: -1, repeatDelay: 5, delay: 2 })
      .to(him, { y: -7, duration: 0.18, ease: 'power2.out' })
      .to(him, { y: 0, duration: 0.32, ease: 'bounce.out' })
      .to(him, { rotation: -10, duration: 0.1, ease: 'sine.inOut' }, '-=0.1')
      .to(him, { rotation: 8, duration: 0.12, ease: 'sine.inOut' })
      .to(him, { rotation: 0, duration: 0.14, ease: 'sine.out' });
    return () => {
      idle.kill();
    };
  }, [open, reduce]);

  /** The bubble above the button, and his jump, when a mouse points at it or the keyboard reaches it. */
  const point = (on: boolean) => {
    setEager(on);
    const t = tip.current;
    const him = body.current;
    if (!t || !him) return;
    if (reduce) {
      gsap.set(t, { autoAlpha: on ? 1 : 0, y: 0 });
      return;
    }
    gsap.to(t, { autoAlpha: on ? 1 : 0, y: on ? 0 : 6, duration: 0.2, ease: 'power2.out', overwrite: true });
    if (on) gsap.fromTo(him, { y: 0, scale: 1 }, { y: -6, scale: 1.08, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 1, overwrite: 'auto' });
  };

  // A phone has no hover, so there the jump and the bubble play on their own a moment after a screen opens, at most once a minute.
  const available = Boolean(mod?.available);
  useEffect(() => {
    if (open || !available || !window.matchMedia('(hover: none)').matches) return;
    if (Date.now() - lastInvite < INVITE_GAP_MS) return;
    const show = window.setTimeout(() => {
      lastInvite = Date.now();
      point(true);
    }, 1200);
    const hide = window.setTimeout(() => point(false), 4200);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, available, loc.pathname]);

  if (!mod?.available || loc.pathname.startsWith('/companion')) return null;
  if (open) return <AssistantPanel onClose={() => setOpen(false)} />;
  return (
    <div className="fixed right-md bottom-[calc(var(--spacing-xl)+var(--spacing-md)+env(safe-area-inset-bottom))] z-40 md:bottom-md">
      <span
        ref={tip}
        id="assistant-tip"
        role="tooltip"
        className="tip-card pointer-events-none absolute right-0 bottom-full mb-sm whitespace-nowrap rounded-pill border border-line px-sm py-xs text-[14px] font-bold shadow-toy-soft"
        style={{ opacity: 0, visibility: 'hidden' }}
      >
        Chat with AI assistant
        <span aria-hidden="true" className="tip-card absolute top-full right-[22px] -mt-[5px] size-[10px] rotate-45 border-r border-b border-line" />
      </span>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(true)}
        onPointerEnter={(e) => e.pointerType !== 'touch' && point(true)}
        onPointerLeave={() => point(false)}
        onFocus={(e) => e.currentTarget.matches(':focus-visible') && point(true)}
        onBlur={() => point(false)}
        aria-label="Open the assistant"
        aria-describedby="assistant-tip"
        className="toy toy-soft flex size-[60px] items-center justify-center rounded-pill border-2 border-line bg-card"
      >
        <span ref={body} className="flex" aria-hidden="true">
          <Avatar relationship="bumling" size={40} mood={eager ? 'excited' : 'happy'} decorative />
        </span>
      </button>
    </div>
  );
}
