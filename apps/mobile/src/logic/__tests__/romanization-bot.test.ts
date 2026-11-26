import type { ListenPickRound } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { STAGE1_QUESTS } from '../stage1/curriculum';
import { buildHangulCheck } from '../stage1/hangul-check';
import { checkHoldsRomanization, optionView, promptView, startFlow, textPromptView, type OptionView } from '../listen-pick-flow';
import { scopeFor } from '../minigame-config';
import { seededRandom, shuffleOptions, validRounds } from '../listen-pick';
import type { HostMode } from '../../screens/minigames/host';

/**
 * The romanization-only bot (AMENDMENTS-STAGE1-DECODING-CHECK section 3.9, row DC-1a): a responder that understands
 * spoken Korean and reads only Latin letters. It cannot read Hangul; it knows the romanization and the meaning of
 * every sound it hears (the lexicon oracle: a heard word's own romanization and gloss) and reads every Latin or
 * English string a view draws. It answers from what the pure view models draw, by four strategies in order: (1) match
 * (an option whose drawn romanization or label names the heard sound), (2) pattern (the option closest to all the
 * others by their drawn romanizations: the "middle" one), (3) elimination (answers already given in the same check),
 * (4) length (options with as many blocks as the heard word); then a seeded uniform guess among what is left.
 *
 * Acceptance, over 200 seeds, on the surfaces this row covers (every Stage 1 quest Check round and the version 1
 * Hangul Check's name and final rounds): before the answer, strategies (1) and (2) rule out no option of a reading
 * round, and the bot's pooled first-try accuracy on reading rounds is at most chance + 0.03. The control, the same bot
 * with the hold off, answers at least 0.9 of the reading rounds whose stimulus and answer share a romanization, so
 * the test proves the hold, not a weak bot.
 */

const SEEDS = 200;
const A11Y = getMessages('en').a11y.minigame;

type Kind = 'reading' | 'listening';

/** A round's kind: text options are read (reading); picture options are found by hearing the word (listening). */
const kindOf = (round: ListenPickRound): Kind => (round.options.some((o) => o.pictureRef !== undefined) ? 'listening' : 'reading');

/** What the bot sees of an option: only the Latin and English text a view draws, and the block count of its shape. */
interface Seen {
  id: string;
  romanization: string;
  label: string | undefined;
  blocks: number;
}

function see(round: ListenPickRound, hold: boolean, mode: HostMode): Seen[] {
  const state = startFlow(1);
  const context = { mode, romanizationMode: 'always', holdRomanization: hold } as const;
  return round.options.map((option) => {
    const view: OptionView = optionView(round, option, state, context, A11Y);
    // `romanization` is the line drawn now; `heldRomanization` is reserved room, drawn invisible and off the tree.
    return { id: view.id, romanization: view.romanization, label: view.label, blocks: [...(view.ko ?? '')].length };
  });
}

const norm = (s: string): string => s.trim().toLowerCase();

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const up = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = up;
    }
  }
  return row[b.length]!;
}

/** Strategy (1): the options whose drawn text names the heard sound (its romanization, or its meaning by a picture's label). */
function matches(round: ListenPickRound, seen: readonly Seen[]): string[] {
  const sound = norm(round.prompt.romanization);
  const meaning = norm(round.prompt.en ?? '');
  return seen.filter((o) => (o.romanization !== '' && norm(o.romanization) === sound) || (o.label !== undefined && meaning !== '' && norm(o.label) === meaning)).map((o) => o.id);
}

/** Strategy (2): the option closest to all the others by the romanizations drawn (needs three drawn). */
function middle(seen: readonly Seen[]): string | undefined {
  const drawn = seen.filter((o) => o.romanization !== '');
  if (drawn.length < 3) return undefined;
  const sums = drawn.map((o) => ({ id: o.id, sum: drawn.reduce((total, other) => total + distance(norm(o.romanization), norm(other.romanization)), 0) }));
  const best = Math.min(...sums.map((s) => s.sum));
  const winners = sums.filter((s) => s.sum === best);
  return winners.length === 1 ? winners[0]!.id : undefined;
}

/** Which of the guessing strategies the bot may use after (1) and (2). */
interface Strategies {
  /** (4) options with as many blocks as the heard word. A cue of the content, which no hold can remove. */
  length: boolean;
}

