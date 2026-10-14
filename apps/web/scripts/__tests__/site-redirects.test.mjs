// F-APP-001 section 3.13 (amended 2026-10-13, M3 prep; A-10 2026-10-14) and F-SITE-002 section 3.10 (S-10): the
// site build forwards every old grown-up URL on hangulroute.com to the app host. `build` = `next build &&
// prune-hidden-locales && site-redirects` writes `out/_redirects` from `GROWN_UP_PREFIXES` (R-1, the one list) to
// the site build variable `CONSOLE_ORIGIN`, or to the app host when it is unset (A-10, the default of S-10), and
// makes sure no `_redirects` file is left in `out/` for the kill switch `CONSOLE_ORIGIN=false` (or `0`, `off`, `no`). The same
// variable and default move the site's grown-up links (`lib/site-links.ts`), so links and forwarding move in one
// deploy and roll back together.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP_ORIGIN, GROWN_UP_PREFIXES } from '@hangul-route/content-schema';
import { SITE_DEFAULT_CONSOLE_ORIGIN, grownUpOrigin } from '../../src/lib/site-links';
import { DEFAULT_REDIRECT_ORIGIN, REDIRECT_STATUS, redirectOrigin, redirectRules, writeSiteRedirects } from '../site-redirects.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, '..', 'site-redirects.mjs');
const WEB = join(here, '..', '..');

describe('redirectOrigin (the CONSOLE_ORIGIN rule of next.config.js and site-links.ts)', () => {
  it('is the app host when the variable is unset, empty or blank (A-10, the default of F-SITE-002 S-10)', () => {
    expect(DEFAULT_REDIRECT_ORIGIN).toBe(APP_ORIGIN);
    expect(DEFAULT_REDIRECT_ORIGIN).toBe(SITE_DEFAULT_CONSOLE_ORIGIN);
    expect(redirectOrigin(undefined)).toBe(APP_ORIGIN);
    expect(redirectOrigin('')).toBe(APP_ORIGIN);
    expect(redirectOrigin('   ')).toBe(APP_ORIGIN);
  });

  it('is empty (no forwarding) for the kill switch false, 0, off or no, in any case and with spaces', () => {
    for (const off of ['false', '0', 'FALSE', ' False ', ' 0 ', 'off', 'OFF', ' Off ', 'no', 'NO', ' No ']) {
      expect(redirectOrigin(off), off).toBe('');
    }
  });

  it('is the trimmed origin without a trailing slash or path', () => {
    expect(redirectOrigin('https://app.hangulroute.com')).toBe(APP_ORIGIN);
    expect(redirectOrigin(' https://app.hangulroute.com/ ')).toBe(APP_ORIGIN);
    expect(redirectOrigin('http://localhost:8787')).toBe('http://localhost:8787');
  });

  it('refuses a value that is not an https origin (plain http only on this machine)', () => {
    for (const bad of ['app.hangulroute.com', 'http://app.hangulroute.com', 'ftp://app.hangulroute.com', 'not a url']) {
      expect(() => redirectOrigin(bad), bad).toThrow(/CONSOLE_ORIGIN/);
    }
  });

  it('refuses an https host outside hangulroute.com, so a typo never forwards relink codes to another domain', () => {
    for (const bad of ['https://app.hangulroute.co', 'https://app-hangulroute.com', 'https://hangulroute.com.example.com', 'https://evilhangulroute.com']) {
      expect(() => redirectOrigin(bad), bad).toThrow(/CONSOLE_ORIGIN/);
    }
  });

  it('agrees with grownUpOrigin, so the links and the forwarding always point at the same host', () => {
    for (const value of [undefined, '', '  ', 'false', ' 0 ', 'FALSE', 'off', ' OFF ', 'no', ' No ', 'https://app.hangulroute.com', ' https://app.hangulroute.com/ ', 'http://127.0.0.1:3000', 'https://hangulroute.com']) {
      expect(redirectOrigin(value), String(value)).toBe(grownUpOrigin({ CONSOLE_ORIGIN: value }));
    }
  });
});

describe('redirectRules', () => {
  const rules = redirectRules(APP_ORIGIN, GROWN_UP_PREFIXES);
  const lines = rules.trim().split('\n').filter((line) => line && !line.startsWith('#'));

  it('forwards every grown-up prefix, bare and with anything under it, to the same path on the app host', () => {
    for (const prefix of GROWN_UP_PREFIXES) {
      expect(lines).toContain(`${prefix} ${APP_ORIGIN}${prefix} ${REDIRECT_STATUS}`);
      expect(lines).toContain(`${prefix}/* ${APP_ORIGIN}${prefix}/:splat ${REDIRECT_STATUS}`);
    }
    expect(lines).toHaveLength(GROWN_UP_PREFIXES.length * 2);
  });

  it('is a temporary redirect, so the kill switch rolls back without cached permanent redirects (A-10 kept 302)', () => {
    expect(REDIRECT_STATUS).toBe(302);
  });

  it('never forwards a site page, the previews or the presenter', () => {
    for (const line of lines) {
      const [from] = line.split(' ');
      expect(from).not.toMatch(/^\/(design-preview|present|browse|teachers|parents|learners|about|privacy|terms|es|ko)(\/|$)/);
      expect(from === '/' || from === '/*').toBe(false);
    }
  });

  it('refuses an empty origin or an empty prefix list', () => {
    expect(() => redirectRules('', GROWN_UP_PREFIXES)).toThrow();
    expect(() => redirectRules(APP_ORIGIN, [])).toThrow();
  });
});

