import { describe, expect, it } from 'vitest';
import { lessonOccurrences, stage1Occurrences, storyOccurrences, symbolsByChar, type ReviewSymbol } from '../review-items/extract';
import { lessonSourcesOfTree, storySourcesOfTree, vocabOfTree } from '../review-items/sources';

// F-CURR-002 §4.2 (row CM-10): the three extraction sources over small hand-made files.

const SYMBOLS: ReviewSymbol[] = [
  { id: 'jamo:giyeok', char: 'ㄱ', kind: 'consonant', romanization: 'g/k' },
  { id: 'jamo:a', char: 'ㅏ', kind: 'vowel', romanization: 'a' },
  { id: 'jamo:giyeok-batchim', char: 'ㄱ', kind: 'batchim', romanization: 'k' },
];
const kt = (ko: string, romanization: string, en?: string) => (en === undefined ? { ko, romanization } : { ko, romanization, en });

const step = (id: string, kind: string, ref?: string) => (ref === undefined ? { id, kind } : { id, kind, minigameRef: ref });
const cell = {
  id: 'episode:stage2-life',
  status: 'ready',
  quests: [
    {
      id: 'quest:stage2-life-q1',
      steps: [
        step('s1', 'intro'),
        {
          id: 's2',
          kind: 'discover',
          discover: {
            pages: [
              {
                items: [
                  { type: 'jamo', jamoId: 'jamo:giyeok', example: kt('가방', 'gabang', 'bag') },
                  { type: 'jamo', jamoId: 'jamo:unknown', example: kt('나', 'na', 'I') },
                ],
              },
              { items: [{ type: 'word', word: kt('사과', 'sagwa', 'apple'), picture: 'word:food-apple' }, { type: 'sentence', sentence: kt('사과 주세요.', 'sagwa juseyo.', 'An apple, please.') }] },
              { items: [{ type: 'pattern', frame: kt('___ 주세요.', '___ juseyo.', '___, please.'), examples: [kt('물 주세요.', 'mul juseyo.', 'Water, please.'), kt('밥 주세요.', 'bap juseyo.', 'Rice, please.')] }] },
              {
                items: [
                  { type: 'exchange', lines: [{ speaker: 'a', speakerEn: 'Hoya', line: kt('안녕하세요!', 'annyeonghaseyo!', 'Hello!') }, { speaker: 'b', speakerEn: 'Mina', line: kt('안녕하세요!', 'annyeonghaseyo!', 'Hello!') }] },
                  { type: 'realia', realiaRef: 'realia:menu-dishes', keyWords: [kt('김밥', 'gimbap', 'kimbap')], captionEn: 'A menu' },
                ],
              },
              { items: [{ type: 'exchange', lines: [{ speaker: 'a', line: kt('네.', 'ne.', 'Yes.') }] }, { type: 'future', thing: kt('떡', 'tteok', 'rice cake'), note: 'not Korean' }] },
            ],
          },
        },
        step('s3', 'practice', 'minigame:s2-life-q1-play'),
        step('s4', 'apply', 'minigame:s2-life-q1-apply'),
        step('s5', 'check', 'minigame:s2-life-q1-check'),
        step('s6', 'reward'),
        step('s7', 'apply'),
        step('s8', 'apply', 'minigame:s2-life-q1-missing'),
        step('s9', 'intro', 'minigame:s2-life-q1-play'),
      ],
      scopes: [
        {
          ref: 'minigame:s2-life-q1-play',
          kind: 'listen-pick',
          rounds: [
            { id: 'r1', prompt: kt('사과', 'sagwa', 'apple'), options: [{ id: 'a', text: kt('사과', 'sagwa', 'apple') }, { id: 'b', text: kt('바나나', 'banana', 'banana') }], answerId: 'a' },
            { id: 'r2', prompt: kt('ㄱ', 'g/k'), pictureRef: 'card:x', options: [{ id: 'a', text: kt('물', 'mul', 'water'), pictureRef: 'word:w' }], answerId: 'a' },
            { id: 'r3', prompt: kt('5,000', '5,000', '5,000'), options: [{ id: 'a', pictureRef: 'word:w' }], answerId: 'a' },
            { id: 'r4', prompt: kt('ㅎ', 'h'), options: [], answerId: 'z' },
          ],
        },
        {
          ref: 'minigame:s2-life-q1-apply',
          kind: 'pic-word-match',
          boards: [{ pairs: [{ id: 'p1', pictureRef: 'word:food-apple', word: kt('사과', 'sagwa', 'apple') }, { id: 'p2', word: kt('배', 'bae', 'pear') }] }],
        },
        {
          ref: 'minigame:s2-life-q1-check',
          kind: 'build-letter',
          words: [kt('우유', 'uyu', 'milk')],
        },
      ],
    },
    {
      id: 'quest:stage2-life-q2',
      steps: [
        step('s3', 'practice', 'minigame:s2-life-q2-a'),
        step('s4', 'apply', 'minigame:s2-life-q2-b'),
        step('s5', 'apply', 'minigame:s2-life-q2-c'),
        step('s6', 'apply', 'minigame:s2-life-q2-d'),
        step('s7', 'apply', 'minigame:s2-life-q2-e'),
        step('s8', 'apply', 'minigame:s2-life-q2-f'),
        step('s9', 'apply', 'minigame:s2-life-q2-g'),
        step('s10', 'apply', 'minigame:s2-life-q2-h'),
        step('s11', 'check', 'minigame:s2-life-q2-i'),
        step('s12', 'check', 'minigame:s2-life-q2-j'),
        step('s13', 'check', 'minigame:s2-life-q2-k'),
      ],
      scopes: [
        { ref: 'minigame:s2-life-q2-a', kind: 'card-match', pairs: [kt('물', 'mul', 'water')] },
        {
          ref: 'minigame:s2-life-q2-b',
          kind: 'tap-respond',
          turns: [
            { line: kt('뭐 먹어요?', 'mwo meogeoyo?', 'What do you eat?'), replies: [{ id: 'x', text: kt('밥 먹어요.', 'bap meogeoyo.', 'I eat rice.'), correct: true }, { id: 'y', text: kt('네.', 'ne.', 'Yes.'), correct: false }] },
            { line: kt('아니요.', 'aniyo.', 'No.'), replies: [{ id: 'x', text: kt('네.', 'ne.', 'Yes.'), correct: false }] },
          ],
        },
        { ref: 'minigame:s2-life-q2-c', kind: 'story-sequence', lines: [{ id: 'l1', line: kt('안녕!', 'annyeong!', 'Hi!') }] },
        { ref: 'minigame:s2-life-q2-d', kind: 'order-it', rounds: [{ id: 'o1', sentence: kt('사과를 먹어요.', 'sagwareul meogeoyo.', 'I eat an apple.'), pictureRef: 'word:food-apple' }] },
        {
          ref: 'minigame:s2-life-q2-e',
          kind: 'realia-read',
          realia: { ref: 'realia:menu-prices', title: kt('메뉴', 'menyu', 'menu'), entries: [{ id: 'e1', text: kt('김밥', 'gimbap', 'kimbap'), value: kt('이천 원', 'icheon won', '2,000 won') }], altEn: 'A menu with prices' },
          rounds: [
            { id: 'q1', key: kt('김밥', 'gimbap', 'kimbap'), options: [{ id: 'a', figure: '2,000' }], answerId: 'a' },
            { id: 'q2', options: [{ id: 'a', text: kt('이천 원', 'icheon won', '2,000 won') }], answerId: 'a' },
            { id: 'q3', options: [{ id: 'a', figure: '1' }], answerId: 'b' },
            // A key word that is an entry's value; one the card does not hold (no gloss key); one glossed otherwise than the card.
            { id: 'q4', key: kt('이천 원', 'icheon won', '2,000 won'), options: [], answerId: 'a' },
            { id: 'q5', key: kt('물', 'mul', 'water'), options: [], answerId: 'a' },
            { id: 'q6', key: kt('김밥', 'gimbap', 'seaweed rice roll'), options: [], answerId: 'a' },
          ],
        },
        { ref: 'minigame:s2-life-q2-f', kind: 'type-hangul', rounds: [{ id: 't1', target: kt('학교', 'hakgyo', 'school'), pictureRef: 'word:school', soundChange: true }] },
        { ref: 'minigame:s2-life-q2-g', kind: 'trace-word', rounds: [{ id: 't1', word: kt('달', 'dal', 'moon') }] },
        {
          ref: 'minigame:s2-life-q2-h',
          kind: 'write-frame',
          rounds: [{ id: 'w1', frame: kt('___을/를 좋아해요.', '___eul/reul joahaeyo.', 'I like ___.'), slots: [{ id: 's1', bank: [kt('사과', 'sagwa', 'apple')] }] }],
        },
        { ref: 'minigame:s2-life-q2-i', kind: 'future-game', board: [{ ko: '배', romanization: 'bae', en: 'boat' }], deck: { top: { card: kt('눈', 'nun', 'snow') } }, other: 'x' },
        { ref: 'minigame:s2-life-q2-j', kind: 'realia-read', realia: { entries: [] }, rounds: [] },
        { ref: 'minigame:s2-life-q2-k', kind: 'tap-respond', turns: [{ line: kt('네.', 'ne.') }] },
      ],
    },
    'not a quest',
  ],
};

