import type { DateKey, GoalFrom, StageKey } from '@hangul-route/content-schema';
import { newQuestsLine } from './seen';
import type { CellRow, MyRouteModel, Pip, SkillRow, StageRow } from './types';

/**
 * My route copy selectors (F-ROUTE-001 sections 3.5, 3.11 to 3.13). They
 * choose which message to show and with which values; the words live in the
 * dictionary and arrive as `MyRouteMessages`, so the selectors stay pure and
 * testable per locale (F-I18N-001 section 3.4 rule 3). `viewer: 'grownup'`
 * (a grown-up viewing a child, read-only) writes every learner sentence in the
 * third person from the profile name and never offers the hero button.
 *
 * R-3 adds the strings (`learner.myRoute`, `a11y.myRoute`), R-9b the grown-up
 * ones (`caregiver.journey`, `caregiver.skillsNote`); each slice must satisfy
 * the matching interface below.
 */

export type Viewer = 'self' | 'grownup';
type StageOrder = StageRow['order'];

/** `learner.myRoute` (Appendix B). */
export interface LearnerRouteMessages {
  title: string;
  hero: {
    start: string;
    goal: string;
    here: (n: number, title: string) => string;
    next: (title: string) => string;
    rest: string;
    beyond: string;
    cta: { start: string; continue: string };
    error: string;
  };
  cta: { stories: string; library: string };
  /** The route card (Learning Route amendment section 11.1, LR-3b). */
  now: { label: string };
  goal: {
    label: string;
    stage: (n: number, title: string) => string;
    inGoal: (n: number, title: string) => string;
    explore: (n: number, title: string) => string;
    exploreInGoal: (n: number, title: string) => string;
    tasteLine: string;
    reachedStage: (n: number, title: string) => string;
    keepGoing: (title: string) => string;
    reachedHoya: string;
    endOfRoad: string;
    from: Readonly<Record<GoalFrom, string>>;
  };
  state: { complete: string; known: string; explored: string; open: string; taste: string; later: string; notOpen: string };
  tag: { here: string; goal: string; start: string };
  cell: { playing: string };
  caption: { played: (n: number) => string; ready: string; explored: string; newJoined: string };
  canDoLead: string;
  stage: { canDo: Readonly<Record<StageOrder, string>> };
  laterGroup: (from: number, to: number) => string;
  newQuests: (n: number, stage: number) => string;
  skills: { title: string };
  skill: { read: string; listen: string; write: string; quests: (n: number) => string };
}

/** `caregiver.journey`: the same sentences about the child. */
export interface GrownupJourneyMessages {
  here: (name: string, n: number, title: string) => string;
  next: (title: string) => string;
  canDoLead: (name: string) => string;
  started: (name: string) => string;
  known: (name: string) => string;
  quests: (name: string, n: number) => string;
  viewing: (name: string) => string;
  tiles: (n: number) => string;
  start: (name: string) => string;
  /** `first`: the new-learner line; the rest: the grown-up route card (Learning Route amendment section 6.2, LR-3b). */
  goal: {
    first: string;
    inGoal: (name: string, n: number, title: string) => string;
    exploreInGoal: (name: string, n: number, title: string) => string;
    reached: (name: string, n: number, title: string) => string;
    from: { class: string; school: string; family: string; self: (name: string) => string; default: string };
  };
  planEnds: (date: string) => string;
  goalTag: (name: string) => string;
  endOfRoad: (name: string) => string;
  error: (name: string) => string;
  rest: (name: string) => string;
  beyond: (name: string) => string;
  hereTag: (name: string) => string;
  ready: (name: string) => string;
  explored: (name: string) => string;
  skillsTitle: (name: string) => string;
}

/** `a11y.myRoute`: the stage row label reads the row; the route card reads as one summary. */
export interface MyRouteA11yMessages {
  stage: (order: number, title: string, stateWord: string, here: boolean, start: boolean, played: number, goal?: boolean) => string;
  stageGrownup: (name: string, order: number, title: string, stateWord: string, here: boolean, start: boolean, played: number, goal?: boolean) => string;
  routeCard: (
    hoyaText: string | null,
    nowText: string | null,
    goalText: string | null,
    fromText: string | null,
    planEndsText: string | null,
    pipsText: string | null,
    nextText: string | null,
  ) => string;
  labelled: (label: string, line: string) => string;
  goalPips: { none: string; some: string; someDone: string; all: string };
}

