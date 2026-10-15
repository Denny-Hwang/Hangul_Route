import { levelOrder } from '@hangul-route/content-schema';
import type { Messages } from './types';

/** `common.levels` keys in level order (content-schema `LEARNER_LEVELS`: 0, 1, 2). */
const LEVEL_KEYS = ['pictures', 'someReading', 'readsEasily'] as const;

export interface LevelWords {
  label: string;
  description: string;
}

/**
 * A learner level's label and description in the dictionary of `messages` (F-LEARN-001 §3.7; F-I18N-001 §4). The
 * stored level id is opaque ('8-9' is a level, never an age), so the words are found by the level's order; null for an
 * id this build does not know (a pill is then simply not drawn).
 */
export function levelWords(messages: Messages, id: string): LevelWords | null {
  const order = levelOrder(id);
  if (order === null) return null;
  const words = messages.common.levels[LEVEL_KEYS[order]];
  return { label: words.label, description: words.description };
}
