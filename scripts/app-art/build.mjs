#!/usr/bin/env node
// The pictures on Home's app tiles (Go to, components/AppTile.tsx), one for every module in packages/shared/src/modules.ts.
// They are Microsoft's Fluent Emoji 3D renders (MIT, credited in apps/web/public/app-art/LICENSE.txt and on /licences), real objects with a
// transparent ground, so they sit on a tile like a cut-out. This list is the one place the choice is made: a module key, the Fluent asset
// and a few words on why. A file's name is the module's key, so the web app needs no map: the tile asks for /app-art/<key>.webp.
//
//   node --experimental-strip-types scripts/app-art/build.mjs <new empty directory>   downloads the list at the pinned commit into that
//       directory (data only, nothing in it is ever run), then writes apps/web/public/app-art/<key>.webp through the installed Chrome: the
//       object cut to its own edges, 240px on its long side, bottom right in a 240px square, so every object meets the tile's corner.
//   node --experimental-strip-types scripts/app-art/build.mjs --check   no network: every module has a line and a picture, no two share one,
//       nothing is left over. scripts/scan.sh runs this, so a new app must bring its picture.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULES } from '../../packages/shared/src/modules.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'apps/web/public/app-art');
const COMMIT = '1ffb34c752ecf5d402f04cfb4b392c77f57c54bc'; // microsoft/fluentui-emoji main on 2026-08-24, so a rebuild draws the same pictures
const SIZE = 240;
const QUALITY = 0.8;

/**
 * Module key, Fluent asset, why a person would connect the two, and optionally how far (of 240) to lift the object: the tile cuts 8 CSS pixels
 * (about 16 of these) off the bottom, which is right unless the part that says what it is sits there. No two share a picture, and a face or a
 * person only where nothing else says it.
 */
const ART = [
  // Contribution
  ['school', 'Graduation cap', 'programs you finish'],
  ['work', 'Briefcase', 'jobs and opportunities'],
  ['army', 'Clapper board', 'brand campaigns are video shoots: briefs, production, delivery'],
  ['win', 'Sports medal', 'a reward for good work; a medal, not a trophy, since it pays per view and is no contest'],
  ['agency', 'Card index dividers', 'a folder per client, the heart of running an agency'],
  // Reflection: each tracker a different shape and colour at a glance
  ['life', 'Compass', 'the five areas of life show where you are heading'],
  ['wellbeing', 'Sparkling heart', 'one warm score for how you are doing'],
  ['mood', 'Smiling face with smiling eyes', 'the app asks you to pick a face, so here a face is the object'],
  ['sleep', 'Bed', 'night by night'],
  ['stress', 'Volcano', 'pressure that builds up; a level, not a fever'],
  ['fitness', 'Running shoe', 'moving: a run, a walk, a workout'],
  ['mindful', 'Lotus', 'quiet breathing and sitting'],
  ['journal', 'Ledger', 'drawn as a yellow spiral notebook, the kind you keep a diary in'],
  ['reviews', 'Spiral calendar', 'looking back on a week, a month or a year'],
  ['companion', 'Teddy bear', 'a comfort that keeps you company; a chat bubble would read as Community'],
  ['coaching', 'Bullseye', 'a coach keeps you on your goals, and the coach badge is this target'],
  ['discover', 'Telescope', 'looking further into how you think, feel and act'],
  // Connection
  ['cards', 'Game die', 'games to play with people'],
  ['party', 'Party popper', 'meetups and events'],
  ['run', 'Chequered flag', 'a run club at the line; Fitness already has the shoe'],
  ['community', 'Speech balloon', 'posts and replies; lifted, since the tail is what makes it a speech balloon', 20],
  ['club', 'Identification card', 'a member card'],
  ['bond', 'Handshake', 'friends and introductions'],
  ['circles', 'Fork and knife with plate', 'a table of people who meet to eat and talk; no faces, since members stay anonymous'],
  // Creation
  ['profile', 'Link', 'your one link: bio, links and what you sell'],
  ['shop', 'Shopping bags', 'what you sell'],
  ['store', 'Camera', 'gear for creators; a cart would say any shop'],
  ['audience', 'Megaphone', 'broadcasts to your followers'],
  ['content', 'Chart increasing', 'which post made money'],
  ['automations', 'Envelope with arrow', 'a message sent for you when someone comments'],
  ['finance', 'Coin', 'money in and out; no dollar sign, since rupees come first here'],
  ['library', 'Package', 'things you bought and own'],
  ['knowledge', 'Books', 'articles and exercises to read'],
  ['tools', 'Toolbox', 'a directory of tools'],
  ['tv', 'Television', 'pitch a series'],
  ['fund', 'Seedling', 'backing that helps a project grow'],
  // Essentials
  ['home', 'House', 'home'],
  ['today', 'Sun', 'what this day holds'],
  ['tower', 'Classical building', 'its columns are the seven pillars'],
  ['search', 'Magnifying glass tilted left', 'finding anything'],
  ['leaderboard', 'Trophy', 'where you stand'],
  ['notifications', 'Inbox tray', 'what came in while you were away'],
  ['help', 'Ring buoy', 'a line when you need one'],
  ['assistant', 'Magic wand', 'say it and it is done'],
  // Operations
  ['manage', 'Shield', 'the team looks after the place'],
  ['admin', 'Key', 'roles and permissions'],
  ['observability', 'Satellite antenna', 'watching what happens across the app'],
];

