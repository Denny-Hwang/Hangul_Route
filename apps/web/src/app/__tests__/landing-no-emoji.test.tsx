import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pseudoLocalize, getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/**
 * No emoji in rendered output (CLAUDE.md): the public site (landing, About, Privacy, Terms) draws
 * Hoya and the mini-game marks with design-system art, and says "no red X marks" in words.
 *
 * Any Extended_Pictographic code point or the emoji variation selector U+FE0F fails. The plain
 * text symbols the site uses on purpose (©, ®, ™ in the footer and legal text) are allowed;
 * arrows, the middle dot and dashes are not pictographic.
 */
const EMOJI = /(?![©®™])\p{Extended_Pictographic}|️/gu;

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
];

const PAGES = [
  ['landing', '../page'],
  ['about', '../about/page'],
  ['privacy', '../privacy/page'],
  ['terms', '../terms/page'],
] as const;

async function render(path: string): Promise<string> {
  const mod = (await import(path)) as { default: () => JSX.Element };
  const Page = mod.default;
  return renderToStaticMarkup(<Page />);
}

const found = (text: string): string[] => [...text.matchAll(EMOJI)].map((m) => `U+${m[0].codePointAt(0)!.toString(16).toUpperCase()}`);

describe('the check (self-check)', () => {
  it('catches emoji and lets the text symbols through', () => {
    expect(found('\u{1F42F} ❌ ✍️ ✔')).toEqual(['U+1F42F', 'U+274C', 'U+270D', 'U+FE0F', 'U+2714']);
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
  for (const [name, path] of PAGES) {
    it(name, async () => {
      expect(found(await render(path))).toEqual([]);
    });
  }
});

describe('site pages render no emoji (en-XA)', () => {
  it('renders the pseudo dictionary', async () => {
    vi.resetModules();
    vi.doMock('@hangul-route/i18n', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@hangul-route/i18n')>();
      const pseudo = actual.pseudoLocalize(actual.getMessages('en'));
      return { ...actual, getMessages: (locale: Parameters<typeof actual.getMessages>[0]) => (locale === 'en' ? pseudo : actual.getMessages(locale)) };
    });
    for (const [name, path] of PAGES) {
      const html = await render(path);
      expect(html, name).toContain('[');
      expect(found(html), name).toEqual([]);
    }
    vi.doUnmock('@hangul-route/i18n');
    vi.resetModules();
  });

  it('the pseudo dictionary itself is emoji-free on the landing subtree', () => {
    expect(found(JSON.stringify(pseudoLocalize(getMessages('en')).landing))).toEqual([]);
  });
});
