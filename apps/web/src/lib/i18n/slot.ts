/**
 * A one-argument message split around its argument, so a page can style the argument
 * (a bold name, taught Korean marked `lang="ko"`) while the sentence stays one message
 * that a translation may reorder (F-I18N-001 §3.1: a sentence is one message, never two
 * fragments glued together).
 *
 * The messages passed here use their argument exactly once in every locale (checked by
 * packages/i18n console-pages-messages.test.ts). Should a translation still repeat it, the
 * extra sentinels are dropped rather than rendered as a control character.
 */
export const SLOT = '\u0000';

export function aroundSlot(message: (value: string) => string): { before: string; after: string } {
  const text = message(SLOT);
  const at = text.indexOf(SLOT);
  if (at < 0) return { before: text, after: '' };
  return { before: text.slice(0, at), after: text.slice(at + SLOT.length).split(SLOT).join('') };
}
