// The shared checks and the report of the two-pass QA (AMENDMENTS-AUDIO-CLIPS section 9; row AC-4).
//
//   measureArgs, parseMeasure, signalSummary, evaluateSignal   duration and silence (CLIP_LIMITS), onset and voiced
//                                                               span, the closure of a final, loudness and peak, from
//                                                               ffprobe and one ffmpeg pass (silencedetect + ebur128)
//   identityChecks                                              one clip per manifest row, every clip in the lock, no
//                                                               two jamo clips that must differ byte-identical
//   buildReport, renderReportMarkdown, regenerationCommands     the JSON and Markdown report, in the format the
//                                                               content PR body pastes (with the two MAR verdict columns)
//
// Pure: the effects (ffmpeg, the file system, the recognizers) are in qa-run.mjs and recognizers.mjs.
import { createHash } from 'node:crypto';
import {
  CLIP_LIMITS,
  CLIP_PADDING_S,
  MAX_TRUE_PEAK_DB,
  clipClassOf,
  clipLimitsOf,
  evaluateReport,
  parseEbur128,
  parseProbe,
  parseSilences,
  spokenSyllableCount,
} from '../lib.mjs';
import { decomposeSyllable } from './qa-lib.mjs';

export const REPORT_SCHEMA_VERSION = 1;
export const REPORT_JSON = 'qa-report.json';
export const REPORT_MD = 'qa-report.md';
export const OWNER_LISTEN_FILE = 'owner-listen.json';

/** What silence is: the threshold the processing trim uses (-50 dB), over at least 50 ms. */
export const SILENCEDETECT_FILTER = 'silencedetect=noise=-50dB:d=0.05';
/** Leading and trailing silence after processing (section 9): 0.25-0.4 s; the processing pads 0.3 s each side. */
export const EDGE_SILENCE_S = Object.freeze({ min: 0.25, max: 0.4 });
/** No internal silence over 0.5 s in a clip of 1-2 syllables. */
export const MAX_INTERNAL_SILENCE_S = 0.5;
/** A jamo clip whose voiced span is under 0.15 s fails (truncation). */
export const MIN_VOICED_SPAN_S = 0.15;
/** Speech that starts within 50 ms of the first sample of a WAV master was cut into: a clipped onset. */
export const CLIPPED_ONSET_S = 0.05;
/**
 * An onset with no rise: the first voiced 10 ms frame (RMS over the -50 dB silence threshold) is already within 6 dB
 * of the clip's loudest frame. Speech rises into its first syllable (on recorded synthetic clips: a 40 ms attack rises
 * 26 dB, a cut-into tone 0.4 dB), so this catches a take whose start was cut even after the processing has padded
 * 0.3 s of silence in front of it, where the leading silence alone no longer shows it.
 */
export const ABRUPT_ONSET_DB = 6;
/** The analysis frames of the onset check: 10 ms at 44.1 kHz (every clip is resampled to 44.1 kHz for it). */
export const ONSET_FRAME_SAMPLES = 441;
const SILENCE_DB = -50;
const EPS = 1e-3;

/** The ffprobe arguments of the format checks (as check-audio.mjs). */
export function probeArgs(path) {
  return ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name,channels,sample_rate:format=duration,size', '-of', 'json', path];
}

/** The per-frame RMS level, logged by ametadata after the loudness meter (which passes the audio through unchanged). */
export const FRAME_LEVEL_FILTER =
  `aresample=44100,asetnsamples=n=${ONSET_FRAME_SAMPLES},` +
  'astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=RMS_level,ametadata=print:key=lavfi.astats.Overall.RMS_level';

/** One ffmpeg pass that logs the silences, the loudness summary and the per-frame level of the onset check. */
export function measureArgs(path) {
  return ['-hide_banner', '-nostats', '-i', path, '-af', `${SILENCEDETECT_FILTER},ebur128=peak=true,${FRAME_LEVEL_FILTER}`, '-f', 'null', '-'];
}

/** The per-frame RMS levels of the `measureArgs` log: [{ t, db }] in order (-Infinity for digital silence). */
export function parseFrameLevels(log) {
  const frames = [];
  let t = null;
  for (const m of String(log).matchAll(/pts_time:(-?[\d.]+)|lavfi\.astats\.Overall\.RMS_level=(-?inf|-?[\d.]+)/g)) {
    if (m[1] !== undefined) t = Number(m[1]);
    else frames.push({ t, db: m[2].endsWith('inf') ? Number.NEGATIVE_INFINITY : Number(m[2]) });
  }
  return frames;
}

