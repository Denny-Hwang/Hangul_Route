import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { siteMetadata } from '../../data/landing-copy';
import { HIDDEN_LOCALE_ATTR, siteLocaleParams } from '../../lib/site-locales';

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
const srcDir = join(appDir, '..');
const SITE_LOCALES = siteLocaleParams().map(({ locale }) => locale);

// A shell that exports either QA flag (common while QA-ing the learner app) must not change these tests.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '');
});
afterEach(() => vi.unstubAllEnvs());

/** Every file under `dir`, as paths relative to `dir` with `/` separators. */
function walk(dir: string, base: string = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path, base) : [relative(base, path).split(sep).join('/')];
  });
}

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

  it('every page and layout lives in a group: the top layout renders no document, so one outside would ship without <html>', () => {
    const TOP_LEVEL = new Set(['layout.tsx', 'not-found.tsx', 'globals.css']);
    const IN_A_GROUP = /^(\(en\)|\(loc\)\/\[locale\]|\(console\))\//;
    const misplaced = walk(appDir).filter(
      (file) => !TOP_LEVEL.has(file) && !file.startsWith('__tests__/') && !IN_A_GROUP.test(file),
    );
    expect(misplaced).toEqual([]);
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

  it('not-found.tsx imports a private Next module that only Next 14 has at that path', () => {
    // Next 15 moved it to `next/dist/client/components/http-access-fallback/error-fallback`; on an upgrade,
    // point not-found.tsx there (or copy the markup) and bump this pin.
    const require = createRequire(import.meta.url);
    const { version } = require('next/package.json') as { version: string };
    expect(version.split('.')[0]).toBe('14');
    expect(readFileSync(join(appDir, 'not-found.tsx'), 'utf8')).toContain("from 'next/dist/client/components/not-found-error'");
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

  it.each(SITE_LOCALES)('(loc)/[locale] renders lang="%s", marked hidden while it has not shipped', async (locale) => {
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

  it.each(SITE_LOCALES)('a QA build (NEXT_PUBLIC_SHOW_ALL_LOCALES=1) shows %s: no marker, no noindex', async (locale) => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '1');
    const mod = (await import('../(loc)/[locale]/layout')) as LocaleLayoutModule & { default: (p: LayoutProps) => JSX.Element };
    expect(renderToStaticMarkup(mod.default({ children: 'x', params: { locale } }))).toMatch(new RegExp(`^<html lang="${locale}"><body `));
    expect(mod.generateMetadata({ params: { locale } })).toEqual({});
  });

  it.each(SITE_LOCALES)('the learner app flag (EXPO_PUBLIC_SHOW_ALL_LOCALES=1) alone keeps %s hidden', async (locale) => {
    vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
    const mod = (await import('../(loc)/[locale]/layout')) as LocaleLayoutModule & { default: (p: LayoutProps) => JSX.Element };
    expect(renderToStaticMarkup(mod.default({ children: 'x', params: { locale } }))).toContain(`${HIDDEN_LOCALE_ATTR}="${locale}"`);
    expect(mod.generateMetadata({ params: { locale } })).toEqual({ robots: { index: false, follow: false } });
  });

  it('a locale that is not a site locale is a 404 in the layout, never an English copy', async () => {
    const layout = (await import('../(loc)/[locale]/layout')) as { default: (p: LayoutProps) => JSX.Element };
    for (const locale of ['en', 'fr']) {
      expect(() => layout.default({ children: 'x', params: { locale } })).toThrow('NEXT_NOT_FOUND');
    }
  });

  const LOCALE_PAGES = {
    page: () => import('../(loc)/[locale]/page'),
    'about/page': () => import('../(loc)/[locale]/about/page'),
    'privacy/page': () => import('../(loc)/[locale]/privacy/page'),
    'terms/page': () => import('../(loc)/[locale]/terms/page'),
  } as const;

  it.each(Object.keys(LOCALE_PAGES) as Array<keyof typeof LOCALE_PAGES>)('(loc)/[locale]/%s is a 404 for a locale that is not a site locale', async (page) => {
    const mod = (await LOCALE_PAGES[page]()) as { default: (p: PageProps) => JSX.Element };
    for (const locale of ['en', 'fr']) {
      expect(() => mod.default({ params: { locale } })).toThrow('NEXT_NOT_FOUND');
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

  // The same-words half is temporary: the es and ko overlays are empty until PRs 15 and 16, so each locale
  // falls back to English. When an overlay gets content, replace it with a check of that locale's words.
  for (const [name, enPath, locPath] of pages) {
    it.each(SITE_LOCALES)(`${name}: /%s renders the same words (it falls back to English) with locale links`, async (locale) => {
      const en = (await import(enPath)) as { default: () => JSX.Element };
      const loc = (await import(locPath)) as { default: (p: PageProps) => JSX.Element };
      const enHtml = renderToStaticMarkup(en.default());
      const locHtml = renderToStaticMarkup(loc.default({ params: { locale } }));
      // "Play now" carries the locale to the learner app (`?lang=`, PR 11c).
      const toLocale = (href: string): string =>
        href === '/'
          ? `/${locale}`
          : ['/about', '/privacy', '/terms'].includes(href)
            ? `/${locale}${href}`
            : href === 'https://app.hangulroute.com'
              ? `${href}?lang=${locale}`
              : href;
      expect(hrefs(locHtml)).toEqual(hrefs(enHtml).map(toLocale));
      const strip = (html: string): string => html.replace(/href="[^"]*"/g, '');
      expect(strip(locHtml)).toBe(strip(enHtml));
    });
  }
});

describe('links between groups load a new document', () => {
  // Every group renders its own <html>/<body>, under one shared top layout. Next treats a <Link> from one group
  // to another as a soft navigation and React replaces the <html>/<body> in place, which deletes the nodes
  // React did not render (Next's route announcer, Clerk's portals). A plain <a> loads the page instead,
  // as Next does for real multiple root layouts. Links inside a group stay <Link>.
  const CONSOLE = /^\/(teach|parent|design-preview)(\/|$|\?|#)/;
  const groupOfHref = (href: string): 'site' | 'console' => (CONSOLE.test(href) ? 'console' : 'site');
  const groupOfFile = (file: string): 'site' | 'console' | null => {
    if (/^(app\/\((en|loc)\)|components\/landing)\//.test(file)) return 'site';
    if (/^(app\/\(console\)|components\/console)\//.test(file)) return 'console';
    return null;
  };
  /** The target of each `<Link href=…>` in `source`: a literal path, a `sitePath(…)` (site) or `ROUTES.…` (console). */
  const linkTargets = (source: string): Array<'site' | 'console'> =>
    [...source.matchAll(/<Link\s+href=(?:"([^"]*)"|\{\s*['`"]([^'`"$]*)|\{\s*(sitePath|ROUTES)\b)/g)].flatMap((m) => {
      if (m[3] === 'sitePath') return ['site' as const];
      if (m[3] === 'ROUTES') return ['console' as const];
      const href = m[1] ?? m[2] ?? '';
      return href.startsWith('/') ? [groupOfHref(href)] : [];
    });

  const files = walk(srcDir).filter((file) => file.endsWith('.tsx') && !file.includes('__tests__/'));

  it('finds the link sources it checks', () => {
    expect(files.filter((file) => groupOfFile(file) === 'site').length).toBeGreaterThan(0);
    expect(files.filter((file) => groupOfFile(file) === 'console').length).toBeGreaterThan(0);
    expect(linkTargets(`<Link href="/teach">x</Link> <Link href={sitePath(locale, '/')}>`)).toEqual(['console', 'site']);
    expect(linkTargets('<Link href={ROUTES.home}> <Link href={`/parent/${id}`}> <Link href="#cards">')).toEqual(['console', 'console']);
  });

  it('no <Link> crosses from the site to the console or back', () => {
    const crossing = files.flatMap((file) => {
      const group = groupOfFile(file);
      if (group === null) return [];
      return linkTargets(readFileSync(join(srcDir, file), 'utf8'))
        .filter((target) => target !== group)
        .map((target) => `${file} -> ${target}`);
    });
    expect(crossing).toEqual([]);
  });
});
