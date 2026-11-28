import type { RomanizationChoice, RomanizationMode } from '@hangul-route/content-schema';
import { isDecodable, type FadePhase } from './decodable';

/**
 * What a profile's reading practice resolves to (AMENDMENTS-ROMANIZATION-FADE sections 3.1 to 3.5). A profile stores a
 * **choice** (`auto`, `always`, `tap`); a surface draws a **mode** (`always`, `tap`). The choice is never passed to a
 * surface, so every consumer that tests `=== 'always'` keeps its type and its tests.
 */

/**
 * The choice a profile with no stored choice, no `tap` and no record reads as (section 3.2): **As I learn**, which shows
 * every romanization while the learner is learning the letters and folds the words they can read after that (row RF-2
 * turned the fade on; before it this was `always`). A stored `always` with no stored choice reads as this (OD-RF-1).
 */
export const ROMANIZATION_DEFAULT_CHOICE: RomanizationChoice = 'auto';

/** The stored fields the choice is read from; the legacy mode is the mirror an older build wrote. */
export type RomanizationSettings = {
  romanizationChoice?: RomanizationChoice | undefined;
  romanizationMode?: RomanizationMode | undefined;
};

/**
 * The learner's choice (section 3.2). A stored `romanizationChoice` is a real choice. Without one, a stored `tap` is the
 * only legacy value that ever recorded a choice (the old switch's On); a stored `always` is the old switch's Off or a
 * value another writer filled in, so it reads as the default (OD-RF-1), as do no record and a record that did not parse.
 * Nothing is rewritten.
 */
export function romanizationChoiceOf(
  settings: RomanizationSettings | undefined,
  defaultChoice: RomanizationChoice = ROMANIZATION_DEFAULT_CHOICE,
): RomanizationChoice {
  if (settings?.romanizationChoice !== undefined) return settings.romanizationChoice;
  return settings?.romanizationMode === 'tap' ? 'tap' : defaultChoice;
}

/** What the legacy `romanizationMode` field holds beside a choice: `tap` for `tap`, the old default for the rest (section 3.2). */
export function romanizationMirrorOf(choice: RomanizationChoice): RomanizationMode {
  return choice === 'tap' ? 'tap' : 'always';
}

/** What a resolution reads of the fade: the phase, the symbols met, and whether a screen reader is in use (section 3.5). */
export interface FadeContext {
  phase: FadePhase;
  met: ReadonlySet<string>;
  screenReader: boolean;
}

export interface RomanizationResolver {
  /** The mode a surface shows for anything it does not resolve per text. */
  surface: RomanizationMode;
  /** The mode inside a Check (section 3.7): as `surface`, except that `auto` is always `always` there. */
  check: RomanizationMode;
  /** The mode for one Korean text, on the item-level surfaces of section 3.6 only. */
  forText: (ko: string) => RomanizationMode;
}

/**
 * The three resolutions of section 3.5. Precedence in all of them: an override (All lessons, a Check's own provider)
 * wins; then an explicit choice (`always`, `tap`); then a screen reader; then the phase. `fade` is `null` with no active
 * profile or a progress snapshot not read yet (row S4: `always`).
 */
export function romanizationResolver(
  override: RomanizationMode | null,
  settings: RomanizationSettings | undefined,
  fade: FadeContext | null,
): RomanizationResolver {
  const choice = romanizationChoiceOf(settings);
  // Row S2 to S7: the mode a surface shows for anything it does not resolve per text.
  const surface: RomanizationMode =
    override ?? (choice !== 'auto' ? choice : fade === null || fade.screenReader || fade.phase !== 'all' ? 'always' : 'tap');
  // A Check never folds on `auto`: only an explicit `tap` is `tap` there.
  const check: RomanizationMode = override ?? (choice === 'tap' ? 'tap' : 'always');
  const forText = (ko: string): RomanizationMode => {
    // Only the bold cell of the per-text table differs from the surface mode: `auto`, phase `reading`, a decodable text.
    if (override !== null || choice !== 'auto' || fade === null || fade.screenReader || fade.phase !== 'reading') return surface;
    return isDecodable(ko, fade.met) ? 'tap' : 'always';
  };
  return { surface, check, forText };
}

/**
 * The romanization mode a screen shows (F-I18N-001 D2, F-BROWSE-001 section 4.9): an override wins (the All lessons
 * display setting, given for a whole tab by a provider); else the profile's choice, with `auto` following the fade; else
 * the default, which is `always` for every screen with no active profile.
 */
export function resolveRomanizationMode(
  override: RomanizationMode | null,
  settings: RomanizationSettings | undefined,
  fade: FadeContext | null = null,
): RomanizationMode {
  return romanizationResolver(override, settings, fade).surface;
}
