/**
 * Source-scan helper for the pure entries of the design system (F-VOC-002
 * §3.9): `card-ids.ts` and everything under `src/word-art/` must load in node
 * without React, react-native or react-native-svg. A file is impure when any
 * module specifier (static `from`, side-effect `import '...'`, dynamic
 * `import(...)`, `require(...)` or `export ... from`) names:
 *
 * - `react`, `react-native`, `react-native-svg`, `react-native-web` or a
 *   subpath of one (`react/jsx-runtime`, `react-native-svg/lib/...`);
 * - the package root, which re-exports every component
 *   (`@hangul-route/design-system`, but not its pure `/word-art` entry), or a
 *   relative barrel (`'.'`, `'..'`, `'../index'`, `'../../index'`);
 * - a component (`.../components/...`).
 */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;

const IMPURE: readonly RegExp[] = [
  /^react(?:-native(?:-svg|-web)?)?(?:\/.*)?$/,
  /^@hangul-route\/design-system(?:\/(?!word-art(?:\/|$)).*)?$/,
  /^(?:\.\.?\/)*\.\.?(?:\/index(?:\.[jt]sx?)?)?$/,
  /(?:^|\/)components(?:\/|$)/,
];

/** The module specifiers in `source` that a pure module may not import. */
export function impureImports(source: string): string[] {
  return [...source.matchAll(SPECIFIER)]
    .map((match) => match[1]!)
    .filter((specifier) => IMPURE.some((pattern) => pattern.test(specifier)));
}

/** Source files the scan covers: TypeScript and JavaScript, plain or JSX, CommonJS or ES module. */
export const SCANNED_SOURCE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
