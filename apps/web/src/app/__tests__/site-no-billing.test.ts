import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_ROUTES } from '@hangul-route/content-schema';
import { LOCALES, type UiLocale } from '@hangul-route/i18n';
import type { Metadata } from 'next';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AboutPage } from '../../components/landing/AboutPage';
import { HomePage } from '../../components/landing/HomePage';
import { LearnersPage } from '../../components/landing/LearnersPage';
import { ParentsPage } from '../../components/landing/ParentsPage';
import { PrivacyPage } from '../../components/landing/PrivacyPage';
import { TeachersPage } from '../../components/landing/TeachersPage';
import { TermsPage } from '../../components/landing/TermsPage';
import { ALL_CLAIMS_ON } from '../../data/__tests__/site-claims-fixtures';
import { SITE_CLAIMS, type SiteClaims } from '../../data/site-claims';
import { SITE_PAGES, type SitePage } from '../../lib/site-metadata';
import * as EnAbout from '../(en)/about/page';
import EnLayout from '../(en)/layout';
import * as EnLearners from '../(en)/learners/page';
import * as EnHome from '../(en)/page';
import * as EnParents from '../(en)/parents/page';
import * as EnPrivacy from '../(en)/privacy/page';
import * as EnTeachers from '../(en)/teachers/page';
import * as EnTerms from '../(en)/terms/page';
import * as LocAbout from '../(loc)/[locale]/about/page';
import LocLayout from '../(loc)/[locale]/layout';
import * as LocLearners from '../(loc)/[locale]/learners/page';
import * as LocHome from '../(loc)/[locale]/page';
import * as LocParents from '../(loc)/[locale]/parents/page';
import * as LocPrivacy from '../(loc)/[locale]/privacy/page';
import * as LocTeachers from '../(loc)/[locale]/teachers/page';
import * as LocTerms from '../(loc)/[locale]/terms/page';
import { SITE_PRICE_PATTERNS } from './site-price-patterns';

/**
 * F-BILL-002 B-10 (section 11; section 4.1): hangulroute.com is the intro site, and billing lives only on
 * app.hangulroute.com. This guard scans `app/(en)`, `app/(loc)` and `components/landing` for **links and amounts
 * only**:
 *
 * - no link to the billing page: `APP_ROUTES.billing`, `/teach/billing` or `/billing`, on any origin and in any
 *   locale (rendered `href`, `action` and `formaction` values, the page metadata and the module sources);
 * - no Stripe Checkout, Customer Portal or Payment Link URL, as a link or as printed text;
 * - no amount: the landing-claims banned-price patterns (`site-price-patterns.ts`) plus a currency sign or code next
 *   to a number, in English, Spanish and Korean.
 *
 * Allowed (the allow-list of section 11): words. The legal pages' prose may say that payments go through Stripe and
 * that a plan bought on the web renews (F-SITE-002 S-7, OD-13), and a page may say that plans exist; neither is a
 * link or an amount. F-SITE-002's own guards (`site-links.test.ts`, `site-chrome.test.tsx`, `persona-pages.test.tsx`,
 * `landing-claims.test.tsx`) pin parts of the same rule from the site's side; this one covers every page, every
 * locale and every claim state at once.
 */
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '');
  vi.stubEnv('CONSOLE_ORIGIN', '');
});
afterEach(() => vi.unstubAllEnvs());

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..');
const SCANNED_DIRS = [join(appDir, '(en)'), join(appDir, '(loc)'), join(appDir, '..', 'components', 'landing')] as const;

// ---------------------------------------------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------------------------------------------

/** The billing page paths a site link must never reach (section 4.1): the app route, the old console page, `/billing`. */
const BILLING_PATHS: readonly string[] = [APP_ROUTES.billing, '/teach/billing', '/billing'];

/** Stripe hosts that take a payment or manage one: Checkout, the Customer Portal, Payment Links and invoices. */
const STRIPE_PAYMENT_HOST = /(?:^|\.)(?:checkout|billing|buy|invoice|pay)\.stripe\.com$/i;
/** Stripe payment URLs printed anywhere (a link written out as text is still a way to pay). */
const STRIPE_PAYMENT_URL = /\b(?:checkout|billing|buy|invoice|pay)\.stripe\.com\b|\bstripe\.com\/(?:[a-z-]+\/)?(?:checkout|billing|pay)\b/i;

/** The locale prefixes a site path may carry (`/es/...`, `/ko/...`). */
const LOCALE_PREFIX = new RegExp(`^/(?:${LOCALES.join('|')})(?=/|$)`);

