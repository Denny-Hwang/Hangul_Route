import { z } from 'zod';

/**
 * The learner name rule, shared by the app and the Worker (F-PROF-001 section
 * 3.2). Learner names are user data, not UI text, so they are valid in every
 * UI language: Latin letters including accents (María, Zoë), Hangul
 * syllables, digits, spaces, apostrophes and hyphens. Emoji, other scripts and
 * control characters stay out. Explicit ranges, not \p{...}: Hermes support
 * for Unicode property escapes is not guaranteed (F-I18N-001 section 3.9).
 *
 * Same length and characters as the device rule in
 * apps/mobile/src/logic/profiles/profile-model.ts (`validateDisplayName`), so
 * every name a device accepts is accepted here. It checks a name newly typed
 * in the app's edit screen; the server accepts the lenient
 * `LegacyDisplayNameSchema` below, and a stored legacy name is read as it is
 * and never rewritten.
 *
 * The regex message is for developers only. Clients never show it: they map
 * the error by its code to their own text through packages/i18n.
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

/**
 * The name rule the server applies to every incoming learner name: registration, a join and PATCH. Lenient on
 * purpose (trim, 1-20), the same bound `ProfileSchema` keeps on the device: apps hold legacy names typed before
 * the stricter rule above (up to 20 characters, for example "Alexandria Mae" or "Mina_K") and send them unchanged
 * when they register, join or push their current name. A stricter server rule would refuse those requests on
 * every retry. The strict `DisplayNameSchema` applies only to a name newly typed in the app's edit screen, on the
 * device.
 */
export const LEGACY_DISPLAY_NAME_MAX = 20;
/**
 * Characters no name may carry, legacy or not: C0 and C1 control characters (newline, tab), the zero-width space
 * U+200B, the direction marks U+200E-U+200F, the bidi embeddings and overrides U+202A-U+202E, the word joiner and
 * bidi isolates U+2060-U+2069, and the byte order mark U+FEFF. No device rule ever produced them, and they would
 * reach every console that shows the roster. U+200C and U+200D stay allowed: some scripts and emoji sequences need
 * them, and a legacy name that holds one must not be refused on every retry. Explicit ranges, no `u` flag.
 */
export const DISPLAY_NAME_FORBIDDEN = /[\u0000-\u001F\u007F-\u009F\u200B\u200E\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/;
export const LegacyDisplayNameSchema = z
  .string()
  .trim()
  .min(DISPLAY_NAME_MIN)
  .max(LEGACY_DISPLAY_NAME_MAX)
  .refine((s) => !DISPLAY_NAME_FORBIDDEN.test(s), 'Names carry no control, zero-width or direction characters');
