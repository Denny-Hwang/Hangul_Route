import { describe, expect, it } from 'vitest';
import {
  CURRICULUM_RULES,
  CULTURE_SOURCE_ALLOWLIST,
  REVIEW_COPY_NAMESPACES,
  allowlistedInstitution,
  freqCoverage,
  hasSoundChange,
  koStrings,
  lessonBodies,
  lintCurriculum,
  lintReviewMessages,
  lintReviewStrings,
  newCopyProblems,
  normalizeKo,
  parseGradeAList,
  pronunciationKey,
  questUnits,
  reviewScoreProblems,
  severityOf,
  stepGameKind,
  storyCoverage,
  storyOrderIssues,
  type CurriculumFinding,
  type LessonBodyQuest,
} from '../index';

// F-CURR-002 §9.3 (row CM-7): the helpers of the lint rules, and the edge cases the fixture
// bundles of content/fixtures/curriculum-lint/ do not reach.

type Json = Record<string, unknown>;
const kt = (ko: string) => ({ ko, romanization: 'x', en: 'x' });
const rows = (findings: CurriculumFinding[], rule?: string) =>
  findings.filter((f) => rule === undefined || f.rule === rule).map((f) => `${f.rule} ${f.severity} ${f.file} ${f.path}`);
const lint = (files: Record<string, unknown>) => lintCurriculum(new Map(Object.entries(files)));
const step = (kind: string, extra: Json = {}) => ({ id: kind, kind, titleEn: kind, ...extra });
const q = (id: string, steps: Json[], scopes: Json[] = []) => ({ id, steps, scopes });
const body = (id: string, stage: number, quests: Json[], extra: Json = {}) => ({ id, stage: `stage${stage}`, quests, ...extra });
const discover = (...items: Json[]) => step('discover', { discover: { pages: [{ items }] } });

describe('review-copy patterns', () => {
  it('finds a share or a score in any UI locale', () => {
    expect(reviewScoreProblems('You got 80%')).toEqual(['percent']);
    expect(reviewScoreProblems('Ochenta por ciento')).toEqual(['percent']);
    expect(reviewScoreProblems('80 퍼센트')).toEqual(['percent']);
    expect(reviewScoreProblems('3 of 5 right')).toEqual(['n-of-m']);
    expect(reviewScoreProblems('3 out of 5')).toEqual(['n-of-m']);
    expect(reviewScoreProblems('3/5')).toEqual(['n-of-m']);
    expect(reviewScoreProblems('3 de 5')).toEqual(['n-of-m']);
    expect(reviewScoreProblems('5개 중 3개')).toEqual(['n-of-m']);
    expect(reviewScoreProblems('Wonderful! You looked at every letter.')).toEqual([]);
  });

  it('finds age wording, speaking UI and emoji in new English copy', () => {
    expect(newCopyProblems('Fun for kids')).toEqual(['age-word']);
    expect(newCopyProblems('For ages 5 to 11')).toEqual(['age-word']);
    expect(newCopyProblems('Good for 5-11 years')).toEqual(['age-word']);
    expect(newCopyProblems('Repeat after Hoya')).toEqual(['speaking-ui']);
    expect(newCopyProblems('Read it aloud')).toEqual(['speaking-ui']);
    expect(newCopyProblems('Speak into the phone')).toEqual(['speaking-ui']);
    expect(newCopyProblems('Use your voice')).toEqual(['speaking-ui']);
    expect(newCopyProblems('Record yourself')).toEqual(['speaking-ui']);
    expect(newCopyProblems('Nice \u{1F600}')).toEqual(['emoji']);
    // A usage note, a story's characters, a voice in a tale.
    expect(newCopyProblems('Say this to call a server.')).toEqual([]);
    expect(newCopyProblems('The children ran home.')).toEqual([]);
    expect(newCopyProblems("Your voice and hand are not Mother's!")).toEqual([]);
  });

  it('reads the review sub-objects of learner messages, calling message functions with numbers', () => {
    const learner = {
      stageReview: { title: 'Hangul Check', score: '80%', nested: { line: (n: number, m: number) => `${n} of ${m}` } },
      dailyReview: { broken: (s: string) => s.toUpperCase(), fraction: '{n}/{m} words' },
      quest: { positionLabel: 'Question 1 of 2' },
    };
    expect(lintReviewMessages(learner)).toEqual([
      { path: 'learner.stageReview.score', problem: 'percent' },
      { path: 'learner.stageReview.nested.line', problem: 'n-of-m' },
    ]);
    // A function that throws on numbers is read as its source text.
    expect(lintReviewMessages({ dailyReview: { f: (s: string) => `${s.toUpperCase()} 3/5` } })).toEqual([{ path: 'learner.dailyReview.f', problem: 'n-of-m' }]);
    expect(lintReviewMessages(null)).toEqual([]);
    expect(REVIEW_COPY_NAMESPACES[0]).toBe('stageReview');
    expect(lintReviewStrings({ cellCheck: { a: '50%' } }, 'packages/i18n/src/messages/en/learner.ts')).toEqual([
      {
        rule: 'review-copy',
        severity: 'error',
        file: 'packages/i18n/src/messages/en/learner.ts',
        path: 'learner.cellCheck.a',
        message: 'a review screen never shows a percentage',
      },
    ]);
  });
});

