import { z } from 'zod';
import { PillarTagSchema } from '../pillars';
import { themeOrder } from './episode';
import { StageKeySchema, ThemeKeySchema, type StageKey } from './heritage-card';
import { KoTextSchema } from './ko-text';
import {
  ListenPickRoundSchema,
  OrderItRoundSchema,
  PicWordRoundSchema,
  RealiaReadRoundSchema,
  RealiaSchema,
  TraceWordRoundSchema,
  TypeHangulRoundSchema,
  WriteFrameRoundSchema,
  type MinigameKind,
} from './minigame';
import { CHECK_ROUNDS, checkKindsFor, QuestObjectSchema, questRules, type QuestStepKind } from './quest';
import { CardIdSchema, IsoDateSchema, SourceSchema, VerificationSchema } from './story';

/**
 * Lesson cells (F-CURR-001 §3.10, row C-1): one JSON file per upper-stage grid
 * cell, `content/episodes/stage-<n>/<theme>.json`, holding the episode, its
 * quests, their minigame scopes, the culture and language notes with their
 * sources, and the review record. `scripts/build-lessons.mjs` (row C-2) drops
 * draft cells and compiles the rest into the per-stage lesson modules.
 */

/** Stages that hold lesson cells: Stage 1 is hand-written, Stage 5 holds the story books. */
export const LESSON_STAGES = ['stage2', 'stage3', 'stage4', 'stage6', 'stage7'] as const satisfies readonly StageKey[];
export const LESSON_CELL_ID_RE = /^episode:stage[2-467]-(letters|life|rites|nature|crafts)$/;
/** `minigame:s<n>-<theme>-q<k>-<step>`. */
export const LESSON_SCOPE_REF_RE = /^minigame:s[2-467]-(letters|life|rites|nature|crafts)-q[1-9]-[a-z0-9-]+$/;
/** The six steps of every upper-stage quest, in order (F-CURR-001 §3.1 rule 1). */
export const LESSON_STEP_ORDER: readonly QuestStepKind[] = ['intro', 'discover', 'practice', 'apply', 'check', 'reward'];
/** A note restating a fact a reviewed story already cites: `story:<slug>#<factId>` (§3.9 Reuse). */
export const FACT_REF_RE = /^story:[a-z0-9]+(-[a-z0-9]+)*#f[0-9]{1,3}$/;

const stageNumber = (stage: StageKey): string => stage.slice('stage'.length);

// ---- scopes: the content each game step plays ------------------------------------------------------

const ScopeRefSchema = z.string().regex(LESSON_SCOPE_REF_RE);

/** Tap to Respond: the other speaker's line and the written replies; exactly one is the natural reply. */
export const TapRespondTurnSchema = z
  .object({
    speakerEn: z.string().trim().min(1).max(24),
    line: KoTextSchema,
    replies: z
      .array(z.object({ id: z.string().min(1), text: KoTextSchema, correct: z.boolean() }))
      .min(2)
      .max(4),
  })
  .superRefine((turn, ctx) => {
    if (turn.replies.filter((r) => r.correct).length !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['replies'], message: 'a turn has exactly one natural reply' });
    }
    const ids = turn.replies.map((r) => r.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['replies'], message: 'reply ids must be unique' });
    }
  });
export type TapRespondTurn = z.infer<typeof TapRespondTurnSchema>;

/** Story Sequence on a dialogue: the lines in their right order (the game shuffles them). */
export const SequenceLineSchema = z.object({
  id: z.string().min(1),
  speakerEn: z.string().trim().min(1).max(24).optional(),
  line: KoTextSchema,
});

/** One game step's content, keyed by `ref` (the step's `minigameRef`). `voice-echo` has no lesson scope (§3.1 rule 8). */
export const LessonScopeSchema = z.discriminatedUnion('kind', [
  z.object({ ref: ScopeRefSchema, kind: z.literal('listen-pick'), rounds: z.array(ListenPickRoundSchema).min(1).max(8) }),
  z.object({ ref: ScopeRefSchema, kind: z.literal('pic-word-match'), boards: z.array(PicWordRoundSchema).min(1).max(8) }),
  /** Build a Letter: each word built syllable by syllable; one round per word. */
  z.object({ ref: ScopeRefSchema, kind: z.literal('build-letter'), words: z.array(KoTextSchema).min(1).max(8) }),
  z.object({ ref: ScopeRefSchema, kind: z.literal('card-match'), pairs: z.array(KoTextSchema).min(2).max(8) }),
  z.object({ ref: ScopeRefSchema, kind: z.literal('tap-respond'), turns: z.array(TapRespondTurnSchema).min(1).max(6) }),
  z.object({ ref: ScopeRefSchema, kind: z.literal('story-sequence'), lines: z.array(SequenceLineSchema).min(3).max(6) }),
  z.object({ ref: ScopeRefSchema, kind: z.literal('order-it'), rounds: z.array(OrderItRoundSchema).min(1).max(8) }),
  z.object({
    ref: ScopeRefSchema,
    kind: z.literal('realia-read'),
    realia: RealiaSchema,
    rounds: z.array(RealiaReadRoundSchema).min(1).max(6),
  }),
  z.object({ ref: ScopeRefSchema, kind: z.literal('type-hangul'), rounds: z.array(TypeHangulRoundSchema).min(1).max(6) }),
  z.object({ ref: ScopeRefSchema, kind: z.literal('trace-word'), rounds: z.array(TraceWordRoundSchema).min(1).max(6) }),
  z.object({ ref: ScopeRefSchema, kind: z.literal('write-frame'), rounds: z.array(WriteFrameRoundSchema).min(1).max(4) }),
]);
export type LessonScope = z.infer<typeof LessonScopeSchema>;
export type LessonScopeKind = LessonScope['kind'];
export const LESSON_SCOPE_KINDS: readonly MinigameKind[] = LessonScopeSchema.options.map((o) => o.shape.kind.value);

