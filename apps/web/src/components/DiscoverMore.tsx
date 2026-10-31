import {
  DISCOVER_STRENGTHS,
  KARMIC_DEBTS,
  NUMBER_LABELS,
  NUMBER_READINGS,
  YEAR_THEMES,
  computeNumerology,
  designProfile,
  discoverProfile,
  loveTop,
  numerologyInsights,
  personalCycle,
  type NumberValue,
  type NumerologyContext,
  DESIGN_BODIES,
  DESIGN_CENTERS,
  DESIGN_DEPTHS,
  DESIGN_TYPES,
  EQ_SCALE,
  ZODIACS,
  analyseDesign,
  designChart,
  designCompare,
  designInputProblem,
  emptyDesignInput,
  parseDesignInput,
  signOf,
  type DesignCenter,
  type DesignInput,
  type DesignResult,
  type Zodiac,
  EXTRA_KINDS,
  LOVE_LANGUAGES,
  LOVE_PAIRS,
  MIND_NOTE,
  RATE_FREQUENCY,
  RELATIONSHIP_BY_KEY,
  TYPE_AXES,
  TYPE_SCREENS,
  MIND_SCREENS,
  analyseLove,
  analyseMind,
  analyseType,
  emptyExtra,
  extraProgress,
  lovePairLines,
  parseExtra,
  type ExtraKind,
  type LoveAnswers,
  type LoveResult,
  type MindResult,
  type RelationshipKey,
  type TypeResult,
} from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { api, type ExtraState } from '../lib/api';
import { bento } from '../lib/bento';
import { todayLocal } from '../lib/date';
import { StatTile } from './Charts';
import { useAuthed, useDiscover, useDiscoverMore, useRefreshAll } from '../lib/queries';
import { Button } from './Button';
import { HeroBlobs } from './Hero';
import { Section } from './Section';
import { Toggle } from './Toggle';

const ACCENT: Record<ExtraKind, RelationshipKey> = { type: 'self', love: 'lover_partner', mind: 'guru', design: 'divine' };
const fillOf = (color: string): CSSProperties => ({ background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 72%, var(--fill-shade)))` });
const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/** The three add-ons as cards on Discover's front page: start, carry on, or open the result. */
export function MoreSection({ onOpen }: { onOpen: (k: ExtraKind) => void }) {
  const q = useDiscoverMore();
  const extras = q.data?.extras;
  return (
    <Section id="more" title="More ways to know yourself" lede="Short self-checks you can take on their own, in any order. Each one adds to what Home suggests and what the assistant learns, only if you allow it.">
      <ul className="m-0 grid list-none gap-xs p-0 md:grid-cols-2">
        {EXTRA_KINDS.map((k) => {
          const st = extras?.[k.key];
          const done = Boolean(st?.result);
          const started = !done && (st?.progress.done ?? 0) > 0;
          const rel = RELATIONSHIP_BY_KEY[ACCENT[k.key]];
          return (
            <li key={k.key} className="flex flex-col rounded-card bg-card p-md shadow-toy-soft">
              <span className="flex size-[48px] items-center justify-center rounded-pill text-[24px]" style={fillOf(rel.color)} aria-hidden="true">
                {k.emoji}
              </span>
              <h3 className="mt-sm text-[18px]">{k.name}</h3>
              <p className="mt-xs m-0 flex-1 text-[14px] font-semibold text-ink-soft">{k.blurb}</p>
              <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{done && st?.takenAt ? `Taken ${when(st.takenAt)}` : started ? `${st!.progress.done} of ${st!.progress.total} done` : 'Not taken yet'}</p>
              <Button className="mt-sm" variant={done ? 'outline' : 'primary'} onClick={() => onOpen(k.key)}>
                {done ? 'See my result' : started ? 'Carry on' : 'Start'}
              </Button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** Rate every line on a screen from the first word to the last. */
function RateScreen({ items, scale, value, onChange }: { items: readonly { text: string }[]; scale: readonly string[]; value: number[] | null; onChange: (v: number[] | null) => void }) {
  const [rates, setRates] = useState<number[]>(value ?? items.map(() => -1));
  useEffect(() => setRates(value ?? items.map(() => -1)), [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const rate = (k: number, v: number) => {
    const next = rates.map((x, j) => (j === k ? v : x));
    setRates(next);
    onChange(next.every((x) => x >= 0) ? next : null);
  };
  return (
    <div role="group" aria-label={`Rate each line from ${scale[0]!.toLowerCase()} to ${scale[4]!.toLowerCase()}`} className="flex flex-col gap-xs">
      <div className="flex justify-between gap-sm px-xs text-[12px] font-extrabold text-ink-soft">
        <span>{scale[0]}</span>
        <span>{scale[4]}</span>
      </div>
      {items.map((it, k) => (
        <div key={it.text} className="rounded-tile bg-card p-sm shadow-toy-soft">
          <p className="m-0 text-center text-[16px] font-semibold">{it.text}</p>
          <div role="radiogroup" aria-label={it.text} className="mt-xs flex justify-center gap-xs">
            {scale.map((label, v) => (
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

/** Two lines: pick the one that fits. */
function PairScreen({ dir, index, value, onPick }: { dir: 'receive' | 'give'; index: number; value: 0 | 1 | null; onPick: (v: 0 | 1) => void }) {
  const lines = lovePairLines(dir, index);
  return (
    <div role="radiogroup" aria-label={dir === 'receive' ? 'Which means more to you?' : 'Which is more like you?'} className="flex flex-col gap-xs">
      {lines.map((text, v) => (
        <button
          key={text}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onPick(v as 0 | 1)}
          className={`toy min-h-[72px] rounded-tile border-2 p-md text-left text-[16px] font-bold ${value === v ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Bar({ label, value, max = 100, color, right }: { label: string; value: number; max?: number; color: string; right?: string }) {
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <span className="flex items-baseline justify-between gap-sm">
        <span className="text-[16px] font-bold">{label}</span>
        <span className="shrink-0 font-display text-[18px] font-extrabold">{right ?? value}</span>
      </span>
      <span className="mt-xs block h-[8px] rounded-pill" style={{ background: 'var(--color-line)' }}>
        <span className="block h-full rounded-pill" style={{ width: `${Math.round((value / max) * 100)}%`, background: color }} />
      </span>
    </li>
  );
}

