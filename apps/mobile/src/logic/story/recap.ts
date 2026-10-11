import type { KoText, Story, StoryKeyword, StoryLevel } from '@hangul-route/content-schema';

/** A recap word: taught Korean plus the keyword id (for dedupe and telemetry). */
export type RecapWord = KoText & { id: string };

export const RECAP_MAX_LISTEN = 4;
export const RECAP_MAX_READ = 8;

function toWord(k: StoryKeyword): RecapWord {
  const word: RecapWord = { id: k.id, ko: k.ko, romanization: k.romanization, en: k.en };
  if (k.spokenKo !== undefined) word.spokenKo = k.spokenKo;
  if (k.audioRef !== undefined) word.audioRef = k.audioRef;
  if (k.syllables !== undefined) word.syllables = k.syllables;
  return word;
}

/**
 * The words of the end-of-check recap (F-STORY-003 §3.6). Listen: the tier's
 * `newKeywordIds`, at most 4. Other levels: the unique keywords used by the
 * tier's scenes in authored order, at most 8. Duplicates are removed by id.
 */
export function recapWords(story: Story, level: StoryLevel): RecapWord[] {
  const tier = story.tiers.find((t) => t.level === level);
  if (!tier) return [];
  const keywords =
    level === 'listen'
      ? tier.newKeywordIds.flatMap((id) => story.keywords.find((k) => k.id === id) ?? [])
      : tier.scenes.flatMap((s) => s.keyword ?? []);
  const seen = new Set<string>();
  const unique = keywords.filter((k) => {
    if (seen.has(k.id)) return false;
    seen.add(k.id);
    return true;
  });
  return unique.slice(0, level === 'listen' ? RECAP_MAX_LISTEN : RECAP_MAX_READ).map(toWord);
}
