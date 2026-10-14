import type { Quest, Story, StoryLevel } from '@hangul-route/content-schema';

/**
 * The five-step story quest (F-STORY-003 §3.1) for one story at one level
 * (F-STORY-005 §3.2 "Books"): the TypeScript twin of the quest constants in
 * `scripts/build-stories.mjs`. The generator writes the shelf (Listen) quests;
 * this builds the Stage 5 book (Read) quests of `books.ts`. `books.test.ts`
 * asserts that at the `listen` level this equals every generated quest, so
 * the two cannot drift.
 */

/** Quest copy owned by the generator (F-STORY-001 §3.9); keep equal to QUEST_COPY in build-stories.mjs. */
export const STORY_QUEST_COPY = Object.freeze({
  intro: 'Story time',
  read: 'Read the story',
  check: 'A few questions',
  seq: 'Put the story in order',
  reward: 'Well done',
});

/** Keep equal to STEP_SECONDS in build-stories.mjs. */
export const STORY_STEP_SECONDS = Object.freeze({ intro: 8, read: 150, check: 60, seq: 45, reward: 8 });

const LEVEL_CODES: Record<StoryLevel, string> = { listen: 'listen', 'read-along': 'along', read: 'read' };

function need(story: Story, field: 'hoyaIntroEn' | 'hoyaOutroEn'): string {
  const value = story[field];
  if (!value) throw new Error(`${story.id}: a story quest needs ${field}`);
  return value;
}

/** The reward card of the quest's own level (`rewardCardIds.listen` / `.read`); read-along has none. */
function rewardCardOf(story: Story, level: StoryLevel): string | undefined {
  if (level === 'listen') return story.rewardCardIds?.listen;
  if (level === 'read') return story.rewardCardIds?.read;
  return undefined;
}

export function storyQuestSkeleton(story: Story, level: StoryLevel): Quest {
  const slug = story.id.replace(/^story:/, '');
  const code = LEVEL_CODES[level];
  const hoyaIntroEn = need(story, 'hoyaIntroEn');
  const hoyaOutroEn = need(story, 'hoyaOutroEn');
  const ref = (step: 'read' | 'check' | 'seq'): string => `minigame:story-${step}-${code}-${slug}`;
  const quest: Quest = {
    id: `quest:story-${slug}-${code}`,
    titleEn: story.title.en,
    estimatedMinutes: Math.max(3, story.minutes),
    steps: [
      { id: 's1', kind: 'intro', titleEn: STORY_QUEST_COPY.intro, hoyaLineEn: hoyaIntroEn, durationSeconds: STORY_STEP_SECONDS.intro },
      {
        id: 's2',
        kind: 'present',
        titleEn: STORY_QUEST_COPY.read,
        minigameKind: 'story-read',
        minigameRef: ref('read'),
        durationSeconds: STORY_STEP_SECONDS.read,
      },
      {
        id: 's3',
        kind: 'practice',
        titleEn: STORY_QUEST_COPY.check,
        minigameKind: 'story-check',
        minigameRef: ref('check'),
        durationSeconds: STORY_STEP_SECONDS.check,
      },
      {
        id: 's4',
        kind: 'apply',
        titleEn: STORY_QUEST_COPY.seq,
        minigameKind: 'story-sequence',
        minigameRef: ref('seq'),
        durationSeconds: STORY_STEP_SECONDS.seq,
      },
      { id: 's5', kind: 'reward', titleEn: STORY_QUEST_COPY.reward, hoyaLineEn: hoyaOutroEn, durationSeconds: STORY_STEP_SECONDS.reward },
    ],
  };
  const card = rewardCardOf(story, level);
  if (card) quest.rewardCardId = card;
  return quest;
}
