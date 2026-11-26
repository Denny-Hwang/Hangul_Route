import type { ListenPickRound } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { STAGE1_QUESTS } from '../stage1/curriculum';
import { buildHangulCheck } from '../stage1/hangul-check';
import { checkHoldsRomanization, optionView, promptView, startFlow, textPromptView, type OptionView } from '../listen-pick-flow';
import { scopeFor } from '../minigame-config';
import { seededRandom, shuffleOptions, validRounds } from '../listen-pick';
import type { HostMode } from '../../screens/minigames/host';
import type { ReviewFormat, ReviewItem, ReviewItemKind } from '@hangul-route/content-schema/review-items';
import { holdsRomanization, type HoldSurface } from '../locale/check-hold';
import type { Rung } from '../memory/spacing';
import type { EngineContext, ReviewQuestion } from '../reviews/engine';
import { roundFor, surfaceIndex, type PickRound, type ReviewRound, type RoundInput } from '../reviews/review-rounds';
import { keyboardSoundHeld, roundLook } from '../reviews/round-look';

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

// ---- the review rounds (row DC-1b): the Stage Check, the Cell Check and the Daily Review ------------------------------

/**
 * The same bot on the rounds of `ReviewRounds`, through the pure `roundLook` the screen draws from. The Stage Check and the
 * Cell Check hold every rung; the Daily Review's read and produce rungs hold, its recognize rung is practice and is reported,
 * not held to chance. Pick rounds are scored by the bot; type, cloze and order rounds are production: the exact check is
 * that no romanization line of the question is drawn before the answer and that the keyboard's Latin line is held in a
 * Check (the Daily Review keeps it, OD-DC12).
 */

const FORMATS: Readonly<Record<ReviewItemKind, readonly ReviewFormat[]>> = {
  sym: ['hear-pick', 'read-pick'],
  syl: ['hear-pick', 'read-pick'],
  lex: ['hear-pick', 'read-pick', 'type-see'],
  pat: ['hear-pick', 'read-pick', 'sentence-builder', 'cloze-pick'],
  exc: ['hear-pick', 'read-pick', 'sentence-builder'],
  rea: ['read-pick'],
};
const item = (id: string, over: Partial<ReviewItem> = {}): ReviewItem => {
  const kind = id.slice(0, 3) as ReviewItemKind;
  return { id, kind, ko: '가', romanization: 'ga', home: 'life', stage: 2, volume: 1, cells: ['episode:stage2-life'], asked: [], formats: [...FORMATS[kind]], soundChange: false, homophoneOf: [], ...over };
};
const REVIEW_ITEMS: ReviewItem[] = [
  item('lex:sagwa', { ko: '사과', romanization: 'sagwa', en: 'apple' }),
  item('lex:namu', { ko: '나무', romanization: 'namu', en: 'tree' }),
  item('lex:bap', { ko: '밥', romanization: 'bap', en: 'cooked rice' }),
  item('lex:tteok', { ko: '떡', romanization: 'tteok', en: 'rice cake' }),
  item('lex:gae', { ko: '개', romanization: 'gae', en: 'dog' }),
  item('lex:mul', { ko: '물', romanization: 'mul', en: 'water' }),
  item('sym:giyeok', { ko: 'ㄱ', romanization: 'g/k' }),
  item('sym:nieun', { ko: 'ㄴ', romanization: 'n' }),
  item('sym:mieum', { ko: 'ㅁ', romanization: 'm' }),
  item('sym:siot', { ko: 'ㅅ', romanization: 's' }),
  item('pat:chaegi-isseoyo', { ko: '책이 있어요.', romanization: 'chaegi isseoyo', en: 'There is a book.' }),
  item('pat:yeonpiri-eopseoyo', { ko: '연필이 없어요.', romanization: 'yeonpiri eopseoyo', en: 'There is no pencil.' }),
  item('pat:chinguga-isseoyo', { ko: '친구가 있어요.', romanization: 'chinguga isseoyo', en: 'I have a friend.' }),
  item('pat:gabangi-isseoyo', { ko: '가방이 있어요.', romanization: 'gabangi isseoyo', en: 'There is a bag.' }),
  item('exc:ige-mwoyeyo', { ko: '이게 뭐예요?', romanization: 'ige mwoyeyo?', en: 'What is this?', reply: { ko: '지우개예요.', romanization: 'jiugaeyeyo.', en: 'It is an eraser.' } }),
  item('exc:nuguyeyo', { ko: '누구예요?', romanization: 'nuguyeyo?', en: 'Who is it?', reply: { ko: '할머니예요.', romanization: 'halmeoniyeyo.', en: 'It is Grandma.' } }),
  item('exc:annyeong', { ko: '안녕하세요!', romanization: 'annyeonghaseyo!', en: 'Hello!', reply: { ko: '네, 안녕하세요.', romanization: 'ne, annyeonghaseyo.', en: 'Yes, hello.' } }),
  item('exc:gamsa', { ko: '고마워요.', romanization: 'gomawoyo.', en: 'Thank you.', reply: { ko: '천만에요.', romanization: 'cheonmaneyo.', en: "You're welcome." } }),
];
const REVIEW_INDEX: EngineContext['index'] = { items: REVIEW_ITEMS, byId: new Map(REVIEW_ITEMS.map((i) => [i.id, i])), retired: new Set() };
const SURFACE = surfaceIndex(REVIEW_INDEX, { clozePick: true });

