// F-CURR-002 §10 (row CM-5): the lesson chunk checks and the precache report of pwa-postbuild.mjs.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GROWN_UP_PREFIXES } from '@hangul-route/content-schema';
import { grownUpHeadersBlock } from '../app-host/headers.mjs';
import {
  LOCALE_CHUNKS,
  PRECACHE_BUDGET,
  ROOT_CHUNKS,
  SCREEN_CHUNKS,
  WEB_JS_DIR,
  budgetIsAdvisory,
  isStartBundle,
  lessonChunkProblems,
  lessonChunkUrls,
  markedChunkProblems,
  md5,
  nosniffLessonChunks,
  precacheBudgetProblems,
  precacheReport,
  reportLines,
} from '../pwa/lesson-chunks.mjs';

const MANIFEST = [
  { name: 'lessons-cell-stage2-rites', hash: '0123456789abcdef' },
  { name: 'lessons-titles-es', hash: 'fedcba9876543210' },
];
const START = `${WEB_JS_DIR}/index-0a1b2c.js`;
const startText = `var m={"episode:stage2-rites":"0123456789abcdef"},t={"es":"fedcba9876543210"};`;
const chunk = (name, hash) => {
  const text = `__d(function(g,r,i,a,m,e,d){e.CHUNK_HASH="${hash}";e.LESSON_STEPS={}});`;
  return { url: `${WEB_JS_DIR}/${name}-${md5(text)}.js`, text };
};
const sound = () => [{ url: START, text: startText }, ...MANIFEST.map((m) => chunk(m.name, m.hash))];
const all = (bundles) => bundles.map((b) => b.url);

describe('lessonChunkProblems', () => {
  it('passes a build where every chunk is its own precached bundle carrying the manifest hash', () => {
    const bundles = sound();
    expect(lessonChunkProblems({ manifest: MANIFEST, bundles, precached: all(bundles) })).toEqual([]);
    // Precache URLs may carry a leading slash.
    expect(lessonChunkProblems({ manifest: MANIFEST, bundles, precached: all(bundles).map((u) => `/${u}`) })).toEqual([]);
    expect(isStartBundle(START)).toBe(true);
    expect(isStartBundle(bundles[1].url)).toBe(false);
  });

  it('fails a chunk missing from the build, and one missing from the precache (the clip gaps mechanism)', () => {
    const bundles = sound().filter((b) => !b.url.includes('lessons-titles-es'));
    expect(lessonChunkProblems({ manifest: MANIFEST, bundles, precached: all(bundles) })).toEqual(['lessons-titles-es has no web bundle: the chunk is missing from the build']);
    const built = sound();
    const problems = lessonChunkProblems({ manifest: MANIFEST, bundles: built, precached: all(built).slice(0, 2) });
    expect(problems).toEqual([`${built[2].url} is missing from the precache`]);
  });

  it('fails a chunk pulled into the start bundle (Metro leaves an empty bundle behind)', () => {
    const empty = { url: `${WEB_JS_DIR}/lessons-cell-stage2-rites-${md5('')}.js`, text: '' };
    const bundles = [{ url: START, text: `${startText}e.CHUNK_HASH = "0123456789abcdef";` }, empty, chunk('lessons-titles-es', 'fedcba9876543210')];
    expect(lessonChunkProblems({ manifest: MANIFEST, bundles, precached: all(bundles) })).toEqual([
      `lessons-cell-stage2-rites is in the start bundle ${START}: a static import pulled the chunk in`,
      `${empty.url} does not carry 0123456789abcdef, the hash the manifest names for lessons-cell-stage2-rites`,
    ]);
  });

  it('checks each manifest entry against its chunk hash, and the bundle name against its content', () => {
    const stale = chunk('lessons-cell-stage2-rites', 'aaaaaaaaaaaaaaaa');
    const renamed = { url: `${WEB_JS_DIR}/lessons-titles-es-${md5('other')}.js`, text: chunk('lessons-titles-es', 'fedcba9876543210').text };
    const bundles = [{ url: START, text: startText }, stale, renamed];
    expect(lessonChunkProblems({ manifest: MANIFEST, bundles, precached: all(bundles) })).toEqual([
      `${stale.url} does not carry 0123456789abcdef, the hash the manifest names for lessons-cell-stage2-rites`,
      `${renamed.url}: its file name is not the md5 of its content`,
    ]);
  });

  it('fails a start bundle that does not name the hashes (built from other content), two bundles of one chunk, or no single start bundle', () => {
    const bundles = [{ url: START, text: 'var m={};' }, ...MANIFEST.map((m) => chunk(m.name, m.hash))];
    expect(lessonChunkProblems({ manifest: MANIFEST.slice(0, 1), bundles, precached: all(bundles) })).toEqual([
      `the start bundle ${START} does not name lessons-cell-stage2-rites's hash 0123456789abcdef: the shell and the chunk come from other content`,
    ]);
    const twice = [...sound(), { ...chunk('lessons-titles-es', 'fedcba9876543210'), url: `${WEB_JS_DIR}/lessons-titles-es-${'0'.repeat(32)}.js` }];
    expect(lessonChunkProblems({ manifest: MANIFEST.slice(1), bundles: twice, precached: all(twice) })[0]).toMatch(/^lessons-titles-es has 2 web bundles: /);
    const none = MANIFEST.map((m) => chunk(m.name, m.hash));
    expect(lessonChunkProblems({ manifest: [], bundles: none, precached: all(none) })).toEqual([`expected one start bundle (${WEB_JS_DIR}/index-<hash>.js), found 0`]);
  });
});

