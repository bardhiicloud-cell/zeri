/**
 * Illustrated skyline scenes for the Ballina national hero (day + night).
 * Pure SVG, generated deterministically at module load, so there is no image to download
 * and the artwork stays sharp on every screen. The six-star arc is a nod to the national flag.
 */

const W = 1600;
const H = 600;
const GROUND = H;

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mountain ridge as a closed path; sharp peaks come from |sin| mixing. */
function ridge(seed: number, base: number, amp: number, freq: number) {
  const r = rng(seed);
  const p1 = r() * 6;
  const p2 = r() * 6;
  const p3 = r() * 6;
  const pts: string[] = [];
  let minY = H;
  for (let x = 0; x <= W; x += 16) {
    const n =
      Math.abs(Math.sin(x * freq + p1)) * 0.55 +
      Math.abs(Math.sin(x * freq * 2.3 + p2)) * 0.3 +
      Math.sin(x * freq * 5.1 + p3) * 0.08;
    const y = base - amp * n;
    if (y < minY) minY = y;
    pts.push(`L${x} ${y.toFixed(1)}`);
  }
  return { d: `M0 ${H} ${pts.join(' ')} L${W} ${H} Z`, minY };
}

const FAR = ridge(11, 330, 190, 0.0042);
const MID = ridge(29, 400, 130, 0.0058);

interface Building { x: number; w: number; h: number; back: boolean }

function makeBuildings(): Building[] {
  const r = rng(7);
  const out: Building[] = [];
  for (const back of [true, false]) {
    let x = back ? -20 : -10;
    while (x < W) {
      const w = (back ? 46 : 34) + r() * (back ? 50 : 56);
      // Low and quiet behind the headline (left), rising toward the right where the skyline lives.
      const t = Math.min(1, Math.max(0, (x - 380) / 900));
      const base = back ? 70 : 40;
      const h = base + t * (back ? 150 : 170) + r() * (back ? 70 : 90) * (0.35 + t);
      out.push({ x, w, h, back });
      x += w + (back ? 4 : 2) + r() * 6;
    }
  }
  return out;
}
const BUILDINGS = makeBuildings();

/** Pre-computed window grid for front buildings. */
const WINDOWS = (() => {
  const r = rng(101);
  const out: { x: number; y: number; on: number }[] = [];
  BUILDINGS.forEach((b) => {
    if (b.back) return;
    for (let wy = GROUND - b.h + 14; wy < GROUND - 10; wy += 13) {
      for (let wx = b.x + 6; wx < b.x + b.w - 7; wx += 11) {
        out.push({ x: wx, y: wy, on: r() });
      }
    }
  });
  return out;
})();

const STARS = (() => {
  const r = rng(53);
  return Array.from({ length: 90 }, () => ({
    x: r() * W,
    y: r() * 300,
    r: 0.6 + r() * 1.5,
    o: 0.35 + r() * 0.65,
    d: r() * 5,
  }));
})();