/** The pathname of a link, without its origin, locale prefix, query or fragment; `null` for a non-http link. */
function linkPath(href: string): string | null {
  const value = href.trim();
  if (/^(?:mailto|tel|data|javascript):/i.test(value) || value.startsWith('#')) return null;
  let url: URL;
  try {
    url = new URL(value, 'https://hangulroute.com');
  } catch {
    return null;
  }
  const path = decodeURIComponent(url.pathname).replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
  return path.replace(LOCALE_PREFIX, '') || '/';
}

/** True when `href` leads to the billing page or to a Stripe payment page. */
function isBillingLink(href: string): boolean {
  const value = href.trim();
  try {
    if (STRIPE_PAYMENT_HOST.test(new URL(value, 'https://hangulroute.com').hostname)) return true;
  } catch {
    // Not a URL: the path check below decides.
  }
  if (STRIPE_PAYMENT_URL.test(value)) return true;
  const path = linkPath(value);
  if (path === null) return false;
  return BILLING_PATHS.some((billing) => path === billing || path.startsWith(`${billing}/`)) || /(?:^|\/)billing(?:\/|$)/i.test(path);
}

/** Amounts: the shared landing-claims price patterns plus a currency sign or code next to a number (en, es, ko). */
const AMOUNT_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  ...SITE_PRICE_PATTERNS,
  { name: 'a currency sign before a number', re: /[$\u20AC\u00A3\u20A9\u00A5]\s?\d/ },
  { name: 'a currency sign or code after a number', re: /\d\s?(?:[$\u20AC\u00A3\u20A9\u00A5]|US\$|USD\b|EUR\b|KRW\b|d[o\u00F3]lar(?:es)?\b|dollars?\b)/i },
  { name: 'a price in Korean (won or dollars after a number)', re: /\d\s?(?:\uC6D0|\uB2EC\uB7EC)/ },
  { name: 'a price per year or month (es)', re: /\bal\s+(?:a\u00F1o|mes)\b|\bpor\s+(?:a\u00F1o|mes)\b/i },
  { name: 'a price per year or month (ko)', re: /(?:\uC5F0|\uC6D4)\s?\d/ },
];

function amountsIn(text: string): string[] {
  return AMOUNT_PATTERNS.filter(({ re }) => re.test(text)).map(({ name }) => name);
}

// ---------------------------------------------------------------------------------------------------------------
// What a visitor gets: every page, every locale, the claim states, the metadata
// ---------------------------------------------------------------------------------------------------------------

const decode = (s: string): string =>
  s
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;|&#xa0;/g, ' ')
    .replace(/&amp;/g, '&');
const textOf = (html: string): string => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
/** Every link-like attribute value in the markup: anchors, forms, buttons, `<link>`. */
const linksOf = (html: string): string[] =>
  [...html.matchAll(/\s(?:href|action|formaction|formAction)="([^"]*)"/g)].map((m) => decode(m[1] ?? ''));

type EnRoute = { default: () => JSX.Element; generateMetadata: () => Metadata };
type LocRoute = {
  default: (props: { params: { locale: string } }) => JSX.Element;
  generateMetadata: (props: { params: { locale: string } }) => Metadata;
};

const EN_ROUTES: Readonly<Record<SitePage, EnRoute>> = {
  '/': EnHome,
  '/about': EnAbout,
  '/privacy': EnPrivacy,
  '/terms': EnTerms,
  '/learners': EnLearners,
  '/parents': EnParents,
  '/teachers': EnTeachers,
};
const LOC_ROUTES: Readonly<Record<SitePage, LocRoute>> = {
  '/': LocHome,
  '/about': LocAbout,
  '/privacy': LocPrivacy,
  '/terms': LocTerms,
  '/learners': LocLearners,
  '/parents': LocParents,
  '/teachers': LocTeachers,
};

/** The page components with a claims prop: rendered with today's claims and with every claim on. */
type ClaimsPage = ComponentType<{ locale?: UiLocale; claims?: Readonly<SiteClaims> }>;
const CLAIMS_PAGES: ReadonlyArray<readonly [SitePage, ClaimsPage]> = [
  ['/', HomePage],
  ['/learners', LearnersPage],
  ['/parents', ParentsPage],
  ['/teachers', TeachersPage],
];
const PLAIN_PAGES: ReadonlyArray<readonly [SitePage, ComponentType<{ locale?: UiLocale }>]> = [
  ['/about', AboutPage],
  ['/privacy', PrivacyPage],
  ['/terms', TermsPage],
];

interface Rendered {
  label: string;
  html: string;
}

