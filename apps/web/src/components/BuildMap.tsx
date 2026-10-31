import { MODULES, RELATIONSHIPS } from '@kreators/shared';
import { BUILD_FILES, BUILD_SECTIONS, itemsOf, percentOf, type BuildCard, type BuildItem, type BuildState } from '../lib/buildMap';
import { Section } from './Section';

const STATE: Record<BuildState, { name: string; glyph: string; bg: string; edge: string }> = {
  ok: { name: 'Built and checked', glyph: '✓', bg: 'var(--tint-green)', edge: 'var(--color-r4)' },
  key: { name: 'Needs a key', glyph: '!', bg: 'var(--tint-yellow)', edge: 'var(--color-r3)' },
  test: { name: 'Test mode or not tried live', glyph: '~', bg: 'var(--tint-orange)', edge: 'var(--color-r2)' },
  off: { name: 'Not built', glyph: '', bg: 'transparent', edge: 'var(--color-line)' },
};
const colorOf = (floor: number) => RELATIONSHIPS[floor - 1]!.color;

function Ring({ value, color }: { value: number; color: string }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-[48px] shrink-0" role="img" aria-label={`${value} percent done`}>
      <svg viewBox="0 0 56 56" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--color-line)" strokeWidth="6" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(c * value) / 100} ${c}`} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[12px] font-extrabold">{value}</span>
    </div>
  );
}

function Block({ item }: { item: BuildItem }) {
  const [label, state, note] = item;
  const s = STATE[state];
  return (
    <li className="flex items-start gap-xs rounded-tile border px-xs py-xs text-[14px] font-semibold" style={{ background: s.bg, borderColor: s.edge, borderStyle: state === 'off' ? 'dashed' : 'solid' }}>
      <span className="mt-[2px] w-[14px] shrink-0 text-center text-[12px] font-extrabold" aria-hidden="true">
        {s.glyph}
      </span>
      <span className="min-w-0">
        <span className="sr-only">{s.name}: </span>
        {label}
        {note && <span className="block text-[12px] font-bold text-ink-soft">{note}</span>}
      </span>
    </li>
  );
}

