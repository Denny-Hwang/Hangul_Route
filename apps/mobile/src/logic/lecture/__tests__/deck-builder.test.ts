import {
  LectureDeckSchema,
  type Episode,
  type HeritageCard,
  type LectureDeckInput,
  type Quest,
  type QuestStep,
} from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { heritageCardsAll, jamoAll } from '../../../content';
import type { MinigameScope } from '../../minigame-config';
import {
  expandDeck,
  withBuilds,
  type LectureBundle,
  type LectureStory,
  type LectureVocabTopic,
  type Slide,
} from '../deck-builder';

// ---- fixtures ---------------------------------------------------------------

const J = (id: string): string => `jamo:${id}`;
const pairs4 = [
  { ko: '김치', en: 'Kimchi', romanization: 'gimchi' },
  { ko: '밥', en: 'Rice', romanization: 'bap' },
  { ko: '물', en: 'Water', romanization: 'mul' },
  { ko: '산', en: 'Mountain', romanization: 'san' },
];

const scopes: Record<string, MinigameScope> = {
  'mg:present': { kind: 'match-sound', jamoIds: [J('giyeok'), J('nieun'), J('digeut'), J('rieul')], rounds: 4 },
  'mg:match': { kind: 'match-sound', jamoIds: [J('giyeok'), J('nieun'), J('digeut'), J('rieul')], rounds: 3 },
  'mg:build': {
    kind: 'build-letter',
    syllables: [
      { ko: '가', romanization: 'ga', jamoChars: ['ㄱ', 'ㅏ'] },
      { ko: '물', romanization: 'mul', jamoChars: ['ㅁ', 'ㅜ', 'ㄹ'], jamoIds: [J('mieum'), J('u'), J('rieul-batchim')] },
    ],
  },
  'mg:trace': { kind: 'trace-stroke', jamoIds: [J('mieum'), J('bieup')], rounds: 2 },
  'mg:cards': { kind: 'card-match', cardPairs: [{ ko: '김치', en: 'Kimchi', romanization: 'gimchi' }, { ko: '밥', en: 'Rice' }] },
  'mg:sequence': {
    kind: 'story-sequence',
    storySteps: [
      { id: 'a', labelEn: 'Wash hands', labelKo: '손 씻기', romanization: 'son ssitgi' },
      { id: 'b', labelEn: 'Set the table', labelKo: '상 차리기', romanization: 'sang charigi' },
      { id: 'c', labelEn: 'Eat together' },
    ],
  },
  'mg:sequence-norom': { kind: 'story-sequence', storySteps: [{ id: 'a', labelEn: 'Wash hands', labelKo: '손 씻기' }] },
  'mg:quiz': { kind: 'culture-quiz', cardPairs: pairs4, rounds: 2 },
  'mg:quiz-norom': { kind: 'culture-quiz', cardPairs: [...pairs4.slice(0, 3), { ko: '달', en: 'Moon' }], rounds: 4 },
  'mg:quiz-small': { kind: 'culture-quiz', cardPairs: pairs4.slice(0, 2), rounds: 2 },
  'mg:odd': { kind: 'odd-one-out', jamoIds: [J('giyeok'), J('nieun'), J('digeut'), J('a')], rounds: 2 },
  'mg:respond': { kind: 'tap-respond' },
  'mg:small': { kind: 'match-sound', jamoIds: [J('giyeok'), J('nieun')], rounds: 2 },
  'mg:bare': { kind: 'card-match' },
  'mg:block': { kind: 'build-letter', syllables: [{ ko: 'ㄱㅏ', romanization: 'ga', jamoChars: ['ㄱ', 'ㅏ'] }] },
  'mg:story-read': { kind: 'story-read', story: { storyId: 'story:sun-moon', level: 'listen' } },
  'mg:story-check': { kind: 'story-check', story: { storyId: 'story:sun-moon', level: 'listen' } },
};

type StepSpec = [QuestStep['kind'], string?];
const quest = (slug: string, steps: StepSpec[], extra: Partial<Quest> = {}): Quest => ({
  id: `quest:${slug}`,
  titleEn: `Quest ${slug}`,
  estimatedMinutes: 4,
  steps: steps.map(([kind, ref], i) => ({
    id: `s${i + 1}`,
    kind,
    titleEn: 'Step',
    ...(kind === 'intro' ? { hoyaLineEn: 'Hello from Hoya' } : {}),
    ...(ref ? { minigameKind: scopes[ref]?.kind ?? 'match-sound', minigameRef: ref } : {}),
  })),
  rewardCardId: 'card:book',
  ...extra,
});

const quests: Quest[] = [
  quest('letters', [['intro'], ['present', 'mg:present'], ['practice', 'mg:match'], ['apply', 'mg:build'], ['reward']]),
  quest('again', [['intro'], ['present', 'mg:present'], ['practice', 'mg:trace'], ['reward']], { rewardCardId: undefined }),
  quest('words', [['intro'], ['present', 'mg:cards'], ['practice', 'mg:quiz'], ['apply', 'mg:sequence'], ['reward']], {
    rewardCardId: 'card:nope',
  }),
  quest('odd', [['present', 'mg:odd'], ['practice', 'mg:respond'], ['apply', 'mg:missing']]),
  quest('small', [['present', 'mg:small'], ['practice', 'mg:small'], ['apply', 'mg:quiz-small']]),
  quest('norom', [['practice', 'mg:quiz-norom'], ['apply', 'mg:sequence-norom']]),
  quest('bare', [['present', 'mg:bare'], ['apply', 'mg:block'], ['reward']], { rewardCardId: 'card:plain' }),
  quest('story', [['intro'], ['present', 'mg:story-read'], ['practice', 'mg:story-check'], ['reward']]),
];

const episode = (slug: string, questIds: string[], extra: Partial<Episode> = {}): Episode => ({
  id: `episode:${slug}`,
  stage: 'stage1',
  theme: 'letters',
  order: 1,
  titleEn: `Episode ${slug}`,
  subtitleEn: 'A subtitle',
  hoyaIntroEn: 'Hi, I am Hoya.',
  questIds,
  rewardCardIds: [],
  estimatedMinutes: 10,
  status: 'shipped',
  format: 'lesson',
  placement: 'grid',
  volume: 1,
  pillarTags: [],
  companionId: 'hoya',
  ...extra,
});

