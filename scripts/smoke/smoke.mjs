// The smoke checks. Run through blueprint.sh, which starts the server this talks to.
// Node imports the shared model straight from TypeScript (--experimental-strip-types).
import { QUESTIONS, XP, POINTS, WAIT, RUN_REWARD, SOCIAL_REWARDS, MAX_NOT_TO_DO, MODULES, FEATURE_FEE_POINTS } from '../../packages/shared/src/index.ts';
import { LIMITS } from '../../apps/api/src/limits.ts';

const ORIGIN = process.env.SMOKE_ORIGIN ?? 'http://127.0.0.1:8788';
const ADMIN_KEY = process.env.SMOKE_ADMIN_KEY ?? 'smoke-admin-key';
const API = `${ORIGIN}/api`;
const stamp = Date.now().toString(36);
const today = new Date().toISOString().slice(0, 10);

let passed = 0;
let failed = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) passed += 1;
  else {
    failed += 1;
    const why = detail === '' || detail === undefined ? '' : typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 300);
    failures.push(`${name}${why ? `  (${why})` : ''}`);
    console.log(`  FAIL ${name}${why ? `\n       ${why}` : ''}`);
  }
}
function section(title) {
  console.log(`\n${title}`);
}

// The limiter keys on the forwarded address, so each run gets its own and never trips a rerun on the same database.
const seed = Number.parseInt(stamp.slice(-6), 36);
const ADDRESS = `10.${(seed >> 16) & 255}.${(seed >> 8) & 255}.${seed & 255}`;
const SPARE_ADDRESS = `10.${(seed >> 16) & 255}.${(seed >> 8) & 255}.${(seed + 1) & 255}`;
async function api(method, path, body, token, headers = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ADDRESS, ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, headers: res.headers };
}
const admin = (method, path, body) => api(method, path, body, null, { 'X-Admin-Key': ADMIN_KEY });
const userOf = (r) => r.json?.user ?? r.json;
async function me(token) {
  return userOf(await api('GET', '/me', undefined, token));
}
const GROWN = '1990-05-20';
const PHONE = '+91 98765 43210';
async function signup(email, password, displayName) {
  const r = await api('POST', '/auth/signup', { email, password, displayName, phone: PHONE, birthDate: GROWN });
  if (r.status !== 201) throw new Error(`signup ${email} failed: ${r.status} ${JSON.stringify(r.json)}`);
  return { token: r.json.token, user: r.json.user };
}

// ---------------------------------------------------------------- health and headers
section('Health');
{
  const h = await api('GET', '/health');
  check('health answers', h.status === 200 && h.json.ok === true, h.json);
  check('security headers on every answer', h.headers.get('x-content-type-options') === 'nosniff', h.headers.get('x-content-type-options'));
  const noAuth = await api('GET', '/me');
  check('no session means 401', noAuth.status === 401, noAuth.status);
  const site = await fetch(`${ORIGIN}/`);
  const html = await site.text();
  check('site home served by the worker', site.status === 200 && html.includes('og:image'), site.status);
  check('share image is absolute', /og:image"?\s+content="http/.test(html) || /content="http[^"]+"\s+property="og:image"/.test(html), html.match(/og:image[^>]*/)?.[0]);
  const sm = await fetch(`${ORIGIN}/sitemap.xml`);
  check('sitemap answers', sm.status === 200 && (await sm.text()).includes('<urlset'), sm.status);
  const cron = await fetch(`${ORIGIN}/__scheduled?cron=*+*+*+*+*`);
  check('cron can be run by hand', cron.status === 200, cron.status);
}

// ---------------------------------------------------------------- auth
section('Auth');
const founderEmail = 'founder@smoke.test';
const founderPass = process.env.SMOKE_FOUNDER_PASS ?? 'Mountain-smoke-ok';
let A; // founder, becomes admin
let B; // a buyer and runner
let C; // a seller and a run host
{
  const weak = await api('POST', '/auth/signup', { email: `weak-${stamp}@smoke.test`, password: 'password', phone: PHONE, birthDate: GROWN }, null, { 'CF-Connecting-IP': SPARE_ADDRESS });
  check('a common password is refused', weak.status === 400, weak.json);
  const repeat = await api('POST', '/auth/signup', { email: `rep-${stamp}@smoke.test`, password: 'aaaaaaaaaa', phone: PHONE, birthDate: GROWN }, null, { 'CF-Connecting-IP': SPARE_ADDRESS });
  check('one character repeated is refused', repeat.status === 400, repeat.json);
  const own = await api('POST', '/auth/signup', { email: `gururaj-${stamp}@smoke.test`, password: `gururaj-${stamp}xyz`, phone: PHONE, birthDate: GROWN }, null, { 'CF-Connecting-IP': SPARE_ADDRESS });
  check('the email inside the password is refused', own.status === 400, own.json);
  const badEmail = await api('POST', '/auth/signup', { email: 'nope', password: `Fine-${stamp}-pass`, phone: PHONE, birthDate: GROWN }, null, { 'CF-Connecting-IP': SPARE_ADDRESS });
  check('a bad email is refused', badEmail.status === 400, badEmail.json);
  const young = await api('POST', '/auth/signup', { email: `young-${stamp}@smoke.test`, password: `Fine-${stamp}-pass`, phone: PHONE, birthDate: new Date(Date.now() - 17 * 365.25 * 86_400_000).toISOString().slice(0, 10) }, null, { 'CF-Connecting-IP': SPARE_ADDRESS });
  check('anyone under eighteen is refused', young.status === 400 && /18/.test(young.json.error ?? ''), young.json);
  const noBirthday = await api('POST', '/auth/signup', { email: `nobday-${stamp}@smoke.test`, password: `Fine-${stamp}-pass`, phone: PHONE }, null, { 'CF-Connecting-IP': SPARE_ADDRESS });
  check('a date of birth is required', noBirthday.status === 400, noBirthday.json);
  const badPhone = await api('POST', '/auth/signup', { email: `phone-${stamp}@smoke.test`, password: `Fine-${stamp}-pass`, phone: '12', birthDate: GROWN }, null, { 'CF-Connecting-IP': SPARE_ADDRESS });
  check('a phone number is required and checked', badPhone.status === 400, badPhone.json);

  // The founder address may already exist from an earlier run on the same database: sign in then.
  const first = await api('POST', '/auth/signup', { email: founderEmail, password: founderPass, displayName: 'Smoke founder', phone: PHONE, birthDate: GROWN });
  if (first.status === 201) A = { token: first.json.token, user: first.json.user };
  else {
    const prev = await api('POST', '/auth/signin', { email: founderEmail, password: founderPass, phone: PHONE, birthDate: GROWN });
    if (prev.status !== 200) {
      // The old password is unknown: make the smoke database fresh (blueprint.sh --fresh) or pass SMOKE_FOUNDER_PASS.
      console.log(`  founder sign-up answered ${first.status} ${JSON.stringify(first.json)} and sign-in ${prev.status}; run blueprint.sh --fresh or pass SMOKE_FOUNDER_PASS`);
      process.exit(2);
    }
    A = { token: prev.json.token, user: prev.json.user };
  }
  check('founder email becomes admin on sign-up', A.user.role === 'admin', A.user.role);
  const dup = await api('POST', '/auth/signup', { email: founderEmail, password: founderPass, phone: PHONE, birthDate: GROWN });
  check('a second sign-up with the same email is refused', dup.status === 409, dup.json);

  B = await signup(`buyer-${stamp}@smoke.test`, `Lantern-${stamp}-pass`, 'Smoke buyer');
  C = await signup(`seller-${stamp}@smoke.test`, `Harbour-${stamp}-pass`, 'Smoke seller');
  check('a plain sign-up is a user', B.user.role === 'user', B.user.role);
  check('the phone is kept in digits and the birthday as given', B.user.phone === '+919876543210' && B.user.birthDate === GROWN, { phone: B.user.phone, birthDate: B.user.birthDate });
  check('sign-up creates nothing but the account', B.user.xp === 0 && B.user.points === 0 && B.user.streak === 0, { xp: B.user.xp, points: B.user.points });

  const wrong = await api('POST', '/auth/signin', { email: `buyer-${stamp}@smoke.test`, password: 'not-the-password-1' });
  const unknown = await api('POST', '/auth/signin', { email: `nobody-${stamp}@smoke.test`, password: 'not-the-password-1' });
  check('wrong password is 401', wrong.status === 401, wrong.json);
  check('unknown email answers the same as a wrong password', unknown.status === wrong.status && JSON.stringify(unknown.json) === JSON.stringify(wrong.json), [wrong.json, unknown.json]);

  const second = await api('POST', '/auth/signin', { email: `buyer-${stamp}@smoke.test`, password: `Lantern-${stamp}-pass` });
  check('sign-in works', second.status === 200 && second.json.token, second.status);
  const badCurrent = await api('POST', '/me/password', { current: 'wrong-current-1', password: `Lantern-${stamp}-new` }, B.token);
  check('password change needs the current password', badCurrent.status === 400, badCurrent.json);
  const changed = await api('POST', '/me/password', { current: `Lantern-${stamp}-pass`, password: `Lantern-${stamp}-new` }, B.token);
  check('password change works', changed.status === 200, changed.json);
  const otherGone = await api('GET', '/me', undefined, second.json.token);
  check('password change signs out every other device', otherGone.status === 401, otherGone.status);
  const stillMe = await api('GET', '/me', undefined, B.token);
  check('the changing device stays signed in', stillMe.status === 200, stillMe.status);

  const forgotKnown = await api('POST', '/auth/forgot', { email: `buyer-${stamp}@smoke.test` });
  const forgotUnknown = await api('POST', '/auth/forgot', { email: `ghost-${stamp}@smoke.test` });
  check('forgot answers the same for any email', forgotKnown.status === 200 && JSON.stringify(forgotKnown.json) === JSON.stringify(forgotUnknown.json), [forgotKnown.json, forgotUnknown.json]);
  const badReset = await api('POST', '/auth/reset', { token: 'f'.repeat(64), password: `Reset-${stamp}-pass` });
  check('an unknown reset token is refused', badReset.status === 400, badReset.json);
  const outbox = await admin('GET', '/admin/outbox');
  check('the reset mail waits in the outbox', outbox.status === 200 && JSON.stringify(outbox.json).includes('Reset your kreators.app password'), outbox.status);

  const anon = await api('POST', '/auth/anon', {});
  check('an anonymous device session starts', anon.status === 201 && anon.json.token && anon.json.user.email === null, anon.status);
  const defaults = MODULES.filter((m) => m.defaultOn).map((m) => m.key);
  const anonMe = await me(anon.json.token);
  const on = Object.entries(anonMe.modules ?? {}).filter(([, v]) => v).map(([k]) => k);
  check('only the default apps start on', defaults.every((k) => anonMe.modules?.[k] !== false) && on.every((k) => defaults.includes(k)), { on, defaults });
  const attach = await api('POST', '/auth/signup', { email: `device-${stamp}@smoke.test`, password: `Compass-${stamp}-pass`, phone: PHONE, birthDate: GROWN }, anon.json.token);
  check('a device session keeps its progress when an email is added', attach.status === 201 && attach.json.user.id === anon.json.user.id, attach.json?.user?.id);
  const signout = await api('POST', '/auth/signout', {}, attach.json.token);
  const after = await api('GET', '/me', undefined, attach.json.token);
  check('sign out ends the session', signout.status === 200 && after.status === 401, after.status);
}

