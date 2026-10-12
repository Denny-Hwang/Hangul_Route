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
 * Two answers the old landing's questions block and the learners page (F-SITE-002 §3.4) share word for word.
 * One object each, so the copies cannot drift; S-6 removes `faq` and these stay with `persona.learners.faq`.
 */
const FAQ_ADULT = {
  q: 'I’m an adult beginner. Will it feel too young?',
  a: 'No. Stage 1 teaches exactly what any beginner needs first — the letters and their sounds — with no baby talk. Hoya is friendly, and the culture cards are worth collecting at any age.',
} as const;
const FAQ_KOREAN = {
  q: 'Do I need to know any Korean?',
  a: 'No — starting from zero is what we built it for. Instructions are in plain, simple English. Korean only appears as the thing being learned.',
} as const;

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
    description:
      'Learn Hangul from zero with Hoya the tiger — for anyone, at any age: heritage families, K-culture fans and curious beginners. Five-minute quests, 8 mini-games, Korean culture cards to collect, and a Heritage Journey across 7 stages and 5 culture themes. Stage 1 is free and more stages are coming. No ads, ever.',
    keywords: ['learn Hangul', 'Korean alphabet', 'learn Korean', 'Korean for beginners', 'heritage Korean', 'K-culture learning', 'Hoya'],
    ogDescription: 'Heritage Journey + Korean culture cards + Hoya the tiger. Start Korean from zero, at any age. Stage 1 is free.',
    twitterDescription: 'Heritage Journey + Korean culture cards + Hoya the tiger. Start Korean from zero, at any age.',
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
   * The site header (F-SITE-002 §3.2). `learners`, `parents`, `teachers`, `signIn`, `start`, `skip` and `current`
   * are the new header's; `playNow`, `cards`, `games` and `dashboard` are the old landing header's until S-6.
   * `current` is the visually hidden suffix of the current page's link.
   */
  nav: {
    label: 'Main',
    playNow: { cta: 'Play now' },
    cards: 'Cards',
    games: 'Games',
    learners: 'Learners',
    parents: 'Parents',
    dashboard: 'Dashboard',
    teachers: 'Teachers',
    signIn: 'Sign in',
    start: 'Start learning',
    skip: 'Skip to content',
    current: '(current page)',
  },
  /**
   * The layered home `/` (F-SITE-002 §3.3, appendix B.1). `hero.title` is the tagline; the taught letter in Hoya's
   * bubble is passed in. `how.routeBody` replaces step 3's line only while the `learningRoute` claim is on.
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
      bubble: (letter: string) => `Annyeong! Let's meet ${letter}.`,
    },
    who: {
      title: 'Who is it for?',
      items: {
        learners: {
          title: 'Learners',
          body: 'Five-minute quests, a guide who never scolds, and Korean culture cards to collect.',
          linkLabel: 'For learners',
        },
        parents: {
          title: 'Parents and caregivers',
          body: 'See what your learner practises, with a grown-up gate and no ads.',
          linkLabel: 'For parents',
        },
        teachers: {
          title: 'Teachers',
          body: 'Students join with a class code. No student emails, no accounts.',
          linkLabel: 'For teachers',
        },
      },
    },
    how: {
      title: 'How it works',
      steps: {
        start: { title: 'Open the app', body: 'Choose who is learning and begin.' },
        quests: { title: 'Learn in five-minute quests', body: 'Letters, sounds and first words, with sound and pictures on every screen.' },
        collect: { title: 'Collect and keep going', body: 'Earn Korean culture cards. Your progress is saved on your device.' },
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
   * The only cost words on the site (F-SITE-002 §3.9, OD-7): never a price, never a term. The cost line is the free
   * line, then the `paid` line the `paidPlans` claim picks. The free plan is all of Stage 1 (F-ENT-003 OD-1), so
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
        title: 'How a quest works',
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
           * Content and safety review in S-3: "Most" matches the Privacy Policy (usage events such as a finished quest
           * are sent without sign-in); a grown-up's sign-in syncs progress so it can be restored (Privacy Policy,
           * security); a class or family join shares only a summary (F-SPACE-001 §3.5).
           */
          localFirst:
            'Most learning data stays on the device. When a grown-up signs in, progress is saved to our servers so it can be restored. When a learner joins a class or family with a code, only a short progress summary is shared with that space.',
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
      /** "What can I see?" is answered by `follow.body`, plus `follow.reports` while its claim is on. */
      faq: {
        account: { q: 'Does my learner need an account?', a: 'No. Learners never need an email or a password.' },
        learnAlong: { q: 'Can I learn alongside them?', a: 'Yes. Learning Korean yourself? Play the same quests.' },
        whatSee: { q: 'What can I see?' },
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
  hero: {
    badges: { allAges: 'All ages', heritage: 'Heritage families', fans: 'K-culture fans' },
    /** One heading, shown on two lines. */
    titleLines: ['Learn Hangul from zero —', 'at any age.'],
    /** `letter` is the taught letter the page shows (Hangul, passed in). */
    lead: (letter: string) =>
      `Hoya the tiger guides you from ${letter} to Chuseok — five-minute quests, plain-English instructions, and Korean culture cards to collect along the way. Kids, teens and grown-ups play the same quests. Played, not taught. Never a frown.`,
    play: { cta: 'Play in your browser' },
    seeCards: { cta: 'See the cards' },
    facts: 'Nothing to download · No ads · Works offline after your first visit',
    /** Hoya's speech bubble on the hero art; `letter` is passed in. */
    bubble: (letter: string) => `Annyeong! Let's meet ${letter}.`,
  },
  trust: {
    label: 'Trust',
    items: {
      coppa: { title: 'COPPA-compliant', body: 'No third-party tracking. Parent email is the only PII.' },
      ads: { title: 'No ads, ever', body: 'No third-party ads. No data sold. Revenue is in-app only.' },
      offline: {
        title: 'Works offline',
        body: 'After your first visit the app opens without a connection. Letter sounds need a Korean voice on your device until our own recordings arrive.',
      },
      antiShame: { title: 'Anti-shame design', body: 'Wrong answers use amber. No red. No streak guilt.' },
    },
  },
  how: {
    title: 'How it works',
    steps: {
      journey: { title: 'Heritage Journey', body: '7 stages × 5 culture themes. Every learner draws their own route through Korean.' },
      games: { title: 'Mini-games', body: 'Tap, build, trace, and match — five-minute games that fit into any day, at any age.' },
      collect: {
        title: 'Collect culture',
        body: (cards: number) =>
          plural('en', cards, {
            one: `Earn ${cards} Heritage Card in Stage 1 — from kimchi to Chuseok to the gayageum.`,
            other: `Earn ${cards} Heritage Cards in Stage 1 — from kimchi to Chuseok to the gayageum.`,
          }),
      },
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
  /** Meet Hoya (`MeetHoya`); the Korean phrase and its romanization are passed in. */
  hoya: {
    eyebrow: 'Meet Hoya',
    title: 'A tiger who never says “wrong.”',
    body: 'Hoya is a young tiger and the only voice in the app. Korean folklore opens with “Long ago, when tigers smoked tobacco…” so the tiger is Korea’s grandparent character. Hoya is a young one — so learners meet a peer, not an authority.',
    bubble: (korean: string, romanization: string) => `${korean} · ${romanization} · almost there!`,
    points: {
      wrong: { title: 'Wrong answer?', body: (korean: string) => `Hoya says “${korean}” (almost there) on amber — never red.` },
      right: { title: 'Right answer?', body: 'One star, one card, one quiet cheer. No coin sounds.' },
      streak: { title: 'No streak shame.', body: 'Skip a day. Hoya is happy to see you when you come back.' },
    },
  },
  parents: {
    eyebrow: 'For parents',
    title: 'Five minutes a day. Nothing creepy.',
    body: 'Many of our learners are children, so Hangul Route is built for tired parents too. Hand the phone over for five minutes; come back to one new Korean letter and one heritage card. Learning Korean yourself? Play the same quests. Bring it on a long flight — the app works offline after your first visit.',
    points: {
      localFirst: { title: 'Local-first by default.', body: 'All learning data stays on the device until you sign in.' },
      gate: { title: 'Parent-gate.', body: 'Anything that costs money or deletes data is behind a simple multiplication question.' },
      shared: { title: 'Siblings share a device.', body: 'Each learner keeps their own stars and cards. No upsell.' },
    },
  },
  /** The one thing the landing says about cost (owner decision 2026-10-10): no price, nothing sold that is not built. */
  pricing: {
    title: 'Pricing',
    lines: {
      stage1: { name: 'Stage 1', detail: 'free' },
      stages: { name: 'More stages', detail: 'coming' },
      classroom: { name: 'Classroom plans', detail: 'coming' },
    },
    footnote: 'No third-party ads, ever.',
  },
  faq: {
    title: 'Common questions',
    items: {
      who: {
        q: 'Who is Hangul Route for?',
        a: 'Anyone learning Hangul from zero, at any age — kids, teens and adults, heritage families and K-culture fans. Everyone plays the same quests. Stage 1 (Hangul) works for confident readers and pre-readers alike — every screen has voice and visuals.',
      },
      adult: FAQ_ADULT,
      different: {
        q: 'What makes this different from other language apps?',
        a: 'Most apps start with vocabulary drills. We start with the alphabet and Korean culture — one collectable heritage card at a time. And no red feedback, ever.',
      },
      korean: FAQ_KOREAN,
      session: {
        q: 'How long is a session?',
        a: 'One quest takes about 5 minutes. Most learners do 1–3 quests per sitting. You can stop any time — no streak shame.',
      },
      cost: {
        q: 'How much does it cost?',
        a: 'Stage 1 is free. More stages and classroom plans are coming. No ads.',
      },
    },
  },
  /** The #get section around the launch-news form. */
  get: {
    title: 'Try Hangul Route this week.',
    body: "Hangul Route runs in your browser — open it, add it to your home screen, and it works offline. Leave your email and we'll send you the launch news.",
    play: { cta: 'Play now — free' },
    devices: 'Works on iPhone, Android, iPad and Chromebook — any modern browser.',
  },
  footer: {
    /** The new footer's group headings (F-SITE-002 §3.2); `product`, `cards`, `games`, `dashboard`, `console` go in S-6. */
    guide: 'Guide',
    app: 'App',
    product: 'Product',
    cards: 'Heritage cards',
    games: 'Mini-games',
    dashboard: 'Parent dashboard',
    console: 'Teacher console',
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
      localFirst: 'Local-first: data stays on the device until you sign in.',
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
      effective: 'Effective October 11, 2026',
      /** Footer link to the other document. */
      otherDocument: 'Terms of Service',
      sections: {
        short: {
          heading: 'The short version',
          paragraphs: {
            p1: 'Hangul Route is for anyone learning Hangul, at any age — and many of our learners are children. We collect as little as possible, never show ads, and never sell data. Most learning data stays on the device until the account holder chooses to sign in. When the learner is a child, a parent is always in control.',
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
            p1: 'By default, learning data is stored locally on the device. If a parent signs in, progress syncs to our servers (Cloudflare) so it can be restored on a new device. Data in transit is encrypted (HTTPS), and at rest it is access-controlled.',
          },
        },
        payments: {
          heading: 'Payments and subscriptions',
          paragraphs: {
            p1: 'Subscriptions are billed through the Apple App Store or Google Play. We never see or store full card numbers — the store handles payment and gives us only the minimum needed to unlock the subscription on the account.',
          },
        },
        thirdParty: {
          heading: 'Third-party services',
          bullets: {
            stores: 'Apple App Store / Google Play — payments and subscription management.',
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
      effective: 'Effective May 22, 2026',
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
          bullets: {
            premium: 'Premium content is offered as an auto-renewing subscription billed through the Apple App Store or Google Play.',
            renews: 'Your subscription renews automatically unless you cancel at least 24 hours before the end of the current period.',
            manage: 'Manage or cancel anytime in your App Store or Google Play account settings.',
            refunds: 'Refunds are handled by the store under its policy. A free trial, if offered, converts to a paid subscription unless cancelled before it ends.',
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
