import type { DateKey, MinigameKind, ProgressSnapshot, StageKey, ThemeKey } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import {
  canDoCopy,
  cellWord,
  heroCopy,
  newQuestsCopy,
  routeCardCopy,
  skillCopy,
  skillsNoteCopy,
  skillsTitle,
  stageA11yLabel,
  stageCaptions,
  stageStateWord,
  stageTagList,
  tilesCopy,
  trailEntries,
  viewingCopy,
  type CopyContext,
  type HeroCopy,
  type MyRouteMessages,
  type RouteCardCopy,
  type StageTagKind,
  type Viewer,
} from './copy';
import { letterWallView, type LetterTile, type LetterWallView } from './letter-wall';
import { hoyaPoseFor } from './seen';
import { SKILL_OF_KIND } from './skills';
import type { Hero, MyRouteModel, Pip, SeenRecord, Skill, StageRow, StageState } from './types';

/**
 * What the My route screen draws (F-ROUTE-001 R-3, sections 3.4, 3.7, 3.8,
 * 3.11, 3.14), as plain data: the screen only lays it out. Pure: the words
 * come from the dictionary through the copy selectors, the facts from
 * `buildMyRoute`. Nothing here reads a clock, a store or the window.
 */

/** A profile that has not played yet: the page draws the new-learner state (section 3.17). */
export function emptySnapshot(profileId: string): ProgressSnapshot {
  return { profileId, updatedAt: '', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 };
}

/** The four dictionary slices the copy selectors read, from one locale's dictionary. */
export function myRouteMessages(m: Messages): MyRouteMessages {
  return { learner: m.learner.myRoute, access: m.learner.access, grownup: m.caregiver.journey, skillsNote: m.caregiver.skillsNote, a11y: m.a11y.myRoute };
}

/** The badge glyph per stage state (section 3.3: a non-colour cue for every state). */
export type BadgeLook = 'number' | 'complete' | 'known' | 'explored' | 'later';
export type PillTone = 'neutral' | 'primary' | 'secondary' | 'success' | 'info';
/** The trail line below an entry, down to the next one: solid down to `trailReached`, dotted below it. */
export type Connector = 'solid' | 'dotted' | null;
export type RouteIcon = 'book' | 'ear' | 'pencil' | 'star' | 'card';

/**
 * Below this window width a stage row shows its caption and a plain fill bar
 * instead of the pips (section 3.4); the open stage still draws the pips.
 */
export const PIP_ROW_MIN_WIDTH = 360;

export const stageRowLook = (windowWidth: number): 'pips' | 'bar' => (windowWidth < PIP_ROW_MIN_WIDTH ? 'bar' : 'pips');

export interface TagView {
  label: string;
  /** "You started here" carries the pin glyph, "Your goal" the flag (LR-5a); "You are here" none. */
  glyph: 'pin' | 'flag' | null;
}

export interface CellRowView {
  key: string;
  themeLabel: string;
  title: string;
  word: string;
  pips: Pip[];
  /** The episode to open, or null when the cell is not a button (coming later). */
  episodeId: string | null;
  /**
   * "In your plan" (F-ENT-003 `learner.routeNext.tag.inPlan`, the solid ring plus the word) when the
   * cell's episode is in the plan view (amendment section 4.5); the learner's own page only.
   */
  inPlan: string | null;
  a11yLabel: string;
}

export interface StageRowView {
  kind: 'stage';
  key: StageKey;
  stage: StageKey;
  order: number;
  title: string;
  stateWord: string;
  tone: PillTone;
  badge: BadgeLook;
  captions: string[];
  tags: TagView[];
  a11yLabel: string;
  /** Earned and open quest pips, then the coming-later cell pips, then (after a gap) the quests that joined later. */
  groups: Pip[][];
  /** The plain bar of a narrow window; null when the stage has no quest pip. Never shown as a ratio. */
  fill: { value: number; max: number } | null;
  canDo: { lead: string; line: string };
  builds: { skill: Skill; label: string; icon: RouteIcon }[];
  cells: CellRowView[];
  /** A pip in this row was done since the last open (the one-time fill). */
  fresh: boolean;
  connector: Connector;
  /** The letter wall drawn when the stage is open (R-7c): Stage 1 only, null without tiles. */
  letterWall: LetterWallView | null;
  /**
   * The row draws a not-open pip (`laterReason: 'notOpen'`), so its legend lists "Not open yet" beside
   * "Coming later" (amendment section 4.5, LR-5b): the word, not the shared dotted ring, tells them apart.
   */
  notOpenLegend: boolean;
}