/**
 * The rise of the onset: the clip's loudest frame less its first voiced frame, in dB (null when the log has no frame
 * levels or nothing is voiced).
 */
export function onsetRiseOf(frames) {
  const first = frames.find((f) => f.db > SILENCE_DB);
  if (first === undefined) return null;
  const peak = Math.max(...frames.map((f) => f.db));
  return { atS: first.t, firstDb: round(first.db), peakDb: round(peak), riseDb: round(peak - first.db) };
}

const round = (n) => Math.round(n * 1000) / 1000;

/**
 * The shape of a clip from its silences: the leading and trailing silence, the onset (where speech starts), the end
 * of the voiced part (for a final, where the closure is), the voiced span and the longest internal silence.
 */
export function signalSummary(silences, durationS) {
  const lead = silences.find((s) => s.start <= EPS);
  const trail = silences.find((s) => s.end >= durationS - EPS && s !== lead);
  const leadingS = lead ? Math.min(lead.end, durationS) : 0;
  const trailingS = trail ? durationS - trail.start : 0;
  const internal = silences.filter((s) => s !== lead && s !== trail).map((s) => round(s.end - s.start));
  const voicedSpanS = Math.max(0, durationS - leadingS - trailingS - internal.reduce((a, b) => a + b, 0));
  return {
    durationS: round(durationS),
    onsetS: round(leadingS),
    leadingS: round(leadingS),
    trailingS: round(trailingS),
    voicedEndS: round(Math.max(leadingS, durationS - trailingS)),
    voicedSpanS: round(voicedSpanS),
    maxInternalS: internal.length === 0 ? 0 : Math.max(...internal),
  };
}

/** ffprobe JSON and the ffmpeg log of `measureArgs` => the format, the loudness and the silence summary. */
export function parseMeasure({ probeJson, log }) {
  const probe = parseProbe(probeJson);
  const loudness = parseEbur128(log);
  const silences = parseSilences(log, probe.durationS);
  return { probe, loudness, silences, summary: signalSummary(silences, probe.durationS), onset: onsetRiseOf(parseFrameLevels(log)) };
}

/** Whether a jamo clip ends on a final (악 안 알 암 압 앙 앋): its closure is reported. */
function endsOnFinal(row) {
  const last = [...String(row.text)].pop();
  const parts = last === undefined ? null : decomposeSyllable(last);
  return parts !== null && parts.t !== 0;
}

const isJamoRow = (row) => row.kind === 'jamo-sound' || row.kind === 'jamo-name';

/**
 * The shared signal checks of one clip (section 9). A processed MP3 gets every check: the format, duration and size
 * of its class (`CLIP_LIMITS`; a sentence per spoken syllable), loudness and true peak, the edge silences, internal
 * silence, onset and voiced span. A WAV master is not processed yet: it gets the checks that do not depend on the
 * processing (voiced span within the class bound less its padding, internal silence, the jamo onset and voiced span),
 * and the rest are listed as `pending` until the processed MP3 is checked.
 *
 * @param {{ kind: string, text: string, ref: string }} row
 * @param {ReturnType<typeof parseMeasure>} measured
 * @param {{ kbps: 64 | 48, stage: 'processed' | 'masters' }} context
 */
