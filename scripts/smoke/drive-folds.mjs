// Every inline toggle on every screen (a fold such as Daily's "Add a task", an accordion, a panel an aria-expanded button opens in place;
// never a sheet, a dialog or a menu): opened in Chrome, and when what it opens is taller than the room the window has, a close must stay
// in view beside it as the page scrolls (2026-11-14, the founder: "put the entire website under such checks"), built like Daily's task
// plan close (RowClose in CheckRow.tsx).
//
//   node scripts/smoke/drive-folds.mjs <shots.json>      (the list from shots-all.mjs; needs the smoke server and scripts/smoke/state/shoot-token)
//
//   FOLDS_WIDTHS=390x844,768x1024,1280x800   the windows (that is the default)
//   FOLDS_ROUTES=<regex>                     only the paths this matches (a popup is `popup:<key>`)
//   FOLDS_JSON=<file>                        also write every toggle tested and every hit as JSON there
//   FOLDS_PARALLEL=4                         pages at once (one Chrome each)
//   FOLDS_CAP=40                             toggles tested a page at most (top level first, then the ones inside them); a drop is printed
//                                            (/help has 67 at the top level and the cohort pages over 60 in all: 80 tests every one)
//   FOLDS_ROWS=3                             Daily's task cards (`[data-row-open]`) tested a page at most; the rest are printed as skipped
//   FOLDS_THEME=light|dark                   default light
//   FOLDS_POPUPS=1                           also open the popups in popupCases.mjs and check the toggles inside each panel (the panel is the room)
//   FOLDS_JOB_MS=300000                      the most one page may take; a page stopped by it is printed
//   SMOKE_ORIGIN=http://127.0.0.1:8788       the server (it must serve the latest build)
//   SHOOT_TOKEN=<token>                      the account, instead of scripts/smoke/state/shoot-token
//
// The contract the close follows: the element holding a toggle and its content carries `data-sticky-close-root` (while its rail shows,
// also `data-sticky-close="in"` or `"out"`); the close carries `data-sticky-close-btn` and a name that starts with "Close". Daily's task
// plan close (`data-row-close-btn`, its row `[data-row-close]`) counts as one. Tapping it folds the toggle (aria-expanded="false"), hands
// focus to the toggle and leaves the toggle in view under any top bar.
//
// For every toggle: open it (a real click where the pointer reaches it, else the element's own click), wait until what it opened stops
// growing (a lazy chunk), and measure from the toggle's top to the content's bottom (its root's bottom when it has one) against the room:
// the window less the fixed and sticky bars over its top and bottom edges (the condensed title, the site's header from the tablet, the
// phone's tab bar, a held StickyAction). TALL: scroll the content's middle to the window's middle, then its foot to 120px above the bottom
// bar, then the toggle's own line to just above the bottom bar (`low`: the close at its resting place, in the band where Back to top and the
// assistant's button sit), and at each a close must be on screen, under the bars, not covered (Back to top touching it counts; a phone's
// close at rest under the assistant's floating button, as any control in that corner is until the page scrolls, is only noted), not
// clipped, not over another close and not over a control or a
// line of words; then a real click on it must fold the toggle, focus it and leave it in view. SHORT: a close showing anyway is `extra`
// (information, not a failure). Toggles inside an opened region are tested too (one level), and one open at load is folded first and
// opened again so its opening can be watched. Not inline toggles, so only noted: one that opens a popup (Escape closes it), one whose
// content is laid over the page (a popover), and a one-way reveal (aria-expanded stays false, or the toggle goes; the page is loaded
// again). Skipped: navigation, the bars, fixed chrome, the phone's top corners, menus (`aria-haspopup`), a glossary word's tip, a task's
// tag filters and the closes themselves. Everything opened is folded again; the page is
// read again whenever it did not come back as it loaded. Nothing but an aria-expanded toggle or a close is ever clicked, and no form is sent.
// The privacy card is answered on the device before every load, all off, as a person who tapped Reject all (the app then hands that answer
// to the account once, as it does for anyone): an unanswered card is a dialog the page keeps, and Back to top steps aside for it, so the
// run would never see Back to top at all. The terms notice is only hidden; while one is up, every look notes that Back to top could not
// show, and the summary says how many `low` looks had Back to top drawn.
//
// The kinds: `no-close` (none on screen), `covered` (under a bar or something else, or touching Back to top), `clipped` (off the window or cut by a box),
// `overlap` (two closes on each other), `covers-control` (over a field, a button, a link or a line of words in the content), `name` (its
// name does not start with "Close"), `no-collapse`, `focus` and `off-view` (after tapping it), and `extra` (a close on a short one).
// Prints one line per hit and a summary by kind; exits 1 on any kind but `extra`, or when a page threw.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { CASES, MODAL, openCase } from './popupCases.mjs';

