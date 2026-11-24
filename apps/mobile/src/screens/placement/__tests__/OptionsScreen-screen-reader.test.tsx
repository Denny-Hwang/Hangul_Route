import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getMessages } from '@hangul-route/i18n';
import type { ReactElement } from 'react';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startFlow, type FlowEvent } from '../../../logic/placement/flow';
import { useLocaleStore } from '../../../store/locale-store';
import { render, unmount } from '../../../test-support/render';
import { PlacementProvider, type PlacementContextValue } from '../context';
import { OptionsScreen } from '../OptionsScreen';

/**
 * F-A11Y-001 OD-AF3 (d) (row AF-1): the level check's "I use a screen reader" is kept for the device, so the web's games
 * take the screen-reader path (Next after a right answer) and the Display sheet's row shows the same answer.
 */
vi.mock('@react-navigation/native', () => ({ useFocusEffect: () => undefined, useNavigation: () => ({}) }));

const m = getMessages('en');
const events: FlowEvent[] = [];

function Host(): ReactElement {
  const flow = startFlow({
    source: 'home',
    levelOrder: 1,
    locales: ['en'],
    uiLocale: 'en',
    placements: [],
    screenReader: false,
    capability: { koreanAudio: true, instructionVoice: true, koreanInstructionVoice: true },
  });
  const value = {
    m,
    flow: { ...flow, screen: 'options', optionsLayout: 'full' },
    dispatch: (event: FlowEvent) => events.push(event),
    say: async () => 'played',
    screenReader: false,
  } as unknown as PlacementContextValue;
  return (
    <PlacementProvider value={value}>
      <OptionsScreen />
    </PlacementProvider>
  );
}

beforeEach(() => {
  events.length = 0;
  useLocaleStore.setState({ screenReader: false });
});

afterEach(() => {
  useLocaleStore.setState({ screenReader: false });
});

describe('the level check\'s screen-reader switch (F-A11Y-001 OD-AF3 (d))', () => {
  it('turning it on or off tells the check and writes the device flag', async () => {
    const setScreenReader = vi.spyOn(useLocaleStore.getState(), 'setScreenReader');
    const r = await render(<Host />);
    const toggle = r.root.find((n) => n.props.testID === 'placement-screen-reader' && typeof n.props.onValueChange === 'function');
    await act(async () => {
      (toggle.props.onValueChange as (on: boolean) => void)(true);
    });
    expect(events).toContainEqual({ type: 'setScreenReader', on: true });
    expect(setScreenReader).toHaveBeenLastCalledWith(true);
    await act(async () => {
      (toggle.props.onValueChange as (on: boolean) => void)(false);
    });
    expect(events).toContainEqual({ type: 'setScreenReader', on: false });
    expect(setScreenReader).toHaveBeenLastCalledWith(false);
    setScreenReader.mockRestore();
    await unmount(r);
  });

  it('the check starts from the same answer: on the web the device flag seeds it, native reads the platform (readerPath)', () => {
    // The boot itself needs the whole level check; the rule is readerPath's (logic/__tests__/answer-feedback.test.ts).
    const source = readFileSync(join(__dirname, '..', 'PlacementScreen.tsx'), 'utf8');
    expect(source).toContain(
      "const reader = readerPath({ platform: Platform.OS, nativeReader: await isScreenReaderEnabled(), webFlag: useLocaleStore.getState().screenReader }) === 'reader';",
    );
    expect(source).toMatch(/startFlow\(\{[\s\S]*?screenReader: reader,/);
  });
});
