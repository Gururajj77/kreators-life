import { describe, expect, it } from 'vitest';
import { BRIEF_MOOD_LOW, BRIEF_SLEEP_LOW, briefFor, briefPath, buildCalendar, ICS_CATEGORY_LINE, icsTaskTitle, INBOX_TAB_META, INBOX_TABS, type BriefFacts } from './index';

// The 2026-11-03 emergence wave: Agency on the brief, wellbeing feeding pillar steps, the calendar feed's new entries, the Agency inbox tab.

const QUIET: BriefFacts = {
  hour: 10,
  checkedIn: true,
  streak: 0,
  bestStreak: 0,
  level: 2,
  xpToNext: 50,
  tasksDue: 0,
  tasksOverdue: 0,
  doneWeek: 0,
  doneWeekBefore: 0,
  smallActDone: true,
  notToDoSlipped: 0,
  routineWeek: null,
  contractDays: null,
  sleepAvg: null,
  sleepAvgBefore: null,
  moodAvg: null,
  moodAvgBefore: null,
  stressAvg: null,
  nextEvent: null,
  coachNotes: 0,
  coachAsks: 0,
  reviewDue: false,
  apps: [],
};
const keys = (b: ReturnType<typeof briefFor>) => [...b.signals, ...b.actions].map((x) => x.key);

describe('the brief across Agency', () => {
  const agency: NonNullable<BriefFacts['agency']> = {
    changeAsks: 0,
    changeClientId: null,
    monthMade: null,
    piecesDueToday: 2,
    piecesClientId: 'k1',
    invoicesOverdue: 1,
    retainersChosen: 1,
    retainerChosen: { clientId: 'k2', clientName: 'Acme' },
    agreementsUnsigned: 3,
  };
  it('says what waits on the person today, each line pointing at where it is done', () => {
    const b = briefFor({ ...QUIET, apps: ['agency'], agency });
    const sig = Object.fromEntries(b.signals.map((x) => [x.key, x]));
    expect(sig['agency-retainer']).toMatchObject({ text: 'Acme chose a retainer. Confirm it to start.', to: '/agency/k2', tone: 'watch' });
    expect(sig['agency-due']).toMatchObject({ text: '2 pieces for clients are due today or late.', to: '/agency/k1' });
    expect(sig['agency-invoice']).toMatchObject({ text: '1 invoice is past due.', to: '/agency?tab=invoices' });
    // The top three signals win; the unsigned agreements rank under them.
    expect(b.signals).toHaveLength(3);
    expect(b.actions.map((x) => x.key).slice(0, 3)).toEqual(['agency-retainer', 'agency-due', 'agency-invoice']);
  });
  it('names the agreements once there is room', () => {
    const b = briefFor({ ...QUIET, apps: ['agency'], agency: { ...agency, piecesDueToday: 0, invoicesOverdue: 0, retainersChosen: 0, retainerChosen: null } });
    expect(b.signals.find((x) => x.key === 'agency-agreement')?.text).toBe('3 agreements sent and not signed yet.');
  });
  it('points a lone due piece or several clients at the right place', () => {
    const several = briefFor({ ...QUIET, apps: ['agency'], agency: { ...agency, piecesClientId: null, retainersChosen: 2, retainerChosen: null } });
    expect(several.signals.find((x) => x.key === 'agency-due')?.to).toBe('/today');
    expect(several.signals.find((x) => x.key === 'agency-retainer')).toMatchObject({ text: '2 clients chose a retainer. Confirm to start.', to: '/agency' });
  });
  it('says nothing about Agency while it is off, and the old facts without the new ones still work', () => {
    expect(keys(briefFor({ ...QUIET, apps: [], agency })).some((k) => k.startsWith('agency'))).toBe(false);
    expect(keys(briefFor({ ...QUIET, apps: ['agency'], agency: { changeAsks: 0, changeClientId: null, monthMade: null } })).some((k) => k.startsWith('agency'))).toBe(false);
  });
});

describe('wellbeing feeds the pillars, in the owner’s own brief', () => {
  it('a short-sleep week suggests a Yourself pillar step', () => {
    const b = briefFor({ ...QUIET, sleepAvg: BRIEF_SLEEP_LOW - 0.5 });
    expect(b.actions.find((x) => x.key === 'pillar-sleep')).toMatchObject({ to: '/realm/self' });
    expect(keys(briefFor({ ...QUIET, sleepAvg: BRIEF_SLEEP_LOW }))).not.toContain('pillar-sleep');
  });
  it('a low mood week suggests a Friends pillar step', () => {
    expect(briefFor({ ...QUIET, moodAvg: BRIEF_MOOD_LOW }).actions.find((x) => x.key === 'pillar-mood')?.to).toBe('/realm/friendship');
    expect(keys(briefFor({ ...QUIET, moodAvg: 3 }))).not.toContain('pillar-mood');
  });
  it('high stress gives the breathing timer when Mindful is on, a Yourself pillar step when it is not', () => {
    const on = keys(briefFor({ ...QUIET, stressAvg: 4.5, apps: ['mindful'] }));
    expect(on).toContain('breathe');
    expect(on).not.toContain('pillar-stress');
    const off = keys(briefFor({ ...QUIET, stressAvg: 4.5, apps: [] }));
    expect(off).toContain('pillar-stress');
  });
  it('nothing logged means no wellbeing step', () => {
    expect(keys(briefFor(QUIET)).some((k) => k.startsWith('pillar-'))).toBe(false);
  });
});

