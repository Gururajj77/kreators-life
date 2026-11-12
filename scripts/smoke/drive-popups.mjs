// Every kind of popup, opened in Chrome: its rail of round buttons sits outside the panel, on the screen, and stays put however far the
// panel scrolls; Tab stays inside, Escape closes the top one and focus goes home. Needs the smoke server on 8788 with the latest build and a
// prepared account (SHOOT_TOKEN).
//
//   SHOOT_TOKEN=<token> SHOOT_OUT=<folder> node scripts/smoke/drive-popups.mjs
//   POPUP_SIZES=390x844,768x1024   POPUP_THEMES=light   POPUP_CASES=week-plan,sign-out
//   POPUP_MOTION=1 keeps the animations on.
//   POPUP_PROBE=scripts/smoke/spacing-probe.js POPUP_HITS=<file>   run a probe inside each open popup and write its hits.
//   POPUP_BEFORE=1 records the panel's box only (for a build from before the rail), with no rail checks.
//
// Prints one line per popup and size, then a summary. Writes results.json into SHOOT_OUT.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { CASES, MODAL, openCase } from './popupCases.mjs';

const ORIGIN = process.env.SHOOT_ORIGIN ?? 'http://127.0.0.1:8788';
const OUT = process.env.SHOOT_OUT ?? new URL('./shots/popups', import.meta.url).pathname;
const TOKEN = process.env.SHOOT_TOKEN;
if (!TOKEN) throw new Error('set SHOOT_TOKEN');
const BEFORE = process.env.POPUP_BEFORE === '1';
fs.mkdirSync(OUT, { recursive: true });
const SIZES = (process.env.POPUP_SIZES ?? '390x844,768x1024,1024x768,1280x800').split(',').map((s) => s.split('x').map(Number));
const THEMES = (process.env.POPUP_THEMES ?? 'light,dark').split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


