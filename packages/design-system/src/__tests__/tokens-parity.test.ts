import { describe, expect, it } from 'vitest';
import colorsDoc from '../../../../design/tokens/colors.v1.md?raw';
import { colors } from '../tokens';

/**
 * design/tokens/colors.v1.md is the design source of truth (CLAUDE.md §5).
 * The CI drift check (scripts/check-token-drift.mjs) only proves the
 * `colors` export exists; this pins every value so a palette change has to
 * land in both places in the same PR.
 */
function documented(): Map<string, string> {
  const rows = new Map<string, string>();
  for (const m of colorsDoc.matchAll(/^\|\s*`([a-zA-Z]+\.[a-zA-Z0-9]+)`\s*\|\s*([^|]+?)\s*\|/gm)) {
    rows.set(m[1]!, m[2]!.trim());
  }
  return rows;
}

function implemented(): Map<string, string> {
  const rows = new Map<string, string>();
  for (const [group, values] of Object.entries(colors)) {
    for (const [key, value] of Object.entries(values as Record<string, string>)) {
      rows.set(`${group}.${key}`, value);
    }
  }
  return rows;
}

const norm = (v: string): string => v.replace(/\s+/g, '').toUpperCase();

describe('design/tokens/colors.v1.md ↔ tokens.ts', () => {
  const doc = documented();
  const code = implemented();

  it('documents every color token the package exports', () => {
    expect([...code.keys()].filter((k) => !doc.has(k))).toEqual([]);
  });

  it('exports every color the design doc defines', () => {
    expect([...doc.keys()].filter((k) => !code.has(k))).toEqual([]);
  });

  it('agrees on every value', () => {
    const drift = [...code.entries()]
      .filter(([k, v]) => doc.has(k) && norm(doc.get(k)!) !== norm(v))
      .map(([k, v]) => `${k}: tokens.ts ${v} ≠ design ${doc.get(k)}`);
    expect(drift).toEqual([]);
  });
});
