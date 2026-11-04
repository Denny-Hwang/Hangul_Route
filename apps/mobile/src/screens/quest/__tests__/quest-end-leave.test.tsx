import { ScreenHeaderSlotContext, type ScreenHeaderSlotProps } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { Pressable, Text } from 'react-native';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { questById } from '../../../content';
import { confirm } from '../../../platform/dialog';
import { useProfileStore } from '../../../store/profile-store';
import { byTestId, press, render, unmount } from '../../../test-support/render';
import { QuestPlayerView } from '../QuestPlayerView';

/**
 * Leaving a quest at its end (F-QUEST-002 amendment NB-1, F-TCH-004 section 3.5 amendment NB-1): on the reward step,
 * the last step, every game is done, so Close (and every back, which runs the same code) finishes the run as See
 * results does and never discards it. Before the reward step Close still asks the leave question.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
  };
});
vi.mock('../../../platform/dialog', () => ({ confirm: vi.fn(async () => false) }));

const CELL = 'episode:stage2-nature';
const Q1 = questById('quest:stage2-nature-q1')!;
const REWARD = Q1.steps.findIndex((s) => s.kind === 'reward');
const mounted: ReactTestRenderer[] = [];

/** A header slot double: draws the screen's own leading control (Close), as the learner header does. */
function HeaderDouble({ options }: ScreenHeaderSlotProps): ReactElement | null {
  const leading = options?.leading;
  if (leading?.onPress === undefined) return null;
  return (
    <Pressable accessibilityRole="button" onPress={leading.onPress} testID={`header-${leading.kind}`}>
      <Text>{leading.kind}</Text>
    </Pressable>
  );
}

async function playerAt(step: number, onAskLeave?: () => void) {
  const ports = { start: () => step, end: vi.fn(), finish: vi.fn(), leave: vi.fn(), track: vi.fn() };
  const r = await render(
    <ScreenHeaderSlotContext.Provider value={HeaderDouble}>
      <QuestPlayerView questId={Q1.id} episodeId={CELL} ports={ports} onOpenGame={() => undefined} onBack={() => undefined} ownClose {...(onAskLeave ? { onAskLeave } : {})} />
    </ScreenHeaderSlotContext.Provider>,
  );
  mounted.push(r);
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return { r, ports };
}

async function close(r: ReactTestRenderer): Promise<void> {
  await press(byTestId(r.root, 'header-close').find((n) => typeof n.props.onClick === 'function')!);
}

beforeEach(() => {
  vi.mocked(confirm).mockClear();
  useProfileStore.setState({ profiles: [], activeId: null });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

describe('Close at the end of a quest (row NB-1)', () => {
  it('the reward step is the last step', () => {
    expect(REWARD).toBe(Q1.steps.length - 1);
  });

  it('on the reward step Close finishes the run (its result is recorded), with no leave question', async () => {
    const { r, ports } = await playerAt(REWARD);
    await close(r);
    expect(ports.finish).toHaveBeenCalledTimes(1);
    expect(ports.leave).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('part way Close still asks the leave question, and Keep playing keeps the run', async () => {
    const { r, ports } = await playerAt(0);
    await close(r);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(ports.finish).not.toHaveBeenCalled();
    expect(ports.leave).not.toHaveBeenCalled();
  });

  it('the All lessons preview keeps its own question on the reward step (it records nothing)', async () => {
    const ask = vi.fn();
    const { r, ports } = await playerAt(REWARD, ask);
    await close(r);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ports.finish).not.toHaveBeenCalled();
  });
});
