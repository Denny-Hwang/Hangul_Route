import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Copy guard — F-LEARN-001 §3.7 / §5. Hangul Route has no age bands in its
 * wording: the learner's level is drawn from `levelLabel()` and nowhere else.
 * This test reads the non-test sources of both apps and fails on the phrases
 * that bring an age back ("Age 8-9" pills, "How old are you", "Age group").
 */
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const ROOTS = ['apps/mobile/src', 'apps/web/src'];

/**
 * Web files that still print the age and belong to F-LEARN-001 PR 7 (console
 * roster, parent demo pages). Each entry must still contain a match: when PR 7
 * fixes the file the stale entry fails here, so it is removed with the fix.
 */
const PENDING_PR7 = new Set([
  'apps/web/src/app/parent/page.tsx',
  'apps/web/src/app/parent/[childId]/page.tsx',
  'apps/web/src/app/teach/space/page.tsx',
]);

const BANNED: Array<[string, RegExp]> = [
  ['Age ${…} template', /Age \$\{/],
  ['"Age " + ageGroup', /['"`]Age ['"`]\s*\+/],
  ['Age {…} JSX label', /Age \{/],
  ['How old are you', /How old are you/i],
  ['Age group', /Age group/],
];

const SKIP_DIRS = new Set(['node_modules', '__tests__', 'dist', '.next']);

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) out.push(...sources(full));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function matches(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return BANNED.filter(([, re]) => re.test(text)).map(([label]) => label);
}

const posix = (full: string): string => relative(REPO, full).split(sep).join('/');

describe('copy guard: no age wording in rendered source (F-LEARN-001 §3.7)', () => {
  const files = ROOTS.flatMap((root) => sources(join(REPO, root)));

  it('finds the sources it is meant to scan', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => posix(f) === 'apps/mobile/src/screens/profile/ProfileScreen.tsx')).toBe(true);
  });

  it('no mobile or web source builds an "Age X" label or asks how old the learner is', () => {
    const offenders = files
      .map((f) => ({ file: posix(f), hits: matches(f) }))
      .filter((o) => o.hits.length > 0 && !PENDING_PR7.has(o.file));
    expect(offenders).toEqual([]);
  });

  it('every pending PR 7 exception still has a match (remove it with the fix)', () => {
    for (const file of PENDING_PR7) {
      expect(matches(join(REPO, file)), file).not.toEqual([]);
    }
  });
});
