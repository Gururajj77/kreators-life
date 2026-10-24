import { RELATIONSHIP_BY_KEY, type RelationshipKey } from '@kreators/shared';

export type Mood = 'happy' | 'excited' | 'neutral' | 'sleepy';

interface Shape {
  body: string;
  eyes: [[number, number], [number, number]];
  eyeR: number;
  mouth: [number, number];
  /** Where a crown sits once the character reaches its final stage: [x, y of the body's top]. */
  top: [number, number];
}

// Every character is a different silhouette drawn in a 100 x 100 box.
const SHAPES: Record<RelationshipKey, Shape> = {
  // Ember: a shield.
  servant_leader: {
    body: 'M50 6 C62 12 76 16 90 18 L90 52 C90 76 70 90 50 96 C30 90 10 76 10 52 L10 18 C24 16 38 12 50 6 Z',
    eyes: [[38, 46], [62, 46]],
    eyeR: 6,
    mouth: [50, 64],
    top: [50, 6],
  },
  // Pip: two lobes, one creature.
  friendship: {
    body: 'M30 28 C16 28 8 40 8 54 C8 70 20 82 34 82 C40 82 46 79 50 74 C54 79 60 82 66 82 C80 82 92 70 92 54 C92 40 84 28 70 28 C62 28 55 32 50 38 C45 32 38 28 30 28 Z',
    eyes: [[30, 52], [70, 52]],
    eyeR: 6,
    mouth: [50, 64],
    top: [50, 28],
  },
  // Sunny: a big round one carrying a little one.
  parent_child: {
    body: 'M46 22 C66 22 82 38 82 58 C82 78 66 94 46 94 C26 94 10 78 10 58 C10 38 26 22 46 22 Z',
    eyes: [[34, 54], [58, 54]],
    eyeR: 6,
    mouth: [46, 70],
    top: [40, 24],
  },
  // Clover: a soft heart.
  lover_partner: {
    body: 'M50 92 C30 76 10 60 10 40 C10 26 20 16 32 16 C40 16 46 20 50 28 C54 20 60 16 68 16 C80 16 90 26 90 40 C90 60 70 76 50 92 Z',
    eyes: [[38, 44], [62, 44]],
    eyeR: 6,
    mouth: [50, 60],
    top: [50, 18],
  },
  // Dew: a single drop.
  self: {
    body: 'M50 6 C50 6 14 44 14 64 C14 84 30 96 50 96 C70 96 86 84 86 64 C86 44 50 6 50 6 Z',
    eyes: [[38, 64], [62, 64]],
    eyeR: 6,
    mouth: [50, 80],
    top: [50, 6],
  },
  // Sage: an owl with ear tufts and a beak.
  guru: {
    body: 'M22 36 L14 10 L38 24 C42 22 46 21 50 21 C54 21 58 22 62 24 L86 10 L78 36 C84 44 88 54 88 64 C88 84 70 96 50 96 C30 96 12 84 12 64 C12 54 16 44 22 36 Z',
    eyes: [[38, 56], [62, 56]],
    eyeR: 8,
    mouth: [50, 78],
    top: [50, 12],
  },
  // Lumen: a flame with a halo.
  divine: {
    body: 'M50 12 C58 26 76 38 76 62 C76 82 64 96 50 96 C36 96 24 82 24 62 C24 50 30 42 36 34 C38 44 44 48 47 44 C44 34 46 22 50 12 Z',
    eyes: [[40, 66], [60, 66]],
    eyeR: 6,
    mouth: [50, 82],
    top: [50, 0],
  },
};

const INK = '#4F3422';
const GOLD = '#FDE047';

function Sparkle({ x, y, s }: { x: number; y: number; s: number }) {
  const k = s * 0.3;
  return <path d={`M${x} ${y - s} L${x + k} ${y - k} L${x + s} ${y} L${x + k} ${y + k} L${x} ${y + s} L${x - k} ${y + k} L${x - s} ${y} L${x - k} ${y - k} Z`} fill="#fff" />;
}

