import { z } from 'zod';
import {
  AssessmentQuestionShape,
  AssessmentResponseSchema,
  refineAssessmentQuestion,
  type ASSESSMENT_FORMATS,
} from '../assessment/question';
import { PLACEMENT_MODES, RUNG_SYMBOLS, strandOfGate } from '../placement/rungs';
import { StageKeySchema } from './heritage-card';
import { UiLocaleSchema } from './locale';

/**
 * Placement (the level check) — F-PLC-001 sections 3.4 and 3.8. Everything
 * here is additive: `ProgressSnapshot.placements` defaults to `[]` and
 * `ProgressSummary.placement` is optional, so old snapshots, backups and
 * server copies still parse.
 */
export const PLACEMENT_GATES = ['recog', 'sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc', 'vocab', 'sentence'] as const;
export const PlacementGateSchema = z.enum(PLACEMENT_GATES);
export type PlacementGate = z.infer<typeof PlacementGateSchema>;

export const PlacementStrandSchema = z.enum(['hangul-recognition', 'sound-letter', 'syllable-reading', 'vocabulary', 'sentences']);
export type PlacementStrand = z.infer<typeof PlacementStrandSchema>;

/** `vocab` and `sentence` gates use `read` or `oral`; every other gate is `decode`. */
export const PlacementFormSchema = z.enum(['decode', 'read', 'oral']);
export type PlacementForm = z.infer<typeof PlacementFormSchema>;

export const GateResultSchema = z.object({
  gate: PlacementGateSchema,
  form: PlacementFormSchema,
  asked: z.number().int().min(0).max(3),
  correct: z.number().int().min(0).max(3),
  assisted: z.number().int().min(0).max(3),
  result: z.enum(['pass', 'fail', 'not-run']),
  reason: z.enum(['unavailable', 'stopped']).optional(),
});
export type GateResult = z.infer<typeof GateResultSchema>;

export const StrandStatusSchema = z.enum(['secure', 'getting-there', 'not-yet', 'not-tested']);
export type StrandStatus = z.infer<typeof StrandStatusSchema>;

export const PlacementLevelSchema = z.object({ stage: StageKeySchema, band: z.number().int().min(0).max(3) });
export type PlacementLevel = z.infer<typeof PlacementLevelSchema>;

export const StopReasonSchema = z.enum(['complete', 'cap', 'time', 'quit', 'grown-up', 'not-sure']);
export type StopReason = z.infer<typeof StopReasonSchema>;

export const PlacementSourceSchema = z.enum(['onboarding', 'home', 'profile', 'parent']);
export type PlacementSource = z.infer<typeof PlacementSourceSchema>;

/** The check length the learner chose (F-PLC-001 P14). The tuple lives in `placement/rungs.ts`. */
export const PlacementModeSchema = z.enum(PLACEMENT_MODES);

export const MotivationSchema = z.enum(['heritage', 'kculture', 'curious', 'friends']);
export type Motivation = z.infer<typeof MotivationSchema>;

const StrandsSchema = z.object({
  'hangul-recognition': StrandStatusSchema,
  'sound-letter': StrandStatusSchema,
  'syllable-reading': StrandStatusSchema,
  vocabulary: StrandStatusSchema,
  sentences: StrandStatusSchema,
});

export const PlacementResultSchema = z.object({
  id: z.string().regex(/^placement:[a-z0-9-]+$/),
  startedAt: z.string(),
  completedAt: z.string(),
  source: PlacementSourceSchema,
  testLocale: UiLocaleSchema,
  /** Legacy, unchanged: `legacyLengthOf(mode)` (short -> quick, standard and deep -> full). */
  length: z.enum(['quick', 'full']),
  /** Optional: absent on results written before the three modes; read it with `modeOf`. */
  mode: PlacementModeSchema.optional(),
  revealMode: z.enum(['tap', 'always']),
  bankVersion: z.number().int().positive(),
  contentVer: z.string(),
  motivation: MotivationSchema.optional(),
  /** Deep asks up to 42 (two draws per route-moving rung); Short and Standard stay within 24. */
  responses: z.array(AssessmentResponseSchema).max(48),
  /** Deep stores one row per draw (up to 15); Short and Standard stay within 9. */
  gates: z.array(GateResultSchema).max(16),
  strands: StrandsSchema,
  level: PlacementLevelSchema,
  oralStage: StageKeySchema.nullable(),
  beyondContent: z.boolean(),
  startQuestId: z.string().nullable(),
  placedOutQuestIds: z.array(z.string()).max(40),
  priorityTokens: z.array(z.string()).max(3),
  needsStage: StageKeySchema.nullable(),
  stopReason: StopReasonSchema,
  override: z.object({ by: z.literal('parent'), at: z.string(), startQuestId: z.string() }).optional(),
});
export type PlacementResult = z.infer<typeof PlacementResultSchema>;

