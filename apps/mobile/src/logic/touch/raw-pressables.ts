/**
 * The source scan behind the KT-9 rule (docs/specs/AMENDMENTS-TOUCH.md section 6.9): in the learner game folders an
 * answer never sits on a raw react-native `Pressable` outside a `TapBoard`, because a raw Pressable commits on the
 * browser's click (a graze looks chosen and then counts for nothing, F1) and has no lock (a bounce answers twice).
 * Pure text functions, so the scan test reads the real sources and the rules are unit-tested on small fixtures.
 */

/** One raw `<Pressable` opening tag in a source file. */
export interface RawPressable {
  /** Its name in the scan's lists: the `testID` value as written, else the `onPress` value, else its order. */
  name: string;
  /** True when the tag sits inside an open `<TapBoard>` or `<TapControl>` element of the same file. */
  inBoard: boolean;
}

/** The end (index after `>`) of the JSX opening tag that starts at `start`; braces and quotes are skipped over. */
export function openingTagEnd(source: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start + 1; i < source.length; i += 1) {
    const c = source[i];
    if (quote !== null) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (c === '>' && depth === 0) return i + 1;
  }
  return source.length;
}

/** The written value of `attr` in an opening tag (`"x"`, or the text inside `{...}`), or null. */
export function attributeValue(tag: string, attr: string): string | null {
  const at = new RegExp(`\\s${attr}=`).exec(tag);
  if (at === null) return null;
  const from = at.index + at[0].length;
  const open = tag[from];
  if (open === '"' || open === "'") {
    const close = tag.indexOf(open, from + 1);
    return close < 0 ? null : tag.slice(from + 1, close);
  }
  if (open !== '{') return null;
  const close = matchingBrace(tag, from);
  return close < 0 ? null : tag.slice(from + 1, close).replace(/\s+/g, ' ').trim();
}

/** The index of the `}` that closes the `{` at `open`, skipping strings and template literals; -1 when unclosed. */
function matchingBrace(text: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < text.length; i += 1) {
    const c = text[i];
    if (quote !== null) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Open `<Tag ...>` elements (not self-closing) minus their closings, before `index`. */
function openCount(source: string, index: number, tag: string): number {
  const before = source.slice(0, index);
  let open = 0;
  for (const m of before.matchAll(new RegExp(`<${tag}\\b`, 'g'))) {
    const end = openingTagEnd(before, m.index ?? 0);
    if (before[end - 2] !== '/') open += 1;
  }
  const closed = before.match(new RegExp(`</${tag}>`, 'g'))?.length ?? 0;
  return open - closed;
}

/**
 * Every `<Pressable` and `<GuardedPressable` in one source file, in order; repeated names get ` #2`, ` #3`. A
 * `GuardedPressable` (the KT-9 control) still commits on the browser's click, so it is counted with the raw ones: an
 * answer belongs on a board either way.
 */
export function rawPressables(source: string): RawPressable[] {
  const found: RawPressable[] = [];
  const seen = new Map<string, number>();
  let n = 0;
  for (const m of source.matchAll(/<(?:Guarded)?Pressable\b/g)) {
    n += 1;
    const start = m.index ?? 0;
    const tag = source.slice(start, openingTagEnd(source, start));
    const base = attributeValue(tag, 'testID') ?? attributeValue(tag, 'onPress') ?? `#${n}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    const inBoard = openCount(source, start, 'TapBoard') > 0 || openCount(source, start, 'TapControl') > 0;
    found.push({ name: count === 1 ? base : `${base} #${count}`, inBoard });
  }
  return found;
}

/** The scan's verdict on one folder set: raw Pressables outside a board not on the lists, and list lines not found. */
export function rawPressableRatchet(
  found: ReadonlyMap<string, readonly RawPressable[]>,
  allowed: ReadonlyMap<string, readonly string[]>,
): { unlisted: string[]; stale: string[] } {
  const unlisted: string[] = [];
  const stale: string[] = [];
  for (const [file, list] of found) {
    const ok = allowed.get(file) ?? [];
    for (const p of list) if (!p.inBoard && !ok.includes(p.name)) unlisted.push(`${file} | ${p.name}`);
  }
  for (const [file, names] of allowed) {
    const here = (found.get(file) ?? []).filter((p) => !p.inBoard).map((p) => p.name);
    for (const name of names) if (!here.includes(name)) stale.push(`${file} | ${name}`);
  }
  return { unlisted, stale };
}
