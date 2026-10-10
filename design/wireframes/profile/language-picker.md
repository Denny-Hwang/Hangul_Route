# Language picker — first run, settings, console, landing, and taught Korean in every locale (wireframe v1)

Spec: `docs/specs/F-I18N-001-ui-locales.md` §3.3 (pickers), §3.5 (taught Korean), §3.2 (storage)
Audience: **anyone learning Hangul, any age** (CLAUDE.md §1) · a grown-up helping a child · teacher/parent on the web console. Same screens for everyone; no kids mode.
Drafted as one file; promote into the repo as: a language row added to `design/wireframes/onboarding/welcome.md`, a Language card added to `design/wireframes/profile/settings.md`, and `design/wireframes/profile/language-picker.md` (sections C-E).
Code (planned): `WelcomeScreen.tsx`, `ProfileScreen.tsx`, `ConsoleShell` (`apps/web/src/components/console/ui.tsx`), landing footer, design-system `KoreanText`.

Notation: `[[ ]]` primary action, `[ ]` secondary, `( )`/`(•)` radio state, `< >` placeholder for a value filled in by the app. **Endonyms ("English", "한국어", "Español") are fixed constants and are the only text in this file that is not a placeholder** — everything else is "placeholder, length only".

---

## A. Welcome — language row (first run)

### Scenario (Given-When-Then)

Given: the app cold-launches on a device with no profiles, and the browser/OS language is Spanish (Spanish is shipped)
When: Welcome renders
Then: it is already in Spanish; one row of three language chips lets the person pick English, 한국어 or Español without leaving the screen, and the whole screen re-renders live

### Screen goal

"Show the app in the language I read, in one tap, before anything else." (Secondary goal: still reach profile creation in one tap — the primary CTA does not move.)

### Box diagram

```
+----------------------------------+
|                                  |
|          [HOYA waving]           |
|                                  |
|   1 short display line           |  <- in the active locale (placeholder)
|   2-line invitation              |  <- placeholder, never longer than 2 lines in EN; may be 3 in ES
|                                  |
|   [[ PRIMARY CTA ]]              |  -> profiles/create (firstRun)
|                                  |
|   [ secondary: restore ]         |  -> sync/restore
|                                  |
|   ( English ) (•Español) ( 한국어 ) |  <- language row, endonyms; active one marked
|                                  |     hidden entirely if only one locale is shipped
|   1 muted trust line             |
+----------------------------------+
```

- The row sits **below** the CTAs so the primary action never moves (same rule as the restore slot in the existing Welcome wireframe). Chips wrap onto a second line when the screen is narrow; each chip is a full-size touch target.
- Order of chips is fixed (English, Español, 한국어) and never reshuffles by detection, so muscle memory works.
- No back control (first screen of the app).

### Interaction points

- Tap a chip → set the **device** language, mark it chosen, re-render Welcome in that language (no animation, no confirm — nothing to lose on first run). Fires `locale.changed` (source `welcome`).
- Tap the already-active chip → no-op.
- Primary CTA / restore → unchanged destinations.
- Screen reader: each chip reads its endonym in its own language; the group is announced as a single-choice set.

### States

- **success**: as drawn, detected language preselected.
- **empty** (only English shipped): row not rendered; screen identical to today.
- **error** (storage unreadable): the choice still applies for this session; nothing persists; no message shown (first run must never block on storage).
- **long text**: ES lines wrap to more lines; CTA stays fully visible (no truncation anywhere).

### Navigation graph

Enter from: cold launch (no profiles) · landing hand-off `app.hangulroute.com/?lang=<locale>` (sets the choice, then cleans the URL)
Exit to: `profiles/create` · `sync/restore`

### Data needs

- reads: `availableLocales()`, detected locale (`platform/locale`), `device:settings`
- writes: `device:settings.uiLocale`
- telemetry: `locale.changed` `{ from, to, scope: 'device', source: 'welcome' | 'handoff' }`

---

## B. Settings (Profile) — Language card

### Scenario (Given-When-Then)

Given: a profile is active in Profiles & settings, and more than one locale is shipped
When: the person opens the Language card
Then: they can set this profile's language, or the device default for new profiles, and can undo a mis-tap in one step

### Screen goal

"Change the language for this profile (primary); change the device default (secondary)."

### Box diagram

