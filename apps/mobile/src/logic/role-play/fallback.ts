import { isRolePlayEnd, type RolePlayScene, type RolePlayTurnNode } from '@hangul-route/content-schema';
import type { MinigameScope } from '../minigame-config';

/**
 * Role Play's fallback (F-CURR-002 sections 7.1 F6 and 12.2, row CM-35): while `game.role-play` is off, a role-play
 * step plays **Tap to Respond on the same turns**. Start bundle (the quest screen decides before the step draws), so
 * it stays small; the game itself is the Role Play chunk's.
 *
 * The turns are the scene's main path: from the start, each turn's first natural reply and its next node, to the end.
 * Each turn's first natural reply is the right answer and its less natural replies are the other options; a second
 * natural reply is left out, so every option left has one right answer, and `role-play-turn-options` gives every turn
 * at least one other option, so no fallback turn is a single button. Other branches are not played.
 */

type Dialogue = NonNullable<MinigameScope['dialogue']>;

/** The turns along the first natural replies, from the start to the end (a guard stops at a node met twice). */
export function rolePlayMainPath(scene: RolePlayScene): RolePlayTurnNode[] {
  const out: RolePlayTurnNode[] = [];
  let id: string | undefined = scene.start;
  while (id !== undefined) {
    const node = scene.nodes.find((n) => n.id === id);
    if (node === undefined || isRolePlayEnd(node) || out.includes(node)) break;
    out.push(node);
    id = node.replies.find((r) => r.kind === 'natural')?.next;
  }
  return out;
}

/** The Tap to Respond turns of a scene (the shape `TapRespondGame` and the lecture reply slide read). */
export function rolePlayToTapRespond(scene: RolePlayScene): Dialogue {
  return rolePlayMainPath(scene).map((turn) => {
    const right = turn.replies.find((r) => r.kind === 'natural');
    const { ko, romanization, en, spokenKo, audioRef } = turn.line;
    return {
      npcKo: ko,
      npcRomanization: romanization,
      npcEn: en,
      ...(spokenKo === undefined ? {} : { npcSpokenKo: spokenKo }),
      ...(audioRef === undefined ? {} : { npcAudioRef: audioRef }),
      // A reply's text as it is (its spoken form and recording ride along), marked right or not.
      options: turn.replies.filter((r) => r === right || r.kind === 'lessNatural').map((r) => ({ ...r.text, isCorrect: r === right })),
    };
  });
}

/**
 * The scope a step plays: a role-play scope while `game.role-play` is on; with it off, the Tap to Respond scope of
 * the same turns, so its telemetry names the kind that was shown. Every other scope is played as it is.
 */
export function playedScope(scope: MinigameScope, rolePlayOn: boolean): MinigameScope {
  if (scope.kind !== 'role-play' || rolePlayOn) return scope;
  const dialogue = scope.rolePlay ? rolePlayToTapRespond(scope.rolePlay.scene) : [];
  return { kind: 'tap-respond', rounds: dialogue.length, dialogue };
}
