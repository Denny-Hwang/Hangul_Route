import {
  CATALOG,
  CurriculumMetaSchema,
  RouteGoalSummarySchema,
  StageKeySchema,
  isDateKey,
  pickGoal,
  placementStageNumber,
  routeCatalogOf,
  stageAvailabilityOf,
  type Catalog,
  type DateKey,
  type GoalFrom,
  type GoalSource,
  type RouteGoal,
  type RouteStageAvailability,
  type StageKey,
} from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, formatDate, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { PlanView, RosterLearner, RosterSummary } from './api';
import { isLive } from './curriculum';
import { readJourney, type JourneyEntry, type JourneyState } from './journey-strip';
import { startingSpotLine } from './placement';
import { planReaches } from './plans';
import { ROUTES } from './routing';

/**
 * The grown-up Learning Route of one learner (AMENDMENTS-ROUTE-LEARNING-ROUTE section 6.1,
 * LR-7; wireframes `console/learning-route.md` T3 and `parent/learning-route.md` R and L2):
 * the view model of the stage list page and of the report's goal line. Pure: it reads the
 * roster row of the learner the URL names and the space's own plans, which the roster page
 * already loads (no new request, no `payload_json`, no entitlements call).
 *
 * The goal reads, in this order (section 6.1):
 * 1. a family viewer whose roster row carries `summary.routeGoal` (LR-W1, written by the
 *    learner's device, LR-6): the goal the learner's own tab shows, so it may say "{name}'s goal";
 * 2. this space's own live curriculum plan for the learner: a line about the plan
 *    ("Your class's weekly plan reaches ..."), never about the learner's own goal;
 * 3. otherwise the next open stage of the road, which asserts nothing about the learner's goal.
 * A class never reads `routeGoal` or `selfRoute` (the Worker never sends them to a class either,
 * section 9) and never reads another space's plans.
 *
 * Hard rules: one learner only, never a list of learners, an average, a sort or a comparison;
 * a stage's `total` is never shown and no zero count is written; the plan end is a date for the
 * grown-up (LR-OD-7), never "late" or "behind"; no billing or free-allowance line (LR-OD-8); no
 * telemetry (the console has none).
 */

export interface LearningRouteInput {
  /** The space the page is opened in. A school (no roster) or a kind this bundle does not know draws nothing. */
  space: { id: string; kind: string };
  /** The space's roster (`GET /api/spaces/:id/roster`). Only the row `learnerId` names is read. */
  learners: readonly RosterLearner[];
  /** The opaque roster id from the URL. */
  learnerId: string;
  /** The space's own plans (`GET /api/spaces/:id/plans`), drafts and archived plans included: they are filtered here. */
  plans: readonly PlanView[];
  /** Today's UTC day key: a plan counts through its last day. */
  today: DateKey;
  /** A stage's title, which is content (F-I18N-001 section 3.6) the page supplies: "Hangul", "Words". */
  stageTitle: (stage: StageKey) => string;
  /** The shared catalogue; tests pass a frozen one. */
  catalog?: Catalog;
  locale?: UiLocale;
  /** The learner report's address once F-REPORT-001 gives one; until then "back" goes to the space. */
  reportHref?: string | null;
}

export interface LearningRouteLink {
  href: string;
  text: string;
}

export type LearningRouteTagKind = 'here' | 'start' | 'goal' | 'planGoal';

/** A stage row's tag: text, never colour alone (section 10). */
export interface LearningRouteTag {
  kind: LearningRouteTagKind;
  text: string;
}

export interface LearningRouteStageRow {
  kind: 'stage';
  stage: StageKey;
  /** 1 to 7. */
  order: number;
  state: JourneyState;
  /** What the catalogue ships for the stage (`stageAvailabilityOf`): a full stage, a taste or nothing yet. */
  availability: RouteStageAvailability;
  title: string;
  /**
   * "Open", "A taste", "Coming later": the word that carries the row when there is no count line. An open taste
   * stage reads the learner page's "A taste" (`learner.myRoute.state.taste`), as the wireframes and the app do.
   */
  stateWord: string;
  /**
   * "Read everyday words and know what they mean." (`learner.myRoute.stage.canDo`); null for a stage coming later,
   * whose row stays quiet with its name and "Coming later" only (`design/screens/learning-route/stage-list.md`).
   */
  canDo: string | null;
  /** "4 known from the level check, 2 quests done" with every zero part left out; null when both are 0. */
  line: string | null;
  /** In the order here, goal, start (the order of the stage row's accessibility label, section 10). */
  tags: LearningRouteTag[];
}