describe('the story chunks of row CM-8 (the same checks)', () => {
  const STORIES = [{ name: 'story-sun-and-moon', hash: '1111222233334444' }];
  const storyChunk = (name, hash) => {
    const text = `__d(function(g,r,i,a,m,e,d){e.CHUNK_HASH="${hash}";e.STORY_BODY={}});`;
    return { url: `${WEB_JS_DIR}/${name}-${md5(text)}.js`, text };
  };
  const withStory = () => [
    { url: START, text: `${startText}var s=[{"id":"story:sun-and-moon","chunk":"1111222233334444"}];` },
    ...MANIFEST.map((m) => chunk(m.name, m.hash)),
    storyChunk('story-sun-and-moon', '1111222233334444'),
  ];

  it('passes a story chunk that is its own precached bundle, and fails one missing from the precache or pulled into the start bundle', () => {
    const bundles = withStory();
    const manifest = [...MANIFEST, ...STORIES];
    expect(lessonChunkProblems({ manifest, bundles, precached: all(bundles) })).toEqual([]);
    expect(lessonChunkProblems({ manifest, bundles, precached: all(bundles).slice(0, 3) })).toEqual([`${bundles[3].url} is missing from the precache`]);
    const pulled = [{ url: START, text: `${bundles[0].text}e.CHUNK_HASH="1111222233334444";` }, ...bundles.slice(1, 3), { url: `${WEB_JS_DIR}/story-sun-and-moon-${md5('')}.js`, text: '' }];
    expect(lessonChunkProblems({ manifest, bundles: pulled, precached: all(pulled) })).toEqual([
      `story-sun-and-moon is in the start bundle ${START}: a static import pulled the chunk in`,
      `${pulled[3].url} does not carry 1111222233334444, the hash the manifest names for story-sun-and-moon`,
    ]);
  });

  it('lists the story bundles with the lesson bundles for the nosniff check (an older build asks for either)', () => {
    const bundles = withStory();
    expect(lessonChunkUrls([...MANIFEST, ...STORIES], bundles)).toEqual(bundles.slice(1).map((b) => b.url));
    expect(nosniffLessonChunks('/_expo/*\n  X-Content-Type-Options: nosniff\n', lessonChunkUrls([...MANIFEST, ...STORIES], bundles))).toContain(bundles[3].url);
  });

  it('counts the story chunks apart from the lesson chunks in the report', () => {
    const bundles = withStory();
    const report = precacheReport({ manifest: MANIFEST, stories: STORIES, bundles, precache: { count: 4, size: 99 } });
    expect(report.lessonChunks.count).toBe(2);
    expect(report.storyChunks).toEqual({ count: 1, raw: bundles[3].text.length, gzip: expect.any(Number), largest: { url: bundles[3].url, raw: bundles[3].text.length } });
    const lines = reportLines(report);
    expect(lines[3]).toMatch(/^ {2}story chunks {2}1 bundles {2}\d+ B raw {2}\d+ B gzip$/);
    expect(lines).toHaveLength(5);
    // Without a story manifest the story line counts none.
    expect(precacheReport({ manifest: MANIFEST, bundles, precache: { count: 4, size: 99 } }).storyChunks).toEqual({ count: 0, raw: 0, gzip: 0, largest: null });
  });

  it('holds the built story bundles to the story lines: one bundle, the raw total and the gzip total', () => {
    const lines = { ...PRECACHE_BUDGET, storyChunkRaw: 100, storiesRaw: 150, storiesGzip: 40 };
    const report = {
      start: { url: START, raw: 1, gzip: 1 },
      lessonChunks: { count: 0, raw: 0, gzip: 0, largest: null },
      storyChunks: { count: 2, raw: 151, gzip: 41, largest: { url: `${WEB_JS_DIR}/story-sun-and-moon-${md5('x')}.js`, raw: 101 } },
      precache: { count: 3, raw: 153 },
    };
    expect(precacheBudgetProblems(report, lines)).toEqual([
      expect.stringMatching(new RegExp(`^the story bundle ${WEB_JS_DIR}/story-sun-and-moon-[0-9a-f]{32}\\.js is 101 B raw, over the per-story ceiling of 100 B `)),
      expect.stringMatching(/^the story bundles are 151 B raw, over the stories ceiling of 150 B /),
      expect.stringMatching(/^the story bundles are 41 B gzip, over the stories ceiling of 40 B gzip /),
    ]);
    expect(precacheBudgetProblems({ ...report, storyChunks: { count: 2, raw: 150, gzip: 40, largest: { url: 'x', raw: 100 } } }, lines)).toEqual([]);
    expect(precacheBudgetProblems({ ...report, storyChunks: { count: 0, raw: 0, gzip: 0, largest: null } }, lines)).toEqual([]);
  });

  it('the story lines on the built bundles are the lines of scripts/build-stories.mjs', async () => {
    const { BUDGET } = await import('../../../../scripts/build-stories.mjs');
    expect(PRECACHE_BUDGET.storyChunkRaw).toBe(BUDGET.perStoryRaw);
    expect(PRECACHE_BUDGET.storiesRaw).toBe(BUDGET.totalRaw);
    expect(PRECACHE_BUDGET.storiesGzip).toBe(BUDGET.totalGzip);
  });
});

