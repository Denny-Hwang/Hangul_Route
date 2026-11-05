import type { ReviewFormat, ReviewItem } from '@hangul-route/content-schema/review-items';
import { describe, expect, it } from 'vitest';
import { INDEX } from '../../memory/__tests__/fixtures';
import { normalizeAskedKo } from '../../memory/resolve';
import type { EngineContext, ReviewQuestion } from '../engine';
import { pickRound as questPickRound } from '../quest-reviews';
import { roundFor, surfaceIndex, type PickRound, type RoundInput } from '../review-rounds';

/**
 * F-CURR-002 sections 4.2 and 4.5: a line the lessons taught with two good replies (an exchange frozen as two `exc`
 * items with one line, such as 책 여기 있어요 answered with 감사합니다! or with 이 책 주세요) never offers the other
 * good reply as a wrong option, in a Daily Review, a Check, a warm-up or Try these again. On the review items of this
 * build, not a stand-in set.
 */

const SEEDS = Array.from({ length: 40 }, (_, n) => `sibling-${n}`);
const FORMATS: readonly ReviewFormat[] = ['hear-pick', 'read-pick'];
const SURFACE = surfaceIndex(INDEX);
const EXC = INDEX.items.filter((i) => i.kind === 'exc' && !INDEX.retired.has(i.id));

/** The other exchanges with the same line, and their replies. */
function siblingReplies(item: ReviewItem): Set<string> {
  const line = normalizeAskedKo(item.ko);
  return new Set(EXC.filter((i) => i.id !== item.id && normalizeAskedKo(i.ko) === line && i.reply !== undefined).map((i) => normalizeAskedKo(i.reply?.ko ?? '')));
}

const WITH_SIBLINGS = EXC.filter((i) => siblingReplies(i).size > 0);

const question = (item: ReviewItem, format: ReviewFormat): ReviewQuestion => ({
  itemId: item.id,
  kind: item.kind,
  rung: format === 'hear-pick' ? 'recognize' : 'read',
  format,
  theme: item.home,
  stretch: false,
  voiceFallback: false,
});

describe('a second right reply is never a wrong option', () => {
  it('this build has lines taught with two good replies (the case is real, so the checks below bite)', () => {
    const ids = WITH_SIBLINGS.map((i) => i.id);
    expect(ids).toContain('exc:chaek-yeogi-isseoyo');
    expect(ids).toContain('exc:chaek-yeogi-isseoyo~2');
  });

  it('a Daily Review, Cell Check or Stage Check pick round leaves out the replies of the same line', () => {
    let rounds = 0;
    for (const item of WITH_SIBLINGS) {
      if (!SURFACE.items.some((i) => i.id === item.id)) continue;
      const banned = siblingReplies(item);
      for (const format of FORMATS)
        for (const seed of SEEDS) {
          const input: RoundInput = { index: SURFACE, gloss: (_k, en) => en, seed };
          const round = roundFor(question(item, format), input) as PickRound | null;
          if (round === null || round.type !== 'pick') continue;
          rounds += 1;
          for (const option of round.options) {
            if (option.id === item.id || option.ko === undefined) continue;
            expect(banned.has(normalizeAskedKo(option.ko.ko)), `${item.id} ${format} ${seed}: ${option.ko.ko}`).toBe(false);
          }
        }
    }
    expect(rounds).toBeGreaterThan(0);
  });

  it('a warm-up or Try these again pick round leaves them out too', () => {
    let rounds = 0;
    for (const item of WITH_SIBLINGS) {
      const banned = siblingReplies(item);
      for (const format of FORMATS)
        for (const seed of SEEDS) {
          const ctx: EngineContext = { index: INDEX, states: {}, today: '2026-11-10', voice: true, seed };
          const round = questPickRound(question(item, format), 0, 'warmup', ctx, () => undefined, seed);
          if (round === null) continue;
          rounds += 1;
          for (const option of round.options) {
            if (option.id === item.id || option.ko === undefined) continue;
            expect(banned.has(normalizeAskedKo(option.ko)), `${item.id} ${format} ${seed}: ${option.ko}`).toBe(false);
          }
        }
    }
    expect(rounds).toBeGreaterThan(0);
  });
});
