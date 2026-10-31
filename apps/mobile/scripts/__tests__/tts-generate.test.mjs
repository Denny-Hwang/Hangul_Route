// The generator (AMENDMENTS-AUDIO-CLIPS AC-B5 step 2 and key safety, 8.2, 11 row AC-3): arguments, the refusals
// (agent and CI shells, a folder git does not ignore, generative voices), the pilot selection, the lock and its
// skip rule, the dry-run character count and the --max-chars spend guard. Every run here is either --dry-run or
// in-process with a mocked client: no network, no vendor SDK, no credential.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sayKey, sayRef } from '@hangul-route/content-schema';
import { describe, expect, it, vi } from 'vitest';
import { azure } from '../audio/tts/engines/azure.mjs';
import { engineOf } from '../audio/tts/engines/index.mjs';
import {
  BUDGET_USD,
  MAX_CHARS_HEADROOM,
  OUTPUT_ROOT,
  PILOT_CONTENT_WORDS,
  PILOT_PROBE_WORDS,
  PILOT_SENTENCES,
  REFUSED_ENV,
  budgetChars,
  defaultMaxChars,
  insideRepo,
  outputProblem,
  parseArgs,
  pilotRows,
  refusalOf,
  runGenerate,
  selectRows,
  wavInfo,
} from '../audio/tts/generate-lib.mjs';
import { LOCK_FILE, parseLock, saySha256 } from '../audio/tts/lock-lib.mjs';
import { MANIFEST_FILE } from '../audio/tts/manifest-lib.mjs';

const APP_ROOT = join(__dirname, '..', '..');
const REPO_ROOT = join(APP_ROOT, '..', '..');
const GENERATE = join(APP_ROOT, 'scripts/audio/tts/generate.mjs');
const MANIFEST = JSON.parse(readFileSync(join(REPO_ROOT, MANIFEST_FILE), 'utf8'));
const keys = { sayKey, sayRef };
const TIMEOUT = 120_000;

/** A minimal RIFF/WAVE header (PCM, 16-bit) with no samples. */
function wav(sampleRate, channels = 1) {
  const b = Buffer.alloc(44);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36, 4);
  b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii');
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(channels, 22);
  b.writeUInt32LE(sampleRate, 24);
  b.writeUInt32LE(sampleRate * channels * 2, 28);
  b.writeUInt16LE(channels * 2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(0, 40);
  return b;
}

const row = (key, say, extra = {}) => ({ ref: `audio/say/${key}.mp3`, key, kind: 'word', text: say, say, rate: 0.9, pack: 'stage2', sources: ['x'], ...extra });
const SMALL = { schemaVersion: 1, rows: [row('aaaaaaaaaaaaaaaa', '가방'), row('bbbbbbbbbbbbbbbb', '나무'), row('cccccccccccccccc', '다리'), row('dddddddddddddddd', '학교', { pack: 'stage6' })] };

/** In-memory effects for runGenerate: a fake file system and a mocked vendor client. */
function harness({ manifest = SMALL, files = {}, ignored = true, synth, rateOut, decoder = true, engines } = {}) {
  const fs = new Map(Object.entries(files));
  fs.set(`/repo/${MANIFEST_FILE}`, JSON.stringify(manifest));
  const sent = [];
  const out = [];
  const err = [];
  const client = {
    synthesize: vi.fn(
      synth ??
        (async (payload) => {
          sent.push(payload);
          return { bytes: wav(rateOut ?? 24000), format: 'wav' };
        }),
    ),
  };
  const deps = {
    repoRoot: '/repo',
    readText: vi.fn((p) => {
      if (!fs.has(p)) throw new Error(`ENOENT ${p}`);
      return String(fs.get(p));
    }),
    exists: (p) => fs.has(p),
    writeAtomic: vi.fn((p, data) => fs.set(p, data)),
    mkdirp: vi.fn(),
    isIgnored: vi.fn(() => ignored),
    createClient: vi.fn(async () => client),
    canDecode: vi.fn(() => decoder),
    toWav: vi.fn(async (_bytes, _format, sampleRate) => wav(sampleRate)),
    now: () => new Date('2026-11-02T10:00:00Z'),
    keys,
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  };
  if (engines !== undefined) deps.engineOf = (id) => engines[id] ?? engineOf(id);
  const lock = () => parseLock(JSON.parse(fs.get(`/repo/${LOCK_FILE}`)));
  return { deps, fs, sent, out, err, client, lock };
}