export interface LaterRowView {
  kind: 'later';
  key: string;
  /** The first stage of the run: its colour and number on the badge. */
  stage: StageKey;
  order: number;
  merged: boolean;
  /** "Sentences" for one stage, "Stages 5 to 7" for a run. */
  title: string;
  stateWord: string;
  a11yLabel: string;
  /**
   * The trail tags of a single-stage row (amendment section 4.3, "Collapsed goal row": a goal stage
   * with no shipped content keeps its "Your goal" tag); a merged run never holds the goal, so it has none.
   */
  tags: TagView[];
  /** Shown when the row is open: one line per stage, with its can-do line and what it builds. */
  details: { stage: StageKey; order: number; title: string; canDo: string; builds: { skill: Skill; label: string; icon: RouteIcon }[] }[];
  note: string;
  connector: Connector;
}

export type TrailRowView = StageRowView | LaterRowView;

export interface SkillRowView {
  skill: Skill;
  icon: RouteIcon;
  label: string;
  detail: string;
  /** Earned marks, then at most one faint next slot, only when it is reachable (section 3.7). */
  marks: Pip[];
  a11yLabel: string;
  sheet: { title: string; note: string; games: string[] };
}

export interface GainTileView {
  key: 'stars' | 'cards' | 'stories';
  icon: RouteIcon;
  value: number;
  label: string;
  a11yLabel: string;
  /** Cards and stories open the Library; stars are not a button. */
  opensLibrary: boolean;
}

export interface MyRouteView {
  hero: Hero;
  /** The card's one button (null in read-only mode); its words are `routeCard`. */
  heroCopy: HeroCopy;
  /** The route card (amendment section 4.3; LR-D `route-card.md`). */
  routeCard: RouteCardCopy;
  /** "Week 3 of your weekly plan" under the card, learner only; never a Next title (section 4.3). */
  planLine: string | null;
  pose: 'idle' | 'cheering';
  /** Read-only only: "Viewing Sam's Learning Route". */
  viewing: string | null;
  newQuests: string | null;
  trail: TrailRowView[];
  /** The stage open on first view: the `here` stage. */
  initialOpen: StageKey;
  skillsTitle: string;
  skills: SkillRowView[];
  /** Grown-up only. */
  skillsNote: string | null;
  tiles: string | null;
  gains: GainTileView[];
  storiesNote: string | null;
}

export interface MyRouteViewInput {
  model: MyRouteModel;
  messages: Messages;
  viewer: Viewer;
  /** The profile name; read only for the grown-up view. */
  name: string;
  /** Theme titles in the UI locale. */
  themeTitles: Readonly<Record<ThemeKey, string>>;
  /** The title of the model's next quest (F-ENT-003 `routeNext`) in the UI locale. */
  nextTitle: string | null;
  /** A reviewed shelf story exists (the rest CTA and the stories note). */
  hasStories: boolean;
  /** The record this open started from; never written in read-only mode. */
  seen: SeenRecord | undefined;
  /** The Stage 1 letter wall (`routeLetterWall`, R-7c); none draws no wall. */
  letterWall?: readonly LetterTile[];
  /** The current week of the goal's weekly plan (`planWeekOf`); absent or null shows no plan line. */
  week?: number | null;
  /** Formats the plan's last day for the grown-up "Plan ends" line (LR-OD-7). */
  formatDay?: (day: DateKey) => string;
  /** The first visit that shows this reached goal (LR-5c); never in read-only mode. */
  firstReached?: boolean;
  /** The first free word topic this build lists (`practiceTopicOf`); the free-end hero's Practice words. Absent or null: Open Library. */
  practiceTopic?: string | null;
  /**
   * The episode page shows F-ENT-003's preview, with its own ask, for a quest that is not open
   * (E3-6). Until then the page does not check quest access, so a not-open cell opens nothing: the
   * route never offers a quest it just called "Not open yet". E3-6 passes true (amendment section 4.5).
   */
  notOpenPreview?: boolean;
}

