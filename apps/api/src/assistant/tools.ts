import {
  centsFrom,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  KIND_META,
  money,
  MOODS,
  NOT_TO_DO_TITLE_MAX,
  parentKind,
  PERIOD_KINDS,
  PERIOD_META,
  periodFor,
  periodLabel,
  periodShift,
  RELATIONSHIP_BY_KEY,
  RELATIONSHIPS,
  REVIEW_ANSWER_MAX,
  REVIEW_HIGHLIGHT_MAX,
  STRESS_LEVELS,
  TIME_RE,
  WAIT,
  type CompleteResponse,
  type FinanceDue,
  type FinanceGoal,
  type FinanceSummary,
  type FinanceTransaction,
  type JournalEntry,
  type LogKind,
  type Node,
  type NodeKind,
  type NotToDo,
  type PeriodKind,
  type RelationshipKey,
  type ReviewsResponse,
  type SessionResponse,
  type TodayResponse,
  type WellbeingLog,
  type WellbeingSummary,
} from '@kreators/shared';
import { must, seg, ToolError, type Answer, type Req } from './dispatch';

/**
 * The assistant's tools: the app's own actions, described for a model. Each tool calls the same routes the screens
 * use (through dispatch.ts), so there is one code path for a tap and a sentence. A read tool looks; a write tool
 * changes something and says how to undo it; a confirm tool waits for the person to tap Confirm. This list is what
 * an MCP server would serve later, as it is.
 */

export type Risk = 'read' | 'write' | 'confirm';
export type Args = Record<string, unknown>;

export interface ToolIO {
  /** The person's today and yesterday, from their device. The model never picks the date. */
  date: string;
  yesterday: string;
  call: (req: Req) => Promise<Answer>;
}

export interface Outcome {
  /** What the model reads back. */
  data: unknown;
  /** Plain words for the receipt. Never journal text or a log's note. */
  label?: string;
  undo?: Req | null;
}

interface Prop {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array';
  description?: string;
  enum?: readonly (string | number)[];
  /** Other words a model may use for a choice, mapped to the choice: a pillar's name for its key. Not sent to the model. */
  aliases?: Readonly<Record<string, string>>;
  items?: Prop;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  maxItems?: number;
}
export interface Schema {
  type: 'object';
  properties: Record<string, Prop>;
  required?: string[];
}

export interface Tool {
  name: string;
  description: string;
  params: Schema;
  risk: Risk;
  /** The apps that must be on for the tool to be offered. Null is the core. */
  needs: readonly string[] | null;
  /** The query keys on screen that show its change. */
  refresh: readonly string[];
  /** Plain words for a receipt before anything is known (a failure, or a card waiting for Confirm). */
  title: string;
  /** For a confirm tool: what the card says, looked up fresh. */
  describe?: (args: Args, io: ToolIO) => Promise<string>;
  /** Reads the journal or the trackers: offered only to a model that keeps nothing. */
  sensitive?: boolean;
  run: (args: Args, io: ToolIO) => Promise<Outcome>;
}

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

/**
 * The arguments, checked against the tool's schema: required ones present, types and choices right, text bounded.
 * Anything not in the schema is dropped. The slips models make are read kindly rather than costing a step: a number
 * where text is wanted ("400"), a choice in other case or spacing ("Guiding principle"), a pillar by its name, "true"
 * as text, one string where a list is wanted. Returns the clean arguments, or a line saying what is wrong.
 */
export function checkArgs(schema: Schema, raw: unknown): Args | string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'The arguments must be an object.';
  const given = raw as Args;
  const out: Args = {};
  for (const name of schema.required ?? []) if (given[name] === undefined || given[name] === null || (typeof given[name] === 'string' && !(given[name] as string).trim())) return `${name} is needed.`;
  for (const [name, prop] of Object.entries(schema.properties)) {
    const v = given[name];
    if (v === undefined || v === null) continue;
    const bad = checkValue(name, prop, v);
    if (typeof bad === 'string') return bad;
    out[name] = bad.value;
  }
  return out;
}

const loose = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, '_');
/** The choice a string means: itself, the same in other case or spacing, or an alias. Null when it is none of them. */
function choiceOf(p: Prop, s: string): string | null {
  const choices = (p.enum ?? []).map(String);
  if (choices.includes(s)) return s;
  const want = loose(s);
  return choices.find((c) => loose(c) === want) ?? Object.entries(p.aliases ?? {}).find(([word]) => loose(word) === want)?.[1] ?? null;
}

