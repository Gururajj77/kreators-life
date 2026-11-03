// Starts a focus clock in Mindful minutes and walks every page a signed-in person can open, at phone and laptop width, checking that the
// small clock pill in the top-left corner is there and still counting on each one, through a reload, a finished Timer, a Stopwatch and a
// Stop. Prints a table of route by width with pass or fail and exits 1 on any fail.
//
//   FOCUS_TOKEN=<session token> node scripts/smoke/drive-focus-everywhere.mjs
//
// FOCUS_ORIGIN (default http://localhost:5173) is the web app; FOCUS_TOKEN a session token for an onboarded account (on the smoke server,
// scripts/smoke/state/shoot-token is used when FOCUS_TOKEN is unset). FOCUS_SHOTS=<dir> saves pictures of the pill on five pages per width.
// FOCUS_WIDTHS=phone,laptop picks the widths, FOCUS_PARTS=routes,reload,timer,stopwatch,stop the parts (all by default). The Timer part
// waits seventy seconds for a one-minute timer to finish and, when "focus sessions count as mindful minutes" is on, checks that its round
// reached the dashboard (so it writes one round and one mindful-minutes log for the account, as a real finished timer would).
//
// The Toggl pass (2026-11-03) adds two parts. `toggl` drives the new pieces on Mindful with the page's clock moved forward (Date.now is
// shifted, so nothing waits): Stop under a minute (no sheet), Stop past a minute (Keep logs one round, Throw away logs none), today's list
// and Continue, the recent tasks in the task sheet, the task in the tab title and on the pill, the laptop keys (and Space typing a space in
// the search box), changing and deleting a session and adding a forgotten one, the daily goal line, the reminder switch, the long time away
// on the Stopwatch, and full screen. `twotabs` starts a one-minute Timer, opens a second page with a copy of the first one's sessionStorage
// (what a duplicated tab gets), waits for the part to end and checks there is exactly one new round and one new mindful-minutes log.
// FOCUS_API=<origin> sends the page's /api calls (and this script's own) to another server, for example the smoke server on 8788 while the
// pages come from the dev app on 5173, so nothing is written to the dev database: FOCUS_API=http://localhost:8788.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = (process.env.FOCUS_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
let TOKEN = process.env.FOCUS_TOKEN || '';
if (!TOKEN) {
  try {
    TOKEN = fs.readFileSync(new URL('./state/shoot-token', import.meta.url), 'utf8').trim();
  } catch {
    console.error('Set FOCUS_TOKEN to a session token.');
    process.exit(2);
  }
}
const SHOTS = process.env.FOCUS_SHOTS || '';
const WIDTHS = (process.env.FOCUS_WIDTHS || 'phone,laptop').split(',');
const PARTS = new Set((process.env.FOCUS_PARTS || 'routes,reload,stopwatch,stop,timer,toggl,twotabs').split(','));
const FOCUS_API = (process.env.FOCUS_API || '').replace(/\/$/, '');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const API = `${FOCUS_API || ORIGIN}/api`;

/** With FOCUS_API, the page's own /api, /go and /out requests are answered by that server instead of the dev app's proxy. */
async function routeApi(page) {
  if (!FOCUS_API) return;
  await page.setRequestInterception(true);
  const here = new URL(ORIGIN).origin;
  page.on('request', async (req) => {
    const u = new URL(req.url());
    if (u.origin !== here || !/^\/(api|go|out)\//.test(u.pathname)) return req.continue();
    try {
      const headers = { ...req.headers() };
      // No Origin header: the server takes a write with none (a foreign one is refused).
      delete headers.host;
      delete headers.origin;
      delete headers.referer;
      const r = await fetch(`${FOCUS_API}${u.pathname}${u.search}`, { method: req.method(), headers, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData() });
      const out = {};
      r.headers.forEach((v, k) => {
        if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k)) out[k] = v;
      });
      await req.respond({ status: r.status, headers: out, body: Buffer.from(await r.arrayBuffer()) });
    } catch {
      await req.abort().catch(() => undefined);
    }
  });
}
/** Every page gets a clock this script can move forward (window.__off milliseconds) and a visibility it can set, for the long-away check. */
const CLOCK_SHIM = () => {
  const real = Date.now.bind(Date);
  window.__off = 0;
  Date.now = () => real() + window.__off;
  window.__vis = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__vis === 'hidden' });
};

