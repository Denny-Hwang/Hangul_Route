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

describe('public surfaces speak to anyone learning Hangul (UF-01..UF-03)', () => {
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
