import { getMessages, levelWords, type UiLocale } from '@hangul-route/i18n';

/**
 * Text of the level pill on a roster card or demo card (F-LEARN-001 §3.7), in the console's UI locale.
 * `ageGroup` is an opaque level id, not an age: the pill shows its plain-language
 * label in that locale ("Some reading", "Algo de lectura"), and is simply not drawn (null) for an id this build
 * does not know, e.g. a level a newer app registered.
 */
export function levelPillLabel(ageGroup: string, locale: UiLocale): string | null {
  return levelWords(getMessages(locale), ageGroup)?.label ?? null;
}
