#!/usr/bin/env node
/**
 * The founder's three books as Shop products (wave 13, 2026-11-04).
 *
 *   ORIGIN=http://localhost:8788 TOKEN=<session token> node scripts/books/create-products.mjs
 *
 * Each book becomes a DRAFT product of kind `digital` (Download, the closest kind to a book) under the account the
 * token belongs to, with no price: the founder sets the price and publishes it himself in Studio. The description is
 * the back cover word for word (The Relationship Method has no back cover in the folder, so its description is the
 * title page's subtitle and the front cover's tagline, both his own words). Covers go up through the same routes the
 * product editor uses: `POST /api/media/upload`, then `PUT /api/media/for/product/:id` (front first, then the back
 * and the spine where there are).
 *
 * Idempotent: a product with the same title is updated, never made twice, and its pictures are uploaded again only
 * when the set on it is not already front, back and spine with these captions. A product the founder has priced or
 * published keeps its price and status; only the words and pictures this script owns are written.
 *
 * Covers: the WebP files live in apps/web/public/books (`<slug>.webp` for the front, which the Book page shows,
 * `<slug>-back.webp` and `<slug>-spine.webp`). When one is missing it is made from the founder's own images in
 * BOOKS_SRC (default "~/All Books Design V05 Live on Site") with the installed Chrome (puppeteer-core, already a dev
 * dependency): drawn on a canvas and saved as WebP, the quality lowered until the file is under 900 kB.
 * `--covers` only makes the files and talks to no server.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'apps/web/public/books');
const SRC = process.env.BOOKS_SRC ?? path.join(os.homedir(), 'All Books Design V05 Live on Site');
const MAX_BYTES = 900 * 1024; // under the 1 MB upload cap with room to spare

/**
 * The three books. The file names in the founder's folder do not match the titles; each was matched by looking:
 * `DOM CREATOR.jpg` is the Creators front (pink, "FOR CREATORS"), `DOM CREATOR-1.jpg` the 20s front (purple,
 * "FOR 20YR OLDS"), `DOM TEEN SIDE-1.png` the Creators spine (pink, "CREATORS") and `DOM TEEN SIDE.png` the 20s
 * spine (green, "20+").
 */
const BOOKS = [
  {
    slug: 'the-relationship-method',
    title: 'The Relationship Method',
    description: [
      'Clearing Your Emotional Backlog to Unlock Life’s Natural Abundance',
      '',
      'Unlock abundance with the 7 relationships pyramid.',
    ].join('\n'),
    files: { front: 'TRM.jpg' },
  },
  {
    slug: 'dictionary-of-mistakes-for-creators',
    title: 'Dictionary of Mistakes for Creators',
    description: [
      'Creating is full of ups, downs, and everything in between and mistakes? They’re part of the process.',
      '',
      'The Dictionary of Mistakes is your companion through the journey of making, building, and creating. Whether you’re an artist, entrepreneur, or content creator, this guide helps you see mistakes not as setbacks but as learning opportunities.',
      '',
      'Get ready to embrace imperfection, experiment with confidence, and grow your creative potential.',
      '',
      'What’s inside:',
      '• How to handle creative blocks and self-doubt',
      '• Mistakes every creator makes (and how to learn from them)',
      '• Balancing your passion with the realities of work and life',
      '',
      'For creators who dare to make mistakes, this is your guide to turning them into something brilliant.',
    ].join('\n'),
    files: { front: 'DOM CREATOR.jpg', back: 'DOM CREATOR Back.png', spine: 'DOM TEEN SIDE-1.png' },
  },
  {
    slug: 'dictionary-of-mistakes-for-20s',
    title: 'Dictionary of Mistakes for 20s',
    description: [
      'Your 20s are wild, unpredictable, and full of the unknown sound familiar? The Dictionary of Mistakes is your pocket guide to getting through these crazy years with a little more clarity and a lot less stress.',
      '',
      'This isn’t just about avoiding mistakes; it’s about embracing them, learning, and moving forward. Whether it’s work, relationships, or figuring out who you really are, this book helps you make sense of the missteps and turns them into something useful.',
      '',
      'Here’s what’s inside:',
      '• How to handle career confusion and find purpose',
      '• Navigating love, friendships, and everything in between',
      '• Mistakes to avoid and lessons you’ll thank yourself for later',
      '',
      'Because let’s be real, your 20s aren’t about perfection, they’re about growth. Let’s make those mistakes count!',
    ].join('\n'),
    files: { front: 'DOM CREATOR-1.jpg', back: 'DOM ADULT Back.png', spine: 'DOM TEEN SIDE.png' },
  },
];

