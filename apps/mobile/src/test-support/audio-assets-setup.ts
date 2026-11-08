import { createRequire } from 'node:module';

/**
 * Metro turns `require('.../clip.mp3')` in the generated clip map (content/__generated__/audio-assets.ts) into an asset
 * id. Under vitest the same `require` is Node's, which would parse the MP3's bytes as JavaScript and throw a
 * SyntaxError, so every suite that reaches the map would fail once a clip is committed (AMENDMENTS-AUDIO-CLIPS AC-7).
 * An MP3 required in a test is just a number, like the id Metro gives it.
 */
const nodeRequire = createRequire(import.meta.url);
const extensions = nodeRequire.extensions as Record<string, ((module: { exports: unknown }) => void) | undefined>;
extensions['.mp3'] ??= (module) => {
  module.exports = 1;
};
