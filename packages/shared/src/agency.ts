import { byKey, formatCount } from './core.ts';
import type { Page } from './core.ts';
import { addDays, asDay, DATE_PATTERN, daysBetween, fromDay } from './dates.ts';
import { nextOccurrence } from './tasks.ts';
import type { Repeat } from './tasks.ts';
import type { Period, PeriodKind } from './periods.ts';
import { normalizePhone, passwordProblem, phoneProblem, pinCodeProblem } from './account.ts';
import { feeBps, money, typedCents } from './money.ts';
import type { Invoice, INVOICE_STATUSES } from './money.ts';
import type { BusinessProfile, InvoiceParty } from './invoice.ts';
import { MAX_CONTRACT_QUESTIONS } from './contract.ts';
import type { ContractAnswer, ContractQuestion, ContractStatus } from './contract.ts';
import type { AgencyDocKind, AgencyDocStatus } from './agencyPaper.ts';

// ---------------------------------------------------------------------------
// Agency: a content agency's or a freelance creator's clients, pieces, time and approvals
// ---------------------------------------------------------------------------

export const AGENCY_CLIENT_STATUSES = ['lead', 'active', 'paused', 'ended'] as const;
export type AgencyClientStatus = (typeof AGENCY_CLIENT_STATUSES)[number];
export const AGENCY_STATUS_NAME: Record<AgencyClientStatus, string> = { lead: 'Lead', active: 'Active', paused: 'Paused', ended: 'Ended' };
export const AGENCY_HEALTH = ['green', 'amber', 'red'] as const;
export type AgencyHealth = (typeof AGENCY_HEALTH)[number];
export const AGENCY_HEALTH_NAME: Record<AgencyHealth, string> = { green: 'Going well', amber: 'Needs care', red: 'At risk' };

/** What a piece is. */
export const DELIVERABLE_KINDS = ['video', 'short', 'post', 'carousel', 'newsletter', 'blog', 'script', 'thumbnail', 'podcast', 'other'] as const;
export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];
export const DELIVERABLE_KIND_NAME: Record<DeliverableKind, string> = { video: 'Video', short: 'Short', post: 'Post', carousel: 'Carousel', newsletter: 'Newsletter', blog: 'Blog', script: 'Script', thumbnail: 'Thumbnail', podcast: 'Podcast', other: 'Other' };
/** Channels offered as chips; a client can have any others typed in. */
export const AGENCY_CHANNELS = ['YouTube', 'Instagram', 'TikTok', 'LinkedIn', 'X', 'Facebook', 'Podcast', 'Blog', 'Newsletter'] as const;

/** The pipeline every piece moves along, in order. */
export const DELIVERABLE_STAGES = ['idea', 'script', 'making', 'review', 'approved', 'published'] as const;
export type DeliverableStage = (typeof DELIVERABLE_STAGES)[number];
export const DELIVERABLE_STAGE_META: Record<DeliverableStage, { name: string; blurb: string; next: string | null }> = {
  idea: { name: 'Idea', blurb: 'Worth making, not started.', next: 'Start the script' },
  script: { name: 'Script', blurb: 'Being written.', next: 'Start making it' },
  making: { name: 'Making', blurb: 'Shooting, editing or designing.', next: 'Send for review' },
  review: { name: 'In review', blurb: 'Waiting for the client.', next: 'Mark approved' },
  approved: { name: 'Approved', blurb: 'The client said yes.', next: 'Mark published' },
  published: { name: 'Published', blurb: 'Live.', next: null },
};

/** One column of a pipeline board: its stage, how many are in it in all, and the first cards. */
export interface BoardColumn<T> {
  stage: string;
  total: number;
  items: T[];
}
/** The two ways to see any pipeline. */
export const PIPELINE_VIEWS = ['list', 'board'] as const;
export type PipelineView = (typeof PIPELINE_VIEWS)[number];

/** A status tag: its words and which relationship colour it wears (a token, never a hex). */
/** The five status tones, plus three calm colours (`calm` indigo, `warm` orange, `deep` purple) for tags that are facts, not states. */
export type TagTone = 'neutral' | 'info' | 'good' | 'warn' | 'bad' | 'calm' | 'warm' | 'deep';

export const DELIVERABLE_STAGE_TONE: Record<DeliverableStage, TagTone> = { idea: 'neutral', script: 'neutral', making: 'info', review: 'warn', approved: 'good', published: 'good' };
export const CLIENT_STATUS_TONE: Record<AgencyClientStatus, TagTone> = { lead: 'info', active: 'good', paused: 'warn', ended: 'neutral' };
export const CLIENT_HEALTH_TONE: Record<AgencyHealth, TagTone> = { green: 'good', amber: 'warn', red: 'bad' };
export const INVOICE_STATUS_TONE: Record<(typeof INVOICE_STATUSES)[number], TagTone> = { draft: 'neutral', sent: 'info', paid: 'good', void: 'bad' };
export const INVOICE_STATUS_NAME: Record<(typeof INVOICE_STATUSES)[number], string> = { draft: 'Draft', sent: 'Sent', paid: 'Paid', void: 'Void' };

export const AGENCY_MAX_CLIENTS = 60;
export const AGENCY_MAX_ITEMS = 2000;
export const AGENCY_NAME_MAX = 80;
export const AGENCY_NOTES_MAX = 1000;
export const AGENCY_TITLE_MAX = 120;
export const AGENCY_NOTE_MAX = 500;
export const AGENCY_MAX_MINUTES = 24 * 60;
export const AGENCY_DEFAULT_WEEKLY_HOURS = 30;
export const AGENCY_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD'] as const;
/** The currencies a person can keep their money in (Profile, Finance). Rupees first and the default; anyone abroad can switch. */
export const CURRENCIES = AGENCY_CURRENCIES;
export type Currency = (typeof CURRENCIES)[number];
export const isCurrency = (v: unknown): v is Currency => typeof v === 'string' && (CURRENCIES as readonly string[]).includes(v);

export interface AgencySettings {
  currency: string;
  weeklyHours: number;
  profile: BusinessProfile;
}

export interface AgencyClient {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  status: AgencyClientStatus;
  health: AgencyHealth;
  channels: string[];
  retainerCents: number;
  piecesPerMonth: number;
  hoursPerMonth: number;
  renewalDate: string | null;
  notes: string;
  /** An Army campaign this client is served through, by id and name. */
  campaignId: string | null;
  campaignName: string;
  /** What goes under "Billed to" and in contracts. */
  billing: InvoiceParty;
  /** What the client sees at their link. */
  portal: PortalShow;
  /** The client link is /a/<token>; null while it is switched off. */
  portalToken: string | null;
  /** Whether the link asks for a password. */
  portalLocked: boolean;
  /** The team link for the client's own team: its own token, switches and password. Never any paper. */
  teamLink: TeamLinkState;
  /** Where the client is on the way from enquiry to monthly delivery. */
  stage: AgencyStageKey;
  createdAt: string;
  /** Worked out by the server for this month. */
  month: { published: number; inReview: number; open: number; overdue: number; minutes: number; billableMinutes: number };
  /** Plain reasons to look at this client today. */
  flags: string[];
}

export interface AgencyDeliverable {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  kind: DeliverableKind;
  platform: string;
  stage: DeliverableStage;
  dueDate: string | null;
  publishDate: string | null;
  link: string;
  notes: string;
  /** The Army deliverable this answers, and what Army says about it now. */
  armyDeliverableId: string | null;
  army: { status: string; feedback: string } | null;
  /** How many notes are in the thread. */
  noteCount: number;
  feeCents: number;
  /** Changes spent so far, and how many are included for this piece. */
  revisions: number;
  revisionsAllowed: number;
  /** The month of a retainer this piece was made for, when the cycle made it. */
  cycleNumber: number | null;
  /** The trial video. */
  trial: boolean;
  approvedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  overdue: boolean;
}

