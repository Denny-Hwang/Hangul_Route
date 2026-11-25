import { getMessages } from '@hangul-route/i18n';
import { createElement, useEffect, useRef, Fragment } from 'react';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jamoAll } from '../../../content/jamo';
import { jamoVoice } from '../../../logic/audio/jamo-voice';
import { RESULT_MARK_MIN_MS } from '../../../logic/answer-feedback';
import { SCREEN_SETTLE_MS } from '../../../logic/audio/settle';
import type { DeviceFamily } from '../../../logic/device-family';
import type { MinigameScope } from '../../../logic/minigame-config';
import { useAudioStore } from '../../../store/audio-store';
import { setFirstRoundAnswerListener, useQuestRunStore } from '../../../store/quest-run-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { byTestId, press, render, resetPlatform, setPlatform, textOf, unmount } from '../../../test-support/render';
import { MatchSoundGame } from '../MatchSoundGame';

/**
 * "Can't hear it?" on Match Sound (AMENDMENTS-AUDIO-CANT-HEAR row CH-1a, section 6 tests 11 to 16): the link is there from
 * the first frame, the sheet shows this device's one line, Show the letters brings the round's text (focus first, the
 * letters a beat later, said once) and Hear it plays the prompt once. Over the shipped web audio adapter and the fake
 * voice, as MatchSoundGame.test.tsx. `Modal` is a stand-in that draws its children while visible and reports
 * `onDismiss` when it goes away (react-native-web's needs a document).
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!),
}));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => false }));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async () => undefined),
}));

const device = vi.hoisted(() => ({ family: 'computer' as DeviceFamily }));
vi.mock('../../../platform/device-family', () => ({ currentDeviceFamily: () => device.family }));

const reader = vi.hoisted(() => ({
  log: [] as string[],
  focused: [] as unknown[],
  announced: [] as string[],
  waited: [] as string[],
  wait: null as Promise<void> | null,
}));
vi.mock('../../../platform/screen-reader', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  // react-native-web answers "a screen reader is on" on every platform; these tests are the reader-off path (F-A11Y-001 AF-4a).
  isScreenReaderEnabled: () => Promise.resolve(false),
  subscribeScreenReader: () => () => undefined,
  focusForScreenReader: (node: { testId?: string } | null) => {
    reader.focused.push(node);
    reader.log.push(`focus:${node?.testId ?? 'none'}`);
  },
  announceForScreenReader: (text: string) => {
    reader.announced.push(text);
    reader.log.push('announce');
  },
  announceAndWait: async (text: string) => {
    reader.waited.push(text);
    reader.log.push('wait');
    await reader.wait;
    reader.log.push('waited');
  },
}));

const modal = vi.hoisted(() => ({ reportsDismiss: true }));
vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-native')>();
  const Modal = ({ visible, children, onDismiss }: { visible?: boolean; children?: unknown; onDismiss?: () => void }) => {
    const was = useRef(false);
    useEffect(() => {
      if (was.current && !visible && modal.reportsDismiss) onDismiss?.();
      was.current = visible === true;
    }, [visible, onDismiss]);
    return visible === true ? createElement(Fragment, null, children as never) : null;
  };
  return { ...actual, Modal };
});

const T = getMessages('en').learner.audio;
const L1 = ['jamo:a', 'jamo:eo', 'jamo:giyeok', 'jamo:nieun'];
const NAME_OF = new Map(
  jamoAll.filter((j) => L1.includes(j.id)).flatMap((j) => [[jamoVoice(j, 'sound').text, j.id] as const, [jamoVoice(j, 'letter').text, j.id] as const]),
);
const mounted: ReactTestRenderer[] = [];
/** Refs the test reads: the speaker, the link and the sheet's title, as a node that takes focus and listeners (react-test-renderer gives refs null). */
const FOCUS_TARGETS = new Set(['match-sound-speaker', 'cant-hear', 'cant-hear-sheet-title']);
const nodeMock = (el: { props?: Record<string, unknown> }): object | null => {
  const testId = el.props?.['data-testid'];
  return typeof testId === 'string' && FOCUS_TARGETS.has(testId)
    ? { testId, focus: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined, setAttribute: () => undefined, removeAttribute: () => undefined }
    : null;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-24T09:00:00Z'));
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false, voiceCheckPending: false });
  useQuestRunStore.getState().reset();
  device.family = 'computer';
  modal.reportsDismiss = true;
  reader.log.length = 0;
  reader.focused.length = 0;
  reader.announced.length = 0;
  reader.waited.length = 0;
  reader.wait = null;
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  resetPlatform();
  vi.useRealTimers();
  useAudioStore.setState({ muted: false, voiceCheckPending: false });
});

