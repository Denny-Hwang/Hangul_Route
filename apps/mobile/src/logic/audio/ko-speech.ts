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

const SENTENCE_END = /[.?!]$/u;
/** Two short words read as one unit (a price such as "2,000 won"); three or more words are a phrase. */
const PHRASE_WORDS = 3;

/**
 * The speech rate of a prompt whose content says nothing about what it is (a Listen & Pick word,
 * picture or sentence round; `rate.ts`): a sentence (closing punctuation) or a phrase of three or
 * more words is a `sentence`, anything else a `word`, a one-syllable word (jip, dal) too.
 * Only a round the content marks as a letter or syllable is a `sound` (`listenPickSpeech`);
 * Discover passes the kind its item type gives.
 */
export function promptKindOf(text: string): Exclude<PromptKind, 'sound'> {
  const t = text.trim();
  if (SENTENCE_END.test(t) || t.split(/\s+/u).length >= PHRASE_WORDS) return 'sentence';
  return 'word';
}
