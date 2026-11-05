import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';

/**
 * Console strings that carry tone — F-CONSOLE-001, tested against the caregiver ban list.
 * They live in `@hangul-route/i18n` (`messages/en/console.ts`, F-I18N-001 PR 9) with their
 * keys unchanged, and every page reads them through `useMessages()` (PRs 10a-10c; the
 * English-only `COPY` alias went with PR 10c). This module collects them for the safety tests.
 */

type Rendered = (...args: unknown[]) => string;

/** Sample arguments for function messages: a count of one (the singular form) and a typical pair. */
const SAMPLE_ARGS: readonly (readonly unknown[])[] = [
  [1, 1, 1, false, 1],
  [16, 20, 16, true, 20],
];

/** Sample arguments for a message that takes a list of names (`blend.family.weekdayList`): one name, and three. */
const LIST_ARGS: readonly (readonly unknown[])[] = [[['Wednesday']], [['Wednesday', 'Friday', 'Sunday']]];

/** A function message rendered with the sample arguments; one that cannot take them takes the list samples instead. */
function render(fn: Rendered, out: string[]): void {
  const rendered: string[] = [];
  for (const args of SAMPLE_ARGS) {
    try {
      rendered.push(fn(...args));
    } catch {
      // not a count or text message: tried with the list samples below
    }
  }
  if (rendered.length === SAMPLE_ARGS.length) out.push(...rendered);
  else for (const args of LIST_ARGS) out.push(fn(...args));
}

function collect(node: unknown, out: string[]): void {
  if (typeof node === 'string') out.push(node);
  else if (typeof node === 'function') render(node as Rendered, out);
  else if (Array.isArray(node)) for (const item of node) collect(item, out);
  else if (node !== null && typeof node === 'object') for (const value of Object.values(node)) collect(value, out);
}

/** Every console string for `locale`, function messages rendered with sample arguments (for the safety tests). */
export function allCopyStrings(locale: UiLocale = DEFAULT_LOCALE): string[] {
  const out: string[] = [];
  collect(getMessages(locale).console, out);
  return out;
}
