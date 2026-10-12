// F-APP-001 A-3 (sections 3.1 and 3.3, section 5): the console role of the static export.
// `build:console` = `next build && node scripts/console-split.mjs out` writes `out-console/`
// holding only the files of grown-up paths (R-1, `isGrownUpPath`, the one implementation)
// and the whole `_next/` folder, which `apps/mobile/scripts/app-host/merge-console.mjs`
// then copies into the learner Worker's dist. The site role (`out/`) is not touched.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP_ORIGIN, isGrownUpPath } from '@hangul-route/content-schema';
import { CONSOLE_ASSET_DIR, NEVER_COPIED, consoleFiles, isConsoleFile, listFiles, splitConsole } from '../console-split.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, '..', 'console-split.mjs');
const WEB = join(here, '..', '..');

/** A stand-in for `next build`'s `out/`: every kind of file the real export holds (section 3.3). */
const EXPORT = {
  // site role only: landing, legal, persona pages, hidden locales, previews, Next's 404 and the host config
  'index.html': '<html><script src="/_next/static/chunks/main.js"></script></html>',
  'index.txt': 'rsc',
  '404.html': '<html><script src="/_next/static/chunks/main.js"></script></html>',
  '_not-found.html': '<html>404</html>',
  '_not-found.txt': 'rsc',
  'about.html': 'site',
  'about.txt': 'rsc',
  'privacy.html': 'site',
  'privacy.txt': 'rsc',
  'terms.html': 'site',
  'terms.txt': 'rsc',
  'learners.html': 'site',
  'parents.html': 'site',
  'parents.txt': 'rsc',
  'teachers.html': 'site',
  'teachers.txt': 'rsc',
  'es.html': 'site',
  'es.txt': 'rsc',
  'es/about.html': 'site',
  'ko.html': 'site',
  'ko/privacy.html': 'site',
  'design-preview.html': 'preview',
  'design-preview.txt': 'rsc',
  'design-preview/scenes/library.html': 'preview',
  '_headers': '/*\n  X-Content-Type-Options: nosniff\n',
  'robots.txt': 'User-agent: *',
  'favicon.ico': 'icon',
  // console role: grown-up pages with their RSC payloads, and every Next asset
  'teach.html': 'console',
  'teach.txt': 'rsc',
  'teach/home.html': 'console',
  'teach/home.txt': 'rsc',
  'teach/space.html': 'console',
  'teach/space.txt': 'rsc',
  'teach/space/settings.html': 'console',
  'teach/space/settings.txt': 'rsc',
  'teach/billing.html': 'console',
  'teach/start.html': 'console',
  'parent.html': 'console',
  'parent.txt': 'rsc',
  'parent/mina.html': 'console',
  'parent/mina.txt': 'rsc',
  'signin.html': 'console',
  'signin.txt': 'rsc',
  'start.html': 'console',
  'account/billing.html': 'console',
  'account/billing.txt': 'rsc',
  '_next/static/chunks/main.js': 'chunk',
  '_next/static/chunks/app/(console)/teach/home/page-abc.js': 'chunk',
  '_next/static/css/app.css': 'css',
  '_next/static/media/font.woff2': 'font',
  '_next/static/BUILD_ID/_buildManifest.js': 'manifest',
};

const CONSOLE = [
  '_next/static/BUILD_ID/_buildManifest.js',
  '_next/static/chunks/app/(console)/teach/home/page-abc.js',
  '_next/static/chunks/main.js',
  '_next/static/css/app.css',
  '_next/static/media/font.woff2',
  'account/billing.html',
  'account/billing.txt',
  'parent.html',
  'parent.txt',
  'parent/mina.html',
  'parent/mina.txt',
  'signin.html',
  'signin.txt',
  'start.html',
  'teach.html',
  'teach.txt',
  'teach/billing.html',
  'teach/home.html',
  'teach/home.txt',
  'teach/space.html',
  'teach/space.txt',
  'teach/space/settings.html',
  'teach/space/settings.txt',
  'teach/start.html',
];

let root;
let out;
let dest;

