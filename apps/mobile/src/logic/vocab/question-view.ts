import type { Messages } from '@hangul-route/i18n';
import type { VocabOption, VocabQuestion } from './question-builder';
import { optionState, showsAnswer, type QuestionFlowMode, type QuestionFlowState } from './question-flow';

/**
 * The view-models of the shared `VocabQuestionView` (F-VOC-004 §3.6, §3.8,
 * §3.9; design/screens/vocab/question-view.md). Pure: the component renders
 * what these return, so every rule that decides what a learner sees or hears
 * (what the prompt shows while asking, when the meaning appears, how an
 * option is named, how many columns the options take) is tested here. The
 * flow itself (taps, locks, reveal beats) is `question-flow.ts`.
 */

/** What the view needs to know besides the question and its flow state. */
export interface QuestionViewContext {
  mode: QuestionFlowMode;
  /** The learner's romanization setting (D2: shown by default). */
  romanizationShown: boolean;
  /** A Korean voice can play (decided once by the host, S7). */
  canPlay: boolean;
  /** A word's meaning in the UI language (content), `undefined` when the catalogue does not know it. */
  glossOf(itemId: string): string | undefined;
  /** A topic's title (content), `undefined` for an unknown key. */
  topicTitle(topicKey: string): string | undefined;
}

export type MinigameA11y = Messages['a11y']['minigame'];
export type QuestionSay = Messages['a11y']['vocab']['question'];

/** A Korean word in the prompt zone; `gloss` only once the question is over. */
export interface PromptWord {
  ko: string;
  romanization: string;
  romanizationShown: boolean;
  gloss: string | undefined;
}

export interface PromptView {
  kind: VocabQuestion['prompt']['kind'];
  /** The Korean word: the prompt of a word question, the fallback text of a sound question, the answer once over. */
  word: PromptWord | null;
  /** Picture to word: the picture, named by its meaning. */
  picture: { ref: string; gloss: string } | null;
  /** `small` beside a word, `large` for a sound question, none when no voice can play. */
  speaker: 'small' | 'large' | null;
  /** "No sound? Read it here." goes with the word (a sound question whose voice failed). */
  readHere: boolean;
  /** The answer's topic title (a homonym prompt in a mixed pool). */
  topicChip: string | null;
}

/** `ChoiceCard` states: the flow's `nudge` is the card's amber `wrong`. */
export type OptionCardState = 'idle' | 'correct' | 'wrong' | 'hint' | 'disabled';

export interface OptionView {
  id: string;
  cardState: OptionCardState;
  /** A word option's Korean; `undefined` draws a picture tile. */
  ko: string | undefined;
  /** Empty draws no line (ChoiceCard). */
  romanization: string;
  pictureRef: string | undefined;
  /** The meaning: a picture's text fallback (PictureArt) and its accessible name. */
  gloss: string;
  accessibilityLabel: string;
}

/** Four word options sit two to a row from this column width (dp), one column under it (§3.6). */
export const NARROW_WORD_COLUMN = 340;

/** The surface id `playPrompt` reports for each mode (F-AUDIO-004 telemetry). */
export const QUESTION_AUDIO_SOURCE = { speed: 'vocab-speed', check: 'vocab-card' } as const satisfies Record<QuestionFlowMode, string>;

function answerOption(q: VocabQuestion): VocabOption | undefined {
  return q.options.find((o) => o.id === q.answerId);
}

function optionGloss(option: VocabOption | undefined, ctx: QuestionViewContext): string | undefined {
  if (!option) return undefined;
  return ctx.glossOf(option.id) ?? option.labelEn ?? option.text?.en;
}

/** The answer's meaning: the catalogue's localised gloss, else the English one the question carries. */
function answerGloss(q: VocabQuestion, ctx: QuestionViewContext): string | undefined {
  return ctx.glossOf(q.answerId) ?? optionGloss(answerOption(q), ctx);
}

/** The answer word: the prompt's Korean, or (picture to word) the answer option's. */
function answerWord(q: VocabQuestion): { ko: string; romanization: string } | null {
  if (q.prompt.ko !== undefined) return { ko: q.prompt.ko, romanization: q.prompt.romanization ?? '' };
  const text = answerOption(q)?.text;
  return text ? { ko: text.ko, romanization: text.romanization } : null;
}

