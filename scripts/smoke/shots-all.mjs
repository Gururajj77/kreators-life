// Every route on a phone, with real data behind the detail pages. Prints the shot list and the token:
//   node --experimental-strip-types --no-warnings scripts/smoke/shots-all.mjs > shots.json
//   SHOOT_TOKEN=$(cat scripts/smoke/state/shoot-token) SHOOT_LIST=shots.json SHOOT_THEME=light \
//     SHOOT_PROBE=scripts/smoke/overflow-probe.js node --experimental-strip-types --no-warnings scripts/smoke/shoot.mjs
// Runs against the smoke server (blueprint.sh --keep) with its admin key.
import fs from 'node:fs';
import path from 'node:path';
import { MODULES, QUESTIONS } from '../../packages/shared/src/index.ts';

const ORIGIN = process.env.SMOKE_ORIGIN ?? 'http://127.0.0.1:8788';
const ADMIN_KEY = process.env.SMOKE_ADMIN_KEY ?? 'smoke-admin-key';
const stamp = Date.now().toString(36);
const ip = `10.98.${Date.now() % 255}.${(Date.now() >> 8) % 255}`;
async function api(method, p, body, token, headers = {}) {
  const res = await fetch(`${ORIGIN}/api${p}`, { method, headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip, ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) console.error(`  ${method} ${p} -> ${res.status} ${JSON.stringify(json).slice(0, 120)}`);
  return json;
}
const admin = (method, p, body) => api(method, p, body, null, { 'X-Admin-Key': ADMIN_KEY });
async function account(name) {
  const r = await api('POST', '/auth/signup', { email: `${name}-${stamp}@smoke.test`, password: `Camera-${stamp}-pass`, displayName: name, phone: '+91 98765 43210', birthDate: '1990-05-20' });
  return { token: r.token, user: r.user };
}
const today = new Date().toISOString().slice(0, 10);
const soon = (hours) => new Date(Date.now() + hours * 3600_000).toISOString();

const M = await account('Screenshot');
const S = await account('Seller');
const T = await account('Third');
await admin('POST', `/admin/users/${M.user.id}/role`, { role: 'admin' });
const answers = QUESTIONS.filter((q) => q.relationship === 'self' || q.relationship === 'friendship').map((q) => ({ questionId: q.id, value: 2 }));
await api('POST', '/onboarding', { answers, displayName: 'Screenshot' }, M.token);
await api('POST', '/onboarding/build', { relationships: ['self', 'friendship'], date: today }, M.token);
await api('POST', '/today/checkin', { date: today }, M.token);
await api('POST', '/today/not-to-do', { title: 'Scrolling before breakfast' }, M.token);
for (const m of MODULES) if (!m.locked && !m.defaultOn && m.minRole === 'user') await api('PATCH', '/me/modules', { key: m.key, on: true }, M.token);
await api('PATCH', '/me', { handle: `shot${stamp}`.slice(0, 20), bio: 'Screenshots, nothing else.' }, M.token);
await api('PATCH', '/me', { handle: `sell${stamp}`.slice(0, 20) }, S.token);

const sold = await api('POST', '/studio/products', { kind: 'digital', title: 'A free guide to light', description: 'Three pages on window light for phone video.', pricePoints: 0, status: 'live' }, S.token);
const mine = await api('POST', '/studio/products', { kind: 'course', title: 'My own course', description: 'Lessons on the cut.', pricePoints: 100, status: 'live' }, M.token);
if (sold.product?.id) await api('POST', `/store/${sold.product.id}/checkout`, {}, M.token);
const opp = await api('POST', '/work/opportunities', { title: 'Shoot a street interview', description: 'Two reels, one afternoon.', compensationMin: 2000, compensationMax: 5000 }, M.token);
if (opp.id) await api('PATCH', `/work/opportunities/${opp.id}`, { status: 'published' }, M.token);
const org = await api('POST', '/orgs', { name: 'Screenshot Brand' }, M.token);
const camp = org.organization?.id ? await api('POST', '/army/campaigns', { organizationId: org.organization.id, name: 'Monsoon launch', brief: 'Three reels about a raincoat.' }, M.token) : {};
const reward = await api('POST', '/win', { title: 'Raincoat reel reward', brandName: 'Screenshot Brand', budgetPoints: 1000, ratePerThousand: 10, minViews: 100, brief: 'Post a reel wearing the coat.' }, M.token);
const event = await api('POST', '/party/events', { title: 'Creators meetup', startsAt: soon(48), minutes: 120, venue: 'Cubbon Park gate', capacity: 20 }, M.token);
const club = await api('POST', '/run/clubs', { name: 'Morning runners', city: 'Bengaluru', pace: 'easy', meets: 'Cubbon Park gate' }, M.token);
if (club.club?.id ?? club.id) await api('POST', `/run/clubs/${club.club?.id ?? club.id}/runs`, { title: 'Sunday 5k', startsAt: soon(24), minutes: 60, metres: 5000 }, M.token);
await api('POST', '/proposals', { kind: 'tv', title: 'A series about street food', pitch: 'Six episodes, one city.', budgetAmount: 50000 }, M.token);
await api('POST', '/market/listings', { title: 'Used shotgun mic', category: 'Audio', condition: 'lightly_used', priceCents: 450000, description: 'Barely used.' }, S.token);
// A circle with three people and its tables set, so the table page exists.
const circle = await api('POST', '/circles/events', { title: 'Thursday table', city: 'Bengaluru', startsAt: soon(72), venueHint: 'Indiranagar', groupSize: 3 }, M.token);
const circleId = circle.event?.id ?? circle.id;
for (const a of [M, S, T]) {
  await api('PATCH', '/me', { city: 'Bengaluru', interests: ['video', 'writing', 'music'] }, a.token);
  if (circleId) await api('POST', `/circles/events/${circleId}/join`, { status: 'private' }, a.token);
}
if (circleId) await api('POST', `/circles/events/${circleId}/match`, {}, M.token);
const circles = await api('GET', '/circles', undefined, M.token);
const groupId = (circles.events ?? []).find((e) => e.myGroupId)?.myGroupId ?? circles.groups?.[0]?.id ?? null;
// A friend and an alias chat.
await api('POST', '/bond/friends', { userId: M.user.id }, S.token);
const friends = await api('GET', '/bond/friends', undefined, M.token);
const pending = (friends.requests ?? friends.friends ?? []).find((f) => f.status === 'pending');
if (pending?.id) await api('POST', `/bond/friends/${pending.id}`, { status: 'accepted' }, M.token);
const chat = await api('POST', '/bond/chats', { userId: S.user.id }, M.token);
const resources = await api('GET', '/resources', undefined, M.token);
const resourceId = resources.resources?.[0]?.id ?? null;

const stateDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'state');
fs.mkdirSync(stateDir, { recursive: true });
fs.writeFileSync(path.join(stateDir, 'shoot-token'), M.token);

