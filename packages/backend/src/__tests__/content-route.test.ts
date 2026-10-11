import { checkJamoRomanization, formatRomanizationFinding } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import app from '../index';

// F-CNT-002 PR 3, source class B3: the seed served by src/routes/content.ts holds isolated
// jamo, so each `romanization` is a listed sound value (R7), never an RR word (C6).

interface JamoRow {
  id: string;
  char: string;
  romanization: string;
  kind: string;
}

async function seededJamo(): Promise<JamoRow[]> {
  const res = await app.request('/api/content/jamo');
  expect(res.status).toBe(200);
  const body = (await res.json()) as { data: { jamo: JamoRow[] } };
  return body.data.jamo;
}

describe('content route jamo romanization (B3)', () => {
  it('every seeded jamo value is a listed sound value (R7)', async () => {
    const jamo = await seededJamo();
    expect(jamo.length).toBeGreaterThan(0);
    const found = jamo.flatMap((j) =>
      checkJamoRomanization(j.char, j.romanization).map((i) => formatRomanizationFinding('packages/backend/src/routes/content.ts', undefined, i)),
    );
    expect(found).toEqual([]);
  });

  it('keeps the dual values as taught (g/k, d/t, r/l)', async () => {
    const byChar = new Map((await seededJamo()).map((j) => [j.char, j.romanization]));
    expect(byChar.get('ㄱ')).toBe('g/k');
    expect(byChar.get('ㄷ')).toBe('d/t');
    expect(byChar.get('ㄹ')).toBe('r/l');
  });

  it('a value outside the table would fail R7', () => {
    expect(checkJamoRomanization('ㅇ', '∅/ng')[0]?.rule).toBe('jamo-value-unknown');
  });
});
