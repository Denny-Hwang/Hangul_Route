import { romanizeWord, type KoText } from '@hangul-route/content-schema';
import { isLoneJamo } from '../audio/speech-guard';

/**
 * The romanization a Hear button names (AMENDMENTS-AUDIO-CLIPS M8). Pure. A story keyword or check
 * target that is one letter shows its sound value (ㅁ, "m": what the story teaches) but the voice
 * says its name (`spokenKo`, mieum), so the button that plays it names what it says: "Hear mieum".
 * Any other text keeps its own romanization: a word's `spokenKo` is a reading aid, not another word.
 */
export function spokenRomanization(text: Pick<KoText, 'ko' | 'romanization' | 'spokenKo'>): string {
  if (text.spokenKo === undefined || !isLoneJamo(text.ko)) return text.romanization;
  return romanizeWord(text.spokenKo) ?? text.romanization;
}
