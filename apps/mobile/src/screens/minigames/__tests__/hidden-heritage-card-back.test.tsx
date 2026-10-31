import { readdirSync, readFileSync } from 'node:fs';
import { en } from '@hangul-route/i18n';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { FOUR_SEASONS_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/four-seasons';
import { Pressable } from 'react-native';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ALL_LESSON_SCOPES } from '../../../content/__tests__/helpers/lesson-stages';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { sceneCardBack } from '../../../logic/hidden-heritage-card-back';
import type { MinigameScope } from '../../../logic/minigame-config';
import { useProfileStore } from '../../../store/profile-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { HiddenHeritageStep } from '../hidden-heritage-entry';
import * as scenes from '../hidden-heritage-scenes';
import type { MinigameHost } from '../host';

/**
 * F-CURR-002 §17 Phase 4 (row CM-41 S2): a Volume 2 cell that places a Hidden Heritage scene renders the scene's
 * `note.facts` on the step's card back, the end panel shown once every word is found. The shipped step is Nature &
 * Animals Volume 2 quest 2's Apply (`scene:four-seasons`); the card back shows every fact of the scene's note, in the UI
 * language (the scene's own es and ko overlay entries), each with its source line and never a URL.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const REF = 'minigame:s2-nature-v2-q2-apply';
const SCOPE = ALL_LESSON_SCOPES[REF] as MinigameScope;
const FACTS = FOUR_SEASONS_SCENE.note.facts;
const mounted: ReactTestRenderer[] = [];
const host: MinigameHost = { mode: 'quest', answer: () => undefined, complete: () => undefined };

const sceneOverlay = (locale: 'es' | 'ko'): Record<string, string> =>
  (JSON.parse(readFileSync(new URL(`../../../../../../content/i18n/${locale}/hidden-heritage.json`, import.meta.url), 'utf8')) as { entries: Record<string, Record<string, string>> })
    .entries[FOUR_SEASONS_SCENE.id]!;

function gameOn(): void {
  useProfileStore.setState({ activeId: 'profile:hh-card-back-test' });
  useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { 'game.hidden-heritage': { on: true, pct: 100 } } } });
}

const wait = (ms: number) => act(async () => new Promise<void>((resolve) => setTimeout(resolve, ms)));

async function draw(): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
        <RomanizationModeOverride mode="always">
          <HiddenHeritageStep scope={SCOPE} host={host} />
        </RomanizationModeOverride>
      </LayoutProvider>,
    );
  });
  mounted.push(r);
  for (let i = 0; i < 100 && r.root.findAll((n) => n.props.testID === 'lesson-waiting').length > 0; i += 1) await wait(20);
  const measured = r.root.findAll((n) => typeof n.props.onLayout === 'function' && n.props.testID === undefined);
  await act(async () => {
    measured[0]!.props.onLayout({ nativeEvent: { layout: { width: 288, height: 500, x: 0, y: 0 } } });
  });
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
});

describe('the scene card back, as data', () => {
  it('lists every fact of the scene note in order, in English with the en UI, each with its first source and how many more', () => {
    const view = sceneCardBack(FOUR_SEASONS_SCENE, 'en', { es: {}, ko: {} }, en.learner.cardDetail.citation);
    expect(view.map((f) => f.id)).toEqual(FACTS.map((f) => f.id));
    view.forEach((f, i) => {
      const fact = FACTS[i]!;
      expect(f.claim).toBe(fact.claimEn);
      expect(f.citation?.line).toBe(en.learner.cardDetail.citation.source(fact.sources[0]!.institution, fact.sources[0]!.title));
      expect(f.citation?.line).not.toMatch(/https?:|www\./);
      expect(f.citation?.more).toBe(fact.sources.length > 1 ? en.learner.cardDetail.citation.more(fact.sources.length - 1) : null);
    });
  });

  it.each(['es', 'ko'] as const)('%s: every claim is the scene overlay entry note.facts.<id>.claim', (locale) => {
    const table = sceneOverlay(locale);
    const overlays = { es: {}, ko: {}, [locale]: { [FOUR_SEASONS_SCENE.id]: table } };
    const view = sceneCardBack(FOUR_SEASONS_SCENE, locale, overlays, en.learner.cardDetail.citation);
    for (const f of view) expect(f.claim, f.id).toBe(table[`note.facts.${f.id}.claim`]);
  });

  it('falls back to the English claim when a locale has no entry', () => {
    const view = sceneCardBack(FOUR_SEASONS_SCENE, 'ko', { es: {}, ko: {} }, en.learner.cardDetail.citation);
    expect(view.map((f) => f.claim)).toEqual(FACTS.map((f) => f.claimEn));
  });
});

describe('the shipped Hidden Heritage step (Nature & Animals Volume 2, quest 2 Apply)', () => {
  it('places scene:four-seasons, with the round of the scene copied as it is', () => {
    expect(SCOPE.kind).toBe('hidden-heritage');
    const round = SCOPE.hiddenHeritage!.rounds[0]!;
    expect(round.sceneId).toBe(FOUR_SEASONS_SCENE.id);
    const strip = (things: ReadonlyArray<{ id: string; word: { ko: string; romanization: string }; spot: object }>) =>
      things.map((t) => ({ id: t.id, ko: t.word.ko, romanization: t.word.romanization, spot: t.spot }));
    expect(strip(round.targets)).toEqual(strip(FOUR_SEASONS_SCENE.round.targets));
    expect(strip(round.others)).toEqual(strip(FOUR_SEASONS_SCENE.round.others));
    expect(round.targets.map((t) => t.picture)).toEqual(FOUR_SEASONS_SCENE.round.targets.map((t) => t.picture));
  });

  it('shows every fact of the scene on its card back once every word is found, with a source line and no URL', async () => {
    gameOn();
    const r = await draw();
    const root = await findAll(r);
    expect(root.findAll((n) => n.props.testID === 'hh-end').length).toBeGreaterThan(0);
    const back = root.findAll((n) => n.props.testID === 'hh-card-back')[0]!;
    expect(back.props.role).toBe('region');
    expect(textOf(back)).toContain(en.learner.cultureTip.title);
    for (const fact of FACTS) {
      const node = back.findAll((n) => n.props.testID === `hh-card-back-${fact.id}`)[0];
      expect(node, fact.id).toBeDefined();
      const shown = textOf(node!);
      expect(shown, fact.id).toContain(fact.claimEn);
      expect(shown, fact.id).toContain(fact.sources[0]!.institution);
    }
    expect(textOf(back)).not.toMatch(/https?:|www\./);
  });

  it('draws no card back while words are still to find', async () => {
    gameOn();
    const r = await draw();
    expect(r.root.findAll((n) => n.props.testID === 'hh-card-back')).toHaveLength(0);
  });
});

/**
 * The §17 Phase 4 copy rule over every shipped placement: a cell's `minigame:` overlay carries the placed scene's es and
 * ko `round.*` entries word for word (so a later scene edit cannot drift from the cell), and the scene has an es and ko
 * claim for every fact its card back shows (so no locale silently falls back to English).
 */
