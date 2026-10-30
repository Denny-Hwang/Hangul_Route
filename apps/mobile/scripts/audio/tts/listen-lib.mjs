// `audio:tts:listen` (AMENDMENTS-AUDIO-CLIPS section 9, the optional owner listen; row AC-4): plays the clips of a
// selection back to back on this machine, printing each clip's id, text and romanization, and records the owner's
// vetoes. Not a gate (the owner's "finish without waiting on my review" rule), but a veto is honoured: a vetoed row is
// listed for regeneration in the QA report. Effects injected (listen.mjs wires them), so the flow is tested.
import { join, relative, resolve, sep } from 'node:path';
import { OUTPUT_ROOT, selectRows } from './generate-lib.mjs';
import { MANIFEST_FILE } from './manifest-lib.mjs';
import { clipFilesOf, clipRowMatcher } from './qa-run.mjs';
import { OWNER_LISTEN_FILE, REPORT_JSON, REPORT_MD, buildReport, renderReportMarkdown } from './qa-report.mjs';

export const LISTEN_USAGE =
  'usage: listen.mjs --pack <pack>[,<pack>] (or --pilot, --only <key>[,<key>]) [--engine <id> --voice <name> | --dir <folder>]\n' +
  '                  [--veto <key>[,<key>]] [--out <folder>] [--manifest <path>]\n' +
  '       with --dir, also --engine and --voice (the listen is recorded next to their QA report) or --out';

const VALUE_FLAGS = new Set(['--engine', '--voice', '--pack', '--only', '--dir', '--veto', '--out', '--manifest']);
const list = (value) => value.split(',').map((s) => s.trim()).filter((s) => s !== '');

export function parseListenArgs(argv) {
  const opts = { pilot: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--pilot') opts.pilot = true;
    else if (VALUE_FLAGS.has(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) return { error: `${arg} needs a value` };
      i += 1;
      opts[arg.slice(2)] = value;
    } else return { error: `unknown argument ${arg}` };
  }
  const out = { engine: opts.engine, voice: opts.voice, dir: opts.dir, out: opts.out, manifest: opts.manifest, pilot: opts.pilot };
  out.packs = opts.pack === undefined ? undefined : list(opts.pack);
  out.only = opts.only === undefined ? undefined : list(opts.only);
  out.veto = opts.veto === undefined ? [] : list(opts.veto);
  if (!out.pilot && out.packs === undefined && out.only === undefined) return { error: 'name what to play: --pack, --pilot or --only' };
  if (out.dir === undefined && (out.engine === undefined || out.voice === undefined)) return { error: 'name the clips: --engine and --voice (the master folder), or --dir' };
  // The listen is recorded next to the QA report, in the gitignored master folder: with --dir, name that folder
  // (--engine and --voice) or give --out.
  if (out.dir !== undefined && out.out === undefined && (out.engine === undefined || out.voice === undefined)) {
    return { error: 'with --dir, give --engine and --voice (the veto is recorded next to their QA report) or --out' };
  }
  return out;
}

/** What one answer means: keep (Enter), veto (v), replay (r), stop (q). */
export function answerOf(input) {
  const a = String(input ?? '').trim().toLowerCase();
  if (a === '' || a === 'k' || a === 'keep') return 'keep';
  if (a === 'v' || a === 'veto') return 'veto';
  if (a === 'r' || a === 'replay') return 'replay';
  if (a === 'q' || a === 'quit' || a === 'stop') return 'stop';
  return 'unknown';
}

/** The QA report with the owner's listen merged in (its regeneration list then includes the vetoed rows). */
export function withOwnerListen(report, ownerListen) {
  const { schemaVersion, summary, clips, missing, extra, notGenerated, packTotals, regenerate, ownerListen: _old, ...meta } = report;
  return buildReport({ meta, clips, missing, extra, notGenerated, packTotals, ownerListen });
}

/**
 * This run's listen merged into the earlier one: an earlier veto stays unless this run kept that clip (or vetoed it
 * again, which replaces it), so listening to one pack does not drop the vetoes of another. Each run is a session.
 *
 * @param {{ vetoes?: object[], sessions?: object[] } | null} previous the existing owner-listen.json
 * @param {{ date: string, selection: string, played: number, vetoes: object[], kept: string[] }} run
 */
export function mergeOwnerListen(previous, run) {
  const touched = new Set([...run.kept, ...run.vetoes.map((v) => v.key)]);
  const vetoes = [...(previous?.vetoes ?? []).filter((v) => !touched.has(v.key)), ...run.vetoes].sort((a, b) => a.key.localeCompare(b.key));
  const sessions = [...(previous?.sessions ?? []), { date: run.date, selection: run.selection, played: run.played, vetoed: run.vetoes.map((v) => v.key), kept: run.kept.length }];
  return { date: run.date, played: sessions.reduce((n, x) => n + x.played, 0), vetoes, sessions };
}

/**
 * The whole command. `deps`: repoRoot, readText, exists, listDir, writeAtomic, isIgnored(dir), sha256File(path),
 * keys { sayKey, sayRef }, romanize(text) -> string, play(path) -> Promise, ask(question) -> Promise<string> (null
 * when not interactive), now() -> Date, out(line), err(line). Exit 0 when done, 2 on a usage error or a refusal.
 */