describe('markedChunkProblems (the locale chunks and the grown-up roots)', () => {
  const localeChunk = (name, marker) => {
    const text = `__d(function(g,r,i,a,m,e,d){e.LOCALE_PACK="${marker}";e.LOCALE_MESSAGES={}});`;
    return { url: `${WEB_JS_DIR}/${name}-${md5(text)}.js`, text };
  };
  const build = () => [{ url: START, text: 'var p=function(l){return"locale-pack:"+l};' }, ...LOCALE_CHUNKS.map((c) => localeChunk(c.name, c.marker))];

  it('names the chunks the app loads', () => {
    expect(LOCALE_CHUNKS).toEqual([
      { name: 'locale-es', marker: 'locale-pack:es' },
      { name: 'locale-ko', marker: 'locale-pack:ko' },
    ]);
    expect(ROOT_CHUNKS).toEqual([
      { name: 'PresenterApp', marker: 'root-chunk:presenter' },
      { name: 'BrowseApp', marker: 'root-chunk:browse' },
    ]);
    // [GU] Row GU-3: the guest's first quest stack.
    expect(SCREEN_CHUNKS).toEqual([{ name: 'guest-chunk', marker: 'screen-chunk:guest' }]);
  });

  it('the markers are the ones the chunk modules export', async () => {
    const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
    expect(read('PresenterApp.tsx')).toContain(`export const ROOT_CHUNK = '${ROOT_CHUNKS[0].marker}';`);
    expect(read('BrowseApp.tsx')).toContain(`export const ROOT_CHUNK = '${ROOT_CHUNKS[1].marker}';`);
    expect(read('src/content/locale-chunks/locale-es.ts')).toContain(`= '${LOCALE_CHUNKS[0].marker}';`);
    expect(read('src/content/locale-chunks/locale-ko.ts')).toContain(`= '${LOCALE_CHUNKS[1].marker}';`);
    expect(read('src/navigation/guest-chunk.tsx')).toContain(`export const SCREEN_CHUNK = '${SCREEN_CHUNKS[0].marker}';`);
    // Reached only through the literal import() of navigation/guest.tsx (a static import would pull it into the start bundle).
    expect(read('src/navigation/guest.tsx')).toContain("import('./guest-chunk')");
  });

  it('passes a build where each locale is its own precached bundle carrying its marker', () => {
    const bundles = build();
    expect(markedChunkProblems({ chunks: LOCALE_CHUNKS, bundles, precached: all(bundles).map((u) => `/${u}`) })).toEqual([]);
  });

  it('fails a missing, doubled, renamed, emptied or unprecached chunk, and a marker in the start bundle', () => {
    const [start, es, ko] = build();
    expect(markedChunkProblems({ chunks: LOCALE_CHUNKS, bundles: [start, es], precached: all([start, es]) })).toEqual(['locale-ko has no web bundle: the chunk is missing from the build']);
    // By default the grown-up roots and the learner screen chunks are checked too.
    expect(markedChunkProblems({ bundles: [start, es, ko], precached: all([start, es, ko]) })).toEqual([
      'PresenterApp has no web bundle: the chunk is missing from the build',
      'BrowseApp has no web bundle: the chunk is missing from the build',
      'guest-chunk has no web bundle: the chunk is missing from the build',
    ]);
    const other = localeChunk('locale-ko', 'locale-pack:ko ');
    expect(markedChunkProblems({ chunks: LOCALE_CHUNKS, bundles: [start, es, ko, other], precached: all([start, es, ko, other]) })).toEqual([
      `locale-ko has 2 web bundles: ${ko.url}, ${other.url}`,
      `${other.url} does not carry locale-pack:ko: it is not locale-ko's chunk (or it is empty)`,
    ]);
    const empty = { url: `${WEB_JS_DIR}/locale-ko-${md5('')}.js`, text: '' };
    expect(markedChunkProblems({ chunks: LOCALE_CHUNKS, bundles: [start, es, empty], precached: all([start, es, empty]) })).toEqual([
      `${empty.url} does not carry locale-pack:ko: it is not locale-ko's chunk (or it is empty)`,
    ]);
    const renamed = { ...ko, url: `${WEB_JS_DIR}/locale-ko-${'0'.repeat(32)}.js` };
    expect(markedChunkProblems({ chunks: LOCALE_CHUNKS, bundles: [start, es, renamed], precached: all([start, es, renamed]) })).toEqual([`${renamed.url}: its file name is not the md5 of its content`]);
    expect(markedChunkProblems({ chunks: LOCALE_CHUNKS, bundles: [start, es, ko], precached: all([start, es]) })).toEqual([`${ko.url} is missing from the precache`]);
    const pulled = { url: START, text: `${start.text}e.LOCALE_PACK='locale-pack:es';` };
    expect(markedChunkProblems({ chunks: LOCALE_CHUNKS, bundles: [pulled, es, ko], precached: all([pulled, es, ko]) })).toEqual([
      `locale-es is in the start bundle ${START}: a static import pulled it in`,
    ]);
  });

  it('the report counts the locale chunks on a line of their own', () => {
    const bundles = build();
    const root = localeChunk('PresenterApp', 'root-chunk:presenter');
    const report = precacheReport({ manifest: [], locales: LOCALE_CHUNKS, roots: ROOT_CHUNKS, bundles: [...bundles, root], precache: { count: 3, size: 99 } });
    expect(report.localeChunks.count).toBe(2);
    expect(report.localeChunks.raw).toBe(bundles[1].text.length + bundles[2].text.length);
    expect(report.rootChunks.count).toBe(1);
    const lines = reportLines(report);
    const largestLocale = Math.max(bundles[1].text.length, bundles[2].text.length);
    expect(lines[4]).toMatch(
      new RegExp(`^ {2}locale chunks {2}2 bundles {2}\\d+ B raw {2}\\d+ B gzip {2}\\(largest ${largestLocale} B raw, ceiling ${PRECACHE_BUDGET.localeChunkRaw} B each\\)$`),
    );
    expect(lines[5]).toMatch(
      new RegExp(`^ {2}grown-up root chunks {2}1 bundles {2}\\d+ B raw {2}\\d+ B gzip {2}\\(largest ${root.text.length} B raw, ceiling ${PRECACHE_BUDGET.rootChunkRaw} B each\\)$`),
    );
    expect(lines[6]).toContain('learner precache  3 files  99 B');
    expect(lessonChunkUrls(LOCALE_CHUNKS, bundles)).toEqual([bundles[1].url, bundles[2].url]);
    expect(precacheBudgetProblems(report)).toEqual([]);
  });

  it('[GU] the report counts the learner screen chunks on a line of their own, held to screenChunkRaw', () => {
    const bundles = build();
    const guest = localeChunk('guest-chunk', 'screen-chunk:guest');
    const report = precacheReport({ manifest: [], locales: LOCALE_CHUNKS, roots: ROOT_CHUNKS, screens: SCREEN_CHUNKS, bundles: [...bundles, guest], precache: { count: 4, size: 99 } });
    expect(report.screenChunks.count).toBe(1);
    expect(reportLines(report).find((line) => line.includes('learner screen chunks'))).toMatch(
      new RegExp(`^ {2}learner screen chunks {2}1 bundles {2}\\d+ B raw {2}\\d+ B gzip {2}\\(largest ${guest.text.length} B raw, ceiling ${PRECACHE_BUDGET.screenChunkRaw} B each\\)$`),
    );
    expect(precacheBudgetProblems(report)).toEqual([]);
    const tight = { ...PRECACHE_BUDGET, screenChunkRaw: guest.text.length - 1 };
    expect(precacheBudgetProblems(report, tight)).toEqual([
      expect.stringMatching(new RegExp(`^the learner screen bundle ${guest.url} is ${guest.text.length} B raw, over the per-learner screen ceiling .*raise PRECACHE_BUDGET\\.screenChunkRaw`)),
    ]);
    // Without screen chunks (an older caller) the report has none and prints no line.
    expect(reportLines(precacheReport({ manifest: [], bundles, precache: { count: 1, size: 1 } })).some((line) => line.includes('screen chunks'))).toBe(false);
    expect(lessonChunkUrls(SCREEN_CHUNKS, [...bundles, guest])).toEqual([guest.url]);
  });

  it('[GU] the screen chunk line sits over the guest stack measured with GU-3 (7,281 B raw) with room for GU-4', () => {
    expect(PRECACHE_BUDGET.screenChunkRaw).toBe(60_000);
    expect(PRECACHE_BUDGET.screenChunkRaw).toBeGreaterThan(7_281);
  });

  it('holds each locale chunk and each grown-up root chunk to its own line, which a Spanish or Korean first screen waits on', () => {
    const lines = { ...PRECACHE_BUDGET, localeChunkRaw: 100, rootChunkRaw: 50 };
    const ko = `${WEB_JS_DIR}/locale-ko-${md5('ko')}.js`;
    const presenter = `${WEB_JS_DIR}/PresenterApp-${md5('p')}.js`;
    const report = {
      start: { url: START, raw: 1, gzip: 1 },
      lessonChunks: { count: 0, raw: 0, gzip: 0, largest: null },
      localeChunks: { count: 2, raw: 180, gzip: 20, largest: { url: ko, raw: 101 } },
      rootChunks: { count: 2, raw: 90, gzip: 10, largest: { url: presenter, raw: 51 } },
      precache: { count: 5, raw: 272 },
    };
    expect(precacheBudgetProblems(report, lines)).toEqual([
      expect.stringMatching(new RegExp(`^the locale bundle ${ko} is 101 B raw, over the per-locale ceiling of 100 B .*raise PRECACHE_BUDGET\\.localeChunkRaw`)),
      expect.stringMatching(new RegExp(`^the grown-up root bundle ${presenter} is 51 B raw, over the per-grown-up root ceiling of 50 B .*raise PRECACHE_BUDGET\\.rootChunkRaw`)),
    ]);
    const atLine = { ...report, localeChunks: { ...report.localeChunks, largest: { url: ko, raw: 100 } }, rootChunks: { ...report.rootChunks, largest: { url: presenter, raw: 50 } } };
    expect(precacheBudgetProblems(atLine, lines)).toEqual([]);
  });

  it('the locale chunk line sits over the largest measured chunk (ko, 905,927 B) and the root line over the presenter (245,964 B)', () => {
    // F-CURR-002 §10 ceilings table: measured at the start bundle shrink (ko 901,191 B, es 527,438 B, BrowseApp
    // 111,404 B raw) and again on the final integration's strings (main fc580beed: ko 905,927 B, es 530,463 B raw).
    expect(PRECACHE_BUDGET.localeChunkRaw).toBe(1_000_000);
    expect(PRECACHE_BUDGET.localeChunkRaw).toBeGreaterThan(905_927);
    expect(PRECACHE_BUDGET.rootChunkRaw).toBe(300_000);
    expect(PRECACHE_BUDGET.rootChunkRaw).toBeGreaterThan(245_964);
  });
});

