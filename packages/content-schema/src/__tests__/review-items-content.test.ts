import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { askedKo, normalizeKo } from '../lesson-lint-items';
import { Stage1TableSchema, reviewItemsOf, serializeSnapshot } from '../review-items/build';
import { REVIEW_SNAPSHOT_FILE, REVIEW_STAGE1_FILE, lessonSourcesOfTree, storySourcesOfTree, vocabOfTree, weekSourcesOfTree } from '../review-items/sources';
import { StableIdSnapshotSchema } from '../review-items/stable-ids';
import { ReviewItemSchema, decodeReviewItems, encodeReviewItems, type ReviewItem } from '../review-items/review-item';
import { REPO_ROOT } from './helpers/romanization-registry';

/**
 * F-CURR-002 §4.2 (row CM-10) over the repository's own content: the `items-stable-id` snapshot,
 * and extraction coverage over all three sources (every Discover item and every scored round's
 * answer of the shipped lessons, every check-round word of the shipped stories and every Stage 1
 * occurrence has an item). The Stage 1 parity test lives with the Stage 1 data
 * (apps/mobile/src/content/__tests__/review-items-stage1.test.ts); the generator's determinism and
 * budget are scripts/__tests__/build-review-items.test.mjs.
 */

const json = (rel: string): unknown => JSON.parse(readFileSync(join(REPO_ROOT, rel), 'utf8'));
const tree = new Map<string, unknown>();
for (const dir of ['content/episodes', 'content/stories', 'content/vocab', 'content/packs', 'content/weekly']) {
  const walk = (rel: string): void => {
    let entries;
    try {
      entries = readdirSync(join(REPO_ROOT, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const child = `${rel}/${e.name}`;
      if (e.isDirectory() && !child.startsWith('content/stories/')) walk(child);
      else if (e.isFile() && e.name.endsWith('.json') && /^content\/(episodes\/stage-[2-7]|stories|vocab|packs|weekly)\//.test(child)) tree.set(child, json(child));
    }
  };
  walk(dir);
}
const snapshotText = readFileSync(join(REPO_ROOT, REVIEW_SNAPSHOT_FILE), 'utf8');
const snapshot = StableIdSnapshotSchema.parse(JSON.parse(snapshotText));
const stage1 = Stage1TableSchema.parse(json(REVIEW_STAGE1_FILE));
const lessons = lessonSourcesOfTree(tree);
const stories = storySourcesOfTree(tree);
// Row CM-48: the ready "This week in Korea" drops are the fourth source.
const weeks = weekSourcesOfTree(tree);
const built = reviewItemsOf({ stage1, lessons, stories, weeks, ...vocabOfTree(tree), snapshot });

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const HANGUL = /[가-힣ㄱ-ㆎ]/;

/** Every Korean string an item shows (its text and an exchange's reply), normalized. */
const shown = new Set(built.items.flatMap((i) => [normalizeKo(i.ko), ...(i.reply !== undefined ? [normalizeKo(i.reply.ko)] : [])]));

/** The items that show a Korean string (as their text or reply). */
const byShown = new Map<string, ReviewItem[]>();
for (const item of built.items) {
  for (const ko of [item.ko, ...(item.reply !== undefined ? [item.reply.ko] : [])]) byShown.set(normalizeKo(ko), [...(byShown.get(normalizeKo(ko)) ?? []), item]);
}
/** Some item showing `ko` lists `cell` among the cells that teach it (or, with `asked`, that ask it again). */
const inCell = (ko: string, cell: string, opts: { asked: boolean }): boolean =>
  (byShown.get(normalizeKo(ko)) ?? []).some((i) => i.cells.includes(cell) || (opts.asked && i.asked.includes(cell)));

/** The overlay fields of a locale (content/i18n/<locale>/*.json `entries`), as `<entity>#<field>`. */
function overlayKeys(locale: string): Set<string> {
  const dir = join(REPO_ROOT, 'content', 'i18n', locale);
  const out = new Set<string>();
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const entries = (json(`content/i18n/${locale}/${name}`) as { entries?: Record<string, Record<string, unknown>> }).entries ?? {};
    for (const [entity, fields] of Object.entries(entries)) for (const field of Object.keys(fields)) out.add(`${entity}#${field}`);
  }
  return out;
}

describe('the items-stable-id snapshot (F-CURR-002 §4.2, §9.3)', () => {
  it('holds exactly the taught items: no new, vanished, retired-but-taught or unresolved id', () => {
    const fix =
      'a new item: run node scripts/build-review-items.mjs --freeze (after update-branch too) and commit packages/content-schema/src/review-items/items-stable-id.json; ' +
      'a vanished id: add an alias or a retirement as the message says (F-CURR-002 §4.2)';
    expect(built.issues, fix).toEqual([]);
    expect(built.items.map((i) => i.id).sort()).toEqual(Object.values(snapshot.ids).filter((id) => !snapshot.retired.includes(id)).sort());
  });

  it('row CM-3A S7: the Stage 7 Check re-authoring retires the sentences it took out of every round, aliases none, and freezes its frames as new items', () => {
    const byId = new Map(built.items.map((i) => [i.id, i]));
    // One policy for the whole stage: a removed Check sentence is retired, never aliased onto a frame (a frame is a new item).
    // (Row CM-3A S4's aliases are Stage 4 items.)
    const stage7Aliases = Object.entries(snapshot.alias).filter(([, id]) => byId.get(id)?.cells.some((c) => c.startsWith('episode:stage7')));
    expect(stage7Aliases).toEqual([]);
    const S7_FRAMES: Record<string, string> = {
      'pat|이건 호야 ___이에요/예요': 'pat:igeon-hoya-n-ieyo-yeyo',
      'pat|이건 한글 ___이에요/예요': 'pat:igeon-hangeul-n-ieyo-yeyo',
    };
    for (const [key, id] of Object.entries(S7_FRAMES)) {
      expect(snapshot.ids[key], key).toBe(id);
      expect(normalizeKo(byId.get(id)?.ko ?? ''), id).toBe(key.slice('pat|'.length));
      expect(byId.get(id)?.cells, id).toContain('episode:stage7-letters');
    }
    // A retired id is never an item again (so never selected for review), and its own sentence is no longer taught.
    const S7_RETIRED = [
      'pat:achime-dalgyareul-meogeoyo',
      'pat:horangiga-joayo',
      'pat:igeon-hangeul-geuljayeyo',
      'pat:igeon-je-ireumieyo',
      'pat:jega-joahaneun-dongmureun-saeyeyo',
      'pat:jeonyeoge-ppangeul-meogeoyo',
      'pat:seollare-tteokgugeul-meogeosseoyo',
      'pat:tokkineun-jeongmal-gwiyeowoyo',
    ];
    const keyOf = new Map(Object.entries(snapshot.ids).map(([key, id]) => [id, key]));
    for (const id of S7_RETIRED) {
      expect(snapshot.retired, id).toContain(id);
      expect(byId.has(id), id).toBe(false);
      expect(shown.has(normalizeKo((keyOf.get(id) ?? '').slice('pat|'.length))), id).toBe(false);
    }
    expect(built.retired.map((r) => r.id)).toEqual(expect.arrayContaining(S7_RETIRED));
  });

  it('is committed in its canonical form (one entry per line, ids sorted), which --freeze writes', () => {
    expect(snapshotText).toBe(serializeSnapshot(built.frozen));
  });

  it('gives every item a valid shape, unique ids, and a chunk row that decodes back to it', () => {
    for (const item of built.items) expect(ReviewItemSchema.safeParse(item).success, item.id).toBe(true);
    expect(new Set(built.items.map((i) => i.id)).size).toBe(built.items.length);
    const { tables, rows } = encodeReviewItems(built.items);
    expect(decodeReviewItems({ REVIEW_ITEM_TABLES: tables, REVIEW_ITEM_ROWS: rows })).toEqual(built.items);
  });

  it('lists each item under exactly the cells its occurrences are in: the teaching ones in cells, the recycles in asked', () => {
    const cellsOf = new Map<string, Set<string>>();
    for (const { occ, id } of built.placed) cellsOf.set(id, (cellsOf.get(id) ?? new Set()).add(occ.cell));
    for (const item of built.items) expect(new Set([...item.cells, ...item.asked]), item.id).toEqual(cellsOf.get(item.id));
  });

  it('localizes every English gloss: each item and reply with one has a gloss key that resolves in the es and ko overlays (F-I18N-001)', () => {
    const lines = built.items.flatMap((i) => [{ id: i.id, line: i as { en?: string; glossKey?: string } }, ...(i.reply !== undefined ? [{ id: `${i.id} reply`, line: i.reply }] : [])]);
    const glossed = lines.filter(({ line }) => line.en !== undefined);
    expect(glossed.filter(({ line }) => line.glossKey === undefined).map(({ id }) => id)).toEqual([]);
    for (const locale of ['es', 'ko']) {
      const keys = overlayKeys(locale);
      expect(glossed.filter(({ line }) => !keys.has(line.glossKey as string)).map(({ id, line }) => `${id} ${line.glossKey}`), locale).toEqual([]);
    }
  });

  it('keeps topic words as one item under their vocab: id, with the topic gloss', () => {
    const { topicWords } = vocabOfTree(tree);
    const topic = new Map(topicWords.map((w) => [w.id, w]));
    const reused = built.items.filter((i) => i.id.startsWith('vocab:'));
    expect(reused.length).toBeGreaterThan(50);
    for (const item of reused) {
      expect(topic.has(item.id), item.id).toBe(true);
      expect(item.en).toBe(topic.get(item.id)?.en);
      expect(item.glossKey).toBe(`${item.id}#gloss`);
    }
    // No word is two items: a topic word's Korean never also has a lex: item of its own.
    const topicKo = new Set(reused.map((i) => normalizeKo(i.ko)));
    const homographs = new Set(topicWords.filter((w) => w.senseGroup !== undefined).map((w) => normalizeKo(w.ko)));
    expect(built.items.filter((i) => i.kind === 'lex' && !i.id.startsWith('vocab:') && topicKo.has(normalizeKo(i.ko)) && !homographs.has(normalizeKo(i.ko)))).toEqual([]);
  });
});

describe('extraction coverage over the three sources (F-CURR-002 §4.2)', () => {
  it('reads every shipped lesson cell (25 cells today) and every shipped story', () => {
    expect(lessons.length).toBeGreaterThanOrEqual(25);
    expect(stories.length).toBeGreaterThanOrEqual(24);
  });

  it('places every occurrence of every source on an item', () => {
    const items = new Set(built.items.map((i) => i.id));
    expect(built.placed.length).toBeGreaterThan(stage1.occurrences.length);
    for (const { id } of built.placed) expect(items.has(id)).toBe(true);
    const sources = new Set(built.placed.map(({ occ }) => (occ.cell.startsWith('story:') ? 'story' : occ.cell.startsWith('week:') ? 'week' : occ.stage === 1 ? 'stage1' : 'lesson')));
    expect([...sources].sort()).toEqual(['lesson', 'stage1', 'story', 'week']);
  });

  it('gives every Discover item of every shipped lesson an item', () => {
    const symbols = new Map(stage1.symbols.map((s) => [s.id, s.char]));
    for (const { file, body, cellId } of lessons) {
      for (const quest of arr((body as Rec).quests).filter(isRec)) {
        for (const step of arr(quest.steps).filter(isRec)) {
          for (const page of arr(isRec(step.discover) ? step.discover.pages : []).filter(isRec)) {
            for (const item of arr(page.items).filter(isRec)) {
              const texts: string[] =
                item.type === 'jamo'
                  ? [symbols.get(String(item.jamoId)) ?? `missing ${String(item.jamoId)}`]
                  : item.type === 'pattern'
                    ? [String((item.frame as Rec).ko)]
                    : item.type === 'exchange'
                      ? arr(item.lines).map((l) => String(((l as Rec).line as Rec).ko))
                      : item.type === 'realia'
                        ? arr(item.keyWords).map((w) => String((w as Rec).ko))
                        : [String(((item.word ?? item.sentence) as Rec).ko)];
              for (const ko of texts) {
                expect(shown.has(normalizeKo(ko)), `${file} ${quest.id} ${ko}`).toBe(true);
                // A Discover page teaches it, so its cell is one that teaches the item.
                expect(inCell(ko, cellId, { asked: false }), `${file} ${quest.id} ${ko} in ${cellId}`).toBe(true);
              }
            }
          }
        }
      }
    }
  });

  it("gives every scored round's answer of every shipped lesson an item (the lesson lint's own reading of answers)", () => {
    for (const { file, body, cellId } of lessons) {
      for (const quest of arr((body as Rec).quests).filter(isRec)) {
        const scored = new Set(arr(quest.steps).filter(isRec).filter((s) => ['practice', 'apply', 'check'].includes(String(s.kind))).map((s) => s.minigameRef));
        // A free-entry name round's sound table is the keyboard of that round, not taught Korean.
        const scopes = JSON.parse(JSON.stringify(arr(quest.scopes).filter(isRec).filter((s) => scored.has(s.ref)), (k, v: unknown) => (k === 'soundTable' ? undefined : v)));
        for (const ko of askedKo(scopes).filter((k) => HANGUL.test(k))) {
          expect(shown.has(ko), `${file} ${quest.id} ${ko}`).toBe(true);
          expect(inCell(ko, cellId, { asked: true }), `${file} ${quest.id} ${ko} in ${cellId}`).toBe(true);
        }
      }
    }
  });

  it('gives every taught word of every shipped story check round an item', () => {
    let words = 0;
    for (const { file, story } of stories) {
      for (const tier of arr((story as Rec).tiers).filter(isRec)) {
        for (const check of [...arr(tier.checks), ...arr(tier.checkpoints)].filter(isRec)) {
          const correct = arr(check.options).filter(isRec).find((o) => o.isCorrect === true);
          const texts = [isRec(check.target) ? check.target.ko : undefined, correct?.ko].filter((k): k is string => typeof k === 'string');
          for (const ko of texts) {
            words += 1;
            expect(shown.has(normalizeKo(ko)), `${file} ${String(check.id)} ${ko}`).toBe(true);
            expect(inCell(ko, String((story as Rec).id), { asked: true }), `${file} ${String(check.id)} ${ko}`).toBe(true);
          }
        }
      }
    }
    expect(words).toBeGreaterThan(30);
  });

  it('gives every Stage 1 occurrence (the frozen table) an item in its Stage 1 cell', () => {
    const stage1Placed = built.placed.filter(({ occ }) => occ.cell.startsWith('episode:stage1-'));
    expect(stage1Placed).toHaveLength(stage1.occurrences.length);
    const byId = new Map(built.items.map((i) => [i.id, i]));
    for (const { occ, id } of stage1Placed) {
      const item = byId.get(id);
      // A Discover page teaches it there; a round may ask again what an earlier Stage 1 cell taught.
      expect(occ.source === 'discover' ? item?.cells : [...(item?.cells ?? []), ...(item?.asked ?? [])], `${id} ${occ.at}`).toContain(occ.cell);
    }
  });

  it('teaches every Stage 1 Discover word at Stage 1, in its Stage 1 cell, with its gloss key', () => {
    const words = stage1.occurrences.filter((o) => o.source === 'discover' && o.kind === 'lex');
    expect(words.length).toBeGreaterThanOrEqual(35);
    const byId = new Map(built.items.map((i) => [i.id, i]));
    for (const { occ, id } of built.placed.filter(({ occ: o }) => o.source === 'discover' && o.cell.startsWith('episode:stage1-') && o.kind === 'lex')) {
      expect(occ.glossKey, occ.at).toMatch(/^quest:stage1-[a-z]+-q[0-9]+#steps\.[a-z0-9]+\.discover\.pages\.[0-9]+\.items\.[0-9]+\.word\.gloss$/);
      expect(byId.get(id), occ.at).toMatchObject({ stage: 1, cells: expect.arrayContaining([occ.cell]) });
    }
  });
});

describe('the "This week in Korea" drops as a review-item source (F-CURR-002 §5.7, row CM-48)', () => {
  const byId = new Map(built.items.map((i) => [i.id, i]));
  const weekCells = (i: ReviewItem): string[] => i.cells.filter((c) => c.startsWith('week:'));

  it('reads the 13 ready drops of the first quarter, from the week of 26 October 2026', () => {
    expect(weeks.map((w) => w.file)).toHaveLength(13);
    expect(weeks[0]?.file).toBe('content/weekly/2026-10-26.json');
  });

  it("gives every drop item an item that lists the drop's own cell", () => {
    for (const { file, body } of weeks) {
      const drop = body as { id: string; items: { ko: string }[] };
      for (const { ko } of drop.items) expect(inCell(ko, drop.id, { asked: false }), `${file} ${ko}`).toBe(true);
    }
  });

  it('homes an item only drops teach in the week shard at the stage the drop is written for, glossed at the drop field', () => {
    const only = built.items.filter((i) => i.cells.every((c) => c.startsWith('week:')));
    expect(only.length).toBeGreaterThanOrEqual(30);
    for (const item of only) {
      expect(item.home, item.id).toBe('week');
      expect(item.stage, item.id).toBe(2);
      expect(item.glossKey, item.id).toMatch(/^week:\d{4}-\d{2}-\d{2}#items\.[a-z0-9-]+\.gloss$|^vocab:/);
    }
  });

  it('never moves an item the route teaches: it keeps its home, stage, gloss key and first cell, and the drop is a later cell', () => {
    const shared = built.items.filter((i) => weekCells(i).length > 0 && i.cells.some((c) => !c.startsWith('week:')));
    expect(shared.map((i) => i.id)).toEqual(expect.arrayContaining(['lex:baechu', 'vocab:gimchi', 'vocab:nun-snow', 'lex:bam', 'lex:saehae']));
    for (const item of shared) {
      expect(item.home, item.id).not.toBe('week');
      expect(item.cells[0]?.startsWith('week:'), item.id).toBe(false);
      expect(item.glossKey?.startsWith('week:'), item.id).toBe(false);
    }
    expect(byId.get('lex:baechu')?.glossKey).not.toMatch(/^week:/);
  });
});
