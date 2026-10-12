import type { Quest } from '@hangul-route/content-schema';
import { storyQuests } from './stories';

/**
 * Stage 1 quests are being rebuilt to the six-step pattern of F-QUEST-002 §3.6:
 * intro → discover → practice → apply → check → reward (letters q1-q3 in Q-6a,
 * life q1-q3 in Q-6b, rites q1-q3 in Q-7b; the others follow in Q-8). The quests not yet rebuilt,
 * and the Stage 2 / Stage 4 taste quests, keep the five-step pattern
 * intro → present → practice → apply → reward.
 * Each Stage 1 episode owns 1–3 quests.
 */

export const stage1Quests: Quest[] = [
  // Letters & Books — Q1: ㅏ ㅓ ㄱ ㄴ (F-QUEST-002 §3.6, quest 1)
  {
    id: 'quest:stage1-letters-q1',
    titleEn: 'Meet a, eo, g, n',
    blurbEn: 'Two vowels, two consonants, and your first syllables.',
    estimatedMinutes: 5,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Hi from Hoya', hoyaLineEn: 'Korean letters join into blocks. Let us meet four!', durationSeconds: 8 },
      {
        id: 's2',
        kind: 'discover',
        titleEn: 'Four New Letters',
        hoyaLineEn: 'Tap Hear it to listen to each one.',
        discover: {
          pages: [
            {
              items: [
                { type: 'jamo', jamoId: 'jamo:a', example: { ko: '나', romanization: 'na', en: 'I, me' } },
                { type: 'jamo', jamoId: 'jamo:eo', example: { ko: '너', romanization: 'neo', en: 'you' } },
              ],
            },
            {
              items: [
                { type: 'jamo', jamoId: 'jamo:giyeok', example: { ko: '가', romanization: 'ga', en: 'the sound ga' } },
                { type: 'jamo', jamoId: 'jamo:nieun', example: { ko: '나', romanization: 'na', en: 'I, me' } },
              ],
            },
          ],
        },
        durationSeconds: 40,
      },
      { id: 's3', kind: 'practice', titleEn: 'Match the Sound', minigameKind: 'match-sound', minigameRef: 'minigame:s1-letters-q1-play', durationSeconds: 90 },
      { id: 's4', kind: 'apply', titleEn: 'Build a Letter', minigameKind: 'build-letter', minigameRef: 'minigame:s1-letters-q1-apply', durationSeconds: 75 },
      { id: 's5', kind: 'check', titleEn: 'Listen and Read', minigameKind: 'listen-pick', minigameRef: 'minigame:s1-letters-q1-check', durationSeconds: 35 },
      { id: 's6', kind: 'reward', titleEn: 'Card Earned!', hoyaLineEn: 'You earned a Heritage card!', durationSeconds: 8 },
    ],
    rewardCardId: 'card:book',
  },
  // Letters & Books — Q2: ㅗ ㅜ ㅁ ㅇ (quest 2)
  {
    id: 'quest:stage1-letters-q2',
    titleEn: 'Meet o, u, m and the circle',
    blurbEn: 'Two round vowels, m, and the circle letter.',
    estimatedMinutes: 5,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Round Two', hoyaLineEn: 'Welcome back! Four more letters today.', durationSeconds: 6 },
      {
        id: 's2',
        kind: 'discover',
        titleEn: 'Four New Letters',
        hoyaLineEn: 'Tap Hear it to listen to each one.',
        discover: {
          pages: [
            {
              items: [
                { type: 'jamo', jamoId: 'jamo:o', example: { ko: '오', romanization: 'o', en: 'five' } },
                { type: 'jamo', jamoId: 'jamo:u', example: { ko: '나무', romanization: 'namu', en: 'tree', syllables: ['na', 'mu'] } },
              ],
            },
            {
              items: [
                { type: 'jamo', jamoId: 'jamo:mieum', example: { ko: '나무', romanization: 'namu', en: 'tree', syllables: ['na', 'mu'] } },
                { type: 'jamo', jamoId: 'jamo:ieung', example: { ko: '오', romanization: 'o', en: 'five' } },
              ],
            },
          ],
        },
        durationSeconds: 40,
      },
      { id: 's3', kind: 'practice', titleEn: 'Match the Sound', minigameKind: 'match-sound', minigameRef: 'minigame:s1-letters-q2-play', durationSeconds: 90 },
      { id: 's4', kind: 'apply', titleEn: 'Trace Each Letter', minigameKind: 'trace-stroke', minigameRef: 'minigame:s1-letters-q2-apply', durationSeconds: 75 },
      { id: 's5', kind: 'check', titleEn: 'Listen and Read', minigameKind: 'listen-pick', minigameRef: 'minigame:s1-letters-q2-check', durationSeconds: 35 },
      { id: 's6', kind: 'reward', titleEn: 'Nice!', hoyaLineEn: 'One more card for your library!', durationSeconds: 8 },
    ],
    rewardCardId: 'card:hanji',
  },
  // Letters & Books — Q3: ㅡ ㅣ ㄷ ㄹ (quest 3)
  {
    id: 'quest:stage1-letters-q3',
    titleEn: 'Meet eu, i, d, r',
    blurbEn: 'Four more letters, and real words to read.',
    estimatedMinutes: 5,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Real Words Next', hoyaLineEn: 'Four more letters, and you can read real words!', durationSeconds: 8 },
      {
        id: 's2',
        kind: 'discover',
        titleEn: 'Four New Letters',
        hoyaLineEn: 'Tap Hear it to listen to each one.',
        discover: {
          pages: [
            {
              items: [
                { type: 'jamo', jamoId: 'jamo:eu', example: { ko: '드라마', romanization: 'deurama', en: 'drama', syllables: ['deu', 'ra', 'ma'] } },
                { type: 'jamo', jamoId: 'jamo:i', example: { ko: '아이', romanization: 'ai', en: 'child', syllables: ['a', 'i'] } },
              ],
            },
            {
              items: [
                { type: 'jamo', jamoId: 'jamo:digeut', example: { ko: '다리', romanization: 'dari', en: 'leg, bridge', syllables: ['da', 'ri'] } },
                { type: 'jamo', jamoId: 'jamo:rieul', example: { ko: '드라마', romanization: 'deurama', en: 'drama', syllables: ['deu', 'ra', 'ma'] } },
              ],
            },
          ],
        },
        durationSeconds: 40,
      },
      { id: 's3', kind: 'practice', titleEn: 'Match the Sound', minigameKind: 'match-sound', minigameRef: 'minigame:s1-letters-q3-play', durationSeconds: 90 },
      { id: 's4', kind: 'apply', titleEn: 'Find the Odd One', minigameKind: 'odd-one-out', minigameRef: 'minigame:s1-letters-q3-apply', durationSeconds: 75 },
      { id: 's5', kind: 'check', titleEn: 'Listen and Read', minigameKind: 'listen-pick', minigameRef: 'minigame:s1-letters-q3-check', durationSeconds: 35 },
      { id: 's6', kind: 'reward', titleEn: 'Brush Earned', hoyaLineEn: 'Your library is growing!', durationSeconds: 8 },
    ],
    rewardCardId: 'card:brush',
  },

  // Food & Life — Q4: ㅈ ㅊ (F-QUEST-002 §3.6, quest 4)
  {
    id: 'quest:stage1-life-q1',
    titleEn: 'Hello Kimchi & Rice',
    blurbEn: 'Two new letters, j and ch, and food words from the table.',
    estimatedMinutes: 4,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Lunchtime!', hoyaLineEn: 'Lunchtime! Two new letters are on the table today.', durationSeconds: 8 },
      {
        id: 's2',
        kind: 'discover',
        titleEn: 'Two New Letters',
        hoyaLineEn: 'Tap Hear it to listen to each one.',
        discover: {
          pages: [
            {
              items: [
                { type: 'jamo', jamoId: 'jamo:jieut', example: { ko: '자두', romanization: 'jadu', en: 'plum', syllables: ['ja', 'du'] } },
                { type: 'jamo', jamoId: 'jamo:chieut', example: { ko: '치즈', romanization: 'chijeu', en: 'cheese', syllables: ['chi', 'jeu'] } },
              ],
            },
            {
              items: [
                { type: 'word', word: { ko: '고추', romanization: 'gochu', en: 'chili pepper', syllables: ['go', 'chu'] } },
                { type: 'word', word: { ko: '차', romanization: 'cha', en: 'tea' } },
              ],
            },
          ],
        },
        durationSeconds: 40,
      },
      { id: 's3', kind: 'practice', titleEn: 'Match the Sound', minigameKind: 'match-sound', minigameRef: 'minigame:s1-life-q1-play', durationSeconds: 75 },
      { id: 's4', kind: 'apply', titleEn: 'Picture and Word', minigameKind: 'pic-word-match', minigameRef: 'minigame:s1-life-q1-apply', durationSeconds: 60 },
      { id: 's5', kind: 'check', titleEn: 'Listen and Read', minigameKind: 'listen-pick', minigameRef: 'minigame:s1-life-q1-check', durationSeconds: 35 },
      { id: 's6', kind: 'reward', titleEn: 'Kimchi Card!', hoyaLineEn: 'A kimchi card joins your library!', durationSeconds: 8 },
    ],
    rewardCardId: 'card:kimchi',
  },
  // Food & Life — Q5: ㅂ ㅅ (quest 5)
  {
    id: 'quest:stage1-life-q2',
    titleEn: 'Family at the Table',
    blurbEn: 'Two new letters, b and s, and family words to read.',
    estimatedMinutes: 4,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Family!', hoyaLineEn: 'Everyone is at the table. Let us read the family words!', durationSeconds: 6 },
      {
        id: 's2',
        kind: 'discover',
        titleEn: 'Two New Letters',
        hoyaLineEn: 'Tap Hear it to listen to each one.',
        discover: {
          pages: [
            {
              items: [
                { type: 'jamo', jamoId: 'jamo:bieup', example: { ko: '바나나', romanization: 'banana', en: 'banana', syllables: ['ba', 'na', 'na'] } },
                { type: 'jamo', jamoId: 'jamo:siot', example: { ko: '사자', romanization: 'saja', en: 'lion', syllables: ['sa', 'ja'] } },
              ],
            },
            {
              items: [
                { type: 'word', word: { ko: '아버지', romanization: 'abeoji', en: 'father', syllables: ['a', 'beo', 'ji'] } },
                { type: 'word', word: { ko: '아기', romanization: 'agi', en: 'baby', syllables: ['a', 'gi'] } },
              ],
            },
            {
              items: [
                { type: 'word', word: { ko: '엄마', romanization: 'eomma', en: 'mom', syllables: ['eom', 'ma'] } },
                { type: 'word', word: { ko: '가족', romanization: 'gajok', en: 'family', syllables: ['ga', 'jok'] }, picture: 'card:family-table' },
              ],
            },
          ],
        },
        durationSeconds: 60,
      },
      { id: 's3', kind: 'practice', titleEn: 'Match the Sound', minigameKind: 'match-sound', minigameRef: 'minigame:s1-life-q2-play', durationSeconds: 75 },
      { id: 's4', kind: 'apply', titleEn: 'Build a Letter', minigameKind: 'build-letter', minigameRef: 'minigame:s1-life-q2-apply', durationSeconds: 60 },
      { id: 's5', kind: 'check', titleEn: 'Listen and Read', minigameKind: 'listen-pick', minigameRef: 'minigame:s1-life-q2-check', durationSeconds: 35 },
      { id: 's6', kind: 'reward', titleEn: 'Family Card!', hoyaLineEn: 'The family table joins your library!', durationSeconds: 8 },
    ],
    rewardCardId: 'card:family-table',
  },
  // Food & Life — Q6: ㅋ ㅌ (quest 6)
  {
    id: 'quest:stage1-life-q3',
    titleEn: 'Picnic Snacks',
    blurbEn: 'Two puff-of-air letters, k and t, and picnic snacks to read.',
    estimatedMinutes: 4,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Picnic Time!', hoyaLineEn: 'Picnic time! What snacks did we pack?', durationSeconds: 6 },
      {
        id: 's2',
        kind: 'discover',
        titleEn: 'Two New Letters',
        hoyaLineEn: 'Tap Hear it: k is like g with a puff of air, and t is like d with a puff of air.',
        discover: {
          pages: [
            {
              items: [
                { type: 'jamo', jamoId: 'jamo:kieuk', example: { ko: '쿠키', romanization: 'kuki', en: 'cookie', syllables: ['ku', 'ki'] } },
                { type: 'jamo', jamoId: 'jamo:tieut', example: { ko: '토마토', romanization: 'tomato', en: 'tomato', syllables: ['to', 'ma', 'to'] } },
              ],
            },
            {
              items: [
                { type: 'word', word: { ko: '코코아', romanization: 'kokoa', en: 'cocoa', syllables: ['ko', 'ko', 'a'] } },
                { type: 'word', word: { ko: '토스트', romanization: 'toseuteu', en: 'toast', syllables: ['to', 'seu', 'teu'] } },
              ],
            },
          ],
        },
        durationSeconds: 40,
      },
      { id: 's3', kind: 'practice', titleEn: 'Match the Sound', minigameKind: 'match-sound', minigameRef: 'minigame:s1-life-q3-play', durationSeconds: 75 },
      { id: 's4', kind: 'apply', titleEn: 'What Does It Mean?', minigameKind: 'culture-quiz', minigameRef: 'minigame:s1-life-q3-apply', durationSeconds: 60 },
      { id: 's5', kind: 'check', titleEn: 'Listen and Read', minigameKind: 'listen-pick', minigameRef: 'minigame:s1-life-q3-check', durationSeconds: 35 },
      { id: 's6', kind: 'reward', titleEn: 'Kimbap Card!', hoyaLineEn: 'Kimbap, the picnic favorite, joins your library!', durationSeconds: 8 },
    ],
    rewardCardId: 'card:kimbap',
  },

  // Holidays — Q7: final ㄴ and final ㄹ (F-QUEST-002 §3.6, quest 7)
  {
    id: 'quest:stage1-rites-q1',
    titleEn: 'Bow & Eat Tteokguk',
    blurbEn: 'Your first final letters, n and l, and the words of Seollal.',
    estimatedMinutes: 4,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Happy New Year!', hoyaLineEn: 'Happy New Year! Let\'s learn the greeting.', hoyaLineKo: { ko: '새해 복 많이 받으세요.', romanization: 'saehae bok mani badeuseyo', en: 'Happy New Year!' }, durationSeconds: 8 },
      {
        id: 's2',
        kind: 'discover',
        titleEn: 'Letters at the Bottom',
        hoyaLineEn: 'Tap Hear it to listen. A final letter sits at the bottom of the block.',
        discover: {
          pages: [
            {
              items: [
                { type: 'jamo', jamoId: 'jamo:nieun-batchim', example: { ko: '문', romanization: 'mun', en: 'door' } },
                { type: 'jamo', jamoId: 'jamo:rieul-batchim', example: { ko: '달', romanization: 'dal', en: 'moon' } },
              ],
            },
            {
              // Theme words are for looking (R3): 떡국 holds letters not taught yet, so not "Words you can read now".
              captionEn: 'Words of Seollal',
              items: [
                { type: 'word', word: { ko: '설날', romanization: 'seollal', en: 'Lunar New Year', syllables: ['seol', 'lal'] }, picture: 'card:seollal' },
                { type: 'word', word: { ko: '떡국', romanization: 'tteokguk', en: 'rice cake soup', syllables: ['tteok', 'guk'] }, picture: 'card:tteokguk' },
              ],
            },
          ],
        },
        durationSeconds: 40,
      },
      { id: 's3', kind: 'practice', titleEn: 'Hear the Final', minigameKind: 'listen-pick', minigameRef: 'minigame:s1-rites-q1-play', durationSeconds: 75 },
      { id: 's4', kind: 'apply', titleEn: 'Build a Block', minigameKind: 'build-letter', minigameRef: 'minigame:s1-rites-q1-apply', durationSeconds: 60 },
      { id: 's5', kind: 'check', titleEn: 'Listen and Read', minigameKind: 'listen-pick', minigameRef: 'minigame:s1-rites-q1-check', durationSeconds: 35 },
      { id: 's6', kind: 'reward', titleEn: 'Seollal Card!', hoyaLineEn: 'A Lunar New Year card joins your library!', durationSeconds: 8 },
    ],
    rewardCardId: 'card:seollal',
  },
  // Holidays — Q8: ㅑ ㅕ ㅍ and final ㅇ (quest 8)
  {
    id: 'quest:stage1-rites-q2',
    titleEn: 'Rice Cakes of Chuseok',
    blurbEn: 'Two new vowels, ya and yeo, the letter p, and the final ng.',
    estimatedMinutes: 5,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Chuseok!', hoyaLineEn: 'It is Chuseok, the harvest festival. Families make rice cakes together!', durationSeconds: 8 },
      {
        id: 's2',
        kind: 'discover',
        titleEn: 'Four New Letters',
        hoyaLineEn: 'Tap Hear it to listen to each one.',
        discover: {
          pages: [
            {
              items: [
                { type: 'jamo', jamoId: 'jamo:ya', example: { ko: '야구', romanization: 'yagu', en: 'baseball', syllables: ['ya', 'gu'] } },
                { type: 'jamo', jamoId: 'jamo:yeo', example: { ko: '여우', romanization: 'yeou', en: 'fox', syllables: ['yeo', 'u'] } },
              ],
            },
            {
              items: [
                { type: 'jamo', jamoId: 'jamo:pieup', example: { ko: '포도', romanization: 'podo', en: 'grape', syllables: ['po', 'do'] } },
                { type: 'jamo', jamoId: 'jamo:ieung-batchim', example: { ko: '송편', romanization: 'songpyeon', en: 'half-moon rice cake', syllables: ['song', 'pyeon'] } },
              ],
            },
            {
              captionEn: 'Words of Chuseok',
              items: [
                { type: 'word', word: { ko: '추석', romanization: 'chuseok', en: 'harvest festival', syllables: ['chu', 'seok'] }, picture: 'card:chuseok' },
                { type: 'word', word: { ko: '송편', romanization: 'songpyeon', en: 'half-moon rice cake', syllables: ['song', 'pyeon'] }, picture: 'card:songpyeon' },
              ],
            },
          ],
        },
        durationSeconds: 60,
      },
      { id: 's3', kind: 'practice', titleEn: 'Match the Sound', minigameKind: 'match-sound', minigameRef: 'minigame:s1-rites-q2-play', durationSeconds: 90 },
      { id: 's4', kind: 'apply', titleEn: 'Build a Letter', minigameKind: 'build-letter', minigameRef: 'minigame:s1-rites-q2-apply', durationSeconds: 75 },
      { id: 's5', kind: 'check', titleEn: 'Listen and Read', minigameKind: 'listen-pick', minigameRef: 'minigame:s1-rites-q2-check', durationSeconds: 35 },
      { id: 's6', kind: 'reward', titleEn: 'Chuseok Card!', hoyaLineEn: 'A harvest festival card joins your library!', durationSeconds: 8 },
    ],
    rewardCardId: 'card:chuseok',
  },
  // Holidays — Q9: ㅛ ㅠ ㅎ and final ㄱ (quest 9)
  {
    id: 'quest:stage1-rites-q3',
    titleEn: 'Hanbok and the Bow',
    blurbEn: 'Two new vowels, yo and yu, the letter h, and the final k.',
    estimatedMinutes: 5,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Dress Up!', hoyaLineEn: 'On New Year, we wear hanbok and bow to our grandparents.', durationSeconds: 8 },
      {
        id: 's2',
        kind: 'discover',
        titleEn: 'Four New Letters',
        hoyaLineEn: 'Tap Hear it to listen to each one.',
        discover: {
          pages: [
            {
              items: [
                { type: 'jamo', jamoId: 'jamo:yo', example: { ko: '효도', romanization: 'hyodo', en: 'respect for parents', syllables: ['hyo', 'do'] } },
                { type: 'jamo', jamoId: 'jamo:yu', example: { ko: '우유', romanization: 'uyu', en: 'milk', syllables: ['u', 'yu'] } },
              ],
            },
            {
              items: [
                { type: 'jamo', jamoId: 'jamo:hieut', example: { ko: '한복', romanization: 'hanbok', en: 'hanbok, traditional clothes', syllables: ['han', 'bok'] } },
                { type: 'jamo', jamoId: 'jamo:giyeok-batchim', example: { ko: '한국', romanization: 'hanguk', en: 'Korea', syllables: ['han', 'guk'] } },
              ],
            },
          ],
        },
        durationSeconds: 40,
      },
      { id: 's3', kind: 'practice', titleEn: 'Listen and Pick', minigameKind: 'listen-pick', minigameRef: 'minigame:s1-rites-q3-play', durationSeconds: 90 },
      // 90 s, above the 60-75 s apply range in F-QUEST-002 §3.6: Story Order (4 cards plus
      // replay) needs it, and it keeps the spec's 5-minute value for this 2-page quest
      // (at 75 s the quest rounds to 4). The range/minutes conflict goes to the Q-11 docs pass.
      { id: 's4', kind: 'apply', titleEn: 'New Year Order', minigameKind: 'story-sequence', minigameRef: 'minigame:s1-rites-q3-apply', durationSeconds: 90 },
      { id: 's5', kind: 'check', titleEn: 'Listen and Read', minigameKind: 'listen-pick', minigameRef: 'minigame:s1-rites-q3-check', durationSeconds: 35 },
      { id: 's6', kind: 'reward', titleEn: 'New Year Bow Card!', hoyaLineEn: 'A New Year bow card joins your library!', durationSeconds: 8 },
    ],
    rewardCardId: 'card:sebae',
  },

  // Nature — Q1
  {
    id: 'quest:stage1-nature-q1',
    titleEn: 'Tiger, Magpie, Moon',
    blurbEn: 'Three friends from Korean stories.',
    estimatedMinutes: 5,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'I am a tiger!', hoyaLineEn: 'Hoya means tiger.', durationSeconds: 6 },
      { id: 's2', kind: 'present', titleEn: 'Animal Words', minigameKind: 'card-match', minigameRef: 'minigame:s1-nature-card-1', durationSeconds: 60 },
      { id: 's3', kind: 'practice', titleEn: 'Match Animal Sounds', minigameKind: 'match-sound', minigameRef: 'minigame:s1-nature-match-1', durationSeconds: 75 },
      { id: 's4', kind: 'apply', titleEn: 'What Does It Mean?', minigameKind: 'culture-quiz', minigameRef: 'minigame:s1-nature-quiz-1', durationSeconds: 75 },
      { id: 's5', kind: 'reward', titleEn: 'Magpie Card!', hoyaLineEn: 'A magpie joins your collection.', durationSeconds: 8 },
    ],
    rewardCardId: 'card:magpie',
  },

  // Crafts — Q1
  {
    id: 'quest:stage1-crafts-q1',
    titleEn: 'Yut, Kite, Top',
    blurbEn: 'Korean games to play together.',
    estimatedMinutes: 5,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Game time!', hoyaLineEn: 'Pick a game with me.', durationSeconds: 6 },
      { id: 's2', kind: 'present', titleEn: 'Three Games', minigameKind: 'card-match', minigameRef: 'minigame:s1-crafts-card-1', durationSeconds: 60 },
      { id: 's3', kind: 'practice', titleEn: 'Yut Words', minigameKind: 'match-sound', minigameRef: 'minigame:s1-crafts-match-1', durationSeconds: 75 },
      { id: 's4', kind: 'apply', titleEn: 'Game Story', minigameKind: 'story-sequence', minigameRef: 'minigame:s1-crafts-story-1', durationSeconds: 75 },
      { id: 's5', kind: 'reward', titleEn: 'Yutnori Card!', hoyaLineEn: 'A game card joins your library.', durationSeconds: 8 },
    ],
    rewardCardId: 'card:yutnori',
  },
];

