// The install-only icon stays out of the learner precache (pwa/install-icons.mjs, perf(pwa) headroom row) and the
// icons an offline start or an offline add-to-home-screen needs stay in.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APPLE_TOUCH_ICON_FILE, INSTALL_ONLY_ICONS, appleTouchIconHref, installIconGlobIgnores, installIconProblems } from '../pwa/install-icons.mjs';
import { lessonBundles } from './helpers/lesson-bundles.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..', '..');
const postbuild = join(app, 'scripts', 'pwa-postbuild.mjs');

const HTML = `<html><head><link rel="apple-touch-icon" href="/${APPLE_TOUCH_ICON_FILE}"></head></html>`;
const MANIFEST = {
  icons: [
    { src: '/icon-192.png', sizes: '192x192' },
    { src: '/icon-512.png', sizes: '512x512' },
    { src: '/icon-1024.png', sizes: '1024x1024' },
  ],
};
const PRECACHED = ['index.html', 'icon-192.png', 'icon-512.png', 'favicon.ico'];
const input = (over = {}) => ({ manifestUrls: PRECACHED, html: HTML, webManifest: MANIFEST, bundles: [], exists: () => true, ...over });

describe('install-only icons', () => {
  it('names icon-1024.png and ignores it in the precache glob; the touch icon is the precached 512 px file', () => {
    expect(INSTALL_ONLY_ICONS).toEqual(['icon-1024.png']);
    expect(installIconGlobIgnores()).toEqual(['icon-1024.png']);
    expect(APPLE_TOUCH_ICON_FILE).toBe('icon-512.png');
  });

  it('reads the touch icon link, in either attribute order, and null without one', () => {
    expect(appleTouchIconHref(HTML)).toBe('/icon-512.png');
    expect(appleTouchIconHref('<link href="/x.png" rel="apple-touch-icon">')).toBe('/x.png');
    expect(appleTouchIconHref('<link rel="icon" href="/x.png">')).toBeNull();
  });

  it('is sound when the 192 and 512 px icons are precached and the 1024 px one is not', () => {
    expect(installIconProblems(input())).toEqual([]);
  });

  it('is sound for a stand-in export with no web manifest and no icon files', () => {
    expect(installIconProblems(input({ webManifest: null, exists: () => false }))).toEqual([]);
  });

  it('fails when the install-only icon reaches the precache', () => {
    const problems = installIconProblems(input({ manifestUrls: [...PRECACHED, 'icon-1024.png'] }));
    expect(problems.join('\n')).toMatch(/icon-1024\.png is in the learner precache/);
  });

  it('fails when a bundle names the install-only icon (the app would not find it offline)', () => {
    const problems = installIconProblems(input({ bundles: [{ url: '_expo/static/js/web/index-abc.js', text: 'uri:"/icon-1024.png"' }] }));
    expect(problems.join('\n')).toMatch(/index-abc\.js names icon-1024\.png/);
  });

  it('fails when the touch icon points at the install-only icon, or at a file the precache lacks', () => {
    expect(installIconProblems(input({ html: '<link rel="apple-touch-icon" href="/icon-1024.png">' })).join('\n')).toMatch(/points at icon-1024\.png, which is not precached/);
    expect(installIconProblems(input({ manifestUrls: ['index.html', 'icon-192.png'] })).join('\n')).toMatch(/apple-touch-icon file icon-512\.png is missing from the precache/);
    expect(installIconProblems(input({ html: '<html></html>' })).join('\n')).toMatch(/no apple-touch-icon link/);
  });

  it('fails when the offline install loses its 192 or 512 px icon, or a manifest icon is not in the export', () => {
    expect(installIconProblems(input({ manifestUrls: ['index.html', 'icon-512.png'] })).join('\n')).toMatch(/no precached 192x192 manifest icon/);
    expect(installIconProblems(input({ manifestUrls: ['index.html', 'icon-192.png'] })).join('\n')).toMatch(/no precached 512x512 manifest icon/);
    expect(installIconProblems(input({ exists: (f) => f !== 'icon-192.png' })).join('\n')).toMatch(/manifest icon \/icon-192\.png is not in the export/);
    expect(installIconProblems(input({ manifestUrls: ['index.html', 'icon-512.png'], webManifest: { icons: [...MANIFEST.icons, { src: '/other.png', sizes: '96x96' }] } })).join('\n')).toMatch(
      /manifest icon \/other\.png is missing from the precache/,
    );
  });

  it('keeps the shipped manifest in step: 192, 512 and the install-only 1024 px icon, all present in public/', () => {
    const manifest = JSON.parse(readFileSync(join(app, 'public', 'manifest.webmanifest'), 'utf8'));
    expect(installIconProblems(input({ manifestUrls: PRECACHED, webManifest: manifest, exists: (f) => existsSync(join(app, 'public', f)) }))).toEqual([]);
    expect(manifest.icons.map((i) => i.src)).toEqual(['/icon-192.png', '/icon-512.png', '/icon-1024.png']);
  });
});

