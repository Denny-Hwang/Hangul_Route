/**
 * Streak day calculation — counts consecutive days a profile has had ≥1 session.
 */

export function computeStreak(sessionDates: string[], now: Date = new Date()): number {
  if (sessionDates.length === 0) return 0;
  const unique = new Set(sessionDates.map((iso) => iso.slice(0, 10)));
  let streak = 0;
  const d = new Date(now);
  // Allow today to be missed up to 23:59 (don't break streak mid-day)
  for (let i = 0; i < 365; i++) {
    const key = d.toISOString().slice(0, 10);
    if (unique.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
