/**
 * Native stub of the [ Present this ] hand-off (F-BROWSE-001 BR-13): the
 * presenter is a root of the learner web build only (F-TCH-004 section 3.1),
 * so a native build has no presenter root, never shows the button and opens
 * nothing. The web variant is `present-handoff.web.ts`.
 */
export function presenterRootExists(): boolean {
  return false;
}

export function openPresenter(_href: string): boolean {
  return false;
}
