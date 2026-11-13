// Every helper tooltip, shown in Chrome the way a person shows it, and checked against what is drawn around it (the founder, 2026-11-12:
// "all the helper tooltips should appear in places that have no pre-existing text, like outside the popups"). With a mouse at laptop sizes
// it points at each trigger; on a phone it walks the page with Tab. Each tip shown is measured on its own, not by the placement code:
//   missing         no tip showed for a trigger
//   not-adjacent    the tip is not beside its trigger (2026-11-13, the founder: "the tooltip text should remain close to the button itself
//                   not somewhere else"): on no side are the facing edges within 12px (the rule's gap is 8) with the two spans meeting
//   outside         part of the tip is outside the window
//   over-text       a line of words that is drawn there (not under a modal's scrim) meets the tip
//   over-control    a control's box that is drawn there meets the tip (not the trigger, nor what holds it)
//   over-picture    a picture that is drawn there meets the tip
//   over-own-panel  the trigger sits in a popup's rail (or outside its panel), the tip meets that panel, and there was clear room off it
//                   beside the trigger
// Adjacency wins over cover: a tip now stands only beside its trigger, so where every side meets something it covers the least of it,
// and the over-* counts may rise where the old far search found empty room further out; they are reported as they are.
// Needs the smoke server on 8788 with the latest build and a prepared account (SHOOT_TOKEN, from shots-all.mjs).
//
//   SHOOT_TOKEN=<token> node scripts/smoke/drive-tips.mjs
//   TIPS_SIZES=1280x800:mouse,1024x768:mouse,390x844:keys   TIPS_THEMES=light,dark
//   TIPS_ROUTES="/home /apps"   TIPS_POPUPS=1 (also every popup in popupCases.mjs)   TIPS_CASES=week-plan,bubble
//   TIPS_MAX=40 (triggers a page at most)   TIPS_OUT=<file> (every hit as JSON)   TIPS_BEHAVIOUR=0 (skip the behaviour checks)
//   TIPS_PLAN=0 (skip Daily's open task plan, whose close is checked at laptop sizes halfway down the plan)
// Before the placement walk it checks what smartTip.ts promises, once at 1280 (2026-11-12): a touch over a trigger shows no tip (touch),
// Escape hides a keyboard tip (escape), a mouse can move onto a name and it goes once the mouse leaves (hoverable, 2026-11-13), and a
// popup opened with Enter shows no tip on the Close it focuses (popup-close), and the assistant's bubble stops after three showings, the
// panel opened and folded in between, and shows every time where the device's storage throws (bubble-count, bubble-private).
// The assistant's bubble shows only the first three times a person points at the button (kreators.assistantTip:<user> on the device,
// 2026-11-13): every new document starts with that count cleared, so each page still checks the first showing, and a button marked
// data-tip-spent (a fourth pointing in one page) is not a trigger.
//
// Prints one line per hit, then a summary; exits 1 on any hit.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { CASES, MODAL, openCase } from './popupCases.mjs';

const ORIGIN = process.env.SHOOT_ORIGIN ?? 'http://127.0.0.1:8788';
const TOKEN = process.env.SHOOT_TOKEN;
if (!TOKEN) throw new Error('set SHOOT_TOKEN');
const SIZES = (process.env.TIPS_SIZES ?? '1280x800:mouse,1024x768:mouse,390x844:keys').split(',').map((s) => {
  const [dims, mode = 'mouse'] = s.split(':');
  const [w, h] = dims.split('x').map(Number);
  return { w, h, mode };
});
const THEMES = (process.env.TIPS_THEMES ?? 'light,dark').split(',');
const ROUTES = (process.env.TIPS_ROUTES ?? '/home /today /apps /wellbeing /mindful /cards/funflow /you /inbox /fitness /agency /admin?tab=people /school/coh-onboarding').split(/\s+/).filter(Boolean);
const POPUPS = process.env.TIPS_POPUPS === '1';
const ONLY_CASES = process.env.TIPS_CASES?.split(',');
const MAX = Number(process.env.TIPS_MAX ?? 40);
const KEY_STEPS = 200;
/** How far a tip's facing edge may stand from its trigger's and still be beside it (the rule's gap is 8, the rest is rounding). */
const ADJACENT = 12;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------------------------------------------------
// In the page. Kept as one source so each evaluate call gets the same helpers.

