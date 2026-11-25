import { HoyaBubble, Icon } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announceWaitMs, answerAnnouncement, answerItem, RESULT_MARK_MIN_MS, type AnswerResult } from '../../../logic/answer-feedback';
import { ADVANCE_MAX_MS } from '../../../logic/audio/reply-advance';
import type { MinigameScope } from '../../../logic/minigame-config';
import { endVoiceCheckHold, useAudioStore } from '../../../store/audio-store';
import { useLocaleStore } from '../../../store/locale-store';
import { byTestId, hostNodes, press, render, resetPlatform, screenTexts, setPlatform, unmount, type RenderPlatform } from '../../../test-support/render';
import { CultureQuizGame } from '../CultureQuizGame';
import { TapRespondGame } from '../TapRespondGame';

/**
 * F-A11Y-001 row AF-2 (§6 tests 11 and 12): Culture Quiz and Tap & Respond answer on `ChoiceCard` rows (OD-AF1 (B)), draw
 * a `check` on the right answer and a `replay` on a miss, name the state first, are never `disabled`, say each result
 * once through the answer announcer, wait the 1000 ms floor with the reader off, and with the reader on show Next
 * (OD-AF9 (b)), last round included, and move focus to the round's header node.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const sr = vi.hoisted(() => ({ enabled: false, queued: [] as string[], focused: [] as unknown[] }));
vi.mock('../../../platform/screen-reader', () => ({
  isScreenReaderEnabled: () => Promise.resolve(sr.enabled),
  subscribeScreenReader: () => () => undefined,
  announceQueued: (text: string) => {
    if ((globalThis as { __os?: string }).__os === 'ios') sr.queued.push(text);
  },
  announceAndWait: () => Promise.resolve(),
  focusForScreenReader: (node: unknown) => {
    sr.focused.push(node);
  },
}));

const audio = vi.hoisted(() => ({ said: [] as string[] }));
vi.mock('../../../platform/audio', async (orig) => ({
  ...(await orig<object>()),
  playPrompt: async (spec: { text: string }) => {
    audio.said.push(spec.text);
    return 'played';
  },
  stop: () => undefined,
}));
vi.mock('../../../platform/telemetry', async (orig) => ({ ...(await orig<object>()), track: vi.fn(async () => undefined) }));
vi.mock('../../../platform/haptics', async (orig) => ({ ...(await orig<object>()), nudge: () => undefined, success: () => undefined, tapLight: () => undefined }));

const m = getMessages('en');
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

const PAIRS = [
  { ko: '그네', en: 'swing', romanization: 'geune' },
  { ko: '모래', en: 'sand', romanization: 'morae' },
  { ko: '공', en: 'ball', romanization: 'gong' },
  { ko: '미끄럼틀', en: 'slide', romanization: 'mikkeureomteul' },
];
const QUIZ = { kind: 'culture-quiz', rounds: 2, cardPairs: PAIRS } as unknown as MinigameScope;
const TAP: MinigameScope = {
  kind: 'tap-respond',
  dialogue: [
    {
      npcKo: '안녕하세요!',
      npcEn: 'Hello!',
      npcRomanization: 'annyeonghaseyo',
      options: [
        { ko: '안녕하세요!', romanization: 'annyeonghaseyo', en: 'Hello!', isCorrect: true },
        { ko: '감사합니다.', romanization: 'gamsahamnida', en: 'Thank you.', isCorrect: false },
      ],
    },
    {
      npcKo: '이름이 뭐예요?',
      npcEn: 'What is your name?',
      options: [
        { ko: '저는 다미예요.', en: 'I am Dami.', isCorrect: true },
        { ko: '안녕히 가세요.', en: 'Goodbye.', isCorrect: false },
      ],
    },
  ],
};

const mounted: ReactTestRenderer[] = [];
/** Refs hand back a tagged object per testID, so a focus move can be told from another. */
const nodeMock = (el: { props: Record<string, unknown> }): unknown => ({ testID: el.props['data-testid'], focus: () => undefined, nodeType: 1, getBoundingClientRect: () => ({ height: 0, left: 0, top: 0, width: 0 }), addEventListener: () => undefined, removeEventListener: () => undefined });
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
/** The line a result is announced with, as the announcer builds it (a template's full stop after a sentence-ending item is dropped). */
const line = (result: AnswerResult): string => answerAnnouncement(result, m.a11y).map((x) => x.text).join('');
const readerOnWeb = (): void => useLocaleStore.setState({ screenReader: true });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  sr.enabled = false;
  sr.queued.length = 0;
  sr.focused.length = 0;
  audio.said = [];
  useAudioStore.setState({ muted: false });
  endVoiceCheckHold();
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

