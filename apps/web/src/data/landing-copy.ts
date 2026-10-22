import { DEFAULT_LOCALE, LOCALE_META, getMessages, type Messages, type UiLocale } from '@hangul-route/i18n';
import type { Metadata } from 'next';
import type { LocaleBannerOffer } from '../lib/locale-banner';
import { sitePath } from '../lib/site-path';

/**
 * Landing copy — one source for the site metadata, the launch-news form's words and the locale banner. The words
 * live in `@hangul-route/i18n` (`messages/en/landing.ts`, F-I18N-001 PR 11a); this module shapes them for a locale
 * (English by default).
 *
 * Audience (owner decision 2026-10-09, CLAUDE.md §1): anyone learning Hangul
 * from zero, at any age — kids, teens, adults, heritage families and
 * K-culture fans. Many learners are children, so the child-safety promises
 * stay; the framing never targets children only and never names an age range.
 *
 * Cost (owner decision 2026-10-10): the landing quotes no price and sells
 * nothing that is not on sale. Payments are not live (Stripe sandbox), so it
 * says only what is true today: Stage 1 is free, the later stages are in the
 * app too, and family and class plans are on the way. Concrete prices come
 * back with the launch of payments (PLAN_PRICING is their source then).
 */

export interface LandingCopy {
  title: string;
  tagline: string;
  metadata: Metadata;
}

/** The site's title, tagline and default metadata in `locale`. */
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
  };
}

const english = landingCopy();

export const SITE_TITLE = english.title;

export const SITE_TAGLINE = english.tagline;

export const siteMetadata: Metadata = english.metadata;

/**
 * The launch-news form's English words (`landing.waitlist`, F-I18N-001 PR 11a). A repeat signup shows the same
 * success text as a first one. The consent line is `consentLead` + a mailto link reading `contactLink` + '. ' + a
 * /privacy link reading `privacyLink`; keep it in step with CONSENT_TEXT_VERSION on the API. Server-side only:
 * the page passes these words to the client form, which never imports the dictionary.
 */
export const WAITLIST_COPY: Messages['landing']['waitlist'] = getMessages(DEFAULT_LOCALE).landing.waitlist;

/**
 * The "View in <language>" banner's suggestions (F-I18N-001 §3.3, PR 11c): one per shown locale other than English,
 * worded in that locale's own dictionary so a visitor who prefers it can read it. Server-side: the client banner
 * receives these words and never imports the dictionary. [SN] AMENDMENTS-SITE-NEWUSER §3.2: the banner shows on every
 * English page and offers the same page in the suggested locale (`sitePath(target, page)`); the English 404 passes
 * `/`, since its unknown path would be another 404.
 */
export function localeBannerOffers(shown: readonly UiLocale[], page: string = '/'): Partial<Record<UiLocale, LocaleBannerOffer>> {
  const offers: Partial<Record<UiLocale, LocaleBannerOffer>> = {};
  for (const locale of shown) {
    if (locale === DEFAULT_LOCALE) continue;
    const words = getMessages(locale).landing.localeBanner;
    const { endonym, htmlLang } = LOCALE_META[locale];
    offers[locale] = { href: sitePath(locale, page), lang: htmlLang, label: words.label, text: words.viewIn(endonym), dismiss: words.dismiss, close: words.close.cta };
  }
  return offers;
}