const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const spoken = (): string[] => rig.current!.synth.spoken.map((u) => u.text);
const host = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id)[0];
  if (!node) throw new Error(`no ${id}`);
  return node;
};
const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};
const has = (root: ReactTestInstance, id: string): boolean => byTestId(root, id).length > 0;
/** A button's accessible name (its label; `textOf` leaves out the text that equals it). */
const nameOf = (root: ReactTestInstance, id: string): string => String(host(root, id).props['aria-label'] ?? '');
/** The link is drawn greyed (`softDisabled`) while the round holds. */
const looksInactive = (root: ReactTestInstance): boolean => host(root, 'cant-hear').props.style.opacity === 0.6;
/** Taps the link; focus lands on the sheet's title, and the log is cleared for what follows. */
async function openSheet(r: ReactTestRenderer): Promise<void> {
  await press(pressable(r.root, 'cant-hear'));
  expect(reader.log).toEqual(['focus:cant-hear-sheet-title']);
  reader.log.length = 0;
}
const tile = (root: ReactTestInstance, jamoId: string): ReactTestInstance => pressable(root, `match-sound-tile-${jamoId}`);

async function open(rounds = 2, ready = true): Promise<ReactTestRenderer> {
  const scope: MinigameScope = { kind: 'match-sound', jamoIds: L1, rounds, focusJamoIds: ['jamo:nieun'] };
  const r = await render(<MatchSoundGame scope={scope} onFinish={() => undefined} />, { createNodeMock: nodeMock as never });
  mounted.push(r);
  if (ready) await tick(SCREEN_SETTLE_MS);
  return r;
}

describe('the link (test 11)', () => {
  it('is in the speaker row on round 1 before any tap, and is active once the voice check is over', async () => {
    const r = await open();
    expect(has(r.root, 'cant-hear')).toBe(true);
    expect(nameOf(r.root, 'cant-hear')).toBe(T.cantHear.cta);
    expect(looksInactive(r.root)).toBe(false);
    // It follows the speaker and its caption in the speaker row, and comes before the answers.
    const order = r.root.findAll((n) => typeof n.type === 'string' && ['match-sound-speaker', 'cant-hear', 'match-sound-tiles'].includes(String(n.props['data-testid'])));
    expect(order.map((n) => n.props['data-testid'])).toEqual(['match-sound-speaker', 'cant-hear', 'match-sound-tiles']);
  });

  it('is drawn but inactive while the voice check holds, takes no tap, and turns active when it ends', async () => {
    useAudioStore.setState({ voiceCheckPending: true });
    const r = await open(2, false);
    expect(has(r.root, 'cant-hear')).toBe(true);
    expect(looksInactive(r.root)).toBe(true);
    if (typeof host(r.root, 'cant-hear').props.onClick === 'function') await press(host(r.root, 'cant-hear'));
    expect(has(r.root, 'cant-hear-sheet')).toBe(false);
    await act(async () => {
      useAudioStore.setState({ voiceCheckPending: false });
    });
    expect(looksInactive(r.root)).toBe(false);
  });
});

