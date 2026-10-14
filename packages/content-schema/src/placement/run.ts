import { CATALOG_VERSION } from '../catalog/data';
import type { AssessmentQuestion, AssessmentResponse, Outcome } from '../assessment/question';
import { deadline as deadlineAt, isExpired, isIdle } from '../assessment/clock';
import { placeCorrect } from '../assessment/options';
import { createRng, hashSeed } from '../assessment/rng';
import { selectSpread } from '../assessment/select';
import type { StageKey } from '../schemas/heritage-card';
import type {
  GateResult,
  Motivation,
  PlacementForm,
  PlacementGate,
  PlacementResult,
  PlacementSource,
  PlacementStrand,
} from '../schemas/placement';
import type { UiLocale } from '../schemas/locale';
import { coveredSymbols, placedOutQuestIds, placementStageNumber } from './level-map';
import { nextRung } from './plan';
import { priorityTokensOf, seedRoute, type RouteCatalog } from './route-seed';
import {
  DEEP_REST_AT,
  IDLE_PAUSE_MS,
  LISTEN_FIRST_FORMATS,
  QUESTIONS_PER_RUNG,
  RUNG_TABLE,
  backstopMs,
  drawsFor,
  legacyLengthOf,
  passAtFor,
  questionCap,
  type PlacementMode,
} from './rungs';
import type { PlacementRunState } from './run-state';
import { gateResult, levelOf, oralStageOf, strandStatuses } from './scoring';

export { PlacementRunConfigSchema, PlacementRunStateSchema, type PlacementRunState } from './run-state';

/**
 * The pure run engine (F-PLC-001 section 3.5): start, ask, apply events, finish.
 * Time enters only as `nowMs`; randomness only through `config.seed`. A run
 * never moves the route backwards, writes no completion and grants nothing.
 */

/** What the engine needs of a bank template; P-4's `PlacementTemplateSchema` type satisfies it. */
export interface PlacementTemplateInput {
  id: string;
  /** Not used by the engine; present on the bank's own type. */
  strand?: PlacementStrand;
  glossEn?: string;
  gate: PlacementGate;
  form: PlacementForm;
  question: Omit<AssessmentQuestion, 'id'>;
  status: 'draft' | 'ready';
}
export interface PlacementBankInput {
  version: number;
  templates: readonly PlacementTemplateInput[];
}

export interface PlacementConfig {
  /** short: 6 to 9 questions, no clock; standard: 9 to 24, 10 minutes; deep: 9 to 42, 20 minutes. */
  mode: PlacementMode;
  /**
   * A *Pictures first* learner (`levelOrder` 0): decoding items start from sound
   * and take one tap (`LISTEN_FIRST_FORMATS`) in every mode. Short always runs so.
   */
  listenFirst?: boolean;
  /** Templates carrying any of these tags are not drawn (the warm-up's `word:` tag). */
  avoidTags?: readonly string[];
  revealMode: 'tap' | 'always';
  /** From the warm-up (`playPrompt` result) and `canPlayKorean(getCapability())`. */
  audio: boolean;
  /** False with a screen reader: `recog` is not run. */
  visual: boolean;
  /**
   * Gates not asked in this run, recorded as not-run `unavailable` (section 3.2:
   * `vocab` and `sentence` with a Korean test language and a screen reader on,
   * because Korean picture options carry no text label).
   */
  skipGates?: readonly PlacementGate[];
  /** True: no inactivity pause, no backstop clock. */
  takeMyTime: boolean;
  /** `hashSeed([profileId, startedAt])`. */
  seed: number;
  /** Template ids of the previous result. */
  exclude: string[];
  resolvesPicture: (ref: string) => boolean;
}

export type PlacementEvent =
  | { type: 'answer'; optionId: string; assisted?: boolean }
  /**
   * "I am not sure". With `cause: 'no-sound'` the caller records a prompt that
   * could not play (section 3.11): skipped, not wrong, and not a "not sure" of
   * the learner, so it neither adds to nor breaks the three-in-a-row streak.
   */
  | { type: 'notSure'; cause?: 'no-sound' }
  /** The caller's own 45-second inactivity timer fired. */
  | { type: 'idle' }
  /** The caller's periodic check of both clocks. */
  | { type: 'tick' }
  /** Any touch that is not an answer (hear it again, ...): resets the inactivity clock. */
  | { type: 'touch' }
  /** The learner opened the exit sheet: a pause, so the backstop does not run while it is open. */
  | { type: 'exit' }
  | { type: 'quit'; by: 'learner' | 'grown-up' }
  | { type: 'keepGoing' };