const PARTS = [
  { key: 'front', suffix: '', caption: 'Front cover', width: 893 },
  { key: 'back', suffix: '-back', caption: 'Back cover', width: 893 },
  { key: 'spine', suffix: '-spine', caption: 'Spine', width: 266 },
];

const coverPath = (book, part) => path.join(OUT, `${book.slug}${part.suffix}.webp`);

function chromePath() {
  if (process.env.SHOOT_CHROME) return process.env.SHOOT_CHROME;
  const candidates = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium'];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('no Chrome found; set SHOOT_CHROME');
  return found;
}

/** Make every missing WebP from the founder's images. */
async function makeCovers() {
  const todo = [];
  for (const book of BOOKS) for (const part of PARTS) if (book.files[part.key] && !fs.existsSync(coverPath(book, part))) todo.push({ book, part });
  if (todo.length === 0) return;
  const { default: puppeteer } = await import('puppeteer-core');
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true, args: ['--no-first-run'] });
  try {
    const page = await browser.newPage();
    for (const { book, part } of todo) {
      const file = path.join(SRC, book.files[part.key]);
      if (!fs.existsSync(file)) throw new Error(`missing ${file}; set BOOKS_SRC`);
      const mime = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const src = `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
      const b64 = await page.evaluate(
        async (src, width, maxBytes) => {
          const img = new Image();
          img.src = src;
          await img.decode();
          const w = Math.min(width, img.naturalWidth);
          const h = Math.round((img.naturalHeight * w) / img.naturalWidth);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          let out = '';
          for (let q = 0.86; q >= 0.4; q -= 0.06) {
            out = canvas.toDataURL('image/webp', q).split(',')[1];
            if ((out.length * 3) / 4 < maxBytes) break;
          }
          return out;
        },
        src,
        part.width,
        MAX_BYTES,
      );
      const buf = Buffer.from(b64, 'base64');
      if (buf.subarray(8, 12).toString('ascii') !== 'WEBP') throw new Error(`Chrome did not make a WebP for ${book.slug}${part.suffix}`);
      if (buf.length >= MAX_BYTES) throw new Error(`${book.slug}${part.suffix}.webp is still ${buf.length} bytes`);
      fs.writeFileSync(coverPath(book, part), buf);
      console.log(`made ${path.relative(ROOT, coverPath(book, part))} (${Math.round(buf.length / 1024)} kB)`);
    }
  } finally {
    await browser.close();
  }
}

await makeCovers();
if (process.argv.includes('--covers')) process.exit(0);

const ORIGIN = (process.env.ORIGIN ?? '').replace(/\/$/, '');
const TOKEN = process.env.TOKEN ?? '';
if (!ORIGIN || !TOKEN) {
  console.error('Set ORIGIN (for example http://localhost:8788) and TOKEN (a session token of the account that owns the books).');
  process.exit(1);
}

async function call(method, p, body, type = 'application/json') {
  const res = await fetch(`${ORIGIN}/api${p}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(body === undefined ? {} : { 'Content-Type': type }) },
    body: body === undefined ? undefined : type === 'application/json' ? JSON.stringify(body) : body,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) throw new Error(`${method} ${p} answered ${res.status}: ${text.slice(0, 200)}`);
  return json;
}

const studio = await call('GET', '/studio');
const report = [];
for (const book of BOOKS) {
  const found = (studio.products ?? []).filter((p) => p.title.trim().toLowerCase() === book.title.toLowerCase());
  let product = found.find((p) => p.status !== 'archived') ?? found[0];
  if (product) {
    // Only the words this script owns; a price or a status the founder set stays as he left it.
    product = (await call('PATCH', `/studio/products/${product.id}`, { title: book.title, description: book.description })).product;
  } else {
    product = (await call('POST', '/studio/products', { kind: 'digital', title: book.title, description: book.description, status: 'draft', pricePoints: 0, priceCents: 0, currency: 'INR' })).product;
  }
  const want = PARTS.filter((part) => book.files[part.key]);
  const have = await call('GET', `/media/for/product/${product.id}`);
  const same = have.items.length === want.length && want.every((part, i) => have.items[i].caption === part.caption && have.items[i].url.startsWith('/api/public/media/'));
  if (!same) {
    const items = [];
    for (const part of want) {
      const up = await call('POST', '/media/upload', fs.readFileSync(coverPath(book, part)), 'image/webp');
      items.push({ url: up.url, caption: part.caption });
    }
    await call('PUT', `/media/for/product/${product.id}`, { items });
  }
  report.push({ id: product.id, title: product.title, kind: product.kind, status: product.status, priceCents: product.priceCents, pricePoints: product.pricePoints, pictures: want.length, uploaded: !same });
}
console.table(report);
