/**
 * Where an episode is shown when the learner comes back to it from a quest (Leave quest) or from
 * Results ("Episode page"), F-LAYOUT-001 §3.7: on a two-pane window the Journey keeps the episode
 * in its right pane (selected in the grid), so the learner returns to the pane instead of a
 * full-screen episode page; on one pane the episode screen opens, exactly as before.
 */
export type EpisodeReturn = { to: 'journeyPane'; episodeId: string } | { to: 'episodeScreen'; episodeId: string };

export function episodeReturn(panes: 1 | 2, episodeId: string): EpisodeReturn {
  return panes === 2 ? { to: 'journeyPane', episodeId } : { to: 'episodeScreen', episodeId };
}
