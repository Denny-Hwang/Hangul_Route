import { playerGuard } from '../logic/episode-access';
import { useMembershipStore } from './membership-store';
import { questOpenFor, useTierStore } from './tier-store';

export type PlayerGuard = ReturnType<typeof playerGuard>;

export interface SettleDeps {
  /** Reads the learner's saved tier and memberships into memory (each store's own `hydrate`). */
  hydrate: (learnerId: string) => Promise<unknown>;
  /** "May this learner start this quest?" once the stores are read. */
  openFor: (learnerId: string) => (questId: string) => boolean;
  /** How long the stores get before the first answer stands (a stalled storage read never strands the player). */
  timeoutMs: number;
}

const defaultDeps: SettleDeps = {
  hydrate: (learnerId) =>
    Promise.all([useTierStore.getState().hydrate(learnerId), useMembershipStore.getState().hydrate(learnerId)]),
  openFor: (learnerId) => questOpenFor(learnerId, new Date()),
  timeoutMs: 1500,
};

/**
 * The quest player's guard once the learner's tier and memberships are read (F-ENT-003 section 3.6).
 * `accessTier` answers free until those stores hydrate, so a premium or class learner whose player
 * mounts first (a reload on a quest route, a tap right after launch) would be sent to the preview of
 * a quest they own. The screen asks this before it redirects; it re-checks after the read, or after
 * `timeoutMs` with whatever the stores hold then. Never throws: a failed read re-checks at once.
 */
export async function settledPlayerGuard(
  input: { learnerId: string | null; questId: string; episodeId: string },
  deps: SettleDeps = defaultDeps,
): Promise<PlayerGuard> {
  if (input.learnerId) {
    const learnerId = input.learnerId;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, deps.timeoutMs);
    });
    await Promise.race([deps.hydrate(learnerId).catch(() => undefined), timeout]);
    if (timer !== undefined) clearTimeout(timer);
  }
  return playerGuard(deps.openFor(input.learnerId ?? ''), input.questId, input.episodeId);
}
