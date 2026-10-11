import { plural } from '../../plural';

/**
 * Learner-facing screens, one sub-object per screen (F-I18N-001 §3.4 rule 2).
 * PR 5 moves the first-run and settings surfaces in, PR 6a Home, Journey, Library and
 * CardDetail; the wording is unchanged. Strings that end up in a pill or a button are
 * keyed `pill` / `cta` so the length budgets (§3.11) cover them.
 * Content-derived text (stage, theme and card titles, blurbs) is not here: it comes from
 * content and is localised by the overlay mechanism (PR 12).
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

  home: {
    /** `null` while there is no active profile. */
    greeting: (name: string | null) => `Hi, ${name ?? 'friend'}!`,
    subtitle: "Ready for today's quest?",
    /** Caption under the learner's cub, the way into profiles and settings. */
    profileLabel: 'Profile',
    streak: {
      pill: (days: number) => plural('en', days, { one: 'Streak 1 day', other: `Streak ${days} days` }),
    },
    cards: { pill: (cards: number) => `${cards} cards` },
    stars: { pill: (quests: number) => `${quests}★ quests` },
    mission: { heading: 'Today with Hoya' },
    progress: {
      heading: 'Stage 1 progress',
      label: (done: number, total: number) => `${done} of ${total} quests`,
    },
    homework: { title: 'Homework', due: (count: number) => `${count} to do today` },
    tip: "Tip — finish today's quest to keep your streak alive!",
    recentStars: 'Recent stars',
  },

  journey: {
    title: 'Heritage Journey',
    intro: '7 stages × 5 themes. Draw your own route.',
    premium: { pill: 'Premium' },
    tasteNote: 'A taste of this stage is open now. More episodes are coming.',
    how: {
      title: 'How the journey works',
      body: 'Each cell is one episode. Finish every quest in a cell to complete it and earn its Heritage cards. More stages open as the journey grows.',
    },
  },

  library: {
    title: 'Heritage Library',
    collected: {
      line: (collected: number, total: number) => `${collected} of ${total} collected`,
      pill: (collected: number, total: number) => `${collected}/${total}`,
    },
    filterAll: 'All',
    locked: 'Locked',
    /** Keyed by the schema's `Rarity`, so `es` and `ko` can translate each. */
    rarity: { common: 'common', uncommon: 'uncommon', rare: 'rare', legendary: 'legendary' },
    how: { title: 'How to collect more', body: 'Finish quests to unlock cards.' },
  },

  cardDetail: {
    notFound: 'Card not found.',
    /** The hint on the flip control, by the face being shown. */
    flip: { front: 'tap to flip', back: 'tap to flip back' },
    hear: { cta: 'Hear it' },
    share: { cta: 'Share', error: "Couldn't make the picture this time. Try again?" },
  },
} as const;
