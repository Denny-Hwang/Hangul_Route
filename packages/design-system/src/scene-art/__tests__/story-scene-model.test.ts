import { describe, expect, it } from 'vitest';
import { DEFAULT_FALLBACK_THEME, DEFAULT_SCENE_WIDTH, FALLBACK_TINT_OPACITY, storySceneModel } from '../story-scene-model';
import { OPACITY_STEPS } from '../types';
import { hoyaItem } from '../hoya';
import { makeArt, makeRegistry } from './fixtures';

const registry = makeRegistry([hoyaItem('reading')]);
const art = makeArt({ layers: [{ ref: 'hoya:reading', x: 200, y: 250 }], altEn: 'Hoya reads a book in the hall.' });

describe('storySceneModel', () => {
  it('is 4:3 and defaults to 320 wide', () => {
    const m = storySceneModel({ art }, registry);
    expect(m).toMatchObject({ width: DEFAULT_SCENE_WIDTH, height: 240, theme: DEFAULT_FALLBACK_THEME, decorative: false });
    expect(storySceneModel({ art, width: 480 }, registry).height).toBe(360);
    expect(storySceneModel({ art, width: 96 }, registry).height).toBe(72);
  });

  it.each([0, -10, Number.NaN, Number.POSITIVE_INFINITY, undefined])('falls back to the default width for %s', (width) => {
    expect(storySceneModel({ art, width: width as number }, registry).width).toBe(DEFAULT_SCENE_WIDTH);
  });

  it('draws the picture and names it with altEn', () => {
    const m = storySceneModel({ art }, registry);
    expect(m.scene?.items.length).toBeGreaterThan(0);
    expect(m.issues).toEqual([]);
    expect(m.label).toBe('Hoya reads a book in the hall.');
  });

  it('lets the caller override the name', () => {
    expect(storySceneModel({ art, accessibilityLabel: 'Scene 3 of 8' }, registry).label).toBe('Scene 3 of 8');
  });

  it('hides decorative pictures from assistive technology', () => {
    const m = storySceneModel({ art, decorative: true, accessibilityLabel: 'x' }, registry);
    expect(m).toMatchObject({ decorative: true, label: undefined });
    expect(m.scene).not.toBeNull();
  });

  it('thumb variant draws fewer shapes than the full picture', () => {
    const full = storySceneModel({ art }, registry).scene!.items.length;
    const thumb = storySceneModel({ art, variant: 'thumb' }, registry).scene!.items.length;
    expect(thumb).toBeLessThan(full);
  });

  it.each([undefined, null])('shows the fallback when there is no art (%s)', (missing) => {
    const m = storySceneModel({ art: missing, theme: 'rites' }, registry);
    expect(m).toMatchObject({ scene: null, issues: [], theme: 'rites', label: undefined });
  });

  it('names a fallback panel only when the caller gives a name', () => {
    expect(storySceneModel({ art: undefined, accessibilityLabel: 'Story cover' }, registry).label).toBe('Story cover');
  });

  it('shows the fallback when the background set is unknown, and says why', () => {
    const m = storySceneModel({ art: makeArt({ setting: 'scene:nowhere' }) }, registry);
    expect(m.scene).toBeNull();
    expect(m.issues).toEqual([{ kind: 'unresolved-setting', ref: 'scene:nowhere', layerIndex: -1 }]);
  });

  it('skips an unknown layer and draws the rest', () => {
    const m = storySceneModel({ art: makeArt({ layers: [{ ref: 'prop:nope', x: 1, y: 1 }, { ref: 'hoya:reading', x: 200, y: 250 }] }) }, registry);
    expect(m.scene).not.toBeNull();
    expect(m.issues).toEqual([{ kind: 'unresolved-ref', ref: 'prop:nope', layerIndex: 0 }]);
  });

  it('never throws on malformed data: the fallback panel instead', () => {
    const broken = { setting: 'scene:hall', altEn: 'x' } as unknown as Parameters<typeof storySceneModel>[0]['art'];
    const m = storySceneModel({ art: broken }, registry);
    expect(m.scene).toBeNull();
    expect(m.label).toBe('x');
  });

  it('tints the fallback at an art opacity step', () => {
    expect(FALLBACK_TINT_OPACITY).toBe(0.15);
    expect(OPACITY_STEPS).toContain(FALLBACK_TINT_OPACITY);
  });
});
