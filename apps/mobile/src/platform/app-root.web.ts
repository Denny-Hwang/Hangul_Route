import { isLearnerRoot } from '@hangul-route/content-schema';

/**
 * Which root of the learner web build mounts (F-BROWSE-001 section 4.1),
 * chosen in `index.ts` before `App` mounts, so a root other than the app runs
 * none of the learner boot. Order once every branch is in: `/present`
 * (F-TCH-004 PR 6), `/browse` (here), the grown-up bounce (F-APP-001 A-6),
 * else the app; each of those PRs adds its own branch.
 */
export type AppRoot = 'browse' | 'app';

const BROWSE_ROOT = '/browse';

export function pickRoot(location: { pathname: string }): AppRoot {
  const { pathname } = location;
  // `isLearnerRoot` owns the prefix rule (end, `/`, `?` or `.` after the root), so `/browsex` stays the app.
  if (pathname.startsWith(BROWSE_ROOT) && isLearnerRoot(pathname)) return 'browse';
  return 'app';
}
