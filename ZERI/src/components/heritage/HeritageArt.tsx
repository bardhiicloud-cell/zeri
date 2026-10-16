import { useId, useMemo } from 'react';

/**
 * Generated artwork for the archive. No photograph is shipped: a stock image of Kosovo
 * would carry a licence and a caption someone must clear, and an unlicensed one is exactly
 * what the brief forbids. These scenes are drawn in code, so they are always sharp, tiny
 * and rights-free. Real photographs enter through the CMS (hero image setting, entry media)
 * with credit, licence and a privacy check.
 */

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ridge(seed: number, w: number, h: number, base: number, amp: number, freq: number) {
  const r = rng(seed);
  const p = [r() * 6, r() * 6, r() * 6];
  let d = `M0 ${h}`;
  for (let x = 0; x <= w; x += 12) {
    const n = Math.abs(Math.sin(x * freq + p[0])) * 0.55 + Math.abs(Math.sin(x * freq * 2.3 + p[1])) * 0.3 + Math.sin(x * freq * 5.1 + p[2]) * 0.08;
    d += ` L${x} ${(base - amp * n).toFixed(1)}`;
  }
  return `${d} L${w} ${h} Z`;
}

/** Six stars in an arc, as on the national flag (one for each of the main communities). */
export function StarArc({ cx, cy, r, size, className }: { cx: number; cy: number; r: number; size: number; className?: string }) {
  const stars = Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI * (1.12 + (i / 5) * 0.76);
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
  const star = (x: number, y: number) => {
    const pts = Array.from({ length: 10 }, (_, k) => {
      const rad = k % 2 === 0 ? size : size * 0.42;
      const ang = -Math.PI / 2 + (k * Math.PI) / 5;
      return `${(x + Math.cos(ang) * rad).toFixed(1)},${(y + Math.sin(ang) * rad).toFixed(1)}`;
    });
    return pts.join(' ');
  };
  return (
    <g className={className} fill="currentColor">
      {stars.map((s, i) => <polygon key={i} className="hx-star" points={star(s.x, s.y)} />)}
    </g>
  );
}

/** The cinematic hero: dusk sky, a brass sun, four ridgelines drifting at different speeds, the star arc. */
export function HeroArt({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const layers = useMemo(() => [
    { d: ridge(11, 1600, 700, 430, 230, 0.0041), fill: `url(#${id}-r1)`, cls: 'l3' },
    { d: ridge(29, 1600, 700, 500, 180, 0.0055), fill: `url(#${id}-r2)`, cls: 'l2' },
    { d: ridge(47, 1600, 700, 570, 130, 0.0072), fill: `url(#${id}-r3)`, cls: '' },
    { d: ridge(83, 1600, 700, 650, 70, 0.011), fill: `url(#${id}-r4)`, cls: 'l2' },
  ], [id]);
  return (
    <svg className={className} viewBox="0 0 1600 700" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a1230" /><stop offset="0.55" stopColor="#1d2f6b" /><stop offset="0.82" stopColor="#7a5a3a" /><stop offset="1" stopColor="#d6a24a" />
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe3a0" stopOpacity="0.95" /><stop offset="0.45" stopColor="#f0b955" stopOpacity="0.4" /><stop offset="1" stopColor="#f0b955" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-r1`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b4f8f" /><stop offset="1" stopColor="#1b2a5e" /></linearGradient>
        <linearGradient id={`${id}-r2`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#273a78" /><stop offset="1" stopColor="#131f48" /></linearGradient>
        <linearGradient id={`${id}-r3`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#18285c" /><stop offset="1" stopColor="#0c1636" /></linearGradient>
        <linearGradient id={`${id}-r4`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d1737" /><stop offset="1" stopColor="#070d20" /></linearGradient>
      </defs>
      <rect width="1600" height="700" fill={`url(#${id}-sky)`} />
      <circle cx="1180" cy="430" r="260" fill={`url(#${id}-sun)`} />
      <circle cx="1180" cy="430" r="46" fill="#ffe7ae" opacity="0.92" />
      <g style={{ color: '#f0cf7e' }} opacity="0.9"><StarArc cx={1180} cy={430} r={190} size={11} /></g>
      {layers.map((l, i) => <path key={i} className={`hx-hero-layer ${l.cls}`} d={l.d} fill={l.fill} />)}
    </svg>
  );
}

/** A section plate: two ridgelines tinted by the section's hue. Deterministic per section. */
export function PlateArt({ hue, seed, className }: { hue: number; seed: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const a = useMemo(() => ridge(seed * 7 + 3, 480, 300, 190, 130, 0.0085), [seed]);
  const b = useMemo(() => ridge(seed * 13 + 5, 480, 300, 250, 90, 0.012), [seed]);
  return (
    <svg className={className} viewBox="0 0 480 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 45% 22%)`} /><stop offset="1" stopColor={`hsl(${(hue + 28) % 360} 60% 52%)`} />
        </linearGradient>
      </defs>
      <rect width="480" height="300" fill={`url(#${id}-bg)`} />
      <circle cx="360" cy="86" r="30" fill="#fff" opacity="0.2" />
      <path d={a} fill={`hsl(${hue} 40% 18%)`} opacity="0.7" />
      <path d={b} fill={`hsl(${hue} 45% 11%)`} />
    </svg>
  );
}
