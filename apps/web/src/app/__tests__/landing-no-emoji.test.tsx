import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as contentSchema from '@hangul-route/content-schema';
import * as iconGlyphs from '@hangul-route/design-system/icon-glyphs';
import * as iconGlyphsDom from '@hangul-route/design-system/icon-glyphs/dom';
import * as sceneArt from '@hangul-route/design-system/scene-art';
import * as sceneArtDom from '@hangul-route/design-system/scene-art/dom';
import * as tokens from '@hangul-route/design-system/tokens';
import * as wordArt from '@hangul-route/design-system/word-art';
import * as wordArtColorScience from '@hangul-route/design-system/word-art/color-science';
import * as wordArtBudget from '@hangul-route/design-system/word-art-budget';
import * as i18n from '@hangul-route/i18n';
import { pseudoLocalize, getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MiniGamesGallery } from '@/components/landing/MiniGamesGallery';
import { minigameCatalog } from '@/data/minigame-catalog';
import { siteLocaleParams } from '@/lib/site-locales';
// The pages are imported here, once, not inside each test: a page load pulls in the whole landing graph (i18n
// dictionaries, content schema, design-system art), and inside a test body it counted against the 5 s test
// timeout, which a busy CI runner exceeded. Imported at the top, they load while the file is collected.
import * as enAboutPage from '../(en)/about/page';
import * as enLandingPage from '../(en)/page';
import * as enPrivacyPage from '../(en)/privacy/page';
import * as enTermsPage from '../(en)/terms/page';
import * as enLearnersPage from '../(en)/learners/page';
import * as locAboutPage from '../(loc)/[locale]/about/page';
import * as locLandingPage from '../(loc)/[locale]/page';
import * as locPrivacyPage from '../(loc)/[locale]/privacy/page';
import * as locTermsPage from '../(loc)/[locale]/terms/page';
import * as locLearnersPage from '../(loc)/[locale]/learners/page';

/**
 * No emoji in rendered output (CLAUDE.md): the public site (landing, About, Privacy, Terms, in English
 * and under every site locale such as /es and /ko) draws Hoya and the mini-game marks with design-system
 * art and says "no red X marks" in words. The family home source (`app/(console)/parent/page.tsx`, F-APP-001
 * A-5b) is scanned too; the `/parent` demo left with A-5b (OD-4).
 *
 * Any Extended_Pictographic code point or the emoji variation selector U+FE0F fails. The plain
 * text symbols the site uses on purpose (©, ®, ™ in the footer and legal text) are allowed;
 * arrows, the middle dot and dashes are not pictographic.
 */
const EMOJI = /(?![©®™])\p{Extended_Pictographic}|\uFE0F/gu;

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..');

/** Every `.ts`/`.tsx` file under `dir` (relative to `src`), recursively, skipping test folders. */
const filesUnder = (dir: string): string[] =>
  readdirSync(join(src, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return e.name === '__tests__' ? [] : filesUnder(rel);
    return /\.tsx?$/.test(e.name) ? [rel] : [];
  });

/**
 * Pages, landing components, and the data the landing renders. The site pages are route-group shells
 * (`app/(en)`, `app/(loc)/[locale]`, F-I18N-001 PR 11b) around `components/landing/*Page.tsx`; both are scanned.
 */
const SOURCES = [
  'app/layout.tsx',
  'app/not-found.tsx',
  'components/SiteDocument.tsx',
  ...filesUnder('app/(en)'),
  ...filesUnder('app/(loc)'),
  ...filesUnder('components/landing'),
  'data/landing-copy.ts',
  'data/minigame-catalog.ts',
  'data/stage1-cards.ts',
  'data/contact.ts',
  'app/(console)/layout.tsx',
  'app/(console)/parent/page.tsx',
];

/** A page module, typed by the params its route gives it. */
type PageModule<P> = { default: (props: { params: P }) => JSX.Element };
/** The English site pages take no params. */
type SitePage = PageModule<Record<string, never>>;

function render<P>(page: PageModule<P>, params: P): string {
  const Page = page.default;
  return renderToStaticMarkup(<Page params={params} />);
}

/** A page bound to its params, so a list can hold pages whose params differ and the type checker still pairs them. */
const at =
  <P,>(page: PageModule<P>, params: P) =>
  (): string =>
    render(page, params);

/**
 * Pages that read the i18n dictionary (so the en-XA render proves the pseudo strings went through). Each carries
 * its module and its path: the en-XA check below loads the path again, fresh, under the pseudo dictionary.
 */
const SITE_PAGES: ReadonlyArray<readonly [string, SitePage, string]> = [
  ['landing', enLandingPage, '../(en)/page'],
  ['about', enAboutPage, '../(en)/about/page'],
  ['privacy', enPrivacyPage, '../(en)/privacy/page'],
  ['terms', enTermsPage, '../(en)/terms/page'],
  ['learners', enLearnersPage, '../(en)/learners/page'],
];

