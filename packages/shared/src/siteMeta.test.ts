import { describe, expect, it } from 'vitest';
import { PAYMENTS_LIVE, PLAN_CURRENCY, PLANS, BOOKS, REWARDS, formatCount } from './index';
import {
  DEFAULT_SITE_URL,
  FEATURE_PAGE_SLUGS,
  INVITE_FAQ,
  SITE_FAQ,
  SITE_PAGES,
  booksLd,
  breadcrumbLd,
  escapeHtml,
  eventLd,
  faqLd,
  itemListLd,
  jsonForHtml,
  metaForPath,
  organizationLd,
  siteFaq,
  siteUrl,
  webAppLd,
  websiteLd,
} from './siteMeta';
import { SITE_FEATURES } from '../../../apps/web/src/site/content';

const O = 'https://kreators.app';

describe('site pages', () => {
  it('lists every stable public route once', () => {
    const paths = SITE_PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of ['/', '/features', '/7rp', '/explore', '/events', '/pricing', '/terms', '/privacy', '/refunds', '/contact', '/subprocessors', '/copyright', '/licences']) {
      expect(paths).toContain(p);
    }
    for (const slug of FEATURE_PAGE_SLUGS) expect(paths).toContain(`/features/${slug}`);
    expect(paths.length).toBe(13 + FEATURE_PAGE_SLUGS.length);
  });

  it('finds every page by its path, with or without a trailing slash, and nothing by a prototype key', () => {
    for (const p of SITE_PAGES) {
      expect(metaForPath(p.path)).toBe(p);
      if (p.path !== '/') expect(metaForPath(`${p.path}/`)).toBe(p);
      expect(metaForPath(`${p.path}?x=1#y`)).toBe(p);
    }
    for (const bad of ['/constructor', '/__proto__', '/features/observability', '/features/toString', 'constructor', '/nope']) expect(metaForPath(bad)).toBeNull();
  });

  it('keeps titles short and descriptions the right length, in the product name as it is written', () => {
    for (const p of SITE_PAGES) {
      expect(p.title.length, p.path).toBeLessThanOrEqual(60);
      expect(p.title, p.path).toContain('kreators.app');
      expect(p.description.length, `${p.path}: ${p.description.length}`).toBeGreaterThanOrEqual(120);
      expect(p.description.length, `${p.path}: ${p.description.length}`).toBeLessThanOrEqual(170);
      expect(p.h1.trim().length, p.path).toBeGreaterThan(0);
      for (const text of [p.title, p.description, p.h1, p.opening ?? '']) {
        expect(text).not.toMatch(/Kreators Life/i);
        expect(text).not.toContain('Kreators.app');
        expect(text).not.toContain('KREATORS.APP');
      }
    }
  });

  it('has a feature page for each app the site lists, and the books', () => {
    const keys = SITE_FEATURES.map((m) => m.key).sort();
    expect([...FEATURE_PAGE_SLUGS].sort()).toEqual([...keys, 'books'].sort());
    expect(FEATURE_PAGE_SLUGS).not.toContain('observability');
    for (const m of SITE_FEATURES) expect(metaForPath(`/features/${m.key}`)?.h1).toBe(m.name);
  });

  it('names the app count from the list, never a number typed apart', () => {
    const n = FEATURE_PAGE_SLUGS.length - 1;
    expect(metaForPath('/features')?.title).toContain(`${n} apps`);
  });
});

describe('fair questions', () => {
  it('put the invite question second while Invite only is on', () => {
    expect(siteFaq(false)).toEqual(SITE_FAQ);
    expect(siteFaq(true)[1]).toBe(INVITE_FAQ);
    expect(siteFaq(true).length).toBe(SITE_FAQ.length + 1);
  });
});