describe('arguments', () => {
  it('reads the spec command line', () => {
    expect(parseArgs(['--engine', 'polly', '--pilot'])).toMatchObject({ engine: 'polly', pilot: true, dryRun: false, voices: undefined });
    expect(parseArgs(['--engine', 'google', '--voice', 'ko-KR-Neural2-A', '--pack', 'jamo-s1,jamo-wb', '--max-chars', '9000', '--dry-run'])).toMatchObject({
      engine: 'google',
      voices: ['ko-KR-Neural2-A'],
      packs: ['jamo-s1', 'jamo-wb'],
      maxChars: 9000,
      dryRun: true,
    });
    expect(parseArgs(['--engine', 'azure', '--voice', 'ko-KR-SunHiNeural', '--only', 'giyeok,nieun'])).toMatchObject({ only: ['giyeok', 'nieun'] });
  });

  it.each([
    [[], /--engine is required/],
    [['--engine', 'openai', '--pilot'], /--engine must be one of polly, google, azure/],
    [['--engine', 'polly'], /--pack, --pilot or --only/],
    [['--engine', 'polly', '--pilot', '--pack', 'jamo-s1'], /cannot be combined/],
    [['--engine', 'polly', '--pack', 'jamo-s1'], /--voice is required outside the pilot/],
    [['--engine', 'polly', '--voice', 'Seoyeon', '--pack', 'stage5'], /unknown pack stage5/],
    [['--engine', 'polly', '--pilot', '--max-chars', '-3'], /--max-chars needs a value|positive whole number/],
    [['--engine', 'polly', '--pilot', '--max-chars', '1e6'], /positive whole number/],
    [['--engine', 'polly', '--pilot', '--upload'], /unknown argument --upload/],
    [['--engine', 'polly', '--engine', 'google', '--pilot'], /given twice/],
  ])('%j is a usage error', (argv, message) => {
    expect(parseArgs(argv).error).toMatch(message);
  });
});

