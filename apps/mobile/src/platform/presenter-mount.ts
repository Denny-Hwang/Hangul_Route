/**
 * Whether `index.ts` mounts `PresenterApp` for the presenter root (F-TCH-004 TD1, PR 6).
 *
 * The root chooser (`app-root.web.ts`) names a `presenter` root for `/present`, but a chosen
 * root is not a mounted one: without the `index.ts` mount, a tab at `/present` would boot the
 * learner `App`, which runs the learner boot and opens the device's child profile. Since #591
 * `index.ts` sends that root to `PresenterApp`, so the flag is true. [ Present this ]
 * (F-BROWSE-001 BR-13) reads this flag and stays hidden whenever it is false. `presenter-mount.test.ts` reads `index.ts` and fails whenever this flag and the real
 * mount disagree, so the PR that mounts `PresenterApp` must also set it to true, and nothing can
 * set it to true without that mount.
 */
export const PRESENTER_MOUNTED = true;
