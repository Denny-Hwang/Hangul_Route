// The generator's rules (AMENDMENTS-AUDIO-CLIPS AC-B2, AC-B5 step 2 and key safety, 8.2; row AC-3), kept apart from
// generate.mjs so every rule is tested with no network, no SDK and no credential.
//
//   parseArgs        the command line
//   refusalOf        agent and CI shells are refused (CI, CLAUDECODE, CLAUDE_CODE_ENTRYPOINT): they run --dry-run only
//   outputProblem    the WAV masters must go to a gitignored folder (git check-ignore)
//   selectRows       --pack, --pilot (about 81 rows) and --only over the committed manifest
//   planRequests     one request per row and voice, minus the rows tts-lock.json already holds
//   runGenerate      the whole command with its effects injected: a dry run prints the requests and the billed
//                    characters and sends nothing; a real run stops before the request that would cross --max-chars
import { join, relative, resolve, sep } from 'node:path';
import { AUDIO_PACKS } from '@hangul-route/content-schema';
import { ENGINE_IDS, VoiceRefused, engineOf } from './engines/index.mjs';
import { LOCK_FILE, emptyLock, lockMatches, lockRowOf, parseLock, renderLock, saySha256, upsertLockRow } from './lock-lib.mjs';
import { KIND_RATES, MANIFEST_FILE } from './manifest-lib.mjs';

