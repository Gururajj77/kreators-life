import { Hono } from 'hono';
import type { CourseDraft, QuizQuestion } from '@kreators/shared';
import type { AppEnv } from '../env';
import { newId, nowIso, str } from '../db';

/**
 * Draft a course from material the creator already has. With a Workers AI binding the model writes lessons and quizzes
 * from pasted notes, a transcript or a list of video links; without it, a plain outline is parsed.
 * Nothing is published: the lessons land as drafts on the course for the creator to edit.
 */
export const builder = new Hono<AppEnv>();

/**
 * Outline grammar: a line starting with # or ending with : opens a lesson; plain lines are its body;
 * a line ending with ? opens a question and the lines after it that start with - are options, * marks the right one.
 */
export function parseOutline(text: string): CourseDraft {
  const lessons: CourseDraft['lessons'] = [];
  let current: CourseDraft['lessons'][number] | null = null;
  let question: QuizQuestion | null = null;
  const flushQuestion = () => {
    if (question && current && question.options.length >= 2) current.quiz.push(question);
    question = null;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const heading = /^#+\s*(.+)$/.exec(line)?.[1] ?? (line.endsWith(':') && line.length < 120 ? line.slice(0, -1) : null);
    if (heading) {
      flushQuestion();
      current = { title: heading.slice(0, 140), body: '', quiz: [] };
      lessons.push(current);
      continue;
    }
    if (!current) {
      current = { title: line.slice(0, 140), body: '', quiz: [] };
      lessons.push(current);
      continue;
    }
    if (line.endsWith('?')) {
      flushQuestion();
      question = { q: line.slice(0, 300), options: [], answer: 0 };
      continue;
    }
    const option = /^[-*•]\s*(.+)$/.exec(line);
    if (question && option) {
      const txt = option[1] ?? '';
      const right = txt.startsWith('*') || txt.endsWith('*');
      const clean = txt.replace(/^\*|\*$/g, '').trim();
      if (right) question.answer = question.options.length;
      question.options.push(clean.slice(0, 200));
      continue;
    }
    flushQuestion();
    current.body += (current.body ? '\n' : '') + line;
  }
  flushQuestion();
  return { lessons: lessons.filter((l) => l.title).slice(0, 40), source: 'outline' };
}

async function draftWithAi(ai: Ai, source: string, title: string): Promise<CourseDraft | null> {
  try {
    const prompt = `You turn a creator's notes into a short course. Course title: "${title}". Reply with JSON only: {"lessons":[{"title":"...","body":"two to five short paragraphs","quiz":[{"q":"...","options":["...","..."],"answer":0}]}]}. Four to eight lessons, one or two quiz questions each, plain language.\n\nNotes:\n${source.slice(0, 12_000)}`;
    const res = (await ai.run('@cf/meta/llama-3.1-8b-instruct' as never, { messages: [{ role: 'user', content: prompt }], max_tokens: 2048 } as never)) as { response?: string };
    const text = res.response ?? '';
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json) as { lessons?: unknown };
    if (!Array.isArray(parsed.lessons)) return null;
    const lessons = parsed.lessons
      .map((l) => (l && typeof l === 'object' ? (l as Record<string, unknown>) : {}))
      .map((l) => ({
        title: str(l.title, 140),
        body: str(l.body, 20_000),
        quiz: (Array.isArray(l.quiz) ? l.quiz : [])
          .map((q) => (q && typeof q === 'object' ? (q as Record<string, unknown>) : {}))
          .map((q) => ({ q: str(q.q, 300), options: Array.isArray(q.options) ? q.options.map((o) => str(o, 200)).filter(Boolean).slice(0, 6) : [], answer: Number(q.answer) || 0 }))
          .filter((q) => q.q && q.options.length >= 2 && q.answer >= 0 && q.answer < q.options.length),
      }))
      .filter((l) => l.title)
      .slice(0, 12);
    return lessons.length ? { lessons, source: 'ai' } : null;
  } catch {
    return null;
  }
}

/** Preview a draft without saving anything. */
builder.post('/draft', async (c) => {
  const body = await c.req.json<{ source?: string; title?: string }>().catch(() => ({}) as { source?: string; title?: string });
  const source = str(body.source, 20_000);
  if (source.length < 20) return c.json({ error: 'paste your notes, a transcript or an outline first' }, 400);
  const ai = c.env.AI ? await draftWithAi(c.env.AI, source, str(body.title, 120) || 'Untitled course') : null;
  const draft = ai ?? parseOutline(source);
  if (draft.lessons.length === 0) return c.json({ error: 'nothing in there looked like a lesson; start lines with # for headings' }, 400);
  return c.json({ draft, aiAvailable: Boolean(c.env.AI) });
});

/** Save a draft's lessons onto one of your courses. */
builder.post('/products/:id/draft', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const product = await db.prepare("SELECT id FROM products WHERE id = ? AND owner_id = ? AND kind = 'course'").bind(c.req.param('id'), user.id).first<{ id: string }>();
  if (!product) return c.json({ error: 'that is not one of your courses' }, 404);
  const body = await c.req.json<{ lessons?: unknown }>().catch(() => ({}) as { lessons?: unknown });
  const lessons = Array.isArray(body.lessons) ? body.lessons : [];
  const next = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM lessons WHERE product_id = ?').bind(product.id).first<{ n: number }>();
  let sort = next?.n ?? 0;
  const stmts = [];
  for (const l of lessons.slice(0, 40)) {
    if (!l || typeof l !== 'object') continue;
    const o = l as Record<string, unknown>;
    const title = str(o.title, 140);
    if (!title) continue;
    const quiz = (Array.isArray(o.quiz) ? o.quiz : []).filter((q) => q && typeof q === 'object' && Array.isArray((q as QuizQuestion).options) && (q as QuizQuestion).options.length >= 2).slice(0, 20);
    stmts.push(db.prepare('INSERT INTO lessons (id, product_id, title, body, video_url, sort_order, drip_days, created_at, quiz_json, pass_score) VALUES (?, ?, ?, ?, NULL, ?, 0, ?, ?, ?)').bind(newId(), product.id, title, str(o.body, 20_000), sort, nowIso(), JSON.stringify(quiz), quiz.length ? 60 : 0));
    sort += 1;
  }
  if (stmts.length === 0) return c.json({ error: 'no lessons to save' }, 400);
  await db.batch(stmts);
  return c.json({ ok: true, added: stmts.length }, 201);
});
