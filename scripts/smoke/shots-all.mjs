// Every route on a phone, with real data behind the detail pages. Prints the shot list and the token:
//   node --experimental-strip-types --no-warnings scripts/smoke/shots-all.mjs > shots.json
//   SHOOT_TOKEN=$(cat scripts/smoke/state/shoot-token) SHOOT_LIST=shots.json SHOOT_THEME=light \
//     SHOOT_PROBE=scripts/smoke/overflow-probe.js node --experimental-strip-types --no-warnings scripts/smoke/shoot.mjs
// Runs against the smoke server (blueprint.sh --keep) with its admin key.
import fs from 'node:fs';
import path from 'node:path';
import { MODULES, QUESTIONS } from '../../packages/shared/src/index.ts';
import { openJoining } from './openJoining.mjs';

const ORIGIN = process.env.SMOKE_ORIGIN ?? 'http://127.0.0.1:8788';
// Joining is by invite (migration 0125): on the test server, turn Invite only off so this script's own sign-ups work.
await openJoining(ORIGIN);
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
  const r = await api('POST', '/auth/signup', { email: `${name}-${stamp}@smoke.test`, password: `Camera-${stamp}-pass`, displayName: name, acceptTerms: true, phone: '+91 98765 43210', birthDate: '1990-05-20' });
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
const pending = (friends.open ?? []).find((f) => f.status === 'pending');
if (pending?.requestId) await api('POST', `/bond/friends/${pending.requestId}`, { status: 'accepted' }, M.token);
const chat = await api('POST', '/bond/chats', { userId: S.user.id }, M.token);
const resources = await api('GET', '/resources', undefined, M.token);
const resourceId = resources.resources?.[0]?.id ?? null;

const site = [];

