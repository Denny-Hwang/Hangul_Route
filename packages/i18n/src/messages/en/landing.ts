/**
 * The public site (hangulroute.com): metadata, the landing page, About, the launch-news
 * form, and the Privacy Policy and Terms of Service (F-I18N-001 §3.4 rule 2, PR 11a).
 *
 * The English is the pages' former text, byte for byte. Lists are objects keyed by id (the
 * dictionary holds only strings, arrays of strings and functions), so the pages keep their
 * order from the key order and an overlay can translate one item at a time.
 *
 * Rules that apply here:
 * - Public surface (CLAUDE.md §1): never kids-only framing, never an age range. Checked per
 *   locale by landing-messages.test.ts and by apps/web audience-copy.test.ts.
 * - Taught Korean (the letter in the hero, Hoya's "almost there" phrase) is never written into a
 *   message: the page passes it in, with its romanization (§3.4 rule 5).
 * - `legal.privacy` and `legal.terms` are English-authoritative until legal review (decision L10,
 *   §4): an `es` / `ko` overlay must not translate them before that review; until then those
 *   locales show this English text under a localized notice (`legal.englishAuthoritative`, PR 11c). Enforced by
 *   ENGLISH_AUTHORITATIVE_PREFIXES (resolve.ts): `fallbackPaths` leaves them out and
 *   messages.structure.test.ts fails on an overlay leaf under them.
 * - The launch-news consent line (`waitlist.consentLead` + `contactLink` + `privacyLink`) must stay
 *   in step with CONSENT_TEXT_VERSION on the API.
 */
import {
  FAMILY_LIFETIME_LEARNERS,
  GROUP_LICENSE_LEARNERS,
  SCHOOL_ADMIN_CAP,
  SCHOOL_LICENSE_TEACHERS,
} from '@hangul-route/content-schema';
import { plural } from '../../plural';

/**
 * Two answers of the learners page's questions (F-SITE-002 §3.4), carried over word for word from the old landing's
 * questions block, which S-6 removed.
 */
const FAQ_ADULT = {
  q: 'I’m an adult beginner. Will it feel too young?',
  a: 'No. Stage 1 teaches exactly what any beginner needs first — the letters and their sounds — with no baby talk. Hoya is friendly, and the culture cards are worth collecting at any age.',
} as const;
const FAQ_KOREAN = {
  q: 'Do I need to know any Korean?',
  a: 'No. Starting from zero is what we built it for. Menus are in simple English, Spanish or Korean, and every Korean word comes with its romanization and meaning.',
} as const;

/**
 * Both payment channels (F-SITE-002 §3.7, S-7, OD-13), word for word as the spec gives them: Stripe Checkout on
 * app.hangulroute.com after sign-in (F-BILL-002), the stores in the native apps when they offer purchases
 * (F-ENT-001 §3.5, F-IAP-002). The Privacy Policy and the Terms both open their payment text with it, so the
 * copies cannot drift. English-authoritative (L10); no price (OD-7).
 */
const PAYMENT_CHANNELS =
  'On the web, a grown-up pays through Stripe after signing in at app.hangulroute.com. In the iPhone and Android apps, purchases (when offered) go through the App Store or Google Play.';

/** Values the legal pages pass to the few sentences that name the contact address or the level labels. */
export interface LegalValues {
  email: string;
  levels: string;
  /**
   * [GU] The days a never-saved first quest is kept without play (`GUEST_TTL_DAYS`, AMENDMENTS-GUEST-FIRST-LESSON
   * GU-D13), and on a device that already has learner profiles (`GUEST_TTL_SHARED_DAYS`).
   */
  days: number;
  sharedDays: number;
}

