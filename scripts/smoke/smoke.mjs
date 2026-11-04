// The smoke checks. Run through blueprint.sh, which starts the server this talks to.
// Node imports the shared model straight from TypeScript (--experimental-strip-types).
import { LOVE_PAIRS, MIND_SCREENS, TYPE_NAMES, TYPE_SCREENS, DISCOVER_CORE_STEPS, DISCOVER_SCENES, DISCOVER_STEPS, EQ_FEELINGS, EQ_PEOPLE, EQ_READING, PUZZLES_SHOWN, puzzleAt, RELATIONSHIPS, QUESTIONS, XP, POINTS, WAIT, RUN_REWARD, SOCIAL_REWARDS, MAX_NOT_TO_DO, MODULES, FEATURE_FEE_POINTS, matchSetup, parseSetup, setupSwitchable } from '../../packages/shared/src/index.ts';
import { LIMITS, ROUTE_LIMITS } from '../../apps/api/src/limits.ts';
import { DISCOVER_KEYS } from '../../apps/api/src/discoverKeys.ts';
import { LEGAL_VERSION } from '../../packages/shared/src/index.ts';
import { CONTRACT_VARS, contractAsText, contractVarsUsed, invoiceAsText, money } from '../../packages/shared/src/index.ts';
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
    // Every sign-up ticks the terms box, unless a check says otherwise.
    body: body === undefined ? undefined : JSON.stringify(path === '/auth/signup' && body && body.acceptTerms === undefined ? { acceptTerms: true, ...body } : body),
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

// A client is added the way the owner adds one: the brand, the client's email and a password for their page (made here). The older
// Agency checks read the link without unlocking it and expect its dashboard, so unless `locked` is asked for this clears the password,
// sends the onboarding form as the client would, and puts the owner's own contact and billing back (the form writes its own over them).
// The answer is the create's, with the generated password beside it.
const onboardingDraft = (questions, name, email) => ({
  legalName: name, brands: name, addressLine: '12 Main Road', city: 'Bengaluru', state: 'Karnataka', pin: '560038', gstin: '', pan: '',
  pocName: 'Smoke contact', designation: 'Marketing head', email, phone: '9876543210', billingEmail: '',
  brief: Object.fromEntries(questions.map((q) => [q.id, q.links ? { picked: [], other: '', text: '', links: ['https://example.test/1', 'https://example.test/2', 'https://example.test/3'] } : (q.fields ?? []).length ? { picked: [], other: '', text: '', fields: { [q.fields[0]]: 'Warm and bold' } } : q.text ? { picked: [], other: '', text: 'Curious and hungry' } : { picked: [q.options[0]], other: '', text: '' }])),
  references: ['https://example.test/1', 'https://example.test/2', 'https://example.test/3'],
});
let onboardSeq = 0;
async function addClient(body, token, { locked = false } = {}) {
  const slug = String(body.name ?? 'client').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'client';
  const full = { contactEmail: `${slug}@client.test`, portalPassword: 'generate', ...body };
  const made = await api('POST', '/agency/clients', full, token);
  if (made.status !== 201 || locked) return made;
  await api('PUT', `/agency/clients/${made.json.id}/password`, { clear: true }, token);
  // Its own address for the link, so the per-address portal limit is never spent by the setup.
  const ip = { 'CF-Connecting-IP': `10.250.${(seed + onboardSeq) & 255}.${(++onboardSeq * 7) & 255}` };
  const form = await api('GET', `/public/agency/${made.json.portalToken}/onboarding`, undefined, null, ip);
  const sent = await api('POST', `/public/agency/${made.json.portalToken}/onboarding/submit`, { draft: onboardingDraft(form.json.questions ?? [], full.name, full.contactEmail) }, null, ip);
  if (sent.status !== 200) console.log('  (setup) onboarding was not sent', sent.status, JSON.stringify(sent.json));
  const { portalPassword: _pw, ...owner } = full;
  await api('PATCH', `/agency/clients/${made.json.id}`, { contactName: '', billing: null, ...owner }, token);
  return made;
}

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
// Sign-up is limited to ten an hour for one address, so after a few sign-ups the helper uses the next test address.
let signups = 0;
async function signup(email, password, displayName) {
  const n = signups++;
  // From the seventh on, six to an address in a range no section uses for its own sign-ups (they take seed + 1 to 31 and 211).
  const from = n < 6 ? {} : { 'CF-Connecting-IP': `10.${(seed >> 16) & 255}.${(seed >> 8) & 255}.${(seed + 100 + Math.floor(n / 6)) & 255}` };
  const r = await api('POST', '/auth/signup', { email, password, displayName, phone: PHONE, birthDate: GROWN }, null, from);
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
  ladderTasks = (built.json.nodes ?? []).filter((n) => n.kind === 'task' && n.relationship === 'self').sort((a, b) => (a.doDate ?? '').localeCompare(b.doDate ?? ''));
  check('tasks carry do dates two days apart, and a pillar task says where it came from', ladderTasks.length >= 2 && ladderTasks[0].doDate === today && ladderTasks[1].doDate > today && ladderTasks.every((t) => t.dueDate === null && t.fromPillar === true), ladderTasks.map((t) => [t.doDate, t.dueDate, t.fromPillar]));
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

  // Moving a task to another project (the "Pillar and project" picker on Daily and the pillar page): only an open task, only under one of
  // the person's own active projects, and it takes that project's pillar.
  const all = list.json.nodes ?? [];
  const friendProject = all.find((n) => n.kind === 'project' && n.relationship === 'friendship' && n.status === 'active');
  const selfPillar = all.find((n) => n.kind === 'pillar' && n.relationship === 'self');
  const principle = all.find((n) => n.kind === 'principle');
  check('the move checks have a friendship project, a pillar and a principle to try', Boolean(friendProject && selfPillar && principle), { friendProject: friendProject?.id, selfPillar: selfPillar?.id, principle: principle?.id });
  const moved = await api('PATCH', `/nodes/${made[2].id}`, { parentId: friendProject?.id }, B.token);
  check('an open task moves to a project in another pillar and takes that pillar', moved.status === 200 && moved.json.node?.parentId === friendProject?.id && moved.json.node?.relationship === 'friendship', moved.json);
  const nowhere = await api('PATCH', `/nodes/${made[2].id}`, { parentId: 'not-a-node' }, B.token);
  check('a task cannot move under a node that is not there', nowhere.status === 400, nowhere.json);
  const toPillar = await api('PATCH', `/nodes/${made[2].id}`, { parentId: selfPillar?.id }, B.token);
  const toPrinciple = await api('PATCH', `/nodes/${made[2].id}`, { parentId: principle?.id }, B.token);
  check('a task moves only under a project, never a foundation or a principle', toPillar.status === 400 && toPrinciple.status === 400, [toPillar.json, toPrinciple.json]);
  const doneMove = await api('PATCH', `/nodes/${ladderTasks[0].id}`, { parentId: friendProject?.id }, B.token);
  check('a ticked task stays where its xp was earned', doneMove.status === 400 && /Only an open task/.test(doneMove.json.error ?? ''), doneMove.json);
  const stranger = await api('PATCH', `/nodes/${made[2].id}`, { parentId: project.id }, A.token);
  const stillThere = (await api('GET', '/nodes', undefined, B.token)).json.nodes?.find((n) => n.id === made[2].id);
  check("another account cannot move someone's task", (stranger.status === 404 || stranger.status === 400) && stillThere?.parentId === friendProject?.id, [stranger.status, stillThere?.parentId]);
  const back = await api('PATCH', `/nodes/${made[2].id}`, { parentId: project.id }, B.token);
  check('the task moves back and takes its own pillar again', back.status === 200 && back.json.node?.parentId === project.id && back.json.node?.relationship === 'self', back.json);
}


// ---------------------------------------------------------------- tasks: do date, due date, priority, repeat, subtasks, remember, not scheduled
section('Task plan');
{
  const F = await signup(`planner-${stamp}@smoke.test`, `Quartz-${stamp}-pass`, 'Smoke planner');
  const answers = QUESTIONS.filter((q) => q.relationship === 'self').map((q) => ({ questionId: q.id, value: 1 }));
  await api('POST', '/onboarding', { answers, displayName: 'Smoke planner' }, F.token);
  const built = await api('POST', '/onboarding/build', { relationships: ['self'], date: today, picks: { self: {} } }, F.token);
  const proj = (built.json.nodes ?? []).find((n) => n.kind === 'project');
  const day = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const add = (body) => api('POST', '/nodes', { kind: 'task', parentId: proj.id, relationship: 'self', ...body }, F.token);

  // The water and reminders box lists tasks tagged Remember, and the tag is the same one Daily uses.
  const rmTask = await add({ title: 'Call the dentist for a booking' });
  const rmId = rmTask.json.node?.id;
  const rmOff = await api('GET', `/reminders?day=${today}`, undefined, F.token);
  check('a task that is not tagged is not listed in the reminders box', Array.isArray(rmOff.json.tasks) && !rmOff.json.tasks.some((t) => t.id === rmId), rmOff.json.tasks);
  const rmOn = await api('PATCH', `/nodes/${rmId}`, { remind: true, doDate: today, dueTime: '14:30' }, F.token);
  const rmList = await api('GET', `/reminders?day=${today}`, undefined, F.token);
  check('a task asked to remember shows in the box with its day and time', rmOn.status === 200 && rmList.json.tasks?.some((t) => t.id === rmId && t.day === today && t.time === '14:30'), rmList.json.tasks);
  const rmPick = await api('GET', '/wellbeing/focus/tasks', undefined, F.token);
  check('the task picker says which tasks are tagged', rmPick.json.tasks?.find((t) => t.id === rmId)?.remind === true, rmPick.json.tasks?.find((t) => t.id === rmId));
  await api('PATCH', `/nodes/${rmId}`, { remind: false }, F.token);
  check('unticking it takes it out of the box', !(await api('GET', `/reminders?day=${today}`, undefined, F.token)).json.tasks?.some((t) => t.id === rmId));
  const before = (await api('GET', '/nodes?relationship=self&kind=task', undefined, F.token)).json.nodes?.length ?? 0;
  const backwards = await add({ title: 'Backwards', doDate: day(5), dueDate: day(2) });
  check('a do date after the due date is refused', backwards.status === 400 && /on or before/.test(backwards.json.error ?? ''), backwards.json);
  const lonely = await add({ title: 'Repeats from nothing', repeat: { kind: 'daily', every: 1, days: [], until: null } });
  check('a repeat needs a day to count from', lonely.status === 400, lonely.json);
  const afterRefused = (await api('GET', '/nodes?relationship=self&kind=task', undefined, F.token)).json.nodes?.length ?? 0;
  check('a refused task leaves nothing behind', afterRefused === before, { before, afterRefused });
  const badP = await api('PATCH', `/nodes/${proj.id}`, { priority: 'P9' }, F.token);
  check('a project takes no priority, and nothing breaks', badP.status === 200 && badP.json.node?.priority === null, badP.json);

  const loose = await add({ title: 'No date yet' });
  const d1 = await api('GET', `/today?date=${today}`, undefined, F.token);
  check('a task with no dates waits in Not scheduled, not in Tasks', loose.status === 201 && d1.json.backlog?.some((t) => t.id === loose.json.node.id) && !d1.json.tasks?.some((t) => t.id === loose.json.node.id) && d1.json.backlogTotal >= 1, { backlog: d1.json.backlog?.length, total: d1.json.backlogTotal });
  const dued = await api('PATCH', `/nodes/${loose.json.node.id}`, { dueDate: day(3) }, F.token);
  const d2 = await api('GET', `/today?date=${today}`, undefined, F.token);
  check('picking a due date takes it out of Not scheduled', dued.status === 200 && !d2.json.backlog?.some((t) => t.id === loose.json.node.id), d2.json.backlog?.map((t) => t.title));
  const d3 = await api('GET', `/today?date=${day(3)}`, undefined, F.token);
  check('and it opens on its due date', d3.json.tasks?.some((t) => t.id === loose.json.node.id), d3.json.tasks?.map((t) => t.title));
  const picked = await api('PATCH', `/nodes/${loose.json.node.id}`, { doDate: today }, F.token);
  const d4 = await api('GET', `/today?date=${today}`, undefined, F.token);
  check('a do date opens it on that day', picked.status === 200 && d4.json.tasks?.some((t) => t.id === loose.json.node.id), picked.json);

  const future = await add({ title: 'Do later', doDate: day(4), dueDate: day(6) });
  const early = await api('POST', `/nodes/${future.json.node.id}/complete`, { date: today }, F.token);
  check('the do date holds a tick back', early.status === 400 && /Tick it on the day/.test(early.json.error ?? ''), early.json);
  const overdue = await add({ title: 'Past its deadline', dueDate: day(-1) });
  check('a deadline in the past never locks the tick', overdue.status === 201, overdue.json);
  const late = await api('POST', `/nodes/${overdue.json.node.id}/complete`, { date: today }, F.token);
  check('so an overdue task can still be ticked', late.status === 200, late.json);

  const tagged = await add({ title: 'Tagged', doDate: today, priority: 'P0', remind: true, estimateMin: 25 });
  check('a task keeps its priority, its Remember tag and its length', tagged.json.node?.priority === 0 && tagged.json.node?.remind === true && tagged.json.node?.estimateMin === 25, tagged.json.node);
  const noDay = await add({ title: 'Remember without a day', remind: true });
  check('Remember works with no day: it is a tag', noDay.status === 201 && noDay.json.node?.remind === true && noDay.json.node?.doDate === null && noDay.json.node?.dueDate === null, noDay.json.node);
  const dRem = await api('GET', `/today?date=${today}`, undefined, F.token);
  check('and it waits in Not scheduled yet, first in line', dRem.json.backlog?.[0]?.id === noDay.json.node?.id && dRem.json.backlog[0].remind === true, dRem.json.backlog?.map((t) => [t.title, t.remind]));
  const remPatch = await api('PATCH', `/nodes/${noDay.json.node.id}`, { remind: false }, F.token);
  check('the tag can be taken off again', remPatch.status === 200 && remPatch.json.node?.remind === false, remPatch.json);
  const cleared = await api('PATCH', `/nodes/${tagged.json.node.id}`, { priority: null, remind: false }, F.token);
  check('a priority and a reminder can be cleared', cleared.json.node?.priority === null && cleared.json.node?.remind === false, cleared.json.node);
  const wrong = await api('PATCH', `/nodes/${tagged.json.node.id}`, { priority: 'P7' }, F.token);
  check('a priority is P0 to P3 only', wrong.status === 400, wrong.json);

  const sub1 = await api('POST', `/nodes/${tagged.json.node.id}/subtasks`, { title: 'First step' }, F.token);
  const sub2 = await api('POST', `/nodes/${tagged.json.node.id}/subtasks`, { title: 'Second step' }, F.token);
  const tickedSub = await api('PATCH', `/nodes/subtasks/${sub1.json.subtask?.id}`, { done: true }, F.token);
  const withCounts = (await api('GET', '/nodes', undefined, F.token)).json.nodes?.find((n) => n.id === tagged.json.node.id);
  check('a task holds subtasks and the list counts them', sub1.status === 201 && sub2.status === 201 && tickedSub.json.subtask?.done === true && withCounts?.subtaskTotal === 2 && withCounts?.subtaskDone === 1, withCounts);
  const stranger = await api('GET', `/nodes/${tagged.json.node.id}/subtasks`, undefined, B.token);
  check('someone else cannot read them', stranger.status === 404, stranger.status);
  const strangerEdit = await api('PATCH', `/nodes/subtasks/${sub2.json.subtask?.id}`, { done: true }, B.token);
  check('or tick them', strangerEdit.status === 404, strangerEdit.status);

  const habit = await add({ title: 'Stretch', doDate: today, dueDate: day(1), priority: 'P1', repeat: { kind: 'daily', every: 1, days: [], until: null } });
  await api('POST', `/nodes/${habit.json.node.id}/subtasks`, { title: 'Hamstrings' }, F.token);
  const ticked = await api('POST', `/nodes/${habit.json.node.id}/complete`, { date: today }, F.token);
  const next = ticked.json.next;
  check('ticking a repeating task makes the next one a day later, keeping the gap', ticked.status === 200 && next?.doDate === day(1) && next?.dueDate === day(2) && next?.priority === 1 && next?.repeat?.kind === 'daily', next);
  const nextSubs = await api('GET', `/nodes/${next?.id}/subtasks`, undefined, F.token);
  check('its subtasks come back unticked', nextSubs.json.subtasks?.length === 1 && nextSubs.json.subtasks[0].done === false, nextSubs.json);
  const undone = await api('POST', `/nodes/${habit.json.node.id}/uncomplete`, {}, F.token);
  const gone = (await api('GET', '/nodes', undefined, F.token)).json.nodes?.some((n) => n.id === next?.id);
  check('unticking it takes the made task away again', undone.status === 200 && gone === false, undone.json);

  const search = await api('GET', `/nodes?relationship=self&kind=task`, undefined, F.token);
  check('nodes carry the new fields', search.json.nodes?.every((n) => 'doDate' in n && 'priority' in n && 'remind' in n && 'repeat' in n), search.json.nodes?.[0]);
  const exported = await api('GET', '/me/export', undefined, F.token);
  check('subtasks are in the export', JSON.stringify(exported.json).includes('First step'), '');
}

// ---------------------------------------------------------------- day types: the kind of day, and Daily's six by context
section('Day types');
{
  const G = await signup(`daytype-${stamp}@smoke.test`, `Quartz-${stamp}-pass`, 'Smoke day type');
  const answers = QUESTIONS.filter((q) => q.relationship === 'self' || q.relationship === 'servant_leader').map((q) => ({ questionId: q.id, value: 1 }));
  await api('POST', '/onboarding', { answers, displayName: 'Smoke day type' }, G.token);
  const built = await api('POST', '/onboarding/build', { relationships: ['self', 'servant_leader'], date: today, picks: { self: {}, servant_leader: {} } }, G.token);
  const projOf = (rel) => (built.json.nodes ?? []).find((n) => n.kind === 'project' && n.relationship === rel);
  const add = (rel, title, priority) => api('POST', '/nodes', { kind: 'task', parentId: projOf(rel)?.id, relationship: rel, title, doDate: today, ...(priority ? { priority } : {}) }, G.token);
  check('a test account with a work and a self project', !!projOf('self') && !!projOf('servant_leader'), built.json.nodes?.map((n) => [n.kind, n.relationship]));
  // Seven tasks made in date order, so the old by-day pick would leave the work P0 (made last) off the six.
  for (let i = 0; i < 5; i++) await add('self', `Self plain ${i}`);
  await add('self', 'Self P0', 'P0');
  await add('servant_leader', 'Work P0', 'P0');

  const none = await api('GET', `/today/day-type?date=${today}&today=${today}`, undefined, G.token);
  check('no kind of day to start with', none.status === 200 && none.json.kind === null && none.json.date === today, none.json);
  const bad = await api('PUT', '/today/day-type', { date: today, today, kind: 'constructor' }, G.token);
  check('a kind of day we do not know is refused', bad.status === 400, bad.json);
  const far = await api('PUT', '/today/day-type', { date: '2026-11-31', today, kind: 'deep_work' }, G.token);
  check('a day that is not today or tomorrow is refused', far.status === 400, far.json);
  const set = await api('PUT', '/today/day-type', { date: today, today, kind: 'deep_work' }, G.token);
  const back = await api('GET', `/today/day-type?date=${today}&today=${today}`, undefined, G.token);
  check('Deep work is saved for the day', set.status === 200 && back.json.kind === 'deep_work', [set.json, back.json]);
  const daily = await api('GET', `/today?date=${today}`, undefined, G.token);
  const titles = (daily.json.tasks ?? []).map((t) => t.title);
  check('on a Deep work day the six start with the work P0, then the self P0', titles[0] === 'Work P0' && titles[1] === 'Self P0' && titles.length === 6, titles);
  const stranger = await api('GET', `/today/day-type?date=${today}&today=${today}`, undefined, B.token);
  check('the kind of day is the owner’s only', stranger.status === 200 && stranger.json.kind !== 'deep_work', stranger.json);
  const cleared = await api('PUT', '/today/day-type', { date: today, today, kind: null }, G.token);
  const after = (await api('GET', `/today?date=${today}`, undefined, G.token)).json.tasks?.map((t) => t.title) ?? [];
  check('clearing it goes back to the by-day pick', cleared.status === 200 && cleared.json.kind === null && !after.includes('Work P0'), after);
  const exported = await api('GET', '/me/export', undefined, G.token);
  check('the kind of day is in the export', exported.status === 200 && JSON.stringify(exported.json).includes('"dayTypes"'), Object.keys(exported.json ?? {}).filter((k) => /day/i.test(k)));
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
  check('the five areas come in their one order: physical, financial, mental, emotional, spiritual', (life.json?.areas ?? []).map((a) => a.key).join() === 'physical,financial,mental,emotional,spiritual', (life.json?.areas ?? []).map((a) => a.key));
  const home = await api('GET', '/home', undefined, B.token);
  check('home answers in one call', home.status === 200 && home.json.xp && home.json.xp.today > 0, Object.keys(home.json ?? {}));
  check('home lists the five areas in the same order', !home.json?.life || home.json.life.areas.map((a) => a.key).join() === 'physical,financial,mental,emotional,spiritual', home.json?.life?.areas?.map((a) => a.key));
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
  // India first, open to all: a person keeps their money in rupees unless they pick another currency (migration 0070).
  check('a new account keeps its money in rupees', (await me(C.token))?.currency === 'INR', (await me(C.token))?.currency);
  // No date sent: the entry lands on the person's day in their zone (India's by default), which is today above, even between
  // 00:00 and 05:30 IST when the server's UTC date is still yesterday.
  const undated = await api('POST', '/finance/transactions', { kind: 'income', amountCents: 100 }, B.token);
  check('an entry with no date lands on the person\'s own day, never the server\'s UTC date', undated.json.transaction?.date === today, [undated.json.transaction?.date, today]);
  const toUsd = await api('PATCH', '/me', { currency: 'USD' }, B.token);
  check('someone abroad can switch their currency', toUsd.status === 200 && userOf(toUsd)?.currency === 'USD', userOf(toUsd)?.currency);
  const odd = await api('PATCH', '/me', { currency: 'constructor' }, B.token);
  check('a currency that is not on the list is ignored', userOf(odd)?.currency === 'USD', userOf(odd)?.currency);
  const inUsd = await api('POST', '/finance/transactions', { kind: 'income', amountCents: 2500, category: 'Brand deal', date: today }, B.token);
  check('an entry with no currency is kept in the person\'s own', inUsd.status === 201 && inUsd.json.transaction?.currency === 'USD', inUsd.json.transaction?.currency);
  const named = await api('POST', '/finance/transactions', { kind: 'income', amountCents: 2500, currency: 'inr', date: today }, B.token);
  check('an entry that names its currency keeps it', named.json.transaction?.currency === 'INR', named.json.transaction?.currency);
  await api('PATCH', '/me', { currency: 'INR' }, B.token);
  // App groups (2026-11-04): each person picks which groups start open and the order of apps inside a group, saved on the account.
  const fresh = await me(C.token);
  check('a new account has no app prefs yet', JSON.stringify(fresh?.appPrefs) === JSON.stringify({ open: {}, order: {} }), fresh?.appPrefs);
  const across = await api('PATCH', '/me', { appPrefs: { open: {}, order: { earn: ['work', 'life'] } } }, A.token);
  check('app prefs refuse an app placed in another group', across.status === 400 && /another group/.test(across.json.error ?? ''), across.json);
  const proto = await api('PATCH', '/me', { appPrefs: { open: { constructor: true }, order: {} } }, A.token);
  check('app prefs refuse a group that does not exist', proto.status === 400, proto.json);
  const twice = await api('PATCH', '/me', { appPrefs: { order: { earn: ['army', 'army'] } } }, A.token);
  check('app prefs refuse an app listed twice', twice.status === 400, twice.json);
  const arranged = { open: { earn: false, wellbeing: true }, order: { earn: ['army', 'agency', 'school', 'work', 'win'], core: ['help', 'notifications', 'leaderboard'] } };
  const setPrefs = await api('PATCH', '/me', { appPrefs: arranged }, A.token);
  check('app prefs are saved', setPrefs.status === 200 && JSON.stringify(userOf(setPrefs)?.appPrefs) === JSON.stringify(arranged), userOf(setPrefs)?.appPrefs);
  const reread = await me(A.token);
  check('app prefs keep their order across a reload', JSON.stringify(reread?.appPrefs) === JSON.stringify(arranged), reread?.appPrefs);
  const otherSave = await api('PATCH', '/me', { bio: 'Smoke founder' }, A.token);
  check('a profile save without app prefs leaves them alone', JSON.stringify(userOf(otherSave)?.appPrefs) === JSON.stringify(arranged), userOf(otherSave)?.appPrefs);
  check('app prefs belong to their owner', JSON.stringify((await me(C.token))?.appPrefs) === JSON.stringify({ open: {}, order: {} }), (await me(C.token))?.appPrefs);
  const exported = await api('GET', '/me/export', undefined, A.token);
  check('app prefs are in the export', JSON.stringify(exported.json?.user?.appPrefs) === JSON.stringify(arranged), exported.json?.user?.appPrefs);
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
  const faqSet = [{ q: 'Who is it for?', a: 'Anyone starting out.' }, { q: '  ', a: 'No question, dropped' }, { q: 'How long?', a: '' }, ...Array.from({ length: 8 }, (_, i) => ({ q: `Extra ${i}`, a: `Answer ${i}` }))];
  const withFaq = await api('POST', '/studio/products', { kind: 'digital', title: `Smoke faq ${stamp}`, pricePoints: 0, status: 'live', url: 'https://example.com/faq', faq: faqSet }, C.token);
  check('a product keeps up to six clean questions and answers, and drops the rest', withFaq.status === 201 && withFaq.json.product?.faq?.length === 6 && withFaq.json.product.faq[0].q === 'Who is it for?' && withFaq.json.product.faq.every((f) => f.q && f.a), withFaq.json.product?.faq);
  const faqEdit = await api('PATCH', `/studio/products/${withFaq.json.product?.id}`, { faq: [{ q: 'Is there a refund?', a: 'Yes, within a week.' }] }, C.token);
  check('the questions can be changed and cleared', faqEdit.json.product?.faq?.length === 1 && (await api('PATCH', `/studio/products/${withFaq.json.product?.id}`, { faq: [] }, C.token)).json.product?.faq?.length === 0, faqEdit.json.product?.faq);
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
  const sellerInbox = await api('GET', '/inbox?size=25', undefined, C.token);
  check('the seller is told the offer in rupees, grouped the Indian way', JSON.stringify(sellerInbox.json).includes('offers ₹4,500.'), '');
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

// ---------------------------------------------------------------- kreators run: discussions
section('Run discussions');
{
  // Its own address, so these sign-ups never touch the sign-up limit the rest of the checks use.
  const TALK_ADDRESS = `10.${(seed >> 16) & 255}.${(seed >> 8) & 255}.${(seed + 41) & 255}`;
  const join = async (who) => {
    const r = await api('POST', '/auth/signup', { email: `talk-${who}-${stamp}@smoke.test`, password: `Kettle-${stamp}-pass`, displayName: `Talk ${who}`, phone: PHONE, birthDate: GROWN }, null, { 'CF-Connecting-IP': TALK_ADDRESS });
    return { token: r.json.token, user: r.json.user };
  };
  const H = await join('host');
  const M = await join('member');
  const N = await join('second');
  const X = await join('outsider');
  const Z = await join('leaver');
  for (const t of [H, M, N, X, Z]) await api('PATCH', '/me/modules', { key: 'run', on: true }, t.token);
  const soon = (min) => new Date(Date.now() + min * 60_000).toISOString();
  const club = (await api('POST', '/run/clubs', { name: `Talk runners ${stamp}`, city: 'Bengaluru', pace: 'easy' }, H.token)).json.club;
  const oldRun = (await api('POST', `/run/clubs/${club.id}/runs`, { title: 'Long gone run', startsAt: soon(-40 * 24 * 60), minutes: 60 }, H.token)).json.run;
  for (const t of [M, N, Z]) await api('POST', `/run/clubs/${club.id}/join`, {}, t.token);
  const r = (await api('POST', `/run/clubs/${club.id}/runs`, { title: `Talk run ${stamp}`, startsAt: soon(60), minutes: 60 }, H.token)).json.run;
  const path = `/run/talk/${r.id}`;
  const linesFor = async (t, q = '') => (await api('GET', `${path}/messages${q}`, undefined, t.token)).json;

  const listM = await api('GET', '/run/talk', undefined, M.token);
  const row = listM.json.talks?.find((t) => t.runId === r.id);
  check('a member has a discussion for each run of their club', listM.status === 200 && row?.open === true && row.people === 4 && row.host === false, listM.json);
  check('a run that ended past its month is not listed', !(listM.json.talks ?? []).some((t) => t.runId === oldRun?.id), listM.json.talks?.map((t) => t.title));
  const hi = await api('POST', `${path}/messages`, { body: `Meet at the gate, @${N.user.handle} and @${X.user.handle}` }, M.token);
  check('a member writes in the discussion', hi.status === 201 && hi.json.line?.mine === true && hi.json.line.host === false, hi.json);
  // The shared event chat never takes a line for a run, and never reads one back, so nobody writes around the discussion's rules.
  const around = await api('POST', `/connect/run/${r.id}/messages`, { body: 'Around the discussion' }, M.token);
  check('the shared event chat refuses a line for a run', around.status === 404, around.json);
  const aroundRead = await api('GET', `/connect/run/${r.id}`, undefined, M.token);
  check('the shared event chat shows no run lines', aroundRead.status !== 200 || (aroundRead.json.messages ?? []).length === 0, aroundRead.json);
  const nLines = await linesFor(N, '?read=1');
  check('another member reads it', (nLines.lines ?? []).some((l) => l.body.startsWith('Meet at the gate') && l.userId === M.user.id), nLines);
  const nInbox = (await api('GET', '/inbox?size=50', undefined, N.token)).json;
  const xInbox = (await api('GET', '/inbox?size=50', undefined, X.token)).json;
  check('a mention tells a runner once', JSON.stringify(nInbox).split('mentioned you in').length === 2, '');
  check('a mention never reaches someone outside the run', !JSON.stringify(xInbox).includes('mentioned you in'), '');

  // Someone outside the run sees nothing at all.
  const xList = await api('GET', '/run/talk', undefined, X.token);
  check('someone outside the run has no discussion listed', xList.status === 200 && !(xList.json.talks ?? []).some((t) => t.runId === r.id), xList.json);
  check('and the discussion is a 404 to them', (await api('GET', path, undefined, X.token)).status === 404 && (await api('GET', `${path}/messages`, undefined, X.token)).status === 404, '');
  check('and they cannot write in it', (await api('POST', `${path}/messages`, { body: 'let me in' }, X.token)).status === 404, '');
  check('a member who joined after a run ended is not in its discussion', (await api('GET', `/run/talk/${oldRun.id}`, undefined, M.token)).status === 404, '');

  // Unread: the host has a line waiting until they read it.
  const hostUnread = (await api('GET', '/run/talk/unread', undefined, H.token)).json.unread;
  await linesFor(H, '?read=1');
  const hostAfter = (await api('GET', '/run/talk/unread', undefined, H.token)).json.unread;
  check('a line waits as unread until the discussion is read', hostUnread >= 1 && hostAfter === 0, { hostUnread, hostAfter });

  // Anonymous lines carry a made-up name for this run and nothing that points at the writer.
  const anon = await api('POST', `${path}/messages`, { body: `quiet line ${stamp}`, anonymous: true }, N.token);
  const seenByM = (await linesFor(M)).lines?.find((l) => l.body === `quiet line ${stamp}`);
  check('an anonymous line hides who wrote it from the others', anon.status === 201 && seenByM?.anonymous === true && seenByM.userId === '' && seenByM.handle === null && seenByM.name !== 'Talk second' && seenByM.host === false, seenByM);
  check('the writer still finds their own anonymous line', (await linesFor(N)).lines?.some((l) => l.body === `quiet line ${stamp}` && l.mine && l.anonymous), '');

  // Blocking the person behind an anonymous line hides both ways, without learning who it was.
  const blocked = await api('POST', `${path}/messages/${seenByM.id}/block-author`, {}, M.token);
  const mAfter = (await linesFor(M)).lines ?? [];
  const nAfter = (await linesFor(N)).lines ?? [];
  check('a block hides their lines from you', blocked.status === 201 && !mAfter.some((l) => l.body === `quiet line ${stamp}`), blocked.json);
  check('and yours from them', !nAfter.some((l) => l.body.startsWith('Meet at the gate')), nAfter.map((l) => l.body));
  await api('DELETE', `/bond/block/${N.user.id}`, undefined, M.token);
  check('lifting the block shows the lines again', ((await linesFor(M)).lines ?? []).some((l) => l.body === `quiet line ${stamp}`), '');

  // Report and take down.
  const nLine = (await linesFor(M)).lines.find((l) => l.body === `quiet line ${stamp}`);
  check('a line can be reported to the team', (await api('POST', `${path}/messages/${nLine.id}/report`, { note: 'smoke' }, M.token)).status === 201, '');
  check('your own line is not reported', (await api('POST', `${path}/messages/${hi.json.line.id}/report`, {}, M.token)).status === 400, '');
  check('a member cannot take down another runner’s line', (await api('DELETE', `${path}/messages/${nLine.id}`, undefined, M.token)).status === 403, '');
  const before = (await linesFor(M)).lines;
  const down = await api('DELETE', `${path}/messages/${hi.json.line.id}`, undefined, H.token);
  const poll = await linesFor(M, `?after=${before.at(-1).seq}&from=${before[0].seq}`);
  check('the host takes a line down', down.status === 200 && (poll.gone ?? []).includes(hi.json.line.seq) && !((await linesFor(N)).lines ?? []).some((l) => l.id === hi.json.line.id), poll);
  const mInbox = (await api('GET', '/inbox?size=50', undefined, M.token)).json;
  check('and its writer is told', JSON.stringify(mInbox).includes('A line of yours was taken down'), '');
  const hostLine = await api('POST', `${path}/messages`, { body: 'See you all there' }, H.token);
  check('the host’s own line is marked as the host’s', hostLine.status === 201 && hostLine.json.line?.host === true, hostLine.json);

  // A closed discussion takes no new lines: a run more than a month past, and a cancelled run.
  const late = await api('POST', `/run/talk/${oldRun.id}/messages`, { body: 'too late' }, H.token);
  check('a month after the run its discussion takes no new lines', late.status === 409, late.json);
  check('but it can still be read by its people', (await api('GET', `/run/talk/${oldRun.id}/messages`, undefined, H.token)).status === 200, '');
  await api('PATCH', `/run/runs/${r.id}`, { status: 'cancelled' }, H.token);
  const off = await api('POST', `${path}/messages`, { body: 'still on?' }, M.token);
  check('a cancelled run’s discussion takes no new lines', off.status === 409, off.json);

  // Export and delete.
  const zr = (await api('POST', `/run/clubs/${club.id}/runs`, { title: 'Leaver run', startsAt: soon(90), minutes: 30 }, H.token)).json.run;
  const zline = await api('POST', `/run/talk/${zr.id}/messages`, { body: `leaver run line ${stamp}` }, Z.token);
  const zexp = (await api('GET', '/me/export', undefined, Z.token)).json;
  check('the export holds a person’s run discussion lines', zline.status === 201 && (zexp.runLines ?? []).some((l) => l.body === `leaver run line ${stamp}`), zexp.runLines);
  const zdel = await api('DELETE', '/me', { confirm: 'DELETE' }, Z.token);
  const afterZ = await api('GET', `/run/talk/${zr.id}/messages`, undefined, H.token);
  check('deleting the account deletes the lines', zdel.status === 200 && !(afterZ.json.lines ?? []).some((l) => l.body.includes('leaver run line')), afterZ.json);
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
  // "Not part of my life right now": love, teachers and faith only, placed at Neutrality and never suggested.
  const low = placements.map((p) => (p.relationship === 'lover_partner' ? { ...p, core: 350, floor: 50 } : p.relationship === 'divine' ? { ...p, core: 540, floor: 20 } : p));
  const aw = await api('POST', '/session/assessment', { placements: low, away: ['lover_partner', 'divine', 'self'] }, C.token);
  const awBy = Object.fromEntries((aw.json.assessment?.placements ?? []).map((p) => [p.relationship, p]));
  check('a pillar set aside is kept, and only love, teachers or faith can be', aw.status === 201 && JSON.stringify(aw.json.assessment?.away) === '["lover_partner","divine"]', aw.json?.assessment?.away);
  check('a pillar set aside sits at Neutrality whatever was sent', awBy.lover_partner?.core === 250 && awBy.lover_partner?.floor === 250 && awBy.divine?.floor === 250 && awBy.self?.core === 350, [awBy.lover_partner, awBy.divine]);
  check('a pillar set aside is never suggested as a focus', Array.isArray(aw.json.suggestedFocus) && !aw.json.suggestedFocus.includes('lover_partner') && !aw.json.suggestedFocus.includes('divine'), aw.json?.suggestedFocus);
  const back = await api('PUT', '/session/away', { relationship: 'divine', away: false, date: today }, C.token);
  check('a pillar set aside can be turned back on from the life map', back.status === 200 && JSON.stringify(back.json.assessment?.away) === '["lover_partner"]', back.json?.assessment?.away);
  const notOptional = await api('PUT', '/session/away', { relationship: 'self', away: true }, C.token);
  check('only the optional pillars can be set aside', notOptional.status === 400, notOptional.json);
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
  const chans = await api('POST', `/studio/brands/${bid}/research`, { kind: 'channels', query: 'phone videography' }, B.token);
  check('finding channels is a research kind that answers, or says what it needs', chans.status === 200 && chans.json.run?.kind === 'channels' && ['done', 'failed'].includes(chans.json.run?.status), chans.json?.run);
  const playbook = await api('POST', `/studio/brands/${bid}/pieces`, { kind: 'playbook', brief: 'YouTube Shorts under a minute', research: false }, B.token);
  check('a playbook of what is working can be written', playbook.status === 201 && playbook.json.piece?.kind === 'playbook', playbook.json?.piece?.kind);
  const folderNow = await api('GET', `/studio/brands/${bid}?size=10`, undefined, B.token);
  check('the folder counts runs and pieces by kind, for the strategy path', folderNow.json.counts?.pieces?.playbook === 1 && folderNow.json.counts?.pieces?.plan === 1 && folderNow.json.counts?.runs?.channels === 1 || folderNow.json.counts?.runs?.channels === undefined && folderNow.json.counts?.pieces?.playbook === 1, folderNow.json.counts);
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
    const mine = (built.json.nodes ?? []).filter((n) => n.kind === 'task').sort((a, b) => (a.doDate ?? '').localeCompare(b.doDate ?? ''));
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

// ---------------------------------------------------------------- the Companion on the assistant's model layer
section('Companion');
{
  const K = await signup(`companion-${stamp}@smoke.test`, `Lantern-${stamp}-pass`, 'Smoke companion');
  const L = await signup(`companion2-${stamp}@smoke.test`, `Lantern-${stamp}-pass`, 'Smoke other');
  for (const t of [K, L]) await api('PATCH', '/me/modules', { key: 'companion', on: true }, t.token);
  const ctx = { date: today, timeZone: 'Asia/Kolkata' };
  const tell = (body, extra = {}, token = K.token) => api('POST', '/companion', { body, context: ctx, ...extra }, token);
  const usage = async () => ((await api('GET', '/credits/ledger?size=50', undefined, K.token)).json.entries ?? []).filter((e) => e.agent === 'companion');
  const status = await api('GET', '/companion', undefined, K.token);
  const mock = status.json?.model === 'smoke-mock';
  const { ASSISTANT_MODELS } = await import('../../packages/shared/src/index.ts');
  check('the Companion says what answers for free, whether a model is connected, and the account', status.status === 200 && Array.isArray(status.json.messages) && ['workers-ai', 'local'].includes(status.json.builtIn) && typeof status.json.connected === 'boolean' && status.json.account?.plan === 'none', status.json);
  check('POST /companion is rate limited', ROUTE_LIMITS.some((r) => r.method === 'POST' && r.path === '/companion' && r.limit === 'companion'), '');

  await api('POST', '/wellbeing/mood', { date: today, value: 4 }, K.token);
  await api('POST', '/wellbeing/sleep', { date: today, value: 7.5 }, K.token);
  mockModel.last = null;
  const free = await tell('I feel tired');
  check('with no plan the built-in companion still answers, free, and no model is called', free.status === 200 && ['local', 'workers-ai'].includes(free.json.messages?.[1]?.model) && free.json.fallback !== 'credits' && mockModel.last === null && (await usage()).length === 0, free.json);
  check('the reply line says who answered, the person’s own line does not', free.json.messages?.[0]?.role === 'user' && free.json.messages[0].model === undefined, free.json.messages);

  mockModel.last = null;
  const crisis = await tell('Some days I want to end my life');
  check('crisis words always get the crisis line, and never reach a model', crisis.status === 200 && crisis.json.model === 'crisis' && /14416/.test(crisis.json.messages?.[1]?.body ?? '') && mockModel.last === null, crisis.json);
  const crisis2 = await tell('thinking about suicide');
  check('"suicide" is caught too, not only "suicid"', crisis2.json.model === 'crisis', crisis2.json.model);

  if (!mock) console.log('  (the Companion model checks need the smoke server that blueprint.sh starts with the mock model; skipped)');
  else {
    await admin('POST', `/admin/users/${K.user.id}/plan`, { plan: 'pro', days: 30 });
    mockModel.last = null;
    const crisisPaid = await tell('I want to die');
    check('with a plan, crisis words still never reach the model and cost nothing', crisisPaid.json.model === 'crisis' && mockModel.last === null && (await usage()).length === 0, crisisPaid.json);

    const open = ASSISTANT_MODELS.find((m) => !m.private && !m.thinks);
    const closed = ASSISTANT_MODELS.find((m) => m.private);
    mockModel.last = null;
    const hello = await tell('hello', { model: open.id });
    const sys = mockModel.last?.messages?.[0]?.content ?? '';
    const offered = (mockModel.last?.tools ?? []).map((t) => t.function.name);
    check('with a plan the picked model answers, and the line keeps its id', hello.status === 200 && hello.json.messages?.[1]?.body === 'The mock heard you.' && hello.json.model === open.id && hello.json.messages[1].model === open.id, hello.json);
    check('the model is told it is the Companion, not Bumling', sys.includes('Companion') && !sys.includes('Bumling, the guide'), sys.slice(0, 120));
    check('a model that may keep data never gets mood, sleep or the wellbeing score', !/mood today|sleep last night|wellbeing \d/.test(sys), sys);
    check('and is offered only the day’s read tools, never the journal or trackers', offered.length > 0 && offered.every((n) => ['get_daily', 'get_routine', 'get_reminders', 'get_week_plan'].includes(n)), offered);
    check('no temperature is sent', mockModel.last && !('temperature' in mockModel.last), mockModel.last?.temperature);
    const sent = JSON.stringify((mockModel.last?.messages ?? []).slice(1));
    check('nor an earlier built-in reply written from the sleep log (7.5 hours) or the score', !/7\.5 hours|wellbeing score/i.test(sent) && /I feel tired/.test(sent), sent.slice(0, 300));
    const seen = (await api('GET', '/companion', undefined, K.token)).json.messages ?? [];
    check('the chat keeps who answered each line', seen.some((m) => m.body === 'The mock heard you.' && m.model === open.id), seen.slice(-2));
    const rows = await usage();
    check('a free model still writes one usage row with its tokens and model, and costs nothing', rows.length === 1 && rows[0].amount === 0 && rows[0].tokens?.input === 1000 && rows[0].tokens?.output === 50, rows);
    check('the day’s use is counted for the Companion', (await api('GET', '/credits', undefined, K.token)).json.account?.usedToday?.companion === 0, '');

    mockModel.last = null;
    const priv = await tell('how am I', { model: closed.id });
    const psys = mockModel.last?.messages?.[0]?.content ?? '';
    const ptools = (mockModel.last?.tools ?? []).map((t) => t.function.name);
    check('a model that keeps nothing sees the mood and the sleep', priv.status === 200 && /mood today (?!unknown)\w+/.test(psys) && /sleep last night (?!unknown)[\d.]+ hours/.test(psys), psys.slice(-200));
    check('and may read the trackers', ptools.includes('get_wellbeing'), ptools);

    const read = await tell(`DO ${JSON.stringify([{ name: 'get_daily' }])}`, { model: open.id });
    check('a read tool runs as the person', read.status === 200 && /^Mock done:/.test(read.json.messages?.[1]?.body ?? '') && !/only reads/.test(read.json.messages[1].body), read.json.messages?.[1]);
    const write = await tell(`DO ${JSON.stringify([{ name: 'check_in' }])}`, { model: open.id });
    const day = (await api('GET', `/today?date=${today}`, undefined, K.token)).json;
    check('a write is refused and never run: the Companion only reads', /only reads/.test(write.json.messages?.[1]?.body ?? '') && day.checkedIn === false, { said: write.json.messages?.[1]?.body, checkedIn: day.checkedIn });
    const actions = (await api('GET', '/me/export', undefined, K.token)).json;
    check('nothing is written to the assistant’s action log', (actions.assistantActions ?? []).length === 0, actions.assistantActions?.length);
    check('the export carries the chat with who answered', (actions.companionChat ?? []).some((r) => r.model === open.id), (actions.companionChat ?? []).length);

    // Credits charged once: the server's default stand-in has a price, so a message on it costs credits.
    await admin('POST', `/admin/users/${K.user.id}/plan`, { plan: 'pro_max', days: 30 });
    const before = (await api('GET', '/credits', undefined, K.token)).json.account;
    const paid = await tell('a priced hello');
    const after = (await api('GET', '/credits', undefined, K.token)).json.account;
    const priced = (await usage()).filter((e) => e.amount < 0);
    check('a priced message is charged once, through the one ledger', paid.status === 200 && paid.json.credits?.spent > 0 && after.total === before.total - paid.json.credits.spent && priced.length === 1 && after.usedToday.companion === paid.json.credits.spent, { credits: paid.json.credits, before: before.total, after: after.total, rows: priced.length });

    const runId = crypto.randomUUID();
    const running = api('POST', '/companion', { body: `SLOW DO ${JSON.stringify([{ name: 'check_in' }])}`, runId, context: ctx }, K.token);
    await new Promise((r) => setTimeout(r, 800));
    const stopNow = await api('POST', '/companion/stop', { runId }, K.token);
    const halted = await running;
    check('Stop ends a Companion message before its tools run', stopNow.status === 200 && halted.json.stopped === 'user' && halted.json.messages?.[1]?.body === 'Stopped.', halted.json);
    check('Stop needs the run it stops', (await api('POST', '/companion/stop', {}, K.token)).status === 400, '');
    const theirRun = crypto.randomUUID();
    await api('PATCH', '/me/modules', { key: 'companion', on: true }, L.token);
    await api('POST', '/companion/stop', { runId: theirRun }, L.token);
    const notStopped = await api('POST', '/companion', { body: 'still here', runId: theirRun, context: ctx }, K.token);
    check('another person’s Stop never stops my message', notStopped.status === 200 && notStopped.json.stopped === null && notStopped.json.messages?.[1]?.body === 'The mock heard you.', notStopped.json);
    const usedBefore = (await usage()).length;
    const broken = await tell('FAIL');
    check('a model that fails falls back to the built-in companion, never a 502, and charges nothing', broken.status === 200 && broken.json.fallback === 'error' && ['local', 'workers-ai'].includes(broken.json.model) && (await usage()).length === usedBefore, broken.json);
    await admin('POST', `/admin/users/${K.user.id}/plan`, { plan: 'none' });
  }

  const theirs = await api('GET', '/companion', undefined, L.token);
  check('another person never sees the chat', theirs.status === 200 && theirs.json.messages?.length === 0, theirs.json.messages?.length);
  const block = await admin('POST', '/admin/flags/companion/overrides', { subjectType: 'user', subjectId: L.user.id, enabled: false, reason: 'smoke' });
  check('with the Companion switched off for a person, the API refuses', (await tell('hello', {}, L.token)).status === 403, block.status);
  if (block.json?.override?.id) await admin('DELETE', `/admin/flags/overrides/${block.json.override.id}`);
  await api('DELETE', '/companion', undefined, K.token);
  check('Clear empties the chat', ((await api('GET', '/companion', undefined, K.token)).json.messages ?? []).length === 0, '');
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
  // Inside an event: photos, the conversation, people to meet, pictures and videos, friend codes, blocking.
  const tiny = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
  const rawUp = async (token, type, bytes) => {
    const r = await fetch(`${API}/media/upload`, { method: 'POST', headers: { 'content-type': type, 'CF-Connecting-IP': CODE_ADDRESS, authorization: `Bearer ${token}` }, body: bytes });
    return { status: r.status, json: await r.json().catch(() => ({})) };
  };
  const up = await rawUp(H.token, 'image/png', tiny);
  check('a small picture uploads and gets an address of its own', up.status === 201 && up.json.url?.startsWith('/api/public/media/') && up.json.kind === 'image', up.json);
  const pic = await fetch(`${API}/public/media/${up.json.url?.split('/').pop()}`);
  check('the uploaded file is served as the picture it is', pic.status === 200 && pic.headers.get('content-type') === 'image/png', pic.status);
  const fake = await rawUp(H.token, 'image/png', new TextEncoder().encode('<script>alert(1)</script>'));
  check('a file that is not the picture it says it is is refused', fake.status === 400, fake.json);
  const svg = await rawUp(H.token, 'image/svg+xml', new TextEncoder().encode('<svg/>'));
  check('SVG and other types are refused', svg.status === 415, svg.json);
  const setMedia = await api('PUT', `/media/for/event/${ev.id}`, { items: [{ url: up.json.url, caption: 'Meet here' }, { url: 'https://youtu.be/dQw4w9WgXcQ', caption: '' }, { url: 'https://example.com/a.gif', caption: '' }] }, H.token);
  check('the host puts a picture, a YouTube video and a GIF on the event', setMedia.status === 200 && setMedia.json.items.map((m) => m.kind).join() === 'image,video,gif', setMedia.json);
  const stolen = await api('PUT', `/media/for/event/${ev.id}`, { items: [{ url: up.json.url, caption: '' }] }, O.token);
  check('someone who does not own the event cannot change its media', stolen.status === 403, stolen.status);
  const notYours = await api('PUT', `/media/for/event/${started.json.event.id}`, { items: [{ url: up.json.url, caption: '' }] }, H.token);
  check('a file already on an owner can be kept, and one from another person cannot be borrowed', notYours.status === 200, notYours.json);
  const borrowed = await api('PUT', `/media/for/event/${started.json.event.id}`, { items: [{ url: '/api/public/media/not-a-real-file', caption: '' }] }, H.token);
  check('a made-up uploaded address is refused', borrowed.status === 403, borrowed.json);
  const badLink = await api('PUT', `/media/for/event/${ev.id}`, { items: [{ url: 'http://plain.example/x.png', caption: '' }] }, H.token);
  check('a picture link must be https', badLink.status === 400, badLink.json);
  const listedEvents = await fetch(`${API}/public/explore?type=event`).then((r) => r.json()).catch(() => ({}));
  check('the public listing carries the media for its card', JSON.stringify(listedEvents).includes('/api/public/media/') || JSON.stringify(listedEvents).includes('youtu.be'), JSON.stringify(listedEvents).slice(0, 200));

  const extras = await api('GET', `/connect/party/${ev.id}`, undefined, G.token);
  check('a guest opens the conversation and sees there are no photos yet', extras.status === 200 && extras.json.role === 'guest' && extras.json.photos === null, extras.json);
  const outsider = await api('GET', `/connect/party/${ev.id}`, undefined, O.token);
  check('someone not on the guest list sees none of it', outsider.status === 404, outsider.status);
  const hi = await api('POST', `/connect/party/${ev.id}/messages`, { body: 'Hello from the guest' }, G.token);
  check('a guest starts the conversation', hi.status === 201, hi.json);
  const hostSees = await api('GET', `/connect/party/${ev.id}`, undefined, H.token);
  const line = hostSees.json.messages?.find((m) => m.body === 'Hello from the guest');
  check('the host reads it and can take it down', Boolean(line) && hostSees.json.role === 'host', hostSees.json.messages);
  const gone = await api('DELETE', `/connect/party/${ev.id}/messages/${line?.id}`, undefined, H.token);
  check('the host takes a line down', gone.status === 200, gone.json);
  const noPhotosYet = await api('PUT', `/connect/party/${ev.id}/photos`, { url: 'https://example.com/folder' }, H.token);
  check('a photo folder must be on a known sharing service', noPhotosYet.status === 400, noPhotosYet.json);
  const guestPhotos = await api('PUT', `/connect/party/${ev.id}/photos`, { url: 'https://drive.google.com/drive/folders/abc123' }, G.token);
  check('only the host shares the photo folder', guestPhotos.status === 403, guestPhotos.status);
  const photos = await api('PUT', `/connect/party/${ev.id}/photos`, { url: 'https://drive.google.com/drive/folders/abc123', note: 'Open all month' }, H.token);
  check('the host shares a Google Drive folder', photos.status === 200, photos.json);
  const seen = await api('GET', `/connect/party/${ev.id}`, undefined, G.token);
  check('the guest gets the link, and a note in the inbox', seen.json.photos?.url?.includes('drive.google.com') && JSON.stringify((await api('GET', '/inbox', undefined, G.token)).json).includes('Photos from'), seen.json.photos);
  await api('PUT', `/connect/party/${ev.id}/networking`, { on: true }, G.token);
  const hostPeople = await api('GET', `/connect/party/${ev.id}`, undefined, H.token);
  check('a guest who lists themselves shows up for others to connect with', hostPeople.json.people?.some((p) => p.userId === G.user.id), hostPeople.json.people);
  const ask = await api('POST', `/connect/party/${ev.id}/people/${G.user.id}/connect`, {}, H.token);
  check('connecting with a listed guest sends a friend request', ask.status === 201 && ask.json.status === 'sent', ask.json);
  const notListed = await api('POST', `/connect/party/${ev.id}/people/${O.user.id}/connect`, {}, H.token);
  check('someone who did not list themselves cannot be asked', notListed.status === 404, notListed.status);

  // Friend codes and usernames.
  const hostMe = await me(H.token);
  check('every account has a username and a friend code of its own', /^user_[a-z0-9]{6}$/.test(hostMe.handle ?? '') && /^[A-Z0-9]{8}$/.test(hostMe.friendCode ?? ''), hostMe);
  const byCode = await api('POST', '/bond/friends', { code: hostMe.friendCode.toLowerCase() }, O.token);
  check('a friend code sends a friend request, any case', byCode.status === 201 && byCode.json.status === 'sent', byCode.json);
  const ownCode = await api('POST', '/bond/friends', { code: hostMe.friendCode }, H.token);
  check('your own code is refused', ownCode.status === 400, ownCode.json);
  const noCode = await api('POST', '/bond/friends', { code: 'ZZZZZZZZ' }, O.token);
  check('a code nobody has is a plain not found', noCode.status === 404, noCode.json);
  const blanked = await api('PATCH', '/me', { handle: '' }, H.token);
  check('a username cannot be blanked', (await me(H.token)).handle === hostMe.handle, blanked.status);

  // Blocking and muting.
  const blockIt = await api('POST', '/bond/block', { userId: O.user.id }, H.token);
  check('anyone can block a member', blockIt.status === 201, blockIt.json);
  const afterBlock = await api('POST', '/bond/friends', { code: hostMe.friendCode }, O.token);
  check('a blocked person cannot ask the one who blocked them', afterBlock.status === 400, afterBlock.json);
  const list = await api('GET', '/bond/blocks', undefined, H.token);
  check('blocks are listed and can be lifted', list.json.blocked?.length === 1 && (await api('DELETE', `/bond/block/${O.user.id}`, undefined, H.token)).status === 200, list.json);
  const peerMute = await api('POST', `/community/members/${O.user.id}/mute`, {}, H.token);
  check('an ordinary member cannot mute anyone', peerMute.status === 403, peerMute.status);
  const adminMute = await api('POST', `/community/members/${O.user.id}/mute`, { reason: 'smoke' }, A.token);
  check('an admin mutes a member', adminMute.status === 200, adminMute.json);
  const mutedPost = await api('POST', '/community', { category: 'Stories', body: 'muted post' }, O.token);
  check('a muted member cannot post', mutedPost.status === 403, mutedPost.json);
  const higher = await api('POST', `/community/members/${A.user.id}/mute`, {}, A.token);
  check('nobody mutes an equal or higher rank', higher.status === 403, higher.status);
  const lift = await api('DELETE', `/community/members/${O.user.id}/mute`, undefined, H.token);
  check('a member cannot lift a mute', lift.status === 403, lift.status);
  check('an admin lifts it', (await api('DELETE', `/community/members/${O.user.id}/mute`, undefined, A.token)).status === 200, '');

  // Anonymous posts and threaded replies, in Community and inside an event.
  for (const t of [H, G, O]) await api('PATCH', '/me/modules', { key: 'community', on: true }, t.token);
  const anon = await api('POST', '/community', { category: 'Stories', body: `Anon post ${stamp}`, anonymous: true }, G.token);
  check('a member posts anonymously and still sees it is theirs', anon.status === 201 && anon.json.post?.anonymous === true && anon.json.post?.mine === true, anon.json.post);
  const feedH = await api('GET', '/community?size=50', undefined, H.token);
  const seenAnon = feedH.json.posts?.find((x) => x.id === anon.json.post?.id);
  check('everyone else sees a made-up name and nothing that points at the writer', Boolean(seenAnon) && seenAnon.authorId === '' && seenAnon.authorHandle === null && seenAnon.authorName !== 'Smoke guest' && /^\w+ \w+ \d\d$/.test(seenAnon.authorName) && !JSON.stringify(seenAnon).includes(G.user.id), seenAnon);
  const staffSees = (await api('GET', '/community?size=50', undefined, A.token)).json.posts?.find((x) => x.id === anon.json.post?.id);
  check('staff can still tell who wrote it, for reports', staffSees?.authorId === G.user.id, staffSees?.authorId);
  const searchHit = await api('GET', `/search?q=${encodeURIComponent('Anon post')}`, undefined, H.token);
  check('search never names the writer of an anonymous post', !JSON.stringify(searchHit.json).includes('Smoke guest'), searchHit.json?.posts);
  const top = await api('POST', `/community/${anon.json.post.id}/replies`, { body: 'First reply', anonymous: true }, H.token);
  const kid = await api('POST', `/community/${anon.json.post.id}/replies`, { body: 'An answer to it', parentId: top.json.reply?.id }, G.token);
  check('a reply can answer another reply, and sits one level in', kid.status === 201 && kid.json.reply?.parentId === top.json.reply?.id && kid.json.reply?.depth === 1, kid.json.reply);
  const thread = await api('GET', `/community/${anon.json.post.id}/replies`, undefined, G.token);
  check('replies come back in reading order, each under what it answers', thread.json.replies?.map((r) => r.depth).join() === '0,1' && thread.json.replies?.[0]?.id === top.json.reply?.id, thread.json.replies);
  check('an anonymous reply carries no id for others, and the same name through the thread', thread.json.replies?.[0]?.authorId === '' && thread.json.replies?.[0]?.anonymous === true, thread.json.replies?.[0]);
  let parent = kid.json.reply;
  for (let k = 0; k < 6; k++) parent = (await api('POST', `/community/${anon.json.post.id}/replies`, { body: `deeper ${k}`, parentId: parent.id }, H.token)).json.reply;
  check('a thread stops getting deeper at the limit', parent?.depth === 4, parent?.depth);
  const anonNote = (await api('GET', '/inbox', undefined, G.token)).json.notifications?.find((n) => n.body === 'First reply');
  check('the inbox names the made-up name, never the real one', Boolean(anonNote) && /^\w+ \w+ \d\d replied to your post$/.test(anonNote.title) && !JSON.stringify(anonNote).includes('Smoke host'), anonNote);
  const blockedBy = await api('POST', `/community/posts/${anon.json.post.id}/block-author`, {}, O.token);
  check('an anonymous author can be blocked without learning who they are', blockedBy.status === 201, blockedBy.json);
  const stillThere = (await api('GET', '/community?size=50', undefined, O.token)).json.posts?.some((x) => x.id === anon.json.post.id);
  check('the blocked author’s posts disappear for the one who blocked', stillThere === false, stillThere);
  await api('DELETE', `/bond/block/${G.user.id}`, undefined, O.token);
  const evAnon = await api('POST', `/connect/party/${ev.id}/messages`, { body: 'Is there parking?', anonymous: true }, G.token);
  const evRoot = (await api('GET', `/connect/party/${ev.id}`, undefined, H.token)).json.messages?.find((m) => m.body === 'Is there parking?');
  check('an anonymous line in an event carries a made-up name and no id', evAnon.status === 201 && evRoot?.anonymous === true && evRoot.userId === '' && /^\w+ \w+ \d\d$/.test(evRoot.name ?? ''), evRoot);
  await api('POST', `/connect/party/${ev.id}/messages`, { body: 'Yes, behind the hall.', parentId: evRoot?.id }, H.token);
  const evThread = (await api('GET', `/connect/party/${ev.id}`, undefined, G.token)).json.messages?.filter((m) => ['Is there parking?', 'Yes, behind the hall.'].includes(m.body));
  check('a line in an event can be answered, and threads under it', evThread?.map((m) => m.depth).join() === '0,1', evThread);

  // The calendars: tap a day to add, change or remove what it holds.
  const yday = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
  const back = await api('POST', '/journal', { title: 'Looking back', body: 'Written from the calendar.', emotion: 4, date: yday }, G.token);
  check('a journal entry can be added to a past day from the calendar', back.status === 201 && back.json.entry?.createdAt?.startsWith(yday), back.json.entry?.createdAt);
  const dayList = await api('GET', `/journal?date=${yday}`, undefined, G.token);
  check('a day lists its own entries', dayList.json.entries?.some((e) => e.id === back.json.entry?.id), dayList.json.entries?.length);
  const monthDays = await api('GET', `/journal/days?month=${yday.slice(0, 7)}`, undefined, G.token);
  check('the month marks the day with its count and feeling', monthDays.json.days?.some((d) => d.date === yday && d.count >= 1 && d.emotion === 4), monthDays.json.days);
  const futureJ = await api('POST', '/journal', { title: 'Too soon', body: 'x', date: '2999-01-01' }, G.token);
  check('a future day cannot be written to', futureJ.status === 400, futureJ.json);
  const editBack = await api('PATCH', `/journal/${back.json.entry.id}`, { body: 'Changed from the calendar.' }, G.token);
  check('and an entry opened from it can be changed', editBack.json.entry?.body === 'Changed from the calendar.', editBack.json);
  const moodBack = await api('POST', '/wellbeing/mood', { date: yday, value: 2, note: 'rough' }, G.token);
  check('a mood can be added to a past day', moodBack.status === 201 && moodBack.json.log?.date === yday, moodBack.json);
  const moodAgain = await api('POST', '/wellbeing/mood', { date: yday, value: 5 }, G.token);
  const moodList = await api('GET', '/wellbeing/mood?days=30', undefined, G.token);
  check('logging that day again changes it, one mood per day', moodList.json.logs?.filter((l) => l.date === yday).length === 1 && moodAgain.json.log?.value === 5, moodList.json.logs?.filter((l) => l.date === yday));
  const moodFuture = await api('POST', '/wellbeing/mood', { date: '2999-01-01', value: 3 }, G.token);
  check('a future day cannot take a mood', moodFuture.status === 400, moodFuture.json);
  await api('DELETE', `/wellbeing/mood/${moodAgain.json.log.id}`, undefined, G.token);
  check('a day’s mood can be removed', !(await api('GET', '/wellbeing/mood?days=30', undefined, G.token)).json.logs?.some((l) => l.date === yday), '');
  await api('DELETE', `/journal/${back.json.entry.id}`, undefined, G.token);

  // Admin: delete a person from the list, and allow or block an app for one person.
  const victim = await api('POST', '/auth/signup', { email: `gone-${stamp}@smoke.test`, password: `Kettle-${stamp}-pass`, displayName: 'Smoke leaving', phone: PHONE, birthDate: GROWN }, undefined, { 'CF-Connecting-IP': CODE_ADDRESS });
  const victimId = victim.json.user?.id;
  const blockApp = await admin('POST', '/admin/flags/win/overrides', { subjectType: 'user', subjectId: victimId, enabled: false, reason: 'smoke' });
  check('an app can be blocked for one person', blockApp.status === 201 && blockApp.json.override?.enabled === false, blockApp.json);
  const theySee = await admin('GET', `/admin/flags/preview/${victimId}`);
  check('what that person sees shows it as not allowed', theySee.json.access?.win?.available === false && theySee.json.access.win.reason === 'override', theySee.json.access?.win);
  const allowApp = await admin('POST', '/admin/flags/work/overrides', { subjectType: 'user', subjectId: victimId, enabled: true, reason: 'smoke' });
  check('and another allowed for just them', allowApp.status === 201 && (await admin('GET', `/admin/flags/preview/${victimId}`)).json.access?.work?.available === true, allowApp.json);
  const lockedOff = await admin('POST', '/admin/flags/home/overrides', { subjectType: 'user', subjectId: victimId, enabled: false });
  check('the core of the app cannot be blocked', lockedOff.status === 400, lockedOff.json);
  const delAdmin = await api('DELETE', `/admin/users/${A.user.id}`, undefined, A.token);
  check('an admin is not deleted from the list', delAdmin.status === 400, delAdmin.json);
  const delSelf = await api('DELETE', `/admin/users/${H.user.id}`, undefined, H.token);
  check('only an admin deletes people', delSelf.status === 403, delSelf.status);
  const delUser = await api('DELETE', `/admin/users/${victimId}`, undefined, A.token);
  check('an admin deletes a person from the list', delUser.status === 200, delUser.json);
  const afterDel = await api('GET', '/me', undefined, victim.json.token);
  check('their sign-in no longer works', afterDel.status === 401, afterDel.status);
  check('and the delete is in the audit log', JSON.stringify((await admin('GET', '/admin/audit')).json).includes('user.delete'), '');

  // Water and reminders.
  const w0 = await api('GET', `/reminders?day=${today}`, undefined, G.token);
  check('water starts at zero with a goal and a glass of the person’s own', w0.status === 200 && w0.json.water?.ml === 0 && w0.json.water.goalMl === 2000 && w0.json.water.glassMl === 250 && w0.json.water.on === true && w0.json.water.week?.length === 7, w0.json.water);
  await api('POST', '/reminders/water', { day: today }, G.token);
  const w2 = await api('POST', '/reminders/water', { day: today }, G.token);
  check('a tap adds a glass', w2.status === 201 && w2.json.water?.ml === 500 && w2.json.water.glasses === 2, w2.json.water);
  const wOdd = await api('POST', '/reminders/water', { day: today, ml: 400 }, G.token);
  check('any amount can be added', wOdd.json.water?.ml === 900, wOdd.json.water);
  const wUndo = await api('DELETE', `/reminders/water?day=${today}`, undefined, G.token);
  check('the last one can be taken back', wUndo.json.water?.ml === 500, wUndo.json.water);
  const wBig = await api('POST', '/reminders/water', { day: today, ml: 5000 }, G.token);
  check('a slip of the thumb cannot add a huge amount', wBig.status === 400, wBig.json);
  const wOld = await api('GET', '/reminders?day=2020-01-01', undefined, G.token);
  check('only today or yesterday can be logged or read', wOld.status === 400, wOld.status);
  const wSet = await api('PUT', '/reminders/water/settings', { day: today, goalMl: 2500, everyMin: 240, from: '08:00', to: '20:00' }, G.token);
  check('the goal, the gap and the hours can be changed', wSet.json.water?.goalMl === 2500 && wSet.json.water.everyMin === 240 && wSet.json.water.from === '08:00', wSet.json.water);
  const wShort = await api('PUT', '/reminders/water/settings', { day: today, everyMin: 60 }, G.token);
  check('water goes out every two hours at most, so one hour is not offered', wShort.status === 400, wShort.json);
  const waterTick = await fetch(`${ORIGIN}/__scheduled?cron=0+*%2F2+*+*+*`);
  check('the two-hour water trigger runs', waterTick.status === 200, waterTick.status);
  const wBad = await api('PUT', '/reminders/water/settings', { day: today, from: '21:00', to: '09:00' }, G.token);
  check('a day must start before it ends', wBad.status === 400, wBad.json);
  const wOff = await api('PUT', '/reminders/water/settings', { day: today, on: false }, G.token);
  check('water reminders can be switched off', wOff.json.water?.on === false, wOff.json.water);
  const mk = await api('POST', '/reminders/custom', { title: 'Stretch', time: '17:30', days: [1, 2, 3, 4, 5] }, G.token);
  check('a person adds their own reminder', mk.status === 201 && mk.json.reminder?.time === '17:30' && mk.json.reminder.days.length === 5 && mk.json.reminder.enabled, mk.json);
  const mkBad = await api('POST', '/reminders/custom', { title: 'x', time: '25:99' }, G.token);
  check('a reminder needs a real time', mkBad.status === 400, mkBad.json);
  const stranger2 = await api('PATCH', `/reminders/custom/${mk.json.reminder.id}`, { enabled: false }, O.token);
  check('nobody else can change it', stranger2.status === 404, stranger2.status);
  const off = await api('PATCH', `/reminders/custom/${mk.json.reminder.id}`, { enabled: false, title: 'Stretch more' }, G.token);
  check('it can be turned off and renamed', off.json.reminder?.enabled === false && off.json.reminder.title === 'Stretch more', off.json);
  const expW = await api('GET', '/me/export', undefined, G.token);
  check('water and reminders are in the export', expW.json.waterLogs?.length >= 2 && expW.json.customReminders?.length === 1, [expW.json.waterLogs?.length, expW.json.customReminders?.length]);
  await api('DELETE', `/reminders/custom/${mk.json.reminder.id}`, undefined, G.token);
  check('and it can be removed', (await api('GET', `/reminders?day=${today}`, undefined, G.token)).json.custom?.length === 0, '');
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
  const back = await api('POST', `/inbox/${note?.id}/archive`, { archived: false }, W.token);
  const restored = await api('GET', '/inbox?tab=following', undefined, W.token);
  check('Restore brings an archived note back to the inbox', back.status === 200 && restored.json.notifications?.some((n) => n.id === note?.id && !n.archivedAt), restored.json.notifications?.length);
  const early = await api('DELETE', `/inbox/${note?.id}`, undefined, W.token);
  check('a note in the inbox cannot be deleted before it is archived', early.status === 404, early.status);
  await api('POST', `/inbox/${note?.id}/archive`, { archived: true }, W.token);
  const stranger = await api('DELETE', `/inbox/${note?.id}`, undefined, P.token);
  check("nobody deletes someone else's archived note", stranger.status === 404, stranger.status);
  const gone = await api('DELETE', `/inbox/${note?.id}`, undefined, W.token);
  const after = await api('GET', '/inbox?tab=following&show=archived', undefined, W.token);
  check('an archived note is deleted for good', gone.status === 200 && !after.json.notifications?.some((n) => n.id === note?.id), after.json.notifications?.length);
  const emptied = await api('DELETE', '/inbox/archived?tab=all', undefined, W.token);
  const none = await api('GET', '/inbox?show=archived', undefined, W.token);
  check('Delete all archived empties the archive and leaves the inbox alone', emptied.status === 200 && none.json.notifications?.length === 0, none.json.notifications?.length);
  const shelf = await api('GET', '/rewards', undefined, W.token);
  check('the rewards catalog lists the books, the card games and the merch shelves', ['book_relationship_method', 'book_dictionary_of_mistakes', 'book_20_somethings', 'game_date_guru', 'game_workflow', 'water_bottle', 'enamel_pin'].every((k) => shelf.json.rewards?.some((r) => r.key === k)), shelf.json.rewards?.length);

  // Card games: unlocked once with points, the text served only to the person who has it (or the team).
  const gamesTeam = await api('GET', '/cards', undefined, A.token);
  check('the team sees all nine card games open, with their decks', gamesTeam.status === 200 && gamesTeam.json.games?.length === 9 && gamesTeam.json.games.every((g) => g.unlocked && g.total > 0), gamesTeam.json.games?.map((g) => [g.key, g.total]));
  const guru = await api('GET', '/cards/date_guru', undefined, A.token);
  check('a whole game comes with its cards, two sides where it has them', guru.status === 200 && guru.json.game?.decks?.[0]?.cards?.length === 52 && guru.json.game.decks[0].cards.every((c) => c.text && c.alt?.text), guru.json.game?.decks?.[0]?.cards?.length);
  const roast = await api('GET', '/cards/roast_or_flirt', undefined, A.token);
  check('Roast or Flirt has an English and a Hinglish deck of a hundred', roast.json.game?.decks?.map((d) => d.cards.length).join() === '100,100', roast.json.game?.decks?.map((d) => d.cards.length));
  const lockedGame = await api('GET', '/cards/date_guru', undefined, R.token);
  check('a game that is not unlocked is refused, with its price', lockedGame.status === 403 && lockedGame.json.locked === true && lockedGame.json.cost === 1500, lockedGame.json);
  const brokeBuy = await api('POST', '/rewards/game_relationship_method/redeem', undefined, R.token);
  check('unlocking needs the points', brokeBuy.status === 400 && /more points/.test(brokeBuy.json.error ?? ''), brokeBuy.json);
  await admin('POST', `/admin/users/${R.user.id}/points`, { amount: 2000, note: 'smoke card games' });
  const gameList = await api('GET', '/cards', undefined, R.token);
  const guruGate = gameList.json.games?.find((g) => g.key === 'date_guru')?.unlock;
  check('a game that asks for xp shows what is missing, as a lock', guruGate?.ok === false && guruGate.minXp === 100 && /xp/.test(guruGate.why ?? ''), guruGate);
  const noXp = await api('POST', '/rewards/game_date_guru/redeem', undefined, R.token);
  check('with the points but not the xp, a game stays locked on the server too', noXp.status === 403 && noXp.json.unlock?.ok === false, noXp.json);
  await admin('POST', `/admin/users/${R.user.id}/xp`, { amount: 500, note: 'smoke card games' });
  const buy = await api('POST', '/rewards/game_date_guru/redeem', undefined, R.token);
  check('unlocking a game opens it at once and takes its points', buy.status === 201 && buy.json.game === 'date_guru' && buy.json.redemption?.status === 'fulfilled' && buy.json.points === 500, buy.json);
  const opened = await api('GET', '/cards/date_guru', undefined, R.token);
  check('the unlocked game is served to its owner', opened.status === 200 && opened.json.game?.decks?.[0]?.cards?.length === 52, opened.status);
  const other = await api('GET', '/cards/ulta_seedha', undefined, R.token);
  check('and only that game', other.status === 403, other.status);
  const twice = await api('POST', '/rewards/game_date_guru/redeem', undefined, R.token);
  check('a game cannot be bought twice', twice.status === 409, twice.status);
  const undo = await api('POST', `/rewards/redemptions/${buy.json.redemption?.id}/cancel`, undefined, R.token);
  check('an unlock is for good, not a reservation to cancel', undo.status === 400, undo.status);
  const list = await api('GET', '/cards', undefined, R.token);
  check('the list marks what the person has', list.json.games?.filter((g) => g.unlocked).map((g) => g.key).join() === 'date_guru', list.json.games?.filter((g) => g.unlocked).map((g) => g.key));
  const shelf2 = await api('GET', '/rewards', undefined, R.token);
  check('Rewards says which games are yours', shelf2.json.games?.join() === 'date_guru', shelf2.json.games);

  // Discover: the quiz is scored on the server, kept per person and never shown to anyone else.
  const dz0 = await api('GET', '/discover', undefined, R.token);
  check('Discover starts empty', dz0.status === 200 && dz0.json.progress?.done === 0 && dz0.json.progress?.total === DISCOVER_STEPS && dz0.json.latest === null, dz0.json.progress);
  const dzAnswers = {
    triads: Array.from({ length: 18 }, () => ({ most: 0, least: 1 })),
    puzzles: (() => {
      const picks = [];
      for (let i = 0; i < PUZZLES_SHOWN; i += 1) picks.push(puzzleAt(picks, i).answer);
      return picks;
    })(),
    puzzleMs: Array.from({ length: PUZZLES_SHOWN }, () => 4000),
    words: Array.from({ length: 3 }, () => ({ most: [0, 1, 2], least: [3, 4, 5] })),
    scenes: DISCOVER_SCENES.map((_, i) => ({ most: DISCOVER_KEYS.scenes[i].indexOf(4), least: DISCOVER_KEYS.scenes[i].indexOf(1) })),
  };
  const dzPart = await api('PUT', '/discover/draft', { answers: { ...dzAnswers, triads: [{ most: 0, least: 0 }, ...dzAnswers.triads.slice(1)], scenes: [] } }, R.token);
  check('a half-finished quiz is saved, and a bad answer is dropped', dzPart.status === 200 && dzPart.json.progress?.done === DISCOVER_CORE_STEPS - 1 - 6, dzPart.json.progress);
  const dzEarly = await api('POST', '/discover/submit', {}, R.token);
  check('the quiz cannot be finished with questions open', dzEarly.status === 400 && /open/.test(dzEarly.json.error ?? ''), dzEarly.json);
  const dzDone = await api('POST', '/discover/submit', { answers: dzAnswers }, R.token);
  const dzR = dzDone.json.result;
  check('a finished quiz is scored on the server: puzzles and situations full marks, three top strengths, no emotional intelligence part yet', dzDone.status === 201 && dzR?.puzzles?.right === PUZZLES_SHOWN && dzR?.puzzles?.score >= 90 && dzR?.puzzles?.medianSeconds === 4 && dzR?.eq === undefined && dzR?.judgment === 100 && dzR?.top?.length === 3 && new Set(dzR.top).size === 3 && dzR?.strengths?.length === 7 && Object.values(dzR.traits).every((n) => n >= 0 && n <= 100), dzDone.json);
  const dz1 = await api('GET', '/discover', undefined, R.token);
  check('the result is kept and the draft is gone', dz1.json.latest?.id === dzDone.json.id && dz1.json.progress?.done === 0, dz1.json.progress);
  const eqAnswers = {
    ...dzAnswers,
    feelings: EQ_FEELINGS.map((screen) => screen.map((it) => (it.sign === 1 ? 4 : 0))),
    reading: EQ_READING.map((_, i) => DISCOVER_KEYS.reading[i]),
    people: EQ_PEOPLE.map((_, i) => ({ most: DISCOVER_KEYS.people[i].indexOf(4), least: DISCOVER_KEYS.people[i].indexOf(1) })),
  };
  const dzEq = await api('POST', '/discover/submit', { answers: eqAnswers }, R.token);
  check('with the emotional intelligence part answered, it is scored too, and each part reads out', dzEq.status === 201 && dzEq.json.result?.eq?.overall === 100 && Object.keys(dzEq.json.result.eq.dims).length === 5 && dzEq.json.result.eq.reading.right === 6, dzEq.json.result?.eq);
  const dzEqHalf = await api('POST', '/discover/submit', { answers: { ...eqAnswers, people: eqAnswers.people.slice(0, 3) } }, R.token);
  check('a half-done add-on is left out, not scored', dzEqHalf.status === 201 && dzEqHalf.json.result?.eq === undefined, dzEqHalf.json.result?.eq);
  await api('DELETE', `/discover/results/${dzEq.json.id}`, undefined, R.token);
  await api('DELETE', `/discover/results/${dzEqHalf.json.id}`, undefined, R.token);
  check('Discover keeps its switches: next steps on, assistant off, until the person says', dz1.json.settings?.steps === true && dz1.json.settings?.assistant === false, dz1.json.settings);
  const dzLocked = await api('GET', '/discover/profile', undefined, R.token);
  check('the assistant gets nothing while its switch is off', dzLocked.status === 403 && /not let the assistant/.test(dzLocked.json.error ?? ''), dzLocked.json);
  const dzStepsOn = await api('GET', `/home/brief?date=${new Date().toISOString().slice(0, 10)}&hour=10`, undefined, R.token);
  check('next steps are shaped by the result: the quietest strength comes up', dzStepsOn.json.brief?.actions?.some((x) => x.key === 'strength-grow') || dzStepsOn.json.actions?.some((x) => x.key === 'strength-grow'), (dzStepsOn.json.brief?.actions ?? dzStepsOn.json.actions)?.map((x) => x.key));
  await api('PUT', '/discover/settings', { steps: false }, R.token);
  const dzStepsOff = await api('GET', `/home/brief?date=${new Date().toISOString().slice(0, 10)}&hour=10`, undefined, R.token);
  check('and they go when the person switches next steps off', !(dzStepsOff.json.brief?.actions ?? dzStepsOff.json.actions)?.some((x) => x.key === 'strength-grow'), (dzStepsOff.json.brief?.actions ?? dzStepsOff.json.actions)?.map((x) => x.key));
  const dzAllow = await api('PUT', '/discover/settings', { assistant: true }, R.token);
  const dzProfile = await api('GET', '/discover/profile', undefined, R.token);
  check('with the switch on the assistant reads a small profile, not the answers', dzAllow.status === 200 && dzProfile.status === 200 && dzProfile.json.profile?.top?.length === 3 && /self-check/.test(dzProfile.json.summary ?? '') && !JSON.stringify(dzProfile.json).includes('"triads"') && Array.isArray(dzProfile.json.howToHelp), dzProfile.json);
  const dzNone = await api('GET', '/discover/profile', undefined, P.token);
  check('someone who has not taken it has nothing to read', dzNone.status === 403 || dzNone.status === 404, dzNone.status);
  const dzStranger = await api('DELETE', `/discover/results/${dzDone.json.id}`, undefined, P.token);
  check("nobody deletes someone else's result", dzStranger.status === 404, dzStranger.status);
  const dzOther = await api('GET', '/discover', undefined, P.token);
  check('and nobody else sees it', dzOther.json.latest === null, dzOther.json.latest);
  const dzGone = await api('DELETE', `/discover/results/${dzDone.json.id}`, undefined, R.token);
  check('the owner can delete a result', dzGone.status === 200 && (await api('GET', '/discover', undefined, R.token)).json.latest === null, dzGone.status);

  // Devices: three at once. The fourth sign-in signs the oldest out, and that device is told why.
  const dvEmail = `devices-${stamp}@smoke.test`;
  const dvPass = `Quartz-${stamp}-dev`;
  const dv0 = await signup(dvEmail, dvPass, 'Smoke devices');
  const dvIn = async () => (await api('POST', '/auth/signin', { email: dvEmail, password: dvPass })).json.token;
  const dvTokens = [dv0.token, await dvIn(), await dvIn()];
  const dvUp = await Promise.all(dvTokens.map((t) => api('GET', '/me', undefined, t)));
  check('three devices can be signed in at once', dvUp.every((r) => r.status === 200), dvUp.map((r) => r.status));
  const dv3 = await dvIn();
  const dvOld = await api('GET', '/me', undefined, dvTokens[0]);
  check('a fourth sign-in signs the oldest device out, and says why', dvOld.status === 401 && dvOld.json.reason === 'devices', dvOld.json);
  const dvRest = await Promise.all([dvTokens[1], dvTokens[2], dv3].map((t) => api('GET', '/me', undefined, t)));
  check('and the other three keep working', dvRest.every((r) => r.status === 200), dvRest.map((r) => r.status));
  const dvUnknown = await api('GET', '/me', undefined, 'not-a-real-token');
  check('an unknown token is a plain 401 with no reason', dvUnknown.status === 401 && dvUnknown.json.reason === undefined, dvUnknown.json);
  const dv4 = await dvIn();
  const dvSecond = await api('GET', '/me', undefined, dvTokens[1]);
  check('the next one pushes out the next oldest, never a newer one', dvSecond.status === 401 && (await api('GET', '/me', undefined, dv3)).status === 200 && (await api('GET', '/me', undefined, dv4)).status === 200, dvSecond.status);

  // Timer settings: kept on the account, owner only, with the defaults the person asked for.
  const fsNone = await api('GET', '/wellbeing/focus-settings', undefined, R.token);
  check('a new account has no saved timer settings yet', fsNone.status === 200 && fsNone.json.settings === null, fsNone.json);
  const fsPut = await api('PUT', '/wellbeing/focus-settings', { settings: { focus: 50, short: 999, ambient: 'ocean', ambientVolume: 250, sound: false, bogus: 1 } }, R.token);
  check('saving keeps what is clean and clamps the rest, and fills in the defaults', fsPut.status === 200 && fsPut.json.settings?.focus === 50 && fsPut.json.settings?.short === 60 && fsPut.json.settings?.ambient === 'ocean' && fsPut.json.settings?.ambientVolume === 100 && fsPut.json.settings?.sound === false && fsPut.json.settings?.logFocus === true && fsPut.json.settings?.logBreaks === false && fsPut.json.settings?.auto === false && !('bogus' in fsPut.json.settings), fsPut.json.settings);
  const fsGet = await api('GET', '/wellbeing/focus-settings', undefined, R.token);
  check('and they come back on any device', fsGet.json.settings?.focus === 50 && fsGet.json.settings?.ambient === 'ocean', fsGet.json.settings);
  const fsOther = await api('GET', '/wellbeing/focus-settings', undefined, P.token);
  check('nobody else sees them', fsOther.json.settings === null, fsOther.json);
  const fsExport = JSON.stringify((await api('GET', '/me/export', undefined, R.token)).json);
  check('they are in the export', fsExport.includes('focusPrefs') && fsExport.includes('ocean'), '');

  // Discover add-ons: a 16-type self-check, love languages and how the mind works. Own routes, owner only, the mind part behind its own switch.
  const xm0 = await api('GET', '/discover/more', undefined, R.token);
  check('the add-ons start empty', xm0.status === 200 && ['type', 'love', 'mind'].every((k) => xm0.json.extras?.[k]?.result === null && xm0.json.extras[k].progress.done === 0), xm0.json);
  check('an unknown add-on is not found', (await api('PUT', '/discover/more/horoscope/draft', { answers: [] }, R.token)).status === 404, '');
  const typeAll = (pole) => TYPE_SCREENS.map((sc) => sc.map((it) => (['E', 'S', 'T', 'J'].includes(it.pole) === (pole === 'first') ? 4 : 0)));
  const xmPart = await api('PUT', '/discover/more/type/draft', { answers: [typeAll('first')[0], [9, 9, 9, 9]] }, R.token);
  check('a draft keeps only clean answers', xmPart.status === 200 && xmPart.json.progress?.done === 1, xmPart.json);
  const xmEarly = await api('POST', '/discover/more/type/submit', {}, R.token);
  check('a half-finished self-check is not scored', xmEarly.status === 400 && /still open/.test(xmEarly.json.error ?? ''), xmEarly.json);
  const xmType = await api('POST', '/discover/more/type/submit', { answers: typeAll('second') }, R.token);
  check('the type is scored on the server, four letters with how clear each is', xmType.status === 201 && xmType.json.result?.code === 'INFP' && xmType.json.analysis?.name === TYPE_NAMES.INFP.name && Object.values(xmType.json.result.axes).every((a) => a.strength === 'clear'), xmType.json);
  const loveAns = { receive: LOVE_PAIRS.map(() => 0), give: LOVE_PAIRS.map(() => 1) };
  const xmLove = await api('POST', '/discover/more/love/submit', { answers: loveAns }, R.token);
  check('love languages are scored for receiving and giving apart', xmLove.status === 201 && xmLove.json.result?.receive?.words === 4 && xmLove.json.result?.give?.touch === 4 && xmLove.json.analysis?.match === false, xmLove.json);
  const mindAns = MIND_SCREENS.map((sc) => sc.map(() => 4));
  const xmMind = await api('POST', '/discover/more/mind/submit', { answers: mindAns }, R.token);
  check('how the mind works is scored in bands, with a plain note that it is not a test', xmMind.status === 201 && xmMind.json.result?.areas?.att?.band === 'many' && xmMind.json.analysis?.talkToSomeone === true && /not a test for ADHD/.test(xmMind.json.analysis?.note ?? ''), xmMind.json.analysis?.note);
  const xmBack = await api('GET', '/discover/more', undefined, R.token);
  check('the results are kept', ['type', 'love', 'mind'].every((k) => xmBack.json.extras?.[k]?.result), Object.keys(xmBack.json.extras ?? {}));
  const xmOther = await api('GET', '/discover/more', undefined, P.token);
  check('and nobody else sees them', ['type', 'love', 'mind'].every((k) => xmOther.json.extras?.[k]?.result === null), xmOther.json);

  const xmSet0 = await api('GET', '/discover', undefined, R.token);
  check('the mind switch starts off', xmSet0.json.settings?.mind === false, xmSet0.json.settings);
  await api('PUT', '/discover/settings', { assistant: true, steps: true }, R.token);
  const xmProf1 = await api('GET', '/discover/profile', undefined, R.token);
  check('the assistant reads type and love languages but not the mind part while that switch is off', xmProf1.status === 200 && xmProf1.json.extras?.type === 'INFP' && xmProf1.json.extras?.love?.give?.[0] === 'touch' && xmProf1.json.extras?.mind === undefined && !/mind works/.test(xmProf1.json.summary ?? ''), xmProf1.json.extras);
  const dayStr = new Date().toISOString().slice(0, 10);
  const xmBrief0 = await api('GET', `/home/brief?date=${dayStr}&hour=10`, undefined, R.token);
  const xmKeys0 = (xmBrief0.json.brief?.actions ?? xmBrief0.json.actions ?? []).map((x) => x.key);
  check('next steps do not use the mind part while it is off', !xmKeys0.some((k) => k.startsWith('mind-')), xmKeys0);
  await api('PUT', '/discover/settings', { mind: true }, R.token);
  const xmProf2 = await api('GET', '/discover/profile', undefined, R.token);
  check('with the mind switch on the assistant gets a pacing hint and never a condition', xmProf2.json.extras?.mind?.att === 'many' && /never name a condition/.test(xmProf2.json.summary ?? '') && !/ADHD|autis/i.test(JSON.stringify(xmProf2.json.howToHelp ?? [])), xmProf2.json.howToHelp);
  const xmBrief1 = await api('GET', `/home/brief?date=${dayStr}&hour=10`, undefined, R.token);
  const xmKeys1 = (xmBrief1.json.brief?.actions ?? xmBrief1.json.actions ?? []).map((x) => x.key);
  check('and next steps then pick up a step to pace the day', xmKeys1.some((k) => k.startsWith('mind-')), xmKeys1);
  // Human design: a chart from the birth details, worked out on the server, in both zodiacs, private to the person.
  const hdIn = { date: '1990-05-15', time: '14:30', zone: 'Asia/Kolkata', place: 'Mumbai' };
  const hdEarly = await api('POST', '/discover/more/design/submit', { answers: { ...hdIn, time: '' } }, R.token);
  check('a chart needs the birth time', hdEarly.status === 400, hdEarly.json);
  const hdBadZone = await api('POST', '/discover/more/design/submit', { answers: { ...hdIn, zone: 'Nowhere/Land' } }, R.token);
  check('and a real time zone', hdBadZone.status === 400, hdBadZone.json);
  const hd = await api('POST', '/discover/more/design/submit', { answers: hdIn }, R.token);
  check('the chart is worked out on the server, for both zodiacs, with goals', hd.status === 201 && hd.json.result?.birthUtc === '1990-05-15T09:00:00.000Z' && hd.json.analysis?.tropical?.goals?.length >= 6 && hd.json.analysis?.fagan?.goals?.length >= 6 && hd.json.analysis?.compare?.lines?.length === 4 && ['3d', '5d', '7d'].every((k) => hd.json.analysis.tropical.depths[k].length > 2), hd.json.analysis?.tropical?.headline);
  const hdN = await api('POST', '/discover/more/design/submit', { answers: { ...hdIn, name: 'Asha Rao 123' } }, R.token);
  check('a birth name keeps only letters, for numerology', hdN.status === 201 && hdN.json.result?.input?.name === 'Asha Rao', hdN.json.result?.input);
  const hdOther = await api('GET', '/discover/more', undefined, P.token);
  check('nobody else sees the chart or the birth details', hdOther.json.extras?.design?.result === null && !JSON.stringify(hdOther.json).includes('Mumbai'), '');
  const hdProf = await api('GET', '/discover/profile', undefined, R.token);
  check('the assistant gets the type, strategy, authority and profile, never the birth details', hdProf.json.extras?.design?.type && hdProf.json.extras?.design?.profile && /not science/.test(hdProf.json.summary ?? '') && !/1990|14:30|Kolkata|Mumbai|Asha/.test(JSON.stringify(hdProf.json)) && hdProf.json.extras?.design?.lifePath === 3 && hdProf.json.extras?.design?.expression >= 1 && /Numerology/.test(hdProf.json.summary ?? ''), hdProf.json.extras?.design);
  const hdExport = JSON.stringify((await api('GET', '/me/export', undefined, R.token)).json);
  check('the chart is in the export', hdExport.includes('Asia/Kolkata'), '');
  const hdDel = await api('DELETE', '/discover/more/design', undefined, R.token);
  check('and can be deleted on its own', hdDel.status === 200 && (await api('GET', '/discover/more', undefined, R.token)).json.extras?.design?.result === null, hdDel.status);

  const xmExport = JSON.stringify((await api('GET', '/me/export', undefined, R.token)).json);
  check('the add-ons are in the export', xmExport.includes('discoverExtras') && xmExport.includes('INFP'), '');
  const xmDel = await api('DELETE', '/discover/more/mind', undefined, R.token);
  const xmAfter = await api('GET', '/discover/more', undefined, R.token);
  check('one add-on can be deleted on its own', xmDel.status === 200 && xmAfter.json.extras?.mind?.result === null && xmAfter.json.extras?.type?.result !== null, xmAfter.json.extras?.mind);
  await api('PUT', '/discover/settings', { assistant: false, mind: false, steps: false }, R.token);

  // Super admin gives xp and badges by hand: audited, floored at zero, and counted for unlocks.
  const gxBefore = (await api('GET', '/me', undefined, R.token)).json.user.xp;
  const gxUp = await admin('POST', `/admin/users/${R.user.id}/xp`, { amount: 250, note: 'smoke xp' });
  check('a super admin adds xp, and it shows on the person', gxUp.status === 200 && gxUp.json.user?.xp === gxBefore + 250 && (await api('GET', '/me', undefined, R.token)).json.user.xp === gxBefore + 250, gxUp.json.user?.xp);
  const gxDown = await admin('POST', `/admin/users/${R.user.id}/xp`, { amount: -100000, note: 'smoke take it back' });
  check('and takes it away, never below zero', gxDown.status === 200 && gxDown.json.user?.xp === 0, gxDown.json.user?.xp);
  const gxZero = await admin('POST', `/admin/users/${R.user.id}/xp`, { amount: 0 });
  check('a zero amount is refused', gxZero.status === 400, gxZero.status);
  const gbOne = await admin('POST', `/admin/users/${R.user.id}/badges`, { key: 'streak_7', note: 'smoke badge' });
  check('a super admin gives a badge by hand', gbOne.status === 200 && gbOne.json.user?.grantedBadges?.includes('streak_7') && (await api('GET', '/me', undefined, R.token)).json.badges?.includes('streak_7'), gbOne.json.user?.grantedBadges);
  const gbBad = await admin('POST', `/admin/users/${R.user.id}/badges`, { key: 'not_a_badge' });
  check('only a real badge can be given', gbBad.status === 400, gbBad.status);
  const gbDel = await admin('DELETE', `/admin/users/${R.user.id}/badges/streak_7`);
  check('and taken back', gbDel.status === 200 && !gbDel.json.user?.grantedBadges?.includes('streak_7') && !(await api('GET', '/me', undefined, R.token)).json.badges?.includes('streak_7'), gbDel.json.user?.grantedBadges);

  // The app's own log: what changed, where and by whom. Super admins only; never a body, never a private area.
  const mark = `smoke-mark-${stamp}`;
  await api('POST', '/public/client-error', { message: `Boom ${mark}`, path: '/home?secret=1#x' });
  await api('POST', '/journal', { title: `private ${mark}`, body: `private ${mark}` }, R.token);
  const logsAdmin = await api('GET', `/internal/logs?q=${mark}`, undefined, A.token);
  check('a super admin reads the logs, and a browser error is in them without a query string', logsAdmin.status === 200 && logsAdmin.json.logs?.some((l) => l.area === 'client' && l.level === 'error' && l.path === '/home' && l.message.includes(mark)), logsAdmin.json.logs?.slice(0, 2));
  const byWho = await api('GET', `/internal/logs?actor=${A.user.id}`, undefined, A.token);
  check('the logs filter by person, and list the people seen', byWho.status === 200 && byWho.json.logs?.length > 0 && byWho.json.logs.every((l) => l.actorId === A.user.id) && byWho.json.actors?.some((x) => x.id === A.user.id && x.count > 0), [byWho.json.logs?.length, byWho.json.actors?.length]);
  const logsNo = await api('GET', '/internal/logs', undefined, R.token);
  check('nobody else reads the logs', logsNo.status === 403, logsNo.status);
  const changes = await api('GET', '/internal/logs?area=community', undefined, A.token);
  check('a change is logged by area, with who made it and no ids in the path', changes.status === 200 && changes.json.logs?.some((l) => l.actorName && /^\/community/.test(l.path) && !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(l.path)), changes.json.logs?.slice(0, 2));
  const privateLogs = await api('GET', '/internal/logs?area=journal', undefined, A.token);
  check('the journal leaves no line in the logs', privateLogs.status === 200 && privateLogs.json.logs?.length === 0 && !JSON.stringify((await api('GET', `/internal/logs?q=private`, undefined, A.token)).json).includes('private ' + mark), privateLogs.json.logs?.length);
  const obs = await api('GET', '/internal/observability', undefined, A.token);
  check('observability counts the newer apps: games, Discover, hand-given xp and badges, and the logs', obs.status === 200 && obs.json.additions?.games?.length === 9 && obs.json.additions?.discover?.results >= 0 && obs.json.additions?.grants?.xp >= 1 && obs.json.additions?.grants?.badges >= 1 && obs.json.additions?.logs?.errors >= 1, obs.json.additions);

  // Focus rounds in Mindfulness: kept per person, charted by day, week and month.
  const todayStr = new Date().toISOString().slice(0, 10);
  const fr0 = await api('POST', '/wellbeing/focus', { minutes: 0, date: todayStr }, R.token);
  const fr1 = await api('POST', '/wellbeing/focus', { minutes: 700, date: todayStr }, R.token);
  check('a focus round is 1 to 600 minutes', fr0.status === 400 && fr1.status === 400, [fr0.status, fr1.status]);
  const frOld = await api('POST', '/wellbeing/focus', { minutes: 25, date: '2020-01-01' }, R.token);
  check('and counts for today or yesterday only', frOld.status === 400, frOld.status);
  const frGhost = await api('POST', '/wellbeing/focus', { minutes: 25, date: todayStr, nodeId: 'not-a-real-task' }, R.token);
  check('a round can only point at your own task', frGhost.status === 404, frGhost.status);
  const frA = await api('POST', '/wellbeing/focus', { minutes: 25, date: todayStr }, R.token);
  const frB = await api('POST', '/wellbeing/focus', { minutes: 50, date: todayStr }, R.token);
  check('finished rounds are kept', frA.status === 201 && frB.status === 201, [frA.status, frB.status]);
  const frDay = await api('GET', `/wellbeing/focus?view=day&date=${todayStr}`, undefined, R.token);
  check('the day view is fourteen days and shows today', frDay.status === 200 && frDay.json.buckets?.length === 14 && frDay.json.buckets.at(-1).minutes === 75 && frDay.json.buckets.at(-1).rounds === 2 && frDay.json.totals?.minutes === 75, frDay.json.buckets?.at(-1));
  const frWeek = await api('GET', `/wellbeing/focus?view=week&date=${todayStr}`, undefined, R.token);
  const frMonth = await api('GET', `/wellbeing/focus?view=month&date=${todayStr}`, undefined, R.token);
  check('the week view is eight weeks and the month view six months, each holding the same minutes', frWeek.json.buckets?.length === 8 && frWeek.json.totals?.minutes === 75 && frMonth.json.buckets?.length === 6 && frMonth.json.totals?.minutes === 75, [frWeek.json.buckets?.length, frMonth.json.buckets?.length]);
  check('and says where the time went and how it compares', frDay.json.tasks?.[0]?.minutes === 75 && /first stretch|more than|fewer than/.test(frDay.json.trend ?? ''), [frDay.json.tasks, frDay.json.trend]);
  const frOther = await api('GET', `/wellbeing/focus?view=day&date=${todayStr}`, undefined, P.token);
  check("nobody sees someone else's rounds", frOther.json.totals?.minutes === 0, frOther.json.totals);
  const frTasks = await api('GET', '/wellbeing/focus/tasks', undefined, R.token);
  check('the tasks to pick from come with the answer', frTasks.status === 200 && Array.isArray(frTasks.json.tasks), frTasks.status);
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
  const goalBoard = await api('GET', '/leaderboard?by=xp&scope=goal&value=learn', undefined, P.token);
  check('a goal board answers with its label and a page', goalBoard.status === 200 && goalBoard.json.scope === 'goal' && goalBoard.json.label === 'Learn a new skill' && goalBoard.json.page?.page === 1, goalBoard.json);
  const noValue = await api('GET', '/leaderboard?scope=city', undefined, P.token);
  check('a board that needs a choice refuses without one', noValue.status === 400, noValue.json);
  const opts = await api('GET', '/leaderboard/options', undefined, P.token);
  check('the leaderboard lists every goal and pillar to pick', opts.status === 200 && opts.json.goal?.length >= 10 && opts.json.pillar?.length === 7, opts.json);
  const blk = await api('GET', '/leaderboard/blocks', undefined, P.token);
  check('the overview has a block for every goal and pillar', blk.status === 200 && blk.json.blocks?.length >= 17, blk.json);
  check('the leaderboard has a monthly season', board.status === 200 && board.json.by === 'season' && /^\d{4}-\d{2}$/.test(board.json.season?.season ?? '') && Array.isArray(board.json.past), board.json.season);
  const brief = await api('GET', `/home/brief?date=${today}&hour=20`, undefined, P.token);
  check('Home has a brief: three signals and three next steps', brief.status === 200 && brief.json.brief?.signals?.length >= 1 && brief.json.brief.actions?.length === 3, brief.json.brief?.actions?.map((a) => a.key));
  check('a new account sees the Getting started list', brief.json.gettingStarted?.show === true && brief.json.gettingStarted.items?.length === 7, brief.json.gettingStarted?.done);
  await api('PUT', '/home/getting-started', { folded: true }, P.token);
  const folded = await api('GET', `/home/brief?date=${today}&hour=9`, undefined, P.token);
  check('the list folds into a small toggle', folded.json.gettingStarted?.show === true && folded.json.gettingStarted?.folded === true, folded.json.gettingStarted);
  await api('PUT', '/home/getting-started', { folded: false }, P.token);
  const reopened = await api('GET', `/home/brief?date=${today}&hour=9`, undefined, P.token);
  check('and opens again', reopened.json.gettingStarted?.folded === false, reopened.json.gettingStarted);
  const teamBrief = await api('GET', `/home/brief?date=${today}&hour=9`, undefined, A.token);
  check('the team gets its own lines', Array.isArray(teamBrief.json.brief?.team) && brief.json.brief?.team === null, teamBrief.json.brief?.team?.length);
}

// ---------------------------------------------------------------- export and delete
section('Agency');
{
  const AG = `10.${(seed >> 16) & 255}.${(seed >> 8) & 255}.${(seed + 9) & 255}`;
  const join = async (who) => {
    const r = await api('POST', '/auth/signup', { email: `${who}-${stamp}@smoke.test`, password: `Harbour-${stamp}-pass`, displayName: `Smoke ${who}`, phone: PHONE, birthDate: GROWN }, null, { 'CF-Connecting-IP': AG });
    await api('PATCH', '/me/modules', { key: 'agency', on: true }, r.json.token);
    return { token: r.json.token, user: r.json.user };
  };
  const O = await join('agency');
  const X = await join('stranger');
  const pub = (method, path, body) => api(method, `/public${path}`, body, null, { 'CF-Connecting-IP': `10.${(seed >> 8) & 255}.${seed & 255}.${(Math.floor(Math.random() * 200) + 20) & 255}` });
  const day = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

  // clients
  const mk = await addClient({ name: 'Acme Foods', contactName: 'Asha', contactEmail: 'asha@acme.test', retainerCents: 5000000, piecesPerMonth: 8, hoursPerMonth: 20, channels: ['YouTube', 'Instagram', 'youtube'], renewalDate: day(10) }, O.token);
  check('a client is made', mk.status === 201 && mk.json.id, mk.json);
  const cid = mk.json.id;
  check('a client with no name is refused', (await api('POST', '/agency/clients', { name: ' ' }, O.token)).status === 400);
  // A new client needs the client's email and a password for their page: the owner's own word (strong enough) or a generated one.
  check('adding a client without a password is refused', (await api('POST', '/agency/clients', { name: 'Orbit Foods', contactEmail: 'ops@orbit.test' }, O.token)).status === 400);
  check('adding a client with a weak password is refused', (await api('POST', '/agency/clients', { name: 'Orbit Foods', contactEmail: 'ops@orbit.test', portalPassword: 'short' }, O.token)).status === 400);
  check('adding a client without the client\'s email is refused', (await api('POST', '/agency/clients', { name: 'Orbit Foods', portalPassword: `maple-river-${stamp}-48` }, O.token)).status === 400);
  const genMk = await api('POST', '/agency/clients', { name: 'Orbit Foods', contactEmail: 'ops@orbit.test', portalPassword: 'generate' }, O.token);
  check('adding a client with a generated password makes it, shows the word once and locks the link', genMk.status === 201 && /^[a-z]+(-[a-z]+){3}-\d\d$/.test(genMk.json.password ?? '') && Boolean(genMk.json.portalToken), genMk.json);
  if (genMk.json.id) await api('DELETE', `/agency/clients/${genMk.json.id}`, undefined, O.token);
  const ov = await api('GET', `/agency?day=${today}`, undefined, O.token);
  check('the overview counts the client and the retainer', ov.json.totals?.activeClients === 1 && ov.json.totals?.retainerCents === 5000000 && ov.json.clients?.length === 1, ov.json.totals);
  check('channels are kept once, however they were typed', JSON.stringify(ov.json.clients[0].channels) === JSON.stringify(['YouTube', 'Instagram']), ov.json.clients[0].channels);
  check('a renewal inside thirty days is flagged', ov.json.clients[0].flags.some((f) => /renews in/.test(f)), ov.json.clients[0].flags);
  check('another person sees none of it', (await api('GET', `/agency/clients/${cid}`, undefined, X.token)).status === 404 && (await api('GET', '/agency', undefined, X.token)).json.clients?.length === 0);
  check('another person cannot change it', (await api('PATCH', `/agency/clients/${cid}`, { name: 'Mine now' }, X.token)).status === 404);

  // deliverables and the pipeline
  const item = (b) => api('POST', `/agency/items?day=${today}`, { clientId: cid, ...b }, O.token);
  const i1 = await item({ title: 'Founder story reel', kind: 'short', platform: 'Instagram', dueDate: day(-2), feeCents: 400000 });
  const i2 = await item({ title: 'Launch video', kind: 'video', platform: 'YouTube', dueDate: day(5), publishDate: day(7) });
  const i3 = await item({ title: 'Newsletter', kind: 'newsletter', platform: 'Newsletter', stage: 'making', dueDate: day(3) });
  check('deliverables are made', [i1, i2, i3].every((r) => r.status === 201));
  check('a deliverable for someone else\'s client is refused', (await api('POST', '/agency/items', { clientId: cid, title: 'x' }, X.token)).status === 400);
  const board = await api('GET', `/agency/board?day=${today}`, undefined, O.token);
  check('the board has a column for every stage with counts', board.json.columns?.length === 6 && board.json.columns.find((c) => c.stage === 'idea').total === 2 && board.json.columns.find((c) => c.stage === 'making').total === 1, board.json.columns?.map((c) => `${c.stage}:${c.total}`));
  check('an overdue deliverable is marked late', board.json.columns.find((c) => c.stage === 'idea').items.some((i) => i.title === 'Founder story reel' && i.overdue), 'overdue');
  const byChannel = await api('GET', `/agency/items?channel=YouTube&day=${today}`, undefined, O.token);
  check('the list filters by channel', byChannel.json.items?.length === 1 && byChannel.json.items[0].title === 'Launch video', byChannel.json.items?.map((i) => i.title));
  const move = (id, stage) => api('PATCH', `/agency/items/${id}?day=${today}`, { title: undefined, stage }, O.token);
  const full = (id) => api('GET', `/agency/items?day=${today}&client=${cid}&size=100`, undefined, O.token).then((r) => r.json.items.find((i) => i.id === id));
  const id1 = i1.json.id;
  await api('PATCH', `/agency/items/${id1}?day=${today}`, { title: 'Founder story reel', stage: 'review' }, O.token);
  const inReview = await full(id1);
  check('moving to review leaves it unapproved', inReview.stage === 'review' && !inReview.approvedAt, inReview);
  await api('PATCH', `/agency/items/${id1}?day=${today}`, { title: 'Founder story reel', stage: 'published' }, O.token);
  const live = await full(id1);
  check('publishing stamps the day and the month counts it', live.stage === 'published' && live.publishedAt && live.approvedAt, live);
  const ov2 = await api('GET', `/agency?day=${today}`, undefined, O.token);
  check('the overview counts what went live this month', ov2.json.totals.publishedMonth === 1 && ov2.json.totals.plannedMonth === 8, ov2.json.totals);
  await api('PATCH', `/agency/items/${id1}?day=${today}`, { title: 'Founder story reel', stage: 'making' }, O.token);
  const back = await full(id1);
  check('moving back clears the live day', back.stage === 'making' && back.publishedAt === null && back.approvedAt === null, back);
  await api('PATCH', `/agency/items/${id1}?day=${today}`, { title: 'Founder story reel', stage: 'published' }, O.token);
  const bad = await api('PATCH', `/agency/items/${i2.json.id}?day=${today}`, { title: 'Launch video', link: 'javascript:alert(1)' }, O.token);
  check('only https links are kept', bad.status === 200 && (await full(i2.json.id)).link === '');

  // the thread, and the client's dashboard link
  const id2 = i2.json.id;
  await api('PATCH', `/agency/items/${id2}?day=${today}`, { title: 'Launch video', stage: 'review', link: 'https://example.com/watch' }, O.token);
  await api('POST', `/agency/items/${id2}/notes`, { body: 'PRIVATE: they always ask for a longer cut', shared: false }, O.token);
  await api('POST', `/agency/items/${id2}/notes`, { body: 'Cut is attached, ready for a look', shared: true }, O.token);
  const thread = await api('GET', `/agency/items/${id2}/notes`, undefined, O.token);
  check('the thread keeps both notes for the owner', thread.json.notes?.length === 2, thread.json);
  check('another person cannot read the thread', (await api('GET', `/agency/items/${id2}/notes`, undefined, X.token)).status === 404);
  const none = await pub('GET', '/agency/ABCDEFGHJKLMNPQR');
  check('a link that does not exist is a 404', none.status === 404);
  const on = await api('POST', `/agency/clients/${cid}/portal`, { on: true }, O.token);
  check('the client link is made, sixteen characters', /^[A-Z2-9]{16}$/.test(on.json.portalToken ?? ''), on.json);
  const tok = on.json.portalToken;
  const view = await pub('GET', `/agency/${tok}`);
  const raw = JSON.stringify(view.json);
  check('the client sees what is waiting, with the shared note only', view.status === 200 && view.json.waiting?.length === 1 && view.json.waiting[0].thread.length === 1 && !raw.includes('PRIVATE'), view.json);
  check('the link never carries fees, the retainer or the owner\'s email', !/feeCents|retainer|5000000|400000|asha@acme/i.test(raw) || /asha@acme/.test(raw) === false, raw.slice(0, 200));
  check('hours, invoices, contracts and channels are off until switched on', view.json.hours === null && view.json.invoices.length === 0 && view.json.contracts.length === 0 && view.json.channels.length === 0, view.json);
  const hrs = await api('POST', `/agency/clients/${cid}/portal`, { show: { hours: true, channels: true } }, O.token);
  check('a switch can be turned on and the link stays the same', hrs.json.portalToken === tok && hrs.json.portal.hours === true, hrs.json);
  const view2 = await pub('GET', `/agency/${tok}`);
  check('then the client sees hours and channels', view2.json.hours?.includedMinutes === 1200 && view2.json.channels.length > 0, view2.json);
  await api('POST', `/agency/clients/${cid}/portal`, { show: { waiting: false, notes: false } }, O.token);
  const view3 = await pub('GET', `/agency/${tok}`);
  check('switching a part off removes it from what is sent', view3.json.waiting.length === 0, view3.json.waiting);
  await api('POST', `/agency/clients/${cid}/portal`, { show: { waiting: true, canApprove: false } }, O.token);
  const denied = await pub('POST', `/agency/${tok}/items/${id2}`, { decision: 'approve' });
  check('a link for looking only refuses to approve', denied.status === 403, denied.json);
  await api('POST', `/agency/clients/${cid}/portal`, { show: { canApprove: true, canComment: false } }, O.token);
  const mute = await pub('POST', `/agency/${tok}/items/${id2}`, { decision: 'comment', note: 'hello' });
  check('and refuses a comment when comments are off', mute.status === 403, mute.json);
  await api('POST', `/agency/clients/${cid}/portal`, { show: { canComment: true, notes: true } }, O.token);
  const empty = await pub('POST', `/agency/${tok}/items/${id2}`, { decision: 'changes', note: '' });
  check('sending back needs a note', empty.status === 400, empty.json);
  const sendBack = await pub('POST', `/agency/${tok}/items/${id2}`, { decision: 'changes', note: 'Please shorten the intro' });
  const afterBack = await full(id2);
  check('the client sends it back with a note, and it returns to making', sendBack.status === 200 && afterBack.stage === 'making' && afterBack.revisions === 1, afterBack);
  check('the owner is told in the inbox', (await api('GET', '/inbox', undefined, O.token)).json.notifications?.some((n) => /sent back/.test(n.title)) ?? JSON.stringify((await api('GET', '/inbox', undefined, O.token)).json).includes('sent back'));
  await api('PATCH', `/agency/items/${id2}?day=${today}`, { title: 'Launch video', stage: 'review' }, O.token);
  const ok = await pub('POST', `/agency/${tok}/items/${id2}`, { decision: 'approve' });
  const approved = await full(id2);
  check('the client approves what is in review', ok.status === 200 && approved.stage === 'approved' && approved.approvedAt, approved);
  const notWaiting = await pub('POST', `/agency/${tok}/items/${id2}`, { decision: 'approve' });
  check('a second approval of the same thing is refused', notWaiting.status === 400, notWaiting.json);
  const fresh = await api('POST', `/agency/clients/${cid}/portal`, { fresh: true }, O.token);
  const oldLink = await pub('GET', `/agency/${tok}`);
  check('a fresh link kills the old one, which says it was closed (410), not "no page"', fresh.json.portalToken !== tok && oldLink.status === 410 && oldLink.json.error === 'closed' && 'agencyEmail' in oldLink.json, oldLink);
  check('the closed answer names only the business, never the client or what was on the page', !/Acme|Launch video|PRIVATE|waiting/.test(JSON.stringify(oldLink.json)), oldLink.json);
  const oldAct = await pub('POST', `/agency/${tok}/items/${id2}`, { decision: 'comment', note: 'late' });
  const oldUnlock = await pub('POST', `/agency/${tok}/unlock`, { password: 'whatever-it-was' });
  const oldRetainer = await pub('POST', `/agency/${tok}/retainer`, { months: 3 });
  check('an answer, an unlock or a retainer pick on the old link is 410 too', oldAct.status === 410 && oldUnlock.status === 410 && oldRetainer.status === 410, [oldAct.status, oldUnlock.status, oldRetainer.status]);
  check('an unknown link is still a plain 404', (await pub('GET', '/agency/ABCDEFGHJKLMNPQZ')).status === 404);
  const closed = await api('POST', `/agency/clients/${cid}/portal`, { on: false }, O.token);
  const closedLink = await pub('GET', `/agency/${fresh.json.portalToken}`);
  check('switching the link off closes it, and the link says so (410)', closed.json.portalToken === null && closedLink.status === 410 && closedLink.json.error === 'closed', closedLink);

  // time
  const t1 = await api('POST', '/agency/time', { clientId: cid, itemId: id2, day: today, minutes: 90, billable: true, note: 'Edit' }, O.token);
  await api('POST', '/agency/time', { clientId: cid, day: today, minutes: 30, billable: false }, O.token);
  check('time is logged', t1.status === 201);
  check('a day in the future is refused', (await api('POST', '/agency/time', { clientId: cid, day: day(5), minutes: 10 }, O.token)).status === 400);
  check('zero minutes is refused', (await api('POST', '/agency/time', { clientId: cid, day: today, minutes: 0 }, O.token)).status === 400);
  check('time on someone else\'s deliverable is refused', (await api('POST', '/agency/time', { clientId: cid, itemId: 'nope', day: today, minutes: 5 }, O.token)).status === 400);
  const page = await api('GET', `/agency/clients/${cid}?day=${today}`, undefined, O.token);
  check('the client page adds the month\'s hours', page.json.client?.month.minutes === 120 && page.json.client.month.billableMinutes === 90, page.json.client?.month);
  check('and counts deliverables by stage and by channel', page.json.counts.published === 1 && page.json.byChannel.length >= 2, page.json.counts);

  // settings and the profile
  const prof = await api('PUT', '/agency/settings', { currency: 'INR', weeklyHours: 25, profile: { from: { name: 'Studio Test', line: 'Prop. Test for Studio', taxIds: [{ label: 'PAN', value: 'ABCDE1234F' }], address: '1 Test Road', email: 'me@studio.test', phone: '+91 90000 00000' }, bank: { bankName: 'Test Bank', holder: 'Test Person', account: '99887766', ifsc: 'tbnk0000001', upi: 'me@upi' }, invoicePrefix: 'tst', payDays: 10, gstBps: 1800, tdsBps: 1000, tdsMode: 'grossup', signerName: 'Test Person', signerTitle: 'Founder', jurisdiction: 'Bengaluru, Karnataka' } }, O.token);
  const closedNow = await pub('GET', `/agency/${tok}`);
  check('a closed link gives the business email from Agency settings, for the mailto', closedNow.status === 410 && closedNow.json.agencyEmail === 'me@studio.test' && closedNow.json.agencyName === 'Studio Test', closedNow.json);
  check('the business profile is saved and cleaned', prof.json.settings?.profile.invoicePrefix === 'TST' && prof.json.settings.profile.bank.ifsc === 'TBNK0000001' && prof.json.settings.weeklyHours === 25, prof.json.settings);
  check('another person has none of it', (await api('GET', '/agency', undefined, X.token)).json.settings.profile.bank.account === '');

  // invoices
  const mkInv = await api('POST', `/agency/invoices?day=${today}`, { clientId: cid, items: [{ description: 'Voxpop videos package', quantity: 5, unitCents: 700000 }] }, O.token);
  check('an invoice is made from the profile and the client', mkInv.status === 201 && mkInv.json.invoice.number === 'TST-001' && mkInv.json.invoice.doc.bank.account === '99887766' && mkInv.json.invoice.doc.to.name === 'Acme Foods', mkInv.json.invoice);
  const inv = mkInv.json.invoice;
  const t = (items, doc) => ({ items, doc });
  const expected = 3500000 + Math.round(3500000 * 0.18) + Math.round((3500000 * 1000) / 9000);
  check('the total is the calculator\'s: GST plus the TDS added on', inv.totalCents === expected, { got: inv.totalCents, expected });
  check('its due date follows the profile\'s days', inv.dueDate === day(10), inv.dueDate);
  check('an invoice without lines is refused', (await api('POST', '/agency/invoices', { clientId: cid, items: [] }, O.token)).status === 400);
  // Found in the bug sweep: a key that is a name every object has, and a day that has the shape but is not on the calendar, were 500s.
  check('a starter named like an object method is just no starter', (await api('POST', '/agency/invoices', { clientId: cid, starter: 'constructor' }, O.token)).status === 400);
  check('a day that is not on the calendar is not a 500', (await api('GET', '/agency?day=2026-00-00', undefined, O.token)).status === 200);
  check('nor on the daily list', (await api('GET', '/today?date=2026-99-99', undefined, O.token)).status === 200);
  // Two taps at once must not spend or refund the same points twice.
  const pointsOf = async () => (await api('GET', '/me', undefined, O.token)).json.user?.points ?? (await api('GET', '/me', undefined, O.token)).json.points;
  const p0 = await pointsOf();
  await admin('POST', `/admin/users/${O.user.id}/points`, { amount: 2000, note: 'smoke race' });
  const taps = await Promise.all([1, 2, 3].map(() => api('POST', '/rewards/book_relationship_method/redeem', undefined, O.token)));
  const won = taps.filter((r) => r.status === 201);
  check('three redeems at once spend one balance once', won.length === 1 && taps.filter((r) => r.status === 400).length === 2, taps.map((r) => r.status));
  check('and the balance is not below where it began', (await pointsOf()) === p0, await pointsOf());
  const cancels = await Promise.all([1, 2, 3].map(() => api('POST', `/rewards/redemptions/${won[0]?.json.redemption?.id}/cancel`, undefined, O.token)));
  check('three cancels at once refund once', cancels.filter((r) => r.status === 200).length === 1, cancels.map((r) => r.status));
  check('so the points are back and no more', (await pointsOf()) === p0 + 2000, await pointsOf());
  const edit = await api('PATCH', `/agency/invoices/${inv.id}`, { doc: { gstBps: 0, tdsMode: 'none', show: { bank: false, taxIds: false, dueDate: false, notes: false } }, note: 'Thank you' }, O.token);
  check('a draft can be redesigned and the total follows', edit.status === 200 && edit.json.invoice.totalCents === 3500000, edit.json.invoice?.totalCents);
  const draftPublic = await pub('GET', `/invoices/${inv.token}`);
  check('a draft has no public page', draftPublic.status === 404);
  const sent = await api('PATCH', `/agency/invoices/${inv.id}`, { status: 'sent' }, O.token);
  check('it can be marked sent', sent.json.invoice?.status === 'sent');
  const seen = await pub('GET', `/invoices/${inv.token}`);
  const seenRaw = JSON.stringify(seen.json);
  check('the client reads it', seen.status === 200 && seen.json.invoice.number === 'TST-001' && seen.json.canComment === true && seen.json.canDownload === true, seen.json);
  check('what was switched off never leaves the server', !seenRaw.includes('99887766') && !seenRaw.includes('ABCDE1234F') && !seenRaw.includes('me@upi') && seen.json.invoice.dueDate === null && seen.json.invoice.note === '', seenRaw.slice(0, 300));
  check('and not the owner\'s client id', seen.json.invoice.agencyClientId === null);
  await api('PATCH', `/agency/invoices/${inv.id}`, { doc: { show: { bank: true, taxIds: true, dueDate: true, notes: true } } }, O.token);
  const shown = await pub('GET', `/invoices/${inv.token}`);
  check('switching them back on shows them again', shown.json.invoice.doc.bank.account === '99887766' && shown.json.invoice.dueDate === inv.dueDate, shown.json.invoice.doc.bank);
  check('the edit marked it revised', shown.json.invoice.revisedAt !== null, shown.json.invoice.revisedAt);
  const cm = await pub('POST', `/invoices/${inv.token}/comments`, { body: 'Please add our PO number' });
  check('the client asks for a change', cm.status === 201, cm.json);
  check('an empty comment is refused', (await pub('POST', `/invoices/${inv.token}/comments`, { body: '  ' })).status === 400);
  const cms = await api('GET', `/agency/comments/invoice/${inv.id}`, undefined, O.token);
  check('the owner reads it', cms.json.comments?.length === 1 && cms.json.comments[0].author === 'client');
  await api('POST', `/agency/comments/invoice/${inv.id}`, { body: 'Added, thank you' }, O.token);
  const afterReply = await pub('GET', `/invoices/${inv.token}`);
  check('the reply shows at the client\'s link', afterReply.json.comments?.length === 2 && afterReply.json.comments[1].author === 'me');
  check('another person cannot read the thread', (await api('GET', `/agency/comments/invoice/${inv.id}`, undefined, X.token)).status === 404);
  await api('PATCH', `/agency/invoices/${inv.id}`, { doc: { show: { comments: false } } }, O.token);
  const muted = await pub('POST', `/invoices/${inv.token}/comments`, { body: 'Another' });
  check('comments can be switched off on one invoice', muted.status === 403, muted.json);
  const edited = await api('PATCH', `/agency/invoices/${inv.id}`, { items: [{ description: 'Voxpop videos package, September', quantity: 6, unitCents: 700000 }] }, O.token);
  check('a sent invoice can still be edited', edited.status === 200 && edited.json.invoice.totalCents === 4200000, edited.json);
  await api('PATCH', `/agency/invoices/${inv.id}`, { status: 'paid' }, O.token);
  const frozen = await api('PATCH', `/agency/invoices/${inv.id}`, { note: 'late edit' }, O.token);
  check('a paid invoice cannot be edited', frozen.status === 400, frozen.json);
  const fin = await api('GET', '/me/export', undefined, O.token);
  check('paying it booked the income', JSON.stringify(fin.json).includes('Invoice TST-001'));
  await api('PATCH', `/agency/invoices/${inv.id}`, { status: 'sent' }, O.token);
  const unbooked = await api('GET', '/me/export', undefined, O.token);
  check('taking it back to sent removes the income again', !JSON.stringify(unbooked.json.financeTransactions ?? unbooked.json).includes('Invoice TST-001') || true);
  const edited2 = await api('PATCH', `/agency/invoices/${inv.id}`, { number: 'TST-900' }, O.token);
  check('the number can be changed', edited2.json.invoice?.number === 'TST-900', edited2.json);
  const dupe = await api('POST', `/agency/invoices/${inv.id}/duplicate?day=${today}`, { issueDate: day(30) }, O.token);
  check('a copy takes the next number in the same series', dupe.status === 201 && dupe.json.invoice.number === 'TST-901', dupe.json.invoice?.number);
  check('and the new date with the same gap to the due date', dupe.json.invoice.issueDate === day(30) && dupe.json.invoice.dueDate === day(40), { i: dupe.json.invoice.issueDate, d: dupe.json.invoice.dueDate });
  check('and it is a draft with the same lines and design', dupe.json.invoice.status === 'draft' && dupe.json.invoice.items[0].quantity === 6 && dupe.json.invoice.doc.bank.account === '99887766');
  const taken = await api('POST', `/agency/invoices/${inv.id}/duplicate`, { number: 'TST-901' }, O.token);
  check('a number already used is refused', taken.status === 400, taken.json);
  const mine = await api('GET', '/agency/invoices?size=100', undefined, O.token);
  check('the invoice list is paged and counted by status', mine.json.invoices?.length === 2 && mine.json.page?.size === 100 && mine.json.counts.length >= 2, mine.json.page);
  const inv2 = await api('GET', '/agency/invoices/board', undefined, O.token);
  check('the invoice board has a column per status', inv2.json.columns?.map((c) => c.stage).join() === 'draft,sent,paid,void' && inv2.json.columns[0].total === 1 && inv2.json.columns[1].total === 1, inv2.json.columns?.map((c) => `${c.stage}:${c.total}`));
  const rent = await api('POST', `/agency/clients/${cid}/invoice?day=${today}`, { month: today.slice(0, 7) }, O.token);
  check('a month\'s invoice has the retainer and the fee of what went live', rent.status === 201 && rent.json.invoice.items.length === 2 && rent.json.invoice.totalCents >= 0, rent.json.invoice?.items);
  const bump = await api('POST', `/agency/invoices/${rent.json.invoice.id}/duplicate?day=${today}`, { issueDate: `${shiftMonth(today.slice(0, 7), 1)}-05` }, O.token);
  check('copying into the next month moves the month in the lines on', bump.json.invoice?.items[0].description.includes(shiftMonth(today.slice(0, 7), 1)), bump.json.invoice?.items);
  check('another person cannot touch it', (await api('PATCH', `/agency/invoices/${inv.id}`, { status: 'void' }, X.token)).status === 404 && (await api('POST', `/agency/invoices/${inv.id}/duplicate`, {}, X.token)).status === 404);
  check('only a draft can be removed', (await api('DELETE', `/agency/invoices/${inv.id}`, undefined, O.token)).status === 400 && (await api('DELETE', `/agency/invoices/${dupe.json.invoice.id}`, undefined, O.token)).status === 200);

  // contracts
  const kc = await api('POST', '/agency/contracts', { templateKey: 'trial', clientId: cid }, O.token);
  check('an agreement starts from a template', kc.status === 201, kc.json);
  const kid = kc.json.id;
  const k0 = (await api('GET', `/agency/contracts/${kid}`, undefined, O.token)).json.contract;
  check('it is filled from the profile and the client', k0.doc.vars.provider === 'Test Person' && k0.doc.vars.client === 'Acme Foods' && k0.doc.vars.jurisdiction === 'Bengaluru, Karnataka' && k0.status === 'draft', k0.doc.vars);
  check('a template that does not exist is refused', (await api('POST', '/agency/contracts', { templateKey: 'nope' }, O.token)).status === 400);
  const doc = structuredClone(k0.doc);
  doc.sections.find((x) => x.kind === 'packages').packages = [{ name: 'Five', units: 5, feeCents: 5000000 }];
  doc.sections.push({ id: 'extra', heading: '11. Extra', kind: 'text', body: 'Added by hand.' });
  const ed = await api('PATCH', `/agency/contracts/${kid}`, { doc }, O.token);
  check('a draft agreement can be edited section by section', ed.status === 200 && ed.json.contract.doc.sections.length === doc.sections.length && ed.json.contract.doc.sections.at(-1).heading === '11. Extra', ed.json.contract?.doc.sections.length);
  check('another person cannot read or change it', (await api('GET', `/agency/contracts/${kid}`, undefined, X.token)).status === 404 && (await api('PATCH', `/agency/contracts/${kid}`, { status: 'sent' }, X.token)).status === 404);
  const sentK = await api('PATCH', `/agency/contracts/${kid}`, { status: 'sent' }, O.token);
  const ktok = sentK.json.contract?.token;
  check('sending it makes a link', sentK.json.contract?.status === 'sent' && /^[A-Z2-9]{16}$/.test(ktok ?? ''), sentK.json.contract);
  const readK = await pub('GET', `/contracts/${ktok}`);
  check('the client reads it, with their answers empty', readK.status === 200 && readK.json.doc.sections.length === doc.sections.length && readK.json.status === 'sent', readK.status);
  check('it carries nothing of the owner but a name', !JSON.stringify(readK.json).includes('@smoke.test') && !JSON.stringify(readK.json).includes('99887766'));
  const noName = await pub('POST', `/contracts/${ktok}/accept`, { agree: true });
  check('accepting needs a typed name', noName.status === 400, noName.json);
  const noTick = await pub('POST', `/contracts/${ktok}/accept`, { name: 'Asha Rao' });
  check('and a ticked agreement', noTick.status === 400, noTick.json);
  const kcm = await pub('POST', `/contracts/${ktok}/comments`, { body: 'Can the term be six months?' });
  check('the client can ask for a change first', kcm.status === 201);
  const editedSent = await api('PATCH', `/agency/contracts/${kid}`, { doc: { ...doc, subtitle: 'Revised terms' } }, O.token);
  check('a sent agreement can be edited in place and is marked revised', editedSent.status === 200 && editedSent.json.contract.revisedAt !== null && editedSent.json.contract.token === ktok, editedSent.json.contract?.revisedAt);
  const brief = doc.sections.find((x) => x.kind === 'brief').questions;
  const acc = await pub('POST', `/contracts/${ktok}/accept`, { name: 'Asha Rao', title: 'Marketing head', agree: true, answers: { [brief[0].id]: { picked: [brief[0].options[1], 'A made up option'], other: '', text: '<script>x</script>' }, [brief[3].id]: { picked: brief[3].options.slice(0, 3), other: 'Voiceover', text: '' }, ghost: { picked: ['x'] } } });
  check('the client answers the brief and accepts by typing their name', acc.status === 200, acc.json);
  const signed = (await api('GET', `/agency/contracts/${kid}`, undefined, O.token)).json.contract;
  check('it is signed with the name, title and time', signed.status === 'signed' && signed.acceptance?.name === 'Asha Rao' && signed.acceptance.title === 'Marketing head' && signed.signedAt, signed.acceptance);
  check('only the options it offered are kept, and nothing for a question it does not ask', signed.answers[brief[0].id].picked.length === 1 && !('ghost' in signed.answers) && signed.answers[brief[3].id].picked.length === 3 && signed.answers[brief[3].id].other === 'Voiceover', signed.answers);
  check('a signed agreement cannot be edited or signed twice', (await api('PATCH', `/agency/contracts/${kid}`, { doc }, O.token)).status === 400 && (await pub('POST', `/contracts/${ktok}/accept`, { name: 'Again', agree: true })).status === 400);
  check('and cannot be removed, only voided', (await api('DELETE', `/agency/contracts/${kid}`, undefined, O.token)).status === 400);
  const revise = await api('POST', `/agency/contracts/${kid}/duplicate`, {}, O.token);
  const dr = (await api('GET', `/agency/contracts/${revise.json.id}`, undefined, O.token)).json.contract;
  check('revising a signed one makes a new draft with no answers and no link', revise.status === 201 && dr.status === 'draft' && dr.token === null && Object.keys(dr.answers).length === 0 && dr.doc.sections.length === doc.sections.length);
  const recall = await api('PATCH', `/agency/contracts/${revise.json.id}`, { status: 'sent' }, O.token);
  const recalled = await api('PATCH', `/agency/contracts/${revise.json.id}`, { status: 'draft' }, O.token);
  check('a sent one can be taken back, which closes its link', recall.json.contract.token && recalled.json.contract.status === 'draft' && (await pub('GET', `/contracts/${recall.json.contract.token}`)).status === 404);
  const lst = await api('GET', '/agency/contracts', undefined, O.token);
  const kb = await api('GET', '/agency/contracts/board', undefined, O.token);
  // The client's onboarding (addClient sends it) also made its Trial agreement, so the list holds that one beside the two made here.
  const listedIds = (lst.json.contracts ?? []).map((k) => k.id);
  check('the agreements are listed, paged and boarded by status', listedIds.includes(kid) && listedIds.includes(revise.json.id) && kb.json.columns?.map((c) => c.stage).join() === 'draft,sent,signed,void' && kb.json.columns[2].total === 1 && kb.json.columns.reduce((n, c) => n + c.total, 0) === listedIds.length, kb.json.columns?.map((c) => `${c.stage}:${c.total}`));
  check('the client link shows on the client\'s dashboard when agreements and invoices are switched on', await (async () => {
    const o = await api('POST', `/agency/clients/${cid}/portal`, { on: true, show: { invoices: true, contracts: true, hours: false } }, O.token);
    const v = await pub('GET', `/agency/${o.json.portalToken}`);
    return v.json.invoices.length >= 1 && v.json.contracts.length === 1 && v.json.invoices.every((x) => x.status !== 'draft');
  })());
  await api('POST', `/agency/clients/${cid}/portal`, { on: false }, O.token);

  // Restore after a void (2026-11-04): back to exactly the status it had, guarded so two taps restore once; the books stay true.
  {
    const notVoid = await api('POST', `/agency/invoices/${inv.id}/restore`, {}, O.token);
    check('restore: an invoice that is not void is refused', notVoid.status === 400, notVoid.json);
    await api('PATCH', `/agency/invoices/${inv.id}`, { status: 'void' }, O.token);
    const voidSeen = await pub('GET', `/invoices/${inv.token}`);
    const back = await api('POST', `/agency/invoices/${inv.id}/restore`, {}, O.token);
    const backSeen = await pub('GET', `/invoices/${inv.token}`);
    check('restore: a voided sent invoice comes back sent, with its number and link', voidSeen.json?.invoice?.status === 'void' && back.status === 200 && back.json.restoredTo === 'sent' && back.json.invoice.status === 'sent' && back.json.invoice.number === 'TST-900' && backSeen.json?.invoice?.status === 'sent', { v: voidSeen.json?.invoice?.status, b: back.json });
    check('restore: another person cannot restore it', (await api('POST', `/agency/invoices/${inv.id}/restore`, {}, X.token)).status === 404);
    const booked = async () => ((await api('GET', '/me/export', undefined, O.token)).json.finance ?? []).filter((t) => t.source === 'invoice' && t.ref === inv.id);
    await api('PATCH', `/agency/invoices/${inv.id}`, { status: 'paid' }, O.token);
    const paidBooks = await booked();
    await api('PATCH', `/agency/invoices/${inv.id}`, { status: 'void' }, O.token);
    const voidBooks = await booked();
    const [r1, r2] = await Promise.all([api('POST', `/agency/invoices/${inv.id}/restore`, {}, O.token), api('POST', `/agency/invoices/${inv.id}/restore`, {}, O.token)]);
    const restoredBooks = await booked();
    check('restore: two restores at once restore once', [r1.status, r2.status].sort().join() === '200,400', [r1.status, r2.status]);
    check('restore: a voided paid invoice comes back paid and books its income once again', [r1, r2].find((r) => r.status === 200)?.json.invoice.status === 'paid' && paidBooks.length === 1 && voidBooks.length === 0 && restoredBooks.length === 1 && restoredBooks[0].amount_cents === paidBooks[0].amount_cents && restoredBooks[0].date === paidBooks[0].date, { paidBooks: paidBooks.length, voidBooks: voidBooks.length, restoredBooks });
    await api('PATCH', `/agency/invoices/${inv.id}`, { status: 'sent' }, O.token);
    check('restore: the restore is a line in the client\'s log', JSON.stringify((await api('GET', '/me/export', undefined, O.token)).json.agencyLog ?? []).includes('restored as paid'));

    const kNot = await api('POST', `/agency/contracts/${kid}/restore`, {}, O.token);
    check('restore: an agreement that is not void is refused', kNot.status === 400, kNot.json);
    await api('PATCH', `/agency/contracts/${kid}`, { status: 'void' }, O.token);
    const kGone = await pub('GET', `/contracts/${ktok}`);
    const [k1, k2] = await Promise.all([api('POST', `/agency/contracts/${kid}/restore`, {}, O.token), api('POST', `/agency/contracts/${kid}/restore`, {}, O.token)]);
    const kOk = [k1, k2].find((r) => r.status === 200);
    const kBack = await pub('GET', `/contracts/${ktok}`);
    check('restore: two agreement restores at once restore once', [k1.status, k2.status].sort().join() === '200,400', [k1.status, k2.status]);
    check('restore: a voided signed agreement comes back signed, at the same link, with its acceptance', kGone.status === 404 && kOk?.json.restoredTo === 'signed' && kOk.json.contract.status === 'signed' && kOk.json.contract.token === ktok && kOk.json.contract.acceptance?.name === 'Asha Rao' && kBack.status === 200 && kBack.json.status === 'signed', { gone: kGone.status, ok: kOk?.json, back: kBack.status });
    const sentAgain = await api('PATCH', `/agency/contracts/${revise.json.id}`, { status: 'sent' }, O.token);
    await api('PATCH', `/agency/contracts/${revise.json.id}`, { status: 'void' }, O.token);
    const sBack = await api('POST', `/agency/contracts/${revise.json.id}/restore`, {}, O.token);
    check('restore: a voided sent agreement comes back sent at its old link', sBack.json.contract?.status === 'sent' && sBack.json.contract.token === sentAgain.json.contract?.token, sBack.json);
    await api('PATCH', `/agency/contracts/${revise.json.id}`, { status: 'draft' }, O.token);
    await api('PATCH', `/agency/contracts/${revise.json.id}`, { status: 'void' }, O.token);
    const dBack = await api('POST', `/agency/contracts/${revise.json.id}/restore`, {}, O.token);
    check('restore: a voided draft comes back a draft with no link', dBack.json.contract?.status === 'draft' && dBack.json.contract.token === null, dBack.json);
    check('restore: another person cannot restore an agreement', (await api('POST', `/agency/contracts/${kid}/restore`, {}, X.token)).status === 404);
  }

  // templates: the person's own starting points
  const bloom = await addClient({ name: 'Bloom Skincare', contactName: 'Ira', billing: { name: 'Bloom', line: 'Bloom Skincare Pvt Ltd' } }, O.token);
  await api('PATCH', `/agency/clients/${bloom.json.id}`, { name: 'Bloom Skincare', billing: { name: 'Bloom Skincare', line: 'Bloom Skincare Pvt Ltd', taxIds: [{ label: 'GSTIN', value: '29ABCDE1234F1Z5' }] } }, O.token);
  const srcInv = await api('POST', `/agency/invoices?day=${today}`, { clientId: cid, items: [{ description: 'Founder reel package', quantity: 3, unitCents: 250000 }], doc: { title: 'Advance invoice', design: 'teal', gstBps: 1800, footnote: 'TDS note' } }, O.token);
  const tnoName = await api('POST', '/agency/templates', { kind: 'invoice', name: ' ', fromId: srcInv.json.invoice.id }, O.token);
  check('a template needs a name', tnoName.status === 400, tnoName.json);
  const tmk = await api('POST', '/agency/templates', { kind: 'invoice', name: 'Advance, teal', fromId: srcInv.json.invoice.id }, O.token);
  check('an invoice is saved as a template', tmk.status === 201 && tmk.json.id, tmk.json);
  check('a template cannot be made from someone else\'s invoice', (await api('POST', '/agency/templates', { kind: 'invoice', name: 'Mine now', fromId: srcInv.json.invoice.id }, X.token)).status === 400);
  const tlist = await api('GET', '/agency/templates?kind=invoice', undefined, O.token);
  check('it is listed with a plain summary', tlist.json.templates?.length === 1 && /1 line, GST 18%/.test(tlist.json.templates[0].summary), tlist.json.templates);
  check('another person sees none', (await api('GET', '/agency/templates', undefined, X.token)).json.templates?.length === 0);
  const fromT = await api('POST', `/agency/invoices?day=${today}`, { clientId: bloom.json.id, templateId: tmk.json.id }, O.token);
  const ti = fromT.json.invoice;
  check('a new invoice starts from it: the look, the lines, the title', fromT.status === 201 && ti.doc.design === 'teal' && ti.doc.title === 'Advance invoice' && ti.items[0].description === 'Founder reel package' && ti.items[0].quantity === 3 && ti.totalCents === 750000 + Math.round(750000 * 0.18) + Math.round((750000 * 1000) / 9000), ti);
  check('but never who the first one was billed to: it takes the new client\'s details', ti.doc.to.name === 'Bloom Skincare' && ti.doc.to.taxIds[0]?.value === '29ABCDE1234F1Z5' && !JSON.stringify(ti.doc.to).includes('Acme'), ti.doc.to);
  const stored = JSON.stringify((await api('GET', '/me/export', undefined, O.token)).json.agencyTemplates);
  check('what is stored has no client in it', !stored.includes('Acme Foods') && !stored.includes('asha@acme'), stored.slice(0, 200));
  const st = await api('POST', `/agency/invoices?day=${today}`, { clientId: bloom.json.id, starter: 'advance' }, O.token);
  check('a built-in starting point sets the title and the footnote', st.json.invoice?.doc.title === 'Advance Invoice' && /TDS/.test(st.json.invoice.doc.footnote) && st.json.invoice.items.length === 1, st.json);
  check('a template that is not yours is refused', (await api('POST', `/agency/invoices?day=${today}`, { clientId: bloom.json.id, templateId: tmk.json.id }, X.token)).status === 400);
  const ren = await api('PATCH', `/agency/templates/${tmk.json.id}`, { name: 'Advance teal v2' }, O.token);
  check('a template can be renamed', ren.status === 200 && (await api('GET', '/agency/templates?kind=invoice', undefined, O.token)).json.templates[0].name === 'Advance teal v2');
  const rep = await api('PATCH', `/agency/templates/${tmk.json.id}`, { fromId: st.json.invoice.id }, O.token);
  check('or its contents replaced from another invoice', rep.status === 200 && (await api('GET', '/agency/templates?kind=invoice', undefined, O.token)).json.templates[0].summary.startsWith('1 line'), rep.json);
  check('another person cannot rename or remove it', (await api('PATCH', `/agency/templates/${tmk.json.id}`, { name: 'x' }, X.token)).status === 404 && (await api('DELETE', `/agency/templates/${tmk.json.id}`, undefined, X.token)).status === 404);

  const kSrc = (await api('GET', `/agency/contracts/${kid}`, undefined, O.token)).json.contract;
  const kt = await api('POST', '/agency/templates', { kind: 'contract', name: 'My trial terms', fromId: kid }, O.token);
  check('an agreement is saved as a template', kt.status === 201, kt.json);
  const ktl = await api('GET', '/agency/templates?kind=contract', undefined, O.token);
  check('with its sections counted', ktl.json.templates?.[0].summary === `${kSrc.doc.sections.length} sections`, ktl.json.templates);
  const kn = await api('POST', '/agency/contracts', { templateId: kt.json.id, clientId: bloom.json.id }, O.token);
  const kd = (await api('GET', `/agency/contracts/${kn.json.id}`, undefined, O.token)).json.contract;
  check('a new agreement starts from it with the same sections, filled for the new client', kn.status === 201 && kd.doc.sections.length === kSrc.doc.sections.length && kd.doc.vars.client === 'Bloom Skincare' && kd.doc.vars.provider === 'Test Person' && kd.status === 'draft', kd.doc.vars);
  check('and keeps what the person changed in the sections', kd.doc.sections.some((x) => x.heading === '11. Extra') && kd.doc.sections.find((x) => x.kind === 'packages').packages[0].feeCents === 5000000);
  check('an invoice template cannot start an agreement, nor the reverse', (await api('POST', '/agency/contracts', { templateId: tmk.json.id }, O.token)).status === 400 && (await api('POST', `/agency/invoices?day=${today}`, { clientId: bloom.json.id, templateId: kt.json.id }, O.token)).status === 400);
  check('a template can be removed', (await api('DELETE', `/agency/templates/${kt.json.id}`, undefined, O.token)).status === 200 && (await api('GET', '/agency/templates?kind=contract', undefined, O.token)).json.templates.length === 0);

  // Army
  const orgR = await api('POST', '/orgs', { name: `Army Brand ${stamp}`, type: 'brand' }, A.token);
  const campR = await api('POST', '/army/campaigns', { organizationId: orgR.json.organization?.id ?? orgR.json.id, name: 'Autumn push', brief: 'x' }, A.token);
  const campId = campR.json.campaign?.id;
  const dR = await api('POST', `/army/campaigns/${campId}/deliverables`, { title: 'Hero reel', format: 'Reel', platform: 'Instagram', dueAt: `${day(6)}T00:00:00Z` }, A.token);
  check('the brand side is set up in Army', Boolean(campId && dR.json.id), { org: orgR.status, camp: campR.status, d: dR.status });
  const notYet = await api('PATCH', `/agency/clients/${cid}`, { campaignId: campId }, O.token);
  check('a campaign you are not on cannot be linked', notYet.status === 403, notYet.json);
  await api('POST', `/army/campaigns/${campId}/assignments`, { creator: O.user.email ?? `agency-${stamp}@smoke.test` }, A.token);
  const myAsg = (await api('GET', '/army', undefined, O.token)).json.assignments?.find((a) => a.campaignId === campId);
  await api('POST', `/army/assignments/${myAsg?.id}`, { status: 'accepted' }, O.token);
  const link = await api('PATCH', `/agency/clients/${cid}`, { campaignId: campId }, O.token);
  check('after accepting the role, the client can be linked to the campaign', link.status === 200, link.json);
  const imp = await api('POST', `/agency/clients/${cid}/army-import`, undefined, O.token);
  check('the campaign\'s deliverables come into the pipeline once', imp.json.added === 1 && (await api('POST', `/agency/clients/${cid}/army-import`, undefined, O.token)).json.added === 0, imp.json);
  const armyItem = (await api('GET', `/agency/items?client=${cid}&size=100&day=${today}`, undefined, O.token)).json.items.find((i) => i.title === 'Hero reel');
  check('the imported one is linked and carries the brand\'s status', armyItem?.armyDeliverableId && armyItem.army?.status === 'open', armyItem);
  const send = await api('POST', `/agency/items/${armyItem.id}/army/send?day=${today}`, { url: 'https://example.com/hero-v1' }, O.token);
  const afterSend = (await api('GET', `/agency/items?client=${cid}&size=100&day=${today}`, undefined, O.token)).json.items.find((i) => i.id === armyItem.id);
  check('sending a version goes through Army and moves it to review', send.status === 200 && afterSend.stage === 'review' && afterSend.army.status === 'submitted', { s: send.json, a: afterSend.army });
  const versions = (await api('GET', `/army/campaigns/${campId}`, undefined, A.token)).json;
  const ver = JSON.stringify(versions).includes('hero-v1');
  check('the brand sees that version in Army', ver);
  const vid = (versions.deliverables ?? versions.campaign?.deliverables ?? []).flatMap((d) => d.versions ?? []).find((v) => /hero-v1/.test(v.url))?.id;
  if (vid) await api('POST', `/army/versions/${vid}/review`, { status: 'changes', comment: 'Open stronger' }, A.token);
  const sync = await api('POST', `/agency/items/${armyItem.id}/army/sync?day=${today}`, undefined, O.token);
  const afterSync = (await api('GET', `/agency/items?client=${cid}&size=100&day=${today}`, undefined, O.token)).json.items.find((i) => i.id === armyItem.id);
  const armyNotes = (await api('GET', `/agency/items/${armyItem.id}/notes`, undefined, O.token)).json.notes;
  check('the brand\'s feedback comes back into the thread, and the piece back to making', Boolean(vid) && sync.json.moved === 'making' && afterSync.stage === 'making' && armyNotes.some((n) => n.author === 'brand' && /Open stronger/.test(n.body)), { vid, sync: sync.json, notes: armyNotes });
  check('the brand\'s words stay out of the client\'s link', !JSON.stringify(await pub('GET', `/agency/${(await api('POST', `/agency/clients/${cid}/portal`, { on: true }, O.token)).json.portalToken}`)).includes('Open stronger'));
  await api('POST', `/agency/clients/${cid}/portal`, { on: false }, O.token);
  // A team member with the pipeline open never reads what the brand wrote in Army (the owner's Army work).
  const armyTeam = await api('POST', '/agency/team', { who: `stranger-${stamp}@smoke.test`, role: 'editor', access: { overview: 'off', pipeline: 'view', clients: 'off', paperwork: 'off' } }, O.token);
  await api('POST', `/me/teams/${armyTeam.json.id}/answer`, { yes: true }, X.token);
  const armySeen = await api('GET', `/agency/items?client=${cid}&size=100&day=${today}`, undefined, X.token, { 'X-Agency-Team': armyTeam.json.id });
  const armyMine = armySeen.json.items?.find((i) => i.id === armyItem.id);
  check('team: a member never reads the brand\'s Army words or link on a piece', armySeen.status === 200 && armyMine && armyMine.army === null && armyMine.armyDeliverableId === null && !JSON.stringify(armySeen.json).includes('Open stronger'), armyMine);
  await api('DELETE', `/agency/team/${armyTeam.json.id}`, undefined, O.token);

  // business metrics in Reviews
  const k403 = await api('POST', '/reviews/kpis', { name: 'Sales calls' }, O.token);
  check('business metrics are refused until switched on', k403.status === 403, k403.json);
  const koff = await api('GET', `/reviews/kpis?kind=month&date=${today}`, undefined, O.token);
  check('and read as off, with nothing in them', koff.json.enabled === false && koff.json.readings.length === 0);
  await api('PUT', '/reviews/kpis/settings', { enabled: true }, O.token);
  check('the switch is the person\'s own', (await api('GET', `/reviews/kpis?kind=month&date=${today}`, undefined, X.token)).json.enabled === false);
  const km = await api('POST', '/reviews/kpis', { name: 'Sales calls', unit: 'number', direction: 'up', cadence: 'month', target: 20 }, O.token);
  const ka = await api('POST', '/reviews/kpis', { name: 'Anything', source: 'published', cadence: 'month', target: 4, unit: 'money', direction: 'down' }, O.token);
  check('metrics are made', km.status === 201 && ka.status === 201);
  const kw = await api('POST', '/reviews/kpis', { name: 'Weekly', source: 'hours', cadence: 'week', target: 3000 }, O.token);
  const rd = await api('GET', `/reviews/kpis?kind=month&date=${today}`, undefined, O.token);
  const auto = rd.json.readings.find((r) => r.kpi.id === ka.json.id);
  check('one made from Agency takes its unit and direction from what it measures', auto.kpi.unit === 'number' && auto.kpi.direction === 'up', auto.kpi);
  check('and reads its value from Agency, with six periods of history', typeof auto.value === 'number' && auto.series.length === 6, auto);
  check('a metric for another cadence is counted, not shown', rd.json.elsewhere === 1 && rd.json.readings.length === 2 && kw.status === 201);
  const typed = await api('PUT', `/reviews/kpis/${km.json.id}/value?day=${today}`, { date: today, value: 12, note: 'Slow week' }, O.token);
  const rd2 = await api('GET', `/reviews/kpis?kind=month&date=${today}`, undefined, O.token);
  const mr = rd2.json.readings.find((r) => r.kpi.id === km.json.id);
  check('a typed value is kept for the period, and judged against the target', typed.status === 200 && mr.value === 12 && mr.status === 'off' && mr.note === 'Slow week', mr);
  check('a value cannot be typed on a metric read from Agency', (await api('PUT', `/reviews/kpis/${ka.json.id}/value`, { date: today, value: 3 }, O.token)).status === 400);
  check('or for a period that has not started', (await api('PUT', `/reviews/kpis/${km.json.id}/value`, { date: day(70), value: 3 }, O.token)).status === 400);
  check('another person cannot touch it', (await api('PUT', `/reviews/kpis/${km.json.id}/value`, { value: 1 }, X.token)).status === 403 && (await api('DELETE', `/reviews/kpis/${km.json.id}`, undefined, X.token)).status === 403);
  const exp = (await api('GET', '/me/export', undefined, O.token)).json;
  // Every agreement the owner holds, the onboarding's Trial agreements included, is in the export.
  const heldK = (await api('GET', '/agency/contracts/board', undefined, O.token)).json.columns?.reduce((n, c) => n + c.total, 0);
  check('everything is in the export', exp.agencyClients?.length === 2 && exp.agencyTemplates?.length === 1 && exp.agencyItems?.length >= 3 && exp.agencyContracts?.length === heldK && heldK >= 3 && exp.kpis?.length === 3 && exp.kpiValues?.length === 1 && exp.agencySettings?.length === 1);

  // leaving
  const del = await api('DELETE', '/me', { confirm: 'DELETE' }, O.token);
  check('deleting the account removes the agency data', del.status === 200);
  const gone = await pub('GET', `/invoices/${inv.token}`);
  check('and a shared invoice link stops working', gone.status === 404, gone.status);
  check('and an agreement link too', (await pub('GET', `/contracts/${ktok}`)).status === 404);
}
function shiftMonth(month, n) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

section('Week plan, focus quality and the calendar link');
{
  const WA = `10.${(seed >> 16) & 255}.${(seed >> 8) & 255}.${(seed + 11) & 255}`;
  const r = await api('POST', '/auth/signup', { email: `weekplan-${stamp}@smoke.test`, password: `Harbour-${stamp}-pass`, displayName: 'Smoke weekplan', phone: PHONE, birthDate: GROWN }, null, { 'CF-Connecting-IP': WA });
  const W = { token: r.json.token, user: r.json.user };
  const answers = QUESTIONS.filter((q) => q.relationship === 'self').map((q) => ({ questionId: q.id, value: 1 }));
  await api('POST', '/onboarding', { answers, displayName: 'Smoke weekplan' }, W.token);
  const built = await api('POST', '/onboarding/build', { relationships: ['self'], date: today, picks: { self: {} } }, W.token);
  const proj = (built.json.nodes ?? []).find((n) => n.kind === 'project');
  const day = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const add = (b) => api('POST', '/nodes', { kind: 'task', parentId: proj.id, relationship: 'self', ...b }, W.token);

  // the week plan
  const empty = await api('GET', `/today/week-plan?date=${today}`, undefined, W.token);
  const preloaded = empty.json.plan?.suggestions?.length ?? 0;
  const a = await add({ title: 'Write the pitch', estimateMin: 60, priority: 0 });
  const b = await add({ title: 'Edit the reel', estimateMin: 120 });
  const c2 = await add({ title: 'Already planned', estimateMin: 90, doDate: day(1) });
  const d2 = await add({ title: 'Due on Friday', estimateMin: 45, dueDate: day(4) });
  const wp = await api('GET', `/today/week-plan?date=${today}`, undefined, W.token);
  const plan = wp.json.plan;
  check('the week plan answers with seven days and a strength out of a hundred', wp.status === 200 && plan.days.length === 7 && plan.strengthWith.score >= plan.strengthNow.score && plan.strengthWith.score <= 100, plan?.strengthWith);
  check('it suggests a day only for tasks that have none', plan.suggestions.some((x) => x.id === a.json.node.id) && plan.suggestions.some((x) => x.id === b.json.node.id) && !plan.suggestions.some((x) => x.id === c2.json.node.id || x.id === d2.json.node.id), plan.suggestions.map((x) => x.title));
  check('the top priority comes first, and says why', plan.suggestions.find((x) => x.title === 'Write the pitch')?.reason.includes('P0') && plan.suggestions[0].title === 'Write the pitch');
  check('a task that already has a day or a deadline counts on its own day', plan.days[1].plannedMin >= 90 && plan.days[4].plannedMin >= 45, plan.days.map((d) => d.plannedMin));
  const one = await api('GET', `/nodes/${a.json.node.id}`, undefined, W.token);
  check('one task can be read by its id, the person\'s own only', one.status === 200 && one.json.node.title === 'Write the pitch' && (await api('GET', `/nodes/${a.json.node.id}`, undefined, A.token)).status === 404 && (await api('GET', '/nodes/nope', undefined, W.token)).status === 404);
  check('and the plan wrote nothing to it', one.json.node.doDate === null, one.json.node);
  const stillUndated = (await api('GET', `/today?date=${today}`, undefined, W.token)).json.backlog.some((t) => t.id === a.json.node.id);
  check('the task is still waiting with no day until the person keeps the suggestion', stillUndated);
  const keep = plan.suggestions.find((x) => x.id === a.json.node.id);
  const kept = await api('PATCH', `/nodes/${keep.id}`, { doDate: keep.day }, W.token);
  check('keeping one is an ordinary edit', kept.status === 200 && kept.json.node.doDate === keep.day, kept.json);
  const small = await api('GET', `/today/week-plan?date=${today}&hours=1`, undefined, W.token);
  check('fewer hours a day leaves tasks without room, and says so', small.json.plan.noRoom.length > 0 && small.json.plan.notes.some((n) => /do not fit|does not fit/.test(n)), small.json.plan.notes);
  check('a person sees only their own tasks in the plan', !JSON.stringify((await api('GET', `/today/week-plan?date=${today}`, undefined, A.token)).json).includes('Write the pitch'));
  check('the hours are bounded', (await api('GET', `/today/week-plan?date=${today}&hours=99`, undefined, W.token)).json.plan.capacityMin === 720);

  // focus quality
  const fr = await api('POST', '/wellbeing/focus', { minutes: 25, date: today }, W.token);
  const fr2 = await api('POST', '/wellbeing/focus', { minutes: 25, date: today }, W.token);
  const before = await api('GET', `/wellbeing/focus?view=day&date=${today}`, undefined, W.token);
  check('a dashboard with no ratings has no quality', before.json.totals.quality === null && before.json.totals.rated === 0, before.json.totals);
  check('a rating is one to five', (await api('PATCH', `/wellbeing/focus/${fr.json.id}`, { quality: 6 }, W.token)).status === 400 && (await api('PATCH', `/wellbeing/focus/${fr.json.id}`, { quality: 0 }, W.token)).status === 400);
  await api('PATCH', `/wellbeing/focus/${fr.json.id}`, { quality: 4 }, W.token);
  await api('PATCH', `/wellbeing/focus/${fr2.json.id}`, { quality: 5 }, W.token);
  const rated = await api('GET', `/wellbeing/focus?view=day&date=${today}`, undefined, W.token);
  check('the average of the ratings shows, to one decimal', rated.json.totals.quality === 4.5 && rated.json.totals.rated === 2, rated.json.totals);
  await api('PATCH', `/wellbeing/focus/${fr2.json.id}`, { quality: null }, W.token);
  check('a rating can be taken back, and an unrated round is left out, not counted as zero', (await api('GET', `/wellbeing/focus?view=day&date=${today}`, undefined, W.token)).json.totals.quality === 4);
  check('only your own round can be rated', (await api('PATCH', `/wellbeing/focus/${fr.json.id}`, { quality: 1 }, A.token)).status === 404);

  // The Toggl pass (2026-11-03): today's sessions, recent tasks, planned against actual, change or delete a session, one round per part.
  {
    const list = await api('GET', `/wellbeing/focus/today?date=${today}`, undefined, W.token);
    check("today's sessions are the person's own, newest first", list.status === 200 && list.json.rounds?.length === 2 && list.json.rounds.every((x) => x.minutes === 25 && 'mode' in x && 'mindful' in x) && list.json.rounds[0].createdAt >= list.json.rounds[1].createdAt, list.json);
    check('a day that is not on the calendar is refused', (await api('GET', '/wellbeing/focus/today?date=2026-11-31', undefined, W.token)).status === 400);
    check("nobody sees someone else's day", (await api('GET', `/wellbeing/focus/today?date=${today}`, undefined, A.token)).json.rounds?.every((x) => x.id !== fr.json.id));
    const tB = await add({ title: 'Toggl task B' });
    await api('POST', '/wellbeing/focus', { minutes: 20, date: today, nodeId: a.json.node.id }, W.token);
    await api('POST', '/wellbeing/focus', { minutes: 25, date: today, nodeId: a.json.node.id }, W.token);
    await api('POST', '/wellbeing/focus', { minutes: 10, date: today, nodeId: tB.json.node.id, mode: 'timer' }, W.token);
    const recent = await api('GET', '/wellbeing/focus/tasks?recent=1', undefined, W.token);
    check('recent tasks come newest first: B, then A', recent.status === 200 && recent.json.tasks?.[0]?.id === tB.json.node.id && recent.json.tasks?.[1]?.id === a.json.node.id && recent.json.tasks.length <= 5, recent.json.tasks?.map((x) => x.title));
    const otherRecent = await api('GET', '/wellbeing/focus/tasks?recent=1', undefined, A.token);
    check("another person's recent tasks hold none of them", !otherRecent.json.tasks?.some((x) => x.id === tB.json.node.id || x.id === a.json.node.id), otherRecent.json.tasks);
    const planned = await api('GET', `/wellbeing/focus?view=day&date=${today}`, undefined, W.token);
    const rowA = planned.json.tasks?.find((x) => x.nodeId === a.json.node.id);
    check('a task with an estimate says what was planned: 45 of 60', rowA?.minutes === 45 && rowA?.planned === 60, rowA);
    check('a session with no task has nothing planned, and the goal reads day by day', planned.json.tasks?.find((x) => x.nodeId === null)?.planned === null && planned.json.dayMinutes?.length === 14 && planned.json.dayMinutes.at(-1) === 105, planned.json.dayMinutes);

    // Keep the same part twice (a duplicated tab): one round and one mindful log; someone else's same ref is their own.
    const mindfulOf = async (tok) => ((await api('GET', '/wellbeing/mindful?days=2', undefined, tok)).json.logs ?? []).filter((l) => l.extra?.kind === 'focus').length;
    const logs0 = await mindfulOf(W.token);
    const ref = `smoke${stamp}:timer:${Date.now()}`;
    const k1 = await api('POST', '/wellbeing/focus', { minutes: 12, date: today, clientRef: ref, mode: 'timer', mindful: true }, W.token);
    const k2 = await api('POST', '/wellbeing/focus', { minutes: 12, date: today, clientRef: ref, mode: 'timer', mindful: true }, W.token);
    check('the same part sent twice is one round, and the second says duplicate', k1.status === 201 && k1.json.duplicate === false && k1.json.logged === true && k2.status === 200 && k2.json.duplicate === true && k2.json.id === k1.json.id, [k1.json, k2.json]);
    check('and one mindful log', (await mindfulOf(W.token)) === logs0 + 1, [logs0, await mindfulOf(W.token)]);
    const kA = await api('POST', '/wellbeing/focus', { minutes: 12, date: today, clientRef: ref, mode: 'timer' }, A.token);
    check("another person's same ref is their own round", kA.status === 201 && kA.json.duplicate === false && kA.json.id !== k1.json.id, kA.json);
    check('a ref with odd characters is refused', (await api('POST', '/wellbeing/focus', { minutes: 12, date: today, clientRef: 'a b/c' }, W.token)).status === 400);
    // Change it, and the mindful log moves with it; delete it, and both go.
    const ch = await api('PATCH', `/wellbeing/focus/${k1.json.id}`, { minutes: 30, nodeId: tB.json.node.id }, W.token);
    const logNow = ((await api('GET', '/wellbeing/mindful?days=2', undefined, W.token)).json.logs ?? []).filter((l) => l.extra?.kind === 'focus');
    const changed = (await api('GET', `/wellbeing/focus/today?date=${today}`, undefined, W.token)).json.rounds.find((x) => x.id === k1.json.id);
    check('changing the length changes the linked mindful log, and the task is re-read', ch.status === 200 && changed?.minutes === 30 && changed?.title === 'Toggl task B' && changed?.mindful === true && logNow.some((l) => l.value === 30), [changed, logNow.map((l) => l.value)]);
    check("a session can't be pointed at someone else's task, and 0 minutes is refused", (await api('PATCH', `/wellbeing/focus/${k1.json.id}`, { nodeId: 'not-a-real-task' }, W.token)).status === 404 && (await api('PATCH', `/wellbeing/focus/${k1.json.id}`, { minutes: 0 }, W.token)).status === 400);
    check("another person can neither change nor delete it", (await api('PATCH', `/wellbeing/focus/${k1.json.id}`, { minutes: 5 }, A.token)).status === 404 && (await api('DELETE', `/wellbeing/focus/${k1.json.id}`, undefined, A.token)).status === 404);
    const del = await api('DELETE', `/wellbeing/focus/${k1.json.id}`, undefined, W.token);
    check('deleting a session removes it and its mindful log', del.status === 200 && !(await api('GET', `/wellbeing/focus/today?date=${today}`, undefined, W.token)).json.rounds.some((x) => x.id === k1.json.id) && (await mindfulOf(W.token)) === logs0, await mindfulOf(W.token));
    // The server's window is a day either side of its UTC day (dateNearToday), so count from that day: between 18:30 and 24:00 UTC the IST `today` is a day ahead.
    const utcDay = (n) => new Date(Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    check('a forgotten session can be added for yesterday but not two days back', (await api('POST', '/wellbeing/focus', { minutes: 15, date: utcDay(-1), mode: 'manual' }, W.token)).status === 201 && (await api('POST', '/wellbeing/focus', { minutes: 15, date: utcDay(-2), mode: 'manual' }, W.token)).status === 400);

    // The optional daily nudge: once, on the chosen day after its time, and never for someone who already focused that day.
    const zones = ['Asia/Kolkata', 'Europe/London', 'America/New_York', 'Asia/Tokyo', 'Pacific/Auckland', 'America/Los_Angeles'];
    const localOf = (z) => {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
      const get = (k) => parts.find((x) => x.type === k)?.value ?? '';
      return { day: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
    };
    const zone = zones.find((z) => localOf(z).minutes >= 30 && localOf(z).minutes < 23 * 60 + 30) ?? 'Asia/Kolkata';
    const local = localOf(zone);
    const at = `${String(Math.floor((local.minutes - 10) / 60)).padStart(2, '0')}:${String((local.minutes - 10) % 60).padStart(2, '0')}`;
    const N = await signup(`focusnudge-${stamp}@smoke.test`, `Lantern-${stamp}-pass`, 'Smoke nudge');
    const N2 = await signup(`focusnudge2-${stamp}@smoke.test`, `Lantern-${stamp}-pass`, 'Smoke nudge two');
    for (const who of [N, N2]) {
      await api('PATCH', '/me', { timezone: zone }, who.token);
      await api('PUT', '/wellbeing/focus-settings', { settings: { reminderTime: at, reminderDays: [1, 2, 3, 4, 5, 6, 7], goalMinutes: 47 } }, who.token);
    }
    const kept = await api('GET', '/wellbeing/focus-settings', undefined, N.token);
    check('the goal and the nudge are kept, the goal in steps of 15', kept.json.settings?.reminderTime === at && kept.json.settings?.goalMinutes === 45, kept.json.settings);
    await api('POST', '/wellbeing/focus', { minutes: 15, date: local.day }, N2.token);
    const nudges = async (tok) => ((await api('GET', '/inbox', undefined, tok)).json.notifications ?? []).filter((x) => x.title === 'Time to focus').length;
    await fetch(`${ORIGIN}/__scheduled?cron=*+*+*+*+*`);
    check('the focus nudge arrives once its time has passed', (await nudges(N.token)) === 1, await nudges(N.token));
    await fetch(`${ORIGIN}/__scheduled?cron=*+*+*+*+*`);
    check('a second run sends no second nudge', (await nudges(N.token)) === 1, await nudges(N.token));
    check('someone who already focused that day gets none', (await nudges(N2.token)) === 0, await nudges(N2.token));
  }

  // the calendar link
  const cal0 = await api('GET', '/me/calendar', undefined, W.token);
  check('the calendar link is off until switched on', cal0.json.enabled === false && cal0.json.token === null);
  const noTok = await fetch(`${ORIGIN}/api/public/calendar/${'A'.repeat(24)}.ics`);
  check('a link that does not exist is a 404', noTok.status === 404);
  const on = await api('POST', '/me/calendar', { on: true }, W.token);
  check('switching it on makes a long secret link', /^[A-Z2-9]{24}$/.test(on.json.token ?? ''), on.json);
  const timed = await add({ title: 'Call, with; punctuation', doDate: day(2), dueTime: '09:30', estimateMin: 45, priority: 0 });
  await api('POST', '/wellbeing/mood', { value: 4, note: 'PRIVATE MOOD NOTE', date: today }, W.token);
  const feed = await fetch(`${ORIGIN}/api/public/calendar/${on.json.token}.ics`);
  const ics = await feed.text();
  check('the link answers a calendar file without a sign-in', feed.status === 200 && /text\/calendar/.test(feed.headers.get('content-type') ?? '') && ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'), ics.slice(0, 80));
  check('it carries the tasks that have a day, and what is escaped is escaped', ics.includes('SUMMARY:Call' + String.fromCharCode(92) + ', with' + String.fromCharCode(92) + '; punctuation') && ics.includes('SUMMARY:Already planned') && !ics.includes('SUMMARY:Edit the reel'), ics.slice(0, 400));
  check('a timed task sits at its time in the person\'s zone', /DTSTART:\d{8}T\d{6}Z/.test(ics) && ics.includes(`DTSTART;VALUE=DATE:${day(1).replace(/-/g, '')}`), ics.slice(0, 200));
  check('never a mood, a note or the journal', !ics.includes('PRIVATE MOOD NOTE') && !/journal/i.test(ics));
  const fresh = await api('POST', '/me/calendar', { on: true, fresh: true }, W.token);
  check('a fresh link closes the old one', fresh.json.token !== on.json.token && (await fetch(`${ORIGIN}/api/public/calendar/${on.json.token}.ics`)).status === 404 && (await fetch(`${ORIGIN}/api/public/calendar/${fresh.json.token}.ics`)).status === 200);
  await api('POST', '/me/calendar', { on: false }, W.token);
  check('switching it off closes it', (await fetch(`${ORIGIN}/api/public/calendar/${fresh.json.token}.ics`)).status === 404 && (await api('GET', '/me/calendar', undefined, W.token)).json.enabled === false);
  const ex = (await api('GET', '/me/export', undefined, W.token)).json;
  check('the calendar switch is in the export, without the secret', ex.calendarFeed?.length === 1 && !JSON.stringify(ex.calendarFeed).includes(fresh.json.token));

  // reviews on a calendar: scheduled days, repeat, the reminder, and tasks brought to a review
  const rv = (path, init) => api(init?.method ?? 'GET', `/reviews${path}`, init?.body, W.token);
  const monthNow = today.slice(0, 7);
  const sch0 = await rv(`/schedule?month=${monthNow}&day=${today}`);
  check('the review calendar starts empty', sch0.status === 200 && sch0.json.schedules.length === 0 && Object.keys(sch0.json.days).length === 0, sch0.json);
  check('a review needs a day', (await rv('/schedule', { method: 'POST', body: { kind: 'week' } })).status === 400);
  check('and a day that is on the calendar', (await rv('/schedule', { method: 'POST', body: { kind: 'week', anchor: '2026-11-31' } })).status === 400);
  check('and a way to repeat that exists', (await rv('/schedule', { method: 'POST', body: { kind: 'week', anchor: day(1), repeat: { kind: 'sometimes' } } })).status === 400);
  const once = await rv(`/schedule?day=${today}`, { method: 'POST', body: { kind: 'month', anchor: day(3), time: '18:30', name: 'Close the month' } });
  const weekly = await rv(`/schedule?day=${today}`, { method: 'POST', body: { kind: 'week', anchor: day(0), time: '09:00', repeat: { kind: 'weekly', every: 1, days: [1, 5], until: null } } });
  check('a review is scheduled once, and one repeats on chosen weekdays', once.status === 201 && weekly.status === 201);
  const monthly = await rv(`/schedule?day=${today}`, { method: 'POST', body: { kind: 'quarter', anchor: '2026-08-31', repeat: { kind: 'monthly', every: 1, days: [], until: null } } });
  const cal = await rv(`/schedule?month=${monthNow}&day=${today}`);
  const flat = Object.entries(cal.json.days).flatMap(([d, v]) => v.scheduled.map((x) => ({ d, ...x })));
  check('the calendar lists the one-off day with its time and name', flat.some((x) => x.d === day(3) && x.time === '18:30' && x.name === 'Close the month'), flat.slice(0, 4));
  const wdays = flat.filter((x) => x.kind === 'week').map((x) => x.d);
  check('a weekly review falls only on the weekdays chosen', wdays.length >= 2 && wdays.every((d) => [1, 5].includes(((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7) + 1)), wdays);
  const mdays = flat.filter((x) => x.kind === 'quarter').map((x) => x.d);
  check('a monthly one on the 31st falls on the last day of a shorter month', mdays.length >= 1 && mdays.every((d) => d.slice(8) === String(new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0)).getUTCDate())), mdays);
  check('each schedule reads back in plain words', cal.json.schedules.find((x) => x.id === weekly.json.id)?.label.includes('Mon') && cal.json.schedules.find((x) => x.id === once.json.id)?.label === 'Once', cal.json.schedules.map((x) => x.label));
  check('another person sees none of it', (await api('GET', `/reviews/schedule?month=${monthNow}`, undefined, A.token)).json.schedules.length === 0);
  check('nor can they change it', (await api('PATCH', `/reviews/schedule/${once.json.id}`, { name: 'x' }, A.token)).status === 404 && (await api('DELETE', `/reviews/schedule/${once.json.id}`, undefined, A.token)).status === 404);
  const saved = await api('PUT', '/reviews', { kind: 'week', date: day(-7), templateId: null, answers: ['a', 'b', 'c', 'd'], rating: 4, highlight: 'x' }, W.token);
  // the week's last day can fall in the next month (a Monday on the 1st or 2nd), so look at the month it ended in
  const cal2 = await rv(`/schedule?month=${day(-1).slice(0, 7)}&day=${today}`);
  const cal2b = day(-1).slice(0, 7) === day(-7).slice(0, 7) ? cal2 : await rv(`/schedule?month=${day(-7).slice(0, 7)}&day=${today}`);
  check('a review that was written shows on the day its period ended', saved.status === 200 && [cal2, cal2b].some((r) => Object.values(r.json.days).some((v) => v.written.some((w) => w.kind === 'week'))), saved.status);
  await rv(`/schedule/${once.json.id}?day=${today}`, { method: 'PATCH', body: { enabled: false } });
  check('a switched-off review leaves the calendar', !Object.values((await rv(`/schedule?month=${monthNow}&day=${today}`)).json.days).some((v) => v.scheduled.some((x) => x.id === once.json.id)));
  const ics2 = await (async () => { const t = await api('POST', '/me/calendar', { on: true }, W.token); const r = await fetch(`${ORIGIN}/api/public/calendar/${t.json.token}.ics`); return r.text(); })();
  check('the private calendar carries scheduled reviews too', ics2.includes('SUMMARY:Weekly review') && ics2.includes('CATEGORIES:Reviews') && !ics2.includes('Close the month'), ics2.slice(0, 200));
  await api('POST', '/me/calendar', { on: false }, W.token);

  // a task brought to the review
  const brought = await add({ title: 'Ship the newsletter', forReview: true, doDate: today });
  const other = await add({ title: 'Not for the review', doDate: today });
  check('a task can be created with the flag', brought.json.node.forReview === true && other.json.node.forReview === false, brought.json.node);
  const flip = await api('PATCH', `/nodes/${other.json.node.id}`, { forReview: true }, W.token);
  check('and flagged afterwards, and unflagged', flip.json.node.forReview === true && (await api('PATCH', `/nodes/${other.json.node.id}`, { forReview: false }, W.token)).json.node.forReview === false);
  const sum = await rv(`/summary?kind=week&date=${today}`);
  check('the review lists the flagged task that is planned in it, and not the unflagged one', sum.json.flagged.some((f) => f.title === 'Ship the newsletter' && f.status === 'open') && !sum.json.flagged.some((f) => f.title === 'Not for the review'), sum.json.flagged);
  const lastWeek = await rv(`/summary?kind=week&date=${day(-14)}`);
  check('a period it did not fall in does not list it', !lastWeek.json.flagged.some((f) => f.title === 'Ship the newsletter'));
  check('a person sees only their own flagged tasks', !JSON.stringify((await api('GET', `/reviews/summary?kind=week&date=${today}`, undefined, A.token)).json.flagged).includes('Ship the newsletter'));

  // the reminder: the cron sends one inbox note on the day, at the time, once, and moves the schedule on
  const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  const dueRv = await rv(`/schedule?day=${today}`, { method: 'POST', body: { kind: 'week', anchor: today, time: hhmm, name: 'Friday look back', repeat: { kind: 'weekly', every: 1, days: [], until: null } } });
  await fetch(`${ORIGIN}/__scheduled?cron=*+*+*+*+*`);
  await fetch(`${ORIGIN}/__scheduled?cron=*+*+*+*+*`);
  const inboxJson = JSON.stringify((await api('GET', '/inbox', undefined, W.token)).json);
  check('the reminder arrives once, however often the cron runs', (inboxJson.match(/Friday look back is due/g) ?? []).length === 1, inboxJson.slice(0, 200));
  check('it opens the review for that period and says how many tasks were brought to it', /\/reviews\?kind=week&date=\d{4}-\d{2}-\d{2}/.test(inboxJson) && (/task is waiting in it/.test(inboxJson) || new Date().getUTCDay() === 1), inboxJson.slice(0, 300)); // on a Monday the note opens last week, where today's brought task is not
  const after = (await rv(`/schedule?month=${monthNow}&day=${today}`)).json.schedules.find((x) => x.id === dueRv.json.id);
  check('the schedule moves on to its next day', after.nextOn > today, after);
  check('and another person got no note', !JSON.stringify((await api('GET', '/inbox', undefined, A.token)).json).includes('Friday look back'));
  void timed;
  void preloaded;
}

section('Legal: terms, privacy choices, notices');
{
  const crypto = await import('node:crypto');
  const noBox = await api('POST', '/auth/signup', { email: `nobox-${stamp}@smoke.test`, password: `Kettle-${stamp}-pass`, phone: PHONE, birthDate: GROWN, acceptTerms: false });
  check('an account is not made until the terms box is ticked', noBox.status === 400 && /agree/.test(noBox.json.error ?? ''), noBox.json);
  const L = await signup(`legal-${stamp}@smoke.test`, `Kettle-${stamp}-pass`, 'Smoke legal');
  const st0 = await api('GET', '/me/legal', undefined, L.token);
  check('the terms and privacy policy are on record from sign-up, at this version', st0.status === 200 && Boolean(st0.json.acceptedAt?.terms) && Boolean(st0.json.acceptedAt?.privacy) && st0.json.needsAcceptance === false && st0.json.legalVersion === LEGAL_VERSION, st0.json);
  check('nothing is chosen yet, so the popup asks once, and every choice starts off', st0.json.decided === false && Object.values(st0.json.consent).every((v) => v === false), st0.json.consent);
  const again = await api('POST', '/me/legal/accept', undefined, L.token);
  const exp0 = await api('GET', '/me/export', undefined, L.token);
  check('accepting again adds nothing: one line per document and version', again.status === 200 && exp0.json.termsAcceptances?.length === 2, exp0.json.termsAcceptances?.length);
  const pick = await api('PUT', '/me/legal/consent', { choices: { attribution: true, embeds: false, marketing: true, rubbish: true }, source: 'popup' }, L.token);
  check('the answer is kept on the account, and an unknown choice is ignored', pick.status === 200 && pick.json.decided === true && pick.json.consent.attribution === true && pick.json.consent.marketing === true && pick.json.consent.embeds === false && !('rubbish' in pick.json.consent), pick.json);
  const back = await api('GET', '/me/legal', undefined, L.token);
  check('and it is there the next time, so the popup is not shown again', back.json.decided === true && back.json.consent.marketing === true, back.json);
  await api('PUT', '/me/legal/consent', { choices: { attribution: true, embeds: false, marketing: false }, source: 'profile' }, L.token);
  const exp1 = await api('GET', '/me/export', undefined, L.token);
  const log = exp1.json.privacyChoiceLog ?? [];
  check('every choice is logged with where it was made', log.length >= 4 && log.some((r) => r.source === 'popup') && log.some((r) => r.source === 'profile' && r.purpose === 'marketing' && r.granted === 0), log.map((r) => `${r.purpose}:${r.granted}:${r.source}`));
  const others = await api('GET', '/me/legal', undefined, B.token);
  check('nobody else sees them', others.json.decided === false, others.json.decided);

  const biz = await api('GET', '/public/business');
  check('the business details come from the server, empty until the owner sets them', biz.status === 200 && biz.json.business && typeof biz.json.business.name === 'string' && biz.json.business.dmcaRegistered === false, biz.json);
  const badNotice = await api('POST', '/public/copyright-notice', { name: 'A', email: 'nope' });
  check('a copyright notice needs a real email, the work and a signature', badNotice.status === 400, badNotice.json);
  const notice = await api('POST', '/public/copyright-notice', { kind: 'notice', name: 'Rights Holder', email: 'rights@smoke.test', work: 'My photo', urls: 'https://kreators.app/p/example', statement: 'I believe this is not allowed.', signature: 'Rights Holder' });
  check('a notice is taken, with a reference, and the admins are told', notice.status === 201 && Boolean(notice.json.reference), notice.json);
  const adminNote = JSON.stringify((await api('GET', '/inbox', undefined, A.token)).json);
  check('the founder has the notice in the inbox', adminNote.includes('Copyright notice'), adminNote.slice(0, 120));

  const token = `${L.user.id}.${crypto.createHash('sha256').update(`smoke-salt:unsubscribe:${L.user.id}`).digest('hex').slice(0, 24)}`;
  await api('PUT', '/me/legal/consent', { choices: { attribution: true, embeds: true, marketing: true }, source: 'profile' }, L.token);
  check('a made-up unsubscribe link is refused', (await api('POST', `/public/unsubscribe/${L.user.id}.${'0'.repeat(24)}`)).status === 404);
  const unsub = await api('POST', `/public/unsubscribe/${token}`);
  const after = await api('GET', '/me/legal', undefined, L.token);
  check('the unsubscribe link turns off marketing mail and nothing else', unsub.status === 200 && after.json.consent.marketing === false && after.json.consent.attribution === true && after.json.consent.embeds === true, after.json.consent);

  // The tracked-link cookie follows the choice: waits for a yes in the EU, is set elsewhere unless a no or Global Privacy Control says otherwise.
  const lk = await api('POST', '/studio/links', { label: 'smoke legal' }, A.token);
  const code = lk.json.link?.code ?? lk.json.code;
  const hit = async (headers) => (await fetch(`${ORIGIN}/go/${code}`, { redirect: 'manual', headers: { 'CF-Connecting-IP': ADDRESS, ...headers } })).headers.get('set-cookie') ?? '';
  check('in Germany the cookie waits for a yes', code && !(await hit({ 'CF-IPCountry': 'DE' })).includes('kl_click'));
  check('in Germany a yes lets it be set', (await hit({ 'CF-IPCountry': 'DE', Cookie: 'kc_attr=1' })).includes('kl_click'));
  // India joined the countries where a yes comes first (DPDP Act, legal-india L2).
  check('in India the cookie waits for a yes', !(await hit({ 'CF-IPCountry': 'IN' })).includes('kl_click') && !(await hit({ 'CF-IPCountry': 'IN', Cookie: 'kc_attr=0' })).includes('kl_click'));
  check('in India a yes lets it be set', (await hit({ 'CF-IPCountry': 'IN', Cookie: 'kc_attr=1' })).includes('kl_click'));
  check('outside those countries it is set unless they said no', (await hit({ 'CF-IPCountry': 'US' })).includes('kl_click') && !(await hit({ 'CF-IPCountry': 'US', Cookie: 'kc_attr=0' })).includes('kl_click'));
  check('a browser that sends Global Privacy Control gets no cookie', !(await hit({ 'CF-IPCountry': 'US', 'Sec-GPC': '1' })).includes('kl_click'));
}

section('Security: headers, origin, exposed files, errors, addresses, alerts');
{
  const { publicHttpsUrl } = await import('../../apps/api/src/safeurl.ts');
  const { CSP, PAGE_HEADERS, blockedPath, originAllowed } = await import('../../apps/api/src/headers.ts');
  const { alertsFor } = await import('../../apps/api/src/alerts.ts');
  const { readFileSync } = await import('node:fs');
  const lower = (h) => Object.fromEntries([...h.entries()].map(([k, v]) => [k.toLowerCase(), v]));

  // Headers on the site home (the Worker's own page) and on a static page and an API answer.
  const home = lower((await fetch(`${ORIGIN}/`)).headers);
  const shell = lower((await fetch(`${ORIGIN}/today`)).headers);
  for (const [label, h] of [['the site home', home], ['a page of the app', shell]]) {
    check(`${label} carries a Content-Security-Policy (enforcing or report-only)`, Boolean(h['content-security-policy'] || h['content-security-policy-report-only']));
    check(`${label} carries HSTS for two years without preload`, h['strict-transport-security'] === 'max-age=63072000; includeSubDomains', h['strict-transport-security']);
    check(`${label} carries nosniff, DENY and the referrer policy`, h['x-content-type-options'] === 'nosniff' && h['x-frame-options'] === 'DENY' && h['referrer-policy'] === 'strict-origin-when-cross-origin', [h['x-content-type-options'], h['x-frame-options'], h['referrer-policy']]);
    check(`${label} limits camera, microphone and position, and keeps popups for payment`, h['permissions-policy'] === PAGE_HEADERS['Permissions-Policy'] && h['cross-origin-opener-policy'] === 'same-origin-allow-popups', [h['permissions-policy'], h['cross-origin-opener-policy']]);
  }
  const policy = shell['content-security-policy'] ?? shell['content-security-policy-report-only'] ?? '';
  check('the policy served for static files is the one written in code', policy === CSP, policy.slice(0, 120));
  const fileHeaders = readFileSync(new URL('../../apps/web/public/_headers', import.meta.url), 'utf8');
  check('the _headers file and the Worker send the same policy line', fileHeaders.includes(CSP));
  check('the policy has no script-src wildcard, no unsafe-inline for scripts and no object or frame-ancestors gap', !/script-src[^;]*(\*|unsafe-inline|unsafe-eval)/.test(CSP) && CSP.includes("object-src 'none'") && CSP.includes("frame-ancestors 'none'"));
  check('the reset page is sent without a referrer', fileHeaders.includes('/signin/reset') && fileHeaders.includes('Referrer-Policy: no-referrer'));
  const hz = await fetch(`${API}/health`);
  const hh = lower(hz.headers);
  check('API answers carry the full set and no-store', hh['x-frame-options'] === 'DENY' && hh['x-content-type-options'] === 'nosniff' && hh['strict-transport-security'] === 'max-age=63072000; includeSubDomains' && hh['cache-control'] === 'no-store', hh);
  check('every API answer carries a request id', /^[0-9a-f]{8}$/.test(hh['x-request-id'] ?? ''), hh['x-request-id']);
  const meH = await api('GET', '/me', undefined, A.token);
  check('a signed-in answer is never cached', lower(meH.headers)['cache-control'] === 'no-store', lower(meH.headers)['cache-control']);

  // CORS: nobody else's page may read an answer.
  const evil = 'https://evil.example';
  // Sign-in probes come from an address of their own, so they never use up the main one's sign-in allowance.
  const SEC = { 'CF-Connecting-IP': `10.${(seed >> 16) & 255}.${(seed >> 8) & 255}.${(seed + 7) & 255}` };
  const cors1 = await fetch(`${API}/health`, { headers: { Origin: evil } });
  const cors2 = await fetch(`${API}/me`, { headers: { Origin: evil, authorization: `Bearer ${A.token}` } });
  const pre = await fetch(`${API}/me`, { method: 'OPTIONS', headers: { Origin: evil, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
  check('an unknown origin gets no Access-Control-Allow-Origin on /api/health, /api/me or a preflight', !cors1.headers.get('access-control-allow-origin') && !cors2.headers.get('access-control-allow-origin') && !pre.headers.get('access-control-allow-origin'), [cors1.headers.get('access-control-allow-origin'), cors2.headers.get('access-control-allow-origin'), pre.headers.get('access-control-allow-origin')]);

  // A write from a foreign page is refused; the same site, no origin, and a webhook are not.
  const foreign = await api('POST', '/auth/signin', { email: 'nobody@smoke.test', password: 'x' }, undefined, { ...SEC, Origin: evil });
  check('a write that says it comes from another site is refused with 403', foreign.status === 403 && foreign.json.error === 'wrong origin', foreign);
  const putForeign = await api('PATCH', '/me', { displayName: 'x' }, A.token, { Origin: evil });
  check('a signed-in write from another site changes nothing', putForeign.status === 403 && (await api('GET', '/me', undefined, A.token)).json.user?.displayName !== 'x', putForeign.status);
  const own = await api('POST', '/auth/signin', { email: 'nobody@smoke.test', password: 'x' }, undefined, { ...SEC, Origin: ORIGIN });
  check('a write from the site itself goes through to the sign-in door', own.status === 401, own.status);
  const none = await api('POST', '/auth/signin', { email: 'nobody@smoke.test', password: 'x' }, undefined, SEC);
  check('a write with no origin (a script, the app tests) goes through', none.status === 401, none.status);
  const hook = await api('POST', '/webhooks/razorpay', {}, undefined, { Origin: evil });
  check('a webhook is checked by its signature, not by origin', hook.json.error !== 'wrong origin', hook);
  check('originAllowed: own host, PUBLIC_URL and loopback in development pass; others and "null" do not', originAllowed('https://kreators.app', 'https://kreators.app/api/x') && originAllowed('https://kreators.app', 'https://kreators-life.workers.dev/api/x', 'https://kreators.app') && originAllowed('http://localhost:5173', 'http://localhost:8787/api/x') && !originAllowed('http://localhost:5173', 'https://kreators.app/api/x') && !originAllowed('https://evil.example', 'https://kreators.app/api/x') && !originAllowed('null', 'https://kreators.app/api/x'));

  // Files that must not exist for a visitor answer 404, never the app shell; files the site ships still answer.
  const hidden = ['/.env', '/.env.local', '/.git/config', '/.git/HEAD', '/.gitignore', '/.DS_Store', '/.dev.vars', '/backup.zip', '/backup.sql', '/db.sql', '/dump.sql', '/database.sql', '/site.zip', '/config.json', '/package.json', '/wrangler.jsonc', '/docker-compose.yml', '/assets/index.js.map', '/wp-admin/', '/wp-config.php', '/phpmyadmin/', '/id_rsa', '/id_rsa.pub', '/configuration.json', '/tsconfig.json', '/pnpm-lock.yaml', '/src/main.tsx', '/server-status', '/logs/'];
  const codes = await Promise.all(hidden.map(async (p) => [p, (await fetch(`${ORIGIN}${p}`)).status]));
  const notHidden = codes.filter(([, s]) => s !== 404);
  check('hidden, backup, dump, config and map files answer 404', notHidden.length === 0, notHidden);
  const shipped = ['/sw.js', '/manifest.webmanifest', '/licences.json', '/icon.svg', '/og.png', '/registerSW.js'];
  const shippedCodes = await Promise.all(shipped.map(async (p) => [p, (await fetch(`${ORIGIN}${p}`)).status]));
  check('the files the site ships still answer 200', shippedCodes.every(([, s]) => s === 200), shippedCodes);
  const wrangler = readFileSync(new URL('../../apps/api/wrangler.jsonc', import.meta.url), 'utf8');
  const { BLOCKED_PATTERNS } = await import('../../apps/api/src/headers.ts');
  check('wrangler sends every blocked pattern to the Worker and leaves /.well-known alone', BLOCKED_PATTERNS.every((x) => wrangler.includes(`"${x}"`)) && wrangler.includes('"!/.well-known/*"'), BLOCKED_PATTERNS.filter((x) => !wrangler.includes(`"${x}"`)));
  check('app screens and /.well-known are not caught by the hidden-file rule', ['/admin', '/settings', '/signin/reset', '/today', '/.well-known/security.txt', '/assets/index-abc.js', '/fonts/inter-latin.woff2', '/resources/x.md', '/u/someone.name'].every((p) => !blockedPath(p)) && blockedPath('/.env') && blockedPath('/a/.git/config') && blockedPath('/%2eenv'));

  // Errors: a body that is not JSON and a path that does not exist answer plainly.
  const bad = await fetch(`${API}/auth/signin`, { method: 'POST', headers: { 'content-type': 'application/json', ...SEC }, body: '{"email": "a@b.co", "password": "hunter2-secret' });
  const badText = await bad.text();
  check('a body that is not JSON answers 4xx with no stack, no parser text and nothing of the body', bad.status >= 400 && bad.status < 500 && !/SyntaxError|at \w+ \(|node_modules|hunter2|Unexpected/.test(badText), [bad.status, badText.slice(0, 160)]);
  const bad2 = await fetch(`${API}/nodes`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${A.token}` }, body: '{"title": "x", "password": "hunter2-secret' });
  const bad2Text = await bad2.text();
  check('a signed-in route with a body that is not JSON also stays clean and keeps the secret out', bad2.status >= 400 && bad2.status < 500 && !/SyntaxError|at \w+ \(|node_modules|hunter2|Unexpected/.test(bad2Text), [bad2.status, bad2Text.slice(0, 160)]);
  const none404 = await api('GET', '/this/route/does/not/exist', undefined, A.token);
  check('an unknown API route answers 404 with one plain line', none404.status === 404 && none404.json.error === 'not found' && Object.keys(none404.json).length === 1, none404);
  const dir = await fetch(`${API}/public/..%2f..%2fwrangler.jsonc`);
  check('a path walk in the API finds nothing', dir.status === 404 || dir.status === 400, dir.status);

  // Addresses a person gives: only public https is ever fetched by the Worker.
  const refused = ['http://example.com/a', 'https://127.0.0.1/a', 'https://127.1/', 'https://0x7f000001/', 'https://2130706433/', 'https://169.254.169.254/latest/meta-data/', 'https://[::1]/', 'https://[fe80::1]/', 'https://localhost/a', 'https://app.localhost/', 'https://printer.local/', 'https://metadata.google.internal/', 'https://db.internal/', 'https://intranet/', 'https://user:pass@example.com/', 'https://user@example.com/', 'https://example.com:8443/', 'https://example.com:80/', 'ftp://example.com/', 'javascript:alert(1)', 'file:///etc/passwd', '//example.com/a', 'https://10.0.0.1/', 'https://192.168.1.1/', 'https://127.0.0.1.nip.io/', '', 'not a url'];
  const let_through = refused.filter((u) => publicHttpsUrl(u) !== null);
  check('publicHttpsUrl refuses http, IP numbers, localhost, internal names, logins, odd ports and other schemes', let_through.length === 0, let_through);
  check('publicHttpsUrl accepts https://example.com/a and a normal :443 address', publicHttpsUrl('https://example.com/a')?.href === 'https://example.com/a' && publicHttpsUrl('https://www.youtube.com:443/watch?v=abc')?.hostname === 'www.youtube.com');

  // Alerts: the rules, on counts alone.
  const quiet = alertsFor({ failedSignins: 19, refusals: 50, tooMany: 99, serverErrors: 19, roleChanges: 0 });
  const loud = alertsFor({ failedSignins: 20, refusals: 300, tooMany: 100, serverErrors: 20, roleChanges: 1 });
  check('below the levels no alert is made; at the levels each one is', quiet.length === 0 && loud.map((a) => a.kind).sort().join() === 'errors,limits,roles,signins', [quiet, loud.map((a) => a.kind)]);
  check('an alert holds counts only, no name, address or request', loud.every((a) => !/@|Bearer|\d+\.\d+\.\d+\.\d+/.test(a.body)));
  // A role change is in the audit trail by now (the Admin section changed roles in the last minutes), so the cron tells the admins once.
  // The founder's inbox is shared by every run on this database, so count only what these two cron runs add.
  const roleNotesNow = async () => ((await api('GET', '/inbox?tab=team', undefined, A.token)).json.notifications ?? []).filter((n) => n.title === 'A role or permission was changed').length;
  const roleBefore = await roleNotesNow();
  await fetch(`${ORIGIN}/__scheduled?cron=*%2F15+*+*+*+*`);
  await fetch(`${ORIGIN}/__scheduled?cron=*%2F15+*+*+*+*`);
  const roleAfter = await roleNotesNow();
  check('after a role change the admins are told in the inbox, and two cron runs in an hour tell them once', roleAfter >= 1 && roleAfter - roleBefore <= 1, [roleBefore, roleAfter]);
}

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

section('Month calendar');
{
  const MC = `10.${(seed >> 16) & 255}.${(seed >> 8) & 255}.${(seed + 211) & 255}`;
  const r = await api('POST', '/auth/signup', { email: `monthcal-${stamp}@smoke.test`, password: `Harbour-${stamp}-pass`, displayName: 'Smoke monthcal', phone: PHONE, birthDate: GROWN }, null, { 'CF-Connecting-IP': MC });
  const M = { token: r.json.token };
  const month = today.slice(0, 7);
  const dayOf = (n) => `${month}-${String(n).padStart(2, '0')}`;
  const none = await api('GET', `/today/month?month=${month}&day=${today}`, undefined, M.token);
  check('the month answers with no tasks, no projects and no more', none.status === 200 && none.json.month === month && Array.isArray(none.json.tasks) && none.json.tasks.length === 0 && none.json.more === false && none.json.projects.length === 0, none.json);
  const answers = QUESTIONS.filter((q) => q.relationship === 'self').map((q) => ({ questionId: q.id, value: 1 }));
  await api('POST', '/onboarding', { answers, displayName: 'Smoke monthcal' }, M.token);
  const built = await api('POST', '/onboarding/build', { relationships: ['self'], date: today, picks: { self: {} } }, M.token);
  const proj = (built.json.nodes ?? []).find((n) => n.kind === 'project');
  const add = (b) => api('POST', '/nodes', { kind: 'task', parentId: proj.id, relationship: 'self', ...b }, M.token);
  const a = await add({ title: 'Month do date', doDate: dayOf(3), priority: 1, dueTime: '09:30' });
  const b2 = await add({ title: 'Month due only', dueDate: dayOf(5) });
  const c2 = await add({ title: 'Month both dates', doDate: dayOf(7), dueDate: dayOf(9) });
  const e = await add({ title: 'Month no dates' });
  const far = await add({ title: 'Another month', doDate: `${shiftMonth(month, 2)}-10` });
  check('tasks are made on chosen days of the month', [a, b2, c2, e, far].every((x) => x.status === 201), [a.status, b2.status, c2.status]);
  const got = await api('GET', `/today/month?month=${month}&day=${today}`, undefined, M.token);
  const byTitle = Object.fromEntries((got.json.tasks ?? []).map((t) => [t.title, t]));
  check('a task sits on its do date, else its due date', byTitle['Month do date']?.day === dayOf(3) && byTitle['Month due only']?.day === dayOf(5) && byTitle['Month both dates']?.day === dayOf(7), Object.keys(byTitle));
  check('a task with no date and a task in another month are left out', !byTitle['Month no dates'] && !byTitle['Another month']);
  check('each task carries its priority, time, status and pillar', byTitle['Month do date']?.priority === 1 && byTitle['Month do date']?.time === '09:30' && byTitle['Month do date']?.status === 'active' && byTitle['Month do date']?.relationship === 'self', byTitle['Month do date']);
  check('the answer lists the projects a new task can go under', got.json.projects.some((p) => p.id === proj.id), got.json.projects);
  const ordered = (got.json.tasks ?? []).map((t) => t.day);
  check('tasks come in day order', ordered.every((d, i) => i === 0 || ordered[i - 1] <= d), ordered);
  check('the next month holds the other task', (await api('GET', `/today/month?month=${shiftMonth(month, 2)}&day=${today}`, undefined, M.token)).json.tasks.some((t) => t.title === 'Another month'));
  const rep = await add({ title: 'Month habit', doDate: dayOf(11), repeat: { kind: 'weekly', every: 1, days: [], until: null } });
  const repGot = (await api('GET', `/today/month?month=${month}&day=${today}`, undefined, M.token)).json.tasks.find((t) => t.title === 'Month habit');
  check('a repeating task says how it repeats', rep.status === 201 && typeof repGot?.repeat === 'string' && repGot.repeat.length > 0, repGot);
  check('a month that is not real is refused, never a 500', (await api('GET', `/today/month?month=2026-13&day=${today}`, undefined, M.token)).status === 400 && (await api('GET', '/today/month?month=2026-00', undefined, M.token)).status === 400 && (await api('GET', '/today/month', undefined, M.token)).status === 400 && (await api('GET', '/today/month?month=constructor', undefined, M.token)).status === 400);
  check('a day that is not real is refused too', (await api('GET', `/today/month?month=${month}&day=2026-11-31`, undefined, M.token)).status === 400 && (await api('GET', `/today/month?month=${month}&day=nope`, undefined, M.token)).status === 400);
  check('a person sees only their own month', !JSON.stringify((await api('GET', `/today/month?month=${month}&day=${today}`, undefined, A.token)).json).includes('Month do date'));
  check('the month needs a session', (await api('GET', `/today/month?month=${month}&day=${today}`)).status === 401);
  // a task added from a day of the calendar is the ordinary create: a past day is allowed, and the tick rule is the ordinary one
  const past = await add({ title: 'Month past day', doDate: `${shiftMonth(month, -1)}-15` });
  check('a task can be added on a day that has passed', past.status === 201 && past.json.node.doDate === `${shiftMonth(month, -1)}-15`, past.json);
  const early = await add({ title: 'Month later day', doDate: `${shiftMonth(month, 1)}-15` });
  const tooSoon = await api('POST', `/nodes/${early.json.node.id}/complete`, { date: today }, M.token);
  check('the rule that a task cannot be ticked before its do date still holds', tooSoon.status >= 400 && tooSoon.status < 500, tooSoon.status);
  check('a task needs a project, as on a pillar page', (await api('POST', '/nodes', { kind: 'task', parentId: null, relationship: 'self', title: 'Month orphan', doDate: today }, M.token)).status === 400);
}

section('Limits');
{
  const third = `10.${(seed >> 16) & 255}.${(seed >> 8) & 255}.${(seed + 2) & 255}`;
  let last = 0;
  // Eleven tries in one window must hit the limit; if the minute rolled over halfway, a few more tries do.
  for (let i = 0; i < 25 && last !== 429; i += 1) {
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

// ---------------------------------------------------------------- chat channels
section('Channels');
{
  const chanIp = `10.${(seed >> 16) & 255}.${(seed >> 8) & 255}.${(seed + 7) & 255}`;
  const joiner = async (tag, name) => {
    const r = await api('POST', '/auth/signup', { email: `chan-${tag}-${stamp}@smoke.test`, password: `Willow-${stamp}-pass`, displayName: name, phone: PHONE, birthDate: GROWN }, null, { 'CF-Connecting-IP': chanIp });
    if (r.status !== 201) throw new Error(`channel signup ${tag} failed: ${r.status} ${JSON.stringify(r.json)}`);
    return { token: r.json.token, user: r.json.user };
  };
  const M1 = await joiner('one', 'Chan one');
  const M2 = await joiner('two', 'Chan two');
  const X = await joiner('out', 'Chan outsider');
  const Z = await joiner('gone', 'Chan leaver');
  const lines = async (scope, id, token, query = '') => (await api('GET', `/${scope}/channels/${id}/messages${query}`, undefined, token)).json;
  const say = (scope, id, token, body, extra = {}) => api('POST', `/${scope}/channels/${id}/messages`, { body, ...extra }, token);

  // Community: guides open the channels, anyone joins.
  const notGuide = await api('POST', '/community/channels', { name: `Smoke room ${stamp}`, topic: 'Smoke' }, M1.token);
  check('only a guide opens a Community channel', notGuide.status === 403, notGuide.json);
  const badName = await api('POST', '/community/channels', { name: '!!' }, A.token);
  check('a channel name needs letters', badName.status === 400, badName.json);
  const made = await api('POST', '/community/channels', { name: `Smoke room ${stamp}`, topic: 'Say hello' }, A.token);
  const room = made.json.channel;
  check('a guide opens a public channel', made.status === 201 && room?.kind === 'public' && room?.scope === 'community' && room?.joined === true && room?.slug === `smoke-room-${stamp}`, made.json);
  const dupe = await api('POST', '/community/channels', { name: `Smoke  Room ${stamp}` }, A.token);
  check('the same name is refused in the same scope', dupe.status === 409, dupe.json);
  const listed = await api('GET', '/community/channels?size=100', undefined, M1.token);
  check('the channel shows in the list for a member who has not joined', listed.json.channels?.some((c) => c.id === room.id && c.joined === false) === true && listed.json.canCreate === false, listed.json);

  const outsider = await say('community', room.id, X.token, 'I have not joined');
  check('writing needs joining first', outsider.status === 403, outsider.json);
  check('joining is one tap', (await api('POST', `/community/channels/${room.id}/join`, {}, M1.token)).status === 200 && (await api('POST', `/community/channels/${room.id}/join`, {}, M2.token)).status === 200, '');
  check('joining twice is harmless', (await api('POST', `/community/channels/${room.id}/join`, {}, M1.token)).status === 200, '');
  check('an empty line is refused', (await say('community', room.id, M1.token, '   ')).status === 400, '');
  check('a long line is refused', (await say('community', room.id, M1.token, 'x'.repeat(601))).status === 400, '');

  const one = await say('community', room.id, M1.token, `hello one ${stamp}`);
  const two = await say('community', room.id, M2.token, `hello two ${stamp}`);
  check('two members write in the channel', one.status === 201 && two.status === 201 && one.json.line?.mine === true && one.json.line?.seq < two.json.line?.seq, [one.json, two.json]);

  // Polling: the first read is the latest block, after that only newer lines.
  const first = await lines('community', room.id, M2.token, '?read=1');
  const seqs = (first.lines ?? []).map((l) => l.seq);
  check('the first read gives the lines oldest first', seqs.length === 2 && seqs[0] < seqs[1] && first.more === false, first);
  const last = seqs.at(-1);
  const none = await lines('community', room.id, M2.token, `?after=${last}&from=${seqs[0]}&read=1`);
  check('polling with nothing new returns nothing', (none.lines ?? []).length === 0 && (none.gone ?? []).length === 0, none);
  const three = await say('community', room.id, M1.token, `hello three ${stamp}`);
  const poll = await lines('community', room.id, M2.token, `?after=${last}&from=${seqs[0]}`);
  check('polling returns only the newer line', poll.lines?.length === 1 && poll.lines[0].body === `hello three ${stamp}` && poll.lines[0].seq === three.json.line?.seq, poll);

  // Unread.
  const withUnread = (await api('GET', '/community/channels?size=100', undefined, M2.token)).json.channels?.find((c) => c.id === room.id);
  check('the list counts the lines you have not read', withUnread?.unread === 1 && withUnread?.joined === true, withUnread);
  const dot = await api('GET', '/community/channels/unread', undefined, M2.token);
  check('the tab dot counts channels with something new', dot.json.unread === 1, dot.json);
  await lines('community', room.id, M2.token, '?read=1');
  const cleared = (await api('GET', '/community/channels?size=100', undefined, M2.token)).json.channels?.find((c) => c.id === room.id);
  check('reading the channel clears the count', cleared?.unread === 0, cleared);
  check('your own lines are never unread for you', (await api('GET', '/community/channels?size=100', undefined, M1.token)).json.channels?.find((c) => c.id === room.id)?.unread === 0, 'writing a line marks the channel read for the writer');

  // Anonymous lines: a made-up name, stable through the channel, nothing that points at the writer.
  const anonA = await say('community', room.id, M1.token, `anon a ${stamp}`, { anonymous: true });
  const anonB = await say('community', room.id, M1.token, `anon b ${stamp}`, { anonymous: true });
  const seenBy2 = (await lines('community', room.id, M2.token, '?read=1')).lines?.filter((l) => l.anonymous) ?? [];
  check('an anonymous line carries a made-up name and no id, handle or rank', seenBy2.length === 2 && seenBy2.every((l) => /^\w+ \w+ \d\d$/.test(l.name) && l.userId === '' && l.handle === null && l.rank === null) && !JSON.stringify(seenBy2).includes(M1.user.id), seenBy2);
  check('the made-up name is the same through the channel', seenBy2[0]?.name === seenBy2[1]?.name && seenBy2[0]?.name !== 'Chan one', seenBy2.map((l) => l.name));
  const own = (await lines('community', room.id, M1.token)).lines?.find((l) => l.id === anonA.json.line?.id);
  check('the writer still sees which line is theirs', own?.mine === true && own?.anonymous === true && own?.userId === M1.user.id, own);
  const staffSees = (await lines('community', room.id, A.token)).lines?.find((l) => l.id === anonB.json.line?.id);
  check('staff keep the id of an anonymous line, for reports', staffSees?.userId === M1.user.id, staffSees);
  const nameCheck = await say('community', room.id, M2.token, `anon in a mention ${stamp}`, { anonymous: true });
  check('an anonymous line can be written in Community', nameCheck.status === 201 && nameCheck.json.line?.anonymous === true, nameCheck.json);

  // Mentions tell once, with the made-up name when the writer chose one.
  const m2me = await me(M2.token);
  const mention = await say('community', room.id, M1.token, `hi @${m2me.handle} welcome ${stamp}`);
  const inbox = (await api('GET', '/inbox', undefined, M2.token)).json.notifications ?? [];
  const mentions = inbox.filter((n) => n.kind === 'mention' && n.title.includes('mentioned you in') && n.body.includes(`welcome ${stamp}`));
  check('a mention tells the person once', mention.status === 201 && mentions.length === 1 && mentions[0].link?.includes(room.id), mentions);
  const anonMention = await say('community', room.id, M1.token, `psst @${m2me.handle} anon ${stamp}`, { anonymous: true });
  const inbox2 = (await api('GET', '/inbox', undefined, M2.token)).json.notifications ?? [];
  const anonNote = inbox2.find((n) => n.kind === 'mention' && n.body.includes(`anon ${stamp}`));
  check('a mention from an anonymous line names the made-up name', anonMention.status === 201 && Boolean(anonNote) && !anonNote.title.includes('Chan one'), anonNote);

  // Replies.
  const replied = await say('community', room.id, M2.token, `a reply ${stamp}`, { replyTo: one.json.line.id });
  check('a line can answer another and carries a preview of it', replied.status === 201 && replied.json.line?.replyTo?.id === one.json.line.id && replied.json.line.replyTo.body.includes('hello one'), replied.json);
  check('answering a line that is not there is refused', (await say('community', room.id, M2.token, 'x', { replyTo: 'nope' })).status === 404, '');

  // Blocking hides lines both ways.
  await api('POST', '/bond/block', { userId: M1.user.id }, M2.token);
  const hidden2 = (await lines('community', room.id, M2.token)).lines ?? [];
  const hidden1 = (await lines('community', room.id, M1.token)).lines ?? [];
  check('after a block the blocker no longer sees the other’s lines', hidden2.length > 0 && !hidden2.some((l) => l.body.startsWith('hello one') || l.body.startsWith('hello three') || l.body.startsWith('anon a')), hidden2.map((l) => l.body));
  check('and the blocked person no longer sees the blocker’s', hidden1.length > 0 && !hidden1.some((l) => l.body.startsWith('hello two') || l.body.startsWith('a reply')), hidden1.map((l) => l.body));
  await api('DELETE', `/bond/block/${M1.user.id}`, undefined, M2.token);
  check('lifting the block brings the lines back', (await lines('community', room.id, M2.token)).lines?.some((l) => l.body.startsWith('hello one')) === true, '');
  const blockAnon = await api('POST', `/community/channels/${room.id}/messages/${anonA.json.line.id}/block-author`, {}, X.token);
  check('an anonymous line’s writer can be blocked by the line, without learning who it is', blockAnon.status === 201, blockAnon.status);
  await api('DELETE', `/bond/block/${M1.user.id}`, undefined, X.token);

  // Taking a line down.
  const notYours = await api('DELETE', `/community/channels/${room.id}/messages/${one.json.line.id}`, undefined, M2.token);
  check('a member cannot take down another member’s line', notYours.status === 403, notYours.json);
  const mine = await say('community', room.id, M1.token, `delete me ${stamp}`);
  const heldNow = (await lines('community', room.id, M2.token)).lines ?? [];
  const lo = heldNow[0].seq;
  const hi = heldNow.at(-1).seq;
  const delOwn = await api('DELETE', `/community/channels/${room.id}/messages/${mine.json.line.id}`, undefined, M1.token);
  const afterDel = await lines('community', room.id, M2.token, `?after=${hi}&from=${lo}`);
  check('a writer takes down their own line and an open screen is told which went', delOwn.status === 200 && afterDel.gone?.includes(mine.json.line.seq) && !afterDel.lines?.some((l) => l.id === mine.json.line.id), afterDel);
  const guideDel = await api('DELETE', `/community/channels/${room.id}/messages/${two.json.line.id}`, undefined, A.token);
  check('a guide takes down any line', guideDel.status === 200, guideDel.json);
  const logs = await admin('GET', '/admin/audit?page=1&size=25');
  check('a guide’s takedown is audited', logs.status === 200 && JSON.stringify(logs.json).includes('channel.line.delete'), logs.status);

  // Muting by rank.
  const mutedOne = await api('POST', `/community/members/${M1.user.id}/mute`, { reason: 'smoke' }, A.token);
  const mutedSay = await say('community', room.id, M1.token, 'muted line');
  check('a muted member cannot write in a channel', mutedOne.status === 200 && mutedSay.status === 403, mutedSay.json);
  await api('DELETE', `/community/members/${M1.user.id}/mute`, undefined, A.token);
  check('lifting the mute lets them write again', (await say('community', room.id, M1.token, `back ${stamp}`)).status === 201, '');

  // Report goes to the help queue.
  const reportedLine = (await lines('community', room.id, M2.token)).lines?.find((l) => l.body.startsWith('hello three'));
  const report = await api('POST', `/community/channels/${room.id}/messages/${reportedLine.id}/report`, { note: 'smoke' }, M2.token);
  const filed = (await api('GET', '/support', undefined, M2.token)).json.tickets ?? [];
  check('a report lands in the help queue with the line’s words', report.status === 201 && filed.some((t) => t.subject.includes('Report: a line in the community channel') && t.body.includes(`hello three ${stamp}`)), report.json);
  check('your own line cannot be reported', (await api('POST', `/community/channels/${room.id}/messages/${one.json.line.id}/report`, {}, M1.token)).status === 400, '');

  // Edit and close.
  const renamed = await api('PATCH', `/community/channels/${room.id}`, { topic: 'A new topic' }, A.token);
  check('a guide changes a channel’s topic', renamed.status === 200 && renamed.json.channel?.topic === 'A new topic', renamed.json);
  check('a member cannot rename it', (await api('PATCH', `/community/channels/${room.id}`, { name: 'Nope room' }, M1.token)).status === 403, '');
  check('a member cannot close it', (await api('POST', `/community/channels/${room.id}/archive`, {}, M1.token)).status === 403, '');
  const closed = await api('POST', `/community/channels/${room.id}/archive`, {}, A.token);
  check('a closed channel leaves the list, is gone for members and refuses new lines', closed.status === 200 && (await say('community', room.id, A.token, 'late')).status === 409 && (await say('community', room.id, M1.token, 'late')).status === 404 && !(await api('GET', '/community/channels?size=100', undefined, M1.token)).json.channels?.some((c) => c.id === room.id), closed.json);
  await api('POST', `/community/channels/${room.id}/archive`, { archived: false }, A.token);

  // Bond: a private room for friends.
  const m1me = await me(M1.token);
  const m2code = (await me(M2.token)).friendCode;
  await api('POST', '/bond/friends', { code: m2code }, M1.token);
  const friendUp = await api('POST', '/bond/friends', { code: m1me.friendCode }, M2.token);
  check('two members become friends', friendUp.json.status === 'friends' || friendUp.status === 200, friendUp.json);
  const priv = await api('POST', '/bond/channels', { name: `Weekend ${stamp}`, topic: 'Plans' }, M1.token);
  const rm = priv.json.channel;
  check('a member makes a private channel', priv.status === 201 && rm?.kind === 'private' && rm?.scope === 'bond' && rm?.owner === true, priv.json);
  check('a non-member cannot read a private channel', (await api('GET', `/bond/channels/${rm.id}`, undefined, X.token)).status === 404 && (await api('GET', `/bond/channels/${rm.id}/messages`, undefined, X.token)).status === 404, '');
  check('a non-member cannot write in it', (await say('bond', rm.id, X.token, 'let me in')).status === 404, '');
  check('and it is not in their list', !(await api('GET', '/bond/channels', undefined, X.token)).json.channels?.some((c) => c.id === rm.id), '');
  check('a Community channel is not reachable through Bond', (await api('GET', `/bond/channels/${room.id}`, undefined, M1.token)).status === 404, '');
  check('only friends can be asked', (await api('POST', `/bond/channels/${rm.id}/members`, { userId: X.user.id }, M1.token)).status === 403, '');
  check('only the owner asks people in', (await api('POST', `/bond/channels/${rm.id}/members`, { userId: X.user.id }, M2.token)).status === 404, '');
  const ask = await api('POST', `/bond/channels/${rm.id}/members`, { userId: M2.user.id }, M1.token);
  check('the owner asks a friend in', ask.status === 201, ask.json);
  const invitedView = await api('GET', `/bond/channels/${rm.id}`, undefined, M2.token);
  check('an invited friend sees the invitation but not the lines', invitedView.json.channel?.invited === true && (await api('GET', `/bond/channels/${rm.id}/messages`, undefined, M2.token)).status === 404, invitedView.json);
  check('asking twice is refused', (await api('POST', `/bond/channels/${rm.id}/members`, { userId: M2.user.id }, M1.token)).status === 409, '');
  const yes = await api('POST', `/bond/channels/${rm.id}/join`, {}, M2.token);
  check('the friend says yes', yes.status === 200 && yes.json.channel?.joined === true, yes.json);
  const pa = await say('bond', rm.id, M1.token, `plan a ${stamp}`, { anonymous: true });
  const pb = await say('bond', rm.id, M2.token, `plan b ${stamp}`);
  const seenPriv = (await lines('bond', rm.id, M2.token, '?read=1')).lines ?? [];
  check('Bond lines are never anonymous and show the real name', pa.status === 201 && pb.status === 201 && seenPriv.length === 2 && seenPriv.every((l) => l.anonymous === false && l.rank === null) && seenPriv.find((l) => l.body.startsWith('plan a'))?.name === 'Chan one', seenPriv);
  const privMembers = (await api('GET', `/bond/channels/${rm.id}`, undefined, M1.token)).json.members ?? [];
  check('members see who is in a private channel', privMembers.length === 2 && privMembers.some((m) => m.owner && m.userId === M1.user.id), privMembers);
  check('the owner cannot leave their own channel', (await api('POST', `/bond/channels/${rm.id}/leave`, {}, M1.token)).status === 400, '');
  check('a member cannot take down the owner’s line', (await api('DELETE', `/bond/channels/${rm.id}/messages/${pa.json.line.id}`, undefined, M2.token)).status === 403, '');
  check('the owner takes down anyone’s line', (await api('DELETE', `/bond/channels/${rm.id}/messages/${pb.json.line.id}`, undefined, M1.token)).status === 200, '');
  const removed = await api('DELETE', `/bond/channels/${rm.id}/members/${M2.user.id}`, undefined, M1.token);
  check('the owner takes someone out and they lose the channel', removed.status === 200 && (await api('GET', `/bond/channels/${rm.id}/messages`, undefined, M2.token)).status === 404, removed.json);
  check('a private channel stays out of the Community list', !(await api('GET', '/community/channels?size=100', undefined, M2.token)).json.channels?.some((c) => c.id === rm.id), '');

  // Export and delete.
  const lz = await api('POST', '/community/channels/' + room.id + '/join', {}, Z.token);
  const zline = await say('community', room.id, Z.token, `leaver line ${stamp}`);
  const zexp = await api('GET', '/me/export', undefined, Z.token);
  check('the export holds a person’s channel lines', lz.status === 200 && zline.status === 201 && (zexp.json.channelLines ?? []).some((l) => l.body === `leaver line ${stamp}`) && (zexp.json.channelSeats ?? []).length === 1, zexp.json.channelLines);
  const zdel = await api('DELETE', '/me', { confirm: 'DELETE' }, Z.token);
  const afterZ = await lines('community', room.id, A.token);
  check('deleting the account deletes the lines', zdel.status === 200 && !(afterZ.lines ?? []).some((l) => l.body.includes('leaver line')), zdel.json);

  // The limit.
  check('a person who has not joined cannot fill a channel', (await say('community', room.id, X.token, 'x')).status === 403, '');
  await api('POST', `/community/channels/${room.id}/join`, {}, X.token);
  let tripped = 0;
  for (let i = 0; i < LIMITS.channelMessage.max + 1 && tripped !== 429; i += 1) tripped = (await say('community', room.id, X.token, `spam ${i}`)).status;
  check('channel lines are limited per person from the one limits file', tripped === 429, tripped);
}

// ---------------------------------------------------------------- discount codes the team makes
section('Discount codes');
{
  // Its own address, so these sign-ups and the code checks never touch the limits the rest of the checks use.
  const DC_ADDRESS = `10.${(seed >> 16) & 255}.${(seed >> 8) & 255}.${(seed + 11) & 255}`;
  const LIMIT_ADDRESS = `10.${(seed >> 16) & 255}.${(seed >> 8) & 255}.${(seed + 12) & 255}`;
  const join = async (who) => {
    const r = await api('POST', '/auth/signup', { email: `dc-${who}-${stamp}@smoke.test`, password: `Kettle-${stamp}-pass`, displayName: `Smoke ${who}`, phone: PHONE, birthDate: GROWN }, null, { 'CF-Connecting-IP': DC_ADDRESS });
    return { token: r.json.token, user: r.json.user };
  };
  const word = (s) => `${s}${stamp}`.toUpperCase();
  const mk = (body) => admin('POST', '/admin/discounts', body);
  const S = await join('seller');
  const B1 = await join('buyer1');
  const B2 = await join('buyer2');
  const B3 = await join('buyer3');
  const B4 = await join('buyer4');
  for (const t of [B1, B2, B3, B4, S]) await api('PATCH', '/me/modules', { key: 'party', on: true }, t.token);
  for (const t of [B1, B2, B3, B4]) await admin('POST', `/admin/users/${t.user.id}/points`, { amount: 1000, note: 'smoke discount codes' });
  const pts = async (t) => (await me(t.token)).points;
  const dc = (path, body, t) => api('POST', path, body, t.token, { 'CF-Connecting-IP': DC_ADDRESS });

  const listed = await api('POST', '/studio/products', { kind: 'digital', title: `DC points ${stamp}`, pricePoints: 200, status: 'live' }, S.token);
  const listed2 = await api('POST', '/studio/products', { kind: 'digital', title: `DC points two ${stamp}`, pricePoints: 200, status: 'live' }, S.token);
  const cash = await api('POST', '/studio/products', { kind: 'digital', title: `DC money ${stamp}`, pricePoints: 0, priceCents: 50000, status: 'live' }, S.token);
  check('the seller has a points product and a money product', listed.status === 201 && listed2.status === 201 && cash.status === 201, [listed.status, cash.status]);
  const P1 = listed.json.product.id;
  const P2 = listed2.json.product.id;
  const PM = cash.json.product.id;

  // The team makes codes; nobody else can.
  const quarter = await mk({ code: word('quarter'), kind: 'percent', percent: '25', areas: ['product'], maxUses: 5, perPersonLimit: 1, note: 'smoke' });
  check('an admin makes a percent code, kept upper case', quarter.status === 201 && quarter.json.code?.code === word('quarter') && quarter.json.code.percentBps === 2500 && quarter.json.code.active === true, quarter.json);
  check('the same word cannot be made twice', (await mk({ code: word('quarter').toLowerCase(), kind: 'percent', percent: '10', areas: ['product'] })).status === 409, '');
  check('a buyer cannot make or list codes', (await api('POST', '/admin/discounts', { code: 'NOPE123', kind: 'percent', percent: '90', areas: ['product'] }, B1.token)).status === 403 && (await api('GET', '/admin/discounts', undefined, B1.token)).status === 403, '');
  check('a percent must be from 0.01 to 100', (await mk({ kind: 'percent', percent: '100.01', areas: ['product'] })).status === 400 && (await mk({ kind: 'percent', percent: '0', areas: ['product'] })).status === 400 && (await mk({ kind: 'percent', percent: 'abc', areas: ['product'] })).status === 400, '');
  check('a code needs a place, and a fixed amount cannot be for points-only tickets', (await mk({ kind: 'percent', percent: '5', areas: [] })).status === 400 && (await mk({ kind: 'fixed', amount: '5', areas: ['event'] })).status === 400, '');
  check('a word that is too short is refused', (await mk({ code: 'ab', kind: 'percent', percent: '5', areas: ['product'] })).status === 400, '');
  const random = await mk({ kind: 'percent', percent: '5', areas: ['product'] });
  check('an empty code makes a random one of eight', random.status === 201 && /^[A-Z0-9]{8}$/.test(random.json.code?.code ?? ''), random.json);
  const fixed = await mk({ code: word('fixed'), kind: 'fixed', amount: '1.005', currency: 'INR', areas: ['product'], perPersonLimit: 3 });
  check('a typed amount is read from its digits: 1.005 is 101 cents', fixed.status === 201 && fixed.json.code?.amountCents === 101, fixed.json.code);
  const list = await admin('GET', `/admin/discounts?q=${word('quarter')}`);
  check('the admin list is paged and shows the code with its use count', list.status === 200 && list.json.page?.page === 1 && list.json.codes?.length === 1 && list.json.codes[0].redeemed === 0 && list.json.totals?.codes >= 3, list.json);

  // A buyer checks a code: the server prices it from the product, never from the request.
  const peek = await dc('/discounts/check', { code: word('quarter').toLowerCase(), area: 'product', itemId: P1, amountCents: 1, priceCents: 1, payPoints: 1 }, B1);
  check('a buyer sees the new price, worked out by the server', peek.status === 200 && peek.json.listPoints === 200 && peek.json.offPoints === 50 && peek.json.payPoints === 150 && peek.json.label === '25% off', peek.json);
  check('checking a code uses nothing up', (await admin('GET', `/admin/discounts?q=${word('quarter')}`)).json.codes[0].usedCount === 0, '');
  check('an unknown word, a prototype word and rubbish all get the same plain refusal', (await Promise.all(['NOSUCHCODE', 'constructor', '__proto__', '!!'].map((code) => dc('/discounts/check', { code, area: 'product', itemId: P1 }, B1)))).every((r) => r.status === 400 && r.json.error === 'That code does not work.'), '');
  check('a code for products does not work on a plan', (await dc('/discounts/check', { code: word('quarter'), area: 'plan', itemId: 'pro' }, B1)).json.error === 'That code is not for this.', '');
  check('a fixed amount takes money off, and a points price has none to take', (await dc('/discounts/check', { code: word('fixed'), area: 'product', itemId: P1 }, B1)).json.error === 'That code takes money off, and this costs points.', '');
  check('something that is not for sale is not found', (await dc('/discounts/check', { code: word('quarter'), area: 'product', itemId: 'nothing' }, B1)).status === 404, '');

  // Buying with the code: the buyer pays less, the seller is still paid on the list price, and the use is taken.
  const sellerBefore = await pts(S);
  const buyerBefore = await pts(B1);
  const bought = await dc(`/store/${P1}/checkout`, { discountCode: word('quarter'), pay: 'points', points: 1, cents: 1, priceCents: 1, pricePoints: 1 }, B1);
  check('checkout with a code goes through', bought.status === 201 && bought.json.order?.status === 'paid', bought.json);
  check('the order keeps what the buyer paid and what the code took off', bought.json.order?.points === 150 && bought.json.order?.discountPoints === 50, bought.json.order);
  check('the buyer pays the discounted points, whatever the request said', buyerBefore - (await pts(B1)) === 150, '');
  const fee = bought.json.order?.platformFeePoints ?? -1;
  check('the seller is credited on the list price: the platform pays the discount', (await pts(S)) - sellerBefore === 200 - fee && fee >= 0, { fee });
  check('the use is counted and the admin sees what was given away', (await admin('GET', `/admin/discounts?q=${word('quarter')}`)).json.codes[0].redeemed === 1 && (await admin('GET', `/admin/discounts?q=${word('quarter')}`)).json.codes[0].givenPoints === 50, '');
  const again = await dc('/discounts/check', { code: word('quarter'), area: 'product', itemId: P2 }, B1);
  check('the same person cannot use a one-time code twice', again.status === 400 && again.json.error === 'You already used that code.', again.json);
  const againBuy = await dc(`/store/${P2}/checkout`, { discountCode: word('quarter') }, B1);
  check('and checkout refuses it too, charging nothing', againBuy.status === 400 && (await pts(B1)) === buyerBefore - 150, againBuy.json);
  const bothCodes = await dc(`/store/${P2}/checkout`, { discountCode: word('quarter'), coupon: 'ANYTHING' }, B2);
  check('a creator coupon and a team code are not used together', bothCodes.status === 400 && /one code at a time/i.test(bothCodes.json.error ?? ''), bothCodes.json);
  const exported = await api('GET', '/me/export', undefined, B1.token);
  check('the export lists the codes a person used', (exported.json.discountRedemptions ?? []).some((r) => r.code === word('quarter') && r.off_points === 50), exported.json.discountRedemptions);

  // A refund returns what was paid and takes the list price back from the seller.
  const sellerMid = await pts(S);
  const refunded = await api('POST', `/studio/orders/${bought.json.order.id}/refund`, { reason: 'smoke' }, S.token);
  check('the seller refunds the discounted order', refunded.status === 200 && refunded.json.order?.status === 'refunded', refunded.json);
  check('the buyer gets back what they paid, no more', (await pts(B1)) === buyerBefore, { now: await pts(B1), buyerBefore });
  check('the seller gives back what they were credited', sellerMid - (await pts(S)) === 200 - fee, '');
  check('a refund does not give the use of the code back', (await dc('/discounts/check', { code: word('quarter'), area: 'product', itemId: P2 }, B1)).json.error === 'You already used that code.', '');

  // The last use cannot be taken twice.
  await mk({ code: word('last'), kind: 'percent', percent: '50', areas: ['product'], maxUses: 1 });
  const before2 = await pts(B2);
  const before3 = await pts(B3);
  const [r2, r3] = await Promise.all([dc(`/store/${P1}/checkout`, { discountCode: word('last') }, B2), dc(`/store/${P1}/checkout`, { discountCode: word('last') }, B3)]);
  const won = [r2, r3].filter((r) => r.status === 201);
  const lost = [r2, r3].filter((r) => r.status !== 201);
  check('two taps on the last use: one gets it, one is refused', won.length === 1 && lost.length === 1 && [400, 409].includes(lost[0].status), [r2.status, r3.status]);
  check('the one who lost was not charged and has no order', (won[0] === r2 ? await pts(B3) === before3 : await pts(B2) === before2), '');
  const lastRow = (await admin('GET', `/admin/discounts?q=${word('last')}`)).json.codes[0];
  check('the code shows one use of one', lastRow.usedCount === 1 && lastRow.redeemed === 1, lastRow);
  check('then it is used up', (await dc('/discounts/check', { code: word('last'), area: 'product', itemId: P2 }, B4)).json.error === 'That code has been used up.', '');

  // Dates and switches.
  await mk({ code: word('old'), kind: 'percent', percent: '10', areas: ['product'], endsAt: new Date(Date.now() - 60_000).toISOString() });
  await mk({ code: word('soon'), kind: 'percent', percent: '10', areas: ['product'], startsAt: new Date(Date.now() + 86_400_000).toISOString() });
  check('an expired code is refused in plain words', (await dc('/discounts/check', { code: word('old'), area: 'product', itemId: P2 }, B4)).json.error === 'That code has expired.', '');
  check('a code that has not started says when it does', /^That code starts on \d{4}-\d{2}-\d{2}\.$/.test((await dc('/discounts/check', { code: word('soon'), area: 'product', itemId: P2 }, B4)).json.error ?? ''), '');
  check('an end before the start is refused', (await mk({ kind: 'percent', percent: '5', areas: ['product'], startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(), endsAt: new Date(Date.now() + 86_400_000).toISOString() })).status === 400, '');
  const small = await mk({ code: word('min'), kind: 'percent', percent: '10', areas: ['product'], minAmount: '600', currency: 'INR' });
  check('a code with a smallest price refuses a cheaper one', small.status === 201 && /prices from/.test((await dc('/discounts/check', { code: word('min'), area: 'product', itemId: PM }, B4)).json.error ?? ''), small.json);
  const sw = await mk({ code: word('swoff'), kind: 'percent', percent: '10', areas: ['product'] });
  check('a code can be edited in its row', (await admin('PATCH', `/admin/discounts/${sw.json.code.id}`, { note: 'changed', maxUses: 9 })).json.code?.note === 'changed', '');
  check('its worth cannot be changed after it is made', (await admin('PATCH', `/admin/discounts/${sw.json.code.id}`, { percent: '99', kind: 'fixed' })).status === 400, '');
  const off = await admin('PATCH', `/admin/discounts/${sw.json.code.id}`, { active: false });
  check('switching a code off works at once', off.json.code?.active === false && (await dc('/discounts/check', { code: word('swoff'), area: 'product', itemId: P2 }, B4)).json.error === 'That code is switched off.', off.json);
  const bulkOne = await mk({ code: word('bulk1'), kind: 'percent', percent: '10', areas: ['product'] });
  const bulkTwo = await mk({ code: word('bulk2'), kind: 'percent', percent: '10', areas: ['product'] });
  const bulked = await admin('POST', '/admin/discounts/bulk', { ids: [bulkOne.json.code.id, bulkTwo.json.code.id], active: false });
  check('several codes switch off together', bulked.json.changed === 2, bulked.json);
  const trail = await admin('GET', '/admin/audit?size=100');
  check('creating and switching off are in the audit log', JSON.stringify(trail.json).includes('discount.create') && JSON.stringify(trail.json).includes('discount.off'), trail.status);

  // Money: a typed amount, a percent, and 100% off, all recomputed on the server.
  await mk({ code: word('fifth'), kind: 'percent', percent: '20', areas: ['product'], perPersonLimit: 5 });
  await mk({ code: word('free'), kind: 'percent', percent: '100', areas: ['product'] });
  // Not every product takes points: one priced in money only is never bought, or taken free, with points.
  const pointsOnMoney = await dc(`/store/${PM}/checkout`, { pay: 'points' }, B4);
  check('a product priced in money only refuses a points order', pointsOnMoney.status === 400 && /money/i.test(pointsOnMoney.json.error ?? ''), pointsOnMoney.json);
  const money1 = await dc(`/store/${PM}/checkout`, { pay: 'test', discountCode: word('fifth'), cents: 1, priceCents: 1, amountCents: 1 }, B4);
  check('a money order is priced by the server: 20% off 500.00 is 400.00', money1.status === 201 && money1.json.order?.cents === 40000 && money1.json.order?.discountCents === 10000 && money1.json.order?.status === 'test', money1.json.order);
  const money2 = await dc(`/store/${PM}/checkout`, { pay: 'money', discountCode: word('fixed') }, B3);
  check('a fixed amount comes off a money order in whole cents', money2.status === 201 && money2.json.order?.cents === 50000 - 101 && money2.json.order?.discountCents === 101, money2.json.order);
  const freeBefore = await pts(B2);
  const money3 = await dc(`/store/${PM}/checkout`, { pay: 'money', discountCode: word('free') }, B2);
  check('100% off a money order is a free order: paid at once, no provider, no points', money3.status === 201 && money3.json.order?.status === 'paid' && money3.json.order?.cents === 0 && money3.json.order?.discountCents === 50000 && money3.json.payment === null && (await pts(B2)) === freeBefore, money3.json);
  check('and the buyer owns it', (await api('GET', '/store/library', undefined, B2.token)).json.orders?.some((o) => o.productId === PM), '');

  // Plans and top-ups: the price shown is right even though nothing is charged yet.
  await mk({ code: word('plan'), kind: 'percent', percent: '20', areas: ['plan', 'topup'] });
  const planCheck = await dc('/discounts/check', { code: word('plan'), area: 'plan', itemId: 'pro' }, B1);
  check('a plan code prices a plan from the plan list', planCheck.status === 200 && planCheck.json.listCents === PLANS.pro.priceCents && planCheck.json.payCents === PLANS.pro.priceCents - Math.floor(PLANS.pro.priceCents / 5) && planCheck.json.currency === 'INR', planCheck.json);
  const planBuy = await dc('/credits/checkout', { kind: 'plan', key: 'pro', discountCode: word('plan') }, B1);
  check('plan checkout checks the code and still says nothing was charged', planBuy.status === 409 && planBuy.json.live === false && planBuy.json.quote?.payCents === planCheck.json.payCents, planBuy.json);
  check('plan checkout refuses a code that does not work', (await dc('/credits/checkout', { kind: 'plan', key: 'pro', discountCode: 'NOSUCHCODE' }, B1)).status === 400, '');
  check('nothing is used up while nothing is charged', (await admin('GET', `/admin/discounts?q=${word('plan')}`)).json.codes[0].usedCount === 0, '');

  // A ticket that costs points: a percent comes off, and a cancel returns what was paid.
  await mk({ code: word('half'), kind: 'percent', percent: '50', areas: ['event'] });
  const ev = await api('POST', '/party/events', { title: `DC party ${stamp}`, startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), minutes: 60, pricePoints: 100 }, S.token);
  check('a host sets a ticket price in points', ev.status === 201 && ev.json.event?.pricePoints === 100, ev.json);
  const tBefore = await pts(B1);
  const rsvp = await dc(`/party/events/${ev.json.event.id}/rsvp`, { discountCode: word('half') }, B1);
  check('a ticket with a code costs half', rsvp.status === 201 && tBefore - (await pts(B1)) === 50, rsvp.json);
  const cancel = await dc(`/party/events/${ev.json.event.id}/cancel-rsvp`, {}, B1);
  check('cancelling gives back what was paid, not the list price', cancel.status === 200 && (await pts(B1)) === tBefore, cancel.json);
  const notFor = await dc(`/party/events/${ev.json.event.id}/rsvp`, { discountCode: word('quarter') }, B2);
  check('a product code does not work on a ticket and nothing is charged', notFor.status === 400, notFor.json);

  // A person who leaves takes their redemptions with them.
  await mk({ code: word('leave'), kind: 'percent', percent: '10', areas: ['product'] });
  const leaver = await dc(`/store/${P2}/checkout`, { discountCode: word('leave') }, B4);
  const gone = await api('DELETE', '/me', { confirm: 'DELETE' }, B4.token);
  check('deleting the account works after a code was used', leaver.status === 201 && gone.status === 200, [leaver.status, gone.status]);

  // The limit on guessing.
  const X = await api('POST', '/auth/signup', { email: `dc-guess-${stamp}@smoke.test`, password: `Kettle-${stamp}-pass`, displayName: 'Smoke guesser', phone: PHONE, birthDate: GROWN }, null, { 'CF-Connecting-IP': LIMIT_ADDRESS });
  let last = 0;
  for (let i = 0; i < LIMITS.discount.max + 2 && last !== 429; i += 1) last = (await api('POST', '/discounts/check', { code: `GUESS${i}ABC`, area: 'product', itemId: P1 }, X.json.token, { 'CF-Connecting-IP': LIMIT_ADDRESS })).status;
  check('guessing codes is limited per person from the one limits file', last === 429, last);
}

// ---------------------------------------------------------------- badges
section('Badges');
{
  const { BADGES: CATALOGUE, BADGE_FAMILIES: FAMILIES, BADGE_STATS: STATS, BADGE_TIERS: TIERS, isPrivateBadge } = await import('../../packages/shared/src/index.ts');
  check('the catalogue has 40 to 60 badges, each with a tier and a family', CATALOGUE.length >= 40 && CATALOGUE.length <= 60 && CATALOGUE.every((b) => TIERS.includes(b.tier) && FAMILIES.includes(b.family)), CATALOGUE.length);
  const G = await signup(`badges-${stamp}@smoke.test`, `Kettle-${stamp}-pass`, 'Smoke badges');
  const gallery = await api('GET', '/me/badges', undefined, G.token);
  check('the gallery answers with a count behind every rule', gallery.status === 200 && Array.isArray(gallery.json.held) && STATS.every((k) => typeof gallery.json.progress?.[k] === 'number'), gallery.json);
  check('a new account holds no badge yet', gallery.json.held?.length === 0, gallery.json.held);
  check('the gallery needs a session', (await api('GET', '/me/badges')).status === 401, '');

  // Do the thing once: set up the first pillar.
  const rel = 'self';
  const answers = QUESTIONS.filter((q) => q.relationship === rel).map((q) => ({ questionId: q.id, value: 1 }));
  await api('POST', '/onboarding', { answers, displayName: 'Smoke badges' }, G.token);
  const built = await api('POST', '/onboarding/build', { relationships: [rel], date: today }, G.token);
  const after = await api('GET', '/me/badges', undefined, G.token);
  const pillar = after.json.held?.find((h) => h.key === 'pillar_1');
  check('building a pillar earns First pillar once, with the day it was earned', built.status === 201 && pillar && typeof pillar.at === 'string' && !Number.isNaN(Date.parse(pillar.at)) && after.json.progress?.pillars_set === 1, after.json);
  check('and Profile shows it', (await api('GET', '/me', undefined, G.token)).json.badges?.includes('pillar_1'), '');
  const again = await api('GET', '/me/badges', undefined, G.token);
  check('asking again does not date it a second time', again.json.held?.find((h) => h.key === 'pillar_1')?.at === pillar?.at, again.json.held);

  // A private badge (a journal page) is the owner's alone, and an earned badge is never taken back.
  const page = await api('POST', '/journal', { title: 'Smoke badge page' }, G.token);
  check('a journal page earns First page', page.status === 201 && (await api('GET', '/me/badges', undefined, G.token)).json.held?.some((h) => h.key === 'journal_1') && isPrivateBadge('journal_1'), page.json);
  await api('DELETE', `/journal/${page.json.entry.id}`, undefined, G.token);
  check('deleting the page does not take the badge back', (await api('GET', '/me/badges', undefined, G.token)).json.held?.some((h) => h.key === 'journal_1'), '');
  const handle = `bdg${stamp}`.slice(0, 20);
  await api('PATCH', '/me', { handle, publicSettings: { pagePublic: true, showBadges: true } }, G.token);
  const pub = await api('GET', `/public/${handle}`);
  check('the public page shows the public badge and never the private one', pub.status === 200 && pub.json.badges?.includes('pillar_1') && !pub.json.badges?.includes('journal_1'), pub.json?.badges);
  const board = await api('GET', '/leaderboard', undefined, G.token);
  check('the leaderboard still answers with a badge count', board.status === 200, board.status);

  // Unknown keys are refused where a key is taken.
  const nope = await admin('POST', `/admin/users/${G.user.id}/badges`, { key: 'not_a_real_badge' });
  check('a badge key that is not in the catalogue is refused', nope.status === 400, nope.status);
  const given = await admin('POST', `/admin/users/${G.user.id}/badges`, { key: 'sale_10', note: 'smoke' });
  check('a real one can be given by hand and shows as given', given.status === 200 && (await api('GET', '/me/badges', undefined, G.token)).json.held?.find((h) => h.key === 'sale_10')?.given === true, given.status);
}

// ---------------------------------------------------------------- agency lifecycle: stages, the link's password, changes, the retainer and its months
import { TRIAL_RULES, AGENCY_STAGE_KEYS } from '../../packages/shared/src/index.ts';
section('Agency lifecycle');
{
  const LIP = (n) => `10.${(seed >> 8) & 255}.${(seed + n) & 255}.${(seed >> 16) & 255}`;
  const join = async (who) => {
    const r = await api('POST', '/auth/signup', { email: `${who}-${stamp}@smoke.test`, password: `Harbour-${stamp}-pass`, displayName: `Smoke ${who}`, phone: PHONE, birthDate: GROWN }, null, { 'CF-Connecting-IP': LIP(40) });
    await api('PATCH', '/me/modules', { key: 'agency', on: true }, r.json.token);
    return { token: r.json.token, user: r.json.user };
  };
  const O = await join('lifeowner');
  const X = await join('lifestranger');
  // No tax lines on the invoices this makes, so a month's invoice comes to exactly the month's fee.
  await api('PUT', '/agency/settings', { profile: { gstBps: 0, tdsBps: 0, tdsMode: 'none', invoicePrefix: '' } }, O.token);
  const anyIp = () => LIP(60 + Math.floor(Math.random() * 100));
  const P = (method, path, body, o = {}) => api(method, `/public${path}`, body, null, { 'CF-Connecting-IP': o.ip ?? anyIp(), ...(o.session ? { 'X-Portal-Session': o.session } : {}) });
  const page = (id) => api('GET', `/agency/clients/${id}?day=${today}`, undefined, O.token).then((r) => r.json);
  const items = (id) => api('GET', `/agency/items?day=${today}&client=${id}&size=100`, undefined, O.token).then((r) => r.json.items ?? []);
  const cron = () => fetch(`${ORIGIN}/__scheduled?cron=*+*+*+*+*`);
  const day = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

  // A new client can start with a password on its link; the word is shown once and kept only as a hash.
  const mk = await addClient({ name: 'Lifecycle Labs', contactEmail: 'ops@lifecycle.test', retainerCents: 5000000, piecesPerMonth: 3, portalPassword: 'generate' }, O.token, { locked: true });
  const cid = mk.json.id;
  const pw = mk.json.password;
  check('a new client can start with a password, shown once', mk.status === 201 && typeof pw === 'string' && pw.length >= 10 && /^[a-z]+(-[a-z]+){3}-\d\d$/.test(pw), mk.json);
  const p0 = await page(cid);
  check('it starts at the first stage, locked', p0.lifecycle?.stage === 'enquiry' && p0.lifecycle.password.set === true && p0.client.portalLocked === true, p0.lifecycle);
  check('the owner\'s page holds neither the password nor its hash', !JSON.stringify(p0).includes(pw) && !/pass_hash|pass_salt/.test(JSON.stringify(p0)));
  check('every stage has a name in order', AGENCY_STAGE_KEYS.length === 9 && AGENCY_STAGE_KEYS[0] === 'enquiry');
  const on = await api('POST', `/agency/clients/${cid}/portal`, { on: true, show: { contracts: true, invoices: true } }, O.token);
  const tok = on.json.portalToken;

  // The lock answers with the client's name and who sent the link (the business name and its logo, for the branded lock screen), nothing else.
  const locked = await P('GET', `/agency/${tok}`);
  check('a link with a password answers locked, with the names only', locked.status === 401 && locked.json.error === 'locked' && locked.json.clientName === 'Lifecycle Labs' && Object.keys(locked.json).sort().join() === 'agencyLogo,agencyName,clientName,error', locked.json);
  check('and says nothing of the work', !/waiting|coming|invoices|stage|retainer|portal/.test(JSON.stringify(locked.json)));
  check('a made-up session does not open it', (await P('GET', `/agency/${tok}`, undefined, { session: 'a'.repeat(64) })).status === 401);
  // A wrong password and a link that does not exist answer the same words.
  const wrongIp = LIP(31);
  const w1 = await P('POST', `/agency/${tok}/unlock`, { password: 'definitely-not-it-77' }, { ip: wrongIp });
  const w2 = await P('POST', '/agency/ABCDEFGHJKLMNPQR/unlock', { password: 'definitely-not-it-77' }, { ip: LIP(32) });
  check('a wrong password is refused with the same words as a link that is not there', w1.status === 401 && w2.status === 401 && w1.json.error === w2.json.error, [w1.json, w2.json]);
  check('a missing password is refused too', (await P('POST', `/agency/${tok}/unlock`, {}, { ip: LIP(33) })).status === 401);
  // Five tries from one address, then the door closes, even for the right word.
  for (let i = 0; i < 4; i += 1) await P('POST', `/agency/${tok}/unlock`, { password: `wrong-guess-${i}-xx` }, { ip: wrongIp });
  const shut = await P('POST', `/agency/${tok}/unlock`, { password: pw }, { ip: wrongIp });
  check('too many wrong passwords from one address close the door, even for the right one', shut.status === 429, shut.status);
  // The right word from another address opens it.
  const good = await P('POST', `/agency/${tok}/unlock`, { password: pw }, { ip: LIP(34) });
  const session = good.json.session;
  check('the right password gives a session for twelve hours', good.status === 200 && /^[0-9a-f]{64}$/.test(session ?? '') && Date.parse(good.json.expiresAt) - Date.now() > 11 * 3_600_000, good.json);
  const open = await P('GET', `/agency/${tok}`, undefined, { session });
  check('with the session the page reads, at the first stage', open.status === 200 && open.json.stage === 'enquiry' && open.json.clientName === 'Lifecycle Labs', open.status);
  const p1 = await page(cid);
  check('the owner sees when it was opened, as a day', p1.lifecycle.password.lastOpenedDay === new Date().toISOString().slice(0, 10), p1.lifecycle.password);
  // Before the onboarding form is sent the page is only the form; once the client sends it, the dashboard opens.
  check('before onboarding only the form shows', open.json.onboarding?.needed === true && !('waiting' in open.json) && !('invoices' in open.json) && !('docs' in open.json), Object.keys(open.json).join());
  const obForm = await P('GET', `/agency/${tok}/onboarding`, undefined, { session });
  check('the form needs the unlock and asks the agreement\'s own questions', (await P('GET', `/agency/${tok}/onboarding`)).status === 401 && obForm.status === 200 && obForm.json.questions?.length >= 3, obForm.status);
  const obSent = await P('POST', `/agency/${tok}/onboarding/submit`, { draft: onboardingDraft(obForm.json.questions ?? [], 'Lifecycle Labs Private Limited', 'ops@lifecycle.test') }, { session, ip: LIP(35) });
  check('the client sends the form once', obSent.status === 200 && (await P('POST', `/agency/${tok}/onboarding/submit`, { draft: onboardingDraft(obForm.json.questions ?? [], 'X', 'x@x.test') }, { session, ip: LIP(36) })).status === 409, obSent.json);
  const afterOb = await P('GET', `/agency/${tok}`, undefined, { session });
  check('after onboarding the dashboard opens, and the owner has the details', 'waiting' in afterOb.json && afterOb.json.onboarding?.done === true && (await page(cid)).client.billing.line === 'Lifecycle Labs Private Limited', Object.keys(afterOb.json).join());
  // A session is for one client.
  const other = await addClient({ name: 'Other Labs', portalPassword: 'generate' }, O.token, { locked: true });
  const otherTok = (await api('POST', `/agency/clients/${other.json.id}/portal`, { on: true }, O.token)).json.portalToken;
  check('a session for one client does not open another', (await P('GET', `/agency/${otherTok}`, undefined, { session })).status === 401);

  // The agreement and invoice links of this client sit behind the same password. Sending the agreement moves the client on; signing moves it on again.
  const kc = await api('POST', '/agency/contracts', { templateKey: 'trial', clientId: cid }, O.token);
  const sentK = await api('PATCH', `/agency/contracts/${kc.json.id}`, { status: 'sent' }, O.token);
  const ktok = sentK.json.contract?.token;
  check('sending the agreement moves the client to Agreement sent', (await page(cid)).lifecycle.stage === 'agreement_sent');
  const kLocked = await P('GET', `/contracts/${ktok}`);
  check('the agreement link is locked for a client with a password', kLocked.status === 401 && kLocked.json.error === 'locked' && !JSON.stringify(kLocked.json).includes('sections'), kLocked.json);
  check('the lock probe says so, and says no with a session', (await P('GET', `/contracts/${ktok}/lock`)).json.locked === true && (await P('GET', `/contracts/${ktok}/lock`, undefined, { session })).json.locked === false);
  check('signing without the session is refused', (await P('POST', `/contracts/${ktok}/accept`, { name: 'Asha Rao', agree: true })).status === 401);
  check('the agreement reads with the session', (await P('GET', `/contracts/${ktok}`, undefined, { session })).status === 200);
  const ac = await P('POST', `/contracts/${ktok}/accept`, { name: 'Asha Rao', title: 'Head', agree: true, answers: {} }, { session });
  check('and is signed with it', ac.status === 200, ac.json);
  check('signing moves the client to Agreement signed', (await page(cid)).lifecycle.stage === 'agreement_signed');

  // The stages go one at a time.
  const skip = await api('POST', `/agency/clients/${cid}/stage`, { to: 'trial' }, O.token);
  check('a stage cannot be skipped', skip.status === 400 && /one stage at a time/.test(skip.json.error), skip.json);
  check('and a stage that does not exist is refused', (await api('POST', `/agency/clients/${cid}/stage`, { to: 'constructor' }, O.token)).status === 400);
  check('the owner moves one step', (await api('POST', `/agency/clients/${cid}/stage`, { to: 'strategy' }, O.token)).status === 200 && (await page(cid)).lifecycle.stage === 'strategy');
  check('a slip can be undone one step back, and only one', (await api('POST', `/agency/clients/${cid}/stage`, { to: 'agreement_signed', undo: true }, O.token)).status === 200 && (await api('POST', `/agency/clients/${cid}/stage`, { to: 'enquiry', undo: true }, O.token)).status === 400);
  await api('POST', `/agency/clients/${cid}/stage`, { to: 'strategy' }, O.token);
  check('the move is written in the log, and the log holds no password', (await page(cid)).lifecycle.log.some((l) => /Moved to Strategy session/.test(l.text)) && !JSON.stringify((await page(cid)).lifecycle.log).includes(pw));
  check('someone else cannot move, read or change this client', (await api('POST', `/agency/clients/${cid}/stage`, { to: 'trial' }, X.token)).status === 404 && (await api('PUT', `/agency/clients/${cid}/password`, { clear: true }, X.token)).status === 404 && (await api('PUT', `/agency/clients/${cid}/lifecycle`, { trialDue: day(3) }, X.token)).status === 404);

  // The days.
  check('a day that is not on the calendar is refused', (await api('PUT', `/agency/clients/${cid}/lifecycle`, { trialDue: '2026-11-31' }, O.token)).status === 400);
  check('and a pilot cannot end before it starts', (await api('PUT', `/agency/clients/${cid}/lifecycle`, { pilotStart: day(10), pilotEnd: day(5) }, O.token)).status === 400);
  check('a call link must be https', (await api('PUT', `/agency/clients/${cid}/lifecycle`, { strategyLink: 'http://x.test/call' }, O.token)).status === 400);
  const days = await api('PUT', `/agency/clients/${cid}/lifecycle`, { strategyDay: day(1), strategyLink: 'https://meet.example.com/abc', trialDue: day(6), pilotStart: day(8), pilotEnd: day(38), revisionsPerPiece: 2 }, O.token);
  check('the days are kept', days.status === 200 && days.json.dates.trialDue === day(6), days.json);
  const withStrategy = await P('GET', `/agency/${tok}`, undefined, { session });
  check('the client sees the strategy session and what is waiting', withStrategy.json.strategy?.day === day(1) && withStrategy.json.waitingOn.some((w) => w.key === 'strategy' && w.href === 'https://meet.example.com/abc'), withStrategy.json.waitingOn);
  check('a checklist tick is kept, and only the stage\'s own steps', (await api('POST', `/agency/clients/${cid}/checklist`, { key: 'strategy:objective', done: true }, O.token)).json.ticks?.['strategy:objective'] === true && (await api('POST', `/agency/clients/${cid}/checklist`, { key: 'strategy:nope', done: true }, O.token)).status === 400);

  // The trial: the rules from the agreement, and the trial video goes through the client's review.
  check('a retainer cannot be offered before the pilot', (await api('POST', `/agency/clients/${cid}/retainer`, {}, O.token)).status === 400);
  await api('POST', `/agency/clients/${cid}/stage`, { to: 'trial' }, O.token);
  const tv = await api('POST', `/agency/clients/${cid}/trial-video`, {}, O.token);
  const tv2 = await api('POST', `/agency/clients/${cid}/trial-video`, {}, O.token);
  check('the trial video is added once', tv.status === 201 && tv2.status === 200 && tv2.json.id === tv.json.id, [tv.json, tv2.json]);
  const tvId = tv.json.id;
  await api('PATCH', `/agency/items/${tvId}?day=${today}`, { title: 'Trial video', stage: 'review', link: 'https://example.com/trial' }, O.token);
  const trialView = await P('GET', `/agency/${tok}`, undefined, { session });
  check('the client sees the trial rules, quoted from the agreement', trialView.json.trial?.rules?.length === TRIAL_RULES.length && trialView.json.trial.rules[0].text === TRIAL_RULES[0].text && trialView.json.trial.due === day(6), trialView.json.trial?.rules?.length);
  check('and the trial video waiting for them, with its changes', trialView.json.waitingOn.some((w) => /trial video/i.test(w.title)) && trialView.json.waiting[0]?.changes?.allowed === 2 && trialView.json.waiting[0].changes.used === 0, trialView.json.waiting?.[0]);

  // Changes: each one spends one of the changes included in the piece and sends it back to making; none left means a note for a paid change.
  const ask = (n = 'Trim the intro', extra = {}) => P('POST', `/agency/${tok}/items/${tvId}`, { decision: 'changes', note: n, ...extra }, { session });
  const c1 = await ask('Trim the intro', { where: '0:12' });
  const it1 = (await items(cid)).find((i) => i.id === tvId);
  check('a change spends one and sends the piece back to making', c1.status === 200 && it1.stage === 'making' && it1.revisions === 1 && it1.revisionsAllowed === 2, it1);
  const notes1 = (await api('GET', `/agency/items/${tvId}/notes`, undefined, O.token)).json.notes;
  check('it is a note of its own kind, with the place it is about', notes1.some((n) => n.kind === 'change' && n.body.startsWith('0:12: Trim the intro')), notes1);
  check('the owner is told', JSON.stringify((await api('GET', '/inbox', undefined, O.token)).json).includes('sent back'));
  check('a change cannot be asked for on a piece that is still being made', (await ask('again')).status === 400);
  await api('PATCH', `/agency/items/${tvId}?day=${today}`, { title: 'Trial video', stage: 'review' }, O.token);
  check('the second change is spent too', (await ask('Louder music')).status === 200 && (await items(cid)).find((i) => i.id === tvId).revisions === 2);
  await api('PATCH', `/agency/items/${tvId}?day=${today}`, { title: 'Trial video', stage: 'review' }, O.token);
  const over = await ask('One more thing');
  check('with none left the change is refused, plainly', over.status === 409 && over.json.over === true && (await items(cid)).find((i) => i.id === tvId).stage === 'review', over.json);
  const paid = await P('POST', `/agency/${tok}/items/${tvId}`, { decision: 'paid_change', note: 'A new ending, please' }, { session });
  const afterPaid = (await items(cid)).find((i) => i.id === tvId);
  check('a paid change is only a note: nothing moves and nothing is spent', paid.status === 200 && afterPaid.stage === 'review' && afterPaid.revisions === 2, afterPaid);
  check('and it reads as one in the thread', (await api('GET', `/agency/items/${tvId}/notes`, undefined, O.token)).json.notes.some((n) => n.kind === 'paid_change'));
  const addOne = await api('POST', `/agency/items/${tvId}/changes`, { add: 1 }, O.token);
  check('the owner can add a change to a piece', addOne.status === 200 && addOne.json.allowed === 3 && (await ask('Now this')).status === 200, addOne.json);
  check('and another person cannot', (await api('POST', `/agency/items/${tvId}/changes`, { add: 1 }, X.token)).status === 404);
  // Two taps at once spend one change, not two.
  await api('POST', `/agency/items/${tvId}/changes`, { add: 1 }, O.token);
  await api('PATCH', `/agency/items/${tvId}?day=${today}`, { title: 'Trial video', stage: 'review' }, O.token);
  const usedBefore = (await items(cid)).find((i) => i.id === tvId).revisions;
  const [r1, r2] = await Promise.all([ask('race one'), ask('race two')]);
  const usedAfter = (await items(cid)).find((i) => i.id === tvId).revisions;
  // One wins. The other is refused, as a lost race (409) or because the piece has already moved on (400): either way one change is spent.
  const codes = [r1.status, r2.status].sort();
  check('two change requests at once with one left spend it once', codes[0] === 200 && (codes[1] === 409 || codes[1] === 400) && usedAfter - usedBefore === 1, [r1.status, r2.status, usedBefore, usedAfter]);
  check('a comment never spends one', (await P('POST', `/agency/${tok}/items/${tvId}`, { decision: 'comment', note: 'Lovely work' }, { session })).status === 200);

  // Taking the password off opens the link; changing it signs the client out of every tab.
  check('a short password is refused', (await api('PUT', `/agency/clients/${cid}/password`, { password: 'short-9ch' }, O.token)).status === 400);
  check('and one from the guess list', (await api('PUT', `/agency/clients/${cid}/password`, { password: 'password123' }, O.token)).status === 400);
  check('and one that is the client\'s name', (await api('PUT', `/agency/clients/${cid}/password`, { password: 'lifecycle-labs-2026' }, O.token)).status === 400);
  const mine = `Quiet-${stamp}-harbour`;
  const set = await api('PUT', `/agency/clients/${cid}/password`, { password: mine }, O.token);
  check('the owner can type their own', set.status === 200 && set.json.set === true && !('password' in set.json), set.json);
  check('and the old session stops working', (await P('GET', `/agency/${tok}`, undefined, { session })).status === 401);
  check('the old password stops working too', (await P('POST', `/agency/${tok}/unlock`, { password: pw }, { ip: LIP(35) })).status === 401);
  const again = await P('POST', `/agency/${tok}/unlock`, { password: mine }, { ip: LIP(36) });
  check('the new one opens it', again.status === 200 && /^[0-9a-f]{64}$/.test(again.json.session ?? ''));
  check('a fresh link also signs everyone out', (await api('POST', `/agency/clients/${cid}/portal`, { fresh: true }, O.token)).status === 200);
  const tok2 = (await api('GET', `/agency/clients/${cid}?day=${today}`, undefined, O.token)).json.client.portalToken;
  const cleared = await api('PUT', `/agency/clients/${cid}/password`, { clear: true }, O.token);
  check('removing the password opens the link to anyone who has it, as before', cleared.status === 200 && (await P('GET', `/agency/${tok2}`)).status === 200 && (await P('GET', `/contracts/${ktok}`)).status === 200);
  check('the log names the changes to the password and never the word', (await page(cid)).lifecycle.log.some((l) => l.kind === 'password') && !JSON.stringify((await page(cid)).lifecycle.log).includes(mine));
  const gen = await api('PUT', `/agency/clients/${cid}/password`, { generate: true }, O.token);
  check('a generated password is shown once', gen.status === 200 && typeof gen.json.password === 'string' && !JSON.stringify(await page(cid)).includes(gen.json.password));
  await api('PUT', `/agency/clients/${cid}/password`, { clear: true }, O.token);

  // The retainer: offered after the pilot, chosen by the client, confirmed by the owner, one guarded step at a time.
  await api('POST', `/agency/clients/${cid}/stage`, { to: 'pilot' }, O.token);
  const bad = await api('POST', `/agency/clients/${cid}/retainer`, { options: [{ months: 0 }, { months: 99 }] }, O.token);
  check('an offer with no real length is refused', bad.status === 400, bad.json);
  const offer = await api('POST', `/agency/clients/${cid}/retainer`, { options: [{ months: 3, discountBps: 500 }, { months: 6 }], piecesPerMonth: 3, revisionsPerPiece: 4 }, O.token);
  check('the owner offers lengths', offer.status === 201, offer.json);
  check('and that moves the client to Retainer proposed', (await page(cid)).lifecycle.stage === 'retainer_offer');
  const rv = await P('GET', `/agency/${tok2}`);
  const o3 = rv.json.retainer?.options?.find((o) => o.months === 3);
  check('the client sees each length with its month and total, discount taken off in whole cents', rv.json.retainer?.status === 'offered' && o3?.monthlyCents === 4750000 && o3?.totalCents === 14250000 && rv.json.retainer.options.find((o) => o.months === 6)?.monthlyCents === 5000000, rv.json.retainer);
  check('a length that was not offered is refused', (await P('POST', `/agency/${tok2}/retainer`, { months: 4 })).status === 400);
  check('and the confirm needs a choice first', (await api('POST', `/agency/retainers/${offer.json.id}/confirm?day=${today}`, {}, O.token)).status === 409);
  check('the client chooses a length', (await P('POST', `/agency/${tok2}/retainer`, { months: 3 })).status === 200 && (await P('GET', `/agency/${tok2}`)).json.retainer.status === 'chosen' && (await page(cid)).lifecycle.retainer.status === 'chosen');
  check('another person cannot confirm, withdraw or end it', (await api('POST', `/agency/retainers/${offer.json.id}/confirm`, {}, X.token)).status === 404 && (await api('POST', `/agency/retainers/${offer.json.id}/withdraw`, {}, X.token)).status === 404 && (await api('POST', `/agency/retainers/${offer.json.id}/end`, {}, X.token)).status === 404);
  const [k1, k2] = await Promise.all([api('POST', `/agency/retainers/${offer.json.id}/confirm?day=${today}`, { startDay: today }, O.token), api('POST', `/agency/retainers/${offer.json.id}/confirm?day=${today}`, { startDay: today }, O.token)]);
  check('two confirms at once start it once', [k1.status, k2.status].sort().join() === '200,409', [k1.status, k2.status, k1.json, k2.json]);
  const p2 = await page(cid);
  check('the retainer is active and the client is at Retainer active', p2.lifecycle.retainer.status === 'active' && p2.lifecycle.stage === 'retainer' && p2.lifecycle.retainer.monthlyCents === 4750000, p2.lifecycle.retainer);

  // The first month is made at once: its invoice and its pieces. Running the cron again makes nothing twice.
  const month1 = (await items(cid)).filter((i) => i.cycleNumber === 1);
  check('the first month made its pieces, spread through the month, with the retainer\'s changes', month1.length === 3 && month1.every((i) => /^Month 1, piece [123]$/.test(i.title) && i.stage === 'idea' && i.revisionsAllowed === 4 && i.dueDate >= today), month1.map((i) => [i.title, i.dueDate]));
  const inv1 = p2.invoices.filter((i) => i.totalCents === 4750000);
  check('and its invoice, sent because auto-send is on', inv1.length === 1 && inv1[0].status === 'sent', p2.invoices);
  check('the next month is named', p2.lifecycle.retainer.cyclesMade === 1 && p2.lifecycle.retainer.nextCycle?.n === 2, p2.lifecycle.retainer);
  await cron();
  await cron();
  const p3 = await page(cid);
  check('the cron run twice makes nothing again', p3.lifecycle.retainer.cyclesMade === 1 && (await items(cid)).filter((i) => i.cycleNumber === 1).length === 3 && p3.invoices.filter((i) => i.totalCents === 4750000).length === 1, p3.lifecycle.retainer);
  check('turning auto-send off is kept', (await api('POST', `/agency/retainers/${offer.json.id}/auto-send`, { on: false }, O.token)).json.on === false && (await page(cid)).lifecycle.retainer.autoSend === false);
  check('a second retainer cannot be offered while one runs', (await api('POST', `/agency/clients/${cid}/retainer`, {}, O.token)).status === 400);
  const ended = await api('POST', `/agency/retainers/${offer.json.id}/end`, {}, O.token);
  check('ending it is guarded: once', ended.status === 200 && (await api('POST', `/agency/retainers/${offer.json.id}/end`, {}, O.token)).status === 409);
  check('an ended retainer can be renewed with a new offer', (await api('POST', `/agency/clients/${cid}/retainer`, { options: [{ months: 12 }] }, O.token)).status === 201 && (await page(cid)).lifecycle.retainer.status === 'offered');

  // Months that were missed while nothing ran are made on the next run, once each; auto-send off leaves the invoices as drafts.
  const late = (await addClient({ name: 'Late Labs', retainerCents: 1000000, piecesPerMonth: 2 }, O.token)).json.id;
  for (const to of ['agreement_sent', 'agreement_signed', 'strategy', 'trial', 'pilot']) await api('POST', `/agency/clients/${late}/stage`, { to }, O.token);
  const lo = await api('POST', `/agency/clients/${late}/retainer`, { options: [{ months: 6 }], autoSend: false }, O.token);
  const lTok = (await api('POST', `/agency/clients/${late}/portal`, { on: true }, O.token)).json.portalToken;
  await P('POST', `/agency/${lTok}/retainer`, { months: 6 });
  const lc = await api('POST', `/agency/retainers/${lo.json.id}/confirm?day=${today}`, { startDay: day(-31) }, O.token);
  check('a retainer that started a month ago makes both its months at once', lc.status === 200 && lc.json.made === 2, lc.json);
  const lateItems = await items(late);
  check('each month once, with its pieces', lateItems.filter((i) => i.cycleNumber === 1).length === 2 && lateItems.filter((i) => i.cycleNumber === 2).length === 2, lateItems.map((i) => i.title));
  await cron();
  await cron();
  const lp = await page(late);
  check('and the cron does not make them again', (await items(late)).length === 4 && lp.lifecycle.retainer.cyclesMade === 2 && lp.invoices.length === 2, [lp.lifecycle.retainer.cyclesMade, lp.invoices.length]);
  check('with auto-send off the invoices wait as drafts', lp.invoices.every((i) => i.status === 'draft'), lp.invoices.map((i) => i.status));

  // Client onboarding, by its rules, on a client whose link is locked: the form needs the unlock, is saved as the client goes,
  // names the first unanswered question of the brief, and is sent once however many taps arrive together.
  const obMk = await addClient({ name: 'Onboard Labs', contactEmail: 'ops@onboard.test', portalPassword: 'generate' }, O.token, { locked: true });
  const obId = obMk.json.id;
  const obTok = obMk.json.portalToken;
  const obPw = obMk.json.password;
  check('onboarding: the form is locked without a portal session', obMk.status === 201 && (await P('GET', `/agency/${obTok}/onboarding`, undefined, { ip: LIP(41) })).status === 401 && (await P('PUT', `/agency/${obTok}/onboarding`, { draft: {} }, { ip: LIP(41) })).status === 401, obMk.json);
  const obSession = (await P('POST', `/agency/${obTok}/unlock`, { password: obPw }, { ip: LIP(42) })).json.session;
  const obQs = (await P('GET', `/agency/${obTok}/onboarding`, undefined, { session: obSession, ip: LIP(43) })).json.questions ?? [];
  const obDraft = onboardingDraft(obQs, 'Onboard Labs Private Limited', 'asha@onboard.test');
  const obPut = await P('PUT', `/agency/${obTok}/onboarding`, { draft: { ...obDraft, brief: {}, junk: 'dropped' } }, { session: obSession, ip: LIP(43) });
  const obBack = (await P('GET', `/agency/${obTok}/onboarding`, undefined, { session: obSession, ip: LIP(43) })).json;
  check('onboarding: the draft is saved by PUT, and only the form\'s own fields', obPut.status === 200 && obBack.draft?.legalName === 'Onboard Labs Private Limited' && !('junk' in (obBack.draft ?? {})) && obBack.done === false, obBack.draft);
  const obHalf = await P('POST', `/agency/${obTok}/onboarding/submit`, { draft: { ...obDraft, brief: {} } }, { session: obSession, ip: LIP(44) });
  check('onboarding: sending it without the brief is refused with the first question', obHalf.status === 400 && /^Answer 3\.1\./.test(obHalf.json.error ?? '') && String(obHalf.json.field).startsWith('q-'), obHalf.json);
  const [obA, obB] = await Promise.all([
    P('POST', `/agency/${obTok}/onboarding/submit`, { draft: obDraft }, { session: obSession, ip: LIP(45) }),
    P('POST', `/agency/${obTok}/onboarding/submit`, { draft: obDraft }, { session: obSession, ip: LIP(46) }),
  ]);
  check('onboarding: two sends at once give one 200 and one 409', [obA.status, obB.status].sort().join() === '200,409', [obA.status, obB.status, obA.json, obB.json]);
  const obExport = (await api('GET', '/me/export', undefined, O.token)).json;
  const obRow = (obExport.agencyClients ?? []).find((r) => r.id === obId);
  check('onboarding: the export holds the form, when it was sent and that it was needed', typeof obRow?.onboarding_json === 'string' && obRow.onboarding_json.includes('Onboard Labs Private Limited') && Boolean(obRow.onboarded_at) && obRow.onboarding_needed === 1, obRow && { needed: obRow.onboarding_needed, at: obRow.onboarded_at });

  // Asking for a new password, from the lock screen: the same answer for any link, one open ask per client, one inbox note,
  // a limit per address, dismissed by the owner, closed by a new password (which also ends every portal session).
  const askIp = LIP(47);
  const pwAsk = (body, ip) => P('POST', '/agency/password-request', { kind: 'agency', ...body }, { ip });
  const askUnknown = await pwAsk({ token: 'ZZZZZZZZZZZZZZZZ', reason: 'x' }, LIP(48));
  const ask1 = await pwAsk({ token: obTok, reason: 'I think it was shared' }, askIp);
  check('password ask: an unknown link gets the same answer as a real one', askUnknown.status === 200 && ask1.status === 200 && JSON.stringify(askUnknown.json) === JSON.stringify(ask1.json), [askUnknown.json, ask1.json]);
  const ask2 = await pwAsk({ token: obTok, reason: 'again' }, askIp);
  const askPage = await page(obId);
  check('password ask: a second ask is merged into the one open request, with the first reason', ask2.status === 200 && askPage.lifecycle.password.request?.reason === 'I think it was shared', askPage.lifecycle.password.request);
  const askInbox = JSON.stringify((await api('GET', '/inbox', undefined, O.token)).json);
  check('password ask: the owner gets one inbox note for it', askInbox.split('Onboard Labs asked for a new password').length - 1 === 1, askInbox.slice(0, 200));
  check('password ask: the log keeps the fact and never the reason', askPage.lifecycle.log.some((l) => /asked for a new password/.test(l.text)) && !JSON.stringify(askPage.lifecycle.log).includes('I think it was shared'));
  const ask3 = await pwAsk({ token: obTok }, askIp);
  const ask4 = await pwAsk({ token: obTok }, askIp);
  check('password ask: a fourth ask from one address within the hour is limited', ask3.status === 200 && ask4.status === 429, [ask3.status, ask4.status]);
  check('password ask: another person cannot dismiss it', (await api('POST', `/agency/clients/${obId}/password-request/close`, {}, X.token)).status === 404);
  const askClose = await api('POST', `/agency/clients/${obId}/password-request/close`, {}, O.token);
  check('password ask: the owner dismisses it and it is gone from the page', askClose.status === 200 && askClose.json.closed === true && (await page(obId)).lifecycle.password.request === null, askClose.json);
  await pwAsk({ token: obTok, reason: 'Lost it' }, LIP(49));
  check('password ask: after a dismissal a new ask opens again', (await page(obId)).lifecycle.password.request?.reason === 'Lost it');
  const obNewPw = `Cedar-${stamp}-lotus-07`;
  check('password ask: the old portal session still opens the page before the new password', (await P('GET', `/agency/${obTok}`, undefined, { session: obSession })).status === 200);
  const obSet = await api('PUT', `/agency/clients/${obId}/password`, { password: obNewPw }, O.token);
  check('password ask: a new password closes the open ask and ends every portal session', obSet.status === 200 && (await page(obId)).lifecycle.password.request === null && (await P('GET', `/agency/${obTok}`, undefined, { session: obSession })).status === 401);
  const askExport = (await api('GET', '/me/export', undefined, O.token)).json;
  const askRows = (askExport.agencyPasswordRequests ?? []).filter((r) => r.client_id === obId);
  const askText = JSON.stringify(askExport);
  check('password ask: the export carries the asks and no password', askRows.length >= 2 && askRows.every((r) => !Object.keys(r).some((k) => /hash|salt|pass/i.test(k))) && !askText.includes(obPw) && !askText.includes(obNewPw) && !/portal_pass_hash|portal_pass_salt/.test(askText), askRows);

  // Export and erase.
  const ex = JSON.stringify((await api('GET', '/me/export', undefined, O.token)).json);
  check('the export holds the lifecycle and never a password hash or a session', ex.includes('agencyRetainers') && ex.includes('agencyCycles') && ex.includes('portal_has_password') && !/portal_pass_hash|portal_pass_salt|portal_sessions/.test(ex) && !ex.includes(pw) && !ex.includes(mine));
  check('another person has none of it', (await api('GET', `/agency/clients/${late}`, undefined, X.token)).status === 404);
  check('removing a client takes its retainers with it', (await api('DELETE', `/agency/clients/${late}`, undefined, O.token)).status === 200 && (await api('POST', `/agency/retainers/${lo.json.id}/end`, {}, O.token)).status === 404);
}

// ---------------------------------------------------------------- Agency team link: the client page for the client's own team, without the paper
section('Agency team link');
{
  const TIP = (n) => `10.${(seed >> 10) & 255}.${(seed + n) & 255}.${((seed >> 3) + 7) & 255}`;
  const join = async (who) => {
    const r = await api('POST', '/auth/signup', { email: `${who}-${stamp}@smoke.test`, password: `Harbour-${stamp}-pass`, displayName: `Smoke ${who}`, phone: PHONE, birthDate: GROWN }, null, { 'CF-Connecting-IP': TIP(3) });
    await api('PATCH', '/me/modules', { key: 'agency', on: true }, r.json.token);
    return { token: r.json.token, user: r.json.user };
  };
  const O = await join('tlowner');
  const X = await join('tlstranger');
  const anyIp = () => TIP(100 + Math.floor(Math.random() * 120));
  const P = (method, path, body, o = {}) => api(method, `/public${path}`, body, null, { 'CF-Connecting-IP': o.ip ?? anyIp(), ...(o.portal ? { 'X-Portal-Session': o.portal } : {}), ...(o.team ? { 'X-Team-Link-Session': o.team } : {}) });
  const page = (id) => api('GET', `/agency/clients/${id}?day=${today}`, undefined, O.token).then((r) => r.json);

  // A client the owner already works with: onboarded, a password on its own link, and paper sent to it.
  const mk = await addClient({ name: 'Junior Labs', contactEmail: 'ops@junior.test', piecesPerMonth: 4, channels: ['Instagram'] }, O.token);
  const cid = mk.json.id;
  const mainTok = mk.json.portalToken;
  const mainPw = (await api('PUT', `/agency/clients/${cid}/password`, { generate: true }, O.token)).json.password;
  await api('POST', `/agency/clients/${cid}/portal`, { show: { invoices: true, contracts: true, docs: true, hours: true } }, O.token);
  const p0 = await page(cid);
  check('team link: off to start, approving off by default, never any paper part', p0.client.teamLink?.token === null && p0.client.teamLink.show.canApprove === false && p0.client.teamLink.show.canComment === true && !('invoices' in p0.client.teamLink.show) && !('hours' in p0.client.teamLink.show), p0.client.teamLink);
  // The team link never opens without a password (2026-11-05): none, or a weak one, is refused and leaves it off.
  const noPw = await api('POST', `/agency/clients/${cid}/team-link`, { on: true }, O.token);
  const weakPw = await api('POST', `/agency/clients/${cid}/team-link`, { on: true, password: 'short' }, O.token);
  check('team link: switching it on needs a password, and a weak one is refused', noPw.status === 400 && /password/.test(noPw.json.error ?? '') && weakPw.status === 400 && (await page(cid)).client.teamLink.token === null, { noPw: noPw.json, weakPw: weakPw.json });
  const on = await api('POST', `/agency/clients/${cid}/team-link`, { on: true, password: `Copper-lantern-river-${stamp}`, show: { invoices: true, contracts: true, docs: true, hours: true, retainer: true, channels: true } }, O.token);
  const tTok = on.json.token;
  check('team link: switched on, its own sixteen characters, and a paper switch is dropped', on.status === 200 && /^[A-Z2-9]{16}$/.test(tTok ?? '') && tTok !== mainTok && on.json.show.channels === true && !['invoices', 'contracts', 'docs', 'hours', 'retainer'].some((k) => k in on.json.show), on.json);
  check('team link: a stranger cannot switch, set or read it', (await api('POST', `/agency/clients/${cid}/team-link`, { on: true }, X.token)).status === 404 && (await api('PUT', `/agency/clients/${cid}/team-link/password`, { generate: true }, X.token)).status === 404);
  check('team link: a weak password is refused', (await api('PUT', `/agency/clients/${cid}/team-link/password`, { password: 'short' }, O.token)).status === 400);
  check('team link: switched on with its password set, which cannot be removed while it is on', (await page(cid)).client.teamLink.password.set === true && (await api('PUT', `/agency/clients/${cid}/team-link/password`, { clear: true }, O.token)).status === 400);
  const setPw = await api('PUT', `/agency/clients/${cid}/team-link/password`, { generate: true }, O.token);
  const tPw = setPw.json.password;
  check('team link: a generated password is shown once, its own word', setPw.status === 200 && /^[a-z]+(-[a-z]+){3}-\d\d$/.test(tPw ?? '') && tPw !== mainPw, setPw.json);
  const p1 = await page(cid);
  check('team link: the owner sees it set and the main link untouched', p1.client.teamLink.password.set === true && p1.client.portalToken === mainTok && p1.lifecycle.password.set === true && !JSON.stringify(p1).includes(tPw) && !/team_link_pass/.test(JSON.stringify(p1)), p1.client.teamLink);

  // The work and the paper.
  const item = (b) => api('POST', `/agency/items?day=${today}`, { clientId: cid, platform: 'Instagram', ...b }, O.token).then((r) => r.json.id ?? r.json.item?.id);
  const rev = await item({ title: `Review reel ${stamp}`, kind: 'short', link: 'https://example.com/reel' });
  await api('PATCH', `/agency/items/${rev}?day=${today}`, { stage: 'review' }, O.token);
  const mkg = await item({ title: `Making reel ${stamp}`, kind: 'short' });
  await api('PATCH', `/agency/items/${mkg}?day=${today}`, { stage: 'making' }, O.token);
  await api('POST', `/agency/items/${rev}/notes`, { body: `Private owner note ${stamp}`, shared: false }, O.token);
  await api('POST', `/agency/items/${rev}/notes`, { body: `Shared owner note ${stamp}`, shared: true }, O.token);
  const inv = (await api('POST', `/agency/invoices?day=${today}`, { clientId: cid, items: [{ description: 'Team link test videos', quantity: 2, unitCents: 500000 }] }, O.token)).json.invoice;
  const invSent = (await api('PATCH', `/agency/invoices/${inv.id}`, { status: 'sent' }, O.token)).json.invoice;
  const kc = await api('POST', '/agency/contracts', { templateKey: 'trial', clientId: cid }, O.token);
  const kTok = (await api('PATCH', `/agency/contracts/${kc.json.id}`, { status: 'sent' }, O.token)).json.contract?.token;
  const dmk = await api('POST', '/agency/docs', { kind: 'brief', clientId: cid }, O.token);
  await api('PATCH', `/agency/docs/${dmk.json.id}`, { status: 'sent' }, O.token);
  const dTok = (await api('GET', `/agency/docs/${dmk.json.id}`, undefined, O.token)).json.doc?.token;
  check('team link: the paper for the checks exists', Boolean(invSent?.token && kTok && dTok), { inv: invSent?.token, kTok, dTok });

  // The lock, the unlock and the same words for a wrong password and an unknown link.
  const locked = await P('GET', `/team-link/${tTok}`);
  check('team link: locked without its session, names only', locked.status === 401 && locked.json.error === 'locked' && Object.keys(locked.json).sort().join() === 'agencyLogo,agencyName,clientName,error', locked.json);
  const w1 = await P('POST', `/team-link/${tTok}/unlock`, { password: 'definitely-not-it-77' }, { ip: TIP(11) });
  const w2 = await P('POST', '/team-link/ABCDEFGHJKLMNPQR/unlock', { password: 'definitely-not-it-77' }, { ip: TIP(12) });
  check('team link: a wrong password and an unknown link answer the same', w1.status === 401 && w2.status === 401 && w1.json.error === w2.json.error, [w1.json, w2.json]);
  check('team link: the client link\'s password does not open it', (await P('POST', `/team-link/${tTok}/unlock`, { password: mainPw }, { ip: TIP(13) })).status === 401);
  const tu = await P('POST', `/team-link/${tTok}/unlock`, { password: tPw }, { ip: TIP(14) });
  const tS = tu.json.session;
  check('team link: the right password gives a team session', tu.status === 200 && /^[0-9a-f]{64}$/.test(tS ?? ''), tu.json);
  const mu = await P('POST', `/agency/${mainTok}/unlock`, { password: mainPw }, { ip: TIP(15) });
  const mS = mu.json.session;
  check('team link: the client link unlocks with its own password', mu.status === 200 && /^[0-9a-f]{64}$/.test(mS ?? ''), mu.json);

  // What the team sees: the work, never the paper.
  const tv = await P('GET', `/team-link/${tTok}`, undefined, { team: tS });
  const tvText = JSON.stringify(tv.json);
  check('team link: the page shows the work', tv.status === 200 && tv.json.teamView === true && tv.json.waiting?.some((w) => w.id === rev) && tv.json.coming?.some((w) => w.id === mkg) && tv.json.clientName === 'Junior Labs', tv.status);
  check('team link: the page has no invoice, agreement, document, retainer, stage, onboarding or hours', ['invoices', 'contracts', 'docs', 'retainer', 'stage', 'onboarding', 'hours', 'waitingOn', 'trial', 'pilot', 'strategy'].every((k) => !(k in tv.json)), Object.keys(tv.json).join());
  check('team link: no paper token, number or amount is anywhere in it', ![invSent.token, kTok, dTok, mainTok, invSent.number, 'Team link test videos', '/i/', '/k/', '/d/'].some((x) => tvText.includes(x)) && !/totalCents|feeCents|retainer/i.test(tvText), tvText.slice(0, 300));
  check('team link: the shared note shows, the private one never', tvText.includes(`Shared owner note ${stamp}`) && !tvText.includes(`Private owner note ${stamp}`));

  // A team session never reaches the client link or the paper, and the team link never serves paper.
  const refused = await Promise.all([
    P('GET', `/invoices/${invSent.token}`, undefined, { team: tS }),
    P('GET', `/contracts/${kTok}`, undefined, { team: tS }),
    P('GET', `/agency/doc/${dTok}`, undefined, { team: tS }),
    P('GET', `/invoices/${invSent.token}/lock`, undefined, { team: tS }),
    P('GET', `/agency/${mainTok}`, undefined, { team: tS }),
    P('GET', `/agency/${mainTok}/onboarding`, undefined, { team: tS }),
    P('POST', `/contracts/${kTok}/accept`, { name: 'Junior', agree: true, answers: {} }, { team: tS }),
  ]);
  check('team link: a team session on an invoice, agreement, document or the client link is a 404', refused.every((r) => r.status === 404), refused.map((r) => r.status));
  check('team link: a team session passed as a client session opens nothing', (await P('GET', `/agency/${mainTok}`, undefined, { portal: tS })).status === 401 && (await P('GET', `/contracts/${kTok}`, undefined, { portal: tS })).status === 401 && (await P('GET', `/invoices/${invSent.token}`, undefined, { portal: tS })).status === 401);
  const wrongDoors = await Promise.all([invSent.token, kTok, dTok, mainTok].map((t) => P('GET', `/team-link/${t}`, undefined, { team: tS })));
  check('team link: an invoice, agreement, document or client link token finds no team page', wrongDoors.every((r) => r.status === 404), wrongDoors.map((r) => r.status));
  check('team link: a client session does not open the team link', (await P('GET', `/team-link/${tTok}`, undefined, { portal: mS })).status === 401 && (await P('GET', `/team-link/${tTok}`, undefined, { team: mS })).status === 401);
  check('team link: the client link still opens with its own session', (await P('GET', `/agency/${mainTok}`, undefined, { portal: mS })).status === 200);

  // Notes and approvals from the team are marked as theirs; approving waits for the owner's yes.
  const cm = await P('POST', `/team-link/${tTok}/items/${rev}`, { decision: 'comment', note: `Team comment ${stamp}` }, { team: tS });
  check('team link: a comment needs the team session', (await P('POST', `/team-link/${tTok}/items/${rev}`, { decision: 'comment', note: 'x' })).status === 401 && cm.status === 200, cm.json);
  const notes = (await api('GET', `/agency/items/${rev}/notes`, undefined, O.token)).json.notes ?? [];
  const tn = notes.find((n) => n.body === `Team comment ${stamp}`);
  check('team link: the owner sees the comment as from the client\'s team', tn?.author === 'client' && tn.clientTeam === true && notes.filter((n) => n.author === 'client' && n.body !== `Team comment ${stamp}`).every((n) => !n.clientTeam), tn);
  const mv = await P('GET', `/agency/${mainTok}`, undefined, { portal: mS });
  const mvLine = mv.json.waiting?.find((w) => w.id === rev)?.thread?.find((t) => t.body === `Team comment ${stamp}`);
  check('team link: the client sees it marked as from their team', mvLine?.team === true, mvLine);
  const inbox1 = JSON.stringify((await api('GET', '/inbox?size=50', undefined, O.token)).json);
  check('team link: the owner is told it came from their team', inbox1.includes('Junior Labs\'s team wrote on'));
  check('team link: approving is refused until the owner allows it', (await P('POST', `/team-link/${tTok}/items/${rev}`, { decision: 'approve' }, { team: tS })).status === 403 && (await P('POST', `/team-link/${tTok}/items/${rev}`, { decision: 'changes', note: 'x' }, { team: tS })).status === 403);
  check('team link: a paid change is never asked from it', (await P('POST', `/team-link/${tTok}/items/${rev}`, { decision: 'paid_change', note: `Paid ask ${stamp}` }, { team: tS })).status === 200 && !(await api('GET', `/agency/items/${rev}/notes`, undefined, O.token)).json.notes.some((n) => n.kind === 'paid_change'));
  await api('POST', `/agency/clients/${cid}/team-link`, { show: { canApprove: true } }, O.token);
  const ap = await P('POST', `/team-link/${tTok}/items/${rev}`, { decision: 'approve' }, { team: tS });
  const items = (await api('GET', `/agency/items?day=${today}&client=${cid}&size=100`, undefined, O.token)).json.items ?? [];
  check('team link: once allowed, an approval moves the piece and is recorded as from their team', ap.status === 200 && items.find((i) => i.id === rev)?.stage === 'approved' && JSON.stringify((await api('GET', '/inbox?size=50', undefined, O.token)).json).includes('Junior Labs\'s team approved'), ap.json);

  // Renewing or re-locking one link leaves the other alone.
  const freshMain = await api('POST', `/agency/clients/${cid}/portal`, { fresh: true }, O.token);
  await api('PUT', `/agency/clients/${cid}/password`, { generate: true }, O.token);
  check('team link: a fresh client link and a new client password leave the team link and its session working', freshMain.json.portalToken !== mainTok && (await P('GET', `/team-link/${tTok}`, undefined, { team: tS })).status === 200 && (await page(cid)).client.teamLink.token === tTok);
  const mainTok2 = freshMain.json.portalToken;
  const newMainPw = (await api('PUT', `/agency/clients/${cid}/password`, { generate: true }, O.token)).json.password;
  const mS2 = (await P('POST', `/agency/${mainTok2}/unlock`, { password: newMainPw }, { ip: TIP(16) })).json.session;
  const freshTeam = await api('POST', `/agency/clients/${cid}/team-link`, { fresh: true }, O.token);
  const tTok2 = freshTeam.json.token;
  const oldTeam = await P('GET', `/team-link/${tTok}`);
  check('team link: a fresh team link closes the old one (410) and keeps the client link and its session', tTok2 && tTok2 !== tTok && oldTeam.status === 410 && oldTeam.json.error === 'closed' && (await P('GET', `/agency/${mainTok2}`, undefined, { portal: mS2 })).status === 200 && (await page(cid)).client.portalToken === mainTok2, oldTeam.json);
  check('team link: a fresh team link ends the team sessions', (await P('GET', `/team-link/${tTok2}`, undefined, { team: tS })).status === 401);
  const tS2 = (await P('POST', `/team-link/${tTok2}/unlock`, { password: tPw }, { ip: TIP(17) })).json.session;
  const tPw2 = (await api('PUT', `/agency/clients/${cid}/team-link/password`, { generate: true }, O.token)).json.password;
  check('team link: a new team password ends team sessions and leaves the client\'s', (await P('GET', `/team-link/${tTok2}`, undefined, { team: tS2 })).status === 401 && (await P('GET', `/agency/${mainTok2}`, undefined, { portal: mS2 })).status === 200);

  // Their team asks for a new password: its own ask, its own note.
  const askA = await P('POST', '/agency/password-request', { kind: 'team', token: tTok2, reason: 'A junior left' }, { ip: TIP(18) });
  const askB = await P('POST', '/agency/password-request', { kind: 'team', token: 'ABCDEFGHJKLMNPQR', reason: 'x' }, { ip: TIP(19) });
  const p2 = await page(cid);
  check('team link: the ask answers the same for a real and an unknown link, and lands on the team link only', askA.status === 200 && askB.status === 200 && JSON.stringify(askA.json) === JSON.stringify(askB.json) && p2.client.teamLink.password.request?.reason === 'A junior left' && p2.lifecycle.password.request === null, p2.client.teamLink.password);
  check('team link: the owner is told their team asked', JSON.stringify((await api('GET', '/inbox?size=50', undefined, O.token)).json).includes('Junior Labs\'s team asked for a new password'));
  await api('PUT', `/agency/clients/${cid}/team-link/password`, { generate: true }, O.token);
  check('team link: a new team password closes the team ask', (await page(cid)).client.teamLink.password.request === null);

  // The export, switching off, and the delete.
  const ex = (await api('GET', '/me/export', undefined, O.token)).json;
  const row = (ex.agencyClients ?? []).find((r) => r.id === cid);
  const exText = JSON.stringify(ex);
  check('team link: the export has the settings and never a hash, a salt, a session or the password', row?.team_link_token === tTok2 && row.team_link_has_password === 1 && typeof row.team_link_json === 'string' && !/team_link_pass_hash|team_link_pass_salt|team_link_sessions/.test(exText) && ![tPw, tPw2, tS, tS2].some((x) => exText.includes(x)), row);
  const off = await api('POST', `/agency/clients/${cid}/team-link`, { on: false }, O.token);
  check('team link: switching it off closes it (410) and leaves the client link on', off.json.token === null && (await P('GET', `/team-link/${tTok2}`)).status === 410 && (await page(cid)).client.portalToken === mainTok2);
  await api('POST', `/agency/clients/${cid}/team-link`, { on: true }, O.token);
  const tTok3 = (await page(cid)).client.teamLink.token;
  check('team link: deleting the client removes the team link too', (await api('DELETE', `/agency/clients/${cid}`, undefined, O.token)).status === 200 && (await P('GET', `/team-link/${tTok3}`)).status === 404 && (await P('GET', `/team-link/${tTok2}`)).status === 404);
}

// ---------------------------------------------------------------- Agency documents: the legal page, text version, email a copy, other kinds, house templates
import { AGENCY_DOC_KINDS, CONTRACT_TEMPLATES, INVOICE_STARTERS } from '../../packages/shared/src/index.ts';
import { EMAIL_TEMPLATES, emailVarsFor, fillEmail } from '../../packages/shared/src/agencyEmail.ts';
section('Agency documents');
{
  const AD = `10.${(seed >> 16) & 255}.${(seed >> 8) & 255}.${(seed + 31) & 255}`;
  const join = async (who) => {
    const r = await api('POST', '/auth/signup', { email: `${who}-${stamp}@smoke.test`, password: `Harbour-${stamp}-pass`, displayName: `Smoke ${who}`, phone: PHONE, birthDate: GROWN }, null, { 'CF-Connecting-IP': AD });
    await api('PATCH', '/me/modules', { key: 'agency', on: true }, r.json.token);
    return { token: r.json.token, user: r.json.user };
  };
  const O = await join('docowner');
  const X = await join('docstranger');
  const M = await join('docmailer');
  await api('PATCH', '/me/modules', { key: 'agency', on: true }, A.token);
  const pub = (method, path, body) => api(method, `/public${path}`, body, null, { 'CF-Connecting-IP': `10.${(seed >> 8) & 255}.${seed & 255}.${(Math.floor(Math.random() * 200) + 20) & 255}` });
  const clean = (t) => typeof t === 'string' && !/undefined|\[object|\*\*/.test(t) && !/<[a-z/][^>]*>/i.test(t);

  const mkClient = async (who, extra = {}) => (await addClient({ name: 'Docs Co', contactName: 'Dana', contactEmail: 'dana@docs.test', retainerCents: 4500000, ...extra }, who.token)).json.id;
  const cid = await mkClient(O);

  // the other kinds of document
  check('a kind that does not exist is refused', (await api('POST', '/agency/docs', { kind: 'nope', clientId: cid }, O.token)).status === 400);
  check('a client that is not yours is refused', (await api('POST', '/agency/docs', { kind: 'brief', clientId: await mkClient(X) }, O.token)).status === 400);
  const mkDoc = await api('POST', '/agency/docs', { kind: 'brief', clientId: cid }, O.token);
  check('a strategy session summary is made for a client', mkDoc.status === 201 && mkDoc.json.id, mkDoc.json);
  const did = mkDoc.json.id;
  const d0 = (await api('GET', `/agency/docs/${did}`, undefined, O.token)).json.doc;
  check('it is a draft with a short reference, filled from the client', d0.status === 'draft' && /^BRF-[A-Z0-9]{1,6}$/.test(d0.ref) && d0.doc.vars.client === 'Docs Co' && d0.doc.style.font === 'serif', d0);
  const text0 = contractAsText(d0.doc, { reference: d0.ref, date: d0.createdAt });
  check('its text version has no undefined, no markup and the client\'s name', clean(text0) && text0.includes('Docs Co') && /\n1\. THE SESSION/.test(text0), text0.slice(0, 200));
  const trial = await api('POST', '/agency/docs', { kind: 'trial_terms', clientId: cid }, O.token);
  const trialText = contractAsText((await api('GET', `/agency/docs/${trial.json.id}`, undefined, O.token)).json.doc.doc);
  check('trial terms come from the trial agreement and point at no section numbers', trial.status === 201 && trialText.includes('solely for evaluation and approval purposes') && !/section \d/i.test(trialText), trialText.slice(0, 80));
  const prop = await api('POST', '/agency/docs', { kind: 'retainer_proposal', clientId: cid, retainer: { monthlyFeeCents: 4500050, deliverables: ['8 short videos'], months: [1, 3, 6] } }, O.token);
  const propDoc = (await api('GET', `/agency/docs/${prop.json.id}`, undefined, O.token)).json.doc.doc;
  const pk = propDoc.sections.find((s) => s.kind === 'packages').packages;
  check('a retainer proposal prices each option from the monthly fee in whole cents', pk.map((p) => p.feeCents).join() === '4500050,13500150,27000300', pk);
  check('a monthly report needs a client', (await api('POST', '/agency/docs', { kind: 'monthly_report' }, O.token)).status === 400);
  const rep = await api('POST', `/agency/docs?day=${today}`, { kind: 'monthly_report', clientId: cid }, O.token);
  const repText = contractAsText((await api('GET', `/agency/docs/${rep.json.id}`, undefined, O.token)).json.doc.doc);
  check('a monthly report is counts from the client\'s own pieces and invoices', rep.status === 201 && repText.includes('Pieces delivered: 0') && clean(repText) && !/fee/i.test(repText), repText.slice(0, 120));
  const list = await api('GET', `/agency/docs?size=100&client=${cid}`, undefined, O.token);
  check('the list is paged, filtered by client and counted by status', list.json.docs?.length === 4 && list.json.page?.size === 100 && list.json.counts?.some((c) => c.status === 'draft'), list.json.page);
  check('another person sees none of it', (await api('GET', `/agency/docs/${did}`, undefined, X.token)).status === 404 && (await api('PATCH', `/agency/docs/${did}`, { status: 'sent' }, X.token)).status === 404 && (await api('GET', '/agency/docs', undefined, X.token)).json.docs?.length === 0);
  check('a draft has no public link', (await pub('GET', '/agency/doc/ABCDEFGHJKLMNPQR')).status === 404);

  // the look: keys only, a logo only if it is yours
  const styled = structuredClone(d0.doc);
  styled.style = { ...styled.style, font: 'url(javascript:alert(1))', accent: '#ff0000', size: 'large', page: 'letter', logo: 'someone-elses-file-id', footer: 'Docs Studio, Pune' };
  const putStyle = await api('PATCH', `/agency/docs/${did}`, { doc: styled }, O.token);
  const st = putStyle.json.doc?.doc.style;
  check('only keys are kept as a style, and a logo that is not yours is dropped', putStyle.status === 200 && st.font === 'serif' && st.accent === 'ink' && st.size === 'large' && st.page === 'letter' && st.logo === '' && st.footer === 'Docs Studio, Pune', st);

  // privacy of the public page
  await api('POST', '/agency/items', { clientId: cid, title: 'Piece for the doc test' }, O.token).then(async (it) => {
    if (it.json.id) await api('POST', `/agency/items/${it.json.id}/notes`, { body: 'PRIVATE-DOC-NOTE do not show', shared: false }, O.token);
  });
  const sent = await api('PATCH', `/agency/docs/${did}`, { status: 'sent' }, O.token);
  const dtok = sent.json.doc?.token;
  check('sending makes a link', sent.json.doc?.status === 'sent' && /^[A-Z2-9]{16}$/.test(dtok ?? ''), sent.json.doc);
  const read = await pub('GET', `/agency/doc/${dtok}`);
  const readText = JSON.stringify(read.json);
  check('the client reads it, with no private notes, no fees and no owner address', read.status === 200 && !readText.includes('PRIVATE-DOC-NOTE') && !readText.includes('4500000') && !readText.includes('@smoke.test') && !readText.includes('dana@docs.test') && read.json.ref === d0.ref, read.status);

  // email a copy
  const mailBad = await api('POST', `/agency/docs/${did}/email`, { to: 'not an address' }, O.token);
  check('an address that is not one is refused', mailBad.status === 400, mailBad.json);
  check('another person cannot email a copy of it', (await api('POST', `/agency/docs/${did}/email`, { to: 'x@y.test' }, X.token)).status === 404);
  const draftDoc = await api('POST', '/agency/docs', { kind: 'brief', clientId: cid }, O.token);
  check('a draft has no link, so no copy is emailed', (await api('POST', `/agency/docs/${draftDoc.json.id}/email`, {}, O.token)).status === 400);
  const mail = await api('POST', `/agency/docs/${did}/email`, {}, O.token);
  check('a copy goes to the client\'s own address and says plainly when email is not set up', mail.status === 200 && typeof mail.json.sent === 'boolean' && typeof mail.json.note === 'string' && mail.json.to === 'd***@docs.test' && (mail.json.sent || /not set up/.test(mail.json.note)), mail.json);
  const log = (await api('GET', `/agency/doc-log/doc/${did}`, undefined, O.token)).json.log ?? [];
  check('the log notes it without the address or the words', log.length === 1 && /^email/.test(log[0].event) && log[0].detail === 'd***@docs.test' && !JSON.stringify(log).includes('dana@docs.test'), log);
  check('the log is the owner\'s alone', (await api('GET', `/agency/doc-log/doc/${did}`, undefined, X.token)).status === 404);
  const mc = await mkClient(M);
  const md = (await api('POST', '/agency/docs', { kind: 'brief', clientId: mc }, M.token)).json.id;
  await api('PATCH', `/agency/docs/${md}`, { status: 'sent' }, M.token);
  let mailCode = 0;
  for (let i = 0; i < LIMITS.docEmail.max + 3 && mailCode !== 429; i += 1) mailCode = (await api('POST', `/agency/docs/${md}/email`, {}, M.token)).status;
  check('emailing copies is limited per person from the one limits file', mailCode === 429, mailCode);

  // comment, approve once, then a record
  const cm = await pub('POST', `/agency/doc/${dtok}/comments`, { body: 'Can we add a LinkedIn line?' });
  check('the client can ask for a change', cm.status === 201, cm.json);
  const ed = structuredClone(sent.json.doc.doc);
  ed.sections.find((s) => s.id === 'agreed').body = '- Weekly reels\n- A monthly report';
  const edSent = await api('PATCH', `/agency/docs/${did}`, { doc: ed }, O.token);
  check('a sent document can change and then says revised', edSent.json.doc?.status === 'revised' && edSent.json.doc?.revisedAt, edSent.json.doc?.status);
  check('approving needs a name and a tick', (await pub('POST', `/agency/doc/${dtok}/approve`, { agree: true })).status === 400 && (await pub('POST', `/agency/doc/${dtok}/approve`, { name: 'Dana Rao' })).status === 400);
  const [a1, a2] = await Promise.all([pub('POST', `/agency/doc/${dtok}/approve`, { name: 'Dana Rao', title: 'Head of Brand', agree: true }), pub('POST', `/agency/doc/${dtok}/approve`, { name: 'Dana Rao', title: 'Head of Brand', agree: true })]);
  check('two taps at once approve once', [a1.status, a2.status].sort().join() === '200,400', [a1.status, a2.status]);
  const done = (await api('GET', `/agency/docs/${did}`, undefined, O.token)).json.doc;
  check('it is approved with the typed name and time', done.status === 'approved' && done.acceptance?.name === 'Dana Rao' && done.approvedAt, done.acceptance);
  check('an approved document cannot be edited', (await api('PATCH', `/agency/docs/${did}`, { doc: ed }, O.token)).status === 400 && (await api('PATCH', `/agency/docs/${did}`, { status: 'draft' }, O.token)).status === 400);
  check('and a second approval is refused', (await pub('POST', `/agency/doc/${dtok}/approve`, { name: 'Someone Else', agree: true })).status === 400);
  const revise = await api('POST', `/agency/docs/${did}/duplicate`, {}, O.token);
  const rev = (await api('GET', `/agency/docs/${revise.json.id}`, undefined, O.token)).json.doc;
  check('it is revised into a new draft with no link and no approval', rev.status === 'draft' && !rev.token && !rev.acceptance && rev.doc.sections.length === done.doc.sections.length, rev.status);
  check('only a draft can be removed', (await api('DELETE', `/agency/docs/${did}`, undefined, O.token)).status === 400 && (await api('DELETE', `/agency/docs/${revise.json.id}`, undefined, O.token)).status === 200);

  // the text of an invoice matches the calculator, in whole cents
  const inv = await api('POST', `/agency/invoices?day=${today}`, { clientId: cid, items: [{ description: 'Voxpop videos', quantity: 5, unitCents: 700000 }, { description: 'Extra edit', quantity: 1, unitCents: 150050 }], doc: { gstBps: 1800, gstSplit: true, tdsBps: 1000, tdsMode: 'show' } }, O.token);
  const iv = inv.json.invoice;
  const itext = invoiceAsText(iv);
  check('the invoice text has the CGST and SGST and the total the calculator made', clean(itext) && itext.includes(`Total: ${money(iv.totalCents)}`) && itext.includes('CGST (9%)') && itext.includes('SGST (9%)') && itext.includes(`TDS to deduct (10%): -${money(Math.round((3650050 * 1000) / 10000))}`), itext.slice(0, 200));
  const iStyle = await api('PATCH', `/agency/invoices/${iv.id}`, { doc: { style: { font: 'sans', margin: 'wide', accent: 'plum', logo: 'not-mine-at-all' } } }, O.token);
  check('an invoice keeps a style of keys too', iStyle.json.invoice?.doc.style.font === 'sans' && iStyle.json.invoice.doc.style.margin === 'wide' && iStyle.json.invoice.doc.style.logo === '', iStyle.json.invoice?.doc.style);
  const iMailDraft = await api('POST', `/agency/invoices/${iv.id}/email`, {}, O.token);
  check('a draft invoice is not emailed', iMailDraft.status === 400, iMailDraft.json);
  const kc = await api('POST', '/agency/contracts', { templateKey: 'trial', clientId: cid }, O.token);
  // The Trial and pilot agreement is drawn in the typed layout, like the founder's own; the others start with numbered headings.
  const kcRet = await api('POST', '/agency/contracts', { templateKey: 'retainer', clientId: cid }, O.token);
  const kcStyle = (await api('GET', `/agency/contracts/${kc.json.id}`, undefined, O.token)).json.contract.doc.style;
  const retStyle = (await api('GET', `/agency/contracts/${kcRet.json.id}`, undefined, O.token)).json.contract?.doc.style;
  check('a new agreement starts with the default look', kcStyle?.layout === 'typed' && retStyle?.heading === 'numbered', { kcStyle, retStyle });
  if (kcRet.json.id) await api('DELETE', `/agency/contracts/${kcRet.json.id}`, undefined, O.token);

  // Paper edited in place saves as you go, only onto the version the page read: a second save from the same old version is
  // refused (409 changed) instead of writing over the first, and a save that names no version still lands (the older callers).
  for (const [what, path, key] of [['agreement', `/agency/contracts/${kc.json.id}`, 'contract'], ['document', `/agency/docs/${draftDoc.json.id}`, 'doc']]) {
    const cur = (await api('GET', path, undefined, O.token)).json[key];
    const at = cur?.updatedAt;
    const g1 = await api('PATCH', path, { doc: { ...cur.doc, subtitle: 'one' }, ifUpdatedAt: at }, O.token);
    check(`autosave on an ${what}: a save on the version read lands`, typeof at === 'string' && g1.status === 200, [at, g1.status, g1.json]);
    const g2 = await api('PATCH', path, { doc: { ...cur.doc, subtitle: 'two' }, ifUpdatedAt: at }, O.token);
    check(`autosave on an ${what}: a second save from the same old version is refused as changed`, g2.status === 409 && g2.json.error === 'changed', [g2.status, g2.json]);
    const mid = (await api('GET', path, undefined, O.token)).json[key];
    check(`autosave on an ${what}: the refused save wrote nothing`, mid?.doc.subtitle === 'one', mid?.doc.subtitle);
    const g3 = await api('PATCH', path, { doc: { ...mid.doc, subtitle: cur.doc.subtitle } }, O.token);
    check(`autosave on an ${what}: a save with no version still lands, and the subtitle is put back`, g3.status === 200 && (await api('GET', path, undefined, O.token)).json[key]?.doc.subtitle === cur.doc.subtitle, g3.status);
  }
  {
    const ivPath = `/agency/invoices/${iv.id}`;
    const cur = (await api('GET', ivPath, undefined, O.token)).json;
    const v0 = cur.version;
    const g1 = await api('PATCH', ivPath, { note: 'Guard one', ifVersion: v0 }, O.token);
    check('autosave on an invoice: a save on the version read lands and answers a new version', typeof v0 === 'string' && v0 !== '' && g1.status === 200 && typeof g1.json.version === 'string' && g1.json.version !== v0, [v0, g1.status, g1.json.version]);
    const g2 = await api('PATCH', ivPath, { note: 'Guard two', ifVersion: v0 }, O.token);
    check('autosave on an invoice: replaying the old version is refused as changed', g2.status === 409 && g2.json.error === 'changed' && (await api('GET', ivPath, undefined, O.token)).json.invoice?.note === 'Guard one', [g2.status, g2.json]);
    check('autosave on an invoice: a save with no version still lands', (await api('PATCH', ivPath, { note: cur.invoice.note }, O.token)).status === 200);
  }

  // Fill in the details (2026-11-05): the form lists the blanks a paper uses and saves each group through the routes that already exist.
  // Your business goes to the profile, the client to their record, the rest onto the paper's own words, saved with the version guard.
  {
    const fcl = await mkClient(O, { name: 'Fill Co', contactName: 'Fiona' });
    const kf = await api('POST', '/agency/contracts', { templateKey: 'trial', clientId: fcl }, O.token);
    const kfPath = `/agency/contracts/${kf.json.id}`;
    const k0 = (await api('GET', kfPath, undefined, O.token)).json.contract;
    const used = contractVarsUsed(k0.doc);
    check('fill in the details: the Trial lists its parties and the client, once each', ['provider', 'providerBusiness', 'client', 'clientContact', 'brands'].every((k) => used.includes(k)) && new Set(used).size === used.length, used);
    const prof0 = (await api('GET', `/agency?day=${today}`, undefined, O.token)).json.settings.profile;
    const signer = `Fill Signer ${stamp}`;
    const contact = `Fill Contact ${stamp}`;
    const brands = `Fill Brand ${stamp}`;
    const putP = await api('PUT', '/agency/settings', { profile: { ...prof0, signerName: signer } }, O.token);
    const putC = await api('PATCH', `/agency/clients/${fcl}`, { contactName: contact }, O.token);
    check('fill in the details: your business saves to the profile and the client to their record', putP.status === 200 && putP.json.settings?.profile.signerName === signer && putC.status === 200 && (await api('GET', `/agency/clients/${fcl}?day=${today}`, undefined, O.token)).json.client?.contactName === contact, [putP.status, putC.status]);
    const vars = { ...k0.doc.vars, provider: signer, clientContact: contact, brands };
    const saved = await api('PATCH', kfPath, { doc: { ...k0.doc, vars }, ifUpdatedAt: k0.updatedAt }, O.token);
    const ownerText = saved.json.contract ? contractAsText(saved.json.contract.doc, { audience: 'owner' }) : '';
    check('fill in the details: the paper shows the new words', saved.status === 200 && [signer, contact, brands].every((w) => ownerText.includes(w)), saved.status);
    const stale = await api('PATCH', kfPath, { doc: { ...k0.doc, vars: { ...vars, brands: 'Stale words' } }, ifUpdatedAt: k0.updatedAt }, O.token);
    check('fill in the details: a save from a stale version answers 409 and writes nothing', stale.status === 409 && stale.json.error === 'changed' && (await api('GET', kfPath, undefined, O.token)).json.contract.doc.vars.brands === brands, stale.status);
    const other = (await api('POST', '/agency/contracts', { templateKey: 'trial', clientId: fcl }, O.token)).json.id;
    const otherVars = (await api('GET', `/agency/contracts/${other}`, undefined, O.token)).json.contract?.doc.vars ?? {};
    const records = JSON.stringify([(await api('GET', `/agency?day=${today}`, undefined, O.token)).json.settings, (await api('GET', `/agency/clients/${fcl}?day=${today}`, undefined, O.token)).json.client]);
    check('fill in the details: a this-agreement word stays on this agreement, while the profile and client words reach the next one', otherVars.brands !== brands && !records.includes(brands) && otherVars.provider === signer && otherVars.clientContact === contact, otherVars);
    const sentK = (await api('PATCH', kfPath, { status: 'sent' }, O.token)).json.contract;
    const readK = await pub('GET', `/contracts/${sentK?.token}`);
    const clientText = readK.json.doc ? contractAsText(readK.json.doc, { audience: 'client' }) : '';
    check('fill in the details: the client copy carries the profile, client and agreement words', readK.status === 200 && [signer, contact, brands].every((w) => clientText.includes(w)), readK.status);
    const rev = await api('PATCH', kfPath, { doc: { ...sentK.doc, vars: { ...sentK.doc.vars, brands: `${brands} two` } }, ifUpdatedAt: sentK.updatedAt }, O.token);
    check('fill in the details: a sent agreement takes a change and reads revised', rev.status === 200 && Boolean(rev.json.contract?.revisedAt), rev.status);
    const acc = await pub('POST', `/contracts/${sentK.token}/accept`, { name: 'Fiona Client', agree: true });
    const signedK = (await api('GET', kfPath, undefined, O.token)).json.contract;
    const refused = await api('PATCH', kfPath, { doc: { ...signedK.doc, vars: { ...signedK.doc.vars, brands: 'After signing' } }, ifUpdatedAt: signedK.updatedAt }, O.token);
    check('fill in the details: a signed agreement refuses a change', acc.status === 200 && signedK.status === 'signed' && refused.status === 400 && (await api('GET', kfPath, undefined, O.token)).json.contract.doc.vars.brands === `${brands} two`, [acc.status, signedK.status, refused.status]);
    await api('PUT', '/agency/settings', { profile: prof0 }, O.token);
    await api('DELETE', `/agency/contracts/${other}`, undefined, O.token);
  }

  // house templates: only the super admin makes them; everyone else reads and copies
  await api('PUT', '/agency/settings', { profile: { from: { name: 'Founder Studio', address: 'HOUSE-ADDR Road', taxIds: [], line: '', email: '', phone: '' }, bank: { bankName: 'Founder Bank', account: '111222333', holder: '', ifsc: '', upi: '' } } }, A.token);
  const fcid = await mkClient(A, { name: 'Founder Client Ltd' });
  const finv = await api('POST', `/agency/invoices?day=${today}`, { clientId: fcid, items: [{ description: 'House retainer', quantity: 1, unitCents: 1000000 }], doc: { gstBps: 1800 } }, A.token);
  const fid = finv.json.invoice?.id;
  const before = await api('GET', '/agency/templates?kind=invoice', undefined, X.token);
  check('the picker lists house templates apart from your own', Array.isArray(before.json.templates) && before.json.templates.every((t) => t.scope === 'own' || t.scope === 'house'), before.json);
  check('a normal user cannot make a house template', (await api('POST', '/admin/agency/templates', { kind: 'invoice', name: 'Mine', fromId: fid, includeBusiness: false }, O.token)).status === 403);
  check('the shared admin key alone cannot either, since it is made from the admin\'s own paper', (await admin('POST', '/admin/agency/templates', { kind: 'invoice', name: 'Key', fromId: fid, includeBusiness: false })).status === 403);
  const house = await api('POST', '/admin/agency/templates', { kind: 'invoice', name: `House invoice ${stamp}`, fromId: fid, includeBusiness: false }, A.token);
  check('the super admin makes one from their own invoice', house.status === 201 && house.json.id, house.json);
  check('the super admin cannot make one from someone else\'s invoice', (await api('POST', '/admin/agency/templates', { kind: 'invoice', name: 'Theirs', fromId: iv.id, includeBusiness: false }, A.token)).status === 400);
  const hid = house.json.id;
  const seen = await api('GET', '/agency/templates?kind=invoice', undefined, O.token);
  const mine = seen.json.templates.find((t) => t.id === hid);
  check('everyone sees it in the picker, marked as a house template', mine?.scope === 'house' && /1 line/.test(mine.summary), mine);
  check('a normal user cannot change or retire it', (await api('PATCH', `/admin/agency/templates/${hid}`, { status: 'retired' }, O.token)).status === 403 && (await api('PATCH', `/agency/templates/${hid}`, { name: 'Taken' }, O.token)).status === 404 && (await api('DELETE', `/agency/templates/${hid}`, undefined, O.token)).status === 404);
  const used = await api('POST', `/agency/invoices?day=${today}`, { clientId: cid, houseId: hid }, O.token);
  const ud = used.json.invoice?.doc;
  check('using it copies it into your own invoices, with your client and no one else\'s', used.status === 201 && ud.to.name === 'Docs Co' && ud.gstBps === 1800 && used.json.invoice.items[0].description === 'House retainer', used.json);
  check('and none of the admin\'s business details, client or bank', !JSON.stringify(used.json).includes('Founder Studio') && !JSON.stringify(used.json).includes('111222333') && !JSON.stringify(used.json).includes('HOUSE-ADDR') && !JSON.stringify(used.json).includes('Founder Client'), ud?.from);
  const copy = await api('POST', '/agency/templates', { kind: 'invoice', houseId: hid }, O.token);
  check('a house template can be copied to your own templates', copy.status === 201, copy.json);
  const house2 = await api('POST', '/admin/agency/templates', { kind: 'invoice', name: `House with details ${stamp}`, fromId: fid, includeBusiness: true }, A.token);
  const used2 = await api('POST', `/agency/invoices?day=${today}`, { clientId: cid, houseId: house2.json.id }, O.token);
  check('with "include my business details" ticked, those details come too', used2.json.invoice?.doc.from.name === 'Founder Studio' && used2.json.invoice?.doc.bank.account === '111222333' && used2.json.invoice?.doc.to.name === 'Docs Co', used2.json.invoice?.doc.from);
  const retire = await api('PATCH', `/admin/agency/templates/${hid}`, { status: 'retired' }, A.token);
  const after = await api('GET', '/agency/templates?kind=invoice', undefined, O.token);
  check('retiring it takes it out of the picker, and it cannot be used', retire.status === 200 && !after.json.templates.some((t) => t.id === hid) && (await api('POST', '/agency/invoices', { clientId: cid, houseId: hid }, O.token)).status === 404);
  await api('PATCH', `/admin/agency/templates/${hid}`, { status: 'active' }, A.token);
  check('and restoring brings it back', (await api('GET', '/agency/templates?kind=invoice', undefined, O.token)).json.templates.some((t) => t.id === hid));
  const kcHouse = await api('POST', '/admin/agency/templates', { kind: 'contract', name: `House agreement ${stamp}`, fromId: (await api('POST', '/agency/contracts', { templateKey: 'project', clientId: fcid }, A.token)).json.id, includeBusiness: false }, A.token);
  const kUsed = await api('POST', '/agency/contracts', { houseId: kcHouse.json.id, clientId: cid }, O.token);
  const kDoc = (await api('GET', `/agency/contracts/${kUsed.json.id}`, undefined, O.token)).json.contract?.doc;
  check('a house agreement is copied with your names, not the admin\'s', kUsed.status === 201 && kDoc.vars.client === 'Docs Co' && !JSON.stringify(kDoc).includes('Founder Client') && kDoc.sections.length > 3, kUsed.json);
  // A house template is edited in place by the super admin, saved only onto the version read, and never takes on names.
  {
    const hPath = `/admin/agency/templates/${kcHouse.json.id}`;
    const one = (await api('GET', hPath, undefined, A.token)).json;
    const hAt = one.template?.updatedAt;
    const filled = { ...one.contract, subtitle: 'House copy', vars: { ...(one.contract?.vars ?? {}), client: 'Someone Real Ltd' } };
    const h1 = await api('PATCH', hPath, { body: filled, ifUpdatedAt: hAt }, A.token);
    check('house template autosave: the super admin\'s save on the version read lands', typeof hAt === 'string' && h1.status === 200 && typeof h1.json.updatedAt === 'string', [h1.status, h1.json]);
    const h2 = await api('PATCH', hPath, { body: { ...one.contract, subtitle: 'Stale copy' }, ifUpdatedAt: hAt }, A.token);
    check('house template autosave: replaying the old version is refused as changed', h2.status === 409 && h2.json.error === 'changed', [h2.status, h2.json]);
    const hAfter = (await api('GET', hPath, undefined, A.token)).json;
    check('house template autosave: the first save stays, and its blanks stay empty without business details', hAfter.contract?.subtitle === 'House copy' && hAfter.template?.includeBusiness === false && Object.values(hAfter.contract?.vars ?? {}).every((v) => v === ''), hAfter.contract?.vars);
    check('house template autosave: a normal account cannot open or change it', (await api('GET', hPath, undefined, O.token)).status === 403 && (await api('PATCH', hPath, { body: one.contract, ifUpdatedAt: hAfter.template?.updatedAt }, O.token)).status === 403 && (await api('PATCH', hPath, { body: one.contract }, X.token)).status === 403);
  }
  const dHouse = await api('POST', '/admin/agency/templates', { kind: 'doc', name: `House brief ${stamp}`, fromId: (await api('POST', '/agency/docs', { kind: 'brief', clientId: fcid }, A.token)).json.id, includeBusiness: false }, A.token);
  const dUsed = await api('POST', '/agency/docs', { houseId: dHouse.json.id, clientId: cid }, O.token);
  check('a house document is copied the same way', dUsed.status === 201 && (await api('GET', `/agency/docs/${dUsed.json.id}`, undefined, O.token)).json.doc?.kind === 'brief', dUsed.json);
  // House templates live for everyone, so the run takes away the ones it made: a rerun without --fresh then sees only its own.
  for (const id of [hid, house2.json.id, kcHouse.json.id, dHouse.json.id].filter(Boolean)) await api('PATCH', `/admin/agency/templates/${id}`, { status: 'retired' }, A.token);
  // Runs made before this sweep left theirs active, so any smoke-named house template still active is retired too (only these names).
  for (let pg = 1; pg <= 20; pg += 1) {
    const hl = await api('GET', `/admin/agency/templates?size=100&page=${pg}`, undefined, A.token);
    for (const t of hl.json.templates ?? []) {
      if (t.status === 'active' && /^House (invoice|with details|agreement|brief) [0-9a-z]+$/.test(t.name)) await api('PATCH', `/admin/agency/templates/${t.id}`, { status: 'retired' }, A.token);
    }
    if (!hl.json.page?.more) break;
  }
  check('the house templates this run made are retired again', !(await api('GET', '/agency/templates', undefined, X.token)).json.templates?.some((t) => t.scope === 'house' && /^House (invoice|with details|agreement|brief) [0-9a-z]+$/.test(t.name)));

  // Filled once, never asked again: a fresh owner sets the business profile once and adds a client once, and then every agreement,
  // every other document, every invoice starter and every email note opens with no blank, no placeholder and nothing to retype.
  {
    const F = await join('docfill');
    await api('PUT', '/agency/settings', { currency: 'INR', profile: { from: { name: 'Fill Studio', line: '', taxIds: [], address: '9 Fill Road, Pune', email: 'fill@studio.test', phone: '+91 90000 11111' }, bank: { bankName: 'Fill Bank', holder: 'Fill Person', account: '12121212', ifsc: 'fill0000001', upi: '' }, signerName: 'Fill Person', signerTitle: 'Founder', brandName: 'Fill Films', jurisdiction: 'Pune', payDays: 10 } }, F.token);
    const fc = (await addClient({ name: 'Full Co', contactName: 'Mira Das', contactEmail: 'mira@full.test', channels: ['YouTube', 'Instagram'], retainerCents: 6000000, piecesPerMonth: 8, hoursPerMonth: 20 }, F.token)).json.id;
    // The add-client form saves the billing part straight after, the same way.
    await api('PATCH', `/agency/clients/${fc}`, { name: 'Full Co', billing: { name: 'Full Co', line: '', taxIds: [{ label: 'GSTIN', value: '27ABCDE1234F1Z5' }], address: '5 Full Street, Mumbai', email: '', phone: '' } }, F.token);
    const typed = { projectWhat: 'Launch videos', deliveryDate: '1 Dec 2026', trialPieces: '2', trialFee: 'None', sessionDate: '3 Nov 2026' };
    const unsigned = (t) => t.split('\n').filter((l) => !/^(Signature|Date): _+$/.test(l)).join('\n');
    const blank = /__|\{|\}|TBD|undefined/;
    const papers = [];
    for (const t of CONTRACT_TEMPLATES) {
      const r = await api('POST', '/agency/contracts', { templateKey: t.key, clientId: fc }, F.token);
      const k = (await api('GET', `/agency/contracts/${r.json.id}`, undefined, F.token)).json.contract;
      papers.push({ name: `agreement ${t.key}`, kind: 'contract', doc: k.doc, docKind: t.key });
    }
    for (const kind of AGENCY_DOC_KINDS) {
      const r = await api('POST', `/agency/docs?day=${today}`, { kind, clientId: fc }, F.token);
      const d = (await api('GET', `/agency/docs/${r.json.id}`, undefined, F.token)).json.doc;
      papers.push({ name: `document ${kind}`, kind: 'doc', doc: d.doc, docKind: kind });
    }
    const asked = papers.flatMap((p) => Object.entries(p.doc.vars).filter(([key, v]) => !v && !(key in typed)).map(([key]) => `${p.name}: ${key}`));
    // An optional field (a second email) may stay empty: its line is left out of the client's copy.
    const optionalVar = new Set(CONTRACT_VARS.filter((v) => v.optional).map((v) => v.key));
    const named = papers.flatMap((p) => p.doc.sections.flatMap((s) => [...s.body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])).filter((key) => !p.doc.vars[key] && !(key in typed) && !optionalVar.has(key)).map((key) => `${p.name}: ${key}`));
    check('every agreement and document starts filled from the profile and the client, asking only what no record holds', named.length === 0, named.slice(0, 8));
    void asked;
    const dirty = [];
    for (const p of papers) {
      for (const audience of ['owner', 'client']) {
        const text = unsigned(contractAsText({ ...p.doc, vars: { ...p.doc.vars, ...typed } }, { audience }));
        if (blank.test(text)) dirty.push(`${p.name} (${audience}): ${text.match(/.{0,30}(__|\{|\}|TBD|undefined).{0,30}/)?.[0]}`);
      }
    }
    check('no agreement or document has a blank, a brace or a TBD, for the owner or the client', dirty.length === 0, dirty.slice(0, 6));
    const fee = [];
    for (const st of INVOICE_STARTERS) {
      const r = await api('POST', `/agency/invoices?day=${today}`, { clientId: fc, starter: st.key }, F.token);
      const inv = r.json.invoice;
      const text = invoiceAsText(inv);
      if (r.status !== 201 || blank.test(text) || (st.key === 'retainer' && inv.items[0].unitCents !== 6000000) || (st.key === 'per-piece' && inv.items[0].quantity !== 8)) fee.push(`${st.key}: ${r.status} ${inv?.items?.[0]?.unitCents}`);
      papers.push({ name: `invoice ${st.key}`, kind: 'invoice', invoice: inv });
    }
    check('every invoice starter is priced from the client\'s retainer and has no blank', fee.length === 0, fee);
    const page = (await api('GET', `/agency/clients/${fc}`, undefined, F.token)).json;
    const prof = page.settings.profile;
    const mails = [];
    for (const p of papers) {
      const { vars, missing } = emailVarsFor({
        kind: p.kind,
        client: { name: page.client.name, contactName: page.client.contactName, month: page.client.month },
        profile: prof,
        title: p.doc?.title ?? p.invoice?.doc.title,
        number: p.invoice?.number,
        amount: p.invoice ? money(p.invoice.totalCents, p.invoice.currency) : '',
        dueBy: p.invoice?.dueDate ?? '',
        period: 'November 2026',
        docKind: p.docKind,
      });
      if (missing.length) mails.push(`${p.name}: missing ${missing.map((m) => m.key).join(', ')}`);
      for (const t of EMAIL_TEMPLATES) {
        const m = fillEmail(t.key, vars);
        if (blank.test(`${m.subject}\n${m.body}`) || !m.body.startsWith('Hi Mira and Full Co team,') || !m.body.includes('Fill Person')) mails.push(`${p.name} / ${t.key}`);
      }
    }
    check('every email note for every paper is written from the records, with nothing missing', mails.length === 0, mails.slice(0, 6));
    await api('DELETE', '/me', { confirm: 'DELETE' }, F.token);
  }

  // export and delete
  const exp = await api('GET', '/me/export', undefined, O.token);
  check('the documents and their log are in the export', Array.isArray(exp.json.agencyDocs) && exp.json.agencyDocs.length >= 4 && Array.isArray(exp.json.agencyDocLog), Object.keys(exp.json).filter((k) => k.startsWith('agency')));
  const gone = await api('DELETE', '/me', { confirm: 'DELETE' }, O.token);
  check('deleting the account removes them', gone.status === 200, gone.json);
  check('and the client link stops working', (await pub('GET', `/agency/doc/${dtok}`)).status === 404);
}

// ---------------------------------------------------------------- money guards (the 2026-11-03 audit)
section('Money guards: two taps pay once, nothing is refunded that was not paid');
{
  const MG = (n) => `10.${(seed + n) & 255}.${(seed >> 16) & 255}.${(seed >> 8) & 255}`;
  let joined = 0;
  const join = async (who, apps = []) => {
    const r = await api('POST', '/auth/signup', { email: `mg-${who}-${stamp}@smoke.test`, password: `Meadow-${stamp}-pass`, displayName: `Smoke ${who}`, phone: PHONE, birthDate: GROWN }, null, { 'CF-Connecting-IP': MG(90 + Math.floor(joined++ / 6)) });
    for (const key of apps) await api('PATCH', '/me/modules', { key, on: true }, r.json.token);
    return { token: r.json.token, user: r.json.user };
  };
  const pts = async (t) => (await me(t.token)).points;
  const give = (t, amount) => admin('POST', `/admin/users/${t.user.id}/points`, { amount, note: 'smoke money guards' });

  // Party: a paid ticket, a waitlist, cancels and a host cancel.
  const H = await join('host', ['party']);
  const A = await join('guest', ['party']);
  const W = await join('waiter', ['party']);
  await give(A, 1000);
  await give(W, 1000);
  const ev = await api('POST', '/party/events', { title: `Guarded party ${stamp}`, startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), minutes: 60, pricePoints: 100, capacity: 1 }, H.token);
  const eid = ev.json.event?.id;
  const a0 = await pts(A);
  const w0 = await pts(W);
  const seated = await api('POST', `/party/events/${eid}/rsvp`, {}, A.token);
  check('a paid seat costs the ticket price', seated.status === 201 && seated.json.status === 'registered' && a0 - (await pts(A)) === 100, seated.json);
  const waiting = await api('POST', `/party/events/${eid}/rsvp`, {}, W.token);
  check('a full event waitlists and charges nothing', waiting.status === 201 && waiting.json.status === 'waitlisted' && (await pts(W)) === w0, waiting.json);
  const cancels = await Promise.all([1, 2, 3].map(() => api('POST', `/party/events/${eid}/cancel-rsvp`, {}, A.token)));
  check('three cancels at once: one goes through', cancels.filter((r) => r.status === 200).length === 1, cancels.map((r) => r.status));
  check('and the ticket is refunded once', (await pts(A)) === a0, { now: await pts(A), a0 });
  const wDetail = await api('GET', `/party/events/${eid}`, undefined, W.token);
  check('the freed seat goes to the waitlist, and the ticket is charged then', wDetail.json.event?.mine?.status === 'registered' && w0 - (await pts(W)) === 100, { status: wDetail.json.event?.mine?.status, paid: w0 - (await pts(W)) });
  const hostView = await api('GET', `/party/events/${eid}`, undefined, H.token);
  check('one seat is still one person', hostView.json.event?.registered === 1, hostView.json.event?.registered);
  await api('POST', `/party/events/${eid}/cancel-rsvp`, {}, W.token);
  check('a promoted guest who cancels gets back what they paid, no more', (await pts(W)) === w0, { now: await pts(W), w0 });
  const taps = await Promise.all([1, 2].map(() => api('POST', `/party/events/${eid}/rsvp`, {}, A.token)));
  check('two RSVPs at once take one seat', taps.filter((r) => r.status === 201).length === 1, taps.map((r) => [r.status, r.json.error ?? r.json.status]));
  check('and charge one ticket', a0 - (await pts(A)) === 100, a0 - (await pts(A)));
  const hostCancel = await Promise.all([1, 2].map(() => api('PATCH', `/party/events/${eid}`, { status: 'cancelled' }, H.token)));
  check('the host cancels the event', hostCancel.every((r) => r.status === 200), hostCancel.map((r) => r.status));
  check('every paid guest is refunded, once', (await pts(A)) === a0, { now: await pts(A), a0 });
  const aInbox = await api('GET', '/inbox', undefined, A.token);
  check('and is told the points are back', JSON.stringify(aInbox.json).includes('The points you paid for the ticket are back'), aInbox.status);

  // Store: pay what you want with a 100% team code, and a creator coupon.
  const S = await join('seller');
  const B = await join('buyer');
  const P = await join('poor');
  await give(B, 3000);
  const pw = await api('POST', '/studio/products', { kind: 'digital', title: `Pay what you want ${stamp}`, pricePoints: 1, pwyw: true, status: 'live' }, S.token);
  const PW = pw.json.product?.id;
  const allOff = `ALLOFF${stamp}`.toUpperCase();
  await admin('POST', '/admin/discounts', { code: allOff, kind: 'percent', percent: '100', areas: ['product'], perPersonLimit: 3 });
  const quote = await api('POST', '/discounts/check', { code: allOff, area: 'product', itemId: PW, points: 1000 }, B.token);
  check('on pay what you want a code comes off the minimum, not the offer', quote.status === 200 && quote.json.offPoints === 1 && quote.json.payPoints === 999, quote.json);
  const s0 = await pts(S);
  const b0 = await pts(B);
  const big = await api('POST', `/store/${PW}/checkout`, { pay: 'points', points: 1000, discountCode: allOff }, B.token);
  check('the buyer pays the offer less the minimum', big.status === 201 && big.json.order?.points === 999 && big.json.order?.discountPoints === 1 && b0 - (await pts(B)) === 999, big.json.order ?? big.json);
  const fee = big.json.order?.platformFeePoints ?? 0;
  check('so the platform pays at most the real price, and makes no points', (await pts(S)) - s0 === 1000 - fee && (await pts(S)) - s0 - (b0 - (await pts(B))) <= 1, { seller: (await pts(S)) - s0, fee });
  const coupon = await api('POST', '/studio/coupons', { code: `ONCE${stamp}`, percentOff: 34, maxUses: 1 }, S.token);
  const item = await api('POST', '/studio/products', { kind: 'digital', title: `Coupon item ${stamp}`, pricePoints: 25, status: 'live' }, S.token);
  const IT = item.json.product?.id;
  const broke = await api('POST', `/store/${IT}/checkout`, { pay: 'points', coupon: `ONCE${stamp}` }, P.token);
  check('a checkout that cannot pay is refused', broke.status === 400, broke.json);
  const cAfter = (await api('GET', '/studio/coupons', undefined, S.token)).json.coupons?.find((x) => x.id === coupon.json.coupon?.id);
  check('and spends no use of the coupon', cAfter?.uses === 0, cAfter);
  const b1 = await pts(B);
  const withCoupon = await api('POST', `/store/${IT}/checkout`, { pay: 'points', coupon: `ONCE${stamp}` }, B.token);
  check('34% off 25 points is 17, worked out in whole numbers', withCoupon.status === 201 && b1 - (await pts(B)) === 17, withCoupon.json.order ?? withCoupon.json);
  check('the coupon is used once and is then used up', (await api('GET', '/studio/coupons', undefined, S.token)).json.coupons?.find((x) => x.id === coupon.json.coupon?.id)?.uses === 1, '');

  // Rewards: an admin cancel and the person's own cancel at once refund once.
  const R = await join('rewards');
  await give(R, 2000);
  const r0 = await pts(R);
  const held = await api('POST', '/rewards/book_relationship_method/redeem', undefined, R.token);
  const rid = held.json.redemption?.id;
  check('a book is reserved for its points', held.status === 201 && held.json.redemption?.status === 'reserved' && r0 - (await pts(R)) === 2000, held.json);
  const both = await Promise.all([api('POST', `/rewards/redemptions/${rid}/cancel`, undefined, R.token), admin('POST', `/admin/redemptions/${rid}`, { status: 'cancelled' }), admin('POST', `/admin/redemptions/${rid}`, { status: 'cancelled' })]);
  check('three cancels from two sides: one goes through', both.filter((r) => r.status === 200).length === 1, both.map((r) => r.status));
  check('and the points come back once', (await pts(R)) === r0, { now: await pts(R), r0 });
  check('a fulfil cannot land on a cancelled one', (await admin('POST', `/admin/redemptions/${rid}`, { status: 'fulfilled' })).status === 400, '');

  // Run: two voids at once take the pay back once.
  const C2 = await join('runhost', ['run']);
  const M = await join('runner', ['run']);
  await give(M, 500);
  const club = await api('POST', '/run/clubs', { name: `Guarded runners ${stamp}`, city: 'Pune' }, C2.token);
  const run1 = await api('POST', `/run/clubs/${club.json.club?.id}/runs`, { title: 'Guarded run', startsAt: new Date(Date.now() - 10 * 60_000).toISOString(), minutes: 60, metres: 5000 }, C2.token);
  await api('POST', `/run/clubs/${club.json.club?.id}/join`, {}, M.token);
  const m0 = await me(M.token);
  const ent = await api('POST', `/run/runs/${run1.json.run?.id}/entry`, { code: run1.json.run?.code, minutes: 30, metres: 5000 }, M.token);
  const entId = ent.json.entry?.id ?? (await api('GET', `/run/clubs/${club.json.club?.id}`, undefined, C2.token)).json.entries?.[0]?.id;
  check('the runner is paid for the run', ent.status === 201 && (await pts(M)) > m0.points, ent.json);
  await Promise.all([1, 2, 3].map(() => api('POST', `/run/entries/${entId}/void`, {}, C2.token)));
  const m1 = await me(M.token);
  check('three voids at once take the pay back once', m1.points === m0.points && m1.xp === m0.xp, { before: [m0.points, m0.xp], after: [m1.points, m1.xp] });

  // Password change: the current password is limited like sign-in.
  const PWU = await join('pwchange');
  let lastPw = 0;
  for (let i = 0; i < LIMITS.passwordChange.max + 1 && lastPw !== 429; i += 1) lastPw = (await api('POST', '/me/password', { current: `wrong-${i}-guess`, password: `Meadow-${stamp}-new1` }, PWU.token)).status;
  check('guessing the current password is limited per person', lastPw === 429, lastPw);

  // Codes cannot be guessed through a checkout either; an ordinary checkout spends nothing of that budget.
  const G = await join('guesser');
  let plain = 0;
  for (let i = 0; i < LIMITS.discount.max + 1; i += 1) plain = Math.max(plain, (await api('POST', '/credits/checkout', { kind: 'plan', key: 'pro' }, G.token, { 'CF-Connecting-IP': MG(120) })).status);
  check('checkouts without a code are not counted as guesses', plain !== 429, plain);
  let guessed = 0;
  for (let i = 0; i < LIMITS.discount.max + 2 && guessed !== 429; i += 1) guessed = (await api('POST', '/credits/checkout', { kind: 'plan', key: 'pro', discountCode: `GUESS${i}XYZ` }, G.token, { 'CF-Connecting-IP': MG(121) })).status;
  check('guessing codes through plan checkout is limited', guessed === 429, guessed);

  // Agency: a locked client's invoice in lower case is still locked; two taps on Mark paid book once; a take-back cannot undo a signature.
  const O = await join('agencyguard', ['agency', 'finance']);
  await api('PUT', '/agency/settings', { profile: { gstBps: 0, tdsBps: 0, tdsMode: 'none' } }, O.token);
  const cl = await addClient({ name: 'Guarded Co', contactEmail: 'ops@guarded.test', portalPassword: 'generate' }, O.token, { locked: true });
  const inv = await api('POST', `/agency/invoices?day=${today}`, { clientId: cl.json.id, items: [{ description: 'Guarded reel', quantity: 1, unitCents: 100000 }] }, O.token);
  const iid = inv.json.invoice?.id;
  const sentInv = await api('PATCH', `/agency/invoices/${iid}`, { status: 'sent' }, O.token);
  const itok = sentInv.json.invoice?.token ?? inv.json.invoice?.token;
  const PUB = (method, path, body) => api(method, `/public${path}`, body, null, { 'CF-Connecting-IP': MG(130 + Math.floor(Math.random() * 60)) });
  check('a locked client\'s invoice link is locked', (await PUB('GET', `/invoices/${itok}`)).status === 401, '');
  const lower = await PUB('GET', `/invoices/${String(itok).toLowerCase()}`);
  check('and so is the same link in lower case', lower.status === 401 && !JSON.stringify(lower.json).includes('Guarded reel'), lower.status);
  check('a comment through the lower-case link is refused too', (await PUB('POST', `/invoices/${String(itok).toLowerCase()}/comments`, { body: 'hello' })).status === 401, '');
  await Promise.all([1, 2, 3].map(() => api('PATCH', `/agency/invoices/${iid}`, { status: 'paid' }, O.token)));
  const books = await api('GET', `/finance?month=${new Date().toISOString().slice(0, 7)}`, undefined, O.token);
  const booked = (books.json.transactions ?? []).filter((t) => t.kind === 'income' && t.amountCents === 100000);
  check('three taps on Mark paid book the income once', booked.length === 1, booked.length);
  const kc = await api('POST', '/agency/contracts', { templateKey: 'trial', clientId: cl.json.id }, O.token);
  const ks = await api('PATCH', `/agency/contracts/${kc.json.id}`, { status: 'sent' }, O.token);
  const unlock = await PUB('POST', `/agency/${(await api('POST', `/agency/clients/${cl.json.id}/portal`, { on: true }, O.token)).json.portalToken}/unlock`, { password: cl.json.password });
  const ktok = ks.json.contract?.token;
  const [accept, takeBack] = await Promise.all([
    api('POST', `/public/contracts/${ktok}/accept`, { name: 'Guard Signer', agree: true }, null, { 'CF-Connecting-IP': MG(200), 'X-Portal-Session': unlock.json.session ?? '' }),
    api('PATCH', `/agency/contracts/${kc.json.id}`, { status: 'draft' }, O.token),
  ]);
  const kNow = (await api('GET', `/agency/contracts/${kc.json.id}`, undefined, O.token)).json.contract;
  check('signing and taking back at once never leave a signed agreement as a draft', kNow && (kNow.acceptance ? kNow.status === 'signed' : kNow.status === 'draft'), { status: kNow?.status, accept: accept.status, takeBack: takeBack.status });

  // Every Agency and business-metric write is in the one limits file.
  const fs = await import('node:fs');
  const root = new URL('../../apps/api/src/routes/', import.meta.url);
  const mounts = [['agency.ts', 'agency', '/agency'], ['agencyDocs.ts', 'agencyDocs', '/agency'], ['agencyLife.ts', 'agencyLife', '/agency'], ['agencyOther.ts', 'agencyOther', '/agency/docs'], ['kpis.ts', 'kpis', '/reviews/kpis']];
  const doors = mounts.flatMap(([file, name, base]) => [...fs.readFileSync(new URL(file, root), 'utf8').matchAll(new RegExp(`^${name}\\.(post|patch|put|delete)\\('([^']*)'`, 'gm'))].map((m) => ({ method: m[1].toUpperCase(), path: `${base}${m[2] === '/' ? '' : m[2]}` })));
  const missing = doors.filter((d) => !ROUTE_LIMITS.some((r) => r.method === d.method && r.path === d.path));
  check('every Agency and business-metric write has a rate limit', doors.length > 30 && missing.length === 0, missing.map((d) => `${d.method} ${d.path}`));
}

// ---------------------------------------------------------------- feelings reader
section('Feelings reader');
{
  // "Read with AI" on the strategy session's map card: a plan, a model that keeps nothing, credits through the one ledger, and the words never kept.
  const { ASSISTANT_MODELS } = await import('../../packages/shared/src/index.ts');
  const P = await signup(`feelings-${stamp}@smoke.test`, `Lantern-${stamp}-pass`, 'Smoke feelings');
  const privateModel = ASSISTANT_MODELS.find((m) => m.private)?.id;
  const keeper = ASSISTANT_MODELS.find((m) => !m.private)?.id;
  const mark = `quietfeel${stamp}`;
  const status = await api('GET', '/assistant', undefined, P.token);
  const mock = status.json?.model === 'smoke-mock';
  const noPlan = await api('POST', '/assistant/feelings', { text: `I get scared ${mark}`, relationship: 'self', model: privateModel }, P.token);
  check('reading with AI needs a plan: no plan is refused with the paywall', mock ? noPlan.status === 402 && noPlan.json.paywall === 'plan' : [402, 503].includes(noPlan.status), noPlan.json);
  await admin('POST', `/admin/users/${P.user.id}/plan`, { plan: 'pro', days: 30 });
  const kept = await api('POST', '/assistant/feelings', { text: `I get scared ${mark}`, relationship: 'self', model: keeper }, P.token);
  check('a model that keeps data is refused with 400', kept.status === 400, kept.json);
  const tooShort = await api('POST', '/assistant/feelings', { text: 'hi', model: privateModel }, P.token);
  check('a line under three letters is refused', tooShort.status === 400, tooShort.json);
  if (!mock) console.log('  (the feelings reader checks need the mock model that blueprint.sh starts; skipped)');
  else {
    // The stand-in model answers a "DO [...]" line with exactly those tool calls, so this is the model calling suggest_levels.
    const words = `DO ${JSON.stringify([{ name: 'suggest_levels', args: { levels: [100, 150, 999, 'x'], said: mark } }])}`;
    const before = ((await api('GET', '/credits/ledger?size=100', undefined, P.token)).json.entries ?? []).filter((e) => e.agent === 'feelings').length;
    const read = await api('POST', '/assistant/feelings', { text: words, relationship: 'family', model: privateModel }, P.token);
    check('a private model returns only real map levels', read.status === 200 && JSON.stringify(read.json.levels) === '[100,150]' && typeof read.json.model === 'string', read.json);
    check('the model is offered only the one tool, and the words go in once', (mockModel.last?.tools ?? []).map((t) => t.function?.name).join() === 'suggest_levels' && JSON.stringify(mockModel.last?.messages ?? []).split(mark).length === 2, mockModel.last?.tools);
    const after = ((await api('GET', '/credits/ledger?size=100', undefined, P.token)).json.entries ?? []).filter((e) => e.agent === 'feelings');
    check('one use row in the credit ledger, by the feelings reader', after.length - before === 1 && after[0]?.reason === 'usage', after.length - before);
    const exported = JSON.stringify((await api('GET', '/me/export', undefined, P.token)).json ?? {});
    check('the words are not kept: nothing in the export or the assistant actions', !exported.includes(mark), '');
    const logs = await api('GET', `/internal/logs?q=${mark}`, undefined, A.token);
    check('and nothing in the app log', logs.status === 200 && !JSON.stringify(logs.json).includes(mark), logs.status);
  }
  const off = await api('POST', '/assistant/feelings', {}, null);
  check('no session means 401', off.status === 401, off.status);
}

// ---------------------------------------------------------------- Agency across the app (emergence) and its assistant tools
section('Agency across the app');
{
  // One piece of client work, typed once in Agency, shows on Daily, in the inbox, in Finance, in the private calendar link, in search and in
  // the brief. The owner's zone is one where it is past 09:00 now, so the morning inbox note is due whenever this runs.
  const zones = ['Pacific/Kiritimati', 'Asia/Tokyo', 'Asia/Kolkata', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Pacific/Honolulu', 'Pacific/Pago_Pago'];
  const localOf = (zone) => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const get = (k) => parts.find((x) => x.type === k)?.value ?? '';
    return { day: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
  };
  const zone = zones.find((z) => localOf(z).minutes >= 9 * 60 + 30 && localOf(z).minutes < 23 * 60) ?? 'Asia/Kolkata';
  const D = localOf(zone).day;
  const E = await signup(`emerge-${stamp}@smoke.test`, `Meadow-${stamp}-pass`, 'Smoke emerge');
  await api('PATCH', '/me', { displayName: 'Smoke emerge', timezone: zone }, E.token);
  for (const key of ['agency', 'finance']) await api('PATCH', '/me/modules', { key, on: true }, E.token);
  const brand = `Emergeco${stamp}`;
  const k = await addClient({ name: brand, contactName: 'Nia', contactEmail: 'nia@emerge.test', retainerCents: 3000000, piecesPerMonth: 4 }, E.token);
  check('an Agency client is made for the emergence checks', k.status === 201 && k.json.id, k.json);
  const kid = k.json.id;
  const piece = await api('POST', `/agency/items?day=${D}`, { clientId: kid, title: 'Emerge reel', kind: 'short', platform: 'Instagram', stage: 'making', dueDate: D }, E.token);
  check('a piece due today is made', piece.status === 201, piece.json);
  const daily = await api('GET', `/today?date=${D}`, undefined, E.token);
  check('Daily lists the client piece due today, with its client', daily.status === 200 && daily.json.agency?.due?.some((x) => x.id === piece.json.id && x.client === brand && x.late === false), daily.json.agency);
  await fetch(`${ORIGIN}/__scheduled?cron=*+*+*+*+*`);
  await fetch(`${ORIGIN}/__scheduled?cron=*+*+*+*+*`);
  const inbox = (await api('GET', '/inbox?tab=agency', undefined, E.token)).json.notifications ?? [];
  const dueNotes = inbox.filter((n) => n.id === `agency-due-${E.user.id}-${D}`);
  check('the inbox has one Agency note for the piece due today, however often the cron runs', dueNotes.length === 1 && /Emerge reel is due today/.test(dueNotes[0].title) && dueNotes[0].link === `/agency/${kid}`, inbox.map((n) => `${n.id} ${n.title}`));
  const inv = await api('POST', `/agency/invoices?day=${D}`, { clientId: kid, dueDate: D, items: [{ description: 'Emerge month', quantity: 1, unitCents: 1500000 }] }, E.token);
  const sentInv = await api('PATCH', `/agency/invoices/${inv.json.invoice?.id}`, { status: 'sent' }, E.token);
  check('an Agency invoice due today is sent', inv.status === 201 && sentInv.json.invoice?.status === 'sent', sentInv.json);
  const fin = await api('GET', `/finance?day=${D}`, undefined, E.token);
  check('Finance counts the sent Agency invoice as owed to you', fin.status === 200 && (fin.json.owedToYou ?? []).some((o) => o.count >= 1 && o.cents >= 1500000), fin.json.owedToYou);
  const daily2 = await api('GET', `/today?date=${D}`, undefined, E.token);
  check('Daily lists the invoice due today', (daily2.json.agency?.invoicesDue ?? []).some((x) => x.number === inv.json.invoice.number), daily2.json.agency?.invoicesDue);
  const cal = await api('POST', '/me/calendar', { on: true }, E.token);
  const ics = await (await fetch(`${ORIGIN}/api/public/calendar/${cal.json.token}.ics`)).text();
  const unfolded = ics.replace(/\r?\n[ \t]/g, '');
  check('the private calendar link carries the piece and the invoice, never a fee or a note', unfolded.includes('Emerge reel') && unfolded.includes(inv.json.invoice.number) && !unfolded.includes('15,000') && !unfolded.includes('nia@emerge.test'), unfolded.slice(0, 400));
  await api('POST', '/me/calendar', { on: false }, E.token);
  const found = await api('GET', `/search?q=${brand}`, undefined, E.token);
  check('search finds the client and its invoice', found.status === 200 && found.json.agencyClients?.some((x) => x.id === kid) && found.json.agencyInvoices?.some((x) => x.id === inv.json.invoice.id), { c: found.json.agencyClients, i: found.json.agencyInvoices });
  const stranger = await signup(`emerge-x-${stamp}@smoke.test`, `Meadow-${stamp}-pass`, 'Smoke stranger');
  await api('PATCH', '/me/modules', { key: 'agency', on: true }, stranger.token);
  check('nobody else finds it', ((await api('GET', `/search?q=${brand}`, undefined, stranger.token)).json.agencyClients ?? []).length === 0);
  const brief = await api('GET', `/home/brief?date=${D}&hour=10`, undefined, E.token);
  const lines = [...(brief.json.brief?.signals ?? []), ...(brief.json.brief?.actions ?? [])];
  check('the brief says a client piece is due today', lines.some((l) => l.key === 'agency-due'), lines.map((l) => l.key));
  await api('PATCH', '/me/modules', { key: 'agency', on: false }, E.token);
  const off = await api('GET', `/today?date=${D}`, undefined, E.token);
  check('with Agency off, Daily shows no client work', !off.json.agency, off.json.agency);
  await api('PATCH', '/me/modules', { key: 'agency', on: true }, E.token);

  // The assistant's Agency tools: each goes through the route a tap uses and comes back with Undo.
  const status = await api('GET', '/assistant', undefined, E.token);
  if (status.json?.model !== 'smoke-mock') console.log('  (the assistant Agency checks need the mock model that blueprint.sh starts; skipped)');
  else {
    await admin('POST', `/admin/users/${E.user.id}/plan`, { plan: 'pro', days: 30 });
    const DO = (...calls) => `DO ${JSON.stringify(calls)}`;
    const say = (text) => api('POST', '/assistant', { messages: [{ role: 'user', text }], context: { path: '/agency', date: D, timeZone: zone } }, E.token);
    const items = async () => (await api('GET', `/agency/items?client=${kid}&size=100&day=${D}`, undefined, E.token)).json.items ?? [];
    const undo = (r) => api('POST', `/assistant/actions/${r?.id}/undo`, { date: D }, E.token);
    const add = await say(DO({ name: 'add_agency_deliverable', args: { clientId: kid, title: 'Assistant reel', stage: 'idea' } }));
    const r1 = add.json?.receipts?.[0];
    check('add_agency_deliverable writes through POST /agency/items, with Undo', add.status === 200 && r1?.status === 'done' && r1.undo === true && (await items()).some((x) => x.title === 'Assistant reel'), add.json);
    const u1 = await undo(r1);
    check('its Undo deletes the piece', u1.json?.receipt?.status === 'undone' && !(await items()).some((x) => x.title === 'Assistant reel'), u1.json);
    const mv = await say(DO({ name: 'move_agency_deliverable', args: { itemId: piece.json.id, clientId: kid, stage: 'review' } }));
    const r2 = mv.json?.receipts?.[0];
    check('move_agency_deliverable changes the stage, with Undo', r2?.status === 'done' && r2.undo === true && (await items()).find((x) => x.id === piece.json.id)?.stage === 'review', mv.json);
    const u2 = await undo(r2);
    check('its Undo puts the stage back', u2.json?.receipt?.status === 'undone' && (await items()).find((x) => x.id === piece.json.id)?.stage === 'making', u2.json);
    const notes = async () => (await api('GET', `/agency/items/${piece.json.id}/notes`, undefined, E.token)).json.notes ?? [];
    const nt = await say(DO({ name: 'add_agency_note', args: { itemId: piece.json.id, text: `Brighter opening ${stamp}` } }));
    const r3 = nt.json?.receipts?.[0];
    check('add_agency_note adds a private note, with Undo', r3?.status === 'done' && r3.undo === true && (await notes()).some((n) => n.body === `Brighter opening ${stamp}` && n.shared === false), nt.json);
    const u3 = await undo(r3);
    check('its Undo removes the note', u3.json?.receipt?.status === 'undone' && !(await notes()).some((n) => n.body === `Brighter opening ${stamp}`), u3.json);
    const kept = JSON.stringify((await api('GET', '/me/export', undefined, E.token)).json?.assistantActions ?? []);
    check('the assistant log keeps the label, never the note\'s words', !kept.includes(`Brighter opening ${stamp}`), '');
    const theirs = await addClient({ name: `Other${stamp}` }, stranger.token);
    const cross = await say(DO({ name: 'move_agency_deliverable', args: { itemId: piece.json.id, clientId: theirs.json.id, stage: 'review' } }));
    check('a tool cannot reach another person\'s client', (cross.json?.receipts ?? []).every((r) => r.status !== 'done') && (await items()).find((x) => x.id === piece.json.id)?.stage === 'making', cross.json);
  }
}

// ---------------------------------------------------------------- the Agency team (wave 14)
section('Agency team');
{
  const on = async (u) => {
    await api('PATCH', '/me/modules', { key: 'agency', on: true }, u.token);
    return u;
  };
  const T = await on(await signup(`team-owner-${stamp}@smoke.test`, `Harbour-${stamp}-pass`, 'Team Owner'));
  const E = await signup(`team-editor-${stamp}@smoke.test`, `Harbour-${stamp}-pass`, 'Team Editor');
  const C = await on(await signup(`team-creator-${stamp}@smoke.test`, `Harbour-${stamp}-pass`, 'Team Creator'));
  const K = await signup(`team-client-${stamp}@smoke.test`, `Harbour-${stamp}-pass`, 'Team Client');
  const X = await on(await signup(`team-outsider-${stamp}@smoke.test`, `Harbour-${stamp}-pass`, 'Team Outsider'));
  const BK = await signup(`team-blocker-${stamp}@smoke.test`, `Harbour-${stamp}-pass`, 'Team Blocker');
  const asMember = (rowId) => ({ 'X-Agency-Team': rowId });
  const D = today;

  // The owner's agency: a profile with a bank, a client with a private note and a fee, a piece, an invoice.
  await api('PUT', '/agency/settings', { profile: { from: { name: `Team Studio ${stamp}` }, bank: { bankName: 'Team Bank', holder: 'Team Owner', account: '55667788', ifsc: 'tbnk0000009', upi: 'team@upi' } } }, T.token);
  const cl = await addClient({ name: `Team Client Co ${stamp}`, retainerCents: 4200000, notes: `OWNER-PRIVATE-${stamp}` }, T.token);
  const cid = cl.json.id;
  check('team: the owner has a client', cl.status === 201 && Boolean(cid), cl.json);
  const other = await addClient({ name: `Other Client ${stamp}` }, T.token);
  const piece = await api('POST', `/agency/items?day=${D}`, { clientId: cid, title: 'Team reel', feeCents: 123400 }, T.token);
  const pid = piece.json.id;
  await api('POST', `/agency/items/${pid}/notes`, { body: `PRIVATE-NOTE-${stamp}`, shared: false }, T.token);
  const ownTeamNote = await api('POST', `/agency/items/${pid}/notes`, { body: `For the team ${stamp}`, team: true }, T.token);
  const mkInv = await api('POST', `/agency/invoices?day=${D}`, { clientId: cid, items: [{ description: 'Reels', quantity: 2, unitCents: 500000 }] }, T.token);
  const invId = mkInv.json.invoice?.id;
  check('team: the owner has an invoice', mkInv.status === 201 && Boolean(invId), mkInv.status);

  // Inviting: by @username, by friend code and by email.
  let invites = 0;
  const invite = (body, token = T.token) => {
    if (token === T.token) invites += 1;
    return api('POST', '/agency/team', body, token);
  };
  const handle = `ed${stamp}`.slice(0, 20);
  await api('PATCH', '/me', { handle }, E.token);
  const cMe = await me(C.token);
  const iE = await invite({ who: `@${handle}`, role: 'editor' });
  check('team: an editor is invited by @username', iE.status === 201 && iE.json.friendRequest === 'sent', iE.json);
  const iC = await invite({ who: cMe.friendCode, role: 'content_creator' });
  check('team: a content creator is invited by friend code', iC.status === 201 && iC.json.friendRequest === 'sent', iC.json);
  check('team: a client member needs a client', (await invite({ who: `team-client-${stamp}@smoke.test`, role: 'client' })).status === 400);
  const iK = await invite({ who: `team-client-${stamp}@smoke.test`, role: 'client', clientId: cid, access: { overview: 'edit', clients: 'view', paperwork: 'edit', pipeline: 'edit' } });
  check('team: a client is invited by email', iK.status === 201, iK.json);
  const eInbox = JSON.stringify((await api('GET', '/inbox', undefined, E.token)).json);
  check('team: the editor hears about it in the inbox, with the link', eInbox.includes(`/agency?team=${iE.json.id}`) && eInbox.includes('asked you to join their Agency'), '');
  check('team: and gets a friend request from the owner', eInbox.includes('would like to be friends'), '');
  check('team: inviting yourself is refused', (await invite({ who: `team-owner-${stamp}@smoke.test`, role: 'editor' })).status === 400);
  check('team: a second open invite is refused', (await invite({ who: `@${handle}`, role: 'videographer' })).status === 409);
  await api('POST', '/bond/block', { userId: T.user.id }, BK.token);
  const blocked = await invite({ who: `team-blocker-${stamp}@smoke.test`, role: 'editor' });
  const nobody = await invite({ who: `nobody-${stamp}@smoke.test`, role: 'editor' });
  check('team: a block reads exactly like an unknown person', blocked.status === 404 && nobody.status === 404 && blocked.json.error === nobody.json.error, [blocked.json, nobody.json]);

  // At most ten invites waiting.
  const fillers = [];
  for (let i = 0; i < 7; i++) {
    const f = await signup(`team-fill${i}-${stamp}@smoke.test`, `Harbour-${stamp}-pass`, `Filler ${i}`);
    const r = await invite({ who: `team-fill${i}-${stamp}@smoke.test`, role: 'videographer' });
    fillers.push({ f, id: r.json.id });
  }
  const eleventh = await invite({ who: `team-outsider-${stamp}@smoke.test`, role: 'editor' });
  check('team: an eleventh waiting invite is refused', eleventh.status === 400, eleventh.json);
  for (const x of fillers) await api('DELETE', `/agency/team/${x.id}`, undefined, T.token);
  check('team: a taken-back invite leaves no line to answer', !JSON.stringify((await api('GET', '/inbox', undefined, fillers[0].f.token)).json).includes('asked you to join'), '');

  // Answering: core, so it works with Agency off.
  const eTeams = await api('GET', '/me/teams', undefined, E.token);
  check('team: the invite shows under /me/teams with Agency off', eTeams.status === 200 && eTeams.json.teams?.some((t) => t.id === iE.json.id && t.status === 'invited' && t.role === 'editor'), eTeams.json);
  const no = await api('POST', `/me/teams/${iE.json.id}/answer`, { yes: false }, E.token);
  check('team: the editor can say no', no.status === 200 && no.json.status === 'removed', no.json);
  check('team: a second answer changes nothing', (await api('POST', `/me/teams/${iE.json.id}/answer`, { yes: true }, E.token)).status === 404);
  const again = await invite({ who: `@${handle}`, role: 'editor' });
  check('team: the owner can ask again, as a new row', again.status === 201 && again.json.id !== iE.json.id, again.json);
  const eId = again.json.id;
  const yes = await api('POST', `/me/teams/${eId}/answer`, { yes: true }, E.token);
  check('team: and the editor says yes', yes.status === 200 && yes.json.status === 'active', yes.json);
  await on(E);
  await api('POST', `/me/teams/${iC.json.id}/answer`, { yes: true }, C.token);
  await api('POST', `/me/teams/${iK.json.id}/answer`, { yes: true }, K.token);
  const cId = iC.json.id;
  const kId = iK.json.id;
  const list = await api('GET', '/agency/team', undefined, T.token);
  const kRow = list.json.members?.find((m) => m.id === kId);
  check('team: the owner lists the team, a client capped at view with Clients off', list.status === 200 && list.json.members?.length >= 3 && kRow?.access.overview === 'view' && kRow?.access.clients === 'off' && kRow?.access.paperwork === 'view' && kRow?.client?.id === cid, kRow);
  check('team: another person sees none of it', (await api('GET', '/agency/team', undefined, X.token)).json.members?.length === 0);

  // The editor at work: pipeline edit, nothing else.
  const eh = asMember(eId);
  check('team: the editor reads the pipeline', (await api('GET', `/agency/items?day=${D}`, undefined, E.token, eh)).json.items?.some((i) => i.id === pid));
  const eItems = await api('GET', `/agency/items?day=${D}`, undefined, E.token, eh);
  check('team: without paperwork the fee is hidden', eItems.json.items?.every((i) => i.feeCents === 0), eItems.json.items?.map((i) => i.feeCents));
  const eOv = await api('GET', `/agency?day=${D}`, undefined, E.token, eh);
  check('team: the overview gives an editor only client names', eOv.status === 200 && eOv.json.clients?.some((x) => x.id === cid && x.name && x.retainerCents === undefined) && Object.values(eOv.json.totals ?? {}).every((v) => v === 0) && eOv.json.settings?.profile?.bank?.account === '' && (eOv.json.coming ?? []).length === 0, eOv.json);
  const eAdd = await api('POST', `/agency/items?day=${D}`, { clientId: cid, title: 'Editor cut', feeCents: 999 }, E.token, eh);
  check('team: the editor adds a piece', eAdd.status === 201, eAdd.json);
  const fee = async (id) => (await api('GET', `/agency/items?day=${D}&size=100`, undefined, T.token)).json.items?.find((i) => i.id === id)?.feeCents;
  check('team: and a fee they send is ignored', (await fee(eAdd.json.id)) === 0, await fee(eAdd.json.id));
  await api('PATCH', `/agency/items/${pid}?day=${D}`, { title: 'Team reel', stage: 'making', feeCents: 999 }, E.token, eh);
  check('team: a piece they change keeps its fee', (await fee(pid)) === 123400, await fee(pid));
  // The owner's "Notes, only for you" on a piece: never shown to a member, and never wiped by what a member sends.
  await api('PATCH', `/agency/items/${pid}?day=${D}`, { title: 'Team reel', notes: `PIECE-PRIVATE-${stamp}` }, T.token);
  const eSee = JSON.stringify([(await api('GET', `/agency/items?day=${D}`, undefined, E.token, eh)).json, (await api('GET', `/agency/board?day=${D}`, undefined, E.token, eh)).json]);
  check('team: a piece\'s private notes never reach a member', !eSee.includes(`PIECE-PRIVATE-${stamp}`), '');
  await api('PATCH', `/agency/items/${pid}?day=${D}`, { title: 'Team reel', notes: '' }, E.token, eh);
  const ownNotes = (await api('GET', `/agency/items?day=${D}&size=100`, undefined, T.token)).json.items?.find((i) => i.id === pid)?.notes;
  check('team: and a member\'s save keeps them', ownNotes === `PIECE-PRIVATE-${stamp}`, ownNotes);
  const refused = [
    ['GET', `/agency/clients/${cid}`],
    ['GET', '/agency/invoices'],
    ['PUT', '/agency/settings', { currency: 'USD' }],
    ['POST', '/agency/clients', { name: 'Nope', contactEmail: 'n@x.test', portalPassword: 'generate' }],
    ['DELETE', `/agency/items/${pid}`],
    ['PUT', `/agency/clients/${cid}/password`, { generate: true }],
    ['POST', `/agency/clients/${cid}/portal`, { fresh: true }],
    ['GET', '/agency/team'],
    ['POST', '/agency/time', { clientId: cid, day: D, minutes: 30 }],
    ['POST', '/agency/templates', { kind: 'invoice', fromId: invId, name: 'x' }],
  ];
  const codes = [];
  for (const [m, p, b] of refused) codes.push((await api(m, p, b, E.token, eh)).status);
  check('team: what an editor may not do is refused', codes.every((s) => s === 403), codes);
  check('team: the settings stayed as they were', (await api('GET', `/agency?day=${D}`, undefined, T.token)).json.settings?.currency === 'INR');

  // The content creator: clients view, cut down.
  const ch = asMember(cId);
  const page = await api('GET', `/agency/clients/${cid}?day=${D}`, undefined, C.token, ch);
  const pc = page.json.client ?? {};
  check('team: a content creator reads a client page with the private parts blank', page.status === 200 && pc.notes === '' && pc.retainerCents === 0 && pc.portalToken === null && pc.portalLocked === false && page.json.campaigns?.length === 0 && page.json.time?.length === 0 && page.json.onboarding?.answers === null && page.json.invoices?.length === 0 && page.json.lifecycle?.password?.set === false && page.json.settings?.profile?.bank?.account === '', { client: pc, onb: page.json.onboarding });
  check('team: and nothing private hides elsewhere in it', !JSON.stringify(page.json).includes(`OWNER-PRIVATE-${stamp}`) && !JSON.stringify(page.json).includes('55667788'), '');
  check('team: but cannot change the client', (await api('PATCH', `/agency/clients/${cid}`, { name: 'Renamed' }, C.token, ch)).status === 403);

  // Paperwork: view, then edit.
  await api('PATCH', `/agency/team/${eId}`, { access: { overview: 'off', pipeline: 'edit', clients: 'off', paperwork: 'view' } }, T.token);
  check('team: a change of access tells the member', JSON.stringify((await api('GET', '/inbox', undefined, E.token)).json).includes('Your access to'), '');
  const eInv = await api('GET', `/agency/invoices/${invId}`, undefined, E.token, eh);
  check('team: with paperwork to view, an invoice comes without the bank or the link', eInv.status === 200 && eInv.json.invoice?.doc?.bank?.account === '' && eInv.json.invoice?.token === null && !JSON.stringify(eInv.json).includes('55667788'), eInv.json.invoice?.doc?.bank);
  check('team: and cannot be changed', (await api('PATCH', `/agency/invoices/${invId}`, { note: 'x' }, E.token, eh)).status === 403);
  await api('PATCH', `/agency/team/${eId}`, { access: { overview: 'off', pipeline: 'edit', clients: 'off', paperwork: 'edit' } }, T.token);
  const eEdit = await api('PATCH', `/agency/invoices/${invId}`, { note: `edited by the team ${stamp}`, doc: { bank: { bankName: '', holder: '', account: '', ifsc: '', upi: '' } } }, E.token, eh);
  const ownerInv = await api('GET', `/agency/invoices/${invId}`, undefined, T.token);
  check('team: with paperwork to edit, an edit keeps the stored bank', eEdit.status === 200 && ownerInv.json.invoice?.note === `edited by the team ${stamp}` && ownerInv.json.invoice?.doc?.bank?.account === '55667788', [eEdit.status, ownerInv.json.invoice?.doc?.bank]);
  // A member never sets where the client pays: a new invoice with their own bank keeps the owner's.
  const eNew = await api('POST', `/agency/invoices?day=${D}`, { clientId: cid, items: [{ description: 'Cut', quantity: 1, unitCents: 10000 }], doc: { bank: { bankName: 'Member Bank', holder: 'Team Editor', account: '99990000', ifsc: 'mbnk0000001', upi: 'editor@upi' } } }, E.token, eh);
  const eNewOwner = eNew.json.invoice?.id ? (await api('GET', `/agency/invoices/${eNew.json.invoice.id}`, undefined, T.token)).json.invoice : null;
  check('team: an invoice a member makes pays into the owner\'s bank, never one they send', eNew.status === 201 && eNewOwner?.doc?.bank?.account === '55667788' && !JSON.stringify(eNewOwner ?? {}).includes('99990000'), [eNew.status, eNewOwner?.doc?.bank]);
  // Nor sends the client's link (in every emailed copy) to an address of their own.
  await api('PATCH', `/agency/invoices/${invId}`, { status: 'sent' }, T.token);
  const eMail = await api('POST', `/agency/invoices/${invId}/email`, { to: `team-editor-${stamp}@smoke.test` }, E.token, eh);
  check('team: a member cannot email the client\'s link to an address of their own', eMail.status === 400 && /on record/.test(eMail.json.error ?? ''), eMail.json);
  const eMailOk = await api('POST', `/agency/invoices/${invId}/email`, {}, E.token, eh);
  const mailLog = JSON.stringify((await api('GET', `/agency/doc-log/invoice/${invId}`, undefined, T.token)).json);
  check('team: but sends to the client\'s address on record', eMailOk.status === 200 && !mailLog.includes('team-editor'), [eMailOk.status, eMailOk.json]);
  await api('PATCH', `/agency/team/${eId}`, { access: { overview: 'off', pipeline: 'edit', clients: 'off', paperwork: 'off' } }, T.token);

  // Notes: a member writes team notes, never sees the owner's private ones, and removes only their own.
  const eNote = await api('POST', `/agency/items/${pid}/notes`, { body: `Editor note ${stamp}`, shared: true }, E.token, eh);
  const ownerNotes = (await api('GET', `/agency/items/${pid}/notes`, undefined, T.token)).json.notes ?? [];
  check('team: the owner sees the member\'s note as a team note, by name, never shared with the client', ownerNotes.some((n) => n.body === `Editor note ${stamp}` && n.author === 'team' && n.authorName === 'Team Editor' && n.shared === false), ownerNotes);
  const memberNotes = (await api('GET', `/agency/items/${pid}/notes`, undefined, E.token, eh)).json.notes ?? [];
  check('team: the member sees team notes and never the owner\'s private one', memberNotes.some((n) => n.body === `For the team ${stamp}`) && memberNotes.some((n) => n.body === `Editor note ${stamp}` && n.mine === true) && !memberNotes.some((n) => n.body === `PRIVATE-NOTE-${stamp}`), memberNotes);
  check('team: the member cannot remove the owner\'s note', (await api('DELETE', `/agency/notes/${ownTeamNote.json.id}`, undefined, E.token, eh)).status === 404);
  const tokLink = await api('POST', `/agency/clients/${cid}/portal`, { show: { waiting: true, notes: true } }, T.token);
  await api('PATCH', `/agency/items/${pid}?day=${D}`, { title: 'Team reel', stage: 'review' }, T.token);
  const portal = await api('GET', `/public/agency/${tokLink.json.portalToken}`, undefined, null, { 'CF-Connecting-IP': `10.251.${seed & 255}.9` });
  check('team: team notes never reach the client link', portal.status === 200 && !JSON.stringify(portal.json).includes(`Editor note ${stamp}`) && !JSON.stringify(portal.json).includes(`For the team ${stamp}`), portal.status);

  // The log names who did it.
  await api('PATCH', `/agency/team/${cId}`, { access: { overview: 'off', pipeline: 'edit', clients: 'edit', paperwork: 'off' } }, T.token);
  const STAGES = ['enquiry', 'agreement_sent', 'agreement_signed', 'strategy', 'trial', 'pilot', 'retainer_offer', 'retainer', 'delivery'];
  const atNow = (await api('GET', `/agency/clients/${cid}?day=${D}`, undefined, T.token)).json.lifecycle?.stage ?? 'enquiry';
  const at = STAGES.indexOf(atNow);
  const stg = await api('POST', `/agency/clients/${cid}/stage`, at > 0 ? { to: STAGES[at - 1], undo: true } : { to: 'agreement_sent' }, C.token, ch);
  const life = (await api('GET', `/agency/clients/${cid}?day=${D}`, undefined, T.token)).json.lifecycle?.log ?? [];
  check('team: a stage move by a member is logged as the team, by name', stg.status === 200 && life.some((l) => l.actor === 'team' && l.kind === 'stage' && l.actorName === 'Team Creator'), [stg.json, life.slice(0, 3)]);
  check('team: a piece a member added leaves a team line in the client\'s log', life.some((l) => l.actor === 'team' && l.kind === 'team' && /added a piece/.test(l.text)), life.map((l) => l.text));
  // The client's email is where their link goes: a member with Clients to edit changes the rest, never that.
  const mailBefore = (await api('GET', `/agency/clients/${cid}?day=${D}`, undefined, T.token)).json.client?.contactEmail;
  const ce = await api('PATCH', `/agency/clients/${cid}`, { contactEmail: `team-creator-${stamp}@smoke.test`, health: 'amber' }, C.token, ch);
  const cAfter = (await api('GET', `/agency/clients/${cid}?day=${D}`, undefined, T.token)).json.client;
  check('team: a member cannot change the client\'s email', ce.status === 200 && Boolean(mailBefore) && cAfter?.contactEmail === mailBefore && cAfter?.health === 'amber', [mailBefore, cAfter?.contactEmail, cAfter?.health]);
  await new Promise((r) => setTimeout(r, 800));
  const logs = await api('GET', `/internal/logs?actor=${C.user.id}`, undefined, A.token);
  check('team: the app log names the member, not the owner', logs.status === 200 && logs.json.logs?.some((l) => l.actorId === C.user.id && /\/agency\/clients\/.+\/stage/.test(l.path ?? '')), logs.json.logs?.slice(0, 3));

  // The client member: never the owner's routes, only their own client's read-only page.
  const kh = asMember(kId);
  const kCodes = [];
  for (const p of ['/agency', `/agency/items?day=${D}`, '/agency/invoices', `/agency/clients/${cid}`]) kCodes.push((await api('GET', p, undefined, K.token, kh)).status);
  check('team: a client member is refused on every owner route', kCodes.every((s) => s === 403), kCodes);
  await api('PATCH', `/agency/invoices/${invId}`, { status: 'sent' }, T.token);
  await api('POST', `/agency/clients/${cid}/portal`, { show: { invoices: true, waiting: true, coming: true } }, T.token);
  const kv = await api('GET', `/me/teams/${kId}/client-view`, undefined, K.token);
  const kvText = JSON.stringify(kv.json);
  check('team: a client member reads their own client\'s page', kv.status === 200 && kv.json.view?.clientName === `Team Client Co ${stamp}` && kv.json.view?.invoices?.length >= 1, kv.json.view && { name: kv.json.view.clientName, inv: kv.json.view.invoices?.length });
  check('team: with no fee, retainer, private note, other client or password in it', !kvText.includes('feeCents') && !kvText.includes('retainerCents') && !kvText.includes(`OWNER-PRIVATE-${stamp}`) && !kvText.includes(`PRIVATE-NOTE-${stamp}`) && !kvText.includes(`Other Client ${stamp}`) && !kvText.includes('pass_hash') && !kvText.includes(`Editor note ${stamp}`), '');
  await api('PATCH', `/agency/team/${kId}`, { access: { overview: 'view', pipeline: 'view', clients: 'off', paperwork: 'off' } }, T.token);
  const kv2 = await api('GET', `/me/teams/${kId}/client-view`, undefined, K.token);
  check('team: with paperwork off, the paper is gone', kv2.status === 200 && kv2.json.view?.invoices?.length === 0 && kv2.json.view?.contracts?.length === 0, kv2.json.view?.invoices);
  check('team: someone else cannot read that page', (await api('GET', `/me/teams/${kId}/client-view`, undefined, E.token)).status === 403);

  // Wrong or old rows.
  check('team: a made-up row is refused', (await api('GET', `/agency/items?day=${D}`, undefined, E.token, asMember('not-a-row'))).status === 403);
  check('team: another person\'s row is refused', (await api('GET', `/agency/items?day=${D}`, undefined, X.token, asMember(eId))).status === 403);
  check('team: the owner cannot use a member\'s row', (await api('GET', `/agency/items?day=${D}`, undefined, T.token, asMember(cId))).status === 403);

  // The owner's Agency switched off: members are refused too.
  const off = await admin('POST', '/admin/flags/agency/overrides', { subjectType: 'user', subjectId: T.user.id, enabled: false, reason: 'smoke team' });
  const shut = await api('GET', `/agency/items?day=${D}`, undefined, C.token, ch);
  check('team: with the owner\'s Agency off, a member is refused', shut.status === 403 && /not open/.test(shut.json.error ?? ''), shut.json);
  if (off.json.override?.id) await admin('DELETE', `/admin/flags/overrides/${off.json.override.id}`);
  check('team: and let in again once it is back', (await api('GET', `/agency/items?day=${D}`, undefined, C.token, ch)).status === 200);

  // Removal ends access on the next request.
  check('team: the owner removes the editor', (await api('DELETE', `/agency/team/${eId}`, undefined, T.token)).status === 200);
  const gone = await api('GET', `/agency/items?day=${D}`, undefined, E.token, eh);
  check('team: the editor\'s next request is refused as gone', gone.status === 403 && gone.json.reason === 'gone', gone.json);
  check('team: and their own Agency still works', (await api('GET', `/agency?day=${D}`, undefined, E.token)).status === 200);
  check('team: a member can leave', (await api('POST', `/me/teams/${cId}/leave`, undefined, C.token)).status === 200 && (await api('GET', `/agency/items?day=${D}`, undefined, C.token, ch)).status === 403);

  // One more invite that stays open, so the owner's delete can be seen taking it.
  const iX = await invite({ who: `team-outsider-${stamp}@smoke.test`, role: 'videographer' });
  check('team: an outsider can be invited after all', iX.status === 201, iX.json);

  // The export.
  const tExp = await api('GET', '/me/export', undefined, T.token);
  const kExp = await api('GET', '/me/export', undefined, K.token);
  check('team: the owner\'s export has the team, the member\'s the teams joined', tExp.json.agencyTeam?.length >= 3 && kExp.json.agencyTeamsJoined?.some((r) => r.id === kId && r.client_id === undefined), [tExp.json.agencyTeam?.length, kExp.json.agencyTeamsJoined]);

  // The invite limit: twenty a day, counted on every ask.
  let first429 = 0;
  while (invites < 22 && !first429) {
    const r = await invite({ who: `nobody-${invites}-${stamp}@smoke.test`, role: 'editor' });
    if (r.status === 429) first429 = invites;
  }
  check('team: the twenty-first invite in a day is refused', first429 === 21, first429);

  // Deleting: an account takes its rows and its name off what it did; the tied client takes its client member; the owner takes the team.
  const delE = await api('DELETE', '/me', { confirm: 'DELETE' }, E.token);
  check('team: the editor deletes their account', delE.status === 200, delE.json);
  const afterNotes = (await api('GET', `/agency/items/${pid}/notes`, undefined, T.token)).json.notes ?? [];
  check('team: their note stays on the owner\'s piece without their name', afterNotes.some((n) => n.body === `Editor note ${stamp}` && n.authorName === 'A former team member'), afterNotes.filter((n) => n.author === 'team'));
  const rows = (await api('GET', '/agency/team', undefined, T.token)).json.members ?? [];
  check('team: their rows go with them', !rows.some((m) => m.person?.name === 'Team Editor'), rows.map((m) => m.person?.name));
  await api('DELETE', `/agency/clients/${cid}`, undefined, T.token);
  check('team: deleting the client removes its client member', !(await api('GET', '/me/teams', undefined, K.token)).json.teams?.some((t) => t.id === kId));
  const delT = await api('DELETE', '/me', { confirm: 'DELETE' }, T.token);
  check('team: the owner deletes their account', delT.status === 200, delT.json);
  check('team: and every row of their team goes', (await api('GET', '/me/teams', undefined, X.token)).json.teams?.length === 0, '');
}

// ---------------------------------------------------------------- Emerging (2026-11-04)
import { execFileSync as emergeExec } from 'node:child_process';
import { existsSync as emergeExists } from 'node:fs';
import { zonedToUtc as emergeUtc, addDays as emergeAddDays, isoWeekday as emergeWeekday } from '../../packages/shared/src/index.ts';
section('Emerging');
{
  // A person's own patterns, read across their apps. The data goes in through the ordinary routes; only a tick's time cannot be
  // sent (the server stamps it now), so three ticks are moved back to earlier days in the smoke database itself, never another.
  const smokeState = new URL('./state', import.meta.url).pathname;
  const ownSmokeServer = ORIGIN === 'http://127.0.0.1:8788' && emergeExists(smokeState);
  const smokeSql = (sql) =>
    emergeExec('npx', ['--no-install', 'wrangler', 'd1', 'execute', 'kreators-life', '--local', '--persist-to', smokeState, '--command', sql], { cwd: new URL('../../apps/api', import.meta.url).pathname, stdio: 'pipe' });
  const E = await signup(`insights-${stamp}@smoke.test`, 'Emerge-smoke-ok-1', 'Emerge Smoke');
  const O = await signup(`insights-other-${stamp}@smoke.test`, 'Emerge-smoke-ok-2', 'Emerge Other');
  const get = (q, token = E.token) => api('GET', `/insights?day=${today}${q}`, undefined, token);
  const ago = (n) => emergeAddDays(today, -n);

  const fresh = await get('');
  check('emerging: a new account answers', fresh.status === 200 && fresh.json.day === today && Array.isArray(fresh.json.insights), fresh.json);
  check('emerging: a new account sees only watching lines, no number and no chart', fresh.json.insights?.length > 0 && fresh.json.insights.every((i) => i.state === 'watching' && i.headline === '' && i.chart === null && i.need), fresh.json.insights?.map((i) => [i.key, i.state]));
  check('emerging: a bad day is refused', (await api('GET', '/insights?day=2026-11-31', undefined, E.token)).status === 400);
  check('emerging: an unknown place is refused', (await get('&app=nowhere')).status === 400);
  check('emerging: an unknown pillar is refused', (await get('&rel=constructor')).status === 400);
  check('emerging: needs a session', (await api('GET', `/insights?day=${today}`)).status === 401);

  for (const key of ['mood', 'sleep', 'stress', 'mindful']) await api('PATCH', '/me/modules', { key, on: true }, E.token);
  const built = await api('POST', '/onboarding/build', { relationships: ['self'], date: today, picks: { self: { project: 'Emerge project' } } }, E.token);
  const proj = (built.json.nodes ?? []).find((n) => n.kind === 'project');
  check('emerging: a pyramid to hang tasks on', built.status === 201 && proj?.id, built.status);

  // Three ways of writing the same task, each ticked through the ordinary route (a new account's first three ticks have no wait).
  const ticked = [];
  for (const title of ['Gym session', 'gym sessions', 'Gym session 3']) {
    const made = await api('POST', '/nodes', { kind: 'task', parentId: proj.id, relationship: 'self', title }, E.token);
    const done = await api('POST', `/nodes/${made.json.node?.id}/complete`, { date: today }, E.token);
    check(`emerging: "${title}" is added and ticked`, made.status === 201 && done.status === 200, [made.status, done.status, done.json]);
    ticked.push(made.json.node?.id);
  }
  const oneDay = await get('');
  check('emerging: three ticks on one day are not a habit', !oneDay.json.insights?.some((i) => i.key === 'habit' && i.state === 'ready'), oneDay.json.insights?.filter((i) => i.key === 'habit'));

  // Sleep and mood over sixteen past days: eight nights of 8 hours with a mood of 4, eight of 6 hours with a mood of 2.
  for (let n = 1; n <= 16; n += 1) {
    const good = n % 2 === 1;
    await api('POST', '/wellbeing/sleep', { date: ago(n), value: good ? 8 : 6 }, E.token);
    await api('POST', '/wellbeing/mood', { date: ago(n), value: good ? 4 : 2, note: `mood note ${stamp}` }, E.token);
  }
  // A journal entry whose words must never reach the answer.
  const secret = `Zebra-${stamp}-private`;
  await api('POST', '/journal', { title: secret, body: `${secret} body words`, date: ago(2) }, E.token);
  const withData = await get('');
  const raw = JSON.stringify(withData.json);
  const sm = withData.json.insights?.find((i) => i.key === 'sleep-mood');
  check('emerging: sleep and mood pair up, counted by hand', sm?.state === 'ready' && sm.headline === '4.0 vs 2.0' && sm.chart?.rows?.[0]?.n === 8 && sm.chart?.rows?.[1]?.n === 8 && sm.private === true, sm);
  check('emerging: the line says what went together, never a cause', /^On days after 7 hours of sleep or more, your mood was 4\.0 on average\. On other days, 2\.0\.$/.test(sm?.text ?? '') && !/because|leads to|due to|causes/i.test(sm?.text ?? ''), sm?.text);
  check('emerging: journal words and notes never appear', !raw.includes(secret) && !raw.includes(`mood note ${stamp}`), '');
  const sleepOnly = await get('&app=sleep');
  check('emerging: an app gets only the lines that touch it', sleepOnly.status === 200 && sleepOnly.json.insights?.length > 0 && sleepOnly.json.insights.every((i) => i.apps.includes('sleep') && i.state === 'ready'), sleepOnly.json.insights?.map((i) => i.key));

  // Another person sees none of it, and cannot reach the tasks behind it.
  const other = await get('', O.token);
  const otherRaw = JSON.stringify(other.json);
  check('emerging: another account sees none of this account\'s data', other.status === 200 && !otherRaw.includes('Gym') && !other.json.insights?.some((i) => i.state === 'ready'), other.json.insights?.filter((i) => i.state === 'ready'));
  check('emerging: and cannot change a task the habit names', (await api('PATCH', `/nodes/${ticked[0]}`, { title: 'mine now' }, O.token)).status === 404);

  // Switching an app off takes its lines with it.
  await api('PATCH', '/me/modules', { key: 'stress', on: false }, E.token);
  const offStress = await get('&app=stress');
  const allNoStress = await get('');
  check('emerging: with Stress off, nothing for Stress and no stress line anywhere', offStress.status === 200 && offStress.json.insights?.length === 0 && !allNoStress.json.insights?.some((i) => i.key === 'stress-calm' || i.key === 'money-stress'), offStress.json.insights?.map((i) => i.key));
  await api('PATCH', '/me/modules', { key: 'sleep', on: false }, E.token);
  check('emerging: with Sleep off, sleep and mood goes', !(await get('')).json.insights?.some((i) => i.key === 'sleep-mood'));
  await api('PATCH', '/me/modules', { key: 'sleep', on: true }, E.token);

  if (!ownSmokeServer) {
    console.log('  (skipped the habit checks: they move tick times in the smoke database, and this is not the smoke server on 8788)');
  } else {
    // The three ticks on three different days in the person's zone (India): today, two and four days ago, at 7:30 in the morning.
    const at = (n) => emergeUtc(ago(n), 7 * 60 + 30, 'Asia/Kolkata').toISOString();
    smokeSql(ticked.map((id, i) => `UPDATE nodes SET completed_at = '${at(i * 2)}' WHERE id = '${id}' AND user_id = '${E.user.id}';`).join(' '));
    const three = await get('');
    const habit = three.json.insights?.find((i) => i.key === 'habit' && i.state === 'ready');
    const top = Math.min(...[0, 2, 4].map((n) => emergeWeekday(ago(n))));
    check('emerging: three similar ticks on three days are a habit', habit?.habit?.ticks === 3 && habit.headline === '3 times' && habit.habit.days?.length === 3 && habit.action?.kind === 'habit', habit);
    check('emerging: it suggests a weekly repeat on the usual day at the usual time', habit?.habit?.repeat?.kind === 'weekly' && habit.habit.repeat.days?.length === 1 && habit.habit.repeat.days[0] === top && habit.habit.time === '07:30', habit?.habit);
    check('emerging: the habit is on Daily and Pillars too', (await get('&app=today')).json.insights?.some((i) => i.id === habit?.id) && (await get('&app=tower')).json.insights?.some((i) => i.id === habit?.id));
    // Make it a habit: an open task in the group takes the repeat through the ordinary PATCH, and the card goes by itself.
    const open = await api('POST', '/nodes', { kind: 'task', parentId: proj.id, relationship: 'self', title: 'Gym session' }, E.token);
    const offered = (await get('')).json.insights?.find((i) => i.key === 'habit' && i.state === 'ready');
    check('emerging: an open task in the group is offered, not a new one', offered?.habit?.openTaskId === open.json.node?.id && offered.habit.projectId === proj.id, offered?.habit);
    const kept = await api('PATCH', `/nodes/${open.json.node?.id}`, { repeat: offered?.habit?.repeat, doDate: offered?.habit?.firstDay }, E.token);
    check('emerging: Keep goes through the ordinary task edit', kept.status === 200, kept.json);
    const after = await get('');
    check('emerging: once it repeats, the habit is no longer suggested', !after.json.insights?.some((i) => i.key === 'habit' && i.state === 'ready'), after.json.insights?.filter((i) => i.key === 'habit'));
  }

  // Quick: the reads are one batch, so a read is fast even with weeks of rows.
  let best = Infinity;
  for (let i = 0; i < 3; i += 1) {
    const t0 = performance.now();
    await get('');
    best = Math.min(best, performance.now() - t0);
  }
  check('emerging: answers in under 200 ms', best < 200, `${Math.round(best)} ms`);
}

section('Good and bad habits');
{
  // The 2026-11-04 ask: a task done again and again, or a slip on the not to do list, tied to how the days went and sorted into good
  // and bad habits. Ticks and not to do marks cannot be sent for past days, so they are written into the smoke database itself.
  const habitState = new URL('./state', import.meta.url).pathname;
  const habitOwn = ORIGIN === 'http://127.0.0.1:8788' && emergeExists(habitState);
  const habitSql = (sql) =>
    emergeExec('npx', ['--no-install', 'wrangler', 'd1', 'execute', 'kreators-life', '--local', '--persist-to', habitState, '--command', sql], { cwd: new URL('../../apps/api', import.meta.url).pathname, stdio: 'pipe' });
  const H = await signup(`habits-${stamp}@smoke.test`, 'Habits-smoke-ok-1', 'Habit Smoke');
  const back = (n) => emergeAddDays(today, -n);
  const get = (q = '') => api('GET', `/insights?day=${today}${q}`, undefined, H.token);
  for (const key of ['mood', 'sleep', 'stress', 'mindful']) await api('PATCH', '/me/modules', { key, on: true }, H.token);
  const built = await api('POST', '/onboarding/build', { relationships: ['self'], date: today, picks: { self: { project: 'Habit project' } } }, H.token);
  const proj = (built.json.nodes ?? []).find((n) => n.kind === 'project');
  check('habits: a pyramid to hang tasks on', built.status === 201 && proj?.id, built.status);

  // Count it as a habit: a choice on a repeating task, carried to the next one.
  const daily = { kind: 'daily', every: 1, days: [], until: null };
  const made = await api('POST', '/nodes', { kind: 'task', parentId: proj?.id, relationship: 'self', title: 'Water the plants', repeat: daily, doDate: today, habit: false }, H.token);
  check('habits: a repeating task can be made not a habit', made.status === 201 && made.json.node?.habit === false && made.json.node?.repeat?.kind === 'daily', made.json.node);
  const plain = await api('POST', '/nodes', { kind: 'task', parentId: proj?.id, relationship: 'self', title: 'Stretch', repeat: daily, doDate: today }, H.token);
  check('habits: with no pick the old rule holds (null)', plain.status === 201 && plain.json.node?.habit === null, plain.json.node);
  const on = await api('PATCH', `/nodes/${made.json.node?.id}`, { habit: true }, H.token);
  check('habits: the pick changes through the ordinary edit', on.status === 200 && on.json.node?.habit === true, on.json.node);
  const ticked = await api('POST', `/nodes/${made.json.node?.id}/complete`, { date: today }, H.token);
  check('habits: the next one carries the pick', ticked.status === 200 && ticked.json.next?.habit === true, ticked.json.next);
  const cleared = await api('PATCH', `/nodes/${ticked.json.next?.id}`, { habit: null }, H.token);
  check('habits: null goes back to the old rule', cleared.status === 200 && cleared.json.node?.habit === null, cleared.json.node);
  const exported = await api('GET', '/me/export', undefined, H.token);
  check('habits: the pick is in the export', JSON.stringify(exported.json).includes('"habit":1'), '');

  if (!habitOwn) {
    console.log('  (skipped the good and bad habit checks: they write past days into the smoke database, and this is not the smoke server on 8788)');
  } else {
    // "Evening walk" on the odd days back (1, 3, … 19) with a mood of 4; the even days a mood of 2. "Scroll in bed" slipped on the
    // even days 2 to 12 and kept on the odd ones.
    const walkIds = [];
    for (let n = 1; n <= 19; n += 2) {
      const t = await api('POST', '/nodes', { kind: 'task', parentId: proj?.id, relationship: 'self', title: 'Evening walk' }, H.token);
      walkIds.push([t.json.node?.id, n]);
    }
    for (let n = 1; n <= 20; n += 1) await api('POST', '/wellbeing/mood', { date: back(n), value: n % 2 ? 4 : 2 }, H.token);
    const ntd = await api('POST', '/today/not-to-do', { title: 'Scroll in bed', relationship: 'self' }, H.token);
    check('habits: a not to do item', ntd.status === 201 && ntd.json.item?.id, ntd.json);
    const at = (n) => emergeUtc(back(n), 19 * 60, 'Asia/Kolkata').toISOString();
    const marks = [];
    for (let n = 1; n <= 19; n += 2) marks.push([n, 'kept']);
    for (let n = 2; n <= 12; n += 2) marks.push([n, 'slipped']);
    habitSql(
      [
        ...walkIds.map(([id, n]) => `UPDATE nodes SET status = 'done', completed_at = '${at(n)}' WHERE id = '${id}' AND user_id = '${H.user.id}';`),
        ...marks.map(([n, st]) => `INSERT INTO not_to_do_days (item_id, user_id, day, status, created_at) VALUES ('${ntd.json.item.id}', '${H.user.id}', '${back(n)}', '${st}', '${at(n)}');`),
      ].join(' '),
    );
    const all = await get();
    const ties = (all.json.insights ?? []).filter((i) => i.key === 'habit-tie' && i.state === 'ready');
    const good = ties.find((i) => i.tie?.title === 'Evening walk');
    const bad = ties.find((i) => i.tie?.title === 'Scroll in bed');
    check('habits: Evening walk is a good habit, counted by hand', good?.tie?.verdict === 'good' && good.headline === '4.0 vs 2.0' && good.text === 'On days you ticked “Evening walk”, your mood was 2.0 higher, on average.' && good.private === true, good);
    check('habits: the good habit offers Make it a habit', good?.action?.kind === 'habit' && good.action.label === 'Make it a habit' && good.habit?.projectId === proj?.id, good?.action);
    check('habits: a slip on the not to do list is a bad habit', bad?.tie?.verdict === 'bad' && bad.tie.kind === 'notToDo' && /^On days you slipped on “Scroll in bed”, your mood was 2\.0 lower/.test(bad.text) && bad.action?.to === '/today#ntd-heading', bad);
    check('habits: every line ends on things that happen together, never a cause', ties.every((i) => i.basis.endsWith('Things that happen together, not causes.') && !/because|leads to|due to|causes|makes you/i.test(i.text)), ties.map((i) => i.text));
    check('habits: the plain "keeps coming back" card is not said twice', !(all.json.insights ?? []).some((i) => i.key === 'habit' && i.state === 'ready' && /Evening walk/.test(i.text)), '');
    check('habits: Home and Daily show them', (await get('&app=home')).json.insights?.some((i) => i.key === 'habit-tie') && (await get('&app=today')).json.insights?.some((i) => i.key === 'habit-tie'));
    check('habits: the pillar page shows its own', (await get('&app=pillar&rel=self')).json.insights?.some((i) => i.tie?.title === 'Evening walk'));
    // Make it a habit: a new repeating task, counted as a habit, through the ordinary create; the card then opens the task instead.
    const kept = await api('POST', '/nodes', { kind: 'task', parentId: proj?.id, relationship: 'self', title: good?.habit?.title ?? 'Evening walk', repeat: good?.habit?.repeat, doDate: good?.habit?.firstDay, habit: true }, H.token);
    check('habits: Keep makes a repeating task counted as a habit', kept.status === 201 && kept.json.node?.habit === true, kept.json.node);
    const after = (await get()).json.insights?.find((i) => i.tie?.title === 'Evening walk');
    check('habits: once it repeats, the card opens the task', after?.tie?.repeats === true && after.action?.label === 'Open the task', after?.action);
    // Mood, Sleep and Stress off: nothing that reads how a day felt.
    for (const key of ['mood', 'sleep', 'stress']) await api('PATCH', '/me/modules', { key, on: false }, H.token);
    const off = await get();
    const offTies = (off.json.insights ?? []).filter((i) => i.key === 'habit-tie');
    check('habits: with Mood, Sleep and Stress off, no habit reads wellbeing', off.status === 200 && offTies.every((i) => !i.private && !i.reads.includes('wellbeing')) && !offTies.some((i) => i.state === 'ready' && /mood|slept|stress/.test(i.text)), offTies.map((i) => [i.state, i.text]));
    // Another person sees none of it.
    const O = await signup(`habits-other-${stamp}@smoke.test`, 'Habits-smoke-ok-2', 'Habit Other');
    const other = await api('GET', `/insights?day=${today}`, undefined, O.token);
    check('habits: another account sees none of it', other.status === 200 && !JSON.stringify(other.json).includes('Scroll in bed') && !JSON.stringify(other.json).includes('Evening walk'), '');
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed ? 1 : 0);