/** Two or more consecutive stages coming later with nothing in them and no tag, merged as on the learner page. */
export interface LearningRouteLaterRow {
  kind: 'later';
  stages: StageKey[];
  from: number;
  to: number;
  stateWord: string;
  /** "Stages 5 to 7: Coming later". */
  text: string;
}

export type LearningRouteRow = LearningRouteStageRow | LearningRouteLaterRow;

/** Case 1's second line: this family's own live weekly plan, when it is not the source that leads. */
export interface LearningRouteFamilyPlanLine {
  stage: StageKey;
  /** "Your family's weekly plan reaches Stage 1 · Hangul". */
  line: string;
  planEnds: string | null;
}

export interface LearningRouteGoal {
  /** Section 6.1: 1 = the learner's own goal (family viewer, `routeGoal`); 2 = this space's plan; 3 = the next open stage. */
  case: 1 | 2 | 3;
  stage: StageKey;
  /** The goal line; the report shows this line alone under "Now on Stage {n}". */
  line: string;
  /** Case 1: who set the goal ("From the class's weekly plan"); null in cases 2 and 3. */
  from: string | null;
  /** Case 2: "{name} reached this stage." when the plan's stage is reached; case 1 words a reached goal in `line`. */
  reached: string | null;
  /** "Plan ends Nov 1" (grown-up views only, LR-OD-7); null when the plan end is not known here. */
  planEnds: string | null;
  /** "By the end of this stage, {name} can:"; null once the goal is reached (section 6.1), as on the learner card. */
  canDoLead: string | null;
  /** The goal stage's can-do line; null exactly when `canDoLead` is. */
  canDo: string | null;
  familyPlan: LearningRouteFamilyPlanLine | null;
}

/** The grown-up route card (section 6.1). `goal` and `endOfRoad` never both show. */
export interface LearningRouteCard {
  /** "{name} is on Stage {n}: {title}."; null when the journey names no readable here stage. */
  now: string | null;
  goal: LearningRouteGoal | null;
  /** "{name} reached the end of the open road. More is coming." when no stage is open and no plan leads. */
  endOfRoad: string | null;
}

export interface LearningRouteReady {
  status: 'ready';
  /** `<h1>`: "{name}'s Learning Route", from the roster name (initials when the roster is anonymized). */
  title: string;
  /** "Updated Oct 11" from `lastSyncedAt`; null without a readable date. */
  updated: string | null;
  back: LearningRouteLink;
  card: LearningRouteCard;
  /** "Stages": the heading over the stage list. */
  stagesTitle: string;
  stages: LearningRouteRow[];
}

/** No readable `summary.journey` yet (an old app build, or never synced): never worded as "no progress". */
export interface LearningRouteNotSynced {
  status: 'notSynced';
  title: string;
  updated: string | null;
  message: string;
  back: LearningRouteLink;
}

/** The URL names a learner who is not on this roster: no other learner is listed. */
export interface LearningRouteNotFound {
  status: 'notFound';
  message: string;
  back: LearningRouteLink;
}

export type LearningRouteView = LearningRouteReady | LearningRouteNotSynced | LearningRouteNotFound;

type ViewerKind = 'class' | 'family';
type Messages = ReturnType<typeof getMessages>;

/** `isLive` (`curriculum.ts`), the console's one live rule, telling the type that a live plan has its publish time. */
const isLivePlan = (plan: PlanView): plan is PlanView & { publishedAt: string } => isLive(plan);

/**
 * The console goal sources of section 4.1 ("Who passes which sources"): this space's published,
 * unarchived plans that reach the learner (`targetLearnerIds` null, or naming the learner), each
 * a source of the space's kind assigned when it was published. With `learnerId` null, only the
 * plans for everyone in the space (the class line, section 6.3). Classic plans stay in the list
 * with `meta: null`: `pickGoal` gives them no goal, as on the device. The meta arrives from the
 * network as cast JSON, so it is parsed: one this build cannot read is treated as no curriculum,
 * and a malformed plan can never throw in `pickGoal`.
 */
export function goalSourcesOf(plans: readonly PlanView[], kind: GoalSource['kind'], learnerId: string | null): GoalSource[] {
  return plans.flatMap((plan) => {
    if (!isLivePlan(plan)) return [];
    if (learnerId === null ? plan.targetLearnerIds !== null : !planReaches(plan, learnerId)) return [];
    const meta = CurriculumMetaSchema.safeParse(plan.meta);
    return [{ id: plan.id, kind, assignedAt: plan.publishedAt, items: plan.items, meta: meta.success ? meta.data : null }];
  });
}

