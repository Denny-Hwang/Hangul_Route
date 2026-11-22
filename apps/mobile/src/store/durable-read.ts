import { keepRawCopy, readJsonExact, readJsonExactFresh } from '../platform/storage';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.1 (row DP-1b): one read contract for a profile record (`hr:profiles`,
 * `hr:profiles:active`, `hr:profiles:tombstones`). A failed read is never "nothing stored":
 *
 * - `missing`: the key is absent or `''`.
 * - `value`: the bytes parse.
 * - `failed` / `parse`: the bytes were read and do not parse (a `SyntaxError` from `JSON.parse`).
 * - `failed` / `read`: the read threw, and the one retry on a fresh connection threw too.
 *
 * The cause always comes from the read. `kept` is set only by `keepRawCopy`, only for `parse` and only with a
 * `copyKey`: the raw bytes are copied there once (the first copy is kept, the AU-3 rule). Never rejects.
 */
export type DurableRead =
  | { kind: 'missing' }
  | { kind: 'value'; value: unknown }
  | { kind: 'failed'; cause: 'read' | 'parse'; kept: boolean };

type Answer = { ok: true; value: unknown } | { ok: false; parse: boolean };

async function attempt(read: () => Promise<unknown>): Promise<Answer> {
  try {
    return { ok: true, value: await read() };
  } catch (error) {
    return { ok: false, parse: error instanceof SyntaxError };
  }
}

async function keep(key: string, copyKey: string | null): Promise<boolean> {
  if (copyKey === null) return false;
  try {
    return (await keepRawCopy(key, copyKey, { onlyUnparsable: true })) === true;
  } catch {
    return false;
  }
}

export async function durableRead(key: string, copyKey: string | null): Promise<DurableRead> {
  let answer = await attempt(() => readJsonExact<unknown>(key));
  // One retry on a fresh connection, only for a read that threw (bytes that do not parse would not parse again).
  if (!answer.ok && !answer.parse) answer = await attempt(() => readJsonExactFresh<unknown>(key));
  if (answer.ok) return answer.value === null || answer.value === undefined ? { kind: 'missing' } : { kind: 'value', value: answer.value };
  if (!answer.parse) return { kind: 'failed', cause: 'read', kept: false };
  return { kind: 'failed', cause: 'parse', kept: await keep(key, copyKey) };
}