describe('Culture Quiz answers (test 11)', () => {
  const asked = (r: ReactTestRenderer): (typeof PAIRS)[number] => PAIRS.find((p) => screenTexts(r.root).includes(p.ko))!;
  const wrongOne = (r: ReactTestRenderer): string => PAIRS.find((p) => p.en !== asked(r).en)!.en;
  const optionId = (en: string): string => `culture-quiz-option-${en}`;

  it('a right answer shows check and is named "Right answer: …", never disabled', async () => {
    const r = await open(<CultureQuizGame scope={QUIZ} onFinish={() => undefined} />);
    const pair = asked(r);
    expect(marks(host(r, optionId(pair.en)))).toEqual([]);
    await press(pressable(r, optionId(pair.en)));
    const card = host(r, optionId(pair.en));
    expect(marks(card)).toEqual(['check']);
    expect(card.props['aria-label']).toBe(m.a11y.minigame.option.correct(pair.en));
    expect(card.props['aria-disabled']).not.toBe(true);
  });

  it('a miss shows replay, is named "Not this one: …", stays focusable and is not disabled; Hoya is not live', async () => {
    const r = await open(<CultureQuizGame scope={QUIZ} onFinish={() => undefined} />);
    const en = wrongOne(r);
    expect(bubbleLive(r)).toEqual([]);
    await press(pressable(r, optionId(en)));
    const card = host(r, optionId(en));
    expect(marks(card)).toEqual(['replay']);
    expect(card.props['aria-label']).toBe(m.a11y.minigame.option.wrong(en));
    expect(card.props['aria-disabled']).not.toBe(true);
    expect(card.props['aria-selected']).not.toBe(true);
    expect(bubbleLive(r)).toEqual([false]);
  });

  it('the announcer says each result once: the word and its meaning, then the meaning picked', async () => {
    const r = await open(<CultureQuizGame scope={QUIZ} onFinish={() => undefined} />);
    expect(announced(r)).toEqual([]);
    const pair = asked(r);
    const wrong = wrongOne(r);
    await press(pressable(r, optionId(wrong)));
    expect(announced(r)).toEqual([line({ kind: 'miss', item: wrong })]);
    await press(pressable(r, optionId(pair.en)));
    expect(announced(r)).toEqual([line({ kind: 'right', item: answerItem(m.a11y, pair.romanization, pair.en) })]);
    expect(announced(r)[0]).not.toMatch(HANGUL);
  });

  it('iOS: one queued call per result', async () => {
    on('ios');
    const r = await open(<CultureQuizGame scope={QUIZ} onFinish={() => undefined} />);
    const pair = asked(r);
    await press(pressable(r, optionId(pair.en)));
    expect(sr.queued).toEqual([line({ kind: 'right', item: answerItem(m.a11y, pair.romanization, pair.en) })]);
  });

  it('reader off: the next round comes after the floor, and focus does not move', async () => {
    const r = await open(<CultureQuizGame scope={QUIZ} onFinish={() => undefined} />);
    const first = asked(r);
    await press(pressable(r, optionId(first.en)));
    await tick(RESULT_MARK_MIN_MS - 1);
    expect(asked(r)).toBe(first);
    await tick(1);
    expect(asked(r)).not.toBe(first);
    expect(sr.focused).toEqual([]);
    expect(announced(r)).toEqual([]);
    expect(byTestId(r.root, 'culture-quiz-next')).toEqual([]);
  });

  it('reader off: the last right answer ends the step after the floor', async () => {
    const finish = vi.fn();
    const r = await open(<CultureQuizGame scope={{ ...QUIZ, rounds: 1 } as MinigameScope} onFinish={finish} />);
    await press(pressable(r, optionId(asked(r).en)));
    await tick(RESULT_MARK_MIN_MS - 1);
    expect(finish).not.toHaveBeenCalled();
    await tick(1);
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('reader on: Next takes focus after a right answer, nothing moves on by itself, then focus goes to the header node', async () => {
    readerOnWeb();
    const r = await open(<CultureQuizGame scope={QUIZ} onFinish={() => undefined} />);
    const first = asked(r);
    expect(byTestId(r.root, 'culture-quiz-next')).toEqual([]);
    await press(pressable(r, optionId(wrongOne(r))));
    expect(byTestId(r.root, 'culture-quiz-next')).toEqual([]);
    await press(pressable(r, optionId(first.en)));
    expect(byTestId(r.root, 'culture-quiz-next').length).toBeGreaterThan(0);
    expect(sr.focused).toEqual([expect.objectContaining({ testID: 'culture-quiz-next' })]);
    await tick(60_000);
    expect(asked(r)).toBe(first);
    expect(announced(r)).toEqual([line({ kind: 'right', item: answerItem(m.a11y, first.romanization, first.en) })]);

    await press(pressable(r, 'culture-quiz-next'));
    expect(asked(r)).not.toBe(first);
    expect(byTestId(r.root, 'culture-quiz-next')).toEqual([]);
    expect(announced(r)).toEqual([]);
    const header = host(r, 'culture-quiz-round');
    expect(sr.focused.at(-1)).toEqual(expect.objectContaining({ testID: 'culture-quiz-round' }));
    expect(header.props.role).toBe('heading');
    expect(String(header.props['aria-label'])).toBe(m.a11y.answer.round(2, 2, `${m.learner.minigame.cultureQuiz.heading} ${asked(r).romanization}`));
    expect(String(header.props['aria-label'])).not.toMatch(HANGUL);
  });

  it('reader on: the last round also shows Next, and the step ends when it is pressed', async () => {
    readerOnWeb();
    const finish = vi.fn();
    const r = await open(<CultureQuizGame scope={{ ...QUIZ, rounds: 1 } as MinigameScope} onFinish={finish} />);
    await press(pressable(r, optionId(asked(r).en)));
    await tick(60_000);
    expect(finish).not.toHaveBeenCalled();
    await press(pressable(r, 'culture-quiz-next'));
    expect(finish).toHaveBeenCalledTimes(1);
  });
});

describe('Tap & Respond replies (test 12)', () => {
  const opt = (ko: string): string => `tap-respond-option-${ko}`;
  const reply = (r: ReactTestRenderer, ko: string): ReactTestInstance => host(r, opt(ko));
  const settle = async (): Promise<void> => tick(500);

  it('a right reply shows check and is named "Right answer: …"; a miss shows replay, is named "Not this one: …", not disabled', async () => {
    const r = await open(<TapRespondGame scope={TAP} onFinish={() => undefined} />);
    await settle();
    await press(pressable(r, opt('감사합니다.')));
    const miss = reply(r, '감사합니다.');
    expect(marks(miss)).toEqual(['replay']);
    expect(String(miss.props['aria-label'])).toMatch(/^Not this one: /);
    expect(miss.props['aria-disabled']).not.toBe(true);
    expect(bubbleLive(r)).toEqual([false]);
    await press(pressable(r, opt('안녕하세요!')));
    const right = reply(r, '안녕하세요!');
    expect(marks(right)).toEqual(['check']);
    expect(String(right.props['aria-label'])).toMatch(/^Right answer: /);
    expect(right.props['aria-disabled']).not.toBe(true);
  });

  it('the announcer says "Not this one: …" and "Right answer: …" once each, with no Hangul', async () => {
    const r = await open(<TapRespondGame scope={TAP} onFinish={() => undefined} />);
    await settle();
    await press(pressable(r, opt('감사합니다.')));
    expect(announced(r)).toEqual([line({ kind: 'miss', item: answerItem(m.a11y, 'gamsahamnida', 'Thank you.') })]);
    await press(pressable(r, opt('안녕하세요!')));
    expect(announced(r)).toEqual([line({ kind: 'right', item: answerItem(m.a11y, 'annyeonghaseyo', 'Hello!') })]);
    expect(announced(r)[0]).not.toMatch(HANGUL);
  });

  it('a reply with no romanization is named by its meaning alone', async () => {
    const r = await open(<TapRespondGame scope={{ ...TAP, dialogue: [TAP.dialogue![1]!] }} onFinish={() => undefined} />);
    await settle();
    await press(pressable(r, opt('저는 다미예요.')));
    expect(announced(r)).toEqual([line({ kind: 'right', item: 'I am Dami.' })]);
  });

  it('iOS: one queued call per result', async () => {
    on('ios');
    const r = await open(<TapRespondGame scope={TAP} onFinish={() => undefined} />);
    await settle();
    await press(pressable(r, opt('감사합니다.')));
    await press(pressable(r, opt('안녕하세요!')));
    expect(sr.queued).toEqual([
      line({ kind: 'miss', item: answerItem(m.a11y, 'gamsahamnida', 'Thank you.') }),
      line({ kind: 'right', item: answerItem(m.a11y, 'annyeonghaseyo', 'Hello!') }),
    ]);
  });

  it('reader off: the reply is said, the next turn waits for the floor, and focus does not move', async () => {
    const r = await open(<TapRespondGame scope={TAP} onFinish={() => undefined} />);
    await settle();
    audio.said = [];
    await press(pressable(r, opt('안녕하세요!')));
    expect(audio.said).toEqual(['안녕하세요!']);
    await tick(RESULT_MARK_MIN_MS - 1);
    expect(audio.said).toEqual(['안녕하세요!']);
    await tick(1);
    expect(audio.said).toEqual(['안녕하세요!', '이름이 뭐예요?']);
    expect(sr.focused).toEqual([]);
  });

  it('reader on: Next takes focus, the reply starts after the line, nothing moves on until Next, then focus goes to the header node', async () => {
    readerOnWeb();
    const r = await open(<TapRespondGame scope={TAP} onFinish={() => undefined} />);
    await settle();
    audio.said = [];
    await press(pressable(r, opt('안녕하세요!')));
    expect(sr.focused).toEqual([expect.objectContaining({ testID: 'tap-respond-next' })]);
    expect(audio.said).toEqual([]);
    const said = line({ kind: 'right', item: answerItem(m.a11y, 'annyeonghaseyo', 'Hello!') });
    await tick(announceWaitMs(said));
    expect(audio.said).toEqual(['안녕하세요!']);
    await tick(ADVANCE_MAX_MS * 2);
    expect(audio.said).toEqual(['안녕하세요!']);
    expect(byTestId(r.root, 'tap-respond-next').length).toBeGreaterThan(0);

    await press(pressable(r, 'tap-respond-next'));
    expect(byTestId(r.root, 'tap-respond-next')).toEqual([]);
    expect(announced(r)).toEqual([]);
    const header = host(r, 'tap-respond-round');
    expect(sr.focused.at(-1)).toEqual(expect.objectContaining({ testID: 'tap-respond-round' }));
    expect(header.props.role).toBe('heading');
    // The first turn's NPC line has a romanization; the label names it by that, never by its Hangul.
    expect(String(header.props['aria-label'])).toBe(m.a11y.answer.round(2, 2, `${m.learner.minigame.tapRespond.someoneSays} What is your name?`));
    expect(String(header.props['aria-label'])).not.toMatch(HANGUL);
  });

  it('reader on: the last turn also shows Next, and the step ends when it is pressed', async () => {
    readerOnWeb();
    const finish = vi.fn();
    const r = await open(<TapRespondGame scope={{ ...TAP, dialogue: [TAP.dialogue![1]!] }} onFinish={finish} />);
    await settle();
    await press(pressable(r, opt('저는 다미예요.')));
    await tick(60_000);
    expect(finish).not.toHaveBeenCalled();
    await press(pressable(r, 'tap-respond-next'));
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('the node of the round wraps the Card text only; Hear it stays its sibling', async () => {
    const r = await open(<TapRespondGame scope={TAP} onFinish={() => undefined} />);
    const header = host(r, 'tap-respond-round');
    expect(byTestId(header, 'tap-respond-hear')).toEqual([]);
    expect(host(r, 'tap-respond-hear')).toBeDefined();
  });
});
