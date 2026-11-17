import type { HeritageCard, RuntimeVocabItem } from '@hangul-route/content-schema';
import type { PlaySpec } from '../audio/controller';
import { koSpeech } from '../audio/ko-speech';

/** The surface id of the card page for the audio telemetry (F-AUDIO-004 §3.14). */
export const CARD_DETAIL_AUDIO_SOURCE = 'card-detail';

type CardWord = Pick<RuntimeVocabItem, 'ko' | 'visual'> & Partial<Pick<RuntimeVocabItem, 'spokenKo' | 'audioRef'>>;

/**
 * What the card page's Hear it says (F-AUDIO-004 §3.5): the card's Korean name. When a vocabulary word
 * reuses the card's art and has the same Korean (a word whose visual is the card), the card says that word, with its
 * spoken form and its clip path, so the word's recording plays here too once it is bundled. Since
 * AMENDMENTS-PICTURES-2026-11 row PX-1 no word borrows a card picture (hanbok is `word:culture-hanbok`, not
 * `card:hanbok`), so the card also takes the one word with its Korean name; two words of that name (a homonym) leave
 * the choice to nobody, and the device voice says the name. A card has no `audioRef` of its own. `null` for a card
 * with no Korean name.
 */
export function cardSpeech(card: Pick<HeritageCard, 'id' | 'subtitleKo'>, words: readonly CardWord[]): PlaySpec | null {
  const ko = card.subtitleKo;
  if (ko === undefined || ko === '') return null;
  const named = words.filter((w) => w.ko === ko);
  const word = named.find((w) => w.visual === card.id) ?? (named.length === 1 ? named[0] : undefined);
  return koSpeech(word ?? { ko }, 'word', CARD_DETAIL_AUDIO_SOURCE);
}
