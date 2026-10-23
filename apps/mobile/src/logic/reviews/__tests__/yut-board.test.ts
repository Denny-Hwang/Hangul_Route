import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { romanizeWord } from '@hangul-route/content-schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  BOARD_START,
  BOARD_STATIONS,
  MAX_THROWS_PER_ITEM,
  OUTER_STATIONS,
  THROW_NAMES,
  THROW_WEIGHTS,
  TRAY_PIECES,
  YUT_REVIEW_FLAG,
  YUT_STATIONS,
  YUT_THROWS,
  boardAfter,
  homeTray,
  moveFor,
  moveFrames,
  sessionSeed,
  throwsFor,
  walk,
} from '../yut-board';

/**
 * F-CURR-002 section 7.1 F10 and row CM-39 (design/wireframes/minigame/yut-review.md, Data needs): the Yut Review
 * board's pure rules. The throw is seeded by the session and the item's place in it, and the board is a function of
 * those two alone: no answer, star, point or reward reaches it, and nothing it returns is one.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

describe('the five throws (sourced: Encyclopedia of Korean Culture E0042794, Korea Heritage Service; story seollal f7, f8)', () => {
  it('do 1, gae 2, geol 3, yut 4, mo 5; yut and mo throw again', () => {
    expect(THROW_NAMES).toEqual(['do', 'gae', 'geol', 'yut', 'mo']);
    expect(THROW_NAMES.map((n) => [YUT_THROWS[n].ko, YUT_THROWS[n].stations, YUT_THROWS[n].again])).toEqual([
      ['도', 1, false],
      ['개', 2, false],
      ['걸', 3, false],
      ['윷', 4, true],
      ['모', 5, true],
    ]);
  });

  it('each name is romanized by the F-CNT-002 converter (rr.ts)', () => {
    for (const name of THROW_NAMES) expect(YUT_THROWS[name].romanization).toBe(romanizeWord(YUT_THROWS[name].ko));
    expect(THROW_NAMES.map((n) => YUT_THROWS[n].romanization)).toEqual(['do', 'gae', 'geol', 'yut', 'mo']);
  });

  it('a chain ends on 도, 개 or 걸: the throws that give no other', () => {
    expect(THROW_NAMES.filter((n) => !YUT_THROWS[n].again)).toEqual(['do', 'gae', 'geol']);
  });

  it('the weights are a named constant: every throw can come up, none is a backward move', () => {
    for (const name of THROW_NAMES) expect(THROW_WEIGHTS[name]).toBeGreaterThan(0);
    for (const name of THROW_NAMES) expect(YUT_THROWS[name].stations).toBeGreaterThan(0);
  });

  it('the switch is game.yut-review', () => {
    expect(YUT_REVIEW_FLAG).toBe('game.yut-review');
  });
});

describe('the board: 29 stations, 20 on the edge in walk order and 9 on the two crossing lines', () => {
  it('has 29 distinct stations; the first 20 are the outer ring, one step apart', () => {
    expect(BOARD_STATIONS).toBe(29);
    expect(OUTER_STATIONS).toBe(20);
    expect(YUT_STATIONS).toHaveLength(29);
    expect(new Set(YUT_STATIONS.map((s) => `${s.x},${s.y}`)).size).toBe(29);
    for (let i = 0; i < OUTER_STATIONS; i += 1) {
      const a = YUT_STATIONS[i]!;
      const b = YUT_STATIONS[(i + 1) % OUTER_STATIONS]!;
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y), `station ${i}`).toBeCloseTo(20, 5);
    }
  });

  it('the start is the bottom right corner, and the piece walks up the right side first', () => {
    expect(YUT_STATIONS[0]).toEqual({ x: 110, y: 110 });
    expect(YUT_STATIONS[1]).toEqual({ x: 110, y: 90 });
    expect(YUT_STATIONS[5]).toEqual({ x: 110, y: 10 });
    expect(YUT_STATIONS[10]).toEqual({ x: 10, y: 10 });
    expect(YUT_STATIONS[15]).toEqual({ x: 10, y: 110 });
  });
});

describe('walk', () => {
  it('moves forward station by station', () => {
    expect(walk(BOARD_START, 3)).toEqual({ path: [1, 2, 3], to: { position: 3, laps: 0 }, home: false });
  });

  it('a piece that reaches the start again goes home; the next piece starts at the start (no carry, no backward move)', () => {
    expect(walk({ position: 18, laps: 0 }, 2)).toEqual({ path: [19, 0], to: { position: 0, laps: 1 }, home: true });
    expect(walk({ position: 19, laps: 2 }, 5)).toEqual({ path: [0], to: { position: 0, laps: 3 }, home: true });
  });
});

describe('homeTray: only the pieces that went home, never empty slots or a count out of four', () => {
  it('0 with no lap, then 1 to 4, and a fifth lap draws 1 again', () => {
    expect(TRAY_PIECES).toBe(4);
    expect([0, 1, 2, 3, 4, 5, 6, 8, 9].map(homeTray)).toEqual([0, 1, 2, 3, 4, 1, 2, 4, 1]);
  });
});

describe('throwsFor: seeded, play only', () => {
  it('is deterministic for a seed and an item index', () => {
    const seed = sessionSeed(['daily', 'lex:a', 'lex:b']);
    expect(throwsFor(seed, 3)).toEqual(throwsFor(seed, 3));
    expect(sessionSeed(['daily', 'lex:a'])).not.toBe(sessionSeed(['daily', 'lex:b']));
    expect(sessionSeed(['ab', 'c'])).not.toBe(sessionSeed(['a', 'bc']));
  });

  it('yut and mo always throw again, up to the cap; the last throw of a chain is never yut or mo', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), fc.integer({ min: 0, max: 400 }), (seed, index) => {
        const chain = throwsFor(seed, index);
        expect(chain.length).toBeGreaterThanOrEqual(1);
        expect(chain.length).toBeLessThanOrEqual(MAX_THROWS_PER_ITEM);
        chain.forEach((t, i) => expect(t.again).toBe(i < chain.length - 1));
      }),
      { numRuns: 500 },
    );
  });

  it('every throw comes up over many items, in about the weights', () => {
    const counts = new Map<string, number>();
    const seed = sessionSeed(['keep-going']);
    const n = 8000;
    for (let i = 0; i < n; i += 1) {
      const first = throwsFor(seed, i)[0]!;
      counts.set(first.name, (counts.get(first.name) ?? 0) + 1);
    }
    const total = THROW_NAMES.reduce((s, name) => s + THROW_WEIGHTS[name], 0);
    for (const name of THROW_NAMES) expect((counts.get(name) ?? 0) / n, name).toBeCloseTo(THROW_WEIGHTS[name] / total, 1);
  });
});

describe('boardAfter: the board is a function of the session seed and how many items finished, nothing else', () => {
  it('before any item: the start, no throw', () => {
    expect(boardAfter(1, 0)).toEqual({ state: BOARD_START, last: null, throwCount: 0 });
  });

  it('exactly one move per finished item, each the seeded one, folded from the start', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), fc.integer({ min: 1, max: 40 }), (seed, finished) => {
        let state = BOARD_START;
        let last = null as ReturnType<typeof moveFor> | null;
        let throwCount = 0;
        for (let i = 0; i < finished; i += 1) {
          last = moveFor(seed, i, state);
          state = last.to;
          throwCount += 1;
        }
        expect(boardAfter(seed, finished)).toEqual({ state, last, throwCount });
        expect(throwCount).toBe(finished);
      }),
      { numRuns: 200 },
    );
  });

  it('a move walks every throw of its chain, and a piece home mid-chain hands the rest to the next piece', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), fc.integer({ min: 0, max: 60 }), fc.integer({ min: 0, max: 19 }), fc.nat(10), (seed, index, position, laps) => {
        const move = moveFor(seed, index, { position, laps });
        expect(move.legs.map((l) => l.throw)).toEqual(throwsFor(seed, index));
        let state = { position, laps };
        for (const leg of move.legs) {
          const w = walk(state, leg.throw.stations);
          expect(leg).toEqual({ throw: leg.throw, ...w });
          state = w.to;
        }
        expect(move.to).toEqual(state);
        expect(move.to.laps).toBeGreaterThanOrEqual(laps);
      }),
      { numRuns: 300 },
    );
  });

  it('takes no answer: its signature is the seed and a count', () => {
    expect(boardAfter.length).toBe(2);
    expect(moveFor.length).toBe(3);
  });
});

describe('play only: the module has no reward path (section 7.1 F10, 7.5, 7.7 no random rewards)', () => {
  const source = readFileSync(join(HERE, '../yut-board.ts'), 'utf8');
  const skin = readFileSync(join(HERE, '../../../screens/reviews/YutBoardSkin.tsx'), 'utf8');

  it('imports nothing that scores, records, rewards or sends', () => {
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    expect(imports.filter((i) => /star|points|memory|progress|card|award|goal|telemetry|storage|record/i.test(i ?? ''))).toEqual([]);
    const skinImports = [...skin.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    expect(skinImports.filter((i) => /star|points|memory|progress|card|award|goal|telemetry|storage|record/i.test(i ?? ''))).toEqual([]);
  });

  it('opens no link and navigates nowhere (the CM-33 test, wireframe Navigation graph)', () => {
    for (const text of [source, skin]) {
      expect(text).not.toMatch(/\bLinking\b|openExternalUrl|StorySources|ExternalLink|CultureNotes|navigat/);
    }
  });
});

describe('moveFrames: what the band shows while the piece walks', () => {
  const TIMES = { fall: 200, step: 120, again: 320 };

  it('one throw: the throw shows, the sticks fall, then one frame per station', () => {
    const move = { from: BOARD_START, legs: [{ throw: YUT_THROWS.geol, ...walk(BOARD_START, 3) }], to: { position: 3, laps: 0 } };
    expect(moveFrames(move, TIMES, false)).toEqual([
      { legs: 1, position: 0, laps: 0, delay: 0 },
      { legs: 1, position: 1, laps: 0, delay: 200 },
      { legs: 1, position: 2, laps: 0, delay: 120 },
      { legs: 1, position: 3, laps: 0, delay: 120 },
    ]);
  });

  it('윷 then 도 past home: the second throw follows after the pause, the tray fills when the piece reaches home', () => {
    const from = { position: 17, laps: 1 };
    const first = walk(from, 4);
    const second = walk(first.to, 1);
    const move = { from, legs: [{ throw: YUT_THROWS.yut, ...first }, { throw: YUT_THROWS.do, ...second }], to: second.to };
    expect(first).toEqual({ path: [18, 19, 0], to: { position: 0, laps: 2 }, home: true });
    expect(moveFrames(move, TIMES, false)).toEqual([
      { legs: 1, position: 17, laps: 1, delay: 0 },
      { legs: 1, position: 18, laps: 1, delay: 200 },
      { legs: 1, position: 19, laps: 1, delay: 120 },
      { legs: 1, position: 0, laps: 2, delay: 120 },
      { legs: 2, position: 0, laps: 2, delay: 320 },
      { legs: 2, position: 1, laps: 2, delay: 200 },
    ]);
  });

  it('reduced motion: one frame with every throw and the piece at its station', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), fc.integer({ min: 0, max: 30 }), (seed, index) => {
        const move = moveFor(seed, index, boardAfter(seed, index).state);
        expect(moveFrames(move, TIMES, true)).toEqual([{ legs: move.legs.length, position: move.to.position, laps: move.to.laps, delay: 0 }]);
        const frames = moveFrames(move, TIMES, false);
        expect(frames[frames.length - 1]).toMatchObject({ legs: move.legs.length, position: move.to.position, laps: move.to.laps });
      }),
      { numRuns: 200 },
    );
  });
});