const episodes: Episode[] = [
  episode('first', ['quest:letters', 'quest:words', 'quest:gone']),
  episode('soon', ['quest:letters'], { status: 'preview' }),
  episode('empty', []),
  episode('shelf-sun-moon', ['quest:story'], { format: 'story', storyIds: ['story:sun-moon'] }),
  episode('book', ['quest:story'], { format: 'story', subtitleEn: undefined }),
];

const scene = (id: string, over: Partial<LectureStory['tiers'][number]['scenes'][number]> = {}) => ({
  id,
  narrationEn: `Scene ${id} with the {kw:sun}.`,
  captionEn: `Caption ${id}`,
  ...over,
});
const sunMoon: LectureStory = {
  id: 'story:sun-moon',
  title: { ko: '해와 달', romanization: 'haewa dal', en: 'The Sun and the Moon' },
  hoyaIntroEn: 'A story about the sky.',
  coverSceneId: 's1',
  keywords: [
    { id: 'sun', ko: '해', romanization: 'hae', en: 'sun' },
    { id: 'moon', ko: '달', romanization: 'dal', en: 'moon' },
  ],
  tiers: [
    {
      level: 'read',
      scenes: [scene('s1'), scene('s2'), scene('s3'), scene('s4')],
      checks: [],
      sequenceSceneIds: ['s1', 's2', 's3', 's4'],
    },
    {
      level: 'listen',
      scenes: [
        scene('s1', { keyword: { id: 'sun', ko: '해', romanization: 'hae', en: 'sun' } }),
        scene('s2', { line: { ko: '달이 떴다', romanization: 'dari tteotda', en: 'The moon rose' }, narrationEn: 'Night came.' }),
        scene('s3'),
        scene('s4'),
      ],
      checks: [
        {
          id: 'c1',
          kind: 'pick-meaning',
          promptEn: 'What does {target} mean?',
          target: { ko: '해', romanization: 'hae', en: 'sun' },
          options: [
            { id: 'a', en: 'sun', isCorrect: true },
            { id: 'b', en: 'moon', isCorrect: false },
            { id: 'c', ko: '달', romanization: 'dal', en: 'moon', isCorrect: false },
          ],
          explainEn: 'Hae is the sun.',
        },
        {
          id: 'c2',
          kind: 'true-false',
          promptEn: 'The moon rose at night.',
          options: [
            { id: 't', en: 'True', isCorrect: true },
            { id: 'f', en: 'False', isCorrect: false },
          ],
        },
        {
          id: 'c3',
          kind: 'pick-picture',
          promptEn: 'Which one is the moon?',
          options: [
            { id: 'a', en: 'sun', art: 'prop:sun', isCorrect: false },
            { id: 'b', en: 'moon', art: 'prop:moon', isCorrect: true },
          ],
          shuffle: false,
        },
      ],
      sequenceSceneIds: ['s4', 's3', 's2', 's1'],
    },
  ],
};
const brokenStory: LectureStory = { ...sunMoon, id: 'story:broken', tiers: [{ ...sunMoon.tiers[0]!, scenes: [scene('s1', { narrationEn: 'A {kw:nothing} here.' })] }] };
const noCaption: LectureStory = {
  ...sunMoon,
  hoyaIntroEn: undefined,
  id: 'story:no-caption',
  tiers: [{ ...sunMoon.tiers[0]!, scenes: [scene('s1'), scene('s2', { captionEn: undefined })], sequenceSceneIds: ['s1', 's2'] }],
};

const topic: LectureVocabTopic = {
  title: 'Food',
  hoyaLine: 'Let us eat!',
  words: [
    { id: 'vocab:gimchi', ko: '김치', romanization: 'gimchi', gloss: 'kimchi', cardId: 'card:kimchi' },
    { id: 'vocab:bap', ko: '밥', romanization: 'bap', gloss: 'rice' },
    { id: 'vocab:mul', ko: '물', romanization: 'mul', gloss: 'water' },
    { id: 'vocab:san', ko: '산', romanization: 'san', gloss: 'mountain' },
  ],
};

const bundle = (over: Partial<LectureBundle> = {}): LectureBundle => ({
  jamoAll,
  scopeFor: (ref) => scopes[ref],
  questById: (id) => quests.find((q) => q.id === id),
  episodeById: (id) => episodes.find((e) => e.id === id),
  cardById: (id): HeritageCard | undefined => {
    if (id === 'card:plain') return { ...heritageCardsAll[0]!, id, titleEn: 'Plain', subtitleKo: undefined, romanization: undefined, factEn: undefined };
    if (id === 'card:norom') return { ...heritageCardsAll[0]!, id, romanization: undefined };
    return heritageCardsAll.find((c) => c.id === id);
  },
  hasStrokes: (id) => id !== J('ieung'),
  strokeReviewed: (id) => id === J('giyeok'),
  story: (id) => {
    if (id === 'story:draft') return 'not-ready';
    if (id === 'story:no-tiers') return { ...sunMoon, id, tiers: [] };
    return [sunMoon, brokenStory, noCaption].find((s) => s.id === id);
  },
  vocabTopic: (id) => (id === 'vocab-topic:food' ? topic : undefined),
  ...over,
});

const VOICE = { canPlayKorean: true };

const deckOf = (blocks: LectureDeckInput['blocks'], over: Partial<LectureDeckInput> = {}) =>
  LectureDeckSchema.parse({ v: 1, id: 'lecture:abc123', title: 'Lesson', createdAt: '2026-10-11T09:00:00Z', seed: 42, blocks, ...over });

const expand = (blocks: LectureDeckInput['blocks'], over: Partial<LectureDeckInput> = {}, b: LectureBundle = bundle(), voice = VOICE) =>
  expandDeck(deckOf(blocks, over), b, voice);

const kinds = (slides: readonly Slide[]): string[] => slides.map((s) => s.kind);
const keys = (slides: readonly Slide[]): string[] => slides.map((s) => s.key);
const only = <K extends Slide['kind']>(slides: readonly Slide[], kind: K) =>
  slides.filter((s): s is Extract<Slide, { kind: K }> => s.kind === kind);

// ---- tests --------------------------------------------------------------------

