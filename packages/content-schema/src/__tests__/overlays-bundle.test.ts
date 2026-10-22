import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as barrel from '../index';
import { installContentOverlay, OVERLAYS } from '../../overlays';
import { OVERLAYS_ES } from '../../overlays-es';
import { OVERLAYS_KO } from '../../overlays-ko';
import * as webTwin from '../overlay-tables.web';
import { OVERLAYS as GENERATED } from '../i18n-overlays.generated';

/**
 * F-I18N-001 §10 open item (2): the generated es / ko content overlays sit behind the
 * `@hangul-route/content-schema/overlays` subpath, never in the package barrel, so a
 * consumer that never translates content (the site, the Worker) does not bundle every
 * Spanish and Korean string. The learner app imports the subpath and passes it to
 * `localize`, which has no default for that reason.
 *
 * Size budget: the overlays grow with every content translation PR (about 86 KB for both
 * locales before the story text; the stories add about 3,500 scene, check and note fields).
 * A fully translated catalogue is estimated at about 650 KB of JSON per locale, so each
 * locale may hold up to 1 MiB and the generated module up to 2.25 MiB. Past that, split the
 * module per locale and load the viewer's locale on demand instead of raising the budget.
 * The learner PWA already does that for its start bundle: it reads the one-locale modules
 * (`overlays-es`, `overlays-ko`) as a precached chunk per locale (F-CURR-002 §10).
 */
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE = resolve(SRC, '..');
const GENERATED_FILE = join(SRC, 'i18n-overlays.generated.ts');
const localeFile = (locale: 'es' | 'ko'): string => join(SRC, `i18n-overlays-${locale}.generated.ts`);

const LOCALE_BUDGET_BYTES = 1024 * 1024;
const MODULE_BUDGET_BYTES = 2.25 * 1024 * 1024;

const SELF_OVERLAYS = '@hangul-route/content-schema/overlays';

/**
 * The module specifiers a file loads at run time, read from the TypeScript syntax tree (not a
 * regex, which can run across statements): value `import` / `export ... from`, side-effect
 * imports, dynamic `import()` and `require()`. Type-only imports and exports are left out,
 * since the compiler erases them, and so is an import whose named bindings are all `type`.
 */
function valueSpecifiers(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const allTypes =
        clause !== undefined &&
        clause.name === undefined &&
        bindings !== undefined &&
        ts.isNamedImports(bindings) &&
        bindings.elements.length > 0 &&
        bindings.elements.every((element) => element.isTypeOnly);
      if (clause?.isTypeOnly !== true && !allTypes) out.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!node.isTypeOnly) out.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const loads = callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === 'require');
      const [first] = node.arguments;
      if (loads && first !== undefined && ts.isStringLiteralLike(first)) out.push(first.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/**
 * Every source file the module reaches through relative value imports, and every non-relative
 * specifier those files load (so a self-reference to the overlays subpath is caught too).
 */
function valueGraph(entry: string): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);
    for (const spec of valueSpecifiers(file)) {
      if (!spec.startsWith('.')) {
        packages.add(spec);
        continue;
      }
      const base = resolve(dirname(file), spec);
      const next = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), base].find((candidate) => {
        try {
          return statSync(candidate).isFile();
        } catch {
          return false;
        }
      });
      if (next !== undefined) queue.push(next);
    }
  }
  return { files, packages };
}

