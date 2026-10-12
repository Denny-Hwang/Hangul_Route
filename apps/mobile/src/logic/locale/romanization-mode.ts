import type { ProfileSettings, RomanizationMode } from '@hangul-route/content-schema';

/**
 * The romanization mode a screen shows (F-I18N-001 D2, F-BROWSE-001 §4.9): an
 * override wins (the All lessons display setting, given for a whole tab by a
 * provider); else the profile's own setting; else `always`, the default every
 * screen used with no active profile.
 */
export function resolveRomanizationMode(
  override: RomanizationMode | null,
  settings: Pick<ProfileSettings, 'romanizationMode'> | undefined,
): RomanizationMode {
  return override ?? settings?.romanizationMode ?? 'always';
}
