// `audio:tts:listen` (AMENDMENTS-AUDIO-CLIPS section 9, the optional owner listen; row AC-4): plays the clips of a
// selection back to back on this machine, printing each clip's id, text and romanization, and records the owner's
// vetoes. Not a gate (the owner's "finish without waiting on my review" rule), but a veto is honoured: a vetoed row is
// listed for regeneration in the QA report. Effects injected (listen.mjs wires them), so the flow is tested.
import { join, relative, resolve, sep } from 'node:path';
import { CONTRAST_SETS_FILE, contrastUnitInfo, parseContrastSets } from '../content-sources.mjs';
import { OUTPUT_ROOT, selectRows } from './generate-lib.mjs';
import { LOCK_FILE, parseLock } from './lock-lib.mjs';
import { MANIFEST_FILE } from './manifest-lib.mjs';
import { seriesFormsOf } from './qa-lib.mjs';
import { clipFilesOf, clipRowMatcher, selectContrastSets } from './qa-run.mjs';
import { OWNER_CONTRAST_FILE, OWNER_LISTEN_FILE, REPORT_JSON, REPORT_MD, buildReport, renderReportMarkdown } from './qa-report.mjs';

export const LISTEN_USAGE =
  'usage: listen.mjs --pack <pack>[,<pack>] (or --pilot, --only <key>[,<key>]) [--engine <id> --voice <name> | --dir <folder>]\n' +
  '                  [--veto <key>[,<key>]] [--out <folder>] [--manifest <path>]\n' +
  '       with --dir, also --engine and --voice (the listen is recorded next to their QA report) or --out\n' +
  '       listen.mjs --contrast <set id>[,<set id>]|all --engine <id> --voice <name> [--speaker computer|phone] [--assets <folder>]\n' +
  '                  [--contrast-sets <path>] [--lock <path>] [--out <folder>]\n' +
  '                  the blind listen of the contrast sets (AMENDMENTS-MINIMAL-PAIRS section 3.3), recorded in owner-contrast.json';

const VALUE_FLAGS = new Set(['--engine', '--voice', '--pack', '--only', '--dir', '--veto', '--out', '--manifest', '--contrast', '--speaker', '--assets', '--contrast-sets', '--lock']);
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
  if (opts.contrast !== undefined) {
    // The blind listen of the sets is its own mode: no clip selection, no veto, always recorded next to the QA report.
    if (out.pilot || out.packs !== undefined || out.only !== undefined || out.dir !== undefined || out.veto.length > 0) {
      return { error: '--contrast is its own listen (the blind listen of the sets) and cannot be combined with --pilot, --pack, --only, --dir or --veto' };
    }
    if (out.engine === undefined || out.voice === undefined) return { error: '--contrast needs --engine and --voice (the result is recorded in their master folder)' };
    const sets = list(opts.contrast);
    if (sets.length === 0) return { error: '--contrast needs a set id or all' };
    if (sets.includes('all') && sets.length > 1) return { error: '--contrast all cannot be combined with set ids' };
    const speaker = opts.speaker ?? 'computer';
    if (!CONTRAST_SPEAKERS.includes(speaker)) return { error: `--speaker must be ${CONTRAST_SPEAKERS.join(' or ')}` };
    return { ...out, contrast: sets, speaker, assets: opts.assets, contrastSets: opts['contrast-sets'], lock: opts.lock };
  }
  if (opts.speaker !== undefined || opts.assets !== undefined || opts['contrast-sets'] !== undefined || opts.lock !== undefined) {
    return { error: '--speaker, --assets, --contrast-sets and --lock belong to --contrast' };
  }
  if (!out.pilot && out.packs === undefined && out.only === undefined) return { error: 'name what to play: --pack, --pilot or --only' };
  if (out.dir === undefined && (out.engine === undefined || out.voice === undefined)) return { error: 'name the clips: --engine and --voice (the master folder), or --dir' };
  // The listen is recorded next to the QA report, in the gitignored master folder: with --dir, name that folder
  // (--engine and --voice) or give --out.
  if (out.dir !== undefined && out.out === undefined && (out.engine === undefined || out.voice === undefined)) {
    return { error: 'with --dir, give --engine and --voice (the veto is recorded next to their QA report) or --out' };
  }
  return out;
}

/** Where the owner's sound came out (section 3.3, step 4): a phone-sized speaker loses the high-pitched aspiration noise first. */
export const CONTRAST_SPEAKERS = ['computer', 'phone'];

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
  const { schemaVersion, summary, clips, missing, extra, notGenerated, packTotals, contrastSets, regenerate, ownerListen: _old, ...meta } = report;
  return buildReport({ meta, clips, missing, extra, notGenerated, packTotals, ownerListen, contrastSets: contrastSets ?? null });
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
  if (opts.contrast !== undefined) return runContrastListen(opts, deps);
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

