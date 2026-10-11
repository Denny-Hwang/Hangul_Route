/**
 * The Home "Take the level check" card (F-PLC-001 section 3.10): a quiet
 * card below the mission cards. No streak or guilt copy; "Not now" hides it.
 */

/** The card disappears once this many quests are complete. */
export const HOME_CARD_MAX_QUESTS = 3;

export interface LevelCheckCardInput {
  /** `flags.placementEnabled`. */
  enabled: boolean;
  /** The bank parsed at start; a failure hides every entry point (section 3.11). */
  bankReady: boolean;
  /** The active profile has a stored result. */
  hasResult: boolean;
  /** Completed quests of the active profile. */
  questsDone: number;
  /** `placement-ui:<profileId>.dismissedAt`. */
  dismissedAt: string | undefined;
  /** A saved run can be offered as Continue. */
  resumable: boolean;
}

/** `take` ("Take the level check"), `continue` ("Continue the level check"), or null (hidden). */
export function levelCheckCard(input: LevelCheckCardInput): 'take' | 'continue' | null {
  if (!input.enabled || !input.bankReady || input.hasResult) return null;
  if (input.questsDone >= HOME_CARD_MAX_QUESTS) return null;
  if (input.dismissedAt !== undefined && input.dismissedAt !== '') return null;
  return input.resumable ? 'continue' : 'take';
}

/**
 * At most one quiet card between the mission cards and the route strip: the
 * level-check card while it is eligible, then F-PLAN-002's weekly-plan prompt.
 */
export function homeQuietCard(
  levelCheck: 'take' | 'continue' | null,
  planPromptEligible: boolean,
): 'level-check' | 'plan-prompt' | null {
  if (levelCheck !== null) return 'level-check';
  return planPromptEligible ? 'plan-prompt' : null;
}
