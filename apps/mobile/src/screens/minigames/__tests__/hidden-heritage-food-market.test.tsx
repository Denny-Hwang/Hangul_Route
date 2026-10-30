import { readFileSync } from 'node:fs';
import { en, getMessages } from '@hangul-route/i18n';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { FOOD_MARKET_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/food-market';
import { Pressable } from 'react-native';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ALL_LESSON_SCOPES, LESSON_STAGE_MODULES } from '../../../content/__tests__/helpers/lesson-stages';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { localizeScope } from '../../../logic/content-locale';
import { sceneCardBack } from '../../../logic/hidden-heritage-card-back';
import type { MinigameScope } from '../../../logic/minigame-config';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { HiddenHeritageStep } from '../hidden-heritage-entry';
import * as scenes from '../hidden-heritage-scenes';
import type { MinigameHost } from '../host';

/**
 * F-CURR-002 §5.3 S2 and §17 Phase 4 (row CM-43 S2): Food & Daily Life Volume 2, quest 3 Apply, places
 * `scene:food-market`. The step plays the scene's round as the scene holds it; its card back, the end panel shown once
 * every word is found, shows every fact of the scene's note in the UI language with its source line and never a URL;
 * the cell's `minigame:` overlay carries the scene's own es and ko meanings; and with `game.hidden-heritage` off (the
 * launch state) the step plays Pic-Word Match on the same four targets.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const REF = 'minigame:s2-life-v2-q3-apply';
const SCOPE = ALL_LESSON_SCOPES[REF] as MinigameScope;
const FACTS = FOOD_MARKET_SCENE.note.facts;
const mounted: ReactTestRenderer[] = [];
const host: MinigameHost = { mode: 'quest', answer: () => undefined, complete: () => undefined };

const fileOf = <T,>(rel: string): T => JSON.parse(readFileSync(new URL(`../../../../../../${rel}`, import.meta.url), 'utf8')) as T;
type OverlayFile = { entries: Record<string, Record<string, string>> };
const sceneOverlay = (locale: 'es' | 'ko'): Record<string, string> => fileOf<OverlayFile>(`content/i18n/${locale}/hidden-heritage.json`).entries[FOOD_MARKET_SCENE.id]!;
const cellOverlay = (locale: 'es' | 'ko'): Record<string, string> => fileOf<OverlayFile>(`content/i18n/${locale}/lessons-stage2-life-v2.json`).entries[REF]!;

function gameSwitch(on: boolean): void {
  useProfileStore.setState({ activeId: 'profile:hh-food-market-test' });
  useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { 'game.hidden-heritage': { on, pct: on ? 100 : 0 } } } });
}

const wait = (ms: number) => act(async () => new Promise<void>((resolve) => setTimeout(resolve, ms)));

async function draw(locale: 'en' | 'es' | 'ko' = 'en'): Promise<ReactTestRenderer> {
  await act(async () => useLocaleStore.setState({ device: locale, detected: 'en' }));
  const scope = locale === 'en' ? SCOPE : localizeScope(SCOPE, REF, locale, LESSON_STAGE_MODULES[2].LESSON_SCOPE_OVERLAYS);
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
  for (let i = 0; i < 100 && r.root.findAll((n) => n.props.testID === 'lesson-waiting').length > 0; i += 1) await wait(20);
  const measured = r.root.findAll((n) => typeof n.props.onLayout === 'function' && n.props.testID === undefined);
  if (measured[0]) {
    await act(async () => {
      measured[0]!.props.onLayout({ nativeEvent: { layout: { width: 288, height: 500, x: 0, y: 0 } } });
    });
  }
  return r;
}

/** Finds every asked word on its own spot, one after the other, until the end panel shows. */
async function findAll(r: ReactTestRenderer): Promise<ReactTestInstance> {
  const targets = SCOPE.hiddenHeritage!.rounds[0]!.targets;
  for (let i = 0; i < targets.length && r.root.findAll((n) => n.props.testID === 'hh-end').length === 0; i += 1) {
    const ko = r.root.findAll((n) => n.props.testID === 'hh-prompt' && n.props.ko !== undefined)[0]!.props.ko as string;
    const id = targets.find((t) => t.word.ko === ko)!.id;
    const spot = r.root.findAll((n) => n.type === Pressable && n.props.testID === `hh-spot-${id}`)[0]!;
    await act(async () => spot.props.onPress());
    await wait(800);
  }
  return r.root;
}

const textOf = (node: ReactTestInstance): string =>
  node.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string).join(' | ');

beforeEach(() => scenes.resetScenesForTests());

afterEach(async () => {
  for (const r of mounted.splice(0)) {
    await act(async () => {
      r.unmount();
    });
  }
  resetRemoteConfigForTests();
  await act(async () => useLocaleStore.setState({ device: 'en', detected: 'en' }));
});

