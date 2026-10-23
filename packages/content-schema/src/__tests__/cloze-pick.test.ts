import { describe, expect, it } from 'vitest';
import {
  CLOZE_GAP,
  ClozePickRoundSchema,
  LessonQuestSchema,
  LessonScopeSchema,
  MinigameKindSchema,
  RoundSchema,
  SLOT_MARKER,
  clozePickIssues,
  fillClozeGap,
  type ClozePickRound,
} from '../index';
import { lessonOccurrences } from '../review-items/extract';
import { kt, lessonQuest } from './helpers/lesson-fixtures';

// F-CURR-002 section 7.1 F1, row CM-30. Fixture Korean only (no content row); every romanization is the output of
// `romanization/rr.ts` (책을 읽어요. chaegeul ilgeoyo, 물을 마셔요. mureul masyeoyo, 사과를 먹어요. sagwareul meogeoyo).

const WORD_TILES = [kt('읽어요', 'ilgeoyo', 'read'), kt('먹어요', 'meogeoyo', 'eat'), kt('마셔요', 'masyeoyo', 'drink')];
const word = (over: Partial<Record<keyof ClozePickRound, unknown>> = {}) => ({
  id: 'c1',
  sentence: kt('책을 ___.', 'chaegeul ___.', 'I read a book.'),
  tiles: WORD_TILES,
  answerIndex: 0,
  ...over,
});
const particle = (over: Partial<Record<keyof ClozePickRound, unknown>> = {}) => ({
  id: 'c2',
  sentence: kt('물___ 마셔요.', 'mul___ masyeoyo.', 'I drink water.'),
  gapKind: 'particle',
  tiles: [kt('을', 'eul', 'object marker'), kt('를', 'reul', 'object marker'), kt('이', 'i', 'subject marker')],
  answerIndex: 0,
  filledRomanization: 'mureul masyeoyo.',
  ...over,
});
const value = (over: Partial<Record<keyof ClozePickRound, unknown>> = {}) => ({
  id: 'c3',
  sentence: kt('___ 원이에요.', '___ wonieyo.', 'It is ___ won.'),
  gapKind: 'value',
  tiles: [kt('오천', 'ocheon', 'five thousand'), kt('삼천', 'samcheon', 'three thousand'), kt('만', 'man', 'ten thousand')],
  answerIndex: 0,
  ...over,
});
const ok = (v: unknown) => ClozePickRoundSchema.safeParse(v).success;
const messages = (v: unknown) => {
  const r = ClozePickRoundSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};
const realia = { ref: 'realia:market-prices', kind: 'price-card', entries: [{ id: 'e1', text: kt('사과', 'sagwa', 'apple'), value: kt('오천 원', 'ocheon won', '5,000 won') }], altEn: 'A price card' };

describe('cloze-pick kind (additive)', () => {
  it('is a new kind at the end of MinigameKindSchema; every older kind still parses', () => {
    // Additive: after write-frame, before the kinds later rows append (story-order, role-play).
    expect(MinigameKindSchema.options[MinigameKindSchema.options.indexOf('write-frame') + 1]).toBe('cloze-pick');
    for (const kind of ['listen-pick', 'order-it', 'realia-read', 'type-hangul', 'trace-word', 'write-frame']) expect(MinigameKindSchema.safeParse(kind).success).toBe(true);
  });

  it('carries a Cloze Pick round in RoundSchema, and older rounds still parse', () => {
    expect(RoundSchema.safeParse({ kind: 'cloze-pick', data: word() }).success).toBe(true);
    expect(RoundSchema.safeParse({ kind: 'order-it', data: { id: 'r', sentence: kt('물을 마셔요.', 'mureul masyeoyo', 'I drink water') } }).success).toBe(true);
    expect(RoundSchema.safeParse({ kind: 'cloze-pick', data: { ...word(), tiles: [] } }).success).toBe(false);
  });

  it('uses the slot marker of the frames as its gap', () => {
    expect(CLOZE_GAP).toBe(SLOT_MARKER);
    expect(fillClozeGap('책을 ___.', '읽어요')).toBe('책을 읽어요.');
  });
});

