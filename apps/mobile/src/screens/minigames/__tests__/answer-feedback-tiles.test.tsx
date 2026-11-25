import { HoyaBubble, Icon } from '@hangul-route/design-system';
import { a11yRomanization } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jamoAll } from '../../../content/jamo';
import { answerAnnouncement, RESULT_MARK_MIN_MS, type AnswerResult } from '../../../logic/answer-feedback';
import { jamoVoice } from '../../../logic/audio/jamo-voice';
import { SCREEN_SETTLE_MS } from '../../../logic/audio/settle';
import type { MinigameScope } from '../../../logic/minigame-config';
import { useAudioStore } from '../../../store/audio-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { byTestId, hostNodes, press, render, resetPlatform, screenTexts, setPlatform, textOf, unmount, type RenderPlatform } from '../../../test-support/render';
import { MatchSoundGame } from '../MatchSoundGame';
import { OddOneOutGame } from '../OddOneOutGame';

/**
 * F-A11Y-001 row AF-4a (§6 test 14): Match Sound and Odd One Out draw a `check` on the right tile and a `replay` on a
 * locked miss, name the state first, never disable a locked tile, say each result once through the answer announcer,
 * wait the 1000 ms floor with the reader off (Odd One Out on `pacing.after`, dropped on unmount), and with the reader on
 * show Next (OD-AF9 (b)), last round included, with focus on the round's header node. Build a Letter is
 * `answer-feedback-build-letter.test.tsx`.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

/** `log` is one ordered record of the focus moves and the queued-and-awaited iOS lines. */
const sr = vi.hoisted(() => ({ enabled: false, queued: [] as string[], focused: [] as unknown[], log: [] as string[] }));
vi.mock('../../../platform/screen-reader', async (orig) => ({
  ...(await orig<object>()),
  isScreenReaderEnabled: () => Promise.resolve(sr.enabled),
  subscribeScreenReader: () => () => undefined,
  announceQueued: (text: string) => {
    if ((globalThis as { __os?: string }).__os === 'ios') sr.queued.push(text);
  },
  announceAndWait: (text: string) => {
    sr.log.push(`announce: ${text}`);
    return Promise.resolve();
  },
  focusForScreenReader: (node: unknown) => {
    sr.focused.push(node);
    sr.log.push(`focus: ${(node as { testID?: string } | null)?.testID}`);
  },
}));

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!),
}));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => false }));
vi.mock('../../../platform/telemetry', async (orig) => ({ ...(await orig<object>()), track: vi.fn(async () => undefined) }));
vi.mock('../../../platform/haptics', async (orig) => ({ ...(await orig<object>()), nudge: () => undefined, success: () => undefined, tapLight: () => undefined }));

const m = getMessages('en');
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
const L1 = ['jamo:a', 'jamo:eo', 'jamo:giyeok', 'jamo:nieun'];
const NAME_OF = new Map(
  jamoAll.filter((j) => L1.includes(j.id)).flatMap((j) => [[jamoVoice(j, 'sound').text, j.id] as const, [jamoVoice(j, 'letter').text, j.id] as const]),
);
/** What a jamo tile is named by once answered: its sound value (§3.2). */
const soundOf = (id: string): string => a11yRomanization(jamoAll.find((j) => j.id === id)!.romanization, m.a11y.romanizationOr);
const MATCH = (rounds: number): MinigameScope => ({ kind: 'match-sound', jamoIds: L1, rounds });
const ODD = (rounds: number): MinigameScope => ({ kind: 'odd-one-out', jamoIds: ['jamo:a', 'jamo:eo', 'jamo:o', 'jamo:giyeok'], rounds });

const mounted: ReactTestRenderer[] = [];
/** Refs hand back a tagged object per testID, so a focus move can be told from another. */
const nodeMock = (el: { props: Record<string, unknown> }): unknown => ({
  testID: el.props['data-testid'],
  focus: () => undefined,
  nodeType: 1,
  getBoundingClientRect: () => ({ height: 0, left: 0, top: 0, width: 0 }),
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  setAttribute: () => undefined,
  removeAttribute: () => undefined,
});
const open = async (element: React.ReactElement): Promise<ReactTestRenderer> => {
  const r = await render(element, { createNodeMock: nodeMock });
  mounted.push(r);
  return r;
};
const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const on = (os: RenderPlatform): void => {
  setPlatform(os);
  (globalThis as { __os?: string }).__os = os;
};
const readerOnWeb = (): void => useLocaleStore.setState({ screenReader: true });