describe('the sheet (test 11)', () => {
  it.each<[DeviceFamily, string]>([
    ['apple', T.cantHear.lines.apple],
    ['android', T.cantHear.lines.android],
    ['computer', T.cantHear.lines.computer],
  ])('%s: the title, the close button, one line for this device, Show the letters and Hear it', async (family, line) => {
    device.family = family;
    const r = await open();
    await openSheet(r);
    const sheet = host(r.root, 'cant-hear-sheet');
    const text = textOf(sheet);
    expect(text).toContain(T.cantHear.cta);
    expect(textOf(host(r.root, 'cant-hear-line'))).toBe(line);
    for (const other of ['apple', 'android', 'computer'] as const) {
      if (other !== family) expect(text).not.toContain(T.cantHear.lines[other]);
    }
    expect(has(r.root, 'cant-hear-sheet-close')).toBe(true);
    expect(nameOf(r.root, 'cant-hear-show-letters')).toBe(T.cantHear.showLetters.cta);
    expect(nameOf(r.root, 'cant-hear-hear')).toBe(T.hearIt.cta);
  });

  it('the scrim is not an accessibility element: hidden, not focusable, no role', async () => {
    const r = await open();
    await openSheet(r);
    const scrim = host(r.root, 'cant-hear-sheet-scrim');
    expect(scrim.props['aria-hidden']).toBe(true);
    expect(scrim.props.role).toBeUndefined();
    expect(scrim.props.tabIndex).toBe(-1);
    expect(scrim.props['aria-label']).toBeUndefined();
  });

  it('is a dialog named by its title', async () => {
    const r = await open();
    await openSheet(r);
    const dialog = r.root.findAll((n) => typeof n.type === 'string' && n.props.role === 'dialog')[0]!;
    expect(dialog.props['aria-modal']).toBe(true);
    const labelled = dialog.props['aria-labelledby'] as string;
    expect(r.root.findAll((n) => typeof n.type === 'string' && n.props.id === labelled)).toHaveLength(1);
  });

  it('the close button closes it and changes nothing else: no answer, the link still there, focus returns to it', async () => {
    const r = await open();
    await openSheet(r);
    await press(pressable(r.root, 'cant-hear-sheet-close'));
    await tick(0);
    expect(has(r.root, 'cant-hear-sheet')).toBe(false);
    expect(has(r.root, 'cant-hear')).toBe(true);
    expect(reader.log).toContain('focus:cant-hear');
    expect(useQuestRunStore.getState().answersGiven).toBe(0);
  });

  it('the scrim closes it too', async () => {
    const r = await open();
    await openSheet(r);
    await press(pressable(r.root, 'cant-hear-sheet-scrim'));
    expect(has(r.root, 'cant-hear-sheet')).toBe(false);
  });
});

describe('Show the letters (test 12)', () => {
  it('the sheet closes, focus moves to the speaker, and a beat later the letter name and its romanization come up, said once', async () => {
    setPlatform('ios');
    const r = await open();
    await openSheet(r);
    await press(pressable(r.root, 'cant-hear-show-letters'));
    await tick(0);
    expect(has(r.root, 'cant-hear-sheet')).toBe(false);
    // Focus first; nothing is on screen or said yet.
    expect(reader.log).toEqual(['focus:match-sound-speaker']);
    expect(has(r.root, 'prompt-panel-text')).toBe(false);
    await tick(319);
    expect(has(r.root, 'prompt-panel-text')).toBe(false);
    expect(reader.announced).toEqual([]);
    await tick(1);
    expect(reader.log).toEqual(['focus:match-sound-speaker', 'announce']);
    const panel = textOf(host(r.root, 'prompt-panel'));
    expect(panel).toContain('니은');
    expect(panel).toContain('nieun');
    expect(panel).toContain(T.readHere);
    expect(panel).not.toContain(T.soundIsOff);
    expect(reader.announced).toHaveLength(1);
    expect(reader.announced[0]).toContain('니은');
    expect(reader.announced[0]).toContain('nieun');
    // The text heading, no link, no reason line or action.
    expect(textOf(r.root)).toContain(T.heading.text);
    expect(has(r.root, 'cant-hear')).toBe(false);
    expect(has(r.root, 'prompt-panel-detail')).toBe(false);
    expect(has(r.root, 'prompt-panel-action')).toBe(false);
  });

  it('on the web the same order holds (the modal is gone, then focus, then the text)', async () => {
    const r = await open();
    await openSheet(r);
    await press(pressable(r.root, 'cant-hear-show-letters'));
    await tick(0);
    expect(reader.log).toEqual(['focus:match-sound-speaker']);
    await tick(320);
    expect(textOf(host(r.root, 'prompt-panel'))).toContain('nieun');
    expect(reader.announced).toHaveLength(1);
  });

  it('a right tap answers once (hinted, CH-1f, below); the next round opens with no text and the link back', async () => {
    const r = await open();
    await openSheet(r);
    await press(pressable(r.root, 'cant-hear-show-letters'));
    await tick(400);
    expect(has(r.root, 'cant-hear')).toBe(false);
    await press(tile(r.root, 'jamo:nieun'));
    expect(useQuestRunStore.getState().answersGiven).toBe(1);
    await tick(RESULT_MARK_MIN_MS);
    expect(textOf(r.root)).toContain(T.heading.listen);
    expect(has(r.root, 'prompt-panel-text')).toBe(false);
    expect(has(r.root, 'cant-hear')).toBe(true);
  });

  it('Show the letters opens no telemetry fallback: it is not a failure', async () => {
    const r = await open();
    const before = rig.current!.synth.spoken.length;
    await openSheet(r);
    await press(pressable(r.root, 'cant-hear-show-letters'));
    await tick(400);
    // Nothing was played by the ask itself.
    expect(rig.current!.synth.spoken.length).toBe(before);
    expect(useQuestRunStore.getState().answersGiven).toBe(0);
  });
});

