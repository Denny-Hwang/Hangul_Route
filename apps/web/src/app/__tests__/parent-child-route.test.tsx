import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { mockFamily } from '@/data/mock-family';
import ChildDetailPage, { dynamicParams, generateStaticParams } from '../(console)/parent/[childId]/page';
import ParentPage from '../(console)/parent/page';

/**
 * Issue #237 (F-CONSOLE-001 §3.7): the /parent dashboard links, the statically exported
 * child pages and the child page lookup must agree. Before the fix the export wrote
 * `parent/profile:mina.html` holding the 404 page, because the param arrived as
 * `profile%3Amina` and the lookup compared it with the raw id.
 */
const textOf = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
/** Next 14 tags `notFound()` with digest `NEXT_NOT_FOUND`; Next 15 uses `NEXT_HTTP_ERROR_FALLBACK;404`. */
const isNotFound = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  const digest = String((error as { digest?: unknown }).digest ?? '');
  return digest.startsWith('NEXT_NOT_FOUND') || digest.endsWith(';404');
};
const render = (childId: string): string => renderToStaticMarkup(<ChildDetailPage params={{ childId }} />);

describe('/parent/[childId] static export (issue #237)', () => {
  const profiles = mockFamily().profiles;
  const params = generateStaticParams().map((p) => p.childId);

  it('exports exactly one colon-free, URL-safe page per demo child', () => {
    expect(dynamicParams).toBe(false);
    expect(params).toHaveLength(profiles.length);
    for (const param of params) {
      expect(param).not.toContain(':');
      expect(encodeURIComponent(param)).toBe(param);
    }
  });

  it('the dashboard links to exactly the exported pages', () => {
    const hrefs = [...renderToStaticMarkup(<ParentPage />).matchAll(/href="(\/parent\/[^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.sort()).toEqual(params.map((p) => `/parent/${p}`).sort());
  });

  it('renders each exported page for the raw and the encoded param', () => {
    for (const param of params) {
      const child = profiles.find((p) => p.slug === param);
      expect(child, param).toBeDefined();
      for (const variant of [param, encodeURIComponent(param), [...param].map((c) => `%${c.charCodeAt(0).toString(16)}`).join('')]) {
        const text = textOf(render(variant));
        expect(text, variant).toContain(child!.displayName);
        expect(text, variant).not.toContain('could not be found');
      }
    }
  });

  it('an unknown, malformed or old profile-id param is a 404, not a crash', () => {
    for (const bad of ['nobody', '%E0%A4%A', 'profile%3Amina', 'profile:jun']) {
      let caught: unknown;
      try {
        render(bad);
      } catch (error) {
        caught = error;
      }
      expect(isNotFound(caught), bad).toBe(true);
    }
  });
});
