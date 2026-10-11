import { LOCALE_META, getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleBannerView } from '../../components/landing/LocaleBanner';
import { localeBannerOffers } from '../../data/landing-copy';
import { LandingPage } from '../../components/landing/LandingPage';
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
};
const LOC_PAGES: Record<SitePage, () => Promise<{ generateMetadata: (p: { params: { locale: string } }) => Meta }>> = {
  '/': () => import('../(loc)/[locale]/page'),
  '/about': () => import('../(loc)/[locale]/about/page'),
  '/privacy': () => import('../(loc)/[locale]/privacy/page'),
  '/terms': () => import('../(loc)/[locale]/terms/page'),
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
  it('no switcher, no banner, and "Play now" goes to the app as it is', () => {
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

describe('"Play now" from /es and /ko hands the locale to the app (?lang=)', () => {
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
    expect(html).toMatch(/<a [^>]*href="\/es"[^>]*hrefLang="es"[^>]*>View in Español<\/a>/);
    expect(html).toContain(`<button type="button" aria-label="${offer.dismiss}"`);
  });

  it('the banner is client-only: the static HTML of / holds none of it', () => {
    const html = renderToStaticMarkup(<LandingPage locale="en" />);
    expect(html).not.toContain('View in');
  });
});
