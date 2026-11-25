import { HoyaBubble, Icon, spacing } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESULT_MARK_MIN_MS, answerAnnouncement, answerItem, type AnswerResult } from '../../../logic/answer-feedback';
import { cardTopPadding } from '../card-match-style';
import type { MinigameScope } from '../../../logic/minigame-config';
import { endVoiceCheckHold, useAudioStore } from '../../../store/audio-store';
import { useLocaleStore } from '../../../store/locale-store';
import { byTestId, hostNodes, press, render, resetPlatform, setPlatform, unmount, type RenderPlatform } from '../../../test-support/render';
import { CardMatchGame } from '../CardMatchGame';

/**
 * F-A11Y-001 row AF-3 (§6 test 13): Card Match draws a `check` on both cards of a right pair at full opacity and names
 * them "Right answer: …", never `disabled`; a miss marks the meaning tried (`replay`, "Not this one: …") and it stays
 * while the same Korean word is picked, with the Korean pick held, Hoya `thinking` and a bubble that is not live; each
 * result is said once through the announcer; the last pair waits the 1000 ms floor with the reader off, and with the
 * reader on shows Next and waits for it (OD-AF9 (b)), with focus on Next before the line is queued. The pick's solid
 * second ring is a negative-margin wrapper outside the hit area (AnswerFeedback D5).
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

/** `log` is one ordered record of the focus moves and the queued-and-awaited iOS lines. */
const sr = vi.hoisted(() => ({ enabled: false, queued: [] as string[], focused: [] as unknown[], log: [] as string[] }));
vi.mock('../../../platform/screen-reader', () => ({
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

vi.mock('../../../platform/audio', async (orig) => ({ ...(await orig<object>()), playPrompt: async () => 'played', stop: () => undefined }));
vi.mock('../../../platform/haptics', async (orig) => ({ ...(await orig<object>()), nudge: () => undefined, success: () => undefined, tapLight: () => undefined }));
const run = vi.hoisted(() => ({ answers: [] as Array<[string, boolean]>, completes: 0 }));
vi.mock('../../../store/quest-run-store', () => {
  const state = {
    answerRound: (key: string, correct: boolean) => void run.answers.push([key, correct]),
    markStepComplete: () => {
      run.completes += 1;
    },
  };
  return { useQuestRunStore: Object.assign(<T,>(select: (s: typeof state) => T) => select(state), { getState: () => state }) };
});

const m = getMessages('en');
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

const PAIRS = [
  { ko: '그네', en: 'swing', romanization: 'geune' },
  { ko: '미끄럼틀', en: 'slide', romanization: 'mikkeureomteul' },
  { ko: '모래', en: 'sand', romanization: 'morae' },
];
const SCOPE = { kind: 'card-match', rounds: PAIRS.length, cardPairs: PAIRS } as unknown as MinigameScope;
const NO_ROMANIZATION = { kind: 'card-match', rounds: 2, cardPairs: [{ ko: '공', en: 'ball' }, { ko: '모래', en: 'sand' }] } as unknown as MinigameScope;
const [GEUNE, SLIDE, MORAE] = [0, 1, 2];

let finishes = 0;
const mounted: ReactTestRenderer[] = [];
/** Refs hand back a tagged object per testID, so a focus move can be told from another. */
const nodeMock = (el: { props: Record<string, unknown> }): unknown => ({ testID: el.props['data-testid'], focus: () => undefined, nodeType: 1, getBoundingClientRect: () => ({ height: 0, left: 0, top: 0, width: 0 }), addEventListener: () => undefined, removeEventListener: () => undefined });
const open = async (scope: MinigameScope = SCOPE): Promise<ReactTestRenderer> => {
  const r = await render(<CardMatchGame scope={scope} onFinish={() => void (finishes += 1)} />, { createNodeMock: nodeMock });
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

const card = (r: ReactTestRenderer, side: 'ko' | 'en', idx: number): ReactTestInstance => {
  const node = byTestId(r.root, `card-match-${side}-${idx}`).find((n) => n.props.role === 'button');
  if (!node) throw new Error(`no ${side}-${idx}`);
  return node;
};
const tap = (r: ReactTestRenderer, side: 'ko' | 'en', idx: number): Promise<void> => press(card(r, side, idx));
const marks = (node: ReactTestInstance): string[] => node.findAll((n) => n.type === Icon).map((n) => String(n.props.name));
const label = (r: ReactTestRenderer, side: 'ko' | 'en', idx: number): string => String(card(r, side, idx).props['aria-label']);
const announced = (r: ReactTestRenderer): string[] =>
  hostNodes(byTestId(r.root, 'answer-announcer')[0]!, () => true)
    .flatMap((n) => n.children)
    .filter((c): c is string => typeof c === 'string');
const bubbles = (r: ReactTestRenderer): Array<{ tone: string; message: string; live: boolean }> =>
  r.root.findAllByType(HoyaBubble).map((b) => ({ tone: String(b.props.tone), message: String(b.props.message), live: b.props.live !== false }));
/** The line a result is announced with, as the announcer builds it. */
const line = (result: AnswerResult): string => answerAnnouncement(result, m.a11y).map((x) => x.text).join('');
const nextButton = (r: ReactTestRenderer): ReactTestInstance[] => byTestId(r.root, 'card-match-next').filter((n) => typeof n.props.onClick === 'function');
/** Every opacity below 1 in the card's subtree (a matched card used to be drawn at 0.5). */
const fades = (node: ReactTestInstance): unknown[] =>
  node.findAll((n) => typeof n.type === 'string').flatMap((n) => {
    const style = ([] as unknown[]).concat(n.props.style ?? []).flat(4) as Array<{ opacity?: unknown } | null | undefined>;
    return style.map((x) => x?.opacity).filter((o) => o !== undefined && o !== 1);
  });
const matchAll = async (r: ReactTestRenderer, upto = PAIRS.length): Promise<void> => {
  for (let i = 0; i < upto; i += 1) {
    await tap(r, 'ko', i);
    await tap(r, 'en', i);
  }
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  sr.enabled = false;
  sr.queued.length = 0;
  sr.focused.length = 0;
  sr.log.length = 0;
  run.answers = [];
  run.completes = 0;
  finishes = 0;
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

describe('Card Match marks and names (test 13)', () => {
  it('a right pair shows check on both cards, at full opacity, named "Right answer: …", never disabled', async () => {
    const r = await open();
    expect([marks(card(r, 'ko', GEUNE)), marks(card(r, 'en', GEUNE))]).toEqual([[], []]);
    await tap(r, 'ko', GEUNE);
    await tap(r, 'en', GEUNE);
    for (const side of ['ko', 'en'] as const) {
      expect(marks(card(r, side, GEUNE)), side).toEqual(['check']);
      expect(fades(card(r, side, GEUNE)), `${side} is drawn at full opacity`).toEqual([]);
      expect(card(r, side, GEUNE).props['aria-disabled'], side).not.toBe(true);
    }
    expect(label(r, 'ko', GEUNE)).toBe(m.a11y.minigame.option.correct(m.a11y.minigame.koreanWord('geune')));
    expect(label(r, 'en', GEUNE)).toBe(m.a11y.minigame.option.correct(m.a11y.minigame.meaning('swing')));
    // The cards that are not matched yet keep their plain names and marks.
    expect(label(r, 'ko', SLIDE)).toBe(m.a11y.minigame.koreanWord('mikkeureomteul'));
    expect(marks(card(r, 'ko', SLIDE))).toEqual([]);
  });

  it('a matched card is inactive (claimed by the board, still focusable) and a tap on it does nothing', async () => {
    const r = await open();
    await tap(r, 'ko', GEUNE);
    await tap(r, 'en', GEUNE);
    await tap(r, 'ko', GEUNE);
    expect(run.answers).toEqual([['pair-0', true]]);
    await tap(r, 'ko', SLIDE);
    await tap(r, 'en', GEUNE);
    expect(run.answers).toEqual([['pair-0', true]]);
  });

  it('a miss marks the meaning tried: replay, "Not this one: …", focusable, not disabled, not selected', async () => {
    const r = await open();
    await tap(r, 'ko', GEUNE);
    await tap(r, 'en', MORAE);
    expect(marks(card(r, 'en', MORAE))).toEqual(['replay']);
    expect(label(r, 'en', MORAE)).toBe(m.a11y.minigame.option.wrong(m.a11y.minigame.meaning('sand')));
    expect(card(r, 'en', MORAE).props['aria-disabled']).not.toBe(true);
    expect(card(r, 'en', MORAE).props['aria-selected']).not.toBe(true);
    // The Korean card stays picked, with no mark of its own.
    expect(card(r, 'ko', GEUNE).props['aria-selected']).toBe(true);
    expect(marks(card(r, 'ko', GEUNE))).toEqual([]);
    expect(label(r, 'ko', GEUNE)).toBe(m.a11y.minigame.koreanWord('geune'));
  });

  it('the mark is still there 10 s later, and a second wrong meaning for the same word is marked too', async () => {
    const r = await open();
    await tap(r, 'ko', GEUNE);
    await tap(r, 'en', MORAE);
    await tick(10_000);
    expect(marks(card(r, 'en', MORAE))).toEqual(['replay']);
    await tap(r, 'en', SLIDE);
    expect([marks(card(r, 'en', MORAE)), marks(card(r, 'en', SLIDE))]).toEqual([['replay'], ['replay']]);
    expect(run.answers).toEqual([
      ['pair-0', false],
      ['pair-0', false],
    ]);
    // Another meaning is then scored: the right one matches and the marks clear.
    await tap(r, 'en', GEUNE);
    expect(run.answers.at(-1)).toEqual(['pair-0', true]);
    expect([marks(card(r, 'en', MORAE)), marks(card(r, 'en', SLIDE))]).toEqual([[], []]);
  });

  it('picking another Korean word clears the marks, and tapping the same word again keeps them', async () => {
    const r = await open();
    await tap(r, 'ko', GEUNE);
    await tap(r, 'en', MORAE);
    await tap(r, 'ko', GEUNE);
    expect(marks(card(r, 'en', MORAE))).toEqual(['replay']);
    await tap(r, 'ko', SLIDE);
    expect(marks(card(r, 'en', MORAE))).toEqual([]);
    expect(label(r, 'en', MORAE)).toBe(m.a11y.minigame.meaning('sand'));
    // The meaning that missed for geune is a fresh try for slide: it scores again.
    await tap(r, 'en', MORAE);
    expect(run.answers.at(-1)).toEqual(['pair-1', false]);
  });
});

describe('Hoya on a miss (OD-AF6 (a))', () => {
  it('the pick prompt is live; a miss makes it a thinking bubble with tryAnother that is not live; it comes back when the marks clear', async () => {
    const r = await open();
    expect(bubbles(r)).toEqual([]);
    await tap(r, 'ko', GEUNE);
    expect(bubbles(r)).toEqual([{ tone: 'idle', message: m.learner.minigame.cardMatch.nowMeaning, live: true }]);
    await tap(r, 'en', MORAE);
    expect(bubbles(r)).toEqual([{ tone: 'thinking', message: m.learner.minigame.cardMatch.tryAnother, live: false }]);
    await tick(10_000);
    expect(bubbles(r)).toEqual([{ tone: 'thinking', message: m.learner.minigame.cardMatch.tryAnother, live: false }]);
    await tap(r, 'ko', SLIDE);
    expect(bubbles(r)).toEqual([{ tone: 'idle', message: m.learner.minigame.cardMatch.nowMeaning, live: true }]);
  });
});

describe('the pick ring and the top band (AnswerFeedback D5)', () => {
  const ring = (r: ReactTestRenderer, idx: number): ReactTestInstance => byTestId(r.root, `card-match-ko-ring-${idx}`).find((n) => typeof n.type === 'string')!;
  const css = (node: ReactTestInstance): Record<string, unknown> => Object.assign({}, ...([] as unknown[]).concat(node.props.style ?? []).flat(4));
  const px = (v: unknown): number => Number.parseFloat(String(v));

  it('only the picked card has the solid second ring: a negative-margin wrapper, 3 dp thick, outside the hit area', async () => {
    const r = await open();
    expect(px(css(ring(r, GEUNE)).borderTopWidth ?? 0)).toBe(0);
    await tap(r, 'ko', GEUNE);
    const picked = css(ring(r, GEUNE));
    expect(px(picked.borderTopWidth)).toBe(3);
    expect(px(picked.marginTop)).toBe(-5);
    expect(px(css(ring(r, SLIDE)).borderTopWidth ?? 0)).toBe(0);
    // The wrapper is not a button: the hit area is the card inside it.
    expect(ring(r, GEUNE).props.role).not.toBe('button');
    expect(typeof ring(r, GEUNE).props.onClick).not.toBe('function');
    expect(card(r, 'ko', GEUNE)).toBeDefined();
  });

  it('the ring costs no layout: padding plus border is the same in every state', async () => {
    const r = await open();
    const total = (idx: number): number => {
      const s = css(ring(r, idx));
      return px(s.borderTopWidth ?? 0) + px(s.paddingTop);
    };
    const before = total(GEUNE);
    expect(before).toBe(5);
    await tap(r, 'ko', GEUNE);
    expect(total(GEUNE)).toBe(before);
  });

  it('every card keeps the top band max(spacing.xl, cardPadding) in every state, so answering never moves the text', async () => {
    const r = await open();
    const band = (side: 'ko' | 'en', idx: number): number => {
      const drawn = card(r, side, idx).findAll((n) => typeof n.type === 'string' && css(n).paddingTop !== undefined)[0]!;
      return px(css(drawn).paddingTop);
    };
    const expected = cardTopPadding(spacing.md);
    expect(expected).toBeGreaterThanOrEqual(spacing.xl);
    const idle = band('en', MORAE);
    expect(idle).toBe(expected);
    expect(idle).toBe(band('ko', GEUNE));
    await tap(r, 'ko', GEUNE);
    await tap(r, 'en', MORAE);
    await tap(r, 'en', GEUNE);
    expect(band('en', MORAE), 'a marked meaning').toBe(idle);
    expect(band('ko', GEUNE), 'a matched card').toBe(idle);
    await tap(r, 'ko', SLIDE);
    expect(band('ko', SLIDE), 'a picked card').toBe(idle);
  });
});

describe('the announcer says each result once', () => {
  it('a miss: "Not a match: geune and sand."; a right pair: "Right answer: geune, swing." (no Hangul)', async () => {
    const r = await open();
    expect(announced(r)).toEqual([]);
    await tap(r, 'ko', GEUNE);
    await tap(r, 'en', MORAE);
    expect(announced(r)).toEqual([line({ kind: 'notMatched', word: 'geune', meaning: 'sand' })]);
    await tap(r, 'en', GEUNE);
    expect(announced(r)).toEqual([line({ kind: 'right', item: answerItem(m.a11y, 'geune', 'swing') })]);
    expect(announced(r).join('')).not.toMatch(HANGUL);
  });

  it('the same line twice in a row is read again (a new key), and a new Korean pick empties the stale line', async () => {
    const r = await open();
    await tap(r, 'ko', GEUNE);
    await tap(r, 'en', MORAE);
    const first = byTestId(r.root, 'answer-announcer')[0]!.findAll((n) => n.type === 'div' || typeof n.type === 'string').length;
    await tap(r, 'ko', SLIDE);
    expect(announced(r)).toEqual([]);
    expect(first).toBeGreaterThan(0);
    await tap(r, 'ko', GEUNE);
    await tap(r, 'en', MORAE);
    expect(announced(r)).toEqual([line({ kind: 'notMatched', word: 'geune', meaning: 'sand' })]);
  });

  it('a pair with no romanization is named by its meaning alone, never by its Hangul', async () => {
    const r = await open(NO_ROMANIZATION);
    await tap(r, 'ko', 0);
    await tap(r, 'en', 1);
    expect(announced(r)).toEqual([line({ kind: 'miss', item: 'sand' })]);
    await tap(r, 'en', 0);
    expect(announced(r)).toEqual([line({ kind: 'right', item: 'ball' })]);
    expect(announced(r).join('')).not.toMatch(HANGUL);
  });

  it('iOS: one queued call per result', async () => {
    on('ios');
    const r = await open();
    await tap(r, 'ko', GEUNE);
    await tap(r, 'en', MORAE);
    await tap(r, 'en', GEUNE);
    expect(sr.queued).toEqual([line({ kind: 'notMatched', word: 'geune', meaning: 'sand' }), line({ kind: 'right', item: answerItem(m.a11y, 'geune', 'swing') })]);
  });

  it('Android and the web make no announce call', async () => {
    on('android');
    const r = await open();
    await tap(r, 'ko', GEUNE);
    await tap(r, 'en', GEUNE);
    expect(sr.queued).toEqual([]);
  });
});

describe('the last pair, reader off', () => {
  it('ends the step after the 1000 ms floor (Card Match\'s own 800 is shorter), once, with no Next and no focus move', async () => {
    const r = await open();
    await matchAll(r);
    expect(nextButton(r)).toHaveLength(0);
    await tick(RESULT_MARK_MIN_MS - 1);
    expect(finishes).toBe(0);
    await tick(1);
    expect([finishes, run.completes]).toEqual([1, 1]);
    expect(sr.focused).toEqual([]);
  });
});

describe('Next with a reader on (OD-AF9 (b))', () => {
  beforeEach(() => useLocaleStore.setState({ screenReader: true }));

  it('a pair before the last shows no Next and moves no focus', async () => {
    const r = await open();
    await matchAll(r, 2);
    expect(nextButton(r)).toHaveLength(0);
    expect(sr.focused).toEqual([]);
    expect(announced(r)).toEqual([line({ kind: 'right', item: answerItem(m.a11y, 'mikkeureomteul', 'slide') })]);
  });

  it('the last pair shows Next, focus goes to it before the line is said, and the step waits for it', async () => {
    const r = await open();
    await matchAll(r, 2);
    await tap(r, 'ko', MORAE);
    await tap(r, 'en', MORAE);
    expect(nextButton(r)).toHaveLength(1);
    expect(announced(r)).toEqual([line({ kind: 'right', item: answerItem(m.a11y, 'morae', 'sand') })]);
    expect(sr.log.filter((x) => x.startsWith('focus'))).toEqual(['focus: card-match-next']);
    await tick(30_000);
    expect([finishes, run.completes]).toEqual([0, 0]);
    await press(nextButton(r)[0]!);
    expect([finishes, run.completes]).toEqual([1, 1]);
  });

  it('iOS: focus on Next, then the queued line', async () => {
    on('ios');
    sr.enabled = true;
    const r = await open();
    await tick(0);
    await matchAll(r, 2);
    await tap(r, 'ko', MORAE);
    await tap(r, 'en', MORAE);
    const last = line({ kind: 'right', item: answerItem(m.a11y, 'morae', 'sand') });
    expect(sr.log.slice(-2)).toEqual(['focus: card-match-next', `announce: ${last}`]);
  });

  it('a second press on Next ends the step once', async () => {
    const r = await open();
    await matchAll(r);
    // The second tap is a late one on the node as it was drawn (Next is gone by then).
    const shown = nextButton(r)[0]!;
    const next = { props: shown.props, type: shown.type } as ReactTestInstance;
    await press(next);
    await press(next);
    expect([finishes, run.completes]).toEqual([1, 1]);
  });

  it('leaving with Next up ends nothing later', async () => {
    const r = await open();
    await matchAll(r);
    await unmount(r);
    await tick(30_000);
    expect([finishes, run.completes]).toEqual([0, 0]);
  });
});
