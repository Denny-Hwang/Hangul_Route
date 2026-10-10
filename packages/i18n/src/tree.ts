/** Small, pure tree helpers behind `getMessages` and the tooling that checks dictionaries. */

const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

/** A plain object: not an array, a function, null or a primitive. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `base` with `overlay` laid over it. A key the overlay lacks (or sets to
 * `undefined`) keeps the base value; arrays and functions are replaced whole.
 * Keys that exist only in the overlay are ignored. Never mutates either input.
 */
export function deepMerge<T extends object>(base: T, overlay: object): T {
  const over = overlay as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, baseValue] of Object.entries(base)) {
    const own = hasOwn(over, key) ? over[key] : undefined;
    if (isPlainObject(baseValue)) out[key] = deepMerge(baseValue, isPlainObject(own) ? own : {});
    else out[key] = own === undefined ? baseValue : own;
  }
  return out as T;
}

/** Dotted paths of every leaf (string, function or array) under `node`. */
export function leafPaths(node: object, prefix = ''): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (isPlainObject(value)) out.push(...leafPaths(value, path));
    else out.push(path);
  }
  return out;
}

/** String-path access (`'learner.home.streak'`): for tooling and tests only, not app code. */
export function lookup(tree: unknown, path: string): unknown {
  let node = tree;
  for (const key of path.split('.')) {
    if (!isPlainObject(node) || !hasOwn(node, key)) return undefined;
    node = node[key];
  }
  return node;
}
