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

/** Drop every pin (tests). */
export function clearMissionPins(): void {
  pins.clear();
}
