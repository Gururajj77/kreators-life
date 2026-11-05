import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv, Env, UserRow } from './env';
import { auth } from './routes/auth';
import { me } from './routes/me';
import { onboarding } from './routes/onboarding';
import { nodes } from './routes/nodes';
import { today } from './routes/today';
import insights from './routes/insights';
import { leaderboard } from './routes/leaderboard';
import { rewards } from './routes/rewards';
import { cards } from './routes/cards';
import { discover } from './routes/discover';
import { admin } from './routes/admin';
import { wellbeing } from './routes/wellbeing';
import { journal } from './routes/journal';
import { inbox } from './routes/inbox';
import { manageResources, resources } from './routes/resources';
import { community, moderate } from './routes/community';
import { bondChannels, communityChannels } from './routes/channels';
import { companionRoutes } from './routes/companion';
import { search } from './routes/search';
import { studio } from './routes/studio';
import { publicPage, store } from './routes/store';
import { explore } from './routes/explore';
import { manage } from './routes/manage';
import { orgs } from './routes/orgs';
import { army } from './routes/army';
import { school } from './routes/school';
import { work } from './routes/work';
import { party } from './routes/party';
import { club } from './routes/club';
import { win } from './routes/win';
import { bond } from './routes/bond';
import { tools } from './routes/tools';
import { proposals } from './routes/proposals';
import { support } from './routes/support';
import { growth } from './routes/growth';
import { buyer, certificates } from './routes/buyer';
import { go, webhooks } from './routes/go';
import { runScheduled } from './cron';
import { kyc } from './routes/kyc';
import { builder } from './routes/builder';
import { secureHeaders } from 'hono/secure-headers';
import { rateLimit } from './ops';
import { isOpenDoor, ROUTE_LIMITS } from './limits';
import { legalPublic, meLegal } from './routes/legal';
import { pruneVitals, vitalsPublic } from './routes/vitals';
import { modulesForPath, resolveAccess } from './access';
import { MODULE_BY_KEY } from '@kreators/shared';
import { finance, publicInvoices } from './routes/finance';
import { internal } from './routes/internal';
import { circles } from './routes/circles';
import { life } from './routes/life';
import { home } from './routes/home';
import { reviews } from './routes/reviews';
import { market } from './routes/market';
import { run } from './routes/run';
import { strategist } from './routes/strategist';
import { session } from './routes/session';
import { assistantRoutes } from './routes/assistant';
import { feelings } from './routes/feelings';
import { credits } from './routes/credits';
import { discounts } from './routes/discounts';
import { coach, myCoach } from './routes/coach';
import { media, mediaPublic } from './routes/media';
import { reminders } from './routes/reminders';
import { agency, agencyPublic } from './routes/agency';
import { agencyLife, agencyLifePublic } from './routes/agencyLife';
import { agencyTeam, myTeams } from './routes/agencyTeam';
import { agencyTeamGate } from './agencyTeamAccess';
import { portalDocGate, portalDocs } from './portalAccess';
import { refuseTeamSession } from './teamLinkAccess';
import { teamLinkOwner, teamLinkPublic } from './routes/teamLink';
import { kpis } from './routes/kpis';
import { calendarMe, calendarPublic } from './routes/calendar';
import { agencyDocs, contractsPublic } from './routes/agencyDocs';
import { agencyOther, docsPublic } from './routes/agencyOther';
import { connect } from './routes/connect';
import { activity } from './routes/activity';
import { booksPublic } from './routes/books';
import { logger, pruneLogs, writeClientError, writeLog } from './logs';
import { blockedPath, originAllowed, PAGE_HEADERS } from './headers';

const app = new Hono<AppEnv>().basePath('/api');

