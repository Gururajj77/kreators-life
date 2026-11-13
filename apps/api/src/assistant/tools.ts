import {
  centsFrom,
  DELIVERABLE_KINDS,
  DELIVERABLE_STAGES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  KIND_META,
  LIFE_AREA_ORDER,
  LIFE_AREAS,
  money,
  openDay,
  MOODS,
  NOT_TO_DO_TITLE_MAX,
  parentKind,
  parseLifeArea,
  parsePriority,
  parseRepeat,
  PERIOD_KINDS,
  periodLabel,
  periodShift,
  reviewNameFor,
  reviewPeriodNow,
  RELATIONSHIP_BY_KEY,
  RELATIONSHIPS,
  repeatLabel,
  slotRangeLabel,
  blockOfTask,
  taskIsHabit,
  REVIEW_ANSWER_MAX,
  REVIEW_HIGHLIGHT_MAX,
  STRESS_LEVELS,
  TIME_RE,
  WAIT,
  type AgencyClientPage,
  type AgencyDeliverable,
  type AgencyOverview,
  type CommunityPost,
  type CommunityReply,
  type CompleteResponse,
  type FinanceDue,
  type FinanceGoal,
  type FinanceSummary,
  type FinanceTransaction,
  type Invoice,
  type JournalEntry,
  type LogKind,
  type Node,
  type NodeKind,
  type Notification,
  type NotToDo,
  type PeriodKind,
  type Product,
  type RelationshipKey,
  type RemindersResponse,
  type ReviewsResponse,
  type SessionResponse,
  type StoreItem,
  type TimeBlock,
  type TimeBlocksResponse,
  type TodayResponse,
  type WeekPlan,
  type WellbeingLog,
  type WellbeingSummary,
} from '@kreators/shared';
import { gratitudePromptByKey, gratitudePromptsForDay, GRATITUDE_LINE_MAX, GRATITUDE_LINES, type GratitudeDay } from '@kreators/shared/gratitude';
import { EAT_FRUIT_MAX, EAT_FULLNESS, EAT_MOMENTS, EAT_PACKAGED, EAT_VEG_MAX, EFFORT_LEVELS, mealLabel, MOVE_KIND_META, MOVE_KINDS, MOVE_MINUTES_MAX, typedMetres, type EatLog, type FitnessResponse, type MoveLog } from '@kreators/shared/fitness';
import { shiftDate } from '../db';
import { must, seg, ToolError, type Answer, type Req } from './dispatch';
import { aiPrivateOnly, cellText, DATA_TABLES, dataTableByKey, visibleColumns, type TablePageResponse, type TablesListResponse } from '@kreators/shared/dataTables';
import { localStamp } from '@kreators/shared';

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
  /** The model keeps nothing (a zero-retention host). `read_table` gives the journal, gratitude and the body and mind tables only to such a model. */
  private?: boolean;
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
  agency: ['agency', 'today', 'home', 'inbox'],
  // Fitness (2026-11-07): its own screen, Kreators Run's tool, Life's physical area, the brief and the review numbers.
  fitness: ['fitness', 'run', 'home', 'life', 'reviews', 'insights'],
  gratitude: ['gratitude', 'journal-days', 'home', 'reviews', 'insights'],
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
/** A task's area of life, by name; "none" clears it. Mapped to the key the route takes by `parseLifeArea`. */
const AREA: Prop = {
  type: 'string',
  enum: [...LIFE_AREA_ORDER.map((k) => LIFE_AREAS[k].name), 'none'],
  description: 'Tasks only: the area of life it serves (Physical, Financial, Mental, Emotional or Spiritual), or none. A tag only: it never changes what a tick pays.',
  aliases: { 'No area': 'none' },
};
/** A task's open business (Close the unfinished, 2026-11-07): one of the three kinds, or none. Sent as `openKind`; the route reads it through `parseOpenKind`. */
const OPEN: Prop = {
  type: 'string',
  enum: ['unfinished', 'unresolved', 'undecided', 'none'],
  description: 'Tasks only: the kind of open business it is. Unfinished: started and not done. Unresolved: a talk or a matter with other people. Undecided: a choice they keep thinking about. Or none. A tag only: it never changes what a tick pays. Daily\'s Unfinished business view lists it.',
};
const areaName = (key: string | null | undefined) => (key && key in LIFE_AREAS ? LIFE_AREAS[key as keyof typeof LIFE_AREAS].name : null);
const DAY: Prop = { type: 'string', enum: ['today', 'yesterday'], description: 'Which day. Today unless they say yesterday.' };
/** A task's time block, by name; "none" clears it. Sent as `timeBlock` to the node routes, which look it up among the person's own blocks. */
const BLOCK: Prop = { type: 'string', maxLength: 40, description: 'Tasks only: the time block it sits in, by name (Deep work, Busy work, Learn/explore, ... as get_time_blocks lists them), or none to let its time decide.' };
const blockName = (blocks: readonly TimeBlock[] | undefined, id: string | null | undefined) => (id ? (blocks?.find((b) => b.id === id)?.name ?? null) : null);
const WEEKDAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
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
/** A repeat rule from the words a model gives: a kind and how often. Anything unclear is no rule. */
function repeatArg(kind: unknown, every: unknown): ReturnType<typeof parseRepeat> {
  if (!kind) return null;
  return parseRepeat({ kind: str(kind).toLowerCase(), every: Number(every) || 1, days: [], until: null });
}

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
      "Today on Daily: whether they checked in, the small act, the day template (the kind of day) and its time blocks, the tasks waiting (up to six, with ids, their block, their kind of open business if any, and whether each can be ticked now), the tasks already ticked today (with ids, to untick one), and the not to do list (with ids and today's and yesterday's marks). Read this before ticking, unticking, checking in or marking.",
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
          dayTemplate: t.day ? { name: t.day.template.name, leads: pillarName(t.day.template.lead), from: t.day.from } : null,
          timeBlocks: (t.day?.slots ?? []).map((sl) => `${blockName(t.day?.blocks, sl.blockId) ?? 'A block'} ${slotRangeLabel(sl)}`),
          tasks: t.tasks.map((n) => {
            const wait = n.readyAt ? Math.ceil((Date.parse(n.readyAt) - now) / 60_000) : 0;
            const later = Boolean(n.doDate && n.doDate > io.date);
            return { id: n.id, title: n.title, pillar: pillarName(n.relationship), doDate: n.doDate, due: n.dueDate, priority: n.priority === null ? null : `P${n.priority}`, remember: n.remind, repeats: n.repeat ? repeatLabel(n.repeat, openDay(n)) : null, habit: taskIsHabit(n), area: areaName(n.lifeArea), openBusiness: n.openKind ?? null, block: blockName(t.day?.blocks, blockOfTask(n, t.day?.slots ?? [])?.blockId), time: n.dueTime, minutes: n.estimateMin, canTickNow: !later && wait <= 0, ...(later ? { waitsForDay: n.doDate } : wait > 0 ? { readyInMinutes: wait } : {}) };
          }),
          notScheduled: t.backlogTotal,
          // Tasks the person hid on Daily (2026-11-12): left out of every list above, counted only, so a question about one can be answered.
          hiddenTasks: t.hiddenTotal ?? 0,
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
    name: 'get_fitness',
    risk: 'read',
    sensitive: true,
    needs: ['fitness'],
    refresh: [],
    title: 'Look at your movement and eating',
    description: 'Fitness: the active minutes of the last seven days, and the last fourteen days of movement (kind, minutes, kilometres, effort 1 to 5) and of the daily eating check-in (the meals, each Good fuel, Tasty, Both or Just ate; fasting; servings of fruit and of vegetables; packaged, fried or sweet; how full they felt; meals without a screen; null means they did not say; a score for the day, 0 to 100, from fruit and veg, packaged food and meals without a screen, none on a fasting day or until fruit or vegetables are said, even 0). Never weight, size or calories. Protein grams, the protein goal and supplements stay on the Fitness screen and are never read here: say so if asked.',
    params: { type: 'object', properties: {} },
    run: async (_a, io) => {
      const f = must(await io.call({ method: 'GET', path: `/fitness?day=${io.date}` })) as FitnessResponse;
      const since = shiftDate(io.date, -13);
      return {
        data: {
          weekMinutes: f.weekMinutes,
          moves: f.moves.filter((m) => m.date >= since).slice(0, 60).map((m) => ({ id: m.id, date: m.date, kind: m.kind, minutes: m.minutes, km: m.metres ? m.metres / 1000 : null, effort: m.effort, club: m.source === 'club', note: m.note })),
          eating: f.eats.filter((e) => e.date >= since).map((e) => ({ date: e.date, fasting: e.fasting, meals: e.meals.map((m) => ({ meal: m.moment, felt: mealLabel(m) })), fruit: e.fruit, veg: e.veg, packaged: e.packaged === null ? null : EAT_PACKAGED[e.packaged], fullness: e.fullness === null ? null : EAT_FULLNESS[e.fullness], screenFree: e.screenFree, score: e.dayScore, note: e.note })),
        },
      };
    },
  },
  {
    // All tables for AI chat (2026-11-14, the founder: "give one toggle for ai chat access"): read only, and only the tables the person opened
    // to AI chat; the route checks that too (`X-Kreators-Via: assistant`). A table only a model that keeps nothing may read (the journal,
    // gratitude, every Body and mind table) is refused here to any other model, so a tool offered to every model never hands one of them over.
    name: 'read_table',
    risk: 'read',
    needs: ['tables'],
    refresh: [],
    title: 'Read one of your tables',
    description:
      "One of the person's own tables from All tables (call it first with no table to see which are open, and their keys), read only, and only a table they opened to AI chat (Show to AI chat at the top of the table, or under AI chat on their Profile tab). With table: a page of rows (size 10 or 25, 10 by default; empty cells left out; times in their own zone), the total that match and whether more follow, narrowed by words in q, sorted by a sortable column's key if asked, a later page with page. If a table is not open to you, say they can switch on Show to AI chat at the top of it; never ask them to paste it in. The journal, gratitude and the body and mind tables are read only by a model that keeps nothing. Read the journal or gratitude only when they ask about it, and quote it only when they ask.",
    params: {
      type: 'object',
      properties: {
        // The keys only, no names beside them: the spec rides on every message, and a call with no table lists the open ones by name.
        table: { type: 'string', enum: DATA_TABLES.map((t) => t.key) },
        q: { type: 'string', maxLength: 80 },
        sort: { type: 'string', maxLength: 40 },
        dir: { type: 'string', enum: ['asc', 'desc'] },
        size: { type: 'integer', enum: [10, 25] },
        page: { type: 'integer', minimum: 1, maximum: 200 },
      },
    },
    run: async (a, io) => {
      const key = str(a.table);
      if (!key) {
        const list = must(await io.call({ method: 'GET', path: '/tables' })) as TablesListResponse;
        const open = list.groups.flatMap((g) => g.tables.map((t) => ({ table: t.key, name: t.name, group: g.name, about: t.blurb, privateOnly: aiPrivateOnly(dataTableByKey[t.key]!) })));
        const shut = open.filter((t) => t.privateOnly && !io.private).map((t) => t.name);
        return {
          data: {
            tables: open.filter((t) => io.private || !t.privateOnly).map(({ table, name, group, about }) => ({ table, name, group, about })),
            ...(shut.length ? { onlyForAModelThatKeepsNothing: shut } : {}),
            ...(open.length ? {} : { why: 'They have not opened any table to AI chat. Each one has Show to AI chat at the top of it in All tables.' }),
          },
        };
      }
      const table = dataTableByKey[key];
      if (!table) throw new ToolError('There is no table by that name.');
      if (aiPrivateOnly(table) && !io.private) throw new ToolError(`This model may keep what it reads, so it cannot read ${table.name}. Pick a model that keeps nothing to read it.`);
      const qs = new URLSearchParams({ size: a.size === 25 ? '25' : '10', count: '1' });
      if (typeof a.page === 'number') qs.set('page', String(a.page));
      if (str(a.q)) qs.set('q', str(a.q));
      if (str(a.sort)) qs.set('sort', str(a.sort));
      if (str(a.dir)) qs.set('dir', str(a.dir));
      const p = must(await io.call({ method: 'GET', path: `/tables/${seg(table.key)}?${qs.toString()}` })) as TablePageResponse;
      const cols = visibleColumns(table, 'owner').filter((col) => p.columns.includes(col.key));
      const ctx = { options: p.options, currency: p.subject.currency };
      const zone = p.subject.zone;
      // A stamp is shown in the person's own zone (a journal entry at 1:30am IST is that day, never the UTC day before), as the screen shows it.
      const text = (col: (typeof cols)[number], cells: TablePageResponse['rows'][number]['cells']) => {
        const v = cells[col.key];
        if (col.kind === 'datetime' && typeof v === 'string') {
          const at = localStamp(v, zone);
          if (at) return `${at.day} ${String(Math.floor(at.minutes / 60)).padStart(2, '0')}:${String(at.minutes % 60).padStart(2, '0')}`;
        }
        return cellText(col, cells, ctx).slice(0, 200);
      };
      // Empty cells are left out, so a wide table's page stays short.
      const rows = p.rows.map((r) => Object.fromEntries(cols.map((col) => [col.label, text(col, r.cells)]).filter(([, v]) => v !== '')));
      const data = {
        table: table.name,
        zone,
        sortable: cols.filter((col) => col.sortable).map((col) => ({ key: col.key, label: col.label })),
        rows,
        page: p.page.page,
        more: p.page.more,
        total: p.total ?? null,
      };
      // Held under the smaller of the two chats' caps (the Companion reads 8,000 characters): the last rows go first, and it says exactly which
      // rows were left out and where they are at size 10, since paging on at the same size would skip them for good (the review, 2026-11-14).
      let cut = 0;
      while (JSON.stringify(data).length > 7_000 && data.rows.length > 1) {
        data.rows.pop();
        cut += 1;
      }
      if (!cut) return { data };
      const size = p.page.size;
      const first = (p.page.page - 1) * size + data.rows.length + 1;
      const last = (p.page.page - 1) * size + data.rows.length + cut;
      const from = Math.ceil(first / 10);
      const to = Math.ceil(last / 10);
      const where = size === 10 ? 'Narrow it with q to read them.' : `Ask with size 10 and page ${from === to ? from : `${from} to ${to}`} to read them.`;
      return { data: { ...data, sent: data.rows.length, cut: `Rows ${first} to ${last} of the list did not fit in this answer. ${where}` } };
    },
  },
  {
    name: 'read_discover',
    risk: 'read',
    sensitive: true,
    needs: ['discover'],
    refresh: [],
    title: 'Read your Discover profile',
    description:
      "A small profile from the person's own Discover quiz and self-checks: their strongest and quietest strengths, how each of five traits reads (low, middle or high), their reasoning level, their four-letter type, how they like to give and receive love, how they like their steps paced and how to help them. Only works when they allowed it; the part on how their mind works only when they switched that on as well. Never name a condition and never suggest they have one. Use it to choose a tone and the size of a step, never to label them, and never read it back to them unless they ask about their Discover results.",
    params: { type: 'object', properties: {} },
    run: async (_a, io) => ({ data: must(await io.call({ method: 'GET', path: '/discover/profile' })) }),
  },
  {
    name: 'read_journal',
    risk: 'read',
    sensitive: true,
    needs: ['journal'],
    refresh: [],
    title: 'Read your journal',
    description:
      "The person's own journal entries, newest first, and their gratitude for the day (three short lines a day, each under a prompt), optionally matching words or a date range. Call it only when they ask about their journal or their gratitude. Never bring the journal up yourself, and quote it only when they ask.",
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
      const words = str(a.query).toLowerCase();
      const from = str(a.from);
      const to = str(a.to);
      const range = `${/^\d{4}-\d{2}-\d{2}$/.test(from) ? `&from=${from}` : ''}${/^\d{4}-\d{2}-\d{2}$/.test(to) ? `&to=${to}` : ''}`;
      // The entries and the gratitude days (migration 0102) are both the journal: read together, through the same routes a tap uses.
      const [r, g] = await Promise.all([io.call({ method: 'GET', path: '/journal?size=100' }), io.call({ method: 'GET', path: `/journal/gratitude?size=50${range}` })]);
      const journal = must(r) as { entries: JournalEntry[]; stats: { total: number } };
      const thanks = must(g) as { days: GratitudeDay[] };
      // The day it is filed on in the person's zone, as on Journal, so an entry at 1 am sits on the same day as that day's gratitude.
      const dayOfEntry = (e: JournalEntry) => e.day ?? e.createdAt.slice(0, 10);
      const hits = journal.entries.filter((e) => {
        const day = dayOfEntry(e);
        return (!words || `${e.title} ${e.body}`.toLowerCase().includes(words)) && (!from || day >= from) && (!to || day <= to);
      });
      const limit = Number(a.limit ?? 5);
      return {
        data: {
          total: journal.stats.total,
          entries: hits.slice(0, limit).map((e) => ({ id: e.id, date: dayOfEntry(e), title: e.title, body: e.body.slice(0, 1500), feeling: feeling(e.emotion), stress: e.stress })),
          gratitude: thanks.days
            .map((d) => ({ date: d.day, lines: d.lines.filter((l) => l.text).map((l) => ({ prompt: gratitudePromptByKey(l.prompt)?.text ?? '', text: l.text })) }))
            .filter((d) => !words || d.lines.some((l) => l.text.toLowerCase().includes(words)))
            .slice(0, limit),
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
      const f = must(await io.call({ method: 'GET', path: `/finance?month=${month}&dusize=100` })) as FinanceSummary;
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
    description: "A review for a period, a day up to a year: this one or the last one. Gives the period, its numbers, the layer it walks (a day's tasks, a week's projects, and so on), the prompts to answer, and the answers if it was written already.",
    params: { type: 'object', properties: { kind: { type: 'string', enum: PERIOD_KINDS }, which: { type: 'string', enum: ['this', 'last'] } }, required: ['kind'] },
    run: async (a, io) => {
      const kind = str(a.kind) as PeriodKind;
      // "This" half or year is the one Reviews opens: the one just turned early on, so the half's two parts come at their times.
      const now = reviewPeriodNow(kind, io.date);
      const p = a.which === 'last' ? periodShift(now, -1) : now;
      const r = must(await io.call({ method: 'GET', path: `/reviews?kind=${kind}&date=${p.start}` })) as ReviewsResponse;
      const t = r.templates.find((x) => (r.review ? (r.review.templateId ?? `builtin:${kind}`) === x.id : x.builtIn)) ?? r.templates[0];
      const s = r.summary.now;
      return {
        data: {
          period: periodLabel(r.period),
          // The review's own name: for half a year the part it is (the mid-year check-in or the start-of-year setting).
          name: r.review?.templateName || t?.name || reviewNameFor(r.period),
          numbers: { xp: s.xp, tasksDone: s.tasksDone, checkins: s.checkins, days: s.days },
          // Reviews by layer (2026-11-07): the layer of the person's own pyramids this review walks, pillar by pillar (titles and counts only).
          layer: r.summary.layer
            ? {
                walks: layerKey(r.summary.layer.kind),
                pillars: r.summary.layer.pillars
                  .filter((g) => g.total > 0)
                  .map((g) => ({ pillar: pillarName(g.relationship), total: g.total, items: g.items.map((i) => ({ id: i.id, title: i.title, status: i.status, under: i.under, tasksDone: i.done, tasksOpen: i.open, pace: i.pace?.label ?? null, ...(i.late ? { late: true } : {}) })) })),
              }
            : null,
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
    description: `Add one layer to a pillar's pyramid. Each layer hangs under the one before: a guiding principle under a foundation, a value goal under a guiding principle, a goal outcome under a value goal, a project under a goal outcome, a task under a project. Give under (the parent's id) when the pillar has more than one; with just one it is found. A task is for today unless a do date is given (doDate is the day it will be done; dueDate is the deadline, never before the do date; doDate "none" leaves it unscheduled, in the list on Daily until a day is picked), and can be ticked ${WAIT.taskMinAgeMinutes} minutes after it is written. A task can have a priority P0 (do now), P1, P2 or P3, can repeat, can carry one area of life (Physical, Financial, Mental, Emotional or Spiritual), can sit in one of their time blocks (by name), can be tagged to remember (an inbox note on its day), and can be marked as open business (unfinished, unresolved or undecided).`,
    params: {
      type: 'object',
      properties: {
        pillar: PILLAR,
        layer: { type: 'string', enum: Object.keys(LAYERS) },
        title: { type: 'string', maxLength: 140 },
        under: id('parent layer'),
        doDate: { type: 'string', description: 'Tasks only: the day to do it. YYYY-MM-DD, today, tomorrow or none.' },
        dueDate: { type: 'string', description: 'Tasks only: the deadline. YYYY-MM-DD, today or tomorrow.' },
        priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'], description: 'Tasks only.' },
        repeat: { type: 'string', enum: ['daily', 'weekdays', 'weekly', 'monthly', 'yearly'], description: 'Tasks only: how it comes back. Needs a do date or a due date.' },
        every: { type: 'integer', minimum: 1, maximum: 52, description: 'With repeat: every this many days, weeks, months or years.' },
        remember: { type: 'boolean', description: 'Tasks only: tag it Remember. With a do date or a due date it also sends an inbox note on that day; with none it waits in the To remember list.' },
        habit: { type: 'boolean', description: 'Tasks only, with repeat: count it as a habit (the Habit tag). A repeating task is one unless this is false.' },
        area: AREA,
        openKind: OPEN,
        block: BLOCK,
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
      const doDay = task ? dateArg(a.doDate, io) : null;
      const dueDay = task ? dateArg(a.dueDate, io) : null;
      const dueTime = str(a.dueTime);
      if (task && dueTime && !TIME_RE.test(dueTime)) throw new ToolError('A time is HH:MM, like 07:30.');
      const r = must(
        await io.call({
          method: 'POST',
          path: '/nodes',
          body: {
            kind,
            parentId,
            relationship: pillar,
            title: str(a.title),
            note: str(a.note),
            ...(task
              ? {
                  doDate: doDay === undefined ? (dueDay ? null : io.date) : doDay,
                  dueDate: dueDay ?? null,
                  priority: parsePriority(a.priority),
                  repeat: repeatArg(a.repeat, a.every),
                  remind: a.remember === true,
                  ...(typeof a.habit === 'boolean' ? { habit: a.habit } : {}),
                  ...(a.area ? { lifeArea: parseLifeArea(a.area) } : {}),
                  ...(str(a.openKind) && str(a.openKind).toLowerCase() !== 'none' ? { openKind: str(a.openKind) } : {}),
                  ...(str(a.block) ? { timeBlock: str(a.block) } : {}),
                  dueTime: dueTime || null,
                  estimateMin: a.minutes ? Number(a.minutes) : null,
                }
              : {}),
          },
        }),
      ) as { node: Node };
      return {
        label: `Added the ${layerName(kind)} ${quote(r.node.title)} to ${pillarName(pillar)}`,
        undo: { method: 'DELETE', path: `/nodes/${seg(r.node.id)}` },
        data: { id: r.node.id, layer: layerKey(kind), title: r.node.title, pillar: pillarName(pillar), doDate: r.node.doDate, due: r.node.dueDate, priority: r.node.priority === null ? null : `P${r.node.priority}`, area: areaName(r.node.lifeArea), openBusiness: r.node.openKind ?? null },
      };
    },
  },
  {
    name: 'edit_pyramid_item',
    risk: 'write',
    needs: null,
    refresh: R.layers,
    title: 'Change something in a pyramid',
    description: 'Change a layer or a task: its title, its note, and for a task its do date, due date, priority (P0 to P3, or none), how it repeats (or none), whether it counts as a habit, its area of life (or none), its kind of open business (or none), its time block (by name, or none), remember, time and minutes. Renaming a task starts its wait again. Use "none" to clear a date, a time, a priority, a block or a repeat.',
    params: {
      type: 'object',
      properties: {
        itemId: id('layer or task'),
        title: { type: 'string', maxLength: 140 },
        note: { type: 'string', maxLength: 500 },
        doDate: { type: 'string', description: 'The day to do it: YYYY-MM-DD, today, tomorrow or none.' },
        dueDate: { type: 'string', description: 'The deadline: YYYY-MM-DD, today, tomorrow or none.' },
        priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3', 'none'] },
        repeat: { type: 'string', enum: ['daily', 'weekdays', 'weekly', 'monthly', 'yearly', 'none'] },
        every: { type: 'integer', minimum: 1, maximum: 52 },
        remember: { type: 'boolean' },
        habit: { type: 'boolean', description: 'A repeating task: count it as a habit (the Habit tag), or not.' },
        area: AREA,
        openKind: OPEN,
        block: BLOCK,
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
        const doDay = dateArg(a.doDate, io);
        if (doDay !== undefined) body.doDate = doDay;
        const pri = str(a.priority).toLowerCase();
        if (pri === 'none') body.priority = null;
        else if (pri) {
          if (parsePriority(pri) === null) throw new ToolError('A priority is P0, P1, P2 or P3.');
          body.priority = parsePriority(pri);
        }
        if (str(a.repeat).toLowerCase() === 'none') body.repeat = null;
        else if (a.repeat) body.repeat = repeatArg(a.repeat, a.every);
        if (typeof a.remember === 'boolean') body.remind = a.remember;
        if (typeof a.habit === 'boolean') body.habit = a.habit;
        if (a.area) body.lifeArea = parseLifeArea(a.area);
        if (str(a.openKind)) body.openKind = str(a.openKind).toLowerCase() === 'none' ? null : str(a.openKind);
        if (str(a.block)) body.timeBlock = str(a.block);
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
        undo: { method: 'PATCH', path: `/nodes/${prev.id}`, body: { title: prev.title, note: prev.note, ...(prev.kind === 'task' ? { doDate: prev.doDate, dueDate: prev.dueDate, repeat: prev.repeat, priority: prev.priority, remind: prev.remind, habit: prev.habit ?? null, lifeArea: prev.lifeArea ?? null, openKind: prev.openKind ?? null, timeBlockId: prev.timeBlockId ?? null } : { dueDate: prev.dueDate }), dueTime: prev.dueTime, estimateMin: prev.estimateMin } },
        data: { title: r.node.title, doDate: r.node.doDate, due: r.node.dueDate, priority: r.node.priority === null ? null : `P${r.node.priority}`, area: areaName(r.node.lifeArea), openBusiness: r.node.openKind ?? null, time: r.node.dueTime, minutes: r.node.estimateMin },
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
      const said: Record<LogKind, string> = { mood: 'Logged your mood', sleep: 'Logged your sleep', stress: 'Logged your stress', mindful: 'Logged mindful minutes', move: 'Logged time moving', eat: 'Logged how you ate' };
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
  {
    name: 'write_gratitude',
    risk: 'write',
    needs: ['journal'],
    refresh: R.gratitude,
    title: 'Write gratitude for the day',
    description: `Write the person's gratitude for today or yesterday on Journal: up to ${GRATITUDE_LINES} short lines, each under the day's own prompt, in their own words; add nothing of your own. Lines already written stay; new ones fill the empty places.`,
    params: {
      type: 'object',
      properties: { lines: { type: 'array', items: { type: 'string', maxLength: GRATITUDE_LINE_MAX }, maxItems: GRATITUDE_LINES }, day: DAY },
      required: ['lines'],
    },
    run: async (a, io) => {
      const day = dayOf(a.day, io);
      const words = (Array.isArray(a.lines) ? a.lines : [a.lines]).map(str).filter(Boolean);
      if (!words.length) throw new ToolError('Say what they are grateful for first.');
      // The same three prompts the person sees on Journal that day (kept per person, migration 0106), with the words already written.
      const got = must(await io.call({ method: 'GET', path: `/journal/gratitude?day=${day}&today=${io.date}` })) as { gratitude: GratitudeDay | null; prompts?: string[] };
      const before = got.gratitude;
      const keys = got.prompts ?? before?.lines.map((l) => l.prompt) ?? gratitudePromptsForDay(day).map((p) => p.key);
      const base = keys.map((prompt, i) => ({ prompt, text: before?.lines[i]?.text ?? '' }));
      const queue = [...words];
      const lines = base.map((l) => (l.text || !queue.length ? l : { prompt: l.prompt, text: queue.shift()! }));
      if (queue.length === words.length) throw new ToolError(`All ${GRATITUDE_LINES} lines for that day are written already. They can change them on Journal.`);
      const saved = (must(await io.call({ method: 'PUT', path: `/journal/gratitude/${day}`, body: { lines, today: io.date, ifUpdatedAt: before?.updatedAt ?? '' } })) as { gratitude: GratitudeDay | null }).gratitude;
      // Undo only a day that had nothing before: emptying it removes it. A day with lines already kept has no Undo, so their words never sit in the action log.
      // The undo carries the version this write made, so once the person changes the day on Journal the undo answers 409 and their words stay.
      const empty = lines.map((l) => ({ prompt: l.prompt, text: '' }));
      return {
        label: `Wrote ${words.length - queue.length === 1 ? 'a line' : `${words.length - queue.length} lines`} of gratitude`,
        undo: before || !saved ? null : { method: 'PUT', path: `/journal/gratitude/${day}`, body: { lines: empty, today: io.date, ifUpdatedAt: saved.updatedAt } },
        data: { saved: true, day, written: lines.filter((l) => l.text).length, left: queue.length },
      };
    },
  },
  {
    name: 'log_movement',
    risk: 'write',
    needs: ['fitness'],
    refresh: R.fitness,
    title: 'Log movement',
    description: `Log movement on Fitness for today or yesterday: what it was (${MOVE_KINDS.join(', ')}), for how many minutes, and if they said, the distance in kilometres (${MOVE_KINDS.filter((k) => MOVE_KIND_META[k].distance).join(', ')} only) and the effort 1 to 5 (${EFFORT_LEVELS.map((e, i) => `${i + 1} ${e}`).join(', ')}). It pays nothing.`,
    params: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: [...MOVE_KINDS] },
        minutes: { type: 'integer', minimum: 1, maximum: MOVE_MINUTES_MAX },
        km: { type: 'number', minimum: 0, maximum: 300 },
        effort: { type: 'integer', minimum: 1, maximum: 5 },
        note: { type: 'string', maxLength: 500 },
        day: DAY,
      },
      required: ['kind', 'minutes'],
    },
    run: async (a, io) => {
      // Kilometres read from their digits (typedMetres), never through a float sum.
      const metres = a.km === undefined || a.km === null || a.km === '' || Number(a.km) === 0 ? null : typedMetres(String(a.km));
      if (metres === 'bad') throw new ToolError('That distance does not look right. Say it in kilometres, like 5.2.');
      const r = must(await io.call({ method: 'POST', path: '/fitness/move', body: { date: dayOf(a.day, io), kind: str(a.kind), minutes: Number(a.minutes), metres, effort: a.effort ? Number(a.effort) : null, note: str(a.note) } })) as { move: MoveLog };
      return { label: `Logged ${r.move.minutes} minutes of ${str(a.kind)}`, undo: { method: 'DELETE', path: `/fitness/move/${seg(r.move.id)}` }, data: { logged: true, id: r.move.id, date: r.move.date } };
    },
  },
  {
    name: 'log_eating',
    risk: 'write',
    needs: ['fitness'],
    refresh: R.fitness,
    title: 'Do the eating check-in',
    description: `The day's eating check-in on Fitness, for today or yesterday, one a day. Meals are any of ${EAT_MOMENTS.join(', ')}; goodFuel and tasty list which of those meals were good fuel or tasty (a meal can be both). Or fasting true instead of meals. Then servings of fruit (0 to ${EAT_FRUIT_MAX}) and of vegetables (0 to ${EAT_VEG_MAX}), packaged, fried or sweet (0 none, 1 some, 2 a lot), how full they felt after (0 still hungry, 1 just right, 2 too full) and meals without a screen. Put in only what they said: leave out anything they did not mention, and send 0 only when they said none, since the score leaves out what was not said. A day gets no score until fruit or vegetables are said, whatever else they said. Grams of protein are added on the Fitness screen, not here: this keeps whatever the day already has. Never weight, size or calories. Doing it again replaces the rest of the day's.`,
    params: {
      type: 'object',
      properties: {
        meals: { type: 'array', items: { type: 'string', enum: [...EAT_MOMENTS] }, maxItems: EAT_MOMENTS.length },
        goodFuel: { type: 'array', items: { type: 'string', enum: [...EAT_MOMENTS] }, maxItems: EAT_MOMENTS.length },
        tasty: { type: 'array', items: { type: 'string', enum: [...EAT_MOMENTS] }, maxItems: EAT_MOMENTS.length },
        fasting: { type: 'boolean' },
        fruit: { type: 'integer', minimum: 0, maximum: EAT_FRUIT_MAX },
        veg: { type: 'integer', minimum: 0, maximum: EAT_VEG_MAX },
        packaged: { type: 'integer', minimum: 0, maximum: 2 },
        fullness: { type: 'integer', minimum: 0, maximum: 2 },
        screenFree: { type: 'integer', minimum: 0, maximum: 5 },
        note: { type: 'string', maxLength: 500 },
        day: DAY,
      },
    },
    run: async (a, io) => {
      const date = dayOf(a.day, io);
      // A first check-in for the day can be undone. One that replaced the day's older one cannot, so the older note never sits in the action log.
      const had = (must(await io.call({ method: 'GET', path: `/fitness?day=${io.date}` })) as FitnessResponse).eats.some((e) => e.date === date);
      const n = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : Number(v));
      const list = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
      const meals = list(a.meals).map((moment) => ({ moment, fuel: list(a.goodFuel).includes(moment), tasty: list(a.tasty).includes(moment) }));
      const body = { date, meals, fasting: a.fasting === true || a.fasting === 'true', fruit: n(a.fruit), veg: n(a.veg), packaged: n(a.packaged) ?? null, fullness: n(a.fullness) ?? null, screenFree: n(a.screenFree), note: str(a.note) };
      const r = must(await io.call({ method: 'PUT', path: '/fitness/eat', body })) as { eat: EatLog };
      return { label: had ? 'Replaced the eating check-in' : 'Did the eating check-in', undo: had ? null : { method: 'DELETE', path: `/fitness/eat/${seg(r.eat.id)}` }, data: { saved: true, date: r.eat.date, score: r.eat.dayScore, fasting: r.eat.fasting, replaced: had } };
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
      const f = must(await io.call({ method: 'GET', path: `/finance?month=${io.date.slice(0, 7)}&dusize=100` })) as FinanceSummary;
      const d = f.dues.find((x) => x.id === want && x.status === 'open');
      if (!d) throw new ToolError('Could not find that open due. Look it up again with get_finance.');
      const amount = money(d.amountCents, d.currency);
      return `Settle ${d.direction === 'owed' ? `${d.counterparty} owes you ${amount}` : `you owe ${d.counterparty} ${amount}`}. It is booked in Finance and cannot be undone here`;
    },
    run: async (a, io) => {
      const dueId = seg(a.dueId);
      must(await io.call({ method: 'POST', path: `/finance/dues/${dueId}/settle?day=${io.date}` }));
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
      // "This" half or year is the one Reviews opens: the one just turned early on, so the half's two parts come at their times.
      const now = reviewPeriodNow(kind, io.date);
      const p = a.which === 'last' ? periodShift(now, -1) : now;
      const r = must(await io.call({ method: 'GET', path: `/reviews?kind=${kind}&date=${p.start}` })) as ReviewsResponse;
      const t = r.templates.find((x) => (r.review ? (r.review.templateId ?? `builtin:${kind}`) === x.id : x.builtIn)) ?? r.templates[0];
      const put = must(
        await io.call({ method: 'PUT', path: '/reviews', body: { kind, date: p.start, templateId: t && !t.builtIn ? t.id : null, answers: a.answers, rating: a.rating ?? null, highlight: str(a.highlight) } }),
      ) as { review: { id: string } | null };
      // A first review can be undone. One that replaced an older one cannot, so the older words never sit in the action log.
      return {
        label: `${r.review ? 'Replaced' : 'Saved'} your ${(t && !t.builtIn ? t.name : reviewNameFor(r.period)).toLowerCase()} for ${periodLabel(r.period)}`,
        undo: !r.review && put.review ? { method: 'DELETE', path: `/reviews/${seg(put.review.id)}` } : null,
        data: { saved: true, period: periodLabel(r.period), replaced: Boolean(r.review) },
      };
    },
  },

  // ---- water and reminders (core)
  {
    name: 'get_reminders',
    risk: 'read',
    needs: null,
    refresh: [],
    title: 'Look at water and reminders',
    description: "Today's water (how much, the goal, the glass size) and the person's own reminders: their custom ones and the tasks tagged Remember.",
    params: { type: 'object', properties: { day: DAY } },
    run: async (a, io) => {
      const r = must(await io.call({ method: 'GET', path: `/reminders?day=${dayOf(a.day, io)}` })) as RemindersResponse;
      return {
        data: {
          water: { ml: r.water.ml, goalMl: r.water.goalMl, glassMl: r.water.glassMl, glasses: r.water.glasses, goalGlasses: r.water.goalGlasses },
          custom: r.custom.map((x) => ({ id: x.id, title: x.title, time: x.time, enabled: x.enabled })),
          tasksToRemember: r.tasks.map((t) => ({ id: t.id, title: t.title, day: t.day, time: t.time })),
        },
      };
    },
  },
  {
    name: 'log_water',
    risk: 'write',
    needs: null,
    refresh: ['reminders', 'home', 'today'],
    title: 'Log water',
    description: "Add water for today or yesterday: a glass (the person's own size) unless they say an amount in ml.",
    params: { type: 'object', properties: { day: DAY, ml: { type: 'integer', minimum: 50, maximum: 2000 } } },
    run: async (a, io) => {
      const date = dayOf(a.day, io);
      const r = must(await io.call({ method: 'POST', path: '/reminders/water', body: { day: date, ...(a.ml ? { ml: Number(a.ml) } : {}) } })) as { water: { ml: number; glasses: number } };
      return { label: `Logged water, ${r.water.ml} ml today`, undo: { method: 'DELETE', path: `/reminders/water?day=${date}` }, data: { ml: r.water.ml, glasses: r.water.glasses } };
    },
  },

  // ---- subtasks on a task (core)
  {
    name: 'list_subtasks',
    risk: 'read',
    needs: null,
    refresh: [],
    title: 'Look at a task’s subtasks',
    description: 'The checklist on one task, with ids, so one can be ticked or removed.',
    params: { type: 'object', properties: { taskId: id('task') }, required: ['taskId'] },
    run: async (a, io) => {
      const taskId = seg(a.taskId);
      const r = must(await io.call({ method: 'GET', path: `/nodes/${taskId}/subtasks` })) as { subtasks: { id: string; title: string; done: boolean }[] };
      return { data: { subtasks: r.subtasks } };
    },
  },
  {
    name: 'add_subtask',
    risk: 'write',
    needs: null,
    refresh: ['nodes', 'today'],
    title: 'Add a subtask',
    description: "Add one line to a task's checklist (up to 20). It pays nothing and never blocks the tick.",
    params: { type: 'object', properties: { taskId: id('task'), title: { type: 'string', maxLength: 200 } }, required: ['taskId', 'title'] },
    run: async (a, io) => {
      const taskId = seg(a.taskId);
      const title = str(a.title);
      if (!title) throw new ToolError('Say what the subtask is.');
      const r = must(await io.call({ method: 'POST', path: `/nodes/${taskId}/subtasks`, body: { title } })) as { subtask: { id: string; title: string } };
      return { label: `Added "${r.subtask.title}"`, undo: { method: 'DELETE', path: `/nodes/subtasks/${r.subtask.id}` }, data: { id: r.subtask.id, title: r.subtask.title } };
    },
  },
  {
    name: 'toggle_subtask',
    risk: 'write',
    needs: null,
    refresh: ['nodes', 'today'],
    title: 'Tick a subtask',
    description: 'Tick or untick one subtask. It pays nothing and never blocks the task itself.',
    params: { type: 'object', properties: { subtaskId: id('subtask'), done: { type: 'boolean' } }, required: ['subtaskId', 'done'] },
    run: async (a, io) => {
      const subtaskId = seg(a.subtaskId);
      const done = a.done === true;
      const r = must(await io.call({ method: 'PATCH', path: `/nodes/subtasks/${subtaskId}`, body: { done } })) as { subtask: { id: string; title: string; done: boolean } };
      return { label: `${done ? 'Ticked' : 'Unticked'} "${r.subtask.title}"`, undo: { method: 'PATCH', path: `/nodes/subtasks/${subtaskId}`, body: { done: !done } }, data: { id: r.subtask.id, done: r.subtask.done } };
    },
  },

  // ---- plan the week (core, read only: Keep applies suggestions one at a time with edit_pyramid_item)
  {
    name: 'get_week_plan',
    risk: 'read',
    needs: null,
    refresh: [],
    title: 'Plan the week',
    description:
      'A suggested day for each open task that has none, the lightest day it fits in, and a time block for it from its area and pillar, plus each day\'s day template, how strong the plan is and a few plain notes. Writes nothing: put a suggestion into effect with edit_pyramid_item and its doDate (and block).',
    params: { type: 'object', properties: { hoursADay: { type: 'integer', minimum: 1, maximum: 12 } } },
    run: async (a, io) => {
      const hours = a.hoursADay ? Number(a.hoursADay) : undefined;
      const { plan, blocks } = must(await io.call({ method: 'GET', path: `/today/week-plan?date=${io.date}${hours ? `&hours=${hours}` : ''}` })) as { plan: WeekPlan; blocks?: TimeBlock[] };
      return {
        data: {
          strengthNow: plan.strengthNow.label,
          strengthWithSuggestions: plan.strengthWith.label,
          days: plan.days.map((d) => ({ day: d.date, dayTemplate: d.templateName ?? null })),
          suggestions: plan.suggestions.map((s) => ({ id: s.id, title: s.title, day: s.day, minutes: s.estimateMin, reason: s.reason, block: blockName(blocks, s.blockId) })),
          noRoom: plan.noRoom.map((t) => ({ id: t.id, title: t.title })),
          notes: plan.notes,
        },
      };
    },
  },

  // ---- time blocks and day templates (core: docs/time-blocks.md)
  {
    name: 'get_time_blocks',
    risk: 'read',
    needs: null,
    refresh: [],
    title: 'Look at your time blocks',
    description:
      'Their time blocks (name, tag, area, pillar), their day templates (the kinds of day, each with its blocks on the clock and the pillar that leads), which template each weekday of their usual week uses, and this week\'s seven days with the template each one uses and whether that date was changed.',
    params: { type: 'object', properties: {} },
    run: async (_a, io) => {
      const r = must(await io.call({ method: 'GET', path: `/time-blocks?day=${io.date}` })) as TimeBlocksResponse;
      const tplName = (id: string | null) => (id ? (r.templates.find((t) => t.id === id)?.name ?? null) : null);
      return {
        data: {
          blocks: r.blocks.map((b) => ({ name: b.name, tag: b.tag, area: areaName(b.area), pillar: b.pillar ? pillarName(b.pillar) : null })),
          templates: r.templates.map((t) => ({ name: t.name, isDefault: t.isDefault, leads: pillarName(t.lead), second: t.second ? pillarName(t.second) : null, blocks: t.slots.map((sl) => `${blockName(r.blocks, sl.blockId) ?? 'A block'} ${slotRangeLabel(sl)}`) })),
          usualWeek: r.pattern.map((id, i) => ({ weekday: WEEKDAY_NAMES[i], template: tplName(id) ?? `${tplName(r.defaultTemplateId)} (the default)` })),
          thisWeek: r.days.map((d) => ({ day: d.date, template: tplName(d.templateId), changedForThisDate: d.from === 'date' })),
        },
      };
    },
  },
  {
    name: 'set_day_template',
    risk: 'write',
    needs: null,
    refresh: ['today', 'timeBlocks', 'weekPlan', 'dayType'],
    title: 'Set the kind of day',
    description:
      'Set which day template (kind of day) some days use. Give dates (YYYY-MM-DD, today or tomorrow) to change just those dates, or weekdays to change their usual week. template is a template name from get_time_blocks, or "week" to put those dates (or weekdays) back to following the week (or the default).',
    params: {
      type: 'object',
      properties: {
        template: { type: 'string', maxLength: 40, description: 'A day template name, or "week" to follow the usual week again.' },
        dates: { type: 'array', items: { type: 'string' }, maxItems: 31, description: 'Change only these dates.' },
        weekdays: { type: 'array', items: { type: 'string', enum: WEEKDAY_NAMES }, maxItems: 7, description: 'Change the usual week on these weekdays.' },
      },
      required: ['template'],
    },
    run: async (a, io) => {
      const name = str(a.template);
      const back = ['week', 'default', 'none'].includes(name.toLowerCase());
      const dates = Array.isArray(a.dates) ? (a.dates as unknown[]).map((d) => dateArg(d, io)).filter((d): d is string => typeof d === 'string') : [];
      const weekdays = Array.isArray(a.weekdays) ? (a.weekdays as unknown[]).map((w) => WEEKDAY_NAMES.indexOf(str(w).toLowerCase()) + 1).filter((w) => w > 0) : [];
      if (!dates.length && !weekdays.length) throw new ToolError('Say which dates or which weekdays.');
      if (dates.length && weekdays.length) throw new ToolError('Change dates or weekdays, one at a time.');
      const choice = back ? { templateId: null } : { template: name };
      if (dates.length) {
        const r = must(await io.call({ method: 'PUT', path: '/time-blocks/days', body: { dates, ...choice } })) as { days: { date: string; templateId: string | null; previous: string | null }[] };
        const prev = [...new Set(r.days.map((d) => d.previous))];
        return {
          label: back ? `Put ${dates.length === 1 ? dates[0] : `${dates.length} days`} back on your week` : `Made ${dates.length === 1 ? dates[0] : `${dates.length} days`} a ${quote(name)}`,
          // One undo when the dates all had the same template before; otherwise it is set back by hand.
          undo: prev.length === 1 ? { method: 'PUT', path: '/time-blocks/days', body: { dates, templateId: prev[0] ?? null } } : null,
          data: { days: r.days.map((d) => ({ day: d.date, changed: d.templateId !== null })) },
        };
      }
      const r = must(await io.call({ method: 'PUT', path: '/time-blocks/pattern', body: { weekdays, ...choice } })) as { pattern: (string | null)[]; previous: { weekday: number; templateId: string | null }[] };
      const prev = [...new Set(r.previous.map((p) => p.templateId))];
      const names = weekdays.map((w) => WEEKDAY_NAMES[w - 1]).join(', ');
      return {
        label: back ? `Put ${names} back on the default` : `Your ${names} now ${weekdays.length === 1 ? 'uses' : 'use'} ${quote(name)}`,
        undo: prev.length === 1 ? { method: 'PUT', path: '/time-blocks/pattern', body: { weekdays, templateId: prev[0] ?? null } } : null,
        data: { weekdays: weekdays.map((w) => WEEKDAY_NAMES[w - 1]) },
      };
    },
  },

  // ---- focus (Mindfulness)
  {
    name: 'get_focus',
    risk: 'read',
    sensitive: true,
    needs: TRACKERS,
    refresh: [],
    title: 'Look at focus time',
    description: 'Minutes of focus logged by day, by week or by month, the task it went to, and how this stretch compares with the one before.',
    params: { type: 'object', properties: { view: { type: 'string', enum: ['day', 'week', 'month'] } } },
    run: async (a, io) => {
      const view = str(a.view) || 'day';
      const r = must(await io.call({ method: 'GET', path: `/wellbeing/focus?date=${io.date}&view=${view}` })) as {
        totals: { minutes: number; rounds: number; tasksDone: number; quality: number | null };
        tasks: { title: string; minutes: number; rounds: number }[];
        trend: string;
      };
      return { data: { minutes: r.totals.minutes, rounds: r.totals.rounds, tasksDone: r.totals.tasksDone, quality: r.totals.quality, byTask: r.tasks.slice(0, 5).map((t) => ({ title: t.title, minutes: t.minutes })), trend: r.trend } };
    },
  },

  // ---- inbox (core)
  {
    name: 'get_inbox',
    risk: 'read',
    needs: null,
    refresh: [],
    title: 'Look at the inbox',
    description: 'The inbox, newest first, with ids, so one can be archived. Unread by default.',
    params: { type: 'object', properties: { show: { type: 'string', enum: ['inbox', 'unread', 'archived'] } } },
    run: async (a, io) => {
      const show = str(a.show) || 'unread';
      const r = must(await io.call({ method: 'GET', path: `/inbox?show=${show}` })) as { notifications: Notification[]; unread: number };
      return { data: { unread: r.unread, notifications: r.notifications.slice(0, 20).map((n) => ({ id: n.id, title: n.title, body: n.body, read: Boolean(n.readAt), createdAt: n.createdAt })) } };
    },
  },
  {
    name: 'archive_inbox',
    risk: 'write',
    needs: null,
    refresh: ['inbox'],
    title: 'Archive an inbox note',
    description: 'Put one inbox note away, or bring it back.',
    params: { type: 'object', properties: { noteId: id('inbox note'), archived: { type: 'boolean' } }, required: ['noteId'] },
    run: async (a, io) => {
      const noteId = seg(a.noteId);
      const away = a.archived !== false;
      const r = must(await io.call({ method: 'POST', path: `/inbox/${noteId}/archive`, body: { archived: away } })) as { archived: boolean };
      return { label: r.archived ? 'Archived' : 'Brought back', undo: { method: 'POST', path: `/inbox/${noteId}/archive`, body: { archived: !away } }, data: { archived: r.archived } };
    },
  },

  // ---- Community
  {
    name: 'list_community_posts',
    risk: 'read',
    needs: ['community'],
    refresh: [],
    title: 'Look at Community',
    description: 'The Community feed: recent posts with ids, so one can be replied to.',
    params: { type: 'object', properties: { category: { type: 'string', maxLength: 40 } } },
    run: async (a, io) => {
      const category = str(a.category);
      const r = must(await io.call({ method: 'GET', path: `/community${category ? `?category=${encodeURIComponent(category)}` : ''}` })) as { posts: CommunityPost[] };
      return { data: { posts: r.posts.slice(0, 15).map((p) => ({ id: p.id, by: p.anonymous ? 'anonymous' : p.authorName, category: p.category, body: p.body, likes: p.likes, replies: p.replies })) } };
    },
  },
  {
    name: 'add_community_post',
    risk: 'write',
    needs: ['community'],
    refresh: ['community'],
    title: 'Write a Community post',
    description: 'Post to Community. Pays a little xp, up to three a day.',
    params: { type: 'object', properties: { body: { type: 'string', maxLength: 2000 }, category: { type: 'string', maxLength: 40 } }, required: ['body'] },
    run: async (a, io) => {
      const body = str(a.body);
      if (!body) throw new ToolError('Say what to post.');
      const category = str(a.category);
      const r = must(await io.call({ method: 'POST', path: '/community', body: { body, ...(category ? { category } : {}) } })) as { post: CommunityPost };
      return { label: 'Posted to Community', undo: { method: 'DELETE', path: `/community/${r.post.id}` }, data: { id: r.post.id } };
    },
  },
  {
    name: 'reply_to_post',
    risk: 'write',
    needs: ['community'],
    refresh: ['community', 'replies'],
    title: 'Reply in Community',
    description: 'Reply to a Community post. Pays a little xp, up to five a day.',
    params: { type: 'object', properties: { postId: id('post'), body: { type: 'string', maxLength: 1000 } }, required: ['postId', 'body'] },
    run: async (a, io) => {
      const postId = seg(a.postId);
      const body = str(a.body);
      if (!body) throw new ToolError('Say what to reply.');
      const r = must(await io.call({ method: 'POST', path: `/community/${postId}/replies`, body: { body } })) as { reply: CommunityReply | null };
      return { label: 'Replied', data: { id: r.reply?.id ?? null } };
    },
  },

  // ---- Party RSVP
  {
    name: 'rsvp_event',
    risk: 'write',
    needs: ['party'],
    refresh: ['party', 'home'],
    title: 'RSVP to an event',
    description: 'RSVP to a Party event by its id (from the Party screen). Takes a seat, or a place on the waitlist when it is full; a ticket that costs points is paid from the balance.',
    params: { type: 'object', properties: { eventId: id('event') }, required: ['eventId'] },
    run: async (a, io) => {
      const eventId = seg(a.eventId);
      const r = must(await io.call({ method: 'POST', path: `/party/events/${eventId}/rsvp`, body: {} })) as { status: string };
      return { label: r.status === 'waitlisted' ? 'On the waitlist' : 'RSVPed', undo: { method: 'POST', path: `/party/events/${eventId}/cancel-rsvp` }, data: { status: r.status } };
    },
  },

  // ---- School enrolment
  {
    name: 'enrol_cohort',
    risk: 'write',
    needs: ['school'],
    refresh: ['school'],
    title: 'Enrol in a cohort',
    description: 'Enrol in a School cohort by its id. A cohort priced in points spends them from the balance; a free one costs nothing.',
    params: { type: 'object', properties: { cohortId: id('cohort') }, required: ['cohortId'] },
    run: async (a, io) => {
      const cohortId = seg(a.cohortId);
      must(await io.call({ method: 'POST', path: `/school/cohorts/${cohortId}/enroll`, body: {} }));
      return { label: 'Enrolled', data: { enrolled: true } };
    },
  },

  // ---- Store and Shop reads
  {
    name: 'browse_shop',
    risk: 'read',
    needs: null,
    refresh: [],
    title: 'Browse the Shop',
    description: "Open sessions or events for sale on the Shop, across creators (not only the person's own).",
    params: { type: 'object', properties: { kind: { type: 'string', enum: ['session', 'event'] } } },
    run: async (a, io) => {
      const kind = str(a.kind) || 'session';
      const r = must(await io.call({ method: 'GET', path: `/store/browse?kind=${kind}` })) as { products: Product[] };
      return { data: { products: r.products.slice(0, 15).map((p) => ({ id: p.id, title: p.title, by: p.ownerName, points: p.pricePoints, cents: p.priceCents })) } };
    },
  },
  {
    name: 'browse_store',
    risk: 'read',
    needs: ['store'],
    refresh: [],
    title: 'Browse the Store',
    description: 'Gear listed on the Store: new, through a partner link, or pre-owned from another creator.',
    params: { type: 'object', properties: {} },
    run: async (_a, io) => {
      const r = must(await io.call({ method: 'GET', path: '/market' })) as { items: StoreItem[] };
      return { data: { items: r.items.slice(0, 15).map((i) => ({ id: i.id, title: i.title, category: i.category })) } };
    },
  },

  // ---- Agency reads (owner only; the route itself filters by the session user)
  {
    name: 'list_agency_clients',
    risk: 'read',
    needs: ['agency'],
    refresh: [],
    title: 'Look at Agency clients',
    description: 'Every client, their stage and this month’s counts, and what needs attention today.',
    params: { type: 'object', properties: {} },
    run: async (_a, io) => {
      const r = must(await io.call({ method: 'GET', path: `/agency?day=${io.date}` })) as AgencyOverview;
      return {
        data: {
          attention: r.attention,
          clients: r.clients.map((cl) => ({ id: cl.id, name: cl.name, status: cl.status, health: cl.health, stage: cl.stage, month: cl.month })),
        },
      };
    },
  },
  {
    name: 'get_agency_client',
    risk: 'read',
    needs: ['agency'],
    refresh: [],
    title: 'Look at one Agency client',
    description: 'One client in full: stage, deliverable counts by stage, hours, invoices and where they are from enquiry to monthly delivery.',
    params: { type: 'object', properties: { clientId: id('client') }, required: ['clientId'] },
    run: async (a, io) => {
      const clientId = seg(a.clientId);
      const r = must(await io.call({ method: 'GET', path: `/agency/clients/${clientId}?day=${io.date}` })) as AgencyClientPage;
      return {
        data: {
          name: r.client.name,
          stage: r.client.stage,
          health: r.client.health,
          month: r.client.month,
          deliverableCounts: r.counts,
          invoices: r.invoices.map((inv) => ({ id: inv.id, number: inv.number, status: inv.status, cents: inv.totalCents, currency: inv.currency })),
        },
      };
    },
  },
  {
    name: 'list_agency_invoices',
    risk: 'read',
    needs: ['agency'],
    refresh: [],
    title: 'Look at Agency invoices',
    description: 'The Agency invoices, newest first: number, client, status (draft, sent, paid, void) and total, with the count and sum for each status. Optionally only one status or one client.',
    params: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['draft', 'sent', 'paid', 'void'], description: 'Only invoices with this status.' },
        clientId: id('client'),
      },
    },
    run: async (a, io) => {
      const q = new URLSearchParams({ size: '50' });
      const status = str(a.status);
      if (['draft', 'sent', 'paid', 'void'].includes(status)) q.set('status', status);
      if (a.clientId) q.set('client', seg(a.clientId));
      const r = must(await io.call({ method: 'GET', path: `/agency/invoices?${q.toString()}` })) as { page: { more: boolean }; invoices: Invoice[]; counts: { status: string; n: number; cents: number }[] };
      const currency = r.invoices[0]?.currency ?? 'INR';
      return {
        data: {
          invoices: r.invoices.map((inv) => ({ id: inv.id, number: inv.number, client: inv.clientName, status: inv.status, total: money(inv.totalCents, inv.currency), due: inv.dueDate })),
          byStatus: r.counts.map((x) => ({ status: x.status, count: x.n, total: money(x.cents, currency) })),
          more: r.page.more,
        },
      };
    },
  },

  // ---- Agency writes: each one is an Agency route the screens already use, so the owner filter, the module gate and the limits apply.
  {
    name: 'add_agency_deliverable',
    risk: 'write',
    needs: ['agency'],
    refresh: R.agency,
    title: 'Add a deliverable',
    description: 'Add a piece of client work (a deliverable) under one Agency client: a title, optionally the kind, the stage (idea unless they say), a due day and a publish day. Look the client up with list_agency_clients first.',
    params: {
      type: 'object',
      properties: {
        clientId: id('client'),
        title: { type: 'string', maxLength: 120 },
        kind: { type: 'string', enum: DELIVERABLE_KINDS },
        stage: { type: 'string', enum: DELIVERABLE_STAGES },
        dueDate: { type: 'string', description: 'YYYY-MM-DD, today or tomorrow.' },
        publishDate: { type: 'string', description: 'YYYY-MM-DD, today or tomorrow.' },
      },
      required: ['clientId', 'title'],
    },
    run: async (a, io) => {
      const body: Record<string, unknown> = { clientId: seg(a.clientId), title: str(a.title) };
      if (a.kind) body.kind = str(a.kind);
      if (a.stage) body.stage = str(a.stage);
      const due = dateArg(a.dueDate, io);
      const live = dateArg(a.publishDate, io);
      if (due !== undefined) body.dueDate = due;
      if (live !== undefined) body.publishDate = live;
      const r = must(await io.call({ method: 'POST', path: `/agency/items?day=${io.date}`, body })) as { id: string };
      return { label: `Added ${quote(str(a.title))}`, undo: { method: 'DELETE', path: `/agency/items/${seg(r.id)}` }, data: { id: r.id, title: str(a.title) } };
    },
  },
  {
    name: 'move_agency_deliverable',
    risk: 'write',
    needs: ['agency'],
    refresh: R.agency,
    title: 'Move a deliverable',
    description: `Move one deliverable to another stage (${DELIVERABLE_STAGES.join(', ')}). Give the client id too, so it is found among that client's pieces.`,
    params: { type: 'object', properties: { itemId: id('deliverable'), clientId: id('client'), stage: { type: 'string', enum: DELIVERABLE_STAGES } }, required: ['itemId', 'clientId', 'stage'] },
    run: async (a, io) => {
      const itemId = seg(a.itemId);
      const list = must(await io.call({ method: 'GET', path: `/agency/items?client=${seg(a.clientId)}&size=100&day=${io.date}` })) as { items: AgencyDeliverable[] };
      const prev = list.items.find((x) => x.id === itemId);
      if (!prev) throw new ToolError('Could not find that deliverable under that client. Look it up again with get_agency_client.');
      const stage = str(a.stage);
      must(await io.call({ method: 'PATCH', path: `/agency/items/${itemId}?day=${io.date}`, body: { stage } }));
      return { label: `Moved ${quote(prev.title)} to ${stage}`, undo: { method: 'PATCH', path: `/agency/items/${itemId}?day=${io.date}`, body: { stage: prev.stage } }, data: { title: prev.title, from: prev.stage, to: stage } };
    },
  },
  {
    name: 'add_agency_note',
    risk: 'write',
    needs: ['agency'],
    refresh: R.agency,
    title: 'Add a note to a deliverable',
    description: 'Add a note to one deliverable’s thread. It stays private unless shared is true, which shows it to the client at their link.',
    params: { type: 'object', properties: { itemId: id('deliverable'), text: { type: 'string', maxLength: 1000 }, shared: { type: 'boolean', description: 'Show it to the client. False unless they say so.' } }, required: ['itemId', 'text'] },
    run: async (a, io) => {
      const itemId = seg(a.itemId);
      const r = must(await io.call({ method: 'POST', path: `/agency/items/${itemId}/notes`, body: { body: str(a.text), shared: a.shared === true } })) as { id: string };
      return { label: a.shared === true ? 'Added a note the client can see' : 'Added a private note', undo: { method: 'DELETE', path: `/agency/notes/${seg(r.id)}` }, data: { added: true, shared: a.shared === true } };
    },
  },
  {
    name: 'mark_agency_invoice_sent',
    risk: 'write',
    needs: ['agency'],
    refresh: R.agency,
    title: 'Mark an invoice sent',
    description: 'Mark one Agency invoice as sent, so its client link opens and it counts as owed. Look it up with list_agency_invoices first.',
    params: { type: 'object', properties: { invoiceId: id('invoice') }, required: ['invoiceId'] },
    run: async (a, io) => {
      const invoiceId = seg(a.invoiceId);
      const prev = (must(await io.call({ method: 'GET', path: `/agency/invoices/${invoiceId}` })) as { invoice: Invoice }).invoice;
      if (prev.status === 'sent') return { label: `Invoice ${prev.number} was already sent`, data: { number: prev.number, status: 'sent' } };
      if (prev.status !== 'draft') throw new ToolError(`Invoice ${prev.number} is ${prev.status}; only a draft is marked sent.`);
      must(await io.call({ method: 'PATCH', path: `/agency/invoices/${invoiceId}`, body: { status: 'sent' } }));
      return { label: `Marked invoice ${prev.number} sent`, undo: { method: 'PATCH', path: `/agency/invoices/${invoiceId}`, body: { status: 'draft' } }, data: { number: prev.number, status: 'sent' } };
    },
  },
  {
    name: 'mark_agency_invoice_paid',
    risk: 'confirm',
    needs: ['agency'],
    refresh: [...R.agency, ...R.money],
    title: 'Mark an invoice paid',
    description: 'Mark one sent Agency invoice as paid: it is written into Finance as income. Waits for the person to confirm.',
    params: { type: 'object', properties: { invoiceId: id('invoice') }, required: ['invoiceId'] },
    describe: async (a, io) => {
      const inv = (must(await io.call({ method: 'GET', path: `/agency/invoices/${seg(a.invoiceId)}` })) as { invoice: Invoice }).invoice;
      return `Mark invoice ${inv.number} for ${inv.clientName} paid: ${money(inv.totalCents, inv.currency)} goes into Finance as income`;
    },
    run: async (a, io) => {
      const invoiceId = seg(a.invoiceId);
      const prev = (must(await io.call({ method: 'GET', path: `/agency/invoices/${invoiceId}` })) as { invoice: Invoice }).invoice;
      if (prev.status !== 'sent') throw new ToolError(`Invoice ${prev.number} is ${prev.status}; only a sent one is marked paid.`);
      must(await io.call({ method: 'PATCH', path: `/agency/invoices/${invoiceId}`, body: { status: 'paid' } }));
      return { label: `Marked invoice ${prev.number} paid`, undo: { method: 'PATCH', path: `/agency/invoices/${invoiceId}`, body: { status: 'sent' } }, data: { number: prev.number, status: 'paid' } };
    },
  },
];

export const TOOL_BY_NAME: Readonly<Record<string, Tool>> = Object.fromEntries(TOOLS.map((t) => [t.name, t]));
