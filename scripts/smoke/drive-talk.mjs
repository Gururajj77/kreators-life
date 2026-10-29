// Opens the assistant on a screen and drives it in Chrome against the smoke server with the screenshot account (shots-all.mjs).
//   TALK_FROM=today TALK_TAPS='Check in for today|I showed up today' node scripts/smoke/drive-talk.mjs
// Each tap is a button's text (start of it), or fill:<field placeholder>=<value>, or submit (the card's button), or type:<text> (the typing box).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
const ORIGIN = process.env.SHOOT_ORIGIN ?? 'http://127.0.0.1:8788';
const OUT = process.env.SHOOT_OUT ?? path.join(path.dirname(new URL(import.meta.url).pathname), 'shots');
const TOKEN = process.env.SHOOT_TOKEN ?? fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'state', 'shoot-token'), 'utf8').trim();
fs.mkdirSync(OUT, { recursive: true });
const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'].find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
const wide = process.env.TALK_WIDE === '1';
await page.setViewport(wide ? { width: 1280, height: 800 } : { width: 390, height: 844, isMobile: true, hasTouch: true });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
page.on('pageerror', (e) => console.log('page error', e.message));
await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle0' });
await page.evaluate(async (t) => { const regs = await navigator.serviceWorker?.getRegistrations?.(); for (const r of regs ?? []) await r.unregister(); localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 })); }, TOKEN);
const from = process.env.TALK_FROM ?? 'today';
const PATH = { home: '/home', today: '/today', tower: '/tower', reviews: '/reviews', finance: '/finance' }[from];
await page.goto(`${ORIGIN}${PATH}`, { waitUntil: 'networkidle0' });
const s = (ms) => new Promise((r) => setTimeout(r, ms));
await page.click('button[aria-label="Open the assistant"]');
await s(1200);
console.log('url stays', page.url());
const lastBot = () => page.evaluate(() => [...document.querySelectorAll('section[aria-label^="Bumling AI assistant"] [data-msg]')].slice(-3).map((x) => x.textContent.trim().slice(0, 160)).join(' || '));
console.log('opened:', await lastBot());
for (const tap of (process.env.TALK_TAPS ?? '').split('|').filter(Boolean)) {
  const r = await page.evaluate(async (tap) => {
    const set = (el, v) => { const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); };
    for (let i = 0; i < 60; i++) {
      if (tap.startsWith('type:')) {
        const box = document.querySelector('section[aria-label^="Bumling AI assistant"] [data-composer] textarea');
        if (box) { set(box, tap.slice(5)); box.closest('form').requestSubmit(); return `typed ${tap.slice(5)}`; }
      } else if (tap.startsWith('fill:')) {
        const [ph, v] = tap.slice(5).split('=');
        const el = [...document.querySelectorAll('[data-form] input, [data-form] textarea')].find((x) => x.placeholder === ph || x.closest('label')?.textContent.startsWith(ph));
        if (el) { set(el, v); return `filled ${ph}`; }
      } else if (tap === 'submit') {
        const b = document.querySelector('[data-form] button[type="submit"]');
        if (b && !b.disabled) { b.click(); return 'submitted'; }
      } else {
        const b = [...document.querySelectorAll('section[aria-label^="Bumling AI assistant"] button')].find((x) => x.textContent.trim().replace(/^\S+\s/, (m) => (/\p{Extended_Pictographic}/u.test(m) ? '' : m)).startsWith(tap) || x.textContent.trim().startsWith(tap));
        if (b && !b.disabled) { b.click(); return `tapped ${tap}`; }
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return `MISSING ${tap}`;
  }, tap);
  await s(900);
  console.log(r, '->', await lastBot());
}
const box = await page.evaluate(() => { const el = document.querySelector('section[aria-label^="Bumling AI assistant"]'); if (!el) return 'closed'; window.scrollBy(0, 600); const r = el.getBoundingClientRect(); const bar = document.querySelector('nav[aria-label="Main"]')?.getBoundingClientRect(); return `panel ${Math.round(r.height)}px of ${window.innerHeight}px, top ${Math.round(r.top)}px, bottom ${Math.round(r.bottom)}px, tab bar top ${bar ? Math.round(bar.top) : 'none'}px, after scrolling the page`; });
console.log(box);
const m = await page.evaluate(() => ({ docScroll: document.documentElement.scrollWidth > window.innerWidth, inner: [...document.querySelectorAll('main *')].filter((el) => !el.closest('section[aria-label^="Bumling AI assistant"]')).some((el) => { const cs = getComputedStyle(el); return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2; }) }));
console.log('sideways scroll', m.docScroll, 'inner scroll', m.inner);
await page.screenshot({ path: path.join(OUT, `talk-${from}${wide ? '-wide' : ''}.png`), fullPage: false });
await browser.close();
