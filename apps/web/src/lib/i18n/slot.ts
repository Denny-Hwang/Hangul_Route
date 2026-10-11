/**
 * A one-argument message split around its argument, so a page can style the argument
 * (a bold name) while the sentence stays one message that a translation may reorder
 * (F-I18N-001 §3.1: a sentence is one message, never two fragments glued together).
 */
const SLOT = '\u0000';

export function aroundSlot(message: (value: string) => string): { before: string; after: string } {
  const text = message(SLOT);
  const at = text.indexOf(SLOT);
  if (at < 0) return { before: text, after: '' };
  return { before: text.slice(0, at), after: text.slice(at + SLOT.length) };
}
