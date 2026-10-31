import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCE_KINDS, READ_MEANING_KINDS, lintCurriculum, lintLessonCell } from '../lesson-lint';
import { normalizeKo } from '../lesson-lint-items';
import { rolePlayIssues } from '../role-play-rules';
import { Stage1TableSchema, reviewItemsOf } from '../review-items/build';
import { REVIEW_SNAPSHOT_FILE, REVIEW_STAGE1_FILE, lessonSourcesOfTree, storySourcesOfTree, vocabOfTree } from '../review-items/sources';
import { StableIdSnapshotSchema } from '../review-items/stable-ids';
import { LessonCellSchema, type LessonCell, type LessonQuest, type LessonScope } from '../schemas/lesson';
import { REPO_ROOT } from './helpers/romanization-registry';

/**
 * F-CURR-002 row CM-3A, part S4 (sections 7.1, 4.2, 9.3): the Check rotation re-authoring of the five Stage 4 Volume 1
 * cells, over the repository's own content. Stage 4 used to play Tap to Respond, Story Sequence and Listen & Pick in
 * all 15 quests; each theme now has the Practice and Apply pair of the section 7.1 table, the Checks rotate around the
 * default Dialogue reply pick (Tap to Respond: the line read, the reply picked), no step repeats a round, and the
 * rounds re-ask what the cells teach, so Stage 4 teaches no more review items than it did (section 4.3).
 */

const json = (rel: string): unknown => JSON.parse(readFileSync(join(REPO_ROOT, rel), 'utf8'));
const tree = new Map<string, unknown>();
const walk = (rel: string): void => {
  for (const e of readdirSync(join(REPO_ROOT, rel), { withFileTypes: true })) {
    const child = `${rel}/${e.name}`;
    if (e.isDirectory()) walk(child);
    else if (e.isFile() && e.name.endsWith('.json')) tree.set(child, json(child));
  }
};
for (const dir of ['content/episodes', 'content/stories', 'content/vocab', 'content/packs']) {
  try {
    walk(dir);
  } catch {
    // content/packs may not exist yet
  }
}
for (const rel of [REVIEW_SNAPSHOT_FILE, REVIEW_STAGE1_FILE]) tree.set(rel, json(rel));

const THEMES = ['letters', 'life', 'rites', 'nature', 'crafts'] as const;
const FILES = THEMES.map((t) => `content/episodes/stage-4/${t}.json`);
const CELLS: LessonCell[] = FILES.map((f) => LessonCellSchema.parse(tree.get(f)));
const QUESTS: LessonQuest[] = CELLS.flatMap((c) => c.quests);

const scopeOf = (quest: LessonQuest, kind: 'practice' | 'apply' | 'check'): LessonScope => {
  const ref = quest.steps.find((s) => s.kind === kind)?.minigameRef;
  const scope = quest.scopes.find((s) => s.ref === ref);
  if (scope === undefined) throw new Error(`${quest.id} has no ${kind} scope`);
  return scope;
};

/** The section 7.1 table: Stage 4's Practice and Apply pair for each theme. */
const PAIRS: Readonly<Record<(typeof THEMES)[number], readonly [string, string]>> = {
  letters: ['tap-respond', 'role-play'],
  life: ['role-play', 'order-it'],
  rites: ['story-sequence', 'cloze-pick'],
  nature: ['tap-respond', 'realia-read'],
  crafts: ['role-play', 'story-order'],
};

/** A dialogue turn a scored round asks: the line and its right (natural) reply. Role Play gives one per natural reply. */
function dialogueTurns(scope: LessonScope): string[] {
  if (scope.kind === 'tap-respond') return scope.turns.map((t) => `${normalizeKo(t.line.ko)} -> ${normalizeKo(t.replies.find((r) => r.correct)?.text.ko ?? '')}`);
  if (scope.kind !== 'role-play') return [];
  return scope.scene.nodes.flatMap((n) => ('replies' in n ? n.replies.filter((r) => r.kind === 'natural').map((r) => `${normalizeKo(n.line.ko)} -> ${normalizeKo(r.text.ko)}`) : []));
}