export interface MyRouteMessages {
  learner: LearnerRouteMessages;
  grownup: GrownupJourneyMessages;
  /** `caregiver.skillsNote`: the one wording of this sentence, everywhere. */
  skillsNote: string;
  a11y: MyRouteA11yMessages;
}

export interface CopyContext {
  viewer: Viewer;
  /** The profile name; used only when `viewer` is 'grownup'. */
  name: string;
  m: MyRouteMessages;
  /** The goal stage (`model.goal?.stage`): its row gets the goal tag. Absent or null: no tag. */
  goalStage?: StageKey | null;
}

export interface HeroCopy {
  lines: string[];
  /** Null in read-only mode. `quest` opens the cursor quest. */
  cta: { action: 'quest' | 'stories' | 'library'; label: string } | null;
}

const isGrownup = (ctx: CopyContext): boolean => ctx.viewer === 'grownup';

export function heroCopy(model: MyRouteModel, ctx: CopyContext, extra: { nextTitle: string | null; hasStories: boolean }): HeroCopy {
  const { learner, grownup } = ctx.m;
  const g = isGrownup(ctx);
  const restCta = { action: extra.hasStories ? ('stories' as const) : ('library' as const), label: extra.hasStories ? learner.cta.stories : learner.cta.library };
  let lines: string[];
  let cta: HeroCopy['cta'];
  switch (model.hero) {
    case 'start':
      lines = g ? [grownup.start(ctx.name), grownup.goal.first] : [learner.hero.start, learner.hero.goal];
      cta = { action: 'quest', label: learner.hero.cta.start };
      break;
    case 'continue': {
      const here = model.stages.find((s) => s.here) as StageRow;
      lines = [g ? grownup.here(ctx.name, here.order, here.title) : learner.hero.here(here.order, here.title)];
      if (extra.nextTitle !== null) lines.push(g ? grownup.next(extra.nextTitle) : learner.hero.next(extra.nextTitle));
      cta = { action: 'quest', label: learner.hero.cta.continue };
      break;
    }
    // `freeEnd` exists only once the screen passes F-ENT-003's `routeNext` (LR-5a); its own hero
    // (`learner.access.openForYou`, Practice words) is LR-5b's. Until then it reads as rest.
    case 'freeEnd':
    case 'rest':
      lines = [g ? grownup.rest(ctx.name) : learner.hero.rest];
      cta = restCta;
      break;
    case 'beyond':
      lines = [g ? grownup.beyond(ctx.name) : learner.hero.beyond];
      cta = restCta;
      break;
  }
  return { lines, cta: g ? null : cta };
}

/**
 * A `later` stage or cell that has playable quests is `later` only because the
 * learner is not entitled to it (OD-4's other branch): it reads the neutral
 * "Not open yet", never "Coming later", which would be false for shipped
 * content (section 3.3).
 */
const hasQuestPips = (pips: readonly { kind: 'quest' | 'cell' }[]): boolean => pips.some((p) => p.kind === 'quest');
const isNotOpenYet = (row: StageRow): boolean => row.state === 'later' && row.cells.some((c) => hasQuestPips(c.pips));
const laterWord = (row: StageRow, ctx: CopyContext): string => (isNotOpenYet(row) ? ctx.m.learner.state.notOpen : ctx.m.learner.state.later);

const knownWord = (ctx: CopyContext): string => (isGrownup(ctx) ? ctx.m.grownup.known(ctx.name) : ctx.m.learner.state.known);

/** The state word shown as the row's pill. */
export function stageStateWord(row: StageRow, ctx: CopyContext): string {
  const { state } = ctx.m.learner;
  switch (row.state) {
    case 'complete':
      return state.complete;
    case 'known':
      return knownWord(ctx);
    case 'explored':
      return state.explored;
    case 'later':
      return laterWord(row, ctx);
    case 'open':
      return row.availability === 'taste' ? state.taste : state.open;
  }
}

/** Absolute, positive captions; never a ratio, never "left" (section 3.11). */
export function stageCaptions(row: StageRow, ctx: CopyContext): string[] {
  const { learner, grownup } = ctx.m;
  const g = isGrownup(ctx);
  let lines: string[];
  if (row.state === 'later') lines = [learner.stage.canDo[row.order], laterWord(row, ctx)];
  else if (row.state === 'known') lines = [knownWord(ctx)];
  else if (row.state === 'explored') lines = [g ? grownup.explored(ctx.name) : learner.caption.explored];
  else if (row.done > 0) lines = [learner.caption.played(row.done)];
  else lines = [g ? grownup.ready(ctx.name) : learner.caption.ready];
  if (row.latched && row.newPips.length > 0) lines.push(learner.caption.newJoined);
  return lines;
}

