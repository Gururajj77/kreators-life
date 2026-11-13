import type { AppPrefs, ConsentChoices, DatePrefs, LiveCallAnswer, LiveCallRequest } from '@kreators/shared';
import type { BreakdownRequest, BreakdownResponse, DailyView, HiddenTasksResponse, PlaceDayRequest, PlaceDayResponse, TaskHide, TaskTab, TodayTabResponse } from '@kreators/shared';
import type { AdminDiscountCode, DiscountArea, DiscountCheck } from '@kreators/shared';
import type { ActivityYear, BadgesResponse, Page, Unlock } from '@kreators/shared';
import type { Channel, ChannelLine, ChannelMember, ChannelScope } from '@kreators/shared';
import type { CohortTalkLine, CohortTalkMe, CohortTalkResponse, CohortTalkVisibility } from '@kreators/shared';
import type { GratitudeDay, GratitudeGroup, GratitudeLine } from '@kreators/shared/gratitude';
import type { LifeDashboard } from '@kreators/shared/lifeDashboard';
import type { EatInput, EatLog, FitnessMonth, FitnessResponse, MoveKind, MoveLog, MovesPage, RunMovesResponse, Supplement, SupplementInput, SupplementSettings, SupplementsTodayView, SupplementsView, SupplementTime } from '@kreators/shared/fitness';
import { todayLocal } from './date';
/** A movement log as Fitness and Kreators Run send it. */
export interface MoveBody { date: string; kind: MoveKind; minutes: number; metres: number | null; effort: number | null; note: string }
import { portalSessionHeader, teamLinkSessionHeader } from './portalSession';
import { agencyTeamHeader, markAgencyTeamGone } from './agencyWorkspace';
import type { MyTeam, TeamAccess, TeamMember, TeamRole } from '@kreators/shared';
import type { AgencyStageKey, LifecycleDates, RetainerOption } from '@kreators/shared';
import type { AdminAttendeeCode, AttendeeCodeHost, AttendeeCodeView, PublicEvent } from '@kreators/shared';
import type { AssistantContext, AssistantReceipt, AssistantReply, AssistantStatus, AssistantTurn, CompanionReply, CompanionStatus, CreditEntry, CreditsResponse, FeelingsReadResult, PlanKey } from '@kreators/shared';
import type { Brand, BrandDetail, BrandPiece, BrandSource, PieceKind, ResearchKind, ResearchRun } from '@kreators/shared';
import type { BlockKey, Contract, DayType, Fear, Insecurity, Placement, Practices, RealDay, RoutineBlock, Scores, SessionResponse } from '@kreators/shared';
import type { FeedFilter, FeedSort, SocialAward, TrustScore } from '@kreators/shared';
import type { ListingDetail, MarketResponse, PreownedListing, PreownedMessage, PreownedOffer, StoreItem, StoreKit } from '@kreators/shared';
import type { PeriodKind, Review, ReviewCalendarResponse, ReviewSummary, ReviewTemplate, ReviewTemplatesResponse, ReviewsResponse } from '@kreators/shared';
import type { NotToDo, NotToDoStatus } from '@kreators/shared';
import type { InsightsResponse, LifeAreaKey } from '@kreators/shared';
import type { BlockColor, DayTemplate, KindsMonthResponse, TimeBlock, TimeBlocksResponse } from '@kreators/shared';
import type { SetupMatch } from '@kreators/shared';
import type { CardGamePlay, CardGamesResponse, DiscoverAnswers, DiscoverResult, FocusMode, FocusResponse, FocusRoundRow, FocusTask, FocusView, LogsResponse } from '@kreators/shared';
import type { DailyBrief, GettingStarted, InboxShow, InboxTab, ReactionKind } from '@kreators/shared';
import type { AdminCoachAsk, AdminCoachLink, CoachAskResult, CoachDirectoryEntry, CoachHub, CoachJoinCard, CoachJoinState, CoachLink, CoachLogEntry, CoachLookup, CoachPatternsAnswer, CoachPrefs, CoachProfile, CoachReport, CoachShare, CoachStudentView, CoachTaskInput, MyCoachResponse } from '@kreators/shared';
import type { CustomReminder, RemindersResponse, WaterState, BlockedPerson, EventApp, EventExtras, LinkBlock, MediaItem, MediaOwner } from '@kreators/shared';
import type { ObservabilityResponse } from '@kreators/shared';
import type { AgencyDocFull, AgencyDocKind, AgencyDocListItem, DocLogLine, HouseTemplate, PublicAgencyDoc, RetainerInput } from '@kreators/shared';
import type { ClientPapers } from '@kreators/shared/agencyEmail';
import type { WeekPlan, AgencyTemplate, TemplateKind, AgencyClient, AgencyClientPage, AgencyContract, AgencyDeliverable, AgencyNote, AgencyOverview, AgencySettings, BoardColumn, BusinessProfile, ContractAnswer, ContractDoc, ContractListItem, DeliverableStage, DocComment, DocType, InvoiceDoc, InvoiceParty, Kpi, KpisResponse, Page as AgencyPage, PortalShow, PortalView, TeamLinkShow, TeamLinkView, PublicContract, ClientOnboarding, ContractQuestion } from '@kreators/shared';
import type {
  HomeResponse,
  PublicSettings,
  BondChat,
  BondMessage,
  Friend,
  LadderPicks,
  AdminFunnel,
  AdminKyc,
  AdminOrder,
  AdminRedemption,
  AdminUser,
  AvailabilityOverride,
  CourseDraft,
  KycProfile,
  OrderEvent,
  OutboxEmail,
  PaymentsConfig,
  Socials,
  TrackedEvent,
  WebhookEvent,
  Application,
  AuditLog,
  Availability,
  Booking,
  Bounty,
  BountySubmission,
  Campaign,
  Certificate,
  CircleEvent,
  CircleGroup,
  CircleStatus,
  ContentItem,
  Customer,
  DmAutomation,
  DmRequest,
  DmSend,
  Funnel,
  FunnelStep,
  PayoutSummary,
  Sequence,
  TrackedLink,
  CampaignAssignment,
  CampaignEvent,
  Cohort,
  CohortSession,
  CourseAssignment,
  Deliverable,
  Enrollment,
  EventRegistration,
  FinanceDue,
  FinanceRecurring,
  FinanceSplit,
  FinanceSummary,
  FinanceTransaction,
  Invoice,
  InvoiceItem,
  FlagOverride,
  Introduction,
  LearningItem,
  LifeSummary,
  Listing,
  ListingType,
  Membership,
  ModuleAccess,
  Opportunity,
  Organization,
  OrganizationMember,
  PartyEvent,
  Run,
  RunClub,
  RunClubDetail,
  RunCollab,
  RunCollabsResponse,
  RunEntry,
  RunPace,
  RunResponse,
  RunTalk,
  RunTalkLine,
  Permission,
  PortfolioItem,
  Program,
  ProgramInvite,
  ProgramVisibility,
  Proposal,
  PublicStats,
  Submission,
  SupportTicket,
  Tool,
  CheckinResponse,
  CommunityPost,
  CommunityReply,
  CompleteResponse,
  Coupon,
  JournalEntry,
  Lead,
  LeaderboardBlock,
  LeaderboardOptions,
  LeaderboardResponse,
  LeaderboardScope,
  LeaderboardSort,
  Lesson,
  LogKind,
  MeResponse,
  ModuleSetting,
  Node,
  NodeKind,
  Notification,
  OnboardingAnswer,
  OnboardingResponse,
  Order,
  Product,
  ProductInvite,
  PublicPage,
  Redemption,
  RelationshipKey,
  Resource,
  RewardsResponse,
  Role,
  SearchResults,
  StudioAnalytics,
  Testimonial,
  ExtraKind,
  FocusSettings,
  Priority,
  Repeat,
  Subtask,
  TodayMonthResponse,
  TodayResponse,
  TodayWaitingResponse,
  DoneTasksResponse,
  OpenKind,
  DayTypeKey,
  DayTypeResponse,
  User,
  WellbeingLog,
  WellbeingSummary,
} from '@kreators/shared';
import { useSession } from './store';

export class ApiError extends Error {
  status: number;
  /** The whole answer, for the few calls that say more than an error line (the assistant's paywall). */
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/** Add a page query ("page=2&size=25") to a path that may already carry a query string. */
const withQ = (path: string, q: string) => (q ? `${path}${path.includes('?') ? '&' : '?'}${q}` : path);

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useSession.getState().token;
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Working on someone else's Agency as a team member: the server's gate reads this (lib/agencyWorkspace.ts).
      ...agencyTeamHeader(path),
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 403 && path.startsWith('/agency')) {
    // Removed from the team, or the team ended: back to their own Agency, and the screen says why.
    const why = (await res.clone().json().catch(() => ({}))) as { reason?: string };
    if (why.reason === 'gone') markAgencyTeamGone();
  }
  if (res.status === 401 && !path.startsWith('/auth/')) {
    // A session pushed out by a fourth device says so, so the sign-in screen can explain it.
    const why = (await res.clone().json().catch(() => ({}))) as { reason?: string };
    if (why.reason === 'devices') {
      try {
        localStorage.setItem('kreators.signedOutNote', 'devices');
      } catch {
        // not kept, the sign-in screen just does not explain
      }
    }
    useSession.getState().setToken(null);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? res.statusText, res.status, body);
  }
  return (await res.json()) as T;
}

/** The words of an error for a person to read: the server's own line when there is one, else the fallback (lib/errors.ts). */
export { errorText } from './errors';

/**
 * Fetch a file the server builds for the signed-in person (a CSV) and hand it to the browser as a download.
 * `url` is the full /api address; the session token goes in the header, never in the address.
 */
export async function downloadCsv(url: string, fileName: string): Promise<void> {
  const token = useSession.getState().token;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error('Could not build the file.');
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 2000);
}

/** What a person has agreed to and chosen, from GET /me/legal. */
export interface LegalState {
  legalVersion: string;
  acceptedAt: Record<string, string | null>;
  needsAcceptance: boolean;
  consent: ConsentChoices;
  decided: boolean;
  bannerVersion: number;
}
const post = <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body === undefined ? '{}' : JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

/** One Discover add-on as the server keeps it: the draft so far, how far along, and the latest result. */
export interface ExtraState {
  draft: unknown;
  progress: { done: number; total: number };
  result: unknown | null;
  takenAt: string | null;
}

/** What a task can be planned with. Each field is optional on a change; null clears it. */
export interface TaskPlanBody {
  dueDate?: string | null;
  doDate?: string | null;
  repeat?: Repeat | null;
  priority?: Priority | null;
  remind?: boolean;
  forReview?: boolean;
  /** A repeating task: counted as a habit (the Habit tag) or not; null goes back to the old rule. */
  habit?: boolean | null;
  dueTime?: string | null;
  estimateMin?: number | null;
  /** The area of life it is for (a key), or null to clear it. */
  lifeArea?: LifeAreaKey | null;
  /** The time block it was put in (one of the person's own), or null for "by its time". */
  timeBlockId?: string | null;
  /** Open business: one of the three kinds (Unfinished, Unresolved, Undecided), or null for none. */
  openKind?: OpenKind | null;
}
/** A scheduled review: which one, its first day, the time of the reminder, how it repeats, and an optional name. */
export interface ReviewScheduleBody {
  kind: PeriodKind;
  anchor: string;
  time: string;
  repeat: Repeat | null;
  name: string;
  enabled?: boolean;
}
const put = <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
/** A time block as sent: any field on a change; null clears the area or the pillar. */
export interface TimeBlockBody {
  name?: string;
  tag?: string;
  color?: BlockColor;
  area?: LifeAreaKey | null;
  pillar?: RelationshipKey | null;
}
/** A day template as sent: the slots replace the whole set ("HH:MM" times). */
export interface DayTemplateBody {
  name?: string;
  lead?: RelationshipKey;
  second?: RelationshipKey | null;
  /** Its own colour: a swatch key or a person's own hex; null goes back to its longest block's. */
  color?: BlockColor | null;
  slots?: { blockId: string; start: string; end: string }[];
}
/** What an attendee code change asks for: a new xp (before the event starts), the host's own code, or a fresh random one. */
type CodeChange = { xp?: number; code?: string; fresh?: boolean };

