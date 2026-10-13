// F-APP-001 A-3 (sections 3.1, 3.3 and 3.17, section 5): one host, two bundles, one Worker.
// `build:web` = audio map, `expo export`, `scripts/app-host/merge-console.mjs dist`, `pwa-postbuild.mjs dist`.
// The merge builds the console role of apps/web (unless SKIP_CONSOLE=1), copies `out-console/` into the
// learner dist under the reserved grown-up prefixes and `_next/`, refuses anything else, and appends the
// grown-up `_headers` block. Checked here on stand-in exports; the real merged build is
// e2e/web/app-host.spec.ts.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GROWN_UP_PREFIXES, isGrownUpPath } from '@hangul-route/content-schema';
import {
  GROWN_UP_HEADERS,
  GROWN_UP_HEADERS_MARKER,
  grownUpHeadersBlock,
  headersFor,
  longCacheConsoleRules,
  parseHeaders,
  patternMatches,
} from '../app-host/headers.mjs';
import {
  CONSOLE_BUILD_ARGS,
  consoleBuildEnv,
  listFiles,
  mergeConsole,
  planMerge,
  pnpmInvocation,
  runMerge,
  skipConsole,
} from '../app-host/merge-console.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..', '..');
const MERGE = join(app, 'scripts', 'app-host', 'merge-console.mjs');
const POSTBUILD = join(app, 'scripts', 'pwa-postbuild.mjs');
const LEARNER_HEADERS = readFileSync(join(app, 'public', '_headers'), 'utf8');

/** The six headers of section 3.17, in its order (X-Robots-Tag: 2026-10-12, A-3 review). */
const SECTION_3_17 = [
  ['Cache-Control', 'no-store'],
  ['X-Frame-Options', 'DENY'],
  ['Content-Security-Policy', "frame-ancestors 'none'"],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['X-Robots-Tag', 'noindex, nofollow'],
];

const LEARNER_DIST = {
  'index.html': '<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><div id="root"></div></body></html>',
  '_expo/static/js/web/index-abc.js': 'console.info("learner bundle");',
  'manifest.webmanifest': '{"name":"Hangul Route","id":"/","start_url":"/","scope":"/"}',
  'favicon.ico': 'icon',
  // F-TCH-004 PR 3: the presenter font expo copies from public/fonts/ (the post-build requires it in the precache).
  'fonts/hr-presenter-kr.woff2': 'wOF2 stand-in',
  '_headers': LEARNER_HEADERS,
};

const CONSOLE_OUT = {
  'teach.html': '<!doctype html><script src="/_next/static/chunks/main-1.js"></script>',
  'teach.txt': 'rsc',
  'teach/home.html': '<!doctype html><script src="/_next/static/chunks/main-1.js"></script>',
  'teach/home.txt': 'rsc',
  'teach/space/settings.html': '<!doctype html>',
  'parent.html': '<!doctype html>',
  'parent/mina.txt': 'rsc',
  'signin.html': '<!doctype html>',
  'start.html': '<!doctype html>',
  'account/billing.html': '<!doctype html>',
  '_next/static/chunks/main-1.js': 'self.console=1;',
  '_next/static/css/app-1.css': 'body{}',
};

let root;
let dist;
let consoleOut;

function put(dir, files) {
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
}

