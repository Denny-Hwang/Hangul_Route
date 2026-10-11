import { DEFAULT_LOCALE, en, getMessages, type UiLocale } from '@hangul-route/i18n';

/**
 * Console strings that carry tone — F-CONSOLE-001, tested against the caregiver ban list.
 * They live in `@hangul-route/i18n` (`messages/en/console.ts`, F-I18N-001 PR 9) with their
 * keys unchanged; `COPY` is the English console namespace, kept so pages read it until
 * they switch to `useMessages()` (PRs 10a-10c).
 */
export const COPY = en.console;

type Rendered = (...args: unknown[]) => string;

/** Sample arguments for function messages: a count of one (the singular form) and a typical pair. */
const SAMPLE_ARGS: readonly (readonly unknown[])[] = [
  [1, 1, 1, false, 1],
  [16, 20, 16, true, 20],
];

function collect(node: unknown, out: string[]): void {
  if (typeof node === 'string') out.push(node);
  else if (typeof node === 'function') for (const args of SAMPLE_ARGS) out.push((node as Rendered)(...args));
  else if (Array.isArray(node)) for (const item of node) collect(item, out);
  else if (node !== null && typeof node === 'object') for (const value of Object.values(node)) collect(value, out);
}

/** Every console string for `locale`, function messages rendered with sample arguments (for the safety tests). */
export function allCopyStrings(locale: UiLocale = DEFAULT_LOCALE): string[] {
  const out: string[] = [];
  collect(getMessages(locale).console, out);
  return out;
}