// Every page in App.tsx a signed-in person can open. Detail pages (":id") are found from links on their list page as the walk goes.
const ROUTES = [
  '/home', '/today', '/tower', '/apps', '/you', '/search', '/profile', '/help', '/inbox', '/leaderboard', '/discover', '/cards', '/rewards', '/plans',
  '/school', '/work', '/army', '/win', '/agency', '/party', '/run', '/community', '/club', '/bond', '/circles', '/life', '/reviews', '/coaching',
  '/wellbeing', '/mood', '/sleep', '/stress', '/journal', '/companion', '/knowledge', '/tools', '/tv', '/fund', '/sessions', '/library', '/shop',
  '/store', '/shop/page', '/shop/bookings', '/shop/testimonials', '/shop/audience', '/shop/content', '/shop/content/results', '/shop/automations',
  '/shop/customers', '/shop/dm', '/finance', '/internal/observability', '/internal/logs', '/manage', '/admin',
  // The whole-page chats, the vibe check and the standalone pages.
  '/onboarding', '/session', '/vibe-check', '/start', '/signin', '/signup',
  // The public site, signed in.
  '/', '/explore', '/features', '/7rp', '/terms', '/privacy', '/refunds', '/contact', '/pricing', '/subprocessors', '/copyright', '/licences',
];
const DETAIL = [
  /^\/realm\/[\w-]+$/, /^\/features\/[\w-]+$/, /^\/school\/[\w-]+$/, /^\/work\/[\w-]+$/, /^\/army\/[\w-]+$/, /^\/win\/[\w-]+$/,
  /^\/agency\/invoices\/[\w-]+$/, /^\/agency\/contracts\/[\w-]+$/, /^\/agency\/docs\/[\w-]+$/, /^\/agency\/(?!invoices|contracts|docs)[\w-]+$/,
  /^\/party\/[\w-]+$/, /^\/run\/clubs\/[\w-]+$/, /^\/bond\/chats\/[\w-]+$/, /^\/circles\/[\w-]+$/, /^\/coaching\/students\/[\w-]+$/,
  /^\/knowledge\/[\w-]+$/, /^\/library\/[\w-]+$/, /^\/shop\/products\/[\w-]+$/, /^\/shop\/content\/(?!results)[\w-]+$/, /^\/cards\/[\w-]+$/,
  /^\/u\/[\w.-]+$/, /^\/p\/[\w-]+$/,
];
const SHOT_AT = ['/home', '/today', '/onboarding', '/', '/companion', '/vibe-check', '/u/'];

const rows = [];
const record = (width, route, ok, note) => {
  rows.push({ width, route, ok, note });
  console.log(`${ok ? 'pass' : 'FAIL'}  ${width.padEnd(6)} ${route.padEnd(34)} ${note}`);
};

