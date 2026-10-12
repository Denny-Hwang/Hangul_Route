import type { StageKey } from '@hangul-route/content-schema';
import { newQuestsLine } from './seen';
import type { CellRow, MyRouteModel, SkillRow, StageRow } from './types';

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
  };
  cta: { stories: string; library: string };
  state: { complete: string; known: string; explored: string; open: string; taste: string; later: string; notOpen: string };
  tag: { here: string; start: string };
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
  goal: string;
  rest: (name: string) => string;
  beyond: (name: string) => string;
  hereTag: (name: string) => string;
  ready: (name: string) => string;
  explored: (name: string) => string;
  skillsTitle: (name: string) => string;
}

/** `a11y.myRoute`: the stage row label reads the row. */
export interface MyRouteA11yMessages {
  stage: (order: number, title: string, stateWord: string, here: boolean, start: boolean, played: number) => string;
  stageGrownup: (name: string, order: number, title: string, stateWord: string, here: boolean, start: boolean, played: number) => string;
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
      lines = g ? [grownup.start(ctx.name), grownup.goal] : [learner.hero.start, learner.hero.goal];
      cta = { action: 'quest', label: learner.hero.cta.start };
      break;
    case 'continue': {
      const here = model.stages.find((s) => s.here) as StageRow;
      lines = [g ? grownup.here(ctx.name, here.order, here.title) : learner.hero.here(here.order, here.title)];
      if (extra.nextTitle !== null) lines.push(g ? grownup.next(extra.nextTitle) : learner.hero.next(extra.nextTitle));
      cta = { action: 'quest', label: learner.hero.cta.continue };
      break;
    }
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

export function stageTags(row: StageRow, ctx: CopyContext): string[] {
  const { learner, grownup } = ctx.m;
  const g = isGrownup(ctx);
  const tags: string[] = [];
  if (row.here) tags.push(g ? grownup.hereTag(ctx.name) : learner.tag.here);
  if (row.isStart) tags.push(g ? grownup.started(ctx.name) : learner.tag.start);
  return tags;
}

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
  return isGrownup(ctx)
    ? a11y.stageGrownup(ctx.name, row.order, row.title, word, row.here, row.isStart, row.done)
    : a11y.stage(row.order, row.title, word, row.here, row.isStart, row.done);
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
    if (row.state === 'later' && !isNotOpenYet(row)) run.push(row);
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