const MAX_MS = 600_000;
const NOT_SURE_LIMIT = 3;
/**
 * Silent prompts in a row that open the sound pause (section 3.11): one in
 * Short or a listen-first run (every question there is heard, so a run without
 * sound must not go on), two in Standard and Deep.
 */
export const NO_SOUND_LIMIT = { listenFirst: 1, other: 2 } as const;
const trailingNoSound = (responses: readonly AssessmentResponse[]): number => {
  let count = 0;
  for (let i = responses.length - 1; i >= 0 && responses[i]?.noSound === true; i -= 1) count += 1;
  return count;
};
const clampMs = (ms: number): number => Math.min(MAX_MS, Math.max(0, Math.round(ms)));

const drawKey = (gate: PlacementGate, form: PlacementForm, draw?: 2): string =>
  `${gate}:${form}${draw === 2 ? ':2' : ''}`;

/** One key per look-alike pair, symbol, syllable or word, so a draw spreads before it repeats. */
const spreadKey = (template: PlacementTemplateInput): string => {
  const tags = template.question.tags;
  const named = tags.find((tag) => tag.startsWith('syl:') || tag.startsWith('word:'));
  if (named !== undefined) return named;
  const symbols = tags.filter((tag) => tag.startsWith('sym:')).sort();
  return symbols.length > 0 ? symbols.join('|') : template.id;
};

const listenFirst = (config: Pick<PlacementConfig, 'mode' | 'listenFirst'>): boolean =>
  config.mode === 'short' || config.listenFirst === true;

const usable = (template: PlacementTemplateInput, config: PlacementConfig): boolean => {
  const { requires, leaks, options, format, tags } = template.question;
  if (requires.audio && !config.audio) return false;
  if (leaks && config.revealMode === 'always') return false;
  if (listenFirst(config) && !LISTEN_FIRST_FORMATS.includes(format)) return false;
  if (config.avoidTags !== undefined && tags.some((tag) => config.avoidTags?.includes(tag))) return false;
  if (requires.picture === null) return true;
  return options.every((o) => o.pictureRef === undefined || config.resolvesPicture(o.pictureRef));
};

/** The first draw of a rung, which a confirming second draw avoids. */
interface FirstDraw {
  ids: readonly string[];
  keys: ReadonlySet<string>;
}

/**
 * Three questions for a rung, or null when fewer than three are eligible. The
 * rung has its own generator, so a draw does not depend on the path taken. A
 * confirming second draw (`first` given) has its own seed, never repeats a
 * template of the first draw, and prefers symbols, syllables and words the
 * first draw did not touch; a second `syl-*` draw holds one tile item when one
 * is eligible.
 */
