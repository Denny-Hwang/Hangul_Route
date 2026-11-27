import type { PlacementResult, RouteCatalog, RouteQuest, RouteSeed } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { routeEnabledFor } from '../../../config/flags';
import { describe, expect, it } from 'vitest';
import { stripCopyProblems } from '../copy';
import {
  decodingNotTested,
  reportSkills,
  reportView,
  resultView,
  shortHintFires,
  stripSkipped,
  withPlanKept,
  withPlanMade,
  type ResultViewInput,
} from '../result-view';
import { gate, placementResult } from './fixtures';

const q = (id: string, stage: RouteQuest['stage'], order: number, over: Partial<RouteQuest> = {}): RouteQuest => ({
  id,
  episodeId: `episode:${id}`,
  stage,
  theme: 'letters',
  order,
  teaches: [],
  playable: true,
  grid: true,
  ...over,
});
const CATALOG: RouteCatalog = {
  quests: [
    q('quest:q1', 'stage1', 1),
    q('quest:q2', 'stage1', 2),
    q('quest:q3', 'stage1', 3),
    q('quest:q4', 'stage1', 4),
    q('quest:story', 'stage1', 5, { grid: false }),
    q('quest:s2', 'stage2', 6),
    q('quest:s4', 'stage4', 7),
  ],
};
const seed = (over: Partial<RouteSeed> = {}): RouteSeed => ({
  level: { stage: 'stage1', band: 0 },
  oralStage: null,
  startQuestId: 'quest:q1',
  startEpisodeId: 'episode:quest:q1',
  placedOutQuestIds: [],
  priorityTokens: [],
  themeOrder: ['letters', 'life', 'rites', 'nature', 'crafts'],
  beyondContent: false,
  needsStage: null,
  ...over,
});
const raisedSeed = seed({
  level: { stage: 'stage1', band: 1 },
  startQuestId: 'quest:q3',
  placedOutQuestIds: ['quest:q1', 'quest:q2'],
});
const input = (over: Partial<ResultViewInput> = {}): ResultViewInput => ({
  result: placementResult(),
  before: null,
  after: seed(),
  catalog: CATALOG,
  completedQuestIds: new Set(),
  profileType: 'self',
  routeEnabled: true,
  myRouteEnabled: true,
  proposalAvailable: true,
  planPromptDismissed: false,
  hasActivePlan: false,
  planUpdateAvailable: true,
  hasReviewedShelfStory: true,
  gateRequired: false,
  ...over,
});

describe('the weekly-plan strip follows the UI locale (P2-8b)', () => {
  it('view contract: routeEnabledFor gives a signed es or ko UI the strip with the flag on, and no strip with it off (the screen wiring is pinned in entry-source.test.ts)', () => {
    for (const locale of ['es', 'ko'] as const) {
      const routeEnabled = routeEnabledFor(locale, { routeEnabled: true }, false);
      expect(resultView(input({ routeEnabled }))).toMatchObject({ strip: true, primary: 'usePlan', secondary: 'justStart' });
      const off = routeEnabledFor(locale, { routeEnabled: false }, false);
      expect(resultView(input({ routeEnabled: off }))).toMatchObject({ strip: false, primary: 'start', secondary: null });
      expect(resultView(input({ routeEnabled: off, profileType: 'child' })).links).not.toContain('forGrownUpsPlan');
    }
    const en = resultView(input({ routeEnabled: routeEnabledFor('en', { routeEnabled: true }, false) }));
    expect(en).toMatchObject({ strip: true, primary: 'usePlan', secondary: 'justStart' });
    // QA show-all keeps the strip in every locale.
    expect(routeEnabledFor('es', { routeEnabled: true }, true)).toBe(true);
  });
});

