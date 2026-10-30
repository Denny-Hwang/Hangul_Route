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

/**
 * Rules that read Volume 1 cells. They warned there until row CM-3B (F-CURR-002 §9.3) and are errors now, so each
 * fail bundle holds a Volume 1 file whose findings are errors.
 */
const READS_VOLUME1: readonly CurriculumRule[] = ['lesson-new-load', 'lesson-check-variety', 'culture-source', 'dictation-unambiguous', 'story-order-text', 'review-copy', 'items-stable-id'];
/** Rules whose fail bundle also holds a shipped story, still a warning there (row CM-3B is Volume 1 only): both severities. */
const WARNS_SHIPPED_STORY: readonly CurriculumRule[] = ['review-copy'];
/** Rules that never read Volume 1 or shipped stories: errors only. */
const ERRORS_ONLY: readonly CurriculumRule[] = ['lesson-recycle', 'lesson-culture-coverage', 'pack-skeleton', 'story-topic-unique'];
/** A Volume 1 lesson cell: `content/episodes/stage-<n>/<theme>.json` (Volume 2 is `<theme>.v<k>.json`). */
const VOLUME1_FILE = /^content\/episodes\/stage-[0-9]+\/[a-z]+\.json$/;

/** The shipped Volume 1 lesson cells and shipped stories of the repository, as validate-content reads them. */
function shippedTree(): Map<string, unknown> {
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
  return tree;
}

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

  it('has a passing and a failing bundle for every rule, and a warning only where the bundle holds a shipped story', () => {
    const rules = Object.keys(CURRICULUM_RULES).filter((r) => r !== 'freq-coverage' && r !== 'story-coverage') as CurriculumRule[];
    expect([...new Set([...READS_VOLUME1, ...ERRORS_ONLY, ...CURRICULUM_STUB_RULES])].sort()).toEqual([...rules].sort());
    for (const rule of [...rules, 'lesson-schema']) {
      expect(bundles.get(`${rule}.pass`)?.expect, `${rule}.pass`).toEqual([]);
      if (CURRICULUM_STUB_RULES.includes(rule as CurriculumRule)) continue;
      const severities = new Set((bundles.get(`${rule}.fail`)?.expect ?? []).map((row) => row[1]));
      const want = WARNS_SHIPPED_STORY.includes(rule as CurriculumRule) ? ['error', 'warning'] : ['error'];
      expect([...severities].sort(), `${rule}.fail`).toEqual(want);
    }
  });

  it('row CM-3B: a Volume 1 file fails as an error for every rule that reads it, as Volume 2, a pack and a new story do', () => {
    for (const rule of READS_VOLUME1) {
      const bundle = bundles.get(`${rule}.fail`) as Bundle;
      const found = lintCurriculum(treeOf(bundle)).filter((f) => f.rule === rule);
      const volume1 = found.filter((f) => VOLUME1_FILE.test(f.file));
      expect(volume1.length, `${rule}.fail holds a Volume 1 finding`).toBeGreaterThan(0);
      expect(volume1.map((f) => f.severity), rule).toEqual(volume1.map(() => 'error'));
    }
    // Every other file keeps its severity: only a shipped story warns (its tier is out of row CM-3B's scope).
    for (const [name, bundle] of bundles) {
      if (bundle.expect === undefined) continue;
      for (const [, severity, file] of bundle.expect as string[][]) {
        const story = bundle.files[file as string] as { id?: unknown } | undefined;
        const shipped = /^content\/stories\//.test(file as string) && SHIPPED_STORY_IDS.has(String(story?.id));
        expect(severity, `${name} ${file}`).toBe(shipped ? 'warning' : 'error');
      }
    }
  });

  it('reports freq-coverage and story-coverage as their bundles say', () => {
    const freq = bundles.get('freq-coverage.report') as Bundle;
    expect(freqCoverage(treeOf(freq), new Set(freq.gradeA))).toEqual(freq.report);
    const story = bundles.get('story-coverage.report') as Bundle;
    expect(storyCoverage(treeOf(story))).toEqual(story.report);
  });

  it('passes every Volume 1 cell with no finding (errors since row CM-3B), and only warns on the shipped stories', () => {
    const tree = shippedTree();
    expect(tree.size).toBeGreaterThanOrEqual(25 + SHIPPED_STORY_IDS.size);
    const findings = lintCurriculum(tree);
    // Rows CM-3A (S2, S3, S4, S6, S7) re-authored the Checks and CM-3C sourced the notes, so no Volume 1 finding is
    // left; the cross-file Check share is filed under each stage's first file, so this reads it too.
    const volume1 = findings.filter((f) => VOLUME1_FILE.test(f.file));
    expect(volume1.map((f) => `${f.severity} ${f.rule} ${f.file} ${f.path}: ${f.message}`)).toEqual([]);
    expect(findings.filter((f) => f.severity !== 'warning')).toEqual([]);
  });

  it('row CM-3A S7: the five Stage 7 Volume 1 cells pass every rule with no warning (check rotation, culture-source, dictation)', () => {
    const tree = shippedTree();
    expect([...tree.keys()].filter((f) => f.startsWith('content/episodes/stage-7/'))).toHaveLength(5);
    // The stage-wide share of lesson-check-variety is filed under the stage's first file, so this reads it too.
    expect(lintCurriculum(tree).filter((f) => f.file.startsWith('content/episodes/stage-7/')).map((f) => `${f.rule} ${f.file} ${f.path}: ${f.message}`)).toEqual([]);
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