const IN_PAGE = String.raw`
(() => {
  if (window.__tips) return;
  const ADJACENT = ${ADJACENT};
  /** The side a tip stands on and its gap, the same reading as besideTrigger in packages/shared/src/tipPlace.ts. */
  const besideOf = (t, a) => {
    const acrossX = t.left < a.right && t.right > a.left;
    const acrossY = t.top < a.bottom && t.bottom > a.top;
    const sides = [
      ['top', a.top - t.bottom, acrossX],
      ['bottom', t.top - a.bottom, acrossX],
      ['left', a.left - t.right, acrossY],
      ['right', t.left - a.right, acrossY],
    ];
    let near = null;
    for (const [side, g, along] of sides) if (along && g >= -0.5 && (!near || g < near.gap)) near = { side, gap: g };
    if (!near) return { beside: false, gap: Math.round(Math.max(...sides.map((s) => s[1]))), side: null };
    return { beside: near.gap <= ADJACENT, gap: Math.round(near.gap), side: near.side };
  };
  const CONTROL = 'button, a[href], input, select, textarea, summary, [role=button], [role=tab], [contenteditable]';
  const PICTURE = 'img, svg, canvas, video, picture, [role=img]';
  const TRIGGER = '[data-tip], [data-tip-title], [data-term-tip] > button, :is(button, a, [role=button], [role=tab]):is([aria-label], [aria-labelledby])[title], button[aria-describedby="assistant-tip"]';
  const TIP = '.smart-tip, .smart-tip-card, #assistant-tip';
  const visible = (el) => {
    if (!el.isConnected || el.getClientRects().length === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
  };
  const takes = (el) => {
    if (el.matches('button[aria-describedby="assistant-tip"]')) return !el.hasAttribute('data-tip-spent');
    if (el.matches('[data-term-tip] > button')) return true;
    if (el.closest('[data-term-tip]')) return false;
    if (el.classList.contains('expand-btn') && el.querySelector('.expand-btn-words') && !el.closest('.dialog-rail')) return false;
    return Boolean((el.dataset.tip ?? el.dataset.tipTitle ?? el.getAttribute('title') ?? '').trim());
  };
  const nameOf = (el) => (el.getAttribute('aria-label') || el.dataset.tip || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const scopeOf = (sel) => (sel ? [...document.querySelectorAll(sel)].pop() ?? null : null);
  const meet = (a, b) => {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    // A sliver under a pixel is a rounding, not a cover.
    return w >= 1 && h >= 1 ? { area: w * h, x: (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2, y: (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2 } : null;
  };
  const opaque = (el) => {
    if (el.matches(PICTURE)) return true;
    const cs = getComputedStyle(el);
    if (cs.backgroundImage !== 'none') return true;
    const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
    if (!m) return false;
    const parts = m[1].split(/[ ,/]+/).filter(Boolean);
    return parts.length < 4 || Number(parts[3]) > 0.5;
  };
  /** Whether a box between el and the page clips the point away (a scrolled row, a cut line). */
  const clippedAt = (el, x, y) => {
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible' && cs.contain.indexOf('paint') < 0) continue;
      const r = a.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return true;
    }
    return false;
  };
  /**
   * Whether what sits in el is the thing drawn at x, y: el (or what it holds) comes before any modal scrim and any box over it. Words
   * (not strict) whose element takes no pointer count when the first thing met is what holds them and nothing clips them there.
   */
  const drawnAt = (el, x, y, strict) => {
    // The condensed title bar is drawn over the page but takes no pointer, so the hit test sees through it (2026-11-13).
    // Its own words are drawn there for the same reason, over whatever scrolls under it, unless a popup lies over the bar too.
    for (const c of document.querySelectorAll('.fx-condensed[data-on]')) {
      const r = c.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      if (!c.contains(el)) return false;
      const top = document.elementsFromPoint(x, y).find((e) => !e.closest(TIP));
      return !top?.closest('.sheet-scrim, .dialog-frame, [role="dialog"]');
    }
    for (const e of document.elementsFromPoint(x, y)) {
      if (e.closest(TIP)) continue;
      if (e === el || el.contains(e)) return true;
      if (e.classList.contains('sheet-scrim')) return false;
      if (e.contains(el)) return !strict && !clippedAt(el, x, y);
      if (opaque(e)) return false;
    }
    return !strict && !clippedAt(el, x, y);
  };
  const shownTip = (trigger) => {
    const list = [];
    const smart = document.querySelector('.smart-tip[data-on]');
    if (smart) list.push(smart);
    for (const c of document.querySelectorAll('.smart-tip-card')) list.push(c);
    const a = document.getElementById('assistant-tip');
    if (a) list.push(a);
    for (const t of list) if (visible(t) && Number(getComputedStyle(t).opacity) > 0.5) return t;
    return null;
  };
  const panelOf = (frame) => {
    if (!frame) return null;
    return frame.querySelector(':scope > .dialog-panel') ?? [...frame.children].find((c) => !c.classList.contains('dialog-rail')) ?? null;
  };
  /** What is drawn in a region: line boxes of words, controls' boxes and pictures' boxes, each kept only where it is what is drawn. */
  const drawnIn = (region, trigger, tip) => {
    const out = [];
    const skip = (el) => !el || el.closest(TIP) || el.closest('.sheet-scrim') || el === trigger || trigger.contains(el) || (tip && tip.contains(el));
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (skip(el) || !visible(el)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        const m = meet(r, region);
        if (m && m.area > 4) out.push({ kind: 'over-text', el, rect: r, words: n.textContent.trim().replace(/\s+/g, ' ').slice(0, 50) });
      }
    }
    for (const el of document.querySelectorAll(CONTROL)) {
      if (skip(el) || el.contains(trigger) || !visible(el)) continue;
      const r = el.getBoundingClientRect();
      const m = meet(r, region);
      if (m && m.area > 4) out.push({ kind: 'over-control', el, rect: r, words: nameOf(el) });
    }
    for (const el of document.querySelectorAll(PICTURE)) {
      if (skip(el) || el.contains(trigger) || el.closest(CONTROL) || el.parentElement?.closest('svg') || !visible(el)) continue;
      const r = el.getBoundingClientRect();
      const m = meet(r, region);
      if (m && m.area > 4) out.push({ kind: 'over-picture', el, rect: r, words: el.getAttribute('aria-label') || el.getAttribute('alt') || el.tagName.toLowerCase() });
    }
    return out;
  };
  window.__tips = {
    /** Marks every trigger in the scope (the top popup's frame, or the page outside any popup) and lists them. */
    mark(scopeSel, max) {
      for (const el of document.querySelectorAll('[data-tips-i]')) el.removeAttribute('data-tips-i');
      const scope = scopeOf(scopeSel);
      const all = [...document.querySelectorAll(TRIGGER)].filter((el) => takes(el) && visible(el) && (scope ? scope.contains(el) : !el.closest('.dialog-frame, [role=dialog]')));
      return all.slice(0, max).map((el, i) => {
        el.setAttribute('data-tips-i', String(i));
        return { i, name: nameOf(el), disabled: Boolean(el.disabled) };
      });
    },
    isTrigger(el) {
      return Boolean(el && el.matches && el.matches(TRIGGER) && takes(el));
    },
    /** Where to point at a marked trigger, once it is in view; null when something else is drawn over its middle. */
    aim(i) {
      const el = document.querySelector('[data-tips-i="' + i + '"]');
      if (!el || !visible(el)) return null;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const at = document.elementFromPoint(x, y);
      if (!at || !(at === el || el.contains(at) || at.contains(el) && at.matches('[data-term-tip]'))) return null;
      return { x, y };
    },
    /** The checks for the tip a trigger shows now (the marked one, or the focused one). */
    judge(i) {
      const trigger = i === null ? document.activeElement : document.querySelector('[data-tips-i="' + i + '"]');
      if (!trigger) return { gone: true };
      const tip = shownTip(trigger);
      if (!tip) return { missing: true, name: nameOf(trigger) };
      const t = tip.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const hits = [];
      if (t.left < -0.5 || t.top < -0.5 || t.right > vw + 0.5 || t.bottom > vh + 0.5) hits.push({ kind: 'outside', words: Math.round(t.left) + ',' + Math.round(t.top) + ' ' + Math.round(t.width) + 'x' + Math.round(t.height) });
      // Beside its trigger: on one side, the facing edges at most ADJACENT apart and the two spans meeting along it.
      const near = besideOf(t, trigger.getBoundingClientRect());
      if (!near.beside) hits.push({ kind: 'not-adjacent', words: (near.side ? near.side + ' ' : 'no side, ') + near.gap + 'px from the trigger' });
      // Measured with the tip out of the way, so what it covers can be asked about.
      const was = tip.style.visibility;
      tip.style.visibility = 'hidden';
      try {
        for (const h of drawnIn(t, trigger, tip)) {
          const m = meet(h.rect, t);
          if (!m) continue;
          if (drawnAt(h.el, m.x, m.y, h.kind !== 'over-text')) hits.push({ kind: h.kind, words: h.words });
        }
        // Its own panel, when it had room off it.
        const frame = trigger.closest('.dialog-frame');
        const panel = panelOf(frame);
        const offPanel = panel && (trigger.closest('.dialog-rail') || !panel.contains(trigger));
        if (offPanel && meet(panel.getBoundingClientRect(), t)) {
          const p = panel.getBoundingClientRect();
          // Only the spots the rule may take: beside the trigger at the gap, the tip spanning the trigger's middle.
          const anchors = [trigger.getBoundingClientRect()];
          const w = t.width;
          const h = t.height;
          let room = false;
          search: for (const a of anchors) {
            for (const gap of [8]) {
              const spots = [];
              const cx = (a.left + a.right) / 2;
              const cy = (a.top + a.bottom) / 2;
              for (let x = cx - w; x <= cx; x += 4) spots.push([x, a.top - gap - h], [x, a.bottom + gap]);
              for (let y = cy - h; y <= cy; y += 4) spots.push([a.left - gap - w, y], [a.right + gap, y]);
              for (const [x, y] of spots) {
                const r = { left: x, top: y, right: x + w, bottom: y + h };
                if (r.left < 8 || r.top < 8 || r.right > vw - 8 || r.bottom > vh - 8) continue;
                if (meet(r, p) || meet(r, anchors[0])) continue;
                const clear = drawnIn(r, trigger, tip).every((d) => {
                  const m = meet(d.rect, r);
                  return !m || !drawnAt(d.el, m.x, m.y, d.kind !== 'over-text');
                });
                if (clear) {
                  room = true;
                  break search;
                }
              }
            }
          }
          if (room) hits.push({ kind: 'over-own-panel', words: (frame.querySelector('h2')?.textContent ?? '').trim().slice(0, 50) || 'its panel' });
        }
      } finally {
        tip.style.visibility = was;
      }
      return { name: nameOf(trigger), hits, at: [Math.round(t.left), Math.round(t.top), Math.round(t.width), Math.round(t.height)] };
    },
  };
})();
`;