export const api = {
  // accounts
  /** A new device session. While joining is by invite, `invite` is the code (403 reason invite without a working one). */
  anon: (ref?: string | null, invite?: string | null) => post<{ token: string; user: User }>('/auth/anon', { ref, invite: invite || undefined }),
  signup: (body: { email: string; password: string; displayName?: string; phone: string; birthDate: string; acceptTerms: boolean; invite?: string }) => post<{ token: string; user: User }>('/auth/signup', body),
  signin: (body: { email: string; password: string }) => post<{ token: string; user: User }>('/auth/signin', body),
  signout: () => post<{ ok: true }>('/auth/signout'),
  /** Forgot the password: the answer is the same for any email. */
  forgot: (email: string) => post<{ ok: true; minutes: number }>('/auth/forgot', { email }),
  /** The reset link's token plus the new password. Signs every device out and this one in. */
  resetPassword: (token: string, password: string) => post<{ token: string; user: User }>('/auth/reset', { token, password }),
  /** Change the password: the current one, then the new one. Other sessions are signed out. */
  setPassword: (body: { current: string; password: string }) => post<{ ok: true }>('/me/password', body),
  me: () => request<MeResponse>('/me'),
  /** The badge gallery: what you hold with its date, and the count behind every rule. */
  badges: () => request<BadgesResponse>('/me/badges'),
  /** "Your year" on Profile: xp and tasks ticked per day for 53 weeks ending on the device's day. Counts only, owner only. */
  activity: (day: string) => request<ActivityYear>(`/me/activity?day=${day}`),
  updateMe: (body: {
    displayName?: string;
    focus?: string;
    leaderboardOptIn?: boolean;
    handle?: string | null;
    bio?: string;
    reminderTime?: string | null;
    skills?: string[];
    categories?: string[];
    goals?: string[];
    experienceLevel?: string;
    availability?: string;
    location?: string;
    openToIntros?: boolean;
    interests?: string[];
    identities?: string[];
    city?: string;
    area?: string;
    lat?: number | null;
    lng?: number | null;
    timezone?: string;
    /** The currency a person keeps their own money in (migration 0070); checked by isCurrency on the server. */
    currency?: string;
    /** How the app groups start and the order of apps inside each (Profile, Features); the whole set, checked by appPrefsProblem. */
    appPrefs?: AppPrefs;
    /** How dates and times read on their screens (Profile); checked by datePrefsProblem. */
    datePrefs?: Partial<DatePrefs>;
    /** The sections of Daily the person hid with View (Daily's Tasks heading); the whole set, checked by dailyViewProblem. */
    dailyView?: DailyView;
    avatarUrl?: string;
    socials?: Socials;
      publicSettings?: Partial<PublicSettings>;
      links?: LinkBlock[];
  }) => patch<{ user: User; coach?: 'asked' | 'waiting' }>('/me', body),
  exportMe: () => request<Record<string, unknown>>('/me/export'),
  deleteMe: () => request<{ ok: true }>('/me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }),
  trackEvent: (name: TrackedEvent, props?: Record<string, unknown>) => post<{ ok: true }>('/me/events', { name, props }),
  portfolio: () => request<{ items: PortfolioItem[] }>('/me/portfolio'),
  addPortfolio: (body: { title: string; url: string; description?: string; visibility?: 'public' | 'private' }) => post<{ item: PortfolioItem }>('/me/portfolio', body),
  removePortfolio: (id: string) => del<{ ok: true }>(`/me/portfolio/${id}`),
  setModule: (key: string, on: boolean) => patch<{ modules: Record<string, boolean> }>('/me/modules', { key, on }),
  /** Several apps in one write (Select on Apps): the server takes the whole list or none of it. */
  setModules: (changes: { key: string; on: boolean }[]) => patch<{ modules: Record<string, boolean> }>('/me/modules', { changes }),
  reset: () => post<{ ok: true }>('/me/reset'),
  linkClicks: () => request<{ clicks: Record<string, number> }>('/me/link-clicks'),
  // the assistant: typing (with a plan), and Confirm, Cancel and Undo on what it did
  assistantStatus: () => request<AssistantStatus>('/assistant'),
  assistantSend: (body: { messages: AssistantTurn[]; context: AssistantContext; model?: string; runId?: string }) => post<AssistantReply>('/assistant', body),
  /** Stop a message that is still running: it ends before its next model call or tool, keeping what was already done. */
  assistantStop: (runId: string) => post<{ ok: true }>('/assistant/stop', { runId }),
  /** "Read with AI" on the strategy session's map card: a plan and a model that keeps nothing; the words are never kept. */
  readFeelingsAi: (body: { text: string; relationship?: string; model?: string }) => post<FeelingsReadResult>('/assistant/feelings', body),
  assistantConfirm: (id: string, date: string) => post<{ receipt: AssistantReceipt }>(`/assistant/actions/${id}/confirm`, { date }),
  assistantCancel: (id: string) => post<{ receipt: AssistantReceipt }>(`/assistant/actions/${id}/cancel`),
  assistantUndo: (id: string, date: string) => post<{ receipt: AssistantReceipt }>(`/assistant/actions/${id}/undo`, { date }),
  // plans and credits
  credits: () => request<CreditsResponse>('/credits'),
  creditLedger: (pq = '') => request<{ page: Page; entries: CreditEntry[] }>(withQ('/credits/ledger', pq)),
  creditCheckout: (kind: 'plan' | 'topup', key: string, discountCode?: string) => post<{ ok: true }>('/credits/checkout', { kind, key, discountCode: discountCode || undefined }),
  /** Does a team discount code work on this, and what does it come to? The server prices it; nothing is used up. */
  discountCheck: (code: string, area: DiscountArea, itemId: string, points?: number) => post<DiscountCheck>('/discounts/check', { code, area, itemId, points }),
  // internal, team only
  observability: (q: string, pq = '') => request<ObservabilityResponse>(withQ(`/internal/observability?q=${encodeURIComponent(q)}`, pq)),
  setRole: (id: string, role: Role) => post<{ user: { id: string; name: string; handle: string | null; role: Role } }>(`/internal/users/${id}/role`, { role }),

  // onboarding and the tower
  /** The setup chat: tags, goals, what gets in the way, and the apps the person kept. */
  setup: (body: { identities: string[]; goals: string[]; blockers: string[]; apps: string[] }) => post<{ user: User; match: SetupMatch; on: string[]; coach: 'coach' | 'asked' | 'waiting' | null }>('/onboarding/setup', body),
  onboard: (body: { answers: OnboardingAnswer[]; displayName?: string; focus?: string }) => post<OnboardingResponse>('/onboarding', body),
  build: (relationships: RelationshipKey[], date: string, picks?: LadderPicks) => post<{ nodes: Node[]; skipped: RelationshipKey[] }>('/onboarding/build', { relationships, date, picks }),
  acceptQuest: (relationship: RelationshipKey, date: string, picks?: LadderPicks) => post<{ nodes: Node[] }>('/onboarding/accept-quest', { relationship, date, picks }),
  nodes: (relationship?: RelationshipKey) => request<{ nodes: Node[] }>(`/nodes${relationship ? `?relationship=${relationship}` : ''}`),
  /** The person's projects, in one pillar or all (a content day's Add to my tasks picks one): only the projects, never every task. */
  projects: (relationship?: RelationshipKey | null) => request<{ nodes: Node[] }>(`/nodes?kind=project${relationship ? `&relationship=${relationship}` : ''}`),
  /** A pillar's done tasks, a page at a time (`pq` is `pageQuery(page, size, 'dn')`). */
  nodesDone: (relationship: RelationshipKey, pq: string) => request<DoneTasksResponse>(`/nodes/done?relationship=${relationship}&${pq}`),
  createNode: (body: { kind: NodeKind; parentId: string | null; relationship: RelationshipKey; title: string; note?: string } & TaskPlanBody) => post<{ node: Node }>('/nodes', body),
  updateNode: (id: string, body: { title?: string; note?: string; status?: 'active' | 'archived'; parentId?: string } & TaskPlanBody) => patch<{ node: Node }>(`/nodes/${id}`, body),
  subtasks: (id: string) => request<{ subtasks: Subtask[] }>(`/nodes/${id}/subtasks`),
  addSubtask: (id: string, title: string) => post<{ subtask: Subtask }>(`/nodes/${id}/subtasks`, { title }),
  editSubtask: (sid: string, body: { title?: string; done?: boolean }) => patch<{ subtask: Subtask }>(`/nodes/subtasks/${sid}`, body),
  deleteSubtask: (sid: string) => del<{ ok: boolean }>(`/nodes/subtasks/${sid}`),
  deleteNode: (id: string) => del<{ ok: true }>(`/nodes/${id}`),
  complete: (id: string, date?: string) => post<CompleteResponse>(`/nodes/${id}/complete`, date ? { date } : undefined),
  uncomplete: (id: string) => post<{ node: Node }>(`/nodes/${id}/uncomplete`),

  // daily
  /** Daily. `area` (a `LIFE_AREAS` key or 'none') has the server cut the six, the backlog and its count to that area. */
  // `group` reads up to DAILY_GROUPED_MAX tasks for Daily's coloured boxes. (The server's `block` cut is left to other callers; Daily has no Block filter.)
  // `open` ('any' or one of the three kinds, Daily's Unfinished business view) cuts them to open business.
  // `tab` ('today', Daily's tabs, 2026-11-12) cuts the six and their count to the tasks whose day is today; left out, the old cut (today and before).
  // `tags` (2026-11-13) is the tags a person tapped, `taskTagsKey` in shared, cut on the server like the area; every list below takes it too.
  today: (date: string, area = '', opts: { group?: boolean; sort?: string; open?: string; tab?: TaskTab; tags?: string } = {}) =>
    request<TodayResponse>(`/today?date=${date}${area ? `&area=${encodeURIComponent(area)}` : ''}${opts.tags ? `&tags=${encodeURIComponent(opts.tags)}` : ''}${opts.group ? '&group=1' : ''}${opts.sort ? `&sort=${encodeURIComponent(opts.sort)}` : ''}${opts.open ? `&open=${encodeURIComponent(opts.open)}` : ''}${opts.tab ? `&tab=${opts.tab}` : ''}`),
  /** The open tasks past the ones `today` shows, in the same order (`pq` is `pageQuery(page, size, 'w')`); `tab` as on `today`. */
  todayWaiting: (date: string, area = '', group = false, pq = '', sort = '', open = '', tab: TaskTab | '' = '', tags = '') =>
    request<TodayWaitingResponse>(`/today/waiting?date=${date}${area ? `&area=${encodeURIComponent(area)}` : ''}${tags ? `&tags=${encodeURIComponent(tags)}` : ''}${group ? '&group=1' : ''}${sort ? `&sort=${encodeURIComponent(sort)}` : ''}${open ? `&open=${encodeURIComponent(open)}` : ''}${tab ? `&tab=${tab}` : ''}${pq ? `&${pq}` : ''}`),
  /** Daily's Past due tab, ten a page (`pq` is `pageQuery(page, size, 'pd')`); `sort` day (oldest first), priority or due (`taskTabSort`). */
  todayPastDue: (date: string, pq = '', area = '', sort = '', tags = '') =>
    request<TodayTabResponse>(`/today/past-due?date=${date}${area ? `&area=${encodeURIComponent(area)}` : ''}${tags ? `&tags=${encodeURIComponent(tags)}` : ''}${sort ? `&sort=${encodeURIComponent(sort)}` : ''}${pq ? `&${pq}` : ''}`),
  /** Daily's Upcoming tab, soonest first, ten a page (`pq` is `pageQuery(page, size, 'uc')`). */
  todayUpcoming: (date: string, pq = '', area = '', tags = '') =>
    request<TodayTabResponse>(`/today/upcoming?date=${date}${area ? `&area=${encodeURIComponent(area)}` : ''}${tags ? `&tags=${encodeURIComponent(tags)}` : ''}${pq ? `&${pq}` : ''}`),
  /** Place my day: saves the start `autoPlace` gave each task as its time, in one request; nothing else on a task changes. */
  placeDay: (body: PlaceDayRequest) => post<PlaceDayResponse>('/nodes/place', body),
  /** Content days' Add to my tasks: one task in the block with the list's steps as its subtasks, under the project picked. */
  breakdown: (body: BreakdownRequest) => post<BreakdownResponse>('/nodes/breakdown', body),
  /** Done today past the first page `today` carries (`pq` is `pageQuery(page, size, 'd')`). */
  todayDone: (date: string, pq: string, area = '', open = '', tags = '') =>
    request<DoneTasksResponse>(`/today/done?date=${date}${area ? `&area=${encodeURIComponent(area)}` : ''}${tags ? `&tags=${encodeURIComponent(tags)}` : ''}${open ? `&open=${encodeURIComponent(open)}` : ''}&${pq}`),
  /**
   * Hidden tasks (2026-11-12): hide a task until tomorrow or until it is unhidden, or show it again (null), through the ordinary edit.
   * `today` is the device's day, so Until tomorrow is back on the person's next day.
   */
  hideTask: (id: string, hide: TaskHide | null, today: string) => patch<{ node: Node }>(`/nodes/${id}`, { hide, today }),
  /** The tasks hidden on the day, Until tomorrow first, a page at a time (`pq` is `pageQuery(page, size, 'hd')`), whole (no Area cut). */
  todayHidden: (date: string, pq = '') => request<HiddenTasksResponse>(`/today/hidden?date=${date}${pq ? `&${pq}` : ''}`),
  /** The tasks let go (archived), a page at a time (`pq` is `pageQuery(page, size, 'lg')`), for the Unfinished business view's Let go list. */
  letGo: (pq = '') => request<DoneTasksResponse>(`/today/let-go${pq ? `?${pq}` : ''}`),
  /** Emerging: patterns from the person's own rows. `app` asks for the cards one place shows; `rel` for a pillar page. */
  /** Emerging: the person's whole list for their day; each place picks its share on the device (`insightsForPlace`). */
  insights: (day: string, period?: { kind: string; start: string } | null) => request<InsightsResponse>(`/insights?day=${day}${period ? `&kind=${period.kind}&start=${period.start}` : ''}`),
  /** One period's numbers for "Your life, this week"; with none, the last eight weeks beside the eight before. */
  insightsDashboard: (day: string, period?: { kind: string; start: string } | null) => request<LifeDashboard>(`/insights/dashboard?day=${day}${period ? `&kind=${period.kind}&start=${period.start}` : ''}`),
  todayMonth: (month: string, day: string) => request<TodayMonthResponse>(`/today/month?month=${month}&day=${day}`),
  home: (date: string, hour: number) => request<HomeResponse>(`/home?date=${date}&hour=${hour}`),
  checkin: (date: string) => post<CheckinResponse>('/today/checkin', { date }),
  notToDoAdd: (title: string, relationship: RelationshipKey | null) => post<{ item: NotToDo }>('/today/not-to-do', { title, relationship }),
  notToDoDay: (id: string, date: string, today: string, status: NotToDoStatus | null) => post<{ item: NotToDo; awarded: number }>(`/today/not-to-do/${id}/day`, { date, today, status }),
  notToDoRemove: (id: string) => del<{ ok: true }>(`/today/not-to-do/${id}`),
  dayType: (date: string, today: string) => request<DayTypeResponse>(`/today/day-type?date=${date}&today=${today}`),
  setDayType: (date: string, today: string, kind: DayTypeKey | null) => put<DayTypeResponse>('/today/day-type', { date, today, kind }),
  // Time blocks, day templates and the weekly pattern (docs/time-blocks.md; core, owner only, writes under `prefs`).
  timeBlocks: (week: string) => request<TimeBlocksResponse>(`/time-blocks?week=${week}`),
  // Kinds of day this month so far (the 1st to the device's day), for the Time blocks page's This month line.
  timeBlocksMonth: (day: string) => request<KindsMonthResponse>(`/time-blocks/month?day=${day}`),
  createTimeBlock: (body: TimeBlockBody & { name: string; color: BlockColor }) => post<{ block: TimeBlock }>('/time-blocks/blocks', body),
  updateTimeBlock: (id: string, body: TimeBlockBody) => patch<{ block: TimeBlock }>(`/time-blocks/blocks/${encodeURIComponent(id)}`, body),
  deleteTimeBlock: (id: string) => del<{ ok: true; tasksCleared: number; templatesTouched: number }>(`/time-blocks/blocks/${encodeURIComponent(id)}`),
  orderTimeBlocks: (ids: string[]) => put<{ ok: true }>('/time-blocks/blocks/order', { ids }),
  createDayTemplate: (body: DayTemplateBody & { name: string; fromId?: string }) => post<{ template: DayTemplate }>('/time-blocks/templates', body),
  updateDayTemplate: (id: string, body: DayTemplateBody & { isDefault?: true }) => patch<{ template: DayTemplate }>(`/time-blocks/templates/${encodeURIComponent(id)}`, body),
  deleteDayTemplate: (id: string) => del<{ ok: true; daysCleared: number; weekdaysReset: number }>(`/time-blocks/templates/${encodeURIComponent(id)}`),
  setWeekPattern: (weekdays: number[], templateId: string | null) => put<{ pattern: (string | null)[]; previous: { weekday: number; templateId: string | null }[] }>('/time-blocks/pattern', { weekdays, templateId }),
  setDayTemplates: (dates: string[], templateId: string | null) => put<{ days: { date: string; templateId: string | null; previous: string | null }[] }>('/time-blocks/days', { dates, templateId }),
  restoreTimeBlocks: () => post<{ added: { blocks: number; templates: number; leftOut?: { blocks: string[]; templates: string[] } } }>('/time-blocks/restore'),
  reviews: (kind: PeriodKind, date: string) => request<ReviewsResponse>(`/reviews?kind=${kind}&date=${date}`),
  reviewSummary: (kind: PeriodKind, date: string) => request<ReviewSummary>(`/reviews/summary?kind=${kind}&date=${date}`),
  // The device's day rides along, so a daily review for the person's own today is never refused as "not started" (2026-11-07).
  saveReview: (body: { kind: PeriodKind; date: string; templateId: string | null; answers: string[]; rating: number | null; highlight: string }) => request<{ review: Review }>(`/reviews?day=${todayLocal()}`, { method: 'PUT', body: JSON.stringify(body) }),
  reviewTemplatesAll: () => request<ReviewTemplatesResponse>('/reviews/templates'),
  deleteReview: (id: string) => del<{ ok: true }>(`/reviews/${id}`),
  reviewTemplateAdd: (body: { kind: PeriodKind; name: string; prompts: string[] }) => post<{ template: ReviewTemplate }>('/reviews/templates', body),
  reviewTemplateUpdate: (id: string, body: { name: string; prompts: string[] }) => patch<{ template: ReviewTemplate }>(`/reviews/templates/${id}`, body),
  reviewTemplateRemove: (id: string) => del<{ ok: true }>(`/reviews/templates/${id}`),
  reviewSchedule: (month: string) => request<ReviewCalendarResponse>(`/reviews/schedule?month=${month}&day=${todayLocal()}`),
  reviewScheduleAdd: (body: ReviewScheduleBody) => post<{ id: string }>(`/reviews/schedule?day=${todayLocal()}`, body),
  reviewScheduleUpdate: (id: string, body: Partial<ReviewScheduleBody>) => patch<{ ok: true }>(`/reviews/schedule/${id}?day=${todayLocal()}`, body),
  reviewScheduleRemove: (id: string) => del<{ ok: true }>(`/reviews/schedule/${id}`),

  // agency: clients, deliverables, time, invoices, agreements. The day always comes from the device.
  agency: (q = '') => request<AgencyOverview>(withQ(`/agency?day=${todayLocal()}`, q)),
  agencySettings: (body: Partial<{ currency: string; weeklyHours: number; profile: BusinessProfile }>) => put<{ settings: AgencySettings }>('/agency/settings', body),
  agencyClient: (id: string) => request<AgencyClientPage>(`/agency/clients/${id}?day=${todayLocal()}`),
  agencyClientAdd: (body: Partial<AgencyClient> & { portalPassword: string }) => post<{ id: string; portalToken: string; password?: string }>('/agency/clients', body),
  agencyClientUpdate: (id: string, body: Partial<AgencyClient> & { campaignId?: string | null; onboarding?: ClientOnboarding }) => patch<{ ok: true }>(`/agency/clients/${id}`, body),
  agencyClientRemove: (id: string) => del<{ ok: true }>(`/agency/clients/${id}`),
  agencyPortal: (id: string, body: { on?: boolean; fresh?: boolean; show?: Partial<PortalShow> }) => post<{ portalToken: string | null; portal: PortalShow }>(`/agency/clients/${id}/portal`, body),
  agencyArmyImport: (id: string) => post<{ added: number }>(`/agency/clients/${id}/army-import`),
  // lifecycle: the stage, the days, the checklist, the password on the client link, the trial video, the retainer and the changes on a piece
  agencyStageMove: (id: string, to: AgencyStageKey, undo = false) => post<{ stage: AgencyStageKey }>(`/agency/clients/${id}/stage`, { to, undo }),
  agencyLifecycleSave: (id: string, body: Partial<LifecycleDates> & { revisionsPerPiece?: number }) => put<{ dates: LifecycleDates; revisionsPerPiece: number }>(`/agency/clients/${id}/lifecycle`, body),
  agencyChecklist: (id: string, key: string, done: boolean) => post<{ ticks: Record<string, boolean> }>(`/agency/clients/${id}/checklist`, { key, done }),
  agencyPassword: (id: string, body: { password?: string; generate?: boolean; clear?: boolean }) => put<{ set: boolean; password?: string }>(`/agency/clients/${id}/password`, body),
  agencyPasswordRequestClose: (id: string) => post<{ ok: true; closed: boolean }>(`/agency/clients/${id}/password-request/close`, {}),
  /** The team link for the client's own team: on, off, fresh, and what it shows. Never the client link's own. */
  agencyTeamLink: (id: string, body: { on?: boolean; fresh?: boolean; password?: string; show?: Partial<TeamLinkShow> }) => post<{ token: string | null; show: TeamLinkShow }>(`/agency/clients/${id}/team-link`, body),
  agencyTeamLinkPassword: (id: string, body: { password?: string; generate?: boolean; clear?: boolean }) => put<{ set: boolean; password?: string }>(`/agency/clients/${id}/team-link/password`, body),
  agencyTeamLinkRequestClose: (id: string) => post<{ ok: true; closed: boolean }>(`/agency/clients/${id}/team-link/password-request/close`, {}),
  agencyTrialVideo: (id: string) => post<{ id: string }>(`/agency/clients/${id}/trial-video`),
  agencyRetainerOffer: (id: string, body: { options: RetainerOption[]; feeCents?: number; piecesPerMonth?: number; revisionsPerPiece?: number; autoSend?: boolean }) => post<{ id: string }>(`/agency/clients/${id}/retainer`, body),
  agencyRetainerConfirm: (retainerId: string, body: { startDay?: string; autoSend?: boolean }) => post<{ ok: true; made: number }>(`/agency/retainers/${retainerId}/confirm?day=${todayLocal()}`, body),
  agencyRetainerAutoSend: (retainerId: string, on: boolean) => post<{ ok: true; on: boolean }>(`/agency/retainers/${retainerId}/auto-send`, { on }),
  agencyRetainerEnd: (retainerId: string) => post<{ ok: true }>(`/agency/retainers/${retainerId}/end`),
  agencyRetainerWithdraw: (retainerId: string) => post<{ ok: true }>(`/agency/retainers/${retainerId}/withdraw`),
  agencyItemChanges: (id: string, add: number) => post<{ allowed: number }>(`/agency/items/${id}/changes`, { add }),
  agencyItems: (q = '') => request<{ page: AgencyPage; items: AgencyDeliverable[]; counts: Record<DeliverableStage, number>; late?: number }>(withQ(`/agency/items?day=${todayLocal()}`, q)),
  agencyBoard: (q = '') => request<{ columns: BoardColumn<AgencyDeliverable>[] }>(withQ(`/agency/board?day=${todayLocal()}`, q)),
  agencyItemAdd: (body: Partial<AgencyDeliverable> & { clientId: string }) => post<{ id: string }>(`/agency/items?day=${todayLocal()}`, body),
  agencyItemUpdate: (id: string, body: Partial<AgencyDeliverable>) => patch<{ ok: true }>(`/agency/items/${id}?day=${todayLocal()}`, body),
  agencyItemRemove: (id: string) => del<{ ok: true }>(`/agency/items/${id}`),
  agencyNotes: (id: string) => request<{ notes: AgencyNote[] }>(`/agency/items/${id}/notes`),
  /** `team`: the owner shares the note with their team (never the client). A member's notes are team notes whatever is sent. */
  agencyNoteAdd: (id: string, body: string, shared: boolean, team = false) => post<{ id: string }>(`/agency/items/${id}/notes`, team ? { body, team: true } : { body, shared }),
  agencyNoteRemove: (id: string) => del<{ ok: true }>(`/agency/notes/${id}`),
  agencyArmySend: (id: string, body: { url?: string; note?: string } = {}) => post<{ ok: true }>(`/agency/items/${id}/army/send?day=${todayLocal()}`, body),
  agencyArmySync: (id: string) => post<{ moved: DeliverableStage | null }>(`/agency/items/${id}/army/sync?day=${todayLocal()}`),
  agencyTimeAdd: (body: { clientId: string; itemId?: string | null; day: string; minutes: number; billable: boolean; note?: string }) => post<{ id: string }>('/agency/time', body),
  agencyTimeRemove: (id: string) => del<{ ok: true }>(`/agency/time/${id}`),
  agencyTemplates: (kind?: TemplateKind) => request<{ templates: AgencyTemplate[] }>(`/agency/templates${kind ? `?kind=${kind}` : ''}`),
  /** A template of the person's own. For an email note (kind 'email', P231) `subject` and `message` carry the words; the route is agency-docs'. */
  agencyTemplateAdd: (body: { kind: TemplateKind; name: string; fromId?: string; houseId?: string; subject?: string; message?: string }) => post<{ id: string }>('/agency/templates', body),
  agencyTemplateUpdate: (id: string, body: { name?: string; fromId?: string; subject?: string; message?: string }) => patch<{ ok: true }>(`/agency/templates/${id}`, body),
  agencyTemplateRemove: (id: string) => del<{ ok: true }>(`/agency/templates/${id}`),
  agencyInvoices: (q = '') => request<{ page: AgencyPage; invoices: Invoice[]; counts: { status: string; n: number; cents: number }[] }>(withQ('/agency/invoices', q)),
  agencyInvoiceBoard: (q = '') => request<{ columns: (BoardColumn<Invoice> & { cents: number })[] }>(withQ('/agency/invoices/board', q)),
  agencyInvoice: (id: string) => request<{ invoice: Invoice }>(`/agency/invoices/${id}`),
  agencyInvoiceAdd: (body: { clientId: string; templateId?: string; houseId?: string; starter?: string; items?: InvoiceItem[]; doc?: Partial<InvoiceDoc>; dueDate?: string | null; issueDate?: string | null; note?: string }) => post<{ invoice: Invoice }>(`/agency/invoices?day=${todayLocal()}`, body),
  agencyInvoiceFromClient: (clientId: string, month?: string) => post<{ invoice: Invoice }>(`/agency/clients/${clientId}/invoice?day=${todayLocal()}`, month ? { month } : {}),
  agencyInvoiceUpdate: (id: string, body: { items?: InvoiceItem[]; doc?: Partial<InvoiceDoc> & { from?: InvoiceParty; to?: InvoiceParty }; dueDate?: string | null; issueDate?: string | null; note?: string; number?: string; status?: Invoice['status'] }) => patch<{ invoice: Invoice }>(`/agency/invoices/${id}`, body),
  agencyInvoiceDuplicate: (id: string, body: { issueDate?: string; dueDate?: string | null; number?: string; bumpMonths?: boolean } = {}) => post<{ invoice: Invoice }>(`/agency/invoices/${id}/duplicate?day=${todayLocal()}`, body),
  agencyInvoiceRemove: (id: string) => del<{ ok: true }>(`/agency/invoices/${id}`),
  agencyInvoiceRestore: (id: string) => post<{ invoice: Invoice; restoredTo: Invoice['status'] }>(`/agency/invoices/${id}/restore`),
  agencyContracts: (q = '') => request<{ page: AgencyPage; contracts: ContractListItem[]; counts: { status: string; n: number }[] }>(withQ('/agency/contracts', q)),
  agencyContractBoard: (q = '') => request<{ columns: BoardColumn<ContractListItem>[] }>(withQ('/agency/contracts/board', q)),
  agencyContract: (id: string) => request<{ contract: AgencyContract }>(`/agency/contracts/${id}`),
  agencyContractAdd: (body: { templateKey?: string; templateId?: string; houseId?: string; clientId?: string | null }) => post<{ id: string }>('/agency/contracts', body),
  agencyContractUpdate: (id: string, body: { doc?: ContractDoc; clientId?: string | null; status?: 'draft' | 'sent' | 'void'; ifUpdatedAt?: string }) => patch<{ contract: AgencyContract }>(`/agency/contracts/${id}`, body),
  agencyContractDuplicate: (id: string) => post<{ id: string }>(`/agency/contracts/${id}/duplicate`),
  agencyContractRemove: (id: string) => del<{ ok: true }>(`/agency/contracts/${id}`),
  /** One section on or off the printed page, in any status; nothing else changes. */
  agencyContractPrint: (id: string, sectionId: string, print: boolean) => post<{ contract: AgencyContract }>(`/agency/contracts/${id}/print`, { sectionId, print }),
  agencyContractRestore: (id: string) => post<{ contract: AgencyContract; restoredTo: AgencyContract['status'] }>(`/agency/contracts/${id}/restore`),
  agencyComments: (type: DocType, id: string) => request<{ comments: DocComment[] }>(`/agency/comments/${type}/${id}`),
  agencyCommentAdd: (type: DocType, id: string, body: string) => post<{ ok: true }>(`/agency/comments/${type}/${id}`, { body }),
  agencyCommentRemove: (id: string) => del<{ ok: true }>(`/agency/comments/${id}`),
  agencyEmailCopy: (type: 'invoices' | 'contracts' | 'docs', id: string, body: { to?: string; message?: string; subject?: string } = {}) => post<EmailCopyResult>(`/agency/${type}/${id}/email`, body),
  agencyClientPapers: (clientId: string) => request<ClientPapers>(`/agency/clients/${clientId}/papers`),
  agencyDocLog: (type: DocType, id: string) => request<{ log: DocLogLine[] }>(`/agency/doc-log/${type}/${id}`),
  agencyDocs: (q = '') => request<{ page: AgencyPage; docs: AgencyDocListItem[]; counts: { status: string; n: number }[] }>(withQ('/agency/docs', q)),
  agencyDoc: (id: string) => request<{ doc: AgencyDocFull }>(`/agency/docs/${id}`),
  agencyDocAdd: (body: { kind?: AgencyDocKind; clientId?: string | null; templateId?: string; houseId?: string; month?: string; retainer?: Partial<RetainerInput> }) => post<{ id: string }>(`/agency/docs?day=${todayLocal()}`, body),
  agencyDocPrint: (id: string, sectionId: string, print: boolean) => post<{ doc: AgencyDocFull }>(`/agency/docs/${id}/print`, { sectionId, print }),
  agencyDocUpdate: (id: string, body: { doc?: ContractDoc; clientId?: string | null; status?: 'draft' | 'sent'; ifUpdatedAt?: string }) => patch<{ doc: AgencyDocFull }>(`/agency/docs/${id}`, body),
  agencyDocDuplicate: (id: string) => post<{ id: string }>(`/agency/docs/${id}/duplicate`),
  agencyDocRemove: (id: string) => del<{ ok: true }>(`/agency/docs/${id}`),
  // The Agency team: the owner's side (gated by Agency) and the member's own side under /me/teams (core).
  agencyTeam: (q = '') => request<{ page: AgencyPage; members: TeamMember[]; max: number; maxInvites: number }>(withQ('/agency/team', q)),
  agencyTeamInvite: (body: { who: string; role: TeamRole; clientId?: string; access?: TeamAccess }) => post<{ id: string; friendRequest: 'sent' | 'friends' | 'skipped' }>('/agency/team', body),
  agencyTeamUpdate: (id: string, body: { role?: TeamRole; access?: TeamAccess; clientId?: string }) => patch<{ id: string; role: TeamRole; access: TeamAccess; clientId: string | null }>(`/agency/team/${id}`, body),
  agencyTeamResend: (id: string) => post<{ ok: true }>(`/agency/team/${id}/resend`),
  agencyTeamRemove: (id: string) => del<{ ok: true }>(`/agency/team/${id}`),
  myTeams: () => request<{ teams: MyTeam[] }>('/me/teams'),
  myTeamAnswer: (id: string, yes: boolean) => post<{ ok: true; status: 'active' | 'removed' }>(`/me/teams/${id}/answer`, { yes }),
  myTeamLeave: (id: string) => post<{ ok: true }>(`/me/teams/${id}/leave`),
  myTeamClientView: (id: string) => request<{ view: PortalView; access: TeamAccess }>(`/me/teams/${id}/client-view?day=${todayLocal()}`),

  // business metrics in Reviews: only for people who switched them on
  kpis: (kind: PeriodKind, date: string) => request<KpisResponse>(`/reviews/kpis?kind=${kind}&date=${date}&day=${todayLocal()}`),
  kpiSwitch: (enabled: boolean) => put<{ enabled: boolean }>('/reviews/kpis/settings', { enabled }),
  kpiAdd: (body: Partial<Kpi>) => post<{ id: string }>('/reviews/kpis', body),
  kpiUpdate: (id: string, body: Partial<Kpi>) => patch<{ ok: true }>(`/reviews/kpis/${id}`, body),
  kpiRemove: (id: string) => del<{ ok: true }>(`/reviews/kpis/${id}`),
  kpiValue: (id: string, body: { date: string; value: number | null; note?: string }) => put<{ ok: true }>(`/reviews/kpis/${id}/value?day=${todayLocal()}`, body),
  spark: (date: string) => post<{ awarded: number; relationship: RelationshipKey; alreadyDone: boolean }>('/today/spark', { date }),

  // rank and rewards
  leaderboard: (by: LeaderboardSort, scope: LeaderboardScope = 'all', value = '', paging = '') => request<LeaderboardResponse>(`/leaderboard?by=${by}&scope=${scope}&value=${encodeURIComponent(value)}${paging ? `&${paging}` : ''}`),
  pillarTasks: () => request<{ pillars: { relationship: RelationshipKey; activeTasks: number; doneTasks: number }[] }>('/me/pillar-tasks'),
  leaderboardOptions: () => request<LeaderboardOptions>('/leaderboard/options'),
  leaderboardBlocks: () => request<{ blocks: LeaderboardBlock[] }>('/leaderboard/blocks'),
  rewards: (pq = '') => request<RewardsResponse & { redemptionsPage?: Page }>(withQ('/rewards', pq)),
  redeem: (key: string) => post<{ redemption: Redemption; points: number; game?: string }>(`/rewards/${key}/redeem`),
  node: (id: string) => request<{ node: Node }>(`/nodes/${id}`),
  focusTasks: (q = '') => request<{ tasks: FocusTask[] }>(`/wellbeing/focus/tasks${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  focusSettings: () => request<{ settings: FocusSettings | null }>('/wellbeing/focus-settings'),
  saveFocusSettings: (settings: FocusSettings) => put<{ settings: FocusSettings }>('/wellbeing/focus-settings', { settings }),
  focusQuality: (id: string, quality: number | null) => patch<{ ok: true }>(`/wellbeing/focus/${id}`, { quality }),
  weekPlan: (date: string, hours?: number) => request<{ plan: WeekPlan; blocks?: TimeBlock[] }>(`/today/week-plan?date=${date}${hours ? `&hours=${hours}` : ''}`),
  calendarLink: () => request<{ enabled: boolean; token: string | null }>('/me/calendar'),
  calendarSwitch: (body: { on?: boolean; fresh?: boolean }) => post<{ enabled: boolean; token: string | null }>('/me/calendar', body),
  logFocus: (minutes: number, nodeId: string | null, date: string, more: { clientRef?: string; mode?: FocusMode; mindful?: boolean } = {}) => post<{ ok: true; id: string | null; duplicate: boolean; logged: boolean }>('/wellbeing/focus', { minutes, date, ...(nodeId ? { nodeId } : {}), ...more }),
  focusToday: (date: string) => request<{ rounds: FocusRoundRow[] }>(`/wellbeing/focus/today?date=${date}`),
  focusRecent: () => request<{ tasks: FocusTask[] }>('/wellbeing/focus/tasks?recent=1'),
  editFocus: (id: string, body: { minutes?: number; nodeId?: string | null; quality?: number | null }) => patch<{ ok: true }>(`/wellbeing/focus/${id}`, body),
  deleteFocus: (id: string) => del<{ ok: true }>(`/wellbeing/focus/${id}`),
  focusDashboard: (view: FocusView, date: string) => request<FocusResponse>(`/wellbeing/focus?view=${view}&date=${date}`),
  appLogs: (params: string, paging: string) => request<LogsResponse>(withQ(`/internal/logs?${params}`, paging)),
  discover: () => request<{ answers: DiscoverAnswers; progress: { done: number; total: number; parts: { key: string; done: number; count: number }[] }; latest: { id: string; createdAt: string; result: DiscoverResult } | null; history: { id: string; createdAt: string; result: DiscoverResult }[]; settings: { steps: boolean; assistant: boolean; mind: boolean } }>('/discover'),
  discoverMore: () => request<{ extras: Record<ExtraKind, ExtraState> }>('/discover/more'),
  saveExtra: (kind: ExtraKind, answers: unknown) => put<{ ok: true }>(`/discover/more/${kind}/draft`, { answers }),
  submitExtra: (kind: ExtraKind, answers: unknown) => post<{ kind: ExtraKind; takenAt: string; result: unknown }>(`/discover/more/${kind}/submit`, { answers }),
  deleteExtra: (kind: ExtraKind) => del<{ ok: true }>(`/discover/more/${kind}`),
  discoverSettings: (body: { steps?: boolean; assistant?: boolean; mind?: boolean }) => put<{ settings: { steps: boolean; assistant: boolean; mind: boolean } }>('/discover/settings', body),
  saveDiscover: (answers: DiscoverAnswers) => put<{ ok: true }>('/discover/draft', { answers }),
  submitDiscover: (answers: DiscoverAnswers) => post<{ id: string; createdAt: string; result: DiscoverResult }>('/discover/submit', { answers }),
  dropDiscoverDraft: () => del<{ ok: true }>('/discover/draft'),
  deleteDiscoverResult: (id: string) => del<{ ok: true }>(`/discover/results/${id}`),
  cardGames: () => request<CardGamesResponse>('/cards'),
  cardGame: (key: string) => request<{ game: CardGamePlay }>(`/cards/${key}`),
  cancelRedemption: (id: string) => post<{ ok: true; points: number }>(`/rewards/redemptions/${id}/cancel`),

  // wellbeing
  wellbeing: () => request<WellbeingSummary>('/wellbeing/summary'),
  logs: (kind: LogKind, days = 30) => request<{ logs: WellbeingLog[] }>(`/wellbeing/${kind}?days=${days}`),
  /** A kind's logs as a list a person scrolls, newest first, a page at a time (prefix `s`). */
  logsPage: (kind: LogKind, pq = '') => request<{ logs: WellbeingLog[]; page: Page }>(withQ(`/wellbeing/${kind}?list=1`, pq)),
  log: (kind: LogKind, body: { date?: string; value: number; extra?: Record<string, unknown>; note?: string }) => post<{ log: WellbeingLog; summary: WellbeingSummary }>(`/wellbeing/${kind}`, body),
  deleteLog: (kind: LogKind, id: string) => del<{ ok: true }>(`/wellbeing/${kind}/${id}`),
  // fitness: movement and the daily eating check-in (2026-11-07). Kreators Run's tool writes the same movement log at /run/move.
  fitness: (day: string) => request<FitnessResponse>(`/fitness?day=${day}`),
  fitnessMonth: (month: string) => request<FitnessMonth>(`/fitness/month?month=${month}`),
  fitnessMoves: (pq = '') => request<MovesPage>(withQ('/fitness/moves', pq)),
  logMove: (body: MoveBody, from: 'fitness' | 'run' = 'fitness') => post<{ move: MoveLog }>(`/${from}/move`, body),
  editMove: (id: string, body: Partial<MoveBody>) => patch<{ move: MoveLog }>(`/fitness/move/${id}`, body),
  deleteMove: (id: string, from: 'fitness' | 'run' = 'fitness') => del<{ ok: true }>(`/${from}/move/${id}`),
  saveEat: (body: EatInput & { date: string; ifId?: string | null }) => put<{ eat: EatLog }>('/fitness/eat', body),
  // Only the goal is ever sent: the weight it may come from stays in the form.
  setProteinGoal: (goal: number | null) => put<{ goal: number | null }>('/fitness/protein-goal', { goal }),
  // Supplements (2026-11-07): the person's own list, under the same /fitness gate.
  supplements: (day: string) => request<SupplementsView>(`/fitness/supplements?day=${day}`),
  supplementsToday: (date: string) => request<SupplementsTodayView>(`/fitness/supplements/today?date=${date}`),
  supplementSettings: (body: Partial<SupplementSettings>) => put<{ settings: SupplementSettings }>('/fitness/supplements/settings', body),
  addSupplement: (body: SupplementInput) => post<{ supplement: Supplement }>('/fitness/supplements', body),
  editSupplement: (id: string, body: Partial<SupplementInput> & { paused?: boolean }) => patch<{ supplement: Supplement }>(`/fitness/supplements/${id}`, body),
  moveSupplement: (id: string, dir: 'up' | 'down') => post<{ ok: true }>(`/fitness/supplements/${id}/move`, { dir }),
  deleteSupplement: (id: string) => del<{ ok: true }>(`/fitness/supplements/${id}`),
  deleteAllSupplements: () => del<{ ok: true }>('/fitness/supplements'),
  tickSupplement: (id: string, date: string, taken: boolean) => put<{ ok: true }>(`/fitness/supplements/${id}/day`, { date, taken }),
  tickSupplementGroup: (date: string, time: SupplementTime) => post<{ ok: true; marked: number }>('/fitness/supplements/day', { date, time }),
  deleteEat: (id: string) => del<{ ok: true }>(`/fitness/eat/${id}`),
  runMoves: (day: string) => request<RunMovesResponse>(`/run/move?day=${day}`),
  journalDay: (date: string) => request<{ entries: JournalEntry[] }>(`/journal?date=${date}&size=100`),
  journalDays: (month: string) => request<{ days: { date: string; count: number; emotion: number | null }[]; gratitude: string[] }>(`/journal/days?month=${month}`),
  /** Gratitude for one day (any day up to today). */
  /** For today or yesterday it also carries the day's three prompts for this person (`prompts`, kept per day) and their usual three. */
  gratitude: (day: string) => request<{ gratitude: GratitudeDay | null; prompts?: string[]; usual?: GratitudeGroup[] | null }>(`/journal/gratitude?day=${day}&today=${todayLocal()}`),
  /** Save today's or yesterday's three lines; `ifUpdatedAt` is the version read ('' for none), so another tab's save answers 409. */
  saveGratitude: (day: string, lines: GratitudeLine[], ifUpdatedAt: string) => put<{ gratitude: GratitudeDay | null; prompts?: string[] }>(`/journal/gratitude/${day}`, { lines, today: todayLocal(), ifUpdatedAt }),
  /** Another prompt on an empty line: the one shown counts as seen; answers the day's new prompts (409 with them when the screen was behind). */
  gratitudeAnother: (day: string, index: number, prompt: string) => post<{ prompts: string[] }>(`/journal/gratitude/${day}/another`, { index, prompt, today: todayLocal() }),
  /** The pillar picker on an empty line. */
  gratitudePick: (day: string, index: number, group: GratitudeGroup, prompt: string) => post<{ prompts: string[] }>(`/journal/gratitude/${day}/pick`, { index, group, prompt, today: todayLocal() }),
  /** The usual three each new day starts with, or null for the rotation. */
  saveGratitudeUsual: (usual: GratitudeGroup[] | null) => put<{ usual: GratitudeGroup[] | null }>('/journal/gratitude-settings', { usual }),
  journal: (pq = '') => request<{ page: Page; entries: JournalEntry[]; stats: { total: number; thisMonth: number; positive: number; negative: number } }>(withQ('/journal', pq)),
  createEntry: (body: Partial<JournalEntry> & { date?: string }) => post<{ entry: JournalEntry }>('/journal', body),
  updateEntry: (id: string, body: Partial<JournalEntry>) => patch<{ entry: JournalEntry }>(`/journal/${id}`, body),
  deleteEntry: (id: string) => del<{ ok: true }>(`/journal/${id}`),
  companion: () => request<CompanionStatus>('/companion'),
  say: (body: { body: string; model?: string; runId?: string; context: { date: string; timeZone: string } }) => post<CompanionReply>('/companion', body),
  companionStop: (runId: string) => post<{ ok: true }>('/companion/stop', { runId }),
  clearCompanion: () => del<{ ok: true }>('/companion'),

  // inbox, library, community, search
  inbox: (pq = '', tab: InboxTab = 'all', show: InboxShow = 'inbox') => request<{ page: Page; notifications: Notification[]; unread: number; tab: InboxTab; show: InboxShow; tabs: { tab: InboxTab; unread: number }[] }>(withQ(`/inbox?tab=${tab}&show=${show}`, pq)),
  readAll: (tab: InboxTab = 'all') => post<{ ok: true }>('/inbox/read-all', { tab }),
  /** `unread` with `archived: false` (Undo right after archiving) also puts the note back to unread. */
  archiveNote: (id: string, archived: boolean, unread?: boolean) => post<{ ok: true }>(`/inbox/${id}/archive`, unread ? { archived, unread } : { archived }),
  deleteNote: (id: string) => del<{ ok: true }>(`/inbox/${id}`),
  deleteArchived: (tab: InboxTab) => del<{ ok: true; deleted: number }>(`/inbox/archived?tab=${tab}`),
  archiveRead: (tab: InboxTab) => post<{ ok: true; archived: number }>('/inbox/archive-read', { tab }),
  brief: (date: string, hour: number) => request<{ brief: DailyBrief; gettingStarted: GettingStarted }>(`/home/brief?date=${date}&hour=${hour}`),
  foldGettingStarted: (folded: boolean) => put<{ ok: true }>('/home/getting-started', { folded }),
  duplicateEvent: (id: string, startsAt: string) => post<{ event: PartyEvent | null }>(`/party/events/${id}/duplicate`, { startsAt }),
  readOne: (id: string) => post<{ ok: true }>(`/inbox/${id}/read`),
  resources: (tag?: string, pq = '') => request<{ page: Page; resources: Resource[] }>(withQ(`/resources${tag ? `?tag=${encodeURIComponent(tag)}` : ''}`, pq)),
  resource: (id: string) => request<{ resource: Resource }>(`/resources/${id}`),
  community: (category?: string, product?: string, all = false, sort: FeedSort = 'recent', filter: FeedFilter = 'all', pq = '') =>
    request<{ page: Page; posts: CommunityPost[]; categories: readonly string[]; sort: FeedSort; filter: FeedFilter; muted: boolean }>(withQ(`/community?${new URLSearchParams({ ...(category ? { category } : {}), ...(product ? { product } : {}), ...(all ? { all: '1' } : {}), sort, filter })}`, pq)),
  createPost: (body: { category: string; body: string; productId?: string | null; anonymous?: boolean }) => post<{ post: CommunityPost; awarded: SocialAward; held: boolean }>('/community', body),
  likePost: (id: string, kind?: ReactionKind) => post<{ post: CommunityPost; awarded: SocialAward }>(`/community/${id}/like`, kind ? { kind } : {}),
  followPost: (id: string) => post<{ following: boolean }>(`/community/${id}/follow-post`),
  reactReply: (id: string, kind: ReactionKind) => post<{ reply: CommunityReply | null }>(`/community/replies/${id}/react`, { kind }),
  pinPost: (id: string, pinned: boolean) => post<{ post: CommunityPost | null }>(`/manage/community/posts/${id}/pin`, { pinned }),
  approvePost: (id: string) => post<{ post: CommunityPost | null }>(`/manage/community/posts/${id}/approve`),
  heldPosts: (pq = '') => request<{ posts: CommunityPost[]; page: Page; holdFirstPosts: boolean }>(withQ('/manage/community/held', pq)),
  setHoldFirstPosts: (holdFirstPosts: boolean) => put<{ holdFirstPosts: boolean }>('/manage/community/settings', { holdFirstPosts }),
  replies: (id: string, pq = '') => request<{ page: Page; replies: CommunityReply[] }>(withQ(`/community/${id}/replies`, pq)),
  /** One post, for a link that names it (`/community?post=<id>` from an inbox note or a search result). */
  communityPost: (id: string) => request<{ post: CommunityPost | null }>(`/community/posts/${encodeURIComponent(id)}`),
  reply: (id: string, body: string, opts: { anonymous?: boolean; parentId?: string | null } = {}) => post<{ reply: CommunityReply; awarded: SocialAward }>(`/community/${id}/replies`, { body, ...opts }),
  blockPostAuthor: (id: string) => post<{ ok: true }>(`/community/posts/${id}/block-author`),
  blockReplyAuthor: (id: string) => post<{ ok: true }>(`/community/replies/${id}/block-author`),
  followUser: (id: string) => post<{ following: boolean; followers: number; awarded: SocialAward }>(`/community/follow/${id}`),
  deletePost: (id: string) => del<{ ok: true }>(`/community/${id}`),
  search: (q: string) => request<SearchResults>(`/search?q=${encodeURIComponent(q)}`),

  // storefront, buyer side
  /** `add` is a QR code's friend code: the answer then says whether it is this person's (`PublicPage.add`). */
  publicPage: (handle: string, add?: string | null) => request<PublicPage>(`/public/${encodeURIComponent(handle)}${add != null ? `?add=${encodeURIComponent(add)}` : ''}`),
  personPage: (id: string) => request<PublicPage>(`/public/people/${encodeURIComponent(id)}`),
  publicProduct: (id: string) => request<{ product: Product; lessonCount: number; testimonials: Testimonial[]; owned: boolean; seller: { trust: TrustScore }; unlock: Unlock; canEdit: boolean }>(`/public/products/${id}`),
  click: (handle: string, ref: string) => post<{ ok: true }>(`/public/${encodeURIComponent(handle)}/click`, { ref }),
  lead: (handle: string, body: { name: string; email: string; message: string }) => post<{ ok: true }>(`/public/${encodeURIComponent(handle)}/lead`, body),
  follow: (handle: string) => post<{ following: boolean }>(`/store/follow/${encodeURIComponent(handle)}`),
  checkout: (productId: string, body: { coupon?: string; discountCode?: string; affiliate?: string | null; pay: 'points' | 'test' | 'money'; points?: number; question?: string; intake?: string[]; replay?: boolean; click?: string | null; src?: string | null }) =>
    post<{ order: Order; payment: { mode: 'razorpay'; keyId: string | null; providerOrderId: string | null; amountCents: number; currency: string } | null }>(`/store/${productId}/checkout`, body),
  order: (id: string) => request<{ order: Order }>(`/store/orders/${id}`),
  reschedule: (bookingId: string, startsAt: string) => post<{ booking: Booking }>(`/store/bookings/${bookingId}/reschedule`, { startsAt }),
  quiz: (lessonId: string, answers: number[]) => post<{ score: number; passed: boolean; right: number; total: number; correct: number[] }>(`/store/lessons/${lessonId}/quiz`, { answers }),
  claimCertificate: (productId: string) => post<{ code: string; url: string }>(`/store/products/${productId}/certificate`),
  certificates: () => request<{ certificates: Certificate[] }>('/store/certificates'),
  myDmRequests: () => request<{ requests: DmRequest[] }>('/store/dm'),
  browse: (kind?: 'session' | 'event', pq = '') => request<{ page: Page; products: Product[] }>(withQ(`/store/browse${kind ? `?kind=${kind}` : ''}`, pq)),
  library: (pq = '') => request<{ page: Page; orders: Order[]; products: Product[]; bookings: Booking[]; bookingsPage: Page }>(withQ('/store/library', pq)),
  owned: (id: string) => request<{ product: Product; lessons: Lesson[]; certificateCode: string | null }>(`/store/products/${id}`),
  completeLesson: (id: string) => post<{ ok: true }>(`/store/lessons/${id}/complete`),
  slots: (productId: string, date: string) => request<{ slots: string[]; durationMin: number; zone: string }>(`/store/${productId}/slots?date=${date}`),
  book: (productId: string, body: { startsAt: string; note?: string; intake?: string[] }) => post<{ booking: Booking }>(`/store/${productId}/book`, body),
  cancelBooking: (id: string) => post<{ ok: true }>(`/store/bookings/${id}/cancel`),
  review: (productId: string, body: { rating: number; body: string }) => post<{ ok: true }>(`/store/${productId}/review`, body),

  // studio, owner side
  studio: () => request<{ products: Product[]; orders: Order[]; analytics: StudioAnalytics; handle: string | null; referralCode: string | null }>('/studio'),
  createProduct: (body: Partial<Product>) => post<{ product: Product }>('/studio/products', body),
  studioProduct: (id: string, pq = '') => request<{ product: Product; lessons: Lesson[]; orderPage: Page; orders: Order[]; bookingPage: Page; bookings: Booking[]; testimonials: Testimonial[] }>(withQ(`/studio/products/${id}`, pq)),
  updateProduct: (id: string, body: Partial<Product>) => patch<{ product: Product }>(`/studio/products/${id}`, body),
  deleteProduct: (id: string) => del<{ ok: true }>(`/studio/products/${id}`),
  productInvites: (id: string, pq = '') => request<{ page: Page; invites: ProductInvite[] }>(withQ(`/studio/products/${id}/invites`, pq)),
  inviteToProduct: (id: string, who: string) => post<{ invite: ProductInvite | null; already: boolean }>(`/studio/products/${id}/invites`, { who }),
  uninviteFromProduct: (id: string, userId: string) => del<{ ok: true }>(`/studio/products/${id}/invites/${userId}`),
  createLesson: (productId: string, body: Partial<Lesson>) => post<{ lesson: Lesson }>(`/studio/products/${productId}/lessons`, body),
  updateLesson: (id: string, body: Partial<Lesson>) => patch<{ lesson: Lesson }>(`/studio/lessons/${id}`, body),
  deleteLesson: (id: string) => del<{ ok: true }>(`/studio/lessons/${id}`),
  coupons: (productId = '', pq = '') => request<{ coupons: Coupon[]; page: Page }>(withQ(`/studio/coupons${productId ? `?product=${encodeURIComponent(productId)}` : ''}`, pq)),
  createCoupon: (body: Partial<Coupon>) => post<{ coupon: Coupon }>('/studio/coupons', body),
  deleteCoupon: (id: string) => del<{ ok: true }>(`/studio/coupons/${id}`),
  availability: () => request<{ availability: Availability[] }>('/studio/availability'),
  addAvailability: (body: { weekday: number; startMin: number; endMin: number }) => post<{ availability: Availability }>('/studio/availability', body),
  removeAvailability: (id: string) => del<{ ok: true }>(`/studio/availability/${id}`),
  overrides: () => request<{ overrides: AvailabilityOverride[] }>('/studio/availability/overrides'),
  setOverride: (date: string, ranges: { startMin: number; endMin: number }[]) => request<{ override: AvailabilityOverride }>(`/studio/availability/overrides/${date}`, { method: 'PUT', body: JSON.stringify({ ranges }) }),
  removeOverride: (date: string) => del<{ ok: true }>(`/studio/availability/overrides/${date}`),
  sales: (opts: { status?: string; from?: string; to?: string } = {}, pq = '') => request<{ page: Page; orders: Order[] }>(withQ(`/studio/orders?${new URLSearchParams(Object.fromEntries(Object.entries(opts).filter(([, v]) => v)) as Record<string, string>)}`, pq)),
  salesCsvUrl: '/api/studio/orders?format=csv',
  draftCourse: (body: { source: string; title?: string }) => post<{ draft: CourseDraft; aiAvailable: boolean }>('/studio/draft', body),
  saveDraft: (productId: string, lessons: CourseDraft['lessons']) => post<{ ok: true; added: number }>(`/studio/products/${productId}/draft`, { lessons }),
  kyc: () => request<{ kyc: KycProfile }>('/kyc'),
  submitKyc: (body: { legalName: string; pan: string; bankAccount: string; ifsc: string; address: string }) => post<{ kyc: KycProfile }>('/kyc', body),
  studioBookings: (pq = '') => request<{ page: Page; bookings: Booking[] }>(withQ('/studio/bookings', pq)),
  setBooking: (id: string, body: { status?: Booking['status']; meetingUrl?: string }) => post<{ booking: Booking }>(`/studio/bookings/${id}`, body),
  leads: (pq = '') => request<{ page: Page; leads: Lead[] }>(withQ('/studio/leads', pq)),
  testimonials: (pq = '') => request<{ page: Page; testimonials: Testimonial[] }>(withQ('/studio/testimonials', pq)),
  approveTestimonial: (id: string, approved: boolean) => post<{ ok: true }>(`/studio/testimonials/${id}`, { approved }),
  broadcast: (body: { title: string; body: string; audience: 'followers' | 'buyers' }) => post<{ sent: number }>('/studio/broadcasts', body),
  audience: (pq = '') =>
    request<{ page: Page; followers: { name: string; handle: string | null; since: string }[]; broadcasts: { id: string; title: string; body: string; audience: string; sent: number; createdAt: string }[]; broadcastsPage: Page; referralCode: string | null; referred: number; affiliateShare: number }>(withQ('/studio/audience', pq)),


  // organizations (brands)
  orgs: (all = false) => request<{ organizations: Organization[] }>(`/orgs${all ? '?all=1' : ''}`),
  createOrg: (body: { name: string; type?: Organization['type'] }) => post<{ organization: Organization }>('/orgs', body),
  // `invited`: asks still waiting, for the owner and talent staff only (2026-11-10, a brand's team is joined by a yes).
  orgMembers: (id: string) => request<{ members: OrganizationMember[]; invited?: OrganizationMember[] }>(`/orgs/${id}/members`),
  addOrgMember: (id: string, email: string) => post<{ ok: true }>(`/orgs/${id}/members`, { email }),
  removeOrgMember: (id: string, userId: string) => del<{ ok: true }>(`/orgs/${id}/members/${userId}`),

  // army: brand campaigns
  army: (pq = '') => request<{ page: Page; campaigns: Campaign[]; assignments: CampaignAssignment[]; staff: boolean }>(withQ('/army', pq)),
  createCampaign: (body: Partial<Campaign> & { organizationId: string; name: string }) => post<{ campaign: Campaign }>('/army/campaigns', body),
  campaign: (id: string, pq = '') => request<{ campaign: Campaign; deliverables: Deliverable[]; assignments: CampaignAssignment[]; events: CampaignEvent[]; eventsPage: Page; who: 'staff' | 'brand' | 'creator' }>(withQ(`/army/campaigns/${id}`, pq)),
  updateCampaign: (id: string, body: Partial<Campaign> & { ownerId?: string }) => patch<{ campaign: Campaign }>(`/army/campaigns/${id}`, body),
  addDeliverable: (campaignId: string, body: { title: string; format?: string; platform?: string; dueAt?: string }) => post<{ ok: true; id: string }>(`/army/campaigns/${campaignId}/deliverables`, body),
  assignCreator: (campaignId: string, body: { creator: string; role?: string; feeAmount?: number; currency?: string }) => post<{ ok: true; id: string }>(`/army/campaigns/${campaignId}/assignments`, body),
  answerAssignment: (id: string, status: 'accepted' | 'declined' | 'done') => post<{ ok: true }>(`/army/assignments/${id}`, { status }),
  uploadVersion: (deliverableId: string, body: { url: string; note?: string }) => post<{ ok: true; id: string }>(`/army/deliverables/${deliverableId}/versions`, body),
  reviewVersion: (versionId: string, body: { status: 'approved' | 'changes'; comment?: string }) => post<{ ok: true }>(`/army/versions/${versionId}/review`, body),
  setCampaignPublic: (id: string, isPublic: boolean) => post<{ ok: true }>(`/win/campaigns/${id}/public`, { public: isPublic }),

  // school
  school: (pq = '') => request<{ page: Page; programs: Program[]; myCohorts: Cohort[]; managed: Cohort[]; staff: boolean; admin: boolean; view: 'mine' | 'every'; mentor: boolean }>(withQ('/school', pq)),
  createProgram: (body: Partial<Program> & { name: string }) => post<{ ok: true; id: string }>('/school/programs', body),
  updateProgram: (id: string, body: Partial<Program>) => patch<{ ok: true }>(`/school/programs/${id}`, body),
  // A program's state (draft, private, public, archived), its invites and the delete from archived: its creator or an admin.
  setProgramVisibility: (id: string, visibility: ProgramVisibility) => patch<{ ok: true; visibility: ProgramVisibility }>(`/school/programs/${id}`, { visibility }),
  programInvites: (id: string, pq = '') => request<{ page: Page; invites: ProgramInvite[] }>(withQ(`/school/programs/${id}/invites`, pq)),
  inviteToProgram: (id: string, who: string) => post<{ ok: true; invite: ProgramInvite }>(`/school/programs/${id}/invites`, { who }),
  uninviteFromProgram: (id: string, userId: string) => del<{ ok: true }>(`/school/programs/${id}/invites/${userId}`),
  deleteProgram: (id: string) => del<{ ok: true }>(`/school/programs/${id}`),
  addLearningItem: (programId: string, body: { moduleTitle: string; contentType?: LearningItem['contentType']; contentRef?: string; body?: string }) => post<{ ok: true; id: string }>(`/school/programs/${programId}/items`, body),
  addLessonResource: (itemId: string, body: { kind: string; ref: string; label: string }) => post<{ ok: true; id: string }>(`/school/items/${itemId}/resources`, body),
  changeLessonResource: (itemId: string, resourceId: string, body: { kind: string; ref: string; label: string }) => patch<{ ok: true }>(`/school/items/${itemId}/resources/${resourceId}`, body),
  moveLessonResource: (itemId: string, resourceId: string, to: 'up' | 'down') => post<{ ok: true }>(`/school/items/${itemId}/resources/${resourceId}/move`, { to }),
  removeLessonResource: (itemId: string, resourceId: string) => del<{ ok: true }>(`/school/items/${itemId}/resources/${resourceId}`),
  // Editing in place (migration 0095): a lesson's title, kind and words, its place in the program, removing it, and School's order of
  // programs (an admin).
  updateSchoolLesson: (itemId: string, body: { moduleTitle?: string; contentType?: LearningItem['contentType']; body?: string }) => patch<{ ok: true }>(`/school/items/${itemId}`, body),
  moveSchoolLesson: (itemId: string, to: 'up' | 'down') => post<{ ok: true }>(`/school/items/${itemId}/move`, { to }),
  deleteSchoolLesson: (itemId: string) => del<{ ok: true }>(`/school/items/${itemId}`),
  // `view` is the School view the admin is looking at, so a program moves past the neighbour they can see.
  moveProgram: (id: string, to: 'first' | 'up' | 'down', view: 'mine' | 'every' = 'mine') => post<{ ok: true }>(`/school/programs/${id}/move`, { to, view }),
  addAssignment: (programId: string, body: { title: string; instructions?: string; rubric?: string; dueDays?: number }) => post<{ ok: true }>(`/school/programs/${programId}/assignments`, body),
  openCohort: (programId: string, body: { name: string; startAt: string; endAt: string; capacity?: number }) => post<{ ok: true; id: string }>(`/school/programs/${programId}/cohorts`, body),
  enroll: (cohortId: string, pay?: 'test', discountCode?: string) => post<{ ok: true; id: string }>(`/school/cohorts/${cohortId}/enroll`, { ...(pay ? { pay } : {}), ...(discountCode ? { discountCode } : {}) }),
  /** A cohort; for whoever runs it, `enrollments` is one page of learners (prefix `l`), `learnerCount` all of them. */
  cohort: (id: string, pq = '') =>
    request<{ cohort: Cohort; items: LearningItem[]; assignments: CourseAssignment[]; submissions: Submission[]; sessions: CohortSession[]; enrollments: Enrollment[]; learnersPage: Page | null; learnerCount: number; manager: boolean; mentor: boolean; canSetManager?: boolean; myProgress: Enrollment['progress'] | null; myStatus: Enrollment['status'] | null }>(withQ(`/school/cohorts/${id}`, pq)),
  submitAssignment: (assignmentId: string, body: { cohortId: string; url?: string; text?: string }) => post<{ ok: true }>(`/school/assignments/${assignmentId}/submit`, body),
  giveFeedback: (submissionId: string, body: { comment: string; status: 'approved' | 'changes'; grade?: string }) => post<{ ok: true }>(`/school/submissions/${submissionId}/feedback`, body),
  scheduleSession: (cohortId: string, body: { title: string; startsAt: string; minutes?: number; onlineUrl?: string }) => post<{ ok: true }>(`/school/cohorts/${cohortId}/sessions`, body),
  attend: (sessionId: string, userId?: string) => post<{ ok: true }>(`/school/sessions/${sessionId}/attendance`, userId ? { userId } : {}),
  completeEnrollment: (id: string) => post<{ ok: true }>(`/school/enrollments/${id}/complete`),
  // A cohort's discussion: a page of posts with their replies, a post or a reply, taking a line down, and how I appear.
  cohortTalk: (cohortId: string, pq = '') => request<CohortTalkResponse>(withQ(`/school/cohorts/${cohortId}/talk`, pq)),
  cohortTalkSay: (cohortId: string, body: string, parentId?: string | null) => post<{ line: CohortTalkLine | null }>(`/school/cohorts/${cohortId}/talk`, { body, ...(parentId ? { parentId } : {}) }),
  cohortTalkUnsay: (cohortId: string, lineId: string) => del<{ ok: true }>(`/school/cohorts/${cohortId}/talk/${lineId}`),
  cohortTalkReport: (cohortId: string, lineId: string, note = '') => post<{ ok: true }>(`/school/cohorts/${cohortId}/talk/${lineId}/report`, { note }),
  cohortTalkBlockAuthor: (cohortId: string, lineId: string) => post<{ ok: true }>(`/school/cohorts/${cohortId}/talk/${lineId}/block-author`),
  cohortTalkVisibility: (cohortId: string, visibility: CohortTalkVisibility) => put<{ me: CohortTalkMe }>(`/school/cohorts/${cohortId}/talk/me`, { visibility }),

  // work
  work: (pq = '', draftPq = '') => request<{ page: Page; opportunities: Opportunity[]; applications: Application[]; applicationsPage: Page; draftPage: Page; drafts: Opportunity[]; canPost: boolean }>(withQ(withQ('/work', pq), draftPq)),
  createOpportunity: (body: Partial<Opportunity> & { title: string }) => post<{ ok: true; id: string }>('/work/opportunities', body),
  opportunity: (id: string, pq = '') => request<{ opportunity: Opportunity; page: Page; applications: Application[]; owner: boolean }>(withQ(`/work/opportunities/${id}`, pq)),
  setOpportunity: (id: string, status: Opportunity['status'], clubOnly?: boolean) => patch<{ ok: true }>(`/work/opportunities/${id}`, clubOnly === undefined ? { status } : { status, clubOnly }),
  apply: (id: string, coverNote: string) => post<{ application: Application }>(`/work/opportunities/${id}/apply`, { coverNote }),
  setApplication: (id: string, body: { status: Application['status']; note?: string }) => post<{ ok: true }>(`/work/applications/${id}`, body),

  // party
  party: (pq = '') => request<{ page: Page; events: PartyEvent[]; hosting: PartyEvent[]; hostingPage: Page; canHostAll: boolean; club: boolean }>(withQ('/party', pq)),
  createEvent: (body: Partial<PartyEvent> & { title: string; startsAt: string; minutes?: number; attendeeXp?: number; attendeeCode?: string }) => post<{ event: PartyEvent; codeError: string | null }>('/party/events', body),
  event: (id: string, pq = '') => request<{ event: PartyEvent; registrations: EventRegistration[]; registrationsPage?: Page | null; host: boolean; feedback: { average: number | null; count: number }; hostCode: AttendeeCodeHost | null; attendee: AttendeeCodeView | null }>(withQ(`/party/events/${id}`, pq)),
  setEventCode: (id: string, change: CodeChange) => put<{ hostCode: AttendeeCodeHost }>(`/party/events/${id}/attendee-code`, change),
  claimEventCode: (id: string, code: string) => post<{ xp: number; newBadges: string[] }>(`/party/events/${id}/claim`, { code }),
  rsvp: (id: string, networking: boolean, discountCode?: string) => post<{ status: EventRegistration['status'] }>(`/party/events/${id}/rsvp`, { networking, ...(discountCode ? { discountCode } : {}) }),
  cancelRsvp: (id: string) => post<{ ok: true }>(`/party/events/${id}/cancel-rsvp`),
  /** Joining from the event's public page: marks an account still setting up as an attendee and switches its event apps on. Takes no seat. */
  arriveEvent: (id: string) => post<{ ok: true; attendee: boolean; modules: Record<string, boolean> }>(`/party/events/${id}/arrive`),
  checkinGuest: (id: string, userId: string) => post<{ ok: true }>(`/party/events/${id}/checkin`, { userId }),
  eventFeedback: (id: string, body: { rating: number; comment?: string; networking?: boolean }) => post<{ ok: true }>(`/party/events/${id}/feedback`, body),
  setEvent: (id: string, status: 'published' | 'cancelled' | 'done') => patch<{ ok: true }>(`/party/events/${id}`, { status }),
  // kreators run
  run: (pq = '') => request<RunResponse>(withQ('/run', pq)),
  createRunClub: (body: { name: string; city: string; description?: string; pace?: RunPace; meets?: string; visibility?: 'public' | 'private' }) => post<{ club: RunClub | null }>('/run/clubs', body),
  runClub: (id: string, pq = '') => request<RunClubDetail & { runPage: Page; pastPage: Page; collabPage: Page }>(withQ(`/run/clubs/${id}`, pq)),
  setRunClub: (id: string, body: { status?: 'active' | 'closed'; description?: string; meets?: string; pace?: RunPace; visibility?: 'public' | 'private' }) => patch<{ ok: true }>(`/run/clubs/${id}`, body),
  joinRunClub: (id: string) => post<{ ok: true }>(`/run/clubs/${id}/join`),
  leaveRunClub: (id: string) => post<{ ok: true }>(`/run/clubs/${id}/leave`),
  addRun: (clubId: string, body: { title: string; startsAt: string; minutes: number; meetingPoint?: string; metres?: number; collabId?: string | null; xp?: number; code?: string }) => post<{ run: Run | null; codeError: string | null }>(`/run/clubs/${clubId}/runs`, body),
  /** A new start code (random with no change), the host's own, or the xp before the run starts. */
  recodeRun: (id: string, change: CodeChange = {}) => post<{ code: string; xp: number }>(`/run/runs/${id}/recode`, change),
  setRun: (id: string, status: 'published' | 'cancelled' | 'done') => patch<{ ok: true }>(`/run/runs/${id}`, { status }),
  logRun: (id: string, body: { code: string; metres: number; minutes: number }) => post<{ entry: RunEntry | null; xp: number; points: number; capped: boolean; newBadges: string[] }>(`/run/runs/${id}/entry`, body),
  voidRunEntry: (id: string) => post<{ ok: true }>(`/run/entries/${id}/void`),
  runCollabs: (pq = '') => request<RunCollabsResponse>(withQ('/run/collabs', pq)),
  postRunCollab: (body: { title: string; brandName?: string; organizationId?: string | null; brief?: string; asks?: string; giveaway: string; giveawayCount?: number; city?: string; startsAt: string; endsAt: string }) => post<{ collab: RunCollab | null }>('/run/collabs', body),
  setRunCollab: (id: string, status: 'open' | 'closed') => patch<{ ok: true }>(`/run/collabs/${id}`, { status }),
  applyRunCollab: (id: string, body: { clubId: string; note?: string }) => post<{ application: { id: string; status: string } }>(`/run/collabs/${id}/apply`, body),
  decideRunCollab: (id: string, appId: string, status: 'accepted' | 'declined') => post<{ ok: true }>(`/run/collabs/${id}/applications/${appId}`, { status }),
  // a run's discussion: one per run, for its people only, polled like a channel
  runTalks: (pq = '') => request<{ page: Page; talks: RunTalk[] }>(withQ('/run/talk', pq)),
  runTalksUnread: () => request<{ unread: number }>('/run/talk/unread'),
  runTalk: (runId: string) => request<{ talk: RunTalk }>(`/run/talk/${runId}`),
  runTalkLines: (runId: string, q: { after?: number; before?: number; from?: number; read?: boolean } = {}) => {
    const p = new URLSearchParams();
    if (q.after) p.set('after', String(q.after));
    if (q.before) p.set('before', String(q.before));
    if (q.after && q.from) p.set('from', String(q.from));
    if (q.read) p.set('read', '1');
    return request<{ lines: RunTalkLine[]; more: boolean; gone: number[] }>(withQ(`/run/talk/${runId}/messages`, p.toString()));
  },
  runTalkSay: (runId: string, body: string, opts: { anonymous?: boolean; replyTo?: string | null } = {}) => post<{ line: RunTalkLine | null }>(`/run/talk/${runId}/messages`, { body, ...opts }),
  runTalkUnsay: (runId: string, mid: string) => del<{ ok: true }>(`/run/talk/${runId}/messages/${mid}`),
  runTalkReport: (runId: string, mid: string, note = '') => post<{ ok: true }>(`/run/talk/${runId}/messages/${mid}/report`, { note }),
  runTalkBlockAuthor: (runId: string, mid: string) => post<{ ok: true }>(`/run/talk/${runId}/messages/${mid}/block-author`),

  // club
  club: (pq = '') => request<{ page: Page; benefits: typeof import('@kreators/shared').CLUB_BENEFITS; mine: Membership | null; queue: Membership[]; members: number; reviewer: boolean; staff: { id: string; name: string }[] }>(withQ('/club', pq)),
  setClubManager: (id: string, managerId: string | null) => post<{ ok: true }>(`/club/memberships/${id}/manager`, { managerId }),
  applyClub: (note: string) => post<{ ok: true }>('/club/apply', { note }),
  decideMembership: (id: string, body: { status: Membership['status']; note?: string; months?: number }) => post<{ ok: true }>(`/club/memberships/${id}`, body),

  // win: content rewards
  win: (pq = '', queuePq = '') => request<{ page: Page; bounties: Bounty[]; mine: BountySubmission[]; minePage: Page; queuePage: Page; queue: BountySubmission[]; earned: number; reviewer: boolean; finance: boolean; canCreate: boolean }>(withQ(withQ('/win', pq), queuePq)),
  bounty: (id: string, pq = '') => request<{ bounty: Bounty; page: Page; submissions: BountySubmission[]; board: { name: string; views: number; status: string }[] }>(withQ(`/win/${id}`, pq)),
  createBounty: (body: Partial<Bounty> & { title: string; organizationId?: string }) => post<{ ok: true; id: string }>('/win', body),
  editBounty: (id: string, body: Partial<Bounty>) => patch<{ ok: true; version: number; changed: string[] }>(`/win/${id}`, body),
  submitBounty: (id: string, url: string) => post<{ submission: BountySubmission | null }>(`/win/${id}/submit`, { url }),
  reportMetrics: (submissionId: string, body?: { views: number; likes?: number; comments?: number; shares?: number; note?: string }) => post<{ submission: BountySubmission | null; why: string }>(`/win/submissions/${submissionId}/metrics`, body ?? {}),
  reviewBounty: (submissionId: string, body: { status: 'verified' | 'rejected' | 'paid'; evidenceViews?: number; evidenceNote?: string; payoutPoints?: number }) => post<{ ok: true; points?: number }>(`/win/submissions/${submissionId}/review`, body),
  disputeBounty: (submissionId: string, note: string) => post<{ ok: true }>(`/win/submissions/${submissionId}/dispute`, { note }),

  // bond
  bond: (inq = '') => request<{ optedIn: boolean; intros: Introduction[]; introPage: Page; suggestions: { userId: string; name: string; handle: string | null; skills: string[]; context: string }[] }>(withQ('/bond', inq)),
  proposeIntro: (recipientId: string, context: string) => post<{ ok: true }>('/bond/intros', { recipientId, context }),
  answerIntro: (id: string, status: 'accepted' | 'declined') => post<{ ok: true }>(`/bond/intros/${id}`, { status }),
  friends: (pq = '') => request<{ page: Page; open: Friend[]; openPage: Page; friends: Friend[] }>(withQ('/bond/friends', pq)),
  addFriend: (userId: string) => post<{ ok: true; status: 'sent' | 'friends' }>('/bond/friends', { userId }),
  reminders: (day: string) => request<RemindersResponse>(`/reminders?day=${day}`),
  legal: () => request<LegalState>('/me/legal'),
  saveConsent: (choices: ConsentChoices, source: 'popup' | 'profile') => put<LegalState>('/me/legal/consent', { choices, source }),
  acceptTerms: () => post<LegalState>('/me/legal/accept'),
  unsubscribe: (token: string) => post<{ ok: boolean }>(`/public/unsubscribe/${encodeURIComponent(token)}`),
  drinkWater: (day: string, ml?: number) => post<{ water: WaterState }>('/reminders/water', { day, ...(ml ? { ml } : {}) }),
  undoWater: (day: string) => del<{ water: WaterState }>(`/reminders/water?day=${day}`),
  waterSettings: (day: string, s: Partial<{ goalMl: number; glassMl: number }>) => put<{ water: WaterState }>('/reminders/water/settings', { day, ...s }),
  addReminder: (r: { title: string; time: string; days: number[] }) => post<{ reminder: CustomReminder }>('/reminders/custom', r),
  changeReminder: (id: string, r: Partial<{ title: string; time: string; days: number[]; enabled: boolean }>) => patch<{ reminder: CustomReminder }>(`/reminders/custom/${id}`, r),
  removeReminder: (id: string) => del<{ ok: true }>(`/reminders/custom/${id}`),
  blocks: (pq = '') => request<{ page: Page; blocked: BlockedPerson[] }>(withQ('/bond/blocks', pq)),
  // `key` is a block's own key from `blocks` (a person's id, or the key of a block made behind a made-up name).
  unblock: (key: string) => del<{ ok: true }>(`/bond/block/${encodeURIComponent(key)}`),
  mutes: (pq = '') => request<{ page: Page; mutes: { userId: string; name: string; handle: string | null; reason: string; by: string; createdAt: string }[] }>(withQ('/community/mutes', pq)),
  mute: (userId: string, reason = '') => post<{ ok: true }>(`/community/members/${userId}/mute`, { reason }),
  unmute: (userId: string) => del<{ ok: true }>(`/community/members/${userId}/mute`),
  mediaFor: (type: MediaOwner, id: string) => request<{ items: MediaItem[]; canEdit: boolean; max: number }>(`/media/for/${type}/${id}`),
  setMedia: (type: MediaOwner, id: string, items: { url: string; caption: string }[]) => put<{ items: MediaItem[] }>(`/media/for/${type}/${id}`, { items }),
  uploadMedia: async (file: Blob) => {
    const token = useSession.getState().token;
    const res = await fetch('/api/media/upload', { method: 'POST', body: file, headers: { 'Content-Type': file.type, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    const body = (await res.json().catch(() => ({}))) as { url?: string; kind?: MediaItem['kind']; error?: string };
    if (!res.ok || !body.url) throw new ApiError(body.error ?? 'That upload did not work.', res.status, body);
    return { url: body.url, kind: body.kind ?? 'image' };
  },
  eventExtras: (app: EventApp, id: string) => request<EventExtras>(`/connect/${app}/${id}`),
  eventSay: (app: EventApp, id: string, body: string, opts: { anonymous?: boolean; parentId?: string | null } = {}) => post<{ ok: true }>(`/connect/${app}/${id}/messages`, { body, ...opts }),
  eventUnsay: (app: EventApp, id: string, mid: string) => del<{ ok: true }>(`/connect/${app}/${id}/messages/${mid}`),
  eventPhotos: (app: EventApp, id: string, url: string, note: string) => put<{ ok: true }>(`/connect/${app}/${id}/photos`, { url, note }),
  eventPhotosOff: (app: EventApp, id: string) => del<{ ok: true }>(`/connect/${app}/${id}/photos`),
  eventListed: (app: EventApp, id: string, on: boolean) => put<{ ok: true }>(`/connect/${app}/${id}/networking`, { on }),
  eventConnect: (app: EventApp, id: string, userId: string) => post<{ ok: true; status: string }>(`/connect/${app}/${id}/people/${userId}/connect`),
  addFriendByCode: (code: string) => post<{ ok: true; status: 'sent' | 'friends' }>('/bond/friends', { code }),
  /** A new friend code: the old one, and every QR code made from it, stops working. */
  newFriendCode: () => post<{ friendCode: string }>('/me/friend-code'),
  answerFriend: (id: string, status: 'accepted' | 'declined') => post<{ ok: true }>(`/bond/friends/${id}`, { status }),
  unfriend: (userId: string) => del<{ ok: true }>(`/bond/friends/${userId}`),
  chats: (pq = '') => request<{ page: Page; chats: BondChat[] }>(withQ('/bond/chats', pq)),
  openChat: (body: { userId?: string; groupId?: string; alias?: string }) => post<{ chat: BondChat }>('/bond/chats', body),
  // chat channels: /community/channels (public, made by guides) and /bond/channels (private, made for friends)
  channels: (scope: ChannelScope, pq = '', all = false) => request<{ page: Page; channels: Channel[]; canCreate: boolean }>(withQ(`/${scope}/channels${all ? '?all=1' : ''}`, pq)),
  channelsUnread: (scope: ChannelScope) => request<{ unread: number }>(`/${scope}/channels/unread`),
  channel: (scope: ChannelScope, id: string) => request<{ channel: Channel; members: ChannelMember[] }>(`/${scope}/channels/${id}`),
  createChannel: (scope: ChannelScope, body: { name: string; topic: string }) => post<{ channel: Channel | null }>(`/${scope}/channels`, body),
  changeChannel: (scope: ChannelScope, id: string, body: { name?: string; topic?: string }) => patch<{ channel: Channel | null }>(`/${scope}/channels/${id}`, body),
  closeChannel: (scope: ChannelScope, id: string, archived: boolean) => post<{ channel: Channel | null }>(`/${scope}/channels/${id}/archive`, { archived }),
  joinChannel: (scope: ChannelScope, id: string) => post<{ channel: Channel | null }>(`/${scope}/channels/${id}/join`),
  leaveChannel: (scope: ChannelScope, id: string) => post<{ ok: true }>(`/${scope}/channels/${id}/leave`),
  inviteToChannel: (id: string, userId: string) => post<{ ok: true }>(`/bond/channels/${id}/members`, { userId }),
  removeFromChannel: (id: string, userId: string) => del<{ ok: true }>(`/bond/channels/${id}/members/${userId}`),
  channelLines: (scope: ChannelScope, id: string, q: { after?: number; before?: number; from?: number; read?: boolean } = {}) => {
    const p = new URLSearchParams();
    if (q.after) p.set('after', String(q.after));
    if (q.before) p.set('before', String(q.before));
    if (q.after && q.from) p.set('from', String(q.from));
    if (q.read) p.set('read', '1');
    return request<{ lines: ChannelLine[]; more: boolean; gone: number[] }>(withQ(`/${scope}/channels/${id}/messages`, p.toString()));
  },
  channelSay: (scope: ChannelScope, id: string, body: string, opts: { anonymous?: boolean; replyTo?: string | null } = {}) => post<{ line: ChannelLine | null }>(`/${scope}/channels/${id}/messages`, { body, ...opts }),
  channelUnsay: (scope: ChannelScope, id: string, mid: string) => del<{ ok: true }>(`/${scope}/channels/${id}/messages/${mid}`),
  channelReport: (scope: ChannelScope, id: string, mid: string, note = '') => post<{ ok: true }>(`/${scope}/channels/${id}/messages/${mid}/report`, { note }),
  channelBlockAuthor: (scope: ChannelScope, id: string, mid: string) => post<{ ok: true }>(`/${scope}/channels/${id}/messages/${mid}/block-author`),
  chat: (id: string) => request<{ chat: BondChat; messages: BondMessage[] }>(`/bond/chats/${id}`),
  chatSay: (id: string, body: string) => post<{ ok: true; id: string }>(`/bond/chats/${id}/messages`, { body }),
  block: (userId: string, reason?: string) => post<{ ok: true }>('/bond/block', { userId, reason }),

  // tools
  tools: (pq = '') => request<{ page: Page; tools: Tool[]; categories: readonly string[]; reviewer: boolean }>(withQ('/tools', pq)),
  suggestTool: (body: { name: string; url: string; category?: string; description?: string; affiliate?: boolean; minPoints?: number; minXp?: number; badge?: string }) => post<{ ok: true; id: string; verified: boolean }>('/tools', body),
  setTool: (id: string, body: { verified?: boolean; affiliate?: boolean; featured?: boolean; minPoints?: number; minXp?: number; badge?: string }) => post<{ ok: true }>(`/tools/${id}`, body),
  market: (pq = '') => request<MarketResponse>(withQ('/market', pq)),
  marketListing: (id: string) => request<ListingDetail>(`/market/listings/${id}`),
  marketSell: (body: Record<string, unknown>) => post<{ listing: PreownedListing }>('/market/listings', body),
  marketUpdateListing: (id: string, body: Record<string, unknown>) => patch<{ listing: PreownedListing }>(`/market/listings/${id}`, body),
  marketSold: (id: string, cents: number | null) => post<{ listing: PreownedListing }>(`/market/listings/${id}/sold`, { cents }),
  marketRemoveListing: (id: string) => del<{ ok: true }>(`/market/listings/${id}`),
  marketOffer: (id: string, cents: number, note: string) => post<{ offer: PreownedOffer }>(`/market/listings/${id}/offers`, { cents, note }),
  marketDecide: (offerId: string, action: 'accept' | 'decline' | 'withdraw') => post<{ offer: PreownedOffer; listing: PreownedListing }>(`/market/offers/${offerId}`, { action }),
  marketMessages: (id: string, buyerId?: string) => request<{ messages: PreownedMessage[] }>(`/market/listings/${id}/messages${buyerId ? `?buyerId=${encodeURIComponent(buyerId)}` : ''}`),
  marketSend: (id: string, body: string, buyerId?: string) => post<{ message: PreownedMessage }>(`/market/listings/${id}/messages`, { body, buyerId }),
  marketAddItem: (body: Record<string, unknown>) => post<{ item: StoreItem }>('/market/items', body),
  marketUpdateItem: (id: string, body: Record<string, unknown>) => patch<{ item: StoreItem }>(`/market/items/${id}`, body),
  marketRemoveItem: (id: string) => del<{ ok: true }>(`/market/items/${id}`),
  marketAddKit: (body: Record<string, unknown>) => post<{ kit: StoreKit }>('/market/kits', body),
  marketUpdateKit: (id: string, body: Record<string, unknown>) => patch<{ kit: StoreKit }>(`/market/kits/${id}`, body),
  marketRemoveKit: (id: string) => del<{ ok: true }>(`/market/kits/${id}`),
  marketFeature: (type: 'item' | 'kit' | 'listing' | 'tool', id: string) => post<{ featuredUntil: string; paid: number }>('/market/feature', { type, id }),
  removeTool: (id: string) => del<{ ok: true }>(`/tools/${id}`),

  // tv and fund proposals
  proposals: (kind: 'tv' | 'fund', pq = '') => request<{ page: Page; proposals: Proposal[]; reviewer: boolean }>(withQ(`/proposals?kind=${kind}`, pq)),
  propose: (body: { kind: 'tv' | 'fund'; title: string; pitch: string; budgetAmount?: number; currency?: string }) => post<{ ok: true; id: string }>('/proposals', body),
  moveProposal: (id: string, body: { stage: Proposal['stage']; note?: string }) => post<{ ok: true }>(`/proposals/${id}/stage`, body),
  editProposal: (id: string, body: { title: string; pitch: string; budgetAmount: number }) => patch<{ ok: true }>(`/proposals/${id}`, body),
  withdrawProposal: (id: string) => post<{ ok: true }>(`/proposals/${id}/withdraw`, {}),

  // help
  support: (pq = '') => request<{ tickets: SupportTicket[]; page?: Page; queue: SupportTicket[]; queuePage?: Page; agent: boolean }>(withQ('/support', pq)),
  openTicket: (body: { subject: string; body: string }) => post<{ ok: true }>('/support', body),
  replyTicket: (id: string, body: { reply: string; status?: SupportTicket['status'] }) => post<{ ok: true }>(`/support/${id}/reply`, body),

  // growth: links, content, Auto-DM, funnels, sequences
  links: (pq = '') => request<{ page: Page; links: TrackedLink[] }>(withQ('/studio/links', pq)),
  createLink: (body: { productId?: string | null; sourceType?: TrackedLink['sourceType']; contentItemId?: string | null; label?: string }) => post<{ link: TrackedLink }>('/studio/links', body),
  deleteLink: (id: string) => del<{ ok: true }>(`/studio/links/${id}`),
  content: (sort: 'revenue' | 'views' | 'recent' = 'revenue', pq = '') => request<{ page: Page; items: ContentItem[]; direct: { sales: number; revenuePoints: number } }>(withQ(`/studio/content?sort=${sort}`, pq)),
  addContent: (body: { url: string; kind?: ContentItem['kind']; caption?: string; views?: number; productId?: string | null; withLink?: boolean }) => post<{ item: ContentItem | null; why: string }>('/studio/content', body),
  refreshContent: (id: string, body?: { views: number; likes?: number; comments?: number }) => post<{ item: ContentItem | null; why: string }>(`/studio/content/${id}/refresh`, body ?? {}),
  deleteContent: (id: string) => del<{ ok: true }>(`/studio/content/${id}`),
  automations: (dsq = '') => request<{ automations: DmAutomation[]; sends: DmSend[]; sendPage: Page; metaConnected: boolean }>(withQ('/studio/automations', dsq)),
  createAutomation: (body: { contentItemId?: string | null; keywords: string[]; dmMessage: string; publicReplies?: string[]; productId?: string | null }) => post<{ automation: DmAutomation | null }>('/studio/automations', body),
  setAutomation: (id: string, active: boolean) => patch<{ ok: true }>(`/studio/automations/${id}`, { active }),
  deleteAutomation: (id: string) => del<{ ok: true }>(`/studio/automations/${id}`),
  simulateComment: (id: string, body: { comment: string; handle?: string }) => post<{ matched: number }>(`/studio/automations/${id}/simulate`, body),
  funnels: () => request<{ funnels: Funnel[] }>('/studio/funnels'),
  createFunnel: (body: { name: string; steps: FunnelStep[] }) => post<{ funnel: Funnel | null }>('/studio/funnels', body),
  deleteFunnel: (id: string) => del<{ ok: true }>(`/studio/funnels/${id}`),
  sequences: () => request<{ sequences: Sequence[] }>('/studio/sequences'),
  createSequence: (body: { productId?: string | null; delayDays: number; title: string; body: string }) => post<{ sequence: Sequence | null }>('/studio/sequences', body),
  setSequence: (id: string, active: boolean) => patch<{ ok: true }>(`/studio/sequences/${id}`, { active }),
  deleteSequence: (id: string) => del<{ ok: true }>(`/studio/sequences/${id}`),
  // the strategy session
  session: (date: string) => request<SessionResponse>(`/session?date=${date}`),
  submitAssessment: (body: { placements: Placement[]; fears: Fear[]; insecurities: Insecurity[]; scores: Scores; behaviour: Partial<Record<RelationshipKey, number>>; realDay: RealDay; away?: RelationshipKey[] }) => post<SessionResponse & { suggestedFocus: RelationshipKey[] }>('/session/assessment', body),
  /** Set love, teachers or faith aside on the map (not part of my life right now), or bring it back. */
  setSessionAway: (relationship: RelationshipKey, away: boolean, date: string) => put<SessionResponse>('/session/away', { relationship, away, date }),
  submitPlan: (body: { focus: RelationshipKey[]; practices: Practices; contract: Pick<Contract, 'minDays' | 'checkinTime' | 'penalty' | 'signedName'>; date: string }) => post<SessionResponse>('/session/plan', body),
  markRoutineDay: (body: { date: string; dayType: DayType; steps: string[]; blocks?: BlockKey[] }) => post<SessionResponse>('/session/day', body),
  /** The live call with a coach: the open ask, and a yes that keeps the ask and, only while payments are live, the order to pay it. */
  liveCall: () => request<{ request: LiveCallRequest | null; live: boolean }>('/session/call'),
  askLiveCall: () => post<LiveCallAnswer>('/session/call', {}),
  updateRoutine: (body: { date: string; general?: RoutineBlock[]; exceptional?: RoutineBlock[] }) => patch<SessionResponse>('/session/routine', body),

  // content strategist: brand folders
  brands: (pq = '') => request<{ page: Page; brands: Brand[]; tools: BrandDetail['tools'] }>(withQ('/studio/brands', pq)),
  createBrand: (body: { name: string; niche?: string; description?: string; voice?: string }) => post<{ brand: Brand }>('/studio/brands', body),
  brand: (id: string, pq = '') => request<BrandDetail>(withQ(`/studio/brands/${id}`, pq)),
  updateBrand: (id: string, body: { name?: string; niche?: string; description?: string; voice?: string }) => patch<{ brand: Brand }>(`/studio/brands/${id}`, body),
  deleteBrand: (id: string) => del<{ ok: true }>(`/studio/brands/${id}`),
  addBrandSource: (id: string, body: { url: string; label?: string; kind?: BrandSource['kind'] }) => post<{ source: BrandSource }>(`/studio/brands/${id}/sources`, body),
  removeBrandSource: (id: string, sid: string) => del<{ ok: true }>(`/studio/brands/${id}/sources/${sid}`),
  readBrandSource: (id: string, sid: string) => post<{ run: ResearchRun | null; source: BrandSource | null }>(`/studio/brands/${id}/sources/${sid}/read`, {}),
  researchBrand: (id: string, body: { kind: ResearchKind; query: string; limit?: number }) => post<{ run: ResearchRun | null }>(`/studio/brands/${id}/research`, body),
  removeBrandRun: (id: string, rid: string) => del<{ ok: true }>(`/studio/brands/${id}/runs/${rid}`),
  writePiece: (id: string, body: { kind: PieceKind; brief: string; runIds?: string[]; research?: boolean }) => post<{ piece: BrandPiece | null }>(`/studio/brands/${id}/pieces`, body),
  updatePiece: (id: string, pid: string, body: { title?: string; body?: string; status?: BrandPiece['status'] }) => patch<{ piece: BrandPiece | null }>(`/studio/brands/${id}/pieces/${pid}`, body),
  removePiece: (id: string, pid: string) => del<{ ok: true }>(`/studio/brands/${id}/pieces/${pid}`),

  customers: (pq = '') => request<{ page: Page; customers: Customer[] }>(withQ('/studio/customers', pq)),
  customersCsvUrl: '/api/studio/customers?format=csv',
  refund: (orderId: string, reason: string) => post<{ order: Order | null }>(`/studio/orders/${orderId}/refund`, { reason }),
  payouts: (poq = '') => request<PayoutSummary & { page: Page }>(withQ('/studio/payouts', poq)),
  dmRequests: (pq = '') => request<{ requests: DmRequest[]; answeredPage: Page }>(withQ('/studio/dm', pq)),
  answerDm: (id: string, answer: string) => post<{ ok: true }>(`/studio/dm/${id}/answer`, { answer }),

  // circles and life
  circles: (query = '') => request<{ events: CircleEvent[]; eventsPage: Page; hosting: CircleEvent[]; hostingPage: Page; groups: CircleGroup[]; groupsPage: Page; city: string; area: string; interests: string[]; hasLocation: boolean; canCreate: boolean }>(`/circles${query ? `?${query}` : ''}`),
  createCircle: (body: { title: string; city: string; area?: string; startsAt: string; venueHint?: string; groupSize?: number; repeat?: 'none' | 'weekly'; attendeeXp?: number; attendeeCode?: string }) => post<{ event: CircleEvent; codeError: string | null }>('/circles/events', body),
  setCircleCode: (id: string, change: CodeChange) => put<{ hostCode: AttendeeCodeHost }>(`/circles/events/${id}/attendee-code`, change),
  claimCircleCode: (id: string, code: string) => post<{ xp: number; newBadges: string[] }>(`/circles/events/${id}/claim`, { code }),
  joinCircle: (id: string, status: CircleStatus, note?: string) => post<{ ok: true; status: CircleStatus }>(`/circles/events/${id}/join`, { status, note }),
  leaveCircle: (id: string) => del<{ ok: true }>(`/circles/events/${id}/join`),
  matchCircle: (id: string) => post<{ groups: number; unmatched: number }>(`/circles/events/${id}/match`),
  circleGroup: (id: string) => request<{ group: CircleGroup; opensInMinutes: number; attendee: AttendeeCodeView | null }>(`/circles/groups/${id}`),
  circleSay: (id: string, body: string) => post<{ ok: true; id: string }>(`/circles/groups/${id}/messages`, { body }),
  circlePlan: (id: string, body: { venue?: string; plan?: string }) => post<{ ok: true }>(`/circles/groups/${id}/plan`, body),
  life: () => request<LifeSummary>(`/life?day=${todayLocal()}`),

  // finance
  /** One month in Finance; the month's entries page with prefix tx and the dues with prefix du. */
  finance: (month?: string, txq = '', duq = '') => request<FinanceSummary & { txPage: Page; duePage: Page }>(withQ(withQ(`/finance${month ? `?month=${month}` : ''}`, txq), duq)),
  addTransaction: (body: { kind: 'income' | 'expense'; amountCents: number; currency?: string; category: string; counterparty?: string; note?: string; date?: string; splits?: FinanceSplit[] }) => post<{ transaction: FinanceTransaction }>('/finance/transactions', body),
  updateTransaction: (id: string, body: { counterparty?: string; note?: string; splits?: FinanceSplit[] }) => patch<{ transaction: FinanceTransaction }>(`/finance/transactions/${id}`, body),
  addDue: (body: { direction: 'owe' | 'owed'; counterparty: string; amountCents: number; currency?: string; category?: string; note?: string; dueDate?: string | null; recurring?: 'none' | 'monthly' }) => post<{ due: FinanceDue }>('/finance/dues', body),
  settleDue: (id: string, day: string) => post<{ ok: true }>(`/finance/dues/${id}/settle?day=${day}`),
  deleteDue: (id: string) => del<{ ok: true }>(`/finance/dues/${id}`),
  addRecurring: (body: { kind: 'income' | 'expense'; amountCents: number; currency?: string; category: string; counterparty?: string; note?: string; dayOfMonth: number }) => post<{ recurring: FinanceRecurring }>('/finance/recurring', body),
  setRecurring: (id: string, active: boolean) => patch<{ ok: true }>(`/finance/recurring/${id}`, { active }),
  deleteRecurring: (id: string) => del<{ ok: true }>(`/finance/recurring/${id}`),
  runRecurring: () => post<{ posted: number }>('/finance/recurring/run'),
  addGoal: (body: { title: string; kind: 'save' | 'earn'; targetCents: number; deadline?: string | null }) => post<{ ok: true; id: string }>('/finance/goals', body),
  addToGoal: (id: string, cents: number) => post<{ ok: true }>(`/finance/goals/${id}/add`, { cents }),
  deleteGoal: (id: string) => del<{ ok: true }>(`/finance/goals/${id}`),
  deleteTransaction: (id: string) => del<{ ok: true }>(`/finance/transactions/${id}`),
  setBudgets: (budgets: { category: string; monthlyCents: number }[]) => request<{ ok: true }>('/finance/budgets', { method: 'PUT', body: JSON.stringify({ budgets }) }),
  createInvoice: (body: { clientName: string; clientEmail?: string; items: InvoiceItem[]; dueDate?: string | null; note?: string; currency?: string }) => post<{ invoice: Invoice }>('/finance/invoices', body),
  setInvoice: (id: string, status: Invoice['status']) => patch<{ invoice: Invoice }>(`/finance/invoices/${id}`, { status }),
  deleteInvoice: (id: string) => del<{ ok: true }>(`/finance/invoices/${id}`),

  // staff
  // Coaching. The coach's side and the directory are under /coach; the student's side, and answers either way, under /me/coach.
  coachHub: (query = '') => request<CoachHub>(`/coach${query ? `?${query}` : ''}`),
  coachDirectory: (pq = '') => request<{ page: Page; coaches: CoachDirectoryEntry[] }>(withQ('/coach/directory', pq)),
  saveCoachProfile: (body: { about?: string; open?: boolean }) => put<{ profile: CoachProfile }>('/coach/profile', body),
  askToCoach: (about: string) => post<{ profile: CoachProfile }>('/coach/apply', { about }),
  askStudent: (who: string) => post<CoachAskResult>('/coach/requests', { who }),
  coachLookup: (who: string) => request<CoachLookup>(`/coach/lookup?who=${encodeURIComponent(who)}`),
  coachInvite: (action: 'on' | 'fresh' | 'off') => post<{ invite: string | null }>('/coach/invite', { action }),
  coachReport: (id: string, kind: string, date: string) => request<CoachReport>(`/coach/students/${id}/report?kind=${kind}&date=${date}`),
  coachPatterns: (id: string) => request<CoachPatternsAnswer>(`/coach/students/${id}/patterns`),
  coachAskPatterns: (id: string) => post<{ ok: true; askedAt: string; askAgainFrom: string }>(`/coach/students/${id}/patterns/ask`),
  coachPrefs: () => request<CoachPrefs>('/me/coach/prefs'),
  saveCoachPrefs: (body: Partial<CoachPrefs>) => put<CoachPrefs>('/me/coach/prefs', body),
  coachJoinState: (token: string) => request<CoachJoinState>(`/me/coach/join/${encodeURIComponent(token)}`),
  coachJoin: (token: string, share: CoachShare) => post<{ link: CoachLink | null }>(`/me/coach/join/${encodeURIComponent(token)}`, { share }),
  askCoach: (coachId: string) => post<{ link: CoachLink }>(`/coach/ask/${coachId}`),
  coachStudent: (id: string, query = '') => request<CoachStudentView>(`/coach/students/${id}${query ? `?${query}` : ''}`),
  coachNote: (studentId: string, body: string) => post<{ ok: true; id: string }>(`/coach/students/${studentId}/notes`, { body }),
  removeCoachNote: (studentId: string, noteId: string) => del<{ ok: true }>(`/coach/students/${studentId}/notes/${noteId}`),
  coachAddTask: (studentId: string, body: CoachTaskInput) => post<{ node: Node }>(`/coach/students/${studentId}/tasks`, body),
  coachEditTask: (studentId: string, taskId: string, body: Partial<Omit<CoachTaskInput, 'parentId'>>) => patch<{ node: Node }>(`/coach/students/${studentId}/tasks/${taskId}`, body),
  myCoach: (query = '') => request<MyCoachResponse & { linksPage: Page }>(`/me/coach${query ? `?${query}` : ''}`),
  myCoachLog: (pq = '') => request<{ log: CoachLogEntry[]; logPage: Page }>(withQ('/me/coach/log', pq)),
  answerCoach: (linkId: string, yes: boolean) => post<{ link: CoachLink | null }>(`/me/coach/links/${linkId}/answer`, { yes }),
  endCoach: (linkId: string) => del<{ ok: true }>(`/me/coach/links/${linkId}`),
  shareWithCoach: (linkId: string, share: Partial<CoachShare>) => patch<{ link: CoachLink | null }>(`/me/coach/links/${linkId}/share`, share),
  manageOverview: () =>
    request<{
      permissions: Permission[];
      queues: { campaigns: number; applications: number; tickets: number; clubApplied: number; bountyQueue: number; proposals: number; assignments: number; coachAsks: number };
      members: number;
      newThisWeek: number;
      postsThisWeek: number;
      hiddenPosts: number;
      resources: number;
      drafts: number;
      activeToday: number;
    }>('/manage/overview'),
  members: (q: string, pq = '') => request<{ page: Page; members: { id: string; name: string; handle: string | null; role: Role; xp: number; streak: number; isPro: boolean; createdAt: string; lastCheckin: string | null }[] }>(withQ(`/manage/members?q=${encodeURIComponent(q)}`, pq)),
  manageResources: (pq = '') => request<{ page: Page; resources: Resource[] }>(withQ('/manage/resources', pq)),
  createResource: (body: Partial<Resource>) => post<{ resource: Resource }>('/manage/resources', body),
  updateResource: (id: string, body: Partial<Resource>) => patch<{ resource: Resource }>(`/manage/resources/${id}`, body),
  deleteResource: (id: string) => del<{ ok: true }>(`/manage/resources/${id}`),
  hidePost: (id: string, hidden: boolean, reason?: string) => post<{ post: CommunityPost }>(`/manage/community/posts/${id}`, { hidden, reason }),
};

export interface DiscountList {
  page: Page;
  codes: AdminDiscountCode[];
  totals: { codes: number; live: number; redemptions: number; givenPoints: number; givenCents: { currency: string; cents: number }[] };
}
/** What the create sheet sends: the percent and the amounts are what was typed, and the server reads their digits. */
export interface DiscountInput {
  code?: string;
  kind: 'percent' | 'fixed';
  percent?: string;
  amount?: string;
  currency?: string;
  areas: DiscountArea[];
  itemId?: string;
  minAmount?: string;
  maxUses?: string;
  perPersonLimit?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  note?: string;
}

/** Admin calls use the shared key when given; an admin's own session also works. */
/** Exported for the lazy screens that keep their own calls out of the first download (lib/connectApi.ts). */
export async function adminRequest<T>(key: string, path: string, init: RequestInit = {}): Promise<T> {
  const token = useSession.getState().token;
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(key ? { 'X-Admin-Key': key } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? res.statusText, res.status);
  }
  return (await res.json()) as T;
}

export const adminApi = {
  users: (key: string, q: string, pq = '') => adminRequest<{ page: Page; users: AdminUser[] }>(key, withQ(`/users?q=${encodeURIComponent(q)}`, pq)),
  setPro: (key: string, id: string, pro: boolean) => adminRequest<{ user: AdminUser }>(key, `/users/${id}/pro`, { method: 'POST', body: JSON.stringify({ pro }) }),
  deleteUser: (key: string, id: string) => adminRequest<{ ok: true }>(key, `/users/${id}`, { method: 'DELETE' }),
  setRole: (key: string, id: string, role: Role) => adminRequest<{ user: AdminUser }>(key, `/users/${id}/role`, { method: 'POST', body: JSON.stringify({ role }) }),
  grantHonor: (key: string, id: string, honor: string, note: string) => adminRequest<{ user: AdminUser }>(key, `/users/${id}/honors`, { method: 'POST', body: JSON.stringify({ key: honor, note }) }),
  revokeHonor: (key: string, id: string, honor: string) => adminRequest<{ user: AdminUser }>(key, `/users/${id}/honors/${honor}`, { method: 'DELETE' }),
  addXp: (key: string, id: string, amount: number, note: string) => adminRequest<{ user: AdminUser }>(key, `/users/${id}/xp`, { method: 'POST', body: JSON.stringify({ amount, note }) }),
  grantBadge: (key: string, id: string, badge: string, note: string) => adminRequest<{ user: AdminUser }>(key, `/users/${id}/badges`, { method: 'POST', body: JSON.stringify({ key: badge, note }) }),
  revokeBadge: (key: string, id: string, badge: string) => adminRequest<{ user: AdminUser }>(key, `/users/${id}/badges/${badge}`, { method: 'DELETE' }),
  addPoints: (key: string, id: string, amount: number, note: string) => adminRequest<{ user: AdminUser }>(key, `/users/${id}/points`, { method: 'POST', body: JSON.stringify({ amount, note }) }),
  setPlan: (key: string, id: string, plan: PlanKey, days: number) => adminRequest<{ user: AdminUser }>(key, `/users/${id}/plan`, { method: 'POST', body: JSON.stringify({ plan, days }) }),
  houseTemplates: (key: string, pq = '') => adminRequest<{ page: Page; templates: HouseTemplate[] }>(key, withQ('/agency/templates', pq)),
  houseTemplateAdd: (key: string, body: { kind: TemplateKind; name: string; fromId: string; includeBusiness: boolean }) => adminRequest<{ id: string }>(key, '/agency/templates', { method: 'POST', body: JSON.stringify(body) }),
  houseTemplate: (key: string, id: string) => adminRequest<{ template: HouseTemplate; contract: ContractDoc | null; invoice: InvoiceDoc | null; items: InvoiceItem[] }>(key, `/agency/templates/${id}`),
  houseTemplateUpdate: (key: string, id: string, body: { name?: string; status?: 'active' | 'retired'; fromId?: string; includeBusiness?: boolean; body?: ContractDoc | InvoiceDoc; items?: InvoiceItem[]; ifUpdatedAt?: string }) => adminRequest<{ ok: true; updatedAt: string }>(key, `/agency/templates/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  discountCodes: (key: string, q: string, filters: { active?: string; area?: string }, pq = '') =>
    adminRequest<DiscountList>(key, withQ(`/discounts?q=${encodeURIComponent(q)}&active=${encodeURIComponent(filters.active ?? '')}&area=${encodeURIComponent(filters.area ?? '')}`, pq)),
  createDiscount: (key: string, body: DiscountInput) => adminRequest<{ code: AdminDiscountCode | null }>(key, '/discounts', { method: 'POST', body: JSON.stringify(body) }),
  updateDiscount: (key: string, id: string, body: Record<string, unknown>) => adminRequest<{ code: AdminDiscountCode | null }>(key, `/discounts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  bulkDiscounts: (key: string, ids: string[], active: boolean) => adminRequest<{ changed: number }>(key, '/discounts/bulk', { method: 'POST', body: JSON.stringify({ ids, active }) }),
  attendeeCodes: (key: string, app: string, q: string, pq = '') => adminRequest<{ page: Page; codes: AdminAttendeeCode[] }>(key, withQ(`/attendee-codes?app=${encodeURIComponent(app)}&q=${encodeURIComponent(q)}`, pq)),
  setAttendeeCode: (key: string, app: string, id: string, change: CodeChange) => adminRequest<{ code: AdminAttendeeCode | null }>(key, `/attendee-codes/${app}/${id}`, { method: 'PUT', body: JSON.stringify(change) }),
  coachAsks: (key: string, pq = '') => adminRequest<{ page: Page; asks: AdminCoachAsk[] }>(key, withQ('/coaching/asks', pq)),
  declineCoachAsk: (key: string, userId: string) => adminRequest<{ ok: true }>(key, `/coaching/asks/${userId}/decline`, { method: 'POST', body: '{}' }),
  coaches: (key: string, pq = '') => adminRequest<{ page: Page; coaches: { id: string; name: string; handle: string | null; email: string | null; students: number }[] }>(key, withQ('/coaching/coaches', pq)),
  coachLinks: (key: string, status: string, pq = '') => adminRequest<{ page: Page; links: AdminCoachLink[] }>(key, withQ(`/coaching/links?status=${encodeURIComponent(status)}`, pq)),
  linkCoach: (key: string, body: { coachId: string; student: string; mode: 'ask' | 'link' }) => adminRequest<{ link: AdminCoachLink | null }>(key, '/coaching/links', { method: 'POST', body: JSON.stringify(body) }),
  endCoachLink: (key: string, id: string) => adminRequest<{ ok: true }>(key, `/coaching/links/${id}`, { method: 'DELETE' }),
  addCredits: (key: string, id: string, credits: number, note: string) => adminRequest<{ user: AdminUser }>(key, `/users/${id}/credits`, { method: 'POST', body: JSON.stringify({ credits, note }) }),
  redemptions: (key: string, status?: string, pq = '') => adminRequest<{ page: Page; redemptions: AdminRedemption[] }>(key, withQ(`/redemptions${status ? `?status=${status}` : ''}`, pq)),
  setRedemption: (key: string, id: string, status: 'fulfilled' | 'cancelled') => adminRequest<{ redemption: Redemption }>(key, `/redemptions/${id}`, { method: 'POST', body: JSON.stringify({ status }) }),
  modules: (key: string) => adminRequest<{ settings: ModuleSetting[] }>(key, '/modules'),
  setModuleSetting: (key: string, moduleKey: string, body: { enabled?: boolean; minRole?: Role; rollout?: number }) => adminRequest<{ setting: ModuleSetting }>(key, `/modules/${moduleKey}`, { method: 'POST', body: JSON.stringify(body) }),
  setPermissions: (key: string, id: string, permissions: Permission[]) => adminRequest<{ user: AdminUser }>(key, `/users/${id}/permissions`, { method: 'POST', body: JSON.stringify({ permissions }) }),
  flags: (key: string, pq = '') => adminRequest<{ settings: ModuleSetting[]; page: Page; overrides: FlagOverride[]; overrideCounts: Record<string, number> }>(key, withQ('/flags', pq)),
  addOverride: (key: string, moduleKey: string, body: { subjectType: FlagOverride['subjectType']; subjectId: string; enabled: boolean; expiresAt?: string | null; reason?: string }) =>
    adminRequest<{ override: FlagOverride }>(key, `/flags/${moduleKey}/overrides`, { method: 'POST', body: JSON.stringify(body) }),
  removeOverride: (key: string, id: string) => adminRequest<{ ok: true }>(key, `/flags/overrides/${id}`, { method: 'DELETE' }),
  previewAccess: (key: string, userId: string) => adminRequest<{ name: string; role: Role; access: Record<string, ModuleAccess> }>(key, `/flags/preview/${userId}`),
  audit: (key: string, pq = '') => adminRequest<{ page: Page; logs: AuditLog[] }>(key, withQ('/audit', pq)),
  listings: (key: string, type?: ListingType, q = '', pq = '') => adminRequest<{ page: Page; listings: Listing[] }>(key, withQ(`/listings?${new URLSearchParams({ ...(type ? { type } : {}), q })}`, pq)),
  createListing: (key: string, body: Record<string, unknown> & { type: ListingType; title: string }) => adminRequest<{ listing: Listing | null }>(key, '/listings', { method: 'POST', body: JSON.stringify(body) }),
  setListing: (key: string, type: ListingType, id: string, body: { live?: boolean; featured?: boolean }) => adminRequest<{ listing: Listing }>(key, `/listings/${type}/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  orders: (key: string, q: string, status = '', pq = '') => adminRequest<{ page: Page; orders: AdminOrder[] }>(key, withQ(`/orders?${new URLSearchParams({ q, ...(status ? { status } : {}) })}`, pq)),
  order: (key: string, id: string) => adminRequest<{ order: AdminOrder; timeline: OrderEvent[]; webhooks: WebhookEvent[] }>(key, `/orders/${id}`),
  refundOrder: (key: string, id: string, reason: string) => adminRequest<{ order: AdminOrder | null }>(key, `/orders/${id}/refund`, { method: 'POST', body: JSON.stringify({ reason }) }),
  webhooks: (key: string, pq = '') => adminRequest<{ page: Page; webhooks: WebhookEvent[] }>(key, withQ('/webhooks', pq)),
  replayWebhook: (key: string, id: string) => adminRequest<{ outcome: string }>(key, `/webhooks/${id}/replay`, { method: 'POST', body: '{}' }),
  kycQueue: (key: string, status = 'pending', pq = '') => adminRequest<{ page: Page; kyc: AdminKyc[] }>(key, withQ(`/kyc?status=${status}`, pq)),
  decideKyc: (key: string, userId: string, body: { status: 'approved' | 'rejected'; note?: string }) => adminRequest<{ ok: true }>(key, `/kyc/${userId}`, { method: 'POST', body: JSON.stringify(body) }),
  outbox: (key: string, pq = '') => adminRequest<{ page: Page; outbox: OutboxEmail[] }>(key, withQ('/outbox', pq)),
  funnels: (key: string) => adminRequest<{ funnels: AdminFunnel[] }>(key, '/funnels'),
};

/** The public site. No session needed, and none is sent. */
/** A client link, an agreement or an invoice that has a password also needs the unlock the browser kept for this tab (lib/portalSession.ts). */
const portalHeaders = (): Record<string, string> => {
  const kept = portalSessionHeader();
  return kept ? { 'X-Portal-Session': kept } : {};
};

async function publicRequest<T>(path: string): Promise<T> {
  const res = await fetch(`/api/public${path}`, { headers: portalHeaders() });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? res.statusText, res.status, body);
  }
  return (await res.json()) as T;
}

async function publicSend<T>(method: 'POST' | 'PUT', path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/public${path}`, { method, headers: { 'Content-Type': 'application/json', ...portalHeaders() }, body: JSON.stringify(body) });
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(b.error ?? res.statusText, res.status, b);
  }
  return (await res.json()) as T;
}

/**
 * The team link's own calls (the client page for the client's own team). They send only the team link's unlock, in its own header, and
 * never the client link's: the two are kept apart in the browser as on the server.
 */
async function teamLinkCall<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const kept = teamLinkSessionHeader();
  const res = await fetch(`/api/public/team-link${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(kept ? { 'X-Team-Link-Session': kept } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(b.error ?? res.statusText, res.status, b);
  }
  return (await res.json()) as T;
}
export const teamLinkApi = {
  page: (token: string) => teamLinkCall<TeamLinkView>('GET', `/${encodeURIComponent(token)}`),
  unlock: (token: string, password: string) => teamLinkCall<{ open: boolean; session: string | null; expiresAt: string | null }>('POST', `/${encodeURIComponent(token)}/unlock`, { password }),
  decide: (token: string, id: string, body: { decision: 'approve' | 'changes' | 'comment'; note?: string; where?: string }) => teamLinkCall<{ ok: true }>('POST', `/${encodeURIComponent(token)}/items/${id}`, body),
};

/** The three kinds of client-facing link that can sit behind a client's password, by their public path. */
export type LockedLink = 'contracts' | 'invoices' | 'agency/doc';

/** What emailing a copy answered: whether it went, and a plain sentence when it did not. */
export interface EmailCopyResult {
  ok: true;
  sent: boolean;
  note: string;
  linkIncluded: boolean;
  /** The address, masked. */
  to: string;
}

/** What the client sees on an invoice link: the invoice with what was switched off removed, and its thread. */
export interface PublicInvoice {
  invoice: Invoice;
  canComment: boolean;
  canDownload: boolean;
  comments: DocComment[];
}

export const publicApi = {
  coachJoinCard: (token: string) => publicRequest<CoachJoinCard>(`/coach-join/${encodeURIComponent(token)}`),
  portal: (token: string) => publicRequest<PortalView>(`/agency/${encodeURIComponent(token)}`),
  portalDecide: (token: string, id: string, body: { decision: 'approve' | 'changes' | 'paid_change' | 'comment'; note?: string; where?: string }) => publicSend<{ ok: true }>('POST', `/agency/${encodeURIComponent(token)}/items/${id}`, body),
  portalUnlock: (token: string, password: string) => publicSend<{ open: boolean; session: string | null; expiresAt: string | null }>('POST', `/agency/${encodeURIComponent(token)}/unlock`, { password }),
  portalRetainer: (token: string, months: number) => publicSend<{ ok: true }>('POST', `/agency/${encodeURIComponent(token)}/retainer`, { months }),
  onboarding: (token: string) => publicRequest<{ draft: ClientOnboarding; questions: ContractQuestion[]; prefill: { brand: string; email: string }; done: boolean }>(`/agency/${encodeURIComponent(token)}/onboarding`),
  onboardingSave: (token: string, draft: ClientOnboarding) => publicSend<{ ok: true }>('PUT', `/agency/${encodeURIComponent(token)}/onboarding`, { draft }),
  onboardingSubmit: (token: string, draft: ClientOnboarding) => publicSend<{ ok: true; contract: 'sent' | 'draft' | null; contractToken: string | null }>('POST', `/agency/${encodeURIComponent(token)}/onboarding/submit`, { draft }),
  /** The ask for a new password, from the lock screen of a client page, an agreement, an invoice or a document. The same answer whatever the link. */
  passwordRequest: (kind: 'agency' | 'contract' | 'invoice' | 'doc' | 'team', token: string, reason: string) => publicSend<{ ok: true }>('POST', '/agency/password-request', { kind, token, reason }),
  linkLock: (kind: LockedLink, token: string) => publicRequest<{ locked: boolean; clientName?: string; agencyName?: string; agencyLogo?: string }>(`/${kind}/${encodeURIComponent(token)}/lock`),
  linkUnlock: (kind: LockedLink, token: string, password: string) => publicSend<{ open: boolean; session: string | null; expiresAt: string | null }>('POST', `/${kind}/${encodeURIComponent(token)}/unlock`, { password }),
  contract: (token: string) => publicRequest<PublicContract>(`/contracts/${encodeURIComponent(token)}`),
  /** The brief's answers, saved as the client types, while the agreement is sent (409 once it is signed). */
  contractAnswers: (token: string, answers: Record<string, ContractAnswer>) => publicSend<{ ok: true }>('PUT', `/contracts/${encodeURIComponent(token)}/answers`, { answers }),
  contractAccept: (token: string, body: { name: string; title: string; agree: boolean; answers: Record<string, ContractAnswer> }) => publicSend<{ ok: true }>('POST', `/contracts/${encodeURIComponent(token)}/accept`, body),
  agencyDoc: (token: string) => publicRequest<PublicAgencyDoc>(`/agency/doc/${encodeURIComponent(token)}`),
  agencyDocApprove: (token: string, body: { name: string; title: string; agree: boolean; answers: Record<string, ContractAnswer> }) => publicSend<{ ok: true }>('POST', `/agency/doc/${encodeURIComponent(token)}/approve`, body),
  agencyDocComment: (token: string, text: string) => publicSend<{ ok: true }>('POST', `/agency/doc/${encodeURIComponent(token)}/comments`, { body: text }),
  contractComment: (token: string, text: string) => publicSend<{ ok: true }>('POST', `/contracts/${encodeURIComponent(token)}/comments`, { body: text }),
  invoiceComment: (token: string, text: string) => publicSend<{ ok: true }>('POST', `/invoices/${encodeURIComponent(token)}/comments`, { body: text }),
  explore: (opts: { q?: string; type?: ListingType; featured?: boolean; pq?: string } = {}) =>
    publicRequest<{ page: Page; listings: Listing[] }>(`/explore?${new URLSearchParams({ ...(opts.q ? { q: opts.q } : {}), ...(opts.type ? { type: opts.type } : {}), ...(opts.featured ? { featured: '1' } : {}), ...(opts.pq ? Object.fromEntries(new URLSearchParams(opts.pq)) : {}) })}`),
  listing: (type: ListingType, id: string) => publicRequest<{ listing: Listing }>(`/explore/${type}/${id}`),
  stats: () => publicRequest<PublicStats>('/explore/stats'),
  /** Whether a new account needs an invite code right now (the Invite only switch in Admin, Invites). */
  join: () => publicRequest<{ inviteOnly: boolean }>('/join'),
  /** The upcoming public events (the /events page), a page at a time. */
  events: (pq = '') => publicRequest<{ page: Page; events: PublicEvent[] }>(`/events${pq ? `?${pq}` : ''}`),
  /** One public event's story, for its landing page. */
  publicEvent: (id: string) => publicRequest<{ event: PublicEvent }>(`/events/${encodeURIComponent(id)}`),
  certificate: (code: string) => publicRequest<{ certificate: Certificate }>(`/certificates/${encodeURIComponent(code)}`),
  invoice: (token: string) => publicRequest<PublicInvoice>(`/invoices/${encodeURIComponent(token)}`),
  config: () => publicRequest<PaymentsConfig>('/config'),
};