const source = { file: 'content/episodes/stage-2/life.json', body: cell, cellId: 'episode:stage2-life', stage: 2, home: 'life' as const, volume: 1 };

describe('lessonOccurrences: every Discover item and every scored round answer', () => {
  const occs = lessonOccurrences(source, SYMBOLS);
  const view = occs.map((o) => [o.kind, o.ko, o.source, o.glossKey ?? '', o.picture ?? '', o.loose === true ? 'loose' : '', o.reply?.ko ?? '', o.ref ?? '', o.soundChange === true ? 'sc' : '']);

  it('reads the Discover items, with their overlay gloss keys', () => {
    const q = 'quest:stage2-life-q1#steps.s2.discover.pages';
    expect(view.filter((v) => v[2] === 'discover')).toEqual([
      ['sym', 'ㄱ', 'discover', '', '', '', '', 'jamo:giyeok', ''],
      ['lex', '사과', 'discover', `${q}.1.items.0.word.gloss`, 'word:food-apple', '', '', '', ''],
      ['pat', '사과 주세요.', 'discover', `${q}.1.items.1.sentence.gloss`, '', '', '', '', ''],
      ['pat', '___ 주세요.', 'discover', `${q}.2.items.0.frame.gloss`, '', '', '', '', ''],
      ['exc', '안녕하세요!', 'discover', `${q}.3.items.0.lines.0.line.gloss`, '', '', '안녕하세요!', '', ''],
      ['lex', '김밥', 'discover', `${q}.3.items.1.keyWords.gimbap.gloss`, '', '', '', '', ''],
      ['rea', '김밥', 'discover', `${q}.3.items.1.caption`, '', '', '', 'realia:menu-dishes', ''],
      ['lex', '떡', 'discover', '', '', '', '', '', ''],
    ]);
    const exchange = occs.find((o) => o.kind === 'exc' && o.source === 'discover');
    expect(exchange?.reply).toEqual({ ko: '안녕하세요!', romanization: 'annyeonghaseyo!', en: 'Hello!', glossKey: `${q}.3.items.0.lines.1.line.gloss` });
  });

  it('reads the answers of the scored steps only, each game by its own shape', () => {
    const m = (q: string, field: string) => `minigame:s2-life-${q}#${field}`;
    expect(view.filter((v) => v[2] === 'round')).toEqual([
      ['lex', '사과', 'round', m('q1-play', 'listenPick.rounds.r1.prompt'), '', 'loose', '', '', ''],
      ['sym', 'ㄱ', 'round', '', '', '', '', 'jamo:giyeok', ''],
      ['lex', '물', 'round', '', 'card:x', 'loose', '', '', ''],
      ['lex', '사과', 'round', m('q1-apply', 'picWord.boards.0.pairs.p1.word.gloss'), 'word:food-apple', 'loose', '', '', ''],
      ['lex', '배', 'round', m('q1-apply', 'picWord.boards.0.pairs.p2.word.gloss'), '', 'loose', '', '', ''],
      ['lex', '우유', 'round', '', '', 'loose', '', '', ''],
      ['lex', '물', 'round', m('q2-a', 'cardPairs.mul.gloss'), '', 'loose', '', '', ''],
      ['exc', '뭐 먹어요?', 'round', m('q2-b', 'dialogue.0.npc'), '', '', '밥 먹어요.', '', ''],
      ['pat', '안녕!', 'round', m('q2-c', 'storySteps.l1.label'), '', '', '', '', ''],
      ['pat', '사과를 먹어요.', 'round', m('q2-d', 'orderIt.rounds.o1.sentence.gloss'), 'word:food-apple', '', '', '', ''],
      ['rea', '메뉴', 'round', m('q2-e', 'realiaRead.realia.alt'), '', '', '', 'realia:menu-prices', ''],
      // A realia round's key word is glossed at the card entry it names.
      ['lex', '김밥', 'round', 'minigame:s2-life-q2-e#realiaRead.realia.entries.e1.text.gloss', '', 'loose', '', '', ''],
      ['lex', '이천 원', 'round', m('q2-e', 'realiaRead.rounds.q2.options.a.text.gloss'), '', 'loose', '', '', ''],
      ['lex', '이천 원', 'round', m('q2-e', 'realiaRead.realia.entries.e1.value.gloss'), '', 'loose', '', '', ''],
      ['lex', '물', 'round', '', '', 'loose', '', '', ''],
      ['lex', '김밥', 'round', '', '', 'loose', '', '', ''],
      ['lex', '학교', 'round', m('q2-f', 'typeHangul.rounds.t1.target.gloss'), 'word:school', 'loose', '', '', 'sc'],
      ['lex', '달', 'round', m('q2-g', 'traceWord.rounds.t1.word.gloss'), '', 'loose', '', '', ''],
      ['pat', '___을/를 좋아해요.', 'round', m('q2-h', 'writeFrame.rounds.w1.frame.gloss'), '', '', '', '', ''],
      ['lex', '사과', 'round', m('q2-h', 'writeFrame.rounds.w1.slots.s1.bank.sagwa.gloss'), '', 'loose', '', '', ''],
      ['lex', '배', 'round', '', '', 'loose', '', '', ''],
      ['lex', '눈', 'round', '', '', 'loose', '', '', ''],
    ]);
    expect(occs.at(-1)?.at).toBe('content/episodes/stage-2/life.json quests[1].scopes[8].deck.top.card');
    const reply = occs.find((o) => o.kind === 'exc' && o.source === 'round')?.reply;
    expect(reply).toEqual({ ko: '밥 먹어요.', romanization: 'bap meogeoyo.', en: 'I eat rice.', glossKey: 'minigame:s2-life-q2-b#dialogue.0.options.bap-meogeoyo.gloss' });
  });

  it('places each occurrence in its cell, at its file and path', () => {
    expect(new Set(occs.map((o) => `${o.cell} ${o.home} ${o.stage} ${o.volume}`))).toEqual(new Set(['episode:stage2-life life 2 1']));
    expect(occs[0]?.at).toBe('content/episodes/stage-2/life.json quests[0].steps[1].discover.pages[0].items[0]');
  });

  it('reads nothing from a body that is not a lesson', () => {
    expect(lessonOccurrences({ ...source, body: 'nope' }, SYMBOLS)).toEqual([]);
    expect(lessonOccurrences({ ...source, body: { quests: [{ steps: [{ kind: 'check', minigameRef: 'minigame:x' }] }] } }, SYMBOLS)).toEqual([]);
  });

  it('finds a bare letter by its initial or vowel form, never a final', () => {
    expect(symbolsByChar(SYMBOLS).get('ㄱ')?.id).toBe('jamo:giyeok');
    expect(symbolsByChar([SYMBOLS[2] as ReviewSymbol]).size).toBe(0);
  });
});