// Agency: a client with a pipeline, time, an invoice, an agreement and a client link, so every Agency page has real data.
await api('PATCH', '/me/modules', { key: 'agency', on: true }, M.token);
await api('PUT', '/agency/settings', { currency: 'INR', weeklyHours: 30, profile: { from: { name: 'Studio Example', line: 'Prop. Sample for Studio Example', taxIds: [{ label: 'PAN', value: 'ABCDE1234F' }], address: '1 Example Road, Bengaluru', email: 'hello@example.test', phone: '+91 90000 00000' }, bank: { bankName: 'Example Bank', holder: 'Sample Person', account: '00112233', ifsc: 'EXMP0000001', upi: 'sample@upi' }, invoicePrefix: 'EX', payDays: 10, gstBps: 1800, signerName: 'Sample Person', signerTitle: 'Founder', jurisdiction: 'Bengaluru, Karnataka' } }, M.token);
// A client needs an email and a password for its link. Acme's link is opened without one and its onboarding is sent, so the shot is the
// client's dashboard; Bloom keeps its password (the lock screen) and North Studio is open but not onboarded (the form).
const onboardingDraft = (questions, name, email) => ({
  legalName: name, brands: name, addressLine: '12 Main Road', city: 'Bengaluru', state: 'Karnataka', pin: '560038', gstin: '', pan: '',
  pocName: 'Asha Rao', designation: 'Marketing head', email, phone: '9876543210', billingEmail: '',
  brief: Object.fromEntries(questions.map((q) => [q.id, q.links ? { picked: [], other: '', text: '', links: ['https://example.test/1', 'https://example.test/2', 'https://example.test/3'] } : (q.fields ?? []).length ? { picked: [], other: '', text: '', fields: { [q.fields[0]]: 'Warm and bold' } } : q.text ? { picked: [], other: '', text: 'Curious and hungry' } : { picked: [q.options[0]], other: '', text: '' }])),
  references: ['https://example.test/1', 'https://example.test/2', 'https://example.test/3'],
});
const agClient = await api('POST', '/agency/clients', { portalPassword: 'generate', name: 'Acme Foods', contactName: 'Asha Rao', contactEmail: 'asha@acme.test', retainerCents: 5000000, piecesPerMonth: 8, hoursPerMonth: 20, channels: ['YouTube', 'Instagram'], renewalDate: new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10) }, M.token);
const lockedClient = await api('POST', '/agency/clients', { portalPassword: 'generate', contactEmail: 'ira@bloom.test', name: 'Bloom Skincare', retainerCents: 3000000, piecesPerMonth: 4, status: 'lead' }, M.token);
const formClient = await api('POST', '/agency/clients', { portalPassword: 'generate', contactEmail: 'team@north.test', name: 'North Studio', retainerCents: 1500000, status: 'paused', health: 'amber' }, M.token);
if (formClient.id) await api('PUT', `/agency/clients/${formClient.id}/password`, { clear: true }, M.token);
if (agClient.id) {
  await api('PUT', `/agency/clients/${agClient.id}/password`, { clear: true }, M.token);
  const form = await api('GET', `/public/agency/${agClient.portalToken}/onboarding`);
  await api('POST', `/public/agency/${agClient.portalToken}/onboarding/submit`, { draft: onboardingDraft(form.questions ?? [], 'Acme Foods', 'asha@acme.test') });
}
let agencyPaths = [];
if (agClient.id) {
  const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const mkItem = (b) => api('POST', '/agency/items', { clientId: agClient.id, ...b }, M.token);
  await mkItem({ title: 'Founder story reel', kind: 'short', platform: 'Instagram', stage: 'published', dueDate: day(-3), feeCents: 400000 });
  const waiting = await mkItem({ title: 'Launch video', kind: 'video', platform: 'YouTube', stage: 'review', dueDate: day(2), publishDate: day(4), link: 'https://example.com/launch' });
  await mkItem({ title: 'Customer voices, part 1', kind: 'short', platform: 'Instagram', stage: 'making', dueDate: day(-1) });
  await mkItem({ title: 'Weekly newsletter', kind: 'newsletter', platform: 'Newsletter', stage: 'script', dueDate: day(5) });
  await mkItem({ title: 'Recipe carousel', kind: 'carousel', platform: 'Instagram', stage: 'idea' });
  await mkItem({ title: 'Approved teaser', kind: 'short', platform: 'YouTube', stage: 'approved', publishDate: day(6) });
  if (waiting.id) {
    await api('POST', `/agency/items/${waiting.id}/notes`, { body: 'Cut is attached, ready for a look.', shared: true }, M.token);
    await api('POST', `/agency/items/${waiting.id}/notes`, { body: 'They usually ask for a longer intro.', shared: false }, M.token);
  }
  await api('POST', '/agency/time', { clientId: agClient.id, day: today, minutes: 150, billable: true, note: 'Editing' }, M.token);
  const inv = await api('POST', '/agency/invoices', { clientId: agClient.id, items: [{ description: 'Monthly retainer', quantity: 1, unitCents: 5000000 }, { description: 'Founder story reel', quantity: 1, unitCents: 400000 }] }, M.token);
  if (inv.invoice?.id) await api('PATCH', `/agency/invoices/${inv.invoice.id}`, { status: 'sent' }, M.token);
  const kc = await api('POST', '/agency/contracts', { templateKey: 'trial', clientId: agClient.id }, M.token);
  let contractToken = null;
  if (kc.id) contractToken = (await api('PATCH', `/agency/contracts/${kc.id}`, { status: 'sent' }, M.token)).contract?.token ?? null;
  const portal = await api('POST', `/agency/clients/${agClient.id}/portal`, { on: true, show: { hours: true, invoices: true, contracts: true } }, M.token);
  await api('PUT', '/reviews/kpis/settings', { enabled: true }, M.token);
  await api('POST', '/reviews/kpis', { name: 'Pieces published', source: 'published', cadence: 'month', target: 8 }, M.token);
  await api('POST', '/reviews/kpis', { name: 'Sales calls', unit: 'number', direction: 'up', cadence: 'month', target: 20 }, M.token);
  agencyPaths = ['/agency', '/agency?tab=pipeline', '/agency?tab=clients', '/agency?tab=clients&cview=list', '/agency?tab=invoices', '/agency?tab=agreements', '/agency?tab=settings', `/agency/${agClient.id}`, inv.invoice?.id ? `/agency/invoices/${inv.invoice.id}` : null, kc.id ? `/agency/contracts/${kc.id}` : null, '/reviews?kind=month'];
  if (portal.portalToken) site.push(`/a/${portal.portalToken}`);
  if (lockedClient.portalToken) site.push(`/a/${lockedClient.portalToken}`);
  if (formClient.portalToken) site.push(`/a/${formClient.portalToken}`);
  if (inv.invoice?.token) site.push(`/i/${inv.invoice.token}`);
  if (contractToken) site.push(`/k/${contractToken}`);
}

