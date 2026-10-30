import { keysFor } from '@hangul-route/content-schema';
import { LayoutProvider, TextSizeProvider, layoutClassFor, type TextSizeStep } from '@hangul-route/design-system';
import { View } from 'react-native';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import type { MinigameScope } from '../../../logic/minigame-config';
import { FIXTURE_CHAIN } from '../../../logic/my-story/e2e-chain';
import { SENTENCE_PAUSE_MS } from '../../../logic/write-frame/flow';
import { byTestId, press, resetPlatform, screenTexts } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { MY_STORY_AUDIO_SOURCE, MyStoryGame } from '../MyStoryGame';

/**
 * F-CURR-002 §7.1 F8, OD-13 (row CM-38; design/wireframes/minigame/my-story.md, board Y): My Story through
 * react-native-web. Each frame is Write Frame (any pick is right, the word typed is checked against the pick), the
 * sentences gather in "My story so far", My page shows the not-kept line above the text, a Hear button per sentence
 * and Done, and no save, share, copy, download or print control. Slots are word-bank only: no free-text field
 * exists in any phase. Test P-1 extended: the host hears ids, indices and booleans only, the same whichever word was
 * picked, and nothing is logged, stored or left after unmount.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/screen-reader', () => ({ announceForScreenReader: vi.fn(), focusForScreenReader: vi.fn() }));
const audio = vi.hoisted(() => ({ playPrompt: vi.fn((_spec: { text: string; kind: string; source: string }) => Promise.resolve('played' as const)) }));
vi.mock('../../../platform/audio', async (importOriginal) => ({ ...(await importOriginal<object>()), ...audio }));
const telemetry = vi.hoisted(() => ({ track: vi.fn(() => Promise.resolve()) }));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), ...telemetry }));
// The app's own storage layer (IndexedDB through idb-keyval on the web): every write is watched (review of PR #849).
const storageWrites = vi.hoisted(() => [] as unknown[][]);
vi.mock('../../../platform/storage', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../platform/storage')>();
  const watch =
    <A extends unknown[], R>(fn: (...args: A) => R) =>
    (...args: A): R => {
      storageWrites.push(args);
      return fn(...args);
    };
  return { ...real, writeJson: watch(real.writeJson), updateJson: watch(real.updateJson), removeKey: watch(real.removeKey) };
});

type Host = MinigameHost & { calls: unknown[]; completes: number };
const host = (): Host => {
  const h: Host = {
    mode: 'quest',
    calls: [],
    completes: 0,
    answer: (key, correct, meta) => void h.calls.push([key, correct, meta]),
    complete: () => {
      h.completes += 1;
    },
  };
  return h;
};

const scope: MinigameScope = { kind: 'my-story', rounds: FIXTURE_CHAIN.length, myStory: { frames: [...FIXTURE_CHAIN] } };
const mounted: ReactTestRenderer[] = [];
async function play(h: Host = host(), size = { width: 375, height: 667 }, step: TextSizeStep = 'standard'): Promise<{ r: ReactTestRenderer; h: Host }> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <TextSizeProvider step={step}>
        <LayoutProvider value={layoutClassFor(size)}>
          <RomanizationModeOverride mode="always">
            <MyStoryGame scope={scope} host={h} />
          </RomanizationModeOverride>
        </LayoutProvider>
      </TextSizeProvider>,
      { createNodeMock: () => ({ focus: vi.fn(), addEventListener: () => undefined, removeEventListener: () => undefined }) },
    );
  });
  mounted.push(r);
  return { r, h };
}

const tap = async (r: ReactTestRenderer, id: string): Promise<void> => {
  const node = byTestId(r.root, id).find((n) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};
const typeWord = async (r: ReactTestRenderer, text: string): Promise<void> => {
  for (const j of keysFor(text)) await tap(r, j === ' ' ? 'hangul-key-space' : `hangul-key-${j}`);
};
const texts = (r: ReactTestRenderer, id: string): string[] => screenTexts(byTestId(r.root, id)[0]!);
const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};
/** Every free-text field the tree holds: a text input or textarea, or anything editable. */
const freeTextFields = (r: ReactTestRenderer): ReactTestInstance[] =>
  r.root.findAll((n) => typeof n.type === 'string' && (n.type === 'input' || n.type === 'textarea' || n.props.contentEditable === true || n.props.contentEditable === 'true'));
const HANGUL = /[ㄱ-ㆎ가-힣]/;

