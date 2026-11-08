import type { ReactNode } from 'react';
import type { DashCard, DashChange, DashChart, LifeDashboard } from '@kreators/shared/lifeDashboard';
import { LIFE_AREAS, RELATIONSHIP_BY_KEY } from '@kreators/shared';
import { evenGrid, evenTile } from '../lib/bento';
import { fillVar } from '../lib/relFill';
import { AppIcon } from './AppIcon';
import { AreaLine, PillBars, StatTile } from './Charts';
import { PILLAR_FLOWER, Posy } from './Hero';
import { Ring } from './Ring';
import { StatusTag } from './StatusTag';

/**
 * "Your life, this week" (2026-11-07): the period's numbers from GET /insights/dashboard, first the five areas of life, then the seven
 * pillars. Each tile is one link to where that data lives: its name, the number big, the change against the period before, then a small
 * chart at its foot. The server sends only the parts whose app is on, and every word; this draws them.
 */
/** By the room the column has, not the screen, so a tablet beside the sidebar keeps a tile wide enough for its number. */
const TILE_COLS = { base: 2, '@lg': 3, '@3xl': 4 } as const;

/** The number keeps one line in a narrow tile, so long money steps down a size. */
const valueSize = (v: string) => (v.length > 12 ? 'text-headline' : v.length > 9 ? 'text-title3' : v.length > 7 ? 'text-title2' : '');

function ChangeTag({ change }: { change: DashChange }) {
  return <StatusTag tone={change.tone}>{change.word}</StatusTag>;
}

function SmallChart({ chart, color }: { chart: DashChart; color: string }) {
  if (chart.shape === 'ring') return <Ring value={chart.values[0] ?? 0} size={48} stroke={6} color={color} track="color-mix(in oklab, var(--color-ink) 14%, transparent)" label={chart.label} />;
  // Bars only when each point has room: a zero is left as the plain stub, never a filled sliver.
  // Held to a small chart's width in a wide tile, so a pill stays a pill and never a blob.
  if (chart.shape === 'bars')
    return (
      <div className="max-w-[240px]">
        <PillBars values={chart.values.map((v) => (v === 0 ? null : v))} max={chart.max} labels={chart.labels.length ? chart.labels : chart.values.map(() => '')} allLabels={chart.labels.length > 0} color={color} label={chart.label} height={48} />
      </div>
    );
  return <AreaLine values={chart.values} max={chart.max} color={color} label={chart.label} height={48} thick={2} axes={false} empty="" />;
}

function Tile({ card, color, tone, flower, className }: { card: DashCard; color: string; tone?: string; flower?: ReactNode; className: string }) {
  return (
    <li className={`flex min-w-0 ${className}`}>
      {/* A column, so the charts in a row line up at the foot however many lines the words above them take. */}
      <StatTile to={card.to} label={card.label} tone={tone} value={<span className={valueSize(card.value)}>{card.value}</span>} className="relative !flex w-full flex-col overflow-hidden">
        {flower}
        {card.note && (
          // Each part up to a comma kept whole, so a narrow tile breaks the line there and never leaves a short one (the rectangle rule).
          <span className="mt-xs block text-caption text-ink-soft">
            {card.note.split(', ').map((part, i, all) => (
              // Fixed words from the server, never reordered; by place, since two parts of a money line can read the same.
              <span key={i}>
                {i > 0 && ' '}
                <span className="inline-block">{i < all.length - 1 ? `${part},` : part}</span>
              </span>
            ))}
          </span>
        )}
        {card.change && (
          <span className="mt-xs flex">
            <ChangeTag change={card.change} />
          </span>
        )}
        {card.chart && (
          <div className="mt-auto w-full pt-sm">
            <SmallChart chart={card.chart} color={color} />
          </div>
        )}
      </StatTile>
    </li>
  );
}

export function LifeDashboardBlock({ data }: { data: LifeDashboard }) {
  return (
    <div className="@container">
      {data.areas.map((a) => {
        const meta = LIFE_AREAS[a.key];
        const rel = RELATIONSHIP_BY_KEY[meta.relationship];
        return (
          <div key={a.key} className="mt-md first:mt-0" data-pillar={rel.key}>
            <h3 className="m-0 flex items-center gap-xs text-headline">
              <AppIcon name={meta.icon} size={20} />
              {meta.name}
            </h3>
            <ul className={`mt-xs m-0 grid list-none gap-sm p-0 ${evenGrid(a.cards.length, TILE_COLS)}`}>
              {a.cards.map((card, i) => (
                <Tile key={card.key} card={card} color={fillVar(rel)} className={evenTile(i, a.cards.length, TILE_COLS)} />
              ))}
            </ul>
            {a.note && <p className="mt-xs m-0 text-caption text-ink-soft">{a.note}</p>}
          </div>
        );
      })}
      <div className="mt-md">
        <h3 className="m-0 text-headline">The seven pillars</h3>
        <ul className={`mt-xs m-0 grid list-none gap-sm p-0 ${evenGrid(data.pillars.length, TILE_COLS)}`}>
          {data.pillars.map((p, i) => {
            const rel = RELATIONSHIP_BY_KEY[p.relationship];
            return (
              <Tile
                key={p.key}
                card={p}
                color={fillVar(rel)}
                tone={`var(--soft-${p.relationship})`}
                flower={<Posy kind={PILLAR_FLOWER[p.relationship]} tone="ink" opacity={0.1} className="top-0 right-0 !w-[112px]" />}
                className={evenTile(i, data.pillars.length, TILE_COLS)}
              />
            );
          })}
        </ul>
      </div>
    </div>
  );
}
