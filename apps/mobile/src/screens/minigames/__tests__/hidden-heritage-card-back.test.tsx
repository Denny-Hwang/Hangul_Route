import { OVERLAYS } from '@hangul-route/content-schema/overlays';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { PLAY_COURTYARD_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/play-courtyard';
import { getMessages } from '@hangul-route/i18n';
import { Pressable } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LESSON_STAGE_MODULES } from '../../../content/__tests__/helpers/lesson-stages';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { localizeScope } from '../../../logic/content-locale';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { byTestId, hostNodes, render, textOf, unmount } from '../../../test-support/render';
import { HiddenHeritageStep } from '../hidden-heritage-entry';
import * as scenes from '../hidden-heritage-scenes';
import type { MinigameHost } from '../host';

/**
 * F-CURR-002 §17 Phase 4 (row CM-42 S2, the first Volume 2 row that places a Hidden Heritage scene): the Play & Crafts
 * Volume 2 step `minigame:s2-crafts-v2-q1-apply` plays `scene:play-courtyard` as shipped in the lesson chunk, and the
 * step's card back, under the end panel's found words, shows every fact of the scene's note in the UI language with its
 * source line. The step's spot meanings are the scene's own es and ko entries, copied into the cell's `minigame:`
 * overlay. With `game.hidden-heritage` off (the launch state) the step plays Pic-Word Match on the same targets.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const REF = 'minigame:s2-crafts-v2-q1-apply';
const STAGE2 = LESSON_STAGE_MODULES[2];
const SHIPPED = STAGE2.LESSON_SCOPES[REF]!;
const SCENE = PLAY_COURTYARD_SCENE;
const mounted: ReactTestRenderer[] = [];
const log: Array<[string, boolean]> = [];
let completed = 0;
const host: MinigameHost = {
  mode: 'quest',
  answer: (key, correct) => void log.push([String(key), correct]),
  complete: () => void (completed += 1),
};

function gameSwitch(on: boolean): void {
  useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { 'game.hidden-heritage': { on, pct: on ? 100 : 0 } } } });
}

async function draw(locale: 'en' | 'es' | 'ko'): Promise<ReactTestRenderer> {
  await act(async () => useLocaleStore.setState({ device: locale, detected: 'en' }));
  const scope = localizeScope(SHIPPED, REF, locale, STAGE2.LESSON_SCOPE_OVERLAYS);
  const r = await render(
    <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
      <RomanizationModeOverride mode="always">
        <HiddenHeritageStep scope={scope} host={host} />
      </RomanizationModeOverride>
    </LayoutProvider>,
  );
  mounted.push(r);
  for (let i = 0; i < 100 && byTestId(r.root, 'lesson-waiting').length > 0; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
  const measured = r.root.findAll((n) => typeof n.props.onLayout === 'function' && n.props.testID === undefined);
  if (measured[0]) {
    await act(async () => {
      measured[0]!.props.onLayout({ nativeEvent: { layout: { width: 288, height: 500, x: 0, y: 0 } } });
    });
  }
  return r;
}

const spots = (root: ReactTestInstance): ReactTestInstance[] =>
  root.findAll((n) => n.type === Pressable && typeof n.props.testID === 'string' && n.props.testID.startsWith('hh-spot-'));

/** Finds every asked word on its first tap, waiting out each find's pause, until the end panel shows. */
async function playToEnd(r: ReactTestRenderer): Promise<void> {
  const round = SHIPPED.hiddenHeritage!.rounds[0]!;
  for (let i = 0; i < round.targets.length * 3 && byTestId(r.root, 'hh-end').length === 0; i += 1) {
    const prompt = r.root.findAll((n) => n.props.testID === 'hh-prompt' && n.props.ko !== undefined)[0];
    const asked = prompt ? round.targets.find((t) => t.word.ko === prompt.props.ko) : undefined;
    if (asked) await act(async () => spots(r.root).find((s) => s.props.testID === `hh-spot-${asked.id}`)!.props.onPress());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
    });
  }
}

/** The text with its spacing dropped: `textOf` joins a line's runs (the Korean ones marked) with spaces. */
const flat = (text: string): string => text.replace(/\s+/g, '');

beforeEach(() => {
  log.length = 0;
  completed = 0;
  scenes.resetScenesForTests();
  useProfileStore.setState({ activeId: 'profile:hh-card-back' });
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useLocaleStore.setState({ device: 'en', detected: 'en' });
  resetRemoteConfigForTests();
});

