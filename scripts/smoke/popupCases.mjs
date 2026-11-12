// Every kind of popup and the way in to each (drive-popups.mjs checks their rails, drive-tips.mjs the names their buttons show). Moved here
// from drive-popups.mjs on 2026-11-12 so both open them the same way.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const MODAL = '[role="dialog"][aria-modal="true"]';

// A way in: the first visible control whose words or label match, in order. `min` and `max` hold a popup to the widths it exists at.
// `frame` names a popup that is not a Sheet, `close` its Close, and `rails` how many buttons its rail should hold at least.
export const CASES = [
  { key: 'week-plan', path: '/today', steps: [/^Plan my week$/], rails: 2 },
  { key: 'sign-out', path: '/you', steps: [/^Sign out$/] },
  { key: 'password', path: '/you', steps: [/^Change password$/] },
  { key: 'delete-account', path: '/you', steps: [/^Delete my account$/] },
  { key: 'erase', path: '/you', steps: [/^Erase everything$/] },
  { key: 'money-out', path: '/finance', steps: [/^Money out$/] },
  { key: 'owed', path: '/finance', steps: [/^Owed$/] },
  { key: 'budgets', path: '/finance', steps: [/^Budgets$/] },
  { key: 'write-post', path: '/community', steps: [/^Write a post$/] },
  { key: 'new-entry', path: '/journal', steps: [/^New entry$/] },
  { key: 'launch-reward', path: '/win', steps: [/^Launch a reward$/] },
  { key: 'start-club', path: '/run', steps: [/^Start a club$/] },
  { key: 'new-program', path: '/school', steps: [/^New program$/] },
  { key: 'sell', path: '/store', steps: [/^Sell something$/] },
  { key: 'timer-settings', path: '/mindful', steps: [/^Timer settings$/] },
  { key: 'task-picker', path: '/mindful', steps: [/^Focus on a task$/] },
  { key: 'apps-menu', path: '/home', steps: [/^Apps menu$/], max: 767 },
  { key: 'month-day', path: '/today', steps: [/^Month calendar$/, /(no tasks|\d+ tasks?)/] },
  { key: 'read-all', path: '/cards/funflow', steps: [/^Draw a card$/, /^Draw a card$/, /^Draw a card$/, /^Draw a card$/, /^Read all$/], optional: true },
  { key: 'water-sheet', path: '/cards/funflow', steps: [/^Water and reminders/], min: 768, rails: 4 },
  { key: 'tab-all', path: '/inbox', steps: [/^All$/], optional: true },
  // A sheet over a sheet: the day's sheet, then asking before removing its movement.
  { key: 'nested-confirm', path: '/fitness', steps: [new RegExp(`^${Number(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(8))}$`), /^Remove /], nested: true, optional: true, needsMove: true },
  { key: 'bubble', path: '/today', steps: [/^Water \d/], min: 1024, frame: '[role="dialog"][aria-label="Water and reminders"]', close: 'Close water and reminders', rails: 4 },
  { key: 'assistant', path: '/today', steps: [/^Open the assistant$/], frame: '[data-assistant-panel]', close: 'Close', rails: 1 },
  // Admin's sheets (2026-11-09): the account must be an admin (shots-all.mjs makes one).
  { key: 'admin-override', path: '/admin?tab=flags', steps: [/^Add override$/] },
  { key: 'admin-listing', path: '/admin?tab=listings', steps: [/^New event$/] },
  { key: 'admin-discount', path: '/admin?tab=discounts', steps: [/^Make a code$/] },
  { key: 'admin-connections', path: '/admin?tab=people', steps: [/^Connections of /] },
  { key: 'admin-delete', path: '/admin?tab=people', steps: [/^Delete (?!all)/] },
];

/**
 * Opens one case on a page that is already signed in: goes to its path, answers no unasked privacy card, and taps each step in turn (in
 * the top popup once one is open). Returns whether it opened and the name of what was tapped last (focus goes home to it).
 */
export async function openCase(page, c, origin) {
  await page.goto(`${origin}${c.path}`, { waitUntil: 'networkidle2', timeout: 25000 });
  await sleep(400);
  // An unanswered privacy card is not the subject here.
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('[role="dialog"]:not([aria-modal]) button')) if (/^Reject all$/.test(b.textContent.trim())) b.click();
  });
  let opened = true;
  let openerName = '';
  for (const step of c.steps) {
    const hit = await page.evaluate(
      (src, flags, top) => {
        const re = new RegExp(src, flags);
        const open = [...document.querySelectorAll(top)].pop();
        const list = [...(open ?? document).querySelectorAll('button, a, [role="button"]')].filter((b) => b.getClientRects().length > 0 && !b.disabled);
        const el = list.find((b) => re.test(b.textContent.trim())) ?? list.find((b) => re.test(b.getAttribute('aria-label') ?? ''));
        if (!el) return false;
        el.scrollIntoView({ block: 'center' });
        el.focus();
        el.click();
        return el.getAttribute('aria-label') || el.textContent.trim();
      },
      step.source,
      step.flags,
      MODAL,
    );
    if (!hit) {
      opened = false;
      break;
    }
    openerName = hit;
    await sleep(600);
  }
  return { opened, openerName };
}