function Mouth({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'excited':
      return <path d="M-9 0 Q0 13 9 0 Z" fill={INK} />;
    case 'neutral':
      return <path d="M-7 0 L7 0" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />;
    case 'sleepy':
      return <path d="M-5 0 Q0 4 5 0" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />;
    default:
      return <path d="M-9 0 Q0 9 9 0" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />;
  }
}

function Eye({ x, y, r, mood }: { x: number; y: number; r: number; mood: Mood }) {
  if (mood === 'sleepy') {
    return <path d={`M${x - 5} ${y} Q${x} ${y + 4} ${x + 5} ${y}`} stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />;
  }
  const pupil = r * 0.5 * (mood === 'excited' ? 1.3 : 1);
  return (
    <>
      <ellipse cx={x} cy={y} rx={r} ry={r * 1.15} fill="#fff" />
      <circle cx={x + 1.5} cy={y + 1} r={pupil} fill={INK} />
      <circle cx={x + 3} cy={y - 1.5} r={1.4} fill="#fff" />
    </>
  );
}

interface Props {
  relationship: RelationshipKey;
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
  const r = RELATIONSHIP_BY_KEY[relationship];
  const s = SHAPES[relationship];
  const [[x1, y1], [x2, y2]] = s.eyes;
  const [mx, my] = s.mouth;
  const [tx, ty] = s.top;

  return (
    <svg
      viewBox="0 0 100 104"
      width={size}
      height={size * 1.04}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `${r.character}, the ${r.name.toLowerCase()} character${stage > 1 ? `, stage ${stage}` : ''}`}
      className={`${still ? '' : 'avatar-bob'} shrink-0 overflow-visible ${className}`}
    >
      {stage >= 2 && <circle cx="50" cy="54" r="54" fill={r.color} opacity="0.22" />}
      {relationship === 'divine' && <ellipse cx="50" cy="7" rx="16" ry="4" fill="none" stroke="#FDE047" strokeWidth="3" />}
      <path d={s.body} fill={r.deep} transform="translate(0 5)" />
      <path d={s.body} fill={r.color} />
      <ellipse cx={x1 - 6} cy={y1 - 18} rx="8" ry="4.5" fill="#fff" opacity="0.32" transform={`rotate(-20 ${x1 - 6} ${y1 - 18})`} />

      {relationship === 'parent_child' && (
        <g>
          <circle cx="78" cy="31" r="13" fill={r.deep} />
          <circle cx="78" cy="27" r="13" fill={r.color} />
          <circle cx="74" cy="26" r="2.2" fill={INK} />
          <circle cx="82" cy="26" r="2.2" fill={INK} />
          <path d="M74 31 Q78 34 82 31" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
      )}
      {relationship === 'guru' && <path d="M46 65 L54 65 L50 71 Z" fill={r.deep} />}

      <g className="avatar-eyes">
        <Eye x={x1} y={y1} r={s.eyeR} mood={mood} />
        <Eye x={x2} y={y2} r={s.eyeR} mood={mood} />
      </g>
      <circle cx={x1 - 5} cy={y1 + 11} r="4.5" fill="#fff" opacity="0.35" />
      <circle cx={x2 + 5} cy={y2 + 11} r="4.5" fill="#fff" opacity="0.35" />
      <g transform={`translate(${mx} ${my})`}>
        <Mouth mood={mood} />
      </g>
      {stage >= 3 && (
        <g>
          <Sparkle x={6} y={22} s={5} />
          <Sparkle x={94} y={34} s={4} />
          <Sparkle x={90} y={90} s={5} />
        </g>
      )}
      {stage >= 4 && (
        <path
          d="M-12 -2 L-6 -12 L0 -2 L6 -12 L12 -2 L10 4 L-10 4 Z"
          fill={GOLD}
          stroke={r.deep}
          strokeWidth="1.5"
          strokeLinejoin="round"
          transform={`translate(${tx} ${ty - 6})`}
        />
      )}
    </svg>
  );
}
