import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocaleStore } from '../../../store/locale-store';
import { byTestId, hostNodes, render, resetPlatform, setPlatform, unmount, type RenderPlatform } from '../../../test-support/render';
import { AnswerAnnouncer } from '../answer-announcer';
import { useAnswerAnnouncement, type AnswerAnnouncement } from '../use-answer-announcement';

/**
 * F-A11Y-001 §6 tests 7 and 8 (row AF-1): the answer announcer and its hook, rendered (the prompt-slot-settled
 * pattern). The platform's screen-reader calls are mocked; the decisions behind them are covered in
 * logic/__tests__/answer-feedback.test.ts and platform/__tests__/screen-reader.test.ts.
 */
const sr = vi.hoisted(() => ({
  enabled: false,
  listeners: [] as Array<(on: boolean) => void>,
  queued: [] as string[],
  waited: [] as Array<{ text: string; options: unknown }>,
  focused: [] as unknown[],
}));
vi.mock('../../../platform/screen-reader', () => ({
  isScreenReaderEnabled: () => Promise.resolve(sr.enabled),
  subscribeScreenReader: (fn: (on: boolean) => void) => {
    sr.listeners.push(fn);
    return () => {
      sr.listeners.splice(sr.listeners.indexOf(fn), 1);
    };
  },
  announceQueued: (text: string) => {
    // As the real module: iOS only.
    if ((globalThis as { __os?: string }).__os === 'ios') sr.queued.push(text);
  },
  announceAndWait: (text: string, _gap: number, options: unknown) => {
    sr.waited.push({ text, options });
    return Promise.resolve();
  },
  focusForScreenReader: (node: unknown) => {
    sr.focused.push(node);
  },
}));

let api!: AnswerAnnouncement;

function Probe(): ReactElement {
  api = useAnswerAnnouncement();
  return (
    <View>
      <View ref={api.promptRef} testID="prompt" accessibilityRole="header" accessibilityLabel="Question 1 of 4. What does this mean? sagwa" />
      <Pressable testID="answer" onPress={() => undefined} />
      <AnswerAnnouncer line={api.line} />
    </View>
  );
}

const RIGHT = { kind: 'right', item: 'sagwa, apple' } as const;

function on(os: RenderPlatform): void {
  setPlatform(os);
  (globalThis as { __os?: string }).__os = os;
}

beforeEach(() => {
  sr.enabled = false;
  sr.listeners.length = 0;
  sr.queued.length = 0;
  sr.waited.length = 0;
  sr.focused.length = 0;
  useLocaleStore.setState({ screenReader: false });
  on('web');
});

afterEach(() => {
  resetPlatform();
  (globalThis as { __os?: string }).__os = undefined;
  useLocaleStore.setState({ screenReader: false });
  vi.useRealTimers();
});

const region = (r: Awaited<ReturnType<typeof render>>) => byTestId(r.root, 'answer-announcer')[0]!;
const texts = (r: Awaited<ReturnType<typeof render>>): string[] =>
  hostNodes(region(r), () => true)
    .flatMap((n) => n.children)
    .filter((c): c is string => typeof c === 'string');

describe('AnswerAnnouncer (test 7)', () => {
  it('is present and empty before any result, polite, never assertive', async () => {
    const r = await render(<Probe />);
    const node = region(r);
    expect(node.props['aria-live']).toBe('polite');
    expect(texts(r)).toEqual([]);
    expect(JSON.stringify(r.toJSON())).not.toContain('assertive');
    expect(node.props.tabIndex).toBeUndefined();
    await unmount(r);
  });

  it.each([
    ['ios', true],
    ['android', false],
    ['web', false],
  ] as const)('%s: hidden from VoiceOver only on iOS (%s)', async (os, hidden) => {
    on(os);
    const r = await render(<Probe />);
    const announcer = r.root.findByType(AnswerAnnouncer);
    const view = announcer.findByProps({ testID: 'answer-announcer' });
    expect(view.props.accessibilityLiveRegion).toBe('polite');
    expect(view.props.accessibilityElementsHidden === true).toBe(hidden);
    await unmount(r);
  });

  it('its text changes once per result; the same text twice gets a new key; clear() empties it', async () => {
    const r = await render(<Probe />);
    await act(async () => {
      await api.announce(RIGHT);
    });
    expect(texts(r)).toEqual(['Right answer: sagwa, apple.']);
    const first = api.line.key;
    await act(async () => {
      await api.announce(RIGHT);
    });
    expect(texts(r)).toEqual(['Right answer: sagwa, apple.']);
    expect(api.line.key).not.toBe(first);
    await act(async () => {
      api.clear();
    });
    expect(texts(r)).toEqual([]);
    await act(async () => {
      await api.announce({ kind: 'miss', item: 'pear' });
    });
    expect(texts(r)).toEqual(['Not this one: pear. Try another.']);
    await unmount(r);
  });
});

