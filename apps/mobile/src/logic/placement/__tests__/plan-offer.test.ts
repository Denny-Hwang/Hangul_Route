import {
  CATALOG,
  LENGTH_PRESETS,
  PACES,
  generateCurriculum,
  routeCatalogOf,
  questsPlacedOutAtLevel,
  type CurriculumDraft,
  type PlacementResult,
  type RouteProposal,
  type SelfRoute,
} from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { proposalInputOf, type ProposalContext } from '../../route/proposal-flow';
import { selfRouteOf } from '../../route/self-route';
import {
  draftOfOffer,
  grownUpWarningText,
  grownUpWarnings,
  planChangeAt,
  planOfferOf,
  planUpdateSource,
  startPutBack,
  startRaised,
  stripLineOf,
  updatedEvent,
  updatedRouteOf,
} from '../plan-offer';

const NOW = Date.parse('2026-10-12T09:00:00.000Z');
const TODAY = '2026-10-12';
const DAY = 86_400_000;
/** Band 2 places out the first Stage 1 lessons on the live catalogue (the quests that teach what it knows). */
const PLACED_AT_BAND_2 = questsPlacedOutAtLevel({ stage: 'stage1', band: 2 }, routeCatalogOf(CATALOG));

function result(over: Partial<PlacementResult> = {}): PlacementResult {
  return {
    id: 'placement:a',
    completedAt: '2026-10-11T09:00:00.000Z',
    mode: 'standard',
    bankVersion: 1,
    testLocale: 'en',
    source: 'home',
    level: { stage: 'stage1', band: 0 },
    oralStage: null,
    strands: {},
    priorityTokens: [],
    placedOutQuestIds: [],
    startQuestId: 'quest:stage1-letters-q1',
    responses: [],
    ...over,
  } as unknown as PlacementResult;
}

const context = (over: Partial<ProposalContext> = {}): ProposalContext => ({
  placements: [result()],
  completedQuestIds: [],
  ageGroup: '8-9',
  unlockedStages: ['stage1'],
  today: TODAY,
  ...over,
});

/** A plan made before the retake: band 0, three days a week, four weeks. */
function planAtBand0(): SelfRoute {
  const draft = generateCurriculum(
    { audience: 'self', level: { stage: 'stage1', band: 0 }, startDate: '2026-10-05', weeks: 12, sessionsPerWeek: 3, minutesPerSession: 15, unlockedStages: ['stage1'] },
    CATALOG,
  );
  return selfRouteOf(draft, 'route:abc-0001', '2026-10-05T09:00:00.000Z');
}

const offerInput = (over: Partial<Parameters<typeof planOfferOf>[0]> = {}): Parameters<typeof planOfferOf>[0] => ({
  enabled: true,
  context: context(),
  active: null,
  dismissedAt: undefined,
  nowMs: NOW,
  ...over,
});

