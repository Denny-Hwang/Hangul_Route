import { LayoutProvider, layout, layoutClassFor } from '@hangul-route/design-system';
import React from 'react';
import { ScrollView } from 'react-native';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it } from 'vitest';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { REALIA_FIXTURES } from '../../../navigation/realia-read-e2e-fixture';
import { resetPlatform, setPlatform, type RenderPlatform } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { RealiaReadGame } from '../RealiaReadGame';

/**
 * F-CURR-001 G-2 follow-up 2 (D-2 D7 on native): Realia Read wires its Screen and GameColumns from
 * one flag. Native side by side: the Screen does not scroll and the two columns are the only scroll
 * views (no scroll inside a scroll, a bounded row). Stacked, and on the web: the one Screen scroll.
 */

// The picture art reads Metro's `__DEV__`, which the Node render lane does not define.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const host: MinigameHost = { mode: 'quest', answer: () => undefined, complete: () => undefined };
const mounted: ReactTestRenderer[] = [];

async function draw(os: RenderPlatform, width: number): Promise<ReactTestInstance> {
  setPlatform(os);
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <LayoutProvider value={layoutClassFor({ width, height: 768 })}>
        <RomanizationModeOverride mode="always">
          <RealiaReadGame scope={REALIA_FIXTURES.menu} host={host} />
        </RomanizationModeOverride>
      </LayoutProvider>,
    );
  });
  mounted.push(r);
  return r.root;
}

const scrollIds = (root: ReactTestInstance): unknown[] => root.findAllByType(ScrollView).map((s) => s.props.testID);

afterEach(async () => {
  for (const r of mounted.splice(0)) {
    await act(async () => {
      r.unmount();
    });
  }
  resetPlatform();
});

describe('Realia Read: Screen and GameColumns agree on who scrolls (D-2 D7)', () => {
  const side = Math.max(layout.sideBySideMin, 1024);

  it.each(['ios', 'android'] as const)('%s side by side: no screen scroll, only the two column scroll views', async (os) => {
    const root = await draw(os, side);
    expect(scrollIds(root).sort()).toEqual(['game-columns-answers-scroll', 'game-columns-prompt-scroll']);
    const answers = root.findAllByType(ScrollView).find((s) => s.props.testID === 'game-columns-answers-scroll')!;
    expect(answers.findAll((n) => n.props.testID === 'realia-read-question').length).toBeGreaterThan(0);
  });

  it.each([
    ['ios', 390],
    ['android', 390],
    ['web', 390],
    ['web', 1024],
  ] as const)('%s at %i: the one screen scroll, no column scroll views', async (os, width) => {
    const root = await draw(os, width);
    const ids = scrollIds(root);
    expect(ids).toHaveLength(1);
    expect(ids).not.toContain('game-columns-prompt-scroll');
    expect(root.findAll((n) => n.props.testID === 'game-columns-pinned')).toHaveLength(0);
  });
});