/** One line in a deliverable's thread. `me` is the person, `client` came through the client link, `brand` came from Army. */
export interface AgencyNote {
  id: string;
  author: 'me' | 'client' | 'brand' | 'team';
  /** For a `team` note: who wrote it (a deleted account reads "A former team member"), and whether it is the reader's own. */
  authorName?: string;
  mine?: boolean;
  /** A `client` note written at the team link, by someone on the client's own team. */
  clientTeam?: boolean;
  /** A plain note, a comment, or a change the client asked for. */
  kind: NoteKind;
  shared: boolean;
  body: string;
  createdAt: string;
}
export const AGENCY_AUTHOR_NAME: Record<AgencyNote['author'], string> = { me: 'You', client: 'Client', brand: 'Brand, from Army', team: 'Team' };

/** A campaign the person can serve through Army, and the deliverables it holds. */
export interface AgencyCampaign {
  id: string;
  name: string;
  brand: string;
  deliverables: { id: string; title: string; platform: string; dueAt: string | null; status: string; linked: boolean }[];
}

export interface AgencyTimeEntry {
  id: string;
  clientId: string;
  clientName: string;
  itemId: string | null;
  itemTitle: string;
  day: string;
  minutes: number;
  billable: boolean;
  note: string;
}

export interface AgencyTotals {
  activeClients: number;
  retainerCents: number;
  open: number;
  inReview: number;
  overdue: number;
  publishedMonth: number;
  plannedMonth: number;
  minutesMonth: number;
  billableMonth: number;
  minutesWeek: number;
  billableWeek: number;
  unpaidCents: number;
}

export interface AgencyOverview {
  settings: AgencySettings;
  totals: AgencyTotals;
  /** Things to do today, in plain words, each with the client it is about. */
  attention: { clientId: string; text: string }[];
  clients: AgencyClient[];
  page: Page;
  /** Pieces due or going live in the next fourteen days, soonest first. */
  coming: AgencyDeliverable[];
}

export interface AgencyInvoiceRow {
  id: string;
  number: string;
  totalCents: number;
  currency: string;
  status: Invoice['status'];
  issueDate: string;
  token: string;
}

export interface AgencyClientPage {
  settings: AgencySettings;
  client: AgencyClient;
  counts: Record<DeliverableStage, number>;
  /** Published this month by channel. */
  byChannel: { channel: string; published: number; open: number }[];
  /** Army campaigns the person is a creator on, to link this client to. */
  campaigns: AgencyCampaign[];
  time: AgencyTimeEntry[];
  invoices: AgencyInvoiceRow[];
  /** The way from enquiry to monthly delivery. */
  lifecycle: ClientLifecycle;
  /** Whether the client is asked to fill in the onboarding form at their link, whether they did and when, and what they told you. */
  onboarding: { needed: boolean; done: boolean; at: string | null; answers: ClientOnboarding | null };
}

/** The parts of a client's dashboard the owner can show at the client link. Each is a switch; the default says what it starts as. */
export const PORTAL_PARTS = [
  { key: 'waiting', name: 'Waiting for approval', blurb: 'What is in review, with the link to watch each one.', on: true },
  { key: 'coming', name: 'Coming up', blurb: 'What is being made and when it goes live. The stage and the day only.', on: true },
  { key: 'published', name: 'Published', blurb: 'What has gone live, with its link.', on: true },
  { key: 'progress', name: 'This month so far', blurb: 'How many are live against the plan.', on: true },
  { key: 'notes', name: 'Notes you share', blurb: 'Only notes you tick as shared, and what they write back.', on: true },
  { key: 'channels', name: 'By channel', blurb: 'What went live and what is open on each channel.', on: false },
  { key: 'hours', name: 'Hours', blurb: 'Hours worked this month against the hours they pay for.', on: false },
  { key: 'invoices', name: 'Invoices', blurb: 'Number, amount and status, with the link to each. Drafts are never shown.', on: false },
  { key: 'contracts', name: 'Agreements', blurb: 'Agreements sent to them, with the link to read and sign.', on: false },
  { key: 'docs', name: 'Other documents', blurb: 'Proposals, trial terms and reports you sent them, with the link to each.', on: true },
] as const;
export type PortalPartKey = (typeof PORTAL_PARTS)[number]['key'];
/** What the person at the link may do, apart from looking. */
export const PORTAL_ACTIONS = [
  { key: 'canApprove', name: 'Approve or ask for changes', blurb: 'They can approve a piece in review, or ask for a change while changes are left on it.', on: true },
  { key: 'canComment', name: 'Write notes', blurb: 'They can leave a note on any deliverable.', on: true },
] as const;
export type PortalActionKey = (typeof PORTAL_ACTIONS)[number]['key'];
export type PortalShow = Record<PortalPartKey | PortalActionKey, boolean>;
/** What is never at the link, whatever is switched on. Said on the screen next to the switches. */
export const PORTAL_NEVER: readonly string[] = ['Your private notes', 'Your fee for each piece, and what you charge a month unless you send a retainer offer', 'Your time, line by line', 'Other clients', 'What the brand wrote in Army', 'Your password for the link'];

export const defaultPortalShow = (): PortalShow => Object.fromEntries([...PORTAL_PARTS, ...PORTAL_ACTIONS].map((p) => [p.key, p.on])) as PortalShow;
/** Reads the saved switches; a switch that was never saved takes its default, anything unclean is dropped. */
export function parsePortalShow(v: unknown): PortalShow {
  const base = defaultPortalShow();
  if (!v || typeof v !== 'object') return base;
  const o = v as Record<string, unknown>;
  for (const k of Object.keys(base) as (keyof PortalShow)[]) if (typeof o[k] === 'boolean') base[k] = o[k] as boolean;
  return base;
}

// ---- the team link: a second link per client, for the client's own team (2026-11-04)

/**
 * The team link (`/t/<token>`) is the client page for the client's own team, a junior who should see the work and none of the paper.
 * It has its own token, password, sessions and switches. Only these parts exist on it; a paper part cannot even be named, so no switch,
 * however it was saved, can put an invoice, agreement, document, the retainer or hours on it.
 */
