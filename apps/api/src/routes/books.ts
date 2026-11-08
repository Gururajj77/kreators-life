import { Hono } from 'hono';
import { BOOKS, type BookState, type BooksResponse } from '@kreators/shared';
import type { AppEnv } from '../env';
import { nowIso } from '../db';
import { cache } from '../cachecontrol';

/**
 * Where each of the founder's books can be had: the Shop product made under a team account (a draft says only "coming soon",
 * a live one gives its id and price) and the School program built from it (only once published, with its first open cohort).
 * Public and read-only, so the Book page in the app and the public site read the same answer; it names nobody and changes nothing,
 * so it needs no limit. It looks for each title through every product, so a shared copy keeps a burst of readers (or one script) from spending the free plan's rows a day.
 * Core: no line in MODULE_FOR_PREFIX, since the screens decide what to show by the person's own switches.
 */
export const booksPublic = new Hono<AppEnv>();
booksPublic.use('*', cache('public', { edgeSeconds: 60 }));

interface ProductHit {
  id: string;
  status: string;
  price_cents: number;
  currency: string;
}
interface CourseHit {
  id: string;
  name: string;
  price_points: number;
  price_cents: number;
}

booksPublic.get('/', async (c) => {
  const db = c.env.DB;
  const now = nowIso();
  const books: BookState[] = await Promise.all(
    BOOKS.map(async (b) => {
      const [product, course] = await Promise.all([
        // The founder's product: made by an admin account, titled as the book, live first. An archived one is gone.
        db
          .prepare("SELECT p.id, p.status, p.price_cents, p.currency FROM products p JOIN users u ON u.id = p.owner_id WHERE u.role = 'admin' AND lower(p.title) = lower(?) AND p.status IN ('live','draft') ORDER BY (p.status = 'live') DESC, p.created_at ASC LIMIT 1")
          .bind(b.title)
          .first<ProductHit>(),
        // The course: by its id in BOOKS, or by the book's title if the courses migration named it differently.
        db.prepare('SELECT id, name, price_points, price_cents FROM programs WHERE (id = ? OR lower(name) = lower(?)) AND published = 1 ORDER BY (id = ?) DESC LIMIT 1').bind(b.courseId, b.title, b.courseId).first<CourseHit>(),
      ]);
      const cohort = course
        ? await db.prepare("SELECT id FROM cohorts WHERE program_id = ? AND status != 'cancelled' AND end_at > ? ORDER BY start_at LIMIT 1").bind(course.id, now).first<{ id: string }>()
        : null;
      const live = product?.status === 'live';
      return {
        slug: b.slug,
        product: product ? { id: live ? product.id : null, live, priceCents: live ? product.price_cents : 0, currency: product.currency } : null,
        course: course ? { id: course.id, name: course.name, cohortId: cohort?.id ?? null, free: course.price_points === 0 && course.price_cents === 0 } : null,
      };
    }),
  );
  const body: BooksResponse = { books };
  return c.json(body);
});
