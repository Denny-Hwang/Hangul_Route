import { describe, expect, it } from 'vitest';
import { episodeReturn } from '../quest-return';

/**
 * F-LAYOUT-001 §3.7: "Back from the quest returns to the same selection." Leaving a quest, or opening
 * the episode from Results, shows the episode where the window shows episodes: the Journey pane on a
 * two-pane window, the episode screen on one pane (as before).
 */
describe('episodeReturn', () => {
  it('is the Journey pane with the episode selected on two panes', () => {
    expect(episodeReturn(2, 'episode:stage1-life')).toEqual({ to: 'journeyPane', episodeId: 'episode:stage1-life' });
  });

  it('is the episode screen on one pane, as before', () => {
    expect(episodeReturn(1, 'episode:stage1-life')).toEqual({ to: 'episodeScreen', episodeId: 'episode:stage1-life' });
  });
});
