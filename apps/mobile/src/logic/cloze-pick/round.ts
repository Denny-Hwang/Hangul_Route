import { CLOZE_GAP, fillClozeGap, type ClozePickRound, type KoText, type ListenPickRound } from '@hangul-route/content-schema';
import type { MinigameScope } from '../minigame-config';

/**
 * Cloze Pick rounds (F-CURR-002 section 7.1 F1, row CM-30; design/wireframes/minigame/cloze-pick.md): the pure
 * helpers of the game and of its fallback, in the Cloze Pick chunk with them. No other chunk imports this folder (Metro
 * would hoist a module two chunks share into the start bundle): the memory store and the pacing fill the gap with the
 * schema's `fillClozeGap` themselves.
 *
 * - **The fallback** (`game.cloze-pick` off, or the chunk cannot load): the shipped Listen & Pick renderer in its
 *   text prompt mode, on the same tiles, answer and scoring (`clozeToListenPick`). The completed sentence is what
 *   the voice says after the right tile (`spokenKo`), never before it: hearing it would answer the round.
 * - Tiles keep their id per round (`<round id>:t<index>`), so the answer and the scored round are the same in both.
 */

/** A round's tiles' option ids, in tile order. */
export const tileId = (roundId: string, index: number): string => `${roundId}:t${index}`;

/** The playable rounds of a scope: 2 or more tiles and an answer among them (a broken round is skipped). */
export function validClozeRounds(scope: Pick<MinigameScope, 'clozePick'>): ClozePickRound[] {
  return (scope.clozePick?.rounds ?? []).filter((r) => r.tiles.length >= 2 && r.answerIndex >= 0 && r.answerIndex < r.tiles.length && r.sentence.ko.includes(CLOZE_GAP));
}

/**
 * The completed sentence: what the gap shows and the voice says after the right tile. A value gap's meaning keeps its
 * gap until then, and the value's own meaning fills it (It is five thousand won.), never its Korean.
 */
export function filledSentence(round: ClozePickRound): KoText {
  const answer = round.tiles[round.answerIndex] as KoText;
  const { sentence: s } = round;
  return {
    ko: fillClozeGap(s.ko, answer.ko),
    romanization: round.filledRomanization ?? fillClozeGap(s.romanization, answer.romanization),
    en: round.gapKind === 'value' ? fillClozeGap(s.en, answer.en) : s.en,
    ...(s.spokenKo === undefined ? {} : { spokenKo: fillClozeGap(s.spokenKo, answer.spokenKo ?? answer.ko) }),
    ...(s.audioRef === undefined ? {} : { audioRef: s.audioRef }),
  };
}

/**
 * A text with its gap as a word a screen reader says ("chaegeul, blank."), never "underscore": the label of the
 * prompt card and of the fallback's text prompt (`a11y.minigame.clozePick.blank`).
 */
export const spokenGap = (text: string, blank: string): string => text.split(CLOZE_GAP).join(blank).replace(/\s+/g, ' ').trim();

/** The sentence part of the card's label: its gap as a word and no closing mark (the label adds its own full stop). */
export const labelSentence = (text: string, blank: string): string => spokenGap(text, blank).replace(/[.?!]+$/, '');

/**
 * The fallback round: Listen & Pick in its text prompt mode. The prompt is the sentence with its gap (and its
 * meaning, the input the round reads from); the options are the tiles, Korean and romanization only; the voice says
 * the completed sentence once after the right tile (`spokenKo`, or the sentence's own recording).
 */
export function clozeToListenPick(round: ClozePickRound): ListenPickRound {
  const done = filledSentence(round);
  return {
    id: round.id,
    prompt: {
      ko: round.sentence.ko,
      romanization: round.sentence.romanization,
      en: round.sentence.en,
      spokenKo: done.spokenKo ?? done.ko,
      ...(done.audioRef !== undefined ? { audioRef: done.audioRef } : {}),
    },
    options: round.tiles.map((tile, i) => ({ id: tileId(round.id, i), text: { ko: tile.ko, romanization: tile.romanization, en: tile.en } })),
    answerId: tileId(round.id, round.answerIndex),
  };
}

/** The fallback scope a `cloze-pick` scope plays when its switch is off: the same rounds as Listen & Pick. */
export function clozeFallbackScope(scope: MinigameScope): MinigameScope {
  const rounds = validClozeRounds(scope).map(clozeToListenPick);
  return { kind: 'listen-pick', rounds: rounds.length, listenPick: { rounds } };
}