function checkValue(name: string, p: Prop, v: unknown): { value: unknown } | string {
  if (p.type === 'string') {
    const s = typeof v === 'number' && Number.isFinite(v) ? String(v) : v;
    if (typeof s !== 'string') return `${name} must be text.`;
    if (p.enum) {
      const hit = choiceOf(p, s);
      if (hit === null) return `${name} must be one of: ${p.enum.join(', ')}.`;
      return { value: hit };
    }
    return { value: s.trim().slice(0, p.maxLength ?? 2000) };
  }
  if (p.type === 'number' || p.type === 'integer') {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    if (typeof n !== 'number' || !Number.isFinite(n)) return `${name} must be a number.`;
    if (p.type === 'integer' && !Number.isInteger(n)) return `${name} must be a whole number.`;
    if (p.enum && !p.enum.includes(n)) return `${name} must be one of: ${p.enum.join(', ')}.`;
    if ((p.minimum !== undefined && n < p.minimum) || (p.maximum !== undefined && n > p.maximum)) return `${name} must be from ${p.minimum} to ${p.maximum}.`;
    return { value: n };
  }
  if (p.type === 'boolean') {
    const b = v === 'true' ? true : v === 'false' ? false : v;
    if (typeof b !== 'boolean') return `${name} must be true or false.`;
    return { value: b };
  }
  let list = v;
  if (typeof list === 'string') {
    try {
      const parsed: unknown = JSON.parse(list);
      list = Array.isArray(parsed) ? parsed : [list];
    } catch {
      list = [list];
    }
  }
  if (!Array.isArray(list)) return `${name} must be a list.`;
  if (p.maxItems !== undefined && list.length > p.maxItems) return `${name} can hold at most ${p.maxItems}.`;
  const items: unknown[] = [];
  for (const item of list as unknown[]) {
    const r = checkValue(name, p.items ?? { type: 'string' }, item);
    if (typeof r === 'string') return r;
    items.push(r.value);
  }
  return { value: items };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TRACKERS = ['wellbeing', 'mood', 'sleep', 'stress', 'mindful', 'life'];
/** What each kind of change shows up in on screen, as query key prefixes. */
const R = {
  tasks: ['today', 'nodes', 'me', 'home', 'life', 'reviews'],
  day: ['today', 'me', 'home', 'life'],
  routine: ['session', 'today', 'home'],
  layers: ['nodes', 'today', 'home'],
  body: ['wellbeing', 'logs', 'home', 'life', 'reviews'],
  journal: ['journal', 'home', 'life', 'reviews'],
  money: ['finance', 'home', 'life', 'reviews'],
  reviews: ['reviews'],
} as const;

/** The layers in the person's words, mapped to the keys the app stores. */
const LAYERS: Record<string, NodeKind> = { foundation: 'pillar', guiding_principle: 'principle', value_goal: 'value_goal', goal_outcome: 'outcome', project: 'project', task: 'task' };
const layerKey = (kind: NodeKind) => Object.keys(LAYERS).find((k) => LAYERS[k] === kind) ?? kind;
const layerName = (kind: NodeKind) => KIND_META[kind].label.toLowerCase();
const pillarName = (key: string) => RELATIONSHIP_BY_KEY[key as RelationshipKey]?.name ?? key;
const PILLAR: Prop = {
  type: 'string',
  enum: RELATIONSHIPS.map((r) => r.key),
  description: `The pillar: ${RELATIONSHIPS.map((r) => `${r.key} is ${r.name}`).join(', ')}.`,
  aliases: Object.fromEntries(RELATIONSHIPS.flatMap((r) => [[r.name, r.key], [r.character, r.key]])),
};
const DAY: Prop = { type: 'string', enum: ['today', 'yesterday'], description: 'Which day. Today unless they say yesterday.' };
const AMOUNT: Prop = { type: 'string', description: 'The amount as the person said it, in their currency: "400" or "12.50". No symbol.', maxLength: 14 };
const id = (what: string): Prop => ({ type: 'string', description: `The ${what} id, exactly as a read tool gave it.`, maxLength: 80 });

const quote = (t: string) => `“${t.length > 60 ? `${t.slice(0, 57)}…` : t}”`;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const dayOf = (v: unknown, io: ToolIO) => (v === 'yesterday' ? io.yesterday : io.date);
const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
/** "today", "tomorrow" or YYYY-MM-DD to a date; "none" to null (clear it); nothing to undefined. */
function dateArg(v: unknown, io: ToolIO): string | null | undefined {
  const s = str(v).toLowerCase();
  if (!s) return undefined;
  if (s === 'none') return null;
  if (s === 'today') return io.date;
  if (s === 'tomorrow') return shift(io.date, 1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  throw new ToolError('Dates are YYYY-MM-DD, or today or tomorrow.');
}
function centsArg(v: unknown): number {
  // "₹1,200", "$12.50", "Rs 400" and "1,20,000" all mean a number: drop the symbol, the words and the grouping commas.
  const cents = centsFrom(str(v).replace(/^(rs\.?|inr|usd)\s*/i, '').replace(/[₹$€£\s]/g, '').replace(/,(?=\d{2,3}(\D|$))/g, ''));
  if (cents === null) throw new ToolError('Say the amount as a number above zero, like 400 or 12.50.');
  return cents;
}
const feeling = (v: number | null) => (v ? (MOODS.find((m) => m.value === v)?.name ?? null) : null);

async function today(io: ToolIO): Promise<TodayResponse> {
  return must(await io.call({ method: 'GET', path: `/today?date=${io.date}` })) as TodayResponse;
}
async function allNodes(io: ToolIO): Promise<Node[]> {
  return (must(await io.call({ method: 'GET', path: '/nodes' })) as { nodes: Node[] }).nodes;
}
async function nodeOf(io: ToolIO, itemId: unknown): Promise<Node> {
  const want = seg(itemId);
  const n = (await allNodes(io)).find((x) => x.id === want);
  if (!n) throw new ToolError('Could not find that in your pillars. Look it up again with list_pyramid.');
  return n;
}
async function notToDoOf(io: ToolIO, itemId: unknown): Promise<NotToDo> {
  const want = seg(itemId);
  const item = (await today(io)).notToDo.find((i) => i.id === want);
  if (!item) throw new ToolError('Could not find that on your not to do list. Look it up again with get_daily.');
  return item;
}
const morningOf = (s: SessionResponse, type: 'general' | 'exceptional') => (type === 'general' ? s.routine?.general : s.routine?.exceptional)?.find((b) => b.key === 'morning')?.steps ?? [];

// ---------------------------------------------------------------------------
// The tools
// ---------------------------------------------------------------------------

export const TOOLS: readonly Tool[] = [
  // ---- reads
  {
    name: 'get_daily',
    risk: 'read',
    needs: null,
    refresh: [],
    title: 'Look at Daily',
    description:
      "Today on Daily: whether they checked in, the small act, the tasks waiting (up to six, with ids and whether each can be ticked now), the tasks already ticked today (with ids, to untick one), and the not to do list (with ids and today's and yesterday's marks). Read this before ticking, unticking, checking in or marking.",
    params: { type: 'object', properties: {} },
    run: async (_a, io) => {
      const t = await today(io);
      const now = Date.now();
      return {
        data: {
          date: t.date,
          checkedIn: t.checkedIn,
          streak: t.streak,
          smallAct: { text: t.spark.text, pillar: pillarName(t.spark.relationship), done: t.spark.done },
          tasks: t.tasks.map((n) => {
            const wait = n.readyAt ? Math.ceil((Date.parse(n.readyAt) - now) / 60_000) : 0;
            const later = Boolean(n.dueDate && n.dueDate > io.date);
            return { id: n.id, title: n.title, pillar: pillarName(n.relationship), due: n.dueDate, time: n.dueTime, minutes: n.estimateMin, canTickNow: !later && wait <= 0, ...(later ? { waitsForDay: n.dueDate } : wait > 0 ? { readyInMinutes: wait } : {}) };
          }),
          notToDo: t.notToDo.map((i) => ({ id: i.id, title: i.title, today: i.today, yesterday: i.week[5] ?? null, streak: i.streak })),
          doneToday: t.done.map((n) => ({ id: n.id, title: n.title, pillar: pillarName(n.relationship) })),
        },
      };
    },
  },
  {
    name: 'list_pyramid',
    risk: 'read',
    needs: null,
    refresh: [],
    title: 'Look at your pillars',
    description:
      'Everything in the pyramids of the seven pillars, with ids: foundation, guiding principle, value goal, goal outcome, project and task, each with the id of the layer it hangs under. Filter by pillar and layer. Open items only unless done is true. Use it to find a task Daily does not show, or a parent for a new layer.',
    params: { type: 'object', properties: { pillar: PILLAR, layer: { type: 'string', enum: Object.keys(LAYERS) }, done: { type: 'boolean', description: 'Include finished items too.' } } },
    run: async (a, io) => {
      const q = new URLSearchParams();
      if (a.pillar) q.set('relationship', str(a.pillar));
      if (a.layer) q.set('kind', LAYERS[str(a.layer)] ?? '');
      const qs = q.toString();
      const { nodes } = must(await io.call({ method: 'GET', path: `/nodes${qs ? `?${qs}` : ''}` })) as { nodes: Node[] };
      const list = nodes.filter((n) => n.status === 'active' || (a.done === true && n.status === 'done'));
      return {
        data: {
          items: list.slice(0, 80).map((n) => ({ id: n.id, layer: layerKey(n.kind), title: n.title, pillar: pillarName(n.relationship), under: n.parentId, status: n.status, due: n.dueDate, time: n.dueTime })),
          more: list.length > 80 ? list.length - 80 : 0,
        },
      };
    },
  },
  {
    name: 'get_routine',
    risk: 'read',
    needs: null,
    refresh: [],
    title: 'Look at your routine',
    description: "The morning routine from the strategy session: the steps for a general day and an exceptional day, which are ticked today, and how many mornings were done this week.",
    params: { type: 'object', properties: {} },
    run: async (_a, io) => {
      const s = must(await io.call({ method: 'GET', path: `/session?date=${io.date}` })) as SessionResponse;
      if (!s.routine) return { data: { routine: null, why: 'No routine yet. It comes from the strategy session in Pillars.' } };
      return { data: { general: morningOf(s, 'general'), exceptional: morningOf(s, 'exceptional'), today: s.today ? { dayType: s.today.dayType, ticked: s.today.steps, done: s.today.done } : null, weekDone: s.week.done } };
    },
  },
  {
    name: 'get_wellbeing',
    risk: 'read',
    sensitive: true,
    needs: TRACKERS,
    refresh: [],
    title: 'Look at your trackers',
    description: `The wellbeing score and the last seven days of mood, sleep, stress and mindful minutes. With kind, also that tracker's logs (with ids) for a number of days. Mood runs 1 to 5 (${MOODS.map((m) => m.name).join(', ')}), stress 1 to 5 (${STRESS_LEVELS.join(', ')}), sleep in hours.`,
    params: { type: 'object', properties: { kind: { type: 'string', enum: ['mood', 'sleep', 'stress', 'mindful', 'move'] }, days: { type: 'integer', minimum: 1, maximum: 90 } } },
    run: async (a, io) => {
      const sum = must(await io.call({ method: 'GET', path: `/wellbeing/summary?date=${io.date}` })) as WellbeingSummary;
      const kind = str(a.kind);
      const logs = kind ? (must(await io.call({ method: 'GET', path: `/wellbeing/${kind}?days=${Number(a.days ?? 14)}` })) as { logs: WellbeingLog[] }).logs : null;
      return {
        data: {
          score: sum.score,
          label: sum.label,
          week: sum.week,
          ...(logs ? { logs: logs.slice(0, 60).map((l) => ({ id: l.id, date: l.date, value: l.value, ...(typeof l.extra.quality === 'number' ? { quality: l.extra.quality } : {}), note: l.note })) } : {}),
        },
      };
    },
  },
  {
    name: 'read_journal',
    risk: 'read',
    sensitive: true,
    needs: ['journal'],
    refresh: [],
    title: 'Read your journal',
    description:
      "The person's own journal entries, newest first, optionally matching words or a date range. Call it only when they ask about their journal. Never bring the journal up yourself, and quote it only when they ask.",
    params: {
      type: 'object',
      properties: {
        query: { type: 'string', maxLength: 80, description: 'Words to look for in the title or the entry.' },
        from: { type: 'string', description: 'YYYY-MM-DD, the first day to include.' },
        to: { type: 'string', description: 'YYYY-MM-DD, the last day to include.' },
        limit: { type: 'integer', minimum: 1, maximum: 10 },
      },
    },
    run: async (a, io) => {
      const r = must(await io.call({ method: 'GET', path: '/journal?size=100' })) as { entries: JournalEntry[]; stats: { total: number } };
      const words = str(a.query).toLowerCase();
      const from = str(a.from);
      const to = str(a.to);
      const hits = r.entries.filter((e) => {
        const day = e.createdAt.slice(0, 10);
        return (!words || `${e.title} ${e.body}`.toLowerCase().includes(words)) && (!from || day >= from) && (!to || day <= to);
      });
      return {
        data: {
          total: r.stats.total,
          entries: hits.slice(0, Number(a.limit ?? 5)).map((e) => ({ id: e.id, date: e.createdAt.slice(0, 10), title: e.title, body: e.body.slice(0, 1500), feeling: feeling(e.emotion), stress: e.stress })),
        },
      };
    },
  },
  {
    name: 'get_finance',
    risk: 'read',
    needs: ['finance'],
    refresh: [],
    title: 'Look at Finance',
    description: 'One month in Finance: money in, money out, by category, what is owed either way (open dues with ids), money goals (with ids) and the latest entries (with ids).',
    params: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM. This month if left out.' } } },
    run: async (a, io) => {
      const month = /^\d{4}-\d{2}$/.test(str(a.month)) ? str(a.month) : io.date.slice(0, 7);
      const f = must(await io.call({ method: 'GET', path: `/finance?month=${month}` })) as FinanceSummary;
      const m = (c: number) => money(c, f.currency);
      return {
        data: {
          month: f.month,
          moneyIn: m(f.incomeCents),
          moneyOut: m(f.expenseCents),
          net: m(f.netCents),
          byCategory: f.byCategory.map((b) => ({ category: b.category, kind: b.kind, amount: m(b.cents) })),
          dues: f.dues.filter((d: FinanceDue) => d.status === 'open').map((d) => ({ id: d.id, who: d.counterparty, direction: d.direction === 'owed' ? 'owed_to_me' : 'i_owe', amount: money(d.amountCents, d.currency), due: d.dueDate })),
          goals: f.goals.map((g: FinanceGoal) => ({ id: g.id, title: g.title, kind: g.kind, target: m(g.targetCents), progress: m(g.progressCents), deadline: g.deadline })),
          latest: f.transactions.slice(0, 15).map((t: FinanceTransaction) => ({ id: t.id, date: t.date, kind: t.kind, amount: money(t.amountCents, t.currency), category: t.category, who: t.counterparty })),
        },
      };
    },
  },
  {
    name: 'get_review',
    risk: 'read',
    needs: ['reviews'],
    refresh: [],
    title: 'Look at a review',
    description: "A review for a period: this one or the last one. Gives the period, its numbers, the prompts to answer, and the answers if it was written already.",
    params: { type: 'object', properties: { kind: { type: 'string', enum: PERIOD_KINDS }, which: { type: 'string', enum: ['this', 'last'] } }, required: ['kind'] },
    run: async (a, io) => {
      const kind = str(a.kind) as PeriodKind;
      const now = periodFor(kind, io.date);
      const p = a.which === 'last' ? periodShift(now, -1) : now;
      const r = must(await io.call({ method: 'GET', path: `/reviews?kind=${kind}&date=${p.start}` })) as ReviewsResponse;
      const t = r.templates.find((x) => (r.review ? (r.review.templateId ?? `builtin:${kind}`) === x.id : x.builtIn)) ?? r.templates[0];
      const s = r.summary.now;
      return {
        data: {
          period: periodLabel(r.period),
          numbers: { xp: s.xp, tasksDone: s.tasksDone, checkins: s.checkins, days: s.days },
          written: Boolean(r.review),
          prompts: r.review ? r.review.prompts : (t?.prompts ?? []),
          answers: r.review?.answers ?? [],
          rating: r.review?.rating ?? null,
          highlight: r.review?.highlight ?? '',
        },
      };
    },
  },

  // ---- Daily
  {
    name: 'complete_task',
    risk: 'write',
    needs: null,
    refresh: R.tasks,
    title: 'Tick a task',
    description: `Tick one task as done. It pays xp and sends a ripple up its pyramid. A task with a date is ticked on its day, and a new task waits ${WAIT.taskMinAgeMinutes} minutes after it is written. Call it once per task.`,
    params: { type: 'object', properties: { taskId: id('task') }, required: ['taskId'] },
    run: async (a, io) => {
      const taskId = seg(a.taskId);
      const r = must(await io.call({ method: 'POST', path: `/nodes/${taskId}/complete`, body: { date: io.date } })) as CompleteResponse;
      return {
        label: `Ticked ${quote(r.node.title)}`,
        undo: { method: 'POST', path: `/nodes/${taskId}/uncomplete` },
        data: { ticked: r.node.title, xp: r.totalXp, capped: r.capped, projectCleared: r.projectCleared?.title ?? null, newBadges: r.newBadges },
      };
    },
  },
  {
    name: 'untick_task',
    risk: 'write',
    needs: null,
    refresh: R.tasks,
    title: 'Untick a task',
    description: 'Untick a task that was ticked by mistake. The xp it paid is taken back.',
    params: { type: 'object', properties: { taskId: id('task') }, required: ['taskId'] },
    run: async (a, io) => {
      const taskId = seg(a.taskId);
      const r = must(await io.call({ method: 'POST', path: `/nodes/${taskId}/uncomplete` })) as { node: Node };
      return { label: `Unticked ${quote(r.node.title)}`, undo: { method: 'POST', path: `/nodes/${taskId}/complete`, body: { date: io.date } }, data: { unticked: r.node.title } };
    },
  },
  {
    name: 'check_in',
    risk: 'write',
    needs: null,
    refresh: R.day,
    title: 'Check in',
    description: 'Check in for today: it says they showed up. Pays 10 xp and 10 points and keeps the streak. Once a day.',
    params: { type: 'object', properties: {} },
    run: async (_a, io) => {
      const r = must(await io.call({ method: 'POST', path: '/today/checkin', body: { date: io.date } })) as { streak: number; awarded: number; points: number; streakBonus: number; alreadyCheckedIn: boolean };
      return { label: r.alreadyCheckedIn ? 'Already checked in today' : `Checked in, day ${r.streak}`, data: r };
    },
  },
  {
    name: 'small_act_done',
    risk: 'write',
    needs: null,
    refresh: R.day,
    title: 'Mark the small act done',
    description: "Mark today's small act done (get_daily says what it is). Pays 15 xp. Once a day.",
    params: { type: 'object', properties: {} },
    run: async (_a, io) => {
      const r = must(await io.call({ method: 'POST', path: '/today/spark', body: { date: io.date } })) as { awarded: number; alreadyDone: boolean };
      return { label: r.alreadyDone ? 'The small act was already done' : 'Marked the small act done', data: r };
    },
  },
  {
    name: 'mark_not_to_do',
    risk: 'write',
    needs: null,
    refresh: R.day,
    title: 'Mark the not to do list',
    description: 'Mark one item on the not to do list for today or yesterday: kept (they stayed away, pays 5 xp once a day), slipped (ends its streak), or clear (no mark). Call it once per item.',
    params: { type: 'object', properties: { itemId: id('not to do item'), status: { type: 'string', enum: ['kept', 'slipped', 'clear'] }, day: DAY }, required: ['itemId', 'status'] },
    run: async (a, io) => {
      const item = await notToDoOf(io, a.itemId);
      const date = dayOf(a.day, io);
      const before = a.day === 'yesterday' ? (item.week[5] ?? null) : item.today;
      const status = a.status === 'clear' ? null : a.status;
      const r = must(await io.call({ method: 'POST', path: `/today/not-to-do/${item.id}/day`, body: { date, today: io.date, status } })) as { item: NotToDo; awarded: number };
      const when = a.day === 'yesterday' ? ' for yesterday' : '';
      return {
        label: status ? `Marked ${quote(item.title)} ${status}${when}` : `Cleared the mark on ${quote(item.title)}${when}`,
        undo: { method: 'POST', path: `/today/not-to-do/${item.id}/day`, body: { date, today: io.date, status: before } },
        data: { title: item.title, status, streak: r.item.streak, xp: r.awarded },
      };
    },
  },
  {
    name: 'add_not_to_do',
    risk: 'write',
    needs: null,
    refresh: R.day,
    title: 'Add to the not to do list',
    description: `Add one thing to stay away from to the not to do list, in a few words (up to ${NOT_TO_DO_TITLE_MAX} letters). Up to seven items. A pillar it protects is optional.`,
    params: { type: 'object', properties: { title: { type: 'string', maxLength: NOT_TO_DO_TITLE_MAX }, pillar: PILLAR }, required: ['title'] },
    run: async (a, io) => {
      const r = must(await io.call({ method: 'POST', path: '/today/not-to-do', body: { title: str(a.title), relationship: a.pillar ?? null } })) as { item: NotToDo };
      return { label: `Added ${quote(r.item.title)} to your not to do list`, undo: { method: 'DELETE', path: `/today/not-to-do/${seg(r.item.id)}` }, data: { id: r.item.id, title: r.item.title } };
    },
  },
  {
    name: 'remove_not_to_do',
    risk: 'confirm',
    needs: null,
    refresh: R.day,
    title: 'Remove from the not to do list',
    description: 'Remove one item from the not to do list, with its streak.',
    params: { type: 'object', properties: { itemId: id('not to do item') }, required: ['itemId'] },
    describe: async (a, io) => `Remove ${quote((await notToDoOf(io, a.itemId)).title)} from your not to do list, with its streak`,
    run: async (a, io) => {
      const item = await notToDoOf(io, a.itemId);
      must(await io.call({ method: 'DELETE', path: `/today/not-to-do/${item.id}` }));
      return { label: `Removed ${quote(item.title)} from your not to do list`, data: { removed: item.title } };
    },
  },
  {
    name: 'tick_routine',
    risk: 'write',
    needs: null,
    refresh: R.routine,
    title: 'Tick your morning routine',
    description: 'Tick morning routine steps as done today, for a general or an exceptional day. Steps already ticked stay ticked. The morning counts once every step is ticked. Use the step names get_routine gives.',
    params: {
      type: 'object',
      properties: { dayType: { type: 'string', enum: ['general', 'exceptional'] }, steps: { type: 'array', items: { type: 'string', maxLength: 120 }, maxItems: 20 } },
      required: ['dayType', 'steps'],
    },
    run: async (a, io) => {
      const s = must(await io.call({ method: 'GET', path: `/session?date=${io.date}` })) as SessionResponse;
      if (!s.routine) throw new ToolError('There is no routine yet. It comes from the strategy session in Pillars.');
      const dayType = a.dayType === 'exceptional' ? 'exceptional' : 'general';
      const all = morningOf(s, dayType);
      const wanted = (a.steps as string[]).map((w) => w.toLowerCase());
      const picked = all.filter((st) => wanted.includes(st.toLowerCase()));
      if (!picked.length) throw new ToolError(`Those are not steps in this morning. They are: ${all.join(', ') || 'none'}.`);
      const before = s.today ? { dayType: s.today.dayType, steps: s.today.steps } : { dayType, steps: [] as string[] };
      const kept = before.dayType === dayType ? before.steps : [];
      const steps = all.filter((st) => kept.includes(st) || picked.includes(st));
      const r = must(await io.call({ method: 'POST', path: '/session/day', body: { date: io.date, dayType, steps } })) as SessionResponse;
      return {
        label: r.today?.done ? 'Your morning routine is done' : `Ticked ${picked.length} morning ${picked.length === 1 ? 'step' : 'steps'}`,
        undo: { method: 'POST', path: '/session/day', body: { date: io.date, dayType: before.dayType, steps: before.steps } },
        data: { done: r.today?.done ?? false, ticked: steps, of: all.length, weekDone: r.week.done },
      };
    },
  },

  // ---- Pillars
  {
    name: 'add_to_pyramid',
    risk: 'write',
    needs: null,
    refresh: R.layers,
    title: 'Add to a pyramid',
    description: `Add one layer to a pillar's pyramid. Each layer hangs under the one before: a guiding principle under a foundation, a value goal under a guiding principle, a goal outcome under a value goal, a project under a goal outcome, a task under a project. Give under (the parent's id) when the pillar has more than one; with just one it is found. A task is due today unless a date is given, and can be ticked ${WAIT.taskMinAgeMinutes} minutes after it is written.`,
    params: {
      type: 'object',
      properties: {
        pillar: PILLAR,
        layer: { type: 'string', enum: Object.keys(LAYERS) },
        title: { type: 'string', maxLength: 140 },
        under: id('parent layer'),
        dueDate: { type: 'string', description: 'Tasks only: YYYY-MM-DD, today or tomorrow.' },
        dueTime: { type: 'string', description: 'Tasks only: HH:MM, 24-hour.' },
        minutes: { type: 'integer', minimum: 5, maximum: 600, description: 'Tasks only: how long it should take.' },
        note: { type: 'string', maxLength: 500 },
      },
      required: ['pillar', 'layer', 'title'],
    },
    run: async (a, io) => {
      const kind = LAYERS[str(a.layer)];
      if (!kind) throw new ToolError('That is not a layer.');
      const pillar = str(a.pillar) as RelationshipKey;
      const up = parentKind(kind);
      let parentId: string | null = null;
      if (up) {
        if (a.under) parentId = seg(a.under);
        else {
          const { nodes } = must(await io.call({ method: 'GET', path: `/nodes?relationship=${pillar}&kind=${up}` })) as { nodes: Node[] };
          const open = nodes.filter((n) => n.status === 'active');
          if (!open.length) throw new ToolError(`A ${layerName(kind)} hangs under a ${layerName(up)}, and ${pillarName(pillar)} has none yet. Add the ${layerName(up)} first.`);
          if (open.length > 1) throw new ToolError(`Which ${layerName(up)} does it go under? ${open.map((n) => `${quote(n.title)} (id ${n.id})`).join('; ')}`);
          parentId = open[0]!.id;
        }
      }
      const task = kind === 'task';
      const dueTime = str(a.dueTime);
      if (task && dueTime && !TIME_RE.test(dueTime)) throw new ToolError('A time is HH:MM, like 07:30.');
      const r = must(
        await io.call({
          method: 'POST',
          path: '/nodes',
          body: { kind, parentId, relationship: pillar, title: str(a.title), note: str(a.note), dueDate: task ? (dateArg(a.dueDate, io) ?? io.date) : null, dueTime: task && dueTime ? dueTime : null, estimateMin: task && a.minutes ? Number(a.minutes) : null },
        }),
      ) as { node: Node };
      return {
        label: `Added the ${layerName(kind)} ${quote(r.node.title)} to ${pillarName(pillar)}`,
        undo: { method: 'DELETE', path: `/nodes/${seg(r.node.id)}` },
        data: { id: r.node.id, layer: layerKey(kind), title: r.node.title, pillar: pillarName(pillar), due: r.node.dueDate },
      };
    },
  },
  {
    name: 'edit_pyramid_item',
    risk: 'write',
    needs: null,
    refresh: R.layers,
    title: 'Change something in a pyramid',
    description: 'Change a layer or a task: its title, its note, and for a task its date, time and minutes. Renaming a task starts its wait again. Use "none" to clear a date or a time.',
    params: {
      type: 'object',
      properties: {
        itemId: id('layer or task'),
        title: { type: 'string', maxLength: 140 },
        note: { type: 'string', maxLength: 500 },
        dueDate: { type: 'string', description: 'YYYY-MM-DD, today, tomorrow or none.' },
        dueTime: { type: 'string', description: 'HH:MM or none.' },
        minutes: { type: 'integer', minimum: 5, maximum: 600 },
      },
      required: ['itemId'],
    },
    run: async (a, io) => {
      const prev = await nodeOf(io, a.itemId);
      const body: Record<string, unknown> = {};
      if (a.title) body.title = str(a.title);
      if (a.note !== undefined) body.note = str(a.note);
      if (prev.kind === 'task') {
        const due = dateArg(a.dueDate, io);
        if (due !== undefined) body.dueDate = due;
        const time = str(a.dueTime).toLowerCase();
        if (time === 'none') body.dueTime = null;
        else if (time) {
          if (!TIME_RE.test(time)) throw new ToolError('A time is HH:MM, like 07:30.');
          body.dueTime = time;
        }
        if (a.minutes) body.estimateMin = Number(a.minutes);
      }
      if (!Object.keys(body).length) throw new ToolError('Say what to change.');
      const r = must(await io.call({ method: 'PATCH', path: `/nodes/${prev.id}`, body })) as { node: Node };
      return {
        label: `Changed ${quote(r.node.title)}`,
        undo: { method: 'PATCH', path: `/nodes/${prev.id}`, body: { title: prev.title, note: prev.note, dueDate: prev.dueDate, dueTime: prev.dueTime, estimateMin: prev.estimateMin } },
        data: { title: r.node.title, due: r.node.dueDate, time: r.node.dueTime, minutes: r.node.estimateMin },
      };
    },
  },
  {
    name: 'remove_from_pyramid',
    risk: 'confirm',
    needs: null,
    refresh: R.layers,
    title: 'Remove from a pyramid',
    description: 'Remove a layer or a task from a pyramid, and everything that hangs under it. It cannot be undone.',
    params: { type: 'object', properties: { itemId: id('layer or task') }, required: ['itemId'] },
    describe: async (a, io) => {
      const n = await nodeOf(io, a.itemId);
      const kids = (await allNodes(io)).some((x) => x.parentId === n.id);
      return `Remove the ${layerName(n.kind)} ${quote(n.title)} from ${pillarName(n.relationship)}${kids ? ', and everything under it' : ''}. This cannot be undone`;
    },
    run: async (a, io) => {
      const n = await nodeOf(io, a.itemId);
      must(await io.call({ method: 'DELETE', path: `/nodes/${n.id}` }));
      return { label: `Removed the ${layerName(n.kind)} ${quote(n.title)}`, data: { removed: n.title } };
    },
  },

  // ---- trackers and journal
  {
    name: 'log_wellbeing',
    risk: 'write',
    needs: TRACKERS,
    refresh: R.body,
    title: 'Log a tracker',
    description: `Log one tracker for today or yesterday. mood: 1 to 5 (${MOODS.map((m) => `${m.value} ${m.name}`).join(', ')}). stress: 1 to 5 (${STRESS_LEVELS.map((s, i) => `${i + 1} ${s}`).join(', ')}). sleep: hours slept, halves allowed, with quality 1 to 5 (Poor, Restless, Okay, Good, Deep) if they said. mindful and move: minutes. Mood, sleep and stress are one a day: logging again replaces the day's.`,
    params: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['mood', 'sleep', 'stress', 'mindful', 'move'] },
        value: { type: 'number', minimum: 0, maximum: 600 },
        quality: { type: 'integer', minimum: 1, maximum: 5 },
        note: { type: 'string', maxLength: 500 },
        day: DAY,
      },
      required: ['kind', 'value'],
    },
    run: async (a, io) => {
      const kind = str(a.kind) as LogKind;
      const extra = kind === 'sleep' && a.quality ? { quality: Number(a.quality) } : kind === 'mindful' ? { kind: 'chat' } : {};
      const r = must(await io.call({ method: 'POST', path: `/wellbeing/${kind}`, body: { date: dayOf(a.day, io), value: Number(a.value), extra, note: str(a.note) } })) as { log: WellbeingLog; summary: WellbeingSummary };
      const said: Record<LogKind, string> = { mood: 'Logged your mood', sleep: 'Logged your sleep', stress: 'Logged your stress', mindful: 'Logged mindful minutes', move: 'Logged time moving' };
      return { label: said[kind], undo: { method: 'DELETE', path: `/wellbeing/${kind}/${seg(r.log.id)}` }, data: { logged: kind, value: r.log.value, score: r.summary.score, scoreLabel: r.summary.label } };
    },
  },
  {
    name: 'write_journal',
    risk: 'write',
    needs: ['journal'],
    refresh: R.journal,
    title: 'Write in your journal',
    description: "Save a journal entry. Write what the person said, in their own words; add nothing of your own. A title and a feeling are optional. Only they can ever see it.",
    params: {
      type: 'object',
      properties: { body: { type: 'string', maxLength: 5000 }, title: { type: 'string', maxLength: 120 }, feeling: { type: 'integer', minimum: 1, maximum: 5, description: `1 to 5: ${MOODS.map((m) => `${m.value} ${m.name}`).join(', ')}.` } },
      required: ['body'],
    },
    run: async (a, io) => {
      const r = must(await io.call({ method: 'POST', path: '/journal', body: { title: str(a.title), body: str(a.body), emotion: a.feeling ? Number(a.feeling) : null } })) as { entry: JournalEntry };
      return { label: 'Wrote a journal entry', undo: { method: 'DELETE', path: `/journal/${seg(r.entry.id)}` }, data: { saved: true, id: r.entry.id } };
    },
  },

  // ---- money
  {
    name: 'add_money',
    risk: 'write',
    needs: ['finance'],
    refresh: R.money,
    title: 'Add money in or out',
    description: `Add one entry of money in (income) or money out (expense) to Finance. Income categories: ${INCOME_CATEGORIES.join(', ')}. Expense categories: ${EXPENSE_CATEGORIES.join(', ')}. Pick the closest; the last one of each list is the catch-all.`,
    params: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['income', 'expense'] },
        amount: AMOUNT,
        category: { type: 'string', enum: [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES] },
        who: { type: 'string', maxLength: 80, description: 'Who it came from or went to.' },
        note: { type: 'string', maxLength: 200 },
        day: DAY,
      },
      required: ['kind', 'amount', 'category'],
    },
    run: async (a, io) => {
      const kind = a.kind === 'income' ? 'income' : 'expense';
      const cats: readonly string[] = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      const category = cats.includes(str(a.category)) ? str(a.category) : cats[cats.length - 1]!;
      const cents = centsArg(a.amount);
      const r = must(await io.call({ method: 'POST', path: '/finance/transactions', body: { kind, amountCents: cents, category, counterparty: str(a.who), note: str(a.note), date: dayOf(a.day, io) } })) as { transaction: FinanceTransaction };
      return {
        label: `Added ${money(cents, r.transaction.currency)} ${kind === 'income' ? 'in' : 'out'}, ${category.toLowerCase()}`,
        undo: { method: 'DELETE', path: `/finance/transactions/${seg(r.transaction.id)}` },
        data: { id: r.transaction.id, amount: money(cents, r.transaction.currency), kind, category },
      };
    },
  },
  {
    name: 'add_due',
    risk: 'write',
    needs: ['finance'],
    refresh: R.money,
    title: 'Note money owed',
    description: 'Note money owed either way: owed_to_me (someone owes them) or i_owe (they owe someone). Only they see it.',
    params: {
      type: 'object',
      properties: { direction: { type: 'string', enum: ['owed_to_me', 'i_owe'] }, who: { type: 'string', maxLength: 80 }, amount: AMOUNT, dueDate: { type: 'string', description: 'YYYY-MM-DD, today or tomorrow.' }, note: { type: 'string', maxLength: 200 } },
      required: ['direction', 'who', 'amount'],
    },
    run: async (a, io) => {
      const cents = centsArg(a.amount);
      const owed = a.direction === 'owed_to_me';
      const r = must(await io.call({ method: 'POST', path: '/finance/dues', body: { direction: owed ? 'owed' : 'owe', counterparty: str(a.who), amountCents: cents, dueDate: dateArg(a.dueDate, io) ?? null, note: str(a.note) } })) as { due: FinanceDue };
      const amount = money(cents, r.due.currency);
      return { label: owed ? `Noted ${r.due.counterparty} owes you ${amount}` : `Noted you owe ${r.due.counterparty} ${amount}`, undo: { method: 'DELETE', path: `/finance/dues/${seg(r.due.id)}` }, data: { id: r.due.id } };
    },
  },
  {
    name: 'settle_due',
    risk: 'confirm',
    needs: ['finance'],
    refresh: R.money,
    title: 'Settle money owed',
    description: 'Mark an open due settled once the money moved. It books the money in Finance. It moves no real money, and cannot be undone here.',
    params: { type: 'object', properties: { dueId: id('due') }, required: ['dueId'] },
    describe: async (a, io) => {
      const want = seg(a.dueId);
      const f = must(await io.call({ method: 'GET', path: `/finance?month=${io.date.slice(0, 7)}` })) as FinanceSummary;
      const d = f.dues.find((x) => x.id === want && x.status === 'open');
      if (!d) throw new ToolError('Could not find that open due. Look it up again with get_finance.');
      const amount = money(d.amountCents, d.currency);
      return `Settle ${d.direction === 'owed' ? `${d.counterparty} owes you ${amount}` : `you owe ${d.counterparty} ${amount}`}. It is booked in Finance and cannot be undone here`;
    },
    run: async (a, io) => {
      const dueId = seg(a.dueId);
      must(await io.call({ method: 'POST', path: `/finance/dues/${dueId}/settle` }));
      return { label: 'Settled what was owed', data: { settled: true } };
    },
  },
  {
    name: 'set_money_goal',
    risk: 'write',
    needs: ['finance'],
    refresh: R.money,
    title: 'Set a money goal',
    description: 'Set a money goal: save up for something, or earn an amount. A deadline is optional.',
    params: { type: 'object', properties: { title: { type: 'string', maxLength: 120 }, kind: { type: 'string', enum: ['save', 'earn'] }, amount: AMOUNT, deadline: { type: 'string', description: 'YYYY-MM-DD.' } }, required: ['title', 'kind', 'amount'] },
    run: async (a, io) => {
      const cents = centsArg(a.amount);
      const r = must(await io.call({ method: 'POST', path: '/finance/goals', body: { title: str(a.title), kind: a.kind === 'earn' ? 'earn' : 'save', targetCents: cents, deadline: dateArg(a.deadline, io) ?? null } })) as { id: string };
      return { label: `Set the goal ${quote(str(a.title))}`, undo: { method: 'DELETE', path: `/finance/goals/${seg(r.id)}` }, data: { id: r.id } };
    },
  },
  {
    name: 'add_to_goal',
    risk: 'write',
    needs: ['finance'],
    refresh: R.money,
    title: 'Add to a money goal',
    description: 'Put money towards a saving goal (get_finance lists the goals). Only saving goals take money.',
    params: { type: 'object', properties: { goalId: id('goal'), amount: AMOUNT }, required: ['goalId', 'amount'] },
    run: async (a, io) => {
      const goalId = seg(a.goalId);
      const cents = centsArg(a.amount);
      must(await io.call({ method: 'POST', path: `/finance/goals/${goalId}/add`, body: { cents } }));
      return { label: `Added ${money(cents)} to a goal`, undo: { method: 'POST', path: `/finance/goals/${goalId}/add`, body: { cents: -cents } }, data: { added: money(cents) } };
    },
  },

  // ---- reviews
  {
    name: 'save_review',
    risk: 'write',
    needs: ['reviews'],
    refresh: R.reviews,
    title: 'Save a review',
    description: "Save a review for a period: one answer per prompt, in the order get_review gave them, in the person's own words. Writing it again replaces the old one. A rating 1 to 5 and the one thing worth keeping are optional.",
    params: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: PERIOD_KINDS },
        which: { type: 'string', enum: ['this', 'last'] },
        answers: { type: 'array', items: { type: 'string', maxLength: REVIEW_ANSWER_MAX }, maxItems: 12 },
        rating: { type: 'integer', minimum: 1, maximum: 5 },
        highlight: { type: 'string', maxLength: REVIEW_HIGHLIGHT_MAX },
      },
      required: ['kind', 'answers'],
    },
    run: async (a, io) => {
      const kind = str(a.kind) as PeriodKind;
      const now = periodFor(kind, io.date);
      const p = a.which === 'last' ? periodShift(now, -1) : now;
      const r = must(await io.call({ method: 'GET', path: `/reviews?kind=${kind}&date=${p.start}` })) as ReviewsResponse;
      const t = r.templates.find((x) => (r.review ? (r.review.templateId ?? `builtin:${kind}`) === x.id : x.builtIn)) ?? r.templates[0];
      const put = must(
        await io.call({ method: 'PUT', path: '/reviews', body: { kind, date: p.start, templateId: t && !t.builtIn ? t.id : null, answers: a.answers, rating: a.rating ?? null, highlight: str(a.highlight) } }),
      ) as { review: { id: string } | null };
      // A first review can be undone. One that replaced an older one cannot, so the older words never sit in the action log.
      return {
        label: `${r.review ? 'Replaced' : 'Saved'} your ${PERIOD_META[kind].name.toLowerCase()} for ${periodLabel(r.period)}`,
        undo: !r.review && put.review ? { method: 'DELETE', path: `/reviews/${seg(put.review.id)}` } : null,
        data: { saved: true, period: periodLabel(r.period), replaced: Boolean(r.review) },
      };
    },
  },
];

export const TOOL_BY_NAME: Readonly<Record<string, Tool>> = Object.fromEntries(TOOLS.map((t) => [t.name, t]));
