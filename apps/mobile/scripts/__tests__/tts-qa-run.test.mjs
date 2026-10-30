// The `audio:tts:qa` and `audio:tts:listen` commands end to end with their effects injected (AMENDMENTS-AUDIO-CLIPS
// section 9; row AC-4): arguments, the CI refusal, the gitignored report folder, the clip folder, both recognizers
// mocked, the shared checks on recorded ffmpeg output, the report files and the exit code; then the owner listen and
// its veto list. No recognizer, no ffmpeg, no audio, no network.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sayKey, sayRef } from '@hangul-route/content-schema';
import { describe, expect, it, vi } from 'vitest';
import { answerOf, parseListenArgs, runListen } from '../audio/tts/listen-lib.mjs';
import { saySha256 } from '../audio/tts/lock-lib.mjs';
import { clipFilesOf, parseQaArgs, qaRefusalOf, runQa } from '../audio/tts/qa-run.mjs';

const APP_ROOT = join(__dirname, '..', '..');
const REPO = '/repo';
const MASTERS = `${REPO}/apps/mobile/recordings/tts/polly/Seoyeon`;
const FIXTURES = join(__dirname, '__fixtures__/tts-qa');
const GOOD = { probeJson: readFileSync(join(FIXTURES, 'ffprobe-good.json'), 'utf8'), log: readFileSync(join(FIXTURES, 'ffmpeg-good.log'), 'utf8') };
const keys = { sayKey, sayRef };

const jamo = (key, text, kind = 'jamo-sound') => ({ ref: `audio/jamo/${key}.mp3`, key, kind, text, say: kind === 'jamo-sound' ? `${text}.` : text, rate: 0.85, pack: 'jamo-s1', sources: ['x'] });
const MANIFEST = { schemaVersion: 1, rows: [jamo('giyeok', '가'), jamo('kieuk', '카'), jamo('giyeok-name', '기역', 'jamo-name'), { ...jamo('ae', '애'), pack: 'jamo-wb' }] };
const lockOf = (rows) => ({ schemaVersion: 1, rows: rows.map((r) => ({ ref: r.ref, key: r.key, engine: 'polly', voice: 'Seoyeon', model: 'neural', rate: 0.85, generated: '2026-11-02', saySha256: saySha256(r.say), mp3Sha256: null })) });

/** In-memory effects for runQa: files, both recognizers mocked from a per-key script. */
function harness({ files = ['giyeok.wav', 'kieuk.wav', 'giyeok-name.wav'], heard = {}, ignored = true, lock = lockOf(MANIFEST.rows), extraFs = {} } = {}) {
  const fs = new Map([
    [`${REPO}/content/audio/tts-manifest.json`, JSON.stringify(MANIFEST)],
    [`${REPO}/content/audio/tts-lock.json`, JSON.stringify(lock)],
    [`${REPO}/content/audio/pronunciation-overrides.json`, JSON.stringify({ schemaVersion: 1, overrides: {} })],
    ...Object.entries(extraFs),
  ]);
  const keyOf = (file) => file.split('/').pop().replace(/\.(wav|mp3)$/, '');
  const say = (key) => heard[key] ?? { free: MANIFEST.rows.find((r) => r.key === key).text };
  const pass1 = {
    describe: vi.fn(async () => ({ name: 'whisper.cpp', model: 'large-v3', licence: 'MIT', language: 'ko', modelSha256: 'a'.repeat(64), grammarPenalty: 100 })),
    transcribe: vi.fn(async (list) => new Map(list.map((f) => [f, say(keyOf(f)).free]))),
    forcedChoice: vi.fn(async (list) => new Map(list.map((f) => [f, say(keyOf(f)).forced ?? say(keyOf(f)).free]))),
  };
  const pass2 = {
    describe: vi.fn(async () => ({ name: 'wav2vec2 CTC', id: 'Kkonjeong/wav2vec2-base-korean', licence: 'apache-2.0', modelSha256: 'b'.repeat(64), unit: 'jamo', threshold: 2 })),
    run: vi.fn(async (items) =>
      new Map(
        items.map(({ file, candidates }) => {
          const h = say(keyOf(file));
          const target = MANIFEST.rows.find((r) => r.key === keyOf(file)).text;
          const scores = Object.fromEntries(candidates.map((c) => [c, c === target ? -8 : -8 - (h.margin ?? 5)]));
          return [file, { free: h.ctc ?? h.free, scores }];
        }),
      ),
    ),
  };
  const out = [];
  const err = [];
  const deps = {
    repoRoot: REPO,
    readText: (p) => {
      if (!fs.has(p)) throw new Error(`ENOENT ${p}`);
      return fs.get(p);
    },
    exists: (p) => fs.has(p) || p === MASTERS,
    listDir: (dir) => (dir === MASTERS ? [...files, 'qa-report.md', '.DS_Store'] : []),
    sha256File: async (p) => saySha256(p),
    writeAtomic: (p, text) => fs.set(p, text),
    isIgnored: () => ignored,
    keys,
    createRecognizers: vi.fn(async () => ({ pass1, pass2 })),
    measure: vi.fn(async () => GOOD),
    now: () => new Date('2026-11-02T10:00:00Z'),
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  };
  return { deps, fs, out, err, pass1, pass2 };
}