// No CORS: the app and its API are one origin (the Worker serves both), so no other site is ever allowed to read an answer from a browser.
// A short id for every request. It goes back in X-Request-Id, in the body of a server error and in the log line, so a report can be traced.
app.use('*', async (c, next) => {
  c.set('requestId', Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join(''));
  await next();
  try {
    c.res.headers.set('X-Request-Id', c.get('requestId') ?? '');
  } catch {
    // a response with fixed headers keeps none
  }
});
// Defence in depth for a write: if a browser says which page it comes from, the page must be this site. Auth is a Bearer header, so a
// foreign page could not act as the person anyway. No Origin (scripts, webhooks, the smoke tests) passes; webhooks check their own signature.
app.use('*', async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') return next();
  const origin = c.req.header('Origin');
  if (!origin || new URL(c.req.url).pathname.startsWith('/api/webhooks/')) return next();
  if (originAllowed(origin, c.req.url, c.env.PUBLIC_URL)) return next();
  return c.json({ error: 'wrong origin' }, 403);
});
app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] },
    strictTransportSecurity: 'max-age=63072000; includeSubDomains',
    xFrameOptions: 'DENY',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
  }),
);
// Nothing a signed-in person is shown is kept by a browser or a proxy. Public answers keep whatever cache line their route set (media, calendar).
app.use('*', async (c, next) => {
  await next();
  const path = new URL(c.req.url).pathname;
  const sensitive = path.startsWith('/api/auth/') || path.startsWith('/api/me/') || path === '/api/me';
  if (!sensitive && (path.startsWith('/api/public/') || c.res.headers.has('Cache-Control'))) return;
  try {
    c.res.headers.set('Cache-Control', 'no-store');
  } catch {
    // a response with fixed headers keeps its own
  }
});
// The app's own log of what changed, what was refused and what broke. See logs.ts.
app.use('*', logger());

app.get('/health', (c) => c.json({ ok: true, at: new Date().toISOString() }));
// Abuse limits on the doors that take no session, per address. The numbers live in limits.ts. They are registered first, so a limit runs before the door it guards.
for (const r of ROUTE_LIMITS) if (isOpenDoor(r.path)) app.on(r.method, r.path, rateLimit(r.limit, r.by, r.when));
// A screen that broke in someone's browser says so here: a short message and where, never who. Limited per address.
app.post('/public/client-error', async (c) => {
  const body = await c.req.json<{ message?: unknown; path?: unknown }>().catch(() => ({}) as { message?: unknown; path?: unknown });
  await writeClientError(c, body);
  return c.json({ ok: true });
});
app.route('/auth', auth);
// Admin uses its own key, or an admin's session. Public pages need no session.
app.route('/admin', admin);
app.route('/public', legalPublic);
app.route('/public', vitalsPublic);
app.route('/public/explore', explore);
app.route('/public/media', mediaPublic);
// A team link session (the client's own team, teamLinkAccess.ts) never reaches the client link or any paper: a request carrying one is a 404.
for (const prefix of ['/public/agency', '/public/contracts', '/public/invoices']) {
  app.use(prefix, refuseTeamSession);
  app.use(`${prefix}/*`, refuseTeamSession);
}
// A client with a password on their link needs a live portal session for their agreement and invoice links too (portalAccess.ts).
for (const kind of ['contract', 'invoice', 'doc'] as const) {
  const prefix = kind === 'contract' ? '/public/contracts' : kind === 'invoice' ? '/public/invoices' : '/public/agency/doc';
  app.use(`${prefix}/:token`, portalDocGate(kind));
  app.use(`${prefix}/:token/*`, portalDocGate(kind));
}
app.route('/public', portalDocs);
app.route('/public/certificates', certificates);
app.route('/public/invoices', publicInvoices);
app.route('/public/agency/doc', docsPublic);
app.route('/public/agency', agencyLifePublic);
app.route('/public/agency', agencyPublic);
app.route('/public/team-link', teamLinkPublic);
app.route('/public/contracts', contractsPublic);
app.route('/public/calendar', calendarPublic);
app.route('/public/books', booksPublic);
app.route('/public', publicPage);
// Webhooks verify their own signatures.
app.route('/webhooks', webhooks);

