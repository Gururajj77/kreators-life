import type { Page, Unlock } from '@kreators/shared';
import type { AdminAttendeeCode, AttendeeCodeHost, AttendeeCodeView } from '@kreators/shared';
import type { AssistantContext, AssistantReceipt, AssistantReply, AssistantStatus, AssistantTurn, CreditEntry, CreditsResponse, PlanKey } from '@kreators/shared';
import type { Brand, BrandDetail, BrandPiece, BrandSource, PieceKind, ResearchKind, ResearchRun } from '@kreators/shared';
import type { Contract, DayType, Fear, Insecurity, Placement, Practices, RealDay, RoutineBlock, Scores, SessionResponse } from '@kreators/shared';
import type { FeedFilter, FeedSort, SocialAward, TrustScore } from '@kreators/shared';
import type { ListingDetail, MarketResponse, PreownedListing, PreownedMessage, PreownedOffer, StoreItem, StoreKit } from '@kreators/shared';
import type { PeriodKind, Review, ReviewSummary, ReviewTemplate, ReviewsResponse } from '@kreators/shared';
import type { NotToDo, NotToDoStatus } from '@kreators/shared';
import type { SetupMatch } from '@kreators/shared';
import type { CardGamePlay, CardGamesResponse, DiscoverAnswers, DiscoverResult, FocusResponse, FocusTask, FocusView, LogsResponse } from '@kreators/shared';
import type { DailyBrief, GettingStarted, InboxShow, InboxTab, ReactionKind } from '@kreators/shared';
import type { AdminCoachAsk, AdminCoachLink, CoachDirectoryEntry, CoachHub, CoachLink, CoachLogEntry, CoachProfile, CoachShare, CoachStudentView, CoachTaskInput, MyCoachResponse } from '@kreators/shared';
import type { CustomReminder, RemindersResponse, WaterState, BlockedPerson, EventApp, EventExtras, LinkBlock, MediaItem, MediaOwner } from '@kreators/shared';
import type { ObservabilityResponse } from '@kreators/shared';
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
  FinanceGoal,
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
  Permission,
  PortfolioItem,
  Program,
  Proposal,
  PublicStats,
  Submission,
  SupportTicket,
  Tool,
  ChatMessage,
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
  Priority,
  Repeat,
  Subtask,
  TodayResponse,
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
      ...(init.headers ?? {}),
    },
  });
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
  dueTime?: string | null;
  estimateMin?: number | null;
}
const put = <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
/** What an attendee code change asks for: a new xp (before the event starts), the host's own code, or a fresh random one. */
type CodeChange = { xp?: number; code?: string; fresh?: boolean };

