import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCENE_ART_REGISTRY } from '@hangul-route/design-system/scene-art';
import { describe, expect, it } from 'vitest';
import { readStoryFiles, storiesDir, type StoryFile } from '../read-stories';
import { buildSceneSheet } from '../sheet';

const TODAY = '2026-10-11';
const raw = (name: string): Record<string, unknown> => JSON.parse(readFileSync(join(storiesDir(), name), 'utf8')) as Record<string, unknown>;

interface RawScene {
  id: string;
  art?: unknown;
  artPending?: boolean;
}
const scenesOf = (story: Record<string, unknown>): RawScene[] => (story.tiers as Array<{ scenes: RawScene[] }>)[0]!.scenes;

/** sillok-royal-historians with art on s2 (the spec's worked example) and s3 pending. */
function historians(): Record<string, unknown> {
  const story = raw('sillok-royal-historians.json');
  const scenes = scenesOf(story);
  scenes[1]!.art = {
    setting: 'scene:palace-hall',
    layers: [
      { ref: 'prop:fig-king', x: 200, y: 186, s: 0.9 },
      { ref: 'prop:fig-official', x: 90, y: 256 },
      { ref: 'prop:fig-historian', x: 330, y: 292, s: 1.1, flip: true, z: 'front' },
    ],
    altEn: 'The king on a raised seat in a palace hall, an official below and a historian writing at the side',
  };
  scenes[2]!.artPending = true;
  return story;
}