const drawRung = (
  bank: PlacementBankInput,
  config: PlacementConfig,
  gate: PlacementGate,
  form: PlacementForm,
  first?: FirstDraw,
): AssessmentQuestion[] | null => {
  if (form === 'oral' && !config.audio) return null;
  if (gate === 'recog' && !config.visual) return null;
  if (config.skipGates?.includes(gate) === true) return null;
  const eligible = bank.templates.filter(
    (t) => t.status === 'ready' && t.gate === gate && t.form === form && usable(t, config),
  );
  const rng = createRng(hashSeed(first === undefined ? [String(config.seed), gate, form] : [String(config.seed), gate, form, '2']));
  const pick = (count: number, exclude: readonly string[], filter?: (t: PlacementTemplateInput) => boolean) =>
    selectSpread({ candidates: eligible, count, rng, exclude, spreadBy: spreadKey, ...(filter ? { filter } : {}) });
  const isReply = (t: PlacementTemplateInput): boolean => t.question.format === 'reply-pick';

  const isBuild = (t: PlacementTemplateInput): boolean => t.question.format === 'build-syllable';
  const fresh = (t: PlacementTemplateInput): boolean => first === undefined || !first.keys.has(spreadKey(t));

  const chooseOnce = (exclude: readonly string[]): PlacementTemplateInput[] => {
    if (first !== undefined && (gate === 'syl-cv' || gate === 'syl-cvc')) {
      const tile = pick(1, exclude, (t) => isBuild(t) && fresh(t));
      const taken = [...exclude, ...tile.map((t) => t.id)];
      const rest = pick(QUESTIONS_PER_RUNG - tile.length, taken, (t) => !isBuild(t) && fresh(t));
      return [...tile, ...rest];
    }
    if (gate !== 'sentence' || form !== 'read') return pick(QUESTIONS_PER_RUNG, exclude, fresh);
    // Two read-pick-picture and one reply-pick; a short side is topped up from what is left.
    const chosen = [...pick(2, exclude, (t) => !isReply(t) && fresh(t)), ...pick(1, exclude, (t) => isReply(t) && fresh(t))];
    const taken = [...exclude, ...chosen.map((t) => t.id)];
    return [...chosen, ...pick(QUESTIONS_PER_RUNG - chosen.length, taken, fresh)];
  };
  // Fresh symbols first; then any template not in the first draw (a soft preference, never a reason to skip).
  const choose = (exclude: readonly string[]): PlacementTemplateInput[] => {
    const own = [...exclude, ...(first?.ids ?? [])];
    const preferred = chooseOnce(own);
    if (preferred.length >= QUESTIONS_PER_RUNG || first === undefined) return preferred;
    const taken = [...own, ...preferred.map((t) => t.id)];
    return [...preferred, ...pick(QUESTIONS_PER_RUNG - preferred.length, taken)];
  };
  let chosen = choose(config.exclude);
  // The previous result's ids are relaxed when the rung would otherwise be short (a retake may repeat items).
  if (chosen.length < QUESTIONS_PER_RUNG && config.exclude.length > 0) chosen = choose([]);
  if (chosen.length < QUESTIONS_PER_RUNG) return null;

  const recent: number[] = [];
  return chosen.map((t) => {
    const options = placeCorrect(t.question.options, rng, false, recent);
    recent.push(options.findIndex((o) => o.isCorrect));
    return { ...t.question, id: t.id, options };
  });
};

const finish = (state: PlacementRunState, reason: NonNullable<PlacementRunState['stop']>): PlacementRunState => ({
  ...state,
  stop: reason,
  draws: {},
  pause: null,
  pausedAtMs: null,
});

/** Moves to the next rung that can be asked, recording the ones that cannot as not-run; or ends the run. */
const advance = (from: PlacementRunState): PlacementRunState => {
  let state = from;
  for (;;) {
    const step = nextRung({ mode: state.config.mode, done: state.done });
    if (step === null) {
      const cap = questionCap(state.config.mode);
      const full = cap !== null && state.responses.length >= cap;
      return { ...finish(state, full ? 'cap' : 'complete'), current: null };
    }
    const key = drawKey(step.gate, step.form, step.draw);
    const questions = state.draws[key];
    if (questions === undefined) {
      const skipped: GateResult = {
        gate: step.gate,
        form: step.form,
        asked: 0,
        correct: 0,
        assisted: 0,
        result: 'not-run',
        reason: 'unavailable',
      };
      state = { ...state, done: [...state.done, skipped] };
      continue;
    }
    const draws = { ...state.draws };
    delete draws[key];
    return { ...state, draws, current: { gate: step.gate, form: step.form, questions, start: state.responses.length } };
  }
};

export const startRun = (bank: PlacementBankInput, config: PlacementConfig, nowMs: number): PlacementRunState => {
  const draws: PlacementRunState['draws'] = {};
  for (const spec of RUNG_TABLE) {
    for (const form of spec.forms) {
      const questions = drawRung(bank, config, spec.gate, form);
      if (questions === null) continue;
      draws[drawKey(spec.gate, form)] = questions;
      if (drawsFor(config.mode, spec.gate, form) === 2) {
        const keys = new Set(
          questions.map((q) => spreadKey(bank.templates.find((t) => t.id === q.id) as PlacementTemplateInput)),
        );
        const second = drawRung(bank, config, spec.gate, form, { ids: questions.map((q) => q.id), keys });
        if (second !== null) draws[drawKey(spec.gate, form, 2)] = second;
      }
    }
  }
  return advance({
    version: 1,
    bankVersion: bank.version,
    config: {
      mode: config.mode,
      listenFirst: listenFirst(config),
      revealMode: config.revealMode,
      audio: config.audio,
      visual: config.visual,
      takeMyTime: config.takeMyTime,
      seed: config.seed,
      exclude: [...config.exclude],
    },
    startedAtMs: nowMs,
    deadlineMs: deadlineAt(nowMs, backstopMs(config.mode, config.takeMyTime)),
    lastTouchMs: nowMs,
    shownAtMs: nowMs,
    pause: null,
    pausedAtMs: null,
    timeUp: false,
    draws,
    done: [],
    current: null,
    responses: [],
    tags: {},
    notSureStreak: 0,
    rested: false,
    stop: null,
  });
};

