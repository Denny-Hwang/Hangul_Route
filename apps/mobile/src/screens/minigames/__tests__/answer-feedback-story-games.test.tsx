import { HoyaBubble, Icon, TapLockProvider } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { answerAnnouncement, type AnswerResult } from '../../../logic/answer-feedback';
import type { MinigameScope } from '../../../logic/minigame-config';
import { STORY_ORDER_FIXTURES } from '../../../navigation/story-order-e2e-fixture';
import { useAudioStore } from '../../../store/audio-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { byTestId, hostNodes, press, render, resetPlatform, screenTexts, setPlatform, textOf, unmount, type RenderPlatform } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { StoryOrderGame } from '../story-order/StoryOrderGame';
import { StorySequenceGame } from '../StorySequenceGame';

/**
 * F-A11Y-001 row AF-4b (§6 test 16), Story Sequence and Story Order. In each: a wrong card keeps its amber, its `replay`
 * mark and its "Try another" name until the learner's next tap that changes the board (OD-AF7: it used to go after
 * 600 ms); each result is said once through the answer announcer (the region text plus one iOS call), with no Hangul;
 * Hoya's line is not live; the miss that rings the next card announces the look-here line. A card is never `disabled`.
 * Story Order's placement line moves onto the announcer (the place and the line by romanization and meaning, where it
 * was Hangul only) and its replay line is unchanged; Story Sequence's filled slot draws its check at `MARK_MIN` (20).
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const sr = vi.hoisted(() => ({ queued: [] as string[], replay: [] as string[] }));
vi.mock('../../../platform/screen-reader', async (orig) => ({
  ...(await orig<object>()),
  isScreenReaderEnabled: () => Promise.resolve(false),
  subscribeScreenReader: () => () => undefined,
  announceQueued: (text: string) => {
    if ((globalThis as { __os?: string }).__os === 'ios') sr.queued.push(text);
  },
  announceForScreenReader: (text: string) => sr.replay.push(text),
  focusForScreenReader: () => undefined,
}));
vi.mock('../../../platform/audio', async (orig) => ({
  ...(await orig<object>()),
  playPrompt: () => Promise.resolve('played' as const),
  stop: () => undefined,
}));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => true }));
vi.mock('../../../platform/telemetry', async (orig) => ({ ...(await orig<object>()), track: vi.fn(async () => undefined) }));
vi.mock('../../../platform/haptics', async (orig) => ({ ...(await orig<object>()), nudge: () => undefined, success: () => undefined, tapLight: () => undefined }));

const m = getMessages('en');
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
const mounted: ReactTestRenderer[] = [];

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
/** A tap a beat after the last: a touch inside `TAP_LOCK_MS` of an accepted one is a bounce and is dropped (KT-5). */
const tap = async (r: ReactTestRenderer, id: string): Promise<void> => {
  await tick(450);
  await press(pressable(r, id));
};
const host = (r: ReactTestRenderer, id: string): ReactTestInstance => {
  const node = byTestId(r.root, id)[0];
  if (!node) throw new Error(`no ${id}`);
  return node;
};
const marks = (node: ReactTestInstance): Array<{ name: string; size: number }> =>
  node.findAll((n) => n.type === Icon).map((n) => ({ name: String(n.props.name), size: Number(n.props.size) }));
const announced = (r: ReactTestRenderer): string[] =>
  hostNodes(host(r, 'answer-announcer'), () => true)
    .flatMap((n) => n.children)
    .filter((c): c is string => typeof c === 'string');
const bubbleLive = (r: ReactTestRenderer): boolean[] => r.root.findAllByType(HoyaBubble).map((b) => b.props.live !== false);
const line = (result: AnswerResult): string => answerAnnouncement(result, m.a11y).map((x) => x.text).join('');
const disabled = (r: ReactTestRenderer, id: string): boolean => byTestId(r.root, id).some((n) => n.props['aria-disabled'] === true);
const hostOf = (): MinigameHost => ({ mode: 'quest', answer: () => undefined, complete: () => undefined });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-24T09:00:00Z'));
  useAudioStore.setState({ muted: false });
  useQuestRunStore.getState().beginQuest('quest:fixture', 'episode:fixture');
  sr.queued.length = 0;
  sr.replay.length = 0;
  useLocaleStore.setState({ screenReader: false });
  on('web');
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
  resetPlatform();
  (globalThis as { __os?: string }).__os = undefined;
});

