import type { LookupMoveWaiting, LookupMoved, SpaceKind } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { joinErrorMessage } from './join-code';

/**
 * The Join screen's lines around a learner move — owner report 2026-10-23 (a learner moved from class A to class B
 * showed in both). Pure: the screen passes the lookup answer, the store's rows and the device facts.
 */

type JoinCopy = Pick<Messages['caregiver'], 'join' | 'retry' | 'audience'>;

/**
 * The line a lookup answer carries for a vouched learner, with the `/join` code it stands for: a move out of this
 * class that still stands (`moved`), else a move into it that waits (`moveWaiting`); null when neither. The screen
 * shows it before the confirm step and offers no Join for this learner; `/join` would refuse with the same code.
 */
export function lookupMoveLine(
  result: { space: { name: string }; moved?: LookupMoved; moveWaiting?: LookupMoveWaiting },
  learner: string,
  m: JoinCopy,
): { code: 'moved_out' | 'move_waiting'; line: string } | null {
  if (result.moved) return { code: 'moved_out', line: joinErrorMessage('moved_out', m, null, { learner, space: result.space.name, other: result.moved.to.name }) };
  if (result.moveWaiting) return { code: 'move_waiting', line: joinErrorMessage('move_waiting', m, null, { learner, space: result.space.name }) };
  return null;
}

/**
 * The live classes the learner holds besides the one being joined: a join adds a class and keeps these (up to the
 * learner class cap), so the confirm step names them. Only for a class being joined; a family or a school is not a class.
 */
export function otherClasses<T extends { spaceId: string; kind: SpaceKind }>(rows: readonly T[], joining: { id: string; kind: SpaceKind }): T[] {
  if (joining.kind !== 'class') return [];
  return rows.filter((r) => r.kind === 'class' && r.spaceId !== joining.id);
}

/** "{learner} stays in {A} too. To move instead, use Move or ask the teacher." */
export function staysInLine(learner: string, classes: readonly string[], m: JoinCopy): string {
  return m.join.confirm.staysIn(learner, classes);
}

/**
 * A class tablet the move left without its class (the Worker refuses its old class-scoped credential, and `/join`
 * refuses a class-scoped device anyway) can only come back through the roster pick, which the teacher approves; so
 * "I'm new" is hidden there. `rejoin` is the store's `rejoinByLearner` value: true while the "Join your new class
 * again." line waits, false once shown, undefined when this session never saw it (then a tablet with no class left
 * counts too).
 */
export function rosterPickOnly(i: { classDevice: boolean; kind: SpaceKind; rosterSize: number; rejoin: boolean | undefined; classRows: number }): boolean {
  if (!i.classDevice || i.kind !== 'class' || i.rosterSize === 0) return false;
  return i.rejoin !== undefined || i.classRows === 0;
}