describe('the shipped Volume 2 step places scene:play-courtyard (row CM-42 S2)', () => {
  it('is the scene reference round, its spots and pictures as the scene draws them', () => {
    expect(SHIPPED.kind).toBe('hidden-heritage');
    expect(SHIPPED.hiddenHeritage!.rounds).toEqual([SCENE.round]);
  });

  it("copies the scene's es and ko entries into the cell's minigame: overlay (alt text and every spot meaning)", () => {
    const round = SCENE.round;
    for (const locale of ['es', 'ko'] as const) {
      const scene = OVERLAYS[locale][SCENE.id]!;
      const cell = STAGE2.LESSON_SCOPE_OVERLAYS[locale][REF]!;
      expect(cell['hiddenHeritage.rounds.hh1.alt'], locale).toBe(scene['round.alt']);
      for (const t of round.targets) expect(cell[`hiddenHeritage.rounds.hh1.targets.${t.id}.word.gloss`], `${locale} ${t.id}`).toBe(scene[`round.targets.${t.id}.word.gloss`]);
      for (const t of round.others) expect(cell[`hiddenHeritage.rounds.hh1.others.${t.id}.word.gloss`], `${locale} ${t.id}`).toBe(scene[`round.others.${t.id}.word.gloss`]);
    }
  });
});

describe('the card back of the step (OD-10)', () => {
  it.each(['en', 'es', 'ko'] as const)('%s: after the last find, the card back shows every fact of the scene with its source line', async (locale) => {
    gameSwitch(true);
    const r = await draw(locale);
    expect(byTestId(r.root, 'hh-scene').length).toBeGreaterThan(0);
    // Not before the end panel.
    expect(byTestId(r.root, 'hh-card-back')).toEqual([]);
    await playToEnd(r);
    const [back] = byTestId(r.root, 'hh-card-back');
    expect(back, 'the card back').toBeDefined();
    const m = getMessages(locale);
    expect([back!.props.role, back!.props['aria-label']]).toEqual(['region', m.learner.cultureTip.region]);
    expect(textOf(byTestId(back!, 'hh-card-back-title')[0]!)).toBe(m.learner.cultureTip.title);
    const facts = SCENE.note.facts;
    expect(facts.map((f) => f.id)).toEqual(['f1', 'f2', 'f3', 'f4', 'f5', 'f6']);
    for (const fact of facts) {
      const shown = byTestId(back!, `hh-fact-${fact.id}-text`)[0];
      expect(shown, fact.id).toBeDefined();
      const expected = locale === 'en' ? fact.claimEn : OVERLAYS[locale][SCENE.id]![`note.facts.${fact.id}.claim`]!;
      expect(textOf(shown!), `${locale} ${fact.id}`).toBe(expected);
      const source = flat(textOf(byTestId(back!, `hh-fact-${fact.id}-source`)[0]!));
      const first = fact.sources[0]!;
      const line = m.learner.cardDetail.citation.source(first.institution, first.title);
      const more = fact.sources.length > 1 ? ` ${m.learner.cardDetail.citation.more(fact.sources.length - 1)}` : '';
      expect(source, `${locale} ${fact.id}`).toBe(flat(line + more));
    }
    // Never a web address, a quote or a review record on the learner surface.
    expect(textOf(back!)).not.toMatch(/https?:|heritage\.go\.kr|folkency|Pass \d/);
    // The Korean of a source title is marked as Korean for a screen reader.
    expect(hostNodes(back!, (n) => n.props.lang === 'ko').length).toBeGreaterThan(0);
    // Every asked word was found on its first tap, and nothing is complete before Continue.
    expect(log.every(([, correct]) => correct)).toBe(true);
    expect(completed).toBe(0);
  }, 20_000);
});

describe('with game.hidden-heritage off (the launch state)', () => {
  it('plays Pic-Word Match on the same targets with their own pictures, and shows no card back', async () => {
    gameSwitch(false);
    const r = await draw('en');
    expect(byTestId(r.root, 'hh-scene')).toEqual([]);
    expect(byTestId(r.root, 'hh-card-back')).toEqual([]);
    for (const t of SHIPPED.hiddenHeritage!.rounds[0]!.targets) expect(byTestId(r.root, `pic-word-picture-${t.id}`).length, t.id).toBeGreaterThan(0);
  });
});
