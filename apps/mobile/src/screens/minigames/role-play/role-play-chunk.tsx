/**
 * Role Play's chunk (F-CURR-002 section 10, row CM-35): the game, reached only through the literal `import()` of
 * `./role-play-entry.tsx`, so the web build emits it as one precached bundle (`role-play-chunk-<md5>.js`) and the
 * start bundle carries none of it. Its branch reducer and views (`logic/role-play/reducer.ts`, `view.ts`) are its own;
 * the fallback (`logic/role-play/fallback.ts`) stays in the start bundle with the quest screen that decides it.
 */

/** The chunk's marker: the post-build check finds it in this chunk and never in the start bundle. */
export const ROLE_PLAY_CHUNK = 'screen-chunk:role-play';

export { RolePlayGame } from './RolePlayGame';
// The fixture build's host (`navigation/role-play-e2e.tsx`), kept out of the start bundle.
export { RolePlayE2eScreen } from './RolePlayE2eScreen';