describe('shortHintFires (section 3.9)', () => {
  const short = (gates: PlacementResult['gates']) =>
    placementResult({ mode: 'short', length: 'quick', gates });

  it('fires after a Short with sound-basic passed and syl-cv at least 2 correct', () => {
    expect(shortHintFires(short([gate('sound-basic', 'decode', 'pass', 2), gate('syl-cv', 'decode', 'pass', 3)]))).toBe(true);
    expect(shortHintFires(short([gate('sound-basic', 'decode', 'pass', 3), gate('syl-cv', 'decode', 'fail', 2)]))).toBe(true);
  });

  it('not after a failed sound-basic, a weak syl-cv or a Standard run', () => {
    expect(shortHintFires(short([gate('sound-basic', 'decode', 'fail', 1)]))).toBe(false);
    expect(shortHintFires(short([gate('sound-basic', 'decode', 'pass', 2), gate('syl-cv', 'decode', 'fail', 1)]))).toBe(false);
    expect(shortHintFires(placementResult({ gates: [gate('sound-basic', 'decode', 'pass', 2), gate('syl-cv', 'decode', 'pass', 3)] }))).toBe(false);
  });

  it('reads the mode of a result stripped of `mode` from its legacy length', () => {
    const { mode: _m, ...legacy } = short([gate('sound-basic', 'decode', 'pass', 2), gate('syl-cv', 'decode', 'pass', 3)]);
    expect(shortHintFires(legacy)).toBe(true);
    const { mode: _n, ...full } = placementResult({ gates: [gate('sound-basic', 'decode', 'pass', 2), gate('syl-cv', 'decode', 'pass', 3)] });
    expect(shortHintFires(full)).toBe(false);
  });
});

