// Daily's Add a task, end to end in a browser (2026-11-13, the founder: "unable to add a new task still in daily, check it"): open the fold,
// type a title, press Add task, and read the POST, the status line and the new row, at a phone's and a laptop's width.
// Needs the smoke server (blueprint.sh --keep) and a prepared account (shots-all.mjs writes scripts/smoke/state/shoot-token).
// Usage: node scripts/smoke/drive-addtask.mjs [folder for screenshots]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const ORIGIN = process.env.SHOOT_ORIGIN ?? 'http://127.0.0.1:8788';
const OUT = process.argv[2] ?? new URL('./shots', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const token = fs.readFileSync(new URL('./state/shoot-token', import.meta.url), 'utf8').trim();
const api = async (m, p) => (await fetch(`${ORIGIN}/api${p}`, { method: m, headers: { authorization: `Bearer ${token}`, 'CF-Connecting-IP': '10.77.3.9' } })).json();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run'] });
let ok = true;
const note = (n, c, x = '') => { if (!c) ok = false; console.log(c ? 'ok  ' : 'FAIL', n, x); };
for (const width of [390, 1280]) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: width < 768 ? 844 : 900, isMobile: width < 768, hasTouch: width < 768 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
  const posts = [];
  page.on('response', (r) => { if (r.request().method() === 'POST' && /\/api\/nodes$/.test(new URL(r.url()).pathname)) posts.push(r.status()); });
  await page.evaluateOnNewDocument((t) => localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 })), token);
  await page.goto(`${ORIGIN}/today`, { waitUntil: 'networkidle0' });
  const title = `Added by the drive ${width} ${Date.now().toString(36).slice(-4)}`;
  const fold = await page.evaluateHandle(() => [...document.querySelectorAll('button[aria-expanded]')].find((b) => b.textContent.trim().startsWith('Add a task')));
  note(`${width}: the Add a task fold is there`, !!fold.asElement());
  if (!fold.asElement()) { await page.close(); continue; }
  await fold.asElement().evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await sleep(200);
  await fold.asElement().click();
  // The form is its own chunk; wait for its title field.
  const field = await page.waitForSelector('input[placeholder="One clear thing you can finish"]', { timeout: 8000 }).catch(() => null);
  note(`${width}: the form opens with its title field`, !!field);
  if (!field) { await page.close(); continue; }
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('placeholder'));
  note(`${width}: the cursor is in the title`, focused === 'One clear thing you can finish', String(focused));
  await field.type(title);
  // As a person would: wait for the row to be held above the tab bar (and what floats over it to rise), then tap it where it is.
  await sleep(700);
  const btn = await page.evaluateHandle(() => [...document.querySelectorAll('form button[type=submit]')].find((b) => /Add task/.test(b.textContent)));
  const state = await btn.asElement()?.evaluate((b) => { let r2 = b.getBoundingClientRect(); if (r2.bottom > innerHeight || r2.top < 0) { b.scrollIntoView({ block: 'nearest' }); r2 = b.getBoundingClientRect(); } const top = document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2); const c = document.querySelector('.lift-over-sticky.fixed'); const sa = b.closest('.sticky-action'); return { held: document.documentElement.hasAttribute('data-sticky-held'), ride: document.documentElement.hasAttribute('data-sticky-ride'), lift: c ? getComputedStyle(c).translate : '', card: c ? [Math.round(c.getBoundingClientRect().top), Math.round(c.getBoundingClientRect().bottom)] : null, stuck: sa?.hasAttribute('data-stuck'), disabled: b.disabled, y: Math.round(r2.top), onTop: !!top && (top === b || b.contains(top)), cover: top && top !== b && !b.contains(top) ? `${top.tagName}.${String(top.className).slice(0, 60)}` : '' }; });
  note(`${width}: Add task can be pressed`, state && !state.disabled && state.onTop, JSON.stringify(state));
  await sleep(200);
  await btn.asElement()?.click();
  for (let i = 0; i < 40 && posts.length === 0; i++) await sleep(150);
  await sleep(1500);
  note(`${width}: POST /api/nodes answers 201`, posts.includes(201) || posts.includes(200), JSON.stringify(posts));
  const status = await page.evaluate(() => [...document.querySelectorAll('p[role=status]')].map((p) => p.textContent).find((t) => /^Added/.test(t)) ?? '');
  note(`${width}: the status line says where it went`, status.includes(title), status);
  const row = await page.evaluate((t) => [...document.querySelectorAll('main li')].some((l) => l.textContent.includes(t)), title);
  const saved = ((await api('GET', `/wellbeing/focus/tasks?q=${encodeURIComponent(title)}`)).tasks ?? []).find((t) => t.title === title);
  note(`${width}: the task is on the server`, !!saved);
  note(`${width}: and its row is on Daily`, row);
  const statusEl = await page.evaluateHandle(() => [...document.querySelectorAll('p[role=status]')].find((p) => /^Added/.test(p.textContent)));
  if (statusEl.asElement()) await statusEl.asElement().evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await sleep(300);
  await page.screenshot({ path: `${OUT}/addtask-${width}.png` });
  console.log(`${width}: page errors`, errors);
  if (saved) await fetch(`${ORIGIN}/api/nodes/${saved.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}`, 'CF-Connecting-IP': '10.77.3.9' } });
  await page.close();
}
console.log(ok ? 'ALL OK' : 'SOME FAILED');
await browser.close();
process.exit(ok ? 0 : 1);
