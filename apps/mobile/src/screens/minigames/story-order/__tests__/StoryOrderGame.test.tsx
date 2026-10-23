import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../../../i18n/use-romanization-mode';
import { STORY_ORDER_FIXTURES, type StoryOrderFixtureKey } from '../../../../navigation/story-order-e2e-fixture';
import { useAudioStore } from '../../../../store/audio-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../../test-support/audio-rig';
import { byTestId, press, render, screenTexts, textOf, unmount } from '../../../../test-support/render';
import type { MinigameHost } from '../../host';
import { StoryOrderGame } from '../StoryOrderGame';

/**
 * F-CURR-002 §7.1 F5, row CM-34 (design/wireframes/minigame/story-order.md): Story Order through the web audio rig.
 * Cards show Korean and romanization only until Show meanings, a placed card's slot shows its first word, a screen
 * reader hears where each card went, a miss nudges (amber, nothing moves) and the replay lists the lines with their
 * meanings. The render lane's default is reduced motion: no auto-advance, Back and Next step through, no Pause.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
const motion = vi.hoisted(() => ({ reduced: true }));
vi.mock('../../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../../../test-support/audio-rig')).rigAudio(() => rig.current!),
}));
vi.mock('../../../../platform/motion', () => ({ useReducedMotion: () => motion.reduced }));

const EN = getMessages('en').learner;
const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
  motion.reduced = true;
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

interface Log {
  answers: Array<{ key: string; correct: boolean; itemId?: string; hinted?: boolean }>;
  completed: number;
}

async function open(fixture: StoryOrderFixtureKey): Promise<{ r: ReactTestRenderer; log: Log }> {
  const log: Log = { answers: [], completed: 0 };
  const host: MinigameHost = {
    mode: 'quest',
    answer: (key, correct, meta) => log.answers.push({ key: String(key), correct, ...meta }),
    complete: () => {
      log.completed += 1;
    },
  };
  const r = await render(
    <RomanizationModeOverride mode="always">
      <StoryOrderGame scope={STORY_ORDER_FIXTURES[fixture]} host={host} sequenceId="minigame:fixture" nonce={3} />
    </RomanizationModeOverride>,
  );
  mounted.push(r);
  return { r, log };
}

const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};
const has = (root: ReactTestInstance, id: string): boolean => byTestId(root, id).length > 0;
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};
const said = (): string[] => rig.current!.synth.spoken.map((u) => u.text);
const cardIds = (root: ReactTestInstance): string[] =>
  byTestId(root, 'story-order-cards')[0]!
    .findAll((n) => typeof n.props['data-testid'] === 'string' && /^story-order-card-/.test(n.props['data-testid'] as string) && typeof n.props.onClick === 'function')
    .map((n) => (n.props['data-testid'] as string).slice('story-order-card-'.length));
const MORNING = STORY_ORDER_FIXTURES.captions.storyOrder!.rounds[0]!;

describe('Story Order: ordering', () => {
  it('a captions round: heading, hint, cards in a derangement named by Korean and romanization, no meaning', async () => {
    const { r } = await open('captions');
    const texts = screenTexts(r.root);
    expect(texts).toContain(EN.storyOrder.title);
    expect(texts).toContain(EN.storyOrder.hint);
    const ids = cardIds(r.root);
    expect([...ids].sort()).toEqual(MORNING.panels.map((p) => p.id).sort());
    ids.forEach((id, i) => expect(id).not.toBe(MORNING.panels[i]!.id));
    expect(byTestId(r.root, 'story-order-card-up')[0]!.props['aria-label']).toBe('먼저 일어나요., meonjeo ireonayo');
    for (const p of MORNING.panels) expect(texts).not.toContain(p.caption.en);
    // Four empty slots, each named by its place.
    expect(byTestId(r.root, 'story-order-slot-1')[0]!.props['aria-label']).toBe('Place 1 of 4, empty');
  });

  it('a right tap fills the slot with its first word, says the line and tells a screen reader where it went', async () => {
    const { r, log } = await open('captions');
    await press(pressable(r.root, 'story-order-card-up'));
    await settle();
    expect(textOf(byTestId(r.root, 'story-order-slot-1')[0]!)).toContain('먼저');
    expect(textOf(byTestId(r.root, 'story-order-slot-1')[0]!)).toContain('meonjeo');
    expect(byTestId(r.root, 'story-order-slot-1')[0]!.props['aria-label']).toBe('Place 1 of 4: 먼저 일어나요.');
    expect(textOf(byTestId(r.root, 'story-order-announce')[0]!)).toBe('Place 1 of 4: 먼저 일어나요.');
    expect(byTestId(r.root, 'story-order-announce')[0]!.props['aria-live']).toBe('polite');
    expect(said()).toEqual(['먼저 일어나요.']);
    expect(log.answers).toEqual([{ key: 'so:morning:0', correct: true, itemId: 'morning/up' }]);
    expect(cardIds(r.root)).not.toContain('up');
  });

  it('a wrong tap nudges and moves nothing; the second miss on the slot rings the right card', async () => {
    const { r, log } = await open('captions');
    await press(pressable(r.root, 'story-order-card-park'));
    expect(screenTexts(r.root)).toContain(EN.story.sequence.tryAnother);
    expect(cardIds(r.root)).toHaveLength(4);
    expect(byTestId(r.root, 'story-order-card-park')[0]!.props['aria-label']).toBe('마지막에 공원에 가요., majimage gongwone gayo. Try another');
    await press(pressable(r.root, 'story-order-card-eat'));
    expect(screenTexts(r.root)).toContain(EN.story.sequence.lookHere);
    expect(byTestId(r.root, 'story-order-card-up')[0]!.props['aria-label']).toMatch(/This one comes next\.$/);
    expect(log.answers.map((a) => [a.key, a.correct])).toEqual([
      ['so:morning:0', false],
      ['so:morning:0', false],
    ]);
  });

  it('Show meanings shows every gloss for the rest of the round, and the answers after it are hinted', async () => {
    const { r, log } = await open('captions');
    await press(pressable(r.root, 'story-order-show-meanings'));
    expect(has(r.root, 'story-order-show-meanings')).toBe(false);
    expect(textOf(byTestId(r.root, 'story-order-meanings-shown')[0]!)).toBe(EN.storyOrder.meaningsShown);
    for (const p of MORNING.panels) expect(screenTexts(r.root)).toContain(p.caption.en);
    expect(byTestId(r.root, 'story-order-card-up')[0]!.props['aria-label']).toBe('먼저 일어나요., meonjeo ireonayo. First, I get up.');
    await press(pressable(r.root, 'story-order-card-up'));
    expect(log.answers).toEqual([{ key: 'so:morning:0', correct: true, itemId: 'morning/up', hinted: true }]);
  });

  it('an illustrated round draws its pictures and the pictures heading', async () => {
    const { r } = await open('twoRounds');
    expect(screenTexts(r.root)).toContain(EN.story.sequence.title);
    expect(screenTexts(r.root)).toContain(EN.story.sequence.hint);
    expect(textOf(byTestId(r.root, 'story-order-cards')[0]!)).toContain('아침에 해가 떠요.');
  });
});

describe('Story Order: replay and rounds', () => {
  it('a full row replays the lines in order with their meanings; with reduced motion nothing moves by itself and there is no Pause', async () => {
    const { r } = await open('captions');
    for (const p of MORNING.panels) await press(pressable(r.root, `story-order-card-${p.id}`));
    await settle();
    expect(screenTexts(r.root)).toContain(EN.story.sequence.replay.title);
    const replay = byTestId(r.root, 'story-order-replay')[0]!;
    for (const p of MORNING.panels) expect(textOf(replay)).toContain(p.caption.en);
    expect(has(r.root, 'story-order-replay-pause')).toBe(false);
    await settle();
    expect(byTestId(r.root, 'story-order-replay-line-up')[0]!.props['aria-live']).toBe('polite');
    await press(pressable(r.root, 'story-order-replay-next'));
    expect(byTestId(r.root, 'story-order-replay-line-wash')[0]!.props['aria-live']).toBe('polite');
    expect(byTestId(r.root, 'story-order-replay-line-up')[0]!.props['aria-live']).toBe('off');
  });

  it('with motion allowed the replay has a Pause', async () => {
    motion.reduced = false;
    const { r } = await open('captions');
    for (const p of MORNING.panels) await press(pressable(r.root, `story-order-card-${p.id}`));
    expect(has(r.root, 'story-order-replay-pause')).toBe(true);
  });

  it('Done after round 1 opens round 2 (meanings held back again); Done after the last completes the step once', async () => {
    const { r, log } = await open('twoRounds');
    const [day, morning] = STORY_ORDER_FIXTURES.twoRounds.storyOrder!.rounds;
    await press(pressable(r.root, 'story-order-show-meanings'));
    for (const p of day!.panels) await press(pressable(r.root, `story-order-card-${p.id}`));
    await press(pressable(r.root, 'story-order-done'));
    expect(log.completed).toBe(0);
    expect(screenTexts(r.root)).toContain(EN.storyOrder.title);
    expect(has(r.root, 'story-order-show-meanings')).toBe(true);
    for (const p of morning!.panels) await press(pressable(r.root, `story-order-card-${p.id}`));
    await press(pressable(r.root, 'story-order-skip-replay'));
    expect(log.completed).toBe(1);
    expect(log.answers.map((a) => a.key)).toEqual(['so:day:0', 'so:day:1', 'so:day:2', 'so:day:3', 'so:morning:0', 'so:morning:1', 'so:morning:2', 'so:morning:3']);
    expect(log.answers.map((a) => a.hinted === true)).toEqual([true, true, true, true, false, false, false, false]);
  });

  it('Skip this one completes the step', async () => {
    const { r, log } = await open('twoRounds');
    await press(pressable(r.root, 'story-order-skip'));
    expect(log.completed).toBe(1);
    expect(log.answers).toEqual([]);
  });

  it('no round to put in order: the empty line and Continue', async () => {
    const { r, log } = await open('empty');
    expect(screenTexts(r.root)).toContain(EN.story.sequence.emptyLine);
    await press(pressable(r.root, 'story-order-continue'));
    expect(log.completed).toBe(1);
  });

  it('no Korean voice: a placed line shows why it is silent under the slots', async () => {
    rig.current = createAudioRig({ voices: [] });
    const { r } = await open('captions');
    await press(pressable(r.root, 'story-order-card-up'));
    await settle();
    expect(textOf(byTestId(r.root, 'story-order-sound-detail')[0]!)).toBe(getMessages('en').learner.audio.noKoreanVoiceSentence);
  });
});
