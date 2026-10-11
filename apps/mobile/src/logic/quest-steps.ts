import type { QuestStepKind } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';

/**
 * Learner-facing name of a quest step (wireframe quest/player "kind pill").
 * The schema kinds are authoring terms (content-skill 5-step pattern); a
 * learner should read plain Pre-A1 words, not "present" or "apply". The words
 * live in the dictionary (`learner.quest.step`), passed in so this stays pure.
 */
export function questStepLabel(kind: QuestStepKind, step: Messages['learner']['quest']['step']): string {
  switch (kind) {
    case 'intro':
      return step.intro.pill;
    case 'present':
      return step.present.pill;
    case 'discover':
      return step.discover.pill;
    case 'practice':
      return step.practice.pill;
    case 'apply':
      return step.apply.pill;
    case 'check':
      return step.check.pill;
    case 'reward':
      return step.reward.pill;
  }
}
