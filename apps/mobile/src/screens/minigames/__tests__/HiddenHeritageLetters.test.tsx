import { readdirSync, readFileSync } from 'node:fs';
import { HiddenHeritageRoundSchema, romanizeWord, translatableFields } from '@hangul-route/content-schema';
import { lintCardSources } from '@hangul-route/content-schema/lint';
import { OVERLAYS } from '@hangul-route/content-schema/overlays';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { LETTERS_SCHOOL_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/letters-school';
import { Pressable, StyleSheet } from 'react-native';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PICTURE_CONTEXT } from '../../../components/PictureArt';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import type { MinigameScope } from '../../../logic/minigame-config';
import { resolvePicture } from '../../../logic/picture-ref';
import { useProfileStore } from '../../../store/profile-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { HiddenHeritageStep } from '../hidden-heritage-entry';
import * as scenes from '../hidden-heritage-scenes';
import type { MinigameHost } from '../host';

/**
 * F-CURR-002 row CM-37 part 1: the Letters Hidden Heritage scene, a school room of earlier times (seodang), in its own
 * lazy chunk. Its targets are Stage 2 Letters words; while `game.hidden-heritage` is off the step plays Pic-Word Match
 * on the same targets from their bundled pictures.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const SCENE = LETTERS_SCHOOL_SCENE;
const ROUND = HiddenHeritageRoundSchema.parse(SCENE.round);
const SCOPE: MinigameScope = { kind: 'hidden-heritage', rounds: ROUND.targets.length, hiddenHeritage: { rounds: [ROUND] } };
const THINGS = [...ROUND.targets, ...ROUND.others];
const mounted: ReactTestRenderer[] = [];
const host: MinigameHost = { mode: 'quest', answer: () => undefined, complete: () => undefined };

function gameSwitch(on: boolean): void {
  useProfileStore.setState({ activeId: 'profile:hh-test' });
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

/** Every `{ ko, romanization, en }` taught in a Letters cell file (content/episodes/stage-<n>/letters.json). */
function lettersWords(): Array<{ ko: string; romanization: string; en: string }> {
  const out: Array<{ ko: string; romanization: string; en: string }> = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node === null || typeof node !== 'object') return;
    const rec = node as Record<string, unknown>;
    if (typeof rec.ko === 'string' && typeof rec.romanization === 'string' && typeof rec.en === 'string') out.push({ ko: rec.ko, romanization: rec.romanization, en: rec.en });
    Object.values(rec).forEach(walk);
  };
  for (const stage of [2, 3, 4, 6, 7]) walk(JSON.parse(readFileSync(new URL(`../../../../../../content/episodes/stage-${stage}/letters.json`, import.meta.url), 'utf8')));
  return out;
}

/** Every entry of the reviewed overlay files of a locale (content/i18n/<locale>/*.json), lesson overlays included. */
/** Only the Stage 2 lesson cells and the minigame rounds teach these words in a word pair with a reviewed gloss. */
const REVIEWED_GLOSS_FILE = /^(lessons-stage2-[a-z]+|minigames)\.json$/;

function reviewedOverlays(locale: 'es' | 'ko'): Record<string, Record<string, string>> {
  const dir = new URL(`../../../../../../content/i18n/${locale}/`, import.meta.url);
  const out: Record<string, Record<string, string>> = {};
  for (const name of readdirSync(dir).filter((n) => REVIEWED_GLOSS_FILE.test(n))) {
    const file = JSON.parse(readFileSync(new URL(name, dir), 'utf8')) as { entries?: Record<string, Record<string, string>> };
    for (const [id, fields] of Object.entries(file.entries ?? {})) out[id] = { ...out[id], ...fields };
  }
  return out;
}

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

