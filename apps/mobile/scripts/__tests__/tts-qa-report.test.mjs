// The shared checks and the report of the two-pass QA (AMENDMENTS-AUDIO-CLIPS section 9; row AC-4): the signal
// checks on recorded ffmpeg output (silencedetect + ebur128, ffprobe), the identity checks, the report in the format
// the content PR body pastes, the regeneration commands, and the recognizer adapters' pure parts. No ffmpeg, no model.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CTC_MODEL, DEFAULT_CTC_MODEL_ID, PASS1_INFO, createCtc, modelLicenceOf, pass2LicenceOf, pass2LicenceProblem, whisperArgs } from '../audio/tts/recognizers.mjs';
import { closedSetOf, evaluatePass1, evaluatePass2, clipVerdict, targetFormsOf } from '../audio/tts/qa-lib.mjs';
import {
  ABRUPT_ONSET_DB,
  CLIPPED_ONSET_S,
  EDGE_SILENCE_S,
  MAX_INTERNAL_SILENCE_S,
  MIN_VOICED_SPAN_S,
  SILENCEDETECT_FILTER,
  buildReport,
  evaluateSignal,
  identityChecks,
  measureArgs,
  onsetRiseOf,
  parseFrameLevels,
  parseMeasure,
  regenerationCommands,
  renderReportMarkdown,
  reportPasses,
  sha256Hex,
  signalSummary,
} from '../audio/tts/qa-report.mjs';

const FIXTURES = join(__dirname, '__fixtures__/tts-qa');
const fixture = (name) => ({ probeJson: readFileSync(join(FIXTURES, `ffprobe-${name}.json`), 'utf8'), log: readFileSync(join(FIXTURES, `ffmpeg-${name}.txt`), 'utf8') });
const row = (kind, key, text, extra = {}) => ({ ref: kind.startsWith('jamo') ? `audio/jamo/${key}.mp3` : `audio/say/${key}.mp3`, key, kind, text, say: text, rate: 0.85, pack: 'jamo-s1', sources: ['x'], ...extra });

