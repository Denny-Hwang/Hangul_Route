import { z } from 'zod';
import { narrationTokenIds, narrationWordCount } from '../narration';
import { CompanionIdSchema, PillarTagSchema } from '../pillars';
import { ThemeKeySchema } from './heritage-card';
import { KoTextShape, KoTextSchema, refineKoText, type KoText } from './ko-text';
import { SceneArtSchema } from './scene-art';
import { StoryCheckSchema } from './story-check';

/**
 * Story mode: one tale per JSON file, every factual sentence pointing at a
 * cited fact (F-STORY-001 §3.2-§3.7). All objects are strict: an unknown key is
 * an error, never silently dropped. zod 3 cannot discriminate refined schemas,
 * so there is no draft/ready union: one strict object (`StoryObjectSchema`),
 * one cross-field refinement for both states (`StorySchema`) and a second
 * refinement for the ready-only requirements (`StoryReadySchema`).
 */
export const STORY_SCHEMA_VERSION = 1;
/** Owner decision (review 2): author, two checkers, a reviser and a third final pass. */
export const MIN_VERIFICATION_PASSES = 3;
export const NARRATION_MAX_WORDS = 45;

/**
 * `KoTextSchema` with the draft relaxation of §3.2.4: `romanization` and `en`
 * may be '' in a draft (the ready rule makes them required). `extra` adds fields.
 */
export function koTextExtend<T extends z.ZodRawShape>(extra: T) {
  return KoTextShape.extend({
    romanization: z.string().trim().max(120),
    en: z.string().trim().max(200),
    ...extra,
  })
    .strict()
    .superRefine((value, ctx) =>
      refineKoText(value as { romanization: string; syllables?: string[] }, ctx),
    );
}

// ---- small shared schemas -------------------------------------------------

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * The catalogue version a quest joined at (F-CURR-002 §9.1, row CM-6): an integer date stamp
 * YYYYMMDD, such as 20261105. `CATALOG_VERSION` is generated as the largest stamp; the history up to
 * version 32 keeps its integers, all smaller than any stamp. A stamp must not be lower than main's
 * version when its quest is added (scripts/check-added-in.mjs).
 */
export const AddedInSchema = z
  .number()
  .int()
  .min(20260101)
  .max(20991231)
  .refine((stamp) => {
    const y = Math.floor(stamp / 10000);
    const m = Math.floor(stamp / 100) % 100;
    const d = stamp % 100;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, 'addedIn is a calendar date written YYYYMMDD');
export const SceneIdSchema = z.string().regex(/^s[0-9]{1,2}$/);
export const FactIdSchema = z.string().regex(/^f[0-9]{1,3}$/);
export const CardIdSchema = z.string().regex(/^card:[a-z0-9-]+$/); // HeritageCardSchema.id grammar
/** The word cap and the token rules are cross-field rules, so a draft reports them with a path. */
export const NarrationSchema = z.string().trim().min(1).max(320);

export const StoryIdSchema = z.string().regex(/^story:[a-z0-9]+(-[a-z0-9]+)*$/);
export const StoryLevelSchema = z.enum(['listen', 'read-along', 'read']); // F-STORY-003 StoryLevel
export type StoryLevel = z.infer<typeof StoryLevelSchema>;
export const StoryKindSchema = z.enum([
  'folk-tale',
  'myth',
  'fable', // "tale" kinds (traditional-tale rule, §3.5)
  'documentary',
  'site',
  'intangible',
  'object',
  'science',
  'art',
  'daily-life',
]);
export type StoryKind = z.infer<typeof StoryKindSchema>;
export const TALE_KINDS = ['folk-tale', 'myth', 'fable'] as const;

// ---- facts, sources, verification, errata (§3.3, §3.6, §3.7) -----------------

export const SourceSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    publisher: z.string().trim().min(1).max(120),
    url: z.string().url(), // https only: lint source-url-not-https
    accessed: IsoDateSchema,
    quoteOrLocator: z.string().trim().min(1).max(500), // the research key `quote_or_locator`
  })
  .strict();
export type StorySource = z.infer<typeof SourceSchema>;

export const FactSchema = z
  .object({
    id: FactIdSchema,
    rev: z.number().int().min(1).default(1), // bumps when claim or sources change
    scope: z.enum(['documented', 'in-the-tale']).default('documented'),
    claimEn: z.string().trim().min(1).max(600),
    claimKo: z.string().trim().min(1).max(300), // reference zone (Hangul allowed)
    sources: z.array(SourceSchema).min(1).max(8),
  })
  .strict();
