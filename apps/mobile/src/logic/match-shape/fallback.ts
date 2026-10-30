import type { MatchShapeRound } from '@hangul-route/content-schema';
import type { MinigameScope } from '../minigame-config';
import { shapeLetter, soundsMeet } from './letters';

/**
 * The fallback round when `game.match-shape` is off (F-CURR-002 sections 7.1 F4 and 12.2, row CM-33;
 * design/wireframes/minigame/match-shape.md, Fallback round): **Read Pick**, the `sym` read rung of section 4.3. See the
 * round's letter, pick its sound in romanization among 3, on the Listen & Pick option cards; the picture and its line
 * are left out (a culture layer, not the asked skill). Recorded at the read rung, and `minigame.finished` names
 * `listen-pick`.
 *
 * Rule `read-pick-values-distinct`: no distractor shares a sound with the target (its final value included), and no
 * two options share one, so exactly one option can be right. The distractors are the round's other letters whose
 * sounds are their own, then the step's letters, then the fallback pools below.
 */

export interface ReadPickOption {
  /** The letter the option is the sound of. */
  id: string;
  /** Its isolated-letter value, the option's face (`g/k`). */
  sound: string;
}

export interface ReadPickRound {
  id: string;
  /** The letter shown. */
  target: string;
  /** 3 options, the target first; the screen shuffles them. */
  options: ReadPickOption[];
  answerId: string;
}

/** Letters every Stage 1 learner has met, used when a step has too few letters of its own (consonants, then vowels). */
const CONSONANT_POOL = ['jamo:mieum', 'jamo:siot', 'jamo:nieun', 'jamo:giyeok', 'jamo:hieut', 'jamo:jieut'];
const VOWEL_POOL = ['jamo:a', 'jamo:eo', 'jamo:o', 'jamo:u', 'jamo:eu', 'jamo:i'];

const OPTIONS = 3;

/** The letters a round shows (its target first). */
function lettersOf(round: MatchShapeRound): string[] {
  return round.shape === 'origin' ? [round.target, ...round.options.filter((o) => o !== round.target)] : [round.target, round.lookAlike];
}

export function matchShapeToReadPick(round: MatchShapeRound, stepLetters: readonly string[] = []): ReadPickRound {
  const target = shapeLetter(round.target);
  const vowel = /^[ㅏ-ㅣ]$/.test(target.char);
  const picked = [target];
  const take = (id: string): void => {
    if (picked.length >= OPTIONS || picked.some((p) => p.id === id)) return;
    const letter = shapeLetter(id);
    if (/^[ㅏ-ㅣ]$/.test(letter.char) !== vowel) return;
    if (picked.some((p) => soundsMeet(p.char, letter.char))) return;
    picked.push(letter);
  };
  for (const id of [...lettersOf(round).slice(1), ...stepLetters, ...(vowel ? VOWEL_POOL : CONSONANT_POOL)]) take(id);
  return { id: round.id, target: target.id, options: picked.map((l) => ({ id: l.id, sound: l.sound })), answerId: target.id };
}

/** Every letter a Match Shape scope shows, in order, once. */
export function scopeLetters(scope: MinigameScope): string[] {
  const out: string[] = [];
  for (const round of scope.matchShape?.rounds ?? []) for (const id of lettersOf(round)) if (!out.includes(id)) out.push(id);
  return out;
}

/** A Match Shape scope as the Read Pick it falls back to: drawn on the Listen & Pick cards, so it reports `listen-pick`. */
export function fallbackScope(scope: MinigameScope): MinigameScope {
  const letters = scopeLetters(scope);
  return { kind: 'listen-pick', readPick: { rounds: (scope.matchShape?.rounds ?? []).map((r) => matchShapeToReadPick(r, letters)) } };
}
