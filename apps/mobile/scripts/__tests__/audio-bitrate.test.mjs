// process-recordings.mjs --bitrate (AMENDMENTS-AUDIO-CLIPS AC-B5 step 3, AU-OD-7; row AC-3): 64 kbps at 44.1 kHz
// for jamo clips stays the default, 48 kbps implies 24 kHz for the say group, and the rest of the chain (trim,
// padding, -16 LUFS, mono, metadata strip) is unchanged. No ffmpeg run: the arguments are checked.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MP3_BITRATE, MP3_BITRATES, mp3EncodeArgs, parseBitrate } from '../audio/lib.mjs';

const APP_ROOT = join(__dirname, '..', '..');
const PROCESS = join(APP_ROOT, 'scripts/audio/process-recordings.mjs');

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
});
