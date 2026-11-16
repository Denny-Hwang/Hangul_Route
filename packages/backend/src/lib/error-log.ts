/**
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-2 (audit PROD-1): the one log line of an unhandled route error, for Workers Logs
 * (`[observability]` in apps/api/wrangler.toml). It carries the route pattern (never the path, which holds ids), the
 * method, the error's class name and a scrubbed message. No request body, header, name or id is logged.
 */

/** The longest message a log line keeps. */
export const ERROR_LOG_MESSAGE_MAX = 200;

const UNKNOWN_ERROR_NAME = 'UnknownError';

/**
 * An error message made safe for a log: quoted text (a JSON parser quotes a piece of the body), links, email
 * addresses, record ids (`space:abc123`, `user_2abc`) and runs of six or more digits are replaced by a marker, line
 * breaks become spaces, and the rest is cut at `ERROR_LOG_MESSAGE_MAX` characters.
 */
export function scrubLogText(text: string): string {
  return text
    .replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '[text]')
    .replace(/\bhttps?:\/\/\S+/gi, '[link]')
    .replace(/[^\s@]+@[^\s@]+/g, '[email]')
    .replace(/\b[a-z]+[:_][A-Za-z0-9-]{6,}\b/g, '[id]')
    .replace(/\d{6,}/g, '[n]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, ERROR_LOG_MESSAGE_MAX);
}

/** The log line as one JSON string: `event`, `method`, `route`, `errorName`, `message`, in that order. */
export function errorLogLine(method: string, route: string, error: unknown): string {
  const known = error instanceof Error;
  return JSON.stringify({
    event: 'api.error',
    method,
    route,
    errorName: known && error.name ? scrubLogText(error.name) : UNKNOWN_ERROR_NAME,
    message: known ? scrubLogText(error.message) : '',
  });
}
