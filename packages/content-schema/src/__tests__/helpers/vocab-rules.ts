import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROMANIZATION_EXCEPTIONS,
  VOCAB_TOPIC_KEYS,
  VocabSensesFileSchema,
  VocabTopicFileSchema,
  checkConsistency,
  checkRomanization,
  findVocabBannedWord,
  type RomanizationEntry,
  type RomanizationException,
} from '../../index';

/**
 * Rule engine of the vocabulary content gate (F-VOC-001 §3.8). Pure over a
 * `VocabTree` (relative path under `content/` to parsed JSON, or to the raw text
 * when a file does not parse), so the same code checks the shipped tree and the
 * broken fixtures. Lives under `__tests__/` (not shipped, not in coverage).
 */

export const VOCAB_RULE_IDS = [
  'vocab-schema',
  'vocab-file-topic',
  'vocab-count',
  'vocab-id-format',
  'vocab-duplicate-ko',
  'vocab-sense-registry',
  'vocab-romanization',
  'vocab-romanization-consistent',
  'vocab-topic-title-romanization',
  'vocab-visual-grammar',
  'vocab-visual-count',
  'vocab-text-no-hangul',
  'vocab-banned-word',
  'vocab-audio-ref',
  'vocab-overlay',
  'vocab-generated-drift',
] as const;
export type VocabRuleId = (typeof VOCAB_RULE_IDS)[number];

export interface VocabFinding {
  rule: VocabRuleId;
  /** Path relative to `content/` ('' for the generated-module rule, which names its own files). */
  file: string;
  id?: string;
  message: string;
}

/** Relative path under `content/` -> parsed JSON; a `string` means the file did not parse. */
export type VocabTree = Record<string, unknown>;

export interface VocabCheckOptions {
  /** Rule (d) of §3.2. Default: on once a topic file exists for every launch topic key. */
  requireCompleteSet?: boolean;
  /** Locales whose overlays must carry a gloss for every item (`HANGUL_ROUTE_STRICT_LOCALES`). */
  strictLocales?: readonly string[];
  /** Defaults to the shared `ROMANIZATION_EXCEPTIONS`. */
  exceptions?: readonly RomanizationException[];
}

const HANGUL_RE = /\p{Script=Hangul}/u;
const VISUAL_RE = /^(card|word):[a-z0-9-]+$/;
const GENERATED_VISUAL_RE = /^word:(color|count|body)-/;
const EXEMPT_PICTURE_TOPICS: readonly string[] = ['colors', 'numbers', 'body'];
const LAUNCH_ITEMS_PER_TOPIC = 12;
const MIN_HAND_DRAWN = 8;
const OVERLAY_LOCALES: readonly string[] = ['es', 'ko'];
const OVERLAY_ITEM_FIELDS: readonly string[] = ['gloss', 'senseNote'];
const OVERLAY_TOPIC_FIELDS: readonly string[] = ['title', 'blurb', 'hoyaIntro'];

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const recs = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isRec) : []);

interface TopicFile {
  file: string;
  topic: Rec;
  key: string;
  items: Rec[];
}

const slugOf = (romanization: string): string => romanization.replace(/\s+/g, '').toLowerCase();