export async function runListen(argv, env, deps) {
  const opts = parseListenArgs(argv);
  if (opts.error !== undefined) {
    deps.err(`${opts.error}\n${LISTEN_USAGE}`);
    return 2;
  }
  const abs = (p) => resolve(deps.repoRoot, p);
  const shown = (p) => {
    const rel = relative(deps.repoRoot, p);
    return rel.startsWith('..') ? p : rel.split(sep).join('/');
  };
  const dir = abs(opts.dir ?? join(OUTPUT_ROOT, opts.engine, opts.voice));
  const outDir = abs(opts.out ?? join(OUTPUT_ROOT, opts.engine, opts.voice));
  if (!deps.isIgnored(outDir)) {
    deps.err(`refused: ${shown(outDir)} is not gitignored. The listen is recorded next to the QA report, in the master folder (${OUTPUT_ROOT}/<engine>/<voice>/).`);
    return 2;
  }
  const manifest = JSON.parse(deps.readText(abs(opts.manifest ?? MANIFEST_FILE)));
  let rows;
  try {
    rows = selectRows(manifest.rows, opts, deps.keys);
  } catch (e) {
    deps.err(e instanceof Error ? e.message : String(e));
    return 2;
  }
  const unknownVeto = opts.veto.filter((k) => !rows.some((r) => r.key === k));
  if (unknownVeto.length > 0) {
    deps.err(`--veto: ${unknownVeto.join(', ')} not in the selection`);
    return 2;
  }
  if (!deps.exists(dir)) {
    deps.err(`no such folder: ${shown(dir)}`);
    return 2;
  }
  // A processed MP3 is what ships, so it is played when both it and the master are there. A processed group folder
  // names a clip by its ref's file id (audio/vocab/gangaji.mp3), a master folder by its row key.
  const rowKeyOf = clipRowMatcher(manifest.rows);
  const files = new Map();
  for (const f of clipFilesOf(deps.listDir(dir))) {
    const key = rowKeyOf(f.key, dir);
    if (key !== null && (!files.has(key) || f.ext === 'mp3')) files.set(key, join(dir, f.name));
  }
  // A veto holds while the clip is the one played: it records the sha256 of the played file and of the row's master
  // WAV and MP3 (when the engine and voice are named), so the QA report drops it once the row is regenerated.
  const masterDir = opts.engine !== undefined && opts.voice !== undefined ? abs(join(OUTPUT_ROOT, opts.engine, opts.voice)) : null;
  const vetoOf = async (row, note) => {
    const paths = [files.get(row.key), ...(masterDir === null ? [] : ['wav', 'mp3'].map((ext) => join(masterDir, `${row.key}.${ext}`)))];
    const sha256s = [];
    for (const p of new Set(paths.filter((x) => x !== undefined && deps.exists(x)))) sha256s.push(await deps.sha256File(p));
    return { key: row.key, text: row.text, note, sha256s: [...new Set(sha256s)] };
  };
  const vetoes = new Map();
  for (const key of opts.veto) vetoes.set(key, await vetoOf(rows.find((r) => r.key === key), ''));
  const kept = [];
  const interactive = deps.ask !== null && opts.veto.length === 0;
  deps.out(`audio:tts:listen: ${rows.length} clips from ${shown(dir)}.${interactive ? ' After each: Enter keeps it, v vetoes it, r plays it again, q stops.' : ''}`);
  let played = 0;
  rows: for (const [i, row] of rows.entries()) {
    const file = files.get(row.key);
    const label = `${String(i + 1).padStart(String(rows.length).length)}/${rows.length}  ${row.key}  ${row.text}  [${deps.romanize(row.text)}]`;
    if (file === undefined) {
      deps.out(`${label}  (no clip)`);
      continue;
    }
    deps.out(label);
    for (;;) {
      await deps.play(file);
      if (!interactive) break;
      const answer = answerOf(await deps.ask('  keep / v / r / q: '));
      if (answer === 'replay' || answer === 'unknown') continue;
      if (answer === 'veto') {
        const note = String((await deps.ask('  why (optional): ')) ?? '').trim();
        vetoes.set(row.key, await vetoOf(row, note));
      } else if (answer === 'keep') kept.push(row.key);
      if (answer === 'stop') {
        played += 1;
        break rows;
      }
      break;
    }
    played += 1;
  }

  // A run that could not ask (no terminal) and named no veto has nothing to record: the earlier listen stays as it is.
  if (!interactive && opts.veto.length === 0) {
    deps.out(`${played} played; nothing recorded (not interactive and no --veto).`);
    return 0;
  }
  const listenPath = join(outDir, OWNER_LISTEN_FILE);
  const previous = deps.exists(listenPath) ? JSON.parse(deps.readText(listenPath)) : null;
  const ownerListen = mergeOwnerListen(previous, {
    date: deps.now().toISOString().slice(0, 10),
    selection: [opts.pilot ? 'pilot' : null, opts.packs ? `packs ${opts.packs.join(',')}` : null, opts.only ? `only ${opts.only.join(',')}` : null].filter(Boolean).join(', '),
    played,
    vetoes: [...vetoes.values()],
    kept,
  });
  deps.writeAtomic(listenPath, `${JSON.stringify(ownerListen, null, 2)}\n`);
  const reportPath = join(outDir, REPORT_JSON);
  if (deps.exists(reportPath)) {
    const report = withOwnerListen(JSON.parse(deps.readText(reportPath)), ownerListen);
    deps.writeAtomic(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    deps.writeAtomic(join(outDir, REPORT_MD), renderReportMarkdown(report));
  }
  const v = ownerListen.vetoes;
  deps.out(`${played} played; ${v.length === 0 ? 'no veto' : `vetoed ${v.map((x) => x.key).join(', ')}`}. Recorded in ${shown(join(outDir, OWNER_LISTEN_FILE))}${deps.exists(reportPath) ? ` and ${REPORT_MD}` : ''}.`);
  return 0;
}
