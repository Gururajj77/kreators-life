import {
  DISCOVER_CORE_STEPS,
  DISCOVER_SCENES,
  EQ_DIMS,
  EQ_FEELINGS,
  EQ_PEOPLE,
  EQ_READING,
  EQ_SCALE,
  puzzleAt,
  DISCOVER_SECTIONS,
  DISCOVER_STATEMENTS,
  DISCOVER_STEPS,
  DISCOVER_STRENGTHS,
  analyseDiscover,
  DISCOVER_TRIADS,
  DISCOVER_WORDS,
  RELATIONSHIP_BY_KEY,
  TRAITS,
  discoverProgress,
  emptyDiscoverAnswers,
  type DiscoverAnswers,
  type DiscoverPuzzle,
  type PuzzleKind,
  type DiscoverResult,
  type PuzzleCell,
} from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { StatTile } from '../components/Charts';
import { HeroBlobs } from '../components/Hero';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { Toggle } from '../components/Toggle';
import { useParamState } from '../lib/useParamState';
import { api } from '../lib/api';
import { useDiscover, useRefreshAll } from '../lib/queries';

/** Every step of the quiz in order, with where its answer lives. */
interface Step {
  section: number;
  /** Position inside its part. */
  at: number;
  /** Index into the answers of its kind. */
  i: number;
}
const STEPS: Step[] = (() => {
  const out: Step[] = [];
  DISCOVER_SECTIONS.forEach((s, section) => {
    const base = s.key === 'puzzles2' ? 6 : 0;
    for (let at = 0; at < s.count; at += 1) out.push({ section, at, i: base + at });
  });
  return out;
})();

