// The two local recognizers of the clip QA (AMENDMENTS-AUDIO-CLIPS section 9; row AC-4). Both run on this machine
// only: no network, no vendor speech-to-text, never in CI (qa.mjs refuses there). Setup: docs/launch/tts-qa-setup.md.
//
//   Pass 1  whisper.cpp (MIT), model large-v3, language ko: `whisper-cli`, free transcription of every clip, and a
//           forced choice under a GBNF grammar (--grammar, --grammar-penalty) for the closed-set clips.
//   Pass 2  a Korean wav2vec2 CTC model (another model family), run by pass2_ctc.py (PyTorch + transformers, local
//           files only): per frame, the best id over the whole vocabulary and the log-probabilities of the requested
//           ids. The greedy decode and the Viterbi forced alignment are done here in JS (qa-lib.mjs).
//
// Every clip is first decoded to 16 kHz mono 16-bit WAV with ffmpeg, the input both models expect.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ctcRequestIds, ctcVocabOf, parseWhisperText, scoreCtcClip, whisperGrammar } from './qa-lib.mjs';

export const PASS2_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'pass2_ctc.py');

/** The Pass 2 model the setup doc names: Apache-2.0, fine-tuned on Zeroth-Korean (CC BY 4.0), compatibility-jamo units. */
export const DEFAULT_CTC_MODEL_ID = 'Kkonjeong/wav2vec2-base-korean';
/**
 * The default Pass 2 model, pinned. Its card has no `license:` field in the front matter (the Hugging Face cardData is
 * library_name, datasets, language and metrics only); the card body states "License: Apache 2.0", read 2026-10-30 at
 * this revision. So the licence is taken from this pin, and only for weights whose sha256 is the pinned one (the
 * model.safetensors LFS sha256 of that revision): other weights under the same id need a licence of their own.
 */
export const DEFAULT_CTC_MODEL = Object.freeze({
  id: DEFAULT_CTC_MODEL_ID,
  revision: 'fa03d1a7138f1900131393cc7cb74f77926f177a',
  licence: 'apache-2.0',
  licenceSource: 'model card body ("License: Apache 2.0"), read 2026-10-30 at the pinned revision',
  weightsFile: 'model.safetensors',
  weightsSha256: 'eda501ecfaf436a5d81648e461ad78d7ba2baf8d30fd32fcde9da8f0603b92f5',
});
/** Model licences that allow this use (local QA of the app's own clips); a model card with another licence is refused. */
export const PASS2_LICENCES = Object.freeze(['apache-2.0', 'mit', 'bsd-2-clause', 'bsd-3-clause', 'cc-by-4.0', 'cc0-1.0']);
/** Pass 1 is whisper.cpp under the MIT licence; its large-v3 weights are OpenAI's, also MIT. */
export const PASS1_INFO = Object.freeze({ name: 'whisper.cpp', model: 'large-v3', licence: 'MIT', language: 'ko' });
export const DEFAULT_GRAMMAR_PENALTY = 100;
const MODEL_FILES = ['model.safetensors', 'pytorch_model.bin'];

/** The `license:` of a Hugging Face model card's front matter, lower-cased, or null. */
export function modelLicenceOf(readme) {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(readme ?? ''));
  if (front === null) return null;
  const m = /^license:\s*["']?([^"'\s#]+)/m.exec(front[1]);
  return m === null ? null : m[1].toLowerCase();
}

/** Why a Pass 2 model may not be used, or null. */
export function pass2LicenceProblem(licence) {
  if (licence === null) return 'the model card (README.md) names no licence: pass --ctc-licence after reading it';
  if (!PASS2_LICENCES.includes(licence)) return `licence ${licence} is not one of ${PASS2_LICENCES.join(', ')}`;
  return null;
}

/**
 * Where the Pass 2 licence comes from: `--ctc-licence` (read by the owner), else the card's front matter, else the
 * pin of the default model (`DEFAULT_CTC_MODEL`), which then requires the pinned weights hash. Returns
 * `{ licence, source, requireWeightsSha256 }` (licence null when there is none).
 */
export function pass2LicenceOf({ modelId, flagLicence, cardLicence, pinned = DEFAULT_CTC_MODEL }) {
  if (flagLicence !== undefined) return { licence: String(flagLicence).toLowerCase(), source: 'given with --ctc-licence', requireWeightsSha256: null };
  if (cardLicence !== null && cardLicence !== undefined) return { licence: cardLicence, source: 'model card front matter', requireWeightsSha256: null };
  if (modelId === pinned.id) return { licence: pinned.licence, source: pinned.licenceSource, requireWeightsSha256: pinned.weightsSha256 };
  return { licence: null, source: null, requireWeightsSha256: null };
}

/** The whisper-cli arguments of one batch: free transcription, or a forced choice when `grammarFile` is given. */
export function whisperArgs({ model, files, grammarFile, grammarPenalty = DEFAULT_GRAMMAR_PENALTY }) {
  const args = ['-m', model, '-l', 'ko', '-nt', '-np', '-otxt'];
  if (grammarFile !== undefined) args.push('--grammar', grammarFile, '--grammar-rule', 'root', '--grammar-penalty', String(grammarPenalty));
  for (const f of files) args.push('-f', f);
  return args;
}

export async function sha256File(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
  if (r.error) throw new Error(`${cmd} is not available (${r.error.message}); see docs/launch/tts-qa-setup.md`);
  if (r.status !== 0) throw new Error(`${basename(cmd)} failed (exit ${r.status}):\n${(r.stderr ?? '').split('\n').slice(-12).join('\n')}`);
  return r;
}

