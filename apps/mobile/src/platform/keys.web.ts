import type { ReaderKeyHandler, ReaderKeyName } from './keys';

/**
 * Web variant (F-STORY-002 §3.10): Right / Left arrows turn the page, Escape
 * closes the gloss card. A held key repeats `keydown`; repeats are dropped so
 * a key never runs through the story. Keys typed into a field, keys with a
 * modifier (browser shortcuts) and events another handler already used are
 * left alone.
 */
export type { ReaderKeyHandler, ReaderKeyName };

const KEYS: ReadonlySet<string> = new Set<ReaderKeyName>(['ArrowRight', 'ArrowLeft', 'Escape']);
const FIELDS: ReadonlySet<string> = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

interface KeyEventLike {
  key: string;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  defaultPrevented?: boolean;
  target?: unknown;
  preventDefault(): void;
}

interface KeyTarget {
  addEventListener(type: 'keydown', fn: (event: KeyEventLike) => void): void;
  removeEventListener(type: 'keydown', fn: (event: KeyEventLike) => void): void;
}

function typing(target: unknown): boolean {
  if (target === null || typeof target !== 'object') return false;
  const el = target as { tagName?: unknown; isContentEditable?: unknown };
  return (typeof el.tagName === 'string' && FIELDS.has(el.tagName)) || el.isContentEditable === true;
}

export function subscribeReaderKeys(handler: ReaderKeyHandler): () => void {
  const doc = (globalThis as { document?: KeyTarget }).document;
  if (!doc) return () => undefined;
  const onKey = (event: KeyEventLike): void => {
    if (!KEYS.has(event.key) || event.repeat || event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey || typing(event.target)) return;
    if (handler(event.key as ReaderKeyName)) event.preventDefault();
  };
  doc.addEventListener('keydown', onKey);
  return () => doc.removeEventListener('keydown', onKey);
}
