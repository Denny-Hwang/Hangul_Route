import {
  effectiveRoute,
  inRouteOrder,
  modeOf,
  placementStageNumber,
  type PlacementGate,
  type PlacementLevel,
  type PlacementResult,
  type RouteCatalog,
  type RouteSeed,
  type StageKey,
  type UiLocale,
} from '@hangul-route/content-schema';
import { decodingNotTested, reportView, type AssessmentFormat, type ReportView } from './result-view';

/**
 * The grown-up report page and the dashboard's Starting spot row (F-PLC-001
 * section 3.9, wireframe placement/report, W-8). Pure: the screen paints what
 * these return and names the words from `caregiver.placementReport`. "What we
 * saw" reads the newest result; "Where the route starts" reads the route in
 * force (`effectiveRoute`: the union of every result, the highest level, a
 * parent override), so a lower retake never moves the start back.
 */

type StoredResult = Omit<PlacementResult, 'mode'> & { mode?: PlacementResult['mode'] };

/** One bank template as the report needs it (`placement.generated.ts`). */
export interface BankEntry {
  format: AssessmentFormat;
  gate: PlacementGate;
  tags: readonly string[];
}
/** Looks a response id up in the bank; an id not in the bank is skipped. */
export type BankLookup = (questionId: string) => BankEntry | undefined;

/** Symbol keys (`'ㄱ'`, `'ㄴ/final'`): the screen draws each with `KoreanText`. */
export interface StrandExample {
  known: string[];
  fresh: string[];
}
export type ExampleStrand = 'sound-letter' | 'syllable-reading';
export type StrandExamples = Partial<Record<ExampleStrand, StrandExample>>;

const STRAND_OF_GATE: Partial<Record<PlacementGate, ExampleStrand>> = {
  'sound-basic': 'sound-letter',
  'sound-rest': 'sound-letter',
  'syl-cv': 'syllable-reading',
  'syl-cvc': 'syllable-reading',
};
const MAX_EXAMPLE_SYMBOLS = 6;

/**
 * "Knows the sounds of ㅏ ㅓ ㄱ ㄴ; ㅕ ㅠ are new" (section 3.9). A symbol is
 * known when every answer on a template tagged with it was right without the
 * sound guide, and new when one was wrong, "not sure" or revealed (the
 * covered-symbol rule of section 3.6). A prompt that could not play is no
 * evidence either way (section 3.11).
 */
export function strandExamples(result: StoredResult, lookup: BankLookup): StrandExamples {
  const seen: Record<ExampleStrand, Map<string, boolean>> = { 'sound-letter': new Map(), 'syllable-reading': new Map() };
  for (const response of result.responses) {
    if (response.noSound === true) continue;
    const entry = lookup(response.questionId);
    const strand = entry === undefined ? undefined : STRAND_OF_GATE[entry.gate];
    if (entry === undefined || strand === undefined) continue;
    const right = response.outcome === 'correct' && !response.assisted;
    for (const tag of entry.tags) {
      if (!tag.startsWith('sym:')) continue;
      const symbol = tag.slice('sym:'.length);
      seen[strand].set(symbol, (seen[strand].get(symbol) ?? true) && right);
    }
  }
  const out: StrandExamples = {};
  for (const strand of ['sound-letter', 'syllable-reading'] as const) {
    const entries = [...seen[strand].entries()];
    if (entries.length === 0) continue;
    out[strand] = {
      known: entries.filter(([, right]) => right).map(([symbol]) => symbol).slice(0, MAX_EXAMPLE_SYMBOLS),
      fresh: entries.filter(([, right]) => !right).map(([symbol]) => symbol).slice(0, MAX_EXAMPLE_SYMBOLS),
    };
  }
  return out;
}

export type StartChoiceState = 'start' | 'done' | 'placedOut' | 'ahead';
export interface StartChoice {
  questId: string;
  state: StartChoiceState;
}

/**
 * The learner's quests in order for "Choose a different start": every
 * playable grid quest of a stage the account includes (the start can never
 * be anywhere else), with its state on the route in force.
 */
