import { describe, expect, it } from 'vitest';
import { besideTrigger, overlapArea, pickTipSpot, tipCandidates, type Rect } from './tipPlace';

const size = { w: 60, h: 28 };
const inside = (r: Rect, v: { w: number; h: number }, m = 8) => r.x >= m && r.y >= m && r.x + r.w <= v.w - m && r.y + r.h <= v.h - m;
/** Beside the trigger, the 8px gap away (the founder, 2026-11-13: "the tooltip text should remain close to the button itself"). */
const besideAtGap = (r: Rect, t: Rect) => {
  const b = besideTrigger(r, t);
  return b.beside && b.gap === 8;
};

describe('tipPlace', () => {
  it('counts the area two rects share', () => {
    expect(overlapArea({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(25);
    expect(overlapArea({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(0);
  });

  it('a rail right of the panel with room picks the right, over the scrim', () => {
    // A laptop sheet: the panel 600 wide in the middle of a 1280 window, the rail 8px off its right edge.
    const panel = { x: 340, y: 100, w: 600, h: 500 };
    const trigger = { x: 948, y: 100, w: 44, h: 44 };
    const spot = pickTipSpot({ trigger, size, view: { w: 1280, h: 800 }, panel, obstacles: [], prefer: [['right', 'center'], ['top', 'end']] });
    expect(spot.side).toBe('right');
    expect(spot.clamped).toBe(false);
    expect(overlapArea({ x: spot.x, y: spot.y, ...size }, panel)).toBe(0);
    expect(besideAtGap({ x: spot.x, y: spot.y, ...size }, trigger)).toBe(true);
  });

  it('a 768 sheet with a 32px gutter names Close above it, off the panel', () => {
    const view = { w: 768, h: 1024 };
    const panel = { x: 84, y: 300, w: 600, h: 400 };
    const trigger = { x: 692, y: 300, w: 44, h: 44 };
    const spot = pickTipSpot({ trigger, size, view, panel, obstacles: [], prefer: [['right', 'center'], ['top', 'end'], ['bottom', 'end']] });
    const r = { x: spot.x, y: spot.y, ...size };
    expect(inside(r, view)).toBe(true);
    expect(overlapArea(r, panel)).toBe(0);
    expect(spot.side).toBe('top');
    expect(besideAtGap(r, trigger)).toBe(true);
  });

  it("with the panel at the window's top, it stands under the button, beside it", () => {
    const view = { w: 768, h: 1024 };
    const panel = { x: 84, y: 8, w: 600, h: 1000 };
    const trigger = { x: 692, y: 8, w: 44, h: 44 };
    // The next rail button right under it: below meets it, so the tip goes where it covers least, still beside its own button.
    const spot = pickTipSpot({ trigger, size, view, panel, obstacles: [{ x: 692, y: 60, w: 44, h: 44 }], prefer: [['right', 'center']] });
    const r = { x: spot.x, y: spot.y, ...size };
    expect(inside(r, view)).toBe(true);
    expect(besideAtGap(r, trigger)).toBe(true);
  });

  it('a phone rail row above the panel keeps Close’s name beside Close', () => {
    const view = { w: 390, h: 844 };
    const panel = { x: 0, y: 60, w: 390, h: 784 };
    const trigger = { x: 330, y: 8, w: 44, h: 44 };
    const other = { x: 278, y: 8, w: 44, h: 44 };
    const spot = pickTipSpot({ trigger, size, view, panel, obstacles: [other], prefer: [['top', 'end'], ['bottom', 'end']] });
    const r = { x: spot.x, y: spot.y, ...size };
    expect(inside(r, view)).toBe(true);
    expect(besideAtGap(r, trigger)).toBe(true);
    // Never past the next button to the room left of the whole row.
    expect(r.x + r.w).toBeGreaterThan(other.x);
  });

  it('with words above, it goes below', () => {
    const trigger = { x: 500, y: 300, w: 44, h: 44 };
    const words = { x: 300, y: 250, w: 400, h: 40 };
    const spot = pickTipSpot({ trigger, size, view: { w: 1280, h: 800 }, obstacles: [words], prefer: [['top', 'center'], ['bottom', 'center']] });
    expect(spot.side).toBe('bottom');
    expect(overlapArea({ x: spot.x, y: spot.y, ...size }, words)).toBe(0);
  });

  it('with words above and below, it goes to the side that is free', () => {
    const trigger = { x: 500, y: 300, w: 44, h: 44 };
    const obstacles = [
      { x: 300, y: 250, w: 400, h: 40 },
      { x: 300, y: 354, w: 400, h: 40 },
    ];
    const spot = pickTipSpot({ trigger, size, view: { w: 1280, h: 800 }, obstacles, prefer: [['bottom', 'center'], ['top', 'center']] });
    expect(['left', 'right']).toContain(spot.side);
    for (const o of obstacles) expect(overlapArea({ x: spot.x, y: spot.y, ...size }, o)).toBe(0);
    expect(besideAtGap({ x: spot.x, y: spot.y, ...size }, trigger)).toBe(true);
  });

  it('lines up on the trigger’s start or end edge when the centre would meet something', () => {
    const trigger = { x: 500, y: 300, w: 44, h: 44 };
    // Words just left of the trigger under it: centred below would meet them, start-aligned below does not.
    const words = { x: 440, y: 352, w: 54, h: 30 };
    const spot = pickTipSpot({ trigger, size, view: { w: 1280, h: 800 }, obstacles: [words], prefer: [['bottom', 'center']] });
    expect([spot.side, spot.align]).toEqual(['bottom', 'start']);
    expect(spot.x).toBe(500);
  });

  it('slides along its side to stay in the window, still beside the trigger', () => {
    const view = { w: 390, h: 844 };
    // A button at the window's right edge, wider tip than the trigger, the right side off the window and the end-aligned spot in use.
    const trigger = { x: 362, y: 400, w: 20, h: 20 };
    const spot = pickTipSpot({ trigger, size: { w: 120, h: 28 }, view, obstacles: [], prefer: [['bottom', 'center']] });
    const r = { x: spot.x, y: spot.y, w: 120, h: 28 };
    expect(inside(r, view)).toBe(true);
    expect(besideAtGap(r, trigger)).toBe(true);
  });

  it('never stands away from its trigger, however crowded the room', () => {
    // A bell between a badge and a theme button, a logo above and a nav pill below: nothing beside it is clear.
    const trigger = { x: 130, y: 64, w: 44, h: 44 };
    const obstacles = [
      { x: 25, y: 20, w: 120, h: 28 },
      { x: 12, y: 70, w: 84, h: 32 },
      { x: 182, y: 64, w: 44, h: 44 },
      { x: 12, y: 124, w: 216, h: 48 },
    ];
    const s = { w: 110, h: 31 };
    const spot = pickTipSpot({ trigger, size: s, view: { w: 1280, h: 800 }, obstacles, prefer: [['bottom', 'center']] });
    expect(spot.blocked).toBe(true);
    expect(besideAtGap({ x: spot.x, y: spot.y, ...s }, trigger)).toBe(true);
  });

  it('with no clear side, it covers words before a field', () => {
    const trigger = { x: 500, y: 300, w: 44, h: 44 };
    const field = { x: 0, y: 0, w: 1280, h: 330, cost: 40 };
    const words = { x: 0, y: 330, w: 1280, h: 470, cost: 10 };
    const spot = pickTipSpot({ trigger, size, view: { w: 1280, h: 800 }, obstacles: [field, words], prefer: [['top', 'center']] });
    expect(spot.side).toBe('bottom');
    expect(besideAtGap({ x: spot.x, y: spot.y, ...size }, trigger)).toBe(true);
  });

  it('when nothing fits, it is pulled inside the window', () => {
    const view = { w: 120, h: 60 };
    const trigger = { x: 20, y: 8, w: 44, h: 44 };
    const spot = pickTipSpot({ trigger, size: { w: 90, h: 28 }, view, obstacles: [], prefer: [['top', 'center']] });
    expect(spot.clamped).toBe(true);
    expect(inside({ x: spot.x, y: spot.y, w: 90, h: 28 }, view)).toBe(true);
  });

  it('a tie keeps the old side', () => {
    const trigger = { x: 500, y: 300, w: 44, h: 44 };
    const top = pickTipSpot({ trigger, size, view: { w: 1280, h: 800 }, obstacles: [], prefer: [['top', 'end']] });
    expect([top.side, top.align]).toEqual(['top', 'end']);
    const bottom = pickTipSpot({ trigger, size, view: { w: 1280, h: 800 }, obstacles: [], prefer: [['bottom', 'start']] });
    expect([bottom.side, bottom.align]).toEqual(['bottom', 'start']);
  });

  it('offers the four sides in three alignments, and slid spots only within the window', () => {
    const t = { x: 100, y: 100, w: 44, h: 44 };
    expect(tipCandidates(t, size).length).toBe(12);
    const all = tipCandidates({ x: 4, y: 100, w: 20, h: 44 }, { w: 120, h: 28 }, 8, { w: 390, h: 844 });
    expect(all.length).toBeGreaterThan(12);
    for (const c of all) expect(besideTrigger({ x: c.x, y: c.y, w: 120, h: 28 }, { x: 4, y: 100, w: 20, h: 44 }).beside).toBe(true);
  });

  it('every spot it picks on a crowded page is beside the trigger', () => {
    const view = { w: 1280, h: 800 };
    const obstacles = [];
    for (let i = 0; i < 300; i += 1) obstacles.push({ x: (i * 37) % 1200, y: (i * 53) % 760, w: 40, h: 16 });
    for (let k = 0; k < 40; k += 1) {
      const trigger = { x: 20 + ((k * 97) % 1200), y: 20 + ((k * 61) % 740), w: 44, h: 44 };
      const s = { w: 80 + (k % 5) * 30, h: 31 };
      const spot = pickTipSpot({ trigger, size: s, view, obstacles, prefer: [['bottom', 'center'], ['top', 'center']] });
      const r = { x: spot.x, y: spot.y, ...s };
      expect(inside(r, view)).toBe(true);
      expect(besideTrigger(r, trigger).beside).toBe(true);
    }
  });

  it('besideTrigger reads the side and the gap', () => {
    const t = { x: 100, y: 100, w: 44, h: 44 };
    expect(besideTrigger({ x: 100, y: 152, w: 60, h: 28 }, t)).toEqual({ beside: true, gap: 8, side: 'bottom' });
    expect(besideTrigger({ x: 152, y: 108, w: 60, h: 28 }, t)).toEqual({ beside: true, gap: 8, side: 'right' });
    expect(besideTrigger({ x: 100, y: 200, w: 60, h: 28 }, t).beside).toBe(false);
    // Far off to the side: no span meets.
    expect(besideTrigger({ x: 400, y: 400, w: 60, h: 28 }, t).beside).toBe(false);
  });
});
