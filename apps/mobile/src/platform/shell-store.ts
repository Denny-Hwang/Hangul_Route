import type { AdultPersona } from '@hangul-route/content-schema';

/**
 * Native stub of the shell store reader (F-APP-001 sections 3.5 and 3.14): the shell store is the
 * console's, on the web app host only, and native builds have no grown-up entry (OD-6). The web
 * variant is `shell-store.web.ts`.
 */
export async function readLastPersona(): Promise<AdultPersona | null> {
  return null;
}