export function startChoices(
  seed: RouteSeed,
  catalog: RouteCatalog,
  completedQuestIds: ReadonlySet<string>,
  isEntitled: (stage: StageKey) => boolean,
): StartChoice[] {
  const placedOut = new Set(seed.placedOutQuestIds);
  return inRouteOrder(catalog)
    .filter((quest) => quest.grid && quest.playable && isEntitled(quest.stage))
    .map((quest) => ({
      questId: quest.id,
      state:
        quest.id === seed.startQuestId
          ? 'start'
          : completedQuestIds.has(quest.id)
            ? 'done'
            : placedOut.has(quest.id)
              ? 'placedOut'
              : 'ahead',
    }));
}

const byCompletedAt = (a: StoredResult, b: StoredResult): number =>
  a.completedAt < b.completedAt ? -1 : a.completedAt > b.completedAt ? 1 : 0;
const rank = (level: PlacementLevel): number => placementStageNumber(level.stage) * 10 + level.band;

export interface StartingSpotRow {
  /** The highest level reached (results combine by the maximum, section 3.7). */
  level: PlacementLevel;
  /** When the newest check was taken. */
  takenAt: string;
  /** A parent override is in force ("Changed by a grown-up"). */
  overridden: boolean;
}

/** The dashboard's Starting spot row; null without a result. */
export function startingSpotRow(placements: readonly StoredResult[] | undefined): StartingSpotRow | null {
  if (placements === undefined || placements.length === 0) return null;
  const sorted = [...placements].sort(byCompletedAt);
  const level = sorted.map((r) => r.level).reduce((a, b) => (rank(b) > rank(a) ? b : a));
  return {
    level,
    takenAt: (sorted[sorted.length - 1] as StoredResult).completedAt,
    overridden: placements.some((r) => r.override !== undefined),
  };
}

export interface ReportPageInput {
  /** `snapshot.placements` (a missing key is `[]`). */
  placements: readonly StoredResult[];
  catalog: RouteCatalog;
  completedQuestIds: ReadonlySet<string>;
  isEntitled: (stage: StageKey) => boolean;
  /** `effectiveLearnerType(profile)`: decides where the retake offers live. */
  profileType: 'self' | 'child';
  lookup: BankLookup;
}

export interface ReportPageView {
  kind: 'report';
  /** The newest result: an override is stored on it. */
  resultId: string;
  takenAt: string;
  /** The language of the check. */
  testLocale: UiLocale;
  /** The route's level (stage title and band label). */
  level: PlacementLevel;
  view: ReportView;
  examples: StrandExamples;
  startQuestId: string | null;
  needsStage: StageKey | null;
  beyondContent: boolean;
  overridden: boolean;
  /**
   * "Try it with the sound guide hidden" when reading was not tested: on a
   * child profile the offer lives here, never on the learner's result screen
   * (section 3.1 step 7, AM-23); a self profile has it on the result.
   */
  retakeHidden: { mode: 'standard' | 'deep' } | null;
  /** "The short check looks at the first letters only..." with Try the standard check (any profile). */
  shortHint: boolean;
  choices: StartChoice[];
}

export type ReportPage = { kind: 'empty' } | ReportPageView;

export function reportPage(input: ReportPageInput): ReportPage {
  if (input.placements.length === 0) return { kind: 'empty' };
  const sorted = [...input.placements].sort(byCompletedAt);
  const newest = sorted[sorted.length - 1] as StoredResult;
  const opts = { isEntitled: input.isEntitled, completedQuestIds: input.completedQuestIds };
  const seed = effectiveRoute(sorted as readonly PlacementResult[], input.catalog, opts) as RouteSeed;
  const view = reportView(newest, (id) => input.lookup(id)?.format);
  const mode = modeOf(newest);
  return {
    kind: 'report',
    resultId: newest.id,
    takenAt: newest.completedAt,
    testLocale: newest.testLocale,
    level: seed.level,
    view,
    examples: strandExamples(newest, input.lookup),
    startQuestId: seed.startQuestId,
    needsStage: seed.needsStage,
    beyondContent: seed.beyondContent,
    overridden: input.placements.some((r) => r.override !== undefined),
    retakeHidden:
      input.profileType === 'child' && decodingNotTested(newest) && mode !== 'short' ? { mode } : null,
    shortHint: view.shortHint,
    choices: startChoices(seed, input.catalog, input.completedQuestIds, input.isEntitled),
  };
}