/** A sentence a scored round asks the learner to build or complete. */
function sentenceRounds(scope: LessonScope): string[] {
  if (scope.kind === 'order-it') return scope.rounds.map((r) => normalizeKo(r.sentence.ko));
  if (scope.kind === 'cloze-pick') return scope.rounds.map((r) => normalizeKo(r.sentence.ko.replace('___', r.tiles[r.answerIndex]?.ko ?? '')));
  return [];
}

const repeated = (list: readonly string[]): string[] => list.filter((x, i) => list.indexOf(x) !== i);

describe('Stage 4 Check rotation (F-CURR-002 section 7.1, row CM-3A S4)', () => {
  it('every section 9.3 rule passes with zero findings for Stage 4, the frozen ids included', () => {
    const findings = lintCurriculum(tree, { today: '2026-10-23' }).filter(
      // Volume 1's five cells (a Volume 2 cell has its own test, with its own access dates: stage4-letters-v2.test.ts).
      (f) => FILES.includes(f.file) || (f.rule === 'items-stable-id' && f.file === REVIEW_SNAPSHOT_FILE),
    );
    expect(findings.map((f) => `${f.rule} ${f.severity} ${f.file} ${f.path}: ${f.message}`)).toEqual([]);
  });

  it('every F-CURR-001 lesson rule passes for each cell', () => {
    for (const file of FILES) expect(lintLessonCell(tree.get(file), { today: '2026-10-23', storyFacts: new Map() }), file).toEqual([]);
  });

  it('each theme plays its section 7.1 Practice and Apply pair in all three quests', () => {
    CELLS.forEach((cell, i) => {
      const theme = THEMES[i] as (typeof THEMES)[number];
      for (const quest of cell.quests) expect([scopeOf(quest, 'practice').kind, scopeOf(quest, 'apply').kind], quest.id).toEqual(PAIRS[theme]);
    });
  });

  it('the Checks rotate: no game in more than 40% of them, the Dialogue reply pick the default, each a read-meaning or produce game', () => {
    const checks = QUESTS.map((q) => scopeOf(q, 'check').kind);
    const counts = new Map<string, number>();
    for (const k of checks) counts.set(k, (counts.get(k) ?? 0) + 1);
    for (const [kind, n] of counts) expect(n / checks.length, kind).toBeLessThanOrEqual(0.4);
    const most = Math.max(...counts.values());
    expect(counts.get('tap-respond')).toBe(most);
    for (const kind of checks) expect(PRODUCE_KINDS.has(kind) || READ_MEANING_KINDS.has(kind), kind).toBe(true);
    expect(QUESTS.every((q) => scopeOf(q, 'check').kind !== scopeOf(q, 'practice').kind && scopeOf(q, 'check').kind !== scopeOf(q, 'apply').kind)).toBe(true);
  });

  it('no two adjacent quests share their Practice, Apply and Check triple, in a cell or across the stage', () => {
    const triples = QUESTS.map((q) => (['practice', 'apply', 'check'] as const).map((k) => scopeOf(q, k).kind).join(' / '));
    triples.forEach((t, i) => i > 0 && expect(t, `${QUESTS[i - 1]?.id} and ${QUESTS[i]?.id}`).not.toBe(triples[i - 1]));
  });

  it('de-duplicates within a step: no step asks a dialogue turn, a built or completed sentence or a card question twice', () => {
    // Section 1: the de-duplication of Stage 4 is its games (five Practice and Apply pairs and a rotating Check in place of
    // one game triple in all 15 quests). Across steps a quest re-asks what its Discover taught, as the Volume 1 quests did,
    // so the review load stays where the section 4.3 gate holds it (the next describe).
    for (const quest of QUESTS) {
      for (const scope of quest.scopes) {
        expect(repeated(dialogueTurns(scope)), scope.ref).toEqual([]);
        expect(repeated(sentenceRounds(scope)), scope.ref).toEqual([]);
      }
    }
    const questions = QUESTS.flatMap((q) => q.scopes.flatMap((s) => (s.kind === 'realia-read' ? s.rounds.map((r) => `${s.realia.ref} ${r.questionEn}`) : [])));
    expect(repeated(questions)).toEqual([]);
  });

  it('the Nature Apply reads a weather card; every Role Play scene ends well on every way and names its partner by role', () => {
    const weather = new Set(['해', '비', '구름', '바람', '눈']);
    for (const quest of CELLS[3]?.quests ?? []) {
      const apply = scopeOf(quest, 'apply');
      if (apply.kind !== 'realia-read') throw new Error(quest.id);
      expect(apply.realia.ref, quest.id).toMatch(/^realia:s4-nature-q[1-3]-weather$/);
      for (const e of apply.realia.entries) expect(weather.has(e.value?.ko ?? ''), `${quest.id} ${e.id}`).toBe(true);
    }
    const scenes = QUESTS.flatMap((q) => q.scopes.flatMap((s) => (s.kind === 'role-play' ? [s.scene] : [])));
    expect(scenes).toHaveLength(9);
    for (const scene of scenes) {
      expect(rolePlayIssues(scene)).toEqual([]);
      expect(['선생님', '할머니', '엄마', '아빠', '친구']).toContain(scene.partner.ko);
    }
  });

  it('keeps the shipped card awards (cells and the Greeting Dialogues quest card)', () => {
    expect(CELLS.map((c) => c.rewardCardIds)).toEqual([['card:mwoyeyo'], ['card:masisseoyo'], ['card:annyeong', 'card:gamsa', 'card:chingu', 'card:insa'], ['card:biga-wayo'], ['card:gachi']]);
    expect(QUESTS.flatMap((q) => (q.rewardCardId ? [`${q.id} ${q.rewardCardId}`] : []))).toEqual(['quest:stage4-rites-q1 card:insa']);
  });
});

