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
import { mockFamily } from '@/data/mock-family';
import { siteLocaleParams } from '@/lib/site-locales';
// The pages are imported here, once, not inside each test: a page load pulls in the whole landing graph (i18n
// dictionaries, content schema, design-system art), and inside a test body it counted against the 5 s test
// timeout, which a busy CI runner exceeded. Imported at the top, they load while the file is collected.
import * as childPage from '../(console)/parent/[childId]/page';
import * as parentPage from '../(console)/parent/page';
import * as enAboutPage from '../(en)/about/page';
import * as enLandingPage from '../(en)/page';
import * as enPrivacyPage from '../(en)/privacy/page';
import * as enTermsPage from '../(en)/terms/page';
import * as locAboutPage from '../(loc)/[locale]/about/page';
import * as locLandingPage from '../(loc)/[locale]/page';
import * as locPrivacyPage from '../(loc)/[locale]/privacy/page';
import * as locTermsPage from '../(loc)/[locale]/terms/page';

/**
 * No emoji in rendered output (CLAUDE.md): the public site (landing, About, Privacy, Terms, in English
 * and under every site locale such as /es and /ko, and the /parent demo dashboard the landing links to)
 * draws Hoya and the mini-game marks with design-system art, says "no red X marks" in words, and labels
 * the demo cards with their Korean word.
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
  'app/(console)/parent/[childId]/page.tsx',
  'data/mock-family.ts',
];

type Params = Readonly<Record<string, string>>;
type PageModule = { default: (props: { params: Params }) => JSX.Element };

/**
 * Pages that read the i18n dictionary (so the en-XA render proves the pseudo strings went through). Each carries
 * its module and its path: the en-XA check below loads the path again, fresh, under the pseudo dictionary.
 */
const SITE_PAGES = [
  ['landing', enLandingPage, '../(en)/page'],
  ['about', enAboutPage, '../(en)/about/page'],
  ['privacy', enPrivacyPage, '../(en)/privacy/page'],
  ['terms', enTermsPage, '../(en)/terms/page'],
] as const;

/** The same pages under `/es` and `/ko` (prerendered by the web build even while hidden). */
const LOCALE_PAGES = siteLocaleParams().flatMap(({ locale }) =>
  (
    [
      ['', locLandingPage],
      ['/about', locAboutPage],
      ['/privacy', locPrivacyPage],
      ['/terms', locTermsPage],
    ] as const
  ).map(([suffix, page]) => [`${locale}${suffix}`, page, { locale }] as const),
);

/** The /parent demo dashboard (English-only sample data), one click from the landing nav; statically exported per child. */
const PARENT_PAGES = [
  ['parent', parentPage, { childId: '' }],
  ...mockFamily().profiles.map((p) => [`parent/${p.slug}`, childPage, { childId: p.slug }] as const),
] as const;

const PAGES: ReadonlyArray<readonly [string, object, Params?]> = [
  ...SITE_PAGES.map(([name, page]) => [name, page] as const),
  ...LOCALE_PAGES,
  ...PARENT_PAGES,
];

function render(page: object, params: Params = {}): string {
  const Page = (page as PageModule).default;
  return renderToStaticMarkup(<Page params={params} />);
}

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

describe('site pages render no emoji (en, every site locale, /parent)', () => {
  it('covers /es and /ko', () => {
    expect(LOCALE_PAGES.map(([name]) => name)).toEqual(expect.arrayContaining(['es', 'ko', 'es/about', 'ko/terms']));
  });

  for (const [name, page, params] of PAGES) {
    it(name, () => {
      expect(found(render(page, params))).toEqual([]);
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
    const html = render(enLandingPage);
    expect(inside(html, 'hr-landing-hero-art')).toContain('data-pose="waving"');
    expect(inside(html, 'hr-landing-split-art')).toContain('data-pose="idle"');
  });

  it('mini-games gallery: one design-system icon per game', () => {
    const html = renderToStaticMarkup(<MiniGamesGallery />);
    expect(html.match(/viewBox="0 0 24 24"/g) ?? []).toHaveLength(minigameCatalog.length);
  });

  it('parent demo cards: each shows its Korean word with its romanization', () => {
    for (const profile of mockFamily().profiles) {
      const html = render(childPage, { childId: profile.slug });
      for (const card of profile.recentCards) {
        expect(html, card.title).toContain(card.ko);
        expect(html, card.title).toContain(card.romanization);
      }
    }
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
      const html = render(await import(path));
      expect(html, name).toContain('[');
      expect(found(html), name).toEqual([]);
    }
  });

  it('the pseudo dictionary itself is emoji-free on the landing subtree', () => {
    expect(found(JSON.stringify(pseudoLocalize(getMessages('en')).landing))).toEqual([]);
  });
});