export function checkVocabTree(tree: VocabTree, options: VocabCheckOptions = {}): VocabFinding[] {
  const findings: VocabFinding[] = [];
  const add = (rule: VocabRuleId, file: string, message: string, id?: string): void => {
    findings.push(id === undefined ? { rule, file, message } : { rule, file, id, message });
  };

  // ---- load: topic files and the registry --------------------------------------
  const topicFiles: TopicFile[] = [];
  let senses: Rec | undefined;
  for (const [file, value] of Object.entries(tree)) {
    if (file.startsWith('vocab/') && file.endsWith('.json')) {
      if (file === 'vocab/_senses.json') {
        if (typeof value === 'string' || !isRec(value)) {
          add('vocab-schema', file, 'not valid JSON or not an object');
          continue;
        }
        const parsed = VocabSensesFileSchema.safeParse(value);
        if (!parsed.success) {
          for (const issue of parsed.error.issues) add('vocab-schema', file, `${issue.path.join('.')}: ${issue.message}`);
        }
        senses = value;
        continue;
      }
      if (typeof value === 'string' || !isRec(value)) {
        add('vocab-schema', file, 'not valid JSON or not an object');
        continue;
      }
      const parsed = VocabTopicFileSchema.safeParse(value);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) add('vocab-schema', file, `${issue.path.join('.')}: ${issue.message}`);
      }
      const topic = isRec(value.topic) ? value.topic : {};
      topicFiles.push({ file, topic, key: str(topic.key) ?? '', items: recs(value.items) });
    }
  }

  const exceptions = options.exceptions ?? ROMANIZATION_EXCEPTIONS;
  const completeSet = options.requireCompleteSet ?? VOCAB_TOPIC_KEYS.every((k) => `vocab/${k}.json` in tree);
  const consistencyEntries: RomanizationEntry[] = [];
  const idOwner = new Map<string, string>();
  const itemsByKo = new Map<string, { id: string; file: string; senseGroup?: string }[]>();
  const allItemIds = new Set<string>();

  // ---- per topic file -----------------------------------------------------------
  for (const { file, topic, key, items } of topicFiles) {
    if (file !== `vocab/${key}.json`) {
      add('vocab-file-topic', file, `file name must be ${key}.json for topic ${key}`);
    }
    if ((VOCAB_TOPIC_KEYS as readonly string[]).includes(key) && items.length !== LAUNCH_ITEMS_PER_TOPIC) {
      add('vocab-count', file, `topic ${key} holds ${items.length} items, a launch topic holds exactly ${LAUNCH_ITEMS_PER_TOPIC}`);
    }

    // topic copy
    for (const field of ['titleEn', 'blurbEn', 'hoyaIntroEn'] as const) {
      checkText(str(topic[field]), `topic ${field}`, file, undefined, add);
    }
    if (isRec(topic.titleKo)) {
      checkText(str(topic.titleKo.en), 'topic titleKo.en', file, undefined, add);
      const ko = str(topic.titleKo.ko);
      const rom = str(topic.titleKo.romanization);
      if (ko !== undefined && rom !== undefined) {
        for (const issue of checkRomanization(ko, rom, { exceptions })) {
          if (issue.severity === 'error') add('vocab-topic-title-romanization', file, issue.message);
        }
        consistencyEntries.push({ ko, romanization: rom, where: `${file} topic title` });
      }
    }
    const topicId = str(topic.id);
    if (topicId !== undefined) allItemIds.add(topicId);

    // items
    let handDrawn = 0;
    for (const item of items) {
      const id = str(item.id);
      const ko = str(item.ko);
      const rom = str(item.romanization);
      const visual = str(item.visual);
      if (id !== undefined) allItemIds.add(id);

      if (id !== undefined) {
        const owner = idOwner.get(id);
        if (owner !== undefined && owner !== file) {
          add('vocab-id-format', file, `duplicate id ${id} (also in ${owner})`, id);
        } else {
          idOwner.set(id, file);
        }
        if (rom !== undefined) {
          const base = `vocab:${slugOf(rom)}`;
          if (id !== base && !id.startsWith(`${base}-`)) {
            add('vocab-id-format', file, `id must be ${base} or ${base}-<sense>, got ${id}`, id);
          }
        }
      }

      const topics = Array.isArray(item.topics) ? item.topics : [];
      if (topics[0] !== key) {
        add('vocab-file-topic', file, `topics[0] is ${JSON.stringify(topics[0])}, the file is topic ${key}`, id);
      }

      if (ko !== undefined && id !== undefined) {
        const list = itemsByKo.get(ko) ?? [];
        list.push({ id, file, senseGroup: str(item.senseGroup) });
        itemsByKo.set(ko, list);
      }

      if (ko !== undefined && rom !== undefined) {
        for (const issue of checkRomanization(ko, rom, { exceptions })) {
          if (issue.severity === 'error') add('vocab-romanization', file, issue.message, id);
        }
        for (const e of exceptions) {
          if (e.ko === ko && e.reason.trim() === '') {
            add('vocab-romanization', file, `${ko}: the exception needs a reason naming the converter limit`, id);
          }
        }
        consistencyEntries.push({ ko, romanization: rom, where: `${file} ${id ?? ''}`.trim() });
      }

      if (visual !== undefined) {
        if (!VISUAL_RE.test(visual)) add('vocab-visual-grammar', file, `visual ${JSON.stringify(visual)} must be card:<id> or word:<key>`, id);
        if (!GENERATED_VISUAL_RE.test(visual)) handDrawn += 1;
      } else {
        add('vocab-visual-grammar', file, 'visual is missing', id);
      }

      checkText(str(item.en), 'en', file, id, add);
      checkText(str(item.senseNote), 'senseNote', file, id, add);

      const audioRef = str(item.audioRef);
      if (audioRef !== undefined && id !== undefined && audioRef !== `audio/vocab/${id.slice('vocab:'.length)}.mp3`) {
        add('vocab-audio-ref', file, `audioRef must be audio/vocab/${id.slice('vocab:'.length)}.mp3, got ${audioRef}`, id);
      }
    }
    if (!EXEMPT_PICTURE_TOPICS.includes(key) && items.length > 0 && handDrawn < MIN_HAND_DRAWN) {
      add('vocab-visual-count', file, `topic ${key} has ${handDrawn} hand-drawn or card pictures, at least ${MIN_HAND_DRAWN} are needed`);
    }
  }

  // ---- across files ---------------------------------------------------------------
  for (const [ko, list] of itemsByKo) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i]!;
        const b = list[j]!;
        const sameGroup = a.senseGroup !== undefined && a.senseGroup === b.senseGroup;
        if (!sameGroup) {
          add('vocab-duplicate-ko', b.file, `${ko} is both ${a.id} and ${b.id}, which are not in one sense group`, b.id);
        }
      }
    }
  }
  for (const issue of checkConsistency(consistencyEntries)) add('vocab-romanization-consistent', '', issue.message);
  // the consistency finding is not tied to one file: name the first origin it cites
  for (const f of findings) {
    if (f.rule === 'vocab-romanization-consistent' && f.file === '') {
      f.file = topicFiles.find((t) => f.message.includes(t.file))?.file ?? topicFiles[0]?.file ?? '';
    }
  }

  checkSenses(senses, topicFiles, completeSet, add);
  checkOverlays(tree, topicFiles, allItemIds, options.strictLocales ?? [], add);
  return findings;
}

