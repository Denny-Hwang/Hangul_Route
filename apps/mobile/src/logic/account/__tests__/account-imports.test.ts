import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F-AUTH-004 section 9.3 (row NS-2; CS-N5, CS-N10): the import guard. Every file under `src/screens/account/**` and
 * `src/logic/account/**` (and Clerk's own native files, `src/platform/clerk*.native.*`) is read, and the test fails
 * on any way to a purchase, a link out, a web view, an account creation or an OAuth flow:
 * - an import of `platform/billing-handoff`, `platform/external-link`, `logic/paywall`, `expo-web-browser`,
 *   `react-native-webview`, or `Linking` from `react-native`;
 * - Clerk's `useSignUp`, `SignUp` or any OAuth, SSO or Apple hook;
 * - the strings `APP_ROUTES.billing`, `/api/entitlements/stripe` and `/api/billing/receipt`.
 * Module imports are followed transitively (a shared component an account screen draws is held to the same rule),
 * resolved the way the native build resolves them (a `.native` twin first).
 * It also fails when any file of the app outside those folders and `platform/clerk*.native.*` imports
 * `@clerk/clerk-expo` (no learner screen ever calls a Clerk hook, CS-N1), and when any file but the Grown-up area
 * stack (`navigation/grown-up-stack.native.tsx`) imports Clerk's host or token cache (`platform/clerk*`).
 */

const APP_ROOT = join(__dirname, '..', '..', '..', '..');
const SRC = join(APP_ROOT, 'src');

function sources(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : sources(path);
    return /\.(tsx?|jsx?|mjs|cjs)$/.test(name) ? [path] : [];
  });
}

const rel = (file: string): string => relative(APP_ROOT, file).split(sep).join('/');

/** Module specifiers of `import … from`, `export … from`, `import(…)`, `require(…)` and side-effect imports. */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;

/** Forbidden packages, by name. */
const FORBIDDEN_PACKAGES: readonly RegExp[] = [/^expo-web-browser(\/|$)/, /^react-native-webview(\/|$)/, /^expo-auth-session(\/|$)/, /^expo-linking(\/|$)/];
/** Forbidden app modules, by their path under `src/` once resolved (any platform twin). */
const FORBIDDEN_FILES = /^src\/(platform\/billing-handoff|platform\/external-link|logic\/paywall)(\.(native|web))?\.tsx?$/;

/** Clerk's sign-up (the hook, the component and the `signUp` resource) and every redirect-based or third-party sign-in. */
const FORBIDDEN_CLERK =
  /\b(useSignUp|SignUp|SignUpButton|useOAuth|useSSO|useSignInWithApple|useLocalCredentials|AuthenticateWithRedirectCallback|SignInWithMetamaskButton|useEmailLink|authenticateWithRedirect|authenticateWithWeb3|createEmailLinkFlow)\b|\.signUp\b|['"`](oauth_|enterprise_sso|saml|web3_|email_link|passkey)/;
const FORBIDDEN_STRINGS = ['APP_ROUTES.billing', '/api/entitlements/stripe', '/api/billing/receipt'];
/** `Linking` from react-native: named in an import, or read off the module (`RN.Linking`, `require('react-native').Linking`). */
const RN_LINKING = /import\s*(?:type\s*)?\{[^}]*\bLinking\b[^}]*\}\s*from\s*['"]react-native['"]|\.Linking\b/;

/** A relative specifier resolved the way the native build does (a `.native` twin first), as `src/...`; else null. */
function resolveNative(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), specifier);
  for (const candidate of [`${base}.native.tsx`, `${base}.native.ts`, `${base}.tsx`, `${base}.ts`, join(base, 'index.native.ts'), join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** The forbidden modules `source` imports (at `file`, an absolute path): packages by name, app modules once resolved. */
function moduleHits(file: string, source: string): string[] {
  const hits: string[] = [];
  for (const match of source.matchAll(SPECIFIER)) {
    const spec = match[1] ?? '';
    const target = resolveNative(file, spec);
    if (FORBIDDEN_PACKAGES.some((re) => re.test(spec)) || (target !== null && FORBIDDEN_FILES.test(rel(target)))) hits.push(`${rel(file)}: imports ${spec}`);
  }
  return hits;
}

function guardHits(file: string, source: string): string[] {
  const hits: string[] = moduleHits(join(APP_ROOT, file), source);
  if (RN_LINKING.test(source)) hits.push(`${file}: imports Linking from react-native`);
  const clerk = FORBIDDEN_CLERK.exec(source);
  if (clerk !== null) hits.push(`${file}: names ${clerk[1]}`);
  for (const text of FORBIDDEN_STRINGS) if (source.includes(text)) hits.push(`${file}: contains ${text}`);
  return hits;
}

const ACCOUNT_DIRS = [join(SRC, 'screens', 'account'), join(SRC, 'logic', 'account')];
const CLERK_FILE = /^src\/platform\/clerk[^/]*\.native\.tsx?$/;

function guardedFiles(): string[] {
  const clerk = readdirSync(join(SRC, 'platform'))
    .map((name) => join(SRC, 'platform', name))
    .filter((path) => CLERK_FILE.test(rel(path)));
  return [...ACCOUNT_DIRS.flatMap(sources), ...clerk];
}

/** May import `@clerk/clerk-expo`: the account screens' native files and Clerk's own native files (section 9.3). */
function clerkAllowed(file: string): boolean {
  const path = rel(file);
  return /^src\/screens\/account\/.*\.native\.tsx?$/.test(path) || CLERK_FILE.test(path);
}

/** Every app file the guarded files reach through their imports (native resolution), the guarded files included. */
function reached(files: readonly string[]): string[] {
  const seen = new Set<string>();
  const queue = [...files];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
      const target = resolveNative(file, match[1] ?? '');
      if (target !== null && target.startsWith(SRC)) queue.push(target);
    }
  }
  return [...seen];
}