/** Plays the whole chain with the bank index picked in each frame (frames 1 and 2 typed, frame 3 pick only). */
async function playChain(r: ReactTestRenderer, picks: readonly [number, number, number]): Promise<void> {
  for (let f = 0; f < 3; f += 1) {
    const frame = FIXTURE_CHAIN[f]!;
    await tap(r, `write-frame-word-${picks[f]}`);
    if (frame.entry === 'type') {
      expect(freeTextFields(r)).toEqual([]);
      await typeWord(r, frame.slots[0]!.bank[picks[f]!]!.ko);
      await tap(r, 'write-frame-done');
    }
    await advance(SENTENCE_PAUSE_MS);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  audio.playPrompt.mockClear();
  telemetry.track.mockClear();
});
afterEach(async () => {
  for (const r of mounted.splice(0)) {
    await act(async () => {
      r.unmount();
    });
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetPlatform();
});

describe('My Story: a short text from chained word-bank frames (row CM-38)', () => {
  it('frame 1: the heading, the frame, the bank with its neutral option drawn like the others, no story yet', async () => {
    const { r } = await play();
    const shown = texts(r, 'write-frame');
    expect(shown).toEqual(expect.arrayContaining(['Write your story', 'Pick a word. Any word works.', '도서관', '시장', '공원', 'the park']));
    expect(shown).not.toContain('Make your own sentence');
    expect(byTestId(r.root, 'my-story-so-far')).toHaveLength(0);
    // The neutral option is a card like the others: same kind of node, same props but its words, and last in the bank.
    const cards = [0, 1, 2].map((i) => byTestId(r.root, `write-frame-word-${i}`).find((n) => typeof n.props.onClick === 'function')!);
    expect(new Set(cards.map((c) => c.type)).size).toBe(1);
    expect(cards.map((c) => Object.keys(c.props).sort().join())).toEqual(Array(3).fill(Object.keys(cards[0]!.props).sort().join()));
    expect(screenTexts(cards[2]!)).toEqual(expect.arrayContaining(['공원', 'gongwon', 'the park']));
    expect(screenTexts(cards[2]!).some((t) => /neutral|safe|private/i.test(t))).toBe(false);
    expect(freeTextFields(r)).toEqual([]);
  });

  it('on a phone the write phase keeps the frame only; the story so far comes back at the next pick', async () => {
    const { r } = await play();
    await tap(r, 'write-frame-word-2');
    await typeWord(r, '공원');
    await tap(r, 'write-frame-done');
    await advance(SENTENCE_PAUSE_MS);
    expect(byTestId(r.root, 'my-story-so-far')).toHaveLength(1);
    await tap(r, 'write-frame-word-0');
    expect(byTestId(r.root, 'my-story-so-far')).toHaveLength(0);
    expect(byTestId(r.root, 'my-story-so-far-folded')).toHaveLength(0);
  });

  it('the sentences gather in "My story so far"; while writing they fold to one line that opens on a tap', async () => {
    const { r } = await play(host(), { width: 768, height: 1024 });
    await tap(r, 'write-frame-word-2');
    await typeWord(r, '공원');
    await tap(r, 'write-frame-done');
    // The sentence is said once as it is written, through the device voice only.
    expect(audio.playPrompt).toHaveBeenCalledTimes(1);
    expect(audio.playPrompt).toHaveBeenLastCalledWith({ text: '저는 주말에 공원에 가요.', kind: 'sentence', source: MY_STORY_AUDIO_SOURCE });
    await advance(SENTENCE_PAUSE_MS);
    expect(texts(r, 'my-story-so-far')).toEqual(
      expect.arrayContaining(['My story so far', '저는 주말에 공원에 가요.', 'jeoneun jumare gongwone gayo', 'On the weekend I go to the park.']),
    );
    const list = r.root.findAll((n) => n.props.role === 'list' && typeof n.type === 'string')[0];
    expect(list?.props['aria-label']).toBe('My story so far, 1 line');
    // The lines have no button: a stray tap cannot leave the frame.
    expect(byTestId(r.root, 'my-story-so-far')[0]!.findAll((n) => typeof n.props.onClick === 'function')).toEqual([]);
    await tap(r, 'write-frame-word-0');
    expect(texts(r, 'my-story-so-far-folded')).toContain('1 line so far');
    expect(byTestId(r.root, 'my-story-so-far')).toHaveLength(0);
    await tap(r, 'my-story-so-far-folded');
    expect(texts(r, 'my-story-so-far')).toContain('저는 주말에 공원에 가요.');
    expect(freeTextFields(r)).toEqual([]);
  });

  it('large text (150 %) on a phone: the story so far folds while picking too, and opens on a tap', async () => {
    const { r } = await play(host(), { width: 320, height: 568 }, 'largest');
    await tap(r, 'write-frame-word-2');
    await typeWord(r, '공원');
    await tap(r, 'write-frame-done');
    await advance(SENTENCE_PAUSE_MS);
    // Frame 2's pick: the folded line above the frame card, so the frame and the bank keep their place.
    expect(texts(r, 'my-story-so-far-folded')).toContain('1 line so far');
    expect(byTestId(r.root, 'my-story-so-far')).toHaveLength(0);
    expect(byTestId(r.root, 'write-frame-word-0').length).toBeGreaterThan(0);
    await tap(r, 'my-story-so-far-folded');
    expect(texts(r, 'my-story-so-far')).toContain('저는 주말에 공원에 가요.');
    // The next frame starts folded again.
    await tap(r, 'write-frame-word-2');
    await typeWord(r, '호야');
    await tap(r, 'write-frame-done');
    await advance(SENTENCE_PAUSE_MS);
    expect(texts(r, 'my-story-so-far-folded')).toContain('2 lines so far');
    expect(freeTextFields(r)).toEqual([]);
  });

  it('My page: the title, the not-kept line above the text, each sentence with Hear, Hoya and Done; nothing to keep', async () => {
    const { r, h } = await play();
    await playChain(r, [2, 2, 2]);
    const page = texts(r, 'my-story-page');
    expect(page.slice(0, 2)).toEqual(['My page', 'This page is just for now. It is not saved.']);
    expect(page).toEqual(
      expect.arrayContaining(['저는 주말에 공원에 가요.', '호야와 같이 가요.', 'I go with Hoya.', '기분이 괜찮아요.', 'gibuni gwaenchanayo', 'I feel okay.', 'You wrote a whole story!']),
    );
    // The not-kept line comes before the first sentence.
    expect(page.indexOf('This page is just for now. It is not saved.')).toBeLessThan(page.indexOf('저는 주말에 공원에 가요.'));
    // The only controls: a Hear button per sentence and Done. No save, share, copy, download or print.
    const controls = byTestId(r.root, 'my-story-page')[0]!.findAll((n) => typeof n.type === 'string' && typeof n.props.onClick === 'function');
    const names = controls.map((c) => String(c.props['aria-label'] ?? screenTexts(c).join(' ')));
    expect(names).toEqual(['Hear jeoneun jumare gongwone gayo', 'Hear hoyawa gachi gayo', 'Hear gibuni gwaenchanayo', 'Done']);
    expect(names.join(' ')).not.toMatch(/save|share|copy|download|print|keep/i);
    // Nothing on My page plays by itself; Hear says that sentence.
    audio.playPrompt.mockClear();
    await advance(SENTENCE_PAUSE_MS * 2);
    expect(audio.playPrompt).not.toHaveBeenCalled();
    await tap(r, 'my-story-hear-1');
    expect(audio.playPrompt).toHaveBeenCalledWith({ text: '호야와 같이 가요.', kind: 'sentence', source: MY_STORY_AUDIO_SOURCE });
    expect(h.completes).toBe(0);
    await tap(r, 'my-story-done');
    expect(h.completes).toBe(1);
  });

  it('Skip after a frame shows the story so far with the same not-kept line; Skip before any frame ends the step', async () => {
    const first = await play();
    await tap(first.r, 'write-frame-word-1');
    await typeWord(first.r, '시장');
    await tap(first.r, 'write-frame-done');
    await advance(SENTENCE_PAUSE_MS);
    await tap(first.r, 'write-frame-skip');
    const page = texts(first.r, 'my-story-page');
    expect(page).toEqual(expect.arrayContaining(['This page is just for now. It is not saved.', '저는 주말에 시장에 가요.', 'Here is your story so far.']));
    expect(page).not.toContain('You wrote a whole story!');
    expect(first.h.completes).toBe(0);
    await tap(first.r, 'my-story-done');
    expect(first.h.completes).toBe(1);
    expect(first.h.calls).toEqual([[0, true, { itemId: 'e2e-weekend' }]]);

    const none = await play();
    await tap(none.r, 'write-frame-skip');
    expect(byTestId(none.r.root, 'my-story-page')).toHaveLength(0);
    expect(none.h.completes).toBe(1);
    expect(none.h.calls).toEqual([]);
  });

  it('from regular width, the story so far sits beside the frame card', async () => {
    const { r } = await play(host(), { width: 768, height: 1024 });
    await tap(r, 'write-frame-word-2');
    await typeWord(r, '공원');
    await tap(r, 'write-frame-done');
    await advance(SENTENCE_PAUSE_MS);
    // One row holds both panes: the story so far and the frame card.
    const rows = r.root.findAll((n) => n.type === View && (n.props.style as { flexDirection?: string } | undefined)?.flexDirection === 'row');
    const twoPane = rows.find((row) => byTestId(row, 'my-story-so-far').length > 0 && byTestId(row, 'write-frame-card').length > 0);
    expect(twoPane).toBeDefined();
    // On a phone they stack: no row holds both.
    const phone = await play();
    await tap(phone.r, 'write-frame-word-2');
    await typeWord(phone.r, '공원');
    await tap(phone.r, 'write-frame-done');
    await advance(SENTENCE_PAUSE_MS);
    const phoneRows = phone.r.root.findAll((n) => n.type === View && (n.props.style as { flexDirection?: string } | undefined)?.flexDirection === 'row');
    expect(phoneRows.some((row) => byTestId(row, 'my-story-so-far').length > 0 && byTestId(row, 'write-frame-card').length > 0)).toBe(false);
  });
});

describe('test P-1 extended to My Story (OD-13): nothing written leaves the step', () => {
  it('two runs with different picks give the host the same calls, and the host never hears Korean', async () => {
    const a = await play();
    await playChain(a.r, [0, 0, 0]);
    await tap(a.r, 'my-story-done');
    const b = await play();
    await playChain(b.r, [2, 1, 2]);
    await tap(b.r, 'my-story-done');
    // Frames 1 and 2 are written (scored on their first Done); frame 3 is pick only, which Write Frame never scores.
    expect(a.h.calls).toEqual([
      [0, true, { itemId: 'e2e-weekend' }],
      [1, true, { itemId: 'e2e-with' }],
    ]);
    expect(b.h.calls).toEqual(a.h.calls);
    expect(JSON.stringify(a.h.calls)).not.toMatch(HANGUL);
    expect(a.h.completes).toBe(1);
    expect(b.h.completes).toBe(1);
    // The game itself sends no telemetry: the quest host's minigame.finished (kind and ids) is the only event.
    expect(telemetry.track).not.toHaveBeenCalled();
  });

  it('nothing is logged or written to browser storage while the chain is played', async () => {
    storageWrites.length = 0;
    const logs = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const storage = (): Storage => {
      const map = new Map<string, string>();
      return {
        get length() {
          return map.size;
        },
        clear: () => map.clear(),
        getItem: (k) => map.get(k) ?? null,
        key: (i) => [...map.keys()][i] ?? null,
        removeItem: (k) => void map.delete(k),
        setItem: (k, v) => void map.set(k, String(v)),
      };
    };
    vi.stubGlobal('localStorage', storage());
    vi.stubGlobal('sessionStorage', storage());
    const setItems = [vi.spyOn(globalThis.localStorage, 'setItem'), vi.spyOn(globalThis.sessionStorage, 'setItem')];
    const { r } = await play();
    await playChain(r, [1, 0, 1]);
    await tap(r, 'my-story-done');
    for (const spy of logs) expect(spy).not.toHaveBeenCalled();
    for (const setItem of setItems) expect(setItem).not.toHaveBeenCalled();
    expect(globalThis.localStorage.length + globalThis.sessionStorage.length).toBe(0);
    // Nor through the app's storage layer: no write carries a picked word or a written sentence.
    expect(JSON.stringify(storageWrites, (_k, v: unknown) => (typeof v === 'function' ? '[fn]' : v))).not.toMatch(/[ㄱ-ㆎ가-힣]|jumare|gachi|gibuni/);
  });

  it('the text is gone after the step unmounts: a new mount starts with an empty chain', async () => {
    const first = await play();
    await playChain(first.r, [0, 0, 0]);
    expect(texts(first.r, 'my-story-page')).toContain('저는 주말에 도서관에 가요.');
    await act(async () => {
      first.r.unmount();
    });
    mounted.splice(mounted.indexOf(first.r), 1);
    const second = await play();
    expect(screenTexts(second.r.root)).not.toContain('저는 주말에 도서관에 가요.');
    expect(byTestId(second.r.root, 'my-story-so-far')).toHaveLength(0);
    expect(texts(second.r, 'write-frame')).toContain('Write your story');
  });
});
