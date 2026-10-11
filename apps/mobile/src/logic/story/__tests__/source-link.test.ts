import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { buildSourcesView } from '../sources-view';
import {
  findSourceLink,
  isSafeHttpsUrl,
  linkOpenedPayload,
  openLinkNote,
  openLinkStep,
  pendingLinkStep,
  sourcesOpenedPayload,
  sourcesRouteParams,
  sourcesTarget,
} from '../source-link';
import { readyStory } from './story-fixture';

const copy = getMessages('en').learner.story.sources;

describe('isSafeHttpsUrl: only a plain https: link may reach the browser (§3.8)', () => {
  it.each([
    'https://sillok.history.go.kr/id/kca_10001001_001',
    'https://www.heritage.go.kr/main/?v=1&a=b#top',
    'https://example.org',
    'HTTPS://EXAMPLE.ORG/A',
  ])('accepts %s', (url) => expect(isSafeHttpsUrl(url)).toBe(true));

  it.each([
    'http://example.org',
    'javascript:alert(1)',
    'data:text/html,hi',
    'https://',
    'https:///path',
    'https://user:pw@example.org/',
    'https://exa mple.org',
    'https://example.org/\nnext',
    ' https://example.org',
    '//example.org',
    'file:///etc/passwd',
    'intent://x#Intent;end',
    '',
  ])('refuses %j', (url) => expect(isSafeHttpsUrl(url)).toBe(false));
});

describe("findSourceLink: the story's own sources, nothing else", () => {
  const story = readyStory();
  const first = story.facts[0]!;
  const url = first.sources[0]!.url;

  it('finds the fact a source link belongs to', () => {
    expect(findSourceLink(story, url)).toEqual({ url, factId: first.id });
  });

  it('the first fact that cites a shared link wins', () => {
    const shared = readyStory();
    shared.facts[1]!.sources.push({ ...shared.facts[0]!.sources[0]! });
    expect(findSourceLink(shared, shared.facts[0]!.sources[0]!.url)?.factId).toBe(shared.facts[0]!.id);
  });

  it('refuses a link the story does not cite, even a safe one', () => {
    expect(findSourceLink(story, 'https://example.org/elsewhere')).toBeNull();
  });

  it('refuses a cited link that is not https: (re-checked, never trusted)', () => {
    const bad = readyStory();
    bad.facts[0]!.sources[0] = { ...bad.facts[0]!.sources[0]!, url: 'http://insecure.example.org/a' };
    expect(findSourceLink(bad, 'http://insecure.example.org/a')).toBeNull();
  });

  it('refuses with no story', () => {
    expect(findSourceLink(undefined, url)).toBeNull();
  });
});

describe('the gate: Open link is a grown-up action (§3.8, §3.14 #3)', () => {
  it('opens directly where the gate opens directly, else asks for the PIN', () => {
    expect(openLinkStep(true)).toBe('open');
    expect(openLinkStep(false)).toBe('gate');
  });

  it('a link waiting on the gate opens on return only once the gate is through', () => {
    expect(pendingLinkStep(null, true)).toBe('none');
    expect(pendingLinkStep(null, false)).toBe('none');
    expect(pendingLinkStep({ url: 'https://a.example', factId: 'f1' }, true)).toBe('open');
    expect(pendingLinkStep({ url: 'https://a.example', factId: 'f1' }, false)).toBe('drop');
  });
});

describe('openLinkNote: what shows after a hand-off', () => {
  const url = 'https://example.org/a';

  it('nothing after a successful hand-off', () => {
    expect(openLinkNote('opened', url, copy)).toBeNull();
  });

  it('a refused or failed hand-off shows the link to open in a browser', () => {
    expect(openLinkNote('failed', url, copy)).toBe('Open this link in a browser: https://example.org/a');
  });

  it('offline says a connection is needed, then the link', () => {
    expect(openLinkNote('offline', url, copy)).toBe(
      'Opening a link needs a connection. Open this link in a browser: https://example.org/a',
    );
  });
});

describe('telemetry payloads (§3.12): ids only', () => {
  it('story.sources.opened carries where it came from and the fact only when there is one', () => {
    expect(sourcesOpenedPayload('story:hangul-day', 'reader')).toEqual({ storyId: 'story:hangul-day', from: 'reader' });
    expect(sourcesOpenedPayload('story:hangul-day', 'scene', 'f3')).toEqual({ storyId: 'story:hangul-day', from: 'scene', factId: 'f3' });
  });

  it('story.sources.link_opened carries the story and the fact', () => {
    expect(linkOpenedPayload('story:hangul-day', 'f2')).toEqual({ storyId: 'story:hangul-day', factId: 'f2' });
  });
});

describe('sourcesRouteParams: from the reader', () => {
  it('the top bar opens Sources at the scene being read', () => {
    expect(sourcesRouteParams('story:a', 'reader', 3)).toEqual({ storyId: 'story:a', from: 'reader', sceneIndex: 3 });
  });

  it('the end page opens Sources at the top', () => {
    expect(sourcesRouteParams('story:a', 'end', 4)).toEqual({ storyId: 'story:a', from: 'end' });
  });
});

describe('sourcesTarget: deep links (§3.8)', () => {
  const v = buildSourcesView(readyStory());

  it('a fact id scrolls to and highlights its card', () => {
    expect(sourcesTarget(v, { factId: 'f3' })).toEqual({ section: 2, highlightFactId: 'f3' });
  });

  it('an unknown fact id falls back to the scene, then to nothing', () => {
    expect(sourcesTarget(v, { factId: 'f99', sceneIndex: 1 })).toEqual({ section: 1, highlightFactId: null });
    expect(sourcesTarget(v, { factId: 'f99' })).toBeNull();
  });

  it("a scene index scrolls to that scene's section without a highlight", () => {
    expect(sourcesTarget(v, { sceneIndex: 3 })).toEqual({ section: 3, highlightFactId: null });
  });

  it('the first scene and no params stay at the top', () => {
    expect(sourcesTarget(v, { sceneIndex: 0 })).toBeNull();
    expect(sourcesTarget(v, {})).toBeNull();
    expect(sourcesTarget(v, { sceneIndex: 99 })).toBeNull();
  });
});