describe('Stage 4 review-item ids (F-CURR-002 section 4.2, row CM-3A S4)', () => {
  const snapshot = StableIdSnapshotSchema.parse(tree.get(REVIEW_SNAPSHOT_FILE));
  const built = reviewItemsOf({
    stage1: Stage1TableSchema.parse(tree.get(REVIEW_STAGE1_FILE)),
    lessons: lessonSourcesOfTree(tree),
    stories: storySourcesOfTree(tree),
    ...vocabOfTree(tree),
    snapshot,
  });
  const byId = new Map(built.items.map((i) => [i.id, i]));

  it('an edited exchange keeps its frozen id through an alias, taught by a Stage 4 cell', () => {
    expect(snapshot.alias['exc|호야, 안녕하세요|선생님, 안녕하세요! 이게 뭐예요']).toBe('exc:hoya-annyeonghaseyo');
    expect(byId.get('exc:hoya-annyeonghaseyo')?.cells).toContain('episode:stage4-letters');
  });

  it('the spicy turn stays on the soup (Food culture pass 5), so its frozen id needs no alias', () => {
    expect(Object.values(snapshot.alias)).not.toContain('exc:gugi-maewoyo');
    expect(byId.get('exc:gugi-maewoyo')?.ko).toBe('국이 매워요?');
    expect(byId.get('exc:gugi-maewoyo')?.reply?.ko).toBe('네, 매워요.');
    expect(byId.get('exc:gugi-maewoyo')?.cells).toContain('episode:stage4-life');
  });

  it('keeps the review load: Stage 4 teaches no more items first than before the re-authoring (section 4.3 gate)', () => {
    // 123 items were first taught by the five Stage 4 cells before row CM-3A S4 (the CM-10 index on the merged CM-30, 31,
    // 34, 35 and 3C stack). The 60-day simulation (S-b and the pinned S-c peak) holds at that load; a re-authoring that
    // teaches each turn and sentence as a new item (157 items) breaks S-b on 4 of 5 seeds. Retired items have no row.
    const firstCell = (cells: readonly string[]): string | undefined => cells.find((c) => c.startsWith('episode:'));
    // Volume 1 only: a Volume 2 item is reviewed only while `volumes` is on (row CM-13), so it is not on this route's load.
    const stage4 = built.items.filter((i) => /^episode:stage4-[a-z]+$/.test(firstCell(i.cells) ?? ''));
    expect(stage4.length).toBeLessThanOrEqual(123);
  });

  it('a removed item is retired: in no row, kept in the retired table for reports', () => {
    const retired = new Set(built.retired.map((r) => r.id));
    for (const id of ['pat:ige-mwoyeyo', 'pat:jal-gayo', 'pat:mwo-hago-nolkka', 'pat:gomawoyo-seonsaengnim']) {
      expect(snapshot.retired, id).toContain(id);
      expect(byId.has(id), id).toBe(false);
      expect(retired.has(id), id).toBe(true);
    }
  });
});
