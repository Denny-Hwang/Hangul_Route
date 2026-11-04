import { HiddenHeritageRoundSchema, checkRomanization, type HiddenHeritageRound } from '@hangul-route/content-schema';
import { FOOD_MARKET_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/food-market';
import { FOUR_SEASONS_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/four-seasons';
import { LETTERS_SCHOOL_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/letters-school';
import { PLAY_COURTYARD_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/play-courtyard';
import { SEOLLAL_ROOM_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/seollal-room';
import { touchTarget } from '@hangul-route/design-system/tokens';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import {
  FOUND_ADVANCE_MS,
  MIN_SCENE_WIDTH,
  MISS_RING_MS,
  askedId,
  canSkip,
  endView,
  headerView,
  liveText,
  meaningOf,
  promptView,
  roundKeyOf,
  sceneLayout,
  showsHoya,
  slotViews,
  spotHitRects,
  spotRect,
  spotViews,
  startFlow,
  stepFlow,
  validRounds,
  type FlowEvent,
  type FlowState,
  type SpotHitRect,
} from '../hidden-heritage-flow';
import { picWordFallback } from '../hidden-heritage-fallback';

/** F-CURR-002 row CM-36: the pure rules of Hidden Heritage (design/wireframes/minigame/hidden-heritage.md). */

/**
 * The shipped spots boxed under 64 (AMENDMENTS-TOUCH 6.6): none at the 288 dp scene of a 320 window; at the 256 dp
 * floor (a split screen after the first answer) these, each taking exactly the room between its bounds. A content
 * row moves them; this amendment re-authors no content.
 */
const BOXED_SHIPPED: Record<number, Record<string, string[]>> = {
  288: {},
  256: {
    'scene:food-market': ['gimchi x 60.2', 'guk x 60.2'],
    'scene:letters-school': ['but x 61.4', 'namu x 62.7', 'sae x 58.9'],
    'scene:play-courtyard': ['paengi x 60.2', 'paengi y 61.8', 'yut x 63.7', 'yut y 59.8', 'eolle y 63.7', 'gonggi y 61.1', 'yutpan y 59.8'],
  },
};

const ROUND: HiddenHeritageRound = HiddenHeritageRoundSchema.parse(FOOD_MARKET_SCENE.round);
const ROUNDS = [ROUND];
const en = getMessages('en');

function run(events: FlowEvent[], rounds = ROUNDS, seed = 1): { state: FlowState; effects: string[] } {
  let state = startFlow(rounds, seed);
  const effects: string[] = [];
  for (const e of events) {
    const out = stepFlow(state, e, rounds);
    state = out.state;
    effects.push(...out.effects.map((f) => (f.type === 'answer' ? `answer ${f.roundKey} ${f.correct} ${f.itemId}` : f.type === 'play' ? `play ${f.targetId}` : f.type)));
  }
  return { state, effects };
}

describe('the Food market scene', () => {
  it('romanizes every thing it names with the F-CNT-002 converter (registered B1 source)', () => {
    for (const t of [...ROUND.targets, ...ROUND.others]) expect(checkRomanization(t.word.ko, t.word.romanization), t.id).toEqual([]);
  });
});

describe('the flow', () => {
  it('asks every target once, in a shuffled order that is the same for the same seed', () => {
    const a = startFlow(ROUNDS, 7);
    expect([...a.order[0]!].sort()).toEqual(['bap', 'gimchi', 'jeotgarak']);
    expect(startFlow(ROUNDS, 7).order).toEqual(a.order);
    expect(askedId(a)).toBe(a.order[0]![0]);
    expect(run([{ type: 'start' }]).effects).toEqual([`play ${startFlow(ROUNDS, 1).order[0]![0]}`]);
  });

  it('a right tap rings the thing, scores the word on its first try, plays it, shows its meaning and moves on', () => {
    const first = startFlow(ROUNDS, 1).order[0]![0]!;
    const { state, effects } = run([{ type: 'tap', id: first }]);
    expect(effects).toEqual(['cancel-clear', `answer ${roundKeyOf(ROUNDS, 0, first)} true ${first}`, 'haptic', `play ${first}`, 'schedule-advance']);
    expect(state.found).toEqual([first]);
    expect(promptView(ROUND, state)?.meaning).toBe(meaningOf(ROUND.targets.find((t) => t.id === first)!.word));
    expect(liveText(ROUND, state, en.a11y.hiddenHeritage, en.learner.hiddenHeritage)).toMatch(/^Found: /);
    const next = stepFlow(state, { type: 'advance' }, ROUNDS);
    expect(askedId(next.state)).toBe(startFlow(ROUNDS, 1).order[0]![1]);
    expect(next.effects).toEqual([{ type: 'play', targetId: askedId(next.state) }]);
    expect(FOUND_ADVANCE_MS).toBe(700);
  });

  it('a tap on another thing is a soft nudge that ends nothing; the second miss rings the right spot', () => {
    const asked = startFlow(ROUNDS, 1).order[0]![0]!;
    const { state, effects } = run([{ type: 'tap', id: 'hangari' }]);
    expect(effects).toEqual(['cancel-clear', `answer ${roundKeyOf(ROUNDS, 0, asked)} false ${asked}`, 'haptic', 'schedule-clear']);
    expect(MISS_RING_MS).toBe(600);
    expect(state.status).toBe('playing');
    expect(askedId(state)).toBe(asked);
    expect(spotViews(ROUND, state, en.a11y.hiddenHeritage).find((s) => s.id === 'hangari')?.ring).toBe('miss');
    expect(showsHoya(state)).toBe(true);
    expect(liveText(ROUND, state, en.a11y.hiddenHeritage, en.learner.hiddenHeritage)).toBe('Look again');
    const cleared = stepFlow(state, { type: 'clear-flash' }, ROUNDS).state;
    expect(spotViews(ROUND, cleared, en.a11y.hiddenHeritage).every((s) => s.ring === null)).toBe(true);
    const twice = run([{ type: 'tap', id: 'hangari' }, { type: 'clear-flash' }, { type: 'tap', id: 'baguni' }, { type: 'clear-flash' }]).state;
    expect(spotViews(ROUND, twice, en.a11y.hiddenHeritage).filter((s) => s.ring !== null)).toEqual([expect.objectContaining({ id: asked, ring: 'hint' })]);
  });

  it('only taps on spots count: a found spot, or a tap while a word shows, does nothing', () => {
    const order = startFlow(ROUNDS, 1).order[0]!;
    const found = run([{ type: 'tap', id: order[0]! }]).state;
    expect(stepFlow(found, { type: 'tap', id: order[1]! }, ROUNDS).effects).toEqual([]);
    const advanced = stepFlow(found, { type: 'advance' }, ROUNDS).state;
    expect(stepFlow(advanced, { type: 'tap', id: order[0]! }, ROUNDS).effects).toEqual([]);
    expect(stepFlow(advanced, { type: 'clear-flash' }, ROUNDS).effects).toEqual([]);
    expect(stepFlow(advanced, { type: 'advance' }, ROUNDS).state).toBe(advanced);
  });

  it('every word found ends on the end panel; Continue completes the step', () => {
    const order = startFlow(ROUNDS, 1).order[0]!;
    const events: FlowEvent[] = order.flatMap((id): FlowEvent[] => [{ type: 'tap', id }, { type: 'advance' }]);
    const end = run(events).state;
    expect(end.status).toBe('end');
    expect(headerView(end, ROUNDS, en.learner.minigame)).toEqual({ value: 3, max: 3, label: '3 / 3' });
    expect(endView(ROUND).map((e) => [e.word.ko, e.meaning])).toEqual([
      ['밥', 'rice'],
      ['김치', 'kimchi'],
      ['젓가락', 'chopsticks'],
    ]);
    expect(run([...events, { type: 'continue' }]).effects.at(-1)).toBe('complete');
    expect(stepFlow(startFlow(ROUNDS, 1), { type: 'continue' }, ROUNDS).effects).toEqual([]);
  });

  it('a second scene follows the first after its end panel, with keys that go on counting', () => {
    const second: HiddenHeritageRound = { ...ROUND, id: 'hh2' };
    const rounds = [ROUND, second];
    expect(roundKeyOf(rounds, 1, 'bap')).toBe('w3');
    const order = startFlow(rounds, 1).order[0]!;
    const out = run([...order.flatMap((id): FlowEvent[] => [{ type: 'tap', id }, { type: 'advance' }]), { type: 'continue' }], rounds);
    expect(out.state.status).toBe('playing');
    expect(out.state.roundIdx).toBe(1);
    expect(headerView(out.state, rounds, en.learner.minigame).label).toBe('3 / 6');
  });

  it('Skip shows after the first answer and ends the step without marking the words not found', () => {
    expect(canSkip(startFlow(ROUNDS, 1))).toBe(false);
    const missed = run([{ type: 'tap', id: 'hangari' }]);
    expect(canSkip(missed.state)).toBe(true);
    const skipped = stepFlow(missed.state, { type: 'skip' }, ROUNDS);
    expect(skipped.effects.map((e) => e.type)).toEqual(['cancel-clear', 'cancel-advance', 'complete']);
    expect(skipped.effects.some((e) => e.type === 'answer')).toBe(false);
    expect(stepFlow(skipped.state, { type: 'skip' }, ROUNDS).effects).toEqual([]);
  });

  it('a Skip while a found word shows drops its advance: a late timer neither reopens the end nor asks the next word', () => {
    const first = startFlow(ROUNDS, 1).order[0]![0]!;
    const found = run([{ type: 'tap', id: first }]);
    expect(found.state.pending).toBe(first);
    expect(canSkip(found.state)).toBe(true);
    const skipped = stepFlow(found.state, { type: 'skip' }, ROUNDS);
    expect(skipped.state.status).toBe('done');
    expect(skipped.effects.map((e) => e.type)).toEqual(['cancel-clear', 'cancel-advance', 'complete']);
    const late = stepFlow(skipped.state, { type: 'advance' }, ROUNDS);
    expect(late.state).toBe(skipped.state);
    expect(late.effects).toEqual([]);
  });

  it('an empty scope has nothing to play and never asks', () => {
    const empty = startFlow([], 1);
    expect(empty.status).toBe('empty');
    expect(stepFlow(empty, { type: 'start' }, []).effects).toEqual([]);
    expect(stepFlow(empty, { type: 'tap', id: 'bap' }, []).effects).toEqual([]);
    expect(validRounds({ hiddenHeritage: { rounds: [{ ...ROUND, targets: ROUND.targets.slice(0, 2) }] } })).toEqual([]);
    expect(validRounds({})).toEqual([]);
    expect(validRounds({ hiddenHeritage: { rounds: [ROUND] } })).toEqual([ROUND]);
  });
});

describe('the views', () => {
  it('names every spot by its meaning, never the answer, in reading order; a found spot says so', () => {
    const state = startFlow(ROUNDS, 1);
    const views = spotViews(ROUND, state, en.a11y.hiddenHeritage);
    expect(views.map((v) => v.label)).toEqual(['jar', 'basket', 'rice', 'soup', 'kimchi', 'chopsticks']);
    const first = state.order[0]![0]!;
    const found = run([{ type: 'tap', id: first }]).state;
    const label = spotViews(ROUND, found, en.a11y.hiddenHeritage).find((v) => v.id === first)!.label;
    expect(label).toMatch(/, found$/);
  });

  it('fills a slot per found word, word and romanization; an empty slot has no word', () => {
    const first = startFlow(ROUNDS, 1).order[0]!;
    const state = run([{ type: 'tap', id: first[0]! }]).state;
    const slots = slotViews(ROUND, state);
    expect(slots).toHaveLength(3);
    expect(slots[0]!.word?.ko).toBe(ROUND.targets.find((t) => t.id === first[0])!.word.ko);
    expect(slots.slice(1).map((s) => s.word)).toEqual([null, null]);
  });

  it('in the Korean UI a meaning that is the word itself is not said twice', () => {
    const ko = { ...ROUND, targets: ROUND.targets.map((t) => (t.id === 'bap' ? { ...t, word: { ...t.word, en: '밥' } } : t)) };
    expect(meaningOf(ko.targets[0]!.word)).toBeNull();
    expect(endView(ko)[0]!.meaning).toBeNull();
    const state: FlowState = { ...startFlow([ko], 1), order: [['bap', 'gimchi', 'jeotgarak']] };
    const found = stepFlow(state, { type: 'tap', id: 'bap' }, [ko]).state;
    expect(liveText(ko, found, getMessages('ko').a11y.hiddenHeritage, getMessages('ko').learner.hiddenHeritage)).toBe('찾았어요: 밥');
    expect(spotViews(ko, found, getMessages('ko').a11y.hiddenHeritage).find((s) => s.id === 'bap')!.label).toBe('밥, 찾았어요');
    expect(liveText(ko, state, en.a11y.hiddenHeritage, en.learner.hiddenHeritage)).toBe('');
  });
});

describe('the layout (wireframe "Box diagram C" and "Smallest scene")', () => {
  const base = { maxWidth: 720, short: false, heightForScene: 0, columnMin: 160, gap: 16 };
  it('320 x 568: the full content width, so a 75-unit spot is 54 dp', () => {
    const l = sceneLayout({ ...base, contentWidth: 288 });
    expect(l).toEqual({ arrangement: 'stack', sceneWidth: 288 });
    expect(spotRect({ x: 0, y: 0, w: 75, h: 75 }, l!.sceneWidth).width).toBe(54);
  });
  it('768: capped at the reading width, 720, so spots are 135 dp or more', () => {
    expect(sceneLayout({ ...base, contentWidth: 736 })).toEqual({ arrangement: 'stack', sceneWidth: 720 });
    expect(spotRect({ x: 40, y: 60, w: 75, h: 80 }, 720)).toEqual({ left: 72, top: 108, width: 135, height: 144 });
  });
  it('568 x 320 (landscape short): beside the prompt column, as tall as the window lets it', () => {
    expect(sceneLayout({ ...base, contentWidth: 536, short: true, heightForScene: 228 })).toEqual({ arrangement: 'beside', sceneWidth: 304 });
    // Too little height: the prompt column moves under the scene, which takes the full width.
    expect(sceneLayout({ ...base, contentWidth: 536, short: true, heightForScene: 150 })).toEqual({ arrangement: 'stack', sceneWidth: 536 });
  });
  it('a split screen under 256 dp plays Pic-Word Match instead', () => {
    expect(MIN_SCENE_WIDTH).toBe(256);
    expect(sceneLayout({ ...base, contentWidth: 255 })).toBeNull();
    expect(sceneLayout({ ...base, contentWidth: Number.NaN })).toBeNull();
    expect(spotRect({ x: 0, y: 0, w: 75, h: 75 }, MIN_SCENE_WIDTH).width).toBe(48);
  });
});

describe('the fallback board', () => {
  it('is a Pic-Word Match board per scene on the same targets, with their own bundled pictures', () => {
    const scope = picWordFallback({ kind: 'hidden-heritage', hiddenHeritage: { rounds: [ROUND] } });
    expect(scope.kind).toBe('pic-word-match');
    expect(scope.picWord?.boards[0]?.pairs).toEqual(ROUND.targets.map((t) => ({ id: t.id, pictureRef: t.picture, word: t.word })));
    expect(picWordFallback({ kind: 'hidden-heritage' }).picWord?.boards).toEqual([]);
  });
});

describe('spotHitRects: every spot reaches 64 without overlapping, except a boxed axis (AMENDMENTS-TOUCH 6.6, KT-D8)', () => {
  const MIN = touchTarget.min;
  type Spot = { x: number; y: number; w: number; h: number };
  const span = (r: SpotHitRect, axis: 'x' | 'y'): [number, number] => (axis === 'x' ? [r.left, r.left + r.width] : [r.top, r.top + r.height]);
  const near = (a: number, b: number): void => expect(a).toBeCloseTo(b, 6);

  /** The invariants of section 6.6 on any layout: never smaller than drawn, inside the scene, 64 unless boxed, no overlap. */
  function invariants(spots: readonly Spot[], width: number): SpotHitRect[] {
    const hits = spotHitRects(spots, width);
    const height = (width * 3) / 4;
    hits.forEach((h, i) => {
      const d = spotRect(spots[i]!, width);
      expect(h.left).toBeLessThanOrEqual(d.left + 1e-6);
      expect(h.top).toBeLessThanOrEqual(d.top + 1e-6);
      expect(h.left + h.width).toBeGreaterThanOrEqual(d.left + d.width - 1e-6);
      expect(h.top + h.height).toBeGreaterThanOrEqual(d.top + d.height - 1e-6);
      expect(h.left).toBeGreaterThanOrEqual(-1e-6);
      expect(h.top).toBeGreaterThanOrEqual(-1e-6);
      expect(h.left + h.width).toBeLessThanOrEqual(width + 1e-6);
      expect(h.top + h.height).toBeLessThanOrEqual(height + 1e-6);
      if (!h.boxed.x) expect(h.width).toBeGreaterThanOrEqual(MIN - 1e-6);
      if (!h.boxed.y) expect(h.height).toBeGreaterThanOrEqual(MIN - 1e-6);
      if (h.boxed.x) expect(h.width).toBeLessThan(MIN);
      if (h.boxed.y) expect(h.height).toBeLessThan(MIN);
    });
    for (let i = 0; i < hits.length; i += 1) {
      for (let j = i + 1; j < hits.length; j += 1) {
        const [a, b] = [hits[i]!, hits[j]!];
        const apart = (axis: 'x' | 'y'): boolean => span(a, axis)[1] <= span(b, axis)[0] + 1e-6 || span(b, axis)[1] <= span(a, axis)[0] + 1e-6;
        expect(apart('x') || apart('y'), `spots ${i} and ${j} overlap`).toBe(true);
      }
    }
    return hits;
  }

  it('a lone spot grows evenly to 64 on both axes', () => {
    // At 288 px, 75 units are 54 dp: 5 dp more on each side.
    const [h] = invariants([{ x: 160, y: 110, w: 75, h: 75 }], 288);
    near(h!.width, MIN);
    near(h!.height, MIN);
    near(h!.left, 160 * 0.72 - 5);
    near(h!.top, 110 * 0.72 - 5);
    expect(h!.boxed).toEqual({ x: false, y: false });
  });

  it('a spot at the scene edge grows inward to 64, never clamped short', () => {
    const [left, corner] = invariants(
      [
        { x: 0, y: 110, w: 75, h: 75 },
        { x: 325, y: 225, w: 75, h: 75 },
      ],
      256,
    );
    expect(left!.left).toBe(0);
    near(left!.width, MIN);
    near(corner!.left + corner!.width, 256);
    near(corner!.top + corner!.height, 192);
    near(corner!.width, MIN);
    near(corner!.height, MIN);
    expect([left!.boxed, corner!.boxed]).toEqual([
      { x: false, y: false },
      { x: false, y: false },
    ]);
  });

  it('a neighbour on one side: the growth goes the other way, and neither crosses the midline', () => {
    // Two spots 11 units apart in a row at 256 px (0.64 dp a unit): 48 dp each, a 7.04 dp gap.
    const [a, b] = invariants(
      [
        { x: 100, y: 110, w: 75, h: 75 },
        { x: 186, y: 110, w: 75, h: 75 },
      ],
      256,
    );
    const mid = ((175 + 186) / 2) * 0.64;
    near(a!.left + a!.width, mid);
    near(b!.left, mid);
    near(a!.width, MIN);
    near(b!.width, MIN);
  });

  it('boxed between two neighbours: the axis takes exactly the room between the midlines, drawn + one gap', () => {
    const [, middle] = invariants(
      [
        { x: 30, y: 110, w: 75, h: 75 },
        { x: 116, y: 110, w: 75, h: 75 },
        { x: 202, y: 110, w: 75, h: 75 },
      ],
      256,
    );
    expect(middle!.boxed).toEqual({ x: true, y: false });
    near(middle!.left, ((105 + 116) / 2) * 0.64);
    near(middle!.left + middle!.width, ((191 + 202) / 2) * 0.64);
    near(middle!.width, (75 + 11) * 0.64);
    near(middle!.height, MIN);
  });

  it('boxed by the scene edge and a neighbour: drawn + half the gap', () => {
    const [edge] = invariants(
      [
        { x: 0, y: 110, w: 75, h: 75 },
        { x: 86, y: 110, w: 75, h: 75 },
        { x: 172, y: 110, w: 75, h: 75 },
      ],
      256,
    );
    // Room 0 .. midline 80.5 units: 51.52 dp, under 64, so all of it.
    expect(edge!.boxed.x).toBe(true);
    expect(edge!.left).toBe(0);
    near(edge!.width, 80.5 * 0.64);
  });

  it('diagonal neighbours are cut at the midline of the axis where they are farther apart; the cut goes to the free side', () => {
    // Apart by 12 units across and 15 down: grown evenly they would overlap, so the cut is on y (the larger gap), and
    // the 3.2 dp it takes from the near side goes to the far side: each still reaches 64.
    const [a, b] = invariants(
      [
        { x: 100, y: 50, w: 75, h: 75 },
        { x: 187, y: 140, w: 75, h: 75 },
      ],
      256,
    );
    const cut = ((125 + 140) / 2) * 0.64;
    near(a!.top + a!.height, cut);
    near(b!.top, cut);
    near(a!.top, cut - MIN);
    near(a!.height, MIN);
    near(b!.height, MIN);
    near(a!.width, MIN);
    near(b!.width, MIN);
  });

  it('a spot drawn at 64 or more keeps its drawn rectangle', () => {
    const [h] = invariants([{ x: 100, y: 100, w: 120, h: 100 }], 288);
    const d = spotRect({ x: 100, y: 100, w: 120, h: 100 }, 288);
    near(h!.left, d.left);
    near(h!.top, d.top);
    near(h!.width, d.width);
    near(h!.height, d.height);
    expect(h!.boxed).toEqual({ x: false, y: false });
  });

  // The shipped scenes (rows CM-36, CM-37) at the 288 dp scene of a 320 window and at the 256 dp floor. Every spot not
  // listed reaches 64 on both axes; a listed spot is boxed on that axis and takes the room named (dp, rounded).
  const SCENES = [FOOD_MARKET_SCENE, LETTERS_SCHOOL_SCENE, SEOLLAL_ROOM_SCENE, FOUR_SEASONS_SCENE, PLAY_COURTYARD_SCENE];
  const BOXED: Record<number, Record<string, string[]>> = BOXED_SHIPPED;
  for (const width of [288, 256]) {
    it(`the shipped scenes at ${width} dp: every hit rectangle holds the rules, and the boxed spots are these`, () => {
      const found: Record<string, string[]> = {};
      for (const scene of SCENES) {
        const round = HiddenHeritageRoundSchema.parse(scene.round);
        const things = [...round.targets, ...round.others];
        const hits = invariants(
          things.map((t) => t.spot),
          width,
        );
        const boxed = hits.flatMap((h, i) => [
          ...(h.boxed.x ? [`${things[i]!.id} x ${h.width.toFixed(1)}`] : []),
          ...(h.boxed.y ? [`${things[i]!.id} y ${h.height.toFixed(1)}`] : []),
        ]);
        if (boxed.length > 0) found[scene.id] = boxed;
      }
      expect(found).toEqual(BOXED[width]);
    });
  }
});