/**
 * How many rounds (or turns, boards, syllables) a scope plays: the count the
 * §3.1 table and the Check rule read. Build a Letter plays one round per
 * syllable block, as the shipped game and the Stage 1 scopes do, so a word of
 * two syllables is two rounds (`scripts/build-lessons.mjs` emits the same count;
 * a test checks the two agree).
 */
export function scopeRoundCount(scope: LessonScope): number {
  switch (scope.kind) {
    case 'pic-word-match':
      return scope.boards.length;
    case 'build-letter':
      return scope.words.reduce((n, w) => n + [...w.ko].length, 0);
    case 'card-match':
      return scope.pairs.length;
    case 'tap-respond':
      return scope.turns.length;
    case 'story-sequence':
      return 1;
    default:
      return scope.rounds.length;
  }
}

// ---- quests ----------------------------------------------------------------------------------------

export const LessonQuestSchema = QuestObjectSchema.extend({
  scopes: z.array(LessonScopeSchema).min(1).max(4),
}).superRefine(questRules);
export type LessonQuest = z.infer<typeof LessonQuestSchema>;

// ---- notes, sources, review -------------------------------------------------------------------------

/**
 * A culture note, or a language note that is not a plain gloss (§3.9): at least
 * one source in the story `SourceSchema` shape, or a `factRef` to a reviewed
 * story's fact, never both; with its verification record (`scope: 'lesson'`).
 * The source-count bar, the host allow-list and the copy lints are rules of
 * `validate-content.mjs` (row C-2).
 */
