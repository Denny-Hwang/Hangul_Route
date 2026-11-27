// Reads the content records the audio scripts need. The recording-script helpers at the top use plain node (no
// TypeScript loader, F-CNT-002 C1): the jamo records from the factory calls in src/content/jamo.ts (parseJamoSource,
// checked against the real jamoAll by a unit test) and the vocabulary topics from content/vocab/*.json. The clip
// manifest's readers at the end (AMENDMENTS-AUDIO-CLIPS AC-2) also import TypeScript content through
// scripts/ts-loader.mjs, on demand.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AUDIO_REF_PATTERN, jamoClipRefs, parseJamoSource } from './lib.mjs';

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

// ---- every spoken Korean text, for the clip manifest (AMENDMENTS-AUDIO-CLIPS AC-B5 step 1, AC-2) ----------------
// One occurrence per place a text appears: `{ pack, source, ko, spokenKo?, audioRef?, path }`. The manifest builder
// (tts/build-manifest.mjs) turns them into rows; nothing above changes. The JSON content is read as JV-3 reads it
// (readShippedContent, walkKoTexts); the TypeScript content (the jamo records, the Stage 1 quests and their game
// scopes, the heritage cards) and the review items are read through scripts/ts-loader.mjs.

/**
 * The pack of each shipped content file (AMENDMENTS-AUDIO-CLIPS AC-B6), or null for a file the manifest reads from
 * TypeScript instead: the Stage 1 letter records (spoken through jamoVoice) and cards (the shipped `heritageCardsAll`).
 */