describe('content overlays stay out of the package barrel (F-I18N-001 open item 2)', () => {
  it('the barrel exports no OVERLAYS value', () => {
    expect('OVERLAYS' in barrel).toBe(false);
    expect(typeof barrel.localize).toBe('function');
  });

  it('nothing the barrel reaches imports the generated overlays', () => {
    const { files, packages } = valueGraph(join(SRC, 'index.ts'));
    expect(files.size).toBeGreaterThan(20);
    expect(files.has(join(SRC, 'localize.ts'))).toBe(true);
    expect(files.has(GENERATED_FILE)).toBe(false);
    expect([...packages].filter((spec) => spec.startsWith('@hangul-route/content-schema'))).toEqual([]);
  });

  it('the overlays subpath serves the generated overlays, both locales', () => {
    const manifest = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf8')) as { exports: Record<string, string> };
    expect(manifest.exports[SELF_OVERLAYS.replace('@hangul-route/content-schema', '.')]).toBe('./overlays.ts');
    expect(valueGraph(join(PACKAGE, 'overlays.ts')).files.has(GENERATED_FILE)).toBe(true);
    expect(OVERLAYS).toBe(GENERATED);
    expect(Object.keys(OVERLAYS).sort()).toEqual(['es', 'ko']);
  });

  it('the one-locale subpaths serve each table on its own, for the learner PWA\'s locale chunks (F-CURR-002 §10)', () => {
    const manifest = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf8')) as { exports: Record<string, string> };
    expect(OVERLAYS_ES).toEqual(GENERATED.es);
    expect(OVERLAYS_KO).toEqual(GENERATED.ko);
    for (const [locale, other] of [
      ['es', 'ko'],
      ['ko', 'es'],
    ] as const) {
      expect(manifest.exports[`./overlays-${locale}`]).toBe(`./overlays-${locale}.ts`);
      const { files } = valueGraph(join(PACKAGE, `overlays-${locale}.ts`));
      expect(files.has(localeFile(locale))).toBe(true);
      expect(files.has(localeFile(other))).toBe(false);
      expect(files.has(GENERATED_FILE)).toBe(false);
    }
  });

  it('the web twin sits behind a relative import, not on the subpath file, so it holds with or without `exports`', () => {
    // Metro uses an `exports` target as written (no platform extension) but always tries `.web.ts` on a relative import.
    expect(statSync(join(PACKAGE, 'overlays.web.ts'), { throwIfNoEntry: false })).toBeUndefined();
    expect(valueSpecifiers(join(PACKAGE, 'overlays.ts'))).toEqual(['./src/overlay-tables']);
    expect(statSync(join(SRC, 'overlay-tables.web.ts')).isFile()).toBe(true);
  });

  it('the web twin of the overlay tables starts empty and holds what is installed; the eager one keeps its text', () => {
    const { files } = valueGraph(join(SRC, 'overlay-tables.web.ts'));
    expect([...files].filter((file) => file.endsWith('.generated.ts'))).toEqual([]);
    expect(webTwin.OVERLAYS).toEqual({ es: {}, ko: {} });
    webTwin.installContentOverlay('ko', { 'card:test': { title: '시험' } });
    expect(webTwin.OVERLAYS).toEqual({ es: {}, ko: { 'card:test': { title: '시험' } } });
    const before = JSON.stringify(OVERLAYS);
    installContentOverlay('es', OVERLAYS_ES);
    expect(JSON.stringify(OVERLAYS)).toBe(before);
  });

  it('the scanner follows value imports and skips type-only ones (self-check on the package)', () => {
    const { files } = valueGraph(join(SRC, 'localize.ts'));
    expect(files.has(join(SRC, 'schemas', 'locale-overlay.ts'))).toBe(true);
    expect(files.has(join(SRC, 'schemas', 'locale.ts'))).toBe(false);
  });

  it('the scanner does not let a type declaration hide a later value import (self-check on fixtures)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'overlays-bundle-'));
    try {
      const write = (name: string, text: string): string => {
        const path = join(dir, name);
        writeFileSync(path, text);
        return path;
      };
      for (const leaf of ['gen', 'lazy', 'required', 'side', 'reexported', 'typeonly', 'typenamed']) {
        write(`${leaf}.ts`, 'export const X = 1;\n');
      }
      const entry = write(
        'entry.ts',
        [
          "export type Foo = { a: string; b: 'x' };",
          "import { X } from './gen';",
          "import type { X as T } from './typeonly';",
          "import { type X as U } from './typenamed';",
          "import './side';",
          "export { X as Y } from './reexported';",
          "export const lazy = () => import('./lazy');",
          "export const required = require('./required');",
          `import { OVERLAYS } from '${SELF_OVERLAYS}';`,
          'export const all = [X, OVERLAYS];',
          'export type Both = T | U;',
        ].join('\n'),
      );
      const { files, packages } = valueGraph(entry);
      const reached = [...files].map((file) => file.slice(dir.length + 1)).sort();
      expect(reached).toEqual(['entry.ts', 'gen.ts', 'lazy.ts', 'reexported.ts', 'required.ts', 'side.ts']);
      expect([...packages]).toEqual([SELF_OVERLAYS]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('content overlays size budget', () => {
  for (const locale of ['es', 'ko'] as const) {
    it(`${locale} stays within ${LOCALE_BUDGET_BYTES / 1024} KiB of JSON`, () => {
      const bytes = Buffer.byteLength(JSON.stringify(OVERLAYS[locale]), 'utf8');
      expect(bytes).toBeLessThanOrEqual(LOCALE_BUDGET_BYTES);
    });
  }

  it(`the generated module stays within ${MODULE_BUDGET_BYTES / 1024} KiB`, () => {
    expect(statSync(GENERATED_FILE).size).toBeLessThanOrEqual(MODULE_BUDGET_BYTES);
  });

  for (const locale of ['es', 'ko'] as const) {
    it(`the ${locale} module (the learner PWA's ${locale} chunk) stays within ${LOCALE_BUDGET_BYTES / 1024} KiB plus its header`, () => {
      expect(statSync(localeFile(locale)).size).toBeLessThanOrEqual(LOCALE_BUDGET_BYTES + 4096);
    });
  }
});
