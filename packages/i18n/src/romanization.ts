import type { RomanizationMode } from '@hangul-route/content-schema';

export type { RomanizationMode };

/**
 * Whether romanization is visible: always in `always` mode, otherwise only once
 * the learner has tapped to reveal it (F-I18N-001 §3.1, D2). The single implementation.
 */
export function romanizationShown(mode: RomanizationMode, revealed: boolean): boolean {
  return mode === 'always' || revealed;
}
