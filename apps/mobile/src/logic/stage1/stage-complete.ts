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
      .map((j) => ({ id: j.id, char: j.char, romanization: j.romanization, kind: j.kind, lit: true as const })),
  );
}

/** A tile's screen-reader name: its sound value, a final named as a final, never the glyph alone. */
export function wallTileLabel(tile: Pick<WallTile, 'romanization' | 'kind'>, a11y: Messages['a11y']): string {
  return tile.kind === 'batchim' ? a11y.discoverFinal(tile.romanization) : a11y.discoverLetter(tile.romanization);
}

/** Every card that completing the stage unlocks (`unlockedBy: '<stage>-complete'`), in content order. */
export function stagePrizeCards(stage: StageKey, cards: readonly HeritageCard[] = heritageCardsAll): HeritageCard[] {
  return cards.filter((c) => c.unlockedBy === `${stage}-complete`);
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