function pick(round: ListenPickRound, seen: readonly Seen[], taken: ReadonlySet<string>, rnd: () => number, strategies: Strategies): string {
  const matched = matches(round, seen);
  if (matched.length === 1) return matched[0]!;
  const centre = middle(seen);
  if (centre !== undefined) return centre;
  // (3) elimination is for pictures and words (section 3.9): an answer already given in this check is not asked again.
  let left = kindOf(round) === 'listening' ? seen.filter((o) => !taken.has(o.id)) : [...seen];
  if (strategies.length) {
    const sameLength = left.filter((o) => o.blocks === [...round.prompt.ko].length);
    if (sameLength.length > 0) left = sameLength;
  }
  if (left.length === 0) left = [...seen];
  return left[Math.floor(rnd() * left.length)]!.id;
}

interface Tally {
  reading: { right: number; trials: number; chance: number };
  listening: { right: number; trials: number; chance: number };
  /** Reading rounds where strategy (1) or (2) pointed at an option before the answer. */
  leaks: string[];
}

const emptyTally = (): Tally => ({ reading: { right: 0, trials: 0, chance: 0 }, listening: { right: 0, trials: 0, chance: 0 }, leaks: [] });

/** The bot plays one check (its rounds in order, in the host `mode`), adding to `tally`. */
function playCheck(rounds: readonly ListenPickRound[], mode: HostMode, hold: boolean, rnd: () => number, tally: Tally, where: string, strategies: Strategies, only?: (round: ListenPickRound) => boolean): void {
  const taken = new Set<string>();
  rounds.forEach((round, i) => {
    const seen = see(round, hold, mode);
    const kind = kindOf(round);
    if (kind === 'reading' && (matches(round, seen).length > 0 || middle(seen) !== undefined)) tally.leaks.push(`${where}#${i} ${round.id}`);
    const answered = pick(round, seen, taken, rnd, strategies);
    taken.add(round.answerId);
    if (only && !only(round)) return;
    const bucket = tally[kind];
    bucket.trials += 1;
    bucket.chance += 1 / round.options.length;
    if (answered === round.answerId) bucket.right += 1;
  });
}

/** Every Stage 1 quest Check's rounds, each quest as one check. */
function questChecks(): Array<{ quest: string; rounds: ListenPickRound[] }> {
  const out: Array<{ quest: string; rounds: ListenPickRound[] }> = [];
  for (const quest of STAGE1_QUESTS) {
    for (const step of quest.steps) {
      if (step.kind !== 'check' || step.minigameRef === undefined) continue;
      const scope = scopeFor(step.minigameRef);
      const rounds = scope === undefined ? [] : validRounds(scope);
      if (rounds.length > 0) out.push({ quest: quest.id, rounds });
    }
  }
  return out;
}

function playQuestChecks(hold: boolean, seeds: number, strategies: Strategies, only?: (round: ListenPickRound) => boolean): Tally {
  const tally = emptyTally();
  const checks = questChecks();
  for (let seed = 1; seed <= seeds; seed += 1) {
    const rnd = seededRandom(seed * 7919);
    checks.forEach((check, c) => {
      const shuffled = check.rounds.map((r, i) => shuffleOptions(r, seed * 131 + c * 17 + i));
      playCheck(shuffled, 'check', hold, rnd, tally, `${check.quest}@${seed}`, strategies, only);
    });
  }
  return tally;
}

function playHangulChecks(hold: boolean, seeds: number, strategies: Strategies, only?: (round: ListenPickRound) => boolean): Tally {
  const tally = emptyTally();
  for (let seed = 1; seed <= seeds; seed += 1) {
    const rnd = seededRandom(seed * 104729);
    const check = buildHangulCheck({ seed });
    playCheck(
      check.items.map((i) => i.round),
      'review',
      hold,
      rnd,
      tally,
      `hangul-check@${seed}`,
      strategies,
      only,
    );
  }
  return tally;
}

const accuracy = (b: { right: number; trials: number }): number => b.right / b.trials;
const expectedChance = (b: { chance: number; trials: number }): number => b.chance / b.trials;

const NO_LENGTH: Strategies = { length: false };
const WITH_LENGTH: Strategies = { length: true };