describe('resultView: headline, cards and route lines (section 3.1 step 7)', () => {
  it('a first check: found headline, three route cards, Start', () => {
    const view = resultView(input({ routeEnabled: false, after: raisedSeed }));
    expect(view.headline).toBe('found');
    expect(view.level).toEqual({ stage: 'stage1', band: 1 });
    expect(view.cards).toEqual({ startHere: 'quest:q3', next: ['quest:q4', 'quest:s2'], laterStage: 'stage2' });
    expect(view.primary).toBe('start');
    expect(view.secondary).toBeNull();
    expect(view.routeLine).toBeNull();
    expect(view.links).toEqual(['seeMyRoute', 'forGrownUps']);
  });

  it('Next skips placed-out and finished quests; Later is null on the last stage', () => {
    const view = resultView(
      input({
        after: seed({ startQuestId: 'quest:s4', placedOutQuestIds: ['quest:q1'] }),
        completedQuestIds: new Set(['quest:q2']),
      }),
    );
    expect(view.cards).toEqual({ startHere: 'quest:s4', next: [], laterStage: null });
    const mid = resultView(input({ after: seed({ placedOutQuestIds: ['quest:q2'] }), completedQuestIds: new Set(['quest:q3']) }));
    expect(mid.cards.next).toEqual(['quest:q4', 'quest:s2']);
  });

  it('a cell\'s later volume is never a Next card (F-CURR-002 row CM-41)', () => {
    const later: RouteCatalog = { quests: [...CATALOG.quests.slice(0, 4), q('quest:v2', 'stage1', 5, { laterVolume: true }), ...CATALOG.quests.slice(4)] };
    const view = resultView(input({ catalog: later, after: seed({ startQuestId: 'quest:q4' }) }));
    expect(view.cards.next).toEqual(['quest:s2', 'quest:s4']);
  });

  it('a start quest unknown to this catalogue still shows its card, with the whole route after it', () => {
    const view = resultView(input({ after: seed({ startQuestId: 'quest:gone' }) }));
    expect(view.cards).toEqual({ startHere: 'quest:gone', next: ['quest:q1', 'quest:q2'], laterStage: 'stage1' });
  });

  it('no quest left for the tier: You know a lot! with Open stories, else See the whole map, and no strip', () => {
    const none = seed({ startQuestId: null, startEpisodeId: null, level: { stage: 'stage2', band: 0 }, needsStage: 'stage2' });
    const view = resultView(input({ after: none }));
    expect(view.headline).toBe('knowALot');
    expect(view.strip).toBe(false);
    expect(view.primary).toBe('openStories');
    expect(view.cards).toEqual({ startHere: null, next: [], laterStage: null });
    const map = resultView(input({ after: none, hasReviewedShelfStory: false, myRouteEnabled: false }));
    expect(map.primary).toBe('seeMap');
    expect(map.links).toEqual(['forGrownUps']);
  });

  it('a retake that changes nothing: the route (or plan) stays where it is, no strip', () => {
    const view = resultView(input({ before: seed(), after: seed() }));
    expect(view.routeLine).toBe('routeStays');
    expect(view.strip).toBe(false);
    expect(view.primary).toBe('start');
    expect(resultView(input({ before: seed(), after: seed(), hasActivePlan: true, planUpdateAvailable: false })).routeLine).toBe('planStays');
  });

  it('a retake that raises the start with an active self plan: Update my plan / Keep my plan', () => {
    const view = resultView(input({ before: seed(), after: raisedSeed, hasActivePlan: true }));
    expect(view.planUpdate).toBe(true);
    expect(view.strip).toBe(false);
    expect(view.primary).toBe('updatePlan');
    expect(view.secondary).toBe('keepPlan');
    expect(view.routeLine).toBeNull();
    const child = resultView(input({ before: seed(), after: raisedSeed, hasActivePlan: true, profileType: 'child' }));
    expect(child.planUpdate).toBe(false);
    expect(child.primary).toBe('start');
  });

  it('no update offer for the plan (flag off, or the re-seed would change nothing): no Update my plan', () => {
    const view = resultView(input({ before: seed(), after: raisedSeed, hasActivePlan: true, planUpdateAvailable: false }));
    expect(view.planUpdate).toBe(false);
    expect(view.strip).toBe(false);
    expect(view.primary).toBe('start');
    expect(view.secondary).toBeNull();
  });

  it('withPlanMade: once a plan exists (made through Change), the strip gives way to Start', () => {
    const view = resultView(input());
    expect(view.strip).toBe(true);
    const made = withPlanMade(view);
    expect(made).toMatchObject({ strip: false, primary: 'start', secondary: null });
    expect(made.links).toEqual(view.links);
    // Nothing to change on a view without the strip.
    const plain = resultView(input({ routeEnabled: false }));
    expect(withPlanMade(plain)).toBe(plain);
  });

  it('withPlanKept: Keep my plan folds the update into the plan-stays line and Start', () => {
    const view = resultView(input({ before: seed(), after: raisedSeed, hasActivePlan: true }));
    expect(withPlanKept(view)).toMatchObject({ planUpdate: false, primary: 'start', secondary: null, routeLine: 'planStays' });
    const plain = resultView(input());
    expect(withPlanKept(plain)).toBe(plain);
  });

  it('reading not tested: the good-place headline and line; the one-tap retake only on a self profile', () => {
    const notTested = placementResult({
      revealMode: 'always',
      strands: { 'hangul-recognition': 'secure', 'sound-letter': 'not-tested', 'syllable-reading': 'not-tested', vocabulary: 'secure', sentences: 'not-yet' },
    });
    expect(decodingNotTested(notTested)).toBe(true);
    const view = resultView(input({ result: notTested }));
    expect(view.headline).toBe('goodPlace');
    expect(view.notTestedLine).toBe(true);
    expect(view.retryHidden).toBe(true);
    const child = resultView(input({ result: notTested, profileType: 'child' }));
    expect(child.retryHidden).toBe(false);
    expect(child.headline).toBe('goodPlace');
    expect(decodingNotTested(placementResult())).toBe(false);
  });

  it('a tap run that stopped before reading keeps the normal headline: no sound-guide line or retake', () => {
    const quitEarly = placementResult({
      revealMode: 'tap',
      stopReason: 'quit',
      strands: { 'hangul-recognition': 'secure', 'sound-letter': 'not-tested', 'syllable-reading': 'not-tested', vocabulary: 'not-tested', sentences: 'not-tested' },
    });
    expect(decodingNotTested(quitEarly)).toBe(false);
    const view = resultView(input({ result: quitEarly }));
    expect(view.headline).toBe('found');
    expect(view.notTestedLine).toBe(false);
    expect(view.retryHidden).toBe(false);
  });

  it('a retake that only raises the level keeps the route: it stays where it is, no Update my plan', () => {
    const levelOnly = seed({ level: { stage: 'stage1', band: 2 } });
    // The offer reads the plan: a level that rises alone moves none of its future, so no update is offered.
    const view = resultView(input({ before: seed(), after: levelOnly, hasActivePlan: true, planUpdateAvailable: false }));
    expect(view.planUpdate).toBe(false);
    expect(view.routeLine).toBe('planStays');
    expect(view.primary).toBe('start');
    expect(resultView(input({ before: seed(), after: levelOnly })).routeLine).toBe('routeStays');
  });

  it('a retake that places out more but keeps the start: no "stays" line; Update my plan only when the plan is behind', () => {
    const more = seed({ placedOutQuestIds: ['quest:q3'] });
    const behind = resultView(input({ before: seed(), after: more, hasActivePlan: true }));
    expect(behind.planUpdate).toBe(true);
    expect(behind.routeLine).toBeNull();
    const current = resultView(input({ before: seed(), after: more, hasActivePlan: true, planUpdateAvailable: false }));
    expect(current.planUpdate).toBe(false);
    expect(current.routeLine).toBeNull();
  });

  it('a first check after a plan made from Home that found a later start: Update my plan (read from the plan, AM-7)', () => {
    const view = resultView(input({ before: null, after: raisedSeed, hasActivePlan: true }));
    expect(view).toMatchObject({ planUpdate: true, strip: false, primary: 'updatePlan', secondary: 'keepPlan', routeLine: null });
  });

  it('a retake that matches the last one while the plan is still behind: Update my plan, not "Your plan stays"', () => {
    const view = resultView(input({ before: raisedSeed, after: raisedSeed, hasActivePlan: true }));
    expect(view).toMatchObject({ planUpdate: true, primary: 'updatePlan', routeLine: null });
    const current = resultView(input({ before: raisedSeed, after: raisedSeed, hasActivePlan: true, planUpdateAvailable: false }));
    expect(current).toMatchObject({ planUpdate: false, primary: 'start', routeLine: 'planStays' });
  });

  it('a free-tier learner placed at Stage 2 or later: no strip, You know a lot! unchanged, even with a proposal (AM-7)', () => {
    const none = seed({ startQuestId: null, startEpisodeId: null, level: { stage: 'stage2', band: 0 }, needsStage: 'stage2', placedOutQuestIds: ['quest:q1', 'quest:q2', 'quest:q3', 'quest:q4'] });
    const view = resultView(input({ after: none, proposalAvailable: true, hasReviewedShelfStory: false, myRouteEnabled: false }));
    expect(view).toMatchObject({ headline: 'knowALot', strip: false, planUpdate: false, primary: 'seeMap', secondary: null });
  });

  it('stripSkipped: the proposal screen\'s Not now after this result folds the strip; an older dismissal does not', () => {
    const at = '2026-10-12T09:00:00.000Z';
    expect(stripSkipped('2026-10-12T09:05:00.000Z', at)).toBe(true);
    expect(stripSkipped('2026-10-12T08:00:00.000Z', at)).toBe(false);
    expect(stripSkipped(undefined, at)).toBe(false);
  });

  it('a retake that reaches You know a lot! with an active plan offers stories or the map, not Update my plan', () => {
    const none = seed({ startQuestId: null, startEpisodeId: null, level: { stage: 'stage2', band: 0 }, placedOutQuestIds: ['quest:q1'] });
    const view = resultView(input({ before: seed(), after: none, hasActivePlan: true }));
    expect(view.headline).toBe('knowALot');
    expect(view.planUpdate).toBe(false);
    expect(view.primary).toBe('openStories');
    expect(view.secondary).toBeNull();
  });

  it('after a Short whose hint fired, a self profile gets Try the standard check; a child nothing extra', () => {
    const short = placementResult({
      mode: 'short',
      length: 'quick',
      gates: [gate('sound-basic', 'decode', 'pass', 3), gate('syl-cv', 'decode', 'fail', 2)],
    });
    expect(resultView(input({ result: short, routeEnabled: false })).links).toEqual(['seeMyRoute', 'forGrownUps', 'tryStandard']);
    expect(resultView(input({ result: short, routeEnabled: false, profileType: 'child' })).links).toEqual(['seeMyRoute', 'forGrownUps']);
  });
});