const ORIGIN = process.env.SMOKE_ORIGIN ?? 'http://127.0.0.1:8788';
const WIDTHS = (process.env.FOLDS_WIDTHS ?? '390x844,768x1024,1280x800').split(',').map((s) => s.trim().split('x').map(Number));
const ROUTES = process.env.FOLDS_ROUTES ? new RegExp(process.env.FOLDS_ROUTES) : null;
const PARALLEL = Math.max(1, Number(process.env.FOLDS_PARALLEL ?? 4));
const CAP = Number(process.env.FOLDS_CAP ?? 40);
const ROWS = Number(process.env.FOLDS_ROWS ?? 3);
const THEME = process.env.FOLDS_THEME === 'dark' ? 'dark' : 'light';
const JOB_MS = Number(process.env.FOLDS_JOB_MS ?? 300000);
const POPUPS = process.env.FOLDS_POPUPS === '1';
const FAIL = ['no-close', 'covered', 'clipped', 'overlap', 'covers-control', 'name', 'no-collapse', 'focus', 'off-view'];
// Whole-page chats, as drive-scroll.mjs leaves them; whole segments only, so /sessions (the Library's sessions) is still tested.
const SKIP = /^\/(onboarding|session|vibe-check)(?=[/?#]|$)/;
const token = (process.env.SHOOT_TOKEN ?? fs.readFileSync(new URL('./state/shoot-token', import.meta.url), 'utf8')).trim();
const chrome = [process.env.SHOOT_CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && fs.existsSync(p));
if (!chrome) throw new Error('no Chrome found; set SHOOT_CHROME');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The version of the privacy question the app asks now (lib/consent.ts keeps an answer only at this version or later).
const CONSENT_VERSION = Number(/export const CONSENT_VERSION = (\d+)/.exec(fs.readFileSync(new URL('../../packages/shared/src/legal.ts', import.meta.url), 'utf8'))?.[1]);
if (!Number.isInteger(CONSENT_VERSION)) throw new Error('CONSENT_VERSION not found in packages/shared/src/legal.ts');

const shots = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : [];
if (!shots.length && !POPUPS) throw new Error('usage: node scripts/smoke/drive-folds.mjs <shots.json>   (or FOLDS_POPUPS=1 alone)');
const seenPaths = new Set();
const routes = shots.filter((s) => {
  const key = `${s.path}|${s.needsSession ? 1 : 0}`;
  if (seenPaths.has(key) || SKIP.test(s.path) || (ROUTES && !ROUTES.test(s.path))) return false;
  seenPaths.add(key);
  return true;
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// The page side: installed as window.__folds after every load. `mode` is null for the window, or { frame } for the top popup, whose panel
// is then the scroll box and the room.
function pageLib(mode) {
  const TOGGLE = 'button[aria-expanded], [role="button"][aria-expanded]';
  const CLOSE = '[data-sticky-close-btn], [data-row-close-btn]';
  const ROOT = '[data-sticky-close-root], [data-row-close]';
  const CONTROL = 'input, select, textarea, button, a[href], [role="button"], [role="switch"], [role="checkbox"], [role="slider"], [contenteditable="true"], [contenteditable="plaintext-only"], [contenteditable=""], [tabindex]:not([tabindex="-1"])';
  const F = (window.__folds = { stack: [], mode });
  const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
  // `cache`: a Map for one look, so a long walk asks each element once (never kept between looks: the page changes under them).
  const shown = (el, cache) => {
    if (!el || !el.isConnected) return false;
    if (cache?.has(el)) return cache.get(el);
    const r = el.getBoundingClientRect();
    const ok = r.width >= 2 && r.height >= 2 && (el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true);
    cache?.set(el, ok);
    return ok;
  };
  const labelOf = (el) => {
    if (!el) return '';
    let t = el.getAttribute('aria-label');
    const by = el.getAttribute('aria-labelledby');
    if (!t && by) t = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
    if (!t) t = el.textContent;
    return norm(t).slice(0, 70) || '?';
  };
  const shortSel = (el) => {
    if (!el || el.nodeType !== 1) return String(el ?? 'nothing');
    const parts = [];
    let n = el;
    for (let i = 0; n && i < 3 && n !== document.body; i += 1, n = n.parentElement) {
      let s = n.tagName.toLowerCase();
      if (n.id && !/^:r|^«/.test(n.id)) {
        parts.unshift(`${s}#${n.id}`);
        break;
      }
      for (const a of ['data-sticky-close-root', 'data-row-close', 'data-group-key', 'data-tile-list', 'data-pillar']) {
        if (n.hasAttribute(a)) {
          s += `[${a}${n.getAttribute(a) ? `=${n.getAttribute(a)}` : ''}]`;
          break;
        }
      }
      const cls = [...n.classList].filter((c) => /^[a-z][a-z0-9-]*$/.test(c) && !/^(flex|grid|block|inline|contents|relative|absolute|sticky|w-|h-|min-|max-|size-|p[xytrbl]?-|m[xytrbl]?-|gap-|space-|items-|justify-|content-|text-|font-|leading-|tracking-|bg-|rounded|shadow|border|overflow|z-|col-|row-|self-|shrink|grow|basis|order|hidden|truncate|whitespace|break|underline|cursor|select|transition|duration|ease|opacity|outline|ring|fill|stroke|list|top-|left-|right-|bottom-|inset|isolate|toy)/.test(c));
      if (cls.length) s += `.${cls.slice(0, 2).join('.')}`;
      parts.unshift(s);
    }
    return parts.join(' > ');
  };
  const near = (el) => {
    let last = '';
    for (const h of document.querySelectorAll('h1, h2, h3')) {
      if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING && shown(h)) last = norm(h.textContent).slice(0, 40);
    }
    return last;
  };
  const meets = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
  const within = (a, b) => a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
  const box = (r) => ({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });

  F.panel = () => {
    if (!mode) return null;
    const d = [...document.querySelectorAll(mode.frame)].pop();
    return d ? (d.querySelector('.dialog-panel') ?? d) : null;
  };
  F.scope = () => F.panel() ?? document.body;
  // The room: the window, or the popup's panel inside its border.
  F.view = () => {
    const p = F.panel();
    if (!p) return { top: 0, left: 0, right: document.documentElement.clientWidth, bottom: window.innerHeight };
    const r = p.getBoundingClientRect();
    const top = r.top + p.clientTop;
    const left = r.left + p.clientLeft;
    return { top, left, right: left + p.clientWidth, bottom: top + p.clientHeight };
  };
  F.scrollY = () => F.panel()?.scrollTop ?? window.scrollY;
  F.scrollTo = (y) => {
    const p = F.panel();
    if (p) p.scrollTop = Math.max(0, y);
    else window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
  };
  // The bars over the room's top and bottom edges: fixed or sticky, at least 40% as wide as the room and under 40% as tall (so the
  // laptop sidebar, the page's wash and a close's own narrow rail never count), drawn, and touching the edge or a bar that does.
  F.chrome = (V = F.view()) => {
    const p = F.panel();
    const W = V.right - V.left;
    const H = V.bottom - V.top;
    const bars = [];
    for (const el of (p ?? document.body).querySelectorAll('*')) {
      const pos = getComputedStyle(el).position;
      if (pos !== 'sticky' && (p || pos !== 'fixed')) continue;
      if (!p && el.closest('[role="dialog"], .page-contents')) continue; // the privacy card (hidden anyway) and On this page are not bars
      const r = el.getBoundingClientRect();
      if (r.width < 0.4 * W || r.height > 0.4 * H || r.height < 2 || !shown(el)) continue;
      // A held StickyAction draws its bar from one sm gap above the row (its ::before).
      const top = el.matches('.sticky-action[data-stuck]') ? r.top - 13 : r.top;
      bars.push({ top, bottom: r.bottom, name: shortSel(el) });
    }
    let t = V.top;
    const topBars = [];
    for (let again = true; again; ) {
      again = false;
      for (const b of bars) if (!topBars.includes(b) && b.top <= t + 2 && b.bottom > t + 0.5) (t = Math.max(t, b.bottom), topBars.push(b), (again = true));
    }
    let bo = V.bottom;
    const bottomBars = [];
    for (let again = true; again; ) {
      again = false;
      for (const b of bars) if (!bottomBars.includes(b) && !topBars.includes(b) && b.bottom >= bo - 2 && b.top < bo - 0.5) (bo = Math.min(bo, b.top), bottomBars.push(b), (again = true));
    }
    return { top: Math.round(t - V.top), bottom: Math.round(V.bottom - bo), bars: [...topBars, ...bottomBars].map((b) => b.name) };
  };

  const eligible = (el, scope) => {
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
    const pop = el.getAttribute('aria-haspopup');
    if (pop && pop !== 'false') return false; // a menu, a listbox, a sheet
    if (el.matches('[data-tag-filter], [data-sticky-close-btn], [data-row-close-btn]')) return false;
    // Navigation, the bars, the phone's top corners (the apps menu), a glossary word's tip and anything a person cannot reach.
    if (el.closest('[inert], [aria-hidden="true"], nav, [data-top-bar], .fx-condensed, .safe-top.absolute, [data-term-tip], [role="tooltip"]')) return false;
    const dlg = el.closest('[role="dialog"]');
    if (dlg && !dlg.contains(scope)) return false;
    for (let n = el; n && n !== scope && n !== document.body; n = n.parentElement) {
      const pos = getComputedStyle(n).position;
      if (pos === 'fixed') return false; // chrome: the assistant, the reminders bubble, On this page, the focus pill
      if (pos === 'sticky' && n.tagName === 'HEADER') return false;
    }
    return shown(el);
  };
  // The region a toggle opened: what aria-controls names, else what was added under the nearest ancestor that holds any of it.
  F.regionNodes = (d) => {
    const s = F.stack[d];
    const live = (s?.region ?? []).filter((n) => n.isConnected && shown(n));
    return live.length ? live : s?.G?.isConnected ? [s.G] : [];
  };
  F.list = (within) => {
    const scope = F.scope();
    let pool = [...scope.querySelectorAll(TOGGLE)].filter((el) => eligible(el, scope));
    if (within != null) {
      const s = F.stack[within];
      const nodes = F.regionNodes(within);
      pool = pool.filter((el) => el !== s.el && !s.el.contains(el) && nodes.some((n) => n.contains(el)));
    }
    const seen = new Map();
    return pool.map((el) => {
      const label = labelOf(el);
      const k = seen.get(label) ?? 0;
      seen.set(label, k + 1);
      return { el, sig: `${label}#${k}`, label, state: el.getAttribute('aria-expanded'), row: el.hasAttribute('data-row-open') };
    });
  };
  F.candidates = (within) => F.list(within).map(({ el, ...c }) => ({ ...c, near: near(el) }));
  // What the page looks like at rest: the address, the popups open and the toggles open. A test that leaves it otherwise reloads.
  F.fingerprint = () => {
    const open = F.list(null)
      .filter((c) => c.state === 'true')
      .map((c) => c.sig)
      .join('|');
    return `${location.pathname}${location.search}::${document.querySelectorAll('[role="dialog"][aria-modal="true"]').length}::${open}`;
  };
  const docTop = (el) => el.getBoundingClientRect().top - F.view().top + F.scrollY();
  // A toggle the page drew again is found again by its name, only near where it was (so a field that went away is never mistaken for
  // the next one with the same name).
  const refind = (s) => {
    if (s.el.isConnected) return s.el;
    const c = F.list(s.within).find((x) => x.sig === s.sig && Math.abs(docTop(x.el) - s.docY) < 200);
    if (c) s.el = c.el;
    return c ? c.el : null;
  };
  F.select = (sig, d, within) => {
    F.stack.length = d;
    const c = F.list(within ?? null).find((x) => x.sig === sig);
    if (!c) return { found: false };
    F.stack[d] = { el: c.el, sig, within: within ?? null, label: c.label, added: [], region: [], G: null, docY: docTop(c.el) };
    return F.aim(d);
  };
  // Brings the toggle to the middle and says where a real pointer would press it, and whether the pointer would reach it there.
  F.aim = (d) => {
    const s = F.stack[d];
    const el = refind(s);
    if (!el) return { found: false };
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    s.docY = docTop(el);
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + Math.min(r.height / 2, 22);
    const at = document.elementFromPoint(x, y);
    return { found: true, x, y, hit: !!at && (at === el || el.contains(at)), state: el.getAttribute('aria-expanded') };
  };
  F.domClick = (d) => F.stack[d].el.click();
  F.connected = (d) => F.stack[d].el.isConnected;
  F.state = (d) => {
    const el = refind(F.stack[d]);
    return el ? el.getAttribute('aria-expanded') : 'gone';
  };
  F.watch = (d) => {
    const s = F.stack[d];
    s.added = [];
    s.obs?.disconnect();
    s.obs = new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === 'childList') for (const n of m.addedNodes) n.nodeType === 1 && s.added.push(n);
        else if (m.attributeName === 'hidden' && !m.target.hasAttribute('hidden')) s.added.push(m.target);
      }
    });
    s.obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  };
  F.settleKey = (d) => {
    const s = F.stack[d];
    const n = s ? s.added.filter((x) => x.isConnected && !x.closest('[data-rect-quiet]')).length : 0;
    const p = F.panel();
    const h = p ? p.scrollHeight : document.documentElement.scrollHeight;
    const reg = s ? F.regionNodes(d).reduce((a, x) => a + Math.round(x.getBoundingClientRect().height), 0) : 0;
    return { key: `${h}|${n}|${reg}|${s?.el.isConnected ? s.el.getAttribute('aria-expanded') : 'gone'}`, busy: document.documentElement.hasAttribute('data-rect-busy') };
  };
  const fixedAbove = (n, scope) => {
    for (let a = n; a && a !== scope && a !== document.body; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') return true;
    return false;
  };
  // After opening: what opened (the region), the container that holds it and the toggle (G), and whether it opened a popup instead.
  F.assess = (d) => {
    const s = F.stack[d];
    s.obs?.disconnect();
    const expanded = F.state(d); // re-found by its name when the click drew a new element
    const el = s.el;
    const scope = F.scope();
    const out = { expanded, dialogs: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length, url: location.pathname + location.search };
    if (!el.isConnected) return out;
    const id = el.getAttribute('aria-controls');
    const byId = id ? document.getElementById(id) : null;
    let region = [];
    let how = 'none';
    if (byId && shown(byId)) {
      region = [byId];
      how = 'controls';
    } else {
      const nodes = s.added.filter((n) => n.isConnected && n !== el && !el.contains(n) && !n.contains(el) && scope.contains(n) && shown(n) && !n.closest('[role="tooltip"]') && !fixedAbove(n, scope));
      for (let a = el.parentElement, i = 0; a && i < 8 && a !== scope && a !== document.body && a.id !== 'root' && a.tagName !== 'MAIN'; a = a.parentElement, i += 1) {
        if (nodes.some((n) => a.contains(n))) {
          s.G = a;
          break;
        }
      }
      if (s.G) {
        region = nodes.filter((n) => s.G.contains(n));
        region = region.filter((n) => !region.some((m) => m !== n && m.contains(n)));
        how = 'added';
      }
    }
    if (region.length && !s.G) {
      let a = el.parentElement;
      while (a && !a.contains(region[0])) a = a.parentElement;
      s.G = a;
    }
    s.region = region;
    out.how = how;
    out.regionCount = region.length;
    // Out of the flow (a dropdown laid over the page): a popover, not an inline toggle.
    out.popover = region.length > 0 && region.every((n) => /absolute|fixed/.test(getComputedStyle(n).position));
    out.g = shortSel(s.G);
    return out;
  };
  // The toggle's own root: the closest [data-sticky-close-root] (or Daily's row) whose first toggle is this one, so a nested toggle never
  // borrows its parent's root or its close.
  F.rootOf = (d) => {
    const el = F.stack[d].el;
    const root = el.closest(ROOT);
    if (!root) return null;
    const first = [...root.querySelectorAll(TOGGLE)].find((t) => !t.matches(CLOSE));
    return first === el ? root : null;
  };
  F.bottomOf = (d, root = F.rootOf(d)) => {
    if (root) return root.getBoundingClientRect().bottom;
    const nodes = F.regionNodes(d);
    if (!nodes.length) return F.stack[d].el.getBoundingClientRect().bottom;
    return Math.max(...nodes.map((n) => n.getBoundingClientRect().bottom));
  };
  F.closesOf = (d, root = F.rootOf(d)) => {
    const s = F.stack[d];
    const set = new Set();
    const zones = root ? [root] : [s.G, ...F.regionNodes(d)].filter(Boolean);
    for (const z of zones) for (const b of z.querySelectorAll(CLOSE)) set.add(b);
    const regionIds = F.regionNodes(d)
      .map((n) => n.id)
      .filter(Boolean);
    for (const b of document.querySelectorAll(CLOSE)) if (regionIds.includes(b.getAttribute('aria-controls'))) set.add(b);
    // Only its own: a close inside another toggle's root (a nested one's, or the parent's around it) belongs to that one.
    return [...set].filter((b) => (b.closest(ROOT) ?? null) === root);
  };
  const clipper = (b, scope) => {
    const r = b.getBoundingClientRect();
    for (let a = b.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      if (!within(r, a.getBoundingClientRect())) return shortSel(a);
      if (a === scope) break;
    }
    return null;
  };
  F.scrollMid = (d) => {
    const V = F.view();
    const tr = F.stack[d].el.getBoundingClientRect();
    const mid = (tr.top + F.bottomOf(d)) / 2 - V.top + F.scrollY();
    F.scrollTo(mid - (V.bottom - V.top) / 2);
  };
  F.scrollFoot = (d) => {
    const V = F.view();
    const c = F.chrome(V);
    const foot = F.bottomOf(d) - V.top + F.scrollY();
    F.scrollTo(foot - (V.bottom - V.top - c.bottom - 120));
  };
  // The toggle's own line just above the bottom bar (8px clear, never under the top bar): its close at rest, low on the screen, where Back
  // to top and the assistant's button sit.
  F.scrollLow = (d) => {
    const V = F.view();
    const c = F.chrome(V);
    const tr = F.stack[d].el.getBoundingClientRect();
    const want = Math.max(c.top, V.bottom - V.top - c.bottom - tr.height - 8);
    F.scrollTo(tr.top - V.top + F.scrollY() - want);
  };
  // Back to top while it is drawn (its 36px button grown to the 44px it takes to tap), else null.
  const backToTop = () => {
    const b = document.querySelector('.back-to-top-btn');
    if (!b || !shown(b)) return null;
    const r = b.getBoundingClientRect();
    const gx = Math.max(0, (44 - r.width) / 2);
    const gy = Math.max(0, (44 - r.height) / 2);
    return { left: r.left - gx, right: r.right + gx, top: r.top - gy, bottom: r.bottom + gy, x: r.left, y: r.top, w: r.width, h: r.height };
  };
  // One look at the open toggle from where the page is scrolled now.
  F.check = (d, at) => {
    const s = F.stack[d];
    const V = F.view();
    const c = F.chrome(V);
    const room = V.bottom - V.top - c.top - c.bottom;
    const tr = s.el.getBoundingClientRect();
    const root = F.rootOf(d);
    const bottom = F.bottomOf(d, root);
    const total = bottom - tr.top;
    const res = { at, scrollY: Math.round(F.scrollY()), room: Math.round(room), total: Math.round(total), tall: total > room + 0.5, chromeTop: c.top, chromeBottom: c.bottom, bars: c.bars, root: root ? shortSel(root) : null, g: shortSel(s.G), rail: root?.getAttribute('data-sticky-close') ?? root?.getAttribute('data-row-close') ?? null, closes: [], overlap: [], covers: [] };
    const vTop = V.top + c.top;
    const vBottom = V.bottom - c.bottom;
    const scope = F.scope();
    const btt = backToTop();
    res.btt = btt ? box({ left: btt.x, top: btt.y, width: btt.w, height: btt.h }) : null;
    // A dialog the page keeps (the unanswered privacy card or the terms notice, even hidden by this script) holds Back to top back.
    res.bttBlocked = Boolean(document.querySelector('[role="dialog"].lift-over-sticky'));
    const stateOf = (b) => {
      const r = b.getBoundingClientRect();
      const o = { label: norm(b.getAttribute('aria-label')).slice(0, 50), ...box(r) };
      if (!shown(b)) o.state = 'hidden';
      else if (r.top < V.top - 0.5 || r.bottom > V.bottom + 0.5 || r.left < V.left - 0.5 || r.right > V.right + 0.5) (o.state = 'clipped'), (o.by = mode ? 'the panel' : 'the window');
      else if ((o.by = clipper(b, scope))) o.state = 'clipped';
      else if (r.top < vTop - 0.5 || r.bottom > vBottom + 0.5) (o.state = 'covered'), (o.by = r.top < vTop - 0.5 ? `the top bar (${c.top}px)` : `the bottom bar (${c.bottom}px)`);
      else {
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        // Back to top touching it anywhere is as bad as over its middle: a tap meant for one lands on the other.
        if (btt && meets(r, btt)) (o.state = 'covered'), (o.by = 'Back to top');
        else if (hit && (hit === b || b.contains(hit))) (o.state = 'ok'), (o.by = undefined);
        // At rest low on a phone the close stands where the toggle's own chevron was, under the assistant's floating button, as any control
        // in that corner does until the page is scrolled (the page keeps room at its foot and a scroll padding for it): noted, not failed.
        else if (at === 'low' && hit?.closest?.('button[aria-label="Open the assistant"]')) (o.state = 'ok'), (o.under = "the assistant's button");
        else (o.state = 'covered'), (o.by = hit?.closest?.('.back-to-top') ? 'Back to top' : shortSel(hit));
      }
      return o;
    };
    const mine = F.closesOf(d, root);
    res.closes = mine.map(stateOf);
    if (!/^Close/.test(res.closes.find((o) => o.state === 'ok')?.label ?? 'Close')) res.badName = res.closes.find((o) => o.state === 'ok').label;
    // Two closes on screen on top of each other (anywhere on the page: a nested one's and its parent's).
    const onScreen = [...document.querySelectorAll(CLOSE)].filter((b) => {
      if (!shown(b)) return false;
      const r = b.getBoundingClientRect();
      return r.bottom > V.top && r.top < V.bottom && r.right > V.left && r.left < V.right;
    });
    for (let i = 0; i < onScreen.length; i += 1) {
      for (let j = i + 1; j < onScreen.length; j += 1) {
        if (meets(onScreen[i].getBoundingClientRect(), onScreen[j].getBoundingClientRect()) && (mine.includes(onScreen[i]) || mine.includes(onScreen[j]))) res.overlap.push(`${norm(onScreen[i].getAttribute('aria-label')).slice(0, 40)} over ${norm(onScreen[j].getAttribute('aria-label')).slice(0, 40)}`);
      }
    }
    // A close drawn over a control or a line of words in the content (the toggle's own card is its business: Daily's close sits where its
    // edit button was).
    const zones = root ? [root] : [s.G, ...F.regionNodes(d)].filter(Boolean);
    const seen = new Map();
    mine.forEach((b, i) => {
      if (!['ok', 'covered'].includes(res.closes[i].state)) return;
      const cr = b.getBoundingClientRect();
      const skip = (x) => !x || x.closest(CLOSE) || x.contains(b) || x === s.el || s.el.contains(x);
      const found = new Set();
      for (const z of zones) {
        for (const x of z.querySelectorAll(CONTROL)) {
          if (found.size >= 3) break;
          if (skip(x) || x.type === 'hidden' || !shown(x, seen)) continue;
          const xr = x.getBoundingClientRect();
          if (within(xr, tr) || !meets(xr, cr)) continue;
          found.add(`${x.tagName.toLowerCase()}${x.type ? `[${x.type}]` : ''} "${labelOf(x).slice(0, 30)}"`);
        }
        const walker = document.createTreeWalker(z, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (t.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
        const range = document.createRange();
        for (let t = walker.nextNode(); t && found.size < 3; t = walker.nextNode()) {
          const p = t.parentElement;
          if (skip(p) || !shown(p, seen)) continue;
          range.selectNodeContents(t);
          for (const rr of range.getClientRects()) {
            if (rr.width < 2 || rr.height < 2 || within(rr, tr) || !meets(rr, cr)) continue;
            found.add(`words "${norm(t.nodeValue).slice(0, 30)}"`);
            break;
          }
        }
      }
      for (const f of found) res.covers.push(f);
    });
    return res;
  };
  // The close a person would tap now: the first one in the clear, else any (pressed by its own click, so the folding is still checked).
  F.pickClose = (d) => {
    const V = F.view();
    const c = F.chrome(V);
    for (const b of F.closesOf(d)) {
      if (!shown(b)) continue;
      const r = b.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (r.top >= V.top + c.top - 0.5 && r.bottom <= V.bottom - c.bottom + 0.5 && hit && (hit === b || b.contains(hit))) return { x, y, real: true };
    }
    const any = F.closesOf(d).find((b) => b.isConnected);
    if (any) {
      F.stack[d].closeEl = any;
      return { real: false };
    }
    return null;
  };
  F.domClickClose = (d) => F.stack[d].closeEl?.click();
  F.afterClose = (d) => {
    const s = F.stack[d];
    const state = F.state(d);
    const el = s.el;
    const V = F.view();
    const c = F.chrome(V);
    const r = el.isConnected ? el.getBoundingClientRect() : null;
    const a = document.activeElement;
    return {
      expanded: state,
      focus: !!a && el.isConnected && (a === el || el.contains(a)),
      active: a && a !== document.body ? `${shortSel(a)} "${labelOf(a).slice(0, 30)}"` : 'the page',
      inView: !!r && r.top >= V.top + c.top - 1 && r.bottom <= V.bottom - c.bottom + 1 && r.left >= V.left - 1 && r.right <= V.right + 1,
      top: r ? Math.round(r.top - V.top) : null,
      chromeTop: c.top,
    };
  };
  return true;
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// The Node side.
const HIDE_PRIVACY = '[role="dialog"][aria-label="Your privacy choices"], [role="dialog"][aria-label="Our terms and privacy policy"] { display: none !important; }';
const frames = (page) => page.evaluate(() => Promise.race([new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), new Promise((r) => setTimeout(r, 250))]));

async function settle(page, d, max = 3000) {
  const end = Date.now() + max;
  let last = null;
  let same = 0;
  await sleep(150);
  while (Date.now() < end) {
    const k = await page.evaluate((dd) => window.__folds.settleKey(dd), d);
    if (k.key === last && !k.busy) {
      same += 1;
      if (same >= 2) return true;
    } else same = 0;
    last = k.key;
    await sleep(150);
  }
  return false;
}

async function prepare(page) {
  await page.addStyleTag({ content: HIDE_PRIVACY }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-rect-busy'), { timeout: 5000 }).catch(() => {});
  // Until the page stops drawing (a form that fills itself once the day's entry loads draws its folds again).
  const end = Date.now() + 3000;
  let last = '';
  for (let same = 0; same < 3 && Date.now() < end; ) {
    const k = await page.evaluate(() => `${document.documentElement.scrollHeight}|${document.getElementsByTagName('*').length}`).catch(() => '');
    same = k === last ? same + 1 : 0;
    last = k;
    await sleep(150);
  }
}

async function loadRoute(page, path) {
  try {
    await page.goto(`${ORIGIN}${path}`, { waitUntil: 'networkidle0', timeout: 20000 });
  } catch (e) {
    if (!/timeout/i.test(String(e?.message))) throw e;
  }
  await sleep(400);
  await prepare(page);
  await page.evaluate(pageLib, null);
}

async function reopenPopup(page, c) {
  const { opened } = await openCase(page, c, ORIGIN);
  if (!opened) return false;
  await sleep(300);
  await prepare(page);
  await page.evaluate(pageLib, { frame: c.frame ?? MODAL });
  return page.evaluate(() => Boolean(window.__folds.panel()));
}

async function clickAt(page, aim, d) {
  const W = page.viewport().width;
  if (aim.hit) {
    await page.mouse.click(aim.x, aim.y);
    await page.mouse.move(Math.round(W / 2), 0);
  } else await page.evaluate((dd) => window.__folds.domClick(dd), d);
}

const kindsOf = (checks) => {
  const out = [];
  const add = (kind, at, detail) => {
    const was = out.find((k) => k.kind === kind);
    if (was) {
      if (!was.at.includes(at)) was.at.push(at);
    } else out.push({ kind, at: [at], detail });
  };
  for (const ch of checks) {
    const states = ch.closes.map((c) => c.state);
    if (!states.includes('ok')) {
      const cov = ch.closes.find((c) => c.state === 'covered');
      const clip = ch.closes.find((c) => c.state === 'clipped');
      if (cov) add('covered', ch.at, `by ${cov.by}`);
      else if (clip) add('clipped', ch.at, `by ${clip.by}`);
      else add('no-close', ch.at, ch.closes.length ? `${ch.closes.length} not drawn` : '');
    }
    if (ch.overlap.length) add('overlap', ch.at, ch.overlap[0]);
    if (ch.covers.length) add('covers-control', ch.at, ch.covers.join(', '));
    if (ch.badName) add('name', ch.at, `its name "${ch.badName}" does not start with Close`);
  }
  return out;
};

// One toggle: open, look, nested ones, its close, fold again. Returns false when the page must be loaded again.
async function testToggle(page, ctx, cand, d) {
  const t = { route: ctx.route, width: ctx.width, label: cand.label, near: cand.near, depth: d, openAtLoad: cand.state === 'true', notes: [], hits: [] };
  ctx.tests.push(t);
  ctx.budget -= 1;
  let aim = await page.evaluate((sig, dd, w) => window.__folds.select(sig, dd, w), cand.sig, d, d ? d - 1 : null);
  if (!aim.found) {
    t.notes.push('not found again');
    return false;
  }
  if (t.openAtLoad) {
    // Fold it first, so its opening can be watched like any other.
    await clickAt(page, aim, d);
    await settle(page, d, 1500);
    if ((await page.evaluate((dd) => window.__folds.state(dd), d)) !== 'false') {
      t.notes.push('would not fold to be opened again');
      return false;
    }
    aim = await page.evaluate((dd) => window.__folds.aim(dd), d);
  }
  const before = await page.evaluate(() => ({ dialogs: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length, url: location.pathname + location.search }));
  await page.evaluate((dd) => window.__folds.watch(dd), d);
  await clickAt(page, aim, d);
  await settle(page, d);
  if ((await page.evaluate((dd) => window.__folds.connected(dd) && window.__folds.state(dd), d)) === 'false') {
    // Once more: the page may have drawn the toggle again just as it was pressed.
    const again = await page.evaluate((dd) => window.__folds.aim(dd), d);
    if (again.found) {
      t.notes.push('opened on the second press');
      await page.evaluate((dd) => window.__folds.watch(dd), d);
      await clickAt(page, again, d);
      await settle(page, d);
    }
  }
  const a = await page.evaluate((dd) => window.__folds.assess(dd), d);
  t.how = a.how;
  if (a.dialogs > before.dialogs) {
    t.notes.push('opened a popup');
    await page.keyboard.press('Escape');
    await sleep(600);
    return false;
  }
  if (a.url !== before.url) {
    t.notes.push(`went to ${a.url}`);
    return false;
  }
  if (a.expanded !== 'true') {
    t.notes.push(a.expanded === 'gone' ? 'one way: the toggle went' : 'one way: aria-expanded stayed false');
    return false;
  }
  if (a.popover) t.notes.push('popover: what it opens is laid over the page');
  if (a.how === 'none') t.notes.push('nothing grew that could be found');
  await page.evaluate((dd) => window.__folds.scrollMid(dd), d);
  await frames(page);
  await sleep(120);
  const mid = await page.evaluate((dd) => window.__folds.check(dd, 'mid'), d);
  Object.assign(t, { total: mid.total, room: mid.room, tall: mid.tall && !a.popover, root: mid.root, g: mid.g, bars: mid.bars, rail: mid.rail });
  const checks = [mid];
  if (t.tall) {
    await page.evaluate((dd) => window.__folds.scrollFoot(dd), d);
    await frames(page);
    await sleep(120);
    checks.push(await page.evaluate((dd) => window.__folds.check(dd, 'foot'), d));
    // The toggle's line low on the screen: the close at rest beside it, in Back to top's band (200ms covers Back to top's 160ms fade).
    await page.evaluate((dd) => window.__folds.scrollLow(dd), d);
    await frames(page);
    await sleep(200);
    const low = await page.evaluate((dd) => window.__folds.check(dd, 'low'), d);
    checks.push(low);
    t.lowBtt = Boolean(low.btt);
    if (low.bttBlocked) t.notes.push('Back to top held back: a privacy or terms dialog is still on the page');
    if (low.closes.some((c) => c.under)) t.notes.push("low: the close rests under the assistant's button until the page is scrolled");
    t.checks = checks;
    t.hits.push(...kindsOf(checks));
  } else {
    const shownClose = mid.closes.find((c) => c.state === 'ok');
    if (shownClose) t.hits.push({ kind: 'extra', at: ['mid'], detail: `"${shownClose.label}" shows on a short one` });
  }
  // The toggles inside what it opened (one level), while it stays open.
  if (d === 0 && !a.popover) {
    // Open ones too (a fold that opens with its parts open): each is tested as one open at load. Under a toggle that was open at load,
    // what was on the page then was tested at the top level already.
    const kids = (await page.evaluate(() => window.__folds.candidates(0))).filter((k) => !(t.openAtLoad && ctx.topLabels.has(k.label)));
    for (const k of kids) {
      if (ctx.nestedBudget <= 0 || ctx.budget <= 0) {
        ctx.dropped.nested += 1;
        continue;
      }
      ctx.nestedBudget -= 1;
      if ((await page.evaluate(() => window.__folds.state(0))) !== 'true') {
        t.notes.push('folded while its inner toggles were tested');
        return false;
      }
      const ok = await testToggle(page, ctx, { ...k, label: `${cand.label} › ${k.label}` }, 1).catch((e) => {
        ctx.tests.at(-1)?.notes.push(`error: ${String(e.message).slice(0, 120)}`);
        return false;
      });
      if (!ok) return false;
    }
  }
  // Its close, from the foot: folds the toggle, hands it focus, leaves it in view.
  if (t.tall) {
    await page.evaluate((dd) => window.__folds.scrollFoot(dd), d);
    await frames(page);
    await sleep(120);
    const pick = await page.evaluate((dd) => window.__folds.pickClose(dd), d);
    if (pick) {
      if (pick.real) {
        await page.mouse.click(pick.x, pick.y);
        await page.mouse.move(Math.round(page.viewport().width / 2), 0);
      } else {
        t.notes.push('close pressed by its own click (no clear spot to tap)');
        await page.evaluate((dd) => window.__folds.domClickClose(dd), d);
      }
      await settle(page, d, 1500);
      await frames(page);
      const after = await page.evaluate((dd) => window.__folds.afterClose(dd), d);
      t.afterClose = after;
      if (after.expanded === 'true') t.hits.push({ kind: 'no-collapse', at: ['close'], detail: 'still aria-expanded="true"' });
      else {
        if (!after.focus) t.hits.push({ kind: 'focus', at: ['close'], detail: `focus on ${after.active}` });
        if (!after.inView) t.hits.push({ kind: 'off-view', at: ['close'], detail: `toggle at ${after.top}px, top bar ${after.chromeTop}px` });
      }
    }
  }
  // Back as it was: folded (or open again, for one that was open at load).
  const want = t.openAtLoad ? 'true' : 'false';
  for (let i = 0; i < 2; i += 1) {
    const now = await page.evaluate((dd) => window.__folds.state(dd), d);
    if (now === want) break;
    if (now === 'gone') return false;
    const back = await page.evaluate((dd) => window.__folds.aim(dd), d);
    if (!back.found) return false;
    await clickAt(page, back, d);
    await settle(page, d, 2000);
  }
  return (await page.evaluate((dd) => window.__folds.state(dd), d)) === want;
}

async function runPage(page, ctx, load) {
  await load();
  const start = Date.now();
  const rest = await page.evaluate(() => window.__folds.fingerprint());
  const all = await page.evaluate(() => window.__folds.candidates(null));
  // Daily's task cards are one kind: a few of them say what the rest would.
  let rows = 0;
  const list = all.filter((c) => {
    if (!c.row) return true;
    rows += 1;
    if (rows > ROWS) ctx.dropped.rows += 1;
    return rows <= ROWS;
  });
  ctx.found = all.length;
  ctx.topLabels = new Set(all.map((c) => c.label));
  const top = list.slice(0, CAP);
  ctx.dropped.top += list.length - top.length;
  ctx.budget = CAP;
  ctx.nestedBudget = Math.max(0, CAP - top.length);
  for (const cand of top) {
    if (Date.now() - start > JOB_MS) {
      ctx.dropped.time += 1;
      continue;
    }
    let ok = false;
    try {
      ok = await testToggle(page, ctx, cand, 0);
    } catch (e) {
      ctx.tests.at(-1)?.notes.push(`error: ${String(e.message).slice(0, 160)}`);
      ctx.errors.push(`${cand.label}: ${String(e.message).slice(0, 160)}`);
    }
    const now = ok ? await page.evaluate(() => window.__folds?.fingerprint()).catch(() => null) : null;
    if (!ok || now !== rest) {
      ctx.reloads += 1;
      await load();
      const again = await page.evaluate(() => window.__folds.fingerprint()).catch(() => null);
      if (again !== rest) ctx.notes.push(`after a reload the page was not as it loaded (${String(again).slice(0, 80)})`);
    }
  }
}

function newCtx(route, width) {
  return { route, width, tests: [], errors: [], notes: [], reloads: 0, found: 0, dropped: { top: 0, nested: 0, rows: 0, time: 0 }, budget: CAP, nestedBudget: 0 };
}

async function openPage(browser, width, height, session) {
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': `10.91.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
  const phone = width < 768;
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: THEME },
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ]);
  await page.evaluateOnNewDocument(
    (t, mode, v) => {
      try {
        if (t) localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 }));
        else localStorage.removeItem('kreators.session');
        localStorage.setItem('kreators.theme', JSON.stringify({ state: { mode }, version: 0 }));
        // The privacy card answered as Reject all would (lib/consent.ts's shape), so it is never drawn and Back to top can show.
        localStorage.setItem('kreators.consent', JSON.stringify({ v, decided: true, choices: { attribution: false, embeds: false, marketing: false } }));
      } catch {
        // storage may be blocked
      }
    },
    session ? token : null,
    THEME,
    CONSENT_VERSION,
  );
  return page;
}

