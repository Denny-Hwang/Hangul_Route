import { z } from 'zod';
import { composeSyllable, decomposeSyllable, type SyllableParts } from './romanization/hangul';
import { romanize, romanizeWord } from './romanization/rr';

/**
 * The structural reading of a lesson body that the F-CURR-002 lint rules (§9.3) need:
 * quests with their steps and scopes, and the notes. It is deliberately lax. A Volume 1
 * cell is still checked in full by `LessonCellSchema`; a Volume 2 cell (row CM-40) and a
 * pack level (row CM-50a) get their strict schemas from those rows. The rules here read
 * only what this shape guarantees, so they hold for every kind of lesson file from day one.
 */
const LaxStepSchema = z
  .object({
    kind: z.string(),
    minigameKind: z.string().optional(),
    minigameRef: z.string().optional(),
    discover: z
      .object({ pages: z.array(z.object({ items: z.array(z.record(z.unknown())) }).passthrough()) })
      .passthrough()
      .optional(),
  })
  .passthrough();
const LaxScopeSchema = z.object({ ref: z.string(), kind: z.string() }).passthrough();
const LaxQuestSchema = z
  .object({ id: z.string(), steps: z.array(LaxStepSchema), scopes: z.array(LaxScopeSchema).default([]) })
  .passthrough();
const LaxSourceSchema = z.object({ publisher: z.string(), url: z.string(), accessed: z.string() }).passthrough();
const LaxNoteSchema = z
  .object({
    id: z.string(),
    kind: z.string().default('culture'),
    sources: z.array(LaxSourceSchema).optional(),
    factRef: z.string().optional(),
  })
  .passthrough();

export const LessonBodySchema = z
  .object({
    id: z.string(),
    stage: z.string().regex(/^stage[1-7]$/),
    volume: z.number().int().min(1).optional(),
    quests: z.array(LaxQuestSchema).min(1),
    culture: z.array(LaxNoteSchema).default([]),
    rewardCardIds: z.array(z.string()).default([]),
  })
  .passthrough();
export type LessonBody = z.output<typeof LessonBodySchema>;
export type LessonBodyQuest = LessonBody['quests'][number];
export type LessonBodyScope = LessonBodyQuest['scopes'][number];
export type LessonBodySource = z.output<typeof LaxSourceSchema>;

/** `content/episodes/stage-<n>/<theme>.json`, or `<theme>.v<k>.json` for volume k (row CM-40). */
export const LESSON_FILE_RE = /^content\/episodes\/stage-([2-467])\/(letters|life|rites|nature|crafts)(?:\.v([0-9]+))?\.json$/;
/** A file directly in a pack directory, `content/packs/<key>/<name>` (row CM-50a). */
export const PACK_FILE_RE = /^content\/packs\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([^/]+)$/;
/** The one file under `content/packs/` outside a pack directory (§6.2 pack order, row CM-50a). */
export const PACK_ORDER_FILE = 'content/packs/order.json';
/** A pack level's file name inside its directory. */
export const PACK_LEVEL_NAME_RE = /^stage-([2-467])\.json$/;
export const STORY_FILE_RE = /^content\/stories\/[^/]+\.json$/;

/** The lesson bodies of a content tree (cells of every volume and pack levels), with their stage number. */
export function lessonBodies(tree: ReadonlyMap<string, unknown>): Array<{ file: string; stage: number; body: LessonBody }> {
  const out: Array<{ file: string; stage: number; body: LessonBody }> = [];
  for (const [file, raw] of tree) {
    const pack = PACK_FILE_RE.exec(file);
    const match = LESSON_FILE_RE.exec(file) ?? (pack === null ? null : PACK_LEVEL_NAME_RE.exec(pack[2] as string));
    const parsed = match === null ? undefined : LessonBodySchema.safeParse(raw);
    if (parsed?.success === true) out.push({ file, stage: Number((match as RegExpExecArray)[1]), body: parsed.data });
  }
  return out.sort((a, b) => (a.file < b.file ? -1 : 1));
}

export const stageNumberOf = (stage: string): number => Number(stage.slice('stage'.length));

// ---- Korean text ------------------------------------------------------------------------------------

const EDGE_PUNCTUATION = /^["'“”‘’(]+|[.!?~…,"'“”‘’)]+$/g;

/** The comparison form of taught Korean: NFC, single spaces, no edge punctuation. */
export function normalizeKo(ko: string): string {
  return ko.normalize('NFC').replace(/\s+/g, ' ').trim().replace(EDGE_PUNCTUATION, '').trim();
}

/** Every string under a `ko` key, depth first, normalized; empty strings dropped. */
export function koStrings(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) koStrings(v, out);
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'ko' && typeof child === 'string') {
        const ko = normalizeKo(child);
        if (ko !== '') out.push(ko);
      } else koStrings(child, out);
    }
  }
  return out;
}