describe('resultView: the weekly-plan strip matrix (AM-9)', () => {
  type Cell = {
    routeEnabled: boolean;
    profileType: 'self' | 'child';
    proposalAvailable: boolean;
    planPromptDismissed: boolean;
    retake: 'first' | 'unchanged' | 'raised' | 'override';
  };
  const cells: Cell[] = [];
  for (const routeEnabled of [true, false])
    for (const profileType of ['self', 'child'] as const)
      for (const proposalAvailable of [true, false])
        for (const planPromptDismissed of [false, true])
          for (const retake of ['first', 'unchanged', 'raised', 'override'] as const)
            cells.push({ routeEnabled, profileType, proposalAvailable, planPromptDismissed, retake });

  const before = (retake: Cell['retake']): RouteSeed | null => (retake === 'first' ? null : seed());
  const after = (retake: Cell['retake']): RouteSeed => {
    if (retake === 'raised') return raisedSeed;
    if (retake === 'override') return seed({ startQuestId: 'quest:q2', placedOutQuestIds: ['quest:q1'] });
    return seed();
  };

  for (const cell of cells) {
    it(JSON.stringify(cell), () => {
      for (const gateRequired of [false, true]) {
        // A PIN or a child on the device never changes visibility: gateRequired is device-level
        // and only decides whether a grown-up destination needs the PIN.
        const view = resultView(input({ ...cell, before: before(cell.retake), after: after(cell.retake), gateRequired }));
        expect(view.grownUpsNeedsPin).toBe(gateRequired);
        const expected =
          cell.routeEnabled &&
          cell.profileType === 'self' &&
          cell.proposalAvailable &&
          !cell.planPromptDismissed &&
          cell.retake !== 'unchanged';
        expect(view.strip).toBe(expected);
        expect(view.primary).toBe(expected ? 'usePlan' : 'start');
        expect(view.secondary).toBe(expected ? 'justStart' : null);
        const plan = cell.profileType === 'child' && cell.routeEnabled && cell.proposalAvailable;
        expect(view.links).toContain(plan ? 'forGrownUpsPlan' : 'forGrownUps');
        expect(view.links).not.toContain(view.primary);
      }
    });
  }

  it('the strip strings pass the strip copy scan in every locale', () => {
    for (const locale of ['en', 'es', 'ko'] as const) expect(stripCopyProblems(getMessages(locale))).toEqual([]);
  });

  it('See the whole map replaces See Learning Route while the Learning Route page is off', () => {
    expect(resultView(input({ myRouteEnabled: false })).links[0]).toBe('seeMap');
  });
});