describe('ClozePickRoundSchema', () => {
  it('parses a word gap and defaults gapKind to word', () => {
    const parsed = ClozePickRoundSchema.parse(word());
    expect(parsed.gapKind).toBe('word');
    expect(ok(word({ tiles: [...WORD_TILES, kt('봐요', 'bwayo', 'see')] }))).toBe(true);
  });

  it('wants 3 or 4 tiles, one gap in the Korean and in the romanization', () => {
    expect(ok(word({ tiles: WORD_TILES.slice(0, 2) }))).toBe(false);
    expect(ok(word({ tiles: [...WORD_TILES, kt('봐요', 'bwayo', 'see'), kt('줘요', 'jwoyo', 'give')] }))).toBe(false);
    expect(messages(word({ sentence: kt('책을 읽어요.', 'chaegeul ___.', 'I read a book.') }))).toContain('one gap (___) in the Korean and one in the romanization');
    expect(messages(word({ sentence: kt('___ ___.', '___ ___.', 'I read a book.') }))).toContain('one gap (___) in the Korean and one in the romanization');
    expect(messages(word({ sentence: kt('책을 ___.', 'chaegeul ilgeoyo.', 'I read a book.') }))).toContain('one gap (___) in the Korean and one in the romanization');
  });

  it('points answerIndex at a tile, keeps tiles apart, and keeps the gap out of the tiles', () => {
    expect(messages(word({ answerIndex: 3 }))).toContain('answerIndex must point at a tile');
    expect(messages(word({ tiles: [kt('읽어요', 'ilgeoyo', 'read'), kt('읽어요', 'ilgeoyo', 'read'), kt('마셔요', 'masyeoyo', 'drink')] }))).toContain('tiles differ and carry no gap');
    expect(messages(word({ tiles: [kt('___', '___', 'gap'), kt('먹어요', 'meogeoyo', 'eat'), kt('마셔요', 'masyeoyo', 'drink')] }))).toContain('tiles differ and carry no gap');
  });

  it('gives a word gap its whole meaning and keeps the gap in a value gap meaning', () => {
    expect(messages(word({ sentence: kt('책을 ___.', 'chaegeul ___.', 'I ___ a book.') }))).toContain('the meaning keeps the gap for a value gap only (It is ___ won.)');
    expect(ok(value())).toBe(true);
    expect(messages(value({ sentence: kt('___ 원이에요.', '___ wonieyo.', 'It is 5,000 won.') }))).toContain('the meaning keeps the gap for a value gap only (It is ___ won.)');
  });

  it('checks a particle gap against the word before it, and wants the linked romanization', () => {
    expect(ok(particle())).toBe(true);
    expect(messages(particle({ answerIndex: 1 }))).toContain('"물" takes 을, not 를');
    expect(ok(particle({ sentence: kt('사과___ 먹어요.', 'sagwa___ meogeoyo.', 'I eat an apple.'), answerIndex: 1, filledRomanization: 'sagwareul meogeoyo.' }))).toBe(true);
    expect(messages(particle({ filledRomanization: undefined }))).toContain('a particle gap gives the completed romanization (the particle links)');
    expect(messages(particle({ sentence: kt('___ 마셔요.', '___ masyeoyo.', 'I drink water.') }))).toContain('a particle gap follows its word (물___ 마셔요.)');
    // A particle that is not one of a pair (도) is not checked against the word before it.
    expect(ok(particle({ tiles: [kt('도', 'do', 'also'), kt('를', 'reul', 'object marker'), kt('이', 'i', 'subject marker')], filledRomanization: 'muldo masyeoyo.' }))).toBe(true);
  });
});

