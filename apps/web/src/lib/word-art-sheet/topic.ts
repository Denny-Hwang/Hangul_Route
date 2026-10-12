/**
 * The contact sheet's `?topic=<family>` filter (F-VOC-002 §3.10). Kept apart
 * from `sheet.ts` with no value import of the WordArt entry, so the client
 * island that reads the query does not ship the glyph registry to the browser.
 */
export const SHEET_PATH = '/design-preview/word-art';

/** The family named by `?topic=`, if it is one of `known`; null for all. */
export function parseTopic<F extends string>(search: string, known: readonly F[]): F | null {
  const topic = new URLSearchParams(search).get('topic');
  return known.find((f) => f === topic) ?? null;
}

export function topicHref(topic: string | null): string {
  return topic === null ? SHEET_PATH : `${SHEET_PATH}?topic=${topic}`;
}
