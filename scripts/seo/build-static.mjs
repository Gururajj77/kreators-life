#!/usr/bin/env node
// Build-time pages for search and answer engines (docs/aeo-kit.md, parts 4, 5, 6 and 8).
//
// Runs after `vite build` (apps/web's build script), so nothing it writes is in the service worker's precache:
//   node --experimental-strip-types --no-warnings ../../scripts/seo/build-static.mjs
//
// 1. For every stable page in SITE_PAGES but `/` and `/events` (the Worker writes those two), a copy of dist/index.html at the path
//    Cloudflare's default html_handling serves for the route (/features -> features.html, /features/agency -> features/agency.html),
//    with the page's title, description, absolute og tags, canonical, JSON-LD, and a <noscript> after the root holding the page's words.
// 2. Fails (exit 1) when the feature pages and SITE_FEATURES in apps/web/src/site/content.ts no longer agree.
// 3. Writes dist/robots.txt, dist/llms.txt and dist/llms-full.txt, with the app lists, prices, questions and books generated from the
//    same data the site reads, so they never drift.
//
// The origin is SITE_URL, else https://kreators.app. Only exact replacements on known tags; any tag not found exactly once stops the
// build. A <script src> or modulepreload line is never touched (perf-budget.mjs reads them), and dist/index.html is never written.
// Business details are never written here: they live in Worker variables, so these files point to /contact instead.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dist = join(root, 'apps/web/dist');

// content.ts imports '@kreators/shared', which resolves from apps/web to packages/shared/src (a workspace link; Node follows the real
// path, so it is the same module as the relative imports below and Node strips its types).
const content = await import(join(root, 'apps/web/src/site/content.ts'));
const shared = await import(join(root, 'packages/shared/src/index.ts'));
const meta = await import(join(root, 'packages/shared/src/siteMeta.ts'));

const { FEATURES, SITE_FEATURES } = content;
const { BOOKS, LIVE_CALL_CENTS, MODULE_BY_KEY, MODULE_GROUP_ORDER, MODULE_GROUPS, PAYMENTS_LIVE, PLAN_CURRENCY, PLAN_DAYS, PLANS, RELATIONSHIP_BY_KEY, RELATIONSHIPS, REWARDS, BUMLING, money } = shared;
const { FEATURE_PAGE_SLUGS, SITE_PAGES, SITE_FAQ, breadcrumbLd, booksLd, escapeHtml, featureName, itemListLd, jsonForHtml, organizationLd, siteUrl, webAppLd } = meta;

const failures = [];
const fail = (msg) => failures.push(msg);
const stop = () => {
  if (!failures.length) return;
  for (const f of failures) console.error(`build-static: ${f}`);
  process.exit(1);
};

const ORIGIN = siteUrl(process.env.SITE_URL);
const abs = (path) => `${ORIGIN}${path}`;

// ---------------------------------------------------------------------------
// 2. The feature pages and the site's list agree.
// ---------------------------------------------------------------------------
const appSlugs = FEATURE_PAGE_SLUGS.filter((s) => s !== 'books');
const siteKeys = SITE_FEATURES.map((m) => m.key);
{
  const a = [...appSlugs].sort();
  const b = [...siteKeys].sort();
  if (a.length !== new Set(a).size) fail('FEATURE_PAGE_SLUGS names an app twice.');
  if (a.join(',') !== b.join(',')) {
    const missing = b.filter((k) => !a.includes(k));
    const extra = a.filter((k) => !b.includes(k));
    fail(`FEATURE_PAGE_SLUGS (less books) does not equal SITE_FEATURES. Missing: ${missing.join(', ') || 'none'}. Extra: ${extra.join(', ') || 'none'}.`);
  }
  for (const s of appSlugs) if (!FEATURES[s] || !MODULE_BY_KEY[s]) fail(`No FEATURES entry or module for /features/${s}.`);
}
stop();