const twoFrames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/** A glossary word's card and the assistant's bubble wait for their placement to load: give them a moment. */
async function readTip(page, i) {
  for (let k = 0; k < 6; k += 1) {
    await twoFrames(page);
    const res = await page.evaluate((n) => window.__tips.judge(n), i);
    if (!res.missing) return res;
    await sleep(80);
  }
  return page.evaluate((n) => window.__tips.judge(n), i);
}

const hits = [];
let shown = 0;
let skipped = 0;
const report = (where, name, kind, words) => {
  const line = `${where} "${name}" ${kind}: ${words}`;
  hits.push({ where, name, kind, words });
  console.log(line);
};

/** Mouse: point at each trigger in the scope and judge its tip. */
async function byMouse(page, where, scopeSel) {
  await page.evaluate(IN_PAGE);
  const list = await page.evaluate((s, m) => window.__tips.mark(s, m), scopeSel, MAX);
  for (const t of list) {
    await page.mouse.move(2, 2);
    await page.evaluate((i) => document.querySelector(`[data-tips-i="${i}"]`)?.scrollIntoView({ block: 'center', inline: 'nearest' }), t.i);
    await sleep(120);
    const aim = await page.evaluate((i) => window.__tips.aim(i), t.i);
    if (!aim) {
      skipped += 1;
      continue;
    }
    await page.mouse.move(aim.x, aim.y);
    const res = await readTip(page, t.i);
    if (res.gone) continue;
    if (res.missing) {
      // A disabled button may get no pointer events; its CSS name stands in, which this does not measure.
      if (t.disabled) skipped += 1;
      else report(where, t.name, 'missing', 'no tip showed');
      continue;
    }
    shown += 1;
    for (const h of res.hits) report(where, res.name, h.kind, h.words);
  }
  await page.mouse.move(2, 2);
}

