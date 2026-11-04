import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { EyeOff, HelpCircle, ListChecks } from 'lucide-react';
import { formatCount, money, NOT_TO_DO_TITLE_MAX, RELATIONSHIP_BY_KEY, RELATIONSHIPS, type Insight, type InsightApp, type InsightKey, type InsightChart, type RelationshipKey, type Repeat, type TagTone } from '@kreators/shared';
import { api } from '../lib/api';
import { useMe } from '../lib/queries';
import { todayLocal } from '../lib/date';
import { fillVar } from '../lib/relFill';
import { bento } from '../lib/bento';
import { FIELD, LABEL } from '../lib/ui';
import { HBars, PillBars, Donut, Legend, WeekDots } from './Charts';
import { Section, SeeAll } from './Section';
import { StatusTag } from './StatusTag';
import { CardHead } from './CardHead';
import { MoreMenu } from './MoreMenu';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { RepeatPicker } from './RepeatPicker';
import { ErrorLine } from './ErrorLine';
import { Reveal } from './fx/Reveal';
import { useInsights } from './EmergenceSlot';

export { useInsights };

/**
 * Emerging (2026-11-04): the patterns `insightsFor` in shared finds in what the person already logs, read on demand from
 * GET /insights. Owner only and nothing stored. A screen drops in `EmergenceBlock` after its numbers and before How it works;
 * it shows only the ready lines that touch that app and draws nothing at all when there are none.
 */

/** "Not now" hides a card on this device only (a viewer's convenience, never needed for the page to work). */
function useHidden(): [Set<string>, (id: string) => void] {
  const me = useMe();
  const key = me.data ? `kreators.insightsHidden:${me.data.user.id}` : null;
  const read = (): string[] => {
    if (!key) return [];
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
      return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(-100) : [];
    } catch {
      return [];
    }
  };
  const [ids, setIds] = useState<string[] | null>(null);
  const list = ids ?? read();
  const hide = (id: string) => {
    const next = [...list.filter((x) => x !== id), id].slice(-100);
    setIds(next);
    try {
      if (key) localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* private window: hidden for this visit only */
    }
  };
  return [new Set(list), hide];
}

const TAG: Record<Insight['key'], { tone: TagTone; word: string }> = {
  // A task you keep doing that does not repeat yet; "Good habit" and "Bad habit" are the tie's own words.
  habit: { tone: 'calm', word: 'Comes back' },
  'habit-tie': { tone: 'calm', word: 'Same days' },
  'pillar-balance': { tone: 'calm', word: 'Balance' },
  'best-hours': { tone: 'calm', word: 'Your hours' },
  'streak-weekday': { tone: 'warm', word: 'Streak' },
  'sleep-mood': { tone: 'calm', word: 'Same days' },
  'focus-tasks': { tone: 'calm', word: 'Same days' },
  'stress-calm': { tone: 'calm', word: 'Same days' },
  'daytype-done': { tone: 'calm', word: 'Same days' },
  'money-stress': { tone: 'calm', word: 'Same days' },
  'slips-sleep': { tone: 'calm', word: 'Same days' },
  'routine-tasks': { tone: 'calm', word: 'Same days' },
  'journal-mood': { tone: 'calm', word: 'Same days' },
  'review-since': { tone: 'info', word: 'Since review' },
  'discover-strength': { tone: 'calm', word: 'Strength' },
  'agency-load': { tone: 'calm', word: 'Same days' },
};

function tagOf(i: Insight): { tone: TagTone; word: string } {
  // A quiet focus pillar is worth a look; every other line keeps its plain tone.
  if (i.key === 'pillar-balance' && i.strength >= 60) return { tone: 'warn', word: 'Worth a look' };
  // A good or bad habit: the word is always shown, so the colour is never the only sign.
  if (i.tie) return i.tie.verdict === 'good' ? { tone: 'good', word: 'Good habit' } : { tone: 'bad', word: 'Bad habit' };
  return TAG[i.key];
}

const isMoney = (unit: string) => /^[A-Z]{3}$/.test(unit);
function valueText(v: number, unit: string): string {
  // Whole rupees (or the person's whole unit), the same rounding as the number at the top of the card.
  if (isMoney(unit)) return money(Math.round(v / 100) * 100, unit);
  if (unit === '%') return `${Math.round(v)}%`;
  // Averages read with one decimal, like the number at the top of the card; counts of days and minutes stay whole.
  const n = unit === 'days' || unit === 'min' ? formatCount(Math.round(v)) : v.toFixed(1);
  return unit === 'h' ? `${n} h` : unit === 'min' ? `${n} min` : n;
}

const PAIR_COLORS = ['var(--color-r6)', 'var(--color-ink-mute)'];

