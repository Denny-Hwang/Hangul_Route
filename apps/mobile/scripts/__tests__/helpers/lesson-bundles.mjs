// Test support (F-CURR-002 §10): the lesson chunks (row CM-5) and the story chunks (row CM-8) of a stand-in
// export, as Metro emits them. The start bundle names every hash of the repository's lesson and story
// manifests and each chunk is its own `<name>-<md5>.js` bundle carrying its hash, so pwa-postbuild.mjs's
// chunk check passes. `skip` leaves one chunk out.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { md5 } from '../../pwa/lesson-chunks.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const lessons = await import(join(repo, 'scripts', 'build-lessons.mjs'));
const stories = await import(join(repo, 'scripts', 'build-stories.mjs'));

/** The repository's lesson manifest (chunk names and hashes). */
export const LESSON_MANIFEST = lessons.chunkManifest(lessons.readCells(repo));

/** The repository's story manifest (chunk names and hashes, row CM-8). */
export const STORY_MANIFEST = stories.readChunkManifest(repo);

/** The stand-in start bundle and lesson and story chunk bundles, by export path. */
export function lessonBundles(skip) {
  const all = [...LESSON_MANIFEST, ...STORY_MANIFEST];
  const files = { '_expo/static/js/web/index-abc.js': `console.info("learner bundle", ${JSON.stringify(all.map((m) => m.hash))});` };
  for (const { name, hash } of all) {
    if (name === skip) continue;
    const text = `__d(function(g,r,i,a,m,e,d){e.CHUNK_HASH="${hash}"});`;
    files[`_expo/static/js/web/${name}-${md5(text)}.js`] = text;
  }
  return files;
}
