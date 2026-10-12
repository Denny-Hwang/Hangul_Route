import type { Messages } from '@hangul-route/i18n';
import type { DeviceAudience } from './profiles/learner-type';

/**
 * Neutral "ask a grown-up" copy — F-LEARN-001 §3.9, audit UF-08.
 *
 * The words live in the dictionary (`caregiver.audience`, F-I18N-001 PR 8a); this
 * module only picks the family or self-only variant and takes the message subtree
 * as a parameter, so it stays pure and testable per locale (§3.4 rule 3). Logic
 * modules with no device in hand (`join-code`, `restore`) read the audience-free
 * lines from `caregiver.audience.shared` the same way. The
 * default is a neutral sentence; the family
 * audience adds "(a grown-up can help)" only where an adult really is needed,
 * and "Grown-up zone" stays a family caregiver surface (CLAUDE.md §1).
 * Nothing here names an age or says "for kids".
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
  profileSwitchHint: string;
  /** Label of the account and backup section. */
  zoneLabel: string;
  /** PIN screen titles and the create-step line (F-LEARN-001 §3.4). */
  pinVerifyTitle: string;
  pinCreateTitle: string;
  pinCreateSubtitle: string;
  /**
   * Accessible label of a gated control: `base`, an optional `detail`, and
   * "PIN required" when the device is gated (always on a family device; on a
   * self-only device only once the learner has set a PIN, L7).
   */
  gatedA11y: (base: string, pinSet: boolean, detail?: string) => string;
}

type AudienceMessages = Messages['caregiver']['audience'];

export function audienceCopy(audience: DeviceAudience, m: AudienceMessages): AudienceCopy {
  if (audience === 'family') {
    return {
      ...m.shared,
      ...m.family,
      gatedA11y: (base, _pinSet, detail) => m.gated(base, true, detail),
    };
  }
  return {
    ...m.shared,
    installGuideHelp: null,
    ...m.self,
    gatedA11y: (base, pinSet, detail) => m.gated(base, pinSet, detail),
  };
}
