// Browse the built app in Chrome and list every Content-Security-Policy violation (enforced or report-only).
//   bash scripts/smoke/blueprint.sh --keep
//   node --experimental-strip-types --no-warnings scripts/smoke/shots-all.mjs > shots.json
//   SHOOT_TOKEN=$(cat scripts/smoke/state/shoot-token) SHOOT_LIST=shots.json node scripts/smoke/csp-browse.mjs
// Also opens a few sheets and tries the Razorpay checkout script address. Prints one line per violation and exits 1 if there is any.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ORIGIN = process.env.SHOOT_ORIGIN ?? 'http://127.0.0.1:8788';
const token = process.env.SHOOT_TOKEN ?? '';
const list = process.env.SHOOT_LIST ? JSON.parse(fs.readFileSync(process.env.SHOOT_LIST, 'utf8')) : [{ path: '/' }, { path: '/today', needsSession: true }];

function chromePath() {
  if (process.env.SHOOT_CHROME) return process.env.SHOOT_CHROME;
  const candidates = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium'];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('no Chrome found; set SHOOT_CHROME');
  return found;
}

const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true, args: ['--no-first-run', '--disable-gpu'] });
const hits = [];
let visited = 0;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  let where = '';
  page.on('console', (m) => {
    const t = m.text();
    if (/content security policy|content-security-policy|\[report only\]/i.test(t)) hits.push(`${where}  console: ${t.slice(0, 260)}`);
  });
  await page.exposeFunction('__cspHit', (d) => hits.push(`${where}  ${d}`));
  await page.evaluateOnNewDocument(
    (t) => {
      document.addEventListener('securitypolicyviolation', (e) => window.__cspHit(`${e.disposition} ${e.violatedDirective} blocked ${e.blockedURI || '(inline)'} at ${e.sourceFile || ''}:${e.lineNumber || ''}`));
      try {
        if (t) localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 }));
      } catch {
        // storage may be blocked
      }
    },
    token || null,
  );
  for (const shot of list) {
    where = shot.path;
    await page.goto(`${ORIGIN}${shot.path}`, { waitUntil: 'networkidle0' }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 500));
    visited += 1;
  }
  // Sheets: open the first few buttons that look like they open one.
  for (const p of ['/today', '/tower', '/profile', '/shop']) {
    where = `${p} (sheets)`;
    await page.goto(`${ORIGIN}${p}`, { waitUntil: 'networkidle0' }).catch(() => undefined);
    for (let i = 0; i < 4; i += 1) {
      const clicked = await page.evaluate((n) => {
        const b = [...document.querySelectorAll('button')].filter((x) => /^(add|new|edit|plan|change|\+)/i.test((x.textContent || '').trim()))[n];
        if (!b) return false;
        b.click();
        return true;
      }, i);
      await new Promise((r) => setTimeout(r, 400));
      if (clicked) await page.keyboard.press('Escape');
    }
    visited += 1;
  }
  // The payment script path: the same element the product page adds.
  where = 'razorpay script';
  await page.evaluate(() => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    document.head.appendChild(s);
  });
  await new Promise((r) => setTimeout(r, 1500));
} finally {
  await browser.close();
}
const unique = [...new Set(hits)];
console.log(`${visited} pages browsed, ${unique.length} CSP message${unique.length === 1 ? '' : 's'}`);
for (const h of unique) console.log(`  ${h}`);
process.exitCode = unique.length ? 1 : 0;
