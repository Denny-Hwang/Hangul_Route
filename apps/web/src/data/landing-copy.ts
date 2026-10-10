import type { Metadata } from 'next';
import { stage1Cards } from './stage1-cards';

/**
 * Landing copy — one source for the site metadata and the landing page.
 *
 * Audience (owner decision 2026-10-09, CLAUDE.md §1): anyone learning Hangul
 * from zero, at any age — kids, teens, adults, heritage families and
 * K-culture fans. Many learners are children, so the child-safety promises
 * stay; the framing never targets children only and never names an age range.
 *
 * Cost (owner decision 2026-10-10): the landing quotes no price and sells
 * nothing that is not built. Payments are not live and Stages 2–7 are not
 * built, so it says only what is true today — Stage 1 is free — and that
 * more stages and classroom plans are coming. Concrete prices come back with
 * the launch of payments (PLAN_PRICING is their source then).
 */

export const SITE_TITLE = 'Hangul Route — Learn Hangul from zero with Hoya';

export const SITE_TAGLINE = 'Learn Hangul from zero — at any age.';

export const siteMetadata: Metadata = {
  title: SITE_TITLE,
  description:
    'Learn Hangul from zero with Hoya the tiger — for anyone, at any age: heritage families, K-culture fans and curious beginners. Five-minute quests, 8 mini-games, Korean culture cards to collect, and a Heritage Journey across 7 stages and 5 culture themes. Stage 1 is free and more stages are coming. No ads, ever.',
  applicationName: 'Hangul Route',
  keywords: [
    'learn Hangul',
    'Korean alphabet',
    'learn Korean',
    'Korean for beginners',
    'heritage Korean',
    'K-culture learning',
    'Hoya',
  ],
  openGraph: {
    title: SITE_TITLE,
    description:
      'Heritage Journey + Korean culture cards + Hoya the tiger. Start Korean from zero, at any age. Stage 1 is free.',
    siteName: 'Hangul Route',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: 'Heritage Journey + Korean culture cards + Hoya the tiger. Start Korean from zero, at any age.',
  },
  robots: { index: true, follow: true },
};

export const audienceBadges: readonly string[] = ['All ages', 'Heritage families', 'K-culture fans'];

export interface TitledCopy {
  title: string;
  body: string;
}

export const trustItems: readonly TitledCopy[] = [
  { title: 'COPPA-compliant', body: 'No third-party tracking. Parent email is the only PII.' },
  { title: 'No ads, ever', body: 'No third-party ads. No data sold. Revenue is in-app only.' },
  { title: 'Plays offline', body: 'After your first visit, the full Stage 1 plays without a connection.' },
  { title: 'Anti-shame design', body: 'Wrong answers use amber. No red. No streak guilt.' },
];

export interface HowItWorksStep extends TitledCopy {
  step: string;
}

export const howItWorks: readonly HowItWorksStep[] = [
  {
    step: '1',
    title: 'Heritage Journey',
    body: '7 stages × 5 culture themes. Every learner draws their own route through Korean.',
  },
  {
    step: '2',
    title: 'Mini-games',
    body: 'Tap, build, trace, and match — five-minute games that fit into any day, at any age.',
  },
  {
    step: '3',
    title: 'Collect culture',
    body: `Earn ${stage1Cards.length} Heritage Cards in Stage 1 — from kimchi to Chuseok to the gayageum.`,
  },
];

/** The one thing the landing says about cost (owner decision 2026-10-10). */
const COST_LINE = 'Stage 1 is free. More stages and classroom plans are coming.';

export interface Faq {
  q: string;
  a: string;
}

export const landingFaqs: readonly Faq[] = [
  {
    q: 'Who is Hangul Route for?',
    a: 'Anyone learning Hangul from zero, at any age — kids, teens and adults, heritage families and K-culture fans. Everyone plays the same quests. Stage 1 (Hangul) works for confident readers and pre-readers alike — every screen has voice and visuals.',
  },
  {
    q: 'I’m an adult beginner. Will it feel too young?',
    a: 'No. Stage 1 teaches exactly what any beginner needs first — the letters and their sounds — with no baby talk. Hoya is friendly, and the culture cards are worth collecting at any age.',
  },
  {
    q: 'What makes this different from other language apps?',
    a: 'Most apps start with vocabulary drills. We start with the alphabet and Korean culture — one collectable heritage card at a time. And no red feedback, ever.',
  },
  {
    q: 'Do I need to know any Korean?',
    a: 'No — starting from zero is what we built it for. Instructions are in plain, simple English. Korean only appears as the thing being learned.',
  },
  {
    q: 'How long is a session?',
    a: 'One quest takes about 5 minutes. Most learners do 1–3 quests per sitting. You can stop any time — no streak shame.',
  },
  {
    q: 'How much does it cost?',
    a: `${COST_LINE} No ads.`,
  },
];

export interface PricingLine {
  name: string;
  detail: string;
}

export const pricingLines: readonly PricingLine[] = [
  { name: 'Stage 1', detail: 'free' },
  { name: 'More stages', detail: 'coming' },
  { name: 'Classroom plans', detail: 'coming' },
];

export const sharedDeviceBullet: TitledCopy = {
  title: 'Siblings share a device.',
  body: 'Each learner keeps their own stars and cards. No upsell.',
};

export const pricingFootnote = 'No third-party ads, ever.';