/**
 * "Plan ends Nov 1", with the year when it is not this year ("Plan ends Jan 9, 2027"); null
 * when the end is not known or the key names no day. Read in UTC, so the day never shifts
 * with the browser's time zone.
 */
export function planEndText(endsOn: string | null | undefined, today: DateKey, locale: UiLocale = DEFAULT_LOCALE): string | null {
  if (typeof endsOn !== 'string' || !isDateKey(endsOn)) return null;
  const kind = endsOn.slice(0, 4) === today.slice(0, 4) ? 'monthDay' : 'monthDayYear';
  return getMessages(locale).console.learningRoute.planEnds(formatDate(locale, endsOn, kind, { utc: true }));
}

/** Half a year: a sync date closer to today than this reads clearly without its year. */
const YEAR_SHOWN_AFTER_MS = 183 * 86_400_000;

/**
 * "Updated Oct 11" in the viewer's time zone; with the year ("Updated Dec 30, 2025") when the
 * sync is half a year or more from today. The rule compares instants, never a local year with
 * the UTC `today`, so the year never comes and goes around New Year. Null without a readable date.
 */
function updatedText(lastSyncedAt: string | null, today: DateKey, locale: UiLocale, m: Messages): string | null {
  if (lastSyncedAt === null) return null;
  const at = new Date(lastSyncedAt);
  if (Number.isNaN(at.getTime())) return null;
  const kind = Math.abs(at.getTime() - Date.parse(`${today}T12:00:00.000Z`)) < YEAR_SHOWN_AFTER_MS ? 'monthDay' : 'monthDayYear';
  return m.console.learningRoute.updated(formatDate(locale, at, kind));
}

/** The goal the learner's device sent (case 1), when this build can read it. */
function deviceGoalOf(summary: RosterSummary): { stage: StageKey; from: GoalFrom } | null {
  const parsed = RouteGoalSummarySchema.safeParse(summary.routeGoal);
  if (!parsed.success) return null;
  const stage = StageKeySchema.safeParse(parsed.data.stage);
  return stage.success ? { stage: stage.data, from: parsed.data.from } : null;
}

/**
 * The stage the level check started the learner at, exactly when the roster card shows its
 * starting-spot line (`startingSpotLine`, `placement.ts`: a level this build can word and a
 * readable date; the roster is cast, not parsed). So the tag and that line never disagree.
 */
function startStageOf(summary: RosterSummary, locale: UiLocale): number | null {
  const placement = summary.placement;
  return placement !== undefined && startingSpotLine(summary, locale) !== null ? placementStageNumber(placement.level.stage) : null;
}

const isEmptyLater = (row: LearningRouteStageRow): boolean => row.state === 'later' && row.line === null && row.tags.length === 0;

/** Rows of the stage list: a lone stage coming later keeps its title; a run of two or more empty, untagged ones merges. */
function mergeLaterRuns(rows: readonly LearningRouteStageRow[], m: Messages): LearningRouteRow[] {
  const journey = m.console.journey;
  const out: LearningRouteRow[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] as LearningRouteStageRow;
    let last = i;
    while (isEmptyLater(row) && last + 1 < rows.length) {
      const next = rows[last + 1] as LearningRouteStageRow;
      if (!isEmptyLater(next) || next.order !== (rows[last] as LearningRouteStageRow).order + 1) break;
      last += 1;
    }
    if (last === i) {
      out.push(row);
      continue;
    }
    const run = rows.slice(i, last + 1);
    const to = (rows[last] as LearningRouteStageRow).order;
    out.push({ kind: 'later', stages: run.map((r) => r.stage), from: row.order, to, stateWord: journey.state.later, text: journey.stages(row.order, to, journey.state.later) });
    i = last;
  }
  return out;
}

/** The stage line with every zero part left out (section 6.1): never "0 quests done", never a total. */
function stageLineOf(entry: JourneyEntry, m: Messages): string | null {
  if (entry.done > 0) return m.console.journey.stageLine(entry.known, entry.done);
  return entry.known > 0 ? m.console.learningRoute.knownLine(entry.known) : null;
}

interface Built {
  card: LearningRouteCard;
  /** The stage the goal tag goes on, and the tag. */
  goalTag: { stage: StageKey; tag: LearningRouteTag } | null;
}