function checkText(
  value: string | undefined,
  field: string,
  file: string,
  id: string | undefined,
  add: (rule: VocabRuleId, file: string, message: string, id?: string) => void,
): void {
  if (value === undefined) return;
  if (HANGUL_RE.test(value)) add('vocab-text-no-hangul', file, `${field} must not contain Hangul: ${JSON.stringify(value)}`, id);
  const banned = findVocabBannedWord(value);
  if (banned !== null) add('vocab-banned-word', file, `${field} contains the banned word "${banned}"`, id);
}

// ---- §3.2 sense registry rules (b)-(e); (a) is vocab-duplicate-ko --------------------

function checkSenses(
  senses: Rec | undefined,
  topicFiles: TopicFile[],
  completeSet: boolean,
  add: (rule: VocabRuleId, file: string, message: string, id?: string) => void,
): void {
  const members = new Map<string, { group: string; state: string }>();
  const groups = new Set<string>();
  for (const group of recs(senses?.groups)) {
    const name = str(group.group) ?? '';
    groups.add(name);
    for (const m of recs(group.members)) {
      const id = str(m.id);
      if (id !== undefined) members.set(id, { group: name, state: str(m.state) ?? '' });
    }
  }
  const itemIds = new Set<string>();
  for (const { file, items } of topicFiles) {
    for (const item of items) {
      const id = str(item.id);
      if (id === undefined) continue;
      itemIds.add(id);
      const senseGroup = str(item.senseGroup);
      const member = members.get(id);
      if (senseGroup !== undefined) {
        const listed = member !== undefined && member.group === senseGroup && member.state === 'launch';
        if (!groups.has(senseGroup)) {
          add('vocab-sense-registry', file, `(b) senseGroup ${senseGroup} is not in _senses.json`, id);
        } else if (!listed) {
          add('vocab-sense-registry', file, `(b) _senses.json does not list ${id} as a launch member of ${senseGroup}`, id);
        }
      }
      if (member?.state === 'reserved') {
        add('vocab-sense-registry', file, `(c) ${id} is a reserved id and may not be used by an item`, id);
      }
      if (member?.state === 'launch' && senseGroup !== member.group) {
        add('vocab-sense-registry', file, `(e) ${id} is a launch member of ${member.group} but its senseGroup is ${senseGroup ?? 'missing'}`, id);
      }
    }
  }
  if (completeSet) {
    for (const [id, member] of members) {
      if (member.state === 'launch' && !itemIds.has(id)) {
        add('vocab-sense-registry', 'vocab/_senses.json', `(d) launch member ${id} of ${member.group} has no item`, id);
      }
    }
  }
}