// The fixtures are recorded ffmpeg 8.1.1 output (measureArgs) of synthetic clips: a 220 Hz tone, levelled to about
// -16 LUFS and encoded as the 64 kbps / 44.1 kHz jamo MP3. `good`: a 0.45 s tone with a 40 ms attack, trimmed and
// padded 0.3 s each side as process-recordings.mjs does. `cut`: the same tone cut into (no attack), processed the
// same way, so its leading silence is right but its onset has no rise. `gap`: two 0.25 s tones 0.6 s apart,
// processed. `clipped`: the cut tone, not processed (speech from the first sample, as a truncated master).
describe('signal checks on recorded ffmpeg output (silencedetect + ebur128 + per-frame level)', () => {
  it('measures in one ffmpeg pass at the processing trim threshold, with 10 ms frame levels for the onset', () => {
    expect(SILENCEDETECT_FILTER).toBe('silencedetect=noise=-50dB:d=0.05');
    expect(measureArgs('a.mp3')).toEqual([
      '-hide_banner', '-nostats', '-i', 'a.mp3', '-af',
      'silencedetect=noise=-50dB:d=0.05,ebur128=peak=true,aresample=44100,asetnsamples=n=441,astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=RMS_level,ametadata=print:key=lavfi.astats.Overall.RMS_level',
      '-f', 'null', '-',
    ]);
    expect({ EDGE_SILENCE_S, MAX_INTERNAL_SILENCE_S, MIN_VOICED_SPAN_S, CLIPPED_ONSET_S, ABRUPT_ONSET_DB }).toEqual({ EDGE_SILENCE_S: { min: 0.25, max: 0.4 }, MAX_INTERNAL_SILENCE_S: 0.5, MIN_VOICED_SPAN_S: 0.15, CLIPPED_ONSET_S: 0.05, ABRUPT_ONSET_DB: 6 });
  });

  it('parses a good jamo clip: 0.35 s of silence, 0.45 s voiced, 0.35 s of silence, -16.4 LUFS, a 26 dB onset rise', () => {
    const m = parseMeasure(fixture('good'));
    expect(m.probe).toEqual({ codec: 'mp3', channels: 1, sampleRate: 44100, durationS: 1.139, bytes: 9612 });
    expect(m.loudness).toEqual({ integratedLufs: -16.4, truePeakDb: -9.3 });
    expect(m.summary).toEqual({ durationS: 1.139, onsetS: 0.345, leadingS: 0.345, trailingS: 0.345, voicedEndS: 0.794, voicedSpanS: 0.449, maxInternalS: 0 });
    expect(m.onset).toEqual({ atS: 0.34, firstDb: -37.903, peakDb: -12.032, riseDb: 25.871 });
  });

  it('reads the per-frame levels in order, digital silence as -Infinity', () => {
    const frames = parseFrameLevels(fixture('good').log);
    expect(frames.length).toBe(114);
    expect(frames[0]).toEqual({ t: 0, db: Number.NEGATIVE_INFINITY });
    expect(onsetRiseOf([{ t: 0, db: Number.NEGATIVE_INFINITY }])).toBeNull();
  });

  it('a good processed jamo clip passes every shared check', () => {
    const out = evaluateSignal(row('jamo-sound', 'giyeok', '가'), parseMeasure(fixture('good')), { kbps: 64, stage: 'processed' });
    expect(out.failures).toEqual([]);
    expect(out.ok).toBe(true);
    expect(out.closure).toBeNull();
  });

  it('reports the closure of a final at the end of the voiced part', () => {
    const out = evaluateSignal(row('jamo-sound', 'giyeok-batchim', '악'), parseMeasure(fixture('good')), { kbps: 64, stage: 'processed' });
    expect(out.closure).toEqual({ atS: 0.794, silenceAfterS: 0.345 });
  });

  it('a processed clip cut from a clipped master still fails: its 0.3 s pad is right, but its onset has no rise', () => {
    const m = parseMeasure(fixture('cut'));
    expect(m.summary).toMatchObject({ leadingS: 0.3, trailingS: 0.345 });
    const out = evaluateSignal(row('jamo-sound', 'giyeok', '가'), m, { kbps: 64, stage: 'processed' });
    expect(out.failures).toEqual(['clipped onset: the first voiced frame (0.3 s) is 0.371 dB under the loudest, must rise >= 6 dB']);
  });

  it('a clip that starts at the first sample has a clipped onset and too little leading silence', () => {
    const m = parseMeasure(fixture('clipped'));
    expect(m.summary).toMatchObject({ onsetS: 0, leadingS: 0, trailingS: 0.101, voicedSpanS: 0.449 });
    const out = evaluateSignal(row('jamo-sound', 'giyeok', '가'), m, { kbps: 64, stage: 'processed' });
    expect(out.failures).toEqual(expect.arrayContaining(['leading silence 0 s: must be 0.25-0.4 s', 'clipped onset: speech starts at 0 s']));
  });

  it('a 1-2 syllable clip with an internal silence over 0.5 s fails (and here it is too long for a jamo clip)', () => {
    const m = parseMeasure(fixture('gap'));
    expect(m.summary).toMatchObject({ leadingS: 0.3, trailingS: 0.301, maxInternalS: 0.601, voicedSpanS: 0.498 });
    const out = evaluateSignal(row('jamo-name', 'giyeok-name', '기역'), m, { kbps: 64, stage: 'processed' });
    expect(out.failures).toEqual(expect.arrayContaining(['duration 1.7 s: must be 0.6-1.5 s', 'internal silence 0.601 s: must be <= 0.5 s in a clip of 1-2 syllables']));
  });

  it('a jamo clip whose voiced span is under 0.15 s fails (truncation)', () => {
    const summary = signalSummary([{ start: 0, end: 0.3 }, { start: 0.4, end: 0.7 }], 0.7);
    expect(summary.voicedSpanS).toBe(0.1);
    const m = { ...parseMeasure(fixture('good')), summary };
    expect(evaluateSignal(row('jamo-sound', 'a', '아'), m, { kbps: 64, stage: 'processed' }).failures).toContain('voiced span 0.1 s: must be >= 0.15 s');
  });

  it('a sentence takes the per-syllable bound and the 48 kbps format', () => {
    const m = parseMeasure(fixture('gap'));
    // 6 syllables: 1.5-3.3 s, so 1.7 s passes the duration; the format must be 24 kHz at 48 kbps.
    const out = evaluateSignal(row('sentence', 'aaaaaaaaaaaaaaaa', '안녕히 가세요.'), m, { kbps: 48, stage: 'processed' });
    expect(out.failures.some((f) => f.startsWith('duration'))).toBe(false);
    expect(out.failures).toContain('sample rate 44100: must be 24000 Hz');
    // The internal-silence rule is for clips of 1-2 syllables only.
    expect(out.failures.some((f) => f.startsWith('internal silence'))).toBe(false);
    // At 64 kbps (the say group after the pilot moved it) the same clip is in format.
    expect(evaluateSignal(row('sentence', 'aaaaaaaaaaaaaaaa', '안녕히 가세요.'), m, { kbps: 64, stage: 'processed' }).failures).toEqual([]);
  });

  it('a WAV master gets the checks that do not depend on processing; a master cut at the first sample fails', () => {
    const out = evaluateSignal(row('jamo-sound', 'giyeok', '가'), parseMeasure(fixture('clipped')), { kbps: 64, stage: 'masters' });
    expect(out.ok).toBe(false);
    expect(out.pending).toEqual(['format, size, loudness and edge silence (checked on the processed MP3)']);
    expect(out.failures).toEqual([
      'clipped onset: speech starts at 0 s in the master (a cut take)',
      'clipped onset: the first voiced frame (0 s) is 0.338 dB under the loudest, must rise >= 6 dB',
    ]);
    // A master with more voiced speech than its class allows (jamo: 1.5 s less 0.6 s of padding) fails.
    const long = { ...parseMeasure(fixture('good')), summary: signalSummary([], 1.2) };
    expect(evaluateSignal(row('jamo-sound', 'giyeok', '가'), long, { kbps: 64, stage: 'masters' }).failures[0]).toMatch(/voiced span 1.2 s: must be <= 0.9 s/);
  });

  it('a jamo clip measured without frame levels fails rather than passing unchecked', () => {
    const m = { ...parseMeasure(fixture('good')), onset: null };
    expect(evaluateSignal(row('jamo-sound', 'giyeok', '가'), m, { kbps: 64, stage: 'processed' }).failures).toEqual(['onset level not measured (no frame levels in the ffmpeg output)']);
  });
});

