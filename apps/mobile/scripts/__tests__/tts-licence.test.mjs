// Licence rows for generated clips (AMENDMENTS-AUDIO-CLIPS AC-B1 "Licence rows"; row AC-3): the fixed source
// format, and the validator that every shipped clip has exactly one row whose vendor, engine, voice, rate and date
// match tts-lock.json. On the repository it passes trivially until the first pack ships; the fixtures cover the
// non-empty case.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../../../scripts/third-party-notices.mjs';
import { LOCK_FILE, emptyLock, parseLock, saySha256, sha256Hex, upsertLockRow, withProcessedMp3 } from '../audio/tts/lock-lib.mjs';
import { CLIP_ASSET_DIR, TTS_CATEGORY, TTS_LICENSE, formatTtsSource, licenceRowProblems, parseTtsSource, refOfAssetPath, ttsLicenceRow } from '../audio/tts/licence-rows.mjs';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const READ = '2026-10-29';

function listMp3(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listMp3(p) : name.endsWith('.mp3') ? [p] : [];
  });
}

describe('the source format', () => {
  it('round-trips', () => {
    const parts = { vendor: 'polly', engine: 'neural', voice: 'Seoyeon', rate: 0.85, generated: '2026-11-02', termsUrl: 'https://aws.amazon.com/service-terms/', termsRead: READ };
    const source = formatTtsSource(parts);
    expect(source).toBe('tts:polly/neural/Seoyeon; rate 0.85; generated 2026-11-02; terms https://aws.amazon.com/service-terms/ read 2026-10-29');
    expect(parseTtsSource(source)).toEqual(parts);
    expect(parseTtsSource('tts:google/neural2/ko-KR-Neural2-A; rate 0.9; generated 2026-11-02; terms https://cloud.google.com/terms/service-terms read 2026-10-29')).toMatchObject({ voice: 'ko-KR-Neural2-A', rate: 0.9 });
  });

  it.each([
    'Amazon Polly Seoyeon',
    'tts:polly/neural/Seoyeon; rate 0.85; generated 2026-11-02',
    'tts:polly/neural/Seoyeon; rate fast; generated 2026-11-02; terms https://aws.amazon.com/service-terms/ read 2026-10-29',
    'tts:polly/neural/Seoyeon; rate 0.85; generated 2026-11-02; terms http://aws.amazon.com/service-terms/ read 2026-10-29',
  ])('rejects %s', (source) => {
    expect(parseTtsSource(source)).toBeNull();
  });

  it('a row says plainly that the clip is not under the repository licence', () => {
    const lockRow = { ref: 'audio/say/0123456789abcdef.mp3', key: '0123456789abcdef', engine: 'google', voice: 'ko-KR-Neural2-A', model: 'neural2', rate: 0.9, generated: '2026-11-02', saySha256: saySha256('학교'), mp3Sha256: null };
    const row = ttsLicenceRow({ assetPath: `${CLIP_ASSET_DIR}/say/0123456789abcdef.mp3`, lockRow, termsRead: READ });
    expect(row).toEqual({
      asset_path: 'apps/mobile/assets/audio/say/0123456789abcdef.mp3',
      category: 'audio-tts',
      source: 'tts:google/neural2/ko-KR-Neural2-A; rate 0.9; generated 2026-11-02; terms https://cloud.google.com/terms/service-terms read 2026-10-29',
      license: TTS_LICENSE,
      attribution: 'Google Cloud Text-to-Speech, computer-generated voice ko-KR-Neural2-A',
      url: 'https://cloud.google.com/terms/service-terms',
    });
    expect(TTS_LICENSE).toMatch(/not under the repository licence/);
    expect(refOfAssetPath(row.asset_path)).toBe('audio/say/0123456789abcdef.mp3');
    expect(refOfAssetPath('apps/mobile/public/fonts/x.woff2')).toBeNull();
  });
});

