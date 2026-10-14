/**
 * Type Hangul scoring (F-CURR-001 §3.7 item 2; design/wireframes/minigame/type-hangul.md):
 * a typed answer is checked against its target only after Done, syllable block by block.
 * Spaces never decide (trimmed, runs read as one, and left out of the block compare), so
 * a learner is checked on the letters, not on word spacing. Pure.
 */

export type BlockStatus = 'same' | 'different' | 'missing' | 'extra';

/** One column of the result grid: what was typed over what the word has. */
export interface BlockCompare {
  /** `null` where the word has a block the learner did not type (`missing`). */
  typed: string | null;
  /** `null` where the learner typed a block the word does not have (`extra`). */
  target: string | null;
  status: BlockStatus;
}

export type TypedVerdict = 'match' | 'near' | 'far';

export interface TypedScore {
  /** `match`: every block the same; `near`: one block different, missing or extra; `far`: more. */
  verdict: TypedVerdict;
  blocks: BlockCompare[];
  /** 1-based positions (in `blocks`) of the columns that are not `same`. */
  differing: number[];
}

/** Trimmed, with every run of spaces read as one. */
export function normalizeTyped(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

const blocksOf = (text: string): string[] => [...normalizeTyped(text)].filter((ch) => ch !== ' ');

/**
 * Lines the typed blocks up with the word's (fewest edits; on a tie the backtrace keeps
 * a block in its column before calling one missing or extra) and grades the answer.
 */
export function scoreTyped(typed: string, target: string): TypedScore {
  const a = blocksOf(typed);
  const b = blocksOf(target);
  // d[i][j]: edits between the first i typed blocks and the first j target blocks.
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i += 1) {
    const row = d[i] as number[];
    const prev = d[i - 1] as number[];
    for (let j = 1; j <= b.length; j += 1) {
      const sub = (prev[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1);
      row[j] = Math.min(sub, (prev[j] as number) + 1, (row[j - 1] as number) + 1);
    }
  }
  const at = (i: number, j: number): number => (d[i] as number[])[j] as number;
  const blocks: BlockCompare[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    const typedBlock = a[i - 1] as string;
    const targetBlock = b[j - 1] as string;
    if (i > 0 && j > 0 && at(i, j) === at(i - 1, j - 1) + (typedBlock === targetBlock ? 0 : 1)) {
      blocks.unshift({ typed: typedBlock, target: targetBlock, status: typedBlock === targetBlock ? 'same' : 'different' });
      i -= 1;
      j -= 1;
    } else if (j > 0 && at(i, j) === at(i, j - 1) + 1) {
      blocks.unshift({ typed: null, target: targetBlock, status: 'missing' });
      j -= 1;
    } else {
      blocks.unshift({ typed: typedBlock, target: null, status: 'extra' });
      i -= 1;
    }
  }
  const differing = blocks.flatMap((block, k) => (block.status === 'same' ? [] : [k + 1]));
  const verdict: TypedVerdict = differing.length === 0 ? 'match' : differing.length === 1 ? 'near' : 'far';
  return { verdict, blocks, differing };
}
