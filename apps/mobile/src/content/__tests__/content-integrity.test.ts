import { describe, expect, it } from 'vitest';
import { minigameScopes, scopeFor } from '../../logic/minigame-config';
import { cardById } from '../heritage-cards';
import { episodesAll } from '../episodes';
import { jamoAll } from '../jamo';
import { strokesForJamo, type JamoStrokePoint } from '../jamo-strokes';
import { questById, questsAll } from '../quests';

describe('content integrity', () => {
  it('every quest step minigameRef resolves to a scope of the matching kind', () => {
    for (const q of questsAll) {
      for (const s of q.steps) {
        if (!s.minigameRef) continue;
        const scope = scopeFor(s.minigameRef);
        expect(scope, `${q.id}/${s.id} -> ${s.minigameRef}`).toBeDefined();
        if (s.minigameKind && scope) {
          expect(scope.kind, `${q.id}/${s.id}`).toBe(s.minigameKind);
        }
      }
    }
  });

  it('every episode questId resolves to a quest', () => {
    for (const e of episodesAll) {
      for (const qid of e.questIds) {
        expect(questById(qid), `${e.id} -> ${qid}`).toBeDefined();
      }
    }
  });

  it('every reward card id resolves to a card', () => {
    for (const e of episodesAll) {
      for (const cid of e.rewardCardIds) {
        expect(cardById(cid), `${e.id} -> ${cid}`).toBeDefined();
      }
    }
    for (const q of questsAll) {
      if (q.rewardCardId) {
        expect(cardById(q.rewardCardId), `${q.id} -> ${q.rewardCardId}`).toBeDefined();
      }
    }
  });

  it('build-letter scopes reference real jamo characters', () => {
    const chars = new Set(jamoAll.map((j) => j.char));
    for (const [ref, scope] of Object.entries(minigameScopes)) {
      if (scope.kind !== 'build-letter') continue;
      for (const syl of scope.syllables ?? []) {
        for (const ch of syl.jamoChars) {
          expect(chars.has(ch), `${ref} -> ${syl.ko} -> ${ch}`).toBe(true);
        }
      }
    }
  });

  it('selection-style scopes carry enough jamo', () => {
    for (const [ref, scope] of Object.entries(minigameScopes)) {
      if (scope.kind === 'match-sound' || scope.kind === 'odd-one-out') {
        expect((scope.jamoIds ?? []).length, ref).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('card-based scopes carry enough pairs', () => {
    for (const [ref, scope] of Object.entries(minigameScopes)) {
      if (scope.kind === 'card-match' || scope.kind === 'culture-quiz') {
        expect((scope.cardPairs ?? []).length, ref).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('tap-respond scopes have dialogue with exactly one correct option per turn', () => {
    for (const [ref, scope] of Object.entries(minigameScopes)) {
      if (scope.kind !== 'tap-respond') continue;
      expect((scope.dialogue ?? []).length, ref).toBeGreaterThanOrEqual(1);
      for (const turn of scope.dialogue ?? []) {
        expect(turn.options.filter((o) => o.isCorrect).length, `${ref} -> ${turn.npcKo}`).toBe(1);
        expect(turn.options.length, `${ref} -> ${turn.npcKo}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('jamo stroke skeletons', () => {
  /** Shoelace area on screen (y down): > 0 clockwise, < 0 counter-clockwise. */
  const signedArea = (stroke: JamoStrokePoint[]): number =>
    stroke.reduce((sum, a, i) => {
      const b = stroke[(i + 1) % stroke.length]!;
      return sum + (a.x * b.y - b.x * a.y) / 2;
    }, 0);

  // ㅇ is written from the top, counter-clockwise. The Show-me demo walks
  // these points and F-006 compares the child's winding against them, so a
  // clockwise skeleton would teach — and then reward — the wrong way round.
  it.each([
    ['jamo:ieung', 0],
    ['jamo:ieung-batchim', 0],
    ['jamo:hieut', 2],
  ] as const)('%s circle starts at the top and runs counter-clockwise', (jamoId, strokeIdx) => {
    const circle = strokesForJamo(jamoId)?.[strokeIdx];
    expect(circle, jamoId).toBeDefined();
    const pts = circle!;
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    expect(first).toEqual(last);
    expect(first.y).toBe(Math.min(...pts.map((p) => p.y)));
    expect(signedArea(pts)).toBeLessThan(0);
  });
});
