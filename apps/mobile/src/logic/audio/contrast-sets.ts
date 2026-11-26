import { ListenPickRoundSchema, type ListenPickRound } from '@hangul-route/content-schema';
import { CONTRAST_SETS, type ContrastKind, type ContrastMemberEntry, type ContrastSetEntry } from '../../content/__generated__/contrast-sets';
import type { HostMode } from '../../screens/minigames/host';
import { isContrastRound, seededRandom } from '../listen-pick';
import type { PlaySpec } from './controller';
import { LISTEN_PICK_AUDIO_SOURCE } from './listen-pick-speech';

/**
 * The runtime of the contrast sets (AMENDMENTS-MINIMAL-PAIRS sections 3.4 to 3.6, 3.10, row MP-2a): which sets a round may
 * play, which clip each member plays, and the draw of the rounds a contrast step opens with. Pure: the clip check, the
 * sound and "Always show the letters" switches and the host are passed in (`ContrastEnv`), so the rules stay testable and
 * `platform/audio` stays out of `logic/`.
 *
 * A set plays only when the owner approved it by listening (`approved`, from the generated module) and every member's
 * clip can play now. Never the device voice, never text: a round that cannot be played from its clips is not shown.
 */

/** What a contrast round needs to know about the device now. */
export interface ContrastEnv {
  /** Whether this clip is bundled and can play now (`platform/audio` `hasClip`: clips on, its pack on, its chunk added). */
  hasClip(ref: string): boolean;
  /** Sound is on (not muted). */
  soundOn: boolean;
  /** "Always show the letters" (CH-2) is on: it would put the prompt on screen, which is the answer. */
  alwaysShowLetters: boolean;
  /** The host that plays the round. */
  host: HostMode;
  /** The catalogue to read; default the generated one (tests pass their own). */
  sets?: readonly ContrastSetEntry[];
}

/** The hosts a contrast round plays in: practice only. A Check, a review and the vocabulary rounds never do (section 3.6 rule 4). */
const PRACTICE_HOSTS: readonly HostMode[] = ['quest', 'preview'];

/** How many rounds a contrast step opens with (section 3.5: Stage 1 draws six of its sets, Stage 2 plays its six). */
export const CONTRAST_STEP_ROUNDS = 6;

/** A contrast step needs at least this many playable sets (section 3.5). */
export const CONTRAST_MIN_SETS = 2;

/** A set by id, or `undefined`. */
export function contrastSetById(id: string, sets: readonly ContrastSetEntry[] = CONTRAST_SETS): ContrastSetEntry | undefined {
  return sets.find((s) => s.id === id);
}

function memberOf(set: ContrastSetEntry, text: string): ContrastMemberEntry | undefined {
  return set.members.find((m) => m.text === text);
}

/**
 * The clip an approved member plays: the catalogue's own `ref` for it, never a lookup by text, so a round plays exactly
 * the clip that was approved (section 3.5). `undefined` for an unknown set or a text that is not a member.
 */
export function contrastClipRef(setId: string, text: string, sets: readonly ContrastSetEntry[] = CONTRAST_SETS): string | undefined {
  const set = contrastSetById(setId, sets);
  return set === undefined ? undefined : memberOf(set, text)?.ref;
}

/**
 * The real round of a set (AMENDMENTS-MINIMAL-PAIRS section 3.5): its options are exactly the set's members (ids are their
 * romanizations, ASCII) and `prompt` / `answerId` hold the set's first member, with its own clip, until the step draws the
 * round's target. `lp.pair` in the start bundle is only a stub that names the set (the catalogue is this chunk's); the draw
 * expands it here. Throws on an unknown set.
 */