export const TEAM_LINK_PARTS = [
  { key: 'waiting', name: 'Waiting for approval', blurb: 'What is in review, with the link to watch each one.', on: true },
  { key: 'coming', name: 'Coming up', blurb: 'What is being made and when it goes live.', on: true },
  { key: 'published', name: 'Published', blurb: 'What has gone live, with its link.', on: true },
  { key: 'progress', name: 'This month so far', blurb: 'How many are live against the plan.', on: true },
  { key: 'notes', name: 'Notes you share', blurb: 'Notes you tick as shared, and what their side writes back.', on: true },
  { key: 'channels', name: 'By channel', blurb: 'What went live and what is open on each channel.', on: false },
] as const;
export type TeamLinkPartKey = (typeof TEAM_LINK_PARTS)[number]['key'];
/** What their team may do. Approving starts off: a junior's yes moves a piece, so the owner allows it on purpose. */
export const TEAM_LINK_ACTIONS = [
  { key: 'canComment', name: 'Write notes', blurb: 'They can leave a note on a piece. It is marked as from their team.', on: true },
  { key: 'canApprove', name: 'Approve or ask for changes', blurb: 'Off until you allow it. Each one is recorded as from their team.', on: false },
] as const;
export type TeamLinkActionKey = (typeof TEAM_LINK_ACTIONS)[number]['key'];
export type TeamLinkShow = Record<TeamLinkPartKey | TeamLinkActionKey, boolean>;
/** The client page's parts that are never on a team link, whatever is saved. A shared test checks none of them is a team part. */
export const TEAM_LINK_BLOCKED: readonly PortalPartKey[] = ['hours', 'invoices', 'contracts', 'docs'];
/** What the team link never shows or reaches, whatever is switched on. Said on the owner's screen beside the switches. */
export const TEAM_LINK_NEVER: readonly string[] = [
  'Invoices, and any amount of money',
  'Agreements and the brief',
  'Other documents: strategy notes, trial terms, retainer offers and monthly reports',
  'The retainer offer and its fee',
  'The onboarding form and billing details',
  'The steps to sign or to pay',
  'Hours worked',
  'Your private notes, and notes about a paid change',
  'The client link and its password',
  'Other clients',
];
export const defaultTeamLinkShow = (): TeamLinkShow => Object.fromEntries([...TEAM_LINK_PARTS, ...TEAM_LINK_ACTIONS].map((p) => [p.key, p.on])) as TeamLinkShow;
/** The one reader of a team link's switches: only the team parts and actions, each a real true or false; anything else is dropped. */
export function parseTeamLinkShow(v: unknown): TeamLinkShow {
  const base = defaultTeamLinkShow();
  if (!v || typeof v !== 'object' || Array.isArray(v)) return base;
  const o = v as Record<string, unknown>;
  for (const k of Object.keys(base) as (keyof TeamLinkShow)[]) if (Object.prototype.hasOwnProperty.call(o, k) && typeof o[k] === 'boolean') base[k] = o[k] as boolean;
  return base;
}
/** The owner's view of the team link on a client: the link (null while off), its switches and its password state. */
export interface TeamLinkState {
  token: string | null;
  show: TeamLinkShow;
  password: { set: boolean; setAt: string | null; lastOpenedDay: string | null; request: PasswordRequest | null };
}
/** One line in a piece's thread as a client page shows it. `team` marks a line written from the team link. */
export interface PortalThreadLine {
  author: 'me' | 'client';
  kind: NoteKind;
  body: string;
  createdAt: string;
  team?: boolean;
}
/**
 * What the team link answers: the work and nothing else. It has no field for an invoice, an agreement, a document, the retainer, the
 * stage, onboarding or hours, so none can be sent by mistake.
 */
export interface TeamLinkView {
  teamView: true;
  agencyName: string;
  agencyLogo: string;
  agencyEmail: string;
  clientName: string;
  show: TeamLinkShow;
  waiting: { id: string; title: string; kind: DeliverableKind; platform: string; link: string; publishDate: string | null; changes: { used: number; allowed: number }; thread: PortalThreadLine[] }[];
  coming: { id: string; title: string; kind: DeliverableKind; platform: string; stage: DeliverableStage; publishDate: string | null; changes: { used: number; allowed: number } }[];
  published: { id: string; title: string; kind: DeliverableKind; platform: string; link: string; publishedAt: string | null }[];
  month: { published: number; planned: number } | null;
  channels: { channel: string; published: number; open: number }[];
}

/** What a client sees at their link: only the parts that are switched on, and never fees, private notes or other clients. */
export interface PortalView {
  agencyName: string;
  /** The business's own logo upload, by id ('' when none), served from /api/public/media/:id. */
  agencyLogo: string;
  /** The business email in Agency settings, so the client knows who to write to ('' when not set). */
  agencyEmail: string;
  clientName: string;
  show: PortalShow;
  /** Where they are on the way from first contact to monthly delivery. */
  stage: AgencyStageKey;
  /** The onboarding form: asked for, and sent. While it is asked for and not sent, the parts below are empty and only the form shows. */
  onboarding: { needed: boolean; done: boolean };
  /** What is waiting on the client now. */
  waitingOn: PortalWaitingOn[];
  /** The strategy session, from the strategy stage on. */
  strategy: { day: string | null; link: string } | null;
  /** The trial rules and the day the trial video is due, during the trial. */
  trial: { due: string | null; rules: readonly TrialRule[] } | null;
  /** The pilot month's days, during and after the pilot. */
  pilot: { start: string | null; end: string | null } | null;
  /** The retainer offer, or the running retainer. */
  retainer: PortalRetainer | null;
  waiting: { id: string; title: string; kind: DeliverableKind; platform: string; link: string; publishDate: string | null; changes: { used: number; allowed: number }; thread: PortalThreadLine[] }[];
  coming: { id: string; title: string; kind: DeliverableKind; platform: string; stage: DeliverableStage; publishDate: string | null; changes: { used: number; allowed: number } }[];
  published: { id: string; title: string; kind: DeliverableKind; platform: string; link: string; publishedAt: string | null }[];
  month: { published: number; planned: number } | null;
  channels: { channel: string; published: number; open: number }[];
  hours: { usedMinutes: number; includedMinutes: number } | null;
  invoices: { number: string; totalCents: number; currency: string; status: Invoice['status']; issueDate: string; /** Sent, not paid, and past its due day. The day itself stays on the invoice, behind its own switch. */ overdue: boolean; token: string }[];
  contracts: { title: string; status: ContractStatus; token: string }[];
  /** Other documents sent to them (a proposal, trial terms, a report), when that part is on. Drafts are never shown. */
  docs: { title: string; kind: AgencyDocKind; status: AgencyDocStatus; token: string }[];
}

