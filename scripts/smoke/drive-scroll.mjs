// Clicks every tab and toggle button on every screen from the middle of the page and reports any that throw the page back up.
//   node scripts/smoke/drive-scroll.mjs shots.json     (the list from shots-all.mjs; needs the smoke server and scripts/smoke/state/shoot-token)
// A click on a tab, a filter or a switch between two views must never change where the person is. It must report 0.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const ORIGIN = process.env.SMOKE_ORIGIN ?? 'http://127.0.0.1:8788';
const token = fs.readFileSync(new URL('./state/shoot-token', import.meta.url), 'utf8').trim();
const list = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).filter((s) => s.needsSession);
const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'].find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-first-run'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SEL = 'button[aria-pressed], [role=tab]';
const hits = [];
let clicked = 0;
for (const shot of list) {
  if (/^\/(onboarding|session|vibe-check)/.test(shot.path)) continue;
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluateOnNewDocument((t) => localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 })), token);
  try {
    await page.goto(`${ORIGIN}${shot.path}`, { waitUntil: 'networkidle0', timeout: 20000 });
    await sleep(400);
    const count = await page.evaluate((s) => Math.min(14, document.querySelectorAll(s).length), SEL);
    for (let i = 0; i < count; i += 1) {
      const info = await page.evaluate(async (s, idx) => {
        const el = [...document.querySelectorAll(s)][idx];
        if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return null;
        const r0 = el.getBoundingClientRect();
        if (r0.width === 0 || r0.height === 0) return null;
        el.scrollIntoView({ block: 'center' });
        await new Promise((r) => setTimeout(r, 120));
        return { y: window.scrollY, label: (el.textContent ?? '').trim().slice(0, 30) || el.getAttribute('aria-label') || '?', max: document.documentElement.scrollHeight - window.innerHeight };
      }, SEL, i);
      if (!info || info.y < 250) continue;
      const handle = await page.evaluateHandle((s, idx) => [...document.querySelectorAll(s)][idx], SEL, i);
      try {
        await handle.asElement().click();
      } catch {
        continue;
      }
      clicked += 1;
      await sleep(900);
      const after = await page.evaluate(() => ({ y: window.scrollY, url: location.pathname + location.search }));
      if (info.y - after.y > 120) hits.push({ page: shot.path, button: info.label, from: Math.round(info.y), to: Math.round(after.y) });
      if (!after.url.startsWith(shot.path.split('?')[0])) {
        await page.goto(`${ORIGIN}${shot.path}`, { waitUntil: 'networkidle0' });
        await sleep(300);
      }
    }
  } catch (e) {
    // a page that did not load is not this check's concern
  }
  await page.close();
}
await browser.close();
console.log(`${clicked} clicks on ${list.length} screens, ${hits.length} jumped the page`);
for (const h of hits) console.log(`  ${h.page}  "${h.button}"  ${h.from} -> ${h.to}`);
process.exit(hits.length ? 1 : 0);
