import { describe, expect, it } from 'vitest';
import { ERROR_LOG_MESSAGE_MAX, errorLogLine, scrubLogText } from '../error-log';

/** [AU] AMENDMENTS-AUDIT-2026-11 AU-2: what an unhandled error may write to Workers Logs. */
describe('scrubLogText', () => {
  it('keeps a plain message as it is', () => {
    expect(scrubLogText('D1_ERROR: no such table: rate_hits: SQLITE_ERROR')).toBe('D1_ERROR: no such table: rate_hits: SQLITE_ERROR');
    expect(scrubLogText('UNIQUE constraint failed: spaces.id')).toBe('UNIQUE constraint failed: spaces.id');
  });

  it.each([
    ['quoted text, which a JSON parser copies from the body', 'Unexpected token \'D\', "Dami is 7" is not valid JSON', 'Unexpected token [text], [text] is not valid JSON'],
    ['text in backticks', 'bad value `Dami`', 'bad value [text]'],
    ['a link', 'fetch https://api.example/x?token=abc failed', 'fetch [link] failed'],
    ['an email address', 'no account for dami@example.com here', 'no account for [email] here'],
    ['a record id', 'space:ab12cd34ef56 and profile:1f0c-22aa are gone', '[id] and [id] are gone'],
    ['an account id', 'user_2abcDEF123 not found', '[id] not found'],
    ['a long number', 'row 1234567 missing, code 12345 kept', 'row [n] missing, code 12345 kept'],
    ['line breaks', 'first line\n  second line\r\nthird', 'first line second line third'],
  ])('replaces %s', (_label, input, output) => {
    expect(scrubLogText(input)).toBe(output);
  });

  it('cuts a long message', () => {
    expect(ERROR_LOG_MESSAGE_MAX).toBe(200);
    expect(scrubLogText('x '.repeat(400))).toHaveLength(ERROR_LOG_MESSAGE_MAX);
  });
});

describe('errorLogLine', () => {
  it('is one JSON line with the route pattern, the method, the error class and the scrubbed message', () => {
    const line = errorLogLine('POST', '/api/spaces/:id/join', new TypeError('cannot read space:ab12cd34ef56'));
    expect(line).not.toContain('\n');
    expect(JSON.parse(line)).toEqual({ event: 'api.error', method: 'POST', route: '/api/spaces/:id/join', errorName: 'TypeError', message: 'cannot read [id]' });
    expect(Object.keys(JSON.parse(line) as object)).toEqual(['event', 'method', 'route', 'errorName', 'message']);
  });

  it('names a thrown value that is not an Error, and never prints it', () => {
    for (const thrown of ['Dami', { learnerName: 'Dami' }, null, undefined, 7]) {
      expect(JSON.parse(errorLogLine('GET', '/api/x', thrown))).toEqual({ event: 'api.error', method: 'GET', route: '/api/x', errorName: 'UnknownError', message: '' });
    }
  });

  it('falls back for an Error with an empty name, and scrubs a name too', () => {
    const blank = new Error('boom');
    blank.name = '';
    expect(JSON.parse(errorLogLine('GET', '/', blank))).toMatchObject({ errorName: 'UnknownError', message: 'boom' });
    const odd = new Error('boom');
    odd.name = 'Fail dami@example.com';
    expect(JSON.parse(errorLogLine('GET', '/', odd))).toMatchObject({ errorName: 'Fail [email]' });
  });
});