// Everything below needs a device session.
app.use('*', async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return c.json({ error: 'unauthorized' }, 401);
  const user = await c.env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?')
    .bind(token)
    .first<UserRow>();
  if (!user) {
    // A token that was signed out to make room for a newer device says so, so that device can explain it.
    const gone = await c.env.DB.prepare('SELECT 1 AS x FROM session_evictions WHERE token = ?').bind(token).first();
    return c.json(gone ? { error: 'unauthorized', reason: 'devices' } : { error: 'unauthorized' }, 401);
  }
  c.set('user', user);
  await next();
});

// A switched-off module is refused here, not only hidden by the client: the global flag, an override,
// the rollout and the minimum role all count. The person's own on/off is a preference the client keeps.
app.use('*', async (c, next) => {
  const keys = modulesForPath(new URL(c.req.url).pathname);
  if (!keys) return next();
  const { access } = await resolveAccess(c.env.DB, c.get('user'));
  if (keys.some((k) => access[k]?.available)) return next();
  const name = MODULE_BY_KEY[keys[0] ?? '']?.name ?? 'That app';
  return c.json({ error: `${name} is not available on your account.`, module: keys[0] }, 403);
});

// The rest of the limits, per person. Same file.
for (const r of ROUTE_LIMITS) if (!isOpenDoor(r.path)) app.on(r.method, r.path, rateLimit(r.limit, r.by, r.when));

// The Agency team gate: a member working on someone's Agency (the X-Agency-Team header) is checked against their row and the allowlist on
// every request, then acts as the owner with the answer cut down. No header, no change. After the limits, so a member's work counts as theirs.
app.use('/agency', agencyTeamGate);
app.use('/agency/*', agencyTeamGate);

// The student's side of coaching is core, so it is mounted before the rest of /me and never gated.
app.route('/me/coach', myCoach);
// An Agency team member's answers, leaving and a client member's view: core like /me/coach, so a person can always say no or leave.
app.route('/me/teams', myTeams);
app.route('/me/calendar', calendarMe);
app.route('/me/legal', meLegal);
app.route('/me/activity', activity);
app.route('/me', me);
app.route('/onboarding', onboarding);
app.route('/session', session);
app.route('/nodes', nodes);
app.route('/today', today);
// Emerging: patterns from the person's own rows, core and owner only (no line in MODULE_FOR_PREFIX).
app.route('/insights', insights);
app.route('/leaderboard', leaderboard);
app.route('/rewards', rewards);
app.route('/cards', cards);
app.route('/discover', discover);
app.route('/wellbeing', wellbeing);
app.route('/journal', journal);
app.route('/inbox', inbox);
app.route('/resources', resources);
// Channels sit under their own app, so the module gate reads Community for one and Bond for the other.
app.route('/community/channels', communityChannels);
app.route('/bond/channels', bondChannels);
app.route('/community', community);
// The Companion reads the person's day through the app's own routes, like the assistant, so it gets the app to call into.
app.route('/companion', companionRoutes((req, env, ctx) => app.fetch(req, env, ctx)));
app.route('/search', search);
app.route('/studio', studio);
app.route('/studio', growth);
app.route('/store', store);
app.route('/store', buyer);
// Before `manage`: its staff-only check covers every path under /manage, and a guide's tools answer here first (a creator who holds
// Moderation is a guide, not staff).
app.route('/manage/community', moderate);
app.route('/manage', manage);
app.route('/manage/resources', manageResources);
app.route('/orgs', orgs);
app.route('/army', army);
app.route('/school', school);
app.route('/work', work);
app.route('/party', party);
app.route('/club', club);
app.route('/win', win);
app.route('/bond', bond);
app.route('/media', media);
app.route('/reminders', reminders);
app.route('/connect', connect);
app.route('/tools', tools);
app.route('/proposals', proposals);
app.route('/support', support);
app.route('/finance', finance);
app.route('/internal', internal);
app.route('/circles', circles);
app.route('/life', life);
app.route('/home', home);
app.route('/reviews/kpis', kpis);
app.route('/reviews', reviews);
app.route('/agency/team', agencyTeam);
app.route('/agency/docs', agencyOther);
app.route('/agency', agency);
app.route('/agency', agencyLife);
app.route('/agency', teamLinkOwner);
app.route('/agency', agencyDocs);
app.route('/market', market);
app.route('/run', run);
app.route('/kyc', kyc);
app.route('/studio', builder);
app.route('/studio', strategist);
// The assistant calls the app's own routes as the person, so it gets the app itself to call into.
app.route('/assistant/feelings', feelings);
app.route('/assistant', assistantRoutes((req, env, ctx) => app.fetch(req, env, ctx)));
app.route('/credits', credits);
app.route('/discounts', discounts);
app.route('/coach', coach);

