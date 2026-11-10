// A probeFile for shoot.mjs (SHOOT_PROBE=scripts/smoke/spacing-probe.js), and for drive-popups.mjs (POPUP_PROBE=…).
// Spacing that is wrong (the founder, 2026-11-08: "check redundant spacing like this and improve all over the app", after the hours
// line in Plan my week sat right on its ruler's numbers). Four kinds, each hit { kind, line, gap?, near, y }:
//
//   touching  what one block draws and what the block right under it in the same column draws, too close: words over a control, a box
//             or a picture, or a control over words, or words over a slider's own numbers, under 6px; two plain lines of words, or
//             words over a tag or a dot (a box no taller than 28px), under 2px, since a title over its note is set tight on purpose.
//             What is drawn is measured, never the element's box: words by their ink (each line's glyphs, from the font's own metrics
//             through a canvas, so descenders count), an svg by what it draws, a box that fills, edges or shadows by its edge.
//   doubled   two spacings stacked where one was meant: in a flex or grid stack (whose margins never collapse) a gap made of two of the
//             stack's gap and the two margins, each 16 or more; an empty element in a gap stack keeping a second gap; a card that pads
//             12 or more holding a lone wrapper that pads or pushes 12 or more again, or whose first or last child adds a 12px margin;
//             in a list of one kind, one gap over 1.6 times the one most of them share and 8px more.
//   uneven    in a list of one kind (three or more stacked siblings of the same tag and classes), a gap more than 4px off the one most
//             of them share (or no two the same), unless the lower one starts a group with a heading; or a list whose boxes all agree
//             where one draws 10px and 30% more empty room above it than the middle one.
//   empty     an in-flow element over 24 by 24 with nothing drawn in it, unless it is decoration (aria-hidden), its room is kept on
//             purpose (a height set inline, as Daily's focus slot keeps the panel's), it waits for a picture or a frame, or it is a
//             grid's blank cell; or a first or last child with no height and nothing in it whose margin still adds room.
//
// Left out: inline runs of a sentence (one line box), the parts inside one small control (a button's icon and words), table cells,
// chart SVG, the paper that is edited in place and printed paper, hidden and screen-reader-only text, and anything out of the flow.
// On a page run the open dialogs are left to the popup run; set data-spacing-root on an element to measure only inside it.
(() => {
  // Measured on the ink, so a line's descenders count: words over a control, a box or a picture (or a control's own words, a ruler's
  // numbers) under 6px read as touching; two plain lines of words, set tight on purpose as a title over its note, only under 2px.
  const TOUCH = 6;
  const TOUCH_TEXT = 2;
  const hits = [];
  const seen = new Set();
  // A main action held at the foot (StickyAction's data-stuck, FollowAction's bar) floats over the words scrolling behind it on its own
  // surface, so it is measured in its place in the flow, never while it is held. A scroll made just before the probe has not yet told the
  // bar it is held (that comes a frame later), so the probe reads it from where sticky put it.
  for (const bar of document.querySelectorAll('[data-sticky-action]')) {
    const cs = getComputedStyle(bar);
    if (cs.position !== 'sticky') continue;
    const box = bar.closest('.dialog-panel');
    const bottom = box ? box.getBoundingClientRect().top + box.clientTop + box.clientHeight - (parseFloat(getComputedStyle(box).paddingBottom) || 0) : window.innerHeight;
    if (Math.abs(bar.getBoundingClientRect().bottom - (bottom - (parseFloat(cs.bottom) || 0))) < 1.5) bar.setAttribute('data-probe-held', '');
    else bar.removeAttribute('data-probe-held');
  }
  const SKIP = '.legal-doc, .legal-root, .legal-invoice, .print-doc, .month-print-sheet, [contenteditable]:not([contenteditable="false"]), svg, table, [role="table"], [role="grid"], pre, code, .sr-only, script, style, template, noscript, [data-sticky-action][data-stuck], [data-probe-held], .follow-action:not([hidden])';
  const rootEl = document.querySelector('[data-spacing-root]') ?? document.body;
  const pageRun = rootEl === document.body;
  const styles = new Map();
  const css = (el) => {
    let s = styles.get(el);
    if (!s) {
      s = getComputedStyle(el);
      styles.set(el, s);
    }
    return s;
  };
  const px = (v) => parseFloat(v) || 0;
  const alpha = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return c === 'transparent' ? 0 : 1;
    const p = m[1].split(/[ ,/]+/).filter(Boolean);
    return p.length > 3 ? Number(p[3]) : 1;
  };
  const where = (el) => {
    if (!el || el.nodeType !== 1) return '(text)';
    const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter((c) => c && !/[[\]:/@]/.test(c)).slice(0, 3).join('.');
    const id = el.id ? `#${el.id}` : '';
    const p = el.parentElement;
    const pc = p ? (p.getAttribute('class') ?? '').split(/\s+/).filter((c) => c && !/[[\]:/@]/.test(c)).slice(0, 2).join('.') : '';
    return `${p ? `${p.tagName.toLowerCase()}${pc ? `.${pc}` : ''} > ` : ''}${el.tagName.toLowerCase()}${id}${cls ? `.${cls}` : ''}`;
  };
  const words = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
  // The nearest heading above an element, so a hit can be found on the page.
  const headings = [...document.querySelectorAll('h1, h2, h3, h4, [role="heading"]')].filter((h) => h.getClientRects().length);
  const near = (el) => {
    const r = el.getBoundingClientRect();
    let best = null;
    for (const h of headings) {
      const hr = h.getBoundingClientRect();
      if (hr.top <= r.top + 1 && (!best || hr.top > best.getBoundingClientRect().top)) best = h;
    }
    return best ? words(best) : '';
  };
  const drawsBox = (el) => {
    const cs = css(el);
    if (cs.boxShadow !== 'none' || alpha(cs.backgroundColor) > 0.02 || cs.backgroundImage !== 'none') return true;
    return ['Top', 'Right', 'Bottom', 'Left'].some((s) => px(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none' && alpha(cs[`border${s}Color`]) > 0.05);
  };
  const pseudoDrawn = (el) =>
    ['::before', '::after'].some((w) => {
      const ps = getComputedStyle(el, w);
      if (!ps.content || ps.content === 'none' || ps.content === 'normal' || ps.display === 'none') return false;
      return ps.content !== '""' || alpha(ps.backgroundColor) > 0.02 || ps.backgroundImage !== 'none';
    });
  const LEAF = /^(IMG|SVG|CANVAS|VIDEO|IFRAME|INPUT|SELECT|TEXTAREA|PROGRESS|METER|OBJECT|EMBED|PICTURE)$/i;
  // Ink: where the glyphs of a line sit, from the font's own metrics (a canvas measures them for the same font).
  const ctx = document.createElement('canvas').getContext('2d');
  const metrics = new Map();
  const inkOf = (cs, text) => {
    const font = cs.font || `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const key = `${font}|${text}`;
    let m = metrics.get(key);
    if (!m) {
      ctx.font = font;
      const t = ctx.measureText(text || 'x');
      m = { fa: t.fontBoundingBoxAscent, fd: t.fontBoundingBoxDescent, aa: t.actualBoundingBoxAscent, ad: t.actualBoundingBoxDescent };
      metrics.set(key, m);
    }
    return m;
  };
  const union = (a, b) => (!a ? b : !b ? a : { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) });
  const unionAll = (parts) => parts.reduce((acc, x) => union(acc, x), null);
  const range = document.createRange();
  // Each line of a text node as one part, from its glyphs' ink.
  const textParts = (node) => {
    const data = node.data;
    if (!/\S/.test(data)) return [];
    const cs = css(node.parentElement);
    if (cs.visibility === 'hidden' || alpha(cs.color) < 0.05) return [];
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    if (!rects.length) return [];
    const trimmed = data.trim();
    const first = inkOf(cs, trimmed.slice(0, 40));
    const last = inkOf(cs, trimmed.slice(-40));
    return rects.map((r, i) => {
      const top = r.bottom - (i === 0 ? first : last).fd - (i === 0 ? first : last).aa;
      const bottom = r.bottom - (i === rects.length - 1 ? last : first).fd + (i === rects.length - 1 ? last : first).ad;
      return { left: r.left, right: r.right, top: Math.min(top, bottom), bottom, k: 't' };
    });
  };
  const INTERACTIVE = 'button, a[href], [role="button"], [role="slider"], [role="switch"], [role="tab"], [role="checkbox"], [role="radio"], [role="combobox"], summary, input, select, textarea';
  const FORM = /^(INPUT|SELECT|TEXTAREA|PROGRESS|METER)$/i;
  const GRAPHIC = /^(IMG|CANVAS|VIDEO|IFRAME|OBJECT|EMBED|PICTURE)$/i;
  // What an svg draws, not its box: its contents' bounding box on the screen.
  const svgPart = (el, r) => {
    try {
      const bb = el.getBBox();
      const m = el.getScreenCTM();
      if (!m || bb.width + bb.height === 0) return null;
      // The four corners through the whole matrix (a ring is often turned a quarter), grown by a stroke's width so a line counts.
      const corners = [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const part = { left: Math.max(r.left, Math.min(...xs) - 1), right: Math.min(r.right, Math.max(...xs) + 1), top: Math.max(r.top, Math.min(...ys) - 1), bottom: Math.min(r.bottom, Math.max(...ys) + 1), k: 'g' };
      // A small icon is read like a glyph of the line it sits in.
      if (part.bottom - part.top <= 20 && part.right - part.left <= 24) part.k = 't';
      return part.bottom > part.top && part.right > part.left ? part : null;
    } catch {
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, k: 'g' };
    }
  };
  // What is drawn in an element, as parts: its own edge when it draws a box (k 'c' when it is a control, else 'b'), a picture or an
  // svg as what it draws ('g'), else whatever is drawn inside it, each line of words its own part ('t'). Empty when nothing is.
  const vis = new Map();
  const visParts = (el) => {
    if (vis.has(el)) return vis.get(el);
    let out = [];
    const cs = css(el);
    // display: contents draws no box of its own: what it holds is what is drawn.
    if (cs.display === 'contents') {
      for (const c of el.childNodes) {
        if (c.nodeType === 3) out.push(...textParts(c));
        else if (c.nodeType === 1) out.push(...visParts(c));
      }
      vis.set(el, out);
      return out;
    }
    if (cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.02 && cs.clipPath !== 'inset(50%)' && !el.classList.contains('sr-only') && el.getClientRects().length) {
      const r = el.getBoundingClientRect();
      const box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      if (r.width === 0 || r.height === 0) out = [];
      else if (el.tagName === 'svg') out = [svgPart(el, r)].filter(Boolean);
      else if (FORM.test(el.tagName)) out = [{ ...box, k: 'c' }];
      else if (GRAPHIC.test(el.tagName)) out = [{ ...box, k: 'g' }];
      else if (drawsBox(el)) out = [{ ...box, k: el.matches(INTERACTIVE) ? 'c' : 'b' }];
      // Words or a picture drawn by CSS (the footer's wordmark is a ::before) fill the element.
      else if (pseudoDrawn(el)) out = [{ ...box, k: 'g' }];
      else {
        for (const c of el.childNodes) {
          if (c.nodeType === 3) out.push(...textParts(c));
          else if (c.nodeType === 1) out.push(...visParts(c));
        }
        // A box that clips cuts what pokes out of it.
        if (cs.overflow !== 'visible' && cs.overflow !== '') out = out.map((x) => ({ ...x, top: Math.max(x.top, r.top), bottom: Math.min(x.bottom, r.bottom), left: Math.max(x.left, r.left), right: Math.min(x.right, r.right) })).filter((x) => x.bottom > x.top && x.right > x.left);
        if (out.length > 400) out = [...out.slice(0, 200), ...out.slice(-200)];
        // The words a slider draws (a ruler's numbers) belong to the control.
        if (el.matches('[role="slider"], [role="progressbar"], [role="meter"]')) out = out.map((x) => ({ ...x, c: true }));
      }
    }
    vis.set(el, out);
    return out;
  };
  const visBox = (el) => unionAll(visParts(el));
  const isControl = (el) => el.nodeType === 1 && (LEAF.test(el.tagName) || el.matches('button, a[href], [role="button"], [role="slider"], [role="switch"], [role="tab"], [role="checkbox"], summary') || drawsBox(el));
  const hasText = (el) => (el.nodeType === 3 ? /\S/.test(el.data) : /\S/.test(el.textContent ?? ''));
  const inFlow = (cs) => cs.position !== 'absolute' && cs.position !== 'fixed' && cs.display !== 'none' && cs.display !== 'contents' && cs.float === 'none';
  const inline = (cs) => /^inline/.test(cs.display) && cs.display !== 'inline-table';
  // Small controls keep their insides to themselves: a button's icon and words are one thing.
  const SMALL_CONTROL = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="option"], summary, label, select';
  const insideSmall = (el) => {
    for (let e = el; e && e !== rootEl; e = e.parentElement) if (e.matches?.(SMALL_CONTROL) && e.getBoundingClientRect().height < 64) return true;
    return false;
  };
  const report = (kind, el, line, extra = {}) => {
    const key = `${kind}|${line}`;
    if (seen.has(key) || hits.length >= 80) return;
    seen.add(key);
    const at = (el.nodeType === 1 ? el : el.parentElement)?.getBoundingClientRect();
    hits.push({ kind, line: `${kind} ${line}`, near: near(el), y: at ? Math.round(at.top + window.scrollY) : 0, ...extra });
  };
  // The items a container lays out: its in-flow element children, and in a block box each run of inline content as one line item.
  const itemsOf = (p, pcs) => {
    const flexOrGrid = /flex|grid/.test(pcs.display);
    const items = [];
    let run = null;
    const flush = () => {
      if (run) items.push(run);
      run = null;
    };
    // A child with display: contents lays its own children out in this box.
    const flat = (node) => [...node.childNodes].flatMap((c) => (c.nodeType === 1 && css(c).display === 'contents' ? flat(c) : [c]));
    for (const c of flat(p)) {
      if (c.nodeType === 3) {
        if (!/\S/.test(c.data)) continue;
        const ink = textParts(c);
        if (!ink.length) continue;
        if (!run) run = { el: p, nodes: [], box: null, parts: [], inline: true, empty: false };
        run.nodes.push(c);
        range.selectNodeContents(c);
        const rr = range.getBoundingClientRect();
        run.box = union(run.box, { left: rr.left, top: rr.top, right: rr.right, bottom: rr.bottom });
        run.parts.push(...ink);
        continue;
      }
      if (c.nodeType !== 1) continue;
      const cs = css(c);
      if (!inFlow(cs)) continue;
      // A held main action is not a neighbour of what scrolls behind it.
      if (c.matches('[data-sticky-action][data-stuck], [data-probe-held], .follow-action')) continue;
      if (c.closest(SKIP) || c.getAttribute('aria-hidden') === 'true' && !hasText(c)) {
        if (!flexOrGrid && inline(cs)) continue;
      }
      const r = c.getBoundingClientRect();
      if (!flexOrGrid && inline(cs)) {
        if (!run) run = { el: p, nodes: [], box: null, parts: [], inline: true, empty: false };
        run.nodes.push(c);
        run.box = union(run.box, { left: r.left, top: r.top, right: r.right, bottom: r.bottom });
        run.parts.push(...visParts(c));
        continue;
      }
      flush();
      items.push({ el: c, box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, parts: visParts(c), empty: r.width === 0 || r.height === 0, cs });
    }
    flush();
    return items;
  };
  const overlapX = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const kindOf = (el) => (el.nodeType !== 1 ? '#line' : `${el.tagName}.${(el.getAttribute('class') ?? '').split(/\s+/).filter((c) => c && !/^(m[tby]?|-m[tby]?)-|open|active|selected|done|line-through|text-ink|opacity|^bg-|^border-|^toy|aria-|data-/.test(c)).sort().join('.')}`);
  const headed = (el) => el.nodeType === 1 && (/^H[1-6]$/.test(el.tagName) || Boolean(el.firstElementChild && /^H[1-6]$/.test(el.firstElementChild.tagName)) || el.getAttribute('role') === 'heading');

  for (const p of rootEl.querySelectorAll('*')) {
    if (hits.length >= 80) break;
    if (p.closest(SKIP)) continue;
    if (pageRun && p.closest('[role="dialog"]')) continue;
    const pcs = css(p);
    if (pcs.display === 'none' || pcs.visibility === 'hidden' || !p.getClientRects().length) continue;
    if (inline(pcs) && !/flex|grid/.test(pcs.display)) continue;
    if (insideSmall(p)) continue;
    const items = itemsOf(p, pcs);
    if (items.length === 0) continue;
    const flexOrGrid = /flex|grid/.test(pcs.display);
    const column = flexOrGrid ? (pcs.display.includes('flex') ? /column/.test(pcs.flexDirection) : true) : true;
    const rowGap = px(pcs.rowGap);

    // touching and doubled margins: each item against the one right above it in the same column.
    for (let i = 0; i < items.length; i += 1) {
      const B = items[i];
      if (B.empty) continue;
      let A = null;
      for (let j = 0; j < items.length; j += 1) {
        const c = items[j];
        if (j === i || c.empty) continue;
        if (c.box.bottom > B.box.top + 2) continue;
        if (overlapX(c.box, B.box) < Math.min(8, (B.box.right - B.box.left) / 2)) continue;
        if (!A || c.box.bottom > A.box.bottom) A = c;
      }
      if (!A || !A.parts.length || !B.parts.length) continue;
      // The closest pair of what is drawn: a line of words (t) over words, a control (c), a box (b) or a picture (g); or a control
      // over words. Two lines of words with no margin between them (a title over its note) are set tight on purpose, so their ink
      // counts only under 2px.
      const aBottom = Math.max(...A.parts.map((x) => x.bottom));
      const bTop = Math.min(...B.parts.map((x) => x.top));
      let worst = null;
      for (const a of A.parts) {
        if (a.bottom < aBottom - 48) continue;
        for (const b of B.parts) {
          if (b.top > bTop + 48 || overlapX(a, b) <= 4) continue;
          const ok = a.k === 't' || ((a.k === 'c' || a.c) && b.k === 't');
          if (!ok) continue;
          const g = b.top - a.bottom;
          // A tag or a dot (a box no taller than a line of small words) sits under a title the way a note does.
          const small = (x) => x.k === 't' || (x.k === 'b' && x.bottom - x.top <= 28);
          const limit = small(a) && small(b) && !a.c && !b.c ? TOUCH_TEXT : TOUCH;
          if (g < limit && g > -12 && (!worst || g < worst.g)) worst = { g, a, b };
        }
      }
      if (worst) {
        const a = A.inline ? A.nodes.find((n) => n.nodeType === 1) ?? p : A.el;
        const b = B.inline ? B.nodes.find((n) => n.nodeType === 1) ?? p : B.el;
        const g = Math.round(worst.g * 10) / 10;
        const name = { t: 'words', c: 'a control', b: 'a box', g: 'a picture' };
        report('touching', b, `${where(a)} "${words(a.nodeType === 1 ? a : p)}" over ${where(b)} "${words(b)}": ${name[worst.a.k]} over ${name[worst.b.k]}, ${g}px between them`, { gap: g });
      }
      if (flexOrGrid && column && !A.inline && !B.inline) {
        const parts = [rowGap, px(A.cs?.marginBottom), px(B.cs?.marginTop)];
        if (parts.filter((x) => x >= 16).length >= 2) report('doubled', B.el, `${where(B.el)} "${words(B.el)}": ${Math.round(B.box.top - A.box.bottom)}px above it, made of gap ${parts[0]} + margin ${parts[1]} + margin ${parts[2]}`, { gap: Math.round(B.box.top - A.box.bottom) });
      }
    }

    // empty room: a first or last child that draws nothing and has no height, but whose margin still adds room to its parent (a list
    // with nothing in it yet, left with its mt-sm).
    for (const it of [items[0], items[items.length - 1]]) {
      if (!it || it.inline || !it.empty || items.length < 2) continue;
      const m = it === items[0] ? px(it.cs.marginTop) : px(it.cs.marginBottom) + px(it.cs.marginTop);
      if (m >= 8 && !visParts(it.el).length) report('empty', it.el, `${where(it.el)} holds nothing and has no height, yet its ${m}px margin adds room to ${where(p)}`, { gap: m });
    }

    // doubled by an empty element: in a flex or grid column with a gap, an element that draws nothing and takes no height still takes a
    // gap of its own, so the two things around it sit two gaps apart (a wrapper left in place when what it held is not shown).
    if (flexOrGrid && column && rowGap >= 8 && !/grid/.test(pcs.display)) {
      for (let i = 1; i < items.length - 1; i += 1) {
        const it = items[i];
        if (!it.empty || it.inline) continue;
        const before = items.slice(0, i).reverse().find((x) => !x.empty);
        const after = items.slice(i + 1).find((x) => !x.empty);
        if (!before || !after) continue;
        const g = after.box.top - before.box.bottom;
        if (g >= rowGap * 1.6) report('doubled', it.el, `${where(it.el)}, empty, sits between ${where(before.el)} and ${where(after.el)}: they are ${Math.round(g)}px apart where the stack's gap is ${rowGap}px`, { gap: Math.round(g) });
      }
    }

    // doubled inset: a card that pads holding a wrapper that draws nothing and pads or pushes on the same side again.
    if (drawsBox(p) && !LEAF.test(p.tagName) && !p.matches(SMALL_CONTROL)) {
      const kids = items.filter((x) => !x.empty);
      const first = kids[0];
      if (first && kids.length === 1 && !first.inline && !drawsBox(first.el) && !isControl(first.el)) {
        const pad = px(pcs.paddingTop);
        const inner = px(first.cs.paddingTop) + px(first.cs.marginTop);
        const padL = px(pcs.paddingLeft);
        const innerL = px(first.cs.paddingLeft) + px(first.cs.marginLeft);
        if (pad >= 12 && inner >= 12) report('doubled', first.el, `${where(p)} pads ${pad}px on top and the ${where(first.el)} inside it ${inner}px more`, { gap: pad + inner });
        else if (padL >= 12 && innerL >= 12) report('doubled', first.el, `${where(p)} pads ${padL}px on the left and the ${where(first.el)} inside it ${innerL}px more`, { gap: padL + innerL });
      } else if (first && !first.inline && column) {
        // The first thing in a padded card pushed down again by its own top margin (a margin never collapses into a padded box), or the
        // last one pushed up by its bottom margin.
        const last = kids[kids.length - 1];
        const pad = px(pcs.paddingTop);
        const padB = px(pcs.paddingBottom);
        if (pad >= 12 && px(first.cs.marginTop) >= 12) report('doubled', first.el, `${where(p)} pads ${pad}px on top and its first child ${where(first.el)} adds a ${px(first.cs.marginTop)}px margin`, { gap: pad + px(first.cs.marginTop) });
        if (last && !last.inline && last !== first && padB >= 12 && px(last.cs.marginBottom) >= 12) report('doubled', last.el, `${where(p)} pads ${padB}px at the foot and its last child ${where(last.el)} adds a ${px(last.cs.marginBottom)}px margin`, { gap: padB + px(last.cs.marginBottom) });
      }
    }

    // uneven and doubled gaps in a list of one kind: three or more siblings, stacked, gaps compared with their median.
    if (column) {
      const blocks = items.filter((x) => !x.inline);
      const runs = [];
      let cur = [];
      for (const it of blocks) {
        if (it.empty) continue;
        if (cur.length && kindOf(cur[0].el) !== kindOf(it.el)) {
          runs.push(cur);
          cur = [];
        }
        cur.push(it);
      }
      runs.push(cur);
      const isList = /^(UL|OL)$/.test(p.tagName) || p.getAttribute('role') === 'list';
      for (const runItems of runs) {
        if (runItems.length < 3) continue;
        // only a real stack: each one under the one before it
        const gaps = [];
        let stacked = true;
        for (let k = 1; k < runItems.length; k += 1) {
          const a = runItems[k - 1];
          const b = runItems[k];
          if (b.box.top < a.box.bottom - 1 || overlapX(a.box, b.box) < 8) {
            stacked = false;
            break;
          }
          gaps.push({ g: b.box.top - a.box.bottom, b, a, emptyBetween: blocks.slice(blocks.indexOf(a) + 1, blocks.indexOf(b)).some((x) => x.empty) || items.slice(items.indexOf(a) + 1, items.indexOf(b)).some((x) => x.empty) });
        }
        if (!stacked || gaps.length < 2) continue;
        if (!isList && !flexOrGrid && runItems[0].el.tagName === 'P') continue;
        const sorted = gaps.map((x) => x.g).sort((x, y) => x - y);
        // The gap the list means: the one most of its gaps share; when no two agree, the list is uneven as a whole.
        const counts = new Map();
        for (const g of sorted) counts.set(Math.round(g), (counts.get(Math.round(g)) ?? 0) + 1);
        const [common, times] = [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0] - y[0])[0];
        if (times < 2) {
          if (sorted[sorted.length - 1] - sorted[0] > 4) report('uneven', runItems[0].el, `${where(runItems[0].el)} and its ${runItems.length - 1} siblings: gaps of ${sorted.map((g) => Math.round(g)).join(', ')}px, no two the same`, { gap: Math.round(sorted[sorted.length - 1] - sorted[0]) });
          continue;
        }
        const median = common;
        // The boxes keep one gap, but what is drawn may not: one of them ends in (or starts with) room that holds nothing, so the eye
        // sees a bigger gap there (an empty list under a section's line). Judged on the drawn gap, against the run's middle one.
        if (sorted[sorted.length - 1] - sorted[0] <= 4 && !runItems.some((x) => drawsBox(x.el))) {
          const inkGaps = gaps.map((x) => (x.a.parts.length && x.b.parts.length ? { x, g: Math.min(...x.b.parts.map((q) => q.top)) - Math.max(...x.a.parts.map((q) => q.bottom)) } : null)).filter(Boolean);
          if (inkGaps.length >= 2) {
            const mid = inkGaps.map((y) => y.g).sort((u, v) => u - v)[Math.floor(inkGaps.length / 2)];
            for (const y of inkGaps) {
              // A list whose rows meet (an inset list's hairlines) has no gap to compare.
              if (mid >= 4 && y.g - mid > Math.max(10, 0.3 * mid) && !headed(y.x.b.el)) report('uneven', y.x.b.el, `${where(y.x.b.el)} "${words(y.x.b.el)}": ${Math.round(y.g)}px of empty room above what it draws, where the others in its list of ${gaps.length + 1} have about ${Math.round(mid)}px (their boxes all sit ${Math.round(median)}px apart)`, { gap: Math.round(y.g) });
            }
          }
        }
        for (const x of gaps) {
          if (headed(x.b.el)) continue;
          const d = x.g - median;
          if (Math.abs(d) <= 4) continue;
          const what = `${where(x.b.el)} "${words(x.b.el)}": ${Math.round(x.g)}px above it where most gaps in its list of ${gaps.length + 1} are ${Math.round(median)}px${x.emptyBetween ? ', an empty element sits between' : ''}`;
          if (median > 0 && x.g > 1.6 * median && d >= 8) report('doubled', x.b.el, what, { gap: Math.round(x.g) });
          else report('uneven', x.b.el, what, { gap: Math.round(x.g) });
        }
      }
    }
  }

  // empty: an in-flow element over 24 by 24 with nothing drawn in it.
  for (const el of rootEl.querySelectorAll('*')) {
    if (hits.length >= 80) break;
    if (el.closest(SKIP) || el.closest('[aria-hidden="true"], [inert]')) continue;
    if (pageRun && el.closest('[role="dialog"]')) continue;
    const cs = css(el);
    if (!inFlow(cs) || cs.visibility === 'hidden' || LEAF.test(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    if (r.height <= 24 || r.width <= 24) continue;
    if (visBox(el)) continue;
    // A room kept on purpose: a height set inline, a lazy picture or frame still to come, a busy region.
    if (el.style.height || el.style.minHeight || el.querySelector('img, iframe, video, canvas') || el.closest('[aria-busy="true"]')) continue;
    // A grid cell left blank to hold a place (a calendar's days before the 1st) is the grid's own layout.
    if (el.parentElement && /grid/.test(css(el.parentElement).display)) continue;
    // Only the outermost empty one.
    const parent = el.parentElement;
    if (parent && parent !== rootEl && !visBox(parent) && parent.getBoundingClientRect().height > 24 && inFlow(css(parent))) continue;
    // Something drawn out of the flow inside it (an absolute picture) still fills it.
    report('empty', el, `${where(el)}: ${Math.round(r.width)}x${Math.round(r.height)}px with nothing drawn in it`, { height: Math.round(r.height) });
  }
  return hits;
})();
