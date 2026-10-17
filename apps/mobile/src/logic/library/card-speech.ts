import type { HeritageCard, RuntimeVocabItem } from '@hangul-route/content-schema';
import type { PlaySpec } from '../audio/controller';
import { koSpeech } from '../audio/ko-speech';

/** The surface id of the card page for the audio telemetry (F-AUDIO-004 §3.14). */
export const CARD_DETAIL_AUDIO_SOURCE = 'card-detail';

type CardWord = Pick<RuntimeVocabItem, 'ko' | 'visual'> & Partial<Pick<RuntimeVocabItem, 'spokenKo' | 'audioRef'>>;

/**
 * What the card page's Hear it says (F-AUDIO-004 §3.5): the card's Korean name. When a vocabulary word
 * reuses the card's art and has the same Korean (한복 on `card:hanbok`), the card says that word, with its
 * spoken form and its clip path, so the word's recording plays here too once it is bundled. A card has
 * no `audioRef` of its own. `null` for a card with no Korean name.
 */
export function cardSpeech(card: Pick<HeritageCard, 'id' | 'subtitleKo'>, words: readonly CardWord[]): PlaySpec | null {
  const ko = card.subtitleKo;
  if (ko === undefined || ko === '') return null;
  const word = words.find((w) => w.visual === card.id && w.ko === ko);
  return koSpeech(word ?? { ko }, 'word', CARD_DETAIL_AUDIO_SOURCE);
}