describe('planOfferOf (F-PLC-001 section 3.1 step 7, AM-1, AM-2, AM-5)', () => {
  it('is null while flags.routeEnabled is off', () => {
    expect(planOfferOf(offerInput({ enabled: false }))).toBeNull();
  });

  it('without a plan: a new proposal per pace chip, the default chip pre-selected (OD-13)', () => {
    const offer = planOfferOf(offerInput());
    expect(offer?.kind).toBe('new');
    if (offer?.kind !== 'new') return;
    // Steady for a self learner whose level is not "Pictures first".
    expect(offer.pace).toBe('steady');
    expect(Object.keys(offer.byPace).sort()).toEqual(['brisk', 'gentle', 'steady']);
    for (const pace of ['gentle', 'steady', 'brisk'] as const) {
      expect(offer.byPace[pace]?.kind).toBe('new');
      expect(offer.byPace[pace]?.params.sessionsPerWeek).toBe(PACES[pace]);
    }
  });

  it('Gentle is pre-selected for "Pictures first" (levelOrder 0)', () => {
    const offer = planOfferOf(offerInput({ context: context({ ageGroup: '5-7' }) }));
    expect(offer?.kind === 'new' ? offer.pace : null).toBe('gentle');
  });

  it('hidden by Not now or Just start until the next result or 14 days (OD-16)', () => {
    const before = '2026-10-11T12:00:00.000Z';
    // Dismissed after the newest result, a day ago: hidden.
    expect(planOfferOf(offerInput({ dismissedAt: before }))).toBeNull();
    // A result newer than the dismissal brings it back.
    expect(planOfferOf(offerInput({ dismissedAt: '2026-10-10T00:00:00.000Z' }))?.kind).toBe('new');
    // Fourteen days later it is back too.
    expect(planOfferOf(offerInput({ dismissedAt: before, nowMs: Date.parse(before) + 14 * DAY }))?.kind).toBe('new');
  });

  it('nothing proposeRoute can lay out: null (the input breaks a params cap)', () => {
    const tooMany = context({ completedQuestIds: Array.from({ length: 401 }, (_, n) => `quest:x${n}`) });
    expect(planOfferOf(offerInput({ context: tooMany }))).toBeNull();
  });

  it('with a plan and a retake that raised the start: an update, whatever the dismissal says', () => {
    const raised = context({
      placements: [result(), result({ id: 'placement:b', completedAt: '2026-10-12T08:00:00.000Z', level: { stage: 'stage1', band: 2 }, placedOutQuestIds: PLACED_AT_BAND_2 })],
    });
    const offer = planOfferOf(offerInput({ context: raised, active: planAtBand0(), dismissedAt: '2026-10-12T08:30:00.000Z' }));
    expect(offer?.kind).toBe('update');
    if (offer?.kind !== 'update') return;
    expect(offer.proposal.kind).toBe('update');
    expect(offer.source).toBe('retake');
  });

  it('a level that rose alone moves none of the plan\'s future: no update', () => {
    const levelOnly = context({ placements: [result(), result({ id: 'placement:b', completedAt: '2026-10-12T08:00:00.000Z', level: { stage: 'stage1', band: 1 } })] });
    const draft = generateCurriculum(
      { audience: 'self', level: { stage: 'stage1', band: 0 }, placedOutQuestIds: [], startDate: '2026-10-05', weeks: 12, sessionsPerWeek: 3, minutesPerSession: 15, unlockedStages: ['stage1'] },
      CATALOG,
    );
    const active = selfRouteOf(draft, 'route:abc-0004', '2026-10-05T09:00:00.000Z');
    expect(planOfferOf(offerInput({ context: levelOnly, active }))).toBeNull();
  });

  it('with a plan and nothing new: null (no strip, the plan stays)', () => {
    expect(planOfferOf(offerInput({ active: planAtBand0() }))).toBeNull();
  });

  it('with a plan and a grown-up override that put quests back: an override update whose future regains them (AM-2, AM-7)', () => {
    const earlier = context({
      placements: [
        result({ level: { stage: 'stage1', band: 2 }, placedOutQuestIds: PLACED_AT_BAND_2, override: { by: 'parent', at: '2026-10-12T08:00:00.000Z', startQuestId: 'quest:stage1-letters-q1' } } as Partial<PlacementResult>),
      ],
    });
    const draft = generateCurriculum(
      {
        audience: 'self',
        level: { stage: 'stage1', band: 2 },
        placedOutQuestIds: PLACED_AT_BAND_2,
        startDate: '2026-10-05',
        weeks: 12,
        sessionsPerWeek: 3,
        minutesPerSession: 15,
        unlockedStages: ['stage1'],
      },
      CATALOG,
    );
    const active = selfRouteOf(draft, 'route:abc-0002', '2026-10-05T09:00:00.000Z');
    const offer = planOfferOf(offerInput({ context: earlier, active }));
    expect(offer?.kind).toBe('update');
    if (offer?.kind !== 'update') return;
    expect(offer.source).toBe('override');
    expect(offer.proposal.diff?.itemsAdded ?? 0).toBeGreaterThan(0);
    // The stored update is built from the same input the proposal was made from.
    const next = updatedRouteOf(active, offer.input, '2026-10-12T09:00:00.000Z');
    if (next === null) throw new Error('expected a route');
    const future = next.items.filter((item) => (item.targetDate ?? '') >= TODAY).map((item) => item.id);
    expect(PLACED_AT_BAND_2.some((id) => future.includes(id))).toBe(true);
    expect(next.meta.params.placedOutQuestIds ?? []).toEqual([]);
  });

  it('Keep my plan / Not now on an update hides it until the start changes again', () => {
    const raised = context({
      placements: [result(), result({ id: 'placement:b', completedAt: '2026-10-12T08:00:00.000Z', level: { stage: 'stage1', band: 2 }, placedOutQuestIds: PLACED_AT_BAND_2 })],
    });
    expect(planOfferOf(offerInput({ context: raised, active: planAtBand0(), keptFor: '2026-10-12T08:00:00.000Z' }))).toBeNull();
    // Kept for an older change: the newest one is offered.
    expect(planOfferOf(offerInput({ context: raised, active: planAtBand0(), keptFor: '2026-10-11T09:00:00.000Z' }))?.kind).toBe('update');
  });

  it('a first check after a plan made from Home: the update is read from the plan, not from a previous result', () => {
    const first = context({ placements: [result({ level: { stage: 'stage1', band: 2 }, placedOutQuestIds: PLACED_AT_BAND_2 })] });
    const offer = planOfferOf(offerInput({ context: first, active: planAtBand0() }));
    expect(offer?.kind === 'update' ? offer.source : null).toBe('retake');
  });
});

