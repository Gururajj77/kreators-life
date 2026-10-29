import { MAP_LEVELS, MODULES, RELATIONSHIPS, SETUP_APP_LINES, TERMS } from '@kreators/shared';

/** True when a line someone typed reads as a question rather than an answer. */
export function isQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t.endsWith('?') || /^(what|whats|what's|how|why|who|where|when|which|can|could|is|are|do|does|should|tell me|explain|meaning)\b/.test(t);
}

const plain = (s: string) => ` ${s.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9'&\s-]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
const has = (t: string, word: string) => t.includes(plain(word));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Plain answers to "what is ...?" from what the app already says about itself: an app's line, one of the seven
 * relationships, a level on the map, or one of the words in TERMS. Three at most, so the answer stays short.
 */
export function explainTyped(text: string): string[] {
  const t = plain(text);
  const out: string[] = [];
  for (const m of MODULES) {
    if (m.group === 'manage' || m.group === 'internal') continue;
    if (has(t, m.name) || (m.key.length > 3 && has(t, m.key))) out.push(`${m.emoji} ${m.name}: ${SETUP_APP_LINES[m.key] ?? m.blurb}`);
  }
  for (const r of RELATIONSHIPS) {
    if (has(t, r.name) || has(t, r.character)) out.push(`${r.name} is your relationship with ${r.role.replace(/^guide to /, '')}. ${r.character} looks after it.`);
  }
  for (const l of MAP_LEVELS) if (has(t, l.name)) out.push(`${l.name} is a level on the map. It sounds like: “${l.sounds}”`);
  for (const [word, meaning] of Object.entries(TERMS)) if (has(t, word)) out.push(`${cap(word)}: ${meaning}`);
  return [...new Set(out)].slice(0, 3);
}
