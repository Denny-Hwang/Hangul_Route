import { expect } from 'vitest';

/**
 * Shared by the console en-XA render tests (F-I18N-001 §3.11): every text node and every
 * labelled attribute of a server-rendered tree must be bracketed pseudo text once the given
 * data (names, content titles, dates) is removed.
 */
const decode = (s: string): string =>
  s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Text nodes and labelled attribute values that contain a letter, data removed and edge punctuation (· ←) trimmed. */
export function wordsOf(html: string, data: readonly string[]): string[] {
  const texts = html
    .replace(/<!-- -->/g, '')
    .split(/<[^>]+>/)
    .map(decode);
  const attrs = [...html.matchAll(/ (?:aria-label|placeholder|title|alt)="([^"]*)"/g)].map((match) => decode(match[1] ?? ''));
  return [...texts, ...attrs]
    .map((t) => data.reduce((acc, d) => acc.split(d).join(''), t).replace(/^[^[A-Za-z]+|[^\]A-Za-z]+$/g, ''))
    .filter((t) => /[A-Za-z]/.test(t));
}

/**
 * One bracketed message, or several joined by punctuation only (a part may render two messages
 * in one text node, "[2 / 3] · [today]"); a letter outside the brackets fails.
 */
const PSEUDO_TEXT = /^\[[^\]]*\](?:[^[\]A-Za-z]+\[[^\]]*\])*$/;

export function expectAllPseudo(html: string, data: readonly string[] = [], minWords = 4): void {
  const words = wordsOf(html, data);
  expect(words.length).toBeGreaterThanOrEqual(minWords);
  for (const w of words) expect(w, `"${w}" is not from the dictionary`).toMatch(PSEUDO_TEXT);
}
