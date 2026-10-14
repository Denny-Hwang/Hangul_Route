#!/usr/bin/env node
// Forwarding of old grown-up URLs on hangulroute.com (F-APP-001 section 3.13 as amended 2026-10-13, M3 prep;
// F-SITE-002 section 3.10).
//
// `build` = `next build && node scripts/prune-hidden-locales.mjs out && node scripts/site-redirects.mjs out`.
// When the site build variable `CONSOLE_ORIGIN` holds an origin (the owner sets
// `CONSOLE_ORIGIN=https://app.hangulroute.com` on `hangul-route-web` at M3), this writes `out/_redirects`:
// every grown-up prefix of R-1 (`GROWN_UP_PREFIXES`, the one list), bare and with anything under it, goes
// to the same path on that origin. The Workers static-assets runtime answers a matching request with the
// redirect before it looks for a file, so the console pages still in `out/` are no longer reachable at
// those paths. Query strings travel with the redirect and browsers keep the fragment. While the variable is
// unset (production until M3) no `_redirects` file is left in `out/`, so the site serves exactly what it
// serves today. The same variable moves the site's grown-up links (`src/lib/site-links.ts`), so links and
// forwarding move in one deploy, and unsetting it (then Retry deployment) rolls both back.
//
// 302, not 301: a browser never caches a temporary redirect for good, so the rollback reaches everyone.
// The console role (`build:console`, the app host) never runs this script.
//
//   node scripts/site-redirects.mjs [out]
import { existsSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Temporary on purpose (see the header). */
export const REDIRECT_STATUS = 302;

/** Hosts where a plain-http origin is allowed: this machine only (the rule of next.config.js and site-links.ts). */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The only domain an https origin may name (itself or a subdomain): a mistyped host such as
 * https://app.hangulroute.co fails the build instead of forwarding relink codes and space ids to it. */
const SITE_DOMAIN = 'hangulroute.com';

/**
 * The origin the site forwards to: `CONSOLE_ORIGIN` trimmed, as an origin; `''` (no forwarding) when it is
 * unset or blank. Any other value that is not an https URL on hangulroute.com or a subdomain (plain http only
 * on this machine) throws, as
 * next.config.js does, so a typo fails the build and the previous deployment stays live.
 * @param {string | undefined} raw
 * @returns {string}
 */
export function redirectOrigin(raw) {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  let url = null;
  try {
    url = new URL(trimmed);
  } catch {
    url = null;
  }
  const ownHost = url !== null && (url.hostname === SITE_DOMAIN || url.hostname.endsWith(`.${SITE_DOMAIN}`));
  const allowed = url !== null && ((url.protocol === 'https:' && ownHost) || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname)));
  if (!allowed) {
    throw new Error(
      `CONSOLE_ORIGIN must be an https origin on hangulroute.com such as https://app.hangulroute.com (plain http only for localhost), got ${JSON.stringify(raw)}. Unset it to keep grown-up pages on this site.`,
    );
  }
  return url.origin;
}

/**
 * The `_redirects` text: two rules per prefix, `P` and `P/*`, each to the same path on `origin`.
 * @param {string} origin
 * @param {readonly string[]} prefixes
 * @returns {string}
 */
export function redirectRules(origin, prefixes) {
  if (!origin) throw new Error('redirectRules needs an origin');
  if (prefixes.length === 0) throw new Error('redirectRules needs at least one grown-up prefix');
  const lines = [
    '# Written by apps/web/scripts/site-redirects.mjs because CONSOLE_ORIGIN is set (F-APP-001 section 3.13).',
    '# Old grown-up URLs on this site go to the same path on the app host; query strings travel with them.',
  ];
  for (const prefix of prefixes) {
    lines.push(`${prefix} ${origin}${prefix} ${REDIRECT_STATUS}`);
    lines.push(`${prefix}/* ${origin}${prefix}/:splat ${REDIRECT_STATUS}`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Writes `<outDir>/_redirects` for `origin`, or removes it when `origin` is `''`.
 * @param {string} outDir the `next build` export
 * @param {string} origin from `redirectOrigin`
 * @param {readonly string[]} prefixes `GROWN_UP_PREFIXES`
 * @returns {number} the number of rules written (0 when none)
 */
export function writeSiteRedirects(outDir, origin, prefixes) {
  const out = resolve(outDir);
  if (!existsSync(out) || !statSync(out).isDirectory()) throw new Error(`no export folder at ${outDir} (run next build first)`);
  const file = join(out, '_redirects');
  if (!origin) {
    rmSync(file, { force: true });
    return 0;
  }
  writeFileSync(file, redirectRules(origin, prefixes));
  return prefixes.length * 2;
}

// Real paths on both sides (see console-split.mjs): a symlinked checkout must still run the CLI.
const isMain = Boolean(process.argv[1]) && existsSync(process.argv[1]) && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);

if (isMain) {
  try {
    if (typeof nodeModule.register !== 'function') {
      throw new Error(`needs Node 20.6+ (module.register); this is ${process.version}`);
    }
    const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
    nodeModule.register(pathToFileURL(join(repo, 'scripts', 'ts-loader.mjs')));
    const { GROWN_UP_PREFIXES } = await import(pathToFileURL(join(repo, 'packages', 'content-schema', 'src', 'schemas', 'app-shell.ts')).href);
    const out = process.argv[2] ?? 'out';
    const origin = redirectOrigin(process.env.CONSOLE_ORIGIN);
    const rules = writeSiteRedirects(out, origin, GROWN_UP_PREFIXES);
    process.stdout.write(
      rules > 0
        ? `site-redirects: ${rules} rules to ${origin} in ${join(out, '_redirects')}\n`
        : 'site-redirects: CONSOLE_ORIGIN is unset, no _redirects (grown-up pages stay on this site)\n',
    );
  } catch (err) {
    process.stderr.write(`site-redirects: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
