import { isPixelPhoto } from '../lib/photo';

/**
 * Identity portraits: the player's own photo when they set one, otherwise a symmetric 5x5 pixel
 * glyph, like a mugshot on a surveillance file. Dead players get blood and a glitching signal.
 */
const COUNT = 24;
export const AVATARS = Array.from({ length: COUNT }, (_, i) => i);

function bits(index: number) {
  let a = (index + 1) * 0x9e3779b1;
  const rnd = () => {
    a ^= a << 13; a ^= a >>> 17; a ^= a << 5;
    return ((a >>> 0) % 1000) / 1000;
  };
  const cells: boolean[][] = [];
  for (let y = 0; y < 5; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < 3; x++) row.push(rnd() > 0.45);
    cells.push([row[0], row[1], row[2], row[1], row[0]]);
  }
  cells[1][1] = true; cells[1][3] = true;
  return cells;
}

const CACHE = new Map<number, boolean[][]>();

export function avatarHue(i: number) {
  return (i * 47) % 360;
}

/** Procedural blood splatter, stable per seed. */
export function BloodSplatter({ seed = 0, className = '', drips = true }: { seed?: number; className?: string; drips?: boolean }) {
  let a = (seed + 7) * 2654435761;
  const r = () => ((a = Math.imul(a ^ (a >>> 15), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909)), ((a >>> 0) % 1000) / 1000);
  const cx = 30 + r() * 40;
  const cy = 25 + r() * 35;
  const blobs = Array.from({ length: 9 }, () => ({ x: cx + (r() - 0.5) * 70, y: cy + (r() - 0.5) * 60, rr: 1.5 + r() * 6 }));
  const dripList = drips ? Array.from({ length: 3 }, () => ({ x: cx + (r() - 0.5) * 30, len: 14 + r() * 26, w: 1.5 + r() * 2.5 })) : [];
  return (
    <svg viewBox="0 0 100 100" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden>
      <g fill="#8a0a14" opacity="0.92">
        <circle cx={cx} cy={cy} r={13 + r() * 8} />
        {blobs.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r={b.rr} />)}
        {dripList.map((d, i) => <rect key={i} x={d.x} y={cy} width={d.w} height={d.len} rx={d.w / 2} />)}
      </g>
      <circle cx={cx - 3} cy={cy - 4} r={3} fill="#e0303f" opacity="0.5" />
    </svg>
  );
}

export function Avatar({
  index,
  size = 48,
  ring = true,
  dim,
  dead,
  photo,
  className = ''
}: {
  index: number;
  size?: number;
  ring?: boolean;
  dim?: boolean;
  dead?: boolean;
  photo?: string;
  className?: string;
}) {
  const i = ((index % COUNT) + COUNT) % COUNT;
  if (!CACHE.has(i)) CACHE.set(i, bits(i));
  const g = CACHE.get(i)!;
  const tone = i % 3 === 0 ? 'rgb(var(--c-fg))' : i % 3 === 1 ? 'rgb(var(--c-accent))' : 'rgb(var(--c-accent2))';
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ${dead ? 'avatar-dead' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        background: 'rgb(var(--c-bg))',
        border: ring ? `1px solid ${dead ? 'rgb(var(--c-danger) / 0.7)' : 'rgb(var(--c-line))'}` : undefined,
        boxShadow: ring ? 'inset 0 0 12px rgb(0 0 0 / 0.8)' : undefined,
        filter: dim && !dead ? 'grayscale(1) brightness(0.55)' : undefined
      }}
    >
      <div className="avatar-face flex h-full w-full items-center justify-center">
        {photo ? (
          <img src={photo} alt="" draggable={false} className="h-full w-full object-cover" style={{ imageRendering: isPixelPhoto(photo) ? 'pixelated' : 'auto' }} />
        ) : (
          <svg viewBox="0 0 7 7" width={size * 0.78} height={size * 0.78} shapeRendering="crispEdges">
            {g.map((row, y) => row.map((on, x) => (on ? <rect key={`${x}-${y}`} x={x + 1} y={y + 1} width={1} height={1} fill={tone} /> : null)))}
          </svg>
        )}
      </div>
      {dead && <BloodSplatter seed={index} />}
    </div>
  );
}
