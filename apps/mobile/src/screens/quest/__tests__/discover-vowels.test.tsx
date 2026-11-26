import type { DiscoverPage } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioStore } from '../../../store/audio-store';
import { useLocaleStore } from '../../../store/locale-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { buttonsNamed, byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import { DiscoverStep } from '../DiscoverStep';

/**
 * [SF-3] AMENDMENTS-DISCOVER-SOUND-FIRST §12: the initial ㅇ card's second button, Hear it with vowels, says 아, 오, 우
 * one after the other (the vowel cards' own sounds), with the three carrier lines under it. Anything newer stops it:
 * another sound, Continue, Previous, leaving the step. On the shipped web audio adapter over FakeSpeechSynthesis (no
 * clips in this lane, so the Korean voice says each).
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null, warmed: [] as string[][] }));
vi.mock('../../../platform/audio', async (importOriginal) => {
  const bound = (await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!);
  return {
    ...(await importOriginal<object>()),
    ...bound,
    warmClips: async (refs: readonly string[]) => {
      rig.warmed.push([...refs]);
    },
  };
});

const m = getMessages('en');
const COPY = m.learner.quest.discover;
const IEUNG_PAGE: DiscoverPage = {
  items: [
    { type: 'jamo', jamoId: 'jamo:mieum', example: { ko: '나무', romanization: 'namu', en: 'tree' } },
    { type: 'jamo', jamoId: 'jamo:ieung', example: { ko: '오', romanization: 'o', en: 'five' } },
  ],
};
const WORDS: DiscoverPage = { items: [{ type: 'word', word: { ko: '나무', romanization: 'namu', en: 'tree' } }] };
const VOWELS_ID = 'jamo:ieung|vowels';
const mounted: ReactTestRenderer[] = [];

/** Longer than the whole run (three sounds, two 150 ms gaps). */
const RUN_MS = 600;
const settle = async (ms = 30): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};
const spoken = (): string[] => rig.current!.synth.spoken.map((u) => u.text);
const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, `discover-hear-${id}`).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};

async function open(pages: DiscoverPage[], onDone: (result: { pages: number; heard: number }) => void = () => undefined): Promise<ReactTestRenderer> {
  const r = await render(<DiscoverStep pages={pages} onDone={onDone} />);
  mounted.push(r);
  await settle();
  return r;
}