function Hero({ kind, title, line, big }: { kind: ExtraKind; title: string; line: string; big?: string }) {
  const rel = RELATIONSHIP_BY_KEY[ACCENT[kind]];
  return (
    <section className="relative mt-md overflow-hidden rounded-card p-md text-on-fill" style={fillOf(rel.color)} aria-labelledby={`${kind}-hero`}>
      <HeroBlobs seed={kind} />
      {big && <p className="relative m-0 font-display text-[44px] font-extrabold leading-none tracking-wide">{big}</p>}
      <h2 id={`${kind}-hero`} className="relative mt-xs text-[24px]">
        {title}
      </h2>
      <p className="relative mt-xs m-0 text-[14px] font-semibold">{line}</p>
    </section>
  );
}

function TypeView({ result }: { result: TypeResult }) {
  const a = analyseType(result);
  const rel = RELATIONSHIP_BY_KEY[ACCENT.type];
  return (
    <>
      <Hero kind="type" big={a.code} title={a.name} line={a.line} />
      <Section id="type-axes" title="Your four pairs" lede="Each bar shows how far you lean. Close to the middle means you use both sides.">
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {a.axes.map((x) => {
            return <Bar key={x.key} label={`${x.letterName} (${x.letter}), ${x.strength === 'slight' ? 'a slight lean' : x.strength === 'moderate' ? 'a fair lean' : 'a clear lean'}`} value={x.leaning} color={rel.color} right={`${x.leaning}% ${x.letter}`} />;
          })}
        </ul>
        {a.close.length > 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Close to the middle: {a.close.map((c) => TYPE_AXES.find((t) => t.key === c)!.name.toLowerCase()).join(', ')}. Either letter could be you on another day.</p>}
      </Section>
      <Section id="type-read" title="What each letter means for you">
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {a.axes.map((x) => (
            <li key={x.key} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <h3 className="text-[18px]">
                {x.letterName} ({x.letter})
              </h3>
              <p className="mt-xs m-0 text-[14px] font-semibold">{x.reading.line}</p>
              <p className="mt-xs m-0 text-[14px] font-semibold"><span className="font-extrabold">At your best: </span>{x.reading.best}</p>
              <p className="mt-xs m-0 text-[14px] font-semibold"><span className="font-extrabold">Watch for: </span>{x.reading.watch}</p>
              <p className="mt-xs m-0 text-[14px] font-semibold"><span className="font-extrabold">With people: </span>{x.reading.people}</p>
              <p className="mt-xs m-0 text-[14px] font-semibold"><span className="font-extrabold">Try this week: </span>{x.reading.tryThis}</p>
            </li>
          ))}
        </ul>
      </Section>
      <p className="mt-sm m-0 text-[12px] font-semibold text-ink-soft">This is a free self-check built on four familiar pairs. It is not the official MBTI®, and no type is better than another. People are more than four letters.</p>
    </>
  );
}

