import { blockParts, REPRESENTATIVE_FINALS } from '@hangul-route/content-schema';
import type { ReviewFormat } from '@hangul-route/content-schema/review-items';
import { describe, expect, it } from 'vitest';
import { INDEX } from '../../memory/__tests__/fixtures';
import { dayReviewLog, planSession } from '../daily-review';
import { buildCheck, buildDailyReview, type EngineContext, type EngineRow } from '../engine';
import { roundFor, surfaceIndex, type BuildRound, type RoundInput } from '../review-rounds';

/**
 * F-CURR-002 section 4.3 ("Real due items are never pushed to other days"), row CM-32: with `game.syllable-build` on,
 * a symbol is asked as Syllable Build only when a block of this build's review items can host it; every other symbol
 * keeps its read rung, so no due symbol leaves a Daily Review or a Check for want of a round. On the review items of
 * this build, not a stand-in set.
 */

const ON = new Set<ReviewFormat>(['syllable-build']);
const TODAY = '2026-11-10';
const GAMES = surfaceIndex(INDEX, ON);
const SYMS = GAMES.items.filter((i) => i.kind === 'sym');
const ROUNDS: Omit<RoundInput, 'index'> = { gloss: (_key, en) => en, seed: 'build-session' };
/** Held at box 3 with the ladder at produce, due today. */
const held = (): EngineRow => ({ st: { b: 3, d: TODAY, c: 2, r: 3, n: 4, f: '2026-10-01', s: 3, at: '2026-11-09T09:00:00.000Z' } });

function ctxOf(ids: readonly string[], states: EngineContext['states'] = Object.fromEntries(ids.map((id) => [id, held()]))): EngineContext {
  return { index: GAMES, states, today: TODAY, voice: true, seed: 'build-session' };
}

describe('Syllable Build over the symbols of this build (row CM-32)', () => {
  it('keeps the format only for a symbol a block can host; the rest (ㅌ, compound vowels, finals heard as another) keep read', () => {
    const building = SYMS.filter((i) => i.formats.includes('syllable-build'));
    const reading = SYMS.filter((i) => !i.formats.includes('syllable-build'));
    expect(building.length).toBeGreaterThan(10);
    expect(reading.length).toBeGreaterThan(0);
    for (const item of reading) expect(item.formats, item.id).toContain('read-pick');
    expect(reading.map((i) => i.id)).toContain('sym:tieut');
  });

  it('every symbol that keeps it gets a round: a block holding the symbol in its zone', () => {
    for (const item of SYMS.filter((i) => i.formats.includes('syllable-build'))) {
      const q = { itemId: item.id, kind: item.kind, rung: 'produce' as const, format: 'syllable-build' as const, theme: item.home, stretch: false, voiceFallback: false };
      const round = roundFor(q, { ...ROUNDS, index: GAMES }) as BuildRound | null;
      expect(round, item.id).not.toBeNull();
      expect(round!.type).toBe('build');
    }
  });

  it('a Check of every held symbol plays each of them: none is skipped', () => {
    const ids = SYMS.map((i) => i.id);
    const ctx = ctxOf(ids);
    const session = buildCheck(ctx, { itemIds: ids, size: ids.length });
    expect(session.questions).toHaveLength(ids.length);
    const missing = session.questions.filter((q) => roundFor(q, { ...ROUNDS, index: ctx.index, states: ctx.states }) === null).map((q) => q.itemId);
    expect(missing).toEqual([]);
  });

  it('a Daily Review of held symbols plays every question the engine first offered', () => {
    const ids = SYMS.map((i) => i.id);
    const ctx = ctxOf(ids);
    const offered = buildDailyReview(ctx, dayReviewLog([], TODAY)).questions.map((q) => q.itemId);
    const plan = planSession(ctx, dayReviewLog([], TODAY), 'daily', ROUNDS);
    expect(plan?.rounds.map((r) => r.question.itemId)).toEqual(offered);
  });

  it('a symbol builds a block the learner has met first, then a block of the Stage 1 table, never an unmet later word first', () => {
    const sym = SYMS.find((i) => i.ko === 'ㅏ' && !i.id.endsWith('-batchim'))!;
    expect(sym).toBeDefined();
    const q = { itemId: sym.id, kind: sym.kind, rung: 'produce' as const, format: 'syllable-build' as const, theme: sym.home, stretch: false, voiceFallback: false };
    const hostWith = (kind: 'syl' | 'lex') =>
      GAMES.items.filter((i) => {
        const p = blockParts(i.ko);
        return i.kind === kind && p !== null && p.vowel === 'ㅏ' && (p.final === null || REPRESENTATIVE_FINALS.includes(p.final));
      });
    const tableBlocks = new Set(hostWith('syl').map((i) => i.ko));
    // A one-block word of a later stage, not a block of the Stage 1 table.
    const word = hostWith('lex').find((i) => !tableBlocks.has(i.ko) && i.stage > 1);
    expect(word, 'a later one-block word with ㅏ').toBeDefined();
    // Nothing met, over many seeds: always a block of the Stage 1 table, never the unmet later word.
    for (let s = 0; s < 40; s += 1) {
      const round = roundFor(q, { ...ROUNDS, seed: `s${s}`, index: GAMES, states: {} }) as BuildRound;
      expect(tableBlocks.has(round.target.ko), round.target.ko).toBe(true);
    }
    // The word met: it is the host.
    const met = roundFor(q, { ...ROUNDS, index: GAMES, states: { [word!.id]: held() } }) as BuildRound;
    expect(met.target.ko).toBe(word!.ko);
  });
});