async function api(p, opts = {}) {
  const r = await fetch(`${API}${p}`, { ...opts, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  return r.json();
}
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
async function focusToday() {
  const r = await api(`/wellbeing/focus?view=day&date=${today()}`);
  const b = (r.buckets || []).find((x) => x.key === today());
  return b ? { rounds: b.rounds, minutes: b.minutes } : { rounds: 0, minutes: 0 };
}

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-first-run', '--autoplay-policy=no-user-gesture-required'] });
let failed = false;
try {
  for (const width of WIDTHS) {
    const [w, h] = width === 'phone' ? [390, 844] : [1280, 900];
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await routeApi(page);
    await page.evaluateOnNewDocument(CLOCK_SHIM);
    await page.setViewport({ width: w, height: h, isMobile: width === 'phone', hasTouch: width === 'phone' });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await page.evaluateOnNewDocument((t) => {
      localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 }));
      localStorage.setItem('kreators.theme', JSON.stringify({ state: { mode: 'light' }, version: 0 }));
    }, TOKEN);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 160)));
    // A page load we did not ask for: on the dev server, a file another editor saved makes Vite reload the page. The clock is meant to
    // come back from such a reload, but the pill is missing while the page loads, so a check that saw one is run again.
    let loads = 0;
    page.on('domcontentloaded', () => {
      loads += 1;
    });

    // In-app navigation, the way a Link does it: a new history entry the router picks up, no page load.
    const go = async (p) => {
      await page.evaluate((to) => {
        const idx = (window.history.state && window.history.state.idx) || 0;
        window.history.pushState({ usr: null, key: Math.random().toString(36).slice(2, 10), idx: idx + 1 }, '', to);
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
      }, p);
      await sleep(700);
      await page.waitForNetworkIdle({ idleTime: 300, timeout: 2500 }).catch(() => undefined);
    };
    // The pill: visible, inside the screen, and on top at its own middle (nothing covers it).
    const pill = () =>
      page.evaluate(() => {
        const all = [...document.querySelectorAll('[aria-label*="Back to Mindful"]')];
        for (const el of all) {
          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
          if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const onTop = Boolean(hit && (el.contains(hit) || hit.contains(el) || el.parentElement?.contains(hit)));
          return { visible: true, onTop, text: el.textContent.trim(), x: Math.round(r.left), y: Math.round(r.top) };
        }
        return { visible: false, count: all.length };
      });
    const secs = (t) => {
      const m = /(?:(\d+):)?(\d+):(\d\d)/.exec(t || '');
      return m ? Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : NaN;
    };
    const panelClick = (label) =>
      page.evaluate((text) => {
        const panel = [...document.querySelectorAll('.mf-panel')].find((p) => [...p.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Pomodoro'));
        if (!panel) return 'no panel';
        const b = [...panel.querySelectorAll('button')].find((x) => x.textContent.trim() === text || x.getAttribute('aria-label') === text);
        if (!b) return `no button ${text}`;
        if (b.disabled) return `disabled ${text}`;
        b.click();
        return 'ok';
      }, label);
    const startLabel = () => page.evaluate(() => document.querySelector('.mf-panel .mf-start')?.textContent.trim() ?? null);
    const readout = () => page.evaluate(() => document.querySelector('.mf-panel .mf-time')?.textContent.trim() ?? null);
    // Checks the pill on the page that is showing: there now, there two seconds later, and moving the right way.
    const check = async (route, dir = 'down', shot = false) => {
      let a;
      let b;
      let tries = 0;
      let reloaded = 0;
      for (;;) {
        const at = loads;
        a = await pill();
        await sleep(2100);
        b = await pill();
        tries += 1;
        if (loads === at || tries >= 4) break;
        // Reloaded under us by the dev server: wait for the page to settle and look again.
        reloaded += 1;
        await page.waitForNetworkIdle({ idleTime: 500, timeout: 20000 }).catch(() => undefined);
        await sleep(1500);
      }
      const moved = dir === 'down' ? secs(b.text) < secs(a.text) : secs(b.text) > secs(a.text);
      const ok = a.visible && b.visible && a.onTop && moved;
      const where = `${location()}`;
      const again = reloaded ? ` (looked again after ${reloaded} dev-server reload${reloaded > 1 ? 's' : ''})` : '';
      record(width, route, ok, (a.visible ? `${a.text} -> ${b.text}${a.onTop ? '' : ' (covered)'}${moved ? '' : ' (not counting)'} at ${a.x},${a.y}${where !== route ? ` [${where}]` : ''}` : `no pill [${where}]`) + again);
      if (!ok) failed = true;
      if (shot && SHOTS && ok) {
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: path.join(SHOTS, `${width}-${route.replace(/\//g, '_') || 'root'}.png`) });
      }
      return { a, b };
    };
    const location = () => new URL(page.url()).pathname;
    const noPill = async (route) => {
      const p = await pill();
      record(width, `${route} (no pill)`, !p.visible, p.visible ? `pill still there: ${p.text}` : 'gone');
      if (p.visible) failed = true;
    };

    await page.goto(`${ORIGIN}/home`, { waitUntil: 'networkidle0' });
    await sleep(800);

    // (a) a Pomodoro, then every page.
    if (PARTS.has('routes') || PARTS.has('reload') || PARTS.has('stop')) {
      await go('/mindful');
      await page.waitForSelector('.mf-panel .mf-start', { timeout: 10000 });
      await sleep(600);
      const tab = await panelClick('Pomodoro');
      const st = await panelClick('Start');
      await sleep(1500);
      const label = await startLabel();
      const ok = tab === 'ok' && st === 'ok' && label === 'Pause';
      record(width, '/mindful start Pomodoro', ok, `tab ${tab}, start ${st}, button now ${label}, ${await readout()}`);
      if (!ok) failed = true;
    }
    if (PARTS.has('routes')) {
      const queue = [...ROUTES];
      const seen = new Set(queue);
      const done = new Set();
      const shotsTaken = new Set();
      while (queue.length) {
        const r = queue.shift();
        await go(r);
        const shot = SHOT_AT.some((s) => (s.endsWith('/') && s.length > 1 ? r.startsWith(s) : r === s)) && !shotsTaken.has(SHOT_AT.find((s) => (s.endsWith('/') && s.length > 1 ? r.startsWith(s) : r === s)));
        if (shot) shotsTaken.add(SHOT_AT.find((s) => (s.endsWith('/') && s.length > 1 ? r.startsWith(s) : r === s)));
        await check(r, 'down', shot);
        // Detail pages, one per kind, from the links on this one.
        const hrefs = await page.evaluate(() => [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href').split(/[?#]/)[0]));
        for (const href of hrefs) {
          const kind = DETAIL.findIndex((re) => re.test(href));
          if (kind < 0 || done.has(kind) || seen.has(href)) continue;
          done.add(kind);
          seen.add(href);
          queue.push(href);
        }
      }
      // The card table's focus mode hides the menu, so the pill moves into the table's own toolbar.
      const game = [...seen].find((s) => /^\/cards\/[\w-]+$/.test(s)) || '/cards/ulta_seedha';
      await go(game);
      const entered = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '').startsWith('Focus mode'));
        if (!b) return false;
        b.click();
        return true;
      });
      await sleep(900);
      if (!entered) {
        record(width, `${game} focus mode`, false, 'no Focus mode button');
        failed = true;
      } else await check(`${game} focus mode`, 'down', true);
      await page.keyboard.press('Escape');
      await sleep(400);
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '') === 'Leave focus mode');
        b?.click();
      });
      await sleep(400);
    }

    // (f) the tab's title carries the time on a page that is not Mindful.
    if (PARTS.has('routes') || PARTS.has('reload')) {
      await go('/today');
      const t1 = await page.title();
      await sleep(2100);
      const t2 = await page.title();
      const ok = /\d+:\d\d/.test(t1) && t1 !== t2;
      record(width, '/today tab title', ok, `"${t1}" -> "${t2}"`);
      if (!ok) failed = true;
    }

    // (b) a reload part-way: the clock comes back where it was and keeps counting.
    if (PARTS.has('reload')) {
      const before = await pill();
      await page.reload({ waitUntil: 'networkidle0' });
      await sleep(1200);
      const { a } = await check('/today after reload');
      const drift = secs(before.text) - secs(a.text);
      const ok = before.visible && a.visible && drift >= 0 && drift < 15;
      record(width, '/today reload kept the time', ok, `${before.text} before, ${a.text} after (${drift}s)`);
      if (!ok) failed = true;
      await go('/mindful');
      await sleep(600);
      const label = await startLabel();
      record(width, '/mindful after reload', label === 'Pause', `button ${label}, ${await readout()}`);
      if (label !== 'Pause') failed = true;
    }

    // (e) Stop on Mindful takes the pill away everywhere.
    if (PARTS.has('stop') || PARTS.has('routes') || PARTS.has('reload')) {
      await go('/mindful');
      await sleep(400);
      const s = await panelClick('Stop the sessions and go back to session one');
      await sleep(600);
      // Past a minute, Stop asks "Stop here?" first (Keep or Throw it away); this part throws the long-running session away.
      if (await page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].some((d) => d.textContent.includes('Stop here?')))) {
        await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim().startsWith('Throw it away'))?.click());
        await sleep(600);
      }
      record(width, '/mindful Stop', s === 'ok' && (await startLabel()) === 'Start', `stop ${s}, button ${await startLabel()}`);
      for (const r of ['/home', '/today', '/onboarding', '/', '/vibe-check']) {
        await go(r);
        await noPill(r);
      }
      const t = await page.title();
      const ok = !/\d+:\d\d/.test(t);
      record(width, '/vibe-check title after Stop', ok, `"${t}"`);
      if (!ok) failed = true;
      await page.reload({ waitUntil: 'networkidle0' });
      await sleep(1000);
      await noPill('reload after Stop');
    }

    // (d) a Stopwatch counts up across pages and a reload; the pill's own Stop ends it (under a minute, so nothing is kept).
    if (PARTS.has('stopwatch')) {
      await go('/mindful');
      await sleep(500);
      const tab = await panelClick('Stopwatch');
      const st = await panelClick('Start');
      await sleep(1200);
      record(width, '/mindful start Stopwatch', tab === 'ok' && st === 'ok', `tab ${tab}, start ${st}, ${await readout()}`);
      for (const r of ['/home', '/tower', '/onboarding', '/']) {
        await go(r);
        await check(`${r} stopwatch`, 'up');
      }
      const before = await pill();
      await page.reload({ waitUntil: 'networkidle0' });
      await sleep(1200);
      const { a } = await check(`${location()} stopwatch after reload`, 'up');
      const ok = secs(a.text) >= secs(before.text);
      record(width, 'stopwatch reload kept the time', ok, `${before.text} before, ${a.text} after`);
      if (!ok) failed = true;
      await go('/home');
      // The pill's controls open on hover on a laptop; on a phone they are reachable by keyboard focus too. Click Stop directly.
      const stopped = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button[aria-label="Stop and keep the whole minutes"]')].find((x) => x.getBoundingClientRect().width > 0 || x.closest('.focus-pill-wrap'));
        if (!b) return false;
        b.click();
        return true;
      });
      await sleep(600);
      record(width, '/home pill Stop (stopwatch)', stopped, stopped ? 'clicked' : 'no Stop on the pill');
      if (!stopped) failed = true;
      for (const r of ['/home', '/today', '/session']) {
        await go(r);
        await noPill(r);
      }
      await go('/mindful');
      await sleep(500);
      const ro = await readout();
      record(width, '/mindful stopwatch back to zero', ro === '0:00', `readout ${ro}`);
      if (ro !== '0:00') failed = true;
    }

    // (c) a one-minute Timer finishes while the person is on Home.
    if (PARTS.has('timer')) {
      const settings = (await api('/wellbeing/focus-settings')).settings;
      const before = await focusToday();
      await go('/mindful');
      await sleep(500);
      await panelClick('Timer');
      await sleep(300);
      for (let i = 0; i < 40; i++) await panelClick('Take off 5 minutes');
      for (let i = 0; i < 6; i++) await panelClick('Take off 1 minute');
      await sleep(300);
      const set = await readout();
      const st = await panelClick('Start');
      await sleep(1200);
      record(width, '/mindful start 1-minute Timer', set === '1:00' && st === 'ok', `set ${set}, start ${st}, ${await readout()}`);
      await go('/home');
      await check('/home timer');
      const waitUntil = Date.now() + 75_000;
      let p = await pill();
      while (p.visible && Date.now() < waitUntil) {
        await sleep(2000);
        p = await pill();
      }
      record(width, '/home timer finished (pill gone)', !p.visible, p.visible ? `still ${p.text}` : 'gone');
      if (p.visible) failed = true;
      const t = await page.title();
      record(width, '/home title after Timer', !/\d+:\d\d/.test(t), `"${t}"`);
      await go('/mindful');
      await sleep(800);
      const label = await startLabel();
      const ro = await readout();
      const ready = label === 'Start' && ro === '1:00';
      record(width, '/mindful timer ready again', ready, `button ${label}, readout ${ro}`);
      if (!ready) failed = true;
      if (settings?.logFocus) {
        await sleep(1500);
        const after = await focusToday();
        const ok = after.rounds === before.rounds + 1;
        record(width, 'timer round logged', ok, `rounds ${before.rounds} -> ${after.rounds}, minutes ${before.minutes} -> ${after.minutes}`);
        if (!ok) failed = true;
      } else record(width, 'timer round logged', true, 'focus sessions do not count as mindful minutes, so nothing to log');
    }

    // (g) The Toggl pass, on Mindful, with the page's clock moved forward instead of waited for.
    if (PARTS.has('toggl')) {
      const rec = (name, ok, note = '') => {
        record(width, name, ok, note);
        if (!ok) failed = true;
      };
      const shift = (ms) => page.evaluate((m) => (window.__off += m), ms);
      const dialog = (title) => page.evaluate((t) => [...document.querySelectorAll('[role="dialog"]')].some((d) => d.textContent.includes(t)), title);
      const clickIn = (sel, text) =>
        page.evaluate(
          (sc, t) => {
            // Any dialog that has the button (the privacy card at the bottom left is a dialog too).
            const b = [...document.querySelectorAll(sc)].flatMap((root) => [...root.querySelectorAll('button')]).find((x) => x.textContent.trim().startsWith(t) || x.getAttribute('aria-label') === t);
            if (!b) return 'none';
            if (b.disabled) return 'disabled';
            b.click();
            return 'ok';
          },
          sel,
          text,
        );
      const rounds = async () => (await api(`/wellbeing/focus/today?date=${today()}`)).rounds || [];
      const shoot = async (name) => {
        if (!SHOTS) return;
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: path.join(SHOTS, `${width}-${name}.png`) });
      };
      await go('/mindful');
      await page.waitForSelector('.mf-panel .mf-start', { timeout: 10000 });
      await sleep(600);
      // The privacy card asks once; answer it so it is out of the way.
      await clickIn('[role="dialog"]', 'Reject all');
      await panelClick('Timer');
      await sleep(300);

      // T3: under a minute, Stop stops with no sheet.
      await panelClick('Start');
      await sleep(900);
      await panelClick('Stop the timer');
      await sleep(500);
      rec('T3 stop under a minute: no sheet', !(await dialog('Stop here?')) && (await startLabel()) === 'Start', `button ${await startLabel()}`);
      // T3: past a minute it asks; Keep logs one round of one minute.
      const n0 = (await rounds()).length;
      await panelClick('Start');
      await sleep(500);
      // The timer part left the Timer at one minute; five more keep it running past the jump.
      await panelClick('Add 5 minutes');
      await sleep(200);
      await shift(70_000);
      await sleep(700);
      await panelClick('Stop the timer');
      await sleep(700);
      const asked = await dialog('Stop here?');
      await shoot('stop-sheet');
      const kept = await clickIn('[role="dialog"]', 'Keep 1 minute');
      await sleep(1800);
      const r1 = await rounds();
      rec('T3 stop past a minute asks; Keep logs one 1-minute round', asked && kept === 'ok' && r1.length === n0 + 1 && r1[0]?.minutes === 1, `asked ${asked}, keep ${kept}, rounds ${n0} -> ${r1.length}, ${r1[0]?.minutes} min`);
      // Throw it away logs nothing.
      await panelClick('Start');
      await sleep(500);
      // The timer part left the Timer at one minute; five more keep it running past the jump.
      await panelClick('Add 5 minutes');
      await sleep(200);
      await shift(70_000);
      await sleep(700);
      await panelClick('Stop the timer');
      await sleep(700);
      const threw = await clickIn('[role="dialog"]', 'Throw it away');
      await sleep(1500);
      rec('T3 Throw it away logs nothing', threw === 'ok' && (await rounds()).length === n0 + 1, `throw ${threw}`);
      // T1: today's list shows every session.
      await sleep(600);
      const listed = await page.evaluate(() => document.querySelectorAll('[data-focus-round]').length);
      rec("T1 today's list shows the sessions", listed === r1.length, `${listed} rows, ${r1.length} rounds`);

      // T2: the task sheet opens on recent tasks; a tap picks one.
      await page.evaluate(() => document.querySelector('button[aria-label="Focus on a task"]')?.click());
      await sleep(900);
      const recent = await dialog('Recent');
      await shoot('task-sheet');
      // The first recent task of whatever account runs this (the toggl stream's own account had "Edit vlog intro").
      const TASK = (await page.evaluate(() => document.querySelector('ul[aria-label="Tasks you focused on lately"] button span')?.textContent?.trim())) || 'Edit vlog intro';
      const TASK_RE = TASK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pickedTask = await clickIn('[role="dialog"]', TASK);
      await sleep(600);
      const onIt = await page.evaluate((t) => [...document.querySelectorAll('.mf-panel .mf-line')].some((p) => p.textContent.includes(t)), TASK);
      rec('T2 a recent task row picks the task', recent && pickedTask === 'ok' && onIt, `recent ${recent}, pick ${pickedTask}, on it ${onIt}`);

      // T7: the task is in the tab title while the clock runs, and on the pill from the tablet width up.
      await panelClick('Start');
      await sleep(1300);
      const title = await page.title();
      rec('T7 tab title carries the task', new RegExp(`^\\d+:\\d\\d · ${TASK_RE} · kreators\\.app$`).test(title), `"${title}"`);
      await go('/home');
      await sleep(600);
      const pillText = await page.evaluate(() => [...document.querySelectorAll('.focus-pill')].filter((el) => el.getBoundingClientRect().width > 0).map((el) => el.innerText.replace(/\s+/g, ' ').trim()));
      rec('T7 pill: task beside the time on a laptop, time only on a phone', width === 'laptop' ? pillText.some((t) => t.includes(TASK.slice(0, 12))) : pillText.length > 0 && pillText.every((t) => !t.includes(TASK.slice(0, 12))), JSON.stringify(pillText));
      await shoot('pill-task');
      await go('/mindful');
      await sleep(500);
      await panelClick('Stop the timer');
      await sleep(500);

      // T6: the laptop keys.
      if (width === 'laptop') {
        await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
        await page.keyboard.press('Space');
        await sleep(600);
        const a1 = await startLabel();
        await page.keyboard.press('Space');
        await sleep(400);
        const a2 = await startLabel();
        await page.keyboard.press('s');
        await sleep(500);
        const a3 = await startLabel();
        rec('T6 Space starts and pauses, S stops', a1 === 'Pause' && a2 === 'Resume' && a3 === 'Start', `${a1}, ${a2}, ${a3}`);
        await page.keyboard.press('?');
        await sleep(600);
        rec('T6 ? lists the keys', await dialog('Keyboard shortcuts'));
        await page.keyboard.press('Escape');
        await sleep(500);
        await page.evaluate(() => document.querySelector('button[aria-label="Focus on a task"]')?.click());
        await sleep(800);
        await page.focus('[role="dialog"] input[type="search"]');
        await page.keyboard.type('a b');
        await sleep(400);
        const typed = await page.evaluate(() => document.querySelector('[role="dialog"] input[type="search"]')?.value);
        rec('T6 Space in the search box types a space', typed === 'a b' && (await startLabel()) === 'Start', `"${typed}", ${await startLabel()}`);
        await page.keyboard.press('Escape');
        await sleep(500);
      }

      // T1: Continue starts the same clock, length and task.
      const cont = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '').startsWith('Continue: 1 minutes'));
        if (!b) return 'none';
        b.click();
        return 'ok';
      });
      await sleep(1200);
      const ro = await readout();
      rec('T1 Continue starts the same length again', cont === 'ok' && (await startLabel()) === 'Pause' && /^0:5\d|^1:00$/.test(ro), `continue ${cont}, ${await startLabel()}, ${ro}`);
      await panelClick('Stop the timer');
      await sleep(600);

      // T4: change a session's length, then delete it; add one that was forgotten.
      const before = await rounds();
      await page.evaluate(() => document.querySelector('[data-focus-round] button')?.click());
      await sleep(900);
      const editing = await dialog('Change this session');
      await page.focus('[role="dialog"] [role="slider"]');
      for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
      await sleep(300);
      await shoot('edit-sheet');
      await clickIn('[role="dialog"]', 'Save');
      await sleep(1500);
      const afterEdit = await rounds();
      rec('T4 a session can be changed', editing && afterEdit[0]?.minutes === before[0]?.minutes + 4, `${before[0]?.minutes} -> ${afterEdit[0]?.minutes}`);
      await page.evaluate(() => document.querySelector('[data-focus-round] button')?.click());
      await sleep(900);
      await clickIn('[role="dialog"]', 'Delete this session');
      await sleep(300);
      await clickIn('[role="dialog"]', 'Delete it');
      await sleep(1500);
      rec('T4 a session can be deleted (asked twice)', (await rounds()).length === before.length - 1, `${before.length} -> ${(await rounds()).length}`);
      await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add a session I forgot')?.click());
      await sleep(900);
      await clickIn('[role="dialog"]', 'Yesterday');
      await clickIn('[role="dialog"]', 'Add this session');
      await sleep(1500);
      const y = new Date(Date.now() - 86_400_000);
      const yd = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      const yRounds = (await api(`/wellbeing/focus/today?date=${yd}`)).rounds || [];
      rec('T4 a forgotten session lands on yesterday', yRounds.some((r) => r.mode === 'manual' && r.minutes === 25), JSON.stringify(yRounds.map((r) => [r.mode, r.minutes])));

      // T5 and T8: the goal line, and the reminder switch.
      await page.evaluate(() => document.querySelector('button[aria-label="Timer settings"]')?.click());
      await sleep(900);
      const sw = (label) =>
        page.evaluate((l) => {
          const b = [...document.querySelectorAll('[role="dialog"] [role="switch"]')].find((x) => x.closest('label')?.textContent.includes(l));
          if (!b) return 'none';
          // Switch it on, never off: a run before this one may have left it on (both live on the account).
          if (b.getAttribute('aria-checked') !== 'true') b.click();
          return b.getAttribute('aria-checked');
        }, label);
      const g = await sw('A daily focus goal');
      await sleep(500);
      await page.focus('[role="dialog"] [role="slider"][aria-label="Daily focus goal"]');
      // 30 minutes from wherever it was: Home is the 15-minute floor, then one step of 15.
      await page.keyboard.press('Home');
      await sleep(300);
      await page.keyboard.press('ArrowRight');
      await sleep(600);
      const rm = await sw('Remind me to focus');
      await sleep(500);
      await shoot('settings-goal-reminder');
      await page.keyboard.press('Escape');
      await sleep(2500);
      const goalLine = await page.evaluate(() => document.querySelector('[data-focus-goal]')?.textContent.trim() ?? '');
      rec('T5 the goal line shows "N of 30 minutes today"', g !== 'none' && /^\d+ of 30 minutes today/.test(goalLine), `"${goalLine}"`);
      const saved = (await api('/wellbeing/focus-settings')).settings;
      rec('T8 the reminder switch saves a time, off by default until switched', rm !== 'none' && saved?.reminderTime === '09:00' && saved?.goalMinutes === 30, JSON.stringify({ reminderTime: saved?.reminderTime, goal: saved?.goalMinutes }));
      await shoot('today-list');

      // T10: a stopwatch left in a hidden tab for over half an hour asks how much counts.
      await panelClick('Stopwatch');
      await sleep(300);
      await panelClick('Start');
      await sleep(500);
      await shift(40 * 60_000);
      await page.evaluate(() => {
        window.__vis = 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await shift(90 * 60_000);
      await page.evaluate(() => {
        window.__vis = 'visible';
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await sleep(900);
      const away = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].map((d) => d.innerText).join(' '));
      await shoot('away-sheet');
      await clickIn('[role="dialog"]', 'Keep up to when you left');
      await sleep(700);
      const swRo = await readout();
      rec('T10 long away: the sheet asks, and "up to when you left" leaves 40m', /Keep all 2h 10m/.test(away) && /Keep up to when you left \(40m\)/.test(away) && swRo === '40:00' && (await startLabel()) === 'Resume', `${swRo}, ${await startLabel()}`);
      await panelClick('Back to zero and keep nothing');
      await sleep(400);
      await panelClick('Timer');

      // T12: full screen hides the menu and the assistant; Escape brings them back.
      if (width === 'laptop') {
        const chrome = () => page.evaluate(() => ({ nav: Boolean(document.querySelector('nav[aria-label="Main"]')), bot: Boolean(document.querySelector('button[aria-label="Open the assistant"]')) }));
        const c0 = await chrome();
        await page.evaluate(() => document.querySelector('button[aria-label="Full screen"]')?.click());
        await sleep(700);
        const c1 = await chrome();
        await page.keyboard.press('Escape');
        await sleep(700);
        const c2 = await chrome();
        rec('T12 full screen hides the menu and assistant; Escape restores them', c0.nav && c0.bot && !c1.nav && !c1.bot && c2.nav && c2.bot, JSON.stringify([c0, c1, c2]));
      }
    }

    // (h) A duplicated tab: two pages with the same run finish one part, and it is kept once.
    if (PARTS.has('twotabs') && width === 'laptop') {
      const rec = (name, ok, note = '') => {
        record(width, name, ok, note);
        if (!ok) failed = true;
      };
      const mindfulCount = async () => ((await api('/wellbeing/mindful?days=2')).logs || []).filter((l) => l.extra?.kind === 'focus').length;
      const r0 = (await api(`/wellbeing/focus/today?date=${today()}`)).rounds?.length ?? 0;
      const m0 = await mindfulCount();
      await go('/mindful');
      await sleep(500);
      await panelClick('Timer');
      await sleep(300);
      for (let i = 0; i < 40; i++) await panelClick('Take off 5 minutes');
      for (let i = 0; i < 6; i++) await panelClick('Take off 1 minute');
      await panelClick('Start');
      await sleep(1500);
      const copy = await page.evaluate(() => Object.fromEntries(Object.keys(sessionStorage).map((k) => [k, sessionStorage.getItem(k)])));
      const twin = await ctx.newPage();
      await routeApi(twin);
      await twin.setViewport({ width: w, height: h });
      await twin.evaluateOnNewDocument((t, store) => {
        localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 }));
        for (const [k, v] of Object.entries(store)) sessionStorage.setItem(k, v);
      }, TOKEN, copy);
      await twin.goto(`${ORIGIN}/mindful`, { waitUntil: 'networkidle0' });
      await sleep(1500);
      const ro = await twin.evaluate(() => [...document.querySelectorAll('.mf-panel .mf-line')].some((p) => p.textContent.includes('Running in another tab')));
      if (SHOTS) await twin.screenshot({ path: path.join(SHOTS, `${width}-twin.png`) });
      rec('T13 the copied tab shows the clock read-only', ro, String(ro));
      await sleep(65_000);
      await sleep(2000);
      const r1 = (await api(`/wellbeing/focus/today?date=${today()}`)).rounds?.length ?? 0;
      const m1 = await mindfulCount();
      rec('T13 one part, two tabs: exactly one round and one mindful log', r1 === r0 + 1 && m1 === m0 + 1, `rounds ${r0} -> ${r1}, mindful ${m0} -> ${m1}`);
      await twin.close();
    }
    if (errors.length) console.log(`${width} page errors:`, [...new Set(errors)].slice(0, 8));
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log('\nroute x width');
const routes = [...new Set(rows.map((r) => r.route))];
console.log(`${'route'.padEnd(40)} ${WIDTHS.map((w) => w.padEnd(7)).join(' ')}`);
for (const r of routes) console.log(`${r.padEnd(40)} ${WIDTHS.map((w) => { const x = rows.find((y) => y.route === r && y.width === w); return (x ? (x.ok ? 'pass' : 'FAIL') : '-').padEnd(7); }).join(' ')}`);
const bad = rows.filter((r) => !r.ok).length;
console.log(`\n${rows.length - bad} pass, ${bad} fail`);
process.exit(failed || bad ? 1 : 0);
