import { z } from 'zod';

/**
 * Match Shape (F-CURR-002 section 7.1 F4, row CM-33; design/wireframes/minigame/match-shape.md): an `origin` round shows
 * a drawn picture (`prop:shape-origin-*`) and one sourced line (`noteEn`, restating fact `fact`), and asks for the letter
 * among 3; a `pair` round asks for every copy of `target` among 6 tiles (`layout`: t the target, l the look-alike).
 * Letters are jamo ids of letters, never a final's. Kept out of the package barrel and `RoundSchema`: the rounds are
 * Stage 1 TypeScript rows (F-CURR-002 section 4.2), checked by their own unit tests, so no lesson file parses them and
 * the start bundle carries none of this.
 */
const ShapeLetterSchema = z.string().regex(/^jamo:[a-z]+$/);
export const MatchShapeRoundSchema = z
  .discriminatedUnion('shape', [
    z.object({
      id: z.string().min(1),
      shape: z.literal('origin'),
      target: ShapeLetterSchema,
      options: z.array(ShapeLetterSchema).length(3),
      picture: z.string().regex(/^prop:shape-origin-[a-z]+$/),
      noteEn: z.string().trim().min(1).max(90),
      fact: z.string().regex(/^[a-z]+$/),
    }),
    z.object({
      id: z.string().min(1),
      shape: z.literal('pair'),
      target: ShapeLetterSchema,
      lookAlike: ShapeLetterSchema,
      layout: z.string().regex(/^[tl]{6}$/),
      diffNoteEn: z.string().trim().min(1).max(140),
    }),
  ])
  .superRefine((r, ctx) => {
    const issue = (message: string): void => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if (r.shape === 'origin') {
      if (new Set(r.options).size !== 3) issue('the options are three different letters');
      else if (!r.options.includes(r.target)) issue('the target is one of the options');
    } else if (r.lookAlike === r.target) issue('the look-alike is another letter');
    else if (!/^l*(tl*){2,3}$/.test(r.layout)) issue('2 or 3 of the 6 tiles are the target');
  });
export type MatchShapeRound = z.infer<typeof MatchShapeRoundSchema>;
