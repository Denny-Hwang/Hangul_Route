import { OVERLAY_FIELDS, overlayPrefix, type Overlays } from './schemas/locale-overlay';
import type { UiLocale } from './schemas/locale';

/**
 * Applying content overlays at runtime (F-I18N-001 §3.6). Pure: no store, no I/O.
 *
 * An overlay field lands on the English source it translates:
 * - a plain name `f` lands on `fEn`, else on a string `f` (JSON `title`, `blurb`,
 *   `soundHint`), else on `f.en` when `f` is a `{ ko, romanization, en }` object
 *   (a story title, a Listen & Pick prompt); `gloss` also lands on `en` / `gloss_en`;
 * - `a.gloss` lands on `a.en`, or on a flattened `aEn` (the TypeScript jamo's
 *   `exampleWordEn` for `exampleWord.gloss`);
 * - `list.<key>.rest` picks the array element whose `overlayElementKey` is `<key>`
 *   (an array that is not a direct child is found by name anywhere below, so story
 *   `scenes.<id>` reaches `tiers[].scenes[]`; `checks` also covers `checkpoints`);
 * - a path that ends on an element lands on its `en`;
 * - story tiers (F-STORY-001: a `listen` and a `read` tier reuse the scene ids `s1`..)
 *   are addressed by their `level`: `tiers.<level>.scenes.<id>.narration` lands on that
 *   tier only and wins over the untiered `scenes.<id>.narration`, which lands on the
 *   primary tier only (the `listen` tier, else the first one: the form a one-tier story
 *   and the earlier overlays use); see `TIER_SCOPED`;
 * - the jamo hints `soundHint` / `nameHint` are set even when the base has none.
 * Anything that resolves to nothing is ignored: the English stays (§3.13, never a
 * blank and never the key).
 *
 * `scripts/overlay-fields.mjs` mirrors these rules for the validator; the mirror test
 * runs both over the same entities.
 */

type Path = (string | number)[];
type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Hints a locale may add although the English base has none (§3.5.6: a Spanish sound
 * hint is authored fresh for Spanish readers). Only these top-level fields are created
 * by an overlay; every other field only replaces an existing English source.
 */
const ADDITIVE_FIELDS: readonly string[] = ['soundHint', 'nameHint'];

/** Collections reached by another name too. */
const COLLECTION_ALIASES: Readonly<Record<string, readonly string[]>> = { checks: ['checks', 'checkpoints'] };

/** The array of story tiers; its elements are keyed by their `level` (`listen`, `read`). */
const TIERS = 'tiers';
/**
 * Collections whose element ids repeat from tier to tier with different English (scene
 * `s1` of the listen tier is not scene `s1` of the read tier): an untiered path reaches
 * them in the primary tier only, and `tiers.<level>.<collection>...` reaches the others.
 * Check ids differ per tier (`c1`, `r1`), so `checks.<id>` still reaches every tier.
 */
const TIER_SCOPED: readonly string[] = ['scenes'];

const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * An `id` / `key` as a path segment: as is when it already is one, slugged when it is
 * plain ASCII (`lp:sym:jamo:eo` -> `lp-sym-jamo-eo`), else none: an id that carries
 * Korean (a `lp:syl:<syllable>` round) cannot be spelled in a path, so the next rule names the element.
 */
function segmentOf(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^[\x20-\x7e]+$/.test(value)) return undefined;
  if (/^[a-z0-9-]+$/.test(value)) return value;
  const key = slug(value);
  return key === '' ? undefined : key;
}

/**
 * The key an array element is addressed by in an overlay path: its `id`, else `key`
 * (each as a path segment, see `segmentOf`), else its romanization as a slug, else its index.
 */
export function overlayElementKey(element: unknown, index: number): string {
  if (isRec(element)) {
    const key = segmentOf(element.id) ?? segmentOf(element.key);
    if (key !== undefined) return key;
    if (typeof element.romanization === 'string') {
      const romanized = slug(element.romanization);
      if (romanized !== '') return romanized;
    }
  }
  return String(index);
}

/** The index of the primary tier: the `listen` tier, else the first. */
function primaryTier(tiers: readonly unknown[]): number {
  const listen = tiers.findIndex((tier) => isRec(tier) && tier.level === 'listen');
  return listen < 0 ? 0 : listen;
}