```
+----------------------------------+
| [<- back]  Profiles & settings   |
|  ... profile tiles ...           |
|  [ + Add a profile ]             |
|  ... stats ...                   |
|                                  |
|  Sound                [ on/off ] |
|                                  |
|  Language                        |
|  +----------------------------+  |
|  | This profile               |  |
|  |  (•) Same as device (<x>)  |  |  <- removes the profile override
|  |  ( ) English               |  |
|  |  ( ) Español               |  |
|  |  ( ) 한국어                |  |
|  |----------------------------|  |
|  | New profiles and this      |  |
|  | device start in:           |  |
|  |  ( ) English (•) Español   |  |  <- device default; same three chips
|  |  ( ) 한국어                |  |
|  |----------------------------|  |
|  | Reading practice           |  |
|  |  (•) Always show romanization |  <- RomanizationMode 'always' (default)
|  |  ( ) Hide until I tap      |  |     opt-in 'tap'; per profile
|  +----------------------------+  |
|                                  |
|  Plan ... Backup ... Grown-up zone ...
+----------------------------------+
```

- The card is below Sound and above Plan; hidden when only one locale is shipped (the romanization option stays available: it is its own setting — if no second locale exists, show only the "Reading practice" rows under a card titled for reading).
- Not behind the grown-up gate (reversible, changes display only).

### Confirm sheet (appears when the chosen language differs from the current one)

```
+----------------------------------+
|  <in the NEW language>           |
|  "Use <language> for this        |  <- placeholder, length only
|   profile?"                      |
|                                  |
|  [[ USE <NEW> ]]                 |
|  [ Back to <previous endonym> ]  |  <- always visible, labelled with the previous endonym
+----------------------------------+
```

- The sheet is written in the language being chosen, so the person sees immediately whether they can read it; "Back to <previous endonym>" is the escape.

### Interaction points

- Profile radio → confirm sheet → on confirm: `setProfileLocale(active.id, l)` (or removes the override for "Same as device"); card and whole screen re-render live. `locale.changed` (scope `profile`, source `settings`).
- Device-default radio → same sheet → `setDeviceLocale(l)`. `locale.changed` (scope `device`).
- Romanization radio → immediate (no sheet); `romanization.mode_changed`.
- [<- back] → `home/todays-mission` (existing).

### States

- **success**: as drawn.
- **empty** (one profile, nothing set): "Same as device" selected, device default = detected language.
- **error** (storage write fails): the new language applies for the session; a muted one-line note "not saved on this device" (placeholder) in the new language; no blocking.

### Data needs

- reads: `locale-store` (`device`, `byProfile[activeId]`, `detected`), `availableLocales()`
- writes: `settings:<profileId>` (`uiLocale`, `romanizationMode`), `device:settings`
- telemetry: `locale.changed`, `romanization.mode_changed`

---

## C. Console header and landing switcher (web)

### Scenario (Given-When-Then)

Given: a teacher or parent on the console, or a visitor on the landing page, whose language is not English
When: they look for a way to change language
Then: a native select in the console header, and plain links in the landing footer (with a one-time suggestion banner), change the language without any account

### Box diagram — console header

```
+------------------------------------------------------------+
| <- Hangul Route   Console  . <page title>                  |
|                  [ Language v ] [ Account ] [ Billing ] [ Sign out ] |
+------------------------------------------------------------+
   Language v  ->  English / Español / 한국어  (native select, endonyms)
```

### Box diagram — landing

```
+------------------------------------------------------------+
| [banner, dismissible, only on "/" and only when the browser |
|  prefers an available non-English language:                 |
|  "View in <endonym>"  [ switch ]  [ x ]                     |
+------------------------------------------------------------+
|   ... hero / sections in the route's language ...           |
+------------------------------------------------------------+
| footer:  English . Español . 한국어   (plain links, hreflang)|
|          privacy . terms . about                            |
+------------------------------------------------------------+
```

### Interaction points

- Console select → `setLocale(l)`, stored in `hr:console:uiLocale`; page re-renders in place (client components). No telemetry (no web client).
- Landing footer link → `/`, `/es/`, `/ko/` (prerendered). "Play now" on `/es/` or `/ko/` adds `?lang=<locale>` to the app URL.
- Banner [ switch ] → the matching locale route; [ x ] → dismissed for the session. Never an automatic redirect.
- `/es/privacy` and `/es/terms` show the English legal text under a localized notice that English is authoritative (until legal review).

