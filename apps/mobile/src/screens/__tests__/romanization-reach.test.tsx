import type { ListenPickRound, OrderItRound } from '@hangul-route/content-schema';
import { HiddenHeritageRoundSchema } from '@hangul-route/content-schema';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { FOOD_MARKET_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/food-market';
import { TAP_LOCK_MS } from '@hangul-route/design-system/tap-model';
import { Pressable } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../i18n/use-romanization-mode';
import { playableRealia } from '../../logic/realia-read-flow';
import { EAT_RICE } from '../../logic/sentence-builder/__tests__/fixtures';
import type { MinigameScope } from '../../logic/minigame-config';
import { REALIA_FIXTURES } from '../../navigation/realia-read-e2e-fixture';
import { useAudioStore } from '../../store/audio-store';
import { useProfileStore } from '../../store/profile-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../store/remote-config-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../test-support/audio-rig';
import { byTestId, hostNodes, press, render, unmount } from '../../test-support/render';
import { HiddenHeritageStep } from '../minigames/hidden-heritage-entry';
import * as scenes from '../minigames/hidden-heritage-scenes';
import type { HostMode, MinigameHost } from '../minigames/host';
import { ListenPickGame } from '../minigames/ListenPickGame';
import { RealiaReadGame } from '../minigames/RealiaReadGame';
import { SentenceBuilderGame } from '../minigames/SentenceBuilderGame';

/**
 * AMENDMENTS-ROMANIZATION-FADE section 3.8, row RF-1c: the reach audit. Every surface that folds its romanization under `tap`
 * (and so under `auto` in phase `all`) lets the learner reach it. One test per audited site that lacked a way: the realia's
 * title and key word and Listen & Pick's text prompt show theirs when the question is answered, Hidden Heritage's found words
 * and the Speed round's words to see again show theirs when the round is over, and Sentence Builder draws the built sentence
 * in full. The sites that already had a way are tied to their evidence in `logic/__tests__/romanization-reach-audit.test.ts`.
 * What a sighted learner reads is the text not under an `aria-hidden` ancestor and not invisible.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../test-support/audio-rig')).rigAudio(() => rig.current!),
}));
vi.mock('../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async () => undefined),
}));
const motion = vi.hoisted(() => ({ reduced: true }));
vi.mock('../../platform/motion', () => ({ useReducedMotion: () => motion.reduced }));

const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
  resetRemoteConfigForTests();
  scenes.resetScenesForTests();
});

const host = (mode: HostMode): MinigameHost => ({ mode, answer: () => undefined, complete: () => undefined });
const off = (node: ReactTestInstance): boolean => node.props['aria-hidden'] === true || JSON.stringify(node.props.style ?? {}).includes('"opacity":0');

/** The words a sighted learner reads in `node`: text not under a held (hidden or invisible) ancestor. */
function visible(node: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance | string, hidden: boolean): void => {
    if (typeof n === 'string') {
      if (!hidden && n.trim() !== '') out.push(n);
      return;
    }
    const nowHidden = hidden || (typeof n.type === 'string' && off(n));
    for (const child of n.children) walk(child, nowHidden);
  };
  walk(node, false);
  return out;
}
const reads = (node: ReactTestInstance, text: string): boolean => visible(node).some((t) => t.includes(text));
const names = (node: ReactTestInstance): string =>
  hostNodes(node, (n) => typeof n.props['aria-label'] === 'string')
    .map((n) => String(n.props['aria-label']))
    .join(' | ');

const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};
/** A tap a beat after the last one: a touch inside the board's lock is a bounce. */
const tapId = async (root: ReactTestInstance, id: string): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(TAP_LOCK_MS * 2);
  });
  await press(pressable(root, id));
};

// ---------------------------------------------------------------------------------------------------------------------

