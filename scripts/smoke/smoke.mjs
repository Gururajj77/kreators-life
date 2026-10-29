// The smoke checks. Run through blueprint.sh, which starts the server this talks to.
// Node imports the shared model straight from TypeScript (--experimental-strip-types).
import { RELATIONSHIPS, QUESTIONS, XP, POINTS, WAIT, RUN_REWARD, SOCIAL_REWARDS, MAX_NOT_TO_DO, MODULES, FEATURE_FEE_POINTS, matchSetup, parseSetup, setupSwitchable } from '../../packages/shared/src/index.ts';
import { LIMITS } from '../../apps/api/src/limits.ts';
import { ATTENDEE_CLAIMS_PER_DAY, ATTENDEE_XP_DEFAULT, ATTENDEE_XP_MAX, PLANS } from '../../packages/shared/src/index.ts';
import http from 'node:http';

const ORIGIN = process.env.SMOKE_ORIGIN ?? 'http://127.0.0.1:8788';
const ADMIN_KEY = process.env.SMOKE_ADMIN_KEY ?? 'smoke-admin-key';
const API = `${ORIGIN}/api`;
const stamp = Date.now().toString(36);
// The app's default zone is Asia/Kolkata, so "today" is that zone's date; the UTC date is a day behind for the first five and a half hours of an Indian morning.
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

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

// A stand-in for the assistant's model, so the checks never pay for a real one. blueprint.sh points the smoke server
// at it (ASSISTANT_BASE_URL). A user line "DO [{name, args}, ...]" comes back as exactly those tool calls; after the
// tools answer, it says one line. It keeps the last request, so the checks can see which tools were offered.
const MOCK_PORT = Number(process.env.SMOKE_MODEL_PORT ?? 8799);
const mockModel = { last: null };
const mockServer = http.createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw || '{}');
  mockModel.last = body;
  const last = { ...((body.messages ?? []).at(-1) ?? {}) };
  // "SLOW <line>" answers <line> after a wait, so Stop can land while the model is thinking.
  if (last.role === 'user' && last.content?.startsWith('SLOW ')) {
    await new Promise((r) => setTimeout(r, 2500));
    last.content = last.content.slice(5);
  }
  if (last.role === 'user' && last.content === 'FAIL') {
    res.writeHead(500, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: { message: 'mock failure' } }));
  }
  let message = { role: 'assistant', content: 'The mock heard you.' };
  const asked = last.role === 'user' && /^DO (\[.*\])$/s.exec(last.content ?? '');
  if (asked) message = { role: 'assistant', content: null, tool_calls: JSON.parse(asked[1]).map((c, i) => ({ id: `call_${i}`, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) } })) };
  else if (last.role === 'tool') message = { role: 'assistant', content: `Mock done: ${String(last.content).slice(0, 120)}` };
  // "ASK" asks leave first, like a shy model; the assistant's go-ahead turns it into the check-in. "WHICH" asks a real question.
  else if (last.role === 'user' && last.content === 'ASK') message = { role: 'assistant', content: 'I can see your day. Do you want me to check you in?' };
  else if (last.role === 'user' && last.content?.startsWith('Yes, go ahead')) message = { role: 'assistant', content: null, tool_calls: [{ id: 'call_go', type: 'function', function: { name: 'check_in', arguments: '{}' } }] };
  else if (last.role === 'user' && last.content === 'WHICH') message = { role: 'assistant', content: 'Which one should I tick, the vlog or the intro?' };
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ id: 'mock', choices: [{ index: 0, message, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 1000, completion_tokens: 50 } }));
});
await new Promise((resolve) => {
  mockServer.once('error', (e) => {
    console.log(`  (the mock model could not start on ${MOCK_PORT}: ${e.code ?? e.message})`);
    resolve();
  });
  mockServer.listen(MOCK_PORT, '127.0.0.1', resolve);
});
mockServer.unref();
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
  const built = await api('POST', '/onboarding/build', { relationships: rels, date: today, picks: { self: { project: 'Smoke project of my own' }, friendship: { pillar: 'A friend call every Sunday' } } }, B.token);
  check('build makes a six-layer pyramid per pillar', built.status === 201 && built.json.nodes?.length >= 12, built.status);
  const kinds = new Set((built.json.nodes ?? []).map((n) => n.kind));
  check('every layer kind is there', ['pillar', 'principle', 'value_goal', 'outcome', 'project', 'task'].every((k) => kinds.has(k)), [...kinds]);
  project = (built.json.nodes ?? []).find((n) => n.kind === 'project' && n.relationship === 'self');
  check('the person\'s own project wording is kept', project?.title === 'Smoke project of my own', project?.title);
  const ownFoundation = (built.json.nodes ?? []).find((n) => n.kind === 'pillar' && n.relationship === 'friendship');
  check('a foundation in the person\'s own words is kept', ownFoundation?.title === 'A friend call every Sunday', ownFoundation?.title);
  ladderTasks = (built.json.nodes ?? []).filter((n) => n.kind === 'task' && n.relationship === 'self').sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  check('tasks carry dates two days apart', ladderTasks.length >= 2 && ladderTasks[0].dueDate === today && ladderTasks[1].dueDate > today, ladderTasks.map((t) => t.dueDate));
  const again = await api('POST', '/onboarding/build', { relationships: ['self'], date: today }, B.token);
  check('the same pyramid is not built twice', again.status === 201 && again.json.skipped?.includes('self'), again.json?.skipped);
  const bad = await api('POST', '/nodes', { kind: 'task', parentId: project.id, relationship: 'friendship', title: 'wrong pillar' }, B.token);
  check('a task must sit under a project of its own pillar', bad.status === 400, bad.json);
}

