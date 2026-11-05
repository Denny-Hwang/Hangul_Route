import { TapLockProvider, borderWidth, colors, spacing, useTapLock } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scopeFor } from '../../../logic/minigame-config';
import { validBoards } from '../../../logic/pic-word-flow';
import { useAudioStore } from '../../../store/audio-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { byTestId, press, render, unmount } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { PicWordMatchGame } from '../PicWordMatchGame';

/**
 * AMENDMENTS-TOUCH row KT-4b (section 6, the Pic-Word Match row; KT-D5; KT-D6): the pictures and the words sit on two
 * `target` TapBoards, so a graze counts and a bounce on one tile never counts twice while a quick tap on a different
 * tile still pairs. TileFrame's 4 px padding and its ring are inside each tile's target (no dead ring). A commit that
 * ends a board (its last pair) also locks the app-level clock (`lock(TAP_LOCK_MS)`), since the board then moves on; a
 * pair that does not end the board sets no app lock.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!),
}));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async () => undefined),
}));

const scope = scopeFor('minigame:s1-life-q1-apply')!;
const pairs = validBoards(scope)[0]!.pairs;
const mounted: ReactTestRenderer[] = [];

const host: MinigameHost = { mode: 'quest', answer: () => undefined, complete: () => undefined };

const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};
const within = (node: ReactTestInstance, ancestor: ReactTestInstance): boolean => {
  for (let n: ReactTestInstance | null = node; n !== null; n = n.parent) if (n === ancestor) return true;
  return false;
};
const hostBoard = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.type === 'string');
  if (!node) throw new Error(`no board ${id}`);
  return node;
};

/** A colour as react-native-web writes it (`rgba(r,g,b,1.00)`), from a token's hex or from the DOM style. */
const css = (value: unknown): string => {
  const v = String(value).toLowerCase();
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(v);
  return hex ? `rgba(${hex.slice(1).map((h) => parseInt(h, 16)).join(',')},1.00)` : v;
};

/** The app-level lock as the last render read it (a render that changes nothing keeps the last value). */
const lockSeen: boolean[] = [false];
function LockProbe(): ReactElement | null {
  lockSeen.push(useTapLock().locked);
  return null;
}

beforeEach(() => {
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
  lockSeen.splice(0, lockSeen.length, false);
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

describe('Pic-Word Match on two target boards (row KT-4b)', () => {
  it('every picture is on the pictures board and every word on the words board, each a pinch-zoom target', async () => {
    const r = await render(<PicWordMatchGame scope={scope} host={host} />);
    mounted.push(r);
    const pictures = hostBoard(r.root, 'pic-word-pictures');
    const words = hostBoard(r.root, 'pic-word-words');
    for (const p of pairs) {
      const picture = pressable(r.root, `pic-word-picture-${p.id}`);
      const word = pressable(r.root, `pic-word-word-${p.id}`);
      expect(within(picture, pictures) && !within(picture, words), p.id).toBe(true);
      expect(within(word, words) && !within(word, pictures), p.id).toBe(true);
      // A target inside a board on the web never becomes a browser pan (KT-D3).
      expect(String(JSON.stringify(picture.props.style))).toMatch(/pinch-zoom|"none"/);
    }
  });

  it('the ring and its 4 px padding are on the tile target itself (no dead ring), and the ring turns brand blue when selected', async () => {
    const r = await render(<PicWordMatchGame scope={scope} host={host} />);
    mounted.push(r);
    const id = `pic-word-picture-${pairs[0]!.id}`;
    const flat = (node: ReactTestInstance): Record<string, unknown> => node.props.style as Record<string, unknown>;
    const rest = flat(pressable(r.root, id));
    // react-native-web writes the style as CSS.
    expect(rest.paddingTop ?? rest.padding).toBe(`${spacing.xs}px`);
    expect(rest.borderTopWidth ?? rest.borderWidth).toBe(`${borderWidth.thick}px`);
    expect(css(rest.borderTopColor ?? rest.borderColor)).toBe(css(colors.surface.canvas));
    await press(pressable(r.root, id));
    const chosen = flat(pressable(r.root, id));
    expect(css(chosen.borderTopColor ?? chosen.borderColor)).toBe(css(colors.brand.primary));
  });

  it('a bounce on the selected picture keeps it selected (F2, the target lock and the flow agree)', async () => {
    const r = await render(<PicWordMatchGame scope={scope} host={host} />);
    mounted.push(r);
    const id = `pic-word-picture-${pairs[0]!.id}`;
    await press(pressable(r.root, id));
    await press(pressable(r.root, id));
    const style = pressable(r.root, id).props.style as Record<string, unknown>;
    expect(css(style.borderTopColor ?? style.borderColor)).toBe(css(colors.brand.primary));
  });

  it('the pair that ends the board locks the app clock (KT-D5); an earlier pair does not', async () => {
    const r = await render(
      <TapLockProvider>
        <PicWordMatchGame scope={scope} host={host} />
        <LockProbe />
      </TapLockProvider>,
    );
    mounted.push(r);
    for (const [i, p] of pairs.entries()) {
      await press(pressable(r.root, `pic-word-picture-${p.id}`));
      await press(pressable(r.root, `pic-word-word-${p.id}`));
      const last = i === pairs.length - 1;
      expect(lockSeen.at(-1), `pair ${i + 1} of ${pairs.length}`).toBe(last);
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 450));
    });
    expect(lockSeen.at(-1)).toBe(false);
  });
});
