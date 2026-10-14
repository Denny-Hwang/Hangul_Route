# Teacher moves and the class-scope update (design mocks v1)

Spec: `docs/specs/AMENDMENTS-TEACHER-VISIBILITY-TRANSFER.md` (owner decisions 2026-10-14). Wireframe: `design/wireframes/console/teacher-move-and-scope.md`. This is the design pass CLAUDE.md section 5 requires before the console and app components of PR TV-C; as for F-SPACE-002 T-0b (owner decision 2026-10-12), agents make the mock and the multi-agent review approves it.

Reused, not redrawn: the transfer mock's sheet, card, step and history parts (`design/screens/transfer/`, `mock/transfer.css`), the report blocks of F-REPORT-001, and the app's Home line and grown-up gate. The new surfaces are compositions of those parts; no new token, glyph or component family is introduced.

## Composition (each new surface, built from shipped parts)

| Surface | Built from | Differences from the reused part |
|---|---|---|
| Teacher move sheet, step 1 | transfer `start-sheet.md` (sheet frame, code field, Find class, errors) | a radio group "Where to?" above the code field: one radio per class from `destinations`, plus "A class of another teacher", which reveals the shipped code field |
| Teacher move sheet, step 2 | transfer `start-sheet.md` confirm step | two sentences (direct or accept), primary **Move now** or **Send**; no consent list (TV-D7, TV-D8) |
| Teacher moves section | transfer `requests-page.md` cards (destination alias card, source card, history) | steps are a single status line ("Waiting for the other class."), no learner or family step; **Accept** / **Not now** on incoming, **Cancel** on outgoing |
| Learner report Words block | report "More detail" rows (F-REPORT-001 section 3.5 item 10) | three rows: counts, first try, words to look at again (Korean with romanization and gloss) |
| Learner report Settings line | the same rows | one row "Notes from the class: …" |
| Base-scope line | report muted hint (`colors.text.muted`) | one sentence |
| Parent home update card | transfer `consent-sheet.md` identity-free layout (statement lines, expanded list, buttons last) | no language switch, no read-to-end gate (it is an acknowledgement of what teachers see, not a yes to a move); one **OK** |
| Parent home move notice | console notice card (`console/home.md` notices) | one sentence and **OK** |
| App Home lines | the transfer Home line (`app-sheets.md`, `TransferHomeLine`) | text and one **Open** or **OK** button |
| App class update screen | `ApproveTransfer` read-only sheet frame (`app-sheets.md`) | the class-scope lines and one **OK**; reached through the grown-up gate for a child profile |

## Rules the mock fixes

- **Tokens only.** Spacing, type and colour are the tokens the reused parts already use; ended and blocked lines use `colors.feedback.nudge` with `colors.text.muted`, never `colors.feedback.danger`.
- **Touch targets.** Every button and radio is at least `touchTarget.min` (64) in the app and 44 px in the console.
- **Words.** The class-scope lines are `CLASS_SCOPE_TEXT` of `packages/content-schema/src/schemas/class-scope.ts`, word for word; other strings are the wireframe's drafts and land in `packages/i18n` (en, es, ko).
- **No names in URLs.** The sheet posts the learner id in the body; the cards address a move by its `move:` id.
- **Anti-shame.** No counts of declined moves, no actor on an ended move, no comparison between learners in the Words block.

## Review record

Multi-agent review (design, accessibility, anti-shame and copy, privacy lenses) runs on the PR that lands this file, as for #472; its findings are applied in this file and in TV-C before merge.
