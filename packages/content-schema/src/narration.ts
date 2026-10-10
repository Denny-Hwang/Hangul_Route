/**
 * Inline term tokens in learner-facing English (F-STORY-001 §3.4).
 * A token `{kw:<keywordId>}` stands for a Hangul span of the research text;
 * the reader renders it as a `KoreanText` chip. Pure helpers shared by the
 * schema, the lint, the reader and the overlay check.
 */
const TOKEN_SOURCE = String.raw`\{kw:([a-z0-9-]+)\}`;

export type NarrationPart<K> = { text: string } | { kw: K };

/**
 * Splits narration into text and keyword parts. Throws on a token that names
 * no keyword (`narration-token-unknown`) and on any brace outside a token
 * (`narration-brace`); callers that must never fail (the reader) catch it.
 */
export function parseNarration<K extends { id: string }>(
  text: string,
  keywords: readonly K[],
): Array<NarrationPart<K>> {
  const parts: Array<NarrationPart<K>> = [];
  const token = new RegExp(TOKEN_SOURCE, 'g');
  let last = 0;
  const pushText = (chunk: string): void => {
    if (/[{}]/.test(chunk)) throw new Error(`narration-brace: unexpected brace in "${text}"`);
    if (chunk !== '') parts.push({ text: chunk });
  };
  for (const match of text.matchAll(token)) {
    const id = match[1] as string;
    const keyword = keywords.find((k) => k.id === id);
    if (!keyword) throw new Error(`narration-token-unknown: ${id}`);
    pushText(text.slice(last, match.index));
    parts.push({ kw: keyword });
    last = (match.index as number) + match[0].length;
  }
  pushText(text.slice(last));
  return parts;
}

/** Keyword ids named by the tokens of `text`, in order (repeats included). */
export function narrationTokenIds(text: string): string[] {
  return Array.from(text.matchAll(new RegExp(TOKEN_SOURCE, 'g')), (m) => m[1] as string);
}

/** Words for the 45-word cap: whitespace-separated, and a token counts as one word. */
export function narrationWordCount(text: string): number {
  let count = 0;
  for (const chunk of text.split(/\s+/)) {
    if (chunk === '') continue;
    count += Math.max(1, narrationTokenIds(chunk).length);
  }
  return count;
}
