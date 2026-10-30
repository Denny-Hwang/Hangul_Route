/**
 * The text-keyed clip index (AMENDMENTS-AUDIO-CLIPS AC-B4). A clip of the `say` group is named by the text it says:
 * `sayKey(text) = sha256(NFC(text.trim()))`, its first 16 hex characters, and its ref is `audio/say/<sayKey>.mp3`.
 * Because the key is the spoken text itself, a clip can never play for a text that changed: the new text has a new
 * key, no clip matches it, and the device voice speaks it until the clip is generated again.
 *
 * One pure, synchronous implementation for every runtime: the React Native bundle (Hermes has no `node:crypto`, and
 * SubtleCrypto is asynchronous and absent there), the web bundle and the plain-node scripts (through
 * `scripts/ts-loader.mjs`) compute the same key. The tests cross-check it against `node:crypto`.
 */

/** Hex characters of a say key. */
export const SAY_KEY_LENGTH = 16;

const SAY_REF = /^audio\/say\/[0-9a-f]{16}\.mp3$/;

/**
 * The SHA-256 constants (FIPS 180-4 sections 4.2.2 and 5.3.3): the first 32 bits of the fractional parts of the cube
 * roots of the first 64 primes (`K`) and of the square roots of the first 8 (`H0`). Computed once on first use rather
 * than written out, which keeps about 600 bytes out of the start bundle; the node:crypto vectors pin the result.
 */
let K: Uint32Array | null = null;
let H0: Uint32Array | null = null;

function constants(): { k: Uint32Array; h0: Uint32Array } {
  if (K === null || H0 === null) {
    K = new Uint32Array(64);
    H0 = new Uint32Array(8);
    const frac = (x: number): number => ((x - Math.floor(x)) * 0x100000000) >>> 0;
    for (let n = 2, found = 0; found < 64; n += 1) {
      let prime = true;
      for (let d = 2; d * d <= n; d += 1) if (n % d === 0) prime = false;
      if (!prime) continue;
      if (found < 8) H0[found] = frac(Math.sqrt(n));
      K[found] = frac(Math.cbrt(n));
      found += 1;
    }
  }
  return { k: K, h0: H0 };
}

/** UTF-8 bytes of a string; a lone surrogate becomes U+FFFD, as `TextEncoder` and Node's `Buffer` encode it. */
function utf8(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    let cp = text.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      } else {
        cp = 0xfffd;
      }
    } else if (cp >= 0xdc00 && cp <= 0xdfff) {
      cp = 0xfffd;
    }
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return out;
}

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

/** SHA-256 of the UTF-8 bytes of `text`, as 64 lower-case hex characters (FIPS 180-4). */
export function sha256Hex(text: string): string {
  const bytes = utf8(text);
  const bitLength = bytes.length * 8;
  // Padding: 0x80, zeros to 56 mod 64, then the 64-bit big-endian bit length (texts here are far below 2^32 bits).
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(padded.length - 4, bitLength >>> 0);

  const { k, h0 } = constants();
  const h = new Uint32Array(h0);
  const w = new Uint32Array(64);
  for (let block = 0; block < padded.length; block += 64) {
    for (let t = 0; t < 16; t += 1) w[t] = view.getUint32(block + t * 4);
    for (let t = 16; t < 64; t += 1) {
      const w15 = w[t - 15] as number;
      const w2 = w[t - 2] as number;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[t] = ((w[t - 16] as number) + s0 + (w[t - 7] as number) + s1) >>> 0;
    }
    let a = h[0] as number;
    let b = h[1] as number;
    let c = h[2] as number;
    let d = h[3] as number;
    let e = h[4] as number;
    let f = h[5] as number;
    let g = h[6] as number;
    let hh = h[7] as number;
    for (let t = 0; t < 64; t += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + ch + (k[t] as number) + (w[t] as number)) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = ((h[0] as number) + a) >>> 0;
    h[1] = ((h[1] as number) + b) >>> 0;
    h[2] = ((h[2] as number) + c) >>> 0;
    h[3] = ((h[3] as number) + d) >>> 0;
    h[4] = ((h[4] as number) + e) >>> 0;
    h[5] = ((h[5] as number) + f) >>> 0;
    h[6] = ((h[6] as number) + g) >>> 0;
    h[7] = ((h[7] as number) + hh) >>> 0;
  }
  let hex = '';
  for (const word of h) hex += word.toString(16).padStart(8, '0');
  return hex;
}

/** NFC where the runtime has `normalize` (every engine the app ships on does; content is authored in NFC anyway). */
function nfc(text: string): string {
  return typeof text.normalize === 'function' ? text.normalize('NFC') : text;
}

/** The say key of a spoken text: sha256 of its trimmed NFC form, first 16 hex characters (AC-B4). */
export function sayKey(text: string): string {
  return sha256Hex(nfc(text.trim())).slice(0, SAY_KEY_LENGTH);
}

/** The clip ref of a spoken text: `audio/say/<sayKey>.mp3`. */
export function sayRef(text: string): string {
  return `audio/say/${sayKey(text)}.mp3`;
}

/** Whether a ref is a text-keyed clip (`audio/say/` and 16 lower-case hex characters). */
export function isSayRef(ref: string): boolean {
  return SAY_REF.test(ref);
}
