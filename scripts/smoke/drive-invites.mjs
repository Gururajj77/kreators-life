// Drives every way into an account while joining is by invite (2026-11-10), in Chrome against the smoke server (the built app on 8788):
//   A. Welcome with no code: the gate shows, and the waitlist takes a name and an email.
//   B. /join/<good code>: Welcome says the code is ready, Start opens the setup chat, and the account is made inside it.
//   C. /join/<used code>: "This invite does not work", with the code field and the waitlist.
//   D. /signup typed by hand: the server asks for a code, the field shows in place with what was typed kept, and the code makes the account.
//   E. A public event's Join: the code field shows up front, Join waits for it, and the code makes the account and the seat.
// It turns Invite only on for the run through the admin key (test value) and puts it back as it found it. Never on 5173 or 8787.
//   node scripts/smoke/drive-invites.mjs   DRIVE_WIDTH=390|1280  DRIVE_THEME=light|dark  SHOOT_OUT=<folder for the screenshots>
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = process.env.SHOOT_ORIGIN ?? 'http://127.0.0.1:8788';
if (/:(5173|8787)\b/.test(ORIGIN)) throw new Error('drive-invites runs only against the smoke server on 8788');
const ADMIN_KEY = process.env.SMOKE_ADMIN_KEY ?? 'smoke-admin-key';
const WIDTH = Number(process.env.DRIVE_WIDTH ?? 390);
const THEME = process.env.DRIVE_THEME === 'dark' ? 'dark' : 'light';
const OUT = process.env.SHOOT_OUT ?? path.join(path.dirname(new URL(import.meta.url).pathname), 'shots');
fs.mkdirSync(OUT, { recursive: true });
const IP = `10.7.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const stamp = Date.now().toString(36);
const tag = `${WIDTH}-${THEME}`;

async function call(method, p, body, headers = {}) {
  const res = await fetch(`${ORIGIN}/api${p}`, { method, headers: { 'content-type': 'application/json', 'CF-Connecting-IP': IP, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
const admin = (method, p, body) => call(method, p, body, { 'X-Admin-Key': ADMIN_KEY });

const before = await admin('GET', '/admin/invites/settings');
if (before.status !== 200) throw new Error(`admin settings answered ${before.status}`);
await admin('PUT', '/admin/invites/settings', { inviteOnly: true });
const made = await admin('POST', '/admin/invites', { count: 4, label: `drive-invites ${tag}`, days: 7 });
const codes = (made.data.items ?? []).map((x) => x.code);
if (codes.length !== 4) throw new Error(`could not make codes: ${made.status} ${JSON.stringify(made.data)}`);
// The second code is used before the browser opens its link.
const used = await call('POST', '/auth/anon', { invite: codes[1] });
const results = { tag, usedFirst: used.status };

const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'].find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-first-run', '--disable-gpu'] });
const s = (ms) => new Promise((r) => setTimeout(r, ms));

async function fresh() {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: WIDTH, height: WIDTH < 800 ? 844 : 900, deviceScaleFactor: 1, isMobile: WIDTH < 800, hasTouch: WIDTH < 800 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: THEME }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument((mode) => {
    try {
      localStorage.setItem('kreators.theme', JSON.stringify({ state: { mode }, version: 0 }));
      // The privacy card answered, so it never sits over a field being typed into.
      localStorage.setItem('kreators.consent', JSON.stringify({ v: 99, decided: true, choices: {} }));
    } catch {
      // storage may be blocked
    }
  }, THEME);
  await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': IP });
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}-${tag}.png`), fullPage: true });
const text = (page) => page.evaluate(() => document.body.innerText);
const waitText = (page, re, ms = 8000) => page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), { timeout: ms }, re.source).then(() => true).catch(() => false);
const rejectPrivacy = (page) => page.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Reject all/.test(x.textContent))?.click());
const typeInto = async (page, sel, value) => {
  const el = await page.$(sel);
  if (!el) throw new Error(`no field ${sel}`);
  await el.click({ clickCount: 3 });
  await el.type(value);
};
const clickText = (page, re, scope = 'button') => page.evaluate((src, scope) => {
  const b = [...document.querySelectorAll(scope)].find((x) => new RegExp(src).test(x.textContent ?? '') && !x.disabled);
  b?.click();
  return Boolean(b);
}, re.source, scope);
const sessionToken = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('kreators.session') ?? '{}')?.state?.token ?? null);

