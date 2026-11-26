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
import { clipFilesOf, clipRowMatcher, contrastRows, parseQaArgs, qaRefusalOf, runQa, selectContrastSets } from '../audio/tts/qa-run.mjs';

const APP_ROOT = join(__dirname, '..', '..');
const REPO = '/repo';
const MASTERS = `${REPO}/apps/mobile/recordings/tts/polly/Seoyeon`;
const FIXTURES = join(__dirname, '__fixtures__/tts-qa');
const GOOD = { probeJson: readFileSync(join(FIXTURES, 'ffprobe-good.json'), 'utf8'), log: readFileSync(join(FIXTURES, 'ffmpeg-good.txt'), 'utf8') };
const keys = { sayKey, sayRef };

const jamo = (key, text, kind = 'jamo-sound') => ({ ref: `audio/jamo/${key}.mp3`, key, kind, text, say: kind === 'jamo-sound' ? `${text}.` : text, rate: 0.85, pack: 'jamo-s1', sources: ['x'] });
const ASSETS = `${REPO}/apps/mobile/assets/audio`;
// A generated vocabulary row: keyed by hash, its processed clip named by the ref's slug (audio/vocab/gangaji.mp3).
const VOCAB = { ref: 'audio/vocab/gangaji.mp3', key: '94e82412553f09dd', kind: 'word', text: '강아지', say: '강아지', rate: 0.85, pack: 'stage1', sources: ['x'] };
const MANIFEST = { schemaVersion: 1, rows: [jamo('giyeok', '가'), jamo('kieuk', '카'), jamo('giyeok-name', '기역', 'jamo-name'), { ...jamo('ae', '애'), pack: 'jamo-wb' }, VOCAB] };
const lockOf = (rows) => ({ schemaVersion: 1, rows: rows.map((r) => ({ ref: r.ref, key: r.key, engine: 'polly', voice: 'Seoyeon', model: 'neural', rate: 0.85, generated: '2026-11-02', saySha256: saySha256(r.say), mp3Sha256: null })) });