const ARGS = ['--engine', 'polly', '--voice', 'Seoyeon', '--pack', 'jamo-s1'];

describe('audio:tts:qa arguments and refusals', () => {
  it('needs the engine, the voice and a selection', () => {
    expect(parseQaArgs(['--pack', 'jamo-s1']).error).toMatch(/--engine and --voice/);
    expect(parseQaArgs(['--engine', 'polly', '--voice', 'Seoyeon']).error).toMatch(/--pack, --pilot or --only/);
    expect(parseQaArgs([...ARGS, '--pilot']).error).toMatch(/cannot be combined/);
    expect(parseQaArgs(['--engine', 'polly', '--voice', 'Seoyeon', '--pack', 'nope']).error).toMatch(/unknown pack nope/);
    expect(parseQaArgs([...ARGS, '--margin', '0']).error).toMatch(/--margin/);
    expect(parseQaArgs([...ARGS, '--margin', '1.5'])).toMatchObject({ engine: 'polly', voice: 'Seoyeon', packs: ['jamo-s1'], threshold: 1.5 });
    expect(parseQaArgs(ARGS).threshold).toBe(2);
  });

  it('never runs the recognizers in CI', async () => {
    expect(qaRefusalOf({ CI: 'true' })).toMatch(/locally only/);
    expect(qaRefusalOf({ CLAUDECODE: '1' })).toBeNull();
    const h = harness();
    expect(await runQa(ARGS, { CI: '1' }, h.deps)).toBe(2);
    expect(h.deps.createRecognizers).not.toHaveBeenCalled();
    expect(h.err[0]).toMatch(/refused: CI/);
  });

  it('keeps the report in a gitignored folder', async () => {
    const h = harness({ ignored: false });
    expect(await runQa(ARGS, {}, h.deps)).toBe(2);
    expect(h.err[0]).toMatch(/not gitignored/);
  });

  it('reads <key>.wav and <key>.mp3 as clips, nothing else', () => {
    expect(clipFilesOf(['giyeok.wav', 'a.mp3', 'qa-report.md', 'owner-listen.json', 'Giyeok.wav', '.x.wav'])).toEqual([
      { name: 'giyeok.wav', key: 'giyeok', ext: 'wav' },
      { name: 'a.mp3', key: 'a', ext: 'mp3' },
    ]);
  });
});