/** Keyboard: Tab through the scope, judging the tip of every trigger focus reaches. */
async function byKeys(page, where, scopeSel, steps) {
  await page.evaluate(IN_PAGE);
  await page.evaluate(() => document.activeElement?.blur?.());
  const seen = new Set();
  let last = '';
  let same = 0;
  for (let k = 0; k < steps; k += 1) {
    await page.keyboard.press('Tab');
    await sleep(30);
    const at = await page.evaluate((s) => {
      const el = document.activeElement;
      const scope = s ? [...document.querySelectorAll(s)].pop() : null;
      if (scope && !scope.contains(el)) return { out: true };
      if (!window.__tips.isTrigger(el)) return { key: el?.outerHTML?.slice(0, 80) ?? '' };
      return { key: el.outerHTML.slice(0, 200), trigger: true };
    }, scopeSel);
    if (at.out) break;
    if (at.key === last) {
      same += 1;
      if (same > 3) break;
    } else same = 0;
    last = at.key;
    if (!at.trigger || seen.has(at.key)) continue;
    seen.add(at.key);
    const res = await readTip(page, null);
    if (res.gone) continue;
    if (res.missing) {
      report(where, res.name, 'missing', 'no tip on keyboard focus');
      continue;
    }
    shown += 1;
    for (const h of res.hits) report(where, res.name, h.kind, h.words);
  }
}

