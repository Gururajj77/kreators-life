import type { AppPrefs, ConsentChoices } from '@kreators/shared';
import type { AdminDiscountCode, DiscountArea, DiscountCheck } from '@kreators/shared';
import type { ActivityYear, BadgesResponse, Page, Unlock } from '@kreators/shared';
import type { Channel, ChannelLine, ChannelMember, ChannelScope } from '@kreators/shared';
import { todayLocal } from './date';
import { portalSessionHeader, teamLinkSessionHeader } from './portalSession';
import { agencyTeamHeader, markAgencyTeamGone } from './agencyWorkspace';
import type { MyTeam, TeamAccess, TeamMember, TeamRole } from '@kreators/shared';
import type { AgencyStageKey, LifecycleDates, RetainerOption } from '@kreators/shared';
import type { AdminAttendeeCode, AttendeeCodeHost, AttendeeCodeView } from '@kreators/shared';
import type { AssistantContext, AssistantReceipt, AssistantReply, AssistantStatus, AssistantTurn, CompanionReply, CompanionStatus, CreditEntry, CreditsResponse, FeelingsReadResult, PlanKey } from '@kreators/shared';
import type { Brand, BrandDetail, BrandPiece, BrandSource, PieceKind, ResearchKind, ResearchRun } from '@kreators/shared';
import type { Contract, DayType, Fear, Insecurity, Placement, Practices, RealDay, RoutineBlock, Scores, SessionResponse } from '@kreators/shared';
import type { FeedFilter, FeedSort, SocialAward, TrustScore } from '@kreators/shared';
import type { ListingDetail, MarketResponse, PreownedListing, PreownedMessage, PreownedOffer, StoreItem, StoreKit } from '@kreators/shared';
import type { PeriodKind, Review, ReviewCalendarResponse, ReviewSummary, ReviewTemplate, ReviewsResponse } from '@kreators/shared';
import type { NotToDo, NotToDoStatus } from '@kreators/shared';
import type { InsightsResponse } from '@kreators/shared';
import type { SetupMatch } from '@kreators/shared';
import type { CardGamePlay, CardGamesResponse, DiscoverAnswers, DiscoverResult, FocusMode, FocusResponse, FocusRoundRow, FocusTask, FocusView, LogsResponse } from '@kreators/shared';
import type { DailyBrief, GettingStarted, InboxShow, InboxTab, ReactionKind } from '@kreators/shared';
import type { AdminCoachAsk, AdminCoachLink, CoachDirectoryEntry, CoachHub, CoachLink, CoachLogEntry, CoachProfile, CoachShare, CoachStudentView, CoachTaskInput, MyCoachResponse } from '@kreators/shared';
import type { CustomReminder, RemindersResponse, WaterState, BlockedPerson, EventApp, EventExtras, LinkBlock, MediaItem, MediaOwner } from '@kreators/shared';
import type { ObservabilityResponse } from '@kreators/shared';
import type { AgencyDocFull, AgencyDocKind, AgencyDocListItem, DocLogLine, HouseTemplate, PublicAgencyDoc, RetainerInput } from '@kreators/shared';
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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

/** The words of an error for a person to read: the server's own line when there is one, else the fallback. */
export function errorText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

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
/** What an attendee code change asks for: a new xp (before the event starts), the host's own code, or a fresh random one. */
type CodeChange = { xp?: number; code?: string; fresh?: boolean };

