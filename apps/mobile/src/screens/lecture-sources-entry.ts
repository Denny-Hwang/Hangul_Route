import { chunkDoor } from './chunk-door';

/*
 * The start bundle's door to the lecture sources (AMENDMENTS-START-BUNDLE-2026-11 row SB-4e): the presenter and All
 * lessons read the deck builder's content, stories and vocabulary through the chunk
 * `../logic/lecture/lecture-sources-chunk.ts` (marker `root-chunk:lecture-sources`, in `ROOT_CHUNKS`), reached only
 * through the literal `import()` below. `screens/app-roots.tsx` loads it together with each root, inside the root's
 * timeout, so a root draws only once it is in. Read it at call time (a hook, an effect or an event handler), never at a
 * module's top level: the chunk is not in when a root's module first runs.
 */

type Chunk = typeof import('../logic/lecture/lecture-sources-chunk');
export const lectureSourcesDoor = chunkDoor<Chunk>(() => import('../logic/lecture/lecture-sources-chunk'));

/** The web bundle name of the chunk (a root's timeout gives its pending script up by it). */
export const LECTURE_SOURCES_BUNDLE = 'lecture-sources-chunk';

/** Raised when a root reads the sources before its loader has put them in: a wiring error, never a state to draw. */
export class LectureSourcesMissing extends Error {
  constructor() {
    super('the lecture sources are not loaded: a grown-up root mounts only after its loader has loaded them');
    this.name = 'LectureSourcesMissing';
  }
}

/** The lecture sources now, for code that is not a component (the roots' loader has put them in before the root draws). */
export function lectureSourcesNow(): Chunk {
  const sources = lectureSourcesDoor.now();
  if (sources === null) throw new LectureSourcesMissing();
  return sources;
}

/** The lecture sources, for a component of a grown-up root (the loader has put them in before the root draws). */
export function useLectureSources(): Chunk {
  return lectureSourcesNow();
}