/** Every file of a folder with its content, for "nothing was written" checks. */
function snapshot(dir) {
  return Object.fromEntries(listFiles(dir).map((rel) => [rel, readFileSync(join(dir, rel), 'utf8')]));
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'hr-merge-console-'));
  dist = join(root, 'dist');
  consoleOut = join(root, 'out-console');
  put(dist, LEARNER_DIST);
  put(consoleOut, CONSOLE_OUT);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('the grown-up _headers block (section 3.17)', () => {
  const block = grownUpHeadersBlock(GROWN_UP_PREFIXES);
  const rules = parseHeaders(block);

  it('starts with its marker and has the two patterns of section 3.17 per prefix, plus its dotted names (R-1), in prefix order', () => {
    expect(block.startsWith(`${GROWN_UP_HEADERS_MARKER}\n`)).toBe(true);
    expect(rules.map((r) => r.pattern)).toEqual(GROWN_UP_PREFIXES.flatMap((p) => [p, `${p}/*`, `${p}.*`]));
  });

  it('gives every pattern every header of section 3.17', () => {
    expect(GROWN_UP_HEADERS).toEqual(SECTION_3_17);
    for (const rule of rules) expect(rule.headers, rule.pattern).toEqual(SECTION_3_17);
  });

  it('reaches every grown-up page, deep pages and payloads included', () => {
    for (const prefix of GROWN_UP_PREFIXES) {
      // `/teach.txt` is the RSC payload of the page `/teach`; R-1 counts it as a grown-up path too.
      for (const path of [prefix, `${prefix}/`, `${prefix}/home`, `${prefix}/space/settings`, `${prefix}/home.txt`, `${prefix}.txt`, `${prefix}.html`]) {
        expect(isGrownUpPath(path), path).toBe(true);
        const got = headersFor(rules, path);
        expect(got, path).toEqual(Object.fromEntries(SECTION_3_17.map(([k, v]) => [k.toLowerCase(), v])));
      }
    }
  });

  it('reaches no learner path and no near miss', () => {
    for (const path of ['/', '/index.html', '/sw.js', '/teacher', '/teachers.txt', '/parents', '/parent-x.txt', '/signing', '/starts', '/accounts', '/present', '/browse', '/_next/static/chunks/a.js', '/grown-ups-offline.html']) {
      expect(isGrownUpPath(path), path).toBe(false);
      expect(headersFor(rules, path), path).toEqual({});
    }
  });

  it('refuses a prefix that is not one plain lower-case segment', () => {
    for (const bad of [[], ['teach'], ['/Teach'], ['/teach/*'], ['/te ach'], ['/a/b']]) {
      expect(() => grownUpHeadersBlock(bad), JSON.stringify(bad)).toThrow(/prefix/);
    }
  });
});