export const stage2Quests: Quest[] = [
  // Stage 2 / Food & Daily Life — taste episode
  {
    id: 'quest:stage2-life-q1',
    titleEn: 'Lunch Box Words',
    blurbEn: 'Read and build your first Korean food words.',
    estimatedMinutes: 5,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Open the Lunch Box', hoyaLineEn: 'You know the letters now — let us read real words!', durationSeconds: 8 },
      { id: 's2', kind: 'present', titleEn: 'Food Words', minigameKind: 'card-match', minigameRef: 'minigame:s2-life-card-1', durationSeconds: 75 },
      { id: 's3', kind: 'practice', titleEn: 'What Does It Mean?', minigameKind: 'culture-quiz', minigameRef: 'minigame:s2-life-quiz-1', durationSeconds: 75 },
      { id: 's4', kind: 'apply', titleEn: 'Build the Word', minigameKind: 'build-letter', minigameRef: 'minigame:s2-life-build-1', durationSeconds: 90 },
      { id: 's5', kind: 'reward', titleEn: 'Lunch Box Card!', hoyaLineEn: 'You read your first words. Here is a card!', durationSeconds: 8 },
    ],
    rewardCardId: 'card:dosirak',
  },
  {
    id: 'quest:stage2-nature-q1',
    titleEn: 'Outdoor Words',
    blurbEn: 'Name the sky, flowers, and trees in Korean.',
    estimatedMinutes: 5,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Step Outside', hoyaLineEn: 'Let us name what we see outside!', durationSeconds: 8 },
      { id: 's2', kind: 'present', titleEn: 'Nature Words', minigameKind: 'card-match', minigameRef: 'minigame:s2-nature-card-1', durationSeconds: 75 },
      { id: 's3', kind: 'practice', titleEn: 'What Does It Mean?', minigameKind: 'culture-quiz', minigameRef: 'minigame:s2-nature-quiz-1', durationSeconds: 75 },
      { id: 's4', kind: 'apply', titleEn: 'Build the Word', minigameKind: 'build-letter', minigameRef: 'minigame:s2-nature-build-1', durationSeconds: 90 },
      { id: 's5', kind: 'reward', titleEn: 'Star Card!', hoyaLineEn: 'You named the outdoors. Here is a star!', durationSeconds: 8 },
    ],
    rewardCardId: 'card:byeol',
  },
];