/** Which tag a stage row carries; the screen draws the pin beside `start` and the flag beside `goal`. */
export type StageTagKind = 'here' | 'goal' | 'start';

/** The row's tags with their kind, in the order they show: where you are, where you are going, where you began. */
export function stageTagList(row: StageRow, ctx: CopyContext): { kind: StageTagKind; label: string }[] {
  const { learner, grownup } = ctx.m;
  const g = isGrownup(ctx);
  const tags: { kind: StageTagKind; label: string }[] = [];
  if (row.here) tags.push({ kind: 'here', label: g ? grownup.hereTag(ctx.name) : learner.tag.here });
  if (isGoalRow(row, ctx)) tags.push({ kind: 'goal', label: g ? grownup.goalTag(ctx.name) : learner.tag.goal });
  if (row.isStart) tags.push({ kind: 'start', label: g ? grownup.started(ctx.name) : learner.tag.start });
  return tags;
}

export function stageTags(row: StageRow, ctx: CopyContext): string[] {
  return stageTagList(row, ctx).map((tag) => tag.label);
}

/** The goal stage's row (Learning Route amendment section 4.3): its tag sits after "You are here" and before "You started here". */
const isGoalRow = (row: StageRow, ctx: CopyContext): boolean => ctx.goalStage != null && row.stage === ctx.goalStage;

/**
 * "By the end of this stage you can: ..." in the expanded stage; "By the end
 * of this stage, Sam can:" in read-only mode. The can-do lines themselves are
 * written for both viewers (no "you").
 */
export function canDoCopy(row: StageRow, ctx: CopyContext): { lead: string; line: string } {
  const lead = isGrownup(ctx) ? ctx.m.grownup.canDoLead(ctx.name) : ctx.m.learner.canDoLead;
  return { lead, line: ctx.m.learner.stage.canDo[row.order] };
}

export function cellWord(cell: CellRow, ctx: CopyContext): string {
  const { state, cell: words } = ctx.m.learner;
  switch (cell.state) {
    case 'complete':
      return state.complete;
    case 'partial':
      return words.playing;
    case 'known':
      return knownWord(ctx);
    case 'open':
      return state.open;
    case 'later':
      return hasQuestPips(cell.pips) ? state.notOpen : state.later;
  }
}

export function stageA11yLabel(row: StageRow, ctx: CopyContext): string {
  const word = stageStateWord(row, ctx);
  const { a11y } = ctx.m;
  const goal = isGoalRow(row, ctx);
  return isGrownup(ctx)
    ? a11y.stageGrownup(ctx.name, row.order, row.title, word, row.here, row.isStart, row.done, goal)
    : a11y.stage(row.order, row.title, word, row.here, row.isStart, row.done, goal);
}

export type TrailEntry =
  | { kind: 'stage'; row: StageRow }
  | { kind: 'later'; stages: StageKey[]; rows: StageRow[]; label: string };

/**
 * The trail in order: one entry per stage, except that a coming-later stage is
 * a compact row and consecutive ones merge into one ("Stages 5 to 7"). A
 * not-open-yet stage (playable content, not entitled) keeps its full row and
 * never merges into a coming-later run.
 */
export function trailEntries(model: Pick<MyRouteModel, 'stages'>, ctx: CopyContext): TrailEntry[] {
  const out: TrailEntry[] = [];
  let run: StageRow[] = [];
  const flush = (): void => {
    const first = run[0];
    const last = run[run.length - 1];
    if (first && last) {
      const label = run.length === 1 ? ctx.m.learner.state.later : ctx.m.learner.laterGroup(first.order, last.order);
      out.push({ kind: 'later', stages: run.map((r) => r.stage), rows: run, label });
    }
    run = [];
  };
  for (const row of model.stages) {
    if (row.state === 'later' && !isNotOpenYet(row) && isGoalRow(row, ctx)) {
      // The goal stage never hides inside a merged run: its own compact row keeps the goal tag (section 4.3).
      flush();
      run = [row];
      flush();
    } else if (row.state === 'later' && !isNotOpenYet(row)) run.push(row);
    else {
      flush();
      out.push({ kind: 'stage', row });
    }
  }
  flush();
  return out;
}

/** "3 new quests joined Stage 1." for the active learner only (seen is never written in read-only mode). */
export function newQuestsCopy(model: MyRouteModel, ctx: CopyContext): string | null {
  const line = newQuestsLine(model);
  return line === null || isGrownup(ctx) ? null : ctx.m.learner.newQuests(line.count, line.order);
}

