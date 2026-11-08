// "On this page" (components/PageContents.tsx) in a real browser, against the smoke server. It opens pages at laptop width, walks each down
// the page to see whether any word or control ever sits under the dashes, hovers, clicks a row and a dash, uses the keyboard, and reads where
// the heading landed. Then the places it must stay away from. The last line is a count of problems, which must be 0.
//
//   node scripts/smoke/drive-contents.mjs
//
//   CONTENTS_ORIGIN=http://127.0.0.1:8788   another server
//   SHOOT_TOKEN=<session token>             an account (default: scripts/smoke/state/shoot-token, from shots-all.mjs)
//   CONTENTS_WIDTHS=1280,1440               the widths
//   CONTENTS_THEME=light|dark               default light
//   CONTENTS_PAGES=/home,/today,/privacy    the pages (default a few of each kind)
//   CONTENTS_ROOM_ONLY=1                    only the walk under the dashes, for a long list of pages at many widths
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const ORIGIN = process.env.CONTENTS_ORIGIN ?? 'http://127.0.0.1:8788';
const TOKEN = process.env.SHOOT_TOKEN ?? fs.readFileSync(new URL('./state/shoot-token', import.meta.url), 'utf8').trim();
const WIDTHS = (process.env.CONTENTS_WIDTHS ?? '1280').split(',').map(Number);
const THEME = process.env.CONTENTS_THEME ?? 'light';
const PAGES = (process.env.CONTENTS_PAGES ?? '/home,/today,/help,/insights,/you,/privacy,/,/features').split(',');
// An `&` in a page's address is fine here: the list is split on commas only.
const ROOM_ONLY = process.env.CONTENTS_ROOM_ONLY === '1';
const HEIGHT = 800;
const BUTTON = '.page-contents button[aria-label="On this page"]';

