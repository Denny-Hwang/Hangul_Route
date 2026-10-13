/**
 * Every page of a space (F-APP-001 A-5b, section 3.8): each subpage of `app/(console)/teach/space/`
 * (`''` is the space page itself) has a family twin under `app/(console)/parent/space/` that
 * re-exports the same component, so a family space is addressed under its own persona prefix
 * (`ROUTES.*(…, 'family')`, `spacePath`) and `/teach/space?id=<family>` keeps working. A sibling
 * spec that adds a space page adds it here and adds its twin in the same PR (R-3); the
 * `space-pages` test fails otherwise.
 */
export const SPACE_PAGES = ['', 'plan', 'curriculum', 'relink', 'settings', 'lecture', 'route', 'transfers', 'learner', 'notes'] as const;

export type SpacePage = (typeof SPACE_PAGES)[number];