describe('refusals before any request (AC-B5 key safety)', () => {
  it.each(REFUSED_ENV)('a real run refuses when %s is set, before reading anything or building a client', async (name) => {
    expect(refusalOf({ [name]: '1' })).toMatch(new RegExp(`refused: ${name} is set`));
    const h = harness();
    const code = await runGenerate(['--engine', 'polly', '--pilot'], { [name]: 'true' }, h.deps);
    expect(code).toBe(2);
    expect(h.err.join('\n')).toMatch(/Agents and CI run --dry-run only/);
    expect(h.deps.readText).not.toHaveBeenCalled();
    expect(h.deps.createClient).not.toHaveBeenCalled();
  });

  it('names every refused variable at once, and an empty value still counts as set', () => {
    expect(refusalOf({ CI: '', CLAUDECODE: '1' })).toMatch(/refused: CI, CLAUDECODE are set/);
    expect(refusalOf({ HOME: '/x', PATH: '/bin' })).toBeNull();
  });

  it('--dry-run is never refused and never builds a client, even in CI or an agent shell', async () => {
    const h = harness();
    const code = await runGenerate(['--engine', 'polly', '--voice', 'Seoyeon', '--pack', 'stage2', '--dry-run'], { CI: 'true', CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'cli' }, h.deps);
    expect(code).toBe(0);
    expect(h.deps.createClient).not.toHaveBeenCalled();
    expect(h.deps.writeAtomic).not.toHaveBeenCalled();
    expect(h.out[0]).toMatch(/No network: nothing is sent/);
  });

  it('refuses an output folder git does not ignore, before building a client', async () => {
    expect(outputProblem('/repo/apps/mobile/assets/tts', () => false)).toMatch(/is not gitignored \(git check-ignore\)/);
    expect(outputProblem(`/repo/${OUTPUT_ROOT}/polly/Seoyeon`, () => true)).toBeNull();
    const h = harness({ ignored: false });
    const code = await runGenerate(['--engine', 'polly', '--voice', 'Seoyeon', '--pack', 'stage2', '--out', 'apps/mobile/assets/tts'], {}, h.deps);
    expect(code).toBe(2);
    expect(h.err.join('\n')).toMatch(/apps\/mobile\/assets\/tts\/polly\/Seoyeon is not gitignored/);
    expect(h.deps.isIgnored).toHaveBeenCalledWith('/repo/apps/mobile/assets/tts/polly/Seoyeon');
    expect(h.deps.createClient).not.toHaveBeenCalled();
  });

  it('refuses a generative voice, in a dry run too', async () => {
    for (const argv of [
      ['--engine', 'google', '--voice', 'ko-KR-Chirp3-HD-Aoede', '--pilot', '--dry-run'],
      ['--engine', 'polly', '--voice', 'Seoyeon', '--model', 'generative', '--pilot', '--dry-run'],
      ['--engine', 'azure', '--voice', 'ko-KR-SunHi:DragonHDLatestNeural', '--pilot', '--dry-run'],
    ]) {
      const h = harness();
      expect(await runGenerate(argv, {}, h.deps)).toBe(2);
      expect(h.err.join('\n')).toMatch(/^refused: .* is a generative voice/);
      expect(h.out).toEqual([]);
    }
  });

  it('the apps/mobile/recordings/tts folder is gitignored in this repository', () => {
    const r = spawnSync('git', ['-C', REPO_ROOT, 'check-ignore', '-q', join(REPO_ROOT, OUTPUT_ROOT, 'polly', 'Seoyeon')]);
    expect(r.status).toBe(0);
    const tracked = spawnSync('git', ['-C', REPO_ROOT, 'check-ignore', '-q', join(REPO_ROOT, 'apps/mobile/assets/audio/say')]);
    expect(tracked.status).toBe(1);
  });
});

describe('the pilot: about 81 rows (section 11, AC-5)', () => {
  const rows = pilotRows(MANIFEST.rows, keys);

  it('is all 65 jamo clips, 10 sound-change words and 6 sentences', () => {
    expect(rows).toHaveLength(81);
    expect(rows.filter((r) => r.ref.startsWith('audio/jamo/'))).toHaveLength(65);
    expect(rows.filter((r) => r.kind === 'word').map((r) => r.text)).toEqual([...PILOT_PROBE_WORDS, ...PILOT_CONTENT_WORDS]);
    expect(rows.filter((r) => r.kind === 'sentence').map((r) => r.text)).toEqual(PILOT_SENTENCES);
    expect(new Set(rows.map((r) => r.ref)).size).toBe(81);
  });

  it('includes the spec probes 신라 같이 좋다 as pilot-only rows sent in standard spelling', () => {
    for (const text of ['신라', '같이', '좋다']) {
      const r = rows.find((x) => x.text === text);
      expect(r).toMatchObject({ ref: sayRef(text), key: sayKey(text), say: text, rate: 0.9, pack: 'pilot' });
      expect(MANIFEST.rows.some((m) => m.text === text)).toBe(false);
    }
  });

  it('takes the probe 국물 from the content once a cell teaches it (F-CURR-002 CM-44 S2), as the manifest says it', () => {
    const shipped = MANIFEST.rows.find((m) => m.text === '국물');
    expect(shipped).toBeDefined();
    expect(rows.find((x) => x.text === '국물')).toEqual(shipped);
    expect(pilotRows(MANIFEST.rows.filter((m) => m.text !== '국물'), keys).find((x) => x.text === '국물')).toMatchObject({ say: '국물', pack: 'pilot' });
  });

  it('takes the other words and the sentences from the content, as the manifest says them', () => {
    for (const text of [...PILOT_CONTENT_WORDS, ...PILOT_SENTENCES]) {
      expect(rows.find((x) => x.text === text)).toEqual(MANIFEST.rows.find((m) => m.text === text));
    }
  });

  it('fails clearly when content drops a pilot text', () => {
    expect(() => pilotRows(MANIFEST.rows.filter((r) => r.text !== '학교'), keys)).toThrow(/pilot text "학교" is not in content\/audio\/tts-manifest.json/);
  });

  it('--pack and --only select from the manifest; an unknown --only key is an error', () => {
    expect(selectRows(SMALL.rows, { packs: ['stage6'] }, keys).map((r) => r.key)).toEqual(['dddddddddddddddd']);
    expect(selectRows(SMALL.rows, { only: ['bbbbbbbbbbbbbbbb', 'audio/say/cccccccccccccccc.mp3'] }, keys).map((r) => r.key)).toEqual(['bbbbbbbbbbbbbbbb', 'cccccccccccccccc']);
    expect(() => selectRows(SMALL.rows, { packs: ['stage6'], only: ['aaaaaaaaaaaaaaaa'] }, keys)).toThrow(/not in the selection/);
    expect(selectRows(MANIFEST.rows, { packs: ['jamo-s1', 'jamo-wb'] }, keys)).toHaveLength(65);
  });
});