function InsightChartView({ chart, insight }: { chart: InsightChart; insight: Insight }) {
  const tone = insight.relationship ? fillVar(RELATIONSHIP_BY_KEY[insight.relationship]) : 'var(--color-r6)';
  if (chart.kind === 'pair') {
    // Since a review, only the mover the number speaks of is drawn; the sentence names the other. How many days stand behind each row is
    // in the line under the chart (and read out with the chart), so a card on a phone stays short.
    const rows = insight.key === 'review-since' ? chart.rows.slice(0, 2) : chart.rows;
    const top = new Map<string, number>();
    for (const r of rows) top.set(r.unit, Math.max(top.get(r.unit) ?? 0, Math.abs(r.value)));
    return (
      <HBars
        stacked
        label={rows.map((r) => `${r.label}: ${valueText(r.value, r.unit)}, ${formatCount(r.n)} days`).join('. ')}
        rows={rows.map((r, i) => ({
          key: `${i}-${r.label}`,
          label: r.label,
          value: Math.abs(r.value) / Math.max(1e-9, top.get(r.unit) ?? 1),
          text: valueText(r.value, r.unit),
          color: PAIR_COLORS[i % 2]!,
        }))}
      />
    );
  }
  if (chart.kind === 'week' || chart.kind === 'hours') {
    const max = Math.max(1, ...chart.values);
    const label = chart.labels.map((l, i) => `${l}: ${formatCount(chart.values[i] ?? 0)}`).join(', ');
    return <PillBars values={chart.values} max={max} labels={chart.labels} color={tone} label={label} height={72} allLabels />;
  }
  if (chart.kind === 'share') {
    const total = chart.parts.reduce((s, p) => s + Math.max(0, p.value), 0);
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
    const shown = [...chart.parts].filter((p) => p.value > 0 || p.relationship === chart.mark).sort((a, b) => b.value - a.value);
    const legend = shown.slice(0, 4);
    if (chart.mark && !legend.some((p) => p.relationship === chart.mark)) {
      const marked = shown.find((p) => p.relationship === chart.mark);
      if (marked) legend[legend.length - 1] = marked;
    }
    return (
      <div className="flex items-center gap-md">
        <Donut size={96} stroke={14} label={shown.map((p) => `${RELATIONSHIP_BY_KEY[p.relationship].name} ${pct(p.value)}%`).join(', ')} segments={RELATIONSHIPS.map((r) => ({ value: chart.parts.find((p) => p.relationship === r.key)?.value ?? 0, color: fillVar(r), label: r.name }))} />
        <div className="min-w-0 flex-1">
          <Legend items={legend.map((p) => ({ color: fillVar(RELATIONSHIP_BY_KEY[p.relationship]), label: RELATIONSHIP_BY_KEY[p.relationship].name, text: `${pct(p.value)}%` }))} />
        </div>
      </div>
    );
  }
  // Four weeks of days, one row of seven dots each.
  const weeks: { date: string; on: boolean }[][] = [];
  for (let i = 0; i < chart.days.length; i += 7) weeks.push(chart.days.slice(i, i + 7));
  return (
    <div className="flex flex-col gap-xs">
      {weeks.map((w, i) => (
        <WeekDots key={i} days={w.map((d) => d.on)} color={tone} label={`Week ${i + 1}: ${w.filter((d) => d.on).length} of ${w.length} days`} />
      ))}
    </div>
  );
}

const ACTION = 'toy toy-ink btn-outline inline-flex min-h-[48px] min-w-0 flex-1 items-center justify-center rounded-pill border border-ink/30 bg-card-strong px-md text-center text-[16px] font-semibold text-ink';