export const isFinished = (state: PlacementRunState): boolean => state.stop !== null;

/** The open question (the same one while paused), or null once the run is finished. */
export const currentQuestion = (state: PlacementRunState): AssessmentQuestion | null => {
  if (state.current === null) return null;
  return state.current.questions[state.responses.length - state.current.start] as AssessmentQuestion;
};

const record = (
  state: PlacementRunState,
  outcome: Outcome,
  chosenOptionId: string | null,
  assisted: boolean,
  nowMs: number,
  noSound = false,
): PlacementRunState => {
  const rung = state.current as NonNullable<PlacementRunState['current']>;
  const question = currentQuestion(state) as AssessmentQuestion;
  const response: AssessmentResponse = {
    questionId: question.id,
    outcome,
    chosenOptionId,
    assisted,
    ms: clampMs(nowMs - state.shownAtMs),
    ...(noSound ? { noSound: true as const } : {}),
  };
  let next: PlacementRunState = {
    ...state,
    responses: [...state.responses, response],
    tags: { ...state.tags, [question.id]: question.tags },
    notSureStreak: noSound ? state.notSureStreak : outcome === 'skipped' ? state.notSureStreak + 1 : 0,
    lastTouchMs: nowMs,
    shownAtMs: nowMs,
  };
  const inRung = next.responses.slice(rung.start);
  if (inRung.length === QUESTIONS_PER_RUNG) {
    const scored = gateResult(inRung, inRung.length, passAtFor(state.config.mode, rung.gate));
    const finished: GateResult = {
      gate: rung.gate,
      form: rung.form,
      ...scored,
      // Only prompts that could not play leave a whole rung undecided.
      ...(scored.result === 'not-run' ? { reason: 'unavailable' as const } : {}),
    };
    next = advance({ ...next, current: null, done: [...next.done, finished] });
  }
  if (next.stop !== null) return next;
  // Time never marks anything wrong: the answer just given stands, then the run ends.
  if (next.timeUp || isExpired(nowMs, next.deadlineMs)) return finish(next, 'time');
  // Sound stopped mid-run: pause with "Try again" instead of skipping every heard question to the end.
  const silentLimit = state.config.listenFirst ? NO_SOUND_LIMIT.listenFirst : NO_SOUND_LIMIT.other;
  if (noSound && trailingNoSound(next.responses) >= silentLimit) return { ...next, pause: 'no-sound', pausedAtMs: nowMs };
  // Short has no "three not sure" sheet: it is at most nine questions and the exit stays visible.
  if (state.config.mode !== 'short' && next.notSureStreak >= NOT_SURE_LIMIT) return { ...next, pause: 'not-sure', pausedAtMs: nowMs };
  // Deep: one spoken, number-free rest card after 18 answers, between two rungs, when more remain.
  // When the "not sure" sheet took that moment, the card waits for the next rung.
  if (
    state.config.mode === 'deep' &&
    !next.rested &&
    next.responses.length >= DEEP_REST_AT &&
    next.current?.start === next.responses.length
  ) {
    return { ...next, pause: 'rest', pausedAtMs: nowMs, rested: true };
  }
  return next;
};

