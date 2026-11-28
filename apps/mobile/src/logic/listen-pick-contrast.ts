import { a11yRomanization, type ListenPickRound } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { contrastMemberSpec, contrastNote, contrastRoundPlayable, withTarget, type ContrastEnv } from './audio/contrast-sets';
import type { PlaySpec } from './audio/controller';
import { LISTEN_PICK_TIMING, type ListenPickFlowState, type MinigameCopy } from './listen-pick-flow';
import { isContrastRound, seededRandom } from './listen-pick';

/**
 * A contrast round's lines (AMENDMENTS-MINIMAL-PAIRS section 3.7, row MP-2a): the kind line under a member and the compare
 * row of a miss. Its own module, reached only from the contrast chunk (`screens/minigames/contrast-chunk.tsx`), so the
 * start bundle carries none of it.
 */

type ListenPickOption = ListenPickRound['options'][number];

export type ContrastCopy = MinigameCopy['contrast'];

/**
 * The meaning shown under a member once the round is answered, in the UI language. A scope that writes the round out in
 * full holds its own (localized) meaning for each option, and it is kept. The catalogue's meaning of a syllable is the
 * English "the syllable ga" (the Stage 1 sets are built from `lp.pair`, with no JSON to overlay), so a meaning that is
 * still exactly that is drawn from the dictionary (`syllable`); a word's meaning not localized by its scope stays as held.
 */
export function memberGloss(copy: ContrastCopy, text: { romanization: string; en: string }): string {
  return text.en === `the syllable ${text.romanization}` ? copy.syllable(text.romanization) : text.en;
}

/** What a contrast member is, for the line under it: its series (plain, aspirated, tense) and its consonant series (`s` is the hiss). */
export interface ContrastMemberKind {
  kind: 'plain' | 'aspirated' | 'tense';
  /** The set's consonant series (`k t p c s`): the hiss pair has lines of its own. */
  series: string;
}

/**
 * The line under a member once the round is answered, and in its compare row. Both cues are named (the air and where the
 * voice starts); the hiss pair (s, ss) has its own two lines, since s starts high and so is no "starts lower" sound.
 */
export function contrastKindLine(copy: ContrastCopy, member: ContrastMemberKind): string {
  if (member.series === 's') {
    if (member.kind === 'tense') return copy.kind.tenseS;
    if (member.kind === 'plain') return copy.kind.plainS;
  }
  return copy.kind[member.kind];
}

/** One item of the compare row: the Hangul and its romanization, its kind line, and its accessible name. */
export interface CompareItem {
  id: string;
  ko: string;
  romanization: string;
  kindLine: string;
  /** `a11y.contrastItem`: the member by its romanization and its kind line, never its Hangul (F-A11Y-001 AF-4b). */
  label: string;
}

/**
 * What a contrast round's miss shows (section 3.7): the right member first, then the one the learner tapped, each with its
 * kind line. `note` says what an option is (its kind and series); an option it cannot place is left out. `[]` when the
 * round has no miss to show.
 */
export function compareItems(
  round: ListenPickRound,
  state: ListenPickFlowState,
  copy: ContrastCopy,
  a11y: Messages['a11y'],
  note: (option: ListenPickOption) => ContrastMemberKind | undefined,
): CompareItem[] {
  if (state.compare === undefined) return [];
  const items: CompareItem[] = [];
  for (const id of [state.compare.rightId, state.compare.tappedId]) {
    const option = round.options.find((o) => o.id === id);
    const member = option === undefined ? undefined : note(option);
    if (option?.text === undefined || member === undefined) continue;
    const kindLine = contrastKindLine(copy, member);
    const sound = a11yRomanization(option.text.romanization, a11y.romanizationOr);
    items.push({ id, ko: option.text.ko, romanization: option.text.romanization, kindLine, label: a11y.contrastItem(sound, kindLine) });
  }
  return items;
}

/** The compare row of a round's miss, each member placed in its set (`contrastNote`). `[]` when the round has no miss to show. */
export function compareRow(round: ListenPickRound, state: ListenPickFlowState, copy: ContrastCopy, a11y: Messages['a11y']): CompareItem[] {
  return compareItems(round, state, copy, a11y, (o) => (o.text === undefined ? undefined : contrastNote(round, o.text.ko)));
}

/**
 * What the announcer says after a contrast round's miss (section 3.7): Hoya's line, then the compare row's items by their
 * labels, said once, in order.
 */