describe('audio:tts:qa end to end, recognizers mocked', () => {
  it('passes clips both recognizers agree on, and writes the JSON and Markdown report next to the masters', async () => {
    const h = harness();
    expect(await runQa([...ARGS, '--only', 'giyeok,kieuk,giyeok-name'], {}, h.deps)).toBe(0);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    expect(report.summary).toMatchObject({ rows: 3, clips: 3, pass: 3, fail: 0, missing: 0 });
    expect(report.stage).toBe('masters');
    expect(report.recognizers.pass2).toMatchObject({ id: 'Kkonjeong/wav2vec2-base-korean', licence: 'apache-2.0', modelSha256: 'b'.repeat(64) });
    expect(h.fs.get(`${MASTERS}/qa-report.md`)).toMatch(/^# Clip QA: polly\/Seoyeon/);
    // One forced-choice grammar per candidate set: 가 and 카 share {가, 카, 까} in a different order, so two groups,
    // plus 기역's.
    expect(h.pass1.forcedChoice).toHaveBeenCalledTimes(3);
    expect(h.pass1.transcribe).toHaveBeenCalledTimes(1);
  });

  it('a clip that only one recognizer passes fails, with the exact --only command to regenerate it', async () => {
    const h = harness({ heard: { kieuk: { free: '카', forced: '카', margin: 1.1 } } });
    expect(await runQa(ARGS.slice(0, 4).concat(['--only', 'giyeok,kieuk']), {}, h.deps)).toBe(1);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    const kieuk = report.clips.find((c) => c.key === 'kieuk');
    expect(kieuk.pass1.ok).toBe(true);
    expect(kieuk.pass2.ok).toBe(false);
    expect(kieuk.verdict).toBe('fail');
    expect(report.regenerate.keys).toEqual(['kieuk']);
    expect(h.out).toContain('  pnpm --filter @hangul-route/mobile audio:tts:generate --engine polly --voice Seoyeon --only kieuk');
    expect(h.out.some((l) => l.includes(`mv ${'apps/mobile/recordings/tts/polly/Seoyeon'}/kieuk.wav`))).toBe(true);
  });

  it('a forced choice that is not the target fails Pass 1', async () => {
    const h = harness({ heard: { giyeok: { free: '가', forced: '까' } } });
    expect(await runQa([...ARGS.slice(0, 4), '--only', 'giyeok'], {}, h.deps)).toBe(1);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    expect(report.clips[0].reasons).toEqual(['Pass 1: forced choice "까" is not the target 가']);
  });

  it('a row with no clip is missing and fails the run; a clip not in the lock fails its identity', async () => {
    const h = harness({ files: ['giyeok.wav', 'kieuk.wav'], lock: lockOf([MANIFEST.rows[0]]) });
    expect(await runQa(ARGS, {}, h.deps)).toBe(1);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    expect(report.missing).toEqual(['giyeok-name']);
    expect(report.clips.find((c) => c.key === 'kieuk').reasons).toEqual(['identity: not in the lock for polly/Seoyeon']);
    expect(report.regenerate.keys).toEqual(['kieuk', 'giyeok-name']);
  });

  it('a clip that cannot be measured fails its signal checks instead of stopping the run', async () => {
    const h = harness();
    h.deps.measure.mockImplementation(async () => {
      throw new Error('ffmpeg failed');
    });
    expect(await runQa([...ARGS.slice(0, 4), '--only', 'giyeok'], {}, h.deps)).toBe(1);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    expect(report.clips[0].reasons).toEqual(['signal: could not be measured: ffmpeg failed']);
    expect(report.clips[0].signal).toBeNull();
  });

  it('a recognizer that cannot start (no model, a refused licence) is a usage error', async () => {
    const h = harness();
    h.deps.createRecognizers.mockImplementation(async () => {
      throw new Error('Pass 2 model refused: licence cc-by-nc-4.0 is not one of apache-2.0, ...');
    });
    expect(await runQa(ARGS, {}, h.deps)).toBe(2);
    expect(h.err[0]).toMatch(/licence cc-by-nc-4.0/);
  });

  it('merges a recorded owner listen into the report (a veto is regenerated)', async () => {
    const listen = { date: '2026-11-03', played: 2, vetoes: [{ key: 'giyeok', text: '가', note: '' }] };
    const h = harness({ extraFs: { [`${MASTERS}/owner-listen.json`]: JSON.stringify(listen) } });
    expect(await runQa([...ARGS.slice(0, 4), '--only', 'giyeok'], {}, h.deps)).toBe(1);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    expect(report.clips[0].verdict).toBe('pass');
    expect(report.regenerate.keys).toEqual(['giyeok']);
  });
});

describe('audio:tts:listen', () => {
  function listenHarness({ answers = null, files = ['giyeok.wav', 'kieuk.wav', 'kieuk.mp3'], withReport = false } = {}) {
    const h = harness({ files });
    const queue = answers === null ? null : [...answers];
    const played = [];
    const deps = {
      ...h.deps,
      romanize: (t) => ({ 가: 'ga', 카: 'ka', 기역: 'giyeok', 애: 'ae' })[t] ?? '?',
      play: vi.fn(async (f) => played.push(f.split('/').pop())),
      ask: queue === null ? null : vi.fn(async () => queue.shift() ?? ''),
    };
    return { ...h, deps, played, withReport };
  }

  it('reads the answers: Enter keeps, v vetoes, r replays, q stops', () => {
    expect(['', 'k', 'v', 'VETO', 'r', 'q', 'x'].map(answerOf)).toEqual(['keep', 'keep', 'veto', 'veto', 'replay', 'stop', 'unknown']);
    expect(parseListenArgs(['--pack', 'jamo-s1']).error).toMatch(/--engine and --voice/);
    expect(parseListenArgs(['--engine', 'polly', '--voice', 'Seoyeon']).error).toMatch(/--pack/);
  });

  it('plays every clip back to back, printing id, text and romanization; the processed MP3 when there is one', async () => {
    const h = listenHarness();
    expect(await runListen(['--pack', 'jamo-s1', '--engine', 'polly', '--voice', 'Seoyeon'], {}, h.deps)).toBe(0);
    expect(h.played).toEqual(['giyeok.wav', 'kieuk.mp3']);
    expect(h.out).toContain('1/3  giyeok  가  [ga]');
    expect(h.out).toContain('3/3  giyeok-name  기역  [giyeok]  (no clip)');
    expect(JSON.parse(h.fs.get(`${MASTERS}/owner-listen.json`))).toEqual({ date: '2026-11-02', played: 2, vetoes: [] });
  });

  it('records an interactive veto with its reason, after a replay', async () => {
    const h = listenHarness({ answers: ['r', 'v', 'sounds like a question', ''] });
    expect(await runListen(['--pack', 'jamo-s1', '--engine', 'polly', '--voice', 'Seoyeon'], {}, h.deps)).toBe(0);
    expect(h.played).toEqual(['giyeok.wav', 'giyeok.wav', 'kieuk.mp3']);
    expect(JSON.parse(h.fs.get(`${MASTERS}/owner-listen.json`)).vetoes).toEqual([{ key: 'giyeok', text: '가', note: 'sounds like a question' }]);
  });

  it('records --veto without asking, and updates an existing QA report', async () => {
    const h = listenHarness({ files: ['giyeok.wav', 'kieuk.wav', 'giyeok-name.wav'] });
    await runQa([...ARGS.slice(0, 4), '--only', 'giyeok,kieuk'], {}, h.deps);
    expect(JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`)).regenerate.keys).toEqual([]);
    expect(await runListen(['--pack', 'jamo-s1', '--engine', 'polly', '--voice', 'Seoyeon', '--veto', 'kieuk'], {}, h.deps)).toBe(0);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    expect(report.ownerListen.vetoes).toEqual([{ key: 'kieuk', text: '카', note: '' }]);
    expect(report.regenerate.keys).toEqual(['kieuk']);
    expect(h.fs.get(`${MASTERS}/qa-report.md`)).toMatch(/vetoed kieuk/);
  });

  it('refuses a veto of a clip outside the selection', async () => {
    const h = listenHarness();
    expect(await runListen(['--pack', 'jamo-s1', '--engine', 'polly', '--voice', 'Seoyeon', '--veto', 'ae'], {}, h.deps)).toBe(2);
    expect(h.err[0]).toMatch(/--veto: ae not in the selection/);
  });
});

describe('the CLI in its own process', () => {
  it('audio:tts:qa refuses in CI before loading any model', () => {
    const r = spawnSync(process.execPath, [join(APP_ROOT, 'scripts/audio/tts/qa.mjs'), ...ARGS], { encoding: 'utf8', env: { ...process.env, CI: 'true' } });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/refused: CI is set/);
  }, 120_000);
});
