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
 *
 * The text fields follow the app too (AMENDMENTS-STAGE1-CONTENT-FIXES CF-2, section 3.5, OD-CF7): `en`
 * is the letter's `soundHint` word for word, and the es and ko overlay `gloss` is that overlay's own
 * `soundHint`. The reviewed hints name no voiced English sound-alike and no "between u and i", so the
 * record can no longer say what the app does not.
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

interface OverlayFile {
  entries: Record<string, { soundHint?: string; gloss?: string }>;
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

  it.each(app.map((j) => [j.id, j] as const))('%s: en is the app\'s soundHint (CF-2)', (id, record) => {
    const entry = json.find((j) => j.id === id)!;
    expect(record.soundHint?.trim()).toBeTruthy();
    expect(entry.en).toBe(record.soundHint);
  });

  describe.each(['es', 'ko'])('the %s overlay gloss is its soundHint (CF-2)', (locale) => {
    const overlay = JSON.parse(readFileSync(join(repoRoot, `content/i18n/${locale}/stage1-jamo.json`), 'utf8')) as OverlayFile;

    it.each(app.map((j) => [j.id] as const))('%s', (id) => {
      const entry = overlay.entries[id];
      expect(entry?.soundHint?.trim()).toBeTruthy();
      expect(entry?.gloss).toBe(entry?.soundHint);
    });
  });
});

/**
 * Four hints the CF-2 review found weak (AMENDMENTS-STAGE1-CONTENT-FIXES CF-4). The es hints for the two
 * "yo" vowels said the same thing; the ko hint for ㄹ had no "between r and l" anchor and a clumsy verb; the
 * ko hint for ㅅ defined s by s. The values are pinned, and so is what the review asked of them.
 */
describe('the CF-4 sound hints (es yeo / yo, ko rieul / siot)', () => {
  const read = (locale: string) => JSON.parse(readFileSync(join(repoRoot, `content/i18n/${locale}/stage1-jamo.json`), 'utf8')) as OverlayFile;
  const es = read('es').entries;
  const ko = read('ko').entries;

  it('es: ㅕ sits between «yo» and «ya» with an open mouth; ㅛ is «yo» with round lips; the two differ', () => {
    expect(es['jamo:yeo']?.soundHint).toBe('entre «yo» y «ya», con la boca bien abierta');
    expect(es['jamo:yeo']?.gloss).toBe(es['jamo:yeo']?.soundHint);
    expect(es['jamo:yo']?.soundHint).toBe('como «yo» en «yogur», con los labios redondos');
    expect(es['jamo:yo']?.gloss).toBe(es['jamo:yo']?.soundHint);
    expect(es['jamo:yeo']?.soundHint).not.toBe(es['jamo:yo']?.soundHint);
  });

  it('ko: ㄹ is anchored between r and l, taps once and no longer says "튕겨요"', () => {
    expect(ko['jamo:rieul']?.soundHint).toBe('‘라면’의 첫소리. r과 l 사이 소리예요. 혀끝이 윗잇몸에 한 번 살짝 닿았다 떨어져요.');
    expect(ko['jamo:rieul']?.gloss).toBe(ko['jamo:rieul']?.soundHint);
    expect(ko['jamo:rieul']?.soundHint).not.toContain('튕');
  });

  it('ko: ㅅ says where the air passes instead of defining s by s', () => {
    expect(ko['jamo:siot']?.soundHint).toBe('‘산’의 첫소리. 혀끝과 윗잇몸 사이로 바람을 가볍게 내보내는 s 소리예요.');
    expect(ko['jamo:siot']?.gloss).toBe(ko['jamo:siot']?.soundHint);
  });
});