describe('startPutBack and planChangeAt', () => {
  const stored = { level: { stage: 'stage1', band: 0 } as const, placedOutQuestIds: ['quest:a', 'quest:b'] };
  it('a quest the plan skips that the seed no longer skips: put back; a superset or no seed: not', () => {
    expect(startPutBack({ level: { stage: 'stage1', band: 0 }, placedOutQuestIds: ['quest:a'] }, stored, routeCatalogOf(CATALOG))).toBe(true);
    expect(startPutBack({ level: { stage: 'stage1', band: 0 }, placedOutQuestIds: ['quest:a', 'quest:b', 'quest:c'] }, stored, routeCatalogOf(CATALOG))).toBe(false);
    expect(startPutBack(null, stored, routeCatalogOf(CATALOG))).toBe(false);
  });

  it('planChangeAt: the newest result time or override time', () => {
    expect(planChangeAt(undefined)).toBeUndefined();
    expect(planChangeAt([result()])).toBe('2026-10-11T09:00:00.000Z');
    const overridden = result({ override: { by: 'parent', at: '2026-10-12T10:00:00.000Z', startQuestId: 'quest:x' } } as Partial<PlacementResult>);
    expect(planChangeAt([result({ id: 'placement:z', completedAt: '2026-10-12T09:00:00.000Z' }), overridden])).toBe('2026-10-12T10:00:00.000Z');
  });
});

describe('startRaised', () => {
  const stored = { level: { stage: 'stage1', band: 0 } as const, placedOutQuestIds: ['quest:a'] };
  const seed = (level: { stage: 'stage1'; band: 0 | 1 | 2 | 3 }, ids: string[]) => ({ level, placedOutQuestIds: ids });

  it('more placed out, or a higher level with the same set: raised', () => {
    expect(startRaised(seed({ stage: 'stage1', band: 0 }, ['quest:a', 'quest:b']), stored, routeCatalogOf(CATALOG))).toBe(true);
    expect(startRaised(seed({ stage: 'stage1', band: 1 }, ['quest:a']), stored, routeCatalogOf(CATALOG))).toBe(true);
  });

  it('a put-back quest (override) or no change: not raised; no seed: not raised', () => {
    expect(startRaised(seed({ stage: 'stage1', band: 1 }, []), stored, routeCatalogOf(CATALOG))).toBe(false);
    expect(startRaised(seed({ stage: 'stage1', band: 0 }, ['quest:a']), stored, routeCatalogOf(CATALOG))).toBe(false);
    expect(startRaised(null, stored, routeCatalogOf(CATALOG))).toBe(false);
  });

  it('a stored plan without its own set reads the set of its level', () => {
    const atBand2 = { level: { stage: 'stage1', band: 2 } as const };
    expect(startRaised(seed({ stage: 'stage1', band: 2 }, PLACED_AT_BAND_2), atBand2, routeCatalogOf(CATALOG))).toBe(false);
  });
});

describe('the strip and the grown-up card', () => {
  it('stripLineOf: the suggested length, days a week and minutes of a proposal', () => {
    const offer = planOfferOf(offerInput());
    if (offer?.kind !== 'new') throw new Error('expected a new offer');
    const steady = offer.byPace.steady;
    if (steady === undefined) throw new Error('expected steady');
    expect(stripLineOf(steady)).toEqual({ length: steady.defaultId, days: 3, minutes: 15 });
  });

  it('draftOfOffer: the plan exactly as shown, at the suggested length or the one picked', () => {
    const offer = planOfferOf(offerInput());
    if (offer?.kind !== 'new') throw new Error('expected a new offer');
    const proposal = offer.byPace.gentle;
    if (proposal === undefined) throw new Error('expected gentle');
    const draft = draftOfOffer(proposal) as CurriculumDraft;
    expect(draft.params.weeks).toBe(LENGTH_PRESETS[proposal.defaultId].weeks);
    expect(draft.params.sessionsPerWeek).toBe(2);
    expect(draftOfOffer(proposal, '6-month')?.params.weeks).toBe(26);
  });

  it('draftOfOffer is null when the params break a cap', () => {
    const offer = planOfferOf(offerInput());
    if (offer?.kind !== 'new' || offer.byPace.steady === undefined) throw new Error('expected a new offer');
    const broken = { ...offer.byPace.steady, params: { ...offer.byPace.steady.params, minutesPerSession: -1 } } as unknown as RouteProposal;
    expect(draftOfOffer(broken)).toBeNull();
  });

  it('grownUpWarnings: plain-word codes with their numbers, never a price; unknown codes are left out', () => {
    const draft = {
      warnings: [
        { code: 'premium-needed', count: 3 },
        { code: 'coming-soon-included', week: 2, count: 5 },
        { code: 'content-runs-out', week: 6 },
        { code: 'fewer-sessions-than-units', count: 2 },
        { code: 'session-too-short', count: 1 },
        { code: 'already-done-skipped', count: 4 },
      ],
    } as unknown as CurriculumDraft;
    expect(grownUpWarnings(draft)).toEqual([
      { code: 'notIncluded', count: 3 },
      { code: 'notReleased', count: 5 },
      { code: 'runsOut', week: 6 },
      { code: 'didNotFit', count: 2 },
    ]);
    expect(grownUpWarnings(null)).toEqual([]);
    expect(grownUpWarnings({ warnings: [{ code: 'premium-needed' }] } as unknown as CurriculumDraft)).toEqual([{ code: 'notIncluded', count: 0 }]);
  });
});