describe('stage1Occurrences: the Stage 1 symbol, syllable and word tables', () => {
  const quests = [
    {
      id: 'quest:stage1-letters-q1',
      steps: [
        { id: 's2', kind: 'discover', discover: { pages: [{ items: [{ type: 'jamo', jamoId: 'jamo:a', example: kt('아이', 'ai', 'child') }, { type: 'word', word: kt('나무', 'namu', 'tree'), picture: 'card:tree' }] }] } },
        { id: 's3', kind: 'practice', minigameRef: 'minigame:s1-letters-q1-play' },
        { id: 's4', kind: 'apply', minigameRef: 'minigame:s1-letters-q1-apply' },
        { id: 's5', kind: 'check', minigameRef: 'minigame:s1-letters-q1-check' },
        { id: 's6', kind: 'reward' },
        { id: 's7', kind: 'apply', minigameRef: 'minigame:none' },
        'not a step',
      ],
    },
    { id: 'quest:story-x-listen', steps: [{ id: 's1', kind: 'check', minigameRef: 'minigame:s1-letters-q1-play' }] },
  ];
  const scopes = {
    'minigame:s1-letters-q1-play': { kind: 'match-sound', jamoIds: ['jamo:a', 'jamo:giyeok', 7] },
    'minigame:s1-letters-q1-apply': {
      kind: 'build-letter',
      syllables: [{ ko: '가', romanization: 'ga', jamoChars: ['ㄱ', 'ㅏ'] }],
      cardPairs: [{ ko: '토마토', romanization: 'tomato', en: 'Tomato' }],
      storySteps: [{ id: 'a', labelEn: 'Wear hanbok', labelKo: '한복 입기', romanization: 'hanbok ipgi' }],
      picWord: { boards: [{ pairs: [{ id: 'p', pictureRef: 'card:kimchi', word: kt('김치', 'gimchi', 'kimchi') }] }] },
    },
    'minigame:s1-letters-q1-check': {
      kind: 'listen-pick',
      listenPick: {
        rounds: [
          { id: 'lp:sym:jamo:a', prompt: kt('아', 'a', 'the letter a'), options: [], answerId: 'jamo:a' },
          { id: 'lp:syl:가', prompt: kt('가', 'ga', 'the syllable ga'), options: [], answerId: '가' },
          { id: 'lp:word:나무', prompt: kt('나무', 'namu', 'tree'), options: [{ id: '나무', text: kt('나무', 'namu', 'tree') }], answerId: '나무' },
          { id: 'lp:pic:김치', prompt: kt('김치', 'gimchi', 'kimchi'), options: [{ id: 'card:kimchi', pictureRef: 'card:kimchi' }], answerId: 'card:kimchi' },
        ],
      },
    },
  };
  const occs = stage1Occurrences({ symbols: SYMBOLS, quests, scopes });

  it('reads each symbol and word a Discover page teaches (not a letter\'s example word) and every scored scope of the quest', () => {
    expect(occs.map((o) => [o.kind, o.ko, o.source, o.glossKey ?? '', o.picture ?? ''])).toEqual([
      ['sym', 'ㅏ', 'discover', '', ''],
      ['lex', '나무', 'discover', 'quest:stage1-letters-q1#steps.s2.discover.pages.0.items.1.word.gloss', 'card:tree'],
      ['sym', 'ㅏ', 'round', '', ''],
      ['sym', 'ㄱ', 'round', '', ''],
      ['syl', '가', 'round', '', ''],
      ['lex', '토마토', 'round', 'minigame:s1-letters-q1-apply#cardPairs.tomato.gloss', ''],
      ['lex', '한복 입기', 'round', 'minigame:s1-letters-q1-apply#storySteps.a.label', ''],
      ['lex', '김치', 'round', 'minigame:s1-letters-q1-apply#picWord.boards.0.pairs.p.word.gloss', 'card:kimchi'],
      ['sym', 'ㅏ', 'round', '', ''],
      ['syl', '가', 'round', 'minigame:s1-letters-q1-check#listenPick.rounds.1.prompt', ''],
      ['lex', '나무', 'round', 'minigame:s1-letters-q1-check#listenPick.rounds.2.prompt', ''],
      ['lex', '김치', 'round', 'minigame:s1-letters-q1-check#listenPick.rounds.3.prompt', 'card:kimchi'],
    ]);
    expect(new Set(occs.map((o) => `${o.cell} ${o.home} ${o.stage}`))).toEqual(new Set(['episode:stage1-letters letters 1']));
  });
});

