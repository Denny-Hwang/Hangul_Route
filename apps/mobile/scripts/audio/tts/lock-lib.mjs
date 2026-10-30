// content/audio/tts-lock.json: what was generated, row by row (AMENDMENTS-AUDIO-CLIPS AC-B5 step 4; row AC-3).
//
// One row per generated clip and voice:
//
//   { ref, key, engine, voice, model, rate, generated, saySha256, mp3Sha256 }
//
// - `engine` is the generator's engine id (polly, google, azure); `model` the vendor model (neural, neural2,
//   wavenet); `rate` the rate the clip was generated at; `generated` the UTC date (YYYY-MM-DD).
// - `saySha256` is sha256 of the exact text sent to the engine (`say`, after the AC-B3 rules and overrides): a row
//   whose say, voice and rate are unchanged is skipped on a rerun, so a rerun only pays for changed rows.
// - `mp3Sha256` is the processed MP3's sha256, null until the hand-off step processes the master (AC-B5 step 5).
//   Neural voices are not guaranteed to be deterministic, so the MP3 is the committed asset; the lock proves which
//   input made which file. The licence-row validator (licence-rows.mjs) matches shipped clips against it.
//
// Nothing secret is ever written here: no credential, no key path, no profile name, no account id.
import { createHash } from 'node:crypto';

export const LOCK_FILE = 'content/audio/tts-lock.json';
export const LOCK_SCHEMA_VERSION = 1;
const LOCK_KEYS = ['ref', 'key', 'engine', 'voice', 'model', 'rate', 'generated', 'saySha256', 'mp3Sha256'];
const SHA256 = /^[0-9a-f]{64}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Hex sha256 of a string (UTF-8) or a Buffer. */
export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

/** sha256 of the exact text sent to the engine. */
export function saySha256(say) {
  return sha256Hex(String(say));
}

export function emptyLock() {
  return { schemaVersion: LOCK_SCHEMA_VERSION, rows: [] };
}

const fail = (message) => {
  throw new Error(`${LOCK_FILE}: ${message}`);
};

/** Validates a parsed lock file and returns it with its rows; throws naming the bad row. */
export function parseLock(json) {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) fail('not an object');
  if (json.schemaVersion !== LOCK_SCHEMA_VERSION) fail(`schemaVersion must be ${LOCK_SCHEMA_VERSION}`);
  if (!Array.isArray(json.rows)) fail('rows must be an array');
  const seen = new Set();
  json.rows.forEach((row, i) => {
    const where = `rows[${i}]`;
    if (row === null || typeof row !== 'object') fail(`${where} is not an object`);
    const extra = Object.keys(row).filter((k) => !LOCK_KEYS.includes(k));
    if (extra.length > 0) fail(`${where} has unknown fields ${extra.join(', ')}`);
    for (const k of ['ref', 'key', 'engine', 'voice', 'model']) {
      if (typeof row[k] !== 'string' || row[k] === '') fail(`${where}.${k} must be a non-empty string`);
    }
    if (typeof row.rate !== 'number' || !Number.isFinite(row.rate)) fail(`${where}.rate must be a number`);
    if (typeof row.generated !== 'string' || !DAY.test(row.generated)) fail(`${where}.generated must be YYYY-MM-DD`);
    if (typeof row.saySha256 !== 'string' || !SHA256.test(row.saySha256)) fail(`${where}.saySha256 must be a sha256`);
    if (row.mp3Sha256 !== null && (typeof row.mp3Sha256 !== 'string' || !SHA256.test(row.mp3Sha256))) {
      fail(`${where}.mp3Sha256 must be a sha256 or null`);
    }
    const id = lockId(row);
    if (seen.has(id)) fail(`${where} repeats ${id}`);
    seen.add(id);
  });
  return json;
}

/** One lock row per clip ref, engine and voice. */
export function lockId({ ref, engine, voice }) {
  return `${ref} ${engine}/${voice}`;
}

/** The lock row for a clip in one voice, or undefined. */
export function lockRowOf(lock, { ref, engine, voice }) {
  return lock.rows.find((r) => r.ref === ref && r.engine === engine && r.voice === voice);
}

/** Whether a lock row was made from this exact say and rate (the rerun skip rule). */
export function lockMatches(lockRow, { say, rate }) {
  return lockRow !== undefined && lockRow.saySha256 === saySha256(say) && lockRow.rate === rate;
}

/** A new lock with `row` added, or replacing the row of the same ref, engine and voice. */
export function upsertLockRow(lock, row) {
  const next = { ref: row.ref, key: row.key, engine: row.engine, voice: row.voice, model: row.model, rate: row.rate, generated: row.generated, saySha256: row.saySha256, mp3Sha256: row.mp3Sha256 ?? null };
  const id = lockId(next);
  return { schemaVersion: LOCK_SCHEMA_VERSION, rows: [...lock.rows.filter((r) => lockId(r) !== id), next] };
}

/** A new lock with the processed MP3's sha256 recorded on a row (the hand-off step, AC-B5 step 5). */
export function withProcessedMp3(lock, { ref, engine, voice }, mp3Sha256) {
  if (!SHA256.test(String(mp3Sha256))) throw new Error(`mp3Sha256 for ${ref} must be a sha256`);
  const row = lockRowOf(lock, { ref, engine, voice });
  if (row === undefined) throw new Error(`${lockId({ ref, engine, voice })} is not in ${LOCK_FILE}`);
  return upsertLockRow(lock, { ...row, mp3Sha256 });
}

const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** The committed file: a short header, then one row per line, ordered by ref, engine and voice. */
export function renderLock(lock) {
  const rows = [...lock.rows].sort((a, b) => byCodePoint(a.ref, b.ref) || byCodePoint(a.engine, b.engine) || byCodePoint(a.voice, b.voice));
  const head = [
    '{',
    `  "schemaVersion": ${LOCK_SCHEMA_VERSION},`,
    '  "generatedBy": "pnpm --filter @hangul-route/mobile audio:tts:generate (apps/mobile/scripts/audio/tts/generate.mjs); do not edit by hand",',
  ];
  if (rows.length === 0) return `${[...head, '  "rows": []', '}'].join('\n')}\n`;
  const line = (r) => `    ${JSON.stringify(Object.fromEntries(LOCK_KEYS.map((k) => [k, r[k] ?? null])))}`;
  return `${[...head, '  "rows": [', rows.map(line).join(',\n'), '  ]', '}'].join('\n')}\n`;
}