export const OUTPUT_ROOT = 'apps/mobile/recordings/tts';
/** Set in CI and in Claude Code shells; a real run refuses to start when any of them is set (AC-B5 key safety). */
export const REFUSED_ENV = ['CI', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT'];
/** The default spend guard: the dry-run character count of the same command plus 10 % (AU-OD-8). */
export const MAX_CHARS_HEADROOM = 0.1;
/** The budget the owner set (AU-OD-8): a billing alert plus this script's cap. */
export const BUDGET_USD = 50;

/**
 * The pilot (AC-5, section 11): all 65 jamo clips, 10 words with a sound change and 6 sentences, about 81 rows.
 * The first four words are the spec's probes (nasalization, liquidization, palatalization, h-aspiration); they are
 * not in the content, so they are generated for the pilot only and never shipped. The other six are content words
 * with a sound change: 박물관 [방물관], 설날 [설랄], 한글날 [한글랄], 집현전 [지편전], 학교 [학꾜], 부엌 [부억].
 */
export const PILOT_PROBE_WORDS = ['국물', '신라', '같이', '좋다'];
export const PILOT_CONTENT_WORDS = ['박물관', '설날', '한글날', '집현전', '학교', '부엌'];
export const PILOT_SENTENCES = ['새해 복 많이 받으세요.', '안녕히 가세요.', '이거 얼마예요?', '사과 한 개 주세요.', '생일에 케이크를 먹었어요.', '설날은 음력 새해 첫날이에요.'];
export const PILOT_PACK = 'pilot';

export const USAGE =
  'usage: generate.mjs --engine polly|google|azure [--voice <name>[,<name>]] (--pack <pack>[,<pack>] | --pilot | --only <key>[,<key>])\n' +
  '                    [--max-chars <n>] [--dry-run] [--model <id>] [--manifest <path>] [--lock <path>] [--out <dir>]';

const VALUE_FLAGS = new Set(['--engine', '--voice', '--pack', '--only', '--max-chars', '--model', '--manifest', '--lock', '--out']);
const list = (value) => value.split(',').map((s) => s.trim()).filter((s) => s !== '');

/** The command line, or { error } with a usage message. */
export function parseArgs(argv) {
  const opts = { dryRun: false, pilot: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--pilot') opts.pilot = true;
    else if (VALUE_FLAGS.has(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) return { error: `${arg} needs a value` };
      i += 1;
      const name = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (opts[name] !== undefined) return { error: `${arg} is given twice` };
      opts[name] = value;
    } else return { error: `unknown argument ${arg}` };
  }
  if (opts.engine === undefined) return { error: '--engine is required' };
  if (engineOf(opts.engine) === undefined) return { error: `--engine must be one of ${ENGINE_IDS.join(', ')}` };
  const out = { engine: opts.engine, dryRun: opts.dryRun, pilot: opts.pilot, model: opts.model, manifest: opts.manifest, lock: opts.lock, out: opts.out };
  out.voices = opts.voice === undefined ? undefined : list(opts.voice);
  out.packs = opts.pack === undefined ? undefined : list(opts.pack);
  out.only = opts.only === undefined ? undefined : list(opts.only);
  if (out.pilot && out.packs !== undefined) return { error: '--pilot and --pack cannot be combined' };
  if (!out.pilot && out.packs === undefined && out.only === undefined) return { error: 'name what to generate: --pack, --pilot or --only' };
  if (out.packs !== undefined) {
    const unknown = out.packs.filter((p) => !AUDIO_PACKS.includes(p));
    if (unknown.length > 0 || out.packs.length === 0) return { error: `unknown pack ${unknown.join(', ') || '(none)'}; packs: ${AUDIO_PACKS.join(', ')}` };
  }
  if (out.voices !== undefined && out.voices.length === 0) return { error: '--voice needs a name' };
  if (out.voices === undefined && !out.pilot) {
    return { error: '--voice is required outside the pilot: use the voice AMENDMENTS-AUDIO-CLIPS section 13 records' };
  }
  if (opts.maxChars !== undefined) {
    if (!/^\d+$/.test(opts.maxChars) || Number(opts.maxChars) <= 0) return { error: '--max-chars must be a positive whole number' };
    out.maxChars = Number(opts.maxChars);
  }
  return out;
}

/** Why a real run must not start in this environment, or null. Never applies to --dry-run. */
export function refusalOf(env) {
  const set = REFUSED_ENV.filter((name) => env[name] !== undefined);
  if (set.length === 0) return null;
  return (
    `refused: ${set.join(', ')} ${set.length === 1 ? 'is' : 'are'} set. A real generation run only happens in the owner's own ` +
    'terminal (not CI, not a Claude Code session), with the credentials inline for that one command ' +
    '(docs/launch/owner-runbook.md section M). Agents and CI run --dry-run only.'
  );
}

/** Why a folder may not hold the WAV masters, or null: it must be gitignored (the repository is public). */
export function outputProblem(dir, isIgnored) {
  if (isIgnored(dir)) return null;
  return (
    `refused: ${dir} is not gitignored (git check-ignore). The repository is public: WAV masters go to ` +
    `${OUTPUT_ROOT}/ (inside the gitignored apps/mobile/recordings/).`
  );
}

/** The voices of a command: --voice, else the engine's pilot candidates. Throws VoiceRefused for a refused voice. */
export function voicesOf(engine, opts) {
  const voices = opts.voices ?? engine.pilotVoices;
  for (const voice of voices) engine.checkVoice(voice, opts.model);
  return voices;
}

/** A pilot-only row for a probe word that is not in the content (never shipped, never in a pack). */
export function probeRow(text, keys) {
  return { ref: keys.sayRef(text), key: keys.sayKey(text), kind: 'word', text, say: text, rate: KIND_RATES.word, pack: PILOT_PACK, sources: ['pilot'] };
}

/** The pilot rows, in order: 65 jamo rows, 4 probe words, 6 content words, 6 sentences. Throws when one is missing. */
export function pilotRows(rows, keys) {
  const jamo = rows.filter((r) => r.ref.startsWith('audio/jamo/'));
  const byText = new Map(rows.map((r) => [r.text, r]));
  const pick = (text) => {
    const row = byText.get(text);
    if (row === undefined) throw new Error(`pilot text "${text}" is not in ${MANIFEST_FILE}; pick another from the content`);
    return row;
  };
  return [...jamo, ...PILOT_PROBE_WORDS.map((t) => probeRow(t, keys)), ...PILOT_CONTENT_WORDS.map(pick), ...PILOT_SENTENCES.map(pick)];
}

/** The rows a command generates: --pilot or --pack, then narrowed by --only (keys or refs). */
export function selectRows(rows, opts, keys) {
  let selected = opts.pilot ? pilotRows(rows, keys) : opts.packs !== undefined ? rows.filter((r) => opts.packs.includes(r.pack)) : rows;
  if (opts.only !== undefined) {
    const wanted = new Set(opts.only);
    const known = new Set(selected.flatMap((r) => [r.key, r.ref]));
    const unknown = opts.only.filter((k) => !known.has(k));
    if (unknown.length > 0) throw new Error(`--only: ${unknown.join(', ')} ${unknown.length === 1 ? 'is' : 'are'} not in the selection`);
    selected = selected.filter((r) => wanted.has(r.key) || wanted.has(r.ref));
  }
  return selected;
}

/** The folder of one engine and voice's WAV masters. */
export function voiceDir(outRoot, engine, voice) {
  return join(outRoot, engine.id, voice);
}

/**
 * One request per row and voice, minus the rows the lock already holds with the same say, voice and rate. A lock
 * row is only trusted when its clip still exists: the processed MP3 was recorded (mp3Sha256), or the WAV master is
 * still in the output folder (`hasMaster`).
 */
export function planRequests({ rows, engine, voices, lock, outRoot, hasMaster }) {
  const requests = [];
  const skipped = [];
  for (const voice of voices) {
    const dir = voiceDir(outRoot, engine, voice);
    for (const row of rows) {
      const locked = lockRowOf(lock, { ref: row.ref, engine: engine.id, voice });
      const master = join(dir, `${row.key}.wav`);
      if (lockMatches(locked, row) && (locked.mp3Sha256 !== null || hasMaster(master))) {
        skipped.push({ row, voice });
        continue;
      }
      const { payload, text, chars } = engine.request(row, voice);
      requests.push({ row, voice, model: engine.modelOf(voice), payload, text, chars, master });
    }
  }
  return { requests, skipped };
}

export const totalChars = (requests) => requests.reduce((n, r) => n + r.chars, 0);

/** The default --max-chars: the dry-run count of the same command plus 10 %. */
export function defaultMaxChars(chars) {
  // Whole-number arithmetic (1.1 is not exact in binary): count * 110 / 100, rounded up.
  return Math.ceil((chars * Math.round((1 + MAX_CHARS_HEADROOM) * 100)) / 100);
}

/** The estimated cost of a plan before any free allowance, in US$. */
export function estimateUsd(requests, engine) {
  return requests.reduce((usd, r) => usd + (r.chars * engine.pricePerMillion(r.voice)) / 1e6, 0);
}

/** A WAV file's channels and sample rate (RIFF PCM), or null when it is not one. */
export function wavInfo(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 44) return null;
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') return null;
  let at = 12;
  while (at + 8 <= bytes.length) {
    const id = bytes.toString('ascii', at, at + 4);
    const size = bytes.readUInt32LE(at + 4);
    if (id === 'fmt ' && at + 24 <= bytes.length) {
      return { format: bytes.readUInt16LE(at + 8), channels: bytes.readUInt16LE(at + 10), sampleRate: bytes.readUInt32LE(at + 12) };
    }
    at += 8 + size + (size % 2);
  }
  return null;
}