describe('the link in the states that already show a text (test 13)', () => {
  it('sound off: no link', async () => {
    useAudioStore.setState({ muted: true });
    const r = await open();
    expect(has(r.root, 'cant-hear')).toBe(false);
    expect(textOf(host(r.root, 'prompt-panel'))).toContain(T.soundIsOff);
  });

  it('no Korean voice: no link', async () => {
    rig.current = createAudioRig({ voices: [] });
    const r = await open();
    expect(has(r.root, 'cant-hear')).toBe(false);
    expect(textOf(host(r.root, 'prompt-panel'))).toContain(T.noKoreanVoiceSentence);
  });

  it('a failed play (error) and a blocked play: the link goes', async () => {
    for (const mode of ['error', 'blocked'] as const) {
      rig.current = createAudioRig({ voices: [KO_VOICE], requireGesture: mode === 'blocked' });
      if (mode === 'error') rig.current.synth.speak = () => { throw new Error('no speech'); };
      const r = await open();
      await tick(2_000);
      expect(has(r.root, 'cant-hear'), mode).toBe(false);
      await unmount(r);
    }
  });

  it('with the sheet open, a capability change to no Korean voice closes it, and so does turning the sound off', async () => {
    const r = await open();
    await openSheet(r);
    expect(has(r.root, 'cant-hear-sheet')).toBe(true);
    await act(async () => {
      useAudioStore.setState({ tts: { state: 'none', reason: 'no_korean_voice' } });
    });
    expect(has(r.root, 'cant-hear-sheet')).toBe(false);
    expect(has(r.root, 'cant-hear')).toBe(false);
    await unmount(r);

    useAudioStore.setState({ tts: { state: 'ready', voiceId: 'v', voiceName: 'Yuna', local: true, quality: 'standard' } });
    const again = await open();
    await openSheet(again);
    await act(async () => {
      useAudioStore.setState({ muted: true });
    });
    expect(has(again.root, 'cant-hear-sheet')).toBe(false);
    expect(has(again.root, 'cant-hear')).toBe(false);
  });
});

