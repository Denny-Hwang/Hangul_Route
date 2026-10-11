import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { VOCAB_TOPIC_KEYS, type RomanizationException } from '../index';
import {
  VOCAB_RULE_IDS,
  applyOps,
  checkVocabGenerated,
  checkVocabTree,
  formatFindings,
  loadVocabTree,
  materializeVocabTree,
  type VocabFinding,
  type VocabOp,
  type VocabTree,
} from './helpers/vocab-rules';

/**
 * F-VOC-001 §3.8: the content gate for `content/vocab/` and its overlays. The real
 * tree must pass; every rule has at least one deliberately broken fixture
 * (`__fixtures__/vocab/broken/*.json`: a list of edits to the valid tree in
 * `__fixtures__/vocab/valid/`, kept out of `content/` so `validate-content.mjs`
 * and the romanization scan never see them as shipped content).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..');
const FIXTURES = join(HERE, '..', '__fixtures__', 'vocab');

interface BrokenFixture {
  description: string;
  options?: { requireCompleteSet?: boolean; strictLocales?: string[] };
  drift?: boolean;
  ops: VocabOp[];
  expect: { rule: string; file?: string; id?: string; includes?: string }[];
}

const tmpRoots: string[] = [];
function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vocab-content-'));
  tmpRoots.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tmpRoots) rmSync(dir, { recursive: true, force: true });
});

const validTree = (): VocabTree => loadVocabTree(join(FIXTURES, 'valid'));
const brokenNames = readdirSync(join(FIXTURES, 'broken')).filter((n) => n.endsWith('.json')).sort();
const loadBroken = (name: string): BrokenFixture =>
  JSON.parse(readFileSync(join(FIXTURES, 'broken', name), 'utf8')) as BrokenFixture;

function matches(finding: VocabFinding, want: BrokenFixture['expect'][number]): boolean {
  return (
    finding.rule === want.rule &&
    (want.file === undefined || finding.file === want.file) &&
    (want.id === undefined || finding.id === want.id) &&
    (want.includes === undefined || finding.message.includes(want.includes))
  );
}

describe('the shipped content/vocab tree', () => {
  it('passes every rule (vacuously until topic files exist, 12 x 12 once V-6b has landed)', () => {
    const tree = loadVocabTree(join(REPO, 'content'));
    const findings = checkVocabTree(tree, { strictLocales: (process.env.HANGUL_ROUTE_STRICT_LOCALES ?? '').split(',').filter(Boolean) });
    expect(formatFindings(findings)).toBe('');
  });

  it('has the sense registry, and once all twelve topic files exist every topic holds 12 items', () => {
    const tree = loadVocabTree(join(REPO, 'content'));
    expect(Object.keys(tree)).toContain('vocab/_senses.json');
    const topicFiles = Object.keys(tree).filter((f) => /^vocab\/(?!_)[^/]+\.json$/.test(f));
    for (const file of topicFiles) {
      const parsed = tree[file] as { items?: unknown[] };
      expect(parsed.items, file).toHaveLength(12);
    }
    if (topicFiles.length === VOCAB_TOPIC_KEYS.length) {
      const ids = topicFiles.flatMap((f) => (tree[f] as { items: { id: string }[] }).items.map((i) => i.id));
      expect(ids).toHaveLength(144);
      expect(new Set(ids).size).toBe(144);
    }
  });

  it('has up-to-date generated modules (the suite spawns the generator in --check)', () => {
    expect(formatFindings(checkVocabGenerated(REPO))).toBe('');
  });
});

describe('the valid fixture tree', () => {
  it('passes every rule', () => {
    expect(formatFindings(checkVocabTree(validTree()))).toBe('');
  });

  it('passes the drift check once the generator has run on it', () => {
    const root = tmp();
    materializeVocabTree(validTree(), root);
    const built = spawnSync('node', [join(REPO, 'scripts', 'build-vocab.mjs')], {
      env: { ...process.env, HANGUL_ROUTE_ROOT: root },
      encoding: 'utf8',
    });
    expect(built.status, built.stdout + built.stderr).toBe(0);
    expect(formatFindings(checkVocabGenerated(root))).toBe('');
  });

  it('has 12 distinct romanization-correct food items', () => {
    const food = validTree()['vocab/food.json'] as { items: { id: string }[] };
    expect(food.items).toHaveLength(12);
    expect(new Set(food.items.map((i) => i.id)).size).toBe(12);
  });
});

describe('broken fixtures: each rule fires with its rule id, file and item id', () => {
  it.each(brokenNames)('%s', (name) => {
    const fixture = loadBroken(name);
    const tree = applyOps(validTree(), fixture.ops);
    let findings: VocabFinding[];
    if (fixture.drift) {
      const root = tmp();
      materializeVocabTree(tree, root);
      findings = checkVocabGenerated(root);
    } else {
      findings = checkVocabTree(tree, fixture.options);
    }
    for (const want of fixture.expect) {
      expect(
        findings.some((f) => matches(f, want)),
        `${name}: expected ${JSON.stringify(want)} in\n${formatFindings(findings)}`,
      ).toBe(true);
    }
    expect(findings.every((f) => f.file !== '' || f.rule === 'vocab-generated-drift')).toBe(true);
  });

  it('every rule id has at least one broken fixture', () => {
    const covered = new Set(brokenNames.flatMap((n) => loadBroken(n).expect.map((e) => e.rule)));
    for (const rule of VOCAB_RULE_IDS) expect(covered.has(rule), rule).toBe(true);
    for (const rule of covered) expect(VOCAB_RULE_IDS as readonly string[]).toContain(rule);
  });
});

describe('rule edge cases', () => {
  const food = (tree: VocabTree) => tree['vocab/food.json'] as { items: Record<string, unknown>[] };

  it('behaviour 2: yutnori fails with the Revised Romanization hint', () => {
    const tree = validTree();
    Object.assign(food(tree).items[0]!, { id: 'vocab:yutnori', ko: '윷놀이', romanization: 'yutnori' });
    const findings = checkVocabTree(tree).filter((f) => f.rule === 'vocab-romanization');
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toBe('윷놀이: given "yutnori", Revised Romanization is "yunnori"');
  });

  it('behaviour 3: a second 눈 without a sense group names both ids', () => {
    const tree = validTree();
    food(tree).items[0] = { ...food(tree).items[0]!, id: 'vocab:nun', ko: '눈', romanization: 'nun' };
    food(tree).items[1] = { ...food(tree).items[1]!, id: 'vocab:nun-snow', ko: '눈', romanization: 'nun' };
    const dup = checkVocabTree(tree).filter((f) => f.rule === 'vocab-duplicate-ko');
    expect(dup).toHaveLength(1);
    expect(dup[0]!.message).toContain('vocab:nun');
    expect(dup[0]!.message).toContain('vocab:nun-snow');
  });

  it('two items sharing a ko and a sense group are not duplicates', () => {
    const tree = validTree();
    tree['vocab/_senses.json'] = {
      schemaVersion: 1,
      groups: [
        {
          group: 'bae',
          members: [
            { id: 'vocab:bae-pear', en: 'pear', state: 'launch' },
            { id: 'vocab:bae-boat', en: 'boat', state: 'launch' },
          ],
        },
      ],
    };
    food(tree).items[1] = { ...food(tree).items[1]!, id: 'vocab:bae-boat', ko: '배', romanization: 'bae', senseGroup: 'bae' };
    expect(checkVocabTree(tree).filter((f) => f.rule === 'vocab-duplicate-ko')).toEqual([]);
  });

  it('behaviour 4: a reserved id used in food.json fails the registry rule', () => {
    const tree = validTree();
    tree['vocab/_senses.json'] = {
      schemaVersion: 1,
      groups: [{ group: 'i', members: [{ id: 'vocab:i-two', en: 'two', state: 'reserved' }] }],
    };
    food(tree).items[3] = { ...food(tree).items[3]!, id: 'vocab:i-two', ko: '이', romanization: 'i' };
    const findings = checkVocabTree(tree).filter((f) => f.rule === 'vocab-sense-registry');
    expect(findings.some((f) => f.id === 'vocab:i-two' && f.message.includes('(c)'))).toBe(true);
  });

  it('a senseGroup with no _senses.json at all fails (b)', () => {
    const tree = validTree();
    delete tree['vocab/_senses.json'];
    const findings = checkVocabTree(tree).filter((f) => f.rule === 'vocab-sense-registry');
    expect(findings.some((f) => f.message.includes('(b)'))).toBe(true);
  });

  it('rule (d) switches on by itself when all twelve topic files exist', () => {
    const tree = validTree();
    for (const key of VOCAB_TOPIC_KEYS) {
      if (key !== 'food') tree[`vocab/${key}.json`] = 'stub';
    }
    tree['vocab/_senses.json'] = {
      schemaVersion: 1,
      groups: [{ group: 'bae', members: [{ id: 'vocab:bae-pear', en: 'pear', state: 'launch' }, { id: 'vocab:bae-belly', en: 'belly', state: 'launch' }] }],
    };
    const findings = checkVocabTree(tree).filter((f) => f.rule === 'vocab-sense-registry');
    expect(findings.some((f) => f.id === 'vocab:bae-belly' && f.message.includes('(d)'))).toBe(true);
    delete tree['vocab/animals.json'];
    expect(checkVocabTree(tree).filter((f) => f.message.includes('(d)'))).toEqual([]);
  });

  it('the same Korean word spelled differently in two files fails the consistency rule', () => {
    const tree = validTree();
    const other = structuredClone(food(tree)) as unknown as {
      topic: Record<string, unknown>;
      items: Record<string, unknown>[];
    };
    other.topic.key = 'animals';
    other.topic.id = 'vocab-topic:animals';
    other.items.forEach((item, i) => {
      item.id = `vocab:other${i}`;
      item.romanization = i === 0 ? 'sakwa' : item.romanization;
      item.topics = ['animals'];
    });
    other.topic.coverItemId = 'vocab:other0';
    tree['vocab/animals.json'] = other;
    const findings = checkVocabTree(tree).filter((f) => f.rule === 'vocab-romanization-consistent');
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('사과');
  });

  it('colors, numbers and body are exempt from the picture-count rule', () => {
    const tree = validTree();
    const file = food(tree) as unknown as { topic: Record<string, unknown>; items: Record<string, unknown>[] };
    file.topic.key = 'colors';
    file.topic.id = 'vocab-topic:colors';
    file.items.forEach((item) => {
      item.topics = ['colors'];
      item.visual = 'word:color-red';
    });
    tree['vocab/colors.json'] = file;
    delete tree['vocab/food.json'];
    tree['vocab/_senses.json'] = { schemaVersion: 1, groups: [{ group: 'bae', members: [{ id: 'vocab:bae-pear', en: 'pear', state: 'launch' }] }] };
    delete tree['i18n/es/vocab-food.json'];
    delete tree['i18n/ko/vocab-food.json'];
    expect(checkVocabTree(tree).filter((f) => f.rule === 'vocab-visual-count')).toEqual([]);
  });

  it('an exception without a reason fails vocab-romanization; one with a reason is accepted', () => {
    const tree = validTree();
    food(tree).items[5] = { ...food(tree).items[5]!, romanization: 'kimchi' };
    const withReason: RomanizationException[] = [{ ko: '김치', allowed: ['kimchi'], reason: 'converter limit: proper noun convention' }];
    const noReason: RomanizationException[] = [{ ko: '김치', allowed: ['kimchi'], reason: '  ' }];
    expect(checkVocabTree(tree, { exceptions: withReason }).filter((f) => f.rule === 'vocab-romanization')).toEqual([]);
    const findings = checkVocabTree(tree, { exceptions: noReason }).filter((f) => f.rule === 'vocab-romanization');
    expect(findings.some((f) => f.message.includes('reason'))).toBe(true);
  });

  it('a Korean word the converter cannot read is a warning, not a failure', () => {
    const tree = validTree();
    food(tree).items[3] = { ...food(tree).items[3]!, ko: '밥ㅋ' };
    const findings = checkVocabTree(tree).filter((f) => f.rule === 'vocab-romanization');
    expect(findings).toEqual([]);
  });

  it('unparsable overlays and overlay shape errors are reported', () => {
    const tree = validTree();
    tree['i18n/es/vocab-food.json'] = 'not json';
    tree['i18n/ko/vocab-food.json'] = { locale: 'ko', domain: 'vocab-animals', entries: [] };
    tree['i18n/en/vocab-food.json'] = { locale: 'en', domain: 'vocab-food', entries: {} };
    const findings = checkVocabTree(tree).filter((f) => f.rule === 'vocab-overlay');
    // es: not an object; ko: wrong domain and entries not an object; en: not a shipped locale
    expect(findings.filter((f) => f.message.includes('overlay-bad-shape'))).toHaveLength(4);
  });

  it('a strict locale with no overlay file for a topic reports every translatable field missing', () => {
    const tree = validTree();
    delete tree['i18n/es/vocab-food.json'];
    const findings = checkVocabTree(tree, { strictLocales: ['es'] }).filter((f) => f.rule === 'vocab-overlay');
    expect(findings.every((f) => f.message.startsWith('overlay-missing') && f.file === 'vocab/food.json')).toBe(true);
    // every item's gloss, the senseNotes the items carry, and the topic's title, blurb and Hoya line
    const items = food(tree).items;
    const glossed = new Set(findings.filter((f) => f.message.endsWith('.gloss')).map((f) => f.id));
    expect(glossed.size).toBe(items.length);
    const notes = items.filter((i) => typeof (i as { senseNote?: unknown }).senseNote === 'string').length;
    expect(findings).toHaveLength(items.length + notes + 3);
  });

  it('overlay entries for topics (vocab-topic:) accept title, blurb and hoyaIntro only', () => {
    const tree = validTree();
    const es = tree['i18n/es/vocab-food.json'] as { entries: Record<string, Record<string, string>> };
    es.entries['vocab-topic:food'] = { title: 'Comida', blurb: 'x', hoyaIntro: 'y' };
    expect(checkVocabTree(tree).filter((f) => f.rule === 'vocab-overlay')).toEqual([]);
    es.entries['vocab-topic:food'] = { gloss: 'Comida' };
    expect(checkVocabTree(tree).some((f) => f.message.includes('overlay-forbidden-field'))).toBe(true);
  });

  it('findings carry the content/ path when a prefix is used and format one per line', () => {
    const tree = validTree();
    food(tree).items[0]!.visual = 'emoji:apple';
    const text = formatFindings(checkVocabTree(tree), 'content/');
    expect(text).toMatch(/vocab-visual-grammar \| vocab:sagwa \| content\/vocab\/food\.json/);
    expect(text.split('\n').length).toBeGreaterThan(1);
  });
});

describe('loadVocabTree', () => {
  it('reads topic files, the registry and overlays; keeps unparsable files as text; ignores other files', () => {
    const root = tmp();
    const put = (rel: string, text: string) => {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), text);
    };
    put('content/vocab/food.json', '{"a":1}');
    put('content/vocab/broken.json', '{ nope');
    put('content/vocab/README.md', '# x');
    put('content/vocab/_senses.json', '{"b":2}');
    put('content/i18n/es/vocab-food.json', '{"c":3}');
    put('content/i18n/es/stage1-jamo.json', '{"d":4}');
    put('content/i18n/fr/vocab-food.json', '{"e":5}');
    const tree = loadVocabTree(join(root, 'content'));
    expect(Object.keys(tree).sort()).toEqual([
      'i18n/es/vocab-food.json',
      'i18n/fr/vocab-food.json',
      'vocab/_senses.json',
      'vocab/broken.json',
      'vocab/food.json',
    ]);
    expect(tree['vocab/broken.json']).toBe('{ nope');
    expect(tree['vocab/food.json']).toEqual({ a: 1 });
    expect(loadVocabTree(join(root, 'nothing-here'))).toEqual({});
  });
});

describe('applyOps', () => {
  const base = (): VocabTree => ({ 'vocab/food.json': { items: [{ en: 'a' }, { en: 'b' }], topic: {} } });

  it('sets a nested value, appends to an array, deletes a key and an array element', () => {
    const tree = applyOps(base(), [
      { op: 'set', file: 'vocab/food.json', path: 'items.0.en', value: 'z' },
      { op: 'set', file: 'vocab/food.json', path: 'items.2', value: { en: 'c' } },
      { op: 'delete', file: 'vocab/food.json', path: 'items.1' },
      { op: 'set', file: 'vocab/food.json', path: 'topic.x', value: { y: 1 } },
      { op: 'delete', file: 'vocab/food.json', path: 'topic.x.y' },
    ]);
    expect(tree['vocab/food.json']).toEqual({ items: [{ en: 'z' }, { en: 'c' }], topic: { x: {} } });
  });

  it('does not mutate its input and supports put, copy, rename and remove', () => {
    const input = base();
    const tree = applyOps(input, [
      { op: 'copy', file: 'vocab/food.json', to: 'vocab/b.json' },
      { op: 'rename', file: 'vocab/b.json', to: 'vocab/c.json' },
      { op: 'put', file: 'vocab/d.json', value: { k: 1 } },
      { op: 'remove', file: 'vocab/d.json' },
    ]);
    expect(Object.keys(tree).sort()).toEqual(['vocab/c.json', 'vocab/food.json']);
    expect(input['vocab/food.json']).toEqual(base()['vocab/food.json']);
  });

  it('fails loudly on a path that does not exist', () => {
    expect(() => applyOps(base(), [{ op: 'set', file: 'vocab/nope.json', path: 'a', value: 1 }])).toThrow(/vocab\/nope\.json/);
    expect(() => applyOps(base(), [{ op: 'set', file: 'vocab/food.json', path: 'a.b.c', value: 1 }])).toThrow(/a\.b/);
    expect(() => applyOps(base(), [{ op: 'delete', file: 'vocab/food.json', path: 'q.r' }])).toThrow(/q/);
    expect(() => applyOps(base(), [{ op: 'copy', file: 'vocab/nope.json', to: 'vocab/x.json' }])).toThrow(/nope/);
  });
});
