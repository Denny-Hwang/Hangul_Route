import {
  routeCatalogOf,
  type Catalog,
  type Episode,
  type MinigameKind,
  type ProgressSnapshot,
  type Quest,
  type QuestStep,
  type RouteCatalog,
  type StageDef,
  type StageKey,
  type ThemeDef,
  type ThemeKey,
} from '@hangul-route/content-schema';

/**
 * FROZEN (F-ROUTE-001 section 5). A copy of the content bundle as it shipped in
 * October 2026: Stage 1 = 8 quests in five shipped cells, `stage2-life`,
 * `stage2-nature` and `stage4-rites` shipped, every other cell a preview
 * placeholder, no shelf story. `BUNDLE_15` grows Stage 1 to the 15 quests of
 * F-QUEST-002 section 3.6 (the same cells as the content-schema fixture
 * `catalog-2026-10.ts`). Counts in the my-route tests are asserted on these
 * fixtures, never on the live bundle, so they stay true while content grows.
 * Never edit to follow the content; add a new dated fixture instead.
 * One display rename only (F-STORY-005 row 5.6c, owner decision 2026-10-14): the
 * Stage 5 nature cell reads Nature Tales (was Tiger Folktales); no id or count changed.
 */

export interface Bundle {
  episodes: Episode[];
  quests: Quest[];
}

const STAGES: readonly StageKey[] = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'];
const THEMES: readonly ThemeKey[] = ['letters', 'life', 'rites', 'nature', 'crafts'];

const step = (index: number, kind: MinigameKind): QuestStep => ({
  id: `s${index + 2}`,
  kind: 'practice',
  titleEn: `Step ${index + 2}`,
  minigameKind: kind,
  minigameRef: `minigame:${kind}-${index}`,
});

export const quest = (id: string, titleEn: string, kinds: readonly MinigameKind[]): Quest => ({
  id,
  titleEn,
  estimatedMinutes: 5,
  steps: [
    { id: 's1', kind: 'intro', titleEn: 'Intro' },
    ...kinds.map((kind, i) => step(i, kind)),
    { id: 'reward', kind: 'reward', titleEn: 'Reward' },
  ],
});

export const episode = (
  stage: StageKey,
  theme: ThemeKey,
  titleEn: string,
  questIds: string[],
  status: Episode['status'] = questIds.length > 0 ? 'shipped' : 'preview',
): Episode => ({
  id: `episode:${stage}-${theme}`,
  stage,
  theme,
  order: THEMES.indexOf(theme) + 1,
  titleEn,
  hoyaIntroEn: 'Hi!',
  questIds,
  rewardCardIds: [],
  estimatedMinutes: 10,
  status,
});

/** The step kinds of today's 11 quests (`apps/mobile/src/content/quests.ts`, October 2026). */
const QUESTS_8: Quest[] = [
  quest('quest:stage1-letters-q1', 'Meet the First Letters', ['match-sound', 'match-sound', 'build-letter']),
  quest('quest:stage1-letters-q2', 'More Letters', ['match-sound', 'trace-stroke', 'match-sound']),
  quest('quest:stage1-letters-q3', 'Six Vowels', ['match-sound', 'odd-one-out', 'build-letter']),
  quest('quest:stage1-life-q1', 'Hello Kimchi & Rice', ['card-match', 'card-match', 'match-sound']),
  quest('quest:stage1-life-q2', 'Family at the Table', ['card-match', 'story-sequence', 'card-match']),
  quest('quest:stage1-rites-q1', 'Bow & Eat Tteokguk', ['card-match', 'match-sound', 'story-sequence']),
  quest('quest:stage1-nature-q1', 'Tiger, Magpie, Moon', ['card-match', 'match-sound', 'culture-quiz']),
  quest('quest:stage1-crafts-q1', 'Yut, Kite, Top', ['card-match', 'match-sound', 'story-sequence']),
];
const QUESTS_TASTE: Quest[] = [
  quest('quest:stage2-life-q1', 'Lunch Box Words', ['card-match', 'culture-quiz', 'build-letter']),
  quest('quest:stage2-nature-q1', 'Outdoor Words', ['card-match', 'culture-quiz', 'build-letter']),
  quest('quest:stage4-rites-q1', 'Greeting Dialogues', ['card-match', 'tap-respond', 'culture-quiz']),
];

const PREVIEW_TITLES: Record<string, readonly string[]> = {
  stage2: ['Word Builder', 'Lunch Box Words', 'Holiday Words', 'Outdoor Words', 'Playground Words'],
  stage3: ['First Sentences', 'Daily Mini-Sentences', 'Festival Sentences', 'Animal Sentences', 'Game Sentences'],
  stage4: ['Reading Aloud', 'Kitchen Talk', 'Greeting Dialogues', 'Park Conversations', 'Playdate Talk'],
  stage5: ['Short Stories', 'Family Stories', 'Festival Tales', 'Nature Tales', 'Craft Stories'],
  stage6: ['Read the Menu', 'Order Food', 'Travel for Chuseok', 'Hike & Ask', 'Buy at Market'],
  stage7: ['Write Your Name', 'My Day in Korean', 'My Holiday Memory', 'My Favorite Animal', 'Make & Share'],
};

const upperEpisodes = (): Episode[] =>
  STAGES.slice(1).flatMap((stage) =>
    THEMES.map((theme, i) => {
      const id = `quest:${stage}-${theme}-q1`;
      const shipped = QUESTS_TASTE.some((q) => q.id === id);
      return episode(stage, theme, PREVIEW_TITLES[stage]?.[i] ?? 'Coming soon', shipped ? [id] : []);
    }),
  );

