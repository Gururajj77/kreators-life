// Drives the event attendee's way in, as a visitor, in Chrome against the smoke server (the built app on 8788): the public list of events, one
// event's page, the sign-up on that page, the landing on the event in the app, the bar that invites them to finish setting up, the gate (a path
// an attendee may not open goes to the setup chat), the event's three links, and the bar hidden for the day on a second tap. Prints what it
// saw and saves screenshots.
//   EVENT_FREE=<id> EVENT_PAID=<id> SHOOT_OUT=<dir> [DRIVE_WIDE=1] [DRIVE_THEME=dark] node scripts/smoke/drive-event.mjs
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = process.env.SHOOT_ORIGIN ?? 'http://127.0.0.1:8788';
const OUT = process.env.SHOOT_OUT ?? path.join(path.dirname(new URL(import.meta.url).pathname), 'shots');
const FREE = process.env.EVENT_FREE;
const PAID = process.env.EVENT_PAID;
if (!FREE) throw new Error('EVENT_FREE is the id of a free public event');
const wide = process.env.DRIVE_WIDE === '1';
const theme = process.env.DRIVE_THEME === 'dark' ? 'dark' : 'light';
const tag = `${wide ? '1280' : '390'}-${theme}`;
fs.mkdirSync(OUT, { recursive: true });
const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'].find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.setViewport(wide ? { width: 1280, height: 800, deviceScaleFactor: 1 } : { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: theme }]);
await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': `10.6.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name, full = false) => {
  await sleep(600);
  await page.screenshot({ path: path.join(OUT, `${name}-${tag}.png`), fullPage: full });
};
const report = (k, v) => console.log(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);

await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle0' });
await page.evaluate(async () => {
  const regs = await navigator.serviceWorker?.getRegistrations?.();
  for (const r of regs ?? []) await r.unregister();
  localStorage.clear();
});

// 1. The list, as a visitor.
await page.goto(`${ORIGIN}/events`, { waitUntil: 'networkidle0' });
await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find((x) => /Reject all/.test(x.textContent))?.click());
await sleep(800);
report('list heading', await page.$eval('h1', (h) => h.textContent));
report('cards', await page.$$eval('ul[data-tile-list] > li', (l) => l.length));
report('first card link', await page.$eval('ul[data-tile-list] > li a.listing-go', (a) => a.getAttribute('href')));
report('first card facts', await page.$eval('ul[data-tile-list] > li ul[aria-label="Facts"]', (u) => u.textContent));
await shot('list');

// 2. The event's page, as a visitor.
await page.goto(`${ORIGIN}/events/${FREE}`, { waitUntil: 'networkidle0' });
await sleep(600);
report('landing heading', await page.$eval('h1', (h) => h.textContent));
report('join heading', await page.$eval('#join-heading', (h) => h.textContent));
report('solid buttons', await page.$$eval('.btn-primary', (b) => b.filter((x) => x.offsetParent).map((x) => x.textContent.trim())));
await shot('landing');
await shot('landing-full', true);

// 3. Sign up on the page.
const stamp = Date.now().toString(36);
const typeInto = async (sel, value, nth = 0) => {
  const els = await page.$$(sel);
  const el = els[nth];
  if (!el) throw new Error(`no field ${sel}`);
  await el.click({ clickCount: 3 });
  await el.type(value);
};
await typeInto('input[autocomplete="nickname"]', 'Guest');
await typeInto('input[type="email"]', `guest-${stamp}@smoke.test`);
await typeInto('input[autocomplete="new-password"]', `Lantern-${stamp}-walk`, 0);
await typeInto('input[autocomplete="new-password"]', `Lantern-${stamp}-walk`, 1);
await typeInto('input[type="tel"]', '9876543210');
await page.$eval('input[type="date"]', (el) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '1994-03-12');
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.evaluate(() => {
  for (const b of document.querySelectorAll('form input[type="checkbox"]')) if (!b.checked) b.click();
});
await sleep(300);
report('join enabled', await page.$eval('form button[type="submit"]', (b) => !b.disabled));
await shot('landing-filled', true);
await page.click('form button[type="submit"]');
for (let i = 0; i < 60 && !page.url().includes('/party/'); i++) await sleep(200);
await sleep(1500);
report('landed on', new URL(page.url()).pathname + new URL(page.url()).hash);
report('status line', await page.evaluate(() => document.querySelector('[role="status"]')?.textContent ?? null));
report('bar', await page.evaluate(() => document.querySelector('section[aria-label="Finish setting up"]')?.textContent ?? null));
report('people links', await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="Meet the people"] a')].map((a) => a.getAttribute('href'))));
const box = (sel) => page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) } : null; }, sel);
report('bar box', await box('section[aria-label="Finish setting up"]'));
report('assistant box', await box('button[aria-label="Open the assistant"]'));
report('tab bar box', await box('nav[aria-label="Main"]'));
await shot('event-in-app');
await shot('event-in-app-full', true);

// 4. The gate: Community and Inbox open; Home sends them to the setup chat.
for (const p of ['/community', '/bond', '/inbox', '/you', '/help', '/home', '/today']) {
  await page.goto(`${ORIGIN}${p}`, { waitUntil: 'networkidle0' });
  await sleep(700);
  report(`open ${p}`, new URL(page.url()).pathname);
}
await page.goto(`${ORIGIN}/community`, { waitUntil: 'networkidle0' });
await sleep(800);
await shot('community-attendee');

// 5. Hide the bar for the day: the first tap asks, the second hides; it stays hidden after a reload.
await page.click('section[aria-label="Finish setting up"] button');
await sleep(300);
report('after one tap', await page.evaluate(() => document.querySelector('section[aria-label="Finish setting up"] p')?.textContent ?? null));
await shot('bar-armed');
await page.click('section[aria-label="Finish setting up"] button');
await sleep(300);
report('after two taps', await page.evaluate(() => Boolean(document.querySelector('section[aria-label="Finish setting up"]'))));
await page.reload({ waitUntil: 'networkidle0' });
await sleep(600);
report('after reload', await page.evaluate(() => Boolean(document.querySelector('section[aria-label="Finish setting up"]'))));

// 6. A paid event, signed in: Join lands on the ticket in the app, nothing taken.
if (PAID) {
  await page.goto(`${ORIGIN}/events/${PAID}`, { waitUntil: 'networkidle0' });
  await sleep(800);
  report('paid caption', await page.evaluate(() => document.querySelector('form p.text-center')?.textContent ?? null));
  await shot('paid-signed-in');
  await page.click('form button[type="submit"]');
  for (let i = 0; i < 40 && !page.url().includes('/party/'); i++) await sleep(200);
  await sleep(1200);
  report('paid landed on', new URL(page.url()).pathname + new URL(page.url()).hash);
  report('paid rsvp button', await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).find((t) => /RSVP for/.test(t)) ?? null));
  await shot('paid-in-app');
}

// 7. The setup chat keeps the account: no account card, and Close goes back to the event.
await page.goto(`${ORIGIN}/onboarding`, { waitUntil: 'networkidle0' });
await sleep(2500);
report('setup close', await page.evaluate(() => [...document.querySelectorAll('a')].find((a) => /Close/.test(a.textContent))?.getAttribute('href') ?? null));
report('setup asks for account', await page.evaluate(() => Boolean(document.querySelector('[data-answer] input[type="email"]'))));
await shot('setup-chat');
await browser.close();
