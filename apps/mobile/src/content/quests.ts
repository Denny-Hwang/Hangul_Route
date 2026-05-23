import type { Quest } from '@hangul-route/content-schema';

/**
 * 5-step quest pattern: intro → present → practice → apply → reward.
 * Each Stage 1 episode owns 1–3 quests.
 */

export const stage1Quests: Quest[] = [
  // Letters & Books — Q1: Meet ㄱ ㄴ ㄷ ㄹ
  {
    id: 'quest:stage1-letters-q1',
    titleEn: 'Meet g, n, d, l',
    blurbEn: 'Your first four Korean consonants.',
    estimatedMinutes: 4,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Hi from Hoya', hoyaLineEn: 'These four letters say a lot!', durationSeconds: 8 },
      { id: 's2', kind: 'present', titleEn: 'Listen and Watch', hoyaLineEn: 'Tap each one to hear it.', minigameKind: 'match-sound', minigameRef: 'minigame:s1-letters-recognize-1', durationSeconds: 60 },
      { id: 's3', kind: 'practice', titleEn: 'Match the Sound', minigameKind: 'match-sound', minigameRef: 'minigame:s1-letters-match-1', durationSeconds: 90 },
      { id: 's4', kind: 'apply', titleEn: 'Build a Letter', minigameKind: 'build-letter', minigameRef: 'minigame:s1-letters-build-1', durationSeconds: 90 },
      { id: 's5', kind: 'reward', titleEn: 'Card Earned!', hoyaLineEn: 'You earned a Heritage card!', durationSeconds: 8 },
    ],
    rewardCardId: 'card:book',
  },
  // Letters & Books — Q2
  {
    id: 'quest:stage1-letters-q2',
    titleEn: 'Meet m, b, s, ng',
    blurbEn: 'Four more consonants, four more sounds.',
    estimatedMinutes: 4,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Round Two', hoyaLineEn: 'You did great. Want more letters?', durationSeconds: 6 },
      { id: 's2', kind: 'present', titleEn: 'Hear & See', minigameKind: 'match-sound', minigameRef: 'minigame:s1-letters-recognize-2', durationSeconds: 60 },
      { id: 's3', kind: 'practice', titleEn: 'Trace Each Letter', minigameKind: 'trace-stroke', minigameRef: 'minigame:s1-letters-trace-1', durationSeconds: 90 },
      { id: 's4', kind: 'apply', titleEn: 'Match the Sound', minigameKind: 'match-sound', minigameRef: 'minigame:s1-letters-match-2', durationSeconds: 90 },
      { id: 's5', kind: 'reward', titleEn: 'Nice!', hoyaLineEn: 'One more card for your library!', durationSeconds: 8 },
    ],
    rewardCardId: 'card:hanji',
  },
  // Letters & Books — Q3: vowels
  {
    id: 'quest:stage1-letters-q3',
    titleEn: 'Meet the Vowels',
    blurbEn: 'ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ — open your mouth and sing.',
    estimatedMinutes: 5,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Vowels are music', hoyaLineEn: 'Vowels are sounds you can sing!', durationSeconds: 8 },
      { id: 's2', kind: 'present', titleEn: 'Hear Six Vowels', minigameKind: 'match-sound', minigameRef: 'minigame:s1-letters-recognize-3', durationSeconds: 75 },
      { id: 's3', kind: 'practice', titleEn: 'Find What\'s Different', minigameKind: 'odd-one-out', minigameRef: 'minigame:s1-letters-odd-1', durationSeconds: 75 },
      { id: 's4', kind: 'apply', titleEn: 'Build "가"', minigameKind: 'build-letter', minigameRef: 'minigame:s1-letters-build-2', durationSeconds: 90 },
      { id: 's5', kind: 'reward', titleEn: 'Brush Earned', hoyaLineEn: 'Your library is growing!', durationSeconds: 8 },
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
      { id: 's1', kind: 'intro', titleEn: 'Happy New Year!', hoyaLineEn: '새해 복 많이 받으세요.', durationSeconds: 8 },
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

export const questsAll: Quest[] = [...stage1Quests, ...stage2Quests];

export function questById(id: string): Quest | undefined {
  return questsAll.find((q) => q.id === id);
}
