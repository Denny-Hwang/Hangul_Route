// The whole `audio:tts:qa` command (AMENDMENTS-AUDIO-CLIPS section 9; row AC-4) with its effects injected, so the flow
// is tested with mocked recognizers, no audio and no model. qa.mjs wires the real effects.
//
// Exit codes: 0 every selected row has a clip that passes; 1 a clip fails or is missing; 2 a usage error or a refusal.
import { join, relative, resolve, sep } from 'node:path';
import { AUDIO_PACKS } from '@hangul-route/content-schema';
import { PACK_SET_LIMITS, clipKbpsOf, evaluateSet, fileIdOf, parseBitrate, recordingGroupOf } from '../lib.mjs';
import { OUTPUT_ROOT, selectRows } from './generate-lib.mjs';
import { LOCK_FILE, emptyLock, parseLock } from './lock-lib.mjs';
import { MANIFEST_FILE, OVERRIDES_FILE } from './manifest-lib.mjs';
import { parseOverrides } from './overrides-schema.mjs';
import { CTC_MARGIN_NATS, clipVerdict, closedSetOf, evaluatePass1, evaluatePass2, targetFormsOf } from './qa-lib.mjs';
import { OWNER_LISTEN_FILE, REPORT_JSON, REPORT_MD, buildReport, evaluateSignal, identityChecks, parseMeasure, renderReportMarkdown, reportPasses } from './qa-report.mjs';

export const QA_USAGE =
  'usage: qa.mjs --engine <id> --voice <name> (--pack <pack>[,<pack>] | --pilot | --only <key>[,<key>]) [--dir <folder>[,<folder>]]\n' +
  '              [--out <folder>] [--margin <nats>] [--say-bitrate 48|64] [--whisper-cli <path>] [--whisper-model <path>] [--grammar-penalty <n>]\n' +
  '              [--ctc-model <folder>] [--ctc-model-id <id>] [--ctc-licence <spdx>] [--python <path>]\n' +
  '              [--manifest <path>] [--overrides <path>] [--lock <path>]';

/** Where the local models live by default: inside the gitignored apps/mobile/recordings/ (docs/launch/tts-qa-setup.md). */
export const MODELS_ROOT = 'apps/mobile/recordings/models';
export const DEFAULT_WHISPER_MODEL = `${MODELS_ROOT}/ggml-large-v3.bin`;
export const DEFAULT_CTC_MODEL_DIR = `${MODELS_ROOT}/wav2vec2-base-korean`;
export const DEFAULT_PYTHON = `${MODELS_ROOT}/venv/bin/python`;

