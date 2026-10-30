/**
 * Every rate limit in the app, in one place. Change a number here and it changes everywhere.
 * A limit counts hits per window: by the signed-in person, or by the address on the doors that
 * take no session. Going over answers 429 "too many tries, wait a minute".
 */
export const LIMITS = {
  // Doors without a session, counted per address.
  signin: { max: 10, windowSec: 60 },
  /** Per email, whatever the address, on top of the per-address limit. */
  signinEmail: { max: 20, windowSec: 900 },
  signup: { max: 10, windowSec: 3600 },
  forgot: { max: 10, windowSec: 3600 },
  /** Per email: a reset link goes out at most this often. */
  forgotEmail: { max: 3, windowSec: 3600 },
  reset: { max: 20, windowSec: 3600 },
  anon: { max: 60, windowSec: 3600 },
  lead: { max: 5, windowSec: 60 },
  // Signed in, counted per person.
  checkout: { max: 10, windowSec: 60 },
  post: { max: 10, windowSec: 3600 },
  reply: { max: 30, windowSec: 3600 },
  like: { max: 120, windowSec: 3600 },
  follow: { max: 60, windowSec: 3600 },
  /** Chat messages: Bond, circle tables and pre-owned listings. */
  message: { max: 120, windowSec: 3600 },
  /** Friend requests, introductions and new chats. */
  intro: { max: 20, windowSec: 3600 },
  offer: { max: 20, windowSec: 3600 },
  /** Things a person puts up: listings, products, events, clubs, opportunities, proposals, rewards. */
  create: { max: 30, windowSec: 3600 },
  ticket: { max: 5, windowSec: 3600 },
  /** Applications and entries: Work, Win, Club, collabs. */
  apply: { max: 10, windowSec: 3600 },
  /** Run entries with a start code. */
  entry: { max: 10, windowSec: 3600 },
  /** Content research runs: reads, searches, outliers, transcripts. Each one reaches out to another site. */
  research: { max: 40, windowSec: 3600 },
  /** Pieces the strategist writes. Each one is a model call. */
  generate: { max: 20, windowSec: 3600 },
  /** The setup chat's save: tags, goals and the apps that come on. */
  setup: { max: 20, windowSec: 3600 },
  /** Attendee codes typed at an event: Party and Circles. Wrong guesses count, so a custom word cannot be guessed at. */
  claim: { max: 10, windowSec: 3600 },
  /** Water taps, and making or changing a reminder. */
  reminder: { max: 240, windowSec: 3600 },
  /** Pictures and GIFs a person uploads. */
  upload: { max: 30, windowSec: 3600 },
  /** Messages typed to the assistant. Each one is a model call paid in credits; the plan's own caps come on top. */
  assistant: { max: 60, windowSec: 3600 },
  /** Coaching asks: a coach asking a student, a student asking a coach, and asking the team to be made a life coach. */
  coachAsk: { max: 20, windowSec: 3600 },
  /** What a life coach writes for a student: notes, and tasks added or changed. */
  coachWrite: { max: 60, windowSec: 3600 },
} as const;

export type LimitName = keyof typeof LIMITS;