const CONTENT_FILE_PACKS = [
  { file: /^content\/episodes\/stage-1\//, pack: null },
  { file: /^content\/episodes\/stage-([2-7])\//, pack: (m) => `stage${m[1]}` },
  // [PV] The level check's sentence families (AMENDMENTS-PLC-VALIDITY S5, row PV-1c): data of the placement lint, never
  // spoken (the templates in sentences.json carry the sentences the voice says).
  { file: /^content\/placement\/sentence-families\.json$/, pack: null },
  { file: /^content\/placement\//, pack: () => 'placement' },
  { file: /^content\/vocab\//, pack: () => 'vocab' },
  { file: /^content\/stories\//, pack: () => 'stories' },
];

/** The pack a shipped content file's texts belong to; null when the manifest reads that content elsewhere. */
export function packOfContentFile(file) {
  const rel = String(file).split('\\').join('/');
  for (const rule of CONTENT_FILE_PACKS) {
    const m = rule.file.exec(rel);
    if (m) return rule.pack === null ? null : rule.pack(m);
  }
  throw new Error(`${rel}: no clip pack for this content file (add it to CONTENT_FILE_PACKS in content-sources.mjs)`);
}

const pathText = (path) => path.map(String).join('.');

/**
 * One occurrence of a KoText-like value at `path` of `origin` (a content file, or the id of a quest, a game scope, a
 * card or a review item). `source` names the origin only, so moving a text inside its file leaves the manifest as it is;
 * `path` stays on the occurrence for the rules that depend on the place (a particle choice is a template fragment).
 */
function occurrenceOf(pack, origin, path, text, audioRef) {
  const occ = { pack, source: origin, ko: text.ko, path: pathText(path) };
  if (typeof text.spokenKo === 'string' && text.spokenKo.trim() !== '') occ.spokenKo = text.spokenKo;
  const ref = typeof text.audioRef === 'string' && text.audioRef !== '' ? text.audioRef : audioRef;
  if (ref !== undefined) occ.audioRef = ref;
  return occ;
}

/**
 * Every KoText of the shipped content JSON files (JV-3's walker), with its pack. A vocabulary word carries its clip
 * path (its own `audioRef`, else the one derived from its id, as scripts/build-vocab.mjs does).
 */
export function contentOccurrences(files) {
  const out = [];
  for (const { file, data } of files) {
    const pack = packOfContentFile(file);
    if (pack === null) continue;
    walkKoTexts(data, (text, path) => {
      const vocabWord = pack === 'vocab' && path.length === 2 && path[0] === 'items' && typeof text.id === 'string' && text.id.startsWith('vocab:');
      out.push(occurrenceOf(pack, file, path, text, vocabWord ? `audio/vocab/${text.id.slice('vocab:'.length)}.mp3` : undefined));
    });
  }
  return out;
}

let tsLoaderRegistered = false;
/** Registers scripts/ts-loader.mjs once, so plain node can import the repo's TypeScript (F-I18N-001 §3.10). */
export async function registerTsLoader() {
  if (tsLoaderRegistered) return;
  const { register } = await import('node:module');
  register(pathToFileURL(join(repoRoot, 'scripts/ts-loader.mjs')));
  tsLoaderRegistered = true;
}

/** Imports a TypeScript module of the repo (a path relative to the repo root) through scripts/ts-loader.mjs. */
export async function importRepoTs(rel) {
  await registerTsLoader();
  return import(pathToFileURL(join(repoRoot, rel)).href);
}

/**
 * The jamo clips (AMENDMENTS-AUDIO-CLIPS section 5): for every record of `jamoAll` (pack jamo-s1) and
 * `jamoWordBuilder` (jamo-wb), its sound question and, when its name has its own clip, its letter question, as
 * `jamoVoice` says them. Records that share a clip (the six t-finals, ㅋ/ㄲ with ㄱ, ㅍ with ㅂ) give one entry each;
 * the builder merges them by ref.
 */
export function jamoClipVoicesOf(stage1Records, wordBuilderRecords, jamoVoice) {
  const out = [];
  const add = (records, pack) => {
    for (const j of records) {
      const sound = jamoVoice(j, 'sound');
      if (sound.audioRef === undefined) throw new Error(`${j.id}: no sound clip ref (AC-1 gives every jamo record one)`);
      out.push({ ref: sound.audioRef, kind: 'jamo-sound', text: sound.text, pack, source: `${j.id}#sound` });
      if (j.kind === 'batchim') continue;
      const name = jamoVoice(j, 'letter');
      if (name.audioRef !== undefined && name.audioRef !== sound.audioRef) {
        out.push({ ref: name.audioRef, kind: 'jamo-name', text: name.text, pack, source: `${j.id}#letter` });
      }
    }
  };
  add(stage1Records, 'jamo-s1');
  add(wordBuilderRecords, 'jamo-wb');
  return out;
}

/**
 * The Stage 1 quests (pack stage1): every KoText of `stage1Quests` (the Discover example words) and of the game
 * scopes their steps name (`minigameScopes`), and the Korean labels of a story-sequence scope. A jamo item is spoken
 * through jamoVoice (the jamo clips), so its lone letter is listed and skipped by the builder.
 */
export function stage1OccurrencesOf(stage1Quests, minigameScopes) {
  const out = [];
  const visit = (origin) => (text, path) => out.push(occurrenceOf('stage1', origin, path, text));
  for (const quest of stage1Quests) {
    walkKoTexts(quest.steps, visit(quest.id), ['steps']);
    for (const step of quest.steps) {
      if (typeof step.minigameRef !== 'string') continue;
      const scope = minigameScopes[step.minigameRef];
      if (scope === undefined) throw new Error(`${quest.id}: no game scope ${step.minigameRef}`);
      walkKoTexts(scope, visit(step.minigameRef));
      (scope.storySteps ?? []).forEach((s, i) => {
        if (typeof s.labelKo === 'string') out.push(occurrenceOf('stage1', step.minigameRef, ['storySteps', i, 'labelKo'], { ko: s.labelKo }));
      });
    }
  }
  return out;
}

/** The heritage cards (pack cards): a card's Korean name, `subtitleKo`, is what its Hear button says. */
export function cardOccurrencesOf(cards) {
  return cards
    .filter((card) => typeof card.subtitleKo === 'string' && card.subtitleKo.trim() !== '')
    .map((card) => occurrenceOf('cards', card.id, ['subtitleKo'], { ko: card.subtitleKo }));
}

/** The review items (pack review): each item's Korean and, for a dialogue item, its reply's. */
export function reviewOccurrencesOf(items) {
  const out = [];
  for (const item of items) {
    out.push(occurrenceOf('review', item.id, ['ko'], { ko: item.ko }));
    if (item.reply && typeof item.reply.ko === 'string') out.push(occurrenceOf('review', item.id, ['reply', 'ko'], { ko: item.reply.ko }));
  }
  return out;
}

// ---- the contrast-set catalogue (AMENDMENTS-MINIMAL-PAIRS section 3.1 and 3.4, row MP-1a) --------------------------
// content/audio/contrast-sets.json lists the sets a Listen & Pick contrast round may play. It is a manifest source:
// each member whose clip is not a jamo clip is an occurrence of the pack of its unit's quest, so a text no round has
// used yet still gets a manifest row (and a pack), and a clip warms with the quest that plays it.

export const CONTRAST_SETS_FILE = 'content/audio/contrast-sets.json';
export const CONTRAST_SET_SERIES = ['k', 't', 'p', 'c', 's'];
export const CONTRAST_MEMBER_KINDS = ['plain', 'aspirated', 'tense'];
const SET_ID = /^[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)+$/;
/** `minigame:s1-life-q3-pairs`: the game scope that plays a set; stage 1, theme life, quest 3 of the cell. */
const UNIT = /^minigame:s([1-7])-([a-z]+)-(q[0-9]+)-pairs$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The quest and the clip pack of a set's unit, read from the unit's name (`minigame:s1-life-q3-pairs` ->
 * `quest:stage1-life-q3`, pack `stage1`), or null for a unit of another shape.
 */
export function contrastUnitInfo(unit) {
  const m = UNIT.exec(String(unit));
  if (m === null) return null;
  return { stage: Number(m[1]), quest: `quest:stage${m[1]}-${m[2]}-${m[3]}`, pack: `stage${m[1]}` };
}

/**
 * Validates a parsed content/audio/contrast-sets.json and returns it; throws naming the set and the field. The rules
 * of section 3.1 that need the manifest or the content (decodability, the first consonant, refs that are rows) are
 * checked by the catalogue's test.
 */
export function parseContrastSets(json, file = CONTRAST_SETS_FILE) {
  const fail = (message) => {
    throw new Error(`${file}: ${message}`);
  };
  if (json === null || typeof json !== 'object' || Array.isArray(json)) fail('not an object');
  if (json.schemaVersion !== 1) fail('schemaVersion must be 1');
  if (!Array.isArray(json.sets) || json.sets.length === 0) fail('sets must be a non-empty array');
  const ids = new Set();
  for (const set of json.sets) {
    const id = set?.id;
    if (typeof id !== 'string' || !SET_ID.test(id)) fail(`set id ${JSON.stringify(id)} must be kebab-case with at least two parts (ga-ka)`);
    if (ids.has(id)) fail(`set ${id} is listed twice`);
    ids.add(id);
    const where = `set ${id}`;
    const extra = Object.keys(set).filter((k) => !['id', 'series', 'unit', 'members', 'approval', 'lapsed'].includes(k));
    if (extra.length > 0) fail(`${where} has unknown fields ${extra.join(', ')}`);
    if (!CONTRAST_SET_SERIES.includes(set.series)) fail(`${where}: series must be one of ${CONTRAST_SET_SERIES.join(', ')}`);
    if (contrastUnitInfo(set.unit) === null) fail(`${where}: unit "${set.unit}" must look like minigame:s1-life-q3-pairs`);
    if (!Array.isArray(set.members) || set.members.length < 2 || set.members.length > 3) fail(`${where}: members must be two or three clips`);
    const texts = new Set();
    const refs = new Set();
    for (const m of set.members) {
      for (const k of ['text', 'romanization', 'en', 'ref', 'kind']) if (typeof m?.[k] !== 'string' || m[k] === '') fail(`${where}: every member needs a non-empty ${k}`);
      const extraMember = Object.keys(m).filter((k) => !['text', 'romanization', 'en', 'ref', 'kind'].includes(k));
      if (extraMember.length > 0) fail(`${where}: member ${m.text} has unknown fields ${extraMember.join(', ')}`);
      if (!CONTRAST_MEMBER_KINDS.includes(m.kind)) fail(`${where}: member ${m.text} kind must be one of ${CONTRAST_MEMBER_KINDS.join(', ')}`);
      if (!AUDIO_REF_PATTERN.test(m.ref)) fail(`${where}: member ${m.text} ref "${m.ref}" is not a clip ref`);
      if (texts.has(m.text) || refs.has(m.ref)) fail(`${where}: member ${m.text} repeats a text or a clip`);
      texts.add(m.text);
      refs.add(m.ref);
    }
    if (set.approval !== undefined) {
      const a = set.approval;
      if (typeof a?.date !== 'string' || !DAY.test(a.date)) fail(`${where}: approval.date must be YYYY-MM-DD`);
      if (!Number.isInteger(a.plays) || !Number.isInteger(a.correct) || a.correct > a.plays) fail(`${where}: approval needs integer plays and correct (correct <= plays)`);
      const keys = Object.keys(a.mp3Sha256 ?? {}).sort();
      if (JSON.stringify(keys) !== JSON.stringify([...refs].sort())) fail(`${where}: approval.mp3Sha256 must name exactly the members' refs`);
      for (const sha of Object.values(a.mp3Sha256)) if (!SHA256.test(String(sha))) fail(`${where}: approval.mp3Sha256 values must be sha256`);
    }
    if (set.lapsed !== undefined && (typeof set.lapsed?.date !== 'string' || !DAY.test(set.lapsed.date) || typeof set.lapsed?.reason !== 'string' || set.lapsed.reason === '')) {
      fail(`${where}: lapsed needs a date (YYYY-MM-DD) and a reason`);
    }
  }
  return json;
}

/** The committed catalogue, validated. */
export function readContrastSets(root = repoRoot) {
  return parseContrastSets(JSON.parse(readFileSync(join(root, CONTRAST_SETS_FILE), 'utf8')));
}

/** Whether a member's clip is a jamo clip (the sound Discover plays): already a manifest row, never a say occurrence. */
export const isJamoRef = (ref) => String(ref).startsWith('audio/jamo/');

/**
 * The catalogue's say texts, one occurrence per member whose clip is not a jamo clip, in the pack of the unit's quest
 * with the unit as its source (AMENDMENTS-MINIMAL-PAIRS section 3.4). The manifest's rule then gives a text to the
 * first pack that uses it, so a clip the catalogue names as quest 6's moves to `stage1`.
 */
export function contrastOccurrencesOf(catalogue) {
  const out = [];
  for (const set of catalogue.sets) {
    const { pack } = contrastUnitInfo(set.unit);
    set.members.forEach((member, i) => {
      if (isJamoRef(member.ref)) return;
      out.push(occurrenceOf(pack, set.unit, ['sets', set.id, 'members', i], { ko: member.text }));
    });
  }
  return out;
}

// ---- the Hangul Check's decode item pool (AMENDMENTS-STAGE1-DECODING-CHECK section 3.4, row DC-2b) ------------------
// apps/mobile/src/logic/stage1/decode-items.json lists the syllables a decode item plays: every option of its `items`
// (clips shipped today) and of its `awaitingClips` (the blocks DC-2c's owner run generates). It is a manifest source:
// each option is an occurrence of the pool's pack with the file as its source, so a block no content says yet gets a
// manifest row (said with a full stop) in that pack, and a block another pack already owns stays there (the first-pack
// rule): the Hangul Check opens the pool's pack as a scope (`packsUpTo`), which loads every pack before it too.

export const DECODE_ITEMS_FILE = 'apps/mobile/src/logic/stage1/decode-items.json';
const DECODE_ID = /^decode:[a-z]+$/;
const ONE_BLOCK = /^[가-힣]$/u;

/**
 * Validates a parsed decode-items.json and returns it; throws naming the item and the field. The language rules (the
 * balanced set, the contrasts, the practised blocks, the clips) are the pool test's
 * (`apps/mobile/src/logic/stage1/__tests__/decode-items.test.ts`).
 */
export function parseDecodeItems(json, file = DECODE_ITEMS_FILE) {
  const fail = (message) => {
    throw new Error(`${file}: ${message}`);
  };
  if (json === null || typeof json !== 'object' || Array.isArray(json)) fail('not an object');
  if (json.schemaVersion !== 1) fail('schemaVersion must be 1');
  if (typeof json.pack !== 'string' || json.pack === '') fail('pack must name a clip pack');
  const extra = Object.keys(json).filter((k) => !['schemaVersion', 'pack', 'items', 'awaitingClips'].includes(k));
  if (extra.length > 0) fail(`unknown fields ${extra.join(', ')}`);
  const ids = new Set();
  for (const list of ['items', 'awaitingClips']) {
    if (!Array.isArray(json[list])) fail(`${list} must be an array`);
    for (const item of json[list]) {
      const id = item?.id;
      if (typeof id !== 'string' || !DECODE_ID.test(id)) fail(`${list}: id ${JSON.stringify(id)} must look like decode:geu`);
      if (ids.has(id)) fail(`${id} is listed twice`);
      ids.add(id);
      const keys = Object.keys(item).filter((k) => !['id', 'target', 'options'].includes(k));
      if (keys.length > 0) fail(`${id} has unknown fields ${keys.join(', ')}`);
      if (typeof item.target !== 'string' || !ONE_BLOCK.test(item.target)) fail(`${id}: target must be one Hangul block`);
      if (!Array.isArray(item.options) || item.options.length !== 4) fail(`${id}: options must be four blocks`);
      for (const o of item.options) {
        if (typeof o?.ko !== 'string' || !ONE_BLOCK.test(o.ko) || typeof o.romanization !== 'string' || o.romanization === '') fail(`${id}: every option needs one block (ko) and its romanization`);
        const more = Object.keys(o).filter((k) => !['ko', 'romanization'].includes(k));
        if (more.length > 0) fail(`${id}: option ${o.ko} has unknown fields ${more.join(', ')}`);
      }
      if (item.options.filter((o) => o.ko === item.target).length !== 1) fail(`${id}: the target must be exactly one of the options`);
    }
  }
  return json;
}

/** The committed pool, validated. */
export function readDecodeItems(root = repoRoot) {
  return parseDecodeItems(JSON.parse(readFileSync(join(root, DECODE_ITEMS_FILE), 'utf8')));
}

/** The pool's say texts: one occurrence per option of every item (shipped and awaiting), in the pool's pack. */
export function decodeOccurrencesOf(pool, source = DECODE_ITEMS_FILE) {
  const out = [];
  for (const list of ['items', 'awaitingClips']) {
    pool[list].forEach((item, i) => {
      item.options.forEach((o, j) => out.push(occurrenceOf(pool.pack, source, [list, i, 'options', j], { ko: o.ko })));
    });
  }
  return out;
}

/**
 * Every jamo clip voice and every spoken-text occurrence of the shipped content, in a fixed order: the jamo records
 * and the Stage 1 quests, the heritage cards (TypeScript, through ts-loader), the content JSON, and the review items
 * as scripts/build-review-items.mjs builds them.
 */
export async function readClipSources(root = repoRoot) {
  const { jamoAll, jamoWordBuilder } = await importRepoTs('apps/mobile/src/content/jamo.ts');
  const { jamoVoice } = await importRepoTs('apps/mobile/src/logic/audio/jamo-voice.ts');
  const { stage1Quests } = await importRepoTs('apps/mobile/src/content/quests.ts');
  const { minigameScopes } = await importRepoTs('apps/mobile/src/logic/minigame-config.ts');
  const { heritageCardsAll } = await importRepoTs('apps/mobile/src/content/heritage-cards.ts');
  const { buildFromTree } = await import(pathToFileURL(join(repoRoot, 'scripts/build-review-items.mjs')).href);
  const { items } = await buildFromTree(root);
  return {
    jamo: jamoClipVoicesOf(jamoAll, jamoWordBuilder, jamoVoice),
    occurrences: [
      ...stage1OccurrencesOf(stage1Quests, minigameScopes),
      ...contentOccurrences(readShippedContent(root)),
      ...contrastOccurrencesOf(readContrastSets(root)),
      ...decodeOccurrencesOf(readDecodeItems(root)),
      ...reviewOccurrencesOf(items),
      ...cardOccurrencesOf(heritageCardsAll),
    ],
  };
}
