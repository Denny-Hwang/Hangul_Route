import { NavigationContext } from '@react-navigation/native';
import { ConfirmSheet, type ConfirmSheetProps } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMessages } from '@hangul-route/i18n';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { fakeNavigation } from '../../../test-support/fake-navigation';
import { buttonsNamed, byTestId, press, render, resetPlatform, setPlatform, unmount } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { MinigameScreen } from '../MinigameScreen';

/**
 * AMENDMENTS-QUEST-LEAVE-RESUME LR-1 (section 3.1, tests 3 to 9): a game with an answer asks "Keep playing?" before a back
 * throws it away. Route level, through the fake navigation of `use-back-guard.test.tsx` (`fire(type)` runs the route's
 * `beforeRemove` listeners); what the stack shows after a back is left to e2e (`minigame-leave.spec.ts`). The games are
 * stand-ins that answer through the real quest host, so the real run store counts the answers.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const track = vi.hoisted(() => vi.fn<(event: unknown) => Promise<void>>(() => Promise.resolve()));
const stopSound = vi.hoisted(() => vi.fn());
const switching = vi.hoisted(() => ({ loading: false }));

vi.mock('../../../platform/telemetry', () => ({ track }));
vi.mock('../../../platform/audio', () => ({ stop: stopSound }));
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
    StackActions: { push: () => undefined },
  };
});
// The stroke games draw with the native gesture handler, which has no build that loads in Node; this suite plays neither.
vi.mock('../TraceStrokeGame', () => ({ TraceStrokeGame: () => null }));
vi.mock('../TraceWordGame', () => ({ TraceWordGame: () => null }));
vi.mock('../../use-practice-session', () => ({ usePracticeSession: () => undefined }));
vi.mock('../../lesson-content', () => ({
  useLessonQuestState: () => 'ready',
  combinedChunkState: () => 'ready',
  LessonWaiting: () => null,
  LaterNeedsInternet: () => null,
}));
vi.mock('../../story-content', () => ({ useStoryQuestState: () => 'ready' }));
vi.mock('../../../content', () => ({
  // The hook's reading of the course (the romanization fade) needs the two lists; this screen's course is the one quest below.
  episodesAll: [],
  questsAll: [],
  questById: (id: string) =>
    id === 'missing'
      ? undefined
      : { id, steps: [0, 1].map((n) => ({ id: `s${n}`, kind: 'minigame', minigameRef: `mg-${id}` })) },
}));
vi.mock('../../../logic/minigame-config', () => ({
  scopeFor: (ref: string) => ({ ref, kind: ref.slice('mg-'.length), rounds: [] }),
}));
vi.mock('../../../logic/content-locale', () => ({ localizeScope: (scope: unknown) => scope, localizeQuest: (quest: unknown) => quest }));
vi.mock('../../../logic/role-play/fallback', () => ({ playedScope: (scope: unknown) => scope }));
vi.mock('../../../store/remote-config-store', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useFrozenCurrFlag: () => true,
}));
vi.mock('../dictation-entry', () => ({
  useSwitchedScope: (scope: unknown) => (switching.loading ? { kind: 'loading' } : { kind: 'ready', scope, kit: null }),
}));

// Stand-in games: a right answer, a wrong one and the game's own ways out, through the host the screen hands over.
vi.mock('../ListenPickGame', async () => {
  const { createElement } = await import('react');
  return {
    ListenPickGame: ({ host, onBack }: { host: MinigameHost; onBack: () => void }) =>
      createElement(
        'div',
        { 'data-testid': 'game' },
        createElement('div', { 'data-testid': 'game-right', onClick: () => host.answer('r1', true) }),
        createElement('div', { 'data-testid': 'game-wrong', onClick: () => host.answer('r1', false) }),
        createElement('div', { 'data-testid': 'game-complete', onClick: () => host.complete() }),
        createElement('div', { 'data-testid': 'game-empty-back', onClick: onBack }),
      ),
  };
});
vi.mock('../MatchSoundGame', async () => {
  const { createElement } = await import('react');
  return {
    MatchSoundGame: ({ onFinish }: { onFinish: () => void }) =>
      createElement(
        'div',
        { 'data-testid': 'game' },
        createElement('div', {
          'data-testid': 'game-answer',
          onClick: () => useQuestRunStore.getState().answerRound('m1', true),
        }),
        createElement('div', { 'data-testid': 'game-finish', onClick: onFinish }),
      ),
  };
});
vi.mock('../StoryReadGame', async () => {
  const { createElement } = await import('react');
  return {
    StoryReadGame: () =>
      createElement('div', {
        'data-testid': 'story-read-checkpoint',
        onClick: () => useQuestRunStore.getState().answerRound('c1', true),
      }),
  };
});
// Story Check keeps its own guard (a back in its recap ends the step) and mounts after the screen's waiting frame.
vi.mock('../StoryCheckGame', async () => {
  const { createElement, useState } = await import('react');
  const { useRouteBackGuard } = await import('../../use-back-guard');
  const ended = { count: 0 };
  return {
    storyCheckEnded: ended,
    StoryCheckGame: () => {
      const [recap, setRecap] = useState(false);
      useRouteBackGuard(() => {
        if (!recap) return false;
        ended.count += 1;
        return true;
      }, recap);
      return createElement(
        'div',
        { 'data-testid': 'game' },
        createElement('div', { 'data-testid': 'check-answer', onClick: () => useQuestRunStore.getState().answerRound('k1', true) }),
        createElement('div', { 'data-testid': 'check-recap', onClick: () => setRecap(true) }),
      );
    },
  };
});

const copy = getMessages('en').learner;
const sheetId = 'minigame-leave';

function route(kind: string, stepIndex = 0): { key: string; name: 'Minigame'; params: { questId: string; episodeId: string; stepIndex: number } } {
  return { key: `Minigame-${kind}`, name: 'Minigame', params: { questId: kind, episodeId: 'e', stepIndex } };
}

interface Setup {
  r: ReactTestRenderer;
  nav: ReturnType<typeof fakeNavigation>;
  goBack: ReturnType<typeof vi.fn>;
  /** Draws the screen again, on another step of the quest when `stepIndex` is given (the quest player's Next). */
  redraw: (stepIndex?: number) => Promise<void>;
}

