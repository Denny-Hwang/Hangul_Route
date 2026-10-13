import { touchTarget } from '@hangul-route/design-system/tokens';
import { LOCALE_META, getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleBannerView } from '../../components/landing/LocaleBanner';
import { localeBannerOffers } from '../../data/landing-copy';
import { HomePage as LandingPage } from '../../components/landing/HomePage';
import { LocaleSwitcher } from '../../components/landing/LocaleSwitcher';
import { SITE_PAGES, type SitePage, siteMetadataFor } from '../../lib/site-metadata';

/**
 * F-I18N-001 PR 11c (§3.3, §3.4): per-locale metadata with hreflang alternates, the footer locale switcher,
 * the "View in <language>" banner and the `?lang=` hand-off on "Play now". While es and ko are hidden none
 * of it shows: the English pages render as before. A QA build (`NEXT_PUBLIC_SHOW_ALL_LOCALES=1`) shows all.
 */
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '');
});
afterEach(() => vi.unstubAllEnvs());

const APP_URL = 'https://app.hangulroute.com';
const hrefs = (html: string): string[] => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1] ?? '');

type Meta = ReturnType<typeof siteMetadataFor>;
const EN_PAGES: Record<SitePage, () => Promise<{ generateMetadata: () => Meta }>> = {
  '/': () => import('../(en)/page'),
  '/about': () => import('../(en)/about/page'),
  '/privacy': () => import('../(en)/privacy/page'),
  '/terms': () => import('../(en)/terms/page'),
  '/learners': () => import('../(en)/learners/page'),
  '/parents': () => import('../(en)/parents/page'),
  '/teachers': () => import('../(en)/teachers/page'),
};
const LOC_PAGES: Record<SitePage, () => Promise<{ generateMetadata: (p: { params: { locale: string } }) => Meta }>> = {
  '/': () => import('../(loc)/[locale]/page'),
  '/about': () => import('../(loc)/[locale]/about/page'),
  '/privacy': () => import('../(loc)/[locale]/privacy/page'),
  '/terms': () => import('../(loc)/[locale]/terms/page'),
  '/learners': () => import('../(loc)/[locale]/learners/page'),
  '/parents': () => import('../(loc)/[locale]/parents/page'),
  '/teachers': () => import('../(loc)/[locale]/teachers/page'),
};

describe('every site page exports its own metadata', () => {
  it.each(SITE_PAGES)('%s in English and in each site locale, hidden and on a QA build', async (page) => {
    const en = await EN_PAGES[page]();
    const loc = await LOC_PAGES[page]();
    expect(en.generateMetadata()).toEqual(siteMetadataFor('en', page));
    for (const locale of ['es', 'ko'] as const) expect(loc.generateMetadata({ params: { locale } })).toEqual(siteMetadataFor(locale, page));
    vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '1');
    expect(en.generateMetadata().alternates).toEqual(siteMetadataFor('en', page, true).alternates);
    expect(loc.generateMetadata({ params: { locale: 'es' } }).robots).toEqual({ index: true, follow: true });
  });

  it('a locale page for something that is not a site locale names English metadata, and the page itself is a 404', async () => {
    const loc = await LOC_PAGES['/about']();
    expect(loc.generateMetadata({ params: { locale: 'fr' } })).toEqual(siteMetadataFor('en', '/about'));
  });
});

describe('while es and ko are hidden, the landing is unchanged', () => {
  it('no switcher, no banner, and Start learning goes to the app as it is', () => {
    const html = renderToStaticMarkup(<LandingPage locale="en" />);
    expect(html).not.toContain('hrefLang');
    expect(html).not.toContain('hreflang');
    expect(html).not.toContain(`aria-label="${getMessages('en').landing.footer.language}"`);
    expect(hrefs(html).filter((h) => h.startsWith(APP_URL))).toEqual([APP_URL, APP_URL, APP_URL]);
  });

  it('the switcher renders nothing with one locale', () => {
    expect(renderToStaticMarkup(<LocaleSwitcher locale="en" page="/" label="Language" shown={['en']} />)).toBe('');
  });

  it('no banner offers', () => {
    expect(localeBannerOffers(['en'])).toEqual({});
  });
});

describe('Start learning from /es and /ko hands the locale to the app (?lang=): header, hero and footer', () => {
  it.each(['es', 'ko'] as const)('%s', (locale) => {
    const html = renderToStaticMarkup(<LandingPage locale={locale} />);
    expect(hrefs(html).filter((h) => h.startsWith(APP_URL))).toEqual(Array(3).fill(`${APP_URL}?lang=${locale}`));
  });
});