/** In-memory effects for runQa: files, both recognizers mocked from a per-key script. */
function harness({ files = ['giyeok.wav', 'kieuk.wav', 'giyeok-name.wav'], dirs = {}, heard = {}, ignored = true, lock = lockOf(MANIFEST.rows), extraFs = {} } = {}) {
  const folders = { [MASTERS]: files, ...dirs };
  const fs = new Map([
    [`${REPO}/content/audio/tts-manifest.json`, JSON.stringify(MANIFEST)],
    [`${REPO}/content/audio/tts-lock.json`, JSON.stringify(lock)],
    [`${REPO}/content/audio/pronunciation-overrides.json`, JSON.stringify({ schemaVersion: 1, overrides: {} })],
    ...Object.entries(extraFs),
  ]);
  const slugKey = new Map([['gangaji', VOCAB.key]]);
  const keyOf = (file) => {
    const name = file.split('/').pop().replace(/\.(wav|mp3)$/, '');
    return slugKey.get(name) ?? name;
  };
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
    exists: (p) => fs.has(p) || p in folders || Object.entries(folders).some(([dir, names]) => names.some((n) => `${dir}/${n}` === p)),
    listDir: (dir) => (dir === MASTERS ? [...files, 'qa-report.md', '.DS_Store'] : folders[dir] ?? []),
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
    expect(parseQaArgs(ARGS).threshold).toBe(0.5);
    expect(parseQaArgs([...ARGS, '--say-bitrate', '64']).sayBitrate).toBe(64);
    expect(parseQaArgs([...ARGS, '--say-bitrate', '32']).error).toMatch(/--say-bitrate: --bitrate must be 64 or 48/);
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

  it('matches a pilot-only probe word (not a manifest row) through the selected rows, in the masters and in say/', () => {
    const probe = { ref: sayRef('신라'), key: sayKey('신라'), kind: 'word', text: '신라', say: '신라', rate: 0.9, pack: 'pilot', sources: ['pilot'] };
    const withoutSelection = clipRowMatcher(MANIFEST.rows);
    expect(withoutSelection(probe.key, MASTERS)).toBeNull();
    const matcher = clipRowMatcher(MANIFEST.rows, [probe]);
    expect(matcher(probe.key, MASTERS)).toBe(probe.key);
    expect(matcher(probe.key, `${ASSETS}/say`)).toBe(probe.key);
    expect(matcher('giyeok', MASTERS)).toBe('giyeok');
    expect(matcher('stray', MASTERS)).toBeNull();
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

  it('a clip that only Pass 1 passes still passes: Pass 2 is advisory and only flags a narrow margin', async () => {
    const h = harness({ heard: { kieuk: { free: '카', forced: '카', margin: 0.2 } } });
    expect(await runQa(ARGS.slice(0, 4).concat(['--only', 'giyeok,kieuk']), {}, h.deps)).toBe(0);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    const kieuk = report.clips.find((c) => c.key === 'kieuk');
    expect(kieuk.pass1.ok).toBe(true);
    expect(kieuk.pass2).toMatchObject({ ok: true, advisory: true, failures: [] });
    expect(kieuk.pass2.flags[0]).toMatch(/margin 0.2 nats .* is under 0.5/);
    expect(kieuk.verdict).toBe('pass');
    expect(report.regenerate.keys).toEqual([]);
    expect(report.summary).toMatchObject({ pass: 2, fail: 0, pass2Advisory: 1 });
  });

  it('a clip that Pass 1 fails is regenerated, with the exact --only command, whatever Pass 2 says', async () => {
    const h = harness({ heard: { kieuk: { free: '카', forced: '가', margin: 3 } } });
    expect(await runQa(ARGS.slice(0, 4).concat(['--only', 'giyeok,kieuk']), {}, h.deps)).toBe(1);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    expect(report.clips.find((c) => c.key === 'kieuk').verdict).toBe('fail');
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

  it('merges a recorded owner listen into the report (a veto of the clip played is regenerated)', async () => {
    const listen = { date: '2026-11-03', played: 2, vetoes: [{ key: 'giyeok', text: '가', note: '', sha256s: [saySha256(`${MASTERS}/giyeok.wav`)] }] };
    const h = harness({ extraFs: { [`${MASTERS}/owner-listen.json`]: JSON.stringify(listen) } });
    expect(await runQa([...ARGS.slice(0, 4), '--only', 'giyeok'], {}, h.deps)).toBe(1);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    expect(report.clips[0]).toMatchObject({ verdict: 'pass', vetoed: true });
    expect(report.summary).toMatchObject({ pass: 0, vetoed: 1 });
    expect(report.regenerate.keys).toEqual(['giyeok']);
  });

  it('a veto of a clip since regenerated no longer applies', async () => {
    const listen = { date: '2026-11-03', played: 2, vetoes: [{ key: 'giyeok', text: '가', note: '', sha256s: ['0'.repeat(64)] }] };
    const h = harness({ extraFs: { [`${MASTERS}/owner-listen.json`]: JSON.stringify(listen) } });
    expect(await runQa([...ARGS.slice(0, 4), '--only', 'giyeok'], {}, h.deps)).toBe(0);
    expect(JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`)).regenerate.keys).toEqual([]);
  });

  it('a master folder file of no manifest row is extra: an identity failure that fails the run', async () => {
    const h = harness({ files: ['giyeok.wav', 'kieuk.wav', 'giyeok-name.wav', 'stray.wav'] });
    expect(await runQa(ARGS, {}, h.deps)).toBe(1);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    expect(report.extra).toEqual(['apps/mobile/recordings/tts/polly/Seoyeon/stray.wav']);
    expect(report.regenerate.keys).toEqual([]);
    expect(h.out.some((l) => /1 extra files have no manifest row/.test(l))).toBe(true);
  });
});

describe('audio:tts:qa on processed MP3s', () => {
  const mp3Lock = (rows, sha = (r) => saySha256(`${ASSETS}/${r.ref.slice('audio/'.length)}`)) => ({
    schemaVersion: 1,
    rows: lockOf(rows).rows.map((l, i) => ({ ...l, mp3Sha256: sha(rows[i]) })),
  });

  it('matches a hash-keyed vocab row to its slug-named clip, checked at the vocab group bitrate (64 kbps, 44.1 kHz)', async () => {
    const h = harness({ dirs: { [`${ASSETS}/vocab`]: ['gangaji.mp3', 'recorded-only.mp3'] }, lock: mp3Lock(MANIFEST.rows) });
    // The good fixture is 1.14 s at 64 kbps / 44.1 kHz: a word clip in format.
    expect(await runQa([...ARGS.slice(0, 4), '--pack', 'stage1', '--dir', 'apps/mobile/assets/audio/vocab'], {}, h.deps)).toBe(0);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    expect(report.stage).toBe('processed');
    expect(report.missing).toEqual([]);
    expect(report.clips.map((c) => [c.key, c.file, c.verdict])).toEqual([[VOCAB.key, 'apps/mobile/assets/audio/vocab/gangaji.mp3', 'pass']]);
    // A recorded clip in the processed folder is not generated: listed, not extra.
    expect(report.extra).toEqual([]);
    expect(report.notGenerated).toEqual(['apps/mobile/assets/audio/vocab/recorded-only.mp3']);
  });

  it('adds the AC-B6 set total of each selected jamo pack, and fails the run on one over its limit', async () => {
    const dirs = { [`${ASSETS}/jamo`]: ['giyeok.mp3', 'kieuk.mp3', 'giyeok-name.mp3'] };
    const ok = harness({ dirs, lock: mp3Lock(MANIFEST.rows) });
    expect(await runQa([...ARGS, '--dir', 'apps/mobile/assets/audio/jamo'], {}, ok.deps)).toBe(0);
    expect(JSON.parse(ok.fs.get(`${MASTERS}/qa-report.json`)).packTotals).toEqual([
      { pack: 'jamo-s1', clips: 3, bytes: 3 * 9612, limit: { clips: 43, maxBytes: 520_000 }, ok: true, failures: [] },
    ]);
    const big = harness({ dirs, lock: mp3Lock(MANIFEST.rows) });
    const probe = JSON.parse(GOOD.probeJson);
    probe.format.size = '200000';
    big.deps.measure.mockImplementation(async () => ({ ...GOOD, probeJson: JSON.stringify(probe) }));
    expect(await runQa([...ARGS, '--dir', 'apps/mobile/assets/audio/jamo'], {}, big.deps)).toBe(1);
    const report = JSON.parse(big.fs.get(`${MASTERS}/qa-report.json`));
    expect(report.packTotals[0]).toMatchObject({ ok: false, failures: ['set total 600000 bytes: must be <= 520000'] });
    expect(big.out).toContain('pack jamo-s1: set total 600000 bytes: must be <= 520000');
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
    // Not interactive and no --veto: nothing is recorded, so an earlier listen is never overwritten.
    expect(h.fs.has(`${MASTERS}/owner-listen.json`)).toBe(false);
    expect(h.out.at(-1)).toBe('2 played; nothing recorded (not interactive and no --veto).');
  });

  it('records an interactive veto with its reason and the sha256 of the clip played, after a replay', async () => {
    const h = listenHarness({ answers: ['r', 'v', 'sounds like a question', ''] });
    expect(await runListen(['--pack', 'jamo-s1', '--engine', 'polly', '--voice', 'Seoyeon'], {}, h.deps)).toBe(0);
    expect(h.played).toEqual(['giyeok.wav', 'giyeok.wav', 'kieuk.mp3']);
    const listen = JSON.parse(h.fs.get(`${MASTERS}/owner-listen.json`));
    expect(listen.vetoes).toEqual([{ key: 'giyeok', text: '가', note: 'sounds like a question', sha256s: [saySha256(`${MASTERS}/giyeok.wav`)] }]);
    expect(listen.sessions).toEqual([{ date: '2026-11-02', selection: 'packs jamo-s1', played: 2, vetoed: ['giyeok'], kept: 1 }]);
  });

  it('keeps earlier vetoes when another pack is listened to; a clip kept again drops its veto', async () => {
    const earlier = { date: '2026-11-01', played: 3, vetoes: [{ key: 'giyeok', text: '가', note: 'flat', sha256s: ['1'.repeat(64)] }, { key: 'kieuk', text: '카', note: '', sha256s: ['2'.repeat(64)] }], sessions: [{ date: '2026-11-01', selection: 'packs jamo-s1', played: 3, vetoed: ['giyeok', 'kieuk'], kept: 1 }] };
    const h = listenHarness({ answers: ['', 'q'], files: ['giyeok.wav', 'kieuk.wav', 'ae.wav'] });
    h.fs.set(`${MASTERS}/owner-listen.json`, JSON.stringify(earlier));
    // Listening to jamo-wb (애) keeps both earlier vetoes.
    expect(await runListen(['--pack', 'jamo-wb', '--engine', 'polly', '--voice', 'Seoyeon'], {}, h.deps)).toBe(0);
    let listen = JSON.parse(h.fs.get(`${MASTERS}/owner-listen.json`));
    expect(listen.vetoes.map((v) => v.key)).toEqual(['giyeok', 'kieuk']);
    expect(listen.sessions.map((x) => x.selection)).toEqual(['packs jamo-s1', 'packs jamo-wb']);
    // Keeping 가 explicitly drops its veto; 카 was not reached (q), so its veto stays.
    const answers = ['', 'q'];
    h.deps.ask = vi.fn(async () => answers.shift() ?? '');
    expect(await runListen(['--pack', 'jamo-s1', '--engine', 'polly', '--voice', 'Seoyeon'], {}, h.deps)).toBe(0);
    listen = JSON.parse(h.fs.get(`${MASTERS}/owner-listen.json`));
    expect(listen.vetoes.map((v) => v.key)).toEqual(['kieuk']);
  });

  it('records only in a gitignored folder, by default the master folder even when playing another --dir', async () => {
    const refused = listenHarness();
    refused.deps.isIgnored = () => false;
    expect(await runListen(['--pack', 'jamo-s1', '--engine', 'polly', '--voice', 'Seoyeon', '--veto', 'giyeok'], {}, refused.deps)).toBe(2);
    expect(refused.err[0]).toMatch(/refused: apps\/mobile\/recordings\/tts\/polly\/Seoyeon is not gitignored/);
    expect(parseListenArgs(['--pack', 'jamo-s1', '--dir', 'apps/mobile/assets/audio/jamo']).error).toMatch(/with --dir, give --engine and --voice/);
    const h = harness({ dirs: { [`${ASSETS}/jamo`]: ['giyeok.mp3', 'kieuk.mp3'] } });
    const deps = { ...h.deps, romanize: () => '', play: vi.fn(async () => {}), ask: null, isIgnored: (dir) => !dir.includes('/assets/') };
    expect(await runListen(['--pack', 'jamo-s1', '--engine', 'polly', '--voice', 'Seoyeon', '--dir', 'apps/mobile/assets/audio/jamo', '--veto', 'kieuk'], {}, deps)).toBe(0);
    expect(h.fs.has(`${ASSETS}/jamo/owner-listen.json`)).toBe(false);
    // The veto holds the played MP3 and the row's master WAV: a QA run on either stage honours it.
    expect(JSON.parse(h.fs.get(`${MASTERS}/owner-listen.json`)).vetoes).toEqual([{ key: 'kieuk', text: '카', note: '', sha256s: [saySha256(`${ASSETS}/jamo/kieuk.mp3`), saySha256(`${MASTERS}/kieuk.wav`)] }]);
    expect(await runListen(['--pack', 'jamo-s1', '--dir', 'apps/mobile/assets/audio/jamo', '--out', 'apps/mobile/assets/audio/jamo', '--veto', 'kieuk'], {}, deps)).toBe(2);
  });

  it('records --veto without asking, and updates an existing QA report', async () => {
    const h = listenHarness({ files: ['giyeok.wav', 'kieuk.wav', 'giyeok-name.wav'] });
    await runQa([...ARGS.slice(0, 4), '--only', 'giyeok,kieuk'], {}, h.deps);
    expect(JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`)).regenerate.keys).toEqual([]);
    expect(await runListen(['--pack', 'jamo-s1', '--engine', 'polly', '--voice', 'Seoyeon', '--veto', 'kieuk'], {}, h.deps)).toBe(0);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    expect(report.ownerListen.vetoes).toEqual([{ key: 'kieuk', text: '카', note: '', sha256s: [saySha256(`${MASTERS}/kieuk.wav`)] }]);
    expect(report.regenerate.keys).toEqual(['kieuk']);
    expect(h.fs.get(`${MASTERS}/qa-report.md`)).toMatch(/vetoed kieuk/);
  });

  it('refuses a veto of a clip outside the selection', async () => {
    const h = listenHarness();
    expect(await runListen(['--pack', 'jamo-s1', '--engine', 'polly', '--voice', 'Seoyeon', '--veto', 'ae'], {}, h.deps)).toBe(2);
    expect(h.err[0]).toMatch(/--veto: ae not in the selection/);
  });
});

// --- The contrast-set gate and the blind listen (AMENDMENTS-MINIMAL-PAIRS sections 3.2 and 3.3; row MP-1a) ---------------

const member = (text, rom, ref, kind) => ({ text, romanization: rom, en: `the syllable ${rom}`, ref, kind });
const GA_KA = { id: 'ga-ka', series: 'k', unit: 'minigame:s1-life-q3-pairs', members: [member('가', 'ga', 'audio/jamo/giyeok.mp3', 'plain'), member('카', 'ka', 'audio/jamo/kieuk.mp3', 'aspirated')] };
const SADA = { id: 'sada-ssada', series: 's', unit: 'minigame:s2-letters-q2-pairs', members: [
  { text: '사다', romanization: 'sada', en: 'to buy', ref: 'audio/say/ee0ee072926e06fc.mp3', kind: 'plain' },
  { text: '싸다', romanization: 'ssada', en: 'cheap', ref: 'audio/say/b291179e0fe019b6.mp3', kind: 'tense' },
] };
const DAL = { id: 'dal-tal-ttal', series: 't', unit: 'minigame:s2-letters-q2-pairs', members: [
  { text: '달', romanization: 'dal', en: 'moon', ref: 'audio/say/2f941e6eb2150679.mp3', kind: 'plain' },
  { text: '탈', romanization: 'tal', en: 'mask', ref: 'audio/say/a61623942ca7dcd4.mp3', kind: 'aspirated' },
  { text: '딸', romanization: 'ttal', en: 'daughter', ref: 'audio/say/11cf51a3ca8b5108.mp3', kind: 'tense' },
] };
const CATALOGUE = { schemaVersion: 1, sets: [GA_KA, SADA, DAL] };
const CATALOGUE_PATH = `${REPO}/content/audio/contrast-sets.json`;

describe('audio:tts:qa --contrast', () => {
  const CONTRAST_ARGS = ['--engine', 'polly', '--voice', 'Seoyeon', '--contrast', 'ga-ka', '--dir', MASTERS];
  const contrastHarness = (opts = {}) => harness({ ...opts, extraFs: { [CATALOGUE_PATH]: JSON.stringify(CATALOGUE), ...(opts.extraFs ?? {}) } });

  it('selects its own rows: the members of the named sets, across packs, never combined with another selection', () => {
    expect(parseQaArgs(['--engine', 'polly', '--voice', 'Seoyeon', '--contrast', 'ga-ka,go-ko'])).toMatchObject({ contrast: ['ga-ka', 'go-ko'] });
    expect(parseQaArgs(['--engine', 'polly', '--voice', 'Seoyeon', '--contrast', 'all']).contrast).toEqual(['all']);
    expect(parseQaArgs([...ARGS, '--contrast', 'all']).error).toMatch(/cannot be combined with --pilot, --pack or --only/);
    expect(parseQaArgs(['--engine', 'polly', '--voice', 'Seoyeon', '--contrast', 'all,ga-ka']).error).toMatch(/all cannot be combined/);
    expect(parseQaArgs(['--engine', 'polly', '--voice', 'Seoyeon']).error).toMatch(/--pack, --pilot or --only/);
    const sets = selectContrastSets(CATALOGUE, ['all']);
    expect(sets).toHaveLength(3);
    expect(selectContrastSets(CATALOGUE, ['sada-ssada']).map((s) => s.id)).toEqual(['sada-ssada']);
    expect(() => selectContrastSets(CATALOGUE, ['nope'])).toThrow(/no set nope; sets: ga-ka, sada-ssada, dal-tal-ttal/);
    const manifestRows = [...MANIFEST.rows, { ...jamo('giyeok', '가'), ref: 'audio/say/64ee5293d31bc58b.mp3', key: '64ee5293d31bc58b', kind: 'syllable', pack: 'stage1' }];
    expect(contrastRows(manifestRows, [GA_KA]).map((r) => r.key)).toEqual(['giyeok', 'kieuk']);
  });

  it('passes a set whose members agree, writes the set table into both reports and exits 0', async () => {
    const h = contrastHarness();
    expect(await runQa(CONTRAST_ARGS, {}, h.deps)).toBe(0);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    expect(report.summary).toMatchObject({ rows: 2, clips: 2, pass: 2, fail: 0, contrastSets: { sets: 1, pass: 1, fail: 0 } });
    expect(report.selection.contrast).toEqual(['ga-ka']);
    expect(report.selectionLabel).toBe('contrast sets ga-ka');
    expect(report.contrastSets).toHaveLength(1);
    expect(report.contrastSets[0]).toMatchObject({ id: 'ga-ka', ok: true, regenerate: [], owner: { computer: 'not done', phone: 'not done' } });
    expect(Object.values(report.contrastSets[0].gates).every((g) => g.ok)).toBe(true);
    expect(report.contrastSets[0].margins).toEqual([{ text: '가', margin: 5, over: '카' }, { text: '카', margin: 5, over: '가' }]);
    const md = h.fs.get(`${MASTERS}/qa-report.md`);
    expect(md).toMatch(/## Contrast sets \(set gate, AMENDMENTS-MINIMAL-PAIRS section 3\.2\)/);
    expect(md).toMatch(/\| Set \| Members \| G1 \| G2 \| G3 \| G4 \| G5 \| G6 \| Pass 2 margin \(nats, advisory\) \| Owner listen \| Set \|/);
    expect(md).toMatch(/\| ga-ka \| 가 카 \| pass \| pass \| pass \| pass \| pass \| pass \| 가 5 over 카, 카 5 over 가 \| computer not done; phone not done \| pass \|/);
    expect(h.out).toContain('1 of 1 contrast sets pass the set gate (G1-G6).');
  });

  it('puts the whole series into the forced-choice grammar of a member (G2), a pair included', async () => {
    const h = contrastHarness();
    await runQa(CONTRAST_ARGS, {}, h.deps);
    const calls = h.pass1.forcedChoice.mock.calls.map(([, candidates]) => candidates);
    expect(calls.length).toBeGreaterThan(0);
    for (const candidates of calls) for (const form of ['가', '카', '까']) expect(candidates).toContain(form);
  });

  it('G2: a 가 whose series forced choice returns 까 fails the set, which names the clip to regenerate', async () => {
    const h = contrastHarness({ heard: { giyeok: { free: '가', forced: '까' } } });
    expect(await runQa(CONTRAST_ARGS, {}, h.deps)).toBe(1);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    const set = report.contrastSets[0];
    expect(set.ok).toBe(false);
    expect(set.gates.G2.failures).toEqual(['가: the series forced choice heard "까"']);
    expect(report.regenerate.keys).toEqual(['giyeok']);
    expect(report.regenerate.commands.at(-1)).toMatch(/audio:tts:generate --engine polly --voice Seoyeon --only giyeok$/);
    expect(report.summary.contrastSets).toEqual({ sets: 1, pass: 0, fail: 1 });
    expect(h.fs.get(`${MASTERS}/qa-report.md`)).toMatch(/\| ga-ka \| 가 카 \| fail: 가: fails the per-clip gate .*\| fail: 가: the series forced choice heard "까" \|/);
    expect(h.out).toContain('  set ga-ka fails G1, G2');
  });

  it('G3: a set whose members end differently fails with nothing to regenerate (a content decision) and exits 1', async () => {
    const rows = MANIFEST.rows.map((r) => (r.key === 'kieuk' ? { ...r, say: '카!' } : r));
    const h = contrastHarness({ lock: lockOf(rows), extraFs: { [`${REPO}/content/audio/tts-manifest.json`]: JSON.stringify({ schemaVersion: 1, rows }) } });
    expect(await runQa(CONTRAST_ARGS, {}, h.deps)).toBe(1);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    expect(report.summary).toMatchObject({ pass: 2, fail: 0 });
    expect(report.contrastSets[0].gates.G3.failures[0]).toMatch(/가 sent as "가\.", 카 sent as "카!"/);
    expect(report.regenerate.keys).toEqual([]);
    expect(h.out).toContain('  set ga-ka fails G3 (nothing to regenerate: a content decision, section 3.2 "When a set fails")');
  });

  it('G4: two members that are the same bytes fail', async () => {
    const h = contrastHarness();
    const sha = h.deps.sha256File;
    h.deps.sha256File = async (p) => (p.endsWith('kieuk.wav') ? sha(`${MASTERS}/giyeok.wav`) : sha(p));
    expect(await runQa(CONTRAST_ARGS, {}, h.deps)).toBe(1);
    const set = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`)).contrastSets[0];
    expect(set.gates.G4.failures).toEqual(['가 and 카 are byte-identical']);
    // The per-clip identity check fails both byte-identical letters too; the set names them all.
    expect(set.regenerate).toContain('kieuk');
  });

  it('G6: a member in a pack the quest does not load fails the set', async () => {
    const rows = MANIFEST.rows.map((r) => (r.key === 'kieuk' ? { ...r, pack: 'stage3' } : r));
    const h = contrastHarness({ extraFs: { [`${REPO}/content/audio/tts-manifest.json`]: JSON.stringify({ schemaVersion: 1, rows }) } });
    expect(await runQa(CONTRAST_ARGS, {}, h.deps)).toBe(1);
    expect(JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`)).contrastSets[0].gates.G6.failures[0]).toMatch(/카 is in pack stage3/);
  });

  it('a member with no clip fails the set and is listed as missing; the other gates are not run', async () => {
    const h = contrastHarness({ files: ['giyeok.wav'] });
    expect(await runQa(CONTRAST_ARGS, {}, h.deps)).toBe(1);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    expect(report.missing).toEqual(['kieuk']);
    expect(report.contrastSets[0].gates.G1.failures).toEqual(['카: no clip']);
    expect(report.contrastSets[0].gates.G2.ran).toBe(false);
    expect(h.fs.get(`${MASTERS}/qa-report.md`)).toMatch(/\| ga-ka \| 가 카 \(no clip\) \| fail: 카: no clip \| not run \(a member has no clip\)/);
  });

  it('a veto of a member in the owner listen fails G1 of its set', async () => {
    const h = contrastHarness();
    h.fs.set(`${MASTERS}/owner-listen.json`, JSON.stringify({ date: '2026-11-01', played: 1, vetoes: [{ key: 'kieuk', text: '카', note: '', sha256s: [] }], sessions: [] }));
    expect(await runQa(CONTRAST_ARGS, {}, h.deps)).toBe(1);
    const set = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`)).contrastSets[0];
    expect(set.gates.G1.failures).toEqual(['카: vetoed in the owner listen']);
  });

  it('reads the owner\'s blind listen next to the report: pass per speaker, or "clip changed" when the MP3 is not the one heard', async () => {
    const sha = (key) => saySha256(`${MASTERS}/${key}.wav`);
    const run = (date, pass, shas) => ({ date, speaker: 'computer', pass, correct: 6, total: 6, mp3Sha256: shas });
    const listen = (computer, phone) => JSON.stringify({ schemaVersion: 1, sets: { 'ga-ka': { runs: { ...(computer ? { computer } : {}), ...(phone ? { phone } : {}) } } } });
    const heard = { 'audio/jamo/giyeok.mp3': sha('giyeok'), 'audio/jamo/kieuk.mp3': sha('kieuk') };
    const h = contrastHarness({ extraFs: { [`${MASTERS}/owner-contrast.json`]: listen(run('2026-11-26', true, heard), run('2026-11-27', false, heard)) } });
    await runQa(CONTRAST_ARGS, {}, h.deps);
    expect(JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`)).contrastSets[0].owner).toEqual({ computer: 'pass (2026-11-26)', phone: 'fail (2026-11-27)' });
    expect(h.fs.get(`${MASTERS}/qa-report.md`)).toMatch(/computer pass \(2026-11-26\); phone fail \(2026-11-27\)/);
    const changed = contrastHarness({ extraFs: { [`${MASTERS}/owner-contrast.json`]: listen(run('2026-11-26', true, { ...heard, 'audio/jamo/kieuk.mp3': 'f'.repeat(64) })) } });
    await runQa(CONTRAST_ARGS, {}, changed.deps);
    expect(JSON.parse(changed.fs.get(`${MASTERS}/qa-report.json`)).contrastSets[0].owner).toEqual({ computer: 'clip changed since 2026-11-26', phone: 'not done' });
  });

  it('checks the processed MP3s of the jamo and say folders by default, and --contrast-sets reads another catalogue', async () => {
    const mp3 = (r) => saySha256(`${ASSETS}/${r.ref.slice('audio/'.length)}`);
    const lock = { schemaVersion: 1, rows: lockOf(MANIFEST.rows).rows.map((l, i) => ({ ...l, mp3Sha256: mp3(MANIFEST.rows[i]) })) };
    const h = harness({ dirs: { [`${ASSETS}/jamo`]: ['giyeok.mp3', 'kieuk.mp3', 'giyeok-name.mp3'], [`${ASSETS}/say`]: ['other.mp3'] }, lock, extraFs: { [`${REPO}/tmp/sets.json`]: JSON.stringify(CATALOGUE) } });
    expect(await runQa(['--engine', 'polly', '--voice', 'Seoyeon', '--contrast', 'ga-ka', '--contrast-sets', 'tmp/sets.json'], {}, h.deps)).toBe(0);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    expect(report.stage).toBe('processed');
    expect(report.folders).toEqual(['apps/mobile/assets/audio/jamo', 'apps/mobile/assets/audio/say']);
    expect(report.contrastSets[0].ok).toBe(true);
    // Only the clips of the set are hashed and checked: the rest of a processed folder is not this run's business.
    expect(report.extra).toEqual([]);
    expect(report.clips.map((c) => c.key)).toEqual(['giyeok', 'kieuk']);
  });

  it('a set id that is not in the catalogue is a usage error', async () => {
    const h = contrastHarness();
    expect(await runQa([...CONTRAST_ARGS.slice(0, 4), '--contrast', 'nope', '--dir', MASTERS], {}, h.deps)).toBe(2);
    expect(h.err[0]).toMatch(/--contrast: no set nope/);
  });

  it('a later owner listen keeps the set table of the report (the veto adds the member to the rows to regenerate)', async () => {
    const h = contrastHarness();
    await runQa(CONTRAST_ARGS, {}, h.deps);
    const deps = { ...h.deps, romanize: () => '', play: vi.fn(async () => {}), ask: null };
    expect(await runListen(['--pack', 'jamo-s1', '--engine', 'polly', '--voice', 'Seoyeon', '--veto', 'kieuk'], {}, deps)).toBe(0);
    const report = JSON.parse(h.fs.get(`${MASTERS}/qa-report.json`));
    expect(report.contrastSets).toHaveLength(1);
    expect(report.summary.contrastSets).toEqual({ sets: 1, pass: 1, fail: 0 });
    expect(report.regenerate.keys).toEqual(['kieuk']);
  });
});

