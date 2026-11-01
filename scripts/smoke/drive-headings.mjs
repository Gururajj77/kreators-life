// For every section heading that has an action link or button, how far the action's text is from the middle of the title. Must be small.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const ORIGIN = 'http://127.0.0.1:8788';
const token = fs.readFileSync(new URL('./state/shoot-token', import.meta.url), 'utf8').trim();
const list = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).filter((s) => s.needsSession);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run'] });
let n = 0; const bad = [];
for (const [w, h] of [[1280, 900], [390, 844]]) {
  for (const shot of list) {
    if (/^\/(onboarding|session|vibe-check)/.test(shot.path)) continue;
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    await page.evaluateOnNewDocument((t) => localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 })), token);
    try {
      await page.goto(`${ORIGIN}${shot.path}`, { waitUntil: 'networkidle0', timeout: 20000 });
      const r = await page.evaluate(() => [...document.querySelectorAll('main section > div.flex.items-start.justify-between')].map((row) => {
        const h2 = row.querySelector('h2'); const act = row.children[1]; if (!h2 || !act) return null;
        const inner = act.querySelector('a,button'); if (!inner) return null;
        const tr = h2.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(inner); const lr = range.getBoundingClientRect();
        return { title: h2.textContent.trim().slice(0, 24), titleMid: Math.round((tr.top + tr.bottom) / 2), actionMid: Math.round((lr.top + lr.bottom) / 2) };
      }).filter(Boolean));
      for (const x of r) { n += 1; if (Math.abs(x.titleMid - x.actionMid) > 4) bad.push(`${w}px ${shot.path} "${x.title}" title ${x.titleMid} vs action ${x.actionMid}`); }
    } catch {}
    await page.close();
  }
}
await browser.close();
console.log(`${n} headings with an action, ${bad.length} not level with their title`);
bad.slice(0, 12).forEach((b) => console.log('  ', b));