describe('buildSceneSheet', () => {
  const files: StoryFile[] = [{ file: 'sillok-royal-historians.json', json: historians() }];
  const sheet = buildSceneSheet(files, SCENE_ART_REGISTRY, { today: TODAY });
  const story = sheet.stories[0]!;

  it('makes one section per story with its title, state, kind, origin and verification passes', () => {
    expect(sheet.stories).toHaveLength(1);
    expect(story).toMatchObject({
      file: 'sillok-royal-historians.json',
      id: 'story:sillok-royal-historians',
      titleEn: 'Hoya Meets the Royal Historians',
      titleKo: '호야, 사관을 만나다',
      state: 'draft',
      kind: 'documentary',
      origin: 'documented',
      passes: 3,
      theme: 'letters',
    });
  });

  it('makes one row per scene with the brief verbatim and the layers table', () => {
    expect(story.scenes.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7']);
    const s2 = story.scenes[1]!;
    expect(s2.brief).toBe((scenesOf(historians())[1] as unknown as { artBrief: string }).artBrief);
    expect(s2.brief).toMatch(/^A Joseon palace hall/);
    expect(s2.art?.setting).toBe('scene:palace-hall');
    expect(s2.layers).toEqual([
      { ref: 'prop:fig-king', x: 200, y: 186, s: 0.9, z: 'mid' },
      { ref: 'prop:fig-official', x: 90, y: 256, s: 1, z: 'mid' },
      { ref: 'prop:fig-historian', x: 330, y: 292, s: 1.1, z: 'front' },
    ]);
    expect(story.scenes[0]!.layers).toEqual([]);
    expect(story.scenes[2]!.artPending).toBe(true);
    expect(story.scenes[0]!.artPending).toBe(false);
  });

  it('splits narration into text and keyword chips with romanization and gloss', () => {
    const s2 = story.scenes[1]!;
    expect(s2.narration[0]).toEqual({ kind: 'text', text: 'These officials were the ' });
    expect(s2.narration[1]).toEqual({ kind: 'kw', ko: '사관', romanization: 'sagwan', en: 'royal historian' });
    expect(s2.narration.filter((p) => p.kind === 'text').map((p) => (p.kind === 'text' ? p.text : '')).join('')).not.toMatch(/[가-힣]/);
  });

  it('lists the cited facts with their claims and source titles (the claims audit)', () => {
    const s2 = story.scenes[1]!;
    expect(s2.facts.map((f) => f.id)).toEqual(['f2']);
    expect(s2.facts[0]!.claimEn.length).toBeGreaterThan(10);
    expect(s2.facts[0]!.sources.length).toBeGreaterThan(0);
    for (const title of s2.facts[0]!.sources) expect(title.length).toBeGreaterThan(0);
  });

  it('attaches checkScene findings to the scene that has art and lint findings to the scene they point at', () => {
    const s2 = story.scenes[1]!;
    expect(s2.findings.every((f) => f.source === 'art' || f.source === 'lint')).toBe(true);
    expect(s2.findings.filter((f) => f.source === 'art' && f.severity === 'error')).toEqual([]);
    // a scene without art gets no art findings
    expect(story.scenes[0]!.findings.filter((f) => f.source === 'art')).toEqual([]);
  });

  it('reports unresolved refs as art errors', () => {
    const broken = historians();
    (scenesOf(broken)[1]!.art as { layers: Array<{ ref: string }> }).layers[0]!.ref = 'prop:fig-emperor';
    const s = buildSceneSheet([{ file: 'x.json', json: broken }], SCENE_ART_REGISTRY, { today: TODAY });
    expect(s.stories[0]!.scenes[1]!.findings).toContainEqual(expect.objectContaining({ source: 'art', rule: 'S-resolve', severity: 'error' }));
    expect(s.counts.errors).toBeGreaterThan(0);
  });

  it('keeps story-level lint findings on the story', () => {
    const noted = historians();
    (noted.facts as Array<{ sources: Array<{ url: string }> }>)[0]!.sources[0]!.url = 'http://theme.archives.go.kr/next/silloc/archiveGuard.do';
    const s = buildSceneSheet([{ file: 'x.json', json: noted }], SCENE_ART_REGISTRY, { today: TODAY });
    expect(s.stories[0]!.findings).toContainEqual(expect.objectContaining({ source: 'lint', rule: 'source-url-not-https', path: expect.stringMatching(/^facts\[0\]/) }));
    for (const f of s.stories[0]!.findings) expect(f.path ?? '').not.toMatch(/^tiers\[\d+\]\.scenes\[\d+\]/);
  });

  it('counts stories, scenes, art, pending, drafts and findings', () => {
    const all = [...story.findings, ...story.scenes.flatMap((sc) => sc.findings)];
    expect(sheet.counts).toEqual({
      stories: 1,
      scenes: 7,
      withArt: 1,
      artPending: 1,
      draft: 1,
      errors: all.filter((f) => f.severity === 'error').length,
      warnings: all.filter((f) => f.severity === 'warning').length,
    });
  });

  it('lists a file that does not parse as a failure and counts it as an error', () => {
    const s = buildSceneSheet(
      [
        { file: 'bad.json', json: undefined, error: 'Unexpected token in JSON' },
        { file: 'wrong.json', json: { id: 'story:wrong' } },
      ],
      SCENE_ART_REGISTRY,
      { today: TODAY },
    );
    expect(s.stories).toEqual([]);
    expect(s.failed.map((f) => f.file)).toEqual(['bad.json', 'wrong.json']);
    expect(s.failed[0]!.message).toBe('Unexpected token in JSON');
    expect(s.failed[1]!.message.length).toBeGreaterThan(0);
    expect(s.counts).toMatchObject({ stories: 0, scenes: 0, errors: 2 });
  });

  it('falls back to the raw narration when a token names no keyword', () => {
    const odd = historians();
    (scenesOf(odd)[0] as unknown as { narrationEn: string }).narrationEn = 'Hoya meets the {kw:nobody}.';
    const s = buildSceneSheet([{ file: 'x.json', json: odd }], SCENE_ART_REGISTRY, { today: TODAY });
    expect(s.stories[0]!.scenes[0]!.narration).toEqual([{ kind: 'text', text: 'Hoya meets the {kw:nobody}.' }]);
  });

  it('labels card layers as mid unless told otherwise, and unknown props by their own z', () => {
    const carded = historians();
    const art = scenesOf(carded)[1]!.art as { layers: Array<Record<string, unknown>> };
    art.layers.push({ ref: 'card:hangul-day', x: 60, y: 200 }, { ref: 'prop:unknown-thing', x: 100, y: 200 });
    const s = buildSceneSheet([{ file: 'x.json', json: carded }], SCENE_ART_REGISTRY, { today: TODAY });
    expect(s.stories[0]!.scenes[1]!.layers.slice(-2)).toEqual([
      { ref: 'card:hangul-day', x: 60, y: 200, s: 1, z: 'mid' },
      { ref: 'prop:unknown-thing', x: 100, y: 200, s: 1, z: '?' },
    ]);
  });

  it('puts every lint finding of one scene on that scene', () => {
    const twice = historians();
    (scenesOf(twice)[0] as unknown as { narrationEn: string }).narrationEn = 'Hangeul was written by ninety officials.';
    const s = buildSceneSheet([{ file: 'x.json', json: twice }], SCENE_ART_REGISTRY, { today: TODAY });
    const lint = s.stories[0]!.scenes[0]!.findings.filter((f) => f.source === 'lint');
    expect(lint.map((f) => f.rule).sort()).toEqual(['narration-number-word-unmatched', 'style-script-name']);
    for (const f of lint) expect(f.path).toMatch(/^tiers\[0\]\.scenes\[0\]/);
  });

  it('leaves the brief out of a scene that has none', () => {
    const bare = historians();
    delete (scenesOf(bare)[3] as unknown as { artBrief?: string }).artBrief;
    const s = buildSceneSheet([{ file: 'x.json', json: bare }], SCENE_ART_REGISTRY, { today: TODAY });
    expect(s.stories[0]!.scenes[3]!.brief).toBeUndefined();
    expect('brief' in s.stories[0]!.scenes[3]!).toBe(false);
  });

  it('lints against the current date when no date is given', () => {
    const s = buildSceneSheet([{ file: 'x.json', json: historians() }], SCENE_ART_REGISTRY);
    expect(s.stories).toHaveLength(1);
  });

  it('builds a section for every real story file without a parse failure', () => {
    const real = readStoryFiles();
    const s = buildSceneSheet(real, SCENE_ART_REGISTRY, { today: TODAY });
    expect(s.failed).toEqual([]);
    expect(s.counts.stories).toBe(real.length);
    expect(s.counts.scenes).toBe(s.stories.reduce((n, st) => n + st.scenes.length, 0));
  });
});