function buildCard(
  kind: ViewerKind,
  learner: RosterLearner,
  summary: RosterSummary,
  entries: readonly JourneyEntry[],
  here: JourneyEntry | null,
  input: LearningRouteInput,
  locale: UiLocale,
  m: Messages,
): Built {
  const lr = m.console.learningRoute;
  const canDoOf = m.learner.myRoute.stage.canDo;
  const name = learner.displayName;
  const { today, stageTitle } = input;
  const source = input.catalog ?? CATALOG;
  const catalog = routeCatalogOf(source);
  const availability = (stage: StageKey) => stageAvailabilityOf(source, stage);
  const stages = entries.map((e) => ({ stage: e.stage, state: e.state }));
  const orderOf = (stage: StageKey): number => StageKeySchema.options.indexOf(stage) + 1;
  const ends = (endsOn: string | null | undefined): string | null => planEndText(endsOn, today, locale);
  // The can-do line shows only while the goal is not reached (section 6.1): "By the end of this stage" reads wrongly
  // for a stage already reached.
  const goalParts = (stage: StageKey, reached: boolean) =>
    reached ? { canDoLead: null, canDo: null } : { canDoLead: lr.canDoLead(name), canDo: canDoOf[orderOf(stage) as keyof typeof canDoOf] };

  const now = here === null ? null : lr.now(name, here.order, stageTitle(here.stage));
  // One pick over this space's own plans for the learner: a plan goal when one of them is live (cases 1 and 2),
  // else the next open stage (case 3), or null at the end of the open road.
  const picked = pickGoal({ sources: goalSourcesOf(input.plans, kind, learner.id), catalog, stages, availability, today });
  /** This space's own leading live curriculum plan for the learner; null when none is live. */
  const spacePlan: RouteGoal | null = picked !== null && picked.from !== 'default' ? picked : null;

  // Case 1: the family viewer holds the goal the learner's device shows, unless this page can prove that goal is
  // older than what it sees (the card never claims the learner's own goal unless it has it, section 6.1):
  // - a goal from the learner's own plan whose end (`selfRoute.endsOn`, synced with it) is before today: that plan
  //   ended, so the device now picks another goal;
  // - a goal from "your family's weekly plan" while this family has no live plan for the learner, or one that
  //   reaches another stage: the device synced before this family's plans changed (or the plan is another family
  //   space's, which "your family" would misname). This family's own live plan then speaks (case 2), or the road (case 3).
  const device = kind === 'family' ? deviceGoalOf(summary) : null;
  const ownEnd = summary.selfRoute?.endsOn;
  const ownEnded = typeof ownEnd === 'string' && isDateKey(ownEnd) && ownEnd < today;
  const deviceStale = device !== null && ((device.from === 'self' && ownEnded) || (device.from === 'family' && (spacePlan === null || spacePlan.stage !== device.stage)));
  if (device !== null && !deviceStale) {
    const { stage, from } = device;
    const n = orderOf(stage);
    const title = stageTitle(stage);
    const state = entries.find((e) => e.stage === stage)?.state;
    const reached = from !== 'default' && (state === 'complete' || state === 'known' || (state === 'explored' && availability(stage) === 'taste'));
    // A family source here is this family's leading live plan (the same stage, checked above). Any other source leaves
    // this family's live plan, when there is one, its own line: it is not the goal the learner's tab shows.
    const familyLeads = from === 'family';
    const familyPlan =
      spacePlan !== null && !familyLeads
        ? { stage: spacePlan.stage, line: lr.planReaches.family(orderOf(spacePlan.stage), stageTitle(spacePlan.stage)), planEnds: ends(spacePlan.endsOn) }
        : null;
    // The end of the source that leads, when this page can see it: the learner's own plan (never past, checked above),
    // or this family's live plan. Known limit: a learner in two family spaces whose other family's plan leads with the
    // same stage gets this family's end date; the summary carries no source id (section 9), so the page cannot tell.
    const planEnds = from === 'self' ? ends(ownEnd) : familyLeads && spacePlan !== null ? ends(spacePlan.endsOn) : null;
    return {
      card: {
        now,
        goal: {
          case: 1,
          stage,
          line: reached ? lr.reached(name, n, title) : lr.learnerGoal(name, n, title),
          from: from === 'self' ? lr.fromLead.self(name) : lr.fromLead[from],
          reached: null,
          planEnds,
          ...goalParts(stage, reached),
          familyPlan,
        },
        endOfRoad: null,
      },
      goalTag: { stage, tag: { kind: 'goal', text: lr.goalTag(name) } },
    };
  }

  // Case 2: this space's own live plan for the learner, worded about the plan.
  if (spacePlan !== null) {
    const { stage } = spacePlan;
    return {
      card: {
        now,
        goal: {
          case: 2,
          stage,
          line: lr.planReaches[kind](orderOf(stage), stageTitle(stage)),
          from: null,
          reached: spacePlan.reached ? lr.stageReached(name) : null,
          planEnds: ends(spacePlan.endsOn),
          ...goalParts(stage, spacePlan.reached),
          familyPlan: null,
        },
        endOfRoad: null,
      },
      goalTag: { stage, tag: { kind: 'planGoal', text: lr.planGoalTag } },
    };
  }

  // Case 3: the next open stage of the road (the default rule, section 4.1 rule 4), or its end.
  const open = picked;
  if (open === null) return { card: { now, goal: null, endOfRoad: lr.endOfRoad(name) }, goalTag: null };
  return {
    card: {
      now,
      goal: {
        case: 3,
        stage: open.stage,
        line: lr.nextOpen(orderOf(open.stage), stageTitle(open.stage)),
        from: null,
        reached: null,
        planEnds: null,
        ...goalParts(open.stage, false),
        familyPlan: null,
      },
      endOfRoad: null,
    },
    goalTag: null,
  };
}