// --- The blind listen of the contrast sets (AMENDMENTS-MINIMAL-PAIRS section 3.3, row MP-1a) --------------------------------

/** What a member of each kind should sound like (section 3.3, step 2): asked once per set, about the members it has. */
const KIND_CLAUSES = Object.freeze({
  plain: 'soft and lower at the start',
  aspirated: 'a clear puff and higher',
  tense: 'tight, no puff, higher',
});
const ASK_REPEAT_LIMIT = 50;
const yesNo = (input) => {
  const a = String(input ?? '').trim().toLowerCase();
  if (a === 'y' || a === 'yes') return 'y';
  if (a === 'n' || a === 'no') return 'n';
  return a === 'q' || a === 'quit' || a === 'stop' ? 'q' : null;
};

/** The questions after the side-by-side play: the voice, the sound of each kind (or of ㅅ / ㅆ), and for words the word. */
export function contrastQuestions(set) {
  const questions = [{ id: 'sameFrame', text: 'Same calm voice, same speed and tune; only the first sound differs? (y/n, q stops): ' }];
  if (set.series === 's') {
    const plain = set.members.find((m) => m.kind === 'plain');
    const tense = set.members.find((m) => m.kind === 'tense');
    questions.push({ id: 'kinds', text: `${plain?.text} breathy, ${tense?.text} a longer, sharper hiss; both start high? (y/n, q stops): ` });
  } else {
    const clauses = set.members.map((m) => `${m.text} ${KIND_CLAUSES[m.kind]}`);
    questions.push({ id: 'kinds', text: `${clauses.join('; ')}? (y/n, q stops): ` });
  }
  const info = contrastUnitInfo(set.unit);
  if (info !== null && info.stage >= 2) questions.push({ id: 'wordSounds', text: 'Each one sounds like the word? (y/n, q stops): ' });
  return questions;
}

/**
 * The set's verdict (section 3.3, step 3): it passes when every blind play was right and every answer is `y`.
 * @param {{ correct: boolean }[]} plays
 * @param {Record<string, 'y' | 'n'>} answers
 */
export function contrastVerdict(plays, answers) {
  return plays.length > 0 && plays.every((p) => p.correct) && Object.values(answers).every((a) => a === 'y');
}

/** owner-contrast.json with `run` recorded for its set and speaker (a later run of the same speaker replaces the earlier). */
export function mergeOwnerContrast(previous, setId, run) {
  const sets = { ...(previous?.sets ?? {}) };
  sets[setId] = { runs: { ...(sets[setId]?.runs ?? {}), [run.speaker]: run } };
  return { schemaVersion: 1, sets };
}

/**
 * `listen.mjs --contrast <set id | all>`: per set, about a minute. Blind identification (the whole series as numbered
 * choices, each member played three times in a shuffled order, no answer shown), then the members side by side with the
 * questions of section 3.3, then the verdict, recorded per set in owner-contrast.json. Needs a terminal.
 * `deps` as runListen, plus shuffle(list) -> list. Exit 0 when every selected set was listened to, 1 when one was skipped,
 * 2 on a usage error or a refusal.
 */
