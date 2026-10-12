import { StageKeySchema, type StageKey } from '@hangul-route/content-schema';
import { offerableQuests } from '../next-quest';
import { routeCursor } from './cursor';
import { gainsOf } from './gains';
import { gridEpisodesOf, routeOrder, type RouteEntry } from './order';
import { skillRows, tilesCount } from './skills';
import { stagesToLatch } from './latch';
import { buildStageRows } from './stage-rows';
import { startMarkerOf } from './start-marker';
import type { Hero, MyRouteInput, MyRouteModel, StageRow } from './types';

/**
 * `buildMyRoute` (F-ROUTE-001 section 3.2): the snapshot, the bundled
 * content, the route catalogue and the injected entitlement in, one
 * `MyRouteModel` out. Pure: no React, no platform, no clock read, no
 * randomness. Works offline.
 */

const isStageKey = (key: string): key is StageKey => StageKeySchema.safeParse(key).success;

/** `start` only for a learner with nothing done and no start marker (section 3.5); a start marker means `continue`. */
function heroOf(m: { cursor: MyRouteModel['cursor']; anyDone: boolean; hasStart: boolean; route: MyRouteInput['route'] }): Hero {
  if (m.cursor === null) return m.route?.beyondContent === true && m.route.needsStage === null ? 'beyond' : 'rest';
  return m.anyDone || m.hasStart ? 'continue' : 'start';
}

/**
 * The connector fills down to the highest stage with a done or known pip. With
 * a route it also counts every quest any stored result ever placed out,
 * including the prefix an earlier grown-up override placed out, so a later
 * override that puts quests back never retracts it.
 */
function trailReachedOf(rows: readonly StageRow[], input: MyRouteInput, order: readonly RouteEntry[]): number {
  const reached = rows.filter((r) => r.done > 0 || r.known > 0).map((r) => r.order - 1);
  if (input.route !== null) {
    const index = new Map(order.map((e, i) => [e.questId, i]));
    let highest = -1;
    for (const p of input.snapshot.placements ?? []) {
      for (const id of p.placedOutQuestIds) highest = Math.max(highest, index.get(id) ?? -1);
      if (p.override !== undefined) highest = Math.max(highest, (index.get(p.override.startQuestId) ?? 0) - 1);
    }
    const entry = order[highest];
    if (entry !== undefined) reached.push(StageKeySchema.options.indexOf(entry.stage));
  }
  return Math.max(0, ...reached);
}

export function buildMyRoute(input: MyRouteInput): MyRouteModel {
  const { snapshot, route } = input;
  const gridEpisodes = gridEpisodesOf(input.episodes);
  const order = routeOrder(input);
  const done = new Set(snapshot.quests.filter((q) => q.completedAt).map((q) => q.questId));
  const placedOut = new Set(route?.placedOutQuestIds ?? []);
  const latched = new Set(Object.keys(snapshot.stageDoneAt ?? {}).filter(isStageKey));
  const isEntitled = (stage: string): boolean => isStageKey(stage) && input.isEntitled(stage);

  const cursorQuest = routeCursor({
    snapshot,
    quests: input.quests,
    episodes: input.episodes,
    isEntitled,
    skipQuestIds: new Set([...placedOut, ...(input.skipQuestIds ?? [])].filter((id) => !done.has(id))),
  });
  const cursorEntry = order.find((e) => e.questId === cursorQuest?.id);
  const cursor = cursorEntry ? { questId: cursorEntry.questId, episodeId: cursorEntry.episodeId, stage: cursorEntry.stage } : null;
  const startQuest = route?.startQuestId ? input.catalog.quests.find((q) => q.id === route.startQuestId) : undefined;
  const start = startMarkerOf(route, order);

  const stages = buildStageRows(input, {
    gridEpisodes,
    pips: { order, done, placedOut, latched, isEntitled: input.isEntitled, cursorId: cursor?.questId ?? null, startId: start?.questId ?? null },
    cursorStage: cursor?.stage ?? null,
    startStage: startQuest?.stage ?? null,
    startTagStage: start?.stage ?? null,
  });

  const open = new Set(offerableQuests(input.quests, input.episodes, isEntitled).map((q) => q.id));
  return {
    hero: heroOf({ cursor, anyDone: stages.some((s) => s.done > 0), hasStart: start !== null, route }),
    cursor,
    stages,
    trailReached: trailReachedOf(stages, input, order),
    skills: skillRows({ finished: done, open, quests: input.quests }),
    tiles: tilesCount(done, input.quests),
    gains: gainsOf({ snapshot, episodes: input.episodes }),
    start,
    latchesToWrite: stagesToLatch(snapshot, input.episodes),
  };
}
