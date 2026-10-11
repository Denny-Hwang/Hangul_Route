## Summary
- <!-- 1-3 bullets describing what changes in this PR -->

## Related
- Spec: `docs/specs/F-XXX-<slug>.md` <!-- required for feat/fix PRs -->
- Task: `T-XXX` <!-- if routine-generated -->
- Design (optional): `design/screens/...` or `design/components/...`

## Tests
- [ ] Unit
- [ ] Integration
- [ ] E2E (if applicable)
- Coverage delta: `+X.Y%` <!-- filled by CI comment -->

## Screenshots (UI only)
<!-- before / after -->

## Checklist
- [ ] Spec link present (F-XXX)
- [ ] Tests added (TDD)
- [ ] Design tokens only — no hardcoded colors / spacing / typography
- [ ] Language policy respected — UI strings from the selected locale (en/es/ko); taught Korean shown with romanization + a gloss in the UI language
- [ ] Romanization + English gloss present for every Korean learning item
- [ ] Claims audit: every sentence I changed maps to a fact I re-read <!-- required when the PR changes narrationEn or facts in content/stories/ (F-STORY-001 §3.3 C6; process in content/stories/README.md) -->
- [ ] Rolling coverage targets met (see `docs/tests/coverage-targets.md`)
- [ ] Conventional Commit title
- [ ] `routine-generated` label set if this PR was opened by a routine

## New screen? Layout adoption checklist (F-LAYOUT-001 §3.12)
<!-- Only for PRs that add or rebuild a screen. Delete this section otherwise. -->
- [ ] Wrapped in `Screen` (never a raw `View` at the top), with a chosen `width`
- [ ] No direct `useWindowDimensions`: uses `useLayoutClass()`
- [ ] No raw sizes derived from the window: uses `useMediaSize(base)`
- [ ] Anything with a picture and text has a `sideBySide` arrangement; stacked otherwise
- [ ] Tappables >= 64 (no new entry in `apps/mobile/e2e/web/fixtures/touch-target-allowlist.json`; that list only shrinks); no horizontal scroll at 320 wide and at 590 wide (200 % zoom of 1180)
- [ ] Added to the e2e reachability list for the six viewports when it has a primary CTA
- [ ] Spanish strings (about 30 % longer) fit: no fixed-width labels, text wraps
