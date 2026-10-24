import { Hono } from 'hono';
import { levelFromXp, wellbeingLabel, type LifeArea, type LifePart, type LifeSummary, type RelationshipKey } from '@kreators/shared';
import type { AppEnv } from '../env';

/** One dashboard for the five areas of a life, each part pointing at the screen where you act on it. */
export const life = new Hono<AppEnv>();

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const mean = (parts: LifePart[]) => {
  const xs = parts.map((p) => p.score).filter((x): x is number => x !== null);
  return xs.length ? clamp(xs.reduce((a, b) => a + b, 0) / xs.length) : 50;
};

interface Log { kind: string; date: string; value: number; extra: string }

life.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const today = new Date().toISOString().slice(0, 10);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
  const since14 = daysAgo(14);
  const since7 = daysAgo(7);
  const month = today.slice(0, 7);

  const [logs, journal, floors, tasks, sparks, fin, budgets, invoices, goals, cohorts] = await Promise.all([
    db.prepare('SELECT kind, date, value, extra FROM wellbeing_logs WHERE user_id = ? AND date >= ? ORDER BY date').bind(user.id, since14).all<Log>(),
    db.prepare('SELECT emotion, created_at FROM journal_entries WHERE user_id = ? AND created_at >= ? AND emotion IS NOT NULL').bind(user.id, `${since14}T00:00:00`).all<{ emotion: number; created_at: string }>(),
    db.prepare('SELECT relationship, xp FROM relationship_scores WHERE user_id = ?').bind(user.id).all<{ relationship: RelationshipKey; xp: number }>(),
    db.prepare("SELECT substr(completed_at, 1, 10) AS d, COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ? GROUP BY d").bind(user.id, `${since14}T00:00:00`).all<{ d: string; n: number }>(),
    db.prepare('SELECT date FROM spark_completions WHERE user_id = ? AND date >= ?').bind(user.id, since14).all<{ date: string }>(),
    db.prepare("SELECT kind, SUM(amount_cents) AS cents FROM finance_transactions WHERE user_id = ? AND date LIKE ? GROUP BY kind").bind(user.id, `${month}%`).all<{ kind: 'income' | 'expense'; cents: number }>(),
    db.prepare("SELECT b.category, b.monthly_cents, (SELECT COALESCE(SUM(amount_cents), 0) FROM finance_transactions t WHERE t.user_id = b.user_id AND t.kind = 'expense' AND t.category = b.category AND t.date LIKE ?) AS spent FROM finance_budgets b WHERE b.user_id = ?").bind(`${month}%`, user.id).all<{ category: string; monthly_cents: number; spent: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE user_id = ? AND status = 'sent' AND due_date IS NOT NULL AND due_date < ?").bind(user.id, today).first<{ n: number }>(),
    db.prepare("SELECT g.kind, g.target_cents, g.saved_cents, (SELECT COALESCE(SUM(amount_cents), 0) FROM finance_transactions t WHERE t.user_id = g.user_id AND t.kind = 'income' AND t.date >= g.start_date) AS earned FROM finance_goals g WHERE g.user_id = ?").bind(user.id).all<{ kind: string; target_cents: number; saved_cents: number; earned: number }>(),
    db
      .prepare(
        `SELECT e.status, (SELECT COUNT(*) FROM course_assignments a JOIN cohorts k ON k.program_id = a.program_id WHERE k.id = e.cohort_id) AS total,
           (SELECT COUNT(*) FROM submissions s WHERE s.cohort_id = e.cohort_id AND s.learner_user_id = e.learner_user_id AND s.status = 'approved') AS approved
         FROM enrollments e WHERE e.learner_user_id = ? AND e.status != 'withdrawn'`,
      )
      .bind(user.id)
      .all<{ status: string; total: number; approved: number }>(),
  ]);

  const week = (kind: string, from: string, to: string) => logs.results.filter((l) => l.kind === kind && l.date >= from && l.date < to);
  const thisWeek = (kind: string) => week(kind, since7, '9999');
  const lastWeek = (kind: string) => week(kind, since14, since7);
  const xpOf = (k: RelationshipKey) => floors.results.find((f) => f.relationship === k)?.xp ?? 0;
  const floorScore = (keys: RelationshipKey[]) => clamp(avg(keys.map((k) => Math.min(100, (levelFromXp(xpOf(k)) - 1) * 12 + Math.min(40, xpOf(k) / 10))) ?? 0);

  // Scores for one window, so the trend is the same arithmetic on the week before.
  const scoreSleep = (ls: Log[]) => {
    const a = avg(ls.map((l) => l.value));
    return a === null ? null : clamp(100 - Math.abs(7.5 - a) * 20);
  };
  const scoreMinutes = (ls: Log[], target: number) => (ls.length ? clamp((ls.reduce((s, l) => s + l.value, 0) / target) * 100) : null);
  const scoreMood = (ls: Log[]) => {
    const a = avg(ls.map((l) => l.value));
    return a === null ? null : clamp(((a - 1) / 4) * 100);
  };
  const scoreStress = (ls: Log[]) => {
    const a = avg(ls.map((l) => l.value));
    return a === null ? null : clamp(((5 - a) / 4) * 100);
  };
  const scoreCount = (n: number, target: number) => clamp((n / target) * 100);

  const sleepNow = thisWeek('sleep');
  const moveNow = thisWeek('move');
  const mindfulNow = thisWeek('mindful');
  const moodNow = thisWeek('mood');
  const stressNow = thisWeek('stress');
  const sleepAvg = avg(sleepNow.map((l) => l.value));
  const moveTotal = moveNow.reduce((s, l) => s + l.value, 0);
  const mindfulTotal = mindfulNow.reduce((s, l) => s + l.value, 0);
  const moodAvg = avg(moodNow.map((l) => l.value));
  const stressAvg = avg(stressNow.map((l) => l.value));
  const tasksThisWeek = tasks.results.filter((t) => t.d >= since7).reduce((s, t) => s + t.n, 0);
  const tasksLastWeek = tasks.results.filter((t) => t.d < since7).reduce((s, t) => s + t.n, 0);
  const sparksThisWeek = sparks.results.filter((s) => s.date >= since7).length;
  const sparksLastWeek = sparks.results.filter((s) => s.date < since7).length;
  const journalNow = journal.results.filter((j) => j.created_at >= `${since7}T00:00:00`);
  const journalBefore = journal.results.filter((j) => j.created_at < `${since7}T00:00:00`);
  const journalAvg = avg(journalNow.map((j) => j.emotion));

  const income = fin.results.find((f) => f.kind === 'income')?.cents ?? 0;
  const expense = fin.results.find((f) => f.kind === 'expense')?.cents ?? 0;
  const hasFinance = income + expense > 0 || budgets.results.length > 0 || goals.results.length > 0;
  const over = budgets.results.filter((b) => b.spent > b.monthly_cents).length;
  const goalPct = goals.results.map((g) => Math.min(100, ((g.kind === 'earn' ? g.earned : g.saved_cents) / Math.max(1, g.target_cents)) * 100));
  const learning = cohorts.results.map((k) => (k.status === 'completed' ? 100 : k.total ? (k.approved / k.total) * 100 : 20));

  const physical: LifePart[] = [
    { label: 'Sleep', value: sleepAvg === null ? 'not logged' : `${sleepAvg.toFixed(1)} h a night`, score: scoreSleep(sleepNow), path: '/sleep', hint: 'Seven to eight hours scores full marks.' },
    { label: 'Movement', value: moveNow.length ? `${moveTotal} min this week` : 'not logged', score: scoreMinutes(moveNow, 150), path: '/life#move', hint: 'A hundred and fifty minutes a week is the target.' },
    { label: 'Breath', value: mindfulNow.length ? `${mindfulTotal} mindful min` : 'not logged', score: scoreMinutes(mindfulNow, 60), path: '/mindful', hint: 'Sixty mindful minutes a week scores full marks.' },
  ];
  const physicalBefore = mean([
    { label: '', value: '', score: scoreSleep(lastWeek('sleep')), path: '', hint: '' },
    { label: '', value: '', score: scoreMinutes(lastWeek('move'), 150), path: '', hint: '' },
    { label: '', value: '', score: scoreMinutes(lastWeek('mindful'), 60), path: '', hint: '' },
  ]);

  const financial: LifePart[] = [
    { label: 'This month', value: hasFinance ? `${income >= expense ? 'kept' : 'short'} ${(Math.abs(income - expense) / 100).toLocaleString()}` : 'nothing logged', score: hasFinance ? clamp(income === 0 ? (expense > 0 ? 20 : 50) : 50 + ((income - expense) / income) * 50) : null, path: '/finance', hint: 'Keeping more than you spend scores above fifty.' },
    { label: 'Budgets', value: budgets.results.length ? (over ? `${over} over` : 'all within') : 'none set', score: budgets.results.length ? clamp(100 - over * 25) : null, path: '/finance', hint: 'Every category over budget costs twenty-five points.' },
    { label: 'Invoices', value: (invoices?.n ?? 0) > 0 ? `${invoices?.n} overdue` : 'none overdue', score: hasFinance ? clamp(100 - (invoices?.n ?? 0) * 30) : null, path: '/finance', hint: 'Chase what is overdue.' },
    { label: 'Goals', value: goals.results.length ? `${Math.round(avg(goalPct) ?? 0)}% there` : 'none yet', score: goals.results.length ? clamp(avg(goalPct) ?? 0) : null, path: '/finance', hint: 'Average progress across your money goals.' },
  ];

  const emotional: LifePart[] = [
    { label: 'Mood', value: moodAvg === null ? 'not logged' : `${moodAvg.toFixed(1)} of 5`, score: scoreMood(moodNow), path: '/mood', hint: 'Your average face this week.' },
    { label: 'Journal', value: journalNow.length ? `${journalNow.length} ${journalNow.length === 1 ? 'entry' : 'entries'}` : 'nothing written', score: journalAvg === null ? null : clamp(((journalAvg - 1) / 4) * 100), path: '/journal', hint: 'The feeling you tagged on entries.' },
    { label: 'People floors', value: `level ${Math.round(avg(['friendship', 'lover_partner', 'parent_child'].map((k) => levelFromXp(xpOf(k as RelationshipKey)))) ?? 1)}`, score: floorScore(['friendship', 'lover_partner', 'parent_child']), path: '/tower', hint: 'Friendship, partner and family floors of your tower.' },
  ];
  const emotionalBefore = mean([
    { label: '', value: '', score: scoreMood(lastWeek('mood')), path: '', hint: '' },
    { label: '', value: '', score: journalBefore.length ? clamp((((avg(journalBefore.map((j) => j.emotion)) ?? 3) - 1) / 4) * 100) : null, path: '', hint: '' },
    { label: '', value: '', score: floorScore(['friendship', 'lover_partner', 'parent_child']), path: '', hint: '' },
  ]);

  const mental: LifePart[] = [
    { label: 'Stress', value: stressAvg === null ? 'not logged' : `${stressAvg.toFixed(1)} of 5`, score: scoreStress(stressNow), path: '/stress', hint: 'Lower stress scores higher.' },
    { label: 'Focus', value: `${tasksThisWeek} ${tasksThisWeek === 1 ? 'task' : 'tasks'} done`, score: scoreCount(tasksThisWeek, 7), path: '/today', hint: 'Seven ticked tasks a week scores full marks.' },
    { label: 'Learning', value: cohorts.results.length ? `${Math.round(avg(learning) ?? 0)}% through` : 'not enrolled', score: cohorts.results.length ? clamp(avg(learning) ?? 0) : null, path: '/school', hint: 'Progress through your programs.' },
  ];
  const mentalBefore = mean([
    { label: '', value: '', score: scoreStress(lastWeek('stress')), path: '', hint: '' },
    { label: '', value: '', score: scoreCount(tasksLastWeek, 7), path: '', hint: '' },
    { label: '', value: '', score: cohorts.results.length ? clamp(avg(learning) ?? 0) : null, path: '', hint: '' },
  ]);

  const spiritual: LifePart[] = [
    { label: 'Stillness', value: mindfulNow.length ? `${mindfulTotal} min` : 'not logged', score: scoreMinutes(mindfulNow, 60), path: '/mindful', hint: 'Mindful minutes this week.' },
    { label: 'Sparks', value: `${sparksThisWeek} of 7 days`, score: scoreCount(sparksThisWeek, 5), path: '/today', hint: 'Five sparks a week scores full marks.' },
    { label: 'Top floors', value: `level ${Math.round(avg(['guru', 'divine'].map((k) => levelFromXp(xpOf(k as RelationshipKey)))) ?? 1)}`, score: floorScore(['guru', 'divine']), path: '/tower', hint: 'The guru and divine floors of your tower.' },
  ];
  const spiritualBefore = mean([
    { label: '', value: '', score: scoreMinutes(lastWeek('mindful'), 60), path: '', hint: '' },
    { label: '', value: '', score: scoreCount(sparksLastWeek, 5), path: '', hint: '' },
    { label: '', value: '', score: floorScore(['guru', 'divine']), path: '', hint: '' },
  ]);

  const areas: LifeArea[] = [
    { key: 'physical', score: mean(physical), trend: mean(physical) - physicalBefore, parts: physical },
    { key: 'financial', score: mean(financial), trend: 0, parts: financial },
    { key: 'emotional', score: mean(emotional), trend: mean(emotional) - emotionalBefore, parts: emotional },
    { key: 'mental', score: mean(mental), trend: mean(mental) - mentalBefore, parts: mental },
    { key: 'spiritual', score: mean(spiritual), trend: mean(spiritual) - spiritualBefore, parts: spiritual },
  ];
  const overall = clamp(areas.reduce((a, x) => a + x.score, 0) / areas.length);
  const summary: LifeSummary = { date: today, overall, label: wellbeingLabel(overall), areas };
  return c.json(summary);
});