// ---------------------------------------------------------------- onboarding and the pyramid
section('Onboarding');
let project;
let ladderTasks = [];
{
  const rels = ['self', 'friendship'];
  const answers = QUESTIONS.filter((q) => rels.includes(q.relationship)).map((q) => ({ questionId: q.id, value: 1 }));
  const empty = await api('POST', '/onboarding', { answers: [] }, B.token);
  check('onboarding needs answers', empty.status === 400, empty.json);
  const scored = await api('POST', '/onboarding', { answers, displayName: 'Smoke buyer' }, B.token);
  check('onboarding scores the answered pillars', scored.status === 200 && scored.json.answered?.length === 2 && Object.keys(scored.json.ladders ?? {}).length >= 2, scored.json?.answered);
  const built = await api('POST', '/onboarding/build', { relationships: rels, date: today, picks: { self: { project: 'Smoke project of my own' } } }, B.token);
  check('build makes a six-layer pyramid per pillar', built.status === 201 && built.json.nodes?.length >= 12, built.status);
  const kinds = new Set((built.json.nodes ?? []).map((n) => n.kind));
  check('every layer kind is there', ['pillar', 'principle', 'value_goal', 'outcome', 'project', 'task'].every((k) => kinds.has(k)), [...kinds]);
  project = (built.json.nodes ?? []).find((n) => n.kind === 'project' && n.relationship === 'self');
  check('the person\'s own project wording is kept', project?.title === 'Smoke project of my own', project?.title);
  ladderTasks = (built.json.nodes ?? []).filter((n) => n.kind === 'task' && n.relationship === 'self').sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  check('tasks carry dates two days apart', ladderTasks.length >= 2 && ladderTasks[0].dueDate === today && ladderTasks[1].dueDate > today, ladderTasks.map((t) => t.dueDate));
  const again = await api('POST', '/onboarding/build', { relationships: ['self'], date: today }, B.token);
  check('the same pyramid is not built twice', again.status === 201 && again.json.skipped?.includes('self'), again.json?.skipped);
  const bad = await api('POST', '/nodes', { kind: 'task', parentId: project.id, relationship: 'friendship', title: 'wrong pillar' }, B.token);
  check('a task must sit under a project of its own pillar', bad.status === 400, bad.json);
}

// ---------------------------------------------------------------- tasks and waits
section('Tasks');
{
  const before = await me(B.token);
  const first = await api('POST', `/nodes/${ladderTasks[0].id}/complete`, { date: today }, B.token);
  check('a task due today can be ticked', first.status === 200, first.json);
  const afterFirst = await me(B.token);
  const ripple = Object.values(XP.ripple).reduce((s, v) => s + v, 0);
  check(`a tick pays ${XP.task} xp`, afterFirst.xp - before.xp === XP.task, { gained: afterFirst.xp - before.xp, expected: XP.task });
  check('the ripple lands on every layer above', Array.isArray(first.json.ripple) && first.json.ripple.length === 6 && first.json.ripple.filter((r) => r.kind !== 'task').reduce((s, r) => s + r.amount, 0) === ripple, first.json?.ripple);
  const twice = await api('POST', `/nodes/${ladderTasks[0].id}/complete`, { date: today }, B.token);
  check('ticking a done task is a quiet 409', twice.status === 409, twice.status);
  const early = await api('POST', `/nodes/${ladderTasks[1].id}/complete`, { date: today }, B.token);
  check('a task with a date waits for the day', early.status === 400 && /Tick it on the day/.test(early.json.error ?? ''), early.json);
  const made = [];
  for (let i = 0; i < 3; i += 1) {
    const r = await api('POST', '/nodes', { kind: 'task', parentId: project.id, relationship: 'self', title: `Smoke task ${i}` }, B.token);
    check(`a task can be added (${i})`, r.status === 201 && r.json.node?.id, r.json);
    made.push(r.json.node);
  }
  const t2 = await api('POST', `/nodes/${made[0].id}/complete`, { date: today }, B.token);
  const t3 = await api('POST', `/nodes/${made[1].id}/complete`, { date: today }, B.token);
  check(`the first ${WAIT.freeFirstTasks} ticks are free`, t2.status === 200 && t3.status === 200, [t2.status, t3.status]);
  const t4 = await api('POST', `/nodes/${made[2].id}/complete`, { date: today }, B.token);
  check('the fourth tick waits', t4.status === 429 && t4.json.readyInMinutes >= 1, t4.json);
  const undo = await api('POST', `/nodes/${made[0].id}/uncomplete`, {}, B.token);
  check('a tick can be undone', undo.status === 200, undo.json);
  const afterUndo = await me(B.token);
  check('undoing takes the xp back', afterUndo.xp === afterFirst.xp + XP.task, { xp: afterUndo.xp, expected: afterFirst.xp + XP.task });
  const list = await api('GET', '/nodes', undefined, B.token);
  check('nodes list answers', list.status === 200, list.status);
  const todayRes = await api('GET', `/today?date=${today}`, undefined, B.token);
  check('today answers with tasks and a small act', todayRes.status === 200 && Array.isArray(todayRes.json.tasks), Object.keys(todayRes.json ?? {}));
}

// ---------------------------------------------------------------- daily: check-in, small act, not to do
section('Daily');
{
  const before = await me(B.token);
  const checkin = await api('POST', '/today/checkin', { date: today }, B.token);
  check(`check-in pays ${XP.checkin} xp and ${POINTS.checkin} points`, checkin.status === 200 && checkin.json.awarded === XP.checkin && checkin.json.points === POINTS.checkin && checkin.json.streak === 1, checkin.json);
  const again = await api('POST', '/today/checkin', { date: today }, B.token);
  check('a second check-in pays nothing', again.json.alreadyCheckedIn === true && again.json.awarded === 0, again.json);
  const old = await api('POST', '/today/checkin', { date: '2020-01-01' }, B.token);
  check('a check-in for another day is refused', old.status === 400, old.json);
  const spark = await api('POST', '/today/spark', { date: today }, B.token);
  check(`the small act pays ${XP.spark} xp`, spark.status === 200 && spark.json.awarded === XP.spark, spark.json);
  const spark2 = await api('POST', '/today/spark', { date: today }, B.token);
  check('the small act pays once a day', spark2.json.alreadyDone === true, spark2.json);
  const after = await me(B.token);
  check('points come from showing up', after.points - before.points === POINTS.checkin, { gained: after.points - before.points });

  const items = [];
  for (let i = 0; i < MAX_NOT_TO_DO; i += 1) {
    const r = await api('POST', '/today/not-to-do', { title: `Stay away ${i}`, relationship: i === 0 ? 'self' : undefined }, B.token);
    if (r.status !== 201) check(`not-to-do item ${i} added`, false, r.json);
    else items.push(r.json.item);
  }
  check(`${MAX_NOT_TO_DO} not-to-do items can be added`, items.length === MAX_NOT_TO_DO, items.length);
  const eighth = await api('POST', '/today/not-to-do', { title: 'One too many' }, B.token);
  check('an eighth is refused', eighth.status === 400, eighth.json);
  const blank = await api('POST', '/today/not-to-do', { title: '   ' }, B.token);
  check('a blank item is refused', blank.status === 400, blank.json);
  const kept = await api('POST', `/today/not-to-do/${items[0].id}/day`, { date: today, status: 'kept' }, B.token);
  check(`a kept day pays ${XP.notToDo} xp and starts the streak`, kept.status === 200 && kept.json.awarded === XP.notToDo && kept.json.item.streak === 1, kept.json);
  const keptAgain = await api('POST', `/today/not-to-do/${items[0].id}/day`, { date: today, status: 'kept' }, B.token);
  check('a kept day pays once', keptAgain.json.awarded === 0 && keptAgain.json.item.streak === 1, keptAgain.json);
  const slipped = await api('POST', `/today/not-to-do/${items[0].id}/day`, { date: today, status: 'slipped' }, B.token);
  check('a slip ends the streak and claws nothing back', slipped.json.item.streak === 0 && slipped.json.awarded === 0, slipped.json);
  const afterSlip = await me(B.token);
  check('the not-to-do xp stays after a slip', afterSlip.xp === after.xp + XP.notToDo, { xp: afterSlip.xp, expected: after.xp + XP.notToDo });
  const far = await api('POST', `/today/not-to-do/${items[1].id}/day`, { date: '2020-01-01', status: 'kept' }, B.token);
  check('only today or yesterday can be marked', far.status === 400, far.json);
  const badStatus = await api('POST', `/today/not-to-do/${items[1].id}/day`, { date: today, status: 'maybe' }, B.token);
  check('an unknown status is refused', badStatus.status === 400, badStatus.json);
  const gone = await api('DELETE', `/today/not-to-do/${items[6].id}`, undefined, B.token);
  check('an item can be removed', gone.status === 200, gone.json);
  const notMine = await api('DELETE', `/today/not-to-do/${items[5].id}`, undefined, C.token);
  check('another person cannot remove my item', notMine.status === 404, notMine.status);
}

