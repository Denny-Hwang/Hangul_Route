import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHECK_KIND_SHARE_MAX, PRODUCE_KINDS, REVIEW_SNAPSHOT_FILE, REVIEW_STAGE1_FILE, askedKo, lintCurriculum, stepGameKind, type LessonBodyQuest } from '../lesson-lint';
import { REPO_ROOT } from './helpers/romanization-registry';

/**
 * F-CURR-002 row CM-3A, part S3: the Check rotation re-authoring of the five Stage 3 Volume 1 cells (section 7.1).
 * Every section 9.3 rule passes with no finding at all (warning or error) on Stage 3, read over the whole content
 * tree as `validate-content.mjs` reads it (the rules look at the stages before), with the frozen review-item files.
 * The Stage 3 default Check is Cloze Pick and Sentence Builder; Dictation is the third game of the rotation.
 */

const STAGE3 = /^content\/episodes\/stage-3\/[a-z]+\.json$/;

function contentTree(): Map<string, unknown> {
  const tree = new Map<string, unknown>();
  const walk = (rel: string): void => {
    for (const entry of readdirSync(join(REPO_ROOT, rel), { withFileTypes: true })) {
      const child = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (child !== 'content/fixtures' && child !== 'content/stories/research') walk(child);
      } else if (entry.name.endsWith('.json')) {
        tree.set(child, JSON.parse(readFileSync(join(REPO_ROOT, child), 'utf8')));
      }
    }
  };
  walk('content');
  for (const rel of [REVIEW_SNAPSHOT_FILE, REVIEW_STAGE1_FILE]) {
    if (existsSync(join(REPO_ROOT, rel))) tree.set(rel, JSON.parse(readFileSync(join(REPO_ROOT, rel), 'utf8')));
  }
  return tree;
}

const tree = contentTree();
const cells = [...tree.entries()].filter(([rel]) => STAGE3.test(rel)).sort(([a], [b]) => (a < b ? -1 : 1));
const quests = cells.flatMap(([, body]) => (body as { quests: LessonBodyQuest[] }).quests);
const checks = quests.map((q) => stepGameKind(q, 'check'));

describe('Stage 3 Check rotation (F-CURR-002 section 7.1, row CM-3A S3)', () => {
  it('reads the five Stage 3 cells and their fifteen quests', () => {
    expect(cells.map(([rel]) => rel)).toEqual([
      'content/episodes/stage-3/crafts.json',
      'content/episodes/stage-3/letters.json',
      'content/episodes/stage-3/life.json',
      'content/episodes/stage-3/nature.json',
      'content/episodes/stage-3/rites.json',
    ]);
    expect(quests).toHaveLength(15);
  });

  it('every section 9.3 rule passes on Stage 3 with no warning and no error', () => {
    const findings = lintCurriculum(tree).filter((f) => STAGE3.test(f.file));
    expect(findings.map((f) => `${f.rule} ${f.severity} ${f.file} ${f.path}: ${f.message}`)).toEqual([]);
  });

  it('no game kind holds more than 40% of the Stage 3 Checks', () => {
    const counts = new Map<string, number>();
    for (const kind of checks) counts.set(kind ?? '-', (counts.get(kind ?? '-') ?? 0) + 1);
    for (const [kind, n] of counts) expect(n / checks.length, kind).toBeLessThanOrEqual(CHECK_KIND_SHARE_MAX);
  });

  it('the Checks are the S3 default (Cloze Pick and Sentence Builder) and Dictation, every one a produce game', () => {
    expect([...new Set(checks)].sort()).toEqual(['cloze-pick', 'order-it', 'type-hangul']);
    for (const kind of checks) expect(PRODUCE_KINDS.has(kind ?? '')).toBe(true);
    expect(checks.filter((k) => k === 'cloze-pick' || k === 'order-it').length).toBeGreaterThanOrEqual(10);
  });

  it('a Dictation Check plays every round by ear (Type Hangul hear mode), and no heard round says 네 차례 (F-CURR-001 section 3.5)', () => {
    for (const quest of quests) {
      for (const scope of quest.scopes) {
        const rounds = (scope as { rounds?: Array<Record<string, unknown>> }).rounds ?? [];
        if (scope.kind === 'type-hangul' && stepGameKind(quest, 'check') === 'type-hangul') {
          for (const round of rounds) expect(round.mode, `${scope.ref} ${String(round.id)}`).toBe('hear');
        }
        const heard = scope.kind === 'listen-pick' || scope.kind === 'type-hangul';
        if (heard) expect(JSON.stringify(rounds).includes('네 차례'), scope.ref).toBe(false);
      }
    }
  });
});

describe('askedKo reads a Cloze Pick round as the review-item build does (row CM-3A S3)', () => {
  const t = (ko: string, romanization: string) => ({ ko, romanization, en: 'x' });
  const round = (gapKind: string | undefined, sentence: string, answerIndex = 0) => ({
    id: 'c1',
    sentence: t(sentence, 'x'),
    ...(gapKind === undefined ? {} : { gapKind }),
    tiles: [t('빵', 'ppang'), t('떡', 'tteok'), t('을', 'eul')],
    answerIndex,
  });

  it('a word gap asks the completed sentence and the tile that fills it, never the other tiles', () => {
    expect(askedKo([round('word', '___을 먹어요.')])).toEqual(['빵을 먹어요', '빵']);
    // An absent gapKind is a word gap (the schema default).
    expect(askedKo([round(undefined, '___을 먹어요.', 1)])).toEqual(['떡을 먹어요', '떡']);
  });

  it('a particle gap asks the completed sentence only; a value gap and a round with no answer tile ask nothing', () => {
    expect(askedKo([round('particle', '사과___ 먹어요.', 2)])).toEqual(['사과을 먹어요']);
    expect(askedKo([round('value', '___ 원이에요.')])).toEqual([]);
    expect(askedKo([round('word', '___을 먹어요.', 7)])).toEqual([]);
  });
});
