import { isPlainObject } from './tree';

/** The pseudo-locale id (not user-selectable; a dev/QA build flag, F-I18N-001 §3.11). */
export const PSEUDO_LOCALE = 'en-XA';

const ACCENTS: Record<string, string> = {
  a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', y: 'ý', c: 'ç', n: 'ñ',
  A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú', Y: 'Ý', C: 'Ç', N: 'Ñ',
};

/** `[` + accented text padded with `~` to at least +40% length + `]`. */
export function pseudoText(text: string): string {
  const accented = text.replace(/[aeiouycnAEIOUYCN]/g, (ch) => ACCENTS[ch]);
  return `[${accented}${'~'.repeat(Math.ceil(text.length * 0.4))}]`;
}

function transform(node: unknown): unknown {
  if (typeof node === 'string') return pseudoText(node);
  if (typeof node === 'function') {
    return (...args: unknown[]) => pseudoText(String(node(...args)));
  }
  if (Array.isArray(node)) return node.map(transform);
  if (isPlainObject(node)) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) out[key] = transform(value);
    return out;
  }
  return node;
}

/** Every string becomes pseudo text; function messages are wrapped so their output is transformed too. */
export function pseudoLocalize<T>(messages: T): T {
  return transform(messages) as T;
}
