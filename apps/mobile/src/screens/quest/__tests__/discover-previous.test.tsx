import type { DiscoverPage } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { touchTarget } from '@hangul-route/design-system';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioStore } from '../../../store/audio-store';
import { useLocaleStore } from '../../../store/locale-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { buttonsNamed, byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import { DiscoverStep } from '../DiscoverStep';

/**
 * [QB] AMENDMENTS-QUEST-SOUND-BACK row QB-1: Previous inside Look and learn. From page 2 on the step shows Previous
 * beside Continue; it shows the page before and stops any sound; the page dots keep the furthest page and ring the
 * page shown. Row QB-2's part of this step (Previous on page 1, opening on the last page) is at the end.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null, stops: 0 }));
vi.mock('../../../platform/audio', async (importOriginal) => {
  const bound = (await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!);
  return {
    ...(await importOriginal<object>()),
    ...bound,
    stop: () => {
      rig.stops += 1;
      bound.stop();
    },
  };
});
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));

const QUEST = getMessages('en').learner.quest;
const COPY = QUEST.discover;
const LETTERS: DiscoverPage = {
  items: [
    { type: 'jamo', jamoId: 'jamo:a', example: { ko: '나', romanization: 'na', en: 'I, me' } },
    { type: 'jamo', jamoId: 'jamo:eo', example: { ko: '너', romanization: 'neo', en: 'you' } },
  ],
};
const WORDS: DiscoverPage = { items: [{ type: 'word', word: { ko: '나무', romanization: 'namu', en: 'tree' } }] };
const MORE_WORDS: DiscoverPage = { items: [{ type: 'word', word: { ko: '가구', romanization: 'gagu', en: 'furniture' } }] };
const mounted: ReactTestRenderer[] = [];

const settle = async (ms = 30): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};
const texts = (r: ReactTestRenderer): string => screenTexts(r.root).join(' | ');
const previous = (root: ReactTestInstance): ReactTestInstance[] => buttonsNamed(root, QUEST.previous.cta);
const tap = async (r: ReactTestRenderer, label: string): Promise<void> => {
  await press(buttonsNamed(r.root, label)[0]!);
  await settle();
};
const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};
const dots = (r: ReactTestRenderer): ReactTestInstance => byTestId(r.root, 'discover-page-dots')[0]!;

async function open(pages: DiscoverPage[], props: Partial<Parameters<typeof DiscoverStep>[0]> = {}): Promise<ReactTestRenderer> {
  const r = await render(<DiscoverStep pages={pages} onDone={() => undefined} {...props} />);
  mounted.push(r);
  await settle();
  return r;
}

beforeEach(() => {
  rig.stops = 0;
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
  useLocaleStore.setState({ device: 'en' });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

describe('[QB] Previous inside Look and learn (row QB-1)', () => {
  it('page 1 has no Previous; page 2 shows it beside Continue', async () => {
    const r = await open([LETTERS, WORDS]);
    expect(previous(r.root)).toHaveLength(0);
    expect(byTestId(r.root, 'quest-step-actions')).toHaveLength(0);
    await tap(r, COPY.continue.cta);
    expect(texts(r)).toContain(COPY.pageLabel(2, 2));
    expect(previous(r.root)).toHaveLength(1);
    expect(buttonsNamed(r.root, COPY.continue.cta)).toHaveLength(1);
  });

  it('Previous shows the page before; Continue goes forward again', async () => {
    const r = await open([LETTERS, WORDS, MORE_WORDS]);
    await tap(r, COPY.continue.cta);
    await tap(r, COPY.continue.cta);
    expect(texts(r)).toContain(COPY.pageLabel(3, 3));
    await tap(r, QUEST.previous.cta);
    expect(texts(r)).toContain(COPY.pageLabel(2, 3));
    expect(texts(r)).toContain('나무');
    await tap(r, QUEST.previous.cta);
    expect(texts(r)).toContain(COPY.pageLabel(1, 3));
    expect(previous(r.root)).toHaveLength(0);
    await tap(r, COPY.continue.cta);
    expect(texts(r)).toContain(COPY.pageLabel(2, 3));
  });

  it('the dots keep the furthest page and ring the page shown, which the meter reads out', async () => {
    const r = await open([LETTERS, WORDS, MORE_WORDS]);
    expect(dots(r).props['aria-valuenow']).toBe(1);
    expect(byTestId(r.root, 'discover-page-dots-current')).toHaveLength(0);
    await tap(r, COPY.continue.cta);
    await tap(r, COPY.continue.cta);
    expect(dots(r).props['aria-valuenow']).toBe(3);
    await tap(r, QUEST.previous.cta);
    await tap(r, QUEST.previous.cta);
    // Still three filled dots: the meter never goes down. The first one is ringed.
    expect(dots(r).props['aria-valuenow']).toBe(3);
    expect(dots(r).props['aria-valuetext']).toBe(COPY.pageLabel(1, 3));
    expect(byTestId(r.root, 'discover-page-dots-current')).toHaveLength(1);
    // Back on the furthest page: no ring.
    await tap(r, COPY.continue.cta);
    await tap(r, COPY.continue.cta);
    expect(byTestId(r.root, 'discover-page-dots-current')).toHaveLength(0);
  });

  it('Previous stops a sound that is playing', async () => {
    const r = await open([WORDS, MORE_WORDS]);
    await tap(r, COPY.continue.cta);
    await press(pressable(r.root, `discover-hear-word:가구|sound`));
    const before = rig.stops;
    await tap(r, QUEST.previous.cta);
    expect(rig.stops).toBeGreaterThan(before);
  });

  it('after a Previous, Continue on the last page ends the step once with every page counted', async () => {
    const done = vi.fn();
    const r = await open([LETTERS, WORDS], { onDone: done });
    await tap(r, COPY.continue.cta);
    await tap(r, QUEST.previous.cta);
    await tap(r, COPY.continue.cta);
    expect(done).not.toHaveBeenCalled();
    await tap(r, COPY.continue.cta);
    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith({ pages: 2, heard: 0 });
  });

  it('both buttons of the row are at least 64 high, and Previous comes first in reading order', async () => {
    const r = await open([LETTERS, WORDS]);
    await tap(r, COPY.continue.cta);
    const row = byTestId(r.root, 'quest-step-actions')[0]!;
    const buttons = row.findAll((n) => typeof n.type === 'string' && n.props.role === 'button');
    expect(buttons.map((b) => screenTexts(b)[0])).toEqual([QUEST.previous.cta, COPY.continue.cta]);
    for (const b of buttons) {
      const style = Object.assign({}, ...[b.props.style].flat(Infinity)) as { minHeight?: number | string };
      expect(Number.parseFloat(String(style.minHeight))).toBeGreaterThanOrEqual(touchTarget.min);
    }
  });

  it.each([
    ['es', 'Anterior'],
    ['ko', '이전'],
  ] as const)('the button is named from the dictionary in %s', async (locale, label) => {
    useLocaleStore.setState({ device: locale });
    const r = await open([LETTERS, WORDS]);
    await press(pressable(r.root, 'discover-continue'));
    await settle();
    expect(buttonsNamed(r.root, label)).toHaveLength(1);
  });
});

describe('[QB] the step before and after (row QB-2)', () => {
  it('with a step before it, page 1 shows Previous and it is the step\'s: the page does not change', async () => {
    const onPrevious = vi.fn();
    const r = await open([LETTERS, WORDS], { onPrevious });
    expect(previous(r.root)).toHaveLength(1);
    await tap(r, QUEST.previous.cta);
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(texts(r)).toContain(COPY.pageLabel(1, 2));
    // From page 2, Previous is the page's, not the step's.
    await tap(r, COPY.continue.cta);
    await tap(r, QUEST.previous.cta);
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(texts(r)).toContain(COPY.pageLabel(1, 2));
  });

  it('reached by Previous, the step opens on its last page with every dot filled', async () => {
    const done = vi.fn();
    const r = await open([LETTERS, WORDS, MORE_WORDS], { start: { lastPage: true, seen: true }, onDone: done });
    expect(texts(r)).toContain(COPY.pageLabel(3, 3));
    expect(dots(r).props['aria-valuenow']).toBe(3);
    expect(byTestId(r.root, 'discover-page-dots-current')).toHaveLength(0);
    await tap(r, COPY.continue.cta);
    expect(done).toHaveBeenCalledWith({ pages: 3, heard: 0 });
  });

  it('shown again from the step before, it opens on page 1 with the dots still full', async () => {
    const r = await open([LETTERS, WORDS], { start: { seen: true } });
    expect(texts(r)).toContain(COPY.pageLabel(1, 2));
    expect(dots(r).props['aria-valuenow']).toBe(2);
    expect(byTestId(r.root, 'discover-page-dots-current')).toHaveLength(1);
  });
});
