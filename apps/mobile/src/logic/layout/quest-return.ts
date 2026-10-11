/**
 * Where an episode is shown when the learner comes back to it from a quest (Leave quest) or from
 * Results ("Episode page"), F-LAYOUT-001 §3.7: on a two-pane window the Journey keeps the episode
 * in its right pane (selected in the grid), so the learner returns to the pane instead of a
 * full-screen episode page; on one pane the episode screen opens, exactly as before.
 *
 * `under` is the name of the stack route right under the leaving screen. Going to the pane pops
 * everything above the tabs, so it is chosen only when nothing worth keeping is under it: the tabs
 * themselves (`Main`) or Results (a finished run, its Next-up quest). A quest opened from another
 * screen (Homework, a full-screen episode page) leaves to the episode screen, as before, so Back
 * still returns to that screen.
 */
export type EpisodeReturn = { to: 'journeyPane'; episodeId: string } | { to: 'episodeScreen'; episodeId: string };

const POPPABLE_UNDER: ReadonlySet<string> = new Set(['Main', 'Results']);

export function episodeReturn(panes: 1 | 2, episodeId: string, under: string | undefined): EpisodeReturn {
  return panes === 2 && under !== undefined && POPPABLE_UNDER.has(under)
    ? { to: 'journeyPane', episodeId }
    : { to: 'episodeScreen', episodeId };
}