export type StoryFact = z.infer<typeof FactSchema>;

export const ApproximationSchema = z
  .object({
    text: z.string().min(1).max(40), // exact substring of the scene's narrationEn
    factIds: z.array(z.string()).min(1).max(3),
    rationaleEn: z.string().trim().min(1).max(160),
    timeRelative: z.boolean().default(false), // true = depends on today's date; re-checked yearly
  })
  .strict();
export type Approximation = z.infer<typeof ApproximationSchema>;

export const VerificationSchema = z
  .object({
    passes: z.number().int().min(0).max(9),
    checkedAt: IsoDateSchema,
    scope: z.enum(['story', 'cluster', 'lesson']).default('story'), // 'lesson': F-CURR-001 §3.9 (additive)
    notes: z.string().trim().min(1).max(3000),
  })
  .strict();
export type StoryVerification = z.infer<typeof VerificationSchema>;

export const ErratumSchema = z
  .object({
    id: z.string().regex(/^e[0-9]{1,3}$/),
    date: IsoDateSchema,
    kind: z.enum(['correction', 'clarification', 'removal']),
    factIds: z.array(z.string()).min(1).max(4),
    summaryEn: z.string().trim().min(1).max(200),
    detailEn: z.string().trim().min(1).max(600).optional(), // maintainer detail; reference zone
    fixedInVer: z.number().int().min(1),
    show: z.boolean().default(true),
  })
  .strict();
export type StoryErratum = z.infer<typeof ErratumSchema>;

// ---- keywords, lines, scenes, tiers (§3.2.2) ---------------------------------

export const KeywordSchema = koTextExtend({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  kind: z.enum(['word', 'term', 'jamo', 'phrase']).default('word'),
  art: z
    .string()
    .regex(/^(prop|card):[a-z0-9-]+$/)
    .optional(),
});
export type StoryKeyword = z.infer<typeof KeywordSchema>;

export const StoryLineSchema = koTextExtend({
  speaker: z.enum(['narrator', 'hoya', 'character']).default('narrator'),
  words: z.array(KoTextSchema).min(2).max(8).optional(),
});
export type StoryLine = z.infer<typeof StoryLineSchema>;

export const SceneSchema = z
  .object({
    id: SceneIdSchema,
    narrationEn: NarrationSchema,
    captionEn: z.string().trim().min(1).max(48).optional(), // required when ready
    keyword: KeywordSchema.optional(),
    line: StoryLineSchema.optional(),
    factIds: z.array(FactIdSchema).max(4).default([]),
    framing: z.boolean().default(false),
    approximations: z.array(ApproximationSchema).max(3).default([]),
    art: SceneArtSchema.optional(),
    artPending: z.boolean().optional(),
    artBrief: z.string().trim().min(1).max(300).optional(),
    cultureNoteId: z.string().optional(),
    checkpointId: z.string().optional(),
    narrationAudioRef: z.string().optional(),
  })
  .strict();
export type StoryScene = z.infer<typeof SceneSchema>;

/** The spec calls this `TierSchema`; `entitlement.ts` already exports that name (free/premium). */
export const StoryTierSchema = z
  .object({
    level: StoryLevelSchema,
    scenes: z.array(SceneSchema).min(4).max(8),
    checks: z.array(StoryCheckSchema).min(3).max(5),
    checkpoints: z.array(StoryCheckSchema).max(2).default([]),
    sequenceSceneIds: z.array(SceneIdSchema).length(4),
    newKeywordIds: z.array(z.string()).max(4),
    grammarFocusEn: z.string().trim().min(1).max(100).optional(),
    connective: KoTextSchema.optional(),
  })
  .strict();
export type StoryTier = z.infer<typeof StoryTierSchema>;

// ---- slots owned by other specs (§3.2.1) ------------------------------------

export const CultureNoteSchema = z
  .object({
    id: z.string().regex(/^cn-[a-z0-9-]+$/),
    titleEn: z.string().trim().min(1).max(60),
    bodyEn: z.string().trim().min(1).max(220),
    term: KoTextSchema, // strict: a note's Korean needs romanization + gloss from the first commit
    cardId: CardIdSchema.optional(),
    factIds: z.array(FactIdSchema).min(1).max(3), // a note without a sourced fact fails CI (D14)
  })
  .strict();