describe('section 9.3: the account folders import no purchase, link, web view, sign-up or OAuth path', () => {
  it('scans the account folders and Clerk’s native files', () => {
    const files = guardedFiles().map(rel);
    expect(files).toContain('src/logic/account/api.ts');
    expect(files).toContain('src/logic/account/deny-list.ts');
    expect(files).toContain('src/platform/clerk.native.tsx');
    expect(files).toContain('src/platform/clerk-token-cache.native.ts');
  });

  it('none of them has a forbidden import, hook or string', () => {
    const hits = guardedFiles().flatMap((file) => guardHits(rel(file), readFileSync(file, 'utf8')));
    expect(hits, hits.join('\n')).toEqual([]);
  });

  it('nothing they reach through their imports imports a forbidden module either', () => {
    const files = reached(guardedFiles());
    expect(files.map(rel)).toContain('src/logic/shell/device-gate.ts');
    const hits = files.flatMap((file) => moduleHits(file, readFileSync(file, 'utf8')));
    expect(hits, hits.join('\n')).toEqual([]);
  });

  it('only the Grown-up area stack imports Clerk’s host and token cache (platform/clerk*)', () => {
    const files = [join(APP_ROOT, 'App.tsx'), join(APP_ROOT, 'index.ts'), ...sources(SRC)].filter(existsSync);
    const importers = files
      .filter((file) => !/^src\/platform\/clerk[^/]*\.tsx?$/.test(rel(file)))
      .filter((file) => [...readFileSync(file, 'utf8').matchAll(SPECIFIER)].some((m) => /(^|\/)platform\/clerk(-token-cache)?(\.native)?$/.test(m[1] ?? '')));
    expect(importers.map(rel)).toEqual(['src/navigation/grown-up-stack.native.tsx']);
  });

  it('only the account screens and platform/clerk*.native.* import @clerk/clerk-expo', () => {
    const files = [join(APP_ROOT, 'App.tsx'), join(APP_ROOT, 'index.ts'), join(APP_ROOT, 'BrowseApp.tsx'), join(APP_ROOT, 'PresenterApp.tsx'), ...sources(SRC)].filter(existsSync);
    const importers = files.filter((file) => [...readFileSync(file, 'utf8').matchAll(SPECIFIER)].some((m) => /^@clerk\/clerk-expo(\/|$)/.test(m[1] ?? '')));
    expect(importers.map(rel).sort()).toEqual([
      'src/platform/clerk.native.tsx',
      // Row NS-3: the account card's Clerk part (`useAuth`, `useUser`) and the sign-in screen (`useSignIn`, `useAuth`).
      'src/screens/account/AccountCardClerk.native.tsx',
      'src/screens/account/SignInScreen.native.tsx',
    ]);
    expect(importers.every(clerkAllowed)).toBe(true);
  });

  /** Static imports only (`import … from`, `export … from`, side-effect imports): what loads with a module, at once. */
  const STATIC_IMPORT = /^\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/gm;

  /** Every package a module loads at once with `entry`, following its static imports (native resolution). */
  function staticPackages(entry: string): Map<string, string> {
    const packages = new Map<string, string>();
    const seen = new Set<string>();
    const queue = [entry];
    while (queue.length > 0) {
      const file = queue.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const match of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
        if (/^\s*(import|export)\s+type\s/.test(match[0])) continue;
        const spec = match[1] ?? '';
        if (!spec.startsWith('.')) {
          if (!packages.has(spec)) packages.set(spec, rel(file));
          continue;
        }
        const target = resolveNative(file, spec);
        if (target !== null && target.startsWith(SRC)) queue.push(target);
      }
    }
    return packages;
  }

  it('ND-11, CS-N13 (row NS-3): Clerk’s Expo SDK never loads with the app, the Grown-up area or the dashboard: only lazily, under its provider', () => {
    for (const entry of [
      join(APP_ROOT, 'App.tsx'),
      join(SRC, 'navigation', 'root.tsx'),
      join(SRC, 'navigation', 'grown-up-stack.native.tsx'),
      join(SRC, 'screens', 'parent', 'ParentDashboardScreen.tsx'),
      join(SRC, 'screens', 'account', 'AccountCard.native.tsx'),
      join(SRC, 'screens', 'account', 'AccountCardBody.native.tsx'),
    ]) {
      const hits = [...staticPackages(entry)].filter(([name]) => /^(@clerk\/|expo-web-browser|expo-auth-session)/.test(name)).map(([name, from]) => `${from}: ${name}`);
      expect(hits, `${rel(entry)}\n${hits.join('\n')}`).toEqual([]);
    }
    // The walk sees it where it is imported.
    expect([...staticPackages(join(SRC, 'screens', 'account', 'SignInScreen.native.tsx')).keys()]).toContain('@clerk/clerk-expo');
    // The two modules that do import it are reached only by a require at the moment they are drawn.
    expect(readFileSync(join(SRC, 'navigation', 'grown-up-stack.native.tsx'), 'utf8')).toMatch(/getComponent=\{loadSignInScreen\}/);
    expect(readFileSync(join(SRC, 'screens', 'account', 'AccountCard.native.tsx'), 'utf8')).toMatch(/lazy\(\(\) => import\('\.\/AccountCardClerk\.native'\)/);
  });

  it('the guard sees every forbidden form', () => {
    const lines = [
      "import { openBilling } from '../../platform/billing-handoff';",
      "import { openExternal } from '../../platform/external-link.web';",
      "import { paywallState } from '../../logic/paywall';",
      "import * as WebBrowser from 'expo-web-browser';",
      "import { WebView } from 'react-native-webview';",
      "const s = await import('expo-auth-session');",
      "import { Linking } from 'react-native';",
      "import { View, Linking as L, Text } from 'react-native';",
      "void RN.Linking.openURL(url);",
      "const L = require('react-native').Linking;",
      "import * as ExpoLinking from 'expo-linking';",
      "import { paywallState } from '../paywall';",
      "import { useSignUp } from '@clerk/clerk-expo';",
      'await clerk.client.signUp.create({ emailAddress });',
      "await signIn.authenticateWithRedirect({ strategy: 'oauth_google' });",
      "signIn.create({ strategy: 'email_link' });",
      "signIn.create({ strategy: 'passkey' });",
      "const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });",
      "const { startSSOFlow } = useSSO();",
      'const to = APP_ROUTES.billing;',
      "fetch('/api/entitlements/stripe/checkout');",
      "fetch('/api/billing/receipts');",
    ];
    for (const line of lines) expect(guardHits('src/logic/account/x.ts', line), line).not.toEqual([]);
    for (const line of [
      "import { useSignIn } from '@clerk/clerk-expo';",
      "import { View, Text } from 'react-native';",
      "fetch('/api/billing/summary?view=status');",
      "import { formatDate } from '@hangul-route/i18n';",
      "import { orderSpaces } from './order';",
      '// No OAuth flow, no passkey, no email link is set up.',
    ]) {
      expect(guardHits('src/logic/account/x.ts', line), line).toEqual([]);
    }
  });
});
