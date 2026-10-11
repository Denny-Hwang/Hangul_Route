import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { checkOverlayTree } from '../../../../scripts/overlay-rules.mjs';
import { lintStory, lintStoryCorpus, parseStory, type Finding, type Story } from '../index';
import draftJson from '../__fixtures__/story/valid.draft.json';
import readyJson from '../__fixtures__/story/valid.ready.json';
import taleJson from '../__fixtures__/story/valid.tale.json';

/**
 * The CI gate for shipped story content (F-STORY-001 section 3.8): reads every
 * `content/stories/*.json` (top level only; `research/` is skipped), parses it
 * with `parseStory`, lints it, and checks file name = slug, unique ids and the
 * `story:` entries of the overlays (the shared F-I18N-001 §3.7 rules of
 * `scripts/overlay-rules.mjs`: unknown story or element ids, allowed fields,
 * `overlay-token-mismatch`, ...). Errors fail the run; warnings print.
 * `pnpm --filter @hangul-route/content-schema test -t story-content` reproduces CI.
 */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const STORIES_DIR = join(REPO_ROOT, 'content', 'stories');
const OVERLAYS_DIR = join(REPO_ROOT, 'content', 'i18n');

interface SourceFile {
  /** Path shown in annotations, relative to the repo root. */
  file: string;
  name: string;
  text: string;
}

interface Problem {
  level: 'error' | 'warning';
  file: string;
  line: number;
  rule: string;
  message: string;
}

/** Line (1-based) of the JSON value at `path` (`a.b[2].c`); the nearest parent line when it is absent. */
function lineOfPath(text: string, path: string): number {
  const segments = Array.from(path.matchAll(/\[(\d+)\]|([^.[\]]+)/g), (m) =>
    m[1] !== undefined ? Number(m[1]) : (m[2] as string),
  );
  let i = 0;
  const skipSpace = (): void => {
    while (i < text.length && /\s/.test(text[i] as string)) i++;
  };
  const skipString = (): void => {
    i++;
    while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
    i++;
  };
  const skipValue = (): void => {
    skipSpace();
    const first = text[i];
    if (first === '"') return skipString();
    if (first === '{' || first === '[') {
      let depth = 0;
      do {
        const ch = text[i] as string;
        if (ch === '"') {
          skipString();
          continue;
        }
        if (ch === '{' || ch === '[') depth++;
        if (ch === '}' || ch === ']') depth--;
        i++;
      } while (depth > 0 && i < text.length);
      return;
    }
    while (i < text.length && !/[,}\]\s]/.test(text[i] as string)) i++;
  };
  try {
    for (const segment of segments) {
      skipSpace();
      i++; // '{' or '['
      if (typeof segment === 'number') {
        for (let n = 0; n < segment; n++) {
          skipValue();
          skipSpace();
          i++; // ','
        }
        skipSpace();
      } else {
        for (;;) {
          skipSpace();
          if (i >= text.length || text[i] === '}') break;
          const start = i;
          skipString();
          const key = JSON.parse(text.slice(start, i)) as string;
          skipSpace();
          i++; // ':'
          skipSpace();
          if (key === segment) break;
          skipValue();
          skipSpace();
          i++; // ','
        }
      }
    }
  } catch {
    return 1;
  }
  return text.slice(0, i).split('\n').length;
}

/** Path of the first difference between two JSON values, or undefined when they are equal. */
function firstDifference(raw: unknown, parsed: unknown, path = ''): string | undefined {
  if (isDeepStrictEqual(raw, parsed)) return undefined;
  const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
  if (!isObject(raw) || !isObject(parsed) || Array.isArray(raw) !== Array.isArray(parsed)) return path;
  const keys = [...new Set([...Object.keys(raw), ...Object.keys(parsed)])];
  for (const key of keys) {
    const child = Array.isArray(raw) ? `${path}[${key}]` : path === '' ? key : `${path}.${key}`;
    const found = firstDifference(raw[key], parsed[key], child);
    if (found !== undefined) return found;
  }
  return path;
}

function readJsonFiles(dir: string, relative: string): SourceFile[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort()
    .map((name) => ({
      file: `${relative}/${name}`,
      name,
      text: readFileSync(join(dir, name), 'utf8'),
    }));
}

function readOverlayFiles(): SourceFile[] {
  if (!existsSync(OVERLAYS_DIR)) return [];
  return readdirSync(OVERLAYS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => readJsonFiles(join(OVERLAYS_DIR, entry.name), `content/i18n/${entry.name}`));
}