/** The same pages under `/es` and `/ko` (prerendered by the web build even while hidden). */
const LOCALE_PAGES: ReadonlyArray<readonly [string, () => string]> = siteLocaleParams().flatMap(({ locale }) => [
  [locale, at(locLandingPage, { locale })] as const,
  [`${locale}/about`, at(locAboutPage, { locale })] as const,
  [`${locale}/privacy`, at(locPrivacyPage, { locale })] as const,
  [`${locale}/terms`, at(locTermsPage, { locale })] as const,
  [`${locale}/learners`, at(locLearnersPage, { locale })] as const,
]);

const PAGES: ReadonlyArray<readonly [string, () => string]> = [
  ...SITE_PAGES.map(([name, page]) => [name, at(page, {})] as const),
  ...LOCALE_PAGES,
];

const found = (text: string): string[] => [...text.matchAll(EMOJI)].map((m) => `U+${m[0].codePointAt(0)!.toString(16).toUpperCase()}`);

describe('the check (self-check)', () => {
  it('catches emoji and lets the text symbols through', () => {
    expect(found('\u{1F42F} \u274C \u270D\uFE0F \u2714')).toEqual(['U+1F42F', 'U+274C', 'U+270D', 'U+FE0F', 'U+2714']);
    expect(found('© 2026 Hangul Route ™ ← Back home → · — ★ ㄱ')).toEqual([]);
  });
});

describe('landing sources carry no emoji code point', () => {
  it('lists real files', () => {
    for (const file of SOURCES) expect(statSync(join(src, file)).isFile(), file).toBe(true);
    expect(SOURCES.filter((f) => f.startsWith('components/landing/')).length).toBeGreaterThanOrEqual(4);
    expect(SOURCES).toEqual(expect.arrayContaining(['components/landing/LandingPage.tsx', 'components/landing/AboutPage.tsx', 'app/(en)/page.tsx', 'app/(loc)/[locale]/page.tsx']));
  });

  for (const file of SOURCES) {
    it(file, () => {
      const lines = readFileSync(join(src, file), 'utf8').split('\n');
      const hits = lines.flatMap((line, i) => (found(line).length ? [`${relative(src, join(src, file))}:${i + 1}: ${found(line).join(' ')}`] : []));
      expect(hits).toEqual([]);
    });
  }
});

describe('site pages render no emoji (en, every site locale)', () => {
  it('covers /es and /ko', () => {
    expect(LOCALE_PAGES.map(([name]) => name)).toEqual(expect.arrayContaining(['es', 'ko', 'es/about', 'ko/terms']));
  });

  for (const [name, markup] of PAGES) {
    it(name, () => {
      expect(found(markup())).toEqual([]);
    });
  }
});

describe('the art that replaced the emoji is drawn', () => {
  /** The markup inside the first element carrying `className`, up to its closing tag (art boxes hold no nested same-name class). */
  const inside = (html: string, className: string): string => {
    const start = html.indexOf(`class="${className}"`);
    expect(start, className).toBeGreaterThan(-1);
    return html.slice(start, html.indexOf('</svg>', start) + 6);
  };

  it('hero: Hoya waving; Meet Hoya: Hoya idle', () => {
    const html = render(enLandingPage, {});
    expect(inside(html, 'hr-landing-hero-art')).toContain('data-pose="waving"');
    expect(inside(html, 'hr-landing-split-art')).toContain('data-pose="idle"');
  });

  it('mini-games gallery: one design-system icon per game', () => {
    const html = renderToStaticMarkup(<MiniGamesGallery />);
    expect(html.match(/viewBox="0 0 24 24"/g) ?? []).toHaveLength(minigameCatalog.length);
  });
});

/**
 * Workspace modules the en-XA check hands back as the copies this file already loaded, instead of evaluating them
 * again from source after the reset: the content schema and the design-system art the site draws. None of them
 * reads the i18n dictionary (design-system does not import it), so they carry no text the pseudo check could miss.
 */
const PINNED: ReadonlyArray<readonly [string, object]> = [
  ['@hangul-route/content-schema', contentSchema],
  ['@hangul-route/design-system/icon-glyphs', iconGlyphs],
  ['@hangul-route/design-system/icon-glyphs/dom', iconGlyphsDom],
  ['@hangul-route/design-system/scene-art', sceneArt],
  ['@hangul-route/design-system/scene-art/dom', sceneArtDom],
  ['@hangul-route/design-system/tokens', tokens],
  ['@hangul-route/design-system/word-art', wordArt],
  ['@hangul-route/design-system/word-art/color-science', wordArtColorScience],
  ['@hangul-route/design-system/word-art-budget', wordArtBudget],
];