export function missLine(round: ListenPickRound, state: ListenPickFlowState, copy: ContrastCopy, a11y: Messages['a11y']): string {
  return [copy.missHoya, ...compareRow(round, state, copy, a11y).map((l) => l.label)].join(' ');
}

/** What an answered contrast round shows and says of one option: the kind line, its sound, its name by both and its meaning. */
export interface OptionNaming {
  kindLine: string;
  /** The option's romanization as a screen reader says it (`a11yRomanization`). */
  sound: string;
  /** `a11y.contrastItem`: the member by its sound and its kind line. */
  named: string;
  /** The meaning under the card, in the UI language. */
  gloss: string;
}

/** The naming of one option of a contrast round once it is answered (section 3.7); `undefined` for an option its set cannot place. */
export function optionNaming(round: ListenPickRound, option: ListenPickOption, copy: ContrastCopy, a11y: Messages['a11y']): OptionNaming | undefined {
  const note = option.text === undefined ? undefined : contrastNote(round, option.text.ko);
  if (option.text === undefined || note === undefined) return undefined;
  const kindLine = contrastKindLine(copy, note);
  const sound = a11yRomanization(option.text.romanization, a11y.romanizationOr);
  return { kindLine, sound, named: a11y.contrastItem(sound, kindLine), gloss: memberGloss(copy, option.text) };
}

/**
 * A scope that holds contrast rounds among others (not a contrast step: a content test keeps the two kinds apart, so this is
 * defence): each contrast round that plays now is expanded into its set's own round with a drawn target, so a stub never
 * shows its placeholder options; the rest stay. A contrast round that cannot play is left out (section 3.6).
 */
export function mixedRounds(rounds: readonly ListenPickRound[], env: ContrastEnv, seed: number): ListenPickRound[] {
  const random = seededRandom(seed);
  return rounds.flatMap((r) => {
    if (!isContrastRound(r)) return [r];
    return contrastRoundPlayable(r, env) ? [withTarget(r, undefined, random)] : [];
  });
}

/** The rounds after `roundIdx` that cannot play now (a clip gone, a pack off, sound off): dropped as the next round opens (section 3.6). */
export function laterUnplayable(rounds: readonly ListenPickRound[], roundIdx: number, env: ContrastEnv): string[] {
  return rounds.slice(roundIdx + 1).filter((r) => !contrastRoundPlayable(r, env)).map((r) => r.id);
}

/** The contrast rounds after `roundIdx`: dropped once the learner opens Can't hear it? (section 3.9). */
export function laterContrast(rounds: readonly ListenPickRound[], roundIdx: number): string[] {
  return rounds.slice(roundIdx + 1).filter(isContrastRound).map((r) => r.id);
}

/** What the compare player reaches in the board: its own run counter and mount flag, the outline's setter, the sound pacing and the player. */
export interface CompareRun {
  round: ListenPickRound | undefined;
  rightId: string;
  tappedId: string;
  /** A newer run (a new round, a replay, a Hear it tap, a leave) bumps it; the chain still waiting then stops. */
  compareRun: { current: number };
  mounted: { current: boolean };
  setSounding: (id: string | null) => void;
  /** `pacing.track`: the next round waits for both clips (QS-4). */
  track: <T>(sound: T) => T;
  play: (spec: PlaySpec) => Promise<unknown>;
}

/** The compare row's two clips: the right one, then the tapped one 400 ms after it, each outlined while it sounds (section 3.7). */
export function playCompare({ round, rightId, tappedId, compareRun, mounted, setSounding, track, play }: CompareRun): void {
  if (round?.contrastSet === undefined) return;
  const setId = round.contrastSet;
  const specs = [rightId, tappedId].flatMap((id) => {
    const text = round.options.find((o) => o.id === id)?.text;
    const spec = text === undefined ? undefined : contrastMemberSpec(setId, text.ko);
    return spec === undefined ? [] : [{ id, spec }];
  });
  const mine = (compareRun.current += 1);
  void track(
    (async (): Promise<void> => {
      for (const [i, { id, spec }] of specs.entries()) {
        if (mine !== compareRun.current || !mounted.current) return;
        setSounding(id);
        await play(spec);
        if (i < specs.length - 1) await new Promise<void>((resolve) => setTimeout(resolve, LISTEN_PICK_TIMING.compareGapMs));
      }
      if (mine === compareRun.current && mounted.current) setSounding(null);
    })(),
  );
}
