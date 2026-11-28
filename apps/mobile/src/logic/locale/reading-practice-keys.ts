import type { RomanizationChoice } from '@hangul-route/content-schema';
import { radioAfter } from '../lecture/home-view';

/** The three choices of the Reading practice card, in the order the card draws them (AMENDMENTS-ROMANIZATION-FADE section 3.10). */
export const READING_CHOICES: readonly RomanizationChoice[] = ['auto', 'always', 'tap'];

/**
 * The choice a key chooses on the web's roving-focus radio group (RF-0b Q3): the arrows, Home and End move focus and the
 * choice together (`radioAfter`, as DisplaySheet's groups); Space and Enter choose the row that has focus. Anything else
 * returns `null` (the key is left alone, so Tab still leaves the group).
 */
export function readingChoiceForKey(row: RomanizationChoice, key: string): RomanizationChoice | null {
  if (key === ' ' || key === 'Spacebar' || key === 'Enter') return row;
  return radioAfter(READING_CHOICES, row, key);
}