describe('culture-source allowlist', () => {
  it('matches English and Korean names, and judges a renamed institution by the access date', () => {
    expect(CULTURE_SOURCE_ALLOWLIST).toHaveLength(18);
    expect(allowlistedInstitution('국립민속박물관 (National Folk Museum of Korea)', '2026-01-01')?.institution.name).toBe('National Folk Museum of Korea');
    expect(allowlistedInstitution('국립중앙박물관', '2026-01-01')?.institution.name).toBe('National Museum of Korea');
    expect(allowlistedInstitution('National Wetlands Center', '2026-01-01')?.institution.name).toBe('National Institute of Ecology');
    expect(allowlistedInstitution('국가유산청 (당시 문화재청) 보도자료', '2024-06-01')?.nameAsOfAccess).toBe(true);
    expect(allowlistedInstitution('문화재청', '2024-05-16')?.nameAsOfAccess).toBe(true);
    expect(allowlistedInstitution('문화재청', '2024-05-17')?.nameAsOfAccess).toBe(false);
    expect(allowlistedInstitution('국가유산청', '2024-05-17')?.nameAsOfAccess).toBe(true);
    expect(allowlistedInstitution('한국학중앙연구원 (Academy of Korean Studies)', '2026-01-01')).toBeUndefined();
    expect(CURRICULUM_RULES['culture-source']).toMatch(/as of the source's access date/);
  });
});

describe('taught items and pronunciation', () => {
  it('normalizes Korean and collects every ko string', () => {
    expect(normalizeKo('  "책이   있어요."  ')).toBe('책이 있어요');
    expect(koStrings([{ ko: ' 하늘 ' }, { a: { ko: '별' } }, { ko: '' }, { ko: 3 }])).toEqual(['하늘', '별']);
  });

  it('reads each Discover item kind as the units it teaches', () => {
    const quest = q('quest:x', [
      discover(
        { type: 'jamo', jamoId: 'jamo:g', example: kt('가방') },
        { type: 'jamo', example: kt('가방') },
        { type: 'word', word: kt('하늘') },
        { type: 'word', word: kt('하늘') },
        { type: 'sentence', sentence: kt('하늘이 커요.') },
        { type: 'pattern', frame: kt('___에 가요.'), examples: [kt('학교에 가요.'), kt('집에 가요.')] },
        { type: 'exchange', lines: [{ line: kt('안녕') }, { line: kt('안녕하세요') }] },
        { type: 'exchange', lines: [] },
        { type: 'realia', realiaRef: 'realia:menu', keyWords: [kt('밥'), kt('빵')] },
      ),
    ]) as unknown as LessonBodyQuest;
    expect(questUnits(quest).map((u) => `${u.kind}:${u.key}`)).toEqual([
      'word:jamo:g',
      'word:하늘',
      'sentence:하늘이 커요',
      'pattern:___에 가요',
      'exchange:안녕 / 안녕하세요',
      'word:밥',
      'word:빵',
    ]);
  });

  it('takes a step game from its scope when the step names none', () => {
    const quest = q('quest:x', [step('check', { minigameRef: 'm:c' }), step('apply')], [{ ref: 'm:c', kind: 'cloze-pick' }]) as unknown as LessonBodyQuest;
    expect(stepGameKind(quest, 'check')).toBe('cloze-pick');
    expect(stepGameKind(quest, 'apply')).toBeUndefined();
    expect(stepGameKind(quest, 'practice')).toBeUndefined();
  });

  it('keys spellings by how they sound, and finds sound changes beyond liaison', () => {
    expect(new Set(['낫', '낮', '낯'].map(pronunciationKey))).toEqual(new Set(['nat']));
    expect(pronunciationKey('같이')).toBe(pronunciationKey('가치'));
    expect(pronunciationKey('책 이')).not.toBe(pronunciationKey('채기'));
    expect(hasSoundChange('같이')).toBe(true);
    expect(hasSoundChange('국물')).toBe(true);
    expect(hasSoundChange('좋아요')).toBe(true);
    expect(hasSoundChange('책이 있어요.')).toBe(false);
    expect(hasSoundChange('읽어요')).toBe(false);
    expect(hasSoundChange('빨리')).toBe(false);
    expect(hasSoundChange('5,000 원')).toBe(false);
  });

  it('lists the lesson bodies of a tree in file order, cells and pack levels only', () => {
    const tree = new Map<string, unknown>([
      ['content/packs/p/stage-3.json', body('episode:pack-p-s3', 3, [q('quest:a', [step('intro')])])],
      ['content/episodes/stage-2/nature.json', body('episode:stage2-nature', 2, [q('quest:b', [step('intro')])])],
      ['content/packs/p/pack.json', { id: 'pack:p' }],
      ['content/episodes/stage-2/life.json', { not: 'a body' }],
      ['content/vocab/food.json', {}],
    ]);
    expect(lessonBodies(tree).map((b) => `${b.file} ${b.stage}`)).toEqual(['content/episodes/stage-2/nature.json 2', 'content/packs/p/stage-3.json 3']);
  });
});

describe('lintCurriculum edge cases', () => {
  it('gives the severity of each tier', () => {
    expect(['volume1', 'volume2', 'pack', 'shipped-story', 'new-story'].map((t) => severityOf(t as never))).toEqual(['warning', 'error', 'error', 'warning', 'error']);
  });

  it('reads a cell with volume 2 inside a Volume 1 file name as Volume 2, and a non-object file as not a body', () => {
    const v2 = body('episode:stage2-nature', 2, [q('quest:a', [step('check', { minigameKind: 'listen-pick' })])], { volume: 2 });
    expect(rows(lint({ 'content/episodes/stage-2/nature.json': v2 }), 'lesson-check-variety')[0]).toMatch(/ error /);
    expect(rows(lint({ 'content/episodes/stage-2/nature.v2.json': [] }))).toEqual(['lesson-schema error content/episodes/stage-2/nature.v2.json (root)']);
  });

  it('counts a Volume 2 cell of a lower stage as taught before a Volume 2 cell', () => {
    const teach = (ko: string) => q('quest:t', [discover({ type: 'word', word: kt(ko) })]);
    const recycle = q('quest:r', [step('check', { minigameKind: 'type-hangul', minigameRef: 'm:c' })], [{ ref: 'm:c', kind: 'type-hangul', rounds: [{ target: kt('별') }] }]);
    const files = {
      'content/episodes/stage-2/nature.v2.json': body('episode:stage2-nature-v2', 2, [teach('별')], { volume: 2 }),
      'content/episodes/stage-3/nature.v2.json': body('episode:stage3-nature-v2', 3, [recycle], { volume: 2 }),
    };
    expect(rows(lint(files), 'lesson-recycle')).toEqual([]);
  });

  it('reads a factRef to a missing story, fact or source list as no source', () => {
    const notes = [
      { id: 'n1', factRef: 'story:missing#f1' },
      { id: 'n2', factRef: 'story:s#f9' },
      { id: 'n3', factRef: 'story:s#f1' },
      { id: 'n4', factRef: 'story:s#f2' },
      { id: 'n5' },
    ];
    const files = {
      'content/episodes/stage-2/nature.json': body('episode:stage2-nature', 2, [q('quest:a', [step('intro')])], { culture: notes }),
      'content/stories/s.json': { id: 'story:s', facts: [{ id: 'f1' }, { id: 'f2', sources: [{ publisher: 'Bank of Korea' }] }] },
    };
    expect(rows(lint(files), 'culture-source')).toEqual([0, 1, 2, 3, 4].map((i) => `culture-source warning content/episodes/stage-2/nature.json culture[${i}].sources`));
  });

  it('reads Dictation and heard rounds defensively, and an explicit sound-change flag', () => {
    const scope = {
      ref: 'm:c',
      kind: 'type-hangul',
      rounds: [{ mode: 'hear' }, { mode: 'hear', target: kt('십육'), soundChange: true }, { mode: 'hear', target: { ko: '사과', soundChange: true } }, 'x'],
    };
    const pick = { ref: 'm:p', kind: 'listen-pick', rounds: [{ options: [{ id: 'a', text: {} }], answerId: 'a' }, { options: [{ id: 'a' }], answerId: 'b' }, { answerId: 'a' }] };
    const files = { 'content/episodes/stage-2/nature.v2.json': body('episode:stage2-nature-v2', 2, [q('quest:a', [step('intro')], [scope, pick])], { volume: 2 }) };
    expect(rows(lint(files), 'dictation-unambiguous')).toEqual([
      'dictation-unambiguous error content/episodes/stage-2/nature.v2.json quests[0].scopes[0].rounds[1]',
      'dictation-unambiguous error content/episodes/stage-2/nature.v2.json quests[0].scopes[0].rounds[2]',
    ]);
  });

  it('checks Story Order rounds wherever they sit', () => {
    expect(storyOrderIssues([])).toBeUndefined();
    expect(storyOrderIssues(['x', { panels: [] }])).toBe('0 of 2 rounds settle the order by their captions; at least 1');
    expect(storyOrderIssues([{ panels: [{ caption: kt('하늘'), art: { kind: 'scene' } }] }])).toMatch(/^0 of 1/);
    expect(storyOrderIssues([{ panels: ['x'] }])).toMatch(/^0 of 1/);
    const story = { id: 'story:new-one', kind: 'story-order', rounds: [{ panels: [{ caption: kt('하늘'), pictureRef: 'word:sky' }] }] };
    expect(rows(lint({ 'content/stories/new-one.json': story }), 'story-order-text')).toEqual(['story-order-text error content/stories/new-one.json (root)']);
  });

  it('finds an emoji in a Korean string of new copy', () => {
    const story = { id: 'story:new-two', title: { ko: '하늘 ⭐', romanization: 'haneul', en: 'sky' } };
    expect(rows(lint({ 'content/stories/new-two.json': story }), 'review-copy')).toEqual(['review-copy error content/stories/new-two.json title.ko']);
  });

  it('caps a game kind at 40 in 100 of the Checks of a stage across its files', () => {
    const cellWith = (theme: string, kinds: string[]) =>
      body(`episode:stage2-${theme}-v2`, 2, kinds.map((kind, i) => q(`quest:${i}`, [step('check', { minigameKind: kind })])), { volume: 2 });
    const files = {
      'content/episodes/stage-2/nature.v2.json': cellWith('nature', ['type-hangul', 'pic-word-match']),
      'content/episodes/stage-2/crafts.v2.json': cellWith('crafts', ['type-hangul', 'realia-read', 'cloze-pick']),
    };
    expect(rows(lint(files), 'lesson-check-variety')).toEqual([]);
    files['content/episodes/stage-2/nature.v2.json'] = cellWith('nature', ['type-hangul', 'type-hangul']);
    expect(rows(lint(files), 'lesson-check-variety')).toEqual([
      'lesson-check-variety error content/episodes/stage-2/nature.v2.json quests[1]',
      'lesson-check-variety error content/episodes/stage-2/crafts.v2.json (stage)',
    ]);
  });

  it('checks a pack manifest that is incomplete, and realia shown on Discover pages', () => {
    const quest = (n: number, k: number, extra: Json[] = []) => q(`quest:pack-p-s${n}-q${k}`, [...extra, step('reward')]);
    const level = (n: number, extra: Json = {}) => body(`episode:pack-p-s${n}`, n, [1, 2, 3].map((k) => quest(n, k)), extra);
    const realia = (ref: string) => discover({ type: 'realia', realiaRef: ref, keyWords: [kt('밥')] });
    const files: Record<string, unknown> = {
      'content/packs/p/pack.json': { id: 'pack:p', key: 'other', levels: 'none' },
      'content/packs/p/stage-2.json': level(2),
      'content/packs/p/stage-3.json': level(3),
      'content/packs/p/stage-4.json': level(4, { rewardCardIds: ['card:p-1'] }),
      'content/packs/p/stage-6.json': body('episode:pack-p-s6', 6, [quest(6, 1, [realia('realia:a')]), quest(6, 2, [realia('realia:b')]), quest(6, 3, [realia('realia:c')])]),
      'content/packs/p/stage-7.json': level(7, { rewardCardIds: ['card:p-2'], packCheck: { items: 8 } }),
    };
    expect(rows(lint(files), 'pack-skeleton')).toEqual([
      'pack-skeleton error content/packs/p/pack.json key',
      'pack-skeleton error content/packs/p/pack.json levels',
      ...[0, 1, 2, 3, 4].map((i) => `pack-skeleton error content/packs/p/pack.json levels[${i}]`),
      'pack-skeleton error content/packs/p/stage-7.json packCheck',
    ]);
    files['content/packs/p/stage-7.json'] = level(7, { rewardCardIds: ['card:p-2'] });
    expect(rows(lint(files), 'pack-skeleton')).toContain('pack-skeleton error content/packs/p/stage-7.json packCheck');
    files['content/packs/p/stage-7.json'] = { not: 'a body' };
    expect(rows(lint(files), 'pack-skeleton')).not.toContain('pack-skeleton error content/packs/p/pack.json levels[4]: missing');
  });

  it('compares story sources that are not URLs as written, and skips facts with no sources', () => {
    const story = (id: string, facts: unknown[], topicTags?: unknown[]) => ({ id, facts, ...(topicTags ? { topicTags } : {}) });
    const files = {
      'content/stories/a.json': story('story:a', [{ sources: [{ url: 'local reference' }] }, { id: 'f2' }, 'x']),
      'content/stories/b.json': story('story:b', [{ sources: [{ url: ' local reference ' }, { title: 'no url' }] }], [3, 'b-topic']),
      'content/stories/c.json': story('story:c', 'none' as never),
    };
    expect(rows(lintCurriculum(new Map(Object.entries(files)), { shippedStoryIds: new Set(['story:a']) }), 'story-topic-unique')).toEqual([
      'story-topic-unique error content/stories/b.json facts',
    ]);
  });
});

describe('reports', () => {
  it('parses a local grade-A list export', () => {
    expect(parseGradeAList('1\t사과01\t명사\r\n\nrank\n2,가다,동사')).toEqual(new Set(['사과', '가다']));
  });

  it('skips files that are not lesson bodies or stories', () => {
    const tree = new Map<string, unknown>([
      ['content/stories/a.json', { id: 'story:a', keywords: [{ id: 'k' }], tiers: [{ level: 'listen' }, { level: 'read', scenes: [{ id: 's1' }, 'x'] }] }],
      ['content/stories/b.json', { id: 'story:b' }],
      ['content/stories/0.json', { id: 'story:zero', recommendedStage: 2, keywords: 'none', tiers: [] }],
      ['content/stories/c.json', []],
      ['content/vocab/food.json', {}],
    ]);
    expect(storyCoverage(tree)).toEqual([
      { file: 'content/stories/a.json', storyId: 'story:a', tier: 'listen', recommendedStage: 7, tokens: 0, taught: 0 },
      { file: 'content/stories/a.json', storyId: 'story:a', tier: 'read', recommendedStage: 7, tokens: 0, taught: 0 },
    ]);
    expect(freqCoverage(tree, new Set())).toEqual([]);
  });
});
