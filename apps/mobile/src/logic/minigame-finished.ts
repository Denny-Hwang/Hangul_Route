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
