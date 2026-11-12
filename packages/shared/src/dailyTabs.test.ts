import { describe, expect, it } from 'vitest';
import {
  DAILY_SECTIONS,
  DAILY_VIEW_DEFAULT,
  PLACE_DAY_MAX,
  TASK_SORTS,
  TASK_TABS,
  TASK_TAB_CMP,
  TASK_TAB_PREFIX,
  dailyHiddenLine,
  dailySectionOfAnchor,
  dailyViewProblem,
  isDailySectionHidden,
  isTaskTab,
  parseDailyView,
  parsePlaceDay,
  parseTaskTab,
  taskTabOf,
  taskTabSort,
} from './index';

describe('Daily’s task tabs', () => {
  it('has Today, Past due and Upcoming, Today first and the default', () => {
    expect(TASK_TABS.map((t) => t.key)).toEqual(['today', 'pastdue', 'upcoming']);
    expect(TASK_TABS.map((t) => t.name)).toEqual(['Today', 'Past due', 'Upcoming']);
    expect(parseTaskTab(undefined)).toBe('today');
    expect(parseTaskTab('pastdue')).toBe('pastdue');
    expect(parseTaskTab('constructor')).toBe('today');
    expect(isTaskTab('toString')).toBe(false);
    expect(isTaskTab('upcoming')).toBe(true);
  });
  it('puts a task by its day (the do date, else the due date) against the person’s day', () => {
    const day = '2026-11-12';
    expect(taskTabOf({ doDate: day, dueDate: null }, day)).toBe('today');
    expect(taskTabOf({ doDate: null, dueDate: day }, day)).toBe('today');
    // The do date wins over a later or earlier due date, as openDay reads it.
    expect(taskTabOf({ doDate: '2026-11-10', dueDate: '2026-11-20' }, day)).toBe('pastdue');
    expect(taskTabOf({ doDate: '2026-11-14', dueDate: '2026-11-11' }, day)).toBe('upcoming');
    expect(taskTabOf({ doDate: null, dueDate: null }, day)).toBeNull();
  });
  it('compares in SQL with a fixed sign per tab and pages with its own prefix', () => {
    expect(TASK_TAB_CMP).toEqual({ today: '=', pastdue: '<', upcoming: '>' });
    expect(TASK_TAB_PREFIX).toEqual({ pastdue: 'pd', upcoming: 'uc' });
  });
  it('sorts each tab only by what it offers', () => {
    expect(taskTabSort('today', 'block')).toBe('block');
    expect(taskTabSort('pastdue', 'priority')).toBe('priority');
    expect(taskTabSort('pastdue', 'due')).toBe('due');
    expect(taskTabSort('pastdue', 'block')).toBe('day');
    expect(taskTabSort('upcoming', 'priority')).toBe('day');
    expect(taskTabSort('today', 'nonsense')).toBe('day');
    for (const s of TASK_SORTS) expect(taskTabSort('today', s.key)).toBe(s.key);
  });
});

describe('Daily’s View menu', () => {
  it('names the eight sections in plain words, each with the heading a link lands on', () => {
    expect(DAILY_SECTIONS.map((s) => s.key)).toEqual(['done', 'remember', 'backlog', 'yourDay', 'month', 'habits', 'notToDo', 'patterns']);
    expect(DAILY_SECTIONS.map((s) => s.name)).toEqual(['Done today', 'To remember', 'Not scheduled yet', 'Your day', 'Month calendar', 'Habits', 'Not to do', 'Patterns']);
    const anchors = DAILY_SECTIONS.flatMap((s) => s.anchors);
    expect(new Set(anchors).size).toBe(anchors.length);
  });
  it('reads a stored view kindly: known keys once, in the sections’ order', () => {
    expect(parseDailyView(null)).toEqual(DAILY_VIEW_DEFAULT);
    expect(parseDailyView('not json')).toEqual({ hidden: [] });
    expect(parseDailyView('{"hidden":["habits","done","habits","constructor"]}')).toEqual({ hidden: ['done', 'habits'] });
    expect(parseDailyView({ hidden: ['patterns', 'month'] })).toEqual({ hidden: ['month', 'patterns'] });
    expect(parseDailyView({ hidden: 'done' })).toEqual({ hidden: [] });
    expect(parseDailyView([])).toEqual({ hidden: [] });
  });
  it('refuses a view sent with an unknown or repeated section, out loud', () => {
    expect(dailyViewProblem({ hidden: [] })).toBeNull();
    expect(dailyViewProblem({ hidden: ['done', 'notToDo'] })).toBeNull();
    expect(dailyViewProblem({ hidden: ['toString'] })).toBeTruthy();
    expect(dailyViewProblem({ hidden: ['done', 'done'] })).toBeTruthy();
    expect(dailyViewProblem({ hidden: 'done' })).toBeTruthy();
    expect(dailyViewProblem(null)).toBeTruthy();
    expect(dailyViewProblem(['done'])).toBeTruthy();
  });
  it('shows a hidden section a link lands on, and says how many are hidden', () => {
    expect(dailySectionOfAnchor('#done-heading')).toBe('done');
    expect(dailySectionOfAnchor('kinds-of-day')).toBe('patterns');
    expect(dailySectionOfAnchor('#tasks-heading')).toBeNull();
    expect(dailySectionOfAnchor('#constructor')).toBeNull();
    expect(isDailySectionHidden({ hidden: ['month'] }, 'month')).toBe(true);
    expect(isDailySectionHidden(undefined, 'month')).toBe(false);
    expect(dailyHiddenLine(0)).toBe('');
    expect(dailyHiddenLine(1)).toBe('1 section hidden');
    expect(dailyHiddenLine(3)).toBe('3 sections hidden');
  });
});

describe('Place my day’s request', () => {
  it('takes a real day and each task once with a real time', () => {
    expect(parsePlaceDay({ date: '2026-11-12', items: [{ id: 'a', dueTime: '10:00' }, { id: 'b', dueTime: '15:15' }] })).toEqual({
      date: '2026-11-12',
      items: [
        { id: 'a', dueTime: '10:00' },
        { id: 'b', dueTime: '15:15' },
      ],
    });
  });
  it('refuses what is not', () => {
    const bad = (body: unknown) => 'problem' in parsePlaceDay(body);
    expect(bad(null)).toBe(true);
    expect(bad({ date: '2026-11-31', items: [{ id: 'a', dueTime: '10:00' }] })).toBe(true);
    expect(bad({ date: '2026-11-12', items: [] })).toBe(true);
    expect(bad({ date: '2026-11-12', items: [{ id: 'a', dueTime: '24:00' }] })).toBe(true);
    expect(bad({ date: '2026-11-12', items: [{ id: '', dueTime: '10:00' }] })).toBe(true);
    expect(bad({ date: '2026-11-12', items: [{ id: 'a', dueTime: '10:00' }, { id: 'a', dueTime: '11:00' }] })).toBe(true);
    expect(bad({ date: '2026-11-12', items: Array.from({ length: PLACE_DAY_MAX + 1 }, (_, i) => ({ id: `t${i}`, dueTime: '10:00' })) })).toBe(true);
  });
});
