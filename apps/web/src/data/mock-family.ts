/**
 * Mock family data for the Parent Dashboard preview.
 * Real data is fetched from apps/api once cloud sync ships.
 */

export interface MockChildProfile {
  id: string;
  displayName: string;
  ageGroup: '5-7' | '8-9' | '10-11';
  questsCompleted: number;
  cards: number;
  streak: number;
  weekly: Array<{ day: string; minutes: number }>;
  recentQuests: Array<{ id: string; title: string; stars: number; completedAt: string }>;
  recentCards: Array<{ id: string; title: string; emoji: string }>;
}

export interface MockFamily {
  profiles: MockChildProfile[];
  totals: { cards: number; weekMinutes: number; streak: number };
}

export function mockFamily(): MockFamily {
  const profiles: MockChildProfile[] = [
    {
      id: 'profile:mina',
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
        { id: 'c1', title: 'Tiger', emoji: '🐯' },
        { id: 'c2', title: 'Kimchi', emoji: '🥬' },
        { id: 'c3', title: 'Moon', emoji: '🌙' },
        { id: 'c4', title: 'Kite', emoji: '🪁' },
      ],
    },
    {
      id: 'profile:jun',
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
        { id: 'c5', title: 'Yutnori', emoji: '🎲' },
        { id: 'c6', title: 'Mountain', emoji: '⛰️' },
        { id: 'c7', title: 'Seollal', emoji: '🎊' },
        { id: 'c8', title: 'Rice', emoji: '🍚' },
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