describe('precacheReport and its budget lines', () => {
  it('measures the start bundle, the lesson chunks and the learner precache', () => {
    const bundles = sound();
    const report = precacheReport({ manifest: MANIFEST, bundles, precache: { count: 9, size: 1234 } });
    expect(report.start).toEqual({ url: START, raw: startText.length, gzip: expect.any(Number) });
    expect(report.lessonChunks.count).toBe(2);
    expect(report.lessonChunks.raw).toBe(bundles[1].text.length + bundles[2].text.length);
    expect(report.precache).toEqual({ count: 9, raw: 1234 });
    const lines = reportLines(report);
    expect(lines[0]).toBe('pwa-postbuild: precache report (F-CURR-002 §10)');
    expect(lines[1]).toContain(`start bundle  ${START}  ${startText.length} B raw`);
    expect(lines[1]).toContain(`(ceiling ${PRECACHE_BUDGET.startBundleRaw} B raw)`);
    expect(lines[2]).toMatch(/^ {2}lesson chunks {2}2 bundles {2}\d+ B raw {2}\d+ B gzip$/);
    expect(lines[3]).toBe('  story chunks  0 bundles  0 B raw  0 B gzip');
    expect(lines[4]).toBe(`  learner precache  9 files  1234 B  (ceiling ${PRECACHE_BUDGET.learnerPrecacheRaw} B)`);
    expect(precacheBudgetProblems(report)).toEqual([]);
  });

  it('fails a start bundle that grew and a precache over its line (CM-5B is then triggered)', () => {
    const report = {
      start: { url: START, raw: PRECACHE_BUDGET.startBundleRaw + 1, gzip: 1 },
      lessonChunks: { count: 0, raw: 0, gzip: 0 },
      precache: { count: 1, raw: PRECACHE_BUDGET.learnerPrecacheRaw + 1 },
    };
    expect(precacheBudgetProblems(report)).toEqual([
      expect.stringMatching(
        new RegExp(`^the start bundle is ${PRECACHE_BUDGET.startBundleRaw + 1} B raw, over its ceiling of ${PRECACHE_BUDGET.startBundleRaw} B: it must not grow .*raise PRECACHE_BUDGET\\.startBundleRaw`),
      ),
      `the learner precache is ${PRECACHE_BUDGET.learnerPrecacheRaw + 1} B, over its ceiling of ${PRECACHE_BUDGET.learnerPrecacheRaw} B: row CM-5B (Save for offline) is triggered`,
    ]);
    expect(precacheBudgetProblems({ ...report, start: null, precache: { count: 0, raw: 0 } })).toEqual(['no start bundle to measure']);
    // A report without the story line (as CM-5 built it) prints the others.
    expect(reportLines({ ...report, start: null })).toHaveLength(3);
  });

  it('the start bundle line is its size after the start bundle shrink with a small margin, under every earlier size; the precache line is the CM-5 measurement plus 2.5 MB', () => {
    // F-CURR-002 §10: 8,321,783 B raw before CM-5, 7,337,815 B after CM-5, 6,345,469 B measured after CM-8,
    // 6,371,165 B on the phase-0 integration (#802), 6,487,010 B with [OA] the one-account integration (#801),
    // 6,495,837 B with the SN-2 site strings in the bundled `landing` messages (#804, app-host build), 6,518,688 B on
    // the final integration of OA-7b (#798), SN-1 (#813) and SN-2 (#804) (integrate/final-oa-site, release build),
    // 4,712,987 B after the start bundle shrink on main 7eb5bad61 (the es / ko text and the grown-up roots became
    // precached chunks; 6,491,546 B on its main), 4,732,797 B with that shrink merged onto the final integration
    // (main fc580beed, release build), 4,744,234 B with [GU] the always-on guest rules (GU-2, release build), 4,754,165 B with the guest's launch and Welcome card (GU-3). The margin stays under 10 KB, so the stories, the locale text, the grown-up
    // roots (or anything else) cannot come back into the start bundle unseen. This pins the line only;
    // `build:web --budget` (pwa-postbuild.mjs, run by CI's web-app job) measures the real start bundle against it.
    expect(PRECACHE_BUDGET.startBundleRaw).toBe(4_760_000);
    expect(PRECACHE_BUDGET.startBundleRaw - 4_754_165).toBeGreaterThanOrEqual(0);
    expect(PRECACHE_BUDGET.startBundleRaw - 4_754_165).toBeLessThan(10_000);
    expect(PRECACHE_BUDGET.startBundleRaw).toBeLessThan(6_518_688);
    expect(PRECACHE_BUDGET.learnerPrecacheRaw).toBe(8_787_329 + 2_500_000);
  });

  it('the budget only warns on the deploy build (Cloudflare Workers Builds or Pages), and fails everywhere else', () => {
    expect(budgetIsAdvisory({ WORKERS_CI: '1' })).toBe(true);
    expect(budgetIsAdvisory({ CF_PAGES: '1' })).toBe(true);
    expect(budgetIsAdvisory({ CI: 'true', GITHUB_ACTIONS: 'true' })).toBe(false);
    expect(budgetIsAdvisory({})).toBe(false);
  });
});

