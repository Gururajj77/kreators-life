import { Hono } from 'hono';
import type { SearchResults } from '@kreators/shared';
import type { AppEnv } from '../env';
import { resolveAccess } from '../access';
import { hiddenByBlock, likeFit, liveUser } from '../db';

export const search = new Hono<AppEnv>();

const none = <T,>() => Promise.resolve({ results: [] as T[] });

search.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const q = (c.req.query('q') ?? '').trim().slice(0, 80);
  const empty: SearchResults = { tasks: [], journal: [], resources: [], products: [], people: [], items: [], listings: [], tools: [], posts: [], clubs: [], agencyClients: [], agencyInvoices: [], agencyContracts: [], agencyDocs: [], channels: [] };
  if (q.length < 2) return c.json(empty);
  const like = `%${likeFit(q.replace(/[%_]/g, ''))}%`;
  // Agency and the channels answer only while their app is on for this person, the same rule the module gate applies to their routes.
  const { access } = await resolveAccess(db, user);
  const agency = access.agency?.available === true;
  const community = access.community?.available === true;
  const bond = access.bond?.available === true;
  const [tasks, journal, resources, products, people, items, listings, tools, posts, clubs, aClients, aInvoices, aContracts, aDocs, chans] = await Promise.all([
    db.prepare("SELECT id, title, relationship, status FROM nodes WHERE user_id = ? AND kind = 'task' AND title LIKE ? ORDER BY created_at DESC LIMIT 6").bind(user.id, like).all<SearchResults['tasks'][number]>(),
    db.prepare('SELECT id, title, created_at AS createdAt FROM journal_entries WHERE user_id = ? AND (title LIKE ? OR body LIKE ?) ORDER BY created_at DESC LIMIT 6').bind(user.id, like, like).all<SearchResults['journal'][number]>(),
    db.prepare('SELECT id, title, kind FROM resources WHERE published = 1 AND (title LIKE ? OR summary LIKE ? OR tags LIKE ?) LIMIT 6').bind(like, like, like).all<SearchResults['resources'][number]>(),
    db.prepare("SELECT p.id, p.title, p.kind, u.handle AS ownerHandle FROM products p JOIN users u ON u.id = p.owner_id WHERE p.status = 'live' AND (p.title LIKE ? OR p.description LIKE ?) LIMIT 6").bind(like, like).all<SearchResults['products'][number]>(),
    db.prepare(`SELECT u.handle, u.display_name AS name FROM users u WHERE u.handle IS NOT NULL AND ${liveUser()} AND (u.handle LIKE ? OR u.display_name LIKE ?) LIMIT 6`).bind(like, like).all<SearchResults['people'][number]>(),
    db.prepare("SELECT id, title, category FROM store_items WHERE status = 'live' AND (title LIKE ? OR description LIKE ?) LIMIT 6").bind(like, like).all<SearchResults['items'][number]>(),
    db.prepare("SELECT id, title, condition FROM preowned_listings WHERE status IN ('live', 'agreed') AND (title LIKE ? OR description LIKE ?) LIMIT 6").bind(like, like).all<SearchResults['listings'][number]>(),
    db.prepare('SELECT id, name AS title, category FROM tools WHERE verified = 1 AND (name LIKE ? OR description LIKE ?) LIMIT 6').bind(like, like).all<SearchResults['tools'][number]>(),
    db.prepare(`SELECT p.id, substr(p.body, 1, 120) AS body, CASE WHEN p.anonymous = 1 THEN 'Anonymous' ELSE u.display_name END AS authorName FROM community_posts p JOIN users u ON u.id = p.user_id WHERE p.hidden_at IS NULL AND p.held_at IS NULL AND p.product_id IS NULL AND p.body LIKE ?2 AND NOT ${hiddenByBlock('?1', 'p.user_id', 'p.anonymous')} ORDER BY p.created_at DESC LIMIT 6`).bind(user.id, like).all<SearchResults['posts'][number]>(),
    db.prepare("SELECT id, name AS title, city FROM run_clubs WHERE status = 'active' AND visibility = 'public' AND (name LIKE ? OR city LIKE ? OR description LIKE ?) LIMIT 6").bind(like, like, like).all<SearchResults['clubs'][number]>(),
    // Agency: owner only (user_id = the session), titles and names only; never fees, notes, the retainer or what a client wrote.
    agency ? db.prepare('SELECT id, name AS title, status FROM agency_clients WHERE user_id = ? AND (name LIKE ? OR contact_name LIKE ?) ORDER BY updated_at DESC LIMIT 6').bind(user.id, like, like).all<SearchResults['agencyClients'][number]>() : none<SearchResults['agencyClients'][number]>(),
    agency
      ? db
          .prepare("SELECT i.id, i.number AS title, COALESCE(NULLIF(i.client_name, ''), k.name, '') AS client, i.status FROM invoices i LEFT JOIN agency_clients k ON k.id = i.agency_client_id AND k.user_id = i.user_id WHERE i.user_id = ?1 AND i.agency_client_id IS NOT NULL AND (i.number LIKE ?2 OR i.client_name LIKE ?2 OR k.name LIKE ?2) ORDER BY i.created_at DESC LIMIT 6")
          .bind(user.id, like)
          .all<SearchResults['agencyInvoices'][number]>()
      : none<SearchResults['agencyInvoices'][number]>(),
    agency
      ? db
          .prepare("SELECT a.id, a.title, COALESCE(k.name, '') AS client, a.status FROM agency_contracts a LEFT JOIN agency_clients k ON k.id = a.client_id AND k.user_id = a.user_id WHERE a.user_id = ?1 AND (a.title LIKE ?2 OR k.name LIKE ?2) ORDER BY a.updated_at DESC LIMIT 6")
          .bind(user.id, like)
          .all<SearchResults['agencyContracts'][number]>()
      : none<SearchResults['agencyContracts'][number]>(),
    agency
      ? db
          .prepare("SELECT d.id, d.title, COALESCE(k.name, '') AS client, d.status FROM agency_docs d LEFT JOIN agency_clients k ON k.id = d.client_id AND k.user_id = d.user_id WHERE d.user_id = ?1 AND (d.title LIKE ?2 OR k.name LIKE ?2) ORDER BY d.created_at DESC LIMIT 6")
          .bind(user.id, like)
          .all<SearchResults['agencyDocs'][number]>()
      : none<SearchResults['agencyDocs'][number]>(),
    // Channels by name and topic only (never a line, so no anonymous writer can be found through search). Community's open
    // channels are public; a Bond channel is found only by someone who is in it.
    community || bond
      ? db
          .prepare(
            `SELECT ch.id, ch.name AS title, ch.topic, ch.scope FROM channels ch
             WHERE ch.archived_at IS NULL AND (ch.name LIKE ?2 OR ch.topic LIKE ?2)
               AND ((?3 = 1 AND ch.scope = 'community')
                 OR (?4 = 1 AND ch.scope = 'bond' AND EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = ch.id AND m.user_id = ?1 AND m.status = 'member')))
             ORDER BY ch.name LIMIT 6`,
          )
          .bind(user.id, like, community ? 1 : 0, bond ? 1 : 0)
          .all<SearchResults['channels'][number]>()
      : none<SearchResults['channels'][number]>(),
  ]);
  const res: SearchResults = {
    tasks: tasks.results,
    journal: journal.results,
    resources: resources.results,
    products: products.results,
    people: people.results,
    items: items.results,
    listings: listings.results,
    tools: tools.results,
    posts: posts.results,
    clubs: clubs.results,
    agencyClients: aClients.results,
    agencyInvoices: aInvoices.results,
    agencyContracts: aContracts.results,
    agencyDocs: aDocs.results,
    channels: chans.results,
  };
  return c.json(res);
});
