// A probeFile for shoot.mjs (SHOOT_PROBE=scripts/smoke/bento-probe.js).
// Evaluated in the page: finds every grid of tiles or cards (a CSS grid of two or more columns whose cells are cards, a heading cell that
// takes the whole row aside) and reports, for each visual row of it:
//   - a row that does not reach the grid's full width (a ragged or half-empty last row, a lone tile, a hole),
//   - a row whose tiles are not one width while the grid's columns are (a tile oddly wider than its row-mates),
//   - a row of one tile in a grid whose other rows hold three or more (a lone tile, even when it is stretched).
// A feature cell that spans two grid rows is the meant exception (the bento's biggest cell): it still counts toward each row's width.
// Left out: a grid of seven columns (a week, where a column is a weekday), a grid that scrolls sideways (a row of cards), and paper.
// It also reports a grid holding more than 12 tiles: past that they go in categories, each its own grid under its own heading (the founder,
// 2026-11-07; components/TileGroups.tsx). A list a person pages or filters through, whose tiles are items and not numbers, says so with
// `data-tile-list="<why>"` on the grid or a parent and is left out of this one check (never out of the row checks above).
// Each hit is { line }. The rule the grids follow is `evenSpans` in apps/web/src/lib/bento.ts.
(() => {
  const hits = [];
  // Two grids can share a selector (Home's Go to has one per group), so each is numbered rather than folded into the first.
  const seen = new Map();
  const where = (el) => {
    const parts = [];
    let e = el;
    for (let i = 0; e && e !== document.body && i < 3; i += 1) {
      const cls = (e.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
      parts.unshift(`${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${cls ? `.${cls}` : ''}`);
      e = e.parentElement;
    }
    return parts.join(' > ');
  };
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed' || cs.position === 'absolute') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // A box that looks like a card: rounded and either filled or outlined (the same reading as height-probe.js).
  const cardLike = (el) => {
    const cs = getComputedStyle(el);
    const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
    let alpha = 0;
    if (m) {
      const p = m[1].split(',').map(parseFloat);
      alpha = p.length > 3 ? p[3] : 1;
    }
    const filled = alpha > 0.05 || cs.backgroundImage !== 'none';
    const outlined = parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none';
    return parseFloat(cs.borderTopLeftRadius) >= 12 && (filled || outlined);
  };
  // The box the eye sees for a cell: the cell itself when it is a card, else the first card down its single-child chain.
  const visual = (cell) => {
    let e = cell;
    for (let i = 0; e && i < 4; i += 1) {
      if (cardLike(e)) return e;
      const kids = [...e.children].filter(visible);
      if (kids.length !== 1) return null;
      e = kids[0];
    }
    return null;
  };
  const TILE_MAX = 12;
  const tileWords = (c) => (c.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 32);
  const SKIP = '.legal-doc, .legal-root, .legal-invoice, .print-doc, .month-print-sheet, table, svg, [aria-hidden="true"], [data-rect-quiet]';
  for (const grid of document.querySelectorAll('body *')) {
    if (hits.length > 40) break;
    const cs = getComputedStyle(grid);
    if (cs.display !== 'grid' && cs.display !== 'inline-grid') continue;
    if (!visible(grid) || grid.closest(SKIP)) continue;
    if (/(auto|scroll)/.test(cs.overflowX) || grid.scrollWidth > grid.clientWidth + 2) continue;
    const tracks = cs.gridTemplateColumns.split(/\s+/).filter((t) => /px$/.test(t)).map(parseFloat);
    if (tracks.length < 2 || tracks.length === 7) continue;
    const gr = grid.getBoundingClientRect();
    const innerLeft = gr.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
    const innerRight = gr.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
    const inner = innerRight - innerLeft;
    const gap = parseFloat(cs.columnGap) || 0;
    const cells = [...grid.children].filter(visible);
    if (cells.length < 2) continue;
    // Too many in one block: counted before the strict reading below, so a cell holding a card and a caption counts as a tile as well.
    if (cells.length > TILE_MAX && !grid.matches('main, .screen') && !grid.closest('[data-tile-list]')) {
      const holdsCard = (c) => cardLike(c) || [...c.querySelectorAll('*')].slice(0, 12).some((d) => visible(d) && cardLike(d) && d.getBoundingClientRect().width >= c.getBoundingClientRect().width - 4);
      const big = cells.filter((c) => {
        const r = c.getBoundingClientRect();
        return r.height >= 56 && r.width >= 56 && holdsCard(c);
      });
      if (big.length > TILE_MAX) hits.push({ line: `${where(grid)}: ${big.length} tiles in one block ("${tileWords(big[0])}" first). Put them in categories (TileGroups), or mark a paged list with data-tile-list` });
    }
    // Every cell is a card, or a heading that takes the whole row; anything else means this grid lays out a form or a page, not tiles.
    const tiles = [];
    let tileGrid = true;
    for (const c of cells) {
      const v = visual(c);
      const cr = c.getBoundingClientRect();
      if (!v) {
        if (cr.width >= inner - 4) continue;
        tileGrid = false;
        break;
      }
      const r = v.getBoundingClientRect();
      if (r.height < 56 || r.width < 56) {
        tileGrid = false;
        break;
      }
      const rowSpan = /span\s*([2-9])/.test(getComputedStyle(c).gridRowEnd) || /span\s*([2-9])/.test(getComputedStyle(c).gridRowStart);
      tiles.push({ c, v, cell: cr, r, rowSpan });
    }
    if (!tileGrid || tiles.length < 2) continue;
    // The visual rows: every distinct top edge, and the tiles that cover it (a tile spanning two rows covers both).
    const tops = [];
    for (const t of tiles) if (!tops.some((x) => Math.abs(x - t.cell.top) <= 3)) tops.push(t.cell.top);
    tops.sort((a, b) => a - b);
    const rows = tops.map((top) => tiles.filter((t) => t.cell.top <= top + 3 && t.cell.bottom > top + 3));
    if (rows.length === 1 && rows[0].length < 2) continue;
    const equalTracks = Math.max(...tracks) - Math.min(...tracks) <= 1.5;
    const counts = rows.map((r) => r.length);
    const most = Math.max(...rows.map((r) => r.length));
    const key = where(grid);
    const problems = [];
    rows.forEach((row, n) => {
      const covered = row.reduce((s, t) => s + t.cell.width, 0) + gap * (row.length - 1);
      const left = Math.min(...row.map((t) => t.cell.left));
      const right = Math.max(...row.map((t) => t.cell.right));
      if (covered < inner - 4 || right < innerRight - 4 || left > innerLeft + 4) {
        problems.push(`row ${n + 1} of ${rows.length} (${row.length} tile${row.length === 1 ? '' : 's'}) fills ${Math.round((covered / inner) * 100)}% of the width`);
        return;
      }
      const flat = row.filter((t) => !t.rowSpan);
      if (equalTracks && flat.length >= 2) {
        const ws = flat.map((t) => Math.round(t.r.width));
        if (Math.max(...ws) - Math.min(...ws) > 4) problems.push(`row ${n + 1} tiles are ${ws.join(', ')}px wide`);
      }
      if (row.length === 1 && !row[0].rowSpan && most >= 3) problems.push(`row ${n + 1} holds one tile beside rows of ${most}`);
    });
    const nth = (seen.get(key) ?? 0) + 1;
    seen.set(key, nth);
    if (!problems.length) continue;
    hits.push({ line: `${key}${nth > 1 ? ` (#${nth})` : ''}: ${tracks.length} columns, ${counts.join('+')} tiles a row; ${problems.join('; ')}` });
  }
  return hits;
})()