const usd = (n) => `$${n.toFixed(2)}`;
const fmt = (n) => n.toLocaleString('en-US');

/** The dry-run report: every request as it would be sent, the billed characters and the spend guard. */
export function dryRunLines({ engine, voices, plan, maxChars, lockPath }) {
  const lines = [`audio:tts:generate --dry-run: ${engine.label} (${engine.id}), voices ${voices.join(', ')}. No network: nothing is sent.`];
  for (const r of plan.requests) {
    lines.push(`request ${engine.id}/${r.voice} ${r.row.ref} (${r.row.kind}, rate ${r.row.rate}, ${r.chars} billed characters): ${JSON.stringify(r.payload)}`);
  }
  const chars = totalChars(plan.requests);
  for (const voice of voices) {
    const mine = plan.requests.filter((r) => r.voice === voice);
    const skipped = plan.skipped.filter((s) => s.voice === voice).length;
    lines.push(`  ${voice}: ${mine.length} requests, ${skipped} skipped (already in ${lockPath}), ${fmt(totalChars(mine))} billed characters`);
  }
  lines.push(
    `total: ${plan.requests.length} requests, ${fmt(chars)} billed characters (the whole text sent, SSML tags included), ` +
      `about ${usd(estimateUsd(plan.requests, engine))} before the free allowance (budget ${usd(BUDGET_USD)}, AU-OD-8)`,
  );
  lines.push(`spend guard: --max-chars ${fmt(maxChars)}${maxChars === defaultMaxChars(chars) ? ' (default: this count plus 10 %)' : ''}`);
  return lines;
}

const today = (now) => now().toISOString().slice(0, 10);

/**
 * The whole command. `deps` carries every effect so tests run with no network, no SDK and no credential:
 *   repoRoot, readText(path), exists(path), writeAtomic(path, text|Buffer), mkdirp(dir), isIgnored(dir),
 *   createClient(engine, { env }), canDecode() -> boolean, toWav(bytes, format, sampleRate) -> Buffer, now() -> Date,
 *   keys { sayKey, sayRef },
 *   out(line), err(line)
 * Exit codes: 0 done, 1 a request or the content failed, 2 a usage error or a refusal, 3 the spend guard stopped it.
 */
