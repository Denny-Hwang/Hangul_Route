import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { keysFor } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { startFlow, stepFlow, type FrameInput, type WriteFrameEffect, type WriteFrameEvent } from '../flow';

/**
 * F-CURR-001 §5 test P-1 for `write-frame` (§3.7, OD-6): nothing typed, picked or composed leaves the
 * round, the Write Your Name q3 name included. It lives in the renderer's React state only; the renderer
 * and its logic import no telemetry, store, storage, breadcrumb or logger; no store, persisted slice or
 * navigation param names the game; and the only thing a frame reports (through the host) is its index,
 * right or not, and the round id. The component test checks the name is gone after unmount.
 */
const SRC = join(__dirname, '../../..');
const screen = readFileSync(join(SRC, 'screens/minigames/WriteFrameGame.tsx'), 'utf8');
const logic = ['flow.ts', 'view.ts'].map((f) => readFileSync(join(__dirname, '..', f), 'utf8'));
const minigameScreen = readFileSync(join(SRC, 'screens/minigames/MinigameScreen.tsx'), 'utf8');
const storeDir = join(SRC, 'store');
const stores = readdirSync(storeDir)
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => readFileSync(join(storeDir, f), 'utf8'));

const food: FrameInput = { banks: [['떡볶이', '김밥']], entry: 'type', freeEntry: false };
const name: FrameInput = { banks: [[]], entry: 'type', freeEntry: true };

describe('Write Frame keeps what is written in the round (test P-1)', () => {
  it('the renderer and its logic import no telemetry, store, storage, breadcrumb or logger', () => {
    for (const source of [screen, ...logic]) {
      expect(source).not.toMatch(/platform\/telemetry|\btrack\(|\/store\/|platform\/storage|breadcrumb|console\.|localStorage|AsyncStorage|navigation\.(navigate|push|setParams)/i);
    }
  });

  it('keeps its state in React state and clears its timer on unmount', () => {
    expect(screen).toMatch(/useState<WriteFrameState>/);
    expect(screen).toMatch(/clearTimeout\(advanceTimer\.current\)/);
    expect(screen).not.toMatch(/useMemo\([^)]*written|cache/i);
  });

  it('no store or persisted slice knows the game', () => {
    for (const source of stores) expect(source).not.toMatch(/write-?frame|writeFrame/i);
  });

  it('the quest host sends minigame.finished with the kind and ids only', () => {
    expect(minigameScreen).toMatch(/payload: \{ kind: scope\.kind, questId, stepIndex \}/);
  });

  it('reports a frame only as its index and whether it was right; the name round reports nothing', () => {
    let state = startFlow([food, name]);
    const effects: WriteFrameEffect[] = [];
    const events: WriteFrameEvent[] = [
      { type: 'pick', index: 1 },
      ...keysFor('김밥').map((jamo): WriteFrameEvent => ({ type: 'key', jamo })),
      { type: 'done' },
      { type: 'advance' },
      { type: 'tile', keys: keysFor('호') },
      { type: 'tile', keys: keysFor('야') },
      { type: 'done' },
      { type: 'advance' },
      { type: 'continue' },
    ];
    for (const event of events) {
      const step = stepFlow(state, event);
      state = step.state;
      effects.push(...step.effects);
    }
    expect(effects.filter((e) => e.type === 'answer')).toEqual([{ type: 'answer', roundIdx: 0, correct: true }]);
    expect(JSON.stringify(effects)).not.toMatch(/[ㄱ-ㆎ가-힣]/);
    expect(screen).toMatch(/hostRef\.current\.answer\(effect\.roundIdx, effect\.correct, round \? \{ itemId: round\.id \} : undefined\)/);
  });
});
