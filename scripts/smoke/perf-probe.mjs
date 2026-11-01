// Page speed on a slow phone: the landing page, Home and Daily, with the CPU slowed 4 times and the network at
// "Slow 4G", from a cold cache. It only reports (no pass or fail): LCP, CLS, long tasks and JS transferred.
//
//   bash scripts/smoke/blueprint.sh --keep                 # a server on 8788 with the latest build
//   SHOOT_TOKEN=<session token> node scripts/smoke/perf-probe.mjs
//
//   PERF_ORIGIN=http://127.0.0.1:8788   another server (default: SHOOT_ORIGIN or the smoke server)
//   PERF_TOKEN / SHOOT_TOKEN            an onboarded account's session token (shots-all.mjs prepares one); without it
//                                       only the public landing page is measured
//   PERF_CPU=4                          the CPU slowdown (default 4)
//   PERF_RUNS=1                         how many times to load each page (the median is printed)
//   SHOOT_CHROME=/path/to/chrome        the browser binary
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ORIGIN = process.env.PERF_ORIGIN ?? process.env.SHOOT_ORIGIN ?? 'http://127.0.0.1:8788';
const TOKEN = process.env.PERF_TOKEN ?? process.env.SHOOT_TOKEN ?? null;
const CPU = Number(process.env.PERF_CPU ?? 4);
const RUNS = Math.max(1, Number(process.env.PERF_RUNS ?? 1));

// The Lighthouse "Slow 4G" numbers: 1.6 Mbit/s down, 0.75 Mbit/s up, 150 ms round trip.
const SLOW_4G = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (0.75 * 1024 * 1024) / 8 };

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

const PAGES = [
  { name: 'Landing', path: '/', session: false },
  { name: 'Home', path: '/home', session: true },
  { name: 'Daily', path: '/today', session: true },
];

// Runs before any page script: collects the paint, the shifts and the long tasks.
const collect = () => {
  const p = (window.__perf = { lcp: 0, cls: 0, longTasks: 0, longMs: 0 });
  const watch = (type, fn) => {
    try {
      new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({ type, buffered: true });
    } catch {}
  };
  watch('largest-contentful-paint', (e) => (p.lcp = e.startTime));
  watch('layout-shift', (e) => {
    if (!e.hadRecentInput) p.cls += e.value;
  });
  watch('longtask', (e) => {
    p.longTasks += 1;
    p.longMs += e.duration;
  });
};

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function measure(browser, shot) {
  const page = await browser.newPage();
  const cdp = await page.createCDPSession();
  let jsBytes = 0;
  let jsFiles = 0;
  const scripts = new Set();
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  cdp.on('Network.responseReceived', (e) => {
    if (e.type === 'Script') scripts.add(e.requestId);
  });
  cdp.on('Network.loadingFinished', (e) => {
    if (scripts.has(e.requestId)) {
      jsBytes += e.encodedDataLength;
      jsFiles += 1;
    }
  });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(collect);
  await page.evaluateOnNewDocument((t) => {
    try {
      if (t) localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 }));
      else localStorage.removeItem('kreators.session');
    } catch {}
  }, shot.session ? TOKEN : null);
  // Throttle only after the page object exists, and for this page alone.
  await cdp.send('Network.emulateNetworkConditions', SLOW_4G);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const t0 = Date.now();
  await page.goto(`${ORIGIN}${shot.path}`, { waitUntil: 'networkidle0', timeout: 120_000 });
  const loadMs = Date.now() - t0;
  await new Promise((r) => setTimeout(r, 1500));
  const perf = await page.evaluate(() => window.__perf);
  const where = new URL(page.url()).pathname;
  await page.close();
  return { ...perf, jsBytes, jsFiles, loadMs, where };
}

const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true, args: ['--no-first-run', '--disable-gpu'] });
console.log(`Origin ${ORIGIN}   CPU ${CPU}x slower   network Slow 4G (1.6 Mbit/s, 150 ms)   ${RUNS} run${RUNS === 1 ? '' : 's'} each, cold cache\n`);
console.log('page      lands on      LCP ms   CLS     long tasks (ms)   JS transferred   JS files   network idle ms');
try {
  for (const shot of PAGES) {
    if (shot.session && !TOKEN) {
      console.log(`${shot.name.padEnd(9)} skipped: set SHOOT_TOKEN (an onboarded account) to measure it`);
      continue;
    }
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await measure(browser, shot));
    const m = (k) => median(runs.map((r) => r[k]));
    console.log(
      `${shot.name.padEnd(9)} ${runs[0].where.padEnd(12)} ${String(Math.round(m('lcp'))).padStart(7)}  ${m('cls').toFixed(3)}  ${`${Math.round(m('longTasks'))} (${Math.round(m('longMs'))})`.padStart(16)}  ${`${(m('jsBytes') / 1024).toFixed(0)} KiB`.padStart(14)}  ${String(Math.round(m('jsFiles'))).padStart(8)}  ${String(Math.round(m('loadMs'))).padStart(14)}`,
    );
  }
} finally {
  await browser.close();
}
