import { z } from 'zod';
import { KoTextSchema, PictureRefSchema, type KoText } from './ko-text';
import type { StageKey } from './heritage-card';
import { MinigameKindSchema, type MinigameKind } from './minigame';

/**
 * Quest — learning sequence (per content-skill timing convention).
 * Stage 2 / 4 taste quests: intro → present → practice → apply → reward.
 * Stage 1 quests (F-QUEST-002): intro → discover → practice → apply → check → reward.
 */
export const QuestStepKindSchema = z.enum([
  'intro',
  'present',
  'discover',
  'practice',
  'apply',
  'check',
  'reward',
]);
export type QuestStepKind = z.infer<typeof QuestStepKindSchema>;

/** The slot marker of a sentence frame (F-CURR-001 §3.4, §3.7). */
export const SLOT_MARKER = '___';
/** How many slot markers a frame holds. */
export const slotCount = (frame: string): number => frame.split(SLOT_MARKER).length - 1;

/** A drawn real-world text (menu, ticket, sign, price card), made for the app (F-CURR-001 §3.6). */
export const REALIA_REF_RE = /^realia:[a-z0-9-]+$/;

/** One line of a two-line exchange: a named character and the Korean they say. */
const ExchangeLineSchema = <S extends 'a' | 'b'>(speaker: S) =>
  z.object({
    speaker: z.literal(speaker),
    /** The character's name in the UI language, e.g. "Hoya" (never the learner). */
    speakerEn: z.string().trim().min(1).max(24),
    line: KoTextSchema,
  });

/** Discover (teach before play): one or two new things per page (F-QUEST-002 §3.1). */
export const DiscoverItemSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('jamo'),
    jamoId: z.string().regex(/^jamo:[a-z0-9-]+$/),
    /** A word containing the symbol (reading word or theme word). */
    example: KoTextSchema,
    picture: PictureRefSchema.optional(),
  }),
  z.object({
    type: z.literal('word'),
    word: KoTextSchema,
    picture: PictureRefSchema.optional(),
    noteEn: z.string().max(80).optional(),
  }),
  // ---- upper-stage items (F-CURR-001 §3.10, row C-1), additive ----
  /** A whole sentence (Stage 3 example page), optionally pictured. */
  z.object({
    type: z.literal('sentence'),
    sentence: KoTextSchema,
    picture: PictureRefSchema.optional(),
  }),
  /**
   * A sentence pattern: a frame with one or two slot markers `___` (two for a
   * Stage 7 two-slot frame, a day slot then a food slot in My Holiday Memory q2, F-CURR-001 S7-3;
   * the cell rule in `lesson.ts` keeps two slots to Stage 7), a
   * one-line note in the UI language (Korean only inside `{ko:}` tokens) and two examples.
   */
  z.object({
    type: z.literal('pattern'),
    frame: KoTextSchema.refine((t) => slotCount(t.ko) >= 1 && slotCount(t.ko) <= 2, {
      message: 'a pattern frame has one or two slot markers ___',
      path: ['ko'],
    }),
    noteEn: z.string().trim().min(1).max(120),
    examples: z.tuple([KoTextSchema, KoTextSchema]),
  }),
  /** Two lines of a dialogue, speaker A then speaker B (Stage 4; Read Along highlights each line as it plays). */
  z.object({
    type: z.literal('exchange'),
    lines: z.tuple([ExchangeLineSchema('a'), ExchangeLineSchema('b')]),
  }),
  /** A drawn real-world text and up to six of its key words (Stage 6). */
  z.object({
    type: z.literal('realia'),
    realiaRef: z.string().regex(REALIA_REF_RE),
    keyWords: z.array(KoTextSchema).min(1).max(6),
    captionEn: z.string().trim().min(1).max(90).optional(),
  }),
]);
export type DiscoverItem = z.infer<typeof DiscoverItemSchema>;

/**
 * The taught Korean an item shows, for every consumer that needs "the words of
 * a Discover page" (romanization checks, browse facts, lecture decks): a jamo's
 * example, a word, a sentence, a pattern's two examples (the frame holds a slot
 * marker and is not a word), an exchange's two lines, a realia's key words.
 */
export function discoverItemTexts(item: DiscoverItem): KoText[] {
  switch (item.type) {
    case 'jamo':
      return [item.example];
    case 'word':
      return [item.word];
    case 'sentence':
      return [item.sentence];
    case 'pattern':
      return [...item.examples];
    case 'exchange':
      return item.lines.map((l) => l.line);
    case 'realia':
      return [...item.keyWords];
  }
}

export const DiscoverPageSchema = z.object({
  /** Never more than two new things on one page. */
  items: z.array(DiscoverItemSchema).min(1).max(2),
  captionEn: z.string().max(90).optional(),
});
export type DiscoverPage = z.infer<typeof DiscoverPageSchema>;

export const DiscoverSchema = z.object({ pages: z.array(DiscoverPageSchema).min(1).max(3) });
export type Discover = z.infer<typeof DiscoverSchema>;

