import { z } from 'zod';
import { hasSoundChange, normalizeKo, pronunciationKey } from '../lesson-lint-items';
import { romanize } from '../romanization/rr';
import { SLOT_MARKER } from '../schemas/quest';
import { ThemeKeySchema } from '../schemas/heritage-card';
import type { ItemOccurrence, KoLine, ReviewSymbol } from './extract';
import {
  ReviewItemIdSchema,
  type ReviewFormat,
  type ReviewItem,
  type ReviewItemKind,
} from './review-item';

/**
 * Frozen review-item ids (F-CURR-002 §4.2 and the `items-stable-id` rule of §9.3, row CM-10),
 * build time only.
 *
 * An item's identity is its **key**: its kind and its Korean (NFC, spaces collapsed, edge
 * punctuation dropped), with the sense of a homograph and an exchange's reply. A new item gets an
 * id from its key (`deriveId`); from then on the committed snapshot (`items-stable-id.json`)
 * holds it, so the id never changes again, whatever later rows change in the derivation:
 *
 *   - `ids`      an item's key -> its frozen id;
 *   - `alias`    a key an edited string now gives -> the frozen id it keeps (the item keeps its
 *                learner state);
 *   - `retired`  ids a re-authoring row removed from every round: never selected for review,
 *                state kept for reports, out of every mastery denominator.
 *
 * The build fails when a frozen id is no longer taught and no alias or retirement says why, so an
 * edited string can never silently change an id (`stableIdIssues`).
 */

export const StableIdSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    ids: z.record(z.string().min(3), ReviewItemIdSchema),
    alias: z.record(z.string().min(3), ReviewItemIdSchema).default({}),
    retired: z.array(ReviewItemIdSchema).default([]),
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    const seen = new Map<string, string>();
    for (const [key, id] of Object.entries(snapshot.ids)) {
      const other = seen.get(id);
      if (other !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ids', key], message: `${id} is frozen for ${other} already` });
      seen.set(id, key);
    }
  });
export type StableIdSnapshot = z.output<typeof StableIdSnapshotSchema>;

export const EMPTY_SNAPSHOT: StableIdSnapshot = Object.freeze({ schemaVersion: 1, ids: {}, alias: {}, retired: [] }) as StableIdSnapshot;

// ---- topic words and senses (content/vocab) ------------------------------------------------------------

/** A topic word as the merge needs it (content/vocab/<topic>.json `items[]`). */
export interface TopicWord {
  id: string;
  ko: string;
  en: string;
  senseGroup?: string;
  visual?: string;
}

/** content/vocab/_senses.json `groups[]`. */
export interface SenseGroup {
  group: string;
  members: readonly { id: string; en: string; state: string }[];
}

interface SenseCandidate {
  id: string;
  en: string;
  /** The topic word, when the sense is one (`launch`); a `reserved` sense has none. */
  word?: TopicWord;
}

export interface VocabIndex {
  /** Topic words by Korean, when only one topic word is spelled so. */
  words: ReadonlyMap<string, TopicWord>;
  /** The senses a homograph's Korean can take, when it can take more than one. */
  senses: ReadonlyMap<string, readonly SenseCandidate[]>;
  byId: ReadonlyMap<string, TopicWord>;
}

/**
 * The topic words and the homographs. A spelling is a homograph when two or more senses share
 * it: the topic words spelled so, plus the reserved senses of a group whose topic words all
 * share that spelling (배 = belly, boat and the reserved pear). A group of different spellings
 * (older-sister: 언니 and 누나) holds no homograph.
 */
export function vocabIndex(words: readonly TopicWord[], groups: readonly SenseGroup[]): VocabIndex {
  const byKo = new Map<string, TopicWord[]>();
  for (const w of words) byKo.set(normalizeKo(w.ko), [...(byKo.get(normalizeKo(w.ko)) ?? []), w]);
  const byId = new Map(words.map((w) => [w.id, w]));
  const senses = new Map<string, SenseCandidate[]>();
  for (const [ko, spelled] of byKo) {
    const candidates: SenseCandidate[] = spelled.map((w) => ({ id: w.id, en: w.en, word: w }));
    const inGroups = new Set(spelled.map((w) => w.senseGroup).filter((g): g is string => g !== undefined));
    for (const group of groups.filter((g) => inGroups.has(g.group))) {
      const launched = group.members.filter((m) => byId.has(m.id)).map((m) => byId.get(m.id) as TopicWord);
      if (!launched.every((w) => normalizeKo(w.ko) === ko)) continue;
      for (const m of group.members) if (!byId.has(m.id)) candidates.push({ id: m.id, en: m.en });
    }
    if (candidates.length > 1) senses.set(ko, candidates);
  }
  const single = new Map([...byKo].filter(([ko, list]) => list.length === 1 && !senses.has(ko)).map(([ko, list]) => [ko, list[0] as TopicWord]));
  return { words: single, senses, byId };
}

