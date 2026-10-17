Status: ready (spec, wireframe and mock pass DN-0; amends F-I18N-001 §3.2 / §3.3, F-AUTH-002, F-APP-001 §3.7 / §3.9, F-BROWSE-001 §4.9, F-LAYOUT-001 (text size), F-LEARN-001 §3.15.4; implementation rows in section 12)

# Amendment: one language and one text size per device, a way back on every screen, and the learner UX pass of the owner report 2026-10-16

> Basis: `origin/main` `426384b45` (2026-10-16). Every `file:line` below is at that commit. The lecture-mode parts of the same report (the phone stage, the presenter's way back, the helper picker, the grouped chooser) are `AMENDMENTS-LECTURE-V2.md` section 18; this file is their device-wide base (the Display control and record the presenter uses).
>
> Wireframes (this PR): `design/wireframes/shell/display-sheet.md`, `design/wireframes/shell/screen-header.md`, `design/wireframes/home/next-lesson-hero.md`, `design/wireframes/profile/profile-split.md`, `design/wireframes/library/cards-collected-first.md` (and, for lecture mode, `design/wireframes/classroom/lecture-phone.md` and the revised `classroom/lecture-presets.md`). Mocks (this PR): `design/screens/app-shell/display-sheet.md`, `adult-frame.md` (PageBack revision), `lecture-setup.md`; `design/components/ScreenHeader/`, `design/components/ConfirmSheet/`; `design/screens/learner-shell/` (Home hero, Profile split, Library); `design/screens/presenter/` (phone, rotate page, grouped chooser).

**Owner report 2026-10-16 (translated; the parts this file answers):** "Every section needs a way back: while I was choosing a lesson there was no Back, so I had to leave altogether. Let me adjust the text size on every page possible. Keep the language setting the same on one device, or in one account: I used student mode in English, and switching to parent or teacher changed it back. And suggest and apply UX improvements from the user's point of view."

**Standing rules that apply here:** audience is anyone at any age (no age wording) · UI strings only through `packages/i18n` (`useMessages`), en + es + ko in the same PR, F-I18N-001 §3.10 style guide and glossary, one reviewer checks them · tokens only, no emoji · reading, listening and writing only (no speaking measurement, no speaking UI) · anti-shame (CLAUDE.md §1) · no D1 migration in this amendment (D1 is untouched: the record lives on the device, the account copy in Clerk) · no prices · never enable `CLASS_TRANSFER` · production level: every row ships finished and reviewed by the multi-agent review.

---

## 0. Summary

| # | Problem found | Change |
|---|---|---|
| 1 | **The language lives in four places on one origin.** The learner app keeps `hr:device:settings` plus a per-profile override `hr:settings:<profileId>` (IndexedDB, F-I18N-001 §3.2); the console keeps `hr:console:uiLocale` (localStorage, `apps/web/src/lib/i18n/console-locale.ts:12`); All lessons and the presenter keep session-only overrides (F-BROWSE-001 §4.9 `setSessionLocale`, F-TCH-004 §3.12 chips). Moving from a learner profile to `/parent` or `/teach/home` switches stores, so the owner's English in student mode came back as another language. | **DN-D1, section 3**: one record `hr:device:settings` = `{ uiLocale, uiLocaleAt, textSize }` read and written by every surface of `app.hangulroute.com`; the per-profile and session overrides go (with a migration); the signed-in account carries a copy (section 5). |
| 2 | **No text size control.** Type is fixed at the token sizes (F-LAYOUT-001 LD4 "Media scales, text does not"); the learner app's web build renders px, so the browser's text size does nothing there. | **DN-D4, section 4**: four steps (Standard, Large, Larger, Largest) in the same record, from a **Display (Aa)** control on every screen that has a header. |
| 3 | **No way back on many screens.** The learner app has no history entries on the web (no `linking`, F-LEARN-001 §3.15.4 line 386), so the browser or phone back leaves the app; Back controls are drawn per screen in five different ways (`screens/vocab/BackButton.tsx`, `screens/notes/parts.tsx`, `screens/browse/browse-ui.tsx` `HeaderBack`, the profile chevron, none); console pages have back links in three wordings and the way to the learner app sits where a Back would. | **DN-D5, section 7**: every non-root screen has a top-left **Back** through one `ScreenHeader` (exception: PlacementInvite); a web history bridge; console **PageBack**; the console's **Learner app** exit moves to the right. |
| 4 | **Native `confirm()`** on the web (`apps/mobile/src/platform/dialog.web.ts:10`, eleven `window.confirm` calls in console pages) shows the browser's own OK / Cancel in the browser's language, not the app's, and an installed iOS app may not show it at all. | **DN-D6, section 8**: a **ConfirmSheet** in the UI language. |
| 5 | **The learner UX pass** (owner: "suggest and apply"): Home's next step is three cards down and the Learning Route card is below the fold; Profile is one long page of 15 blocks mixing a learner's own things with grown-up settings; the Library's Cards tab opens on a wall of locked cards; the grown-up area has three names ("Grown-up zone", "Family Dashboard", "Grown-up home"); joining a class hides inside a card; the Route tab repeats "Open" on every row. | **DN-D7, section 9**: a next-lesson hero, a Profile split, collected cards first, one name, a "Got a class code?" link, a quieter Route tab. One suggestion is recorded as rejected (section 9.7). |

---

## 1. What was measured

On a release build of `origin/main` `426384b45` (learner web build and console, Chromium) and the source at that commit:

- **Language stores.** A learner profile set to English (the device record `en`), then **Grown-up home** → `/parent`: the console reads `hr:console:uiLocale` (another key, another storage), finds the earlier console choice and renders in it; back in the learner app, the profile's own override wins over the device. `?lang=` from the learner app is sent only when the learner's locale is not the default (F-APP-001 §3.9 item 4, line 324), so English never travels. All lessons and the presenter start from the device locale and change it for the session only.
- **Text.** 190 uses of `typography.size.*` across 63 files under `apps/mobile/src` and 40 in `packages/design-system/src/components`; no shared scale. The console sets sizes in rem (the design pass of F-APP-001), so the browser's text size already reaches it.
- **Back.** 59 stack screens in the learner bundle (`navigation/root.tsx`, `onboarding.tsx`, `browse.tsx`; six more are test-fixture screens of the e2e build); the web build pushes no history entry for any of them.
- **Confirm.** `dialog.web.ts` calls `window.confirm(message)` and drops the title and both labels; the console calls `window.confirm` at 11 sites (`teach/space/page.tsx:121`, `relink/page.tsx:67`, `settings/page.tsx:136, 142, 145, 157`, `plan/page.tsx:221, 234`, `lecture/page.tsx:199, 222`, `ClassTransferParts.tsx:506`) and `transfers/page.tsx:107` passes it as a prop.
- **Profile** (360 x 740, a learner set up by a grown-up): 15 blocks, 2 895 px, about 3.9 screens; the grown-up blocks (plan, backup, Classes & family, install, Grown-up home, the zone row, licences) start on the third screen.
- **Library, Cards** (360 x 740, the welcome card collected): 5 888 px, about 8 screens; the one collected card (Tiger) is the 19th tile, after 18 locked ones ("Finish the episode: Meet the Letters"), in catalogue order.

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| DN-D1 | **One display record per device**, `hr:device:settings` = `{ uiLocale?, uiLocaleAt?, textSize? }` in the learner app's IndexedDB store (the default idb-keyval store the learner app already uses through `platform/storage`, and that the console already reads for the gate marker, `lib/console/device-marker.ts`). Every surface of `app.hangulroute.com` (learner app, All lessons, presenter, console) reads it and writes it through the **Display** sheet. The per-profile `uiLocale` and the All lessons and presenter session overrides are removed; the console's `hr:console:uiLocale` is migrated into it and removed. | The owner asks for one language per device. One origin since F-APP-001 A-3, so one record is possible; four stores were the cause. |
| DN-D2 | **Resolution: device record > signed-in account > detection > `en`**, each only when the build offers it (`availableLocales()`). Detection never writes. `?lang=` only seeds a device that never chose. | A deliberate choice on this device is what the person in front of it wants; the account fills in a fresh device; a link must not undo a choice. |
| DN-D3 | **The account carries the choice**: Clerk `unsafeMetadata` `{ uiLocale, uiLocaleAt }`, merged with the existing `adultAffirmedAt`; at sign-in and on account load **the newer choice wins** on both sides. Clerk's own widgets follow the resolved locale (`enUS`, `koKR`, `esMX`). | "or in one account": a grown-up on a second device gets their language once signed in. No D1 column, no endpoint (F-APP-001 already stores `adultAffirmedAt` the same way). |
| DN-D4 | **Text size: Standard 1.0, Large 1.15, Larger 1.3, Largest 1.5**, per device in the same record. Caption to prompt scale by the factor `f`; title, display and hero by `1 + (f - 1) / 2`. Effective scale = the OS text size (`fontScale`) x `f`. The console uses an html font-size variable. Slides keep stage units. Not behind the grown-up gate. No telemetry. | Larger body text helps every reader; headings already large grow half as much so screens keep their shape. Display choices are not progress and say nothing about anyone. |
| DN-D5 | **Every non-root screen has a top-left Back** through `ScreenHeader` (learner app, All lessons) or `PageBack` (console). Roots: Welcome, the four tabs, the presenter home (it has its own Back link, LV-3), the console persona homes and nav targets, All lessons home. **Exception list: PlacementInvite only.** The browser and phone back do the same as the visible Back (web history bridge). The console's way to the learner app becomes a **Learner app** exit on the right. | "Every section needs a way back." One place, one look, one behaviour; the top-left slot is never taken by anything that leaves the app. |
| DN-D6 | **ConfirmSheet replaces native `confirm()`** on the web (learner web build and console); native builds keep `Alert`. | Labels in the UI language, a safe default focus, and it works in an installed iOS app. |
| DN-D7 | **Learner UX pass**: Home next-lesson hero above the unchanged three F-HW-001 slots; Profile split into **Profile** and **Grown-up area**; Library cards collected first; one name **Grown-up area**; a **Got a class code?** link; a quieter Route tab. | The owner's "suggest and apply"; each item removes a step or a repeated word, none adds pressure. |
| DN-D8 | **Rejected: removing the placement test-language step.** The owner decided that the level check's test language is selectable (2026-10-09, F-PLC-001 D10 "selectable test language"); the step stays. Its default becomes the device language (section 3.2), so most people only confirm it. | Recorded so it is not proposed again. |

---

## 3. One display record per device (amends F-I18N-001 §3.2 and §3.3)

### 3.1 The record

```ts
// packages/content-schema/src/schemas/locale.ts (additive; 100 % covered)
export const TEXT_SIZES = ['standard', 'large', 'larger', 'largest'] as const;
export const TextSizeSchema = z.enum(TEXT_SIZES);
export const TEXT_SIZE_FACTOR: Record<TextSize, number> = { standard: 1, large: 1.15, larger: 1.3, largest: 1.5 };
export const DeviceSettingsSchema = z.object({
  uiLocale: UiLocaleSchema.optional(),            // absent = never chosen on this device
  uiLocaleAt: z.number().int().min(0).optional(), // epoch ms of the choice; 0 = migrated (older than any real choice)
  textSize: TextSizeSchema.optional(),            // absent = 'standard'
});
export const DEVICE_SETTINGS_KEY = 'device:settings';   // stored as hr:device:settings (the existing key)
export const PREFS_CHANNEL = 'hr-prefs';
export const PrefsMessageSchema = z.object({ ns: z.literal('hr-prefs'), v: z.literal(1), type: z.literal('device-settings'), settings: DeviceSettingsSchema }).strict();
export function resolveUiLocale(i: { device?: UiLocale; account?: UiLocale; detected: UiLocale; available: readonly UiLocale[] }): UiLocale;
export function newerChoice(a?: { uiLocale: UiLocale; at: number }, b?: { uiLocale: UiLocale; at: number }): { uiLocale: UiLocale; at: number } | undefined;   // later `at` wins; a tie keeps a
```

- **Where it lives.** The existing learner key `hr:device:settings` (JSON string in the default idb-keyval store, `platform/storage.web.ts`). The learner app, All lessons and the presenter use `readJson` / `writeJson('device:settings', …)`; the console uses a reader and writer in `lib/console/device-settings.ts` built like `device-marker.ts` (guarded, one retry on a fresh connection, `null` on failure). A failed or blocked storage means "never chosen" and the choice lasts for the page only, as today (F-I18N-001 §3.2 last Given).
- **Who writes.** Only the **Display** sheet (section 3.6), Welcome's language chips (first run, F-I18N-001 §3.3, unchanged otherwise), the `?lang=` seed (section 3.4) and the account merge (section 5). A choice writes `uiLocale` with `uiLocaleAt = Date.now()`; a text size writes `textSize` alone. Detection writes nothing.
- **Removed.** `ProfileSettingsSchema.uiLocale` (the per-profile override; `romanizationMode` stays, per profile, as F-I18N-001 D2 wants), `locale-store.setProfileLocale`, the Profile Language card's "This profile" part, F-BROWSE-001's `setSessionLocale` and the browse Language chips, the presenter's session chips (`AMENDMENTS-LECTURE-V2.md` section 18.4), the console's `hr:console:uiLocale`.

### 3.2 Resolution and who reads it

`activeLocale = resolveUiLocale({ device: record.uiLocale, account: signedInAccount?.uiLocale, detected, available })`: the first of device record, account, detection that the build offers; else `en`. The learner app has no account (learners never sign in), so there it is device > detection > `en`; the console adds the account. Placement's test-language default (F-PLC-001 §3.1 step 2: "profile override, else device, else detected") becomes the resolved locale; the test language stays a run-only choice (DN-D8).

### 3.3 Migration (once per device, idempotent, no marker)

On each learner-app boot, before the first render (`hydrateLearnerData`), and on each console boot:
1. If the record has no `uiLocale`: take the **active profile's** override (`hr:settings:<activeProfileId>.uiLocale`), else the console's `hr:console:uiLocale`, else nothing; write it with `uiLocaleAt: 0`.
2. Remove `uiLocale` from every `hr:settings:<profileId>` (keep `romanizationMode` and any other field) and remove `hr:console:uiLocale`.
3. A device whose record already had `uiLocale` keeps it; the overrides are still removed (one language per device, by the owner's request). `uiLocaleAt: 0` means a migrated value never beats a real choice from the account (section 5).

Because step 2 removes what step 1 reads, a second boot finds nothing to do; no version field is needed. Tested with corrupt values, a blocked store and an older build writing an override again after the migration (it is folded again only if the record has no `uiLocale`, otherwise removed).

### 3.4 `?lang=` (amends F-I18N-001 §3.3 "Web hand-off" and `pickConsoleLocale`)

- A valid `?lang=` for an offered locale is used for the **first paint** only (before the record is read, so a hand-off never flashes the wrong language), then: if the record has no `uiLocale`, it is written with `uiLocaleAt = Date.now()` (it **seeds** a device that never chose); otherwise it is ignored. Either way it is removed from the address with `history.replaceState`.
- `pickConsoleLocale`'s order "`?lang=` first and store it" (F-APP-001 §3.7 last bullet) becomes: record > account > `?lang=` seed > browser.

### 3.5 Open tabs stay in step

A write posts `PrefsMessageSchema` on `BroadcastChannel('hr-prefs')` (feature-detected; absent = no sync, the next boot reads the record). Every root listens: the learner app, All lessons, the presenter and the console apply the settings at once (language and text size), without a reload, and without writing. A tab with a running lesson or quest applies them too (only words and sizes change; no state is lost). The channel is separate from F-TCH-004's `hr-tabs` presence ping.

### 3.6 The Display control and sheet

Wireframe `shell/display-sheet.md`; mock `design/screens/app-shell/display-sheet.md`.

- **Control**: a **Display** button showing "Aa" (`common.display.button`, named `common.display.a11y` "Display: language and text size") at the **top right** of every `ScreenHeader` (section 7.1), the learner tab roots' headers (beside the Profile button on Home), All lessons' header, the presenter home and start screen (`AMENDMENTS-LECTURE-V2.md` section 18.4), and the console's AdultFrame header (where it replaces the Language select; below 45em it stays in the header row, so the footer no longer holds Language). At least `touchTarget.min`. **Not drawn** while a session clock runs (a Speed Round in Challenge mode, a Daily test, a timed placement item) and on the presenter's stage during a lesson.
- **Sheet** (bottom sheet below 600 px, a dialog of `layout.maxWidth.reading` from 600): title **Display**; **Language** (only when two or more locales are offered): one radio per offered locale by endonym, each `lang`-tagged; **Text size**: four radio steps with a live preview line (`common.display.preview`) drawn at each step's size; the note "For everyone on this device. Change it any time." (`common.display.note`); **Done**.
- **Language change.** Choosing another language shows a confirm step **in the new language** inside the sheet ("Use Español on this device?", **Use Español** / **Back to English**, `common.display.confirm.*`; the F-I18N-001 §3.3 safety rule), so a mis-tap is one tap from undone. Use writes the record and the sheet re-renders in the new language.
- **Text size** applies at once on the screen behind the sheet (no confirm; it is fully reversible in the same place).
- **Not gated** (F-I18N-001 L7 unchanged; a display choice touches no data). **No telemetry.**

## 4. Text size (amends F-LAYOUT-001 LD4)

- **Factor** `f = TEXT_SIZE_FACTOR[record.textSize ?? 'standard']`. **Body sizes** (`caption`, `bodySm`, `body`, `bodyLg`, `prompt`) are `round(token x f)`; **heading sizes** (`title`, `display`, `hero`) are `round(token x (1 + (f - 1) / 2))`. Largest: body 18 -> 27, prompt 22 -> 33, title 28 -> 35, display 36 -> 45, hero 48 -> 60. `leading.*` stays a ratio, so line heights follow.
- **Learner app and All lessons** (RN): `TextScaleProvider` (design-system) gives `useType()` the scaled sizes; React Native then applies the OS text size on top (`allowFontScaling`), so the effective scale is `fontScale x f`. Screens and components read sizes only from `useType()`; a source scan (`type-scale-scan.test.ts`) fails on `typography.size.` under `apps/mobile/src/screens`, `src/components` and `packages/design-system/src/components` outside the allow-listed style modules, and its list only shrinks (ratchet to zero in DN-3b).
- **Console** (DOM, rem): the root sets `--hr-text-scale: f` and `--hr-head-ratio: (1 + (f - 1) / 2) / f` on `html`, and `html { font-size: calc(100% * var(--hr-text-scale)) }`; heading classes are `calc(<token rem> * var(--hr-head-ratio))`. The browser's own text size still multiplies all of it.
- **Presenter**: its teacher pages (home, start screen, state pages, the overlays' real-pixel controls) follow `f`; the **stage keeps stage units** (F-TCH-004 §3.6), because a projected slide is sized for the room, not for the person holding the device.
- **What does not scale**: touch target minimums (`touchTarget.*`) stay; controls grow with their text, never shrink. Media (`mediaScale`) is unchanged.
- **Fit rule.** At 320 x 568 with **Largest** and the OS text size at 100 %, no learner screen scrolls sideways and no text is clipped (Playwright on the four tabs, Profile, Grown-up area, a quest step of each minigame family, the Display sheet). Fixed-height rows become `minHeight`.

## 5. The account (amends F-AUTH-002 §3.1 and F-APP-001 §3.7)

- **Stored**: Clerk `user.unsafeMetadata.uiLocale` and `.uiLocaleAt` (same shapes as the record). Written with `user.update({ unsafeMetadata: { ...user.unsafeMetadata, uiLocale, uiLocaleAt } })`, so `adultAffirmedAt` (F-APP-001 §3.7) and any later field survive. Read and written only by the console (the learner app never signs in).
- **Merge** at sign-in completed in this tab and whenever the console loads a signed-in user: `newerChoice(record, account)`; the winner is written to the side that is older (the record, broadcast on `hr-prefs`; or the account). A migrated device value (`uiLocaleAt: 0`) never beats an account value. A failed `user.update` is retried at the next load; nothing is shown.
- **A choice made in the console while signed in** writes both.
- **Clerk widgets** (`SignIn`, `SignUp`, reverification) get `localization` from `@clerk/localizations` by the resolved locale: `en` -> `enUS`, `ko` -> `koKR`, `es` -> `esMX` (Latin-American Spanish, as the style guide). The package is pinned to the release line of `@clerk/clerk-react` (`^5.61.3`, `apps/web/package.json:20`) and added to the third-party notices.
- **Shared devices**: the newer choice wins, so a grown-up signing in on a classroom PC whose record was chosen later keeps the PC's language and their account takes it; one tap on Display fixes it on both. Recorded as an open item (section 15), not a blocker.

## 6. Hand-offs, the console and All lessons

- **F-APP-001 §3.7 / §3.9 amended: the hand-off always carries `lang`.** Every link that moves a person between the learner app and the grown-up pages (the Grown-up area's Account pages row, `openGrownUpArea`, the Plan screen's Open billing, the console's Learner app exit, Open the app on this device, Sign out to `/signin`) appends `?lang=<resolved locale>`, English included. With section 3.4 it paints the right language at once and seeds only a device that never chose.
- **The console reads the device record** (section 3.1) and the account (section 5); `LocaleProvider` keeps its shape. The Language select in the AdultFrame header and phone footer is replaced by the Display control (section 3.6).
- **F-BROWSE-001 §4.9 amended: All lessons uses the device language.** The Lesson display sheet keeps **Romanization** only; Language is the shared Display sheet. `setSessionLocale` is removed; `device:settings` joins `BROWSE_WRITABLE_KEYS` (§4.10), so the Display sheet can write it from a preview tab (it holds no learner data). The pass's `uiLocale`, if present, only seeds a device that never chose (section 3.4).
- **The presenter** reads the record for its chrome and writes it only from its Display sheet (F-TCH-004 §3.9 and §3.12 as amended 2026-10-16).

## 7. A way back on every screen

### 7.1 Learner app and All lessons: `ScreenHeader`

Wireframe `shell/screen-header.md`; mock `design/components/ScreenHeader/`.

- One design-system component, `ScreenHeader` (`packages/design-system/src/components/ScreenHeader/`), at the top of every screen's content inside `Screen`: **leading** slot top-left, **title** (h1, optional, may wrap to two lines), **trailing** slot top-right with the Display control and at most one more control (Home's Profile button).
- **Leading variants**: `back` (`arrow-left` glyph and the visible word **Back**, `common.buttons.back`) for stack screens; `close` (`close` glyph and **Close**, `common.buttons.close`) for modals and for flows that ask before leaving (quest player, minigame, placement items, Stage review, story reader); `none` for roots. At least `touchTarget.min`, 64 x 64 hit area, always the first focusable element.
- **What Back does**: `navigation.goBack()`, through the screen's existing `beforeRemove` guard where one exists (F-LEARN-001 §3.15.4 steps; a quest's leave sheet), so the visible Back, the Android back and the browser back all run the same code. A screen with unsaved input asks with ConfirmSheet (section 8).
- **Roots** (no leading control): Welcome, Home, Route, Journey, Library, All lessons home. **Exception list** (a non-root screen without Back), in `SCREEN_HEADER_EXCEPTIONS`: `PlacementInvite` only (it is the end of first-run setup; its two buttons, Take the level check and Not now, are the ways on, and going back would reopen a profile form that already saved).
- **Test**: a registry test walks the route names of `navigation/root.tsx`, `onboarding.tsx` and `browse.tsx` and fails when a non-root screen is missing from `SCREEN_HEADER_VARIANTS` and not in the exception list; a render test per variant; e2e: the browser back from five sample screens lands where the visible Back does.
- The per-screen back controls (`screens/vocab/BackButton.tsx`, `screens/notes/parts.tsx` `BackButton`, `screens/browse/browse-ui.tsx` `HeaderBack`, the Profile chevron) are replaced and deleted.

### 7.2 The web history bridge (amends F-LEARN-001 §3.15.4)

F-LEARN-001 §3.15.4 says the browser back reaches the `beforeRemove` listener "only once the web build has a linking config". That line is amended: the learner web build gets a **history bridge** (`platform/history-bridge.web.ts`; native stub does nothing) for `App` and `BrowseApp`, without a URL scheme (LD7 of F-LAYOUT-001 still holds: no deep links). Each stack push adds one browser history entry (`pushState({ hrNav: depth }, '', location.pathname)`); a `popstate` to a lower depth dispatches one `goBack()` (so `beforeRemove` guards run); a pop that the guard cancels re-pushes the entry. Modals and sheets (ConfirmSheet, the Display sheet) push one entry while open, so the back closes them first. At the root the browser's own back leaves the app, as today. The address never changes.

### 7.3 Console: `PageBack` and the Learner app exit (amends F-APP-001 §3.8)

Wireframe `shell/screen-header.md` Panel C; mock `design/screens/app-shell/adult-frame.md` (revision 2026-10-16).

- **PageBack**: every console page that is not a persona home or a nav target (`/parent`, `/teach/home`, Reports, Notes, Billing; Lessons and Lecture mode open other pages) has a back link at the top left of its content, above the h1: the `arrow-left` glyph and the label of the existing page back message (`console.relink.back`, `.plan.back`, `.curriculum.back`, `.lecture.back`, `.settings.back`, `.learningRoute.back.*`, `.notes.sent.back.*`, `.billing.receipts.back`, `.start.back`, `.teacherMove.back`), or, on a space's own page, "Back to {page}" (`console.pageBack.to`) with the persona home's nav label. One component (`components/console/PageBack.tsx`), at least `touchTarget.min`, the same place on every page and width. The five `back(space)` messages drop their leading "← " in en and es (PageBack draws the glyph; ko already has none).
- **Learner app exit**: the frame's way to the learner app (today "Back to learning" / "Open the learner app" on the left after the persona) becomes one **Learner app** button (`console.shell.backToLearning`, changed; `openLearnerApp` removed) with the `arrow-right` glyph after the label, at the **right end** of the header row on every width, so the top-left belongs only to PageBack. Its action is unchanged (clears the unlock and the console session, `learnerHome()` with `?lang=`, section 6).

## 8. ConfirmSheet (replaces native `confirm()`)

Mock `design/components/ConfirmSheet/`.

- **Learner web build**: `platform/dialog.web.ts` renders `ConfirmSheet` (design-system) with the caller's `title`, `message`, `confirmLabel` and `cancelLabel` instead of `window.confirm(message)`; the `confirm(opts): Promise<boolean>` signature is unchanged, so `QuestPlayerView`, `SpacesCard` and `SaveProgressScreen` need no change. Native keeps `Alert`.
- **Console**: `components/console/ConfirmSheet.tsx` and a `useConfirm()` hook replace the 11 `window.confirm` calls and the `transfers` prop; each site gets a verb label (`console.confirm.*`, section 10) instead of OK.
- **Anatomy**: `role="alertdialog"`, `aria-modal`, labelled by its title and described by its message; a bottom sheet below 600 px, a centred dialog from 600; **cancel first and focused** (the safe choice, as the presenter's Exit confirm), confirm second as the primary button. `Esc`, the backdrop and the back (history bridge) cancel. No red: a destructive action is said in its label ("Remove", "Archive"), never by colour alone (anti-shame applies to the grown-up surfaces' tone too). Focus returns to the control that opened it.

## 9. The learner UX pass (DN-D7)

### 9.1 Home: a next-lesson hero (amends the Home layout of F-HW-001 and the Home Learning Route card of the Learning Route amendment)

Wireframe `home/next-lesson-hero.md`; mock `design/screens/learner-shell/home-hero.md`.

- A **hero card** at the top of Home, above "Today with Hoya": "Next lesson" (eyebrow), the lesson title (`localize`d), where it sits ("Stage 1 · Meet the Letters · lesson 1 of 3", from the route catalogue), one **Start** (`touchTarget.hero`) and a quiet link **See your Learning Route** (the Route tab). The lesson is `routeNext` (`logic/route-next.ts`, "the one next of the app", F-ENT-003 §3.5), the same rule card ② uses.
- **The three F-HW-001 slots stay exactly as they are**: same chains, same order, same completion semantics, no shifting. When the hero's lesson is card ②'s (the usual case), both name it; the hero is the one big Start, the card is the day's plan and still collects on completion (F-HW-001 §3.2). Finishing it moves the hero to the next route lesson.
- The separate Home **Learning Route** strip (title, goal line, plan week, seven drawn segments; R-4b, LR-A6) is folded into the hero: its goal line (`learner.myRoute.home.strip.goal`) and plan week (`.week`) sit under the hero's where-line when a goal source exists, and the segments and the title go, with "See your Learning Route" as the way to the whole route. Home is shorter by one card. With `routeNext` giving `free-end` or `rest` (F-ENT-003), the hero shows that state's existing line and button instead of a lesson.
- No streak, count or pressure line in the hero (anti-pressure); the Tip card is unchanged.

### 9.2 Profile split (amends F-LEARN-001 §3.11 Profile and F-APP-001 §3.6 Profile row)

Wireframe `profile/profile-split.md`; mock `design/screens/learner-shell/profile-split.md`.

- **Profile** (the learner's own, no gate): who is playing (profiles, Edit, Add a profile), the stats, **Display** (a row that opens the Display sheet), **Sound**, **Reading practice** (the per-profile romanization switch), **Challenge**, **Find my starting spot**, **Weekly plan** (as today, gated for a child as today), **My notes**, **Got a class code?** (section 9.5), the **Plan** card (F-BILL-002 §4.7: no PIN, unchanged), and one row **Grown-up area** at the end.
- **Grown-up area** (the `ParentDashboard` screen, behind the gate as today; on a self-only device it is **Account & backup**, `zoneLabel` unchanged, and opens directly): **Account pages** (web only; the row that opens the app host, F-APP-001 A-7), the learners on this device (the existing dashboard), **Progress backup** (Save my progress, Back up to a file, Restore from a file), **Classes & family** (`SpacesCard`, its Join and Leave), **Install on this device**, **Open-source notices**. Each keeps its current action and gate.
- The Profile **Language** card is removed (section 3.1); Reading practice stays on Profile.
- Measured target (mock): Profile at 360 x 740 is under three screens tall; the Grown-up area under two.

### 9.3 Library: collected cards first (amends F-CARD-001 gallery order, wireframe `library/gallery.md`)

Wireframe `library/cards-collected-first.md`; mock `design/screens/learner-shell/library-cards.md`.

- The Cards tab lists **collected cards first** (most recently earned first, `cards[].unlockedAt`), then one disclosure **Cards to earn** (closed by default, `aria-expanded`; no count, since the Library never shows a total, F-STORY-006 §3.7 D3) holding the locked tiles with their earn hints (F-STORY-006 unchanged). The theme chips filter both groups. A learner with no card yet sees the count line ("0 cards collected") and the disclosure open.
- Nothing is hidden for good and nothing is taken away; no count of what is not yet earned is shown.

### 9.4 One name: Grown-up area

The device's gated area has one name in every place that leads to it or speaks of it: **Grown-up area** / **Zona de adultos** / **어른 공간**. `caregiver.audience.family.zoneLabel` and `.pinVerifyTitle` ("Grown-up zone"), `caregiver.dashboard.title` ("Family Dashboard") change to it; the lines that already say "grown-up area" stay. The row that opens the web pages, "Grown-up home", becomes **Account pages** (`caregiver.grownUpHome.title`, `learner.profile.grownUpHome.title` and `.selfTitle`), so no second "grown-up" name is left. A self-only device still never says "grown-up" (**Account & backup**).

### 9.5 "Got a class code?"

A link row on Profile, **Got a class code?** with the line "Join a class or a family with the code you were given." It opens the existing Join screen (`JoinSpace`, F-SPACE-001; not gated, as the Classes & family card's Join is today), so a learner does not need to find the card that moved to the Grown-up area.

### 9.6 Route tab: less noise (amends the Learning Route amendment's learner Route tab)

- No "Open" status on lesson rows or stage headers: with the curriculum unlocked (F-ENT-003) every row is open, so the word carried no information. A row shows a status only when it differs: **Done**, **In your plan**.
- Only the current stage is expanded; other stages are one row each (name, "n of m done", chevron) that expands on tap. "You are here" shows once, on the current stage; "Your goal" once, on the goal stage. The "Ready when you are" line is removed.
- Nothing about the route rules, the plan or the pips' meaning changes.

### 9.7 Rejected

- **Removing the placement test-language step** (DN-D8): kept by owner decision; its default becomes the device language.

## 10. Strings (en / es / ko)

Every value lands in the row that draws it, in all three locales, re-signing the namespaces it touches in the review ledger; es and ko follow F-I18N-001 §3.10 (es: neutral Latin-American, tú; ko: 해요체, no particle attached to a variable; glossary: 어른 공간 grown-up area, 수업 lesson, 글자 letter).

**New, `common.display.*` (DN-3; DN-5, DN-7 and LV-3 reuse them)**

| Key | en | es | ko |
|---|---|---|---|
| `display.button` | Aa | Aa | 가가 |
| `display.a11y` | Display: language and text size | Pantalla: idioma y tamaño del texto | 보기 설정: 언어와 글자 크기 |
| `display.title` | Display | Pantalla | 보기 설정 |
| `display.language` | Language | Idioma | 언어 |
| `display.textSize` | Text size | Tamaño del texto | 글자 크기 |
| `display.size.standard` | Standard | Normal | 보통 |
| `display.size.large` | Large | Grande | 크게 |
| `display.size.larger` | Larger | Más grande | 더 크게 |
| `display.size.largest` | Largest | Muy grande | 가장 크게 |
| `display.preview` | This is how text looks. | Así se ve el texto. | 글자는 이렇게 보여요. |
| `display.note` | For everyone on this device. Change it any time. | Para todos en este dispositivo. Cámbialo cuando quieras. | 이 기기를 쓰는 모두에게 적용돼요. 언제든 바꿀 수 있어요. |
| `display.confirm.question` (`endonym`) | Use {endonym} on this device? | ¿Usar {endonym} en este dispositivo? | 이 기기의 언어를 바꿀까요? ({endonym}) |
| `display.confirm.use` (`endonym`) | Use {endonym} | Usar {endonym} | {endonym} 쓰기 |
| `display.confirm.back` (`endonym`) | Back to {endonym} | Volver a {endonym} | 돌아가기: {endonym} |

The confirm values are the shipped `learner.language.confirmDevice`, `confirmUse` and `confirmBack`, moved to `common` because the console and the presenter draw the same sheet.

**Removed (en, es and ko)**: `learner.language.sameAsDevice`, `.confirmProfile`, `.confirmDevice`, `.confirmUse`, `.confirmBack` (DN-3; `learner.language.groupLabel` stays for Welcome) · `learner.profile.language` (`title`, `thisProfile`, `deviceDefault`; DN-3) · `caregiver.browse.display.language` (DN-7; the sheet's `note` stays true for Romanization) · `console.language.label` (DN-5, with `LanguageSelect`) · `console.shell.openLearnerApp` (DN-6).

**New and changed, way back and ConfirmSheet**

| Key | en | es | ko | Row |
|---|---|---|---|---|
| `console.pageBack.to` (`page`) | Back to {page} | Volver a {page} | 돌아가기: {page} | DN-6 |
| `console.shell.backToLearning` (changed) | Learner app | App de estudiantes | 학습자 앱 | DN-6 |
| `console.relink.back`, `.plan.back`, `.curriculum.back`, `.lecture.back`, `.settings.back` (changed: no leading "← ") | Back to {space} / Back to the space | Volver a {space} / Volver al espacio | unchanged | DN-6 |
| `console.confirm.newCode` | Make a new code | Crear un código nuevo | 새 코드 만들기 | DN-6 |
| `console.confirm.remove` | Remove | Quitar | 빼기 | DN-6 |
| `console.confirm.archive` | Archive | Archivar | 보관하기 | DN-6 |
| `console.confirm.copyAnyway` | Copy anyway | Copiar de todos modos | 그래도 복사하기 | DN-6 |
| `console.confirm.replace` | Replace the outline | Reemplazar el esquema | 목록 바꾸기 | DN-6 |
| `console.confirm.discard` | Discard changes | Descartar cambios | 바뀐 내용 버리기 | DN-6 |
| `console.confirm.issueCode` | Make a code | Crear un código | 코드 만들기 | DN-6 |
| `console.confirm.continue` | Continue | Continuar | 계속하기 | DN-6 |

Cancel buttons reuse `common.buttons.cancel`; the learner's ScreenHeader reuses `common.buttons.back` and `common.buttons.close`.

**New and changed, learner UX pass**

| Key | en | es | ko | Row |
|---|---|---|---|---|
| `learner.home.hero.eyebrow` | Next lesson | Siguiente lección | 다음 수업 | DN-8 |
| `learner.home.hero.where` (`stage`, `episode`, `i`, `n`) | Stage {stage} · {episode} · lesson {i} of {n} | Etapa {stage} · {episode} · lección {i} de {n} | {stage}단계 · {episode} · 수업 {n}개 중 {i}번째 | DN-8 |
| `learner.home.hero.start.cta` | Start | Empezar | 시작 | DN-8 |
| `learner.home.hero.route.cta` | See your Learning Route | Ver tu Ruta de aprendizaje | 학습 루트 보기 | DN-8 |
| `caregiver.audience.family.zoneLabel` (changed) | Grown-up area | Zona de adultos (unchanged) | 어른 공간 (unchanged) | DN-8 |
| `caregiver.audience.family.pinVerifyTitle` (changed) | Grown-up area | Zona de adultos (unchanged) | 어른 공간 (unchanged) | DN-8 |
| `caregiver.dashboard.title` (changed) | Grown-up area | Zona de adultos | 어른 공간 | DN-8 |
| `caregiver.grownUpHome.title` (changed) | Account pages | Páginas de la cuenta | 계정 페이지 | DN-8 |
| `learner.profile.grownUpHome.title` (changed) | Account pages | Páginas de la cuenta | 계정 페이지 | DN-8 |
| `learner.profile.grownUpHome.selfTitle` (changed) | Account pages | Páginas de la cuenta | 계정 페이지 | DN-8 |
| `learner.profile.display.row` | Display | Pantalla | 보기 설정 | DN-8 |
| `learner.profile.display.line` (`language`, `size`) | {language} · {size} text | {language} · texto {size} | {language} · 글자 {size} | DN-8 |
| `learner.profile.classCode.title` | Got a class code? | ¿Tienes un código de clase? | 반 코드가 있나요? | DN-8 |
| `learner.profile.classCode.line` | Join a class or a family with the code you were given. | Únete a una clase o a una familia con el código que te dieron. | 받은 코드로 반이나 가족에 들어가요. | DN-8 |
| `learner.library.cards.toEarn` | Cards to earn | Tarjetas por ganar | 모을 수 있는 카드 | DN-9 |
| `learner.route.stage.doneOf` (`done`, `total`) | {done} of {total} done | {done} de {total} listas | {total}개 중 {done}개 끝 | DN-9 |

**Removed, learner UX pass (en, es and ko)**: `learner.myRoute.home.strip.title` and `.stages` (DN-8: the Home route strip is folded into the hero, which keeps the strip's `goal` and `week` lines under its own). Not removed: `learner.myRoute.state.open` and `learner.myRoute.caption.ready`, which the learner Route tab stops drawing (DN-9) but the grown-up Learning Route views still use.

Length: every `cta` is at most 28 characters in every locale ("Ver tu Ruta de aprendizaje", 26). Spanish over 1.5 x English gets an `ES_LENGTH_ALLOW_LIST` line in its row with the reason (`display.preview`, `display.textSize` and `learner.profile.classCode.title` are the candidates). Banned-word lint over all three; no value names an age, a score or a learner.

## 11. Privacy, child safety, accessibility, offline, telemetry

- **Privacy.** The record holds a locale code, a timestamp and a size code: no name, no profile id. The account copy holds the same two fields in Clerk's `unsafeMetadata` (the user can write it; nothing trusts it beyond display). The `hr-prefs` message carries the same record. Nothing leaves the device except that Clerk write.
- **Child safety.** The Display sheet is not gated: changing the language or text size touches no data and is reversible in the same place (F-I18N-001 L7). The Grown-up area keeps its gate; the Profile split moves no gated action out from behind the gate (Weekly plan's child path still asks, Backup still asks). **Got a class code?** opens the same Join screen a learner can open today.
- **Accessibility.** `ScreenHeader`'s Back is the first focus stop; the Display sheet's radios are native groups with legends; the preview line is read as plain text; ConfirmSheet traps focus and returns it; every control at least `touchTarget.min`; Largest text at 320 px scrolls nowhere sideways (section 4). Language radios carry `lang`.
- **Offline.** All of it works offline: the record is local, the Clerk merge waits for the next online load.
- **Telemetry.** None: no event and no key for display choices, Back presses or confirms.

## 12. PR breakdown (implementation rows)

Every UI row links its DN-0 mock and attaches screenshots; every row adds en, es and ko in the same PR; shared files are touched append-only. No row has a D1 migration or a server change, so there is no server-first step; the learner web build (DN-3) deploys before the console (DN-5).

| Row | Content | Size | Depends on |
|---|---|---|---|
| **DN-0** (this PR) | `docs(specs,design)`: this amendment; `AMENDMENTS-LECTURE-V2.md` section 18 and the F-TCH-004 edits; the wireframes and mocks named at the top; pointer lines in F-I18N-001, F-AUTH-002, F-APP-001, F-BROWSE-001, F-LAYOUT-001, F-LEARN-001 | L | — |
| **DN-1** | `feat(content-schema)`: `DeviceSettingsSchema` fields `uiLocaleAt`, `textSize`; `TEXT_SIZES`, `TEXT_SIZE_FACTOR`, `scaledTypeSize`, `resolveUiLocale`, `newerChoice`, `PREFS_CHANNEL`, `PrefsMessageSchema`; 100 % tests | S | DN-0 |
| **DN-2** | `feat(design-system)`: `ScreenHeader`, `DisplaySheet` (presentational; labels passed in), `ConfirmSheet`, `TextScaleProvider` + `useType()` (OS `fontScale` x `f`, the heading half rule); style functions unit-tested | M | DN-1 |
| **DN-3** | `feat(mobile)`: the device record in the learner app: `locale-store` on one record, the migration (section 3.3), `?lang=` seed (3.4), `hr-prefs` sync (3.5), the Display control in the tab roots' headers and the sheet with the in-language confirm (3.6), Welcome chips stamp `uiLocaleAt`, Profile's Language card removed (Reading practice stays), placement's default test language = the resolved locale; text size applied through `useType()` in shared components, the tab roots, the quest player and every minigame (scan ratchet started); `common.display.*` | M | DN-2 |
| **DN-3b** | `feat(mobile)`: text size everywhere else: every remaining `typography.size.*` under `screens/` and `components/` goes through `useType()`; the scan's allow-list reaches zero; the 320 x 568 Largest e2e (section 4 fit rule) | L | DN-3 |
| **DN-4** | `feat(mobile)`: `ScreenHeader` on every non-root screen with the exception list `PlacementInvite` (`SCREEN_HEADER_VARIANTS` and `SCREEN_HEADER_EXCEPTIONS` in `apps/mobile/src/navigation/screen-header-variants.ts`); the registry test; the web history bridge (section 7.2) for `App` and `BrowseApp`; `dialog.web.ts` renders ConfirmSheet; the per-screen back controls deleted | L | DN-2, DN-3 (the Display control sits in the header) |
| **DN-5** | `feat(web)`: the console reads and writes the device record (`lib/console/device-settings.ts`), migrates and removes `hr:console:uiLocale`, `?lang=` first paint and seed only; the hand-off always carries `lang` (both directions, section 6); Clerk `unsafeMetadata` merge (section 5); Clerk `localization` (`@clerk/localizations`); console text size (`--hr-text-scale`, `--hr-head-ratio`); the Display control in the AdultFrame header (the Language select goes) | M | DN-1, DN-3 deployed |
| **DN-6** | `feat(web)`: `PageBack` on every non-home console page; the **Learner app** exit at the right; `ConfirmSheet` + `useConfirm()` replace every `window.confirm` (`console.confirm.*`) | M | DN-0 |
| **DN-7** | `feat(mobile)`: All lessons uses the device language (F-BROWSE-001 §4.9 as amended: Language row out of Lesson display, `setSessionLocale` removed, `device:settings` in `BROWSE_WRITABLE_KEYS`, the Display control in its header) | S | DN-3 |
| **DN-8** | `feat(mobile)`: Home next-lesson hero (the Home Learning Route card folded in), the Profile split with the **Grown-up area** screen, one name, **Got a class code?** | M | DN-4 |
| **DN-9** | `feat(mobile)`: Library collected first (**Cards to earn** disclosure); the quieter Route tab (section 9.6) | M | DN-0 |

Lecture mode rows that use this: **LV-3** needs DN-1, DN-2 and DN-3 (the record writer and the Display sheet in the learner bundle); **LV-4** follows DN-5's console record (the Slides language default reads it). Parallel lanes: DN-6 and DN-9 can run at once with DN-1 to DN-3.

## 13. Tests (per row)

| File | Row | Asserts |
|---|---|---|
| `packages/content-schema/src/__tests__/locale.test.ts` (extend) | DN-1 | the record grammar (old records without the new fields still parse; a bad `textSize` is ignored, not a crash); `resolveUiLocale` order and hidden locales; `newerChoice` (later wins, a tie keeps the first, 0 never beats a real choice); `TEXT_SIZE_FACTOR`; `scaledTypeSize` for every token at every step (body by `f`, headings by the half rule, rounding); `PrefsMessageSchema` strict |
| `packages/design-system/src/components/*/__tests__` (new) | DN-2 | `ScreenHeader` variant styles and slot order; `DisplaySheet` radio groups and the confirm step; `ConfirmSheet` cancel-first order and labels; `useType()` math |
| `apps/mobile/src/store/__tests__/locale-store.test.ts` (extend), `logic/locale/__tests__/migration.test.ts` (new) | DN-3 | migration cases (active override folded with `uiLocaleAt: 0`, console key folded, both removed, idempotent, corrupt and blocked storage); `?lang=` seeds only a fresh record; a broadcast applies without a write; Welcome stamps `uiLocaleAt` |
| `apps/mobile/src/__tests__/type-scale-scan.test.ts` (new) | DN-3, DN-3b | no raw `typography.size.` outside the allow-list; the list only shrinks; zero after DN-3b |
| `apps/mobile/src/navigation/__tests__/screen-header-registry.test.ts` (new), `platform/__tests__/history-bridge.web.test.ts` (new) | DN-4 | every non-root route has a variant, the exception list is exactly `PlacementInvite`; push, pop, guard cancel and re-push |
| `apps/web/src/lib/console/__tests__/device-settings.test.ts`, `clerk-locale.test.ts` (new) | DN-5 | console read and write with retry; migration of `hr:console:uiLocale`; the merge both ways with `adultAffirmedAt` kept; `localization` per locale |
| `apps/web/src/components/console/__tests__/page-back.test.tsx`, `confirm-sheet.test.tsx` (new) | DN-6 | PageBack on every non-home page in `SPACE_PAGES` and the account pages; no `window.confirm` left in `apps/web/src` (source scan) |
| Playwright `apps/mobile/e2e/web/display.spec.ts` (new) | DN-3, DN-5, DN-7 | choose Español in the learner app; `/parent` opens in Spanish; All lessons and `/present` too; a second open tab switches without a reload; Largest at 320 x 568: no sideways scroll on the tabs, Profile and a quest step |
| Playwright `apps/mobile/e2e/web/back.spec.ts` (new) | DN-4 | the browser back from Profile, Episode, a vocab topic, Notes and the Grown-up area lands where the visible Back does; a quest asks before leaving; ConfirmSheet labels in the UI language |
| Playwright `apps/web/e2e/page-back.spec.ts` (new) | DN-6 | PageBack top-left on the plan, settings, lecture and receipts pages at 375 and 1280; the Learner app exit at the right; a confirm opens the sheet, Esc cancels |
| `apps/mobile/src/screens/home/__tests__/hero.test.ts`, `screens/profile/__tests__/profile-split.test.ts`, `logic/library/__tests__/collected-first.test.ts` (new) | DN-8, DN-9 | hero source is `routeNext` and the three slots are unchanged; Profile holds no gated block and the Grown-up area holds them all; collected first, newest first (`unlockedAt`), locked in the disclosure, no count |
| i18n coverage ratchets, `length-budget.test.ts`, banned-word lint | every UI row | es and ko present for every new and changed key |

## 14. Edits to the amended specs (pointer lines in this PR; text in the rows named)

- **F-I18N-001**: §3.2 (one record; `ProfileSettingsSchema.uiLocale` removed; the console key removed) and §3.3 (resolution, `?lang=` seed only, the Profile Language card gone, the console select replaced by Display), §4 "Syncing the locale choice across devices" moves in scope through the account (section 5). Rows DN-1, DN-3, DN-5.
- **F-AUTH-002**: §3.1 Clerk `unsafeMetadata` `{ uiLocale, uiLocaleAt }` and `localization`. Row DN-5.
- **F-APP-001**: §3.7 (`pickConsoleLocale` order; the hand-off always carries `lang`), §3.8 (PageBack; the Learner app exit on the right; Display replaces the Language select), §3.9 item 4 (`?lang=` always). Rows DN-5, DN-6.
- **F-BROWSE-001**: §4.9 (All lessons uses the device language), §4.10 (`device:settings` writable). Row DN-7.
- **F-LAYOUT-001**: LD4 "text does not scale" becomes "text scales by the device's text size" (section 4). Rows DN-2, DN-3, DN-3b, DN-5.
- **F-LEARN-001**: §3.15.4 line 386 (the web history bridge). Row DN-4.
- In the rows that build them, pointer lines also go into F-HW-001 (the hero above the slots, DN-8), the Learning Route amendment (Home card folded, Route tab, DN-8 and DN-9), F-CARD-001 and `library/gallery.md` (order, DN-9), F-PAR-001 (Grown-up area name, DN-8) and F-PLC-001 §3.1 step 2 (the default test language, DN-3).

## 15. Open items

- **Shared devices and "newer wins"** (section 5): a grown-up signing in on a device whose record is newer takes that device's language into the account. One tap on Display fixes both. Revisit only if it is reported.
- **The site** (hangulroute.com, another origin) keeps its locale switcher and the browser's text size; it does not read this record. Its "Play now" link already carries `?lang=`.
- **Native builds** (deferred track): the record and `useType()` work as they are; `ScreenHeader` replaces the native header the same way; the history bridge is web only.

## 16. Review log

- 2026-10-16, DN-0 (this PR): measured on `426384b45` (section 1); the four language stores, the type-size uses, the back controls and the confirm calls read in the source; the lecture-mode parts written into `AMENDMENTS-LECTURE-V2.md` section 18 and F-TCH-004 in the same PR. Multi-agent review of this PR to follow (design, accessibility and 200 % / Largest text, privacy and child safety, anti-shame copy, Spanish, Korean).
