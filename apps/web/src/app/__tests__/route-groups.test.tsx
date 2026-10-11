import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { siteMetadata } from '../../data/landing-copy';
import { HIDDEN_LOCALE_ATTR } from '../../lib/site-locales';

/**
 * F-I18N-001 PR 11b, §3.4: the static export has no middleware, and the root layout cannot see a
 * `[locale]` param unless it lives inside that segment. So the app is three route groups, each rendering
 * its own `<html>` (the top layout holds only the stylesheet and the site metadata):
 *   (en)              `/`, `/about`, `/privacy`, `/terms` with `<html lang="en">`
 *   (loc)/[locale]    the same pages under `/es` and `/ko` with `<html lang={locale}>`; a locale that
 *                     has not shipped is marked and removed from the export after the build
 *   (console)         `/teach`, `/parent`, `/design-preview`, `<html lang="en">`, client-side locale
 * The page bodies are shared components, so no copy is duplicated.
 */
const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');

type LayoutProps = { children: ReactNode; params?: { locale: string } };
type PageProps = { params: { locale: string } };

const SITE_PAGES = ['page.tsx', join('about', 'page.tsx'), join('privacy', 'page.tsx'), join('terms', 'page.tsx')];

describe('three route groups, each with its own document', () => {
  it('the top layout carries the stylesheet and the site metadata, and renders no <html>', async () => {
    const mod = (await import('../layout')) as { default: (p: LayoutProps) => unknown; metadata: unknown };
    expect(mod.default({ children: 'x' })).toBe('x');
    expect(mod.metadata).toBe(siteMetadata);
    expect(existsSync(join(appDir, 'page.tsx'))).toBe(false);
  });

  it.each(['(en)', join('(loc)', '[locale]'), '(console)'])('%s has its own layout', (group) => {
    expect(existsSync(join(appDir, group, 'layout.tsx'))).toBe(true);
  });

  it.each(SITE_PAGES)('the site page %s exists in English and under [locale]', (page) => {
    expect(existsSync(join(appDir, '(en)', page))).toBe(true);
    expect(existsSync(join(appDir, '(loc)', '[locale]', page))).toBe(true);
  });

  it.each(['teach', 'parent', 'design-preview'])('/%s lives in (console), with no URL prefix', (section) => {
    expect(existsSync(join(appDir, '(console)', section, 'page.tsx'))).toBe(true);
    expect(existsSync(join(appDir, section))).toBe(false);
  });
});

describe('<html lang> is right in the static HTML', () => {
  it.each(['(en)', '(console)'])('%s renders lang="en"', async (group) => {
    const mod = (await import(`../${group}/layout.tsx`)) as { default: (p: LayoutProps) => JSX.Element };
    expect(renderToStaticMarkup(mod.default({ children: 'x' }))).toMatch(/^<html lang="en"><body style="[^"]+">x<\/body><\/html>$/);
  });

  it('the 404 page is Next\'s own body in an English document', async () => {
    const mod = (await import('../not-found')) as { default: () => JSX.Element };
    const html = renderToStaticMarkup(mod.default());
    expect(html).toMatch(/^<html lang="en"><body style="[^"]+">/);
    expect(html).toContain('This page could not be found.');
  });

  it('every document renders the same body', async () => {
    const en = (await import('../(en)/layout')) as { default: (p: LayoutProps) => JSX.Element };
    const loc = (await import('../(loc)/[locale]/layout')) as { default: (p: LayoutProps) => JSX.Element };
    const con = (await import('../(console)/layout')) as { default: (p: LayoutProps) => JSX.Element };
    const body = (html: string): string => html.replace(/^<html [^>]*>/, '');
    const enHtml = renderToStaticMarkup(en.default({ children: 'x' }));
    expect(body(renderToStaticMarkup(loc.default({ children: 'x', params: { locale: 'es' } })))).toBe(body(enHtml));
    expect(body(renderToStaticMarkup(con.default({ children: 'x' })))).toBe(body(enHtml));
  });

  it.each(['es', 'ko'])('(loc)/[locale] renders lang="%s", marked hidden while it has not shipped', async (locale) => {
    const mod = (await import('../(loc)/[locale]/layout')) as { default: (p: LayoutProps) => JSX.Element };
    expect(renderToStaticMarkup(mod.default({ children: 'x', params: { locale } }))).toMatch(
      new RegExp(`^<html lang="${locale}" ${HIDDEN_LOCALE_ATTR}="${locale}">`),
    );
  });
});