export function pairRound(setId: string, sets: readonly ContrastSetEntry[] = CONTRAST_SETS): ListenPickRound {
  const set = contrastSetById(setId, sets);
  if (set === undefined) throw new Error(`Unknown contrast set ${setId}`);
  const [first] = set.members;
  return ListenPickRoundSchema.parse({
    id: `lp:pair:${set.id}`,
    contrastSet: set.id,
    prompt: { ko: first!.text, romanization: first!.romanization, en: first!.en, audioRef: first!.ref },
    options: set.members.map((m) => ({ id: m.romanization, text: { ko: m.text, romanization: m.romanization, en: m.en } })),
    answerId: first!.romanization,
  });
}

/**
 * Whether the two texts are members of one approved set (section 3.10): the gate WO-10's decode options may use to put a
 * plain and an aspirated block side by side. Adding a set is a catalogue entry and the owner's listen, with no code.
 */
export function contrastApproved(a: string, b: string, sets: readonly ContrastSetEntry[] = CONTRAST_SETS): boolean {
  return sets.some((s) => s.approved && memberOf(s, a) !== undefined && memberOf(s, b) !== undefined);
}

/**
 * The clip-only play spec of one member of a round's set (the prompt's, a compare item's, an option's button): the
 * member's own clip, never a say clip or the voice. `undefined` when the round's set or the text is unknown.
 */
export function contrastMemberSpec(setId: string, text: string, sets: readonly ContrastSetEntry[] = CONTRAST_SETS): PlaySpec | undefined {
  const ref = contrastClipRef(setId, text, sets);
  return ref === undefined ? undefined : { text, audioRef: ref, kind: 'sound', source: LISTEN_PICK_AUDIO_SOURCE, clipOnly: true };
}

/**
 * Whether a contrast round plays now (section 3.6): its set is approved, every member's clip can play, sound is on and
 * "Always show the letters" is off, and the host is a practice host. A round that is not a contrast round is not this
 * function's to decide: `true`.
 */
export function contrastRoundPlayable(round: Pick<ListenPickRound, 'contrastSet'>, env: ContrastEnv): boolean {
  if (round.contrastSet === undefined) return true;
  if (!PRACTICE_HOSTS.includes(env.host) || !env.soundOn || env.alwaysShowLetters) return false;
  const set = contrastSetById(round.contrastSet, env.sets);
  if (set === undefined || !set.approved) return false;
  return set.members.every((m) => env.hasClip(m.ref));
}

/**
 * The contrast rounds that play now, and whether they make a step (section 3.5): at least two sets, and the members of
 * those sets cover at least two kinds (plain and aspirated in Stage 1), so a learner is never trained on one series
 * alone. `[]` when they do not.
 */
export function playableContrastRounds(rounds: readonly ListenPickRound[], env: ContrastEnv): ListenPickRound[] {
  const playable = rounds.filter((r) => isContrastRound(r) && contrastRoundPlayable(r, env));
  const ids = new Set(playable.map((r) => r.contrastSet));
  if (ids.size < CONTRAST_MIN_SETS) return [];
  const kinds = new Set<ContrastKind>();
  for (const r of playable) for (const m of contrastSetById(r.contrastSet!, env.sets)?.members ?? []) kinds.add(m.kind);
  return kinds.size >= 2 ? playable : [];
}

/** Whether a contrast scope has a step to play now (the pass-by rule of MP-2b reads this). */
export function contrastStepPlayable(rounds: readonly ListenPickRound[], env: ContrastEnv): boolean {
  return playableContrastRounds(rounds, env).length > 0;
}

/**
 * The rounds a contrast step opens with, drawn when it starts (section 3.5, seeded, so a test and a replay can be told
 * apart from each other): up to `count` of the playable sets, no two in a row from the same consonant series where
 * the pool allows, each round's target drawn from its set so that the kinds (plain, aspirated, tense) come up as evenly as
 * the rounds allow. The round keeps its options; its `prompt` and `answerId` become the target, and the prompt carries
 * the target's own clip (`audioRef`). `[]` when the step cannot be played.
 */
