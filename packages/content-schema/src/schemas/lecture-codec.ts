import type { z } from 'zod';
import {
  LECTURE_DECK_VERSION,
  LECTURE_MAX_FRAGMENT_CHARS,
  LECTURE_MAX_JSON_BYTES,
  LectureDeckSchema,
  type LectureDeck,
  type LectureDeckInput,
} from './lecture';

/**
 * Lecture deck <-> URL fragment codec — F-TCH-004 §3.2. Pure, shared by the
 * console (writes `${APP_URL}/present#d=<fragment>`) and the presenter
 * (reads it, then strips it from the address bar).
 *
 * Format: `'1.' + base64url(utf8(JSON.stringify(deck)))`, no padding.
 * No Buffer: `TextEncoder` / `TextDecoder` + `btoa` / `atob`, present in
 * browsers, Workers and Node 18+.
 *
 * Limits: fragment <= 8192 characters (checked first, before any decoding)
 * and deck JSON <= 6144 UTF-8 bytes. On decode the first limit implies the
 * second (8190 base64url characters hold at most 6142 bytes; a test pins
 * that arithmetic, so raising the fragment limit fails it). `encodeDeck`
 * checks both.
 */

export const LECTURE_DECODE_FAILURES = [
  'empty',
  'too_large',
  'bad_encoding',
  'bad_json',
  'unsupported_version',
  'invalid',
] as const;
export type LectureDecodeFailure = (typeof LECTURE_DECODE_FAILURES)[number];

export type LectureDecodeResult =
  | { ok: true; deck: LectureDeck }
  | { ok: false; reason: LectureDecodeFailure; issues?: z.ZodIssue[] };

/** Thrown by `encodeDeck` when a valid deck would not fit in a link. */
export class LectureCodecError extends Error {
  readonly reason: 'too_large';
  constructor(reason: 'too_large') {
    super(`Lecture deck cannot be encoded: ${reason}`);
    this.name = 'LectureCodecError';
    this.reason = reason;
  }
}

/** The web platform globals the codec needs (the package compiles without DOM lib types). */
interface CodecRuntime {
  TextEncoder: new () => { encode(input: string): Uint8Array };
  TextDecoder: new (label: string, options: { fatal: boolean }) => { decode(input: Uint8Array): string };
  btoa(data: string): string;
  atob(data: string): string;
}
const runtime = globalThis as unknown as CodecRuntime;

const VERSION_PREFIX = `${LECTURE_DECK_VERSION}.`;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
const DIGITS_RE = /^\d+$/;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return runtime.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Null when `text` is not unpadded base64url. */
function fromBase64Url(text: string): Uint8Array | null {
  // A length of 4n + 1 cannot come from any byte string.
  if (!BASE64URL_RE.test(text) || text.length % 4 === 1) return null;
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = runtime.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Validates `deck` (throws the schema's `ZodError` when it is not a valid
 * deck, so no invalid link can be produced) and returns the fragment value.
 * Throws `LectureCodecError('too_large')` when the result exceeds the limits.
 */
export function encodeDeck(deck: LectureDeckInput): string {
  const parsed = LectureDeckSchema.parse(deck);
  const bytes = new runtime.TextEncoder().encode(JSON.stringify(parsed));
  const fragment = VERSION_PREFIX + toBase64Url(bytes);
  if (fragment.length > LECTURE_MAX_FRAGMENT_CHARS || bytes.length > LECTURE_MAX_JSON_BYTES) {
    throw new LectureCodecError('too_large');
  }
  return fragment;
}

/**
 * Reads a fragment value (`1.…`; a leading `#` and `d=` are tolerated).
 * Never throws: every failure is a reason the presenter can show and count.
 */
export function decodeDeck(fragment: string): LectureDecodeResult {
  let value = fragment;
  if (value.startsWith('#')) value = value.slice(1);
  if (value.startsWith('d=')) value = value.slice(2);
  if (value === '') return { ok: false, reason: 'empty' };
  if (value.length > LECTURE_MAX_FRAGMENT_CHARS) return { ok: false, reason: 'too_large' };

  const dot = value.indexOf('.');
  if (dot <= 0 || !DIGITS_RE.test(value.slice(0, dot))) return { ok: false, reason: 'bad_encoding' };
  if (value.slice(0, dot + 1) !== VERSION_PREFIX) return { ok: false, reason: 'unsupported_version' };

  const bytes = fromBase64Url(value.slice(dot + 1));
  if (!bytes) return { ok: false, reason: 'bad_encoding' };

  let text: string;
  try {
    text = new runtime.TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, reason: 'bad_encoding' };
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'bad_json' };
  }

  if (isRecord(json) && typeof json.v === 'number' && json.v !== LECTURE_DECK_VERSION) {
    return { ok: false, reason: 'unsupported_version' };
  }

  const result = LectureDeckSchema.safeParse(json);
  if (!result.success) return { ok: false, reason: 'invalid', issues: result.error.issues };
  return { ok: true, deck: result.data };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