const koOf = (value: unknown): string | undefined => koStrings(value)[0];

// ---- taught units -----------------------------------------------------------------------------------

/** What a Discover item teaches, as the pack template counts it (§6.4). */
export type TaughtUnitKind = 'word' | 'sentence' | 'pattern' | 'exchange';
export interface TaughtUnit {
  /** The item's identity until review-item ids exist (row CM-10): its normalized Korean. */
  key: string;
  kind: TaughtUnitKind;
  /** The Korean the item shows (a pattern's examples, an exchange's lines). */
  texts: string[];
}

function unitsOf(item: Record<string, unknown>): TaughtUnit[] {
  const one = (kind: TaughtUnitKind, key: string | undefined, texts: string[]): TaughtUnit[] =>
    key === undefined ? [] : [{ key, kind, texts }];
  switch (item.type) {
    case 'jamo':
      return one('word', typeof item.jamoId === 'string' ? item.jamoId : undefined, koStrings(item.example));
    case 'word':
      return one('word', koOf(item.word), koStrings(item.word));
    case 'sentence':
      return one('sentence', koOf(item.sentence), koStrings(item.sentence));
    case 'pattern':
      return one('pattern', koOf(item.frame), koStrings(item.examples));
    case 'exchange': {
      const lines = koStrings(item.lines);
      return one('exchange', lines.length > 0 ? lines.join(' / ') : undefined, lines);
    }
    default:
      // A realia's key words, and any item kind a later row adds: each Korean string is a word.
      return koStrings(item).map((ko) => ({ key: ko, kind: 'word' as const, texts: [ko] }));
  }
}

/** The units the quest's Discover pages teach, in page order, each key once. */
export function questUnits(quest: LessonBodyQuest): TaughtUnit[] {
  const seen = new Set<string>();
  const units: TaughtUnit[] = [];
  for (const step of quest.steps) {
    for (const page of step.discover?.pages ?? []) {
      for (const item of page.items) {
        for (const unit of unitsOf(item)) {
          if (seen.has(unit.key)) continue;
          seen.add(unit.key);
          units.push(unit);
        }
      }
    }
  }
  return units;
}

/** The scope a step plays, or undefined when the step plays none (or names a missing scope). */
export function scopeOfStep(quest: LessonBodyQuest, kind: string): LessonBodyScope | undefined {
  const step = quest.steps.find((s) => s.kind === kind);
  return step?.minigameRef === undefined ? undefined : quest.scopes.find((s) => s.ref === step.minigameRef);
}

/** The game kind a step plays (the step's minigameKind, else its scope's kind). */
export function stepGameKind(quest: LessonBodyQuest, kind: string): string | undefined {
  const step = quest.steps.find((s) => s.kind === kind);
  return step?.minigameKind ?? scopeOfStep(quest, kind)?.kind;
}

/** Keys whose Korean is never an answer: wrong tiles, the particle pair, the drawn realia sheet. */
const UNASKED_KEYS = new Set(['distractors', 'particle', 'realia']);

/**
 * The Korean a scope asks for and accepts as right, normalized: a round's prompt, target,
 * sentence or frame and its answer. A wrong option (a Listen & Pick or Realia Read option that is
 * not `answerId`, a Tap to Respond reply that is not `correct`, a distractor tile) is shown but
 * not taught, so a word seen only as a wrong option is still new when a later quest teaches it.
 */
export function askedKo(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) askedKo(v, out);
    return out;
  }
  if (typeof value !== 'object' || value === null) return out;
  const record = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(record)) {
    if (UNASKED_KEYS.has(key)) continue;
    if (key === 'options' && Array.isArray(child) && 'answerId' in record) {
      askedKo(child.filter((o) => typeof o === 'object' && o !== null && (o as Record<string, unknown>).id === record.answerId), out);
    } else if (key === 'replies' && Array.isArray(child)) {
      askedKo(child.filter((r) => typeof r === 'object' && r !== null && (r as Record<string, unknown>).correct === true), out);
    } else if (key === 'ko' && typeof child === 'string') {
      const ko = normalizeKo(child);
      if (ko !== '') out.push(ko);
    } else askedKo(child, out);
  }
  return out;
}

/** What the quest teaches: its Discover units' keys and texts, and the answers its rounds ask for. */
export function questKnownAfter(quest: LessonBodyQuest): string[] {
  return [...questUnits(quest).flatMap((u) => [u.key, ...u.texts]), ...askedKo(quest.scopes)];
}

/** The distinct Korean the quest's Practice and Check rounds ask for (the `lesson-recycle` items). */
export function practiceCheckItems(quest: LessonBodyQuest): string[] {
  const scopes = ['practice', 'check'].map((kind) => scopeOfStep(quest, kind)).filter((s) => s !== undefined);
  return [...new Set(askedKo(scopes))];
}