// ---------------------------------------------------------------- wellbeing, journal, life
section('Wellbeing');
{
  const logs = [
    ['mood', 4],
    ['sleep', 7.5],
    ['stress', 2],
    ['mindful', 10],
    ['move', 30],
  ];
  for (const [kind, value] of logs) {
    const r = await api('POST', `/wellbeing/${kind}`, { date: today, value }, B.token);
    check(`${kind} can be logged`, r.status === 200 || r.status === 201, r.json);
  }
  const unknown = await api('POST', '/wellbeing/vibes', { value: 3 }, B.token);
  check('an unknown log kind is 404', unknown.status === 404, unknown.status);
  const noValue = await api('POST', '/wellbeing/mood', { date: today }, B.token);
  check('a log needs a value', noValue.status === 400, noValue.json);
  const summary = await api('GET', '/wellbeing/summary', undefined, B.token);
  check('the wellbeing summary answers', summary.status === 200, summary.status);
  const journal = await api('POST', '/journal', { title: 'Smoke entry' }, B.token);
  check('a journal entry can be written', journal.status === 201 && journal.json.entry?.id, journal.json);
  const emptyJ = await api('POST', '/journal', {}, B.token);
  check('an empty journal entry is refused', emptyJ.status === 400, emptyJ.json);
  const list = await api('GET', '/journal', undefined, B.token);
  check('journal lists entries', list.status === 200 && JSON.stringify(list.json).includes('Smoke entry'), list.status);
  const otherList = await api('GET', '/journal', undefined, C.token);
  check('journal entries stay with their owner', otherList.status === 200 && !JSON.stringify(otherList.json).includes('Smoke entry'), otherList.status);
  const life = await api('GET', '/life', undefined, B.token);
  check('life counts the movement minutes', life.status === 200 && /30 min this week/.test(JSON.stringify(life.json)), life.status);
  const home = await api('GET', '/home', undefined, B.token);
  check('home answers in one call', home.status === 200 && home.json.xp && home.json.xp.today > 0, Object.keys(home.json ?? {}));
}

// ---------------------------------------------------------------- finance: integer cents
section('Finance');
{
  const r = await api('POST', '/finance/transactions', { kind: 'income', amountCents: 12345, category: 'Brand deal', counterparty: 'Smoke brand', date: today }, B.token);
  check('an income is recorded in integer cents', r.status === 201 && r.json.transaction?.amountCents === 12345, r.json);
  const rounded = await api('POST', '/finance/transactions', { kind: 'expense', amountCents: 100.7, date: today }, B.token);
  check('a fractional amount is rounded to whole cents', rounded.status === 201 && Number.isInteger(rounded.json.transaction?.amountCents), rounded.json);
  const zero = await api('POST', '/finance/transactions', { kind: 'income', amountCents: 0 }, B.token);
  check('a zero amount is refused', zero.status === 400, zero.json);
  const neg = await api('POST', '/finance/transactions', { kind: 'income', amountCents: -500 }, B.token);
  check('a negative amount is refused', neg.status === 400, neg.json);
  const list = await api('GET', '/finance', undefined, B.token);
  check('finance answers with the month', list.status === 200, list.status);
  const other = await api('GET', '/finance', undefined, C.token);
  check('finance rows stay with their owner', other.status === 200 && !JSON.stringify(other.json).includes('Smoke brand'), other.status);
}

// ---------------------------------------------------------------- shop: products, checkout, unlocks
section('Shop');
{
  const free = await api('POST', '/studio/products', { kind: 'digital', title: `Smoke free download ${stamp}`, pricePoints: 0, status: 'live', url: 'https://example.com/file' }, C.token);
  check('a seller can make a live product', free.status === 201 && free.json.product?.id, free.json);
  const priced = await api('POST', '/studio/products', { kind: 'digital', title: `Smoke priced ${stamp}`, pricePoints: 5, status: 'live' }, C.token);
  const dear = await api('POST', '/studio/products', { kind: 'digital', title: `Smoke dear ${stamp}`, pricePoints: 100000, status: 'live' }, C.token);
  const gated = await api('POST', '/studio/products', { kind: 'digital', title: `Smoke gated ${stamp}`, pricePoints: 0, status: 'live', minPoints: 1000, badge: 'ten_tasks' }, C.token);
  check('a product can carry an unlock', gated.status === 201 && gated.json.product?.minPoints === 1000, gated.json?.product);
  const noTitle = await api('POST', '/studio/products', { kind: 'digital' }, C.token);
  check('a product needs a title', noTitle.status === 400, noTitle.json);

  const own = await api('POST', `/store/${free.json.product.id}/checkout`, {}, C.token);
  check('a seller cannot buy their own product', own.status === 400, own.json);
  const buy = await api('POST', `/store/${free.json.product.id}/checkout`, {}, B.token);
  check('a free product can be taken', buy.status === 200 || buy.status === 201, buy.json);
  const twice = await api('POST', `/store/${free.json.product.id}/checkout`, {}, B.token);
  check('the same product is not bought twice', twice.status === 409, twice.json);
  const before = await me(B.token);
  const sellerBefore = await me(C.token);
  const paid = await api('POST', `/store/${priced.json.product.id}/checkout`, {}, B.token);
  check('a points product is bought with points', paid.status === 200 || paid.status === 201, paid.json);
  const after = await me(B.token);
  const sellerAfter = await me(C.token);
  check('the buyer pays the points', before.points - after.points === 5, { before: before.points, after: after.points });
  check('the seller receives points, minus the fee', sellerAfter.points > sellerBefore.points && sellerAfter.points - sellerBefore.points <= 5, { gained: sellerAfter.points - sellerBefore.points });
  const tooDear = await api('POST', `/store/${dear.json.product.id}/checkout`, {}, B.token);
  check('not enough points is a plain refusal', tooDear.status === 400 && /more points/.test(tooDear.json.error ?? ''), tooDear.json);
  const locked = await api('POST', `/store/${gated.json.product.id}/checkout`, {}, B.token);
  check('a gated checkout is refused with the unlock wording', locked.status === 403 && locked.json.unlock && /Needs/.test(locked.json.error ?? ''), locked.json);
  const page = await api('GET', `/public/products/${gated.json.product.id}`, undefined, B.token);
  check('the product page carries the viewer\'s unlock', page.status === 200 && JSON.stringify(page.json).includes('"unlock"'), [page.status, Object.keys(page.json ?? {})]);
  const library = await api('GET', '/store/library', undefined, B.token);
  check('bought things appear in the library', library.status === 200 && JSON.stringify(library.json).includes(`Smoke free download ${stamp}`), library.status);
  const orders = await api('GET', '/studio/orders', undefined, C.token);
  check('the seller sees the orders', orders.status === 200 && JSON.stringify(orders.json).includes(priced.json.product.id), orders.status);
  const draftOnly = await api('POST', '/studio/products', { kind: 'digital', title: `Smoke draft ${stamp}` }, C.token);
  const notLive = await api('POST', `/store/${draftOnly.json.product.id}/checkout`, {}, B.token);
  check('a draft cannot be bought', notLive.status === 404, notLive.status);
}

