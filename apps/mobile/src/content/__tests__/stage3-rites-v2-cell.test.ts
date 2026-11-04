import { readFileSync, readdirSync } from 'node:fs';
import { LessonCellSchema, type LessonCell, type LessonQuest, type LessonScope } from '@hangul-route/content-schema';
import { allowlistedInstitution, lintCurriculum, practiceCheckItems } from '@hangul-route/content-schema/lint';
import { describe, expect, it } from 'vitest';
import { SET_PHRASES } from './helpers/reuse';

/**
 * F-CURR-002 row CM-45 S3, Stage 3 Holidays & Traditions Volume 2, Cards and Seasons (`content/episodes/stage-3/rites.v2.json`):
 * the §5.1 and §5.4 S3 rules for this cell. The shared checks (U-1 to U-11, overlays, the curriculum lint over every file,
 * the review-item freeze, the game switches) run over it with every other cell; this file holds what is particular to it:
 * the greeting-card sentences (새해 복 많이 받으세요 read as one set phrase, 즐거운 ___ 보내세요), the seasonal sentences of
 * two solar terms with their dates from the Korea Astronomy and Space Science Institute (KASI), the note that frames the
 * terms as a calendar shared across East Asia with UNESCO's 2016 inscription for China, Cloze Pick in every Apply,
 * Dictation only for words said as written, triples that differ from Volume 1's, recycling and sourced notes.
 */

const read = (rel: string): unknown => JSON.parse(readFileSync(new URL(`../../../../../${rel}`, import.meta.url), 'utf8'));
const FILE = 'content/episodes/stage-3/rites.v2.json';
const cell: LessonCell = LessonCellSchema.parse(read(FILE));
const v1: LessonCell = LessonCellSchema.parse(read('content/episodes/stage-3/rites.json'));

const scopeOf = (quest: LessonQuest, kind: string): LessonScope | undefined => {
  const ref = quest.steps.find((s) => s.kind === kind)?.minigameRef;
  return quest.scopes.find((s) => s.ref === ref);
};
const tripleOf = (quest: LessonQuest): string => ['practice', 'apply', 'check'].map((k) => scopeOf(quest, k)?.kind).join(' / ');
const note = (id: string) => cell.culture.find((n) => n.id === id);