// ---------------------------------------------------------------- the setup chat: tags, goals, the apps that fit
section('Setup');
{
  const D = (await api('POST', '/auth/anon', {})).json.token;
  const none = await api('POST', '/onboarding/setup', {}, D);
  check('the setup needs a tag or a goal', none.status === 400, none.json);
  const before = (await api('GET', '/me', undefined, D)).json;
  const available = MODULES.filter((m) => setupSwitchable(m) && (before.access?.[m.key]?.available ?? true)).map((m) => m.key);
  const answers = { identities: ['student', 'freelancer', 'editor', 'Dancer', '!!'], goals: ['learn', 'work', 'bogus'], blockers: ['time', 'nope'] };
  const expected = matchSetup(parseSetup(answers), available);
  const keepApps = [...expected.apps.map((a) => a.key).filter((k) => k !== 'army'), 'today', 'admin'];
  const r = await api('POST', '/onboarding/setup', { ...answers, apps: keepApps }, D);
  const u = r.json.user ?? {};
  check('the setup saves and counts as onboarded', r.status === 200 && Boolean(u.onboardedAt), r.json);
  check('the server matches the same apps, with the same reasons, as the shared rule', JSON.stringify(r.json.match?.apps) === JSON.stringify(expected.apps), [r.json.match?.apps?.map((a) => a.key), expected.apps.map((a) => a.key)]);
  check('short on time means three apps at most', expected.apps.length <= 3 && expected.cap === 3, expected.apps.map((a) => a.key));
  check('tags are cleaned: known keys and your own words stay, junk goes', JSON.stringify(u.identities) === JSON.stringify(['student', 'freelancer', 'editor', 'Dancer']), u.identities);
  check('goals and what gets in the way keep only what is on their lists', JSON.stringify(u.intake?.goals) === '["learn","work"]' && JSON.stringify(u.intake?.blockers) === '["time"]', u.intake);
  check('the apps kept are on and the rest are off, old defaults too', ['work', 'school', 'profile'].every((k) => u.modules?.[k] === true) && u.modules?.army === false && u.modules?.journal === false, u.modules);
  check('locked apps and the team tools are left alone', u.modules?.today === undefined && u.modules?.admin === undefined, { today: u.modules?.today, admin: u.modules?.admin });
  check('the profile picks up what the tags carry', u.focus === 'Study' && u.skills?.includes('Editing') && u.interests?.includes('Video') && u.availability === 'Open to work' && u.goals?.includes('Learn skills'), { focus: u.focus, skills: u.skills, interests: u.interests, availability: u.availability, goals: u.goals });
  const again = await api('POST', '/onboarding/setup', { identities: ['parent'], goals: ['health'], blockers: [] }, D);
  const on = again.json.on ?? [];
  check('a second run without a list switches on its own match', again.status === 200 && on.length >= 3 && on.every((k) => again.json.user?.modules?.[k] === true) && again.json.user?.modules?.work === false, on);
  check('a second run keeps the first onboarding date', again.json.user?.onboardedAt === u.onboardedAt, [again.json.user?.onboardedAt, u.onboardedAt]);
  const edited = await api('PATCH', '/me', { identities: ['runner', 'Chef', 'Baker', 'Potter', 'Weaver', 'runner'] }, D);
  check('tags changed under Profile go through the same cleaner', JSON.stringify(edited.json.user?.identities) === JSON.stringify(['runner', 'Chef', 'Baker', 'Potter']), edited.json.user?.identities);
  const erased = await api('POST', '/me/reset', {}, D);
  const after = await me(D);
  check('erase forgets the tags and sends the person back to the setup', erased.status === 200 && after.identities?.length === 0 && after.intake?.goals?.length === 0 && after.onboardedAt === null, { identities: after.identities, onboardedAt: after.onboardedAt });
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
  const daily = await api('GET', `/today?date=${today}`, undefined, B.token);
  check('a ticked task stays on Daily, under Done today', daily.json.done?.some((t) => t.id === ladderTasks[0].id && t.status === 'done') && !daily.json.tasks?.some((t) => t.id === ladderTasks[0].id), daily.json.done?.map((t) => t.title));
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
  check('a floor under Courage is flagged as the place to start', by.lover_partner?.required === true && by.friendship?.required === false, by.lover_partner);
  check('a high score over a low floor is settled by the behaviour answer', a.json.assessment?.scores?.lover_partner === 6 && a.json.assessment?.scores?.self === 6, a.json?.assessment?.scores);
  check('the focus is suggested, floors under Courage first', Array.isArray(a.json.suggestedFocus) && a.json.suggestedFocus[0] === 'lover_partner' && a.json.suggestedFocus.length === 2, a.json?.suggestedFocus);
  const unsigned = await api('POST', '/session/plan', { focus: ['lover_partner', 'friendship'], contract: { minDays: 5, checkinTime: '21:30', penalty: 'streak' } }, B.token);
  check('the contract needs a signature', unsigned.status === 400, unsigned.json);
  const plan = await api('POST', '/session/plan', { focus: ['guru'], practices: { mantra: 'own', ownMantra: 'Slow is smooth', breathing: '478' }, contract: { minDays: 5, checkinTime: '21:30', penalty: 'unlock', signedName: 'Smoke buyer' }, date: today }, B.token);
  check('the plan keeps the focus the person picked, nothing forced', plan.status === 201 && JSON.stringify(plan.json.assessment?.focus) === JSON.stringify(['guru']), plan.json?.assessment?.focus);
  check('the routine is six blocks ramped from the real day', plan.json.routine?.general?.length === 6 && plan.json.routine?.general?.[0]?.start === '09:00' && plan.json.routine?.exceptional?.[0]?.steps?.length === 3, plan.json?.routine?.general?.[0]);
  check('the contract is signed with its dates and penalty', plan.json.contract?.signedName === 'Smoke buyer' && plan.json.contract?.penalty === 'unlock' && /\d{4}-\d{2}-\d{2}/.test(plan.json.contract?.nextWeekly ?? '') && plan.json.contract?.minDays === 5, plan.json?.contract);
  check('the practices carry a line to say', typeof plan.json.routine?.practices?.affirmation === 'string' && plan.json.routine.practices.affirmation.length > 10 && plan.json.routine?.practices?.mantra === 'own' && plan.json.routine?.practices?.ownMantra === 'Slow is smooth', plan.json?.routine?.practices);
  const meAfter = await me(B.token);
  check('the check-in time becomes the daily reminder', meAfter.reminderTime === '21:30', meAfter.reminderTime);
  const steps = plan.json.routine.general[0].steps;
  const part = await api('POST', '/session/day', { date: today, dayType: 'general', steps: steps.slice(0, 2) }, B.token);
  check('a morning with some steps ticked is not done', part.status === 200 && part.json.today?.done === false && part.json.today?.steps?.length === 2, part.json?.today);
  const full = await api('POST', '/session/day', { date: today, dayType: 'general', steps }, B.token);
  check('every step ticked is a done morning, and the week counts it', full.json.today?.done === true && full.json.week?.done === 1, full.json?.week);
  const junk = await api('POST', '/session/day', { date: today, dayType: 'general', steps: ['Skip it all'] }, B.token);
  check('a step that is not in the routine is ignored', junk.json.today?.steps?.length === 0, junk.json?.today);
  const edited = await api('PATCH', '/session/routine', { date: today, general: [{ key: 'morning', start: '08:45', end: '09:30', steps: ['Water', 'Stretch'], minutes: [2, 10] }, { key: 'work', start: '09:30', end: '17:00', note: 'Deep work first' }] }, B.token);
  const em = edited.json.routine?.general?.find((b) => b.key === 'morning');
  check('the routine can be edited: times, morning steps and their minutes', edited.status === 200 && em?.start === '08:45' && JSON.stringify(em?.steps) === '["Water","Stretch"]' && JSON.stringify(em?.minutes) === '[2,10]' && edited.json.routine.general.find((b) => b.key === 'work')?.note === 'Deep work first', em);
  const keptStep = await api('PATCH', '/session/routine', { date: today, exceptional: [{ key: 'morning', steps: [] }] }, B.token);
  check('an edit never leaves the morning without a step', keptStep.status === 200 && keptStep.json.routine?.exceptional?.find((b) => b.key === 'morning')?.steps?.length > 0, keptStep.json?.routine?.exceptional?.[0]);
  const get = await api('GET', `/session?date=${today}`, undefined, B.token);
  check('the session answers in one call', get.status === 200 && get.json.assessment && get.json.routine && get.json.contract && Array.isArray(get.json.week?.days), get.status);
  const noPlan = await api('POST', '/session/day', { date: today, steps: [] }, C.token);
  check('a day needs a routine first', noPlan.status === 400, noPlan.json);
  const noRoutine = await api('PATCH', '/session/routine', { general: [] }, C.token);
  check('editing needs a routine first', noRoutine.status === 400, noRoutine.json);
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

// ---------------------------------------------------------------- the assistant and credits
section('Assistant and credits');
{
  const E = await signup(`assistant-${stamp}@smoke.test`, `Beacon-${stamp}-pass`, 'Smoke assistant');
  const status0 = await api('GET', '/assistant', undefined, E.token);
  const mock = status0.json?.model === 'smoke-mock';
  check('the assistant says whether a model is set up, and starts with no plan and no credits', status0.status === 200 && status0.json.account?.plan === 'none' && status0.json.account?.total === 0, status0.json);
  const paywalled = await api('POST', '/assistant', { messages: [{ role: 'user', text: 'tick my task' }], context: { date: today } }, E.token);
  check('typing needs a plan: no plan is refused with the paywall', mock ? paywalled.status === 402 && paywalled.json.paywall === 'plan' : [402, 503].includes(paywalled.status), paywalled.json);
  const credits = await api('GET', '/credits', undefined, E.token);
  check('credits list the three plans, the top-ups and thirty days of use', credits.status === 200 && credits.json.plans?.map((p) => p.key).join() === 'pro,pro_max,ultra' && credits.json.topUps?.length >= 1 && credits.json.usage?.length === 30, credits.json?.plans);
  const checkout = await api('POST', '/credits/checkout', { kind: 'plan', key: 'pro' }, E.token);
  check('checkout charges nothing until payments are live', checkout.status === 409 && checkout.json.live === false, checkout.json);
  const own = await api('POST', `/admin/users/${E.user.id}/plan`, { plan: 'ultra' }, E.token);
  check('a person cannot start their own plan', own.status === 403, own.status);
  const started = await admin('POST', `/admin/users/${E.user.id}/plan`, { plan: 'pro', days: 30 });
  check('an admin starts Pro with its credits', started.status === 200 && started.json.user?.plan === 'pro' && started.json.user?.planCredits === PLANS.pro.credits, started.json.user);
  const granted = await admin('POST', `/admin/users/${E.user.id}/credits`, { credits: 500, note: 'Smoke grant' });
  check('an admin adds extra credits', granted.status === 200 && granted.json.user?.extraCredits === 500, granted.json.user);
  const negative = await admin('POST', `/admin/users/${E.user.id}/credits`, { credits: -5 });
  check('credits are added in positive whole numbers only', negative.status === 400, negative.status);
  const audits = JSON.stringify((await admin('GET', '/admin/audit')).json);
  check('plan and credit changes are audited', audits.includes('user.plan') && audits.includes('user.credits'), '');
  check('a plan wears the Pro mark', (await me(E.token)).isPro === true, '');

  if (!mock) console.log('  (the model checks need the smoke server that blueprint.sh starts with the mock model; skipped)');
  else {
    const answers = QUESTIONS.filter((q) => q.relationship === 'self').map((q) => ({ questionId: q.id, value: 1 }));
    await api('POST', '/onboarding', { answers, displayName: 'Smoke assistant' }, E.token);
    const built = await api('POST', '/onboarding/build', { relationships: ['self'], date: today, picks: { self: {} } }, E.token);
    const mine = (built.json.nodes ?? []).filter((n) => n.kind === 'task').sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
    const say = (text, token = E.token) => api('POST', '/assistant', { messages: [{ role: 'user', text }], context: { path: '/today', date: today, timeZone: 'UTC' } }, token);
    const DO = (...calls) => `DO ${JSON.stringify(calls)}`;
    const nodeOf = async (id, token = E.token) => (await api('GET', '/nodes', undefined, token)).json.nodes?.find((n) => n.id === id);

    const look = await say(DO({ name: 'get_daily' }));
    check('a read runs as the person and changes nothing', look.status === 200 && look.json.receipts?.length === 0 && look.json.calls?.[0]?.tool === 'get_daily' && look.json.calls[0].ok === true, look.json);
    const offered = (mockModel.last?.tools ?? []).map((t) => t.function.name);
    check('the model is offered only the tools for apps that are on', offered.includes('complete_task') && offered.includes('write_journal') && !offered.includes('add_money'), offered);
    check('every request asks the provider to keep nothing (zero retention)', mockModel.last?.provider === undefined || mockModel.last?.provider?.data_collection === 'deny', mockModel.last?.provider);
    const before = (await api('GET', '/credits', undefined, E.token)).json.account;
    const tick = await say(DO({ name: 'complete_task', args: { taskId: mine[0]?.id } }));
    const receipt = tick.json.receipts?.[0];
    check('a write goes through the same route a tap does', tick.status === 200 && receipt?.status === 'done' && receipt.undo === true && receipt.refresh?.includes('today'), tick.json);
    check('the screen sees the task done', (await nodeOf(mine[0]?.id))?.status === 'done', '');
    const after = (await api('GET', '/credits', undefined, E.token)).json.account;
    check('the message is paid in credits from the plan first, extra untouched', tick.json.credits?.spent > 0 && after.planCredits === before.planCredits - tick.json.credits.spent && after.extraCredits === 500, { spent: tick.json.credits, before, after });
    const undo = await api('POST', `/assistant/actions/${receipt?.id}/undo`, { date: today }, E.token);
    check('Undo takes it back through the reverse route', undo.status === 200 && undo.json.receipt?.status === 'undone' && (await nodeOf(mine[0]?.id))?.status === 'active', undo.json);
    const again = await api('POST', `/assistant/actions/${receipt?.id}/undo`, { date: today }, E.token);
    check('an Undo is done once', again.status === 409, again.status);
    const early = await say(DO({ name: 'complete_task', args: { taskId: mine[1]?.id } }));
    check('a task with a later date still waits for its day', early.json.receipts?.[0]?.status === 'failed' && /on the day/i.test(early.json.receipts[0].error), early.json.receipts);
    const theirs = await say(DO({ name: 'complete_task', args: { taskId: ladderTasks[2]?.id ?? ladderTasks[0]?.id } }));
    check("someone else's task cannot be touched", theirs.json.receipts?.[0]?.status === 'failed' && (await nodeOf(ladderTasks[2]?.id ?? ladderTasks[0]?.id, B.token))?.status !== undefined, theirs.json.receipts);
    const sneaky = await say(DO({ name: 'complete_task', args: { taskId: '../../admin/users' } }));
    check('an id the model makes up cannot walk the path', sneaky.json.calls?.[0]?.ok === false && /look right/.test(sneaky.json.calls[0].error ?? ''), sneaky.json.calls);

    const item = (await api('POST', '/today/not-to-do', { title: 'Smoke scrolling' }, E.token)).json.item;
    const ask = await say(DO({ name: 'remove_not_to_do', args: { itemId: item?.id } }));
    const pending = ask.json.receipts?.[0];
    const stillThere = async () => (await api('GET', `/today?date=${today}`, undefined, E.token)).json.notToDo?.some((i) => i.id === item?.id);
    check('a removal waits for Confirm and changes nothing yet', pending?.status === 'pending' && /Smoke scrolling/.test(pending.label) && (await stillThere()), ask.json.receipts);
    const stranger = await api('POST', `/assistant/actions/${pending?.id}/confirm`, { date: today }, C.token);
    check("nobody else can confirm a person's card", stranger.status === 404, stranger.status);
    const cancelled = await api('POST', `/assistant/actions/${pending?.id}/cancel`, {}, E.token);
    check('Cancel leaves it as it was', cancelled.json.receipt?.status === 'cancelled' && (await stillThere()), cancelled.json);
    const ask2 = await say(DO({ name: 'remove_not_to_do', args: { itemId: item?.id } }));
    const confirmed = await api('POST', `/assistant/actions/${ask2.json.receipts?.[0]?.id}/confirm`, { date: today }, E.token);
    check('Confirm runs it, as the person', confirmed.status === 200 && confirmed.json.receipt?.status === 'done' && !(await stillThere()), confirmed.json);

    const secret = `Smoke secret ${stamp}`;
    const wrote = await say(DO({ name: 'write_journal', args: { body: secret } }));
    check('the journal can be written by asking', wrote.json.receipts?.[0]?.status === 'done' && wrote.json.receipts[0].label === 'Wrote a journal entry', wrote.json.receipts);
    const exported = await api('GET', '/me/export', undefined, E.token);
    const actions = JSON.stringify(exported.json.assistantActions ?? null);
    check('the export carries what the assistant did, and never the journal text', Array.isArray(exported.json.assistantActions) && exported.json.assistantActions.length >= 3 && !actions.includes(secret) && JSON.stringify(exported.json.journal).includes(secret), actions.slice(0, 200));
    await api('PATCH', '/me/modules', { key: 'journal', on: false }, E.token);
    const off = await say(DO({ name: 'write_journal', args: { body: 'Should not land' } }));
    check('an app switched off is out of reach', off.json.calls?.[0]?.ok === false && /switched off/.test(off.json.calls[0].error ?? ''), off.json.calls);
    const shy = await say('ASK');
    check('a model that asks leave to do what was asked is told to go ahead, and does it', shy.status === 200 && shy.json.calls?.some((x) => x.tool === 'check_in' && x.ok), shy.json.calls);
    const which = await say('WHICH');
    check('a real question (which one) is left for the person to answer', which.status === 200 && which.json.calls?.length === 0 && /Which one/.test(which.json.text ?? ''), which.json);
    const runId = crypto.randomUUID();
    const running = api('POST', '/assistant', { messages: [{ role: 'user', text: `SLOW ${DO({ name: 'complete_task', args: { taskId: mine[0]?.id } })}` }], runId, context: { path: '/today', date: today, timeZone: 'UTC' } }, E.token);
    await new Promise((r) => setTimeout(r, 800));
    const stopNow = await api('POST', '/assistant/stop', { runId }, E.token);
    const halted = await running;
    check('Stop ends a message before its tools run, and says nothing changed', stopNow.status === 200 && halted.json.stopped === 'user' && halted.json.receipts?.length === 0 && (await nodeOf(mine[0]?.id))?.status === 'active', halted.json);
    const noId = await api('POST', '/assistant/stop', {}, E.token);
    check('Stop needs the run it stops', noId.status === 400, noId.status);
    const broken = await say('FAIL');
    check('a model that fails before doing anything is an error, not the assistant talking', broken.status === 502 && /could not answer/.test(broken.json?.error ?? ''), broken.json);
    const named = await say(DO({ name: 'add_not_to_do', args: { title: 'Smoke late nights', pillar: RELATIONSHIPS[0].name } }));
    check('a pillar given by its name instead of its key is understood', named.json.receipts?.[0]?.status === 'done', named.json.calls);
    const many = await say(DO(...Array.from({ length: 9 }, () => ({ name: 'get_routine' }))));
    const answered = (mockModel.last?.messages ?? []).filter((m) => m.role === 'tool');
    check('every tool call gets an answer, and past eight the answer says to call again', many.status === 200 && answered.length === 9 && /at most 8/.test(answered.at(-1)?.content ?? ''), answered.length);
    const notes = JSON.stringify(off.json);
    check('a reply carries a note of what was done, for the next turn', typeof wrote.json.note === 'string' && wrote.json.note.includes('write_journal') && notes.length > 0, wrote.json.note);
  }

  const ended = await admin('POST', `/admin/users/${E.user.id}/plan`, { plan: 'none' });
  const left = (await api('GET', '/credits', undefined, E.token)).json;
  check('ending the plan expires its credits and keeps the extra ones', ended.json.user?.plan === 'none' && left.account?.planCredits === 0 && left.account?.extraCredits === 500, left.account);
  const history = await api('GET', '/credits/ledger?size=50', undefined, E.token);
  const reasons = new Set((history.json.entries ?? []).map((e) => e.reason));
  check('the history shows the plan, the grant, the use and the expiry', ['plan', 'admin', 'expire'].every((r) => reasons.has(r)) && (!mock || reasons.has('usage')), [...reasons]);
  check('no plan, no Pro mark', (await me(E.token)).isPro === false, '');
}

// ---------------------------------------------------------------- attendee codes
section('Attendee codes');
{
  // Its own address, so these sign-ups never touch the sign-up limit the rest of the checks use.
  const CODE_ADDRESS = `10.${(seed >> 16) & 255}.${(seed >> 8) & 255}.${(seed + 3) & 255}`;
  const join = async (who) => {
    const r = await api('POST', '/auth/signup', { email: `${who}-${stamp}@smoke.test`, password: `Kettle-${stamp}-pass`, displayName: `Smoke ${who}`, phone: PHONE, birthDate: GROWN }, null, { 'CF-Connecting-IP': CODE_ADDRESS });
    return { token: r.json.token, user: r.json.user };
  };
  const H = await join('host');
  const G = await join('guest');
  const O = await join('outsider');
  for (const t of [H, G, O]) for (const key of ['party', 'run', 'circles']) await api('PATCH', '/me/modules', { key, on: true }, t.token);
  const soon = (min) => new Date(Date.now() + min * 60_000).toISOString();

  // Party: xp set with the event, a code in the host's own word.
  const made = await api('POST', '/party/events', { title: `Coffee walk ${stamp}`, startsAt: soon(10), minutes: 60, attendeeXp: 30, attendeeCode: 'smoke meet' }, H.token);
  const ev = made.json.event;
  check('a host sets the guests’ xp and their own code when making the event', made.status === 201 && ev?.attendeeXp === 30 && made.json.codeError === null, made.json);
  const asHost = await api('GET', `/party/events/${ev.id}`, undefined, H.token);
  check('the host sees the code, the xp and how many claimed it', asHost.json.hostCode?.code === 'SMOKEMEET' && asHost.json.hostCode.xp === 30 && asHost.json.hostCode.claims === 0, asHost.json.hostCode);
  const tooMuch = await api('PUT', `/party/events/${ev.id}/attendee-code`, { xp: ATTENDEE_XP_MAX + 1 }, H.token);
  check(`the xp a host sets is capped at ${ATTENDEE_XP_MAX}`, tooMuch.status === 400, tooMuch.json);
  const notHost = await api('PUT', `/party/events/${ev.id}/attendee-code`, { xp: 50 }, O.token);
  check('only the host (or events staff) sets the code', notHost.status === 403, notHost.status);
  await api('POST', `/party/events/${ev.id}/rsvp`, {}, G.token);
  const asGuest = await api('GET', `/party/events/${ev.id}`, undefined, G.token);
  check('a guest sees the xp and that the code is open, never the code itself', asGuest.json.attendee?.xp === 30 && asGuest.json.attendee.state === 'open' && !JSON.stringify(asGuest.json).includes('SMOKEMEET'), asGuest.json.attendee);
  const stranger = await api('POST', `/party/events/${ev.id}/claim`, { code: 'SMOKEMEET' }, O.token);
  check('someone not on the guest list cannot use the code', stranger.status === 403, stranger.json);
  const self = await api('POST', `/party/events/${ev.id}/claim`, { code: 'SMOKEMEET' }, H.token);
  check('the host never claims their own code', self.status === 403, self.json);
  const wrong = await api('POST', `/party/events/${ev.id}/claim`, { code: 'NOPE1' }, G.token);
  check('a wrong code pays nothing', wrong.status === 400, wrong.json);
  const xpBefore = (await me(G.token)).xp;
  const got = await api('POST', `/party/events/${ev.id}/claim`, { code: 'Smoke-Meet' }, G.token);
  check('a guest typing the code (any case, any spacing) gets the xp the host set', got.status === 201 && got.json.xp === 30 && (await me(G.token)).xp === xpBefore + 30, got.json);
  const twice = await api('POST', `/party/events/${ev.id}/claim`, { code: 'SMOKEMEET' }, G.token);
  check('a code pays once per person', twice.status === 409, twice.json);
  const reg = (await api('GET', `/party/events/${ev.id}`, undefined, H.token)).json;
  check('claiming the code checks the guest in', reg.registrations?.find((r) => r.userId === G.user.id)?.status === 'attended' && reg.hostCode?.claims === 1, reg.registrations?.map((r) => r.status));
  const recoded = await api('PUT', `/party/events/${ev.id}/attendee-code`, { fresh: true }, H.token);
  check('a leaked code can be replaced by a random one', recoded.status === 200 && recoded.json.hostCode?.code !== 'SMOKEMEET' && recoded.json.hostCode.claims === 1, recoded.json);
  const started = await api('POST', '/party/events', { title: `Already on ${stamp}`, startsAt: soon(20), minutes: 60 }, H.token);
  const late = await api('PUT', `/party/events/${started.json.event.id}/attendee-code`, { xp: 20 }, H.token);
  check('the xp is set before the code opens, thirty minutes before the start, never after', late.status === 400 && /before the code opens/.test(late.json.error ?? ''), late.json);
  const moved = await api('PUT', `/party/events/${ev.id}/attendee-code`, { xp: 40 }, H.token);
  check('once the code is open the xp is fixed, even before the start', moved.status === 400 && /fixed once the code opens/.test(moved.json.error ?? ''), moved.json);
  const fixedEvent = await api('POST', '/party/events', { title: `Fixed xp ${stamp}`, startsAt: soon(-1), minutes: 60, attendeeXp: 20 }, H.token);
  check('an event made after its start gets no code, and says why', fixedEvent.status === 201 && fixedEvent.json.event?.attendeeXp === null && /already started/.test(fixedEvent.json.codeError ?? ''), fixedEvent.json);
  await api('PATCH', '/me/modules', { key: 'party', on: true }, A.token);
  await api('POST', `/party/events/${ev.id}/rsvp`, {}, A.token);
  const current = (await api('GET', `/party/events/${ev.id}`, undefined, H.token)).json.hostCode?.code;
  const staffClaim = await api('POST', `/party/events/${ev.id}/claim`, { code: current }, A.token);
  check('staff who can see a code never claim it, even on the guest list', staffClaim.status === 403, staffClaim.json);
  // The day's cap: the guest claims more events' codes.
  let last = 0;
  for (let i = 1; i <= ATTENDEE_CLAIMS_PER_DAY; i += 1) {
    const e = (await api('POST', '/party/events', { title: `More ${i} ${stamp}`, startsAt: soon(5), minutes: 30, attendeeXp: 5, attendeeCode: `MORE${i}X` }, H.token)).json.event;
    await api('POST', `/party/events/${e.id}/rsvp`, {}, G.token);
    last = (await api('POST', `/party/events/${e.id}/claim`, { code: `MORE${i}X` }, G.token)).status;
  }
  check(`event codes pay at most ${ATTENDEE_CLAIMS_PER_DAY} a day`, last === 429, last);

  // Run: the host sets the run's xp and can use their own word as the start code; the host does not log their own run.
  const club = (await api('POST', '/run/clubs', { name: `Code runners ${stamp}`, city: 'Bengaluru', pace: 'easy', meets: 'Gate' }, H.token)).json.club;
  const capped = await api('POST', `/run/clubs/${club.id}/runs`, { title: 'Too much', startsAt: soon(10), minutes: 60, xp: ATTENDEE_XP_MAX + 10 }, H.token);
  check(`a run's xp is capped at ${ATTENDEE_XP_MAX} too`, capped.status === 400, capped.json);
  const pastRun = await api('POST', `/run/clubs/${club.id}/runs`, { title: 'Added late', startsAt: soon(-10), minutes: 60, xp: 50 }, H.token);
  check('a run added after its start gets its code, but only the usual xp, and says why', pastRun.status === 201 && pastRun.json.run?.xp === ATTENDEE_XP_DEFAULT && /already started/.test(pastRun.json.codeError ?? ''), pastRun.json);
  const runMade = await api('POST', `/run/clubs/${club.id}/runs`, { title: 'Own word run', startsAt: soon(10), minutes: 60, xp: 35, code: 'go team' }, H.token);
  check('a host sets the run’s xp and their own start code', runMade.status === 201 && runMade.json.run?.xp === 35 && runMade.json.run.code === 'GOTEAM', runMade.json.run);
  await api('POST', `/run/clubs/${club.id}/join`, {}, G.token);
  const hostLog = await api('POST', `/run/runs/${runMade.json.run.id}/entry`, { code: 'GOTEAM' }, H.token);
  check('the host does not log their own run', hostLog.status === 403, hostLog.json);
  const ran = await api('POST', `/run/runs/${runMade.json.run.id}/entry`, { code: 'goteam', minutes: 30 }, G.token);
  check('a runner who enters the host’s word gets the run’s xp', ran.status === 201 && ran.json.xp === 35, ran.json);
  const reRun = await api('POST', `/run/runs/${runMade.json.run.id}/recode`, {}, H.token);
  check('New code with nothing asked is still a fresh random code', reRun.status === 200 && reRun.json.code !== 'GOTEAM' && reRun.json.xp === 35, reRun.json);

  // Circles: the code works only for the people seated.
  const circle = await api('POST', '/circles/events', { title: `Code circle ${stamp}`, city: 'Bengaluru', startsAt: soon(60 * 24 * 5), attendeeXp: 25, attendeeCode: 'TABLE5' }, A.token);
  check('events staff open a circle with xp for the people seated', circle.status === 201 && circle.json.event?.attendeeXp === 25 && circle.json.event.hostCode?.code === 'TABLE5', circle.json.event);
  const unseated = await api('POST', `/circles/events/${circle.json.event.id}/claim`, { code: 'TABLE5' }, G.token);
  check('someone not seated at the circle cannot use its code', unseated.status === 403, unseated.json);
  const circleNotStaff = await api('PUT', `/circles/events/${circle.json.event.id}/attendee-code`, { xp: 50 }, G.token);
  check('only the circle’s host or events staff set its code', circleNotStaff.status === 403, circleNotStaff.status);
  // A weekly circle: once this week's tables are set, next week's opens with the same xp and a new code.
  const weeklyCircle = (await api('POST', '/circles/events', { title: `Weekly code ${stamp}`, city: `Code town ${stamp}`, startsAt: soon(60 * 24 * 3), repeat: 'weekly', attendeeXp: 15, attendeeCode: 'WEEKONE' }, A.token)).json.event;
  await api('POST', `/circles/events/${weeklyCircle.id}/match`, {}, A.token);
  await fetch(`${ORIGIN}/__scheduled?cron=*+*+*+*+*`);
  const running = await api('GET', '/circles?hostsize=100', undefined, A.token);
  check('the team sees every circle they run, with its code, in any city', running.status === 200 && running.json.hosting?.some((e) => e.id === weeklyCircle.id && e.hostCode?.code === 'WEEKONE'), running.json.hosting?.length);
  const series = (await admin('GET', `/admin/attendee-codes?app=circles&q=${encodeURIComponent(`Weekly code ${stamp}`)}`)).json.codes ?? [];
  const nextWeek = series.find((r) => r.thingId !== weeklyCircle.id);
  check('next week’s circle keeps the xp with a new random code', series.length === 2 && nextWeek?.xp === 15 && nextWeek.code && nextWeek.code !== 'WEEKONE', series);
  const notRunning = await api('GET', '/circles', undefined, G.token);
  check('people who do not run circles get no codes', Array.isArray(notRunning.json.hosting) && notRunning.json.hosting.length === 0 && !JSON.stringify(notRunning.json).includes('WEEKONE'), notRunning.json.hosting?.length);

  // Admin: every event with guests, and the same rules from the panel.
  const listed = await admin('GET', `/admin/attendee-codes?app=party&q=${encodeURIComponent(`Coffee walk ${stamp}`)}`);
  const row = listed.json.codes?.find((r) => r.thingId === ev.id);
  check('admins see every event’s xp, code and claims', listed.status === 200 && row?.xp === 30 && row.claims === 1 && row.guests >= 1, row);
  const adminSet = await admin('PUT', `/admin/attendee-codes/party/${ev.id}`, { code: 'ADMINSET' });
  check('an admin sets any event’s code', adminSet.status === 200 && adminSet.json.code?.code === 'ADMINSET', adminSet.json);
  const runRow = await admin('PUT', `/admin/attendee-codes/run/${runMade.json.run.id}`, { xp: 999 });
  check('the admin is held to the same cap', runRow.status === 400, runRow.json);
  const notAdmin = await api('GET', '/admin/attendee-codes', undefined, H.token);
  check('the attendee code panel is for admins only', notAdmin.status === 403, notAdmin.status);
  const auditText = JSON.stringify((await admin('GET', '/admin/audit')).json);
  check('code changes are audited', auditText.includes('attendee_code.set'), '');
  const exp = await api('GET', '/me/export', undefined, G.token);
  check('a person’s claims are in their export', Array.isArray(exp.json.attendeeClaims) && exp.json.attendeeClaims.length >= 1, exp.json.attendeeClaims?.length);
}

// ---------------------------------------------------------------- life coaches
section('Life coaches');
{
  const COACH_ADDRESS = `10.${(seed >> 16) & 255}.${(seed >> 8) & 255}.${(seed + 4) & 255}`;
  const join = async (who) => {
    const email = `${who}-${stamp}@smoke.test`;
    const r = await api('POST', '/auth/signup', { email, password: `Compass-${stamp}-pass`, displayName: `Smoke ${who}`, phone: PHONE, birthDate: GROWN }, null, { 'CF-Connecting-IP': COACH_ADDRESS });
    return { token: r.json.token, user: r.json.user, email };
  };
  const K = await join('coach');
  const S = await join('student');
  const T = await join('third');

  // Saying "I'm a life coach" in the setup chat asks the team; nothing is given until an admin says yes.
  const setup = await api('POST', '/onboarding/setup', { identities: ['coach'], goals: ['sell'], blockers: [] }, K.token);
  check('saying you are a life coach in the setup chat asks the team', setup.status === 200 && setup.json.coach === 'asked' && setup.json.on?.includes('coaching'), { coach: setup.json.coach, on: setup.json.on });
  const asks = await admin('GET', '/admin/coaching/asks?size=100');
  check('admins see who asked to be a life coach', asks.json.asks?.some((a) => a.userId === K.user.id), asks.json.asks?.length);
  const early = await api('POST', '/coach/requests', { who: S.email }, K.token);
  check('nobody coaches before the team makes them a life coach', early.status === 403, early.json);
  const adminHub = await api('GET', '/coach', undefined, A.token);
  check('an admin is not a life coach unless given it', adminHub.status === 200 && adminHub.json.coach === false, adminHub.json.coach);
  const granted = await admin('POST', `/admin/users/${K.user.id}/permissions`, { permissions: ['coach'] });
  check('an admin makes someone a life coach with the permission', granted.status === 200 && granted.json.user?.permissions?.includes('coach') && granted.json.user.coachAskedAt === null, granted.json.user);
  const told = await api('GET', '/inbox', undefined, K.token);
  check('the new coach is told', JSON.stringify(told.json).includes('You are a life coach now'), '');
  const meK = await me(K.token);
  check('a creator who coaches holds the permission the badge reads', meK.role === 'user' && meK.permissions.includes('coach'), meK.permissions);

  // The student has a pyramid to add tasks to, and a journal a coach must never read.
  const answers = QUESTIONS.filter((q) => q.relationship === 'self').map((q) => ({ questionId: q.id, value: 1 }));
  await api('POST', '/onboarding', { answers, displayName: 'Smoke student' }, S.token);
  const built = await api('POST', '/onboarding/build', { relationships: ['self'], date: today, picks: { self: { project: 'Coached project' } } }, S.token);
  const sProject = (built.json.nodes ?? []).find((n) => n.kind === 'project');
  const secret = `Private journal line ${stamp}`;
  await api('PATCH', '/me/modules', { key: 'journal', on: true }, S.token);
  await api('POST', '/journal', { title: secret, body: secret }, S.token);

  // A coach asks by email; nothing is shared until the student says yes.
  const asked = await api('POST', '/coach/requests', { who: S.email }, K.token);
  check('a life coach asks a student by email', asked.status === 201 && asked.json.link?.status === 'pending', asked.json);
  const twice = await api('POST', '/coach/requests', { who: S.email }, K.token);
  check('one ask at a time between the same two', twice.status === 409, twice.json);
  const peek = await api('GET', `/coach/students/${S.user.id}`, undefined, K.token);
  check('a coach sees nothing before the yes', peek.status === 404, peek.status);
  const linkId = asked.json.link?.id;
  const selfAnswer = await api('POST', `/me/coach/links/${linkId}/answer`, { yes: true }, K.token);
  check('the side that asked cannot answer its own ask', selfAnswer.status === 403, selfAnswer.json);
  const mine = await api('GET', '/me/coach', undefined, S.token);
  check('the student sees the ask under /me/coach', mine.json.links?.some((l) => l.id === linkId && l.status === 'pending' && l.coach.badge === 'coach'), mine.json.links?.length);
  const yes = await api('POST', `/me/coach/links/${linkId}/answer`, { yes: true }, S.token);
  check('the student says yes', yes.status === 200 && yes.json.link?.status === 'active', yes.json);

  const view = await api('GET', `/coach/students/${S.user.id}`, undefined, K.token);
  const text = JSON.stringify(view.json);
  check('a coach sees what the student shares: daily, pillars, routine, life map and reflection', view.status === 200 && view.json.daily && view.json.pillars?.nodes?.length >= 6 && view.json.reflection?.wellbeing && 'routine' in view.json && 'lifeMap' in view.json, view.status);
  check('the journal never reaches a coach', !text.includes(secret), '');
  const off = await api('PATCH', `/me/coach/links/${linkId}/share`, { reflection: false }, S.token);
  const viewOff = await api('GET', `/coach/students/${S.user.id}`, undefined, K.token);
  check('a part the student switches off is gone from the coach’s view at once', off.status === 200 && viewOff.json.reflection === null && viewOff.json.daily !== null, viewOff.json.reflection);

  // The coach adds and changes a task; the student ticks it, the coach never does.
  const added = await api('POST', `/coach/students/${S.user.id}/tasks`, { parentId: sProject?.id, title: 'Walk after lunch', dueDate: today }, K.token);
  check('a coach adds a task under the student’s project', added.status === 201 && added.json.node?.fromCoach === true, added.json);
  const sNodes = await api('GET', '/nodes', undefined, S.token);
  check('the student sees it, marked from the coach', sNodes.json.nodes?.some((n) => n.id === added.json.node?.id && n.fromCoach), '');
  const changed = await api('PATCH', `/coach/students/${S.user.id}/tasks/${added.json.node?.id}`, { title: 'Walk after lunch, 20 min', status: 'archived' }, K.token);
  check('a coach changes the words, never the status', changed.status === 200 && changed.json.node?.title === 'Walk after lunch, 20 min' && changed.json.node.status === 'active', changed.json.node);
  const badParent = await api('POST', `/coach/students/${S.user.id}/tasks`, { parentId: 'not-a-project', title: 'Nope' }, K.token);
  check('a coach’s task needs one of the student’s projects', badParent.status === 400, badParent.json);
  const note = await api('POST', `/coach/students/${S.user.id}/notes`, { body: 'Good week. Keep the walks.' }, K.token);
  check('a coach leaves a note', note.status === 201, note.json);
  const notes = await api('GET', '/me/coach', undefined, S.token);
  check('the student reads every note', notes.json.notes?.some((n) => n.body === 'Good week. Keep the walks.'), notes.json.notes?.length);
  const log = await api('GET', '/me/coach/log', undefined, S.token);
  const lines = (log.json.log ?? []).map((l) => l.action);
  check('the change log keeps the ask, the yes, the share change, the task changes and the note, with times', ['link.ask', 'link.yes', 'share.change', 'task.add', 'task.edit', 'note.add'].every((a) => lines.includes(a)) && log.json.log.every((l) => l.createdAt), lines);
  const hub = await api('GET', '/coach', undefined, K.token);
  check('the coach’s roster lists the student with what they share', hub.json.coach === true && hub.json.counts?.students === 1 && hub.json.students?.[0]?.student?.id === S.user.id && hub.json.students[0].share.reflection === false, hub.json.counts);

  // The student finds a coach in the directory and asks; a no waits a month before another ask.
  const dir = await api('GET', '/coach/directory?dirsize=100', undefined, T.token);
  check('the directory lists life coaches taking students', dir.json.coaches?.some((k) => k.coach.id === K.user.id), dir.json.coaches?.length);
  const tAsks = await api('POST', `/coach/ask/${K.user.id}`, {}, T.token);
  check('a student asks a coach from the directory', tAsks.status === 201 && tAsks.json.link?.askedBy === 'student', tAsks.json);
  const no = await api('POST', `/me/coach/links/${tAsks.json.link?.id}/answer`, { yes: false }, K.token);
  check('the coach answers a student’s ask', no.status === 200 && no.json.link?.status === 'declined', no.json);
  const again = await api('POST', `/coach/ask/${K.user.id}`, {}, T.token);
  check('after a no, the same ask waits a month', again.status === 409, again.json);

  // An admin links two directly; either side can end it, and the view closes at once.
  const notCoach = await admin('POST', '/admin/coaching/links', { coachId: T.user.id, student: S.email, mode: 'link' });
  check('only a life coach can be linked as one', notCoach.status === 400, notCoach.json);
  await admin('POST', `/admin/users/${T.user.id}/permissions`, { permissions: ['coach'] });
  const direct = await admin('POST', '/admin/coaching/links', { coachId: T.user.id, student: S.email, mode: 'link' });
  check('an admin links a coach and a student directly', direct.status === 201 && direct.json.link?.status === 'active', direct.json);
  const ended = await api('DELETE', `/me/coach/links/${direct.json.link?.id}`, undefined, S.token);
  const gone = await api('GET', `/coach/students/${S.user.id}`, undefined, T.token);
  check('the student ends it and the coach sees nothing more', ended.status === 200 && gone.status === 404, gone.status);

  // Switching Coaching off closes the coach's side; the student's side stays open, so nobody is stuck.
  await admin('POST', '/admin/flags/coaching', { enabled: false });
  const shut = await api('GET', '/coach', undefined, K.token);
  const stillMine = await api('GET', '/me/coach', undefined, S.token);
  await admin('POST', '/admin/flags/coaching', { enabled: true });
  check('Coaching off closes the coach’s side, never the student’s', shut.status === 403 && stillMine.status === 200, { shut: shut.status, mine: stillMine.status });

  // Taking the badge away ends every link of that coach, and the student is told.
  const taken = await admin('POST', `/admin/users/${K.user.id}/permissions`, { permissions: [] });
  const after = await api('GET', '/me/coach', undefined, S.token);
  const sInbox = await api('GET', '/inbox', undefined, S.token);
  check('taking the badge away ends the coaching and tells the student', taken.status === 200 && !after.json.links?.some((l) => l.coach.id === K.user.id) && JSON.stringify(sInbox.json).includes('has ended'), after.json.links?.length);
  const exp = await api('GET', '/me/export', undefined, S.token);
  check('coaching is in the student’s export', exp.json.coachLinks?.length >= 2 && exp.json.coachNotes?.length >= 1 && exp.json.coachLog?.length >= 6, { links: exp.json.coachLinks?.length, notes: exp.json.coachNotes?.length });
}

// ---------------------------------------------------------------- engagement: reactions, threads, pins, inbox, reminders, seasons, brief
section('Engagement');
{
  const ADDRESS = `10.${(seed >> 16) & 255}.${(seed >> 8) & 255}.${(seed + 5) & 255}`;
  const join = async (who) => {
    const r = await api('POST', '/auth/signup', { email: `${who}-${stamp}@smoke.test`, password: `Lighthouse-${stamp}-pass`, displayName: `Smoke ${who}`, phone: PHONE, birthDate: GROWN }, null, { 'CF-Connecting-IP': ADDRESS });
    await api('PATCH', '/me/modules', { key: 'community', on: true }, r.json.token);
    await api('PATCH', '/me/modules', { key: 'party', on: true }, r.json.token);
    return { token: r.json.token, user: r.json.user };
  };
  const P = await join('poster');
  const R = await join('reacter');
  const W = await join('watcher');
  const handle = `smk${stamp}`.slice(0, 20);
  await api('PATCH', '/me', { handle }, W.token);

  // Reactions: the first one pays as the like did, changing it pays nothing more, the same one again takes it back.
  const post = (await api('POST', '/community', { category: 'Stories', body: `Engagement post ${stamp}` }, P.token)).json.post;
  const first = await api('POST', `/community/${post.id}/like`, { kind: 'celebrate' }, R.token);
  check('a reaction counts as the like that pays', first.status === 200 && first.json.post?.myReaction === 'celebrate' && first.json.post.reactions?.celebrate === 1 && first.json.awarded?.xp > 0, first.json.post?.reactions);
  const changed = await api('POST', `/community/${post.id}/like`, { kind: 'insightful' }, R.token);
  check('changing a reaction pays nothing more', changed.json.post?.myReaction === 'insightful' && changed.json.post.likes === 1 && changed.json.awarded?.xp === 0, changed.json.awarded);
  const off = await api('POST', `/community/${post.id}/like`, { kind: 'insightful' }, R.token);
  check('the same reaction again takes it back', off.json.post?.myReaction === null && off.json.post.likes === 0, off.json.post?.likes);

  // Following a post and mentions: the author follows by default; a follower hears about replies, a mention is told.
  check('the author follows their own post', post.followingPost === true, post.followingPost);
  await api('POST', `/community/${post.id}/follow-post`, {}, W.token);
  await api('POST', `/community/${post.id}/replies`, { body: 'A reply for the followers' }, R.token);
  const wInbox = await api('GET', '/inbox?tab=following', undefined, W.token);
  check('a follower of the post hears about a new reply, under Following', wInbox.json.notifications?.some((n) => n.kind === 'thread'), wInbox.json.notifications?.map((n) => n.kind));
  await api('POST', '/community', { category: 'Stories', body: `Hey @${handle}, look at this ${stamp}` }, P.token);
  const mentions = await api('GET', '/inbox?tab=replies', undefined, W.token);
  check('an @page name tells that person, under Replies and mentions', mentions.json.notifications?.some((n) => n.kind === 'mention'), mentions.json.tabs);
  const reply = (await api('GET', `/community/${post.id}/replies`, undefined, P.token)).json.replies?.[0];
  const rr = await api('POST', `/community/replies/${reply?.id}/react`, { kind: 'love' }, P.token);
  check('a reply takes reactions too', rr.status === 200 && rr.json.reply?.reactions?.love === 1, rr.json.reply?.reactions);

  // Inbox: archive puts a note away, Archived finds it again.
  const note = wInbox.json.notifications?.[0];
  await api('POST', `/inbox/${note?.id}/archive`, { archived: true }, W.token);
  const away = await api('GET', '/inbox?tab=following', undefined, W.token);
  const archived = await api('GET', '/inbox?tab=following&show=archived', undefined, W.token);
  check('archiving moves a note out of the inbox and into Archived', !away.json.notifications?.some((n) => n.id === note?.id) && archived.json.notifications?.some((n) => n.id === note?.id && n.readAt), archived.json.notifications?.length);
  const team = await api('GET', '/inbox?tab=team', undefined, W.token);
  check('the Team tab is only for the team', team.json.tab === 'all' && !team.json.tabs?.some((t) => t.tab === 'team'), team.json.tab);

  // Pins: three per category, and only guides pin.
  const feed = await api('GET', '/community?category=Learning&size=100', undefined, A.token);
  for (const p of feed.json.posts ?? []) if (p.pinned) await api('POST', `/manage/community/posts/${p.id}/pin`, { pinned: false }, A.token);
  const pinIds = [];
  for (let i = 0; i < 4; i += 1) pinIds.push((await api('POST', '/community', { category: 'Learning', body: `Pin me ${i} ${stamp}` }, R.token)).json.post?.id);
  const pins = [];
  for (const id of pinIds) pins.push((await api('POST', `/manage/community/posts/${id}/pin`, { pinned: true }, A.token)).status);
  check('a guide pins up to three posts in a category', pins.slice(0, 3).every((st) => st === 200) && pins[3] === 409, pins);
  const notGuide = await api('POST', `/manage/community/posts/${pinIds[3]}/pin`, { pinned: true }, P.token);
  check('only guides pin', notGuide.status === 403, notGuide.status);
  const top = await api('GET', '/community?category=Learning', undefined, R.token);
  check('pinned posts come first in their category', (top.json.posts ?? []).slice(0, 3).every((p) => p.pinned), (top.json.posts ?? []).slice(0, 3).map((p) => p.pinned));
  for (const id of pinIds.slice(0, 3)) await api('POST', `/manage/community/posts/${id}/pin`, { pinned: false }, A.token);

  // Held first posts: with holding on, a new member's first post waits for a guide, then pays.
  await api('PUT', '/manage/community/settings', { holdFirstPosts: true }, A.token);
  const N = await join('newbie');
  const held = await api('POST', '/community', { category: 'Stories', body: `My first post ${stamp}` }, N.token);
  const othersFeed = await api('GET', '/community?filter=all&size=100', undefined, R.token);
  check('a new member’s first post waits, unpaid and unseen by others', held.json.held === true && held.json.awarded?.xp === 0 && !othersFeed.json.posts?.some((p) => p.id === held.json.post?.id), held.json);
  const queue = await api('GET', '/manage/community/held', undefined, A.token);
  const okay = await api('POST', `/manage/community/posts/${held.json.post?.id}/approve`, {}, A.token);
  const nMe = await me(N.token);
  check('a guide says okay, the post goes up and pays', queue.json.posts?.some((p) => p.id === held.json.post?.id) && okay.status === 200 && okay.json.post?.held === false && nMe.xp > 0, { held: okay.json.post?.held, xp: nMe.xp });
  await api('PUT', '/manage/community/settings', { holdFirstPosts: false }, A.token);

  // Events: a reminder an hour before, once; a host runs the event again on a new date.
  const ev = (await api('POST', '/party/events', { title: `Reminder walk ${stamp}`, startsAt: new Date(Date.now() + 40 * 60_000).toISOString(), minutes: 60, attendeeXp: 10 }, P.token)).json.event;
  await api('POST', `/party/events/${ev.id}/rsvp`, {}, R.token);
  await fetch(`${ORIGIN}/__scheduled?cron=*+*+*+*+*`);
  await fetch(`${ORIGIN}/__scheduled?cron=*+*+*+*+*`);
  const reminded = await api('GET', '/inbox?tab=events&size=100', undefined, R.token);
  const hourNotes = (reminded.json.notifications ?? []).filter((n) => n.title === `In under an hour: Reminder walk ${stamp}`);
  check('a guest gets one reminder an hour before, under Events', hourNotes.length === 1, hourNotes.length);
  const again = await api('POST', `/party/events/${ev.id}/duplicate`, { startsAt: new Date(Date.now() + 8 * 86_400_000).toISOString() }, P.token);
  const againPage = await api('GET', `/party/events/${again.json.event?.id}`, undefined, P.token);
  check('a host runs an event again: same details, no guests, the xp with a new code', again.status === 201 && again.json.event?.title === ev.title && again.json.event.registered === 0 && againPage.json.hostCode?.xp === 10, againPage.json.hostCode);
  const notHost = await api('POST', `/party/events/${ev.id}/duplicate`, {}, R.token);
  check('only the host runs it again', notHost.status === 403, notHost.status);

  // Seasons and the brief.
  const board = await api('GET', '/leaderboard?by=season', undefined, P.token);
  check('the leaderboard has a monthly season', board.status === 200 && board.json.by === 'season' && /^\d{4}-\d{2}$/.test(board.json.season?.season ?? '') && Array.isArray(board.json.past), board.json.season);
  const brief = await api('GET', `/home/brief?date=${today}&hour=20`, undefined, P.token);
  check('Home has a brief: three signals and three next steps', brief.status === 200 && brief.json.brief?.signals?.length >= 1 && brief.json.brief.actions?.length === 3, brief.json.brief?.actions?.map((a) => a.key));
  check('a new account sees the Getting started list', brief.json.gettingStarted?.show === true && brief.json.gettingStarted.items?.length === 7, brief.json.gettingStarted?.done);
  await api('POST', '/home/getting-started/hide', {}, P.token);
  const folded = await api('GET', `/home/brief?date=${today}&hour=9`, undefined, P.token);
  check('the list folds away for good', folded.json.gettingStarted?.show === false, folded.json.gettingStarted?.show);
  const teamBrief = await api('GET', `/home/brief?date=${today}&hour=9`, undefined, A.token);
  check('the team gets its own lines', Array.isArray(teamBrief.json.brief?.team) && brief.json.brief?.team === null, teamBrief.json.brief?.team?.length);
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