export type CultureNote = z.infer<typeof CultureNoteSchema>;

export const StoryShelfSchema = z
  .object({
    category: z.enum(['story-time', 'culture']),
    order: z.number().int().min(1).max(999),
    sampler: z.boolean().default(false),
    minutes: z.number().int().min(2).max(10),
  })
  .strict();
export type StoryShelf = z.infer<typeof StoryShelfSchema>;

/** F-STORY-006 §3.8; rarity is derived from recommendedStage, not stored. */
export const StoryCardSchema = z
  .object({
    titleEn: z.string().trim().min(1).max(28),
    keywordId: z.string(),
    factId: FactIdSchema,
  })
  .strict();
export type StoryCard = z.infer<typeof StoryCardSchema>;

// ---- the story ----------------------------------------------------------------

export const StoryObjectSchema = z
  .object({
    v: z.literal(1),
    id: StoryIdSchema,
    state: z.enum(['draft', 'ready']),
    contentVer: z.number().int().min(1),
    /** The catalogue version its listen quest joined at; required of a story added after version 32 (CM-6). */
    addedIn: AddedInSchema.optional(),
    title: koTextExtend({}),
    summaryEn: z.string().trim().min(1).max(320),
    hoyaIntroEn: z.string().trim().min(1).max(160).optional(),
    hoyaOutroEn: z.string().trim().min(1).max(160).optional(),
    theme: ThemeKeySchema,
    kind: StoryKindSchema,
    recommendedStage: z.number().int().min(1).max(7),
    minutes: z.number().int().min(2).max(10),
    learningGoalsEn: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
    origin: z
      .object({
        type: z.enum(['traditional', 'adapted', 'original', 'documented']),
        noteEn: z.string().trim().min(1).max(240),
        retellingNoteEn: z.string().trim().min(1).max(240).optional(),
      })
      .strict(),
    review: z
      .object({
        language: z.enum(['draft', 'native-reviewed']),
        culture: z.enum(['draft', 'culture-reviewed']),
        advisory: z
          .array(z.enum(['mild-peril', 'loss', 'trickery', 'war', 'historical-hardship']))
          .default([]),
        advisoryNoteEn: z.string().trim().min(1).max(140).optional(),
        reviewedBy: z.string().trim().min(1).max(8).optional(),
        reviewedAt: IsoDateSchema.optional(),
      })
      .strict(),
    keywords: z.array(KeywordSchema).min(1).max(24),
    cultureNotes: z.array(CultureNoteSchema).max(3),
    tiers: z.array(StoryTierSchema).min(1).max(3),
    coverSceneId: SceneIdSchema,
    rewardCardIds: z
      .object({ listen: CardIdSchema.optional(), read: CardIdSchema.optional() })
      .strict()
      .optional(),
    shelf: StoryShelfSchema.optional(),
    pillarTags: z.array(PillarTagSchema).max(3).default([]),
    companionId: CompanionIdSchema.default('hoya'),
    card: StoryCardSchema.optional(),
    facts: z.array(FactSchema).min(1).max(16),
    referenceDisplay: z.string().trim().min(1).max(300),
    verification: VerificationSchema,
    authorNotes: z.string().trim().max(3000).optional(),
    errata: z.array(ErratumSchema).default([]),
  })
  .strict();

export type Story = z.infer<typeof StoryObjectSchema>;

/**
 * "The scene's Korean": the line, else the keyword. The only way other specs
 * read it (F-STORY-003 `sequence-cards.ts` and `recap.ts`).
 */
export function sceneKorean(scene: Pick<StoryScene, 'keyword' | 'line'>): KoText | undefined {
  return scene.line ?? scene.keyword;
}

// ---- refinements ----------------------------------------------------------------

type Path = Array<string | number>;
const report = (ctx: z.RefinementCtx, path: Path, message: string): void => {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
};

