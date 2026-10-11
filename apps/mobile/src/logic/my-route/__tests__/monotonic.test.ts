import { describe, expect, it } from 'vitest';
import { StageKeySchema, effectiveRoute, type Episode, type PlacementResult, type Quest, type StageKey } from '@hangul-route/content-schema';
import { isGridEpisode, routeOrder } from '../order';
import { buildMyRoute } from '../model';
import type { MyRouteModel, Pip } from '../types';
import { BUNDLE_8, STAGE_DEFS, THEME_DEFS, catalogOf, quest, snapshotWith, type Bundle } from './fixtures/bundle-2026-10';
import { result } from './fixtures/route';

/**
 * Fill-only guarantees (F-ROUTE-001 section 3.4) as a property test: random
 * runs of "finish a quest", "ship a cell", "grow a cell", "entitlement change",
 * "placement" and "override", with the latch writer applied after every step.
 */

const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Action = 'finish' | 'ship' | 'grow' | 'entitlement' | 'placement' | 'override';
const ACTIONS: readonly Action[] = ['finish', 'finish', 'finish', 'ship', 'grow', 'entitlement', 'placement', 'override'];
const CONTENT: ReadonlySet<Action> = new Set(['ship', 'grow']);

interface World {
  bundle: Bundle;
  done: string[];
  stageDoneAt: Record<string, string>;
  placements: PlacementResult[];
  entitled: Set<StageKey>;
  fresh: number;
}

const modelOf = (w: World): MyRouteModel => {
  const catalog = catalogOf(w.bundle);
  const isEntitled = (s: StageKey) => w.entitled.has(s);
  return buildMyRoute({
    snapshot: snapshotWith(w.done, { stageDoneAt: { ...w.stageDoneAt }, placements: w.placements }),
    catalog,
    episodes: w.bundle.episodes,
    quests: w.bundle.quests,
    cards: [],
    stages: STAGE_DEFS,
    themes: THEME_DEFS,
    isEntitled,
    route: effectiveRoute(w.placements, catalog, { isEntitled, completedQuestIds: new Set() }),
    now: new Date('2026-10-11T00:00:00.000Z'),
  });
};

const allPips = (m: MyRouteModel): Pip[] => m.stages.flatMap((s) => [...s.pips, ...s.newPips]);
const keysIn = (m: MyRouteModel, state: Pip['state']) => new Set(allPips(m).filter((p) => p.state === state).map((p) => p.key));
const share = (pips: readonly Pip[]) => (pips.length === 0 ? 1 : pips.filter((p) => p.state === 'done').length / pips.length);

function step(w: World, action: Action, rnd: () => number): void {
  const pick = <T,>(xs: readonly T[]): T | undefined => xs[Math.floor(rnd() * xs.length)];
  const order = routeOrder({ catalog: catalogOf(w.bundle), episodes: w.bundle.episodes, quests: w.bundle.quests });
  const addQuest = (e: Episode): Episode => {
    w.fresh += 1;
    const id = `quest:${e.stage}-${e.theme}-n${w.fresh}`;
    w.bundle = { ...w.bundle, quests: [...w.bundle.quests, quest(id, id, ['match-sound'])] as Quest[] };
    return { ...e, questIds: [...e.questIds, id], status: 'shipped' };
  };
  switch (action) {
    case 'finish': {
      const id = pick(order.map((o) => o.questId).filter((q) => !w.done.includes(q)));
      if (id) w.done.push(id);
      break;
    }
    case 'ship':
    case 'grow': {
      const wanted = action === 'ship' ? 'preview' : 'shipped';
      const target = pick(w.bundle.episodes.filter((e) => isGridEpisode(e) && e.status === wanted));
      if (target) w.bundle = { ...w.bundle, episodes: w.bundle.episodes.map((e) => (e.id === target.id ? addQuest(e) : e)) };
      break;
    }
    case 'entitlement': {
      const s = pick(StageKeySchema.options) as StageKey;
      if (w.entitled.has(s)) w.entitled.delete(s);
      else w.entitled.add(s);
      break;
    }
    case 'placement': {
      const prefix = order.slice(0, Math.floor(rnd() * (order.length + 1))).map((o) => o.questId);
      w.placements.push(result({ placedOutQuestIds: prefix }));
      break;
    }
    case 'override': {
      const chosen = pick(order);
      if (chosen) w.placements.push(result({ override: { by: 'parent', at: 't', startQuestId: chosen.questId } }));
      break;
    }
  }
}

describe('my-route is fill-only (property)', () => {
  it('holds over 80 random runs of 30 steps', () => {
    for (let run = 0; run < 80; run += 1) {
      const rnd = mulberry32(run + 1);
      const w: World = { bundle: BUNDLE_8, done: [], stageDoneAt: {}, placements: [], entitled: new Set(StageKeySchema.options), fresh: 0 };
      let prev = modelOf(w);
      for (let i = 0; i < 30; i += 1) {
        const action = ACTIONS[Math.floor(rnd() * ACTIONS.length)] as Action;
        step(w, action, rnd);
        let next = modelOf(w);
        for (const s of next.latchesToWrite) w.stageDoneAt[s] = new Date(Date.UTC(2026, 9, 11, 0, i)).toISOString();
        if (next.latchesToWrite.length > 0) next = modelOf(w);
        const where = `run ${run} step ${i} ${action}`;

        const prevDone = keysIn(prev, 'done');
        const nextDone = keysIn(next, 'done');
        for (const k of prevDone) expect(nextDone.has(k), `${where}: done pip ${k} kept`).toBe(true);

        for (const r of prev.stages) {
          const n = next.stages.find((s) => s.stage === r.stage);
          if (r.latched) {
            expect(n?.state, `${where}: ${r.stage} stays complete`).toBe('complete');
            expect(n?.pips.filter((p) => p.kind === 'quest').every((p) => p.state === 'done'), `${where}: ${r.stage} earned group full`).toBe(true);
          }
          expect(n?.done ?? 0, `${where}: ${r.stage} done count`).toBeGreaterThanOrEqual(r.done);
          if (!CONTENT.has(action)) expect(share(n?.pips ?? []), `${where}: ${r.stage} share`).toBeGreaterThanOrEqual(share(r.pips));
        }

        expect(next.trailReached, `${where}: trail`).toBeGreaterThanOrEqual(prev.trailReached);

        if (action !== 'override') {
          const nextKnown = keysIn(next, 'known');
          for (const k of keysIn(prev, 'known')) expect(nextKnown.has(k) || nextDone.has(k), `${where}: known ${k} only leaves through an override`).toBe(true);
        }
        prev = next;
      }
    }
  }, 60_000);
});
