import { describe, expect, it } from 'vitest';
import type { Slide } from '../deck-builder';
import { STAGE_SCENE_FLAG, stageSceneOn } from '../hidden-heritage-stage';
import { SHELL_SLIDE_KINDS, slideDetail } from '../shell';
import { slideSound } from '../slide-view';
import { gridKindKey, gridItems } from '../tools';

/** F-CURR-002 §8 (row CM-36): the Hidden Heritage slide in the presenter's shell, grid and Sound. */

const slide: Extract<Slide, { kind: 'hidden-heritage' }> = {
  kind: 'hidden-heritage',
  key: 'quest:hunt/s2/hh1/bap',
  builds: ['ko', 'gloss', 'answer'],
  sceneId: 'scene:food-market',
  alt: 'A food stall on a market day.',
  word: { ko: '밥', romanization: 'bap', gloss: 'rice', spoken: { text: '밥', romanization: 'bap' } },
  spot: { x: 12, y: 168, w: 86, h: 90 },
  picture: 'card:rice',
};

describe('the Hidden Heritage slide', () => {
  it('is a kind the presenter draws, labelled "Find it together" in the grid', () => {
    expect(SHELL_SLIDE_KINDS.has('hidden-heritage')).toBe(true);
    expect(gridKindKey('hidden-heritage')).toBe('hiddenHeritage');
  });

  it('says the scene and the word, never the meaning that names the thing', () => {
    expect(slideDetail(slide, undefined, 0)).toBe('A food stall on a market day., 밥, bap');
    expect(slideDetail(slide)).toBe('A food stall on a market day., 밥, bap');
  });

  it('Sound plays the word to find; the grid shows no title that would name the thing', () => {
    expect(slideSound(slide)).toEqual({ spoken: slide.word.spoken, kind: 'word' });
    const [item] = gridItems([slide], { slideIdx: 0, skipped: new Set() }, { activity: () => '' });
    expect(item?.title).toBe('');
  });
});

describe('the projector follows game.hidden-heritage (§12.2)', () => {
  const copy = (on: boolean, pct: number) => ({ v: 1 as const, fetchedAt: 0, maxAgeS: 300, flags: { [STAGE_SCENE_FLAG]: { on, pct } } });

  it('off at the launch state (no remote copy, built-in pct 0): the picture stands in for the scene', () => {
    expect(stageSceneOn(null)).toBe(false);
  });

  it('off while the switch is off or still ramping, since the stage has no profile to bucket', () => {
    expect(stageSceneOn(copy(false, 100))).toBe(false);
    expect(stageSceneOn(copy(true, 0))).toBe(false);
    expect(stageSceneOn(copy(true, 50))).toBe(false);
  });

  it('on once the switch is on for everyone', () => {
    expect(stageSceneOn(copy(true, 100))).toBe(true);
  });
});