describe('expandDeck: quests (F-TCH-004 §3.3 rule 2)', () => {
  it('title, a letter per presented jamo, quiz rounds, syllables, the reward card, then End', () => {
    const { slides, skipped, minutes } = expand([{ kind: 'quest', id: 'quest:letters' }]);
    expect(kinds(slides)).toEqual([
      'title',
      'letter', 'letter', 'letter', 'letter',
      'quiz', 'quiz', 'quiz',
      'syllable', 'syllable',
      'card',
      'end',
    ]);
    expect(keys(slides).slice(0, 2)).toEqual(['quest:letters/title', 'quest:letters/s2/jamo:giyeok']);
    expect(slides[5]!.key).toBe('quest:letters/s3/q1');
    expect(slides[8]!.key).toBe('quest:letters/s4/가');
    expect(slides[10]!.key).toBe('quest:letters/s5/card:book');
    expect(slides[11]!.key).toBe('end');
    expect(new Set(keys(slides)).size).toBe(slides.length);
    expect(skipped).toEqual([]);
    expect(minutes).toBe(4 + 3);
  });

  it('the title slide carries the quest title and the intro line', () => {
    const [title] = expand([{ kind: 'quest', id: 'quest:letters' }]).slides;
    expect(title).toMatchObject({ kind: 'title', source: 'quest', title: 'Quest letters', line: 'Hello from Hoya' });
  });

  it('a letter slide is the glyph, its sound, name, example word and stroke caption state', () => {
    const letter = only(expand([{ kind: 'quest', id: 'quest:letters' }]).slides, 'letter')[0]!;
    expect(letter).toMatchObject({
      jamoId: 'jamo:giyeok',
      char: 'ㄱ',
      romanization: 'g/k',
      nameEn: 'giyeok',
      ipa: 'k',
      spoken: { text: '가', romanization: 'ga' },
      example: { ko: '가족', romanization: 'gajok', gloss: 'family' },
      hasStrokes: true,
      strokeReviewed: true,
      builds: ['ko', 'stroke', 'sound', 'name', 'example'],
    });
  });

  it('carries the jamo sound hint when the content has one', () => {
    const withHint = jamoAll.map((j) => (j.id === J('nieun') ? { ...j, soundHint: 'like n in no' } : j));
    const letters = only(expand([{ kind: 'jamo-set', jamoIds: [J('nieun'), J('ieung')] }], {}, bundle({ jamoAll: withHint })).slides, 'letter');
    expect(letters[0]!.soundHint).toBe('like n in no');
    expect(letters[1]).toMatchObject({ hasStrokes: false, strokeReviewed: false, builds: ['ko', 'sound', 'name', 'example'] });
  });

  it('quiz rounds are min(options.quizRounds, scope.rounds); match-sound prompts with the carrier sound', () => {
    const quiz = only(expand([{ kind: 'quest', id: 'quest:letters' }], { options: { quizRounds: 2 } }).slides, 'quiz');
    expect(quiz).toHaveLength(2);
    const first = quiz[0]!;
    expect(first.prompt.ask).toBe('sound');
    expect(first.options).toHaveLength(4);
    expect(first.options.filter((o) => o.correct)).toHaveLength(1);
    const answer = first.options.find((o) => o.correct)!;
    expect(first.prompt).toEqual({ ask: 'sound', spoken: expect.objectContaining({ text: expect.any(String) }) });
    const jamo = jamoAll.find((j) => j.char === answer.ko && j.kind === 'consonant')!;
    expect(first.prompt.ask === 'sound' && first.prompt.spoken.text).toBe(jamo.spokenKo);
    expect(answer.romanization).toBe(jamo.romanization);
    expect(first.textPrompt).toBe(false);
    expect(first.builds).toEqual(['question', 'answer']);
  });

  it('without a Korean voice, or with sound off, Match Sound becomes the text prompt', () => {
    const noVoice = only(expand([{ kind: 'quest', id: 'quest:letters' }], {}, bundle(), { canPlayKorean: false }).slides, 'quiz');
    expect(noVoice.every((q) => q.textPrompt)).toBe(true);
    const muted = only(expand([{ kind: 'quest', id: 'quest:letters' }], { options: { sound: false } }).slides, 'quiz');
    expect(muted.every((q) => q.textPrompt)).toBe(true);
  });

  it('syllables: parts, the joined block, the teaching split and its sound', () => {
    const syllables = only(expand([{ kind: 'quest', id: 'quest:letters' }]).slides, 'syllable');
    expect(syllables[0]).toMatchObject({ ko: '가', romanization: 'ga', split: 'ga', parts: ['ㄱ', 'ㅏ'], spoken: { text: '가', romanization: 'ga' } });
    expect(syllables[1]).toMatchObject({ ko: '물', parts: ['ㅁ', 'ㅜ', 'ㄹ'] });
  });

  it('the reward card shows its art, title, Korean and fact', () => {
    const [card] = only(expand([{ kind: 'quest', id: 'quest:letters' }]).slides, 'card');
    const book = heritageCardsAll.find((c) => c.id === 'card:book')!;
    expect(card).toMatchObject({ cardId: 'card:book', title: book.titleEn, ko: book.subtitleKo, romanization: book.romanization, fact: book.factEn });
  });

  it('letters appear once per deck; trace-stroke adds letter slides; a quest without a reward card has none', () => {
    const { slides } = expand([
      { kind: 'quest', id: 'quest:letters' },
      { kind: 'quest', id: 'quest:again' },
    ]);
    const letters = only(slides, 'letter').map((l) => l.jamoId);
    expect(letters).toEqual([J('giyeok'), J('nieun'), J('digeut'), J('rieul'), J('mieum'), J('bieup')]);
    expect(keys(slides).filter((k) => k.startsWith('quest:again/'))).toEqual([
      'quest:again/title',
      'quest:again/s3/jamo:mieum',
      'quest:again/s3/jamo:bieup',
    ]);
  });

  it('card-match -> vocab slides, culture-quiz -> meaning quiz, story-sequence -> one sequence slide', () => {
    const { slides, skipped } = expand([{ kind: 'quest', id: 'quest:words' }]);
    expect(kinds(slides)).toEqual(['title', 'vocab', 'quiz', 'quiz', 'sequence', 'end']);
    expect(only(slides, 'vocab')[0]).toMatchObject({ key: 'quest:words/s2/김치', word: { ko: '김치', romanization: 'gimchi', gloss: 'Kimchi' } });
    const quiz = only(slides, 'quiz')[0]!;
    expect(quiz.prompt.ask).toBe('meaning');
    expect(quiz.options.every((o) => o.gloss !== undefined)).toBe(true);
    const sequence = only(slides, 'sequence')[0]!;
    expect(sequence.steps).toEqual([
      { id: 'a', gloss: 'Wash hands', ko: '손 씻기', romanization: 'son ssitgi' },
      { id: 'b', gloss: 'Set the table', ko: '상 차리기', romanization: 'sang charigi' },
      { id: 'c', gloss: 'Eat together' },
    ]);
    expect([...sequence.shuffled].sort()).toEqual(['a', 'b', 'c']);
    expect(sequence.shuffled).not.toEqual(['a', 'b', 'c']);
    expect(sequence.builds).toEqual(['step', 'step', 'step', 'order']);
    expect(skipped).toEqual([
      { blockIndex: 0, ref: 'quest:words/s2/밥', reason: 'no-romanization' },
      { blockIndex: 0, ref: 'card:nope', reason: 'unknown-id' },
    ]);
  });

  it('odd-one-out -> quiz; unsupported kinds and unknown refs are counted skips, never a crash', () => {
    const { slides, skipped } = expand([{ kind: 'quest', id: 'quest:odd' }]);
    const quiz = only(slides, 'quiz');
    expect(quiz).toHaveLength(2);
    expect(quiz[0]!.prompt).toEqual({ ask: 'odd-one-out' });
    expect(quiz[0]!.options.filter((o) => o.correct)).toEqual([expect.objectContaining({ ko: 'ㅏ', romanization: 'a' })]);
    expect(skipped).toEqual([
      { blockIndex: 0, ref: 'mg:respond', reason: 'unsupported-step' },
      { blockIndex: 0, ref: 'mg:missing', reason: 'unknown-id' },
    ]);
  });

  it('a builder that throws on a small scope becomes scope-too-small and the slide is left out', () => {
    const { slides, skipped } = expand([{ kind: 'quest', id: 'quest:small' }]);
    expect(only(slides, 'quiz')).toEqual([]);
    expect(only(slides, 'letter')).toHaveLength(2);
    expect(skipped).toEqual([
      { blockIndex: 0, ref: 'mg:small', reason: 'scope-too-small' },
      { blockIndex: 0, ref: 'mg:quiz-small', reason: 'scope-too-small' },
    ]);
  });

  it('Korean with no romanization never reaches a slide (CLAUDE.md §1)', () => {
    const { slides, skipped } = expand([{ kind: 'quest', id: 'quest:norom' }]);
    expect(only(slides, 'quiz')).toHaveLength(3);
    expect(only(slides, 'sequence')).toEqual([]);
    expect(skipped.map((s) => s.reason)).toEqual(['no-romanization', 'no-romanization']);
    expect(skipped[1]!.ref).toBe('mg:sequence-norom');
  });

  it('a scope without its list adds nothing; a syllable that is not one Hangul block keeps its romanization', () => {
    const { slides, skipped } = expand([{ kind: 'quest', id: 'quest:bare' }]);
    expect(kinds(slides)).toEqual(['title', 'syllable', 'card', 'end']);
    expect(only(slides, 'syllable')[0]).toMatchObject({ ko: 'ㄱㅏ', split: 'ga' });
    expect(skipped).toEqual([]);
  });

  it('a card without Korean or a fact shows its art and title only; Korean without romanization is skipped', () => {
    const { slides, skipped, taught } = expand([{ kind: 'cards', cardIds: ['card:plain', 'card:norom'] }]);
    const [plain] = only(slides, 'card');
    expect(plain).toEqual({ kind: 'card', key: 'cards/card:plain', cardId: 'card:plain', title: 'Plain', builds: ['art'] });
    expect(skipped).toEqual([{ blockIndex: 0, ref: 'card:norom', reason: 'no-romanization' }]);
    expect(taught).toEqual([]);
  });

  it('an unknown quest is a counted skip', () => {
    const { slides, skipped } = expand([
      { kind: 'quest', id: 'quest:nope' },
      { kind: 'quest', id: 'quest:letters' },
    ]);
    expect(skipped).toEqual([{ blockIndex: 0, ref: 'quest:nope', reason: 'unknown-id' }]);
    expect(slides[0]!.key).toBe('quest:letters/title');
  });
});

