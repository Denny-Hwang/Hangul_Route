// The pure core of the clip manifest (AMENDMENTS-AUDIO-CLIPS AC-B3, AC-B4, AC-B5 step 1, AC-B6; row AC-2).
//
// Input: the jamo clip voices (one per record and question, from `jamoVoice`) and every occurrence of a spoken text
// in the shipped content (content-sources.mjs). Output: one row per clip to generate, in a fixed order:
//
//   { ref, key, kind, text, say, ipa?, rate, pack, sources }
//
// - `text` is what the app speaks (`spokenKo ?? ko`, or `jamoVoice(...).text`); `say` is what is sent to the engine
//   after the AC-B3 normalization and the pronunciation overrides. An override changes `say` (and `ipa`) only: never
//   `text`, `key` or `ref`, so it never changes what the screen shows or which clip a text plays.
// - A jamo clip keeps its id-named ref (`audio/jamo/<id>.mp3`, `<id>-name.mp3`; AC-B4). Every other text is one
//   `say` clip, `audio/say/<sayKey(text)>.mp3`, deduplicated by text and owned by the first pack that uses it
//   (AC-B6 order). A vocabulary word whose text belongs to the `vocab` pack keeps its record's clip path
//   (`audio/vocab/<slug>.mp3`): the record's ref wins over the say ref.
// - Texts the engine must never see are skipped with a reason (AC-B3 "never generated"): lone jamo, cloze
//   templates, template fragments, ko-locale glosses, and Latin letters or digits with no authored `spokenKo`.
//
// No network, no file system: build-manifest.mjs reads the content and writes the file.
import { AUDIO_PACKS, sayKey, sayRef } from '@hangul-route/content-schema';

export const MANIFEST_FILE = 'content/audio/tts-manifest.json';
export const OVERRIDES_FILE = 'content/audio/pronunciation-overrides.json';
export const MANIFEST_SCHEMA_VERSION = 1;

/** The row kinds, in the order the summary lists them. */
export const CLIP_KINDS = ['jamo-sound', 'jamo-name', 'syllable', 'word', 'sentence', 'narration'];

/**
 * Generation rate per kind (AC-B2): syllables and letter names 0.85; words 0.9 (the top of the 0.85-0.9 range, so a
 * word and a sentence of the same lesson play at one speed); sentences 0.9; narration 1.0. A clip carries its rate.
 */
export const KIND_RATES = Object.freeze({
  'jamo-sound': 0.85,
  'jamo-name': 0.85,
  syllable: 0.85,
  word: 0.9,
  sentence: 0.9,
  narration: 1.0,
});

/**
 * The AC-B3 normalization switch. `syllableFullStop`: an isolated syllable (a vowel, a carrier syllable, a final, a
 * one-syllable word) is sent with a full stop ("아." "나." "악."), which asks for a calm statement. The AC-5 pilot
 * compares "아" with "아."; the winner is set here, in this one place, and the manifest is regenerated.
 */
export const NORMALIZATION = Object.freeze({ syllableFullStop: true });

/** Why an occurrence is never generated (AC-B3). */
export const SKIP_REASONS = Object.freeze({
  'lone-jamo': 'a lone letter (compatibility or conjoining jamo): a letter is spoken through jamoVoice and its jamo clips',
  cloze: 'a cloze template (___): the learner fills it, the voice never reads it',
  fragment: 'a template fragment (a particle or ending choice, or an alternation such as 이에요/예요)',
  'ko-gloss': 'a ko-locale gloss or definition: UI text, not taught Korean',
  'latin-or-digit': 'Latin letters or digits with no authored spokenKo (for example 2,000 needs spokenKo 이천)',
  empty: 'no text to say',
});