const problems = [];
let walked = 0;
let shownOn = 0;
const worst = { rest: 99, now: 99 };
const say = (where, what) => problems.push(`${where}: ${what}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: process.env.SHOOT_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run'] });

async function open(path, width, height = HEIGHT, session = true) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  await page.evaluateOnNewDocument(
    (t, theme, signedIn) => {
      if (signedIn) localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 }));
      localStorage.setItem('kreators.theme', JSON.stringify({ state: { mode: theme }, version: 0 }));
      // Counts the passes that read the page's headings (see the clock check).
      const q = Element.prototype.querySelectorAll;
      window.__contentsPasses = 0;
      Element.prototype.querySelectorAll = function (s) {
        if (s === 'h1, h2, h3') window.__contentsPasses += 1;
        return q.call(this, s);
      };
    },
    TOKEN,
    THEME,
    session,
  );
  await page.goto(`${ORIGIN}${path}`, { waitUntil: 'networkidle0', timeout: 30000 });
  return page;
}

async function waitButton(page, ms = 8000) {
  try {
    await page.waitForSelector(BUTTON, { timeout: ms });
    return true;
  } catch {
    return false;
  }
}

/** Everything the dashes' button sits on: words (from their own rects) and controls. */
const underButton = () => {
  const btn = document.querySelector('.page-contents button[aria-label="On this page"]');
  if (!btn) return [];
  const b = btn.getBoundingClientRect();
  const hit = (r) => r.width > 0 && r.height > 0 && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
  // What a scroller inside the page has cut off (a wide table's far columns) is not on screen, whatever its rect says.
  const showing = (el) => {
    for (let up = el.parentElement; up && up !== document.body; up = up.parentElement) {
      const cs = getComputedStyle(up);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const box = up.getBoundingClientRect();
      if (box.right <= b.left || box.left >= b.right || box.bottom <= b.top || box.top >= b.bottom) return false;
    }
    return true;
  };
  const out = [];
  const range = document.createRange();
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const el = n.parentElement;
    if (!n.data.trim() || !el || el.closest('.page-contents, .sr-only, [inert], script, style, svg')) continue;
    range.selectNodeContents(n);
    if ([...range.getClientRects()].some(hit)) {
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'hidden' && cs.display !== 'none' && showing(el)) out.push(`word "${n.data.trim().slice(0, 30)}"`);
    }
  }
  for (const el of document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]')) {
    if (el.closest('.page-contents, [inert]')) continue;
    if (hit(el.getBoundingClientRect()) && showing(el)) out.push(`control <${el.tagName.toLowerCase()}> "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}"`);
  }
  return out;
};

/** Walks down the page, a good part of a screen at a time. */
async function walkUnder(page, where) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  let steps = 0;
  const seen = new Set();
  for (let y = 0; steps < 60; y += HEIGHT * 0.45, steps += 1) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
    await sleep(40);
    for (const hit of await page.evaluate(underButton)) seen.add(hit);
    if (y > height) break;
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  for (const hit of seen) say(where, `${hit} sits under the dashes`);
  return steps;
}

/** Waits for a smooth scroll to end. */
async function settled(page) {
  let last = -1;
  for (let i = 0; i < 60; i += 1) {
    const y = await page.evaluate(() => window.scrollY);
    if (y === last) return y;
    last = y;
    await sleep(120);
  }
  return last;
}

/** Where a heading of this name sits, and where it belongs: 16px under the top bar, unless the page ends first. */
const landing = (name) => {
  const clean = (s) => s.replace(/\s+/g, ' ').trim();
  const h = [...document.querySelectorAll('main h1, main h2, main h3')].find((x) => clean(x.dataset.contents ?? x.innerText) === name);
  if (!h) return null;
  const condensed = document.querySelector('.fx-condensed')?.getBoundingClientRect().height ?? 0;
  const head = document.querySelector('.fx-header');
  const site = head && getComputedStyle(head).position === 'sticky' ? head.getBoundingClientRect().height : 0;
  const bar = Math.max(condensed, site);
  const page = document.documentElement;
  return { top: Math.round(h.getBoundingClientRect().top), bar: Math.round(bar), atEnd: window.scrollY + window.innerHeight >= page.scrollHeight - 2, atTop: window.scrollY < 2, tag: h.tagName };
};

function checkLanding(where, what, spot) {
  if (!spot) return say(where, `${what}: the heading was not found`);
  const want = spot.bar + 16;
  if (Math.abs(spot.top - want) > 4 && !spot.atEnd && !spot.atTop) say(where, `${what}: the heading landed at ${spot.top}, wanted ${want}`);
  if (spot.top < spot.bar && !spot.atTop) say(where, `${what}: the heading is under the top bar (${spot.top} against ${spot.bar})`);
}

/** Reads the dashes from pixels: each dash against the wash just above it, over the screenshot itself. */
// Made before any page it reads, so that page stays the one in front (a tab behind it would never finish a scroll or a click).
const canvasPage = await browser.newPage();
async function dashContrast(page) {
  const dashes = await page.evaluate(() =>
    [...document.querySelectorAll('.pc-slot')].map((slot) => {
      const r = slot.querySelector('.pc-dash').getBoundingClientRect();
      return { x: Math.round(r.right - 3), y: Math.round(r.top), now: slot.hasAttribute('data-now') };
    }),
  );
  const shot = await page.screenshot({ encoding: 'base64' });
  return canvasPage.evaluate(
    async (b64, list) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const at = (x, y) => [...g.getImageData(x, y, 1, 1).data].slice(0, 3);
      const lum = (rgb) => {
        const [r, b, l] = rgb.map((v) => {
          const n = v / 255;
          return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * b + 0.0722 * l;
      };
      const ratio = (a, b) => {
        const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p);
        return (hi + 0.05) / (lo + 0.05);
      };
      const rest = [];
      const now = [];
      for (const d of list) (d.now ? now : rest).push(ratio(at(d.x, d.y), at(d.x, d.y - 3)));
      return { rest: Math.min(...rest), now: Math.min(...now) };
    },
    shot,
    dashes,
  );
}

const cardState = () => {
  const btn = document.querySelector('.page-contents button[aria-label="On this page"]');
  const card = document.querySelector('.pc-card');
  const b = btn.getBoundingClientRect();
  const c = card.getBoundingClientRect();
  const assistant = document.querySelector('button[aria-label="Open the assistant"]')?.getBoundingClientRect();
  const rows = [...card.querySelectorAll('.pc-row')];
  return {
    open: card.hasAttribute('data-open'),
    expanded: btn.getAttribute('aria-expanded'),
    leftOfDashes: c.right <= b.left + 1,
    cardWidth: Math.round(c.width),
    cardBottom: Math.round(c.bottom),
    screen: window.innerHeight,
    assistantTop: assistant ? Math.round(assistant.top) : null,
    names: rows.map((r) => r.textContent),
    rowHeights: [...new Set(rows.map((r) => Math.round(r.getBoundingClientRect().height)))],
    current: rows.findIndex((r) => r.hasAttribute('aria-current')),
    pointed: rows.findIndex((r) => r.hasAttribute('data-pointed')),
    btnWidth: Math.round(b.width),
    btnHeight: Math.round(b.height),
    btnTop: Math.round(b.top),
    active: document.activeElement?.tagName ?? '',
    activeInButton: document.activeElement === btn,
    activeRow: document.activeElement?.classList?.contains('pc-row') ?? false,
  };
};

async function drive(path, width) {
  const where = `${width}px ${path}`;
  const page = await open(path, width);
  try {
    if (!(await waitButton(page, ROOM_ONLY ? 1500 : 8000))) {
      // In a long walk a page may well have too few headings or no room; `shownOn` says how many had it.
      if (!ROOM_ONLY) say(where, 'no dashes on this page');
      return;
    }
    shownOn += 1;
    await walkUnder(page, where);
    if (ROOM_ONLY) return;

    const url = page.url();
    const history = await page.evaluate(() => history.length);
    const rest = await page.evaluate(cardState);
    if (rest.open) say(where, 'the card is open at rest');
    if (rest.btnWidth < 44 || rest.btnHeight < 44) say(where, `the button is ${rest.btnWidth} by ${rest.btnHeight}`);
    const box = await (await page.$(BUTTON)).boundingBox();
    const ink = await dashContrast(page);
    worst.rest = Math.min(worst.rest, ink.rest);
    worst.now = Math.min(worst.now, ink.now);
    if (ink.rest < 3) say(where, `a quiet dash reads ${ink.rest.toFixed(2)}:1 against the wash, under 3:1`);

    // Tab from the page's start (before any click moves where Tab starts from) reaches it before the page's own controls: at most the site's
    // header and the skip link stand before it.
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.activeElement?.blur?.();
    });
    let tabs = 1;
    for (; tabs <= 12; tabs += 1) {
      await page.keyboard.press('Tab');
      if (await page.evaluate((b) => document.activeElement === document.querySelector(b), BUTTON)) break;
    }
    if (tabs > 12) say(where, 'more than 12 Tabs to reach the button');
    if ((await page.evaluate(() => window.scrollY)) > 2) say(where, 'Tab walked down the page on the way to the button');
    await page.evaluate(() => document.activeElement?.blur?.());

    // Hover: the card opens to the left, over nothing it should not cover.
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await sleep(450);
    const hover = await page.evaluate(cardState);
    if (!hover.open) say(where, 'hovering did not open the card');
    if (!hover.leftOfDashes) say(where, 'the card is not to the left of the dashes');
    if (hover.cardWidth > 280) say(where, `the card is ${hover.cardWidth} wide`);
    if (hover.assistantTop !== null && hover.cardBottom > hover.assistantTop) say(where, `the card reaches the assistant's button (${hover.cardBottom} against ${hover.assistantTop})`);
    if (hover.cardBottom > hover.screen) say(where, 'the card runs off the screen');
    if (hover.current < 0) say(where, 'no row is marked current');
    if (hover.rowHeights.some((h) => h < 32)) say(where, `a row is under 32px: ${hover.rowHeights}`);

    // A row, by mouse: the heading lands under the bar, the address and the history stay, the focus does not move to the heading.
    const k = Math.floor(hover.names.length * 0.6);
    const row = (await page.$$('.pc-row'))[k];
    await row.hover();
    await sleep(80);
    await row.click();
    await settled(page);
    checkLanding(where, `row "${hover.names[k]}"`, await page.evaluate(landing, hover.names[k]));
    const after = await page.evaluate(cardState);
    if (!after.open) say(where, 'a click on a row closed the card under the mouse');
    if (/^H[123]$/.test(after.active)) say(where, 'a mouse moved focus to the heading');
    // However near the page's end it sits, and whatever stands level with it: what was asked for is what is lit.
    if (after.current !== k) say(where, `the row for "${hover.names[k]}" is not current after going there (row ${after.current})`);

    // Leaving closes it after a short wait; crossing the gap back does not.
    await page.mouse.move(width / 2, 400);
    await sleep(100);
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await sleep(300);
    if (!(await page.evaluate(cardState)).open) say(where, 'the card closed while the pointer came back');
    await page.mouse.move(width / 2, 400);
    await sleep(450);
    if ((await page.evaluate(cardState)).open) say(where, 'the card stayed open after the mouse left');

    // A dash, by mouse: pointing lights its row, a click goes there.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const j = Math.floor(hover.names.length / 2);
    const dash = await page.evaluate((n) => {
      const r = document.querySelectorAll('.pc-slot')[n].getBoundingClientRect();
      return { x: r.right - 10, y: r.top + r.height / 2 };
    }, j);
    await page.mouse.move(dash.x, dash.y);
    await sleep(450);
    const lit = await page.evaluate(cardState);
    if (lit.pointed !== j) say(where, `pointing at dash ${j} lit row ${lit.pointed}`);
    await page.mouse.click(dash.x, dash.y);
    await settled(page);
    checkLanding(where, `dash "${hover.names[j]}"`, await page.evaluate(landing, hover.names[j]));
    await page.mouse.move(width / 2, 400);
    await sleep(450);

    // The keyboard: Enter opens, Tab goes in, Enter goes there with focus on the heading, Escape from the card hands focus back.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.focus(BUTTON);
    await page.keyboard.press('Enter');
    await sleep(240);
    if (!(await page.evaluate(cardState)).open) say(where, 'Enter did not open the card');
    if ((await page.evaluate(cardState)).expanded !== 'true') say(where, 'aria-expanded did not follow');
    await page.keyboard.press('Tab');
    if (!(await page.evaluate(cardState)).activeRow) say(where, 'Tab did not reach the first row');
    await page.keyboard.press('Tab');
    const second = await page.evaluate(() => document.activeElement?.textContent ?? '');
    await page.keyboard.press('Enter');
    await settled(page);
    const kb = await page.evaluate(cardState);
    if (kb.open) say(where, 'the card stayed open after a keyboard row');
    if (!/^H[123]$/.test(kb.active)) say(where, `a keyboard row left focus on <${kb.active}>, not the heading`);
    checkLanding(where, `keyboard row "${second}"`, await page.evaluate(landing, second));
    await page.focus(BUTTON);
    await page.keyboard.press('Enter');
    await sleep(240);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    await sleep(240);
    const esc = await page.evaluate(cardState);
    if (esc.open) say(where, 'Escape did not close the card');
    if (!esc.activeInButton) say(where, 'Escape did not hand focus back to the button');

    if (page.url() !== url) say(where, `the address changed to ${page.url()}`);
    if ((await page.evaluate(() => history.length)) !== history) say(where, 'the history grew');
  } finally {
    await page.close();
  }
}

