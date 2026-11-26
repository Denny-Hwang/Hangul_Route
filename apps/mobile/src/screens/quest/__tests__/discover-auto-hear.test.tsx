import type { DiscoverPage } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCREEN_SETTLE_MS } from '../../../logic/audio/settle';
import { useAudioStore } from '../../../store/audio-store';
import { useLocaleStore } from '../../../store/locale-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { buttonsNamed, byTestId, press, render, unmount } from '../../../test-support/render';
import { DiscoverStep } from '../DiscoverStep';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 row AU-10 (audit UX-7: a learner could pass the letter pages without hearing a sound).
 * On each Look and learn page of a learner's quest the first letter's sound plays once when the page opens, through
 * the same play as its Hear it, on the shipped web audio adapter over FakeSpeechSynthesis. It respects sound off and a
 * screen reader, never holds Continue, does not play again on a re-render, and stops when the page changes.
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
const reader = vi.hoisted(() => ({ on: false, wait: null as Promise<void> | null }));
vi.mock('../../../platform/screen-reader', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isScreenReaderEnabled: async () => {
    if (reader.wait) await reader.wait;
    return reader.on;
  },
}));
const events = vi.hoisted(() => [] as Array<{ name: string; payload?: unknown }>);
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async (event: { name: string; payload?: unknown }) => {
    events.push(event);
  }),
}));

const COPY = getMessages('en').learner.quest.discover;
const LETTERS: DiscoverPage = {
  items: [
    { type: 'jamo', jamoId: 'jamo:a', example: { ko: '나', romanization: 'na', en: 'I, me' } },
    { type: 'jamo', jamoId: 'jamo:eo', example: { ko: '너', romanization: 'neo', en: 'you' } },
  ],
};
const MORE_LETTERS: DiscoverPage = {
  items: [
    { type: 'jamo', jamoId: 'jamo:nieun', example: { ko: '나무', romanization: 'namu', en: 'tree' } },
    { type: 'jamo', jamoId: 'jamo:giyeok', example: { ko: '가구', romanization: 'gagu', en: 'furniture' } },
  ],
};
const WORDS: DiscoverPage = { items: [{ type: 'word', word: { ko: '나무', romanization: 'namu', en: 'tree' } }] };
const mounted: ReactTestRenderer[] = [];

/** [QS-3] The page's own sound waits for the screen: this long covers the wait and the play's start. */
const AUTO_MS = SCREEN_SETTLE_MS + 60;
const settle = async (ms = 30): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};
const spoken = (): string[] => rig.current!.synth.spoken.map((u) => u.text);
const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};

async function open(pages: DiscoverPage[], autoHear: boolean, onDone: (result: { pages: number; heard: number }) => void = () => undefined): Promise<ReactTestRenderer> {
  const r = await render(<DiscoverStep pages={pages} onDone={onDone} autoHear={autoHear} />);
  mounted.push(r);
  await settle(AUTO_MS);
  return r;
}