/** Rules run for `draft` and `ready` (§3.2.2 items 1-5; the structural parts of §3.3 C1 and C2). */
function storyCrossFieldRules(story: Story, ctx: z.RefinementCtx): void {
  const factIds = new Set(story.facts.map((f) => f.id));
  const noteIds = new Set(story.cultureNotes.map((n) => n.id));
  const keywordById = new Map<string, StoryKeyword>();
  const phraseByKo = new Map<string, StoryKeyword>();
  for (const k of story.keywords) {
    if (!keywordById.has(k.id)) keywordById.set(k.id, k);
    if (k.kind === 'phrase' && !phraseByKo.has(k.ko)) phraseByKo.set(k.ko, k);
  }
  const checkFact = (path: Path, id: string): void => {
    if (!factIds.has(id)) report(ctx, path, `fact-unknown: ${id} is not in facts[]`);
  };

  if (story.review.advisory.length > 0 && !story.review.advisoryNoteEn) {
    report(ctx, ['review', 'advisoryNoteEn'], 'advisoryNoteEn is required when advisory is not empty');
  }
  if (!story.tiers.some((t) => t.scenes.some((s) => s.id === story.coverSceneId))) {
    report(ctx, ['coverSceneId'], `coverSceneId ${story.coverSceneId} is in no tier`);
  }
  story.cultureNotes.forEach((note, ni) =>
    note.factIds.forEach((id, fi) => checkFact(['cultureNotes', ni, 'factIds', fi], id)),
  );

  const levels = new Set<string>();
  // A check or checkpoint id names one question in the whole story: the locale overlay keys
  // `checks.<id>` / `checkpoints.<id>` carry no tier (F-I18N-001), so one id in two tiers
  // would give both tiers one translation of two different English prompts.
  const checkTier = new Map<string, string>();
  story.tiers.forEach((tier, ti) => {
    const at = (...rest: Path): Path => ['tiers', ti, ...rest];
    if (levels.has(tier.level)) report(ctx, at('level'), 'tier levels must be unique');
    levels.add(tier.level);

    const sceneIndex = new Map<string, number>();
    const usedKeywordIds = new Set<string>();
    const checkpointIds = new Set(tier.checkpoints.map((c) => c.id));

    tier.scenes.forEach((scene, si) => {
      const sat = (...rest: Path): Path => at('scenes', si, ...rest);
      if (sceneIndex.has(scene.id)) report(ctx, sat('id'), `scene ids must be unique in a tier (${scene.id})`);
      else sceneIndex.set(scene.id, si);

      if (tier.level === 'listen') {
        if (Boolean(scene.keyword) === Boolean(scene.line)) {
          report(ctx, sat(), 'a listen scene has exactly one of keyword and line');
        }
      } else if (!scene.line) {
        report(ctx, sat('line'), `a ${tier.level} scene needs a line`);
      }

      if (narrationWordCount(scene.narrationEn) > NARRATION_MAX_WORDS) {
        report(
          ctx,
          sat('narrationEn'),
          `narration-too-long: more than ${NARRATION_MAX_WORDS} words (a {kw:} token is one word)`,
        );
      }
      if (!scene.framing && scene.factIds.length === 0) {
        report(ctx, sat('factIds'), 'scene-without-fact: a non-framing scene cites at least one fact');
      }
      scene.factIds.forEach((id, fi) => checkFact(sat('factIds', fi), id));
      scene.approximations.forEach((a, ai) =>
        a.factIds.forEach((id, fi) => checkFact(sat('approximations', ai, 'factIds', fi), id)),
      );

      if (scene.keyword) {
        const entry = keywordById.get(scene.keyword.id);
        if (!entry) {
          report(ctx, sat('keyword', 'id'), `keyword-inconsistent: ${scene.keyword.id} is not in keywords[]`);
        } else {
          usedKeywordIds.add(entry.id);
          if (entry.ko !== scene.keyword.ko) {
            report(ctx, sat('keyword', 'ko'), `keyword-inconsistent: ko differs from keyword ${entry.id}`);
          }
          if (entry.romanization.toLowerCase() !== scene.keyword.romanization.toLowerCase()) {
            report(
              ctx,
              sat('keyword', 'romanization'),
              `keyword-inconsistent: romanization differs from keyword ${entry.id} (case is ignored)`,
            );
          }
        }
      }
      if (scene.line) {
        const phrase = phraseByKo.get(scene.line.ko);
        if (phrase) {
          usedKeywordIds.add(phrase.id);
          if (phrase.romanization.toLowerCase() !== scene.line.romanization.toLowerCase()) {
            report(
              ctx,
              sat('line', 'romanization'),
              `keyword-inconsistent: romanization differs from phrase keyword ${phrase.id} (case is ignored)`,
            );
          }
        }
      }
      for (const id of narrationTokenIds(scene.narrationEn)) usedKeywordIds.add(id);

      if (scene.cultureNoteId !== undefined && !noteIds.has(scene.cultureNoteId)) {
        report(ctx, sat('cultureNoteId'), `cultureNoteId ${scene.cultureNoteId} is not in cultureNotes[]`);
      }
      if (scene.checkpointId !== undefined && !checkpointIds.has(scene.checkpointId)) {
        report(ctx, sat('checkpointId'), `checkpointId ${scene.checkpointId} is not in this tier's checkpoints`);
      }
    });

    const checkIds = new Set<string>();
    const checkGroups = [
      ['checks', tier.checks],
      ['checkpoints', tier.checkpoints],
    ] as const;
    for (const [group, list] of checkGroups) {
      list.forEach((check, ci) => {
        if (checkIds.has(check.id)) report(ctx, at(group, ci, 'id'), `check ids must be unique in a tier (${check.id})`);
        checkIds.add(check.id);
        const otherTier = checkTier.get(check.id);
        if (otherTier !== undefined && otherTier !== tier.level) {
          report(ctx, at(group, ci, 'id'), `check ids must be unique across tiers (${check.id} is also in the ${otherTier} tier)`);
        }
        if (otherTier === undefined) checkTier.set(check.id, tier.level);
        check.factIds.forEach((id, fi) => checkFact(at(group, ci, 'factIds', fi), id));
      });
    }

    let previous = -1;
    tier.sequenceSceneIds.forEach((id, i) => {
      const index = sceneIndex.get(id);
      if (index === undefined) {
        report(ctx, at('sequenceSceneIds', i), `sequenceSceneIds: ${id} is not a scene of this tier`);
        return;
      }
      if (index <= previous) {
        report(ctx, at('sequenceSceneIds', i), 'sequenceSceneIds must be strictly increasing in scene order');
      }
      previous = index;
    });

    tier.newKeywordIds.forEach((id, i) => {
      if (!keywordById.has(id)) report(ctx, at('newKeywordIds', i), `${id} is not in keywords[]`);
      else if (!usedKeywordIds.has(id)) report(ctx, at('newKeywordIds', i), `${id} is not used in this tier`);
    });
  });
}