describe('expandDeck: episodes (rule 1)', () => {
  it('a title slide, then each quest in questIds order; an unknown quest is skipped', () => {
    const { slides, skipped, minutes } = expand([{ kind: 'episode', id: 'episode:first' }]);
    expect(slides[0]).toMatchObject({ kind: 'title', source: 'episode', key: 'episode:first/title', title: 'Episode first', subtitle: 'A subtitle', line: 'Hi, I am Hoya.' });
    const titles = only(slides, 'title').map((t) => t.key);
    expect(titles).toEqual(['episode:first/title', 'episode:first/quest:letters/title', 'episode:first/quest:words/title']);
    expect(slides[2]!.key).toBe('episode:first/quest:letters/s2/jamo:giyeok');
    expect(skipped).toContainEqual({ blockIndex: 0, ref: 'quest:gone', reason: 'unknown-id' });
    expect(minutes).toBe(4 + 4 + 3 + 2);
  });

  it('a preview episode, an episode with no quests and an unknown episode are skipped', () => {
    const { slides, skipped } = expand([
      { kind: 'episode', id: 'episode:soon' },
      { kind: 'episode', id: 'episode:empty' },
      { kind: 'episode', id: 'episode:nope' },
      { kind: 'jamo-set', jamoIds: [J('a')] },
    ]);
    expect(skipped).toEqual([
      { blockIndex: 0, ref: 'episode:soon', reason: 'not-ready' },
      { blockIndex: 1, ref: 'episode:empty', reason: 'not-ready' },
      { blockIndex: 2, ref: 'episode:nope', reason: 'unknown-id' },
    ]);
    expect(kinds(slides)).toEqual(['letter', 'end']);
  });

  it('a story episode with storyIds expands its title slide and each story', () => {
    const { slides } = expand([{ kind: 'episode', id: 'episode:shelf-sun-moon' }]);
    expect(keys(slides).slice(0, 3)).toEqual([
      'episode:shelf-sun-moon/title',
      'episode:shelf-sun-moon/story:sun-moon/title',
      'episode:shelf-sun-moon/story:sun-moon/s1',
    ]);
    expect(only(slides, 'title')).toHaveLength(2);
  });

  it('a story episode without storyIds plays its quests, whose story steps expand the story once per quest', () => {
    const { slides } = expand([{ kind: 'episode', id: 'episode:book' }]);
    const storyTitles = only(slides, 'title').filter((t) => t.source === 'story');
    expect(storyTitles.map((t) => t.key)).toEqual(['episode:book/quest:story/story:sun-moon/title']);
    expect(slides[0]).not.toHaveProperty('subtitle');
    expect(only(slides, 'card')).toHaveLength(1);
  });
});

