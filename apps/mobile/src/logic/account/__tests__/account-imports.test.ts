import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F-AUTH-004 section 9.3 (row NS-2; CS-N5, CS-N10): the import guard. Every file under `src/screens/account/**` and
 * `src/logic/account/**` (and Clerk's own native files, `src/platform/clerk*.native.*`) is read, and the test fails
 * on any way to a purchase, a link out, a web view, an account creation or an OAuth flow:
 * - an import of `platform/billing-handoff`, `platform/external-link`, `logic/paywall`, `expo-web-browser`,
 *   `react-native-webview`, or `Linking` from `react-native`;
 * - Clerk's `useSignUp`, `SignUp` or any OAuth, SSO or Apple hook;
 * - the strings `APP_ROUTES.billing`, `/api/entitlements/stripe` and `/api/billing/receipt`.
 * It also fails when any file of the app outside those folders and `platform/clerk*.native.*` imports
 * `@clerk/clerk-expo` (no learner screen ever calls a Clerk hook, CS-N1).
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

const FORBIDDEN_MODULES: readonly RegExp[] = [
  /(^|\/)platform\/billing-handoff(\.[a-z]+)?$/,
  /(^|\/)platform\/external-link(\.[a-z]+)?$/,
  /(^|\/)logic\/paywall(\.[a-z]+)?$/,
  /^expo-web-browser(\/|$)/,
  /^react-native-webview(\/|$)/,
  /^expo-auth-session(\/|$)/,
];

/** Clerk's sign-up and every redirect-based or third-party sign-in. */
const FORBIDDEN_CLERK = /\b(useSignUp|SignUp|SignUpButton|useOAuth|useSSO|useSignInWithApple|useLocalCredentials|AuthenticateWithRedirectCallback|SignInWithMetamaskButton|useEmailLink)\b/;
const FORBIDDEN_STRINGS = ['APP_ROUTES.billing', '/api/entitlements/stripe', '/api/billing/receipt'];
/** `Linking` named in an import from react-native (`import { Linking } from 'react-native'`, any order or alias). */
const RN_LINKING = /import\s*(?:type\s*)?\{[^}]*\bLinking\b[^}]*\}\s*from\s*['"]react-native['"]/;

function guardHits(file: string, source: string): string[] {
  const hits: string[] = [];
  for (const match of source.matchAll(SPECIFIER)) {
    const spec = match[1] ?? '';
    if (FORBIDDEN_MODULES.some((re) => re.test(spec))) hits.push(`${file}: imports ${spec}`);
  }
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

/** May import `@clerk/clerk-expo`: the account screens and Clerk's own native files (section 9.3). */
function clerkAllowed(file: string): boolean {
  const path = rel(file);
  return path.startsWith('src/screens/account/') || CLERK_FILE.test(path);
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

  it('only the account screens and platform/clerk*.native.* import @clerk/clerk-expo', () => {
    const files = [join(APP_ROOT, 'App.tsx'), join(APP_ROOT, 'index.ts'), join(APP_ROOT, 'BrowseApp.tsx'), join(APP_ROOT, 'PresenterApp.tsx'), ...sources(SRC)].filter(existsSync);
    const importers = files.filter((file) => [...readFileSync(file, 'utf8').matchAll(SPECIFIER)].some((m) => /^@clerk\/clerk-expo(\/|$)/.test(m[1] ?? '')));
    expect(importers.map(rel)).toEqual(['src/platform/clerk.native.tsx']);
    expect(importers.every(clerkAllowed)).toBe(true);
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
      "import { useSignUp } from '@clerk/clerk-expo';",
      "const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });",
      "const { startSSOFlow } = useSSO();",
      'const to = APP_ROUTES.billing;',
      "fetch('/api/entitlements/stripe/checkout');",
      "fetch('/api/billing/receipts');",
    ];
    for (const line of lines) expect(guardHits('x.ts', line), line).not.toEqual([]);
    for (const line of [
      "import { useSignIn } from '@clerk/clerk-expo';",
      "import { View, Text } from 'react-native';",
      "fetch('/api/billing/summary?view=status');",
      "import { formatDate } from '@hangul-route/i18n';",
    ]) {
      expect(guardHits('x.ts', line), line).toEqual([]);
    }
  });
});
