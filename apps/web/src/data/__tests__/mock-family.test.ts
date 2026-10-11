import { describe, expect, it } from 'vitest';
import { findMockChild, mockFamily } from '../mock-family';

describe('mockFamily', () => {
  it('returns at least one profile and totals', () => {
    const f = mockFamily();
    expect(f.profiles.length).toBeGreaterThan(0);
    expect(f.totals.cards).toBeGreaterThan(0);
  });

  it('week minutes equals sum of per-day minutes', () => {
    const f = mockFamily();
    const expected = f.profiles.reduce(
      (acc, p) => acc + p.weekly.reduce((a, b) => a + b.minutes, 0),
      0,
    );
    expect(f.totals.weekMinutes).toBe(expected);
  });

  it('labels each demo card with its Korean word, not an emoji (CLAUDE.md: no emoji in rendered output)', () => {
    for (const card of mockFamily().profiles.flatMap((p) => p.recentCards)) {
      expect(card.ko, card.title).toMatch(/^[\uAC00-\uD7A3]+$/);
      expect(card.romanization, card.title).toMatch(/^[a-z]+$/);
      expect(card, card.title).not.toHaveProperty('emoji');
    }
  });
});

/**
 * Issue #237: the /parent/<child> demo pages are statically exported, one file per child.
 * A colon in the route segment made the export and the host disagree (the Worker
 * 307s `profile:mina` to `profile%3Amina` and serves the 404 page), so each child is
 * addressed by a colon-free slug and the lookup decodes the segment first.
 */
describe('mockFamily route slugs (issue #237)', () => {
  const profiles = mockFamily().profiles;

  it('gives every demo child a unique, URL-safe slug with no colon', () => {
    const slugs = profiles.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(profiles.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(encodeURIComponent(slug)).toBe(slug);
    }
  });

  it('finds each child by its slug, raw or percent-encoded', () => {
    for (const p of profiles) {
      const everyCharEncoded = [...p.slug].map((c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`).join('');
      expect(findMockChild(p.slug)?.id).toBe(p.id);
      expect(findMockChild(encodeURIComponent(p.slug))?.id).toBe(p.id);
      expect(findMockChild(everyCharEncoded)?.id).toBe(p.id);
    }
  });

  it('still finds a child by its old profile id, decoded or encoded (links shared before the fix)', () => {
    for (const p of profiles) {
      expect(findMockChild(p.id)?.slug).toBe(p.slug);
      expect(findMockChild(encodeURIComponent(p.id))?.slug).toBe(p.slug);
    }
  });

  it('returns undefined for an unknown or malformed segment instead of throwing', () => {
    expect(findMockChild('nobody')).toBeUndefined();
    expect(findMockChild('')).toBeUndefined();
    expect(findMockChild('%E0%A4%A')).toBeUndefined();
  });
});
