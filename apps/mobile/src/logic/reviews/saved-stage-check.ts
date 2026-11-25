import type { StageKey, UiLocale } from '@hangul-route/content-schema';
import type { RoundAnswer } from './daily-review';
import type { ReviewItemIndex } from './review-items-store';
import type { KoText, PickOption, ReviewRound } from './review-rounds';
import { isFreshCheckRun, SAVED_CHECK_VERSION, type SavedStageCheck } from './saved-check';
import type { PlannedStageCheck } from './stage-check';

/**
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-3b (section 3.4, OD-LR7, OD-LR9 (b)): the Stage Check goes on after an
 * interruption. The pure side of the Stage Check's stored run: what is stored after each answer, whether a stored value may
 * be resumed, and whether the run's result is already recorded. It lives in the memory chunk with `stage-check-api.ts`
 * (the screen's chunk reaches it only through `stageCheckApi()`), so the start bundle carries none of it; the stored
 * type and the rules common to both checks are `saved-check.ts`.
 *
 * Why the plan's rounds are stored, not the questions: the plan is drawn from the learner's memory store and settings at
 * that moment (`planStageCheck`), and each first answer is written into that store at once, so rounds built again after
 * the first parts were recorded would be another check. Each stored answer is an answer the memory store already holds
 * (the screen stores it only once its recording has settled), so a resumed check records only new answers.
 */

/** The value to store for a Stage Check in progress: the answers whose recording settled, by round index. */
export function savedStageCheck(run: {
  stage: StageKey;
  locale: UiLocale;
  itemsHash: string;
  rounds: readonly ReviewRound[];
  answers: ReadonlyMap<number, RoundAnswer>;
  hideRomanization: boolean;
  startedAt: string;
  /** Set by the finish once the result is in the progress (see `finishedStageCheck`). */
  finishedAt?: string;
}): SavedStageCheck {
  const answers: Array<[number, RoundAnswer]> = [];
  [...run.answers.keys()]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < run.rounds.length)
    .sort((a, b) => a - b)
    .forEach((index) => {
      const answer = run.answers.get(index) as RoundAnswer;
      // `asked` (the learner's own Show the letters, CH-1f) is kept like `hinted`: a resumed round keeps what it was recorded as.
      answers.push([index, { correct: answer.correct, ...(answer.hinted ? { hinted: true } : {}), ...(answer.asked ? { asked: true } : {}) }]);
    });
  return {
    v: SAVED_CHECK_VERSION,
    kind: 'stage',
    stage: run.stage,
    locale: run.locale,
    itemsHash: run.itemsHash,
    rounds: [...run.rounds],
    answers,
    hideRomanization: run.hideRomanization,
    startedAt: run.startedAt,
    ...(run.finishedAt !== undefined ? { finishedAt: run.finishedAt } : {}),
  };
}

// ---- the shape check -------------------------------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const optionalString = (v: unknown): boolean => v === undefined || isString(v);
const isKoText = (v: unknown): v is KoText => isRecord(v) && isString(v.ko) && isString(v.romanization);
const optionalKoText = (v: unknown): boolean => v === undefined || isKoText(v);
const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);

const RUNGS: readonly unknown[] = ['recognize', 'read', 'produce'];
const ASKS: readonly unknown[] = ['spelling', 'meaning', 'sound', 'reply'];
const TYPE_MODES: readonly unknown[] = ['see', 'picture', 'hear'];
const ZONES: readonly unknown[] = ['first', 'vowel', 'final'];

/** A first-try record of a round: `{ correct: boolean, hinted?: boolean, asked?: boolean }`. */
export function isRoundAnswer(v: unknown): v is RoundAnswer {
  return isRecord(v) && typeof v.correct === 'boolean' && (v.hinted === undefined || typeof v.hinted === 'boolean') && (v.asked === undefined || typeof v.asked === 'boolean');
}

function isPickOption(v: unknown): v is PickOption {
  return isRecord(v) && isString(v.id) && optionalKoText(v.ko) && optionalString(v.label) && optionalString(v.picture);
}

const isPickOptions = (v: unknown): v is PickOption[] => Array.isArray(v) && v.length > 0 && v.every(isPickOption);

function isQuestion(v: unknown): boolean {
  return (
    isRecord(v) &&
    isString(v.itemId) &&
    isString(v.kind) &&
    RUNGS.includes(v.rung) &&
    isString(v.format) &&
    isString(v.theme) &&
    typeof v.stretch === 'boolean' &&
    typeof v.voiceFallback === 'boolean' &&
    (v.cue === undefined || v.cue === 'picture' || v.cue === 'gloss')
  );
}

/**
 * Whether `v` is a round the Stage Check's round views can draw: its `type` is one of the six, and the fields its view
 * reads are present with the right types. Anything else is dropped, not repaired.
 */