function LoveView({ result }: { result: LoveResult }) {
  const a = analyseLove(result);
  const color = RELATIONSHIP_BY_KEY[ACCENT.love].color;
  const tops = Array.from(new Set([...a.topReceive, ...a.topGive]));
  return (
    <>
      <Hero kind="love" title={a.match ? 'You give love the way you like to get it' : 'You give one way and feel loved another'} line={a.gapLine} />
      <div className="mt-md grid gap-md md:grid-cols-2">
        {([['receive', 'How you like to be shown love', a.receive], ['give', 'How you show love', a.give]] as const).map(([dir, title, list]) => (
          <Section key={dir} id={`love-${dir}`} title={title} lede="Out of four.">
            <ul className="m-0 flex list-none flex-col gap-xs p-0">
              {list.map((x) => (
                <Bar key={x.key} label={`${LOVE_LANGUAGES[x.key].emoji} ${LOVE_LANGUAGES[x.key].name}`} value={x.score} max={4} color={color} right={`${x.score}`} />
              ))}
            </ul>
          </Section>
        ))}
      </div>
      <Section id="love-use" title="Using it" lede="For your top languages. Tell people what works for you, and ask what works for them.">
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {tops.map((k) => {
            const l = LOVE_LANGUAGES[k];
            return (
              <li key={k} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <h3 className="text-[18px]">
                  {l.emoji} {l.name}
                </h3>
                <p className="mt-xs m-0 text-[14px] font-semibold">{l.blurb}</p>
                <p className="mt-xs m-0 text-[14px] font-semibold"><span className="font-extrabold">Ask for it: </span>{l.ask}</p>
                <p className="mt-xs m-0 text-[14px] font-semibold"><span className="font-extrabold">Give it well: </span>{l.give}</p>
                <p className="mt-xs m-0 text-[14px] font-semibold"><span className="font-extrabold">Watch for: </span>{l.watch}</p>
                <Link to={`/realm/${l.helps}`} className="mt-xs inline-block text-[14px] font-bold underline underline-offset-4">
                  Work on it in {RELATIONSHIP_BY_KEY[l.helps].name.toLowerCase()}
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>
      <p className="mt-sm m-0 text-[12px] font-semibold text-ink-soft">The five languages are a popular way to talk about care, not a law. Everyone uses all five, and what you like can change with the person and the season of life.</p>
    </>
  );
}

const BAND_WORD = { few: 'Few signs', some: 'Some signs', many: 'Many signs' } as const;
function MindView({ result }: { result: MindResult }) {
  const a = analyseMind(result);
  const color = RELATIONSHIP_BY_KEY[ACCENT.mind].color;
  return (
    <>
      <Hero kind="mind" title="How your mind works" line="Three areas, from how often each line was true for you. Signs are not a diagnosis. They show what to plan for." />
      <p role="note" className="mt-sm m-0 rounded-tile bg-paper p-sm text-[14px] font-semibold">{MIND_NOTE}</p>
      <Section id="mind-areas" title="Your three areas">
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {a.areas.map((x) => (
            <li key={x.key} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <span className="flex items-baseline justify-between gap-sm">
                <h3 className="text-[18px]">{x.name}</h3>
                <span className="shrink-0 rounded-pill bg-paper px-xs text-[12px] font-extrabold leading-[22px]">{BAND_WORD[x.band]}</span>
              </span>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{x.blurb}</p>
              <span className="mt-xs block h-[8px] rounded-pill" style={{ background: 'var(--color-line)' }}>
                <span className="block h-full rounded-pill" style={{ width: `${x.score}%`, background: color }} />
              </span>
              <p className="mt-xs m-0 text-[14px] font-semibold">{x.reading}</p>
              {x.band !== 'few' && (
                <>
                  <p className="mt-xs m-0 text-[14px] font-extrabold">What can help</p>
                  <ul className="mt-xs m-0 list-disc pl-md text-[14px] font-semibold">
                    {x.helps.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </>
              )}
            </li>
          ))}
        </ul>
      </Section>
      {a.talkToSomeone && (
        <p className="mt-sm m-0 rounded-tile bg-card p-sm text-[14px] font-semibold shadow-toy-soft">
          Several areas read as many signs, and they may be getting in your way. A doctor or a psychologist can talk it through with you. You do not need a label to ask for help, and many people find a plan for their day makes a big difference.
        </p>
      )}
    </>
  );
}

/** The three switches that decide what a result may do. Each is the person's alone. */
function UseSwitches({ kind }: { kind: ExtraKind }) {
  const q = useDiscover();
  const refresh = useRefreshAll();
  const save = useMutation({ mutationFn: (v: { steps?: boolean; assistant?: boolean; mind?: boolean }) => api.discoverSettings(v), onSuccess: () => refresh() });
  const s = q.data?.settings;
  if (!s) return null;
  return (
    <Section id="more-use" title="Let your results help" lede="Your answers are never shared. Only a short summary is used, and each switch is yours to change any time.">
      <div className="flex flex-col gap-xs">
        <Toggle on={s.steps} onChange={(v) => save.mutate({ steps: v })} label="Shape my next steps" hint="Home’s daily brief picks steps that fit you. Plain rules, no AI." />
        <Toggle on={s.assistant} onChange={(v) => save.mutate({ assistant: v })} label="Let the assistant learn from them" hint="The assistant uses the summary to choose its tone and the size of a step. Only a model that keeps no data can read it." />
        {kind === 'mind' && <Toggle on={s.mind} onChange={(v) => save.mutate({ mind: v })} label="Include how my mind works" hint="Off until you switch it on. It then shapes next steps and, if the assistant is allowed, helps it pace things for you. It never names a condition." />}
      </div>
    </Section>
  );
}

/** One add-on: its quiz or form while it is open, then its result. */
export function MoreScreen({ kind, onBack }: { kind: ExtraKind; onBack: () => void }) {
  return kind === 'design' ? <DesignScreen onBack={onBack} /> : <QuizScreen kind={kind} onBack={onBack} />;
}

function QuizScreen({ kind, onBack }: { kind: ExtraKind; onBack: () => void }) {
  const meta = EXTRA_KINDS.find((k) => k.key === kind)!;
  const q = useDiscoverMore();
  const refresh = useRefreshAll();
  const st: ExtraState | undefined = q.data?.extras[kind];
  const [answers, setAnswers] = useState<unknown>(null);
  const [at, setAt] = useState(0);
  const [mode, setMode] = useState<'result' | 'quiz' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = useRef(false);

  // Open on the result when there is one and no draft, or on the quiz where the draft left off.
  useEffect(() => {
    if (!st || mode !== null) return;
    const draft = parseExtra(kind, st.draft);
    setAnswers(draft);
    if (st.result && st.progress.done === 0) setMode('result');
    else {
      setMode('quiz');
      const list = kind === 'love' ? [...(draft as LoveAnswers).receive, ...(draft as LoveAnswers).give] : (draft as (unknown | null)[]);
      const first = list.findIndex((v) => v === null);
      setAt(first < 0 ? list.length - 1 : first);
    }
  }, [st, mode, kind]);

  const save = useMutation({ mutationFn: (a: unknown) => api.saveExtra(kind, a) });
  useEffect(() => {
    if (!dirty.current || answers === null) return;
    const t = window.setTimeout(() => save.mutate(answers), 500);
    return () => window.clearTimeout(t);
  }, [answers]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useMutation({
    mutationFn: () => api.submitExtra(kind, answers),
    onSuccess: () => {
      dirty.current = false;
      setError(null);
      setMode('result');
      refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not finish.'),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteExtra(kind),
    onSuccess: () => {
      refresh();
      onBack();
    },
  });

  const steps = meta.steps;
  const total = steps;
  const doneNow = answers === null ? 0 : extraProgress(kind, answers).done;
  const answeredHere = (() => {
    if (answers === null) return false;
    if (kind === 'love') return (at < LOVE_PAIRS.length ? (answers as LoveAnswers).receive[at] : (answers as LoveAnswers).give[at - LOVE_PAIRS.length]) !== null;
    return (answers as (number[] | null)[])[at] !== null;
  })();
  const set = (next: unknown) => {
    dirty.current = true;
    setAnswers(next);
  };

  const body = (() => {
    if (answers === null) return null;
    if (kind === 'love') {
      const a = answers as LoveAnswers;
      const dir = at < LOVE_PAIRS.length ? 'receive' : 'give';
      const i = at % LOVE_PAIRS.length;
      return (
        <PairScreen
          key={at}
          dir={dir}
          index={i}
          value={a[dir][i] ?? null}
          onPick={(v) => {
            const list = a[dir].map((x, j) => (j === i ? v : x));
            set({ ...a, [dir]: list });
            if (at < total - 1) window.setTimeout(() => setAt((n) => Math.min(total - 1, n + 1)), 200);
          }}
        />
      );
    }
    const list = answers as (number[] | null)[];
    const items = kind === 'type' ? TYPE_SCREENS[at]! : MIND_SCREENS[at]!;
    return <RateScreen key={at} items={items} scale={kind === 'type' ? EQ_SCALE : RATE_FREQUENCY} value={list[at] ?? null} onChange={(v) => set(list.map((x, j) => (j === at ? v : x)))} />;
  })();

  const head = (
    <header className="pt-lg">
      <button type="button" onClick={onBack} className="toy mb-xs inline-flex min-h-[44px] items-center text-[14px] font-bold text-ink-soft hover:text-ink">
        ← Discover
      </button>
      <h1 className="text-[30px]">{meta.name}</h1>
    </header>
  );

  if (q.isPending || mode === null) {
    return (
      <>
        {head}
        <p className="mt-md text-[14px] font-bold text-ink-soft" role="status">
          Opening it
        </p>
      </>
    );
  }

  if (mode === 'quiz') {
    const last = at === total - 1;
    const intro = kind === 'type' ? 'Rate each line from not like me to very like me. Go with how you are most days.' : kind === 'mind' ? 'Say how often each line is true for you, from never to very often. Think of the last few months, not your best or worst day.' : at < LOVE_PAIRS.length ? 'Pick the line that means more to you. Both may be nice. Choose the stronger one.' : 'Pick the line that is more like how you show love.';
    return (
      <>
        {head}
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{meta.blurb}</p>
        {kind === 'mind' && <p role="note" className="mt-sm m-0 rounded-tile bg-paper p-sm text-[14px] font-semibold">{MIND_NOTE}</p>}
        <div className="mt-md">
          <div className="flex items-baseline justify-between gap-sm">
            <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">
              {kind === 'love' ? (at < LOVE_PAIRS.length ? 'Receiving love' : 'Showing love') : meta.name}, {at + 1} of {total}
            </p>
            <p className="m-0 text-[12px] font-bold text-ink-soft">{doneNow} answered</p>
          </div>
          <div className="mt-xs h-[8px] overflow-hidden rounded-pill bg-line" aria-hidden="true">
            <div className="h-full rounded-pill bg-r4" style={{ width: `${Math.round(((at + 1) / total) * 100)}%` }} />
          </div>
          <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">{intro}</p>
          <div className="mt-sm" data-answer>
            {body}
          </div>
          {error && (
            <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
              {error}
            </p>
          )}
          <div className="mt-md flex gap-xs">
            <Button variant="outline" onClick={() => setAt((n) => Math.max(0, n - 1))} disabled={at === 0}>
              Back
            </Button>
            {last ? (
              <Button className="flex-1" onClick={() => submit.mutate()} disabled={!answeredHere || submit.isPending || doneNow < total}>
                {submit.isPending ? 'Working it out' : 'See my result'}
              </Button>
            ) : (
              <Button className="flex-1" onClick={() => setAt((n) => Math.min(total - 1, n + 1))} disabled={!answeredHere}>
                Next
              </Button>
            )}
          </div>
          {Boolean(st?.result) && (
            <Button className="mt-sm" variant="ghost" onClick={() => setMode('result')}>
              Back to my last result
            </Button>
          )}
        </div>
      </>
    );
  }

  const result = st?.result;
  return (
    <>
      {head}
      {st?.takenAt && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Taken {when(st.takenAt)}. Only you can see this.</p>}
      {result ? kind === 'type' ? <TypeView result={result as TypeResult} /> : kind === 'love' ? <LoveView result={result as LoveResult} /> : <MindView result={result as MindResult} /> : <p className="mt-md text-[14px] font-semibold">No result yet.</p>}
      <UseSwitches kind={kind} />
      <div className="mt-md flex flex-wrap gap-xs">
        <Button
          variant="outline"
          onClick={() => {
            dirty.current = false;
            setAnswers(emptyExtra(kind));
            setAt(0);
            setMode('quiz');
            api.saveExtra(kind, emptyExtra(kind)).then(() => refresh());
          }}
        >
          Take it again
        </Button>
        <Button variant="ghost" onClick={() => window.confirm('Delete this result and its answers for good?') && remove.mutate()} disabled={remove.isPending}>
          Delete this result
        </Button>
      </div>
    </>
  );
}

// ---- Human design ----

const ZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Colombo', 'Asia/Kathmandu', 'Asia/Shanghai', 'Asia/Manila', 'Asia/Jakarta', 'Australia/Sydney', 'Australia/Perth', 'Pacific/Auckland', 'Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome', 'Europe/Moscow', 'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg', 'Africa/Nairobi', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'America/Mexico_City', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'UTC'];
const zoneList = (): string[] => {
  try {
    const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone');
    if (all && all.length) return all;
  } catch {
    // an older browser: the short list is enough
  }
  return ZONES;
};
const CENTER_POS: Record<DesignCenter, { x: number; y: number; shape: 'up' | 'down' | 'square' | 'diamond' | 'right' | 'left'; tone: string }> = {
  head: { x: 110, y: 28, shape: 'up', tone: 'var(--color-r3)' },
  ajna: { x: 110, y: 82, shape: 'down', tone: 'var(--color-r4)' },
  throat: { x: 110, y: 138, shape: 'square', tone: 'var(--color-r5)' },
  g: { x: 110, y: 198, shape: 'diamond', tone: 'var(--color-r3)' },
  heart: { x: 160, y: 214, shape: 'up', tone: 'var(--color-r1)' },
  spleen: { x: 42, y: 252, shape: 'right', tone: 'var(--color-r4)' },
  solar: { x: 178, y: 262, shape: 'left', tone: 'var(--color-r2)' },
  sacral: { x: 110, y: 272, shape: 'square', tone: 'var(--color-r1)' },
  root: { x: 110, y: 330, shape: 'square', tone: 'var(--color-r5)' },
};
const shapePath = (k: DesignCenter): string => {
  const { x, y, shape } = CENTER_POS[k];
  const r = shape === 'square' ? 22 : 20;
  if (shape === 'up') return `M${x},${y - r} L${x + r},${y + r * 0.8} L${x - r},${y + r * 0.8} Z`;
  if (shape === 'down') return `M${x - r},${y - r * 0.8} L${x + r},${y - r * 0.8} L${x},${y + r} Z`;
  if (shape === 'diamond') return `M${x},${y - r} L${x + r},${y} L${x},${y + r} L${x - r},${y} Z`;
  if (shape === 'right') return `M${x - r},${y - r} L${x + r},${y} L${x - r},${y + r} Z`;
  if (shape === 'left') return `M${x + r},${y - r} L${x - r},${y} L${x + r},${y + r} Z`;
  return `M${x - r},${y - r * 0.8} L${x + r},${y - r * 0.8} L${x + r},${y + r * 0.8} L${x - r},${y + r * 0.8} Z`;
};

/** The nine centers as a small picture: filled when defined, with a line for every pair a channel joins. */
function BodyGraph({ defined, links }: { defined: DesignCenter[]; links: [DesignCenter, DesignCenter][] }) {
  const seen = new Set<string>();
  return (
    <svg viewBox="0 0 220 360" className="mx-auto block w-full max-w-[260px]" role="img" aria-label={`Bodygraph: ${defined.length} of 9 centers defined`}>
      {links.filter(([a, b]) => (seen.has(`${a}${b}`) ? false : (seen.add(`${a}${b}`), true))).map(([a, b]) => (
        <line key={`${a}${b}`} x1={CENTER_POS[a].x} y1={CENTER_POS[a].y} x2={CENTER_POS[b].x} y2={CENTER_POS[b].y} stroke="var(--color-ink)" strokeWidth="5" strokeLinecap="round" opacity="0.55" />
      ))}
      {DESIGN_CENTERS.map((c) => {
        const on = defined.includes(c.key);
        return (
          <g key={c.key}>
            <path d={shapePath(c.key)} fill={on ? CENTER_POS[c.key].tone : 'var(--color-card-strong)'} stroke={on ? 'var(--color-ink)' : 'var(--color-line)'} strokeWidth="2" strokeLinejoin="round" />
            <text x={CENTER_POS[c.key].x} y={CENTER_POS[c.key].y + 4} textAnchor="middle" fontSize="9" fontWeight="800" fill={on ? 'var(--color-on-fill)' : 'var(--color-ink-soft)'}>
              {c.name.split(' ')[0]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DesignForm({ initial, birthDate, onDone }: { initial: DesignInput; birthDate: string; onDone: () => void }) {
  const refresh = useRefreshAll();
  const guess = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return '';
    }
  })();
  const [input, setInput] = useState<DesignInput>({ ...emptyDesignInput(), ...initial, date: initial.date || birthDate, zone: initial.zone || guess });
  const [error, setError] = useState<string | null>(null);
  const dirty = useRef(false);
  const save = useMutation({ mutationFn: (v: DesignInput) => api.saveExtra('design', v) });
  useEffect(() => {
    if (!dirty.current) return;
    const t = window.setTimeout(() => save.mutate(input), 600);
    return () => window.clearTimeout(t);
  }, [input]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch: Partial<DesignInput>) => {
    dirty.current = true;
    setInput((i) => ({ ...i, ...patch }));
  };
  const submit = useMutation({
    mutationFn: () => api.submitExtra('design', parseDesignInput(input)),
    onSuccess: () => {
      dirty.current = false;
      setError(null);
      refresh();
      onDone();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not work it out.'),
  });
  const problem = designInputProblem(parseDesignInput(input));
  const FIELD = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
  return (
    <form
      className="mt-md flex flex-col gap-md"
      onSubmit={(e) => {
        e.preventDefault();
        if (!problem) submit.mutate();
      }}
    >
      <p className="m-0 text-[14px] font-semibold text-ink-soft">Use the details on your birth record. The time matters: the Moon moves about half a degree an hour, so a few hours can change a line.</p>
      <label className="block">
        <span className="block text-[14px] font-bold">Birth date</span>
        <input type="date" value={input.date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set({ date: e.target.value })} className={FIELD} required />
      </label>
      <label className="block">
        <span className="block text-[14px] font-bold">Birth time</span>
        <input type="time" value={input.time} onChange={(e) => set({ time: e.target.value })} className={FIELD} required />
      </label>
      <label className="block">
        <span className="block text-[14px] font-bold">Time zone of the place you were born</span>
        <input list="design-zones" value={input.zone} onChange={(e) => set({ zone: e.target.value })} placeholder="Asia/Kolkata" className={FIELD} required />
        <datalist id="design-zones">
          {zoneList().map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        <span className="mt-xs block text-[12px] font-semibold text-ink-soft">The zone then, not now: it sets summer time and old offsets right. Start typing a city, like Kolkata or London.</span>
      </label>
      <label className="block">
        <span className="block text-[14px] font-bold">Full name on your birth record (optional)</span>
        <input value={input.name} maxLength={80} autoComplete="off" onChange={(e) => set({ name: e.target.value })} placeholder="Asha Devi Rao" className={FIELD} />
        <span className="mt-xs block text-[12px] font-semibold text-ink-soft">For numerology: it gives your Expression, Soul urge and Personality numbers. Leave it empty and you still get the numbers from your birth date.</span>
      </label>
      <label className="block">
        <span className="block text-[14px] font-bold">Place (optional)</span>
        <input value={input.place} maxLength={80} onChange={(e) => set({ place: e.target.value })} placeholder="Mumbai" className={FIELD} />
      </label>
      <p className="m-0 rounded-tile bg-paper p-sm text-[12px] font-semibold text-ink-soft">Only you see your birth details. The assistant and your next steps only ever learn your type, strategy, authority and profile, and only if you allow them.</p>
      {(error ?? (dirty.current ? problem : null)) && (
        <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          {error ?? problem}
        </p>
      )}
      <Button type="submit" size="lg" full disabled={submit.isPending || problem !== null}>
        {submit.isPending ? 'Working it out' : 'Work out my chart'}
      </Button>
    </form>
  );
}

function AddGoal({ pillar, title, step }: { pillar: RelationshipKey; title: string; step: string }) {
  const refresh = useRefreshAll();
  const [msg, setMsg] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: async () => {
      const { nodes } = await api.nodes(pillar);
      const project = nodes.find((n) => n.kind === 'project' && n.status === 'active');
      if (!project) throw new Error('This pillar has no project yet. Set it up first.');
      return api.createNode({ kind: 'task', parentId: project.id, relationship: pillar, title: title.slice(0, 140), note: step.slice(0, 500) });
    },
    onSuccess: () => {
      setMsg('Added. It waits in Not scheduled yet on Daily until you pick a day.');
      refresh();
    },
    onError: (e) => setMsg(e instanceof Error ? e.message : 'Could not add it.'),
  });
  return (
    <div>
      <Button size="sm" variant="outline" onClick={() => add.mutate()} disabled={add.isPending || add.isSuccess}>
        {add.isSuccess ? 'Added' : 'Add as a task'}
      </Button>
      {msg && <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">{msg}</p>}
    </div>
  );
}

function DesignView({ result, onEdit }: { result: DesignResult; onEdit: () => void }) {
  const [zodiac, setZodiac] = useState<Zodiac>('tropical');
  const [depth, setDepth] = useState<'3d' | '5d' | '7d' | 'num'>('3d');
  const chart = designChart(result, zodiac);
  const a = analyseDesign(chart);
  const cmp = designCompare(result);
  const t = DESIGN_TYPES[chart.type];
  const rel = RELATIONSHIP_BY_KEY[ACCENT.design];
  const other = zodiac === 'tropical' ? 'fagan' : 'tropical';
  // In the birthplace's own clock, so the time reads as it does on the birth record.
  const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: result.input.zone });
  return (
    <>
      <Hero kind="design" big={`${t.name}`} title={`${chart.profile.text} profile, ${a.headline.split(', ')[1]}`} line={`Strategy: ${t.strategy}.`} />
      <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">
        {result.input.place ? `${result.input.place}. ` : ''}Born {when(result.birthUtc)} ({result.input.zone}). Your design moment, when the Sun stood 88° earlier, was {when(result.designUtc)} there.
      </p>

      <div className="mt-sm grid gap-xs md:grid-cols-2">
        <div role="group" aria-label="Zodiac" className="flex flex-wrap gap-xs">
          {ZODIACS.map((z) => (
            <button key={z.key} type="button" aria-pressed={zodiac === z.key} onClick={() => setZodiac(z.key)} className={`toy min-h-[44px] rounded-pill border-2 px-md text-[14px] font-bold ${zodiac === z.key ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
              {z.name}
            </button>
          ))}
        </div>
        <p className="m-0 text-[12px] font-semibold text-ink-soft">{ZODIACS.find((z) => z.key === zodiac)!.blurb}</p>
      </div>
      {zodiac === 'fagan' && <p className="mt-xs m-0 rounded-tile bg-paper p-sm text-[12px] font-semibold">Human design is drawn in the tropical zodiac. The sidereal reading is an experiment: every position moves back about {Math.round(result.ayanamsa.personality * 10) / 10}°, which is about four gates, so expect a different chart.</p>}

      <div className="scroll-row mt-sm flex gap-xs" role="group" aria-label="Layer of the reading">
        {DESIGN_DEPTHS.map((d) => (
          <button key={d.key} type="button" aria-pressed={depth === d.key} onClick={() => setDepth(d.key)} className={`toy min-h-[44px] shrink-0 rounded-pill border-2 px-md text-[14px] font-bold ${depth === d.key ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
            {d.name}
          </button>
        ))}
      </div>
      <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">{DESIGN_DEPTHS.find((d) => d.key === depth)!.blurb} {depth === 'num' ? 'Numerology is another way to reflect, and is not science.' : 'The three layers are the app’s own way to group a chart. They are not part of the old system.'}</p>

      {depth === 'num' && <NumerologyPanel result={result} onEdit={onEdit} />}

      {depth !== 'num' && (
        <>

      <div className="mt-md grid gap-md md:grid-cols-[260px_1fr]">
        <div>
          <BodyGraph defined={chart.defined} links={chart.channels.map((c) => c.centers)} />
          <p className="mt-xs m-0 text-center text-[12px] font-semibold text-ink-soft">{chart.defined.length} of 9 centers defined, {chart.channels.length} channels</p>
        </div>
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {a.depths[depth].map((b) => (
            <li key={b.title} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <h3 className="text-[18px]">{b.title}</h3>
              <p className="mt-xs m-0 text-[14px] font-semibold">{b.text}</p>
              {b.items && b.items.length > 0 && (
                <ul className="mt-xs m-0 list-disc pl-md text-[14px] font-semibold">
                  {b.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      <Section id="design-goals" title="Goals you can do and count" lede="Each comes from your chart and lands on one of your seven pillars. Add one as a task, and pick a day for it on Daily.">
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {a.goals.map((g) => (
            <li key={g.title} className="rounded-tile p-sm shadow-toy-soft" style={{ background: `var(--soft-${g.pillar})` }}>
              <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide" style={{ color: `var(--deep-${g.pillar})` }}>
                {RELATIONSHIP_BY_KEY[g.pillar].name}
              </p>
              <h3 className="text-[18px]">{g.title}</h3>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{g.why}</p>
              <p className="mt-xs m-0 text-[14px] font-semibold"><span className="font-extrabold">First step: </span>{g.step}</p>
              <p className="mt-xs m-0 text-[14px] font-semibold"><span className="font-extrabold">How you will know: </span>{g.proof}</p>
              <div className="mt-xs flex flex-wrap items-center gap-xs">
                <AddGoal pillar={g.pillar} title={g.title} step={g.step} />
                <Link to={`/realm/${g.pillar}`} className="text-[14px] font-bold underline underline-offset-4">
                  Open this pillar
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="design-planets" title={`Where each body stood (${zodiac === 'tropical' ? 'tropical' : 'sidereal'}, with the other beside it)`} lede="Conscious is the moment you were born. Unconscious is the design moment, 88° of the Sun earlier. Each shows its gate and line.">
        <div className="overflow-x-auto rounded-tile bg-card p-xs shadow-toy-soft">
          <table className="w-full min-w-[520px] border-collapse text-left text-[14px] font-semibold">
            <thead>
              <tr className="text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">
                <th className="p-xs">Body</th>
                <th className="p-xs">Conscious</th>
                <th className="p-xs">Gate</th>
                <th className="p-xs">Unconscious</th>
                <th className="p-xs">Gate</th>
              </tr>
            </thead>
            <tbody>
              {DESIGN_BODIES.map((b, i) => {
                const p = chart.personality[i]!;
                const d = chart.design[i]!;
                const po = designChart(result, other).personality[i]!;
                const dob = designChart(result, other).design[i]!;
                return (
                  <tr key={b.key} className="border-t border-line">
                    <td className="p-xs font-bold">{b.glyph} {b.name}</td>
                    <td className="p-xs">{signOf(p.lon).text}<span className="block text-[12px] text-ink-soft">{signOf(po.lon).text}</span></td>
                    <td className="p-xs">{p.gate}.{p.line}<span className="block text-[12px] text-ink-soft">{po.gate}.{po.line}</span></td>
                    <td className="p-xs">{signOf(d.lon).text}<span className="block text-[12px] text-ink-soft">{signOf(dob.lon).text}</span></td>
                    <td className="p-xs">{d.gate}.{d.line}<span className="block text-[12px] text-ink-soft">{dob.gate}.{dob.line}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">The grey line under each number is the {other === 'fagan' ? 'sidereal (Fagan-Bradley)' : 'tropical'} reading of the same moment.</p>
        {a.edges.length > 0 && <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">These sit very near the edge of a line, so another program may call the next line: {a.edges.join('; ')}.</p>}
      </Section>

      <Section id="design-compare" title="Tropical and sidereal side by side">
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {cmp.lines.map((l) => (
            <li key={l} className="rounded-tile bg-card p-sm text-[14px] font-semibold shadow-toy-soft">
              {l}
            </li>
          ))}
        </ul>
      </Section>
        </>
      )}
      <p className="mt-sm m-0 text-[12px] font-semibold text-ink-soft">Human design is a system for self-reflection. It is not science and it cannot predict anything. Use it the way you would use a journal prompt: keep what helps, and leave the rest. Positions are worked out here to a few arc minutes, a little less exact for the outer planets.</p>
      <p className="m-0 text-[12px] font-semibold text-ink-soft" style={{ color: rel.deep }} aria-hidden="true" />
    </>
  );
}

const numText = (v: NumberValue) => (v.master ? `${v.value}/${v.base}` : String(v.value));
const chainText = (v: NumberValue) => (v.chain.length > 1 ? v.chain.join(' → ') : v.master ? 'a master number' : 'a single digit');

/** The numbers in the birth date and name, the special numbers among them, and what they say next to Discover's own results. */
function NumerologyPanel({ result, onEdit }: { result: DesignResult; onEdit: () => void }) {
  const core = useDiscover();
  const more = useDiscoverMore();
  const today = todayLocal();
  const n = computeNumerology(result.input.date, result.input.name);
  const cycle = personalCycle(result.input.date, today);
  const latest = core.data?.latest ?? null;
  const prof = latest ? discoverProfile(latest.result, latest.createdAt) : null;
  const love = more.data?.extras.love.result as { receive: Record<'words' | 'time' | 'gifts' | 'acts' | 'touch', number>; give: Record<'words' | 'time' | 'gifts' | 'acts' | 'touch', number> } | null | undefined;
  const ctx: NumerologyContext = {
    traits: prof?.bands ?? null,
    top: prof?.top,
    growth: prof?.growth ?? null,
    design: designProfile(result),
    love: love ? { receive: loveTop(love.receive), give: loveTop(love.give) } : null,
  };
  const insights = numerologyInsights(n, cycle, ctx);
  const tiles: { key: string; label: string; v: NumberValue | null; hint: string }[] = [
    { key: 'lifePath', label: NUMBER_LABELS.lifePath.name, v: n.lifePath, hint: NUMBER_LABELS.lifePath.line },
    { key: 'expression', label: NUMBER_LABELS.expression.name, v: n.expression, hint: NUMBER_LABELS.expression.line },
    { key: 'soulUrge', label: NUMBER_LABELS.soulUrge.name, v: n.soulUrge, hint: NUMBER_LABELS.soulUrge.line },
    { key: 'personality', label: NUMBER_LABELS.personality.name, v: n.personality, hint: NUMBER_LABELS.personality.line },
    { key: 'birthday', label: NUMBER_LABELS.birthday.name, v: n.birthday, hint: NUMBER_LABELS.birthday.line },
    { key: 'attitude', label: NUMBER_LABELS.attitude.name, v: n.attitude, hint: NUMBER_LABELS.attitude.line },
    { key: 'maturity', label: NUMBER_LABELS.maturity.name, v: n.maturity, hint: NUMBER_LABELS.maturity.line },
    { key: 'year', label: 'Personal year', v: cycle.year, hint: YEAR_THEMES[cycle.year.value]?.theme ?? '' },
    { key: 'month', label: 'Personal month', v: cycle.month, hint: 'This month inside your year.' },
    { key: 'day', label: 'Personal day', v: cycle.day, hint: 'Today inside your month.' },
  ];
  const shown = tiles.filter((t) => t.v);
  // Every special number that shows up in any of them: the master numbers, the turning point 10, and the karmic debts.
  const specials = Array.from(new Set(shown.flatMap((t) => [...(t.v!.chain.filter((c) => c === 10)), ...(t.v!.master ? [t.v!.value] : [])])));
  const debts = Array.from(new Set(shown.map((t) => t.v!.karmic).filter((k): k is 13 | 14 | 16 | 19 => k !== null)));
  const readings = (['lifePath', 'expression', 'soulUrge', 'maturity'] as const).map((k) => ({ k, v: n[k] })).filter((x): x is { k: typeof x.k; v: NumberValue } => x.v !== null);
  const KIND = { agree: 'Your answers agree', stretch: 'A stretch', combo: 'Put together' } as const;
  return (
    <>
      <Section id="num-numbers" title="Your numbers" lede="From your birth date and, if you gave it, the full name on your birth record. Each settles to 1 to 9 or a master number. The sums on the way down are shown, since 10, 13, 14, 16 and 19 carry their own meaning.">
        <ul className="m-0 grid list-none grid-cols-2 gap-xs p-0 md:grid-cols-4">
          {shown.map((t, i) => (
            <li key={t.key} className={bento(i, shown.length, 2, 4)}>
              <StatTile label={t.label} value={numText(t.v!)} hint={`${chainText(t.v!)}${t.v!.karmic ? `, karmic ${t.v!.karmic}` : ''}`} className="h-full" />
            </li>
          ))}
        </ul>
        {!n.expression && (
          <div className="mt-xs rounded-tile bg-card p-sm shadow-toy-soft">
            <p className="m-0 text-[14px] font-semibold">Add the full name on your birth record to see your Expression, Soul urge, Personality and Maturity numbers.</p>
            <Button className="mt-xs" size="sm" variant="outline" onClick={onEdit}>
              Add my name
            </Button>
          </div>
        )}
        <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">Your personal year turns over on 1 January. Letters use the Pythagorean table: A to I are 1 to 9, J to R are 1 to 9, S to Z are 1 to 8.</p>
      </Section>

      <Section id="num-read" title="What your main numbers say">
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {readings.map(({ k, v }) => {
            const r = NUMBER_READINGS[v.value]!;
            return (
              <li key={k} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{NUMBER_LABELS[k].name}</p>
                <h3 className="text-[18px]">
                  {numText(v)}, {r.name}
                </h3>
                <p className="mt-xs m-0 text-[14px] font-semibold">{r.line}</p>
                <p className="mt-xs m-0 text-[14px] font-semibold"><span className="font-extrabold">Your gift: </span>{r.gift}</p>
                <p className="mt-xs m-0 text-[14px] font-semibold"><span className="font-extrabold">Watch for: </span>{r.shadow}</p>
                <p className="mt-xs m-0 text-[14px] font-semibold"><span className="font-extrabold">Try this week: </span>{r.tryThis}</p>
              </li>
            );
          })}
        </ul>
      </Section>

      {(specials.length > 0 || debts.length > 0 || n.lessons.length > 0) && (
        <Section id="num-special" title="The special numbers in your chart">
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {specials.map((sp) => (
              <li key={sp} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <h3 className="text-[18px]">
                  {sp}, {NUMBER_READINGS[sp]!.name}
                </h3>
                <p className="mt-xs m-0 text-[14px] font-semibold">{NUMBER_READINGS[sp]!.line}</p>
                {[11, 22, 33].includes(sp) && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">A master number can be a heavy load. If it feels like too much, live the {NUMBER_READINGS[sp]!.line.match(/high (\d)/)?.[1]} first, and grow into the master a step at a time.</p>}
                <p className="mt-xs m-0 text-[14px] font-semibold"><span className="font-extrabold">Try this week: </span>{NUMBER_READINGS[sp]!.tryThis}</p>
              </li>
            ))}
            {debts.map((d) => (
              <li key={d} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <h3 className="text-[18px]">Karmic number {d}</h3>
                <p className="mt-xs m-0 text-[14px] font-semibold">{KARMIC_DEBTS[d]}</p>
              </li>
            ))}
            {n.lessons.length > 0 && (
              <li className="rounded-tile bg-card p-sm shadow-toy-soft">
                <h3 className="text-[18px]">Karmic lessons: {n.lessons.join(', ')}</h3>
                <p className="mt-xs m-0 text-[14px] font-semibold">No letter in your name carries {n.lessons.length === 1 ? 'this number' : 'these numbers'}, so {n.lessons.length === 1 ? 'it is' : 'they are'} a place to practise.</p>
                <ul className="mt-xs m-0 list-disc pl-md text-[14px] font-semibold">
                  {n.lessons.map((l) => (
                    <li key={l}>
                      {l}, {NUMBER_READINGS[l]!.name}: {NUMBER_READINGS[l]!.tryThis}
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
        </Section>
      )}

      <Section id="num-cycle" title="Where you are now" lede="Your personal year, month and day. They set the mood of a stretch of time, and are not a forecast.">
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {([['Year', cycle.year], ['Month', cycle.month], ['Day', cycle.day]] as const).map(([label, v]) => {
            const y = YEAR_THEMES[v.value] ?? YEAR_THEMES[v.base]!;
            return (
              <li key={label} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <h3 className="text-[18px]">
                  {label} {numText(v)}
                </h3>
                <p className="mt-xs m-0 text-[14px] font-semibold">{y.theme.replace(/year/, label.toLowerCase())}</p>
                <p className="mt-xs m-0 text-[14px] font-semibold"><span className="font-extrabold">A good small step: </span>{y.step}</p>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="num-insights" title="What your numbers say next to your Discover results" lede={latest ? 'Where the numbers and your own answers agree, where they stretch you, and how they fit with your Human design. A number says what you may be here to build, not what you have built.' : 'Take the main Discover quiz to see how your numbers line up with your own answers. Until then, here is how they fit with your Human design.'}>
        {insights.length === 0 ? (
          <p className="m-0 rounded-tile bg-card p-sm text-[14px] font-semibold shadow-toy-soft">Nothing lines up strongly yet. Your answers sit near the middle on the traits your numbers lean on.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {insights.map((x) => (
              <li key={x.title} className="rounded-tile p-sm shadow-toy-soft" style={{ background: x.pillar ? `var(--soft-${x.pillar})` : 'var(--color-card)' }}>
                <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{KIND[x.kind]}</p>
                <h3 className="text-[18px]">{x.title}</h3>
                <p className="mt-xs m-0 text-[14px] font-semibold">{x.text}</p>
                <p className="mt-xs m-0 text-[14px] font-semibold"><span className="font-extrabold">A small step: </span>{x.step}</p>
                {x.pillar && (
                  <div className="mt-xs flex flex-wrap items-center gap-xs">
                    <AddGoal pillar={x.pillar} title={x.step.slice(0, 140)} step={x.text} />
                    <Link to={`/realm/${x.pillar}`} className="text-[14px] font-bold underline underline-offset-4">
                      Open this pillar
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {latest && <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">Your strengths: {latest.result.top.map((k) => DISCOVER_STRENGTHS[k].name).join(', ')}.</p>}
      </Section>
      <p className="mt-sm m-0 text-[12px] font-semibold text-ink-soft">Numerology is a system for self-reflection. It is not science, it cannot predict anything, and different schools add the numbers in slightly different ways. Use it like a journal prompt.</p>
    </>
  );
}

function DesignScreen({ onBack }: { onBack: () => void }) {
  const q = useDiscoverMore();
  const me = useAuthed(['me-birth'], api.me);
  const refresh = useRefreshAll();
  const st: ExtraState | undefined = q.data?.extras.design;
  const [mode, setMode] = useState<'form' | 'result' | null>(null);
  const remove = useMutation({
    mutationFn: () => api.deleteExtra('design'),
    onSuccess: () => {
      refresh();
      onBack();
    },
  });
  useEffect(() => {
    if (st && mode === null) setMode(st.result ? 'result' : 'form');
  }, [st, mode]);
  const head = (
    <header className="pt-lg">
      <button type="button" onClick={onBack} className="toy mb-xs inline-flex min-h-[44px] items-center text-[14px] font-bold text-ink-soft hover:text-ink">
        ← Discover
      </button>
      <h1 className="text-[30px]">Human design</h1>
    </header>
  );
  if (q.isPending || mode === null || !st) {
    return (
      <>
        {head}
        <p className="mt-md text-[14px] font-bold text-ink-soft" role="status">
          Opening it
        </p>
      </>
    );
  }
  if (mode === 'form') {
    return (
      <>
        {head}
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">A birth chart read as a map of how you are built to work, decide and give. It shows your type, strategy, authority, profile and cross, in the tropical and the sidereal zodiac, in three layers, with goals you can do.</p>
        <DesignForm initial={parseDesignInput(st.draft)} birthDate={me.data?.user.birthDate ?? ''} onDone={() => setMode('result')} />
      </>
    );
  }
  return (
    <>
      {head}
      {st.takenAt && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Worked out {new Date(st.takenAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}. Only you can see this.</p>}
      <DesignView result={st.result as DesignResult} onEdit={() => setMode('form')} />
      <UseSwitches kind="design" />
      <div className="mt-md flex flex-wrap gap-xs">
        <Button variant="outline" onClick={() => setMode('form')}>
          Change my birth details
        </Button>
        <Button variant="ghost" onClick={() => window.confirm('Delete your chart and your birth details for good?') && remove.mutate()} disabled={remove.isPending}>
          Delete this chart
        </Button>
      </div>
    </>
  );
}