describe('origins and escaping', () => {
  it('trims a trailing slash and falls back to the default', () => {
    expect(DEFAULT_SITE_URL).toBe('https://kreators.app');
    expect(siteUrl('https://example.test/')).toBe('https://example.test');
    expect(siteUrl(' https://example.test// ')).toBe('https://example.test');
    expect(siteUrl('')).toBe(DEFAULT_SITE_URL);
    expect(siteUrl(undefined)).toBe(DEFAULT_SITE_URL);
    expect(siteUrl(null)).toBe(DEFAULT_SITE_URL);
    expect(siteUrl('not a url')).toBe(DEFAULT_SITE_URL);
  });

  it('makes JSON safe inside a script tag and reads back unchanged', () => {
    const value = { a: '</script><script>alert(1)</script>', b: '<!-- x -->', c: 'a & b', d: 'line\u2028sep\u2029para', e: ['>'] };
    const out = jsonForHtml(value);
    expect(out.toLowerCase()).not.toContain('</script');
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).not.toContain('&');
    expect(out).not.toContain('\u2028');
    expect(out).not.toContain('\u2029');
    expect(JSON.parse(out)).toEqual(value);
  });

  it('escapes text for HTML', () => {
    expect(escapeHtml(`<b class="x">'Tom' & Jerry</b>`)).toBe('&lt;b class=&quot;x&quot;&gt;&#39;Tom&#39; &amp; Jerry&lt;/b&gt;');
  });
});

