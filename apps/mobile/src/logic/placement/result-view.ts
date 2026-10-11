import {
  RUNG_TABLE,
  StageKeySchema,
  gatePassed,
  inRouteOrder,
  modeOf,
  rowsPassed,
  type ASSESSMENT_FORMATS,
  type GateResult,
  type PlacementForm,
  type PlacementGate,
  type PlacementLevel,
  type PlacementResult,
  type PlacementStrand,
  type RouteCatalog,
  type RouteSeed,
  type StageKey,
  type StrandStatus,
} from '@hangul-route/content-schema';

/**
 * View models for the level check's result screen and the grown-up report
 * (F-PLC-001 sections 3.1 step 7 and 3.9, wireframe placement G and J). They
 * name message keys and ids, never prose, so the screens stay in the UI
 * language. The learner side shows no number at all; the report frames
 * counts as growth for Short and Standard and shows status words for Deep.
 */

type StoredResult = Omit<PlacementResult, 'mode'> & { mode?: PlacementResult['mode'] };

/**
 * The Short hint (section 3.9): a Short run with `sound-basic` passed and a
 * `syl-cv` row of at least 2 correct (band 1, or band 0 held only by the
 * 3-of-3 rule). The standard check could then find a later start.
 */
export function shortHintFires(result: StoredResult): boolean {
  if (modeOf(result) !== 'short') return false;
  if (!gatePassed(result.gates, 'sound-basic', 'decode')) return false;
  return result.gates.some((g) => g.gate === 'syl-cv' && g.form === 'decode' && g.correct >= 2);
}

/**
 * Reading was not measured because the sound guide was shown (section 3.1
 * step 7, OD-1 (c)): the decoding strands are not tested and the run used
 * `revealMode: 'always'`. A run that only stopped early keeps the normal
 * headline (the report lists "ended early"), because "try the check with the
 * sound guide hidden" would be false for it.
 */
export function decodingNotTested(result: StoredResult): boolean {
  return (
    result.revealMode === 'always' &&
    result.strands['sound-letter'] === 'not-tested' &&
    result.strands['syllable-reading'] === 'not-tested'
  );
}

export interface ResultViewInput {
  /** The run just finished. */
  result: StoredResult;
  /** The effective route before this result; null on a first check. */
  before: RouteSeed | null;
  /** The effective route including this result. */
  after: RouteSeed;
  catalog: RouteCatalog;
  completedQuestIds: ReadonlySet<string>;
  /** `effectiveLearnerType(profile)`. */
  profileType: 'self' | 'child';
  /** `flags.routeEnabled` (F-PLAN-002 P2-7a). */
  routeEnabled: boolean;
  /** `flags.myRouteEnabled` (F-ROUTE-001): "See my route", else "See the whole map". */
  myRouteEnabled: boolean;
  /** `proposeRoute` returned a proposal. */
  proposalAvailable: boolean;
  /** `route-ui:<profileId>.dismissedAt` is in force. */
  planPromptDismissed: boolean;
  /** The profile has an active self plan. */
  hasActivePlan: boolean;
  /** A reviewed shelf story exists (the "You know a lot!" destination). */
  hasReviewedShelfStory: boolean;
  /** Device-level (a PIN or a child on the device): never changes what shows, only whether "For grown-ups" needs the PIN. */
  gateRequired: boolean;
}

export type ResultPrimary = 'usePlan' | 'updatePlan' | 'start' | 'openStories' | 'seeMap';
export type ResultLink = 'seeMyRoute' | 'seeMap' | 'forGrownUps' | 'forGrownUpsPlan' | 'tryStandard';

export interface ResultView {
  /** `learner.placement.result.<headline>`. */
  headline: 'found' | 'goodPlace' | 'knowALot';
  /** "We checked listening and shapes. ..." under the good-place headline. */
  notTestedLine: boolean;
  /** The one-tap retake with the sound guide hidden (self profiles only). */
  retryHidden: boolean;
  /** Shown as the stage title and the band label. */
  level: PlacementLevel;
  cards: { startHere: string | null; next: string[]; laterStage: StageKey | null };
  /** A retake that changed nothing. */
  routeLine: 'routeStays' | 'planStays' | null;
  /** A retake that raised the start with an active self plan: "Hoya found a later place to start." */
  planUpdate: boolean;
  /** The weekly-plan strip. */
  strip: boolean;
  /** The one primary button. */
  primary: ResultPrimary;
  /** "Just start" under the strip, or the ghost "Keep my plan". */
  secondary: 'justStart' | 'keepPlan' | null;
  links: ResultLink[];
  grownUpsNeedsPin: boolean;
}