function put(dir, rel, body) {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), body);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'hr-console-split-'));
  out = join(root, 'out');
  dest = join(root, 'out-console');
  for (const [rel, body] of Object.entries(EXPORT)) put(out, rel, body);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('isConsoleFile', () => {
  it('takes grown-up paths by R-1 (with the .html and .txt boundary) and everything under _next/', () => {
    for (const rel of ['teach.html', 'teach.txt', 'teach/home.html', 'parent/mina.txt', 'signin.html', 'start.txt', 'account/billing.html']) {
      expect(isConsoleFile(rel, isGrownUpPath), rel).toBe(true);
    }
    for (const rel of ['_next/static/chunks/main.js', '_next/static/BUILD_ID/_ssgManifest.js']) {
      expect(isConsoleFile(rel, isGrownUpPath), rel).toBe(true);
    }
  });

  it('leaves the near misses and the site pages out', () => {
    for (const rel of ['teachers.html', 'parents.txt', 'signing.html', 'starts.html', 'accounts/x.html', 'index.html', '404.html', '_nextx/a.js', 'next/a.js', '_headers']) {
      expect(isConsoleFile(rel, isGrownUpPath), rel).toBe(false);
    }
  });

  it('reads Windows separators as path separators', () => {
    expect(isConsoleFile('teach\\home.html', isGrownUpPath)).toBe(true);
    expect(isConsoleFile('_next\\static\\a.js', isGrownUpPath)).toBe(true);
  });
});

describe('consoleFiles', () => {
  it('selects exactly the grown-up pages, their RSC payloads and _next/, sorted', () => {
    expect(consoleFiles(Object.keys(EXPORT), isGrownUpPath)).toEqual(CONSOLE);
  });

  it('never selects a site file, whatever the predicate says (second guard of section 3.3)', () => {
    const yesToAll = () => true;
    for (const rel of ['index.html', '404.html', 'about.html', 'privacy.txt', 'terms.html', 'learners.html', 'parents.html', 'teachers.txt', 'es.html', 'es/about.html', 'ko/privacy.html', 'design-preview.html', 'design-preview/scenes/library.html']) {
      expect(() => consoleFiles([rel], yesToAll), rel).toThrow(/never copies/);
    }
    // section 3.3 names them as prefixes (`about*`, `privacy*`, ...): a longer first name is refused too
    for (const rel of ['about-us.html', 'privacy-center/data.html', 'terms-of-sale.txt', 'learners-guide.html', 'design-previews/x.html', 'es-mx.html', 'ko-kr/index.html']) {
      expect(() => consoleFiles([rel], yesToAll), rel).toThrow(/never copies/);
    }
  });

  it('names every never-copied page of section 3.3', () => {
    expect(NEVER_COPIED).toEqual(['index', '404', 'about', 'privacy', 'terms', 'learners', 'parents', 'teachers', 'es', 'ko', 'design-preview']);
    expect(CONSOLE_ASSET_DIR).toBe('_next');
  });
});

describe('listFiles', () => {
  it('lists every file under a folder as POSIX paths relative to it, sorted', () => {
    expect(listFiles(out)).toEqual(Object.keys(EXPORT).sort());
  });
});