describe('useAnswerAnnouncement (test 8)', () => {
  it('iOS: one queued call per result (reader off), one queued wait per result (reader on)', async () => {
    on('ios');
    const r = await render(<Probe />);
    await act(async () => {
      await api.announce(RIGHT);
    });
    expect(sr.queued).toEqual(['Right answer: sagwa, apple.']);
    expect(sr.waited).toEqual([]);
    await act(async () => {
      sr.listeners.forEach((fn) => fn(true));
    });
    expect(api.readerOn).toBe(true);
    await act(async () => {
      await api.announce({ kind: 'miss', item: 'pear' });
    });
    expect(sr.queued).toEqual(['Right answer: sagwa, apple.']);
    expect(sr.waited).toEqual([{ text: 'Not this one: pear. Try another.', options: { queue: true } }]);
    await unmount(r);
  });

  it.each(['android', 'web'] as const)('%s: no announce call; the region is the channel', async (os) => {
    on(os);
    if (os === 'android') sr.enabled = true;
    else useLocaleStore.setState({ screenReader: true });
    vi.useFakeTimers();
    const r = await render(<Probe />);
    expect(api.readerOn).toBe(true);
    let said = false;
    await act(async () => {
      void api.announce(RIGHT).then(() => {
        said = true;
      });
    });
    expect(texts(r)).toEqual(['Right answer: sagwa, apple.']);
    expect(sr.queued).toEqual([]);
    expect(sr.waited).toEqual([]);
    // Android and the web cannot tell when the line is said: a length-scaled wait (announceWaitMs).
    expect(said).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(said).toBe(true);
    await unmount(r);
  });

  it('follows subscribeScreenReader when the reader is turned on mid-game (native)', async () => {
    on('android');
    const r = await render(<Probe />);
    expect(api.readerOn).toBe(false);
    await act(async () => {
      sr.listeners.forEach((fn) => fn(true));
    });
    expect(api.readerOn).toBe(true);
    await act(async () => {
      sr.listeners.forEach((fn) => fn(false));
    });
    expect(api.readerOn).toBe(false);
    await unmount(r);
  });

  it('the web follows the device flag (OD-AF3 (d)), not the platform reading', async () => {
    sr.enabled = true;
    const r = await render(<Probe />);
    expect(api.readerOn).toBe(false);
    await act(async () => {
      useLocaleStore.setState({ screenReader: true });
    });
    expect(api.readerOn).toBe(true);
    await unmount(r);
  });

  it('focusPrompt() moves focus to the header node, and only with the reader path on', async () => {
    const node = (): Record<string, unknown> => ({ addEventListener: () => undefined, removeEventListener: () => undefined });
    const header = node();
    const r = await render(<Probe />, { createNodeMock: (el) => (el.props['data-testid'] === 'prompt' ? header : node()) });
    await act(async () => {
      api.focusPrompt();
    });
    expect(sr.focused).toEqual([]);
    await act(async () => {
      useLocaleStore.setState({ screenReader: true });
    });
    await act(async () => {
      api.focusPrompt();
    });
    expect(sr.focused).toEqual([header]);
    await unmount(r);
  });

  it('reader off: announce settles at once', async () => {
    const r = await render(<Probe />);
    let said = false;
    await act(async () => {
      await api.announce(RIGHT).then(() => {
        said = true;
      });
    });
    expect(said).toBe(true);
    await unmount(r);
  });
});
