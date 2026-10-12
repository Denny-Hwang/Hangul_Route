import type { Episode, Quest, RouteCatalog, StageDef, ThemeDef, ThemeKey } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { canDoCopy, cellWord, stageA11yLabel, stageStateWord, trailEntries, type CopyContext } from './copy';
import { gridEpisodesOf, routeOrder } from './order';
import { buildStageRows } from './stage-rows';
import type { MyRouteInput, Skill, StageRow } from './types';
import { SKILL_ICON, emptySnapshot, myRouteMessages, withConnectors, type LaterRowView, type StageRowView, type TrailRowView } from './view';

/**
 * The Learning Route trail with no learner model (F-BROWSE-001 §4.5, BR-5b): what All lessons draws
 * with the learner's own `TrailRow`. Every stage as a learner with nothing done sees it, minus
 * everything about a learner: the stage name, its one-liner and the availability word the learner
 * trail uses ("A taste", "Coming later"); no here tag, no start tag, no pip filled, no cursor, a
 * dotted trail line. Coming-later stages merge into one row as on the learner trail. Pure.
 */

export interface CatalogueTrailInput {
  /** Every bundled episode; shelf episodes are left out here. */
  episodes: readonly Episode[];
  quests: readonly Quest[];
  catalog: RouteCatalog;
  /** Stage definitions in the UI locale (`localizeStage`): title and one-liner. */
  stages: readonly Pick<StageDef, 'key' | 'order' | 'titleEn' | 'oneLinerEn'>[];
  /** Theme definitions in the UI locale (`localizeTheme`). */
  themes: readonly Pick<ThemeDef, 'key' | 'order' | 'titleEn'>[];
  messages: Messages;
}

const NOTHING: ReadonlySet<string> = new Set();

const buildsOf = (skills: readonly Skill[], m: Messages['learner']['myRoute']) =>
  skills.map((skill) => ({ skill, label: m.skill[skill], icon: SKILL_ICON[skill] }));

/** No learner: every shipped stage is open to look at, nothing done, nothing placed out, no cursor and no start. */
function catalogueStageRows(i: CatalogueTrailInput): StageRow[] {
  const input: MyRouteInput = {
    snapshot: emptySnapshot(''),
    catalog: i.catalog,
    episodes: i.episodes,
    quests: i.quests,
    cards: [],
    stages: i.stages,
    themes: i.themes,
    isEntitled: () => true,
    route: null,
    now: new Date(0),
  };
  const rows = buildStageRows(input, {
    gridEpisodes: gridEpisodesOf(i.episodes),
    pips: {
      order: routeOrder(input),
      done: NOTHING,
      placedOut: NOTHING,
      latched: new Set(),
      isEntitled: () => true,
      cursorId: null,
      startId: null,
    },
    cursorStage: null,
    startStage: null,
    startTagStage: null,
  });
  // `buildStageRows` always names one `here` stage for a learner; a catalogue has none.
  return rows.map((r) => ({ ...r, here: false, isStart: false }));
}

function stageRowView(row: StageRow, ctx: CopyContext, i: CatalogueTrailInput, themeTitles: ReadonlyMap<ThemeKey, string>): StageRowView {
  const m = i.messages;
  const isLater = row.state === 'later';
  return {
    kind: 'stage',
    key: row.stage,
    stage: row.stage,
    order: row.order,
    title: row.title,
    stateWord: stageStateWord(row, ctx),
    tone: isLater ? 'neutral' : row.availability === 'taste' ? 'secondary' : 'primary',
    badge: isLater ? 'later' : 'number',
    captions: [i.stages.find((s) => s.key === row.stage)?.oneLinerEn ?? ''].filter((line) => line.length > 0),
    tags: [],
    a11yLabel: stageA11yLabel(row, ctx),
    groups: [],
    fill: null,
    canDo: canDoCopy(row, ctx),
    builds: buildsOf(row.builds, m.learner.myRoute),
    cells: row.cells.map((cell) => {
      const themeLabel = themeTitles.get(cell.theme) ?? cell.theme;
      const word = cellWord(cell, ctx);
      return {
        key: `${cell.stage}-${cell.theme}`,
        themeLabel,
        title: cell.title,
        word,
        pips: cell.pips,
        episodeId: cell.state === 'later' ? null : cell.episodeId,
        a11yLabel: m.a11y.myRoute.cell(themeLabel, cell.title, word),
      };
    }),
    fresh: false,
    connector: null,
  };
}

function laterRowView(rows: readonly StageRow[], label: string, ctx: CopyContext, i: CatalogueTrailInput): LaterRowView {
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
    details: rows.map((r) => ({ stage: r.stage, order: r.order, title: r.title, canDo: m.stage.canDo[r.order], builds: buildsOf(r.builds, m) })),
    note: m.laterNote,
    connector: null,
  };
}

export function catalogueTrail(i: CatalogueTrailInput): TrailRowView[] {
  const stages = catalogueStageRows(i);
  const ctx: CopyContext = { viewer: 'self', name: '', m: myRouteMessages(i.messages) };
  const themeTitles = new Map(i.themes.map((t) => [t.key, t.titleEn]));
  const rows: TrailRowView[] = trailEntries({ stages }, ctx).map((entry) =>
    entry.kind === 'stage' ? stageRowView(entry.row, ctx, i, themeTitles) : laterRowView(entry.rows, entry.label, ctx, i),
  );
  // Nothing reached, as for a learner with nothing done: the line is dotted below every row.
  return withConnectors(rows, { stages, trailReached: 0 });
}