export const LessonNoteSchema = z
  .object({
    id: z.string().regex(/^n[0-9]{1,2}$/),
    kind: z.enum(['culture', 'language']),
    /** UI-language text; Korean only inside `{ko:}` tokens. */
    textEn: z.string().trim().min(1).max(240),
    sources: z.array(SourceSchema).min(1).max(8).optional(),
    factRef: z.string().regex(FACT_REF_RE).optional(),
    verification: VerificationSchema,
  })
  .strict()
  .superRefine((note, ctx) => {
    if ((note.sources === undefined) === (note.factRef === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sources'], message: 'a note has sources or a factRef, not both and not neither' });
    }
  });
export type LessonNote = z.infer<typeof LessonNoteSchema>;

/** The two multi-agent review sign-offs (F-STORY-001 tokens, reused; §3.8). */
export const LessonReviewSchema = z
  .object({
    language: z.enum(['draft', 'native-reviewed']),
    culture: z.enum(['draft', 'culture-reviewed']),
    reviewedBy: z.string().trim().min(1).max(8).optional(),
    reviewedAt: IsoDateSchema.optional(),
    notes: z.array(z.string().trim().min(1).max(400)).max(12).default([]),
  })
  .strict();
export type LessonReview = z.infer<typeof LessonReviewSchema>;

/** True when both sign-offs are present: the only state the build lets into the bundle (§3.8). */
export const isLessonSignedOff = (review: LessonReview): boolean =>
  review.language === 'native-reviewed' && review.culture === 'culture-reviewed' && review.reviewedBy !== undefined && review.reviewedAt !== undefined;

// ---- the cell ---------------------------------------------------------------------------------------

export const LessonCellObjectSchema = z
  .object({
    id: z.string().regex(LESSON_CELL_ID_RE),
    stage: StageKeySchema,
    theme: ThemeKeySchema,
    status: z.enum(['draft', 'ready']),
    titleEn: z.string().trim().min(1).max(28),
    subtitleEn: z.string().trim().min(1).max(60),
    hoyaIntroEn: z.string().trim().min(1).max(90),
    order: z.number().int().min(1),
    pillarTags: z.array(PillarTagSchema).min(1),
    rewardCardIds: z.array(CardIdSchema).default([]),
    quests: z.array(LessonQuestSchema).min(3).max(6),
    culture: z.array(LessonNoteSchema).max(12),
    review: LessonReviewSchema,
    contentVer: z.number().int().min(1),
  })
  .strict();

/** Cross-field rules of a cell (ids, step order, scopes, the Check rule, cards, sign-offs). */
export function lessonCellRules(cell: z.output<typeof LessonCellObjectSchema>, ctx: z.RefinementCtx): void {
  const issue = (path: (string | number)[], message: string): void =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  const { stage, theme } = cell;
  const n = stageNumber(stage);

  if (cell.id !== `episode:${stage}-${theme}`) issue(['id'], `a ${stage} ${theme} cell has id episode:${stage}-${theme}`);
  if (cell.order !== themeOrder(theme)) issue(['order'], `a cell in ${theme} has order ${themeOrder(theme)}`);
  if (cell.status === 'ready' && !isLessonSignedOff(cell.review)) {
    issue(['review'], 'lesson-review-unsigned: a ready cell needs both multi-agent review sign-offs, reviewedBy and reviewedAt');
  }
  const noteIds = cell.culture.map((c) => c.id);
  if (new Set(noteIds).size !== noteIds.length) issue(['culture'], 'note ids must be unique');

  cell.quests.forEach((quest, qi) => {
    const at = (...path: (string | number)[]) => ['quests', qi, ...path];
    const prefix = `${stage}-${theme}-q${qi + 1}`;
    if (quest.id !== `quest:${prefix}`) issue(at('id'), `quest ${qi + 1} of this cell has id quest:${prefix}`);

    const kinds = quest.steps.map((s) => s.kind);
    if (kinds.join() !== LESSON_STEP_ORDER.join()) {
      issue(at('steps'), `a lesson quest has the six steps ${LESSON_STEP_ORDER.join(' -> ')}`);
    }
    if (quest.rewardCardId !== undefined && !cell.rewardCardIds.includes(quest.rewardCardId)) {
      issue(at('rewardCardId'), `${quest.rewardCardId} is not in the cell's rewardCardIds`);
    }

    const scopes = new Map<string, LessonScope>();
    quest.scopes.forEach((scope, si) => {
      if (!scope.ref.startsWith(`minigame:s${n}-${theme}-q${qi + 1}-`)) {
        issue(at('scopes', si, 'ref'), `a scope of ${prefix} has a ref starting minigame:s${n}-${theme}-q${qi + 1}-`);
      }
      if (scopes.has(scope.ref)) issue(at('scopes', si, 'ref'), `scope ref ${scope.ref} is listed twice`);
      scopes.set(scope.ref, scope);
    });

    const used = new Set<string>();
    quest.steps.forEach((step, si) => {
      if (step.minigameKind === 'voice-echo') {
        issue(at('steps', si, 'minigameKind'), 'lesson-no-speaking: no lesson step records or asks for speech');
      }
      if (step.minigameRef === undefined) {
        if (step.minigameKind !== undefined) issue(at('steps', si, 'minigameRef'), 'a game step needs a minigameRef');
        return;
      }
      if (used.has(step.minigameRef)) issue(at('steps', si, 'minigameRef'), `${step.minigameRef} is played twice in one quest`);
      used.add(step.minigameRef);
      const scope = scopes.get(step.minigameRef);
      if (scope === undefined) {
        issue(at('steps', si, 'minigameRef'), `${step.minigameRef} has no scope in this quest`);
        return;
      }
      if (scope.kind !== step.minigameKind) {
        issue(at('steps', si, 'minigameKind'), `the step plays ${String(step.minigameKind)} but its scope is ${scope.kind}`);
      }
      if (step.kind === 'check') {
        if (!checkKindsFor(stage).includes(scope.kind)) {
          issue(at('steps', si, 'minigameKind'), `a ${stage} Check plays ${checkKindsFor(stage).join(' or ')}, not ${scope.kind}`);
        }
        if (scopeRoundCount(scope) !== CHECK_ROUNDS) {
          issue(at('steps', si, 'minigameRef'), `a Check holds exactly ${CHECK_ROUNDS} rounds (has ${scopeRoundCount(scope)})`);
        }
      }
    });
    quest.scopes.forEach((scope, si) => {
      if (!used.has(scope.ref)) issue(at('scopes', si, 'ref'), `scope ${scope.ref} is not played by any step`);
    });
  });
}

export const LessonCellSchema = LessonCellObjectSchema.superRefine(lessonCellRules);
/** The parsed cell (defaults applied). */
export type LessonCell = z.output<typeof LessonCellSchema>;
