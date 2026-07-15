/**
 * Generates all game sounds programmatically as 16-bit mono WAVs — short,
 * pleasant, and royalty-free by construction.
 *
 * - public/sounds/            global UI sounds (flip, match, miss, win)
 * - public/sets/beach-day/sounds/  one appear-note per pair (pentatonic plucks)
 *
 * Run: node scripts/generate-sounds.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RATE = 22050;

function wav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767 * 0.85), 44 + i * 2);
  }
  return buf;
}

/** Soft synthetic pluck: sine + a bit of 2nd harmonic, exponential decay. */
function pluck(freq, dur = 0.35, gain = 1) {
  const n = Math.floor(RATE * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const env = Math.exp(-t * 9) * Math.min(1, t * 400);
    out[i] =
      gain *
      env *
      (0.75 * Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t));
  }
  return out;
}

function mixAt(target, source, offsetSec) {
  const off = Math.floor(offsetSec * RATE);
  for (let i = 0; i < source.length && off + i < target.length; i++) {
    target[off + i] += source[i];
  }
}

function sequence(notes, noteDur, totalDur) {
  const out = new Float32Array(Math.floor(RATE * totalDur));
  notes.forEach(([freq, at, gain = 1]) => mixAt(out, pluck(freq, noteDur, gain), at));
  return out;
}

/** Short filtered-noise tick for the card flip. */
function flip() {
  const n = Math.floor(RATE * 0.12);
  const out = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const env = Math.exp(-t * 55);
    lp += 0.35 * ((Math.random() * 2 - 1) - lp);
    out[i] = env * (0.6 * lp + 0.4 * Math.sin(2 * Math.PI * (900 - 3200 * t) * t));
  }
  return out;
}

const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880.0,
  C6 = 1046.5, D6 = 1174.66, E6 = 1318.51, G4 = 392.0, E4 = 329.63;

const uiDir = join(ROOT, 'public/sounds');
mkdirSync(uiDir, { recursive: true });
writeFileSync(join(uiDir, 'flip.wav'), wav(flip()));
writeFileSync(
  join(uiDir, 'match.wav'),
  wav(sequence([[C5, 0], [E5, 0.09], [G5, 0.18], [C6, 0.27, 1.1]], 0.4, 0.85)),
);
writeFileSync(
  join(uiDir, 'miss.wav'),
  wav(sequence([[G4, 0, 0.8], [E4, 0.16, 0.7]], 0.4, 0.7)),
);
writeFileSync(
  join(uiDir, 'win.wav'),
  wav(
    sequence(
      [
        [C5, 0], [E5, 0.1], [G5, 0.2], [C6, 0.3], [G5, 0.42], [C6, 0.52, 1.1],
        [E6, 0.66, 1.15], [C6, 0.86], [E6, 0.94], [G5, 1.02], [C6, 1.1, 1.2],
      ],
      0.5,
      1.9,
    ),
  ),
);

// Per-pair appear notes (pentatonic so any two sound good together).
const beachDir = join(ROOT, 'public/sets/beach-day/sounds');
mkdirSync(beachDir, { recursive: true });
const pairNotes = {
  crab: C5, palm: D5, ball: E5, boat: G5, sun: A5, shell: C6, seagull: D6, icecream: E6,
};
for (const [name, freq] of Object.entries(pairNotes)) {
  writeFileSync(join(beachDir, `${name}.wav`), wav(pluck(freq, 0.45, 0.9)));
}

console.log('Sounds written to public/sounds and public/sets/beach-day/sounds.');
