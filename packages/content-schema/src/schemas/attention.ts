import { z } from 'zod';

/**
 * [GX-W] What waits for a grown-up's answer, on the wire (AMENDMENTS-GROWNUP-UX section 12): the additive fields of
 * `GET /api/spaces/:id/roster` (`learners[].pending`, top-level `incoming`) and of `GET /api/spaces`
 * (`spaces[].attention`). The Worker writes them; a console reads them leniently with the readers below, so a field
 * an older Worker does not send, or a broken part, reads as absent and the console falls back to its own reads
 * (section 3.3), never to a guess. Ids only; no learner name ever travels in these fields.
 */

/**
 * Where a learner's open move stands for the space that reads it: `yours` waits for this space's answer, `others`
 * for someone else's, `room` was agreed and waits for a seat, `scheduled` was agreed and runs on `on`.
 */
export const PendingMoveStepSchema = z.enum(['yours', 'others', 'room', 'scheduled']);
export type PendingMoveStep = z.infer<typeof PendingMoveStepSchema>;

/** A family-started class transfer (F-SPACE-002) or a teacher move (`class_moves`, TV-D8). */
export const PendingMoveSourceSchema = z.enum(['transfer', 'teacher']);
export type PendingMoveSource = z.infer<typeof PendingMoveSourceSchema>;

/** A re-link request for this learner, pending in this space and inside its window. */
export const RosterPendingRelinkSchema = z.object({ id: z.string().min(1), expiresAt: z.string().min(1) });
export type RosterPendingRelink = z.infer<typeof RosterPendingRelinkSchema>;

/** The learner's one open move. `to` only where the reader may read the class's name (TV-D8); `on` only when `scheduled`. */
export const RosterPendingMoveSchema = z.object({
  source: PendingMoveSourceSchema,
  id: z.string().min(1),
  step: PendingMoveStepSchema,
  to: z.string().nullable(),
  on: z.string().nullable(),
  expiresAt: z.string().nullable(),
});
export type RosterPendingMove = z.infer<typeof RosterPendingMoveSchema>;

/** `learners[].pending`: each part present only when something waits and the reader may decide it (section 12 gates). */
export const RosterPendingSchema = z.object({
  relink: RosterPendingRelinkSchema.optional().catch(undefined),
  move: RosterPendingMoveSchema.optional().catch(undefined),
});
export type RosterPending = z.infer<typeof RosterPendingSchema>;

const CountSchema = z.number().int().nonnegative();

/** `spaces[].attention`: counts only, plus the soonest re-link expiry for the re-link bar's minutes. */
export const SpaceAttentionSchema = z.object({
  relinks: CountSchema,
  moves: CountSchema,
  relinkExpiresAt: z.string().nullable(),
});
export type SpaceAttention = z.infer<typeof SpaceAttentionSchema>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A roster row's `pending`, or null when the Worker sent none; a broken part is dropped, the rest kept. */
export function readRosterPending(value: unknown): RosterPending | null {
  return isRecord(value) ? RosterPendingSchema.parse(value) : null;
}

/** The roster's `incoming` count, or null when absent or not a whole count. */
export function readRosterIncoming(value: unknown): number | null {
  const parsed = CountSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** A spaces-list item's `attention`, or null when absent or broken (never read as zero). */
export function readSpaceAttention(value: unknown): SpaceAttention | null {
  const parsed = SpaceAttentionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