const mounted: ReactTestRenderer[] = [];

/**
 * The screen as a route draws it. `guest` is the guest stack's shape (`GuestMinigameRoute`, `navigation/guest-chunk.tsx`): a
 * wrapped navigation with a `goBack` and no `push`, and no Culture notes exit; `inPreview` is the All lessons host (exits, no
 * navigation). The route's own navigation (the `beforeRemove` listeners) is the context, as on both stacks.
 */
async function open(kind: string, props: { inPreview?: boolean; guest?: boolean } = {}): Promise<Setup> {
  useQuestRunStore.getState().beginQuest(kind, 'e', 0);
  const nav = fakeNavigation();
  const goBack = vi.fn();
  let step = 0;
  const tree = (): ReactElement => (
    <NavigationContext.Provider value={nav as never}>
      {props.inPreview ? (
        <MinigameScreen route={route(kind, step)} inPreview onBack={goBack} />
      ) : props.guest ? (
        <MinigameScreen route={route(kind, step)} navigation={{ goBack: () => goBack(), push: () => undefined }} onOpenCultureNote={null} />
      ) : (
        <MinigameScreen route={route(kind, step)} navigation={{ goBack, push: vi.fn() }} />
      )}
    </NavigationContext.Provider>
  );
  const r = await render(tree());
  mounted.push(r);
  return {
    r,
    nav,
    goBack,
    redraw: (stepIndex) =>
      act(async () => {
        if (stepIndex !== undefined) step = stepIndex;
        r.update(tree());
      }),
  };
}

