// What one active person's day costs on Workers Free: a real browser opens the screens a person opens, the writes go through the same routes, and the test server's
// D1 headers are added up (apps/api/src/d1Guard.ts). Needs a server with D1_GUARD set (blueprint.sh and the test server's script set it).
//   node --experimental-strip-types scripts/smoke/drive-day.mjs
// Prints each step, the first day (a new account) and an ordinary day, and how many people a day fit under each daily limit on Free.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { QUESTIONS } from '../../packages/shared/src/index.ts';
import { openJoining } from './openJoining.mjs';

const ORIGIN = process.env.SMOKE_ORIGIN ?? 'http://127.0.0.1:8788';
// Joining is by invite (migration 0125): on the test server, turn Invite only off so this script's own sign-ups work.
await openJoining(ORIGIN);
if (/:(5173|8787)\b/.test(ORIGIN)) throw new Error('never on the founder\'s dev app: use the test server on 8788');
const LIMITS = { requests: 100_000, read: 5_000_000, written: 100_000 };
const stamp = Date.now().toString(36);
const ip = `10.96.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const chrome = () => {
  const list = [process.env.SHOOT_CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome'].filter(Boolean);
  const cache = path.join(process.env.HOME ?? '', '.cache/puppeteer/chrome');
  if (fs.existsSync(cache)) for (const v of fs.readdirSync(cache)) list.push(path.join(cache, v, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'));
  const found = list.find((p) => fs.existsSync(p));
  if (!found) throw new Error('no Chrome found; set SHOOT_CHROME');
  return found;
};

const blank = () => ({ requests: 0, trips: 0, read: 0, written: 0, peak: 0 });
const add = (t, res) => {
  t.requests += 1;
  t.trips += Number(res.headers.get?.('x-d1-round-trips') ?? 0);
  t.read += Number(res.headers.get?.('x-d1-rows-read') ?? 0);
  t.written += Number(res.headers.get?.('x-d1-rows-written') ?? 0);
  t.peak = Math.max(t.peak, Number(res.headers.get?.('x-d1-round-trips') ?? 0));
};
const line = (name, t) => console.log(`${name.padEnd(30)} ${String(t.requests).padStart(4)} requests ${String(t.read).padStart(7)} rows read ${String(t.written).padStart(6)} rows written  peak ${t.peak} trips`);

let token = '';
let bucket = blank();
async function call(method, p, body) {
  const res = await fetch(`${ORIGIN}/api${p}`, { method, headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  add(bucket, res);
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) };
  } catch {
    return { status: res.status, json: {} };
  }
}

// ---- the first day: an account, the setup, the first pyramid. Everything a new person costs before an ordinary day starts.
// With DRIVE_DAY_TOKEN an account prepared elsewhere (months of data) has the ordinary day instead, and the first day is left out.
const first = blank();
const seeding = blank();
const given = process.env.DRIVE_DAY_TOKEN ?? '';
let project = null;
const taskIds = [];
if (given) {
  token = given;
  bucket = blank();
  const open = await call('GET', `/today?date=${today}`);
  for (const t of open.json.tasks ?? []) if (taskIds.length < 4) taskIds.push(t.id);
  project = { id: open.json.tasks?.[0]?.parentId ?? null };
} else {
bucket = first;
const made = await call('POST', '/auth/signup', { email: `day-${stamp}@smoke.test`, password: `Harbour-${stamp}-pass`, displayName: 'One Person', phone: '+91 98765 43210', birthDate: '1990-05-20', acceptTerms: true });
token = made.json.token;
await call('POST', '/onboarding/setup', { goals: ['focus'], identities: ['student'], blockers: [], apps: ['journal', 'mood', 'sleep', 'wellbeing'] });
const answers = QUESTIONS.filter((q) => q.relationship === 'self' || q.relationship === 'friendship').map((q) => ({ questionId: q.id, value: 2 }));
await call('POST', '/onboarding', { answers, displayName: 'One Person' });
const built = await call('POST', '/onboarding/build', { relationships: ['self', 'friendship'], date: today });
project = (built.json.nodes ?? []).find((n) => n.kind === 'project');
for (const key of ['journal', 'mood', 'sleep', 'wellbeing', 'mindful', 'reviews']) await call('PATCH', '/me/modules', { key, on: true });
for (let i = 0; i < 6; i++) {
  const t = await call('POST', '/nodes', { kind: 'task', parentId: project?.id, relationship: 'self', title: `Day task ${i}`, doDate: today, estimate: 25 });
  if (t.json.node?.id ?? t.json.id) taskIds.push(t.json.node?.id ?? t.json.id);
}
// The first open of Daily: it writes no time blocks since 2026-11-07, and is kept apart so a sign-up's cost stays easy to read.
bucket = seeding;
await call('GET', `/today?date=${today}`);
}

// ---- an ordinary day: the screens a person opens, in a real browser, so every request the app makes is counted.
const browser = await puppeteer.launch({ executablePath: chrome(), headless: true, args: ['--no-first-run', '--disable-gpu'] });
const day = blank();
const steps = [];
try {
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': ip });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument((t) => localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 })), token);
  await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle0' });
  await page.evaluate(async () => {
    for (const r of (await navigator.serviceWorker?.getRegistrations?.()) ?? []) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
  });
  let open = blank();
  const seen = [];
  page.on('response', (res) => {
    const url = new URL(res.url());
    if (!url.pathname.startsWith('/api/')) return;
    const h = res.headers();
    const fake = { headers: { get: (k) => h[k] } };
    add(open, fake);
    seen.push([url.pathname, Number(h['x-d1-rows-read'] ?? 0), Number(h['x-d1-rows-written'] ?? 0), Number(h['x-d1-round-trips'] ?? 0)]);
  });
  const visit = async (name, route, times = 1) => {
    for (let i = 0; i < times; i++) {
      open = blank();
      await page.goto(`${ORIGIN}${route}`, { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 300));
      steps.push([`${name}${times > 1 ? ` (${i + 1} of ${times})` : ''}`, open]);
      if (process.env.DRIVE_DAY_ROWS) for (const [p, r, w, n] of seen.splice(0)) console.log(`   ${String(r).padStart(6)} read ${String(w).padStart(3)} written ${String(n).padStart(3)} trips  ${p}`);
      for (const k of ['requests', 'trips', 'read', 'written']) day[k] += open[k];
      day.peak = Math.max(day.peak, open.peak);
    }
  };
  // Three looks at Home and Daily through the day, one each at the other screens someone uses most.
  await visit('Home', '/home', 2);
  await visit('Daily', '/today', 3);
  await visit('Pillars', '/tower');
  await visit('Journal', '/journal');
  await visit('Mood', '/mood');
} finally {
  await browser.close();
}
const reads = { requests: day.requests, trips: day.trips, read: day.read, written: day.written, peak: day.peak };
const writes = blank();
bucket = writes;
// Writes: the check-in, ticks, a journal line, the trackers, water, one new task.
await call('POST', '/today/checkin', { date: today });
const openNow = (await call('GET', `/today?date=${today}`)).json;
for (const id of taskIds.slice(0, 4)) await call('POST', `/nodes/${id}/complete`, { date: today });
await call('POST', '/nodes', { kind: 'task', parentId: project?.id, relationship: 'self', title: 'Another one', doDate: today });
await call('POST', '/journal', { title: 'A line', body: 'A line about the day.' });
await call('POST', '/wellbeing/mood', { value: 4, date: today });
await call('POST', '/wellbeing/sleep', { value: 7, date: today, extra: { quality: 4 } });
for (let i = 0; i < 3; i++) await call('POST', '/reminders/water', { day: today });

for (const [name, t] of steps) line(name, t);
console.log('');
line('First day: sign-up to pillars', first);
line('First open of Daily', seeding);
line('An ordinary day: the screens', reads);
line('An ordinary day: the writes', writes);
const total = { requests: reads.requests + writes.requests, read: reads.read + writes.read, written: reads.written + writes.written };
console.log(`\nA person's ordinary day: ${total.requests} requests, ${total.read} rows read, ${total.written} rows written`);
const fit = { requests: Math.floor(LIMITS.requests / total.requests), read: Math.floor(LIMITS.read / total.read), written: Math.floor(LIMITS.written / total.written) };
console.log(`People a day under each limit, before the cron: ${fit.requests} by requests, ${fit.read} by rows read, ${fit.written} by rows written`);
const signup = { written: first.written + seeding.written, read: first.read + seeding.read, requests: first.requests + seeding.requests };
console.log(`A new account: ${signup.requests} requests, ${signup.read} rows read, ${signup.written} rows written, so ${Math.floor(LIMITS.written / signup.written)} sign-ups a day use all the writes`);
if (process.env.DRIVE_DAY_JSON) fs.writeFileSync(process.env.DRIVE_DAY_JSON, JSON.stringify({ steps, first, seeding, reads, writes, total, fit, signup }, null, 1));
