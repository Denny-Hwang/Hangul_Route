import type { CatalogCell, CatalogQuest, CellLevel, MemoryItemState, ProgressSnapshot, VocabItemState } from '@hangul-route/content-schema';
import { cellOfVolume, masteryDenominator, type ReviewItem } from '@hangul-route/content-schema/review-items';
import { latchQuests } from '../quest-progress';
import { isDue } from '../vocab/srs';
import { vocabOf } from '../vocab/progress';
import { isItemDue } from './spacing';

/**
 * Mastery levels (F-CURR-002 sections 4.4 and 12.2, row CM-20). Pure; part of the memory chunk, so the start bundle
 * carries none of it.
 *
 * | Level | Name      | Rule |
 * |-------|-----------|------|
 * | 0     | none      | not started |
 * | 1     | Done      | every quest of the cell's first volume done, or a test-out (`testedOut`) |
 * | 2     | Practiced | Done, plus 80% or more of the denominator held at best box 3 or higher |
 * | 3     | Mastered  | Practiced, plus a passed Cell Check (`cellCheckAt`), plus 60% or more held at best box 4 or higher |
 *
 * - **Only monotonic fields.** An item is held at box k when its best box `s` is at least k and it has a real answer
 *   (`n` >= 1) of which one was right (`r` >= 1); a topic word when its `bestBox` is at least k and it has a recorded answer (`seen` >= 1). The latches
 *   (`questDoneAt`, `testedOut`, `cellCheckAt`) only gain keys. The current box `b`, the next rung `c` and the due day
 *   `d` are never read for a level, so a falling box never lowers one. A seeded box alone never holds an item, as it
 *   never counts a word known (row CM-16).
 * - **The denominator** is `masteryDenominator` (row CM-10): the items the cell's started volumes teach, minus the
 *   retired ones. A volume is started when one of its quests is done or it was tested out (`testedOut` of its volume
 *   cell, `cellOfVolume`). A volume not started never holds a level back; a started cell whose later volume has
 *   shipped (it has quests in the catalogue) and is not started shows the "New volume" marker instead.
 * - **Topic words** (`vocab:` ids) are read from the word slice (`bestBox`, `seen`). They stay in the denominator as the
 *   table says, collected or not: a word not collected yet is simply not held, so a cell made mostly of topic words
 *   (Stage 2 Nature: 12 of 14) reaches Practiced when its words are practised, never on its two lesson items alone. A
 *   latched level cannot be taken back, so the denominator is never narrowed below what the cell teaches.
 * - **Levels are cumulative**: Practiced needs Done, Mastered needs Practiced, so an item learned in another cell never
 *   lifts a cell nobody finished. An empty denominator never reaches Practiced.
 * - **The latch** (`latchCellBest`): the shown level is `cellBest`, which merges by max; a derived level only raises it.
 */

/** Three segments, one for each level above none (wireframe `journey/mastery-ring.md` Constants). */
export const MASTERY_SEGMENTS = 3;
/** Practiced: this share of the denominator at best box 3 or higher (section 4.4). */
export const PRACTICED_SHARE = 80;
export const PRACTICED_BOX = 3;
/** Mastered: this share at best box 4 or higher (section 4.4). */
export const MASTERED_SHARE = 60;
export const MASTERED_BOX = 4;
/** The Words known milestones that bring Hoya's celebration (section 4.4). */
export const WORDS_MILESTONES = [100, 250, 500, 1000, 2000] as const;

const VOCAB = 'vocab:';
const VOLUME_CELL = /^(.+)-v([1-9]\d*)$/;

type HeldState = Pick<MemoryItemState, 's' | 'n' | 'r'>;

export interface MasteryInput {
  /** The grid cells and pack levels: their own id and the quests of their first volume (`CATALOG.cells`). */
  cells: readonly Pick<CatalogCell, 'episodeId' | 'questIds'>[];
  /** Every catalogue quest, so a later volume's quests (episode `<cell>-v<k>`) are found. */
  quests: readonly Pick<CatalogQuest, 'id' | 'episodeId'>[];
  /** The review items of this build, with the retired ids. */
  items: readonly Pick<ReviewItem, 'id' | 'cells'>[];
  retired: ReadonlySet<string>;
  /** The memory store's rows (lesson, story and pack items). */
  rows: Readonly<Record<string, { st: HeldState & Partial<Pick<MemoryItemState, 'b' | 'd'>> }>>;
  snapshot: Pick<ProgressSnapshot, 'quests' | 'questDoneAt' | 'testedOut' | 'cellCheckAt' | 'vocab'>;
}

export interface CellMastery {
  level: CellLevel;
  /** The volumes started (1-based), in order. */
  started: number[];
  /** A later volume has shipped and is not started. */
  newVolume: boolean;
  /** The denominator's item ids. */
  denominator: string[];
}

/**
 * Whether a state is held at box `box`: its best box reached it, with a real answer (`n` >= 1) of which one was right
 * (`r` >= 1). The Words known rule of row CM-16: a seeded box followed only by wrong answers holds nothing.
 */
export function heldAt(state: HeldState | undefined, box: number): boolean {
  return state !== undefined && state.s >= box && state.n >= 1 && state.r >= 1;
}

/** Whether a topic word is held at box `box` (the `vocab` slice: best box and a recorded answer). */
export function wordHeldAt(word: Pick<VocabItemState, 'bestBox' | 'seen'> | undefined, box: number): boolean {
  return word !== undefined && word.bestBox >= box && word.seen >= 1;
}

/** `part / whole` reaches `share` percent, in whole numbers (no float edge at exactly 80%). */
const reaches = (part: number, whole: number, share: number): boolean => whole > 0 && part * 100 >= share * whole;