// The newer pages, with real data: movement, eating and gratitude, a daily review, a coach with a student who shares, a lesson with several resources.
const dayBefore = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
await api('POST', '/fitness/move', { date: today, kind: 'swim', minutes: 30, metres: 1000, effort: 3 }, M.token);
await api('POST', '/fitness/move', { date: dayBefore, kind: 'walk', minutes: 40, metres: 3000, effort: 2 }, M.token);
await api('PUT', '/fitness/eat', { date: today, meals: [{ moment: 'breakfast', protein: true, goodFuel: true }, { moment: 'lunch', protein: true, tasty: true }], fruit: 1, veg: 2, packaged: 0, screenFree: 1 }, M.token);
const gratitudeKeys = (await api('GET', `/journal/gratitude?day=${today}&today=${today}`, undefined, M.token)).prompts ?? [];
if (gratitudeKeys.length) await api('PUT', `/journal/gratitude/${today}`, { lines: gratitudeKeys.map((prompt, i) => ({ prompt, text: i === 0 ? 'A long walk with an old friend' : '' })), today, ifUpdatedAt: '' }, M.token);
await api('PUT', '/reviews', { kind: 'day', date: today, answers: ['Kept the morning clear'], rating: 4 }, M.token);
await admin('POST', `/admin/users/${M.user.id}/permissions`, { permissions: ['coach'] });
await api('POST', '/onboarding', { answers, displayName: 'Third' }, T.token);
await api('POST', '/onboarding/build', { relationships: ['self', 'friendship'], date: today }, T.token);
await api('POST', '/today/checkin', { date: today }, T.token);
await api('POST', '/wellbeing/mood', { value: 4, date: today }, T.token);
await api('PATCH', '/me/modules', { key: 'fitness', on: true }, T.token);
const taught = await admin('POST', '/admin/coaching/links', { coachId: M.user.id, student: T.user.email, mode: 'link' });
if (taught.link?.id) await api('PATCH', `/me/coach/links/${taught.link.id}/share`, { patterns: true }, T.token);
const lessonId = 'prog-onboarding-l01';
const taughtLessons = await api('GET', '/school/cohorts/coh-onboarding', undefined, M.token);
if ((taughtLessons.items?.find((i) => i.id === lessonId)?.resources?.length ?? 0) < 3) {
  await api('POST', `/school/items/${lessonId}/resources`, { kind: 'video', ref: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', label: 'Watch it first' }, M.token);
  await api('POST', `/school/items/${lessonId}/resources`, { kind: 'book', ref: 'the-relationship-method' }, M.token);
  await api('POST', `/school/items/${lessonId}/resources`, { kind: 'link', ref: 'https://example.com/notes', label: 'Notes on the web' }, M.token);
}
await api('POST', '/school/cohorts/coh-onboarding/enroll', {}, T.token);

const stateDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'state');
fs.mkdirSync(stateDir, { recursive: true });
fs.writeFileSync(path.join(stateDir, 'shoot-token'), M.token);
fs.writeFileSync(path.join(stateDir, 'shoot-token-student'), T.token);

site.unshift('/', '/features', '/7rp', '/explore', '/features/school', '/features/books', '/licences', '/subprocessors', '/copyright', '/c/nope', '/i/nope', '/terms', '/privacy', '/refunds', '/contact', '/pricing', '/start', '/signin', '/forgot', '/signin/reset?token=nope', '/signup', `/u/sell${stamp}`.slice(0, 24), `/people/${S.user.id}`, sold.product?.id ? `/p/${sold.product.id}` : null, '/events', event.event?.id ?? event.id ? `/events/${event.event?.id ?? event.id}` : null);
const app = [...agencyPaths, '/onboarding', '/session', '/vibe-check', '/home', '/today', '/tower', '/realm/self', '/apps', '/you', '/search', '/profile', '/help', '/insights', '/insights?kind=month', '/insights?kind=day', '/inbox', '/leaderboard', '/rewards', '/school', '/school/coh-editing-open', '/work', opp.id ? `/work/${opp.id}` : null, '/army', camp.id ? `/army/${camp.id}` : null, '/win', reward.id ? `/win/${reward.id}` : null, '/party', event.event?.id ?? event.id ? `/party/${event.event?.id ?? event.id}` : null, '/run', club.club?.id ?? club.id ? `/run/clubs/${club.club?.id ?? club.id}` : null, '/run?tab=tracking', '/run?tab=collabs', '/community', '/club', '/bond', chat.chat?.id ?? chat.id ? `/bond/chats/${chat.chat?.id ?? chat.id}` : null, '/circles', groupId ? `/circles/${groupId}` : null, '/life', '/reviews', '/wellbeing', '/mood', '/sleep', '/stress', '/mindful', '/journal', '/companion', '/knowledge', resourceId ? `/knowledge/${resourceId}` : null, '/tools', '/tv', '/fund', '/sessions', '/library', sold.product?.id ? `/library/${sold.product.id}` : null, '/shop', '/store', mine.product?.id ? `/shop/products/${mine.product.id}` : null, '/shop/page', '/shop/bookings', '/shop/testimonials', '/shop/audience', '/shop/content', '/shop/automations', '/shop/customers', '/shop/dm', '/finance', '/fitness', '/time-blocks', '/cards', '/discover', '/book', '/plans', '/coaching', `/coaching/students/${T.user.id}`, '/school/coh-onboarding', '/reviews?kind=day', '/insights?kind=week', '/internal/observability', '/internal/logs', '/manage', '/admin', '/admin/guide', '/nowhere-at-all'];
const shots = [...site.filter(Boolean).map((p) => ({ path: p, name: `all-${p.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'site'}` })), ...app.filter(Boolean).map((p) => ({ path: p, needsSession: true, name: `all-${p.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}` }))];
process.stdout.write(JSON.stringify(shots, null, 1));
console.error(`${shots.length} shots; token in ${path.join(stateDir, 'shoot-token')}`);