const TONE: Readonly<Record<Exclude<StageState, 'open'>, PillTone>> = {
  complete: 'success',
  known: 'info',
  explored: 'success',
  later: 'neutral',
};
const BADGE: Readonly<Record<StageState, BadgeLook>> = {
  complete: 'complete',
  known: 'known',
  explored: 'explored',
  later: 'later',
  open: 'number',
};
export const SKILL_ICON: Readonly<Record<Skill, RouteIcon>> = { read: 'book', listen: 'ear', write: 'pencil' };
/** The glyph beside each trail tag (LR-D `route-card.md`, "Three tags at 320"): the order no longer decides it. */
const TAG_GLYPH: Readonly<Record<StageTagKind, TagView['glyph']>> = { here: null, goal: 'flag', start: 'pin' };

type GameKey = Exclude<keyof Messages['learner']['myRoute']['games'], 'title' | 'note'>;

/**
 * The game name per kind that counts for a skill (OD-5). Exhaustive over the
 * kinds `SKILL_OF_KIND` maps to a skill (a test checks), so a new mapping
 * cannot ship without a name in the sheet.
 */
export const GAME_NAME_KEY: Readonly<Partial<Record<MinigameKind, GameKey>>> = {
  'match-sound': 'matchSound',
  'tap-respond': 'tapRespond',
  'listen-pick': 'listenPick',
  'match-shape': 'matchShape',
  'odd-one-out': 'oddOneOut',
  'pic-word-match': 'picWordMatch',
  'story-read': 'storyRead',
  'trace-stroke': 'traceStroke',
};

export function gamesFor(skill: Skill, games: Messages['learner']['myRoute']['games']): string[] {
  return (Object.keys(SKILL_OF_KIND) as MinigameKind[]).flatMap((kind) => {
    const key = GAME_NAME_KEY[kind];
    return SKILL_OF_KIND[kind].includes(skill) && key !== undefined ? [games[key]] : [];
  });
}

const buildsOf = (skills: readonly Skill[], m: Messages['learner']['myRoute']) =>
  skills.map((skill) => ({ skill, label: m.skill[skill], icon: SKILL_ICON[skill] }));

const questPips = (row: StageRow): Pip[] => [...row.pips.filter((p) => p.kind === 'quest'), ...row.newPips];

/** The narrow bar: done quests out of the stage's quests; a latched stage keeps its full bar (the earned group stays full). */
export function stageFill(row: StageRow): { value: number; max: number } | null {
  const quests = questPips(row);
  if (quests.length === 0) return null;
  if (row.latched) return { value: 1, max: 1 };
  return { value: quests.filter((p) => p.state === 'done').length, max: quests.length };
}

/** The pip groups of a stage row, empty groups dropped (wireframe A: Stage 2 "(O)(O) (L)(L)(L)"; C5 the new group). */
export function stageGroups(row: StageRow): Pip[][] {
  return [row.pips.filter((p) => p.kind === 'quest'), row.pips.filter((p) => p.kind === 'cell'), row.newPips].filter((g) => g.length > 0);
}