describe('parseHeaders, patternMatches and headersFor (the Workers assets _headers rules)', () => {
  it('reads patterns, indented headers, comments and blank lines', () => {
    expect(parseHeaders('# c\n\n/a\n  X-One: 1\n  X-Two: two: parts\n# c2\n/b/*\n  Cache-Control: no-cache\n')).toEqual([
      { pattern: '/a', headers: [['X-One', '1'], ['X-Two', 'two: parts']] },
      { pattern: '/b/*', headers: [['Cache-Control', 'no-cache']] },
    ]);
  });

  it('reads a detach line ("! Name"), which removes a header an earlier rule set', () => {
    const rules = parseHeaders('/*\n  X-Robots-Tag: noindex\n  X-A: 1\n/teach/*\n  ! X-Robots-Tag\n  X-A: 2\n');
    expect(rules[1]).toEqual({ pattern: '/teach/*', headers: [['X-Robots-Tag', null], ['X-A', '2']] });
    expect(headersFor(rules, '/teach/home')).toEqual({ 'x-a': '1, 2' });
    expect(headersFor(rules, '/')).toEqual({ 'x-robots-tag': 'noindex', 'x-a': '1' });
    expect(() => parseHeaders('/a\n  ! \n')).toThrow(/line 2/);
  });

  it('refuses a header before any pattern and a header line without a name', () => {
    expect(() => parseHeaders('  X-One: 1\n')).toThrow(/before any pattern/);
    expect(() => parseHeaders('/a\n  no colon here\n')).toThrow(/line 2/);
  });

  it('matches a splat across segments, a placeholder within one, and dots literally', () => {
    expect(patternMatches('/teach/*', '/teach/space/settings')).toBe(true);
    expect(patternMatches('/teach/*', '/teach')).toBe(false);
    expect(patternMatches('/teach', '/teach/')).toBe(false);
    expect(patternMatches('/u/:id/x', '/u/42/x')).toBe(true);
    expect(patternMatches('/u/:id/x', '/u/4/2/x')).toBe(false);
    expect(patternMatches('/sw.js', '/swxjs')).toBe(false);
    expect(patternMatches('/sw.js', '/sw.js')).toBe(true);
  });

  it('joins a header that several rules set, in file order, with case-insensitive names', () => {
    const rules = parseHeaders('/*\n  X-A: 1\n/teach/*\n  x-a: 2\n  X-B: b\n');
    expect(headersFor(rules, '/teach/home')).toEqual({ 'x-a': '1, 2', 'x-b': 'b' });
    expect(headersFor(rules, '/')).toEqual({ 'x-a': '1' });
  });

  it('finds a rule that would let a browser keep a missing /_next/ file (section 3.3)', () => {
    expect(longCacheConsoleRules(parseHeaders('/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n'))).toEqual(['/_next/static/*']);
    expect(longCacheConsoleRules(parseHeaders('/*\n  Cache-Control: max-age=31536000, IMMUTABLE\n'))).toEqual(['/*']);
    // any /_next/ subtree, and a long max-age without `immutable`
    for (const pattern of ['/_next/static/css/*', '/_next/static/media/*', '/_next/static/chunks/app/*', '/:folder/static/*']) {
      expect(longCacheConsoleRules(parseHeaders(`${pattern}\n  Cache-Control: public, max-age=31536000, immutable\n`)), pattern).toEqual([pattern]);
    }
    expect(longCacheConsoleRules(parseHeaders('/_next/*\n  Cache-Control: public, max-age=86400\n'))).toEqual(['/_next/*']);
    expect(longCacheConsoleRules(parseHeaders('/_next/*\n  Cache-Control: s-maxage=600\n'))).toEqual(['/_next/*']);
    expect(longCacheConsoleRules(parseHeaders('/_next/*\n  Expires: Thu, 01 Dec 2099 16:00:00 GMT\n'))).toEqual(['/_next/*']);
    // host-qualified patterns (Workers accept absolute URLs) are read by their path
    for (const pattern of ['https://app.hangulroute.com/_next/static/*', 'https://:sub.hangulroute.com/*']) {
      expect(longCacheConsoleRules(parseHeaders(`${pattern}\n  Cache-Control: public, max-age=31536000, immutable\n`)), pattern).toEqual([pattern]);
    }
    expect(longCacheConsoleRules(parseHeaders('https://app.hangulroute.com/assets/*\n  Cache-Control: immutable\n'))).toEqual([]);
    // revalidating rules, and long rules elsewhere, are fine
    expect(
      longCacheConsoleRules(parseHeaders('/_next/*\n  Cache-Control: no-cache\n/_next/static/*\n  Cache-Control: public, max-age=0, must-revalidate\n/assets/*\n  Cache-Control: immutable\n/sw.js\n  Cache-Control: max-age=600\n')),
    ).toEqual([]);
  });
});

describe('apps/mobile/public/_headers', () => {
  const rules = parseHeaders(LEARNER_HEADERS);

  it('has no year-long rule under /_next/: the single-page fallback answers a missing chunk with index.html (section 3.3)', () => {
    expect(longCacheConsoleRules(rules)).toEqual([]);
  });

  it('keeps the learner rules', () => {
    expect(headersFor(rules, '/sw.js')['cache-control']).toBe('no-cache');
    expect(headersFor(rules, '/index.html')['cache-control']).toBe('no-cache');
    expect(headersFor(rules, '/manifest.webmanifest')['content-type']).toBe('application/manifest+json');
  });

  it('is not the grown-up block (only the merge appends it)', () => {
    expect(LEARNER_HEADERS).not.toContain(GROWN_UP_HEADERS_MARKER);
  });
});