describe('Stage 3 Holidays & Traditions Volume 2 (row CM-45 S3)', () => {
  it('is the cell’s second volume: three quests, ids and refs per row CM-40', () => {
    expect(cell).toMatchObject({ id: 'episode:stage3-rites-v2', stage: 'stage3', theme: 'rites', volume: 2, status: 'ready' });
    expect(cell.quests.map((q) => q.id)).toEqual(['quest:stage3-rites-v2-q1', 'quest:stage3-rites-v2-q2', 'quest:stage3-rites-v2-q3']);
    for (const q of cell.quests) for (const s of q.scopes) expect(s.ref, q.id).toMatch(/^minigame:s3-rites-v2-q[1-3]-(practice|apply|check)$/);
  });

  it('plays Cloze Pick in every Apply, and its triples differ from Volume 1’s and from the quest before', () => {
    const triples = cell.quests.map(tripleOf);
    expect(triples).toEqual(['order-it / cloze-pick / cloze-pick', 'order-it / cloze-pick / type-hangul', 'order-it / cloze-pick / listen-pick']);
    const volume1 = new Set(v1.quests.map(tripleOf));
    for (const t of triples) expect(volume1.has(t), t).toBe(false);
  });

  it('reads the New Year greeting as one set phrase, and leaves the elder-sensitive health and adjective wishes out', () => {
    expect(SET_PHRASES).toContain('새해 복 많이 받으세요');
    const text = JSON.stringify(cell.quests);
    expect(text).toContain('새해 복 많이 받으세요.');
    // NIKL's New Year column asks for care with health wishes to elders; 행복하세요 puts an adjective in the imperative.
    for (const ko of ['건강하세요', '행복하세요', '오래오래']) expect(text, ko).not.toContain(ko);
  });

  it('asks by ear only words said as written: 카드 and 새해', () => {
    const q2 = cell.quests[1] as LessonQuest;
    const check = scopeOf(q2, 'check');
    expect(check?.kind).toBe('type-hangul');
    expect(check?.kind === 'type-hangul' ? check.rounds.map((r) => [r.mode, r.target.ko]) : []).toEqual([
      ['hear', '카드'],
      ['hear', '새해'],
    ]);
  });

  it('recycles Volume 1 and earlier quests: the curriculum lint passes the file, and Volume 1’s sentences come back by name', () => {
    const tree = new Map<string, unknown>();
    for (const stage of readdirSync(new URL('../../../../../content/episodes/', import.meta.url))) {
      if (!stage.startsWith('stage-')) continue;
      for (const f of readdirSync(new URL(`../../../../../content/episodes/${stage}/`, import.meta.url))) {
        if (f.endsWith('.json')) tree.set(`content/episodes/${stage}/${f}`, read(`content/episodes/${stage}/${f}`));
      }
    }
    expect(tree.has(FILE)).toBe(true);
    const findings = lintCurriculum(tree, { today: new Date().toISOString().slice(0, 10) }).filter((f) => f.file === FILE && f.severity === 'error');
    expect(findings.map((f) => `${f.rule} ${f.path}: ${f.message}`)).toEqual([]);
    const asked = cell.quests.flatMap((q) => practiceCheckItems(q as unknown as Parameters<typeof practiceCheckItems>[0]));
    for (const ko of ['세배를 해요', '할머니하고 할아버지가 있어요', '송편을 먹어요', '보름달을 봐요']) expect(asked, ko).toContain(ko);
  });

  it('dates the two solar terms from KASI and frames the terms as shared across East Asia, inscribed by UNESCO for China in 2016', () => {
    const kasi = 'https://astro.kasi.re.kr/kor/life/post/calendarData?year=2026';
    const n3 = note('n3');
    const n4 = note('n4');
    expect(n3?.textEn).toContain('shared across East Asia');
    expect(n3?.textEn).toContain('UNESCO inscribed "The Twenty-Four Solar Terms" for China in 2016');
    expect(n3?.textEn).not.toMatch(/Korean (invention|origin)|from Korea/i);
    expect((n3?.sources ?? []).map((s) => s.url)).toContain(kasi);
    expect((n3?.sources ?? []).find((s) => s.url.startsWith('https://ich.unesco.org/'))?.quoteOrLocator).toContain('Inscribed in 2016 (11.COM)');
    // 입동 around 7 November and 동지 around 22 December, as in KASI's 2026 table; the note does not read as a
    // one-year date, because the cell may open after 2026.
    expect(n4?.textEn).toContain('around 7 November');
    expect(n4?.textEn).toContain('around 22 December');
    expect(n4?.textEn).not.toMatch(/^In 2026/);
    const table = (n4?.sources ?? []).find((s) => s.url === kasi)?.quoteOrLocator ?? '';
    expect(table).toContain('입동 11 7');
    expect(table).toContain('동지 12 22');
  });

  it('carries four culture notes, each with two sources or more, an allowlisted one first, accessed 2026-11-03, and three passes', () => {
    expect(cell.culture.map((n) => [n.id, n.kind])).toEqual([
      ['n1', 'culture'],
      ['n2', 'culture'],
      ['n3', 'culture'],
      ['n4', 'culture'],
    ]);
    for (const n of cell.culture) {
      const sources = n.sources ?? [];
      expect(sources.length, n.id).toBeGreaterThanOrEqual(2);
      const first = sources[0];
      expect(first && allowlistedInstitution(first.publisher, first.accessed, first.url), n.id).toBeDefined();
      for (const s of sources) expect(s.accessed, n.id).toBe('2026-11-03');
      expect(n.verification?.passes, n.id).toBeGreaterThanOrEqual(3);
    }
    expect(cell.review).toMatchObject({ reviewedBy: 'MAR' });
    // No copy claims a native speaker's or an expert's review (the review notes say so in those words).
    expect(JSON.stringify(cell)).not.toMatch(/(reviewed|checked) by (a )?(native|expert|human)/i);
    expect(cell.review?.notes?.[0]).toContain('No native-speaker or expert review is claimed.');
  });
});
