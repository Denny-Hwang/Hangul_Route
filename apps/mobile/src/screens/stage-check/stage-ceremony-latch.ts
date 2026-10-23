import type { StageKey } from '@hangul-route/content-schema';
import { withStageCeremony } from '../../logic/reviews/stage-ceremony';
import { notifyProgressPersisted } from '../../logic/sync/persist-hook';
import { useProgressStore } from '../../store/progress-store';

/*
 * The `stageCeremonyAt` writer and the summary's shown-once mark (F-CURR-002 section 4.8 step 7, row CM-22), part of the
 * Stage Check's chunk: Results reaches the writer through the entry's `latchStageCeremonyLater`, the summary and Home's
 * trigger import it here.
 */

/**
 * Writes a `stageCeremonyAt` key for each stage on the hydrated snapshot (earliest wins), saved and synced like any
 * write; nothing when every stage already holds one. Results calls it for the stage whose ceremony it offers, the
 * summary for every stage it lists.
 */
export function latchStageCeremony(profileId: string, stages: readonly StageKey[], now: Date = new Date()): void {
  const progress = useProgressStore.getState();
  const snap = progress.hydratedFor.has(profileId) ? progress.byProfile[profileId] : undefined;
  if (!snap) return;
  const next = withStageCeremony(snap, stages, now.toISOString());
  if (next === null) return;
  progress.replaceSnapshot(profileId, next);
  notifyProgressPersisted(profileId);
}

/** Profiles whose summary this app session already showed: Home never opens it twice, even if a write fails. */
const recapOpened = new Set<string>();

/** The summary marks itself shown when it mounts (a navigation that a reset dropped is tried again on the next focus). */
export function markStageRecapShown(profileId: string): void {
  recapOpened.add(profileId);
}

export function stageRecapShown(profileId: string): boolean {
  return recapOpened.has(profileId);
}