describe('on a QA build every locale is offered', () => {
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '1'));

  it.each(['en', 'es', 'ko'] as const)('the footer switcher on the %s landing links each locale home, named by its endonym', (locale) => {
    const html = renderToStaticMarkup(<LandingPage locale={locale} />);
    const nav = html.match(new RegExp(`<nav aria-label="${getMessages(locale).landing.footer.language}"[^>]*>.*?</nav>`))?.[0] ?? '';
    expect(nav).not.toBe('');
    const links = [...nav.matchAll(/<a ([^>]*)>([^<]*)<\/a>/g)].map((m) => ({ attrs: m[1] ?? '', text: m[2] ?? '' }));
    expect(links.map((l) => l.text)).toEqual(['English', 'Español', '한국어']);
    expect(links.map((l) => hrefs(`${l.attrs}`)[0])).toEqual(['/', '/es', '/ko']);
    for (const [i, target] of (['en', 'es', 'ko'] as const).entries()) {
      expect(links[i]?.attrs).toContain(`hrefLang="${LOCALE_META[target].htmlLang}"`);
      expect(links[i]?.attrs).toContain(`lang="${LOCALE_META[target].htmlLang}"`);
      expect(links[i]?.attrs.includes('aria-current="page"')).toBe(target === locale);
    }
  });

  it('the switcher keeps the page: About links each locale\'s About', () => {
    const html = renderToStaticMarkup(<LocaleSwitcher locale="es" page="/about" label="Language" shown={['en', 'es', 'ko']} />);
    expect(hrefs(html)).toEqual(['/about', '/es/about', '/ko/about']);
  });

  it('the banner offers each other locale, worded in that locale and linking its home', () => {
    const offers = localeBannerOffers(['en', 'es', 'ko']);
    expect(Object.keys(offers)).toEqual(['es', 'ko']);
    expect(offers.es).toEqual({
      href: '/es',
      lang: 'es',
      label: getMessages('es').landing.localeBanner.label,
      text: getMessages('es').landing.localeBanner.viewIn('Español'),
      dismiss: getMessages('es').landing.localeBanner.dismiss,
      close: getMessages('es').landing.localeBanner.close.cta,
    });
    expect(offers.ko?.text).toBe(getMessages('ko').landing.localeBanner.viewIn('한국어'));
  });

  it('the banner view: a link to the locale in its language, and a close button', () => {
    const offer = localeBannerOffers(['en', 'es'])['es']!;
    const html = renderToStaticMarkup(<LocaleBannerView offer={offer} onDismiss={() => undefined} />);
    expect(html).toContain(`aria-label="${offer.label}"`);
    expect(html).toContain('lang="es"');
    expect(html).toMatch(/<a [^>]*href="\/es"[^>]*hrefLang="es"[^>]*>Ver en Español<\/a>/);
    expect(html).toContain(`<button type="button" aria-label="${offer.dismiss}"`);
  });

  it('both banner controls are touch-sized: the link as well as the close button', () => {
    const offer = localeBannerOffers(['en', 'es'])['es']!;
    const html = renderToStaticMarkup(<LocaleBannerView offer={offer} onDismiss={() => undefined} />);
    const link = html.match(/<a [^>]*>/)?.[0] ?? '';
    const button = html.match(/<button [^>]*>/)?.[0] ?? '';
    expect(link).toContain(`min-height:${touchTarget.min}px`);
    expect(button).toContain(`min-height:${touchTarget.min}px`);
  });

  it('the banner is client-only: the static HTML of / holds none of it', () => {
    const html = renderToStaticMarkup(<LandingPage locale="en" />);
    expect(html).not.toContain('View in');
  });
});

describe('the legal pages stay English-authoritative under a localized notice (decision L10)', () => {
  const LEGAL = [
    ['privacy', () => import('../(en)/privacy/page'), () => import('../(loc)/[locale]/privacy/page')],
    ['terms', () => import('../(en)/terms/page'), () => import('../(loc)/[locale]/terms/page')],
  ] as const;
  const NOTICE = /<p role="note" data-testid="english-authoritative"[^>]*>([^<]*)<\/p>/;

  it.each(LEGAL)('%s: English has no notice and no lang marks', async (_name, en) => {
    const html = renderToStaticMarkup((await en()).default());
    expect(html).not.toMatch(NOTICE);
    expect(html).not.toContain('lang=');
  });

  it.each(LEGAL)('%s: /es and /ko show the notice in their words, above the document marked lang="en"', async (_name, _en, loc) => {
    const mod = (await loc()) as { default: (p: { params: { locale: string } }) => JSX.Element };
    for (const locale of ['es', 'ko'] as const) {
      const html = renderToStaticMarkup(mod.default({ params: { locale } }));
      const notice = html.match(NOTICE);
      expect(notice?.[1]).toBe(getMessages(locale).landing.legal.englishAuthoritative);
      // Notice first, then the title, the date, every section and the other document's link, each marked English.
      expect(html.indexOf(notice?.[0] ?? '')).toBeLessThan(html.indexOf('<h1'));
      expect(html).toMatch(/<h1 lang="en"/);
      expect((html.match(/<section lang="en"/g) ?? []).length).toBe((html.match(/<section/g) ?? []).length);
      expect(html).toMatch(/<a [^>]*lang="en"[^>]*>(Terms of Service|Privacy Policy)<\/a>/);
    }
  });
});