const COMPAT_OR_CONJOINING_JAMO = /[ㄱ-ㆎᄀ-ᇿ]/u;
const CLOZE = /_{2,}|＿/u;
const LATIN_OR_DIGIT = /[A-Za-z0-9０-９Ａ-Ｚａ-ｚ]/u;
const ALTERNATION = /[가-힣)]\s*\/\s*[(가-힣]/u;
/** A piece cut from a template: it starts with a joiner (-, ~, …, ...) or ends with a hyphen. */
const DANGLING = /^(?:[-~…]|\.\.\.)|-$/u;
/** The particle (or ending) choices of a Particle Pick round: endings that fill a template's slot. */
const FRAGMENT_PATH = /(?:^|\.)particle\.choices(?:\.|$)/u;
const SINGLE_SYLLABLE = /^[가-힣]$/u;
const SENTENCE_END = /[.!?]["'”’)]*$/u;

/** The text as keyed: trimmed NFC (the same normal form `sayKey` hashes). */
export function normalText(text) {
  return String(text).normalize('NFC').trim();
}

/** What the voice says for a content text: `spokenKo` when authored, else `ko` (F-AUDIO-004). */
export function spokenOf(occ) {
  return normalText(typeof occ.spokenKo === 'string' && occ.spokenKo.trim() !== '' ? occ.spokenKo : occ.ko);
}

/** The kind of a spoken text by its shape: one syllable, a sentence (ends in . ! ?), else a word or phrase. */
export function kindOfText(text) {
  const t = normalText(text);
  if (SINGLE_SYLLABLE.test(t)) return 'syllable';
  return SENTENCE_END.test(t) ? 'sentence' : 'word';
}

/**
 * The reason an occurrence is never generated, or null when its spoken text is sent to the engine. `occ` carries
 * `ko`, an optional `spokenKo`, `source` (`<file or id>#<path>`) and `path` (the object path inside its file).
 */
export function skipReasonOf(occ) {
  const source = String(occ.source ?? '');
  if (source.startsWith('content/i18n/')) return 'ko-gloss';
  const text = spokenOf(occ);
  if (text === '') return 'empty';
  if (COMPAT_OR_CONJOINING_JAMO.test(text)) return 'lone-jamo';
  if (CLOZE.test(text)) return 'cloze';
  if (FRAGMENT_PATH.test(String(occ.path ?? '')) || ALTERNATION.test(text) || DANGLING.test(text)) return 'fragment';
  if (LATIN_OR_DIGIT.test(text)) return 'latin-or-digit';
  return null;
}

/** What is sent to the engine for a text of `kind` (AC-B3): the override's `say` when there is one. */
export function sayOf(kind, text, override, normalization = NORMALIZATION) {
  if (override !== undefined) return override.say;
  const syllableLike = kind === 'jamo-sound' || kind === 'syllable';
  if (normalization.syllableFullStop && syllableLike && SINGLE_SYLLABLE.test(text)) return `${text}.`;
  return text;
}

const packIndex = (pack) => {
  const i = AUDIO_PACKS.indexOf(pack);
  if (i < 0) throw new Error(`unknown clip pack "${pack}" (AUDIO_PACKS in packages/content-schema)`);
  return i;
};
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const uniqueSorted = (values) => [...new Set(values)].sort(byCodePoint);

function rowOf({ ref, key, kind, text, pack, sources }, overrides, normalization) {
  const override = overrides[text];
  const row = { ref, key, kind, text, say: sayOf(kind, text, override, normalization) };
  if (override?.ipa !== undefined) row.ipa = override.ipa;
  row.rate = KIND_RATES[kind];
  row.pack = pack;
  row.sources = uniqueSorted(sources);
  return row;
}

/** `audio/jamo/giyeok-name.mp3` -> `giyeok-name` (a jamo row's key: its file id). */
const jamoKeyOf = (ref) => {
  const m = /^audio\/jamo\/([a-z0-9-]+)\.mp3$/.exec(ref);
  if (!m) throw new Error(`jamo clip ref "${ref}" is not audio/jamo/<id>.mp3`);
  return m[1];
};

/** The jamo rows: merged by ref (shared finals), in declaration order, each in the first pack that declares it. */
function jamoRows(voices, overrides, normalization) {
  const byRef = new Map();
  for (const v of voices) {
    const text = normalText(v.text);
    const reason = skipReasonOf({ ko: text, source: v.source });
    if (reason !== null) throw new Error(`${v.source}: jamo clip text "${v.text}" is never generated (${reason}); fix jamoVoice or the record`);
    const seen = byRef.get(v.ref);
    if (seen === undefined) {
      byRef.set(v.ref, { ref: v.ref, key: jamoKeyOf(v.ref), kind: v.kind, text, pack: v.pack, sources: [v.source] });
      continue;
    }
    if (seen.text !== text || seen.kind !== v.kind) {
      throw new Error(`${v.ref}: ${seen.sources[0]} says "${seen.text}" (${seen.kind}) but ${v.source} says "${text}" (${v.kind}); records that share a clip must say the same`);
    }
    if (packIndex(v.pack) < packIndex(seen.pack)) seen.pack = v.pack;
    seen.sources.push(v.source);
  }
  return [...byRef.values()].map((r) => rowOf(r, overrides, normalization));
}

/**
 * The say rows: occurrences grouped by spoken text, each text once, in the first pack (AC-B6 order) that uses it.
 * A text owned by `vocab` keeps the clip path of its vocabulary record (`audio/vocab/<slug>.mp3`).
 */
function sayRows(occurrences, overrides, normalization) {
  const byText = new Map();
  const skipped = [];
  for (const occ of occurrences) {
    packIndex(occ.pack);
    const reason = skipReasonOf(occ);
    if (reason !== null) {
      skipped.push({ reason, text: spokenOf(occ), source: occ.source, pack: occ.pack });
      continue;
    }
    const text = spokenOf(occ);
    const entry = byText.get(text) ?? { text, occurrences: [] };
    entry.occurrences.push(occ);
    byText.set(text, entry);
  }
  const rows = [];
  for (const { text, occurrences: occs } of byText.values()) {
    const pack = occs.map((o) => o.pack).reduce((a, b) => (packIndex(b) < packIndex(a) ? b : a));
    const recordRefs = uniqueSorted(occs.filter((o) => o.pack === 'vocab' && pack === 'vocab' && typeof o.audioRef === 'string').map((o) => o.audioRef));
    if (recordRefs.length > 1) {
      throw new Error(`"${text}": vocabulary records ${recordRefs.join(', ')} say the same text; one clip serves them, so give them one audioRef`);
    }
    const kinds = new Set(occs.map((o) => o.kind).filter((k) => k !== undefined));
    const shape = kindOfText(text);
    const kind = kinds.has('narration') && shape !== 'syllable' ? 'narration' : shape;
    rows.push(
      rowOf({ ref: recordRefs[0] ?? sayRef(text), key: sayKey(text), kind, text, pack, sources: occs.map((o) => o.source) }, overrides, normalization),
    );
  }
  return { rows, skipped };
}

/**
 * The manifest rows and the skip list. Throws on a contradiction (two records sharing a clip that say different
 * texts, an unknown pack, an override that no clip uses). Rows are ordered by pack (AC-B6), then jamo rows in
 * declaration order and say rows by text, so the output does not depend on the order the content is read in.
 *
 * @param {{ jamo: readonly object[], occurrences: readonly object[], overrides?: Record<string, { say: string, ipa?: string }>, normalization?: { syllableFullStop: boolean } }} input
 */
export function buildManifest({ jamo, occurrences, overrides = {}, normalization = NORMALIZATION }) {
  const jamoPart = jamoRows(jamo, overrides, normalization);
  const { rows: said, skipped } = sayRows(occurrences, overrides, normalization);
  const refs = new Set();
  for (const row of [...jamoPart, ...said]) {
    if (refs.has(row.ref)) throw new Error(`${row.ref}: two clips share a ref`);
    refs.add(row.ref);
  }
  const texts = new Set([...jamoPart, ...said].map((r) => r.text));
  const unused = Object.keys(overrides).filter((t) => !texts.has(t));
  if (unused.length > 0) {
    throw new Error(`${OVERRIDES_FILE}: no clip says ${unused.map((t) => `"${t}"`).join(', ')}; remove the override or fix its key (keys are the spoken text)`);
  }
  const order = (row) => packIndex(row.pack);
  const jamoSorted = jamoPart.map((row, i) => ({ row, i })).sort((a, b) => order(a.row) - order(b.row) || a.i - b.i).map((x) => x.row);
  const saySorted = [...said].sort((a, b) => order(a) - order(b) || byCodePoint(a.text, b.text));
  const skippedSorted = skipped.sort((a, b) => byCodePoint(a.reason, b.reason) || byCodePoint(a.source, b.source));
  return { rows: [...jamoSorted, ...saySorted], skipped: skippedSorted };
}

/** The committed file: a short header, then one row per line (stable and reviewable in a diff). */
export function renderManifest(rows, normalization = NORMALIZATION) {
  const head = [
    '{',
    `  "schemaVersion": ${MANIFEST_SCHEMA_VERSION},`,
    '  "generatedBy": "pnpm --filter @hangul-route/mobile audio:tts:manifest (apps/mobile/scripts/audio/tts/build-manifest.mjs); do not edit by hand",',
    `  "normalization": ${JSON.stringify(normalization)},`,
  ];
  if (rows.length === 0) return `${[...head, '  "rows": []', '}'].join('\n')}\n`;
  return `${[...head, '  "rows": [', rows.map((r) => `    ${JSON.stringify(r)}`).join(',\n'), '  ]', '}'].join('\n')}\n`;
}

/** The printed summary: rows per kind and pack, characters sent, and the skip list by reason. */
export function summarizeManifest({ rows, skipped }) {
  const count = (list, keyOf) => list.reduce((acc, item) => acc.set(keyOf(item), (acc.get(keyOf(item)) ?? 0) + 1), new Map());
  const chars = (list) => list.reduce((n, r) => n + [...r.say].length, 0);
  const perKind = count(rows, (r) => r.kind);
  const perPack = count(rows, (r) => r.pack);
  const says = rows.filter((r) => !r.ref.startsWith('audio/jamo/'));
  const lines = [
    `tts manifest: ${rows.length} clips (${rows.length - says.length} jamo, ${says.length} text-keyed or vocabulary), ${chars(rows)} characters sent`,
    `  by kind: ${CLIP_KINDS.map((k) => `${k} ${perKind.get(k) ?? 0}`).join(', ')}`,
    `  by pack: ${AUDIO_PACKS.map((p) => `${p} ${perPack.get(p) ?? 0}`).join(', ')}`,
    `  characters by pack: ${AUDIO_PACKS.map((p) => `${p} ${chars(rows.filter((r) => r.pack === p))}`).join(', ')}`,
  ];
  const reasons = count(skipped, (s) => s.reason);
  lines.push(`  skipped (never generated, AC-B3): ${skipped.length} occurrences`);
  for (const reason of Object.keys(SKIP_REASONS)) {
    if (!reasons.has(reason)) continue;
    const texts = uniqueSorted(skipped.filter((s) => s.reason === reason).map((s) => s.text));
    const head = texts.slice(0, 8).map((t) => `"${t}"`).join(', ');
    lines.push(`    ${reason} ${reasons.get(reason)} (${texts.length} texts): ${head}${texts.length > 8 ? ', ...' : ''}`);
  }
  return lines;
}