describe('storyOccurrences: the taught words of the check rounds', () => {
  const story = {
    id: 'story:sun-and-moon',
    theme: 'nature',
    recommendedStage: 3,
    keywords: [{ id: 'dal', ko: '달', romanization: 'dal', en: 'moon' }, { id: 'x' }],
    tiers: [
      {
        level: 'listen',
        checks: [
          { id: 'c1', target: kt('달', 'dal', 'moon'), options: [{ id: 'a', en: 'moon', isCorrect: true }] },
          { id: 'c2', options: [{ id: 'a', ko: 'ㄱ', romanization: 'g', en: 'the letter', isCorrect: true }] },
          { id: 'c3', target: kt('호랑이', 'horangi', 'tiger'), options: [{ id: 'b', ko: '해', romanization: 'hae', en: 'sun', isCorrect: true }] },
        ],
        checkpoints: [{ id: 'p1', target: kt('밤', 'bam', 'night'), options: [] }],
      },
    ],
  };
  it('reads each target and Korean correct option, glossed at the keyword or option overlay field', () => {
    expect(storyOccurrences(story, 'content/stories/sun-and-moon.json', SYMBOLS).map((o) => [o.kind, o.ko, o.glossKey ?? '', o.cell, o.stage, o.home])).toEqual([
      ['lex', '달', 'story:sun-and-moon#keywords.dal.gloss', 'story:sun-and-moon', 3, 'nature'],
      ['sym', 'ㄱ', '', 'story:sun-and-moon', 3, 'nature'],
      ['lex', '호랑이', '', 'story:sun-and-moon', 3, 'nature'],
      ['lex', '해', 'story:sun-and-moon#checks.c3.options.b', 'story:sun-and-moon', 3, 'nature'],
      ['lex', '밤', '', 'story:sun-and-moon', 3, 'nature'],
    ]);
  });
  it('reads nothing from a story without an id, a theme or a stage', () => {
    expect(storyOccurrences(null, 'x', SYMBOLS)).toEqual([]);
    expect(storyOccurrences({ ...story, theme: undefined }, 'x', SYMBOLS)).toEqual([]);
    expect(storyOccurrences({ ...story, recommendedStage: '3' }, 'x', SYMBOLS)).toEqual([]);
  });
});