/** The key of an element of the array named `collection`: a story tier by its `level`, anything else by `overlayElementKey`. */
function elementKey(collection: string, element: unknown, index: number): string {
  if (collection === TIERS && isRec(element)) {
    const level = segmentOf(element.level);
    if (level !== undefined) return level;
  }
  return overlayElementKey(element, index);
}

/** Whether a field is tier-qualified (`tiers.<level>....`): it is applied after, and so wins over, the untiered form. */
const isTierField = (field: string): boolean => field.startsWith(`${TIERS}.`);

function leafTargets(node: Rec, name: string, at: Path): Path[] {
  if (typeof node[`${name}En`] === 'string') return [[...at, `${name}En`]];
  const own = node[name];
  if (typeof own === 'string') return [[...at, name]];
  if (isRec(own) && typeof own.en === 'string') return [[...at, name, 'en']];
  if (name === 'gloss') {
    if (typeof node.en === 'string') return [[...at, 'en']];
    if (typeof node.gloss_en === 'string') return [[...at, 'gloss_en']];
  }
  return [];
}

function collections(node: Rec, name: string, at: Path): Array<[unknown[], Path]> {
  const names = COLLECTION_ALIASES[name] ?? [name];
  const out: Array<[unknown[], Path]> = [];
  const walk = (value: unknown, path: Path): void => {
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, [...path, i]));
      return;
    }
    if (!isRec(value)) return;
    for (const [k, v] of Object.entries(value)) {
      if (names.includes(k) && Array.isArray(v)) out.push([v, [...path, k]]);
      else if (k === TIERS && Array.isArray(v) && TIER_SCOPED.includes(name) && v.length > 0) {
        const primary = primaryTier(v);
        walk(v[primary], [...path, k, primary]);
      } else walk(v, [...path, k]);
    }
  };
  walk(node, at);
  return out;
}

/** Arrays a collection segment refers to: the direct child, else same-named arrays below. */
function arraysAt(node: Rec, head: string, at: Path): Array<[unknown[], Path]> {
  const child = node[head];
  if (Array.isArray(child)) return [[child, [...at, head]]];
  return child === undefined ? collections(node, head, at) : [];
}

function resolve(node: unknown, segs: readonly string[], at: Path): Path[] {
  if (!isRec(node)) return [];
  const [head, ...rest] = segs;
  if (head === undefined) return typeof node.en === 'string' ? [[...at, 'en']] : [];
  if (rest.length === 0) {
    const targets = leafTargets(node, head, at);
    return targets.length === 0 && at.length === 0 && ADDITIVE_FIELDS.includes(head) && node[head] === undefined ? [[head]] : targets;
  }
  const child = node[head];
  if (isRec(child)) return resolve(child, rest, [...at, head]);
  if (child === undefined && rest.length === 1 && rest[0] === 'gloss' && typeof node[`${head}En`] === 'string') {
    return [[...at, `${head}En`]];
  }
  const [selector, ...after] = rest;
  return arraysAt(node, head, at).flatMap(([items, path]) =>
    items.flatMap((item, i) => (elementKey(head, item, i) === selector ? resolve(item, after, [...path, i]) : [])),
  );
}

/** The concrete source paths (inside `entity`) that an overlay `field` lands on; `[]` when it resolves to nothing. */
export function overlayTargets(entity: unknown, field: string): Path[] {
  return resolve(entity, field.split('.'), []);
}

function getIn(root: unknown, path: Path): unknown {
  let node: unknown = root;
  for (const key of path) node = (node as Record<string | number, unknown>)[key];
  return node;
}

function setIn(node: unknown, path: Path, value: string): unknown {
  const [key, ...rest] = path;
  if (key === undefined) return value;
  if (Array.isArray(node)) {
    const copy = [...node];
    copy[key as number] = setIn(node[key as number], rest, value);
    return copy;
  }
  return { ...(node as Rec), [key]: setIn((node as Rec)[key as string], rest, value) };
}

export interface TranslatableField {
  /** The overlay field key (`title`, `steps.intro.title`). */
  field: string;
  /** Where its English source sits inside the entity. */
  path: Path;
  source: string;
  /**
   * Other overlay fields that land on the same source (only when there are any): the
   * tier-qualified form of a primary-tier scene field (`tiers.listen.scenes.s1.narration`
   * beside `scenes.s1.narration`). Either one translates it.
   */
  alternates?: string[];
}