describe('nosniffLessonChunks', () => {
  const urls = lessonChunkUrls(MANIFEST, sound());

  it('lists the lesson chunk bundles of a build, not the start bundle', () => {
    expect(urls).toHaveLength(MANIFEST.length);
    expect(urls.every((u) => /^_expo\/static\/js\/web\/lessons-/.test(u))).toBe(true);
  });

  it('passes the shipped rules: public/_headers plus the grown-up block merge-console.mjs appends', () => {
    const shipped = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');
    expect(nosniffLessonChunks(`${shipped}\n${grownUpHeadersBlock(GROWN_UP_PREFIXES)}`, urls)).toEqual([]);
  });

  it('fails a rule that would serve the chunks with nosniff, so a chunk request of an older build keeps reaching the reload', () => {
    expect(nosniffLessonChunks('/*\n  X-Content-Type-Options: nosniff\n', urls)).toEqual(urls);
    expect(nosniffLessonChunks('/_expo/*\n  X-Content-Type-Options: nosniff\n', urls)).toEqual(urls);
    expect(nosniffLessonChunks('/teach/*\n  X-Content-Type-Options: nosniff\n', urls)).toEqual([]);
    expect(nosniffLessonChunks('/*\n  X-Content-Type-Options: nosniff\n/_expo/*\n  ! X-Content-Type-Options\n', urls)).toEqual([]);
    expect(nosniffLessonChunks('', urls)).toEqual([]);
  });
});