/** The retainer period for a month: first and last day. */
export function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y ?? 2026, m ?? 1, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, '0')}` };
}

/** Hours and minutes in a short plain form: 90 is "1h 30m". */
export function minutesLabel2(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Billable share of the hours a person set for the weeks in a stretch, as a whole percent. */
export function utilisationPct(billableMinutes: number, weeklyHours: number, days: number): number {
  const capacity = (weeklyHours * 60 * days) / 7;
  return capacity <= 0 ? 0 : Math.round((billableMinutes / capacity) * 100);
}

/** Whether a piece is late: not live, and past its due date or its day to go live. */
export function deliverableOverdue(stage: DeliverableStage, dueDate: string | null, publishDate: string | null, today: string): boolean {
  if (stage === 'published') return false;
  const day = stage === 'approved' ? (publishDate ?? dueDate) : dueDate;
  return Boolean(day && day < today);
}

// ---------------------------------------------------------------------------
// Agency lifecycle: from a brand's enquiry to monthly delivery. The stages, the trial rules, the client link's password, the retainer
// and its monthly cycle. Pure rules; the server and the screens both read them.
// ---------------------------------------------------------------------------

export const AGENCY_STAGE_KEYS = ['enquiry', 'agreement_sent', 'agreement_signed', 'strategy', 'trial', 'pilot', 'retainer_offer', 'retainer', 'delivery'] as const;
export type AgencyStageKey = (typeof AGENCY_STAGE_KEYS)[number];
export interface AgencyStage {
  key: AgencyStageKey;
  name: string;
  /** What this stage is, in one plain line. */
  line: string;
  /** What the client does here, and what the owner does here. */
  clientDoes: string;
  ownerDoes: string;
  /** The owner's checklist for the stage. */
  steps: readonly { key: string; text: string }[];
}
export const AGENCY_STAGES: readonly AgencyStage[] = [
  {
    key: 'enquiry',
    name: 'Enquiry',
    line: 'A brand got in touch and asked what comes next.',
    clientDoes: 'Nothing yet. An agreement is on its way.',
    ownerDoes: 'Add the client and send their link. The agreement is made when they finish onboarding.',
    steps: [
      { key: 'note', text: 'Write down what they asked for, in the client notes.' },
      { key: 'make', text: 'Make a Trial and pilot agreement for them.' },
      { key: 'send', text: 'Send it. The stage moves on by itself.' },
    ],
  },
  {
    key: 'agreement_sent',
    name: 'Agreement sent',
    line: 'The agreement is with the client to read, answer and sign.',
    clientDoes: 'Read the agreement, fill in the brief and sign by typing a name.',
    ownerDoes: 'Wait for the signature. Answer any comment they leave.',
    steps: [
      { key: 'comments', text: 'Answer any comment on the agreement.' },
      { key: 'revise', text: 'If they ask for a change, revise it and send it again.' },
    ],
  },
  {
    key: 'agreement_signed',
    name: 'Agreement signed',
    line: 'Both sides said yes in writing.',
    clientDoes: 'Get ready for the strategy session.',
    ownerDoes: 'Set the day of the strategy session and share the link.',
    steps: [
      { key: 'day', text: 'Pick the day of the strategy session and put it in Dates.' },
      { key: 'link', text: 'Add the call link, so the client sees it.' },
    ],
  },
  {
    key: 'strategy',
    name: 'Strategy session',
    line: 'One call to settle the direction before anything is filmed.',
    clientDoes: 'Join the call. Bring the brand guide and three to five videos that show the feel you want.',
    ownerDoes: 'Hold the call and lock the points below.',
    steps: [
      { key: 'objective', text: 'Lock the main objective and the products featured.' },
      { key: 'audience', text: 'Lock the target audience, the core message and the response wanted.' },
      { key: 'facts', text: 'Write down the brand and product facts, the must-haves and the things to avoid.' },
      { key: 'special', text: 'Note any special needs for the shoot.' },
    ],
  },
  {
    key: 'trial',
    name: 'Trial video',
    line: 'The first video, made under the trial rules.',
    clientDoes: 'Watch the trial video and send one set of feedback.',
    ownerDoes: 'Make the trial video, send it for review and take the feedback.',
    steps: [
      { key: 'due', text: 'Set the day the trial video is due, in Dates.' },
      { key: 'add', text: 'Add the trial video to the pipeline.' },
      { key: 'review', text: 'Send it for review.' },
      { key: 'feedback', text: 'Take the one set of feedback and make the small changes.' },
    ],
  },
  {
    key: 'pilot',
    name: 'Pilot month',
    line: 'A paid first month of real work. The package fee is paid first.',
    clientDoes: 'Pick a package, pay the pilot invoice and review each piece.',
    ownerDoes: 'Send the pilot invoice. Start when it is paid, then make and deliver the batch.',
    steps: [
      { key: 'dates', text: 'Set the start and end day of the pilot, in Dates.' },
      { key: 'invoice', text: 'Send the pilot invoice. Work starts when it is paid.' },
      { key: 'plan', text: 'Lock the plan for each shoot before it starts.' },
      { key: 'deliver', text: 'Deliver the batch and take the review.' },
    ],
  },
  {
    key: 'retainer_offer',
    name: 'Retainer proposed',
    line: 'The client is choosing how many months to stay.',
    clientDoes: 'Choose a length: 3, 6 or 12 months.',
    ownerDoes: 'Wait for the choice, then confirm it.',
    steps: [
      { key: 'offer', text: 'Send the retainer offer with the lengths and any discount.' },
      { key: 'confirm', text: 'When they choose, confirm it and set the start day.' },
    ],
  },
  {
    key: 'retainer',
    name: 'Retainer active',
    line: 'The retainer started. Each month makes its invoice and its pieces by itself.',
    clientDoes: 'Pay each month and review each piece.',
    ownerDoes: 'Check the first month, then keep delivering.',
    steps: [
      { key: 'agreement', text: 'Send the monthly retainer agreement, if you have not.' },
      { key: 'first', text: 'Check the first month\'s invoice and pieces.' },
    ],
  },
  {
    key: 'delivery',
    name: 'Monthly delivery',
    line: 'Pieces and an invoice every month, with changes and comments on each piece.',
    clientDoes: 'Review pieces, ask for changes inside the allowance, pay on time.',
    ownerDoes: 'Make the pieces, answer changes, send the invoice, and offer the renewal before the end.',
    steps: [
      { key: 'pieces', text: 'Move each piece along the pipeline.' },
      { key: 'changes', text: 'Answer change requests inside the allowance.' },
      { key: 'renew', text: 'Offer the renewal before the last month ends.' },
    ],
  },
];
export const AGENCY_STAGE_BY_KEY: Record<AgencyStageKey, AgencyStage> = byKey(AGENCY_STAGES.map((s) => [s.key, s]));

/** A stage key from a column or a request; anything else is the first stage. */
export function parseStage(v: unknown): AgencyStageKey {
  return typeof v === 'string' && (AGENCY_STAGE_KEYS as readonly string[]).includes(v) ? (v as AgencyStageKey) : 'enquiry';
}
export const stageIndex = (k: AgencyStageKey): number => AGENCY_STAGE_KEYS.indexOf(k);
export const nextStage = (k: AgencyStageKey): AgencyStageKey | null => AGENCY_STAGE_KEYS[stageIndex(k) + 1] ?? null;
export const previousStage = (k: AgencyStageKey): AgencyStageKey | null => AGENCY_STAGE_KEYS[stageIndex(k) - 1] ?? null;

/** Where a client stands: the stages behind, the one they are in and the ones to come, and how far along that is in whole percent. */
export function stageProgress(k: AgencyStageKey): { index: number; total: number; percent: number; done: AgencyStageKey[]; current: AgencyStageKey; upcoming: AgencyStageKey[] } {
  const index = stageIndex(k);
  const total = AGENCY_STAGE_KEYS.length;
  return { index, total, percent: Math.round(((index + 1) / total) * 100), done: AGENCY_STAGE_KEYS.slice(0, index), current: k, upcoming: AGENCY_STAGE_KEYS.slice(index + 1) };
}

/** What the owner's move depends on. */
export interface StageFacts {
  /** A retainer offer is open (offered or chosen). */
  offerOpen: boolean;
  /** A retainer is active. */
  retainerActive: boolean;
}
/**
 * Why the owner cannot move a client from one stage to another, or null when they can. The owner moves one step forward at a time;
 * the stages that need a retainer say so.
 */
export function moveProblem(from: AgencyStageKey, to: AgencyStageKey, facts: StageFacts): string | null {
  if (to !== nextStage(from)) return from === to ? 'They are already there.' : 'A client moves one stage at a time.';
  if (to === 'retainer_offer' && !facts.offerOpen) return 'Send the retainer offer first. That moves them on.';
  if ((to === 'retainer' || to === 'delivery') && !facts.retainerActive) return 'Confirm the retainer first. That moves them on.';
  return null;
}
/** The moves the app makes by itself. Each goes forward only and never skips past what happened. */
export type StageEvent = 'agreement_sent' | 'agreement_signed' | 'offer_sent' | 'retainer_active';
export function autoStage(current: AgencyStageKey, event: StageEvent): AgencyStageKey | null {
  const at = stageIndex(current);
  const go = (to: AgencyStageKey) => (stageIndex(to) > at ? to : null);
  if (event === 'agreement_sent') return at === 0 ? go('agreement_sent') : null;
  if (event === 'agreement_signed') return at <= stageIndex('agreement_sent') ? go('agreement_signed') : null;
  if (event === 'offer_sent') return current === 'pilot' ? go('retainer_offer') : null;
  return current === 'pilot' || current === 'retainer_offer' ? go('retainer') : null;
}

/**
 * The rules of the trial video, as the Trial and pilot agreement already states them (`CONTRACT_TEMPLATES`, key `trial`). Each line is
 * quoted from that agreement and a test checks it still is. The agreement is the source: if a person edits their own copy, theirs wins.
 */
export interface TrialRule {
  key: string;
  text: string;
  /** Where in the agreement it comes from. */
  source: string;
}
export const TRIAL_RULES: readonly TrialRule[] = [
  { key: 'evaluation', text: 'Any content produced during the trial is created solely for evaluation and approval purposes.', source: 'Trial agreement, 4.1' },
  { key: 'no-use', text: 'The Client may not publish, distribute, boost, advertise, repurpose, sublicense, or otherwise commercially use trial content unless a paid engagement is subsequently confirmed in writing.', source: 'Trial agreement, 4.1' },
  { key: 'comes-down', text: 'If the engagement does not proceed, all unpublished trial content must remain unused, and any published trial content must be removed upon request.', source: 'Trial agreement, 4.1' },
  { key: 'rights', text: 'Unless otherwise agreed in writing, ownership and/or usage rights for content created during the trial do not transfer to the Client merely by virtue of the trial.', source: 'Trial agreement, 4.2' },
  { key: 'brief', text: 'Please complete this brief before the shoot.', source: 'Trial agreement, 3' },
  { key: 'feedback', text: 'The Client shares feedback through one primary point of contact.', source: 'Trial agreement, 5, Step 2' },
  { key: 'edits', text: 'Minor revisions such as text changes, trims, sequencing adjustments, captions and similar edit-level changes can be incorporated within the agreed process.', source: 'Trial agreement, 8.12' },
  { key: 'no-promise', text: 'Nothing in the trial creates an obligation to proceed to a pilot engagement on either side.', source: 'Trial agreement, 2' },
];

// ---- the days of the lifecycle

export interface LifecycleDates {
  strategyDay: string | null;
  strategyLink: string;
  trialDue: string | null;
  pilotStart: string | null;
  pilotEnd: string | null;
}
export const emptyLifecycleDates = (): LifecycleDates => ({ strategyDay: null, strategyLink: '', trialDue: null, pilotStart: null, pilotEnd: null });
const realLifeDay = (d: unknown): string | null => (typeof d === 'string' && DATE_PATTERN.test(d) && fromDay(asDay(d)) === d ? d : null);
/** The saved days, each a real calendar day or nothing, and the call link only when it is https. */
export function parseLifecycleDates(v: unknown): LifecycleDates {
  let raw = v;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const link = typeof o.strategyLink === 'string' ? o.strategyLink.trim().slice(0, 300) : '';
  return { strategyDay: realLifeDay(o.strategyDay), strategyLink: /^https:\/\/[^\s]+$/.test(link) ? link : '', trialDue: realLifeDay(o.trialDue), pilotStart: realLifeDay(o.pilotStart), pilotEnd: realLifeDay(o.pilotEnd) };
}
/** Why the days will not do, or null. The pilot cannot end before it starts. */
export function lifecycleDatesProblem(d: LifecycleDates): string | null {
  if (d.pilotStart && d.pilotEnd && d.pilotEnd < d.pilotStart) return 'The pilot cannot end before it starts.';
  return null;
}

// ---- the password on a client link

export const PORTAL_PASSWORD_MIN = 10;
/** Why a client-link password will not do, or null. Ten characters or more, then the same rule as every password. */
export function portalPasswordProblem(password: string, clientName = ''): string | null {
  if (password.length < PORTAL_PASSWORD_MIN) return `Use at least ${PORTAL_PASSWORD_MIN} characters.`;
  const base = passwordProblem(password);
  if (base) return base;
  const lower = password.toLowerCase();
  for (const word of clientName.toLowerCase().split(/[^a-z0-9]+/)) if (word.length >= 4 && lower.includes(word)) return 'Not the client\'s name, or a part of it.';
  return null;
}
const PORTAL_WORDS = [
  'amber', 'anchor', 'apple', 'arrow', 'aspen', 'badge', 'basil', 'beach', 'berry', 'birch', 'blaze', 'bloom', 'bridge', 'brook', 'cable', 'candle',
  'canyon', 'cedar', 'chalk', 'cherry', 'cloud', 'clover', 'cobalt', 'comet', 'coral', 'cotton', 'crane', 'crest', 'daisy', 'delta', 'dune', 'eagle',
  'ember', 'fable', 'falcon', 'fern', 'field', 'flint', 'forest', 'frost', 'garden', 'garnet', 'ginger', 'glade', 'glow', 'grove', 'harbor', 'hazel',
  'heron', 'honey', 'island', 'ivory', 'jasper', 'jungle', 'kettle', 'lagoon', 'lantern', 'lemon', 'lilac', 'linen', 'lotus', 'maple', 'marble', 'meadow',
  'mint', 'moss', 'nectar', 'north', 'oasis', 'olive', 'orbit', 'otter', 'paper', 'pearl', 'pebble', 'pine', 'planet', 'plum', 'pond', 'poppy',
  'quartz', 'quill', 'rabbit', 'rain', 'raven', 'reef', 'river', 'robin', 'saffron', 'sage', 'sandal', 'sierra', 'silver', 'slate', 'spring', 'stone',
  'storm', 'summit', 'sunset', 'swan', 'tangle', 'thistle', 'tide', 'timber', 'topaz', 'tulip', 'valley', 'velvet', 'violet', 'willow', 'winter', 'zephyr',
] as const;
/** A readable password: four words and two digits, like "maple-river-cloud-stone-48". `rand(n)` must give a whole number from 0 to n - 1. */
export function makePortalPassword(rand: (n: number) => number): string {
  const word = () => PORTAL_WORDS[rand(PORTAL_WORDS.length)]!;
  return `${word()}-${word()}-${word()}-${word()}-${String(rand(100)).padStart(2, '0')}`;
}

// ---- a client asks for a new password (the owner sets it; the client can only ask)

/** What the owner sees when a client asked for a new password from the lock screen: when, and the optional reason they gave. */
export interface PasswordRequest {
  at: string;
  reason: string;
}
/** The longest reason a client can give for asking. */
export const PASSWORD_REQUEST_REASON_MAX = 200;

// ---- client onboarding: the client fills in their details and the trial brief once, at their link

/** A GSTIN: two digits for the state, the ten-character PAN, an entity digit, Z, a check character. Empty is fine (it is optional). */
export function gstinProblem(raw: string): string | null {
  const v = raw.replace(/\s+/g, '').toUpperCase();
  if (!v) return null;
  return /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v) ? null : 'A GSTIN has 15 characters, like 29ABCDE1234F1Z5.';
}
/** A PAN: five letters, four digits, one letter. Empty is fine (it is optional). */
export function panProblem(raw: string): string | null {
  const v = raw.replace(/\s+/g, '').toUpperCase();
  if (!v) return null;
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(v) ? null : 'A PAN has 10 characters, like ABCDE1234F.';
}

/** Everything the client tells us once: their company, who to talk to, and the trial brief (section 3 of the agreement). */
export interface ClientOnboarding {
  legalName: string;
  /** The brand or brands for this trial. */
  brands: string;
  addressLine: string;
  city: string;
  state: string;
  pin: string;
  gstin: string;
  pan: string;
  pocName: string;
  designation: string;
  email: string;
  phone: string;
  billingEmail: string;
  /** The brief's answers, by the agreement's own question ids (3.1 to 3.5). */
  brief: Record<string, ContractAnswer>;
  /** Three to five links to videos (or a Drive folder) that show the feel they want. */
  references: string[];
}
const ONBOARDING_REFS_MIN = 3;
const ONBOARDING_REFS_MAX = 5;
/**
 * The five short steps of the form. A brief step lists the agreement's question numbers it asks ("3.1"); a question whose number is not
 * listed lands on the last brief step, so a template with more questions still asks every one.
 */
export const ONBOARDING_STEPS = [
  { key: 'company', title: 'Your company', line: 'Who the agreement and invoices are made out to.', brief: [], refs: null },
  { key: 'people', title: 'Who we talk to', line: 'The one person we send work and questions to.', brief: [], refs: null },
  { key: 'goal', title: 'What the videos are for', line: 'Your aim, how much the brand shows, and what people should feel.', brief: ['3.1', '3.2', '3.3'], refs: null },
  { key: 'musts', title: 'Must-haves', line: 'Tick what has to be in every video.', brief: ['3.4'], refs: null },
  { key: 'guide', title: 'Your brand guide', line: 'How your brand looks and sounds, and a few videos you like.', brief: ['3.5', '3.6'], refs: { min: ONBOARDING_REFS_MIN, max: ONBOARDING_REFS_MAX } },
] as const satisfies readonly { key: string; title: string; line: string; brief: readonly string[]; refs: { min: number; max: number } | null }[];

export const emptyOnboarding = (): ClientOnboarding => ({
  legalName: '', brands: '', addressLine: '', city: '', state: '', pin: '', gstin: '', pan: '', pocName: '', designation: '', email: '', phone: '', billingEmail: '', brief: {}, references: [],
});

const obText = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '');
const OB_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** The fields and the most each one keeps. */
const OB_FIELDS: Record<Exclude<keyof ClientOnboarding, 'brief' | 'references'>, number> = {
  legalName: 160, brands: 160, addressLine: 200, city: 60, state: 60, pin: 12, gstin: 30, pan: 20, pocName: 80, designation: 80, email: 120, phone: 20, billingEmail: 120,
};

/** The agreement's own number of a brief question ("3.4"), from its subhead or its words, or '' when it has none. */
const briefNumber = (q: Pick<ContractQuestion, 'label' | 'heading'>): string => /^\s*(\d+\.\d+)/.exec(q.heading ?? '')?.[1] ?? /^\s*(\d+\.\d+)/.exec(q.label)?.[1] ?? '';

/**
 * Which step of the form asks each brief question, in the agreement's order: by its number (3.1 to 3.3 on the third step, 3.4 on the
 * fourth, 3.5 on the fifth); a question with no number of its own (a second part of 3.5) stays on the step of the one before it, and
 * one whose number no step names lands on the last step, so every question is asked once.
 */
export function onboardingBriefSteps(questions: readonly ContractQuestion[]): ContractQuestion[][] {
  const out: ContractQuestion[][] = ONBOARDING_STEPS.map(() => []);
  let at = 2;
  for (const q of questions) {
    const n = briefNumber(q);
    if (n) {
      const i = ONBOARDING_STEPS.findIndex((s) => (s.brief as readonly string[]).includes(n));
      at = i >= 0 ? i : ONBOARDING_STEPS.length - 1;
    }
    out[at]!.push(q);
  }
  return out;
}

/**
 * The one reader for what a client typed or the server kept. Unknown keys are dropped, every text is cut to its length, a GSTIN and a PAN
 * are upper-cased without spaces, a PIN keeps digits only, and links are https or http only, at most five. With the agreement's questions,
 * only answers to those questions and only options they offered are kept; without them an answer keeps its shape only.
 */
export function parseOnboarding(v: unknown, questions?: readonly ContractQuestion[]): ClientOnboarding {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const out = emptyOnboarding();
  for (const [k, max] of Object.entries(OB_FIELDS) as [keyof typeof OB_FIELDS, number][]) out[k] = obText(o[k], max);
  out.gstin = out.gstin.replace(/\s+/g, '').toUpperCase().slice(0, 15);
  out.pan = out.pan.replace(/\s+/g, '').toUpperCase().slice(0, 10);
  out.pin = out.pin.replace(/\D/g, '').slice(0, 6);
  out.references = (Array.isArray(o.references) ? o.references : [])
    .map((x) => obText(x, 500))
    .filter((x) => /^https?:\/\/[^\s]+$/i.test(x))
    .slice(0, ONBOARDING_REFS_MAX);
  const raw = o.brief && typeof o.brief === 'object' ? (o.brief as Record<string, unknown>) : {};
  const brief: Record<string, ContractAnswer> = {};
  const answerOf = (a: unknown, q?: ContractQuestion): ContractAnswer => {
    const x = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
    const picked = (Array.isArray(x.picked) ? x.picked : []).map((p) => obText(p, 200)).filter((p) => p && (!q || q.options.includes(p)));
    const answer: ContractAnswer = { picked: q && !q.multi ? picked.slice(0, 1) : picked.slice(0, 20), other: !q || q.other ? obText(x.other, 200) : '', text: !q || q.text ? obText(x.text, 1500) : '' };
    // A brand guide's lines, by the line's own words; with the questions, only the lines it asks for.
    const given = x.fields && typeof x.fields === 'object' ? (x.fields as Record<string, unknown>) : null;
    if (given && (!q || (q.fields ?? []).length)) {
      const fields: Record<string, string> = {};
      const names = q ? (q.fields ?? []) : Object.keys(given).slice(0, 20);
      for (const f of names) if (Object.prototype.hasOwnProperty.call(given, f) && obText(given[f], 300)) fields[f.slice(0, 120)] = obText(given[f], 300);
      answer.fields = fields;
    }
    if (Array.isArray(x.links) && (!q || q.links)) answer.links = x.links.map((l) => obText(l, 500)).filter((l) => /^https?:\/\/[^\s]+$/i.test(l)).slice(0, q?.links?.max ?? ONBOARDING_REFS_MAX);
    return answer;
  };
  if (questions) {
    for (const q of questions) if (Object.prototype.hasOwnProperty.call(raw, q.id)) brief[q.id] = answerOf(raw[q.id], q);
  } else {
    for (const k of Object.keys(raw).slice(0, MAX_CONTRACT_QUESTIONS * 2)) if (/^[a-zA-Z0-9_-]{1,30}$/.test(k)) brief[k] = answerOf(raw[k]);
  }
  out.brief = brief;
  return out;
}

/** Whether a brief question has an answer: a tick or an Other line, or words where it asks for words. */
const briefAnswered = (q: ContractQuestion, a: ContractAnswer | undefined): boolean => {
  if (!a) return false;
  if (q.links) return (a.links ?? []).filter((l) => /^https?:\/\/[^\s]+$/i.test(l.trim())).length >= q.links.min;
  if ((q.fields ?? []).length) return Object.values(a.fields ?? {}).some((v) => v.trim());
  if (q.text) return Boolean(a.text.trim());
  return a.picked.length > 0 || Boolean(a.other.trim());
};

/**
 * The first thing still missing, with the step it is on and the field to send the person back to, or null when the form can be sent. The
 * GSTIN and PAN are optional but must be real when typed; the billing email may be left empty (the contact's email is used).
 */
export function onboardingProblem(o: ClientOnboarding, questions: readonly ContractQuestion[] = []): { step: number; field: string; message: string } | null {
  const need = (step: number, field: string, ok: boolean, message: string) => (ok ? null : { step, field, message });
  const checks = [
    need(0, 'legalName', Boolean(o.legalName.trim()), 'Type your company\'s legal name.'),
    need(0, 'brands', Boolean(o.brands.trim()), 'Name the brand or brands for this trial.'),
    need(0, 'addressLine', Boolean(o.addressLine.trim()), 'Type the registered address.'),
    need(0, 'city', Boolean(o.city.trim()), 'Type the city.'),
    need(0, 'state', Boolean(o.state.trim()), 'Pick the state.'),
    need(0, 'pin', !pinCodeProblem(o.pin), pinCodeProblem(o.pin) ?? ''),
    need(0, 'gstin', !gstinProblem(o.gstin), gstinProblem(o.gstin) ?? ''),
    need(0, 'pan', !panProblem(o.pan), panProblem(o.pan) ?? ''),
    need(1, 'pocName', Boolean(o.pocName.trim()), 'Type the name of the person we talk to.'),
    need(1, 'designation', Boolean(o.designation.trim()), 'Type their role, like Marketing head.'),
    need(1, 'email', OB_EMAIL.test(o.email.trim()), 'Type an email we can write to.'),
    need(1, 'phone', !phoneProblem(o.phone), phoneProblem(o.phone) ?? ''),
    need(1, 'billingEmail', !o.billingEmail.trim() || OB_EMAIL.test(o.billingEmail.trim()), 'Check the billing email, or leave it empty.'),
  ];
  for (const c of checks) if (c) return c;
  const steps = onboardingBriefSteps(questions);
  for (let i = 0; i < steps.length; i += 1) {
    for (const q of steps[i]!) {
      // The lines of a brand guide count together: one line anywhere in it is enough (the agreement asks for "a simple brand guide").
      if ((q.fields ?? []).length && questions.some((x) => (x.fields ?? []).length && briefAnswered(x, o.brief[x.id]))) continue;
      if (briefAnswered(q, o.brief[q.id])) continue;
      const what = q.links ? `Add at least ${q.links.min} links to videos you like.` : (q.fields ?? []).length ? 'Fill in at least one line of your brand guide.' : `Answer ${briefNumber(q) || 'this question'}.`;
      return { step: i, field: `q-${q.id}`, message: what };
    }
  }
  // A template with no links question of its own still asks for the reference videos, as the agreement does.
  if (!questions.some((q) => q.links) && o.references.length < ONBOARDING_REFS_MIN) return { step: ONBOARDING_STEPS.length - 1, field: 'references', message: `Add at least ${ONBOARDING_REFS_MIN} links to videos you like.` };
  return null;
}

/** What goes under "Billed to" from the form: the brand as the big name, the legal name under it, the tax numbers, the full address. */
export function onboardingToBilling(o: ClientOnboarding, brandName: string): InvoiceParty {
  const taxIds = [o.gstin ? { label: 'GSTIN', value: o.gstin } : null, o.pan ? { label: 'PAN', value: o.pan } : null].filter((x): x is { label: string; value: string } => x !== null);
  const address = [o.addressLine.trim(), o.city.trim(), [o.state.trim(), o.pin.trim()].filter(Boolean).join(' ')].filter(Boolean).join(', ').slice(0, 300);
  return { name: brandName.trim() || o.brands.trim(), line: o.legalName.trim(), taxIds, address, email: (o.billingEmail.trim() || o.email.trim()).slice(0, 120), phone: o.phone.trim() ? normalizePhone(o.phone) : '' };
}

// ---- changes (revisions) on a piece

export const REVISIONS_MAX = 20;
/** The kinds of line in a piece's thread. A change request spends one change; a paid change is only a note to the owner. */
export const NOTE_KINDS = ['note', 'comment', 'change', 'paid_change'] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];
export const NOTE_KIND_NAME: Record<NoteKind, string> = { note: 'Note', comment: 'Comment', change: 'Change asked for', paid_change: 'Paid change asked for' };
export const changesLeft = (used: number, allowed: number): number => Math.max(0, allowed - used);
/** "2 of 3 changes used". */
export const changesLabel = (used: number, allowed: number): string => `${used} of ${allowed} ${allowed === 1 ? 'change' : 'changes'} used`;
/** The stages a piece can be sent back from, and where it goes: back into making. */
export const CHANGE_FROM_STAGES: readonly DeliverableStage[] = ['review', 'approved'];
export const CHANGE_TO_STAGE: DeliverableStage = 'making';

// ---- the retainer

export const RETAINER_MONTHS_MAX = 24;
export const RETAINER_OPTIONS_MAX = 4;
export const RETAINER_PIECES_MAX = 50;
export const RETAINER_DISCOUNT_MAX_BPS = 5000;
export const RETAINER_STATUSES = ['offered', 'chosen', 'active', 'ended', 'withdrawn'] as const;
export type RetainerStatus = (typeof RETAINER_STATUSES)[number];
export const RETAINER_STATUS_NAME: Record<RetainerStatus, string> = { offered: 'Offered', chosen: 'Chosen by the client', active: 'Active', ended: 'Ended', withdrawn: 'Withdrawn' };
export const RETAINER_STATUS_TONE: Record<RetainerStatus, TagTone> = { offered: 'info', chosen: 'warn', active: 'good', ended: 'neutral', withdrawn: 'neutral' };
export interface RetainerOption {
  months: number;
  /** Off the monthly fee, in basis points: 500 is 5 percent. */
  discountBps: number;
}
export const RETAINER_DEFAULT_OPTIONS: readonly RetainerOption[] = [
  { months: 3, discountBps: 0 },
  { months: 6, discountBps: 0 },
  { months: 12, discountBps: 0 },
];
/** The lengths an offer carries: whole months from 1 to 24, no repeats, a discount from 0 to half, at most four, shortest first. */
export function parseRetainerOptions(raw: unknown): RetainerOption[] {
  let v = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  const out: RetainerOption[] = [];
  for (const x of v) {
    const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
    const months = Math.round(Number(o.months));
    const bps = Math.round(Number(o.discountBps ?? 0));
    if (!Number.isInteger(months) || months < 1 || months > RETAINER_MONTHS_MAX || out.some((p) => p.months === months)) continue;
    out.push({ months, discountBps: Number.isFinite(bps) ? Math.min(RETAINER_DISCOUNT_MAX_BPS, Math.max(0, bps)) : 0 });
  }
  return out.sort((a, b) => a.months - b.months).slice(0, RETAINER_OPTIONS_MAX);
}
/** A month's fee after the discount, in whole cents: the discount is rounded to the nearest cent, half up. */
export function retainerMonthlyCents(feeCents: number, discountBps: number): number {
  const bps = Math.min(RETAINER_DISCOUNT_MAX_BPS, Math.max(0, Math.round(discountBps)));
  return feeCents - feeBps(feeCents, bps);
}
/** What the whole retainer comes to over its months. */
export const retainerTotalCents = (feeCents: number, months: number, discountBps: number): number => retainerMonthlyCents(feeCents, discountBps) * months;

export interface RetainerCycle {
  /** 1 for the first month. */
  n: number;
  /** The day the month starts, on the retainer's own day of the month (a short month falls on its last day). */
  day: string;
  /** The last day of the month, the day before the next one starts. */
  end: string;
  /** YYYY-MM of `day`: the key a month is made once under. */
  month: string;
}
/**
 * The months of a retainer that starts on `anchor`: the same repeat rule a task uses (`nextOccurrence`), so a retainer that began on the 31st
 * starts its months on the 31st, the 28th or 29th of February, the 31st again in March. At most `RETAINER_MONTHS_MAX`.
 */
export function retainerCycles(anchor: string, months: number): RetainerCycle[] {
  const count = Math.min(RETAINER_MONTHS_MAX, Math.max(0, Math.floor(months)));
  if (count === 0 || !realLifeDay(anchor)) return [];
  const rule: Repeat = { kind: 'monthly', every: 1, days: [], until: null, anchor };
  const days = [anchor];
  while (days.length <= count) {
    const next = nextOccurrence(rule, anchor, days[days.length - 1]!);
    if (!next) break;
    days.push(next);
  }
  return days.slice(0, count).map((day, i) => ({ n: i + 1, day, month: day.slice(0, 7), end: addDays(days[i + 1] ?? addDays(day, 30), -1) }));
}
/** The months whose day has come on `today` (the owner's own day). A month that was missed is still due, so it is made on the next run, once. */
export const cyclesDue = (anchor: string, months: number, today: string): RetainerCycle[] => retainerCycles(anchor, months).filter((c) => c.day <= today);
/** Due days for `pieces` pieces spread through a month from `start` to `end`: the last one lands on the last day. */
export function cyclePieceDays(start: string, end: string, pieces: number): string[] {
  const len = daysBetween(start, end) + 1;
  if (pieces < 1 || len < 1) return [];
  return Array.from({ length: pieces }, (_, i) => addDays(start, Math.max(0, Math.min(len - 1, Math.floor(((i + 1) * len) / pieces) - 1))));
}
/** The title of the n-th piece of a month: "Month 3, piece 2". */
export const cyclePieceTitle = (month: number, piece: number): string => `Month ${month}, piece ${piece}`;

/** A retainer as the owner sees it. */
export interface AgencyRetainer {
  id: string;
  status: RetainerStatus;
  options: RetainerOption[];
  /** The length the client chose (or that is running). */
  months: number | null;
  /** The monthly fee before any discount, in cents. */
  feeCents: number;
  discountBps: number;
  /** The monthly fee after the discount, once a length is chosen. */
  monthlyCents: number | null;
  totalCents: number | null;
  piecesPerMonth: number;
  revisionsPerPiece: number;
  startDay: string | null;
  endDay: string | null;
  autoSend: boolean;
  /** The next month still to be made, and how many are made. */
  nextCycle: { n: number; day: string } | null;
  cyclesMade: number;
  chosenAt: string | null;
  createdAt: string;
}
export interface LifecycleLogLine {
  id: string;
  actor: 'me' | 'client' | 'auto' | 'team';
  /** For a `team` line: who did it, joined when read, so a deleted account leaves no name behind. */
  actorName?: string;
  kind: string;
  text: string;
  at: string;
}
/** The owner's side of a client's lifecycle: the stage, the days, the checklist, the password state, the retainer and what happened. */
export interface ClientLifecycle {
  stage: AgencyStageKey;
  stageSince: string | null;
  dates: LifecycleDates;
  /** Checklist ticks, "<stage>:<step>" to true. */
  ticks: Record<string, boolean>;
  revisionsPerPiece: number;
  password: { set: boolean; setAt: string | null; lastOpenedDay: string | null; /** An open ask from the client for a new password. */ request: PasswordRequest | null };
  /** The open or running retainer, else the latest one that ended. */
  retainer: AgencyRetainer | null;
  /** What has happened, newest first. */
  log: LifecycleLogLine[];
  /** The trial video piece, once the owner added it. */
  trialItemId: string | null;
}

/** What the lock screen of a client link may say: the client's name and nothing else. */
export interface PortalLock {
  error: 'locked';
  clientName: string;
  /** Who sent the link: the business name and its logo upload ('' when none). */
  agencyName: string;
  agencyLogo: string;
}
/** One thing waiting on the client, with where to do it. */
export interface PortalWaitingOn {
  key: string;
  title: string;
  line: string;
  /** An address on this site to open, when there is one. */
  href: string | null;
}
/** The retainer offer as the client sees it: the lengths with what each comes to. Only while an offer is open or running. */
export interface PortalRetainer {
  status: 'offered' | 'chosen' | 'active';
  currency: string;
  options: { months: number; discountBps: number; monthlyCents: number; totalCents: number }[];
  chosenMonths: number | null;
  piecesPerMonth: number;
  revisionsPerPiece: number;
  startDay: string | null;
}

// ---- Business metrics in Reviews: only for people who switch them on

export const KPI_UNITS = ['number', 'money', 'percent', 'hours'] as const;
export type KpiUnit = (typeof KPI_UNITS)[number];
export const KPI_UNIT_NAME: Record<KpiUnit, string> = { number: 'A count', money: 'Money', percent: 'A percent', hours: 'Hours' };
export const MAX_KPIS = 12;
export const KPI_NAME_MAX = 60;
export const KPI_NOTE_MAX = 200;

/** Numbers read from Agency for a period, so nobody types what the app already knows. */
export const KPI_AUTO = [
  { key: 'published', name: 'Pieces published', unit: 'number', direction: 'up' },
  { key: 'first_pass', name: 'Approved first time', unit: 'percent', direction: 'up' },
  { key: 'on_time', name: 'Published on time', unit: 'percent', direction: 'up' },
  { key: 'hours', name: 'Billable hours', unit: 'hours', direction: 'up' },
  { key: 'utilisation', name: 'Utilisation', unit: 'percent', direction: 'up' },
  { key: 'invoiced', name: 'Invoiced', unit: 'money', direction: 'up' },
  { key: 'paid', name: 'Paid', unit: 'money', direction: 'up' },
  { key: 'new_clients', name: 'New clients', unit: 'number', direction: 'up' },
] as const satisfies readonly { key: string; name: string; unit: KpiUnit; direction: 'up' | 'down' }[];
export type KpiAutoKey = (typeof KPI_AUTO)[number]['key'];
export const KPI_AUTO_BY_KEY: Record<string, (typeof KPI_AUTO)[number]> = byKey(KPI_AUTO.map((a) => [a.key, a]));

export type KpiStatus = 'on' | 'near' | 'off' | 'none';

export interface Kpi {
  id: string;
  name: string;
  unit: KpiUnit;
  direction: 'up' | 'down';
  cadence: PeriodKind;
  target: number;
  /** 'manual' or one of KPI_AUTO. */
  source: string;
  createdAt: string;
}

export interface KpiReading {
  kpi: Kpi;
  value: number | null;
  previous: number | null;
  note: string;
  status: KpiStatus;
  /** The last six periods, oldest first; null where nothing was recorded. */
  series: (number | null)[];
}

export interface KpisResponse {
  enabled: boolean;
  period: Period;
  currency: string;
  readings: KpiReading[];
  /** Metrics set for other cadences, so the screen can say they exist. */
  elsewhere: number;
}

/** How a value stands against its target: on it, within a fifth of it, or off it. */
export function kpiStatus(value: number | null, target: number, direction: 'up' | 'down'): KpiStatus {
  if (value === null || target <= 0) return 'none';
  if (direction === 'up') return value >= target ? 'on' : value >= target * 0.8 ? 'near' : 'off';
  return value <= target ? 'on' : value <= target * 1.2 ? 'near' : 'off';
}

/** A metric's value for the screen. Money is cents, hours are minutes, a percent is a whole number. */
export function kpiShown(unit: KpiUnit, value: number, currency: string): string {
  if (unit === 'money') return money(value, currency);
  if (unit === 'hours') return minutesLabel2(value);
  if (unit === 'percent') return `${value}%`;
  return formatCount(value);
}

/** What a person types for a unit becomes the stored whole number: money to cents, hours to minutes. */
export function kpiFromInput(unit: KpiUnit, typed: number): number {
  if (!Number.isFinite(typed) || typed < 0) return 0;
  if (unit === 'money') return typedCents(typed) || 0;
  if (unit === 'hours') return Math.round(typed * 60);
  return Math.round(typed);
}
/** The reverse, for filling a field. */
export function kpiToInput(unit: KpiUnit, stored: number): number {
  if (unit === 'money') return stored / 100;
  if (unit === 'hours') return Math.round((stored / 60) * 100) / 100;
  return stored;
}
