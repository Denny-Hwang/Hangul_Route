import { z } from 'zod';
import { KoTextSchema } from './ko-text';

/**
 * Role Play, read and tap (F-CURR-002 section 7.1 row F6, row CM-35; design/wireframes/minigame/role-play.md):
 * a short branching chat. The partner, named by role (saseo, librarian), says a line; the learner reads two or three
 * reply bubbles and taps one. A natural reply is sent and leads to its next node; a less natural one is never sent:
 * it locks, Hoya says why (`whyEn`, content with es and ko overlays) and the learner taps again. Text and listening
 * only: nothing here records or measures speech.
 *
 * The scene is a graph of nodes. Its graph rules (every way ends at a closing line, every way has as many turns, every
 * turn has something to nudge, at most four ways) are `../role-play-rules.ts`, run by the content lint and the lesson
 * build, so this file, which rides in the start bundle with the package barrel, holds only the shape.
 */

export const ROLE_PLAY_TURNS_MIN = 4;
export const ROLE_PLAY_TURNS_MAX = 6;

const NodeIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(24);
/** UI-language content text; Korean only inside `{ko:}` tokens, drawn as taught Korean with its romanization. */
const ContentLineSchema = z.string().trim().min(1).max(160);

export const RolePlayReplySchema = z
  .object({
    id: NodeIdSchema,
    /** Korean and romanization on the bubble; the meaning (`en`) shows only after Show meanings. */
    text: KoTextSchema,
    kind: z.enum(['natural', 'lessNatural']),
    /** A natural reply's next node. */
    next: NodeIdSchema.optional(),
    /** A less natural reply's reason, said by Hoya in amber. */
    whyEn: ContentLineSchema.optional(),
  })
  .strict()
  .refine((r) => (r.kind === 'natural') === (r.next !== undefined) && (r.kind === 'natural') !== (r.whyEn !== undefined), {
    message: 'a natural reply has a next node; a less natural one has a whyEn',
  });
export type RolePlayReply = z.infer<typeof RolePlayReplySchema>;

export const RolePlayTurnNodeSchema = z
  .object({ id: NodeIdSchema, line: KoTextSchema, replies: z.array(RolePlayReplySchema).min(2).max(3) })
  .strict();
export type RolePlayTurnNode = z.infer<typeof RolePlayTurnNodeSchema>;

/** A leaf: the scene's friendly closing line (content), shown by Hoya with Continue; never a score. */
export const RolePlayEndNodeSchema = z.object({ id: NodeIdSchema, end: z.literal(true), closingEn: ContentLineSchema }).strict();
export type RolePlayEndNode = z.infer<typeof RolePlayEndNodeSchema>;

export type RolePlayNode = RolePlayTurnNode | RolePlayEndNode;

export const isRolePlayEnd = (node: RolePlayNode | undefined): node is RolePlayEndNode => node !== undefined && 'end' in node;

/**
 * The learner turns of a sound scene (every way has as many, `role-play-even-branches`): its round count and the
 * length of its progress bar, read along the first natural replies; 0 when they reach no end.
 */
export function rolePlayTurnCount(scene: { start: string; nodes: readonly RolePlayNode[] }): number {
  let node = scene.nodes.find((n) => n.id === scene.start);
  for (let turns = 0; turns <= scene.nodes.length; turns += 1) {
    if (node === undefined) return 0;
    if (isRolePlayEnd(node)) return turns;
    const next = node.replies.find((r) => r.kind === 'natural')?.next;
    node = scene.nodes.find((n) => n.id === next);
  }
  return 0;
}

export const RolePlaySceneSchema = z
  .object({
    /** Where the chat happens, as taught Korean (doseogwan, At the library). */
    title: KoTextSchema,
    /** The partner, by role and never by a personal name (saseo, librarian). */
    partner: KoTextSchema,
    start: NodeIdSchema,
    nodes: z.array(z.union([RolePlayTurnNodeSchema, RolePlayEndNodeSchema])).min(ROLE_PLAY_TURNS_MIN + 1).max(24),
  })
  .strict();
export type RolePlayScene = z.infer<typeof RolePlaySceneSchema>;
