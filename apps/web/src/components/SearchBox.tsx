import { KIND_META, PRODUCT_KIND_META, RELATIONSHIP_BY_KEY , HELP_FAQ, MODULES, PREOWNED_CONDITION_META, type PreownedCondition} from '@kreators/shared';
import { longDate } from '../lib/date';
import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import gsap from 'gsap';
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, Briefcase, FileSignature, FileText, Hash, LifeBuoy, MessageCircle, NotebookPen, Receipt, Recycle, ShoppingBag, ShoppingCart, SquareCheck, Toolbox, Footprints, UserRound } from 'lucide-react';
import { appIcon } from '../lib/appIcons';
import { AnimatedIcon } from './AnimatedIcon';
import { Icon } from './Icon';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { useDebounced } from '../lib/useDebounced';

/**
 * Search that answers under itself as you type. No new page: results land in a card right below
 * the field, grouped, and a tap on one opens it. Two letters in, a short pause, and the list appears.
 */
export function SearchBox({ placeholder = 'Search anything', autoFocus = false, onDark = false }: { placeholder?: string; autoFocus?: boolean; onDark?: boolean }) {
  const id = useId();
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim(), 300);
  const live = query.length >= 2;
  const gooOk = useGooAllowed();
  // The last query that had results stays on screen while the panel drains back into the field.
  const [held, setHeld] = useState('');
  if (live && held !== query) setHeld(query);
  if (!gooOk && !live && held !== '') setHeld('');
  const shown = live || held !== '';
  const view = live ? query : held;
  const res = useAuthed(['search', view], () => api.search(view), shown);
  const d = res.data;
  const needle = view.toLowerCase();
  const apps = shown ? MODULES.filter((m) => !m.locked && (m.name.toLowerCase().includes(needle) || m.blurb.toLowerCase().includes(needle))).slice(0, 5) : [];
  const help = shown ? HELP_FAQ.filter((f) => f.q.toLowerCase().includes(needle) || f.a.toLowerCase().includes(needle)).slice(0, 3) : [];
  const total = (d ? d.tasks.length + d.journal.length + d.resources.length + d.products.length + d.people.length + d.items.length + d.listings.length + d.tools.length + d.posts.length + d.clubs.length + d.agencyClients.length + d.agencyInvoices.length + d.agencyContracts.length + d.agencyDocs.length + d.channels.length : 0) + apps.length + help.length;

  const wrapRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gooRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const neckRef = useRef<HTMLDivElement>(null);
  const filterId = `goo-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  useGooPour({ live, gooOk, shown, onDrained: () => setHeld(''), refs: { wrapRef, fieldRef, panelRef, gooRef, dropRef, neckRef } });

  return (
    <div ref={wrapRef} className={`relative${gooOk ? ' search-goo-host' : ''}`} data-goo={gooOk ? 'rest' : undefined}>
      {gooOk && (
        // The liquid: two solid shapes behind the real field and panel, merged by an SVG goo filter. Decoration only.
        <div ref={gooRef} className="search-goo" aria-hidden="true">
          <svg width="0" height="0" className="absolute" focusable="false">
            <defs>
              <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
                <feComposite in="SourceGraphic" in2="goo" operator="atop" />
              </filter>
            </defs>
          </svg>
          <div className="search-goo-shapes" style={{ filter: `url(#${filterId})` }}>
            <div className="search-goo-pill" />
            <div ref={neckRef} className="search-goo-neck" />
            <div ref={dropRef} className="search-goo-drop" />
          </div>
        </div>
      )}
      <label htmlFor={id} className="sr-only">
        Search
      </label>
      <div ref={fieldRef} className={`flex min-h-[48px] items-center gap-sm rounded-pill border-2 border-transparent bg-card px-md shadow-toy-soft transition-colors ${onDark ? 'focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-[3px] focus-within:outline-on-fill' : 'focus-within:border-ink'}`}>
        {/* The magnifier turns into the clear button once there is text (useanimations' searchToX). */}
        {/* One element the whole time, so the morph plays: a magnifier while empty, the clear button once there is text. */}
        <button
          type="button"
          onClick={() => setQ('')}
          disabled={!q}
          aria-label={q ? 'Clear search' : undefined}
          aria-hidden={q ? undefined : true}
          tabIndex={q ? 0 : -1}
          className="-ml-sm flex size-[44px] shrink-0 items-center justify-center rounded-pill text-ink disabled:cursor-text"
        >
          <AnimatedIcon name="searchToX" active={q !== ''} />
        </button>
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
      </div>
      {shown && (
        <div ref={panelRef} id={`${id}-results`} role="region" aria-live="polite" aria-label="Search results" inert={!live} className="mt-xs rounded-card bg-card p-sm shadow-toy-soft">
          {apps.length > 0 && (
            <Group title="Apps">
              {apps.map((m) => (
                <Row key={m.key} to={m.path} title={m.name} sub={m.blurb} icon={appIcon(m.icon)} />
              ))}
            </Group>
          )}
          {res.isPending && apps.length === 0 && <p className="m-0 px-xs py-xs text-[14px] font-semibold text-ink-soft">Looking</p>}
          {d && total === 0 && <p className="m-0 px-xs py-xs text-[14px] font-semibold text-ink-soft">Nothing matches "{view}".</p>}
          {d && d.tasks.length > 0 && (
            <Group title={KIND_META.task.plural}>
              {d.tasks.slice(0, 5).map((t) => (
                <Row key={t.id} to={`/realm/${t.relationship}`} title={t.title} sub={`${RELATIONSHIP_BY_KEY[t.relationship].name}, ${t.status}`} icon={SquareCheck} />
              ))}
            </Group>
          )}
          {d && d.journal.length > 0 && (
            <Group title="Journal">
              {d.journal.slice(0, 5).map((j) => (
                <Row key={j.id} to="/journal" title={j.title} sub={longDate(j.createdAt)} icon={NotebookPen} />
              ))}
            </Group>
          )}
          {d && d.resources.length > 0 && (
            <Group title="Knowledge">
              {d.resources.slice(0, 5).map((r) => (
                <Row key={r.id} to={`/knowledge/${r.id}`} title={r.title} sub={r.kind} icon={BookOpen} />
              ))}
            </Group>
          )}
          {d && d.products.length > 0 && (
            <Group title="Products">
              {d.products.slice(0, 5).map((p) => (
                <Row key={p.id} to={`/p/${p.id}`} title={p.title} sub={PRODUCT_KIND_META[p.kind].name} icon={ShoppingBag} />
              ))}
            </Group>
          )}
          {d && d.people.length > 0 && (
            <Group title="People">
              {d.people.slice(0, 5).map((p) => (
                <Row key={p.handle} to={`/u/${p.handle}`} title={p.name || p.handle} sub={`@${p.handle}`} icon={UserRound} />
              ))}
            </Group>
          )}
          {d && d.items.length > 0 && (
            <Group title="Store">
              {d.items.slice(0, 5).map((i) => (
                <Row key={i.id} to="/store" title={i.title} sub={`${i.category}, new`} icon={ShoppingCart} />
              ))}
            </Group>
          )}
          {d && d.listings.length > 0 && (
            <Group title="Pre-owned">
              {d.listings.slice(0, 5).map((l) => (
                <Row key={l.id} to="/store" title={l.title} sub={PREOWNED_CONDITION_META[l.condition as PreownedCondition]?.name ?? l.condition} icon={Recycle} />
              ))}
            </Group>
          )}
          {d && d.tools.length > 0 && (
            <Group title="Tools">
              {d.tools.slice(0, 5).map((t) => (
                <Row key={t.id} to="/tools" title={t.title} sub={t.category} icon={Toolbox} />
              ))}
            </Group>
          )}
          {d && d.clubs.length > 0 && (
            <Group title="Run clubs">
              {d.clubs.slice(0, 5).map((k) => (
                <Row key={k.id} to={`/run/clubs/${k.id}`} title={k.title} sub={k.city} icon={Footprints} />
              ))}
            </Group>
          )}
          {d && d.posts.length > 0 && (
            <Group title="Community">
              {d.posts.slice(0, 5).map((p) => (
                <Row key={p.id} to={`/community?post=${p.id}`} title={p.body} sub={p.authorName} icon={MessageCircle} />
              ))}
            </Group>
          )}
          {d && d.channels.length > 0 && (
            <Group title="Channels">
              {d.channels.slice(0, 5).map((ch) => (
                <Row key={ch.id} to={ch.scope === 'community' ? `/community?tab=channels&channel=${ch.id}` : `/bond?channel=${ch.id}#bond-channels`} title={ch.title} sub={`${ch.scope === 'community' ? 'Community' : 'Bond'}${ch.topic ? `, ${ch.topic}` : ''}`} icon={Hash} />
              ))}
            </Group>
          )}
          {d && d.agencyClients.length > 0 && (
            <Group title="Agency clients">
              {d.agencyClients.slice(0, 5).map((k) => (
                <Row key={k.id} to={`/agency/${k.id}`} title={k.title} sub={k.status} icon={Briefcase} />
              ))}
            </Group>
          )}
          {d && d.agencyInvoices.length > 0 && (
            <Group title="Invoices">
              {d.agencyInvoices.slice(0, 5).map((i) => (
                <Row key={i.id} to={`/agency/invoices/${i.id}`} title={i.title} sub={[i.client, i.status].filter(Boolean).join(', ')} icon={Receipt} />
              ))}
            </Group>
          )}
          {d && d.agencyContracts.length > 0 && (
            <Group title="Agreements">
              {d.agencyContracts.slice(0, 5).map((a) => (
                <Row key={a.id} to={`/agency/contracts/${a.id}`} title={a.title} sub={[a.client, a.status].filter(Boolean).join(', ')} icon={FileSignature} />
              ))}
            </Group>
          )}
          {d && d.agencyDocs.length > 0 && (
            <Group title="Documents">
              {d.agencyDocs.slice(0, 5).map((x) => (
                <Row key={x.id} to={`/agency/docs/${x.id}`} title={x.title} sub={[x.client, x.status].filter(Boolean).join(', ')} icon={FileText} />
              ))}
            </Group>
          )}
          {help.length > 0 && (
            <Group title="Help">
              {help.map((f) => (
                <Row key={f.q} to="/help" title={f.q} sub={f.a.slice(0, 80)} icon={LifeBuoy} />
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}

/** No goo where motion is reduced or the glass is asked to be solid: the panel then simply appears, as before. */
const GOO_OFF = '(prefers-reduced-motion: reduce), (prefers-reduced-transparency: reduce), (prefers-contrast: more)';
function useGooAllowed(): boolean {
  const [ok, setOk] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && !window.matchMedia(GOO_OFF).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(GOO_OFF);
    const on = () => setOk(!mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return ok;
}

type Box = { fx: number; fy: number; fw: number; fh: number; py: number; ph: number };
type GooRefs = {
  wrapRef: RefObject<HTMLDivElement | null>;
  fieldRef: RefObject<HTMLDivElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  gooRef: RefObject<HTMLDivElement | null>;
  dropRef: RefObject<HTMLDivElement | null>;
  neckRef: RefObject<HTMLDivElement | null>;
};

/**
 * The pour: when results open, a drop leaves the field's bottom edge, stretches down to where the panel sits and
 * settles as one liquid shape with a neck, then the real panel fades in over it (opacity only). Clearing runs it
 * back. Results that change size glide the drop with a scale. Runs only on a change, never at rest.
 */
function useGooPour({ live, gooOk, shown, onDrained, refs }: { live: boolean; gooOk: boolean; shown: boolean; onDrained: () => void; refs: GooRefs }) {
  const tl = useRef<gsap.core.Timeline | null>(null);
  const lastH = useRef(0);
  const drained = useRef(onDrained);
  useEffect(() => {
    drained.current = onDrained;
  });
  const { wrapRef, fieldRef, panelRef, gooRef, dropRef, neckRef } = refs;

  const measure = (): Box | null => {
    const f = fieldRef.current;
    const p = panelRef.current;
    if (!f || !p) return null;
    return { fx: f.offsetLeft, fy: f.offsetTop, fw: f.offsetWidth, fh: f.offsetHeight, py: p.offsetTop, ph: p.offsetHeight };
  };
  const place = (b: Box) => {
    const pill = gooRef.current?.querySelector<HTMLElement>('.search-goo-pill');
    const neck = neckRef.current;
    const drop = dropRef.current;
    if (!pill || !neck || !drop) return;
    Object.assign(pill.style, { left: `${b.fx}px`, top: `${b.fy}px`, width: `${b.fw}px`, height: `${b.fh}px` });
    const nw = Math.round(b.fw * 0.4);
    const bottom = b.fy + b.fh;
    Object.assign(neck.style, { left: `${b.fx + (b.fw - nw) / 2}px`, top: `${bottom - 14}px`, width: `${nw}px`, height: `${Math.max(0, b.py - bottom) + 28}px` });
    Object.assign(drop.style, { left: `${b.fx}px`, top: `${b.py}px`, width: `${b.fw}px`, height: `${b.ph}px` });
  };
  // Where the drop starts: tucked just inside the field's bottom edge.
  const startY = (b: Box) => b.fy + b.fh - 6 - b.py;

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const goo = gooRef.current;
    const drop = dropRef.current;
    const neck = neckRef.current;
    const panel = panelRef.current;
    if (!gooOk || !wrap || !goo || !drop || !neck) return;
    if (!live && wrap.dataset.goo === 'rest') return;
    const b = measure();
    if (!panel || !b) return;
    tl.current?.kill();
    place(b);
    lastH.current = b.ph;
    if (live) {
      if (wrap.dataset.goo === 'rest') {
        gsap.set(drop, { y: startY(b), scaleX: 0.35, scaleY: 0.1 });
        gsap.set(neck, { scaleY: 0 });
        gsap.set(panel, { opacity: 0 });
      }
      wrap.dataset.goo = 'opening';
      tl.current = gsap
        .timeline({ onComplete: () => void (wrap.dataset.goo = 'open') })
        .set(goo, { opacity: 1 }, 0)
        .to(drop, { y: 0, scaleX: 1, scaleY: 1, duration: 0.55, ease: 'expo.out' }, 0)
        .to(neck, { scaleY: 1, duration: 0.35, ease: 'power3.out' }, 0.04)
        .to(panel, { opacity: 1, duration: 0.22, ease: 'power1.out' }, 0.33);
    } else {
      wrap.dataset.goo = 'closing';
      tl.current = gsap
        .timeline({
          onComplete: () => {
            gsap.set(goo, { opacity: 0 });
            wrap.dataset.goo = 'rest';
            drained.current();
          },
        })
        .to(panel, { opacity: 0, duration: 0.15, ease: 'power1.in' }, 0)
        .to(drop, { y: startY(b), scaleX: 0.35, scaleY: 0.1, duration: 0.35, ease: 'power2.in' }, 0.05)
        .to(neck, { scaleY: 0, duration: 0.25, ease: 'power2.in' }, 0.15)
        .to(goo, { opacity: 0, duration: 0.12 }, 0.32);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, gooOk]);

  useEffect(() => () => void tl.current?.kill(), []);

  // Results growing or shrinking: the drop takes its new size at once and glides there with a scale.
  useEffect(() => {
    const panel = panelRef.current;
    const field = fieldRef.current;
    if (!gooOk || !shown || !panel || !field || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const b = measure();
      const drop = dropRef.current;
      const wrap = wrapRef.current;
      if (!b || !drop || !wrap) return;
      const before = lastH.current;
      place(b);
      lastH.current = b.ph;
      if (wrap.dataset.goo === 'open' && before > 0 && b.ph > 0 && before !== b.ph) {
        gsap.fromTo(drop, { scaleY: before / b.ph }, { scaleY: 1, duration: 0.3, ease: 'power3.out', overwrite: 'auto' });
      }
    });
    ro.observe(panel);
    ro.observe(field);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gooOk, shown]);
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-xs first:mt-0">
      <h2 className="m-0 px-xs text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{title}</h2>
      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">{children}</ul>
    </section>
  );
}

function Row({ to, title, sub, icon }: { to: string; title: string; sub: string; icon: LucideIcon }) {
  return (
    <li>
      <Link to={to} className="toy toy-flat flex items-center gap-sm rounded-tile bg-paper p-sm text-ink">
        <span className="flex size-[36px] shrink-0 items-center justify-center rounded-pill bg-card text-ink-soft">
          <Icon icon={icon} size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-bold">{title}</span>
          <span className="block text-[12px] font-bold text-ink-soft">{sub}</span>
        </span>
      </Link>
    </li>
  );
}
