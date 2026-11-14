// Synthesises the game's soft sound effects as small 16-bit mono WAV files.
// Run: bun scripts/make-sounds.ts  (writes assets/sfx/*.wav)
import { mkdirSync, writeFileSync } from 'node:fs';

const RATE = 22050;

function wav(samples: Float32Array): Buffer {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

type Voice = (t: number, dur: number) => number;

function render(dur: number, ...voices: Voice[]): Float32Array {
  const n = Math.floor(dur * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    let v = 0;
    for (const f of voices) v += f(t, dur);
    out[i] = v;
  }
  // tiny fade in/out to avoid clicks
  const f = Math.floor(RATE * 0.004);
  for (let i = 0; i < f; i++) {
    out[i] *= i / f;
    out[n - 1 - i] *= i / f;
  }
  return out;
}

// envelope: quick attack, exponential decay
const env = (t: number, a: number, d: number) => (t < a ? t / a : Math.exp(-(t - a) / d));

let seed = 1;
const noise = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed / 2147483647) * 2 - 1;
};

/** sine sweep from f0 to f1 over len seconds, starting at start */
function sweep(start: number, len: number, f0: number, f1: number, vol: number, decay: number): Voice {
  let phase = 0;
  let last = 0;
  return (t) => {
    if (t < start || t > start + len) return 0;
    const u = (t - start) / len;
    const f = f0 * Math.pow(f1 / f0, u);
    phase += 2 * Math.PI * f * (t - last || 1 / RATE);
    last = t;
    return Math.sin(phase) * vol * env(t - start, 0.004, decay);
  };
}

/** soft bell: fundamental + gentle overtones */
function bell(start: number, f: number, vol: number, decay: number): Voice {
  return (t) => {
    if (t < start) return 0;
    const x = t - start;
    const e = env(x, 0.003, decay);
    return vol * e * (Math.sin(2 * Math.PI * f * x) + 0.35 * Math.sin(2 * Math.PI * f * 2 * x) * Math.exp(-x * 9) + 0.12 * Math.sin(2 * Math.PI * f * 3.01 * x) * Math.exp(-x * 14));
  };
}

/** low-passed noise puff */
function puff(start: number, vol: number, decay: number, smooth: number): Voice {
  let y = 0;
  return (t) => {
    if (t < start) return 0;
    y += (noise() - y) * smooth;
    return y * vol * env(t - start, 0.006, decay);
  };
}

const note = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

const sounds: Record<string, Float32Array> = {
  flap: render(0.14, sweep(0, 0.12, 420, 880, 0.32, 0.05), puff(0, 0.5, 0.04, 0.18)),
  score: render(0.45, bell(0, note(88), 0.28, 0.12), bell(0.08, note(93), 0.3, 0.2)),
  star: render(0.55, bell(0, note(84), 0.2, 0.1), bell(0.06, note(88), 0.2, 0.1), bell(0.12, note(91), 0.22, 0.12), bell(0.18, note(96), 0.24, 0.22)),
  hit: render(0.4, sweep(0, 0.32, 260, 70, 0.55, 0.11), puff(0, 0.7, 0.08, 0.08)),
  land: render(0.3, sweep(0, 0.22, 150, 60, 0.5, 0.07), puff(0, 0.6, 0.06, 0.05)),
  click: render(0.08, sweep(0, 0.06, 620, 1150, 0.3, 0.025)),
  best: render(1.0, bell(0, note(79), 0.2, 0.15), bell(0.12, note(84), 0.2, 0.15), bell(0.24, note(88), 0.22, 0.15), bell(0.36, note(91), 0.24, 0.45), bell(0.36, note(96), 0.12, 0.45)),
  theme: render(0.9, bell(0, note(76), 0.14, 0.4), bell(0.15, note(83), 0.14, 0.4), bell(0.3, note(88), 0.14, 0.5)),
};

mkdirSync('assets/sfx', { recursive: true });
for (const [name, s] of Object.entries(sounds)) {
  writeFileSync(`assets/sfx/${name}.wav`, wav(s));
  console.log(name, `${((44 + s.length * 2) / 1024).toFixed(1)} KB`);
}
