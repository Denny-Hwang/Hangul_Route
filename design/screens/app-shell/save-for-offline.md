# App shell: Save for offline, the Offline lessons card and a later volume offline (design mock v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §10 item 4, row CM-5B. Wireframe: `design/wireframes/pwa/save-for-offline.md`.
Built by: row CM-5B (`apps/mobile/src/screens/parent/OfflineLessonsCard.tsx`, the later line in `screens/episode/EpisodeDetailView.tsx`).

This mock is drawn on the existing components only, so it is described here rather than as a separate HTML page. The reference renders are the e2e captures of the built screens (`journey-stories.spec.ts`, `HR_SHOTS=1`, fixture bundle, Pixel 5): `cm5b-offline-card-not-saved.png`, `cm5b-offline-card-saved.png` and `cm5b-volume2-needs-internet.png` under `apps/mobile/e2e/web/__shots__/`.

## The card

| Part | Component and tokens |
|---|---|
| Container | `Card padding="md"`, `marginBottom: spacing.lg`, the same card as the Lecture mode card above it |
| Title | `Heading level="prompt"` |
| Line | `Body size="sm" tone="secondary"`; the first-use note under it is `Caption tone="muted"` |
| Offline line | `Caption tone="secondary"`, only while offline |
| Stage row | a row that wraps: `Body weight="semibold"` (the stage, "Stage 2: Words"), `Caption tone="muted"` (size · state); `minHeight: touchTarget.min`, `paddingVertical: spacing.xs`, a `colors.border.subtle` rule under each row |
| Save | `Button tone="secondary" size="sm"`, spoken "Save: <stage>" |
| Remove | `Button tone="ghost" size="sm"`, spoken "Remove: <stage>"; never the danger tone (nothing a learner earned is removed) |
| Save all | `Button tone="primary" size="md" fullWidth`, only with two or more rows not saved |
| Progress and problems | `Caption tone="secondary"` in a polite live region |
| Space | `Caption tone="muted"` |

## The later line (learner)

| Part | Component and tokens |
|---|---|
| Notice | `Card padding="md" tone="sunken"` with `Body tone="secondary"`, under the volume tabs, `Spacer size="md"` above |
| Row text | the closed row's pattern: `Pip state="later" context="stage"` and `Body weight="semibold" tone="secondary"`, `minHeight: touchTarget.min` |

No new colour, size or radius: every value is a design-system token. The amber nudge and the danger colour are not used: being offline is not a mistake.