describe('reportView (section 3.9: rows grouped by gate/form)', () => {
  const formatOf = (id: string) => (id.startsWith('pitem:build') ? 'build-syllable' : 'hear-pick-written');
  /** The four decoding steps a `vocab` read row is asked after (`stepPassed` counts it only when they passed). */
  const decoded = () => [
    gate('sound-basic', 'decode', 'pass', 3),
    gate('syl-cv', 'decode', 'pass', 3),
    gate('sound-rest', 'decode', 'pass', 3),
    gate('syl-cvc', 'decode', 'pass', 3),
  ];

  it('a Standard result: status words per rung with counts out of 3 framed as growth', () => {
    const result = placementResult({
      gates: [
        gate('recog', 'decode', 'pass', 3),
        gate('sound-basic', 'decode', 'pass', 2),
        gate('syl-cv', 'decode', 'fail', 1),
        gate('vocab', 'oral', 'fail', 0),
        gate('sentence', 'oral', 'not-run', 0, { asked: 0, reason: 'unavailable' }),
      ],
    });
    const view = reportView(result, formatOf);
    expect(view.rungs).toEqual([
      { gate: 'recog', form: 'decode', status: 'secure', counts: [{ correct: 3, asked: 3 }], note: null },
      { gate: 'sound-basic', form: 'decode', status: 'secure', counts: [{ correct: 2, asked: 3 }], note: null },
      { gate: 'syl-cv', form: 'decode', status: 'getting-there', counts: [{ correct: 1, asked: 3 }], note: null },
      { gate: 'vocab', form: 'oral', status: 'not-yet', counts: [{ correct: 0, asked: 3 }], note: null },
      { gate: 'sentence', form: 'oral', status: 'not-tested', counts: null, note: null },
    ]);
    expect(view.notTested).toEqual(['noSound']);
    expect(view.shortNotTested).toBe(false);
    expect(view.shortHint).toBe(false);
    expect(view.spellingTiles).toBeNull();
    expect(view.strands.map((s) => s.status)).toEqual(['secure', 'not-yet', 'not-tested', 'getting-there', 'not-yet']);
    // Words and Sentences split by form, only for a form that ran (PV-4): the sentence oral row was never asked.
    expect(view.strands.map((s) => s.forms)).toEqual([[], [], [], [{ form: 'oral', status: 'not-yet' }], []]);
  });

  it('a Deep result: status words only, checked twice or not finished, never a count out of 6', () => {
    const result = placementResult({
      mode: 'deep',
      gates: [
        gate('sound-basic', 'decode', 'pass', 3),
        gate('syl-cv', 'decode', 'pass', 2),
        gate('sound-basic', 'decode', 'pass', 2),
        gate('syl-cv', 'decode', 'not-run', 0, { asked: 1, reason: 'stopped' }),
      ],
      stopReason: 'quit',
    });
    const view = reportView(result, formatOf);
    expect(view.rungs).toEqual([
      { gate: 'sound-basic', form: 'decode', status: 'secure', counts: null, note: 'checkedTwice' },
      { gate: 'syl-cv', form: 'decode', status: 'secure', counts: null, note: 'notFinished' },
    ]);
    // No recognition row at all (the run never reached it): nothing is said about a screen reader.
    expect(view.notTested).toEqual(['endedEarly']);
  });

  it('a Deep result stripped of mode renders like Standard with two-row rungs', () => {
    const { mode: _m, ...legacy } = placementResult({
      mode: 'deep',
      gates: [gate('vocab', 'read', 'pass', 2), gate('vocab', 'read', 'fail', 1)],
    });
    expect(reportView(legacy, formatOf).rungs).toEqual([
      { gate: 'vocab', form: 'read', status: 'getting-there', counts: [{ correct: 2, asked: 3 }, { correct: 1, asked: 3 }], note: null },
    ]);
  });

  it('counts only rows that were asked, out of what was asked; a stopped row is "not finished" in any mode', () => {
    const unavailableSecond = placementResult({
      gates: [...decoded(), gate('vocab', 'read', 'pass', 3), gate('vocab', 'read', 'not-run', 0, { asked: 0, reason: 'unavailable' })],
    });
    expect(reportView(unavailableSecond, formatOf).rungs.filter((r) => r.gate === 'vocab')).toEqual([
      { gate: 'vocab', form: 'read', status: 'secure', counts: [{ correct: 3, asked: 3 }], note: null },
    ]);
    const stopped = placementResult({
      gates: [gate('sound-basic', 'decode', 'not-run', 1, { asked: 1, reason: 'stopped' })],
      stopReason: 'quit',
    });
    expect(reportView(stopped, formatOf).rungs).toEqual([
      { gate: 'sound-basic', form: 'decode', status: 'getting-there', counts: [{ correct: 1, asked: 1 }], note: 'notFinished' },
    ]);
  });

  it('a screen reader is named only from a recognition row recorded unavailable', () => {
    const unavailable = gate('recog', 'decode', 'not-run', 0, { asked: 0, reason: 'unavailable' });
    expect(reportView(placementResult({ gates: [unavailable, gate('sound-basic', 'decode', 'pass', 3)] }), formatOf).notTested).toEqual([
      'screenReader',
    ]);
    expect(reportView(placementResult({ gates: [gate('sound-basic', 'decode', 'pass', 3)] }), formatOf).notTested).toEqual([]);
  });

  it('a Korean test language with a screen reader names the picture rungs it left out (section 3.2)', () => {
    const off = (g: 'vocab' | 'sentence', form: 'read' | 'oral') => gate(g, form, 'not-run', 0, { asked: 0, reason: 'unavailable' });
    const gates = [
      gate('recog', 'decode', 'not-run', 0, { asked: 0, reason: 'unavailable' }),
      gate('sound-basic', 'decode', 'pass', 3),
      off('vocab', 'read'),
      off('sentence', 'read'),
      off('vocab', 'oral'),
      off('sentence', 'oral'),
    ];
    expect(reportView(placementResult({ testLocale: 'ko', gates }), formatOf).notTested).toEqual(['screenReader', 'screenReaderPictures']);
    // In English the same rows can only mean no sound for the oral rungs.
    expect(reportView(placementResult({ testLocale: 'en', gates }), formatOf).notTested).toEqual(['noSound', 'screenReader']);
    const asked = [...gates.slice(0, 2), gate('vocab', 'read', 'pass', 3)];
    expect(reportView(placementResult({ testLocale: 'ko', gates: asked }), formatOf).notTested).toEqual(['screenReader']);
  });

  it('a Short result: recognition and sentences are not tested (short check); the hint when it fires', () => {
    const result = placementResult({
      mode: 'short',
      length: 'quick',
      gates: [gate('sound-basic', 'decode', 'pass', 3), gate('vocab', 'oral', 'pass', 2), gate('syl-cv', 'decode', 'fail', 2)],
      strands: { 'hangul-recognition': 'not-tested', 'sound-letter': 'getting-there', 'syllable-reading': 'getting-there', vocabulary: 'secure', sentences: 'not-tested' },
    });
    const view = reportView(result, formatOf);
    expect(view.strands).toEqual([
      { strand: 'hangul-recognition', status: 'not-tested-short', forms: [] },
      { strand: 'sound-letter', status: 'getting-there', forms: [] },
      { strand: 'syllable-reading', status: 'getting-there', forms: [] },
      { strand: 'vocabulary', status: 'secure', forms: [{ form: 'oral', status: 'secure' }] },
      { strand: 'sentences', status: 'not-tested-short', forms: [] },
    ]);
    expect(view.shortNotTested).toBe(true);
    expect(view.shortHint).toBe(true);
    expect(view.notTested).toEqual([]);
  });

  it('the sound guide set to always is named', () => {
    expect(reportView(placementResult({ revealMode: 'always', gates: [gate('recog', 'decode', 'pass', 3)] }), formatOf).notTested).toEqual([
      'soundGuide',
    ]);
  });

  it('Spelling with tiles: a status word from the build-syllable responses found in the bank', () => {
    const answer = (questionId: string, outcome: 'correct' | 'wrong', assisted = false) => ({
      questionId,
      outcome,
      chosenOptionId: 'a',
      assisted,
      ms: 1,
    });
    const tiles = (responses: ReturnType<typeof answer>[]) =>
      reportView(placementResult({ mode: 'deep', responses, gates: [gate('recog', 'decode', 'pass', 3)] }), (id) =>
        id === 'pitem:unknown' ? undefined : formatOf(id),
      ).spellingTiles;
    expect(tiles([answer('pitem:build-a', 'correct'), answer('pitem:x', 'wrong')])).toBe('secure');
    expect(tiles([answer('pitem:build-a', 'correct'), answer('pitem:build-b', 'wrong')])).toBe('getting-there');
    expect(tiles([answer('pitem:build-a', 'correct', true)])).toBe('not-yet');
    expect(tiles([answer('pitem:unknown', 'correct')])).toBeNull();
  });
});

