import { CATALOG, StageKeySchema, pickGoal, routeCatalogOf, stageAvailabilityOf, type Catalog, type DateKey, type StageKey } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { PlanView } from './api';
import { goalSourcesOf, planEndText } from './learning-route-view';

/**
 * The class plan goal line on the class roster header (AMENDMENTS-ROUTE-LEARNING-ROUTE section
 * 6.3, LR-OD-10; wireframe `console/learning-route.md` T1): "Your class's weekly plan reaches
 * Stage {n} · {title}" with "Plan ends {date}".
 *
 * Only whole-class live curriculum plans count: published, not archived, no target list, and
 * today on or before the plan's last day (section 4.1 rule 1); the newest `publishedAt` leads.
 * A plan targeted at some students never produces the line. The stage is the plan's own
 * (`planGoalStage` through `pickGoal`), computed from the plan alone: the line is a statement
 * about the plan and says nothing about the learners (no count, no share, no list). Family and
 * school spaces get no line.
 */

export interface ClassGoalLineInput {
  /** The space kind; only a class gets the line. */
  kind: string;
  /** The space's own plans (`GET /api/spaces/:id/plans`), drafts and archived plans included. */
  plans: readonly PlanView[];
  /** Today's UTC day key. */
  today: DateKey;
  /** A stage's title (content, F-I18N-001 section 3.6), supplied by the page. */
  stageTitle: (stage: StageKey) => string;
  catalog?: Catalog;
  locale?: UiLocale;
}

export interface ClassGoalLine {
  stage: StageKey;
  /** "Your class's weekly plan reaches Stage 2 · Words". */
  line: string;
  /** "Plan ends Nov 1" (grown-up views only, LR-OD-7). */
  planEnds: string | null;
}

/** The line about the newest live whole-class curriculum plan, or null when there is none. */
export function classGoalLine(input: ClassGoalLineInput): ClassGoalLine | null {
  if (input.kind !== 'class') return null;
  const locale = input.locale ?? DEFAULT_LOCALE;
  const source = input.catalog ?? CATALOG;
  // No stage rows: with no live whole-class plan the default rule finds no open stage, so there is no line.
  const goal = pickGoal({
    sources: goalSourcesOf(input.plans, 'class', null),
    catalog: routeCatalogOf(source),
    stages: [],
    availability: (stage) => stageAvailabilityOf(source, stage),
    today: input.today,
  });
  if (goal === null) return null;
  const n = StageKeySchema.options.indexOf(goal.stage) + 1;
  return {
    stage: goal.stage,
    line: getMessages(locale).console.learningRoute.planReaches.class(n, input.stageTitle(goal.stage)),
    planEnds: planEndText(goal.endsOn, input.today, locale),
  };
}
