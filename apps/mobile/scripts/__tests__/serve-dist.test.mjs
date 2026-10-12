// scripts/serve-dist.mjs, the e2e server of the web export (F-APP-001 A-3): it answers the way
// hangul-route-app does (apps/mobile/wrangler.toml), so the merged build's console pages and
// headers are tested as Workers serve them.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SERVE = join(here, '..', 'serve-dist.mjs');

const DIST = {
  'index.html': '<html>learner shell</html>',
  'sw.js': 'self.sw=1;',
  'teach.html': '<html>console teach</html>',
  'teach.txt': 'rsc teach',
  'teach/home.html': '<html>console home</html>',
  'teach/home.txt': 'rsc home',
  '_next/static/chunks/main-1.js': 'self.chunk=1;',
  _headers: '/sw.js\n  Cache-Control: no-cache\n/teach/*\n  X-Frame-Options: DENY\n  Cache-Control: no-store\n',
};

let root;
let dist;
let server;
let base;

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'hr-serve-dist-'));
  dist = join(root, 'dist');
  for (const [rel, body] of Object.entries(DIST)) {
    mkdirSync(dirname(join(dist, rel)), { recursive: true });
    writeFileSync(join(dist, rel), body);
  }
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [SERVE, dist], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes('serving')) resolve();
    });
  });
});

afterAll(() => {
  server?.kill();
  rmSync(root, { recursive: true, force: true });
});

const get = async (path) => {
  const res = await fetch(`${base}${path}`);
  return { status: res.status, type: res.headers.get('content-type'), cache: res.headers.get('cache-control'), frame: res.headers.get('x-frame-options'), body: await res.text() };
};

describe('serve-dist.mjs answers like the Worker', () => {
  it('serves a page at its clean URL (auto-trailing-slash) with its _headers rules', async () => {
    expect(await get('/teach/home')).toEqual({ status: 200, type: 'text/html; charset=utf-8', cache: 'no-store', frame: 'DENY', body: '<html>console home</html>' });
    expect((await get('/teach/home/')).body).toBe('<html>console home</html>');
    expect((await get('/teach')).body).toBe('<html>console teach</html>');
    expect(await get('/teach/home.txt')).toMatchObject({ type: 'text/plain; charset=utf-8', cache: 'no-store', body: 'rsc home' });
  });

  it('answers any other miss with the learner shell (single-page fallback), never a file outside dist', async () => {
    for (const path of ['/journey', '/_next/static/chunks/missing.js', '/%E0%A4%A', '/..%2F..%2Fetc%2Fpasswd', '/teach/..%2F..%2F..%2Fpackage.json']) {
      expect(await get(path), path).toMatchObject({ status: 200, type: 'text/html; charset=utf-8', body: '<html>learner shell</html>' });
    }
    expect(await get('/sw.js')).toMatchObject({ cache: 'no-cache', frame: null, body: 'self.sw=1;' });
  });

  it('reads dist/_headers again after a rebuild, so a server left running never answers with old rules', async () => {
    writeFileSync(join(dist, '_headers'), '/teach/*\n  X-Frame-Options: SAMEORIGIN\n');
    const later = new Date(Date.now() + 5_000);
    utimesSync(join(dist, '_headers'), later, later);
    expect(await get('/teach/home')).toMatchObject({ frame: 'SAMEORIGIN', cache: 'no-cache' });
  });
});