/** Every page as the route renders it inside its layout, in English and in each site locale. */
function renderRoutes(): Rendered[] {
  const out: Rendered[] = [];
  for (const page of SITE_PAGES) {
    const en = EN_ROUTES[page];
    out.push({ label: `${page} (en route)`, html: renderToStaticMarkup(createElement(EnLayout, { children: createElement(en.default) })) });
    for (const locale of LOCALES.filter((l) => l !== 'en')) {
      const params = { locale };
      const loc = LOC_ROUTES[page];
      const children: ReactNode = createElement(loc.default, { params });
      out.push({ label: `${page} (${locale} route)`, html: renderToStaticMarkup(createElement(LocLayout, { params, children })) });
    }
  }
  return out;
}

/** The claim-bearing pages with every claim on, and the other pages, in every locale. */
function renderClaimStates(): Rendered[] {
  const out: Rendered[] = [];
  for (const locale of LOCALES) {
    for (const [page, Page] of CLAIMS_PAGES) {
      for (const [state, claims] of [
        ['today', SITE_CLAIMS],
        ['all claims on', ALL_CLAIMS_ON],
      ] as const) {
        out.push({ label: `${page} (${locale}, ${state})`, html: renderToStaticMarkup(createElement(Page, { locale, claims })) });
      }
    }
    for (const [page, Page] of PLAIN_PAGES) out.push({ label: `${page} (${locale})`, html: renderToStaticMarkup(createElement(Page, { locale })) });
  }
  return out;
}

function metadataTexts(): Array<{ label: string; text: string }> {
  const out: Array<{ label: string; text: string }> = [];
  for (const page of SITE_PAGES) {
    out.push({ label: `${page} (en)`, text: JSON.stringify(EN_ROUTES[page].generateMetadata()) });
    for (const locale of LOCALES.filter((l) => l !== 'en')) {
      out.push({ label: `${page} (${locale})`, text: JSON.stringify(LOC_ROUTES[page].generateMetadata({ params: { locale } })) });
    }
  }
  return out;
}

/** The pages as built for production, and as built for QA with every locale shown (more links: switcher, hreflang). */
const BUILDS = [
  ['production', ''],
  ['QA, every locale shown', '1'],
] as const;

describe('site-no-billing: rendered pages carry no billing link (F-BILL-002 B-10)', () => {
  for (const [build, showAll] of BUILDS) {
    it(`${build}: no page, in any locale or claim state, links to billing or to a Stripe payment page`, () => {
      vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', showAll);
      const pages = [...renderRoutes(), ...renderClaimStates()];
      expect(pages.length).toBeGreaterThan(0);
      const found = pages.flatMap(({ label, html }) => linksOf(html).filter(isBillingLink).map((href) => `${label}: ${href}`));
      expect(found).toEqual([]);
      const printed = pages.filter(({ html }) => STRIPE_PAYMENT_URL.test(textOf(html))).map(({ label }) => label);
      expect(printed).toEqual([]);
    });

    it(`${build}: no page metadata (canonical, hreflang, Open Graph) points at billing or names an amount`, () => {
      vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', showAll);
      for (const { label, text } of metadataTexts()) {
        const urls = [...text.matchAll(/"((?:https?:\/\/|\/)[^"]*)"/g)].map((m) => m[1] ?? '');
        expect(urls.filter(isBillingLink), label).toEqual([]);
        expect(amountsIn(text), label).toEqual([]);
      }
    });
  }

  it('every site page has an English and a locale route in the scan (a new page cannot skip the guard)', () => {
    expect(Object.keys(EN_ROUTES).sort()).toEqual([...SITE_PAGES].sort());
    expect(Object.keys(LOC_ROUTES).sort()).toEqual([...SITE_PAGES].sort());
    const routeFiles = (dir: string): string[] => sourceFiles(dir).filter((file) => /(?:^|\/)page\.tsx$/.test(file));
    expect(routeFiles(join(appDir, '(en)'))).toHaveLength(SITE_PAGES.length);
    expect(routeFiles(join(appDir, '(loc)'))).toHaveLength(SITE_PAGES.length);
  });
});

