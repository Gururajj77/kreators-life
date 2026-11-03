// A probeFile for shoot.mjs (SHOOT_PROBE=.../target-probe.js).
// Evaluated in the page: lists every tappable control (button, link, input, select, textarea, role=button/switch/tab/checkbox/
// radio/slider/link/menuitem, summary) whose box is smaller than 44 by 44 CSS px (Apple HIG minimum hit target).
// Left out: inline text links inside running text, controls inside a bigger tappable label or control (the bigger one is the
// target), hidden, disabled, aria-hidden and off-layout controls. Each hit is { line }. The first line is a summary.
(() => {
  const MIN = 44;
  const sel = '[contenteditable]:not([contenteditable="false"]), button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="switch"], [role="tab"], [role="checkbox"], [role="radio"], [role="slider"], [role="link"], [role="menuitem"], [tabindex]:not([tabindex="-1"])';
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
  const label = (el) =>
    (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.getAttribute('placeholder') || el.getAttribute('name') || el.type || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40);
  const shown = (el) => {
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    if (el.closest('[aria-hidden="true"], [inert]')) return false;
    const r = el.getBoundingClientRect();
    // Visually hidden until focused (sr-only: clipped to nothing); its focused size is what a finger meets.
    const cs = getComputedStyle(el);
    if (cs.clipPath === 'inset(50%)' || cs.clip === 'rect(0px, 0px, 0px, 0px)') return false;
    return r.width > 0 && r.height > 0;
  };
  // An inline link inside a run of text (a sentence) is exempt, like WCAG 2.5.8's inline exception.
  const inlineText = (el) => {
    // A word in a sentence that opens its meaning (a glossary term) is inline too, like a link in running text.
    if (el.tagName === 'BUTTON' && el.classList.contains('cursor-help')) {
      const para = el.closest('p');
      return Boolean(para) && (para.textContent ?? '').replace(el.textContent ?? '', '').trim().length >= 12;
    }
    if (el.tagName !== 'A') return false;
    const cs = getComputedStyle(el);
    if (!/^inline$/.test(cs.display)) return false;
    const p = el.parentElement;
    if (!p) return false;
    const own = [...p.childNodes].filter((n) => n !== el).map((n) => n.textContent ?? '').join('').trim();
    return own.length >= 12;
  };
  const big = (r) => r.width >= MIN && r.height >= MIN;
  // A ::before (or ::after) laid over the control as its hit area counts: an absolutely placed pseudo-element whose box,
  // from its insets or its own size, reaches 44 by 44. The finger meets that box, not the drawn one.
  const px = (v) => (/^-?[\d.]+px$/.test(v) ? parseFloat(v) : null);
  const pseudoBox = (el, r, which) => {
    const ps = getComputedStyle(el, which);
    if (!ps.content || ps.content === 'none' || ps.content === 'normal') return null;
    if (ps.position !== 'absolute' && ps.position !== 'fixed') return null;
    if (ps.display === 'none' || ps.pointerEvents === 'none') return null;
    const [t, rt, b, l] = [ps.top, ps.right, ps.bottom, ps.left].map(px);
    let w = px(ps.width) ?? 0;
    let h = px(ps.height) ?? 0;
    if (l !== null && rt !== null) w = Math.max(w, r.width - l - rt);
    if (t !== null && b !== null) h = Math.max(h, r.height - t - b);
    w = Math.max(w, px(ps.minWidth) ?? 0);
    h = Math.max(h, px(ps.minHeight) ?? 0);
    return { width: w, height: h };
  };
  const hitBig = (el, r) => {
    if (big(r)) return true;
    for (const which of ['::before', '::after']) {
      const p = pseudoBox(el, r, which);
      if (p && big({ width: Math.max(p.width, r.width), height: Math.max(p.height, r.height) })) return true;
    }
    return false;
  };
  // The paper's own inline edit regions (a contenteditable word, a VarField blank, an invoice's .inv-edit field inside
  // .legal-doc) are the document's text being written in place, not buttons: they are left out the way running text is.
  const paperText = (el) => Boolean(el.closest('.legal-doc')) && (el.isContentEditable || Boolean(el.closest('.paper-var, [contenteditable]')) || el.classList.contains('inv-edit'));
  const hits = [];
  const seen = new Set();
  let total = 0;
  for (const el of document.querySelectorAll(sel)) {
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
    if (!shown(el)) continue;
    if (paperText(el)) continue;
    const r = el.getBoundingClientRect();
    if (hitBig(el, r)) continue;
    if (inlineText(el)) continue;
    // A control wrapped by a larger tappable thing (a label, a button, a link) borrows its size.
    let wrapped = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (p.matches('label, button, a[href], [role="button"], [role="switch"], [role="checkbox"]')) {
        if (hitBig(p, p.getBoundingClientRect())) wrapped = true;
        break;
      }
    }
    if (wrapped) continue;
    // An input with an associated label that is big enough is fine (checkbox and radio in a row).
    if (el.labels && [...el.labels].some((l) => big(l.getBoundingClientRect()))) continue;
    total += 1;
    const key = `${where(el)}|${label(el)}|${Math.round(r.width)}x${Math.round(r.height)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (hits.length < 40) hits.push({ line: `${Math.round(r.width)}x${Math.round(r.height)} ${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''} "${label(el)}"  ${where(el)}` });
  }
  if (total) hits.unshift({ line: `SUMMARY ${total} small targets (${seen.size} distinct)` });
  return hits;
})();
