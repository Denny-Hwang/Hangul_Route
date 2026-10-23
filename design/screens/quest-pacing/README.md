# Quest adaptive pacing (F-CURR-002 section 4.6, row CM-24)

Wireframe: `design/wireframes/quest/adaptive-pacing.md`. Built in the app (no separate mock): the compact card is
`DiscoverStep`'s item card drawn bare, two rows on one `Card`; the scaffold round is the shipped Listen & Pick with
its `hint` ring and line.

Shots (`e2e/web/quest-pacing.spec.ts`, release `build:web`, the e2e browser has no Korean voice so the prompt shows
as text):

- `shots/pacing-compact-card-320.png`, `shots/pacing-compact-320.png`, `shots/pacing-compact-wide.png`: quest 2 of
  Stage 2 Nature & Animals after a strong Practice in quest 1, Discover page 2.
- `shots/pacing-scaffold-options-320.png`, `shots/pacing-scaffold-320.png`, `shots/pacing-scaffold-wide.png`: the
  scaffold round after two first-try misses in quest 1's Practice (별 asked, 하늘 beside it).