describe('the validator (fixtures)', () => {
  const sayMp3 = Buffer.from('ID3-not-really-an-mp3-say');
  const jamoMp3 = Buffer.from('ID3-not-really-an-mp3-jamo');
  const sayRow = { ref: 'audio/say/0123456789abcdef.mp3', key: '0123456789abcdef', engine: 'polly', voice: 'Seoyeon', model: 'neural', rate: 0.9, generated: '2026-11-02', saySha256: saySha256('학교'), mp3Sha256: null };
  const jamoRow = { ...sayRow, ref: 'audio/jamo/giyeok.mp3', key: 'giyeok', rate: 0.85, saySha256: saySha256('가.') };
  let lock = upsertLockRow(upsertLockRow(emptyLock(), sayRow), jamoRow);
  lock = withProcessedMp3(withProcessedMp3(lock, sayRow, sha256Hex(sayMp3)), jamoRow, sha256Hex(jamoMp3));
  const clips = [
    { path: `${CLIP_ASSET_DIR}/say/0123456789abcdef.mp3`, bytes: sayMp3 },
    { path: `${CLIP_ASSET_DIR}/jamo/giyeok.mp3`, bytes: jamoMp3 },
  ];
  const rows = () => [
    ttsLicenceRow({ assetPath: clips[0].path, lockRow: lock.rows.find((r) => r.key === sayRow.key), termsRead: READ }),
    ttsLicenceRow({ assetPath: clips[1].path, lockRow: lock.rows.find((r) => r.key === 'giyeok'), termsRead: READ }),
    { asset_path: 'apps/mobile/public/fonts/hr-presenter-kr.woff2', category: 'font', source: 'Noto', license: 'SIL OFL 1.1', attribution: 'Adobe', url: 'https://example.org' },
  ];

  it('passes when every shipped clip has one matching row', () => {
    expect(licenceRowProblems({ csvRows: rows(), lock, clips })).toEqual([]);
  });

  it('passes trivially with no clips and no rows', () => {
    expect(licenceRowProblems({ csvRows: [], lock: emptyLock(), clips: [] })).toEqual([]);
  });

  it('a shipped clip with no row, or with two rows', () => {
    const [say, jamo, font] = rows();
    expect(licenceRowProblems({ csvRows: [jamo, font], lock, clips })).toEqual([`${clips[0].path}: 0 licence rows in content/assets-license.csv (every shipped clip has exactly one)`]);
    expect(licenceRowProblems({ csvRows: [say, say, jamo], lock, clips })[0]).toMatch(/: 2 licence rows/);
  });

  it('a generated clip filed under another category', () => {
    const [say, jamo] = rows();
    expect(licenceRowProblems({ csvRows: [{ ...say, category: 'audio' }, jamo], lock, clips })).toEqual([`${clips[0].path}: a generated clip, so its row's category must be audio-tts, not audio`]);
  });

  it('a row whose vendor, voice, rate or date disagree with the lock', () => {
    const [say, jamo] = rows();
    const wrong = { ...say, source: say.source.replace('Seoyeon', 'Jihye').replace('rate 0.9', 'rate 0.85') };
    expect(licenceRowProblems({ csvRows: [wrong, jamo], lock, clips })).toEqual([
      `${clips[0].path}: source says voice Jihye but tts-lock.json says Seoyeon`,
      `${clips[0].path}: source says rate 0.85 but tts-lock.json says 0.9`,
    ]);
    const google = { ...say, source: say.source.replace('tts:polly/neural/', 'tts:google/neural2/').replace('https://aws.amazon.com/service-terms/', 'https://cloud.google.com/terms/service-terms'), url: 'https://cloud.google.com/terms/service-terms' };
    expect(licenceRowProblems({ csvRows: [google, jamo], lock, clips })).toEqual([
      `${clips[0].path}: source says vendor google but tts-lock.json says polly`,
      `${clips[0].path}: source says engine neural2 but tts-lock.json says neural`,
    ]);
  });

  it('a clip whose bytes are not the processed MP3 the lock records', () => {
    const changed = [{ ...clips[0], bytes: Buffer.from('another take') }, clips[1]];
    expect(licenceRowProblems({ csvRows: rows(), lock, clips: changed })).toEqual([`${clips[0].path}: no row in content/audio/tts-lock.json has this ref and this MP3's sha256`]);
  });

  it('a bad source, licence text or url, and a row for a clip that is not shipped', () => {
    const [say, jamo] = rows();
    expect(licenceRowProblems({ csvRows: [{ ...say, source: 'Amazon Polly' }, jamo], lock, clips })[0]).toMatch(/is not "tts:<vendor>\/<engine>\/<voice>; rate <r>/);
    expect(licenceRowProblems({ csvRows: [{ ...say, license: 'MIT' }, jamo], lock, clips })).toEqual([`${clips[0].path}: license must read "${TTS_LICENSE}"`]);
    expect(licenceRowProblems({ csvRows: [{ ...say, url: 'https://example.org' }, jamo], lock, clips })[0]).toMatch(/url must be the terms url/);
    expect(licenceRowProblems({ csvRows: rows(), lock, clips: [clips[1]] })).toEqual([`${clips[0].path}: no shipped clip at this path`]);
  });
});

describe('the repository', () => {
  it('every shipped clip has exactly one licence row that matches tts-lock.json', () => {
    const csvRows = parseCsv(readFileSync(join(REPO_ROOT, 'content/assets-license.csv'), 'utf8'));
    const lock = parseLock(JSON.parse(readFileSync(join(REPO_ROOT, LOCK_FILE), 'utf8')));
    const clips = listMp3(join(REPO_ROOT, CLIP_ASSET_DIR)).map((p) => ({ path: relative(REPO_ROOT, p).split('\\').join('/'), bytes: readFileSync(p) }));
    expect(licenceRowProblems({ csvRows, lock, clips })).toEqual([]);
    expect(csvRows.filter((r) => r.category === TTS_CATEGORY).length).toBe(clips.filter((c) => lock.rows.some((r) => r.mp3Sha256 === sha256Hex(c.bytes))).length);
  });
});