// ---------------------------------------------------------------- community: feed, follows, capped rewards
section('Community');
{
  const P = C; // a fresh account each run, so the daily caps start at zero
  const beforeA = await me(P.token);
  const beforeB = await me(B.token);
  const post = await api('POST', '/community', { body: `Smoke post ${stamp}`, category: 'Stories' }, P.token);
  check(`a post pays ${SOCIAL_REWARDS.post.xp} xp`, post.status === 201 && post.json.awarded?.xp === SOCIAL_REWARDS.post.xp, post.json);
  const empty = await api('POST', '/community', { body: '  ' }, P.token);
  check('an empty post is refused', empty.status === 400, empty.json);
  for (let i = 0; i < SOCIAL_REWARDS.post.perDay - 1; i += 1) await api('POST', '/community', { body: `Smoke filler ${stamp} ${i}` }, P.token);
  const capped = await api('POST', '/community', { body: `Smoke over the cap ${stamp}` }, P.token);
  check(`posts past ${SOCIAL_REWARDS.post.perDay} a day pay nothing`, capped.status === 201 && capped.json.awarded?.xp === 0, capped.json?.awarded);
  const like = await api('POST', `/community/${post.json.post.id}/like`, {}, B.token);
  check(`a like pays the liker ${SOCIAL_REWARDS.like.xp} xp`, like.status === 200 && like.json.awarded?.xp === SOCIAL_REWARDS.like.xp, like.json);
  const afterA1 = await me(P.token);
  check(`a like pays the author ${SOCIAL_REWARDS.liked.points} point`, afterA1.points - beforeA.points === SOCIAL_REWARDS.liked.points, { gained: afterA1.points - beforeA.points });
  const unlike = await api('POST', `/community/${post.json.post.id}/like`, {}, B.token);
  const relike = await api('POST', `/community/${post.json.post.id}/like`, {}, B.token);
  check('unliking and liking again pays nothing', unlike.json.post?.liked === false && relike.json.post?.liked === true && relike.json.awarded?.xp === 0, [unlike.json?.post?.liked, relike.json?.awarded]);
  const afterA2 = await me(P.token);
  check('the author is not paid twice for one liker', afterA2.points === afterA1.points, { a1: afterA1.points, a2: afterA2.points });
  const reply = await api('POST', `/community/${post.json.post.id}/replies`, { body: 'Smoke reply' }, B.token);
  check(`a reply pays ${SOCIAL_REWARDS.reply.xp} xp`, reply.status === 201 && reply.json.awarded?.xp === SOCIAL_REWARDS.reply.xp, reply.json);
  const follow = await api('POST', `/community/follow/${P.user.id}`, {}, B.token);
  check('a person can be followed from a post', follow.status === 200 && follow.json.following === true, follow.json);
  const afterA3 = await me(P.token);
  check(`a new follower pays ${SOCIAL_REWARDS.follower.points} points`, afterA3.points - afterA2.points === SOCIAL_REWARDS.follower.points, { gained: afterA3.points - afterA2.points });
  const self = await api('POST', `/community/follow/${B.user.id}`, {}, B.token);
  check('you cannot follow yourself', self.status === 400, self.json);
  const following = await api('GET', '/community?filter=following&sort=popular', undefined, B.token);
  check('the feed filters to people you follow', following.status === 200 && following.json.posts.length > 0 && following.json.posts.every((p) => p.authorId === P.user.id), following.json?.posts?.length);
  const mine = await api('GET', '/community?filter=mine', undefined, B.token);
  check('the feed filters to your own posts', mine.status === 200 && mine.json.posts.length === 0, mine.json?.posts?.length);
  const popular = await api('GET', '/community?sort=popular', undefined, B.token);
  check('popular sorts the liked post first', popular.status === 200 && popular.json.posts[0]?.id === post.json.post.id, popular.json?.posts?.[0]?.id);
  const afterB = await me(B.token);
  check('the liker and replier gained only xp', afterB.xp > beforeB.xp && afterB.points === beforeB.points, { xp: afterB.xp - beforeB.xp, points: afterB.points - beforeB.points });
  const hide = await api('POST', `/manage/community/posts/${post.json.post.id}`, { hidden: true }, B.token);
  check('a plain member cannot moderate', hide.status === 403, hide.status);
}

// ---------------------------------------------------------------- trust and public page
section('Public page');
{
  const handle = `smoke${stamp}`.slice(0, 20);
  const set = await api('PATCH', '/me', { handle }, C.token);
  check('a handle can be set', set.status === 200, set.json);
  const page = await api('GET', `/public/${handle}`);
  check('the public page answers without a session', page.status === 200, page.status);
  check('the public page carries a trust score', JSON.stringify(page.json).includes('trust'), Object.keys(page.json ?? {}));
  check('journal and wellbeing never reach the page', !/journal|wellbeing|mood/i.test(JSON.stringify(page.json)), '');
  const off = await api('PATCH', '/me', { publicSettings: { pagePublic: false } }, C.token);
  const hidden = await api('GET', `/public/${handle}`);
  check('a switched-off page returns only the name', off.status === 200 && hidden.status === 200 && !JSON.stringify(hidden.json).includes(`Smoke priced ${stamp}`), hidden.status);
  await api('PATCH', '/me', { publicSettings: { pagePublic: true } }, C.token);
  const taken = await api('PATCH', '/me', { handle }, B.token);
  check('a handle is unique', taken.status === 400 || taken.status === 409, taken.status);
}

// ---------------------------------------------------------------- reviews by period
section('Reviews');
{
  const summary = await api('GET', `/reviews/summary?kind=week&date=${today}`, undefined, B.token);
  check('a week summary answers with the period before', summary.status === 200 && summary.json.period && summary.json.before, Object.keys(summary.json ?? {}));
  const badKind = await api('PUT', '/reviews', { kind: 'sprint', date: today }, B.token);
  check('only week, month, quarter or half', badKind.status === 400, badKind.json);
  const future = await api('PUT', '/reviews', { kind: 'month', date: `${Number(today.slice(0, 4)) + 1}-06-15`, answers: [] }, B.token);
  check('a period that has not started is refused', future.status === 400, future.json);
  const saved = await api('PUT', '/reviews', { kind: 'week', date: today, answers: ['Smoke went well'], rating: 4, highlight: 'One line to remember' }, B.token);
  check('a weekly review is saved with its snapshot', saved.status === 200 && saved.json.review?.rating === 4 && saved.json.review?.highlight === 'One line to remember', saved.json);
  const again = await api('PUT', '/reviews', { kind: 'week', date: today, answers: ['Changed my mind'], rating: 3 }, B.token);
  check('one review per period, rewritten in place', again.status === 200 && again.json.review?.id === saved.json.review?.id && again.json.review?.rating === 3, again.json?.review?.id);
  const list = await api('GET', `/reviews?kind=week&date=${today}`, undefined, B.token);
  check('reviews lists the built-in template and recent reviews', list.status === 200 && list.json.templates?.some((t) => t.builtIn) && list.json.recent?.length >= 1, list.status);
  const tpl = await api('POST', '/reviews/templates', { kind: 'month', name: 'Smoke template', prompts: ['What moved?', 'What next?'] }, B.token);
  check('a person can add a recurring template', tpl.status === 201 || tpl.status === 200, tpl.json);
}