/** What the bot knows of the content: the lexicon oracle (a romanization to its meaning, an exchange's line to its reply). */
const MEANING = new Map(REVIEW_ITEMS.filter((i) => i.en !== undefined).map((i) => [norm(i.romanization), norm(i.en ?? '')]));
const REPLY = new Map(REVIEW_ITEMS.filter((i) => i.reply !== undefined).map((i) => [norm(i.romanization), norm(i.reply?.romanization ?? '')]));

const question = (id: string, format: ReviewFormat, rung: Rung): ReviewQuestion => ({ itemId: id, kind: id.slice(0, 3) as ReviewItemKind, rung, format, theme: 'life', stretch: false, voiceFallback: false });
const RUNG_OF: Partial<Record<ReviewFormat, Rung>> = { 'hear-pick': 'recognize', 'read-pick': 'read' };

/** The rounds of one seed: every item asked every way it has, at the rung of its format. */
function reviewRounds(seed: number): ReviewRound[] {
  const input: RoundInput = { index: SURFACE, gloss: (_k, en) => en, seed: `s${seed}` };
  const out: ReviewRound[] = [];
  for (const i of REVIEW_ITEMS) {
    for (const format of FORMATS[i.kind]) {
      if (format === 'hear-pick' && i.kind === 'sym') continue;
      const round = roundFor(question(i.id, format, RUNG_OF[format] ?? 'produce'), input);
      if (round !== null) out.push(round);
    }
  }
  return out;
}

interface ReviewSeen {
  /** The Latin text drawn for the stimulus: the heard sound's romanization, or the shown prompt's romanization when it is drawn. */
  stimulus: string | undefined;
  options: Array<{ id: string; romanization: string; label: string | undefined }>;
}

/** What the bot sees of a pick round: only what the look draws (a held line is invisible), and the sound it hears. */
function seeReview(round: PickRound, surface: HoldSurface): ReviewSeen {
  const look = roundLook(round, { surface, solved: false });
  const stimulus = round.heard || look.promptRomanization ? round.prompt.romanization : undefined;
  return {
    stimulus,
    options: round.options.map((o) => ({ id: o.id, romanization: look.optionRomanization ? (o.ko?.romanization ?? '') : '', label: o.label })),
  };
}

function reviewMatches(round: PickRound, seen: ReviewSeen): string[] {
  if (seen.stimulus === undefined || round.ask === 'sound') return [];
  const s = norm(seen.stimulus);
  if (round.ask === 'spelling') return seen.options.filter((o) => o.romanization !== '' && norm(o.romanization) === s).map((o) => o.id);
  if (round.ask === 'reply') return seen.options.filter((o) => o.romanization !== '' && norm(o.romanization) === REPLY.get(s)).map((o) => o.id);
  const meaning = MEANING.get(s);
  return seen.options.filter((o) => meaning !== undefined && o.label !== undefined && norm(o.label) === meaning).map((o) => o.id);
}

function reviewMiddle(seen: ReviewSeen): string | undefined {
  const drawn = seen.options.filter((o) => o.romanization !== '');
  if (drawn.length < 3) return undefined;
  const sums = drawn.map((o) => ({ id: o.id, sum: drawn.reduce((t, other) => t + distance(norm(o.romanization), norm(other.romanization)), 0) }));
  const best = Math.min(...sums.map((x) => x.sum));
  const winners = sums.filter((x) => x.sum === best);
  return winners.length === 1 ? winners[0]!.id : undefined;
}

interface ReviewTally {
  trials: number;
  right: number;
  chance: number;
  leaks: string[];
}

