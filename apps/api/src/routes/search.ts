import { Hono } from 'hono';
import type { SearchResults } from '@kreators/shared';
import type { AppEnv } from '../env';

export const search = new Hono<AppEnv>();

search.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const q = (c.req.query('q') ?? '').trim().slice(0, 80);
  const empty: SearchResults = { tasks: [], journal: [], resources: [], products: [], people: [] };
  if (q.length < 2) return c.json(empty);
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const [tasks, journal, resources, products, people] = await Promise.all([
    db.prepare("SELECT id, title, relationship, status FROM nodes WHERE user_id = ? AND kind = 'task' AND title LIKE ? ORDER BY created_at DESC LIMIT 6").bind(user.id, like).all<SearchResults['tasks'][number]>(),
    db.prepare('SELECT id, title, created_at AS createdAt FROM journal_entries WHERE user_id = ? AND (title LIKE ? OR body LIKE ?) ORDER BY created_at DESC LIMIT 6').bind(user.id, like, like).all<SearchResults['journal'][number]>(),
    db.prepare('SELECT id, title, kind FROM resources WHERE published = 1 AND (title LIKE ? OR summary LIKE ? OR tags LIKE ?) LIMIT 6').bind(like, like, like).all<SearchResults['resources'][number]>(),
    db.prepare("SELECT p.id, p.title, p.kind, u.handle AS ownerHandle FROM products p JOIN users u ON u.id = p.owner_id WHERE p.status = 'live' AND (p.title LIKE ? OR p.description LIKE ?) LIMIT 6").bind(like, like).all<SearchResults['products'][number]>(),
    db.prepare('SELECT handle, display_name AS name FROM users WHERE handle IS NOT NULL AND (handle LIKE ? OR display_name LIKE ?) LIMIT 6').bind(like, like).all<SearchResults['people'][number]>(),
  ]);
  const res: SearchResults = { tasks: tasks.results, journal: journal.results, resources: resources.results, products: products.results, people: people.results };
  return c.json(res);
});