describe('expandDeck: stories (rule 5, D14)', () => {
  it('title with the cover, one slide per scene of the lowest tier, the order slide, then the checks', () => {
    const { slides } = expand([{ kind: 'story', storyId: 'story:sun-moon' }]);
    expect(kinds(slides)).toEqual(['title', 'story', 'story', 'story', 'story', 'sequence', 'quiz', 'quiz', 'quiz', 'end']);
    expect(slides[0]).toMatchObject({ source: 'story', title: 'The Sun and the Moon', line: 'A story about the sky.', cover: { storyId: 'story:sun-moon', sceneId: 's1' } });
  });

  it('story slides carry only the story own fields', () => {
    const stories = only(expand([{ kind: 'story', storyId: 'story:sun-moon' }]).slides, 'story');
    expect(stories[0]).toMatchObject({
      storyId: 'story:sun-moon',
      sceneId: 's1',
      narration: [{ text: 'Scene s1 with the ' }, { ko: '해', romanization: 'hae', gloss: 'sun' }, { text: '.' }],
      korean: { ko: '해', romanization: 'hae', gloss: 'sun' },
      caption: 'Caption s1',
      builds: ['art', 'narration', 'korean'],
    });
    expect(stories[1]).toMatchObject({ narration: [{ text: 'Night came.' }], korean: { ko: '달이 떴다', romanization: 'dari tteotda', gloss: 'The moon rose' } });
    expect(stories[2]!.korean).toBeUndefined();
  });

  it('the order slide uses the tier sequence scenes, their captions and Korean', () => {
    const [sequence] = only(expand([{ kind: 'story', storyId: 'story:sun-moon' }]).slides, 'sequence');
    expect(sequence!.steps.map((s) => s.id)).toEqual(['s4', 's3', 's2', 's1']);
    expect(sequence!.steps[2]).toEqual({ id: 's2', gloss: 'Caption s2', ko: '달이 떴다', romanization: 'dari tteotda' });
  });

  it('checks become quiz slides with the story own prompt, options and explanation', () => {
    const quiz = only(expand([{ kind: 'story', storyId: 'story:sun-moon' }]).slides, 'quiz');
    expect(quiz[0]!.prompt).toEqual({ ask: 'check', text: 'What does {target} mean?', target: { ko: '해', romanization: 'hae', gloss: 'sun' } });
    expect(quiz[0]!.explain).toBe('Hae is the sun.');
    expect(quiz[0]!.options).toHaveLength(3);
    expect(quiz[0]!.options).toContainEqual({ ko: '달', romanization: 'dal', gloss: 'moon', correct: false });
    expect(quiz[1]!.options).toEqual([
      { gloss: 'True', correct: true },
      { gloss: 'False', correct: false },
    ]);
    expect(quiz[2]!.options).toEqual([
      { gloss: 'sun', art: 'prop:sun', correct: false },
      { gloss: 'moon', art: 'prop:moon', correct: true },
    ]);
    expect(quiz[1]!.prompt).toEqual({ ask: 'check', text: 'The moon rose at night.' });
  });

  it('checks: false leaves the checks out; a chosen level picks that tier', () => {
    expect(only(expand([{ kind: 'story', storyId: 'story:sun-moon', checks: false }]).slides, 'quiz')).toEqual([]);
    const read = expand([{ kind: 'story', storyId: 'story:sun-moon', level: 'read' }]).slides;
    expect(only(read, 'story')[0]!.korean).toBeUndefined();
    const missing = expand([{ kind: 'story', storyId: 'story:sun-moon', level: 'read-along' }]).slides;
    expect(only(missing, 'quiz')).toHaveLength(3);
  });

  it('no story source, a draft, an unknown id or a broken narration token are counted skips', () => {
    const noSource = bundle();
    delete noSource.story;
    expect(expand([{ kind: 'story', storyId: 'story:sun-moon' }], {}, noSource).skipped).toEqual([
      { blockIndex: 0, ref: 'story:sun-moon', reason: 'not-ready' },
    ]);
    const { skipped } = expand([
      { kind: 'story', storyId: 'story:draft' },
      { kind: 'story', storyId: 'story:nope' },
      { kind: 'story', storyId: 'story:broken' },
      { kind: 'story', storyId: 'story:no-tiers' },
    ]);
    expect(skipped).toEqual([
      { blockIndex: 0, ref: 'story:draft', reason: 'not-ready' },
      { blockIndex: 1, ref: 'story:nope', reason: 'unknown-id' },
      { blockIndex: 2, ref: 'story:broken', reason: 'not-ready' },
      { blockIndex: 3, ref: 'story:no-tiers', reason: 'not-ready' },
    ]);
  });

  it('a sequence scene without a caption, or missing, leaves the order slide out', () => {
    const { slides, skipped } = expand([{ kind: 'story', storyId: 'story:no-caption', checks: false }]);
    expect(only(slides, 'sequence')).toEqual([]);
    expect(only(slides, 'title')[0]).not.toHaveProperty('line');
    expect(skipped).toEqual([{ blockIndex: 0, ref: 'story:no-caption/sequence', reason: 'not-ready' }]);
    const missing = bundle({ story: () => ({ ...noCaption, tiers: [{ ...noCaption.tiers[0]!, sequenceSceneIds: ['s1', 's9'] }] }) });
    expect(expand([{ kind: 'story', storyId: 'story:no-caption' }], {}, missing).skipped).toEqual([
      { blockIndex: 0, ref: 'story:no-caption/sequence', reason: 'not-ready' },
    ]);
  });
});