### States

- **success**: as drawn.
- **empty** (storage blocked): select works for the session only.
- **error** (JS disabled on the landing): static route HTML is already in the route's language; the banner and nothing else is lost.
- **long text**: header `<nav>` wraps (it already uses `flexWrap`); ES button labels wrap to two lines rather than clip.

### Data needs

- reads: `navigator.languages`, `hr:console:uiLocale`
- writes: `hr:console:uiLocale`

---

## D. Taught Korean in every locale (component sketch: `KoreanText`)

### Scenario (Given-When-Then)

Given: a learner in the English, Spanish or Korean UI sees a taught word
When: the word is shown
Then: the Hangul always looks like a *target* (chip + romanization + gloss), so it can never be mistaken for UI text — even in the Korean UI where all the menus are Hangul too

### Box diagram — the same item in the three UIs

```
EN UI                         ES UI                         KO UI
+-----------------------+     +-----------------------+     +-----------------------+
| <instruction, EN>     |     | <instruction, ES>     |     | <instruction, KO>     |  <- UI text: plain, no chip
|                       |     |                       |     |                       |
|   +---------------+   |     |   +---------------+   |     |   +---------------+   |
|   |   [ 강아지 ]   |   |     |   |   [ 강아지 ]   |   |     |   |   [ 강아지 ]   |   |  <- target chip: same in all locales
|   +---------------+   |     |   +---------------+   |     |   +---------------+   |
|   gangaji      [spk]  |     |   gangaji      [spk]  |     |   gangaji      [spk]  |  <- romanization + speaker, always
|   puppy               |     |   cachorro            |     |   <KO description>    |  <- gloss in the UI language
|   [picture]           |     |   [picture]           |     |   [picture]           |
+-----------------------+     +-----------------------+     +-----------------------+
```

- The Korean-UI gloss is a short Korean **description** (not the word repeated); the picture stays the main meaning carrier for pre-readers.
- The chip, the romanization line and the speaker affordance are identical across locales; only the surrounding UI text and the gloss change.
- UI sentences never embed the taught item; the item is always its own chip.

### Interaction points

- Chip / speaker tap → play the word (TTS now, recorded `audioRef` later; visible text fallback if no Korean voice — F-AUDIO-004).
- Romanization mode `tap`: romanization line replaced by a [ show ] affordance; tapping reveals it for this item; gloss stays visible.
- Screen reader: reads the chip as Korean ("Korean: …" in the UI language) with the Korean speech language.

### States

- **success**: as drawn.
- **empty** (gloss missing for the locale): English gloss shown (fallback); no blank line.
- **error** (no Korean voice available): speaker affordance replaced by a muted "no voice on this device" line (F-AUDIO-004); text unaffected.

---

## E. Flow summary

```
cold launch ──► Welcome (detected locale, language row) ──► create profile ──► first quest
                    │ tap chip: re-render live, device choice stored
                    ▼
            Profiles & settings ──► Language card ──► (confirm sheet in NEW language) ──► applied
                                         └─ device default / this profile / romanization mode

landing /es/ ──► Play now (?lang=es) ──► app first run: device choice = es (if none stored)
console header select ──► client-side locale (hr:console:uiLocale)
```

Entry points: Welcome (first run), Profile (any time), console header, landing footer/banner, `?lang=` hand-off.
Exit points: back to the screen the person came from; nothing here leaves the app.

## Open questions

- **Gate or not**: the Language card is ungated by decision (F-I18N-001 L7). In a household where a young child could switch to a language they cannot read, is the confirm sheet + "Back to <previous endonym>" enough, or should the card sit behind the grown-up gate? Test in the next hallway session.
- **Chip count at narrow widths**: three endonym chips fit on one line at 320 only in English/Spanish/Korean as written; verify with the pseudo-locale and a real 320 device, and decide whether the row becomes a vertical list below a width.
- **Korean UI gloss**: description only (decided) vs an opt-in extra English gloss for a Korean-speaking heritage child — not decided.
- **Beta label**: while a locale is awaiting native review it is hidden, not "beta"; confirm we never want a visible beta tag (it would itself need translating).
- **Reading practice placement**: romanization mode lives in the Language card for now; F-LEARN-001 may move it next to the level choice.
