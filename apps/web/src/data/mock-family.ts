/**
 * Mock family data for the Parent Dashboard preview.
 * Real data is fetched from apps/api once cloud sync ships.
 */

import type { LearnerLevelId } from '@hangul-route/content-schema';

export interface MockChildProfile {
  id: string;
  /**
   * The demo child's route segment, `/parent/<slug>` (issue #237). Colon-free and URL-safe,
   * so the exported file name, the dashboard link and the URL the host serves all agree.
   * Demo data only: a real learner's name never goes into a URL.
   */
  slug: string;
  displayName: string;
  ageGroup: LearnerLevelId;
  questsCompleted: number;
  cards: number;
  streak: number;
  weekly: Array<{ day: string; minutes: number }>;
  recentQuests: Array<{ id: string; title: string; stars: number; completedAt: string }>;
  /**
   * A collected card: the Korean word it teaches (drawn as text, no emoji), its Revised
   * Romanization, and its English title as the gloss (CLAUDE.md §1: taught Korean always
   * carries romanization and a UI-language gloss).
   */
  recentCards: Array<{ id: string; title: string; ko: string; romanization: string }>;
}

export interface MockFamily {
  profiles: MockChildProfile[];
  totals: { cards: number; weekMinutes: number; streak: number };
}

export function mockFamily(): MockFamily {
  const profiles: MockChildProfile[] = [
    {
      id: 'profile:mina',
      slug: 'mina',
      displayName: 'Mina',
      ageGroup: '5-7',
      questsCompleted: 9,
      cards: 14,
      streak: 5,
      weekly: [
        { day: 'M', minutes: 8 },
        { day: 'T', minutes: 12 },
        { day: 'W', minutes: 6 },
        { day: 'T', minutes: 14 },
        { day: 'F', minutes: 9 },
        { day: 'S', minutes: 18 },
        { day: 'S', minutes: 11 },
      ],
      recentQuests: [
        { id: 'q1', title: 'Meet g, n, d, l', stars: 3, completedAt: 'Today, 8:14am' },
        { id: 'q2', title: 'Bow & Eat Tteokguk', stars: 2, completedAt: 'Yesterday' },
        { id: 'q3', title: 'Tiger, Magpie, Moon', stars: 3, completedAt: 'Sun, May 17' },
      ],
      recentCards: [
        { id: 'c1', title: 'Tiger', ko: '호랑이', romanization: 'horangi' },
        { id: 'c2', title: 'Kimchi', ko: '김치', romanization: 'gimchi' },
        { id: 'c3', title: 'Moon', ko: '달', romanization: 'dal' },
        { id: 'c4', title: 'Kite', ko: '연', romanization: 'yeon' },
      ],
    },
    {
      id: 'profile:jun',
      slug: 'jun',
      displayName: 'Jun',
      ageGroup: '8-9',
      questsCompleted: 12,
      cards: 19,
      streak: 7,
      weekly: [
        { day: 'M', minutes: 15 },
        { day: 'T', minutes: 12 },
        { day: 'W', minutes: 14 },
        { day: 'T', minutes: 18 },
        { day: 'F', minutes: 10 },
        { day: 'S', minutes: 22 },
        { day: 'S', minutes: 17 },
      ],
      recentQuests: [
        { id: 'q4', title: 'Meet the Vowels', stars: 3, completedAt: 'Today, 4:02pm' },
        { id: 'q5', title: 'Yut, Kite, Top', stars: 3, completedAt: 'Today, 3:50pm' },
        { id: 'q6', title: 'Hello Kimchi & Rice', stars: 2, completedAt: 'Yesterday' },
      ],
      recentCards: [
        { id: 'c5', title: 'Yutnori', ko: '윷놀이', romanization: 'yunnori' },
        { id: 'c6', title: 'Mountain', ko: '산', romanization: 'san' },
        { id: 'c7', title: 'Seollal', ko: '설날', romanization: 'seollal' },
        { id: 'c8', title: 'Rice', ko: '밥', romanization: 'bap' },
      ],
    },
  ];

  const cards = profiles.reduce((sum, p) => sum + p.cards, 0);
  const weekMinutes = profiles.reduce(
    (sum, p) => sum + p.weekly.reduce((a, b) => a + b.minutes, 0),
    0,
  );
  const streak = Math.max(...profiles.map((p) => p.streak));
  return { profiles, totals: { cards, weekMinutes, streak } };
}

/** `decodeURIComponent` that answers `undefined` for a malformed escape instead of throwing. */
function safeDecode(segment: string): string | undefined {
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
}

/**
 * The demo child a `/parent/[childId]` segment names (issue #237). The segment is decoded
 * first, because Next and the host may hand it over percent-encoded. Only the slug
 * matches: the old `/parent/profile:*` URLs have no exported file, so the host answers
 * them with its 404 page before this lookup could run.
 */
export function findMockChild(segment: string): MockChildProfile | undefined {
  const decoded = safeDecode(segment);
  if (!decoded) return undefined;
  return mockFamily().profiles.find((p) => p.slug === decoded);
}