/** How many results a snapshot keeps (newest by `completedAt`). */
export const PLACEMENT_KEEP = 10;

/**
 * The only placement data grown-ups and teachers read (`ProgressSummary.placement`):
 * statuses and the level, no per-question data and no counts (F-TCH-001 section 3.2).
 */
export const PlacementSummarySchema = z.object({
  takenAt: z.string(),
  level: PlacementLevelSchema,
  oralStage: StageKeySchema.nullable(),
  strands: StrandsSchema,
  beyondContent: z.boolean(),
  overridden: z.boolean(),
});
export type PlacementSummary = z.infer<typeof PlacementSummarySchema>;

// ---------------------------------------------------------------------------
// The bank (F-PLC-001 section 3.4). One template is one concrete question with
// explicit options; the engine draws from `status: 'ready'` templates only.
// ---------------------------------------------------------------------------

type Format = (typeof ASSESSMENT_FORMATS)[number];

/** Which formats each (gate, form) may use. Its keys agree with `RUNG_TABLE` (test). */
export const PLACEMENT_FORMATS: Readonly<Record<PlacementGate, Partial<Record<PlacementForm, readonly Format[]>>>> = {
  recog: { decode: ['shape-odd-one-out'] },
  'sound-basic': { decode: ['hear-pick-written', 'see-pick-sound'] },
  'sound-rest': { decode: ['hear-pick-written', 'see-pick-sound'] },
  'syl-cv': { decode: ['hear-pick-written', 'see-pick-sound', 'build-syllable'] },
  'syl-cvc': { decode: ['hear-pick-written', 'see-pick-sound', 'build-syllable'] },
  vocab: { oral: ['hear-pick-picture'], read: ['read-pick-picture'] },
  sentence: { oral: ['hear-pick-picture'], read: ['read-pick-picture', 'reply-pick'] },
};

/** Formats that start from audio (build-syllable too: its prompt is the speaker, wireframe `item`). */
export const PLACEMENT_AUDIO_FORMATS: readonly Format[] = ['hear-pick-written', 'build-syllable', 'hear-pick-picture', 'reply-pick'];
/** Formats whose written options or prompt would not give the answer away. */
export const PLACEMENT_NO_LEAK_FORMATS: readonly Format[] = ['shape-odd-one-out', 'hear-pick-picture'];
const PICTURE_FORMATS: readonly Format[] = ['hear-pick-picture', 'read-pick-picture'];
/** The written form is the answer, so the prompt is audio only. */
const SPOKEN_ONLY_FORMATS: readonly Format[] = ['hear-pick-written', 'build-syllable'];
const PROMPT_FORMATS: readonly Format[] = ['see-pick-sound', 'hear-pick-picture', 'read-pick-picture', 'reply-pick'];

const SYMBOL_GROUPS: Readonly<Record<'basic' | 'rest', readonly string[]>> = { basic: RUNG_SYMBOLS.basic, rest: RUNG_SYMBOLS.rest };
const ALL_SYMBOLS: ReadonlySet<string> = new Set([...RUNG_SYMBOLS.basic, ...RUNG_SYMBOLS.rest, ...RUNG_SYMBOLS.finals]);
const KNOWN_TAG =
  /^(group:(basic|rest|final)|syl:[a-z]+|shape:(cv|cvc)|word:[a-z]+(-[a-z]+)*|topic:(letters|life|rites|nature|crafts)|pattern:(n-ieyo|n-eul-v|reply)|look-alike)$/;

const TemplateIdSchema = z.string().regex(/^pitem:[a-z0-9-]+$/);

const PlacementTemplateShape = z.object({
  id: TemplateIdSchema,
  strand: PlacementStrandSchema,
  gate: PlacementGateSchema,
  /** vocab / sentence: `read` or `oral`; every other gate: `decode`. */
  form: PlacementFormSchema,
  question: AssessmentQuestionShape.omit({ id: true }).superRefine(refineAssessmentQuestion),
  /** For reports and the result; never shown on the item. Overlay field `gloss`. */
  glossEn: z.string().max(60),
  status: z.enum(['draft', 'ready']),
  /** Who signed the language review of a sentence template (section 9), and on which day (YYYY-MM-DD). */
  reviewedBy: z.string().trim().min(1).max(16).optional(),
  reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Authoring record of `reply-pick`: rows whose natural answer must not appear as a distractor here. */
  incompatibleWith: z.array(TemplateIdSchema).optional(),
});
type TemplateShape = z.infer<typeof PlacementTemplateShape>;