describe('the calendar feed', () => {
  const now = new Date('2026-11-03T08:00:00Z');
  it('marks a task brought to a review in its title', () => {
    expect(icsTaskTitle('Draft the pitch', true)).toBe('Draft the pitch (for review)');
    expect(icsTaskTitle('Draft the pitch', false)).toBe('Draft the pitch');
  });
  it('writes an event at its fixed instant, with its end, under Events', () => {
    const ics = buildCalendar([{ id: 'event-e1-2026-11-05', title: 'Board games night', relationship: null, category: 'Events', day: '2026-11-05', dueTime: null, estimateMin: 60, priority: null, startsAt: '2026-11-05T13:30:00.000Z', endsAt: '2026-11-05T16:00:00.000Z' }], 'Asia/Kolkata', now);
    expect(ics).toContain('DTSTART:20261105T133000Z');
    expect(ics).toContain('DTEND:20261105T160000Z');
    expect(ics).toContain('CATEGORIES:Events');
    expect(ics).toContain(`DESCRIPTION:${ICS_CATEGORY_LINE.Events}`);
  });
  it('an event with no end lasts its estimate', () => {
    const ics = buildCalendar([{ id: 'circle-g1', title: 'Circle', relationship: null, category: 'Events', day: '2026-11-05', dueTime: null, estimateMin: 120, priority: null, startsAt: '2026-11-05T13:30:00.000Z' }], 'Asia/Kolkata', now);
    expect(ics).toContain('DTEND:20261105T153000Z');
  });
  it('gives Agency entries their own line, never the review one, and an invoice day carries no amount', () => {
    const ics = buildCalendar([{ id: 'invoice-due-i1', title: 'Invoice KR-0007 due, Acme', relationship: null, category: 'Agency', day: '2026-11-10', dueTime: null, estimateMin: null, priority: null }], 'Asia/Kolkata', now);
    expect(ics).toContain('DESCRIPTION:Client work from Agency in kreators.app');
    expect(ics).not.toContain('A review you scheduled');
    expect(ics).not.toMatch(/₹|\d+\.\d{2}/);
  });
  it('a Remember task keeps its pillar and says when its note goes out', () => {
    const ics = buildCalendar([{ id: 't1', title: 'Call mum', relationship: 'parent_child', day: '2026-11-04', dueTime: '18:00', estimateMin: 15, priority: 1, description: 'Tagged Remember: a note lands in your inbox at 18:00 that day.' }], 'Asia/Kolkata', now);
    expect(ics).toContain('DTSTART:20261104T123000Z');
    expect(ics).toContain('DESCRIPTION:Tagged Remember: a note lands in your inbox at 18:00 that day.');
  });
});

describe('the inbox has an Agency tab', () => {
  it('holds the agency kind, between Coaching and Team', () => {
    expect(INBOX_TAB_META.agency.kinds).toEqual(['agency']);
    expect(INBOX_TABS.indexOf('agency')).toBe(INBOX_TABS.indexOf('coaching') + 1);
    expect(INBOX_TABS.at(-1)).toBe('team');
  });
});

describe('the brief never points at an app that is off', () => {
  it('keeps a link only while its app is on, longest app path first', () => {
    expect(briefPath('/party/e1', [])).toBeNull();
    expect(briefPath('/party/e1', ['party'])).toBe('/party/e1');
    expect(briefPath('/shop/content?tab=create', ['shop'])).toBeNull();
    expect(briefPath('/shop/content?tab=create', ['content'])).toBe('/shop/content?tab=create');
    // Locked apps and paths outside every app keep their link.
    expect(briefPath('/today', [])).toBe('/today');
    expect(briefPath('/realm/self', [])).toBe('/realm/self');
    expect(briefPath('/you#coach', [])).toBe('/you#coach');
    expect(briefPath(null, [])).toBeNull();
  });
  it('drops the link of the next event and the coach note when their apps are off', () => {
    const facts = { ...QUIET, nextEvent: { title: 'Meetup', when: 'tomorrow', to: '/party/e1' }, coachNotes: 1 };
    const off = briefFor(facts);
    for (const line of [...off.signals, ...off.actions]) if (line.to) expect(line.to.startsWith('/party') || line.to.startsWith('/coaching')).toBe(false);
    expect(off.signals.find((x) => x.key === 'coach-note')?.to).toBe('/you#coach');
    const on = briefFor({ ...facts, apps: ['party', 'coaching'] });
    expect(on.signals.find((x) => x.key === 'event')?.to).toBe('/party/e1');
    expect(on.signals.find((x) => x.key === 'coach-note')?.to).toBe('/coaching');
  });
});