/** Extra requirements of `state: 'ready'` (§3.2.2 item 6). */
function storyReadyRules(story: Story, ctx: z.RefinementCtx): void {
  if (!story.title.romanization) report(ctx, ['title', 'romanization'], 'required when ready');
  if (!story.title.en) report(ctx, ['title', 'en'], 'required when ready');
  story.keywords.forEach((k, i) => {
    if (!k.romanization) report(ctx, ['keywords', i, 'romanization'], 'required when ready');
    if (!k.en) report(ctx, ['keywords', i, 'en'], 'required when ready');
  });
  story.tiers.forEach((tier, ti) => {
    tier.scenes.forEach((scene, si) => {
      if (!scene.captionEn) report(ctx, ['tiers', ti, 'scenes', si, 'captionEn'], 'required when ready');
      if (!scene.art && scene.artPending !== true) {
        report(ctx, ['tiers', ti, 'scenes', si, 'art'], 'a ready scene has art or artPending: true');
      }
    });
    const checkGroups = [
      ['checks', tier.checks],
      ['checkpoints', tier.checkpoints],
    ] as const;
    for (const [group, list] of checkGroups) {
      list.forEach((check, ci) => {
        if (!check.explainEn) report(ctx, ['tiers', ti, group, ci, 'explainEn'], 'required when ready');
      });
    }
  });
  if (story.shelf) {
    if (!story.hoyaIntroEn) report(ctx, ['hoyaIntroEn'], 'required when the story has a shelf block');
    if (!story.hoyaOutroEn) report(ctx, ['hoyaOutroEn'], 'required when the story has a shelf block');
  }
  if (story.card) {
    if (!story.keywords.some((k) => k.id === story.card?.keywordId)) {
      report(ctx, ['card', 'keywordId'], `card.keywordId ${story.card.keywordId} is not in keywords[]`);
    }
    if (!story.facts.some((f) => f.id === story.card?.factId)) {
      report(ctx, ['card', 'factId'], `card.factId ${story.card.factId} is not in facts[]`);
    }
  }
}

export const StorySchema = StoryObjectSchema.superRefine(storyCrossFieldRules);
export const StoryReadySchema = StorySchema.superRefine(storyReadyRules);

/** The one entry point used by the content test, the generator and the importer's self-check. */
export function parseStory(json: unknown): Story {
  const story = StorySchema.parse(json);
  return story.state === 'ready' ? StoryReadySchema.parse(story) : story;
}
