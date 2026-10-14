import type { Episode, Quest, Story } from '@hangul-route/content-schema';
import { VOCAB_ITEMS, VOCAB_TOPICS } from '../../../content/__generated__/vocab';
import { episodesAll } from '../../../content/episodes';
import { heritageCardsAll } from '../../../content/heritage-cards';
import { jamoKnown } from '../../../content/jamo';
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

/**
 * Every grid cell has shipped since F-CURR-001 S7-5, so the fixture takes one cell, Make & Share (Stage 7
 * crafts), back to a "Coming later" placeholder (no quests), so a later cell is still there to check.
 */
export const LATER_CELL = 'episode:stage7-crafts';
const comingLater = (e: Episode): Episode => (e.id === LATER_CELL ? { ...e, status: 'preview', questIds: [] } : e);

/** The fixture input; `stories` replaces the fixture stories (each still gets its shelf episode and listen quest). */
export function fixtureInput(stories: Story[] = fixtureStories()): BrowseBundleInput {
  const storyQuests: Quest[] = stories.map((s) => ({ ...storyQuest(s.id.replace(/^story:/, '')), titleEn: s.title.en, estimatedMinutes: 5 }));
  return {
    stages,
    themes,
    episodes: [...episodesAll.map(comingLater), ...stories.map((s) => shelfEpisode(s))],
    quests: [...questsAll.filter((q) => !q.id.startsWith(`${LATER_CELL.replace('episode:', 'quest:')}-`)), ...storyQuests],
    jamo: jamoKnown,
    cards: heritageCardsAll,
    stories,
    vocabTopics: VOCAB_TOPICS.map((t) => ({ ...t, status: 'ready' as const })),
    vocabItems: VOCAB_ITEMS,
    scopeFor,
    // Every picture drawn: the T8 cases pass their own check.
    canRender: () => true,
  };
}

export function fixtureBundle(over: Partial<BrowseBundleInput> = {}): BrowseBundle {
  return buildBrowseBundle({ ...fixtureInput(), ...over });
}