async function runContrastListen(opts, deps) {
  const abs = (p) => resolve(deps.repoRoot, p);
  const shown = (p) => {
    const rel = relative(deps.repoRoot, p);
    return rel.startsWith('..') ? p : rel.split(sep).join('/');
  };
  const outDir = abs(opts.out ?? join(OUTPUT_ROOT, opts.engine, opts.voice));
  if (!deps.isIgnored(outDir)) {
    deps.err(`refused: ${shown(outDir)} is not gitignored. The listen is recorded next to the QA report, in the master folder (${OUTPUT_ROOT}/<engine>/<voice>/).`);
    return 2;
  }
  if (deps.ask === null || deps.ask === undefined) {
    deps.err('refused: the contrast listen asks you what you heard, so it needs a terminal (run it in your own terminal window).');
    return 2;
  }
  let sets;
  let lock;
  try {
    sets = selectContrastSets(parseContrastSets(JSON.parse(deps.readText(abs(opts.contrastSets ?? CONTRAST_SETS_FILE)))), opts.contrast);
    lock = parseLock(JSON.parse(deps.readText(abs(opts.lock ?? LOCK_FILE))));
  } catch (e) {
    deps.err(e instanceof Error ? e.message : String(e));
    return 2;
  }
  const assetsDir = abs(opts.assets ?? 'apps/mobile/assets/audio');
  const fileOf = (ref) => join(assetsDir, ref.replace(/^audio\//, ''));
  const resultPath = join(outDir, OWNER_CONTRAST_FILE);
  let record = deps.exists(resultPath) ? JSON.parse(deps.readText(resultPath)) : null;
  const date = deps.now().toISOString().slice(0, 10);
  deps.out(`audio:tts:listen --contrast: ${sets.length} set(s), sound from the ${opts.speaker}. Press the number you heard after each play; the answers are shown at the end of the set. q stops.`);

  const outcomes = { pass: [], fail: [], skipped: [] };
  sets: for (const [i, set] of sets.entries()) {
    // Only a processed MP3 the lock holds can be approved, so only that is played.
    const shas = {};
    const problems = [];
    for (const m of set.members) {
      const file = fileOf(m.ref);
      if (!deps.exists(file)) {
        problems.push(`${m.text}: no processed MP3 at ${shown(file)}`);
        continue;
      }
      const sha = await deps.sha256File(file);
      const locked = lock.rows.find((r) => r.ref === m.ref && r.engine === opts.engine && r.voice === opts.voice);
      if (locked === undefined || locked.mp3Sha256 !== sha) problems.push(`${m.text}: ${shown(file)} is not the MP3 the lock holds for ${opts.engine}/${opts.voice} (finish the hand-off first)`);
      shas[m.ref] = sha;
    }
    if (problems.length > 0) {
      deps.out(`set ${set.id} (${i + 1}/${sets.length}): skipped. ${problems.join('; ')}`);
      outcomes.skipped.push(set.id);
      continue;
    }

    const series = seriesFormsOf(set.members[0].text);
    const choices = [...series, ...set.members.map((m) => m.text).filter((t) => !series.includes(t))];
    deps.out(`\nset ${set.id} (${i + 1}/${sets.length}): which one is it?`);
    for (const [n, form] of choices.entries()) deps.out(`  ${n + 1}  ${form}  [${deps.romanize(form)}]`);

    const order = deps.shuffle(set.members.flatMap((m) => [m, m, m]));
    const plays = [];
    for (const [n, member] of order.entries()) {
      for (let tries = 0; ; tries += 1) {
        if (tries > ASK_REPEAT_LIMIT) return 2;
        await deps.play(fileOf(member.ref));
        const raw = String((await deps.ask(`  play ${n + 1}/${order.length}: 1-${choices.length}, r replays, q stops: `)) ?? '').trim().toLowerCase();
        if (raw === 'q' || raw === 'quit' || raw === 'stop') break sets;
        const pick = Number(raw);
        if (Number.isInteger(pick) && pick >= 1 && pick <= choices.length) {
          plays.push({ member: member.text, ref: member.ref, heard: choices[pick - 1], correct: choices[pick - 1] === member.text });
          break;
        }
      }
    }

    deps.out('  side by side, in series order:');
    const answers = {};
    for (const question of contrastQuestions(set)) {
      for (let tries = 0; ; tries += 1) {
        if (tries > ASK_REPEAT_LIMIT) return 2;
        for (const m of set.members) await deps.play(fileOf(m.ref));
        const a = yesNo(await deps.ask(`  ${question.text}`));
        if (a === 'q') break sets;
        if (a === 'y' || a === 'n') {
          answers[question.id] = a;
          break;
        }
      }
    }

    const correct = plays.filter((p) => p.correct).length;
    const pass = contrastVerdict(plays, answers);
    const note = pass ? '' : String((await deps.ask('  note (optional): ')) ?? '').trim();
    deps.out(`  ${set.id}: ${pass ? 'PASS' : 'FAIL'} (${correct} of ${plays.length} right; ${Object.entries(answers).map(([k, v]) => `${k} ${v}`).join(', ')})`);
    record = mergeOwnerContrast(record, set.id, { date, speaker: opts.speaker, pass, correct, total: plays.length, plays, answers, note, mp3Sha256: shas });
    deps.writeAtomic(resultPath, `${JSON.stringify(record, null, 2)}\n`);
    outcomes[pass ? 'pass' : 'fail'].push(set.id);
  }

  const failed = outcomes.fail.length > 0 ? ` (${outcomes.fail.join(', ')})` : '';
  const skipped = outcomes.skipped.length > 0 ? ` (${outcomes.skipped.join(', ')})` : '';
  deps.out(`\n${outcomes.pass.length} pass, ${outcomes.fail.length} fail${failed}, ${outcomes.skipped.length} skipped${skipped}. Recorded in ${shown(resultPath)} (${opts.speaker}).`);
  if (opts.speaker === 'computer') deps.out('Once more with the sound on a phone-sized speaker: add --speaker phone (section 3.3, step 4). A set that fails only there is a fail.');
  return outcomes.skipped.length > 0 ? 1 : 0;
}