describe('dry run: the requests and the billed characters, SSML included', () => {
  it('prints every request body and totals the whole text sent', async () => {
    const h = harness();
    expect(await runGenerate(['--engine', 'polly', '--voice', 'Seoyeon', '--pack', 'stage2', '--dry-run'], {}, h.deps)).toBe(0);
    const requests = h.out.filter((l) => l.startsWith('request '));
    expect(requests).toHaveLength(3);
    expect(requests[0]).toContain('"Text":"<speak><prosody rate=\\"90%\\">가방</prosody></speak>"');
    // '<speak><prosody rate="90%">' (27) + 2 + '</prosody></speak>' (18) = 47 per two-syllable row.
    expect(requests[0]).toContain('(word, rate 0.9, 47 billed characters)');
    expect(h.out.find((l) => l.startsWith('total:'))).toMatch(/^total: 3 requests, 141 billed characters \(the whole text sent, SSML tags included\)/);
    expect(h.out.find((l) => l.startsWith('spend guard:'))).toBe('spend guard: --max-chars 156 (default: this count plus 10 %)');
  });

  it('the default cap is the dry-run count plus 10 %, rounded up', () => {
    expect(MAX_CHARS_HEADROOM).toBe(0.1);
    expect(defaultMaxChars(141)).toBe(156);
    expect(defaultMaxChars(100)).toBe(110);
    expect(defaultMaxChars(0)).toBe(0);
  });

  it('the pilot on Polly is 162 requests (two voices) and stays far inside the free allowance', async () => {
    const h = harness({ manifest: MANIFEST });
    expect(await runGenerate(['--engine', 'polly', '--pilot', '--dry-run'], {}, h.deps)).toBe(0);
    expect(h.out.filter((l) => l.startsWith('request polly/Seoyeon '))).toHaveLength(81);
    expect(h.out.filter((l) => l.startsWith('request polly/Jihye '))).toHaveLength(81);
    const total = Number(/total: 162 requests, ([\d,]+) billed/.exec(h.out.find((l) => l.startsWith('total:')))[1].replace(/,/g, ''));
    expect(total).toBeGreaterThan(81 * 45);
    expect(total).toBeLessThan(10_000);
  });
});