// ---------------------------------------------------------------- store: pre-owned, offers, partner links
section('Store');
{
  const listing = await api('POST', '/market/listings', { title: `Smoke camera ${stamp}`, priceCents: 500000, condition: 'lightly_used', category: 'Camera', images: ['https://example.com/cam.jpg', 'http://insecure.example.com/x.jpg'] }, C.token);
  check('a pre-owned listing can be made', listing.status === 201 && listing.json.listing?.id, listing.json);
  check('only https pictures are kept', (listing.json.listing?.images ?? []).length === 1, listing.json?.listing?.images);
  const noCondition = await api('POST', '/market/listings', { title: 'No condition', priceCents: 1000 }, C.token);
  check('a listing needs a condition', noCondition.status === 400, noCondition.json);
  const id = listing.json.listing.id;
  const ownOffer = await api('POST', `/market/listings/${id}/offers`, { cents: 100 }, C.token);
  check('a seller cannot offer on their own listing', ownOffer.status === 400, ownOffer.json);
  const offer1 = await api('POST', `/market/listings/${id}/offers`, { cents: 400000 }, B.token);
  const offer2 = await api('POST', `/market/listings/${id}/offers`, { cents: 450000, note: 'Final' }, B.token);
  check('a buyer can offer', offer1.status === 201 && offer2.status === 201, [offer1.status, offer2.status]);
  const detailB = await api('GET', `/market/listings/${id}`, undefined, B.token);
  check('one open offer per buyer: the new one replaces the old', detailB.json.myOffer?.id === offer2.json.offer.id && detailB.json.myOffer?.cents === 450000, detailB.json?.myOffer);
  const detailC = await api('GET', `/market/listings/${id}`, undefined, C.token);
  check('the seller sees every offer', detailC.json.offers?.length === 2, detailC.json?.offers?.length);
  const buyerAccept = await api('POST', `/market/offers/${offer2.json.offer.id}`, { action: 'accept' }, B.token);
  check('only the seller accepts', buyerAccept.status === 404, buyerAccept.status);
  const accept = await api('POST', `/market/offers/${offer2.json.offer.id}`, { action: 'accept' }, C.token);
  check('accepting marks the listing agreed', accept.status === 200 && accept.json.listing?.status === 'agreed', accept.json?.listing?.status);
  const late = await api('POST', `/market/listings/${id}/offers`, { cents: 1 }, A.token);
  check('an agreed listing takes no more offers', late.status === 400, late.json);
  const msg = await api('POST', `/market/listings/${id}/messages`, { body: 'Where do we meet?' }, B.token);
  check('the buyer can chat', msg.status === 201 || msg.status === 200, msg.json);
  const thread = await api('GET', `/market/listings/${id}/messages?buyerId=${B.user.id}`, undefined, C.token);
  check('the seller reads the thread by buyer', thread.status === 200 && thread.json.messages?.length === 1, thread.json);
  const stranger = await api('GET', `/market/listings/${id}/messages`, undefined, A.token);
  check('a stranger has no thread yet', stranger.status === 200 && stranger.json.messages?.length === 0, stranger.json);

  const live = await api('POST', '/market/listings', { title: `Smoke mic ${stamp}`, priceCents: 90000, condition: 'well_used', category: 'Audio' }, C.token);
  const notMine = await api('POST', '/market/feature', { type: 'listing', id: live.json.listing.id }, B.token);
  check('only your own listing can be featured', notMine.status === 404 || notMine.status === 403, notMine.status);
  const poor = await api('POST', '/market/feature', { type: 'listing', id: live.json.listing.id }, C.token);
  check(`a featured week costs ${FEATURE_FEE_POINTS} points`, poor.status === 400 && /points/.test(poor.json.error ?? ''), poor.json);
  const staffFeature = await api('POST', '/market/feature', { type: 'listing', id: live.json.listing.id }, A.token);
  check('staff feature for free', staffFeature.status === 200 && staffFeature.json.paid === 0 && staffFeature.json.featuredUntil, staffFeature.json);

  const itemByUser = await api('POST', '/market/items', { title: 'Not allowed', url: 'https://example.com/x' }, B.token);
  check('only the team stocks new gear', itemByUser.status === 403, itemByUser.status);
  const item = await api('POST', '/market/items', { title: `Smoke light ${stamp}`, url: 'https://example.com/light', category: 'Lighting', priceCents: 299900, stage: 'starting' }, A.token);
  check('staff can add a store item', item.status === 201 && item.json.item?.id, item.json);
  const noLink = await api('POST', '/market/items', { title: 'No link', url: 'not a link' }, A.token);
  check('a store item needs a link', noLink.status === 400, noLink.json);
  const out = await fetch(`${ORIGIN}/out/item/${item.json.item.id}`, { redirect: 'manual' });
  check('a partner tap goes through /out', out.status === 302 && out.headers.get('location') === 'https://example.com/light', [out.status, out.headers.get('location')]);
  const outBad = await fetch(`${ORIGIN}/out/item/nope`, { redirect: 'manual' });
  check('an unknown item falls back to the store', outBad.status === 302 && (outBad.headers.get('location') ?? '').endsWith('/store'), outBad.headers.get('location'));
  const market = await api('GET', '/market', undefined, B.token);
  check('the store answers with items, listings and kits', market.status === 200 && market.json.items && market.json.listings, Object.keys(market.json ?? {}));
  check('featured listings sort first', market.json.listings?.[0]?.id === live.json.listing.id, market.json?.listings?.map((l) => l.id).slice(0, 3));
  const kit = await api('POST', '/market/kits', { title: `Smoke kit ${stamp}`, stage: 'starting', items: [{ type: 'item', id: item.json.item.id }] }, A.token);
  check('staff can group a kit', kit.status === 201, kit.json);
}

// ---------------------------------------------------------------- kreators run: start codes
section('Run');
{
  const noCity = await api('POST', '/run/clubs', { name: 'No city' }, C.token);
  check('a club needs a name and a city', noCity.status === 400, noCity.json);
  const club = await api('POST', '/run/clubs', { name: `Smoke runners ${stamp}`, city: 'Bengaluru', pace: 'easy', meets: 'Cubbon Park gate' }, C.token);
  check('anyone can start a run club', club.status === 201 && club.json.club?.id, club.json);
  const clubId = club.json.club.id;
  const hostRunBefore = await api('POST', `/run/clubs/${clubId}/runs`, { title: 'Members only', startsAt: new Date(Date.now() - 10 * 60_000).toISOString(), minutes: 60, metres: 5000 }, B.token);
  check('only the host adds runs', hostRunBefore.status === 403, hostRunBefore.status);
  const open = await api('POST', `/run/clubs/${clubId}/runs`, { title: 'Open run', startsAt: new Date(Date.now() - 10 * 60_000).toISOString(), minutes: 60, metres: 5000 }, C.token);
  check('the host adds a run and sees its start code', open.status === 201 && /^[A-Z0-9]{6}$/.test(open.json.run?.code ?? ''), open.json?.run?.code);
  const early = await api('POST', `/run/clubs/${clubId}/runs`, { title: 'Later run', startsAt: new Date(Date.now() + 2 * 3600_000).toISOString(), minutes: 60 }, C.token);
  const notMember = await api('POST', `/run/runs/${open.json.run.id}/entry`, { code: open.json.run.code }, B.token);
  check('an entry needs membership', notMember.status === 403, notMember.json);
  const join = await api('POST', `/run/clubs/${clubId}/join`, {}, B.token);
  check('a member can join', join.status === 200 || join.status === 201, join.json);
  const asMember = await api('GET', `/run/clubs/${clubId}`, undefined, B.token);
  check('the code never reaches a member', asMember.status === 200 && asMember.json.runs?.every((r) => !r.code), asMember.json?.runs?.map((r) => r.code));
  const wrong = await api('POST', `/run/runs/${open.json.run.id}/entry`, { code: 'WRONG1' }, B.token);
  check('a wrong code is refused', wrong.status === 400, wrong.json);
  const tooEarly = await api('POST', `/run/runs/${early.json.run.id}/entry`, { code: early.json.run.code }, B.token);
  check('the code works only from thirty minutes before', tooEarly.status === 400 && /thirty minutes/.test(tooEarly.json.error ?? ''), tooEarly.json);
  const before = await me(B.token);
  const life0 = await api('GET', '/life', undefined, B.token);
  const entry = await api('POST', `/run/runs/${open.json.run.id}/entry`, { code: open.json.run.code.toLowerCase(), minutes: 40, metres: 5000 }, B.token);
  check(`a logged run pays ${RUN_REWARD.xp} xp and ${RUN_REWARD.points} points`, entry.status === 201 && entry.json.xp === RUN_REWARD.xp && entry.json.points === RUN_REWARD.points, entry.json);
  check('the first run earns its badge', (entry.json.newBadges ?? []).includes('run_1'), entry.json?.newBadges);
  const after = await me(B.token);
  check('the pay lands on the account', after.xp - before.xp === RUN_REWARD.xp && after.points - before.points === RUN_REWARD.points, { xp: after.xp - before.xp, points: after.points - before.points });
  const life1 = await api('GET', '/life', undefined, B.token);
  check('run minutes count as movement in Life', /70 min this week/.test(JSON.stringify(life1.json)) && life0.status === 200, JSON.stringify(life1.json).match(/\d+ min this week/)?.[0]);
  const again = await api('POST', `/run/runs/${open.json.run.id}/entry`, { code: open.json.run.code }, B.token);
  check('a run is logged once', again.status === 409, again.json);
  const detail = await api('GET', `/run/clubs/${clubId}`, undefined, C.token);
  const entryId = detail.json.entries?.[0]?.id ?? entry.json.entry?.id;
  const voidByMember = await api('POST', `/run/entries/${entryId}/void`, {}, B.token);
  check('only the host voids', voidByMember.status === 403, voidByMember.status);
  const voided = await api('POST', `/run/entries/${entryId}/void`, {}, C.token);
  check('the host can void an entry', voided.status === 200, voided.json);
  const afterVoid = await me(B.token);
  check('a void takes the pay back out', afterVoid.points === before.points && afterVoid.xp === before.xp, { points: afterVoid.points, xp: afterVoid.xp });
  const collab = await api('POST', '/run/collabs', { title: 'Smoke brand shoes', brandName: 'Smoke shoes', giveaway: 'One pair', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString() }, B.token);
  check('a plain member cannot post a collab', collab.status === 403, collab.status);
  const staffCollab = await api('POST', '/run/collabs', { title: `Smoke brand shoes ${stamp}`, brandName: 'Smoke shoes', brief: 'Shoes for the club', asks: 'A photo at the line', giveaway: 'One pair a month', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString() }, A.token);
  check('staff with events can post a collab with its giveaway', staffCollab.status === 201 && staffCollab.json.collab?.giveaway, staffCollab.json);
  if (staffCollab.json.collab?.id) {
    const apply = await api('POST', `/run/collabs/${staffCollab.json.collab.id}/apply`, { clubId, note: 'We run weekly' }, C.token);
    check('a host applies with the club', apply.status === 201 || apply.status === 200, apply.json);
    const applyAsMember = await api('POST', `/run/collabs/${staffCollab.json.collab.id}/apply`, { clubId }, B.token);
    check('only the host applies', applyAsMember.status === 403 || applyAsMember.status === 404 || applyAsMember.status === 400, applyAsMember.status);
  }
  const runHome = await api('GET', '/run', undefined, B.token);
  check('the run home answers', runHome.status === 200, runHome.status);
}

