import { DEFAULT_LOCALE, LOCALE_META, getMessages, type Messages, type UiLocale } from '@hangul-route/i18n';
import type { Metadata } from 'next';
import type { LocaleBannerOffer } from '../lib/locale-banner';
import { sitePath } from '../lib/site-path';
import { stage1Cards } from './stage1-cards';

/**
 * Landing copy — one source for the site metadata and the landing page. The words live in
 * `@hangul-route/i18n` (`messages/en/landing.ts`, F-I18N-001 PR 11a); this module shapes them
 * into the lists the page renders, in a fixed order, for a locale (English by default).
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

export interface TitledCopy {
  title: string;
  body: string;
}

export interface HowItWorksStep extends TitledCopy {
  step: string;
}

export interface Faq {
  q: string;
  a: string;
}

export interface PricingLine {
  name: string;
  detail: string;
}

export interface LandingCopy {
  title: string;
  tagline: string;
  metadata: Metadata;
  audienceBadges: readonly string[];
  trustItems: readonly TitledCopy[];
  howItWorks: readonly HowItWorksStep[];
  faqs: readonly Faq[];
  pricingLines: readonly PricingLine[];
  sharedDeviceBullet: TitledCopy;
  pricingFootnote: string;
}

/** The landing's lists and metadata in `locale`; the order of each list is fixed here. */
export function landingCopy(locale: UiLocale = DEFAULT_LOCALE): LandingCopy {
  const t = getMessages(locale).landing;
  const { meta } = t;
  return {
    title: meta.title,
    tagline: meta.tagline,
    metadata: {
      title: meta.title,
      description: meta.description,
      applicationName: t.brand.name,
      keywords: [...meta.keywords],
      openGraph: {
        title: meta.title,
        description: meta.ogDescription,
        siteName: t.brand.name,
        type: 'website',
        locale: LOCALE_META[locale].ogLocale,
      },
      twitter: {
        card: 'summary_large_image',
        title: meta.title,
        description: meta.twitterDescription,
      },
      robots: { index: true, follow: true },
    },
    audienceBadges: [t.hero.badges.allAges, t.hero.badges.heritage, t.hero.badges.fans],
    trustItems: [t.trust.items.coppa, t.trust.items.ads, t.trust.items.offline, t.trust.items.antiShame],
    howItWorks: [
      { step: '1', ...t.how.steps.journey },
      { step: '2', ...t.how.steps.games },
      { step: '3', title: t.how.steps.collect.title, body: t.how.steps.collect.body(stage1Cards.length) },
    ],
    faqs: [t.faq.items.who, t.faq.items.adult, t.faq.items.different, t.faq.items.korean, t.faq.items.session, t.faq.items.cost],
    pricingLines: [t.pricing.lines.stage1, t.pricing.lines.stages, t.pricing.lines.classroom],
    sharedDeviceBullet: t.parents.points.shared,
    pricingFootnote: t.pricing.footnote,
  };
}

const english = landingCopy();

export const SITE_TITLE = english.title;

export const SITE_TAGLINE = english.tagline;

export const siteMetadata: Metadata = english.metadata;

export const audienceBadges: readonly string[] = english.audienceBadges;

export const trustItems: readonly TitledCopy[] = english.trustItems;

export const howItWorks: readonly HowItWorksStep[] = english.howItWorks;

/** The one thing the landing says about cost (owner decision 2026-10-10): the last FAQ and the pricing card. */
export const landingFaqs: readonly Faq[] = english.faqs;

export const pricingLines: readonly PricingLine[] = english.pricingLines;

export const sharedDeviceBullet: TitledCopy = english.sharedDeviceBullet;

export const pricingFootnote = english.pricingFootnote;

/**
 * The launch-news form's English words (`landing.waitlist`, F-I18N-001 PR 11a). A repeat signup shows the same
 * success text as a first one. The consent line is `consentLead` + a mailto link reading `contactLink` + '. ' + a
 * /privacy link reading `privacyLink`; keep it in step with CONSENT_TEXT_VERSION on the API. Server-side only:
 * the page passes these words to the client form, which never imports the dictionary.
 */
export const WAITLIST_COPY: Messages['landing']['waitlist'] = getMessages(DEFAULT_LOCALE).landing.waitlist;

/**
 * The "View in <language>" banner's suggestions on `/` (F-I18N-001 §3.3, PR 11c): one per shown locale other
 * than English, worded in that locale's own dictionary so a visitor who prefers it can read it. Server-side:
 * the client banner receives these words and never imports the dictionary.
 */
export function localeBannerOffers(shown: readonly UiLocale[]): Partial<Record<UiLocale, LocaleBannerOffer>> {
  const offers: Partial<Record<UiLocale, LocaleBannerOffer>> = {};
  for (const locale of shown) {
    if (locale === DEFAULT_LOCALE) continue;
    const words = getMessages(locale).landing.localeBanner;
    const { endonym, htmlLang } = LOCALE_META[locale];
    offers[locale] = { href: sitePath(locale, '/'), lang: htmlLang, label: words.label, text: words.viewIn(endonym), dismiss: words.dismiss, close: words.close.cta };
  }
  return offers;
}
