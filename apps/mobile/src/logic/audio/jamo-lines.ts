import type { Messages } from '@hangul-route/i18n';
import { jamoVoice, type JamoQuestion, type JamoVoice } from './jamo-voice';
import type { SpokenJamo } from './spoken';

/**
 * The lines a lone-letter surface shows next to what it says (AMENDMENTS-AUDIO-CLIPS JV-A1,
 * JV-A4). Pure; the words come from `learner.audio` as a parameter.
 *
 * A surface that shows one lone letter (Match Sound, Trace Stroke, the lecture letter slide and
 * its quiz) asks a **letter question** about an initial or a vowel (ㄴ is said 니은) and a
 * **sound question** about a final, which is never said by name: it is said as its closed
 * syllable (안) and shown with the `finalLine` ("ㄴ at the bottom: 안 · an").
 */

/** The question a lone-letter surface asks about `jamo`: a letter question, or a sound question for a final. */
export function loneLetterQuestion(jamo: Pick<SpokenJamo, 'kind'>): JamoQuestion {
  return jamo.kind === 'batchim' ? 'sound' : 'letter';
}

/** What a lone-letter surface says for `jamo` (`jamoVoice` of `loneLetterQuestion`). */
export function loneLetterVoice(jamo: SpokenJamo): JamoVoice {
  return jamoVoice(jamo, loneLetterQuestion(jamo));
}

/** A spoken form as the screen shows it, with its romanization (D2): "니은 · nieun", "앚 · at". */
export function voiceLine(voice: Pick<JamoVoice, 'shown' | 'romanization'>): string {
  return `${voice.shown} · ${voice.romanization}`;
}

/**
 * The line under a final (JV-A4 `finalLine`): the final and the closed syllable it is heard in,
 * the syllable as spelled ("ㅈ at the bottom: 앚 · at") with its pronounced romanization (M12).
 */
export function finalLine(jamo: SpokenJamo, copy: Pick<Messages['learner']['audio'], 'finalLine'>): string {
  return copy.finalLine(jamo.char, voiceLine(jamoVoice(jamo, 'sound')));
}