const glossNorm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(a|an|the|to) /, '');
const glossTerms = (s: string): string[] => s.split(/[,;/]/).map(glossNorm).filter((t) => t !== '');

/**
 * The sense a homograph's gloss names: the candidate whose English (any of its comma-separated
 * terms) is a term of the gloss, the earliest term winning (다리 "leg, bridge" is the leg).
 */
export function senseFor(gloss: string | undefined, candidates: readonly SenseCandidate[]): SenseCandidate | undefined {
  if (gloss === undefined) return undefined;
  const terms = glossTerms(gloss);
  let best: { at: number; c: SenseCandidate } | undefined;
  for (const c of candidates) {
    for (const t of glossTerms(c.en)) {
      const at = terms.indexOf(t);
      if (at >= 0 && (best === undefined || at < best.at)) best = { at, c };
    }
  }
  return best?.c;
}

/** `vocab:bae-pear` in group bae -> `pear`; a member id outside its group's prefix keeps its whole slug. */
function senseSlug(memberId: string, ko: string, index: VocabIndex): string {
  const slug = memberId.slice('vocab:'.length);
  const group = index.byId.get(memberId)?.senseGroup ?? [...index.byId.values()].find((w) => normalizeKo(w.ko) === ko)?.senseGroup;
  return group !== undefined && slug.startsWith(`${group}-`) ? slug.slice(group.length + 1) : slug;
}

// ---- keys and derived ids ------------------------------------------------------------------------------

const MAX_SLUG = 48;

/** The F-CNT-002 romanization of Korean as an id slug: a frame's `___` reads `n`, `을/를` both forms. */
export function koSlug(ko: string): string {
  const text = ko.split(SLOT_MARKER).join(' n ').replace(/\//g, ' ');
  const slug = romanize(text)
    .text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug === '') return 'item';
  if (slug.length <= MAX_SLUG) return slug;
  const cut = slug.slice(0, MAX_SLUG + 1);
  const at = cut.lastIndexOf('-');
  return at > 0 ? cut.slice(0, at) : slug.slice(0, MAX_SLUG);
}

const refSlug = (ref: string): string => ref.slice(ref.indexOf(':') + 1);

export interface Identity {
  key: string;
  kind: ReviewItemKind;
  /** The id a new item would take (before a collision suffix). */
  derived: string;
  /** A topic word's own id: the item reuses it. */
  vocabId?: string;
}

export type StableIdIssueCode =
  | 'sense-missing'
  | 'not-frozen'
  | 'vanished'
  | 'retired-taught'
  | 'retired-unknown'
  | 'alias-target-unknown'
  | 'alias-clash'
  | 'id-taken';

export interface StableIdIssue {
  code: StableIdIssueCode;
  id?: string;
  key?: string;
  /** `<file> <path>` of the occurrence the issue is about (none for an issue of the snapshot itself). */
  at?: string;
  /** The cell or story of that occurrence. */
  cell?: string;
  message: string;
}

