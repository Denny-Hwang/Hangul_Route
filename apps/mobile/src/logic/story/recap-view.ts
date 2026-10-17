import { romanizationShown, type Messages, type RomanizationMode } from '@hangul-route/i18n';
import type { PlaySpec } from '../audio/controller';
import { STORY_CHECK_AUDIO_SOURCE } from './check-game';
import type { RecapWord } from './recap';

/**
 * View-models of the word recap at the end of the story check step
 * (F-STORY-003 §3.6, wireframe design/wireframes/story/word-recap.md E).
 * `StoryWordRecap` only paints what these return. Words come in as the
 * `learner.story.recap` subtree; the chip's screen-reader name is the shared
 * `a11y.koreanItem`.
 */
export type RecapCopy = Messages['learner']['story']['recap'];
export type KoreanItemLabel = Messages['a11y']['koreanItem'];

export interface RecapChipContext {
  romanizationMode: RomanizationMode;
  /** Word ids whose romanization the learner revealed in this visit (D2 `tap`). */
  revealed: ReadonlySet<string>;
}

export interface RecapChipView {
  id: string;
  ko: string;
  /** '' draws no romanization line (hidden until tap, D2). */
  romanization: string;
  gloss: string;
  /** "Show how to say it" is offered on this chip. */
  revealNeeded: boolean;
  /** The reveal button's name: its visible words plus the chip's Korean, so each one says which word it shows. */
  revealLabel: string;
  /** The speaker's name. */
  hearLabel: string;
  /** The chip's name. Like the reader's gloss card, it always says the romanization: a screen reader cannot "peek". */
  accessibilityLabel: string;
}

export function recapChipView(
  word: RecapWord,
  ctx: RecapChipContext,
  copy: RecapCopy,
  koreanItem: KoreanItemLabel,
): RecapChipView {
  const shown = romanizationShown(ctx.romanizationMode, ctx.revealed.has(word.id));
  return {
    id: word.id,
    ko: word.ko,
    romanization: shown ? word.romanization : '',
    gloss: word.en,
    revealNeeded: !shown,
    revealLabel: copy.revealWord(word.ko),
    hearLabel: copy.hearWord(word.romanization),
    accessibilityLabel: koreanItem({ ko: word.ko, romanization: word.romanization, gloss: word.en }),
  };
}

/** What a chip's speaker plays: the word's clip when it has one, else Korean speech (its `spokenKo` when authored). */
export function recapSpeech(word: RecapWord): PlaySpec {
  const spec: PlaySpec = { text: word.spokenKo ?? word.ko, language: 'ko-KR', kind: 'word', source: STORY_CHECK_AUDIO_SOURCE };
  if (word.audioRef) spec.audioRef = word.audioRef;
  return spec;
}

/** Widest Korean word (glyphs without spaces) that a half-width chip holds on one line, below / at tablet width. */
const FITS_PHONE = 3;
const FITS_TABLET = 5;

/**
 * Chip columns by window width: one at 320 dp, two from 360 dp (the reading
 * column keeps it at two). `longestKorean` (`longestRecapGlyphs`) keeps one
 * column when a half-width chip would break a Korean word across lines (the
 * same measure as Story Order's cards). `fontScale` is the effective text size
 * (`useEffectiveFontScale()`: OS text size x the Display step): larger text counts as a narrower window,
 * so a word that fits at 100 % does not break at 130 % or 200 % (wireframe
 * word-recap: "200 % text, 320 wide: one column"); smaller text never widens it.
 */
export function recapColumns(width: number, longestKorean = 0, fontScale = 1): 1 | 2 {
  const room = width / Math.max(1, fontScale);
  if (room < 360) return 1;
  return longestKorean > (room >= 768 ? FITS_TABLET : FITS_PHONE) ? 1 : 2;
}

/**
 * Glyphs of the longest Korean word of the recap: a phrase counts its longest
 * space-separated word, since it may wrap at a space but never inside a word.
 */
export function longestRecapGlyphs(words: readonly RecapWord[]): number {
  return Math.max(0, ...words.flatMap((w) => w.ko.split(/\s+/).map((part) => [...part].length)));
}

/** The flex cell of one chip: a full row, or a half row that never stretches (an odd last chip keeps its width). */
export const RECAP_WORD_CELL = {
  1: { flexGrow: 1, flexBasis: '100%' },
  2: { flexGrow: 1, flexBasis: '45%', maxWidth: '50%' },
} as const;

/**
 * `story.recap.word_played` fires once per distinct word per visit: the first
 * tap on a word tracks, later taps on it only play. `audible` is false while
 * the "Say it yourself" chip shows (no Korean voice): that tap makes no sound,
 * so it records nothing and the word can still track once a voice plays it.
 * Never mutates `played`.
 */
export function notePlayed(
  played: ReadonlySet<string>,
  wordId: string,
  audible = true,
): { played: ReadonlySet<string>; track: boolean } {
  if (!audible || played.has(wordId)) return { played, track: false };
  return { played: new Set([...played, wordId]), track: true };
}

/** `story.recap.word_played` payload: ids only (spec §3.9). */
export function recapPlayedPayload(storyId: string, wordId: string): { storyId: string; wordId: string } {
  return { storyId, wordId };
}
