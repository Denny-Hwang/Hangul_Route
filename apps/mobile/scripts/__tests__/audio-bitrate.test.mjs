// process-recordings.mjs --bitrate (AMENDMENTS-AUDIO-CLIPS AC-B5 step 3, AU-OD-7; row AC-3): 64 kbps at 44.1 kHz
// for jamo clips stays the default, 48 kbps implies 24 kHz for the say group, and the rest of the chain (trim,
// padding, -16 LUFS, mono, metadata strip) is unchanged. No ffmpeg run: the arguments are checked.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MP3_BITRATE, GROUP_BITRATES, MP3_BITRATES, groupBitrate, mp3EncodeArgs, parseBitrate, sayRecordingIds } from '../audio/lib.mjs';

const APP_ROOT = join(__dirname, '..', '..');
const PROCESS = join(APP_ROOT, 'scripts/audio/process-recordings.mjs');
const MANIFEST = JSON.parse(readFileSync(join(APP_ROOT, '..', '..', 'content/audio/tts-manifest.json'), 'utf8'));

/** Runs process-recordings on an empty folder outside the repo, writing (nothing) to another temp folder. */
function runOnEmpty(extra) {
  const dir = mkdtempSync(join(tmpdir(), 'bitrate-'));
  const out = mkdtempSync(join(tmpdir(), 'bitrate-out-'));
  try {
    return spawnSync(process.execPath, [PROCESS, dir, '--out', out, ...extra], { encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
}

describe('--bitrate', () => {
  it('48 kbps implies -ar 24000', () => {
    expect(mp3EncodeArgs(48)).toEqual(['-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '48k', '-map_metadata', '-1', '-id3v2_version', '0']);
  });

  it('64 kbps at 44.1 kHz is the default, exactly the jamo encode of F-AUDIO-004 §3.11', () => {
    expect(DEFAULT_MP3_BITRATE).toBe(64);
    expect(mp3EncodeArgs()).toEqual(['-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', '-map_metadata', '-1', '-id3v2_version', '0']);
    expect(MP3_BITRATES).toEqual({ 64: 44100, 48: 24000 });
  });

  it('accepts only 64 and 48', () => {
    expect(parseBitrate(undefined)).toBe(64);
    expect(parseBitrate('64')).toBe(64);
    expect(parseBitrate('48')).toBe(48);
    for (const bad of ['32', '128', '48k', '', 'x']) expect(() => parseBitrate(bad)).toThrow(/--bitrate must be 64 or 48 \(kbps\)/);
    expect(() => mp3EncodeArgs(96)).toThrow(/no sample rate for 96 kbps/);
  });

  it('process-recordings encodes with mp3EncodeArgs and keeps the filter chain', () => {
    const source = readFileSync(PROCESS, 'utf8');
    expect(source).toContain("...mp3EncodeArgs(bitrate), out]");
    expect(source).not.toMatch(/'-b:a', '64k'/);
    expect(source).toContain("loudnorm=I=-16:TP=-1.5:LRA=11");
    expect(source).toContain("'adelay=300:all=1,apad=pad_dur=0.3,");
  });

  it('process-recordings refuses another bitrate before reading anything', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bitrate-'));
    try {
      const r = spawnSync(process.execPath, [PROCESS, dir, '--bitrate', '32'], { encoding: 'utf8' });
      expect(r.status).toBe(2);
      expect(r.stderr).toMatch(/--bitrate must be 64 or 48 \(kbps\), not 32/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('each group has its own bitrates: jamo and vocab 64 only, say 48 by default or 64 (AU-OD-7)', () => {
    expect(GROUP_BITRATES).toEqual({ jamo: [64], vocab: [64], say: [48, 64] });
    expect(groupBitrate('jamo', undefined)).toBe(64);
    expect(groupBitrate('vocab', '64')).toBe(64);
    expect(groupBitrate('say', undefined)).toBe(48);
    expect(groupBitrate('say', '64')).toBe(64);
    expect(() => groupBitrate('jamo', '48')).toThrow(/--group jamo is encoded at 64 kbps \(AU-OD-7\), not 48/);
    expect(() => groupBitrate('vocab', '48')).toThrow(/--group vocab is encoded at 64 kbps/);
    expect(() => groupBitrate('say', '32')).toThrow(/--bitrate must be 64 or 48/);
    expect(() => groupBitrate('story', undefined)).toThrow(/--group must be jamo, vocab, say, not story/);
  });

  it('the say group expects the manifest keys of the audio/say/ rows only', () => {
    const ids = sayRecordingIds(MANIFEST);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBe(MANIFEST.rows.filter((r) => r.ref.startsWith('audio/say/')).length);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(sayRecordingIds({ rows: [{ ref: 'audio/jamo/giyeok.mp3', key: 'giyeok' }] })).toEqual([]);
    expect(sayRecordingIds(undefined)).toEqual([]);
  });

  it('process-recordings refuses --bitrate 48 for jamo clips and --bitrate with no value', () => {
    const jamo48 = runOnEmpty(['--group', 'jamo', '--bitrate', '48']);
    expect(jamo48.status).toBe(2);
    expect(jamo48.stderr).toMatch(/--group jamo is encoded at 64 kbps/);
    for (const extra of [['--bitrate'], ['--bitrate', '--names']]) {
      const r = runOnEmpty(extra);
      expect(r.status).toBe(2);
      expect(r.stderr).toMatch(/^--bitrate needs a value\nusage:/);
    }
  });

  it('process-recordings --group say counts the manifest clips still to process', () => {
    const r = runOnEmpty(['--group', 'say']);
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(new RegExp(`^0 clip\\(s\\) written to .*; ${sayRecordingIds(MANIFEST).length} of ${sayRecordingIds(MANIFEST).length} still to record`));
  });
});
