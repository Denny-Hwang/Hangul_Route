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

/** One stage's prize: its ceremony, the check the ceremony offers, and the switch it hides behind (F-CURR-002 section 7.3). */
export interface StagePrize {
  /** `hangul`: the Stage 1 wall and legendary cards (F-QUEST-002 section 3.8); `stage`: the Stages 2-7 ceremony and its stage card. */
  ceremony: 'hangul' | 'stage';
  /** The route of the check the ceremony offers: the Hangul Check or the Stage Check (never required, OD-1). */
  check: 'StageReview' | 'StageCheck';
  /** The switch the ceremony hides behind (section 12.2): none for Stage 1, `stageChecks` for Stages 2-7. */
  flag: 'stageChecks' | null;
}

const UPPER: StagePrize = { ceremony: 'stage', check: 'StageCheck', flag: 'stageChecks' };

/**
 * The one prize table (F-CURR-002 section 7.3, row CM-22; it replaces `PRIZE_STAGE = 'stage1'`). Stage 1 keeps its
 * ceremony exactly as it was (it opens for a learner who holds every prize card, `ownsStagePrize`); Stages 2-7 get the
 * stage ceremony, a stage card slot (row CM-23's cards, optional) and the Stage Check.
 */
export const PRIZE_STAGES: Readonly<Record<StageKey, StagePrize>> = {
  stage1: { ceremony: 'hangul', check: 'StageReview', flag: null },
  stage2: UPPER,
  stage3: UPPER,
  stage4: UPPER,
  stage5: UPPER,
  stage6: UPPER,
  stage7: UPPER,
};

/** The stage whose prize is the Hangul ceremony (Stage 1): its Journey header and Results keep their own buttons. */
export const HANGUL_PRIZE_STAGE: StageKey = 'stage1';

/** Results offers "See your Stage 1 prize" only on the run that completed Stage 1 (`QuestResultOutcome.stageCompleted`). */
export function opensStagePrize(outcome: { stageCompleted: StageKey | null } | null): boolean {
  return outcome?.stageCompleted === HANGUL_PRIZE_STAGE;
}

/**
 * The stage whose prize Results offers as its one primary: the stage the run completed, when its prize is open now.
 * Stage 1 always (unchanged); a Stage 2-7 prize only while its switch is on (`upperOn`: `stageChecks` for the learner).
 */
export function prizeStageOf(outcome: { stageCompleted: StageKey | null } | null, upperOn: boolean): StageKey | null {
  const stage = outcome?.stageCompleted ?? null;
  return stage !== null && (PRIZE_STAGES[stage].flag === null || upperOn) ? stage : null;
}

/**
 * The width of each tile of the symbol wall: as many tiles of at least `minTile` (the touch target grown by the
 * text size, AMENDMENTS-DISPLAY-NAV section 4) as fit a row of `rowWidth` with `gap` between them, widened so the
 * row is filled edge to edge; every tile of the wall has the same width, the last row included. Before the row is
 * laid out (`rowWidth` 0) the tile is `minTile`.
 */
export function wallTileWidth(rowWidth: number, minTile: number, gap: number): number {
  if (!(rowWidth > 0) || !(minTile > 0)) return minTile;
  const columns = Math.max(1, Math.floor((rowWidth + gap) / (minTile + gap)));
  return Math.max(minTile, Math.floor((rowWidth - gap * (columns - 1)) / columns));
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
  id: 'hangulCheck' | 'seeCards' | 'backHome';
  tone: 'primary' | 'ghost';
  size: 'hero' | 'md';
}

/**
 * One primary, Take the Hangul Check (PR Q-10b; never required, "you can skip it"); See my cards
 * and Back home are ghost. Never a purchase and never Premium (D5).
 */
export function stageCompleteActions(): CeremonyAction[] {
  return [
    { id: 'hangulCheck', tone: 'primary', size: 'hero' },
    { id: 'seeCards', tone: 'ghost', size: 'md' },
    { id: 'backHome', tone: 'ghost', size: 'md' },
  ];
}