export const api = {
  // accounts
  anon: (ref?: string | null) => post<{ token: string; user: User }>('/auth/anon', { ref }),
  signup: (body: { email: string; password: string; displayName?: string; phone: string; birthDate: string }) => post<{ token: string; user: User }>('/auth/signup', body),
  signin: (body: { email: string; password: string }) => post<{ token: string; user: User }>('/auth/signin', body),
  signout: () => post<{ ok: true }>('/auth/signout'),
  /** Forgot the password: the answer is the same for any email. */
  forgot: (email: string) => post<{ ok: true; minutes: number }>('/auth/forgot', { email }),
  /** The reset link's token plus the new password. Signs every device out and this one in. */
  resetPassword: (token: string, password: string) => post<{ token: string; user: User }>('/auth/reset', { token, password }),
  /** Change the password: the current one, then the new one. Other sessions are signed out. */
  setPassword: (body: { current: string; password: string }) => post<{ ok: true }>('/me/password', body),
  me: () => request<MeResponse>('/me'),
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
  assistantConfirm: (id: string, date: string) => post<{ receipt: AssistantReceipt }>(`/assistant/actions/${id}/confirm`, { date }),
  assistantCancel: (id: string) => post<{ receipt: AssistantReceipt }>(`/assistant/actions/${id}/cancel`),
  assistantUndo: (id: string, date: string) => post<{ receipt: AssistantReceipt }>(`/assistant/actions/${id}/undo`, { date }),
  // plans and credits
  credits: () => request<CreditsResponse>('/credits'),
  creditLedger: (pq = '') => request<{ page: Page; entries: CreditEntry[] }>(withQ('/credits/ledger', pq)),
  creditCheckout: (kind: 'plan' | 'topup', key: string) => post<{ ok: true }>('/credits/checkout', { kind, key }),
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
  updateNode: (id: string, body: { title?: string; note?: string; status?: 'active' | 'archived' } & TaskPlanBody) => patch<{ node: Node }>(`/nodes/${id}`, body),
  subtasks: (id: string) => request<{ subtasks: Subtask[] }>(`/nodes/${id}/subtasks`),
  addSubtask: (id: string, title: string) => post<{ subtask: Subtask }>(`/nodes/${id}/subtasks`, { title }),
  editSubtask: (sid: string, body: { title?: string; done?: boolean }) => patch<{ subtask: Subtask }>(`/nodes/subtasks/${sid}`, body),
  deleteSubtask: (sid: string) => del<{ ok: boolean }>(`/nodes/subtasks/${sid}`),
  deleteNode: (id: string) => del<{ ok: true }>(`/nodes/${id}`),
  complete: (id: string, date?: string) => post<CompleteResponse>(`/nodes/${id}/complete`, date ? { date } : undefined),
  uncomplete: (id: string) => post<{ node: Node }>(`/nodes/${id}/uncomplete`),

  // daily
  today: (date: string) => request<TodayResponse>(`/today?date=${date}`),
  home: (date: string, hour: number) => request<HomeResponse>(`/home?date=${date}&hour=${hour}`),
  checkin: (date: string) => post<CheckinResponse>('/today/checkin', { date }),
  notToDoAdd: (title: string, relationship: RelationshipKey | null) => post<{ item: NotToDo }>('/today/not-to-do', { title, relationship }),
  notToDoDay: (id: string, date: string, today: string, status: NotToDoStatus | null) => post<{ item: NotToDo; awarded: number }>(`/today/not-to-do/${id}/day`, { date, today, status }),
  notToDoRemove: (id: string) => del<{ ok: true }>(`/today/not-to-do/${id}`),
  reviews: (kind: PeriodKind, date: string) => request<ReviewsResponse>(`/reviews?kind=${kind}&date=${date}`),
  reviewSummary: (kind: PeriodKind, date: string) => request<ReviewSummary>(`/reviews/summary?kind=${kind}&date=${date}`),
  saveReview: (body: { kind: PeriodKind; date: string; templateId: string | null; answers: string[]; rating: number | null; highlight: string }) => request<{ review: Review }>('/reviews', { method: 'PUT', body: JSON.stringify(body) }),
  deleteReview: (id: string) => del<{ ok: true }>(`/reviews/${id}`),
  reviewTemplateAdd: (body: { kind: PeriodKind; name: string; prompts: string[] }) => post<{ template: ReviewTemplate }>('/reviews/templates', body),
  reviewTemplateUpdate: (id: string, body: { name: string; prompts: string[] }) => patch<{ template: ReviewTemplate }>(`/reviews/templates/${id}`, body),
  reviewTemplateRemove: (id: string) => del<{ ok: true }>(`/reviews/templates/${id}`),
  spark: (date: string) => post<{ awarded: number; relationship: RelationshipKey; alreadyDone: boolean }>('/today/spark', { date }),

  // rank and rewards
  leaderboard: (by: LeaderboardSort, scope: LeaderboardScope = 'all', value = '', paging = '') => request<LeaderboardResponse>(`/leaderboard?by=${by}&scope=${scope}&value=${encodeURIComponent(value)}${paging ? `&${paging}` : ''}`),
  leaderboardOptions: () => request<LeaderboardOptions>('/leaderboard/options'),
  leaderboardBlocks: () => request<{ blocks: LeaderboardBlock[] }>('/leaderboard/blocks'),
  rewards: () => request<RewardsResponse>('/rewards'),
  redeem: (key: string) => post<{ redemption: Redemption; points: number; game?: string }>(`/rewards/${key}/redeem`),
  focusTasks: () => request<{ tasks: FocusTask[] }>('/wellbeing/focus/tasks'),
  logFocus: (minutes: number, nodeId: string | null, date: string) => post<{ ok: true; id: string }>('/wellbeing/focus', { minutes, date, ...(nodeId ? { nodeId } : {}) }),
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
  companion: () => request<{ messages: ChatMessage[]; model: string }>('/companion'),
  say: (body: string) => post<{ messages: ChatMessage[] }>('/companion', { body }),
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
  checkout: (productId: string, body: { coupon?: string; affiliate?: string | null; pay: 'points' | 'test' | 'money'; points?: number; question?: string; intake?: string[]; replay?: boolean; click?: string | null; src?: string | null }) =>
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
  studioProduct: (id: string) => request<{ product: Product; lessons: Lesson[]; orders: Order[]; bookings: Booking[]; testimonials: Testimonial[] }>(`/studio/products/${id}`),
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
  enroll: (cohortId: string, pay?: 'test') => post<{ ok: true; id: string }>(`/school/cohorts/${cohortId}/enroll`, pay ? { pay } : {}),
  cohort: (id: string) =>
    request<{ cohort: Cohort; items: LearningItem[]; assignments: CourseAssignment[]; submissions: Submission[]; sessions: CohortSession[]; enrollments: Enrollment[]; manager: boolean; mentor: boolean; myProgress: Enrollment['progress'] | null; myStatus: Enrollment['status'] | null }>(`/school/cohorts/${id}`),
  submitAssignment: (assignmentId: string, body: { cohortId: string; url?: string; text?: string }) => post<{ ok: true }>(`/school/assignments/${assignmentId}/submit`, body),
  giveFeedback: (submissionId: string, body: { comment: string; status: 'approved' | 'changes'; grade?: string }) => post<{ ok: true }>(`/school/submissions/${submissionId}/feedback`, body),
  scheduleSession: (cohortId: string, body: { title: string; startsAt: string; minutes?: number; onlineUrl?: string }) => post<{ ok: true }>(`/school/cohorts/${cohortId}/sessions`, body),
  attend: (sessionId: string, userId?: string) => post<{ ok: true }>(`/school/sessions/${sessionId}/attendance`, userId ? { userId } : {}),
  completeEnrollment: (id: string) => post<{ ok: true }>(`/school/enrollments/${id}/complete`),

  // work
  work: (pq = '') => request<{ page: Page; opportunities: Opportunity[]; applications: Application[]; drafts: Opportunity[]; canPost: boolean }>(withQ('/work', pq)),
  createOpportunity: (body: Partial<Opportunity> & { title: string }) => post<{ ok: true; id: string }>('/work/opportunities', body),
  opportunity: (id: string) => request<{ opportunity: Opportunity; applications: Application[]; owner: boolean }>(`/work/opportunities/${id}`),
  setOpportunity: (id: string, status: Opportunity['status'], clubOnly?: boolean) => patch<{ ok: true }>(`/work/opportunities/${id}`, clubOnly === undefined ? { status } : { status, clubOnly }),
  apply: (id: string, coverNote: string) => post<{ application: Application }>(`/work/opportunities/${id}/apply`, { coverNote }),
  setApplication: (id: string, body: { status: Application['status']; note?: string }) => post<{ ok: true }>(`/work/applications/${id}`, body),

  // party
  party: (pq = '') => request<{ page: Page; events: PartyEvent[]; hosting: PartyEvent[]; canHostAll: boolean; club: boolean }>(withQ('/party', pq)),
  createEvent: (body: Partial<PartyEvent> & { title: string; startsAt: string; minutes?: number; attendeeXp?: number; attendeeCode?: string }) => post<{ event: PartyEvent; codeError: string | null }>('/party/events', body),
  event: (id: string) => request<{ event: PartyEvent; registrations: EventRegistration[]; host: boolean; feedback: { average: number | null; count: number }; hostCode: AttendeeCodeHost | null; attendee: AttendeeCodeView | null }>(`/party/events/${id}`),
  setEventCode: (id: string, change: CodeChange) => put<{ hostCode: AttendeeCodeHost }>(`/party/events/${id}/attendee-code`, change),
  claimEventCode: (id: string, code: string) => post<{ xp: number; newBadges: string[] }>(`/party/events/${id}/claim`, { code }),
  rsvp: (id: string, networking: boolean) => post<{ status: EventRegistration['status'] }>(`/party/events/${id}/rsvp`, { networking }),
  cancelRsvp: (id: string) => post<{ ok: true }>(`/party/events/${id}/cancel-rsvp`),
  checkinGuest: (id: string, userId: string) => post<{ ok: true }>(`/party/events/${id}/checkin`, { userId }),
  eventFeedback: (id: string, body: { rating: number; comment?: string; networking?: boolean }) => post<{ ok: true }>(`/party/events/${id}/feedback`, body),
  setEvent: (id: string, status: 'published' | 'cancelled' | 'done') => patch<{ ok: true }>(`/party/events/${id}`, { status }),
  // kreators run
  run: (pq = '') => request<RunResponse>(withQ('/run', pq)),
  createRunClub: (body: { name: string; city: string; description?: string; pace?: RunPace; meets?: string; visibility?: 'public' | 'private' }) => post<{ club: RunClub | null }>('/run/clubs', body),
  runClub: (id: string) => request<RunClubDetail>(`/run/clubs/${id}`),
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

  // club
  club: (pq = '') => request<{ page: Page; benefits: typeof import('@kreators/shared').CLUB_BENEFITS; mine: Membership | null; queue: Membership[]; members: number; reviewer: boolean; staff: { id: string; name: string }[] }>(withQ('/club', pq)),
  setClubManager: (id: string, managerId: string | null) => post<{ ok: true }>(`/club/memberships/${id}/manager`, { managerId }),
  applyClub: (note: string) => post<{ ok: true }>('/club/apply', { note }),
  decideMembership: (id: string, body: { status: Membership['status']; note?: string; months?: number }) => post<{ ok: true }>(`/club/memberships/${id}`, body),

  // win: content rewards
  win: (pq = '') => request<{ page: Page; bounties: Bounty[]; mine: BountySubmission[]; queue: BountySubmission[]; earned: number; reviewer: boolean; finance: boolean; canCreate: boolean }>(withQ('/win', pq)),
  bounty: (id: string) => request<{ bounty: Bounty; submissions: BountySubmission[]; board: { name: string; views: number; status: string }[] }>(`/win/${id}`),
  createBounty: (body: Partial<Bounty> & { title: string; organizationId?: string }) => post<{ ok: true; id: string }>('/win', body),
  editBounty: (id: string, body: Partial<Bounty>) => patch<{ ok: true; version: number; changed: string[] }>(`/win/${id}`, body),
  submitBounty: (id: string, url: string) => post<{ submission: BountySubmission | null }>(`/win/${id}/submit`, { url }),
  reportMetrics: (submissionId: string, body?: { views: number; likes?: number; comments?: number; shares?: number; note?: string }) => post<{ submission: BountySubmission | null; why: string }>(`/win/submissions/${submissionId}/metrics`, body ?? {}),
  reviewBounty: (submissionId: string, body: { status: 'verified' | 'rejected' | 'paid'; evidenceViews?: number; evidenceNote?: string; payoutPoints?: number }) => post<{ ok: true; points?: number }>(`/win/submissions/${submissionId}/review`, body),
  disputeBounty: (submissionId: string, note: string) => post<{ ok: true }>(`/win/submissions/${submissionId}/dispute`, { note }),

  // bond
  bond: () => request<{ optedIn: boolean; intros: Introduction[]; suggestions: { userId: string; name: string; handle: string | null; skills: string[]; context: string }[] }>('/bond'),
  proposeIntro: (recipientId: string, context: string) => post<{ ok: true }>('/bond/intros', { recipientId, context }),
  answerIntro: (id: string, status: 'accepted' | 'declined') => post<{ ok: true }>(`/bond/intros/${id}`, { status }),
  friends: () => request<{ friends: Friend[] }>('/bond/friends'),
  addFriend: (userId: string) => post<{ ok: true; status: 'sent' | 'friends' }>('/bond/friends', { userId }),
  reminders: (day: string) => request<RemindersResponse>(`/reminders?day=${day}`),
  drinkWater: (day: string, ml?: number) => post<{ water: WaterState }>('/reminders/water', { day, ...(ml ? { ml } : {}) }),
  undoWater: (day: string) => del<{ water: WaterState }>(`/reminders/water?day=${day}`),
  waterSettings: (day: string, s: Partial<{ on: boolean; goalMl: number; glassMl: number; everyMin: number; from: string; to: string }>) => put<{ water: WaterState }>('/reminders/water/settings', { day, ...s }),
  addReminder: (r: { title: string; time: string; days: number[] }) => post<{ reminder: CustomReminder }>('/reminders/custom', r),
  changeReminder: (id: string, r: Partial<{ title: string; time: string; days: number[]; enabled: boolean }>) => patch<{ reminder: CustomReminder }>(`/reminders/custom/${id}`, r),
  removeReminder: (id: string) => del<{ ok: true }>(`/reminders/custom/${id}`),
  blocks: () => request<{ blocked: BlockedPerson[] }>('/bond/blocks'),
  unblock: (userId: string) => del<{ ok: true }>(`/bond/block/${userId}`),
  mutes: () => request<{ mutes: { userId: string; name: string; handle: string | null; reason: string; by: string; createdAt: string }[] }>('/community/mutes'),
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
  chats: () => request<{ chats: BondChat[] }>('/bond/chats'),
  openChat: (body: { userId?: string; groupId?: string; alias?: string }) => post<{ chat: BondChat }>('/bond/chats', body),
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

  // help
  support: () => request<{ tickets: SupportTicket[]; queue: SupportTicket[]; agent: boolean }>('/support'),
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
  automations: () => request<{ automations: DmAutomation[]; sends: DmSend[]; metaConnected: boolean }>('/studio/automations'),
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
  submitAssessment: (body: { placements: Placement[]; fears: Fear[]; insecurities: Insecurity[]; scores: Scores; behaviour: Partial<Record<RelationshipKey, number>>; realDay: RealDay }) => post<SessionResponse & { suggestedFocus: RelationshipKey[] }>('/session/assessment', body),
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
  payouts: () => request<PayoutSummary>('/studio/payouts'),
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
  finance: (month?: string) => request<FinanceSummary>(`/finance${month ? `?month=${month}` : ''}`),
  addTransaction: (body: { kind: 'income' | 'expense'; amountCents: number; currency?: string; category: string; counterparty?: string; note?: string; date?: string; splits?: FinanceSplit[] }) => post<{ transaction: FinanceTransaction }>('/finance/transactions', body),
  updateTransaction: (id: string, body: { counterparty?: string; note?: string; splits?: FinanceSplit[] }) => patch<{ transaction: FinanceTransaction }>(`/finance/transactions/${id}`, body),
  addDue: (body: { direction: 'owe' | 'owed'; counterparty: string; amountCents: number; currency?: string; category?: string; note?: string; dueDate?: string | null; recurring?: 'none' | 'monthly' }) => post<{ due: FinanceDue }>('/finance/dues', body),
  settleDue: (id: string) => post<{ ok: true }>(`/finance/dues/${id}/settle`),
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
  flags: (key: string) => adminRequest<{ settings: ModuleSetting[]; overrides: FlagOverride[] }>(key, '/flags'),
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
async function publicRequest<T>(path: string): Promise<T> {
  const res = await fetch(`/api/public${path}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? res.statusText, res.status);
  }
  return (await res.json()) as T;
}

export const publicApi = {
  explore: (opts: { q?: string; type?: ListingType; featured?: boolean; limit?: number } = {}) =>
    publicRequest<{ listings: Listing[] }>(`/explore?${new URLSearchParams({ ...(opts.q ? { q: opts.q } : {}), ...(opts.type ? { type: opts.type } : {}), ...(opts.featured ? { featured: '1' } : {}), ...(opts.limit ? { limit: String(opts.limit) } : {}) })}`),
  listing: (type: ListingType, id: string) => publicRequest<{ listing: Listing }>(`/explore/${type}/${id}`),
  stats: () => publicRequest<PublicStats>('/explore/stats'),
  certificate: (code: string) => publicRequest<{ certificate: Certificate }>(`/certificates/${encodeURIComponent(code)}`),
  invoice: (token: string) => publicRequest<{ invoice: Invoice }>(`/invoices/${encodeURIComponent(token)}`),
  config: () => publicRequest<PaymentsConfig>('/config'),
};
