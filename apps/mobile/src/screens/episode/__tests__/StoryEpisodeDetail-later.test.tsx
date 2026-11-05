import { getMessages } from '@hangul-route/i18n';
import { afterEach, describe, expect, it } from 'vitest';
import { episodesAll } from '../../../content/episodes';
import { storyEpisodeEntries } from '../../../logic/story/story-episode';
import { defaultStoryIndex } from '../../../logic/story/story-index';
import { byTestId, cleanup, render, textOf } from '../../../test-support/render';
import { StoryEpisodeDetail } from '../StoryEpisodeDetail';

/**
 * F-CURR-002 row CM-5B: a book 2 page offline. A tale that is neither loaded nor saved on this device shows "Needs the
 * internet" (the lesson page's words and dotted pip) in place of its Read and Play buttons, so a tap never opens a
 * reader that cannot load; a tale on the device keeps its buttons. No book 2 ships yet, so a shipped story page stands in.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const m = getMessages('en').learner.episode.later;
const noop = (): void => undefined;
const found = episodesAll
  .map((episode) => ({ episode, entries: storyEpisodeEntries(episode, defaultStoryIndex()) }))
  .find((e) => e.entries !== null && e.entries.length >= 1);

afterEach(async () => {
  await cleanup();
});

describe('StoryEpisodeDetail: a book 2 tale that needs the internet (row CM-5B)', () => {
  const page = (taleNeedsInternet?: (storyId: string) => boolean) => {
    if (!found?.entries) throw new Error('a story episode ships');
    return render(
      <StoryEpisodeDetail
        episode={found.episode}
        entries={found.entries}
        cellStoryCount={0}
        onOpenStory={noop}
        onOpenCard={noop}
        onOpenSources={noop}
        onOpenCultureNotes={noop}
        onOpenCellStories={noop}
        onOpenCellStoriesRow={noop}
        taleNeedsInternet={taleNeedsInternet}
      />,
    );
  };
  const actionsOf = (root: Parameters<typeof byTestId>[0], storyId: string) =>
    byTestId(root, `story-episode-row-${storyId}`)[0]!.findAll((n) => typeof n.props.testID === 'string' && /^story-episode-(read|play|resume|replay|restart|start|continue)/.test(n.props.testID as string));

  it('words in place of the buttons for a tale not on the device; the other tales keep theirs', async () => {
    const first = found!.entries![0]!.storyId;
    const r = await page((id) => id === first);
    const words = byTestId(r.root, `story-episode-needs-internet-${first}`);
    expect(words.length).toBeGreaterThan(0);
    expect(textOf(words[0]!)).toBe(m.start);
    expect(actionsOf(r.root, first)).toHaveLength(0);
    for (const other of found!.entries!.slice(1)) {
      expect(byTestId(r.root, `story-episode-needs-internet-${other.storyId}`)).toHaveLength(0);
    }
  });

  it('online, or with every tale on the device, every row keeps its buttons', async () => {
    const r = await page(undefined);
    for (const entry of found!.entries!) {
      expect(byTestId(r.root, `story-episode-needs-internet-${entry.storyId}`)).toHaveLength(0);
      expect(actionsOf(r.root, entry.storyId).length).toBeGreaterThan(0);
    }
  });
});