interface Found {
  path: (string | number)[];
  message: string;
}

const tagValues = (tags: readonly string[], prefix: string): string[] =>
  tags.filter((t) => t.startsWith(prefix)).map((t) => t.slice(prefix.length));

/** Gate-specific tag rules; each returns the issues of one gate. */
function gateTagIssues(t: TemplateShape): Found[] {
  const { tags, options } = t.question;
  const at = ['question', 'tags'];
  const found: Found[] = [];
  const add = (message: string): void => void found.push({ path: at, message });
  const symbols = tagValues(tags, 'sym:');
  if (t.gate === 'recog') {
    if (symbols.length !== 2) add('recognition needs two sym tags (the odd letter and the base letter)');
    if (!tags.includes('look-alike')) add('recognition needs the look-alike tag');
    const correct = options.find((o) => o.isCorrect);
    const others = options.filter((o) => !o.isCorrect);
    if (others.length !== 3 || others.some((o) => o.ko !== others[0]?.ko)) add('three tiles must show the same letter');
    else if (correct !== undefined && correct.ko === others[0]?.ko) add('the correct tile must differ from the other three');
  }
  if (t.gate === 'sound-basic' || t.gate === 'sound-rest') {
    const group = t.gate === 'sound-basic' ? 'basic' : 'rest';
    if (symbols.length !== 1) add('a sound template needs exactly one sym tag');
    else if (!SYMBOL_GROUPS[group].includes(symbols[0] as string)) add(`the sym tag must be in the ${group} group`);
    if (!tags.includes(`group:${group}`)) add(`a ${t.gate} template needs the group:${group} tag`);
    const shown = t.question.format === 'see-pick-sound' ? t.question.promptKo : options.find((o) => o.isCorrect)?.ko;
    if (symbols.length === 1 && shown !== symbols[0]) add('the prompt or the correct option must be the tagged symbol');
  }
  if (t.gate === 'syl-cv' || t.gate === 'syl-cvc') {
    const shape = t.gate === 'syl-cv' ? 'cv' : 'cvc';
    const finals = symbols.filter((s) => s.endsWith('/final')).length;
    if (!tags.includes(`shape:${shape}`)) add(`a ${t.gate} template needs the shape:${shape} tag`);
    if (tagValues(tags, 'syl:').length !== 1) add('a syllable template needs exactly one syl tag');
    if (symbols.length !== (shape === 'cv' ? 2 : 3)) add(`a ${shape} syllable needs ${shape === 'cv' ? 'two' : 'three'} sym tags`);
    else if (shape === 'cv' && finals !== 0) add('a cv syllable has no final symbol');
    else if (shape === 'cvc' && finals !== 1) add('a cvc syllable needs exactly one final symbol');
  }
  if (t.gate === 'vocab' && tagValues(tags, 'word:').length !== 1) add('a vocabulary template needs exactly one word tag');
  if (t.gate === 'sentence' && tagValues(tags, 'pattern:').length !== 1) add('a sentence template needs exactly one pattern tag');
  return found;
}

