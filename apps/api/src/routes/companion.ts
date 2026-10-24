import { Hono, type Context } from 'hono';
import { MOODS, RELATIONSHIP_BY_KEY, sparkFor, type ChatMessage, type RelationshipKey } from '@kreators/shared';
import type { AppEnv } from '../env';
import { newId, nowIso } from '../db';
import { summaryFor } from './wellbeing';

export const companion = new Hono<AppEnv>();

interface Row {
  id: string;
  role: 'user' | 'assistant';
  body: string;
  created_at: string;
}
const toMsg = (r: Row): ChatMessage => ({ id: r.id, role: r.role, body: r.body, createdAt: r.created_at });

interface Facts {
  name: string;
  streak: number;
  weakest: { name: string; character: string; question: string } | null;
  spark: string;
  openTasks: number;
  nextTask: string | null;
  score: number;
  label: string;
  mood: string | null;
  sleep: number | null;
}

async function factsFor(c: Context<AppEnv>): Promise<Facts> {
  const db = c.env.DB;
  const user = c.get('user');
  const today = new Date().toISOString().slice(0, 10);
  const weak = await db.prepare('SELECT relationship FROM relationship_scores WHERE user_id = ? ORDER BY score ASC, xp ASC LIMIT 1').bind(user.id).first<{ relationship: RelationshipKey }>();
  const rel = weak ? RELATIONSHIP_BY_KEY[weak.relationship] : null;
  const tasks = await db.prepare("SELECT title FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'active' ORDER BY due_date IS NULL, due_date ASC LIMIT 5").bind(user.id).all<{ title: string }>();
  const summary = await summaryFor(db, user.id, today, user.streak);
  const mood = summary.parts.find((p) => p.kind === 'mood')?.latest ?? null;
  const sleep = summary.parts.find((p) => p.kind === 'sleep')?.latest ?? null;
  return {
    name: user.display_name || 'friend',
    streak: user.streak,
    weakest: rel ? { name: rel.name.toLowerCase(), character: rel.character, question: rel.question } : null,
    spark: rel ? sparkFor(rel.key, today) : 'Take three slow breaths.',
    openTasks: tasks.results.length,
    nextTask: tasks.results[0]?.title ?? null,
    score: summary.score,
    label: summary.label.toLowerCase(),
    mood: mood ? (MOODS.find((m) => m.value === mood)?.name.toLowerCase() ?? null) : null,
    sleep,
  };
}

/** The companion without a model: it reflects what it knows and asks one real question. */
function localReply(text: string, f: Facts): string {
  const t = text.toLowerCase();
  const lines: string[] = [];
  if (/\b(tired|exhaust|sleep|insomnia|awake)\b/.test(t)) {
    lines.push(f.sleep ? `You logged ${f.sleep} hours last night.` : 'You have not logged sleep yet, so I am guessing here.');
    lines.push('Tonight, pick one thing: phone charging outside the bedroom, or a fixed time to be in bed. Which one feels possible?');
  } else if (/\b(stress|anxious|anxiety|overwhelm|panic|pressure)\b/.test(t)) {
    lines.push('Let us slow it down for sixty seconds. Breathe in for four, hold for four, out for six, three times.');
    lines.push('Then tell me: what is the one thing on the pile that actually has a deadline today?');
  } else if (/\b(sad|down|low|lonely|alone|cry|empty)\b/.test(t)) {
    lines.push('Thank you for saying it plainly. That takes something.');
    if (f.weakest) lines.push(`${f.weakest.character} on your ${f.weakest.name} floor keeps asking: ${f.weakest.question}`);
    lines.push('Who is one person you could send a two-line message to in the next hour?');
  } else if (/\b(angry|furious|annoyed|frustrat)\b/.test(t)) {
    lines.push('Anger usually points at something you care about. What got stepped on?');
  } else if (/\b(happy|great|good|amazing|proud|won|win)\b/.test(t)) {
    lines.push(`Good. Write that down in your journal before the feed eats it. ${f.streak > 0 ? `Day ${f.streak} of your streak, too.` : ''}`.trim());
    lines.push('What did you do differently that made today go well?');
  } else if (/\b(what|should|how|help|idea|next)\b/.test(t)) {
    if (f.nextTask) lines.push(`The next task on your tower is "${f.nextTask}". That is a good place to start.`);
    else lines.push('Your tower has no open tasks right now. Build a floor and it will give you three.');
    lines.push(`Today's spark: ${f.spark}`);
  } else {
    lines.push(`I hear you, ${f.name}.`);
    lines.push(f.mood ? `You marked today as ${f.mood}.` : 'You have not marked a mood today.');
    lines.push('What would make the next hour one percent better?');
  }
  if (lines.length < 3) lines.push(`Your wellbeing score is ${f.score}, ${f.label}.`);
  return lines.join(' ');
}

companion.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT 80').bind(c.get('user').id).all<Row>();
  return c.json({ messages: rows.results.map(toMsg), model: c.env.AI ? 'workers-ai' : 'local' });
});

companion.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ body?: string }>().catch(() => ({}) as { body?: string });
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 2000) : '';
  if (!text) return c.json({ error: 'say something first' }, 400);
  const facts = await factsFor(c);
  const now = nowIso();
  const userId = newId();
  await db.prepare('INSERT INTO chat_messages (id, user_id, role, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(userId, user.id, 'user', text, now).run();

  let reply: string | null = null;
  if (c.env.AI) {
    try {
      const history = await db.prepare('SELECT role, body FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 12').bind(user.id).all<{ role: string; body: string }>();
      const system = `You are the Companion inside Kreators Life, a daily game about seven relationships. Be warm, brief (under 90 words), concrete, and end with one question. Never diagnose or give medical advice; if someone mentions self-harm, tell them to contact local emergency services or a crisis line right away. Facts about this person: name ${facts.name}; streak ${facts.streak} days; wellbeing ${facts.score} (${facts.label}); mood today ${facts.mood ?? 'unknown'}; sleep last night ${facts.sleep ?? 'unknown'} hours; weakest floor ${facts.weakest?.name ?? 'unknown'}; open tasks ${facts.openTasks}; next task ${facts.nextTask ?? 'none'}; today's spark "${facts.spark}".`;
      const res = (await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'system', content: system }, ...history.results.reverse().map((m) => ({ role: m.role, content: m.body }))],
        max_tokens: 220,
      })) as { response?: string };
      reply = typeof res?.response === 'string' && res.response.trim() ? res.response.trim() : null;
    } catch {
      reply = null;
    }
  }
  if (!reply) reply = localReply(text, facts);
  if (/\b(suicid|kill myself|end it all|self[- ]harm)\b/i.test(text)) {
    reply = 'I am really glad you told me, and I want you to talk to a person right now. If you are in immediate danger, call your local emergency number. In India you can call Tele-MANAS on 14416 at any hour. I will still be here after.';
  }
  const asstId = newId();
  await db.prepare('INSERT INTO chat_messages (id, user_id, role, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(asstId, user.id, 'assistant', reply, nowIso()).run();
  return c.json({
    messages: [
      { id: userId, role: 'user', body: text, createdAt: now },
      { id: asstId, role: 'assistant', body: reply, createdAt: nowIso() },
    ] satisfies ChatMessage[],
  });
});

companion.delete('/', async (c) => {
  await c.env.DB.prepare('DELETE FROM chat_messages WHERE user_id = ?').bind(c.get('user').id).run();
  return c.json({ ok: true });
});
