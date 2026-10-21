import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CURRICULUM_RULES,
  CURRICULUM_STUB_RULES,
  SHIPPED_STORY_IDS,
  freqCoverage,
  lintCurriculum,
  lintReviewStrings,
  storyCoverage,
  type CurriculumFinding,
  type CurriculumRule,
} from '../lesson-lint';
import { StorySchema } from '../schemas/story';
import { REPO_ROOT } from './helpers/romanization-registry';

// F-CURR-002 §9.3 (row CM-7): every rule runs over the fixture bundles of
// content/fixtures/curriculum-lint/. A bundle is a small content tree (`files`) and the findings
// of its rule (`expect`: rule, severity, file, path), so a `.pass` bundle expects none. A bundle
// is clean for its own rule only: its files may break other rules. `learner` holds learner
// messages by their packages/i18n file, read as lintReviewStrings reads the real ones.

type Bundle = {
  rule: string;
  files: Record<string, unknown>;
  learner?: Record<string, unknown>;
  expect?: string[][];
  gradeA?: string[];
  report?: unknown[];
};
const DIR = join(REPO_ROOT, 'content/fixtures/curriculum-lint');
const bundles = new Map<string, Bundle>(
  readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Bundle]),
);
const treeOf = (b: Bundle) => new Map(Object.entries(b.files));
const tuple = (f: CurriculumFinding) => [f.rule, f.severity, f.file, f.path];
const sorted = (rows: string[][]) => [...rows].sort((a, b) => (a.join('|') < b.join('|') ? -1 : 1));

/** Rules that apply to Volume 1 cells or shipped stories, so their fixtures cover both severities. */
const BOTH_SEVERITIES: readonly CurriculumRule[] = ['lesson-new-load', 'lesson-check-variety', 'culture-source', 'dictation-unambiguous', 'story-order-text', 'review-copy'];
/** Rules that never read Volume 1 or shipped stories: errors only. */
const ERRORS_ONLY: readonly CurriculumRule[] = ['lesson-recycle', 'lesson-culture-coverage', 'pack-skeleton', 'story-topic-unique'];

describe('lintCurriculum over the content/fixtures/curriculum-lint bundles', () => {
  for (const [name, bundle] of bundles) {
    if (bundle.expect === undefined) continue;
    it(`${name}: ${bundle.rule}`, () => {
      const learner = Object.entries(bundle.learner ?? {}).flatMap(([file, messages]) => lintReviewStrings(messages, file));
      const found = [...lintCurriculum(treeOf(bundle)), ...learner].filter((f) => f.rule === bundle.rule);
      expect(sorted(found.map(tuple))).toEqual(sorted(bundle.expect as string[][]));
      for (const f of found) expect(f.message.length, `${f.file} ${f.path}`).toBeGreaterThan(0);
    });
  }

  it('has a passing and a failing bundle for every rule, and both severities where the rule reads Volume 1', () => {
    const rules = Object.keys(CURRICULUM_RULES).filter((r) => r !== 'freq-coverage' && r !== 'story-coverage') as CurriculumRule[];
    expect([...BOTH_SEVERITIES, ...ERRORS_ONLY, ...CURRICULUM_STUB_RULES].sort()).toEqual([...rules].sort());
    for (const rule of [...rules, 'lesson-schema']) {
      expect(bundles.get(`${rule}.pass`)?.expect, `${rule}.pass`).toEqual([]);
      if (CURRICULUM_STUB_RULES.includes(rule as CurriculumRule)) continue;
      const severities = new Set((bundles.get(`${rule}.fail`)?.expect ?? []).map((row) => row[1]));
      const want = BOTH_SEVERITIES.includes(rule as CurriculumRule) ? ['error', 'warning'] : ['error'];
      expect([...severities].sort(), `${rule}.fail`).toEqual(want);
    }
  });

  it('reports freq-coverage and story-coverage as their bundles say', () => {
    const freq = bundles.get('freq-coverage.report') as Bundle;
    expect(freqCoverage(treeOf(freq), new Set(freq.gradeA))).toEqual(freq.report);
    const story = bundles.get('story-coverage.report') as Bundle;
    expect(storyCoverage(treeOf(story))).toEqual(story.report);
  });

  it('only warns on Volume 1 cells and shipped stories (they turn into errors in row CM-3B)', () => {
    const tree = new Map<string, unknown>();
    const walk = (rel: string): void => {
      for (const entry of readdirSync(join(REPO_ROOT, rel), { withFileTypes: true })) {
        const child = `${rel}/${entry.name}`;
        const json = (): unknown => JSON.parse(readFileSync(join(REPO_ROOT, child), 'utf8'));
        if (entry.isDirectory()) walk(child);
        else if (/^content\/episodes\/stage-[2-467]\/[a-z]+\.json$/.test(child)) tree.set(child, json());
        else if (/^content\/stories\/[^/]+\.json$/.test(child) && SHIPPED_STORY_IDS.has((json() as { id: string }).id)) tree.set(child, json());
      }
    };
    walk('content/episodes');
    walk('content/stories');
    expect(tree.size).toBeGreaterThanOrEqual(25 + SHIPPED_STORY_IDS.size);
    // Whatever Volume 1 still breaks (row CM-3A re-authors it), it is a warning until row CM-3B.
    expect(lintCurriculum(tree).filter((f) => f.severity !== 'warning')).toEqual([]);
  });

  it('builds the story-topic-unique bundles from stories that parse with StorySchema', () => {
    for (const name of ['story-topic-unique.pass', 'story-topic-unique.fail']) {
      for (const [file, story] of Object.entries((bundles.get(name) as Bundle).files)) {
        expect(StorySchema.safeParse(story).success, `${name} ${file}`).toBe(true);
      }
    }
  });

  it('passes review-copy on the learner review strings of every UI locale (validate-content reads the same files)', async () => {
    for (const locale of ['en', 'es', 'ko']) {
      const file = `packages/i18n/src/messages/${locale}/learner.ts`;
      const { learner } = (await import(join(REPO_ROOT, file))) as { learner: unknown };
      expect(lintReviewStrings(learner, file), file).toEqual([]);
    }
  });
});
