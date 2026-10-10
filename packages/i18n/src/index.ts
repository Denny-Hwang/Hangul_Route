/**
 * @hangul-route/i18n — typed UI dictionary, locale helpers, plural and Intl
 * formatters, banned-word lists (F-I18N-001). English is the `as const` source;
 * es/ko are partial overlays that fall back to English.
 */
export type { DeepPartial, MessageFn, Messages, Widen } from './types';
export { en } from './messages/en';
export {
  availableLocales,
  DEFAULT_LOCALE,
  LOCALE_META,
  LOCALE_STATUS,
  LOCALES,
  UI_LOCALES,
  type LocaleMeta,
  type LocaleStatus,
  type UiLocale,
} from './locales';
export { pseudoLocaleEnabled, showAllLocalesEnabled } from './env';
export { detectLocale } from './detect';
export { fallbackPaths, getMessages, resolveLocale, type MessageLocale } from './resolve';
export { lookup } from './tree';
export { plural, type PluralForms } from './plural';
export {
  describeRelativeDay,
  formatDate,
  formatNumber,
  formatUsd,
  type DateInput,
  type DateKind,
  type FormatDateOptions,
  type RelativeDayWords,
} from './format';
export {
  BANNED_WORDS,
  bannedWordsFor,
  findBannedWord,
  isCopySafe,
  scanCopy,
  type BannedSurface,
} from './banned';
export { romanizationShown, type RomanizationMode } from './romanization';
export { PSEUDO_LOCALE, pseudoLocalize, pseudoText } from './pseudo';