export function evaluateSignal(row, measured, { kbps, stage }) {
  const { probe, loudness, summary, onset = null } = measured;
  const clipClass = clipClassOf(row);
  const syllables = spokenSyllableCount(row.text);
  const context = { kbps, syllables: CLIP_LIMITS[clipClass].perSyllable ? syllables : undefined };
  const failures = [];
  const flags = [];
  const pending = [];
  if (stage === 'processed') {
    failures.push(...evaluateReport(clipClass, { ...probe, ...loudness }, context));
    for (const [label, value] of [['leading', summary.leadingS], ['trailing', summary.trailingS]]) {
      if (value < EDGE_SILENCE_S.min - EPS || value > EDGE_SILENCE_S.max + EPS) failures.push(`${label} silence ${value} s: must be ${EDGE_SILENCE_S.min}-${EDGE_SILENCE_S.max} s`);
    }
  } else {
    pending.push('format, size, loudness and edge silence (checked on the processed MP3)');
    const lim = clipLimitsOf(clipClass, context);
    const maxVoiced = round(lim.maxS - CLIP_PADDING_S);
    if (summary.voicedSpanS > maxVoiced + EPS) failures.push(`voiced span ${summary.voicedSpanS} s: must be <= ${maxVoiced} s for a ${clipClass} clip (extra speech?)`);
    if (loudness.truePeakDb > 0) flags.push(`master peak ${loudness.truePeakDb} dBFS is over 0 (clipped master?)`);
  }
  if (syllables >= 1 && syllables <= 2 && summary.maxInternalS > MAX_INTERNAL_SILENCE_S + EPS) {
    failures.push(`internal silence ${summary.maxInternalS} s: must be <= ${MAX_INTERNAL_SILENCE_S} s in a clip of 1-2 syllables`);
  }
  if (isJamoRow(row)) {
    if (summary.voicedSpanS < MIN_VOICED_SPAN_S - EPS) failures.push(`voiced span ${summary.voicedSpanS} s: must be >= ${MIN_VOICED_SPAN_S} s`);
    // A master is where a truncated take shows: speech from the first sample. After processing (trim, then 0.3 s of
    // pad) the leading silence is always there, so a cut is found by the onset's missing rise, in both stages.
    if (summary.onsetS < CLIPPED_ONSET_S) failures.push(`clipped onset: speech starts at ${summary.onsetS} s${stage === 'masters' ? ' in the master (a cut take)' : ''}`);
    if (onset === null) failures.push('onset level not measured (no frame levels in the ffmpeg output)');
    else if (onset.riseDb < ABRUPT_ONSET_DB) failures.push(`clipped onset: the first voiced frame (${onset.atS} s) is ${onset.riseDb} dB under the loudest, must rise >= ${ABRUPT_ONSET_DB} dB`);
  }
  const closure = isJamoRow(row) && endsOnFinal(row) ? { atS: summary.voicedEndS, silenceAfterS: summary.trailingS } : null;
  return { ok: failures.length === 0, failures, flags, pending, summary, onset, loudness, probe, closure, maxTruePeakDb: MAX_TRUE_PEAK_DB };
}

// --- Identity -------------------------------------------------------------------------------------------------

