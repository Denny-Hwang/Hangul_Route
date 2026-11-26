import { a11yRomanization, type ListenPickRound } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { ListenPickFlowState, MinigameCopy } from './listen-pick-flow';

/**
 * A contrast round's lines (AMENDMENTS-MINIMAL-PAIRS section 3.7, row MP-2a): the kind line under a member and the compare
 * row of a miss. Its own module, reached only from the contrast chunk (`screens/minigames/contrast-chunk.tsx`), so the
 * start bundle carries none of it.
 */

type ListenPickOption = ListenPickRound['options'][number];

export type ContrastCopy = MinigameCopy['contrast'];

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
