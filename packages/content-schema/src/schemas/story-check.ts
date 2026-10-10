import { z } from 'zod';
import { KoTextSchema } from './ko-text';

/**
 * Comprehension check shared by `Tier.checks` and `Tier.checkpoints`.
 * Text owned by F-STORY-003 §3.1; file created by F-STORY-001 PR 1.1a.
 * Difference from the first draft: `explainEn` is optional here (required by
 * the `ready` rule of F-STORY-001 §3.2.2 item 6) and `CHECK_LIMITS.option` is 80.
 */
export const HANGUL = /[ㄱ-㆏가-힣]/; // same range as scripts/validate-content.mjs

export const CheckKindSchema = z.enum([
  'detail', // what / when / why / how many — the research files' default
  'who',
  'pick-meaning', // Korean target -> English meaning (needs `target`)
  'pick-picture', // options are pictures (Listen level)
  'true-false', // exactly 2 options, never shuffled
  'fill-word',
  'feeling',
]);
export type CheckKind = z.infer<typeof CheckKindSchema>;

// option 80: the longest research option is 79 chars; F-STORY-001 lint `check-option-long` warns above 70
export const CHECK_LIMITS = {
  prompt: 90,
  option: 80,
  explain: 140,
  hint: 80,
  options: { min: 2, max: 4 },
} as const;

const ArtRef = z.string().regex(/^(card|hoya|prop|scene):[a-z0-9-]+$/); // same grammar as F-STORY-001 ArtLayer.ref

export const CheckOptionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,16}$/),
    en: z.string().trim().min(1).max(CHECK_LIMITS.option).optional(), // label / gloss / alt text
    ko: z.string().trim().min(1).max(24).optional(), // Korean option text
    romanization: z.string().trim().min(1).max(48).optional(),
    art: ArtRef.optional(),
    isCorrect: z.boolean(),
  })
  .superRefine((o, ctx) => {
    if (!o.en && !o.ko && !o.art) {
      ctx.addIssue({ code: 'custom', message: 'option needs en, ko or art' });
    }
    if (o.ko && !(o.romanization && o.en)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ko'],
        message: 'Korean option needs romanization and an English gloss',
      });
    }
    if (o.art && !o.en) {
      ctx.addIssue({
        code: 'custom',
        path: ['art'],
        message: 'picture option needs en (label and alt text)',
      });
    }
    if (o.en && HANGUL.test(o.en)) {
      ctx.addIssue({ code: 'custom', path: ['en'], message: 'Hangul belongs in ko' });
    }
  });
export type CheckOption = z.infer<typeof CheckOptionSchema>;

const TARGET_TOKEN = /\{target\}/g;

export const StoryCheckSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,32}$/), // unique inside the tier
    kind: CheckKindSchema,
    promptEn: z.string().trim().min(1).max(CHECK_LIMITS.prompt), // at most one "{target}" token, never Hangul
    target: KoTextSchema.optional(), // the Korean the question is about
    options: z.array(CheckOptionSchema).min(CHECK_LIMITS.options.min).max(CHECK_LIMITS.options.max),
    // Shown after the item resolves; REQUIRED when the story is `ready` (F-STORY-001 §3.2.2 item 6).
    explainEn: z.string().trim().min(1).max(CHECK_LIMITS.explain).optional(),
    hintEn: z.string().trim().min(1).max(CHECK_LIMITS.hint).optional(), // shown after the first wrong tap
    factIds: z.array(z.string().min(1)).min(1).max(3), // D14: ids into the story's facts[]
    shuffle: z.boolean().optional(), // default true; true-false never shuffles
  })
  .superRefine((c, ctx) => {
    if (c.options.filter((o) => o.isCorrect).length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'exactly one option must be correct',
      });
    }
    if (new Set(c.options.map((o) => o.id)).size !== c.options.length) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'option ids must be unique' });
    }
    const tokens = c.promptEn.match(TARGET_TOKEN)?.length ?? 0;
    if (tokens > 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['promptEn'],
        message: 'promptEn may contain at most one {target} token',
      });
    }
    if (tokens === 1 && !c.target) {
      ctx.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'a {target} token needs a target',
      });
    }
    if (c.kind === 'pick-meaning' && !c.target) {
      ctx.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'pick-meaning needs a target',
      });
    }
    if (c.kind === 'pick-picture' && !c.options.every((o) => o.art)) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'pick-picture options must all have art',
      });
    }
    if (c.kind === 'true-false') {
      if (c.options.length !== 2) {
        ctx.addIssue({
          code: 'custom',
          path: ['options'],
          message: 'true-false needs exactly 2 options',
        });
      }
      if (c.shuffle === true) {
        ctx.addIssue({
          code: 'custom',
          path: ['shuffle'],
          message: 'true-false options are never shuffled',
        });
      }
    }
    for (const field of ['promptEn', 'explainEn', 'hintEn'] as const) {
      const text = c[field];
      if (text && HANGUL.test(text)) {
        ctx.addIssue({ code: 'custom', path: [field], message: 'Hangul belongs in ko or target' });
      }
    }
  });
export type StoryCheck = z.infer<typeof StoryCheckSchema>;