/** The identity of one occurrence (its kind already final), or the issue that keeps it from having one. */
export function identityOf(occ: ItemOccurrence, vocab: VocabIndex): Identity | StableIdIssue {
  const ko = normalizeKo(occ.ko);
  switch (occ.kind) {
    case 'sym':
    case 'rea': {
      const ref = occ.ref as string;
      return { key: `${occ.kind}|${ref}`, kind: occ.kind, derived: `${occ.kind}:${refSlug(ref)}` };
    }
    case 'exc': {
      const reply = normalizeKo((occ.reply as KoLine).ko);
      return { key: `exc|${ko}|${reply}`, kind: 'exc', derived: `exc:${koSlug(ko)}` };
    }
    case 'lex': {
      const candidates = vocab.senses.get(ko);
      if (candidates !== undefined) {
        const sense = senseFor(occ.en, candidates);
        if (sense === undefined) {
          return {
            code: 'sense-missing',
            at: occ.at,
            cell: occ.cell,
            key: `lex|${ko}`,
            message:
              `${ko} is a homograph (${candidates.map((c) => c.en).join(' / ')}) and its gloss ${JSON.stringify(occ.en ?? '')} names none of them: ` +
              'gloss it with one sense, or add the sense to content/vocab/_senses.json (F-CURR-002 §4.2)',
          };
        }
        const slug = senseSlug(sense.id, ko, vocab);
        return {
          key: `lex|${ko}~${slug}`,
          kind: 'lex',
          derived: `lex:${koSlug(ko)}~${slug}`,
          ...(sense.word !== undefined ? { vocabId: sense.word.id } : {}),
        };
      }
      const word = vocab.words.get(ko);
      return { key: `lex|${ko}`, kind: 'lex', derived: `lex:${koSlug(ko)}`, ...(word !== undefined ? { vocabId: word.id } : {}) };
    }
    default:
      return { key: `${occ.kind}|${ko}`, kind: occ.kind, derived: `${occ.kind}:${koSlug(ko)}` };
  }
}

const isIssue = (v: Identity | StableIdIssue): v is StableIdIssue => 'code' in v;

/** A collision suffix: `lex:nat` -> `lex:nat~2`, `lex:bae~pear` -> `lex:bae~pear-2`. */
function variant(id: string, n: number): string {
  return id.includes('~') ? `${id}-${n}` : `${id}~${n}`;
}

// ---- merge ---------------------------------------------------------------------------------------------

const THEMES: readonly string[] = ThemeKeySchema.options;

