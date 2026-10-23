// F-CURR-002 §10 (start bundle): the app's modules import React's hooks and types by name.
//
// Babel (babel-preset-expo) compiles `import React, { useState } from 'react'` (a default import beside named ones) and
// `import * as React from 'react'` into CommonJS through an interop helper that it inlines into every such module, about
// 460 B each in the release web bundle. JSX needs no React in scope: the preset compiles it with the automatic runtime
// (and the design system's and the render lane's vitest configs do the same). Importing by name took the helper out of
// 142 of the 153 first-party start-bundle modules that carried it, 69,890 B raw (release `build:web`, the
// PRECACHE_BUDGET.startBundleRaw note in pwa/lesson-chunks.mjs). This keeps it out: the app's sources (apps/mobile and the
// workspace packages it bundles) import from 'react' by name only (`import { useState } from 'react'`,
// `import type { ReactNode } from 'react'`; a lone `import React from 'react'` is not needed for JSX either), and
// import react-native-svg's root as the named `Svg`.
// react-native-reanimated is the one package left out: its animated components (`Animated.View`) are reached through
// its default export only. Tests and test support are not bundled and are not checked.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO = join(MOBILE, '..', '..');

/** The app's own sources and the workspace packages it bundles. */
const ROOTS = [
  join(MOBILE, 'src'),
  join(MOBILE, 'App.tsx'),
  join(MOBILE, 'BrowseApp.tsx'),
  join(MOBILE, 'PresenterApp.tsx'),
  join(MOBILE, 'index.ts'),
  join(REPO, 'packages', 'design-system', 'src'),
  join(REPO, 'packages', 'i18n', 'src'),
  join(REPO, 'packages', 'content-schema', 'src'),
  join(REPO, 'packages', 'shared-types', 'src'),
];

/** Packages whose default export may sit beside named imports. */
const DEFAULT_WITH_NAMED_ALLOWED = new Set(['react-native-reanimated']);

const isTestPath = (path) => /(^|\/)(__tests__|test-support)(\/|$)|\.test\.[cm]?[jt]sx?$/.test(path);

function sourceFiles(path, out = []) {
  if (statSync(path).isDirectory()) {
    for (const name of readdirSync(path)) {
      if (name === 'node_modules') continue;
      sourceFiles(join(path, name), out);
    }
  } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(path) && !isTestPath(relative(REPO, path))) {
    out.push(path);
  }
  return out;
}

const IMPORT = /^import\s+(?!type\s)([^'";]*?)\s+from\s+['"]([^'"]+)['"]/gm;

/** The import statements of a source text that compile to Babel's wildcard interop helper (see above). */
export function wildcardImports(text) {
  const found = [];
  for (const match of text.matchAll(IMPORT)) {
    const clause = match[1].trim();
    const from = match[2];
    const statement = match[0].replace(/\s+/g, ' ');
    if (from === 'react' && /^\*\s+as\s/.test(clause)) {
      found.push(statement);
      continue;
    }
    const mixed = /^([A-Za-z_$][\w$]*)\s*,\s*\{([^}]*)\}$/.exec(clause);
    const defaultOnly = /^[A-Za-z_$][\w$]*$/.test(clause);
    if (from === 'react' && (mixed || defaultOnly)) {
      found.push(statement);
      continue;
    }
    if (mixed && !DEFAULT_WITH_NAMED_ALLOWED.has(from)) {
      // Named bindings that are all `type` are erased, so the default import stands alone (no wildcard helper).
      const values = mixed[2]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith('type '));
      if (values.length) found.push(statement);
    }
  }
  return found;
}

describe('the app imports React by name (no wildcard interop helper per module)', () => {
  it('flags the default and namespace React imports and a default beside named value imports', () => {
    expect(wildcardImports("import React from 'react';")).toHaveLength(1);
    expect(wildcardImports("import React, { useState } from 'react';")).toHaveLength(1);
    expect(wildcardImports("import React, {\n  useEffect,\n  useState,\n} from 'react';")).toHaveLength(1);
    expect(wildcardImports("import * as React from 'react';")).toHaveLength(1);
    expect(wildcardImports("import Svg, { Path } from 'react-native-svg';")).toHaveLength(1);
  });

  it('allows named and type imports, a lone default of another package, type-only extras and reanimated', () => {
    expect(wildcardImports("import { useState } from 'react';")).toEqual([]);
    expect(wildcardImports("import type { ReactNode } from 'react';")).toEqual([]);
    expect(wildcardImports("import type React from 'react';")).toEqual([]);
    expect(wildcardImports("import { Svg, Path } from 'react-native-svg';")).toEqual([]);
    expect(wildcardImports("import Svg from 'react-native-svg';")).toEqual([]);
    expect(wildcardImports("import Svg, { type SvgProps } from 'react-native-svg';")).toEqual([]);
    expect(wildcardImports("import Animated, { useSharedValue } from 'react-native-reanimated';")).toEqual([]);
    expect(wildcardImports("import * as Crypto from 'expo-crypto';")).toEqual([]);
  });

  it('no app source imports React (or react-native-svg) through a default beside named imports', () => {
    const files = ROOTS.flatMap((root) => sourceFiles(root));
    expect(files.length).toBeGreaterThan(300);
    const offenders = files.flatMap((file) =>
      wildcardImports(readFileSync(file, 'utf8')).map((statement) => `${relative(REPO, file)}: ${statement}`),
    );
    expect(offenders).toEqual([]);
  });
});
