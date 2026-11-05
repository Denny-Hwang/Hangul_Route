import { setPracticePlacer } from '../../logic/route/practice-days';

/**
 * The practice-days chunk's one literal `import()` (AMENDMENTS-ROUTE-CLASS-BLEND section 9.4, row BL-8): the My
 * practice days screen and the device placer (`placePractice` from the content-schema `blend` subpath), marker
 * `screen-chunk:practice-days`, so the start bundle carries neither. Loading it hands the placer to the derivation
 * (`setPracticePlacer`). Loaded once (and again after a failed load).
 */

type Chunk = typeof import('./practice-days-chunk');
let loading: Promise<Chunk> | null = null;
let loaded: Chunk | null = null;

export function loadPracticeDaysChunk(): Promise<Chunk> {
  loading ??= import('./practice-days-chunk').then(
    (chunk) => {
      setPracticePlacer(chunk.placeSourceForLearner);
      loaded = chunk;
      return chunk;
    },
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

/** The chunk when it is in, else null (a screen draws its waiting frame meanwhile). */
export const practiceDaysChunkLoaded = (): Chunk | null => loaded;
