// Deals nine cards in focus mode, leaves focus mode, goes back in, and says how many cards sit outside the table each time. It must be 0.
// Needs the smoke server (blueprint.sh --keep) and a prepared account (shots-all.mjs writes scripts/smoke/state/shoot-token).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const ORIGIN = 'http://127.0.0.1:8788';
const token = fs.readFileSync(new URL('./state/shoot-token', import.meta.url), 'utf8').trim();
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-first-run'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [name, w, h] of [['laptop', 1280, 800], ['phone', 390, 844]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  await page.evaluateOnNewDocument((t) => localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 })), token);
  await page.goto(`${ORIGIN}/cards/shadowflow`, { waitUntil: 'networkidle0' });
  await sleep(500);
  const click = async (text) => { const hd = await page.evaluateHandle((x) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(x)), text); const el = hd.asElement(); if (!el) throw new Error(`no ${text}`); await el.click(); };
  await click('Focus mode'); await sleep(900);
  for (let i = 0; i < 9; i += 1) { await click('Draw a card'); await sleep(550); }
  await sleep(500);
  const report = async (label) => {
    const r = await page.evaluate(() => {
      const table = [...document.querySelectorAll('[class*="rounded"]')].find((e) => e.querySelector('[style*="perspective"]') && e.getBoundingClientRect().width > 200 && e.getBoundingClientRect().height > 200);
      const tr = table.getBoundingClientRect();
      const cards = [...table.querySelectorAll('[style*="perspective"]')].map((c) => c.getBoundingClientRect());
      const out = cards.filter((c) => c.right > tr.right + 1 || c.left < tr.left - 1 || c.bottom > tr.bottom + 1 || c.top < tr.top - 1);
      return { table: `${Math.round(tr.width)}x${Math.round(tr.height)}`, cards: cards.length, outside: out.length };
    });
    console.log(name, label, r);
  };
  await report('in focus mode');
  await page.keyboard.press('Escape'); await sleep(1200);
  await report('after leaving focus mode');
  await click('Focus mode'); await sleep(1200);
  await report('and back in');
  await page.close();
}
await browser.close();
