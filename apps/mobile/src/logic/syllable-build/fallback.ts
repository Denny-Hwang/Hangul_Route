import type { BlockParts, ListenPickRound, SyllableBuildRound } from '@hangul-route/content-schema';
import type { MinigameScope } from '../minigame-config';
import { blockOf, DRILL_BLOCKS, isRealBlock, partsOf, romanizationOf, soundKeyOf } from './pool';
import { shuffled } from './tiles';

/**
 * The fallback round when `game.syllable-build` is off (F-CURR-002 sections 7.1 F3 and 12.2, row CM-32): **Listen & Pick
 * on the built block**. The same speaker prompt and 3-4 block options: the target and blocks that differ from it in
 * one zone, built from the round's own tiles (밥 with 반, 방, 법), each a real block (the Stage 1 table or the
 * allowlist, never a pseudo-word) and never two that sound the same (the final-distinct rule, by sound key). When the
 * tiles give fewer than three, real blocks with the target's vowel, then with its first letter, fill the rest. The pick is recorded at the recognize
 * rung (a pick, not a build).
 */

const MAX_OPTIONS = 4;

/** The blocks one zone away from the target that its tiles can make, a zone at a time. */
function oneZoneAway(target: BlockParts, round: Pick<SyllableBuildRound, 'firstTiles' | 'vowelTiles' | 'finalTiles'>): string[][] {
  const by = (make: (letter: string) => BlockParts, letters: readonly string[], own: string): string[] =>
    letters.filter((l) => l !== own).flatMap((l) => {
      const b = blockOf(make(l));
      return b === null ? [] : [b];
    });
  return [
    by((first) => ({ ...target, first }), round.firstTiles, target.first),
    by((vowel) => ({ ...target, vowel }), round.vowelTiles, target.vowel),
    by((final) => ({ ...target, final: final === '' ? null : final }), [...round.finalTiles, ''], target.final ?? ''),
  ];
}

/** The option blocks for a target, the target first: real, one zone away, each with a sound of its own. */
export function blockOptions(
  targetKo: string,
  round: Pick<SyllableBuildRound, 'firstTiles' | 'vowelTiles' | 'finalTiles'>,
  seed: number,
  allowed: (ko: string) => boolean = isRealBlock,
): string[] {
  const target = partsOf(targetKo);
  if (target === null) return [targetKo];
  const sounds = new Set([soundKeyOf(targetKo)]);
  const out = [targetKo];
  const take = (ko: string): void => {
    if (out.length >= MAX_OPTIONS || !allowed(ko) || sounds.has(soundKeyOf(ko))) return;
    sounds.add(soundKeyOf(ko));
    out.push(ko);
  };
  const zones = oneZoneAway(target, round).map((list, i) => shuffled(list, seed + i));
  // One per zone first, so each option differs from the target in its own place; then the rest.
  for (const list of zones) {
    const first = list.find((ko) => allowed(ko) && !sounds.has(soundKeyOf(ko)));
    if (first !== undefined) take(first);
  }
  for (const list of zones) for (const ko of list) take(ko);
  // Too few from the tiles (a rare vowel such as ㅐ): real blocks with the target's vowel, then with its first letter.
  const rest = shuffled(DRILL_BLOCKS, seed + 5);
  for (const ko of rest) if (partsOf(ko)?.vowel === target.vowel) take(ko);
  for (const ko of rest) if (partsOf(ko)?.first === target.first) take(ko);
  return out;
}

/** A block option or prompt as Listen & Pick draws it: Korean, romanization and the word's meaning (none for a bare block). */
const koText = (ko: string, en?: string): { ko: string; romanization: string; en: string } => ({ ko, romanization: romanizationOf(ko), en: en ?? '' });

export function syllableBuildToListenPick(round: SyllableBuildRound, seed = 0): ListenPickRound {
  const options = blockOptions(round.target.ko, round, seed).map((ko) => ({
    id: ko,
    text: ko === round.target.ko ? { ...koText(ko, round.target.en), romanization: round.target.romanization } : koText(ko),
  }));
  const { spokenKo, audioRef } = round.target;
  return {
    // A bare block records against its `syl` item (`lp:syl:`); a word block (with its meaning) against its cell's item,
    // as the game itself records it (`askedOfScope`), so the switch never changes which item a round records.
    id: round.target.en === undefined ? `lp:syl:${round.id}` : `lp:sbw:${round.id}`,
    prompt: {
      ko: round.target.ko,
      romanization: round.target.romanization,
      en: round.target.en ?? '',
      ...(spokenKo !== undefined ? { spokenKo } : {}),
      ...(audioRef !== undefined ? { audioRef } : {}),
    },
    options,
    answerId: round.target.ko,
  };
}

/** A Syllable Build scope as the Listen & Pick scope it falls back to. */
export function fallbackScope(scope: MinigameScope): MinigameScope {
  const rounds = scope.syllableBuild?.rounds ?? [];
  return { kind: 'listen-pick', listenPick: { rounds: rounds.map((r, i) => syllableBuildToListenPick(r, i)) } };
}