// ---- overlays (F-I18N-001 §3.7 rules, applied to the vocab domain) -----------------------

function checkOverlays(
  tree: VocabTree,
  topicFiles: TopicFile[],
  knownIds: Set<string>,
  strictLocales: readonly string[],
  add: (rule: VocabRuleId, file: string, message: string, id?: string) => void,
): void {
  const itemKo = new Map<string, string>();
  for (const { items } of topicFiles) {
    for (const item of items) {
      const id = str(item.id);
      const ko = str(item.ko);
      if (id !== undefined && ko !== undefined) itemKo.set(id, ko);
    }
  }
  const glossed = new Map<string, Set<string>>(); // `${locale}/${topic}` -> ids with a gloss

  for (const [file, value] of Object.entries(tree)) {
    const m = /^i18n\/([^/]+)\/(vocab-[^/]+)\.json$/.exec(file);
    if (!m) continue;
    const locale = m[1]!;
    const domain = m[2]!;
    const shapeError = (why: string): void => add('vocab-overlay', file, `overlay-bad-shape: ${why}`);
    if (!isRec(value)) {
      shapeError('not a JSON object');
      continue;
    }
    if (!OVERLAY_LOCALES.includes(locale)) shapeError(`locale directory ${locale} is not es or ko`);
    else if (value.locale !== locale) shapeError(`locale ${JSON.stringify(value.locale)} differs from the directory ${locale}`);
    if (value.domain !== domain) shapeError(`domain ${JSON.stringify(value.domain)} differs from the file name ${domain}`);
    if (!isRec(value.entries)) {
      shapeError('entries must be an object');
      continue;
    }
    for (const [id, entry] of Object.entries(value.entries)) {
      if (!knownIds.has(id)) {
        add('vocab-overlay', file, `overlay-unknown-id: ${id} is in no content/vocab file`, id);
        continue;
      }
      const allowed = id.startsWith('vocab-topic:') ? OVERLAY_TOPIC_FIELDS : OVERLAY_ITEM_FIELDS;
      const fields = isRec(entry) ? entry : {};
      for (const [field, text] of Object.entries(fields)) {
        if (!allowed.includes(field)) {
          add('vocab-overlay', file, `overlay-forbidden-field: ${field} cannot be overridden on ${id}`, id);
        }
        if (locale === 'es' && typeof text === 'string' && HANGUL_RE.test(text)) {
          add('vocab-overlay', file, `korean-in-ui-field: Hangul in Spanish ${field} of ${id}`, id);
        }
      }
      const gloss = str(fields.gloss);
      if (locale === 'ko' && gloss !== undefined && gloss.trim() === itemKo.get(id)) {
        add('vocab-overlay', file, `overlay-circular-gloss: the Korean gloss of ${id} repeats the taught word`, id);
      }
      if (gloss !== undefined) {
        const set = glossed.get(`${locale}/${domain}`) ?? new Set<string>();
        set.add(id);
        glossed.set(`${locale}/${domain}`, set);
      }
    }
  }

  for (const locale of strictLocales) {
    for (const { key, items } of topicFiles) {
      const have = glossed.get(`${locale}/vocab-${key}`) ?? new Set<string>();
      for (const item of items) {
        const id = str(item.id);
        if (id !== undefined && !have.has(id)) {
          add('vocab-overlay', `i18n/${locale}/vocab-${key}.json`, `overlay-missing: no ${locale} gloss for ${id}`, id);
        }
      }
    }
  }
}