describe('Realia Read: the title and the key word (RealiaReadGame, logic/realia-read-flow.ts titleView and keyView)', () => {
  const menu = playableRealia(REALIA_FIXTURES.menu)!;
  const round = menu.rounds[0]!;
  const play = async (mode: HostMode): Promise<ReactTestInstance> => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 375, height: 667 })}>
        <RomanizationModeOverride mode="tap">
          <RealiaReadGame scope={REALIA_FIXTURES.menu} host={host(mode)} />
        </RomanizationModeOverride>
      </LayoutProvider>,
    );
    mounted.push(r);
    return r.root;
  };

  it.each(['quest', 'check'] as const)('%s, tap: the title and the key word fold while the question is open and show with the answer', async (mode) => {
    const root = await play(mode);
    const sheet = (): ReactTestInstance => byTestId(root, 'realia-read-sheet')[0]!;
    const key = (): ReactTestInstance => byTestId(root, 'realia-read-key')[0]!;
    expect(reads(sheet(), '메뉴')).toBe(true);
    expect(reads(sheet(), 'menyu')).toBe(false);
    if (round.key) expect(reads(key(), round.key.romanization)).toBe(false);
    // The names keep the romanization; a missed option does not end the question.
    expect(names(sheet())).toContain('menyu');
    const wrong = round.options.find((o) => o.id !== round.answerId && o.text)!;
    await tapId(root, `realia-read-option-${wrong.id}`);
    expect(reads(sheet(), 'menyu')).toBe(false);

    await tapId(root, `realia-read-option-${round.answerId}`);
    expect(reads(sheet(), 'menyu')).toBe(true);
    if (round.key) expect(reads(key(), round.key.romanization)).toBe(true);
  });

  it('a line still has its tap, which the answer does not need', async () => {
    const root = await play('quest');
    const sheet = (): ReactTestInstance => byTestId(root, 'realia-read-sheet')[0]!;
    expect(reads(sheet(), 'gimbap')).toBe(false);
    await tapId(root, 'realia-read-sheet-line-gimbap');
    expect(reads(sheet(), 'gimbap')).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------

describe("Listen & Pick's text prompt (ListenPickGame.tsx, a Read Pick round)", () => {
  const options = [
    { id: 'gureum', pictureRef: 'word:nature-cloud', labelEn: 'cloud' },
    { id: 'bi', pictureRef: 'word:nature-rain', labelEn: 'rain' },
    { id: 'baram', pictureRef: 'word:science-wind', labelEn: 'wind' },
  ];
  const READ_PICK: ListenPickRound = { id: 'pic-gureum', promptShown: true, prompt: { ko: '구름', romanization: 'gureum', en: 'cloud' }, options, answerId: 'gureum' };
  const scope: MinigameScope = { kind: 'listen-pick', rounds: 1, listenPick: { rounds: [READ_PICK] } };
  const play = async (mode: HostMode, romanization: 'tap' | 'always'): Promise<ReactTestInstance> => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 375, height: 667 })}>
        <RomanizationModeOverride mode={romanization}>
          <ListenPickGame scope={scope} host={host(mode)} />
        </RomanizationModeOverride>
      </LayoutProvider>,
    );
    mounted.push(r);
    return r.root;
  };
  const prompt = (root: ReactTestInstance): ReactTestInstance => byTestId(root, 'listen-pick-text-prompt')[0]!;

  it.each(['quest', 'vocab', 'preview', 'check'] as const)('%s, tap: the prompt folds while the question is open, a miss keeps it, the answer shows it', async (mode) => {
    const root = await play(mode, 'tap');
    expect(reads(prompt(root), '구름')).toBe(true);
    expect(reads(prompt(root), 'gureum')).toBe(false);
    await tapId(root, 'listen-pick-option-bi');
    expect(reads(prompt(root), 'gureum')).toBe(false);
    await tapId(root, 'listen-pick-option-gureum');
    expect(reads(prompt(root), 'gureum')).toBe(true);
  });

  it('always: the prompt shows from the start, as before', async () => {
    const root = await play('quest', 'always');
    expect(reads(prompt(root), 'gureum')).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------

describe("Hidden Heritage's found words (HiddenHeritageGame.tsx, the end panel)", () => {
  const ROUND = HiddenHeritageRoundSchema.parse(FOOD_MARKET_SCENE.round);
  const SCOPE: MinigameScope = { kind: 'hidden-heritage', rounds: ROUND.targets.length, hiddenHeritage: { rounds: [ROUND] } };
  const spots = (root: ReactTestInstance): ReactTestInstance[] =>
    root.findAll((n) => n.type === Pressable && typeof n.props.testID === 'string' && n.props.testID.startsWith('hh-spot-'));

  it('tap: the found slots fold while the scene plays; the end panel shows every found word with its romanization', async () => {
    useProfileStore.setState({ activeId: 'profile:hh-reach' });
    useRemoteConfigStore.setState({ hydrated: true, cache: { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { 'game.hidden-heritage': { on: true, pct: 100 } } } });
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
        <RomanizationModeOverride mode="tap">
          <HiddenHeritageStep scope={SCOPE} host={host('quest')} />
        </RomanizationModeOverride>
      </LayoutProvider>,
    );
    mounted.push(r);
    for (let i = 0; i < 100 && byTestId(r.root, 'lesson-waiting').length > 0; i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    }
    const measured = r.root.findAll((n) => typeof n.props.onLayout === 'function' && n.props.testID === undefined);
    if (measured[0]) {
      await act(async () => {
        measured[0]!.props.onLayout({ nativeEvent: { layout: { width: 288, height: 500, x: 0, y: 0 } } });
      });
    }
    const first = ROUND.targets.map((t) => t.word.romanization)[0]!;
    // Nothing of the words shows its romanization while the scene plays.
    expect(reads(r.root, first)).toBe(false);
    for (let i = 0; i < ROUND.targets.length * 3 && byTestId(r.root, 'hh-end').length === 0; i += 1) {
      const prompt = r.root.findAll((n) => n.props.testID === 'hh-prompt' && n.props.ko !== undefined)[0];
      const asked = prompt ? ROUND.targets.find((t) => t.word.ko === prompt.props.ko) : undefined;
      if (asked) await act(async () => spots(r.root).find((s) => s.props.testID === `hh-spot-${asked.id}`)!.props.onPress());
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 800));
      });
    }
    const end = byTestId(r.root, 'hh-end')[0]!;
    for (const t of ROUND.targets) expect(reads(end, t.word.romanization), t.word.ko).toBe(true);
  }, 30_000);
});

