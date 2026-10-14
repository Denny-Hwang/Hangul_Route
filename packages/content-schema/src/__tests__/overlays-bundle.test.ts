import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as barrel from '../index';
import { OVERLAYS } from '../../overlays';
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
 */
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE = resolve(SRC, '..');
const GENERATED_FILE = join(SRC, 'i18n-overlays.generated.ts');

const LOCALE_BUDGET_BYTES = 1024 * 1024;
const MODULE_BUDGET_BYTES = 2.25 * 1024 * 1024;

const IMPORT = /^\s*(?:import|export)\s+(type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm;

/** Every source file the module reaches through relative value imports (type-only imports are erased). */
function valueGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      const [, typeOnly, spec] = match;
      if (typeOnly !== undefined || spec === undefined || !spec.startsWith('.')) continue;
      const base = resolve(dirname(file), spec);
      const next = [`${base}.ts`, join(base, 'index.ts'), base].find((candidate) => {
        try {
          return statSync(candidate).isFile();
        } catch {
          return false;
        }
      });
      if (next !== undefined) queue.push(next);
    }
  }
  return seen;
}

describe('content overlays stay out of the package barrel (F-I18N-001 open item 2)', () => {
  it('the barrel exports no OVERLAYS value', () => {
    expect('OVERLAYS' in barrel).toBe(false);
    expect(typeof barrel.localize).toBe('function');
  });

  it('nothing the barrel reaches imports the generated overlays', () => {
    const graph = valueGraph(join(SRC, 'index.ts'));
    expect(graph.size).toBeGreaterThan(20);
    expect(graph.has(join(SRC, 'localize.ts'))).toBe(true);
    expect(graph.has(GENERATED_FILE)).toBe(false);
  });

  it('the overlays subpath serves the generated overlays, both locales', () => {
    const manifest = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf8')) as { exports: Record<string, string> };
    expect(manifest.exports['./overlays']).toBe('./overlays.ts');
    expect(valueGraph(join(PACKAGE, 'overlays.ts')).has(GENERATED_FILE)).toBe(true);
    expect(OVERLAYS).toBe(GENERATED);
    expect(Object.keys(OVERLAYS).sort()).toEqual(['es', 'ko']);
  });

  it('the scanner follows value imports and skips type-only ones (self-check)', () => {
    const graph = valueGraph(join(SRC, 'localize.ts'));
    expect(graph.has(join(SRC, 'schemas', 'locale-overlay.ts'))).toBe(true);
    expect(graph.has(join(SRC, 'schemas', 'locale.ts'))).toBe(false);
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
});