// ---- generated modules ---------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const GENERATOR = join(HERE, '..', '..', '..', '..', '..', 'scripts', 'build-vocab.mjs');

/** Spawns `build-vocab.mjs --check` against `root` (a repo root, or a materialized tree). */
export function checkVocabGenerated(root: string): VocabFinding[] {
  const run = spawnSync('node', [GENERATOR, '--check'], {
    env: { ...process.env, HANGUL_ROUTE_ROOT: root },
    encoding: 'utf8',
  });
  if (run.status === 0) return [];
  const text = `${run.stdout}${run.stderr}`.trim();
  return [{ rule: 'vocab-generated-drift', file: '', message: text === '' ? `generator exited with ${run.status}` : text }];
}

// ---- tree helpers ----------------------------------------------------------------------

function listJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => e.name)
    .sort();
}

function readParsed(file: string): unknown {
  const text = readFileSync(file, 'utf8');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** Reads `<contentDir>/vocab/*.json` and `<contentDir>/i18n/<locale>/vocab-*.json`. */
export function loadVocabTree(contentDir: string): VocabTree {
  const tree: VocabTree = {};
  for (const name of listJson(join(contentDir, 'vocab'))) {
    tree[`vocab/${name}`] = readParsed(join(contentDir, 'vocab', name));
  }
  const i18n = join(contentDir, 'i18n');
  if (existsSync(i18n)) {
    for (const locale of readdirSync(i18n, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
      for (const name of listJson(join(i18n, locale)).filter((n) => n.startsWith('vocab-'))) {
        tree[`i18n/${locale}/${name}`] = readParsed(join(i18n, locale, name));
      }
    }
  }
  return tree;
}

/** Writes a tree under `<root>/content/` so the generator can run against it. */
export function materializeVocabTree(tree: VocabTree, root: string): void {
  for (const [rel, value] of Object.entries(tree)) {
    const file = join(root, 'content', rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  }
}

export function formatFindings(findings: readonly VocabFinding[], pathPrefix = ''): string {
  return findings
    .map((f) => `${f.rule} | ${f.id ?? '-'} | ${f.file === '' ? '-' : `${pathPrefix}${f.file}`} | ${f.message}`)
    .join('\n');
}

// ---- broken-fixture edits ----------------------------------------------------------------

export type VocabOp =
  | { op: 'set'; file: string; path: string; value: unknown }
  | { op: 'delete'; file: string; path: string }
  | { op: 'put'; file: string; value: unknown }
  | { op: 'remove'; file: string }
  | { op: 'copy'; file: string; to: string }
  | { op: 'rename'; file: string; to: string };

function parent(root: unknown, segments: string[], file: string): Rec | unknown[] {
  let node = root;
  for (const seg of segments) {
    let next: unknown;
    if (Array.isArray(node)) next = node[Number(seg)];
    else if (isRec(node)) next = node[seg];
    if (typeof next !== 'object' || next === null) {
      throw new Error(`${file}: no ${segments.join('.')} (stopped at ${seg})`);
    }
    node = next;
  }
  return node as Rec | unknown[];
}

/** Returns a copy of `tree` with the edits applied in order; throws on a path that does not exist. */
export function applyOps(tree: VocabTree, ops: readonly VocabOp[]): VocabTree {
  const out = structuredClone(tree);
  const need = (file: string): unknown => {
    if (!(file in out)) throw new Error(`${file}: no such file in the tree`);
    return out[file];
  };
  for (const op of ops) {
    if (op.op === 'put') out[op.file] = op.value;
    else if (op.op === 'remove') delete out[op.file];
    else if (op.op === 'copy') out[op.to] = structuredClone(need(op.file));
    else if (op.op === 'rename') {
      out[op.to] = need(op.file);
      delete out[op.file];
    } else {
      const segments = op.path.split('.');
      const last = segments.pop() as string;
      const holder = parent(need(op.file), segments, op.file);
      if (op.op === 'set') {
        if (Array.isArray(holder)) holder[Number(last)] = op.value;
        else holder[last] = op.value;
      } else if (Array.isArray(holder)) holder.splice(Number(last), 1);
      else delete holder[last];
    }
  }
  return out;
}
