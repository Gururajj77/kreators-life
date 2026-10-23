import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv, UserRow } from './env';
import { auth } from './routes/auth';
import { me } from './routes/me';
import { onboarding } from './routes/onboarding';
import { nodes } from './routes/nodes';
import { today } from './routes/today';
import { leaderboard } from './routes/leaderboard';
import { rewards } from './routes/rewards';
import { admin } from './routes/admin';

const app = new Hono<AppEnv>().basePath('/api');

app.use('*', cors());

app.get('/health', (c) => c.json({ ok: true, at: new Date().toISOString() }));
app.route('/auth', auth);
// Admin uses its own key, not a device session.
app.route('/admin', admin);

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

app.notFound((c) => c.json({ error: 'not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'something broke on our side' }, 500);
});

export default app;
