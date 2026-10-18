import {
  CATALOG,
  LECTURE_PRESETS,
  LectureDeckSchema,
  PRESET_LENGTHS,
  presetDeck,
  presetMinutesOf,
  resolvePreset,
  StageKeySchema,
  type Episode,
  type HeritageCard,
  type LectureDeckInput,
  type LecturePreset,
  type PresetContext,
  type Quest,
  type QuestStep,
} from '@hangul-route/content-schema';
import { LECTURE_MINUTES_DECKS } from '@hangul-route/content-schema/testing/lecture-decks';
import { describe, expect, it } from 'vitest';
import { heritageCardsAll, jamoAll } from '../../../content';
import type { MinigameScope } from '../../minigame-config';
import { lectureBundle } from '../content';
import { runDeck } from '../shell';
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
  'mg:listen': { kind: 'listen-pick', listenPick: { rounds: [] } },
  'mg:build-na': { kind: 'build-letter', syllables: [{ ko: '나', romanization: 'na', jamoChars: ['ㄴ', 'ㅏ'] }] },
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

/** A Stage 1 quest (F-QUEST-002): its `discover` step gets two pages (two jamo items, one an unknown id, then a word). */
const withDiscover = (q: Quest): Quest => ({
  ...q,
  steps: q.steps.map((step) =>
    step.kind === 'discover'
      ? {
          ...step,
          discover: {
            pages: [
              {
                items: [
                  { type: 'jamo', jamoId: J('a'), example: { ko: '나', romanization: 'na', en: 'I, me' } },
                  { type: 'jamo', jamoId: J('nope'), example: { ko: '나', romanization: 'na', en: 'I, me' } },
                ],
              },
              { items: [{ type: 'word', word: { ko: '나무', romanization: 'namu', en: 'tree' } }] },
            ],
          },
        }
      : step,
  ),
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
  withDiscover(quest('discover', [['intro'], ['discover'], ['practice', 'mg:match'], ['check', 'mg:listen'], ['reward']])),
  // A Stage 1 quest (F-QUEST-002): intro -> discover -> practice -> apply -> check -> reward.
  {
    ...quest('discover-q1', [['intro'], ['discover'], ['practice', 'mg:match'], ['apply', 'mg:build-na'], ['check', 'mg:listen'], ['reward']]),
    steps: quest('discover-q1', [['intro'], ['discover'], ['practice', 'mg:match'], ['apply', 'mg:build-na'], ['check', 'mg:listen'], ['reward']]).steps.map(
      (step) =>
        step.kind === 'discover'
          ? {
              ...step,
              discover: {
                pages: [
                  { items: [{ type: 'jamo', jamoId: J('giyeok'), example: { ko: '가방', romanization: 'gabang', en: 'bag' } }, { type: 'jamo', jamoId: J('a'), example: { ko: '아기', romanization: 'agi', en: 'baby' } }] },
                  { items: [{ type: 'jamo', jamoId: J('nope'), example: { ko: '가', romanization: 'ga', en: 'go' } }, { type: 'word', word: { ko: '나', romanization: 'na', en: 'I, me' } }] },
                ],
              },
            }
          : step,
    ),
  },
  quest('refless', [['intro'], ['present'], ['discover'], ['practice', 'mg:match']], { rewardCardId: undefined }),
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
  episode('shelf-sun-moon', ['quest:story', 'quest:gone'], { format: 'story', storyIds: ['story:sun-moon'] }),
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
  minutes: 5,
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
    { id: 'vocab:mul', ko: '물', romanization: 'mul', gloss: 'water', wordArt: 'food-water' },
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
  vocabTopic: (id) => {
    if (id === 'vocab-topic:draft') return 'not-ready';
    return id === 'vocab-topic:food' ? topic : undefined;
  },
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
    // Rule 12 (section 4.4, LV-0b O1): the quest's own 3 quiz slides are inside its 4 catalogue minutes.
    expect(minutes).toBe(4);
  });

  it('a Discover step gives a letter per jamo item and a vocab slide per word item; the Check is a counted skip', () => {
    const { slides, skipped, taught } = expand([{ kind: 'quest', id: 'quest:discover' }]);
    expect(kinds(slides)).toEqual(['title', 'letter', 'vocab', 'quiz', 'quiz', 'quiz', 'card', 'end']);
    expect(keys(slides).slice(1, 3)).toEqual(['quest:discover/s2/jamo:a', 'quest:discover/s2/나무']);
    expect(only(slides, 'vocab')[0]!.word).toEqual({ ko: '나무', romanization: 'namu', gloss: 'tree' });
    expect(skipped).toEqual([
      { blockIndex: 0, ref: 'jamo:nope', reason: 'unknown-id' },
      { blockIndex: 0, ref: 'mg:listen', reason: 'unsupported-step' },
    ]);
    expect(taught).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'letter', jamoId: 'jamo:a' }),
        { kind: 'word', ko: '나무', romanization: 'namu', gloss: 'tree' },
      ]),
    );
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
    // Set both sides here: content PRs add hints to the real jamo (#259), so never rely on one lacking it.
    const withHint = jamoAll.map((j) => {
      if (j.id === J('nieun')) return { ...j, soundHint: 'like n in no' };
      if (j.id === J('ieung')) return { ...j, soundHint: undefined };
      return j;
    });
    const letters = only(expand([{ kind: 'jamo-set', jamoIds: [J('nieun'), J('ieung')] }], {}, bundle({ jamoAll: withHint })).slides, 'letter');
    expect(letters[0]!.soundHint).toBe('like n in no');
    expect(letters[1]).not.toHaveProperty('soundHint');
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

