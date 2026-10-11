import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HANGUL, lintStory, parseStory, type Finding } from '../index';
import {
  mapEpisode,
  type ClusterRecord,
  type ImportReport,
  type JamoEntry,
} from '../../../../scripts/import-heritage.mjs';

/**
 * The real-data contract of F-STORY-001 section 3.14 (PR 1.6): the importer maps the 24
 * episodes of the four committed `*.final.json` files, every draft passes `parseStory`, and
 * the lint finds no error. Run raw (`resolve: false`) it must reproduce exactly the finding
 * classes of the section, so a schema change that stops holding a research episode fails CI
 * and so does a research-file edit that reintroduces one of the fixed classes.
 * Skipped when `content/stories/research/` is absent.
 */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const RESEARCH_DIR = join(REPO_ROOT, 'content', 'stories', 'research');
const JAMO_FILE = join(REPO_ROOT, 'content', 'episodes', 'stage-1', 'jamo.json');
const TODAY = '2026-10-10';

interface ResearchFile {
  name: string;
  cluster: ClusterRecord;
  episodes: unknown[];
}

function readResearch(): ResearchFile[] {
  return readdirSync(RESEARCH_DIR)
    .filter((f) => f.endsWith('.final.json'))
    .sort()
    .map((name) => {
      const doc = JSON.parse(readFileSync(join(RESEARCH_DIR, name), 'utf8')) as {
        cluster: string;
        verification?: ClusterRecord['verification'];
        episodes: unknown[];
      };
      return {
        name,
        cluster: { cluster: doc.cluster, verification: doc.verification, fileDate: TODAY },
        episodes: doc.episodes,
      };
    });
}

type Mapped = { story: ReturnType<typeof mapEpisode>['story']; report: ImportReport; raw: unknown };

function mapAll(resolve: boolean): Mapped[] {
  const jamo = JSON.parse(readFileSync(JAMO_FILE, 'utf8')) as JamoEntry[];
  return readResearch().flatMap((file) =>
    file.episodes.map((raw) => ({ raw, ...mapEpisode(raw, file.cluster, jamo, { resolve }) })),
  );
}

const lint = (m: Mapped): Finding[] => lintStory(parseStory(m.story), { today: TODAY });
const errorsOf = (list: Mapped[]): Array<Finding & { story: string }> =>
  list.flatMap((m) =>
    lint(m)
      .filter((f) => f.level === 'error')
      .map((f) => ({ ...f, story: m.story.id })),
  );
const count = <T>(items: T[], key: (t: T) => string): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const item of items) out[key(item)] = (out[key(item)] ?? 0) + 1;
  return out;
};