describe('the food market card back, as data', () => {
  it('lists every fact of the scene note in order, with its first source and never a URL', () => {
    const view = sceneCardBack(FOOD_MARKET_SCENE, 'en', { es: {}, ko: {} }, en.learner.cardDetail.citation);
    expect(view.map((f) => f.id)).toEqual(['f1', 'f2']);
    view.forEach((f, i) => {
      const fact = FACTS[i]!;
      expect(f.claim).toBe(fact.claimEn);
      expect(f.citation?.line).toBe(en.learner.cardDetail.citation.source(fact.sources[0]!.institution, fact.sources[0]!.title));
      expect(f.citation?.line).not.toMatch(/https?:|www\./);
    });
  });

  it.each(['es', 'ko'] as const)('%s: every claim is the scene overlay entry, and every entry of the scene is there', (locale) => {
    const table = sceneOverlay(locale);
    expect(Object.keys(table).sort()).toEqual(
      [
        'art.alt',
        'round.alt',
        ...FOOD_MARKET_SCENE.round.targets.map((t) => `round.targets.${t.id}.word.gloss`),
        ...FOOD_MARKET_SCENE.round.others.map((t) => `round.others.${t.id}.word.gloss`),
        'note.subject',
        ...FACTS.map((f) => `note.facts.${f.id}.claim`),
      ].sort(),
    );
    const view = sceneCardBack(FOOD_MARKET_SCENE, locale, { es: {}, ko: {}, [locale]: { [FOOD_MARKET_SCENE.id]: table } }, getMessages(locale).learner.cardDetail.citation);
    for (const f of view) expect(f.claim, f.id).toBe(table[`note.facts.${f.id}.claim`]);
  });
});

describe('the shipped step (Food & Daily Life Volume 2, quest 3 Apply)', () => {
  it('plays scene:food-market with the round the scene holds, four targets with bundled pictures', () => {
    expect(SCOPE.kind).toBe('hidden-heritage');
    const round = SCOPE.hiddenHeritage!.rounds[0]!;
    expect(round.sceneId).toBe(FOOD_MARKET_SCENE.id);
    const strip = (things: ReadonlyArray<{ id: string; word: { ko: string; romanization: string; en: string }; spot: object }>) =>
      things.map((t) => ({ id: t.id, word: t.word, spot: t.spot }));
    expect(strip(round.targets)).toEqual(strip(FOOD_MARKET_SCENE.round.targets));
    expect(strip(round.others)).toEqual(strip(FOOD_MARKET_SCENE.round.others));
    expect(round.targets.map((t) => t.picture)).toEqual(FOOD_MARKET_SCENE.round.targets.map((t) => t.picture));
    expect(round.altEn).toBe(FOOD_MARKET_SCENE.round.altEn);
  });

  it.each(['es', 'ko'] as const)('%s: the cell overlay copies the scene entries for the alt text and every meaning', (locale) => {
    const scene = sceneOverlay(locale);
    const cell = cellOverlay(locale);
    expect(cell['hiddenHeritage.rounds.hh1.alt']).toBe(scene['round.alt']);
    for (const t of FOOD_MARKET_SCENE.round.targets) expect(cell[`hiddenHeritage.rounds.hh1.targets.${t.id}.word.gloss`], t.id).toBe(scene[`round.targets.${t.id}.word.gloss`]);
    for (const t of FOOD_MARKET_SCENE.round.others) expect(cell[`hiddenHeritage.rounds.hh1.others.${t.id}.word.gloss`], t.id).toBe(scene[`round.others.${t.id}.word.gloss`]);
  });

  it('shows every fact of the scene on its card back once every word is found, with a source line and no URL', async () => {
    gameSwitch(true);
    const r = await draw();
    expect(r.root.findAll((n) => n.props.testID === 'hh-card-back')).toHaveLength(0);
    const root = await findAll(r);
    expect(root.findAll((n) => n.props.testID === 'hh-end').length).toBeGreaterThan(0);
    const back = root.findAll((n) => n.props.testID === 'hh-card-back')[0]!;
    expect(back.props.role).toBe('region');
    expect(textOf(back)).toContain(en.learner.cultureTip.title);
    for (const fact of FACTS) {
      const node = back.findAll((n) => n.props.testID === `hh-card-back-${fact.id}`)[0];
      expect(node, fact.id).toBeDefined();
      expect(textOf(node!), fact.id).toContain(fact.claimEn);
      expect(textOf(node!), fact.id).toContain(fact.sources[0]!.institution);
    }
    expect(textOf(back)).not.toMatch(/https?:|www\./);
  });

  it('es: the card back shows every fact in Spanish, and the spots are named by their Spanish meanings', async () => {
    gameSwitch(true);
    const r = await draw('es');
    const table = sceneOverlay('es');
    const labels = r.root.findAll((n) => n.type === Pressable && typeof n.props.testID === 'string' && n.props.testID.startsWith('hh-spot-')).map((n) => n.props.accessibilityLabel as string);
    expect(labels).toContain(table['round.targets.tteok.word.gloss']);
    expect(labels).toContain(table['round.others.sutgarak.word.gloss']);
    const root = await findAll(r);
    const back = root.findAll((n) => n.props.testID === 'hh-card-back')[0]!;
    for (const fact of FACTS) expect(textOf(back), fact.id).toContain(table[`note.facts.${fact.id}.claim`]);
    expect(textOf(back)).toContain(getMessages('es').learner.cultureTip.title);
  });

  it('with game.hidden-heritage off (the launch state), plays Pic-Word Match on the same four targets and their pictures', async () => {
    gameSwitch(false);
    const r = await draw();
    expect(r.root.findAll((n) => n.props.testID === 'hh-scene')).toHaveLength(0);
    expect(r.root.findAll((n) => n.props.testID === 'hh-card-back')).toHaveLength(0);
    const shown = textOf(r.root);
    for (const t of SCOPE.hiddenHeritage!.rounds[0]!.targets) expect(shown, t.id).toContain(t.word.ko);
  });
});