// ---------------------------------------------------------------- school and staff powers
section('School and staff');
{
  const byUser = await api('POST', '/school/programs', { name: 'Not allowed' }, B.token);
  check('only cohort managers publish programs', byUser.status === 403, byUser.status);
  const prog = await api('POST', '/school/programs', { name: 'Smoke test program', description: 'Made by the smoke test.' }, A.token);
  check('an admin can make the smoke program', prog.status === 201 && prog.json.id, prog.json);
  const asStaff = await api('GET', '/school', undefined, A.token);
  check('staff see unpublished programs', asStaff.status === 200 && JSON.stringify(asStaff.json).includes('Smoke test program'), asStaff.status);
  const asUser = await api('GET', '/school', undefined, B.token);
  check('members see only published programs', asUser.status === 200 && !JSON.stringify(asUser.json).includes('Smoke test program'), asUser.status);
  check('the two real programs are seeded', /Editing fundamentals/.test(JSON.stringify(asUser.json)) && /ChatCut/.test(JSON.stringify(asUser.json)), '');
  const perms = await admin('POST', `/admin/users/${C.user.id}/permissions`, { permissions: ['cohorts'] });
  check('a permission can be granted', perms.status === 200 && perms.json.user?.permissions?.includes('cohorts'), perms.json);
  const stillUser = await api('POST', '/school/programs', { name: 'Smoke test program two', published: false }, C.token);
  check('a permission alone is not enough: the role must be staff', stillUser.status === 403, stillUser.status);
  const role = await admin('POST', `/admin/users/${C.user.id}/role`, { role: 'sub_admin' });
  check('the admin key can make staff', role.status === 200 && role.json.user?.role === 'sub_admin', role.json);
  const nowStaff = await api('POST', '/school/programs', { name: 'Smoke test program two', published: false }, C.token);
  check('staff with the permission open the door', nowStaff.status === 201, nowStaff.json);
  await admin('POST', `/admin/users/${C.user.id}/permissions`, { permissions: [] });
  const closed = await api('POST', '/school/programs', { name: 'Smoke test program three' }, C.token);
  check('taking the permission back closes it', closed.status === 403, closed.status);
  await admin('POST', `/admin/users/${C.user.id}/role`, { role: 'user' });
}

// ---------------------------------------------------------------- club benefits and reward changes
section('Club and Work');
{
  await admin('POST', `/admin/users/${C.user.id}/role`, { role: 'sub_admin' });
  await admin('POST', `/admin/users/${C.user.id}/permissions`, { permissions: ['talent', 'review'] });
  const opp = await api('POST', '/work/opportunities', { title: `Club gig ${stamp}`, clubOnly: true }, C.token);
  check('staff can post a club-only listing', opp.status === 201 && opp.json.id, opp.json);
  const pub = await api('PATCH', `/work/opportunities/${opp.json.id}`, { status: 'published' }, C.token);
  check('and publish it', pub.status === 200, pub.json);
  const listOut = await api('GET', '/work', undefined, B.token);
  check('a non-member does not see a club-only listing', listOut.status === 200 && !JSON.stringify(listOut.json.opportunities).includes(`Club gig ${stamp}`), '');
  const detailOut = await api('GET', `/work/opportunities/${opp.json.id}`, undefined, B.token);
  check('nor open it', detailOut.status === 403, detailOut.status);
  const applyOut = await api('POST', `/work/opportunities/${opp.json.id}/apply`, { coverNote: 'me' }, B.token);
  check('nor apply', applyOut.status === 403, applyOut.status);
  const site = await api('GET', '/public/explore?type=opportunity');
  check('the public site never lists it', site.status === 200 && !JSON.stringify(site.json).includes(`Club gig ${stamp}`), site.status);
  const applyClub = await api('POST', '/club/apply', { note: 'smoke' }, B.token);
  check('a member applies to the Club', applyClub.status === 201, applyClub.json);
  const clubC = await api('GET', '/club', undefined, C.token);
  const m = clubC.json.queue?.find((x) => x.userId === B.user.id);
  check('a reviewer sees the application and the staff list', clubC.status === 200 && Boolean(m) && Array.isArray(clubC.json.staff) && clubC.json.staff.some((x) => x.id === C.user.id), clubC.json?.staff);
  const approve = await api('POST', `/club/memberships/${m?.id}`, { status: 'approved', months: 12 }, C.token);
  check('a reviewer approves', approve.status === 200, approve.json);
  const listIn = await api('GET', '/work', undefined, B.token);
  check('a Club member gets the first look', JSON.stringify(listIn.json.opportunities).includes(`Club gig ${stamp}`), '');
  const applyIn = await api('POST', `/work/opportunities/${opp.json.id}/apply`, { coverNote: 'me' }, B.token);
  check('and can apply', applyIn.status === 201, applyIn.json);
  const byMember = await api('POST', `/club/memberships/${m?.id}/manager`, { managerId: C.user.id }, B.token);
  check('only reviewers name a manager', byMember.status === 403, byMember.status);
  const notStaff = await api('POST', `/club/memberships/${m?.id}/manager`, { managerId: B.user.id }, C.token);
  check('a manager must be on staff', notStaff.status === 400, notStaff.json);
  const named = await api('POST', `/club/memberships/${m?.id}/manager`, { managerId: C.user.id }, C.token);
  check('a reviewer names a manager', named.status === 200, named.json);
  const mineClub = await api('GET', '/club', undefined, B.token);
  check('the member sees their manager by name', mineClub.json.mine?.managerName === 'Smoke seller', mineClub.json?.mine);
  const inboxB = await api('GET', '/inbox', undefined, B.token);
  check('and hears about it in the inbox', JSON.stringify(inboxB.json).includes('Your Club manager is'), '');
}

section('Reward changes');
{
  const reward = await api('POST', '/win', { title: `Smoke reward ${stamp}`, brandName: 'Smoke brand', budgetPoints: 1000, ratePerThousand: 10, minViews: 100 }, C.token);
  check('staff launch a reward', reward.status === 201 && reward.json.id, reward.json);
  const entry = await api('POST', `/win/${reward.json.id}/submit`, { url: 'https://www.youtube.com/watch?v=smoke' }, B.token);
  check('a person enters with a link', entry.status === 201, entry.json);
  const byMember = await api('PATCH', `/win/${reward.json.id}`, { brief: 'nope' }, B.token);
  check('only staff change a reward', byMember.status === 403, byMember.status);
  const same = await api('PATCH', `/win/${reward.json.id}`, {}, C.token);
  check('saving nothing new keeps the version', same.status === 200 && same.json.version === 1, same.json);
  const changed = await api('PATCH', `/win/${reward.json.id}`, { brief: 'New brief', minViews: 500 }, C.token);
  check('a change bumps the version and says what changed', changed.status === 200 && changed.json.version === 2 && changed.json.changed?.includes('brief') && changed.json.changed?.includes('minimum views'), changed.json);
  const detail = await api('GET', `/win/${reward.json.id}`, undefined, B.token);
  check('the reward carries its version', detail.json.bounty?.version === 2 && detail.json.bounty?.minViews === 500, detail.json?.bounty);
  const inboxB = await api('GET', '/inbox', undefined, B.token);
  check('everyone who entered is told', JSON.stringify(inboxB.json).includes('changed (version 2)'), '');
  const badTime = await api('PATCH', `/win/${reward.json.id}`, { endsAt: 'soon' }, C.token);
  check('a bad closing time is refused', badTime.status === 400, badTime.json);
  await admin('POST', `/admin/users/${C.user.id}/permissions`, { permissions: [] });
  await admin('POST', `/admin/users/${C.user.id}/role`, { role: 'user' });
}

section('Pages');
{
  const ten = await api('GET', '/work?page=1&size=10', undefined, B.token);
  check('a list answers with its page', ten.status === 200 && ten.json.page?.page === 1 && ten.json.page?.size === 10 && typeof ten.json.page?.more === 'boolean', ten.json?.page);
  const odd = await api('GET', '/work?page=0&size=33', undefined, B.token);
  check('a size off the list falls back to 25 and page floors at 1', odd.json.page?.size === 25 && odd.json.page?.page === 1, odd.json?.page);
  const far = await api('GET', '/work?page=50&size=100', undefined, B.token);
  check('a page past the end is empty with no next page', far.status === 200 && far.json.opportunities.length === 0 && far.json.page?.more === false, far.json?.page);
  // Spread across accounts so nobody trips the posts-per-hour limit.
  for (let i = 0; i < 11; i += 1) await api('POST', '/community', { category: 'Stories', body: `Page filler ${stamp} ${i}` }, [A, B, C][i % 3].token);
  const first = await api('GET', '/community?page=1&size=10', undefined, B.token);
  const second = await api('GET', '/community?page=2&size=10', undefined, B.token);
  check('ten rows a page and a next page when there are more', first.json.posts?.length === 10 && first.json.page?.more === true, first.json?.page);
  check('the second page carries on from the first', second.status === 200 && second.json.posts?.length >= 1 && !second.json.posts.some((p) => first.json.posts.some((f) => f.id === p.id)), second.json?.page);
  const inbox = await api('GET', '/inbox?size=10', undefined, B.token);
  check('the inbox pages too', inbox.json.page?.size === 10, inbox.json?.page);
  const users = await admin('GET', '/admin/users?page=1&size=10');
  check('admin tables page from the same helper', users.status === 200 && users.json.page?.size === 10, users.json?.page);
  const obs = await api('GET', '/internal/observability?page=1&size=10', undefined, A.token);
  check('observability pages by the same rule', obs.status === 200 && obs.json.page?.size === 10 && typeof obs.json.total === 'number', obs.json?.page);
}