const pressable = (r: ReactTestRenderer, id: string): ReactTestInstance => {
  const node = byTestId(r.root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};
const host = (r: ReactTestRenderer, id: string): ReactTestInstance => {
  const node = byTestId(r.root, id)[0];
  if (!node) throw new Error(`no ${id}`);
  return node;
};
const marks = (node: ReactTestInstance): string[] => node.findAll((n) => n.type === Icon).map((n) => String(n.props.name));
const announced = (r: ReactTestRenderer): string[] =>
  hostNodes(host(r, 'answer-announcer'), () => true)
    .flatMap((n) => n.children)
    .filter((c): c is string => typeof c === 'string');
const bubbleLive = (r: ReactTestRenderer): boolean[] => r.root.findAllByType(HoyaBubble).map((b) => b.props.live !== false);
const line = (result: AnswerResult): string => answerAnnouncement(result, m.a11y).map((x) => x.text).join('');
/** A locked tile is `inactive` (claimed by the board, focusable), never `disabled`: no host of it says `aria-disabled`. */
const disabled = (r: ReactTestRenderer, id: string): boolean => byTestId(r.root, id).some((n) => n.props['aria-disabled'] === true);
const onRound = (r: ReactTestRenderer, n: number, of: number): boolean => screenTexts(r.root).includes(m.learner.minigame.progress.pill(n, of));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-24T09:00:00Z'));
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
  useQuestRunStore.getState().reset();
  sr.enabled = false;
  sr.queued.length = 0;
  sr.focused.length = 0;
  sr.log.length = 0;
  useLocaleStore.setState({ screenReader: false });
  on('web');
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
  resetPlatform();
  (globalThis as { __os?: string }).__os = undefined;
  useAudioStore.setState({ muted: false });
  useLocaleStore.setState({ screenReader: false });
});

