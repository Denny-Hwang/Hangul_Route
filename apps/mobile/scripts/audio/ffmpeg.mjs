// Thin wrappers over the ffmpeg / ffprobe binaries for the local audio scripts.
import { spawnSync } from 'node:child_process';

function call(cmd, argv) {
  const r = spawnSync(cmd, argv, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.error) throw new Error(`${cmd} is not available (${r.error.message}); install ffmpeg to process recordings`);
  if (r.status !== 0) throw new Error(`${cmd} ${argv.join(' ')} failed:\n${r.stderr}`);
  return r;
}

/** Runs ffmpeg and returns its log (ffmpeg writes filter reports to stderr). */
export function ffmpeg(argv) {
  return call('ffmpeg', argv).stderr;
}

/** Runs ffprobe and returns stdout. */
export function ffprobe(argv) {
  return call('ffprobe', argv).stdout;
}

export function ffprobeDuration(file) {
  return Number(ffprobe(['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim());
}
