import { describe, expect, it } from 'vitest';
import { REALIA_FIXTURES } from '../../navigation/realia-read-e2e-fixture';
import { minigameFinishedEvent } from '../minigame-finished';

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

describe('minigameFinishedEvent (the event MinigameScreen sends when a game step closes)', () => {
  it('carries the kind and the step position only: no realia text, word or answer (row G-2)', () => {
    const event = minigameFinishedEvent(REALIA_FIXTURES.menu.kind, 'quest:stage6-snack-q1', 2, 'p1');
    expect(event).toEqual({ name: 'minigame.finished', profileId: 'p1', payload: { kind: 'realia-read', questId: 'quest:stage6-snack-q1', stepIndex: 2 } });
    expect(Object.keys(event.payload ?? {}).sort()).toEqual(['kind', 'questId', 'stepIndex']);
    expect(JSON.stringify(event)).not.toMatch(HANGUL);
  });
});