describe('expandDeck: letters, revisit, cards, vocab, activities (rules 3, 4, 6, 8, 9)', () => {
  it('jamo-set -> letter slides; an unknown jamo is skipped', () => {
    const { slides, skipped } = expand([{ kind: 'jamo-set', jamoIds: [J('a'), J('zzz'), J('a')] }]);
    expect(keys(slides)).toEqual(['jamo-set/jamo:a', 'end']);
    expect(skipped).toEqual([{ blockIndex: 0, ref: J('zzz'), reason: 'unknown-id' }]);
  });

  it('a batchim jamo has no example word, so no example build', () => {
    const [letter] = only(expand([{ kind: 'jamo-set', jamoIds: [J('nieun-batchim')] }]).slides, 'letter');
    expect(letter!.example).toBeUndefined();
    expect(letter!.builds).toEqual(['ko', 'stroke', 'sound', 'name']);
  });

  it('an example word without romanization is dropped and counted', () => {
    const noRom = jamoAll.map((j) => (j.id === J('o') ? { ...j, exampleWordRomanization: undefined } : j));
    const { slides, skipped } = expand([{ kind: 'jamo-set', jamoIds: [J('o')] }], {}, bundle({ jamoAll: noRom }));
    expect(only(slides, 'letter')[0]!.example).toBeUndefined();
    expect(skipped).toEqual([{ blockIndex: 0, ref: 'jamo-set/jamo:o/example', reason: 'no-romanization' }]);
  });

  it('revisit: characters -> letters (never a batchim), then up to 4 Match Sound rounds over them', () => {
    const { slides, skipped } = expand([{ kind: 'revisit', chars: ['ㄱ', 'ㅓ', 'ㅎ'] }]);
    expect(only(slides, 'letter').map((l) => l.jamoId)).toEqual([J('giyeok'), J('eo'), J('hieut')]);
    const quiz = only(slides, 'quiz');
    expect(quiz).toHaveLength(3);
    const asked = quiz.map((q) => q.options.find((o) => o.correct)!.ko).sort();
    expect(asked).toEqual(['ㄱ', 'ㅎ', 'ㅓ'].sort());
    expect(skipped).toEqual([]);
  });

  it('revisit: an unknown character is skipped; too few jamo to fill 4 options skips the quiz', () => {
    const tiny = bundle({ jamoAll: jamoAll.filter((j) => j.id === J('giyeok') || j.id === J('nieun')) });
    const { slides, skipped } = expand([{ kind: 'revisit', chars: ['ㄱ', 'ㄴ', 'ㄲ'] }], {}, tiny);
    expect(only(slides, 'letter')).toHaveLength(2);
    expect(only(slides, 'quiz')).toEqual([]);
    expect(skipped).toEqual([
      { blockIndex: 0, ref: 'ㄲ', reason: 'unknown-id' },
      { blockIndex: 0, ref: 'revisit/quiz', reason: 'scope-too-small' },
    ]);
  });

  it('revisit: no known character at all adds nothing but the skips', () => {
    const { slides, skipped } = expand([{ kind: 'revisit', chars: ['ㄲ'] }]);
    expect(slides).toEqual([]);
    expect(skipped).toEqual([{ blockIndex: 0, ref: 'ㄲ', reason: 'unknown-id' }]);
  });

  it('cards -> card slides with unique keys; an unknown card is skipped', () => {
    const { slides, skipped } = expand([{ kind: 'cards', cardIds: ['card:book', 'card:nope', 'card:book'] }]);
    expect(keys(slides)).toEqual(['cards/card:book', 'cards/card:book#2', 'end']);
    expect(skipped).toEqual([{ blockIndex: 0, ref: 'card:nope', reason: 'unknown-id' }]);
  });

  it('vocab: topic title, a slide per word (all, or the chosen ones), then a word-to-gloss quiz', () => {
    const all = expand([{ kind: 'vocab', topicId: 'vocab-topic:food' }], { options: { quizRounds: 3 } }).slides;
    expect(kinds(all)).toEqual(['title', 'vocab', 'vocab', 'vocab', 'vocab', 'quiz', 'quiz', 'quiz', 'end']);
    expect(all[0]).toMatchObject({ source: 'topic', title: 'Food', line: 'Let us eat!' });
    expect(only(all, 'vocab')[0]).toMatchObject({
      key: 'vocab-topic:food/vocab:gimchi',
      word: { ko: '김치', romanization: 'gimchi', gloss: 'kimchi' },
      cardId: 'card:kimchi',
      wordId: 'vocab:gimchi',
      builds: ['ko', 'gloss', 'art'],
    });
    expect(only(all, 'quiz')[0]!.prompt.ask).toBe('meaning');

    const some = expand([{ kind: 'vocab', topicId: 'vocab-topic:food', wordIds: ['vocab:bap', 'vocab:gone'] }]);
    expect(only(some.slides, 'vocab').map((v) => v.word.ko)).toEqual(['밥']);
    expect(some.skipped).toEqual([{ blockIndex: 0, ref: 'vocab:gone', reason: 'unknown-id' }]);
    // Fewer than 4 chosen words: no quiz, so no word without a slide is ever asked.
    expect(only(some.slides, 'quiz')).toEqual([]);
  });

  it('vocab: no adapter yet, an unknown topic, or a topic under 4 words (no quiz)', () => {
    const noSource = bundle();
    delete noSource.vocabTopic;
    expect(expand([{ kind: 'vocab', topicId: 'vocab-topic:food' }], {}, noSource).skipped).toEqual([
      { blockIndex: 0, ref: 'vocab-topic:food', reason: 'not-ready' },
    ]);
    expect(expand([{ kind: 'vocab', topicId: 'vocab-topic:none' }]).skipped).toEqual([
      { blockIndex: 0, ref: 'vocab-topic:none', reason: 'unknown-id' },
    ]);
    const small = bundle({ vocabTopic: () => ({ title: 'Two', words: topic.words.slice(0, 2) }) });
    expect(kinds(expand([{ kind: 'vocab', topicId: 'vocab-topic:food' }], {}, small).slides)).toEqual(['title', 'vocab', 'vocab', 'end']);
  });

  it('activity -> one slide with its preset and minutes; class-code puts the code on the End slide', () => {
    const { slides, minutes } = expand([
      { kind: 'activity', preset: 'air-write', minutes: 3 },
      { kind: 'class-code', code: 'ABC234' },
    ]);
    expect(slides[0]).toMatchObject({ kind: 'activity', key: 'activity:air-write', preset: 'air-write', minutes: 3, builds: ['prompt'] });
    expect(slides[1]).toMatchObject({ kind: 'end', classCode: 'ABC234' });
    expect(minutes).toBe(3);
  });

  it('a repeated block gets #2 on its key', () => {
    const { slides } = expand([
      { kind: 'activity', preset: 'stretch-break', minutes: 1 },
      { kind: 'activity', preset: 'stretch-break', minutes: 2 },
    ]);
    expect(keys(slides)).toEqual(['activity:stretch-break', 'activity:stretch-break#2', 'end']);
  });
});