// ---- pronunciation ----------------------------------------------------------------------------------

/**
 * A key equal for two spellings that sound the same: the F-CNT-002 converter is
 * pronunciation based (coda neutralisation, liaison, palatalisation, nasalisation), so
 * 낫, 낮 and 낯 all give `nat`, and 같이 and 가치 both give `gachi`. Spaces are not heard.
 */
export function pronunciationKey(ko: string): string {
  return romanize(normalizeKo(ko)).text.replace(/\s+/g, '').toLowerCase();
}

/** Finals that split when the next block starts with ㅇ: [kept, moved]; ㄲ and ㅆ move whole. */
const LIAISON_SPLIT: Readonly<Record<string, readonly [string, string]>> = {
  'ㄳ': ['ㄱ', 'ㅅ'], 'ㄵ': ['ㄴ', 'ㅈ'], 'ㄶ': ['ㄴ', 'ㅎ'], 'ㄺ': ['ㄹ', 'ㄱ'], 'ㄻ': ['ㄹ', 'ㅁ'],
  'ㄼ': ['ㄹ', 'ㅂ'], 'ㄽ': ['ㄹ', 'ㅅ'], 'ㄾ': ['ㄹ', 'ㅌ'], 'ㄿ': ['ㄹ', 'ㅍ'], 'ㅀ': ['ㄹ', 'ㅎ'],
  'ㅄ': ['ㅂ', 'ㅅ'], 'ㄲ': ['', 'ㄲ'], 'ㅆ': ['', 'ㅆ'],
};

/** A word of Hangul syllable blocks read block by block, with only liaison and coda neutralisation: how it is spelled. */
function spelledReading(word: string): string {
  // Every character is a syllable block (the caller strips the rest), so each one decomposes.
  const blocks = [...word].map((ch) => decomposeSyllable(ch) as SyllableParts);
  for (let i = 0; i < blocks.length - 1; i++) {
    const cur = blocks[i] as SyllableParts;
    const next = blocks[i + 1] as SyllableParts;
    if (next.initial !== 'ㅇ' || cur.final === '' || cur.final === 'ㅇ') continue;
    const [kept, moved] = LIAISON_SPLIT[cur.final] ?? ['', cur.final];
    cur.final = kept;
    next.initial = moved;
  }
  let out = '';
  for (const block of blocks) {
    // Every moved final is a valid initial, so each block composes and romanizes.
    const piece = romanizeWord(composeSyllable(block) as string) as string;
    // ㄹㄹ is written ll in RR without any change of sound (빨리 ppalli).
    out += out.endsWith('l') && piece.startsWith('r') ? `l${piece.slice(1)}` : piece;
  }
  return out;
}

/** Finals heard as a stop ([ㄱ], [ㄷ], [ㅂ]), including the clusters of verb stems (읽다, 넓다, 앉다, 삶다). */
const OBSTRUENT_FINALS = new Set(['ㄱ', 'ㄲ', 'ㅋ', 'ㄳ', 'ㄺ', 'ㄷ', 'ㅅ', 'ㅆ', 'ㅈ', 'ㅊ', 'ㅌ', 'ㅂ', 'ㅍ', 'ㅄ', 'ㄼ', 'ㄾ', 'ㄿ', 'ㄵ', 'ㄻ']);
/** Initials that turn tense after such a final. */
const TENSING_INITIALS = new Set(['ㄱ', 'ㄷ', 'ㅂ', 'ㅅ', 'ㅈ']);

/** Tensification (경음화), which RR does not write: 학교 [학꾜], 읽다 [익따], 식당 [식땅]. */
function hasTensification(word: string): boolean {
  const blocks = [...word].map((ch) => decomposeSyllable(ch) as SyllableParts);
  return blocks.some((cur, i) => {
    const next = blocks[i + 1];
    return next !== undefined && OBSTRUENT_FINALS.has(cur.final) && TENSING_INITIALS.has(next.initial);
  });
}

/**
 * True when the standard pronunciation differs from the spelling by more than liaison and
 * coda neutralisation (palatalisation 같이 [가치], nasalisation 국물 [궁물], ㅎ deletion 좋아 [조아],
 * tensification 학교 [학꾜]). Changes the converter does not model and the spelling does not
 * show (ㄴ-insertion: 십육 [심뉵]; tensification after ㄹ or a nasal in a compound: 물고기
 * [물꼬기], 눈사람 [눈싸람]) need the explicit `soundChange: true` flag on the round.
 */
export function hasSoundChange(ko: string): boolean {
  return normalizeKo(ko)
    .split(' ')
    .map((word) => word.replace(/[^가-힣]/g, ''))
    .some((word) => hasTensification(word) || spelledReading(word) !== romanizeWord(word));
}