/** Route order of a cell: its stage, its theme, Stage 1 and the lesson cells before the stories, then the id. */
function cellRank(occ: ItemOccurrence): [number, number, number, string] {
  const story = occ.cell.startsWith('story:') ? 1 : 0;
  const theme = THEMES.indexOf(occ.home);
  return [occ.stage, story, theme < 0 ? THEMES.length : theme, occ.cell];
}
const compareRank = (a: ItemOccurrence, b: ItemOccurrence): number => {
  const [x, y] = [cellRank(a), cellRank(b)];
  for (let i = 0; i < x.length; i++) {
    const [p, q] = [x[i] as number | string, y[i] as number | string];
    if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
};

const TILE_COUNT = (ko: string): number => normalizeKo(ko).split(' ').length;
const TYPEABLE = /^[가-힣]+( [가-힣]+)*$/;
const BUILDABLE = /^[가-힣]{1,6}$/;

/**
 * The formats an item allows (§4.3 rungs by kind, §4.5 `dictation-unambiguous`). Dictation (Type
 * Hangul `hear`, the "hear mode" of §4.5) needs one spelling for the sound and no sound change. A
 * heard round with spelling options (`hear-pick`) needs one spelling too, unless its prompt can show
 * the item's picture or gloss, which settles it: an item with a homophone and neither is never
 * asked by ear. The review engine (row CM-13) shows that picture or gloss in such an item's heard
 * round.
 */
export function allowedFormats(item: Pick<ReviewItem, 'kind' | 'ko' | 'en' | 'picture' | 'soundChange' | 'homophoneOf' | 'reply'>): ReviewFormat[] {
  const ko = normalizeKo(item.ko);
  const heard: ReviewFormat[] = item.homophoneOf.length > 0 && item.picture === undefined && item.en === undefined ? [] : ['hear-pick'];
  switch (item.kind) {
    case 'sym':
      return ['hear-pick', 'read-pick', 'syllable-build', 'match-shape'];
    case 'syl':
      return [...heard, 'read-pick', 'syllable-build'];
    case 'lex': {
      const out: ReviewFormat[] = [...heard, 'read-pick'];
      if (TYPEABLE.test(ko) && ko.length <= 12) {
        out.push('type-see');
        if (item.picture !== undefined) out.push('type-picture');
        // Heard only when its pronunciation has one spelling among the taught items and no sound change (§4.5).
        if (!item.soundChange && item.homophoneOf.length === 0) out.push('dictation');
      }
      if (BUILDABLE.test(ko)) out.push('syllable-build');
      return out;
    }
    case 'pat': {
      // A frame (with ___) is read and filled, never heard or built whole.
      if (ko.includes(SLOT_MARKER)) return ['read-pick', 'cloze-pick'];
      const tiles = TILE_COUNT(ko);
      const out: ReviewFormat[] = [...heard, 'read-pick'];
      if (tiles >= 2) out.push('cloze-pick');
      if (tiles >= 2 && tiles <= 6) out.push('sentence-builder');
      return out;
    }
    case 'exc': {
      const tiles = TILE_COUNT((item.reply as KoLine).ko);
      return tiles >= 2 && tiles <= 6 ? ['hear-pick', 'read-pick', 'sentence-builder'] : ['hear-pick', 'read-pick'];
    }
    case 'rea':
      return ['read-pick', 'cloze-pick'];
  }
}

/** A retired item as the chunk keeps it for reports (§4.2): its id and the Korean its frozen key names. */
export interface RetiredItem {
  id: string;
  ko: string;
  romanization: string;
}

/**
 * The Korean a frozen key names, with its romanization: the text of a word, block, sentence or
 * exchange line (without a homograph's sense), a symbol's character (from the symbol table), and
 * for a realia card's reading skill, whose key is its realia ref, that ref.
 */
export function labelOfKey(key: string, symbols: readonly ReviewSymbol[]): { ko: string; romanization: string } {
  const [kind = '', text = ''] = key.split('|');
  if (kind === 'sym') {
    const symbol = symbols.find((s) => s.id === text);
    return symbol === undefined ? { ko: text, romanization: text } : { ko: symbol.char, romanization: symbol.romanization };
  }
  if (kind === 'rea' || text === '') return { ko: text || key, romanization: text || key };
  const ko = text.replace(/~[a-z0-9-]+$/, '');
  return { ko, romanization: romanize(ko).text };
}

export interface ReviewItemsBuild {
  /** The items, in route order of the first cell that teaches each. */
  items: ReviewItem[];
  /** The retired items, by id, for the chunk's retired table. */
  retired: RetiredItem[];
  issues: StableIdIssue[];
  /** Every occurrence with the id it went to (the coverage test reads it). */
  placed: { occ: ItemOccurrence; id: string }[];
  /** The ids of the snapshot plus the new ones (what `--freeze` writes); never fewer than the snapshot holds. */
  frozen: StableIdSnapshot;
}

/**
 * The review items of all occurrences, with their frozen ids, and every issue the
 * `items-stable-id` rule reports (an empty list: the snapshot holds exactly what is taught).
 */
export function buildReviewItems(
  occurrences: readonly ItemOccurrence[],
  snapshot: StableIdSnapshot,
  vocab: VocabIndex,
  symbols: readonly ReviewSymbol[] = [],
): ReviewItemsBuild {
  const issues: StableIdIssue[] = [];
  // A round's bare word is a pattern when a Discover page teaches the same Korean as one.
  const taughtPatterns = new Set(occurrences.filter((o) => o.kind === 'pat' && o.source === 'discover').map((o) => normalizeKo(o.ko)));
  const occs = [...occurrences]
    .map((o, i) => ({ o: o.loose === true && taughtPatterns.has(normalizeKo(o.ko)) ? { ...o, kind: 'pat' as const } : o, i }))
    .sort((a, b) => compareRank(a.o, b.o) || a.i - b.i)
    .map(({ o }) => o);

  const groups = new Map<string, { identity: Identity; list: ItemOccurrence[] }>();
  for (const occ of occs) {
    const identity = identityOf(occ, vocab);
    if (isIssue(identity)) {
      issues.push(identity);
      continue;
    }
    const group = groups.get(identity.key);
    if (group === undefined) groups.set(identity.key, { identity, list: [occ] });
    else group.list.push(occ);
  }

  const frozenIds = new Set(Object.values(snapshot.ids));
  const retired = new Set(snapshot.retired);
  for (const id of snapshot.retired) {
    if (!frozenIds.has(id)) issues.push({ code: 'retired-unknown', id, message: `retired id ${id} is not a frozen id of the snapshot` });
  }
  for (const [key, id] of Object.entries(snapshot.alias)) {
    if (!frozenIds.has(id)) issues.push({ code: 'alias-target-unknown', id, key, message: `the alias ${JSON.stringify(key)} points at ${id}, which is not a frozen id` });
  }
  const taken = new Set([...frozenIds, ...snapshot.retired]);
  const used = new Map<string, string>();
  const ids = new Map<string, string>();
  for (const [key, { identity, list }] of groups) {
    const first = list[0] as ItemOccurrence;
    const fixed = snapshot.alias[key] ?? snapshot.ids[key];
    let id = fixed;
    if (id === undefined) {
      const base = identity.vocabId ?? identity.derived;
      id = base;
      for (let n = 2; taken.has(id) || used.has(id); n++) {
        if (identity.vocabId !== undefined) {
          issues.push({ code: 'id-taken', id: base, key, message: `the topic word id ${base} is frozen for another item; give ${key} an alias` });
          break;
        }
        id = variant(base, n);
      }
      issues.push({ code: 'not-frozen', id, key, at: first.at, cell: first.cell, message: `${id} (${key}) is a new review item: run node scripts/build-review-items.mjs --freeze and commit items-stable-id.json` });
    }
    const other = used.get(id);
    if (other !== undefined) {
      issues.push({
        code: 'alias-clash',
        id,
        key,
        message: `${key} and ${other} both give ${id}: an alias can only keep an id whose own text is no longer taught`,
      });
      continue;
    }
    if (retired.has(id)) issues.push({ code: 'retired-taught', id, key, at: first.at, cell: first.cell, message: `${id} is retired but taught again (${key}): take it off the retired list` });
    used.set(id, key);
    ids.set(key, id);
  }
  for (const [key, id] of Object.entries(snapshot.ids)) {
    if (retired.has(id) || used.has(id)) continue;
    issues.push({
      code: 'vanished',
      id,
      key,
      message:
        `${id} (${key}) is no longer taught. If its text was edited, keep the id with an alias in items-stable-id.json ` +
        `("alias": { "<the new key>": "${id}" }); if a re-authoring row removed it from every round, add ${id} to "retired" (F-CURR-002 §4.2)`,
    });
  }

  // Where a text is glossed: its Korean and English -> the first overlay field that holds that English.
  const glossAt = new Map<string, string>();
  for (const occ of occs) {
    for (const line of [occ, occ.reply]) {
      if (line?.en === undefined || line.glossKey === undefined) continue;
      const k = glossText(line.ko, line.en);
      if (!glossAt.has(k)) glossAt.set(k, line.glossKey);
    }
  }
  for (const word of vocab.byId.values()) {
    const k = glossText(word.ko, word.en);
    if (!glossAt.has(k)) glossAt.set(k, `${word.id}#gloss`);
  }
  const items: ReviewItem[] = [];
  const placed: { occ: ItemOccurrence; id: string }[] = [];
  for (const [key, { identity, list }] of groups) {
    const id = ids.get(key);
    if (id === undefined) continue;
    for (const occ of list) placed.push({ occ, id });
    items.push(mergeGroup(id, identity, list, vocab, glossAt));
  }
  const keyOfId = new Map(Object.entries(snapshot.ids).map(([key, id]) => [id, key]));
  const retiredItems = [...retired].sort().map((id): RetiredItem => ({ id, ...labelOfKey(keyOfId.get(id) ?? id, symbols) }));
  homophones(items);
  for (const item of items) item.formats = allowedFormats(item);

  const next: Record<string, string> = { ...snapshot.ids };
  for (const [key, id] of ids) if (snapshot.alias[key] === undefined && next[key] === undefined) next[key] = id;
  const frozen: StableIdSnapshot = {
    schemaVersion: 1,
    ids: Object.fromEntries(Object.entries(next).sort(([ka, a], [kb, b]) => (a < b ? -1 : a > b ? 1 : ka < kb ? -1 : 1))),
    alias: snapshot.alias,
    retired: snapshot.retired,
  };
  return { items, retired: retiredItems, issues, placed, frozen };
}

const glossText = (ko: string, en: string): string => `${normalizeKo(ko)}|${en}`;

/**
 * One item from the occurrences of its key (in route order), the first Discover one leading. Its
 * cells are the first cell that asks it, the first grid cell that asks it (when a story came
 * first: a story has no mastery ring), and every cell whose Discover page shows it; a later cell
 * that only asks it again is `asked` (§4.4: its denominator does not hold the item). Its English and
 * its gloss key come from one occurrence, so the overlay translates that English; when that one has
 * no key, the first field anywhere that glosses the same Korean with the same English.
 */
function mergeGroup(id: string, identity: Identity, list: readonly ItemOccurrence[], vocab: VocabIndex, glossAt: ReadonlyMap<string, string>): ReviewItem {
  const first = list[0] as ItemOccurrence;
  const lead = list.find((o) => o.source === 'discover') ?? first;
  const glossed = list.find((o) => o.en !== undefined && o.source === 'discover') ?? list.find((o) => o.en !== undefined);
  const word = identity.vocabId === undefined ? undefined : vocab.byId.get(identity.vocabId);
  const inOrder = [...new Set(list.map((o) => o.cell))];
  const discovered = new Set(list.filter((o) => o.source === 'discover').map((o) => o.cell));
  const firstEpisode = inOrder.find((cell) => cell.startsWith('episode:'));
  const cells = inOrder.filter((cell, i) => i === 0 || cell === firstEpisode || discovered.has(cell));
  const teaching = list.filter((o) => cells.includes(o.cell));
  const item: ReviewItem = {
    id,
    kind: identity.kind,
    ko: lead.ko,
    romanization: lead.romanization !== '' ? lead.romanization : (list.find((o) => o.romanization !== '')?.romanization ?? romanize(lead.ko).text),
    home: first.home,
    stage: Math.min(...teaching.map((o) => o.stage)),
    volume: Math.min(...teaching.map((o) => o.volume)),
    cells,
    asked: inOrder.filter((cell) => !cells.includes(cell)),
    formats: [],
    soundChange: list.some((o) => o.soundChange === true) || (identity.kind !== 'sym' && identity.kind !== 'rea' && hasSoundChange(lead.ko)),
    homophoneOf: [],
  };
  const en = word?.en ?? glossed?.en;
  if (en !== undefined) item.en = en;
  const sameEnglish = (o: { en?: string; glossKey?: string }): boolean => o.glossKey !== undefined && o.en === glossed?.en;
  const glossKey =
    word !== undefined
      ? `${word.id}#gloss`
      : glossed === undefined
        ? undefined
        : (glossed.glossKey ?? list.find(sameEnglish)?.glossKey ?? glossAt.get(glossText(lead.ko, glossed.en as string)));
  if (glossKey !== undefined) item.glossKey = glossKey;
  const picture = list.find((o) => o.picture !== undefined)?.picture ?? (word?.visual !== undefined && !word.visual.startsWith('swatch:') ? word.visual : undefined);
  if (picture !== undefined) item.picture = picture;
  if (identity.kind === 'exc') {
    const reply = { ...((list.find((o) => o.reply?.glossKey !== undefined) ?? lead).reply as KoLine) };
    const replyKey = reply.en === undefined || reply.glossKey !== undefined ? undefined : glossAt.get(glossText(reply.ko, reply.en));
    if (replyKey !== undefined) reply.glossKey = replyKey;
    item.reply = reply;
  }
  return item;
}

/** Fills `homophoneOf`: words, blocks and sentences spelled apart and said alike (낫 / 낮 / 낯; 같이 / 가치). */
function homophones(items: ReviewItem[]): void {
  const bySound = new Map<string, ReviewItem[]>();
  for (const item of items) {
    if (item.kind !== 'lex' && item.kind !== 'syl' && item.kind !== 'pat') continue;
    if (normalizeKo(item.ko).includes(SLOT_MARKER)) continue;
    const sound = pronunciationKey(item.ko);
    bySound.set(sound, [...(bySound.get(sound) ?? []), item]);
  }
  for (const list of bySound.values()) {
    for (const item of list) {
      const spelling = normalizeKo(item.ko);
      item.homophoneOf = list
        .filter((o) => normalizeKo(o.ko) !== spelling)
        .map((o) => o.id)
        .sort();
    }
  }
}