describe('identity checks', () => {
  const say = (t) => sha256Hex(t);
  const rows = [row('jamo-sound', 'giyeok', '가', { say: '가.' }), row('jamo-sound', 'kieuk', '카', { say: '카.' }), row('jamo-sound', 'a', '아', { say: '아.' })];
  const lockRow = (r, mp3Sha256 = null, sayText = r.say) => ({ ref: r.ref, key: r.key, engine: 'polly', voice: 'Seoyeon', model: 'neural', rate: 0.85, generated: '2026-11-02', saySha256: say(sayText), mp3Sha256 });
  const clip = (key, ext, sha) => ({ key, file: `${key}.${ext}`, ext, sha256: sha });

  it('passes one clip per row, each in the lock', () => {
    const lock = { rows: rows.map((r) => lockRow(r, 'a'.repeat(64))) };
    const out = identityChecks({ rows, clips: rows.map((r, i) => clip(r.key, 'mp3', i === 0 ? 'a'.repeat(64) : 'a'.repeat(64))), lock, engine: 'polly', voice: 'Seoyeon' });
    // Same bytes for 가, 카 and 아 is the swap the byte-identity check exists for.
    expect(out.byKey.get('giyeok').failures[0]).toMatch(/byte-identical to kieuk \(카\), a \(아\)/);
  });

  it('lists missing rows and extra files, and two files for one row', () => {
    const lock = { rows: rows.map((r) => lockRow(r)) };
    const out = identityChecks({ rows, clips: [clip('giyeok', 'wav', '1'.repeat(64)), clip('giyeok', 'mp3', '2'.repeat(64)), clip('kieuk', 'wav', '3'.repeat(64)), clip('stray', 'wav', '4'.repeat(64))], lock, engine: 'polly', voice: 'Seoyeon' });
    expect(out.missing).toEqual(['a']);
    expect(out.extra).toEqual(['stray.wav']);
    expect(out.byKey.get('giyeok').failures).toEqual(['2 clips for one row: giyeok.wav, giyeok.mp3']);
    expect(out.byKey.get('kieuk')).toEqual({ ok: true, failures: [], flags: [] });
  });

  it('a processed MP3 must carry the lock sha256; a master its lock row of the same say', () => {
    const lock = { rows: [lockRow(rows[0], 'b'.repeat(64)), lockRow(rows[1], null), lockRow(rows[2], null, '아')] };
    const out = identityChecks({ rows, clips: [clip('giyeok', 'mp3', 'c'.repeat(64)), clip('kieuk', 'mp3', 'd'.repeat(64)), clip('a', 'wav', 'e'.repeat(64))], lock, engine: 'polly', voice: 'Seoyeon' });
    expect(out.byKey.get('giyeok').failures[0]).toMatch(/is not the lock's/);
    expect(out.byKey.get('kieuk').failures[0]).toMatch(/no processed MP3 sha256/);
    expect(out.byKey.get('a').failures[0]).toMatch(/generated from another text/);
  });

  it('a clip of another voice is not in this voice\'s lock', () => {
    const lock = { rows: [{ ...lockRow(rows[0]), voice: 'Jihye' }] };
    const out = identityChecks({ rows: [rows[0]], clips: [clip('giyeok', 'wav', 'f'.repeat(64))], lock, engine: 'polly', voice: 'Seoyeon' });
    expect(out.byKey.get('giyeok').failures).toEqual(['not in the lock for polly/Seoyeon']);
  });

  it('jamo clips with the same text may share bytes; different texts may not', () => {
    const same = [row('jamo-sound', 'x', '가'), row('jamo-sound', 'y', '가')];
    const lock = { rows: same.map((r) => lockRow(r)) };
    const out = identityChecks({ rows: same, clips: [clip('x', 'wav', '9'.repeat(64)), clip('y', 'wav', '9'.repeat(64))], lock, engine: 'polly', voice: 'Seoyeon' });
    expect(out.byKey.get('x').ok).toBe(true);
  });
});

describe('the regeneration commands', () => {
  it('moves the failing masters aside, then a dry run and the run with --only', () => {
    expect(regenerationCommands({ engine: 'polly', voice: 'Seoyeon', keys: ['giyeok', 'a'], pilot: false, stage: 'masters', masterDir: 'apps/mobile/recordings/tts/polly/Seoyeon' })).toEqual([
      'mkdir -p apps/mobile/recordings/tts/polly/Seoyeon/rejected && mv apps/mobile/recordings/tts/polly/Seoyeon/giyeok.wav apps/mobile/recordings/tts/polly/Seoyeon/a.wav apps/mobile/recordings/tts/polly/Seoyeon/rejected/',
      'pnpm --filter @hangul-route/mobile audio:tts:generate --engine polly --voice Seoyeon --only giyeok,a --dry-run',
      'pnpm --filter @hangul-route/mobile audio:tts:generate --engine polly --voice Seoyeon --only giyeok,a',
    ]);
  });

  it('does not move a missing row\'s master, which does not exist', () => {
    const lines = regenerationCommands({ engine: 'polly', voice: 'Seoyeon', keys: ['giyeok', 'nieun'], missing: ['nieun'], pilot: false, stage: 'masters', masterDir: 'm' });
    expect(lines[0]).toBe('mkdir -p m/rejected && mv m/giyeok.wav m/rejected/');
    expect(lines[2]).toMatch(/--only giyeok,nieun$/);
    expect(regenerationCommands({ engine: 'polly', voice: 'Seoyeon', keys: ['nieun'], missing: ['nieun'], pilot: false, stage: 'masters', masterDir: 'm' })[0]).toMatch(/--dry-run$/);
  });

  it('keeps --pilot for a pilot row; for processed clips, says the lock skips them and how to get another take', () => {
    const lines = regenerationCommands({ engine: 'google', voice: 'ko-KR-Neural2-A', keys: ['nieun'], pilot: true, stage: 'processed', masterDir: 'm' });
    expect(lines[0]).toMatch(/the generator skips them/);
    expect(lines[0]).toMatch(/"mp3Sha256" back to null in content\/audio\/tts-lock\.json for the google\/ko-KR-Neural2-A rows of nieun/);
    expect(lines[0]).toMatch(/override/);
    expect(lines[2]).toBe('pnpm --filter @hangul-route/mobile audio:tts:generate --engine google --voice ko-KR-Neural2-A --pilot --only nieun');
    expect(regenerationCommands({ engine: 'polly', voice: 'Seoyeon', keys: [], pilot: false, stage: 'masters', masterDir: 'm' })).toEqual([]);
  });
});

describe('the recognizer adapters (pure parts)', () => {
  it('Pass 1 is whisper.cpp large-v3 in Korean; free and forced-choice arguments', () => {
    expect(PASS1_INFO).toEqual({ name: 'whisper.cpp', model: 'large-v3', licence: 'MIT', language: 'ko' });
    expect(whisperArgs({ model: 'm.bin', files: ['a.wav', 'b.wav'] })).toEqual(['-m', 'm.bin', '-l', 'ko', '-nt', '-np', '-otxt', '-f', 'a.wav', '-f', 'b.wav']);
    expect(whisperArgs({ model: 'm.bin', files: ['a.wav'], grammarFile: 'g.gbnf', grammarPenalty: 80 })).toEqual([
      '-m', 'm.bin', '-l', 'ko', '-nt', '-np', '-otxt', '--grammar', 'g.gbnf', '--grammar-rule', 'root', '--grammar-penalty', '80', '-f', 'a.wav',
    ]);
  });

  it('the default Pass 2 model is pinned: its card body states Apache 2.0, so its licence comes with its weights hash', () => {
    expect(DEFAULT_CTC_MODEL).toEqual({
      id: 'Kkonjeong/wav2vec2-base-korean',
      revision: 'fa03d1a7138f1900131393cc7cb74f77926f177a',
      licence: 'apache-2.0',
      licenceSource: 'model card body ("License: Apache 2.0"), read 2026-10-30 at the pinned revision',
      weightsFile: 'model.safetensors',
      weightsSha256: 'eda501ecfaf436a5d81648e461ad78d7ba2baf8d30fd32fcde9da8f0603b92f5',
    });
    // The card's front matter has no licence: the pinned default still loads, with its weights hash required.
    expect(pass2LicenceOf({ modelId: DEFAULT_CTC_MODEL_ID, cardLicence: null })).toEqual({ licence: 'apache-2.0', source: DEFAULT_CTC_MODEL.licenceSource, requireWeightsSha256: DEFAULT_CTC_MODEL.weightsSha256 });
    expect(pass2LicenceOf({ modelId: 'someone/other-model', cardLicence: null }).licence).toBeNull();
    expect(pass2LicenceOf({ modelId: 'someone/other-model', cardLicence: 'mit' })).toEqual({ licence: 'mit', source: 'model card front matter', requireWeightsSha256: null });
    expect(pass2LicenceOf({ modelId: 'someone/other-model', cardLicence: null, flagLicence: 'Apache-2.0' })).toEqual({ licence: 'apache-2.0', source: 'given with --ctc-licence', requireWeightsSha256: null });
  });

  describe('createCtc on a local model folder', () => {
    let dir;
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'hr-ctc-'));
      writeFileSync(join(dir, 'vocab.json'), JSON.stringify({ '[PAD]': 0, ㄱ: 1, ㅏ: 2, '|': 3 }));
      writeFileSync(join(dir, 'config.json'), JSON.stringify({ pad_token_id: 0 }));
      // The real card: no licence in the front matter, "License: Apache 2.0" in the body.
      writeFileSync(join(dir, 'README.md'), '---\nlibrary_name: transformers\nlanguage:\n- ko\n---\n- **License:** Apache 2.0\n');
      writeFileSync(join(dir, 'model.safetensors'), 'weights');
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it('loads the pinned default when the weights are the pinned revision', async () => {
      const ctc = await createCtc({ modelDir: dir, python: 'python3', threshold: 2, hashFile: async () => DEFAULT_CTC_MODEL.weightsSha256 });
      const info = await ctc.describe();
      expect(info).toMatchObject({ id: DEFAULT_CTC_MODEL_ID, revision: DEFAULT_CTC_MODEL.revision, licence: 'apache-2.0', licenceSource: DEFAULT_CTC_MODEL.licenceSource, modelSha256: DEFAULT_CTC_MODEL.weightsSha256, unit: 'jamo' });
    });

    it('refuses other weights under the default id, unless the licence is given', async () => {
      await expect(createCtc({ modelDir: dir, python: 'python3', threshold: 2 })).rejects.toThrow(/is not the pinned Kkonjeong\/wav2vec2-base-korean revision/);
      const ctc = await createCtc({ modelDir: dir, python: 'python3', threshold: 2, licence: 'apache-2.0' });
      expect(await ctc.describe()).toMatchObject({ licence: 'apache-2.0', licenceSource: 'given with --ctc-licence', revision: null });
    });

    it('refuses another model whose card names no licence', async () => {
      await expect(createCtc({ modelDir: dir, modelId: 'someone/other-model', python: 'python3', threshold: 2 })).rejects.toThrow(/names no licence: pass --ctc-licence/);
    });
  });

  it('Pass 2 reads the model card licence and refuses one that does not permit this use', () => {
    expect(DEFAULT_CTC_MODEL_ID).toBe('Kkonjeong/wav2vec2-base-korean');
    expect(modelLicenceOf('---\nlanguage: ko\nlicense: apache-2.0\ndatasets:\n- zeroth\n---\n# Model')).toBe('apache-2.0');
    expect(modelLicenceOf('---\nlicense: "MIT"\n---')).toBe('mit');
    expect(modelLicenceOf('# no front matter')).toBeNull();
    expect(pass2LicenceProblem('apache-2.0')).toBeNull();
    expect(pass2LicenceProblem('cc-by-nc-4.0')).toMatch(/not one of/);
    expect(pass2LicenceProblem(null)).toMatch(/--ctc-licence/);
  });
});