describe('Hear it (test 14)', () => {
  it('closes the sheet, returns focus to the link, waits for its name to be said, then plays the prompt once; no answer', async () => {
    const r = await open();
    expect(spoken()).toEqual(['니은']);
    let release: () => void = () => undefined;
    reader.wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    await openSheet(r);
    await press(pressable(r.root, 'cant-hear-hear'));
    await tick(0);
    expect(has(r.root, 'cant-hear-sheet')).toBe(false);
    expect(reader.log).toEqual(['focus:cant-hear', 'wait']);
    expect(reader.waited).toEqual([T.cantHear.cta]);
    // Not before the name has been said.
    await tick(2_000);
    expect(spoken()).toEqual(['니은']);
    await act(async () => {
      release();
    });
    await tick(0);
    expect(spoken()).toEqual(['니은', '니은']);
    expect(useQuestRunStore.getState().answersGiven).toBe(0);
    // The link stays, and the round is still a sound round.
    expect(has(r.root, 'cant-hear')).toBe(true);
    expect(has(r.root, 'prompt-panel-text')).toBe(false);
  });

  it('with no screen reader it plays at once', async () => {
    const r = await open();
    await openSheet(r);
    await press(pressable(r.root, 'cant-hear-hear'));
    await tick(0);
    expect(spoken()).toEqual(['니은', '니은']);
  });

  it('a round that changes while it waits is not told the old prompt', async () => {
    const r = await open();
    let release: () => void = () => undefined;
    reader.wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    await openSheet(r);
    await press(pressable(r.root, 'cant-hear-hear'));
    await tick(0);
    await press(tile(r.root, 'jamo:nieun'));
    await tick(RESULT_MARK_MIN_MS);
    const before = spoken().length;
    await act(async () => {
      release();
    });
    await tick(0);
    expect(spoken().length).toBe(before);
  });
});

describe('a wrong tap after Show the letters (test 15)', () => {
  it('the tile takes the wrong state (never the danger colour), and the 800 ms replay is scheduled', async () => {
    const r = await open();
    await openSheet(r);
    await press(pressable(r.root, 'cant-hear-show-letters'));
    await tick(400);
    const before = spoken().length;
    await press(tile(r.root, 'jamo:a'));
    // Locked, not disabled (F-A11Y-001 AF-4a): a focusable button that still shows the miss.
    expect(byTestId(r.root, 'match-sound-tile-jamo:a').some((n) => n.props['aria-disabled'] === true)).toBe(false);
    expect(JSON.stringify(r.toJSON())).not.toContain('#C0392B');
    await tick(799);
    expect(spoken().length).toBe(before);
    await tick(2);
    expect(spoken().length).toBe(before + 1);
  });
});

describe('the round changes while the sheet is open (test 16)', () => {
  it('closes it, so Show the letters always acts on the round on screen', async () => {
    const r = await open();
    await openSheet(r);
    expect(has(r.root, 'cant-hear-sheet')).toBe(true);
    // The tiles sit under the scrim in the test tree; a right tap advances the round after the 1000 ms result floor.
    await press(tile(r.root, 'jamo:nieun'));
    await tick(RESULT_MARK_MIN_MS);
    expect(has(r.root, 'cant-hear-sheet')).toBe(false);
    expect(has(r.root, 'cant-hear')).toBe(true);
  });

  it('a Show the letters still waiting for its beat does not show the next round\'s text', async () => {
    const r = await open();
    await openSheet(r);
    await press(pressable(r.root, 'cant-hear-show-letters'));
    await tick(0);
    await press(tile(r.root, 'jamo:nieun'));
    await tick(RESULT_MARK_MIN_MS);
    await tick(1_000);
    expect(has(r.root, 'prompt-panel-text')).toBe(false);
    expect(has(r.root, 'cant-hear')).toBe(true);
  });
});