const tap = async (r: ReactTestRenderer, id: string): Promise<void> => {
  const node = byTestId(r.root, id).find((n: ReactTestInstance) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};
/** A back reaching the route, inside `act` (the guard sets state); answers whether the route held it. */
async function back(nav: ReturnType<typeof fakeNavigation>, type: string): Promise<boolean> {
  let held = false;
  await act(async () => {
    held = nav.fire(type);
  });
  return held;
}
/** The Keep playing sheet the screen holds (a ConfirmSheet; the screen draws none where it does not guard). */
const sheetOf = (r: ReactTestRenderer): ConfirmSheetProps | undefined => r.root.findAllByType(ConfirmSheet)[0]?.props as ConfirmSheetProps | undefined;
const asking = (r: ReactTestRenderer): boolean => sheetOf(r)?.visible === true;
const answerSheet = async (r: ReactTestRenderer, button: 'onCancel' | 'onConfirm'): Promise<void> => {
  await act(async () => {
    sheetOf(r)![button]();
  });
};

beforeEach(() => {
  track.mockClear();
  stopSound.mockClear();
  switching.loading = false;
  useQuestRunStore.getState().reset();
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  resetPlatform();
  useQuestRunStore.getState().reset();
});

describe('a game with no answer is left at once, as before (test 3)', () => {
  it('holds no back, and a replace is never held', async () => {
    const { nav, r } = await open('listen-pick');
    expect(await back(nav, 'GO_BACK')).toBe(false);
    expect(await back(nav, 'POP')).toBe(false);
    expect(await back(nav, 'REPLACE')).toBe(false);
    expect(asking(r)).toBe(false);
  });
});

describe('a game with an answer asks before it is left (tests 4 and 5)', () => {
  it('a back is held and the sheet asks; Keep playing closes it and the game is as it was; Leave goes back once', async () => {
    const { nav, r, goBack } = await open('listen-pick');
    await tap(r, 'game-wrong');
    expect(await back(nav, 'GO_BACK')).toBe(true);
    expect(asking(r)).toBe(true);
    expect(sheetOf(r)).toMatchObject({
      testID: sheetId,
      title: copy.minigame.leave.title,
      message: copy.minigame.leave.message,
      cancelLabel: copy.quest.leave.keep.cta,
      confirmLabel: copy.quest.leave.confirm.cta,
    });
    expect(sheetOf(r)?.confirmTone ?? 'primary').toBe('primary');
    expect(copy.minigame.leave.title).toBe('Keep playing?');
    expect(copy.quest.leave.keep.cta).toBe('Keep playing');
    expect(goBack).not.toHaveBeenCalled();

    // Keep playing: the sheet goes, the game was never unmounted, its answer state is as it was.
    await answerSheet(r, 'onCancel');
    expect(asking(r)).toBe(false);
    expect(byTestId(r.root, 'game')).toHaveLength(1);
    expect(useQuestRunStore.getState().totalCount).toBe(1);

    // Leave: the screen's own back, let through the guard; the next back is not held either.
    expect(await back(nav, 'GO_BACK')).toBe(true);
    await answerSheet(r, 'onConfirm');
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(await back(nav, 'GO_BACK')).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });

  it('a POP is held the same way, and a back while the sheet is open is Keep playing, never a second sheet', async () => {
    const { nav, r } = await open('listen-pick');
    await tap(r, 'game-right');
    expect(await back(nav, 'POP')).toBe(true);
    expect(asking(r)).toBe(true);
    expect(await back(nav, 'GO_BACK')).toBe(true);
    expect(asking(r)).toBe(false);
    // The sheet can ask again afterwards.
    expect(await back(nav, 'GO_BACK')).toBe(true);
    expect(asking(r)).toBe(true);
    expect(await back(nav, 'REPLACE')).toBe(false);
  });

  it('the sheet opening stops the game sound; Keep playing does not start it again (test 9)', async () => {
    const { nav, r } = await open('listen-pick');
    await tap(r, 'game-right');
    expect(stopSound).not.toHaveBeenCalled();
    await back(nav, 'GO_BACK');
    expect(stopSound).toHaveBeenCalledTimes(1);
    await answerSheet(r, 'onCancel');
    expect(stopSound).toHaveBeenCalledTimes(1);
  });

  it('the guest stack asks too, in the shape its route draws the screen in (a wrapped navigation, no Culture notes exit)', async () => {
    const { nav, r, goBack } = await open('listen-pick', { guest: true });
    await tap(r, 'game-right');
    expect(await back(nav, 'GO_BACK')).toBe(true);
    expect(asking(r)).toBe(true);
    await answerSheet(r, 'onConfirm');
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('a double tap on Leave goes back once', async () => {
    const { nav, r, goBack } = await open('listen-pick');
    await tap(r, 'game-right');
    await back(nav, 'GO_BACK');
    await answerSheet(r, 'onConfirm');
    await answerSheet(r, 'onConfirm');
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('Back to quest on the not-found page leaves with no sheet, with answers given', async () => {
    const { nav, r, goBack } = await open('missing');
    useQuestRunStore.getState().answerRound('r1', true);
    expect(useQuestRunStore.getState().answersGiven).toBe(1);
    // No game was drawn, so there is nothing to keep playing: the page's own Back to quest passes the guard.
    expect(r.root.findAllByType(ConfirmSheet)[0]).toBeDefined();
    await press(buttonsNamed(r.root, copy.minigame.backToQuest.cta)[0]!);
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(asking(r)).toBe(false);
    expect(await back(nav, 'GO_BACK')).toBe(false);
  });
});

describe('the route\'s guard across steps and hosts', () => {
  it('a step change remounts the body: still one listener, the gesture is written again for the new step', async () => {
    setPlatform('ios');
    const { nav, r, redraw } = await open('listen-pick');
    await tap(r, 'game-right');
    expect(nav.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
    await back(nav, 'GO_BACK');
    expect(asking(r)).toBe(true);
    // The next step: its body counts answers from now, so it has none yet; the open sheet does not follow the step.
    await redraw(1);
    expect(nav.listenerCount()).toBe(1);
    expect(nav.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    expect(asking(r)).toBe(false);
    expect(await back(nav, 'GO_BACK')).toBe(false);
    await tap(r, 'game-right');
    expect(nav.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
    expect(await back(nav, 'GO_BACK')).toBe(true);
    expect(nav.listenerCount()).toBe(1);
  });

  it('the All lessons preview never writes the gesture, answers or not', async () => {
    setPlatform('ios');
    const { nav, r } = await open('listen-pick', { inPreview: true });
    await tap(r, 'game-right');
    expect(nav.setOptions).not.toHaveBeenCalled();
  });
});

describe('the iOS swipe (test 6)', () => {
  it('is turned off after the first answer and on before it', async () => {
    setPlatform('ios');
    const { nav, r } = await open('listen-pick');
    expect(nav.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    await tap(r, 'game-right');
    expect(nav.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
  });

  it('is left alone on the web', async () => {
    setPlatform('web');
    const { nav, r } = await open('listen-pick');
    await tap(r, 'game-right');
    expect(nav.setOptions).not.toHaveBeenCalled();
  });
});

describe('the screen\'s own exits pass (test 7)', () => {
  it('a game that finishes after answers leaves with no sheet and sends minigame.finished once', async () => {
    const { nav, r, goBack } = await open('match-sound');
    await tap(r, 'game-answer');
    await tap(r, 'game-finish');
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(asking(r)).toBe(false);
    expect(await back(nav, 'GO_BACK')).toBe(false);
    expect(track).toHaveBeenCalledTimes(1);
    expect((track.mock.calls[0]?.[0] as { name: string }).name).toBe('minigame.finished');
  });

  it('a host game that completes after answers leaves with no sheet', async () => {
    const { nav, r, goBack } = await open('listen-pick');
    await tap(r, 'game-right');
    await tap(r, 'game-complete');
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(await back(nav, 'GO_BACK')).toBe(false);
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('Back to quest on an empty game leaves', async () => {
    const { r, goBack } = await open('listen-pick');
    await tap(r, 'game-empty-back');
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(asking(r)).toBe(false);
  });

  it('a game on its end card (every round answered, not closed yet) asks; Keep playing returns to the end card', async () => {
    const { nav, r, goBack } = await open('match-sound');
    await tap(r, 'game-answer');
    expect(await back(nav, 'GO_BACK')).toBe(true);
    expect(asking(r)).toBe(true);
    await answerSheet(r, 'onCancel');
    await tap(r, 'game-finish');
    expect(goBack).toHaveBeenCalledTimes(1);
  });
});

describe('Story Check keeps its own recap guard (test 8)', () => {
  it('mounted after the screen drew its waiting frame: a back in the recap ends the step with no sheet; before it, with an answer, the sheet asks', async () => {
    switching.loading = true;
    const { nav, r, redraw } = await open('story-check');
    switching.loading = false;
    await redraw();
    expect(nav.listenerCount()).toBe(1);

    await tap(r, 'check-answer');
    expect(await back(nav, 'GO_BACK')).toBe(true);
    expect(asking(r)).toBe(true);
    await answerSheet(r, 'onCancel');
    expect(asking(r)).toBe(false);

    await tap(r, 'check-recap');
    expect(await back(nav, 'GO_BACK')).toBe(true);
    expect(asking(r)).toBe(false);
    const { storyCheckEnded } = (await import('../StoryCheckGame')) as unknown as { storyCheckEnded: { count: number } };
    expect(storyCheckEnded.count).toBe(1);
  });
});

describe('what is not guarded (test 9)', () => {
  it('a story-read step with a checkpoint answered is left at once', async () => {
    const { nav, r } = await open('story-read');
    await tap(r, 'story-read-checkpoint');
    expect(useQuestRunStore.getState().answersGiven).toBe(1);
    expect(await back(nav, 'GO_BACK')).toBe(false);
    expect(asking(r)).toBe(false);
  });

  it('the All lessons preview records and asks nothing', async () => {
    const { nav, r } = await open('listen-pick', { inPreview: true });
    await tap(r, 'game-right');
    expect(await back(nav, 'GO_BACK')).toBe(false);
    expect(asking(r)).toBe(false);
  });
});
