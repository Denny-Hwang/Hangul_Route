import type { QuestStepKind } from '@hangul-route/content-schema';

/**
 * Learner-facing name of a quest step (wireframe quest/player "kind pill").
 * The schema kinds are authoring terms (content-skill 5-step pattern); a
 * learner should read plain Pre-A1 English, not "present" or "apply".
 */
export function questStepLabel(kind: QuestStepKind): string {
  switch (kind) {
    case 'intro':
      return 'Hello';
    case 'present':
      return 'Look and listen';
    case 'practice':
      return 'Practice';
    case 'apply':
      return 'Try it';
    case 'reward':
      return 'Finish';
  }
}
