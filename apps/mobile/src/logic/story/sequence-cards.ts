import type { KoText, SceneArt, Story, StoryScene } from '@hangul-route/content-schema';
import type { MinigameScope } from '../minigame-config';

/** One card of Story Order v2 (F-STORY-003 §3.3). */
export interface SequenceCard {
  id: string;
  /** English caption, always shown. */
  caption: string;
  /** Taught Korean (with romanization and gloss), when the card has some. */
  ko?: KoText;
  /** Scene illustration; absent for legacy steps and for scenes whose art is pending. */
  art?: SceneArt;
}

function cardOfScene(scene: StoryScene, level: string): SequenceCard {
  // Listen shows the scene's keyword; read-along and read show its line (else the keyword).
  const ko = level === 'listen' ? scene.keyword : (scene.line ?? scene.keyword);
  const card: SequenceCard = { id: scene.id, caption: scene.captionEn ?? scene.narrationEn };
  if (ko) card.ko = ko;
  if (scene.art) card.art = scene.art;
  return card;
}

/**
 * The cards of one story-sequence step, in the CORRECT order (the player
 * deranges them). A story scope reads `tier.sequenceSceneIds` (or the scope's
 * `sceneIds` override); a legacy scope reads `storySteps` and never has art.
 * Korean is shown only with its romanization (CLAUDE.md §1).
 */
export function buildSequenceCards(scope: MinigameScope, story: Story | undefined): SequenceCard[] {
  const wanted = scope.story;
  if (wanted) {
    const tier = story?.tiers.find((t) => t.level === wanted.level);
    if (!tier) return [];
    const ids = wanted.sceneIds ?? tier.sequenceSceneIds;
    return ids.flatMap((id) => {
      const scene = tier.scenes.find((s) => s.id === id);
      return scene ? [cardOfScene(scene, tier.level)] : [];
    });
  }
  return (scope.storySteps ?? []).map((step) => {
    const card: SequenceCard = { id: step.id, caption: step.labelEn };
    if (step.labelKo && step.romanization) {
      card.ko = { ko: step.labelKo, romanization: step.romanization, en: step.labelEn };
    }
    return card;
  });
}
