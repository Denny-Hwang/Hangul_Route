import { HiddenHeritageRoundSchema } from '@hangul-route/content-schema';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { FOOD_MARKET_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/food-market';
import { Pressable, StyleSheet } from 'react-native';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { questsAll } from '../../../content';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import type { MinigameScope } from '../../../logic/minigame-config';
import { scopeFor } from '../../../logic/minigame-config';
import { useProfileStore } from '../../../store/profile-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { HiddenHeritageStep } from '../hidden-heritage-entry';
import * as scenes from '../hidden-heritage-scenes';
import type { MinigameHost } from '../host';

/**
 * F-CURR-002 row CM-36: the Hidden Heritage step (design/wireframes/minigame/hidden-heritage.md). The game and each scene
 * are lazy chunks; while `game.hidden-heritage` is off (built-in pct 0), when a scene cannot load, or under a 256 dp
 * scene, the step plays Pic-Word Match on the same targets.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const ROUND = HiddenHeritageRoundSchema.parse(FOOD_MARKET_SCENE.round);
const SCOPE: MinigameScope = { kind: 'hidden-heritage', rounds: 3, hiddenHeritage: { rounds: [ROUND] } };
const mounted: ReactTestRenderer[] = [];
const log: Array<[string, boolean]> = [];
let completed = 0;
const host: MinigameHost = { mode: 'quest', answer: (key, correct) => void log.push([String(key), correct]), complete: () => void (completed += 1) };

function gameSwitch(on: boolean): void {
  useProfileStore.setState({ activeId: 'profile:hh-test' });
  useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { 'game.hidden-heritage': { on, pct: on ? 100 : 0 } } } });
}

async function draw(scope: MinigameScope = SCOPE, width = 320, contentWidth = 288): Promise<ReactTestInstance> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <LayoutProvider value={layoutClassFor({ width, height: 568 })}>
        <RomanizationModeOverride mode="always">
          <HiddenHeritageStep scope={scope} host={host} />
        </RomanizationModeOverride>
      </LayoutProvider>,
    );
  });
  mounted.push(r);
  // The two chunks load, then the screen measures its content width.
  for (let i = 0; i < 100 && r.root.findAll((n) => n.props.testID === 'lesson-waiting').length > 0; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
  const measured = r.root.findAll((n) => typeof n.props.onLayout === 'function' && n.props.testID === undefined);
  if (measured[0]) {
    await act(async () => {
      measured[0]!.props.onLayout({ nativeEvent: { layout: { width: contentWidth, height: 500, x: 0, y: 0 } } });
    });
  }
  return r.root;
}

const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((n) => n.props.testID === id);
const spots = (root: ReactTestInstance): ReactTestInstance[] =>
  root.findAll((n) => n.type === Pressable && typeof n.props.testID === 'string' && n.props.testID.startsWith('hh-spot-'));
const text = (root: ReactTestInstance): string => root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string).join(' | ');

beforeEach(() => {
  log.length = 0;
  completed = 0;
  scenes.resetScenesForTests();
});

afterEach(async () => {
  for (const r of mounted.splice(0)) {
    await act(async () => {
      r.unmount();
    });
  }
  resetRemoteConfigForTests();
});

describe('with game.hidden-heritage off (the launch state of this row)', () => {
  it('plays Pic-Word Match on the same targets and never loads a scene', async () => {
    gameSwitch(false);
    const root = await draw();
    expect(byTestId(root, 'hh-scene')).toHaveLength(0);
    expect(root.findAll((n) => n.props.testID === 'lesson-waiting')).toHaveLength(0);
    for (const t of ROUND.targets) expect(root.findAll((n) => n.props.testID === `pic-word-picture-${t.id}`).length, t.id).toBeGreaterThan(0);
  });

  it('every quest step of the kind renders its playable fallback (the shipped content and the reference scene)', async () => {
    gameSwitch(false);
    const steps = questsAll.flatMap((q) => q.steps.filter((s) => s.minigameKind === 'hidden-heritage' && s.minigameRef).map((s) => scopeFor(s.minigameRef!)));
    for (const scope of [...steps, SCOPE]) {
      expect(scope?.kind).toBe('hidden-heritage');
      const root = await draw(scope!);
      expect(root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('pic-word-word-')).length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('with game.hidden-heritage on', () => {
  it('asks a Korean word with its romanization, never an English label, over a scene of spots named by meaning', async () => {
    gameSwitch(true);
    const root = await draw();
    expect(byTestId(root, 'hh-scene').length).toBeGreaterThan(0);
    const prompt = root.findAll((n) => n.props.testID === 'hh-prompt' && n.props.ko !== undefined)[0]!;
    expect(ROUND.targets.map((t) => t.word.ko)).toContain(prompt.props.ko);
    expect(prompt.props.romanization).toBe(ROUND.targets.find((t) => t.word.ko === prompt.props.ko)!.word.romanization);
    expect(prompt.props.gloss).toBeUndefined();
    const shown = text(root);
    for (const t of ROUND.targets) expect(shown).not.toContain(t.word.en);
    expect(shown).toContain('Find this');
    expect(spots(root).map((s) => s.props.accessibilityLabel)).toEqual(['jar', 'basket', 'rice', 'soup', 'kimchi', 'chopsticks']);
  });

  it('every spot is a button of 48 dp or more at 320 px (54 dp for the smallest spot)', async () => {
    gameSwitch(true);
    const root = await draw();
    for (const s of spots(root)) {
      expect(s.props.accessibilityRole).toBe('button');
      const style = StyleSheet.flatten(s.props.style) as { width: number; height: number };
      expect(Math.min(style.width, style.height), s.props.testID).toBeGreaterThanOrEqual(54);
    }
  });

  it('a miss is an amber nudge that ends nothing; the right spot scores, rings and fills a slot', async () => {
    gameSwitch(true);
    const root = await draw();
    const asked = ROUND.targets.find((t) => t.word.ko === root.findAll((n) => n.props.testID === 'hh-prompt' && n.props.ko !== undefined)[0]!.props.ko)!;
    const spot = (id: string) => spots(root).find((s) => s.props.testID === `hh-spot-${id}`)!;
    await act(async () => spot('hangari').props.onPress());
    expect(log).toEqual([[expect.stringMatching(/^w\d$/), false]]);
    expect(text(root)).toContain('Look again');
    expect(root.findAll((n) => n.props.testID === 'hh-ring-miss').length).toBeGreaterThan(0);
    await act(async () => spot(asked.id).props.onPress());
    expect(log[1]).toEqual([log[0]![0], true]);
    expect(root.findAll((n) => n.props.testID === 'hh-ring-found').length).toBeGreaterThan(0);
    expect(root.findAll((n) => n.props.testID === 'hh-slot-0' && n.props.accessibilityLabel === undefined).length).toBeGreaterThan(0);
    expect(completed).toBe(0);
  });

  it('plays Pic-Word Match under a 256 dp scene (a split screen)', async () => {
    gameSwitch(true);
    const narrow = await draw(SCOPE, 288, 255);
    expect(byTestId(narrow, 'hh-scene')).toHaveLength(0);
    expect(narrow.findAll((n) => n.props.testID === 'pic-word-picture-bap').length).toBeGreaterThan(0);
  });

  it('a scene that does not load (not in this build, no chunk) is never drawn: the fallback plays', async () => {
    gameSwitch(true);
    const root = await draw({ ...SCOPE, hiddenHeritage: { rounds: [{ ...ROUND, sceneId: 'scene:not-in-this-build' }] } });
    expect(byTestId(root, 'hh-scene')).toHaveLength(0);
    expect(root.findAll((n) => n.props.testID === 'pic-word-picture-bap').length).toBeGreaterThan(0);
  });
});
