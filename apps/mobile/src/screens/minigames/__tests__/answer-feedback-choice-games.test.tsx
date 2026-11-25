import { ChoiceCard, HoyaBubble, Icon, Pill } from '@hangul-route/design-system';
import { a11yRomanization, type ListenPickRound } from '@hangul-route/content-schema';
import type { ReadPickRound } from '../../../logic/match-shape/fallback';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announceWaitMs, answerAnnouncement, answerItem, lookHereLine, RESULT_MARK_MIN_MS, type AnswerResult } from '../../../logic/answer-feedback';
import { clozeFixtureScope } from '../../../logic/cloze-pick/e2e-rounds';
import { tileId } from '../../../logic/cloze-pick/round';
import type { MinigameScope } from '../../../logic/minigame-config';
import { symbolRound } from '../../../logic/stage1/hangul-check';
import { REALIA_FIXTURES } from '../../../navigation/realia-read-e2e-fixture';
import { endVoiceCheckHold, useAudioStore } from '../../../store/audio-store';
import { useLocaleStore } from '../../../store/locale-store';
import { byTestId, hostNodes, press, render, resetPlatform, screenTexts, setPlatform, textOf, unmount, type RenderPlatform } from '../../../test-support/render';
import { ClozePickGame } from '../ClozePickGame';
import type { MinigameHost } from '../host';
import { ListenPickGame } from '../ListenPickGame';
import { PicWordMatchGame } from '../PicWordMatchGame';
import { ReadPickGame } from '../ReadPickGame';
import { RealiaReadGame } from '../RealiaReadGame';

/**
 * F-A11Y-001 row AF-4b (§6 test 16), the choice games: Listen & Pick, Pic-Word Match, Read Pick, Cloze Pick and Realia
 * Read. In each: the right option shows `check` and a locked miss `replay`, named with the state first and never
 * `disabled`; each result is said once through the answer announcer (the region text plus one iOS call); the result
 * bubbles are not live and the status regions still are; the miss that turns the look-here ring on announces the look-here
 * line; the advance waits the 1000 ms floor with the reader off; with the reader on Next shows after a right answer (the
 * last round included) and takes focus, the line is queued after the focus move, the answer's sound starts after the line,
 * and a new round's header node takes focus (no Hangul in its name). The announced lines hold no Hangul.
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

const audio = vi.hoisted(() => ({ said: [] as string[] }));
vi.mock('../../../platform/audio', async (orig) => ({
  ...(await orig<object>()),
  playPrompt: (spec: { text: string }) => {
    audio.said.push(spec.text);
    return Promise.resolve('played' as const);
  },
  playJamo: (jamo: { id: string }) => {
    audio.said.push(jamo.id);
    return Promise.resolve('played' as const);
  },
  stop: () => undefined,
}));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => false }));
vi.mock('../../../platform/telemetry', async (orig) => ({ ...(await orig<object>()), track: vi.fn(async () => undefined) }));
vi.mock('../../../platform/haptics', async (orig) => ({ ...(await orig<object>()), nudge: () => undefined, success: () => undefined, tapLight: () => undefined }));

const m = getMessages('en');
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
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

/** A tap a beat after the last: a touch inside `TAP_LOCK_MS` of an accepted one is a bounce and is dropped (KT-D5). */
const tap = async (r: ReactTestRenderer, id: string): Promise<void> => {
  await tick(450);
  await press(pressable(r, id));
};
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
/** A locked answer is `inactive` (claimed by the board, focusable), never `disabled`: no host of it says `aria-disabled`. */
const disabled = (r: ReactTestRenderer, id: string): boolean => byTestId(r.root, id).some((n) => n.props['aria-disabled'] === true);
const liveRegions = (r: ReactTestRenderer): string[] =>
  r.root.findAll((n) => typeof n.type === 'string' && n.props['aria-live'] === 'polite').map((n) => String(n.props['data-testid'] ?? 'unnamed'));
/** The `Next` a reader on is shown: a press that calls the handler twice with the same node, as a double tap does. */
const nextPress = async (r: ReactTestRenderer, id: string, times = 1): Promise<void> => {
  const shown = pressable(r, id);
  const next = { props: shown.props, type: shown.type } as ReactTestInstance;
  for (let i = 0; i < times; i++) await press(next);
};
const sound = (romanization: string): string => a11yRomanization(romanization, m.a11y.romanizationOr);

const hostOf = (): MinigameHost & { answers: Array<[string | number, boolean]>; completes: number } => {
  const h = {
    mode: 'quest' as const,
    answers: [] as Array<[string | number, boolean]>,
    completes: 0,
    answer: (key: string | number, correct: boolean) => void h.answers.push([key, correct]),
    complete: () => {
      h.completes += 1;
    },
  };
  return h;
};