/** What the prompt zone shows now. */
export function promptView(q: VocabQuestion, state: QuestionFlowState, ctx: QuestionViewContext): PromptView {
  const over = showsAnswer(state);
  const kind = q.prompt.kind;
  const base = answerWord(q);
  const readHere = kind === 'audio' && state.textPrompt;

  let word: PromptWord | null = null;
  if (base && over) {
    word = { ...base, romanizationShown: true, gloss: answerGloss(q, ctx) };
  } else if (base && kind === 'word') {
    word = { ...base, romanizationShown: ctx.romanizationShown, gloss: undefined };
  } else if (base && readHere) {
    // The fallback text stands in for the sound, so it is read in full: romanization always, no meaning.
    word = { ...base, romanizationShown: true, gloss: undefined };
  }

  const speaker = kind === 'audio' ? 'large' : kind === 'word' && ctx.canPlay ? 'small' : null;
  const picture = kind === 'image' ? { ref: q.prompt.pictureRef ?? '', gloss: answerGloss(q, ctx) ?? '' } : null;
  const topicChip = q.topicChip === undefined ? null : (ctx.topicTitle(q.topicChip) ?? null);
  return { kind, word, picture, speaker, readHere, topicChip };
}

/**
 * How one option looks and is named. A picture never carries a written label
 * (it would give the answer away); its name is its meaning, which F-QUEST-002
 * §3.14 allows for pictures. `ring` is the session's hint ring.
 */
export function optionView(
  q: VocabQuestion,
  option: VocabOption,
  state: QuestionFlowState,
  ctx: QuestionViewContext,
  ring: boolean,
  a11y: MinigameA11y,
): OptionView {
  const flow = optionState(q, option.id, state, ctx.mode, ring);
  const cardState: OptionCardState = flow === 'nudge' ? 'wrong' : flow;
  const touched = cardState === 'wrong' || cardState === 'correct';

  let ko: string | undefined;
  let romanization = '';
  let gloss: string;
  let name: string;
  if (option.pictureRef === undefined && option.text) {
    ko = option.text.ko;
    romanization = ctx.romanizationShown || touched ? option.text.romanization : '';
    gloss = ctx.glossOf(option.id) ?? option.text.en;
    name = romanization === '' ? ko : `${ko}, ${romanization}`;
  } else {
    gloss = optionGloss(option, ctx) ?? a11y.picture;
    name = gloss;
  }

  const accessibilityLabel = cardState === 'correct' || cardState === 'wrong' || cardState === 'hint' ? a11y.option[cardState](name) : name;
  return { id: option.id, cardState, ko, romanization, pictureRef: option.pictureRef, gloss, accessibilityLabel };
}

/**
 * Columns for the options in a column `width` dp wide (§3.6): four pictures
 * 2 x 2 when two cards fit, three pictures three across when three fit, else
 * one column; word options 2 x 2 from `NARROW_WORD_COLUMN`. Cards never shrink
 * below their minimum: the host's screen scrolls instead.
 */
export function optionColumns(q: VocabQuestion, width: number, sizes: { minPictureCard: number; gap: number }): 1 | 2 | 3 {
  if (!Number.isFinite(width) || width <= 0) return 1;
  const pictures = q.options.some((o) => o.pictureRef !== undefined);
  if (!pictures) return width >= NARROW_WORD_COLUMN ? 2 : 1;
  const across = q.options.length === 3 ? 3 : 2;
  return across * sizes.minPictureCard + (across - 1) * sizes.gap <= width ? across : 1;
}

/** The outcome in words for the polite live line (§3.8); `null` while nothing has happened. */
export function announcement(q: VocabQuestion, state: QuestionFlowState, ctx: QuestionViewContext, say: QuestionSay): string | null {
  // Every catalogue word has an English gloss; a question built without one names the Korean word instead.
  const gloss = answerGloss(q, ctx) ?? answerWord(q)?.ko ?? '';
  if (showsAnswer(state)) {
    return ctx.mode === 'speed' && state.chosenId !== q.answerId ? say.reveal(gloss) : say.right(gloss);
  }
  return state.wrongIds.length > 0 ? say.tryAnother : null;
}

/** What `playPrompt` says for the answer word. */
export interface QuestionSpeech {
  text: string;
  audioRef?: string;
}

/** The answer's catalogue entry, the parts the voice needs. */
export interface SpokenItem {
  ko: string;
  spokenKo?: string;
  audioRef?: string;
}

function speech(text: string, audioRef: string | undefined): QuestionSpeech {
  return audioRef === undefined ? { text } : { text, audioRef };
}

/** The answer word to speak: the catalogue item first, then the prompt, then the answer option. */
export function speechFor(q: VocabQuestion, item: SpokenItem | undefined): QuestionSpeech | null {
  if (item) return speech(item.spokenKo ?? item.ko, item.audioRef);
  if (q.prompt.ko !== undefined) return speech(q.prompt.spokenKo ?? q.prompt.ko, q.prompt.audioRef);
  const text = answerOption(q)?.text;
  return text ? { text: text.ko } : null;
}
