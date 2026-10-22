import { describe, expect, it } from 'vitest';
import { REVIEW_SNAPSHOT_FILE, REVIEW_STAGE1_FILE, lintCurriculum } from '../lesson-lint';

// F-CURR-002 §9.3 (row CM-10): the `items-stable-id` rule on the frozen files themselves and on the
// Stage 1 table; the cell and story cases are the content/fixtures/curriculum-lint bundles.

const stage1 = {
  schemaVersion: 1,
  symbols: [{ id: 'jamo:a', char: 'ㅏ', kind: 'vowel', romanization: 'a' }],
  occurrences: [
    { kind: 'sym', ko: 'ㅏ', romanization: 'a', ref: 'jamo:a', cell: 'episode:stage1-letters', home: 'letters', stage: 1, volume: 1, source: 'discover', at: 'quest:stage1-letters-q1 steps[1].discover.pages[0].items[0]' },
    { kind: 'lex', ko: '배', romanization: 'bae', en: 'ship', cell: 'episode:stage1-life', home: 'life', stage: 1, volume: 1, source: 'round', at: 'lone' },
  ],
};
const senses = { schemaVersion: 1, groups: [{ group: 'bae', members: [{ id: 'vocab:bae-boat', en: 'boat', state: 'launch' }, { id: 'vocab:bae-pear', en: 'pear', state: 'reserved' }] }] };
const food = { items: [{ id: 'vocab:bae-boat', ko: '배', en: 'boat', senseGroup: 'bae' }] };
const story = {
  id: 'story:new-tale',
  state: 'ready',
  theme: 'nature',
  recommendedStage: 2,
  tiers: [{ level: 'read', checks: [{ id: 'r1', target: { ko: '해', romanization: 'hae', en: 'sun' }, options: [] }] }],
};
const rows = (tree: Map<string, unknown>) => lintCurriculum(tree).filter((f) => f.rule === 'items-stable-id').map((f) => [f.severity, f.file, f.path]);

describe('items-stable-id on the frozen files', () => {
  it('runs only when the tree holds the snapshot', () => {
    expect(rows(new Map([[REVIEW_STAGE1_FILE, stage1]]))).toEqual([]);
  });

  it('reports a snapshot or a Stage 1 table that does not parse, and checks nothing more', () => {
    expect(rows(new Map<string, unknown>([[REVIEW_SNAPSHOT_FILE, { schemaVersion: 2 }], [REVIEW_STAGE1_FILE, { schemaVersion: 1, symbols: [] }]]))).toEqual([
      ['error', REVIEW_SNAPSHOT_FILE, 'schemaVersion'],
      ['error', REVIEW_STAGE1_FILE, 'symbols'],
    ]);
    expect(rows(new Map<string, unknown>([[REVIEW_SNAPSHOT_FILE, 'x']]))).toEqual([['error', REVIEW_SNAPSHOT_FILE, '(root)']]);
  });

  it('reports a Stage 1 item on the frozen table, and a new story on the story, by their tiers', () => {
    const tree = new Map<string, unknown>([
      [REVIEW_SNAPSHOT_FILE, { schemaVersion: 1, ids: { 'sym|jamo:a': 'sym:a' } }],
      [REVIEW_STAGE1_FILE, stage1],
      ['content/vocab/_senses.json', senses],
      ['content/vocab/food.json', food],
      ['content/stories/new-tale.json', story],
    ]);
    expect(rows(tree)).toEqual([
      ['warning', REVIEW_STAGE1_FILE, 'lone'],
      ['error', 'content/stories/new-tale.json', 'tiers[0].checks[0].target'],
    ]);
    const shipped = lintCurriculum(tree, { shippedStoryIds: new Set(['story:new-tale']) }).filter((f) => f.rule === 'items-stable-id');
    expect(shipped.map((f) => f.severity)).toEqual(['warning', 'warning']);
  });

  it('reports a pack item as an error', () => {
    const level = { status: 'ready', quests: [{ id: 'quest:pack-x-s2-q1', steps: [{ id: 's2', kind: 'discover', discover: { pages: [{ items: [{ type: 'word', word: { ko: '물', romanization: 'mul', en: 'water' } }] }] } }] }] };
    const tree = new Map<string, unknown>([
      [REVIEW_SNAPSHOT_FILE, { schemaVersion: 1, ids: {} }],
      ['content/packs/x/stage-2.json', level],
    ]);
    expect(rows(tree)).toContainEqual(['error', 'content/packs/x/stage-2.json', 'quests[0].steps[0].discover.pages[0].items[0]']);
  });
});