// ---------------------------------------------------------------------------------------------------------------------
describe('Story Sequence answers (test 16, OD-AF7)', () => {
  const steps: NonNullable<MinigameScope['storySteps']> = [
    { id: 'wake', labelEn: 'Wake up', labelKo: '일어나요', romanization: 'ireonayo' },
    { id: 'wash', labelEn: 'Wash your face', labelKo: '세수해요', romanization: 'sesuhaeyo' },
    { id: 'eat', labelEn: 'Eat breakfast', labelKo: '밥을 먹어요', romanization: 'babeul meogeoyo' },
    { id: 'go', labelEn: 'Go to school', labelKo: '학교에 가요', romanization: 'hakgyoe gayo' },
  ];
  const scope: MinigameScope = { kind: 'story-sequence', storySteps: steps };
  const card = (id: string): string => `story-sequence-card-${id}`;
  const play = async (): Promise<ReactTestRenderer> => {
    const r = await render(
      <TapLockProvider>
        <RomanizationModeOverride mode="always">
          <StorySequenceGame scope={scope} onFinish={() => undefined} sequenceId="minigame:fixture" nonce={3} />
        </RomanizationModeOverride>
      </TapLockProvider>,
    );
    mounted.push(r);
    return r;
  };
  /** A card that is not the next one, and is still on the board. */
  const other = (n: number): string => ['go', 'eat', 'wash'][n]!;

  it('a wrong card keeps its amber, its replay mark and its "Try another" name well past the old 600 ms, and is not disabled', async () => {
    const r = await play();
    await tap(r, card(other(0)));
    const miss = pressable(r, card(other(0)));
    expect(marks(miss).map((x) => x.name)).toEqual(['replay']);
    expect(String(miss.props['aria-label'])).toMatch(/Try another$/);
    expect(disabled(r, card(other(0)))).toBe(false);
    await tick(10_000);
    expect(marks(pressable(r, card(other(0)))).map((x) => x.name)).toEqual(['replay']);
    expect(String(pressable(r, card(other(0))).props['aria-label'])).toMatch(/Try another$/);
  });

  it('the next wrong card takes the amber; a right card clears it', async () => {
    const r = await play();
    await tap(r, card(other(0)));
    await tap(r, card(other(1)));
    expect(marks(pressable(r, card(other(0))))).toEqual([]);
    expect(marks(pressable(r, card(other(1)))).map((x) => x.name)).toEqual(['replay']);
    await tap(r, card('wake'));
    expect(marks(pressable(r, card(other(1)))).map((x) => x.name)).toEqual([]);
  });

  it('a right card fills its slot with a check at the 20 minimum (it was 16); the slot keeps its place name', async () => {
    const r = await play();
    expect(marks(host(r, 'story-sequence-slot-1'))).toEqual([]);
    await tap(r, card('wake'));
    expect(marks(host(r, 'story-sequence-slot-1'))).toEqual([{ name: 'check', size: 20 }]);
    expect(host(r, 'story-sequence-slot-1').props['aria-label']).toBe('Place 1 of 4: Wake up');
  });

  it('says each result once, with no Hangul: a miss by its caption, the right card by its place and caption; Hoya\'s line is not live', async () => {
    const r = await play();
    expect(announced(r)).toEqual([]);
    await tap(r, card(other(0)));
    expect(announced(r)).toEqual([line({ kind: 'miss', item: steps.find((s) => s.id === other(0))!.labelEn })]);
    expect(bubbleLive(r)).toEqual([false]);
    await tap(r, card('wake'));
    expect(announced(r)).toEqual([line({ kind: 'right', item: m.learner.story.sequence.slotLabel(1, 4, 'Wake up') })]);
    for (const text of announced(r)) expect(text).not.toMatch(HANGUL);
  });

  it('the second miss on a slot rings the next card and says the look-here line; the announcer survives the move to the replay', async () => {
    const r = await play();
    await tap(r, card(other(0)));
    await tap(r, card(other(1)));
    expect(announced(r)).toEqual([line({ kind: 'missHint', item: steps.find((s) => s.id === other(1))!.labelEn, hint: m.learner.story.sequence.lookHere })]);
    expect(String(pressable(r, card('wake')).props['aria-label'])).toMatch(/This one comes next\.$/);
    for (const id of ['wake', 'wash', 'eat', 'go']) await tap(r, card(id));
    expect(byTestId(r.root, 'story-sequence-replay-card').length).toBeGreaterThan(0);
    expect(announced(r)).toEqual([line({ kind: 'right', item: m.learner.story.sequence.slotLabel(4, 4, 'Go to school') })]);
  });

  it('iOS: one queued call per result', async () => {
    on('ios');
    const r = await play();
    await tap(r, card(other(0)));
    await tap(r, card('wake'));
    expect(sr.queued).toEqual([
      line({ kind: 'miss', item: steps.find((s) => s.id === other(0))!.labelEn }),
      line({ kind: 'right', item: m.learner.story.sequence.slotLabel(1, 4, 'Wake up') }),
    ]);
  });

  it('there is no Next and no focus move per tap, with a reader on too: the round ends in its own replay and Done', async () => {
    useLocaleStore.setState({ screenReader: true });
    const r = await play();
    await tap(r, card('wake'));
    expect(byTestId(r.root, 'story-sequence-next')).toEqual([]);
    expect(screenTexts(r.root)).not.toContain(m.learner.minigame.trace.next.cta);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('Story Order answers (test 16, OD-AF7)', () => {
  const card = (id: string): string => `story-order-card-${id}`;
  const play = async (mode: MinigameHost['mode'] = 'quest'): Promise<ReactTestRenderer> => {
    const r = await render(
      <TapLockProvider>
        <RomanizationModeOverride mode="always">
          <StoryOrderGame scope={STORY_ORDER_FIXTURES.captions} host={{ ...hostOf(), mode }} sequenceId="minigame:fixture" nonce={3} />
        </RomanizationModeOverride>
      </TapLockProvider>,
    );
    mounted.push(r);
    return r;
  };
  const UP = 'Place 1 of 4: meonjeo ireonayo, First, I get up.';

  it('a wrong card keeps its amber, its replay mark and its "Try another" name past the old 600 ms, and is not disabled; the next wrong card takes it; a right card clears it', async () => {
    const r = await play();
    await tap(r, card('park'));
    expect(marks(pressable(r, card('park'))).map((x) => x.name)).toEqual(['replay']);
    expect(String(pressable(r, card('park')).props['aria-label'])).toMatch(/Try another$/);
    expect(disabled(r, card('park'))).toBe(false);
    await tick(10_000);
    expect(marks(pressable(r, card('park'))).map((x) => x.name)).toEqual(['replay']);
    await tap(r, card('eat'));
    expect(marks(pressable(r, card('park')))).toEqual([]);
    expect(marks(pressable(r, card('eat'))).map((x) => x.name)).toEqual(['replay']);
    await tap(r, card('up'));
    expect(marks(pressable(r, card('eat')))).toEqual([]);
  });

  it('says each result once, with no Hangul: the placement as the place and the line by romanization and meaning (it was Hangul only), a miss by the card\'s romanization; Hoya\'s line is not live', async () => {
    const r = await play();
    expect(announced(r)).toEqual([]);
    await tap(r, card('park'));
    expect(announced(r)).toEqual([line({ kind: 'miss', item: 'majimage gongwone gayo' })]);
    expect(bubbleLive(r)).toEqual([false]);
    await tap(r, card('up'));
    expect(announced(r)).toEqual([line({ kind: 'right', item: UP })]);
    for (const text of announced(r)) expect(text).not.toMatch(HANGUL);
    // The old hidden live line is gone: one polite region carries the result, whatever the platform.
    expect(byTestId(r.root, 'story-order-announce')).toEqual([]);
  });

  it('the second miss on a slot rings the next card and says the look-here line', async () => {
    const r = await play();
    await tap(r, card('park'));
    await tap(r, card('eat'));
    expect(announced(r)).toEqual([line({ kind: 'missHint', item: 'geurigo babeul meogeoyo', hint: m.learner.story.sequence.lookHere })]);
    expect(announced(r)[0]).not.toMatch(HANGUL);
    expect(String(pressable(r, card('up')).props['aria-label'])).toMatch(/This one comes next\.$/);
  });

  it('Show meanings names a missed card by its meaning too', async () => {
    const r = await play();
    await press(pressable(r, 'story-order-show-meanings'));
    await tap(r, card('park'));
    expect(announced(r)).toEqual([line({ kind: 'miss', item: 'majimage gongwone gayo, Last, I go to the park.' })]);
  });

  it('iOS: the placement and a miss are each one queued call, from the announcer (not a separate announce call)', async () => {
    on('ios');
    const r = await play();
    await tap(r, card('park'));
    await tap(r, card('up'));
    expect(sr.queued).toEqual([line({ kind: 'miss', item: 'majimage gongwone gayo' }), line({ kind: 'right', item: UP })]);
    expect(sr.replay).toEqual([]);
  });

  it('the replay line is not a result and is unchanged: its own live line and iOS call, Hangul and English', async () => {
    const r = await play();
    for (const id of ['up', 'wash', 'eat', 'park']) await tap(r, card(id));
    const replay = host(r, 'story-order-replay-announce');
    expect(replay.props['aria-live']).toBe('polite');
    expect(textOf(replay)).toBe('먼저 일어나요. First, I get up.');
    expect(sr.replay).toEqual(['먼저 일어나요. First, I get up.']);
    expect(announced(r)).toEqual([line({ kind: 'right', item: 'Place 4 of 4: majimage gongwone gayo, Last, I go to the park.' })]);
  });
});
