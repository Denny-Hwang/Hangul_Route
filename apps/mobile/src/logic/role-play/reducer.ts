import { isRolePlayEnd, type RolePlayNode, type RolePlayReply, type RolePlayScene, type RolePlayTurnNode } from '@hangul-route/content-schema';

/**
 * The branch reducer of Role Play (F-CURR-002 section 7.1 F6, row CM-35; design/wireframes/minigame/role-play.md,
 * Interaction points). Pure: the renderer feeds it taps and "the reply was said", and runs the effects it returns
 * (score the turn, say a line, nudge, open the end card). Lives in the Role Play chunk with the renderer.
 *
 * - A **natural** reply is sent: it joins the log as the learner's bubble and is said; once it has been said (`sent`)
 *   the partner answers along that reply's branch, or the end card opens.
 * - A **less natural** reply is never sent: it locks (the nudge look), Hoya says its `why` line, and the learner taps
 *   another. The partner does not react. From the second such tap in one turn the first natural reply is ringed.
 * - The **first tap of a turn scores** it (a natural reply is right, a less natural one a miss); later taps are retries.
 *   The scored answer names the reply it was about: the tapped natural reply, or for a miss the turn's first natural
 *   reply, so the memory store records the exchange that the turn teaches (section 4.2 `exc`).
 * - **Show meanings** reveals the meanings of this turn's replies; a turn scored with them showing is hinted.
 * - Every way through a sound scene ends at an `end` node (`RolePlaySceneSchema`), so the chat always ends with the
 *   closing line and Continue; there is no failure state to reach.
 */

export type RpLogEntry = { who: 'partner'; node: string } | { who: 'me'; node: string; reply: string };

export interface RpState {
  /** The node on screen: a turn waiting for a reply, or the end. */
  node: string;
  /** The learner turn on screen, 0-based; at the end, the number of turns played. */
  turn: number;
  /** The chat so far, oldest first: each partner line, and each reply the learner sent. */
  log: readonly RpLogEntry[];
  /** The less natural replies tapped in this turn, locked, in tap order. */
  locked: readonly string[];
  /** The last less natural reply tapped in this turn: Hoya says its why line. */
  why: string | null;
  /** The natural reply being sent (said); every tap waits until it is. */
  sending: string | null;
  /** The meanings of this turn's replies are showing. */
  meanings: boolean;
  /** This turn's first tap has been scored. */
  scored: boolean;
  done: boolean;
}

export type RpEvent = { type: 'tap'; reply: string } | { type: 'sent' } | { type: 'showMeanings' };

export type RpEffect =
  /** The turn's first tap, scored; `reply` is the natural reply the turn is about (see the file comment). */
  | { type: 'answer'; node: string; reply: string; correct: boolean; hinted: boolean }
  /** Say the reply being sent (the reply-advance rule: at least 900 ms, at most 6 s, then `sent`). */
  | { type: 'sayReply'; node: string; reply: string }
  /** A partner line opens: say it once. */
  | { type: 'sayLine'; node: string }
  | { type: 'nudge'; reply: string }
  | { type: 'success'; reply: string }
  /** The end card opens: the closing line and Continue. */
  | { type: 'end'; node: string };

export interface RpStep {
  state: RpState;
  effects: RpEffect[];
}

const nodeOf = (scene: RolePlayScene, id: string): RolePlayNode | undefined => scene.nodes.find((n) => n.id === id);

/** The turn on screen, or undefined at the end (or for a node the scene does not hold). */
export function turnOf(scene: RolePlayScene, state: Pick<RpState, 'node'>): RolePlayTurnNode | undefined {
  const node = nodeOf(scene, state.node);
  return node === undefined || isRolePlayEnd(node) ? undefined : node;
}

/** The first natural reply of a turn: the main path's, the fallback's right answer and the reply a miss is about. */
export function firstNatural(turn: RolePlayTurnNode): RolePlayReply | undefined {
  return turn.replies.find((r) => r.kind === 'natural');
}

/** The reply ringed "look here": the first natural one, from the second less natural tap in a turn. */
export function lookHereOf(scene: RolePlayScene, state: RpState): string | null {
  const turn = turnOf(scene, state);
  if (turn === undefined || state.sending !== null || state.locked.length < 2) return null;
  return firstNatural(turn)?.id ?? null;
}

function opened(scene: RolePlayScene, id: string, base: Pick<RpState, 'log' | 'turn'>): RpStep {
  const node = nodeOf(scene, id);
  const fresh = { locked: [], why: null, sending: null, meanings: false, scored: false };
  if (isRolePlayEnd(node)) return { state: { ...base, ...fresh, node: id, done: true }, effects: [{ type: 'end', node: id }] };
  return { state: { ...base, ...fresh, node: id, log: [...base.log, { who: 'partner', node: id }], done: false }, effects: [{ type: 'sayLine', node: id }] };
}

/** The chat as it opens: the start line in the log and said once. */
export function startRolePlay(scene: RolePlayScene): RpStep {
  return opened(scene, scene.start, { log: [], turn: 0 });
}

const unchanged = (state: RpState): RpStep => ({ state, effects: [] });

export function stepRolePlay(scene: RolePlayScene, state: RpState, event: RpEvent): RpStep {
  const turn = turnOf(scene, state);
  if (state.done || turn === undefined) return unchanged(state);
  switch (event.type) {
    case 'showMeanings':
      return state.meanings ? unchanged(state) : { state: { ...state, meanings: true }, effects: [] };
    case 'sent': {
      const reply = turn.replies.find((r) => r.id === state.sending);
      if (reply?.next === undefined) return unchanged(state);
      return opened(scene, reply.next, { log: state.log, turn: state.turn + 1 });
    }
    case 'tap': {
      const reply = turn.replies.find((r) => r.id === event.reply);
      if (reply === undefined || state.sending !== null || state.locked.includes(reply.id)) return unchanged(state);
      const natural = reply.kind === 'natural';
      const about = natural ? reply : firstNatural(turn);
      const effects: RpEffect[] = [];
      if (!state.scored && about !== undefined) {
        effects.push({ type: 'answer', node: turn.id, reply: about.id, correct: natural, hinted: state.meanings });
      }
      if (!natural) {
        effects.push({ type: 'nudge', reply: reply.id });
        return { state: { ...state, scored: true, locked: [...state.locked, reply.id], why: reply.id }, effects };
      }
      effects.push({ type: 'success', reply: reply.id }, { type: 'sayReply', node: turn.id, reply: reply.id });
      return {
        state: { ...state, scored: true, why: null, sending: reply.id, log: [...state.log, { who: 'me', node: turn.id, reply: reply.id }] },
        effects,
      };
    }
  }
}