describe('the Letters school room scene (row CM-37 part 1)', () => {
  it('loads from its own lazy chunk by its scene id', async () => {
    await expect(scenes.loadScene('scene:letters-school')).resolves.toBe(SCENE);
  });

  it('every thing is a taught Letters word, its romanization the F-CNT-002 converter output (rr.ts)', () => {
    const taught = lettersWords();
    for (const thing of THINGS) {
      expect(thing.word.romanization, thing.id).toBe(romanizeWord(thing.word.ko));
      expect(taught.some((w) => w.ko === thing.word.ko && w.romanization === thing.word.romanization && w.en === thing.word.en), thing.word.ko).toBe(true);
    }
  });

  it('every target names a bundled picture the fallback draws (never the text tile)', () => {
    for (const t of ROUND.targets) expect(resolvePicture(t.picture, PICTURE_CONTEXT).kind, t.picture).not.toBe('text');
  });

  it('culture-source: every fact cites a §6.6 institution, on its own host, under its name on the access date', () => {
    const cards = SCENE.note.facts.map((f) => ({
      cardId: `${SCENE.id}#${f.id}`,
      sources: f.sources.map((s) => ({ title: s.title, publisher: s.institution, url: s.url, accessed: s.accessed })),
    }));
    expect(lintCardSources(cards, 'packages/design-system/src/scene-art/hidden-heritage/letters-school.ts')).toEqual([]);
  });

  it('every English string of the scene that a learner reads has an es and a ko overlay (F-I18N-001 §3.10)', () => {
    const fields = translatableFields(SCENE.id, SCENE).map((f) => f.field);
    expect(fields.length).toBeGreaterThanOrEqual(10);
    for (const locale of ['es', 'ko'] as const) {
      const entry = OVERLAYS[locale][SCENE.id] ?? {};
      for (const field of fields) expect(entry[field], `${locale} ${field}`).toEqual(expect.stringMatching(/\S/));
      for (const value of Object.values(entry)) expect(value).not.toMatch(/%|\b(wrong|fail\w*|lost)\b/i);
    }
    for (const value of Object.values(OVERLAYS.es[SCENE.id] ?? {})) expect(value).not.toMatch(/[가-힣]/);
  });

  it('each spot meaning in es and ko is the gloss its word already has in a reviewed Stage 2 lesson or minigame word pair', () => {
    for (const locale of ['es', 'ko'] as const) {
      const entry = OVERLAYS[locale][SCENE.id] ?? {};
      for (const [group, list] of [['targets', ROUND.targets], ['others', ROUND.others]] as const) {
        for (const thing of list) {
          const reviewed = new Set<string>();
          for (const [id, fields] of Object.entries(reviewedOverlays(locale))) {
            if (id.startsWith('scene:') || id.startsWith('pitem:')) continue;
            // A word pair, a card pair or a word bank entry keyed by the word's own romanization, never a sentence or an option.
            const own = new RegExp(`(^|\\.)(pairs\\.${thing.id}\\.word|cardPairs\\.${thing.id}|bank\\.${thing.id})\\.gloss$`);
            for (const [field, value] of Object.entries(fields)) if (own.test(field)) reviewed.add(value);
          }
          expect([...reviewed], `${locale} ${thing.id}`).toContain(entry[`round.${group}.${thing.id}.word.gloss`]);
        }
      }
    }
  });
});

describe('the Letters scene in the game', () => {
  it('with game.hidden-heritage off (the launch state): Pic-Word Match on 책, 붓 and 나무 from their own pictures', async () => {
    gameSwitch(false);
    const root = await draw();
    expect(root.findAll((n) => n.props.testID === 'hh-scene')).toHaveLength(0);
    for (const t of ROUND.targets) expect(root.findAll((n) => n.props.testID === `pic-word-picture-${t.id}`).length, t.id).toBeGreaterThan(0);
  });

  it('on: asks a Korean word with its romanization over spots named by meaning, in reading order', async () => {
    gameSwitch(true);
    const root = await draw();
    expect(root.findAll((n) => n.props.testID === 'hh-scene').length).toBeGreaterThan(0);
    const prompt = root.findAll((n) => n.props.testID === 'hh-prompt' && n.props.ko !== undefined)[0]!;
    const asked = ROUND.targets.find((t) => t.word.ko === prompt.props.ko)!;
    expect(prompt.props.romanization).toBe(asked.word.romanization);
    expect(prompt.props.gloss).toBeUndefined();
    expect(spots(root).map((s) => s.props.accessibilityLabel)).toEqual(['mountain', 'bird', 'book', 'brush', 'tree', 'flower']);
  });

  it('hit areas: every spot is a named button of 54 dp or more at 320 px, and 64 dp or more at 375 px', async () => {
    gameSwitch(true);
    for (const [width, content, min] of [
      [320, 288, 54],
      [375, 343, 64],
    ] as const) {
      const root = await draw(width, content);
      const all = spots(root);
      expect(all).toHaveLength(THINGS.length);
      for (const s of all) {
        expect(s.props.accessibilityRole).toBe('button');
        expect(String(s.props.accessibilityLabel).length).toBeGreaterThan(0);
        const style = StyleSheet.flatten(s.props.style) as { width: number; height: number };
        expect(Math.min(style.width, style.height), `${width} ${s.props.testID}`).toBeGreaterThanOrEqual(min);
      }
    }
  });
});
