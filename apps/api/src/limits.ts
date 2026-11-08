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
  /**
   * Guesses at the shared admin key (X-Admin-Key on /api/admin): ten in ten minutes, then even the right key waits. A right key takes its place
   * back and an admin's own session never takes one (`adminKeyDoor` in ops.ts). Ten, since the Admin screen opens with five calls at once.
   */
  adminKey: { max: 10, windowSec: 600 },
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
  /** "Read with AI" on the strategy session's map card. A model call paid in credits, a line at a time. */
  feelings: { max: 30, windowSec: 3600 },
  /** Lines typed to the Companion, on any path: the model, Workers AI or the rules. Stop is counted with them. */
  companion: { max: 60, windowSec: 3600 },
  /** Coaching asks: a coach asking a student, a student asking a coach, and asking the team to be made a life coach. */
  coachAsk: { max: 20, windowSec: 3600 },
  /** What a life coach writes for a student: notes, and tasks added or changed. */
  coachWrite: { max: 60, windowSec: 3600 },
  /** A coach's page for one student: a period's report and the patterns, each many reads on the server. */
  coachRead: { max: 300, windowSec: 3600 },
  /** The box on Coaching looking up a @username or friend code as the coach types (one read 300 ms after the last key). */
  coachLookup: { max: 120, windowSec: 3600 },
  /** Opening or answering a coach's invite link, per address. */
  coachJoin: { max: 60, windowSec: 3600 },
  /** The same, per coach whatever the address, so a shared link cannot be worn out or used to fill a coach's list. */
  coachJoinLink: { max: 300, windowSec: 3600 },
  /** A broken screen reporting itself, per address. */
  clientError: { max: 20, windowSec: 600 },
  /** A page's speed numbers, sent once as the visitor leaves it, per address. */
  vitals: { max: 60, windowSec: 3600 },
  /** A copyright notice or counter-notice sent through the public form, and a one-click unsubscribe, per address. */
  notice: { max: 5, windowSec: 3600 },
  unsubscribe: { max: 30, windowSec: 3600 },
  /** Finishing the Discover quiz: each one is scored and kept. */
  discover: { max: 30, windowSec: 3600 },
  /** Saving the timer settings, which happens as a person taps a stepper or a switch. */
  prefs: { max: 240, windowSec: 3600 },
  /** Gratitude for the day on Journal, saved as the person types (one save 800 ms after the last change), so a few dozen saves a day. */
  gratitude: { max: 240, windowSec: 3600 },
  /**
   * Reading Emerging (GET /insights and /insights/dashboard), per person. Every screen shares one cached answer per device day (2026-11-05),
   * so a person asks a few times an hour; stepping through periods on the page (2026-11-07) asks twice a step, so someone looking back over a
   * year stays well inside this. Each ask rebuilds weeks of rows, so a script looping on it is held to it.
   */
  insights: { max: 240, windowSec: 3600 },
  /** Everyday Agency work: moving a deliverable, a note, a time entry. */
  agency: { max: 600, windowSec: 3600 },
  /** Asking someone to join your Agency team: an inbox note and maybe a friend request go out, so twenty a day. */
  teamInvite: { max: 20, windowSec: 86400 },
  /** Inviting someone to a private School program: an inbox note goes out each time, so a hundred a day (a cohort's worth). */
  programInvite: { max: 100, windowSec: 86400 },
  /** Inviting someone to a private course: each sends an inbox note, so a hundred a day is room for a class without a way to spam. */
  courseInvite: { max: 100, windowSec: 86400 },
  /** Asking whether a discount code works, per person; the same number again per address (`discountAddress`), so many accounts on one address cannot guess codes. */
  discount: { max: 20, windowSec: 600 },
  discountAddress: { max: 60, windowSec: 600 },
  /** Emailing a copy of an invoice, agreement or document to a client: real mail goes out, so it is held to ten an hour per person. */
  docEmail: { max: 10, windowSec: 3600 },
  /** A client at their link: approving, sending back, commenting, accepting. The link is the only key, so it is counted per address. */
  portal: { max: 30, windowSec: 600 },
  /**
   * A client's onboarding form saving as they go, per address: every field left saves, so a long form makes many saves. A budget of its
   * own, so the saves never use up `portal` and the one Send at the end is never refused.
   */
  onboardingSave: { max: 300, windowSec: 600 },
  /** The client's brief answers at an agreement link, saved as they type (PUT /public/contracts/:token/answers): generous like onboardingSave, and its own budget, so it never eats `portal`, which signing and comments use. */
  contractAnswers: { max: 300, windowSec: 600 },
  /** Sending the onboarding form, per address: it is sent once, so ten in ten minutes is room for a retry after a typing slip. */
  onboardingSubmit: { max: 10, windowSec: 600 },
  /** The password on a client link, per address: five tries in ten minutes. */
  portalLogin: { max: 5, windowSec: 600 },
  /** The same password, per client whatever the address, so many addresses cannot share the guessing. */
  portalLoginLink: { max: 20, windowSec: 600 },
  /** A client asking for a new password from the lock screen, per address: it needs no session, so it is held to three an hour. */
  portalPasswordAsk: { max: 3, windowSec: 3600 },
  /** The password on a team link (the client's own team), per address: five tries in ten minutes, a budget of its own. */
  teamLinkLogin: { max: 5, windowSec: 600 },
  /** The same team link's password, per client whatever the address. */
  teamLinkLoginLink: { max: 20, windowSec: 600 },
  /** A client choosing a retainer length, and the owner's lifecycle calls (stage, password, offer, confirm). */
  lifecycle: { max: 120, windowSec: 3600 },
  /** Changing the password from Profile, per person: the current password is checked, so a stolen session cannot guess it. */
  passwordChange: { max: 5, windowSec: 900 },
  /** Lines written in Community and Bond channels. A room is chattier than a one-to-one chat, so this is above `message`. */
  channelMessage: { max: 180, windowSec: 3600 },
  /** The public list of events and one event's landing page (/events, /events/:id), read without an account, per address. */
  eventsPublic: { max: 300, windowSec: 600 },
  /** Joining an event from its public page (POST /party/events/:id/arrive), per person. */
  eventJoin: { max: 30, windowSec: 3600 },
} as const;

