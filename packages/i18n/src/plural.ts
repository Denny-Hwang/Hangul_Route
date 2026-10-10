import type { UiLocale } from './locales';

export interface PluralForms {
  one: string;
  other: string;
}

/**
 * Hand-rolled plural selection (the platform plural-rules API is unverified on
 * Hermes, F-I18N-001 §3.1). `en` and `es`: `one` only for exactly 1 (0 and 1.5
 * are `other`). `ko` has no grammatical plural: always `other`.
 */
export function plural(locale: UiLocale, n: number, forms: PluralForms): string {
  if (locale === 'ko') return forms.other;
  return n === 1 ? forms.one : forms.other;
}
