import type { MissionPlan } from '../logic/homework/mission-builder';

/**
 * Today's mission pinned for the app session (F-HW-001 §3.2, F-STORY-004 §3.7 "Pinned all day",
 * PR 4.8c), keyed by profile and day. Home reads it instead of a ref of its own, so the pin outlives
 * the screen: Results' Back home resets the stack to `Main`, which mounts Home again, and the cards
 * must not reshuffle under the learner. In memory only: a fresh app session builds the plan again.
 * One pin per profile; a new day's pin drops that profile's older one.
 */
const pins = new Map<string, MissionPlan>();

/** The plan pinned for this profile and day this app session, else null. */
export function pinnedMission(profileId: string, date: string): MissionPlan | null {
  const pin = pins.get(profileId);
  return pin && pin.date === date ? pin : null;
}

/** Pin a plan for its profile and day, replacing any earlier pin of that profile. */
export function pinMission(plan: MissionPlan): void {
  pins.set(plan.profileId, plan);
}

/**
 * The topics whose Speed Round reached its results today (F-VOC-005 section 3.7, PR P-3): the Home
 * "Words are ready" card is collected once a round of its topic completes. Same lifetime as the pin
 * (this app session, one day per profile), so it is kept here; `vocab-run-store` marks it.
 */
const roundsDone = new Map<string, { date: string; topics: Set<string> }>();
const NONE: ReadonlySet<string> = new Set();

/** Records a completed Speed Round of `topicKey` for this profile and day; an older day's record is dropped. */
export function markVocabRoundDone(profileId: string, date: string, topicKey: string): void {
  const row = roundsDone.get(profileId);
  if (row && row.date === date) row.topics.add(topicKey);
  else roundsDone.set(profileId, { date, topics: new Set([topicKey]) });
}

/** The topics whose Speed Round completed for this profile and day this app session. */
export function vocabRoundsDone(profileId: string, date: string): ReadonlySet<string> {
  const row = roundsDone.get(profileId);
  return row && row.date === date ? row.topics : NONE;
}

/** Drop every pin and every round record (tests). */
export function clearMissionPins(): void {
  pins.clear();
  roundsDone.clear();
}
