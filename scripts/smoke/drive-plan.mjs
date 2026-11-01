// Plan my week, end to end in a browser: stage a fix, find a task by name, add it with its options, keep everything, and check the server.
// Needs the smoke server (blueprint.sh --keep) and a prepared account (shots-all.mjs writes scripts/smoke/state/shoot-token). Usage: node scripts/smoke/drive-plan.mjs <folder for screenshots>
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const ORIGIN = 'http://127.0.0.1:8788';
const OUT = process.argv[2];
const token = fs.readFileSync(new URL('./state/shoot-token', import.meta.url), 'utf8').trim();
const api = async (m, p, b) => (await fetch(`${ORIGIN}/api${p}`, { method: m, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'CF-Connecting-IP': '10.77.3.5' }, body: b ? JSON.stringify(b) : undefined })).json();
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const day = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const proj = ((await api('GET', '/nodes?relationship=self&kind=project')).nodes ?? [])[0];
const mk = (b) => api('POST', '/nodes', { kind: 'task', parentId: proj.id, relationship: proj.relationship, ...b });
const stamp = Date.now().toString(36).slice(-4);
// Earlier runs leave their tasks behind, and the plan lists at most twelve with no estimate, so sweep them first and again at the end.
const MINE = ['Reply to the brand ', 'Plan the next shoot ', 'Spend a full day with a friend, screens off ', 'Read the whole book on slow'];
const sweep = async () => { for (const q of MINE) for (const t of (await api('GET', `/wellbeing/focus/tasks?q=${encodeURIComponent(q)}`)).tasks ?? []) if (t.title.startsWith(q)) await api('DELETE', `/nodes/${t.id}`); };
await sweep();
const lateTask = (await mk({ title: `Spend a full day with a friend, screens off ${stamp}`, dueDate: day(-3) })).node;
const unsized = (await mk({ title: `Reply to the brand ${stamp}`, doDate: day(2) })).node;
const picked = (await mk({ title: `Plan the next shoot ${stamp}`, doDate: day(6), estimateMin: 20 })).node;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1000 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 140)));
await page.evaluateOnNewDocument((t) => localStorage.setItem('kreators.session', JSON.stringify({ state: { token: t }, version: 0 })), token);
await page.goto(`${ORIGIN}/today`, { waitUntil: 'networkidle0' });
const clickText = async (text, within = 'body') => { const hd = await page.evaluateHandle((x, w) => [...document.querySelector(w).querySelectorAll('button')].find((b) => b.textContent.trim().includes(x) && b.offsetParent !== null && !b.disabled), text, within); const el = hd.asElement(); if (!el) throw new Error(`no button "${text}"`); await el.evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(150); await el.click(); await sleep(450); };
const keepLabel = () => page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => /Keep what fits/.test(b.textContent))?.textContent.trim() ?? 'none');
let ok = true; const note = (n, c, x = '') => { if (!c) ok = false; console.log(c ? 'ok  ' : 'FAIL', n, x); };
await clickText('Plan my week'); await sleep(1000);
const k0 = await keepLabel();
// find the "no time estimate" line and open its Fix
await page.evaluate(() => { const li = [...document.querySelectorAll('[role=dialog] li')].find((l) => /no time estimate/.test(l.innerText)); li.querySelector('button[aria-expanded]').scrollIntoView({ block: 'center' }); li.querySelector('button[aria-expanded]').click(); });
await sleep(500);
const chipHit = await page.evaluate((title) => { const row = [...document.querySelectorAll('[role=dialog] li')].find((l) => l.innerText.includes(title) && l.querySelector('[role=group]') && !l.querySelector('li')); if (!row) return false; const chip = [...row.querySelectorAll('button[aria-pressed]')].find((b) => b.textContent.trim() === '45m'); if (!chip) return false; chip.click(); return true; }, unsized.title);
await sleep(400);
note('a fix is staged: 45m on the task with no estimate', chipHit);
const k1 = await keepLabel();
note('the Keep button counts the staged fix', k1 !== k0 && /\((\d+)\)/.test(k1), `${k0} -> ${k1}`);
await page.screenshot({ path: `${OUT}/plan2-fix.png` });
// the "move to a day" fix: the title keeps its room and the day picker does not sit on it
await page.evaluate(() => { const li = [...document.querySelectorAll('[role=dialog] li')].find((l) => /late task/.test(l.innerText) && l.querySelector('button[aria-expanded]')); const b = li.querySelector('button[aria-expanded]'); if (b.getAttribute('aria-expanded') !== 'true') b.click(); });
await sleep(500);
const moveRow = await page.evaluate((title) => { const row = [...document.querySelectorAll('[role=dialog] li')].find((l) => l.innerText.includes(title) && l.querySelector('select') && !l.querySelector('li')); if (!row) return null; const p = row.querySelector('p').getBoundingClientRect(); const sel = row.querySelector('select').getBoundingClientRect(); return { titleW: Math.round(p.width), titleRight: Math.round(p.right), selLeft: Math.round(sel.left), selW: Math.round(sel.width), titleH: Math.round(p.height) }; }, lateTask.title);
note('a late task row keeps room for its title, with the day picker beside it', moveRow && moveRow.titleW >= 120 && moveRow.selLeft >= moveRow.titleRight - 2 && moveRow.selW <= 200 && moveRow.titleH < 90, JSON.stringify(moveRow));
await page.screenshot({ path: `${OUT}/plan2-move.png` });
// tick the line as dealt with
const lineTick = await page.evaluate(() => { const li = [...document.querySelectorAll('[role=dialog] li')].find((l) => /no time estimate/.test(l.innerText)); const cb = li.querySelector('input[type=checkbox]'); cb.click(); return true; });
await sleep(300);
const struck = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] li p')].some((p) => /no time estimate/.test(p.innerText) && p.className.includes('line-through')));
note('ticking a line marks it dealt with', struck);
// add your own
await clickText('Pick a task', '[role=dialog]'); await sleep(500);
await page.type('#own-find', picked.title.slice(0, 14)); await sleep(1200);
const found = await page.evaluate((t) => [...document.querySelectorAll('[role=dialog] ul[aria-label="Your open tasks"] button')].some((b) => b.textContent.includes(t)), picked.title);
note('a task is found by typing part of its name', found);
await page.evaluate((t) => [...document.querySelectorAll('[role=dialog] ul[aria-label="Your open tasks"] button')].find((b) => b.textContent.includes(t)).click(), picked.title); await sleep(1500);
const formText = await page.evaluate(() => document.querySelector('[role=dialog]').innerText);
note('picking it shows its day, length and the other options', /Do date|Repeat|Priority|Remember/.test(formText), formText.slice(formText.indexOf('Change'), formText.indexOf('Change') + 260).replace(/\n/g, ' | '));
await page.screenshot({ path: `${OUT}/plan2-own.png` });
await clickText('Add to the plan', '[role=dialog]'); await sleep(500);
const after = await page.evaluate(() => document.querySelector('[role=dialog]').innerText);
note('the task you picked joins the plan', after.includes(picked.title), '');
const k2 = await keepLabel();
note('and is counted in Keep', k2 !== k1, `${k1} -> ${k2}`);
await clickText('Keep what fits', '[role=dialog]'); await sleep(2500);
const u = (await api('GET', `/nodes/${unsized.id}`)).node;
const pk = (await api('GET', `/nodes/${picked.id}`)).node;
note('the server has the 45 minute estimate', u.estimateMin === 45, `estimate ${u.estimateMin}`);
note('and the picked task is still on its day with its own data', pk.doDate && pk.id === picked.id, `doDate ${pk.doDate}, estimate ${pk.estimateMin}`);
await sweep();
console.log('page errors:', errors);
console.log(ok ? 'ALL OK' : 'SOME FAILED');
await browser.close();