describe('a run with a mocked client: WAV masters, the lock, the skip rule', () => {
  const argv = ['--engine', 'google', '--voice', 'ko-KR-Neural2-A', '--pack', 'stage2'];

  it('writes one 24 kHz WAV per row and one lock row each, with no credential in the lock', async () => {
    const h = harness();
    expect(await runGenerate(argv, {}, h.deps)).toBe(0);
    expect(h.client.synthesize).toHaveBeenCalledTimes(3);
    expect(h.sent.map((p) => p.input.text)).toEqual(['가방', '나무', '다리']);
    const master = `/repo/${OUTPUT_ROOT}/google/ko-KR-Neural2-A/aaaaaaaaaaaaaaaa.wav`;
    expect(wavInfo(h.fs.get(master))).toEqual({ format: 1, channels: 1, sampleRate: 24000 });
    const lock = h.lock();
    expect(lock.rows).toHaveLength(3);
    expect(lock.rows[0]).toEqual({
      ref: 'audio/say/aaaaaaaaaaaaaaaa.mp3',
      key: 'aaaaaaaaaaaaaaaa',
      engine: 'google',
      voice: 'ko-KR-Neural2-A',
      model: 'neural2',
      rate: 0.9,
      generated: '2026-11-02',
      saySha256: saySha256('가방'),
      mp3Sha256: null,
    });
    // Only these fields are ever written: nothing about the account, the profile or a credential.
    const parsed = JSON.parse(String(h.fs.get(`/repo/${LOCK_FILE}`)));
    expect(Object.keys(parsed)).toEqual(['schemaVersion', 'generatedBy', 'rows']);
    for (const r of parsed.rows) expect(Object.keys(r)).toEqual(['ref', 'key', 'engine', 'voice', 'model', 'rate', 'generated', 'saySha256', 'mp3Sha256']);
    expect(h.out.at(-1)).toMatch(/3 WAV masters written .* Revoke the credentials now/);
  });

  it('a rerun skips every row with the same say, voice and rate and sends nothing', async () => {
    const h = harness();
    await runGenerate(argv, {}, h.deps);
    h.client.synthesize.mockClear();
    expect(await runGenerate(argv, {}, h.deps)).toBe(0);
    expect(h.client.synthesize).not.toHaveBeenCalled();
    expect(h.out.at(-1)).toBe('nothing to generate: all 3 rows are already in content/audio/tts-lock.json');
  });

  it('a changed say, a changed rate or a missing master is generated again; another voice is its own row', async () => {
    const h = harness();
    await runGenerate(argv, {}, h.deps);
    const changed = { schemaVersion: 1, rows: [row('aaaaaaaaaaaaaaaa', '가방.'), { ...SMALL.rows[1], rate: 0.85 }, SMALL.rows[2], SMALL.rows[3]] };
    h.fs.set(`/repo/${MANIFEST_FILE}`, JSON.stringify(changed));
    h.fs.delete(`/repo/${OUTPUT_ROOT}/google/ko-KR-Neural2-A/cccccccccccccccc.wav`);
    h.sent.length = 0;
    expect(await runGenerate(argv, {}, h.deps)).toBe(0);
    expect(h.sent.map((p) => [p.input.text, p.audioConfig.speakingRate])).toEqual([['가방.', 0.9], ['나무', 0.85], ['다리', 0.9]]);
    expect(h.lock().rows.find((r) => r.key === 'aaaaaaaaaaaaaaaa').saySha256).toBe(saySha256('가방.'));
    h.sent.length = 0;
    expect(await runGenerate(['--engine', 'google', '--voice', 'ko-KR-Neural2-C', '--pack', 'stage2'], {}, h.deps)).toBe(0);
    expect(h.sent).toHaveLength(3);
    expect(h.lock().rows).toHaveLength(6);
  });

  it('a row whose processed MP3 is recorded stays skipped after its WAV master is deleted', async () => {
    const lock = {
      schemaVersion: 1,
      rows: [{ ref: 'audio/say/aaaaaaaaaaaaaaaa.mp3', key: 'aaaaaaaaaaaaaaaa', engine: 'google', voice: 'ko-KR-Neural2-A', model: 'neural2', rate: 0.9, generated: '2026-11-01', saySha256: saySha256('가방'), mp3Sha256: 'a'.repeat(64) }],
    };
    const h = harness({ files: { [`/repo/${LOCK_FILE}`]: JSON.stringify(lock) } });
    expect(await runGenerate(argv, {}, h.deps)).toBe(0);
    expect(h.sent.map((p) => p.input.text)).toEqual(['나무', '다리']);
  });

  it('Polly masters are decoded from Ogg Vorbis to a 24 kHz WAV; a master at the wrong rate stops the run', async () => {
    const h = harness({ synth: async () => ({ bytes: Buffer.from('OggS'), format: 'ogg' }) });
    expect(await runGenerate(['--engine', 'polly', '--voice', 'Seoyeon', '--pack', 'stage6'], {}, h.deps)).toBe(0);
    expect(h.deps.toWav).toHaveBeenCalledWith(Buffer.from('OggS'), 'ogg', 24000);

    const bad = harness({ rateOut: 16000 });
    expect(await runGenerate(argv, {}, bad.deps)).toBe(1);
    expect(bad.err.join('\n')).toMatch(/is not a 24000 Hz mono WAV \(16000 Hz, 1 channels\)\. Stopped; 0 written/);
    expect(bad.deps.writeAtomic).not.toHaveBeenCalled();
  });

  it('a Polly run checks for ffmpeg before it sends anything; Google and Azure need no decoder', async () => {
    const h = harness({ decoder: false });
    expect(await runGenerate(['--engine', 'polly', '--voice', 'Seoyeon', '--pack', 'stage6'], {}, h.deps)).toBe(2);
    expect(h.err).toEqual(['Amazon Polly masters are decoded to WAV with ffmpeg, which is not on the PATH: install it (brew install ffmpeg) and run again. Nothing was sent.']);
    expect(h.deps.createClient).not.toHaveBeenCalled();
    const g = harness({ decoder: false });
    expect(await runGenerate(['--engine', 'google', '--voice', 'ko-KR-Neural2-A', '--pack', 'stage6'], {}, g.deps)).toBe(0);
    expect(g.deps.canDecode).not.toHaveBeenCalled();
  });

  it('Azure masters must be 48 kHz (with the terms gate lifted, as the change that records the reading will)', async () => {
    const h = harness({ rateOut: 48000, engines: { azure: { ...azure, realRunProblem: () => null } } });
    expect(await runGenerate(['--engine', 'azure', '--voice', 'ko-KR-SunHiNeural', '--pack', 'stage6'], {}, h.deps)).toBe(0);
    expect(wavInfo(h.fs.get(`/repo/${OUTPUT_ROOT}/azure/ko-KR-SunHiNeural/dddddddddddddddd.wav`)).sampleRate).toBe(48000);
  });

  it('a failed request stops the run, keeps what was written, and prints only the message', async () => {
    let n = 0;
    const h = harness({
      synth: async () => {
        n += 1;
        if (n === 2) throw Object.assign(new Error('The security token included in the request is invalid'), { request: { headers: { authorization: 'x' } } });
        return { bytes: wav(24000), format: 'wav' };
      },
    });
    expect(await runGenerate(argv, {}, h.deps)).toBe(1);
    expect(h.err).toEqual(['google/ko-KR-Neural2-A audio/say/bbbbbbbbbbbbbbbb.mp3: The security token included in the request is invalid. Stopped; 1 written, rerun to continue.']);
    expect(h.lock().rows.map((r) => r.key)).toEqual(['aaaaaaaaaaaaaaaa']);
  });
});