section('Strategy session');
{
  const LEVELS = { self: [400, 200], lover_partner: [350, 100], friendship: [310, 250], parent_child: [310, 310], servant_leader: [250, 200], guru: [350, 350], divine: [540, 400] };
  const placements = Object.entries(LEVELS).map(([relationship, [core, floor]]) => ({ relationship, core, floor, evidence: relationship === 'divine' ? 'Sat every morning this week, twenty minutes, logged.' : '' }));
  const short = await api('POST', '/session/assessment', { placements: placements.slice(0, 3) }, B.token);
  check('an assessment needs all seven placements', short.status === 400, short.json);
  const a = await api('POST', '/session/assessment', { placements, fears: [{ text: 'Being judged', relationship: 'friendship', drives: 'yes' }], insecurities: [{ text: 'awkward in groups', weight: 8, relationship: 'friendship' }], scores: { sleep: 4, lover_partner: 9, self: 6 }, behaviour: { lover_partner: 2 }, realDay: { wake: '09:00', sleep: '01:00', workStart: '10:00', workEnd: '18:00', evening: 'scrolling', gym: '' } }, B.token);
  check('the assessment is kept with the rules applied', a.status === 201 && a.json.assessment?.placements?.length === 7, a.json?.assessment?.placements?.length);
  const by = Object.fromEntries((a.json.assessment?.placements ?? []).map((p) => [p.relationship, p]));
  check('a core of 400 without evidence is capped at Acceptance', by.self?.core === 350 && by.self?.capped === true, by.self);
  check('a core of 540 with evidence stands', by.divine?.core === 540 && by.divine?.capped === false, by.divine);
  check('a floor under Courage is a required focus', by.lover_partner?.required === true && by.friendship?.required === false, by.lover_partner);
  check('a high score over a low floor is settled by the behaviour answer', a.json.assessment?.scores?.lover_partner === 6 && a.json.assessment?.scores?.self === 6, a.json?.assessment?.scores);
  check('the focus is suggested, floors under Courage first', Array.isArray(a.json.suggestedFocus) && a.json.suggestedFocus[0] === 'lover_partner' && a.json.suggestedFocus.length === 2, a.json?.suggestedFocus);
  const unsigned = await api('POST', '/session/plan', { focus: ['lover_partner', 'friendship'], contract: { minDays: 5, checkinTime: '21:30', penalty: 'streak' } }, B.token);
  check('the contract needs a signature', unsigned.status === 400, unsigned.json);
  const plan = await api('POST', '/session/plan', { focus: ['guru'], practices: { mantra: 'om_namah_shivaya', breathing: '478' }, contract: { minDays: 5, checkinTime: '21:30', penalty: 'unlock', signedName: 'Smoke buyer' }, date: today }, B.token);
  check('the plan holds the required focus whatever was asked', plan.status === 201 && plan.json.assessment?.focus?.includes('lover_partner') && plan.json.assessment?.focus?.length === 2, plan.json?.assessment?.focus);
  check('the routine is six blocks ramped from the real day', plan.json.routine?.general?.length === 6 && plan.json.routine?.general?.[0]?.start === '09:00' && plan.json.routine?.exceptional?.[0]?.steps?.length === 3, plan.json?.routine?.general?.[0]);
  check('the contract is signed with its dates and penalty', plan.json.contract?.signedName === 'Smoke buyer' && plan.json.contract?.penalty === 'unlock' && /\d{4}-\d{2}-\d{2}/.test(plan.json.contract?.nextWeekly ?? '') && plan.json.contract?.minDays === 5, plan.json?.contract);
  check('the practices carry a line to say', typeof plan.json.routine?.practices?.affirmation === 'string' && plan.json.routine.practices.affirmation.length > 10 && plan.json.routine?.practices?.mantra === 'om_namah_shivaya', plan.json?.routine?.practices);
  const meAfter = await me(B.token);
  check('the check-in time becomes the daily reminder', meAfter.reminderTime === '21:30', meAfter.reminderTime);
  const steps = plan.json.routine.general[0].steps;
  const part = await api('POST', '/session/day', { date: today, dayType: 'general', steps: steps.slice(0, 2) }, B.token);
  check('a morning with some steps ticked is not done', part.status === 200 && part.json.today?.done === false && part.json.today?.steps?.length === 2, part.json?.today);
  const full = await api('POST', '/session/day', { date: today, dayType: 'general', steps }, B.token);
  check('every step ticked is a done morning, and the week counts it', full.json.today?.done === true && full.json.week?.done === 1, full.json?.week);
  const junk = await api('POST', '/session/day', { date: today, dayType: 'general', steps: ['Skip it all'] }, B.token);
  check('a step that is not in the routine is ignored', junk.json.today?.steps?.length === 0, junk.json?.today);
  const get = await api('GET', `/session?date=${today}`, undefined, B.token);
  check('the session answers in one call', get.status === 200 && get.json.assessment && get.json.routine && get.json.contract && Array.isArray(get.json.week?.days), get.status);
  const noPlan = await api('POST', '/session/day', { date: today, steps: [] }, C.token);
  check('a day needs a routine first', noPlan.status === 400, noPlan.json);
  const fresh = await api('GET', `/session?date=${today}`, undefined, C.token);
  check('a new account has no session yet, so onboarding starts with it', fresh.status === 200 && fresh.json.assessment === null && fresh.json.contract === null, fresh.json);
}

section('Daily reminder');
{
  // The seller has not checked in today and has no zone, so the cron reads them in Asia/Kolkata.
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const nowMin = Number(parts.find((x) => x.type === 'hour')?.value ?? 0) * 60 + Number(parts.find((x) => x.type === 'minute')?.value ?? 0);
  const dueMin = Math.max(0, nowMin - 10);
  const at = `${String(Math.floor(dueMin / 60)).padStart(2, '0')}:${String(dueMin % 60).padStart(2, '0')}`;
  const setTime = await api('PATCH', '/me', { reminderTime: at }, C.token);
  check('a reminder time is kept on the profile', setTime.status === 200 && (await me(C.token)).reminderTime === at, setTime.json);
  const tick = await fetch(`${ORIGIN}/__scheduled?cron=*+*+*+*+*`);
  check('the cron sends reminders', tick.status === 200, tick.status);
  const reminders = (list) => (list.json.items ?? list.json.notifications ?? list.json ?? []).filter?.((n) => n.kind === 'reminder') ?? [];
  const inboxC = await api('GET', '/inbox', undefined, C.token);
  check('a reminder lands in the inbox once the time has passed', reminders(inboxC).length === 1 && JSON.stringify(inboxC.json).includes('Time to check in'), JSON.stringify(inboxC.json).slice(0, 200));
  await fetch(`${ORIGIN}/__scheduled?cron=*+*+*+*+*`);
  const inboxC2 = await api('GET', '/inbox', undefined, C.token);
  check('the next cron does not send it again', reminders(inboxC2).length === 1, reminders(inboxC2).length);
  const inboxB = await api('GET', '/inbox', undefined, B.token);
  check('someone who checked in today gets no reminder', reminders(inboxB).length === 0, reminders(inboxB).length);
  await api('PATCH', '/me', { reminderTime: null }, C.token);
  check('the reminder can be switched off', (await me(C.token)).reminderTime === null, '');
}

section('Content strategist');
{
  await api('PATCH', '/me/modules', { key: 'content', on: true }, B.token);
  const list0 = await api('GET', '/studio/brands?size=10', undefined, B.token);
  check('brand folders list with a page and the tools on offer', list0.status === 200 && Array.isArray(list0.json.brands) && list0.json.page?.size === 10 && typeof list0.json.tools?.reach === 'boolean', list0.json);
  const noName = await api('POST', '/studio/brands', { niche: 'x' }, B.token);
  check('a brand needs a name', noName.status === 400, noName.json);
  const made = await api('POST', '/studio/brands', { name: `Smoke brand ${stamp}`, niche: 'phone videography', description: 'Teaches creators to shoot on a phone.', voice: 'Warm and direct.' }, B.token);
  check('a brand folder is made', made.status === 201 && made.json.brand?.id, made.json);
  const bid = made.json.brand?.id;
  const stranger = await api('GET', `/studio/brands/${bid}`, undefined, C.token);
  check('another person cannot open the folder', stranger.status === 404, stranger.status);
  const badLink = await api('POST', `/studio/brands/${bid}/sources`, { url: 'ftp://nope' }, B.token);
  check('a source needs an https link', badLink.status === 400, badLink.json);
  const src = await api('POST', `/studio/brands/${bid}/sources`, { url: 'https://www.youtube.com/@smoke', label: 'Their channel' }, B.token);
  check('a link joins the folder with its kind guessed', src.status === 201 && src.json.source?.kind === 'youtube', src.json?.source);
  const comp = await api('POST', `/studio/brands/${bid}/sources`, { url: 'https://example.com', kind: 'competitor' }, B.token);
  check('a competitor is a choice, not a guess', comp.status === 201 && comp.json.source?.kind === 'competitor', comp.json?.source);
  const read = await api('POST', `/studio/brands/${bid}/sources/${comp.json.source.id}/read`, {}, B.token);
  check('reading a source keeps a run either way', (read.status === 201 || read.status === 200) && read.json.run?.kind === 'read' && ['done', 'failed'].includes(read.json.run?.status), read.json?.run);
  const search = await api('POST', `/studio/brands/${bid}/research`, { kind: 'x_search', query: 'phone videography' }, B.token);
  check('a search that needs Agent Reach says so instead of pretending', search.status === 200 && search.json.run?.status === 'failed' && /Agent Reach/.test(search.json.run?.error ?? ''), search.json?.run);
  const empty = await api('POST', `/studio/brands/${bid}/research`, { kind: 'search', query: '' }, B.token);
  check('research needs something to look for', empty.status === 400, empty.json);
  const piece = await api('POST', `/studio/brands/${bid}/pieces`, { kind: 'plan', brief: 'Grow to 10k followers in 90 days.' }, B.token);
  check('a piece is written, and says who wrote it', piece.status === 201 && piece.json.piece?.kind === 'plan' && typeof piece.json.piece?.writer === 'string' && piece.json.piece?.body.length > 100, piece.json?.piece?.writer);
  check('without a model the piece is an honest digest', piece.json.piece?.writer !== 'digest' || /No writing model/.test(piece.json.piece?.body ?? ''), piece.json?.piece?.writer);
  const kept = await api('PATCH', `/studio/brands/${bid}/pieces/${piece.json.piece.id}`, { status: 'kept', title: 'The plan' }, B.token);
  check('a piece can be kept and renamed', kept.status === 200 && kept.json.piece?.status === 'kept' && kept.json.piece?.title === 'The plan', kept.json?.piece);
  const detail = await api('GET', `/studio/brands/${bid}?size=10`, undefined, B.token);
  check('the folder shows its links, runs and pieces', detail.status === 200 && detail.json.sources?.length === 2 && detail.json.runs?.length >= 2 && detail.json.pieces?.length === 1 && detail.json.page?.size === 10, { s: detail.json?.sources?.length, r: detail.json?.runs?.length, p: detail.json?.pieces?.length });
  const gone = await api('DELETE', `/studio/brands/${bid}`, undefined, B.token);
  const after = await api('GET', `/studio/brands/${bid}`, undefined, B.token);
  check('removing the folder takes everything in it', gone.status === 200 && after.status === 404, after.status);
}

