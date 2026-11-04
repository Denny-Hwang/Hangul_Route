// F-CURR-002 §10 (start bundle): the app's modules import React's hooks and types by name.
//
// Babel (babel-preset-expo) compiles a default import beside named ones (`import React, { useState } from 'react'`) and a
// namespace import (`import * as React from 'react'`, `import * as Crypto from 'expo-crypto'`) into CommonJS through its
// wildcard interop helper, which it inlines into every such module, about 460 B each in the release web bundle. JSX needs no React in scope: the preset compiles it with the automatic runtime
// (and the design system's and the render lane's vitest configs do the same). Importing by name took the helper out of
// 142 of the 153 first-party start-bundle modules that carried it, 69,890 B raw (release `build:web`, the
// PRECACHE_BUDGET.startBundleRaw note in pwa/lesson-chunks.mjs). This keeps it out: the app's sources (apps/mobile and the
// workspace packages it bundles) import from 'react' by name only (`import { useState } from 'react'`,
// `import type { ReactNode } from 'react'`), import react-native-svg's root as the named `Svg`, and import any package by
// name rather than through `import * as`. A lone `import React from 'react'` compiles to the smaller default helper
// (`_interopRequireDefault`), not the wildcard one; it is banned as house policy, because JSX does not need it either.
// Left out: react-native-reanimated, whose animated components (`Animated.View`) are reached through its default export
// only, and the two namespace reads in NAMESPACE_ALLOWED. Tests and test support are not bundled and are not checked.
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

/**
 * Modules an app source may still read through `import * as`:
 * - the generated story shelf (`content/story-shelf.ts`, native and tests only: the web build reads `story-shelf.web.ts`),
 *   whose optional exports (the e2e build's) are read off the namespace;
 * - expo-speech (`platform/audio.ts`, native only), handed whole to the audio adapter as its `NativeSpeechApi` port.
 */
const NAMESPACE_ALLOWED = new Set(['./__generated__/stories-shelf', 'expo-speech']);

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

/**
 * The import statements of a source text that the rule above bans: those that compile to Babel's wildcard interop helper
 * (a namespace import, a default import beside named value imports), plus a lone default `React` import (house policy).
 */
export function wildcardImports(text) {
  const found = [];
  for (const match of text.matchAll(IMPORT)) {
    const clause = match[1].trim();
    const from = match[2];
    const statement = match[0].replace(/\s+/g, ' ');
    if (/^\*\s+as\s/.test(clause)) {
      if (from === 'react' || !NAMESPACE_ALLOWED.has(from)) found.push(statement);
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
  it('flags the default React import, any namespace import and a default beside named value imports', () => {
    expect(wildcardImports("import React from 'react';")).toHaveLength(1);
    expect(wildcardImports("import React, { useState } from 'react';")).toHaveLength(1);
    expect(wildcardImports("import React, {\n  useEffect,\n  useState,\n} from 'react';")).toHaveLength(1);
    expect(wildcardImports("import * as React from 'react';")).toHaveLength(1);
    expect(wildcardImports("import Svg, { Path } from 'react-native-svg';")).toHaveLength(1);
    expect(wildcardImports("import * as Crypto from 'expo-crypto';")).toHaveLength(1);
    expect(wildcardImports("import * as helpers from './helpers';")).toHaveLength(1);
  });

  it('allows named and type imports, a lone default of another package, type-only extras, reanimated and the allowlist', () => {
    expect(wildcardImports("import { useState } from 'react';")).toEqual([]);
    expect(wildcardImports("import type { ReactNode } from 'react';")).toEqual([]);
    expect(wildcardImports("import type React from 'react';")).toEqual([]);
    expect(wildcardImports("import { Svg, Path } from 'react-native-svg';")).toEqual([]);
    expect(wildcardImports("import Svg from 'react-native-svg';")).toEqual([]);
    expect(wildcardImports("import Svg, { type SvgProps } from 'react-native-svg';")).toEqual([]);
    expect(wildcardImports("import Animated, { useSharedValue } from 'react-native-reanimated';")).toEqual([]);
    expect(wildcardImports("import type * as Types from 'expo-crypto';")).toEqual([]);
    expect(wildcardImports("import * as generated from './__generated__/stories-shelf';")).toEqual([]);
    expect(wildcardImports("import * as Speech from 'expo-speech';")).toEqual([]);
  });

  it('no app source imports React by default, any package (bar reanimated) by default beside named values, or through `import * as`', () => {
    const files = ROOTS.flatMap((root) => sourceFiles(root));
    expect(files.length).toBeGreaterThan(300);
    const offenders = files.flatMap((file) =>
      wildcardImports(readFileSync(file, 'utf8')).map((statement) => `${relative(REPO, file)}: ${statement}`),
    );
    expect(offenders).toEqual([]);
  });
});
