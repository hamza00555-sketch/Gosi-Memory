/**
 * Generates the beach-day card FACE artwork as SVGs.
 *
 * Tracking quality drives the design (MindAR matches feature points): every
 * face gets a dense, unique decoration field (deterministic pseudo-random
 * shapes), a bold central subject, distinct palette, and a big label — flat
 * minimal art would track poorly (Holoform lesson).
 *
 * Run: node scripts/generate-faces.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../public/sets/beach-day/faces');
const SIZE = 300;

/** Deterministic PRNG so faces are stable across regenerations. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Dense unique decoration field: dots, rings, crosses, triangles. */
function decorations(seed, colors, count = 46) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const x = 12 + r() * (SIZE - 24);
    const y = 12 + r() * (SIZE - 24);
    // Keep the center clear for the subject.
    const dx = x - SIZE / 2;
    const dy = y - SIZE / 2;
    if (Math.sqrt(dx * dx + dy * dy) < 92) continue;
    const c = colors[Math.floor(r() * colors.length)];
    const kind = Math.floor(r() * 4);
    const s = 2.5 + r() * 5;
    const o = (0.35 + r() * 0.45).toFixed(2);
    if (kind === 0) out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.toFixed(1)}" fill="${c}" opacity="${o}"/>`);
    else if (kind === 1) out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.toFixed(1)}" fill="none" stroke="${c}" stroke-width="2" opacity="${o}"/>`);
    else if (kind === 2) out.push(`<path d="M${(x - s).toFixed(1)} ${y.toFixed(1)}h${(2 * s).toFixed(1)}M${x.toFixed(1)} ${(y - s).toFixed(1)}v${(2 * s).toFixed(1)}" stroke="${c}" stroke-width="2.2" opacity="${o}"/>`);
    else out.push(`<path d="M${x.toFixed(1)} ${(y - s).toFixed(1)}l${s.toFixed(1)} ${(s * 1.7).toFixed(1)}h-${(2 * s).toFixed(1)}z" fill="${c}" opacity="${o}"/>`);
  }
  return out.join('\n    ');
}

function waves(y, color, amp = 5, opacity = 0.5) {
  let d = `M0 ${y}`;
  for (let x = 0; x <= SIZE; x += 25) d += ` q12.5 ${-amp * 2} 25 0`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="3" opacity="${opacity}"/>`;
}

function frame(color) {
  return `
    <rect x="6" y="6" width="288" height="288" rx="18" fill="none" stroke="${color}" stroke-width="4"/>
    <rect x="13" y="13" width="274" height="274" rx="12" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.5" stroke-dasharray="7 5"/>`;
}

function label(ar, en, color) {
  return `
    <g text-anchor="middle" font-family="sans-serif">
      <text x="150" y="272" font-size="21" font-weight="bold" fill="${color}">${ar}</text>
      <text x="150" y="288" font-size="10" letter-spacing="3" fill="${color}" opacity="0.75">${en}</text>
    </g>`;
}

