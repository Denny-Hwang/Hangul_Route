// Reads the content records the audio scripts need, with plain node (no
// TypeScript loader, F-CNT-002 C1): the jamo records from the factory calls in
// src/content/jamo.ts (parseJamoSource, checked against the real jamoAll by a
// unit test) and the vocabulary topics from content/vocab/*.json.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jamoClipRefs, parseJamoSource } from './lib.mjs';

export const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const repoRoot = join(appRoot, '..', '..');

export function readJamo() {
  return parseJamoSource(readFileSync(join(appRoot, 'src/content/jamo.ts'), 'utf8'));
}

/** Every jamo clip ref jamo.ts declares, with its pack (AMENDMENTS-AUDIO-CLIPS section 5). */
export function readJamoClipRefs() {
  return jamoClipRefs(readFileSync(join(appRoot, 'src/content/jamo.ts'), 'utf8'));
}

/** Topic files only: `_senses.json` and other `_`-prefixed files are not topics. */
export function readVocabTopics() {
  const dir = join(repoRoot, 'content/vocab');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

/** Every file under `dir`, as paths relative to it. */
export function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (current, prefix) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(join(current, entry.name), rel);
      else if (entry.isFile()) out.push(rel);
    }
  };
  walk(dir, '');
  return out.sort();
}

// ---- spoken Korean in shipped content (AMENDMENTS-AUDIO-CLIPS M8, JV-3) --------------------
// Added for `no-bare-jamo-speech.test.ts` and the content validator's lone-letter rule; AC-2's clip
// manifest walks the same files. Everything above is unchanged.

/** The content folders the app ships (relative to the repo root); research drafts and fixtures are not shipped. */
export const SHIPPED_CONTENT_DIRS = ['content/episodes', 'content/placement', 'content/stories', 'content/vocab'];
const UNSHIPPED_CONTENT_DIRS = ['content/stories/research'];

/** Every shipped content JSON file, as `{ file, data }` with `file` relative to the repo root, sorted. */
export function readShippedContent(root = repoRoot) {
  return SHIPPED_CONTENT_DIRS.flatMap((dir) =>
    listFiles(join(root, dir))
      .filter((rel) => rel.endsWith('.json'))
      .map((rel) => `${dir}/${rel}`)
      .filter((file) => !UNSHIPPED_CONTENT_DIRS.some((skip) => file.startsWith(`${skip}/`))),
  )
    .sort()
    .map((file) => ({ file, data: JSON.parse(readFileSync(join(root, file), 'utf8')) }));
}

/**
 * Calls `visit(text, path)` for every object under `value` with a string `ko` (a KoText, an option,
 * a keyword ...), depth first in key order. `path` holds the keys and array indices from `value`.
 */
export function walkKoTexts(value, visit, path = []) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => walkKoTexts(item, visit, [...path, i]));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (typeof value.ko === 'string') visit(value, path);
  for (const [key, child] of Object.entries(value)) walkKoTexts(child, visit, [...path, key]);
}

/** What the voice says for a text: `spokenKo` when the content has one, else `ko` (F-AUDIO-004). */
export function spokenTextOf(text) {
  return typeof text.spokenKo === 'string' && text.spokenKo.trim() !== '' ? text.spokenKo : text.ko;
}

/** One compatibility jamo (U+3131-318E) or conjoining jamo (U+1100-11FF), trimmed: what a device voice reads by whim. */
export function isLoneLetter(text) {
  return /^[\u3131-\u318E\u1100-\u11FF]$/u.test(String(text).trim());
}

/**
 * Where a lone letter is shown and never spoken, so it needs no `spokenKo`: a file pattern (relative
 * to the repo root) and an object-path pattern (array indices written `[]`). Shared with
 * scripts/validate-content.mjs (rule lone-jamo-without-spokenKo).
 */
export const SHOWN_ONLY_LETTERS = [
  // The Stage 1 letter records: the app speaks a letter through jamoVoice (its name or its sound), never this `ko`.
  { file: /^content\/episodes\/stage-1\/jamo\.json$/, path: /^\[\]$/ },
  // The placement bank: written options and the see-pick-sound prompt are read; the heard prompt is `question.spoken`.
  { file: /^content\/placement\/[^/]+\.json$/, path: /^templates\.\[\]\.question\.(?:options\.\[\]|prompt)$/ },
  // The write-frame keyboard's final tiles (a key the learner types, never a voice).
  { file: /^content\/episodes\/stage-[2-7]\/[^/]+\.json$/, path: /\.soundTable\.finals\.\[\]$/ },
  // Listen & Pick's written options: the learner hears the prompt and picks how it is written.
  { file: /^content\//, path: /(?:^|\.)(?:rounds\.\[\]|round)\.options\.\[\]\.text$/ },
];

/** Whether a lone letter at `path` of `file` is one of the shown-only places above. */
export function isShownOnlyLetter(file, path) {
  const rel = String(file).split('\\').join('/');
  const shape = path.map((seg) => (typeof seg === 'number' || /^\d+$/.test(String(seg)) ? '[]' : String(seg))).join('.');
  return SHOWN_ONLY_LETTERS.some((s) => s.file.test(rel) && s.path.test(shape));
}

/** Every text of `files` whose voice would read a lone letter: `spokenTextOf` is a lone letter outside the shown-only places. */
export function bareLetterSpeech(files) {
  const found = [];
  for (const { file, data } of files) {
    walkKoTexts(data, (text, path) => {
      if (isLoneLetter(spokenTextOf(text)) && !isShownOnlyLetter(file, path)) found.push({ file, path: path.join('.'), ko: text.ko });
    });
  }
  return found;
}
