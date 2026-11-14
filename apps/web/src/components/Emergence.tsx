import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { EyeOff, HelpCircle, ListChecks } from 'lucide-react';
import { formatCount, INSIGHT_BASIS_TAIL, LOCALE, money, NOT_TO_DO_TITLE_MAX, RELATIONSHIP_BY_KEY, RELATIONSHIPS, taskKey, type HabitTie, type LifeAreaKey, type Node, type Insight, type InsightApp, type InsightKey, type InsightChart, type RelationshipKey, type Repeat, type TagTone } from '@kreators/shared';
import { api } from '../lib/api';
import { useMe } from '../lib/queries';
import { todayLocal } from '../lib/date';
import { focusHeading, focusHeadingAfter } from '../lib/focusHeading';
import { fillVar } from '../lib/relFill';
import { tbClass, tbStyle } from '../lib/blockColor';
import { evenGrid, evenTile } from '../lib/bento';
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
import { AnimatedIcon } from './AnimatedIcon';
import { useInsights } from './EmergenceSlot';
import { AreaTag } from './TaskPlan';
import { ToggleChevron } from './ToggleMark';
import { STICKY_CLOSE_LANE, StickyClose, useTallOpen } from './StickyClose';
import { useHiddenInsightIds } from '../lib/insightsHidden';

export { useInsights };

/**
 * Emerging (2026-11-04): the patterns `insightsFor` in shared finds in what the person already logs, read on demand from
 * GET /insights. Owner only and nothing stored. A screen drops in `EmergenceBlock` after its numbers and before How it works;
 * it shows only the ready lines that touch that app and draws nothing at all when there are none.
 */

/**
 * "Not now" hides a card on this device only (a viewer's convenience, never needed for the page to work); "Show again" (`show`, from the
 * set-aside list under a block or on /insights) takes it off the list, so nothing set aside is gone for good.
 */
function useHidden(): [Set<string>, (id: string) => void, (id: string) => void] {
  const me = useMe();
  // One store for every block (lib/insightsHidden.ts): each hide and Show again starts from what is stored, so two blocks on one screen never undo each other.
  return useHiddenInsightIds(me.data?.user.id);
}

/**
 * The cards set aside with Not now, listed in place (2026-11-06): each one's words on the left and an outline "Show again" at the right,
 * which puts the card back where it was. On this device only, like Not now.
 */