/** One pattern: the number first, one sentence, a small chart, where it came from, and one outline action. */
/** A card's foot: its one outline action (a link, Make it a habit, or Add to not to do), the More menu, and their sheets. */
function InsightActions({ insight, onHide, compact = false }: { insight: Insight; onHide?: () => void; compact?: boolean }) {
  const [habitOpen, setHabitOpen] = useState(false);
  const [ntdOpen, setNtdOpen] = useState(false);
  const navigate = useNavigate();
  const a = insight.action;
  const tie = insight.tie;
  const cls = compact ? ACTION.replace('min-h-[48px]', 'min-h-[44px]').replace('text-[16px]', 'text-[14px]') : ACTION;
  // Tied back to the task: the card's More menu always opens where it lives, unless the main action already does.
  const openTie = tie && !(a?.kind === 'link' && a.to === tie.to) ? [{ key: 'open', label: tie.toLabel, icon: ListChecks, onSelect: () => navigate(tie.to) }] : [];
  const more = [
    ...openTie,
    ...(onHide ? [{ key: 'hide', label: 'Not now', icon: EyeOff, hint: 'On this device', onSelect: onHide }] : []),
    { key: 'how', label: 'How this works', icon: HelpCircle, onSelect: () => navigate('/help#faq') },
  ];
  return (
    <>
      <div className={`${compact ? '' : 'mt-auto pt-xs'} flex items-center gap-sm`}>
        {a && a.kind === 'habit' && insight.habit ? (
          <button type="button" className={cls} onClick={() => setHabitOpen(true)} aria-haspopup="dialog">
            {a.label}
          </button>
        ) : a && a.kind === 'notToDo' && tie ? (
          <button type="button" className={cls} onClick={() => setNtdOpen(true)} aria-haspopup="dialog">
            {a.label}
          </button>
        ) : a ? (
          <Link to={a.to} className={cls}>
            {a.label}
          </Link>
        ) : (
          <span className="flex-1" />
        )}
        <MoreMenu items={more} label={`More about this pattern`} title="This pattern" />
      </div>
      {insight.habit && habitOpen && <HabitSheet insight={insight} onClose={() => setHabitOpen(false)} />}
      {tie && ntdOpen && <NotToDoSheet title={tie.title} relationship={tie.relationship} onClose={() => setNtdOpen(false)} />}
    </>
  );
}

/** One pattern: the number first, one sentence, a small chart, where it came from, and one outline action. */
export function InsightCard({ insight, onHide }: { insight: Insight; onHide?: () => void }) {
  const tag = tagOf(insight);
  return (
    <article className="flex h-full w-full flex-col gap-sm rounded-tile bg-card p-md shadow-toy-soft" aria-label={insight.text}>
      <div className="flex items-start justify-between gap-sm">
        <p className={`m-0 min-w-0 font-display font-extrabold leading-tight tabular-nums ${insight.headline.length > 10 ? 'text-[24px]' : 'text-[28px]'}`}>{insight.headline}</p>
        <StatusTag tone={tag.tone}>{tag.word}</StatusTag>
      </div>
      <p className="m-0 text-balance text-[16px] font-semibold">{insight.text}</p>
      {insight.chart && <InsightChartView chart={insight.chart} insight={insight} />}
      {insight.basis && <p className="m-0 text-[12px] font-bold text-ink-soft">{insight.basis}</p>}
      <InsightActions insight={insight} onHide={onHide} />
    </article>
  );
}

/**
 * "Make it a habit": the repeat, the time and the first day, prefilled from when it was ticked. Keep writes through the
 * ordinary task routes (PATCH /nodes/:id on the open task, else POST /nodes under its project) and nothing earlier.
 */
