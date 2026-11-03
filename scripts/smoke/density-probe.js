// A probeFile for shoot.mjs (SHOOT_PROBE=scripts/smoke/density-probe.js), meant for phone width (390).
// Text that is too heavy to read on a phone, per docs/copy-brief.md (CopyOS adapted): short paragraphs, short card copy,
// and an action on the first screen. Reading pages (policy text, lessons, journal entries, chat, documents) are left out:
// they are meant to be read at length. Each hit is { line }.
(() => {
  const hits = [];
  const vh = window.innerHeight;
  const skip = (el) =>
    el.closest('.prose-long, .legal-doc, .legal-root, [data-reading], [role="log"], textarea, pre, code, .print-doc, [aria-hidden="true"], .sr-only, details:not([open]) > :not(summary)');
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const words = (t) => (t.trim().match(/[\p{L}\p{N}'’-]+/gu) ?? []).length;
  const where = (el) => {
    const parts = [];
    let e = el;
    for (let i = 0; e && e !== document.body && i < 3; i += 1) {
      const cls = (e.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
      parts.unshift(`${e.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`);
      e = e.parentElement;
    }
    return parts.join(' > ');
  };

  // 1. Paragraphs (and list items, ledes, card text) that wrap past four lines on a phone.
  for (const el of document.querySelectorAll('p, li, dd, figcaption, blockquote')) {
    if (hits.length > 60) break;
    if (!visible(el) || skip(el)) continue;
    if (el.querySelector('p, li, ul, ol')) continue;
    const lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.4;
    const lines = Math.round(el.getBoundingClientRect().height / lh);
    const w = words(el.textContent ?? '');
    if (lines > 4 && w > 30) hits.push({ line: `long paragraph: ${lines} lines, ${w} words: "${(el.textContent ?? '').trim().slice(0, 60)}…" (${where(el)})` });
  }

  // 2. Cards that carry too many words: a rounded, filled box with text but no long-form reading inside.
  for (const el of document.querySelectorAll('.rounded-card, .rounded-tile')) {
    if (hits.length > 60) break;
    if (!visible(el) || skip(el)) continue;
    // A rounded select or field is a control, not a card: its option list is not copy.
    if (el.matches('select, input, textarea')) continue;
    if (el.querySelector('.rounded-card, .rounded-tile, form, textarea, input, select, table')) continue;
    const w = words(el.innerText ?? '');
    if (w > 60) hits.push({ line: `dense card: ${w} words: "${(el.innerText ?? '').trim().replace(/\s+/g, ' ').slice(0, 60)}…" (${where(el)})` });
  }

  // 3. The first screen: how many words a person reads before the first button or link that does something.
  const main = document.querySelector('main, .screen') ?? document.body;
  let before = 0;
  let firstAction = null;
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n;
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.top > vh) break;
      if ((el.matches('button, a[href], [role="button"], input, select') && !el.closest('header nav, [aria-label="Breadcrumb"]')) && r.top + window.scrollY > 120) {
        firstAction = el;
        break;
      }
    } else if (n.parentElement && visible(n.parentElement) && !skip(n.parentElement)) {
      const r = n.parentElement.getBoundingClientRect();
      if (r.top <= vh) before += words(n.textContent ?? '');
    }
  }
  if (before > 90) hits.push({ line: `first screen: ${before} words before the first action${firstAction ? ` ("${(firstAction.textContent ?? '').trim().slice(0, 30)}")` : ' (no action on the first screen)'}` });

  // 4. The whole page: total reading words outside reading blocks, as a rough weight.
  const total = words([...document.querySelectorAll('p, li, dd, h1, h2, h3, figcaption')].filter((e) => visible(e) && !skip(e) && !e.querySelector('p, li')).map((e) => e.textContent).join(' '));
  if (total > 700) hits.push({ line: `heavy page: ${total} words outside reading blocks` });
  return hits;
})()