/**
 * The view of one learner's Learning Route in the adult shell, or null for a space kind with
 * no roster. `notFound` when the URL names a learner who is not on this roster; `notSynced`
 * until the roster row carries a readable `summary.journey`.
 */
export function learningRouteView(input: LearningRouteInput): LearningRouteView | null {
  const { space, learnerId, today } = input;
  if (space.kind !== 'class' && space.kind !== 'family') return null;
  const kind: ViewerKind = space.kind;
  const locale = input.locale ?? DEFAULT_LOCALE;
  const m = getMessages(locale);
  const lr = m.console.learningRoute;

  // Section 6.1 asks for `ROUTES.space(spaceId, kind)`; `ROUTES.space` takes no kind and no `/parent/space` page exists
  // before F-APP-001 A-5b, so a family goes to the one space page there is. The page's PR (LR-8) passes the kind once it can.
  const toSpace: LearningRouteLink = { href: ROUTES.space(space.id), text: lr.back[kind] };
  const learner = input.learners.find((row) => row.id === learnerId);
  if (learner === undefined) return { status: 'notFound', message: lr.notFound, back: toSpace };

  const name = learner.displayName;
  const title = lr.title(name);
  const updated = updatedText(learner.lastSyncedAt, today, locale, m);
  const back: LearningRouteLink = input.reportHref ? { href: input.reportHref, text: lr.back.report } : toSpace;

  const summary = learner.summary;
  const journey = summary === null ? null : readJourney(summary.journey);
  if (summary === null || journey === null) return { status: 'notSynced', title, updated, message: lr.notSynced(name), back };

  const { entries, here } = journey;
  const { card, goalTag } = buildCard(kind, learner, summary, entries, here, input, locale, m);
  const startStage = startStageOf(summary, locale);
  const canDoOf = m.learner.myRoute.stage.canDo;
  const catalog = input.catalog ?? CATALOG;

  const rows = entries.map((entry): LearningRouteStageRow => {
    // Here, goal, start: the order of the learner page's tags and of the row's spoken label (section 10, LR-D).
    const tags: LearningRouteTag[] = [];
    if (entry === here) tags.push({ kind: 'here', text: lr.hereTag(name) });
    if (goalTag !== null && goalTag.stage === entry.stage) tags.push(goalTag.tag);
    if (entry.order === startStage) tags.push({ kind: 'start', text: lr.startTag(name) });
    const availability = stageAvailabilityOf(catalog, entry.stage);
    return {
      kind: 'stage',
      stage: entry.stage,
      order: entry.order,
      state: entry.state,
      availability,
      title: input.stageTitle(entry.stage),
      stateWord: entry.state === 'open' && availability === 'taste' ? m.learner.myRoute.state.taste : m.console.journey.state[entry.state],
      canDo: entry.state === 'later' ? null : canDoOf[entry.order as keyof typeof canDoOf],
      line: stageLineOf(entry, m),
      tags,
    };
  });

  return { status: 'ready', title, updated, back, card, stagesTitle: lr.stagesTitle, stages: mergeLaterRuns(rows, m) };
}