// --- The report (snapshot) ------------------------------------------------------------------------------------

function sampleReport(ownerListen = null, packTotals = []) {
  const overrides = { 국물: { say: '궁물', reason: 'nasalization', engine: 'polly', voice: 'Seoyeon', accept: ['궁물'] } };
  const good = parseMeasure(fixture('good'));
  // A say clip is processed at 48 kbps, 24 kHz (AU-OD-7).
  const good48 = { ...good, probe: { ...good.probe, sampleRate: 24000, bytes: 6300 } };
  const entry = (r, p1, p2, signalStage = 'processed') => {
    const forms = targetFormsOf(r, overrides);
    const closedSet = closedSetOf(r, overrides);
    const pass1 = evaluatePass1({ forms, closedSet, ...p1 });
    const pass2 = evaluatePass2({ forms, closedSet, ...p2 });
    const jamo = r.ref.startsWith('audio/jamo/');
    const signal = evaluateSignal(r, jamo ? good : good48, { kbps: jamo ? 64 : 48, stage: signalStage });
    const identity = { ok: true, failures: [], flags: [] };
    return { key: r.key, ref: r.ref, kind: r.kind, pack: r.pack, text: r.text, say: r.say, file: `${r.key}.mp3`, sha256: '0'.repeat(64), closedSet, pass1, pass2, signal, identity, ...clipVerdict({ pass1, pass2, signal, identity }) };
  };
  const ga = row('jamo-sound', 'giyeok', '가', { say: '가.' });
  const ka = row('jamo-sound', 'kieuk', '카', { say: '카.' });
  const ak = row('jamo-sound', 'giyeok-batchim', '악', { say: '악.' });
  const gukmul = row('word', '0123456789abcdef', '국물', { pack: 'stage2', say: '궁물' });
  const s = (target, conf) => ({ 가: target, 카: conf, 까: conf - 3, 의: -50, 갸: -50, 아: -50 });
  const clips = [
    entry(ga, { free: '가.', forced: '가' }, { free: '가', scores: s(-8.4, -12.9) }),
    entry(ka, { free: '가', forced: '카' }, { free: '카', scores: { 카: -9.1, 가: -10.0, 까: -14, 키: -40 } }),
    entry(ak, { free: '악.', forced: '악' }, { free: '악', scores: { 악: -7, 안: -9.5, 알: -12, 암: -11, 압: -8.2, 앙: -13, 앋: -10 } }),
    entry(gukmul, { free: '궁물', forced: '궁물' }, { free: '궁물', scores: { 궁물: -12, 국물: -12.5, 굼물: -30, 쿡물: -30, 꾹물: -30, 국믈: -30, 국묵: -30, 국문: -30, 국물: -12.5, 국뭄: -30, 국뭅: -30, 국뭉: -30, 국묻: -30, 궁믈: -30 } }, 'processed'),
  ];
  return buildReport({
    meta: {
      generatedAt: '2026-11-02T10:00:00.000Z',
      engine: 'polly',
      voice: 'Seoyeon',
      stage: 'processed',
      folders: ['apps/mobile/assets/audio/jamo'],
      masterDir: 'apps/mobile/recordings/tts/polly/Seoyeon',
      selection: { pilot: false, packs: ['jamo-s1'], only: null },
      selectionLabel: 'packs jamo-s1',
      recognizers: {
        pass1: { ...PASS1_INFO, binary: 'whisper-cli', modelFile: 'ggml-large-v3.bin', modelSha256: 'a'.repeat(64), grammarPenalty: 100 },
        pass2: { name: 'wav2vec2 CTC (transformers, local)', id: DEFAULT_CTC_MODEL_ID, revision: DEFAULT_CTC_MODEL.revision, licence: 'apache-2.0', licenceSource: DEFAULT_CTC_MODEL.licenceSource, modelFile: 'model.safetensors', modelSha256: DEFAULT_CTC_MODEL.weightsSha256, unit: 'jamo', threshold: 2 },
      },
    },
    clips,
    missing: ['nieun'],
    extra: ['stray.mp3'],
    ownerListen,
    packTotals,
  });
}