describe('Match Sound answers (test 14)', () => {
  const tileId = (id: string): string => `match-sound-tile-${id}`;
  const spoken = (): string[] => rig.current!.synth.spoken.map((u) => u.text);
  const play = async (scope: MinigameScope, onFinish: () => void = () => undefined): Promise<ReactTestRenderer> => {
    const r = await open(<MatchSoundGame scope={scope} onFinish={onFinish} />);
    await tick(SCREEN_SETTLE_MS);
    return r;
  };
  /** The tile the round asks for, from what was said. */
  const target = (): string => NAME_OF.get(spoken().at(-1)!)!;
  const wrongOne = (): string => L1.find((id) => id !== target())!;

  it('the right tile shows check and is named "Right answer: {sound}"; a locked miss shows replay, is named "Not this one: …" and is not disabled', async () => {
    const r = await play(MATCH(2));
    const right = target();
    const wrong = wrongOne();
    expect(marks(host(r, tileId(wrong)))).toEqual([]);
    await press(pressable(r, tileId(wrong)));
    const miss = pressable(r, tileId(wrong));
    expect(marks(miss)).toEqual(['replay']);
    expect(miss.props['aria-label']).toBe(m.a11y.minigame.option.wrong(soundOf(wrong)));
    expect(disabled(r, tileId(wrong))).toBe(false);
    await press(pressable(r, tileId(right)));
    const good = pressable(r, tileId(right));
    expect(marks(good)).toEqual(['check']);
    expect(good.props['aria-label']).toBe(m.a11y.minigame.option.correct(soundOf(right)));
    expect(disabled(r, tileId(right))).toBe(false);
  });

  it('an unanswered tile keeps its plain name and has no mark', async () => {
    const r = await play(MATCH(2));
    const id = L1[0]!;
    expect(pressable(r, tileId(id)).props['aria-label']).toBe(m.a11y.tile(soundOf(id)));
    expect(marks(host(r, tileId(id)))).toEqual([]);
  });

  it("the announcer says each result once: a miss \"Listen again\", then the right sound; Hoya's miss bubble is not live", async () => {
    const r = await play(MATCH(2));
    expect(announced(r)).toEqual([]);
    const right = target();
    const wrong = wrongOne();
    expect(bubbleLive(r)).toEqual([]);
    await press(pressable(r, tileId(wrong)));
    expect(announced(r)).toEqual([line({ kind: 'missListen', item: soundOf(wrong) })]);
    expect(bubbleLive(r)).toEqual([false]);
    await press(pressable(r, tileId(right)));
    expect(announced(r)).toEqual([line({ kind: 'right', item: soundOf(right) })]);
    expect(announced(r)[0]).not.toMatch(HANGUL);
  });

  it('iOS: one queued call per result', async () => {
    on('ios');
    const r = await play(MATCH(2));
    const right = target();
    const wrong = wrongOne();
    await press(pressable(r, tileId(wrong)));
    await press(pressable(r, tileId(right)));
    expect(sr.queued).toEqual([line({ kind: 'missListen', item: soundOf(wrong) }), line({ kind: 'right', item: soundOf(right) })]);
  });

  it('reader off: the next round comes after the floor (not at 700 ms), and focus does not move', async () => {
    const r = await play(MATCH(2));
    await press(pressable(r, tileId(target())));
    await tick(RESULT_MARK_MIN_MS - 1);
    expect(spoken()).toHaveLength(1);
    await tick(1);
    expect(spoken()).toHaveLength(2);
    expect(sr.focused).toEqual([]);
    expect(announced(r)).toEqual([]);
    expect(byTestId(r.root, 'match-sound-next')).toEqual([]);
  });

  it('reader off: the last right answer ends the step after the floor, once; leaving the game first ends nothing', async () => {
    const finish = vi.fn();
    const r = await play(MATCH(1), finish);
    await press(pressable(r, tileId(target())));
    await tick(RESULT_MARK_MIN_MS - 1);
    expect(finish).not.toHaveBeenCalled();
    await tick(1);
    expect(finish).toHaveBeenCalledTimes(1);

    const gone = vi.fn();
    const g = await play(MATCH(1), gone);
    await press(pressable(g, tileId(target())));
    await unmount(g);
    await tick(RESULT_MARK_MIN_MS * 3);
    expect(gone).not.toHaveBeenCalled();
  });

  it('reader off: a miss still replays the prompt after 800 ms', async () => {
    const r = await play(MATCH(2));
    const first = spoken().length;
    await press(pressable(r, tileId(wrongOne())));
    await tick(800);
    expect(spoken()).toHaveLength(first + 1);
  });

  it('reader on: nothing plays by itself after a miss; the learner taps Hear it', async () => {
    readerOnWeb();
    const r = await play(MATCH(2));
    const said = spoken().length;
    await press(pressable(r, tileId(wrongOne())));
    await tick(5_000);
    expect(spoken()).toHaveLength(said);
    const hear = byTestId(r.root, 'match-sound-bubble')[0]!.findAll((n) => typeof n.type === 'string' && n.props.role === 'button' && typeof n.props.onClick === 'function')[0]!;
    await press(hear);
    await tick(0);
    expect(spoken()).toHaveLength(said + 1);
  });

  it('reader on: Next takes focus, nothing moves on by itself, then focus goes to the header node (no Hangul in its name)', async () => {
    readerOnWeb();
    const r = await play(MATCH(2));
    const right = target();
    const wrong = wrongOne();
    await press(pressable(r, tileId(wrong)));
    expect(byTestId(r.root, 'match-sound-next')).toEqual([]);
    await press(pressable(r, tileId(right)));
    expect(byTestId(r.root, 'match-sound-next').length).toBeGreaterThan(0);
    expect(sr.focused).toEqual([expect.objectContaining({ testID: 'match-sound-next' })]);
    await tick(60_000);
    expect(onRound(r, 1, 2)).toBe(true);
    expect(announced(r)).toEqual([line({ kind: 'right', item: soundOf(right) })]);

    await press(pressable(r, 'match-sound-next'));
    expect(onRound(r, 2, 2)).toBe(true);
    expect(byTestId(r.root, 'match-sound-next')).toEqual([]);
    expect(announced(r)).toEqual([]);
    const header = host(r, 'match-sound-round');
    expect(sr.focused.at(-1)).toEqual(expect.objectContaining({ testID: 'match-sound-round' }));
    expect(header.props.role).toBe('heading');
    expect(String(header.props['aria-label'])).toBe(m.a11y.answer.round(2, 2, textOf(header)));
    expect(textOf(header).length).toBeGreaterThan(0);
    expect(String(header.props['aria-label'])).not.toMatch(HANGUL);
  });

  it('reader on: the last round also shows Next, the step ends when it is pressed, and a second Next ends it once', async () => {
    readerOnWeb();
    const finish = vi.fn();
    const r = await play(MATCH(1), finish);
    await press(pressable(r, tileId(target())));
    await tick(60_000);
    expect(finish).not.toHaveBeenCalled();
    const shown = pressable(r, 'match-sound-next');
    const next = { props: shown.props, type: shown.type } as ReactTestInstance;
    await press(next);
    await press(next);
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('iOS, reader on: focus moves to Next first, then the line is queued', async () => {
    on('ios');
    sr.enabled = true;
    const r = await play(MATCH(2));
    const right = target();
    await press(pressable(r, tileId(right)));
    expect(sr.log).toEqual(['focus: match-sound-next', `announce: ${line({ kind: 'right', item: soundOf(right) })}`]);
  });

  it('a tap on a locked tile is no second miss: one announcement only', async () => {
    const r = await play(MATCH(2));
    const wrong = wrongOne();
    await press(pressable(r, tileId(wrong)));
    await press(pressable(r, tileId(wrong)));
    expect(announced(r)).toEqual([line({ kind: 'missListen', item: soundOf(wrong) })]);
  });
});

describe('Odd One Out answers (test 14)', () => {
  const tileId = (id: string): string => `odd-one-out-tile-${id}`;
  const ODD_ID = 'jamo:giyeok';
  const wrongOf = 'jamo:a';
  const play = (scope: MinigameScope, onFinish: () => void = () => undefined): Promise<ReactTestRenderer> =>
    open(<OddOneOutGame scope={scope} onFinish={onFinish} />);

  it('the right tile shows check and is named "Right answer: {sound}"; a locked miss shows replay, is named "Not this one: …" and is not disabled', async () => {
    const r = await play(ODD(2));
    expect(marks(host(r, tileId(wrongOf)))).toEqual([]);
    await press(pressable(r, tileId(wrongOf)));
    const miss = pressable(r, tileId(wrongOf));
    expect(marks(miss)).toEqual(['replay']);
    expect(miss.props['aria-label']).toBe(m.a11y.minigame.option.wrong(soundOf(wrongOf)));
    expect(disabled(r, tileId(wrongOf))).toBe(false);
    await press(pressable(r, tileId(ODD_ID)));
    const good = pressable(r, tileId(ODD_ID));
    expect(marks(good)).toEqual(['check']);
    expect(good.props['aria-label']).toBe(m.a11y.minigame.option.correct(soundOf(ODD_ID)));
    expect(disabled(r, tileId(ODD_ID))).toBe(false);
  });

  it("the announcer says a miss with Hoya's \"look again\" hint, then the right sound, once each; the miss bubble is not live", async () => {
    const r = await play(ODD(2));
    expect(announced(r)).toEqual([]);
    expect(bubbleLive(r)).toEqual([]);
    await press(pressable(r, tileId(wrongOf)));
    expect(announced(r)).toEqual([line({ kind: 'missHint', item: soundOf(wrongOf), hint: m.learner.minigame.oddOneOut.lookAgain })]);
    expect(bubbleLive(r)).toEqual([false]);
    await press(pressable(r, tileId(ODD_ID)));
    expect(announced(r)).toEqual([line({ kind: 'right', item: soundOf(ODD_ID) })]);
  });

  it('iOS: one queued call per result', async () => {
    on('ios');
    const r = await play(ODD(2));
    await press(pressable(r, tileId(wrongOf)));
    await press(pressable(r, tileId(ODD_ID)));
    expect(sr.queued).toEqual([
      line({ kind: 'missHint', item: soundOf(wrongOf), hint: m.learner.minigame.oddOneOut.lookAgain }),
      line({ kind: 'right', item: soundOf(ODD_ID) }),
    ]);
  });

  it('reader off: the next round comes after the floor (not at 700 ms), and focus does not move', async () => {
    const r = await play(ODD(2));
    expect(onRound(r, 1, 2)).toBe(true);
    await press(pressable(r, tileId(ODD_ID)));
    await tick(700);
    expect(onRound(r, 1, 2)).toBe(true);
    await tick(RESULT_MARK_MIN_MS - 700 - 1);
    expect(onRound(r, 1, 2)).toBe(true);
    await tick(1);
    expect(onRound(r, 2, 2)).toBe(true);
    expect(sr.focused).toEqual([]);
    expect(byTestId(r.root, 'odd-one-out-next')).toEqual([]);
  });

  it('reader off: the last right answer ends the step after the floor; leaving the game first ends nothing (the advance is on pacing, dropped on unmount)', async () => {
    const finish = vi.fn();
    const r = await play(ODD(1), finish);
    await press(pressable(r, tileId(ODD_ID)));
    await tick(RESULT_MARK_MIN_MS - 1);
    expect(finish).not.toHaveBeenCalled();
    await tick(1);
    expect(finish).toHaveBeenCalledTimes(1);

    const gone = vi.fn();
    const g = await play(ODD(1), gone);
    await press(pressable(g, tileId(ODD_ID)));
    await unmount(g);
    await tick(RESULT_MARK_MIN_MS * 3);
    expect(gone).not.toHaveBeenCalled();
  });

  it('reader on: Next takes focus, nothing moves on by itself, then focus goes to the header node (the heading and the instruction, no Hangul)', async () => {
    readerOnWeb();
    const r = await play(ODD(2));
    await press(pressable(r, tileId(wrongOf)));
    expect(byTestId(r.root, 'odd-one-out-next')).toEqual([]);
    await press(pressable(r, tileId(ODD_ID)));
    expect(sr.focused).toEqual([expect.objectContaining({ testID: 'odd-one-out-next' })]);
    await tick(60_000);
    expect(onRound(r, 1, 2)).toBe(true);
    expect(announced(r)).toEqual([line({ kind: 'right', item: soundOf(ODD_ID) })]);

    await press(pressable(r, 'odd-one-out-next'));
    expect(onRound(r, 2, 2)).toBe(true);
    expect(byTestId(r.root, 'odd-one-out-next')).toEqual([]);
    expect(announced(r)).toEqual([]);
    const header = host(r, 'odd-one-out-round');
    expect(sr.focused.at(-1)).toEqual(expect.objectContaining({ testID: 'odd-one-out-round' }));
    expect(header.props.role).toBe('heading');
    expect(String(header.props['aria-label'])).toBe(
      m.a11y.answer.round(2, 2, `${m.learner.minigame.oddOneOut.heading} ${m.learner.minigame.oddOneOut.instruction}`),
    );
    expect(String(header.props['aria-label'])).not.toMatch(HANGUL);
  });

  it('reader on: the last round also shows Next, and a second Next ends the step once', async () => {
    readerOnWeb();
    const finish = vi.fn();
    const r = await play(ODD(1), finish);
    await press(pressable(r, tileId(ODD_ID)));
    await tick(60_000);
    expect(finish).not.toHaveBeenCalled();
    const shown = pressable(r, 'odd-one-out-next');
    const next = { props: shown.props, type: shown.type } as ReactTestInstance;
    await press(next);
    await press(next);
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('iOS, reader on: focus moves to Next first, then the line is queued', async () => {
    on('ios');
    sr.enabled = true;
    const r = await play(ODD(2));
    await press(pressable(r, tileId(ODD_ID)));
    expect(sr.log).toEqual(['focus: odd-one-out-next', `announce: ${line({ kind: 'right', item: soundOf(ODD_ID) })}`]);
  });
});