describe('the Azure terms gate (tts-vendor-terms.md: the output right was not read first-hand)', () => {
  it('a real Azure run is refused before any client while AZURE_TERMS_READ is null', async () => {
    const h = harness({ rateOut: 48000 });
    expect(await runGenerate(['--engine', 'azure', '--voice', 'ko-KR-SunHiNeural', '--pack', 'stage6'], {}, h.deps)).toBe(2);
    expect(h.err).toEqual([expect.stringMatching(/^refused: the Azure Product Terms output-right clause has not been read first-hand yet/)]);
    expect(h.deps.createClient).not.toHaveBeenCalled();
    expect(h.deps.writeAtomic).not.toHaveBeenCalled();
  });

  it('an Azure dry run still works and says a real run is refused for now', async () => {
    const h = harness();
    expect(await runGenerate(['--engine', 'azure', '--voice', 'ko-KR-SunHiNeural', '--pack', 'stage6', '--dry-run'], {}, h.deps)).toBe(0);
    expect(h.out.at(-1)).toMatch(/^note: a real run is refused for now: the Azure Product Terms/);
  });

  it('Polly and Google have no such gate', () => {
    expect(engineOf('polly').realRunProblem?.() ?? null).toBeNull();
    expect(engineOf('google').realRunProblem?.() ?? null).toBeNull();
  });
});

