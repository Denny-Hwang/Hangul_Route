import { plural } from '../../plural';

/**
 * Learner-facing screens, one sub-object per screen (F-I18N-001 §3.4 rule 2).
 * PR 5 moves the first-run and settings surfaces in; the wording is unchanged.
 * A message never embeds taught Korean (rule 5): the endonyms in the language
 * picker are passed in as arguments (they are constants, `LOCALE_META`).
 */

const count = (n: number, one: string, other: string): string => `${n} ${plural('en', n, { one, other })}`;

export const learner = {
  welcome: {
    title: "Hi! I'm Hoya.",
    invitation: 'Want to learn Korean letters with me? It only takes a few minutes a day.',
    cta: "Let's start",
    restore: 'I already have progress',
    trust: 'Start Korean from zero. Built with kids, parents, and grandparents in mind.',
  },

  /** The language chips (Welcome) and the Language card (Profile) share these. */
  language: {
    groupLabel: 'Language',
    sameAsDevice: (endonym: string) => `Same as this device (${endonym})`,
    /** The sheet is written in the language being chosen, so the person sees at once whether they can read it. */
    confirmProfile: (endonym: string) => `Use ${endonym} for this profile?`,
    confirmDevice: (endonym: string) => `Use ${endonym} on this device?`,
    confirmUse: (endonym: string) => `Use ${endonym}`,
    confirmBack: (endonym: string) => `Back to ${endonym}`,
  },

  /** Only the strings that were not already owned by `logic/onboarding/create-profile-copy.ts` (F-I18N-001 PR 5 row). */
  createProfile: {
    nameHint: {
      tooLong: (max: number) => `Names can be up to ${max} letters.`,
      unsupportedCharacter: "Please use letters, numbers, spaces, ' or -.",
    },
  },

  /** Cub labels, keyed by `AvatarKind` so `es` and `ko` can translate them. */
  avatars: {
    'hoya-orange': 'Book Tiger',
    'hoya-blue': 'Home Tiger',
    'hoya-green': 'Feast Tiger',
    'hoya-purple': 'Mountain Tiger',
    'hoya-pink': 'Craft Tiger',
  },

  firstQuest: {
    title: 'Your first card is waiting.',
    bubble: "In your first quest you'll meet Korean letters and earn a Heritage card.",
    bubbleNoQuest: 'Let me show you around first!',
    summary: (quests: number, minutes: number, cards: number) =>
      `${count(quests, 'quest', 'quests')} · about ${count(minutes, 'minute', 'minutes')} · ${count(cards, 'card', 'cards')} waiting`,
    firstUp: 'First up',
    /** Quest title, then its blurb when there is one. */
    questLine: (title: string, blurb: string | null) => (blurb === null || blurb === '' ? title : `${title} — ${blurb}`),
    cta: 'Start my journey',
  },

  profile: {
    title: 'Profiles & settings',
    switchTo: (name: string) => `Switch to ${name}`,
    playingNow: 'Playing now',
    addProfile: '+ Add a profile',
    /** The name the grown-up gate wraps in its own hint ("Add a profile (PIN required)"). */
    addProfileName: 'Add a profile',
    statsTitle: (name: string | null) => `${name ?? 'Your'} stats`,
    stats: { quests: 'Quests done', cards: 'Cards', threeStar: '3-star quests' },
    sound: { label: 'Sound', on: 'On', off: 'Off' },
    plan: {
      premium: 'Premium',
      free: 'Free plan',
      unlocked: (sponsor: string | null) =>
        sponsor === null ? 'The full journey is unlocked.' : `The full journey is unlocked — covered by ${sponsor}.`,
      freeNote: 'Stage 1 is free. More stages are on the way.',
      pillActive: 'Active',
      pillFree: 'Free',
      unlock: 'Unlock the journey',
    },
    install: { label: 'Install on this device', a11yLabel: 'Install Hangul Route on this device' },
    /** Shown when more than one language is offered (hidden while only English ships). */
    language: {
      title: 'Language',
      thisProfile: 'This profile',
      deviceDefault: 'New profiles and this device start in:',
    },
    /** Always shown: it does not depend on a second language (F-I18N-001 D2). */
    reading: {
      title: 'Reading practice',
      hideUntilTap: 'Hide romanization until I tap',
      on: 'On',
      off: 'Off',
    },
  },
} as const;