/** The places it stays away from. */
async function stayAway() {
  for (const path of ['/onboarding', '/session', '/vibe-check']) {
    const page = await open(path, 1280);
    await sleep(1200);
    if (await page.$(BUTTON)) say(`1280px ${path}`, 'dashes on a whole-page chat');
    await page.close();
  }
  // A phone, upright and on its side: nothing shown, and the chunk never downloaded.
  for (const [w, h] of [[390, 844], [844, 390]]) {
    const page = await browser.newPage();
    const asked = [];
    page.on('request', (r) => {
      if (/PageContents/.test(r.url())) asked.push(r.url());
    });
    await page.setViewport({ width: w, height: h });
    await page.goto(`${ORIGIN}/privacy`, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(800);
    if (await page.$(BUTTON)) say(`${w}x${h} /privacy`, 'dashes on a phone');
    if (asked.length) say(`${w}x${h} /privacy`, 'a phone downloaded the chunk');
    await page.close();
  }
  // A page with one heading shows nothing, never an empty button.
  const one = await open('/apps', 1280);
  await sleep(1200);
  if (await one.$(BUTTON)) say('1280px /apps', 'dashes on a page with one heading');
  await one.close();
  // A tab switch changes the rows; a page change closes the card.
  const run = await open('/run', 1280);
  await waitButton(run);
  const dashCount = () => run.evaluate(() => document.querySelectorAll('.pc-slot').length);
  const before = await dashCount();
  const tab = await run.evaluateHandle(() => [...document.querySelectorAll('main button, main a')].find((b) => b.textContent.includes('collabs') && b.getBoundingClientRect().width > 0));
  if (tab.asElement()) await tab.asElement().click();
  else say('1280px /run', 'could not find the tab');
  await sleep(1500);
  const after = await dashCount();
  if (before === after) say('1280px /run', `a tab switch left the dashes at ${after}`);
  await run.focus(BUTTON);
  await run.keyboard.press('Enter');
  await sleep(240);
  const daily = await run.evaluateHandle(() => [...document.querySelectorAll('nav[aria-label="Main"] a')].find((a) => a.getAttribute('href') === '/today' && a.getBoundingClientRect().width > 0));
  await daily.asElement().click();
  await sleep(1500);
  if (await run.evaluate(() => document.querySelector('.pc-card')?.hasAttribute('data-open') ?? false)) say('1280px /run', 'a page change left the card open');
  await run.close();
  // A touch tablet: a tap opens the card, its rows are 44px, a tap on a row goes there and closes it, a tap outside closes it.
  const touch = await open('/privacy', 1280);
  await touch.setViewport({ width: 1280, height: HEIGHT, hasTouch: true });
  const touchCdp = await touch.createCDPSession();
  await touchCdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }] });
  await touch.reload({ waitUntil: 'networkidle0' });
  await waitButton(touch);
  const tapBox = await (await touch.$(BUTTON)).boundingBox();
  await touch.touchscreen.tap(tapBox.x + 22, tapBox.y + 20);
  await sleep(300);
  const tapped = await touch.evaluate(cardState);
  if (!tapped.open) say('touch /privacy', 'a tap did not open the card');
  if (tapped.rowHeights.some((h) => h < 44)) say('touch /privacy', `a row is under 44px on touch: ${tapped.rowHeights}`);
  console.log(`touch: rows ${tapped.rowHeights.join(', ')}px`);
  const tapRow = await (await touch.$$('.pc-row'))[6].boundingBox();
  await touch.touchscreen.tap(tapRow.x + 40, tapRow.y + tapRow.height / 2);
  await settled(touch);
  if ((await touch.evaluate(cardState)).open) say('touch /privacy', 'a tap on a row left the card open');
  checkLanding('touch /privacy', `row "${tapped.names[6]}"`, await touch.evaluate(landing, tapped.names[6]));
  await touch.touchscreen.tap(tapBox.x + 22, tapBox.y + 20);
  await sleep(300);
  await touch.touchscreen.tap(500, 500);
  await sleep(300);
  if ((await touch.evaluate(cardState)).open) say('touch /privacy', 'a tap outside left the card open');
  await touch.close();
  // Under a sheet's scrim, off printed paper, and under reduced motion a row goes there at once.
  const page = await open('/privacy', 1280);
  await waitButton(page);
  const z = await page.evaluate(() => Number(getComputedStyle(document.querySelector('.page-contents')).zIndex));
  if (!(z < 40)) say('z-index', `${z} is not under the sheets' scrim (40)`);
  await page.emulateMediaType('print');
  if ((await page.evaluate(() => getComputedStyle(document.querySelector('.page-contents')).display)) !== 'none') say('print', 'the dashes print');
  await page.emulateMediaType('screen');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const still = await (await page.$(BUTTON)).boundingBox();
  await page.mouse.move(still.x + 22, still.y + 12);
  await sleep(400);
  const stillRows = await page.$$('.pc-row');
  const stillName = await stillRows[12].evaluate((r) => r.textContent);
  await stillRows[12].hover();
  await page.mouse.down();
  await page.mouse.up();
  await sleep(60);
  checkLanding('reduced motion /privacy', `row "${stillName}"`, await page.evaluate(landing, stillName));
  await page.close();
  // The assistant's panel sits in the same corner, so the dashes step aside while it is open.
  const talk = await open('/today', 1280);
  await waitButton(talk);
  await (await talk.$('button[aria-label="Open the assistant"]')).click();
  await talk.waitForSelector('[data-assistant-panel]', { timeout: 8000 });
  if ((await talk.evaluate(() => getComputedStyle(document.querySelector('.page-contents')).display)) !== 'none') say('/today', 'the dashes stay under the assistant');
  await talk.close();
  // A long card: pointing at a dash low down brings its row into sight, moving onto the card leaves it there, and a click on a row never moves
  // the rows under the mouse while the page goes there.
  const long = await open('/privacy', 1280);
  await waitButton(long);
  const low = await long.evaluate(() => {
    const r = document.querySelectorAll('.pc-slot')[24].getBoundingClientRect();
    return { x: r.right - 12, y: r.top + r.height / 2 };
  });
  await long.mouse.move(low.x, low.y);
  await sleep(400);
  const scrolled = await long.evaluate(() => document.querySelector('.pc-card').scrollTop);
  if (!(scrolled > 0)) say('/privacy', 'pointing at a low dash did not bring its row into sight');
  const onCard = await long.evaluate(() => {
    const row = document.querySelectorAll('.pc-row')[24].getBoundingClientRect();
    return { x: row.x + 40, y: row.y + row.height / 2 };
  });
  await long.mouse.move(onCard.x, onCard.y, { steps: 5 });
  await sleep(300);
  const kept = await long.evaluate(() => document.querySelector('.pc-card').scrollTop);
  if (kept !== scrolled) say('/privacy', `moving from a dash to the card scrolled the card from ${scrolled} to ${kept}`);
  await long.mouse.down();
  await long.mouse.up();
  await settled(long);
  if ((await long.evaluate(() => document.querySelector('.pc-card').scrollTop)) !== scrolled) say('/privacy', 'a click on a row moved the rows under the mouse');
  await long.mouse.move(640, 500);
  await sleep(450);
  // Having gone there, a row never pulls the window back once it has moved on, even by a scroll no input event announced: the last row twice,
  // so the second click has nowhere to go and no scroll to end, then a scroll from a script.
  const lastRow = await long.evaluate(() => {
    const r = document.querySelectorAll('.pc-slot');
    const b = r[r.length - 1].getBoundingClientRect();
    return { x: b.right - 12, y: b.top + b.height / 2 };
  });
  await long.mouse.move(lastRow.x, lastRow.y);
  await sleep(200);
  await long.mouse.down();
  await long.mouse.up();
  await settled(long);
  await long.mouse.down();
  await long.mouse.up();
  await sleep(100);
  await long.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await sleep(700);
  if ((await long.evaluate(() => window.scrollY)) > 2) say('/privacy', 'a row pulled the window back after a scroll');
  if ((await long.evaluate(() => [...document.querySelectorAll('.pc-slot')].findIndex((d) => d.hasAttribute('data-now')))) !== 0) say('/privacy', 'at the very top the first row is not the one being read');
  await long.mouse.move(640, 500);
  await sleep(450);
  // A heading's words changing, with nothing else in the page changing, changes its row.
  await long.evaluate(() => {
    document.querySelector('main h2').firstChild.data = 'Words changed in place';
  });
  await sleep(450);
  if (!(await long.evaluate(() => [...document.querySelectorAll('.pc-row')].some((r) => r.textContent === 'Words changed in place')))) say('/privacy', 'a heading whose words changed kept its old row');
  await long.close();
  // The privacy bar where it wraps: the card stops above it.
  const narrow = await open('/privacy', 808, 900, false);
  await waitButton(narrow);
  const nb = await (await narrow.$(BUTTON)).boundingBox();
  await narrow.mouse.move(nb.x + 22, nb.y + 12);
  await sleep(350);
  const bar = await narrow.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].find((x) => x.getAttribute('aria-modal') !== 'true' && /privacy/i.test(x.textContent));
    return { bar: d ? Math.round(d.getBoundingClientRect().top) : null, card: Math.round(document.querySelector('.pc-card').getBoundingClientRect().bottom) };
  });
  if (bar.bar !== null && bar.card > bar.bar) say('808px /privacy', `the card runs under the privacy bar (${bar.card} against ${bar.bar})`);
  await narrow.close();
  // A page that cannot scroll has no dashes, whatever its headings (the founder, 2026-11-07), and they come back once it can.
  const scrollRange = (page) => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const shortPage = await open('/companion', 1280);
  await sleep(1500);
  const range = await scrollRange(shortPage);
  const dashesOnShort = Boolean(await shortPage.$(BUTTON));
  if (range < 64 && dashesOnShort) say('/companion', `dashes on a page that can scroll only ${range}px`);
  if (range >= 64) say('/companion', `this check needs a page that cannot scroll, and this one can scroll ${range}px`);
  await shortPage.close();
  const longPage = await open('/privacy', 1280);
  if (!(await waitButton(longPage))) say('/privacy', 'no dashes on a long page');
  await longPage.close();
  // They come and go as the page does, with no reload: the same page grown long in place, as a Fold opening does, then short again.
  const grows = await open('/companion', 1280);
  await sleep(1500);
  if (((await scrollRange(grows)) < 64) && (await grows.evaluate(() => document.querySelectorAll('main h1, main h2').length)) >= 2) {
    await grows.evaluate(() => {
      const d = document.createElement('div');
      d.id = 'contents-grow';
      d.style.height = '2000px';
      document.querySelector('main').appendChild(d);
    });
    if (!(await waitButton(grows, 2000))) say('/companion', 'no dashes once the page grew long');
    await grows.evaluate(() => document.getElementById('contents-grow').remove());
    await sleep(600);
    if (await grows.$(BUTTON)) say('/companion', 'dashes stayed after the page went short again');
  }
  await grows.close();
  const books = await open('/book', 1280);
  if (!(await waitButton(books))) say('/book', 'no dashes on the books');
  await books.close();
  // The card table, however many headings it has.
  const games = await open('/cards', 1280);
  const game = await games.evaluate(() => document.querySelector('main a[href^="/cards/"]')?.getAttribute('href') ?? null);
  await games.close();
  if (game) {
    const table = await open(game, 1280);
    await sleep(1200);
    if (await table.$(BUTTON)) say(`1280px ${game}`, 'dashes on the card table');
    await table.close();
  } else {
    say('/cards', 'no game to open');
  }
  // Mindfulness: a running clock never starts a pass, and full screen takes the dashes away.
  const mf = await open('/mindful', 1280);
  await waitButton(mf);
  const start = await mf.evaluateHandle(() => [...document.querySelectorAll('.mf-panel button')].find((b) => /^(Start|Begin)/.test(b.textContent.trim()) && b.getBoundingClientRect().width > 0));
  if (start.asElement()) {
    await start.asElement().click();
    await sleep(3000);
    const before = await mf.evaluate(() => window.__contentsPasses);
    await sleep(6000);
    const passes = (await mf.evaluate(() => window.__contentsPasses)) - before;
    if (passes > 0) say('/mindful', `${passes} passes in six seconds of a running clock`);
    console.log(`clock: ${passes} passes in six seconds of a running clock`);
  } else {
    say('/mindful', 'could not find Start');
  }
  const full = await mf.$('button[aria-label*="ull screen"]');
  if (full) {
    await full.click();
    await sleep(400);
    if (await mf.$(BUTTON)) say('/mindful', 'dashes over the full-screen cover');
  } else {
    say('/mindful', 'could not find Full screen');
  }
  await mf.close();
}

for (const width of WIDTHS) {
  for (const path of PAGES) {
    await drive(path, width);
    walked += 1;
  }
}
if (!ROOM_ONLY) await stayAway();
await browser.close();
for (const p of problems.slice(0, 40)) console.log(`  ${p}`);
if (!ROOM_ONLY) console.log(`dashes from pixels, worst against the wash (${THEME}): quiet ${worst.rest.toFixed(2)}:1, the one being read ${worst.now.toFixed(2)}:1`);
console.log(`${walked} pages driven, the dashes on ${shownOn}, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
