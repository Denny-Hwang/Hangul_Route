/**
 * Whether `index.ts` mounts `PresenterApp` for the presenter root (F-TCH-004 TD1, PR 6).
 *
 * The root chooser (`app-root.web.ts`) already names a `presenter` root for `/present`, but a
 * chosen root is not a mounted one: until `index.ts` sends that root to `PresenterApp`, a tab at
 * `/present` mounts the learner `App`, which runs the learner boot and opens the device's child
 * profile. [ Present this ] (F-BROWSE-001 BR-13) reads this flag and stays hidden while it is
 * false. `presenter-mount.test.ts` reads `index.ts` and fails whenever this flag and the real
 * mount disagree, so the PR that mounts `PresenterApp` must also set it to true, and nothing can
 * set it to true without that mount.
 */
export const PRESENTER_MOUNTED = false;