export function SetAsideList({ id, list, onShow, className = '' }: { id?: string; list: readonly Insight[]; onShow: (id: string) => void; /** The sticky close's lane (`STICKY_CLOSE_LANE`) when the list is its toggle's open content. */ className?: string }) {
  return (
    <ul id={id} aria-label="Set aside" className={`m-0 flex list-none flex-col gap-xs p-0 ${className}`}>
      {list.map((i) => {
        const title = i.tie?.title ?? i.headline;
        return (
          <li key={i.id} className="flex flex-wrap-reverse items-center gap-sm rounded-tile bg-card p-sm">
            <div className="min-w-[60%] flex-1">
              <p className="m-0 text-card-title">{title}</p>
              <p className="m-0 text-card-note text-ink-soft">{i.text}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onShow(i.id)} aria-label={`Show again: ${title}`}>
              Show again
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

export { focusHeading };

/**
 * One quiet line at the foot of a block whose place has cards set aside: "Show 2 set aside", an inline toggle that opens the list in
 * place. Draws nothing when none are set aside. Focus goes back to the toggle after "Show again", since that row leaves the list; after
 * the last one the fold closes (so the next Not now starts it closed) and focus moves to the block's heading (`heading`, its id).
 * Open and taller than the room the window has, its close stays in view beside the list (`StickyClose`, 2026-11-14): the chevron keeps
 * its slot unseen, and the list keeps a lane while the close runs down its own edge, so it never sits on a Show again.
 */
export function SetAsideFold({ list, onShow, heading }: { list: readonly Insight[]; onShow: (id: string) => void; heading?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const railOn = useTallOpen(root, open && list.length > 0);
  if (!list.length) return null;
  const n = formatCount(list.length);
  return (
    <div ref={root} data-sticky-close-root="" className="mt-sm flex flex-col gap-xs">
      <div>
        <button
          ref={toggle}
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="toy toy-flat inline-flex min-h-[44px] items-center gap-xs rounded-pill px-sm text-subhead text-ink-soft"
        >
          {open ? `Hide ${n} set aside` : `Show ${n} set aside`}
          {/* While the sticky close shows, the chevron keeps its slot unseen, as a task card's edit button does. */}
          <ToggleChevron open={open} size={14} className={railOn ? 'invisible' : ''} />
        </button>
      </div>
      {railOn && <StickyClose onClose={() => setOpen(false)} label="Close the cards set aside" opener={() => toggle.current} />}
      {open && (
        <SetAsideList
          id={id}
          className={STICKY_CLOSE_LANE}
          list={list}
          onShow={(x) => {
            const last = list.length <= 1;
            onShow(x);
            if (!last) toggle.current?.focus();
            else {
              setOpen(false);
              focusHeading(heading);
            }
          }}
        />
      )}
    </div>
  );
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
  'daytype-done': { tone: 'calm', word: 'Kinds of day' },
  'money-stress': { tone: 'calm', word: 'Same days' },
  'slips-sleep': { tone: 'calm', word: 'Same days' },
  'routine-tasks': { tone: 'calm', word: 'Same days' },
  'journal-mood': { tone: 'calm', word: 'Same days' },
  'review-since': { tone: 'info', word: 'Since review' },
  'discover-strength': { tone: 'calm', word: 'Strength' },
  'agency-load': { tone: 'calm', word: 'Same days' },
  'block-kept': { tone: 'calm', word: 'Time blocks' },
  'gratitude-mood': { tone: 'calm', word: 'Same days' },
  'move-weekday': { tone: 'calm', word: 'Your week' },
  'eat-days': { tone: 'calm', word: 'Same days' },
  'water-days': { tone: 'calm', word: 'Same days' },
  'water-weekday': { tone: 'calm', word: 'Your week' },
  'budget-over': { tone: 'calm', word: 'Budgets' },
  'budget-pace': { tone: 'calm', word: 'Your pace' },
};

function tagOf(i: Insight): { tone: TagTone; word: string } {
  // A quiet focus pillar is worth a look; every other line keeps its plain tone.
  if (i.key === 'pillar-balance' && i.strength >= 60) return { tone: 'warn', word: 'Worth a look' };
  // Time blocks kept: good when 60% or more of a block's tasks were ticked inside it (the line's strength is 50 or more then).
  if (i.key === 'block-kept' && i.strength >= 50) return { tone: 'good', word: 'Blocks kept' };
  // Budgets: running over is a plain fact (warm, never red), holding is good; the sentence says which one and by how much.
  if (i.key === 'budget-over') return i.strength >= 30 ? { tone: 'warm', word: 'Runs over' } : { tone: 'good', word: 'Held' };
  // A month that has ended says how it ended; one still running, where it stands.
  if (i.key === 'budget-pace') return i.strength >= 30 ? { tone: 'warm', word: /\b(ran|run) over\b/.test(i.text) ? 'Ran over' : 'Ahead' } : { tone: 'good', word: i.text.includes('held') ? 'Held' : 'On pace' };
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

export function InsightChartView({ chart, insight, brief = false }: { chart: InsightChart; insight: Pick<Insight, 'relationship' | 'key'>; /** One pairing only (/insights): the sentence names the other, so the card stays short. */ brief?: boolean }) {
  const tone = insight.relationship ? fillVar(RELATIONSHIP_BY_KEY[insight.relationship]) : 'var(--color-r6)';
  if (chart.kind === 'pair') {
    // Since a review, only the mover the number speaks of is drawn; the sentence names the other. How many days stand behind each row is
    // in the line under the chart (and read out with the chart), so a card on a phone stays short.
    const rows = brief || insight.key === 'review-since' ? chart.rows.slice(0, 2) : chart.rows;
    const top = new Map<string, number>();
    for (const r of rows) top.set(r.unit, Math.max(top.get(r.unit) ?? 0, Math.abs(r.value)));
    return (
      <HBars
        stacked
        label={rows.map((r) => `${r.label}: ${valueText(r.value, r.unit)}, ${formatCount(r.n)} ${insight.key === 'budget-over' ? 'months' : 'days'}`).join('. ')}
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
  if (chart.kind === 'kinds') return <KindsChart chart={chart} />;
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

const daysWord = (n: number) => `${formatCount(n)} ${n === 1 ? 'day' : 'days'}`;
/** An average to one place in LOCALE, with no ".0": 1.4, 2, 12.5. */
const avgWord = (v: number) => v.toLocaleString(LOCALE, { maximumFractionDigits: 1 });
/** A group's facts in plain words: "No tasks ticked", "1 task a day", "2.5 tasks a day", then focus and mood when they are read. */
function kindFacts(r: { n: number; tasks: number; focus: number | null; mood: number | null }): string[] {
  if (r.n === 0) return ['No app use those days'];
  const tasks = r.tasks === 0 ? 'No tasks ticked' : `${avgWord(r.tasks)} ${r.tasks === 1 ? 'task' : 'tasks'} a day`;
  const focus = r.focus === null ? null : Math.round(r.focus) === 0 ? (r.focus > 0 ? 'under 1 min focus' : 'no focus') : `${formatCount(Math.round(r.focus))} min focus`;
  return [tasks, focus, r.mood !== null ? `mood ${avgWord(r.mood)}` : null].filter((f): f is string => Boolean(f));
}

/**
 * Your kinds of day: the four weeks as one strip, each kind in its template's colour (`templateColor` in shared: its own colour, else its
 * longest block's) and the days with no kind left in the strip's own ground, then each group of days with how it went (a kind with no
 * app use on its days still has its row, saying so). The strip is decoration;
 * the list under it says the same in words.
 */
function KindsChart({ chart }: { chart: Extract<InsightChart, { kind: 'kinds' }> }) {
  const total = chart.parts.reduce((s, p) => s + p.days, 0) + chart.none;
  let left = 0;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  return (
    <div className="flex flex-col gap-sm">
      <div className="tb-strip" aria-hidden="true">
        {chart.parts.map((p) => {
          const at = left;
          left += pct(p.days);
          return <span key={p.templateId} className={tbClass(p.color)} style={tbStyle(p.color, { left: `${at}%`, width: `${pct(p.days)}%` })} />;
        })}
      </div>
      <ul className="m-0 flex list-none flex-col gap-xs p-0">
        {chart.rows.map((r) => {
          const part = r.templateId ? chart.parts.find((p) => p.templateId === r.templateId) : null;
          const days = part ? part.days : chart.none;
          const facts = kindFacts(r);
          return (
            <li key={r.templateId ?? 'none'} className={`flex items-start gap-xs ${part ? tbClass(part.color) : ''}`} style={part ? tbStyle(part.color) : ({ '--tb': 'var(--line)' } as CSSProperties)}>
              <span className="tb-dot mt-[4px]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-subhead font-semibold">
                  {r.name} <span className="whitespace-nowrap font-normal text-ink-soft">· {daysWord(days)}</span>
                </span>
                <span className="block text-footnote text-ink-soft">
                  {/* Each fact stays whole ("125 min focus" never splits on a phone); the dot goes with the fact after it. */}
                  {facts.map((f, i) => (
                    <span key={i} className="whitespace-nowrap">
                      {i > 0 ? ' · ' : ''}
                      {f}
                    </span>
                  ))}
                  {r.n > 0 && r.n < days ? (
                    <>
                      , on the <span className="whitespace-nowrap">{r.n === 1 ? 'one day' : `${formatCount(r.n)} days`}</span> you used the app
                    </>
                  ) : null}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const ACTION = 'toy toy-ink btn-outline inline-flex min-h-[40px] md:min-h-[48px] tap-pad min-w-0 flex-1 items-center justify-center rounded-pill border border-ink/30 bg-card-strong px-md text-center text-callout text-ink';

/** The card's More menu: where the habit lives (unless the main action already goes there), Not now and How this works. */
function InsightMore({ insight, onHide }: { insight: Insight; onHide?: () => void }) {
  const navigate = useNavigate();
  const a = insight.action;
  const tie = insight.tie;
  // Tied back to the task: the card's More menu always opens where it lives, unless the main action already does.
  const openTie = tie && !(a?.kind === 'link' && a.to === tie.to) ? [{ key: 'open', label: tie.toLabel, icon: ListChecks, onSelect: () => navigate(tie.to) }] : [];
  const more = [
    ...openTie,
    ...(onHide ? [{ key: 'hide', label: 'Not now', icon: EyeOff, hint: 'On this device', onSelect: onHide }] : []),
    { key: 'how', label: 'How this works', icon: HelpCircle, onSelect: () => navigate('/help#faq') },
  ];
  return <MoreMenu items={more} label={`More about this pattern`} title="This pattern" />;
}

/**
 * A card's foot: its one outline action (a link, Make it a habit, or Add to not to do), the More menu, the habit sheet and the not to do
 * fold under it. `lead` puts a tag at the foot's left, beside the action, which takes the rest of the width; `menu={false}` leaves the
 * More menu out, for a card that carries it in its title row.
 */
function InsightActions({
  insight,
  onHide,
  compact = false,
  lead,
  menu = true,
}: {
  insight: Insight;
  onHide?: () => void;
  compact?: boolean;
  lead?: ReactNode;
  menu?: boolean;
}) {
  const [habitOpen, setHabitOpen] = useState(false);
  const [ntdOpen, setNtdOpen] = useState(false);
  const ntdId = useId();
  const a = insight.action;
  const tie = insight.tie;
  const cls = compact ? ACTION.replace('min-h-[40px] md:min-h-[48px]', 'min-h-[36px] md:min-h-[44px]').replace('text-callout', 'text-subhead') : ACTION;
  return (
    <>
      <div className={`${compact ? '' : 'mt-auto pt-xs'} flex items-center gap-sm`}>
        {lead}
        {a && a.kind === 'habit' && insight.habit ? (
          <button type="button" className={cls} onClick={() => setHabitOpen(true)} aria-haspopup="dialog">
            {a.label}
          </button>
        ) : a && a.kind === 'notToDo' && tie ? (
          <button type="button" className={`${cls} gap-xs`} onClick={() => setNtdOpen((o) => !o)} aria-expanded={ntdOpen} aria-controls={ntdId}>
            {a.label}
            <AnimatedIcon name="plusToX" size={16} active={ntdOpen} className="text-ink-soft" />
          </button>
        ) : a ? (
          <Link to={a.to} className={cls}>
            {a.label}
          </Link>
        ) : menu ? (
          <span className="flex-1" />
        ) : null}
        {menu && <InsightMore insight={insight} onHide={onHide} />}
      </div>
      {insight.habit && habitOpen && <HabitSheet insight={insight} onClose={() => setHabitOpen(false)} />}
      {tie && ntdOpen && <NotToDoFold id={ntdId} title={tie.title} relationship={tie.relationship} onClose={() => setNtdOpen(false)} />}
    </>
  );
}

/** One pattern: the number first, one sentence, a small chart, where it came from, and one outline action. */
export function InsightCard({ insight, onHide, corner = false }: { insight: Insight; onHide?: () => void; /** /insights (2026-11-07): the state tag in the top right corner beside the "…", the number alone on the left. */ corner?: boolean }) {
  const tag = tagOf(insight);
  // Every card carries its "…" in the title row, centred on the number, and its state tag in the foot on the left, beside the outline
  // action that takes the rest of the width (2026-11-06, the founder's card rule: a card's title and "…" share one row, a state tag goes
  // in the row of tags), so every pattern card in a list has one layout.
  return (
    <article className="flex h-full w-full flex-col gap-sm rounded-tile bg-card p-md shadow-toy-soft" aria-label={insight.text}>
      <div className="flex items-center justify-between gap-sm">
        <p className={`m-0 min-w-0 tabular-nums ${insight.headline.length > 10 ? 'text-title2' : 'text-title1'} ${corner && insight.headline.length <= 10 ? 'whitespace-nowrap' : ''}`}>{insight.headline}</p>
        {corner ? (
          <div className="flex shrink-0 items-center gap-xs">
            <StatusTag tone={tag.tone}>{tag.word}</StatusTag>
            <InsightMore insight={insight} onHide={onHide} />
          </div>
        ) : (
          <InsightMore insight={insight} onHide={onHide} />
        )}
      </div>
      <p className="m-0 text-balance text-callout">{insight.text}</p>
      {/* Beside a taller card the chart takes the room left and sits in its middle, so the card never ends in an empty band (2026-11-05). */}
      {insight.chart && (
        <div className="flex flex-1 flex-col justify-center">
          <InsightChartView chart={insight.chart} insight={insight} brief={corner} />
        </div>
      )}
      {/* /insights says it once in its cover, so its cards leave the tail off the small line. */}
      {insight.basis && <p className="m-0 text-caption text-ink-soft">{corner ? insight.basis.replace(` ${INSIGHT_BASIS_TAIL}`, '') : insight.basis}</p>}
      {!corner ? <InsightActions insight={insight} onHide={onHide} menu={false} lead={<StatusTag tone={tag.tone}>{tag.word}</StatusTag>} /> : insight.action ? <InsightActions insight={insight} onHide={onHide} menu={false} /> : null}
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
          <p className="m-0 text-headline">{h.title}</p>
          <p className="mt-xs m-0 text-subhead text-ink-soft">
            {pillar.name} · {formatCount(h.ticks)} ticks {h.within ?? 'in 4 weeks'}
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
        <p className="m-0 text-subhead text-ink-soft">{h.openTaskId ? 'Your open task gets this repeat.' : 'A new task is added under its project.'} Nothing changes until you tap Keep.</p>
        {err ? <ErrorLine e={err} /> : null}
        <Button full onClick={keep} disabled={busy}>
          {busy ? 'Keeping…' : 'Keep'}
        </Button>
      </div>
    </Sheet>
  );
}

/**
 * "Add to not to do" for a bad habit, folded open inside the pattern card (2026-11-06, no sheet): the task's words, which can be
 * changed, go on the not to do list through the ordinary create (POST /today/not-to-do, at most seven). Nothing is added until
 * "Add it". Focus moves into the field when it opens; Escape or Cancel folds it again, back to the button that opened it.
 */
export function NotToDoFold({ id, title, relationship, onClose }: { id: string; title: string; relationship: RelationshipKey | null; onClose: () => void }) {
  const qc = useQueryClient();
  const field = useId();
  const input = useRef<HTMLInputElement>(null);
  const [words, setWords] = useState(title.slice(0, NOT_TO_DO_TITLE_MAX));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const close = () => {
    onClose();
    document.querySelector<HTMLElement>(`[aria-controls="${id}"]`)?.focus();
  };
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
      close();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    close();
  };
  return (
    <form
      id={id}
      aria-label="Add to not to do"
      onKeyDown={onKeyDown}
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
      className="flex flex-col gap-sm rounded-inner bg-paper p-sm"
    >
      <label className="block" htmlFor={field}>
        <span className={LABEL}>Stay away from</span>
        <input id={field} ref={input} className={FIELD} value={words} maxLength={NOT_TO_DO_TITLE_MAX} onChange={(e) => setWords(e.target.value)} />
      </label>
      <p className="m-0 text-subhead text-ink-soft">It goes on your not to do list on Daily. Tick it each day you stay away from it.</p>
      {err ? <ErrorLine e={err} /> : null}
      <div className="flex flex-wrap gap-xs">
        <Button type="submit" variant="outline" disabled={busy}>
          {busy ? 'Adding…' : 'Add it'}
        </Button>
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// Two to a row from the laptop; a tablet's column beside the sidebar (464px) takes the phone's one, so a card's sentence keeps its width (CLAUDE.md, the 768 line).
const PAIR_COLS = { base: 1, lg: 2 } as const;
/** /insights: two to a row only where a card has room for its number, its tag and its menu on one line; by the column's own width. */
const WIDE_PAIR_COLS = { base: 1, '@3xl': 2 } as const;

/** The cards in even rows (lib/bento.ts): two to a row from the tablet, an odd first one across the row, so no card is ever alone. */
export function InsightGrid({ list, onHide, corner = false }: { list: Insight[]; onHide?: (id: string) => void; corner?: boolean }) {
  const cols = corner ? WIDE_PAIR_COLS : PAIR_COLS;
  const grid = (
    <ul className={`m-0 grid list-none gap-sm p-0 ${evenGrid(list.length, cols)}`}>
      {list.map((i, n) => (
        <Reveal as="li" key={i.id} index={n} className={`flex ${evenTile(n, list.length, cols)}`}>
          <InsightCard insight={i} corner={corner} onHide={onHide ? () => onHide(i.id) : undefined} />
        </Reveal>
      ))}
    </ul>
  );
  return corner ? <div className="@container">{grid}</div> : grid;
}

/**
 * The block each screen carries: "Emerging", the ready patterns that touch this app (at most `max`), and See all. Nothing at all when
 * there are none, so an app never shows an empty card.
 */
export function EmergenceBlock({ app, rel, max, lede = 'Patterns in what you log.', className = '', exclude, quietWhenAllAside = false }: { app: InsightApp; rel?: RelationshipKey | null; max?: number; lede?: ReactNode; className?: string; /** Keys another block on the screen shows (Daily's Habits). */ exclude?: readonly InsightKey[]; /** Home and Life: with every card here set aside the slot shows its light section instead, so this block steps aside. */ quietWhenAllAside?: boolean }) {
  const q = useInsights(app, rel);
  const [hidden, hide, show] = useHidden();
  const here = (q.data?.insights ?? []).filter((i) => i.state === 'ready' && !exclude?.includes(i.key));
  const list = here.filter((i) => !hidden.has(i.id)).slice(0, max ?? 2);
  const aside = here.filter((i) => hidden.has(i.id));
  const id = `emerging-${app}${rel ? `-${rel}` : ''}`;
  // With everything here set aside the block stays, holding only the way to bring the cards back (Home and Life show their light section instead).
  if (!list.length && (!aside.length || quietWhenAllAside)) return null;
  return (
    <Section id={id} title="Emerging" lede={list.length ? lede : 'You set these aside.'} span className={className} action={<SeeAll to="/insights">See all</SeeAll>}>
      {list.length > 0 && (
        <InsightGrid
          list={list}
          onHide={(x) => {
            hide(x);
            // The card and its menu go, so the keyboard's place moves to the block's heading (or, when the block leaves too, nowhere).
            focusHeadingAfter(id);
          }}
        />
      )}
      <SetAsideFold list={aside} onShow={show} heading={id} />
    </Section>
  );
}

/**
 * Daily's Habits (2026-11-05): the good and bad habits as short rows rather than chart cards, beside the not to do list: the task's
 * words, Good habit or Bad habit in the corner, the one sentence, where it came from, and the same one action and More as the card.
 * The charts stay on /insights (See all).
 */
/** The area of life a habit's task carries, found among the tasks the screen already holds: by the task it opens, else by its words. */
function areaOfTie(tie: HabitTie, tasks: readonly Node[]): LifeAreaKey | null {
  if (tie.kind !== 'task') return null;
  const id = /[?&]task=([^&#]+)/.exec(tie.to)?.[1];
  const hit = (id && tasks.find((t) => t.id === id)) || tasks.find((t) => t.lifeArea && t.relationship === tie.relationship && taskKey(t.title) === tie.key);
  return hit ? hit.lifeArea : null;
}

export function HabitsBlock({ app, className = '', tasks = [] }: { app: InsightApp; className?: string; /** The screen's tasks, so a habit shows its area of life. */ tasks?: readonly Node[] }) {
  const q = useInsights(app);
  const [hidden, hide, show] = useHidden();
  const ties = (q.data?.insights ?? []).filter((i) => i.state === 'ready' && i.key === 'habit-tie' && i.tie);
  const list = ties.filter((i) => !hidden.has(i.id));
  const aside = ties.filter((i) => hidden.has(i.id));
  // With every habit set aside the block stays, holding only the way to bring them back.
  if (!list.length && !aside.length) return null;
  return (
    <Section id={`habits-${app}`} title="Habits" lede={list.length ? 'Tasks you keep doing, beside how those days went.' : 'You set these aside.'} span className={className} action={<SeeAll to="/insights?habits=all">See all</SeeAll>}>
      {list.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {list.map((i) => {
            const good = i.tie!.verdict === 'good';
            const area = areaOfTie(i.tie!, tasks);
            return (
              <li key={i.id} data-pillar={i.tie!.relationship ?? undefined} className="flex flex-col gap-xs rounded-tile bg-card p-sm shadow-toy-soft">
                <CardHead tag={<StatusTag fit tone={good ? 'good' : 'bad'}>{good ? 'Good habit' : 'Bad habit'}</StatusTag>}>
                  <p className="m-0 text-card-title">{i.tie!.title}</p>
                </CardHead>
                <p className="m-0 text-card-note text-ink-soft">{i.text}</p>
                {i.basis && <p className="m-0 text-caption text-ink-soft">{i.basis}</p>}
                {area && (
                  <div className="flex">
                    <AreaTag area={area} />
                  </div>
                )}
                <InsightActions
                  insight={i}
                  onHide={() => {
                    hide(i.id);
                    focusHeadingAfter(`habits-${app}`);
                  }}
                  compact
                />
              </li>
            );
          })}
        </ul>
      )}
      <SetAsideFold list={aside} onShow={show} heading={`habits-${app}`} />
    </Section>
  );
}

/**
 * Your kinds of day (2026-11-06) as a block of its own on Daily, the Time blocks page and Reviews, so it always has its room there (their
 * Emerging blocks leave it out): the one card from the person's whole list, with Not now like any card. On the Time blocks page (`here`)
 * the card's link to that page is left off.
 */
export function KindsBlock({ className = '', here = false }: { className?: string; here?: boolean }) {
  const q = useInsights('insights');
  const [hidden, hide] = useHidden();
  const card = (q.data?.insights ?? []).find((i) => i.key === 'daytype-done' && i.state === 'ready' && !hidden.has(i.id));
  if (!card) return null;
  return (
    <Section id="kinds-of-day" title="Your kinds of day" lede="What kind each day was, and how it went." span className={className} action={<SeeAll to="/insights">See all</SeeAll>}>
      <InsightCard insight={here ? { ...card, action: null } : card} onHide={() => hide(card.id)} />
    </Section>
  );
}

export { useHidden as useHiddenInsights };
