import type { DeviceAudience } from './profiles/learner-type';

/**
 * Neutral "ask a grown-up" copy — F-LEARN-001 §3.9, audit UF-08.
 *
 * The single place these strings live, so F-I18N-001 can move them into the
 * catalogs as one block. The default is a neutral sentence; the family
 * audience adds "(a grown-up can help)" only where an adult really is needed,
 * and "Grown-up zone" stays a family caregiver surface (CLAUDE.md §1).
 * Nothing here names an age or says "for kids".
 *
 * The screens and logic modules that still hold the old wording switch to this
 * module in F-LEARN-001 PR 5.
 */

export interface AudienceCopy {
  /** Install sheet heading (web). */
  installGuideLine: string;
  /** Second line under the install heading; null when the audience gets none. */
  installGuideHelp: string | null;
  /** Accessible label of a locked Journey stage. */
  journeyLockedA11y: (stageTitle: string) => string;
  /** Home card caption when no homework is due. */
  homeReviewsIdle: string;
  homeworkIntro: string;
  restorePrompt: string;
  restoreSignInLabel: string;
  /** Sentence appended to the "cards are back" line of a Rescue Code restore. */
  restoreCardsBack: string;
  spacesNoClass: string;
  /** A learner already in three classes tries to join another. */
  joinCodeFull: string;
  /** A code that is not a class code was entered. */
  joinCodeNotForLearners: string;
  promoHint: string;
  paywallBuyOnWeb: string;
  paywallBuyLater: string;
  profileSwitchHint: string;
  /** Label of the account and backup section. */
  zoneLabel: string;
  /**
   * Accessible label of a gated control: `base`, an optional `detail`, and
   * "PIN required" when the device is gated (always on a family device; on a
   * self-only device only once the learner has set a PIN, L7).
   */
  gatedA11y: (base: string, pinSet: boolean, detail?: string) => string;
}

const SHARED = {
  installGuideLine: 'Add me to your home screen.',
  journeyLockedA11y: (stageTitle: string) => `${stageTitle}: locked. Opens the unlock page.`,
  homeReviewsIdle: 'Reviews picked for you',
  homeworkIntro: 'Picked by Hoya, your teacher or your family.',
  restorePrompt: 'Got a rescue code, an account, or a saved file?',
  restoreSignInLabel: 'Sign in',
  restoreCardsBack: 'Your cards come back with your rescue code.',
  spacesNoClass: 'Not in a class yet. Got a code from a teacher or your family?',
  joinCodeFull: "You're already in three classes. Leave one in Settings first.",
  joinCodeNotForLearners: "That code isn't for joining as a learner. Ask for a class code.",
  promoHint: 'Have a promo or referral code? Enter it on the web console.',
  paywallBuyOnWeb:
    'Buy it once on the web console, so no store fees reach your family. Sign in there and come back — this device updates on its next sync.',
  paywallBuyLater:
    'Buying inside this app arrives with the store update. Until then, you can buy it once on the web console.',
  profileSwitchHint: 'Tap a profile to switch.',
} as const;

function gated(base: string, detail: string | undefined, pinRequired: boolean): string {
  const parts = [detail, pinRequired ? 'PIN required' : undefined].filter((p): p is string => p !== undefined);
  return parts.length === 0 ? base : `${base} (${parts.join(', ')})`;
}

const FAMILY: AudienceCopy = {
  ...SHARED,
  installGuideHelp: 'A grown-up can help.',
  zoneLabel: 'Grown-up zone',
  gatedA11y: (base, _pinSet, detail) => gated(base, detail, true),
};

const SELF: AudienceCopy = {
  ...SHARED,
  installGuideHelp: null,
  zoneLabel: 'Account & backup',
  gatedA11y: (base, pinSet, detail) => gated(base, detail, pinSet),
};

export function audienceCopy(audience: DeviceAudience): AudienceCopy {
  return audience === 'family' ? FAMILY : SELF;
}
