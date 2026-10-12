import type { Quest, Story } from '@hangul-route/content-schema';
import { VOCAB_ITEMS, VOCAB_TOPICS } from '../../../content/__generated__/vocab';
import { episodesAll } from '../../../content/episodes';
import { heritageCardsAll } from '../../../content/heritage-cards';
import { jamoAll } from '../../../content/jamo';
import { questsAll } from '../../../content/quests';
import { stages, themes } from '../../../content/stages';
import { scopeFor } from '../../minigame-config';
import { shelfEpisode, story, storyQuest, unreviewed } from '../../story/__tests__/shelf-fixture';
import { buildBrowseBundle, type BrowseBundle, type BrowseBundleInput } from '../bundle';

/**
 * The production bundle plus what it does not hold yet: reviewed shelf
 * stories (no bundled story has passed review) and word topics past draft.
 * One reviewed Story Time tale, one reviewed Culture story, one unreviewed
 * tale (the review gate must keep it out), every word topic `ready`.
 */
export const TALE_ID = 'story:hangul-day';
export const CULTURE_ID = 'story:kimchi-day';
export const DRAFT_ID = 'story:draft-tale';

export function fixtureStories(): Story[] {
  return [
    story('hangul-day'),
    story('kimchi-day', { shelf: { category: 'culture', order: 2, sampler: false } }),
    unreviewed(story('draft-tale', { shelf: { order: 3 } })),
  ];
}

/** The fixture input; `stories` replaces the fixture stories (each still gets its shelf episode and listen quest). */
export function fixtureInput(stories: Story[] = fixtureStories()): BrowseBundleInput {
  const storyQuests: Quest[] = stories.map((s) => ({ ...storyQuest(s.id.replace(/^story:/, '')), titleEn: s.title.en, estimatedMinutes: 5 }));
  return {
    stages,
    themes,
    episodes: [...episodesAll, ...stories.map((s) => shelfEpisode(s))],
    quests: [...questsAll, ...storyQuests],
    jamo: jamoAll,
    cards: heritageCardsAll,
    stories,
    vocabTopics: VOCAB_TOPICS.map((t) => ({ ...t, status: 'ready' as const })),
    vocabItems: VOCAB_ITEMS,
    scopeFor,
  };
}

export function fixtureBundle(over: Partial<BrowseBundleInput> = {}): BrowseBundle {
  return buildBrowseBundle({ ...fixtureInput(), ...over });
}
