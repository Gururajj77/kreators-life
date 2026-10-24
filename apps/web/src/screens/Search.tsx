import { KIND_META, PRODUCT_KIND_META, RELATIONSHIP_BY_KEY } from '@kreators/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';

export function Search() {
  const [q, setQ] = useState('');
  const res = useAuthed(['search', q], () => api.search(q), q.trim().length >= 2);
  const d = res.data;
  const total = d ? d.tasks.length + d.journal.length + d.resources.length + d.products.length + d.people.length : 0;
  return (
    <Screen>
      <header className="pt-lg">
        <h1 className="text-[30px]">Search</h1>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tasks, journals, library, products, people" aria-label="Search" className="mt-md w-full rounded-pill border-2 border-line bg-card px-md py-sm text-[16px]" />
      </header>
      {q.trim().length >= 2 && d && total === 0 && <p className="mt-md m-0 text-[14px] font-semibold text-ink-soft">Nothing matches "{q}".</p>}
      {d && d.tasks.length > 0 && (
        <Group title={KIND_META.task.plural}>
          {d.tasks.map((t) => (
            <Row key={t.id} to={`/realm/${t.relationship}`} title={t.title} sub={`${RELATIONSHIP_BY_KEY[t.relationship].name}, ${t.status}`} emoji="✅" />
          ))}
        </Group>
      )}
      {d && d.journal.length > 0 && (
        <Group title="Journal">
          {d.journal.map((j) => (
            <Row key={j.id} to="/journal" title={j.title} sub={new Date(j.createdAt).toLocaleDateString()} emoji="📓" />
          ))}
        </Group>
      )}
      {d && d.resources.length > 0 && (
        <Group title="Library">
          {d.resources.map((r) => (
            <Row key={r.id} to={`/knowledge/${r.id}`} title={r.title} sub={r.kind} emoji="📚" />
          ))}
        </Group>
      )}
      {d && d.products.length > 0 && (
        <Group title="Products">
          {d.products.map((p) => (
            <Row key={p.id} to={`/p/${p.id}`} title={p.title} sub={PRODUCT_KIND_META[p.kind].name} emoji={PRODUCT_KIND_META[p.kind].emoji} />
          ))}
        </Group>
      )}
      {d && d.people.length > 0 && (
        <Group title="People">
          {d.people.map((p) => (
            <Row key={p.handle} to={`/u/${p.handle}`} title={p.name || p.handle} sub={`@${p.handle}`} emoji="🧑" />
          ))}
        </Group>
      )}
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-lg">
      <h2 className="text-[18px]">{title}</h2>
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">{children}</ul>
    </section>
  );
}

function Row({ to, title, sub, emoji }: { to: string; title: string; sub: string; emoji: string }) {
  return (
    <li>
      <Link to={to} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm">
        <span className="flex size-[40px] shrink-0 items-center justify-center rounded-pill bg-paper text-[18px]" aria-hidden="true">
          {emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-bold">{title}</span>
          <span className="block text-[14px] font-semibold text-ink-soft">{sub}</span>
        </span>
      </Link>
    </li>
  );
}
