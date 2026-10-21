// F-CURR-002 §10 (row CM-5): the lesson chunk checks and the precache report of pwa-postbuild.mjs.
import { describe, expect, it } from 'vitest';
import {
  PRECACHE_BUDGET,
  WEB_JS_DIR,
  isStartBundle,
  lessonChunkProblems,
  md5,
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

  it('counts the story chunks apart from the lesson chunks in the report', () => {
    const bundles = withStory();
    const report = precacheReport({ manifest: MANIFEST, stories: STORIES, bundles, precache: { count: 4, size: 99 } });
    expect(report.lessonChunks.count).toBe(2);
    expect(report.storyChunks).toEqual({ count: 1, raw: bundles[3].text.length, gzip: expect.any(Number) });
    const lines = reportLines(report);
    expect(lines[3]).toMatch(/^ {2}story chunks {2}1 bundles {2}\d+ B raw {2}\d+ B gzip$/);
    expect(lines).toHaveLength(5);
    // Without a story manifest the story line counts none.
    expect(precacheReport({ manifest: MANIFEST, bundles, precache: { count: 4, size: 99 } }).storyChunks.count).toBe(0);
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
      `the start bundle is ${PRECACHE_BUDGET.startBundleRaw + 1} B raw, over its ceiling of ${PRECACHE_BUDGET.startBundleRaw} B: it must not grow`,
      `the learner precache is ${PRECACHE_BUDGET.learnerPrecacheRaw + 1} B, over its ceiling of ${PRECACHE_BUDGET.learnerPrecacheRaw} B: row CM-5B (Save for offline) is triggered`,
    ]);
    expect(precacheBudgetProblems({ ...report, start: null, precache: { count: 0, raw: 0 } })).toEqual(['no start bundle to measure']);
    // A report without the story line (as CM-5 built it) prints the others.
    expect(reportLines({ ...report, start: null })).toHaveLength(3);
  });

  it('the start bundle line is the size before CM-8 (after CM-5), so it shrank; the precache line is the CM-5 measurement plus 2.5 MB', () => {
    // F-CURR-002 §10: 8,321,783 B raw before CM-5, 7,331,204 B after CM-5 (the line now), 6,336,255 B measured after CM-8.
    expect(PRECACHE_BUDGET.startBundleRaw).toBe(7_331_204);
    expect(PRECACHE_BUDGET.startBundleRaw).toBeLessThan(8_321_783);
    expect(6_336_255).toBeLessThan(PRECACHE_BUDGET.startBundleRaw);
    expect(PRECACHE_BUDGET.learnerPrecacheRaw).toBe(8_780_718 + 2_500_000);
  });
});
