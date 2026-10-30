import { getMessages } from '@hangul-route/i18n';
import type { ReactElement } from 'react';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it } from 'vitest';
import type { BuildName } from '../../../logic/lecture/build-steps';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { byTestId, render, textOf } from '../../../test-support/render';
import { PresenterViewProvider } from '../presenter-context';
import { HiddenHeritageSlide } from '../slides/HiddenHeritageSlide';

/**
 * The Hidden Heritage slide on the stage (F-CURR-002 §8 and §12.2, row CM-36; design/wireframes/minigame/hidden-heritage.md
 * D): the target's own picture stands in while `game.hidden-heritage` is off or the scene is not in; with the switch on
 * the scene draws, and the builds show the romanization (its own build in tap mode), the meaning, then the found ring.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const en = getMessages('en');

function slideWith(builds: BuildName[], sceneId = 'scene:food-market'): Extract<Slide, { kind: 'hidden-heritage' }> {
  return {
    kind: 'hidden-heritage',
    key: 'quest:hunt/s2/hh1/bap',
    builds,
    sceneId,
    alt: 'A food stall on a market day.',
    word: { ko: '밥', romanization: 'bap', gloss: 'rice', spoken: { text: '밥', romanization: 'bap' } },
    spot: { x: 12, y: 168, w: 86, h: 90 },
    picture: 'card:rice',
  };
}

function inView(child: ReactElement): ReactElement {
  return <PresenterViewProvider value={{ messages: en, locale: 'en', unit: 1, reducedMotion: true }}>{child}</PresenterViewProvider>;
}

function stageSwitch(on: boolean): void {
  useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { 'game.hidden-heritage': { on, pct: on ? 100 : 0 } } } });
}

/** The stand-in picture (its art may draw no host node with the id in the Node render lane). */
const pictures = (r: ReactTestRenderer) => r.root.findAll((n) => typeof n.type !== 'string' && n.props.testID === 'presenter-hh-picture');

/** Lets the scene's and the game chunk's `import()` settle. */
async function settle(r: ReactTestRenderer): Promise<void> {
  for (let i = 0; i < 100 && byTestId(r.root, 'presenter-hh-scene').length === 0; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
}

/** Whether a host node, or a host above it, is hidden from assistive tech (a build not reached yet). */
function hiddenNow(node: { props: Record<string, unknown>; parent: unknown }): boolean {
  let at: { props: Record<string, unknown>; parent: unknown } | null = node;
  while (at) {
    if (at.props['aria-hidden'] === true) return true;
    at = (at.parent as typeof at) ?? null;
  }
  return false;
}

afterEach(() => {
  resetRemoteConfigForTests();
});

describe('HiddenHeritageSlide (row CM-36)', () => {
  it('the switch off (the launch state): the target picture stands in, no scene and no ring, with the kind label and the word', async () => {
    stageSwitch(false);
    const r = await render(inView(<HiddenHeritageSlide slide={slideWith(['ko', 'gloss', 'answer'])} reveal={2} />));
    expect(pictures(r).length).toBeGreaterThan(0);
    expect(byTestId(r.root, 'presenter-hh-scene')).toHaveLength(0);
    expect(byTestId(r.root, 'presenter-hh-ring')).toHaveLength(0);
    expect(textOf(byTestId(r.root, 'presenter-kind-label')[0]!)).toBe(en.learner.presenter.grid.kind.hiddenHeritage);
    expect(textOf(byTestId(r.root, 'presenter-hh-ko')[0]!)).toBe('밥');
  });

  it('the switch on but a scene this build does not have: the picture stands in', async () => {
    stageSwitch(true);
    const r = await render(inView(<HiddenHeritageSlide slide={slideWith(['ko', 'gloss', 'answer'], 'scene:not-here')} reveal={2} />));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(pictures(r).length).toBeGreaterThan(0);
    expect(byTestId(r.root, 'presenter-hh-scene')).toHaveLength(0);
  });

  it('the switch on: the scene draws as one image named by its alt text, and the found ring shows only at the answer build', async () => {
    stageSwitch(true);
    const slide = slideWith(['ko', 'gloss', 'answer']);
    const r = await render(inView(<HiddenHeritageSlide slide={slide} reveal={0} />));
    await settle(r);
    const scene = byTestId(r.root, 'presenter-hh-scene')[0]!;
    expect(scene.props['aria-label']).toBe('A food stall on a market day.');
    expect(pictures(r)).toHaveLength(0);
    expect(byTestId(r.root, 'presenter-hh-ring')).toHaveLength(0);
    await act(async () => {
      r.update(inView(<HiddenHeritageSlide slide={slide} reveal={1} />));
    });
    expect(byTestId(r.root, 'presenter-hh-ring')).toHaveLength(0);
    await act(async () => {
      r.update(inView(<HiddenHeritageSlide slide={slide} reveal={2} />));
    });
    expect(byTestId(r.root, 'presenter-hh-ring').length).toBeGreaterThan(0);
  });

  it('tap mode: the romanization waits for its own build, the meaning for the gloss build', async () => {
    stageSwitch(false);
    const slide = slideWith(['ko', 'rom', 'gloss', 'answer']);
    const at = async (reveal: number) => {
      const r = await render(inView(<HiddenHeritageSlide slide={slide} reveal={reveal} />));
      return { rom: hiddenNow(byTestId(r.root, 'presenter-hh-rom')[0]!), gloss: hiddenNow(byTestId(r.root, 'presenter-hh-gloss')[0]!) };
    };
    expect(await at(0)).toEqual({ rom: true, gloss: true });
    expect(await at(1)).toEqual({ rom: false, gloss: true });
    expect(await at(2)).toEqual({ rom: false, gloss: false });
  });

  it('always mode: the romanization shows with the word; the meaning still waits for its build', async () => {
    stageSwitch(false);
    const slide = slideWith(['ko', 'gloss', 'answer']);
    const r = await render(inView(<HiddenHeritageSlide slide={slide} reveal={0} />));
    expect(hiddenNow(byTestId(r.root, 'presenter-hh-rom')[0]!)).toBe(false);
    expect(hiddenNow(byTestId(r.root, 'presenter-hh-gloss')[0]!)).toBe(true);
  });
});