/** The three promises in smartTip.ts's header, each reported as a hit of kind `behaviour` when broken. */
async function behaviour(browser) {
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': `10.93.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument((t) => {
    localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 }));
    for (const k of Object.keys(localStorage)) if (k.startsWith('kreators.assistantTip:')) localStorage.removeItem(k);
  }, TOKEN);
  const tipOn = () => page.evaluate(() => Boolean(document.querySelector('.smart-tip[data-on]')));
  const ready = async (route) => {
    await page.goto(`${ORIGIN}${route}`, { waitUntil: 'networkidle2', timeout: 25000 });
    await sleep(500);
    await page.evaluate(() => {
      for (const b of document.querySelectorAll('[role="dialog"]:not([aria-modal]) button')) if (/^Reject all$/.test(b.textContent.trim())) b.click();
    });
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-smart-tips'), { timeout: 5000 }).catch(() => {});
  };
  try {
    await ready('/mindful');
    // A touch: a pointer of type touch over a trigger names nothing.
    const touched = await page.evaluate(() => {
      const el = [...document.querySelectorAll('[data-tip]')].find((x) => x.getClientRects().length > 0);
      if (!el) return false;
      for (const type of ['pointerover', 'pointerenter', 'pointerdown']) el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch' }));
      return true;
    });
    await sleep(200);
    if (!touched) report('/mindful 1280', '(behaviour)', 'behaviour', 'touch: no data-tip trigger to touch');
    else if (await tipOn()) report('/mindful 1280', '(behaviour)', 'behaviour', 'touch: a tip showed on a touch');
    // Escape: Tab to a trigger until its tip shows, then Escape hides it.
    await page.evaluate(() => document.activeElement?.blur?.());
    let shownByKey = false;
    for (let k = 0; k < 120 && !shownByKey; k += 1) {
      await page.keyboard.press('Tab');
      await sleep(40);
      shownByKey = await tipOn();
    }
    if (!shownByKey) report('/mindful 1280', '(behaviour)', 'behaviour', 'escape: no keyboard tip showed in 120 Tabs');
    else {
      await page.keyboard.press('Escape');
      await sleep(150);
      if (await tipOn()) report('/mindful 1280', '(behaviour)', 'behaviour', 'escape: the tip stayed after Escape');
    }
    // Hoverable (WCAG 1.4.13): a name, the gap away from its trigger, stays while the mouse crosses onto it, and goes once it leaves.
    await page.keyboard.press('Escape');
    await page.mouse.move(2, 2);
    const aim = await page.evaluate(() => {
      const el = [...document.querySelectorAll('[data-tip]')].find((x) => x.getClientRects().length > 0 && x.getBoundingClientRect().top > 60);
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (aim) {
      await sleep(200);
      await page.mouse.move(aim.x, aim.y);
      await sleep(150);
      const box = await page.evaluate(() => {
        const t = document.querySelector('.smart-tip[data-on]');
        if (!t) return null;
        const r = t.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      if (!box) report('/mindful 1280', '(behaviour)', 'behaviour', 'hoverable: no tip showed to move onto');
      else {
        await page.mouse.move(box.x, box.y, { steps: 12 });
        await sleep(150);
        if (!(await tipOn())) report('/mindful 1280', '(behaviour)', 'behaviour', 'hoverable: the tip went while the mouse moved onto it');
        await page.mouse.move(2, 2, { steps: 4 });
        await sleep(150);
        if (await tipOn()) report('/mindful 1280', '(behaviour)', 'behaviour', 'hoverable: the tip stayed after the mouse left it');
      }
    }
    // A popup opened with Enter focuses its own Close: no tip names it.
    await ready('/today');
    const opener = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find((b) => /Plan my week/.test(b.textContent ?? '') && b.getClientRects().length > 0) ?? null);
    const el = opener.asElement();
    if (!el) report('/today 1280', '(behaviour)', 'behaviour', 'popup-close: no Plan my week button');
    else {
      await el.focus();
      await page.keyboard.press('Enter');
      await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 5000 }).catch(() => {});
      await sleep(500);
      const inDialog = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
      if (!inDialog) report('/today 1280', '(behaviour)', 'behaviour', 'popup-close: the popup did not take focus');
      else if (await tipOn()) report('/today 1280', '(behaviour)', 'behaviour', 'popup-close: a tip named the Close the popup focused');
    }
  } catch (e) {
    report('(behaviour)', '(behaviour)', 'behaviour', `could not run: ${String(e.message).slice(0, 120)}`);
  } finally {
    await page.close();
  }
  await assistantBubble(browser);
}