function collectProblems(stories: SourceFile[], overlays: SourceFile[] = [], today?: string): Problem[] {
  const problems: Problem[] = [];
  const add = (file: SourceFile, level: Problem['level'], rule: string, message: string, path = ''): void => {
    problems.push({ level, file: file.file, line: lineOfPath(file.text, path), rule, message });
  };
  const addFinding = (file: SourceFile, f: Finding): void =>
    add(file, f.level, f.rule, f.message, f.path);

  const parsed: Array<{ file: SourceFile; story: Story }> = [];
  const idOwner = new Map<string, string>();
  const contentTree = new Map<string, unknown>();
  for (const file of stories) {
    let json: unknown;
    try {
      json = JSON.parse(file.text);
    } catch (error) {
      add(file, 'error', 'invalid-json', (error as Error).message);
      continue;
    }
    contentTree.set(file.file, json);
    let story: Story;
    try {
      story = parseStory(json);
    } catch (error) {
      if (!(error instanceof z.ZodError)) throw error;
      for (const issue of error.issues) add(file, 'error', 'schema', issue.message, issue.path.join('.'));
      continue;
    }
    parsed.push({ file, story });
    // The bundle copies shipped JSON as-is with no runtime parse (PR 1.4), so a ready story
    // must already carry every defaulted field: parseStory(raw) deep-equals raw.
    if (story.state === 'ready') {
      const differs = firstDifference(json, story);
      if (differs !== undefined) {
        add(
          file,
          'error',
          'defaults-not-materialized',
          `a ready story must equal parseStory(raw): first difference at ${differs || '(root)'}; run it through parseStory and save the result`,
          differs.replace(/\[([^\]]*)\]/g, (m, k: string) => (/^\d+$/.test(k) ? m : `.${k}`)),
        );
      }
    }
    if (`${story.id.replace(/^story:/, '')}.json` !== file.name) {
      add(file, 'error', 'file-name-slug', `file name must be ${story.id.replace(/^story:/, '')}.json`, 'id');
    }
    const owner = idOwner.get(story.id);
    if (owner) add(file, 'error', 'story-id-duplicate', `${story.id} is also in ${owner}`, 'id');
    else idOwner.set(story.id, file.file);
    for (const finding of lintStory(story, today ? { today } : {})) addFinding(file, finding);
  }
  for (const finding of lintStoryCorpus(parsed.map((p) => p.story))) {
    problems.push({
      level: finding.level,
      file: 'content/stories',
      line: 1,
      rule: finding.rule,
      message: finding.message,
    });
  }
  const overlayFiles = new Map<string, SourceFile>();
  for (const file of overlays) {
    try {
      contentTree.set(file.file, JSON.parse(file.text));
      overlayFiles.set(file.file, file);
    } catch (error) {
      add(file, 'error', 'overlay-invalid-json', (error as Error).message);
    }
  }
  // Only the story: entries are this gate's business; validate-content.mjs reports the rest.
  for (const v of checkOverlayTree(contentTree).violations) {
    const file = overlayFiles.get(v.file);
    if (file === undefined || !v.path.startsWith('entries.story:')) continue;
    const at = v.rule.indexOf(':');
    add(file, 'error', at < 0 ? v.rule : v.rule.slice(0, at), at < 0 ? v.path : v.rule.slice(at + 1).trim(), v.path);
  }
  return problems;
}

const annotate = (p: Problem): string =>
  `::${p.level} file=${p.file},line=${p.line}::${p.rule}: ${p.message}`;

/** A fixture with the correct options spread over the positions (the fixtures put them first). */
function spread(json: unknown): Story {
  const story = structuredClone(parseStory(json));
  for (const tier of story.tiers) {
    tier.checks.forEach((check, i) => {
      const at = check.options.findIndex((o) => o.isCorrect);
      const [correct] = check.options.splice(at, 1);
      check.options.splice(Math.min([1, 0, 1][i % 3]!, check.options.length), 0, correct!);
    });
  }
  return story;
}
const readyStory = (): Story => spread(readyJson);
const asFile = (story: unknown, name: string, pretty = true): SourceFile => ({
  file: `content/stories/${name}`,
  name,
  text: JSON.stringify(story, null, pretty ? 2 : undefined),
});