/** What is wrong with the list and the files, as lines. */
function problems() {
  const out = [];
  const keys = new Set(MODULES.map((m) => m.key));
  const listed = new Set(ART.map((a) => a[0]));
  for (const m of MODULES) {
    if (!listed.has(m.key)) out.push(`scripts/app-art/build.mjs: ${m.key} (${m.name}) has no picture on the list`);
    const file = path.join(OUT, `${m.key}.webp`);
    if (!fs.existsSync(file)) {
      out.push(`apps/web/public/app-art/${m.key}.webp is missing: a new app brings its picture (scripts/app-art/build.mjs)`);
      continue;
    }
    const head = fs.readFileSync(file).subarray(0, 12).toString('latin1');
    if (!head.startsWith('RIFF') || !head.endsWith('WEBP')) out.push(`apps/web/public/app-art/${m.key}.webp is not a WebP`);
  }
  for (const [key] of ART) if (!keys.has(key)) out.push(`scripts/app-art/build.mjs: ${key} is no module any more`);
  const seenAsset = new Map();
  const seenKey = new Set();
  for (const [key, asset] of ART) {
    if (seenKey.has(key)) out.push(`scripts/app-art/build.mjs: ${key} is listed twice`);
    seenKey.add(key);
    if (seenAsset.has(asset)) out.push(`scripts/app-art/build.mjs: ${key} and ${seenAsset.get(asset)} share ${asset}`);
    seenAsset.set(asset, key);
  }
  if (fs.existsSync(OUT)) {
    for (const f of fs.readdirSync(OUT)) {
      if (f.endsWith('.webp') && !keys.has(f.slice(0, -5))) out.push(`apps/web/public/app-art/${f} belongs to no module`);
    }
  }
  return out;
}

const assetUrl = (asset) => {
  const file = `${asset.toLowerCase().replace(/ /g, '_')}_3d.png`;
  return `https://raw.githubusercontent.com/microsoft/fluentui-emoji/${COMMIT}/assets/${encodeURIComponent(asset)}/3D/${encodeURIComponent(file)}`;
};

async function build(dir) {
  fs.mkdirSync(dir, { recursive: true });
  if (fs.readdirSync(dir).length > 0) throw new Error(`${dir} is not empty; downloads go into a new empty directory`);
  fs.mkdirSync(OUT, { recursive: true });
  for (const [key, asset] of ART) {
    const res = await fetch(assetUrl(asset));
    if (!res.ok) throw new Error(`${asset}: ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.subarray(1, 4).toString('latin1') !== 'PNG') throw new Error(`${asset}: not a PNG`);
    fs.writeFileSync(path.join(dir, `${key}.png`), bytes);
  }
  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: process.env.SHOOT_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const page = await browser.newPage();
    let total = 0;
    for (const [key, , , lift = 0] of ART) {
      const dataUrl = `data:image/png;base64,${fs.readFileSync(path.join(dir, `${key}.png`)).toString('base64')}`;
      const webp = await page.evaluate(
        async (src, size, quality, lift) => {
          const img = new Image();
          img.src = src;
          await img.decode();
          const read = document.createElement('canvas');
          read.width = img.naturalWidth;
          read.height = img.naturalHeight;
          const rc = read.getContext('2d', { willReadFrequently: true });
          rc.drawImage(img, 0, 0);
          const { data, width, height } = rc.getImageData(0, 0, read.width, read.height);
          let [x0, y0, x1, y1] = [width, height, -1, -1];
          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              if (data[(y * width + x) * 4 + 3] > 8) {
                x0 = Math.min(x0, x);
                y0 = Math.min(y0, y);
                x1 = Math.max(x1, x);
                y1 = Math.max(y1, y);
              }
            }
          }
          const [w, h] = [x1 - x0 + 1, y1 - y0 + 1];
          const scale = size / Math.max(w, h);
          const [dw, dh] = [Math.round(w * scale), Math.round(h * scale)];
          const out = document.createElement('canvas');
          out.width = size;
          out.height = size;
          const oc = out.getContext('2d');
          oc.imageSmoothingQuality = 'high';
          oc.drawImage(img, x0, y0, w, h, size - dw, size - dh - lift, dw, dh);
          return out.toDataURL('image/webp', quality);
        },
        dataUrl,
        SIZE,
        QUALITY,
        lift,
      );
      const bytes = Buffer.from(webp.split(',')[1], 'base64');
      total += bytes.length;
      fs.writeFileSync(path.join(OUT, `${key}.webp`), bytes);
    }
    console.log(`${ART.length} pictures written to apps/web/public/app-art, ${(total / 1000).toFixed(1)} kB in all`);
  } finally {
    await browser.close();
  }
}

const arg = process.argv[2];
if (arg === '--check') {
  const lines = problems();
  if (lines.length) console.log(lines.join('\n'));
  process.exit(lines.length ? 1 : 0);
}
if (!arg) {
  console.error('Give a new empty directory for the downloads, or --check.');
  process.exit(2);
}
await build(path.resolve(arg));
const left = problems();
if (left.length) {
  console.log(left.join('\n'));
  process.exit(1);
}