/**
 * The assistant's bubble shows the first three times a person points at the button, never after (bubble-count): five hovers, the third
 * followed by a click that opens the panel and Escape that folds it (focus handed back to the button must not show or count it), then a
 * reload; and with the device's storage throwing (a private window) it shows every time (bubble-private).
 */
async function assistantBubble(browser) {
  const run = async (privateWindow) => {
    const tag = privateWindow ? 'bubble-private' : 'bubble-count';
    const page = await browser.newPage();
    try {
      await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': `10.95.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
      await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.evaluateOnNewDocument((t) => {
        localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 }));
      }, TOKEN);
      if (privateWindow)
        await page.evaluateOnNewDocument(() => {
          const get = Storage.prototype.getItem;
          const set = Storage.prototype.setItem;
          Storage.prototype.getItem = function (k) {
            if (String(k).startsWith('kreators.assistantTip:')) throw new Error('blocked');
            return get.call(this, k);
          };
          Storage.prototype.setItem = function (k, v) {
            if (String(k).startsWith('kreators.assistantTip:')) throw new Error('blocked');
            return set.call(this, k, v);
          };
        });
      const open = async () => {
        await page.goto(`${ORIGIN}/home`, { waitUntil: 'networkidle2', timeout: 25000 });
        await sleep(600);
        await page.evaluate(() => {
          for (const b of document.querySelectorAll('[role="dialog"]:not([aria-modal]) button')) if (/^Reject all$/.test(b.textContent.trim())) b.click();
        });
        await sleep(200);
      };
      await page.goto(`${ORIGIN}/home`, { waitUntil: 'networkidle2', timeout: 25000 });
      await page.evaluate(() => {
        for (const k of Object.keys(localStorage)) if (k.startsWith('kreators.assistantTip:')) localStorage.removeItem(k);
      });
      await open();
      const at = async () =>
        page.evaluate(() => {
          const b = document.querySelector('button[aria-describedby="assistant-tip"]');
          if (!b) return null;
          const r = b.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
      const shows = () =>
        page.evaluate(() => {
          const t = document.getElementById('assistant-tip');
          if (!t) return false;
          const cs = getComputedStyle(t);
          return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5;
        });
      const hover = async (n, then) => {
        const b = await at();
        if (!b) throw new Error('no assistant button');
        await page.mouse.move(2, 400);
        await sleep(150);
        await page.mouse.move(b.x, b.y, { steps: 4 });
        await sleep(300);
        const on = await shows();
        const want = privateWindow || n <= 3;
        if (on !== want) report('/home 1280', '(behaviour)', 'behaviour', `${tag}: hover ${n} ${on ? 'showed' : 'did not show'} the bubble`);
        if (then) await then();
        await page.mouse.move(2, 400, { steps: 4 });
        await sleep(200);
      };
      await hover(1);
      await hover(2);
      await hover(3, async () => {
        await page.mouse.down();
        await page.mouse.up();
        await sleep(800);
        await page.keyboard.press('Escape');
        await sleep(500);
        // A pointer still over the button may count as pointing again; with three spent it must not show.
        if (!privateWindow && (await shows())) report('/home 1280', '(behaviour)', 'behaviour', `${tag}: the bubble showed as the panel folded away`);
      });
      await hover(4);
      await hover(5);
      if (!privateWindow) {
        const spent = await page.evaluate(() => document.querySelector('button[aria-describedby="assistant-tip"]')?.hasAttribute('data-tip-spent'));
        if (!spent) report('/home 1280', '(behaviour)', 'behaviour', `${tag}: data-tip-spent is not set after three showings`);
        await open();
        await hover(6);
      }
    } catch (e) {
      report('(behaviour)', '(behaviour)', 'behaviour', `${tag} could not run: ${String(e.message).slice(0, 120)}`);
    } finally {
      await page.close();
    }
  };
  await run(false);
  await run(true);
}