describe('grownUpWarningText', () => {
  it('one plain sentence per warning, with no price, plan name or purchase word, in every language', () => {
    const warnings = [
      { code: 'notIncluded', count: 3 },
      { code: 'notReleased', count: 5 },
      { code: 'runsOut', week: 6 },
      { code: 'didNotFit', count: 2 },
    ] as const;
    for (const locale of ['en', 'es', 'ko'] as const) {
      const m = getMessages(locale);
      for (const w of warnings) {
        const text = grownUpWarningText(m, w);
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toMatch(/premium|\$|price|precio|upgrade|buy|comprar|가격|구매|프리미엄/i);
      }
    }
    expect(grownUpWarningText(getMessages('en'), { code: 'notIncluded', count: 3 })).toBe('3 lessons are not included with this account yet and are not in the plan.');
  });
});

describe('the update (K3, AM-2)', () => {
  const raised = context({
    placements: [result(), result({ id: 'placement:b', completedAt: '2026-10-12T08:00:00.000Z', level: { stage: 'stage1', band: 2 }, placedOutQuestIds: PLACED_AT_BAND_2 })],
  });

  it('updatedRouteOf keeps the plan id, its creation time, its length and end date; the future skips what is now known', () => {
    const active = planAtBand0();
    const next = updatedRouteOf(active, proposalInputOf(raised), '2026-10-12T09:00:00.000Z');
    if (next === null) throw new Error('expected a route');
    expect(next.id).toBe(active.id);
    expect(next.createdAt).toBe(active.createdAt);
    expect(next.updatedAt).toBe('2026-10-12T09:00:00.000Z');
    expect(next.archivedAt).toBeNull();
    expect(next.meta.params.weeks).toBe(active.meta.params.weeks);
    expect(next.meta.params.level).toEqual({ stage: 'stage1', band: 2 });
    const future = next.items.filter((item) => (item.targetDate ?? '') >= TODAY).map((item) => item.id);
    for (const id of PLACED_AT_BAND_2) expect(future).not.toContain(id);
    // Days already past keep their items.
    const past = (route: SelfRoute) => route.items.filter((item) => (item.targetDate ?? '') < TODAY);
    expect(past(next)).toEqual(past(active));
  });

  it('updatedRouteOf is null without a seed, or when the plan would not lay out', () => {
    expect(updatedRouteOf(planAtBand0(), proposalInputOf(context({ placements: undefined })), '2026-10-12T09:00:00.000Z')).toBeNull();
    const broken = { ...proposalInputOf(raised), today: 'not-a-day' };
    expect(updatedRouteOf(planAtBand0(), broken, '2026-10-12T09:00:00.000Z')).toBeNull();
  });

  it('planUpdateSource: an override on the newest result, else a retake', () => {
    expect(planUpdateSource([result()])).toBe('retake');
    expect(planUpdateSource(undefined)).toBe('retake');
    const withOverride = result({ override: { by: 'parent', at: '2026-10-12T00:00:00.000Z', startQuestId: 'quest:x' } } as Partial<PlacementResult>);
    expect(planUpdateSource([result({ id: 'placement:old', completedAt: '2026-10-01T00:00:00.000Z' }), withOverride])).toBe('override');
  });

  it('updatedEvent: codes and counts only', () => {
    expect(updatedEvent('profile:a', 'retake', { itemsRemoved: 2, itemsAdded: 1, newStartQuestId: 'quest:x' })).toEqual({
      name: 'route.updated',
      profileId: 'profile:a',
      payload: { source: 'retake', itemsRemoved: 2, itemsAdded: 1 },
    });
    expect(updatedEvent('profile:a', 'override', undefined).payload).toEqual({ source: 'override', itemsRemoved: 0, itemsAdded: 0 });
  });
});