export function skillsTitle(ctx: CopyContext): string {
  return isGrownup(ctx) ? ctx.m.grownup.skillsTitle(ctx.name) : ctx.m.learner.skills.title;
}

/** The skill word and an absolute count ("In 4 quests you finished"), never a ratio or a level. */
export function skillCopy(row: SkillRow, ctx: CopyContext): { label: string; detail: string } {
  const { learner, grownup } = ctx.m;
  const g = isGrownup(ctx);
  const label = learner.skill[row.skill];
  if (row.quests === 0) return { label, detail: g ? grownup.ready(ctx.name) : learner.caption.ready };
  return { label, detail: g ? grownup.quests(ctx.name, row.quests) : learner.skill.quests(row.quests) };
}

export function skillsNoteCopy(ctx: CopyContext): string | null {
  return isGrownup(ctx) ? ctx.m.skillsNote : null;
}

/** "Spelling with tiles: N quests", grown-up view only, when greater than zero. */
export function tilesCopy(model: MyRouteModel, ctx: CopyContext): string | null {
  return isGrownup(ctx) && model.tiles > 0 ? ctx.m.grownup.tiles(model.tiles) : null;
}

export function viewingCopy(ctx: CopyContext): string | null {
  return isGrownup(ctx) ? ctx.m.grownup.viewing(ctx.name) : null;
}

/** One labelled line of the route card's where block; `label` null reads the line alone. */
export interface RouteCardLine {
  label: string | null;
  line: string;
}

/**
 * The route card's words (Learning Route amendment sections 4.3, 6.2 and 10;
 * LR-D `design/screens/learning-route/route-card.md`). The card lays these
 * out; it never builds a sentence itself.
 */
export interface RouteCardCopy {
  /** The Hoya sentence: start, the first reached visit, rest or beyond, the end of the open road; null when the card has none. */
  hoya: string | null;
  /**
   * `split`: "Now" over "Goal" (no Now line for a new learner or at free-end);
   * `collapsed`: one line when the goal stage is the stage you are on; null
   * at the end of the open road.
   */
  where: { kind: 'split'; now: RouteCardLine | null; goal: RouteCardLine } | { kind: 'collapsed'; line: string } | null;
  /** Who set the goal ("From your class's weekly plan", "Hoya's suggestion"). */
  from: string | null;
  /** "Plan ends {date}": grown-up views only (LR-OD-7), never on a learner screen. */
  planEnds: string | null;
  /** The goal stage's can-do line, while the goal is a full stage not yet reached. */
  canDo: { lead: string; line: string } | null;
  /** "Try the first quests of this stage." for a taste goal not yet reached (no can-do line). */
  tasteLine: string | null;
  /** "Next: {title}", or "Keep going: {title}" once the goal is reached; null without a next quest. */
  next: string | null;
  /** The card as one summary label, without digits for the pips (section 10). */
  a11yLabel: string;
}

export interface RouteCardExtra {
  /** The title of `model.next`'s quest in the UI locale; null when there is none. */
  nextTitle: string | null;
  /** The first visit that shows this reached goal (`isFirstGoalReached`); never in read-only mode. */
  firstReached?: boolean;
  /** Formats the plan's last day for the grown-up "Plan ends" line; without it the line is left out. */
  formatDay?: (day: DateKey) => string;
}

/**
 * The goal pips in words, without digits: none filled, some, or every quest of
 * the stage. Known pips count as filled; only `open` and `new` pips count as
 * ready, so the words never promise a quest that is not open yet. About a
 * child, "none" reads "Ready when Sam is" (the other words never say "you").
 * Null when the words would not be true: a stage with no quest pips, or none
 * filled and none ready.
 */
export function goalPipsWord(pips: readonly Pip[], ctx: CopyContext): string | null {
  const words = ctx.m.a11y.goalPips;
  const quests = pips.filter((p) => p.kind === 'quest');
  const filled = quests.filter((p) => p.state === 'done' || p.state === 'known').length;
  const ready = quests.some((p) => p.state === 'open' || p.state === 'new');
  if (quests.length === 0) return null;
  if (filled === quests.length) return words.all;
  if (filled === 0) return ready ? (isGrownup(ctx) ? ctx.m.grownup.ready(ctx.name) : words.none) : null;
  return ready ? words.some : words.someDone;
}

const labelled = (l: RouteCardLine, ctx: CopyContext): string => (l.label === null ? l.line : ctx.m.a11y.labelled(l.label, l.line));

