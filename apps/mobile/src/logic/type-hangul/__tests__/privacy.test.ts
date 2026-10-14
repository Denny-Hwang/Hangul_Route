import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { startFlow, stepFlow, type TypeHangulEffect, type TypeHangulEvent } from '../flow';

/**
 * F-CURR-001 §5 test P-1 for `type-hangul`: nothing typed leaves the round. The typed keys live in the
 * renderer's React state only; the renderer imports no telemetry, store, storage or logger, and the
 * only thing a round reports (through the host) is its index, right or not, and the round id.
 */
const screen = readFileSync(join(__dirname, '../../../screens/minigames/TypeHangulGame.tsx'), 'utf8');
const logic = ['flow.ts', 'score.ts', 'sounds.ts'].map((f) => readFileSync(join(__dirname, '..', f), 'utf8'));

describe('Type Hangul keeps what is typed in the round (test P-1)', () => {
  it('the renderer imports no telemetry, store, storage, breadcrumb or logger', () => {
    for (const source of [screen, ...logic]) {
      expect(source).not.toMatch(/platform\/telemetry|\btrack\(|\/store\/|platform\/storage|breadcrumb|console\.|localStorage|AsyncStorage/i);
    }
  });

  it('keeps its state in React state and clears its timer on unmount', () => {
    expect(screen).toMatch(/useState<TypeHangulState>/);
    expect(screen).toMatch(/clearTimeout\(advanceTimer\.current\)/);
  });

  it('reports a round only as its index and whether it was right, never the text', () => {
    let state = startFlow(['호야']);
    const effects: TypeHangulEffect[] = [];
    const events: TypeHangulEvent[] = [
      { type: 'key', jamo: 'ㅎ' },
      { type: 'key', jamo: 'ㅗ' },
      { type: 'key', jamo: 'ㅇ' },
      { type: 'key', jamo: 'ㅕ' },
      { type: 'done' },
    ];
    for (const event of events) {
      const step = stepFlow(state, event);
      state = step.state;
      effects.push(...step.effects);
    }
    expect(JSON.stringify(effects)).not.toMatch(/[ㄱ-ㆎ가-힣]/);
    expect(screen).toMatch(/hostRef\.current\.answer\(effect\.roundIdx, effect\.correct, round \? \{ itemId: round\.id \} : undefined\)/);
  });
});
