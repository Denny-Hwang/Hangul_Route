import type { Episode, HeritageCard, StageKey } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { parseUnlockedBy } from './rules';
import type { AwardWorld } from './types';

type HowMessages = Messages['learner']['library']['how'];

/**
 * The Library's "How to collect more" lines (F-STORY-006 §3.7, wireframe
 * library/earn-hints F). Honest by construction: a line appears only when a
 * card the Library lists is earned that way, so nothing is promised that this
 * build cannot give. Order: quest, episode, stage, story, welcome.
 *
 * `listed` is what the Library shows (`obtainableCards`). The words come from
 * `learner.library.how`.
 */
export function libraryExplainer(world: AwardWorld, listed: readonly HeritageCard[], m: HowMessages): string[] {
  const listedById = new Map(listed.map((c) => [c.id, c]));
  const episodeById = new Map(world.episodes.map((e) => [e.id, e]));
  /** The episode a card's rule names, when it is in the bundle. */
  const episodeOf = (card: HeritageCard): Episode | undefined => {
    const rule = parseUnlockedBy(card.unlockedBy);
    return rule.kind === 'episode' ? episodeById.get(rule.episodeId) : undefined;
  };
  const isStory = (card: HeritageCard): boolean => episodeOf(card)?.format === 'story';

  // A story's own quest card is the story line, not the quest line.
  const quest = world.quests.some((q) => {
    const card = q.rewardCardId === undefined ? undefined : listedById.get(q.rewardCardId);
    return card !== undefined && !isStory(card);
  });
  const episode = listed.some((c) => episodeOf(c) !== undefined && !isStory(c));
  const story = listed.some(isStory);
  const welcome = listed.some((c) => parseUnlockedBy(c.unlockedBy).kind === 'welcome');
  const stages = new Set<StageKey>();
  for (const card of listed) {
    const rule = parseUnlockedBy(card.unlockedBy);
    if (rule.kind === 'stage') stages.add(rule.stage);
  }

  const lines: string[] = [];
  if (quest) lines.push(m.quest);
  if (episode) lines.push(m.episode);
  for (const stage of [...stages].sort()) lines.push(m.stage(Number(stage.slice('stage'.length))));
  if (story) lines.push(m.story);
  if (welcome) lines.push(m.welcome);
  return lines;
}
