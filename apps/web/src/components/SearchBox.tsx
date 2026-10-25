import { KIND_META, PRODUCT_KIND_META, RELATIONSHIP_BY_KEY } from '@kreators/shared';
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';

/**
 * Search that answers under itself as you type. No new page: results land in a card right below
 * the field, grouped, and a tap on one opens it. Two letters in, a short pause, and the list appears.
 */
export function SearchBox({ placeholder = 'Search anything', autoFocus = false, onDark = false }: { placeholder?: string; autoFocus?: boolean; onDark?: boolean }) {
  const id = useId();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);
  const live = query.length >= 2;
  const res = useAuthed(['search', query], () => api.search(query), live);
  const d = res.data;
  const total = d ? d.tasks.length + d.journal.length + d.resources.length + d.products.length + d.people.length : 0;

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        Search
      </label>
      <div className={`flex min-h-[48px] items-center gap-sm rounded-pill border-2 border-transparent bg-card px-md shadow-toy-soft transition-colors ${onDark ? 'focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-[3px] focus-within:outline-on-fill' : 'focus-within:border-ink'}`}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="shrink-0 text-ink">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          id={id}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-controls={`${id}-results`}
          aria-expanded={live}
          className="min-w-0 flex-1 bg-transparent py-sm text-[16px] font-semibold text-ink outline-none placeholder:text-ink-soft"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="Clear" className="flex size-[32px] shrink-0 items-center justify-center rounded-pill bg-paper text-ink-soft">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
      {live && (
        <div id={`${id}-results`} role="region" aria-live="polite" aria-label="Search results" className="mt-xs rounded-card bg-card p-sm shadow-toy-soft">
          {res.isPending && <p className="m-0 px-xs py-xs text-[14px] font-semibold text-ink-soft">Looking</p>}
          {d && total === 0 && <p className="m-0 px-xs py-xs text-[14px] font-semibold text-ink-soft">Nothing matches "{query}".</p>}
          {d && d.tasks.length > 0 && (
            <Group title={KIND_META.task.plural}>
              {d.tasks.slice(0, 5).map((t) => (
                <Row key={t.id} to={`/realm/${t.relationship}`} title={t.title} sub={`${RELATIONSHIP_BY_KEY[t.relationship].name}, ${t.status}`} emoji="✅" />
              ))}
            </Group>
          )}
          {d && d.journal.length > 0 && (
            <Group title="Journal">
              {d.journal.slice(0, 5).map((j) => (
                <Row key={j.id} to="/journal" title={j.title} sub={new Date(j.createdAt).toLocaleDateString()} emoji="📓" />
              ))}
            </Group>
          )}
          {d && d.resources.length > 0 && (
            <Group title="Knowledge">
              {d.resources.slice(0, 5).map((r) => (
                <Row key={r.id} to={`/knowledge/${r.id}`} title={r.title} sub={r.kind} emoji="📚" />
              ))}
            </Group>
          )}
          {d && d.products.length > 0 && (
            <Group title="Products">
              {d.products.slice(0, 5).map((p) => (
                <Row key={p.id} to={`/p/${p.id}`} title={p.title} sub={PRODUCT_KIND_META[p.kind].name} emoji={PRODUCT_KIND_META[p.kind].emoji} />
              ))}
            </Group>
          )}
          {d && d.people.length > 0 && (
            <Group title="People">
              {d.people.slice(0, 5).map((p) => (
                <Row key={p.handle} to={`/u/${p.handle}`} title={p.name || p.handle} sub={`@${p.handle}`} emoji="🧑" />
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-xs first:mt-0">
      <h2 className="m-0 px-xs text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{title}</h2>
      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">{children}</ul>
    </section>
  );
}

function Row({ to, title, sub, emoji }: { to: string; title: string; sub: string; emoji: string }) {
  return (
    <li>
      <Link to={to} className="toy toy-flat flex items-center gap-sm rounded-tile bg-paper p-sm text-ink">
        <span className="flex size-[36px] shrink-0 items-center justify-center rounded-pill bg-card text-[16px]" aria-hidden="true">
          {emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-bold">{title}</span>
          <span className="block text-[12px] font-bold text-ink-soft">{sub}</span>
        </span>
      </Link>
    </li>
  );
}
