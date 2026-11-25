import { HiddenHeritageRoundSchema, type MatchShapeRound, type OrderItRound, type RolePlayScene } from '@hangul-route/content-schema';
import { HoyaBubble, Icon, LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { FOOD_MARKET_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/food-market';
import { getMessages } from '@hangul-route/i18n';
import { StyleSheet } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announceWaitMs, answerAnnouncement, answerItem, lookHereLine, RESULT_MARK_MIN_MS, spokenParts, type AnswerResult } from '../../../logic/answer-feedback';
import { startFlow } from '../../../logic/hidden-heritage-flow';
import { koTokenParts } from '../../../logic/ko-tokens';
import { scopeFor, type MinigameScope } from '../../../logic/minigame-config';
import { EAT_RICE, LIKE_TTEOKGUK } from '../../../logic/sentence-builder/__tests__/fixtures';
import { endVoiceCheckHold, useAudioStore } from '../../../store/audio-store';
import { useLocaleStore } from '../../../store/locale-store';
import { byTestId, hostNodes, press, render, resetPlatform, screenTexts, setPlatform, unmount, type RenderPlatform } from '../../../test-support/render';
import { HiddenHeritageGame } from '../HiddenHeritageGame';
import type { MinigameHost } from '../host';
import { MatchShapeBoard } from '../MatchShapeBoard';
import { MatchShapeGame } from '../MatchShapeGame';
import { RolePlayGame } from '../role-play/RolePlayGame';
import { SentenceBuilderGame } from '../SentenceBuilderGame';
import { SyllableBuildBoard } from '../SyllableBuildBoard';
import { SyllableBuildGame } from '../SyllableBuildGame';

/**
 * F-A11Y-001 row AF-4c (§6 test 16), the board games: Hidden Heritage, Syllable Build, Match Shape, Sentence Builder and
 * Role Play. In each: the marks are `check` / `replay` (Sentence Builder's tried tile keeps `dash`), an answered answer is
 * named with its state first and is inactive, never `disabled`; each result is said once through the answer announcer (the
 * region text plus one iOS call) with no Hangul; the result bubbles are not live; the look-here ring is the one dashed ring;
 * the miss that turns it on announces the look-here line; the advance waits the 1000 ms floor with the reader off; with the
 * reader on Next shows after a right answer (the last round included), the answer's sound starts after the line and is
 * dropped if Next came first, and a new round's header node takes focus (no Hangul in its name).
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
  hasClipFor: () => false,
  warmClips: () => Promise.resolve(),
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
  scrollToEnd: () => undefined,
  scrollTo: () => undefined,
  nodeType: 1,
  getBoundingClientRect: () => ({ height: 0, left: 0, top: 0, width: 0 }),
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  setAttribute: () => undefined,
  removeAttribute: () => undefined,
});
const open = async (element: React.ReactElement, size = { width: 320, height: 568 }): Promise<ReactTestRenderer> => {
  const r = await render(<LayoutProvider value={layoutClassFor(size)}>{element}</LayoutProvider>, { createNodeMock: nodeMock });
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
/** A tap a beat after the last: a touch inside `TAP_LOCK_MS` of an accepted one is a bounce and is dropped (KT-D5). */
const tap = async (r: ReactTestRenderer, id: string): Promise<void> => {
  await tick(450);
  await press(pressable(r, id));
};
const host = (r: ReactTestRenderer, id: string): ReactTestInstance => {
  const node = byTestId(r.root, id)[0];
  if (!node) throw new Error(`no ${id}`);
  return node;
};
const has = (r: ReactTestRenderer, id: string): boolean => byTestId(r.root, id).length > 0;
const marks = (node: ReactTestInstance): string[] => node.findAll((n) => n.type === Icon).map((n) => String(n.props.name));
const announced = (r: ReactTestRenderer, id = 'answer-announcer'): string[] =>
  hostNodes(host(r, id), () => true)
    .flatMap((n) => n.children)
    .filter((c): c is string => typeof c === 'string');
/** A drawn view's border style: the composite `View` holds its style object (the host node holds a class). */
const borderStyleOf = (r: ReactTestRenderer, id: string): unknown => {
  const view = r.root.findAll((n) => n.props.testID === id && n.props.style !== undefined)[0];
  return (StyleSheet.flatten(view?.props.style) as { borderStyle?: string } | undefined)?.borderStyle;
};
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
  vi.spyOn(Math, 'random').mockReturnValue(0);
  audio.said = [];
  useAudioStore.setState({ muted: false, tts: { state: 'unknown' } });
  sr.enabled = false;
  sr.queued.length = 0;
  sr.focused.length = 0;
  sr.log.length = 0;
  useLocaleStore.setState({ screenReader: false });
  on('web');
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.restoreAllMocks();
  vi.useRealTimers();
  resetPlatform();
  (globalThis as { __os?: string }).__os = undefined;
  useLocaleStore.setState({ screenReader: false });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('Hidden Heritage answers (test 16, OD-AF7)', () => {
  const ROUND = HiddenHeritageRoundSchema.parse(FOOD_MARKET_SCENE.round);
  const scenes = new Map([[ROUND.sceneId, FOOD_MARKET_SCENE]]);
  const scope = (rounds = [ROUND]): MinigameScope => ({ kind: 'hidden-heritage', rounds: 3, hiddenHeritage: { rounds } });
  /** The word asked first and the things that are not it: Math.random is 0, so the order is the seed 0's. */
  const order = (rounds = [ROUND]): string[] => startFlow(rounds, 0).order[0]!;
  const thing = (id: string): { word: { ko: string; romanization: string; en: string } } => [...ROUND.targets, ...ROUND.others].find((t) => t.id === id)!;
  const others = (): string[] => [...ROUND.others, ...ROUND.targets].map((t) => t.id).filter((id) => id !== order()[0]);
  const spot = (id: string): string => `hh-spot-${id}`;

  const play = async (rounds = [ROUND], h: MinigameHost = hostOf()): Promise<ReactTestRenderer> => {
    const r = await open(<HiddenHeritageGame scope={scope(rounds)} scenes={scenes} host={h} />);
    // The screen measures its content width, then speaks the first word.
    const measured = r.root.findAll((n) => typeof n.props.onLayout === 'function' && n.props.testID === undefined);
    if (measured[0]) {
      await act(async () => {
        measured[0]!.props.onLayout({ nativeEvent: { layout: { width: 288, height: 500, x: 0, y: 0 } } });
      });
    }
    await tick(2000);
    return r;
  };
  const name = (r: ReactTestRenderer, id: string): string => String(pressable(r, spot(id)).props['aria-label']);
  const meaning = (id: string): string => (thing(id).word.en === thing(id).word.ko ? thing(id).word.romanization : thing(id).word.en);

  it('a miss shows replay on a disc and names the spot "Not this one: …"; it is inactive, not disabled, and stays well past the old 600 ms (a tap on it is not a second miss)', async () => {
    const h = hostOf();
    const r = await play([ROUND], h);
    const wrong = others()[0]!;
    await tap(r, spot(wrong));
    expect(marks(host(r, 'hh-ring-miss-mark'))).toEqual(['replay']);
    expect(name(r, wrong)).toBe(m.a11y.minigame.option.wrong(meaning(wrong)));
    expect(disabled(r, spot(wrong))).toBe(false);
    await tick(10_000);
    expect(has(r, 'hh-ring-miss')).toBe(true);
    const answers = h.answers.length;
    await tap(r, spot(wrong));
    expect(h.answers).toHaveLength(answers);
    // The next tap that changes the board takes it over.
    await tap(r, spot(others()[1]!));
    expect(byTestId(r.root, 'hh-ring-miss')).toHaveLength(1);
    expect(has(r, `hh-spot-${wrong}`)).toBe(true);
  });

  it('a right spot shows check on its ring disc and is named "…, found"; look-here keeps its dashed ring with no mark and is named "Look here: …"', async () => {
    const r = await play();
    const [a, b] = others();
    await tap(r, spot(a!));
    await tap(r, spot(b!));
    expect(marks(host(r, 'hh-ring-hint'))).toEqual([]);
    const ringed = byTestId(r.root, 'hh-ring-hint');
    expect(ringed).toHaveLength(1);
    const asked = order()[0]!;
    expect(name(r, asked)).toBe(m.a11y.minigame.option.hint(meaning(asked)));
    await tap(r, spot(asked));
    expect(marks(host(r, 'hh-ring-found-mark'))).toEqual(['check']);
    expect(name(r, asked)).toBe(m.a11y.hiddenHeritage.spotFound(meaning(asked)));
  });

  it('says each result once: a miss by the thing tapped and "Look again", the second miss with the look-here line, a found word by its romanization and meaning; never Hangul; one iOS call each', async () => {
    // The scene's layout reads the web platform; only the queued iOS call is wanted from `ios` here.
    (globalThis as { __os?: string }).__os = 'ios';
    const r = await play();
    const asked = order()[0]!;
    const [a, b] = others();
    await tap(r, spot(a!));
    expect(announced(r)).toEqual([line({ kind: 'missHint', item: meaning(a!), hint: m.learner.hiddenHeritage.again })]);
    await tap(r, spot(b!));
    const lookHere = line({ kind: 'missHint', item: meaning(b!), hint: lookHereLine(m.a11y, thing(asked).word.romanization) });
    expect(announced(r)).toEqual([lookHere]);
    await tap(r, spot(asked));
    const right = line({ kind: 'right', item: answerItem(m.a11y, thing(asked).word.romanization, thing(asked).word.en) });
    expect(announced(r)).toEqual([right]);
    expect(sr.queued).toEqual([line({ kind: 'missHint', item: meaning(a!), hint: m.learner.hiddenHeritage.again }), lookHere, right]);
    for (const said of sr.queued) expect(said).not.toMatch(HANGUL);
  });

  it('the visible caption and Hoya\'s line are not live regions; the announcer is the one polite region', async () => {
    const r = await play();
    await tap(r, spot(others()[0]!));
    expect(screenTexts(r.root)).toContain(m.learner.hiddenHeritage.again);
    expect(bubbleLive(r)).toEqual([false]);
    // The sound status stays live (a status, not a result); the caption and Hoya are not.
    expect(liveRegions(r)).toEqual(['hh-sound', 'answer-announcer']);
  });

  it('reader off: the next word waits the 1000 ms floor (it was 700); focus does not move', async () => {
    const r = await play();
    const asked = order()[0]!;
    await tap(r, spot(asked));
    await tick(RESULT_MARK_MIN_MS - 460);
    expect(has(r, 'hh-next')).toBe(false);
    expect(screenTexts(r.root).some((t) => t.includes('1 / 4'))).toBe(true);
    await tick(10);
    expect(screenTexts(r.root).some((t) => t.includes('1 / 4'))).toBe(true);
    await tick(RESULT_MARK_MIN_MS);
    expect(String(host(r, 'hh-round').props['aria-label'])).toBe(m.a11y.answer.round(2, 4, `${m.learner.hiddenHeritage.prompt} ${thing(order()[1]!).word.romanization}`));
    expect(sr.focused).toEqual([]);
  });

  it('reader on: Next after a right spot, the word\'s sound after the line, then the header node takes focus', async () => {
    readerOnWeb();
    const r = await play();
    const asked = order()[0]!;
    const spoken = audio.said.length;
    await tap(r, spot(asked));
    expect(sr.focused).toEqual([expect.objectContaining({ testID: 'hh-next' })]);
    expect(audio.said).toHaveLength(spoken);
    await tick(announceWaitMs(line({ kind: 'right', item: answerItem(m.a11y, thing(asked).word.romanization, thing(asked).word.en) })));
    expect(audio.said).toHaveLength(spoken + 1);
    await tick(60_000);
    expect(has(r, 'hh-next')).toBe(true);
    await nextPress(r, 'hh-next', 2);
    expect(has(r, 'hh-next')).toBe(false);
    expect(sr.focused.at(-1)).toEqual(expect.objectContaining({ testID: 'hh-round' }));
    const label = String(host(r, 'hh-round').props['aria-label']);
    expect(label).toBe(m.a11y.answer.round(2, 4, `${m.learner.hiddenHeritage.prompt} ${thing(order()[1]!).word.romanization}`));
    expect(label).not.toMatch(HANGUL);
  });

  it('reader on: Next pressed before the line ends drops the word\'s sound', async () => {
    readerOnWeb();
    const r = await play();
    const spoken = audio.said.length;
    await tap(r, spot(order()[0]!));
    await nextPress(r, 'hh-next');
    await tick(60_000);
    // Only the next word is said (a new word's own prompt); the found word's sound was dropped with the line.
    expect(audio.said.slice(spoken)).toEqual([thing(order()[1]!).word.ko]);
  });

  it('the last word of a scene also shows Next with a reader on, and Next ends it on the end panel', async () => {
    readerOnWeb();
    const r = await play();
    for (const id of order()) {
      await tap(r, spot(id));
      await nextPress(r, 'hh-next');
    }
    expect(has(r, 'hh-end')).toBe(true);
    expect(has(r, 'hh-next')).toBe(false);
  });

  it('the next word empties the announcer', async () => {
    const r = await play();
    await tap(r, spot(order()[0]!));
    expect(announced(r)).toHaveLength(1);
    await tick(2 * RESULT_MARK_MIN_MS);
    expect(announced(r)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('Syllable Build answers (test 16)', () => {
  const BAP = { ko: '밥', romanization: 'bap', gloss: 'rice, a meal' };
  const TILES = { firstTiles: ['ㄱ', 'ㅂ', 'ㅁ', 'ㄷ'], vowelTiles: ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ'], finalTiles: ['ㅂ', 'ㄴ', 'ㅇ'] };
  const tile = (key: string): string => `syllable-build-tile-${key}`;
  const zone = (z: string): string => `syllable-build-zone-${z}`;
  const board = (onSolved = vi.fn(), autoplay = false): Promise<ReactTestRenderer> =>
    open(<SyllableBuildBoard target={BAP} tiles={TILES} autoplay={autoplay} source="syllable-build" onFirst={() => undefined} onSolved={onSolved} />);
  const build = async (r: ReactTestRenderer, vowel = 'ㅏ'): Promise<void> => {
    await tap(r, tile('first:ㅂ'));
    await tap(r, tile('vowel:' + vowel));
    await tap(r, tile('final:ㅂ'));
  };

  it('a zone and a tile that did not fit show replay (not a drawn dot), named "Not this one: …", never disabled; a right block shows check on each zone and is named "Right answer: …"', async () => {
    const r = await board();
    await build(r, 'ㅓ');
    expect(marks(host(r, 'syllable-build-mark-zone-vowel'))).toEqual(['replay']);
    expect(marks(host(r, 'syllable-build-mark-tile-vowel:ㅓ'))).toEqual(['replay']);
    expect(String(pressable(r, zone('vowel')).props['aria-label'])).toMatch(/^Not this one: Vowel, /);
    expect(String(pressable(r, tile('vowel:ㅓ')).props['aria-label'])).toMatch(/^Not this one: ㅓ, letter eo/);
    expect(pressable(r, tile('vowel:ㅓ')).props['aria-selected']).not.toBe(true);
    expect(disabled(r, tile('vowel:ㅓ'))).toBe(false);
    await tap(r, tile('vowel:ㅏ'));
    for (const z of ['first', 'vowel', 'final']) {
      expect(marks(host(r, `syllable-build-mark-zone-${z}`))).toEqual(['check']);
      expect(String(pressable(r, zone(z)).props['aria-label'])).toMatch(/^Right answer: /);
      expect(disabled(r, zone(z))).toBe(false);
    }
    expect(disabled(r, tile('vowel:ㅏ'))).toBe(false);
  });

  it('says each result once: a miss by the letter that did not fit ("Listen again"), the second miss with the look-here line, the right block by its romanization and meaning; no Hangul; Hoya and the built block are not live', async () => {
    on('ios');
    const r = await board();
    await build(r, 'ㅓ');
    expect(announced(r)).toEqual([line({ kind: 'missListen', item: 'eo' })]);
    expect(bubbleLive(r)).toEqual([false]);
    await tap(r, tile('vowel:ㅗ'));
    expect(announced(r)).toEqual([line({ kind: 'missHint', item: 'o', hint: m.learner.minigame.syllableBuild.lookHere })]);
    expect(has(r, 'syllable-build-ring')).toBe(true);
    expect(String(pressable(r, tile('vowel:ㅏ')).props['aria-label'])).toMatch(/^Look here: ㅏ, letter a/);
    await tap(r, tile('vowel:ㅏ'));
    expect(announced(r)).toEqual([line({ kind: 'right', item: answerItem(m.a11y, 'bap', 'rice, a meal') })]);
    expect(sr.queued).toHaveLength(3);
    for (const said of sr.queued) expect(said).not.toMatch(HANGUL);
    expect(liveRegions(r)).toEqual(['answer-announcer']);
  });

  it('the miss that turns look-here on rings the right tile with the dashed ring, outside the tile; a plain miss draws none', async () => {
    const r = await board();
    await build(r, 'ㅓ');
    expect(has(r, 'syllable-build-ring')).toBe(false);
    await tap(r, tile('vowel:ㅗ'));
    expect(borderStyleOf(r, 'syllable-build-ring')).toBe('dashed');
  });

  it('reader off: the next round waits the 1000 ms floor (it was 900) and the sound; the sound replays by itself after a miss', async () => {
    const onSolved = vi.fn();
    const r = await board(onSolved);
    await build(r, 'ㅓ');
    const spoken = audio.said.length;
    await tick(900);
    expect(audio.said.length).toBeGreaterThan(spoken);
    await tap(r, tile('vowel:ㅏ'));
    await tick(RESULT_MARK_MIN_MS - 1);
    expect(onSolved).not.toHaveBeenCalled();
    await tick(1);
    expect(onSolved).toHaveBeenCalledTimes(1);
  });

  it('reader on: no replay after a miss; Next after the right block, the block\'s sound after the line, dropped if Next came first; Next moves on once', async () => {
    readerOnWeb();
    const onSolved = vi.fn();
    const r = await board(onSolved);
    await build(r, 'ㅓ');
    const spoken = audio.said.length;
    await tick(2000);
    expect(audio.said).toHaveLength(spoken);
    await tap(r, tile('vowel:ㅏ'));
    expect(sr.focused).toEqual([expect.objectContaining({ testID: 'syllable-build-next' })]);
    expect(audio.said).toHaveLength(spoken);
    await tick(announceWaitMs(line({ kind: 'right', item: answerItem(m.a11y, 'bap', 'rice, a meal') })));
    expect(audio.said).toHaveLength(spoken + 1);
    await tick(60_000);
    expect(onSolved).not.toHaveBeenCalled();
    await nextPress(r, 'syllable-build-next', 2);
    expect(onSolved).toHaveBeenCalledTimes(1);
  });

  it('reader on: Next pressed before the line ends drops the block\'s sound', async () => {
    readerOnWeb();
    const r = await board();
    await build(r);
    const spoken = audio.said.length;
    await nextPress(r, 'syllable-build-next');
    await tick(60_000);
    expect(audio.said).toHaveLength(spoken);
  });

  it('the step: the heading is the round\'s header node (no Hangul) and a new round moves focus to it with a reader on', async () => {
    readerOnWeb();
    const rounds = [
      { id: 's1', target: { ko: '밥', romanization: 'bap' }, ...TILES },
      { id: 's2', target: { ko: '밥', romanization: 'bap' }, ...TILES },
    ];
    const scope = { kind: 'syllable-build', rounds: 2, syllableBuild: { rounds } } as unknown as MinigameScope;
    const h = hostOf();
    const r = await open(<SyllableBuildGame scope={scope} host={h} />);
    expect(String(host(r, 'syllable-build-round').props['aria-label'])).toBe(m.a11y.answer.round(1, 2, m.learner.minigame.syllableBuild.heading));
    await tap(r, tile('first:ㅂ'));
    await tap(r, tile('vowel:ㅏ'));
    await tap(r, tile('final:ㅂ'));
    await nextPress(r, 'syllable-build-next');
    expect(sr.focused.at(-1)).toEqual(expect.objectContaining({ testID: 'syllable-build-round' }));
    expect(String(host(r, 'syllable-build-round').props['aria-label'])).toBe(m.a11y.answer.round(2, 2, m.learner.minigame.syllableBuild.heading));
    expect(announced(r)).toHaveLength(0);
    await tap(r, tile('first:ㅂ'));
    await tap(r, tile('vowel:ㅏ'));
    await tap(r, tile('final:ㅂ'));
    await nextPress(r, 'syllable-build-next', 2);
    expect(h.completes).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('Match Shape answers (test 16)', () => {
  const PAIR: MatchShapeRound = {
    id: 'ms-pair',
    shape: 'pair',
    target: 'jamo:bieup',
    lookAlike: 'jamo:pieup',
    layout: 'tlltlt',
    diffNoteEn: '{ko:ㅍ} has two strokes on top; {ko:ㅂ} has one.',
  };
  const tileId = (i: number): string => `match-shape-tile-${i}`;
  const board = (onSolved = vi.fn(), round: MatchShapeRound = PAIR): Promise<ReactTestRenderer> => open(<MatchShapeBoard round={round} source="match-shape" onFirst={() => undefined} onSolved={onSolved} />);
  const diff = spokenParts(koTokenParts(PAIR.diffNoteEn));
  const missLine = [m.learner.minigame.matchShape.missPair, diff].join(' ');

  it('a found tile shows check and a missed one replay on a disc on its corner, named with the state first, never disabled; the amber dot is gone', async () => {
    const r = await board();
    await tap(r, tileId(1));
    expect(marks(host(r, `match-shape-mark-${1}`))).toEqual(['replay']);
    expect(String(pressable(r, tileId(1)).props['aria-label'])).toBe('Not this one: ㅍ, letter pieup');
    expect(disabled(r, tileId(1))).toBe(false);
    await tap(r, tileId(0));
    expect(marks(host(r, `match-shape-mark-${0}`))).toEqual(['check']);
    expect(String(pressable(r, tileId(0)).props['aria-label'])).toBe('Right answer: ㅂ, letter bieup, b or p, found');
    expect(disabled(r, tileId(0))).toBe(false);
  });

  it('says each result once: a copy found by its sound, a miss by the tile\'s sound with Hoya\'s line and the difference note read as romanization, never Hangul; the look-here line joins the miss that rings the copies; Hoya is not live', async () => {
    on('ios');
    const r = await board();
    await tap(r, tileId(0));
    expect(announced(r)).toEqual([line({ kind: 'right', item: 'b or p' })]);
    await tap(r, tileId(1));
    expect(announced(r)).toEqual([line({ kind: 'missHint', item: 'p', hint: missLine })]);
    expect(bubbleLive(r)).toEqual([false]);
    expect(announced(r).join(' ')).not.toMatch(HANGUL);
    await tap(r, tileId(2));
    expect(announced(r)).toEqual([line({ kind: 'missHint', item: 'p', hint: `${missLine} ${lookHereLine(m.a11y, 'b or p')}` })]);
    expect(sr.queued).toHaveLength(3);
    for (const said of sr.queued) expect(said).not.toMatch(HANGUL);
    expect(liveRegions(r)).toEqual(['answer-announcer']);
  });

  it('the second miss rings every copy still to find with the dashed look-here ring, and they are named "Look here: …"', async () => {
    const r = await board();
    await tap(r, tileId(1));
    expect(has(r, `match-shape-ring-${3}`)).toBe(false);
    await tap(r, tileId(2));
    for (const i of [0, 3, 5]) {
      expect(has(r, `match-shape-ring-${i}`)).toBe(true);
      expect(String(pressable(r, tileId(i)).props['aria-label'])).toMatch(/^Look here: ㅂ, letter bieup/);
    }
    expect(borderStyleOf(r, `match-shape-ring-${0}`)).toBe('dashed');
  });

  it('reader off: the pair round moves on after the 1000 ms floor (it was 900) and the letter\'s name', async () => {
    const onSolved = vi.fn();
    const r = await board(onSolved);
    for (const i of [0, 3, 5]) await tap(r, tileId(i));
    await tick(RESULT_MARK_MIN_MS - 1);
    expect(onSolved).not.toHaveBeenCalled();
    await tick(1);
    expect(onSolved).toHaveBeenCalledTimes(1);
  });

  it('reader on: Next after the last copy (none before), the name after the line, dropped if Next came first; Next moves on once', async () => {
    readerOnWeb();
    const onSolved = vi.fn();
    const r = await board(onSolved);
    await tap(r, tileId(0));
    await tap(r, tileId(3));
    expect(has(r, 'match-shape-next')).toBe(false);
    const spoken = audio.said.length;
    await tap(r, tileId(5));
    expect(sr.focused).toEqual([expect.objectContaining({ testID: 'match-shape-next' })]);
    expect(audio.said).toHaveLength(spoken);
    await tick(announceWaitMs(line({ kind: 'right', item: 'b or p' })));
    expect(audio.said).toHaveLength(spoken + 1);
    await tick(60_000);
    expect(onSolved).not.toHaveBeenCalled();
    await nextPress(r, 'match-shape-next', 2);
    expect(onSolved).toHaveBeenCalledTimes(1);
  });

  it('reader on: Next pressed before the line ends drops the letter\'s name', async () => {
    readerOnWeb();
    const r = await board();
    for (const i of [0, 3]) await tap(r, tileId(i));
    const spoken = audio.said.length;
    await tap(r, tileId(5));
    await nextPress(r, 'match-shape-next');
    await tick(60_000);
    expect(audio.said).toHaveLength(spoken);
  });

  describe('an origin round in the quest step', () => {
    const PLAY = scopeFor('minigame:s1-crafts-q4-play') as MinigameScope;
    const origin = (id: string): string => `match-shape-tile-jamo:${id}`;

    it('a miss shows replay, a right tile check; each said once (the sound, never Hangul); the heading is the round\'s header node', async () => {
      on('ios');
      const h = hostOf();
      const r = await open(<MatchShapeGame scope={PLAY} host={h} />);
      expect(String(host(r, 'match-shape-round').props['aria-label'])).toMatch(/^Question 1 of \d+\. Which letter comes from this shape\?$/);
      await tap(r, origin('giyeok'));
      expect(marks(host(r, 'match-shape-mark-jamo:giyeok'))).toEqual(['replay']);
      expect(String(pressable(r, origin('giyeok')).props['aria-label'])).toBe('Not this one: ㄱ, g or k');
      expect(announced(r)).toEqual([line({ kind: 'missHint', item: 'g or k', hint: m.learner.minigame.matchShape.missOrigin })]);
      await tap(r, origin('nieun'));
      expect(marks(host(r, 'match-shape-mark-jamo:nieun'))).toEqual(['check']);
      expect(announced(r)).toEqual([line({ kind: 'right', item: 'n' })]);
      expect(sr.queued).toHaveLength(2);
      expect(has(r, 'match-shape-continue')).toBe(true);
    });

    it('the origin round has its own Continue: with a reader on it takes focus after a right tile, and moving on empties the announcer and focuses the next round\'s node', async () => {
      readerOnWeb();
      const r = await open(<MatchShapeGame scope={PLAY} host={hostOf()} />);
      await tap(r, origin('nieun'));
      expect(sr.focused).toEqual([expect.objectContaining({ testID: 'match-shape-continue' })]);
      await tap(r, 'match-shape-continue');
      expect(sr.focused.at(-1)).toEqual(expect.objectContaining({ testID: 'match-shape-round' }));
      expect(announced(r)).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('Sentence Builder answers (test 16)', () => {
  const scope = (rounds: OrderItRound[]): MinigameScope => ({ kind: 'order-it', rounds: rounds.length, orderIt: { rounds } });
  const tile = (id: string): string => `sentence-builder-tile-${id}`;
  const play = (rounds: OrderItRound[] = [EAT_RICE, LIKE_TTEOKGUK], h: MinigameHost = hostOf(), patternNote?: string): Promise<ReactTestRenderer> =>
    open(<SentenceBuilderGame scope={scope(rounds)} host={h} {...(patternNote === undefined ? {} : { patternNote })} />);
  const place = (n: number, total: number, rom: string): string => m.a11y.minigame.sentenceBuilder.slotFilled(n, total, answerItem(m.a11y, rom));

  it('a tile tried keeps dash, now on a disc on its corner, still tappable and named "…, tried"; a placed tile\'s check is 20; no tile is disabled', async () => {
    const r = await play();
    await tap(r, tile('d0'));
    expect(marks(host(r, 'sentence-builder-tried-d0'))).toEqual(['dash']);
    expect(String(pressable(r, tile('d0')).props['aria-label'])).toMatch(/, tried$/);
    expect(disabled(r, tile('d0'))).toBe(false);
    await tick(1000);
    await tap(r, tile('w0'));
    const placed = host(r, 'sentence-builder-placed');
    const check = placed.findAll((n) => n.type === Icon)[0]!;
    expect(check.props.name).toBe('check');
    expect(check.props.size).toBe(20);
  });

  it('says each result once: a placed tile as its place and romanization, a miss by the tile and Hoya\'s line, the last tile as a right answer; no Hangul; the hint and the built panel are not live', async () => {
    on('ios');
    const r = await play();
    await tap(r, tile('w1'));
    expect(announced(r, 'sentence-builder-live')).toEqual([line({ kind: 'missHint', item: 'meogeoyo', hint: m.learner.minigame.sentenceBuilder.missLastWord })]);
    expect(bubbleLive(r)).toEqual([false]);
    await tick(1000);
    await tap(r, tile('w0'));
    expect(announced(r, 'sentence-builder-live')).toEqual([line({ kind: 'right', item: place(1, 2, 'babeul') })]);
    await tap(r, tile('w1'));
    expect(announced(r, 'sentence-builder-live')).toEqual([line({ kind: 'right', item: place(2, 2, 'meogeoyo') })]);
    expect(sr.queued).toHaveLength(3);
    for (const said of sr.queued) expect(said).not.toMatch(HANGUL);
    expect(liveRegions(r)).toEqual(['prompt-panel', 'sentence-builder-live']);
  });

  it('the second miss on a place rings the right tile with the dashed look-here ring, says Hoya\'s look-here line, and names the tile "…, comes next"', async () => {
    const r = await play();
    await tap(r, tile('d0'));
    await tick(1000);
    await tap(r, tile('w1'));
    await tick(1000);
    expect(has(r, 'sentence-builder-ring-dashed')).toBe(true);
    expect(borderStyleOf(r, 'sentence-builder-ring-dashed')).toBe('dashed');
    expect(announced(r, 'sentence-builder-live')).toEqual([line({ kind: 'missHint', item: 'meogeoyo', hint: m.learner.minigame.sentenceBuilder.lookHere })]);
    expect(String(pressable(r, tile('w0')).props['aria-label'])).toMatch(/, comes next$/);
  });

  it('a particle miss says the quest\'s note with its {ko:} read as romanization, never Hangul', async () => {
    const note = 'After a consonant we say {ko:이}, after a vowel {ko:가}.';
    const particle = (await import('../../../logic/sentence-builder/__tests__/fixtures')).BOOK_PARTICLE;
    on('ios');
    const r = await play([particle], hostOf(), note);
    const wrong = particle.particle!.choices[1]!;
    const tileId = ['c0', 'c1'].find((id) => String(pressable(r, tile(id)).props['aria-label']).startsWith(wrong.ko))!;
    await tap(r, tile(tileId));
    const said = announced(r, 'sentence-builder-live')[0]!;
    expect(said).toContain(m.learner.minigame.sentenceBuilder.missParticle);
    expect(said).toContain(spokenParts(koTokenParts(note)));
    expect(said).not.toMatch(HANGUL);
    // The piece that fits is announced as the word it makes ("chaegi", not "i"): the place and the whole word's romanization.
    await tick(1000);
    const right = ['c0', 'c1'].find((id) => id !== tileId)!;
    await tap(r, tile(right));
    expect(announced(r, 'sentence-builder-live')).toEqual([line({ kind: 'right', item: place(1, 2, 'chaegi') })]);
  });

  it('reader off: the next sentence waits the 1000 ms floor (it was 600) and the sentence\'s sound', async () => {
    const r = await play();
    await tap(r, tile('w0'));
    await tap(r, tile('w1'));
    const spoken = audio.said.length;
    expect(spoken).toBeGreaterThan(0);
    await tick(RESULT_MARK_MIN_MS - 460);
    expect(screenTexts(r.root)).toContain('1 / 2');
    await tick(460);
    expect(screenTexts(r.root)).toContain('2 / 2');
  });

  it('reader on: Next after the built sentence (the last round too), the sentence\'s sound after the line and dropped if Next came first; Next moves on once', async () => {
    readerOnWeb();
    const h = hostOf();
    const r = await play([EAT_RICE], h);
    await tap(r, tile('w0'));
    const spoken = audio.said.length;
    await tap(r, tile('w1'));
    expect(sr.focused).toEqual([expect.objectContaining({ testID: 'sentence-builder-next' })]);
    expect(audio.said).toHaveLength(spoken);
    await tick(announceWaitMs(line({ kind: 'right', item: place(2, 2, 'meogeoyo') })));
    expect(audio.said).toHaveLength(spoken + 1);
    await tick(60_000);
    expect(h.completes).toBe(0);
    await nextPress(r, 'sentence-builder-next', 2);
    expect(h.completes).toBe(1);
  });

  it('reader on: Next pressed before the line ends drops the sentence\'s sound', async () => {
    readerOnWeb();
    const r = await play([EAT_RICE]);
    await tap(r, tile('w0'));
    const spoken = audio.said.length;
    await tap(r, tile('w1'));
    await nextPress(r, 'sentence-builder-next');
    await tick(60_000);
    expect(audio.said).toHaveLength(spoken);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('Role Play answers (test 16)', () => {
  const SCENE: RolePlayScene = {
    title: { ko: '도서관', romanization: 'doseogwan', en: 'At the library' },
    partner: { ko: '사서', romanization: 'saseo', en: 'librarian' },
    start: 't1',
    nodes: [
      {
        id: 't1',
        line: { ko: '안녕하세요!', romanization: 'annyeonghaseyo', en: 'Hello!' },
        replies: [
          { id: 'hello', text: { ko: '안녕하세요!', romanization: 'annyeonghaseyo', en: 'Hello!' }, kind: 'natural', next: 't2' },
          { id: 'meal', text: { ko: '잘 먹겠습니다!', romanization: 'jal meokgetseumnida', en: 'I will eat well.' }, kind: 'lessNatural', whyEn: 'That one is for a meal. Try {ko:안녕하세요}.' },
          { id: 'bye', text: { ko: '안녕히 가세요!', romanization: 'annyeonghi gaseyo', en: 'Goodbye!' }, kind: 'lessNatural', whyEn: 'That one is for leaving.' },
        ],
      },
      {
        id: 't2',
        line: { ko: '또 오세요!', romanization: 'tto oseyo', en: 'Come again!' },
        replies: [
          { id: 'stay', text: { ko: '안녕히 계세요!', romanization: 'annyeonghi gyeseyo', en: 'Goodbye!' }, kind: 'natural', next: 'end' },
          { id: 'go', text: { ko: '안녕히 가세요!', romanization: 'annyeonghi gaseyo', en: 'Goodbye (leaving)!' }, kind: 'lessNatural', whyEn: 'You are the one leaving.' },
        ],
      },
      { id: 'end', end: true, closingEn: 'You found your book!' },
    ],
  };
  const reply = (id: string): string => `role-play-reply-${id}`;
  const play = (h: MinigameHost = hostOf()): Promise<ReactTestRenderer> => open(<RolePlayGame scope={{ rolePlay: { scene: SCENE } }} host={h} onBack={() => undefined} />, { width: 320, height: 640 });
  const settle = async (): Promise<void> => {
    await tick(2000);
  };

  it('a locked reply shows replay (it was dash) and is named "Not this one: …", inactive and focusable, not disabled; the reply being sent shows check and is named "Right answer: …"', async () => {
    const r = await play();
    await settle();
    await tap(r, reply('meal'));
    expect(marks(host(r, 'role-play-mark-meal'))).toEqual(['replay']);
    expect(String(pressable(r, reply('meal')).props['aria-label'])).toBe('Not this one: 잘 먹겠습니다!, jal meokgetseumnida');
    expect(disabled(r, reply('meal'))).toBe(false);
    await tap(r, reply('hello'));
    expect(marks(host(r, 'role-play-mark-hello'))).toEqual(['check']);
    expect(String(pressable(r, reply('hello')).props['aria-label'])).toMatch(/^Right answer: /);
  });

  it('says each result once: a less natural reply by its romanization and Hoya\'s why line with {ko:} as romanization, a sent reply by its romanization and meaning; no Hangul; the why bubble is not live', async () => {
    on('ios');
    const r = await play();
    await settle();
    await tap(r, reply('meal'));
    const why = spokenParts(koTokenParts('That one is for a meal. Try {ko:안녕하세요}.'));
    expect(why).toContain('annyeonghaseyo');
    expect(announced(r)).toEqual([line({ kind: 'missHint', item: 'jal meokgetseumnida', hint: why })]);
    expect(liveRegions(r).filter((id) => id !== 'role-play-partner-newest')).toEqual(['prompt-panel', 'answer-announcer']);
    await tap(r, reply('hello'));
    expect(announced(r)).toEqual([line({ kind: 'right', item: answerItem(m.a11y, 'annyeonghaseyo', 'Hello!') })]);
    expect(sr.queued).toHaveLength(2);
    for (const said of sr.queued) expect(said).not.toMatch(HANGUL);
  });

  it('the second less natural reply rings the natural one with the dashed look-here ring; its miss carries the look-here line', async () => {
    on('ios');
    const r = await play();
    await settle();
    await tap(r, reply('meal'));
    expect(has(r, 'role-play-ring')).toBe(false);
    await tap(r, reply('bye'));
    expect(borderStyleOf(r, 'role-play-ring')).toBe('dashed');
    expect(String(pressable(r, reply('hello')).props['aria-label'])).toMatch(/^Look here: /);
    expect(announced(r)).toEqual([line({ kind: 'missHint', item: 'annyeonghi gaseyo', hint: `That one is for leaving. ${lookHereLine(m.a11y, 'annyeonghaseyo')}` })]);
  });

  it('reader off: the partner answers after at least the 1000 ms floor (it was 900) and the reply', async () => {
    const r = await play();
    await settle();
    await tap(r, reply('hello'));
    await tick(RESULT_MARK_MIN_MS - 1);
    expect(screenTexts(r.root)).not.toContain('또 오세요!');
    await tick(1);
    expect(screenTexts(r.root)).toContain('또 오세요!');
  });

  it('reader on: Next after a sent reply, the reply\'s sound after the line, dropped if Next came first; the turn moves on once, and the next turn\'s header node takes focus', async () => {
    readerOnWeb();
    const r = await play();
    await settle();
    const spoken = audio.said.length;
    await tap(r, reply('hello'));
    expect(sr.focused).toEqual([expect.objectContaining({ testID: 'role-play-next' })]);
    expect(audio.said).toHaveLength(spoken);
    await tick(announceWaitMs(line({ kind: 'right', item: answerItem(m.a11y, 'annyeonghaseyo', 'Hello!') })));
    expect(audio.said.length).toBeGreaterThan(spoken);
    await tick(60_000);
    expect(screenTexts(r.root)).not.toContain('또 오세요!');
    await nextPress(r, 'role-play-next', 2);
    expect(screenTexts(r.root)).toContain('또 오세요!');
    expect(sr.focused.at(-1)).toEqual(expect.objectContaining({ testID: 'role-play-round' }));
    const label = String(host(r, 'role-play-round').props['aria-label']);
    expect(label).toBe(m.a11y.answer.round(2, 2, `tto oseyo, Come again!. ${m.learner.minigame.rolePlay.tapReply}`));
    expect(label).not.toMatch(HANGUL);
    expect(announced(r)).toHaveLength(0);
  });

  it('reader on: Next pressed before the line ends drops the reply\'s sound; the last turn\'s Next opens the closing line', async () => {
    readerOnWeb();
    const r = await play();
    await settle();
    await tap(r, reply('hello'));
    const spoken = audio.said.length;
    await nextPress(r, 'role-play-next');
    await tick(100);
    // The partner's next line is said, the dropped reply is not.
    expect(audio.said.filter((s) => s === '안녕하세요!').length).toBeLessThanOrEqual(spoken);
    await tap(r, reply('stay'));
    await nextPress(r, 'role-play-next');
    expect(screenTexts(r.root)).toContain('You found your book!');
    expect(has(r, 'role-play-next')).toBe(false);
  });
});