describe('the step after the sheet waits for the modal to go (iOS and the web), with a fallback', () => {
  it('goes on after the fallback wait if the modal never reports onDismiss', async () => {
    setPlatform('ios');
    modal.reportsDismiss = false;
    const r = await open();
    await openSheet(r);
    await press(pressable(r.root, 'cant-hear-sheet-close'));
    await tick(599);
    expect(reader.log).toEqual([]);
    await tick(1);
    expect(reader.log).toEqual(['focus:cant-hear']);
  });

  it('goes on at once when the modal reports onDismiss, and the fallback then does nothing more', async () => {
    setPlatform('ios');
    const r = await open();
    await openSheet(r);
    await press(pressable(r.root, 'cant-hear-sheet-close'));
    await tick(0);
    expect(reader.log).toEqual(['focus:cant-hear']);
    await tick(2_000);
    expect(reader.log).toEqual(['focus:cant-hear']);
  });

  it('a sheet opened again within the wait drops the old fallback: it never fires the new action early', async () => {
    setPlatform('ios');
    modal.reportsDismiss = false;
    const r = await open();
    await openSheet(r);
    await press(pressable(r.root, 'cant-hear-sheet-close'));
    await tick(300);
    expect(reader.log).toEqual([]);
    // Opened again before the first wait is over, then Hear it: its own wait starts now.
    await openSheet(r);
    await press(pressable(r.root, 'cant-hear-hear'));
    // The first wait would end here (600 ms after its close): it must not run Hear it.
    await tick(300);
    expect(reader.log).toEqual([]);
    expect(reader.waited).toEqual([]);
    // The second wait ends 600 ms after its own close.
    await tick(300);
    expect(reader.log).toEqual(['focus:cant-hear', 'wait', 'waited']);
    expect(reader.waited).toEqual([T.cantHear.cta]);
    // Run once: no second focus or wait from either timer.
    await tick(2_000);
    expect(reader.log).toEqual(['focus:cant-hear', 'wait', 'waited']);
  });

  it('a round that changes during the wait drops the fallback', async () => {
    setPlatform('ios');
    modal.reportsDismiss = false;
    const r = await open();
    await openSheet(r);
    // A right tap: the next round opens 1000 ms later (the result floor).
    await press(tile(r.root, 'jamo:nieun'));
    await tick(700);
    // Closed now, its wait would end at 1300 ms; the round changes at 1000 ms and takes it away.
    await press(pressable(r.root, 'cant-hear-sheet-close'));
    await tick(300);
    await tick(2_000);
    expect(reader.log).toEqual([]);
  });

  it('Android has no onDismiss: it goes on as soon as the sheet is closed', async () => {
    setPlatform('android');
    modal.reportsDismiss = false;
    const r = await open();
    await openSheet(r);
    await press(pressable(r.root, 'cant-hear-sheet-close'));
    await tick(0);
    expect(reader.log).toEqual(['focus:cant-hear']);
  });
});

describe('Always show the letters (CH-2, test 23)', () => {
  beforeEach(() => {
    useAudioStore.setState({ showLetters: true });
  });
  afterEach(() => {
    useAudioStore.setState({ showLetters: false });
  });

  it('every round opens with the letter name and its romanization, the text heading and no link, and the sound still plays', async () => {
    const r = await open();
    const panel = textOf(host(r.root, 'prompt-panel'));
    expect(panel).toContain('nieun');
    expect(panel).toContain(T.readHere);
    expect(panel).not.toContain(T.soundIsOff);
    expect(textOf(r.root)).toContain(T.heading.text);
    expect(has(r.root, 'cant-hear')).toBe(false);
    expect(has(r.root, 'prompt-panel-detail')).toBe(false);
    expect(has(r.root, 'prompt-panel-action')).toBe(false);
    // Not the tile: no option is printed by the switch.
    expect(spoken().length).toBeGreaterThan(0);
  });

  it('the answers are not held: nothing comes in above them while the voice check runs', async () => {
    useAudioStore.setState({ voiceCheckPending: true });
    const r = await open(2, false);
    expect(has(r.root, 'match-sound-tiles')).toBe(true);
    expect(has(r.root, 'prompt-panel-text')).toBe(true);
  });

  it('a right tap is a plain right answer and the next round opens with the text again', async () => {
    const r = await open();
    await press(tile(r.root, 'jamo:nieun'));
    expect(useQuestRunStore.getState().answersGiven).toBe(1);
    await tick(RESULT_MARK_MIN_MS);
    expect(has(r.root, 'prompt-panel-text')).toBe(true);
    expect(has(r.root, 'cant-hear')).toBe(false);
  });

  it('turned off, the next round is sound-only again with the link', async () => {
    const r = await open();
    expect(has(r.root, 'cant-hear')).toBe(false);
    await act(async () => {
      useAudioStore.getState().setShowLetters(false);
    });
    expect(has(r.root, 'cant-hear')).toBe(true);
    expect(has(r.root, 'prompt-panel-text')).toBe(false);
  });

  it('Sound off still shows its own panel with Turn sound on', async () => {
    useAudioStore.setState({ muted: true });
    const r = await open();
    expect(textOf(host(r.root, 'prompt-panel'))).toContain(T.soundIsOff);
    expect(has(r.root, 'cant-hear')).toBe(false);
  });
});