export const api = {
  // accounts
  anon: (ref?: string | null) => post<{ token: string; user: User }>('/auth/anon', { ref }),
  signup: (body: { email: string; password: string; displayName?: string; phone: string; birthDate: string; acceptTerms: boolean }) => post<{ token: string; user: User }>('/auth/signup', body),
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
    avatarUrl?: string;
    socials?: Socials;
      publicSettings?: Partial<PublicSettings>;
      links?: LinkBlock[];
  }) => patch<{ user: User }>('/me', body),
  exportMe: () => request<Record<string, unknown>>('/me/export'),
  deleteMe: () => request<{ ok: true }>('/me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }),
  trackEvent: (name: TrackedEvent, props?: Record<string, unknown>) => post<{ ok: true }>('/me/events', { name, props }),
  portfolio: () => request<{ items: PortfolioItem[] }>('/me/portfolio'),
  addPortfolio: (body: { title: string; url: string; description?: string; visibility?: 'public' | 'private' }) => post<{ item: PortfolioItem }>('/me/portfolio', body),
  removePortfolio: (id: string) => del<{ ok: true }>(`/me/portfolio/${id}`),
  setModule: (key: string, on: boolean) => patch<{ modules: Record<string, boolean> }>('/me/modules', { key, on }),
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
  today: (date: string) => request<TodayResponse>(`/today?date=${date}`),
  /** Emerging: patterns from the person's own rows. `app` asks for the cards one place shows; `rel` for a pillar page. */
  /** Emerging: the person's whole list for their day; each place picks its share on the device (`insightsForPlace`). */
  insights: (day: string) => request<InsightsResponse>(`/insights?day=${day}`),
  todayMonth: (month: string, day: string) => request<TodayMonthResponse>(`/today/month?month=${month}&day=${day}`),
  home: (date: string, hour: number) => request<HomeResponse>(`/home?date=${date}&hour=${hour}`),
  checkin: (date: string) => post<CheckinResponse>('/today/checkin', { date }),
  notToDoAdd: (title: string, relationship: RelationshipKey | null) => post<{ item: NotToDo }>('/today/not-to-do', { title, relationship }),
  notToDoDay: (id: string, date: string, today: string, status: NotToDoStatus | null) => post<{ item: NotToDo; awarded: number }>(`/today/not-to-do/${id}/day`, { date, today, status }),
  notToDoRemove: (id: string) => del<{ ok: true }>(`/today/not-to-do/${id}`),
  dayType: (date: string, today: string) => request<DayTypeResponse>(`/today/day-type?date=${date}&today=${today}`),
  setDayType: (date: string, today: string, kind: DayTypeKey | null) => put<DayTypeResponse>('/today/day-type', { date, today, kind }),
  reviews: (kind: PeriodKind, date: string) => request<ReviewsResponse>(`/reviews?kind=${kind}&date=${date}`),
  reviewSummary: (kind: PeriodKind, date: string) => request<ReviewSummary>(`/reviews/summary?kind=${kind}&date=${date}`),
  saveReview: (body: { kind: PeriodKind; date: string; templateId: string | null; answers: string[]; rating: number | null; highlight: string }) => request<{ review: Review }>('/reviews', { method: 'PUT', body: JSON.stringify(body) }),
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
  agencyItems: (q = '') => request<{ page: AgencyPage; items: AgencyDeliverable[]; counts: Record<DeliverableStage, number> }>(withQ(`/agency/items?day=${todayLocal()}`, q)),
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
  agencyContractRestore: (id: string) => post<{ contract: AgencyContract; restoredTo: AgencyContract['status'] }>(`/agency/contracts/${id}/restore`),
  agencyComments: (type: DocType, id: string) => request<{ comments: DocComment[] }>(`/agency/comments/${type}/${id}`),
  agencyCommentAdd: (type: DocType, id: string, body: string) => post<{ ok: true }>(`/agency/comments/${type}/${id}`, { body }),
  agencyCommentRemove: (id: string) => del<{ ok: true }>(`/agency/comments/${id}`),
  agencyEmailCopy: (type: 'invoices' | 'contracts' | 'docs', id: string, body: { to?: string; message?: string; subject?: string } = {}) => post<EmailCopyResult>(`/agency/${type}/${id}/email`, body),
  agencyDocLog: (type: DocType, id: string) => request<{ log: DocLogLine[] }>(`/agency/doc-log/${type}/${id}`),
  agencyDocs: (q = '') => request<{ page: AgencyPage; docs: AgencyDocListItem[]; counts: { status: string; n: number }[] }>(withQ('/agency/docs', q)),
  agencyDoc: (id: string) => request<{ doc: AgencyDocFull }>(`/agency/docs/${id}`),
  agencyDocAdd: (body: { kind?: AgencyDocKind; clientId?: string | null; templateId?: string; houseId?: string; month?: string; retainer?: Partial<RetainerInput> }) => post<{ id: string }>(`/agency/docs?day=${todayLocal()}`, body),
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
  leaderboardOptions: () => request<LeaderboardOptions>('/leaderboard/options'),
  leaderboardBlocks: () => request<{ blocks: LeaderboardBlock[] }>('/leaderboard/blocks'),
  rewards: (pq = '') => request<RewardsResponse & { redemptionsPage?: Page }>(withQ('/rewards', pq)),
  redeem: (key: string) => post<{ redemption: Redemption; points: number; game?: string }>(`/rewards/${key}/redeem`),
  node: (id: string) => request<{ node: Node }>(`/nodes/${id}`),
  focusTasks: (q = '') => request<{ tasks: FocusTask[] }>(`/wellbeing/focus/tasks${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  focusSettings: () => request<{ settings: FocusSettings | null }>('/wellbeing/focus-settings'),
  saveFocusSettings: (settings: FocusSettings) => put<{ settings: FocusSettings }>('/wellbeing/focus-settings', { settings }),
  focusQuality: (id: string, quality: number | null) => patch<{ ok: true }>(`/wellbeing/focus/${id}`, { quality }),
  weekPlan: (date: string, hours?: number) => request<{ plan: WeekPlan }>(`/today/week-plan?date=${date}${hours ? `&hours=${hours}` : ''}`),
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
  log: (kind: LogKind, body: { date?: string; value: number; extra?: Record<string, unknown>; note?: string }) => post<{ log: WellbeingLog; summary: WellbeingSummary }>(`/wellbeing/${kind}`, body),
  deleteLog: (kind: LogKind, id: string) => del<{ ok: true }>(`/wellbeing/${kind}/${id}`),
  journalDay: (date: string) => request<{ entries: JournalEntry[] }>(`/journal?date=${date}&size=100`),
  journalDays: (month: string) => request<{ days: { date: string; count: number; emotion: number | null }[] }>(`/journal/days?month=${month}`),
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
  archiveNote: (id: string, archived: boolean) => post<{ ok: true }>(`/inbox/${id}/archive`, { archived }),
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
  reply: (id: string, body: string, opts: { anonymous?: boolean; parentId?: string | null } = {}) => post<{ reply: CommunityReply; awarded: SocialAward }>(`/community/${id}/replies`, { body, ...opts }),
  blockPostAuthor: (id: string) => post<{ ok: true }>(`/community/posts/${id}/block-author`),
  blockReplyAuthor: (id: string) => post<{ ok: true }>(`/community/replies/${id}/block-author`),
  followUser: (id: string) => post<{ following: boolean; followers: number; awarded: SocialAward }>(`/community/follow/${id}`),
  deletePost: (id: string) => del<{ ok: true }>(`/community/${id}`),
  search: (q: string) => request<SearchResults>(`/search?q=${encodeURIComponent(q)}`),

  // storefront, buyer side
  publicPage: (handle: string) => request<PublicPage>(`/public/${encodeURIComponent(handle)}`),
  personPage: (id: string) => request<PublicPage>(`/public/people/${encodeURIComponent(id)}`),
  publicProduct: (id: string) => request<{ product: Product; lessonCount: number; testimonials: Testimonial[]; owned: boolean; seller: { trust: TrustScore }; unlock: Unlock }>(`/public/products/${id}`),
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
  library: (pq = '') => request<{ page: Page; orders: Order[]; products: Product[]; bookings: Booking[] }>(withQ('/store/library', pq)),
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
  createLesson: (productId: string, body: Partial<Lesson>) => post<{ lesson: Lesson }>(`/studio/products/${productId}/lessons`, body),
  updateLesson: (id: string, body: Partial<Lesson>) => patch<{ lesson: Lesson }>(`/studio/lessons/${id}`, body),
  deleteLesson: (id: string) => del<{ ok: true }>(`/studio/lessons/${id}`),
  coupons: () => request<{ coupons: Coupon[] }>('/studio/coupons'),
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
    request<{ page: Page; followers: { name: string; handle: string | null; since: string }[]; broadcasts: { id: string; title: string; body: string; audience: string; sent: number; createdAt: string }[]; referralCode: string | null; referred: number; affiliateShare: number }>(withQ('/studio/audience', pq)),


  // organizations (brands)
  orgs: (all = false) => request<{ organizations: Organization[] }>(`/orgs${all ? '?all=1' : ''}`),
  createOrg: (body: { name: string; type?: Organization['type'] }) => post<{ organization: Organization }>('/orgs', body),
  orgMembers: (id: string) => request<{ members: OrganizationMember[] }>(`/orgs/${id}/members`),
  addOrgMember: (id: string, email: string) => post<{ ok: true }>(`/orgs/${id}/members`, { email }),
  removeOrgMember: (id: string, userId: string) => del<{ ok: true }>(`/orgs/${id}/members/${userId}`),

  // army: brand campaigns
  army: (pq = '') => request<{ page: Page; campaigns: Campaign[]; assignments: CampaignAssignment[]; staff: boolean }>(withQ('/army', pq)),
  createCampaign: (body: Partial<Campaign> & { organizationId: string; name: string }) => post<{ campaign: Campaign }>('/army/campaigns', body),
  campaign: (id: string) => request<{ campaign: Campaign; deliverables: Deliverable[]; assignments: CampaignAssignment[]; events: CampaignEvent[]; who: 'staff' | 'brand' | 'creator' }>(`/army/campaigns/${id}`),
  updateCampaign: (id: string, body: Partial<Campaign> & { ownerId?: string }) => patch<{ campaign: Campaign }>(`/army/campaigns/${id}`, body),
  addDeliverable: (campaignId: string, body: { title: string; format?: string; platform?: string; dueAt?: string }) => post<{ ok: true; id: string }>(`/army/campaigns/${campaignId}/deliverables`, body),
  assignCreator: (campaignId: string, body: { creator: string; role?: string; feeAmount?: number; currency?: string }) => post<{ ok: true; id: string }>(`/army/campaigns/${campaignId}/assignments`, body),
  answerAssignment: (id: string, status: 'accepted' | 'declined' | 'done') => post<{ ok: true }>(`/army/assignments/${id}`, { status }),
  uploadVersion: (deliverableId: string, body: { url: string; note?: string }) => post<{ ok: true; id: string }>(`/army/deliverables/${deliverableId}/versions`, body),
  reviewVersion: (versionId: string, body: { status: 'approved' | 'changes'; comment?: string }) => post<{ ok: true }>(`/army/versions/${versionId}/review`, body),
  setCampaignPublic: (id: string, isPublic: boolean) => post<{ ok: true }>(`/win/campaigns/${id}/public`, { public: isPublic }),

  // school
  school: (pq = '') => request<{ page: Page; programs: Program[]; myCohorts: Cohort[]; managed: Cohort[]; staff: boolean; mentor: boolean }>(withQ('/school', pq)),
  createProgram: (body: Partial<Program> & { name: string }) => post<{ ok: true; id: string }>('/school/programs', body),
  updateProgram: (id: string, body: Partial<Program>) => patch<{ ok: true }>(`/school/programs/${id}`, body),
  addLearningItem: (programId: string, body: { moduleTitle: string; contentType?: LearningItem['contentType']; contentRef?: string; body?: string }) => post<{ ok: true }>(`/school/programs/${programId}/items`, body),
  addAssignment: (programId: string, body: { title: string; instructions?: string; rubric?: string; dueDays?: number }) => post<{ ok: true }>(`/school/programs/${programId}/assignments`, body),
  openCohort: (programId: string, body: { name: string; startAt: string; endAt: string; capacity?: number }) => post<{ ok: true; id: string }>(`/school/programs/${programId}/cohorts`, body),
  enroll: (cohortId: string, pay?: 'test', discountCode?: string) => post<{ ok: true; id: string }>(`/school/cohorts/${cohortId}/enroll`, { ...(pay ? { pay } : {}), ...(discountCode ? { discountCode } : {}) }),
  cohort: (id: string) =>
    request<{ cohort: Cohort; items: LearningItem[]; assignments: CourseAssignment[]; submissions: Submission[]; sessions: CohortSession[]; enrollments: Enrollment[]; manager: boolean; mentor: boolean; myProgress: Enrollment['progress'] | null; myStatus: Enrollment['status'] | null }>(`/school/cohorts/${id}`),
  submitAssignment: (assignmentId: string, body: { cohortId: string; url?: string; text?: string }) => post<{ ok: true }>(`/school/assignments/${assignmentId}/submit`, body),
  giveFeedback: (submissionId: string, body: { comment: string; status: 'approved' | 'changes'; grade?: string }) => post<{ ok: true }>(`/school/submissions/${submissionId}/feedback`, body),
  scheduleSession: (cohortId: string, body: { title: string; startsAt: string; minutes?: number; onlineUrl?: string }) => post<{ ok: true }>(`/school/cohorts/${cohortId}/sessions`, body),
  attend: (sessionId: string, userId?: string) => post<{ ok: true }>(`/school/sessions/${sessionId}/attendance`, userId ? { userId } : {}),
  completeEnrollment: (id: string) => post<{ ok: true }>(`/school/enrollments/${id}/complete`),

  // work
  work: (pq = '', draftPq = '') => request<{ page: Page; opportunities: Opportunity[]; applications: Application[]; draftPage: Page; drafts: Opportunity[]; canPost: boolean }>(withQ(withQ('/work', pq), draftPq)),
  createOpportunity: (body: Partial<Opportunity> & { title: string }) => post<{ ok: true; id: string }>('/work/opportunities', body),
  opportunity: (id: string, pq = '') => request<{ opportunity: Opportunity; page: Page; applications: Application[]; owner: boolean }>(withQ(`/work/opportunities/${id}`, pq)),
  setOpportunity: (id: string, status: Opportunity['status'], clubOnly?: boolean) => patch<{ ok: true }>(`/work/opportunities/${id}`, clubOnly === undefined ? { status } : { status, clubOnly }),
  apply: (id: string, coverNote: string) => post<{ application: Application }>(`/work/opportunities/${id}/apply`, { coverNote }),
  setApplication: (id: string, body: { status: Application['status']; note?: string }) => post<{ ok: true }>(`/work/applications/${id}`, body),

  // party
  party: (pq = '') => request<{ page: Page; events: PartyEvent[]; hosting: PartyEvent[]; canHostAll: boolean; club: boolean }>(withQ('/party', pq)),
  createEvent: (body: Partial<PartyEvent> & { title: string; startsAt: string; minutes?: number; attendeeXp?: number; attendeeCode?: string }) => post<{ event: PartyEvent; codeError: string | null }>('/party/events', body),
  event: (id: string, pq = '') => request<{ event: PartyEvent; registrations: EventRegistration[]; registrationsPage?: Page | null; host: boolean; feedback: { average: number | null; count: number }; hostCode: AttendeeCodeHost | null; attendee: AttendeeCodeView | null }>(withQ(`/party/events/${id}`, pq)),
  setEventCode: (id: string, change: CodeChange) => put<{ hostCode: AttendeeCodeHost }>(`/party/events/${id}/attendee-code`, change),
  claimEventCode: (id: string, code: string) => post<{ xp: number; newBadges: string[] }>(`/party/events/${id}/claim`, { code }),
  rsvp: (id: string, networking: boolean, discountCode?: string) => post<{ status: EventRegistration['status'] }>(`/party/events/${id}/rsvp`, { networking, ...(discountCode ? { discountCode } : {}) }),
  cancelRsvp: (id: string) => post<{ ok: true }>(`/party/events/${id}/cancel-rsvp`),
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
  win: (pq = '', queuePq = '') => request<{ page: Page; bounties: Bounty[]; mine: BountySubmission[]; queuePage: Page; queue: BountySubmission[]; earned: number; reviewer: boolean; finance: boolean; canCreate: boolean }>(withQ(withQ('/win', pq), queuePq)),
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
  friends: (pq = '') => request<{ page: Page; open: Friend[]; friends: Friend[] }>(withQ('/bond/friends', pq)),
  addFriend: (userId: string) => post<{ ok: true; status: 'sent' | 'friends' }>('/bond/friends', { userId }),
  reminders: (day: string) => request<RemindersResponse>(`/reminders?day=${day}`),
  legal: () => request<LegalState>('/me/legal'),
  saveConsent: (choices: ConsentChoices, source: 'popup' | 'profile') => put<LegalState>('/me/legal/consent', { choices, source }),
  acceptTerms: () => post<LegalState>('/me/legal/accept'),
  unsubscribe: (token: string) => post<{ ok: boolean }>(`/public/unsubscribe/${encodeURIComponent(token)}`),
  drinkWater: (day: string, ml?: number) => post<{ water: WaterState }>('/reminders/water', { day, ...(ml ? { ml } : {}) }),
  undoWater: (day: string) => del<{ water: WaterState }>(`/reminders/water?day=${day}`),
  waterSettings: (day: string, s: Partial<{ on: boolean; goalMl: number; glassMl: number; everyMin: number; from: string; to: string }>) => put<{ water: WaterState }>('/reminders/water/settings', { day, ...s }),
  addReminder: (r: { title: string; time: string; days: number[] }) => post<{ reminder: CustomReminder }>('/reminders/custom', r),
  changeReminder: (id: string, r: Partial<{ title: string; time: string; days: number[]; enabled: boolean }>) => patch<{ reminder: CustomReminder }>(`/reminders/custom/${id}`, r),
  removeReminder: (id: string) => del<{ ok: true }>(`/reminders/custom/${id}`),
  blocks: (pq = '') => request<{ page: Page; blocked: BlockedPerson[] }>(withQ('/bond/blocks', pq)),
  unblock: (userId: string) => del<{ ok: true }>(`/bond/block/${userId}`),
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
  markRoutineDay: (body: { date: string; dayType: DayType; steps: string[] }) => post<SessionResponse>('/session/day', body),
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
  dmRequests: () => request<{ requests: DmRequest[] }>('/studio/dm'),
  answerDm: (id: string, answer: string) => post<{ ok: true }>(`/studio/dm/${id}/answer`, { answer }),

  // circles and life
  circles: (query = '') => request<{ events: CircleEvent[]; hosting: CircleEvent[]; hostingPage: Page; groups: CircleGroup[]; city: string; area: string; interests: string[]; hasLocation: boolean; canCreate: boolean }>(`/circles${query ? `?${query}` : ''}`),
  createCircle: (body: { title: string; city: string; area?: string; startsAt: string; venueHint?: string; groupSize?: number; repeat?: 'none' | 'weekly'; attendeeXp?: number; attendeeCode?: string }) => post<{ event: CircleEvent; codeError: string | null }>('/circles/events', body),
  setCircleCode: (id: string, change: CodeChange) => put<{ hostCode: AttendeeCodeHost }>(`/circles/events/${id}/attendee-code`, change),
  claimCircleCode: (id: string, code: string) => post<{ xp: number; newBadges: string[] }>(`/circles/events/${id}/claim`, { code }),
  joinCircle: (id: string, status: CircleStatus, note?: string) => post<{ ok: true; status: CircleStatus }>(`/circles/events/${id}/join`, { status, note }),
  leaveCircle: (id: string) => del<{ ok: true }>(`/circles/events/${id}/join`),
  matchCircle: (id: string) => post<{ groups: number; unmatched: number }>(`/circles/events/${id}/match`),
  circleGroup: (id: string) => request<{ group: CircleGroup; opensInMinutes: number; attendee: AttendeeCodeView | null }>(`/circles/groups/${id}`),
  circleSay: (id: string, body: string) => post<{ ok: true; id: string }>(`/circles/groups/${id}/messages`, { body }),
  circlePlan: (id: string, body: { venue?: string; plan?: string }) => post<{ ok: true }>(`/circles/groups/${id}/plan`, body),
  life: () => request<LifeSummary>('/life'),

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
  askStudent: (who: string) => post<{ link: CoachLink }>('/coach/requests', { who }),
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
async function adminRequest<T>(key: string, path: string, init: RequestInit = {}): Promise<T> {
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
  certificate: (code: string) => publicRequest<{ certificate: Certificate }>(`/certificates/${encodeURIComponent(code)}`),
  invoice: (token: string) => publicRequest<PublicInvoice>(`/invoices/${encodeURIComponent(token)}`),
  config: () => publicRequest<PaymentsConfig>('/config'),
};