describe('audio:tts:listen --contrast', () => {
  const ASSET_FILES = {
    'audio/jamo/giyeok.mp3': `${ASSETS}/jamo/giyeok.mp3`,
    'audio/jamo/kieuk.mp3': `${ASSETS}/jamo/kieuk.mp3`,
    'audio/say/ee0ee072926e06fc.mp3': `${ASSETS}/say/ee0ee072926e06fc.mp3`,
    'audio/say/b291179e0fe019b6.mp3': `${ASSETS}/say/b291179e0fe019b6.mp3`,
    'audio/say/2f941e6eb2150679.mp3': `${ASSETS}/say/2f941e6eb2150679.mp3`,
    'audio/say/a61623942ca7dcd4.mp3': `${ASSETS}/say/a61623942ca7dcd4.mp3`,
    'audio/say/11cf51a3ca8b5108.mp3': `${ASSETS}/say/11cf51a3ca8b5108.mp3`,
  };
  const ROMAN = { 가: 'ga', 카: 'ka', 까: 'kka', 사다: 'sada', 싸다: 'ssada', 달: 'dal', 탈: 'tal', 딸: 'ttal' };
  const LISTEN_ARGS = ['--contrast', 'ga-ka', '--engine', 'polly', '--voice', 'Seoyeon'];

  /** In-memory effects: the processed MP3s exist and are in the lock, the plays come back in reverse order (deterministic). */
  function contrastListen({ answers, present = Object.keys(ASSET_FILES), lockShas = {}, previous = null, ignored = true } = {}) {
    const lock = {
      schemaVersion: 1,
      rows: Object.entries(ASSET_FILES).map(([ref, path]) => ({ ref, key: 'k', engine: 'polly', voice: 'Seoyeon', model: 'neural', rate: 0.85, generated: '2026-11-07', saySha256: saySha256('x'), mp3Sha256: lockShas[ref] ?? saySha256(path) })),
    };
    const fs = new Map([
      [CATALOGUE_PATH, JSON.stringify(CATALOGUE)],
      [`${REPO}/content/audio/tts-lock.json`, JSON.stringify(lock)],
      ...(previous === null ? [] : [[`${MASTERS}/owner-contrast.json`, JSON.stringify(previous)]]),
    ]);
    const present_ = new Set(present.map((ref) => ASSET_FILES[ref]));
    const queue = answers === null ? null : [...answers];
    const out = [];
    const err = [];
    const played = [];
    const asked = [];
    const deps = {
      repoRoot: REPO,
      readText: (p) => {
        if (!fs.has(p)) throw new Error(`ENOENT ${p}`);
        return fs.get(p);
      },
      exists: (p) => fs.has(p) || present_.has(p),
      writeAtomic: (p, text) => fs.set(p, text),
      isIgnored: () => ignored,
      sha256File: async (p) => saySha256(p),
      romanize: (t) => ROMAN[t] ?? '?',
      play: vi.fn(async (f) => played.push(f.split('/').pop())),
      ask: queue === null ? null : vi.fn(async (q) => {
        asked.push(q);
        return queue.shift() ?? 'q';
      }),
      shuffle: (list) => [...list].reverse(),
      now: () => new Date('2026-11-26T10:00:00Z'),
      out: (l) => out.push(l),
      err: (l) => err.push(l),
    };
    return { deps, fs, out, err, played, asked };
  }

  it('reads its arguments: a mode of its own that records next to the QA report', () => {
    expect(parseListenArgs(LISTEN_ARGS)).toMatchObject({ contrast: ['ga-ka'], speaker: 'computer', engine: 'polly', voice: 'Seoyeon' });
    expect(parseListenArgs(['--contrast', 'all', '--engine', 'polly', '--voice', 'Seoyeon', '--speaker', 'phone']).speaker).toBe('phone');
    expect(parseListenArgs(['--contrast', 'all']).error).toMatch(/--contrast needs --engine and --voice/);
    expect(parseListenArgs([...LISTEN_ARGS, '--pack', 'jamo-s1']).error).toMatch(/cannot be combined/);
    expect(parseListenArgs([...LISTEN_ARGS, '--speaker', 'tablet']).error).toMatch(/--speaker must be computer or phone/);
    expect(parseListenArgs(['--contrast', 'all,ga-ka', '--engine', 'polly', '--voice', 'Seoyeon']).error).toMatch(/all cannot be combined/);
    expect(parseListenArgs(['--pack', 'jamo-s1', '--engine', 'polly', '--voice', 'Seoyeon', '--speaker', 'phone']).error).toMatch(/belong to --contrast/);
  });

  it('asks the whole series blind, each member three times in a shuffled order, then plays the set side by side and asks the two questions', async () => {
    // reverse order of [가 가 가 카 카 카]: 카 카 카 가 가 가; the series is 1 가, 2 카, 3 까.
    const h = contrastListen({ answers: ['2', '2', '2', '1', '1', '1', 'y', 'y'] });
    expect(await runListen(LISTEN_ARGS, {}, h.deps)).toBe(0);
    expect(h.out).toContain('\nset ga-ka (1/1): which one is it?');
    expect(h.out).toContain('  1  가  [ga]');
    expect(h.out).toContain('  2  카  [ka]');
    expect(h.out).toContain('  3  까  [kka]');
    // Nothing about right or wrong is shown before the set ends.
    expect(h.out.findIndex((l) => /PASS|FAIL/.test(l))).toBe(h.out.length - 3);
    expect(h.played).toEqual(['kieuk.mp3', 'kieuk.mp3', 'kieuk.mp3', 'giyeok.mp3', 'giyeok.mp3', 'giyeok.mp3', 'giyeok.mp3', 'kieuk.mp3', 'giyeok.mp3', 'kieuk.mp3']);
    expect(h.asked.slice(0, 6).every((q) => /^  play \d\/6: 1-3, r replays, q stops: $/.test(q))).toBe(true);
    expect(h.asked[6]).toBe('  Same calm voice, same speed and tune; only the first sound differs? (y/n, q stops): ');
    expect(h.asked[7]).toBe('  가 soft and lower at the start; 카 a clear puff and higher? (y/n, q stops): ');
    expect(h.out).toContain('  ga-ka: PASS (6 of 6 right; sameFrame y, kinds y)');
    const record = JSON.parse(h.fs.get(`${MASTERS}/owner-contrast.json`));
    expect(record.schemaVersion).toBe(1);
    expect(record.sets['ga-ka'].runs.computer).toMatchObject({
      date: '2026-11-26',
      speaker: 'computer',
      pass: true,
      correct: 6,
      total: 6,
      answers: { sameFrame: 'y', kinds: 'y' },
      note: '',
      mp3Sha256: { 'audio/jamo/giyeok.mp3': saySha256(`${ASSETS}/jamo/giyeok.mp3`), 'audio/jamo/kieuk.mp3': saySha256(`${ASSETS}/jamo/kieuk.mp3`) },
    });
    expect(record.sets['ga-ka'].runs.computer.plays).toHaveLength(6);
    expect(record.sets['ga-ka'].runs.computer.plays[0]).toEqual({ member: '카', ref: 'audio/jamo/kieuk.mp3', heard: '카', correct: true });
    expect(h.out.at(-1)).toMatch(/Once more with the sound on a phone-sized speaker: add --speaker phone/);
  });

  it('fails the set on one wrong play, or on one n, and keeps the note; a bad number or r plays the clip again', async () => {
    const wrong = contrastListen({ answers: ['9', '2', '2', '2', '1', '3', '1', 'y', 'y', 'the 카 sounded tense'] });
    expect(await runListen(LISTEN_ARGS, {}, wrong.deps)).toBe(0);
    const run = JSON.parse(wrong.fs.get(`${MASTERS}/owner-contrast.json`)).sets['ga-ka'].runs.computer;
    expect(run).toMatchObject({ pass: false, correct: 5, total: 6, note: 'the 카 sounded tense' });
    expect(run.plays.filter((p) => !p.correct)).toEqual([{ member: '가', ref: 'audio/jamo/giyeok.mp3', heard: '까', correct: false }]);
    // The bad answer "9" played the first clip again.
    expect(wrong.played.slice(0, 2)).toEqual(['kieuk.mp3', 'kieuk.mp3']);
    expect(wrong.out).toContain('  ga-ka: FAIL (5 of 6 right; sameFrame y, kinds y)');

    const no = contrastListen({ answers: ['2', '2', '2', '1', '1', '1', 'y', 'n', ''] });
    await runListen(LISTEN_ARGS, {}, no.deps);
    expect(JSON.parse(no.fs.get(`${MASTERS}/owner-contrast.json`)).sets['ga-ka'].runs.computer).toMatchObject({ pass: false, correct: 6, answers: { sameFrame: 'y', kinds: 'n' } });
  });

  it('asks ㅅ / ㅆ its own question, and a word set whether each one sounds like the word; a triple has nine plays and its whole series', async () => {
    const sada = contrastListen({ answers: ['2', '2', '2', '1', '1', '1', 'y', 'y', 'y'] });
    expect(await runListen(['--contrast', 'sada-ssada', '--engine', 'polly', '--voice', 'Seoyeon'], {}, sada.deps)).toBe(0);
    expect(sada.asked[7]).toBe('  사다 breathy, 싸다 a longer, sharper hiss; both start high? (y/n, q stops): ');
    expect(sada.asked[8]).toBe('  Each one sounds like the word? (y/n, q stops): ');
    expect(JSON.parse(sada.fs.get(`${MASTERS}/owner-contrast.json`)).sets['sada-ssada'].runs.computer.answers).toEqual({ sameFrame: 'y', kinds: 'y', wordSounds: 'y' });
    expect(sada.out).toContain('  2  싸다  [ssada]');

    // 달 탈 딸: the plays are [달 달 달 탈 탈 탈 딸 딸 딸] reversed.
    const dal = contrastListen({ answers: ['3', '3', '3', '2', '2', '2', '1', '1', '1', 'y', 'y', 'y'] });
    expect(await runListen(['--contrast', 'dal-tal-ttal', '--engine', 'polly', '--voice', 'Seoyeon'], {}, dal.deps)).toBe(0);
    expect(dal.asked.filter((q) => /^  play /.test(q))).toHaveLength(9);
    expect(dal.asked[10]).toBe('  달 soft and lower at the start; 탈 a clear puff and higher; 딸 tight, no puff, higher? (y/n, q stops): ');
    expect(JSON.parse(dal.fs.get(`${MASTERS}/owner-contrast.json`)).sets['dal-tal-ttal'].runs.computer).toMatchObject({ pass: true, correct: 9, total: 9 });
  });

  it('q stops: the set in progress is not recorded, earlier sets stay; a phone run is kept beside the computer run', async () => {
    const prior = { schemaVersion: 1, sets: { 'ga-ka': { runs: { computer: { date: '2026-11-25', speaker: 'computer', pass: true, correct: 6, total: 6, mp3Sha256: {} } } } } };
    const stopped = contrastListen({ answers: ['2', 'q'], previous: prior });
    expect(await runListen(['--contrast', 'ga-ka,sada-ssada', '--engine', 'polly', '--voice', 'Seoyeon'], {}, stopped.deps)).toBe(0);
    expect(JSON.parse(stopped.fs.get(`${MASTERS}/owner-contrast.json`))).toEqual(prior);
    const phone = contrastListen({ answers: ['2', '2', '2', '1', '1', '1', 'y', 'y'], previous: prior });
    expect(await runListen([...LISTEN_ARGS, '--speaker', 'phone'], {}, phone.deps)).toBe(0);
    const runs = JSON.parse(phone.fs.get(`${MASTERS}/owner-contrast.json`)).sets['ga-ka'].runs;
    expect(Object.keys(runs).sort()).toEqual(['computer', 'phone']);
    expect(runs.computer.date).toBe('2026-11-25');
    expect(runs.phone).toMatchObject({ speaker: 'phone', pass: true });
    expect(phone.out.at(-1)).not.toMatch(/Once more/);
  });

  it('skips a set whose MP3 is missing or is not the one the lock holds, naming why, and exits 1', async () => {
    const missing = contrastListen({ answers: [], present: ['audio/jamo/giyeok.mp3'] });
    expect(await runListen(LISTEN_ARGS, {}, missing.deps)).toBe(1);
    expect(missing.out.find((l) => /skipped/.test(l))).toMatch(/set ga-ka \(1\/1\): skipped\. 카: no processed MP3 at apps\/mobile\/assets\/audio\/jamo\/kieuk\.mp3/);
    expect(missing.fs.has(`${MASTERS}/owner-contrast.json`)).toBe(false);
    const changed = contrastListen({ answers: [], lockShas: { 'audio/jamo/kieuk.mp3': 'e'.repeat(64) } });
    expect(await runListen(LISTEN_ARGS, {}, changed.deps)).toBe(1);
    expect(changed.out.find((l) => /skipped/.test(l))).toMatch(/is not the MP3 the lock holds for polly\/Seoyeon \(finish the hand-off first\)/);
    expect(changed.played).toEqual([]);
  });

  it('refuses without a terminal, outside a gitignored folder and for an unknown set', async () => {
    const noTerminal = contrastListen({ answers: null });
    expect(await runListen(LISTEN_ARGS, {}, noTerminal.deps)).toBe(2);
    expect(noTerminal.err[0]).toMatch(/needs a terminal/);
    const open = contrastListen({ answers: [], ignored: false });
    expect(await runListen(LISTEN_ARGS, {}, open.deps)).toBe(2);
    expect(open.err[0]).toMatch(/is not gitignored/);
    const unknown = contrastListen({ answers: [] });
    expect(await runListen(['--contrast', 'nope', '--engine', 'polly', '--voice', 'Seoyeon'], {}, unknown.deps)).toBe(2);
    expect(unknown.err[0]).toMatch(/--contrast: no set nope/);
  });
});

describe('the CLI in its own process', () => {
  it('audio:tts:qa refuses in CI before loading any model', () => {
    const r = spawnSync(process.execPath, [join(APP_ROOT, 'scripts/audio/tts/qa.mjs'), ...ARGS], { encoding: 'utf8', env: { ...process.env, CI: 'true' } });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/refused: CI is set/);
  }, 120_000);
});