describe('site-no-billing: rendered pages name no amount (F-BILL-002 B-10)', () => {
  it('no page, in any locale or claim state, shows a price', () => {
    const pages = [...renderRoutes(), ...renderClaimStates()];
    const found = pages.flatMap(({ label, html }) => amountsIn(textOf(html)).map((name) => `${label}: ${name}`));
    expect(found).toEqual([]);
  });

  it('the allow-list: the legal pages may still say payments go through Stripe (words, not a link)', () => {
    const terms = textOf(renderToStaticMarkup(createElement(TermsPage, { locale: 'en' })));
    const privacy = textOf(renderToStaticMarkup(createElement(PrivacyPage, { locale: 'en' })));
    expect(`${terms} ${privacy}`).toMatch(/\bStripe\b/);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The sources: a link that only shows in some state the renders above miss still fails here
// ---------------------------------------------------------------------------------------------------------------

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== '__tests__') out.push(...sourceFiles(path));
    } else if (/\.(?:ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

/** Billing references in module code: a billing path literal, a Stripe payment URL, or a billing route or URL helper. */
const SOURCE_RULES: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'a billing path literal', re: /['"`](?:https?:\/\/[^'"`\s]*)?(?:\/[a-z]{2})?\/(?:account\/|teach\/)?billing\b/ },
  { name: 'a Stripe payment URL', re: STRIPE_PAYMENT_URL },
  { name: 'APP_ROUTES.billing', re: /\bAPP_ROUTES\s*(?:\.\s*billing|\[\s*['"]billing['"]\s*\])/ },
  { name: 'a billing URL helper', re: /\b(?:consoleBillingUrl|billingReturnUrl|billingUrl)\b/ },
  { name: 'a dollar amount', re: /\$\s?\d/ },
];

describe('site-no-billing: module sources of app/(en), app/(loc) and components/landing (F-BILL-002 B-10)', () => {
  const files = SCANNED_DIRS.flatMap((dir) => sourceFiles(dir));

  it('scans every module of the three folders', () => {
    expect(files.length).toBeGreaterThanOrEqual(SITE_PAGES.length * 2 + 2);
  });

  for (const { name, re } of SOURCE_RULES) {
    it(`no module holds ${name}`, () => {
      const found = files.filter((file) => re.test(readFileSync(file, 'utf8'))).map((file) => relative(appDir, file).split(sep).join('/'));
      expect(found).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------
// The guard itself: each rule catches what it is for, and lets through what the site may say
// ---------------------------------------------------------------------------------------------------------------

describe('site-no-billing: the rules', () => {
  it.each([
    APP_ROUTES.billing,
    `${APP_ROUTES.billing}/receipts`,
    `https://app.hangulroute.com${APP_ROUTES.billing}?checkout=success`,
    '/teach/billing',
    '/teach/billing?checkout=cancel',
    'https://hangulroute.com/teach/billing',
    '/billing',
    '/es/billing',
    '/ko/account/billing#plans',
    'https://checkout.stripe.com/c/pay/cs_test_123',
    'https://billing.stripe.com/p/session/test_123',
    'https://buy.stripe.com/test_123',
  ])('flags %s as a billing link', (href) => {
    expect(isBillingLink(href)).toBe(true);
  });

  it.each([
    '/',
    '/es',
    '/parents',
    '/ko/teachers',
    '/privacy#payments',
    '/terms',
    'https://app.hangulroute.com?lang=ko',
    'https://app.hangulroute.com/sign-in?persona=parent',
    'https://stripe.com/privacy',
    'mailto:hello@hangulroute.com',
    '#plans',
  ])('lets %s through', (href) => {
    expect(isBillingLink(href)).toBe(false);
  });

  it('linkPath drops the origin, the locale, the query and the fragment', () => {
    expect(linkPath('https://app.hangulroute.com/es/account/billing/?x=1#y')).toBe(APP_ROUTES.billing);
    expect(linkPath('/ko')).toBe('/');
    expect(linkPath('/essentials')).toBe('/essentials');
    expect(linkPath('mailto:hello@hangulroute.com')).toBeNull();
  });

  it.each([
    'Family plan: $15.30',
    '$ 15',
    '15.30 US$',
    '15,30 USD',
    '15 dollars',
    '15 d\u00F3lares',
    '\u20AC12',
    '12\u20AC',
    '\u20A920000',
    '20000\uC6D0',
    '15\uB2EC\uB7EC',
    '\uC5F0 15',
    'just 5 per year',
    '5/yr',
    '5 al a\u00F1o',
  ])('finds an amount in %j', (text) => {
    expect(amountsIn(text)).not.toEqual([]);
  });

  it.each([
    'Stage 1 is free. More stages are coming, with plans for families and classes.',
    'On the web, a grown-up pays through Stripe after signing in at app.hangulroute.com.',
    'A plan bought on the web renews each year until it is cancelled.',
    'Stage 1',
    '1\uB2E8\uACC4',
    'Etapa 1',
    'Up to 5 learners in a family.',
  ])('lets %j through', (text) => {
    expect(amountsIn(text)).toEqual([]);
  });
});
