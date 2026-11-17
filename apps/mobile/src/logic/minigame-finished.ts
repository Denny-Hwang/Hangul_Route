import type { MinigameKind } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../platform/telemetry';

/**
 * The `minigame.finished` event a minigame step sends when it closes (MinigameScreen). Its payload
 * is the game kind and where the step sits, nothing else: never the content a learner read
 * (realia text, a word, an answer). Shared with the fixture build's Realia Read e2e host
 * (`navigation/realia-read-e2e.tsx`, row G-2), so its telemetry check runs on the same payload.
 */
export function minigameFinishedEvent(kind: MinigameKind, questId: string, stepIndex: number, profileId?: string): TelemetryEvent {
  return { name: 'minigame.finished', profileId, payload: { kind, questId, stepIndex } };
}

/** The run fields `gameFinishIsReported` reads (`quest-run-store`). */
export interface FinishRun {
  questId: string | null;
  furthestStep: number;
  reportOnce: (event: string, step: number) => boolean;
}

/**
 * [QB] Whether `minigame.finished` is sent for a game of `questId` that just ended on `stepIndex` (AMENDMENTS-QUEST-SOUND-BACK
 * QB-3): once per step per run. A game played again on a step shown after Previous sends nothing; a skipped game
 * played after all sends it then, for the first time. On the furthest step it is sent as it always was (a story told
 * in parts ends once per part), and a game that is not of the run in the store is not counted.
 */
export function gameFinishIsReported(run: FinishRun, questId: string, stepIndex: number): boolean {
  if (run.questId !== questId) return true;
  const first = run.reportOnce('minigame.finished', stepIndex);
  return first || stepIndex >= run.furthestStep;
}
