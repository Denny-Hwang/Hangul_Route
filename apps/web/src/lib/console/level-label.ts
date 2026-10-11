import { levelLabel } from '@hangul-route/content-schema';

/**
 * Text of the level pill on a roster card or demo card (F-LEARN-001 §3.7).
 * `ageGroup` is an opaque level id, not an age: the pill shows its plain-language
 * label ("Some reading"), and is simply not drawn (null) for an id this build
 * does not know, e.g. a level a newer app registered.
 */
export function levelPillLabel(ageGroup: string): string | null {
  return levelLabel(ageGroup);
}
