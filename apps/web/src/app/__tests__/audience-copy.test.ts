import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Audience copy guard — owner decision 2026-10-09 (audit UF-01..UF-04):
 * Hangul Route is for anyone learning Hangul, at any age. Public surfaces
 * must not frame the product as kids-only or as "ages 5–11".
 *
 * Caregiver-only screens (/parent, /teach) are out of scope: they address
 * parents and teachers, not the learner.
 */
const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, '..', '..');

const landingComponents = readdirSync(join(webSrc, 'components', 'landing'))
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => join('components', 'landing', name));

const PUBLIC_SURFACES = [
  join('app', 'layout.tsx'),
  join('app', 'page.tsx'),
  join('app', 'about', 'page.tsx'),
  join('app', 'privacy', 'page.tsx'),
  join('app', 'terms', 'page.tsx'),
  join('data', 'landing-copy.ts'),
  ...landingComponents,
];

const KIDS_ONLY_FRAMING: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'age range 5–11', re: /\b5\s*[–-]\s*11\b/ },
  { name: '"for kids"', re: /\bfor kids\b/i },
  { name: '"kids who …"', re: /\bkids who\b/i },
  { name: '"Korean for kids"', re: /\bKorean for kids\b/i },
  { name: '5–7 year-old reading level', re: /\b5\s*[–-]\s*7\s*(year[\s-]*old|yo)\b/i },
  { name: '"your kid"', re: /\byour kid\b/i },
];

function read(rel: string): string {
  return readFileSync(join(webSrc, rel), 'utf8');
}

describe('public surfaces speak to anyone learning Hangul (UF-01..UF-03, UF-09)', () => {
  it('scans every landing component', () => {
    expect(landingComponents.length).toBeGreaterThanOrEqual(3);
  });

  for (const rel of PUBLIC_SURFACES) {
    it(`${rel} has no kids-only framing`, () => {
      const source = read(rel);
      const hits = KIDS_ONLY_FRAMING.filter(({ re }) => re.test(source)).map(({ name }) => name);
      expect(hits).toEqual([]);
    });
  }
});

describe('learner PWA manifest (UF-04)', () => {
  // The manifest ships from apps/mobile/public but is public store-facing metadata.
  const manifestPath = join(webSrc, '..', '..', 'mobile', 'public', 'manifest.webmanifest');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    categories?: unknown;
    description?: unknown;
  };

  it('is listed as education only — no "kids" category', () => {
    expect(manifest.categories).toEqual(['education']);
  });

  it('description has no kids-only framing', () => {
    const description = String(manifest.description ?? '');
    const hits = KIDS_ONLY_FRAMING.filter(({ re }) => re.test(description)).map(({ name }) => name);
    expect(hits).toEqual([]);
  });
});

describe('App Store listing (UF-11, App Review 2.3.8 / 5.1.4)', () => {
  // Public store metadata: outside the Kids Category it must not suggest that
  // children are the main audience. The App Review notes (section 6) may say
  // "many learners are children" — they are not public.
  const metadataPath = join(webSrc, '..', '..', '..', 'docs', 'launch', 'app-store-metadata.md');
  const metadata = readFileSync(metadataPath, 'utf8');

  function listed(headingPrefix: string): string {
    const section = metadata.split(/^## /m).find((part) => part.startsWith(headingPrefix));
    const block = /```[^\n]*\n([\s\S]*?)```/.exec(section ?? '');
    if (!block?.[1]) throw new Error(`no code block under "## ${headingPrefix}" in app-store-metadata.md`);
    return block[1];
  }

  const PUBLIC_FIELDS: ReadonlyArray<[string, string]> = [
    ['promotional text', '2.'],
    ['description', '3.'],
    ['keywords', '4.'],
  ];

  for (const [label, prefix] of PUBLIC_FIELDS) {
    it(`the ${label} never says "child", "children" or "kids"`, () => {
      expect(listed(prefix)).not.toMatch(/\bchild(ren)?\b|\bkids?\b/i);
    });

    it(`the ${label} has no kids-only framing or age range`, () => {
      const text = listed(prefix);
      expect(KIDS_ONLY_FRAMING.filter(({ re }) => re.test(text)).map(({ name }) => name)).toEqual([]);
    });
  }

  it('the description fits the 4000-character App Store limit', () => {
    expect(listed('3.').trim().length).toBeLessThanOrEqual(4000);
  });
});
