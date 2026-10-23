import { HiddenHeritageRoundSchema, checkRomanization } from '@hangul-route/content-schema';
import { allowlistedInstitution } from '@hangul-route/content-schema/lint';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { supportedCardIds } from '@hangul-route/design-system/heritage-card-ids';
import { SEOLLAL_ROOM_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/seollal-room';
import { Pressable, StyleSheet } from 'react-native';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { localizeReferenceRound } from '../../../logic/hidden-heritage-reference';
import type { MinigameScope } from '../../../logic/minigame-config';
import { useProfileStore } from '../../../store/profile-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { HiddenHeritageStep } from '../hidden-heritage-entry';
import * as scenes from '../hidden-heritage-scenes';
import type { MinigameHost } from '../host';

/**
 * F-CURR-002 row CM-37 part 2: the Holidays & Traditions Hidden Heritage scene (hidden-heritage/seollal-room), played
 * through the CM-36 step: its own lazy chunk, its taught Korean words with romanization, its hit areas at 320 px, the
 * Pic-Word Match fallback while `game.hidden-heritage` is off, the culture-source allowlist on every source, and its
 * es / ko text.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const SCENE = SEOLLAL_ROOM_SCENE;
const ROUND = HiddenHeritageRoundSchema.parse(SCENE.round);
const SCOPE: MinigameScope = { kind: 'hidden-heritage', rounds: ROUND.targets.length, hiddenHeritage: { rounds: [ROUND] } };
const THINGS = [...ROUND.targets, ...ROUND.others];
const mounted: ReactTestRenderer[] = [];
const host: MinigameHost = { mode: 'quest', answer: () => undefined, complete: () => undefined };

function gameSwitch(on: boolean): void {
  useProfileStore.setState({ activeId: 'profile:hh-test' });
  useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { 'game.hidden-heritage': { on, pct: on ? 100 : 0 } } } });
}

async function draw(scope: MinigameScope = SCOPE, contentWidth = 288): Promise<ReactTestInstance> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
        <RomanizationModeOverride mode="always">
          <HiddenHeritageStep scope={scope} host={host} />
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

const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((n) => n.props.testID === id);
const spots = (root: ReactTestInstance): ReactTestInstance[] =>
  root.findAll((n) => n.type === Pressable && typeof n.props.testID === 'string' && n.props.testID.startsWith('hh-spot-'));
const text = (root: ReactTestInstance): string => root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string).join(' | ');

beforeEach(() => {
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

describe('the Seollal room scene content', () => {
  it('romanizes every thing it names with the F-CNT-002 converter (registered B1 source)', () => {
    for (const t of THINGS) expect(checkRomanization(t.word.ko, t.word.romanization), t.id).toEqual([]);
  });

  it('is a valid round whose targets are taught Holidays words with a bundled card picture each', () => {
    expect(ROUND.sceneId).toBe('scene:seollal-room');
    for (const t of ROUND.targets) expect(supportedCardIds, t.id).toContain(t.picture);
  });

  it('every fact source and every artefact source passes the culture-source allowlist, named as of its access date (§6.6)', () => {
    for (const fact of SCENE.note.facts) {
      for (const s of fact.sources) {
        const match = allowlistedInstitution(s.institution, s.accessed, s.url);
        expect(match?.institution.name, `${fact.id} ${s.url}`).toBe(s.institution);
        expect(match?.nameAsOfAccess, `${fact.id} ${s.url}`).toBe(true);
      }
    }
    for (const item of SCENE.items.filter((i) => i.sourceRef)) {
      const { publisher, accessed, url } = item.sourceRef!;
      expect(allowlistedInstitution(publisher, accessed, url)?.nameAsOfAccess, item.id).toBe(true);
    }
  });

  it('is its own lazy chunk, loaded by its scene id', async () => {
    await expect(scenes.loadScene('scene:seollal-room')).resolves.toBe(SCENE);
  });
});

describe('the reference round in the UI language', () => {
  it('English is the round as written', () => {
    expect(localizeReferenceRound(ROUND, SCENE.overlays, 'en')).toBe(ROUND);
  });

  it('Spanish and Korean replace the alt text and every meaning, never the Korean word or its romanization', () => {
    for (const locale of ['es', 'ko'] as const) {
      const round = localizeReferenceRound(ROUND, SCENE.overlays, locale);
      expect(round.altEn).toBe(SCENE.overlays![locale]!.alt);
      for (const [i, t] of [...round.targets, ...round.others].entries()) {
        expect(t.word.en, t.id).toBe(SCENE.overlays![locale]!.things[t.id]);
        expect(t.word.ko).toBe(THINGS[i]!.word.ko);
        expect(t.word.romanization).toBe(THINGS[i]!.word.romanization);
      }
    }
    expect(localizeReferenceRound(ROUND, SCENE.overlays, 'es').targets.find((t) => t.id === 'yeon')!.word.en).toBe('cometa');
  });

  it('a meaning the overlay leaves out stays English', () => {
    const partial = { es: { ...SCENE.overlays!.es!, things: { hanbok: 'ropa tradicional coreana' } } };
    expect(localizeReferenceRound(ROUND, partial, 'es').targets.find((t) => t.id === 'tteokguk')!.word.en).toBe('rice-cake soup');
  });
});

describe('with game.hidden-heritage off (the launch state)', () => {
  it('plays Pic-Word Match on the same three targets with their card pictures, and never loads the scene', async () => {
    gameSwitch(false);
    const root = await draw();
    expect(byTestId(root, 'hh-scene')).toHaveLength(0);
    for (const t of ROUND.targets) expect(root.findAll((n) => n.props.testID === `pic-word-picture-${t.id}`).length, t.id).toBeGreaterThan(0);
  });
});

describe('with game.hidden-heritage on', () => {
  it('asks a Korean word with its romanization, never an English label, over spots named by meaning in reading order', async () => {
    gameSwitch(true);
    const root = await draw();
    expect(byTestId(root, 'hh-scene').length).toBeGreaterThan(0);
    const prompt = root.findAll((n) => n.props.testID === 'hh-prompt' && n.props.ko !== undefined)[0]!;
    expect(ROUND.targets.map((t) => t.word.ko)).toContain(prompt.props.ko);
    expect(prompt.props.romanization).toBe(ROUND.targets.find((t) => t.word.ko === prompt.props.ko)!.word.romanization);
    expect(prompt.props.gloss).toBeUndefined();
    const shown = text(root);
    for (const t of ROUND.targets) expect(shown).not.toContain(t.word.en);
    // Top row (the wall): hanbok, pouch, kite; bottom row (the floor): soup, cushion, yut sticks.
    expect(spots(root).map((s) => s.props.accessibilityLabel)).toEqual(['traditional Korean clothes', 'lucky pouch', 'kite', 'rice-cake soup', 'floor cushion', 'yut sticks']);
  });

  it('every spot is a button of 54 dp or more at 320 px, so it clears the 48 dp of §7.1 and §14', async () => {
    gameSwitch(true);
    const root = await draw();
    expect(spots(root)).toHaveLength(THINGS.length);
    for (const s of spots(root)) {
      expect(s.props.accessibilityRole).toBe('button');
      const style = StyleSheet.flatten(s.props.style) as { width: number; height: number };
      expect(Math.min(style.width, style.height), s.props.testID).toBeGreaterThanOrEqual(54);
    }
  });

  it('a scene chunk that does not load is never drawn: the fallback plays', async () => {
    gameSwitch(true);
    const root = await draw({ ...SCOPE, hiddenHeritage: { rounds: [{ ...ROUND, sceneId: 'scene:not-in-this-build' }] } });
    expect(byTestId(root, 'hh-scene')).toHaveLength(0);
    expect(root.findAll((n) => n.props.testID === 'pic-word-picture-tteokguk').length).toBeGreaterThan(0);
  });
});
