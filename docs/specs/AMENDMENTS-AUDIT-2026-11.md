Status: ready; rows AU-1 to AU-17 done (stage 1 in #1034, stage 2 in the PR that adds this line)

> **Amended 2026-11-23 by `AMENDMENTS-DURABLE-PROGRESS.md` [DP]** (work order WO-01 of the 2026-11 review: a failed read is never "nothing saved"; a failed write is never silent): AU-3's unread set becomes store state (`loadFailedFor`), so boot, the chooser and Home can show it; a write that failed after its step ran (`unsaved`) is told apart from a failed read (`unread`) and from a step that threw (`step-failed`), a record started fresh answers `fresh`, and a failed save is retried and said (`saveFailedFor`) (sections 3.2 and 3.7; rows DP-1a and DP-2).

> **Amended 2026-11-25 by `AMENDMENTS-QUEST-LEAVE-RESUME.md` [LR]** (work order WO-06 and WO-07 of the 2026-11 review: a game is never left by accident; a quest or a long check goes on where it stopped; a finish that was not saved never looks done) (AU-12, "No new screen and no new string"): Home now says that the hero's lesson goes on: the button reads Continue, a caption says "You can go on from step 3 of 5." and a quiet Start again asks first, then opens the first step; the saved run is read through `durableRead`, and a failed read means no resume (row LR-2, #1089). Everything else in AU-12 stands: Leave still clears the saved run, and the quest's own leave line, "Stars from this try will not be saved.", is unchanged (OD-LR1 (c), owner decision 2026-11-24); only the comment at `QuestPlayerView.tsx:132` changed, to name the device copy (row LR-5).

> **Amended 2026-11-25 by `AMENDMENTS-DISCOVER-SOUND-FIRST.md` [SF]** (work order WO-13 of the 2026-11 review; owner decision 2026-11-22, OD-R2) (AU-10): the sound a Look and learn page plays by itself is its first letter's **Hear it**, and on a consonant card Hear it now plays the letter's sound (가), not its name (기역); the name moved to a second button, **Hear the name**. AU-10's conditions and QS-3's 350 ms wait do not change. Row SF-1.

# Amendment: fixes from the 2026-11-15 readiness audit

> **Owner decision of 2026-11-15 (in chat, translated):** "Do stage 1 and stage 2 of the code-fix list and merge."
>
> Source: `docs/launch/product-review-2026-11-15.md` (the audit). Each row names the audit finding it closes.
> Every change below is marked **[AU]** where it lands in a spec, test or code comment.

**Standing rules that apply here**

- Anti-shame rules stay as written in CLAUDE.md section 1: no row adds a red failure state, a drop in a meter or the loss of an earned item.
- UI strings come from `packages/i18n` with English, Spanish and Korean in the same PR. The review ledger of a changed `en` namespace is re-signed (`enSha`, `reviewedBy: MAR`).
- D1 changes are additive only.
- Copy never claims native-speaker, expert or legal review.
- One commit per row, test and code together.

**Not in this amendment (they need an owner or counsel decision first)**

- Making online backup opt-in, sending a consent record to the server, or renaming the level ids `5-7 / 8-9 / 10-11`. F-LEARN-001 decisions L1 and L2 say the level ids are opaque and that who-is-learning and consent never leave the device. Changing either is a legal design decision (audit PRIV-1, PRIV-2).
- Longer join codes and owner approval for a caregiver join (audit SEC-1): a product change with printed codes in use.
- Requiring `RESCUE_PEPPER` (audit SEC-4): the owner sets the secret; the runbook row below says how.
- Adult proof for the PIN reset (audit SEC-7).

## Rows

### Stage 1

**AU-1 Privacy policy says what the product does (audit PRIV-1).**
The policy text in `packages/i18n/src/messages/{en,es,ko}/landing.ts` twice claims "verifiable parental consent". The product does not run a verifiable-consent method: a grown-up ticks an agreement on the device behind a grown-up PIN. Replace both sentences with a plain description of that step. Keep every other claim. Update the policy's effective date. Do not add a claim of legal review or of compliance that the text did not already make.
*Done when:* neither sentence contains "verifiable" in any locale; the i18n and site tests pass; the ledger is re-signed.

**AU-2 Worker errors are visible (audit PROD-1).**
(a) `packages/backend/src/app.ts` gets an `onError` handler: one structured log line (route pattern, method, error name and message; no body, no name, no id) and the standard 500 envelope. (b) `apps/api/wrangler.toml` turns Workers observability on. (c) `app.crash` is counted by day in `telemetry_daily` like the other counted names (name and day only).
*Done when:* a thrown handler error returns the envelope with code `internal` and logs once; a posted `app.crash` raises its daily count.

**AU-3 A progress record that cannot be read is never written over (audit FUNC-2).**
`apps/mobile/src/store/progress-store.ts` treats a failed read and unparsable JSON as "no progress" and the next write replaces the record. Change: a read error leaves the profile un-hydrated (no write this session, retried on the next hydrate). Unparsable JSON: the raw value is first copied to `progress-corrupt:<profileId>` (kept if that key is already set), and only then may a fresh snapshot be written.
*Done when:* tests cover both paths on the web storage; the repro in the audit keeps the original bytes under the new key.

**AU-4 Production CORS is the allow-list only (audit SEC-2).**
`packages/backend/src/lib/cors.ts` accepts any `*.workers.dev` origin and `localhost` when `ALLOWED_ORIGINS` is unset. Change: that leniency applies only when the runtime is not production (`environmentName`). In production with no explicit list, only `DEFAULT_ORIGINS` are accepted. `authorizedPartiesFor` follows the same rule.
*Done when:* tests cover production and development for `workers.dev`, `localhost`, a default origin and an unknown origin.

**AU-5 Baseline security headers on both static sites (audit SEC-3).**
`apps/mobile/public/_headers` and `apps/web/public/_headers` send, for every path: `Strict-Transport-Security: max-age=31536000`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN` and `Content-Security-Policy: frame-ancestors 'self'`. A script-source policy is not in this row: it needs a report-only period first. The build checks that read `_headers` (`merge-console.mjs`, `headers.mjs`, their tests) still pass, and no rule is joined to a second value for the same header.
*Done when:* the built `dist/_headers` and `out/_headers` carry the five headers once per path rule.

**AU-6 Server ids come from the crypto source (audit SEC-8).**
`id()` in `packages/backend/src/store.ts` uses `Math.random`. Use `crypto.getRandomValues` and keep the `prefix:xxxx` shape and length so every id pattern still matches.

**AU-7 The runbook covers backup, restore and rollback (audit PROD-4, SEC-4).**
`docs/launch/owner-runbook.md` gains a section: D1 Time Travel restore, a Worker version rollback, a periodic export, setting `ALLOWED_ORIGINS` for preview hosts after AU-4, and setting `RESCUE_PEPPER`. Docs only.

### Stage 2

**AU-8 A Check's answer options show no romanization until the answer (audit EDU-3).**
In a quest's Check step (the Listen and Read "Quick check"), the visible romanization under each option is hidden while the question is open and shown once the question is answered. The accessible label keeps the romanization. The no-sound path ("No sound? Read it here.") is unchanged. Practice games and every teaching screen keep romanization as now. This is an owner-approved exception to "taught Korean always shows romanization"; CLAUDE.md section 1 gets one line that says so.
*Done when:* tests show hidden-then-shown on a Check and unchanged practice games.

**AU-9 Skipping a game caps the stars (audit FUNC-4).**
Stars are computed over played rounds only, so one perfect game and two skips gives three stars. Change: a run with any skipped game step earns at most 2 stars; a run where every game step was skipped earns at most 1. Nothing already saved is lowered (`recordBestQuest` keeps the best).

**AU-10 The first sound plays by itself on a letter page (audit UX-7).**
On each "Look and learn" page, the first letter's sound plays once when the page opens (after the tap that opened it), unless sound is off or reduced by the existing settings. Continue is never held back.
**[QS]** `AMENDMENTS-QUEST-SOUND-BACK.md` QS-3: the sound waits 350 ms for the page; a tap on a speaker during the wait plays at once and drops it.
**[SF]** `AMENDMENTS-DISCOVER-SOUND-FIRST.md` §3.3: "the first letter's sound" is literally its sound now (가 for ㄱ; ㅇ, vowels and finals as before).

**AU-11 Two tabs do not write over each other's progress (audit FUNC-1).**
A progress write merges with the stored record inside one storage transaction (the same union the sync merge uses), and other tabs re-read after a write (a broadcast channel, as the profile list does). Stars, cards and completions earned in either tab survive.

**AU-12 A quest left by a reload continues where it stopped (audit FUNC-3).**
The run's position and tallies are saved per profile at each step change. Starting the same quest again within 24 hours resumes at the saved step (the step restarts from its beginning). Finishing, or choosing Leave in the leave dialog, clears the saved run. No new screen and no new string.

**AU-13 Build a Letter's speaker plays the recorded clip (audit FUNC-5).**
On a device with no Korean voice, "Hear" in Build a Letter showed "No Korean voice on this device" on the live build. Check the current code first: if the speaker already plays the recorded syllable clip, close the row with the evidence. Otherwise play the clip when one exists and fall back to speech only when none does.

**AU-14 Stroke data follows the standard order (audit EDU-6).**
`apps/mobile/src/content/jamo-strokes.ts` follows the standard school stroke order and counts: ㄱ 1, ㄴ 1, ㄷ 2 (top bar, then the ㄴ shape), ㄹ 3 (ㄱ shape, middle bar, ㄴ shape), ㅁ 3 (left bar; top and right as one stroke; bottom bar), ㅂ 4 (left bar, right bar, middle bar, bottom bar; both bars start at the same height), ㅅ 2, ㅇ 1 (counter-clockwise from the top), ㅈ 2, ㅊ 3, ㅋ 2, ㅌ 3 (top bar, middle bar, ㄴ shape), ㅍ 4 (top bar, left leg, right leg, bottom bar), ㅎ 3; ㅏ (long bar, then tick), ㅓ (tick, then long bar), ㅗ (tick, then long bar), ㅜ (long bar, then tick), ㅑ (bar, tick, tick), ㅕ (tick, tick, bar), ㅛ (tick, tick, bar), ㅠ (bar, tick, tick). Horizontal strokes run left to right and vertical strokes top to bottom. The header comment that says the data is "not perfectly anatomical" is removed.

**AU-15 Stage 1 copy claims only what Stage 1 teaches (audit EDU-4).**
Stage 1 teaches 14 basic consonants, 10 basic vowels and six final consonants. The Stage 1 can-do line ("Read any Hangul letter and syllable and know its sound.") and the completion lines ("every letter and every final sound") are reworded to "the basic letters" in en, es and ko.

**AU-16 Rate limits that last, and a body size limit (audit SEC-5, SEC-6).**
The limiters on Rescue Code claim, join-code lookup, join and relink move from per-isolate memory to the durable `rate_hits` table that notes and transfers already use. Every route rejects a body over a set size (default 256 KB; the snapshot route may set its own higher cap) with 413.

**AU-17 Accessibility quick fixes (audit A11Y-1 to A11Y-4).**
(a) Tile's wrong state uses the primary text colour from a token and carries the same non-colour mark ChoiceCard uses. (b) Pill's nudge text uses the primary text colour. (c) The tab bar's roles are valid (no `link` child inside a `tablist`). (d) Every progress bar has an accessible name. (e) Text inputs and idle answer tiles use `border.shape`.

## As built

**Stage 1 (rows AU-1 to AU-7).**

- **AU-1.** The Privacy Policy is English in every locale, so only `en/landing.ts` changed; the es and ko `landing` ledger entries were re-signed. Effective date: November 16, 2026. The two sentences now say that a learner profile is not an account, that a parent, guardian or teacher agrees to the policy on the device and sets a grown-up PIN before a child's profile is saved or backed up, and that a learner who sets up their own profile confirms they are 13 or older.
- **AU-2.** `app.onError` logs one `api.error` JSON line (method, route pattern, error class, a scrubbed message) and answers the 500 envelope with code `internal`; a thrown `HTTPException` keeps its own response. `[observability] enabled = true`, with `invocation_logs = false` because the per-request line holds the full URL and API paths carry learner and space ids. `app.crash` is counted in `telemetry_daily` by name and day.
- **AU-3.** Every read and write of `progress:<id>` is one guarded storage transaction. A read error leaves the profile un-hydrated: writes stay in memory and the next hydrate reads again; sync uploads nothing meanwhile. A value that does not parse (or parses to a non-object) is copied to `progress-corrupt:<id>` first; if the copy cannot be made, nothing is written. A malformed object still loads as before (existing tests pin that). The copy is removed with the learner.
- **AU-4.** `allowedOrigin` and `authorizedPartiesFor` take the environment; `localhost` and `*.workers.dev` pass only outside production, and an unset `ENVIRONMENT` is production.
- **AU-5.** Both sites send the five headers on `/*`. Grown-up rules detach before they set, so each header is sent once (grown-up pages keep `DENY` and `frame-ancestors 'none'`). One exception: `/_expo/static/js/*` detaches `X-Content-Type-Options`, because the stale-build reload (F-CURR-002 section 10) needs a missing chunk's `index.html` answer to run.
- **AU-6.** `id()` draws 12 characters of `0-9a-z` from `crypto.getRandomValues`; the shape is unchanged.
- **AU-7.** `docs/launch/owner-runbook.md` section P.

Also in the audit's first PR (#1033): `apps/mobile` typecheck runs with an explicit 4 GB heap, and the audio e2e helper `controlledBySw` polls with `page.evaluate`.

**Stage 2 (rows AU-8 to AU-17).**

- **AU-8.** In a quest Check that plays a sound, every option's romanization is held (drawn at opacity 0, room kept, off the accessibility tree) until the right option is tapped; options already missed wait too. The accessible name is unchanged. Practice games, the Hangul Check, vocabulary, text-prompt Checks and the no-sound path are unchanged. The presenter does the same on a Check's listen question. No new mode: a flag on the option view (`heldRomanization`) and a `romanizationReserved` prop on `KoreanText` and `ChoiceCard`. CLAUDE.md section 1 names the exception. Not covered: the prompt of a Read Pick Meaning Check still shows its romanization, and Checks built on other games are unchanged.
- **AU-9.** "Skip for now" on a game step's launcher counts as a skipped step: any skipped game step caps the run at 2 stars, all skipped caps it at 1. A game's own Skip inside a round is not a skipped step (rounds answered are scored as before). The story reader is not a game step. `recordBestQuest` never lowers saved stars.
- **AU-10.** On a "Look and learn" page whose first item is a letter, that letter's sound plays once when the page opens. Skipped when sound is off, a screen reader is on, or nothing can say it. `heard` in telemetry stays the count of taps. Learner and guest players only.
- **AU-11.** A progress write is a three-way merge inside the storage transaction: stored unchanged, this tab's snapshot is stored as it is; stored changed and nothing new here, memory takes the stored snapshot; both changed, `rebaseSnapshot` (the function sync uses). Channel `hr-progress` tells other tabs to read again; a tab also re-reads when it becomes visible. `reset` replaces and is not merged.
- **AU-12.** `quest-run:<profileId>` holds the quest id, a signature of its step list, the step index, tallies, scored-round keys, skipped steps and the start time; written at run start and at each step change. A run for another quest, with a changed step list, or older than 24 hours from its start is discarded. Cleared on finish and on Leave. A guest run is unchanged (GU-D6, GU-D12: a guest reload reopens quest 1 from step 1). A story quest resumes a saved run only when opened with Keep reading.
- **AU-13.** The recorded clip already played; the screen still showed "No Korean voice on this device." because Build a Letter did not tell its prompt slot that the syllable has a clip. It does now. All 27 Stage 1 target syllables have a clip in the `stage1` pack.
- **AU-14.** Stroke data rewritten to the row's table: ㅁ 3 strokes, ㅌ 3, ㅈ 2, ㅊ 3, ㅗ and ㅛ ticks first, ㅂ's bars from the same height; the six finals share their consonant's definition. ㅈ and ㅊ now draw the bar into the left leg without a lift, which changes the look of their guide slightly. The line shown after a pass with the strokes out of order no longer says "the top line first" (en, es, ko). `reviewedStrokeIds` stays empty, so the presenter still says "Simplified stroke guide" until a teacher has reviewed the data (F-TCH-004). A letter's own bottom bar now lies at the canvas's lower edge, which showed an older layout fault on a 320 x 568 phone: Trace a Word's canvas kept its 160 floor in a shorter slot, so Show me and Clear lay over its lower edge and took those strokes. On a stacked content box under 500 tall the two helpers now stand beside the canvas (`traceWordHelperColumn`); every other size is unchanged. No mock was made for this move of two existing buttons.
- **AU-15.** Six dictionary lines, the Stage 1 one-liner and the Stage 2 Letters Volume 2 intro now say "the basic letters" and "six final sounds" in en, es and ko.
- **AU-16.** Rescue Code claim (5 an hour, every attempt), join-code lookup (20 an hour) and relink create (10 an hour) count in `rate_hits`; lookup and relink count only attempts that fail, so a class on one school address is not locked out. `/join` had no limit and now counts wrong codes (20 an hour). The key is a hash of the client address, never the address. Bodies over 256 KB get 413; the snapshot PUT and the Stripe webhook allow 2 MB. No migration.
- **AU-17.** (a) Tile's wrong state: primary text colour and ChoiceCard's replay mark. (b) Pill's nudge text: primary text colour. (c) Tab bar: `tab` children with `aria-selected` inside the `tablist`. (d) Every progress bar has a name and a value text ("2 of 6"); the warm-up dots are decorative. (e) Text fields and idle Tile and ChoiceCard are outlined in `border.shape`. Not done: a non-colour cue for the active tab (it needs a mock first).

Also in the stage 2 PR: the start bundle line moves to 4,952,000 B (measured 4,948,154 B).

**Follow-ups found on the way (not done).**

- Other screens create a prompt slot without `hasClip` (Trace Stroke, Card Match, Pic-Word Match and more) and may show the same false no-voice line as AU-13.
- Specs that still describe the old behaviour and are read by no test: F-005 and F-008 ("top line first"), F-006 (ㅁ as a closed loop), F-TCH-004 TD4, F-QUEST-002 section 3.2 ("nothing autoplays"), F-I18N-001 D2.
- The hint ring and the press look of an option are weaker cues next to the new idle border (AU-17e) and want a design look.
- `apps/web` design-preview pages still hard-code the old Tile and Pill amber.
