import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pseudoLocalize, getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { minigameCatalog } from '@/data/minigame-catalog';
import { mockFamily } from '@/data/mock-family';

/**
 * No emoji in rendered output (CLAUDE.md): the public site (landing, About, Privacy, Terms, and the
 * /parent demo dashboard the landing links to) draws Hoya and the mini-game marks with
 * design-system art, says "no red X marks" in words, and labels the demo cards with their Korean word.
 *
 * Any Extended_Pictographic code point or the emoji variation selector U+FE0F fails. The plain
 * text symbols the site uses on purpose (©, ®, ™ in the footer and legal text) are allowed;
 * arrows, the middle dot and dashes are not pictographic.
 */
const EMOJI = /(?![©®™])\p{Extended_Pictographic}|\uFE0F/gu;

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..');

/** Pages, landing components, and the data the landing renders. */
const SOURCES = [
  'app/page.tsx',
  'app/layout.tsx',
  'app/about/page.tsx',
  'app/privacy/page.tsx',
  'app/terms/page.tsx',
  ...readdirSync(join(src, 'components/landing'))
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => `components/landing/${f}`),
  'data/landing-copy.ts',
  'data/minigame-catalog.ts',
  'data/stage1-cards.ts',
  'data/contact.ts',
  'app/parent/page.tsx',
  'app/parent/[childId]/page.tsx',
  'data/mock-family.ts',
];

/** Pages that read the i18n dictionary (so the en-XA render proves the pseudo strings went through). */
const SITE_PAGES = [
  ['landing', '../page'],
  ['about', '../about/page'],
  ['privacy', '../privacy/page'],
  ['terms', '../terms/page'],
] as const;

/** The /parent demo dashboard (English-only sample data), one click from the landing nav; statically exported per child. */
const PARENT_PAGES = [
  ['parent', '../parent/page', undefined],
  ...mockFamily().profiles.map((p) => [`parent/${p.id}`, '../parent/[childId]/page', p.id] as const),
] as const;

const PAGES: ReadonlyArray<readonly [string, string, string?]> = [...SITE_PAGES, ...PARENT_PAGES];

async function render(path: string, childId?: string): Promise<string> {
  const mod = (await import(path)) as { default: (props: { params: { childId: string } }) => JSX.Element };
  const Page = mod.default;
  return renderToStaticMarkup(<Page params={{ childId: childId ?? '' }} />);
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
  });

  for (const file of SOURCES) {
    it(file, () => {
      const lines = readFileSync(join(src, file), 'utf8').split('\n');
      const hits = lines.flatMap((line, i) => (found(line).length ? [`${relative(src, join(src, file))}:${i + 1}: ${found(line).join(' ')}`] : []));
      expect(hits).toEqual([]);
    });
  }
});

describe('site pages render no emoji (en)', () => {
  for (const [name, path, childId] of PAGES) {
    it(name, async () => {
      expect(found(await render(path, childId))).toEqual([]);
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
    const html = await render('../page');
    expect(inside(html, 'hr-landing-hero-art')).toContain('data-pose="waving"');
    expect(inside(html, 'hr-landing-split-art')).toContain('data-pose="idle"');
  });

  it('mini-games gallery: one design-system icon per game', async () => {
    const { MiniGamesGallery } = await import('@/components/landing/MiniGamesGallery');
    const html = renderToStaticMarkup(<MiniGamesGallery />);
    expect(html.match(/viewBox="0 0 24 24"/g) ?? []).toHaveLength(minigameCatalog.length);
  });

  it('parent demo cards: each shows its Korean word', async () => {
    for (const profile of mockFamily().profiles) {
      const html = await render('../parent/[childId]/page', profile.id);
      for (const card of profile.recentCards) expect(html, card.title).toContain(card.ko);
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
