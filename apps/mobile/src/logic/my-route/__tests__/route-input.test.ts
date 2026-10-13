import { describe, expect, it } from 'vitest';
import { episodesAll, heritageCardsAll, questsAll, stages, themes } from '../../../content';
import { journeyContent } from '../../../content/sync-context';
import { localizeEpisode, localizeStage, localizeTheme } from '../../content-locale';
import { cursorContext } from '../../cursor-context';
import { buildMyRoute } from '../model';
import { localizedRouteContent, routeLetterWall, routeModelInput } from '../route-input';
import { startRouteOf } from '../start-marker';
import type { SeenRecord } from '../types';
import { emptySnapshot } from '../view';

/**
 * One input for the Learning Route page and the Home strip (F-ROUTE-001 R-4b):
 * both screens build `buildMyRoute` from here, so the strip and the page always
 * name the same stage and pips, with the same localized titles.
 */

const NOW = new Date('2026-10-11T00:00:00.000Z');

describe('localizedRouteContent', () => {
  it('localizes the stages, themes and episodes for the locale', () => {
    for (const locale of ['en', 'ko', 'es'] as const) {
      const c = localizedRouteContent(locale);
      expect(c.stages).toEqual(stages.map((s) => localizeStage(s, locale)));
      expect(c.themes).toEqual(themes.map((t) => localizeTheme(t, locale)));
      expect(c.episodes).toEqual(episodesAll.map((e) => localizeEpisode(e, locale)));
    }
  });
});

describe('routeModelInput', () => {
  const snapshot = emptySnapshot('p1');
  const localized = localizedRouteContent('ko');

  it('passes the shared catalog, quests, cards, cursor and start route with the localized content', () => {
    const input = routeModelInput({ snapshot, tier: 'free', localized, now: NOW });
    const cursor = cursorContext({ tier: 'free', placements: snapshot.placements, quests: questsAll, episodes: episodesAll });
    expect(input.snapshot).toBe(snapshot);
    expect(input.catalog).toBe(journeyContent.catalog);
    expect(input.quests).toBe(questsAll);
    expect(input.cards).toBe(heritageCardsAll);
    expect(input.episodes).toBe(localized.episodes);
    expect(input.stages).toBe(localized.stages);
    expect(input.themes).toBe(localized.themes);
    expect(input.skipQuestIds).toEqual(cursor.skipQuestIds);
    expect(input.route).toEqual(startRouteOf(snapshot.placements, journeyContent.catalog, cursor.isEntitled));
    expect(input.seen).toBeUndefined();
    expect(input.now).toBe(NOW);
    for (const s of stages) expect(input.isEntitled(s.key)).toBe(cursor.isEntitled(s.key));
  });

  it('carries the seen record when the page has one', () => {
    const seen: SeenRecord = { totals: {}, doneKeys: [], at: '2026-10-10T00:00:00.000Z' };
    expect(routeModelInput({ snapshot, tier: 'free', localized, seen, now: NOW }).seen).toBe(seen);
  });

  it('builds a model with exactly one here stage', () => {
    const model = buildMyRoute(routeModelInput({ snapshot, tier: 'free', localized, now: NOW }));
    expect(model.stages).toHaveLength(7);
    expect(model.stages.filter((s) => s.here)).toHaveLength(1);
  });
});

describe('routeLetterWall (R-7c)', () => {
  const localized = localizedRouteContent('en');
  const build = (snapshot: ReturnType<typeof emptySnapshot>) => buildMyRoute(routeModelInput({ snapshot, tier: 'free', localized, now: NOW }));

  it('draws the 30 Stage 1 letters of the shipped bundle, none lit for a new learner', () => {
    const tiles = routeLetterWall(build(emptySnapshot('p1')));
    expect(tiles).toHaveLength(30);
    expect(tiles.every((t) => t.state === 'ahead')).toBe(true);
  });

  it('lights the letters of a finished quest from the page model', () => {
    const snapshot = emptySnapshot('p1');
    const done = {
      ...snapshot,
      quests: [
        {
          questId: 'quest:stage1-letters-q1',
          episodeId: 'episode:stage1-letters',
          startedAt: '2026-10-10T00:00:00.000Z',
          completedAt: '2026-10-10T00:05:00.000Z',
          stars: 3 as const,
          attempts: 1,
          accuracy: 1,
        },
      ],
    };
    const lit = routeLetterWall(build(done)).filter((t) => t.state === 'met').map((t) => t.key);
    expect(lit).toEqual(['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ']);
  });

  it('draws nothing for a model without a Stage 1 row', () => {
    const model = build(emptySnapshot('p1'));
    expect(routeLetterWall({ ...model, stages: model.stages.filter((s) => s.stage !== 'stage1') })).toEqual([]);
  });
});
