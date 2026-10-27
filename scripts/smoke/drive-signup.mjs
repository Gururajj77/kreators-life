// Drives the real sign-up form in Chrome against the smoke server (the built app on 8788), then prints every URL
// it passed through and the heading it landed on. A new account must end on /session, the strategy session.
//   node scripts/smoke/drive-signup.mjs            # SHOOT_OUT picks the folder for its two screenshots
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
const ORIGIN = process.env.SHOOT_ORIGIN ?? 'http://127.0.0.1:8788';
const OUT = process.env.SHOOT_OUT ?? path.join(path.dirname(new URL(import.meta.url).pathname), 'shots');
fs.mkdirSync(OUT, { recursive: true });
const candidates = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'];
const chrome = candidates.find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
const urls = [];
page.on('framenavigated', (f) => { if (f === page.mainFrame()) urls.push(f.url()); });
const stamp = Date.now().toString(36);
await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle0' });
await page.evaluate(async () => { const regs = await navigator.serviceWorker?.getRegistrations?.(); for (const r of regs ?? []) await r.unregister(); });
await page.goto(`${ORIGIN}/signup`, { waitUntil: 'networkidle0' });
const fields = await page.$$('input');
const kinds = [];
for (const f of fields) kinds.push(await f.evaluate((el) => `${el.type}:${el.autocomplete}`));
console.log('fields', kinds.join(' | '));
const typeInto = async (sel, value) => { const el = await page.$(sel); if (!el) throw new Error(`no field ${sel}`); await el.click({ clickCount: 3 }); await el.type(value); };
await typeInto('input[autocomplete="nickname"]', 'Driven');
await typeInto('input[type="email"]', `driven-${stamp}@smoke.test`);
const pws = await page.$$('input[autocomplete="new-password"]');
for (const p of pws) { await p.click({ clickCount: 3 }); await p.type(`Camera-${stamp}-pass`); }
await typeInto('input[type="tel"]', '+91 98765 43210');
await page.$eval('input[type="date"]', (el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '1990-05-20'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
await page.screenshot({ path: path.join(OUT, '1-form.png') });
const btn = await page.$('button[type="submit"]');
console.log('submit disabled?', await btn.evaluate((b) => b.disabled));
await btn.click();
await new Promise((r) => setTimeout(r, 4000));
await page.screenshot({ path: path.join(OUT, '2-after-submit.png'), fullPage: false });
console.log('landed on', page.url());
console.log('visited', urls.join(' -> '));
const h1 = await page.$eval('h1', (el) => el.textContent).catch(() => '(no h1)');
console.log('h1', h1);
await browser.close();
