/**
 * Page keyboard for the story reader (F-STORY-002 §3.10). Native has no page
 * keyboard to listen to (the back gesture and Android back go through the
 * navigator), so this is a no-op; `keys.web.ts` listens on the document.
 */
export type ReaderKeyName = 'ArrowRight' | 'ArrowLeft' | 'Escape';

/** The handler returns true when it used the key (the browser default is then prevented). */
export type ReaderKeyHandler = (key: ReaderKeyName) => boolean;

export function subscribeReaderKeys(_handler: ReaderKeyHandler): () => void {
  return () => undefined;
}
