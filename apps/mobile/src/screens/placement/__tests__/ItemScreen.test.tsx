import { apply, startRun, type PlacementConfig, type PlacementEvent, type PlacementRunState } from '@hangul-route/content-schema';
import { TAP_LOCK_MS, TapLockProvider } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { useState, type ReactElement } from 'react';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PLACEMENT_BANK } from '../../../content/placement.generated';
import { itemAnsweredEvent } from '../../../logic/placement/events';
import type { FlowState } from '../../../logic/placement/flow';
import { newResponse, rungPosition } from '../../../logic/placement/session';
import { byTestId, hostNodes, render, unmount } from '../../../test-support/render';
import { PlacementProvider, type PlacementContextValue } from '../context';
import { ItemScreen } from '../ItemScreen';

/**
 * AMENDMENTS-TOUCH row KT-5, section 6.4 (F6; T19; KT-D5): in Standard the next item is current at once and `ItemView`
 * is keyed by the question and the answer count, so the choices remount after every answer. The choices and "not sure"
 * are one `board` board on the app-level lock, and `choose()` and `notSure()` return early while it runs or once their
 * item is answered. So two taps 150 ms apart, the second on the next item's choice in the same place, give one answer
 * and one `placement.item_answered`; a tap 450 ms after the first counts. The harness applies the run as
 * `PlacementScreen` does (the engine, then `placement.item_answered` for each new response). The taps go straight to
 * the host's click handler (rule 9's path, the same lock), with fake timers driving the boards' clock.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

// The level check's route helpers (context.tsx) are not used by an item.
vi.mock('@react-navigation/native', () => ({ useFocusEffect: () => undefined, useNavigation: () => ({}) }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  playPrompt: vi.fn(() => new Promise(() => undefined)),
  stop: vi.fn(),
}));

const CONFIG: PlacementConfig = { mode: 'standard', revealMode: 'tap', audio: true, visual: true, takeMyTime: true, seed: 11, exclude: [], resolvesPicture: () => true };
const m = getMessages('en');

interface Log {
  events: Array<{ name: string; itemId: unknown }>;
}

function Host({ log }: { log: Log }): ReactElement {
  const [run, setRun] = useState<PlacementRunState>(() => startRun(PLACEMENT_BANK, CONFIG, 0));
  const applyRun = (event: PlacementEvent): void => {
    setRun((before) => {
      const after = apply(before, event, Date.now());
      const response = newResponse(before, after);
      const position = rungPosition(before);
      if (response !== null && position !== null) {
        const e = itemAnsweredEvent('profile-1', response, position.gate);
        log.events.push({ name: e.name, itemId: e.payload.itemId });
      }
      return after;
    });
  };
  const value = {
    m,
    flow: { testLocale: 'en' } as FlowState,
    run,
    applyRun,
    say: async () => 'played',
    screenReader: false,
    // The prompt plays on a tap: nothing starts on open.
    needsGesture: true,
    markGesture: () => undefined,
  } as unknown as PlacementContextValue;
  return (
    <PlacementProvider value={value}>
      <ItemScreen />
    </PlacementProvider>
  );
}

const options = (root: ReactTestInstance): ReactTestInstance[] =>
  hostNodes(root, (n) => typeof n.props['data-testid'] === 'string' && (n.props['data-testid'] as string).startsWith('placement-option-') && typeof n.props.onClick === 'function');

/** A click as react-native-web's press responder gets it, straight to the host's handler: the tap clock is not moved. */
async function click(target: ReactTestInstance): Promise<void> {
  const currentTarget = { getAttribute: (name: string): unknown => target.props[name] ?? null, tagName: String(target.type) };
  await act(async () => {
    (target.props.onClick as (e: unknown) => void)({ altKey: false, currentTarget, nativeEvent: {}, preventDefault: () => undefined, stopPropagation: () => undefined });
  });
}
const clickFirstOption = async (root: ReactTestInstance): Promise<string> => {
  const first = options(root)[0];
  if (first === undefined) throw new Error('no option');
  const id = String(first.props['data-testid']);
  await click(first);
  return id;
};
const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const mounted: ReactTestRenderer[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

async function open(log: Log): Promise<ReactTestRenderer> {
  const r = await render(
    <TapLockProvider>
      <Host log={log} />
    </TapLockProvider>,
  );
  mounted.push(r);
  await tick(TAP_LOCK_MS);
  return r;
}

describe('ItemScreen, Standard: one answer per item across the keyed remount (AMENDMENTS-TOUCH KT-5, F6)', () => {
  it('two taps 150 ms apart across the item change give one answer and one placement.item_answered; a tap 450 ms later counts', async () => {
    const log: Log = { events: [] };
    const r = await open(log);
    await clickFirstOption(r.root);
    expect(log.events).toHaveLength(1);
    expect(log.events[0]!.name).toBe('placement.item_answered');
    // The next item is already showing, its own choices in the same place.
    expect(options(r.root).length).toBeGreaterThan(0);
    await tick(150);
    await clickFirstOption(r.root);
    expect(log.events).toHaveLength(1);
    // Past the lock (450 ms after the first tap), a deliberate tap is the next item's answer.
    await tick(300);
    await clickFirstOption(r.root);
    expect(log.events).toHaveLength(2);
    expect(log.events[1]!.itemId).not.toBe(log.events[0]!.itemId);
  });

  it('"not sure" 150 ms after an answer, on the next item, is no answer; once the lock is over it is', async () => {
    const log: Log = { events: [] };
    const r = await open(log);
    await clickFirstOption(r.root);
    await tick(150);
    const notSure = () => byTestId(r.root, 'placement-not-sure').find((n) => typeof n.props.onClick === 'function')!;
    await click(notSure());
    expect(log.events).toHaveLength(1);
    await tick(TAP_LOCK_MS);
    await click(notSure());
    expect(log.events).toHaveLength(2);
  });
});
