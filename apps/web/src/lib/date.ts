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

/** The last n local calendar dates, oldest first, ending today. */
export function lastDays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    out.push(`${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`);
  }
  return out;
}

/** "24 Oct" */
export function shortDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