describe('pwa-postbuild.mjs on an export with the manifest icons', () => {
  let dist;
  let run;
  let sw;
  let index;

  const buildDist = (extra = {}) => {
    const out = mkdtempSync(join(tmpdir(), 'hr-pwa-icons-'));
    const files = {
      'index.html': '<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><div id="root"></div></body></html>',
      'fonts/hr-presenter-kr.woff2': 'wOF2 stand-in',
      'manifest.webmanifest': readFileSync(join(app, 'public', 'manifest.webmanifest'), 'utf8'),
      'icon-192.png': 'png192',
      'icon-512.png': 'png512',
      'icon-1024.png': 'png1024'.padEnd(50_000, '.'),
      'favicon.ico': 'ico',
      ...lessonBundles(),
      ...extra,
    };
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(dirname(join(out, path)), { recursive: true });
      writeFileSync(join(out, path), body);
    }
    return out;
  };

  beforeAll(() => {
    dist = buildDist();
    run = spawnSync(process.execPath, [postbuild, dist], { encoding: 'utf8' });
    sw = existsSync(join(dist, 'sw.js')) ? readFileSync(join(dist, 'sw.js'), 'utf8') : '';
    index = readFileSync(join(dist, 'index.html'), 'utf8');
  }, 120_000);

  afterAll(() => {
    if (dist) rmSync(dist, { recursive: true, force: true });
  });

  it('succeeds', () => {
    expect(run.status, run.stderr).toBe(0);
  });

  it('precaches the 192 and 512 px icons and the favicon, and not the 1024 px icon (which stays in the export)', () => {
    expect(sw).toContain('"icon-192.png"');
    expect(sw).toContain('"icon-512.png"');
    expect(sw).toContain('"favicon.ico"');
    expect(sw).not.toContain('icon-1024.png');
    expect(existsSync(join(dist, 'icon-1024.png'))).toBe(true);
  });

  it('points the touch icon at the precached 512 px file, so adding the app to the home screen works offline', () => {
    expect(index).toContain('<link rel="apple-touch-icon" href="/icon-512.png">');
    expect(index).not.toContain('icon-1024.png');
  });

  it('fails the build when the touch icon file is not in the precache (a missing 512 px icon)', () => {
    const broken = buildDist();
    try {
      rmSync(join(broken, 'icon-512.png'));
      const r = spawnSync(process.execPath, [postbuild, broken], { encoding: 'utf8' });
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/manifest icon \/icon-512\.png is not in the export/);
    } finally {
      rmSync(broken, { recursive: true, force: true });
    }
  });

  it('fails the build when a bundle draws the install-only icon', () => {
    const start = '_expo/static/js/web/index-abc.js';
    const broken = buildDist({ [start]: `${lessonBundles()[start]}\nvar icon="/icon-1024.png";` });
    try {
      const r = spawnSync(process.execPath, [postbuild, broken], { encoding: 'utf8' });
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/names icon-1024\.png, which is not precached/);
    } finally {
      rmSync(broken, { recursive: true, force: true });
    }
  });
});
