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
import { finance, publicInvoices } from './routes/finance';
import { internal } from './routes/internal';
import { circles } from './routes/circles';
import { life } from './routes/life';
import { home } from './routes/home';

const app = new Hono<AppEnv>().basePath('/api');

app.use('*', cors());
app.use('*', secureHeaders());

app.get('/health', (c) => c.json({ ok: true, at: new Date().toISOString() }));
// Abuse limits on the doors that take no session.
app.use('/auth/signin', rateLimit('signin', 10, 60));
app.use('/auth/signup', rateLimit('signup', 10, 3600));
app.use('/auth/forgot', rateLimit('forgot', 10, 3600));
app.use('/auth/reset', rateLimit('reset', 20, 3600));
app.use('/auth/anon', rateLimit('anon', 60, 3600));
app.use('/public/:handle/lead', rateLimit('lead', 5, 60));
app.route('/auth', auth);
// Admin uses its own key, or an admin's session. Public pages need no session.
app.route('/admin', admin);
app.route('/public/explore', explore);
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
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  c.set('user', user);
  await next();
});

app.route('/me', me);
app.route('/onboarding', onboarding);
app.route('/nodes', nodes);
app.route('/today', today);
app.route('/leaderboard', leaderboard);
app.route('/rewards', rewards);
app.route('/wellbeing', wellbeing);
app.route('/journal', journal);
app.route('/inbox', inbox);
app.route('/resources', resources);
app.route('/community', community);
app.route('/companion', companion);
app.route('/search', search);
app.route('/studio', studio);
app.route('/studio', growth);
app.use('/store/:productId/checkout', rateLimit('checkout', 10, 60));
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
app.route('/tools', tools);
app.route('/proposals', proposals);
app.route('/support', support);
app.route('/finance', finance);
app.route('/internal', internal);
app.route('/circles', circles);
app.route('/life', life);
app.route('/home', home);
app.route('/kyc', kyc);
app.route('/studio', builder);

app.notFound((c) => c.json({ error: 'not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'something broke on our side' }, 500);
});

// /go/:code lives outside /api so links stay short. The Worker runs first for /api/* and /go/*.
const root = new Hono<AppEnv>();
root.route('/', go);
root.route('/', app);

export default {
  fetch: root.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduled(env).then((r) => console.log('scheduled', JSON.stringify(r))));
  },
};
