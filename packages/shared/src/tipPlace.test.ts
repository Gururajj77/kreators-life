import { describe, expect, it } from 'vitest';
import { overlapArea, pickTipSpot, tipCandidates, type Rect } from './tipPlace';

const size = { w: 60, h: 28 };
const inside = (r: Rect, v: { w: number; h: number }, m = 8) => r.x >= m && r.y >= m && r.x + r.w <= v.w - m && r.y + r.h <= v.h - m;

describe('tipPlace', () => {
  it('counts the area two rects share', () => {
    expect(overlapArea({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(25);
    expect(overlapArea({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(0);
  });

  it('a rail right of the panel with room picks the right, over the scrim', () => {
    // A laptop sheet: the panel 600 wide in the middle of a 1280 window, the rail 8px off its right edge.
    const panel = { x: 340, y: 100, w: 600, h: 500 };
    const trigger = { x: 948, y: 100, w: 44, h: 44 };
    const spot = pickTipSpot({ trigger, size, view: { w: 1280, h: 800 }, panel, group: { x: 948, y: 100, w: 44, h: 96 }, obstacles: [], prefer: [['right', 'center'], ['top', 'end']] });
    expect(spot.side).toBe('right');
    expect(spot.clamped).toBe(false);
    expect(overlapArea({ x: spot.x, y: spot.y, ...size }, panel)).toBe(0);
  });

  it('a 768 sheet with a 32px gutter goes beside the rail, not over the panel', () => {
    const view = { w: 768, h: 1024 };
    const panel = { x: 84, y: 300, w: 600, h: 400 };
    const trigger = { x: 692, y: 300, w: 44, h: 44 };
    const spot = pickTipSpot({ trigger, size, view, panel, group: { x: 692, y: 300, w: 44, h: 96 }, obstacles: [], prefer: [['right', 'center'], ['top', 'end'], ['bottom', 'end']] });
    const r = { x: spot.x, y: spot.y, ...size };
    expect(inside(r, view)).toBe(true);
    expect(overlapArea(r, panel)).toBe(0);
    expect(spot.side).toBe('top');
  });

  it("with the panel at the window's top, it stands under the rail", () => {
    // The panel reaches the window's top and the gutter is too narrow for the tip beside the rail.
    const view = { w: 768, h: 1024 };
    const panel = { x: 84, y: 8, w: 600, h: 1000 };
    const trigger = { x: 692, y: 8, w: 44, h: 44 };
    const spot = pickTipSpot({ trigger, size, view, panel, group: { x: 692, y: 8, w: 44, h: 96 }, obstacles: [{ x: 692, y: 60, w: 44, h: 44 }], prefer: [['right', 'center']] });
    const r = { x: spot.x, y: spot.y, ...size };
    expect(inside(r, view)).toBe(true);
    // Under the rail the gutter is free (the rail's two buttons are 96px tall), so it stands there rather than on the panel's top right.
    expect(overlapArea(r, panel)).toBe(0);
    expect(r.y).toBeGreaterThanOrEqual(8 + 96);
  });

  it('a phone rail row above the panel names a button beside the whole row', () => {
    const view = { w: 390, h: 844 };
    const panel = { x: 0, y: 60, w: 390, h: 784 };
    // Close at the far right, a second rail button left of it; the row sits flush under the window's top.
    const trigger = { x: 330, y: 8, w: 44, h: 44 };
    const other = { x: 278, y: 8, w: 44, h: 44 };
    const spot = pickTipSpot({ trigger, size, view, panel, group: { x: 278, y: 8, w: 96, h: 44 }, obstacles: [other], prefer: [['top', 'end'], ['bottom', 'end']] });
    const r = { x: spot.x, y: spot.y, ...size };
    expect(inside(r, view)).toBe(true);
    expect(overlapArea(r, panel)).toBe(0);
    expect(overlapArea(r, other)).toBe(0);
    expect(spot.side).toBe('left');
    expect(r.x + r.w).toBeLessThanOrEqual(other.x);
  });

  it('with words above, it goes below', () => {
    const trigger = { x: 500, y: 300, w: 44, h: 44 };
    const words = { x: 300, y: 250, w: 400, h: 40 };
    const spot = pickTipSpot({ trigger, size, view: { w: 1280, h: 800 }, obstacles: [words], prefer: [['top', 'center'], ['bottom', 'center']] });
    expect(spot.side).toBe('bottom');
    expect(overlapArea({ x: spot.x, y: spot.y, ...size }, words)).toBe(0);
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

  it('offers every side of the trigger, and of its rail', () => {
    const t = { x: 100, y: 100, w: 44, h: 44 };
    expect(tipCandidates(t, size).length).toBe(12);
    expect(tipCandidates(t, size, 8, { x: 100, y: 100, w: 44, h: 140 }).length).toBeGreaterThan(12);
    expect(tipCandidates(t, size, 8, { x: 100, y: 100, w: 44, h: 140 }).length).toBeLessThanOrEqual(24);
  });
});