describe('expandDeck: F-QUEST-002 quests (Discover, Check; post-merge #256)', () => {
  it('a discover step gives a letter slide per jamo item, before the quiz that asks them', () => {
    const { slides } = expand([{ kind: 'quest', id: 'quest:discover-q1' }]);
    expect(keys(slides).slice(0, 3)).toEqual(['quest:discover-q1/title', 'quest:discover-q1/s2/jamo:giyeok', 'quest:discover-q1/s2/jamo:a']);
    const letters = only(slides, 'letter').map((l) => l.jamoId);
    expect(letters).toEqual([J('giyeok'), J('a')]);
    const firstQuiz = slides.findIndex((s) => s.kind === 'quiz');
    expect(firstQuiz).toBeGreaterThan(slides.findIndex((s) => s.key === 'quest:discover-q1/s2/jamo:a'));
  });

  it('a discover word item is a vocab slide with romanization and gloss; an unknown jamo is a counted skip', () => {
    const { slides, skipped } = expand([{ kind: 'quest', id: 'quest:discover-q1' }]);
    expect(slides.find((s) => s.key === 'quest:discover-q1/s2/나')).toMatchObject({ kind: 'vocab', word: { ko: '나', romanization: 'na', gloss: 'I, me' } });
    expect(skipped).toContainEqual({ blockIndex: 0, ref: J('nope'), reason: 'unknown-id' });
  });

  it('the check step (listen-pick) is a counted unsupported-step skip; End lists the discovered letters', () => {
    const { slides, skipped } = expand([{ kind: 'quest', id: 'quest:discover-q1' }]);
    expect(skipped).toContainEqual({ blockIndex: 0, ref: 'mg:listen', reason: 'unsupported-step' });
    const end = only(slides, 'end')[0]!;
    expect(end.letters.map((l) => l.ko)).toEqual(['ㄱ', 'ㅏ']);
  });

  it('a discovered letter counts for a later quiz block', () => {
    const { slides, skipped } = expand([
      { kind: 'quest', id: 'quest:discover-q1' },
      { kind: 'jamo-set', jamoIds: [J('nieun'), J('digeut')] },
      { kind: 'quiz', from: 'all', rounds: 2 },
    ]);
    expect(skipped.filter((s) => s.ref === 'quiz')).toEqual([]);
    expect(slides.filter((s) => s.key.startsWith('quiz/'))).toHaveLength(2);
  });

  it('a step other than intro or reward with no minigame and nothing to show is counted, never dropped silently', () => {
    const { slides, skipped } = expand([{ kind: 'quest', id: 'quest:refless' }]);
    expect(skipped).toEqual([
      { blockIndex: 0, ref: 'quest:refless/s2', reason: 'unsupported-step' },
      { blockIndex: 0, ref: 'quest:refless/s3', reason: 'unsupported-step' },
    ]);
    expect(kinds(slides)).toEqual(['title', 'quiz', 'quiz', 'quiz', 'end']);
  });

  it('a word taught again with a gloss gains that gloss (a syllable that is also a word)', () => {
    const { slides, taught } = expand([{ kind: 'quest', id: 'quest:discover-q1' }]);
    expect(taught.filter((t) => t.ko === '나')).toEqual([{ kind: 'word', ko: '나', romanization: 'na', gloss: 'I, me' }]);
    expect(only(slides, 'end')[0]!.words).toContainEqual({ ko: '나', romanization: 'na', gloss: 'I, me' });
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
    // Two quests of 4 minutes; their own quiz slides are inside those minutes (section 4.4, O1).
    expect(only(slides, 'quiz').length).toBeGreaterThan(0);
    expect(minutes).toBe(4 + 4);
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
    const { slides, minutes } = expand([{ kind: 'episode', id: 'episode:shelf-sun-moon' }]);
    // Rule 12: the episode's quests count their estimated minutes on the storyIds path too; the
    // stories' check slides are inside them (section 4.4, O1).
    expect(only(slides, 'quiz').length).toBeGreaterThan(0);
    expect(minutes).toBe(4);
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
      // A keyword is read at the word rate, a line at the sentence rate (Read-to-me, section 3.4 amendment 2026-10-17).
      korean: { ko: '해', romanization: 'hae', gloss: 'sun', speech: 'word' },
      caption: 'Caption s1',
      builds: ['art', 'narration', 'korean'],
    });
    expect(stories[1]).toMatchObject({ narration: [{ text: 'Night came.' }], korean: { ko: '달이 떴다', romanization: 'dari tteotda', gloss: 'The moon rose', speech: 'sentence' } });
    expect(stories[2]!.korean).toBeUndefined();
  });

  it('the order slide uses the tier sequence scenes, their captions and Korean', () => {
    const [sequence] = only(expand([{ kind: 'story', storyId: 'story:sun-moon' }]).slides, 'sequence');
    expect(sequence!.steps.map((s) => s.id)).toEqual(['s4', 's3', 's2', 's1']);
    expect(sequence!.steps[2]).toEqual({ id: 's2', gloss: 'Caption s2', ko: '달이 떴다', romanization: 'dari tteotda' });
  });

  it('checks become quiz slides with the story own prompt, options and explanation', () => {
    const quiz = only(expand([{ kind: 'story', storyId: 'story:sun-moon' }]).slides, 'quiz');
    // pick-meaning: the target's gloss is the answer, so it waits for the reveal (as in the learner check, F-STORY-003).
    expect(quiz[0]!.prompt).toEqual({ ask: 'check', text: 'What does {target} mean?', target: { ko: '해', romanization: 'hae', gloss: 'sun' }, glossAtAnswer: true });
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
    // A topic word's WordArt key rides on its slide and adds the art build after the gloss (README D9).
    expect(only(all, 'vocab')[2]).toMatchObject({ wordId: 'vocab:mul', wordArt: 'food-water', builds: ['ko', 'gloss', 'art'] });
    expect(only(all, 'vocab')[1]).not.toHaveProperty('wordArt');
    expect(only(all, 'vocab')[1]!.builds).toEqual(['ko', 'gloss']);

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
    const draft = expand([{ kind: 'vocab', topicId: 'vocab-topic:draft' }]);
    expect(draft.skipped).toEqual([{ blockIndex: 0, ref: 'vocab-topic:draft', reason: 'not-ready' }]);
    expect(draft.slides).toEqual([]);
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

describe('expandDeck: one card per word per deck (AMENDMENTS-LECTURE-V2 section 5.1, LV-2)', () => {
  const pw = (ko: string, romanization: string, en: string) => ({ id: `pw-${romanization}`, word: { ko, romanization, en } });
  const lvScopes: Record<string, MinigameScope> = {
    'mg:cards4': { kind: 'card-match', cardPairs: pairs4 },
    'mg:cards4-again': { kind: 'card-match', cardPairs: [...pairs4].reverse(), rounds: 3 },
    'mg:cards3': { kind: 'card-match', cardPairs: pairs4.slice(0, 3) },
    'mg:cards-mixed': { kind: 'card-match', cardPairs: [...pairs4.slice(0, 2), { ko: '해', en: 'Sun', romanization: 'hae' }] },
    'mg:cards-norom': { kind: 'card-match', cardPairs: [...pairs4, { ko: '별', en: 'Star' }] },
    'mg:pic': {
      kind: 'pic-word-match',
      picWord: {
        boards: [
          { pairs: [pw('김치', 'gimchi', 'Kimchi'), pw('밥', 'bap', 'Rice'), pw('물', 'mul', 'Water')] },
          { pairs: [pw('밥', 'bap', 'Rice'), pw('산', 'san', 'Mountain'), pw('김치', 'gimchi', 'Kimchi')] },
        ],
      },
    },
  };
  const lvQuests: Quest[] = [
    quest('cards4', [['present', 'mg:cards4'], ['practice', 'mg:cards4-again']], { rewardCardId: undefined }),
    quest('cards3', [['present', 'mg:cards3'], ['practice', 'mg:cards3']], { rewardCardId: undefined }),
    quest('mixed', [['present', 'mg:cards4'], ['practice', 'mg:cards-mixed']], { rewardCardId: undefined }),
    quest('pic', [['present', 'mg:pic'], ['practice', 'mg:pic']], { rewardCardId: undefined }),
    quest('norom', [['present', 'mg:cards4'], ['practice', 'mg:cards-norom']], { rewardCardId: undefined }),
  ];
  const lv = bundle({
    scopeFor: (ref) => lvScopes[ref] ?? scopes[ref],
    questById: (id) => lvQuests.find((q) => q.id === id) ?? quests.find((q) => q.id === id),
  });
  const run = (blocks: LectureDeckInput['blocks'], over: Partial<LectureDeckInput> = {}) => expand(blocks, over, lv);
  const wordKos = (slides: readonly Slide[]) => only(slides, 'vocab').map((s) => s.word.ko);

  it('a word card is shown once per deck, across steps, quests and blocks; a repeat is not a skip', () => {
    const { slides, skipped, taught } = run([
      { kind: 'quest', id: 'quest:pic' },
      { kind: 'quest', id: 'quest:words' },
      { kind: 'vocab', topicId: 'vocab-topic:food' },
    ]);
    expect(wordKos(slides)).toEqual(['김치', '밥', '물', '산']);
    expect(skipped.filter((s) => s.reason !== 'no-romanization' && s.reason !== 'unknown-id')).toEqual([]);
    // Each word is taught once, with its first gloss.
    expect(taught.filter((t) => t.kind === 'word').map((t) => t.ko)).toEqual(['김치', '밥', '물', '산']);
  });

  it('a pic-word board repeating its words gives each word one card', () => {
    const { slides } = run([{ kind: 'quest', id: 'quest:pic' }]);
    expect(keys(only(slides, 'vocab'))).toEqual(['quest:pic/s1/김치', 'quest:pic/s1/밥', 'quest:pic/s1/물', 'quest:pic/s1/산']);
  });

  it('card-match whose words were all shown, with 4 or more pairs, becomes word-to-meaning quiz rounds', () => {
    const { slides } = run([{ kind: 'quest', id: 'quest:cards4' }]);
    expect(kinds(slides)).toEqual(['title', 'vocab', 'vocab', 'vocab', 'vocab', 'quiz', 'quiz', 'quiz', 'end']);
    const quiz = only(slides, 'quiz');
    expect(keys(quiz)).toEqual(['quest:cards4/s2/q1', 'quest:cards4/s2/q2', 'quest:cards4/s2/q3']);
    for (const q of quiz) {
      expect(q.prompt.ask).toBe('meaning');
      if (q.prompt.ask === 'meaning') expect(['김치', '밥', '물', '산']).toContain(q.prompt.ko);
      expect(q.options.filter((o) => o.correct)).toHaveLength(1);
    }
  });

  it('pic-word-match whose words were all shown becomes a quiz of min(quizRounds, scope rounds) rounds', () => {
    const { slides } = run([{ kind: 'quest', id: 'quest:pic' }], { options: { quizRounds: 2 } });
    expect(kinds(slides)).toEqual(['title', 'vocab', 'vocab', 'vocab', 'vocab', 'quiz', 'quiz', 'end']);
  });

  it('under 4 pairs, or a word not yet shown, keeps word cards (only the new ones)', () => {
    const small = run([{ kind: 'quest', id: 'quest:cards3' }]).slides;
    expect(kinds(small)).toEqual(['title', 'vocab', 'vocab', 'vocab', 'end']);
    const mixed = run([{ kind: 'quest', id: 'quest:mixed' }]).slides;
    expect(wordKos(mixed)).toEqual(['김치', '밥', '물', '산', '해']);
    expect(only(mixed, 'quiz')).toHaveLength(0);
  });

  it('a pair without romanization is still a counted skip and does not block the quiz', () => {
    const { slides, skipped } = run([{ kind: 'quest', id: 'quest:norom' }]);
    expect(only(slides, 'quiz')).toHaveLength(4);
    expect(skipped).toEqual([{ blockIndex: 0, ref: 'quest:norom/s2/별', reason: 'no-romanization' }]);
  });

  it('a word met first without a gloss (a syllable) still gets its card and gloss when taught as a word', () => {
    const { slides, taught } = run([{ kind: 'quest', id: 'quest:discover-q1' }]);
    expect(wordKos(slides).filter((ko) => ko === '나')).toHaveLength(1);
    expect(taught.find((t) => t.kind === 'word' && t.ko === '나')).toMatchObject({ gloss: 'I, me' });
  });

  it('the same deck gives the same quiz; another seed reshuffles it', () => {
    const blocks: LectureDeckInput['blocks'] = [{ kind: 'quest', id: 'quest:cards4' }];
    expect(run(blocks).slides).toEqual(run(blocks).slides);
    const quizText = (seed: number) => JSON.stringify(only(run(blocks, { seed }).slides, 'quiz'));
    expect(quizText(7)).not.toBe(quizText(9));
  });
});

describe('expandDeck: rule 12 as amended (AMENDMENTS-LECTURE-V2 section 4.4, LV-2)', () => {
  it('jamo-set, cards and revisit count ceil(slides / 2) for their non-quiz slides, plus 1 per quiz slide', () => {
    expect(expand([{ kind: 'jamo-set', jamoIds: [J('giyeok'), J('nieun'), J('digeut')] }]).minutes).toBe(2);
    expect(expand([{ kind: 'cards', cardIds: ['card:book'] }]).minutes).toBe(1);
    const revisit = expand([{ kind: 'revisit', chars: ['ㄱ', 'ㄴ', 'ㄷ', 'ㅏ', 'ㅓ', 'ㅗ'] }]);
    expect(only(revisit.slides, 'letter')).toHaveLength(6);
    expect(revisit.minutes).toBe(3 + only(revisit.slides, 'quiz').length);
  });

  it('a warm-up of letters and an activity is never about 0 minutes', () => {
    const { minutes } = expand([
      { kind: 'revisit', chars: ['ㄱ', 'ㄴ', 'ㄷ'] },
      { kind: 'activity', preset: 'air-write', minutes: 3 },
    ]);
    expect(minutes).toBeGreaterThan(3);
  });

  it('a letter already shown adds no slide and no minute; quests keep their catalogue minutes', () => {
    expect(expand([{ kind: 'jamo-set', jamoIds: [J('giyeok')] }, { kind: 'jamo-set', jamoIds: [J('giyeok')] }]).minutes).toBe(1);
    expect(expand([{ kind: 'jamo-set', jamoIds: [J('nope')] }, { kind: 'quest', id: 'quest:again' }]).minutes).toBe(4);
  });

  // LV-0b observation O1: the 20-minute Hangul week 1 deck previewed as about 38 minutes because
  // the Match Sound rounds inside its quests were counted again on top of the quests' minutes.
  it("a quest's own quiz slides are inside its catalogue minutes; quiz slides outside a quest or story count 1 each", () => {
    const quest = expand([{ kind: 'quest', id: 'quest:letters' }]);
    expect(only(quest.slides, 'quiz')).toHaveLength(3);
    expect(quest.minutes).toBe(4);
    const withQuiz = expand([{ kind: 'quest', id: 'quest:letters' }, { kind: 'quiz', from: 'previous', rounds: 4 }]);
    const outside = only(withQuiz.slides, 'quiz').filter((s) => !s.key.startsWith('quest:letters/'));
    expect(outside).toHaveLength(4);
    expect(withQuiz.minutes).toBe(4 + 4);
    const words = expand([{ kind: 'quest', id: 'quest:words' }, { kind: 'revisit', chars: ['ㄱ', 'ㄴ', 'ㄷ', 'ㅏ'] }]);
    expect(only(words.slides, 'quiz').filter((s) => s.key.startsWith('quest:words/')).length).toBeGreaterThan(0);
    expect(words.minutes).toBe(4 + 2 + 4);
  });

  it("a story block counts the story's minutes, its check slides inside them; a skipped story counts none", () => {
    const story = expand([{ kind: 'story', storyId: 'story:sun-moon' }]);
    expect(only(story.slides, 'quiz')).toHaveLength(3);
    expect(story.minutes).toBe(5);
    expect(expand([{ kind: 'story', storyId: 'story:sun-moon', checks: false }]).minutes).toBe(5);
    const skipped = expand([
      { kind: 'story', storyId: 'story:draft' },
      { kind: 'story', storyId: 'story:no-tiers' },
      { kind: 'activity', preset: 'air-write', minutes: 3 },
    ]);
    expect(skipped.skipped.map((s) => s.reason)).toEqual(['not-ready', 'not-ready']);
    expect(skipped.minutes).toBe(3);
  });

  it('a story inside a quest or a story episode is inside their minutes', () => {
    const inQuest = expand([{ kind: 'quest', id: 'quest:story' }]);
    expect(only(inQuest.slides, 'title').some((t) => t.source === 'story')).toBe(true);
    expect(inQuest.minutes).toBe(4);
    expect(expand([{ kind: 'episode', id: 'episode:book' }]).minutes).toBe(4);
  });
});

describe('expandDeck: honest minutes (AMENDMENTS-LECTURE-V2 section 4.4, LV-M1)', () => {
  it('a vocab block counts ceil(word cards / 2) plus its quiz slides; its title is not a word slide', () => {
    const food = expand([{ kind: 'vocab', topicId: 'vocab-topic:food' }]);
    expect(only(food.slides, 'vocab')).toHaveLength(4);
    expect(only(food.slides, 'quiz')).toHaveLength(4);
    expect(food.minutes).toBe(2 + 4);
    // Three words: no quiz (under 4 shown), two minutes for the cards.
    const three = expand([{ kind: 'vocab', topicId: 'vocab-topic:food', wordIds: ['vocab:bap', 'vocab:mul', 'vocab:gimchi'] }]);
    expect(only(three.slides, 'quiz')).toHaveLength(0);
    expect(three.minutes).toBe(2);
  });

  it('a word card shown earlier in the deck is not counted again', () => {
    const twice = expand([
      { kind: 'vocab', topicId: 'vocab-topic:food', wordIds: ['vocab:bap', 'vocab:mul', 'vocab:gimchi'] },
      { kind: 'vocab', topicId: 'vocab-topic:food', wordIds: ['vocab:bap', 'vocab:mul', 'vocab:gimchi'] },
    ]);
    expect(only(twice.slides, 'vocab')).toHaveLength(3);
    expect(twice.minutes).toBe(2);
  });

  it('a deck that has slides is never 0 minutes: an activity-free title-only deck counts 1', () => {
    const titleOnly = expand([{ kind: 'vocab', topicId: 'vocab-topic:food', wordIds: ['vocab:gone'] }]);
    expect(kinds(titleOnly.slides)).toEqual(['title', 'end']);
    expect(titleOnly.minutes).toBe(1);
  });

  it('records the quiz slides that counted a minute: outside a quest or story only', () => {
    const { slides, timedQuizKeys } = expand([{ kind: 'quest', id: 'quest:letters' }, { kind: 'quiz', from: 'previous', rounds: 4 }]);
    const outside = only(slides, 'quiz').filter((sl) => !sl.key.startsWith('quest:letters/'));
    expect(timedQuizKeys).toEqual(outside.map((sl) => sl.key));
    expect(expand([{ kind: 'story', storyId: 'story:sun-moon' }]).timedQuizKeys).toEqual([]);
  });

  it('24 letters give 12 minutes, never 0 (owner report 2026-10-16: 25 slides at about 0 minutes)', () => {
    const letters = [...jamoAll.filter((j) => j.kind === 'consonant'), ...jamoAll.filter((j) => j.kind === 'vowel')].map((j) => j.id);
    expect(letters).toHaveLength(24);
    const { slides, minutes } = expandDeck(
      deckOf([
        { kind: 'jamo-set', jamoIds: letters.slice(0, 12) },
        { kind: 'jamo-set', jamoIds: letters.slice(12) },
      ]),
      lectureBundle('en'),
      VOICE,
    );
    expect(slides).toHaveLength(25);
    expect(minutes).toBe(12);
  });

  it('a 10-word topic gives more minutes than its quiz rounds (the shipped bundle)', () => {
    const topic = lectureBundle('en').vocabTopic?.('vocab-topic:food');
    if (topic === undefined || topic === 'not-ready') throw new Error('the food topic is shipped');
    const deck = deckOf([{ kind: 'vocab', topicId: 'vocab-topic:food', wordIds: topic.words.slice(0, 10).map((w) => w.id) }]);
    const expanded = expandDeck(deck, lectureBundle('en'), VOICE);
    expect(only(expanded.slides, 'vocab')).toHaveLength(10);
    expect(runDeck(deck, expanded).minutes).toBe(5 + deck.options.quizRounds);
  });
});

describe('the start screen estimate equals the console (shared fixture decks, rule 12 as amended)', () => {
  it.each(LECTURE_MINUTES_DECKS.map((d) => [d.name, d] as const))('%s', (_, fixture) => {
    const deck = deckOf(fixture.blocks);
    const expanded = expandDeck(deck, lectureBundle('en'), VOICE);
    expect(expanded.skipped.filter((sk) => sk.reason === 'unknown-id')).toEqual([]);
    expect(runDeck(deck, expanded).minutes).toBe(fixture.aboutMinutes);
  });
});

describe('expandDeck: every preset previews within its length on the shipped bundle (AMENDMENTS-LECTURE-V2 4.4, LV-0b O1)', () => {
  const shipped = lectureBundle('en');
  const meta = { id: 'lecture:preset01', title: 'Preset', createdAt: '2026-10-17T09:00:00Z', seed: 7, source: 'quick' as const };
  const previewOf = (preset: LecturePreset, minutes: number, ctx: PresetContext) => {
    const resolved = resolvePreset(preset, minutes, ctx);
    const expanded = expandDeck(LectureDeckSchema.parse(presetDeck(resolved, meta)), shipped, VOICE);
    return { resolved, expanded, console: presetMinutesOf(resolved.blocks, CATALOG) };
  };
  const contexts: [string, PresetContext][] = [
    ['a first visit', { catalog: CATALOG }],
    ...StageKeySchema.options.map((stage): [string, PresetContext] => [stage, { catalog: CATALOG, stage }]),
    ['a Stage 3 position', { catalog: CATALOG, position: { questId: 'quest:stage3-life-q2' } }],
    ['a Stage 1 position', { catalog: CATALOG, position: { questId: 'quest:stage1-life-q3' } }],
    ['a story shown before', { catalog: CATALOG, shown: { questIds: [], storyIds: ['story:sejong-new-letters'] } }],
    ['recent words', { catalog: CATALOG, recentWords: { questIds: ['quest:stage2-life-q1', 'quest:stage2-letters-q1'], vocabIds: [] } }],
    ['two recent letters', { catalog: CATALOG, revisitChars: ['ㅓ', 'ㄹ'] }],
  ];
  const cases = contexts.flatMap(([label, ctx]) => LECTURE_PRESETS.flatMap((p) => PRESET_LENGTHS[p].map((m): [string, LecturePreset, number, PresetContext] => [label, p, m, ctx])));

  it.each(cases)('%s: %s at %i min previews within its length, and as the console counts it', (_, preset, minutes, ctx) => {
    const { resolved, expanded, console: estimate } = previewOf(preset, minutes, ctx);
    expect(expanded.slides.length).toBeGreaterThan(0);
    expect(expanded.minutes).toBeLessThanOrEqual(resolved.minutes);
    // No less than the length minus 5, except Hangul week 1 at 30 minutes: 24, its section 4.2 H row.
    const floor = resolved.preset === 'hangul-week-1' && resolved.minutes === 30 ? 24 : resolved.minutes - 5;
    expect(expanded.minutes).toBeGreaterThanOrEqual(floor);
    // A Word review counts its card cap on the console (an upper bound, section 4.4); every other
    // preset's blocks expand in full on the shipped bundle, so both sides give the same minutes.
    if (resolved.blocks.some((b) => b.kind === 'word-review')) expect(expanded.minutes).toBeLessThanOrEqual(estimate);
    else expect(expanded.minutes).toBe(estimate);
  });

  it('Hangul week 1 previews as the section 4.2 H rows (10, 19 and 24 minutes), not about 38', () => {
    expect([10, 20, 30].map((m) => previewOf('hangul-week-1', m, { catalog: CATALOG }).expanded.minutes)).toEqual([10, 19, 24]);
  });
});

describe('expandDeck: the warm-up preset (AMENDMENTS-LECTURE-V2 4.2 U, section 14)', () => {
  // Recent with 0, 1, 3 and 6 letters (presenter, app) and a console roll-up of 1 letter with no plan.
  const cases: [string, string[]][] = [
    ['0 letters', []],
    ['1 letter', ['ㅎ']],
    ['3 letters', ['ㄴ', 'ㅑ', 'ㄱ']],
    ['6 letters', ['ㅂ', 'ㅅ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ']],
    ['console roll-up of 1 letter, no plan', ['ㄱ']],
  ];
  it.each(cases)('%s: the expanded deck has exactly 4 sound-quiz slides and no scope-too-small skip', (_, revisitChars) => {
    const resolved = resolvePreset('warm-up', 10, { catalog: CATALOG, revisitChars, plan: null });
    const deck = LectureDeckSchema.parse(
      presetDeck(resolved, { id: 'lecture:warm0001', title: 'Quick warm-up', createdAt: '2026-10-15T09:00:00Z', seed: 7, source: 'quick' }),
    );
    const { slides, skipped } = expandDeck(deck, bundle(), VOICE);
    expect(only(slides, 'quiz')).toHaveLength(4);
    expect(only(slides, 'letter').length).toBeGreaterThanOrEqual(4);
    expect(skipped.filter((s) => s.reason === 'scope-too-small')).toEqual([]);
    expect(skipped.filter((s) => s.reason === 'unknown-id')).toEqual([]);
  });
});

describe('expandDeck: word-review (deck v2, AMENDMENTS-LECTURE-V2 section 4.5, LV-2)', () => {
  // Hangul syllables 가, 각, 갂, ... : 30 different words with a gloss each.
  const many = Array.from({ length: 30 }, (_, i) => ({ ko: String.fromCharCode(0xac00 + i), en: `word ${i + 1}`, romanization: `w${i + 1}` }));
  const wrScopes: Record<string, MinigameScope> = {
    'mg:many-a': { kind: 'card-match', cardPairs: many.slice(0, 8) },
    'mg:many-b': { kind: 'card-match', cardPairs: many.slice(4, 30) },
  };
  const wrQuests: Quest[] = [
    quest('review-a', [['intro'], ['present', 'mg:many-a'], ['apply', 'mg:build']], { rewardCardId: undefined }),
    quest('review-b', [['present', 'mg:many-b']], { rewardCardId: undefined }),
  ];
  const vocabWords: Record<string, LectureVocabTopic['words'][number] | 'not-ready'> = {
    'vocab:dal': { id: 'vocab:dal', ko: '달', romanization: 'dal', gloss: 'moon', wordArt: 'sky-moon' },
    'vocab:hae': { id: 'vocab:hae', ko: '해', romanization: 'hae', gloss: 'sun', cardId: 'card:sun' },
    'vocab:byeol': { id: 'vocab:byeol', ko: '별', romanization: 'byeol', gloss: 'star' },
    'vocab:gimchi': { id: 'vocab:gimchi', ko: '김치', romanization: 'gimchi', gloss: 'kimchi' },
    'vocab:draft': 'not-ready',
  };
  const wr = bundle({
    scopeFor: (ref) => wrScopes[ref] ?? scopes[ref],
    questById: (id) => wrQuests.find((q) => q.id === id) ?? quests.find((q) => q.id === id),
    vocabWord: (id) => vocabWords[id],
  });
  const review = (block: { questIds?: string[]; vocabIds?: string[]; rounds: number }, b: LectureBundle = wr, before: LectureDeckInput['blocks'] = []) =>
    expandDeck(deckOf([...before, { kind: 'word-review', questIds: block.questIds ?? [], vocabIds: block.vocabIds ?? [], rounds: block.rounds }], { v: 2 }), b, VOICE);

  it('the words its quests teach, one card each with no title slide, then a word-to-meaning quiz of its rounds', () => {
    const { slides, skipped } = review({ questIds: ['quest:review-a'], rounds: 5 });
    // Syllables (가 and 물 of mg:build) have no gloss: not reviewed words.
    expect(kinds(slides)).toEqual([...Array(8).fill('vocab'), ...Array(5).fill('quiz'), 'end']);
    expect(only(slides, 'vocab').map((s) => s.word.ko)).toEqual(many.slice(0, 8).map((w) => w.ko));
    expect(only(slides, 'vocab')[0]).toMatchObject({ key: 'word-review/가', word: { ko: '가', romanization: 'w1', gloss: 'word 1' } });
    for (const q of only(slides, 'quiz')) {
      expect(q.prompt.ask).toBe('meaning');
      if (q.prompt.ask === 'meaning') expect(many.slice(0, 8).map((w) => w.ko)).toContain(q.prompt.ko);
    }
    expect(skipped).toEqual([]);
  });

  it('at most 10 cards with 5 rounds and 20 with 10 rounds; a full deck is 10 and 20 minutes (rule 12)', () => {
    const ten = review({ questIds: ['quest:review-a', 'quest:review-b'], rounds: 5 });
    expect(only(ten.slides, 'vocab')).toHaveLength(10);
    expect(only(ten.slides, 'quiz')).toHaveLength(5);
    expect(ten.minutes).toBe(10);
    const twenty = review({ questIds: ['quest:review-a', 'quest:review-b'], rounds: 10 });
    expect(only(twenty.slides, 'vocab')).toHaveLength(20);
    expect(only(twenty.slides, 'quiz')).toHaveLength(10);
    expect(twenty.minutes).toBe(20);
    // The quiz asks only words that had a card.
    const shownKo = new Set(only(twenty.slides, 'vocab').map((s) => s.word.ko));
    for (const q of only(twenty.slides, 'quiz')) if (q.prompt.ask === 'meaning') expect(shownKo.has(q.prompt.ko)).toBe(true);
  });

  it('de-duplicates by Korean across quests and vocabIds, keeping the first; vocab words keep their picture', () => {
    const { slides } = review({ questIds: ['quest:words'], vocabIds: ['vocab:gimchi', 'vocab:dal', 'vocab:hae', 'vocab:byeol'], rounds: 5 });
    const cards = only(slides, 'vocab');
    expect(cards.map((s) => s.word.ko)).toEqual(['김치', '달', '해', '별']);
    // 김치 came from the quest first (its place and its gloss as the quest teaches it), and the
    // Word review asked for it by vocab id too, so its card still gets the vocab entry's picture.
    expect(cards[0]).toMatchObject({ word: { gloss: 'Kimchi' }, wordId: 'vocab:gimchi' });
    expect(cards[1]).toMatchObject({ wordId: 'vocab:dal', wordArt: 'sky-moon' });
    expect(cards[2]).toMatchObject({ wordId: 'vocab:hae', cardId: 'card:sun' });
    expect(only(slides, 'quiz')).toHaveLength(4);
  });

  it('expanding its quests adds no slide of theirs and no skip of theirs', () => {
    const { slides, skipped } = review({ questIds: ['quest:words', 'quest:odd'], vocabIds: ['vocab:dal', 'vocab:hae', 'vocab:byeol'], rounds: 5 });
    expect(new Set(kinds(slides))).toEqual(new Set(['vocab', 'quiz', 'end']));
    expect(skipped).toEqual([]);
  });

  it('unknown and not-ready ids are counted skips; under 4 words the quiz is a counted scope-too-small', () => {
    const { slides, skipped } = review({ questIds: ['quest:nope'], vocabIds: ['vocab:nope', 'vocab:draft', 'vocab:dal'], rounds: 5 });
    expect(kinds(slides)).toEqual(['vocab', 'end']);
    expect(skipped).toEqual([
      { blockIndex: 0, ref: 'quest:nope', reason: 'unknown-id' },
      { blockIndex: 0, ref: 'vocab:nope', reason: 'unknown-id' },
      { blockIndex: 0, ref: 'vocab:draft', reason: 'not-ready' },
      { blockIndex: 0, ref: 'word-review/quiz', reason: 'scope-too-small' },
    ]);
  });

  it('a bundle with no vocab lookup yet counts vocabIds as not ready, never a crash', () => {
    const noLookup = bundle({ scopeFor: wr.scopeFor, questById: wr.questById });
    const { slides, skipped } = review({ vocabIds: ['vocab:dal'], rounds: 5 }, noLookup);
    expect(slides).toEqual([]);
    expect(skipped).toEqual([
      { blockIndex: 0, ref: 'vocab:dal', reason: 'not-ready' },
      { blockIndex: 0, ref: 'word-review/quiz', reason: 'scope-too-small' },
    ]);
  });

  it('a word already shown earlier in the deck gets no second card but is still asked', () => {
    const { slides } = review({ questIds: ['quest:review-a'], rounds: 10 }, wr, [{ kind: 'quest', id: 'quest:review-a' }]);
    const words = only(slides, 'vocab').map((s) => s.word.ko);
    expect(words).toEqual(many.slice(0, 8).map((w) => w.ko));
    expect(only(slides, 'quiz').filter((q) => q.key.startsWith('word-review/'))).toHaveLength(8);
  });

  it('words not yet shown in the deck fill the card cap first, so an earlier block never shrinks the review', () => {
    const { slides } = review({ questIds: ['quest:review-a', 'quest:review-b'], rounds: 5 }, wr, [{ kind: 'quest', id: 'quest:review-a' }]);
    const reviewCards = only(slides, 'vocab').filter((s) => s.key.startsWith('word-review/'));
    expect(reviewCards.map((s) => s.word.ko)).toEqual(many.slice(8, 18).map((w) => w.ko));
    expect(only(slides, 'quiz').filter((q) => q.key.startsWith('word-review/'))).toHaveLength(5);
  });

  it('is deterministic for a seed, and the End slide lists the reviewed words', () => {
    const blocks = { questIds: ['quest:review-a', 'quest:review-b'], rounds: 10 };
    expect(review(blocks).slides).toEqual(review(blocks).slides);
    const end = only(review(blocks).slides, 'end')[0]!;
    expect(end.words).toHaveLength(20);
  });
});

describe('expandDeck: every word card carries its sound (section 3.4 amendment 2026-10-17)', () => {
  const sagwaClip = 'audio/vocab/sagwa-apple.mp3';
  const helloClip = 'audio/vocab/annyeong.mp3';
  const spokenScopes: Record<string, MinigameScope> = {
    'mg:pic-spoken': {
      kind: 'pic-word-match',
      picWord: {
        boards: [
          {
            pairs: [
              { id: 'bap', word: { ko: '밥', romanization: 'bap', en: 'rice', spokenKo: '밥이요', audioRef: 'audio/vocab/bap.mp3' } },
              { id: 'mul', word: { ko: '물', romanization: 'mul', en: 'water' } },
              { id: 'san', word: { ko: '산', romanization: 'san', en: 'mountain' } },
            ],
          },
        ],
      },
    },
  };
  const spokenQuest: Quest = {
    ...quest('spoken', [['intro'], ['discover'], ['practice', 'mg:pic-spoken']], { rewardCardId: undefined }),
  };
  const withSpokenDiscover: Quest = {
    ...spokenQuest,
    steps: spokenQuest.steps.map((step) =>
      step.kind === 'discover'
        ? {
            ...step,
            discover: {
              pages: [
                { items: [{ type: 'word', word: { ko: '사과', romanization: 'sagwa', en: 'apple', spokenKo: '사과요', audioRef: sagwaClip } }] },
                { items: [{ type: 'sentence', sentence: { ko: '안녕하세요', romanization: 'annyeonghaseyo', en: 'Hello', audioRef: helloClip } }] },
              ],
            },
          }
        : step,
    ),
  };
  const spokenTopic: LectureVocabTopic = {
    title: 'Food',
    words: [
      { id: 'vocab:gimbap', ko: '김밥', romanization: 'gimbap', gloss: 'gimbap', spokenKo: '김빱', audioRef: 'audio/vocab/gimbap.mp3' },
      { id: 'vocab:bap', ko: '밥', romanization: 'bap', gloss: 'rice' },
    ],
  };
  const spoken = bundle({
    scopeFor: (ref) => spokenScopes[ref] ?? scopes[ref],
    questById: (id) => (id === withSpokenDiscover.id ? withSpokenDiscover : quests.find((q) => q.id === id)),
    vocabTopic: (id) => (id === 'vocab-topic:spoken' ? spokenTopic : undefined),
    vocabWord: (id) => spokenTopic.words.find((w) => w.id === id),
  });
  const vocabSlides = (blocks: LectureDeckInput['blocks'], v: 1 | 2 = 1) => only(expandDeck(deckOf(blocks, { v }), spoken, VOICE).slides, 'vocab');
  const byKo = (slides: ReturnType<typeof vocabSlides>, ko: string) => slides.find((s) => s.word.ko === ko);

  it('a topic word with spokenKo and audioRef plays them; one without plays its word', () => {
    const slides = vocabSlides([{ kind: 'vocab', topicId: 'vocab-topic:spoken' }]);
    expect(byKo(slides, '김밥')).toMatchObject({ spoken: { text: '김빱', romanization: 'gimbap', audioRef: 'audio/vocab/gimbap.mp3' }, speech: 'word' });
    expect(byKo(slides, '밥')?.spoken).toEqual({ text: '밥', romanization: 'bap' });
  });

  it('a Discover KoText carries its spokenKo and audioRef; a sentence is its own slide with its clip (LV-S1)', () => {
    const slides = vocabSlides([{ kind: 'quest', id: 'quest:spoken' }]);
    expect(byKo(slides, '사과')).toMatchObject({ spoken: { text: '사과요', romanization: 'sagwa', audioRef: sagwaClip }, speech: 'word' });
    expect(byKo(slides, '안녕하세요')).toBeUndefined();
    const sentence = only(expandDeck(deckOf([{ kind: 'quest', id: 'quest:spoken' }]), spoken, VOICE).slides, 'sentence')[0];
    expect(sentence?.sentence.spoken).toEqual({ text: '안녕하세요', romanization: 'annyeonghaseyo', audioRef: helloClip });
  });

  it('a pic-word board word carries its KoText sound; a card pair without one plays its word', () => {
    expect(byKo(vocabSlides([{ kind: 'quest', id: 'quest:spoken' }]), '밥')).toMatchObject({ spoken: { text: '밥이요', romanization: 'bap', audioRef: 'audio/vocab/bap.mp3' }, speech: 'word' });
    const cards = vocabSlides([{ kind: 'quest', id: 'quest:words' }]);
    expect(byKo(cards, '김치')).toMatchObject({ spoken: { text: '김치', romanization: 'gimchi' }, speech: 'word' });
    expect(byKo(cards, '김치')?.spoken).not.toHaveProperty('audioRef');
  });

  it('a Word review card keeps the sound its quest gave it, and the vocab entry its clip', () => {
    const slides = vocabSlides([{ kind: 'word-review', questIds: ['quest:spoken'], vocabIds: ['vocab:gimbap', 'vocab:bap'], rounds: 5 }], 2);
    expect(byKo(slides, '안녕하세요')).toMatchObject({ spoken: { text: '안녕하세요', audioRef: helloClip }, speech: 'sentence' });
    expect(byKo(slides, '김밥')).toMatchObject({ spoken: { text: '김빱', audioRef: 'audio/vocab/gimbap.mp3' }, speech: 'word' });
    // 밥 came first from the quest board, with its own clip; the vocab entry has none to give.
    expect(byKo(slides, '밥')?.spoken).toEqual({ text: '밥이요', romanization: 'bap', audioRef: 'audio/vocab/bap.mp3' });
  });

  it('a word the quest taught without a clip takes the vocab entry clip in a Word review', () => {
    const plain: LectureVocabTopic['words'][number] = { id: 'vocab:mul', ko: '물', romanization: 'mul', gloss: 'water', audioRef: 'audio/vocab/mul.mp3' };
    const b = bundle({ ...spoken, vocabWord: (id) => (id === plain.id ? plain : undefined) });
    const slides = only(expandDeck(deckOf([{ kind: 'word-review', questIds: ['quest:spoken'], vocabIds: ['vocab:mul'], rounds: 5 }], { v: 2 }), b, VOICE).slides, 'vocab');
    expect(byKo(slides, '물')?.spoken).toEqual({ text: '물', romanization: 'mul', audioRef: 'audio/vocab/mul.mp3' });
  });

  it('a quest word with its own spokenKo keeps it in a Word review; the vocab entry gives only its clip path', () => {
    // The quest board says 물 as "물이요" (no clip); the vocab entry for 물 has a different spoken form and a clip path.
    const boardScope: MinigameScope = {
      kind: 'pic-word-match',
      picWord: {
        boards: [
          {
            pairs: [
              { id: 'mul', word: { ko: '물', romanization: 'mul', en: 'water', spokenKo: '물이요' } },
              { id: 'san', word: { ko: '산', romanization: 'san', en: 'mountain' } },
              { id: 'bam', word: { ko: '밤', romanization: 'bam', en: 'night' } },
            ],
          },
        ],
      },
    };
    const boardQuest: Quest = { ...quest('mulboard', [['intro'], ['practice', 'mg:mul-board']], { rewardCardId: undefined }) };
    const vocabMul: LectureVocabTopic['words'][number] = { id: 'vocab:mul', ko: '물', romanization: 'mul', gloss: 'water', spokenKo: '무울', audioRef: 'audio/vocab/mul.mp3' };
    const b = bundle({
      ...spoken,
      scopeFor: (ref) => (ref === 'mg:mul-board' ? boardScope : spokenScopes[ref] ?? scopes[ref]),
      questById: (id) => (id === boardQuest.id ? boardQuest : quests.find((q) => q.id === id)),
      vocabWord: (id) => (id === vocabMul.id ? vocabMul : undefined),
    });
    const slides = only(expandDeck(deckOf([{ kind: 'word-review', questIds: [boardQuest.id], vocabIds: ['vocab:mul'], rounds: 5 }], { v: 2 }), b, VOICE).slides, 'vocab');
    expect(byKo(slides, '물')?.spoken).toEqual({ text: '물이요', romanization: 'mul', audioRef: 'audio/vocab/mul.mp3' });
    expect(byKo(slides, '물')?.speech).toBe('word');
  });

  it('a syllable slide plays the syllable itself (the scope syllable has no clip in the schema)', () => {
    const syllable = only(expand([{ kind: 'quest', id: 'quest:letters' }]).slides, 'syllable')[0];
    expect(syllable?.spoken).toEqual({ text: '가', romanization: 'ga' });
  });

  it('what a deck teaches is unchanged: taught words carry no sound', () => {
    const { taught } = expandDeck(deckOf([{ kind: 'quest', id: 'quest:spoken' }]), spoken, VOICE);
    expect(taught.find((t) => t.ko === '사과')).toEqual({ kind: 'word', ko: '사과', romanization: 'sagwa', gloss: 'apple' });
  });
});

describe('expandDeck: the reading slides (AMENDMENTS-LECTURE-V2 section 5.1, LV-S1)', () => {
  const realiaScope: MinigameScope = {
    kind: 'realia-read',
    realiaRead: {
      realia: {
        ref: 'realia:menu',
        kind: 'menu',
        title: { ko: '메뉴', romanization: 'menyu', en: 'menu' },
        entries: [
          { id: 'gimbap', text: { ko: '김밥', romanization: 'gimbap', en: 'gimbap' }, value: { ko: '이천 원', romanization: 'icheon won', en: '2,000 won' } },
          { id: 'mul', text: { ko: '물', romanization: 'mul', en: 'water', spokenKo: '무울' } },
        ],
        altEn: 'A small menu: gimbap and water.',
      },
      rounds: [],
    },
  };
  const plainScope: MinigameScope = {
    kind: 'realia-read',
    realiaRead: { realia: { ref: 'realia:slip', entries: [{ id: 'a', text: { ko: '라면', romanization: 'ramyeon', en: 'ramyeon' } }], altEn: 'An order slip.' }, rounds: [] },
  };
  const readingScopes: Record<string, MinigameScope> = { 'mg:realia': realiaScope, 'mg:slip': plainScope, 'mg:pairs': { kind: 'card-match', cardPairs: [{ ko: '김밥', en: 'gimbap', romanization: 'gimbap' }, { ko: '사과', en: 'apple', romanization: 'sagwa' }] } };
  const kt = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });
  const withPages = (slug: string, steps: StepSpec[], pages: NonNullable<QuestStep['discover']>['pages']): Quest => {
    const q = quest(slug, steps, { rewardCardId: undefined });
    return { ...q, steps: q.steps.map((step) => (step.kind === 'discover' ? { ...step, discover: { pages } } : step)) };
  };
  const reading = withPages('reading', [['intro'], ['discover'], ['practice', 'mg:realia'], ['apply', 'mg:pairs']], [
    {
      items: [
        { type: 'sentence', sentence: kt('물을 마셔요.', 'mureul masyeoyo', 'I drink water.'), picture: 'word:food-water' },
        { type: 'sentence', sentence: kt('집에 와요.', 'jibe wayo', 'I come home.') },
      ],
    },
    {
      items: [
        {
          type: 'pattern',
          frame: kt('___을/를 먹어요.', '___eul/reul meogeoyo', 'I eat ___.'),
          noteEn: 'Put {ko:을} after a final consonant or {ko:를} after a vowel.',
          examples: [kt('밥을 먹어요.', 'babeul meogeoyo', 'I eat rice.'), { ...kt('사과를 먹어요.', 'sagwareul meogeoyo', 'I eat an apple.'), audioRef: 'audio/x.mp3' }],
        },
      ],
    },
    {
      items: [
        {
          type: 'exchange',
          lines: [
            { speaker: 'a', speakerEn: 'Grandma', line: kt('밥 먹었어요?', 'bap meogeosseoyo', 'Have you eaten?') },
            { speaker: 'b', speakerEn: 'Hoya', line: kt('네, 먹었어요.', 'ne meogeosseoyo', 'Yes, I ate.') },
          ],
        },
      ],
    },
    { items: [{ type: 'realia', realiaRef: 'realia:menu', keyWords: [kt('메뉴', 'menyu', 'menu'), kt('김밥', 'gimbap', 'gimbap')], captionEn: 'A menu on the table.' }], captionEn: 'Read the menu first.' },
    { items: [{ type: 'realia', realiaRef: 'realia:gone', keyWords: [kt('라면', 'ramyeon', 'instant noodles')] }] },
    { items: [{ type: 'word', word: kt('김밥', 'gimbap', 'gimbap') }] },
  ]);
  const slip = withPages('slip', [['discover'], ['practice', 'mg:slip']], [
    { items: [{ type: 'realia', realiaRef: 'realia:slip', keyWords: [kt('라면', 'ramyeon', 'instant noodles')] }], captionEn: 'Read {ko:천} on the slip.' },
    { items: [{ type: 'pattern', frame: kt('___에 ___을/를 먹었어요.', '___e ___eul/reul meogeosseoyo', 'On ___, I ate ___.'), noteEn: 'Odd {ko:A1} here.', examples: [kt('설날에 떡국을 먹었어요.', 'seollare tteokgugeul meogeosseoyo', 'On Seollal, I ate rice cake soup.'), kt('추석에 송편을 먹었어요.', 'chuseoge songpyeoneul meogeosseoyo', 'On Chuseok, I ate songpyeon.')] }] },
    { items: [{ type: 'realia', realiaRef: 'realia:slip', keyWords: [kt('라면', 'ramyeon', 'instant noodles')], captionEn: 'A {ko:B2} slip.' }] },
  ]);
  const b = bundle({
    scopeFor: (ref) => readingScopes[ref] ?? scopes[ref],
    questById: (id) => [reading, slip].find((q) => q.id === id) ?? quests.find((q) => q.id === id),
  });
  const run = (id: string, over: Partial<LectureDeckInput> = {}) => expandDeck(deckOf([{ kind: 'quest', id }], over), b, VOICE);

  it('a sentence, a pattern, an exchange and a realia page each get their own slide, in page order', () => {
    const { slides } = run(reading.id);
    // Then the fallback card of the realia with no sheet (라면) and the card pair's unseen word (사과); the realia read step is not shown yet.
    expect(kinds(slides)).toEqual(['title', 'sentence', 'sentence', 'pattern', 'read-along', 'realia', 'vocab', 'vocab', 'end']);
    expect(keys(slides).slice(1, 6)).toEqual([
      'quest:reading/s2/sentence-1-1',
      'quest:reading/s2/sentence-1-2',
      'quest:reading/s2/pattern-2-1',
      'quest:reading/s2/exchange-3-1',
      'quest:reading/s2/realia-4-1',
    ]);
    expect(new Set(keys(slides)).size).toBe(slides.length);
  });

  it('sentence: the Korean, its romanization, the meaning and its sound; the picture only when the item has one', () => {
    const [withPic, plain] = only(run(reading.id).slides, 'sentence');
    expect(withPic).toMatchObject({
      sentence: { ko: '물을 마셔요.', romanization: 'mureul masyeoyo', gloss: 'I drink water.', spoken: { text: '물을 마셔요.', romanization: 'mureul masyeoyo' } },
      picture: 'word:food-water',
      builds: ['ko', 'gloss', 'art'],
    });
    expect(plain).not.toHaveProperty('picture');
    expect(plain!.builds).toEqual(['ko', 'gloss']);
    expect(only(run(reading.id, { options: { romanization: 'tap', strokeGuide: true, quizRounds: 5, sound: true } }).slides, 'sentence')[0]!.builds).toEqual(['ko', 'rom', 'gloss', 'art']);
  });

  it('pattern: the frame around its gaps, the note with its Korean chips, the two examples with their sounds', () => {
    const pattern = only(run(reading.id).slides, 'pattern')[0]!;
    expect(pattern.frame).toEqual({ pieces: ['', '을/를 먹어요.'], romanization: '___eul/reul meogeoyo', gloss: 'I eat ___.' });
    expect(pattern.note).toEqual([
      { text: 'Put ' },
      { ko: '을', romanization: 'eul' },
      { text: ' after a final consonant or ' },
      { ko: '를', romanization: 'reul' },
      { text: ' after a vowel.' },
    ]);
    expect(pattern.examples.map((e) => [e.ko, e.romanization, e.gloss])).toEqual([
      ['밥을 먹어요.', 'babeul meogeoyo', 'I eat rice.'],
      ['사과를 먹어요.', 'sagwareul meogeoyo', 'I eat an apple.'],
    ]);
    expect(pattern.examples[1]!.spoken).toEqual({ text: '사과를 먹어요.', romanization: 'sagwareul meogeoyo', audioRef: 'audio/x.mp3' });
    expect(pattern.builds).toEqual(['frame', 'note', 'example', 'example']);
  });

  it('a two-slot frame keeps three pieces; a note token with no romanization drops the note and is counted', () => {
    const { slides, skipped } = run(slip.id);
    const pattern = only(slides, 'pattern')[0]!;
    expect(pattern.frame.pieces).toEqual(['', '에 ', '을/를 먹었어요.']);
    expect(pattern).not.toHaveProperty('note');
    expect(pattern.builds).toEqual(['frame', 'example', 'example']);
    expect(skipped).toContainEqual({ blockIndex: 0, ref: 'quest:slip/s1/pattern-2-1/note', reason: 'no-romanization' });
  });

  it('read along: the two lines with their speakers, each with its sound', () => {
    const readAlong = only(run(reading.id).slides, 'read-along')[0]!;
    expect(readAlong.lines.map((l) => [l.speaker, l.ko, l.romanization, l.gloss, l.spoken.text])).toEqual([
      ['Grandma', '밥 먹었어요?', 'bap meogeosseoyo', 'Have you eaten?', '밥 먹었어요?'],
      ['Hoya', '네, 먹었어요.', 'ne meogeosseoyo', 'Yes, I ate.', '네, 먹었어요.'],
    ]);
    expect(readAlong.builds).toEqual(['line', 'line']);
    expect(readAlong).not.toHaveProperty('together');
  });

  it('read along with no Korean voice, or with the deck sound off: every line shows together at one build (section 5.1)', () => {
    const noVoice = only(expandDeck(deckOf([{ kind: 'quest', id: reading.id }]), b, { canPlayKorean: false }).slides, 'read-along')[0]!;
    expect(noVoice.together).toBe(true);
    expect(noVoice.lines).toHaveLength(2);
    expect(noVoice.builds).toEqual(['line']);
    const tap = only(expandDeck(deckOf([{ kind: 'quest', id: reading.id }], { options: { romanization: 'tap', strokeGuide: true, quizRounds: 5, sound: true } }), b, { canPlayKorean: false }).slides, 'read-along')[0]!;
    expect(tap.builds).toEqual(['line', 'rom']);
    const soundOff = only(run(reading.id, { options: { romanization: 'always', strokeGuide: true, quizRounds: 5, sound: false } }).slides, 'read-along')[0]!;
    expect(soundOff.together).toBe(true);
    // The other reading slides keep their builds with no voice.
    expect(only(expandDeck(deckOf([{ kind: 'quest', id: reading.id }]), b, { canPlayKorean: false }).slides, 'pattern')[0]!.builds).toEqual(['frame', 'note', 'example', 'example']);
  });

  it('realia: the sheet the quest plays, its caption and its key words; Sound reads the sheet line by line', () => {
    const realia = only(run(reading.id).slides, 'realia')[0]!;
    expect(realia.sheet).toEqual({
      kind: 'menu',
      heading: { ko: '메뉴', romanization: 'menyu' },
      entries: [
        { id: 'gimbap', text: { ko: '김밥', romanization: 'gimbap' }, value: { ko: '이천 원', romanization: 'icheon won' } },
        { id: 'mul', text: { ko: '물', romanization: 'mul' } },
      ],
      alt: 'A small menu: gimbap and water.',
      spoken: { text: '메뉴, 김밥 이천 원, 무울', romanization: 'menyu, gimbap icheon won, mul' },
    });
    expect(realia.caption).toEqual([{ text: 'A menu on the table.' }]);
    expect(realia.keyWords.map((w) => [w.ko, w.gloss])).toEqual([
      ['메뉴', 'menu'],
      ['김밥', 'gimbap'],
    ]);
    expect(realia.builds).toEqual(['sheet', 'words']);
  });

  it("a realia with no kind is the plain sheet; with no caption of its own it shows its page's, Korean tokens as chips", () => {
    const { slides, skipped } = run(slip.id);
    const [first, second] = only(slides, 'realia');
    expect(first!.sheet.kind).toBe('plain');
    expect(first!.sheet).not.toHaveProperty('heading');
    expect(first!.caption).toEqual([{ text: 'Read ' }, { ko: '천', romanization: 'cheon' }, { text: ' on the slip.' }]);
    // A caption token with no romanization drops the caption, counted (rule 11).
    expect(second).not.toHaveProperty('caption');
    expect(skipped).toContainEqual({ blockIndex: 0, ref: 'quest:slip/s1/realia-3-1/caption', reason: 'no-romanization' });
  });

  it('a realia whose sheet the quest does not hold is a counted skip; its key words become word cards', () => {
    const { slides, skipped } = run(reading.id);
    expect(skipped).toContainEqual({ blockIndex: 0, ref: 'realia:gone', reason: 'unknown-id' });
    expect(only(slides, 'vocab').map((v) => v.word.ko)).toEqual(['라면', '사과']);
  });

  it('what a reading slide shows is taught, in order, and seen: no later word card repeats it', () => {
    const { slides, taught } = run(reading.id);
    expect(taught.map((t) => t.ko)).toEqual(['물을 마셔요.', '집에 와요.', '밥을 먹어요.', '사과를 먹어요.', '밥 먹었어요?', '네, 먹었어요.', '메뉴', '김밥', '라면', '사과']);
    // 김밥 was a key word on the realia page: the later word item and the card pair have no card of it.
    expect(only(slides, 'vocab').some((v) => v.word.ko === '김밥')).toBe(false);
    expect(only(slides, 'end')[0]!.words.map((w) => w.ko)).toContain('네, 먹었어요.');
  });

  it('the Discover pages count no skip of their own, and the same deck gives the same slides', () => {
    const { skipped } = run(reading.id);
    expect(skipped.filter((s) => s.ref.startsWith('quest:reading/s2'))).toEqual([]);
    expect(run(reading.id).slides).toEqual(run(reading.id).slides);
  });

  it('a Word review of the quest keeps each sound its reading slide gave it', () => {
    const review = expandDeck(deckOf([{ kind: 'word-review', questIds: [reading.id], vocabIds: [], rounds: 5 }], { v: 2 }), b, VOICE);
    const card = (ko: string) => only(review.slides, 'vocab').find((v) => v.word.ko === ko);
    expect(card('사과를 먹어요.')).toMatchObject({ spoken: { audioRef: 'audio/x.mp3' }, speech: 'sentence' });
    expect(card('메뉴')?.speech).toBe('word');
  });
});