app.notFound((c) => c.json({ error: 'not found' }, 404));
app.onError((err, c) => {
  const requestId = c.get('requestId') ?? '';
  if (err instanceof HTTPException) return err.getResponse();
  // A body that is not JSON is the sender's mistake, not ours. Its message can quote the start of the body, so it is neither logged nor sent back.
  if (err instanceof SyntaxError) {
    c.set('logNote', `[${requestId}] SyntaxError: a body that is not valid JSON`);
    return c.json({ error: 'that request was not valid JSON', requestId }, 400);
  }
  console.error(requestId, err);
  c.set('logNote', `[${requestId}] ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`.slice(0, 300));
  // The answer never carries the error's text, a stack or a query: only a plain line and the id to quote.
  return c.json({ error: 'something broke on our side', requestId }, 500);
});

// /go/:code lives outside /api so links stay short. The Worker runs first for /api/* and /go/*.
const root = new Hono<AppEnv>();
root.route('/', go);
root.route('/', app);
// A route that does not exist answers with one plain JSON line, like the rest of the API (the sub-app's own notFound is not inherited when it is mounted).
root.notFound((c) => c.json({ error: 'not found' }, 404));

/** The words the Worker itself answers with for a page (not an API answer): the same headers as the static files get from _headers. */
function withPageHeaders(res: Response): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(PAGE_HEADERS)) out.headers.set(k, v);
  return out;
}
const GO_PATHS = /^\/(?:go\/|out\/|__scheduled)|^\/$|^\/sitemap\.xml$/;

/**
 * Everything the Worker sees. /api/* is the API (its own headers). A path that holds nothing (hidden files, backups, dumps, config) answers 404
 * and never the app shell. The short links and the site home are the Worker's own pages. Anything else that reached the Worker only because
 * of a "run first" pattern is handed on to the static files.
 */
async function handle(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const { pathname } = new URL(req.url);
  if (pathname === '/api' || pathname.startsWith('/api/')) return root.fetch(req, env, ctx);
  if (blockedPath(pathname)) return withPageHeaders(new Response('not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } }));
  if (!GO_PATHS.test(pathname) && env.ASSETS) return withPageHeaders(await env.ASSETS.fetch(req));
  return withPageHeaders(await root.fetch(req, env, ctx));
}

export default {
  fetch: handle,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runScheduled(env, event.cron)
        .then(async (r) => {
          console.log('scheduled', JSON.stringify(r));
          const did = Object.entries(r).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(', ');
          // A quiet run leaves no line; one that did something says what, and the old lines are tidied away.
          if (did) await writeLog(env.DB, { level: 'info', area: 'cron', message: did });
          await pruneLogs(env.DB);
          await pruneVitals(env.DB);
          await env.DB.prepare('DELETE FROM session_evictions WHERE created_at < ?').bind(new Date(Date.now() - 30 * 86_400_000).toISOString()).run();
        })
        .catch((err) => writeLog(env.DB, { level: 'error', area: 'cron', message: err instanceof Error ? `${err.name}: ${err.message}` : String(err) })),
    );
  },
};