/** Five-point star polygon points. */
function star(cx: number, cy: number, R: number, rot = -90) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = ((rot + i * 36) * Math.PI) / 180;
    const rr = i % 2 === 0 ? R : R * 0.42;
    pts.push(`${(cx + rr * Math.cos(rad)).toFixed(1)},${(cy + rr * Math.sin(rad)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** Six stars on an arc, as on the flag. */
const FLAG_STARS = Array.from({ length: 6 }, (_, i) => {
  const a = (-142 + i * 20.8) * (Math.PI / 180);
  return { cx: 1010 + 250 * Math.cos(a), cy: 330 + 250 * Math.sin(a) };
});

function Landmarks({ body, accent, win, rim, night }: { body: string; accent: string; win: string; rim: string; night: boolean }) {
  const maskId = `crescent-mask-${night ? 'night' : 'day'}`;
  return (
    // Enlarged and nudged left so the landmarks read beside the info chips, not behind them.
    <g transform={`translate(-380 ${-0.2 * GROUND}) scale(1.2)`}>
      {/* Stepped glass tower */}
      <g fill={body}>
        <rect x="1185" y={GROUND - 250} width="58" height="250" />
        <rect x="1196" y={GROUND - 292} width="36" height="44" />
        <rect x="1206" y={GROUND - 318} width="16" height="28" />
      </g>
      <rect x="1213" y={GROUND - 352} width="2" height="36" fill={accent} />
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x="1192" y={GROUND - 240 + i * 16} width="44" height="3" fill={win} opacity="0.55" />
      ))}
      {/* Needle tower with beacon */}
      <g fill={body}>
        <path d={`M1338 ${GROUND} L1344 ${GROUND - 300} L1352 ${GROUND - 300} L1358 ${GROUND} Z`} />
        <rect x="1333" y={GROUND - 190} width="30" height="10" />
        <rect x="1347" y={GROUND - 372} width="2" height="72" />
      </g>
      <circle cx="1348" cy={GROUND - 376} r="3.2" fill={accent} />
      {/* Ottoman-style mosque, drawn after the classic profile: a large central dome on a drum, flanked by two
          half domes and two small corner domes (the stepped, pyramid-like silhouette), with two pencil minarets
          (square base, round shaft, one balcony, conical cap). Dome and minarets end in the traditional alem:
          a short pole with a ball, topped by an upward-opening crescent. Same artwork day and night; the rim
          keeps it legible in the dark. Heights stay low enough to clear the hero headline and copy. */}
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="-10" y="-10" width="20" height="20">
          <circle cx="0" cy="0" r="6" fill="#fff" />
          <circle cx="0" cy="-2.6" r="5" fill="#000" />
        </mask>
      </defs>
      <g fill={body} stroke={rim} strokeWidth={rim === 'none' ? 0 : 1} strokeLinejoin="round">
        {/* prayer hall */}
        <rect x="940" y={GROUND - 66} width="200" height="66" />
        {/* corner domes */}
        <path d={`M940 ${GROUND - 66} A15 15 0 0 1 970 ${GROUND - 66} Z`} />
        <path d={`M1110 ${GROUND - 66} A15 15 0 0 1 1140 ${GROUND - 66} Z`} />
        {/* half domes */}
        <path d={`M968 ${GROUND - 66} A34 34 0 0 1 1036 ${GROUND - 66} Z`} />
        <path d={`M1044 ${GROUND - 66} A34 34 0 0 1 1112 ${GROUND - 66} Z`} />
        {/* drum and central dome */}
        <rect x="992" y={GROUND - 92} width="96" height="30" />
        <path d={`M990 ${GROUND - 92} A50 50 0 0 1 1090 ${GROUND - 92} Z`} />
        {/* alem of the dome: pole and ball */}
        <rect x="1039" y={GROUND - 156} width="2" height="16" />
        <circle cx="1040" cy={GROUND - 154} r="2.6" />
        {[922, 1158].map((mx) => (
          <g key={mx}>
            <rect x={mx - 8} y={GROUND - 36} width="16" height="36" />
            <rect x={mx - 4.5} y={GROUND - 170} width="9" height="136" />
            <rect x={mx - 9.5} y={GROUND - 156} width="19" height="5" rx="1" />
            <rect x={mx - 3.4} y={GROUND - 196} width="6.8" height="28" />
            <path d={`M${mx - 6} ${GROUND - 196} L${mx} ${GROUND - 232} L${mx + 6} ${GROUND - 196} Z`} />
            <rect x={mx - 0.8} y={GROUND - 242} width="1.6" height="12" />
            <circle cx={mx} cy={GROUND - 240} r="2" />
          </g>
        ))}
      </g>
      {/* Drum windows and arched prayer-hall windows */}
      <g fill={win} opacity={night ? 0.95 : 0.8}>
        {[1002, 1016, 1030, 1044, 1058, 1072].map((x) => (
          <path key={x} d={`M${x} ${GROUND - 66} v-12 a3 3 0 0 1 6 0 v12 Z`} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d={`M${954 + i * 21} ${GROUND - 8} v-20 a4.5 4.5 0 0 1 9 0 v20 Z`} />
        ))}
      </g>
      {/* Crescents sit on the poles of the dome and minarets, centred on their axes */}
      <g fill={accent}>
        <g transform={`translate(1040 ${GROUND - 166}) scale(1.1)`}>
          <circle cx="0" cy="0" r="6" mask={`url(#${maskId})`} />
        </g>
        {[922, 1158].map((mx) => (
          <g key={mx} transform={`translate(${mx} ${GROUND - 250}) scale(0.95)`}>
            <circle cx="0" cy="0" r="6" mask={`url(#${maskId})`} />
          </g>
        ))}
      </g>
    </g>
  );
}

