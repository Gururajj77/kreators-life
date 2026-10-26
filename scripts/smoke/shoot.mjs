// Screenshots of the built app, phone and laptop, light and dark, against the smoke server.
//
//   bash scripts/smoke/blueprint.sh --keep         # a server on 8788 with the latest build
//   node --experimental-strip-types scripts/smoke/shoot.mjs      # every default shot into scripts/smoke/shots
//   node --experimental-strip-types scripts/smoke/shoot.mjs /home /store   # only these routes
//
//   SHOOT_ORIGIN=http://127.0.0.1:8787   another server (it must serve the latest build)
//   SHOOT_THEME=dark|light|both          default both
//   SHOOT_MOTION=1                       keep animation on (default: reduced motion)
//   SHOOT_PROBE=scripts/smoke/contrast-probe.js   run this probe file on every shot and list its hits
//   SHOOT_LIST=shots.json                a JSON array of shots instead of the default list
//   SHOOT_CHROME=/path/to/chrome         the browser binary
//
// A shot is { path, name?, desktop?, width?, height?, theme?, needsSession?, before? }:
// a phone is 390 by 844, a laptop 1440 by 900, a phone on its side `desktop: true, width: 844, height: 390`.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { QUESTIONS } from '../../packages/shared/src/index.ts';

const ORIGIN = process.env.SHOOT_ORIGIN ?? 'http://127.0.0.1:8788';
const OUT = process.env.SHOOT_OUT ?? path.join(path.dirname(new URL(import.meta.url).pathname), 'shots');
const THEMES = process.env.SHOOT_THEME === 'dark' ? ['dark'] : process.env.SHOOT_THEME === 'light' ? ['light'] : ['light', 'dark'];
const MOTION = process.env.SHOOT_MOTION === '1';
const PROBE = process.env.SHOOT_PROBE ? fs.readFileSync(process.env.SHOOT_PROBE, 'utf8') : null;

function chromePath() {
  if (process.env.SHOOT_CHROME) return process.env.SHOOT_CHROME;
  const candidates = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium'];
  const cache = path.join(process.env.HOME ?? '', '.cache/puppeteer/chrome');
  if (fs.existsSync(cache)) {
    for (const v of fs.readdirSync(cache)) {
      const p = path.join(cache, v, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
      if (fs.existsSync(p)) candidates.push(p);
    }
  }
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('no Chrome found; set SHOOT_CHROME');
  return found;
}

const SITE = ['/', '/explore', '/pricing', '/signin', '/signup'];
const APP = ['/home', '/today', '/tower', '/apps', '/profile', '/you', '/life', '/wellbeing', '/journal', '/finance', '/shop', '/store', '/community', '/run', '/reviews', '/help', '/search', '/school', '/tools'];
const DEFAULT_SHOTS = [
  ...SITE.flatMap((p) => [{ path: p }, { path: p, desktop: true }]),
  ...APP.flatMap((p) => [{ path: p, needsSession: true }, { path: p, desktop: true, needsSession: true }]),
  { path: '/home', desktop: true, width: 844, height: 390, needsSession: true, name: 'home-landscape' },
];

const stamp = Date.now().toString(36);
async function session() {
  // A fresh account on the server, so the app screens have something to show.
  const res = await fetch(`${ORIGIN}/api/auth/signup`, { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': `10.99.${Date.now() % 255}.${(Date.now() >> 8) % 255}` }, body: JSON.stringify({ email: `shoot-${stamp}@smoke.test`, password: `Camera-${stamp}-pass`, displayName: 'Screenshot' }) });
  if (!res.ok) throw new Error(`could not sign up on ${ORIGIN}: ${res.status}`);
  const { token } = await res.json();
  const h = { 'content-type': 'application/json', authorization: `Bearer ${token}` };
  const today = new Date().toISOString().slice(0, 10);
  // Answer the vibe check for two pillars and build them, so Home, Daily and Pillars show real content instead of onboarding.
  const answers = QUESTIONS.filter((q) => q.relationship === 'self' || q.relationship === 'friendship').map((q) => ({ questionId: q.id, value: 2 }));
  await fetch(`${ORIGIN}/api/onboarding`, { method: 'POST', headers: h, body: JSON.stringify({ answers, displayName: 'Screenshot' }) });
  await fetch(`${ORIGIN}/api/onboarding/build`, { method: 'POST', headers: h, body: JSON.stringify({ relationships: ['self', 'friendship'], date: today }) });
  await fetch(`${ORIGIN}/api/today/checkin`, { method: 'POST', headers: h, body: JSON.stringify({ date: today }) });
  await fetch(`${ORIGIN}/api/today/not-to-do`, { method: 'POST', headers: h, body: JSON.stringify({ title: 'Scrolling before breakfast' }) });
  for (const key of ['store', 'run', 'reviews', 'community', 'tools', 'wellbeing']) await fetch(`${ORIGIN}/api/me/modules`, { method: 'PATCH', headers: h, body: JSON.stringify({ key, on: true }) });
  return token;
}

const list = process.argv.slice(2).length
  ? process.argv.slice(2).flatMap((p) => [{ path: p, needsSession: !SITE.includes(p) }, { path: p, desktop: true, needsSession: !SITE.includes(p) }])
  : process.env.SHOOT_LIST
    ? JSON.parse(fs.readFileSync(process.env.SHOOT_LIST, 'utf8'))
    : DEFAULT_SHOTS;

fs.mkdirSync(OUT, { recursive: true });
const token = list.some((s) => s.needsSession) ? await session() : null;
const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true, args: ['--no-first-run', '--disable-gpu'] });
const probeHits = [];
try {
  const page = await browser.newPage();
  // Clear the service worker and its caches so every shot sees the latest build.
  await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle0' });
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    for (const r of regs ?? []) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
  });
  for (const shot of list) {
    for (const theme of shot.theme ? [shot.theme] : THEMES) {
      const width = shot.width ?? (shot.desktop ? 1440 : 390);
      const height = shot.height ?? (shot.desktop ? 900 : 844);
      await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: !shot.desktop, hasTouch: !shot.desktop });
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: theme },
        { name: 'prefers-reduced-motion', value: MOTION ? 'no-preference' : 'reduce' },
      ]);
      await page.evaluateOnNewDocument(
        (t, mode) => {
          try {
            if (t) localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 }));
            else localStorage.removeItem('kreators.session');
            localStorage.setItem('kreators.theme', JSON.stringify({ state: { mode }, version: 0 }));
          } catch {
            // storage may be blocked
          }
        },
        shot.needsSession ? token : null,
        theme,
      );
      await page.goto(`${ORIGIN}${shot.path}`, { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, MOTION ? 1200 : 400));
      if (shot.before) await page.evaluate(shot.before);
      const name = shot.name ?? (shot.path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'site');
      const file = path.join(OUT, `${name}-${shot.desktop ? `${width}x${height}` : 'phone'}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`shot ${file}`);
      if (PROBE) {
        const hits = await page.evaluate(PROBE);
        for (const h of hits ?? []) probeHits.push({ shot: `${shot.path} ${shot.desktop ? 'laptop' : 'phone'} ${theme}`, ...h });
      }
    }
  }
} finally {
  await browser.close();
}
if (PROBE) {
  console.log(`\ncontrast probe: ${probeHits.length} hit${probeHits.length === 1 ? '' : 's'} under 2.2:1`);
  for (const h of probeHits) console.log(`  ${h.shot}  ${h.ratio}:1  "${h.text}"  ${h.color} on ${h.background}  ${h.where}`);
  if (probeHits.length) process.exitCode = 1;
}
