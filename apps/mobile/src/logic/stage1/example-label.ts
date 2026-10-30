import type { Messages } from '@hangul-route/i18n';

/**
 * The accessible name of a Discover page's example-word button (AMENDMENTS-AUDIO-CLIPS JV-A5, M5).
 * Pure. It leads with "Example word", so a screen-reader user never takes the word (na on the ㅏ
 * page) for the letter's own sound; then "Hear it" with the word, its romanization once shown, and
 * its gloss.
 */
export function exampleWordLabel(
  copy: Pick<Messages['learner']['quest']['discover'], 'exampleWord'>,
  a11y: Pick<Messages['a11y'], 'hearExample'>,
  example: { ko: string; romanization: string; gloss: string },
  romanizationShown: boolean,
): string {
  const spoken = romanizationShown ? `${example.ko}, ${example.romanization}, ${example.gloss}` : `${example.ko}, ${example.gloss}`;
  return `${copy.exampleWord}. ${a11y.hearExample(spoken)}`;
}