/**
 * The hinted mark (AMENDMENTS-AUDIO-CANT-HEAR row CH-1f, section 3.13, test 22): a right first answer after the learner's own
 * Show the letters reaches the memory store as hinted; a wrong first answer stays a plain miss; text from Sound off, no voice,
 * a failed play or "Always show the letters" stays unmarked; the stars are what `correct` made them. The memory store listens
 * to the run store's first-answer listener, which is read here.
 */
describe('the hinted mark (CH-1f, test 22)', () => {
  const seen: Array<{ correct: boolean; hinted: boolean }> = [];
  beforeEach(() => {
    seen.length = 0;
    useQuestRunStore.getState().beginQuest('q:ch-1f', 'ep:ch-1f');
    setFirstRoundAnswerListener((a) => void seen.push({ correct: a.correct, hinted: a.hinted === true }));
  });
  afterEach(() => {
    setFirstRoundAnswerListener(null);
  });
  const ask = async (r: ReactTestRenderer): Promise<void> => {
    await openSheet(r);
    await press(pressable(r.root, 'cant-hear-show-letters'));
    await tick(400);
  };

  it('asked, then the right tile first: hinted; the quest counts it right', async () => {
    const r = await open();
    await ask(r);
    await press(tile(r.root, 'jamo:nieun'));
    expect(seen).toEqual([{ correct: true, hinted: true }]);
    expect(useQuestRunStore.getState()).toMatchObject({ correctCount: 1, totalCount: 1 });
  });

  it('asked, then a wrong tile first: a plain miss, even when the right tile follows', async () => {
    const r = await open();
    await ask(r);
    await press(tile(r.root, 'jamo:a'));
    await press(tile(r.root, 'jamo:nieun'));
    expect(seen).toEqual([{ correct: false, hinted: false }]);
    expect(useQuestRunStore.getState()).toMatchObject({ correctCount: 0, totalCount: 1 });
  });

  it('not asked: a right first tap is an ordinary right answer', async () => {
    const r = await open();
    await press(tile(r.root, 'jamo:nieun'));
    expect(seen).toEqual([{ correct: true, hinted: false }]);
  });

  it('the ask is for one round: the next round, answered without it, is unmarked', async () => {
    const r = await open();
    await ask(r);
    await press(tile(r.root, 'jamo:nieun'));
    await tick(RESULT_MARK_MIN_MS);
    const second = NAME_OF.get(spoken().at(-1) ?? '');
    expect(second).toBeDefined();
    await press(tile(r.root, second as string));
    expect(seen.map((a) => a.hinted)).toEqual([true, false]);
  });

  it('Sound off, no Korean voice, a failed play and "Always show the letters" show text without the ask: unmarked', async () => {
    useAudioStore.setState({ muted: true });
    const off = await open();
    await press(tile(off.root, 'jamo:nieun'));
    await unmount(off);
    useAudioStore.setState({ muted: false });
    rig.current = createAudioRig({ voices: [] });
    useQuestRunStore.getState().beginQuest("q:ch-1f", "ep:ch-1f");
    const none = await open();
    await press(tile(none.root, 'jamo:nieun'));
    await unmount(none);
    rig.current = createAudioRig({ voices: [KO_VOICE] });
    rig.current.synth.speak = () => {
      throw new Error('no speech');
    };
    useQuestRunStore.getState().beginQuest("q:ch-1f", "ep:ch-1f");
    const failed = await open();
    await tick(2_000);
    expect(has(failed.root, 'prompt-panel-text')).toBe(true);
    await press(tile(failed.root, 'jamo:nieun'));
    await unmount(failed);
    rig.current = createAudioRig({ voices: [KO_VOICE] });
    useAudioStore.setState({ showLetters: true });
    useQuestRunStore.getState().beginQuest("q:ch-1f", "ep:ch-1f");
    const always = await open();
    expect(has(always.root, 'prompt-panel-text')).toBe(true);
    await press(tile(always.root, 'jamo:nieun'));
    useAudioStore.setState({ showLetters: false });
    expect(seen).toEqual([
      { correct: true, hinted: false },
      { correct: true, hinted: false },
      { correct: true, hinted: false },
      { correct: true, hinted: false },
    ]);
  });
});
