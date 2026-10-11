import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ChildDetailPage from '../(console)/parent/[childId]/page';
import ParentPage from '../(console)/parent/page';

/**
 * F-LEARN-001 §3.7: a level label (never an age) wherever the demo family prints one.
 * Static markup so the test reads what a visitor reads.
 */
const textOf = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ');

describe('parent demo pages', () => {
  it('the family dashboard shows level labels, not ages', () => {
    const text = textOf(renderToStaticMarkup(<ParentPage />));
    expect(text).toContain('Pictures first');
    expect(text).toContain('Some reading');
    expect(text).not.toMatch(/\bAge\b/);
  });

  it('a learner page leads with the level label, not an age', () => {
    const text = textOf(renderToStaticMarkup(<ChildDetailPage params={{ childId: 'mina' }} />));
    expect(text).toContain('Pictures first · 9 quests · 14 cards');
    expect(text).not.toMatch(/\bAge\b/);
  });
});

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('no "Age X" label in web sources (F-LEARN-001 §3.7)', () => {
  const root = join(__dirname, '..', '..');
  for (const file of sources(root)) {
    it(file.slice(root.length + 1), () => {
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(/Age \{/);
      expect(src).not.toMatch(/Age \$\{/);
      expect(src).not.toMatch(/'Age \d/);
    });
  }
});
