import type { LearnerType } from '@hangul-route/content-schema';

/**
 * Every string the CreateProfile form owns, in one module — F-LEARN-001 D2, so
 * F-I18N-001 PR 5 can move them into the catalogs as a block. English only
 * until then. Level labels and descriptions are not here: they come from
 * `LEARNER_LEVELS`; avatar labels from `AVATAR_PRESETS`. Nothing names an age
 * or says "for kids" (CLAUDE.md §1).
 */
export const CREATE_PROFILE_COPY = {
  title: 'Who is learning?',
  who: {
    self: { label: 'Me', sub: "I'm 13 or older" },
    child: { label: 'My child or a student', sub: 'A grown-up sets it up' },
  },
  levelHelper: 'You can change this any time in Profile.',
  avatarHeading: 'Pick a Hoya',
  guardian: {
    heading: 'For a grown-up',
    body: 'A parent, guardian or teacher sets up the account. We collect as little as possible and never show ads.',
    pinHeading: 'Create a grown-up PIN',
    agree: "I'm a parent or guardian of this learner (or I set it up for them) and I agree to the Privacy Policy.",
  },
  self: {
    heading: 'Before you start',
    body: 'We collect as little as possible and never show ads.',
    pinRow: 'Protect settings with a PIN (optional)',
    pinHeading: 'Create a PIN',
    agree: "I'm 13 or older and I agree to the Privacy Policy.",
  },
  email: {
    label: 'Email (optional)',
    caption: 'For progress backup and receipts.',
    placeholder: 'name@email.com',
    invalid: 'That email looks off. Check the spelling.',
  },
  /** The create-and-confirm field's own lines moved to `caregiver.pin.setup` with `PinSetupField` (PR 8a). */
  pin: {
    failed: "Couldn't set the PIN. Try again.",
  },
  privacyLink: 'Read the Privacy Policy',
  ready: {
    heading: 'Ready to go!',
    /** The app backs up the name, level and cub on start and after each change, with no sign-in (F-SYNC-002). */
    line: 'Your name and choices are saved on this device and backed up to our servers. No sign-in needed.',
  },
  back: 'Go back',
  continue: 'Continue',
  namePlaceholder: 'Type a name',
} as const;

export interface WhoCopy {
  nameLabel: string;
  levelHeading: string;
}

/** Wording of the name and level questions: first person for a learner, third for a child or student. */
export function whoCopy(learnerType: LearnerType): WhoCopy {
  return learnerType === 'self'
    ? { nameLabel: 'Your name', levelHeading: 'How do you like to learn?' }
    : { nameLabel: 'Their name', levelHeading: 'How do they like to learn?' };
}