const stage1Episodes = (perTheme: Record<ThemeKey, string[]>): Episode[] => [
  episode('stage1', 'letters', 'Meet the Letters', perTheme.letters),
  episode('stage1', 'life', 'Around the Korean Table', perTheme.life),
  episode('stage1', 'rites', 'New Year & Festivals', perTheme.rites),
  episode('stage1', 'nature', 'Tigers, Mountains, Moon', perTheme.nature),
  episode('stage1', 'crafts', 'Yut, Kites & Paper', perTheme.crafts),
];

const ids = (theme: ThemeKey, n: number): string[] =>
  Array.from({ length: n }, (_, i) => `quest:stage1-${theme}-q${i + 1}`);

/** Today's bundle: 8 + 2 + 1 quests. */
export const BUNDLE_8: Bundle = {
  episodes: [
    ...stage1Episodes({ letters: ids('letters', 3), life: ids('life', 2), rites: ids('rites', 1), nature: ids('nature', 1), crafts: ids('crafts', 1) }),
    ...upperEpisodes(),
  ],
  quests: [...QUESTS_8, ...QUESTS_TASTE],
};

const QUESTS_15_EXTRA: Quest[] = [
  quest('quest:stage1-life-q3', 'Picnic Snacks', ['match-sound', 'build-letter']),
  quest('quest:stage1-rites-q2', 'Rice Cakes of Chuseok', ['match-sound', 'listen-pick']),
  quest('quest:stage1-rites-q3', 'Hanbok and the Bow', ['match-sound', 'trace-stroke']),
  quest('quest:stage1-nature-q2', 'Mountain, River, Sea', ['pic-word-match', 'listen-pick']),
  quest('quest:stage1-nature-q3', 'Moon, Stars and Night', ['pic-word-match', 'syllable-build']),
  quest('quest:stage1-crafts-q2', 'Paper and Pottery', ['match-sound', 'trace-stroke']),
  quest('quest:stage1-crafts-q3', 'Read Hangul!', ['pic-word-match', 'match-sound']),
];

/** Stage 1 at the 15 quests of F-QUEST-002 section 3.6; everything else as `BUNDLE_8`. */
export const BUNDLE_15: Bundle = {
  episodes: [
    ...stage1Episodes({ letters: ids('letters', 3), life: ids('life', 3), rites: ids('rites', 3), nature: ids('nature', 3), crafts: ids('crafts', 3) }),
    ...upperEpisodes(),
  ],
  quests: [...QUESTS_8.slice(0, 5), QUESTS_15_EXTRA[0] as Quest, QUESTS_8[5] as Quest, QUESTS_15_EXTRA[1] as Quest, QUESTS_15_EXTRA[2] as Quest, QUESTS_8[6] as Quest, QUESTS_15_EXTRA[3] as Quest, QUESTS_15_EXTRA[4] as Quest, QUESTS_8[7] as Quest, QUESTS_15_EXTRA[5] as Quest, QUESTS_15_EXTRA[6] as Quest, ...QUESTS_TASTE],
};

/** The route catalogue of a bundle, built the way `catalog/data.ts` mirrors the real one. */
export const catalogOf = (bundle: Bundle): RouteCatalog => {
  const catalog: Catalog = {
    version: 1,
    cells: bundle.episodes.map((e) => ({
      stage: e.stage,
      theme: e.theme,
      episodeId: e.id,
      title: e.titleEn,
      status: e.status,
      minutes: e.estimatedMinutes,
      questIds: [...e.questIds],
    })),
    quests: bundle.episodes.flatMap((e) =>
      e.questIds.map((id) => ({ id, episodeId: e.id, stage: e.stage, theme: e.theme, title: id, minutes: 5, teaches: [], kind: 'lesson' as const })),
    ),
    stories: [],
    topics: [],
  };
  return routeCatalogOf(catalog);
};

export const STAGE_DEFS: StageDef[] = STAGES.map((key, i) => ({
  key,
  order: i + 1,
  titleEn: ['Hangul', 'Words', 'Sentences', 'Dialogue', 'Stories', 'Real-use', 'Self-expression'][i] as string,
  oneLinerEn: '',
  anchorSkillEn: '',
  unlockedByDefault: i === 0,
}));

export const THEME_DEFS: ThemeDef[] = THEMES.map((key, i) => ({
  key,
  order: i + 1,
  titleEn: ['Letters & Books', 'Food & Daily Life', 'Festivals & Rites', 'Nature & Animals', 'Crafts & Play'][i] as string,
  oneLinerEn: '',
}));

/** An empty local snapshot with the given quests finished (one star each unless given). */
export const snapshotWith = (
  done: readonly string[],
  extra: Partial<ProgressSnapshot> = {},
  stars: Partial<Record<string, 0 | 1 | 2 | 3>> = {},
): ProgressSnapshot => ({
  profileId: 'p1',
  updatedAt: '2026-10-11T00:00:00.000Z',
  episodes: [],
  quests: done.map((questId) => ({
    questId,
    episodeId: `episode:${questId.replace(/^quest:/, '').replace(/-q\d+$/, '')}`,
    startedAt: '2026-10-11T00:00:00.000Z',
    completedAt: '2026-10-11T00:05:00.000Z',
    stars: stars[questId] ?? 1,
    attempts: 1,
    accuracy: 1,
  })),
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
  ...extra,
});

export const STAGE1_8 = BUNDLE_8.episodes.filter((e) => e.stage === 'stage1').flatMap((e) => e.questIds);
