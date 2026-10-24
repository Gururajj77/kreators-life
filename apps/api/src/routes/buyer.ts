import { Hono } from 'hono';
import type { Certificate, QuizQuestion } from '@kreators/shared';
import type { AppEnv } from '../env';
import { nameOf, newId, notify, nowIso, randomCode } from '../db';
import { DM_SELECT, toDmRequest } from './growth';
import { entitled } from './store';

/** Buyer-side extras: quizzes, certificates and priority DM questions. Mounted at /store. */
export const buyer = new Hono<AppEnv>();

export function parseQuiz(raw: string): QuizQuestion[] {
  try {
    const v = JSON.parse(raw || '[]') as unknown;
    return Array.isArray(v) ? v.filter((q): q is QuizQuestion => Boolean(q && typeof q === 'object' && 'q' in q && Array.isArray((q as QuizQuestion).options))) : [];
  } catch {
    return [];
  }
}

buyer.post('/lessons/:id/quiz', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const lesson = await db.prepare('SELECT product_id, quiz_json, pass_score FROM lessons WHERE id = ?').bind(c.req.param('id')).first<{ product_id: string; quiz_json: string; pass_score: number }>();
  if (!lesson || !(await entitled(db, user.id, lesson.product_id))) return c.json({ error: 'not found' }, 404);
  const quiz = parseQuiz(lesson.quiz_json);
  if (quiz.length === 0) return c.json({ error: 'this lesson has no quiz' }, 400);
  const body = await c.req.json<{ answers?: unknown }>().catch(() => ({}) as { answers?: unknown });
  const answers = Array.isArray(body.answers) ? body.answers.map((a) => Number(a)) : [];
  const right = quiz.filter((q, i) => answers[i] === q.answer).length;
  const score = Math.round((right / quiz.length) * 100);
  const passed = score >= (lesson.pass_score || 0);
  await db.prepare('INSERT OR REPLACE INTO quiz_attempts (user_id, lesson_id, score, passed, created_at) VALUES (?, ?, ?, ?, ?)').bind(user.id, c.req.param('id'), score, passed ? 1 : 0, nowIso()).run();
  if (passed) await db.prepare('INSERT OR IGNORE INTO lesson_progress (user_id, lesson_id, completed_at) VALUES (?, ?, ?)').bind(user.id, c.req.param('id'), nowIso()).run();
  return c.json({ score, passed, right, total: quiz.length, correct: quiz.map((q) => q.answer) });
});

// A certificate is issued once every lesson is done and every gated quiz is passed.
buyer.post('/products/:id/certificate', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const p = await db.prepare('SELECT id, title, owner_id, certificate FROM products WHERE id = ? AND kind = ?').bind(c.req.param('id'), 'course').first<{ id: string; title: string; owner_id: string; certificate: number }>();
  if (!p || !(await entitled(db, user.id, p.id))) return c.json({ error: 'not found' }, 404);
  if (p.certificate !== 1) return c.json({ error: 'this course does not issue certificates' }, 400);
  const lessons = await db.prepare('SELECT id, quiz_json, pass_score FROM lessons WHERE product_id = ?').bind(p.id).all<{ id: string; quiz_json: string; pass_score: number }>();
  const done = await db.prepare('SELECT lesson_id FROM lesson_progress WHERE user_id = ?').bind(user.id).all<{ lesson_id: string }>();
  const passed = await db.prepare('SELECT lesson_id FROM quiz_attempts WHERE user_id = ? AND passed = 1').bind(user.id).all<{ lesson_id: string }>();
  const doneSet = new Set(done.results.map((d) => d.lesson_id));
  const passedSet = new Set(passed.results.map((d) => d.lesson_id));
  const missing = lessons.results.filter((l) => !doneSet.has(l.id) || (l.pass_score > 0 && parseQuiz(l.quiz_json).length > 0 && !passedSet.has(l.id)));
  if (missing.length > 0) return c.json({ error: `${missing.length} lesson${missing.length === 1 ? '' : 's'} still to finish` }, 400);
  const existing = await db.prepare('SELECT code FROM certificates WHERE user_id = ? AND product_id = ?').bind(user.id, p.id).first<{ code: string }>();
  const code = existing?.code ?? randomCode(10);
  if (!existing) {
    await db.prepare('INSERT INTO certificates (id, code, user_id, product_id, issued_at) VALUES (?, ?, ?, ?, ?)').bind(newId(), code, user.id, p.id, nowIso()).run();
    await notify(db, p.owner_id, 'certificate', `${nameOf(user)} completed ${p.title}`, '', `/shop/products/${p.id}`);
  }
  return c.json({ code, url: `/c/${code}` }, existing ? 200 : 201);
});

buyer.get('/certificates', async (c) => {
  const rows = await c.env.DB.prepare('SELECT c.code, c.issued_at, p.title, u.display_name AS owner_name, me.display_name AS learner_name FROM certificates c JOIN products p ON p.id = c.product_id JOIN users u ON u.id = p.owner_id JOIN users me ON me.id = c.user_id WHERE c.user_id = ? ORDER BY c.issued_at DESC').bind(c.get('user').id).all<{ code: string; issued_at: string; title: string; owner_name: string; learner_name: string }>();
  const certificates: Certificate[] = rows.results.map((r) => ({ code: r.code, productTitle: r.title, learnerName: nameOf({ display_name: r.learner_name }), ownerName: nameOf({ display_name: r.owner_name }), issuedAt: r.issued_at }));
  return c.json({ certificates });
});

buyer.get('/dm', async (c) => {
  const rows = await c.env.DB.prepare(`${DM_SELECT} WHERE d.buyer_id = ? ORDER BY d.created_at DESC`).bind(c.get('user').id).all<Parameters<typeof toDmRequest>[0]>();
  return c.json({ requests: rows.results.map(toDmRequest) });
});

/** Public: anyone can check a certificate code. Mounted at /public/certificates. */
export const certificates = new Hono<AppEnv>();
certificates.get('/:code', async (c) => {
  const r = await c.env.DB.prepare('SELECT c.code, c.issued_at, p.title, u.display_name AS owner_name, me.display_name AS learner_name FROM certificates c JOIN products p ON p.id = c.product_id JOIN users u ON u.id = p.owner_id JOIN users me ON me.id = c.user_id WHERE c.code = ?').bind(c.req.param('code').toUpperCase()).first<{ code: string; issued_at: string; title: string; owner_name: string; learner_name: string }>();
  if (!r) return c.json({ error: 'no certificate with that code' }, 404);
  const certificate: Certificate = { code: r.code, productTitle: r.title, learnerName: nameOf({ display_name: r.learner_name }), ownerName: nameOf({ display_name: r.owner_name }), issuedAt: r.issued_at };
  return c.json({ certificate });
});
