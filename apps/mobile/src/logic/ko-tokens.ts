import { romanizeWord } from '@hangul-route/content-schema';

/**
 * `{ko:}` tokens in UI-language content text (F-CURR-001 §3.4): a Discover pattern note, and the
 * same note shown again under a Sentence Builder particle miss. Korean appears in such a line only
 * inside a token; each token is taught Korean and is drawn with its romanization. One parser, so the
 * Discover pattern page (S3-1) and Sentence Builder split a note the same way. Pure.
 */

/** A piece of a note: plain UI text, or a `{ko:}` token's Korean with its romanization. */
export type KoTokenPart = { text: string } | { ko: string; romanization: string };

const KO_TOKEN = /\{ko:([^}]*)\}/g;

/** Splits `note` around its `{ko:}` tokens; never throws. An empty token is dropped; a token that cannot be romanized keeps an empty romanization. */
export function koTokenParts(note: string): KoTokenPart[] {
  const parts: KoTokenPart[] = [];
  let at = 0;
  for (const match of note.matchAll(KO_TOKEN)) {
    const start = match.index as number;
    if (start > at) parts.push({ text: note.slice(at, start) });
    const ko = (match[1] as string).trim();
    if (ko !== '') parts.push({ ko, romanization: romanizeWord(ko) ?? '' });
    at = start + match[0].length;
  }
  if (at < note.length) parts.push({ text: note.slice(at) });
  return parts;
}