describe('paths: everything stays inside the repository, and a bad file never echoes its text', () => {
  it('insideRepo', () => {
    expect(insideRepo('/repo', '/repo')).toBe(true);
    expect(insideRepo('/repo/content/a.json', '/repo')).toBe(true);
    expect(insideRepo('/repo2/a.json', '/repo')).toBe(false);
    expect(insideRepo('/etc/a.json', '/repo')).toBe(false);
  });

  it.each([
    ['--manifest', '/home/someone/.config/gcloud/application_default_credentials.json'],
    ['--lock', '../outside/lock.json'],
    ['--out', '/tmp/tts'],
  ])('%s outside the repository is refused, in a dry run too, before reading anything', async (flag, value) => {
    const h = harness();
    expect(await runGenerate(['--engine', 'polly', '--voice', 'Seoyeon', '--pack', 'stage2', flag, value, '--dry-run'], {}, h.deps)).toBe(2);
    expect(h.err).toEqual([`refused: ${flag} ${value} is outside the repository`]);
    expect(h.deps.readText).not.toHaveBeenCalled();
    expect(h.out).toEqual([]);
  });

  it('a manifest or lock that is not JSON fails with its path only, never its text', async () => {
    const keyLike = '{"type": "service_account", "private_key_id": "0123';
    const plain = 'not json at all: s3cr3t-value';
    for (const [flag, path, text] of [['--manifest', 'content/fake-manifest.json', plain], ['--lock', 'content/fake-lock.json', keyLike]]) {
      const h = harness({ files: { [`/repo/${path}`]: text } });
      expect(await runGenerate(['--engine', 'polly', '--voice', 'Seoyeon', '--pack', 'stage2', flag, path, '--dry-run'], {}, h.deps)).toBe(2);
      expect(h.err).toEqual([`not valid JSON: ${path}`]);
      expect(h.err.join('\n')).not.toMatch(/s3cr3t|service_account|private_key/);
    }
  });
});

describe('the spend guard (--max-chars, AU-OD-8)', () => {
  const argv = ['--engine', 'polly', '--voice', 'Seoyeon', '--pack', 'stage2'];

  it('stops before the request that would cross the cap', async () => {
    const h = harness();
    // Each row is 47 billed characters: 94 allows two requests, the third would make 141.
    expect(await runGenerate([...argv, '--max-chars', '100'], {}, h.deps)).toBe(3);
    expect(h.client.synthesize).toHaveBeenCalledTimes(2);
    expect(h.err.at(-1)).toMatch(/^spend guard: stopped before polly\/Seoyeon audio\/say\/cccccccccccccccc\.mp3: 94 \+ 47 billed characters would cross --max-chars 100\. 2 of 3 written/);
    expect(h.lock().rows).toHaveLength(2);
  });

  it('a cap exactly at the total lets every request through', async () => {
    const h = harness();
    expect(await runGenerate([...argv, '--max-chars', '141'], {}, h.deps)).toBe(0);
    expect(h.client.synthesize).toHaveBeenCalledTimes(3);
  });

  it('a cap below the first request sends nothing', async () => {
    const h = harness();
    expect(await runGenerate([...argv, '--max-chars', '46'], {}, h.deps)).toBe(3);
    expect(h.client.synthesize).not.toHaveBeenCalled();
    expect(h.out[0]).toMatch(/^note: the plan is 141 billed characters and --max-chars is 46/);
  });

  it('with no --max-chars the default (count plus 10 %) applies and a normal run fits', async () => {
    const h = harness();
    expect(await runGenerate(argv, {}, h.deps)).toBe(0);
    expect(h.client.synthesize).toHaveBeenCalledTimes(3);
  });

  it('the $50 budget ceiling does not depend on the plan: what $50 buys at the dearest voice of the run', () => {
    expect(BUDGET_USD).toBe(50);
    expect(budgetChars(engineOf('polly'), ['Seoyeon', 'Jihye'])).toBe(3_125_000);
    expect(budgetChars(engineOf('google'), ['ko-KR-Wavenet-A'])).toBe(12_500_000);
    expect(budgetChars(engineOf('google'), ['ko-KR-Wavenet-A', 'ko-KR-Neural2-A'])).toBe(3_125_000);
  });

  it('the ceiling caps the default and an explicit --max-chars, and the run stops at it', async () => {
    // A test engine at $500,000 per 1M characters: $50 buys 100 characters, two of the three 47-character rows.
    const dear = { ...engineOf('polly'), pricePerMillion: () => 500_000 };
    for (const extra of [[], ['--max-chars', '100000']]) {
      const h = harness({ engines: { polly: dear } });
      expect(await runGenerate([...argv, ...extra], {}, h.deps)).toBe(3);
      expect(h.client.synthesize).toHaveBeenCalledTimes(2);
      expect(h.out[0]).toBe('note: the plan is 141 billed characters and --max-chars is 100 (the $50 budget ceiling); the run stops at the cap');
      expect(h.err.at(-1)).toMatch(/^spend guard: stopped before polly\/Seoyeon audio\/say\/cccccccccccccccc\.mp3: 94 \+ 47 billed characters would cross --max-chars 100\./);
    }
    const dry = harness({ engines: { polly: dear } });
    expect(await runGenerate([...argv, '--dry-run'], {}, dry.deps)).toBe(0);
    expect(dry.out.find((l) => l.startsWith('spend guard:'))).toBe('spend guard: --max-chars 100 (the $50 budget ceiling)');
  });
});