beforeEach(() => {
  endVoiceCheckHold();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-24T09:00:00Z'));
  audio.said = [];
  useAudioStore.setState({ muted: false });
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
  useLocaleStore.setState({ screenReader: false });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('Listen & Pick answers (test 16)', () => {
  const rounds: ListenPickRound[] = [symbolRound('jamo:giyeok'), symbolRound('jamo:nieun')];
  const scope: MinigameScope = { kind: 'listen-pick', rounds: 2, listenPick: { rounds } };
  const one: MinigameScope = { kind: 'listen-pick', rounds: 1, listenPick: { rounds: [rounds[0]!] } };
  const optionId = (id: string): string => `listen-pick-option-${id}`;
  const rightOf = (round: ListenPickRound): ListenPickRound['options'][number] => round.options.find((o) => o.id === round.answerId)!;
  const wrongOf = (round: ListenPickRound, n = 0): ListenPickRound['options'][number] => round.options.filter((o) => o.id !== round.answerId)[n]!;
  /** An option's name once answered: its romanization read as sounds, and after a right answer its meaning (§3.2). */
  const missItem = (o: ListenPickRound['options'][number]): string => sound(o.text!.romanization);
  const rightItem = (o: ListenPickRound['options'][number]): string => answerItem(m.a11y, sound(o.text!.romanization), o.text!.en);
  const onRound = (r: ReactTestRenderer, n: number): boolean => screenTexts(r.root).includes(m.learner.minigame.progress.pill(n, 2));
  const play = (s: MinigameScope = scope, h: MinigameHost = hostOf()): Promise<ReactTestRenderer> => open(<ListenPickGame scope={s} host={h} />);

  it('a right option shows check and is named "Right answer: …"; a locked miss shows replay, is named "Not this one: …", is focusable and not disabled', async () => {
    const r = await play();
    const right = rightOf(rounds[0]!);
    const wrong = wrongOf(rounds[0]!);
    expect(marks(host(r, optionId(wrong.id)))).toEqual([]);
    await tap(r, optionId(wrong.id));
    const miss = pressable(r, optionId(wrong.id));
    expect(marks(miss)).toEqual(['replay']);
    expect(String(miss.props['aria-label'])).toMatch(/^Not this one: /);
    expect(disabled(r, optionId(wrong.id))).toBe(false);
    await tap(r, optionId(right.id));
    const good = pressable(r, optionId(right.id));
    expect(marks(good)).toEqual(['check']);
    expect(String(good.props['aria-label'])).toMatch(/^Right answer: /);
    expect(disabled(r, optionId(right.id))).toBe(false);
  });

  it('says each result once: a miss "Listen again", then the right answer by its romanization and meaning, never its Hangul; the result bubble is not live', async () => {
    const r = await play();
    const right = rightOf(rounds[0]!);
    const wrong = wrongOf(rounds[0]!);
    expect(announced(r)).toEqual([]);
    await tap(r, optionId(wrong.id));
    expect(announced(r)).toEqual([line({ kind: 'missListen', item: missItem(wrong) })]);
    expect(bubbleLive(r)).toEqual([false]);
    await tap(r, optionId(right.id));
    expect(announced(r)).toEqual([line({ kind: 'right', item: rightItem(right) })]);
    for (const text of announced(r)) expect(text).not.toMatch(HANGUL);
  });

  it('no region of the game is a live region any more but the prompt panel and the announcer', async () => {
    const r = await play();
    await tap(r, optionId(wrongOf(rounds[0]!).id));
    await tap(r, optionId(rightOf(rounds[0]!).id));
    expect(liveRegions(r).filter((id) => id !== 'answer-announcer' && !/prompt|sound|status/.test(id))).toEqual([]);
  });

  it('iOS: one queued call per result', async () => {
    on('ios');
    const r = await play();
    const right = rightOf(rounds[0]!);
    const wrong = wrongOf(rounds[0]!);
    await tap(r, optionId(wrong.id));
    await tap(r, optionId(right.id));
    expect(sr.queued).toEqual([line({ kind: 'missListen', item: missItem(wrong) }), line({ kind: 'right', item: rightItem(right) })]);
  });

  it('the second miss rings the right option and its line carries the look-here line; a third miss is a plain retry', async () => {
    const three: MinigameScope = { kind: 'listen-pick', rounds: 1, listenPick: { rounds: [{ ...rounds[0]!, options: [...rounds[0]!.options] }] } };
    const r = await play(three);
    const round = rounds[0]!;
    const right = rightOf(round);
    const [a, b, c] = [wrongOf(round, 0), wrongOf(round, 1), wrongOf(round, 2)];
    await tap(r, optionId(a.id));
    expect(announced(r)).toEqual([line({ kind: 'missListen', item: missItem(a) })]);
    await tap(r, optionId(b.id));
    expect(announced(r)).toEqual([line({ kind: 'missHint', item: missItem(b), hint: lookHereLine(m.a11y, missItem(right)) })]);
    expect(announced(r)[0]).not.toMatch(HANGUL);
    expect(String(pressable(r, optionId(right.id)).props['aria-label'])).toMatch(/^Look here: /);
    await tap(r, optionId(c.id));
    expect(announced(r)).toEqual([line({ kind: 'missListen', item: missItem(c) })]);
  });

  it('reader off: the next round comes after the 1000 ms floor, not at 700; focus does not move to a header', async () => {
    const r = await play();
    await tap(r, optionId(rightOf(rounds[0]!).id));
    await tick(700);
    expect(onRound(r, 1)).toBe(true);
    await tick(RESULT_MARK_MIN_MS - 700 - 1);
    expect(onRound(r, 1)).toBe(true);
    await tick(1);
    expect(onRound(r, 2)).toBe(true);
    expect(sr.focused).toEqual([]);
    expect(byTestId(r.root, 'listen-pick-next')).toEqual([]);
  });

  it('reader off: the last right answer ends the step after the floor once; leaving first ends nothing', async () => {
    const h = hostOf();
    const r = await play(one, h);
    await tap(r, optionId(rightOf(rounds[0]!).id));
    await tick(RESULT_MARK_MIN_MS - 1);
    expect(h.completes).toBe(0);
    await tick(1);
    expect(h.completes).toBe(1);

    const gone = hostOf();
    const g = await play(one, gone);
    await tap(g, optionId(rightOf(rounds[0]!).id));
    await unmount(g);
    await tick(RESULT_MARK_MIN_MS * 3);
    expect(gone.completes).toBe(0);
  });

  it('reader off: a miss still replays the prompt after 800 ms; a reader on hears nothing by itself, the learner taps Hear it', async () => {
    const off = await play();
    const before = audio.said.length;
    await tap(off, optionId(wrongOf(rounds[0]!).id));
    await tick(800);
    expect(audio.said.length).toBe(before + 1);
    await unmount(off);
    mounted.pop();

    readerOnWeb();
    const r = await play();
    const said = audio.said.length;
    await tap(r, optionId(wrongOf(rounds[0]!).id));
    await tick(5_000);
    expect(audio.said.length).toBe(said);
  });

  it('reader on: Next takes focus first, the confirm clip starts after the line, nothing moves on by itself, then the header node takes focus (no Hangul)', async () => {
    readerOnWeb();
    const r = await play();
    const right = rightOf(rounds[0]!);
    await tap(r, optionId(wrongOf(rounds[0]!).id));
    expect(byTestId(r.root, 'listen-pick-next')).toEqual([]);
    const spoken = audio.said.length;
    await tap(r, optionId(right.id));
    expect(sr.focused).toEqual([expect.objectContaining({ testID: 'listen-pick-next' })]);
    // The line is being said (web: the length-scaled wait), so the clip has not started yet.
    expect(audio.said).toHaveLength(spoken);
    await tick(announceWaitMs(line({ kind: 'right', item: rightItem(right) })));
    expect(audio.said).toHaveLength(spoken + 1);
    await tick(60_000);
    expect(onRound(r, 1)).toBe(true);

    await nextPress(r, 'listen-pick-next');
    expect(onRound(r, 2)).toBe(true);
    expect(byTestId(r.root, 'listen-pick-next')).toEqual([]);
    expect(announced(r)).toEqual([]);
    const header = host(r, 'listen-pick-round');
    expect(sr.focused.at(-1)).toEqual(expect.objectContaining({ testID: 'listen-pick-round' }));
    expect(header.props.role).toBe('heading');
    expect(String(header.props['aria-label'])).toBe(m.a11y.answer.round(2, 2, m.learner.minigame.listenPick.heading));
    expect(String(header.props['aria-label'])).not.toMatch(HANGUL);
  });

  it('reader on: Next pressed before the line ends drops the clip; the last round shows Next too and a second Next ends the step once', async () => {
    readerOnWeb();
    const h = hostOf();
    const r = await play(one, h);
    const spoken = audio.said.length;
    await tap(r, optionId(rightOf(rounds[0]!).id));
    await nextPress(r, 'listen-pick-next', 2);
    expect(h.completes).toBe(1);
    await tick(60_000);
    expect(audio.said).toHaveLength(spoken);
    expect(h.completes).toBe(1);
  });

  it('iOS, reader on: focus moves to Next first, then the line is queued', async () => {
    on('ios');
    sr.enabled = true;
    const r = await play();
    const right = rightOf(rounds[0]!);
    await tap(r, optionId(right.id));
    expect(sr.log).toEqual(['focus: listen-pick-next', `announce: ${line({ kind: 'right', item: rightItem(right) })}`]);
  });

  it('a tap on a locked option is no second miss: one announcement only', async () => {
    const r = await play();
    const wrong = wrongOf(rounds[0]!);
    await tap(r, optionId(wrong.id));
    await tap(r, optionId(wrong.id));
    expect(announced(r)).toEqual([line({ kind: 'missListen', item: missItem(wrong) })]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('Read Pick answers (test 16)', () => {
  const round = (id: string, target: string): ReadPickRound => ({
    id,
    target,
    answerId: `${id}-right`,
    options: [
      { id: `${id}-right`, sound: 'n' },
      { id: `${id}-other`, sound: 'g/k' },
    ],
  });
  const scope: MinigameScope = { kind: 'match-shape', rounds: 2, readPick: { rounds: [round('r1', 'jamo:nieun'), round('r2', 'jamo:giyeok')] } };
  const one: MinigameScope = { kind: 'match-shape', rounds: 1, readPick: { rounds: [round('r1', 'jamo:nieun')] } };
  const play = (s: MinigameScope = scope, h: MinigameHost = hostOf()): Promise<ReactTestRenderer> => open(<ReadPickGame scope={s} host={h} />);
  const onRound = (r: ReactTestRenderer, n: number): boolean => screenTexts(r.root).includes(m.learner.minigame.progress.pill(n, 2));

  it('names an answered card by its state and sound (add the state), with check / replay, never disabled; an unanswered card keeps its plain name', async () => {
    const r = await play();
    expect(pressable(r, 'read-pick-option-r1-other').props['aria-label']).toBe('g or k');
    await tap(r, 'read-pick-option-r1-other');
    const miss = pressable(r, 'read-pick-option-r1-other');
    expect(miss.props['aria-label']).toBe(m.a11y.minigame.option.wrong('g or k'));
    expect(marks(miss)).toEqual(['replay']);
    expect(disabled(r, 'read-pick-option-r1-other')).toBe(false);
    await tap(r, 'read-pick-option-r1-right');
    const good = pressable(r, 'read-pick-option-r1-right');
    expect(good.props['aria-label']).toBe(m.a11y.minigame.option.correct('n'));
    expect(marks(good)).toEqual(['check']);
  });

  it('says each result once ("Try another", then the right sound); Hoya\'s miss line is not live; iOS gets one call each', async () => {
    on('ios');
    const r = await play();
    await tap(r, 'read-pick-option-r1-other');
    expect(announced(r)).toEqual([line({ kind: 'miss', item: 'g or k' })]);
    expect(bubbleLive(r)).toEqual([false]);
    await tap(r, 'read-pick-option-r1-right');
    expect(announced(r)).toEqual([line({ kind: 'right', item: 'n' })]);
    expect(sr.queued).toEqual([line({ kind: 'miss', item: 'g or k' }), line({ kind: 'right', item: 'n' })]);
  });

  it('reader off: the next round waits the 1000 ms floor, reduced motion included (it was 0); focus does not move', async () => {
    const r = await play();
    await tap(r, 'read-pick-option-r1-right');
    await tick(RESULT_MARK_MIN_MS - 1);
    expect(onRound(r, 1)).toBe(true);
    await tick(1);
    expect(onRound(r, 2)).toBe(true);
    expect(sr.focused).toEqual([]);
  });

  it('reader on: Next after a right card (the last round too), the letter\'s sound after the line, then the header node takes focus', async () => {
    readerOnWeb();
    const h = hostOf();
    const r = await play(scope, h);
    const spoken = audio.said.length;
    await tap(r, 'read-pick-option-r1-right');
    expect(sr.focused).toEqual([expect.objectContaining({ testID: 'read-pick-next' })]);
    expect(audio.said).toHaveLength(spoken);
    await tick(announceWaitMs(line({ kind: 'right', item: 'n' })));
    expect(audio.said).toHaveLength(spoken + 1);
    await tick(60_000);
    expect(onRound(r, 1)).toBe(true);
    await nextPress(r, 'read-pick-next');
    expect(onRound(r, 2)).toBe(true);
    const header = host(r, 'read-pick-round');
    expect(sr.focused.at(-1)).toEqual(expect.objectContaining({ testID: 'read-pick-round' }));
    expect(String(header.props['aria-label'])).toBe(m.a11y.answer.round(2, 2, m.learner.minigame.matchShape.readPick.heading));
    await tap(r, 'read-pick-option-r2-right');
    await nextPress(r, 'read-pick-next', 2);
    expect(h.completes).toBe(1);
  });

  it('reader on: Next pressed before the line ends drops the letter\'s sound', async () => {
    readerOnWeb();
    const r = await play(scope);
    const spoken = audio.said.length;
    await tap(r, 'read-pick-option-r1-right');
    await nextPress(r, 'read-pick-next');
    await tick(60_000);
    expect(audio.said).toHaveLength(spoken);
  });

  it('reader off: the last right answer completes after the floor, once', async () => {
    const h = hostOf();
    const r = await play(one, h);
    await tap(r, 'read-pick-option-r1-right');
    await tick(RESULT_MARK_MIN_MS - 1);
    expect(h.completes).toBe(0);
    await tick(1);
    expect(h.completes).toBe(1);
    await unmount(r);
    mounted.pop();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('Cloze Pick answers (test 16)', () => {
  const scope = clozeFixtureScope(['word', 'particle']);
  const one = clozeFixtureScope(['word']);
  const tile = (key: 'word' | 'particle', i: number): string => `cloze-pick-tile-${tileId(`e2e-cloze-${key}`, i)}`;
  const play = (s: MinigameScope = scope, h: MinigameHost = hostOf()): Promise<ReactTestRenderer> => open(<ClozePickGame scope={s} host={h} />);
  const onRound = (r: ReactTestRenderer, n: number): boolean => screenTexts(r.root).includes(m.learner.minigame.progress.pill(n, 2));

  it('a right tile shows check and a locked miss replay, named with the state first and not disabled; the mark sits in its own column, never over the word (320 wide, 200 % text)', async () => {
    const r = await play();
    await tap(r, tile('word', 1));
    const miss = pressable(r, tile('word', 1));
    expect(marks(miss)).toEqual(['replay']);
    expect(String(miss.props['aria-label'])).toMatch(/^Not this one: /);
    expect(disabled(r, tile('word', 1))).toBe(false);
    // The defect of AF-1's shots: the mark was absolutely placed over the word. It is now a sibling in the tile's row.
    const icon = miss.findAll((n) => n.type === Icon)[0]!;
    const rowStyle = icon.parent!.props.style as { flexDirection?: string };
    expect(rowStyle.flexDirection).toBe('row');
    expect((icon.parent!.props.style as { position?: string }).position).not.toBe('absolute');
    expect(icon.parent!.findAll((n) => n.props.style?.position === 'absolute' && n !== icon.parent).filter((n) => n.findAll((c) => c.type === Icon).length > 0)).toEqual([]);
    await tap(r, tile('word', 0));
    const good = pressable(r, tile('word', 0));
    expect(marks(good)).toEqual(['check']);
    expect(String(good.props['aria-label'])).toMatch(/^Right answer: /);
    expect(disabled(r, tile('word', 0))).toBe(false);
  });

  it('every state keeps the same row: three columns (a balancing column, the word, the mark column), so answering never rewraps the word', async () => {
    const r = await play();
    const columns = (id: string): number => pressable(r, id).findAll((n) => n.type === Icon || (typeof n.type !== 'string' && n.props.style?.width === 24)).length;
    const idle = columns(tile('word', 1));
    await tap(r, tile('word', 1));
    expect(columns(tile('word', 1))).toBe(idle);
  });

  it('says each result once; the miss that rings the fitting tile carries the look-here line; Hoya\'s bubble is not live', async () => {
    const r = await play();
    const tiles = clozeFixtureScope(['word']).clozePick!.rounds[0]!.tiles;
    const [right, a, b] = [tiles[0]!, tiles[1]!, tiles[2]!];
    await tap(r, tile('word', 1));
    expect(announced(r)).toEqual([line({ kind: 'miss', item: a.romanization })]);
    expect(bubbleLive(r)).toEqual([false]);
    await tap(r, tile('word', 2));
    expect(announced(r)).toEqual([line({ kind: 'missHint', item: b.romanization, hint: lookHereLine(m.a11y, right.romanization) })]);
    expect(announced(r)[0]).not.toMatch(HANGUL);
    await tap(r, tile('word', 0));
    expect(announced(r)).toEqual([line({ kind: 'right', item: answerItem(m.a11y, right.romanization, right.en) })]);
  });

  it('iOS: one queued call per result', async () => {
    on('ios');
    const r = await play();
    await tap(r, tile('word', 1));
    await tap(r, tile('word', 0));
    expect(sr.queued).toEqual([line({ kind: 'miss', item: 'meogeoyo' }), line({ kind: 'right', item: 'ilgeoyo, read' })]);
  });

  it('reader off: the next round waits the 1000 ms floor and focus does not move to a header', async () => {
    const r = await play();
    await tap(r, tile('word', 0));
    await tick(700);
    expect(onRound(r, 1)).toBe(true);
    await tick(RESULT_MARK_MIN_MS - 700 - 1);
    expect(onRound(r, 1)).toBe(true);
    await tick(1);
    expect(onRound(r, 2)).toBe(true);
    expect(sr.focused).toEqual([]);
  });

  it('reader on: Next takes focus, the sentence is said after the line, then the header node takes focus; the last round shows Next too', async () => {
    readerOnWeb();
    const h = hostOf();
    const r = await play(scope, h);
    await tap(r, tile('word', 0));
    expect(sr.focused).toEqual([expect.objectContaining({ testID: 'cloze-pick-next' })]);
    expect(audio.said).toEqual([]);
    await tick(announceWaitMs(line({ kind: 'right', item: 'ilgeoyo, read' })));
    expect(audio.said).toHaveLength(1);
    await tick(60_000);
    expect(onRound(r, 1)).toBe(true);
    await nextPress(r, 'cloze-pick-next');
    expect(onRound(r, 2)).toBe(true);
    const header = host(r, 'cloze-pick-round');
    expect(sr.focused.at(-1)).toEqual(expect.objectContaining({ testID: 'cloze-pick-round' }));
    expect(String(header.props['aria-label'])).toBe(m.a11y.answer.round(2, 2, m.learner.minigame.clozePick.heading));
    expect(String(header.props['aria-label'])).not.toMatch(HANGUL);
    await tap(r, tile('particle', 0));
    await nextPress(r, 'cloze-pick-next', 2);
    expect(h.completes).toBe(1);
  });

  it('reader on: Next pressed before the line ends drops the sentence', async () => {
    readerOnWeb();
    const r = await play(one);
    await tap(r, tile('word', 0));
    await nextPress(r, 'cloze-pick-next');
    await tick(60_000);
    expect(audio.said).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('Realia Read answers (test 16)', () => {
  const rounds = REALIA_FIXTURES.menu.realiaRead.rounds;
  const optionId = (id: string): string => `realia-read-option-${id}`;
  const play = (s: MinigameScope = REALIA_FIXTURES.menu as MinigameScope, h: MinigameHost = hostOf()): Promise<ReactTestRenderer> =>
    open(<RealiaReadGame scope={s} host={h} />);
  const onRound = (r: ReactTestRenderer, n: number): boolean => screenTexts(r.root).includes(m.learner.minigame.progress.pill(n, rounds.length));
  const one = { ...REALIA_FIXTURES.menu, realiaRead: { ...REALIA_FIXTURES.menu.realiaRead, rounds: [rounds[0]!] } } as MinigameScope;

  it('a right option shows check and a locked miss replay, named with the state first and not disabled', async () => {
    const r = await play();
    await tap(r, optionId('icheon'));
    const miss = pressable(r, optionId('icheon'));
    expect(marks(miss)).toEqual(['replay']);
    expect(String(miss.props['aria-label'])).toMatch(/^Not this one: /);
    expect(disabled(r, optionId('icheon'))).toBe(false);
    await tap(r, optionId('samcheon'));
    const good = pressable(r, optionId('samcheon'));
    expect(marks(good)).toEqual(['check']);
    expect(String(good.props['aria-label'])).toMatch(/^Right answer: /);
  });

  it('says each result once by romanization; the second miss carries the look-here line for the answer\'s line, without Hangul; the status line and the bubble are not live', async () => {
    const r = await play();
    await tap(r, optionId('icheon'));
    expect(announced(r)).toEqual([line({ kind: 'miss', item: 'icheon won' })]);
    expect(bubbleLive(r)).toEqual([false]);
    await tap(r, optionId('ocheon'));
    expect(announced(r)).toEqual([line({ kind: 'missHint', item: 'ocheon won', hint: lookHereLine(m.a11y, 'ramyeon, samcheon won') })]);
    expect(announced(r)[0]).not.toMatch(HANGUL);
    expect(host(r, 'realia-read-status').props['aria-live']).toBeUndefined();
    expect(textOf(host(r, 'realia-read-look-here'))).toMatch(/^Look here: /);
    await tap(r, optionId('samcheon'));
    expect(announced(r)).toEqual([line({ kind: 'right', item: answerItem(m.a11y, 'samcheon won', '3,000 won') })]);
  });

  it('iOS: one queued call per result', async () => {
    on('ios');
    const r = await play();
    await tap(r, optionId('icheon'));
    await tap(r, optionId('samcheon'));
    expect(sr.queued).toEqual([line({ kind: 'miss', item: 'icheon won' }), line({ kind: 'right', item: 'samcheon won, 3,000 won' })]);
  });

  it('reader off: the next question waits the 1000 ms floor, not 700; the last one completes once; leaving first completes nothing', async () => {
    const h = hostOf();
    const r = await play(REALIA_FIXTURES.menu as MinigameScope, h);
    await tap(r, optionId('samcheon'));
    await tick(700);
    expect(onRound(r, 1)).toBe(true);
    await tick(RESULT_MARK_MIN_MS - 700 - 1);
    expect(onRound(r, 1)).toBe(true);
    await tick(1);
    expect(onRound(r, 2)).toBe(true);
    expect(sr.focused).toEqual([]);

    const done = hostOf();
    const last = await play(one, done);
    await tap(last, optionId('samcheon'));
    await tick(RESULT_MARK_MIN_MS);
    expect(done.completes).toBe(1);

    const gone = hostOf();
    const g = await play(one, gone);
    await tap(g, optionId('samcheon'));
    await unmount(g);
    await tick(RESULT_MARK_MIN_MS * 3);
    expect(gone.completes).toBe(0);
  });

  it('reader on: Next takes focus, the option\'s sound follows the line, then the header node takes focus (question and key by romanization, no Hangul)', async () => {
    readerOnWeb();
    const h = hostOf();
    const r = await play(one, h);
    const spoken = audio.said.length;
    await tap(r, optionId('samcheon'));
    expect(sr.focused).toEqual([expect.objectContaining({ testID: 'realia-read-next' })]);
    expect(audio.said).toHaveLength(spoken);
    await tick(announceWaitMs(line({ kind: 'right', item: 'samcheon won, 3,000 won' })));
    expect(audio.said).toHaveLength(spoken + 1);
    await nextPress(r, 'realia-read-next', 2);
    expect(h.completes).toBe(1);

    // Next pressed before the line ends: the question has moved on, so its sound is not said afterwards.
    const early = await play(one);
    const said = audio.said.length;
    await tap(early, optionId('samcheon'));
    await nextPress(early, 'realia-read-next');
    await tick(60_000);
    expect(audio.said).toHaveLength(said);

    const two = await play();
    await tap(two, optionId('samcheon'));
    await nextPress(two, 'realia-read-next');
    expect(onRound(two, 2)).toBe(true);
    const header = host(two, 'realia-read-round');
    expect(sr.focused.at(-1)).toEqual(expect.objectContaining({ testID: 'realia-read-round' }));
    expect(String(header.props['aria-label'])).toBe(m.a11y.answer.round(2, rounds.length, 'Which one costs this? ocheon won'));
    expect(String(header.props['aria-label'])).not.toMatch(HANGUL);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('Pic-Word Match answers (test 16, OD-AF7)', () => {
  const pair = (id: string, ko: string, romanization: string, en: string) => ({ id, word: { ko, romanization, en } });
  const board = (suffix: string) => ({
    pairs: [pair(`a${suffix}`, '밥', 'bap', 'rice'), pair(`b${suffix}`, '산', 'san', 'mountain'), pair(`c${suffix}`, '한복', 'hanbok', 'hanbok')],
  });
  const scope: MinigameScope = { kind: 'pic-word-match', rounds: 2, picWord: { boards: [board(''), board('2')] } };
  const one: MinigameScope = { kind: 'pic-word-match', rounds: 1, picWord: { boards: [board('')] } };
  const pic = (id: string): string => `pic-word-picture-${id}`;
  const word = (id: string): string => `pic-word-word-${id}`;
  const play = (s: MinigameScope = scope, h: MinigameHost = hostOf()): Promise<ReactTestRenderer> => open(<PicWordMatchGame scope={s} host={h} />);
  const pair2 = async (r: ReactTestRenderer, id: string): Promise<void> => {
    await tick(450);
    await tap(r, pic(id));
    await tick(450);
    await tap(r, word(id));
  };

  it('a wrong second tile keeps its replay mark and its "Not this one" name long after 600 ms, until the learner\'s next tap changes the board; it is never disabled', async () => {
    const r = await play();
    await tap(r, pic('a'));
    await tick(450);
    await tap(r, word('b'));
    const miss = pressable(r, word('b'));
    expect(marks(miss)).toEqual(['replay']);
    expect(String(miss.props['aria-label'])).toMatch(/^Not this one: /);
    expect(disabled(r, word('b'))).toBe(false);
    await tick(10_000);
    expect(marks(pressable(r, word('b')))).toEqual(['replay']);
    expect(String(pressable(r, word('b')).props['aria-label'])).toMatch(/^Not this one: /);
    // The next tap that changes the board (another word) takes the amber to that word.
    await tick(450);
    await tap(r, word('c'));
    expect(marks(pressable(r, word('b')))).toEqual([]);
    expect(marks(pressable(r, word('c')))).toEqual(['replay']);
  });

  it('a word card uses the tile layout: its mark sits on the corner disc, never in a column beside the Korean (F-A11Y-001 F6)', async () => {
    const r = await play();
    const layoutOf = (id: string): unknown => r.root.findAllByType(ChoiceCard).find((c) => c.props.testID === id)?.props.layout;
    for (const id of ['a', 'b', 'c']) expect(layoutOf(word(id))).toBe('tile');
  });

  it('a matched word card puts its number on the start corner, so it never covers the check on the end corner (F6)', async () => {
    const r = await play();
    await pair2(r, 'a');
    // The number is on both tiles of the pair: the picture column's (end corner) and the word column's (start corner).
    const corners = r.root
      .findAllByType(Pill)
      .filter((p) => p.props.label === '1')
      .map((p) => {
        let at: ReactTestInstance | null = p.parent;
        while (at && (at.props.style as { position?: string } | undefined)?.position !== 'absolute') at = at.parent;
        const style = (at?.props.style ?? {}) as { left?: number; right?: number };
        return style.left !== undefined ? 'start' : style.right !== undefined ? 'end' : 'none';
      });
    expect(corners).toEqual(['end', 'start']);
  });

  it('a matched pair shows check on both tiles and is named with the pair\'s number; each result is said once, a pair by its word and meaning', async () => {
    const r = await play();
    await pair2(r, 'a');
    expect(marks(pressable(r, pic('a')))).toEqual(['check']);
    expect(marks(pressable(r, word('a')))).toEqual(['check']);
    expect(String(pressable(r, word('a')).props['aria-label'])).toMatch(/^Matched, number 1: /);
    expect(announced(r)).toEqual([line({ kind: 'right', item: 'bap, rice' })]);
    expect(announced(r)[0]).not.toMatch(HANGUL);
  });

  it('a miss is said by the tile tried (a picture by its meaning, a word by its romanization), once; the miss that rings the partner carries the look-here line; the Hoya bubble is not live, the selection caption still is', async () => {
    const r = await play();
    await tap(r, pic('a'));
    await tick(450);
    await tap(r, word('b'));
    expect(announced(r)).toEqual([line({ kind: 'miss', item: 'san' })]);
    expect(bubbleLive(r)).toEqual([false]);
    await tick(450);
    await tap(r, word('c'));
    expect(announced(r)).toEqual([line({ kind: 'missHint', item: 'hanbok', hint: lookHereLine(m.a11y, 'bap') })]);
    expect(announced(r)[0]).not.toMatch(HANGUL);
    expect(liveRegions(r).filter((id) => id !== 'answer-announcer' && id !== 'pic-word-sound')).toHaveLength(1);
    expect(String(pressable(r, word('a')).props['aria-label'])).toMatch(/^Look here: /);
  });

  it('a picture tapped second is named by its meaning', async () => {
    const r = await play();
    await tap(r, word('a'));
    await tick(450);
    await tap(r, pic('b'));
    expect(announced(r)).toEqual([line({ kind: 'miss', item: 'mountain' })]);
  });

  it('iOS: one queued call per result', async () => {
    on('ios');
    const r = await play();
    await tap(r, pic('a'));
    await tick(450);
    await tap(r, word('b'));
    await tick(450);
    await tap(r, word('a'));
    expect(sr.queued).toEqual([line({ kind: 'miss', item: 'san' }), line({ kind: 'right', item: 'bap, rice' })]);
  });

  it('reader off: a pair before the last moves nothing; the last pair waits the 1000 ms floor (it was 700) and the next board opens, focus unmoved', async () => {
    const r = await play();
    await pair2(r, 'a');
    await tick(5_000);
    expect(byTestId(r.root, 'pic-word-next')).toEqual([]);
    await pair2(r, 'b');
    await tick(450);
    await tap(r, pic('c'));
    await tick(450);
    await tap(r, word('c'));
    await tick(700);
    expect(byTestId(r.root, pic('a2'))).toEqual([]);
    await tick(RESULT_MARK_MIN_MS - 700 - 1);
    expect(byTestId(r.root, pic('a2'))).toEqual([]);
    await tick(1);
    expect(byTestId(r.root, pic('a2')).length).toBeGreaterThan(0);
    expect(sr.focused).toEqual([]);
  });

  it('reader on: a pair before the last takes no Next and no focus, its word is said after its line; the last pair shows Next (the last board too), and the next board\'s header takes focus', async () => {
    readerOnWeb();
    const h = hostOf();
    const r = await play(scope, h);
    const spoken = audio.said.length;
    await pair2(r, 'a');
    expect(byTestId(r.root, 'pic-word-next')).toEqual([]);
    expect(sr.focused).toEqual([]);
    expect(audio.said).toHaveLength(spoken);
    await tick(announceWaitMs(line({ kind: 'right', item: 'bap, rice' })));
    expect(audio.said).toHaveLength(spoken + 1);
    await pair2(r, 'b');
    await pair2(r, 'c');
    expect(sr.focused).toEqual([expect.objectContaining({ testID: 'pic-word-next' })]);
    await tick(60_000);
    expect(byTestId(r.root, pic('a2'))).toEqual([]);
    await nextPress(r, 'pic-word-next');
    expect(byTestId(r.root, pic('a2')).length).toBeGreaterThan(0);
    expect(byTestId(r.root, 'pic-word-next')).toEqual([]);
    expect(announced(r)).toEqual([]);
    const header = host(r, 'pic-word-round');
    expect(sr.focused.at(-1)).toEqual(expect.objectContaining({ testID: 'pic-word-round' }));
    expect(String(header.props['aria-label'])).toBe(m.a11y.answer.round(2, 2, m.learner.minigame.picWord.heading));
    await pair2(r, 'a2');
    await pair2(r, 'b2');
    await pair2(r, 'c2');
    await nextPress(r, 'pic-word-next', 2);
    expect(h.completes).toBe(1);
  });

  it('reader on: Next pressed before a pair\'s line ends drops the word\'s sound', async () => {
    readerOnWeb();
    const r = await play(one);
    await pair2(r, 'a');
    await pair2(r, 'b');
    const spoken = audio.said.length;
    await pair2(r, 'c');
    await nextPress(r, 'pic-word-next');
    await tick(60_000);
    expect(audio.said.length).toBeLessThanOrEqual(spoken + 1);
  });
});
