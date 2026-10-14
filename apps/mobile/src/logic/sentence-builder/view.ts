import { romanizeWord, type KoText, type Quest, type RomanizationMode } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { HostMode } from '../../screens/minigames/host';
import type { SbRound, SbTile } from './progression';
import type { SbState } from './reducer';
import { isRightTile } from './scoring';

/**
 * Sentence Builder view-models (wireframe minigame/sentence-builder.md A-F): what the
 * header, the sentence line, the tray, Hoya's line and the finished sentence show. Pure;
 * the words come from `learner.minigame` and `a11y.minigame`, passed in by the screen.
 */

export type MinigameCopy = Messages['learner']['minigame'];
export type MinigameA11y = Messages['a11y']['minigame'];

/** "Korean, romanization": the accessible name `KoreanText` gives taught Korean. */
export const wordLabel = (ko: string, romanization: string): string => (romanization === '' ? ko : `${ko}, ${romanization}`);

const finished = (state: SbState): boolean => state.status === 'complete' || state.status === 'done';

export interface SbHeaderView {
  kind: 'bar' | 'dots';
  title: string | undefined;
  /** Filled units: only ever fills (anti-shame). */
  value: number;
  max: number;
  label: string | undefined;
}

/** The Check: two fill-only dots and "Quick check", no Skip; any other host: a bar and "n / N". */
export function headerView(mode: HostMode, state: SbState, copy: MinigameCopy): SbHeaderView {
  if (mode === 'check') {
    return {
      kind: 'dots',
      title: copy.listenPick.checkTitle.pill,
      value: Math.min(state.total, state.roundIdx + (finished(state) ? 1 : 0)),
      max: state.total,
      label: undefined,
    };
  }
  const shown = Math.min(state.total, state.roundIdx + 1);
  return { kind: 'bar', title: undefined, value: shown, max: state.total, label: copy.progress.pill(shown, state.total) };
}

/** Skip is offered everywhere but the Check (wireframe "Where it is used"). */
export const showSkip = (mode: HostMode): boolean => mode !== 'check';

/** The line under the heading: order the words, or pick the piece that fits. */
export const instructionOf = (round: SbRound, copy: MinigameCopy): string =>
  round.particle ? copy.sentenceBuilder.particleInstruction : copy.sentenceBuilder.instruction;

/**
 * One place on the sentence line.
 * - `placed`: a tile the learner put there (or the joined particle word): the right look.
 * - `fixed`: a word given by a particle round, read-only.
 * - `slot`: an empty place; `next` is the one to fill now. `attached` sits against the stem before it.
 */
export type LineUnitView =
  | { kind: 'placed' | 'fixed'; key: string; ko: string; romanization: string; accessibilityLabel: string }
  | { kind: 'slot'; key: string; next: boolean; attached: boolean; stem: string | undefined; accessibilityLabel: string };

export interface LineContext {
  romanizationMode: RomanizationMode;
}

const shownRomanization = (romanization: string, mode: RomanizationMode): string => (mode === 'always' ? romanization : '');

/** The sentence line, one unit per word, left to right. */
export function lineView(round: SbRound, state: SbState, ctx: LineContext, a11y: MinigameA11y): LineUnitView[] {
  const total = round.words.length;
  const say = a11y.sentenceBuilder;
  const filled = (word: number): boolean => {
    const at = round.open.indexOf(word);
    return at === -1 || at < state.placed.length;
  };
  return round.words.map((word, i) => {
    const key = `word-${i}`;
    if (filled(i)) {
      const kind = round.open.includes(i) ? 'placed' : 'fixed';
      return {
        kind,
        key,
        ko: word.ko,
        romanization: shownRomanization(word.romanization, ctx.romanizationMode),
        accessibilityLabel: say.slotFilled(i + 1, total, wordLabel(word.ko, word.romanization)),
      };
    }
    const next = !finished(state) && round.open[state.placed.length] === i;
    const attached = round.particle?.word === i;
    return {
      kind: 'slot',
      key,
      next,
      attached,
      stem: attached ? round.particle?.stem : undefined,
      accessibilityLabel: attached ? say.slotAttached(i + 1, total) : say.slotEmpty(i + 1, total),
    };
  });
}

