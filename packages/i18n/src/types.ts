import type { en } from './messages/en';

/**
 * Message-dictionary typing (F-I18N-001 §3.1).
 *
 * English is written `as const`, so every leaf is a string-literal type and no
 * translation could satisfy it. `Widen` turns each leaf back into `string`
 * (and keeps function parameter lists), which is the contract overlays follow.
 */
export type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : T extends object
        ? { [K in keyof T]: Widen<T[K]> }
        : T;

/** Overlay shape: any subset of keys; arrays and functions are replaced whole, never patched. */
export type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

/** A message that needs a variable, a count or a word-order decision is a function. */
export type MessageFn = (...args: never[]) => string;

/** The full dictionary type, derived from the English source. */
export type Messages = Widen<typeof en>;
