// Checks that the chats are kept while you move around the app (no reloads): the assistant opened on Daily, the
// strategy session and the setup chat. Uses the shots-all account.  node scripts/smoke/drive-keep.mjs
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
const ORIGIN = process.env.SHOOT_ORIGIN ?? 'http://127.0.0.1:8788';
const TOKEN = process.env.SHOOT_TOKEN ?? fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'state', 'shoot-token'), 'utf8').trim();
const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'].find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
if (process.env.DRIVE_MOTION !== '1') await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
page.on('pageerror', (e) => console.log('page error', e.message));
const s = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle0' });
await page.evaluate(async (t) => { for (const r of (await navigator.serviceWorker?.getRegistrations?.()) ?? []) await r.unregister(); localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 })); }, TOKEN);
const click = (sel, text) => page.evaluate((sel, text) => { const b = [...document.querySelectorAll(sel)].find((x) => x.textContent.includes(text)); b?.click(); return Boolean(b); }, sel, text);
const lines = (sel) => page.evaluate((sel) => [...document.querySelectorAll(`${sel} [data-msg]`)].map((x) => x.textContent.trim().slice(0, 50)), sel);
const QC = 'section[aria-label^="Bumling AI assistant"]';
// The assistant on Daily: open it, start a flow, leave for Home with it open, come back.
await page.goto(`${ORIGIN}/today`, { waitUntil: 'networkidle0' });
await page.click('button[aria-label="Open the assistant"]'); await s(900);
await click(`${QC} button`, 'Mark my not to do list'); await s(400);
const before = await lines(QC);
await click('nav a', 'Home'); await s(1200);
console.log('on', new URL(page.url()).pathname);
await click('nav a', 'Daily'); await s(1200);
const after = await lines(QC);
console.log('assistant kept:', before.length > 0 && JSON.stringify(before) === JSON.stringify(after), `${after.length} lines`, '| card still there:', await page.evaluate(() => Boolean(document.querySelector('[data-form]'))));
// Start over in the assistant: two taps, back to the menu.
await click(`${QC} button`, 'Start over'); await s(200); await click(`${QC} button`, 'Tap again'); await s(900);
console.log('after start over:', (await lines(QC)).length, 'lines');
// Close folds it into the button and keeps the chat; opening it again finds the same lines.
const kept = await lines(QC);
await click(`${QC} button`, 'Close'); await s(300);
console.log('closed, panel gone:', !(await page.$(QC)));
await page.click('button[aria-label="Open the assistant"]'); await s(600);
console.log('reopened with the same chat:', JSON.stringify(kept) === JSON.stringify(await lines(QC)));
// The session: Keep my map, leave with Back, come back with Forward.
await page.goto(`${ORIGIN}/session`, { waitUntil: 'networkidle0' }); await s(1500);
console.log('keep map tapped:', await click('button', 'Keep my map')); await s(2500);
const sBefore = await lines('main');
await click('a', 'Close'); await s(1200);
console.log('left to', new URL(page.url()).pathname);
await page.goBack(); await s(1500);
const sAfter = await lines('main');
console.log('session kept:', sBefore.length > 0 && JSON.stringify(sBefore) === JSON.stringify(sAfter), `${sAfter.length} lines`);
await click('button', 'Start over'); await s(200); await click('button', 'Tap again'); await s(1500);
console.log('session after start over:', (await lines('main')).length, 'lines, first:', (await lines('main'))[0]);
// The setup chat: start it, leave with Close, come back with Back, then Start over.
await page.goto(`${ORIGIN}/onboarding`, { waitUntil: 'networkidle0' }); await s(1500);
await click('main [data-answer] button', 'Yes, change my answers'); await s(1500);
console.log('setup started:', await click('main [data-answer] button', 'Learn a new skill')); await click('main [data-answer] button', 'Next'); await s(1500);
const uBefore = await lines('main');
await click('a', 'Close'); await s(1200);
console.log('left setup to', new URL(page.url()).pathname);
await page.goBack(); await s(1500);
const uAfter = await lines('main');
console.log('setup chat kept:', uBefore.length > 0 && JSON.stringify(uBefore) === JSON.stringify(uAfter), `${uAfter.length} lines`, '| choices still there:', await page.evaluate(() => Boolean(document.querySelector('[data-answer]'))));
await click('button', 'Start over'); await s(200); await click('button', 'Tap again'); await s(1500);
console.log('setup after start over:', (await lines('main')).length, 'lines, first:', (await lines('main'))[0]);
await browser.close();