export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * The identity checks (section 9): every manifest row has exactly one clip, every clip is in the lock (a processed
 * MP3 by its sha256; a WAV master, whose hash the lock does not hold, by its row's sha256 of the exact text sent), and
 * no two jamo clips that must differ (different texts) are byte-identical.
 *
 * @param {{ rows: readonly { ref: string, key: string, kind: string, text: string, say: string }[],
 *   clips: readonly { key: string, file: string, ext: 'wav' | 'mp3', sha256: string }[],
 *   lock: { rows: readonly object[] }, engine: string, voice: string }} input
 * @returns {{ byKey: Map<string, { ok: boolean, failures: string[], flags: string[] }>, missing: string[], extra: string[] }}
 */
export function identityChecks({ rows, clips, lock, engine, voice }) {
  const rowByKey = new Map(rows.map((r) => [r.key, r]));
  const clipsByKey = new Map();
  for (const c of clips) {
    if (!clipsByKey.has(c.key)) clipsByKey.set(c.key, []);
    clipsByKey.get(c.key).push(c);
  }
  const byKey = new Map();
  const missing = rows.filter((r) => !clipsByKey.has(r.key)).map((r) => r.key);
  const extra = clips.filter((c) => !rowByKey.has(c.key)).map((c) => c.file).sort();
  const jamoByHash = new Map();
  for (const row of rows) {
    const mine = clipsByKey.get(row.key);
    if (mine === undefined) continue;
    const failures = [];
    const flags = [];
    if (mine.length > 1) failures.push(`${mine.length} clips for one row: ${mine.map((c) => c.file).join(', ')}`);
    const clip = mine[0];
    const locked = lock.rows.find((l) => l.ref === row.ref && l.engine === engine && l.voice === voice);
    if (locked === undefined) failures.push(`not in the lock for ${engine}/${voice}`);
    else if (clip.ext === 'mp3') {
      if (locked.mp3Sha256 === null) failures.push('the lock has no processed MP3 sha256 for this row (hand-off step)');
      else if (locked.mp3Sha256 !== clip.sha256) failures.push(`sha256 ${clip.sha256.slice(0, 12)}... is not the lock's ${locked.mp3Sha256.slice(0, 12)}...`);
    } else if (locked.saySha256 !== sha256Hex(row.say)) failures.push('the lock row was generated from another text: regenerate it');
    if (isJamoRow(row)) {
      if (!jamoByHash.has(clip.sha256)) jamoByHash.set(clip.sha256, []);
      jamoByHash.get(clip.sha256).push(row);
    }
    byKey.set(row.key, { ok: true, failures, flags });
  }
  for (const same of jamoByHash.values()) {
    if (new Set(same.map((r) => r.text)).size < 2) continue;
    for (const row of same) {
      const others = same.filter((r) => r !== row).map((r) => `${r.key} (${r.text})`);
      byKey.get(row.key).failures.push(`byte-identical to ${others.join(', ')}, which must sound different`);
    }
  }
  for (const v of byKey.values()) v.ok = v.failures.length === 0;
  return { byKey, missing, extra };
}

// --- The report -----------------------------------------------------------------------------------------------

/** G4: at least 98 % first-take exact match of words and sentences in each recognizer. */
export const G4_FIRST_TAKE = 0.98;
const FREE_KINDS = new Set(['word', 'sentence', 'narration']);

function firstTake(clips, pass) {
  const scope = clips.filter((c) => FREE_KINDS.has(c.kind) && c[pass] !== null && c[pass] !== undefined);
  const matched = scope.filter((c) => c[pass].freeMatch).length;
  const rate = scope.length === 0 ? null : Math.round((matched / scope.length) * 10000) / 10000;
  return { matched, total: scope.length, rate, meetsG4: rate === null ? null : rate >= G4_FIRST_TAKE };
}

/**
 * The commands that regenerate the failing rows, for the owner's own terminal (docs/launch/owner-runbook.md section
 * M). A WAV master is moved aside first, because the generator skips a row whose master is still there (`missing`
 * rows have no master to move). A processed MP3 is in the lock with its mp3Sha256, so the generator skips it too:
 * another take needs its lock row's mp3Sha256 set back to null (and its master moved aside), or an AC-B3 override,
 * which changes the text sent, so its row is never skipped.
 */
export function regenerationCommands({ engine, voice, keys, missing = [], pilot, stage, masterDir }) {
  if (keys.length === 0) return [];
  const only = keys.join(',');
  const select = `${pilot ? '--pilot ' : ''}--only ${only}`;
  const generate = `pnpm --filter @hangul-route/mobile audio:tts:generate --engine ${engine} --voice ${voice} ${select}`;
  const lines = [];
  const absent = new Set(missing);
  const masters = keys.filter((k) => !absent.has(k));
  if (stage === 'masters') {
    if (masters.length > 0) lines.push(`mkdir -p ${masterDir}/rejected && mv ${masters.map((k) => `${masterDir}/${k}.wav`).join(' ')} ${masterDir}/rejected/`);
  } else if (masters.length > 0) {
    lines.push(
      `# Processed MP3s are in the lock, so the generator skips them. Another take: set "mp3Sha256" back to null in content/audio/tts-lock.json for the ${engine}/${voice} rows of ${masters.join(',')}, and move their WAV masters out of ${masterDir}. Or regenerate through an override (content/audio/pronunciation-overrides.json, AC-B3), then \`audio:tts:manifest\`.`,
    );
  }
  lines.push(`${generate} --dry-run`, generate);
  return lines;
}

/**
 * The owner's vetoes that still apply: a veto holds only while the clip is one that was played (its sha256 is among
 * the veto's `sha256s`), so a regenerated clip is judged afresh. A veto recorded with no hash applies to the row.
 */
export function activeVetoes(ownerListen, clips) {
  const shaByKey = new Map(clips.map((c) => [c.key, c.sha256]));
  return (ownerListen?.vetoes ?? []).filter((v) => !Array.isArray(v.sha256s) || v.sha256s.length === 0 || v.sha256s.includes(shaByKey.get(v.key)));
}

/**
 * The QA report: the run's settings (recognizers with their model ids, licences and file hashes; the threshold), one
 * entry per clip, the summary with G4's first-take rates, the per-pack set totals of processed jamo clips (AC-B6),
 * the rows to regenerate with their commands (failing, missing, and any the owner vetoed in the optional listen),
 * and that listen. Extra files (no manifest row) fail the run: they are listed to be removed.
 */
export function buildReport({ meta, clips, missing, extra, notGenerated = [], ownerListen = null, packTotals = [] }) {
  const vetoed = activeVetoes(ownerListen, clips).map((v) => v.key);
  const vetoedSet = new Set(vetoed);
  const marked = clips.map((c) => ({ ...c, vetoed: vetoedSet.has(c.key) }));
  const failing = marked.filter((c) => c.verdict !== 'pass').map((c) => c.key);
  const regenerate = [...new Set([...failing, ...missing, ...vetoed])];
  const passing = marked.filter((c) => c.verdict === 'pass' && !c.vetoed);
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    ...meta,
    summary: {
      rows: clips.length + missing.length,
      clips: clips.length,
      pass: passing.length,
      fail: failing.length,
      missing: missing.length,
      extra: extra.length,
      vetoed: vetoed.length,
      flagged: passing.filter((c) => c.pass1?.flags.length || c.pass2?.flags.length || c.signal?.flags.length).length,
      packTotalsOk: packTotals.every((p) => p.ok),
      firstTake: { pass1: firstTake(clips, 'pass1'), pass2: firstTake(clips, 'pass2') },
    },
    clips: marked,
    missing,
    extra,
    notGenerated,
    packTotals,
    regenerate: {
      keys: regenerate,
      commands: regenerationCommands({ engine: meta.engine, voice: meta.voice, keys: regenerate, missing, pilot: meta.selection?.pilot === true, stage: meta.stage, masterDir: meta.masterDir }),
    },
    ownerListen,
  };
}

