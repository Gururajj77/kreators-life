import { MAP_LEVELS, MODULES, RELATIONSHIPS, SETUP_APP_LINES, TERMS } from '@kreators/shared';

/** True when a line someone typed reads as a question rather than an answer. */
export function isQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t.endsWith('?') || /^(what|whats|what's|how|why|who|where|when|which|can|could|is|are|do|does|should|tell me|explain|meaning)\b/.test(t);
}

const plain = (s: string) => ` ${s.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9'&\s-]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
const has = (t: string, word: string) => t.includes(plain(word));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Things worth explaining that are not a glossary word: short answers in plain words. */
const EXTRA: readonly { words: readonly string[]; answer: string }[] = [
  { words: ['plan my week', 'week plan', 'plan the week'], answer: 'Plan my week: on Daily, it suggests a day for each task that has none, so no day is overloaded. Nothing changes until you keep a suggestion.' },
  { words: ['focus quality'], answer: 'Focus quality: after a focus session you can rate how focused you were, from scattered to deep. Only you see it.' },
  { words: ['calendar link', 'private calendar', 'calendar sync'], answer: 'Calendar link: under Profile, a private address your Google, Apple or Outlook calendar can subscribe to. It shows your tasks there. It never changes them.' },
  { words: ['business metrics', 'business numbers'], answer: 'Business metrics: in Reviews, for people who run a business. Switch them on to track numbers such as pieces published or hours billed. Only you see them.' },
  { words: ['time blocks', 'time blocking'], answer: 'Time blocks: on Daily, your tasks that have a time laid out as blocks, with the free time between them.' },
];

/**
 * Plain answers to "what is ...?" from what the app already says about itself: an app's line, one of the seven
 * relationships, a level on the map, or one of the words in TERMS. Three at most, so the answer stays short.
 */
export function explainTyped(text: string): string[] {
  const t = plain(text);
  const out: string[] = [];
  for (const m of MODULES) {
    if (m.group === 'manage') continue;
    if (has(t, m.name) || (m.key.length > 3 && has(t, m.key))) out.push(`${m.emoji} ${m.name}: ${SETUP_APP_LINES[m.key] ?? m.blurb}`);
  }
  for (const r of RELATIONSHIPS) {
    if (has(t, r.name) || has(t, r.character)) out.push(`${r.name} is your relationship with ${r.role.replace(/^guide to /, '')}. ${r.character} looks after it.`);
  }
  for (const l of MAP_LEVELS) if (has(t, l.name)) out.push(`${l.name} is a level on the map. It sounds like: “${l.sounds}”`);
  for (const e of EXTRA) if (e.words.some((w) => has(t, w))) out.push(e.answer);
  for (const [word, meaning] of Object.entries(TERMS)) if (has(t, word)) out.push(`${cap(word)}: ${meaning}`);
  return [...new Set(out)].slice(0, 3);
}
