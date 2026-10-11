import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CONTENT_SKIPPED_DIRS, REPO_ROOT, contentJsonFiles } from './helpers/romanization-registry';
import { scanContentFiles } from './helpers/romanization-json-scan';

// F-CNT-002 PR 3, source class A: every content/**/*.json (outside the skipped dirs) is
// read from the repo tree, so a bad romanization in shipped JSON fails the build.

const tmpRoots: string[] = [];
afterAll(() => {
  for (const dir of tmpRoots) rmSync(dir, { recursive: true, force: true });
});

/** Writes `files` under a fresh temp root and scans them. */
function scanFixture(files: Record<string, unknown>, exceptions?: Parameters<typeof scanContentFiles>[2]) {
  const root = mkdtempSync(join(tmpdir(), 'romanization-'));
  tmpRoots.push(root);
  for (const [name, body] of Object.entries(files)) {
    const full = join(root, name);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, typeof body === 'string' ? body : JSON.stringify(body, null, 2));
  }
  return scanContentFiles(root, Object.keys(files), exceptions);
}

describe('romanization of the shipped content JSON (class A)', () => {
  const files = contentJsonFiles();
  const result = scanContentFiles(REPO_ROOT, files);

  it('scans the stage 1 files (the list cannot rot)', () => {
    expect(files).toContain('content/episodes/stage-1/cards.json');
    expect(files).toContain('content/episodes/stage-1/jamo.json');
    expect(result.entries.length).toBeGreaterThanOrEqual(48);
  });

  it('every content/**/*.json pair is Revised Romanization, unhyphenated, consistent', () => {
    expect(result.errors).toEqual([]);
  });

  it('skips the same directories as scripts/validate-content.mjs', () => {
    const script = readFileSync(join(REPO_ROOT, 'scripts/validate-content.mjs'), 'utf8');
    const m = /const SKIPPED_DIRS = \[join\(([^)]*)\)\]/.exec(script);
    const dirs = (m?.[1] ?? '').replace(/["'\s]/g, '').split(',').join('/');
    expect(CONTENT_SKIPPED_DIRS).toEqual([dirs]);
    expect(files.some((f) => f.startsWith('content/stories/research/'))).toBe(false);
  });

  it('shows how K-pop and yutnori are said and teaches 유리 for ㅠ', () => {
    const cards = JSON.parse(readFileSync(join(REPO_ROOT, 'content/episodes/stage-1/cards.json'), 'utf8')) as Array<{ id: string; title: string; romanization: string }>;
    expect(cards.find((c) => c.id === 'card:kpop')).toMatchObject({ title: 'K-pop', romanization: 'keipap' });
    expect(cards.find((c) => c.id === 'card:yutnori')?.romanization).toBe('yunnori');
    const jamo = JSON.parse(readFileSync(join(REPO_ROOT, 'content/episodes/stage-1/jamo.json'), 'utf8')) as Array<{ id: string; exampleWord?: unknown }>;
    expect(jamo.find((j) => j.id === 'jamo:yu')?.exampleWord).toEqual({ ko: '유리', romanization: 'yuri', en: 'glass' });
  });
});

describe('romanization content scanner (a bad file would fail)', () => {
  it('reports hyphen and mismatch for 윷놀이 as yut-no-ri, naming file and line', () => {
    const r = scanFixture({
      'content/bad.json': '[\n  {\n    "ko": "윷놀이",\n    "romanization": "yut-no-ri",\n    "en": "Yut game"\n  }\n]',
    });
    expect(r.errors).toEqual([
      '::error file=content/bad.json,line=3::romanization-hyphen: yut-no-ri: remove hyphens → "yutnori"',
      '::error file=content/bad.json,line=3::romanization-mismatch: 윷놀이: given "yut-no-ri", Revised Romanization is "yunnori"',
    ]);
  });

  it('reports one finding for 강아지 as gang-a-ji, and a spacing error for 손 씻기 as sonssitgi', () => {
    const r = scanFixture({
      'content/a.json': [
        { ko: '강아지', romanization: 'gang-a-ji', en: 'puppy' },
        { ko: '손 씻기', romanization: 'sonssitgi', en: 'wash hands' },
      ],
    });
    expect(r.errors.map((e) => e.split('::')[2]?.split(':')[0])).toEqual(['romanization-hyphen', 'romanization-spacing']);
  });

  it('accepts the rr alias, and checks it', () => {
    expect(scanFixture({ 'content/s.json': { items: [{ ko: '세종', rr: 'sejong', en: 'Sejong' }] } }).errors).toEqual([]);
    expect(scanFixture({ 'content/s.json': { items: [{ ko: '세종', rr: 'sejeong', en: 'Sejong' }] } }).errors).toHaveLength(1);
  });

  it('R4: a ko with no or empty romanization is an error in a ready story and a warning in a draft', () => {
    const body = (state: string) => ({ state, steps: [{ ko: '한글', romanization: '', en: 'Hangul' }, { ko: '세종', en: 'Sejong' }] });
    const ready = scanFixture({ 'content/stories/a.json': body('ready') });
    expect(ready.errors).toHaveLength(2);
    expect(ready.errors[0]).toContain('romanization-missing');
    const draft = scanFixture({ 'content/stories/a.json': body('draft') });
    expect(draft.errors).toEqual([]);
    expect(draft.warnings).toHaveLength(2);
    expect(draft.warnings[0]).toContain('::warning file=content/stories/a.json');
  });

  it('R5: the same Korean string spelled two ways in two files fails once, citing both', () => {
    const r = scanFixture({
      'content/a.json': [{ ko: '호랑이', romanization: 'horangi', en: 'tiger' }],
      'content/b.json': [{ ko: '호랑이', romanization: 'horang', en: 'tiger' }],
    });
    const inconsistent = r.errors.filter((e) => e.includes('romanization-inconsistent'));
    expect(inconsistent).toHaveLength(1);
    expect(inconsistent[0]).toContain('content/a.json:');
    expect(inconsistent[0]).toContain('content/b.json:');
  });

  it('R6: prose spelling a registered word with syllable hyphens fails', () => {
    const r = scanFixture({ 'content/a.json': [{ ko: '강아지', romanization: 'gangaji', en: 'puppy', fact: 'A gang-a-ji barks.' }] });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain('romanization-prose');
    expect(r.errors[0]).toContain('line=6');
  });

  it('R7: a jamo record is checked as a sound value plus letter name, not as a word', () => {
    const jamo = (romanization: string) => [{ id: 'jamo:giyeok', ko: 'ㄱ', romanization, en: 'G' }];
    expect(scanFixture({ 'content/j.json': jamo('g/k (giyeok)') }).errors).toEqual([]);
    expect(scanFixture({ 'content/j.json': jamo('g (giyeok)') }).errors[0]).toContain('jamo-value-unknown');
    expect(scanFixture({ 'content/j.json': jamo('g/k (giyeog)') }).errors[0]).toContain('not the standard letter name');
  });

  it('skips a bare isolated jamo outside a jamo record (C6)', () => {
    expect(scanFixture({ 'content/a.json': [{ ko: 'ㄱ', romanization: 'g', en: 'g' }] }).errors).toEqual([]);
  });

  it('R1 exception: an explicit entry with a reason allows a documented converter limit', () => {
    const files = { 'content/a.json': [{ ko: '꽃잎', romanization: 'kkonnip', en: 'petal' }] };
    expect(scanFixture(files).errors).toHaveLength(1);
    expect(scanFixture(files, [{ ko: '꽃잎', allowed: ['kkonnip'], reason: 'n-insertion' }]).errors).toEqual([]);
  });

  it('warns, never fails, when the converter cannot read the Korean', () => {
    const r = scanFixture({ 'content/a.json': [{ ko: 'K팝', romanization: 'kpap', en: 'K-pop' }] });
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]).toContain('romanization-unchecked');
  });

  it('an unreadable or invalid JSON file is a failing finding naming the path', () => {
    const r = scanFixture({ 'content/broken.json': '{ not json' });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain('content/broken.json');
    const missing = scanContentFiles(REPO_ROOT, ['content/does-not-exist.json']);
    expect(missing.errors[0]).toContain('cannot read content/does-not-exist.json');
  });
});