describe('reportView: Words and Sentences say each form apart (AMENDMENTS-PLC-VALIDITY section 3.8, PV-4)', () => {
  const formatOf = () => 'hear-pick-written' as const;
  const forms = (gates: ReturnType<typeof gate>[], strand: 'vocabulary' | 'sentences') =>
    reportView(placementResult({ mode: 'deep', gates }), formatOf).strands.find((s) => s.strand === strand)?.forms;

  it('a heritage listener: listening is secure and reading was not reached, so only the listening row shows', () => {
    const gates = [
      gate('sound-basic', 'decode', 'fail', 1),
      gate('vocab', 'oral', 'pass', 3),
      gate('sentence', 'oral', 'pass', 3),
    ];
    const view = reportView(placementResult({ gates, oralStage: 'stage3' }), formatOf);
    expect(view.strands.find((s) => s.strand === 'vocabulary')?.forms).toEqual([{ form: 'oral', status: 'secure' }]);
    expect(view.strands.find((s) => s.strand === 'sentences')?.forms).toEqual([{ form: 'oral', status: 'secure' }]);
  });

  it('a reader sees reading and listening, each with its own word, in the rung order', () => {
    const gates = [
      gate('sound-basic', 'decode', 'pass', 3),
      gate('syl-cv', 'decode', 'pass', 3),
      gate('sound-rest', 'decode', 'pass', 3),
      gate('syl-cvc', 'decode', 'pass', 3),
      gate('vocab', 'read', 'fail', 1),
      gate('vocab', 'oral', 'pass', 3),
    ];
    expect(forms(gates, 'vocabulary')).toEqual([
      { form: 'read', status: 'getting-there' },
      { form: 'oral', status: 'secure' },
    ]);
    // Sentences did not run at all: no forms, so the screen keeps the strand's own word.
    expect(forms(gates, 'sentences')).toEqual([]);
  });

  it('a form that was never asked (unavailable, nothing answered) is left out', () => {
    const off = gate('vocab', 'oral', 'not-run', 0, { asked: 0, reason: 'unavailable' });
    const decoded = [
      gate('sound-basic', 'decode', 'pass', 3),
      gate('syl-cv', 'decode', 'pass', 3),
      gate('sound-rest', 'decode', 'pass', 3),
      gate('syl-cvc', 'decode', 'pass', 3),
    ];
    expect(forms([...decoded, gate('vocab', 'read', 'pass', 3), off], 'vocabulary')).toEqual([{ form: 'read', status: 'secure' }]);
    expect(forms([off], 'vocabulary')).toEqual([]);
  });

  it('a row that passed beyond a failed confirmation does not read as secure (stepPassed, E-1)', () => {
    // Deep asks a confirming draw one step later: syl-cvc failed its confirmation, so the vocab read row
    // that was asked before it is an unconfirmed pass and shows what happened, not "secure".
    const gates = [
      gate('sound-basic', 'decode', 'pass', 3),
      gate('syl-cv', 'decode', 'pass', 3),
      gate('sound-rest', 'decode', 'pass', 3),
      gate('syl-cvc', 'decode', 'pass', 3),
      gate('vocab', 'read', 'pass', 3),
      gate('syl-cvc', 'decode', 'fail', 1),
    ];
    const view = reportView(placementResult({ mode: 'deep', gates }), formatOf);
    expect(view.rungs.find((r) => r.gate === 'vocab')?.status).toBe('getting-there');
    expect(view.rungs.find((r) => r.gate === 'syl-cvc')?.status).toBe('getting-there');
    expect(view.rungs.find((r) => r.gate === 'sound-basic')?.status).toBe('secure');
    expect(forms(gates, 'vocabulary')).toEqual([{ form: 'read', status: 'getting-there' }]);
  });
});

