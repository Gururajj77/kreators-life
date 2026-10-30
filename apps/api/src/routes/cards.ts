import { Hono } from 'hono';
import { CARD_GAMES, CARD_GAME_BY_KEY, roleRank, type CardGameCard, type CardGamePlay, type CardGamesResponse, type PlayCard, type PlayDeck } from '@kreators/shared';
import type { AppEnv } from '../env';

export const cards = new Hono<AppEnv>();

interface CardRow {
  deck_key: string;
  title: string | null;
  label: string | null;
  text: string;
  list_json: string | null;
  alt_label: string | null;
  alt_text: string | null;
}
const toCard = (r: CardRow): PlayCard => ({
  ...(r.title ? { title: r.title } : {}),
  ...(r.label ? { label: r.label } : {}),
  text: r.text,
  ...(r.list_json ? { list: JSON.parse(r.list_json) as string[] } : {}),
  ...(r.alt_text ? { alt: { label: r.alt_label ?? '', text: r.alt_text } } : {}),
});

/** The games a person may play: the ones they unlocked, and every game for the team (so the content can be checked). */
export async function unlockedGames(db: D1Database, userId: string, role: string): Promise<Set<string>> {
  if (roleRank(role as never) >= roleRank('sub_admin')) return new Set(CARD_GAMES.map((g) => g.key));
  const rows = await db.prepare('SELECT game_key FROM card_unlocks WHERE user_id = ?').bind(userId).all<{ game_key: string }>();
  return new Set(rows.results.map((r) => r.game_key));
}

// Every game with its decks and sizes, and whether the person has it. The card text itself stays in D1 until it is unlocked.
cards.get('/', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const [mine, decks, counts] = await Promise.all([
    unlockedGames(db, user.id, user.role),
    db.prepare('SELECT game_key, deck_key, name FROM card_decks ORDER BY game_key, position').all<{ game_key: string; deck_key: string; name: string }>(),
    db.prepare('SELECT game_key, deck_key, COUNT(*) AS n FROM cards GROUP BY game_key, deck_key').all<{ game_key: string; deck_key: string; n: number }>(),
  ]);
  const games: CardGameCard[] = CARD_GAMES.map((g) => {
    const list = decks.results
      .filter((d) => d.game_key === g.key)
      .map((d) => ({ key: d.deck_key, name: d.name, count: counts.results.find((x) => x.game_key === g.key && x.deck_key === d.deck_key)?.n ?? 0 }));
    return { ...g, unlocked: mine.has(g.key), decks: list, total: list.reduce((a, d) => a + d.count, 0) };
  });
  const res: CardGamesResponse = { points: user.points, games };
  return c.json(res);
});

// One whole game, only once it is unlocked.
cards.get('/:key', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const key = c.req.param('key');
  const info = CARD_GAME_BY_KEY[key];
  if (!info) return c.json({ error: 'no such game' }, 404);
  const game = await db.prepare('SELECT how_to, special_json, special_note, rules_json FROM card_games WHERE game_key = ?').bind(key).first<{ how_to: string; special_json: string | null; special_note: string | null; rules_json: string | null }>();
  if (!game) return c.json({ error: 'no such game' }, 404);
  const mine = await unlockedGames(db, user.id, user.role);
  if (!mine.has(key)) return c.json({ error: `Unlock ${info.name} with ${info.cost} points in Rewards.`, locked: true, cost: info.cost }, 403);
  const [decks, rows] = await Promise.all([
    db.prepare('SELECT deck_key, name, hint FROM card_decks WHERE game_key = ? ORDER BY position').bind(key).all<{ deck_key: string; name: string; hint: string | null }>(),
    db.prepare('SELECT deck_key, title, label, text, list_json, alt_label, alt_text FROM cards WHERE game_key = ? ORDER BY deck_key, position').bind(key).all<CardRow>(),
  ]);
  const play: CardGamePlay = {
    ...info,
    howTo: game.how_to,
    ...(game.special_json ? { special: JSON.parse(game.special_json) as string[] } : {}),
    ...(game.special_note ? { specialNote: game.special_note } : {}),
    ...(game.rules_json ? { rules: JSON.parse(game.rules_json) as string[] } : {}),
    decks: decks.results.map((d): PlayDeck => ({ key: d.deck_key, name: d.name, ...(d.hint ? { hint: d.hint } : {}), cards: rows.results.filter((r) => r.deck_key === d.deck_key).map(toCard) })),
  };
  return c.json({ game: play });
});