export function HabitSheet({ insight, onClose }: { insight: Insight; onClose: () => void }) {
  const h = insight.habit!;
  const qc = useQueryClient();
  const [repeat, setRepeat] = useState<Repeat | null>(h.repeat);
  const [first, setFirst] = useState(h.firstDay);
  const [time, setTime] = useState(h.time ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const pillar = RELATIONSHIP_BY_KEY[h.relationship];
  const keep = async () => {
    if (!repeat) {
      setErr(new Error('Pick how often it comes back.'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (h.openTaskId) {
        const { node } = await api.node(h.openTaskId);
        const dated = Boolean(node.doDate || node.dueDate);
        await api.updateNode(h.openTaskId, { repeat, habit: true, ...(dated ? {} : { doDate: first }), dueTime: time || null });
      } else if (h.projectId) {
        await api.createNode({ kind: 'task', parentId: h.projectId, relationship: h.relationship, title: h.title, repeat, habit: true, doDate: first, dueTime: time || null });
      }
      await qc.invalidateQueries();
      onClose();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Make it a habit">
      <div className="flex flex-col gap-md pb-xl md:pb-0">
        <div>
          <p className="m-0 text-[18px] font-extrabold">{h.title}</p>
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
            {pillar.name} · {formatCount(h.ticks)} ticks in 4 weeks
          </p>
        </div>
        <RepeatPicker value={repeat} anchor={first} onChange={setRepeat} onAnchor={setFirst} />
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>First day</span>
            <input type="date" className={FIELD} value={first} min={todayLocal()} onChange={(e) => e.target.value && setFirst(e.target.value)} />
          </label>
          <label className="block">
            <span className={LABEL}>Time</span>
            <input type="time" className={FIELD} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <p className="m-0 text-[14px] font-semibold text-ink-soft">{h.openTaskId ? 'Your open task gets this repeat.' : 'A new task is added under its project.'} Nothing changes until you tap Keep.</p>
        {err ? <ErrorLine e={err} /> : null}
        <Button full onClick={keep} disabled={busy}>
          {busy ? 'Keeping…' : 'Keep'}
        </Button>
      </div>
    </Sheet>
  );
}

/**
 * "Add to not to do" for a bad habit: the task's words, which can be changed, go on the not to do list through the ordinary
 * create (POST /today/not-to-do, at most seven). Nothing is added until "Add it".
 */
export function NotToDoSheet({ title, relationship, onClose }: { title: string; relationship: RelationshipKey | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [words, setWords] = useState(title.slice(0, NOT_TO_DO_TITLE_MAX));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const add = async () => {
    const t = words.trim();
    if (!t) {
      setErr(new Error('Say what you are staying away from.'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.notToDoAdd(t, relationship);
      await qc.invalidateQueries();
      onClose();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Add to not to do">
      <div className="flex flex-col gap-md pb-xl md:pb-0">
        <label className="block">
          <span className={LABEL}>Stay away from</span>
          <input className={FIELD} value={words} maxLength={NOT_TO_DO_TITLE_MAX} onChange={(e) => setWords(e.target.value)} />
        </label>
        <p className="m-0 text-[14px] font-semibold text-ink-soft">It goes on your not to do list on Daily. Tick it each day you stay away from it.</p>
        {err ? <ErrorLine e={err} /> : null}
        <Button full onClick={add} disabled={busy}>
          {busy ? 'Adding…' : 'Add it'}
        </Button>
      </div>
    </Sheet>
  );
}

/** The cards in a bento grid: the first ones take the full row until the last row is full, so no card is ever alone. */
export function InsightGrid({ list, onHide }: { list: Insight[]; onHide?: (id: string) => void }) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-sm p-0 md:grid-cols-2">
      {list.map((i, n) => (
        <Reveal as="li" key={i.id} index={n} className={`flex ${bento(n, list.length, 1, 2)}`}>
          <InsightCard insight={i} onHide={onHide ? () => onHide(i.id) : undefined} />
        </Reveal>
      ))}
    </ul>
  );
}

/**
 * The block each screen carries: "Emerging", the ready patterns that touch this app (at most `max`), and See all. Nothing at all when
 * there are none, so an app never shows an empty card.
 */
export function EmergenceBlock({ app, rel, max, lede = 'Patterns in what you log.', className = '', exclude }: { app: InsightApp; rel?: RelationshipKey | null; max?: number; lede?: ReactNode; className?: string; /** Keys another block on the screen shows (Daily's Habits). */ exclude?: readonly InsightKey[] }) {
  const q = useInsights(app, rel);
  const [hidden, hide] = useHidden();
  const list = (q.data?.insights ?? []).filter((i) => i.state === 'ready' && !hidden.has(i.id) && !exclude?.includes(i.key)).slice(0, max ?? 2);
  if (!list.length) return null;
  return (
    <Section id={`emerging-${app}${rel ? `-${rel}` : ''}`} title="Emerging" lede={lede} span className={className} action={<SeeAll to="/insights">See all</SeeAll>}>
      <InsightGrid list={list} onHide={hide} />
    </Section>
  );
}

/**
 * Daily's Habits (2026-11-05): the good and bad habits as short rows rather than chart cards, beside the not to do list: the task's
 * words, Good habit or Bad habit in the corner, the one sentence, where it came from, and the same one action and More as the card.
 * The charts stay on /insights (See all).
 */
export function HabitsBlock({ app, className = '' }: { app: InsightApp; className?: string }) {
  const q = useInsights(app);
  const [hidden, hide] = useHidden();
  const list = (q.data?.insights ?? []).filter((i) => i.state === 'ready' && i.key === 'habit-tie' && i.tie && !hidden.has(i.id));
  if (!list.length) return null;
  return (
    <Section id={`habits-${app}`} title="Habits" lede="Tasks you keep doing, beside how those days went." span className={className} action={<SeeAll to="/insights?habits=all">See all</SeeAll>}>
      <ul className="m-0 flex list-none flex-col gap-xs p-0">
        {list.map((i) => {
          const good = i.tie!.verdict === 'good';
          return (
            <li key={i.id} data-pillar={i.tie!.relationship ?? undefined} className="flex flex-col gap-xs rounded-tile bg-card p-sm shadow-toy-soft">
              <CardHead tag={<StatusTag fit tone={good ? 'good' : 'bad'}>{good ? 'Good habit' : 'Bad habit'}</StatusTag>}>
                <p className="m-0 text-[16px] font-bold leading-snug">{i.tie!.title}</p>
              </CardHead>
              <p className="m-0 text-[14px] font-semibold text-ink-soft">{i.text}</p>
              {i.basis && <p className="m-0 text-[12px] font-bold text-ink-soft">{i.basis}</p>}
              <InsightActions insight={i} onHide={() => hide(i.id)} compact />
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

export { useHidden as useHiddenInsights };