describe('reportSkills: the "Reading and listening" block (section 3.8, PV-4)', () => {
  const NOT_TESTED = {
    'hangul-recognition': 'not-tested',
    'sound-letter': 'not-tested',
    'syllable-reading': 'not-tested',
    vocabulary: 'not-tested',
    sentences: 'not-tested',
  } as const;
  const tested = { ...NOT_TESTED, 'sound-letter': 'not-yet', 'syllable-reading': 'not-yet' } as const;

  it('a heritage listener: reading at the beginning, listening at sentences, and listening is ahead', () => {
    const result = placementResult({ strands: tested, level: { stage: 'stage1', band: 0 }, oralStage: 'stage3' });
    expect(reportSkills(result)).toEqual({ reading: { stage: 'stage1', band: 0 }, listening: 'stage3', ahead: true });
  });

  it('says what the newest check saw for each listening stage', () => {
    const at = (oralStage: PlacementResult['oralStage']) =>
      reportSkills(placementResult({ strands: tested, level: { stage: 'stage1', band: 0 }, oralStage }));
    expect(at('stage1')).toEqual({ reading: { stage: 'stage1', band: 0 }, listening: 'stage1', ahead: false });
    expect(at('stage2')).toEqual({ reading: { stage: 'stage1', band: 0 }, listening: 'stage2', ahead: true });
    expect(at(null)).toEqual({ reading: { stage: 'stage1', band: 0 }, listening: null, ahead: false });
    // Stages above the sentences are never measured; they read as the sentence words.
    expect(at('stage5').listening).toBe('stage3');
  });

  it('no "ahead" line when reading is level with listening or above it', () => {
    const level = (stage: PlacementResult['level']['stage'], oralStage: PlacementResult['oralStage']) =>
      reportSkills(placementResult({ strands: tested, level: { stage, band: 0 }, oralStage })).ahead;
    expect(level('stage2', 'stage2')).toBe(false);
    expect(level('stage3', 'stage2')).toBe(false);
    expect(level('stage2', 'stage3')).toBe(true);
  });

  it('reading is "not checked" when no decoding strand ran, and then nothing is compared', () => {
    const result = placementResult({ strands: NOT_TESTED, level: { stage: 'stage1', band: 0 }, oralStage: 'stage3' });
    expect(reportSkills(result)).toEqual({ reading: null, listening: 'stage3', ahead: false });
    // Letter shapes alone are not reading the sound of letters: the sound guide run is still "not checked".
    expect(reportSkills(placementResult({ strands: { ...NOT_TESTED, 'hangul-recognition': 'secure' }, oralStage: 'stage2' })).reading).toBeNull();
  });

  it('one decoding strand that ran is enough to name the band', () => {
    expect(reportSkills(placementResult({ strands: { ...NOT_TESTED, 'syllable-reading': 'getting-there' }, oralStage: null })).reading).toEqual({
      stage: 'stage1',
      band: 0,
    });
  });
});
