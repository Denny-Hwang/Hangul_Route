// F-STORY-004 PR 4.8b: the options of build-web-fixtures.mjs. The gating fixture bundle is the
// fixture bundle exported with EXPO_PUBLIC_CONTENT_GATING_ENABLED=true into a directory of its own,
// on a Metro cache of its own: Metro's transform cache key does not hold the EXPO_PUBLIC_ values
// babel-preset-expo inlines, so a shared cache would hand one build the other build's switch.
import { describe, expect, it } from 'vitest';
import { exportEnv, fixtureBuildOptions } from '../fixture-build-options.mjs';

describe('fixtureBuildOptions', () => {
  it('defaults to the fixture bundle in dist-e2e with gating as the environment has it', () => {
    expect(fixtureBuildOptions([])).toEqual({ out: 'dist-e2e', contentGating: false });
    expect(fixtureBuildOptions(['dist-e2e'])).toEqual({ out: 'dist-e2e', contentGating: false });
  });

  it('--content-gating builds the gating bundle into its own directory', () => {
    expect(fixtureBuildOptions(['dist-e2e-gated', '--content-gating'])).toEqual({ out: 'dist-e2e-gated', contentGating: true });
    expect(fixtureBuildOptions(['--content-gating', 'dist-e2e-gated'])).toEqual({ out: 'dist-e2e-gated', contentGating: true });
  });

  it('never writes into dist/ (build:web, serve:web and wrangler use it)', () => {
    expect(() => fixtureBuildOptions(['dist'])).toThrow(/dist\//);
    expect(() => fixtureBuildOptions(['./dist', '--content-gating'])).toThrow(/dist\//);
  });

  it('never writes the gating bundle over the fixture bundle', () => {
    expect(() => fixtureBuildOptions(['--content-gating'])).toThrow(/own directory/);
    expect(() => fixtureBuildOptions(['dist-e2e', '--content-gating'])).toThrow(/own directory/);
  });

  it('refuses an unknown flag and a second directory', () => {
    expect(() => fixtureBuildOptions(['dist-e2e', '--gating'])).toThrow(/unknown option/);
    expect(() => fixtureBuildOptions(['a', 'b'])).toThrow(/one output directory/);
  });
});

describe('exportEnv', () => {
  const base = { PATH: '/bin', TMPDIR: '/tmp/x', EXPO_PUBLIC_CONTENT_GATING_ENABLED: 'true' };

  it('the fixture bundle keeps the environment and tells Metro not to regenerate (F-CURR-002 CM-6)', () => {
    // metro.config.js runs scripts/generate.mjs before it bundles; on this export that would put the
    // release stories back over the fixture bundle the script just wrote.
    expect(exportEnv(base, { out: 'dist-e2e', contentGating: false }, '/tmp/own')).toEqual({ ...base, HANGUL_ROUTE_GENERATE: 'off' });
  });

  it('the gating bundle turns gating on and builds on a Metro cache of its own', () => {
    const env = exportEnv({ PATH: '/bin', TMPDIR: '/tmp/x' }, { out: 'dist-e2e-gated', contentGating: true }, '/tmp/own');
    expect(env).toEqual({ PATH: '/bin', TMPDIR: '/tmp/own', EXPO_PUBLIC_CONTENT_GATING_ENABLED: 'true', HANGUL_ROUTE_GENERATE: 'off' });
  });
});
