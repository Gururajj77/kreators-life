import { describe, expect, it } from 'vitest';
import { ATTENDEE_APPS, ATTENDEE_PATHS, attendeeMayOpen } from './eventJoin.ts';
import { MODULE_BY_KEY } from './index.ts';

describe('the event attendee gate', () => {
  it('lets an attendee into the event, Party, Community, Bond, Inbox, the Profile tab and Help', () => {
    for (const p of ['/party', '/party/e1', '/community', '/bond', '/bond/chats/c1', '/inbox', '/you', '/help', '/party/']) expect(attendeeMayOpen(p)).toBe(true);
  });
  it('sends everything else to the setup chat', () => {
    for (const p of ['/', '/home', '/today', '/tower', '/apps', '/journal', '/partyx', '/bonds', '/profile', '/circles', '/run', '/youth', '/helpdesk']) expect(attendeeMayOpen(p)).toBe(false);
  });
  it('names real apps and paths', () => {
    for (const k of ATTENDEE_APPS) expect(MODULE_BY_KEY[k]).toBeTruthy();
    for (const p of ATTENDEE_PATHS) expect(p.startsWith('/')).toBe(true);
  });
});