function Skyline({ night }: { night: boolean }) {
  const back = night ? '#10264f' : '#7ea6dc';
  const front = night ? '#07122b' : '#2f5aa6';
  const landmark = night ? '#0f2a58' : '#264c92';
  const winOn = night ? ['#ffd98a', '#9be7ff'] : ['#ffffff', '#cfe6ff'];
  return (
    <g>
      <g fill={back}>
        {BUILDINGS.filter((b) => b.back).map((b, i) => (
          <rect key={i} x={b.x} y={GROUND - b.h} width={b.w} height={b.h} />
        ))}
      </g>
      <g fill={front}>
        {BUILDINGS.filter((b) => !b.back).map((b, i) => (
          <rect key={i} x={b.x} y={GROUND - b.h} width={b.w} height={b.h} />
        ))}
      </g>
      <Landmarks body={landmark} accent={night ? '#ffdf8a' : '#ffffff'} win={night ? '#ffd98a' : '#cfe6ff'} rim={night ? '#5b8fe0' : 'none'} night={night} />
      <g>
        {WINDOWS.map((w, i) => {
          const lit = night ? w.on > 0.62 : w.on > 0.78;
          if (!lit) return null;
          return (
            <rect
              key={i}
              x={w.x}
              y={w.y}
              width="5"
              height="7"
              rx="0.8"
              fill={winOn[w.on > 0.88 ? 1 : 0]}
              opacity={night ? 0.55 + w.on * 0.45 : 0.28 + w.on * 0.3}
            />
          );
        })}
      </g>
    </g>
  );
}