const jobs = [];
for (const [width, height] of WIDTHS) for (const shot of routes) jobs.push({ kind: 'route', shot, width, height });
// FOLDS_ROUTES matches a popup as `popup:<key>` (popup:week-plan).
if (POPUPS) for (const [width, height] of WIDTHS) for (const c of CASES) if (!((c.min && width < c.min) || (c.max && width > c.max)) && (!ROUTES || ROUTES.test(`popup:${c.key}`))) jobs.push({ kind: 'popup', c, width, height });

const results = [];
let next = 0;
let done = 0;
const t0 = Date.now();
async function worker() {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-first-run', '--disable-gpu'] });
  try {
    // A service worker from an older build never answers for this one.
    const first = await browser.newPage();
    await first.goto(`${ORIGIN}/`, { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    await first
      .evaluate(async () => {
        for (const r of (await navigator.serviceWorker?.getRegistrations?.()) ?? []) await r.unregister();
        for (const k of await caches.keys()) await caches.delete(k);
      })
      .catch(() => {});
    await first.close();
    while (next < jobs.length) {
      const job = jobs[next++];
      const route = job.kind === 'route' ? job.shot.path : `popup:${job.c.key}`;
      const ctx = newCtx(route, `${job.width}x${job.height}`);
      const started = Date.now();
      let page;
      try {
        page = await openPage(browser, job.width, job.height, job.kind === 'popup' || job.shot.needsSession);
        if (job.kind === 'route') await runPage(page, ctx, () => loadRoute(page, job.shot.path));
        else {
          // runPage's first load opens it (opening it here as well opened every popup twice, and an `optional` one that depends on chance,
          // such as the card table's Read all, which shows only when a dealt card is cut, then failed the second time as a page error).
          let opened = false;
          try {
            await runPage(page, ctx, async () => {
              if (await reopenPopup(page, job.c)) {
                opened = true;
                return;
              }
              throw new Error(opened ? 'popup did not open again' : 'popup did not open');
            });
          } catch (e) {
            // An optional case that did not open (or not again) is a note, as drive-popups.mjs treats it; any other is an error.
            if (!(job.c.optional && /did not open/.test(String(e?.message)))) throw e;
            ctx.notes.push(`${e.message} (optional: it depends on what the page shows)`);
          }
        }
      } catch (e) {
        ctx.errors.push(`page: ${String(e.message).slice(0, 200)}`);
      } finally {
        await page?.close().catch(() => {});
      }
      results.push(ctx);
      done += 1;
      const tall = ctx.tests.filter((t) => t.tall).length;
      const hits = ctx.tests.reduce((n, t) => n + t.hits.filter((h) => h.kind !== 'extra').length, 0);
      const drop = Object.entries(ctx.dropped)
        .filter(([, v]) => v)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ');
      process.stderr.write(`[${done}/${jobs.length}] ${route} ${ctx.width}: ${ctx.tests.length} tested of ${ctx.found}, ${tall} tall, ${hits} hits${drop ? `, dropped ${drop}` : ''}${ctx.errors.length ? `, ${ctx.errors.length} errors` : ''} (${Math.round((Date.now() - started) / 1000)}s)\n`);
    }
  } finally {
    await browser.close();
  }
}
await Promise.all(Array.from({ length: Math.min(PARALLEL, jobs.length) }, worker));

// ---------------------------------------------------------------------------------------------------------------------------------------
const order = new Map(jobs.map((j, i) => [`${j.kind === 'route' ? j.shot.path : `popup:${j.c.key}`} ${j.width}x${j.height}`, i]));
results.sort((a, b) => (order.get(`${a.route} ${a.width}`) ?? 0) - (order.get(`${b.route} ${b.width}`) ?? 0));
const tests = results.flatMap((r) => r.tests);
const hits = tests.flatMap((t) => t.hits.map((h) => ({ kind: h.kind, route: t.route, width: t.width, label: t.label, near: t.near, root: t.root ?? t.g, total: t.total, room: t.room, near24: t.total - t.room < 24, at: h.at.join(','), detail: h.detail })));
const fails = hits.filter((h) => FAIL.includes(h.kind));
for (const h of hits) {
  // "(by Npx)": only just taller than the room, where a few pixels of measuring decide.
  console.log(`${h.kind.padEnd(14)} ${h.route} ${h.width}  "${h.label}"${h.near ? ` (under "${h.near}")` : ''}  ${h.root ?? '?'}  ${h.total} vs ${h.room}${h.near24 ? ` (by ${h.total - h.room}px)` : ''}  [${h.at}]${h.detail ? `  ${h.detail}` : ''}`);
}
const byKind = {};
for (const h of hits) byKind[h.kind] = (byKind[h.kind] ?? 0) + 1;
const dropped = { top: 0, nested: 0, rows: 0, time: 0 };
for (const r of results) for (const k of Object.keys(dropped)) dropped[k] += r.dropped[k];
const notes = {};
for (const t of tests) for (const n of t.notes) notes[n.replace(/".*"|\d+/g, '…').slice(0, 60)] = (notes[n.replace(/".*"|\d+/g, '…').slice(0, 60)] ?? 0) + 1;
const errors = results.flatMap((r) => r.errors.map((e) => `${r.route} ${r.width}: ${e}`));
console.log(`\n${results.length} pages, ${tests.length} toggles tested (${tests.filter((t) => t.depth).length} inside another), ${tests.filter((t) => t.tall).length} tall, ${results.reduce((n, r) => n + r.reloads, 0)} reloads, ${Math.round((Date.now() - t0) / 1000)}s`);
console.log(`hits by kind: ${Object.keys(byKind).length ? Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(', ') : 'none'}`);
for (const [w] of WIDTHS.map((x) => [x.join('x')])) {
  const row = {};
  for (const h of hits.filter((x) => x.width === w)) row[h.kind] = (row[h.kind] ?? 0) + 1;
  console.log(`  ${w}: ${tests.filter((t) => t.width === w).length} tested, ${tests.filter((t) => t.width === w && t.tall).length} tall, ${Object.entries(row).map(([k, v]) => `${k} ${v}`).join(', ') || 'no hits'}`);
}
// Proof the run saw Back to top at all: it shows only past a screen of scrolling, so a toggle near a page's top never meets it, and it
// steps aside under every popup, so only the pages' looks count.
const lows = tests.filter((t) => 'lowBtt' in t && !t.route.startsWith('popup:'));
if (lows.length) console.log(`Back to top drawn in ${lows.filter((t) => t.lowBtt).length} of ${lows.length} low looks${lows.some((t) => t.lowBtt) ? '' : ' (none: is a privacy or terms dialog still up?)'}`);
if (Object.values(dropped).some(Boolean)) console.log(`not tested: ${dropped.top} past the cap of ${CAP}, ${dropped.nested} inside others past the cap, ${dropped.rows} task cards past ${ROWS} a page, ${dropped.time} past the time limit`);
if (Object.keys(notes).length) console.log(`notes: ${Object.entries(notes).map(([k, v]) => `${k} (${v})`).join('; ')}`);
if (errors.length) {
  console.log(`${errors.length} errors:`);
  for (const e of errors) console.log(`  ${e}`);
}
if (process.env.FOLDS_JSON) fs.writeFileSync(process.env.FOLDS_JSON, JSON.stringify({ origin: ORIGIN, widths: WIDTHS, cap: CAP, rows: ROWS, byKind, dropped, errors, hits, tests, pages: results.map(({ tests: _t, ...r }) => r) }, null, 1));
process.exit(fails.length || errors.length ? 1 : 0);