/** The route is the start quest and the placed-out set; a level that rises alone does not move it. */
const sameRoute = (a: RouteSeed, b: RouteSeed): boolean => {
  const set = new Set(a.placedOutQuestIds);
  return (
    a.startQuestId === b.startQuestId &&
    a.placedOutQuestIds.length === b.placedOutQuestIds.length &&
    b.placedOutQuestIds.every((id) => set.has(id))
  );
};

function routeCards(input: ResultViewInput): ResultView['cards'] {
  const start = input.after.startQuestId;
  if (start === null) return { startHere: null, next: [], laterStage: null };
  const placedOut = new Set(input.after.placedOutQuestIds);
  const route = inRouteOrder(input.catalog).filter((quest) => quest.grid && quest.playable);
  const at = route.findIndex((quest) => quest.id === start);
  const next = route
    .slice(at + 1)
    .filter((quest) => !placedOut.has(quest.id) && !input.completedQuestIds.has(quest.id))
    .slice(0, 2)
    .map((quest) => quest.id);
  const stages = StageKeySchema.options as readonly StageKey[];
  const startStage = route[at]?.stage;
  const startRank = startStage === undefined ? -1 : stages.indexOf(startStage);
  const laterStage = route.map((quest) => quest.stage).find((stage) => stages.indexOf(stage) > startRank) ?? null;
  return { startHere: start, next, laterStage };
}

export function resultView(input: ResultViewInput): ResultView {
  const self = input.profileType === 'self';
  const retake = input.before !== null;
  const unchanged = input.before !== null && sameRoute(input.before, input.after);
  const noStart = input.after.startQuestId === null;
  const notTested = decodingNotTested(input.result);
  // "Hoya found a later place to start": only when the start itself moved to a quest.
  const startMoved = input.before !== null && !noStart && input.after.startQuestId !== input.before.startQuestId;
  const planUpdate = retake && startMoved && self && input.hasActivePlan;
  const strip =
    input.routeEnabled &&
    self &&
    input.proposalAvailable &&
    !input.planPromptDismissed &&
    !input.hasActivePlan &&
    !unchanged &&
    !noStart;

  let primary: ResultPrimary = 'start';
  let secondary: ResultView['secondary'] = null;
  if (planUpdate) {
    primary = 'updatePlan';
    secondary = 'keepPlan';
  } else if (strip) {
    primary = 'usePlan';
    secondary = 'justStart';
  } else if (noStart) {
    primary = input.hasReviewedShelfStory ? 'openStories' : 'seeMap';
  }

  const links: ResultLink[] = [];
  const routeLink: ResultLink = input.myRouteEnabled ? 'seeMyRoute' : 'seeMap';
  if (routeLink !== primary) links.push(routeLink);
  const childPlan = !self && input.routeEnabled && input.proposalAvailable;
  links.push(childPlan ? 'forGrownUpsPlan' : 'forGrownUps');
  if (self && shortHintFires(input.result)) links.push('tryStandard');

  return {
    headline: noStart ? 'knowALot' : notTested ? 'goodPlace' : 'found',
    notTestedLine: notTested && !noStart,
    retryHidden: notTested && !noStart && self,
    level: input.after.level,
    cards: routeCards(input),
    routeLine: unchanged ? (input.hasActivePlan ? 'planStays' : 'routeStays') : null,
    planUpdate,
    strip,
    primary,
    secondary,
    links,
    grownUpsNeedsPin: input.gateRequired,
  };
}

// ---------------------------------------------------------------------------
// The grown-up report (section 3.9)
// ---------------------------------------------------------------------------

export type ReportStrandStatus = StrandStatus | 'not-tested-short';
export type NotTestedReason = 'noSound' | 'soundGuide' | 'screenReader' | 'screenReaderPictures' | 'endedEarly';
export type AssessmentFormat = (typeof ASSESSMENT_FORMATS)[number];

export interface ReportRung {
  gate: PlacementGate;
  form: PlacementForm;
  status: StrandStatus;
  /**
   * Per row that was asked: correct out of asked ("3 of 3", "1 of 1"), Short
   * and Standard only; a row never asked (a draw that was unavailable) is left
   * out. Null for Deep and untested rungs.
   */
  counts: { correct: number; asked: number }[] | null;
  /** Deep: both draws ran ("checked twice"), or the confirming draw was stopped. Any mode: a row stopped before it was decided. */
  note: 'checkedTwice' | 'notFinished' | null;
}

export interface ReportView {
  strands: { strand: PlacementStrand; status: ReportStrandStatus }[];
  notTested: NotTestedReason[];
  /** "Shapes of letters and sentences are not part of the short check." */
  shortNotTested: boolean;
  rungs: ReportRung[];
  /** Spelling with tiles (build-syllable responses); null when none was asked. Never a strand, never the route. */
  spellingTiles: StrandStatus | null;
  shortHint: boolean;
}