/** Whether the run passes: nothing to regenerate, no extra file, and every pack within its set total. */
export function reportPasses(report) {
  return report.regenerate.keys.length === 0 && report.extra.length === 0 && (report.packTotals ?? []).every((p) => p.ok);
}

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const tableRow = (cells) => `| ${cells.map(cell).join(' | ')} |`;
const pct = (r) => (r === null ? 'n/a' : `${(r * 100).toFixed(1)} %`);
const sec = (n) => `${Number(n).toFixed(2)} s`;

function marginCell(p) {
  if (p === null || p === undefined) return 'not run';
  if (p.margin === null) return p.target === null && p.best === null ? '-' : 'no margin';
  return `${p.margin} over ${p.best}`;
}

function signalCell(s) {
  if (s === null || s === undefined) return 'not measured';
  const sum = s.summary;
  const parts = [sec(sum.durationS), `onset ${sec(sum.onsetS)}`, `voiced ${sec(sum.voicedSpanS)}`];
  if (s.closure) parts.push(`closure ${sec(s.closure.atS)}`);
  return parts.join(', ');
}

/** The Markdown report: the summary, then the table the content PR body pastes, then the rows to regenerate. */
export function renderReportMarkdown(report) {
  const p1 = report.recognizers.pass1;
  const p2 = report.recognizers.pass2;
  const s = report.summary;
  const out = [
    `# Clip QA: ${report.engine}/${report.voice}`,
    '',
    `<!-- GENERATED by apps/mobile/scripts/audio/tts/qa.mjs (pnpm --filter @hangul-route/mobile audio:tts:qa) on ${report.generatedAt}. Do not edit the table by hand except the two MAR columns. -->`,
    '',
    `Two independent acoustic passes and the shared checks of AMENDMENTS-AUDIO-CLIPS section 9. Stage: ${report.stage === 'masters' ? 'WAV masters (format, size, loudness and edge silence are checked again on the processed MP3s)' : 'processed MP3s'}. Selection: ${report.selectionLabel}.`,
    '',
    `- Pass 1: ${p1.name}, model ${p1.model} (${p1.licence}, sha256 ${p1.modelSha256}), language ${p1.language}; forced choice by grammar, penalty ${p1.grammarPenalty}.`,
    `- Pass 2: ${p2.name}, model ${p2.id}${p2.revision ? ` at revision ${p2.revision}` : ''} (${p2.licence}${p2.licenceSource ? `, ${p2.licenceSource}` : ''}; sha256 ${p2.modelSha256}), ${p2.unit} units; forced-alignment (Viterbi) log-likelihood, margin threshold ${p2.threshold} nats.`,
    `- Clips: ${s.clips} of ${s.rows} rows; ${s.pass} pass, ${s.fail} fail, ${s.missing} missing, ${s.extra} extra files; ${s.flagged} passing clips carry a flag.`,
    `- First-take exact match of words and sentences (G4, target ${G4_FIRST_TAKE * 100} %): Pass 1 ${s.firstTake.pass1.matched} of ${s.firstTake.pass1.total} (${pct(s.firstTake.pass1.rate)}), Pass 2 ${s.firstTake.pass2.matched} of ${s.firstTake.pass2.total} (${pct(s.firstTake.pass2.rate)}).`,
    '',
    'MAR: two independent reviewer agents fill the last two columns with "keep" or "regenerate" and a reason. A clip ships only when both say keep. This is a multi-agent review of the recognizer reports, not a review by a person.',
    '',
    tableRow(['Clip', 'Text', 'Pass 1 transcript', 'Pass 1 forced choice', 'Pass 2 transcript', 'Pass 2 margin (nats)', 'Duration, onset', 'QA', 'MAR 1', 'MAR 2']),
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const c of report.clips) {
    const flags = [...(c.pass1?.flags ?? []), ...(c.pass2?.flags ?? []), ...(c.signal?.flags ?? [])];
    let qa = c.verdict === 'pass' ? (flags.length > 0 ? `pass (flag: ${flags.join('; ')})` : 'pass') : `fail: ${c.reasons.join('; ')}`;
    if (c.vetoed) qa = `vetoed in the owner listen (${qa})`;
    out.push(
      tableRow([
        c.key,
        c.text,
        c.pass1?.free ?? 'not run',
        c.pass1 ? c.pass1.forced ?? '-' : 'not run',
        c.pass2?.free ?? 'not run',
        marginCell(c.pass2),
        signalCell(c.signal),
        qa,
        '',
        '',
      ]),
    );
  }
  for (const key of report.missing) out.push(tableRow([key, '', 'no clip', '', '', '', '', 'fail: missing', '', '']));
  if (report.extra.length > 0) out.push('', `Extra files, no manifest row (an identity failure: remove them): ${report.extra.join(', ')}.`);
  if ((report.notGenerated ?? []).length > 0) out.push('', `Not generated (no manifest row; recorded clips, not checked here): ${report.notGenerated.length} files.`);
  for (const p of report.packTotals ?? []) {
    out.push('', `Pack ${p.pack} set total (AC-B6): ${p.clips} clips, ${p.bytes} bytes (limit ${p.limit.clips} clips, ${p.limit.maxBytes} bytes): ${p.ok ? 'pass' : `fail: ${p.failures.join('; ')}`}.`);
  }
  out.push('', '## Regenerate');
  if (report.regenerate.keys.length === 0) out.push('', 'Nothing to regenerate.');
  else {
    out.push(
      '',
      `${report.regenerate.keys.length} rows: ${report.regenerate.keys.join(', ')}. Another take, or an AC-B3 override, then both passes again. In the owner's own terminal (runbook section M, credentials inline for the one command):`,
      '',
      '```',
      ...report.regenerate.commands,
      '```',
    );
  }
  out.push('', '## Owner listen (optional)');
  if (report.ownerListen === null) out.push('', `Not done. \`pnpm audio:tts:listen --pack jamo-s1,jamo-wb --engine ${report.engine} --voice ${report.voice}\` plays the jamo clips; a veto is honoured.`);
  else {
    const v = report.ownerListen.vetoes;
    const active = new Set(activeVetoes(report.ownerListen, report.clips).map((x) => x.key));
    const shown = (x) => `${x.key}${x.note ? ` (${x.note})` : ''}${active.has(x.key) ? '' : ' (clip since replaced, veto no longer applies)'}`;
    out.push('', `${report.ownerListen.date}: ${report.ownerListen.played} clips played; ${v.length === 0 ? 'no veto' : `vetoed ${v.map(shown).join(', ')}`}.`);
  }
  return `${out.join('\n')}\n`;
}
