import { useId, type ReactNode } from 'react';
import { BUMLING, RELATIONSHIP_BY_KEY, type Host } from '@kreators/shared';

export type Mood = 'happy' | 'excited' | 'neutral' | 'sleepy';

/**
 * The guides are friendly flat monsters (the 2026-11-03 look), drawn by the design rules: few, big shapes; a gradient body (light
 * from the top left, deeper to the bottom right), never a flat fill; one clear mark each; big eyes and an open, kind mouth. The seven
 * run the rainbow in pillar order, red for work and money through violet for faith. Bumling, the app's own guide, is a neutral grey
 * robot-ish one with a gold antenna, so it sits well on light and dark and never reads as one of the seven.
 */
interface Tones {
  light: string;
  base: string;
  deep: string;
}
const TONES: Record<Host, Tones> = {
  servant_leader: { light: '#FF8C8F', base: '#E8505B', deep: '#B4283A' },
  friendship: { light: '#FFBA78', base: '#F58B3C', deep: '#C45C17' },
  parent_child: { light: '#FFE58C', base: '#F6C945', deep: '#C8941A' },
  lover_partner: { light: '#94DDA3', base: '#4DB86B', deep: '#2B8247' },
  self: { light: '#94CCF6', base: '#3E9BE6', deep: '#1F67AE' },
  guru: { light: '#9AA2F2', base: '#5560D8', deep: '#333BA0' },
  divine: { light: '#CBA2F5', base: '#9356D8', deep: '#5D2A9E' },
  bumling: { light: '#D9DCE5', base: '#A2A8B8', deep: '#6B7287' },
};

const INK = '#23243A';
const MOUTH = '#3B1F3A';
const TONGUE = '#F47A8C';
const BLUSH = '#FF8FA3';
const GOLD = '#FDD835';

interface Face {
  /** Each eye as [x, y, radius]. */
  eyes: [number, number, number][];
  mouth: [number, number];
  /** Mouth size: 1 is the usual. */
  k: number;
  blush?: [number, number][];
  /** Where a crown sits once the character reaches its final stage. */
  top: [number, number];
  /** Floats instead of standing, so its shadow is smaller and lower. */
  floats?: boolean;
}

interface Drawn {
  face: Face;
  /** Behind the body: wings, ears, arms, horns, legs. */
  back: ReactNode;
  body: string;
  /** On the body, under the face: belly, marks. */
  front?: ReactNode;
  /** Over the face: a monocle, a third eye, a little one. */
  over?: ReactNode;
}