const site = ['/', '/explore', '/features/school', '/c/nope', '/i/nope', '/terms', '/privacy', '/refunds', '/contact', '/pricing', '/start', '/signin', '/forgot', '/signin/reset?token=nope', '/signup', `/u/sell${stamp}`.slice(0, 24), `/people/${S.user.id}`, sold.product?.id ? `/p/${sold.product.id}` : null];
const app = ['/vibe-check', '/home', '/today', '/tower', '/realm/self', '/apps', '/you', '/search', '/profile', '/help', '/inbox', '/leaderboard', '/rewards', '/school', '/school/coh-editing-open', '/work', opp.id ? `/work/${opp.id}` : null, '/army', camp.id ? `/army/${camp.id}` : null, '/win', reward.id ? `/win/${reward.id}` : null, '/party', event.event?.id ?? event.id ? `/party/${event.event?.id ?? event.id}` : null, '/run', club.club?.id ?? club.id ? `/run/clubs/${club.club?.id ?? club.id}` : null, '/run?tab=tracking', '/run?tab=collabs', '/community', '/club', '/bond', chat.chat?.id ?? chat.id ? `/bond/chats/${chat.chat?.id ?? chat.id}` : null, '/circles', groupId ? `/circles/${groupId}` : null, '/life', '/reviews', '/wellbeing', '/mood', '/sleep', '/stress', '/mindful', '/journal', '/companion', '/knowledge', resourceId ? `/knowledge/${resourceId}` : null, '/tools', '/tv', '/fund', '/sessions', '/library', sold.product?.id ? `/library/${sold.product.id}` : null, '/shop', '/store', mine.product?.id ? `/shop/products/${mine.product.id}` : null, '/shop/page', '/shop/bookings', '/shop/testimonials', '/shop/audience', '/shop/content', '/shop/automations', '/shop/customers', '/shop/dm', '/finance', '/internal/observability', '/manage', '/admin', '/nowhere-at-all'];
const shots = [...site.filter(Boolean).map((p) => ({ path: p, name: `all-${p.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'site'}` })), ...app.filter(Boolean).map((p) => ({ path: p, needsSession: true, name: `all-${p.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}` }))];
process.stdout.write(JSON.stringify(shots, null, 1));
console.error(`${shots.length} shots; token in ${path.join(stateDir, 'shoot-token')}`);
