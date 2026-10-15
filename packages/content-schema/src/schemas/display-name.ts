import { z } from 'zod';

/**
 * The learner name rule, shared by the app and the Worker (F-PROF-001 section
 * 3.2). Learner names are user data, not UI text, so they are valid in every
 * UI language: Latin letters including accents (María, Zoë), Hangul syllables
 * syllables, digits, spaces, apostrophes and hyphens. Emoji, other scripts and
 * control characters stay out. Explicit ranges, not \p{...}: Hermes support
 * for Unicode property escapes is not guaranteed (F-I18N-001 section 3.9).
 *
 * Same length and characters as the device rule in
 * apps/mobile/src/logic/profiles/profile-model.ts (`validateDisplayName`), so
 * every name a device accepts is accepted here. It checks incoming writes
 * only: a stored legacy name is read as it is and never rewritten.
 */
export const DISPLAY_NAME_MIN = 1;
export const DISPLAY_NAME_MAX = 12;
/** Latin A-Z, Latin-1 Supplement to Latin Extended-B (U+00C0-U+024F), Hangul syllables (U+AC00-U+D7A3), digits, space, ' and U+2019, hyphen. */
export const DISPLAY_NAME_CHARS = /^[A-Za-z\u00C0-\u024F\uAC00-\uD7A3 0-9'\u2019-]+$/;

export const DisplayNameSchema = z
  .string()
  .trim()
  .min(DISPLAY_NAME_MIN)
  .max(DISPLAY_NAME_MAX)
  .regex(DISPLAY_NAME_CHARS, 'Names use letters, digits, spaces, apostrophes and hyphens');
export type DisplayName = z.infer<typeof DisplayNameSchema>;