export type LimitName = keyof typeof LIMITS;

type Door = { method: 'POST' | 'PATCH' | 'PUT' | 'DELETE'; path: string; limit: LimitName };
/** The same doors for the channels of each app: /community/channels (public, guides) and /bond/channels (private, friends). */
const CHANNEL_DOORS: Door[] = (['community', 'bond'] as const).flatMap((app): Door[] => [
  { method: 'POST', path: `/${app}/channels`, limit: 'create' },
  { method: 'PATCH', path: `/${app}/channels/:id`, limit: 'prefs' },
  { method: 'POST', path: `/${app}/channels/:id/archive`, limit: 'prefs' },
  { method: 'POST', path: `/${app}/channels/:id/join`, limit: 'follow' },
  { method: 'POST', path: `/${app}/channels/:id/leave`, limit: 'follow' },
  { method: 'POST', path: `/${app}/channels/:id/members`, limit: 'intro' },
  { method: 'DELETE', path: `/${app}/channels/:id/members/:userId`, limit: 'prefs' },
  { method: 'POST', path: `/${app}/channels/:id/messages`, limit: 'channelMessage' },
  { method: 'DELETE', path: `/${app}/channels/:id/messages/:mid`, limit: 'prefs' },
  { method: 'POST', path: `/${app}/channels/:id/messages/:mid/report`, limit: 'ticket' },
  { method: 'POST', path: `/${app}/channels/:id/messages/:mid/block-author`, limit: 'follow' },
]);