export function drawContrastRounds(
  rounds: readonly ListenPickRound[],
  env: ContrastEnv,
  seed: number,
  count: number = CONTRAST_STEP_ROUNDS,
): ListenPickRound[] {
  const pool = [...playableContrastRounds(rounds, env)];
  if (pool.length === 0) return [];
  const random = seededRandom(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const seriesOf = (r: ListenPickRound): string | undefined => contrastSetById(r.contrastSet!, env.sets)?.series;
  const chosen: ListenPickRound[] = [];
  while (chosen.length < count && pool.length > 0) {
    const last = chosen.length === 0 ? undefined : seriesOf(chosen[chosen.length - 1]!);
    const at = pool.findIndex((r) => seriesOf(r) !== last);
    chosen.push(pool.splice(at < 0 ? 0 : at, 1)[0]!);
  }
  // Targets: the member whose kind has come up least so far, ties by the seeded draw.
  const seen = new Map<ContrastKind, number>();
  return chosen.map((stub) => withTarget(stub, env.sets, random, seen));
}

/**
 * A contrast round with its set's own options and a drawn target (sections 3.5, 3.7). A scope's round may be the start
 * bundle's stub (`lp.pair`), whose options are placeholders: the set's round supplies the members, and each member keeps
 * the meaning the scope holds for it when the scope names it (a round written out in full and localized: the option with
 * the same Korean text, its `en` non empty), else the catalogue's. The target is the member whose kind `seen` counts
 * least (ties by `random`); `seen` is updated, so a run of rounds balances its kinds.
 */
export function withTarget(
  scopeRound: ListenPickRound,
  sets: readonly ContrastSetEntry[] | undefined,
  random: () => number,
  seen: Map<ContrastKind, number> = new Map(),
): ListenPickRound {
  const round = pairRound(scopeRound.contrastSet!, sets);
  const set = contrastSetById(round.contrastSet!, sets)!;
  const least = Math.min(...set.members.map((m) => seen.get(m.kind) ?? 0));
  const candidates = set.members.filter((m) => (seen.get(m.kind) ?? 0) === least);
  const target = candidates[Math.floor(random() * candidates.length)]!;
  seen.set(target.kind, (seen.get(target.kind) ?? 0) + 1);
  const held = (ko: string): string | undefined => {
    const en = scopeRound.options.find((o) => o.text?.ko === ko)?.text?.en;
    return en === undefined || en === '' ? undefined : en;
  };
  return {
    ...round,
    options: round.options.map((o) => (o.text === undefined ? o : { ...o, text: { ...o.text, en: held(o.text.ko) ?? o.text.en } })),
    prompt: { ko: target.text, romanization: target.romanization, en: held(target.text) ?? target.en, audioRef: target.ref },
    answerId: target.romanization,
  };
}

/**
 * What a round's option is in its set: its kind (plain, aspirated, tense) and the set's consonant series (`s` is the hiss
 * pair), for the line under it (`contrastKindLine`). `undefined` when the round or the text is not the set's.
 */
export function contrastNote(
  round: Pick<ListenPickRound, 'contrastSet'>,
  optionKo: string,
  sets: readonly ContrastSetEntry[] = CONTRAST_SETS,
): { kind: ContrastKind; series: ContrastSetEntry['series'] } | undefined {
  const set = round.contrastSet === undefined ? undefined : contrastSetById(round.contrastSet, sets);
  const member = set === undefined ? undefined : memberOf(set, optionKo);
  return set === undefined || member === undefined ? undefined : { kind: member.kind, series: set.series };
}

/** The set's member a round's option stands for (its Korean text is the member's), or `undefined`. */
export function optionMember(round: Pick<ListenPickRound, 'contrastSet'>, optionKo: string, sets: readonly ContrastSetEntry[] = CONTRAST_SETS): ContrastMemberEntry | undefined {
  const set = round.contrastSet === undefined ? undefined : contrastSetById(round.contrastSet, sets);
  return set === undefined ? undefined : memberOf(set, optionKo);
}