describe('JSON-LD', () => {
  it('leaves out every empty business field', () => {
    const empty = organizationLd(O, { name: '', email: '  ', address: '', registration: '', vat: '' }) as Record<string, unknown>;
    for (const k of ['legalName', 'email', 'address', 'taxID', 'identifier']) expect(empty).not.toHaveProperty(k);
    expect(empty.name).toBe('kreators.app');
    expect(empty['@id']).toBe(`${O}/#organization`);
    const points = empty.contactPoint as Record<string, unknown>[];
    expect(points).toHaveLength(1);
    expect(points[0]).not.toHaveProperty('email');
    expect(JSON.stringify(empty)).not.toContain('{{');

    const full = organizationLd(O, { name: 'Acme Pvt Ltd', email: 'hi@acme.test', address: 'Street 1', registration: 'R1', vat: 'V1', grievanceName: 'Asha' }) as Record<string, unknown>;
    expect(full.legalName).toBe('Acme Pvt Ltd');
    expect(full.email).toBe('hi@acme.test');
    expect(full.taxID).toBe('V1');
    expect(full.identifier).toBe('R1');
    const fullPoints = full.contactPoint as Record<string, unknown>[];
    expect(fullPoints).toHaveLength(2);
    expect(fullPoints[1]).toEqual({ '@type': 'ContactPoint', contactType: 'Grievance Officer (India)', name: 'Asha', areaServed: 'IN' });
  });

  it('prices the app from the plans, with the free offer first', () => {
    const app = webAppLd(O) as { offers: { name: string; price: string; priceCurrency: string }[]; aggregateRating?: unknown };
    expect(app.offers[0]).toMatchObject({ name: 'Free', price: '0', priceCurrency: PLAN_CURRENCY });
    const plans = Object.values(PLANS);
    expect(app.offers.slice(1)).toHaveLength(plans.length);
    plans.forEach((p, i) => {
      const o = app.offers[i + 1];
      expect(Number(o.price) * 100).toBe(p.priceCents);
      expect(o.priceCurrency).toBe(PLAN_CURRENCY);
      expect(o.name).toContain(p.name);
    });
    expect(app).not.toHaveProperty('aggregateRating');
    expect(app).not.toHaveProperty('review');
  });

  it('builds the website, questions, breadcrumbs, lists and books', () => {
    expect((websiteLd(O) as { url: string }).url).toBe(`${O}/`);
    const faq = faqLd(SITE_FAQ) as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(faq.mainEntity).toHaveLength(SITE_FAQ.length);
    expect(faq.mainEntity[0].acceptedAnswer.text).toBe(SITE_FAQ[0].a);
    const crumbs = breadcrumbLd(O, [{ name: 'kreators.app', path: '/' }, { name: 'Features', path: '/features' }]) as { itemListElement: { position: number; item: string }[] };
    expect(crumbs.itemListElement[1]).toMatchObject({ position: 2, item: `${O}/features` });
    const list = itemListLd(O, [{ name: 'School', path: '/features/school' }]) as { numberOfItems: number; itemListElement: { url: string }[] };
    expect(list.numberOfItems).toBe(1);
    expect(list.itemListElement[0].url).toBe(`${O}/features/school`);
    const books = booksLd(O) as Record<string, unknown>[];
    expect(books).toHaveLength(BOOKS.length);
    for (const b of books) {
      expect(String(b.image)).toMatch(/^https:\/\/kreators\.app\/books\//);
      expect(b).not.toHaveProperty('offers');
    }
    expect(books[1].publisher).toEqual({ '@type': 'Organization', name: 'FyndFlow' });
    expect(books[2].publisher).toEqual({ '@type': 'Person', name: 'Shubham Aggarwal' });
    expect(books[0]).not.toHaveProperty('publisher');
  });

  it('keeps an event’s typed words as they were and makes them safe only when written into the page', () => {
    const title = '</script><b>x & "y"';
    const ev = {
      id: 'ev1', title, description: 'A <i>long</i> evening. '.repeat(40), startsAt: '2026-12-01T13:30:00.000Z', endsAt: '2026-12-01T15:30:00.000Z',
      online: false, venue: 'Cafe <One>', hostName: 'Asha', status: 'published', pricePoints: 0, seatsLeft: 0, image: '/api/public/media/m1',
    };
    const ld = eventLd(O, ev) as Record<string, any>;
    expect(ld.name).toBe(title);
    expect(ld.description.length).toBeLessThanOrEqual(300);
    expect(ld.location).toEqual({ '@type': 'Place', name: 'Cafe <One>', address: 'Cafe <One>' });
    expect(ld.image).toEqual([`${O}/api/public/media/m1`]);
    expect(ld.offers).toMatchObject({ price: '0', priceCurrency: 'INR', availability: 'https://schema.org/SoldOut' });
    expect(ld.eventStatus).toBe('https://schema.org/EventScheduled');
    const html = jsonForHtml(ld);
    expect(html.toLowerCase()).not.toContain('</script');
    expect(JSON.parse(html)).toEqual(ld);

    const online = eventLd(O, { ...ev, online: true, pricePoints: 50, seatsLeft: null, status: 'cancelled', image: null }) as Record<string, any>;
    expect(online.location).toEqual({ '@type': 'VirtualLocation', url: `${O}/events/ev1` });
    expect(online).not.toHaveProperty('offers');
    expect(online).not.toHaveProperty('isAccessibleForFree');
    expect(online).not.toHaveProperty('image');
    expect(online.eventStatus).toBe('https://schema.org/EventCancelled');

    const open = eventLd(O, { ...ev, seatsLeft: null }) as Record<string, any>;
    expect(open.offers.availability).toBe('https://schema.org/InStock');
  });
});

describe('words that follow the switches', () => {
  it('says "not on sale" only while payments are off, in the questions and on every page', () => {
    const words = JSON.stringify([SITE_FAQ, INVITE_FAQ, SITE_PAGES]);
    if (PAYMENTS_LIVE) expect(words).not.toMatch(/not on sale/i);
    else expect(SITE_FAQ[0].a).toMatch(/not on sale yet/);
  });

  it('names the books\' points from Rewards, never a typed figure', () => {
    const costs = new Set(BOOKS.map((b) => REWARDS.find((r) => r.key === b.rewardKey)?.cost));
    const opening = metaForPath('/features/books')?.opening ?? '';
    if (costs.size === 1 && typeof [...costs][0] === 'number') expect(opening).toContain(`${formatCount([...costs][0] as number)} points`);
    else expect(opening).not.toMatch(/points/);
  });

  it('says Plan my week suggests, since nothing is written until Keep', () => {
    const daily = metaForPath('/features/today');
    expect(daily?.description).toContain('suggests a day');
    expect(`${daily?.description} ${daily?.opening}`).not.toMatch(/gives each/);
  });
});
