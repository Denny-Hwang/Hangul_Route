#!/usr/bin/env node
/**
 * The device-voice check of the Block Sprint's real blocks (F-CURR-002 section 19 assumption 5, row CM-32): each block of
 * `src/logic/syllable-build/decode-pool.json` (the Stage 1 table and the allowlist) is said by a Korean device voice and
 * kept only if the voice says it as one syllable, the way it reads a real block:
 *
 * - its audio lasts `MIN_S` to `MAX_S` seconds (a block read as letter names, "비읍 아 비읍", is about 0.8 s; a voice that
 *   cannot read it says nothing or almost nothing);
 * - two blocks give the same audio only when they sound the same (their sound keys match, 밥 and 밮): two blocks of
 *   different sounds that came out the same would mean the voice cannot tell them apart.
 *
 * Desktop: macOS `say` (the system Korean voices, the ones Safari and Chrome on a Mac speak with; Yuna is also the iOS
 * Korean voice) and `ffprobe` for the length. It runs on a developer's Mac, not in CI (Linux has neither); the run is
 * recorded in the spec's CM-32 decision record. Usage:
 *
 *   node apps/mobile/scripts/decode-voice-check.mjs [--voice Yuna] [--out <dir>]
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIN_S = 0.12;
export const MAX_S = 0.6;

const FINAL_SOUND = { ㄱ: 'ㄱ', ㄲ: 'ㄱ', ㅋ: 'ㄱ', ㄴ: 'ㄴ', ㄷ: 'ㄷ', ㅅ: 'ㄷ', ㅆ: 'ㄷ', ㅈ: 'ㄷ', ㅊ: 'ㄷ', ㅌ: 'ㄷ', ㅎ: 'ㄷ', ㄹ: 'ㄹ', ㅁ: 'ㅁ', ㅂ: 'ㅂ', ㅍ: 'ㅂ', ㅇ: 'ㅇ' };
const FINALS = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

/** How a block sounds alone: the block without its final, then the final's sound (the app's `blockSoundKey`). */
export function soundKey(block) {
  const index = block.charCodeAt(0) - 0xac00;
  const final = FINALS[index % 28];
  const open = String.fromCharCode(0xac00 + index - (index % 28));
  return `${open}${final === '' ? '' : FINAL_SOUND[final] ?? final}`;
}

/**
 * The problems of one voice's run (empty = every block passed).
 * @param {{ block: string, seconds: number, hash: string }[]} rows
 */
export function voiceProblems(rows) {
  const out = [];
  for (const r of rows) {
    if (!(r.seconds >= MIN_S && r.seconds <= MAX_S)) out.push(`${r.block}: ${r.seconds.toFixed(3)} s, not one syllable (${MIN_S}-${MAX_S} s)`);
  }
  const byHash = new Map();
  for (const r of rows) byHash.set(r.hash, [...(byHash.get(r.hash) ?? []), r.block]);
  for (const blocks of byHash.values()) {
    const keys = new Set(blocks.map(soundKey));
    if (keys.size > 1) out.push(`${blocks.join(', ')}: the same audio for blocks that sound different`);
  }
  return out;
}

function run(voice, outDir) {
  const pool = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/logic/syllable-build/decode-pool.json'), 'utf8'));
  const blocks = [...pool.stage1, ...pool.allowlist];
  const rows = blocks.map((block, i) => {
    const file = join(outDir, `${i}.aiff`);
    execFileSync('say', ['-v', voice, '-o', file, block]);
    const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim());
    const hash = createHash('md5').update(readFileSync(file)).digest('hex');
    return { block, seconds, hash };
  });
  const problems = voiceProblems(rows);
  const secs = rows.map((r) => r.seconds);
  process.stdout.write(`${voice}: ${rows.length} blocks, ${Math.min(...secs).toFixed(3)}-${Math.max(...secs).toFixed(3)} s, ${problems.length} problems\n`);
  for (const p of problems) process.stdout.write(`  ${p}\n`);
  return problems.length === 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const voice = args.includes('--voice') ? args[args.indexOf('--voice') + 1] : 'Yuna';
  const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : mkdtempSync(join(tmpdir(), 'decode-voice-'));
  process.exit(run(voice, outDir) ? 0 : 1);
}