describe('expandDeck: quiz blocks over what was taught (rule 7)', () => {
  it("'previous' quizzes the items since the last quiz block; 'all' quizzes everything so far", () => {
    const { slides } = expand([
      { kind: 'jamo-set', jamoIds: [J('giyeok'), J('nieun'), J('digeut'), J('rieul')] },
      { kind: 'quiz', from: 'previous', rounds: 2 },
      { kind: 'jamo-set', jamoIds: [J('a'), J('eo'), J('o'), J('u')] },
      { kind: 'quiz', from: 'previous', rounds: 4 },
      { kind: 'quiz', from: 'all', rounds: 8 },
    ]);
    const quizzes = only(slides, 'quiz');
    const answer = (q: (typeof quizzes)[number]) => q.options.find((o) => o.correct)!.ko!;
    const first = quizzes.slice(0, 2).map(answer);
    const second = quizzes.slice(2, 6).map(answer);
    const third = quizzes.slice(6).map(answer);
    expect(first.every((c) => 'ㄱㄴㄷㄹ'.includes(c))).toBe(true);
    expect(second.sort()).toEqual(['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ'].sort());
    expect(new Set(third)).toEqual(new Set(['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅏ', 'ㅓ', 'ㅗ', 'ㅜ']));
    expect(quizzes[0]!.key).toBe('quiz/q1');
    expect(quizzes[2]!.key).toBe('quiz#2/q1');
  });

  it('words and cards become word-to-gloss rounds; with letters too, the rounds are shared', () => {
    const { slides } = expand([
      { kind: 'vocab', topicId: 'vocab-topic:food' },
      { kind: 'jamo-set', jamoIds: [J('giyeok'), J('nieun'), J('digeut'), J('rieul')] },
      { kind: 'quiz', from: 'previous', rounds: 5 },
    ]);
    const quizzes = only(slides, 'quiz').slice(-5);
    expect(quizzes.map((q) => q.prompt.ask)).toEqual(['sound', 'sound', 'sound', 'meaning', 'meaning']);
  });

  it('cards count as words with their English title as the gloss', () => {
    const { slides } = expand([
      { kind: 'cards', cardIds: ['card:book', 'card:hanji', 'card:brush', 'card:ink'] },
      { kind: 'quiz', from: 'all', rounds: 2 },
    ]);
    const quizzes = only(slides, 'quiz');
    expect(quizzes).toHaveLength(2);
    expect(quizzes[0]!.prompt.ask).toBe('meaning');
  });

  it('fewer than 4 distinct items skips the quiz block', () => {
    const { slides, skipped } = expand([
      { kind: 'jamo-set', jamoIds: [J('a'), J('eo')] },
      { kind: 'quiz', from: 'all', rounds: 3 },
    ]);
    expect(only(slides, 'quiz')).toEqual([]);
    expect(skipped).toEqual([{ blockIndex: 1, ref: 'quiz', reason: 'scope-too-small' }]);
  });
});

describe('expandDeck: the whole deck (rules 10-12)', () => {
  it('every deck ends with End, listing the letters and words met', () => {
    const { slides, taught } = expand([
      { kind: 'jamo-set', jamoIds: [J('giyeok')] },
      { kind: 'quest', id: 'quest:words' },
      { kind: 'cards', cardIds: ['card:book'] },
    ]);
    const end = slides[slides.length - 1]!;
    expect(end).toMatchObject({
      kind: 'end',
      key: 'end',
      letters: [{ ko: 'ㄱ', romanization: 'g/k' }],
      words: [
        { ko: '김치', romanization: 'gimchi', gloss: 'Kimchi' },
        { ko: '책', romanization: 'chaek', gloss: 'Book' },
      ],
      builds: ['summary'],
    });
    expect(end).not.toHaveProperty('classCode');
    expect(taught).toEqual([
      { kind: 'letter', jamoId: J('giyeok'), ko: 'ㄱ', romanization: 'g/k' },
      { kind: 'word', ko: '김치', romanization: 'gimchi', gloss: 'Kimchi' },
      { kind: 'word', ko: '책', romanization: 'chaek', gloss: 'Book' },
    ]);
  });

  it('syllables are met words without a gloss: on End, not in a word-to-gloss quiz', () => {
    const { slides } = expand([{ kind: 'quest', id: 'quest:letters' }]);
    const end = only(slides, 'end')[0]!;
    expect(end.words.map((w) => w.ko)).toEqual(['가', '물', '책']);
    expect(end.words[0]).toEqual({ ko: '가', romanization: 'ga' });
  });

  it('a deck with zero slides after skips has no slides at all (the invalid-deck screen)', () => {
    const { slides, skipped, minutes } = expand([
      { kind: 'quest', id: 'quest:nope' },
      { kind: 'class-code', code: 'ABC234' },
    ]);
    expect(slides).toEqual([]);
    expect(skipped).toHaveLength(1);
    expect(minutes).toBe(0);
  });

  it('is deterministic: the same deck twice gives identical slides; another seed reshuffles quizzes', () => {
    const blocks: LectureDeckInput['blocks'] = [
      { kind: 'episode', id: 'episode:first' },
      { kind: 'quest', id: 'quest:odd' },
      { kind: 'story', storyId: 'story:sun-moon' },
      { kind: 'quiz', from: 'all', rounds: 6 },
    ];
    expect(expand(blocks).slides).toEqual(expand(blocks).slides);
    const quizText = (seed: number) => JSON.stringify(only(expand(blocks, { seed }).slides, 'quiz'));
    expect(quizText(7)).not.toBe(quizText(8));
  });

  it("romanization 'tap' gives romanization its own build; withBuilds rebuilds after Shift+R", () => {
    const tap = expand([{ kind: 'jamo-set', jamoIds: [J('giyeok')] }], { options: { romanization: 'tap', strokeGuide: false } }).slides;
    expect(tap[0]!.builds).toEqual(['ko', 'rom', 'sound', 'name', 'example']);
    const always = withBuilds(tap, { romanization: 'always', strokeGuide: true });
    expect(always[0]!.builds).toEqual(['ko', 'stroke', 'sound', 'name', 'example']);
    expect(always[0]!.key).toBe(tap[0]!.key);
  });
});

