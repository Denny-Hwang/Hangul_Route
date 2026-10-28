import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fnv1a32 } from '../../../logic/remote-config/remote-config';
import { planSprint, SPRINT_MS } from '../../../logic/syllable-build/sprint';
import { useAudioStore } from '../../../store/audio-store';
import { byTestId, press, screenTexts } from '../../../test-support/render';
import { DecodingSprintScreen, TIME_UP_MS } from '../DecodingSprintScreen';
import { MISS_REVEAL_MS, PROBE_NEXT_MS, RIGHT_REVEAL_MS } from '../SprintPick';

/**
 * F-CURR-002 section 7.1 F9, OD-8 and section 11.3, row CM-32: the Block Sprint from Start to its result. One clock for
 * the minute that holds while an answer shows and while paused (Pause hides the round), then the held-out probe with no
 * clock, then the count and, from the second sprint, the learner's own best. The record stays on the device and the one
 * event carries buckets only.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const store = vi.hoisted(() => ({ value: null as unknown, writes: [] as unknown[] }));
const track = vi.hoisted(() => vi.fn<(event: unknown) => Promise<void>>(() => Promise.resolve()));
vi.mock('../../../platform/telemetry', () => ({ track }));
/** The device voice: 'played' (heard) or 'unavailable' (no Korean voice, so the block is read from its romanization). */
const voice = vi.hoisted(() => ({ result: 'played' as 'played' | 'unavailable' }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  playPrompt: async () => voice.result,
  stop: () => undefined,
}));
const app = vi.hoisted(() => ({ listeners: [] as Array<(active: boolean) => void> }));
vi.mock('../../../platform/app-state', () => ({
  subscribeAppActive: (fn: (active: boolean) => void) => {
    app.listeners.push(fn);
    return () => {
      app.listeners = app.listeners.filter((l) => l !== fn);
    };
  },
}));
vi.mock('../sprint-record', () => ({
  readDecodeSprint: async () => store.value,
  writeDecodeSprint: async (_id: string, record: unknown) => {
    store.writes.push(record);
    store.value = record;
  },
}));

const mounted: ReactTestRenderer[] = [];
async function mount(onClose = vi.fn(), buildOn = false): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
        <DecodingSprintScreen profileId="p1" buildOn={buildOn} onClose={onClose} />
      </LayoutProvider>,
      { createNodeMock: () => ({ focus: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined }) },
    );
  });
  mounted.push(r);
  return r;
}
const tap = async (root: ReactTestInstance, id: string): Promise<void> => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};
const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};
const texts = (r: ReactTestRenderer): string[] => screenTexts(r.root);
const plan = (index: number) => planSprint(fnv1a32(`p1|decode-sprint|${index}`), false, index);

beforeEach(() => {
  store.value = null;
  store.writes = [];
  track.mockClear();
  voice.result = 'played';
  app.listeners = [];
  useAudioStore.setState({ tts: { state: 'unknown' }, muted: false });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) {
    await act(async () => {
      r.unmount();
    });
  }
  vi.useRealTimers();
});

/** Plays the drill: `right` rounds right, one miss, then lets the clock run out; then the probe, all right. */
async function playSprint(r: ReactTestRenderer, index: number, right: number): Promise<void> {
  const p = plan(index);
  await tap(r.root, 'decoding-sprint-start');
  expect(texts(r)).toContain('1:00');
  for (let i = 0; i < right; i += 1) {
    await tap(r.root, `decoding-sprint-pick-option-${p.drill[i]!.target}`);
    await advance(RIGHT_REVEAL_MS);
  }
  const missed = p.drill[right]!;
  const wrong = (missed.kind === 'pick' ? missed.options : []).find((o) => o !== missed.target)!;
  await tap(r.root, `decoding-sprint-pick-option-${wrong}`);
  await advance(MISS_REVEAL_MS);
  await advance(SPRINT_MS + 1000);
  expect(texts(r)).toContain("That's the time! Nice work.");
  await advance(TIME_UP_MS);
  expect(texts(r)).toContain('A few more blocks. No clock now.');
  await tap(r.root, 'decoding-sprint-probe-start');
  for (const round of p.probe) {
    await advance(1500);
    await tap(r.root, `decoding-sprint-probe-pick-option-${round.target}`);
    await advance(PROBE_NEXT_MS);
  }
}