describe('skipConsole', () => {
  it('is on only for SKIP_CONSOLE=1', () => {
    expect(skipConsole({ SKIP_CONSOLE: '1' })).toBe(true);
    for (const value of [undefined, '', '0', 'false', 'yes']) expect(skipConsole({ SKIP_CONSOLE: value }), String(value)).toBe(false);
    expect(skipConsole({})).toBe(false);
  });
});

describe('consoleBuildEnv (API base pass-through, section 3.3)', () => {
  it('passes the learner build API base to the console when the console has none', () => {
    expect(consoleBuildEnv({ EXPO_PUBLIC_API_BASE_URL: 'https://api.example' }).NEXT_PUBLIC_API_BASE_URL).toBe('https://api.example');
    expect(consoleBuildEnv({ EXPO_PUBLIC_API_BASE_URL: 'https://api.example', NEXT_PUBLIC_API_BASE_URL: '  ' }).NEXT_PUBLIC_API_BASE_URL).toBe('https://api.example');
  });

  it('keeps a console API base that is set', () => {
    expect(consoleBuildEnv({ EXPO_PUBLIC_API_BASE_URL: 'https://a.example', NEXT_PUBLIC_API_BASE_URL: 'https://b.example' }).NEXT_PUBLIC_API_BASE_URL).toBe('https://b.example');
  });

  it('adds nothing when neither is set, and leaves the app URL to the console default', () => {
    const env = consoleBuildEnv({ PATH: '/bin', EXPO_PUBLIC_API_BASE_URL: ' ' });
    expect('NEXT_PUBLIC_API_BASE_URL' in env).toBe(false);
    expect('NEXT_PUBLIC_APP_URL' in env).toBe(false);
    expect(env.PATH).toBe('/bin');
  });

  it('keeps every other variable (the Clerk key of owner step S-1, console flags) and never changes its input', () => {
    const input = { EXPO_PUBLIC_API_BASE_URL: 'https://api.example', NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_x', NEXT_PUBLIC_LECTURE_MODE: 'enabled' };
    const env = consoleBuildEnv(input);
    expect(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toBe('pk_live_x');
    expect(env.NEXT_PUBLIC_LECTURE_MODE).toBe('enabled');
    expect('NEXT_PUBLIC_API_BASE_URL' in input).toBe(false);
  });

  it('always builds the app-host console without the dev sign-in form, whatever the build variables say', () => {
    for (const value of ['true', 'TRUE', '1', 'false', undefined]) {
      const input = { NEXT_PUBLIC_CONSOLE_DEV_AUTH: value };
      expect(consoleBuildEnv(input).NEXT_PUBLIC_CONSOLE_DEV_AUTH).toBe('false');
      expect(input.NEXT_PUBLIC_CONSOLE_DEV_AUTH).toBe(value);
    }
  });
});

describe('pnpmInvocation', () => {
  it('reuses the pnpm that runs build:web (a script file runs under this node)', () => {
    expect(pnpmInvocation({ npm_execpath: '/x/pnpm/10.33.0/bin/pnpm.cjs' }, '/usr/bin/node')).toEqual({ command: '/usr/bin/node', args: ['/x/pnpm/10.33.0/bin/pnpm.cjs'] });
    expect(pnpmInvocation({ npm_execpath: '/x/corepack/dist/pnpm.js' }, '/usr/bin/node')).toEqual({ command: '/usr/bin/node', args: ['/x/corepack/dist/pnpm.js'] });
    expect(pnpmInvocation({ npm_execpath: '/x/@pnpm/exe/pnpm' }, '/usr/bin/node')).toEqual({ command: '/x/@pnpm/exe/pnpm', args: [] });
  });

  it('falls back to pnpm on the PATH under another runner or none', () => {
    expect(pnpmInvocation({ npm_execpath: '/x/npm/bin/npm-cli.js' }, '/usr/bin/node')).toEqual({ command: 'pnpm', args: [] });
    expect(pnpmInvocation({}, '/usr/bin/node')).toEqual({ command: 'pnpm', args: [] });
  });

  it('builds the console role of apps/web', () => {
    expect(CONSOLE_BUILD_ARGS).toEqual(['--filter', '@hangul-route/web', 'build:console']);
  });
});

describe('planMerge', () => {
  const free = () => false;

  it('takes grown-up paths and _next/ files, sorted', () => {
    expect(planMerge(['_next/a.js', 'teach.html', 'parent/mina.txt'], { isGrownUpPath, occupied: free })).toEqual(['_next/a.js', 'parent/mina.txt', 'teach.html']);
  });

  it('names every refused file at once', () => {
    expect(() => planMerge(['index.html', 'about.html', 'teachers.html', '_headers', 'teach.html'], { isGrownUpPath, occupied: free })).toThrow(
      /index\.html would replace the learner shell; about\.html is not a grown-up path or under _next\/; teachers\.html is not a grown-up path or under _next\/; _headers is not a grown-up path or under _next\//,
    );
  });

  it('refuses a target that already exists in dist (collision guard)', () => {
    expect(() => planMerge(['teach/home.html', 'teach.html'], { isGrownUpPath, occupied: (rel) => rel === 'teach/home.html' })).toThrow(/teach\/home\.html collides with a file already in dist/);
  });

  it('refuses an empty console and one without a grown-up page', () => {
    expect(() => planMerge([], { isGrownUpPath, occupied: free })).toThrow(/no grown-up page/);
    expect(() => planMerge(['_next/a.js', 'teach.txt'], { isGrownUpPath, occupied: free })).toThrow(/no grown-up page/);
  });
});

describe('mergeConsole', () => {
  const merge = () => mergeConsole({ dist, consoleOut, isGrownUpPath, prefixes: GROWN_UP_PREFIXES });

  it('copies the console into dist byte for byte and reports the files and pages', () => {
    const result = merge();
    expect(result.files).toEqual(Object.keys(CONSOLE_OUT).sort());
    expect(result.pages).toBe(7);
    for (const [rel, body] of Object.entries(CONSOLE_OUT)) expect(readFileSync(join(dist, rel), 'utf8'), rel).toBe(body);
  });

  it('leaves every learner file as it was, index.html included', () => {
    merge();
    for (const [rel, body] of Object.entries(LEARNER_DIST)) {
      if (rel !== '_headers') expect(readFileSync(join(dist, rel), 'utf8'), rel).toBe(body);
    }
    expect(listFiles(dist)).toEqual([...Object.keys(LEARNER_DIST), ...Object.keys(CONSOLE_OUT)].sort());
  });

  it('appends the grown-up block after the learner rules, which stay as they were', () => {
    merge();
    const headers = readFileSync(join(dist, '_headers'), 'utf8');
    expect(headers.startsWith(LEARNER_HEADERS)).toBe(true);
    expect(headers.slice(LEARNER_HEADERS.length)).toBe(`\n${grownUpHeadersBlock(GROWN_UP_PREFIXES)}`);
    const rules = parseHeaders(headers);
    expect(headersFor(rules, '/teach/home')['x-frame-options']).toBe('DENY');
    expect(headersFor(rules, '/sw.js')).toEqual({ 'cache-control': 'no-cache' });
  });

  it('writes the block alone when dist has no _headers', () => {
    rmSync(join(dist, '_headers'));
    merge();
    expect(readFileSync(join(dist, '_headers'), 'utf8')).toBe(grownUpHeadersBlock(GROWN_UP_PREFIXES));
  });

  it('adds the line break a learner _headers without a final newline needs', () => {
    writeFileSync(join(dist, '_headers'), '/sw.js\n  Cache-Control: no-cache');
    merge();
    expect(parseHeaders(readFileSync(join(dist, '_headers'), 'utf8')).map((r) => r.pattern).slice(0, 2)).toEqual(['/sw.js', '/signin']);
  });

  it('fails and writes nothing on a collision, a file where a folder must go, or a non-grown-up file', () => {
    const cases = [
      () => put(dist, { 'teach/home.html': 'learner?' }),
      () => put(dist, { teach: 'a file named teach' }),
      () => put(consoleOut, { 'about.html': 'site' }),
      () => put(consoleOut, { 'index.html': 'console shell' }),
      () => put(consoleOut, { '_headers': '/*\n  X-A: 1\n' }),
    ];
    for (const [i, arrange] of cases.entries()) {
      rmSync(root, { recursive: true, force: true });
      put(dist, LEARNER_DIST);
      put(consoleOut, CONSOLE_OUT);
      arrange();
      const before = snapshot(dist);
      expect(merge, `case ${i}`).toThrow(/^refused: /);
      expect(snapshot(dist), `case ${i}`).toEqual(before);
    }
  });

  it('refuses a dist that was already merged', () => {
    merge();
    rmSync(join(dist, 'teach'), { recursive: true, force: true });
    for (const rel of Object.keys(CONSOLE_OUT)) rmSync(join(dist, rel), { force: true });
    expect(merge).toThrow(/already holds the grown-up block/);
  });

  it('refuses a learner _headers with a year-long rule a missing /_next/ file would get (section 3.3)', () => {
    writeFileSync(join(dist, '_headers'), `${LEARNER_HEADERS}/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n`);
    const before = snapshot(dist);
    expect(merge).toThrow(/single-page fallback.*\/_next\/static\/\*/);
    expect(snapshot(dist)).toEqual(before);
  });

  it('refuses a dist without the learner export, and a missing console output', () => {
    rmSync(join(dist, 'index.html'));
    expect(merge).toThrow(/no learner export.*expo export/);
    put(dist, LEARNER_DIST);
    rmSync(consoleOut, { recursive: true, force: true });
    expect(merge).toThrow(/no console output.*build:console/);
  });
});

describe('runMerge', () => {
  it('SKIP_CONSOLE=1: never builds, writes nothing, says so', () => {
    const build = vi.fn(() => 0);
    const log = vi.fn();
    const before = snapshot(dist);
    expect(runMerge({ dist, env: { SKIP_CONSOLE: '1' }, consoleOut, build, isGrownUpPath, prefixes: GROWN_UP_PREFIXES, log })).toBeNull();
    expect(build).not.toHaveBeenCalled();
    expect(snapshot(dist)).toEqual(before);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/SKIP_CONSOLE=1.*nothing merged/));
  });

  it('builds the console once with the pass-through env, then merges', () => {
    const build = vi.fn(() => 0);
    const result = runMerge({ dist, env: { EXPO_PUBLIC_API_BASE_URL: 'https://api.example' }, consoleOut, build, isGrownUpPath, prefixes: GROWN_UP_PREFIXES, log: () => undefined });
    expect(build).toHaveBeenCalledTimes(1);
    expect(build.mock.calls[0][0].NEXT_PUBLIC_API_BASE_URL).toBe('https://api.example');
    expect(result.files).toEqual(Object.keys(CONSOLE_OUT).sort());
  });

  it('fails without merging when the console build fails', () => {
    const before = snapshot(dist);
    expect(() => runMerge({ dist, env: {}, consoleOut, build: () => 1, isGrownUpPath, prefixes: GROWN_UP_PREFIXES, log: () => undefined })).toThrow(/console build failed/);
    expect(snapshot(dist)).toEqual(before);
  });

  it('checks the learner export before spending a console build on it', () => {
    rmSync(join(dist, 'index.html'));
    const build = vi.fn(() => 0);
    expect(() => runMerge({ dist, env: {}, consoleOut, build, isGrownUpPath, prefixes: GROWN_UP_PREFIXES, log: () => undefined })).toThrow(/no learner export/);
    expect(build).not.toHaveBeenCalled();
  });
});

