import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Tokens only on the site pages (CLAUDE.md; F-SITE-002 §3.1): no raw font weights or line heights, and font sizes in
 * rem through `rem(...)` so they grow with the browser's text size (the 200 % text check in site-budgets e2e).
 */
const webSrc = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const files = [
  'AboutPage.tsx',
  'PrivacyPage.tsx',
  'TermsPage.tsx',
  'HomePage.tsx',
  'LearnersPage.tsx',
  'ParentsPage.tsx',
  'TeachersPage.tsx',
  'SiteHeader.tsx',
  'SiteFooter.tsx',
  'SiteShell.tsx',
  'site-parts.tsx',
].map((file) => join('components', 'landing', file));

describe('site pages use type tokens, sized in rem', () => {
  it.each(files)('%s', (file) => {
    const source = readFileSync(join(webSrc, file), 'utf8');
    expect(source).not.toMatch(/fontWeight:\s*['"]?\d/);
    expect(source).not.toMatch(/lineHeight:\s*['"]?\d/);
    expect(source).not.toMatch(/fontSize:\s*typography\.size\./);
  });
});