describe('the command (its own process, as the package script runs it)', () => {
  // The child never sees a vendor credential or a credential file, whatever the developer's shell holds: every
  // AWS_*, GOOGLE_*, GCLOUD_*, CLOUDSDK_* and AZURE_* variable is dropped, and the credential files point nowhere.
  const CREDENTIAL_ENV = /^(AWS_|GOOGLE_|GCLOUD_|CLOUDSDK_|AZURE_)/;
  const run = (args, env) => {
    const e = Object.fromEntries(Object.entries(process.env).filter(([k]) => !CREDENTIAL_ENV.test(k) && k !== 'VITEST'));
    Object.assign(e, {
      AWS_SHARED_CREDENTIALS_FILE: '/dev/null',
      AWS_CONFIG_FILE: '/dev/null',
      AWS_EC2_METADATA_DISABLED: 'true',
      GOOGLE_APPLICATION_CREDENTIALS: '/nonexistent/hr-tts-test',
      CLOUDSDK_CONFIG: '/nonexistent/hr-tts-test',
      ...env,
    });
    return spawnSync(process.execPath, [GENERATE, ...args], { cwd: REPO_ROOT, encoding: 'utf8', env: e });
  };

  it('--dry-run runs on the committed manifest and lock and sends nothing', () => {
    const r = run(['--engine', 'google', '--voice', 'ko-KR-Neural2-A', '--pack', 'jamo-s1', '--dry-run'], { CI: 'true' });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/No network: nothing is sent/);
    expect(r.stdout.split('\n').filter((l) => l.startsWith('request google/ko-KR-Neural2-A audio/jamo/'))).toHaveLength(43);
  }, TIMEOUT);

  it('without --dry-run it refuses in CI and in an agent shell, before anything else', () => {
    // More barriers stand behind the refusal: --out outside the repository is refused before anything is read or
    // any client exists, and --max-chars 1 is below every request. No credential is reachable either (run() above).
    const r = run(['--engine', 'polly', '--pilot', '--out', '/nonexistent/hr-tts-test', '--max-chars', '1'], { CI: 'true', CLAUDECODE: '1' });
    expect(r.status).toBe(2);
    expect(r.stdout).toBe('');
    expect(r.stderr).toMatch(/^refused: CI, CLAUDECODE/);
  }, TIMEOUT);

  it('refuses unknown arguments', () => {
    const r = run(['--engine', 'polly', '--upload'], { CI: 'true' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/unknown argument --upload\nusage: generate\.mjs/);
  }, TIMEOUT);
});