describe.skipIf(!existsSync(RESEARCH_DIR))('import-real: the 24 research episodes (section 3.14)', () => {
  const files = readResearch();
  const resolved = mapAll(true);
  const raw = mapAll(false);
  const stories = resolved.map((m) => m.story);

  it('reads the four committed final files, all verified three times', () => {
    expect(files.map((f) => f.name)).toEqual([
      'hangul-printing.final.json',
      'records-joseon.final.json',
      'science-art-life.final.json',
      'seasons-tales.final.json',
    ]);
    expect(files.every((f) => f.cluster.verification?.passes === 3)).toBe(true);
    expect(stories.every((s) => s.verification.passes === 3 && s.verification.scope === 'cluster')).toBe(true);
  });

  it('maps 24 stories, 182 scenes, 211 facts and 576 sources', () => {
    expect(stories).toHaveLength(24);
    expect(new Set(stories.map((s) => s.id)).size).toBe(24);
    expect(stories.reduce((n, s) => n + s.tiers[0]!.scenes.length, 0)).toBe(182);
    expect(stories.reduce((n, s) => n + s.facts.length, 0)).toBe(211);
    expect(stories.reduce((n, s) => n + s.facts.reduce((m, f) => m + f.sources.length, 0), 0)).toBe(576);
    expect(stories.reduce((n, s) => n + s.tiers[0]!.checks.length, 0)).toBe(72);
  });

  it('writes drafts only, with contentVer 1 and every defaulted field present', () => {
    for (const story of stories) {
      expect(story.state).toBe('draft');
      expect(story.contentVer).toBe(1);
      expect(story.shelf).toBeUndefined();
      expect(story.review.language).toBe('draft');
      expect(story.review.culture).toBe('draft');
    }
  });

  it('passes parseStory as a draft, and parseStory(json) equals the json (nothing left to default)', () => {
    for (const m of resolved) {
      const json: unknown = JSON.parse(JSON.stringify(m.story));
      expect(() => parseStory(json), m.story.id).not.toThrow();
      expect(parseStory(json), m.story.id).toEqual(json);
    }
    for (const m of raw) expect(() => parseStory(JSON.parse(JSON.stringify(m.story))), m.story.id).not.toThrow();
  });

  it('lints without an error: the known classes are resolved by the importer', () => {
    expect(errorsOf(resolved).map((f) => `${f.story} ${f.rule} ${f.path}`)).toEqual([]);
  });

  it('reproduces exactly the finding classes of section 3.14 when run raw', () => {
    const errors = errorsOf(raw);
    expect(count(errors, (f) => f.rule)).toEqual({
      'narration-number-unsupported': 4,
      'narration-approximation-unmarked': 3,
      'source-url-not-https': 1,
      'gloss-contains-hangul': 2,
    });
    expect(
      errors
        .filter((f) => f.rule === 'narration-number-unsupported')
        .map((f) => `${f.story} ${f.path}`)
        .sort(),
    ).toEqual([
      'story:joseon-records-today tiers[0].scenes[4].narrationEn',
      'story:sejong-new-letters tiers[0].scenes[0].narrationEn',
      'story:sillok-mountain-archives tiers[0].scenes[3].narrationEn',
      'story:tripitaka-koreana tiers[0].scenes[7].narrationEn',
    ]);
    expect(errors.find((f) => f.rule === 'source-url-not-https')).toMatchObject({
      story: 'story:tripitaka-koreana',
      path: 'facts[5].sources[3].url',
    });
    expect(
      errors
        .filter((f) => f.rule === 'gloss-contains-hangul')
        .map((f) => f.story)
        .sort(),
    ).toEqual(['story:nanjung-ilgi', 'story:sillok-royal-historians']);
  });

  it('marks the four derived numbers with approximations that name the fact they derive from', () => {
    const approximations = resolved.flatMap((m) =>
      m.story.tiers[0]!.scenes.flatMap((s) =>
        s.approximations.map((a) => ({ story: m.story.id, scene: s.id, ...a })),
      ),
    );
    const rows = approximations.map((a) => [a.story, a.scene, a.text, a.factIds, a.timeRelative]);
    expect(rows.sort((x, y) => String(x[0]).localeCompare(String(y[0])))).toEqual([
      ['story:joseon-records-today', 's5', 'nearly 300 years', ['f4'], false],
      ['story:sejong-new-letters', 's1', 'almost 600 years', ['f3'], true],
      ['story:sillok-mountain-archives', 's4', '1590s', ['f5'], false],
      ['story:tripitaka-koreana', 's8', 'Almost 800 years', ['f3'], true],
    ]);
  });

  it('upgrades the one http:// source to the same page over https, dropping nothing', () => {
    const all = stories.flatMap((s) => s.facts.flatMap((f) => f.sources));
    expect(all.every((s) => s.url.startsWith('https://'))).toBe(true);
    const tripitaka = resolved.find((m) => m.story.id === 'story:tripitaka-koreana')!;
    expect(tripitaka.story.facts[5]!.sources[3]!.url).toBe(
      'https://treestory.forest.or.kr/v1/bbs/bbs.php?cmd=view&board_name=b44&bid=672&curpage=1&count=y',
    );
    expect(tripitaka.story.facts[5]!.sources).toHaveLength(4);
  });

  it('leaves no Hangul in learner English: narration, glosses, prompts, options, hyphen-free romanization', () => {
    for (const story of stories) {
      const tier = story.tiers[0]!;
      const english: string[] = [story.title.en, story.summaryEn];
      for (const k of story.keywords) english.push(k.en);
      for (const s of tier.scenes) {
        english.push(s.narrationEn);
        if (s.keyword) english.push(s.keyword.en);
        if (s.line) english.push(s.line.en);
      }
      for (const c of tier.checks) {
        english.push(c.promptEn);
        for (const o of c.options) if (o.en) english.push(o.en);
        if (c.target) english.push(c.target.en);
      }
      expect(english.filter((t) => HANGUL.test(t)), story.id).toEqual([]);
      const romanizations = [
        ...story.keywords.map((k) => k.romanization),
        ...tier.scenes.flatMap((s) => [s.keyword?.romanization, s.line?.romanization]),
      ];
      expect(romanizations.filter((r) => r?.includes('-')), story.id).toEqual([]);
    }
  });

  it('keeps the Jang Yeong-sil narration name and the Hangul in reference text untouched', () => {
    const clock = stories.find((s) => s.id === 'story:jagyeongnu-water-clock')!;
    expect(clock.tiers[0]!.scenes[1]!.narrationEn).toContain('Jang Yeong-sil');
    expect(clock.tiers[0]!.scenes[1]!.keyword!.romanization).toBe('Jang Yeongsil');
    expect(stories.every((s) => s.learningGoalsEn.length >= 2 && s.facts.every((f) => HANGUL.test(f.claimKo)))).toBe(true);
  });

  it('reports the seven undefined terms for the author and nothing else as undefined', () => {
    const terms = resolved.flatMap((m) => m.report.unresolvedTerms.map((t) => t.ko)).sort();
    expect(terms).toEqual(['김홍도', '사초', '수원화성문화제', '승정원일기', '원행을묘정리의궤', '이순신', '허준'].sort());
    for (const m of resolved) {
      for (const t of m.report.unresolvedTerms) {
        const keyword = m.story.keywords.find((k) => k.ko === t.ko)!;
        expect(keyword).toMatchObject({ id: t.id, kind: 'term', romanization: '', en: '' });
      }
    }
  });

  it('builds 233 keywords from the vocab and the scene Korean, plus the narration extras', () => {
    const extras = resolved.reduce((n, m) => n + m.report.addedFromNarration.jamo + m.report.addedFromNarration.terms, 0);
    expect(resolved.reduce((n, m) => n + m.story.keywords.length, 0) - extras).toBe(233);
    expect(Math.max(...stories.map((s) => s.keywords.length))).toBeLessThanOrEqual(24);
    expect(extras).toBeGreaterThanOrEqual(7);
  });

  it('keeps the shape of the checks: 3 per episode, 37 with 3 options and 35 with 4, correct first in 17', () => {
    const checks = stories.flatMap((s) => s.tiers[0]!.checks);
    expect(stories.every((s) => s.tiers[0]!.checks.length === 3)).toBe(true);
    expect(checks.filter((c) => c.options.length === 3)).toHaveLength(37);
    expect(checks.filter((c) => c.options.length === 4)).toHaveLength(35);
    expect(checks.filter((c) => c.options[0]!.isCorrect)).toHaveLength(17);
    expect(checks.every((c) => c.explainEn === undefined)).toBe(true);
    const ko = checks.flatMap((c) => c.options.filter((o) => o.ko !== undefined));
    expect(ko.map((o) => o.ko)).toEqual(['ㅣ', 'ㅡ', 'ㅏ']);
    expect(checks.filter((c) => c.target !== undefined)).toHaveLength(8);
  });

  it('warns about what the author still decides, with no surprise class', () => {
    const warnings = resolved.flatMap((m) => lint(m).filter((f) => f.level === 'warning'));
    const byRule = count(warnings, (f) => f.rule);
    expect(byRule['check-option-long']).toBe(1);
    expect(byRule['approximation-time-relative']).toBe(2);
    expect(byRule['style-script-name']).toBeGreaterThanOrEqual(1);
    expect(Object.keys(byRule).filter((rule) => !ALLOWED_WARNINGS.has(rule))).toEqual([]);
  });

  it('proposes advisories for exactly the 9 scenes of the 5 stories the spec names', () => {
    const scenes = resolved.flatMap((m) => m.report.advisoryScenes.map((n) => `${m.story.id}:s${n}`)).sort();
    expect(scenes).toEqual(
      [
        'story:sillok-mountain-archives:s1',
        'story:sillok-mountain-archives:s4',
        'story:sillok-mountain-archives:s6',
        'story:donguibogam:s3',
        'story:nanjung-ilgi:s2',
        'story:nanjung-ilgi:s3',
        'story:nanjung-ilgi:s6',
        'story:tripitaka-koreana:s3',
        'story:jikji-metal-type:s8',
      ].sort(),
    );
    const tales = stories.filter((s) => s.kind === 'folk-tale');
    expect(tales.map((s) => s.id).sort()).toEqual(['story:pansori-tales', 'story:sun-and-moon']);
    for (const tale of tales) {
      expect(tale.origin.type).toBe('traditional');
      expect(tale.facts.some((f) => f.scope === 'in-the-tale')).toBe(true);
    }
  });

  it('does not touch the research input', () => {
    const jamo = JSON.parse(readFileSync(JAMO_FILE, 'utf8')) as JamoEntry[];
    for (const file of readResearch()) {
      const before = JSON.stringify(file.episodes);
      for (const episode of file.episodes) mapEpisode(episode, file.cluster, jamo);
      expect(JSON.stringify(file.episodes)).toBe(before);
    }
  });
});

const ALLOWED_WARNINGS = new Set([
  'approximation-time-relative',
  'check-option-long',
  'narration-number-word-unmatched',
  'source-host-unlisted',
  'style-script-name',
  'tale-facts-all-documented',
  'fact-unused',
]);