describe('expandDeck: review fixes (never a crash, trace-stroke order, chosen words)', () => {
  const revisitQuiz = (chars: string[]) => {
    const out = expand([{ kind: 'revisit', chars }]);
    return { ...out, quiz: only(out.slides, 'quiz') };
  };
  const answers = (quiz: ReadonlyArray<Extract<Slide, { kind: 'quiz' }>>): string[] =>
    quiz.map((q) => q.options.find((o) => o.correct)!.ko!);

  it('revisit with 5 or 6 distinct characters gives at most 4 rounds, all over the revisit letters', () => {
    const five = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ'];
    const a = revisitQuiz(five);
    expect(only(a.slides, 'letter')).toHaveLength(5);
    expect(a.quiz).toHaveLength(4);
    for (const ko of answers(a.quiz)) expect(five).toContain(ko);
    expect(a.skipped).toEqual([]);

    const six = ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ'];
    const b = revisitQuiz(six);
    expect(only(b.slides, 'letter')).toHaveLength(6);
    expect(b.quiz).toHaveLength(4);
    for (const ko of answers(b.quiz)) expect(six).toContain(ko);
    expect(b.skipped).toEqual([]);
  });

  it('revisit with repeated characters counts each letter once', () => {
    const a = revisitQuiz(['ㄱ', 'ㄱ', 'ㄴ']);
    expect(only(a.slides, 'letter').map((l) => l.jamoId)).toEqual([J('giyeok'), J('nieun')]);
    expect(a.quiz).toHaveLength(2);
    expect(answers(a.quiz).sort()).toEqual(['ㄱ', 'ㄴ']);
    expect(a.skipped).toEqual([]);

    const b = revisitQuiz(['ㄱ', 'ㄱ', 'ㄱ', 'ㄱ', 'ㄱ']);
    expect(only(b.slides, 'letter')).toHaveLength(1);
    expect(answers(b.quiz)).toEqual(['ㄱ']);
    expect(b.skipped).toEqual([]);
  });

  it('a round builder that throws in a revisit or quiz block is scope-too-small, never a crash', () => {
    // Jamo the round builders do not know (they read the bundled jamo list) make them throw.
    const strange = jamoAll.map((j) => ({ ...j, id: `${j.id}-x` }));
    const b = bundle({ jamoAll: strange });
    const revisit = expand([{ kind: 'revisit', chars: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] }], {}, b);
    expect(only(revisit.slides, 'letter')).toHaveLength(4);
    expect(only(revisit.slides, 'quiz')).toEqual([]);
    expect(revisit.skipped).toEqual([{ blockIndex: 0, ref: 'revisit/quiz', reason: 'scope-too-small' }]);

    const ids = ['giyeok', 'nieun', 'digeut', 'rieul'].map((id) => `${J(id)}-x`);
    const quiz = expand([{ kind: 'jamo-set', jamoIds: ids }, { kind: 'quiz', from: 'all', rounds: 3 }], {}, b);
    expect(only(quiz.slides, 'quiz')).toEqual([]);
    expect(quiz.skipped).toEqual([{ blockIndex: 1, ref: 'quiz', reason: 'scope-too-small' }]);
  });

  it('trace-stroke letters start with the stroke guide; no guide or no skeleton keeps the usual order', () => {
    const traced = (over: Partial<LectureDeckInput> = {}, b: LectureBundle = bundle()) =>
      expand([{ kind: 'quest', id: 'quest:again' }], over, b).slides.find((s) => s.key === 'quest:again/s3/jamo:mieum')!;
    expect(traced()).toMatchObject({ kind: 'letter', strokeFirst: true, builds: ['stroke', 'ko', 'sound', 'name', 'example'] });
    expect(traced({ options: { romanization: 'tap' } }).builds).toEqual(['stroke', 'ko', 'rom', 'sound', 'name', 'example']);
    expect(traced({ options: { strokeGuide: false } }).builds).toEqual(['ko', 'sound', 'name', 'example']);
    expect(traced({}, bundle({ hasStrokes: () => false })).builds).toEqual(['ko', 'sound', 'name', 'example']);
    const presented = expand([{ kind: 'quest', id: 'quest:letters' }]).slides.find((s) => s.kind === 'letter')!;
    expect(presented).not.toHaveProperty('strokeFirst');
  });

  it('vocab: the quiz asks only the chosen words when 4 or more were chosen', () => {
    const big: LectureVocabTopic = {
      ...topic,
      words: [
        ...topic.words,
        { id: 'vocab:dal', ko: '달', romanization: 'dal', gloss: 'moon' },
        { id: 'vocab:hae', ko: '해', romanization: 'hae', gloss: 'sun' },
      ],
    };
    const chosen = ['vocab:bap', 'vocab:mul', 'vocab:dal', 'vocab:hae'];
    const { slides } = expand([{ kind: 'vocab', topicId: 'vocab-topic:food', wordIds: chosen }], { options: { quizRounds: 10 } }, bundle({ vocabTopic: () => big }));
    const quiz = only(slides, 'quiz');
    expect(quiz).toHaveLength(4);
    for (const q of quiz) {
      expect(q.prompt.ask).toBe('meaning');
      if (q.prompt.ask === 'meaning') expect(['밥', '물', '달', '해']).toContain(q.prompt.ko);
      for (const o of q.options) expect(['rice', 'water', 'moon', 'sun']).toContain(o.gloss);
    }
  });

  it('a story check option with Korean but no romanization leaves that check out, counted', () => {
    const tier = sunMoon.tiers[1]!;
    const bad: LectureStory = {
      ...sunMoon,
      id: 'story:bad-check',
      tiers: [{ ...tier, checks: [{ ...tier.checks[0]!, options: [...tier.checks[0]!.options, { id: 'd', ko: '별', en: 'star', isCorrect: false }] }, tier.checks[1]!] }],
    };
    const { slides, skipped } = expand([{ kind: 'story', storyId: 'story:bad-check' }], {}, bundle({ story: () => bad }));
    expect(only(slides, 'quiz')).toHaveLength(1);
    expect(skipped).toEqual([{ blockIndex: 0, ref: 'story:bad-check/check-c1', reason: 'no-romanization' }]);
  });
});
