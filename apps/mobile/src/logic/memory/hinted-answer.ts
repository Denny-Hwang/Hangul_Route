import type { MinigameKind } from '@hangul-route/content-schema';

/**
 * Whether a quest step's first answer reaches the memory store as hinted (F-CURR-002 section 4.3: no promotion, no
 * demotion). Type Hangul's hint (Dictation's Show how it sounds, or a typed answer one letter off, row CM-31) is a
 * hinted right answer whatever it scored; the other games' hints (Story Order's Show meanings, row CM-34; Role Play's,
 * row CM-35) are help shown, so a wrong answer with one is still a plain miss.
 */
export function hintedForMemory(kind: MinigameKind, correct: boolean, hinted: boolean | undefined): boolean {
  return hinted === true && (correct || kind === 'type-hangul');
}