function expand(node: unknown, segs: readonly string[], at: Path, field: readonly string[]): Array<[string, Path]> {
  if (!isRec(node)) return [];
  const [head, ...rest] = segs;
  if (head === undefined) return typeof node.en === 'string' ? [[field.join('.'), [...at, 'en']]] : [];
  if (rest.length === 0) return leafTargets(node, head, at).map((p) => [[...field, head].join('.'), p]);
  if (rest[0]?.startsWith('<')) {
    return arraysAt(node, head, at).flatMap(([items, path]) =>
      items.flatMap((item, i) => expand(item, rest.slice(1), [...path, i], [...field, head, elementKey(head, item, i)])),
    );
  }
  const child = node[head];
  if (isRec(child)) return expand(child, rest, [...at, head], [...field, head]);
  if (child === undefined && rest.length === 1 && rest[0] === 'gloss' && typeof node[`${head}En`] === 'string') {
    return [[[...field, head, 'gloss'].join('.'), [...at, `${head}En`]]];
  }
  return [];
}

/**
 * Every translatable field the entity carries an English source for (pattern order, then
 * element order), each source once: a later pattern that lands on a source an earlier one
 * already names (the tier-qualified form of a primary-tier scene) is listed as that
 * field's `alternates`, so a story's scenes count once per tier.
 */
export function translatableFields(entityId: string, entity: unknown): TranslatableField[] {
  const patterns: readonly string[] = (OVERLAY_FIELDS as Record<string, readonly string[]>)[overlayPrefix(entityId)] ?? [];
  const out: TranslatableField[] = [];
  const bySource = new Map<string, TranslatableField>();
  for (const pattern of patterns) {
    for (const [field, path] of expand(entity, pattern.split('.'), [], [])) {
      const at = path.join('\u0000');
      const first = bySource.get(at);
      if (first !== undefined) {
        first.alternates = [...(first.alternates ?? []), field];
        continue;
      }
      const row: TranslatableField = { field, path, source: getIn(entity, path) as string };
      bySource.set(at, row);
      out.push(row);
    }
  }
  return out;
}

/** `{ title?, blurb?, ... }` for an entity type with `titleEn`, `blurbEn`, ... fields. */
export type LocalizedFields<T> = { [K in keyof T as K extends `${infer F}En` ? F : never]?: string };

/**
 * The entity with its English text replaced by the overlay of `locale` where present.
 * Returns the same object for `en` and when the entity has no overlay; otherwise a
 * copy (only the changed branches are copied; the input is never mutated).
 *
 * `overlays` has no default: the generated `OVERLAYS` (every es / ko string) sits behind
 * the `@hangul-route/content-schema/overlays` subpath, so a consumer of the package
 * barrel that never translates content (the site, the Worker) does not bundle it.
 */
export function localize<T extends object>(entity: T, entityId: string, locale: UiLocale, overlays: Overlays): T {
  if (locale === 'en') return entity;
  const entry = overlays[locale][entityId];
  if (entry === undefined) return entity;
  let out: unknown = entity;
  const fields = Object.entries(entry);
  // Untiered fields first, so a tier-qualified one wins on its tier.
  for (const [field, value] of [...fields.filter(([f]) => !isTierField(f)), ...fields.filter(([f]) => isTierField(f))]) {
    for (const path of overlayTargets(out, field)) out = setIn(out, path, value);
  }
  return out as T;
}

/** Where an inline pair sits: its entity and the path to the pair inside it (`cardPairs.gimchi`). */
export interface GlossRef {
  entityId: string;
  path: string;
}

/**
 * An inline `{ ko, en, romanization }` pair (minigame content) with its gloss in the
 * UI language: the overlay's `<path>.gloss` of the owning entity, else the English.
 * `overlays` is passed as for `localize`.
 */
export function localizeGloss<P extends { en: string }>(
  pair: P,
  locale: UiLocale,
  ref: GlossRef | undefined,
  overlays: Overlays,
): P {
  if (locale === 'en' || ref === undefined) return pair;
  const value = overlays[locale][ref.entityId]?.[`${ref.path}.gloss`];
  return value === undefined ? pair : { ...pair, en: value };
}
