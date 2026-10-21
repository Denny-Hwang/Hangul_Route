import { describe, expect, it } from 'vitest';
import {
  CURRICULUM_RULES,
  CULTURE_SOURCE_ALLOWLIST,
  REVIEW_COPY_NAMESPACES,
  allowlistedInstitution,
  askedKo,
  freqCoverage,
  hasSoundChange,
  isReadMeaningRound,
  koStrings,
  lessonBodies,
  lintCurriculum,
  lintReviewMessages,
  lintReviewStrings,
  localeCopyProblems,
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
} from '../lesson-lint';

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
    expect(reviewScoreProblems('5개 중에 3개')).toEqual(['n-of-m']);
    expect(reviewScoreProblems('5문제 중에서 3문제')).toEqual(['n-of-m']);
    expect(reviewScoreProblems('80프로')).toEqual(['percent']);
    expect(reviewScoreProblems('3 sobre 5')).toEqual(['n-of-m']);
    expect(reviewScoreProblems('Tu porcentaje')).toEqual(['percent']);
    expect(reviewScoreProblems('오늘의 복습 프로그램')).toEqual([]);
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
    // The device voice reads; the learner listens.
    expect(newCopyProblems('Tap to hear it read aloud.')).toEqual([]);
    expect(newCopyProblems('Hear Hoya read it aloud.')).toEqual([]);
    expect(newCopyProblems('Now read it aloud.')).toEqual(['speaking-ui']);
  });

  it('checks new copy by UI locale: age patterns for es and ko, emoji everywhere, the speaking patterns in English', () => {
    expect(localeCopyProblems('Read it aloud', 'en')).toEqual(['speaking-ui']);
    expect(localeCopyProblems('Un juego para niños', 'es')).toEqual(['age-word']);
    expect(localeCopyProblems('De 5 a 11 años', 'es')).toEqual(['age-word']);
    expect(localeCopyProblems('Los niños corrieron a casa.', 'es')).toEqual([]);
    expect(localeCopyProblems('어린이용 복습 ⭐', 'ko')).toEqual(['age-word', 'emoji']);
    expect(localeCopyProblems('7세 이상', 'ko')).toEqual(['age-word']);
    expect(localeCopyProblems('아이들이 달렸어요.', 'ko')).toEqual([]);
    expect(localeCopyProblems('pour les enfants ⭐', 'fr')).toEqual(['emoji']);
    expect(lintReviewMessages({ stageReview: { a: 'para niños', b: '3 de 5' } }, undefined, 'es')).toEqual([
      { path: 'learner.stageReview.a', problem: 'age-word' },
      { path: 'learner.stageReview.b', problem: 'n-of-m' },
    ]);
    expect(lintReviewStrings({ stageReview: { a: '어린이용' } }, 'packages/i18n/src/messages/ko/learner.ts').map((f) => f.path)).toEqual(['learner.stageReview.a']);
    expect(lintReviewStrings({ stageReview: { a: 'For kids' } }, 'learner.ts').map((f) => f.path)).toEqual(['learner.stageReview.a']);
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

  it('matches whole English names, and with a URL only on a host the institution runs', () => {
    for (const institution of CULTURE_SOURCE_ALLOWLIST) expect(institution.hosts.length, institution.name).toBeGreaterThan(0);
    const at = (publisher: string, url: string) => allowlistedInstitution(publisher, '2026-01-01', url)?.institution.name;
    expect(at('UNESCO Memory of the World', 'https://www.unesco.org/en/memory-world')).toBe('UNESCO');
    expect(at('국가유산청 국가유산포털', 'https://www.heritage.go.kr/main')).toBe('Korea Heritage Service');
    expect(at('기상청 국립기상박물관', 'https://science.kma.go.kr/museum')).toBe('Korea Meteorological Administration');
    // A name on a site the institution does not run, or a body whose name contains an allowlisted one.
    expect(at('UNESCO', 'https://any-blog.example/unesco')).toBeUndefined();
    expect(at('Korean National Commission for UNESCO (유네스코한국위원회)', 'https://www.unesco.or.kr/')).toBeUndefined();
    expect(at('Export-Import Bank of Korea', 'https://www.koreaexim.go.kr/')).toBeUndefined();
    expect(at('SBS 뉴스 (includes 국립한글박물관 학예연구사 인터뷰)', 'https://news.sbs.co.kr/x')).toBeUndefined();
    expect(at('UNESCO', 'not a url')).toBeUndefined();
    expect(allowlistedInstitution('National Museum of Korean Contemporary History', '2026-01-01')).toBeUndefined();
    expect(allowlistedInstitution('the Bank of Korea-run museum', '2026-01-01')).toBeUndefined();
    expect(allowlistedInstitution('Bank of Korea, Money Museum', '2026-01-01')?.institution.name).toBe('Bank of Korea');
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

  it('reads as asked only the Korean a round accepts as right, not wrong options or tiles', () => {
    const scopes = [
      { kind: 'listen-pick', rounds: [{ prompt: kt('달'), options: [{ id: 'a', text: kt('달') }, { id: 'b', text: kt('딸') }, 'x'], answerId: 'a' }] },
      { kind: 'tap-respond', turns: [{ line: kt('안녕'), replies: [{ id: 'a', text: kt('네'), correct: true }, { id: 'b', text: kt('아니요'), correct: false }, 3] }] },
      { kind: 'order-it', rounds: [{ sentence: kt('비가 와요.'), distractors: [kt('눈')], particle: { tile: 0, choices: [kt('이'), kt('가')] } }] },
      { kind: 'realia-read', realia: { entries: [{ text: kt('라면') }] }, rounds: [{ key: kt('김밥'), options: [{ id: 'a', figure: '5,000' }], answerId: 'a' }] },
      { kind: 'card-match', pairs: [kt('해'), { ko: '' }], options: [kt('별')] },
    ];
    expect(askedKo(scopes)).toEqual(['달', '달', '안녕', '네', '비가 와요', '김밥', '해', '별']);
  });

  it('counts a word seen only as a wrong option as new when a later quest teaches it', () => {
    const pick = q('quest:a', [step('check', { minigameKind: 'listen-pick', minigameRef: 'm:c' })], [
      { ref: 'm:c', kind: 'listen-pick', rounds: [{ prompt: kt('하늘'), options: [{ id: 'a', text: kt('하늘') }, { id: 'b', text: kt('구름') }], answerId: 'a' }] },
    ]);
    const words = ['구름', '바다', '산', '강', '꽃', '나무', '돌', '새', '비'];
    const teach = q('quest:b', [discover(...words.map((w) => ({ type: 'word', word: kt(w) })))]);
    const files = { 'content/episodes/stage-2/nature.v2.json': body('episode:stage2-nature-v2', 2, [pick, teach], { volume: 2 }) };
    expect(rows(lint(files), 'lesson-new-load')).toEqual(['lesson-new-load error content/episodes/stage-2/nature.v2.json quests[1]']);
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

  it('counts a Check by its rounds: meanings, not spellings, and no Story Sequence on English labels', () => {
    expect(isReadMeaningRound({ options: [{ id: 'a', pictureRef: 'word:sky' }, { id: 'b', labelEn: 'sea' }] })).toBe(true);
    expect(isReadMeaningRound({ options: [{ id: 'a', text: kt('하늘'), labelEn: 'sky' }] })).toBe(false);
    expect(isReadMeaningRound({ options: [] })).toBe(false);
    expect(isReadMeaningRound({ options: ['x'] })).toBe(false);
    expect(isReadMeaningRound({ options: [{ id: 'a' }] })).toBe(false);
    expect(isReadMeaningRound('x')).toBe(false);
    const cell = (kind: string, scope: Json) =>
      body('episode:stage2-nature-v2', 2, [q('quest:a', [step('check', { minigameKind: kind, minigameRef: 'm:c' })], [{ ref: 'm:c', kind, ...scope }])], { volume: 2 });
    const check = (kind: string, scope: Json) => rows(lint({ 'content/episodes/stage-2/nature.v2.json': cell(kind, scope) }), 'lesson-check-variety').filter((r) => !r.endsWith('(stage)'));
    expect(check('card-match', { pairs: [kt('해'), kt('달')] })).toEqual([]);
    expect(check('listen-pick', { rounds: [{ options: [{ id: 'a', pictureRef: 'word:sky' }], answerId: 'a' }] })).toEqual([]);
    expect(check('listen-pick', { rounds: [{ options: [{ id: 'a', text: kt('하늘') }], answerId: 'a' }] })).toHaveLength(1);
    expect(check('listen-pick', {})).toHaveLength(1);
    expect(check('story-sequence', { lines: [{ id: 'a', speakerEn: 'Hoya', line: kt('안녕') }] })).toHaveLength(1);
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
    const level = (n: number, extra: Json = {}) => body(`episode:pack-p-s${n}`, n, [1, 2, 3].map((k) => quest(n, k)), { status: 'ready', ...extra });
    const realia = (ref: string) => discover({ type: 'realia', realiaRef: ref, keyWords: [kt('밥')] });
    const files: Record<string, unknown> = {
      'content/packs/p/pack.json': { id: 'pack:p', key: 'other', levels: 'none' },
      'content/packs/p/stage-2.json': level(2),
      'content/packs/p/stage-3.json': level(3),
      'content/packs/p/stage-4.json': level(4, { rewardCardIds: ['card:p-1'] }),
      'content/packs/p/stage-6.json': body('episode:pack-p-s6', 6, [quest(6, 1, [realia('realia:a')]), quest(6, 2, [realia('realia:b')]), quest(6, 3, [realia('realia:c')])], { status: 'ready' }),
      'content/packs/p/stage-7.json': level(7, { rewardCardIds: ['card:p-2'], packCheck: { items: 8 } }),
    };
    // No level is listed, so every level file is a stray.
    expect(rows(lint(files), 'pack-skeleton')).toEqual([
      'pack-skeleton error content/packs/p/pack.json key',
      'pack-skeleton error content/packs/p/pack.json status',
      'pack-skeleton error content/packs/p/pack.json levels',
      ...[2, 3, 4, 6, 7].map((n) => `pack-skeleton error content/packs/p/stage-${n}.json (root)`),
    ]);
    files['content/packs/p/pack.json'] = {
      id: 'pack:p',
      key: 'p',
      status: 'ready',
      levels: [2, 3, 4, 6, 7].map((n) => ({ stage: `stage${n}`, episodeId: `episode:pack-p-s${n}` })),
    };
    const ready = rows(lint(files), 'pack-skeleton');
    // The three realia of L4 come from its Discover pages; L2, L3 and L5 quests teach no pattern, exchange or frame.
    expect(ready).not.toContain('pack-skeleton error content/packs/p/stage-6.json quests');
    expect(ready).toContain('pack-skeleton error content/packs/p/stage-7.json packCheck');
    expect(ready.filter((r) => /stage-[347]\.json quests\[\d\]$/.test(r))).toHaveLength(9);
    files['content/packs/p/stage-7.json'] = level(7, { rewardCardIds: ['card:p-2'] });
    expect(rows(lint(files), 'pack-skeleton')).toContain('pack-skeleton error content/packs/p/stage-7.json packCheck');
    // A level file that is not a lesson body is lesson-schema's, not a missing level.
    files['content/packs/p/stage-7.json'] = { not: 'a body' };
    expect(rows(lint(files), 'pack-skeleton')).not.toContain('pack-skeleton error content/packs/p/pack.json levels[4]');
    expect(rows(lint(files), 'lesson-schema')).toEqual(['lesson-schema error content/packs/p/stage-7.json id']);
    // A ready pack names every level file it lists.
    delete files['content/packs/p/stage-7.json'];
    expect(rows(lint(files), 'pack-skeleton')).toContain('pack-skeleton error content/packs/p/pack.json levels[4]');
    // A pack with more levels than the template, or a level not of the template, is reported on the manifest.
    files['content/packs/p/pack.json'] = { id: 'pack:p', key: 'p', status: 'draft', levels: [...Array(6)].map(() => ({ stage: 'stage5' })) };
    expect(rows(lint(files), 'pack-skeleton').filter((r) => r.includes('pack.json'))).toEqual([
      'pack-skeleton error content/packs/p/pack.json levels',
      ...[0, 1, 2, 3, 4, 5].map((i) => `pack-skeleton error content/packs/p/pack.json levels[${i}]`),
    ]);
    // A ready pack lists all five levels; a level that is not an object is not a template row.
    files['content/packs/p/pack.json'] = { id: 'pack:p', key: 'p', status: 'ready', levels: [{ stage: 'stage2', episodeId: 'episode:pack-p-s2' }, 'stage3'] };
    expect(rows(lint(files), 'pack-skeleton').filter((r) => r.includes('pack.json'))).toEqual([
      'pack-skeleton error content/packs/p/pack.json levels',
      'pack-skeleton error content/packs/p/pack.json levels[1]',
    ]);
  });

  it('checks only the ids of a draft pack level, and runs no content rule on it', () => {
    const scaffold = body('episode:pack-p-s2', 2, [q('quest:pack-p-s2-q1', [step('intro')]), q('quest:wrong', [step('intro')])], { status: 'draft', culture: [] });
    const files = {
      'content/packs/p/pack.json': { id: 'pack:p', key: 'p', status: 'draft', levels: [{ stage: 'stage2', episodeId: 'episode:pack-p-s2' }] },
      'content/packs/p/stage-2.json': scaffold,
    };
    expect(rows(lint(files))).toEqual(['pack-skeleton error content/packs/p/stage-2.json quests[1].id']);
  });

  it('runs the F-CURR-001 note, speaking, review and number rules on Volume 2 cells and ready pack levels, as errors', () => {
    const verification = { passes: 3, checkedAt: '2026-10-13', scope: 'lesson', notes: 'pass 1; pass 2; pass 3' };
    const src = (url: string, accessed = '2026-10-13') => ({ title: 'Entry', publisher: 'National Folk Museum of Korea', url, accessed, quoteOrLocator: 'entry 1' });
    const notes = [
      { id: 'n1', kind: 'culture', textEn: 'A note.', sources: [src('http://www.nfm.go.kr/a'), src('https://unlisted.example/b', '2026-12-01')], verification },
      { id: 'n2', kind: 'culture', textEn: 'A note.', factRef: 'story:missing#f1', verification },
      { id: 'n3', kind: 'culture', textEn: 'A note.', verification },
      { id: 'n4', kind: 'culture', textEn: 'A note.', sources: [src('https://www.nfm.go.kr/a'), src('https://folkency.nfm.go.kr/b')], verification: { ...verification, passes: 1 } },
      { id: 'n5', textEn: 'No verification.' },
    ];
    const quest = q('quest:a', [step('intro', { titleEn: 'National Treasure No. 70' }), step('apply', { minigameKind: 'voice-echo' })], [{ ref: 'm:v', kind: 'voice-echo' }]);
    const cell = (extra: Json) => body('episode:stage2-nature-v2', 2, [quest], { volume: 2, culture: notes, ...extra });
    const F001 = /^lesson-(?!schema)|^lesson-schema/;
    const found = (files: Record<string, unknown>) =>
      lintCurriculum(new Map(Object.entries(files)), { today: '2026-10-21' })
        .filter((f) => F001.test(f.rule) && !['lesson-new-load', 'lesson-recycle', 'lesson-check-variety', 'lesson-culture-coverage'].includes(f.rule))
        .map((f) => `${f.rule} ${f.severity} ${f.path}`);
    expect(found({ 'content/episodes/stage-2/nature.v2.json': cell({ status: 'ready', review: { language: 'native-reviewed', culture: 'draft' } }) })).toEqual([
      'lesson-unsourced-note error culture[2].sources',
      'lesson-schema error culture[4].verification',
      'lesson-source-shape error culture[0].sources[0].url',
      'lesson-source-shape error culture[0].sources[1].url',
      'lesson-source-shape error culture[0].sources[1].accessed',
      'lesson-factref-unknown error culture[1].factRef',
      'lesson-verification-passes error culture[3].verification.passes',
      'lesson-no-speaking error quests[0].steps[1].minigameKind',
      'lesson-no-speaking error quests[0].scopes[0].kind',
      'lesson-review-unsigned error review',
      'lesson-national-treasure-number error quests[0].steps[0].titleEn',
    ]);
    // A draft file is not held to the sign-offs or the verification passes; with no today, no date is in the future.
    const draft = lintCurriculum(new Map([['content/episodes/stage-2/nature.v2.json', cell({ status: 'draft' })]])).map((f) => `${f.rule} ${f.path}`);
    expect(draft).not.toContain('lesson-review-unsigned review');
    expect(draft).not.toContain('lesson-verification-passes culture[3].verification.passes');
    expect(draft).not.toContain('lesson-source-shape culture[0].sources[1].accessed');
    // Volume 1 is left to lintLessonCell; a draft pack level waits for its content.
    const v1 = lintCurriculum(new Map([['content/episodes/stage-2/nature.json', { ...cell({}), id: 'episode:stage2-nature', volume: 1 }]]));
    expect(v1.filter((f) => f.rule === 'lesson-no-speaking')).toEqual([]);
    const ok = { ...cell({ status: 'ready', review: { language: 'native-reviewed', culture: 'culture-reviewed', reviewedBy: 'MAR', reviewedAt: '2026-10-20' } }), culture: [] };
    expect(found({ 'content/episodes/stage-2/nature.v2.json': ok })).not.toContain('lesson-review-unsigned error review');
  });

  it('reads the Spanish and Korean overlays of new entries only, skipping what is not a string', () => {
    const v2 = body('episode:stage2-nature-v2', 2, [q('quest:stage2-nature-v2-q1', [step('intro')], [{ ref: 'minigame:s2-nature-v2-q1-check', kind: 'type-hangul' }])], { volume: 2 });
    const files = {
      'content/episodes/stage-2/nature.v2.json': v2,
      'content/stories/fixture-new.json': { id: 'story:fixture-new', topicTags: ['fixture-new'] },
      'content/i18n/es/lessons.json': {
        entries: {
          'minigame:s2-nature-v2-q1-check': { prompt: 'para niños', count: 3 },
          'story:fixture-new': { title: '⭐' },
          'quest:stage2-nature-v2-q1': 'not an object',
          'episode:stage2-nature': { title: '⭐' },
        },
      },
      'content/i18n/ko/broken.json': [],
      'content/i18n/README.json': { entries: { 'story:fixture-new': { title: '⭐' } } },
    };
    expect(rows(lint(files), 'review-copy')).toEqual([
      'review-copy error content/i18n/es/lessons.json entries.minigame:s2-nature-v2-q1-check.prompt',
      'review-copy error content/i18n/es/lessons.json entries.story:fixture-new.title',
    ]);
  });

  it('does not take an empty gloss as shown in a Dictation prompt', () => {
    const teach = q('quest:t', [discover({ type: 'word', word: kt('낫') }, { type: 'word', word: kt('낮') })]);
    const hear = q('quest:h', [step('intro')], [{ ref: 'm:c', kind: 'type-hangul', rounds: [{ mode: 'hear', promptEn: 'Type it.', target: { ko: '낫', romanization: 'nat', en: ' ' } }] }]);
    const files = { 'content/episodes/stage-2/nature.v2.json': body('episode:stage2-nature-v2', 2, [teach, hear], { volume: 2 }) };
    expect(rows(lint(files), 'dictation-unambiguous')).toEqual(['dictation-unambiguous error content/episodes/stage-2/nature.v2.json quests[1].scopes[0].rounds[0]']);
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
      // c declares no topicTags (a non-string tag of b is skipped, its string tag kept).
      'story-topic-unique error content/stories/c.json topicTags',
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
