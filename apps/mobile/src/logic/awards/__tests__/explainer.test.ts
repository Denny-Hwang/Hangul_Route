import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { awardWorld } from '../../../content/award-world';
import { scanLearnerCopy } from '../../homework/banned-text';
import { libraryExplainer } from '../explainer';
import { obtainableCards } from '../obtainable';
import type { AwardWorld } from '../types';
import { WORLD } from './fixtures';

const how = getMessages('en').learner.library.how;
const lines = (world: AwardWorld, owned: readonly string[] = []): string[] =>
  libraryExplainer(world, obtainableCards(world, new Set(owned)), how);

describe('libraryExplainer (F-STORY-006 §3.7, wireframe library/earn-hints F)', () => {
  it('says only what a rule of this build can do: quest, episode, stage, story and welcome lines in that order', () => {
    expect(lines(WORLD)).toEqual([
      'Finish a quest to earn its card.',
      'Finish every quest in an episode to earn more cards.',
      'Finish all of Stage 1 for the legendary cards.',
      'Finish a story to earn its card.',
      "Hoya's tiger card is a welcome gift.",
    ]);
  });

  it('has no story line until a story card can be earned', () => {
    const noStory: AwardWorld = { ...WORLD, episodes: WORLD.episodes.filter((e) => e.format !== 'story') };
    expect(lines(noStory)).not.toContain('Finish a story to earn its card.');
  });

  it('has no stage line while no stage can complete (its legendary cards are not listed)', () => {
    const noStage: AwardWorld = { ...WORLD, cards: WORLD.cards.filter((c) => c.id !== 'card:lantern') };
    expect(lines(noStage).some((l) => l.includes('Stage'))).toBe(false);
  });

  it('a stage card already owned names its stage, even when the stage can no longer complete', () => {
    expect(lines(WORLD, ['card:stage2-prize'])).toContain('Finish all of Stage 2 for the legendary cards.');
  });

  it('has no quest line when no listed card is a quest reward, and no welcome line without a welcome card', () => {
    const bare: AwardWorld = { ...WORLD, quests: [], cards: WORLD.cards.filter((c) => c.unlockedBy !== 'first-launch') };
    expect(lines(bare)).not.toContain('Finish a quest to earn its card.');
    expect(lines(bare)).not.toContain("Hoya's tiger card is a welcome gift.");
  });

  it('a story quest card alone gives the story line, not the quest line', () => {
    const storyQuestOnly: AwardWorld = { ...WORLD, quests: WORLD.quests.filter((q) => q.id === 'quest:story-sun-and-moon-a1') };
    expect(lines(storyQuestOnly)).not.toContain('Finish a quest to earn its card.');
    expect(lines(storyQuestOnly)).toContain('Finish a story to earn its card.');
  });

  it('has no episode line when the only episode cards are story cards', () => {
    const storiesOnly: AwardWorld = {
      ...WORLD,
      cards: WORLD.cards.filter((c) => !c.unlockedBy.startsWith('episode:') || c.storyId !== undefined),
    };
    expect(lines(storiesOnly)).not.toContain('Finish every quest in an episode to earn more cards.');
  });

  it('ignores a listed card whose episode is not in the bundle', () => {
    const orphan: AwardWorld = { ...WORLD, episodes: [], quests: [], cards: [WORLD.cards[0]!] };
    expect(libraryExplainer(orphan, orphan.cards, how)).toEqual([]);
  });

  it('for the shipped bundle: the five lines, never a fraction, a percent or a shaming word', () => {
    const shipped = lines(awardWorld);
    expect(shipped).toEqual([
      'Finish a quest to earn its card.',
      'Finish every quest in an episode to earn more cards.',
      'Finish all of Stage 1 for the legendary cards.',
      'Finish a story to earn its card.',
      "Hoya's tiger card is a welcome gift.",
    ]);
    for (const line of shipped) expect(line).not.toMatch(/\d\s*\/\s*\d|%/);
    expect(scanLearnerCopy(shipped)).toEqual([]);
  });
});