/** Everything the Zod object cannot say by itself. */
function templateIssues(t: TemplateShape): Found[] {
  const found: Found[] = [];
  const add = (path: (string | number)[], message: string): void => void found.push({ path, message });
  const q = t.question;
  const expectedStrand = strandOfGate(t.gate);
  if (t.strand !== expectedStrand) add(['strand'], `strand must be ${expectedStrand} for gate ${t.gate}`);
  const formats = PLACEMENT_FORMATS[t.gate][t.form];
  if (formats === undefined) add(['form'], `form ${t.form} is not used by gate ${t.gate}`);
  else if (!formats.includes(q.format)) add(['question', 'format'], `format ${q.format} is not used by gate ${t.gate} (${t.form})`);

  if (q.leaks !== !PLACEMENT_NO_LEAK_FORMATS.includes(q.format)) add(['question', 'leaks'], `leaks must be ${!PLACEMENT_NO_LEAK_FORMATS.includes(q.format)} for ${q.format}`);
  if (q.requires.audio !== PLACEMENT_AUDIO_FORMATS.includes(q.format)) add(['question', 'requires'], `requires.audio must be ${PLACEMENT_AUDIO_FORMATS.includes(q.format)} for ${q.format}`);

  const wanted = q.format === 'reply-pick' ? [3, 4] : [4];
  if (!wanted.includes(q.options.length)) add(['question', 'options'], q.format === 'reply-pick' ? 'a reply-pick question needs 3 or 4 options' : `a ${q.format} question needs 4 options`);

  const isPicture = PICTURE_FORMATS.includes(q.format);
  const optionAt = ['question', 'options'];
  if (q.format === 'see-pick-sound') {
    if (q.options.some((o) => o.sound === undefined)) add(optionAt, 'every option needs a sound chip');
  } else if (isPicture) {
    if (q.options.some((o) => o.pictureRef === undefined)) add(optionAt, 'every option needs a picture');
    if (q.options.some((o) => o.ko !== undefined)) add(optionAt, 'picture options carry no text label');
  } else {
    if (q.options.some((o) => o.ko === undefined)) add(optionAt, 'every option needs Korean');
    if (q.options.some((o) => o.ko !== undefined && o.romanization === undefined)) add(optionAt, 'a Korean option needs a romanization');
    if (q.options.some((o) => o.ko !== undefined && o.en === undefined)) add(optionAt, 'a Korean option needs a gloss');
  }

  const picture = q.requires.picture;
  if (isPicture && picture === null) add(['question', 'requires'], 'requires.picture must be card or word for a picture format');
  else if (isPicture && q.options.some((o) => !(o.pictureRef ?? '').startsWith(`${picture}:`))) add(optionAt, `pictures must be ${picture}: refs`);
  else if (!isPicture && picture !== null) add(['question', 'requires'], 'requires.picture must be null unless the options are pictures');

  if (q.format !== 'shape-odd-one-out' && q.promptRomanization === undefined) add(['question', 'promptRomanization'], 'the prompt needs promptRomanization');
  if (PROMPT_FORMATS.includes(q.format) && q.promptKo === undefined) add(['question', 'promptKo'], 'the prompt needs promptKo');
  if (SPOKEN_ONLY_FORMATS.includes(q.format)) {
    if (q.spokenKo === undefined) add(['question', 'spokenKo'], 'the prompt needs spokenKo');
    if (q.promptKo !== undefined) add(['question', 'promptKo'], 'the written form is the answer: it must not show the answer as promptKo');
  }

  for (const tag of q.tags) {
    const known = tag.startsWith('sym:') ? ALL_SYMBOLS.has(tag.slice(4)) : KNOWN_TAG.test(tag);
    if (!known) add(['question', 'tags'], `unknown tag ${tag}`);
  }
  found.push(...gateTagIssues(t));

  if (t.status === 'ready' && t.strand === 'sentences' && (t.reviewedBy === undefined || t.reviewedAt === undefined)) {
    add(['status'], 'a ready sentence needs its language review record (reviewedBy and reviewedAt); keep it draft until then');
  }
  return found;
}

export const PlacementTemplateSchema = PlacementTemplateShape.superRefine((t, ctx) => {
  for (const f of templateIssues(t)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: f.path, message: f.message });
});
export type PlacementTemplate = z.infer<typeof PlacementTemplateSchema>;

/** A gate and form needs this many ready templates for three full draws. */
export const PLACEMENT_MIN_READY = 9;

export const PlacementBankSchema = z
  .object({
    version: z.number().int().positive(),
    templates: z.array(PlacementTemplateSchema).min(1),
  })
  .superRefine((bank, ctx) => {
    const fail = (path: (string | number)[], message: string): void => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    const byId = new Map<string, PlacementTemplate>();
    const ready = new Map<string, number>();
    bank.templates.forEach((t, i) => {
      if (byId.has(t.id)) fail(['templates', i, 'id'], `duplicate template id ${t.id}`);
      byId.set(t.id, t);
      if (t.status === 'ready') ready.set(`${t.gate} ${t.form}`, (ready.get(`${t.gate} ${t.form}`) ?? 0) + 1);
    });
    for (const [key, n] of ready) {
      if (n < PLACEMENT_MIN_READY) fail(['templates'], `${key} needs at least ${PLACEMENT_MIN_READY} ready templates, has ${n}`);
    }
    bank.templates.forEach((t, i) => {
      for (const id of t.incompatibleWith ?? []) {
        const other = byId.get(id);
        if (other === undefined) {
          fail(['templates', i, 'incompatibleWith'], `${t.id}: incompatibleWith ${id} is not in the bank`);
          continue;
        }
        const natural = other.question.options.find((o) => o.isCorrect)?.ko;
        if (t.question.options.some((o) => !o.isCorrect && o.ko === natural)) {
          fail(['templates', i, 'question', 'options'], `${t.id} offers the natural answer of ${id} as a distractor`);
        }
      }
    });
  });
export type PlacementBank = z.infer<typeof PlacementBankSchema>;
