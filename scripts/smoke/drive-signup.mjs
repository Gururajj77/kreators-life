// Drives the real sign-up form in Chrome against the smoke server (the built app on 8788), then prints every URL
// it passed through and the heading it landed on. A new account must end on /onboarding, the setup chat.
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
if (process.env.DRIVE_MOTION !== '1') await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
// Like the smoke checks: an address of its own per run, so repeated drives never trip the sign-up limit.
await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': `10.4.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
const urls = [];
page.on('framenavigated', (f) => { if (f === page.mainFrame()) urls.push(f.url()); });
const stamp = Date.now().toString(36);
await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle0' });
await page.evaluate(async () => { const regs = await navigator.serviceWorker?.getRegistrations?.(); for (const r of regs ?? []) await r.unregister(); });
if (process.env.DRIVE_START === 'welcome') {
  // The front door: Start free on the site, the device session from Welcome, the account made inside the chat.
  await page.goto(`${ORIGIN}/start`, { waitUntil: 'networkidle0' });
  await page.evaluate(async () => { const b = [...document.querySelectorAll('button')].find((x) => /short chat|setting up/.test(x.textContent)); b?.click(); });
  await new Promise((r) => setTimeout(r, 3000));
  console.log('landed on', page.url());
  // The account comes in two small cards in the conversation: how you sign in, then phone and birthday.
  const card = (fields, button) => page.evaluate(async (fields, button) => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (let i = 0; i < 100 && !document.querySelector(`[data-answer] input[autocomplete="${fields[0][0]}"]`); i++) await s(100);
    let n = 0;
    for (const [ac, v] of fields) for (const el of document.querySelectorAll(`[data-answer] input[autocomplete="${ac}"]`)) { set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); n += 1; }
    await s(200);
    const b = [...document.querySelectorAll('[data-answer] button')].find((x) => x.textContent.includes(button));
    if (b && !b.disabled) { b.click(); return `sent (${n} fields)`; }
    return `not sent: button ${b ? (b.disabled ? 'disabled' : 'found') : 'missing'}`;
  }, fields, button);
  console.log('sign-in card', await card([['nickname', 'Driven'], ['email', `driven-${stamp}@smoke.test`], ['new-password', `Camera-${stamp}-pass`]], 'Next'));
  await new Promise((r) => setTimeout(r, 1500));
  console.log('private card', await card([['tel', '+91 98765 43210'], ['bday', '1990-05-20']], 'Make my account'));
  await new Promise((r) => setTimeout(r, 3000));
} else {
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
}
await page.screenshot({ path: path.join(OUT, '2-after-submit.png'), fullPage: false });
console.log('landed on', page.url());
console.log('visited', urls.join(' -> '));
const h1 = await page.$eval('h1', (el) => el.textContent).catch(() => '(no h1)');
console.log('h1', h1);
// DRIVE_TAPS: chip labels to tap in turn after landing, waiting for each to appear (motion on makes the hosts type at speed).
for (const t of (process.env.DRIVE_TAPS ?? '').split(',').map((x) => x.trim()).filter(Boolean)) {
  // "type:<text>" types into the chat's typing box and sends it; "first" taps the first choice under the question; anything else taps the button whose text starts with it (or, for a choice with an emoji, holds it).
  const ok = await page.evaluate(async (label) => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (let i = 0; i < 300; i++) {
      if (label.startsWith('fill:')) {
        // "fill:<option>" sets every empty select in the card under the question to the option whose text starts with it (else its first real option), then sends the card.
        const selects = [...document.querySelectorAll('main [data-answer] select')];
        if (selects.length) {
          const want = label.slice(5);
          for (const sel of selects) {
            if (sel.value !== '') continue;
            const opt = [...sel.options].find((o) => o.value !== '' && o.textContent.trim().startsWith(want)) ?? [...sel.options].find((o) => o.value !== '');
            if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
          }
          await s(200);
          const btns = [...document.querySelectorAll('main [data-answer] button')].filter((x) => !/Change my last answer|Tell me more|Add/.test(x.textContent) && !x.disabled);
          const send = btns.at(-1);
          if (send) { send.click(); await s(300); return true; }
        }
      } else if (label.startsWith('type:')) {
        const el = document.querySelector('[data-composer] textarea');
        if (el && !el.disabled) {
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, label.slice(5));
          el.dispatchEvent(new Event('input', { bubbles: true }));
          await s(100);
          const send = document.querySelector('[data-composer] button[type="submit"]');
          if (send && !send.disabled) { send.click(); await s(300); return true; }
        }
      } else if (label === 'first') {
        const b = [...document.querySelectorAll('main [data-answer] button')].find((x) => !/Change my last answer|Tell me more/.test(x.textContent) && !x.disabled);
        if (b) { b.click(); await s(300); return true; }
      } else {
        // A pill or chip by its first words; a card, whose text starts with its emoji, by any words in it.
        const all = [...document.querySelectorAll('button')].filter((x) => !x.disabled);
        const b = all.find((x) => x.textContent.trim().startsWith(label)) ?? all.find((x) => x.closest('main') && x.textContent.includes(label));
        if (b) { b.click(); await s(300); return true; }
      }
      await s(100);
    }
    return false;
  }, t);
  console.log('tap', t, ok ? 'ok' : 'NOT FOUND');
}
if (process.env.DRIVE_TAPS) await new Promise((r) => setTimeout(r, 2500));
const scroll = await page.evaluate(() => {
  // The chat's layout: a slim header, the turns, and the typing box at the bottom. The newest turn sits under the
  // header, and neither the header nor the typing box covers the question or its choices.
  const head = document.querySelector('header')?.getBoundingClientRect();
  const foot = document.querySelector('footer')?.getBoundingClientRect();
  const turn = [...document.querySelectorAll('[data-turn]')].at(-1)?.getBoundingClientRect();
  const answer = document.querySelector('[data-answer]')?.getBoundingClientRect();
  // No inner scroll: nothing inside main may scroll on its own, apart from a select or a textarea.
  const innerScroll = [...document.querySelectorAll('main *')].some((e) => { const cs = getComputedStyle(e); return /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2 && e.tagName !== 'SELECT' && e.tagName !== 'TEXTAREA'; });
  return { scrollY: Math.round(window.scrollY), headerBottom: head ? Math.round(head.bottom) : null, turnTop: turn ? Math.round(turn.top) : null, answerTop: answer ? Math.round(answer.top) : null, answerBottom: answer ? Math.round(answer.bottom) : null, typingBoxTop: foot ? Math.round(foot.top) : null, answerUnderHeader: answer && head ? answer.top < head.bottom : null, innerScroll };
});
console.log('scroll', JSON.stringify(scroll));
await page.screenshot({ path: path.join(OUT, '3-after-taps.png'), fullPage: false });
const chat = await page.evaluate(() => ({ messages: document.querySelectorAll('[data-msg]').length, lastLine: [...document.querySelectorAll('[data-msg] p')].at(-1)?.textContent ?? '', chips: [...document.querySelectorAll('main button')].map((b) => b.textContent.trim()).filter(Boolean) }));
console.log('chat', JSON.stringify(chat));
await browser.close();