/** Which doors each limit guards: the method and the path under /api. Patterns follow Hono's. */
export const ROUTE_LIMITS: readonly { method: 'POST' | 'PATCH' | 'PUT' | 'DELETE'; path: string; limit: LimitName }[] = [
  { method: 'POST', path: '/auth/signin', limit: 'signin' },
  { method: 'POST', path: '/auth/signup', limit: 'signup' },
  { method: 'POST', path: '/auth/forgot', limit: 'forgot' },
  { method: 'POST', path: '/auth/reset', limit: 'reset' },
  { method: 'POST', path: '/auth/anon', limit: 'anon' },
  { method: 'POST', path: '/public/:handle/lead', limit: 'lead' },
  { method: 'POST', path: '/store/:productId/checkout', limit: 'checkout' },
  { method: 'POST', path: '/community', limit: 'post' },
  { method: 'POST', path: '/community/:id/replies', limit: 'reply' },
  { method: 'POST', path: '/community/:id/like', limit: 'like' },
  { method: 'POST', path: '/community/follow/:userId', limit: 'follow' },
  { method: 'POST', path: '/store/follow/:handle', limit: 'follow' },
  { method: 'POST', path: '/bond/chats/:id/messages', limit: 'message' },
  { method: 'POST', path: '/circles/groups/:id/messages', limit: 'message' },
  { method: 'POST', path: '/market/listings/:id/messages', limit: 'message' },
  { method: 'POST', path: '/bond/intros', limit: 'intro' },
  { method: 'POST', path: '/bond/friends', limit: 'intro' },
  { method: 'POST', path: '/bond/chats', limit: 'intro' },
  { method: 'POST', path: '/market/listings/:id/offers', limit: 'offer' },
  { method: 'POST', path: '/market/listings', limit: 'create' },
  { method: 'POST', path: '/studio/products', limit: 'create' },
  { method: 'POST', path: '/party/events', limit: 'create' },
  { method: 'POST', path: '/run/clubs', limit: 'create' },
  { method: 'POST', path: '/work/opportunities', limit: 'create' },
  { method: 'POST', path: '/proposals', limit: 'create' },
  { method: 'POST', path: '/win', limit: 'create' },
  { method: 'POST', path: '/support', limit: 'ticket' },
  { method: 'POST', path: '/work/opportunities/:id/apply', limit: 'apply' },
  { method: 'POST', path: '/win/:id/submit', limit: 'apply' },
  { method: 'POST', path: '/club/apply', limit: 'apply' },
  { method: 'POST', path: '/run/collabs/:id/apply', limit: 'apply' },
  { method: 'POST', path: '/run/runs/:id/entry', limit: 'entry' },
  { method: 'POST', path: '/studio/brands', limit: 'create' },
  { method: 'POST', path: '/assistant', limit: 'assistant' },
  { method: 'POST', path: '/party/events/:id/claim', limit: 'claim' },
  { method: 'POST', path: '/circles/events/:id/claim', limit: 'claim' },
  { method: 'POST', path: '/party/events/:id/duplicate', limit: 'create' },
  { method: 'POST', path: '/community/:id/follow-post', limit: 'follow' },
  { method: 'POST', path: '/community/replies/:id/react', limit: 'like' },
  { method: 'POST', path: '/coach/requests', limit: 'coachAsk' },
  { method: 'POST', path: '/coach/ask/:coachId', limit: 'coachAsk' },
  { method: 'POST', path: '/coach/apply', limit: 'coachAsk' },
  { method: 'POST', path: '/coach/students/:id/notes', limit: 'coachWrite' },
  { method: 'POST', path: '/coach/students/:id/tasks', limit: 'coachWrite' },
  { method: 'PATCH', path: '/coach/students/:id/tasks/:taskId', limit: 'coachWrite' },
  { method: 'POST', path: '/studio/brands/:id/sources/:sid/read', limit: 'research' },
  { method: 'POST', path: '/studio/brands/:id/research', limit: 'research' },
  { method: 'POST', path: '/studio/brands/:id/pieces', limit: 'generate' },
  { method: 'POST', path: '/onboarding/setup', limit: 'setup' },
  { method: 'POST', path: '/media/upload', limit: 'upload' },
  { method: 'POST', path: '/reminders/water', limit: 'reminder' },
  { method: 'PUT', path: '/reminders/water/settings', limit: 'reminder' },
  { method: 'POST', path: '/reminders/custom', limit: 'reminder' },
  { method: 'PATCH', path: '/reminders/custom/:id', limit: 'reminder' },
  { method: 'PUT', path: '/media/for/:type/:id', limit: 'create' },
  { method: 'POST', path: '/connect/:app/:id/messages', limit: 'message' },
  { method: 'POST', path: '/connect/:app/:id/people/:userId/connect', limit: 'intro' },
];

/** The doors that take no session are limited before the session check; everything else after it, per person. */
export const isOpenDoor = (path: string): boolean => path.startsWith('/auth/') || path.startsWith('/public/');
