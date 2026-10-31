import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv, Env, UserRow } from './env';
import { auth } from './routes/auth';
import { me } from './routes/me';
import { onboarding } from './routes/onboarding';
import { nodes } from './routes/nodes';
import { today } from './routes/today';
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
import { companion } from './routes/companion';
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
import { credits } from './routes/credits';
import { coach, myCoach } from './routes/coach';
import { media, mediaPublic } from './routes/media';
import { reminders } from './routes/reminders';
import { connect } from './routes/connect';
import { logger, pruneLogs, writeClientError, writeLog } from './logs';

const app = new Hono<AppEnv>().basePath('/api');

app.use('*', cors());
app.use('*', secureHeaders());
// The app's own log of what changed, what was refused and what broke. See logs.ts.
app.use('*', logger());

app.get('/health', (c) => c.json({ ok: true, at: new Date().toISOString() }));
// A screen that broke in someone's browser says so here: a short message and where, never who. Limited per address.
app.post('/public/client-error', async (c) => {
  const body = await c.req.json<{ message?: unknown; path?: unknown }>().catch(() => ({}) as { message?: unknown; path?: unknown });
  await writeClientError(c, body);
  return c.json({ ok: true });
});
// Abuse limits on the doors that take no session, per address. The numbers live in limits.ts.
for (const r of ROUTE_LIMITS) if (isOpenDoor(r.path)) app.on(r.method, r.path, rateLimit(r.limit));
app.route('/auth', auth);
// Admin uses its own key, or an admin's session. Public pages need no session.
app.route('/admin', admin);
app.route('/public/explore', explore);
app.route('/public/media', mediaPublic);
app.route('/public/certificates', certificates);
app.route('/public/invoices', publicInvoices);
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
for (const r of ROUTE_LIMITS) if (!isOpenDoor(r.path)) app.on(r.method, r.path, rateLimit(r.limit));

// The student's side of coaching is core, so it is mounted before the rest of /me and never gated.
app.route('/me/coach', myCoach);
app.route('/me', me);
app.route('/onboarding', onboarding);
app.route('/session', session);
app.route('/nodes', nodes);
app.route('/today', today);
app.route('/leaderboard', leaderboard);
app.route('/rewards', rewards);
app.route('/cards', cards);
app.route('/discover', discover);
app.route('/wellbeing', wellbeing);
app.route('/journal', journal);
app.route('/inbox', inbox);
app.route('/resources', resources);
app.route('/community', community);
app.route('/companion', companion);
app.route('/search', search);
app.route('/studio', studio);
app.route('/studio', growth);
app.route('/store', store);
app.route('/store', buyer);
app.route('/manage', manage);
app.route('/manage/resources', manageResources);
app.route('/manage/community', moderate);
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
app.route('/reviews', reviews);
app.route('/market', market);
app.route('/run', run);
app.route('/kyc', kyc);
app.route('/studio', builder);
app.route('/studio', strategist);
// The assistant calls the app's own routes as the person, so it gets the app itself to call into.
app.route('/assistant', assistantRoutes((req, env, ctx) => app.fetch(req, env, ctx)));
app.route('/credits', credits);
app.route('/coach', coach);

app.notFound((c) => c.json({ error: 'not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  c.set('logNote', (err instanceof Error ? `${err.name}: ${err.message}` : String(err)).slice(0, 300));
  return c.json({ error: 'something broke on our side' }, 500);
});

// /go/:code lives outside /api so links stay short. The Worker runs first for /api/* and /go/*.
const root = new Hono<AppEnv>();
root.route('/', go);
root.route('/', app);

export default {
  fetch: root.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runScheduled(env)
        .then(async (r) => {
          console.log('scheduled', JSON.stringify(r));
          const did = Object.entries(r).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(', ');
          // A quiet run leaves no line; one that did something says what, and the old lines are tidied away.
          if (did) await writeLog(env.DB, { level: 'info', area: 'cron', message: did });
          await pruneLogs(env.DB);
          await env.DB.prepare('DELETE FROM session_evictions WHERE created_at < ?').bind(new Date(Date.now() - 30 * 86_400_000).toISOString()).run();
        })
        .catch((err) => writeLog(env.DB, { level: 'error', area: 'cron', message: err instanceof Error ? `${err.name}: ${err.message}` : String(err) })),
    );
  },
};