export const QuestStepSchema = z.object({
  id: z.string(),
  kind: QuestStepKindSchema,
  titleEn: z.string(),
  bodyEn: z.string().optional(),
  hoyaLineEn: z.string().optional(),
  /**
   * Korean Hoya says, with romanization and gloss (F-CNT-002 §3.5). A structural
   * subset of KoTextSchema; spelled inline because zod 3 cannot `.pick()` a
   * schema that carries a refinement.
   */
  hoyaLineKo: z
    .object({
      ko: z.string().min(1),
      romanization: z.string().min(1),
      en: z.string().min(1),
    })
    .optional(),
  minigameKind: MinigameKindSchema.optional(),
  minigameRef: z.string().optional(),
  discover: DiscoverSchema.optional(),
  durationSeconds: z.number().int().positive().optional(),
});

export type QuestStep = z.infer<typeof QuestStepSchema>;

/** The quest id grammar, `quest:<slug>` (exported for F-BROWSE-001 §4.4 and the lecture blocks). */
export const QUEST_ID_RE = /^quest:[a-z0-9-]+$/;

const SCORED_KINDS: ReadonlySet<QuestStepKind> = new Set(['practice', 'apply', 'check']);

/**
 * The plain quest object: the shape later specs extend (a refined schema is a
 * `ZodEffects` and has no `.extend`); `LessonQuestSchema` (F-CURR-001) adds scopes.
 */
export const QuestObjectSchema = z.object({
  id: z.string().regex(QUEST_ID_RE),
  titleEn: z.string(),
  blurbEn: z.string().optional(),
  /** One plain line for the "Next up" card on Results (F-QUEST-002 §3.5). */
  teaserEn: z.string().max(70).optional(),
  estimatedMinutes: z.number().int().min(3).max(15),
  steps: z.array(QuestStepSchema).min(3).max(7),
  rewardCardId: z.string().optional(),
});

/**
 * The game a Check step may use (F-QUEST-002 T4, amended by F-CURR-001 §3.11):
 * Listen & Pick, or for a `stage7` quest also Sentence Builder (`order-it`),
 * because Stage 7's skill is writing. The Check scope holds exactly 2 rounds.
 */
export const CHECK_ROUNDS = 2;
export function checkKindsFor(stage: StageKey): readonly MinigameKind[] {
  return stage === 'stage7' ? ['listen-pick', 'order-it'] : ['listen-pick'];
}

/** The quest-level step rules (F-QUEST-002 §3.1), shared by `QuestSchema` and `LessonQuestSchema`. */
export function questRules(quest: z.output<typeof QuestObjectSchema>, ctx: z.RefinementCtx): void {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['steps', ...path], message });
  const { steps } = quest;

  steps.forEach((step, i) => {
    if (step.kind === 'discover') {
      if (!step.discover) issue([i, 'discover'], 'a discover step needs its discover pages');
      if (step.minigameKind) issue([i, 'minigameKind'], 'a discover step has no minigame');
      if (step.minigameRef) issue([i, 'minigameRef'], 'a discover step has no minigame');
    } else if (step.discover) {
      issue([i, 'discover'], 'only a discover step carries discover pages');
    }
    if (step.kind === 'check') {
      if (!step.minigameKind) issue([i, 'minigameKind'], 'a check step needs a minigameKind');
      if (!step.minigameRef) issue([i, 'minigameRef'], 'a check step needs a minigameRef');
    }
  });

  const indexesOf = (kind: QuestStepKind) =>
    steps.flatMap((step, i) => (step.kind === kind ? [i] : []));
  const discoverAt = indexesOf('discover');
  const checkAt = indexesOf('check');
  discoverAt.slice(1).forEach((i) => issue([i, 'kind'], 'at most one discover step per quest'));
  checkAt.slice(1).forEach((i) => issue([i, 'kind'], 'at most one check step per quest'));

  const firstDiscover = discoverAt[0];
  if (firstDiscover !== undefined) {
    steps.forEach((step, i) => {
      if (i < firstDiscover && SCORED_KINDS.has(step.kind)) {
        issue([i, 'kind'], 'discover must come before practice, apply and check');
      }
    });
  }

  const rewardAt = indexesOf('reward');
  checkAt.forEach((c) => {
    const playedAfter = steps.some((s, i) => i > c && (s.kind === 'practice' || s.kind === 'apply'));
    const rewardBefore = rewardAt.some((r) => r < c);
    if (playedAfter || rewardBefore) {
      issue([c, 'kind'], 'check must come after practice and apply, and before reward');
    }
  });

  if (checkAt.length > 0 && !steps.some((s) => SCORED_KINDS.has(s.kind) && s.minigameRef)) {
    issue([], 'a quest with a check step needs at least one scored step');
  }
}

export const QuestSchema = QuestObjectSchema.superRefine(questRules);

export type Quest = z.infer<typeof QuestSchema>;