const VALUE_FLAGS = new Set([
  '--engine', '--voice', '--pack', '--only', '--dir', '--out', '--margin', '--say-bitrate', '--whisper-cli', '--whisper-model', '--grammar-penalty',
  '--ctc-model', '--ctc-model-id', '--ctc-licence', '--python', '--manifest', '--overrides', '--lock',
]);
const list = (value) => value.split(',').map((s) => s.trim()).filter((s) => s !== '');
const camel = (flag) => flag.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** The command line, or { error }. */
export function parseQaArgs(argv) {
  const opts = { pilot: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--pilot') opts.pilot = true;
    else if (VALUE_FLAGS.has(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) return { error: `${arg} needs a value` };
      i += 1;
      const name = camel(arg);
      if (opts[name] !== undefined) return { error: `${arg} is given twice` };
      opts[name] = value;
    } else return { error: `unknown argument ${arg}` };
  }
  if (opts.engine === undefined || opts.voice === undefined) return { error: '--engine and --voice are required (the lock rows and the master folder are per voice)' };
  const out = { ...opts };
  out.packs = opts.pack === undefined ? undefined : list(opts.pack);
  out.only = opts.only === undefined ? undefined : list(opts.only);
  out.dirs = opts.dir === undefined ? undefined : list(opts.dir);
  delete out.pack;
  delete out.dir;
  if (out.pilot && out.packs !== undefined) return { error: '--pilot and --pack cannot be combined' };
  if (!out.pilot && out.packs === undefined && out.only === undefined) return { error: 'name what to check: --pack, --pilot or --only' };
  if (out.packs !== undefined) {
    const unknown = out.packs.filter((p) => !AUDIO_PACKS.includes(p));
    if (unknown.length > 0 || out.packs.length === 0) return { error: `unknown pack ${unknown.join(', ') || '(none)'}; packs: ${AUDIO_PACKS.join(', ')}` };
  }
  out.threshold = CTC_MARGIN_NATS;
  if (opts.margin !== undefined) {
    const n = Number(opts.margin);
    if (!/^\d+(\.\d+)?$/.test(opts.margin) || !(n > 0)) return { error: '--margin must be a positive number of nats' };
    out.threshold = n;
  }
  if (opts.sayBitrate !== undefined) {
    // The say group's bitrate, as the pilot recorded it in section 13 (48 kbps, or 64 if 48 was ruled out). Without
    // it, a say clip is checked at the allowed bitrate its sample rate encodes.
    try {
      out.sayBitrate = parseBitrate(opts.sayBitrate);
    } catch (e) {
      return { error: `--say-bitrate: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  if (opts.grammarPenalty !== undefined) {
    if (!/^\d+(\.\d+)?$/.test(opts.grammarPenalty)) return { error: '--grammar-penalty must be a number' };
    out.grammarPenalty = Number(opts.grammarPenalty);
  }
  return out;
}

/** The recognizers never run in CI (section 9: local only); an agent shell on the owner's machine may run them. */
export function qaRefusalOf(env) {
  return env.CI === undefined ? null : 'refused: CI is set. The two recognizers run locally only, on the owner\'s machine (docs/launch/tts-qa-setup.md), never in CI.';
}

const CLIP_FILE = /^([a-z0-9][a-z0-9-]*)\.(wav|mp3)$/;

/** The clips of a folder: `<key>.wav` or `<key>.mp3` (other files, such as the report, are not clips). */
export function clipFilesOf(names) {
  return names.map((name) => CLIP_FILE.exec(name)).filter((m) => m !== null).map((m) => ({ name: m[0], key: m[1], ext: m[2] }));
}

/**
 * Which manifest row a clip file belongs to, by its name (without the extension) and its folder: in a processed
 * group folder (`.../audio/jamo`, `.../audio/vocab`, `.../audio/say`), the row whose ref has that file id; in any other
 * folder (the masters), the row of that key. null: no row (an extra file).
 */
export function clipRowMatcher(manifestRows) {
  const keys = new Set(manifestRows.map((r) => r.key));
  const byFileId = new Map();
  for (const r of manifestRows) {
    const group = recordingGroupOf(r.ref);
    if (group !== null) byFileId.set(`${group}/${fileIdOf(r.ref)}`, r.key);
  }
  return (name, dir) => {
    // A processed group folder holds clips by file id only (jamo file ids are their keys).
    const group = processedGroupOf(dir);
    if (group !== null) return byFileId.get(`${group}/${name}`) ?? null;
    return keys.has(name) ? name : null;
  };
}

/** The group of a processed folder (`.../audio/jamo`, `.../audio/vocab`, `.../audio/say`), or null (a master folder). */
function processedGroupOf(dir) {
  const [parent, group] = String(dir).split(/[\\/]+/).filter(Boolean).slice(-2);
  return parent === 'audio' && ['jamo', 'vocab', 'say'].includes(group) ? group : null;
}
const isProcessedFolder = (dir) => processedGroupOf(dir) !== null;

const describeSelection = (opts) =>
  [opts.pilot ? 'the pilot' : null, opts.packs ? `packs ${opts.packs.join(', ')}` : null, opts.only ? `only ${opts.only.join(', ')}` : null].filter(Boolean).join(', ');

/** Groups closed-set clips that share one candidate list, so each forced-choice grammar runs once. */
function byCandidates(items) {
  const groups = new Map();
  for (const item of items) {
    const candidates = [...item.closedSet.targets, ...item.closedSet.confusables];
    const id = candidates.join('|');
    if (!groups.has(id)) groups.set(id, { candidates, files: [] });
    groups.get(id).files.push(item.file);
  }
  return [...groups.values()];
}

/**
 * The whole command. `deps`:
 *   repoRoot, readText(path), exists(path), listDir(dir) -> names, sha256File(path) -> hex, writeAtomic(path, text),
 *   isIgnored(dir), keys { sayKey, sayRef }, createRecognizers(opts) -> { pass1, pass2 } (see recognizers.mjs),
 *   measure(path) -> { probeJson, log }, now() -> Date, out(line), err(line)
 */
export async function runQa(argv, env, deps) {
  const opts = parseQaArgs(argv);
  if (opts.error !== undefined) {
    deps.err(`${opts.error}\n${QA_USAGE}`);
    return 2;
  }
  const refusal = qaRefusalOf(env);
  if (refusal !== null) {
    deps.err(refusal);
    return 2;
  }
  const abs = (p) => resolve(deps.repoRoot, p);
  const shown = (p) => {
    const rel = relative(deps.repoRoot, p);
    return rel.startsWith('..') ? p : rel.split(sep).join('/');
  };
  const masterDir = abs(join(OUTPUT_ROOT, opts.engine, opts.voice));
  const dirs = (opts.dirs ?? [masterDir]).map(abs);
  const outDir = abs(opts.out ?? shown(masterDir));
  if (!deps.isIgnored(outDir)) {
    deps.err(`refused: ${shown(outDir)} is not gitignored. The report stays local, next to the masters (${OUTPUT_ROOT}/<engine>/<voice>/).`);
    return 2;
  }

  const manifest = JSON.parse(deps.readText(abs(opts.manifest ?? MANIFEST_FILE)));
  const overridesPath = abs(opts.overrides ?? OVERRIDES_FILE);
  const overrides = deps.exists(overridesPath) ? parseOverrides(JSON.parse(deps.readText(overridesPath))) : {};
  const lockPath = abs(opts.lock ?? LOCK_FILE);
  const lock = deps.exists(lockPath) ? parseLock(JSON.parse(deps.readText(lockPath))) : emptyLock();
  let rows;
  try {
    rows = selectRows(manifest.rows, opts, deps.keys);
  } catch (e) {
    deps.err(e instanceof Error ? e.message : String(e));
    return 2;
  }
  const wanted = new Set(rows.map((r) => r.key));

  // Clips: every <key>.wav / <key>.mp3 in the folders; a key outside the selection is not this run's business,
  // unless the selection is a whole pack (then a stray file of no row is reported as extra). A processed clip is
  // named by its ref's file id (audio/vocab/gangaji.mp3 for a hash-keyed vocab row), so in a folder that ends in
  // its ref's group folder (assets/audio/vocab) it is matched by that id as well.
  const rowKeyOf = clipRowMatcher(manifest.rows);
  const clips = [];
  for (const dir of dirs) {
    if (!deps.exists(dir)) {
      deps.err(`no such folder: ${shown(dir)}`);
      return 2;
    }
    for (const f of clipFilesOf(deps.listDir(dir))) {
      const file = join(dir, f.name);
      const rowKey = rowKeyOf(f.key, dir);
      clips.push({ key: rowKey ?? f.key, known: rowKey !== null, processedFolder: isProcessedFolder(dir), ext: f.ext, file, shownFile: shown(file), sha256: await deps.sha256File(file) });
    }
  }
  const selected = clips.filter((c) => c.known && wanted.has(c.key));
  const stage = selected.length > 0 && selected.every((c) => c.ext === 'mp3') ? 'processed' : 'masters';
  const identity = identityChecks({
    rows,
    clips: selected.map((c) => ({ key: c.key, file: c.shownFile, ext: c.ext, sha256: c.sha256 })),
    lock,
    engine: opts.engine,
    voice: opts.voice,
  });
  // A master folder holds generated clips only, so a file of no row is extra (an identity failure). A processed group
  // folder also holds recorded clips the manifest does not generate: those are listed, not checked.
  const extra = opts.only === undefined ? clips.filter((c) => !c.known && !c.processedFolder).map((c) => c.shownFile) : [];
  const notGenerated = clips.filter((c) => !c.known && c.processedFolder).map((c) => c.shownFile);

  let recognizers;
  try {
    recognizers = await deps.createRecognizers(opts);
  } catch (e) {
    deps.err(`audio:tts:qa: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
  const items = [];
  for (const row of rows) {
    const clip = selected.find((c) => c.key === row.key);
    if (clip === undefined) continue;
    items.push({ row, clip, file: clip.file, forms: targetFormsOf(row, overrides), closedSet: closedSetOf(row, overrides) });
  }
  deps.out(`audio:tts:qa: ${items.length} clips of ${rows.length} rows (${describeSelection(opts)}), ${stage === 'masters' ? 'WAV masters' : 'processed MP3s'}`);

  deps.out('Pass 1 (whisper.cpp): free transcription');
  const free1 = await recognizers.pass1.transcribe(items.map((i) => i.file));
  const forced1 = new Map();
  const short = items.filter((i) => i.closedSet !== null);
  deps.out(`Pass 1 (whisper.cpp): forced choice for ${short.length} closed-set clips`);
  for (const group of byCandidates(short)) {
    for (const [file, text] of await recognizers.pass1.forcedChoice(group.files, group.candidates)) forced1.set(file, text);
  }
  deps.out('Pass 2 (CTC): greedy decode and forced-alignment scores');
  const pass2Out = await recognizers.pass2.run(items.map((i) => ({ file: i.file, candidates: i.closedSet === null ? [] : [...i.closedSet.targets, ...i.closedSet.confusables] })));

  const results = [];
  const packBytes = new Map();
  for (const item of items) {
    const { row, clip } = item;
    const pass1 = evaluatePass1({ forms: item.forms, closedSet: item.closedSet, free: free1.get(item.file), forced: forced1.get(item.file) });
    const p2 = pass2Out.get(item.file);
    const pass2 = p2 === undefined ? undefined : evaluatePass2({ forms: item.forms, closedSet: item.closedSet, free: p2.free, scores: p2.scores, threshold: opts.threshold });
    let signal;
    try {
      const measured = parseMeasure(await deps.measure(item.file));
      const kbps = clipKbpsOf(row.ref, { kbps: recordingGroupOf(row.ref) === 'say' ? opts.sayBitrate : undefined, sampleRate: measured.probe.sampleRate });
      signal = evaluateSignal(row, measured, { kbps, stage: clip.ext === 'mp3' ? 'processed' : 'masters' });
      if (clip.ext === 'mp3') {
        if (!packBytes.has(row.pack)) packBytes.set(row.pack, []);
        packBytes.get(row.pack).push(measured.probe.bytes);
      }
    } catch (e) {
      signal = { ok: false, failures: [`could not be measured: ${e instanceof Error ? e.message : String(e)}`], flags: [], pending: [], summary: null, closure: null };
    }
    const id = identity.byKey.get(row.key);
    const { verdict, reasons } = clipVerdict({ pass1, pass2, signal, identity: id });
    results.push({
      key: row.key,
      ref: row.ref,
      kind: row.kind,
      pack: row.pack,
      text: row.text,
      say: row.say,
      file: clip.shownFile,
      sha256: clip.sha256,
      closedSet: item.closedSet,
      pass1,
      pass2: pass2 ?? null,
      signal: signal.summary === null ? null : signal,
      identity: id,
      verdict,
      reasons,
    });
  }

  // AC-B6 set totals of the processed jamo packs this run selected whole (--pack).
  const packTotals = stage === 'processed'
    ? (opts.packs ?? []).filter((pack) => Object.prototype.hasOwnProperty.call(PACK_SET_LIMITS, pack)).map((pack) => {
        const sizes = packBytes.get(pack) ?? [];
        const failures = evaluateSet(pack, sizes);
        return { pack, clips: sizes.length, bytes: sizes.reduce((a, b) => a + b, 0), limit: PACK_SET_LIMITS[pack], ok: failures.length === 0, failures };
      })
    : [];

  const listenPath = join(outDir, OWNER_LISTEN_FILE);
  const ownerListen = deps.exists(listenPath) ? JSON.parse(deps.readText(listenPath)) : null;
  const [p1Info, p2Info] = await Promise.all([recognizers.pass1.describe(), recognizers.pass2.describe()]);
  const report = buildReport({
    meta: {
      generatedAt: deps.now().toISOString(),
      engine: opts.engine,
      voice: opts.voice,
      stage,
      folders: dirs.map(shown),
      masterDir: shown(masterDir),
      selection: { pilot: opts.pilot, packs: opts.packs ?? null, only: opts.only ?? null },
      selectionLabel: describeSelection(opts),
      recognizers: { pass1: p1Info, pass2: p2Info },
    },
    clips: results,
    missing: identity.missing,
    extra,
    notGenerated,
    ownerListen,
    packTotals,
  });
  deps.writeAtomic(join(outDir, REPORT_JSON), `${JSON.stringify(report, null, 2)}\n`);
  deps.writeAtomic(join(outDir, REPORT_MD), renderReportMarkdown(report));

  const s = report.summary;
  deps.out(`${s.pass} of ${s.rows} rows pass; ${s.fail} fail, ${s.missing} missing${s.vetoed ? `, ${s.vetoed} vetoed` : ''}. Report: ${shown(join(outDir, REPORT_MD))} (and ${REPORT_JSON}).`);
  if (report.regenerate.keys.length > 0) {
    deps.out(`Regenerate ${report.regenerate.keys.length} rows (another take or an AC-B3 override), in the owner's own terminal:`);
    for (const line of report.regenerate.commands) deps.out(`  ${line}`);
  }
  if (report.extra.length > 0) deps.out(`${report.extra.length} extra files have no manifest row (an identity failure): remove them.`);
  for (const p of report.packTotals.filter((x) => !x.ok)) deps.out(`pack ${p.pack}: ${p.failures.join('; ')}`);
  return reportPasses(report) ? 0 : 1;
}
