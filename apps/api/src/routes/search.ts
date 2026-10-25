import { Hono } from 'hono';
import type { SearchResults } from '@kreators/shared';
import type { AppEnv } from '../env';

export const search = new Hono<AppEnv>();

search.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const q = (c.req.query('q') ?? '').trim().slice(0, 80);
  const empty: SearchResults = { tasks: [], journal: [], resources: [], products: [], people: [], items: [], listings: [], tools: [], posts: [], clubs: [] };
  if (q.length < 2) return c.json(empty);
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const [tasks, journal, resources, products, people, items, listings, tools, posts, clubs] = await Promise.all([
    db.prepare("SELECT id, title, relationship, status FROM nodes WHERE user_id = ? AND kind = 'task' AND title LIKE ? ORDER BY created_at DESC LIMIT 6").bind(user.id, like).all<SearchResults['tasks'][number]>(),
    db.prepare('SELECT id, title, created_at AS createdAt FROM journal_entries WHERE user_id = ? AND (title LIKE ? OR body LIKE ?) ORDER BY created_at DESC LIMIT 6').bind(user.id, like, like).all<SearchResults['journal'][number]>(),
    db.prepare('SELECT id, title, kind FROM resources WHERE published = 1 AND (title LIKE ? OR summary LIKE ? OR tags LIKE ?) LIMIT 6').bind(like, like, like).all<SearchResults['resources'][number]>(),
    db.prepare("SELECT p.id, p.title, p.kind, u.handle AS ownerHandle FROM products p JOIN users u ON u.id = p.owner_id WHERE p.status = 'live' AND (p.title LIKE ? OR p.description LIKE ?) LIMIT 6").bind(like, like).all<SearchResults['products'][number]>(),
    db.prepare('SELECT handle, display_name AS name FROM users WHERE handle IS NOT NULL AND (handle LIKE ? OR display_name LIKE ?) LIMIT 6').bind(like, like).all<SearchResults['people'][number]>(),
    db.prepare("SELECT id, title, category FROM store_items WHERE status = 'live' AND (title LIKE ? OR description LIKE ?) LIMIT 6").bind(like, like).all<SearchResults['items'][number]>(),
    db.prepare("SELECT id, title, condition FROM preowned_listings WHERE status IN ('live', 'agreed') AND (title LIKE ? OR description LIKE ?) LIMIT 6").bind(like, like).all<SearchResults['listings'][number]>(),
    db.prepare('SELECT id, name AS title, category FROM tools WHERE verified = 1 AND (name LIKE ? OR description LIKE ?) LIMIT 6').bind(like, like).all<SearchResults['tools'][number]>(),
    db.prepare('SELECT p.id, substr(p.body, 1, 120) AS body, u.display_name AS authorName FROM community_posts p JOIN users u ON u.id = p.user_id WHERE p.hidden_at IS NULL AND p.product_id IS NULL AND p.body LIKE ? ORDER BY p.created_at DESC LIMIT 6').bind(like).all<SearchResults['posts'][number]>(),
    db.prepare("SELECT id, name AS title, city FROM run_clubs WHERE status = 'active' AND visibility = 'public' AND (name LIKE ? OR city LIKE ? OR description LIKE ?) LIMIT 6").bind(like, like, like).all<SearchResults['clubs'][number]>(),
  ]);
  const res: SearchResults = { tasks: tasks.results, journal: journal.results, resources: resources.results, products: products.results, people: people.results, items: items.results, listings: listings.results, tools: tools.results, posts: posts.results, clubs: clubs.results };
  return c.json(res);
});
