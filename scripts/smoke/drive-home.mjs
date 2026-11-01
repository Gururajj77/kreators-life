// Home on a laptop: the two halves of each row are one height, their cards start together, and the cards inside a half (the reads under
// Knowledge, the rows under Trackers) are one height where they share a row. Needs the smoke server and scripts/smoke/state/shoot-token.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const ORIGIN = process.env.SMOKE_ORIGIN ?? 'http://127.0.0.1:8788';
const token = fs.readFileSync(new URL('./state/shoot-token', import.meta.url), 'utf8').trim();
const browser = await puppeteer.launch({ executablePath: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'].find((p) => fs.existsSync(p)), headless: true, args: ['--no-first-run'] });
let bad = 0;
for (const [w, h] of [[1280, 900], [1600, 1000], [1100, 800]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  await page.evaluateOnNewDocument((t) => localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 })), token);
  await page.goto(`${ORIGIN}/home`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));
  const problems = await page.evaluate(() => {
    const out = [];
    const secs = [...document.querySelectorAll('main > section')].filter((s) => !s.classList.contains('span-all') && s.getBoundingClientRect().width < 700);
    const rows = new Map();
    for (const s of secs) { const top = Math.round(s.getBoundingClientRect().top + scrollY); rows.set(top, [...(rows.get(top) ?? []), s]); }
    for (const [, pair] of rows) {
      const names = pair.map((s) => s.getAttribute('aria-labelledby'));
      if (pair.length === 2) {
        const [a, b] = pair.map((s) => s.getBoundingClientRect());
        if (Math.abs(a.height - b.height) > 1) out.push(`${names} heights ${Math.round(a.height)} vs ${Math.round(b.height)}`);
        const [ca, cb] = pair.map((s) => s.lastElementChild.firstElementChild.getBoundingClientRect());
        if (Math.abs(ca.top - cb.top) > 1) out.push(`${names} cards start ${Math.round(ca.top)} vs ${Math.round(cb.top)}`);
        if (Math.abs(ca.bottom - cb.bottom) > 1 && !pair.some((s) => s.lastElementChild.firstElementChild.matches('ul'))) out.push(`${names} cards end ${Math.round(ca.bottom)} vs ${Math.round(cb.bottom)}`);
      }
      for (const s of pair) {
        const ul = s.lastElementChild.firstElementChild;
        if (!ul.matches('ul')) continue;
        const cards = [...ul.querySelectorAll(':scope > li > :first-child')].map((c) => c.getBoundingClientRect());
        const byTop = new Map();
        for (const c of cards) byTop.set(Math.round(c.top), [...(byTop.get(Math.round(c.top)) ?? []), c]);
        for (const [, g] of byTop) if (g.length > 1 && Math.max(...g.map((c) => c.height)) - Math.min(...g.map((c) => c.height)) > 1) out.push(`${s.getAttribute('aria-labelledby')}: cards in one row are ${g.map((c) => Math.round(c.height)).join(' and ')} tall`);
        // the cards fill the half: the last row ends where the section does
        if (cards.length && Math.abs(Math.max(...cards.map((c) => c.bottom)) - ul.getBoundingClientRect().bottom) > 1) out.push(`${s.getAttribute('aria-labelledby')}: the cards stop short of the bottom of the half`);
      }
    }
    // The Daily card's two buttons are one height and sit at the foot of the card, whatever height the row gives it.
    const open = document.querySelector('a[aria-label="Open Today"]');
    if (open) {
      const main = open.previousElementSibling.getBoundingClientRect();
      const arrow = open.getBoundingClientRect();
      if (Math.abs(main.height - arrow.height) > 1 || Math.abs(main.bottom - arrow.bottom) > 1) out.push(`Daily buttons are ${Math.round(main.height)} and ${Math.round(arrow.height)} tall, ending ${Math.round(main.bottom)} and ${Math.round(arrow.bottom)}`);
      const card = open.closest('.rounded-card').getBoundingClientRect();
      const gap = card.bottom - arrow.bottom;
      if (gap < 8 || gap > 20) out.push(`Daily buttons sit ${Math.round(gap)}px above the foot of their card`);
    }
    return out;
  });
  console.log(`${w}px:`, problems.length ? problems : 'every pair is one height, cards start together and fill their half');
  bad += problems.length;
  await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