describe('merge-console.mjs (the CLI)', () => {
  it('SKIP_CONSOLE=1 leaves a learner-only build unchanged', () => {
    const before = snapshot(dist);
    const run = spawnSync(process.execPath, [MERGE, dist], { encoding: 'utf8', env: { ...process.env, SKIP_CONSOLE: '1' } });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/SKIP_CONSOLE=1/);
    expect(snapshot(dist)).toEqual(before);
  });

  it('runs when reached through a symlink (a symlinked checkout or temp folder), never skips itself silently', () => {
    const link = join(root, 'merge-console-link.mjs');
    symlinkSync(MERGE, link);
    const skip = spawnSync(process.execPath, [link, dist], { encoding: 'utf8', env: { ...process.env, SKIP_CONSOLE: '1' } });
    expect(skip.status, skip.stderr).toBe(0);
    expect(skip.stdout).toMatch(/SKIP_CONSOLE=1/);
    const empty = join(root, 'empty-for-link');
    mkdirSync(empty);
    const run = spawnSync(process.execPath, [link, empty], { encoding: 'utf8', env: { ...process.env, SKIP_CONSOLE: '' } });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/^merge-console: no learner export/);
  });

  it('fails fast, before building anything, without a learner export', () => {
    const empty = join(root, 'empty');
    mkdirSync(empty);
    const run = spawnSync(process.execPath, [MERGE, empty], { encoding: 'utf8', env: { ...process.env, SKIP_CONSOLE: '' } });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/^merge-console: no learner export/);
    expect(run.stdout).not.toMatch(/building the console/);
  });
});