/**
 * The tile an empty slot is as wide as: the round's longest, so no width gives a tile away.
 * The screen draws it invisibly inside every empty slot.
 */
export function widestTile(round: SbRound): SbTile | undefined {
  const size = (t: SbTile): number => [...t.ko].length * 100 + t.romanization.length;
  return round.tray.reduce<SbTile | undefined>((best, t) => (best === undefined || size(t) > size(best) ? t : best), undefined);
}

export type TileLook = 'idle' | 'tried' | 'ring';

export interface TileView {
  id: string;
  ko: string;
  /** Empty: no romanization line (`tap` mode); the accessible name still carries it. */
  romanization: string;
  look: TileLook;
  /** Sliding back to the tray after a miss. */
  returning: boolean;
  accessibilityLabel: string;
}

/** The tiles still in the tray (placed tiles leave it), in tray order. */
export function trayView(round: SbRound, state: SbState, ctx: LineContext, a11y: MinigameA11y): TileView[] {
  if (finished(state)) return [];
  const ringOn = state.slotMisses >= 2;
  const ringId = ringOn ? round.tray.find((t) => !state.placed.includes(t.id) && isRightTile(round, state.placed.length, t))?.id : undefined;
  return round.tray
    .filter((t) => !state.placed.includes(t.id))
    .map((t) => {
      const look: TileLook = t.id === ringId ? 'ring' : state.tried.includes(t.id) ? 'tried' : 'idle';
      const name = wordLabel(t.ko, t.romanization);
      return {
        id: t.id,
        ko: t.ko,
        romanization: shownRomanization(t.romanization, ctx.romanizationMode),
        look,
        returning: state.returning === t.id,
        accessibilityLabel: look === 'tried' ? a11y.sentenceBuilder.tried(name) : name,
      };
    });
}

/** A piece of a note line: plain UI text, or a `{ko:}` token drawn as taught Korean with its romanization. */
export type NotePart = { text: string } | { ko: string; romanization: string };

const KO_TOKEN = /\{ko:([^}]*)\}/g;

/** Splits a note around its `{ko:}` tokens (F-CURR-001 §3.4); never throws, an empty token is dropped. */
export function noteParts(note: string): NotePart[] {
  const parts: NotePart[] = [];
  let at = 0;
  for (const match of note.matchAll(KO_TOKEN)) {
    const start = match.index as number;
    if (start > at) parts.push({ text: note.slice(at, start) });
    const ko = (match[1] as string).trim();
    if (ko !== '') parts.push({ ko, romanization: romanizeWord(ko) ?? '' });
    at = start + match[0].length;
  }
  if (at < note.length) parts.push({ text: note.slice(at) });
  return parts;
}

export interface HintView {
  line: string;
  /** The quest's own Discover note, shown again under a particle miss. */
  note: NotePart[] | undefined;
}

/** Hoya's line after a miss; null while nothing was missed on this slot. */
export function hintView(state: SbState, copy: MinigameCopy, patternNote: string | undefined): HintView | null {
  if (state.status !== 'building' || state.hint === null) return null;
  const sb = copy.sentenceBuilder;
  switch (state.hint) {
    case 'lookHere':
      return { line: sb.lookHere, note: undefined };
    case 'lastWord':
      return { line: sb.missLastWord, note: undefined };
    case 'particle':
      return { line: sb.missParticle, note: patternNote === undefined ? undefined : noteParts(patternNote) };
    case 'miss':
      return { line: sb.miss, note: undefined };
  }
}

/** Round complete: the calm line, then the sentence with its romanization (always shown here) and meaning. */
export function doneView(round: SbRound, state: SbState, copy: MinigameCopy): { line: string; sentence: KoText } | null {
  return finished(state) ? { line: copy.sentenceBuilder.built, sentence: round.sentence } : null;
}

/** The `noteEn` of the first `pattern` item in the quest's own Discover step: the particle hint's note. */
export function patternNoteOf(quest: Pick<Quest, 'steps'> | undefined): string | undefined {
  for (const step of quest?.steps ?? []) {
    if (step.kind !== 'discover') continue;
    for (const page of step.discover?.pages ?? []) {
      for (const item of page.items) if (item.type === 'pattern') return item.noteEn;
    }
  }
  return undefined;
}