export function HeroScene({ variant }: { variant: 'day' | 'night' }) {
  const night = variant === 'night';
  const id = (s: string) => `hs-${variant}-${s}`;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          {night ? (
            <>
              <stop offset="0" stopColor="#020617" />
              <stop offset="0.5" stopColor="#0a1a3d" />
              <stop offset="0.82" stopColor="#173a7a" />
              <stop offset="1" stopColor="#2b5ea8" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#4f9bf0" />
              <stop offset="0.5" stopColor="#9cccf8" />
              <stop offset="0.85" stopColor="#dff0ff" />
              <stop offset="1" stopColor="#fff3d6" />
            </>
          )}
        </linearGradient>
        <radialGradient id={id('sun')} cx="0.5" cy="0.5" r="0.5">
          {night ? (
            <>
              <stop offset="0" stopColor="#f4f8ff" stopOpacity="0.55" />
              <stop offset="0.35" stopColor="#9cc4ff" stopOpacity="0.22" />
              <stop offset="1" stopColor="#9cc4ff" stopOpacity="0" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#fffbe8" stopOpacity="1" />
              <stop offset="0.3" stopColor="#ffe9a8" stopOpacity="0.65" />
              <stop offset="1" stopColor="#ffe9a8" stopOpacity="0" />
            </>
          )}
        </radialGradient>
        <linearGradient id={id('far')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? '#1a3b78' : '#8db6e8'} />
          <stop offset="1" stopColor={night ? '#0e2656' : '#c9e0f8'} />
        </linearGradient>
        <linearGradient id={id('mid')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? '#0f2a5c' : '#5f8fd0'} />
          <stop offset="1" stopColor={night ? '#081a3d' : '#a9c8ee'} />
        </linearGradient>
        <linearGradient id={id('haze')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? '#3b82f6' : '#fff1c9'} stopOpacity="0" />
          <stop offset="1" stopColor={night ? '#4aa3ff' : '#ffe2a1'} stopOpacity={night ? 0.5 : 0.7} />
        </linearGradient>
        <clipPath id={id('snow')}>
          <rect x="0" y="0" width={W} height={FAR.minY + 62} />
        </clipPath>
        <filter id={id('blur')} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      <rect width={W} height={H} fill={`url(#${id('sky')})`} />

      {night ? (
        <>
          <g fill="#ffffff">
            {STARS.map((s, i) => (
              <circle
                key={i}
                cx={s.x}
                cy={s.y}
                r={s.r}
                opacity={s.o}
                className="hero-twinkle"
                style={{ animationDelay: `${s.d}s` }}
              />
            ))}
          </g>
          {/* Milky glow band */}
          <ellipse cx="760" cy="120" rx="560" ry="60" fill="#5b8cff" opacity="0.08" transform="rotate(-12 760 120)" filter={`url(#${id('blur')})`} />
          {/* Moon */}
          <circle cx="1440" cy="130" r="170" fill={`url(#${id('sun')})`} />
          <circle cx="1440" cy="130" r="38" fill="#f6f9ff" />
          <circle cx="1428" cy="120" r="7" fill="#dfe8f7" opacity="0.8" />
          <circle cx="1452" cy="142" r="5" fill="#dfe8f7" opacity="0.7" />
          <circle cx="1446" cy="112" r="3.5" fill="#dfe8f7" opacity="0.6" />
        </>
      ) : (
        <>
          <circle cx="1400" cy="140" r="260" fill={`url(#${id('sun')})`} />
          <circle cx="1400" cy="140" r="46" fill="#fffdf2" />
          <g fill="#ffffff" filter={`url(#${id('blur')})`}>
            <ellipse cx="420" cy="120" rx="150" ry="20" opacity="0.8" />
            <ellipse cx="520" cy="104" rx="90" ry="20" opacity="0.7" />
            <ellipse cx="900" cy="190" rx="170" ry="18" opacity="0.65" />
            <ellipse cx="1180" cy="90" rx="120" ry="16" opacity="0.75" />
            <ellipse cx="1520" cy="250" rx="130" ry="15" opacity="0.6" />
          </g>
        </>
      )}

      {/* Six-star arc */}
      <g fill={night ? '#ffd76a' : '#ffffff'} opacity={night ? 0.9 : 0.85}>
        {FLAG_STARS.map((s, i) => (
          <polygon key={i} points={star(s.cx, s.cy, 9)} className={night ? 'hero-twinkle' : undefined} style={{ animationDelay: `${i * 0.45}s` }} />
        ))}
      </g>

      {/* Mountains */}
      <path d={FAR.d} fill={`url(#${id('far')})`} />
      <path d={FAR.d} fill={night ? '#dbe8ff' : '#ffffff'} opacity={night ? 0.5 : 0.95} clipPath={`url(#${id('snow')})`} />
      <path d={MID.d} fill={`url(#${id('mid')})`} />
      <rect x="0" y="330" width={W} height="270" fill={`url(#${id('haze')})`} />

      <Skyline night={night} />

      {/* Ground glow / river of light */}
      <rect x="0" y={H - 14} width={W} height="14" fill={night ? '#030a1c' : '#1d3f80'} />
      {night && <rect x="0" y={H - 22} width={W} height="8" fill="#4aa3ff" opacity="0.18" filter={`url(#${id('blur')})`} />}
    </svg>
  );
}
