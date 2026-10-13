import type { HeritageCard, Jamo, JamoKind, StageKey } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { heritageCardsAll } from '../../content/heritage-cards';
import { jamoAll } from '../../content/jamo';

/**
 * The Stage 1 ceremony (F-QUEST-002 §3.8, wireframe results/stage1-complete),
 * as plain view-models so the screen only renders them: when Results offers
 * the prize, the wall of all 30 symbols (every one lit, fill-only, no count),
 * the legendary cards that completing the stage awards, and the buttons. No
 * Premium pill and no purchase anywhere here (D5).
 */

/** The one stage with a ceremony today. */
export const PRIZE_STAGE: StageKey = 'stage1';

/** Results offers "See your Stage 1 prize" only on the run that completed Stage 1 (`QuestResultOutcome.stageCompleted`). */
export function opensStagePrize(outcome: { stageCompleted: StageKey | null } | null): boolean {
  return outcome?.stageCompleted === PRIZE_STAGE;
}

export interface WallTile {
  id: string;
  char: string;
  /** The sound value (`g/k`, `silent/ng`, the final's `n`). */
  romanization: string;
  kind: JamoKind;
  /** The content sound hint (every one of the 30 has one), read after the sound value so `silent/ng` is never read alone. */
  soundHint?: string;
  /** Always true: the wall only fills (D3). */
  lit: true;
}

const KIND_ORDER: readonly JamoKind[] = ['consonant', 'vowel', 'batchim'];

/** The 30 symbols in a fixed order: consonants, vowels, then finals, each by its content order. */
export function symbolWall(jamo: readonly Jamo[] = jamoAll): WallTile[] {
  return KIND_ORDER.flatMap((kind) =>
    jamo
      .filter((j) => j.kind === kind)
      .sort((a, b) => a.order - b.order)
      .map((j) => ({
        id: j.id,
        char: j.char,
        romanization: j.romanization,
        kind: j.kind,
        ...(j.soundHint === undefined ? {} : { soundHint: j.soundHint }),
        lit: true as const,
      })),
  );
}

/**
 * A tile's screen-reader name, as Discover reads the symbol: a letter by its sound value and its
 * sound hint ("Korean letter silent/ng. silent at the start of a block; ..."), a final named as a
 * final, never the glyph alone (F-QUEST-002 §3.14).
 */
export function wallTileLabel(tile: Pick<WallTile, 'romanization' | 'kind' | 'soundHint'>, a11y: Messages['a11y']): string {
  if (tile.kind === 'batchim') return a11y.discoverFinal(tile.romanization);
  return tile.soundHint === undefined ? a11y.discoverLetter(tile.romanization) : a11y.discoverLetter(tile.romanization, tile.soundHint);
}

/** Every card that completing the stage unlocks (`unlockedBy: '<stage>-complete'`), in content order. */
export function stagePrizeCards(stage: StageKey, cards: readonly HeritageCard[] = heritageCardsAll): HeritageCard[] {
  return cards.filter((c) => c.unlockedBy === `${stage}-complete`);
}

/**
 * True when the learner owns every card that completing the stage awards. The ceremony (and its
 * Journey header entry) opens only then, so a learner whose stage reads Complete through the old
 * stage latch alone never sees "Legendary cards for you" over cards they do not hold.
 */
export function ownsStagePrize(
  owned: readonly { cardId: string }[],
  stage: StageKey,
  cards: readonly HeritageCard[] = heritageCardsAll,
): boolean {
  const prize = stagePrizeCards(stage, cards);
  if (prize.length === 0) return false;
  const have = new Set(owned.map((c) => c.cardId));
  return prize.every((c) => have.has(c.id));
}

export interface CeremonyAction {
  id: 'seeCards' | 'backHome';
  tone: 'primary' | 'ghost';
  size: 'hero' | 'md';
}

/**
 * One primary, See my cards, until PR Q-10b puts the Hangul Check first; Back home is a ghost.
 * Never a purchase and never Premium (D5).
 */
export function stageCompleteActions(): CeremonyAction[] {
  return [
    { id: 'seeCards', tone: 'primary', size: 'hero' },
    { id: 'backHome', tone: 'ghost', size: 'md' },
  ];
}
