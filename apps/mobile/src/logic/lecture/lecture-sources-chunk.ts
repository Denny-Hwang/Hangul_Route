/**
 * The lecture sources the two grown-up roots share (AMENDMENTS-START-BUNDLE-2026-11 row SB-4e): the presenter
 * (`PresenterApp`) and All lessons (`BrowseApp`) both read the deck builder's bundled content (`content.ts`) and its
 * story and vocabulary adapters. Two chunks that import a module statically leave it in the start bundle (Expo's
 * serializer hoists what two chunks share), so these three modules are a chunk of their own, reached only through the
 * literal `import()` of `screens/lecture-sources-entry.ts` and precached like every root.
 *
 * Never imported statically: the roots read these through `useLectureSources()` or `lectureSourcesDoor.now()`, and
 * `screens/app-roots.tsx` loads them with the root (inside its timeout), so they are in before either root draws.
 */
export { PAUSE_WORD, lectureBundle, soundCheckSpec } from './content';
export { lectureStories } from './sources/story';
export { lectureVocabTopics } from './sources/vocab';

/** The marker of this chunk's own web bundle: the post-build check fails a start bundle that carries it. */
export const ROOT_CHUNK = 'root-chunk:lecture-sources';
