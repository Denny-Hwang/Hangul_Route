// Minimal static server for the apps/web export (./out) — e2e + local smoke.
// No deps. Resolves paths the way the Worker does (apps/web/wrangler.toml,
// html_handling = "auto-trailing-slash"): /about and /about/ → about.html,
// / → index.html. Unknown paths get Next's exported 404 page.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'out');
const port = Number(process.env.PORT ?? 4191);
if (!existsSync(join(root, 'index.html'))) {
  process.stderr.write(`${root}/index.html not found — run \`pnpm --filter @hangul-route/web build\` first\n`);
  process.exit(1);
}
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const isFile = (path) => path.startsWith(root + sep) && existsSync(path) && statSync(path).isFile();

function resolveFile(pathname) {
  const base = join(root, normalize(decodeURIComponent(pathname)));
  const trimmed = base.endsWith(sep) ? base.slice(0, -1) : base;
  return [trimmed, `${trimmed}.html`, join(trimmed, 'index.html')].find(isFile);
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const file = resolveFile(url.pathname);
  const target = file ?? join(root, '404.html');
  res.statusCode = file ? 200 : 404;
  res.setHeader('Content-Type', types[extname(target)] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  createReadStream(target).pipe(res);
}).listen(port, () => process.stdout.write(`serving ${root} on http://localhost:${port}\n`));