describe('writeSiteRedirects', () => {
  let out;
  beforeEach(() => {
    out = mkdtempSync(join(tmpdir(), 'site-redirects-'));
    writeFileSync(join(out, 'index.html'), '<html></html>');
    mkdirSync(join(out, 'teach'));
    writeFileSync(join(out, 'teach', 'home.html'), '<html></html>');
  });
  afterEach(() => rmSync(out, { recursive: true, force: true }));

  it('writes out/_redirects when an origin is set', () => {
    expect(writeSiteRedirects(out, APP_ORIGIN, GROWN_UP_PREFIXES)).toBe(GROWN_UP_PREFIXES.length * 2);
    expect(readFileSync(join(out, '_redirects'), 'utf8')).toBe(redirectRules(APP_ORIGIN, GROWN_UP_PREFIXES));
  });

  it('writes no file, and removes a stale one, when the origin is empty (the kill switch)', () => {
    writeFileSync(join(out, '_redirects'), '/teach https://example.com 302\n');
    expect(writeSiteRedirects(out, '', GROWN_UP_PREFIXES)).toBe(0);
    expect(existsSync(join(out, '_redirects'))).toBe(false);
  });

  it('refuses a missing export folder', () => {
    expect(() => writeSiteRedirects(join(out, 'nope'), APP_ORIGIN, GROWN_UP_PREFIXES)).toThrow(/no export folder/);
  });
});

// Each case starts Node with the TypeScript loader (about 2 s); a shared CI runner gets room.
describe('the CLI', { timeout: 30_000 }, () => {
  let out;
  beforeEach(() => {
    out = mkdtempSync(join(tmpdir(), 'site-redirects-cli-'));
    writeFileSync(join(out, 'index.html'), '<html></html>');
  });
  afterEach(() => rmSync(out, { recursive: true, force: true }));

  const run = (consoleOrigin) => {
    const env = { ...process.env };
    delete env.CONSOLE_ORIGIN;
    if (consoleOrigin !== undefined) env.CONSOLE_ORIGIN = consoleOrigin;
    return spawnSync(process.execPath, [SCRIPT, out], { cwd: WEB, env, encoding: 'utf8' });
  };

  it('writes the rules from the R-1 prefix list when CONSOLE_ORIGIN is set', () => {
    const result = run('https://app.hangulroute.com');
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(out, '_redirects'), 'utf8')).toBe(redirectRules(APP_ORIGIN, GROWN_UP_PREFIXES));
    expect(result.stdout).toContain(`site-redirects: ${GROWN_UP_PREFIXES.length * 2} rules to ${APP_ORIGIN}`);
  });

  it('forwards to the app host when CONSOLE_ORIGIN is unset (A-10)', () => {
    const result = run(undefined);
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(out, '_redirects'), 'utf8')).toBe(redirectRules(APP_ORIGIN, GROWN_UP_PREFIXES));
  });

  it('writes nothing for the kill switch CONSOLE_ORIGIN=false', () => {
    const result = run('false');
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(join(out, '_redirects'))).toBe(false);
    expect(result.stdout).toMatch(/no _redirects/);
  });

  it('fails the build on an invalid CONSOLE_ORIGIN', () => {
    const result = run('app.hangulroute.com');
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/CONSOLE_ORIGIN/);
    expect(existsSync(join(out, '_redirects'))).toBe(false);
  });
});

describe('package.json', () => {
  it('runs site-redirects at the end of the site build only, never in the console role', () => {
    const pkg = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8'));
    expect(pkg.scripts.build).toMatch(/&& node scripts\/site-redirects\.mjs out$/);
    expect(pkg.scripts['build:console']).not.toMatch(/site-redirects/);
  });

  it('keeps no _redirects in public/, so only the script decides', () => {
    expect(existsSync(join(WEB, 'public', '_redirects'))).toBe(false);
  });
});

// Checked by hand on `wrangler dev --local` (query kept, a redirect wins over the console files still in out/, site pages
// stay 200) with these [assets] settings. CI only reads the generated text,
// so this pins the settings the Workers static-assets redirect handling was checked against: a change here
// means re-running that local check (owner-runbook.md section E2, step 5) before S-3b.
describe('wrangler.toml (the site Worker the redirects run on)', () => {
  const toml = readFileSync(join(WEB, 'wrangler.toml'), 'utf8');
  const assets = toml.slice(toml.indexOf('[assets]')).split(/\n\[/)[0];

  it('serves out/ as an assets-only Worker with the settings the redirects were checked against', () => {
    expect(assets).toMatch(/^directory = "\.\/out"$/m);
    expect(assets).toMatch(/^not_found_handling = "404-page"$/m);
    expect(assets).toMatch(/^html_handling = "auto-trailing-slash"$/m);
    expect(toml).not.toMatch(/^main\s*=/m);
    expect(assets).not.toMatch(/run_worker_first/);
  });
});