beforeEach(() => {
  rig.warmed = [];
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
  useLocaleStore.setState({ device: 'en' });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

describe('[SF-3] Hear it with vowels on the initial ㅇ card', () => {
  it('shows the button, named exactly, with the three carrier lines under it; no other card has it', async () => {
    const r = await open([IEUNG_PAGE]);
    const named = 'Hear it with vowels. Korean letter silent/ng';
    expect(m.a11y.hearVowelsLabel(m.a11y.discoverLetter('silent/ng'))).toBe(named);
    const button = pressable(r.root, VOWELS_ID);
    expect(button.props['aria-label']).toBe(named);
    expect(screenTexts(button)).toContain(COPY.hearVowels.cta);
    expect(buttonsNamed(r.root, COPY.hearVowels.cta)).toHaveLength(1);
    const lines = byTestId(r.root, 'discover-vowels-jamo:ieung')[0]!;
    const texts = screenTexts(lines);
    for (const t of ['아 = ㅇ + ㅏ', '오 = ㅇ + ㅗ', '우 = ㅇ + ㅜ', 'a', 'o', 'u']) expect(texts).toContain(t);
    // Each line reads its syllable only, never the lone ㅇ as its name.
    const labels = lines.findAll((n) => typeof n.type === 'string' && typeof n.props['aria-label'] === 'string').map((n) => n.props['aria-label'] as string);
    expect(labels).toEqual(expect.arrayContaining(['아, a', '오, o', '우, u']));
    expect(byTestId(r.root, 'discover-hear-jamo:mieum|vowels')).toHaveLength(0);
  });

  it('every one of its sounds is warmed with the page', async () => {
    await open([IEUNG_PAGE]);
    // 오 and 우 are on this page only as the second and third sounds of the button, so they must not load cold.
    expect(rig.warmed.flat()).toEqual(expect.arrayContaining(['audio/jamo/a.mp3', 'audio/jamo/o.mp3', 'audio/jamo/u.mp3']));
  });

  it('one tap says 아, 오, 우 in order, and the card shows it was heard', async () => {
    const done = vi.fn();
    const r = await open([IEUNG_PAGE], done);
    await press(pressable(r.root, VOWELS_ID));
    await settle(RUN_MS);
    expect(spoken()).toEqual(['아', '오', '우']);
    const card = byTestId(r.root, 'discover-item-jamo:ieung')[0]!;
    expect(screenTexts(card)).toContain(COPY.heard.pill);
    await press(buttonsNamed(r.root, COPY.continue.cta)[0]!);
    expect(done).toHaveBeenCalledWith({ pages: 1, heard: 1 });
  });

  it('another sound during the gap stops it: nothing more of it plays', async () => {
    const r = await open([IEUNG_PAGE]);
    await press(pressable(r.root, VOWELS_ID));
    await settle(30);
    expect(spoken()).toEqual(['아']);
    await press(pressable(r.root, 'jamo:ieung|sound'));
    await settle(RUN_MS);
    expect(spoken()).toEqual(['아', '이응']);
    // A run that was cut off leaves no heard mark of its own.
    const card = byTestId(r.root, 'discover-item-jamo:ieung')[0]!;
    expect(screenTexts(card)).toContain(COPY.heard.pill);
  });

  it('a second tap starts it again from 아', async () => {
    const r = await open([IEUNG_PAGE]);
    await press(pressable(r.root, VOWELS_ID));
    await settle(30);
    await press(pressable(r.root, VOWELS_ID));
    await settle(RUN_MS);
    expect(spoken()).toEqual(['아', '아', '오', '우']);
  });

  it('Continue during the gap: the next page hears nothing of it', async () => {
    const r = await open([IEUNG_PAGE, WORDS]);
    await press(pressable(r.root, VOWELS_ID));
    await settle(30);
    await press(buttonsNamed(r.root, COPY.continue.cta)[0]!);
    await settle(RUN_MS);
    expect(spoken()).toEqual(['아']);
  });

  it('Previous during the gap stops it', async () => {
    const r = await open([WORDS, IEUNG_PAGE]);
    await press(buttonsNamed(r.root, COPY.continue.cta)[0]!);
    await settle();
    await press(pressable(r.root, VOWELS_ID));
    await settle(30);
    await press(buttonsNamed(r.root, m.learner.quest.previous.cta)[0]!);
    await settle(RUN_MS);
    expect(spoken()).toEqual(['아']);
  });

  it('leaving the step during the gap plays nothing more', async () => {
    const r = await render(<DiscoverStep pages={[IEUNG_PAGE]} onDone={() => undefined} />);
    await settle();
    await press(pressable(r.root, VOWELS_ID));
    await settle(30);
    await unmount(r);
    await settle(RUN_MS);
    expect(spoken()).toEqual(['아']);
  });

  it('with sound off it stops at 아: nothing is said, and the card says why with its one action', async () => {
    useAudioStore.setState({ muted: true });
    const r = await open([IEUNG_PAGE]);
    await press(pressable(r.root, VOWELS_ID));
    await settle(RUN_MS);
    expect(spoken()).toEqual([]);
    const panel = byTestId(r.root, 'discover-sound-jamo:ieung')[0]!;
    expect(buttonsNamed(panel, m.learner.audio.action.turn_on.cta).length).toBeGreaterThan(0);
    // Its lines are already printed; no "Say it out loud" line is added for it.
    const card = byTestId(r.root, 'discover-item-jamo:ieung')[0]!;
    expect(screenTexts(card).some((t) => t.startsWith(COPY.sayLine('')))).toBe(false);
    expect(buttonsNamed(r.root, COPY.continue.cta)[0]!.props['aria-disabled']).not.toBe(true);
  });
});
