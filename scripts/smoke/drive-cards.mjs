// Drives the card table in Chrome and counts what the founder saw break. For every game, width and theme it deals 6 and then 9
// cards and reports, as one JSON line each:
//   covered   title bands (the top 38% of a card: its deck band and title) that a card dealt later lies on, counted only while the
//             table still had room (a card dealt with no spot left is marked data-crowded); it must be 0,
//   crowdedAt the card number at which the table was full (null when it never was),
//   outside   cards past the table's edge, in focus mode, after leaving it and back in again; each must be 0,
//   clippedWithoutReadAll  card faces whose words are cut with no Read all on them; it must be 0,
//   decksHidden  a deck row that runs off its own edge (every deck must be in view or behind More); it must be false.
// Needs the smoke server (blueprint.sh --keep) on 8788. CARDS_ORIGIN serves the pages (default the same server; point it at a Vite
// dev server to drive the source as it is, and the /api calls still go to CARDS_API). CARDS_GAMES, CARDS_WIDTHS and CARDS_THEMES
// narrow the run, CARDS_SHOTS=<dir> saves a shot of each table and of the first Read all sheet. The account is the smoke founder
// (the team plays every game), or SHOOT_TOKEN / scripts/smoke/state/shoot-token when set.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const API = process.env.CARDS_API ?? 'http://127.0.0.1:8788';
const ORIGIN = process.env.CARDS_ORIGIN ?? API;
const GAMES = (process.env.CARDS_GAMES ?? 'ulta_seedha,dateflow_connect,date_guru,healflow,funflow,relationship_method,roast_or_flirt,shadowflow,workflow').split(',');
const WIDTHS = (process.env.CARDS_WIDTHS ?? '360,390,768,1280').split(',').map(Number);
const THEMES = (process.env.CARDS_THEMES ?? 'light,dark').split(',');
const SHOTS = process.env.CARDS_SHOTS ?? '';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tokenFor() {
  if (process.env.SHOOT_TOKEN) return process.env.SHOOT_TOKEN;
  const file = new URL('./state/shoot-token', import.meta.url);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const ip = `10.91.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const r = await fetch(`${API}/api/auth/signin`, { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify({ email: 'founder@smoke.test', password: process.env.SMOKE_FOUNDER_PASS ?? 'Mountain-smoke-ok' }) });
  const j = await r.json();
  if (!j.token) throw new Error(`sign-in failed: ${r.status}`);
  return j.token;
}

const token = await tokenFor();
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-first-run'] });
let bad = 0;

// Everything the table shows, measured in the page.
const measure = () => {
  const table = document.querySelector('[aria-label="Card table"]');
  const tr = table.getBoundingClientRect();
  const cards = [...table.querySelectorAll('[data-table-card]')].map((el) => ({ r: el.getBoundingClientRect(), z: Number(el.style.zIndex) || 0, crowded: el.dataset.crowded === '1' }));
  const span = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  let covered = 0;
  for (const a of cards) {
    const band = { top: a.r.top, bottom: a.r.top + a.r.height * 0.38, left: a.r.left, right: a.r.right };
    if (cards.some((b) => b !== a && b.z > a.z && span(band.left, band.right, b.r.left, b.r.right) > 1 && span(band.top, band.bottom, b.r.top, b.r.bottom) > 1)) covered += 1;
  }
  const outside = cards.filter((c) => c.r.right > tr.right + 1 || c.r.left < tr.left - 1 || c.r.bottom > tr.bottom + 1 || c.r.top < tr.top - 1).length;
  const faces = [...table.querySelectorAll('[data-card-face]')];
  const clippedWithoutReadAll = faces.filter((f) => {
    const b = f.querySelector('[data-card-body]');
    const cut = b && b.scrollHeight > b.clientHeight + 1;
    const read = [...f.querySelectorAll('button')].some((x) => x.textContent.trim() === 'Read all');
    return cut && !read;
  }).length;
  const clipped = faces.filter((f) => { const b = f.querySelector('[data-card-body]'); return b && b.scrollHeight > b.clientHeight + 1; }).length;
  const decks = document.querySelector('[role="group"][aria-label="Decks"]');
  const decksHidden = decks ? decks.scrollWidth > decks.clientWidth + 2 || decks.getBoundingClientRect().right > innerWidth + 1 : false;
  return { table: `${Math.round(tr.width)}x${Math.round(tr.height)}`, cards: cards.length, crowded: cards.filter((c) => c.crowded).length, covered, outside, clipped, clippedWithoutReadAll, decksHidden, docScroll: document.documentElement.scrollWidth > innerWidth };
};

for (const theme of THEMES) for (const w of WIDTHS) for (const g of GAMES) for (const deal of [6, 9]) {
  const page = await browser.newPage();
  const phone = w < 768;
  await page.setViewport({ width: w, height: phone ? 800 : 900, isMobile: phone, hasTouch: phone });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  if (ORIGIN !== API) {
    await page.setRequestInterception(true);
    page.on('request', async (req) => {
      const u = req.url();
      if (!u.startsWith(`${ORIGIN}/api/`)) return req.continue();
      try {
        const h = { ...req.headers() };
        delete h.host;
        const r = await fetch(API + u.slice(ORIGIN.length), { method: req.method(), headers: h, body: req.postData() });
        const headers = Object.fromEntries(r.headers.entries());
        delete headers['content-encoding'];
        await req.respond({ status: r.status, headers, body: Buffer.from(await r.arrayBuffer()) });
      } catch {
        await req.abort();
      }
    });
  }
  await page.evaluateOnNewDocument((t) => {
    localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 }));
  }, token);
  await page.goto(`${ORIGIN}/cards/${g}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[aria-label="Card table"]', { timeout: 15000 });
  await sleep(500);
  const click = (text) => page.evaluate((x) => { const b = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().startsWith(x) && !e.disabled); b?.click(); return !!b; }, text);
  // The privacy card sits over the foot of the table on a phone: answer it first, the way a person would.
  await click('Reject all');
  await sleep(200);

  let covered = 0;
  let crowdedAt = null;
  for (let i = 0; i < deal; i += 1) {
    await click('Draw a card');
    await sleep(160);
    const m = await page.evaluate(measure);
    if (m.crowded > 0 && crowdedAt === null) crowdedAt = i + 1;
    if (crowdedAt === null) covered = Math.max(covered, m.covered);
  }
  await sleep(300);
  const r = { ...(await page.evaluate(measure)), covered, crowdedAt };
  const name = `${g}-${w}-${theme}-${deal}`;
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
    if (deal === 6 && phone) {
      const read = await page.evaluate(() => { const b = [...document.querySelectorAll('[aria-label="Card table"] button')].find((x) => x.textContent.trim() === 'Read all'); b?.click(); return !!b; });
      if (read) { await sleep(500); await page.screenshot({ path: `${SHOTS}/${name}-read.png` }); await page.keyboard.press('Escape'); await sleep(300); }
    }
  }
  // Focus mode: in, out and back in, and no card may sit outside the table at any point.
  await click('Focus mode');
  await sleep(700);
  r.outsideFocus = (await page.evaluate(measure)).outside;
  if (SHOTS && deal === 9) await page.screenshot({ path: `${SHOTS}/${name}-focus.png` });
  await page.keyboard.press('Escape');
  await sleep(700);
  r.outsideAfter = (await page.evaluate(measure)).outside;
  await click('Focus mode');
  await sleep(700);
  r.outsideBackIn = (await page.evaluate(measure)).outside;
  const fail = r.covered || r.outside || r.outsideFocus || r.outsideAfter || r.outsideBackIn || r.clippedWithoutReadAll || r.decksHidden || r.docScroll;
  if (fail) bad += 1;
  console.log(name, JSON.stringify(r), fail ? 'FAIL' : 'ok');
  await page.close();
}
await browser.close();
console.log(bad ? `${bad} runs failed` : 'all runs ok');
process.exit(bad ? 1 : 0);