describe('the hold is on: the quest Checks of Stage 1', () => {
  it('there are Stage 1 Check rounds to test, mostly reading rounds', () => {
    const rounds = questChecks().flatMap((c) => c.rounds);
    expect(questChecks().length).toBeGreaterThanOrEqual(15);
    expect(rounds.filter((r) => kindOf(r) === 'reading').length).toBeGreaterThan(15);
  });

  it('every host a Check holds: the quest Check and the Hangul Check', () => {
    expect(checkHoldsRomanization('check')).toBe(true);
    expect(checkHoldsRomanization('review')).toBe(true);
  });

  it('exact check: before the answer no reading round gives the bot a match or a middle option, in any of 200 seeds', () => {
    const tally = playQuestChecks(checkHoldsRomanization('check'), SEEDS, WITH_LENGTH);
    expect(tally.leaks).toEqual([]);
    expect(tally.reading.trials).toBeGreaterThan(1000);
  });

  it('pooled: on reading rounds the bot (match, pattern, elimination, guess) is no better than chance + 0.03', () => {
    const tally = playQuestChecks(checkHoldsRomanization('check'), SEEDS, NO_LENGTH);
    expect(accuracy(tally.reading)).toBeLessThanOrEqual(expectedChance(tally.reading) + 0.03);
  });

  it("reported, not the hold's to remove: a word round whose options differ in block count from the heard word lets strategy (4) beat chance (content, WO-12)", () => {
    // The Stage 1 word rounds draw distractors of other lengths (나무 against 오, 다리 against 어머니). A Check cannot hold
    // the shape of a word, so this is a content property, measured here so a change in it shows. It is bounded, not zero.
    const tally = playQuestChecks(checkHoldsRomanization('check'), SEEDS, WITH_LENGTH);
    expect(accuracy(tally.reading)).toBeGreaterThan(expectedChance(tally.reading));
    expect(accuracy(tally.reading)).toBeLessThan(0.45);
  });

  it('what a Sound-off or asked prompt draws is the romanization of the sound only, which is the stimulus: it names no option', () => {
    for (const { rounds } of questChecks()) {
      for (const round of rounds.filter((r) => kindOf(r) === 'reading')) {
        const prompt = promptView(round, startFlow(1), 'check', true, true);
        expect(prompt.content?.ko).toBeUndefined();
        expect(prompt.content?.romanization).toBe(round.prompt.romanization);
        expect(see(round, true, 'check').every((o) => o.romanization === '')).toBe(true);
      }
    }
  });
});

describe('the hold is on: the version 1 Hangul Check, name and final rounds', () => {
  it('exact check and pooled limit over 200 seeds', () => {
    const tally = playHangulChecks(checkHoldsRomanization('review'), SEEDS, WITH_LENGTH);
    expect(tally.leaks).toEqual([]);
    expect(tally.reading.trials).toBe(SEEDS * 30);
    expect(accuracy(tally.reading)).toBeLessThanOrEqual(expectedChance(tally.reading) + 0.03);
  });

  it('the word rounds (picture options, heard) are listening rounds: reported, not held to chance', () => {
    const tally = playHangulChecks(checkHoldsRomanization('review'), SEEDS, WITH_LENGTH);
    // No hold can make a heard word unreadable; elimination over the five pictures stays possible (section 3.9).
    expect(tally.listening.trials).toBe(SEEDS * 5);
    expect(accuracy(tally.listening)).toBeGreaterThanOrEqual(expectedChance(tally.listening));
  });
});

describe('a text prompt holds its own romanization too (view model)', () => {
  it('the prompt of a text prompt round in a Check draws no romanization until the answer', () => {
    const round = questChecks()[0]!.rounds[0]!;
    expect(textPromptView(round, startFlow(1), checkHoldsRomanization('check')).held).toBe(true);
    expect(textPromptView(round, startFlow(1), checkHoldsRomanization('quest')).held).toBe(false);
  });
});

describe('control: the same bot with the hold off', () => {
  /** A reading round whose stimulus and answer share a romanization (the sound heard is the text the answer shows). */
  const shared = (round: ListenPickRound): boolean => {
    const answer = round.options.find((o) => o.id === round.answerId);
    return kindOf(round) === 'reading' && answer?.text !== undefined && norm(answer.text.romanization) === norm(round.prompt.romanization);
  };

  it('answers at least 0.9 of the quest Check reading rounds that share a romanization with the answer', () => {
    const tally = playQuestChecks(false, 20, NO_LENGTH, shared);
    expect(tally.reading.trials).toBeGreaterThan(100);
    expect(accuracy(tally.reading)).toBeGreaterThanOrEqual(0.9);
  });

  it('answers at least 0.9 of the Hangul Check reading rounds that share one', () => {
    const tally = playHangulChecks(false, 20, NO_LENGTH, shared);
    expect(tally.reading.trials).toBeGreaterThan(100);
    expect(accuracy(tally.reading)).toBeGreaterThanOrEqual(0.9);
  });
});
