import { describe, expect, it, vi } from 'vitest';
import { episodeAccessExits } from '../../screens/episode/access-exits';

/** The preview card's two exits (F-ENT-003 section 3.7), with a recording navigator. */
function setup() {
  const navigate = vi.fn();
  const openEpisode = vi.fn();
  return { navigate, openEpisode, exits: episodeAccessExits({ navigate } as never, openEpisode) };
}

describe('episodeAccessExits', () => {
  it('the ask opens the Plan screen directly or through the PIN screen, keeping its surface', () => {
    const { navigate, exits } = setup();
    exits.onAsk({ route: 'Paywall', params: { from: 'episode' } });
    exits.onAsk({ route: 'PinEntry', params: { next: 'Paywall', from: 'episode' } });
    expect(navigate.mock.calls).toEqual([
      ['Paywall', { from: 'episode' }],
      ['PinEntry', { next: 'Paywall', from: 'episode' }],
    ]);
  });

  it('Back to open lessons: the next lesson page through the host, a topic, the Library or the Journey', () => {
    const { navigate, openEpisode, exits } = setup();
    exits.onBackToOpenLessons({ kind: 'episode', episodeId: 'episode:stage1-life' });
    exits.onBackToOpenLessons({ kind: 'topic', topicKey: 'food' });
    exits.onBackToOpenLessons({ kind: 'library' });
    exits.onBackToOpenLessons({ kind: 'journey' });
    expect(openEpisode).toHaveBeenCalledWith('episode:stage1-life');
    expect(navigate.mock.calls).toEqual([
      ['VocabTopic', { topicKey: 'food' }],
      ['Main', { screen: 'Library' }],
      ['Main', { screen: 'Journey' }],
    ]);
  });
});
