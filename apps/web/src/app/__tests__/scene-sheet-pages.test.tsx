import { HOYA_POSES, SCENE_ART_REGISTRY } from '@hangul-route/design-system/scene-art';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SheetView } from '../../components/design-preview/SheetView';
import { readStoryFiles } from '../../lib/scene-sheet/read-stories';
import ScenesPreviewPage, { metadata as scenesMeta } from '../design-preview/scenes/page';
import SceneLibraryPage, { metadata as libraryMeta } from '../design-preview/scenes/library/page';

/**
 * F-STORY-002 §3.9.6: the contact sheet and the library page, server-rendered
 * the way `next build` writes them. The browser smoke is e2e/scene-sheet.spec.ts.
 */
const count = (html: string, attr: string): number => html.split(attr).length - 1;
const stat = (html: string, id: string): string => new RegExp(`data-testid="${id}"[^>]*>([^<]*)<`).exec(html)?.[1] ?? '';

describe('/design-preview/scenes', () => {
  const html = renderToStaticMarkup(<ScenesPreviewPage />);
  const files = readStoryFiles();
  const scenes = files.reduce((n, f) => n + (f.json as { tiers: Array<{ scenes: unknown[] }> }).tiers.reduce((m, t) => m + t.scenes.length, 0), 0);

  it('renders one section per story file and one row per scene', () => {
    expect(count(html, 'data-testid="story-section"')).toBe(files.length);
    expect(count(html, 'data-testid="scene-row"')).toBe(scenes);
    expect(stat(html, 'count-stories')).toBe(String(files.length));
    expect(stat(html, 'count-scenes')).toBe(String(scenes));
  });

  it('draws every scene as an svg picture or the tinted fallback, never an image or text element', () => {
    expect(count(html, 'data-state="scene"') + count(html, 'data-state="fallback"')).toBe(scenes);
    expect(html).not.toMatch(/<image|<text|<img/);
  });

  it('prints the review checklist and links back to the design preview and on to the library', () => {
    expect(html).toContain('Review checklist');
    expect(html).toContain('href="/design-preview"');
    expect(html).toContain('href="/design-preview/scenes/library"');
  });

  it('has no emoji and is not indexed', () => {
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(scenesMeta.robots).toEqual({ index: false, follow: false });
  });

  it('keeps the heading order: story h2, then the cell labels as h3', () => {
    expect(html).not.toContain('<h4');
    expect(count(html, '<h3')).toBe(scenes * 4);
  });
});

describe('/design-preview/scenes/library', () => {
  const html = renderToStaticMarkup(<SceneLibraryPage />);
  const entries = Object.keys(SCENE_ART_REGISTRY);

  it('lists every setting and prop with three drawings each', () => {
    const library = entries.filter((id) => !id.startsWith('hoya:'));
    expect(count(html, 'data-testid="library-item"')).toBe(library.length);
    for (const id of library) expect(html).toContain(`data-item="${id}"`);
    expect(stat(html, 'count-settings')).toBe(String(library.filter((id) => id.startsWith('scene:')).length));
  });

  it('shows the five Hoya poses beside the shipped Hoya', () => {
    expect(count(html, 'data-testid="hoya-pose"')).toBe(5);
    // each data-port drawing sits beside the shipped pose of the same id
    const pairs = [...html.matchAll(/data-testid="hoya-pose" data-item="hoya:([a-z]+)" data-pose="([a-z]+)"/g)];
    expect(pairs).toHaveLength(5);
    for (const [, id, pose] of pairs) expect(pose).toBe(id);
    for (const pose of HOYA_POSES) {
      expect(html).toContain(`data-pose="${pose}"`);
      expect(html).toContain(`aria-label="Hoya ${pose}"`);
    }
  });

  it('reports no item errors for the shipped registry, has no emoji and is not indexed', () => {
    expect(stat(html, 'count-errors')).toBe('0');
    expect(html).not.toMatch(/<image|<text|<img/);
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(libraryMeta.robots).toEqual({ index: false, follow: false });
  });
});

describe('SheetView', () => {
  it('opens on the review rows and draws no thumbnails until asked', () => {
    const html = renderToStaticMarkup(<SheetView rows={<p>rows here</p>} thumbs={[{ id: 'story:x', titleEn: 'X', theme: 'letters', scenes: [{ key: 'k', id: 's1' }] }]} />);
    expect(html).toContain('data-sheet-mode="rows"');
    expect(html).toContain('rows here');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('scene-thumb');
  });
});
