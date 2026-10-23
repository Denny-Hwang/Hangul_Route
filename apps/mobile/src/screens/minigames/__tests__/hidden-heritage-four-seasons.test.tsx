import { readFileSync } from 'node:fs';
import { HiddenHeritageRoundSchema, checkRomanization, isOverlayFieldAllowed } from '@hangul-route/content-schema';
import { lintCardSources } from '@hangul-route/content-schema/lint';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { findBannedWord } from '@hangul-route/i18n';
import { FOUR_SEASONS_OVERLAYS, FOUR_SEASONS_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/four-seasons';
import { Pressable, StyleSheet } from 'react-native';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PICTURE_CONTEXT } from '../../../components/PictureArt';
import { questsAll } from '../../../content';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import type { MinigameScope } from '../../../logic/minigame-config';
import { resolvePicture } from '../../../logic/picture-ref';
import { useProfileStore } from '../../../store/profile-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { HiddenHeritageStep } from '../hidden-heritage-entry';
import * as scenes from '../hidden-heritage-scenes';
import type { MinigameHost } from '../host';
import { glossRepeatsRomanization } from '../../../../../../scripts/overlay-rules.mjs';

/**
 * F-CURR-002 row CM-37 part 3: the Nature & Animals four-season scene in the Hidden Heritage step
 * (design/wireframes/minigame/hidden-heritage.md): its lazy chunk, the hit areas at 320 px, the Pic-Word Match fallback
 * with `game.hidden-heritage` off (the launch state), the culture-source lint on its facts, rr.ts romanization and its
 * es and ko meanings (carried in the scene's own chunk).
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const SCENE = FOUR_SEASONS_SCENE;
const ROUND = HiddenHeritageRoundSchema.parse(SCENE.round);
const SCOPE: MinigameScope = { kind: 'hidden-heritage', rounds: ROUND.targets.length, hiddenHeritage: { rounds: [ROUND] } };
const FILE = 'packages/design-system/src/scene-art/hidden-heritage/four-seasons.ts';
const mounted: ReactTestRenderer[] = [];
const log: Array<[string, boolean]> = [];
const host: MinigameHost = { mode: 'quest', answer: (key, correct) => void log.push([String(key), correct]), complete: () => undefined };

function gameSwitch(on: boolean): void {
  useProfileStore.setState({ activeId: 'profile:hh-nature-test' });
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
const text = (root: ReactTestInstance): string => root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string).join(' | ');

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

describe('the four-season scene as content (row CM-37 part 3)', () => {
  it('is a lazy scene chunk the loader knows by its id', async () => {
    expect(await scenes.loadScene('scene:four-seasons')).toBe(SCENE);
    expect(HiddenHeritageRoundSchema.safeParse(SCENE.round).success).toBe(true);
  });

  it('romanizes every thing it names with the F-CNT-002 converter', () => {
    for (const t of [...ROUND.targets, ...ROUND.others]) expect(checkRomanization(t.word.ko, t.word.romanization), t.id).toEqual([]);
  });

  it('gives every target a bundled picture that draws (never the text tile), so the fallback board is all pictures', () => {
    for (const t of ROUND.targets) expect(resolvePicture(t.picture, PICTURE_CONTEXT).kind, t.id).not.toBe('text');
  });

  it('culture-source: every fact cites a §6.6 institution, on its own host, under its name on the access date', () => {
    const cards = SCENE.note.facts.map((f) => ({
      cardId: `${SCENE.id}#${f.id}`,
      sources: f.sources.map((s) => ({ title: s.title, publisher: s.institution, url: s.url, accessed: s.accessed })),
    }));
    expect(lintCardSources(cards, FILE)).toEqual([]);
    const off = [{ cardId: 'scene:x#f1', sources: [{ ...cards[0]!.sources[0]!, url: 'https://example.com/climate' }] }];
    expect(lintCardSources(off, FILE).map((f) => f.rule)).toEqual(['culture-source']);
  });

  it('asks taught words: 바람, 비 and 눈 of quest:stage2-nature-q2 and 까치 of Stage 2 Letters, with the taught meaning and romanization', () => {
    const taught = (id: string) => JSON.stringify(questsAll.find((q) => q.id === id));
    for (const t of ROUND.targets) {
      const quest = t.id === 'kkachi' ? 'quest:stage2-letters-q2' : 'quest:stage2-nature-q2';
      expect(taught(quest), t.word.ko).toContain(`"ko":"${t.word.ko}","romanization":"${t.word.romanization}","en":"${t.word.en}"`);
    }
  });

  it('its es and ko meanings sit under overlay paths a lesson round may carry, and the targets keep their shipped meanings', () => {
    for (const locale of ['es', 'ko'] as const) {
      const table = FOUR_SEASONS_OVERLAYS[locale] as Record<string, string>;
      for (const path of Object.keys(table)) expect(isOverlayFieldAllowed('minigame:s2-nature-v2-q1-practice', path), path).toBe(true);
      const shipped = new Map<string, Set<string>>();
      for (const file of ['lessons-stage2-nature', 'lessons-stage2-letters']) {
        const overlay = JSON.parse(readFileSync(new URL(`../../../../../../content/i18n/${locale}/${file}.json`, import.meta.url), 'utf8')) as { entries: Record<string, Record<string, string>> };
        for (const fields of Object.values(overlay.entries)) {
          for (const [field, value] of Object.entries(fields)) {
            const id = /\.pairs\.([a-z]+)\.word\.gloss$/.exec(field)?.[1];
            if (id) shipped.set(id, (shipped.get(id) ?? new Set()).add(value));
          }
        }
      }
      for (const t of ROUND.targets) expect([...(shipped.get(t.id) ?? [])], `${locale} ${t.id}`).toEqual([table[`hiddenHeritage.rounds.hh1.targets.${t.id}.word.gloss`]]);
      for (const t of [...ROUND.targets, ...ROUND.others]) {
        const value = table[`hiddenHeritage.rounds.hh1.${ROUND.targets.some((x) => x.id === t.id) ? 'targets' : 'others'}.${t.id}.word.gloss`]!;
        expect(findBannedWord(value, locale, 'learner'), `${locale}: ${value}`).toBeNull();
        if (locale === 'es') expect(glossRepeatsRomanization({ ko: t.word.ko, romanization: t.word.romanization, gloss: value }), t.id).toBe(false);
      }
    }
  });
});

describe('with game.hidden-heritage off (its launch state)', () => {
  it('plays Pic-Word Match on 바람, 비, 까치 and 눈 from their own pictures and never draws the scene', async () => {
    gameSwitch(false);
    const root = await draw();
    expect(root.findAll((n) => n.props.testID === 'hh-scene')).toHaveLength(0);
    for (const t of ROUND.targets) expect(root.findAll((n) => n.props.testID === `pic-word-picture-${t.id}`).length, t.id).toBeGreaterThan(0);
  });
});

describe('with game.hidden-heritage on', () => {
  it('asks a Korean Nature word with its romanization, never an English label', async () => {
    gameSwitch(true);
    const root = await draw();
    expect(root.findAll((n) => n.props.testID === 'hh-scene').length).toBeGreaterThan(0);
    const prompt = root.findAll((n) => n.props.testID === 'hh-prompt' && n.props.ko !== undefined)[0]!;
    const asked = ROUND.targets.find((t) => t.word.ko === prompt.props.ko)!;
    expect(asked).toBeDefined();
    expect(prompt.props.romanization).toBe(asked.word.romanization);
    expect(prompt.props.gloss).toBeUndefined();
    const shown = text(root);
    for (const t of ROUND.targets) expect(shown).not.toContain(t.word.en);
  });

  it('hit areas: eight named buttons in reading order, each 54 dp or more at 320 px', async () => {
    gameSwitch(true);
    const root = await draw();
    const all = spots(root);
    expect(all.map((s) => s.props.accessibilityLabel)).toEqual(['wind', 'rain', 'magpie', 'mountain', 'flower', 'tree', 'moon bear', 'snow']);
    for (const s of all) {
      expect(s.props.accessibilityRole).toBe('button');
      const style = StyleSheet.flatten(s.props.style) as { width: number; height: number };
      expect(Math.min(style.width, style.height), s.props.testID).toBeGreaterThanOrEqual(54);
    }
  });

  it('a tap on the moon bear only nudges; the asked word scores on its own spot', async () => {
    gameSwitch(true);
    const root = await draw();
    const ko = root.findAll((n) => n.props.testID === 'hh-prompt' && n.props.ko !== undefined)[0]!.props.ko as string;
    const asked = ROUND.targets.find((t) => t.word.ko === ko)!;
    const spot = (id: string) => spots(root).find((s) => s.props.testID === `hh-spot-${id}`)!;
    await act(async () => spot('bandalgaseumgom').props.onPress());
    expect(log).toEqual([[expect.stringMatching(/^w\d$/), false]]);
    expect(text(root)).toContain('Look again');
    await act(async () => spot(asked.id).props.onPress());
    expect(log[1]).toEqual([log[0]![0], true]);
  });
});
