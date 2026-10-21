// Options of build-web-fixtures.mjs (F-STORY-002 PR 2.6a; the gating bundle is F-STORY-004 PR 4.8b).
//
//   node scripts/build-web-fixtures.mjs [outDir]                      the fixture bundle (default dist-e2e/)
//   node scripts/build-web-fixtures.mjs <outDir> --content-gating     the gating fixture bundle
//
// The gating bundle is the same fixture bundle exported with EXPO_PUBLIC_CONTENT_GATING_ENABLED=true,
// into a directory of its own (never dist/, never the fixture bundle's), and on a Metro cache of its
// own: babel-preset-expo inlines EXPO_PUBLIC_ values at transform time and Metro's transform cache key
// does not hold them, so with a shared cache one build would get the other build's switch (and a CI
// run could save a gating-on transform into the cache the release build restores).

const DEFAULT_OUT = 'dist-e2e';
const FLAG = '--content-gating';

function normalized(dir) {
  return dir.replace(/^\.\//, '').replace(/\/+$/, '');
}

/** The output directory and whether gating is on, from the script's arguments; throws on a bad call. */
export function fixtureBuildOptions(argv) {
  const dirs = [];
  let contentGating = false;
  for (const arg of argv) {
    if (arg === FLAG) contentGating = true;
    else if (arg.startsWith('-')) throw new Error(`build-web-fixtures: unknown option ${arg} (only ${FLAG})`);
    else dirs.push(arg);
  }
  if (dirs.length > 1) throw new Error('build-web-fixtures: give one output directory');
  const out = dirs[0] ?? DEFAULT_OUT;
  if (normalized(out) === 'dist') {
    throw new Error('build-web-fixtures: refusing to write the fixture build into dist/ (build:web, serve:web and wrangler use it).');
  }
  if (contentGating && normalized(out) === DEFAULT_OUT) {
    throw new Error(`build-web-fixtures: the gating bundle needs its own directory (not ${DEFAULT_OUT}/, the fixture bundle's)`);
  }
  return { out, contentGating };
}

/**
 * The environment of the `expo export` child. Both bundles carry HANGUL_ROUTE_GENERATE=off: the build
 * has already run scripts/generate.mjs and written the fixture stories, and metro.config.js would
 * otherwise regenerate stories.generated.ts without them (F-CURR-002 CM-6). The variable is read only
 * by metro.config.js, at config time, so no transform and no cache entry depends on it. For the gating
 * bundle, also gating on and TMPDIR pointed at `ownTmp`, an empty directory, so Metro's cache
 * (os.tmpdir()/metro-cache) is one of its own.
 */
export function exportEnv(base, options, ownTmp) {
  const env = { ...base, HANGUL_ROUTE_GENERATE: 'off' };
  if (!options.contentGating) return env;
  return { ...env, TMPDIR: ownTmp, EXPO_PUBLIC_CONTENT_GATING_ENABLED: 'true' };
}