try {
  // A. Welcome with no code.
  {
    const { ctx, page } = await fresh();
    await page.goto(`${ORIGIN}/start`, { waitUntil: 'networkidle0' });
    await rejectPrivacy(page);
    results.welcomeGate = await waitText(page, /Joining is by invite/);
    results.welcomeNoStartButton = !(await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /short chat/.test(b.textContent))));
    results.welcomeNoSession = !(await sessionToken(page));
    await shot(page, 'welcome-gate');
    await clickText(page, /^Join the waitlist/);
    await s(400);
    await typeInto(page, 'input[autocomplete="name"]', 'Drive Waitlist');
    await typeInto(page, 'input[type="email"]', `wait-${stamp}-${tag}@smoke.test`);
    await typeInto(page, 'textarea', 'I make short videos.');
    await shot(page, 'welcome-waitlist-form');
    await page.evaluate(() => [...document.querySelectorAll('form button[type="submit"]')].find((b) => /Join the waitlist/.test(b.textContent))?.click());
    results.waitlistDone = await waitText(page, /You are on the waitlist/);
    await shot(page, 'welcome-waitlist-done');
    // A wrong code typed at the gate says it does not work and makes nothing.
    await typeInto(page, 'form input[autocapitalize="characters"]', 'ABCDEFGHJK');
    await clickText(page, /^Continue$/);
    results.gateBadCode = await waitText(page, /This invite code does not work/);
    results.gateBadCodeNoSession = !(await sessionToken(page));
    await ctx.close();
  }

  // B. /join/<good code> into the setup chat and an account.
  {
    const { ctx, page } = await fresh();
    await page.goto(`${ORIGIN}/join/${codes[0]}`, { waitUntil: 'networkidle0' });
    await rejectPrivacy(page);
    await page.waitForFunction(() => location.pathname === '/start', { timeout: 8000 }).catch(() => {});
    results.joinGoodLandsWelcome = new URL(page.url()).pathname;
    results.joinGoodReady = await waitText(page, /Your invite code is ready/);
    await shot(page, 'join-good-welcome');
    await clickText(page, /short chat/);
    await page.waitForFunction(() => location.pathname === '/onboarding', { timeout: 10000 }).catch(() => {});
    results.joinGoodChat = new URL(page.url()).pathname;
    results.joinGoodKeptCleared = await page.evaluate(() => sessionStorage.getItem('kreators.invite') === null);
    const card = (fields, button) => page.evaluate(async (fields, button) => {
      const w = (ms) => new Promise((r) => setTimeout(r, ms));
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      for (let i = 0; i < 100 && !document.querySelector(`[data-answer] input[autocomplete="${fields[0][0]}"]`); i++) await w(100);
      for (const [ac, v] of fields) for (const el of document.querySelectorAll(`[data-answer] input[autocomplete="${ac}"]`)) { set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }
      for (const box of document.querySelectorAll('[data-answer] input[type="checkbox"]')) if (!box.checked) box.click();
      await w(200);
      const b = [...document.querySelectorAll('[data-answer] button')].find((x) => x.textContent.includes(button));
      if (b && !b.disabled) { b.click(); return 'sent'; }
      return `not sent: ${b ? 'disabled' : 'missing'}`;
    }, fields, button);
    results.joinGoodSignInCard = await card([['nickname', 'Invited'], ['email', `invited-${stamp}-${tag}@smoke.test`], ['new-password', `Camera-${stamp}-pass`]], 'Next');
    await s(1500);
    results.joinGoodPrivateCard = await card([['tel', '+91 98765 43210'], ['bday', '1990-05-20']], 'Make my account');
    await s(3000);
    const token = await sessionToken(page);
    const me = token ? await call('GET', '/me', undefined, { authorization: `Bearer ${token}` }) : { status: 0, data: {} };
    results.joinGoodAccountEmail = me.data?.user?.email ?? null;
    await shot(page, 'join-good-chat');
    await ctx.close();
  }

  // C. /join/<used code>.
  {
    const { ctx, page } = await fresh();
    await page.goto(`${ORIGIN}/join/${codes[1]}`, { waitUntil: 'networkidle0' });
    await rejectPrivacy(page);
    results.joinUsed = await waitText(page, /This invite does not work/);
    results.joinUsedWaitlistOpen = await page.evaluate(() => Boolean(document.querySelector('input[autocomplete="name"]')));
    results.joinUsedNoSession = !(await sessionToken(page));
    await shot(page, 'join-used');
    await ctx.close();
  }

  // D. /signup with a code typed by hand once the server asks for one.
  {
    const { ctx, page } = await fresh();
    await page.goto(`${ORIGIN}/signup`, { waitUntil: 'networkidle0' });
    await rejectPrivacy(page);
    await typeInto(page, 'input[autocomplete="nickname"]', 'Typed');
    await typeInto(page, 'input[type="email"]', `typed-${stamp}-${tag}@smoke.test`);
    for (const p of await page.$$('input[autocomplete="new-password"]')) { await p.click({ clickCount: 3 }); await p.type(`Camera-${stamp}-pass`); }
    await typeInto(page, 'input[type="tel"]', '+91 98765 43210');
    await page.$eval('input[type="date"]', (el) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '1990-05-20'); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.evaluate(() => { const b = document.querySelector('form input[type="checkbox"]'); if (b && !b.checked) b.click(); });
    await s(300);
    await page.evaluate(() => document.querySelector('form button[type="submit"]')?.click());
    results.signupAsked = await waitText(page, /Joining is by invite/);
    results.signupFieldShown = await page.waitForSelector('input[autocapitalize="characters"]', { timeout: 6000 }).then(() => true).catch(() => false);
    results.signupKeptEmail = await page.$eval('input[type="email"]', (el) => el.value);
    await shot(page, 'signup-asked');
    await typeInto(page, 'input[autocapitalize="characters"]', codes[2].toLowerCase().replace(/(.{5})/, '$1-'));
    await page.evaluate(() => document.querySelector('form button[type="submit"]')?.click());
    await page.waitForFunction(() => location.pathname === '/onboarding', { timeout: 10000 }).catch(() => {});
    results.signupLanded = new URL(page.url()).pathname;
    await ctx.close();
  }

  // E. A public event's Join with the code field up front.
  {
    const list = await call('GET', '/public/events');
    const ev = (list.data.events ?? []).find((e) => !e.pricePoints && e.seatsLeft !== 0) ?? null;
    if (!ev) results.event = 'no free public event on this server';
    else {
      const { ctx, page } = await fresh();
      await page.goto(`${ORIGIN}/events/${ev.id}`, { waitUntil: 'networkidle0' });
      await rejectPrivacy(page);
      results.eventFieldUpFront = await page.waitForSelector('input[autocapitalize="characters"]', { timeout: 8000 }).then(() => true).catch(() => false);
      await typeInto(page, 'input[autocomplete="nickname"]', 'Guest');
      await typeInto(page, 'input[type="email"]', `guest-${stamp}-${tag}@smoke.test`);
      for (const p of await page.$$('input[autocomplete="new-password"]')) { await p.click({ clickCount: 3 }); await p.type(`Camera-${stamp}-pass`); }
      await typeInto(page, 'input[type="tel"]', '+91 98765 43210');
      await page.$eval('input[type="date"]', (el) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '1990-05-20'); el.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.evaluate(() => { for (const b of document.querySelectorAll('form input[type="checkbox"]')) if (!b.checked && /agree/i.test(b.closest('label')?.textContent ?? '')) b.click(); });
      await s(300);
      results.eventJoinWaitsForCode = await page.evaluate(() => Boolean(document.querySelector('form button[type="submit"]')?.disabled));
      await shot(page, 'event-join-code');
      await typeInto(page, 'input[autocapitalize="characters"]', codes[3]);
      await s(200);
      await page.evaluate(() => document.querySelector('form button[type="submit"]')?.click());
      await page.waitForFunction(() => location.pathname.startsWith('/party/'), { timeout: 12000 }).catch(() => {});
      results.eventLanded = new URL(page.url()).pathname;
      await ctx.close();
    }
  }

  // Every code the run made: the first, third and fourth used by the accounts above, the second by the bare device session.
  const after = await admin('GET', `/admin/invites?q=${encodeURIComponent(`drive-invites ${tag}`)}&size=10`);
  results.codeStates = Object.fromEntries((after.data.items ?? []).map((x) => [x.code, `${x.state}${x.usedBy ? ` by ${x.usedBy.name}` : ''}${x.maker ? `, made by ${x.maker.name}` : ''}`]));
} finally {
  await browser.close();
  await admin('PUT', '/admin/invites/settings', { inviteOnly: Boolean(before.data.inviteOnly) });
}
console.log(JSON.stringify(results, null, 1));
