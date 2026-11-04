import { describe, expect, it } from 'vitest';
import { MAX_TEAM, MAX_TEAM_INVITES, TEAM_ROLES, TEAM_TABS, TERMS, HOW_TO, parseTeamAccess, teamAllows, teamDefaults, type TeamAccess } from './index';

describe('agency team access', () => {
  it('starts each role where the spec says', () => {
    expect(teamDefaults('editor')).toEqual({ overview: 'off', pipeline: 'edit', clients: 'off', paperwork: 'off' });
    expect(teamDefaults('videographer')).toEqual({ overview: 'off', pipeline: 'edit', clients: 'off', paperwork: 'off' });
    expect(teamDefaults('content_creator')).toEqual({ overview: 'off', pipeline: 'edit', clients: 'view', paperwork: 'off' });
    expect(teamDefaults('client')).toEqual({ overview: 'view', pipeline: 'view', clients: 'off', paperwork: 'view' });
  });

  it('caps what can be stored or sent', () => {
    const all: TeamAccess = { overview: 'edit', pipeline: 'edit', clients: 'edit', paperwork: 'edit' };
    for (const role of TEAM_ROLES) expect(parseTeamAccess(all, role).overview).not.toBe('edit');
    expect(parseTeamAccess(all, 'client')).toEqual({ overview: 'view', pipeline: 'view', clients: 'off', paperwork: 'view' });
    expect(parseTeamAccess({ clients: 'view' }, 'client').clients).toBe('off');
    expect(parseTeamAccess(all, 'editor')).toEqual({ overview: 'view', pipeline: 'edit', clients: 'edit', paperwork: 'edit' });
    expect(parseTeamAccess({ pipeline: 'off', paperwork: 'off' }, 'content_creator')).toEqual({ overview: 'off', pipeline: 'off', clients: 'view', paperwork: 'off' });
  });

  it('drops junk and takes the role default', () => {
    expect(parseTeamAccess(null, 'editor')).toEqual(teamDefaults('editor'));
    expect(parseTeamAccess('edit', 'editor')).toEqual(teamDefaults('editor'));
    expect(parseTeamAccess([1, 2], 'client')).toEqual(teamDefaults('client'));
    expect(parseTeamAccess({ pipeline: 'admin', overview: 7, constructor: 'edit', __proto__: { clients: 'edit' } }, 'editor')).toEqual(teamDefaults('editor'));
    expect(Object.keys(parseTeamAccess({ extra: 'edit' }, 'editor')).sort()).toEqual([...TEAM_TABS].sort());
  });

  it('answers view and edit by level', () => {
    const a = teamDefaults('content_creator');
    expect(teamAllows(a, 'pipeline', 'edit')).toBe(true);
    expect(teamAllows(a, 'clients', 'view')).toBe(true);
    expect(teamAllows(a, 'clients', 'edit')).toBe(false);
    expect(teamAllows(a, 'overview', 'view')).toBe(false);
  });

  it('has its limits, word and how-to line', () => {
    expect(MAX_TEAM).toBe(25);
    expect(MAX_TEAM_INVITES).toBe(10);
    expect(TERMS['team member']).toBeTruthy();
    expect(HOW_TO.agency?.terms).toContain('team member');
  });
});
