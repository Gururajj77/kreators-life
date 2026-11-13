import { MAP_LEVELS, MODULES, RELATIONSHIPS, SETUP_APP_LINES, TERMS } from '@kreators/shared';

export { isQuestion } from './isQuestion';

const plain = (s: string) => ` ${s.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9'&\s-]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
const has = (t: string, word: string) => t.includes(plain(word));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Things worth explaining that are not a glossary word: short answers in plain words. */
const EXTRA: readonly { words: readonly string[]; answer: string }[] = [
  { words: ['plan my week', 'week plan', 'plan the week'], answer: 'Plan my week: on Daily, it suggests a day for each task that has none, so no day is overloaded. Nothing changes until you keep a suggestion.' },
  { words: ['focus quality'], answer: 'Focus quality: after a focus session you can rate how focused you were, from scattered to deep. Only you see it, unless you share the Focus sessions table with a life coach.' },
  { words: ['calendar link', 'private calendar', 'calendar sync'], answer: 'Calendar link: under Profile, a private address your Google, Apple or Outlook calendar can subscribe to. It shows your tasks there. It never changes them.' },
  { words: ['business metrics', 'business numbers'], answer: 'Business metrics: in Reviews, for people who run a business. Switch them on to track numbers such as pieces published or hours billed. Only you see them.' },
  { words: ['gratitude for the day', 'gratitude for today', 'daily gratitude', 'gratitude'], answer: 'Gratitude for today: on Journal, three short lines a day, each under its own prompt. It saves as you type, and only you see it, unless you share its table with a life coach.' },
  { words: ['daily review', 'daily report', 'review of the day'], answer: 'Daily review: in Reviews, a look back at one day: your tasks, pillar by pillar, and one small step for tomorrow.' },
  { words: ['mid-year check-in', 'mid year check in', 'mid-year review', 'mid year review', 'mid-year', 'mid year', 'midyear'], answer: 'Mid-year check-in: in Reviews, the half-year review of January to June, opened in July. It looks at your guiding principles.' },
  { words: ['start-of-year setting', 'start of year setting', 'start-of-year', 'start of year', 'start of the year'], answer: 'Start-of-year setting: in Reviews, the half-year review of July to December, opened in January beside the yearly review. It looks at your guiding principles too.' },
  { words: ['life dashboard', 'life report'], answer: 'Life dashboard: the Life app scores the five areas of your life from what you log. Emerging shows them by period, with the seven pillars beside them.' },
  { words: ['hidden apps', 'hide an app', 'hide apps', 'unhide'], answer: 'Hidden apps: hide an app you do not use from Apps or Profile, Features. It waits under Hidden apps at the end of its group, and nothing is deleted.' },
];

/**
 * Plain answers to "what is ...?" from what the app already says about itself: an app's line, one of the seven
 * relationships, a level on the map, or one of the words in TERMS. The longest phrase wins, so "an eating check-in"
 * is not also the daily check-in and "the life dashboard" not also the Life app. Three at most, so the answer stays short.
 */
export function explainTyped(text: string): string[] {
  const t = plain(text);
  const found: { said: string; answer: string }[] = [];
  const hit = (word: string, answer: string) => {
    const said = [word, `${word}s`].find((w) => has(t, w));
    if (said) found.push({ said: plain(said), answer });
  };
  for (const m of MODULES) {
    if (m.group === 'manage') continue;
    const answer = `${m.name}: ${SETUP_APP_LINES[m.key] ?? m.blurb}`;
    hit(m.name, answer);
    if (m.key.length > 3) hit(m.key, answer);
  }
  for (const r of RELATIONSHIPS) {
    const answer = `${r.name} is your relationship with ${r.role.replace(/^guide to /, '')}. ${r.character} looks after it.`;
    hit(r.name, answer);
    hit(r.character, answer);
  }
  for (const l of MAP_LEVELS) hit(l.name, `${l.name} is a level on the map. It sounds like: “${l.sounds}”`);
  for (const e of EXTRA) for (const w of e.words) hit(w, e.answer);
  // A word in capitals, like ACT, counts only as typed, so "how do I act on it" is not a question about a therapy.
  for (const [word, meaning] of Object.entries(TERMS)) if (word !== word.toUpperCase() || text.includes(word)) hit(word, `${cap(word)}: ${meaning}`);
  const kept = found.filter((f) => !found.some((o) => o.said.length > f.said.length && o.said.includes(f.said)));
  return [...new Set(kept.map((f) => f.answer))].slice(0, 3);
}