/** Decodes every clip to a 16 kHz mono WAV in a scratch folder; returns the scratch path per clip and a cleanup. */
export function analysisWavs(files) {
  const work = mkdtempSync(join(tmpdir(), 'hr-tts-qa-'));
  const byFile = new Map();
  files.forEach((file, i) => {
    const out = join(work, `${String(i).padStart(5, '0')}.wav`);
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', out]);
    byFile.set(file, out);
  });
  return { byFile, work, cleanup: () => rmSync(work, { recursive: true, force: true }) };
}

/**
 * Pass 1. `whisperCli` is the binary (whisper-cli), `model` the ggml large-v3 file.
 * transcribe(files) and forcedChoice(files, candidates) return Map(file -> transcript).
 */
export function createWhisper({ whisperCli, model, grammarPenalty = DEFAULT_GRAMMAR_PENALTY }) {
  if (!existsSync(model)) throw new Error(`Pass 1 model not found: ${model} (docs/launch/tts-qa-setup.md, step 2)`);
  const batch = (files, grammar) => {
    const wavs = analysisWavs(files);
    try {
      let grammarFile;
      if (grammar !== undefined) {
        grammarFile = join(wavs.work, 'choice.gbnf');
        writeFileSync(grammarFile, grammar);
      }
      run(whisperCli, whisperArgs({ model, files: [...wavs.byFile.values()], grammarFile, grammarPenalty }));
      return new Map(files.map((f) => [f, parseWhisperText(readFileSync(`${wavs.byFile.get(f)}.txt`, 'utf8'))]));
    } finally {
      wavs.cleanup();
    }
  };
  return {
    describe: async () => ({ ...PASS1_INFO, binary: whisperCli, modelFile: basename(model), modelSha256: await sha256File(model), grammarPenalty }),
    transcribe: async (files) => (files.length === 0 ? new Map() : batch(files)),
    forcedChoice: async (files, candidates) => (files.length === 0 ? new Map() : batch(files, whisperGrammar(candidates))),
  };
}

/**
 * Pass 2. `modelDir` is a local Hugging Face model folder (config.json, vocab.json, README.md, weights);
 * `python` the interpreter of the venv that has torch and transformers. run(items) takes [{ file, candidates }] and
 * returns Map(file -> { free, scores }). Async: the weights are hashed first, for the pinned default model's licence
 * (`pass2LicenceOf`) and for the report.
 */
export async function createCtc({ modelDir, modelId = DEFAULT_CTC_MODEL_ID, licence, python, threshold, pinned = DEFAULT_CTC_MODEL, hashFile = sha256File }) {
  const need = (f) => {
    const p = join(modelDir, f);
    if (!existsSync(p)) throw new Error(`Pass 2 model file not found: ${p} (docs/launch/tts-qa-setup.md, step 3)`);
    return p;
  };
  const vocab = ctcVocabOf(JSON.parse(readFileSync(need('vocab.json'), 'utf8')), JSON.parse(readFileSync(need('config.json'), 'utf8')));
  const readme = join(modelDir, 'README.md');
  const cardLicence = modelLicenceOf(existsSync(readme) ? readFileSync(readme, 'utf8') : '');
  const chosen = pass2LicenceOf({ modelId, flagLicence: licence, cardLicence, pinned });
  const problem = pass2LicenceProblem(chosen.licence);
  if (problem !== null) throw new Error(`Pass 2 model refused: ${problem}`);
  const weights = MODEL_FILES.map((f) => join(modelDir, f)).find((p) => existsSync(p));
  if (weights === undefined) throw new Error(`Pass 2 model weights not found in ${modelDir} (${MODEL_FILES.join(' or ')})`);
  const modelSha256 = await hashFile(weights);
  if (chosen.requireWeightsSha256 !== null && modelSha256 !== chosen.requireWeightsSha256) {
    throw new Error(
      `Pass 2 model refused: ${basename(weights)} sha256 ${modelSha256.slice(0, 12)}... is not the pinned ${pinned.id} revision ${pinned.revision.slice(0, 12)}... ` +
        `(${chosen.requireWeightsSha256.slice(0, 12)}...), and its card names no licence. Download that revision (docs/launch/tts-qa-setup.md, step 3), or pass --ctc-licence after reading the licence.`,
    );
  }
  const modelLicence = chosen.licence;
  return {
    vocab,
    describe: async () => ({
      name: 'wav2vec2 CTC (transformers, local)',
      id: modelId,
      revision: modelId === pinned.id && modelSha256 === pinned.weightsSha256 ? pinned.revision : null,
      licence: modelLicence,
      licenceSource: chosen.source,
      modelFile: basename(weights),
      modelSha256,
      unit: vocab.unit,
      threshold,
    }),
    run: async (items) => {
      if (items.length === 0) return new Map();
      const wavs = analysisWavs(items.map((i) => i.file));
      try {
        const request = items.map((item, n) => ({ id: String(n), wav: wavs.byFile.get(item.file), ids: ctcRequestIds(item.candidates, vocab) }));
        const requestFile = join(wavs.work, 'request.json');
        const outFile = join(wavs.work, 'out.json');
        writeFileSync(requestFile, JSON.stringify({ model: modelDir, clips: request }));
        // Local files only: the Hugging Face libraries are told not to reach the network.
        run(python, [PASS2_SCRIPT, requestFile, outFile], { env: { ...process.env, HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' } });
        const out = JSON.parse(readFileSync(outFile, 'utf8'));
        return new Map(items.map((item, n) => [item.file, scoreCtcClip(out.clips[String(n)], item.candidates, vocab)]));
      } finally {
        wavs.cleanup();
      }
    },
  };
}
