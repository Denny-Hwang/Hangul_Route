import { readFileSync } from 'node:fs';
import { LessonCellSchema, keysFor, type WriteFrameRound } from '@hangul-route/content-schema';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { SENTENCE_PAUSE_MS } from '../../../logic/write-frame/flow';
import { byTestId, press, resetPlatform, screenTexts } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { WriteFrameGame } from '../WriteFrameGame';

/**
 * F-CURR-001 §5 test P-1, extended by row S7-1 to the real Write Your Name q3 round
 * (`content/episodes/stage-7/letters.json`, §3.7 and behaviour 10): the learner's name, built
 * with the cell's own sound table, never reaches the host (the only path to telemetry and
 * progress), a log line or browser storage, and is gone once the Write Frame step unmounts.
 * The composed name in this test is the cast name 호야, never a real name.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;
vi.mock('../../../platform/screen-reader', () => ({ announceForScreenReader: vi.fn(), focusForScreenReader: vi.fn() }));

const cell = LessonCellSchema.parse(
  JSON.parse(readFileSync(new URL('../../../../../../content/episodes/stage-7/letters.json', import.meta.url), 'utf8')),
);
const apply = cell.quests[2]!.scopes.find((s) => s.kind === 'write-frame');
if (apply?.kind !== 'write-frame') throw new Error('Write Your Name q3 has no Write Frame scope');
const rounds: WriteFrameRound[] = apply.rounds;
const nameRound = rounds.find((r) => r.freeEntry)!;

type Host = MinigameHost & { calls: unknown[]; completes: number };
const host = (): Host => {
  const h: Host = {
    mode: 'quest',
    calls: [],
    completes: 0,
    answer: (key, correct, meta) => void h.calls.push([key, correct, meta]),
    complete: () => {
      h.completes += 1;
    },
  };
  return h;
};

const mounted: ReactTestRenderer[] = [];
async function play(list: WriteFrameRound[], h: Host = host()): Promise<{ r: ReactTestRenderer; h: Host }> {
  const scope = { kind: 'write-frame' as const, rounds: list.length, writeFrame: { rounds: list } };
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <LayoutProvider value={layoutClassFor({ width: 375, height: 667 })}>
        <RomanizationModeOverride mode="always">
          <WriteFrameGame scope={scope} host={h} />
        </RomanizationModeOverride>
      </LayoutProvider>,
      { createNodeMock: () => ({ focus: vi.fn(), addEventListener: () => undefined, removeEventListener: () => undefined }) },
    );
  });
  mounted.push(r);
  return { r, h };
}

const root = (r: ReactTestRenderer): ReactTestInstance => r.root;
const tap = async (r: ReactTestRenderer, id: string): Promise<void> => {
  const node = byTestId(root(r), id).find((n) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};
const typeWord = async (r: ReactTestRenderer, text: string): Promise<void> => {
  for (const j of keysFor(text)) await tap(r, `hangul-key-${j}`);
};
const texts = (r: ReactTestRenderer, id = 'write-frame'): string[] => screenTexts(byTestId(root(r), id)[0]!);
const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};
const HANGUL = /[ㄱ-ㆎ가-힣]/;

afterEach(async () => {
  for (const r of mounted.splice(0)) {
    await act(async () => {
      r.unmount();
    });
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetPlatform();
});

describe('test P-1 on Write Your Name q3 (S7-1)', () => {
  it('a bank round of the step, then the name round: the host hears ids, indices and booleans only', async () => {
    vi.useFakeTimers();
    const { r, h } = await play([rounds[0]!, nameRound]);
    await tap(r, 'write-frame-word-0');
    await typeWord(r, rounds[0]!.slots[0]!.bank[0]!.ko);
    await tap(r, 'write-frame-done');
    await advance(SENTENCE_PAUSE_MS);
    await tap(r, 'write-frame-tile-호');
    await tap(r, 'write-frame-tile-야');
    await tap(r, 'write-frame-done');
    await advance(SENTENCE_PAUSE_MS);
    await tap(r, 'write-frame-continue');
    expect(h.calls).toHaveLength(1);
    expect(JSON.stringify(h.calls)).not.toMatch(HANGUL);
    expect(h.completes).toBe(1);
  });

  it('builds the cast name 호야 from the cell sound table; nothing is reported, logged or stored, and the name round is unscored', async () => {
    vi.useFakeTimers();
    const logs = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    // The suite runs in node, which has no Web Storage: stub both, so the storage check always runs.
    const storage = (): Storage => {
      const map = new Map<string, string>();
      return {
        get length() {
          return map.size;
        },
        clear: () => map.clear(),
        getItem: (k) => map.get(k) ?? null,
        key: (i) => [...map.keys()][i] ?? null,
        removeItem: (k) => void map.delete(k),
        setItem: (k, v) => void map.set(k, String(v)),
      };
    };
    vi.stubGlobal('localStorage', storage());
    vi.stubGlobal('sessionStorage', storage());
    const setItems = [vi.spyOn(globalThis.localStorage, 'setItem'), vi.spyOn(globalThis.sessionStorage, 'setItem')];
    const { r, h } = await play([nameRound]);
    expect(texts(r)).toEqual(expect.arrayContaining(['Write your name in Hangul', 'There is no wrong way to write your name.']));
    // Every tile of the cell's table is on screen.
    for (const tile of [...nameRound.soundTable!.groups.flat(), ...nameRound.soundTable!.finals]) {
      expect(byTestId(root(r), `write-frame-tile-${tile.ko}`).length, tile.ko).toBeGreaterThan(0);
    }
    await tap(r, 'write-frame-tile-호');
    await tap(r, 'write-frame-tile-야');
    await tap(r, 'write-frame-done');
    expect(texts(r, 'write-frame-sentence')).toEqual(expect.arrayContaining(['제 이름은 호야예요.', 'My name is Hoya.']));
    await advance(SENTENCE_PAUSE_MS);
    expect(texts(r, 'write-frame-my-page')).toContain('제 이름은 호야예요.');
    await tap(r, 'write-frame-continue');
    expect(h.calls).toEqual([]);
    expect(h.completes).toBe(1);
    for (const spy of logs) expect(spy).not.toHaveBeenCalled();
    for (const setItem of setItems) expect(setItem).not.toHaveBeenCalled();
    expect(globalThis.localStorage.length + globalThis.sessionStorage.length).toBe(0);
  });

  it('the composed name is gone after the step unmounts: a new mount of the real round starts empty', async () => {
    const first = await play([nameRound]);
    await tap(first.r, 'write-frame-tile-호');
    await tap(first.r, 'write-frame-tile-야');
    expect(texts(first.r)).toContain('호야');
    await act(async () => {
      first.r.unmount();
    });
    mounted.splice(mounted.indexOf(first.r), 1);
    const second = await play([nameRound]);
    expect(texts(second.r)).not.toContain('호야');
    expect(texts(second.r)).toContain('Write your name in Hangul');
  });
});
