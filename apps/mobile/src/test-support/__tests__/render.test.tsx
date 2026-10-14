import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buttonsNamed, cleanup, press, render, resetPlatform, screenTexts, setPlatform, type RenderPlatform } from '../render';

/**
 * The render harness itself (F-BILL-002 B-13): what `screenTexts` reads, so the copy checks in the
 * screen tests are not vacuous on iOS and Android, and that `cleanup` leaves nothing mounted.
 */

afterEach(() => {
  resetPlatform();
});

describe('screenTexts', () => {
  for (const platform of ['web', 'ios', 'android'] as readonly RenderPlatform[]) {
    it(`${platform}: reads text, the accessible name, the hint (which react-native-web drops) and the value text`, async () => {
      setPlatform(platform);
      const renderer = await render(
        <View>
          <Text>Shown line</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Name" accessibilityHint="Spoken hint" onPress={() => undefined}>
            <Text>Label</Text>
          </Pressable>
          <View accessibilityValue={{ text: 'Spoken value' }} />
        </View>,
      );
      const texts = screenTexts(renderer.root);
      for (const text of ['Shown line', 'Name', 'Spoken hint', 'Label', 'Spoken value']) expect(texts, text).toContain(text);
    });
  }
});

describe('press', () => {
  it('runs an enabled button and skips a disabled one, as a click does', async () => {
    const enabled = vi.fn();
    const disabled = vi.fn();
    const renderer = await render(
      <View>
        <Pressable accessibilityRole="button" accessibilityLabel="On" onPress={enabled} />
        <Pressable accessibilityRole="button" accessibilityLabel="Off" disabled onPress={disabled} />
      </View>,
    );
    for (const [label, fn, calls] of [['On', enabled, 1], ['Off', disabled, 0]] as const) {
      const node = buttonsNamed(renderer.root, label)[0];
      if (node?.props.onClick !== undefined) await press(node);
      expect(fn, label).toHaveBeenCalledTimes(calls);
    }
  });
});

describe('cleanup', () => {
  it('unmounts every renderer a test left mounted', async () => {
    const unmounted = vi.fn();
    function Probe(): null {
      React.useEffect(() => unmounted, []);
      return null;
    }
    await render(<Probe />);
    await render(<Probe />);
    await cleanup();
    expect(unmounted).toHaveBeenCalledTimes(2);
  });
});