function face({ name, bg, sky, frameC, deco, seed, subject, ar, en }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${sky}"/><stop offset="1" stop-color="${bg}"/>
    </linearGradient>
  </defs>
  <rect width="300" height="300" fill="url(#bg)"/>
  <g>
    ${waves(52, frameC, 4, 0.35)}
    ${waves(248, frameC, 4, 0.35)}
    ${decorations(seed, deco)}
  </g>
  <g transform="translate(150 150)">
${subject}
  </g>
  ${frame(frameC)}
  ${label(ar, en, frameC)}
  <!-- ${name} -->
</svg>\n`;
}

const FACES = {
  crab: face({
    name: 'crab', ar: 'سلطعون', en: 'CRAB', seed: 101,
    sky: '#ffe9d6', bg: '#ffc9a3', frameC: '#b3402a', deco: ['#b3402a', '#e8542f', '#7a2a18', '#f2a13a'],
    subject: `
    <ellipse cx="0" cy="8" rx="52" ry="38" fill="#e8542f" stroke="#b3402a" stroke-width="4"/>
    <path d="M-20 -8 q-4 18 0 30 M0 -12 q-3 22 0 36 M20 -8 q4 18 0 30" stroke="#b3402a" stroke-width="3.5" fill="none"/>
    <circle cx="-18" cy="-28" r="11" fill="#fff" stroke="#b3402a" stroke-width="3.5"/>
    <circle cx="18" cy="-28" r="11" fill="#fff" stroke="#b3402a" stroke-width="3.5"/>
    <circle cx="-16" cy="-27" r="4.5" fill="#1a1a1a"/><circle cx="20" cy="-27" r="4.5" fill="#1a1a1a"/>
    <path d="M-14 -40 l-4 8 M14 -40 l4 8" stroke="#b3402a" stroke-width="3.5"/>
    <path d="M-52 0 q-22 -8 -26 -28 l10 6 -2 -14 8 10 q8 12 10 26z" fill="#c23c1d" stroke="#7a2a18" stroke-width="3"/>
    <path d="M52 0 q22 -8 26 -28 l-10 6 2 -14 -8 10 q-8 12 -10 26z" fill="#c23c1d" stroke="#7a2a18" stroke-width="3"/>
    <path d="M-46 26 l-20 14 M-38 34 l-16 20 M38 34 l16 20 M46 26 l20 14" stroke="#7a2a18" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M-16 24 q16 12 32 0" stroke="#7a2a18" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
  }),
  palm: face({
    name: 'palm', ar: 'نخلة', en: 'PALM', seed: 202,
    sky: '#d6f2ff', bg: '#ffe3ad', frameC: '#1f7a4d', deco: ['#1f7a4d', '#2fa757', '#8a5a2b', '#2f9fd8'],
    subject: `
    <ellipse cx="0" cy="62" rx="70" ry="16" fill="#e7cf9b" stroke="#c9a86a" stroke-width="3"/>
    <path d="M-6 62 q-8 -60 8 -104" stroke="#8a5a2b" stroke-width="13" fill="none" stroke-linecap="round"/>
    <path d="M-6 62 q-8 -60 8 -104" stroke="#6b4423" stroke-width="4" fill="none" stroke-dasharray="4 9"/>
    <g stroke="#1f7a4d" stroke-width="4" fill="#2fa757">
      <path d="M2 -42 q-42 -22 -66 4 q30 16 66 -4z"/>
      <path d="M2 -42 q42 -22 66 4 q-30 16 -66 -4z"/>
      <path d="M2 -42 q-34 -34 -20 -58 q22 18 20 58z"/>
      <path d="M2 -42 q34 -34 20 -58 q-22 18 -20 58z"/>
      <path d="M2 -42 q0 -44 26 -52 q6 26 -26 52z"/>
    </g>
    <circle cx="-12" cy="-36" r="8" fill="#6b4423" stroke="#4a2f16" stroke-width="2.5"/>
    <circle cx="8" cy="-30" r="8" fill="#6b4423" stroke="#4a2f16" stroke-width="2.5"/>
    <path d="M-52 70 q10 -6 20 0 M20 72 q10 -6 20 0" stroke="#c9a86a" stroke-width="3" fill="none"/>`,
  }),
  ball: face({
    name: 'ball', ar: 'كرة شاطئ', en: 'BEACH BALL', seed: 303,
    sky: '#e8f7ff', bg: '#bfe6f7', frameC: '#1d6fb8', deco: ['#e8433b', '#1d6fb8', '#ffd23f', '#2fa757'],
    subject: `
    <circle cx="0" cy="0" r="62" fill="#fff" stroke="#1d6fb8" stroke-width="4"/>
    <path d="M0 -62 q-46 30 0 124 q-14 -62 0 -124z" fill="#e8433b"/>
    <path d="M0 -62 q46 30 0 124 q14 -62 0 -124z" fill="#2f7fe8"/>
    <path d="M0 -62 q-60 14 -58 66 q28 -10 58 -66 q-14 62 0 124 q-40 -34 -58 -58z" fill="#ffd23f" opacity="0.9"/>
    <path d="M0 -62 q60 14 58 66 q-28 -10 -58 -66 q14 62 0 124 q40 -34 58 -58z" fill="#2fa757" opacity="0.9"/>
    <circle cx="0" cy="0" r="62" fill="none" stroke="#1d6fb8" stroke-width="4"/>
    <ellipse cx="-20" cy="-24" rx="14" ry="8" fill="#fff" opacity="0.65" transform="rotate(-30 -20 -24)"/>
    <ellipse cx="0" cy="74" rx="46" ry="9" fill="#1d6fb8" opacity="0.2"/>`,
  }),
  boat: face({
    name: 'boat', ar: 'مركب شراعي', en: 'SAILBOAT', seed: 404,
    sky: '#dff3ff', bg: '#9fd4ef', frameC: '#154f78', deco: ['#154f78', '#e8433b', '#f7f3e8', '#2f9fd8'],
    subject: `
    <path d="M-58 34 h116 l-18 26 h-80 z" fill="#c9622f" stroke="#8a3f1d" stroke-width="4"/>
    <path d="M-58 34 h116" stroke="#e7cf9b" stroke-width="5"/>
    <path d="M0 30 v-96" stroke="#5a3a1e" stroke-width="5"/>
    <path d="M6 -66 l52 60 h-52 z" fill="#f7f3e8" stroke="#c9b8a0" stroke-width="3"/>
    <path d="M-6 -58 l-44 52 h44 z" fill="#e8433b" stroke="#a32c26" stroke-width="3"/>
    <path d="M0 -66 l22 7 -22 7 z" fill="#e8433b"/>
    <circle cx="-30" cy="44" r="4" fill="#e7cf9b"/><circle cx="0" cy="44" r="4" fill="#e7cf9b"/><circle cx="30" cy="44" r="4" fill="#e7cf9b"/>
    <path d="M-70 66 q14 -9 28 0 q14 9 28 0 q14 -9 28 0 q14 9 28 0" stroke="#2f9fd8" stroke-width="4" fill="none"/>
    <path d="M-56 78 q14 -8 28 0 q14 8 28 0 q14 -8 28 0" stroke="#2f9fd8" stroke-width="3.5" fill="none" opacity="0.7"/>`,
  }),
  sun: face({
    name: 'sun', ar: 'شمس', en: 'SUN', seed: 505,
    sky: '#fff3d0', bg: '#ffd98f', frameC: '#c77d1f', deco: ['#c77d1f', '#e8542f', '#ffb03a', '#e8433b'],
    subject: `
    <g stroke="#f2a13a" stroke-width="7" stroke-linecap="round">
      <path d="M0 -58 v-26 M0 58 v26 M-58 0 h-26 M58 0 h26"/>
      <path d="M-41 -41 l-18 -18 M41 -41 l18 -18 M-41 41 l-18 18 M41 41 l18 18"/>
    </g>
    <g stroke="#ffb03a" stroke-width="4.5" stroke-linecap="round" opacity="0.85">
      <path d="M-22 -55 l-8 -20 M22 -55 l8 -20 M-55 -22 l-20 -8 M-55 22 l-20 8 M55 -22 l20 -8 M55 22 l20 8 M-22 55 l-8 20 M22 55 l8 20"/>
    </g>
    <circle cx="0" cy="0" r="46" fill="#ffcf3f" stroke="#c77d1f" stroke-width="4"/>
    <circle cx="0" cy="0" r="38" fill="none" stroke="#ffe28a" stroke-width="3"/>
    <circle cx="-15" cy="-8" r="5" fill="#3a2a18"/><circle cx="15" cy="-8" r="5" fill="#3a2a18"/>
    <circle cx="-24" cy="6" r="6" fill="#e8542f" opacity="0.7"/><circle cx="24" cy="6" r="6" fill="#e8542f" opacity="0.7"/>
    <path d="M-14 14 q14 14 28 0" stroke="#3a2a18" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  }),
  shell: face({
    name: 'shell', ar: 'محارة', en: 'SEASHELL', seed: 606,
    sky: '#fdeef2', bg: '#f7cfd9', frameC: '#b05a72', deco: ['#b05a72', '#d98a9c', '#7a95a8', '#e8b13a'],
    subject: `
    <path d="M0 52 l-56 -58 a56 56 0 0 1 112 0 z" fill="#f2b6c1" stroke="#b05a72" stroke-width="4"/>
    <g stroke="#b05a72" stroke-width="3" fill="none">
      <path d="M0 52 L-40 -32 M0 52 L-20 -48 M0 52 L0 -54 M0 52 L20 -48 M0 52 L40 -32"/>
      <path d="M-48 -22 q48 -26 96 0" opacity="0.6"/>
      <path d="M-38 -40 q38 -18 76 0" opacity="0.45"/>
    </g>
    <path d="M-12 52 h24 l-4 10 h-16 z" fill="#d98a9c" stroke="#b05a72" stroke-width="3"/>
    <circle cx="0" cy="24" r="10" fill="#fdfdf6" stroke="#c9b8a0" stroke-width="3"/>
    <circle cx="-3" cy="21" r="3" fill="#fff"/>
    <path d="M-62 70 q10 -7 20 0 M42 70 q10 -7 20 0" stroke="#7a95a8" stroke-width="3" fill="none"/>`,
  }),
  seagull: face({
    name: 'seagull', ar: 'نورس', en: 'SEAGULL', seed: 707,
    sky: '#e4f2fb', bg: '#c2ddf0', frameC: '#3a6b8a', deco: ['#3a6b8a', '#8fb3c9', '#f2a13a', '#ffffff'],
    subject: `
    <path d="M-64 -20 q-18 -4 -26 8 q16 2 22 10 z" fill="#c9d2d8" stroke="#3a6b8a" stroke-width="3"/>
    <ellipse cx="0" cy="10" rx="52" ry="30" fill="#f7f7f2" stroke="#3a6b8a" stroke-width="4"/>
    <path d="M-46 4 q-26 -28 -12 -52 q22 10 34 38 z" fill="#c9d2d8" stroke="#3a6b8a" stroke-width="3.5"/>
    <path d="M-8 2 q-8 -34 12 -52 q16 18 10 50 z" fill="#e4e9ec" stroke="#3a6b8a" stroke-width="3.5"/>
    <circle cx="34" cy="-14" r="20" fill="#f7f7f2" stroke="#3a6b8a" stroke-width="4"/>
    <circle cx="40" cy="-18" r="4.5" fill="#1a1a1a"/>
    <path d="M52 -12 l24 5 -24 7 z" fill="#f2a13a" stroke="#c77d1f" stroke-width="2.5"/>
    <path d="M-52 22 l-16 10 M-44 30 l-12 12" stroke="#3a6b8a" stroke-width="3.5"/>
    <path d="M-6 42 l-3 16 M10 42 l3 16" stroke="#f2a13a" stroke-width="4" stroke-linecap="round"/>
    <path d="M-20 58 h14 M4 58 h14" stroke="#f2a13a" stroke-width="4" stroke-linecap="round"/>`,
  }),
  icecream: face({
    name: 'icecream', ar: 'مثلجات', en: 'ICE CREAM', seed: 808,
    sky: '#fff0e4', bg: '#ffd9c2', frameC: '#a3542c', deco: ['#a3542c', '#e8433b', '#f2b6c1', '#7a4a22'],
    subject: `
    <path d="M-34 6 L0 78 L34 6 z" fill="#d9a05b" stroke="#a3542c" stroke-width="4"/>
    <path d="M-26 12 l14 30 m-2 -32 l14 30 m-2 -32 l12 26 M-30 22 h52 M-22 40 h36 M-14 58 h20" stroke="#a3542c" stroke-width="2.5"/>
    <circle cx="-16" cy="-8" r="24" fill="#f2b6c1" stroke="#b05a72" stroke-width="3.5"/>
    <circle cx="18" cy="-6" r="22" fill="#f7f3e8" stroke="#c9b8a0" stroke-width="3.5"/>
    <circle cx="0" cy="-34" r="20" fill="#8a5a2b" stroke="#5a3a1e" stroke-width="3.5"/>
    <circle cx="2" cy="-58" r="8" fill="#e8433b" stroke="#a32c26" stroke-width="3"/>
    <path d="M2 -66 q8 -8 14 -4" stroke="#5a3a1e" stroke-width="3.5" fill="none"/>
    <g stroke-width="3" stroke-linecap="round">
      <path d="M-24 -14 l7 4 M-8 -22 l7 4 M14 -14 l7 4 M24 -2 l6 4 M-4 -40 l7 3" stroke="#e8433b"/>
      <path d="M-28 0 l7 3 M8 -30 l6 4 M10 2 l7 3" stroke="#2f7fe8"/>
    </g>`,
  }),
};

mkdirSync(OUT, { recursive: true });
for (const [name, svg] of Object.entries(FACES)) {
  writeFileSync(join(OUT, `${name}.svg`), svg);
  console.log(`  ${name}.svg (${(svg.length / 1024).toFixed(1)} KB)`);
}
console.log('Faces written to public/sets/beach-day/faces.');
