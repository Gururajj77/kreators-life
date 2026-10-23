const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. The API treats this as the user's "today". */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function prettyDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function dueLabel(due: string | null, today: string): { text: string; overdue: boolean } | null {
  if (!due) return null;
  if (due === today) return { text: 'Today', overdue: false };
  if (due < today) return { text: 'Overdue', overdue: true };
  const [y, m, d] = due.split('-').map(Number);
  const dt = new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1);
  return { text: dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), overdue: false };
}