const browser = await puppeteer.launch({ executablePath: process.env.SHOOT_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run', '--disable-gpu'] });
try {
  if (process.env.TIPS_BEHAVIOUR !== '0') await behaviour(browser);
  for (const size of SIZES) {
    for (const theme of THEMES) {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': `10.94.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
      const phone = size.w < 768;
      await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: theme },
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ]);
      await page.evaluateOnNewDocument(
        (t, mode) => {
          localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 }));
          localStorage.setItem('kreators.theme', JSON.stringify({ state: { mode }, version: 0 }));
          // A fresh count for the assistant's bubble on every page, so its first showing is the one checked.
          for (const k of Object.keys(localStorage)) if (k.startsWith('kreators.assistantTip:')) localStorage.removeItem(k);
        },
        TOKEN,
        theme,
      );
      const tag = `${size.w}x${size.h} ${theme} ${size.mode}`;
      for (const route of ROUTES) {
        const where = `${route} ${tag}`;
        try {
          await page.goto(`${ORIGIN}${route}`, { waitUntil: 'networkidle2', timeout: 25000 });
          await sleep(500);
          await page.evaluate(() => {
            for (const b of document.querySelectorAll('[role="dialog"]:not([aria-modal]) button')) if (/^Reject all$/.test(b.textContent.trim())) b.click();
          });
          const ready = await page.evaluate(() => document.documentElement.hasAttribute('data-smart-tips'));
          if (!ready) report(where, '(page)', 'missing', 'the smart tips never started (data-smart-tips is not set)');
          if (size.mode === 'keys') await byKeys(page, where, null, KEY_STEPS);
          else await byMouse(page, where, null);
        } catch (e) {
          console.log(`ERR  ${where} ${String(e.message).slice(0, 160)}`);
        }
      }
      // A task's plan open in place on Daily (2026-11-13): its close stands outside the card, sticky down the plan, named by a tip where it
      // stands in the margin; read halfway down the plan, the way a person meets it.
      if (size.mode === 'mouse' && size.w >= 1024 && process.env.TIPS_PLAN !== '0') {
        const where = `/today [task plan] ${tag}`;
        try {
          await page.goto(`${ORIGIN}/today`, { waitUntil: 'networkidle2', timeout: 25000 });
          await sleep(500);
          await page.evaluate(() => {
            for (const b of document.querySelectorAll('[role="dialog"]:not([aria-modal]) button')) if (/^Reject all$/.test(b.textContent.trim())) b.click();
          });
          const opened = await page.evaluate(async () => {
            const li = document.querySelector('li[data-task-id]');
            const opener = li?.querySelector('[data-row-open]');
            if (!opener) return false;
            opener.click();
            for (let i = 0; i < 40 && !li.querySelector('[data-row-close-btn]'); i += 1) await new Promise((r) => setTimeout(r, 100));
            await new Promise((r) => setTimeout(r, 800));
            const card = li.querySelector('.check-row');
            window.scrollBy(0, card.getBoundingClientRect().top + 300);
            return Boolean(li.querySelector('[data-row-close-btn]'));
          });
          if (!opened) console.log(`MISS ${where}`);
          else {
            await sleep(300);
            await byMouse(page, where, '.row-close-rail');
          }
        } catch (e) {
          console.log(`ERR  ${where} ${String(e.message).slice(0, 160)}`);
        }
      }
      if (POPUPS) {
        for (const c of CASES) {
          if (ONLY_CASES && !ONLY_CASES.includes(c.key)) continue;
          if ((c.min && size.w < c.min) || (c.max && size.w > c.max)) continue;
          const where = `${c.path} [${c.key}] ${tag}`;
          try {
            const { opened } = await openCase(page, c, ORIGIN);
            const frame = c.frame ?? MODAL;
            const open = opened && (await page.evaluate((f) => Boolean(document.querySelector(f)), frame));
            if (!open) {
              if (!c.optional) console.log(`MISS ${where}`);
              continue;
            }
            await sleep(300);
            if (size.mode === 'keys') await byKeys(page, where, frame, 40);
            else await byMouse(page, where, frame);
          } catch (e) {
            console.log(`ERR  ${where} ${String(e.message).slice(0, 160)}`);
          }
        }
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (process.env.TIPS_OUT) fs.writeFileSync(process.env.TIPS_OUT, JSON.stringify(hits, null, 1));
const kinds = {};
for (const h of hits) kinds[h.kind] = (kinds[h.kind] ?? 0) + 1;
console.log(`\n${shown} tips shown, ${hits.length} hit${hits.length === 1 ? '' : 's'}${hits.length ? ` (${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', ')})` : ''}, ${skipped} triggers covered or disabled and left out`);
process.exit(hits.length ? 1 : 0);