function playReviewPicks(surface: HoldSurface, seeds: number, only: (round: PickRound) => boolean): ReviewTally {
  const tally: ReviewTally = { trials: 0, right: 0, chance: 0, leaks: [] };
  for (let seed = 1; seed <= seeds; seed += 1) {
    const rnd = seededRandom(seed * 15485863);
    reviewRounds(seed).forEach((round, i) => {
      if (round.type !== 'pick' || !only(round)) return;
      const seen = seeReview(round, surface);
      const matched = reviewMatches(round, seen);
      const centre = reviewMiddle(seen);
      if (matched.length > 0 || centre !== undefined) tally.leaks.push(`${surface}@${seed}#${i} ${round.question.itemId} ${round.ask}`);
      const answered = matched.length === 1 ? matched[0]! : (centre ?? seen.options[Math.floor(rnd() * seen.options.length)]!.id);
      tally.trials += 1;
      tally.chance += 1 / round.options.length;
      if (answered === round.answerId) tally.right += 1;
    });
  }
  return tally;
}

const anyPick = (): boolean => true;

describe('review rounds: the Stage Check and the Cell Check hold every rung', () => {
  it.each(['stage-check', 'cell-check'] as const)('%s: the fixtures draw heard spelling, meaning, reply and sound rounds', (surface) => {
    const asks = new Set(reviewRounds(1).filter((r): r is PickRound => r.type === 'pick').map((r) => r.ask));
    expect([...asks].sort()).toEqual(['meaning', 'reply', 'sound', 'spelling']);
    expect(holdsRomanization(surface, 'recognize')).toBe(true);
  });

  it.each(['stage-check', 'cell-check'] as const)('%s exact check: before the answer no pick round gives the bot a match or a middle option, in any of 200 seeds', (surface) => {
    const tally = playReviewPicks(surface, SEEDS, anyPick);
    expect(tally.leaks).toEqual([]);
    expect(tally.trials).toBeGreaterThan(2000);
  });

  it.each(['stage-check', 'cell-check'] as const)('%s pooled: the bot is no better than chance + 0.03 on the pick rounds', (surface) => {
    const tally = playReviewPicks(surface, SEEDS, anyPick);
    expect(tally.right / tally.trials).toBeLessThanOrEqual(tally.chance / tally.trials + 0.03);
  });

  it.each(['stage-check', 'cell-check'] as const)("%s production rounds (type, cloze, order): no romanization line is drawn before the answer and the keyboard's Latin line is held", (surface) => {
    const rounds = reviewRounds(1).filter((r) => r.type === 'type' || r.type === 'cloze' || r.type === 'order');
    expect(new Set(rounds.map((r) => r.type))).toEqual(new Set(['type', 'cloze', 'order']));
    for (const round of rounds) {
      const look = roundLook(round, { surface, solved: false });
      expect(look.promptRomanization, round.question.itemId).toBe(false);
      expect(look.optionRomanization, round.question.itemId).toBe(false);
      if (round.type === 'type') expect(keyboardSoundHeld(surface, round)).toBe(true);
    }
  });
});

describe('review rounds: the Daily Review holds the read and produce rungs, not the recognize rung', () => {
  it('exact check and pooled limit on the read-rung pick rounds (meaning, reply and sound)', () => {
    const tally = playReviewPicks('daily-review', SEEDS, (round) => round.question.rung === 'read');
    expect(tally.leaks).toEqual([]);
    expect(tally.trials).toBeGreaterThan(1000);
    expect(tally.right / tally.trials).toBeLessThanOrEqual(tally.chance / tally.trials + 0.03);
  });

  it('the recognize rung (hear it, pick it) is practice: its options show their romanization and the bot matches them (reported, not held)', () => {
    const tally = playReviewPicks('daily-review', 20, (round) => round.question.rung === 'recognize');
    expect(tally.trials).toBeGreaterThan(100);
    expect(tally.right / tally.trials).toBeGreaterThanOrEqual(0.9);
  });

  it("production rounds hold their question, and the produce rung keeps the keyboard's Latin line (OD-DC12)", () => {
    const type = reviewRounds(1).find((r) => r.type === 'type')!;
    expect(roundLook(type, { surface: 'daily-review', solved: false }).held).toBe(true);
    expect(keyboardSoundHeld('daily-review', type)).toBe(false);
    expect(keyboardSoundHeld('stage-check', type)).toBe(true);
  });
});

describe('review rounds, control: the same bot with the hold off', () => {
  it('answers at least 0.9 of the pick rounds whose stimulus names the answer when nothing is held (practice)', () => {
    const tally = playReviewPicks('practice', 20, (round) => round.ask !== 'sound');
    expect(tally.trials).toBeGreaterThan(300);
    expect(tally.right / tally.trials).toBeGreaterThanOrEqual(0.9);
  });
});