describe('/es and /ko are prerendered but hidden until shipped', () => {
  type LocaleLayoutModule = {
    dynamicParams: boolean;
    generateStaticParams: () => unknown;
    generateMetadata: (p: { params: { locale: string } }) => { robots?: unknown };
  };

  it('renders every site locale and nothing else (Next refuses an empty list under output: export)', async () => {
    const mod = (await import('../(loc)/[locale]/layout')) as LocaleLayoutModule;
    expect(mod.dynamicParams).toBe(false);
    expect(mod.generateStaticParams()).toEqual([{ locale: 'es' }, { locale: 'ko' }]);
  });

  it('a hidden locale is noindex, on top of the site metadata', async () => {
    const mod = (await import('../(loc)/[locale]/layout')) as LocaleLayoutModule;
    expect(mod.generateMetadata({ params: { locale: 'es' } })).toEqual({ robots: { index: false, follow: false } });
  });

  it('a QA build (NEXT_PUBLIC_SHOW_ALL_LOCALES=1) shows them: no marker, no noindex', async () => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '1');
    try {
      const mod = (await import('../(loc)/[locale]/layout')) as LocaleLayoutModule & { default: (p: LayoutProps) => JSX.Element };
      expect(renderToStaticMarkup(mod.default({ children: 'x', params: { locale: 'es' } }))).toMatch(/^<html lang="es"><body /);
      expect(mod.generateMetadata({ params: { locale: 'es' } })).toEqual({});
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('a locale that is not a site locale is a 404, never an English copy', async () => {
    const layout = (await import('../(loc)/[locale]/layout')) as { default: (p: LayoutProps) => JSX.Element };
    const page = (await import('../(loc)/[locale]/page')) as { default: (p: PageProps) => JSX.Element };
    for (const locale of ['en', 'fr']) {
      expect(() => layout.default({ children: 'x', params: { locale } })).toThrow('NEXT_NOT_FOUND');
      expect(() => page.default({ params: { locale } })).toThrow('NEXT_NOT_FOUND');
    }
  });
});

describe('locale pages are the English pages with locale links', () => {
  const pages = [
    ['landing', '../(en)/page', '../(loc)/[locale]/page'],
    ['about', '../(en)/about/page', '../(loc)/[locale]/about/page'],
    ['privacy', '../(en)/privacy/page', '../(loc)/[locale]/privacy/page'],
    ['terms', '../(en)/terms/page', '../(loc)/[locale]/terms/page'],
  ] as const;

  const hrefs = (html: string): string[] => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1] ?? '');

  for (const [name, enPath, locPath] of pages) {
    it(`${name}: /es renders the same words (es falls back to English) with /es links`, async () => {
      const en = (await import(enPath)) as { default: () => JSX.Element };
      const loc = (await import(locPath)) as { default: (p: PageProps) => JSX.Element };
      const enHtml = renderToStaticMarkup(en.default());
      const esHtml = renderToStaticMarkup(loc.default({ params: { locale: 'es' } }));
      const toEs = (href: string): string =>
        href === '/' ? '/es' : ['/about', '/privacy', '/terms'].includes(href) ? `/es${href}` : href;
      expect(hrefs(esHtml)).toEqual(hrefs(enHtml).map(toEs));
      const strip = (html: string): string => html.replace(/href="[^"]*"/g, '');
      expect(strip(esHtml)).toBe(strip(enHtml));
    });
  }
});