const measure = (frameSel, closeLabel) => {
  // Runs in the page: the top popup's parts and what they measure.
  const dialogs = [...document.querySelectorAll(frameSel)];
  const dialog = dialogs[dialogs.length - 1];
  if (!dialog) return null;
  const rail = dialog.querySelector('.dialog-rail');
  const panel = dialog.querySelector('.dialog-panel') ?? (rail ? rail.nextElementSibling : dialog);
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x * 2) / 2, y: Math.round(r.y * 2) / 2, w: Math.round(r.width * 2) / 2, h: Math.round(r.height * 2) / 2 };
  };
  const cs = getComputedStyle(panel);
  const out = {
    title: dialog.querySelector('h2')?.textContent ?? '',
    panel: box(panel),
    look: { fill: cs.backgroundColor, radius: `${cs.borderTopLeftRadius} ${cs.borderBottomLeftRadius}`, pad: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`, blur: cs.backdropFilter, shadow: cs.boxShadow, overflow: cs.overflowY },
    scrolls: panel.scrollHeight > panel.clientHeight + 1,
    pageWide: document.documentElement.scrollWidth > window.innerWidth,
    problems: [],
  };
  if (!rail) return out;
  const buttons = [...rail.querySelectorAll('button, a')].filter((b) => b.getClientRects().length > 0);
  out.rail = buttons.map((b) => ({ label: b.getAttribute('aria-label') ?? b.textContent, ...box(b) }));
  const P = panel.getBoundingClientRect();
  buttons.forEach((b) => {
    const r = b.getBoundingClientRect();
    const name = b.getAttribute('aria-label') ?? b.textContent;
    if (r.width < 44 || r.height < 44) out.problems.push(`${name} is ${r.width}x${r.height}`);
    if (r.left < 0 || r.top < 0 || r.right > window.innerWidth || r.bottom > window.innerHeight) out.problems.push(`${name} is off the screen`);
    if (r.left < P.right && r.right > P.left && r.top < P.bottom && r.bottom > P.top) out.problems.push(`${name} sits over the panel`);
    if (panel.contains(b)) out.problems.push(`${name} is inside the panel`);
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!at || (at !== b && !b.contains(at))) out.problems.push(`${name} is covered by ${at?.tagName}.${at?.className}`);
  });
  const close = buttons.find((b) => b.getAttribute('aria-label') === closeLabel);
  if (!close) out.problems.push(`no ${closeLabel} in the rail`);
  if (buttons[0] !== close) out.problems.push('Close is not first');
  if (panel.querySelector(`button[aria-label="${closeLabel}"]`)) out.problems.push('a Close stays inside the panel');
  return out;
};

const browser = await puppeteer.launch({ executablePath: process.env.SHOOT_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run', '--disable-gpu'] });
const results = [];
let bad = 0;
let missed = 0;
const only = process.env.POPUP_CASES?.split(',');
const TARGET = fs.readFileSync(new URL('./target-probe.js', import.meta.url), 'utf8');
const OVERFLOW = fs.readFileSync(new URL('./overflow-probe.js', import.meta.url), 'utf8');
// POPUP_PROBE=scripts/smoke/spacing-probe.js runs a probe inside each open popup; POPUP_HITS=<file> writes its hits as JSON.
const PROBE = process.env.POPUP_PROBE ? fs.readFileSync(process.env.POPUP_PROBE, 'utf8') : null;
const probeHits = [];
if (!BEFORE && (!only || only.includes('nested-confirm'))) {
  // Something to remove from the day's sheet. A row of the test account's own, on its own server.
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  await fetch(`${ORIGIN}/api/fitness/move`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, 'CF-Connecting-IP': '10.93.7.7' }, body: JSON.stringify({ minutes: 20, kind: 'walk', date: day }), signal: AbortSignal.timeout(8000) }).catch(() => {});
}
try {
  for (const [width, height] of SIZES) {
    for (const theme of THEMES) {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': `10.93.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
      const phone = width < 768;
      await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: theme },
        { name: 'prefers-reduced-motion', value: process.env.POPUP_MOTION === '1' ? 'no-preference' : 'reduce' },
      ]);
      await page.evaluateOnNewDocument(
        (t, mode) => {
          localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 }));
          localStorage.setItem('kreators.theme', JSON.stringify({ state: { mode }, version: 0 }));
        },
        TOKEN,
        theme,
      );
      for (const c of CASES) {
        if (only && !only.includes(c.key)) continue;
        if ((c.min && width < c.min) || (c.max && width > c.max)) continue;
        if (BEFORE && (c.frame || c.nested)) continue;
        const tag = `${c.key} ${width}x${height} ${theme}`;
        const frame = c.frame ?? MODAL;
        const closeLabel = c.close ?? 'Close';
        try {
          const { opened, openerName } = await openCase(page, c, ORIGIN);
          const atTop = opened ? await page.evaluate(measure, frame, closeLabel) : null;
          if (!atTop) {
            if (!c.optional) missed += 1;
            console.log(`${c.optional ? 'skip' : 'MISS'} ${tag}`);
            continue;
          }
          await page.screenshot({ path: path.join(OUT, `${c.key}-${width}x${height}-${theme}.png`) });
          const row = { key: c.key, width, height, theme, ...atTop };
          if (!BEFORE) {
            // To the foot of a long one: the rail has not moved a pixel.
            const before = JSON.stringify(atTop.rail ?? []);
            await page.evaluate((f) => {
              const d = [...document.querySelectorAll(f)].pop();
              const rail = d?.querySelector('.dialog-rail');
              const scroller = d?.querySelector('.dialog-panel') ?? rail?.nextElementSibling?.querySelector('[aria-live]');
              if (scroller) scroller.scrollTop = scroller.scrollHeight;
            }, frame);
            await sleep(150);
            const atFoot = await page.evaluate(measure, frame, closeLabel);
            if (JSON.stringify(atFoot?.rail ?? []) !== before) row.problems.push('the rail moved when the panel scrolled');
            if (atTop.scrolls) await page.screenshot({ path: path.join(OUT, `${c.key}-${width}x${height}-${theme}-foot.png`) });
            if (!atTop.rail) row.problems.push('no rail');
            if (c.rails && (atTop.rail?.length ?? 0) < c.rails) row.problems.push(`rail has ${atTop.rail?.length ?? 0} buttons, wanted ${c.rails}`);
            for (const p of atFoot?.problems ?? []) if (!row.problems.includes(p)) row.problems.push(p);
            if (PROBE) {
              // POPUP_PROBE: run that probe inside the open popup only (it reads data-spacing-root), from its top.
              const hits = await page.evaluate(
                (f, src) => {
                  const d = [...document.querySelectorAll(f)].pop();
                  const root = d?.querySelector('.dialog-panel') ?? d;
                  if (!root) return [];
                  root.scrollTop = 0;
                  root.setAttribute('data-spacing-root', '');
                  try {
                    return (0, eval)(src) ?? [];
                  } finally {
                    root.removeAttribute('data-spacing-root');
                  }
                },
                frame,
                PROBE,
              );
              for (const h of hits) probeHits.push({ shot: `popup:${c.key} ${width}x${height} ${theme}`, path: c.path, ...h });
              row.probe = hits.length;
            }
            const over = (await page.evaluate(OVERFLOW)) ?? [];
            const target = ((await page.evaluate(TARGET)) ?? []).filter((h) => /dialog|rail|panel|sheet/.test(JSON.stringify(h)));
            row.overflow = over.length;
            row.targets = target.length;
            if (atTop.pageWide) row.problems.push('the page scrolls sideways');
            if (over.length) row.problems.push(`overflow probe: ${JSON.stringify(over[0]).slice(0, 140)}`);
            if (target.length) row.problems.push(`target probe: ${JSON.stringify(target[0]).slice(0, 140)}`);
            // The empty part of the frame above a phone's panel lets a tap through to the scrim.
            if (!c.frame && !c.nested && atTop.rail && atTop.rail[0].y + 44 <= atTop.panel.y) {
              const under = await page.evaluate((x, y) => document.elementFromPoint(x, y)?.className?.toString() ?? '', 24, atTop.panel.y - 20);
              if (!under.includes('sheet-scrim')) row.problems.push(`beside the rail a tap lands on ${under.slice(0, 40)}`);
            }
            // A modal one keeps Tab inside, and Shift+Tab from the first control wraps to the last.
            if (!c.frame) {
              let strayed = 0;
              for (let i = 0; i < 12; i += 1) {
                await page.keyboard.press('Tab');
                if (!(await page.evaluate((f) => [...document.querySelectorAll(f)].pop()?.contains(document.activeElement) ?? false, frame))) strayed += 1;
              }
              if (strayed) row.problems.push(`Tab left the dialog ${strayed} times`);
            }
            if (c.nested) {
              // Over a sheet: the top one's scrim covers the rail of the one under it, and Escape closes only the top one.
              const dims = await page.evaluate((m) => {
                const list = [...document.querySelectorAll(m)];
                if (list.length < 2) return { two: false };
                const under = list[0].querySelector('.dialog-rail button');
                const r = under.getBoundingClientRect();
                const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                return { two: true, open: list.length, covered: at !== under && !under.contains(at) };
              }, MODAL);
              if (!dims.two) row.problems.push('the second sheet did not open');
              else if (!dims.covered && dims.open > 1) {
                // The top sheet's own rail may sit right on top of it, which covers it just as well.
                row.problems.push('the rail under the top sheet can still be tapped');
              }
              await page.keyboard.press('Escape');
              await sleep(900);
              const left = await page.evaluate((m) => document.querySelectorAll(m).length, MODAL);
              if (left !== 1) row.problems.push(`Escape left ${left} sheets, wanted the one under it`);
            }
            // Escape closes it, and focus goes home to what opened it.
            await page.keyboard.press('Escape');
            await sleep(900);
            const home = await page.evaluate(
              (f, t) => ({
                open: t ? [...document.querySelectorAll(`${f} h2`)].some((h) => h.textContent === t) : Boolean(document.querySelector(f)),
                at: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim() || '',
              }),
              frame,
              c.frame ? '' : atTop.title,
            );
            if (home.open) row.problems.push('Escape did not close it');
            else if (!c.nested && home.at !== openerName) row.problems.push(`focus went to "${home.at.slice(0, 40)}", not "${openerName.slice(0, 40)}"`);
          }
          results.push(row);
          if (row.problems.length) bad += 1;
          console.log(`${row.problems.length ? 'FAIL' : 'ok  '} ${tag} panel ${row.panel.w}x${row.panel.h} at ${row.panel.x},${row.panel.y} rail ${row.rail?.length ?? '-'} ${row.problems.join('; ')}`);
        } catch (e) {
          missed += 1;
          console.log(`ERR  ${tag} ${String(e.message).slice(0, 160)}`);
        }
      }
      await page.close();
    }
  }
  // The grab bar, on a phone upright and on its side: a short drag carries the rail with the panel and springs back, a long one lets the sheet go.
  if (!BEFORE && !only) {
    for (const [width, height] of [[390, 844], [844, 390]]) {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': `10.93.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.evaluateOnNewDocument((t) => localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 })), TOKEN);
      await page.goto(`${ORIGIN}/finance`, { waitUntil: 'networkidle2', timeout: 25000 });
      await sleep(400);
      await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Owed')?.click());
      await sleep(900);
      const parts = () =>
        page.evaluate((m) => {
          const d = document.querySelector(m);
          if (!d) return null;
          const c = d.querySelector('.dialog-rail button').getBoundingClientRect();
          const p = d.querySelector('.dialog-panel').getBoundingClientRect();
          const g = d.querySelector('.fx-grab').getBoundingClientRect();
          return { close: c.top, panel: p.top, grabX: g.left + g.width / 2, grabY: g.top + g.height / 2 };
        }, MODAL);
      const at = await parts();
      await page.mouse.move(at.grabX, at.grabY);
      await page.mouse.down();
      for (let i = 1; i <= 6; i += 1) {
        await page.mouse.move(at.grabX, at.grabY + i * 12);
        await sleep(30);
      }
      const held = await parts();
      await page.mouse.up();
      await sleep(900);
      const back = await parts();
      const moved = held.panel - at.panel;
      const together = Math.abs(held.close - at.close - moved) < 1;
      const home = Math.abs(back.panel - at.panel) < 1 && Math.abs(back.close - at.close) < 1;
      await page.mouse.move(back.grabX, back.grabY);
      await page.mouse.down();
      for (let i = 1; i <= 12; i += 1) {
        await page.mouse.move(back.grabX, back.grabY + i * 22);
        await sleep(30);
      }
      await page.mouse.up();
      await sleep(1100);
      const gone = (await parts()) === null;
      const ok = moved > 20 && together && home && gone;
      if (!ok) bad += 1;
      console.log(`${ok ? 'ok  ' : 'FAIL'} drag ${width}x${height}: moved ${Math.round(moved)}px, rail with it ${together}, sprang back ${home}, long drag closed it ${gone}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
if (PROBE) {
  console.log(`\n${path.basename(process.env.POPUP_PROBE)} inside the popups: ${probeHits.length} hit${probeHits.length === 1 ? '' : 's'}`);
  for (const h of probeHits) console.log(`  ${h.shot}  ${h.line}`);
  if (process.env.POPUP_HITS) fs.writeFileSync(process.env.POPUP_HITS, JSON.stringify(probeHits, null, 1));
}
console.log(`\n${results.length} popups drawn, ${bad} with a problem, ${missed} not reached`);
process.exit(bad || missed ? 1 : 0);