describe('the sources of a content tree (shared by the generator and the lint)', () => {
  const ready = { status: 'ready', quests: [] };
  const tree = new Map<string, unknown>([
    ['content/episodes/stage-2/life.json', ready],
    ['content/episodes/stage-2/nature.json', { status: 'draft', quests: [] }],
    ['content/episodes/stage-3/life.v2.json', ready],
    ['content/episodes/stage-3/rites.json', { ...ready, volume: 2 }],
    ['content/packs/numbers-time/stage-2.json', ready],
    ['content/packs/numbers-time/pack.json', ready],
    ['content/packs/numbers-time/stage-3.json', { status: 'draft' }],
    ['content/stories/sun-and-moon.json', { id: 'story:sun-and-moon', state: 'ready' }],
    ['content/stories/new-tale.json', { id: 'story:new-tale', state: 'draft' }],
    ['content/vocab/food.json', { items: [{ id: 'vocab:sagwa-apple', ko: '사과', en: 'apple', senseGroup: 'sagwa', visual: 'word:food-apple' }, { id: 'vocab:mul', ko: '물', en: 'water' }, { id: 1 }] }],
    ['content/vocab/README.json', 'not a topic'],
    ['content/vocab/_senses.json', { groups: [{ group: 'sagwa', members: [{ id: 'vocab:sagwa-apple', en: 'apple', state: 'launch' }] }, { group: 'bad', members: [{}] }] }],
    ['content/notes.txt', 'x'],
  ]);

  it('takes the ready cells of every volume and the ready pack levels', () => {
    expect(lessonSourcesOfTree(tree).map((s) => [s.file, s.cellId, s.stage, s.home, s.volume])).toEqual([
      ['content/episodes/stage-2/life.json', 'episode:stage2-life', 2, 'life', 1],
      ['content/episodes/stage-3/life.v2.json', 'episode:stage3-life-v2', 3, 'life', 2],
      ['content/episodes/stage-3/rites.json', 'episode:stage3-rites-v2', 3, 'rites', 2],
      ['content/packs/numbers-time/stage-2.json', 'episode:pack-numbers-time-s2', 2, 'pack:numbers-time', 1],
    ]);
  });

  it('takes the ready stories, the topic words and the sense groups', () => {
    expect(storySourcesOfTree(tree).map((s) => s.file)).toEqual(['content/stories/sun-and-moon.json']);
    const vocab = vocabOfTree(tree);
    expect(vocab.topicWords).toEqual([
      { id: 'vocab:sagwa-apple', ko: '사과', en: 'apple', senseGroup: 'sagwa', visual: 'word:food-apple' },
      { id: 'vocab:mul', ko: '물', en: 'water' },
    ]);
    expect(vocab.senseGroups.map((g) => g.group)).toEqual(['sagwa']);
    expect(vocabOfTree(new Map()).senseGroups).toEqual([]);
  });
});