// The books' chapters live beside the Books page (apps/web/src/site/Books.tsx, a TSX file Node cannot load), so they are read from
// its text: the BOOK_CHAPTERS object, each book's slug and its list of single-quoted titles.
function readChapters() {
  const src = readFileSync(join(root, 'apps/web/src/site/Books.tsx'), 'utf8');
  const start = src.indexOf('export const BOOK_CHAPTERS');
  const end = start < 0 ? -1 : src.indexOf('\n};', start);
  if (start < 0 || end < 0) {
    fail('BOOK_CHAPTERS not found in apps/web/src/site/Books.tsx.');
    return {};
  }
  const body = src.slice(start, end);
  const out = Object.create(null);
  for (const m of body.matchAll(/'([a-z0-9-]+)':\s*\[([\s\S]*?)\]/g)) {
    out[m[1]] = [...m[2].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((t) => t[1].replace(/\\'/g, "'"));
  }
  for (const b of BOOKS) if (!out[b.slug]?.length) fail(`No chapters read for the book ${b.slug}.`);
  return out;
}
const CHAPTERS = readChapters();
stop();

// ---------------------------------------------------------------------------
// Shared words.
// ---------------------------------------------------------------------------
const APP_COUNT = appSlugs.length;
const NOT_YET = !PAYMENTS_LIVE;
const planPrice = (p) => money(p.priceCents, PLAN_CURRENCY);
const plans = Object.values(PLANS);
const fromPrice = `${planPrice(plans.reduce((a, b) => (b.priceCents < a.priceCents ? b : a)))} for ${PLAN_DAYS} days`;
const liveCall = money(LIVE_CALL_CENTS, PLAN_CURRENCY);

/** The apps of each group, in the one group order and the site's order inside it. */
const appGroups = MODULE_GROUP_ORDER.map((g) => ({ group: g, name: MODULE_GROUPS[g], slugs: appSlugs.filter((s) => MODULE_BY_KEY[s].group === g) })).filter(
  (g) => g.slugs.length > 0,
);
if (appGroups.reduce((n, g) => n + g.slugs.length, 0) !== APP_COUNT) fail('An app sits in no listed group.');

const bookCost = (() => {
  const costs = BOOKS.map((b) => REWARDS.find((r) => r.key === b.rewardKey)?.cost);
  if (costs.some((c) => typeof c !== 'number')) return null;
  return new Set(costs).size === 1 ? costs[0] : null;
})();

/** "Written by X | Published by Y" -> "Written by X, published by Y"; "Written & Published by X" -> "Written and published by X". */
const publisherLine = (s) =>
  s
    .replace(/\s*\|\s*/g, ', ')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/(, | and )Published/g, '$1published');
stop();

// ---------------------------------------------------------------------------
// 1. The pages.
// ---------------------------------------------------------------------------
const indexPath = join(dist, 'index.html');
const indexBytes = readFileSync(indexPath);
const indexHash = createHash('sha256').update(indexBytes).digest('hex');
const index = indexBytes.toString('utf8');

/** The lines a page must keep exactly: every script with a src and every modulepreload. */
const fixedLines = (html) => [...html.matchAll(/<script\b[^>]*\bsrc=[^>]*>|<link\b[^>]*\bmodulepreload\b[^>]*>/g)].map((m) => m[0]);
const indexFixed = fixedLines(index);
if (!indexFixed.some((l) => l.includes('<script'))) fail('dist/index.html has no <script src>; is this a vite build?');

/** Replace the one match of `pattern` (a RegExp, no g flag) or stop. */
function replaceOnce(html, pattern, replacement, label) {
  const all = html.match(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`)) ?? [];
  if (all.length !== 1) {
    fail(`${label}: expected one match in dist/index.html, found ${all.length}.`);
    return html;
  }
  return html.replace(pattern, () => replacement);
}

const ldBlock = (value) => `<script type="application/ld+json">${jsonForHtml(value)}</script>`;
const p = (text) => `<p>${escapeHtml(text)}</p>`;
const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const ol = (items) => `<ol>${items.map((i) => `<li>${i}</li>`).join('')}</ol>`;
const link = (path, text) => `<a href="${escapeHtml(path)}">${escapeHtml(text)}</a>`;
const h2 = (text) => `<h2>${escapeHtml(text)}</h2>`;

const trailHome = { name: 'kreators.app', path: '/' };
const trailFeatures = { name: 'Features', path: '/features' };

/**
 * Part 5's table: /features an ItemList and its trail, a feature page its trail, /features/books its books, /pricing the WebApplication, the
 * rest nothing. WebSite and the full Organization live on `/` (the Worker writes them). A block that points at `#organization` brings an
 * Organization with the names and addresses only (no business field: those are Worker variables), so the reference resolves on this page.
 */
function jsonLdFor(page) {
  const blocks = [];
  if (page.path === '/features') {
    blocks.push(itemListLd(ORIGIN, appSlugs.map((s) => ({ name: featureName(s), path: `/features/${s}` }))));
    blocks.push(breadcrumbLd(ORIGIN, [trailHome, trailFeatures]));
  } else if (page.path === '/features/books') {
    const books = booksLd(ORIGIN).map(({ '@context': _c, ...rest }) => rest);
    blocks.push({ '@context': 'https://schema.org', '@graph': books });
    blocks.push(breadcrumbLd(ORIGIN, [trailHome, trailFeatures, { name: featureName('books'), path: page.path }]));
  } else if (page.path.startsWith('/features/')) {
    const slug = page.path.slice('/features/'.length);
    blocks.push(breadcrumbLd(ORIGIN, [trailHome, trailFeatures, { name: featureName(slug), path: page.path }]));
  } else if (page.path === '/pricing') {
    // Part 5's table: /pricing carries WebApplication for its offers. The fair questions (FAQPage) are drawn on `/`, which the Worker
    // writes; FAQ data must match what the page shows, and /pricing does not show them.
    blocks.push(webAppLd(ORIGIN));
  }
  if (blocks.some((b) => JSON.stringify(b).includes(`${ORIGIN}/#organization`))) blocks.unshift(organizationLd(ORIGIN, {}));
  return blocks;
}

/** What the page says, as plain HTML, for a reader that runs no script. */
function noscriptFor(page) {
  const parts = [`<h1>${escapeHtml(page.h1)}</h1>`];
  if (page.path === '/features/books') {
    if (page.opening) parts.push(p(page.opening));
    for (const b of BOOKS) {
      const words = [b.subtitle, b.tagline, ...b.back].filter(Boolean);
      parts.push(`<section id="${escapeHtml(b.slug)}">${h2(b.title)}${words.map(p).join('')}`);
      if (b.inside.length) parts.push(`${p(b.insideLead)}${ul(b.inside.map(escapeHtml))}`);
      if (b.closing) parts.push(p(b.closing));
      parts.push(`${p('Chapters')}${ol((CHAPTERS[b.slug] ?? []).map(escapeHtml))}</section>`);
    }
  } else if (page.path.startsWith('/features/')) {
    const slug = page.path.slice('/features/'.length);
    const copy = FEATURES[slug];
    const opening = page.opening ?? `${copy.tagline} ${copy.pitch}`;
    parts.push(p(opening));
    if (page.opening) parts.push(p(copy.tagline), p(copy.pitch));
    if (copy.more?.length) parts.push(ul(copy.more.map(escapeHtml)));
    parts.push(h2('How it goes'), ol(copy.steps.map(escapeHtml)));
    const serves = copy.relationships.map((k) => RELATIONSHIP_BY_KEY[k]?.name).filter(Boolean);
    if (serves.length) parts.push(p(`The relationships it serves: ${serves.join(', ')}.`));
    parts.push(`<p>${link('/features', 'All features')}</p>`);
  } else {
    parts.push(p(page.opening ?? page.description));
    if (page.path === '/features') {
      for (const g of appGroups) {
        parts.push(h2(g.name), ul(g.slugs.map((s) => `${link(`/features/${s}`, featureName(s))}: ${escapeHtml(FEATURES[s].tagline)}`)));
      }
      parts.push(`<p>${link('/features/books', featureName('books'))}</p>`);
    } else if (page.path === '/7rp') {
      parts.push(ul(RELATIONSHIPS.map((r) => escapeHtml(`${r.name}. ${r.character}, ${r.role}. ${r.question}`))));
    }
  }
  return `<noscript>${parts.join('')}</noscript>`;
}

function pageHtml(page) {
  const url = page.path === '/' ? `${ORIGIN}/` : abs(page.path);
  const title = escapeHtml(page.title);
  const desc = escapeHtml(page.description);
  let html = index;
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`, 'title');
  html = replaceOnce(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${desc}" />`, 'meta description');
  html = replaceOnce(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`, 'og:title');
  html = replaceOnce(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${desc}" />`, 'og:description');
  html = replaceOnce(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${escapeHtml(url)}" />`, 'og:url');
  html = replaceOnce(html, /<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${escapeHtml(abs('/og.png'))}" />`, 'og:image');
  const head = [`<link rel="canonical" href="${escapeHtml(url)}" />`, ...jsonLdFor(page).map(ldBlock)].map((l) => `    ${l}`).join('\n');
  html = replaceOnce(html, /<\/head>/, `${head}\n  </head>`, '</head>');
  html = replaceOnce(html, /<div id="root"><\/div>/, `<div id="root"></div>\n    ${noscriptFor(page)}`, '<div id="root"></div>');
  if (fixedLines(html).join('\n') !== indexFixed.join('\n')) fail(`${page.path}: a <script src> or modulepreload line changed.`);
  return html;
}

/** Where Cloudflare's default html_handling finds a route's file: /features -> features.html, /features/agency -> features/agency.html. */
const fileFor = (path) => join(dist, `${path.slice(1)}.html`);

const WORKER_OWNS = new Set(['/', '/events']);
const outputs = [];
for (const page of SITE_PAGES) {
  if (WORKER_OWNS.has(page.path)) continue;
  if (!/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/.test(page.path)) {
    fail(`${page.path}: not a path this generator can write.`);
    continue;
  }
  if (!page.description) fail(`${page.path}: no description.`);
  outputs.push([fileFor(page.path), pageHtml(page)]);
}
stop();

// ---------------------------------------------------------------------------
// 3. robots.txt, llms.txt, llms-full.txt (part 4 of the kit).
// ---------------------------------------------------------------------------
const DISALLOW = [
  '/api/',
  '+/api/public/',
  '/api/public/agency/',
  '/api/public/contracts/',
  '/api/public/invoices/',
  '/api/public/team-link/',
  '/api/public/calendar/',
  '/api/public/coach-join/',
  '/api/public/invite/',
  '/api/public/unsubscribe/',
  '/api/public/waitlist',
  '/go/', '/out/', '/a/', '/i/', '/k/', '/d/', '/t/', '/c/',
  '/unsubscribe/', '/join/', '/coach/join/',
  '/signin', '/signup', '/forgot', '/onboarding', '/session', '/vibe-check',
  '/home', '/today', '/tower', '/you', '/inbox', '/insights', '/plans', '/rewards', '/library', '/manage', '/admin', '/internal/',
  '/leaderboard', '/help', '/school', '/work', '/army', '/win', '/agency', '/community', '/run', '/club', '/party', '/bond', '/circles',
  '/cards', '/life', '/journal', '/reviews', '/mindful', '/fitness', '/wellbeing', '/mood', '/sleep', '/stress', '/coaching',
  '/companion', '/discover', '/shop', '/profile', '/finance', '/fund', '/tv', '/knowledge', '/tools', '/store', '/apps', '/search',
  '/time-blocks', '/realm/', '/resources$', '/studio', '/book$', '/*?add=',
];
const rules = ['Allow: /', ...DISALLOW.map((r) => (r.startsWith('+') ? `Allow: ${r.slice(1)}` : `Disallow: ${r}`))].join('\n');
const robots = `# robots.txt for kreators.app
# Written by scripts/seo/build-static.mjs at build time (docs/aeo-kit.md, part 4).
# A crawler follows only the group that names it, else the * group,
# so each group repeats the same Disallow lines.

# Group 1: model training crawlers and training tokens.
# Allowed as written. This is the founder's choice:
# to opt out of training, change "Allow: /" to "Disallow: /" here.
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: CCBot
${rules}

# Group 2: search and answer engines, and everyone else.
User-agent: Googlebot
User-agent: Bingbot
User-agent: Applebot
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: *
${rules}

Sitemap: ${abs('/sitemap.xml')}
`;

const relationshipNames = RELATIONSHIPS.map((r) => r.name.toLowerCase()).join(', ');
const pricingLine = `Free to start and free to stay. The Shop takes 5% of each sale. Typing to the assistant needs a plan from ${fromPrice}${NOT_YET ? ', not on sale yet' : ''}.`;

const llms = `# kreators.app

> kreators.app is a daily game for the seven relationships that make a life, with the tools a creator needs built in. One small act a day, for all seven. Free to start, free to stay. It runs in the browser on a phone or laptop, India first, for people 18 or over.

Key facts:

- The seven relationships, each a pillar with its own guide: ${relationshipNames}.
- The five areas of life, in order: ${shared.LIFE_AREA_ORDER.join(', ')}.
- The daily ask: check in, do one small act, tick one task.
- ${APP_COUNT} apps in ${appGroups.length} groups, each one a switch. Only a few are on to start.
- ${pricingLine}
${NOT_YET ? '- Points work today. Money checkout runs in test mode until payments are switched on.\n' : ''}- Joining may be by invite: while Invite only is on, a new account needs a code or a place from the waitlist.
- Your journal and wellbeing are never shown to brands, staff, the leaderboard or Club selection.

## Start here

- [Home](${abs('/')}): The story, the five villains, how each is beaten, the offer and the FAQ.
- [Features](${abs('/features')}): Every app by group, one page each.
- [7RP: the seven relationships](${abs('/7rp')}): Each pillar, its guide and the apps that serve it; also the five areas of life.
- [Pricing](${abs('/pricing')}): What is free and the three things that cost money.
- [Events](${abs('/events')}): Public meetups, workshops and days you can join.
- [Explore](${abs('/explore')}): Search content rewards, opportunities, events, programs, tools, campaigns and circles.
- [Books](${abs('/features/books')}): Three books by the founder, ${shared.BOOK_AUTHOR}, each with a course.
- [Full text for models](${abs('/llms-full.txt')}): Everything on this list in one plain-text file.

${appGroups
  .map((g) => `## Apps: ${g.name}\n\n${g.slugs.map((s) => `- [${featureName(s)}](${abs(`/features/${s}`)}): ${FEATURES[s].tagline}`).join('\n')}`)
  .join('\n\n')}

## Policies

- [Terms of use](${abs('/terms')}): Plain-language terms, 18 or over, what points are.
- [Privacy](${abs('/privacy')}): What is kept and why, rights under India's DPDP Act 2023, and EU and UK rights.
- [Refunds](${abs('/refunds')}): Money goes back the way you paid, through Razorpay.
- [Contact](${abs('/contact')}): The team, and the Grievance Officer for India.
- [Subprocessors](${abs('/subprocessors')}): Companies that handle personal data, what they do and where.

## Optional

- [Copyright](${abs('/copyright')}): Send a notice or a counter-notice.
- [Licences](${abs('/licences')}): The open-source parts the app is built on.
`;

const appLine = (s) => {
  const c = FEATURES[s];
  return `- ${featureName(s)}: ${[c.tagline, c.pitch, ...(c.more ?? [])].join(' ')}`;
};
const planList = plans.map((pl) => `${pl.name} ${planPrice(pl)}`).join(', ');
const BOOK_NOTES = { 'the-relationship-method': 'Where the seven relationships come from.' };
const bookLines = BOOKS.map((b, i) => {
  const bits = [`${b.title}: ${b.subtitle}.`];
  if (b.tagline) bits.push(`"${b.tagline}."`);
  if (BOOK_NOTES[b.slug]) bits.push(BOOK_NOTES[b.slug]);
  if (b.publisher) bits.push(`${publisherLine(b.publisher)}.`);
  bits.push(`Chapters: ${(CHAPTERS[b.slug] ?? []).join('; ')}.`);
  return `${i + 1}. ${bits.join(' ')}`;
}).join('\n');

const llmsFull = `# kreators.app: the full explainer

Site: ${ORIGIN}
Short file: ${abs('/llms.txt')}

## What it is

kreators.app is a daily game for the seven relationships that make a life, with the tools a creator needs built in. Its line is "Grow your work without losing your life." Its touchstone is "One small act a day, for all seven. Free to start, free to stay."

Your work is one of seven relationships. kreators.app is a daily game that keeps all seven moving. Let one relationship slide and the others feel it. Keep all seven moving and the work gets better too.

- Who: anyone 18 or over building something of their own: creators, freelancers, founders, small agencies and students. The seven relationships are for everyone, and the creator apps stay off until you want them.
- When: a few minutes a day, and a short look back each week and month.
- Where: on your phone or laptop, in the browser. Nothing to install.
- Built in India by BrandingBum. India first: prices in Indian rupees, GST shown before you pay, Indian phone numbers by default.

## How it starts

1. A short chat. Answer a few questions. It shows the apps that fit, and nothing else.
2. Your pillars. A short session maps your seven and builds a pyramid for the ones that need you most.
3. Three boxes a day. Check in, do one small act, tick one task. Every tick climbs your pyramid to the reason you started.

Each day: a tick. On Sunday: your first week review. Each month: a look back with the numbers next to the month before.

## The seven relationships (pillars) and their guides

Each relationship is a pillar of your life, and each pillar is a pyramid. Tick a task and the whole pyramid grows. Its layers, top to bottom: a foundation you will not let break, a guiding principle you live by, a value goal for how you want to feel, a goal outcome you would see when it is real, a project, and tasks at the tip. Give a project a due day and it shows its pace: on track, slipping or behind.

${RELATIONSHIPS.map((r, i) => `${i + 1}. ${r.name}. Guide: ${r.character}, ${r.role}. "${r.greeting}" Daily question: ${r.question}`).join('\n')}

The app's own guide is ${BUMLING.character}, ${BUMLING.role}. The seven relationships come from ${shared.BOOK_AUTHOR}'s book ${BOOKS[0].title}.

## The five areas of life

Always in this order, since each one holds up the next:

1. Physical: sleep, movement, breath and eating.
2. Financial: what comes in, what goes out, where you are heading.
3. Mental: stress, focus, and what you are learning.
4. Emotional: mood, what you wrote, and the people close to you.
5. Spiritual: stillness, awe, teachers and faith.

The Life app scores each one from what you already log. Only you see them.

## The problem it answers: five villains

- The Grind: one more video, one more hour. It takes your sleep first. Beaten by a routine built from your real day, a daily brief, and focus sessions with breaks (Daily, Life, Sleep, Mindfulness).
- The Scatter: ten apps, ten logins, and nothing talks to anything. Beaten by one place and one login for learning, paid work, campaigns, clients, your shop and your money (Agency, School, Work, Shop, Finance).
- The Silence: you work alone. Beaten by small circles, run clubs, events, a kind community, and a life coach if you want one (Circles, Kreators Run, Party, Community, Games, Coaching).
- The Drift: goals sit in a note you never open. Beaten by seven pillars, Plan my week, weekly and monthly reviews, and a strengths quiz (Pillars, Discover, Reviews, Journal).
- The Squeeze: money comes late, or not at all. Beaten by paid gigs and campaigns, Win's pay per verified view, your own shop at 5% of a sale, and Agency invoices with GST and TDS worked out (Army, Agency, Shop, Win, Finance).

## The apps

${APP_COUNT} apps in ${appGroups.length} groups. Each one is a switch. Only a few are on to start. The setup chat shows up to five that fit what you tell it and hides the rest. Showing or hiding an app is one tap, and nothing is deleted.

${appGroups.map((g) => `### ${g.name}\n\n${g.slugs.map(appLine).join('\n')}`).join('\n\n')}

## Pricing

- Play: free. The daily game, your seven pillars and every app you switch on, Agency included.
- Sell: 5% of each sale in the Shop, with nothing up front. Refer a creator and earn 20% of their referred sales.
- Assistant: typing to it needs a plan. ${planList}, each for ${PLAN_DAYS} days. Tapping its ready-made choices stays free. Plans do not renew by themselves.${NOT_YET ? ' Plans are not on sale yet.' : ''}
- Live call: an optional live call with a coach costs ${liveCall}.${NOT_YET ? ' It is not on sale yet.' : ''}
- Brands: campaigns and content-reward pools are priced per brief.
- Agency: we take nothing from the invoices you make.
- Prices are in Indian rupees. GST is added where it applies and shown before you pay.
- Points are earned by showing up and spent inside kreators.app. They are not money and cannot be cashed out.
${NOT_YET ? '- Money checkout runs in test mode until payments are switched on. Points work today.\n' : ''}
## For brands and agencies

Pay for views that are checked, not claimed. ${content.BRAND_PITCH.pitch}

## Joining

You need to be 18 or older. Sign-up asks for your date of birth and a phone number, and neither is ever shown to anyone else. One account can be signed in on up to three devices at once.

Joining may be by invite. While Invite only is on, a new account needs an invite code. Each code works once, for one account. No code? Join the waitlist, and we will email you when there is a place.

## Fair questions

${SITE_FAQ.map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n\n')}

## The books

${shared.BOOK_AUTHOR}, the founder of kreators.app, wrote three books. He left college to live as a monk and came back with this idea: seven relationships make a life. Each book has a course in School. Each lesson marks what comes from the book, and anything it adds is the app's own. The books are not sold for money on the site yet${bookCost ? `; each can be reserved for ${shared.formatCount(bookCost)} points in Rewards` : ''}.

${bookLines}

## Privacy and safety

- Your journal and wellbeing are never shown to brands, staff, the leaderboard or Club selection.
- We never use what you write to train AI models.
- We do not sell your personal information, and we do not share it for advertising on other sites. There are no third-party advertising trackers.
- In India, under the Digital Personal Data Protection Act 2023, you are the data principal and we are the data fiduciary. You can ask for a summary of your data, fix it, erase it, take back a consent, name someone to act for you, and complain to the Grievance Officer and then the Data Protection Board of India.
- Three privacy choices start as no: remember which link brought me; show videos from YouTube and Vimeo; send me news and offers by email.
- Wellbeing tools are not medical care, a diagnosis or a treatment. Money tools are not financial, tax or investment advice. Agreement templates are a starting point, not legal advice.
- The terms are a plain-language draft that a lawyer still has to review for each country.
- Companies that handle personal data: Cloudflare (hosting and database), Resend (email, United States), Razorpay (payments, India), Anthropic (Content writing, United States), OpenRouter and its model hosts (the assistant and the Companion, with a plan), Cloudflare Workers AI, YouTube (Google) and Vimeo, Google YouTube Data API (view counts), Agent Reach (our own research bridge). The full list: ${abs('/subprocessors')}
- Refunds go back the way you paid, by UPI, card or bank, through Razorpay. That usually takes five to seven working days from when the refund is issued.

Emergency: kreators.app cannot help in an emergency. If you might hurt yourself, call your local emergency number or go to the nearest hospital, and tell someone you trust. In India, call Tele-MANAS on 14416, day or night.

## Contact

- The business that runs kreators.app, its email and the Grievance Officer for India: ${abs('/contact')}
- Help inside the app is fastest. A person answers.
`;

// Nothing is written until every check above passed.
for (const [file, html] of outputs) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}
for (const [name, text] of [
  ['robots.txt', robots],
  ['llms.txt', llms],
  ['llms-full.txt', llmsFull],
]) {
  writeFileSync(join(dist, name), text);
}

if (createHash('sha256').update(readFileSync(indexPath)).digest('hex') !== indexHash) fail('dist/index.html changed while the pages were written.');
stop();

console.log(`build-static: ${outputs.length} pages, robots.txt, llms.txt and llms-full.txt for ${ORIGIN}`);
