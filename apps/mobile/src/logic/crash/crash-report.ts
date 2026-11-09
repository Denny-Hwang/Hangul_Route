import type { CrashTelemetryPayload } from '@hangul-route/content-schema/crash-telemetry';

/**
 * What a crash sends (`app.crash`, TELEMETRY-NAMES-2 section U): the root, the route name, the error class, a scrubbed
 * short message, whether a chunk could not load, and the app version. Pure, so the learner root, All lessons and the
 * presenter share it. No learner data: the message loses links, addresses, long numbers and anything but printable
 * ASCII before it is cut to 120 characters, and the Worker holds the same line.
 */
export type CrashSurface = CrashTelemetryPayload['surface'];

/** The longest message the Worker keeps (`CRASH_MESSAGE_MAX`; a test holds the two equal). */
const MESSAGE_MAX = 120;

/** A name the schema accepts: letters, digits and underscore, starting with a letter, at most 40 long. */
function codeOf(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 40) : '';
  return /^[A-Za-z]/.test(text) ? text : fallback;
}

/** The error's message as the Worker will take it: no link, address or long number, ASCII only, 120 characters at most. */
export function scrubMessage(message: unknown): string {
  const text = typeof message === 'string' ? message : '';
  return text
    .replace(/\S*:\/\/\S*/g, '<url>')
    .replace(/\S*@\S*/g, '<address>')
    .replace(/\d{6,}/g, '#')
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '?')
    .trim()
    .slice(0, MESSAGE_MAX);
}

/** Error class names a dynamic import or a lesson chunk load fails with (Metro's, the browser's and the app's own). */
const CHUNK_ERROR_NAMES = new Set(['AsyncRequireError', 'ChunkLoadError', 'LessonChunkMismatch', 'LessonChunkTimeout', 'RootChunkTimeout']);
const CHUNK_MESSAGE = /loading (?:module|chunk)|failed to fetch dynamically imported|importing a module script failed|requiring unknown module|did not load within/i;

/** True when the error is a lesson, screen or root chunk that could not be loaded (rather than a render error). */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return CHUNK_ERROR_NAMES.has(error.name) || CHUNK_MESSAGE.test(error.message);
}

export function crashPayload(error: unknown, context: { surface: CrashSurface; route: string | undefined; appVersion: string }): CrashTelemetryPayload {
  const named = error instanceof Error;
  return {
    surface: context.surface,
    route: codeOf(context.route, 'Unknown'),
    errorName: codeOf(named ? error.name : typeof error, 'Error'),
    message: scrubMessage(named ? error.message : typeof error === 'string' ? error : ''),
    chunk: isChunkLoadError(error),
    appVersion: context.appVersion,
  };
}