describe('splitConsole', () => {
  it('writes only the console files, byte for byte, and reports them', () => {
    const copied = splitConsole(out, dest, isGrownUpPath);
    expect(copied).toEqual(CONSOLE);
    expect(listFiles(dest)).toEqual(CONSOLE);
    for (const rel of CONSOLE) expect(readFileSync(join(dest, rel), 'utf8'), rel).toBe(EXPORT[rel]);
  });

  it('never writes the landing, the 404 page, legal, persona, locale or preview pages', () => {
    splitConsole(out, dest, isGrownUpPath);
    for (const rel of ['index.html', 'index.txt', '404.html', '_not-found.html', 'about.html', 'privacy.html', 'terms.html', 'learners.html', 'parents.html', 'teachers.html', 'es.html', 'es', 'ko.html', 'ko', 'design-preview.html', 'design-preview', '_headers', 'robots.txt', 'favicon.ico']) {
      expect(existsSync(join(dest, rel)), rel).toBe(false);
    }
  });

  it('replaces an older console output, so a page removed from the export never ships', () => {
    put(dest, 'teach/old-page.html', 'stale');
    put(dest, 'index.html', 'stale');
    splitConsole(out, dest, isGrownUpPath);
    expect(listFiles(dest)).toEqual(CONSOLE);
  });

  it('leaves the site export untouched', () => {
    splitConsole(out, dest, isGrownUpPath);
    expect(listFiles(out)).toEqual(Object.keys(EXPORT).sort());
  });

  it('refuses a missing export folder', () => {
    expect(() => splitConsole(join(root, 'nope'), dest, isGrownUpPath)).toThrow(/no export folder/);
  });

  it('refuses an export without any grown-up page (a console build that lost its pages)', () => {
    rmSync(out, { recursive: true, force: true });
    put(out, 'index.html', 'site');
    put(out, '_next/static/chunks/main.js', 'chunk');
    expect(() => splitConsole(out, dest, isGrownUpPath)).toThrow(/no grown-up page/);
    expect(existsSync(dest)).toBe(false);
  });

  it('refuses a destination that is the export folder, inside it, or around it', () => {
    expect(() => splitConsole(out, out, isGrownUpPath)).toThrow(/must be outside/);
    expect(() => splitConsole(out, join(out, 'console'), isGrownUpPath)).toThrow(/must be outside/);
    expect(() => splitConsole(out, root, isGrownUpPath)).toThrow(/must be outside/);
    expect(listFiles(out)).toEqual(Object.keys(EXPORT).sort());
  });
});

describe('console-split.mjs (the CLI, prefixes read from packages/content-schema)', () => {
  it('writes <out>-console next to the export', () => {
    const run = spawnSync(process.execPath, [SCRIPT, out], { encoding: 'utf8' });
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/console-split: 11 pages, 24 files/);
    expect(listFiles(dest)).toEqual(CONSOLE);
  });

  it('takes an explicit destination', () => {
    const other = join(root, 'elsewhere');
    const run = spawnSync(process.execPath, [SCRIPT, out, other], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(listFiles(other)).toEqual(CONSOLE);
    expect(existsSync(dest)).toBe(false);
  });

  it('fails the build with the reason', () => {
    const run = spawnSync(process.execPath, [SCRIPT, join(root, 'nope')], { encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/^console-split: no export folder/);
  });

  it('runs when reached through a symlink (a symlinked checkout or temp folder), never skips itself silently', () => {
    const link = join(root, 'console-split-link.mjs');
    symlinkSync(SCRIPT, link);
    const run = spawnSync(process.execPath, [link, join(root, 'nope')], { encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/^console-split: no export folder/);
  });
});

describe('package.json', () => {
  const scripts = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8')).scripts;

  it('builds the console role from the same export (section 3.3), then leaves out/ pruned as the site role does', () => {
    expect(scripts['build:console']).toBe('next build && node scripts/console-split.mjs out && node scripts/prune-hidden-locales.mjs out');
  });

  it('keeps the site role unchanged', () => {
    expect(scripts.build).toBe('next build && node scripts/prune-hidden-locales.mjs out');
  });
});

describe('hangul-route-web never serves the app host (section 3.1 reason 6, the F-SITE-002 S-10 contract)', () => {
  const host = new URL(APP_ORIGIN).host;
  const web = readFileSync(join(WEB, 'wrangler.toml'), 'utf8');
  const app = readFileSync(join(WEB, '..', 'mobile', 'wrangler.toml'), 'utf8');

  it('names no route or custom domain on the app host, commented out or not', () => {
    expect(web).toMatch(/^name = "hangul-route-web"$/m);
    const patterns = [...web.matchAll(/pattern\s*=\s*"([^"]*)"/g)].map((m) => m[1]);
    expect(patterns).toEqual(['hangulroute.com', 'www.hangulroute.com']);
    expect(patterns).not.toContain(host);
  });

  it('leaves the app host to hangul-route-app, the learner Worker the console is merged into', () => {
    expect(app).toMatch(/^name = "hangul-route-app"$/m);
    expect([...app.matchAll(/pattern\s*=\s*"([^"]*)"/g)].map((m) => m[1])).toEqual([host]);
  });
});

describe('the export folder of the console role', () => {
  it('is never committed', () => {
    const ignore = readFileSync(join(WEB, '..', '..', '.gitignore'), 'utf8');
    expect(ignore).toMatch(/^out-console\/$/m);
  });
});