export function isReviewRound(v: unknown): v is ReviewRound {
  if (!isRecord(v) || !isQuestion(v.question)) return false;
  const answer = v.answer;
  if (!isRecord(answer) || !isKoText(answer.ko) || !optionalString(answer.gloss)) return false;
  switch (v.type) {
    case 'pick': {
      const cue = v.cue;
      const cueOk = cue === undefined || (isRecord(cue) && optionalString(cue.picture) && optionalString(cue.gloss));
      return (
        typeof v.heard === 'boolean' &&
        ASKS.includes(v.ask) &&
        isKoText(v.prompt) &&
        cueOk &&
        isPickOptions(v.options) &&
        isString(v.answerId) &&
        v.options.some((o) => o.id === v.answerId)
      );
    }
    case 'type':
      return TYPE_MODES.includes(v.mode) && isString(v.target) && optionalString(v.picture);
    case 'order':
      return (
        optionalKoText(v.line) &&
        optionalString(v.meaning) &&
        Array.isArray(v.tiles) &&
        v.tiles.length > 0 &&
        v.tiles.every((t) => isRecord(t) && isString(t.key) && isString(t.ko)) &&
        isStringList(v.words) &&
        v.words.length > 0
      );
    case 'cloze':
      return isKoText(v.gapped) && isString(v.meaning) && isPickOptions(v.tiles) && isString(v.answerId) && v.tiles.some((o) => o.id === v.answerId);
    case 'build':
      return isKoText(v.target) && optionalString(v.gloss) && (v.fixed === undefined || ZONES.includes(v.fixed));
    case 'shape':
      return isString(v.target) && isString(v.lookAlike);
    default:
      return false;
  }
}

// ---- resuming --------------------------------------------------------------------------------------------------

/** What a resumable Stage Check restores. */
export interface ResumableStageCheck {
  /** The plan as stored: no round is built again. */
  plan: PlannedStageCheck;
  /** The first answers, by round index, each already in the memory store. */
  answers: Map<number, RoundAnswer>;
  hideRomanization: boolean;
  startedAt: string;
  /**
   * The round the check goes on at: the first one without an answer, so a round whose answer could not be recorded is
   * asked again (the same round after the last one answered when nothing is missing in between, OD-LR9 (b)). The number
   * of rounds when every round is answered: straight to the finish.
   */
  next: number;
}

/** What the stage, the language and the review items of today must match for a stored run to be resumed. */
export interface StageCheckResumeContext {
  stage: StageKey;
  locale: UiLocale;
  itemsHash: string;
  index: Pick<ReviewItemIndex, 'byId' | 'retired'>;
}

/**
 * What a stored value restores, or null: the check opens on its normal intro. Resumed only when the value is a saved Stage
 * Check of this stage and this UI language, its review-item chunk is the one the plan was made from, it began at most 24
 * hours ago (either way on the clock), every round passes the shape check and its item is still in the index and not
 * retired, and `answers` names each of the plan's rounds at most once (with at least one answer: a run with none has
 * nothing to go on from). Anything else is dropped, not repaired.
 */
export function resumableStageCheck(saved: unknown, now: number, ctx: StageCheckResumeContext): ResumableStageCheck | null {
  if (!isRecord(saved)) return null;
  if (saved.v !== SAVED_CHECK_VERSION || saved.kind !== 'stage') return null;
  if (saved.stage !== ctx.stage || saved.locale !== ctx.locale || saved.itemsHash !== ctx.itemsHash) return null;
  if (!isFreshCheckRun(saved.startedAt, now)) return null;
  if (typeof saved.hideRomanization !== 'boolean') return null;
  const { rounds, answers } = saved;
  if (!Array.isArray(rounds) || rounds.length === 0 || !Array.isArray(answers) || answers.length === 0) return null;
  for (const round of rounds) {
    if (!isReviewRound(round)) return null;
    const id = round.question.itemId;
    if (!ctx.index.byId.has(id) || ctx.index.retired.has(id)) return null;
  }
  const restored = new Map<number, RoundAnswer>();
  for (const entry of answers) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [index, answer] = entry as [unknown, unknown];
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= rounds.length || restored.has(index) || !isRoundAnswer(answer)) return null;
    restored.set(index, { correct: answer.correct, ...(answer.hinted ? { hinted: true } : {}), ...(answer.asked ? { asked: true } : {}) });
  }
  let next = 0;
  while (next < rounds.length && restored.has(next)) next += 1;
  const plan: PlannedStageCheck = { stage: ctx.stage, rounds, soundNotice: rounds.some((r) => r.question.voiceFallback) };
  return { plan, answers: restored, hideRomanization: saved.hideRomanization, startedAt: saved.startedAt as string, next };
}

/**
 * Whether a stored value is a finished Stage Check of `stage` whose clear did not happen (a kill, a removal that failed):
 * a run of this stage, within 24 hours, carrying `finishedAt`, which the finish writes right after the result is in the
 * progress (the entry and the latch). Such a run is not offered again and its finish is not run a second time. It reads
 * the run's own marker, never the stage's merged entry (an equal-stars retake keeps the earlier copy, so the entry's
 * stamp says nothing about this run) and never a clock comparison (a clock set back, or another device's entry syncing
 * in, cannot mark a run finished). A kill between the entry and the marker leaves the run unmarked: it is offered, and its
 * finish writes the entry again (a merge, the earliest latch kept), the only repeat being the complete event.
 */
export function finishedStageCheck(saved: unknown, now: number, stage: StageKey): boolean {
  if (!isRecord(saved) || saved.v !== SAVED_CHECK_VERSION || saved.kind !== 'stage' || saved.stage !== stage) return false;
  return isFreshCheckRun(saved.startedAt, now) && typeof saved.finishedAt === 'string' && Number.isFinite(Date.parse(saved.finishedAt));
}
