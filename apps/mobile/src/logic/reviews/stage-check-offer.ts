import { CURR_TELEMETRY_PAYLOADS, type ReviewEntry, type StageKey } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../../platform/telemetry';
import { PRIZE_STAGES } from '../stage1/stage-complete';

/**
 * What a Stage 2-7 header, ceremony and summary offer (F-CURR-002 sections 4.5, 7.3, 12.2 and OD-1, row CM-22;
 * design/wireframes/reviews/stage-check.md B, C and G). Pure; read by the Stage Check's screen chunk only, never by
 * the memory chunk, so the two share no module.
 *
 * - **See your prize** (C): a finished Stage 2-7 while `stageChecks` is on; it reopens the ceremony (B).
 * - **The Stage Check** (B's primary, C's second button): a finished stage, `stageChecks` and `memoryRecord` on, 10 or
 *   more playable rounds, and every quest of the stage open to the learner (F-ENT-003: a stage the learner cannot open
 *   is not offered). Once taken, C's button carries the best stars ("Stage Check, best 2 stars"). It never gates:
 *   nothing else reads it (OD-1).
 * - **The stage card** (B, G): the cards that finishing the stage awards and the learner holds, while `upperCards` is
 *   on (row CM-23 ships them; until then the block is left out).
 * - **The tested-out caption** (C, cell-check.md States): a stage not finished whose every cell is done or tested out,
 *   one at least tested out, while `cellCheck` is on: "Play the quests you tested out of to finish this stage."
 * - **`stageChecks` off** (section 12.2): no prize button, no ceremony and no Stage Check; the latched results stay
 *   and show again when it is back on.
 */

/** The best stars of the stage's Stage Checks (`stage-certificate` entries of its scope), 0 when none was finished. */
export function bestStageStars(reviews: readonly Pick<ReviewEntry, 'kind' | 'scope' | 'resultStars'>[], stage: StageKey): 0 | 1 | 2 | 3 {
  let best: 0 | 1 | 2 | 3 = 0;
  for (const r of reviews) if (r.kind === 'stage-certificate' && r.scope === stage && (r.resultStars ?? 0) > best) best = r.resultStars ?? 0;
  return best;
}

export interface StageOfferInput {
  stage: StageKey;
  complete: boolean;
  /** `stageChecks` on for the learner (the ceremony and the prize button). */
  ceremonyOn: boolean;
  /** `stageChecks` and `memoryRecord` on for the learner (the Stage Check itself). */
  checkOn: boolean;
  /** The stage has 10 or more playable rounds (unknown while it is read: not offered yet). */
  playable: boolean;
  /** Every quest of the stage is open to the learner (`useQuestAccess`, F-ENT-003). */
  open: boolean;
  bestStars: 0 | 1 | 2 | 3;
}

export interface StageOffer {
  prize: boolean;
  /** The Stage Check button, with the best stars once one was finished; null when it is not offered. */
  check: { bestStars: 0 | 1 | 2 | 3 } | null;
}

export function stageOffer(i: StageOfferInput): StageOffer {
  const upper = PRIZE_STAGES[i.stage]?.ceremony === 'stage';
  const prize = upper && i.complete && i.ceremonyOn;
  const check = prize && i.checkOn && i.playable && i.open ? { bestStars: i.bestStars } : null;
  return { prize, check };
}

/** The tested-out caption under a stage header: every cell done or tested out, one at least tested out, the stage not finished. */
export function testedOutHint(input: { complete: boolean; cellCheckOn: boolean; cells: readonly { done: boolean; testedOut: boolean }[] }): boolean {
  if (input.complete || !input.cellCheckOn || input.cells.length === 0) return false;
  return input.cells.every((c) => c.done || c.testedOut) && input.cells.some((c) => c.testedOut && !c.done);
}

/** The stage cards the ceremony and the summary show: the stage's prize cards the learner holds, while `upperCards` is on. */
export function shownStageCards<C extends { id: string }>(prize: readonly C[], owned: readonly { cardId: string }[], upperCardsOn: boolean): C[] {
  if (!upperCardsOn) return [];
  const have = new Set(owned.map((c) => c.cardId));
  return prize.filter((c) => have.has(c.id));
}

/**
 * The cards a Stage 2-7 ceremony and the summary can show (row CM-23): the stage's prize cards (`stage<N>-complete`,
 * none yet), then its upper-cell cards, one per cell in the album table's order. `shownStageCards` keeps the held ones.
 */
export function stageCeremonyCards<C extends { id: string; stage: StageKey }>(stage: StageKey, prize: readonly C[], albumIds: readonly string[], cards: readonly C[]): C[] {
  const album = albumIds.flatMap((id) => cards.filter((c) => c.id === id && c.stage === stage && !prize.some((p) => p.id === id)));
  return [...prize, ...album];
}

/**
 * The ceremony's motion (F-MOTION-003, stage-check.md States): the title and the card drop in with a spring after
 * 400 ms, then five amber sparkles fade over about 600 ms. Reduced motion: everything is there at once, no drop and no
 * sparkles. No confetti, no sound (F-MOTION-003 section 4).
 */
export function ceremonyMotion(reducedMotion: boolean): { drop: boolean; sparkles: boolean; delayMs: number } {
  return reducedMotion ? { drop: false, sparkles: false, delayMs: 0 } : { drop: true, sparkles: true, delayMs: 400 };
}

/** `stage.card_opened { stage }` (goal G5), parsed before it is sent; null when it does not parse. No profile id in the payload. */
export function stageCardOpenedEvent(profileId: string, stage: StageKey): TelemetryEvent | null {
  const payload = CURR_TELEMETRY_PAYLOADS['stage.card_opened'].safeParse({ stage });
  return payload.success ? { name: 'stage.card_opened', profileId, payload: payload.data } : null;
}