export const apply = (state: PlacementRunState, event: PlacementEvent, nowMs: number): PlacementRunState => {
  if (state.stop !== null) return state;

  if (event.type === 'quit') {
    if (event.by === 'grown-up') return finish(state, 'grown-up');
    return finish(state, state.pause === 'not-sure' ? 'not-sure' : 'quit');
  }
  if (event.type === 'touch') return { ...state, lastTouchMs: nowMs };
  if (event.type === 'exit') return state.pause === null ? { ...state, pause: 'exit', pausedAtMs: nowMs } : state;
  if (event.type === 'keepGoing') {
    if (state.pause === null) return state;
    const waited = Math.max(0, nowMs - (state.pausedAtMs as number));
    return {
      ...state,
      pause: null,
      pausedAtMs: null,
      notSureStreak: state.pause === 'not-sure' ? 0 : state.notSureStreak,
      // The backstop is for runaway sessions: stepping away does not use it up.
      deadlineMs: state.deadlineMs === null ? null : state.deadlineMs + waited,
      lastTouchMs: nowMs,
      shownAtMs: nowMs,
    };
  }
  if (event.type === 'idle') {
    if (state.config.takeMyTime || state.pause !== null) return state;
    return { ...state, pause: 'idle', pausedAtMs: nowMs };
  }
  if (event.type === 'tick') {
    if (state.pause !== null) return state;
    const idleMs = state.config.takeMyTime ? null : IDLE_PAUSE_MS;
    if (isIdle(nowMs, state.lastTouchMs, idleMs)) {
      return { ...state, pause: 'idle', pausedAtMs: state.lastTouchMs + IDLE_PAUSE_MS };
    }
    if (!state.timeUp && isExpired(nowMs, state.deadlineMs)) return { ...state, timeUp: true };
    return state;
  }

  // answer | notSure
  if (state.pause !== null) return state;
  if (event.type === 'notSure') return record(state, 'skipped', null, false, nowMs, event.cause === 'no-sound');
  const question = currentQuestion(state) as AssessmentQuestion;
  const chosen = question.options.find((o) => o.id === event.optionId);
  if (chosen === undefined) throw new Error(`option ${event.optionId} is not an option of question ${question.id}`);
  return record(state, chosen.isCorrect ? 'correct' : 'wrong', chosen.id, event.assisted === true, nowMs);
};

export interface FinishContext {
  catalog: RouteCatalog;
  isEntitled: (stage: StageKey) => boolean;
  completedQuestIds: ReadonlySet<string>;
  /** ISO timestamp; the engine reads no clock. */
  completedAt: string;
  motivation?: Motivation;
  contentVer: string;
  testLocale: UiLocale;
  source: PlacementSource;
}

/**
 * The stored result of a finished run. A rung cut short keeps what was asked
 * (`not-run`, reason `stopped`, when still undecided). The start quest and
 * `needsStage` come from `seedRoute`, so the result and the route always agree.
 */
export const finishRun = (state: PlacementRunState, ctx: FinishContext): PlacementResult => {
  if (state.stop === null) throw new Error('the run has not finished');
  const gates: GateResult[] = [...state.done];
  const open = state.current;
  if (open !== null && state.responses.length > open.start) {
    const asked = state.responses.slice(open.start);
    const partial = gateResult(asked, asked.length, passAtFor(state.config.mode, open.gate));
    gates.push({
      gate: open.gate,
      form: open.form,
      ...partial,
      ...(partial.result === 'not-run' ? { reason: 'stopped' as const } : {}),
    });
  }
  // Every response was recorded with the tags of its question.
  const tagsOf = (questionId: string): readonly string[] => state.tags[questionId] as readonly string[];
  const level = levelOf(gates);
  const covered = coveredSymbols({ gates, responses: state.responses }, tagsOf);
  const base: PlacementResult = {
    id: `placement:${state.config.seed.toString(36)}`,
    startedAt: new Date(state.startedAtMs).toISOString(),
    completedAt: ctx.completedAt,
    source: ctx.source,
    testLocale: ctx.testLocale,
    length: legacyLengthOf(state.config.mode),
    mode: state.config.mode,
    revealMode: state.config.revealMode,
    bankVersion: state.bankVersion,
    contentVer: ctx.contentVer,
    ...(ctx.motivation === undefined ? {} : { motivation: ctx.motivation }),
    responses: state.responses,
    gates,
    strands: strandStatuses(gates),
    level,
    oralStage: oralStageOf(gates),
    beyondContent: placementStageNumber(level.stage) >= 3,
    startQuestId: null,
    placedOutQuestIds: placedOutQuestIds(level, covered, ctx.catalog),
    catalogVersion: CATALOG_VERSION,
    priorityTokens: priorityTokensOf(gates, state.responses, tagsOf),
    needsStage: null,
    stopReason: state.stop,
  };
  const seed = seedRoute(base, ctx.catalog, { isEntitled: ctx.isEntitled, completedQuestIds: ctx.completedQuestIds });
  return { ...base, startQuestId: seed.startQuestId, needsStage: seed.needsStage };
};
