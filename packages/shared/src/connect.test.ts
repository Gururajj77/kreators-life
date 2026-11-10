import { describe, expect, it } from 'vitest';
import { CONNECT_KINDS, CONNECT_KIND_META, CONNECT_KIND_PERMISSION, connectKindsFor, isConnectKind } from './connect.ts';
import { PERMISSIONS } from './roles.ts';

describe('who may make each kind of connection (2026-11-10)', () => {
  it('gives an admin every kind and a creator none, whatever they hold', () => {
    expect(connectKindsFor({ role: 'admin', permissions: [] })).toEqual([...CONNECT_KINDS]);
    expect(connectKindsFor({ role: 'user', permissions: [...PERMISSIONS] })).toEqual([]);
    expect(connectKindsFor({ role: 'sub_admin', permissions: [] })).toEqual([]);
  });
  it('gives staff only the kinds their permissions govern', () => {
    expect(connectKindsFor({ role: 'sub_admin', permissions: ['cohorts'] })).toEqual(['program', 'product', 'cohort']);
    expect(connectKindsFor({ role: 'sub_admin', permissions: ['review'] })).toEqual(['club']);
    expect(connectKindsFor({ role: 'sub_admin', permissions: ['talent'] })).toEqual(['org']);
    expect(connectKindsFor({ role: 'sub_admin', permissions: ['moderation'] })).toEqual(['friends']);
    // No staff permission governs a coach link or someone's Agency team: admins only.
    expect(connectKindsFor({ role: 'sub_admin', permissions: [...PERMISSIONS] })).not.toContain('coach');
    expect(connectKindsFor({ role: 'sub_admin', permissions: [...PERMISSIONS] })).not.toContain('agency');
  });
  it('names every kind, with a permission that exists or none', () => {
    for (const k of CONNECT_KINDS) {
      expect(isConnectKind(k)).toBe(true);
      expect(CONNECT_KIND_META[k].modes.length).toBeGreaterThan(0);
      const p = CONNECT_KIND_PERMISSION[k];
      expect(p === null || (PERMISSIONS as readonly string[]).includes(p)).toBe(true);
    }
    expect(isConnectKind('constructor')).toBe(false);
    // A cohort's manager is named directly with a reason; a brand's team is only ever an ask.
    expect(CONNECT_KIND_META.cohort.modes).toEqual(['direct']);
    expect(CONNECT_KIND_META.org.modes).toEqual(['ask']);
  });
});
