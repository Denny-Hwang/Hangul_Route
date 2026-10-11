import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pseudoLocalize, getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { minigameCatalog } from '@/data/minigame-catalog';
import { mockFamily } from '@/data/mock-family';
import { siteLocaleParams } from '@/lib/site-locales';

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

/** Pages that read the i18n dictionary (so the en-XA render proves the pseudo strings went through). */
const SITE_PAGES = [
  ['landing', '../(en)/page'],
  ['about', '../(en)/about/page'],
  ['privacy', '../(en)/privacy/page'],
  ['terms', '../(en)/terms/page'],
] as const;

/** The same pages under `/es` and `/ko` (prerendered by the web build even while hidden). */
const LOCALE_PAGES = siteLocaleParams().flatMap(({ locale }) =>
  (
    [
      ['', '../(loc)/[locale]/page'],
      ['/about', '../(loc)/[locale]/about/page'],
      ['/privacy', '../(loc)/[locale]/privacy/page'],
      ['/terms', '../(loc)/[locale]/terms/page'],
    ] as const
  ).map(([suffix, path]) => [`${locale}${suffix}`, path, { locale }] as const),
);

/** The /parent demo dashboard (English-only sample data), one click from the landing nav; statically exported per child. */
const PARENT_PAGES = [
  ['parent', '../(console)/parent/page', { childId: '' }],
  ...mockFamily().profiles.map((p) => [`parent/${p.slug}`, '../(console)/parent/[childId]/page', { childId: p.slug }] as const),
] as const;

type Params = Readonly<Record<string, string>>;

const PAGES: ReadonlyArray<readonly [string, string, Params?]> = [...SITE_PAGES, ...LOCALE_PAGES, ...PARENT_PAGES];

async function render(path: string, params: Params = {}): Promise<string> {
  const mod = (await import(path)) as { default: (props: { params: Params }) => JSX.Element };
  const Page = mod.default;
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

  for (const [name, path, params] of PAGES) {
    it(name, async () => {
      expect(found(await render(path, params))).toEqual([]);
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

  it('hero: Hoya waving; Meet Hoya: Hoya idle', async () => {
    const html = await render('../(en)/page');
    expect(inside(html, 'hr-landing-hero-art')).toContain('data-pose="waving"');
    expect(inside(html, 'hr-landing-split-art')).toContain('data-pose="idle"');
  });

  it('mini-games gallery: one design-system icon per game', async () => {
    const { MiniGamesGallery } = await import('@/components/landing/MiniGamesGallery');
    const html = renderToStaticMarkup(<MiniGamesGallery />);
    expect(html.match(/viewBox="0 0 24 24"/g) ?? []).toHaveLength(minigameCatalog.length);
  });

  it('parent demo cards: each shows its Korean word with its romanization', async () => {
    for (const profile of mockFamily().profiles) {
      const html = await render('../(console)/parent/[childId]/page', { childId: profile.slug });
      for (const card of profile.recentCards) {
        expect(html, card.title).toContain(card.ko);
        expect(html, card.title).toContain(card.romanization);
      }
    }
  });
});

describe('site pages render no emoji (en-XA)', () => {
  afterEach(() => {
    vi.doUnmock('@hangul-route/i18n');
    vi.resetModules();
  });

  it('renders the pseudo dictionary', async () => {
    vi.resetModules();
    vi.doMock('@hangul-route/i18n', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@hangul-route/i18n')>();
      const pseudo = actual.pseudoLocalize(actual.getMessages('en'));
      return { ...actual, getMessages: (locale: Parameters<typeof actual.getMessages>[0]) => (locale === 'en' ? pseudo : actual.getMessages(locale)) };
    });
    for (const [name, path] of SITE_PAGES) {
      const html = await render(path);
      expect(html, name).toContain('[');
      expect(found(html), name).toEqual([]);
    }
  });

  it('the pseudo dictionary itself is emoji-free on the landing subtree', () => {
    expect(found(JSON.stringify(pseudoLocalize(getMessages('en')).landing))).toEqual([]);
  });
});