describe('every shipped Hidden Heritage placement, in es and ko', () => {
  const lessonOverlay = (locale: 'es' | 'ko', ref: string): Record<string, string> | undefined => {
    const dir = new URL(`../../../../../../content/i18n/${locale}/`, import.meta.url);
    for (const file of readdirSync(dir).filter((f) => f.startsWith('lessons-') && f.endsWith('.json'))) {
      const table = (JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as { entries: Record<string, Record<string, string>> }).entries[ref];
      if (table) return table;
    }
    return undefined;
  };
  const placements = Object.entries(ALL_LESSON_SCOPES).flatMap(([ref, scope]) =>
    (scope as MinigameScope).kind === 'hidden-heritage' ? (scope as MinigameScope).hiddenHeritage!.rounds.map((round) => ({ ref, round })) : [],
  );

  it('finds at least the Nature & Animals Volume 2 placement', () => {
    expect(placements.map((p) => p.ref)).toContain(REF);
  });

  for (const locale of ['es', 'ko'] as const) {
    it(`${locale}: each placement's round entries equal the scene's round entries, and every fact has a claim`, async () => {
      for (const { ref, round } of placements) {
        const scene = await scenes.loadScene(round.sceneId);
        expect(scene, round.sceneId).not.toBeNull();
        const table = (JSON.parse(readFileSync(new URL(`../../../../../../content/i18n/${locale}/hidden-heritage.json`, import.meta.url), 'utf8')) as {
          entries: Record<string, Record<string, string>>;
        }).entries[round.sceneId];
        expect(table, `${locale} ${round.sceneId}`).toBeDefined();
        const cell = lessonOverlay(locale, ref) ?? {};
        const roundKeys = Object.keys(table!).filter((k) => k.startsWith('round.'));
        expect(roundKeys.length, `${locale} ${round.sceneId}`).toBeGreaterThan(0);
        for (const key of roundKeys) {
          const path = key.slice('round.'.length);
          expect(cell[`hiddenHeritage.rounds.${round.id}.${path}`], `${locale} ${ref} ${path}`).toBe(table![key]);
        }
        for (const fact of scene!.note.facts) expect(table![`note.facts.${fact.id}.claim`], `${locale} ${round.sceneId} ${fact.id}`).toBeTruthy();
      }
    });
  }
});