describe('the cloze-pick lesson scope', () => {
  const ref = 'minigame:s3-life-q1-practice';
  it('parses a scope of word rounds, and a value gap with its realia card', () => {
    expect(LessonScopeSchema.safeParse({ ref, kind: 'cloze-pick', rounds: [word(), particle()] }).success).toBe(true);
    expect(LessonScopeSchema.safeParse({ ref, kind: 'cloze-pick', rounds: [value()], realia }).success).toBe(true);
    expect(LessonScopeSchema.safeParse({ ref, kind: 'cloze-pick', rounds: [] }).success).toBe(false);
  });

  it('cross-checks a value gap and its card', () => {
    const scope = (over: object) => LessonScopeSchema.parse({ ref, kind: 'cloze-pick', rounds: [word()], ...over }) as Extract<ReturnType<typeof LessonScopeSchema.parse>, { kind: 'cloze-pick' }>;
    expect(clozePickIssues(scope({ rounds: [value()] }))).toEqual([{ path: ['realia'], message: 'a value gap reads its value from the scope realia card' }]);
    expect(clozePickIssues(scope({ realia }))).toEqual([{ path: ['realia'], message: 'a realia card goes with a value gap' }]);
    expect(clozePickIssues(scope({ rounds: [value()], realia: { ...realia, entries: [realia.entries[0], realia.entries[0]] } }))).toEqual([{ path: ['realia', 'entries'], message: 'realia entry ids must be unique' }]);
    expect(clozePickIssues(scope({ rounds: [value()], realia }))).toEqual([]);
  });

  it('a quest carries the issues at the scope path', () => {
    const quest = lessonQuest('stage3', 'life', 1);
    const at = quest.scopes.findIndex((s) => s.ref.endsWith('-practice'));
    const scopes = quest.scopes.map((s, i) => (i === at ? { ref: s.ref, kind: 'cloze-pick', rounds: [value()] } : s));
    const steps = quest.steps.map((s) => (s.minigameRef === quest.scopes[at]?.ref ? { ...s, minigameKind: 'cloze-pick' } : s));
    const result = LessonQuestSchema.safeParse({ ...quest, steps, scopes });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message === 'a value gap reads its value from the scope realia card' && i.path.join('.') === `scopes.${at}.realia`)).toBe(true);
  });
});

describe('review items of a cloze-pick scope', () => {
  const cell = {
    id: 'episode:stage3-life',
    status: 'ready',
    quests: [
      {
        id: 'quest:stage3-life-q1',
        steps: [
          { id: 's3', kind: 'practice', minigameRef: 'minigame:s3-life-q1-practice' },
          { id: 's4', kind: 'apply', minigameRef: 'minigame:s3-life-q1-apply' },
        ],
        scopes: [
          { ref: 'minigame:s3-life-q1-practice', kind: 'cloze-pick', rounds: [word(), particle(), { ...word({ id: 'c4' }), tiles: 'nope' }] },
          { ref: 'minigame:s3-life-q1-apply', kind: 'cloze-pick', rounds: [value(), { ...value({ id: 'c5' }), sentence: 'nope' }], realia: { ...realia, title: kt('시장', 'sijang', 'market') } },
        ],
      },
    ],
  };
  const source = { file: 'content/episodes/stage-3/life.json', body: cell, cellId: 'episode:stage3-life', stage: 3, home: 'life' as const, volume: 1 };

  it('asks the completed sentence and a word gap answer; a value gap asks its card', () => {
    const occs = lessonOccurrences(source, []);
    const m = (q: string, field: string) => `minigame:s3-life-q1-${q}#${field}`;
    expect(occs.map((o) => [o.kind, o.ko, o.romanization, o.glossKey ?? '', o.loose === true ? 'loose' : '', o.ref ?? ''])).toEqual([
      ['pat', '책을 읽어요.', 'chaegeul ilgeoyo.', m('practice', 'clozePick.rounds.c1.sentence.gloss'), '', ''],
      ['lex', '읽어요', 'ilgeoyo', m('practice', 'clozePick.rounds.c1.tiles.ilgeoyo.gloss'), 'loose', ''],
      ['pat', '물을 마셔요.', 'mureul masyeoyo.', m('practice', 'clozePick.rounds.c2.sentence.gloss'), '', ''],
      ['rea', '시장', expect.any(String), m('apply', 'clozePick.realia.alt'), '', 'realia:market-prices'],
      ['rea', '시장', expect.any(String), m('apply', 'clozePick.realia.alt'), '', 'realia:market-prices'],
    ]);
  });

  it('a value gap with no card asks nothing', () => {
    const bare = { ...cell, quests: [{ ...cell.quests[0], scopes: [{ ref: 'minigame:s3-life-q1-apply', kind: 'cloze-pick', rounds: [value()] }] }] };
    expect(lessonOccurrences({ ...source, body: bare }, [])).toEqual([]);
  });
});