const STRANDS: readonly PlacementStrand[] = ['hangul-recognition', 'sound-letter', 'syllable-reading', 'vocabulary', 'sentences'];
const SHORT_NOT_ASKED: readonly PlacementStrand[] = ['hangul-recognition', 'sentences'];

function rungStatus(rows: readonly GateResult[]): StrandStatus {
  if (rowsPassed(rows)) return 'secure';
  if (rows.every((r) => r.asked === 0)) return 'not-tested';
  return rows.some((r) => r.correct > 0) ? 'getting-there' : 'not-yet';
}

function deepNote(rows: readonly GateResult[]): ReportRung['note'] {
  if (rows[1]?.reason === 'stopped') return 'notFinished';
  return rows.length === 2 && rows.every((r) => r.asked > 0) ? 'checkedTwice' : null;
}

const stoppedNote = (rows: readonly GateResult[]): ReportRung['note'] =>
  rows.some((r) => r.reason === 'stopped') ? 'notFinished' : null;

/** Rows grouped by gate/form in rung order; a Deep result without `mode` renders like Standard. */
function reportRungs(result: StoredResult): ReportRung[] {
  const deep = modeOf(result) === 'deep';
  return RUNG_TABLE.flatMap((spec) =>
    spec.forms.flatMap((form): ReportRung[] => {
      const rows = result.gates.filter((g) => g.gate === spec.gate && g.form === form);
      if (rows.length === 0) return [];
      const status = rungStatus(rows);
      return [
        {
          gate: spec.gate,
          form,
          status,
          counts:
            deep || status === 'not-tested'
              ? null
              : rows.filter((r) => r.asked > 0).map((r) => ({ correct: r.correct, asked: r.asked })),
          note: deep ? deepNote(rows) : stoppedNote(rows),
        },
      ];
    }),
  );
}

/**
 * Why parts were not tested. "A screen reader was on" is read from the
 * recognition rung recorded as unavailable: its templates need no sound and no
 * picture and never leak (pinned by `content/__tests__/placement-bank.test.ts`),
 * so `visual: false` is the only way it is unavailable. A run that stopped
 * before that rung has no recognition row and says nothing about it.
 */
function notTestedReasons(result: StoredResult): NotTestedReason[] {
  const recog = result.gates.filter((g) => g.gate === 'recog');
  const screenReader = modeOf(result) !== 'short' && recog.length > 0 && recog.every((g) => g.reason === 'unavailable');
  // Section 3.2: Korean picture options carry no text label, so the vocabulary
  // and sentence rungs (read and oral alike) were left out; their oral rows
  // then say nothing about sound.
  const pictureRows = result.gates.filter((g) => g.gate === 'vocab' || g.gate === 'sentence');
  const pictures =
    screenReader &&
    result.testLocale === 'ko' &&
    pictureRows.length > 0 &&
    pictureRows.every((g) => g.reason === 'unavailable');
  const out: NotTestedReason[] = [];
  if (!pictures && result.gates.some((g) => g.form === 'oral' && g.reason === 'unavailable')) out.push('noSound');
  if (result.revealMode === 'always') out.push('soundGuide');
  if (screenReader) out.push('screenReader');
  if (pictures) out.push('screenReaderPictures');
  if (result.stopReason !== 'complete' && result.stopReason !== 'cap') out.push('endedEarly');
  return out;
}

function spellingTiles(result: StoredResult, formatOf: (questionId: string) => AssessmentFormat | undefined): StrandStatus | null {
  const tiles = result.responses.filter((r) => formatOf(r.questionId) === 'build-syllable');
  if (tiles.length === 0) return null;
  const correct = tiles.filter((r) => r.outcome === 'correct' && !r.assisted).length;
  if (correct === tiles.length) return 'secure';
  return correct > 0 ? 'getting-there' : 'not-yet';
}

/**
 * The report's rows. `formatOf` looks a response id up in the bank
 * (`placement.generated.ts`); an id not in the bank is skipped.
 */
export function reportView(result: StoredResult, formatOf: (questionId: string) => AssessmentFormat | undefined): ReportView {
  const short = modeOf(result) === 'short';
  return {
    strands: STRANDS.map((strand) => {
      const status = result.strands[strand];
      return { strand, status: short && status === 'not-tested' && SHORT_NOT_ASKED.includes(strand) ? 'not-tested-short' : status };
    }),
    notTested: notTestedReasons(result),
    shortNotTested: short,
    rungs: reportRungs(result),
    spellingTiles: spellingTiles(result, formatOf),
    shortHint: shortHintFires(result),
  };
}
