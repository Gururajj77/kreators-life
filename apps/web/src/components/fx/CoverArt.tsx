import { MODULE_BY_KEY, MODULE_GROUP_ACCENT, RELATIONSHIP_BY_KEY, type RelationshipKey } from '@kreators/shared';
import { appIcon } from '../../lib/appIcons';
import { FlowerShape, PILLAR_FLOWER, flowerFor, type FlowerKind } from '../Hero';
import { LiquidRipple } from './LiquidRipple';

/** Screens that wear a cover but are not apps of their own (Rewards is part of the game, not an app). */
const EXTRA: Record<string, { icon: string; accent: RelationshipKey }> = Object.assign(Object.create(null) as Record<string, { icon: string; accent: RelationshipKey }>, {
  rewards: { icon: 'Gift', accent: 'parent_child' },
});

/**
 * An icon drawn further left than the rest, in drawing units (wave 21): Circles' two figures reach right to where its title starts on a
 * laptop (the column is 768px at 1280 and 1600 alike, so the title met the second figure at both), and 40 units leave about 34px between them.
 */
const ICON_NUDGE: Record<string, number> = Object.assign(Object.create(null) as Record<string, number>, { circles: -40 });

/** The pale wash under each pillar colour, so a cover is light in light mode and deep in dark mode. */
const TINT: Record<number, string> = { 1: 'red', 2: 'orange', 3: 'yellow', 4: 'green', 5: 'sky', 6: 'indigo', 7: 'purple' };

const W = 480;
const H = 240;

function seedOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * The cover behind an app's header: drawn here, so it never needs a download. Each app's own colour (its accent pillar), a second pillar
 * colour picked from its key, its icon drawn large and soft, and one flower, so every app has a cover of its own. Decorative only.
 * A real picture for an app could replace the drawing later (a cover image URL per app, not built): it would go inside the same
 * LiquidRipple as an <image>, so it ripples the same way.
 */
export function CoverArt({ cover }: { cover: string }) {
  const mod = MODULE_BY_KEY[cover];
  const extra = Object.hasOwn(EXTRA, cover) ? EXTRA[cover] : undefined;
  const accent: RelationshipKey = extra?.accent ?? mod?.accent ?? (mod ? MODULE_GROUP_ACCENT[mod.group] : 'self');
  const icon = extra?.icon ?? mod?.icon ?? 'Sparkles';
  const n = RELATIONSHIP_BY_KEY[accent].floor;
  const h = seedOf(cover);
  // The second colour is another pillar's, never the same one, chosen by the key so it stays put between visits.
  const m = ((n - 1 + 1 + (h % 6)) % 7) + 1;
  const main = `var(--color-r${n})`;
  const second = `var(--color-r${m})`;
  const tint = `var(--tint-${TINT[n] ?? 'sky'})`;
  // An app with an accent wears that pillar's flower; one without picks one from its key.
  const flower: FlowerKind = mod?.accent ? PILLAR_FLOWER[mod.accent] : flowerFor(cover);
  const Ico = appIcon(icon);
  const g = `cover-${cover.replace(/[^a-z0-9]/gi, '')}`;
  const tilt = (h % 2 === 0 ? 1 : -1) * (6 + (h % 7));
  return (
    <LiquidRipple width={W} height={H} className="block h-full w-full">
      <defs>
        <radialGradient id={`${g}-a`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" style={{ stopColor: main, stopOpacity: 0.34 }} />
          <stop offset="1" style={{ stopColor: main, stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id={`${g}-b`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" style={{ stopColor: second, stopOpacity: 0.3 }} />
          <stop offset="1" style={{ stopColor: second, stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <rect width={W} height={H} style={{ fill: tint }} />
      <circle cx={W * 0.8} cy={H * 0.25} r={190} fill={`url(#${g}-a)`} />
      <circle cx={W * 0.42} cy={H * 0.95} r={170} fill={`url(#${g}-b)`} />
      {/* Water: three soft bands across the foot, like the ripple's own surface. */}
      <g style={{ fill: main }}>
        <path d={`M0 ${H * 0.72} C ${W * 0.2} ${H * 0.62} ${W * 0.35} ${H * 0.84} ${W * 0.55} ${H * 0.74} S ${W * 0.85} ${H * 0.6} ${W} ${H * 0.7} V ${H} H 0 Z`} opacity="0.08" />
        <path d={`M0 ${H * 0.84} C ${W * 0.25} ${H * 0.76} ${W * 0.4} ${H * 0.94} ${W * 0.62} ${H * 0.84} S ${W * 0.9} ${H * 0.76} ${W} ${H * 0.82} V ${H} H 0 Z`} opacity="0.09" />
      </g>
      <g fill="none" style={{ stroke: main }} strokeWidth="1.6" strokeLinecap="round" opacity="0.28">
        <path d={`M${W * 0.18} ${H * 0.5} C ${W * 0.35} ${H * 0.42} ${W * 0.5} ${H * 0.58} ${W * 0.68} ${H * 0.5} S ${W * 0.92} ${H * 0.42} ${W} ${H * 0.48}`} />
        <path d={`M${W * 0.3} ${H * 0.6} C ${W * 0.45} ${H * 0.54} ${W * 0.6} ${H * 0.68} ${W * 0.78} ${H * 0.6} S ${W * 0.95} ${H * 0.55} ${W} ${H * 0.58}`} />
      </g>
      {/* The pillar's flower, whole (no petal cut, like the hero's Posy) and faint, high in the right corner, above the helper line. */}
      <g transform={`translate(${W * 0.86} ${H * 0.32}) rotate(${tilt}) scale(0.62)`} style={{ fill: second, color: second }} opacity="0.14">
        <FlowerShape kind={flower} />
      </g>
      {/* The app's own icon, large and soft, left of the flower so the title at the right never sits on its lines. */}
      <g style={{ color: main }} opacity="0.26">
        <Ico x={W * 0.44 + (Object.hasOwn(ICON_NUDGE, cover) ? (ICON_NUDGE[cover] ?? 0) : 0)} y={H * 0.06} width={120} height={120} strokeWidth={1.1} />
      </g>
    </LiquidRipple>
  );
}