/** Which doors each limit guards: the method and the path under /api. Patterns follow Hono's. */
export const ROUTE_LIMITS: readonly {
  /** GET only for a read heavy enough to need one (Emerging), or a door every method goes through (the admin key). */
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  limit: LimitName;
  /** Count the address instead of the person. */
  by?: 'address';
  /** Count only a request whose body carries a discount code, so an ordinary checkout, enrolment or RSVP never spends the code budget. `adminKey` counts only a wrong key. */
  when?: 'discountCode' | 'appPrefs' | 'datePrefs' | 'adminKey';
}[] = [
  ...CHANNEL_DOORS,
  ...(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const).map((method) => ({ method, path: '/admin/*', limit: 'adminKey' as const, by: 'address' as const, when: 'adminKey' as const })),
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
  { method: 'POST', path: '/studio/products/:id/invites', limit: 'courseInvite' },
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
  { method: 'POST', path: '/assistant/feelings', limit: 'feelings' },
  { method: 'POST', path: '/companion', limit: 'companion' },
  { method: 'POST', path: '/companion/stop', limit: 'companion' },
  { method: 'POST', path: '/party/events/:id/claim', limit: 'claim' },
  { method: 'POST', path: '/circles/events/:id/claim', limit: 'claim' },
  { method: 'POST', path: '/party/events/:id/duplicate', limit: 'create' },
  // The event attendee's way in (2026-11-07): the public list and landing page per address, the join per person.
  { method: 'GET', path: '/public/events', limit: 'eventsPublic', by: 'address' },
  { method: 'GET', path: '/public/events/:id', limit: 'eventsPublic', by: 'address' },
  { method: 'POST', path: '/party/events/:id/arrive', limit: 'eventJoin' },
  { method: 'POST', path: '/community/:id/follow-post', limit: 'follow' },
  { method: 'POST', path: '/community/replies/:id/react', limit: 'like' },
  { method: 'POST', path: '/coach/requests', limit: 'coachAsk' },
  { method: 'POST', path: '/coach/ask/:coachId', limit: 'coachAsk' },
  { method: 'POST', path: '/coach/apply', limit: 'coachAsk' },
  { method: 'GET', path: '/coach/lookup', limit: 'coachLookup' },
  { method: 'GET', path: '/coach/students/:id/report', limit: 'coachRead' },
  { method: 'GET', path: '/coach/students/:id/patterns', limit: 'coachRead' },
  { method: 'POST', path: '/coach/students/:id/patterns/ask', limit: 'coachWrite' },
  { method: 'POST', path: '/coach/invite', limit: 'coachWrite' },
  { method: 'PUT', path: '/me/coach/prefs', limit: 'prefs' },
  { method: 'GET', path: '/public/coach-join/:token', limit: 'coachJoin', by: 'address' },
  { method: 'GET', path: '/me/coach/join/:token', limit: 'coachJoin', by: 'address' },
  { method: 'POST', path: '/me/coach/join/:token', limit: 'coachJoin', by: 'address' },
  { method: 'POST', path: '/discover/submit', limit: 'discover' },
  { method: 'PUT', path: '/wellbeing/focus-settings', limit: 'prefs' },
  { method: 'PUT', path: '/journal/gratitude/:day', limit: 'gratitude' },
  // Gratitude prompts per person (migration 0106): Another prompt, the pillar picker and the usual three share the card's budget.
  { method: 'POST', path: '/journal/gratitude/:day/another', limit: 'gratitude' },
  { method: 'POST', path: '/journal/gratitude/:day/pick', limit: 'gratitude' },
  { method: 'PUT', path: '/journal/gratitude-settings', limit: 'gratitude' },
  { method: 'PATCH', path: '/wellbeing/focus/:id', limit: 'prefs' },
  { method: 'POST', path: '/wellbeing/focus', limit: 'prefs' },
  { method: 'DELETE', path: '/wellbeing/focus/:id', limit: 'prefs' },
  // Fitness (2026-11-07) and Kreators Run's own run-or-walk tool: the same movement log, under the everyday limit.
  { method: 'POST', path: '/fitness/move', limit: 'prefs' },
  { method: 'PATCH', path: '/fitness/move/:id', limit: 'prefs' },
  { method: 'DELETE', path: '/fitness/move/:id', limit: 'prefs' },
  { method: 'PUT', path: '/fitness/eat', limit: 'prefs' },
  { method: 'DELETE', path: '/fitness/eat/:id', limit: 'prefs' },
  { method: 'PUT', path: '/fitness/protein-goal', limit: 'prefs' },
  // Supplements (2026-11-07): every write under prefs, like the rest of Fitness.
  { method: 'PUT', path: '/fitness/supplements/settings', limit: 'prefs' },
  { method: 'POST', path: '/fitness/supplements', limit: 'prefs' },
  { method: 'DELETE', path: '/fitness/supplements', limit: 'prefs' },
  { method: 'POST', path: '/fitness/supplements/day', limit: 'prefs' },
  { method: 'PATCH', path: '/fitness/supplements/:id', limit: 'prefs' },
  { method: 'DELETE', path: '/fitness/supplements/:id', limit: 'prefs' },
  { method: 'POST', path: '/fitness/supplements/:id/move', limit: 'prefs' },
  { method: 'PUT', path: '/fitness/supplements/:id/day', limit: 'prefs' },
  { method: 'POST', path: '/run/move', limit: 'prefs' },
  { method: 'DELETE', path: '/run/move/:id', limit: 'prefs' },
  { method: 'POST', path: '/me/calendar', limit: 'prefs' },
  /** A new friend code: the old one, and every QR code made from it, stops working. */
  { method: 'POST', path: '/me/friend-code', limit: 'prefs' },
  { method: 'PUT', path: '/session/away', limit: 'prefs' },
  // A yes to the live call: a paid service, so it shares the checkout budget (a provider order is made only while payments are live).
  { method: 'POST', path: '/session/call', limit: 'checkout' },
  { method: 'PUT', path: '/today/day-type', limit: 'prefs' },
  // Time blocks, day templates and the weekly pattern (docs/time-blocks.md): settings, so under `prefs` like the kind of day.
  { method: 'POST', path: '/time-blocks/blocks', limit: 'prefs' },
  { method: 'PATCH', path: '/time-blocks/blocks/:id', limit: 'prefs' },
  { method: 'DELETE', path: '/time-blocks/blocks/:id', limit: 'prefs' },
  { method: 'PUT', path: '/time-blocks/blocks/order', limit: 'prefs' },
  { method: 'POST', path: '/time-blocks/templates', limit: 'prefs' },
  { method: 'PATCH', path: '/time-blocks/templates/:id', limit: 'prefs' },
  { method: 'DELETE', path: '/time-blocks/templates/:id', limit: 'prefs' },
  { method: 'PUT', path: '/time-blocks/pattern', limit: 'prefs' },
  { method: 'PUT', path: '/time-blocks/days', limit: 'prefs' },
  { method: 'POST', path: '/time-blocks/restore', limit: 'prefs' },
  { method: 'GET', path: '/insights', limit: 'insights' },
  { method: 'GET', path: '/insights/dashboard', limit: 'insights' },
  { method: 'POST', path: '/discover/more/:kind/submit', limit: 'discover' },
  { method: 'POST', path: '/public/client-error', limit: 'clientError' },
  { method: 'POST', path: '/public/vitals', limit: 'vitals' },
  { method: 'POST', path: '/public/copyright-notice', limit: 'notice' },
  { method: 'POST', path: '/public/unsubscribe/:token', limit: 'unsubscribe' },
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
  // A run's discussion: lines take the event conversation's limit; the rest are the channel doors' limits.
  { method: 'POST', path: '/run/talk/:runId/messages', limit: 'message' },
  { method: 'DELETE', path: '/run/talk/:runId/messages/:mid', limit: 'prefs' },
  { method: 'POST', path: '/run/talk/:runId/messages/:mid/report', limit: 'ticket' },
  { method: 'POST', path: '/run/talk/:runId/messages/:mid/block-author', limit: 'follow' },
  // A School cohort's discussion: lines take the conversation limit, the rest the channel doors' limits.
  { method: 'POST', path: '/school/cohorts/:id/talk', limit: 'message' },
  // A program's state, invites and the delete from archived.
  { method: 'POST', path: '/school/programs/:id/invites', limit: 'programInvite' },
  { method: 'DELETE', path: '/school/programs/:id/invites/:userId', limit: 'prefs' },
  { method: 'DELETE', path: '/school/programs/:id', limit: 'prefs' },
  // Editing a program in place on School: its name and words, its order (an admin), and its lessons (add, change, move, remove).
  { method: 'PATCH', path: '/school/programs/:id', limit: 'prefs' },
  { method: 'POST', path: '/school/programs/:id/move', limit: 'prefs' },
  { method: 'POST', path: '/school/programs/:id/items', limit: 'create' },
  { method: 'PATCH', path: '/school/items/:id', limit: 'prefs' },
  { method: 'POST', path: '/school/items/:id/move', limit: 'prefs' },
  { method: 'DELETE', path: '/school/items/:id', limit: 'prefs' },
  { method: 'POST', path: '/school/items/:id/resources', limit: 'prefs' },
  { method: 'PATCH', path: '/school/items/:id/resources/:resourceId', limit: 'prefs' },
  { method: 'DELETE', path: '/school/items/:id/resources/:resourceId', limit: 'prefs' },
  { method: 'POST', path: '/school/items/:id/resources/:resourceId/move', limit: 'prefs' },
  { method: 'PUT', path: '/school/cohorts/:id/talk/me', limit: 'prefs' },
  { method: 'DELETE', path: '/school/cohorts/:id/talk/:lineId', limit: 'prefs' },
  { method: 'POST', path: '/school/cohorts/:id/talk/:lineId/report', limit: 'ticket' },
  { method: 'POST', path: '/school/cohorts/:id/talk/:lineId/block-author', limit: 'follow' },
  { method: 'POST', path: '/connect/:app/:id/people/:userId/connect', limit: 'intro' },
  { method: 'POST', path: '/reviews/kpis', limit: 'create' },
  { method: 'PUT', path: '/reviews/kpis/:id/value', limit: 'prefs' },
  { method: 'PUT', path: '/reviews/kpis/settings', limit: 'prefs' },
  { method: 'POST', path: '/agency/clients', limit: 'create' },
  { method: 'POST', path: '/agency/clients/:id/invoice', limit: 'create' },
  { method: 'POST', path: '/agency/invoices', limit: 'create' },
  { method: 'POST', path: '/agency/invoices/:id/duplicate', limit: 'create' },
  { method: 'POST', path: '/reviews/schedule', limit: 'create' },
  { method: 'PATCH', path: '/reviews/schedule/:id', limit: 'prefs' },
  { method: 'POST', path: '/agency/templates', limit: 'create' },
  { method: 'POST', path: '/agency/contracts', limit: 'create' },
  { method: 'POST', path: '/agency/contracts/:id/duplicate', limit: 'create' },
  { method: 'POST', path: '/agency/invoices/:id/restore', limit: 'agency' },
  { method: 'POST', path: '/agency/contracts/:id/restore', limit: 'agency' },
  { method: 'POST', path: '/agency/docs', limit: 'create' },
  { method: 'POST', path: '/agency/docs/:id/duplicate', limit: 'create' },
  { method: 'POST', path: '/agency/invoices/:id/email', limit: 'docEmail' },
  { method: 'POST', path: '/agency/contracts/:id/email', limit: 'docEmail' },
  { method: 'POST', path: '/agency/docs/:id/email', limit: 'docEmail' },
  { method: 'POST', path: '/agency/items', limit: 'agency' },
  { method: 'PATCH', path: '/agency/items/:id', limit: 'agency' },
  { method: 'POST', path: '/agency/items/:id/notes', limit: 'agency' },
  { method: 'POST', path: '/agency/items/:id/army/send', limit: 'agency' },
  { method: 'POST', path: '/agency/time', limit: 'agency' },
  { method: 'POST', path: '/agency/comments/:type/:id', limit: 'message' },
  { method: 'PUT', path: '/agency/settings', limit: 'prefs' },
  { method: 'POST', path: '/public/agency/:token/items/:id', limit: 'portal' },
  { method: 'POST', path: '/public/agency/:token/unlock', limit: 'portalLogin', by: 'address' },
  { method: 'POST', path: '/public/contracts/:token/unlock', limit: 'portalLogin', by: 'address' },
  { method: 'POST', path: '/public/invoices/:token/unlock', limit: 'portalLogin', by: 'address' },
  { method: 'POST', path: '/public/agency/doc/:token/unlock', limit: 'portalLogin', by: 'address' },
  { method: 'POST', path: '/public/agency/:token/retainer', limit: 'portal' },
  // Client onboarding at the link (saved as they go, sent once) and the ask for a new password, all per address: the link is the only key.
  { method: 'PUT', path: '/public/agency/:token/onboarding', limit: 'onboardingSave', by: 'address' },
  { method: 'POST', path: '/public/agency/:token/onboarding/submit', limit: 'onboardingSubmit', by: 'address' },
  { method: 'POST', path: '/public/agency/password-request', limit: 'portalPasswordAsk', by: 'address' },
  // The team link (the client's own team): its unlock per address, and a note or approval from it per address like the client link.
  { method: 'POST', path: '/public/team-link/:token/unlock', limit: 'teamLinkLogin', by: 'address' },
  { method: 'POST', path: '/public/team-link/:token/items/:id', limit: 'portal', by: 'address' },
  // The owner's side of the team link: a fresh link or a new password ends every team session, so they count as lifecycle calls.
  { method: 'POST', path: '/agency/clients/:id/team-link', limit: 'lifecycle' },
  { method: 'PUT', path: '/agency/clients/:id/team-link/password', limit: 'lifecycle' },
  { method: 'POST', path: '/agency/clients/:id/team-link/password-request/close', limit: 'lifecycle' },
  { method: 'POST', path: '/agency/clients/:id/password-request/close', limit: 'lifecycle' },
  { method: 'POST', path: '/agency/clients/:id/stage', limit: 'lifecycle' },
  { method: 'PUT', path: '/agency/clients/:id/lifecycle', limit: 'lifecycle' },
  { method: 'POST', path: '/agency/clients/:id/checklist', limit: 'lifecycle' },
  { method: 'PUT', path: '/agency/clients/:id/password', limit: 'lifecycle' },
  { method: 'POST', path: '/agency/clients/:id/trial-video', limit: 'lifecycle' },
  { method: 'POST', path: '/agency/clients/:id/retainer', limit: 'lifecycle' },
  { method: 'POST', path: '/agency/retainers/:id/confirm', limit: 'lifecycle' },
  { method: 'POST', path: '/agency/retainers/:id/end', limit: 'lifecycle' },
  { method: 'POST', path: '/agency/retainers/:id/auto-send', limit: 'lifecycle' },
  { method: 'POST', path: '/agency/retainers/:id/withdraw', limit: 'lifecycle' },
  { method: 'POST', path: '/agency/items/:id/changes', limit: 'agency' },
  { method: 'PUT', path: '/public/contracts/:token/answers', limit: 'contractAnswers', by: 'address' },
  { method: 'POST', path: '/public/contracts/:token/accept', limit: 'portal' },
  { method: 'POST', path: '/public/contracts/:token/comments', limit: 'portal' },
  { method: 'POST', path: '/public/invoices/:token/comments', limit: 'portal' },
  { method: 'POST', path: '/public/agency/doc/:token/approve', limit: 'portal' },
  { method: 'POST', path: '/public/agency/doc/:token/comments', limit: 'portal' },
  { method: 'POST', path: '/discounts/check', limit: 'discount' },
  { method: 'POST', path: '/discounts/check', limit: 'discountAddress', by: 'address' },
  // Every checkout that quotes a team code shares the same budget as the check above, so codes cannot be guessed through them.
  ...(['/credits/checkout', '/school/cohorts/:id/enroll', '/party/events/:id/rsvp', '/store/:productId/checkout'] as const).flatMap((path) => [
    { method: 'POST' as const, path, limit: 'discount' as const, when: 'discountCode' as const },
    { method: 'POST' as const, path, limit: 'discountAddress' as const, by: 'address' as const, when: 'discountCode' as const },
  ]),
  { method: 'POST', path: '/me/password', limit: 'passwordChange' },
  // How the app groups start and the order of apps in them (Profile, Features): counted only when a save carries it.
  { method: 'PATCH', path: '/me', limit: 'prefs', when: 'appPrefs' },
  // The date and time format (Profile): likewise.
  { method: 'PATCH', path: '/me', limit: 'prefs', when: 'datePrefs' },
  // Hiding and showing your own apps, one at a time or several in one write.
  { method: 'PATCH', path: '/me/modules', limit: 'prefs' },
  // The rest of Agency's writes: everyday work under `agency`, the heavy ones (a fresh client link ends every session, an
  // import reaches Army) under `lifecycle`, and the business metrics under `prefs`.
  { method: 'PATCH', path: '/agency/clients/:id', limit: 'agency' },
  { method: 'DELETE', path: '/agency/clients/:id', limit: 'agency' },
  { method: 'POST', path: '/agency/clients/:id/portal', limit: 'lifecycle' },
  { method: 'POST', path: '/agency/clients/:id/army-import', limit: 'lifecycle' },
  { method: 'DELETE', path: '/agency/items/:id', limit: 'agency' },
  { method: 'DELETE', path: '/agency/notes/:id', limit: 'agency' },
  { method: 'POST', path: '/agency/items/:id/army/sync', limit: 'agency' },
  { method: 'DELETE', path: '/agency/time/:id', limit: 'agency' },
  { method: 'PATCH', path: '/agency/templates/:id', limit: 'agency' },
  { method: 'DELETE', path: '/agency/templates/:id', limit: 'agency' },
  { method: 'PATCH', path: '/agency/invoices/:id', limit: 'agency' },
  { method: 'DELETE', path: '/agency/invoices/:id', limit: 'agency' },
  { method: 'DELETE', path: '/agency/comments/:id', limit: 'agency' },
  { method: 'PATCH', path: '/agency/contracts/:id', limit: 'agency' },
  { method: 'POST', path: '/agency/contracts/:id/print', limit: 'agency' },
  { method: 'POST', path: '/agency/docs/:id/print', limit: 'agency' },
  { method: 'DELETE', path: '/agency/contracts/:id', limit: 'agency' },
  { method: 'PATCH', path: '/agency/docs/:id', limit: 'agency' },
  { method: 'DELETE', path: '/agency/docs/:id', limit: 'agency' },
  { method: 'PATCH', path: '/reviews/kpis/:id', limit: 'prefs' },
  { method: 'DELETE', path: '/reviews/kpis/:id', limit: 'prefs' },
  // The Agency team: an invite under its own daily count, the owner's other changes as everyday Agency work, and the member's answer or
  // leaving as a preference. A member's own work on the owner's Agency counts against the member, since these run before the team gate.
  { method: 'POST', path: '/agency/team', limit: 'teamInvite' },
  { method: 'PATCH', path: '/agency/team/:id', limit: 'agency' },
  { method: 'POST', path: '/agency/team/:id/resend', limit: 'agency' },
  { method: 'DELETE', path: '/agency/team/:id', limit: 'agency' },
  { method: 'POST', path: '/me/teams/:id/answer', limit: 'prefs' },
  { method: 'POST', path: '/me/teams/:id/leave', limit: 'prefs' },
];

/** The doors that take no session are limited before the session check; everything else after it, per person. /admin is mounted before that check too. */
export const isOpenDoor = (path: string): boolean => path.startsWith('/auth/') || path.startsWith('/public/') || path.startsWith('/admin/');