function Card({ card, color }: { card: BuildCard; color: string }) {
  const all = itemsOf(card);
  const pipe = card.visual === 'pipe';
  return (
    <article className={`rounded-card bg-card p-md shadow-toy-soft ${card.wide ? 'md:col-span-2' : ''}`}>
      <div className="flex items-center gap-sm">
        <Ring value={percentOf(all)} color={color} />
        <div className="min-w-0">
          <h3 className="text-[18px] leading-tight">{card.title}</h3>
          {card.route && <p className="m-0 break-words font-mono text-[12px] font-bold text-ink-mute">{card.route}</p>}
        </div>
      </div>
      {pipe ? (
        <ol className="mt-sm flex list-none flex-wrap items-center gap-xs p-0 m-0">
          {card.items.map((it, i) => {
            const s = STATE[it[1]];
            return (
              <li key={`${it[0]}${i}`} className="flex items-center gap-xs">
                <span className="rounded-pill border px-sm py-xs text-[12px] font-bold" style={{ background: s.bg, borderColor: s.edge, borderStyle: it[1] === 'off' ? 'dashed' : 'solid' }}>
                  <span className="sr-only">{s.name}: </span>
                  {it[0]}
                </span>
                {i < card.items.length - 1 && (
                  <span className="text-ink-mute" aria-hidden="true">
                    →
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <ul className="mt-sm grid list-none grid-cols-1 gap-xs p-0 m-0 sm:grid-cols-2">
          {card.items.map((it, i) => (
            <Block key={`${it[0]}${i}`} item={it} />
          ))}
        </ul>
      )}
      {card.extra && (
        <ul className="mt-xs grid list-none grid-cols-1 gap-xs p-0 m-0 sm:grid-cols-2">
          {card.extra.map((it, i) => (
            <Block key={`${it[0]}${i}`} item={it} />
          ))}
        </ul>
      )}
    </article>
  );
}

/**
 * The build map, as data in the page: what is built, what waits on a key, what runs in test mode and what is not built, by section and card.
 * It reads lib/buildMap.ts, so editing a state there moves the rings, the bars and the tower. The tower and the totals come first, then
 * each section, then the files to open.
 */
export function BuildMap() {
  const rows = BUILD_SECTIONS.map((s) => ({ s, all: s.cards.flatMap(itemsOf) }));
  const everything = rows.flatMap((r) => r.all);
  const count = (st: BuildState) => everything.filter((i) => i[1] === st).length;
  const tower = [...rows].sort((a, b) => b.s.floor - a.s.floor);

  return (
    <>
      <Section id="obs-map" title="Build map" lede="What is built, what waits on a key, what runs in test mode and what is not built. Green is built and checked, yellow needs a key, orange is test mode or not tried live, dashed is not built.">
        <div className="grid grid-cols-2 gap-xs md:grid-cols-6">
          {[
            [`${percentOf(everything)}%`, 'of everything listed, weighted'],
            [count('ok'), 'built and checked'],
            [count('key'), 'waiting on a key'],
            [count('test'), 'in test mode'],
            [count('off'), 'not built'],
            [MODULES.length, 'modules in the registry'],
          ].map(([b, l]) => (
            <div key={String(l)} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <span className="block font-display text-[24px] font-extrabold leading-none">{b}</span>
              <span className="mt-xs block text-[12px] font-bold text-ink-soft">{l}</span>
            </div>
          ))}
        </div>
        <ul className="mt-sm flex list-none flex-wrap gap-xs p-0 m-0" aria-label="What the colours mean">
          {(Object.keys(STATE) as BuildState[]).map((k) => (
            <li key={k} className="rounded-pill border px-sm py-xs text-[12px] font-extrabold" style={{ background: STATE[k].bg, borderColor: STATE[k].edge, borderStyle: k === 'off' ? 'dashed' : 'solid' }}>
              {STATE[k].name}
            </li>
          ))}
        </ul>
        <nav aria-label="Sections of the build map" className="mt-sm flex flex-col items-center gap-xs">
          {tower.map(({ s, all }) => {
            const p = percentOf(all);
            return (
              <a key={s.id} href={`#build-${s.id}`} className="toy relative flex min-h-[44px] items-center justify-between gap-sm overflow-hidden rounded-pill px-md text-[14px] font-extrabold text-on-fill" style={{ width: `${46 + (7 - s.floor) * 8}%`, background: colorOf(s.floor) }}>
                <span className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${p}%` }} aria-hidden="true" />
                <span className="relative">{s.short}</span>
                <span className="relative">{p}%</span>
              </a>
            );
          })}
        </nav>
      </Section>

      {rows.map(({ s, all }) => (
        <section key={s.id} id={`build-${s.id}`} className="mt-lg" aria-labelledby={`build-h-${s.id}`}>
          <h2 id={`build-h-${s.id}`} className="flex items-center gap-xs text-[24px]">
            <span className="block size-[14px] rounded-pill" style={{ background: colorOf(s.floor) }} aria-hidden="true" />
            {s.name} <span className="text-[16px] font-bold text-ink-mute">{percentOf(all)}%</span>
          </h2>
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{s.blurb}</p>
          <div className="mt-sm grid grid-cols-1 gap-sm md:grid-cols-2">
            {s.cards.map((c) => (
              <Card key={c.title} card={c} color={colorOf(s.floor)} />
            ))}
          </div>
        </section>
      ))}

      <Section id="build-files" title="Where things live" lede="The files to open when you want to change something.">
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {BUILD_FILES.map((f) => (
            <li key={f.where} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <span className="block break-all font-mono text-[13px] font-extrabold">{f.where}</span>
              <span className="block text-[14px] font-semibold text-ink-soft">{f.what}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
