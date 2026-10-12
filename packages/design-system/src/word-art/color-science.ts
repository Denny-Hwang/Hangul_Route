/**
 * Colour-vision helpers for the `colors.vocab` review (F-VOC-002 §3.4).
 * Review utilities: they are not exported from the `./word-art` entry (the app
 * never loads them); the shipped result is the constant in
 * `color-confusion.ts`, which the tests recompute with these helpers. The
 * web contact sheet reads `MACHADO_MATRICES` through the
 * `./word-art/color-science` subpath for its colour-vision strip, so the
 * preview simulates exactly what the confusion pairs are computed from.
 *
 * - sRGB -> CIE Lab (D65), distance by CIEDE2000 (Sharma, Wu and Dalal 2005).
 * - Colour-vision simulation by the Machado, Oliveira and Fernandes (2009)
 *   matrices at severity 1.0, applied in linear RGB.
 */

export type Lab = readonly [number, number, number];
export type Vision = 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia';

/** The three simulated deficiencies. */
export const VISIONS: readonly Exclude<Vision, 'normal'>[] = ['protanopia', 'deuteranopia', 'tritanopia'];

/** Two colours closer than this (CIEDE2000) under one vision collapse (§3.4). */
export const CONFUSION_THRESHOLD = 8;

export type VisionMatrix = readonly [number, number, number, number, number, number, number, number, number];

/** Row-major 3 x 3 matrices in linear RGB, severity 1.0 (Machado, Oliveira and Fernandes 2009). */
export const MACHADO_MATRICES: Readonly<Record<Exclude<Vision, 'normal'>, VisionMatrix>> = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

function linearRgb(hex: string): [number, number, number] {
  const m = HEX.exec(hex);
  if (!m) throw new Error(`expected an opaque #RRGGBB colour, got "${hex}"`);
  return [m[1]!, m[2]!, m[3]!].map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
}

function toHex(linear: readonly number[]): string {
  return `#${linear
    .map((v) => {
      const s = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
      return Math.round(s * 255)
        .toString(16)
        .padStart(2, '0');
    })
    .join('')
    .toUpperCase()}`;
}

/** Linear RGB of `hex` under `vision`, clamped to the gamut and not quantised. */
function simulateLinear(hex: string, vision: Vision): [number, number, number] {
  const [r, g, b] = linearRgb(hex);
  if (vision === 'normal') return [r, g, b];
  const m = MACHADO_MATRICES[vision];
  const clamp = (v: number): number => Math.min(1, Math.max(0, v));
  return [clamp(m[0] * r + m[1] * g + m[2] * b), clamp(m[3] * r + m[4] * g + m[5] * b), clamp(m[6] * r + m[7] * g + m[8] * b)];
}

/** How `hex` looks under `vision`, as an opaque hex (normal returns it unchanged). */
export function simulate(hex: string, vision: Vision): string {
  return toHex(simulateLinear(hex, vision));
}

function linearToLab([r, g, b]: readonly [number, number, number]): Lab {
  // sRGB D65 -> XYZ, normalised by the D65 white
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function hexToLab(hex: string): Lab {
  return linearToLab(linearRgb(hex));
}

const rad = (deg: number): number => (deg * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

/** CIEDE2000 colour difference (kL = kC = kH = 1). */
export function ciede2000(lab1: Lab, lab2: Lab): number {
  const [l1, a1, b1] = lab1;
  const [l2, a2, b2] = lab2;
  const cBar = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const hue = (b: number, ap: number): number => (b === 0 && ap === 0 ? 0 : (deg(Math.atan2(b, ap)) + 360) % 360);
  const h1p = hue(b1, a1p);
  const h2p = hue(b2, a2p);

  const dLp = l2 - l1;
  const dCp = c2p - c1p;
  let dhp = 0;
  if (c1p * c2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(rad(dhp / 2));

  const lBarP = (l1 + l2) / 2;
  const cBarP = (c1p + c2p) / 2;
  let hBarP = h1p + h2p;
  if (c1p * c2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hBarP = (h1p + h2p) / 2;
    else hBarP = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  }
  const t = 1 - 0.17 * Math.cos(rad(hBarP - 30)) + 0.24 * Math.cos(rad(2 * hBarP)) + 0.32 * Math.cos(rad(3 * hBarP + 6)) - 0.2 * Math.cos(rad(4 * hBarP - 63));
  const dTheta = 30 * Math.exp(-(((hBarP - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lBarP - 50) ** 2) / Math.sqrt(20 + (lBarP - 50) ** 2);
  const sc = 1 + 0.045 * cBarP;
  const sh = 1 + 0.015 * cBarP * t;
  const rt = -Math.sin(rad(2 * dTheta)) * rc;
  return Math.sqrt((dLp / sl) ** 2 + (dCp / sc) ** 2 + (dHp / sh) ** 2 + rt * (dCp / sc) * (dHp / sh));
}

/** CIEDE2000 distance between two colours as seen under `vision`. */
export function deltaE(a: string, b: string, vision: Vision = 'normal'): number {
  return ciede2000(linearToLab(simulateLinear(a, vision)), linearToLab(simulateLinear(b, vision)));
}

export interface ConfusionPair {
  a: string;
  b: string;
  /** The vision under which the two are closest. */
  vision: Vision;
  distance: number;
}

/** Every pair of `palette` keys closer than the threshold under normal vision or a simulation, in key order. */
export function confusionPairs(palette: Readonly<Record<string, string>>, threshold = CONFUSION_THRESHOLD): ConfusionPair[] {
  const keys = Object.keys(palette);
  const out: ConfusionPair[] = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const [a, b] = [keys[i]!, keys[j]!];
      let closest: { vision: Vision; distance: number } = { vision: 'normal', distance: deltaE(palette[a]!, palette[b]!) };
      for (const vision of VISIONS) {
        const distance = deltaE(palette[a]!, palette[b]!, vision);
        if (distance < closest.distance) closest = { vision, distance };
      }
      if (closest.distance < threshold) out.push({ a, b, ...closest });
    }
  }
  return out;
}
