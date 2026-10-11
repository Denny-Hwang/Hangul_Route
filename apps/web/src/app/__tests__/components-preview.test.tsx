import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ComponentsPreviewPage from '../design-preview/components/page';

/**
 * F-STORY-002 §5 (visual regression, F-VR-001): /design-preview/components
 * shows `StoryScene` (its web renderer, `SceneSvg`) at the three art sizes and
 * the tinted fallback panel, beside every other design-system component.
 */
const section = (html: string): string => {
  const start = html.indexOf('<section id="story-scene"');
  expect(start).toBeGreaterThan(-1);
  return html.slice(start, html.indexOf('</section>', start));
};
const svgs = (html: string): string[] => html.match(/<svg[^>]*data-state="[a-z]+"[^>]*>/g) ?? [];

describe('/design-preview/components: StoryScene', () => {
  const html = section(renderToStaticMarkup(<ComponentsPreviewPage />));

  it('draws a registry scene at 320, at 96 and as the thumb variant', () => {
    const scenes = svgs(html).filter((s) => s.includes('data-state="scene"'));
    expect(scenes.map((s) => /width="(\d+)"/.exec(s)?.[1])).toEqual(['320', '96', '96']);
    expect(scenes.every((s) => s.includes('viewBox="0 0 400 300"'))).toBe(true);
    expect(html).toContain('full 320');
    expect(html).toContain('full 96');
    expect(html).toContain('thumb 96');
  });

  it('the thumb variant drops detail shapes, so it draws fewer than the full picture at the same width', () => {
    const blocks = html.split('<svg').slice(1).filter((b) => b.includes('data-state="scene"'));
    const shapes = (b: string): number => (b.slice(0, b.indexOf('</svg>')).match(/<(rect|circle|ellipse|path|polygon|line)\b/g) ?? []).length;
    expect(shapes(blocks[2]!)).toBeLessThan(shapes(blocks[1]!));
  });

  it('shows the tinted fallback panel for a scene with no art', () => {
    const fallbacks = svgs(html).filter((s) => s.includes('data-state="fallback"'));
    expect(fallbacks.length).toBeGreaterThanOrEqual(2);
    expect(fallbacks.map((s) => /width="(\d+)"/.exec(s)?.[1])).toEqual(expect.arrayContaining(['320', '96']));
    expect(html).toContain('fallback');
  });

  it('draws no image, text element or emoji', () => {
    expect(html).not.toMatch(/<image|<text|<img/);
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