export const stage4Quests: Quest[] = [
  // Stage 4 / Holidays & Traditions — taste episode
  {
    id: 'quest:stage4-rites-q1',
    titleEn: 'Greeting Dialogues',
    blurbEn: 'Say hello and meet a new friend in Korean.',
    estimatedMinutes: 4,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Meet Someone New', hoyaLineEn: 'Someone wants to say hi. Let us answer!', durationSeconds: 8 },
      { id: 's2', kind: 'present', titleEn: 'Hello Words', minigameKind: 'card-match', minigameRef: 'minigame:s4-rites-card-1', durationSeconds: 60 },
      { id: 's3', kind: 'practice', titleEn: 'Choose Your Reply', minigameKind: 'tap-respond', minigameRef: 'minigame:s4-rites-respond-1', durationSeconds: 90 },
      { id: 's4', kind: 'apply', titleEn: 'What Does It Mean?', minigameKind: 'culture-quiz', minigameRef: 'minigame:s4-rites-quiz-1', durationSeconds: 60 },
      { id: 's5', kind: 'reward', titleEn: 'Greeting Card!', hoyaLineEn: 'You had a real conversation!', durationSeconds: 8 },
    ],
    rewardCardId: 'card:insa',
  },
];

export const questsAll: Quest[] = [...stage1Quests, ...stage2Quests, ...stage4Quests, ...storyQuests];

export function questById(id: string): Quest | undefined {
  return questsAll.find((q) => q.id === id);
}