export const landing = {
  /** `<head>` metadata (`siteMetadata` in apps/web/src/data/landing-copy.ts). */
  meta: {
    title: 'Hangul Route — Learn Hangul from zero with Hoya',
    tagline: 'Learn Hangul from zero, at any age.',
    /**
     * What is built, with no typed counts (F-SITE-002 §3.12): the alphabet, then words, sentences and stories (later
     * stages ship: content/episodes/stage-2 to stage-7, stories and word topics), Stage 1 free, Hoya, no ads. No price,
     * no term, and no stage, theme or mini-game count.
     */
    description:
      'Learn Hangul from zero with Hoya the tiger, at any age. Five-minute quests teach the Korean alphabet, then words, sentences and stories. Stage 1 is free. No ads, ever.',
    keywords: ['learn Hangul', 'Korean alphabet', 'learn Korean', 'Korean for beginners', 'heritage Korean', 'K-culture learning', 'Hoya'],
    ogDescription: 'Learn the Korean alphabet from zero with Hoya the tiger, at any age, and collect Korean culture cards. Stage 1 is free.',
    twitterDescription: 'Learn the Korean alphabet from zero with Hoya the tiger, at any age, and collect Korean culture cards.',
    /** Per-page `<title>` and description of the three persona pages (F-SITE-002 §3.12, S-4a / S-4b). No typed counts. */
    pages: {
      learners: {
        title: 'For learners — Hangul Route',
        description: 'Learn to read, hear and write Hangul from zero in five-minute quests with Hoya the tiger, and collect Korean culture cards. No ads.',
      },
      parents: {
        title: 'For parents and caregivers — Hangul Route',
        description: "Short, kind Hangul lessons with no ads and a grown-up PIN. Create a free family space and see each learner's week.",
      },
      teachers: {
        title: 'For teachers — Hangul Route',
        description: 'Students join with a code, a link or a QR code, with no student emails or accounts. Plan the week and see who practiced. Never a ranking.',
      },
      /** AMENDMENTS-SITE-NEWUSER SN-2: About, the legal pages and the open-source notices get their own title and description too. */
      about: {
        title: 'About Hangul Route',
        description: 'Who makes Hangul Route and the promises we keep.',
      },
      privacy: {
        title: 'Privacy Policy — Hangul Route',
        description: 'What Hangul Route collects, who can see it, and how to delete it.',
      },
      terms: {
        title: 'Terms of Service — Hangul Route',
        description: 'The rules for using Hangul Route.',
      },
      licenses: {
        title: 'Open-source notices — Hangul Route',
        description: 'The open-source software Hangul Route uses.',
      },
    },
  },
  /** The brand in the header and footer; the app name stays "Hangul Route" in every locale (§3.4 rule 6). */
  brand: {
    name: 'Hangul Route',
    mark: 'HR',
  },
  /**
   * The site header (F-SITE-002 §3.2): the persona links, Sign in, Start learning and the skip link. The current
   * page's link carries `aria-current="page"` alone (no hidden suffix: screen readers announce it).
   */
  nav: {
    label: 'Main',
    learners: 'Learners',
    parents: 'Parents',
    teachers: 'Teachers',
    signIn: 'Sign in',
    start: 'Start learning',
    /**
     * [SN] The header's Start pill (AMENDMENTS-SITE-NEWUSER §3.2): its visible label. Its accessible name is `start`,
     * which contains this label in every locale (WCAG 2.5.3 Label in Name).
     */
    startShort: 'Start',
    skip: 'Skip to content',
  },
  /**
   * The layered home `/` (F-SITE-002 §3.3, appendix B.1). `hero.title` is the tagline; the taught letter in Hoya's
   * bubble is passed in with its romanization (CLAUDE.md §1; the page passes the letter's teaching sound value, e.g.
   * `a` for the first letter, ㅏ). `how.routeBody` replaces step 3's line only while the `learningRoute` claim is on;
   * `how.levelBody` replaces step 1's line only while the `levelCheck` claim is on.
   * The promises are titles only; their explanations live on the persona pages.
   */
  home: {
    hero: {
      title: 'Learn Hangul from zero, at any age.',
      lead: 'Hangul is the Korean alphabet. Learn to read, hear and write it with Hoya the tiger.',
      start: 'Start learning',
      /** [SN] The hero's two direct links to `/parents` and `/teachers` (AMENDMENTS-SITE-NEWUSER §3.3). */
      forParents: "I'm a parent or caregiver",
      forTeachers: "I'm a teacher",
      /**
       * Hedged like `persona.learners.faq.offline`: offline opening on iOS 14 is a known open issue (OD-15). No
       * "nothing to install": the app offers Install (PWA). "Stage 1 is free" leads, so a first-time visitor sees the
       * cost above the fold; "No sign-up to start" is the learner's start (grown-ups do sign in, on their pages).
       */
      facts: 'Stage 1 is free · No sign-up to start · Works offline on most devices after your first visit',
      /**
       * A no-break space keeps the letter and its romanization on one line when the bubble wraps. No romanized Korean
       * greeting: taught Korean is passed in with its romanization, never typed here (CLAUDE.md §1).
       */
      bubble: (letter: string, romanization: string) => `Hi! Let's meet ${letter}\u00a0(${romanization}).`,
      /**
       * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 13.2: the hero's one line under the facts line, only while the
       * `guestLesson` claim is on (Start learning then opens quest 1 before any profile). It names what the link does
       * and adds no second action. "a name": the learner's display name, asked after the first quest.
       */
      guest: 'Start your first quest right away. Add a name at the end.',
    },
    who: {
      title: 'Who is it for?',
      items: {
        learners: {
          title: 'Learners',
          body: 'Five-minute quests, a guide who never scolds, and Korean culture cards.',
        },
        parents: {
          title: 'Parents and caregivers',
          body: 'See what your learner practices, with a grown-up PIN and no ads.',
        },
        teachers: {
          title: 'Teachers',
          body: 'Students join with a code, link or QR code. No student accounts.',
        },
      },
    },
    how: {
      title: 'How it works',
      steps: {
        /** The first run: a name and a Hoya (`learner.createProfile.avatarHeading` "Pick a Hoya"); "No sign-up to start" is in the hero facts. */
        start: {
          title: 'Make a profile',
          body: 'Pick a name and a Hoya.',
          /** [GU] Step 1's title while the `guestLesson` claim is on: the first quest comes before the name (GU-0b D16). */
          guestTitle: 'Start right away',
        },
        quests: { title: 'Learn in five-minute quests', body: 'Letters, sounds and first words, with sound and pictures.' },
        /** "Saved and backed up": the app backs up every learner's progress with no sign-in (see `persona.parents.safe.bullets.backup`). */
        collect: {
          title: 'Collect and keep going',
          body: 'Earn Korean culture cards. Your progress is saved and backed up.',
          /**
           * [GU] Step 3's line while the `guestLesson` claim is on: a first quest played before a name is kept in that
           * browser only and is backed up once a name is added (the Privacy Policy's first-quest bullet).
           */
          guestBody: 'Earn Korean culture cards. Add a name, and your progress is saved and backed up.',
        },
      },
      routeBody: 'Earn Korean culture cards and see your whole Learning Route: where you are and what comes next.',
      /**
       * Step 1's line while the `levelCheck` claim is on (F-PLC-001: the level check is offered to every new profile).
       * It follows step 1's title ("Make a profile"), and the level check comes after the profile, as in the app. One
       * line, not a fourth step: the home's word budget (280, F-SITE-002 §3.11) is full with it.
       */
      levelBody: 'Pick a name and a Hoya. A level check is optional.',
      /**
       * [GU] Step 1's line while the `guestLesson` claim is on (AMENDMENTS-GUEST-FIRST-LESSON section 13.2), under
       * `steps.start.guestTitle`: with the `levelCheck` claim on, the level check comes after the first quest (Home's
       * level-check card); with it off, the name comes after the first quest.
       */
      guestLevelBody: 'Play your first quest. Check your level after.',
      guestStartBody: 'Play your first quest, then add a name.',
    },
    promises: {
      /** The section's visually hidden heading. */
      label: 'Our promises',
      items: { ads: 'No ads, ever', safety: 'Child safety first', noRed: 'No red marks' },
    },
    /** [SN] The closing band (AMENDMENTS-SITE-NEWUSER §3.3 item 5): an invitation to Start learning, not a form. */
    closing: {
      title: 'Ready for your first Korean letter?',
      body: 'Stage 1 is free. No email or password. Your first quest takes about five minutes.',
    },
    news: {
      /** Within "launch news" (the consent line, CONSENT_TEXT_VERSION): new stages and plans, nothing else. */
      title: 'Launch news by email',
      body: "We'll email you when family and class plans launch. Nothing else.",
    },
  },
  /**
   * The only cost words on the site (F-SITE-002 §3.9, OD-7): never a price, never a term. The home's cost line is the
   * free line, then the `paid` line the `paidPlans` claim picks. A persona page's Plans block is the free line (never
   * the free limits, owner decision 2026-10-21), then the `paid.coming` line only while plans are coming (`sizes` once
   * they are on sale), then `managedLater` while plans are coming or `managedInApp` once they are on sale, so the host
   * is named once (§3.5). The free plan is all of Stage 1 (F-ENT-003 OD-1), so `free.stage1` is the same in every
   * state and says nothing about paid plans. Plans bought on the web renew
   * yearly (BY-1): the signed-in billing page states the term (the Terms will too, S-7), and no site line names a
   * term or calls a plan one-time.
   */
  plans: {
    title: 'What does it cost?',
    free: {
      stage1: 'Stage 1 is free.',
    },
    paid: {
      /** Later stages already ship (content/episodes/stage-2 to stage-7, stories, word topics); only plans are to come. */
      coming: 'Words, sentences and stories are in the app too. Family and class plans are on the way.',
      inApp: 'Plans for families and classes are at app.hangulroute.com.',
    },
    managedInApp: 'Plans and billing are managed at app.hangulroute.com after you sign in.',
    /** The managed line while plans are still coming (`paidPlans: 'coming'`): nothing is on sale yet to manage. */
    managedLater: 'When plans arrive, you will manage them at app.hangulroute.com after you sign in.',
    /**
     * [SA] AMENDMENTS-SEATS-ADMINS sections 4 and 9.5: the learners each plan holds, the numbers passed in
     * (`FAMILY_LIFETIME_LEARNERS`, `GROUP_LICENSE_LEARNERS`). A persona Plans block shows it in the paid line's place
     * only while plans are on sale (`paidPlans: 'inApp'`). It names a plan, never a price or a term (OD-7).
     */
    sizes: (family: number, group: number) =>
      `The Family Plan is for up to ${plural('en', family, { one: `${family} learner`, other: `${family} learners` })}. The Group License is for up to ${plural('en', group, { one: `${group} student`, other: `${group} students` })} in a class or a school.`,
  },
  /**
   * The three persona pages (F-SITE-002 §3.4 to §3.6, appendix B.2 to B.4). Lines named after a claim (`route`,
   * `reports`, `notes`, `browse`, `lecture`) render only while that claim is on (§3.9); the `browse` lines also need
   * paid plans on sale. The learners page shows no age and no price; the grown-up pages never show a price or a ranking.
   */
  persona: {
    learners: {
      title: 'For learners',
      lead: 'Learn to read, hear and write Hangul, one five-minute quest at a time.',
      learn: {
        title: 'What you learn first',
        body: 'Stage 1 is the Korean alphabet: the letters, their sounds and how they build syllables.',
        /** Reading, listening and writing only: no speaking line (owner decision 2026-10-10). */
        bullets: { read: 'Read letters and syllables', listen: 'Listen and match sounds', write: 'Write letters by tracing them' },
      },
      quest: {
        /**
         * "Most": since F-QUEST-002 Q-8 all 15 Stage 1 quests have Discover and Check steps, but the five reading
         * quests discover words, not a new letter, and the Stage 2 and Stage 4 taste quests have neither.
         */
        title: 'How most quests work',
        bullets: {
          discover: 'Discover: see and hear a new letter.',
          play: 'Play: short mini-games that use it.',
          check: 'Check: a gentle round. Wrong answers get an amber nudge, never red.',
        },
        hoya: 'Hoya the tiger guides every quest and never says “wrong.”',
        gamesFold: 'See the mini-games',
      },
      cards: {
        title: 'Collect Korean culture',
        body: 'Every letter you learn earns a card: a piece of Korean food, art or everyday life.',
        /** The fold's summary; `cards` is `stage1Cards.length`, never a typed number. */
        seeAll: (cards: number) => plural('en', cards, { one: 'See the Stage 1 card', other: `See all ${cards} Stage 1 cards` }),
      },
      route: {
        title: 'Your Learning Route',
        body: 'One map shows where you started, where you are and what comes next.',
      },
      /** Folded questions, in page order. The join-code answer names the labels the learner taps (Home's Profile button). */
      faq: {
        signIn: {
          q: 'Is there a sign-in for learners?',
          a: 'No email or password needed. Open the app and choose your profile, or enter your class or family code. Moving to a new device? Use your Rescue Code.',
        },
        code: {
          q: 'I have a join code. Where do I enter it?',
          /** The join link and its QR code are a class's (console `space.joinLink`); a family shares its code. */
          a: 'Open the join link your teacher shares. Or, in the app, tap Profile, go to Classes & family and tap Join a class.',
        },
        offline: {
          q: 'Does it work offline?',
          a: 'On most devices, yes: after your first visit the app opens without a connection. Letter sounds may need a Korean voice installed on your device.',
        },
        adult: FAQ_ADULT,
        korean: FAQ_KOREAN,
        /**
         * Only while the `levelCheck` claim is on. The label is `learner.placement.invite.knowSome` word for word, so
         * the learner finds the button the answer names.
         */
        level: {
          q: 'I already know some Hangul. Do I have to start at the beginning?',
          a: 'No. When you start, tap “I already know some Korean” and take a level check. Hoya suggests where to begin.',
          /**
           * [GU] The answer while the `guestLesson` claim is on too: the first quest comes first, so the level check is
           * Home's card. The button is `learner.placement.homeCard.take` word for word.
           */
          guestA: 'No. Play the first quest, add a name, then tap “Take the level check”. Hoya suggests where to begin.',
        },
      },
      /** One paragraph under "What you learn first": what comes after Stage 1. */
      after: {
        title: 'After the alphabet',
        body: 'Words, short sentences, conversations and heritage stories, in the same five-minute quests.',
      },
    },
    parents: {
      title: 'For parents and caregivers',
      lead: "For parents, grandparents and every caregiver: short, kind lessons that keep your learner's data private.",
      /** [SN] The primary action: the create view of /signin (AMENDMENTS-SITE-NEWUSER §3.5). */
      create: 'Create a free family space',
      learn: {
        title: 'What they learn',
        body: 'The Korean alphabet first: reading, listening and writing, in five-minute quests.',
        link: 'What learners do',
      },
      safe: {
        title: 'Safe by design',
        bullets: {
          ads: 'No ads, and no data sold.',
          /**
           * Content and safety review in S-3 (review 3), against the code: every learner profile (nickname, level,
           * avatar) and its progress snapshot syncs to the API on start and after each write, with no sign-in
           * (F-SYNC-002, `sync-store.ts`), and a Rescue Code is minted after the first cloud save (F-RESTORE-001). A
           * join shows the space the name the learner joins with (`caregiver.join.confirm.seeYouAs`) and their
           * progress; family caregivers can also recover the full snapshot (`can.ts` `snapshot.read`, the Privacy
           * Policy's `progressWho`).
           */
          backup:
            "Each learner's nickname and progress are kept on the device and backed up to our servers, so they can be restored with a Rescue Code. When a learner joins a class or family with a code, that space sees the name they join with and their progress. A family's grown-ups can also restore their progress.",
          /** The grown-up PIN (PinEntryScreen, F-PROF-001 §3.1), the same sentence as `about.promises.gate`. */
          gate: 'A grown-up PIN guards anything that costs money or deletes data.',
          siblings: 'Siblings can share a device. Each learner keeps their own stars and cards.',
        },
      },
      follow: {
        title: 'Follow along',
        /** True today on the console's family space. */
        body: "Create a free family space, share its code, and see each learner's week: time practiced, quests done and letters to revisit together.",
        reports: 'Reports for today, this week, this month and all time show what went well and what to practice next.',
        route: "Open each learner's Learning Route to see where they are and what comes next.",
        notes: 'Send a short note of encouragement that your learner sees in the app.',
        /** Names the product as the app's billing page does (`console.billing.planTitle.family_lifetime`). */
        browse: 'With the Family Plan, browse every lesson exactly as your learner sees it.',
        /** AMENDMENTS-LECTURE-V2: Stages 1 to 7, phone landscape included. */
        lecture: 'Lecture mode shows ready-made lessons from Stages 1 to 7 on a TV, a laptop or a phone turned sideways, so you can learn together.',
      },
      /** "What can I see?" answers with `whatSee.a`, or `whatSee.reports` while the `parentReports` claim is on. */
      faq: {
        account: { q: 'Does my learner need an account?', a: 'No. Learners never need an email or a password.' },
        learnAlong: { q: 'Can I learn alongside them?', a: 'Yes. Learning Korean yourself? Play the same quests.' },
        whatSee: {
          q: 'What can I see?',
          a: "Each learner's week, in your family space after you sign in. Learners join it with your family code.",
          reports: "Each learner's week and reports, in your family space after you sign in. Learners join it with your family code.",
        },
      },
    },
    teachers: {
      title: 'For teachers',
      lead: 'Students join with a code, you plan the week, and everyone learns at their own pace.',
      /** [SN] The primary action: the create view of /signin (AMENDMENTS-SITE-NEWUSER §3.6). */
      create: 'Create a free class',
      tryIt: 'Try it as a learner',
      setup: {
        title: 'Set up in minutes',
        steps: {
          space: 'Sign in and create a class space.',
          code: 'Share the class code, the join link or its QR code. Students type the code or open the link; no student emails or accounts.',
          devices: 'Students learn on any device with a browser.',
        },
      },
      plan: {
        title: 'Plan and assign',
        bullets: {
          pick: "Pick quests for the week. They appear on each student's homework list.",
          /** Names the console page by its title (`console.curriculum.title`). */
          planner: 'Or use Plan a term: it builds a term plan from your class level and rhythm.',
        },
      },
      class: {
        title: 'See how the class is doing',
        /** True today (the weekly roll-up). */
        body: 'A weekly view shows who practiced and which letters to revisit together. Never a ranking.',
        reports: 'Reports for each student and statistics for the whole class, by day, week, month or all time. Never a ranking.',
        route: "Open each student's Learning Route to see where they are and what comes next.",
        notes: 'Send students a short note of encouragement.',
        /** Names the product as the app's billing page does (`console.billing.planTitle.group_license`). */
        browse: 'With the Group License, preview every lesson exactly as students see it.',
        /** AMENDMENTS-LECTURE-V2: Stages 1 to 7, stories and word topics, phone landscape included. */
        lecture: 'Lecture mode: teach from the front with ready-made slides for Stages 1 to 7, stories and word sets, on a projector, a TV or a phone turned sideways.',
      },
      /**
       * [SN] "Use it across a whole school" (AMENDMENTS-SITE-NEWUSER §3.6, SN-D8). Every fact is live, so no claim gates
       * it; the caps and the address are passed in (`SCHOOL_ADMIN_CAP`, `SCHOOL_LEARNER_CAP`, `CONTACT_EMAIL`). While
       * plans are not on sale (`paidPlans: 'coming'`) `ownerPlan` is not shown and `size` invites a message without
       * naming a product; `ownerPlan` follows `admins` once `paidPlans` is `'inApp'`. `sizeContract` waits for OD-SN-13.
       */
      schools: {
        title: 'Use it across a whole school',
        space: 'Create a school space, then invite teachers or create classes for them.',
        admins: (admins: number) =>
          `Add up to ${plural('en', admins, { one: `${admins} more administrator`, other: `${admins} more administrators` })} with an invite link. They can open class lists and reports and move students between the school's classes.`,
        ownerPlan: "The school's owner manages the plan.",
        moves: 'Move a student to another class in the school. Their family is told, and the student never types a new code.',
        // No seat figure: the school cap is also the free school limit (owner decision (b) 2026-10-21, OD-SN-11).
        size: (email: string) => `Need room for more students? Write to ${email}.`,
        sizeContract: (email: string) => `Need room for more students? Write to ${email} about a School Contract.`,
      },
      privacy: {
        title: 'Privacy for classes',
        bullets: { initials: 'You can show initials instead of names on the class list.', ads: 'No ads, and no data sold.' },
      },
      faq: {
        students: { q: 'Do students need accounts?', a: 'No. They join with the class code, link or QR code.' },
        ranking: { q: 'Is there a leaderboard?', a: 'No. Hangul Route never ranks students against each other.' },
        try: { q: 'Can I try it first?', a: 'Yes. Open the app and play the first quests as a learner.' },
      },
    },
    /** Section headings the persona pages share: the plans block's h2 and the folded questions' visually hidden h2. */
    plansTitle: 'Plans',
    faqTitle: 'Questions',
    /** [SN] The text link under a grown-up page's Create action (AMENDMENTS-SITE-NEWUSER §3.5, §3.6). */
    haveAccount: 'Already have an account? Sign in',
    /** The one line above each persona page's closing action. */
    closing: {
      learners: 'Ready for your first letter?',
      parents: "See your learner's week in one place.",
      teachers: 'Bring Hangul to your class this week.',
    },
  },
  /**
   * [SN] Alt text and captions of the product captures (AMENDMENTS-SITE-NEWUSER §3.13): real screens of the app in
   * the page's locale. Taught Korean (the hero's letter, the card's word) is passed in with its romanization, and
   * the card's meaning is its gloss in the UI language.
   */
  captures: {
    discover: (letter: string, romanization: string) =>
      `The app on a phone, in the first quest: new letters, starting with ${letter} (${romanization}), each with a button to hear it.`,
    home: "The learner's home screen: a greeting, the streak and cards so far, and the next lesson with a Start button.",
    game: 'A mini-game: hear a sound and tap the matching letter.',
    card: (word: string, romanization: string, meaning: string) => `A Korean heritage card: ${word} (${romanization}), meaning ${meaning}.`,
    report: 'A weekly report for one learner: days practiced, what went well and what to practice next.',
    classList: "The class page: this week's summary for the whole class.",
    lectureSlide: 'A Lecture mode slide on a big screen: a letter, its stroke order and its sound.',
    /** The short visible captions under the three `/learners` captures. */
    caption: { home: 'Home screen', game: 'A mini-game', card: 'A heritage card' },
    /**
     * The share image of each locale (`public/site/<locale>/og.png`, §3.14, row SN-2), `og:image:alt` and
     * `twitter:image:alt`; the brand and the locale's tagline are passed in, as the image shows them.
     */
    og: (brand: string, tagline: string) => `Hoya the tiger next to the words ${brand}: ${tagline}`,
  },
  /**
   * The heritage-card grid in the `/learners` cards fold (`HeritageCardsPreview`). The Korean, romanization, gloss and
   * blurb of each card are content (`data/stage1-cards.ts`, with the es / ko content overlays), not messages.
   */
  cards: {
    listLabel: 'Stage 1 Heritage Cards',
    rarity: { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary' },
    /** Accessible name of a card's Korean word: its romanization and its meaning in the UI language (content). */
    cardLabel: (romanization: string, meaning: string) => `Korean word ${romanization}, meaning ${meaning}`,
  },
  /**
   * The mini-game list in the `/learners` games fold (`MiniGamesGallery`). `items` holds each game's title and blurb,
   * keyed by its kind: the Stage 1 games the app plays (`apps/mobile/src/logic/minigame-config.ts`), never a speaking one.
   */
  games: {
    listLabel: 'Stage 1 mini-games',
    family: { recognition: 'Recognition', production: 'Production', application: 'Application', review: 'Review' },
    beta: 'Beta — opt in',
    items: {
      'listen-pick': { title: 'Listen and pick', blurb: 'Hear a sound, then tap the letter or word.' },
      'match-sound': { title: 'Match the sound', blurb: 'Hear a letter. Tap the matching tile. No rush.' },
      'build-letter': { title: 'Build the syllable', blurb: 'Put letters together to make a real Korean syllable.' },
      'pic-word-match': { title: 'Picture and word', blurb: 'Tap a picture, then its word.' },
      'trace-stroke': { title: 'Trace the letter', blurb: 'Follow the stroke order. Your finger learns the shape.' },
      'odd-one-out': { title: 'Odd one out', blurb: 'Three belong together. Can you find the one that is different?' },
      'culture-quiz': { title: 'Culture quiz', blurb: 'A Korean word and four answers. Pick what it means.' },
      'story-sequence': { title: 'Story sequence', blurb: 'Four cards, one story. Tap them in the order they happen.' },
    },
  },
  footer: {
    /** The footer's group headings (F-SITE-002 §3.2). */
    guide: 'Guide',
    app: 'App',
    company: 'Company',
    about: 'About',
    privacy: 'Privacy',
    terms: 'Terms',
    contact: 'Contact',
    copyright: (year: number) => `© ${year} Hangul Route`,
    /** The footer's locale switcher (PR 11c): links named by their endonyms, shown once a second locale ships. */
    language: 'Language',
    /** The Company group's link to `/licenses` (proprietary license, owner decision 2026-10-14). */
    licenses: 'Open-source notices',
  },
  /**
   * The launch-news form (`WaitlistForm`, docs/launch/waitlist.md; `WAITLIST_COPY` in apps/web/src/data/landing-copy.ts).
   * A repeat signup shows the same success text as a first one. The consent line is `consentLead` + a mailto
   * link reading `contactLink` + '. ' + a /privacy link reading `privacyLink`.
   */
  waitlist: {
    label: 'Your email',
    placeholder: 'you@somewhere.com',
    /** Short enough to sit beside the email field at 1280 px (one row in the #news band). */
    submit: 'Get launch news',
    sending: 'Sending',
    retry: 'Try again',
    success: "You're on the list. We'll email you when family and class plans launch.",
    invalid: 'Please enter a valid email address.',
    error: 'We could not reach the server. Check your connection and try again.',
    rateLimited: 'Too many tries. Please wait a little and try again.',
    unavailable: 'Sign-up is not working right now. Please email us and we will add you.',
    consentLead: 'We use your email only to send Hangul Route launch news. It is never sold or shared. To be removed, reply to any message or ',
    contactLink: 'contact us',
    privacyLink: 'Privacy policy',
    /** The hidden honeypot field's label (people never see it). */
    honeypot: 'Leave this field empty',
  },
  about: {
    backHome: '← Back home',
    title: 'About Hangul Route',
    lead: 'Made by a small team (mostly one person and a tiger). For anyone learning Hangul from zero, at any age — heritage families whose parents or grandparents speak Korean, fans of K-pop, K-food and K-anything, and curious beginners — who want a gentle, anti-shame way in.',
    promises: {
      title: 'Our promises',
      plainEnglish: 'Menus and instructions use short, plain words, in English, Spanish or Korean.',
      koreanTaught: 'Every Korean word you learn comes with its romanization and meaning.',
      /** Said in words: the page shows no cross-mark glyph (no emoji, CLAUDE.md). */
      noRed: 'No red X marks for wrong answers — Hoya nudges with amber.',
      noAds: 'No ads, ever, and no data sold.',
      /** The first sentence of `persona.parents.safe.bullets.backup`, word for word (F-SITE-002 §3.12; privacy-statements.test.ts). */
      localFirst: "Each learner's nickname and progress are kept on the device and backed up to our servers, so they can be restored with a Rescue Code.",
      /** The grown-up PIN replaced the v1.0 math gate (PinEntryScreen, F-PROF-001 §3.1). */
      gate: 'A grown-up PIN guards anything that costs money or deletes data.',
    },
    feedback: {
      title: 'Have feedback?',
      body: (email: string) => `Email ${email} — we read everything.`,
    },
    privacy: 'Privacy',
    terms: 'Terms',
  },
  /** Privacy Policy and Terms of Service: English-authoritative until legal review (L10, see the file comment). */
  legal: {
    backHome: '← Back home',
    /**
     * Above the Privacy Policy and Terms on `/es` and `/ko` (decision L10, §4; PR 11c): the documents stay in English
     * until legal review, and this localized line says so. Never shown on the English pages.
     */
    englishAuthoritative: 'This document is shown in English. The English version is the one that applies.',
    privacy: {
      title: 'Privacy Policy',
      /**
       * October 22, 2026: the SN-2 fact fixes (level check, contact, media, school admins, date line) and the draft banner
       * removed (owner decision 2026-10-21 (c)); the date the fixes merge.
       */
      effective: 'Effective October 22, 2026',
      /** Footer link to the other document. */
      otherDocument: 'Terms of Service',
      sections: {
        short: {
          heading: 'The short version',
          paragraphs: {
            /** The backup sentence's first sentence replaces "until the account holder chooses to sign in" (F-SITE-002 §3.7). */
            p1: "Hangul Route is for anyone learning Hangul, at any age — and many of our learners are children. We collect as little as possible, never show ads, and never sell data. Each learner's nickname and progress are kept on the device and backed up to our servers, so they can be restored with a Rescue Code. When the learner is a child, a parent is always in control.",
          },
        },
        account: {
          heading: 'Who creates the account',
          paragraphs: {
            p1: 'Accounts are created and managed by the account holder (a parent or legal guardian when the learner is a child). When the learner is a child, the child uses the app, but a grown-up sets it up, enters any billing details, and confirms consent behind a parent-gate. We do not knowingly let a child under 13 create an account without verifiable parental consent.',
          },
        },
        collect: {
          heading: 'What we collect',
          bullets: {
            /**
             * SN-2: the level check (F-PLC-001, on for every platform) can suggest the starting level. Two things leave
             * the device, and this bullet names every field of both:
             * - Usage events (apps/mobile/src/logic/placement/events.ts): `placement.start` (source, testLocale,
             *   length and mode, revealMode, level), `placement.item_answered` (itemId, gate, outcome, assisted, ms,
             *   noSound), `placement.complete` (stopReason, asked, stage and band, oralStage, beyondContent,
             *   strandsSecure, mode), `placement.skipped` (source: onboarding or home) and `placement.override_applied`.
             *   Every event is posted with the profileId and the client `at` time (apps/mobile/src/platform/telemetry.ts).
             * - The result (`PlacementResultSchema`, packages/content-schema/src/schemas/placement.ts), kept in
             *   `ProgressSnapshot.placements` (newest `PLACEMENT_KEEP` = 10) and backed up with the snapshot: id,
             *   responses (questionId, outcome, chosenOptionId, assisted, ms, noSound), gates, strands, level, oralStage,
             *   beyondContent, startQuestId, placedOutQuestIds, priorityTokens, needsStage, startedAt, completedAt,
             *   source, testLocale, length, mode, revealMode, bankVersion, contentVer, catalogVersion, motivation,
             *   stopReason and override; plus `ProgressSummary.placement` (takenAt, level, oralStage, strands,
             *   beyondContent, overridden) from the newest result.
             */
            profile: ({ levels }: LegalValues) =>
              `Learner profile: a display nickname and a starting level the learner picks or a short level check suggests (${levels}). It describes how much the learner reads, not how old they are, and we do not need a birth date to use it. A real name is optional and only stored if a parent enters it. If the learner takes the level check, it sends us usage events. When it starts: where it was started, its language and length, whether the sound guide shows by itself or after a tap, and the learner's starting level. For each answer: which question it was and which part of the check it belongs to, how it was answered (right, wrong or not sure), whether the sound guide was used, whether the sound could play, and how long it took. When it ends: the level it suggests for reading and for listening, whether the learner reached the highest level the check measures, how many of the five skills it checks are secure, its length, how many questions were asked and why it stopped. We also note when the check is skipped and from which screen, and when a grown-up picks a different start. Each event carries the learner's id and the time it happened. The finished result is saved with the learner's progress and backed up to our servers with it; the app keeps the 10 most recent. Each result has an id and holds every answer (which question, which choice was picked, recorded by its id and not its words, whether it was right, wrong or not sure, whether the sound guide was used, whether the sound could play, and how long it took); how the learner did in each part of the check and in each of the five skills; the suggested levels, whether the learner reached the highest level the check measures, the first lesson, the lessons the learner can skip, up to three letters or skills to practice first, and whether the suggested level is outside the learner's plan; when the check started and ended, where it was started, its language, length and settings, and which versions of the questions and lessons it used; why the learner is learning Korean, if they picked a reason; why it stopped; and, if a grown-up picked a different start, that start and when. A short summary of the newest result (when it was taken, the suggested levels, the five skills, whether the learner reached the highest level and whether a grown-up changed the start) is saved with the learner's progress reports.`,
            progress:
              "Learning progress: quests completed, stars earned, cards unlocked, streaks, and which jamo a learner recognizes — so the journey can resume and a parent can see progress. For progress reports we also keep: for the last 35 days, which days were practiced, with minutes, quests, cards and words for each day; monthly totals for up to 24 months; all-time totals since the first practice day; the day each stage was finished; the letters that became strong each day; the next lesson and one lesson to revisit; and the device's time zone, so days are counted in the learner's local time.",
            /**
             * F-REPORT-001 section 3.10: who can see the progress above and the reports built from it. [TV] Rewritten for
             * AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D1 to TV-D5 and TV-D12, the owner's decision of 2026-10-14 (not
             * reviewed by counsel; the draft banner was removed by owner decision 2026-10-21 (c)).
             */
            progressWho:
              "Who can see progress and reports: the learner's family caregivers, who can also recover the full saved progress, see all of it, words included. Once the family has read a short update about classes in the app or the console, the teacher of a class the learner joined, and the owner and admins of that class's school, see the same progress, words included, and whether the learner gets notes from the class. We record when that update was read and whether it was read in the console or on the learner's device. Until then a class sees what it saw before: day-by-day history only from the day the learner joined, all-time totals without the first practice day, and no words.",
            /**
             * F-FEEDBACK-001 section 8.7 (FB-13): notes from grown-ups. Who can send (6.1, OD-17), the learner's only
             * answer (6.6, four fixed reactions), what a class sender sees (8.2, OD-8, reaction only in `all` mode),
             * the family's controls (8.3, 8.5), the device's put away and report, retention (OD-9, 8.7) and deletion.
             */
            notes: ({ email }: LegalValues) =>
              `Notes from grown-ups: the learner's family, and the teacher of a class the learner joined, can send the learner short notes that start from a set of reviewed messages. In a family, only the family owner and the adults the owner allows can send. The learner cannot write back: they can only pick one of four fixed answers, such as "Thank you". A teacher sees the notes sent in their class and, unless the family limits class notes, that answer, but never whether a note was opened. The learner's family caregivers see every note to the learner, and which family adult sent a note from home, and can hide or report a note or stop notes from one sender. A note can also be put away or reported from the learner's device. A sender can take a note back at any time: it leaves the learner's devices, and the learner's family can still see it. We keep notes for 180 days, and a reported note until 90 days after its last report so we can review it. To have a note deleted sooner, the learner's family can email ${email}.`,
            /** [TV] AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D7 to TV-D11, the owner's decision of 2026-10-14. */
            classMoves:
              "Class moves: a teacher may move a learner from one class to another without asking the family first. When the teacher runs both classes, or is an admin of their school, the move happens at once; otherwise the receiving class has to accept it. Until it accepts, the receiving class sees only the learner's initials, picture and level. The family then sees a one-time notice in the app and in the console. Cards, stars and finished lessons always stay with the learner. A family can also start a move itself, and a learner can leave a class from Profile at any time. We keep a record of each move (which classes, which teacher account moved the learner and when, never a name) for 90 days after it happens.",
            /**
             * [SA] AMENDMENTS-SEATS-ADMINS section 6.7 (SA-4; SA-D10 to SA-D12, the owner's request of 2026-10-20, not
             * reviewed by counsel; the draft banner was removed by owner decision 2026-10-21 (c)): what a school's administrators see, the verified email an
             * accept needs, and the school history the owner sees (400 days). Family and stand-alone class renames keep
             * no such history.
             */
            schoolAdmins:
              "A school's owner can add up to two administrators with an invite link, so a school has up to three grown-ups with admin rights. Administrators see what the owner sees about the school's classes and students, except billing: they can open class rosters and reports, move students between the school's classes, remove students from a class, and approve a student's request to link a new device. To accept, an administrator needs an account with a verified email. The owner sees who is an administrator, with the email they sign in with, when they joined or left, and who renamed the school or one of its classes. We keep this history for 400 days.",
            /**
             * SN-2: parents, teachers and school administrators all sign in with an email (F-APP-001). Receipts go only to
             * the payer: an administrator gets 403 on checkout, portal and receipts of the school they administer
             * (packages/backend space-seats.test.ts). The same account can still buy a plan for its own family or class
             * (checkout sends account.email, entitlements.ts), so the copy is limited to the school's receipts.
             */
            contact:
              'Account contact: the email a parent, teacher or school administrator signs in with, used for sign-in and account recovery. The email of the grown-up who buys a plan is also used for that plan\'s receipts. A school administrator cannot buy or manage the school\'s plan, so their email is not used for the school\'s receipts.',
            device: 'Basic device and diagnostic data: app version, device type, and crash logs, to keep the app stable.',
            /**
             * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 13.3 (row GU-6; shown only while the `guestLesson` claim is on,
             * so from GU-7): quest 1 tried before a profile exists. The guest record (`hr:guest`) and the quest's results
             * stay in that browser with no name and are never synced (section 11); the save makes them an ordinary
             * learner's, backed up like any other (F-SYNC-002). The app's sweep removes a never-saved record on its next
             * open after `days` days without play (`sharedDays` on a device with learner profiles, GU-D13); the
             * browser's own clearing, or its storage limits, can remove it first. English only (L10).
             */
            guest: ({ days, sharedDays }: LegalValues) =>
              `Trying the first quest before making a profile: the results of that quest are saved in this browser with no nickname and are not backed up to our servers. When a name is added, they become that learner's progress and are backed up like any other. A quest that is never saved is deleted by the app the next time it opens after ${days} days without play (${sharedDays} days on a device that already has learner profiles); clearing this site's data in the browser removes it at once, and some browsers remove it sooner.`,
          },
        },
        never: {
          heading: 'What we never collect',
          bullets: {
            ads: 'No advertising identifiers and no third-party ad tracking — ever.',
            location: 'No precise location.',
            /** SN-2: no voice mini-game ships (voiceEchoEnabled is false) and the site promises no speaking. */
            media: 'No contacts, photos, or microphone audio leave the device. The app does not record your voice.',
            profiles: 'No behavioral profiles sold or shared for marketing.',
          },
        },
        children: {
          heading: "Children's privacy (COPPA / GDPR-K)",
          paragraphs: {
            p1: 'Many of our learners are children. Hangul Route is designed to comply with the U.S. Children’s Online Privacy Protection Act (COPPA) and similar rules for minors. We practice data minimization, require verifiable parental consent before any personal data is linked to an account, and give parents the right to review or delete their child’s data at any time.',
          },
        },
        emailList: {
          heading: 'Launch-news email list',
          paragraphs: {
            what: 'On our website you can leave your email address to get Hangul Route launch news. This list is separate from the app and from any account.',
            collected:
              'What we collect: the email address you type into the launch form, the date you signed up, which form on our site it came from, your language setting, and which version of the consent text you saw. We do not store your IP address or any browser details.',
            why: 'Why: only to send you Hangul Route launch news. Your address is never sold or shared.',
            who: 'Who stores it: our own database on Cloudflare. We do not pass it to a third-party newsletter service.',
            howLong: 'How long: until the launch news ends or you ask us to remove it.',
            removal: ({ email }: LegalValues) =>
              `Removal and erasure: to be taken off the list, or to have your address erased, email ${email} from the address you signed up with and we will remove it.`,
            optional: 'Signing up is optional and does not depend on using the app. The app itself does not require an email address to learn.',
          },
        },
        where: {
          heading: 'Where your data lives',
          paragraphs: {
            /**
             * What the app does (F-SYNC-002 `sync-store.ts`, F-RESTORE-001, the telemetry client), with no sign-in: it sends
             * each learner's nickname, level and avatar once, the first time it saves them (`ensureRegistered`, POST
             * /api/sync/learners; there is no update route, so a later edit is not sent, F-LEARN-001 §3.11), backs up their
             * progress on start and after each write, and sends usage events that can carry the learner's id. Replaces
             * "If a parent signs in, progress syncs…" (F-SITE-002 §3.7).
             */
            p1: "Learning data is kept on the device and backed up to our servers (Cloudflare), with no sign-in needed. The first time the app saves a learner, it sends their nickname, level and avatar. It backs up their progress when it starts and after each change, so the learner can be restored on a new device with a Rescue Code. If you later change the nickname, level or avatar, the backup keeps the old ones for now; to change them, email us. The app also sends us usage events, such as a finished quest, which can include the learner's id. Data in transit is encrypted (HTTPS), and at rest it is access-controlled.",
          },
        },
        payments: {
          heading: 'Payments and subscriptions',
          paragraphs: {
            /**
             * The payment channels, then what the server keeps about a plan, never card data: `entitlements` (plan key,
             * status, dates, `provider_ref` / `customer_ref`, `promo_code`) and, from F-BILL-002 B-3 (notice before it
             * records anything; Stripe Live is off, so no real payment exists before then), `billing_events`
             * (migration 0007: purchase, renewal, refund or a payment that did not go through; amount, currency, date, Stripe ids). F-SITE-002 S-7.
             */
            p1: `${PAYMENT_CHANNELS} We never see or store full card numbers — Stripe or the store handles payment. For each plan we keep the plan, its status and dates, the Stripe, store or contract reference ids, the number of seats on a school contract, any promotion code used, and a record of each payment and refund, and of any payment that did not go through (amount, currency, date and its reference id).`,
          },
        },
        thirdParty: {
          heading: 'Third-party services',
          bullets: {
            /**
             * F-SITE-002 S-7: the web's payment processor, listed before the stores as in the payment sentence. Checkout
             * is opened with the signed-in account's email (`customer_email`) and the plan's subject kind and id, plan key
             * and any promotion code as metadata (`checkoutForm`, packages/backend lib/stripe.ts).
             */
            stripe: 'Stripe — payments and subscription management for plans bought on the web. We give Stripe the email address the grown-up signed in with, for receipts, and the plan, our reference ids for it and any promotion code used, so each payment is matched to the right plan.',
            stores: 'Apple App Store / Google Play — payments and subscription management for in-app purchases.',
            cloudflare: 'Cloudflare — hosting, storage, and content delivery.',
            noTracking: 'We do not use third-party advertising or social-media tracking SDKs.',
          },
        },
        rights: {
          heading: 'Parental rights and choices',
          paragraphs: {
            p1: 'A parent can review, export, correct, or delete their child’s data, withdraw consent, and close the account. To make a request, email us from the address on the account and we will respond within 30 days.',
          },
        },
        retention: {
          heading: 'Data retention and security',
          paragraphs: {
            p1: 'We keep account data while the account is active and delete it within 90 days of an account being closed, unless we are legally required to keep it longer. We use industry-standard safeguards, but no system is perfectly secure.',
          },
        },
        changes: {
          heading: 'Changes to this policy',
          paragraphs: {
            /** SN-2: the effective date renders at the top of the page (PrivacyPage.tsx). */
            p1: 'If we make a material change, we will notify parents in the app or by email before it takes effect. The date at the top shows the current version.',
          },
        },
        contact: {
          heading: 'Contact',
          paragraphs: {
            ask: ({ email }: LegalValues) => `Questions about privacy? Email ${email}. We read everything.`,
          },
        },
      },
    },
    terms: {
      title: 'Terms of Service',
      /** October 22, 2026: the SN-2 fact fixes and the draft banner removed (owner decision 2026-10-21 (c)), as the Privacy Policy. */
      effective: 'Effective October 22, 2026',
      otherDocument: 'Privacy Policy',
      sections: {
        accepting: {
          heading: 'Accepting these terms',
          paragraphs: {
            p1: 'By using Hangul Route, you agree to these Terms of Service. If you do not agree, please do not use the app. Hangul Route is for learners of any age, and many learners are children: when the learner is a child, the parent or legal guardian who sets up the account accepts these terms on the family’s behalf.',
          },
        },
        accounts: {
          heading: 'Accounts and parental responsibility',
          paragraphs: {
            p1: 'The account holder (a parent or legal guardian when the learner is a child) creates and supervises the account, keeps sign-in details secure, and is responsible for activity under it. A child may use the app under that supervision. Account changes, purchases, and other sensitive actions sit behind a parent-gate.',
          },
        },
        /** [TV] AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D2, TV-D7, TV-D8: the owner's decision of 2026-10-14. */
        classes: {
          heading: 'Classes and teachers',
          paragraphs: {
            p1: 'When a learner joins a class, the teacher of that class and the owner and admins of its school can see the learner’s progress as our Privacy Policy describes. A teacher may move a learner to another class they teach, or to another class that accepts the learner, without asking the family first; the family is told afterwards. A family can leave a class at any time. Teachers and school admins agree to use what they see only to teach and support their learners, and never to share it outside the class or school.',
          },
        },
        billing: {
          heading: 'Subscriptions, billing, and cancellation',
          /**
           * F-SITE-002 §3.7 (S-7, OD-13): both payment channels (PAYMENT_CHANNELS), then the yearly renewal of web plans
           * (AMENDMENTS-BILLING-FAMILY-YEARLY BY-D10 [BY]; "Billing" and "Manage subscription" are the console's own labels).
           * The page renders these before the bullets. No price here (OD-7).
           */
          paragraphs: {
            channels: PAYMENT_CHANNELS,
            webRenewal:
              'Plans bought on the web (the Family Plan and the Group License) renew every year until cancelled. Cancel any time in Billing, under Manage subscription; the plan stays active until the end of the year already paid.',
            /** BY-D4: a sponsored Group License (100%-off code, `payment_method_collection=if_required`) has no card and lapses at the end of its year. */
            sponsored:
              'A Group License started with a code that makes its first year free needs no card; it ends when that year does unless a card is added under Manage subscription.',
            /**
             * [SA] AMENDMENTS-SEATS-ADMINS section 4 (SA-6): the learners each plan holds, the numbers from the
             * content-schema constants. Must ship before Stripe Live is ever enabled. SN-2 adds the administrator invite
             * (`SCHOOL_ADMIN_CAP`); the free sizes are not published on the site (owner decision 2026-10-21 (b)).
             */
            sizes: `The Family Plan covers one family with up to ${FAMILY_LIFETIME_LEARNERS} learners. The Group License covers one class or one school with up to ${GROUP_LICENSE_LEARNERS} students; a school also holds up to ${SCHOOL_LICENSE_TEACHERS} teachers. A School Contract can cover more. When a family, class or school already has the most learners its plan holds, new learners cannot join until a place opens; nobody already in it is removed because of the limit. A school owner can also invite up to ${SCHOOL_ADMIN_CAP} administrators.`,
          },
          /** The store terms, kept and marked as applying to in-app purchases (F-ENT-001 §3.5, F-IAP-002). */
          bullets: {
            premium: 'In-app purchases: when offered, premium content is an auto-renewing subscription billed through the Apple App Store or Google Play.',
            renews: 'In-app purchases: your subscription renews automatically unless you cancel at least 24 hours before the end of the current period.',
            manage: 'In-app purchases: manage or cancel anytime in your App Store or Google Play account settings.',
            refunds: 'In-app purchases: refunds are handled by the store under its policy. A free trial, if offered, converts to a paid subscription unless cancelled before it ends.',
          },
        },
        use: {
          heading: 'Acceptable use',
          bullets: {
            personal: 'Use the app for personal, non-commercial learning.',
            copying: 'Do not copy, resell, reverse-engineer, or redistribute the content or software.',
            disrupt: 'Do not attempt to disrupt the service or access other families’ data.',
          },
        },
        content: {
          heading: 'Our content and your data',
          paragraphs: {
            p1: 'Hangul Route, including Hoya, the curriculum, illustrations, audio, and heritage cards, is owned by us or our licensors and protected by intellectual-property law. Learning data belongs to the learner and their family; you may export or delete it as described in our Privacy Policy.',
            /** Consistency with the proprietary LICENSE (2026-10-14): open-source parts keep their own licenses (/licenses). */
            openSource:
              'The app includes open-source software and fonts that keep their own licenses, listed on our Open-source notices page (hangulroute.com/licenses). Nothing in these terms limits the rights those licenses give you.',
          },
        },
        disclaimer: {
          heading: 'Educational disclaimer',
          paragraphs: {
            p1: 'Hangul Route is a supplementary learning tool, not a certified curriculum or a guarantee of any specific learning outcome. It is provided “as is” without warranties of any kind, to the fullest extent permitted by law.',
          },
        },
        availability: {
          heading: 'Service availability',
          paragraphs: {
            p1: 'We work to keep the app available and improving, but we may update, suspend, or discontinue features. Core local learning is designed to work offline; cloud sync requires a connection.',
          },
        },
        liability: {
          heading: 'Limitation of liability',
          paragraphs: {
            p1: 'To the maximum extent permitted by law, we are not liable for indirect, incidental, or consequential damages arising from use of the app. Nothing in these terms limits rights that cannot be limited by law, including consumer protections in your region.',
          },
        },
        ending: {
          heading: 'Ending your use',
          paragraphs: {
            p1: 'You may stop using the app and close your account at any time. We may suspend or end access if these terms are violated or if required by law.',
          },
        },
        law: {
          heading: 'Governing law',
          paragraphs: {
            /** Owner decision 2026-10-21 (c): no wording that a legal review happened or is pending, so the counsel sentence is gone. */
            p1: 'These terms are governed by the laws of the jurisdiction stated at launch.',
          },
        },
        changes: {
          heading: 'Changes to these terms',
          paragraphs: {
            /** SN-2: the effective date renders at the top of the page (TermsPage.tsx). */
            p1: 'If we make material changes, we will notify parents in the app or by email before they take effect. The date at the top shows the current version.',
          },
        },
        contact: {
          heading: 'Contact',
          paragraphs: {
            ask: ({ email }: LegalValues) => `Questions about these terms? Email ${email}.`,
          },
        },
      },
    },
  },
  /**
   * `/licenses` (owner decision 2026-10-14; wireframe design/wireframes/site/licenses.md): the open-source notices
   * of the shipped apps. The words around the list are translated; the list itself (package names, copyright lines,
   * license texts, from `apps/web/src/data/third-party-notices.json`) is English legal text, shown under
   * `legal.englishAuthoritative` on `/es` and `/ko`.
   */
  licenses: {
    title: 'Open-source notices',
    lead: 'Hangul Route uses open-source software and a font made by other people. Each one keeps its own license. This page lists them, with their copyright lines and the full license texts.',
    notOpen: 'Hangul Route itself is not open source.',
    copyright: 'Copyright (c) 2026 Sungjoo Hwang. All rights reserved.',
    softwareTitle: 'Software',
    fontsTitle: 'Fonts',
    noticesTitle: 'NOTICE files',
    fullText: 'Full license text',
    usedIn: 'Used in',
    where: { app: 'App', web: 'Website', server: 'Server', ios: 'iOS app' },
  },
  /**
   * The exported 404 pages (F-SITE-002 §3.7): `out/404.html` in English and, since AMENDMENTS-SITE-NEWUSER SN-2,
   * `out/es/404.html` and `out/ko/404.html` in their locale. `title` is the heading and the `<title>`.
   */
  notFound: {
    body: 'The link may be old. Try the home page or start learning.',
    home: 'Go to the home page',
    start: 'Start learning',
    title: 'Page not found',
  },
  /**
   * The "View in <language>" banner on `/` (F-I18N-001 §3.3, PR 11c): shown when the browser prefers a
   * shipped locale other than English; it suggests, never redirects. The page words it in the suggested
   * locale (its own dictionary), and `endonym` is that locale's own name ("Español").
   */
  localeBanner: {
    label: 'Language suggestion',
    viewIn: (endonym: string) => `View in ${endonym}`,
    /** The close button's accessible name; the button shows `close.cta` (a glyph a locale may swap). */
    dismiss: 'Close',
    close: { cta: '×' },
  },
} as const;