describe('package.json', () => {
  const pkg = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'));

  it('build:web merges the console after the export and before the service worker is generated', () => {
    expect(pkg.scripts['build:web']).toBe(
      'node scripts/audio/gen-audio-map.mjs && expo export --platform web --output-dir dist && node scripts/app-host/merge-console.mjs dist && node scripts/pwa-postbuild.mjs dist',
    );
  });

  it('the fixture build stays learner-only (it never runs the merge)', () => {
    expect(readFileSync(join(app, 'scripts', 'build-web-fixtures.mjs'), 'utf8')).not.toContain('merge-console');
  });
});

describe('a console-only change leaves sw.js byte-identical (behaviour 18: no update banner for learners)', () => {
  /** A learner export, optionally merged with a console, then the real post-build; returns sw.js. */
  function build(name, consoleFiles) {
    const d = join(root, name);
    put(d, LEARNER_DIST);
    if (consoleFiles) {
      const c = join(root, `${name}-console`);
      put(c, consoleFiles);
      mergeConsole({ dist: d, consoleOut: c, isGrownUpPath, prefixes: GROWN_UP_PREFIXES });
    }
    const run = spawnSync(process.execPath, [POSTBUILD, d], { encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);
    return readFileSync(join(d, 'sw.js'), 'utf8');
  }

  it('is the same with console A, console B and no console', () => {
    const a = build('a', CONSOLE_OUT);
    const b = build('b', {
      ...CONSOLE_OUT,
      'teach/home.html': '<!doctype html><script src="/_next/static/chunks/main-2.js"></script>',
      '_next/static/chunks/main-2.js': 'self.console=2;',
      'start.txt': 'rsc 2',
    });
    const none = build('none', null);
    expect(b).toBe(a);
    expect(none).toBe(a);
  }, 120_000);
});

it('the stand-in console covers every prefix', () => {
  for (const prefix of GROWN_UP_PREFIXES) {
    expect(Object.keys(CONSOLE_OUT).some((rel) => rel.endsWith('.html') && isGrownUpPath(`/${rel}`) && `/${rel}`.startsWith(prefix)), prefix).toBe(true);
  }
  expect(existsSync(MERGE)).toBe(true);
});
