// Minimal static server for the web export (e2e + local smoke). No deps.
// Answers the way the Worker does (apps/mobile/wrangler.toml): html_handling =
// "auto-trailing-slash" (/teach/home and /teach/home/ → teach/home.html, the
// console pages merged in by scripts/app-host/merge-console.mjs, F-APP-001 A-3),
// not_found_handling = "single-page-application" (any other miss → index.html,
// 200), and the rules of dist/_headers on every answer, so the e2e reads the
// headers Workers would send. Not emulated: the 307 Workers sends for a `.html`
// or trailing-slash URL (served here as is), and the hiding of _headers itself.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { headersFor, parseHeaders } from './app-host/headers.mjs';

const root = resolve(process.argv[2] ?? 'dist');
const port = Number(process.env.PORT ?? 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
};
const headersFile = join(root, '_headers');
let headersCache = { mtimeMs: -1, rules: [] };

/** The rules of dist/_headers, read again when the file changes (a rebuild under a server left running). */
function currentRules() {
  const mtimeMs = existsSync(headersFile) ? statSync(headersFile).mtimeMs : 0;
  if (mtimeMs !== headersCache.mtimeMs) {
    headersCache = { mtimeMs, rules: mtimeMs === 0 ? [] : parseHeaders(readFileSync(headersFile, 'utf8')) };
  }
  return headersCache.rules;
}

const isFile = (path) => path.startsWith(root + sep) && existsSync(path) && statSync(path).isFile();

function resolveFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined; // a malformed escape: the single-page fallback, as for any miss
  }
  const base = join(root, normalize(decoded));
  const trimmed = base.endsWith(sep) ? base.slice(0, -1) : base;
  return [trimmed, `${trimmed}.html`, join(trimmed, 'index.html')].find(isFile);
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const file = resolveFile(url.pathname) ?? join(root, 'index.html'); // SPA fallback
  res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  for (const [name, value] of Object.entries(headersFor(currentRules(), url.pathname))) res.setHeader(name, value);
  createReadStream(file).pipe(res);
}).listen(port, () => process.stdout.write(`serving ${root} on http://localhost:${port}\n`));