describe('story-content: shipped stories in content/stories', () => {
  const files = readJsonFiles(STORIES_DIR, 'content/stories');
  const problems = collectProblems(files, readOverlayFiles());

  it('reads the top level of content/stories only, never research/', () => {
    expect(files.every((f) => !f.name.includes('/'))).toBe(true);
    expect(files.map((f) => f.name)).not.toContain('records-joseon.final.json');
  });

  it('parses and lints every story without an error', () => {
    for (const warning of problems.filter((p) => p.level === 'warning')) {
      process.stderr.write(`${annotate(warning)}\n`);
    }
    const errors = problems.filter((p) => p.level === 'error').map(annotate);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

describe('story-content: the gate itself', () => {
  const check = (s: SourceFile[], o: SourceFile[] = []): Problem[] => collectProblems(s, o, '2026-10-10');
  const draftStory = spread(draftJson);
  const draftFile = asFile(draftStory, 'hangul-day-draft.json');
  const taleFile = asFile(spread(taleJson), 'sun-and-moon-fixture.json');
  const readyFile = asFile(readyStory(), 'hangul-day.json');

  it('passes valid draft, tale and ready stories', () => {
    const problems = check([draftFile, taleFile, readyFile]);
    expect(problems.filter((p) => p.level === 'error').map(annotate)).toEqual([]);
    expect(problems.filter((p) => p.level === 'warning').map((p) => p.rule)).toEqual([
      'approximation-time-relative',
    ]);
  });

  it('is empty-safe', () => {
    expect(check([])).toEqual([]);
    expect(readJsonFiles(join(STORIES_DIR, 'does-not-exist'), 'x')).toEqual([]);
  });

  it('reports invalid JSON', () => {
    const [problem] = check([{ file: 'content/stories/a.json', name: 'a.json', text: '{' }]);
    expect(problem).toMatchObject({ level: 'error', rule: 'invalid-json', file: 'content/stories/a.json' });
  });

  it('reports a schema failure with the path of the issue', () => {
    const broken = { ...structuredClone(draftStory), minutes: 99 };
    const [problem] = check([asFile(broken, 'hangul-day-draft.json')]);
    expect(problem).toMatchObject({ level: 'error', rule: 'schema' });
    expect(problem!.line).toBe(
      asFile(broken, 'x.json').text.split('\n').findIndex((l) => l.includes('"minutes"')) + 1,
    );
  });

  it('rethrows anything that is not a schema failure', () => {
    expect(() => check([{ file: 'f', name: 'f.json', text: 'null' }])).not.toThrow();
  });

  it('requires a ready story to equal parseStory(raw): defaulted fields are written out', () => {
    const missing = (mutate: (raw: Record<string, unknown>) => void): Problem[] => {
      const raw = structuredClone(readyStory()) as unknown as Record<string, unknown>;
      mutate(raw);
      return check([asFile(raw, 'hangul-day.json')]).filter((p) => p.rule === 'defaults-not-materialized');
    };
    expect(missing(() => undefined)).toEqual([]);
    const [errata] = missing((raw) => delete raw.errata);
    expect(errata).toMatchObject({ level: 'error', file: 'content/stories/hangul-day.json' });
    expect(errata!.message).toContain('first difference at errata');
    expect(missing((raw) => delete raw.pillarTags)).toHaveLength(1);
    expect(missing((raw) => delete raw.companionId)).toHaveLength(1);
    const nested = missing((raw) => {
      const tiers = raw.tiers as Array<{ scenes: Array<Record<string, unknown>> }>;
      delete tiers[0]!.scenes[0]!.framing;
    });
    expect(nested[0]!.message).toContain('tiers[0].scenes[0].framing');
    expect(missing((raw) => delete (raw.keywords as Array<Record<string, unknown>>)[0]!.kind)).toHaveLength(1);
  });

  it('does not require drafts to materialise defaults (they are never bundled)', () => {
    const raw = structuredClone(draftStory) as unknown as Record<string, unknown>;
    delete raw.errata;
    expect(check([asFile(raw, 'hangul-day-draft.json')])).toEqual([]);
  });

  it('finds the first difference between two JSON values', () => {
    expect(firstDifference({ a: 1 }, { a: 1 })).toBeUndefined();
    expect(firstDifference({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe('a[1].b');
    expect(firstDifference({ a: 1 }, { a: 1, b: [] })).toBe('b');
    expect(firstDifference([1], { 0: 1 })).toBe('');
    expect(firstDifference(1, 2)).toBe('');
  });

  it('requires file name = slug and unique ids', () => {
    const wrongName = check([asFile(draftStory, 'other.json')]);
    expect(wrongName.map((p) => p.rule)).toEqual(['file-name-slug']);
    const duplicate = check([draftFile, asFile(draftStory, 'copy.json')]);
    expect(duplicate.map((p) => p.rule).sort()).toEqual(['file-name-slug', 'story-id-duplicate']);
  });

  it('prints lint errors and warnings as annotations at the line of the finding', () => {
    const bad = structuredClone(draftStory);
    bad.tiers[0]!.scenes[0]!.narrationEn = 'King {kw:ghost} wanted everyone to read.';
    bad.facts[0]!.sources[0]!.url = 'http://www.heritage.go.kr/fixture/hangul';
    bad.facts[0]!.sources[0]!.accessed = '2024-01-01';
    const file = asFile(bad, 'hangul-day-draft.json');
    const out = check([file]).map(annotate);
    const lineOf = (needle: string, skip = 0): number =>
      file.text.split('\n').flatMap((l, i) => (l.includes(needle) ? [i + 1] : []))[skip]!;
    const unknown = check([file]).find((p) => p.rule === 'narration-token-unknown')!;
    expect(out).toContain(
      `::error file=content/stories/hangul-day-draft.json,line=${lineOf('"narrationEn"')}::narration-token-unknown: ${unknown.message}`,
    );
    expect(out.some((l) => l.startsWith('::error') && l.includes('source-url-not-https:'))).toBe(true);
    expect(out.some((l) => l.startsWith('::error') && l.includes('source-accessed-invalid:'))).toBe(true);
    const url = check([file]).find((p) => p.rule === 'source-url-not-https')!;
    expect(url.line).toBe(lineOf('"url"'));
  });

  it('applies the corpus answer-position rule across ready stories', () => {
    const skewed = structuredClone(parseStory(readyJson));
    const problems = check([asFile(skewed, 'hangul-day.json')]);
    expect(problems.map((p) => p.rule)).toContain('corpus-answer-index-0-share');
  });

  it('checks the story: entries of the overlays with the shared overlay rules', () => {
    const overlay = (entries: unknown): SourceFile => ({
      file: 'content/i18n/es/stories.json',
      name: 'stories.json',
      text: JSON.stringify({ locale: 'es', domain: 'stories', entries }),
    });
    const stories = [draftFile];
    expect(check(stories, [overlay({ 'story:hangul-day-draft': { title: 'x' } })])).toEqual([]);
    expect(
      check(stories, [overlay([{ id: 'story:hangul-day-draft', title: 'x' }, { id: 'card:other' }, { title: 'no id' }])]),
    ).toEqual([]);
    expect(check(stories, [overlay({ 'card:hanji': {} }), overlay(null), overlay('x')])).toEqual([]);
    const unknown = check(stories, [overlay({ 'story:ghost': { title: 'x' } })]);
    expect(unknown).toEqual([
      expect.objectContaining({ level: 'error', rule: 'overlay-unknown-id', file: 'content/i18n/es/stories.json' }),
    ]);
    const invalid = check(stories, [{ file: 'content/i18n/ko/stories.json', name: 'stories.json', text: '[' }]);
    expect(invalid.map((p) => p.rule)).toEqual(['overlay-invalid-json']);
    const forbidden = check(stories, [overlay({ 'story:hangul-day-draft': { romanization: 'x', 'scenes.s99.narration': 'x' } })]);
    expect(forbidden.map((p) => p.rule).sort()).toEqual(['overlay-forbidden-field', 'overlay-unknown-id']);
    const ko = check(stories, [
      {
        file: 'content/i18n/ko/stories.json',
        name: 'stories.json',
        text: JSON.stringify({ locale: 'ko', domain: 'stories', entries: { 'story:hangul-day-draft': { title: '한글을 기리는 날' } } }),
      },
    ]);
    expect(ko).toEqual([]);
  });

  it('finds the line of a path, falling back to the nearest parent or line 1', () => {
    const text = JSON.stringify({ a: { b: [1, { c: 'x', d: [true, null, 'y"z'] }], e: 2 }, f: 3 }, null, 2);
    const at = (needle: string): number => text.split('\n').findIndex((l) => l.includes(needle)) + 1;
    expect(lineOfPath(text, '')).toBe(1);
    expect(lineOfPath(text, 'a')).toBe(at('"a"'));
    expect(lineOfPath(text, 'a.b[1].c')).toBe(at('"c"'));
    expect(lineOfPath(text, 'a.b[1].d[2]')).toBe(at('y\\"z'));
    expect(lineOfPath(text, 'a.e')).toBe(at('"e"'));
    expect(lineOfPath(text, 'f')).toBe(at('"f"'));
    expect(lineOfPath(text, 'a.missing')).toBeGreaterThanOrEqual(1);
    expect(lineOfPath('not json', 'a.b')).toBe(1);
  });

  it('uses lintStory directly on the same objects', () => {
    expect(lintStory(readyStory(), { today: '2026-10-10' }).filter((f) => f.level === 'error')).toEqual([]);
  });
});