function Legs({ x, y, color, w = 9, h = 11 }: { x: [number, number]; y: number; color: string; w?: number; h?: number }) {
  return (
    <g fill={color}>
      {x.map((lx) => (
        <g key={lx}>
          <rect x={lx} y={y} width={w} height={h} rx={w / 2} />
          <ellipse cx={lx + w / 2} cy={y + h - 1} rx={w / 2 + 2.5} ry="3" />
        </g>
      ))}
    </g>
  );
}
function Arms({ d, color, hands, width = 7 }: { d: string[]; color: string; hands: [number, number][]; width?: number }) {
  return (
    <g>
      <g stroke={color} strokeWidth={width} strokeLinecap="round" fill="none">
        {d.map((p) => (
          <path key={p} d={p} />
        ))}
      </g>
      <g fill={color}>
        {hands.map(([hx, hy]) => (
          <circle key={`${hx}-${hy}`} cx={hx} cy={hy} r={width * 0.72} />
        ))}
      </g>
    </g>
  );
}
/** The same path, flipped left to right in the 100-wide box. */
const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${100 - Number(x)} ${y}`);

function draw(key: Host, t: Tones, fill: string): Drawn {
  switch (key) {
    // Ember, work and money: an egg with small horns and bat wings, ready to go.
    case 'servant_leader': {
      const wing = 'M26 50 C16 38 4 38 2 50 C8 50 10 56 8 60 C14 58 18 62 18 66 C22 62 26 60 28 58 Z';
      const horn = 'M35 24 L31 9 L43 20 Z';
      return {
        face: { eyes: [[40, 47, 8], [60, 47, 8]], mouth: [50, 66], k: 1, top: [50, 14], blush: [[30, 58], [70, 58]] },
        back: (
          <>
            <path d={wing} fill={t.deep} />
            <path d={mirror(wing)} fill={t.deep} />
            <path d={horn} fill={t.deep} />
            <path d={mirror(horn)} fill={t.deep} />
            <Legs x={[37, 54]} y={84} color={t.deep} />
          </>
        ),
        body: 'M50 16 C68 16 78 34 78 56 C78 76 66 90 50 90 C34 90 22 76 22 56 C22 34 32 16 50 16 Z',
        front: <ellipse cx="50" cy="78" rx="14" ry="8" fill={t.light} opacity="0.55" />,
      };
    }
    // Pip, friends: a gumdrop with curled horns, both arms up to wave hello.
    case 'friendship': {
      const horn = 'M31 27 C24 23 22 14 27 8 C28 15 33 19 39 21 Z';
      const arm = 'M24 58 C16 52 12 42 14 31';
      return {
        face: { eyes: [[39, 45, 8.5], [61, 45, 8.5]], mouth: [50, 63], k: 1, top: [50, 14], blush: [[29, 57], [71, 57]] },
        back: (
          <>
            <Arms d={[arm, mirror(arm)]} color={t.base} hands={[[14, 30], [86, 30]]} />
            <path d={horn} fill={t.deep} />
            <path d={mirror(horn)} fill={t.deep} />
            <Legs x={[33, 58]} y={86} color={t.deep} />
          </>
        ),
        body: 'M50 18 C68 18 80 30 80 50 L80 84 Q80 90 74 90 L26 90 Q20 90 20 84 L20 50 C20 30 32 18 50 18 Z',
        front: (
          <g stroke={t.light} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.6">
            <path d="M33 76 Q50 82 67 76" />
            <path d="M36 84 Q50 89 64 84" />
          </g>
        ),
      };
    }
    // Sunny, family: a bear-eared block with three eyes, one for each of a family, and a little one at its side.
    case 'parent_child':
      return {
        face: { eyes: [[47, 31, 6], [36, 44, 7], [58, 44, 7]], mouth: [47, 59], k: 0.95, top: [47, 14], blush: [[26, 54], [68, 54]] },
        back: (
          <>
            <circle cx="25" cy="24" r="10" fill={t.base} />
            <circle cx="25" cy="24" r="5" fill={t.light} />
            <circle cx="69" cy="24" r="10" fill={t.base} />
            <circle cx="69" cy="24" r="5" fill={t.light} />
            <path d="M16 54 C8 58 8 68 16 70 Z" fill={t.deep} />
            <Legs x={[27, 55]} y={86} color={t.deep} w={11} />
          </>
        ),
        body: 'M15 42 Q15 18 47 18 Q79 18 79 42 L79 84 Q79 90 73 90 L21 90 Q15 90 15 84 Z',
        front: <ellipse cx="47" cy="75" rx="18" ry="11" fill={t.light} opacity="0.55" />,
        over: (
          <g>
            <ellipse cx="89" cy="97" rx="8" ry="2" fill="#000" opacity="0.1" />
            <rect x="84" y="88" width="4.5" height="8" rx="2" fill={t.deep} />
            <rect x="90" y="88" width="4.5" height="8" rx="2" fill={t.deep} />
            <circle cx="89" cy="82" r="10" fill={fill} />
            <circle cx="85.5" cy="80" r="2.6" fill="#fff" />
            <circle cx="92.5" cy="80" r="2.6" fill="#fff" />
            <circle cx="85.8" cy="80.4" r="1.4" fill={INK} />
            <circle cx="92.8" cy="80.4" r="1.4" fill={INK} />
            <path d="M86.5 85 Q89 87.8 91.5 85 Z" fill={MOUTH} />
          </g>
        ),
      };
    // Clover, love: a round one with a clover sprout, arms open for a hug and a heart on its chest.
    case 'lover_partner': {
      const arm = 'M22 60 C14 58 8 52 7 45';
      return {
        face: { eyes: [[40, 46, 8], [60, 46, 8]], mouth: [50, 61], k: 1, top: [50, 6], blush: [[30, 57], [70, 57]] },
        back: (
          <>
            <path d="M50 19 L50 9" stroke={t.deep} strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="45" cy="8.5" r="4.8" fill={t.deep} />
            <circle cx="55" cy="8.5" r="4.8" fill={t.deep} />
            <circle cx="50" cy="3" r="4.8" fill={t.deep} />
            <Arms d={[arm, mirror(arm)]} color={t.base} hands={[[7, 44], [93, 44]]} />
            <Legs x={[36, 55]} y={84} color={t.deep} />
          </>
        ),
        body: 'M50 18 C70 18 84 34 84 54 C84 74 70 90 50 90 C30 90 16 74 16 54 C16 34 30 18 50 18 Z',
        front: <path d="M50 85 C43.5 80 40 77 40 73.5 C40 70.6 42.2 68.6 44.8 68.6 C47.2 68.6 48.8 70 50 71.8 C51.2 70 52.8 68.6 55.2 68.6 C57.8 68.6 60 70.6 60 73.5 C60 77 56.5 80 50 85 Z" fill={TONGUE} />,
      };
    }
    // Dew, yourself: two eyes up on its crown, looking around, and a dewdrop on its belly.
    case 'self':
      return {
        face: { eyes: [[37, 30, 8.5], [63, 30, 8.5]], mouth: [50, 55], k: 1.05, top: [50, 10], blush: [[30, 46], [70, 46]] },
        back: (
          <>
            <path d="M22 62 C14 64 12 72 18 74 Z" fill={t.deep} />
            <path d="M78 62 C86 64 88 72 82 74 Z" fill={t.deep} />
            <Legs x={[34, 57]} y={84} color={t.deep} />
          </>
        ),
        body: 'M22 86 L22 54 C22 42 26 36 30 33 C27 20 46 15 48 28 L52 28 C54 15 73 20 70 33 C74 36 78 42 78 54 L78 86 Q78 90 74 90 L26 90 Q22 90 22 86 Z',
        front: <path d="M50 66 C50 66 43 74 43 78 C43 82 46 85 50 85 C54 85 57 82 57 78 C57 74 50 66 50 66 Z" fill={t.light} opacity="0.6" />,
      };
    // Sage, teachers: a tall one-eyed thinker with small horns and a gold monocle.
    case 'guru': {
      const horn = 'M33 22 L29 9 L41 18 Z';
      const arm = 'M28 52 C20 56 18 66 20 73';
      return {
        face: { eyes: [[50, 40, 12]], mouth: [50, 64], k: 0.95, top: [50, 12], blush: [[35, 54], [65, 54]] },
        back: (
          <>
            <path d={horn} fill={t.deep} />
            <path d={mirror(horn)} fill={t.deep} />
            <Arms d={[arm, mirror(arm)]} color={t.base} hands={[[20, 74], [80, 74]]} />
            <Legs x={[35, 56]} y={86} color={t.deep} />
          </>
        ),
        body: 'M28 34 Q28 16 50 16 Q72 16 72 34 L72 84 Q72 90 66 90 L34 90 Q28 90 28 84 Z',
        front: <rect x="37" y="74" width="26" height="11" rx="5.5" fill={t.light} opacity="0.55" />,
        over: (
          <g>
            <circle cx="50" cy="40" r="15" fill="none" stroke={GOLD} strokeWidth="2.6" />
            <path d="M64 45 Q68 56 64 66" stroke={GOLD} strokeWidth="1.4" fill="none" />
          </g>
        ),
      };
    }
    // Lumen, faith: a floating one with a halo, a small gold third eye and its hands raised.
    case 'divine': {
      const arm = 'M25 58 C17 54 13 47 13 40';
      return {
        face: { eyes: [[40, 47, 8], [60, 47, 8]], mouth: [50, 64], k: 0.95, top: [50, 6], blush: [[30, 58], [70, 58]], floats: true },
        back: (
          <>
            <ellipse cx="50" cy="9" rx="13" ry="3.4" fill="none" stroke={GOLD} strokeWidth="2.8" />
            <Arms d={[arm, mirror(arm)]} color={t.base} hands={[[13, 39], [87, 39]]} />
          </>
        ),
        body: 'M24 54 C24 32 36 18 50 18 C64 18 76 32 76 54 L76 82 Q70 92 62 84 Q56 93 50 85 Q44 93 38 84 Q30 92 24 82 Z',
        over: <path d="M44 31 Q50 25 56 31 Q50 37 44 31 Z" fill={GOLD} />,
      };
    }
    // Bumling, the app's own guide: a round grey helper with a gold antenna and little bolt ears, a bit of a friendly robot.
    case 'bumling':
      return {
        face: { eyes: [[39, 54, 8.5], [61, 54, 8.5]], mouth: [50, 71], k: 0.95, top: [50, 2], blush: [[29, 65], [71, 65]] },
        back: (
          <>
            <path d="M50 24 L50 11" stroke={t.deep} strokeWidth="3" strokeLinecap="round" />
            <circle cx="50" cy="8" r="5.5" fill={GOLD} />
            <rect x="8" y="50" width="9" height="16" rx="4.5" fill={t.deep} />
            <rect x="83" y="50" width="9" height="16" rx="4.5" fill={t.deep} />
            <Legs x={[36, 55]} y={88} color={t.deep} />
          </>
        ),
        body: 'M50 22 C72 22 86 36 86 58 C86 80 72 94 50 94 C28 94 14 80 14 58 C14 36 28 22 50 22 Z',
        front: <rect x="38" y="80" width="24" height="7" rx="3.5" fill={t.light} opacity="0.6" />,
      };
  }
}

function Eye({ x, y, r, lid, mood }: { x: number; y: number; r: number; lid: string; mood: Mood }) {
  if (mood === 'sleepy') {
    return <path d={`M${x - r * 0.75} ${y} Q${x} ${y + r * 0.6} ${x + r * 0.75} ${y}`} stroke={INK} strokeWidth={Math.max(2.2, r * 0.32)} strokeLinecap="round" fill="none" />;
  }
  const p = r * (mood === 'excited' ? 0.6 : 0.5);
  return (
    <>
      <circle cx={x} cy={y} r={r} fill="#fff" />
      <circle cx={x + r * 0.1} cy={y + r * 0.12} r={p} fill={INK} />
      <circle cx={x + r * 0.3} cy={y - r * 0.15} r={Math.max(1, r * 0.2)} fill="#fff" />
      {mood === 'neutral' && <path d={`M${x - r - 0.5} ${y - r * 0.05} A${r + 0.5} ${r + 0.5} 0 0 1 ${x + r + 0.5} ${y - r * 0.05} Z`} fill={lid} />}
    </>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'excited':
      return (
        <>
          <path d="M-9 -2 Q0 -4 9 -2 Q9 13 0 14 Q-9 13 -9 -2 Z" fill={MOUTH} />
          <path d="M-6 9.6 Q0 4.6 6 9.6 Q3.6 13.4 0 13.6 Q-3.6 13.4 -6 9.6 Z" fill={TONGUE} />
          <path d="M-5.4 -2.7 L-3.6 1.4 L-1.8 -3 Z M1.8 -3 L3.6 1.4 L5.4 -2.7 Z" fill="#fff" />
        </>
      );
    case 'neutral':
      return <path d="M-6 0 Q0 2.6 6 0" stroke={MOUTH} strokeWidth="2.6" strokeLinecap="round" fill="none" />;
    case 'sleepy':
      return <ellipse cx="0" cy="1.5" rx="3" ry="2.4" fill={MOUTH} />;
    default:
      return (
        <>
          <path d="M-9 -1.5 Q0 -2.5 9 -1.5 Q8 10 0 10.5 Q-8 10 -9 -1.5 Z" fill={MOUTH} />
          <path d="M-5 6.8 Q0 3.4 5 6.8 Q2.8 10 0 10.2 Q-2.8 10 -5 6.8 Z" fill={TONGUE} />
          <path d="M-5 -1.8 L-3.4 1.8 L-1.8 -1.9 Z M1.8 -1.9 L3.4 1.8 L5 -1.8 Z" fill="#fff" />
        </>
      );
  }
}

function Sparkle({ x, y, s }: { x: number; y: number; s: number }) {
  const k = s * 0.3;
  return <path d={`M${x} ${y - s} L${x + k} ${y - k} L${x + s} ${y} L${x + k} ${y + k} L${x} ${y + s} L${x - k} ${y + k} L${x - s} ${y} L${x - k} ${y - k} Z`} fill="#fff" />;
}

interface Props {
  /** One of the seven, or Bumling. */
  relationship: Host;
  size?: number;
  mood?: Mood;
  /** Disable the idle bob, for dense lists. */
  still?: boolean;
  /** Hide from assistive tech when the character's name is already visible next to it. */
  decorative?: boolean;
  /** Evolution stage 1 to 4. Higher stages add an aura, sparkles, then a crown. */
  stage?: number;
  className?: string;
}

export function Avatar({ relationship, size = 64, mood = 'happy', still = false, decorative = false, stage = 1, className = '' }: Props) {
  // The guide's key is in the id, so two guides never share a gradient even if two React roots hand out the same useId.
  const gid = `av-${relationship}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const meta = relationship === 'bumling' ? BUMLING : RELATIONSHIP_BY_KEY[relationship];
  const tones = TONES[relationship];
  const fill = `url(#${gid})`;
  const drawn = draw(relationship, tones, fill);
  const [tx, ty] = drawn.face.top;

  return (
    <svg
      viewBox="0 0 100 104"
      width={size}
      height={size * 1.04}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `${meta.character}, ${meta.role}${stage > 1 ? `, stage ${stage}` : ''}`}
      className={`${still ? '' : 'avatar-bob'} shrink-0 overflow-visible ${className}`}
    >
      <defs>
        <linearGradient id={gid} x1="0.15" y1="0.05" x2="0.85" y2="1">
          <stop offset="0" stopColor={tones.light} />
          <stop offset="0.45" stopColor={tones.base} />
          <stop offset="1" stopColor={tones.deep} />
        </linearGradient>
      </defs>
      {stage >= 2 && <circle cx="50" cy="54" r="54" fill={tones.base} opacity="0.22" />}
      {drawn.face.floats ? <ellipse cx="50" cy="101" rx="18" ry="2.4" fill="#000" opacity="0.1" /> : <ellipse cx="50" cy="99" rx="28" ry="3" fill="#000" opacity="0.1" />}
      {drawn.back}
      <path d={drawn.body} fill={fill} />
      {drawn.front}
      {drawn.face.blush?.map(([bx, by]) => <ellipse key={`${bx}-${by}`} cx={bx} cy={by} rx="4.4" ry="2.8" fill={BLUSH} opacity="0.6" />)}
      <g className="avatar-eyes">
        {drawn.face.eyes.map(([ex, ey, er]) => (
          <Eye key={`${ex}-${ey}`} x={ex} y={ey} r={er} lid={tones.base} mood={mood} />
        ))}
      </g>
      <g transform={`translate(${drawn.face.mouth[0]} ${drawn.face.mouth[1]}) scale(${drawn.face.k})`}>
        <Mouth mood={mood} />
      </g>
      {drawn.over}
      {stage >= 3 && (
        <g>
          <Sparkle x={6} y={22} s={5} />
          <Sparkle x={94} y={34} s={4} />
          <Sparkle x={90} y={90} s={5} />
        </g>
      )}
      {stage >= 4 && (
        <path d="M-12 -2 L-6 -12 L0 -2 L6 -12 L12 -2 L10 4 L-10 4 Z" fill={GOLD} stroke={tones.deep} strokeWidth="1.5" strokeLinejoin="round" transform={`translate(${tx} ${ty - 6})`} />
      )}
    </svg>
  );
}
