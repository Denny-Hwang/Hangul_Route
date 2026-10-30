import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from '../../../scripts/audio/content-sources.mjs';
import { jamoConsonants, jamoVowels } from '../jamo';

/**
 * `content/episodes/stage-1/jamo.json` repeats fields of the app's letter records in
 * `src/content/jamo.ts` (AMENDMENTS-AUDIO-CLIPS M9). The app reads only its gloss (`en`, the
 * `stage1-jamo` overlay's `gloss`); the story importer reads `ko`, `romanization` and `kind`; the
 * Discover example word and its overlay gloss come from `jamo.ts`. Two sources drift, so the shared
 * fields must agree: the same 24 letters in the same order, the same letter, kind and order, the
 * romanization written as the sound value plus the letter name for a consonant ("g/k (giyeok)"),
 * and the same example word and romanization. No speech reads this file.
 */

interface JsonJamo {
  id: string;
  ko: string;
  romanization: string;
  en: string;
  kind: string;
  order: number;
  exampleWord?: { ko: string; romanization: string; en: string };
}

const json = JSON.parse(readFileSync(join(repoRoot, 'content/episodes/stage-1/jamo.json'), 'utf8')) as JsonJamo[];
const app = [...jamoConsonants, ...jamoVowels];

describe('content/episodes/stage-1/jamo.json agrees with src/content/jamo.ts (M9)', () => {
  it('holds the same 24 letters, in the same order', () => {
    expect(json.map((j) => j.id)).toEqual(app.map((j) => j.id));
  });

  it.each(app.map((j) => [j.id, j] as const))('%s: letter, kind, order and romanization agree', (id, record) => {
    const entry = json.find((j) => j.id === id)!;
    expect(entry.ko).toBe(record.char);
    expect(entry.kind).toBe(record.kind);
    expect(entry.order).toBe(record.order);
    expect(entry.romanization).toBe(record.kind === 'consonant' ? `${record.romanization} (${record.nameEn})` : record.romanization);
  });

  it.each(app.map((j) => [j.id, j] as const))('%s: the example word and its romanization agree (its gloss is the file\'s own)', (id, record) => {
    const entry = json.find((j) => j.id === id)!;
    expect(entry.exampleWord?.ko).toBe(record.exampleWordKo);
    expect(entry.exampleWord?.romanization).toBe(record.exampleWordRomanization);
    expect(entry.exampleWord?.en.trim()).not.toBe('');
  });
});
