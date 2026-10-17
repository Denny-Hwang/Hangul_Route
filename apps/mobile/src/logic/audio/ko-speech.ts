import type { PlaySpec } from './controller';
import type { PromptKind } from './rate';

/**
 * The play spec of a piece of taught Korean (F-AUDIO-004 §3.5): what the voice says
 * (`spokenKo ?? ko`) and the recording that wins over the voice once it is bundled
 * (`audioRef`), whenever the content carries them. Pure; every screen that says a word, a
 * card pair, a dialogue line or a quiz prompt builds its `playPrompt` call here, so a
 * recording or spoken form added to the content later reaches it with no screen change.
 */
export interface SpeakableKo {
  ko: string;
  spokenKo?: string | undefined;
  audioRef?: string | undefined;
}

export function koSpeech(item: SpeakableKo, kind: PromptKind, source: string): PlaySpec {
  const spec: PlaySpec = { text: item.spokenKo ?? item.ko, kind, source };
  if (item.audioRef !== undefined) spec.audioRef = item.audioRef;
  return spec;
}

const ONE_LETTER_OR_SYLLABLE = /^[ㄱ-ㆎ가-힣]$/u;
const SENTENCE_END = /[.?!]$/u;
/** Two short words read as one unit ("이천 원", 2,000 won); three or more words are a phrase. */
const PHRASE_WORDS = 3;

/**
 * The speech rate a prompt needs (`rate.ts`): a letter or one syllable is a `sound`, a sentence
 * (closing punctuation) or a phrase of three or more words a `sentence`, anything else a `word`.
 * For prompts whose content says nothing about what they are (a Listen & Pick round); Discover
 * passes the kind its item type gives.
 */
export function promptKindOf(text: string): PromptKind {
  const t = text.trim();
  if (ONE_LETTER_OR_SYLLABLE.test(t)) return 'sound';
  if (SENTENCE_END.test(t) || t.split(/\s+/u).length >= PHRASE_WORDS) return 'sentence';
  return 'word';
}