describe('the report', () => {
  it('summarizes the run: verdicts, missing rows, flags and the G4 first-take rates', () => {
    const report = sampleReport();
    expect(report.summary).toEqual({
      rows: 5,
      clips: 4,
      pass: 2,
      fail: 2,
      missing: 1,
      extra: 1,
      vetoed: 0,
      flagged: 0,
      packTotalsOk: true,
      firstTake: { pass1: { matched: 1, total: 1, rate: 1, meetsG4: true }, pass2: { matched: 1, total: 1, rate: 1, meetsG4: true } },
    });
    // 카: Pass 1's forced choice is right but its free transcript is 가 (a flag), and Pass 2's margin over 가 is 0.9
    // nats (top but narrow): it fails on one pass. 악: both recognizers agree, but its margin over 압 is 1.2 nats.
    // 국물: heard as its accepted variant 궁물 in both passes.
    expect(report.clips.map((c) => c.reasons)).toEqual([[], ['Pass 2: margin 0.9 nats over 가 is under 2 (top but narrow)'], ['Pass 2: margin 1.2 nats over 압 is under 2 (top but narrow)'], []]);
    expect(report.clips.map((c) => [c.key, c.verdict])).toEqual([
      ['giyeok', 'pass'],
      ['kieuk', 'fail'],
      ['giyeok-batchim', 'fail'],
      ['0123456789abcdef', 'pass'],
    ]);
    expect(report.regenerate.keys).toEqual(['kieuk', 'giyeok-batchim', 'nieun']);
    // An extra file (no manifest row) is an identity failure: the run does not pass.
    expect(reportPasses(report)).toBe(false);
    expect(reportPasses({ ...report, regenerate: { keys: [], commands: [] }, extra: [] })).toBe(true);
  });

  it('honours an owner veto of the clip that was played: regenerated, shown as vetoed, not counted as a pass', () => {
    const report = sampleReport({ date: '2026-11-03', played: 3, vetoes: [{ key: 'giyeok', text: '가', note: 'sounds like a question', sha256s: ['0'.repeat(64)] }] });
    expect(report.summary.vetoed).toBe(1);
    expect(report.summary.pass).toBe(1);
    expect(report.regenerate.keys).toEqual(['kieuk', 'giyeok-batchim', 'nieun', 'giyeok']);
    const md = renderReportMarkdown(report);
    expect(md).toMatch(/vetoed giyeok \(sounds like a question\)\./);
    expect(md).toMatch(/\| giyeok \| 가 \|.*\| vetoed in the owner listen \(pass\) \|/);
  });

  it('drops a veto once the clip is regenerated (another sha256)', () => {
    const report = sampleReport({ date: '2026-11-03', played: 3, vetoes: [{ key: 'giyeok', text: '가', note: '', sha256s: ['f'.repeat(64)] }] });
    expect(report.summary.vetoed).toBe(0);
    expect(report.summary.pass).toBe(2);
    expect(report.regenerate.keys).toEqual(['kieuk', 'giyeok-batchim', 'nieun']);
    expect(renderReportMarkdown(report)).toMatch(/vetoed giyeok \(clip since replaced, veto no longer applies\)/);
  });

  it('shows the AC-B6 pack totals and fails the run on one over its limit', () => {
    const over = { pack: 'jamo-s1', clips: 43, bytes: 530_000, limit: { clips: 43, maxBytes: 520_000 }, ok: false, failures: ['set total 530000 bytes: must be <= 520000'] };
    const report = sampleReport(null, [over]);
    expect(report.summary.packTotalsOk).toBe(false);
    expect(renderReportMarkdown(report)).toMatch(/Pack jamo-s1 set total \(AC-B6\): 43 clips, 530000 bytes \(limit 43 clips, 520000 bytes\): fail: set total 530000 bytes: must be <= 520000\./);
    expect(reportPasses({ ...report, extra: [] })).toBe(false);
  });

  it('renders the Markdown the content PR body pastes, with the two MAR columns empty', () => {
    expect(renderReportMarkdown(sampleReport())).toMatchSnapshot();
  });
});