describe('the Block Sprint', () => {
  it('a first sprint: Start, one clock for the minute, the probe, then the count with no best line; the record and the event', async () => {
    const r = await mount();
    expect(texts(r)).toContain('Block Sprint');
    // game.syllable-build off: every round is a pick, so the intro promises no build.
    expect(texts(r)).toContain('One minute on the clock. Hear a block, then pick it.');
    await playSprint(r, 1, 3);
    expect(texts(r)).toContain('3 blocks read');
    expect(byTestId(r.root, 'decoding-sprint-best')).toHaveLength(0);
    expect(byTestId(r.root, 'decoding-sprint-new-best')).toHaveLength(0);
    expect(store.writes).toEqual([{ v: 1, sprints: 1, best: 3 }]);
    const sprintEvents = track.mock.calls.map((c) => c[0] as { name: string }).filter((e) => e.name === 'decode.sprint.finished');
    expect(sprintEvents).toHaveLength(1);
    expect(sprintEvents[0]).toEqual({
      name: 'decode.sprint.finished',
      profileId: 'p1',
      payload: { rateBucket: '3-4', probeRateBucket: '40-49', sprintIndexBucket: '1' },
    });
  });

  it('with game.syllable-build on, the intro says pick it or build it', async () => {
    const r = await mount(vi.fn(), true);
    expect(texts(r)).toContain('One minute on the clock. Hear a block, then pick it or build it.');
  });

  it('a later sprint shows the own best, and New best! only above it', async () => {
    store.value = { v: 1, sprints: 1, best: 2 };
    const r = await mount();
    await playSprint(r, 2, 4);
    expect(texts(r)).toContain('4 blocks read');
    expect(texts(r)).toContain('New best!');
    expect(texts(r)).toContain('Your best: 4');
    // Play again: a third sprint below the best keeps it, with no New best line. It starts from the record just
    // finished, not a storage read, so even a write that has not landed cannot give it the old index or lose the best.
    store.value = { v: 1, sprints: 1, best: 2 };
    await tap(r.root, 'decoding-sprint-again');
    await advance(0);
    await playSprint(r, 3, 1);
    expect(texts(r)).toContain('1 block read');
    expect(texts(r)).toContain('Your best: 4');
    expect(byTestId(r.root, 'decoding-sprint-new-best')).toHaveLength(0);
    expect(store.writes).toEqual([
      { v: 1, sprints: 2, best: 4 },
      { v: 1, sprints: 3, best: 4 },
    ]);
  });

  it('Pause hides the round and holds the clock; Resume brings the round back; Stop leaves and saves nothing', async () => {
    const onClose = vi.fn();
    const r = await mount(onClose);
    await tap(r.root, 'decoding-sprint-start');
    await advance(10_000);
    expect(texts(r)).toContain('0:50');
    await tap(r.root, 'decoding-sprint-pause');
    expect(texts(r)).toContain('Paused');
    expect(byTestId(r.root, 'decoding-sprint-pick')).toHaveLength(0);
    await advance(5 * 60_000);
    expect(texts(r)).not.toContain("That's the time! Nice work.");
    await tap(r.root, 'vocab-speed-resume');
    expect(byTestId(r.root, 'decoding-sprint-pick').length).toBeGreaterThan(0);
    expect(texts(r)).toContain('0:50');
    await tap(r.root, 'decoding-sprint-pause');
    await tap(r.root, 'vocab-speed-paused-stop');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(store.writes).toEqual([]);
    expect(track.mock.calls.map((c) => (c[0] as { name: string }).name)).not.toContain('decode.sprint.finished');
  });

  it('the clock holds while an answer shows', async () => {
    const r = await mount();
    const p = plan(1);
    await tap(r.root, 'decoding-sprint-start');
    await advance(2000);
    await tap(r.root, `decoding-sprint-pick-option-${p.drill[0]!.target}`);
    expect(texts(r)).toContain('0:58');
    await advance(RIGHT_REVEAL_MS - 50);
    expect(texts(r)).toContain('0:58');
  });

  it('the probe only measures: a tap shows no answer, no right or miss, and the next block comes up', async () => {
    const r = await mount();
    const p = plan(1);
    await tap(r.root, 'decoding-sprint-start');
    await advance(SPRINT_MS + 1000);
    await advance(TIME_UP_MS);
    await tap(r.root, 'decoding-sprint-probe-start');
    const first = p.probe[0]!;
    const wrong = first.options.find((o) => o !== first.target)!;
    await tap(r.root, `decoding-sprint-probe-pick-option-${wrong}`);
    expect(byTestId(r.root, 'decoding-sprint-probe-pick-answer')).toHaveLength(0);
    expect(texts(r)).not.toContain(first.romanization);
    const states = byTestId(r.root, `decoding-sprint-probe-pick-option-${first.target}`).map((n) => n.props.state).filter((v) => v !== undefined);
    expect(states).not.toContain('correct');
    expect(byTestId(r.root, `decoding-sprint-probe-pick-option-${wrong}`).map((n) => n.props.state)).not.toContain('wrong');
    await advance(PROBE_NEXT_MS);
    expect(byTestId(r.root, `decoding-sprint-probe-pick-option-${p.probe[1]!.target}`).length).toBeGreaterThan(0);
  });

  it('with no device voice the probe is read, so the sprint keeps its best but sends no event', async () => {
    voice.result = 'unavailable';
    const r = await mount();
    await playSprint(r, 1, 2);
    expect(texts(r)).toContain('2 blocks read');
    expect(store.writes).toEqual([{ v: 1, sprints: 1, best: 2 }]);
    expect(track.mock.calls.map((c) => (c[0] as { name: string }).name)).not.toContain('decode.sprint.finished');
  });

  it('time with the app in the background does not count toward the probe', async () => {
    const r = await mount();
    const p = plan(1);
    await tap(r.root, 'decoding-sprint-start');
    await advance(SPRINT_MS + 1000);
    await advance(TIME_UP_MS);
    await tap(r.root, 'decoding-sprint-probe-start');
    for (const [i, round] of p.probe.entries()) {
      await advance(1500);
      if (i === 0) {
        // Away for ten minutes before the first tap.
        await act(async () => {
          for (const l of [...app.listeners]) l(false);
        });
        await advance(10 * 60_000);
        await act(async () => {
          for (const l of [...app.listeners]) l(true);
        });
      }
      await tap(r.root, `decoding-sprint-probe-pick-option-${round.target}`);
      await advance(PROBE_NEXT_MS);
    }
    const sprintEvents = track.mock.calls.map((c) => c[0] as { name: string; payload: { probeRateBucket: string } }).filter((e) => e.name === 'decode.sprint.finished');
    expect(sprintEvents[0]?.payload.probeRateBucket).toBe('40-49');
  });

  it('the build switch is read at Start: a change mid-sprint never swaps the rounds', async () => {
    let r!: ReactTestRenderer;
    const tree = (buildOn: boolean) => (
      <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
        <DecodingSprintScreen profileId="p1" buildOn={buildOn} onClose={() => undefined} />
      </LayoutProvider>
    );
    await act(async () => {
      r = TestRenderer.create(tree(false), { createNodeMock: () => ({ focus: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined }) });
    });
    mounted.push(r);
    const p = plan(1);
    await tap(r.root, 'decoding-sprint-start');
    await tap(r.root, `decoding-sprint-pick-option-${p.drill[0]!.target}`);
    await act(async () => {
      r.update(tree(true));
    });
    await advance(RIGHT_REVEAL_MS);
    // Round 2 with the switch on would be a build; latched off, it is the same pick as planned.
    expect(byTestId(r.root, 'decoding-sprint-build')).toHaveLength(0);
    expect(byTestId(r.root, `decoding-sprint-pick-option-${p.drill[1]!.target}`).length).toBeGreaterThan(0);
  });
});
