/** A small valid lesson cell (F-CURR-001 §3.10) for the schema tests. Not real content. */
export const kt = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });

export const source = {
  title: 'Standard Korean Language Dictionary',
  publisher: 'National Institute of Korean Language',
  url: 'https://stdict.korean.go.kr/',
  accessed: '2026-10-13',
  quoteOrLocator: 'entry for the word, sense 1',
};

export const verification = { passes: 3, checkedAt: '2026-10-13', scope: 'lesson', notes: 'pass 1; pass 2; pass 3' };

const lpRound = (id: string) => ({
  id,
  prompt: kt('책이에요', 'chaegieyo', 'it is a book'),
  options: [
    { id: 'a', pictureRef: 'word:book' },
    { id: 'b', pictureRef: 'word:bag' },
  ],
  answerId: 'a',
});

const orderRound = (id: string) => ({
  id,
  sentence: kt('책이 있어요.', 'chaegi isseoyo', 'there is a book'),
  particle: { tile: 0, choices: [kt('이', 'i', 'subject marker'), kt('가', 'ga', 'subject marker')] },
});

export function lessonQuest(stage: string, theme: string, k: number, checkKind: 'listen-pick' | 'order-it' = 'listen-pick') {
  const n = stage.slice(5);
  const ref = (step: string) => `minigame:s${n}-${theme}-q${k}-${step}`;
  return {
    id: `quest:${stage}-${theme}-q${k}`,
    titleEn: `Quest ${k}`,
    estimatedMinutes: 4,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Hello', durationSeconds: 7 },
      {
        id: 's2',
        kind: 'discover',
        titleEn: 'Look and learn',
        durationSeconds: 60,
        discover: {
          pages: [
            {
              items: [
                {
                  type: 'pattern',
                  frame: kt('___이에요/예요', '___ieyo/yeyo', 'it is ___'),
                  noteEn: 'Use {ko:이에요} after a final consonant.',
                  examples: [kt('책이에요', 'chaegieyo', 'it is a book'), kt('학교예요', 'hakgyoyeyo', 'it is a school')],
                },
              ],
            },
          ],
        },
      },
      { id: 's3', kind: 'practice', titleEn: 'Build it', durationSeconds: 90, minigameKind: 'order-it', minigameRef: ref('practice') },
      { id: 's4', kind: 'apply', titleEn: 'Hear it', durationSeconds: 75, minigameKind: 'listen-pick', minigameRef: ref('apply') },
      { id: 's5', kind: 'check', titleEn: 'Two quick ones', durationSeconds: 40, minigameKind: checkKind, minigameRef: ref('check') },
      { id: 's6', kind: 'reward', titleEn: 'Well done', durationSeconds: 8 },
    ],
    scopes: [
      { ref: ref('practice'), kind: 'order-it', rounds: [orderRound('r1'), orderRound('r2')] },
      { ref: ref('apply'), kind: 'listen-pick', rounds: [lpRound('r1'), lpRound('r2'), lpRound('r3')] },
      checkKind === 'listen-pick'
        ? { ref: ref('check'), kind: 'listen-pick', rounds: [lpRound('c1'), lpRound('c2')] }
        : { ref: ref('check'), kind: 'order-it', rounds: [orderRound('c1'), orderRound('c2')] },
    ],
  };
}

export function lessonCell(stage = 'stage3', theme = 'letters', extra: Record<string, unknown> = {}) {
  const order = ['letters', 'life', 'rites', 'nature', 'crafts'].indexOf(theme) + 1;
  return {
    id: `episode:${stage}-${theme}`,
    stage,
    theme,
    status: 'draft',
    titleEn: 'First Sentences',
    subtitleEn: 'Read and build short sentences',
    hoyaIntroEn: 'Let us read our first sentences!',
    order,
    pillarTags: ['A1'],
    quests: [1, 2, 3].map((k) => lessonQuest(stage, theme, k, stage === 'stage7' ? 'order-it' : 'listen-pick')),
    culture: [{ id: 'n1', kind: 'language', textEn: 'Sentences end with a polite ending.', sources: [source], verification }],
    review: { language: 'draft', culture: 'draft' },
    contentVer: 1,
    ...extra,
  };
}