export function routeCardCopy(model: MyRouteModel, ctx: CopyContext, extra: RouteCardExtra): RouteCardCopy {
  const { learner, grownup, a11y } = ctx.m;
  const g = isGrownup(ctx);
  const { goal } = model;
  const here = model.stages.find((s) => s.here) as StageRow;
  const goalRow = goal === null ? undefined : model.stages.find((s) => s.stage === goal.stage);

  if (goal === null || goalRow === undefined) {
    if (model.nextKind === 'quest' && extra.nextTitle !== null) {
      // No open stage is left to aim for, yet a quest is still next (a placed-out quest, a plan item):
      // the card names it and says nothing about the end of the road, so its words match its button.
      const next = g ? grownup.next(extra.nextTitle) : learner.hero.next(extra.nextTitle);
      return { hoya: null, where: null, from: null, planEnds: null, canDo: null, tasteLine: null, next, a11yLabel: a11y.routeCard(null, null, null, null, null, null, next) };
    }
    // The end of the open road: the card's only sentence (the rest sentence is dropped).
    const hoya = g ? grownup.endOfRoad(ctx.name) : learner.goal.endOfRoad;
    return { hoya, where: null, from: null, planEnds: null, canDo: null, tasteLine: null, next: null, a11yLabel: hoya };
  }

  const freeEnd = model.hero === 'freeEnd';
  const withoutNow = model.hero === 'start' || freeEnd;
  const open = !goal.reached;
  let hoya: string | null = null;
  if (model.hero === 'start') hoya = g ? grownup.start(ctx.name) : learner.hero.start;
  else if (model.hero === 'rest') hoya = g ? grownup.rest(ctx.name) : learner.hero.rest;
  else if (model.hero === 'beyond') hoya = g ? grownup.beyond(ctx.name) : learner.hero.beyond;
  else if (!g && goal.reached && extra.firstReached === true) hoya = learner.goal.reachedHoya;

  let where: RouteCardCopy['where'];
  if (!withoutNow && open && goal.stage === here.stage) {
    const n = goalRow.order;
    const t = goalRow.title;
    const line = g
      ? goal.taste
        ? grownup.goal.exploreInGoal(ctx.name, n, t)
        : grownup.goal.inGoal(ctx.name, n, t)
      : goal.taste
        ? learner.goal.exploreInGoal(n, t)
        : learner.goal.inGoal(n, t);
    where = { kind: 'collapsed', line };
  } else {
    const now = withoutNow ? null : { label: learner.now.label, line: g ? grownup.here(ctx.name, here.order, here.title) : learner.goal.stage(here.order, here.title) };
    let goalLine: RouteCardLine;
    if (goal.reached && g) goalLine = { label: null, line: grownup.goal.reached(ctx.name, goalRow.order, goalRow.title) };
    else if (goal.reached) goalLine = { label: learner.goal.label, line: learner.goal.reachedStage(goalRow.order, goalRow.title) };
    else goalLine = { label: learner.goal.label, line: (goal.taste ? learner.goal.explore : learner.goal.stage)(goalRow.order, goalRow.title) };
    where = { kind: 'split', now, goal: goalLine };
  }

  const from = goal.from === 'self' && g ? grownup.goal.from.self(ctx.name) : g ? grownup.goal.from[goal.from as Exclude<GoalFrom, 'self'>] : learner.goal.from[goal.from];
  const planEnds = g && goal.endsOn !== null && extra.formatDay !== undefined ? grownup.planEnds(extra.formatDay(goal.endsOn)) : null;
  const canDo = open && !goal.taste && !freeEnd ? { lead: g ? grownup.canDoLead(ctx.name) : learner.canDoLead, line: learner.stage.canDo[goalRow.order] } : null;
  const tasteLine = open && goal.taste && !freeEnd ? learner.goal.tasteLine : null;
  let next: string | null = null;
  if (model.nextKind === 'quest' && extra.nextTitle !== null) {
    if (g) next = grownup.next(extra.nextTitle);
    else next = goal.reached ? learner.goal.keepGoing(extra.nextTitle) : learner.hero.next(extra.nextTitle);
  }

  const nowText = where.kind === 'collapsed' ? where.line : where.now === null ? null : labelled(where.now, ctx);
  const goalText = where.kind === 'collapsed' ? null : labelled(where.goal, ctx);
  const a11yLabel = a11y.routeCard(hoya, nowText, goalText, from, planEnds, goalPipsWord(model.goalPips, ctx), next);
  return { hoya, where, from, planEnds, canDo, tasteLine, next, a11yLabel };
}