export async function runGenerate(argv, env, deps) {
  const opts = parseArgs(argv);
  if (opts.error !== undefined) {
    deps.err(`${opts.error}\n${USAGE}`);
    return 2;
  }
  if (!opts.dryRun) {
    const refusal = refusalOf(env);
    if (refusal !== null) {
      deps.err(refusal);
      return 2;
    }
  }
  const engine = engineOf(opts.engine);
  let voices;
  try {
    voices = voicesOf(engine, opts);
  } catch (e) {
    if (e instanceof VoiceRefused) {
      deps.err(`refused: ${e.message}`);
      return 2;
    }
    throw e;
  }

  const abs = (p) => resolve(deps.repoRoot, p);
  const manifestPath = abs(opts.manifest ?? MANIFEST_FILE);
  const lockPath = abs(opts.lock ?? LOCK_FILE);
  const outRoot = abs(opts.out ?? OUTPUT_ROOT);
  const shown = (p) => {
    const rel = relative(deps.repoRoot, p);
    return rel.startsWith('..') ? p : rel.split(sep).join('/');
  };

  const manifest = JSON.parse(deps.readText(manifestPath));
  let lock = deps.exists(lockPath) ? parseLock(JSON.parse(deps.readText(lockPath))) : emptyLock();
  let rows;
  try {
    rows = selectRows(manifest.rows, opts, deps.keys);
  } catch (e) {
    deps.err(e instanceof Error ? e.message : String(e));
    return 2;
  }
  const plan = planRequests({ rows, engine, voices, lock, outRoot, hasMaster: deps.exists });
  const planned = totalChars(plan.requests);
  const maxChars = opts.maxChars ?? defaultMaxChars(planned);

  if (opts.dryRun) {
    for (const line of dryRunLines({ engine, voices, plan, maxChars, lockPath: shown(lockPath) })) deps.out(line);
    return 0;
  }

  for (const voice of voices) {
    const problem = outputProblem(voiceDir(outRoot, engine, voice), deps.isIgnored);
    if (problem !== null) {
      deps.err(problem);
      return 2;
    }
  }
  if (plan.requests.length === 0) {
    deps.out(`nothing to generate: all ${plan.skipped.length} rows are already in ${shown(lockPath)}`);
    return 0;
  }
  if (planned > maxChars) {
    deps.out(`note: the plan is ${fmt(planned)} billed characters and --max-chars is ${fmt(maxChars)}; the run stops at the cap`);
  }

  if (engine.needsDecoder === true && !deps.canDecode()) {
    deps.err(`${engine.label} masters are decoded to WAV with ffmpeg, which is not on the PATH: install it (brew install ffmpeg) and run again. Nothing was sent.`);
    return 2;
  }
  const client = await deps.createClient(engine, { env });
  const generated = today(deps.now);
  let spent = 0;
  let done = 0;
  for (const r of plan.requests) {
    if (spent + r.chars > maxChars) {
      deps.err(
        `spend guard: stopped before ${engine.id}/${r.voice} ${r.row.ref}: ${fmt(spent)} + ${r.chars} billed characters would cross ` +
          `--max-chars ${fmt(maxChars)}. ${done} of ${plan.requests.length} written; rerun to continue (written rows are skipped).`,
      );
      return 3;
    }
    let wav;
    try {
      const audio = await client.synthesize(r.payload);
      spent += r.chars;
      wav = audio.format === 'wav' ? audio.bytes : await deps.toWav(audio.bytes, audio.format, engine.sampleRate);
      const info = wavInfo(wav);
      if (info === null || info.channels !== 1 || info.sampleRate !== engine.sampleRate) {
        throw new Error(`the audio is not a ${engine.sampleRate} Hz mono WAV (${info === null ? 'not a WAV' : `${info.sampleRate} Hz, ${info.channels} channels`})`);
      }
    } catch (e) {
      // Only the message: never a request object, a header or a credential.
      deps.err(`${engine.id}/${r.voice} ${r.row.ref}: ${e instanceof Error ? e.message : String(e)}. Stopped; ${done} written, rerun to continue.`);
      return 1;
    }
    deps.mkdirp(voiceDir(outRoot, engine, r.voice));
    deps.writeAtomic(r.master, wav);
    lock = upsertLockRow(lock, {
      ref: r.row.ref,
      key: r.row.key,
      engine: engine.id,
      voice: r.voice,
      model: r.model,
      rate: r.row.rate,
      generated,
      saySha256: saySha256(r.row.say),
      mp3Sha256: null,
    });
    deps.writeAtomic(lockPath, renderLock(lock));
    done += 1;
    deps.out(`${engine.id}/${r.voice} ${r.row.ref} -> ${shown(r.master)} (${r.chars} characters)`);
  }
  deps.out(
    `${done} WAV masters written under ${shown(outRoot)}/${engine.id}/, ${fmt(spent)} billed characters, ` +
      `${plan.skipped.length} skipped; lock ${shown(lockPath)}. Revoke the credentials now (runbook section M), then tell ` +
      'the agent the folder path only.',
  );
  return 0;
}