beforeEach(() => {
  events.length = 0;
  rig.stops = 0;
  reader.on = false;
  reader.wait = null;
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
  useLocaleStore.setState({ device: 'en' });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

describe('[AU] the first letter sounds by itself on a letter page (row AU-10)', () => {
  it('a letter page says its first letter once as it opens, the sound its Hear it says', async () => {
    const r = await open([LETTERS], true);
    expect(spoken()).toEqual(['아']);
    // The same play as the button: a tap on Hear it says the same thing again.
    await press(pressable(r.root, 'discover-hear-jamo:a|sound'));
    await settle();
    expect(spoken()).toEqual(['아', '아']);
    // No failure of any kind was reported for it.
    expect(events.filter((e) => e.name === 'audio.fallback_shown')).toEqual([]);
  });

  it('only the first letter: the second waits for its own Hear it', async () => {
    await open([LETTERS], true);
    await settle(200);
    expect(spoken()).toEqual(['아']);
  });

  it('without the switch (the All lessons preview) nothing plays by itself', async () => {
    await open([LETTERS], false);
    expect(spoken()).toEqual([]);
  });

  it('each letter page says its own first letter when it opens; a page that opens on a word stays quiet', async () => {
    const r = await open([LETTERS, WORDS, MORE_LETTERS], true);
    expect(spoken()).toEqual(['아']);
    await press(buttonsNamed(r.root, COPY.continue.cta)[0]!);
    await settle(AUTO_MS);
    expect(spoken()).toEqual(['아']);
    await press(buttonsNamed(r.root, COPY.continue.cta)[0]!);
    await settle(AUTO_MS);
    expect(spoken()).toEqual(['아', '나']);
  });

  it('it does not play again when the screen re-renders (a new UI language rebuilds the page)', async () => {
    const r = await open([LETTERS], true);
    await act(async () => {
      useLocaleStore.setState({ device: 'es' });
    });
    await settle(AUTO_MS);
    await act(async () => {
      r.update(<DiscoverStep pages={[LETTERS]} onDone={() => undefined} autoHear />);
    });
    await settle(AUTO_MS);
    expect(spoken()).toEqual(['아']);
  });

  it('Continue never waits for it, and it is not a tap: heard counts taps only', async () => {
    const done = vi.fn();
    const r = await render(<DiscoverStep pages={[LETTERS]} onDone={done} autoHear />);
    mounted.push(r);
    // At once, before the sound has even begun: Continue is enabled and ends the step.
    const next = buttonsNamed(r.root, COPY.continue.cta)[0]!;
    expect(next.props['aria-disabled']).not.toBe(true);
    await press(next);
    expect(done).toHaveBeenCalledWith({ pages: 1, heard: 0 });
  });

  it('a tap on Hear it after it counts as one heard', async () => {
    const done = vi.fn();
    const r = await open([LETTERS], true, done);
    await press(pressable(r.root, 'discover-hear-jamo:a|sound'));
    await settle();
    await press(buttonsNamed(r.root, COPY.continue.cta)[0]!);
    expect(done).toHaveBeenCalledWith({ pages: 1, heard: 1 });
  });

  it('when the page changes it stops', async () => {
    const r = await open([LETTERS, WORDS], true);
    const before = rig.stops;
    await press(buttonsNamed(r.root, COPY.continue.cta)[0]!);
    await settle(AUTO_MS);
    expect(rig.stops).toBeGreaterThan(before);
    expect(spoken()).toEqual(['아']);
  });

  it('with sound off nothing plays and nothing new shows: no attempt, no failure', async () => {
    useAudioStore.setState({ muted: true });
    await open([LETTERS], true);
    expect(spoken()).toEqual([]);
    expect(rig.current!.synth.dropped).toEqual([]);
    expect(events.filter((e) => e.name === 'audio.fallback_shown' || e.name === 'audio.playback_failed')).toEqual([]);
  });

  it('with a screen reader on it stays quiet, so it never talks over the page being read', async () => {
    reader.on = true;
    const r = await open([LETTERS], true);
    expect(spoken()).toEqual([]);
    // Hear it still plays on request.
    await press(pressable(r.root, 'discover-hear-jamo:a|sound'));
    await settle();
    expect(spoken()).toEqual(['아']);
  });

  it('on a device with no Korean voice and no recording it does not try', async () => {
    rig.current = createAudioRig({ voices: [] });
    await open([LETTERS], true);
    expect(spoken()).toEqual([]);
    expect(events.filter((e) => e.name === 'audio.fallback_shown')).toEqual([]);
  });

  it('a browser that still refuses it shows the item\'s own Tap to hear, and Continue works', async () => {
    rig.current = createAudioRig({ voices: [KO_VOICE], requireGesture: true });
    const r = await open([LETTERS], true);
    await settle(1700);
    expect(spoken()).toEqual([]);
    const panel = byTestId(r.root, 'discover-sound-jamo:a')[0]!;
    expect(buttonsNamed(panel, getMessages('en').learner.audio.action.tap_to_hear.cta).length).toBeGreaterThan(0);
    expect(buttonsNamed(r.root, COPY.continue.cta)[0]!.props['aria-disabled']).not.toBe(true);
  });

  it('leaving the step before the screen-reader check answers plays nothing', async () => {
    let answer: () => void = () => undefined;
    reader.wait = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const r = await render(<DiscoverStep pages={[LETTERS]} onDone={() => undefined} autoHear />);
    await unmount(r);
    answer();
    await settle(AUTO_MS);
    expect(spoken()).toEqual([]);
  });
});

/** [QS] AMENDMENTS-QUEST-SOUND-BACK QS-3: a sound played by itself waits for the screen. */
describe('[QS] the page\'s own sound waits 350 ms for the page (QS-3)', () => {
  const openNow = async (pages: DiscoverPage[]): Promise<ReactTestRenderer> => {
    const r = await render(<DiscoverStep pages={pages} onDone={() => undefined} autoHear />);
    mounted.push(r);
    return r;
  };

  it('nothing sounds while the page is arriving; the letter is said once the wait is over', async () => {
    await openNow([LETTERS]);
    await settle(SCREEN_SETTLE_MS - 150);
    expect(spoken()).toEqual([]);
    await settle(150 + 60);
    expect(spoken()).toEqual(['아']);
  });

  it('a tap on Hear it during the wait plays at once, and the page does not say it a second time', async () => {
    const r = await openNow([LETTERS]);
    await settle(50);
    await press(pressable(r.root, 'discover-hear-jamo:a|sound'));
    await settle();
    expect(spoken()).toEqual(['아']);
    await settle(AUTO_MS);
    expect(spoken()).toEqual(['아']);
  });

  it('a tap on another speaker during the wait is not cut by the page\'s own sound', async () => {
    const r = await openNow([LETTERS]);
    await settle(50);
    await press(pressable(r.root, 'discover-hear-jamo:eo|sound'));
    await settle(AUTO_MS);
    expect(spoken()).toEqual(['어']);
  });

  it('a page left during the wait says nothing, and the next page waits its own 350 ms', async () => {
    const r = await openNow([LETTERS, MORE_LETTERS]);
    await settle(100);
    const before = rig.stops;
    await press(buttonsNamed(r.root, COPY.continue.cta)[0]!);
    await settle(SCREEN_SETTLE_MS - 150);
    expect(spoken()).toEqual([]);
    await settle(150 + 60);
    expect(spoken()).toEqual(['나']);
    // Nothing of page 1 had started, so leaving it had nothing of its own to stop (the page change's stop is the flow's).
    expect(rig.stops).toBeGreaterThanOrEqual(before);
  });

  it('a step left during the wait says nothing', async () => {
    const r = await render(<DiscoverStep pages={[LETTERS]} onDone={() => undefined} autoHear />);
    await settle(100);
    await unmount(r);
    await settle(AUTO_MS);
    expect(spoken()).toEqual([]);
  });

  it('sound turned off during the wait: nothing plays', async () => {
    await openNow([LETTERS]);
    await settle(100);
    await act(async () => {
      useAudioStore.setState({ muted: true });
    });
    await settle(AUTO_MS);
    expect(spoken()).toEqual([]);
  });

  // AMENDMENTS-DISCOVER-SOUND-FIRST SF-1: the autoplay follows item.hear, so a consonant page opens on its sound.
  it('a page whose first item is ㄱ says 가 once by itself, not 기역', async () => {
    const GIYEOK: DiscoverPage = { items: [{ type: 'jamo', jamoId: 'jamo:giyeok', example: { ko: '가구', romanization: 'gagu', en: 'furniture' } }] };
    await openNow([GIYEOK]);
    await settle(AUTO_MS);
    expect(spoken()).toEqual(['가']);
  });

  it('a tap on Hear the name during the wait plays 기역 at once and drops the autoplay', async () => {
    const GIYEOK: DiscoverPage = { items: [{ type: 'jamo', jamoId: 'jamo:giyeok', example: { ko: '가구', romanization: 'gagu', en: 'furniture' } }] };
    const r = await openNow([GIYEOK]);
    await settle(50);
    await press(pressable(r.root, 'discover-hear-jamo:giyeok|name'));
    await settle();
    expect(spoken()).toEqual(['기역']);
    await settle(AUTO_MS);
    expect(spoken()).toEqual(['기역']);
  });
});
