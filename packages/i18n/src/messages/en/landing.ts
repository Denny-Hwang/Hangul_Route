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
  a: 'No — starting from zero is what we built it for. Instructions are in plain, simple English. Korean only appears as the thing being learned.',
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
}

export const landing = {
  /** `<head>` metadata (`siteMetadata` in apps/web/src/data/landing-copy.ts). */
  meta: {
    title: 'Hangul Route — Learn Hangul from zero with Hoya',
    tagline: 'Learn Hangul from zero, at any age.',
    /**
     * What is built, with no typed counts (F-SITE-002 §3.12): Stage 1, the Korean culture cards, Hoya, no ads. No
     * stage, theme or mini-game count, and no Heritage Journey grid, which is not built yet.
     */
    description:
      'Learn Hangul from zero with Hoya the tiger, at any age: heritage families, K-culture fans and curious beginners. Five-minute quests teach the Korean alphabet, for reading, listening and writing, and every letter earns a Korean culture card. Stage 1 is free and more stages are coming. No ads, ever.',
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
        description: "Short, kind Hangul lessons with no ads and a grown-up gate. Create a free family space and see each learner's week.",
      },
      teachers: {
        title: 'For teachers — Hangul Route',
        description: 'Students join with a class code, with no student emails or accounts. Plan the week and see who practised. Never a ranking.',
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
    skip: 'Skip to content',
  },
  /**
   * The layered home `/` (F-SITE-002 §3.3, appendix B.1). `hero.title` is the tagline; the taught letter in Hoya's
   * bubble is passed in with its romanization (CLAUDE.md §1; the page passes the letter's teaching sound value, e.g.
   * `g/k` for the first letter). `how.routeBody` replaces step 3's line only while the `learningRoute` claim is on.
   * The promises are titles only; their explanations live on the persona pages.
   */
  home: {
    hero: {
      title: 'Learn Hangul from zero, at any age.',
      lead: 'Short, playful quests teach you to read, hear and write the Korean alphabet, with Hoya the tiger as your guide.',
      start: 'Start learning',
      grownUps: 'Parent or teacher? Find your page',
      /** Hedged like `persona.learners.faq.offline`: offline opening on iOS 14 is a known open issue (OD-15). */
      facts: 'Runs in your browser · Nothing to install · The app works offline on most devices after your first visit',
      /** A no-break space keeps the letter and its romanization on one line when the bubble wraps. */
      bubble: (letter: string, romanization: string) => `Annyeong! Let's meet ${letter}\u00a0(${romanization}).`,
    },
    who: {
      title: 'Who is it for?',
      items: {
        learners: {
          title: 'Learners',
          body: 'Five-minute quests, a guide who never scolds, and Korean culture cards to collect.',
        },
        parents: {
          title: 'Parents and caregivers',
          body: 'See what your learner practises, with a grown-up gate and no ads.',
        },
        teachers: {
          title: 'Teachers',
          body: 'Students join with a class code. No student emails, no accounts.',
        },
      },
    },
    how: {
      title: 'How it works',
      steps: {
        start: { title: 'Open the app', body: 'Choose who is learning and begin.' },
        quests: { title: 'Learn in five-minute quests', body: 'Letters, sounds and first words, with sound and pictures on every screen.' },
        /** "Saved and backed up": the app backs up every learner's progress with no sign-in (see `persona.parents.safe.bullets.backup`). */
        collect: { title: 'Collect and keep going', body: 'Earn Korean culture cards. Your progress is saved and backed up.' },
      },
      routeBody: 'Earn Korean culture cards and see your whole Learning Route: where you are and what comes next.',
    },
    promises: {
      /** The section's visually hidden heading. */
      label: 'Our promises',
      items: { ads: 'No ads, ever', safety: 'Child safety first', noRed: 'No red marks' },
    },
    news: {
      title: 'Get the launch news',
      body: "Leave your email and we'll send you the launch news. Nothing else.",
    },
  },
  /**
   * The only cost words on the site (F-SITE-002 §3.9, OD-7): never a price, never a term. The home's cost line is the
   * free line, then the `paid` line the `paidPlans` claim picks. A persona page's Plans block is the free line, the
   * `paid.coming` line only while plans are coming, then `managedInApp`, so the host is named once (§3.5). The free
   * plan is all of Stage 1 (F-ENT-003 OD-1), so
   * `free.stage1` is the same in every state and says nothing about paid plans. Plans bought on the web renew
   * yearly (BY-1): the signed-in billing page states the term (the Terms will too, S-7), and no site line names a
   * term or calls a plan one-time.
   */
  plans: {
    title: 'What does it cost?',
    free: {
      stage1: 'Stage 1 is free.',
    },
    paid: {
      coming: 'More stages are coming, with plans for families and classes.',
      inApp: 'Plans for families and classes are at app.hangulroute.com.',
    },
    managedInApp: 'Plans and billing are managed at app.hangulroute.com after you sign in.',
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
          a: 'In the app: tap Profile, then go to Classes & family and tap Join a class.',
        },
        offline: {
          q: 'Does it work offline?',
          a: 'On most devices, yes: after your first visit the app opens without a connection. Letter sounds may need a Korean voice installed on your device.',
        },
        adult: FAQ_ADULT,
        korean: FAQ_KOREAN,
      },
    },
    parents: {
      title: 'For parents and caregivers',
      lead: "For parents, grandparents and every caregiver: short, kind lessons that keep your learner's data private.",
      signIn: 'Sign in as a parent',
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
          gate: 'A grown-up gate guards anything that costs money or deletes data.',
          siblings: 'Siblings can share a device. Each learner keeps their own stars and cards.',
        },
      },
      follow: {
        title: 'Follow along',
        /** True today on the console's family space. */
        body: "Create a free family space, share its code, and see each learner's week: time practised, quests done and letters to revisit together.",
        reports: 'Reports for today, this week, this month and all time show what went well and what to practise next.',
        route: "Open each learner's Learning Route to see where they are and what comes next.",
        notes: 'Send a short note of encouragement that your learner sees in the app.',
        /** Names the product as the app's billing page does (`console.billing.planTitle.family_lifetime`). */
        browse: 'With the Family Plan, browse every lesson exactly as your learner sees it.',
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
      signIn: 'Sign in as a teacher',
      tryIt: 'Try it as a learner',
      setup: {
        title: 'Set up in minutes',
        steps: {
          space: 'Sign in and create a class space.',
          code: 'Share the class code. Students enter it in the app; no student emails or accounts.',
          devices: 'Students learn on any device with a browser.',
        },
      },
      plan: {
        title: 'Plan and assign',
        bullets: {
          pick: "Pick quests for the week. They appear on each student's homework list.",
          planner: 'Or let the planner build a term route from your class level and rhythm.',
        },
      },
      class: {
        title: 'See how the class is doing',
        /** True today (the weekly roll-up). */
        body: 'A weekly view shows who practised and which letters to revisit together. Never a ranking.',
        reports: 'Reports for each student and statistics for the whole class, by day, week, month or all time. Never a ranking.',
        route: "Open each student's Learning Route to see where they are and what comes next.",
        notes: 'Send students a short note of encouragement.',
        browse: 'With a class or school plan, preview every lesson exactly as students see it.',
        lecture: 'Teach from the front on a projector or TV.',
      },
      privacy: {
        title: 'Privacy for classes',
        bullets: { initials: 'Show initials only on the class list.', ads: 'No ads, and no data sold.' },
      },
      faq: {
        students: { q: 'Do students need accounts?', a: 'No. They join with the class code inside the app.' },
        ranking: { q: 'Is there a leaderboard?', a: 'No. Hangul Route never ranks students against each other.' },
        try: { q: 'Can I try it first?', a: 'Yes. Open the app and play the first quests as a learner.' },
      },
    },
    /** Section headings the persona pages share: the plans block's h2 and the folded questions' visually hidden h2. */
    plansTitle: 'Plans',
    faqTitle: 'Questions',
    /** The one line above each persona page's closing action. */
    closing: {
      learners: 'Ready for your first letter?',
      parents: "See your learner's week in one place.",
      teachers: 'Bring Hangul to your class this week.',
    },
  },
  /** The heritage-card preview (`HeritageCardsPreview`); card titles and blurbs are content, not messages. */
  cards: {
    eyebrow: 'The reward loop',
    title: (cards: number) =>
      plural('en', cards, { one: `${cards} Heritage Card. One Korea, one card at a time.`, other: `${cards} Heritage Cards. One Korea, one card at a time.` }),
    body: (cards: number, common: number, uncommon: number, rare: number, legendary: number) =>
      `Every letter you learn earns a real piece of Korean culture — a ramyeon bowl, a Chuseok moon, a swing from a Dano painting. Stage 1 ships ${plural('en', cards, { one: `${cards} card`, other: `${cards} cards` })}: ${common} common, ${uncommon} uncommon, ${rare} rare, and ${legendary} legendary.`,
    listLabel: 'Stage 1 Heritage Cards',
    rarity: { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary' },
    /** Accessible name of a card's Korean word: its romanization and its English meaning (content). */
    cardLabel: (romanization: string, meaning: string) => `Korean word ${romanization}, meaning ${meaning}`,
    more: 'Stage 2 (Words) adds 30+ cards. Stage 7 (Self-expression) caps the Heritage Library at 175.',
  },
  /** The mini-game gallery (`MiniGamesGallery`); game titles and blurbs are content, not messages. */
  games: {
    eyebrow: (shipped: number, beta: number) => {
      const games = plural('en', shipped, { one: `${shipped} mini-game`, other: `${shipped} mini-games` });
      return beta > 0 ? `${games} + ${beta} in beta` : games;
    },
    title: 'None of them feel like school.',
    body: 'Four families of practice — recognition, production, application, review — wrapped in 90-second loops. Hoya never says “wrong.”',
    listLabel: 'Stage 1 mini-games',
    family: { recognition: 'Recognition', production: 'Production', application: 'Application', review: 'Review' },
    beta: 'Beta — opt in',
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
  },
  /**
   * The launch-news form (`WaitlistForm`, docs/launch/waitlist.md; `WAITLIST_COPY` in apps/web/src/data/landing-copy.ts).
   * A repeat signup shows the same success text as a first one. The consent line is `consentLead` + a mailto
   * link reading `contactLink` + '. ' + a /privacy link reading `privacyLink`.
   */
  waitlist: {
    label: 'Your email',
    placeholder: 'you@somewhere.com',
    submit: 'Send me the invite',
    sending: 'Sending',
    retry: 'Try again',
    success: "You're on the list. We'll email you when Hangul Route launches.",
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
      plainEnglish: 'Menus and instructions use plain, simple English (CEFR Pre-A1).',
      koreanTaught: 'Korean is only used for the content being taught.',
      /** Said in words: the page shows no cross-mark glyph (no emoji, CLAUDE.md). */
      noRed: 'No red X marks for wrong answers — Hoya nudges with amber.',
      noAds: 'No ads, ever. No ads designed at children. Period.',
      /** The first sentence of `persona.parents.safe.bullets.backup`, word for word (F-SITE-002 §3.12; privacy-statements.test.ts). */
      localFirst: "Each learner's nickname and progress are kept on the device and backed up to our servers, so they can be restored with a Rescue Code.",
      gate: 'Parent-gate behind multiplication for any commerce or destructive action.',
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
    draft: 'Draft for review. This document is a working draft pending review by qualified legal counsel before public launch.',
    privacy: {
      title: 'Privacy Policy',
      effective: 'Effective October 12, 2026',
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
            profile: ({ levels }: LegalValues) =>
              `Learner profile: a display nickname and a starting level the learner picks (${levels}). It describes how much the learner reads, not how old they are, and we do not need a birth date to use it. A real name is optional and only stored if a parent enters it.`,
            progress:
              "Learning progress: quests completed, stars earned, cards unlocked, streaks, and which jamo a learner recognizes — so the journey can resume and a parent can see progress. For progress reports we also keep: for the last 35 days, which days were practiced, with minutes, quests, cards and words for each day; monthly totals for up to 24 months; all-time totals since the first practice day; the day each stage was finished; the letters that became strong each day; the next lesson and one lesson to revisit; and the device's time zone, so days are counted in the learner's local time.",
            /** F-REPORT-001 section 3.10: who can see the progress above and the reports built from it. */
            progressWho:
              "Who can see progress and reports: the learner's family caregivers, who can also recover the full saved progress; the teacher of a class the learner joined; and the owner and admins of that class's school. A class sees day-by-day history only from the day the learner joined, and all-time totals without the first practice day.",
            /**
             * F-FEEDBACK-001 section 8.7 (FB-13): notes from grown-ups. Who can send (6.1, OD-17), the learner's only
             * answer (6.6, four fixed reactions), what a class sender sees (8.2, OD-8, reaction only in `all` mode),
             * the family's controls (8.3, 8.5), the device's put away and report, retention (OD-9, 8.7) and deletion.
             */
            notes: ({ email }: LegalValues) =>
              `Notes from grown-ups: the learner's family, and the teacher of a class the learner joined, can send the learner short notes that start from a set of reviewed messages. In a family, only the family owner and the adults the owner allows can send. The learner cannot write back: they can only pick one of four fixed answers, such as "Thank you". A teacher sees the notes sent in their class and, unless the family limits class notes, that answer, but never whether a note was opened. The learner's family caregivers see every note to the learner, and can hide or report a note or stop notes from one sender. A note can also be put away or reported from the learner's device. We keep notes for 180 days, and a reported note for 90 days after the report so we can review it. To have a note deleted sooner, email ${email}.`,
            contact: 'Account contact: a parent email, used for sign-in, receipts, and account recovery.',
            device: 'Basic device and diagnostic data: app version, device type, and crash logs, to keep the app stable.',
          },
        },
        never: {
          heading: 'What we never collect',
          bullets: {
            ads: 'No advertising identifiers and no third-party ad tracking — ever.',
            location: 'No precise location.',
            media: 'No contacts, photos, or microphone audio leaves the device. Voice mini-games process speech on-device and discard it.',
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
            p1: 'If we make a material change, we will notify parents in the app or by email before it takes effect. The date below shows the current version.',
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
      effective: 'Effective October 12, 2026',
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
            p1: 'These terms are governed by the laws of the jurisdiction stated at launch. The final governing-law and dispute-resolution clauses will be confirmed with legal counsel before public release.',
          },
        },
        changes: {
          heading: 'Changes to these terms',
          paragraphs: {
            p1: 'If we make material changes, we will notify parents in the app or by email before they take effect. The date below shows the current version.',
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
  /** Links on the exported 404 page (F-SITE-002 §3.7); English document, as today. */
  notFound: {
    body: 'We could not find this page.',
    home: 'Go to the home page',
    start: 'Start learning',
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
