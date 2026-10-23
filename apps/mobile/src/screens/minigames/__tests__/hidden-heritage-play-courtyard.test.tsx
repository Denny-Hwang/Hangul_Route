import { HiddenHeritageRoundSchema, checkRomanization, isOverlayFieldAllowed } from '@hangul-route/content-schema';
import { lintCardSources } from '@hangul-route/content-schema/lint';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { PLAY_COURTYARD_OVERLAYS, PLAY_COURTYARD_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/play-courtyard';
import { Pressable, StyleSheet } from 'react-native';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { questsAll } from '../../../content';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import type { MinigameScope } from '../../../logic/minigame-config';
import { useProfileStore } from '../../../store/profile-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { HiddenHeritageStep } from '../hidden-heritage-entry';
import * as scenes from '../hidden-heritage-scenes';
import type { MinigameHost } from '../host';

/**
 * F-CURR-002 row CM-37 part 4: the Play & Crafts Hidden Heritage scene, a courtyard of the traditional games (§5.6 S2),
 * in the app: its lazy chunk, its round as the step plays it, the Pic-Word Match fallback while `game.hidden-heritage`
 * is off (the launch state), the hit areas at 320 px, the taught Play words it asks, and `culture-source` on its note.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const SCENE = PLAY_COURTYARD_SCENE;
const ROUND = HiddenHeritageRoundSchema.parse(SCENE.round);
const SCOPE: MinigameScope = { kind: 'hidden-heritage', rounds: ROUND.targets.length, hiddenHeritage: { rounds: [ROUND] } };
const mounted: ReactTestRenderer[] = [];
const log: Array<[string, boolean]> = [];
const host: MinigameHost = { mode: 'quest', answer: (key, correct) => void log.push([String(key), correct]), complete: () => undefined };

function gameSwitch(on: boolean): void {
  useProfileStore.setState({ activeId: 'profile:hh-play-test' });
  useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { 'game.hidden-heritage': { on, pct: on ? 100 : 0 } } } });
}

async function draw(width = 320, contentWidth = 288): Promise<ReactTestInstance> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <LayoutProvider value={layoutClassFor({ width, height: 568 })}>
        <RomanizationModeOverride mode="always">
          <HiddenHeritageStep scope={SCOPE} host={host} />
        </RomanizationModeOverride>
      </LayoutProvider>,
    );
  });
  mounted.push(r);
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

const spots = (root: ReactTestInstance): ReactTestInstance[] =>
  root.findAll((n) => n.type === Pressable && typeof n.props.testID === 'string' && n.props.testID.startsWith('hh-spot-'));

beforeEach(() => {
  log.length = 0;
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

describe('the Play courtyard scene in the app (row CM-37 part 4)', () => {
  it('loads from its own chunk by its id, and its round passes the lesson schema', async () => {
    const loaded = await scenes.loadScene('scene:play-courtyard');
    expect(loaded?.id).toBe('scene:play-courtyard');
    expect(loaded?.round).toEqual(SCENE.round);
    expect(HiddenHeritageRoundSchema.safeParse(SCENE.round).success).toBe(true);
  });

  it('asks the Play words quest:stage2-crafts-q2 teaches, with the taught meaning and Revised Romanization', () => {
    const q2 = questsAll.find((q) => q.id === 'quest:stage2-crafts-q2');
    expect(q2).toBeDefined();
    const taught = JSON.stringify(q2);
    for (const t of ROUND.targets) {
      expect(taught, t.word.ko).toContain(`"ko":"${t.word.ko}","romanization":"${t.word.romanization}","en":"${t.word.en}"`);
    }
    for (const thing of [...ROUND.targets, ...ROUND.others]) expect(checkRomanization(thing.word.ko, thing.word.romanization), thing.id).toEqual([]);
  });

  it('its es and ko meanings sit under overlay paths a lesson round may carry', () => {
    for (const locale of ['es', 'ko'] as const) {
      for (const path of Object.keys(PLAY_COURTYARD_OVERLAYS[locale])) expect(isOverlayFieldAllowed('minigame:s2-crafts-v2-q1-practice', path), path).toBe(true);
    }
  });

  it('culture-source: every fact cites a §6.6 institution, on its own host, under its name on the access date', () => {
    const cards = SCENE.note.facts.map((f) => ({ cardId: f.id, sources: f.sources.map((s) => ({ title: s.title, publisher: s.institution, url: s.url, accessed: s.accessed })) }));
    expect(lintCardSources(cards, 'packages/design-system/src/scene-art/hidden-heritage/play-courtyard.ts')).toEqual([]);
  });
});

describe('with game.hidden-heritage off (the launch state)', () => {
  it('plays Pic-Word Match on the four targets with their own card pictures and never loads the scene', async () => {
    gameSwitch(false);
    const root = await draw();
    expect(root.findAll((n) => n.props.testID === 'hh-scene')).toHaveLength(0);
    for (const t of ROUND.targets) expect(root.findAll((n) => n.props.testID === `pic-word-picture-${t.id}`).length, t.id).toBeGreaterThan(0);
    expect(root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('pic-word-word-')).length).toBeGreaterThanOrEqual(4);
  });
});

describe('with game.hidden-heritage on', () => {
  it('every thing is a button named by its meaning, in reading order, 54 dp or more at 320 px', async () => {
    gameSwitch(true);
    const root = await draw();
    expect(root.findAll((n) => n.props.testID === 'hh-scene').length).toBeGreaterThan(0);
    const all = spots(root);
    expect(all.map((s) => s.props.accessibilityLabel)).toEqual(['kite', 'string reel', 'folded paper tile', 'a shuttlecock toy you kick', 'jackstones', 'spinning top', 'yut sticks', 'yut board']);
    for (const s of all) {
      expect(s.props.accessibilityRole).toBe('button');
      const style = StyleSheet.flatten(s.props.style) as { width: number; height: number };
      expect(Math.min(style.width, style.height), s.props.testID).toBeGreaterThanOrEqual(54);
    }
  });

  it('the asked word is Korean with romanization; a tap on the other yut thing is a nudge, not an end', async () => {
    gameSwitch(true);
    const root = await draw();
    const prompt = root.findAll((n) => n.props.testID === 'hh-prompt' && n.props.ko !== undefined)[0]!;
    const asked = ROUND.targets.find((t) => t.word.ko === prompt.props.ko)!;
    expect(asked).toBeDefined();
    expect(prompt.props.romanization).toBe(asked.word.romanization);
    expect(prompt.props.gloss).toBeUndefined();
    const other = asked.id === 'yut' ? 'yutpan' : 'eolle';
    await act(async () => spots(root).find((s) => s.props.testID === `hh-spot-${other}`)!.props.onPress());
    expect(log).toEqual([[expect.stringMatching(/^w\d$/), false]]);
    expect(root.findAll((n) => n.props.testID === 'hh-ring-miss').length).toBeGreaterThan(0);
    await act(async () => spots(root).find((s) => s.props.testID === `hh-spot-${asked.id}`)!.props.onPress());
    expect(log[1]).toEqual([log[0]![0], true]);
  });
});