// ---------------------------------------------------------------- admin, flags, internal
section('Admin');
{
  const badKey = await api('GET', '/admin/users', undefined, null, { 'X-Admin-Key': 'nope' });
  check('a wrong admin key is refused', badKey.status === 403, badKey.status);
  const asUser = await api('GET', '/admin/users', undefined, B.token);
  check('a plain member is not an admin', asUser.status === 403, asUser.status);
  const users = await admin('GET', '/admin/users');
  check('the admin key lists people', users.status === 200 && Array.isArray(users.json.users), users.status);
  const asAdmin = await api('GET', '/admin/users', undefined, A.token);
  check('an admin session works too', asAdmin.status === 200, asAdmin.status);
  const flagOff = await admin('POST', '/admin/flags/store', { enabled: false });
  check('a flag can be switched off', flagOff.status === 200 && flagOff.json.setting?.enabled === false, flagOff.json);
  const meOff = await api('GET', '/me', undefined, B.token);
  check('access resolves on the server', meOff.status === 200 && meOff.json.access?.store?.available === false && meOff.json.access?.store?.reason === 'disabled', meOff.json?.access?.store);
  const storeGone = await api('GET', '/market', undefined, B.token);
  check('a switched-off app refuses its API', storeGone.status === 403 && /not available/.test(storeGone.json.error ?? ''), storeGone.json);
  const coreStillOpen = await api('GET', '/today', undefined, B.token);
  check('the core stays open while an app is off', coreStillOpen.status === 200, coreStillOpen.status);
  const flagOn = await admin('POST', '/admin/flags/store', { enabled: true });
  check('a flag can be switched back on', flagOn.json.setting?.enabled === true, flagOn.json);
  const override = await admin('POST', '/admin/flags/reviews/overrides', { subjectType: 'user', subjectId: B.user.id, enabled: false, reason: 'smoke' });
  check('an override for one person can be set', override.status === 201 && override.json.override?.id, override.json);
  const meOverridden = await api('GET', '/me', undefined, B.token);
  check('the override reaches that person', meOverridden.json.access?.reviews?.available === false && meOverridden.json.access?.reviews?.reason === 'override', meOverridden.json?.access?.reviews);
  const reviewsGone = await api('GET', '/reviews', undefined, B.token);
  check('an override refuses the API too', reviewsGone.status === 403, reviewsGone.status);
  await admin('DELETE', `/admin/flags/overrides/${override.json.override.id}`);
  const reviewsBack = await api('GET', '/reviews', undefined, B.token);
  check('and the door opens again when it is removed', reviewsBack.status === 200, reviewsBack.status);
  // The audit log is paged now, so walk the pages: the flag change is recent, the founder promotion may be far back.
  let auditText = '';
  let auditStatus = 0;
  for (let page = 1; page <= 20; page += 1) {
    const r = await admin('GET', `/admin/audit?page=${page}&size=100`);
    auditStatus = r.status;
    auditText += JSON.stringify(r.json);
    if (r.status !== 200 || !r.json.page?.more || (auditText.includes('flag.set') && auditText.includes('founder email'))) break;
  }
  check('every change is audited', auditStatus === 200 && auditText.includes('flag.set') && auditText.includes('founder email'), auditStatus);
  const obs = await api('GET', '/internal/observability', undefined, A.token);
  check('observability opens for an admin', obs.status === 200, obs.status);
  check('observability never carries journal entries or wellbeing logs', !/Smoke entry|"value":7\.5|journal_entries|wellbeing_logs/.test(JSON.stringify(obs.json)), '');
  const obsUser = await api('GET', '/internal/observability', undefined, B.token);
  check('observability is closed to members', obsUser.status === 403, obsUser.status);
  const selfRole = await api('POST', `/internal/users/${A.user.id}/role`, { role: 'user' }, A.token);
  check('an admin cannot change their own role', selfRole.status === 400, selfRole.json);
  const promote = await api('POST', `/internal/users/${C.user.id}/role`, { role: 'sub_admin' }, A.token);
  check('an admin can make staff', promote.status === 200 && promote.json.user?.role === 'sub_admin', promote.json);
  const demote = await api('POST', `/internal/users/${C.user.id}/role`, { role: 'user' }, A.token);
  check('and take it back', demote.status === 200, demote.json);
  // The smoke database keeps every run's listings, so search for this run's title, not the shared prefix.
  const search = await api('GET', `/search?q=${encodeURIComponent(`Smoke camera ${stamp}`)}`, undefined, B.token);
  check('search finds pre-owned listings', search.status === 200 && JSON.stringify(search.json).includes(`Smoke camera ${stamp}`), search.status);
  const short = await api('GET', '/search?q=S', undefined, B.token);
  check('search needs two characters', short.status === 200, short.status);
  const modOff = await api('PATCH', '/me/modules', { key: 'run', on: false }, B.token);
  check('a person can switch an app off', modOff.status === 200 && modOff.json.modules?.run === false, modOff.json);
  const lockedMod = await api('PATCH', '/me/modules', { key: 'today', on: false }, B.token);
  check('the core tabs stay on', lockedMod.status === 400, lockedMod.json);
}

// ---------------------------------------------------------------- export and delete
section('Export and delete');
{
  const exp = await api('GET', '/me/export', undefined, B.token);
  const text = JSON.stringify(exp.json);
  check('export is one JSON file', exp.status === 200 && text.length > 500, exp.status);
  check('export carries the not-to-do list and the journal', /Stay away 0/.test(text) && /Smoke entry/.test(text), '');
  check('export carries the strategy session', Array.isArray(exp.json.assessments) && exp.json.assessments.length >= 1 && exp.json.placements?.length === 7 && exp.json.contracts?.length >= 1, Object.keys(exp.json ?? {}).filter((k) => /assess|placem|contract/.test(k)));
  const noConfirm = await api('DELETE', '/me', {}, B.token);
  check('delete needs the word', noConfirm.status === 400, noConfirm.json);
  const del = await api('DELETE', '/me', { confirm: 'DELETE' }, B.token);
  check('an account can be deleted', del.status === 200, del.json);
  const gone = await api('GET', '/me', undefined, B.token);
  check('the session is gone with it', gone.status === 401, gone.status);
  const signin = await api('POST', '/auth/signin', { email: `buyer-${stamp}@smoke.test`, password: `Lantern-${stamp}-new` });
  check('the email no longer signs in', signin.status === 401, signin.status);
  const orders = await api('GET', '/studio/orders', undefined, C.token);
  check('money rows stay for the books', orders.status === 200 && JSON.stringify(orders.json).includes('Deleted member'), orders.status);
}

section('Limits');
{
  const third = `10.${(seed >> 16) & 255}.${(seed >> 8) & 255}.${(seed + 2) & 255}`;
  let last = 0;
  for (let i = 0; i < 11; i += 1) {
    const r = await api('POST', '/auth/signin', { email: `guess-${stamp}-${i}@smoke.test`, password: 'not-the-password-1' }, null, { 'CF-Connecting-IP': third });
    last = r.status;
  }
  check('sign-in is limited to ten a minute per address', last === 429, last);
  let ticket = 0;
  for (let i = 0; i < LIMITS.ticket.max + 1; i += 1) {
    const r = await api('POST', '/support', { subject: `Smoke ticket ${i}`, body: 'Testing the limit.' }, C.token);
    ticket = r.status;
  }
  check('support tickets are limited per person from the one limits file', ticket === 429, ticket);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed ? 1 : 0);
