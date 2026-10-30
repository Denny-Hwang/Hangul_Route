// Licence rows for generated clips in content/assets-license.csv (AMENDMENTS-AUDIO-CLIPS AC-B1 "Licence rows";
// row AC-3). The hand-off step (AC-B5 step 5) writes one row per shipped clip; this module formats, parses and
// validates them.
//
// Columns stay asset_path, category, source, license, attribution, url. A generated clip's row:
//
//   asset_path   apps/mobile/assets/audio/<group>/<file>.mp3
//   category     audio-tts
//   source       tts:<vendor>/<engine>/<voice>; rate <r>; generated <YYYY-MM-DD>; terms <url> read <YYYY-MM-DD>
//   license      TTS_LICENSE below: generated clips are NOT under the repository's licence; the vendor terms apply
//   attribution  "<vendor label>, computer-generated voice <voice>"
//   url          the terms url of the source
//
// `vendor` is the generator's engine id (polly, google, azure) and `engine` the vendor model the lock records
// (neural, neural2, wavenet). The repository is public, so committed MP3s can be downloaded from GitHub as well as
// from the app: the row is what tells a reader which terms apply.
import { ENGINES } from './engines/index.mjs';
import { sha256Hex } from './lock-lib.mjs';

export const TTS_CATEGORY = 'audio-tts';
export const TTS_LICENSE = 'Vendor terms recorded in source (not under the repository licence)';
export const CLIP_ASSET_DIR = 'apps/mobile/assets/audio';

const DAY = '\\d{4}-\\d{2}-\\d{2}';
const SOURCE = new RegExp(
  `^tts:([a-z]+)/([a-z0-9-]+)/([A-Za-z0-9-]+); rate (\\d+(?:\\.\\d+)?); generated (${DAY}); terms (https://\\S+) read (${DAY})$`,
);

/** The `source` cell of a generated clip's row. */
export function formatTtsSource({ vendor, engine, voice, rate, generated, termsUrl, termsRead }) {
  return `tts:${vendor}/${engine}/${voice}; rate ${rate}; generated ${generated}; terms ${termsUrl} read ${termsRead}`;
}

/** The parts of a `source` cell, or null when it is not in the fixed format. */
export function parseTtsSource(source) {
  const m = SOURCE.exec(String(source));
  if (!m) return null;
  return { vendor: m[1], engine: m[2], voice: m[3], rate: Number(m[4]), generated: m[5], termsUrl: m[6], termsRead: m[7] };
}

/** The full CSV row (as an object keyed by column) for a shipped clip generated as `lockRow`. */
export function ttsLicenceRow({ assetPath, lockRow, termsRead }) {
  const engine = ENGINES[lockRow.engine];
  if (engine === undefined) throw new Error(`${assetPath}: unknown engine ${lockRow.engine}`);
  return {
    asset_path: assetPath,
    category: TTS_CATEGORY,
    source: formatTtsSource({ vendor: engine.id, engine: lockRow.model, voice: lockRow.voice, rate: lockRow.rate, generated: lockRow.generated, termsUrl: engine.termsUrl, termsRead }),
    license: TTS_LICENSE,
    attribution: `${engine.label}, computer-generated voice ${lockRow.voice}`,
    url: engine.termsUrl,
  };
}

/** `apps/mobile/assets/audio/say/x.mp3` -> `audio/say/x.mp3` (the clip ref), or null outside the clip folder. */
export function refOfAssetPath(assetPath) {
  const prefix = `${CLIP_ASSET_DIR}/`;
  return String(assetPath).startsWith(prefix) && assetPath.endsWith('.mp3') ? `audio/${assetPath.slice(prefix.length)}` : null;
}

/**
 * Problems with the licence rows of the shipped clips, as messages (empty when all is well):
 * - every shipped clip (`clips`: { path, bytes } with path relative to the repo root) has exactly one row;
 * - a clip whose bytes are a processed MP3 in the lock, and every clip of the text-keyed `say` group (which can only
 *   be generated), has an `audio-tts` row;
 * - every `audio-tts` row parses, names a shipped clip, carries the fixed licence text and the terms url, and its
 *   vendor, engine, voice, rate and date match the lock row whose processed MP3 is that clip.
 * With no clips and no rows (before the first pack ships) there is nothing to check.
 *
 * @param {{ csvRows: Array<Record<string, string>>, lock: { rows: object[] }, clips: Array<{ path: string, bytes: Buffer }> }} input
 */
export function licenceRowProblems({ csvRows, lock, clips }) {
  const problems = [];
  const rowsByPath = new Map();
  for (const row of csvRows) {
    const list = rowsByPath.get(row.asset_path) ?? [];
    list.push(row);
    rowsByPath.set(row.asset_path, list);
  }
  const clipByPath = new Map(clips.map((c) => [c.path, c]));
  const lockByMp3 = new Map();
  for (const r of lock.rows) if (r.mp3Sha256 !== null) lockByMp3.set(`${r.ref} ${r.mp3Sha256}`, r);

  for (const clip of clips) {
    const rows = rowsByPath.get(clip.path) ?? [];
    const ref = refOfAssetPath(clip.path);
    const generated = ref !== null && (lockByMp3.has(`${ref} ${sha256Hex(clip.bytes)}`) || ref.startsWith('audio/say/'));
    if (rows.length !== 1) {
      problems.push(`${clip.path}: ${rows.length} licence rows in content/assets-license.csv (every shipped clip has exactly one)`);
      continue;
    }
    if (generated && rows[0].category !== TTS_CATEGORY) {
      problems.push(`${clip.path}: a generated clip, so its row's category must be ${TTS_CATEGORY}, not ${rows[0].category}`);
    }
  }

  for (const row of csvRows.filter((r) => r.category === TTS_CATEGORY)) {
    const where = row.asset_path;
    const parsed = parseTtsSource(row.source);
    if (parsed === null) {
      problems.push(`${where}: source "${row.source}" is not "tts:<vendor>/<engine>/<voice>; rate <r>; generated <YYYY-MM-DD>; terms <url> read <YYYY-MM-DD>"`);
      continue;
    }
    if (row.license !== TTS_LICENSE) problems.push(`${where}: license must read "${TTS_LICENSE}"`);
    if (row.url !== parsed.termsUrl) problems.push(`${where}: url must be the terms url of the source (${parsed.termsUrl})`);
    const engine = ENGINES[parsed.vendor];
    if (engine === undefined) problems.push(`${where}: unknown vendor ${parsed.vendor}`);
    else if (parsed.termsUrl !== engine.termsUrl) problems.push(`${where}: terms url for ${parsed.vendor} is ${engine.termsUrl}`);
    const clip = clipByPath.get(where);
    const ref = refOfAssetPath(where);
    if (clip === undefined || ref === null) {
      problems.push(`${where}: no shipped clip at this path`);
      continue;
    }
    const locked = lockByMp3.get(`${ref} ${sha256Hex(clip.bytes)}`);
    if (locked === undefined) {
      problems.push(`${where}: no row in content/audio/tts-lock.json has this ref and this MP3's sha256`);
      continue;
    }
    const want = { vendor: locked.engine, engine: locked.model, voice: locked.voice, rate: locked.rate, generated: locked.generated };
    for (const [k, v] of Object.entries(want)) {
      if (parsed[k] !== v) problems.push(`${where}: source says ${k} ${parsed[k]} but tts-lock.json says ${v}`);
    }
  }
  return problems;
}