/** The volumes of each cell: 1 (the cell itself), plus every k >= 2 a quest or an item names as `<cell>-v<k>`. */
function volumesByCell(input: Pick<MasteryInput, 'cells' | 'quests' | 'items'>): Map<string, { shipped: Set<number>; quests: Map<number, string[]> }> {
  const out = new Map<string, { shipped: Set<number>; quests: Map<number, string[]> }>();
  for (const cell of input.cells) out.set(cell.episodeId, { shipped: new Set([1]), quests: new Map([[1, [...cell.questIds]]]) });
  for (const q of input.quests) {
    const m = VOLUME_CELL.exec(q.episodeId);
    const held = m ? out.get(m[1] as string) : undefined;
    if (!m || !held) continue;
    const k = Number(m[2]);
    if (k < 2) continue;
    held.shipped.add(k);
    held.quests.set(k, [...(held.quests.get(k) ?? []), q.id]);
  }
  return out;
}

/** Every cell's level, volumes and denominator (only cells with something to say: level 0 cells are left out). */
export function deriveMastery(input: MasteryInput): Map<string, CellMastery> {
  const done = new Set(Object.keys(latchQuests(input.snapshot as ProgressSnapshot).questDoneAt ?? {}));
  const testedOut = input.snapshot.testedOut ?? {};
  const cellCheckAt = input.snapshot.cellCheckAt ?? {};
  const words = new Map(vocabOf(input.snapshot).items.map((w) => [w.id, w]));
  const held = (id: string, box: number): boolean => (id.startsWith(VOCAB) ? wordHeldAt(words.get(id), box) : heldAt(input.rows[id]?.st, box));

  const out = new Map<string, CellMastery>();
  for (const [cell, volumes] of volumesByCell(input)) {
    const started: number[] = [];
    for (const k of [...volumes.shipped].sort((a, b) => a - b)) {
      const quests = volumes.quests.get(k) ?? [];
      if (quests.some((id) => done.has(id)) || testedOut[cellOfVolume(cell, k)] !== undefined) started.push(k);
    }
    if (started.length === 0) continue;
    const firstQuests = volumes.quests.get(1) ?? [];
    const isDone = (firstQuests.length > 0 && firstQuests.every((id) => done.has(id))) || testedOut[cell] !== undefined;
    // Every item the started volumes teach, topic words included whether collected or not (section 4.4 as written).
    const denominator = masteryDenominator(input.items, cell, started, input.retired);
    const at3 = denominator.filter((id) => held(id, PRACTICED_BOX)).length;
    const at4 = denominator.filter((id) => held(id, MASTERED_BOX)).length;
    const practiced = isDone && reaches(at3, denominator.length, PRACTICED_SHARE);
    const mastered = practiced && cellCheckAt[cell] !== undefined && reaches(at4, denominator.length, MASTERED_SHARE);
    const level: CellLevel = mastered ? 3 : practiced ? 2 : isDone ? 1 : 0;
    const newVolume = [...volumes.shipped].some((k) => k >= 2 && !started.includes(k));
    out.set(cell, { level, started, newVolume, denominator });
  }
  return out;
}

export interface LevelRise {
  cellId: string;
  level: Exclude<CellLevel, 0>;
}

/**
 * The latch (section 4.4): `cellBest` raised to every derived level above it, never lowered. Returns the same object
 * when nothing rises, and the rises in cell id order (one per cell, at its new level).
 */
export function latchCellBest(
  held: Readonly<Record<string, CellLevel>> | undefined,
  derived: ReadonlyMap<string, Pick<CellMastery, 'level'>>,
): { cellBest: Readonly<Record<string, CellLevel>>; rises: LevelRise[] } {
  const base = held ?? {};
  const rises: LevelRise[] = [];
  for (const [cellId, { level }] of derived) if (level > (base[cellId] ?? 0)) rises.push({ cellId, level: level as LevelRise['level'] });
  if (rises.length === 0) return { cellBest: base, rises };
  rises.sort((a, b) => (a.cellId < b.cellId ? -1 : a.cellId > b.cellId ? 1 : 0));
  const cellBest: Record<string, CellLevel> = { ...base };
  for (const r of rises) cellBest[r.cellId] = r.level;
  return { cellBest, rises };
}

/**
 * The cells whose ring glows "Ready to refresh" (section 4.4): mastered (latched level 3) with a denominator item due
 * today. One pass over the cells, so a map reads `has(cellId)` synchronously (wireframe Data needs).
 */
export function selectDueCellIds(
  cellBest: Readonly<Record<string, CellLevel>> | undefined,
  derived: ReadonlyMap<string, Pick<CellMastery, 'denominator'>>,
  rows: MasteryInput['rows'],
  words: readonly Pick<VocabItemState, 'id' | 'due'>[],
  today: string,
): Set<string> {
  const dueWord = new Map(words.map((w) => [w.id, w]));
  const due = (id: string): boolean => {
    if (id.startsWith(VOCAB)) {
      const w = dueWord.get(id);
      return w !== undefined && isDue(w, today);
    }
    const st = rows[id]?.st;
    return st !== undefined && st.b !== undefined && st.d !== undefined && isItemDue({ b: st.b, d: st.d }, today);
  };
  const out = new Set<string>();
  for (const [cellId, level] of Object.entries(cellBest ?? {})) {
    if (level !== 3) continue;
    if (derived.get(cellId)?.denominator.some(due)) out.add(cellId);
  }
  return out;
}

/** The highest milestone a Words known count crossed from `before` to `after` (`before` < m <= `after`), or null. */
export function wordsMilestoneCrossed(before: number, after: number): number | null {
  let hit: number | null = null;
  for (const m of WORDS_MILESTONES) if (before < m && m <= after) hit = m;
  return hit;
}
