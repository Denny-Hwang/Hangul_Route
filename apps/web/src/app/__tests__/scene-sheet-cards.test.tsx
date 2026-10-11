import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ScenesPreviewPage from '../(console)/design-preview/scenes/page';

/**
 * F-STORY-002 §3.9.4: the web renderer can only mark where a `card:` layer
 * sits, so the contact sheet says in words that the card is shown in the app.
 */
vi.mock('../../lib/scene-sheet/read-stories', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/scene-sheet/read-stories')>();
  const story = JSON.parse(readFileSync(join(real.storiesDir(), 'sillok-royal-historians.json'), 'utf8')) as {
    tiers: Array<{ scenes: Array<Record<string, unknown>> }>;
  };
  for (const scene of story.tiers[0]!.scenes) {
    delete scene.art;
    scene.artPending = true;
  }
  const s2 = story.tiers[0]!.scenes[1]!;
  delete s2.artPending;
  s2.art = {
    setting: 'scene:palace-hall',
    layers: [
      { ref: 'prop:fig-king', x: 200, y: 186, s: 0.9 },
      { ref: 'card:hangul-day', x: 330, y: 200 },
    ],
    altEn: 'The king in a palace hall, with a heritage card at the side',
  };
  return { ...real, readStoryFiles: () => [{ file: 'sillok-royal-historians.json', json: story }] };
});

describe('/design-preview/scenes: card layers', () => {
  // vi.mock is hoisted above the imports, so the page reads the mocked story
  it('labels a card layer in visible text beside the picture', () => {
    const html = renderToStaticMarkup(<ScenesPreviewPage />);
    expect(html).toMatch(/data-card-note[^>]*>card:hangul-day — shown in the app</);
    expect(html.match(/data-card-note/g)).toHaveLength(1);
  });
});
