import { formatNumber, getMessages, type UiLocale } from '@hangul-route/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LATER_CACHE, parseOfflinePacks, type OfflinePacksIndex } from '../../../logic/offline/offline-packs';
import { offlinePacks, type OfflinePacksState } from '../../../store/offline-packs-store';
import { useLocaleStore } from '../../../store/locale-store';
import { buttonsNamed, byTestId, cleanup, press, render, screenTexts } from '../../../test-support/render';
import { OfflineLessonsCard } from '../OfflineLessonsCard';

/**
 * F-CURR-002 row CM-5B (wireframe pwa/save-for-offline, mock app-shell/save-for-offline): the Offline lessons card of
 * the Grown-up area, rendered through react-native-web, with the store's state set directly (the render lane runs the
 * native stub of the cache, where there is nothing to save).
 */

const online = { value: true };
vi.mock('../../../components/use-online', () => ({ useOnline: () => online.value }));

const md = (c: string): string => c.repeat(32);
const INDEX = parseOfflinePacks({
  version: 1,
  stages: [
    { stage: 'stage2', bytes: 0, files: [{ url: `/_expo/static/js/web/lessons-cell-stage2-nature-v2-${md('a')}.js`, bytes: 412_000, cache: LATER_CACHE }] },
    {
      stage: 'stage5',
      bytes: 0,
      files: [
        { url: `/_expo/static/js/web/story-jeju-volcanic-island-${md('b')}.js`, bytes: 45_000, cache: LATER_CACHE },
        { url: `/_expo/static/js/web/story-hanji-korean-paper-${md('c')}.js`, bytes: 50_000, cache: LATER_CACHE },
      ],
    },
  ],
}) as OfflinePacksIndex;
const TALE = INDEX.stages[1]?.files[0]?.url as string;

const save = vi.fn(async () => undefined);
const remove = vi.fn(async () => undefined);
const base: Partial<OfflinePacksState> & Record<string, unknown> = {
  status: 'ready',
  index: INDEX,
  cached: new Set<string>(),
  available: new Set<string>(),
  chosen: [],
  busy: null,
  progress: null,
  problem: null,
  space: { quota: 2_000_000_000, usage: 1_049_800_000 },
  init: async () => undefined,
  save,
  remove,
};

beforeEach(() => {
  online.value = true;
  save.mockClear();
  remove.mockClear();
  offlinePacks.setState(base);
});

afterEach(async () => {
  await cleanup();
  useLocaleStore.setState({ device: 'en', byProfile: {} });
});

describe('Offline lessons card (row CM-5B)', () => {
  it('draws nothing when saving is not possible (native, no worker in control) or the build has no later volume', async () => {
    offlinePacks.setState({ status: 'unsupported' });
    expect(byTestId((await render(<OfflineLessonsCard />)).root, 'dashboard-offline')).toHaveLength(0);
    await cleanup();
    offlinePacks.setState({ status: 'ready', index: { version: 1, stages: [] } });
    expect(byTestId((await render(<OfflineLessonsCard />)).root, 'dashboard-offline')).toHaveLength(0);
  });

  it('one row per stage with its size and state, Save per row and Save all, and the space left', async () => {
    const m = getMessages('en').caregiver.dashboard.offline;
    const { root } = await render(<OfflineLessonsCard />);
    const texts = screenTexts(root);
    expect(texts).toEqual(expect.arrayContaining([m.title, m.line, m.opened, 'Stage 2: Words', 'Stage 5: Stories', 'About 0.4 MB · Not saved yet', 'About 0.1 MB · Not saved yet']));
    expect(texts).toContain('Space left for this app: about 950.2 MB');
    expect(buttonsNamed(root, 'Save: Stage 2: Words')).toHaveLength(1);
    expect(byTestId(root, 'dashboard-offline-stage2-remove')).toHaveLength(0);
    await press(buttonsNamed(root, 'Save all')[0]!);
    expect(save).toHaveBeenCalledWith('all');
    await press(buttonsNamed(root, 'Save: Stage 5: Stories')[0]!);
    expect(save).toHaveBeenCalledWith('stage5');
  });

  it('a saved stage offers Remove; a partly saved one both; Save all hides with one stage left', async () => {
    offlinePacks.setState({ cached: new Set(INDEX.stages[0]?.files.map((f) => f.url)).add(TALE), chosen: ['stage2'] });
    const { root } = await render(<OfflineLessonsCard />);
    expect(screenTexts(root)).toEqual(expect.arrayContaining(['About 0.4 MB · Saved on this device', 'About 0.1 MB · Partly saved']));
    expect(buttonsNamed(root, 'Save: Stage 2: Words')).toHaveLength(0);
    expect(buttonsNamed(root, 'Save all')).toHaveLength(0);
    await press(buttonsNamed(root, 'Remove: Stage 2: Words')[0]!);
    expect(remove).toHaveBeenCalledWith('stage2');
    expect(buttonsNamed(root, 'Remove: Stage 5: Stories')).toHaveLength(1);
  });

  it('offline: a calm line, and saving waits for the internet', async () => {
    online.value = false;
    const { root } = await render(<OfflineLessonsCard />);
    expect(screenTexts(root)).toContain('You are offline. Saving needs the internet.');
    await press(buttonsNamed(root, 'Save all')[0]!);
    expect(save).not.toHaveBeenCalled();
  });

  it('shows the progress of a save and why one stopped, in plain words', async () => {
    offlinePacks.setState({ busy: 'stage2', progress: { done: 206_000, total: 412_000 } });
    const { root } = await render(<OfflineLessonsCard />);
    expect(screenTexts(root)).toContain('Saving: 0.2 of 0.4 MB');
    await cleanup();
    for (const [reason, line] of [
      ['network', 'Could not save. Check the internet, then try again.'],
      ['space', 'Not enough space on this device. Remove something, then try again.'],
      ['notFile', 'The app has an update. Reload the page, then try again.'],
    ] as const) {
      offlinePacks.setState({ busy: null, progress: null, problem: { stage: 'stage2', reason } });
      const r = await render(<OfflineLessonsCard />);
      expect(screenTexts(r.root)).toContain(line);
      await cleanup();
    }
  });

  it.each(['es', 'ko'] as UiLocale[])('%s: the card reads in the UI language', async (locale) => {
    useLocaleStore.setState({ device: locale, byProfile: {} });
    const m = getMessages(locale).caregiver.dashboard.offline;
    const { root } = await render(<OfflineLessonsCard />);
    const texts = screenTexts(root);
    expect(texts).toEqual(expect.arrayContaining([m.title, m.line]));
    expect(texts.some((t) => t.startsWith(m.size(formatNumber(locale, 0.4))))).toBe(true);
  });
});