function stageRowView(row: StageRow, ctx: CopyContext, i: MyRouteViewInput, fresh: ReadonlySet<string>): StageRowView {
  const m = i.messages.learner.myRoute;
  const inPlan = new Set(ctx.viewer === 'self' ? i.model.inPlanEpisodeIds : []);
  return {
    kind: 'stage',
    key: row.stage,
    stage: row.stage,
    order: row.order,
    title: row.title,
    stateWord: stageStateWord(row, ctx),
    tone: row.state === 'open' ? (row.availability === 'taste' ? 'secondary' : 'primary') : TONE[row.state],
    badge: BADGE[row.state],
    captions: stageCaptions(row, ctx),
    tags: stageTagList(row, ctx).map((tag) => ({ label: tag.label, glyph: TAG_GLYPH[tag.kind] })),
    a11yLabel: stageA11yLabel(row, ctx),
    groups: stageGroups(row),
    fill: stageFill(row),
    canDo: canDoCopy(row, ctx),
    builds: buildsOf(row.builds, m),
    cells: row.cells.map((cell) => {
      const themeLabel = i.themeTitles[cell.theme];
      const word = cellWord(cell, ctx);
      const planTag = cell.episodeId !== null && inPlan.has(cell.episodeId) ? i.messages.learner.routeNext.tag.inPlan : null;
      const label = i.messages.a11y.myRoute.cell(themeLabel, cell.title, word);
      return {
        key: `${cell.stage}-${cell.theme}`,
        themeLabel,
        title: cell.title,
        word,
        pips: cell.pips,
        // A grown-up never opens an episode from here: EpisodeDetail plays as the device's active learner (amendment 5.1, 6.2).
        // A not-open cell (F-ENT-003 quest access, `laterReason: 'notOpen'`) in a stage the learner may enter opens its
        // page once that page is F-ENT-003's preview with its own ask (`notOpenPreview`, E3-6), so the route page itself
        // has none (section 4.5). A coming-later cell, or any cell of a stage the learner is not entitled to (OD-4's other
        // branch), opens nothing.
        episodeId:
          ctx.viewer === 'grownup' ||
          (cell.state === 'later' && (i.notOpenPreview !== true || row.state === 'later' || !cell.pips.some((p) => p.laterReason === 'notOpen')))
            ? null
            : cell.episodeId,
        inPlan: planTag,
        a11yLabel: planTag === null ? label : i.messages.a11y.myRoute.cellInPlan(label, planTag),
      };
    }),
    fresh: [...row.pips, ...row.newPips].some((p) => fresh.has(p.key)),
    connector: null,
    letterWall: row.stage === 'stage1' ? letterWallView(i.letterWall ?? [], i.messages) : null,
    notOpenLegend: row.cells.some((cell) => cell.pips.some((p) => p.laterReason === 'notOpen')),
  };
}

function laterRowView(rows: readonly StageRow[], label: string, ctx: CopyContext, i: MyRouteViewInput): LaterRowView {
  const m = i.messages.learner.myRoute;
  const first = rows[0] as StageRow;
  const merged = rows.length > 1;
  const stateWord = stageStateWord(first, ctx);
  return {
    kind: 'later',
    key: `later:${rows.map((r) => r.stage).join('-')}`,
    stage: first.stage,
    order: first.order,
    merged,
    title: merged ? label : first.title,
    stateWord,
    a11yLabel: merged ? i.messages.a11y.myRoute.later(label, stateWord) : stageA11yLabel(first, ctx),
    tags: merged ? [] : stageTagList(first, ctx).map((tag) => ({ label: tag.label, glyph: TAG_GLYPH[tag.kind] })),
    details: rows.map((r) => ({ stage: r.stage, order: r.order, title: r.title, canDo: m.stage.canDo[r.order], builds: buildsOf(r.builds, m) })),
    note: m.laterNote,
    connector: null,
  };
}

const firstStageOf = (row: TrailRowView): StageKey => row.stage;

/** Joins the rows with the trail line: solid into every stage up to `trailReached`, dotted below it (section 3.11). */
export function withConnectors(rows: TrailRowView[], model: Pick<MyRouteModel, 'stages' | 'trailReached'>): TrailRowView[] {
  const index = (stage: StageKey): number => model.stages.findIndex((s) => s.stage === stage);
  return rows.map((row, k) => {
    const next = rows[k + 1];
    const connector: Connector = next === undefined ? null : index(firstStageOf(next)) <= model.trailReached ? 'solid' : 'dotted';
    return { ...row, connector };
  });
}