// ---------------------------------------------------------------------------------------------------------------------

describe('Sentence Builder: the built sentence (SentenceBuilderGame.tsx, the done panel)', () => {
  const order: OrderItRound = EAT_RICE;
  it('tap: the tiles and the line fold while it is built; the done panel draws the whole sentence with its romanization', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const r = await render(
      <RomanizationModeOverride mode="tap">
        <SentenceBuilderGame scope={{ kind: 'order-it', rounds: 1, orderIt: { rounds: [order] } }} host={host('quest')} />
      </RomanizationModeOverride>,
    );
    mounted.push(r);
    const tray = (): ReactTestInstance => byTestId(r.root, 'sentence-builder-tray')[0]!;
    const sentenceRom = order.sentence.romanization;
    const firstWord = sentenceRom.split(/\s+/)[0]!.replace(/[.?!]$/, '');
    expect(reads(tray(), firstWord)).toBe(false);
    const ids = byTestId(r.root, 'sentence-builder-tray')[0]!
      .findAll((n) => typeof n.props.testID === 'string' && /^sentence-builder-tile-/.test(n.props.testID) && typeof n.props.onClick === 'function')
      .map((n) => String(n.props.testID).replace('sentence-builder-tile-', ''));
    expect(ids.length).toBeGreaterThan(0);
    // Build it in order, a second apart.
    const start = Date.now();
    const now = vi.spyOn(Date, 'now');
    for (const [i, id] of ['w0', 'w1', 'w2'].entries()) {
      now.mockReturnValue(start + (i + 1) * 1000);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(TAP_LOCK_MS * 2);
      });
      const node = byTestId(r.root, `sentence-builder-tile-${id}`).find((n) => typeof n.props.onClick === 'function');
      if (!node) break;
      await press(node);
    }
    now.mockRestore();
    const done = byTestId(r.root, 'sentence-builder-done')[0];
    expect(done).toBeDefined();
    expect(reads(done!, sentenceRom)).toBe(true);
  });
});