const repo = join(src, '..', '..', '..');

/** The workspace package a pinned module id belongs to: `@hangul-route/design-system/tokens` -> `design-system`. */
const packageOf = (id: string): string => id.split('/')[1]!;

/** Every non-test `.ts`/`.tsx` file under `dir`, as absolute paths. */
const sourcesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourcesIn(path);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path] : [];
  });

/** A static or dynamic import (or require) of `@hangul-route/i18n` or one of its subpaths; a mention in a comment is not one. */
const IMPORTS_I18N = /(?:from\s*|import\s*\(\s*|require\s*\(\s*|^\s*import\s*)['"]@hangul-route\/i18n(?:\/[^'"]*)?['"]/m;

/**
 * What makes pinning safe, checked rather than assumed: a pinned module keeps the dictionary it loaded with, so if
 * one ever read `@hangul-route/i18n`, its strings would skip the pseudo check below without any test failing.
 */
describe('the modules the en-XA check pins read no dictionary', () => {
  const packages = [...new Set(PINNED.map(([id]) => packageOf(id)))];

  it('pins only the content schema and the design system', () => {
    expect(packages.sort()).toEqual(['content-schema', 'design-system']);
  });

  for (const pkg of packages) {
    it(`${pkg} does not depend on @hangul-route/i18n`, () => {
      const manifest = JSON.parse(readFileSync(join(repo, 'packages', pkg, 'package.json'), 'utf8')) as Record<string, unknown>;
      for (const field of ['dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies']) {
        expect(Object.keys((manifest[field] as Record<string, string> | undefined) ?? {}), `${pkg} ${field}`).not.toContain('@hangul-route/i18n');
      }
    });

    it(`${pkg} source imports nothing from @hangul-route/i18n`, () => {
      const files = sourcesIn(join(repo, 'packages', pkg, 'src'));
      expect(files.length).toBeGreaterThan(0);
      expect(files.filter((file) => IMPORTS_I18N.test(readFileSync(file, 'utf8'))).map((file) => relative(repo, file))).toEqual([]);
    });
  }

  it('the import check catches each import form', () => {
    for (const line of [
      "import { getMessages } from '@hangul-route/i18n';",
      'import type { UiLocale } from "@hangul-route/i18n/locales";',
      "const m = await import('@hangul-route/i18n');",
      "import '@hangul-route/i18n';",
    ]) expect(IMPORTS_I18N.test(line), line).toBe(true);
    expect(IMPORTS_I18N.test(' * (`@hangul-route/i18n/note-text`) judges its length')).toBe(false);
  });
});

/**
 * Each site page carries its module and its path: the renders above use the module and the en-XA check below the
 * path. They must name the same page, or the en-XA check would cover a page other than the one named.
 */
describe('each site page path loads the module it is paired with', () => {
  for (const [name, page, path] of SITE_PAGES) {
    it(name, async () => {
      expect(((await import(path)) as SitePage).default).toBe(page.default);
    });
  }
});

/**
 * The one check that loads the pages fresh: the module registry is reset and the pages are imported again under
 * the pseudo dictionary, so even a string a module reads when it loads goes through en-XA. It keeps that work
 * small: the dictionary module is the one already loaded here (spread under the pseudo `getMessages`, as
 * `importOriginal` would give), and the `PINNED` modules are too; the pages, their components and the site data
 * still load fresh. Re-evaluating four page graphs is still real work, and on a busy CI runner it can pass the
 * 5 s default, so this suite allows 15 s.
 */
describe('site pages render no emoji (en-XA)', { timeout: 15_000 }, () => {
  afterEach(() => {
    vi.doUnmock('@hangul-route/i18n');
    for (const [id] of PINNED) vi.doUnmock(id);
    vi.resetModules();
  });

  it('renders the pseudo dictionary', async () => {
    vi.resetModules();
    for (const [id, mod] of PINNED) vi.doMock(id, () => mod);
    vi.doMock('@hangul-route/i18n', () => {
      const pseudo = i18n.pseudoLocalize(i18n.getMessages('en'));
      return { ...i18n, getMessages: (locale: Parameters<typeof i18n.getMessages>[0]) => (locale === 'en' ? pseudo : i18n.getMessages(locale)) };
    });
    for (const [name, , path] of SITE_PAGES) {
      const html = render((await import(path)) as SitePage, {});
      expect(html, name).toContain('[');
      expect(found(html), name).toEqual([]);
    }
  });

  it('the pseudo dictionary itself is emoji-free on the landing subtree', () => {
    expect(found(JSON.stringify(pseudoLocalize(getMessages('en')).landing))).toEqual([]);
  });
});