const fillOf = (color: string): CSSProperties => ({ background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 72%, var(--fill-shade)))` });

/** A round pick button. role radio so a screen reader hears "least like you, not selected". */
function Pick({ on, label, tone, onClick }: { on: boolean; label: string; tone: 'least' | 'most'; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} aria-label={label} onClick={onClick} className="flex size-[44px] shrink-0 items-center justify-center rounded-pill">
      <span
        className="flex size-[24px] items-center justify-center rounded-pill border-2 transition-colors"
        style={{ borderColor: on ? (tone === 'most' ? 'var(--color-r4)' : 'var(--color-r2)') : 'var(--color-line)', background: on ? (tone === 'most' ? 'var(--color-r4)' : 'var(--color-r2)') : 'transparent' }}
      >
        {on && <span className="size-[8px] rounded-pill bg-white" />}
      </span>
    </button>
  );
}

function Head({ least, most }: { least: string; most: string }) {
  return (
    <div className="grid items-end gap-xs text-center text-[12px] font-extrabold" style={{ gridTemplateColumns: '64px 1fr 64px' }}>
      <span style={{ color: 'var(--color-r2)' }}>
        Choose
        <br />
        {least}
      </span>
      <span />
      <span style={{ color: 'var(--color-r4)' }}>
        Choose
        <br />
        {most}
      </span>
    </div>
  );
}

function Triad({ index, value, onChange }: { index: number; value: { most: number; least: number } | null; onChange: (v: { most: number; least: number } | null) => void }) {
  const ids = DISCOVER_TRIADS[index]!;
  // A half-made pick is kept here; the parent gets the answer once both are set.
  const [half, setHalf] = useState<{ most: number; least: number }>({ most: value?.most ?? -1, least: value?.least ?? -1 });
  const choose = (row: number, side: 'most' | 'least') => {
    const next = { ...half, [side]: row } as { most: number; least: number };
    const other = side === 'most' ? 'least' : 'most';
    // A row cannot be both. If the other pick was on this row, the two swap places, so a slip never costs an answer.
    if (next[other] === row) next[other] = half[side];
    setHalf(next);
    onChange(next.most >= 0 && next.least >= 0 ? { most: next.most, least: next.least } : null);
  };
  return (
    <div role="group" aria-label="Pick the statement most like you and the one least like you" className="flex flex-col gap-xs">
      <Head least="LEAST LIKE YOU" most="MOST LIKE YOU" />
      {ids.map((id, row) => (
        <div key={id} className="grid items-center gap-xs rounded-tile bg-card p-xs shadow-toy-soft" style={{ gridTemplateColumns: '44px 1fr 44px' }}>
          <Pick on={half.least === row} tone="least" label={`Least like you: ${DISCOVER_STATEMENTS[id]!.text}`} onClick={() => choose(row, 'least')} />
          <span className="text-center text-[16px] font-semibold">{DISCOVER_STATEMENTS[id]!.text}</span>
          <Pick on={half.most === row} tone="most" label={`Most like you: ${DISCOVER_STATEMENTS[id]!.text}`} onClick={() => choose(row, 'most')} />
        </div>
      ))}
    </div>
  );
}

function Words({ index, value, onChange }: { index: number; value: { most: number[]; least: number[] } | null; onChange: (v: { most: number[]; least: number[] } | null) => void }) {
  const list = DISCOVER_WORDS[index]!;
  const [most, setMost] = useState<number[]>(value?.most ?? []);
  const [least, setLeast] = useState<number[]>(value?.least ?? []);
  useEffect(() => {
    setMost(value?.most ?? []);
    setLeast(value?.least ?? []);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = (m: number[], l: number[]) => {
    setMost(m);
    setLeast(l);
    onChange(m.length === 3 && l.length === 3 ? { most: m, least: l } : null);
  };
  const toggle = (k: number, side: 'most' | 'least') => {
    let m = most;
    let l = least;
    const mine = side === 'most' ? m : l;
    if (mine.includes(k)) {
      if (side === 'most') m = m.filter((x) => x !== k);
      else l = l.filter((x) => x !== k);
    } else if (mine.length < 3) {
      if (side === 'most') {
        m = [...m, k];
        l = l.filter((x) => x !== k);
      } else {
        l = [...l, k];
        m = m.filter((x) => x !== k);
      }
    }
    commit(m, l);
  };
  return (
    <div role="group" aria-label="Pick three words most like you and three least like you" className="flex flex-col gap-xs">
      <Head least="THREE LEAST LIKE YOU" most="THREE MOST LIKE YOU" />
      {list.map((w, k) => (
        <div key={w.text} className="grid items-center gap-xs rounded-tile bg-card p-xs shadow-toy-soft" style={{ gridTemplateColumns: '44px 1fr 44px' }}>
          <Pick on={least.includes(k)} tone="least" label={`Least like you: ${w.text}`} onClick={() => toggle(k, 'least')} />
          <span className="text-center text-[16px] font-bold">{w.text}</span>
          <Pick on={most.includes(k)} tone="most" label={`Most like you: ${w.text}`} onClick={() => toggle(k, 'most')} />
        </div>
      ))}
      <p className="m-0 text-center text-[12px] font-bold text-ink-soft" role="status">
        {least.length} of 3 least, {most.length} of 3 most. Tap a pick again to take it back.
      </p>
    </div>
  );
}

function Scene({ scene: s, value, onChange }: { scene: { situation: string; options: readonly string[] }; value: { most: number; least: number } | null; onChange: (v: { most: number; least: number } | null) => void }) {
  const [half, setHalf] = useState<{ most: number; least: number }>({ most: value?.most ?? -1, least: value?.least ?? -1 });
  const choose = (row: number, side: 'most' | 'least') => {
    const next = { ...half, [side]: row } as { most: number; least: number };
    const other = side === 'most' ? 'least' : 'most';
    // A row cannot be both. If the other pick was on this row, the two swap places, so a slip never costs an answer.
    if (next[other] === row) next[other] = half[side];
    setHalf(next);
    onChange(next.most >= 0 && next.least >= 0 ? { most: next.most, least: next.least } : null);
  };
  return (
    <div role="group" aria-label="Pick the most and the least effective response" className="flex flex-col gap-xs">
      <p className="m-0 rounded-tile bg-card p-sm text-[16px] font-semibold shadow-toy-soft">{s.situation}</p>
      <Head least="LEAST EFFECTIVE" most="MOST EFFECTIVE" />
      {s.options.map((o, row) => (
        <div key={o} className="grid items-center gap-xs rounded-tile bg-card p-xs shadow-toy-soft" style={{ gridTemplateColumns: '44px 1fr 44px' }}>
          <Pick on={half.least === row} tone="least" label={`Least effective: ${o}`} onClick={() => choose(row, 'least')} />
          <span className="text-center text-[14px] font-semibold">{o}</span>
          <Pick on={half.most === row} tone="most" label={`Most effective: ${o}`} onClick={() => choose(row, 'most')} />
        </div>
      ))}
    </div>
  );
}

// ---- puzzles ----

const PIPS: Record<number, [number, number][]> = {
  1: [[30, 30]],
  2: [[18, 18], [42, 42]],
  3: [[18, 18], [30, 30], [42, 42]],
  4: [[18, 18], [42, 18], [18, 42], [42, 42]],
  5: [[18, 18], [42, 18], [30, 30], [18, 42], [42, 42]],
  6: [[18, 16], [42, 16], [18, 30], [42, 30], [18, 44], [42, 44]],
};

function CellArt({ kind, cell, tone }: { kind: PuzzleKind; cell: PuzzleCell | null; tone: string }) {
  if (!cell) {
    return (
      <svg viewBox="0 0 60 60" className="size-full" aria-label="The missing piece">
        <rect x="4" y="4" width="52" height="52" rx="10" fill="var(--color-paper)" stroke="var(--color-line)" strokeWidth="2" strokeDasharray="5 4" />
        <text x="30" y="40" textAnchor="middle" fontSize="28" fontWeight="800" fill="var(--color-ink-soft)">?</text>
      </svg>
    );
  }
  if (kind === 'numbers')
    return (
      <svg viewBox="0 0 60 60" className="size-full" role="img" aria-label={`The number ${cell.text}`}>
        <rect x="4" y="4" width="52" height="52" rx="10" fill={tone} />
        <text x="30" y="39" textAnchor="middle" fontSize={(cell.text ?? '').length > 2 ? 20 : 26} fontWeight="800" fill="var(--color-on-fill)">{cell.text}</text>
      </svg>
    );
  if (kind === 'dice' || kind === 'odd')
    return (
      <svg viewBox="0 0 60 60" className="size-full" role="img" aria-label={`${cell.n} dots`}>
        <rect x="4" y="4" width="52" height="52" rx="10" fill={tone} />
        {PIPS[cell.n ?? 1]!.map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="4.5" fill="var(--color-on-fill)" />
        ))}
      </svg>
    );
  if (kind === 'turn')
    return (
      <svg viewBox="0 0 60 60" className="size-full" role="img" aria-label={`An arrow turned ${(cell.rot ?? 0) * 90} degrees with ${cell.dots} dots`}>
        <rect x="4" y="4" width="52" height="52" rx="10" fill={tone} />
        <g transform={`rotate(${(cell.rot ?? 0) * 90} 30 28)`}>
          <path d="M30 10 L44 36 H16 Z" fill="var(--color-on-fill)" />
        </g>
        {Array.from({ length: cell.dots ?? 1 }, (_, k) => (
          <circle key={k} cx={30 + (k - ((cell.dots ?? 1) - 1) / 2) * 8} cy="48" r="2.6" fill="var(--color-on-fill)" />
        ))}
      </svg>
    );
  return (
    <svg viewBox="0 0 60 60" className="size-full" role="img" aria-label="A pattern of squares">
      <rect x="2" y="2" width="56" height="56" rx="10" fill="var(--color-card-strong)" stroke="var(--color-line)" strokeWidth="2" />
      {Array.from({ length: 9 }, (_, b) => (
        <rect key={b} x={9 + (b % 3) * 15} y={9 + Math.floor(b / 3) * 15} width="13" height="13" rx="3" fill={((cell.mask ?? 0) >> b) & 1 ? tone : 'var(--color-line)'} opacity={((cell.mask ?? 0) >> b) & 1 ? 1 : 0.5} />
      ))}
    </svg>
  );
}

function Puzzle({ puzzle: p, index, value, onChange }: { puzzle: DiscoverPuzzle; index: number; value: number | null; onChange: (v: number, ms: number) => void }) {
  const tone = ['var(--color-r2)', 'var(--color-r4)', 'var(--color-r5)', 'var(--color-r6)', 'var(--color-r1)'][index % 5]!;
  const size = p.cols >= 5 ? 52 : 72;
  const started = useRef(performance.now());
  return (
    <div className="flex flex-col items-center gap-sm">
      {p.cells.length > 0 && (
        <>
          <p className="m-0 text-center text-[14px] font-bold text-ink-soft">Look over the picture.</p>
          <div className="grid gap-xs rounded-card bg-card p-sm shadow-toy-soft" style={{ gridTemplateColumns: `repeat(${p.cols}, ${size}px)` }}>
            {p.cells.map((c, k) => (
              <div key={k} style={{ width: size, height: size }}>
                <CellArt kind={p.kind} cell={c} tone={tone} />
              </div>
            ))}
          </div>
        </>
      )}
      <p className="m-0 text-center text-[14px] font-bold">{p.prompt}</p>
      <div role="radiogroup" aria-label="The pieces to choose from" className="flex flex-wrap justify-center gap-xs">
        {p.options.map((o, k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value === k}
            aria-label={`Piece ${k + 1}`}
            onClick={() => onChange(k, Math.round(performance.now() - started.current))}
            className="toy rounded-tile border-2 bg-card p-xs"
            style={{ width: 72, height: 72, borderColor: value === k ? 'var(--color-ink)' : 'var(--color-line)' }}
          >
            <CellArt kind={p.kind === 'odd' ? 'odd' : p.kind} cell={o} tone={tone} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** A screen of statements to rate from "not like me" to "very like me". */
function Feelings({ index, value, onChange }: { index: number; value: number[] | null; onChange: (v: number[] | null) => void }) {
  const items = EQ_FEELINGS[index]!;
  const [rates, setRates] = useState<number[]>(value ?? items.map(() => -1));
  const rate = (k: number, v: number) => {
    const next = rates.map((x, j) => (j === k ? v : x));
    setRates(next);
    onChange(next.every((x) => x >= 0) ? next : null);
  };
  return (
    <div role="group" aria-label="Rate each line from not like me to very like me" className="flex flex-col gap-xs">
      <div className="flex justify-between gap-sm px-xs text-[12px] font-extrabold text-ink-soft">
        <span>{EQ_SCALE[0]}</span>
        <span>{EQ_SCALE[4]}</span>
      </div>
      {items.map((it, k) => (
        <div key={it.text} className="rounded-tile bg-card p-sm shadow-toy-soft">
          <p className="m-0 text-center text-[16px] font-semibold">{it.text}</p>
          <div role="radiogroup" aria-label={it.text} className="mt-xs flex justify-center gap-xs">
            {EQ_SCALE.map((label, v) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={rates[k] === v}
                aria-label={`${label}: ${it.text}`}
                onClick={() => rate(k, v)}
                className="flex size-[44px] items-center justify-center rounded-pill border-2 text-[14px] font-extrabold transition-colors"
                style={{ borderColor: rates[k] === v ? 'var(--color-r4)' : 'var(--color-line)', background: rates[k] === v ? 'var(--color-r4)' : 'transparent', color: rates[k] === v ? 'var(--color-on-fill)' : 'var(--color-ink)' }}
              >
                {v + 1}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A short scene: pick the feeling that fits. */
function Reading({ index, value, onChange }: { index: number; value: number | null; onChange: (v: number) => void }) {
  const q = EQ_READING[index]!;
  return (
    <div role="radiogroup" aria-label="Pick the feeling that fits" className="flex flex-col gap-xs">
      <p className="m-0 rounded-tile bg-card p-sm text-[16px] font-semibold shadow-toy-soft">{q.scene}</p>
      <p className="m-0 text-center text-[14px] font-bold">What is the person feeling?</p>
      {q.options.map((o, k) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className="toy min-h-[48px] rounded-tile border-2 bg-card px-sm text-center text-[16px] font-bold"
          style={{ borderColor: value === k ? 'var(--color-ink)' : 'var(--color-line)' }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// ---- the quiz ----

function Segmented({ answers, at }: { answers: DiscoverAnswers; at: number }) {
  const prog = discoverProgress(answers);
  return (
    <div className="mt-sm flex gap-xs" role="progressbar" aria-valuemin={0} aria-valuemax={DISCOVER_STEPS} aria-valuenow={prog.done} aria-label={`${prog.done} of ${DISCOVER_STEPS} answered`}>
      {DISCOVER_SECTIONS.map((s, k) => {
        const p = prog.parts[k]!;
        const here = STEPS[at]?.section === k;
        return (
          <span key={s.key} className="relative h-[8px] flex-1 overflow-hidden rounded-pill" style={{ background: 'var(--color-line)', outline: here ? '2px solid var(--color-ink)' : 'none', outlineOffset: 1 }}>
            <span className="absolute inset-y-0 left-0 rounded-pill" style={{ width: `${(p.done / p.count) * 100}%`, background: 'var(--color-r4)' }} />
          </span>
        );
      })}
    </div>
  );
}

function stepAnswered(a: DiscoverAnswers, st: Step): boolean {
  const key = DISCOVER_SECTIONS[st.section]!.key;
  if (key === 'priorities') return a.triads[st.i] !== null;
  if (key === 'words') return a.words[st.i] !== null;
  if (key === 'scenes') return a.scenes[st.i] !== null;
  if (key === 'feelings') return a.feelings[st.i] !== null;
  if (key === 'reading') return a.reading[st.i] !== null;
  if (key === 'people') return a.people[st.i] !== null;
  return a.puzzles[st.i] !== null;
}

function Quiz({ answers, setAnswers, onLeave, onDone, busy, error }: { answers: DiscoverAnswers; setAnswers: (a: DiscoverAnswers) => void; onLeave: () => void; onDone: () => void; busy: boolean; error: string | null }) {
  const firstOpen = STEPS.findIndex((st) => !stepAnswered(answers, st));
  const [at, setAt] = useState(firstOpen === -1 ? STEPS.length - 1 : firstOpen);
  const [intro, setIntro] = useState<number | null>(STEPS[firstOpen === -1 ? 0 : firstOpen]!.at === 0 ? STEPS[firstOpen === -1 ? 0 : firstOpen]!.section : null);
  const top = useRef<HTMLDivElement>(null);
  const st = STEPS[at]!;
  const sec = DISCOVER_SECTIONS[st.section]!;
  const last = at === STEPS.length - 1;
  const coreLast = at === DISCOVER_CORE_STEPS - 1;
  const eqStarted = answers.feelings.some(Boolean) || answers.reading.some((x) => x !== null) || answers.people.some(Boolean);
  // After the core parts the quiz can end, or carry on into emotional intelligence.
  const [gate, setGate] = useState(false);
  const ready = stepAnswered(answers, st);

  const go = (to: number) => {
    setAt(to);
    const s = STEPS[to]!;
    setIntro(s.at === 0 && to > at ? s.section : null);
    top.current?.scrollIntoView({ block: 'start' });
  };
  // A puzzle depends on the answers before it, so changing an earlier pick clears the ones after it.
  const setPuzzle = (i: number, v: number, ms: number) => {
    const changed = answers.puzzles[i] !== v;
    const puzzles = answers.puzzles.map((x, j) => (j > i && changed ? null : j === i ? v : x));
    const puzzleMs = answers.puzzleMs.map((x, j) => (j > i && changed ? null : j === i ? (changed || x === null ? ms : x) : x));
    setAnswers({ ...answers, puzzles, puzzleMs });
  };
  const set = <K extends keyof DiscoverAnswers>(k: K, i: number, v: DiscoverAnswers[K][number]) => {
    const copy = { ...answers, [k]: [...answers[k]] } as DiscoverAnswers;
    (copy[k] as unknown[])[i] = v;
    setAnswers(copy);
  };

  let body: ReactNode;
  if (intro !== null) {
    const s = DISCOVER_SECTIONS[intro]!;
    body = (
      <div className="rounded-card bg-card p-md shadow-toy-soft">
        <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">Part {intro + 1} of {DISCOVER_SECTIONS.length}</p>
        <h2 className="mt-xs text-[24px]">{s.name}</h2>
        <span className="mt-xs inline-block rounded-pill bg-paper px-sm text-[12px] font-extrabold">{s.count} questions</span>
        <p className="mt-sm m-0 text-[16px] font-semibold">{s.blurb}</p>
        <Button className="mt-md" onClick={() => setIntro(null)}>
          Start this part
        </Button>
      </div>
    );
  } else if (gate) {
    body = (
      <div className="rounded-card bg-card p-md shadow-toy-soft">
        <h2 className="text-[24px]">Your strengths are ready</h2>
        <p className="mt-sm m-0 text-[16px] font-semibold">You can see them now. Or go further and add the emotional intelligence part: how you handle your feelings, read people and work through situations with them. It adds a detailed read, and you can do it later.</p>
        <div className="mt-md flex flex-col gap-xs">
          <Button onClick={() => { setGate(false); go(at + 1); }}>Add emotional intelligence</Button>
          <Button variant="outline" onClick={onDone} disabled={busy}>{busy ? 'Working it out' : 'See my strengths now'}</Button>
          <Button variant="ghost" onClick={() => setGate(false)}>Go back</Button>
        </div>
      </div>
    );
  } else if (sec.key === 'priorities') body = <Triad key={st.i} index={st.i} value={answers.triads[st.i] ?? null} onChange={(v) => set('triads', st.i, v)} />;
  else if (sec.key === 'words') body = <Words key={st.i} index={st.i} value={answers.words[st.i] ?? null} onChange={(v) => set('words', st.i, v)} />;
  else if (sec.key === 'scenes') body = <Scene key={`s${st.i}`} scene={DISCOVER_SCENES[st.i]!} value={answers.scenes[st.i] ?? null} onChange={(v) => set('scenes', st.i, v)} />;
  else if (sec.key === 'people') body = <Scene key={`p${st.i}`} scene={EQ_PEOPLE[st.i]!} value={answers.people[st.i] ?? null} onChange={(v) => set('people', st.i, v)} />;
  else if (sec.key === 'feelings') body = <Feelings key={st.i} index={st.i} value={answers.feelings[st.i] ?? null} onChange={(v) => set('feelings', st.i, v)} />;
  else if (sec.key === 'reading') body = <Reading key={st.i} index={st.i} value={answers.reading[st.i] ?? null} onChange={(v) => set('reading', st.i, v)} />;
  else body = <Puzzle key={`z${st.i}-${answers.puzzles.slice(0, st.i).join('')}`} puzzle={puzzleAt(answers.puzzles, st.i)} index={st.i} value={answers.puzzles[st.i] ?? null} onChange={(v, ms) => setPuzzle(st.i, v, ms)} />;

  return (
    <>
      <header ref={top} className="focus-dimmable pt-lg">
        <button type="button" onClick={onLeave} className="text-[14px] font-bold text-ink-soft underline underline-offset-4">
          Save and leave
        </button>
        <h1 className="mt-xs text-[24px]">{sec.name}</h1>
        <p className="m-0 text-[14px] font-bold text-ink-soft">
          {gate ? 'Core parts done' : intro === null ? `Question ${st.at + 1} of ${sec.count}${sec.optional ? ', optional' : ''}` : 'Before you start'}
        </p>
        <Segmented answers={answers} at={at} />
      </header>
      <div className="focus-target mt-md">{body}</div>
      {error && (
        <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          {error}
        </p>
      )}
      {intro === null && !gate && (
        <div className="mt-md flex items-center justify-between gap-sm">
          <Button variant="outline" onClick={() => go(at - 1)} disabled={at === 0}>
            Back
          </Button>
          {last ? (
            <Button onClick={onDone} disabled={!ready || busy}>
              {busy ? 'Working it out' : 'See my strengths'}
            </Button>
          ) : (
            <Button onClick={() => (coreLast && !eqStarted ? setGate(true) : go(at + 1))} disabled={!ready}>
              Next
            </Button>
          )}
        </div>
      )}
    </>
  );
}

// ---- the result ----

function TraitBar({ name, low, high, value }: { name: string; low: string; high: string; value: number }) {
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="flex items-baseline justify-between gap-sm">
        <span className="text-[16px] font-bold">{name}</span>
        <span className="font-display text-[20px] font-extrabold">{value}</span>
      </div>
      <div className="relative mt-xs h-[8px] rounded-pill" style={{ background: 'var(--color-line)' }} role="img" aria-label={`${name}: ${value} out of 100`}>
        <span className="absolute inset-y-0 left-0 rounded-pill" style={{ width: `${value}%`, background: 'var(--color-r4)' }} />
      </div>
      <div className="mt-xs flex justify-between gap-sm text-[12px] font-semibold text-ink-soft">
        <span className="max-w-[45%]">{low}</span>
        <span className="max-w-[45%] text-right">{high}</span>
      </div>
    </li>
  );
}

const TABS: [string, string][] = [
  ['strengths', 'Strengths'],
  ['personality', 'Personality'],
  ['reasoning', 'Reasoning'],
  ['eq', 'Emotional intelligence'],
  ['use', 'Use my results'],
];

function PersonalityTab({ result }: { result: DiscoverResult }) {
  const a = analyseDiscover(result);
  return (
    <>
      <Section id="pattern" title="Your pattern" lede={a.pattern}>
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {a.personality.map((p) => (
            <li key={p.trait} className="rounded-card bg-card p-md shadow-toy-soft">
              <div className="flex items-baseline justify-between gap-sm">
                <h3 className="text-[18px]">{p.name}</h3>
                <span className="font-display text-[24px] font-extrabold">{p.score}</span>
              </div>
              <p className="m-0 text-[14px] font-extrabold text-ink-soft">{p.reading.title}</p>
              <div className="relative mt-xs h-[8px] rounded-pill" style={{ background: 'var(--color-line)' }} role="img" aria-label={`${p.name}: ${p.score} out of 100, ${p.band === 'mid' ? 'in the middle' : p.band}`}>
                <span className="absolute inset-y-0 left-0 rounded-pill" style={{ width: `${p.score}%`, background: 'var(--color-r4)' }} />
              </div>
              <p className="mt-sm m-0 text-[14px] font-semibold">{p.reading.describes}</p>
              <dl className="mt-sm m-0 flex flex-col gap-xs text-[14px] font-semibold">
                <div>
                  <dt className="font-extrabold">At your best</dt>
                  <dd className="m-0 text-ink-soft">{p.reading.atBest}</dd>
                </div>
                <div>
                  <dt className="font-extrabold">Watch for</dt>
                  <dd className="m-0 text-ink-soft">{p.reading.watchFor}</dd>
                </div>
                <div>
                  <dt className="font-extrabold">With the people close to you</dt>
                  <dd className="m-0 text-ink-soft">{p.reading.inRelationships}</dd>
                </div>
                <div>
                  <dt className="font-extrabold">Try this week</dt>
                  <dd className="m-0 text-ink-soft">{p.reading.tryThis}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </Section>
      <p className="mt-lg m-0 text-[12px] font-semibold text-ink-soft">A low or high number is not good or bad. It is a different way to be, and each end has its own strengths.</p>
    </>
  );
}

function EqTab({ result }: { result: DiscoverResult }) {
  const eq = analyseDiscover(result).eq;
  if (!eq) return null;
  return (
    <>
      <Section id="eq-top" title="Your emotional intelligence" lede="How you notice and handle feelings, yours and other people’s. Each part mixes how you see yourself with how you chose in real situations.">
        <div className="relative overflow-hidden rounded-card p-md text-on-fill" style={fillOf(RELATIONSHIP_BY_KEY.lover_partner.color)}>
          <HeroBlobs seed="eq" />
          <p className="relative m-0 text-[12px] font-extrabold uppercase tracking-wide opacity-90">Across the five parts</p>
          <p className="relative m-0 font-display text-[44px] font-extrabold leading-none">{eq.overall}</p>
          <p className="relative mt-xs m-0 text-[14px] font-semibold">
            Strongest: {EQ_DIMS.find((d) => d.key === eq.strongest)!.name}. Quietest: {EQ_DIMS.find((d) => d.key === eq.quietest)!.name}.
          </p>
        </div>
      </Section>
      <Section id="eq-parts" title="The five parts">
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {eq.dims.map((d) => {
            const rel = RELATIONSHIP_BY_KEY[d.helps];
            return (
              <li key={d.dim} className="rounded-card bg-card p-md shadow-toy-soft">
                <div className="flex items-baseline justify-between gap-sm">
                  <h3 className="text-[18px]">{d.name}</h3>
                  <span className="font-display text-[24px] font-extrabold">{d.score}</span>
                </div>
                <p className="m-0 text-[14px] font-extrabold text-ink-soft">{d.reading.title}</p>
                <div className="relative mt-xs h-[8px] rounded-pill" style={{ background: 'var(--color-line)' }} role="img" aria-label={`${d.name}: ${d.score} out of 100`}>
                  <span className="absolute inset-y-0 left-0 rounded-pill" style={{ width: `${d.score}%`, background: rel.color }} />
                </div>
                <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">How you see yourself: {d.self}. How you chose in situations: {d.ability}.</p>
                <p className="mt-sm m-0 text-[14px] font-semibold">{d.reading.describes}</p>
                {d.gap && <p className="mt-xs m-0 text-[14px] font-semibold">{d.gap}</p>}
                <dl className="mt-sm m-0 flex flex-col gap-xs text-[14px] font-semibold">
                  <div>
                    <dt className="font-extrabold">At your best</dt>
                    <dd className="m-0 text-ink-soft">{d.reading.atBest}</dd>
                  </div>
                  <div>
                    <dt className="font-extrabold">Watch for</dt>
                    <dd className="m-0 text-ink-soft">{d.reading.watchFor}</dd>
                  </div>
                  <div>
                    <dt className="font-extrabold">With the people close to you</dt>
                    <dd className="m-0 text-ink-soft">{d.reading.inRelationships}</dd>
                  </div>
                  <div>
                    <dt className="font-extrabold">Try this week</dt>
                    <dd className="m-0 text-ink-soft">{d.reading.tryThis}</dd>
                  </div>
                  <div>
                    <dt className="font-extrabold">Helps most with</dt>
                    <dd className="m-0 text-ink-soft">{DISCOVER_STRENGTHS[d.helps].name}, in {rel.role}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      </Section>
      <Section id="eq-read" title="Reading people">
        <p className="m-0 text-[14px] font-semibold">{eq.readingLine}</p>
      </Section>
      <p className="mt-lg m-0 text-[12px] font-semibold text-ink-soft">This is a self-discovery tool, not a clinical test. It shows how you see yourself and how you chose in eight situations today. It can change with sleep, stress and practice.</p>
    </>
  );
}

function ReasoningTab({ result }: { result: DiscoverResult }) {
  const r = analyseDiscover(result).reasoning;
  return (
    <>
      <Section id="level" title="Your reasoning">
        <div className="relative overflow-hidden rounded-card p-md text-on-fill" style={fillOf(RELATIONSHIP_BY_KEY.guru.color)}>
          <HeroBlobs seed="reasoning" />
          <p className="relative m-0 text-[12px] font-extrabold uppercase tracking-wide opacity-90">Adjusting puzzles</p>
          <p className="relative m-0 font-display text-[44px] font-extrabold leading-none">
            {r.right} <span className="text-[20px]">of {r.of}</span>
          </p>
          {r.levelNumber !== null && <p className="relative m-0 text-[14px] font-bold opacity-90">Settled at level {r.levelNumber} of 5</p>}
          <h3 className="relative mt-xs text-[22px]">{r.level}</h3>
          <p className="relative mt-xs m-0 text-[14px] font-semibold">{r.levelLine}</p>
        </div>
      </Section>
      {r.kinds.length > 0 && (
        <Section id="kinds" title="By kind of puzzle" lede="The puzzles move up when you get one right and down when you do not, so the level shows where you settled. Each kind trains a different way of seeing a rule.">
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {r.kinds.map((k) => (
              <li key={k.kind} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <div className="flex items-baseline justify-between gap-sm">
                  <span className="text-[16px] font-bold">{k.name}</span>
                  <span className="font-display text-[18px] font-extrabold">{k.right} of {k.of}</span>
                </div>
                <span className="mt-xs block h-[8px] rounded-pill" style={{ background: 'var(--color-line)' }}>
                  <span className="block h-full rounded-pill" style={{ width: `${(k.right / k.of) * 100}%`, background: 'var(--color-r6)' }} />
                </span>
                <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">{k.what}</p>
                <p className="mt-xs m-0 text-[14px] font-semibold">{k.note}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {(r.trend || r.speed) && (
        <Section id="trend" title="How you worked">
          {r.trend && <p className="m-0 text-[14px] font-semibold">{r.trend}</p>}
          {r.speed && <p className="mt-xs m-0 text-[14px] font-semibold">{r.speed}</p>}
        </Section>
      )}
      <Section id="situations" title="Real situations" lede="The last part asked how you would handle people. It is judged against the team’s own reading of each case, not a test.">
        <StatTile label="Situations" value={result.judgment} hint="Out of 100" />
      </Section>
      <p className="mt-lg m-0 text-[12px] font-semibold text-ink-soft">{r.caveat}</p>
    </>
  );
}

function UseTab({ settings, onChange }: { settings: { steps: boolean; assistant: boolean }; onChange: (s: Partial<{ steps: boolean; assistant: boolean }>) => void }) {
  return (
    <Section id="use-results" title="Let your results help" lede="Both are your call, and you can change them any time. Your answers are never shared. Only a short summary is used: your strengths, how each trait reads and your reasoning level.">
      <div className="flex flex-col gap-xs">
        <Toggle on={settings.steps} onChange={(v) => onChange({ steps: v })} label="Shape my next steps" hint="Home’s daily brief picks steps that fit you, such as one small task if you start many things. Plain rules, no AI." />
        <Toggle on={settings.assistant} onChange={(v) => onChange({ assistant: v })} label="Let the assistant learn from them" hint="The assistant uses the summary to choose its tone and the size of a step. Only a model that keeps no data can read it." />
      </div>
    </Section>
  );
}

function ResultView({ id, at, result, settings, onSettings, onRetake, onDelete, deleting }: { id: string; at: string; result: DiscoverResult; settings: { steps: boolean; assistant: boolean }; onSettings: (s: Partial<{ steps: boolean; assistant: boolean }>) => void; onRetake: () => void; onDelete: (id: string) => void; deleting: boolean }) {
  const [tabAsked, setTab] = useParamState('tab', 'strengths');
  // A link to the emotional intelligence tab only works when that part was taken.
  const tab = tabAsked === 'eq' && !result.eq ? 'strengths' : tabAsked;
  const growth = DISCOVER_STRENGTHS[result.growth];
  const growthRel = RELATIONSHIP_BY_KEY[result.growth];
  return (
    <>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Taken {new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}. Only you can see this.</p>
      <div className="scroll-row mt-sm flex gap-xs" role="group" aria-label="Parts of your result">
        {TABS.filter(([k]) => k !== 'eq' || result.eq).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={`toy min-h-[44px] shrink-0 rounded-pill border-2 px-md text-[14px] font-bold ${tab === k ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'personality' && <PersonalityTab result={result} />}
      {tab === 'eq' && <EqTab result={result} />}
      {tab === 'reasoning' && <ReasoningTab result={result} />}
      {tab === 'use' && <UseTab settings={settings} onChange={onSettings} />}
      {tab === 'strengths' && (
        <>
      <Section id="top" title="Your top three strengths">
        <ol className="bento m-0 list-none p-0">
          {result.top.map((key, n) => {
            const rel = RELATIONSHIP_BY_KEY[key];
            const s = DISCOVER_STRENGTHS[key];
            const score = result.strengths.find((x) => x.key === key)!.score;
            return (
              <li key={key} className={`relative overflow-hidden rounded-card p-md text-on-fill ${n === 0 ? 'bento-w2' : ''}`} style={fillOf(rel.color)}>
                <HeroBlobs seed={key} />
                <div className="relative flex items-center gap-sm">
                  <Avatar relationship={key} size={n === 0 ? 72 : 56} decorative still mood="happy" />
                  <div className="min-w-0">
                    <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide opacity-90">
                      {n + 1}. {rel.role}
                    </p>
                    <h3 className="text-[22px] leading-[1.15]">{s.name}</h3>
                  </div>
                </div>
                <p className="relative mt-sm m-0 text-[14px] font-semibold">{s.line}</p>
                <p className="relative mt-xs m-0 font-display text-[28px] font-extrabold">{score}</p>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section id="all" title="All seven strengths" lede="Each one is a mix of your traits, puzzles and situations. It shows what you lean on most, not how you rank against anyone.">
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {result.strengths.map((s) => {
            const rel = RELATIONSHIP_BY_KEY[s.key];
            return (
              <li key={s.key} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <Avatar relationship={s.key} size={36} decorative still mood="happy" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-sm">
                    <span className="truncate text-[16px] font-bold">{DISCOVER_STRENGTHS[s.key].name}</span>
                    <span className="shrink-0 font-display text-[18px] font-extrabold">{s.score}</span>
                  </span>
                  <span className="mt-xs block h-[8px] rounded-pill" style={{ background: 'var(--color-line)' }}>
                    <span className="block h-full rounded-pill" style={{ width: `${s.score}%`, background: rel.color }} />
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="traits" title="Your five traits" lede="Where you sit on each. The middle is not average: it means you do both about equally.">
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {TRAITS.map((t) => (
            <TraitBar key={t.key} name={t.name} low={t.low} high={t.high} value={result.traits[t.key]} />
          ))}
        </ul>
        <div className="mt-sm grid gap-xs" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <StatTile label="Puzzles" value={`${result.puzzles.right} of ${result.puzzles.of}`} hint="Patterns spotted" />
          <StatTile label="Situations" value={result.judgment} hint="Match with the team’s reading" />
        </div>
      </Section>

      <Section id="use" title="Using your strengths">
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {result.top.map((key) => {
            const s = DISCOVER_STRENGTHS[key];
            return (
              <li key={key} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <h3 className="text-[18px]">{s.name}</h3>
                <p className="mt-xs m-0 text-[14px] font-semibold"><span className="font-extrabold">Use it: </span>{s.use}</p>
                <p className="mt-xs m-0 text-[14px] font-semibold"><span className="font-extrabold">Watch for: </span>{s.watch}</p>
                <p className="mt-xs m-0 text-[14px] font-semibold"><span className="font-extrabold">Try this week: </span>{s.tryThis}</p>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="grow" title="Where to grow">
        <div className="rounded-card p-md" style={{ background: `var(--soft-${result.growth})` }}>
          <div className="flex items-center gap-sm">
            <Avatar relationship={result.growth} size={48} decorative still mood="sleepy" />
            <div>
              <h3 className="text-[18px]">{growth.name}</h3>
              <p className="m-0 text-[14px] font-semibold" style={{ color: `var(--deep-${result.growth})` }}>{growthRel.role}</p>
            </div>
          </div>
          <p className="mt-sm m-0 text-[14px] font-semibold">This is your quietest strength today. That does not make it weak. It is the easiest place to start a small habit.</p>
          <p className="mt-xs m-0 text-[14px] font-semibold">{growth.tryThis}</p>
          <Link to={`/realm/${result.growth}`} className="toy mt-sm inline-flex min-h-[48px] items-center justify-center rounded-pill bg-ink px-md text-[16px] font-bold text-on-ink">
            Open this pillar
          </Link>
        </div>
      </Section>
        </>
      )}

      <p className="mt-lg m-0 text-[12px] font-semibold text-ink-soft">
        This is a self-discovery tool, not a diagnosis or a hiring test. It compares you with your own scale, not with other people, and a quiz can only show how you see yourself today.
      </p>
      <div className="mt-sm flex flex-wrap gap-xs">
        <Button variant="outline" onClick={onRetake}>
          Take it again
        </Button>
        <Button variant="ghost" onClick={() => window.confirm('Delete this result for good?') && onDelete(id)} disabled={deleting}>
          Delete this result
        </Button>
      </div>
    </>
  );
}

export function Discover() {
  const q = useDiscover();
  const refresh = useRefreshAll();
  const [mode, setMode] = useState<'home' | 'quiz' | 'result'>('home');
  const [answers, setAnswersState] = useState<DiscoverAnswers | null>(null);
  const [shown, setShown] = useState<{ id: string; createdAt: string; result: DiscoverResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (q.data && !answers) setAnswersState(q.data.answers);
  }, [q.data, answers]);

  // Save as the person goes, a moment after the last tap.
  const save = useMutation({ mutationFn: (a: DiscoverAnswers) => api.saveDiscover(a) });
  useEffect(() => {
    if (!answers || !dirty.current) return;
    const t = window.setTimeout(() => save.mutate(answers), 500);
    return () => window.clearTimeout(t);
  }, [answers]); // eslint-disable-line react-hooks/exhaustive-deps
  const setAnswers = (a: DiscoverAnswers) => {
    dirty.current = true;
    setAnswersState(a);
  };

  const submit = useMutation({
    mutationFn: (a: DiscoverAnswers) => api.submitDiscover(a),
    onSuccess: (r) => {
      dirty.current = false;
      setShown(r);
      setMode('result');
      setError(null);
      setAnswersState(emptyDiscoverAnswers());
      refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not finish.'),
  });
  const saveSettings = useMutation({ mutationFn: (v: Partial<{ steps: boolean; assistant: boolean }>) => api.discoverSettings(v), onSuccess: () => refresh() });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteDiscoverResult(id),
    onSuccess: () => {
      setMode('home');
      setShown(null);
      refresh();
    },
  });

  const prog = useMemo(() => discoverProgress(answers ?? emptyDiscoverAnswers()), [answers]);
  const data = q.data;
  const result = shown ?? data?.latest ?? null;

  if (mode === 'quiz' && answers) {
    return (
      <Screen howTo={false} className="focus-scope">
        <Quiz answers={answers} setAnswers={setAnswers} onLeave={() => setMode('home')} onDone={() => submit.mutate(answers)} busy={submit.isPending} error={error} />
      </Screen>
    );
  }

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Discover</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">A quiz about how you think, feel and act. It gives you a detailed read on your personality and your reasoning, and your strengths across the seven relationships.</p>
      </header>

      {q.isPending && (
        <p className="mt-md text-[14px] font-bold text-ink-soft" role="status">
          Opening your quiz
        </p>
      )}
      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft" role="alert">
          <p className="m-0 font-bold">Could not load Discover.</p>
          <Button variant="outline" className="mt-sm" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {data && mode === 'result' && result && (
        <ResultView id={result.id} at={result.createdAt} result={result.result} settings={data.settings} onSettings={(v) => saveSettings.mutate(v)} onRetake={() => { setAnswersState(emptyDiscoverAnswers()); dirty.current = true; setMode('quiz'); }} onDelete={(id) => remove.mutate(id)} deleting={remove.isPending} />
      )}

      {data && mode !== 'result' && (
        <>
          <section className="relative mt-md overflow-hidden rounded-card p-md text-on-fill" style={fillOf(RELATIONSHIP_BY_KEY.self.color)} aria-labelledby="quiz-head">
            <HeroBlobs seed="discover" />
            <h2 id="quiz-head" className="relative text-[22px]">{prog.done === 0 ? 'Find out what you are good at' : `${prog.done} of ${DISCOVER_STEPS} answered`}</h2>
            <p className="relative mt-xs m-0 text-[14px] font-semibold">Five parts: pick what is most and least like you, solve pattern puzzles that adjust to you, choose words that fit you and judge real situations. Then, if you like, add emotional intelligence. It saves as you go, so you can stop and come back.</p>
            <div className="relative mt-sm flex flex-wrap gap-xs">
              <Button variant="light" onClick={() => setMode('quiz')}>
                {prog.done === 0 ? 'Start the quiz' : prog.core.done === prog.core.total ? 'Add emotional intelligence' : 'Continue'}
              </Button>
              {prog.core.done === prog.core.total && answers && (
                <Button variant="light" onClick={() => submit.mutate(answers)} disabled={submit.isPending}>
                  {submit.isPending ? 'Working it out' : 'See my strengths'}
                </Button>
              )}
              {prog.done > 0 && (
                <Button variant="light" onClick={() => { setAnswersState(emptyDiscoverAnswers()); dirty.current = false; api.dropDiscoverDraft().then(() => refresh()); }}>
                  Start again
                </Button>
              )}
            </div>
          </section>

          <Section id="parts" title="The parts">
            <ol className="m-0 flex list-none flex-col gap-xs p-0">
              {DISCOVER_SECTIONS.map((s, k) => {
                const p = prog.parts[k]!;
                return (
                  <li key={s.key} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                    <span className="flex size-[36px] shrink-0 items-center justify-center rounded-pill bg-paper text-[14px] font-extrabold">{k + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-bold">{s.name}{s.optional ? ' (optional)' : ''}</span>
                      <span className="block text-[14px] font-semibold text-ink-soft">{p.done} of {s.count} done</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Section>

          {result && (
            <Section id="last" title="Your last result">
              <div className="rounded-card bg-card p-md shadow-toy-soft">
                <p className="m-0 text-[14px] font-semibold text-ink-soft">
                  {new Date(result.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="mt-xs m-0 text-[16px] font-bold">
                  {result.result.top.map((k) => DISCOVER_STRENGTHS[k].name).join(', ')}
                </p>
                <Button className="mt-sm" variant="outline" onClick={() => { setShown(result); setMode('result'); }}>
                  See my strengths
                </Button>
              </div>
              {data.history.length > 0 && (
                <ul className="mt-sm m-0 flex list-none flex-col gap-xs p-0">
                  {data.history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                      <span className="text-[14px] font-semibold">{new Date(h.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}: {h.result.top.map((k) => DISCOVER_STRENGTHS[k].name).join(', ')}</span>
                      <Button size="sm" variant="ghost" onClick={() => { setShown(h); setMode('result'); }}>
                        Open
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
        </>
      )}
    </Screen>
  );
}