/** One skill row: the word, an absolute count and its earned marks (also the parent dashboard's mini rows, R-9b). */
export function skillRowView(row: MyRouteModel['skills'][number], ctx: CopyContext, m: Messages): SkillRowView {
  const { label, detail } = skillCopy(row, ctx);
  const marks: Pip[] = Array.from({ length: row.marks }, (_, k) => ({ key: `${row.skill}-mark-${k}`, kind: 'quest', state: 'done', isCursor: false, isStart: false }));
  if (row.quests > 0 && row.nextReachable) marks.push({ key: `${row.skill}-next`, kind: 'quest', state: 'open', isCursor: false, isStart: false });
  const games = m.learner.myRoute.games;
  return {
    skill: row.skill,
    icon: SKILL_ICON[row.skill],
    label,
    detail,
    marks,
    a11yLabel: m.a11y.myRoute.skill(label, detail),
    sheet: { title: games.title(label), note: games.note, games: gamesFor(row.skill, games) },
  };
}

/** Cards and stories open the Library on the learner's own page; never for a grown-up (the Library runs as the active learner). */
function gainTiles(model: MyRouteModel, m: Messages, viewer: CopyContext['viewer']): GainTileView[] {
  const words = m.learner.myRoute.gains;
  const tiles: GainTileView[] = [
    { key: 'stars', icon: 'star', value: model.gains.stars, label: words.stars, a11yLabel: '', opensLibrary: false },
    { key: 'cards', icon: 'card', value: model.gains.cards, label: words.cards, a11yLabel: '', opensLibrary: true },
    { key: 'stories', icon: 'book', value: model.gains.storiesRead, label: words.stories, a11yLabel: '', opensLibrary: true },
  ];
  return tiles
    .filter((t) => t.value > 0)
    .map((t) => ({ ...t, opensLibrary: t.opensLibrary && viewer === 'self', a11yLabel: m.a11y.myRoute.gain(t.label, t.value) }));
}

/** Pip keys done since the last open; nothing on the very first open (section 3.10). */
function freshKeys(model: MyRouteModel, seen: SeenRecord | undefined): Set<string> {
  if (seen === undefined) return new Set();
  const had = new Set(seen.doneKeys);
  return new Set(model.stages.flatMap((s) => [...s.pips, ...s.newPips]).filter((p) => p.state === 'done' && !had.has(p.key)).map((p) => p.key));
}

export function myRouteView(i: MyRouteViewInput): MyRouteView {
  const { model, messages } = i;
  const ctx: CopyContext = { viewer: i.viewer, name: i.name, m: myRouteMessages(messages), goalStage: model.goal?.stage ?? null };
  const week = i.week;
  const fresh = freshKeys(model, i.seen);
  const rows: TrailRowView[] = trailEntries(model, ctx).map((entry) =>
    entry.kind === 'stage' ? stageRowView(entry.row, ctx, i, fresh) : laterRowView(entry.rows, entry.label, ctx, i),
  );
  const here = model.stages.find((s) => s.here) as StageRow;
  return {
    hero: model.hero,
    heroCopy: heroCopy(model, ctx, { nextTitle: i.nextTitle, hasStories: i.hasStories, canPracticeWords: typeof i.practiceTopic === 'string' }),
    routeCard: routeCardCopy(model, ctx, {
      nextTitle: i.nextTitle,
      ...(i.firstReached === undefined ? {} : { firstReached: i.firstReached }),
      ...(i.formatDay === undefined ? {} : { formatDay: i.formatDay }),
    }),
    // The learner's own weekly plan week only: grown-up views carry the plan end date instead (LR-OD-7).
    planLine: i.viewer === 'self' && typeof week === 'number' && week >= 1 ? messages.learner.myRoute.home.strip.week(week) : null,
    // Hoya cheers on the first visit that shows a reached goal (LR-5c), as after a newly completed episode.
    pose: i.viewer === 'self' && i.firstReached === true ? 'cheering' : hoyaPoseFor(model, i.seen),
    viewing: viewingCopy(ctx),
    newQuests: newQuestsCopy(model, ctx),
    trail: withConnectors(rows, model),
    initialOpen: here.stage,
    skillsTitle: skillsTitle(ctx),
    skills: model.skills.map((row) => skillRowView(row, ctx, messages)),
    skillsNote: skillsNoteCopy(ctx),
    tiles: tilesCopy(model, ctx),
    gains: gainTiles(model, messages, i.viewer),
    // The note is the learner's link to the Library: not on a grown-up's read-only page.
    storiesNote: i.hasStories && i.viewer === 'self' ? messages.learner.myRoute.storiesNote : null,
  };
}
