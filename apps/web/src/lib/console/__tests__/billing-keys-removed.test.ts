import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMessages, UI_LOCALES } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';

/**
 * F-BILL-002 B-8c (section 6.1, "Deleted in B-8c"): the old billing page's keys are gone from every locale, and no
 * file of the web app reads them any more. Their replacements: `help.learners`, `pastDue`, `done`, `notConfigured`,
 * `includesLines.*`; the rest belonged to the F-ENT-001 page that B-8a replaced.
 */
const REMOVED = [
  'console.billingKidsLine',
  'console.billingPastDue',
  'console.billingSuccess',
  'console.billingNotConfigured',
  'console.billing.includes',
  'console.billing.choose',
  'console.billing.plans',
  'console.billing.current',
  'console.billing.isCurrent',
  'console.billing.source',
  'console.billing.seats',
  'console.billing.yourAccount',
] as const;

function lookup(root: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined), root);
}

const SRC = fileURLToPath(new URL('../../../', import.meta.url));
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && path !== fileURLToPath(import.meta.url) ? [path] : [];
  });
}

describe('old billing keys removed (B-8c)', () => {
  it('no locale carries them', () => {
    for (const locale of UI_LOCALES) {
      const messages = getMessages(locale);
      for (const path of REMOVED) expect(lookup(messages, path), `${locale}: ${path}`).toBeUndefined();
    }
  });

  it('no web source reads them', () => {
    // Top-level keys by name; `billing.*` members as members of `billing` (or the `b` alias pages use), since
    // `includes`, `current` or `source` alone are ordinary words.
    const topLevel = REMOVED.filter((path) => path.split('.').length === 2).map((path) => path.split('.')[1] as string);
    const members = REMOVED.filter((path) => path.startsWith('console.billing.')).map((path) => path.split('.')[2] as string);
    // A string's or an array's own `.includes(` is not the old key (which was an object: `billing.includes.free`).
    const member = members.map((leaf) => (leaf === 'includes' ? 'includes\\b(?!\\()' : `${leaf}\\b`)).join('|');
    const patterns = [new RegExp(`\\b(${topLevel.join('|')})\\b`), new RegExp(`\\b(billing|b)\\.(${member})`)];
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of patterns) expect(pattern.test(text), `${file} reads ${String(pattern)}`).toBe(false);
    }
  });

  it('the old billing page parts are gone', () => {
    expect(sourceFiles(SRC).some((file) => file.endsWith('BillingParts.tsx'))).toBe(false);
  });
});
