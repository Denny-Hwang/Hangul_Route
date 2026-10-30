import type { ClozePickRound, KoText, Realia } from '@hangul-route/content-schema';
import type { MinigameScope } from '../minigame-config';

/**
 * Test-only Cloze Pick rounds (F-CURR-002 row CM-30), played by the fixture build's `navigation/cloze-pick-e2e.tsx`
 * and the unit and render tests. Never shipped content: no lesson cell reads them (no content row is authored by
 * CM-30). Every romanization is the output of the repo converter, `packages/content-schema/src/romanization/rr.ts`
 * (`e2e-rounds.test.ts` checks it); the filled particle sentence links as the converter reads it (물을 mureul).
 */

const k = (ko: string, romanization: string, en: string): KoText => ({ ko, romanization, en });

export const CLOZE_FIXTURE_ROUNDS = {
  /** A word gap: the meaning gives the verb. */
  word: {
    id: 'e2e-cloze-word',
    sentence: k('책을 ___.', 'chaegeul ___.', 'I read a book.'),
    gapKind: 'word',
    tiles: [k('읽어요', 'ilgeoyo', 'read'), k('먹어요', 'meogeoyo', 'eat'), k('마셔요', 'masyeoyo', 'drink')],
    answerIndex: 0,
  },
  /** A particle gap: the word before it (물, a final consonant) takes 을. */
  particle: {
    id: 'e2e-cloze-particle',
    sentence: k('물___ 마셔요.', 'mul___ masyeoyo.', 'I drink water.'),
    gapKind: 'particle',
    tiles: [k('을', 'eul', 'object marker'), k('를', 'reul', 'object marker'), k('이', 'i', 'subject marker')],
    answerIndex: 0,
    filledRomanization: 'mureul masyeoyo.',
  },
  /** A value gap, read from the price card of `CLOZE_FIXTURE_REALIA`. */
  value: {
    id: 'e2e-cloze-value',
    sentence: k('___ 원이에요.', '___ wonieyo.', 'It is ___ won.'),
    gapKind: 'value',
    tiles: [k('삼천', 'samcheon', 'three thousand'), k('오천', 'ocheon', 'five thousand'), k('이천', 'icheon', 'two thousand')],
    answerIndex: 0,
  },
} as const satisfies Record<string, ClozePickRound>;

export type ClozeFixture = keyof typeof CLOZE_FIXTURE_ROUNDS;

/** The price card a value gap is read from: round practice amounts in won (OD-11), no shop, brand or product price. */
export const CLOZE_FIXTURE_REALIA: Realia = {
  ref: 'realia:e2e-cloze-prices',
  kind: 'price-card',
  entries: [{ id: 'apples', text: k('사과', 'sagwa', 'apples'), value: k('삼천 원', 'samcheon won', '3,000 won'), goods: 'apples' }],
  altEn: 'A market price card for apples',
};

/** A Cloze Pick scope of these rounds, in order; the card rides along when a value gap is among them. */
export function clozeFixtureScope(keys: readonly ClozeFixture[]): MinigameScope {
  const rounds: ClozePickRound[] = keys.map((key) => ({ ...CLOZE_FIXTURE_ROUNDS[key], tiles: [...CLOZE_FIXTURE_ROUNDS[key].tiles] }) as ClozePickRound);
  const realia = keys.includes('value') ? { realia: CLOZE_FIXTURE_REALIA } : {};
  return { kind: 'cloze-pick', rounds: rounds.length, clozePick: { rounds, ...realia } };
}
