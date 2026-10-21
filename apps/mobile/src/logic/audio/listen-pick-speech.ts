import type { ListenPickRound } from '@hangul-route/content-schema';
import type { PlaySpec } from './controller';
import { koSpeech, promptKindOf } from './ko-speech';

/** The surface id of Listen & Pick for the audio telemetry (`audio.fallback_shown`, F-AUDIO-004 §3.14). */
export const LISTEN_PICK_AUDIO_SOURCE = 'listen-pick';

/**
 * What the round says (F-AUDIO-004 §3.5): `spokenKo ?? ko`, the recording when there is one, and
 * the speech rate of what it is. Only a letter or syllable round (`lp:sym:`, `lp:syl:`) is a `sound`;
 * any other round is read by its text (`promptKindOf`): a sentence is a `sentence`, else a `word`
 * (a one-syllable word or picture round, jip or dal, included: the word rate).
 *
 * Its own module, with no store, screen or platform import, so the lecture deck builder (LV-S2, a
 * listen question plays its prompt at the game's rate) and Browse's presenter link reach only pure
 * logic (F-BROWSE-001 section 4.10, `browse-isolation.test.ts`). `listen-pick-flow.ts` re-exports it.
 */
export function listenPickSpeech(round: ListenPickRound): PlaySpec {
  const sound = round.id.startsWith('lp:sym:') || round.id.startsWith('lp:syl:');
  const kind = sound ? 'sound' : promptKindOf(round.prompt.spokenKo ?? round.prompt.ko);
  return koSpeech(round.prompt, kind, LISTEN_PICK_AUDIO_SOURCE);
}
