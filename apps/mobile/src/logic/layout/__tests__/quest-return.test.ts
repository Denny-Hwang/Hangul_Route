import { describe, expect, it } from 'vitest';
import { episodeReturn } from '../quest-return';

/**
 * F-LAYOUT-001 §3.7: "Back from the quest returns to the same selection." Leaving a quest, or opening
 * the episode from Results, shows the episode where the window shows episodes: the Journey pane on a
 * two-pane window, the episode screen on one pane (as before). `under` is the screen right under the
 * one leaving: only a quest opened straight from the tabs (or from Results) goes back to the pane, so
 * a quest opened from Homework or a full-screen episode page keeps that screen under it.
 */
describe('episodeReturn', () => {
  it('is the Journey pane with the episode selected on two panes, from the tabs', () => {
    expect(episodeReturn(2, 'episode:stage1-life', 'Main')).toEqual({ to: 'journeyPane', episodeId: 'episode:stage1-life' });
  });

  it('is the Journey pane on two panes from Results (Next up), which is dropped like the quest', () => {
    expect(episodeReturn(2, 'episode:stage1-life', 'Results')).toEqual({ to: 'journeyPane', episodeId: 'episode:stage1-life' });
  });

  it('is the episode screen on two panes when another screen (Homework, an episode page) is under it', () => {
    expect(episodeReturn(2, 'episode:stage1-life', 'Homework')).toEqual({ to: 'episodeScreen', episodeId: 'episode:stage1-life' });
    expect(episodeReturn(2, 'episode:stage1-life', 'EpisodeDetail')).toEqual({ to: 'episodeScreen', episodeId: 'episode:stage1-life' });
    expect(episodeReturn(2, 'episode:stage1-life', undefined)).toEqual({ to: 'episodeScreen', episodeId: 'episode:stage1-life' });
  });

  it('is the episode screen on one pane, as before', () => {
    expect(episodeReturn(1, 'episode:stage1-life', 'Main')).toEqual({ to: 'episodeScreen', episodeId: 'episode:stage1-life' });
  });
});
