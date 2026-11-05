import type { Episode } from '@hangul-route/content-schema';
import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lessonContent } from '../../../content/lessons';
import { storyContent } from '../../../content/stories';
import { offlinePacks } from '../../../store/offline-packs-store';
import { cleanup, render, screenTexts } from '../../../test-support/render';
import { useLaterNeedsInternet } from '../use-later-offline';

/**
 * F-CURR-002 row CM-5B: a later volume's page says it needs the internet the first time only while the device is
 * offline and the volume's body is neither loaded nor saved. The render lane runs the native cache stub, so the
 * store's answer and the stores' readiness are set here.
 */
const online = { value: false };
vi.mock('../../../components/use-online', () => ({ useOnline: () => online.value }));

type Ep = Pick<Episode, 'id' | 'volume' | 'format' | 'storyIds'>;
function Probe({ episode }: { episode: Ep | undefined }): ReactElement {
  return <Text>{useLaterNeedsInternet(episode) ? 'needs' : 'opens'}</Text>;
}
const answer = async (episode: Ep | undefined): Promise<string | undefined> => {
  const r = await render(<Probe episode={episode} />);
  const text = screenTexts(r.root)[0];
  await cleanup();
  return text;
};

const V2: Ep = { id: 'episode:stage2-nature-v2', volume: 2, format: 'lesson' };
const BOOK2: Ep = { id: 'episode:stage5-nature-v2', volume: 2, format: 'story', storyIds: ['story:jeju-volcanic-island'] };
const saved = new Set<string>();

beforeEach(() => {
  online.value = false;
  saved.clear();
  offlinePacks.setState({ init: async () => undefined, opensOffline: (name: string) => saved.has(name) });
  vi.spyOn(lessonContent, 'isCellReady').mockReturnValue(false);
  vi.spyOn(storyContent, 'isStoryReady').mockReturnValue(false);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await cleanup();
});

describe('useLaterNeedsInternet (row CM-5B)', () => {
  it('offline, a Volume 2 neither loaded nor saved needs the internet; a first volume never does', async () => {
    expect(await answer(V2)).toBe('needs');
    expect(await answer({ ...V2, id: 'episode:stage2-nature', volume: 1 })).toBe('opens');
    expect(await answer(undefined)).toBe('opens');
  });

  it('online, every volume opens', async () => {
    online.value = true;
    expect(await answer(V2)).toBe('opens');
  });

  it('saved for offline, or loaded in this session, it opens', async () => {
    saved.add('lessons-cell-stage2-nature-v2');
    expect(await answer(V2)).toBe('opens');
    saved.clear();
    vi.mocked(lessonContent.isCellReady).mockReturnValue(true);
    expect(await answer(V2)).toBe('opens');
  });

  it('a book 2 reads its tales: a tale a book 2 alone holds must be loaded or saved; any other tale is precached', async () => {
    const { LATER_STORY_IDS } = await import('../../../content/later-content');
    const later = BOOK2.storyIds?.every((id) => LATER_STORY_IDS.has(id)) === true;
    expect(await answer(BOOK2)).toBe(later ? 'needs' : 'opens');
    saved.add('story-jeju-volcanic-island');
    expect(await answer(BOOK2)).toBe('opens');
  });
});
