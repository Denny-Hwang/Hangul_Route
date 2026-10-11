import type { Quest } from '@hangul-route/content-schema';
import { storyQuests } from './stories';

/**
 * Stage 1 quests are being rebuilt to the six-step pattern of F-QUEST-002 §3.6:
 * intro → discover → practice → apply → check → reward (letters q1-q3 so far,
 * Q-6a; the others follow in Q-6b, Q-7b and Q-8). The quests not yet rebuilt,
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

  // Food & Life — Q1
  {
    id: 'quest:stage1-life-q1',
    titleEn: 'Hello Kimchi & Rice',
    blurbEn: 'Tap the Korean words for your favorite foods.',
    estimatedMinutes: 5,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Lunchtime!', hoyaLineEn: 'What\'s for lunch today?', durationSeconds: 6 },
      { id: 's2', kind: 'present', titleEn: 'Foods on the Table', minigameKind: 'card-match', minigameRef: 'minigame:s1-life-card-1', durationSeconds: 60 },
      { id: 's3', kind: 'practice', titleEn: 'Match the Food', minigameKind: 'card-match', minigameRef: 'minigame:s1-life-card-1', durationSeconds: 90 },
      { id: 's4', kind: 'apply', titleEn: 'Sound Match', minigameKind: 'match-sound', minigameRef: 'minigame:s1-life-match-1', durationSeconds: 60 },
      { id: 's5', kind: 'reward', titleEn: 'Yum!', hoyaLineEn: 'Two food cards added!', durationSeconds: 8 },
    ],
    rewardCardId: 'card:kimchi',
  },
  {
    id: 'quest:stage1-life-q2',
    titleEn: 'Family at the Table',
    blurbEn: 'Mom, dad, family — say it in Korean.',
    estimatedMinutes: 5,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Family!', hoyaLineEn: 'I love my family.', durationSeconds: 6 },
      { id: 's2', kind: 'present', titleEn: 'Family Words', minigameKind: 'card-match', minigameRef: 'minigame:s1-life-card-2', durationSeconds: 60 },
      { id: 's3', kind: 'practice', titleEn: 'Story Order', minigameKind: 'story-sequence', minigameRef: 'minigame:s1-life-story-1', durationSeconds: 75 },
      { id: 's4', kind: 'apply', titleEn: 'Match Family Words', minigameKind: 'card-match', minigameRef: 'minigame:s1-life-card-2', durationSeconds: 75 },
      { id: 's5', kind: 'reward', titleEn: 'Family Card!', hoyaLineEn: 'Family added.', durationSeconds: 8 },
    ],
    rewardCardId: 'card:family-table',
  },

  // Holidays — Q1
  {
    id: 'quest:stage1-rites-q1',
    titleEn: 'Bow & Eat Tteokguk',
    blurbEn: 'Learn to greet your elders on Seollal.',
    estimatedMinutes: 5,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Happy New Year!', hoyaLineEn: 'Happy New Year! Let\'s learn the greeting.', hoyaLineKo: { ko: '새해 복 많이 받으세요.', romanization: 'saehae bok mani badeuseyo', en: 'Happy New Year!' }, durationSeconds: 8 },
      { id: 's2', kind: 'present', titleEn: 'The Bow', minigameKind: 'card-match', minigameRef: 'minigame:s1-rites-card-1', durationSeconds: 60 },
      { id: 's3', kind: 'practice', titleEn: 'Tteokguk!', minigameKind: 'match-sound', minigameRef: 'minigame:s1-rites-match-1', durationSeconds: 75 },
      { id: 's4', kind: 'apply', titleEn: 'New Year Order', minigameKind: 'story-sequence', minigameRef: 'minigame:s1-rites-story-1', durationSeconds: 75 },
      { id: 's5', kind: 'reward', titleEn: 'Seollal Card!', hoyaLineEn: 'A festival card joins your library!', durationSeconds: 8 },
    ],
    rewardCardId: 'card:seollal',
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
