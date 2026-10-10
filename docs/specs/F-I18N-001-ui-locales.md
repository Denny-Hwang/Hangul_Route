Status: ready

# F-I18N-001 — UI locales: English, Korean and Spanish, end to end

**Scope**: new `packages/i18n` · `packages/content-schema` (locale + overlay schemas, telemetry names) · `apps/mobile` (locale store, pickers, string extraction, platform detection) · `apps/web` (console locale provider, landing `/es/` `/ko/`, string extraction) · `packages/design-system` (`KoreanText`, label props) · `scripts/validate-content.mjs` (F-CNT-001 becomes locale-aware) · `scripts/check-i18n.mjs` (new) · `content/i18n/**` (new)
**Owner**: solo dev
**Rollout**: after F-PLAN-001. English extraction ships first with no visible change, then Spanish, then Korean, each hidden until native review (§6).
**Wireframes**: `design/wireframes/onboarding/welcome.md` (language row) · `design/wireframes/profile/settings.md` (language card) · new `design/wireframes/profile/language-picker.md` — drafted in one file: `wireframes/i18n-locale-picker.md`

Parent / siblings: CLAUDE.md §1 "Languages" and §8 (last bullet) · F-CNT-001 §1.1 (policy text) · F-CNT-002 (romanization policy, D13) · F-AUDIO-004 (speech languages) · F-LEARN-001 (level labels, learner type) · F-PLC-001 (placement; test language, D10) · F-STORY-003 / F-STORY-004 (their `copy.ts` / `shelf-copy.ts` move into `messages/en/learner.ts`) · F-TCH-004 and F-PLAN-002 (console copy) · F-LAYOUT-001 (long-string layout) · F-HW-001 §3.3 and F-CONSOLE-001 §3.5 (anti-shame word lists) · audit I18N-01..16

---

## 1. Context

The owner's language decision (CLAUDE.md §1, revised 2026-10-09; owner decision D2): **UI strings come from the selected UI locale** — English (default), Korean or Spanish. **Korean as taught content** is a different thing from Korean as a UI locale: in the Korean UI the menus are Korean, and taught items still carry romanization and a gloss. CLAUDE.md §1 and §8 already say that "until the i18n layer ships, English is the only shipped UI locale"; this spec is that layer.

What exists today (all verified in the repo):

- **No i18n anywhere.** `Intl.` is not used in any `.ts`/`.tsx` under `apps/` or `packages/`; there is no localization dependency in `apps/mobile/package.json` or `apps/web/package.json`; the only locale values are `<html lang="en">` (`apps/web/src/app/layout.tsx:11`), `openGraph.locale: 'en_US'` (`apps/web/src/data/landing-copy.ts:43`), `"lang": "en"` in `apps/mobile/public/manifest.webmanifest:12` and the hard-coded `<meta name="description">` in `apps/mobile/scripts/pwa-postbuild.mjs:35`.
- **Every UI string is an inline English literal**, e.g. `apps/mobile/src/screens/onboarding/WelcomeScreen.tsx:16-41`, `apps/mobile/src/navigation/tabs.tsx:40-42` (tab labels), `apps/mobile/src/screens/home/HomeScreen.tsx:188` (`Streak ${streak} day${streak === 1 ? '' : 's'}`). A repo-wide scan of non-test source (excluding `/design-preview`) finds about 2,100 candidate literals (about 10-15% are noise such as icon paths and ids): mobile screens + components about 440, mobile logic prose about 70, mobile content modules about 400 (`content/heritage-cards.ts` 125, `content/quests.ts` 97, `logic/minigame-config.ts` 86, `content/episodes.ts` 57, `content/stages.ts` 29), web console pages + `lib/console` about 500, web landing/legal/data about 330, design-system 5 accessibility strings. Roughly 1,500 unique strings, 7-8k English words, to translate into each of two languages.
- **One copy module** exists: `apps/web/src/lib/console/copy.ts:2-62` (`COPY`, about 60 keys, `as const`, one function message `capWarning` at `:20`, `allCopyStrings()` at `:64-66`, used about 72 times in `apps/web/src`). Its test (`__tests__/copy.test.ts:13-17`) asserts the English `'Free plan: 16 / 20 students'`. It is the template for the typed dictionary below.
- **Clients branch on server error codes, not messages** (`apps/mobile/src/platform/sync-api.ts:85-88`, `apps/web/src/lib/console/api.ts:150-153`), so the backend needs no i18n.
- **The sanctioned storage wrapper** is `apps/mobile/src/platform/storage.ts:10-21` (`readJson` / `writeJson`, key prefix `hr:` at `:8`; IndexedDB on web in `storage.web.ts:11-22`). `packages/hooks`, which CLAUDE.md §8 names, does not exist; the web stand-in is the guarded `sessionStorage` wrapper in `apps/web/src/lib/console/session.ts:19-27`. Settings already persist per device (`account-store.ts:12-19`, hydrated at `:46-60`) and per profile (`progress:${profileId}`, `progress-store.ts:8`).
- **Cold start is already gated on hydration**: `App.tsx:34-53` mounts a blank canvas until `hydrateLearnerData()` (`store/bootstrap.ts:10-15`) resolves, and `App.tsx:76` renders `RootNavigator` only after. A locale read in that step cannot flash English.
- **Anti-shame word lists are English-only and use ASCII `\b`**: `apps/mobile/src/logic/homework/banned-text.ts:10,18`, `apps/web/src/lib/console/banned-text.ts:6-8` (a hand-kept mirror, comment at `:2-4`), `scripts/validate-content.mjs:42-46`. JS `\b` without the `u` flag has no boundary inside Hangul.
- **Dates and plurals are hand-rolled English**: three separate `MONTHS` arrays (`rollup.ts:55`, `billing.ts:51`, `plans.ts:69`), `relativeDay` / `codeExpiry` (`rollup.ts:58-78`), `plural(n, one, many)` (`routing.ts:67-69`), `=== 1 ? '' : 's'` suffixing in at least seven places (`HomeScreen.tsx:188`, `HomeworkScreen.tsx:64`, `plan/page.tsx:142`, `space/page.tsx:135`, `SchoolAdmin.tsx:130`, `rollup.ts:78`, `stage1-catalog.ts:50`), and USD price labels stored as English (`packages/content-schema/src/schemas/entitlement.ts:64-67`, read at `apps/mobile/src/logic/paywall.ts:21`).
- **Learner names were English-only; fixed in PR #97 (merged)**: `validateDisplayName` (`apps/mobile/src/logic/profiles/profile-model.ts:43`) now accepts `/^[A-Za-zÀ-ɏ가-힣0-9 '’-]+$/` (explicit ranges, no `\p{…}`), returns the code `'unsupported-character'` (was `'non-latin'`), and `profile-model.test.ts:54-64` covers "María", "Zoë", "수니" (valid) and emoji, `日本`, `Мария`, control characters (invalid). What is **left** for this spec is only the hint string: `CreateProfileScreen.tsx:63-64` still hard-codes "Please use letters, numbers, spaces, ' or -." in English (§3.9).
- **The validator** (`scripts/validate-content.mjs`) walks every `content/**/*.json` as English source: Hangul allowed only in `ko`, `korean`, `target`, `answer_ko`, `lang_ko` (`:25-32`), rule `korean-in-ui-field` for any other field (`:103-115`), English-only learner fields (`:49-61`). F-CNT-001 §1.1 and §4 already say overlays are this spec's job; the validator code has not changed.
- **Content has three diverging copies** (audit I18N-07): `content/episodes/stage-1/{jamo,cards}.json` (24 + 24 entries, the only thing the validator scans), `apps/mobile/src/content/*.ts` (what the app ships) and `apps/web/src/data/stage1-cards.ts`. D4 (JSON-first, generated into apps, validator scans the shipped content) fixes that in F-CNT-002 / the story pipeline; this spec's overlay mechanism is built to work on both shapes (§3.6).

Terms. **Source locale**: `en`; English strings and `*En` fields are the source of truth. **Overlay locale**: `es`, `ko`. **UI string**: text the product writes (labels, instructions, Hoya lines, errors). **Taught Korean**: a jamo, word, phrase or sentence the learner is studying; it comes from content, never from a message. **Gloss**: the meaning of a taught item in the UI language. **Endonym**: a language's own name ("English", "한국어", "Español").

## 2. User story

> As someone learning Hangul — a child with a parent beside them, a teenager, a heritage grandparent, or an adult on their own — I want the whole app in English, Spanish or Korean, chosen on the first screen and changeable in settings, so that I understand every instruction while the Korean I am learning stays clearly marked, with its romanization and a gloss in my language.

> As a teacher or parent I want the console and the grown-up screens in my language too, and never a shaming word in any language.

## 3. Acceptance criteria

### 3.1 `packages/i18n` — a new package (owner-approved)

Approved by owner decision D2 (UI locales end to end; CLAUDE.md §1 makes a new `packages/i18n` conditional on owner approval) together with D4 (new `content/` directories); D8 only fixes the spec id. Recorded here so CLAUDE.md §2 can list it (§9). No third-party i18n library (i18next needs a PluralRules polyfill on Hermes; Lingui needs a Babel/SWC macro in Metro and Next; with ~1,500 strings, three locales and strict-TS/TDD, a typed dictionary gives compile-time key safety with zero runtime dependencies and works unchanged in Next `output: 'export'` (`apps/web/next.config.js:6`) and Expo).

Shape follows `packages/content-schema` (`package.json`: `"main": "./src/index.ts"`, `exports`, scripts `lint test test:coverage typecheck build`; `vitest.config.ts` with `include: ["src/**/*.test.ts"]`; `tsconfig.json` as `content-schema`'s). Consumers: add `"@hangul-route/i18n": "workspace:*"` to `apps/mobile`, `apps/web`; add `'@hangul-route/i18n'` to `transpilePackages` (`apps/web/next.config.js:8-12`); add `packages/i18n` to `vitest.workspace.ts`. The only dependency is `@hangul-route/content-schema` (for the locale constants, §3.2). `packages/design-system` does **not** depend on it (§3.4).

```
packages/i18n/src/
  index.ts            public API (below)
  types.ts            Widen, DeepPartial, Messages, MessageFn
  locales.ts          LOCALES, DEFAULT_LOCALE, LOCALE_META, LOCALE_STATUS, availableLocales()
  detect.ts           detectLocale(languages, available?)
  resolve.ts          resolveLocale({ profile, device, detected }), getMessages(locale), fallbackPaths(locale)
  plural.ts           plural(locale, n, forms)
  format.ts           formatDate, formatNumber, formatUsd, describeRelativeDay (Intl with a fallback table)
  banned.ts           findBannedWord(text, locale, surface), scanCopy(texts, locale, surface)
  banned-words.json   the one list per locale x surface (also read by scripts/validate-content.mjs)
  romanization.ts     romanizationShown(mode, revealed)
  pseudo.ts           pseudoLocalize(messages), PSEUDO_LOCALE = 'en-XA'
  messages/
    en/{common,learner,caregiver,console,landing,a11y}.ts + index.ts     source, `as const`
    es/…  ko/…                                                           overlays, `satisfies DeepPartial<Messages>`
    review-ledger.json                                                   §3.10
  __tests__/
```

**Typed dictionary.** English is the source and defines the type. Because `as const` makes every leaf a string-literal type, the contract widens leaves first; otherwise no translation could satisfy it:

```ts
// types.ts
export type Widen<T> =
  T extends string ? string
  : T extends (...args: infer A) => string ? (...args: A) => string
  : T extends readonly (infer U)[] ? readonly Widen<U>[]
  : T extends object ? { [K in keyof T]: Widen<T[K]> }
  : T;
export type DeepPartial<T> =
  T extends (...args: never[]) => unknown ? T
  : T extends readonly unknown[] ? T            // arrays are replaced whole, never patched by index
  : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;
// messages/en/index.ts:  export const en = { common, learner, caregiver, console: consoleMsgs, landing, a11y } as const;
//                        export type Messages = Widen<typeof en>;
// messages/es/learner.ts: export const learner = { home: { streak: (n: number) => … } } satisfies DeepPartial<Messages['learner']>;
```

`satisfies` (TypeScript >= 4.9; the repo uses `^5.6.3`) gives excess-property checking, so a mistyped key in `es`/`ko` is a compile error, and a function message must keep English's parameter list.

**Messages are strings or functions — one mechanism, no `{placeholder}` templates.** A message with a variable, a count or a word-order concern is a function (`(n: number) => string`), exactly like `COPY.capWarning` (`copy.ts:20`). Word order (Korean is SOV) and agreement (Spanish) are then plain TypeScript per locale, never string concatenation. Rule for authors: **a sentence is one message** — never `'You have ' + n + ' things'`; never a message that is a fragment glued to another.

**Resolution and fallback.** `getMessages(locale): Messages` returns `deepMerge(en, overlay[locale])`, memoised per locale: a key missing in an overlay falls back to the English value (arrays and functions are replaced whole). `fallbackPaths(locale): string[]` lists the dotted paths that fell back; tests and `scripts/i18n-status.mjs` use it; the app never logs it in production (CLAUDE.md §8: no `console.log`). The API takes an **explicit locale**, so a feature can render in a locale other than the UI locale (placement test language, D10; a lecture deck, D12).

```ts
getMessages('es').learner.home.streak(3)   // "Racha de 3 días"
lookup(getMessages('ko'), 'learner.home.streak')  // string path access: for tooling and tests only, not app code
```

**`plural(locale, n, { one, other })`** — hand-rolled (the repo has no `Intl` usage, and `Intl.PluralRules` on Hermes/RN 0.76 is unverified — see §10): `en`, `es` → `one` when `n === 1`, else `other` (`0` and `1.5` are `other`); `ko` → always `other` (the `one` form is ignored). Each locale file passes its own locale: `plural('en', n, { one: 'Streak 1 day', other: \`Streak ${n} days\` })`.

**Formatters** (`format.ts`) wrap `Intl.DateTimeFormat` / `Intl.NumberFormat` and **never throw**: if `Intl` is missing or the locale unsupported they fall back to a small built-in table of short month and weekday names for `en`/`es`/`ko`. They replace the three `MONTHS` arrays, `WEEKDAYS` (`rollup.ts:54-55`) and the `'$…'` strings: `formatDate(locale, date, 'weekday' | 'monthDay' | 'monthDayYear')`, `formatNumber(locale, n)`, `formatUsd(locale, amount)`. Relative day words (today, yesterday, not yet) are messages: `describeRelativeDay(locale, m.common.time, iso, now)` replaces `relativeDay` (`rollup.ts:58-69`); `codeExpiry` (`:72-78`) becomes a message function using `plural`. Prices: the UI derives "one payment" / "per year" wording from `PLAN_PRICING[…].amountUsd` and `.per` (`entitlement.ts:64-67`) plus `formatUsd`; the English `label` field stays in the schema (no schema change) but no UI reads it after PR 9.

**Locale metadata** (`locales.ts`) — the only place endonyms and speech tags live, as constants, not messages:

| locale | endonym | `htmlLang` | `speechLang` (used by F-AUDIO-004) | `ogLocale` |
|---|---|---|---|---|
| `en` | English | `en` | `en-US` | `en_US` |
| `es` | Español | `es` | `es-US` (voice picker falls back to any `es-*`, `audio.web.ts:37-41`; `SpeakOptions.language` is typed `'ko-KR' \| 'en-US'` at `platform/audio.ts:20`, so F-AUDIO-004 widens it to `LOCALE_META` tags) | `es_419` |
| `ko` | 한국어 | `ko` | `ko-KR` | `ko_KR` |

`LOCALE_STATUS: Record<Locale, 'shipped' | 'hidden'>` — `en: 'shipped'`; `es`, `ko` start `'hidden'` and are flipped in PR 15/16 after native review (§3.10). `availableLocales()` returns the `'shipped'` ones (all three when `EXPO_PUBLIC_SHOW_ALL_LOCALES=1` / `NEXT_PUBLIC_SHOW_ALL_LOCALES=1` for QA builds). Pickers list only `availableLocales()`; detection never auto-selects a hidden locale (a Spanish phone sees English until Spanish ships).

**`detectLocale(languages, available = availableLocales())`**: walk the preference list in order, take the primary subtag (lower-case, split on `-` or `_`: `es-MX` → `es`, `ko_KR` → `ko`), return the first one that is in `available`; unknown languages are skipped (`['fr', 'es-MX']` → `es`); empty or none → `'en'`. `resolveLocale({ profile, device, detected })` = first defined of `profile`, `device`, `detected`, else `'en'`.

**Pseudo-locale** `en-XA` (not user-selectable): `pseudoLocalize(messages)` maps every string to `[` + accented text padded with `~` to +40% length + `]` and wraps each function message so its output is transformed too. Accepted by `getMessages` only when the build flag `EXPO_PUBLIC_PSEUDO_LOCALE=1` / `NEXT_PUBLIC_PSEUDO_LOCALE=1` is set (§3.11).

**Banned words, per locale and surface** (`banned.ts` + `banned-words.json`): one JSON file `{ "<locale>": { "learner": [...], "caregiver": [...] } }` read by TypeScript (`resolveJsonModule`) **and** by the Node validator (§3.7), which retires the hand-synced duplicates (`banned-text.ts:6-8` comment in the mobile file, `:2-4` in the web file; F-HW-001 §9.5). Matching: `en`, `es` use **token matching with explicit letter ranges** — lower-case the text, split on `/[^a-zà-ɏ0-9]+/`, and compare whole tokens against the list (the ASCII `\b` of `banned-text.ts:18` misreads accented letters, so `\b` is not reused). Deliberately **no `\p{L}` property escapes and no look-behind**: Hermes support for both is unverified (the same reason PR #97 used explicit ranges for names), and the token approach needs neither. `ko` uses substring matching (particles attach to the stem: `실패했어요`). Seed lists, to be confirmed by the native reviewers:

| locale | learner surface | caregiver adds |
|---|---|---|
| `en` | missed, incomplete, failed, overdue (unchanged, `banned-text.ts:10`) | behind, lazy (unchanged, web `banned-text.ts:6`) |
| `es` | fallaste, fallido, incompleto, incompleta, atrasado, atrasada, vencido, vencida, perdiste | retrasado, retrasada, vago, perezoso, flojo |
| `ko` | 실패, 미완료, 놓친, 밀린, 기한 초과 | 뒤처, 게으른 |

`apps/mobile/src/logic/homework/banned-text.ts` keeps its exported names (`BANNED_LEARNER_WORDS`, `findBannedWord`, `isLearnerSafe`, `scanLearnerCopy`) and delegates to the package with a defaulted `locale = 'en'` argument, so existing callers and tests do not change; `apps/web/src/lib/console/banned-text.ts` becomes the same kind of thin re-export.

**Romanization display setting** (D2): `RomanizationMode = 'always' | 'tap'`, default `'always'`. `romanizationShown(mode, revealed)` returns `true` when `mode === 'always'` or `revealed`. This is the single implementation; F-STORY-003's `logic/story/romanization.ts` (its §3 table) is a re-export of it.

- **Given** `getMessages('es')` where `es.learner.home` lacks `title`, **when** read, **then** the English `title` is returned and `fallbackPaths('es')` contains `learner.home.title`.
- **Given** an `es` file with a key `learner.home.titel`, **when** type-checked, **then** compilation fails (excess property).
- **Given** `plural('es', 0, …)`, `plural('es', 1, …)`, `plural('ko', 1, …)`, **then** `other`, `one`, `other`.
- **Given** `formatDate('ko', …)` on a runtime without `Intl`, **then** a fallback string is returned and nothing throws.
- **Given** `detectLocale(['es-MX','en'], ['en'])` (Spanish hidden), **then** `'en'`.

### 3.2 Locale data model, storage, hydration

Locale is a **local-first device preference**, not part of the synced `Profile`: `ProfileSchema` (`packages/content-schema/src/schemas/profile.ts:25-34`) is embedded in `BackupFileSchema` (`schemas/sync.ts:79-85`) and its learner fields are mirrored in D1 (CHECK on `ageGroup`), so locale does not go there. No migration, no API change. **Settings ownership (one owner, one name)**: this spec alone creates `ProfileSettingsSchema` / `DeviceSettingsSchema` (`schemas/locale.ts`) and the keys `device:settings` / `settings:${profileId}`. **F-LEARN-001 adds no field to them** (its `learnerType` is an optional field of `ProfileSchema`, device-local by its decision L2); any later spec that needs a per-profile preference (F-STORY-002 `readToMe`, F-PLC-001 test language) must extend `ProfileSettingsSchema` additively and say so in its own Decisions. (Trade-off: a learner restored onto a new device starts from that device's default; acceptable.)

New file `packages/content-schema/src/schemas/locale.ts` (exported from `index.ts`, 100% covered like the rest of the package):

```ts
export const UI_LOCALES = ['en', 'es', 'ko'] as const;
export const UiLocaleSchema = z.enum(UI_LOCALES);
export type UiLocale = z.infer<typeof UiLocaleSchema>;
export const DEFAULT_UI_LOCALE: UiLocale = 'en';
export const RomanizationModeSchema = z.enum(['always', 'tap']);
/** Per-profile local settings; other specs may add optional fields (additive only). */
export const ProfileSettingsSchema = z.object({
  uiLocale: UiLocaleSchema.optional(),                    // absent = "same as this device"
  romanizationMode: RomanizationModeSchema.default('always'),
});
/** Per-device settings. */
export const DeviceSettingsSchema = z.object({
  uiLocale: UiLocaleSchema.optional(),                    // absent = never chosen: use detection
});
```

`packages/i18n` re-exports `UiLocale` / `UI_LOCALES` from here (one source of truth; i18n depends on content-schema, never the reverse).

**Storage keys** (through `readJson` / `writeJson`, `platform/storage.ts:10-21`; the wrapper adds the `hr:` prefix): `device:settings` (a `DeviceSettings`) and `settings:${profileId}` (a `ProfileSettings`). Reads are parsed with `safeParse`; a value that fails to parse is ignored (treated as unset) — storage can never crash start-up. Removing a profile (`profile-store.remove`) also removes `settings:${profileId}`.

**Mobile state**: `apps/mobile/src/store/locale-store.ts` (zustand, like `account-store.ts`):

```ts
State:   { detected: UiLocale; device: UiLocale | null; byProfile: Record<string, ProfileSettings>; hydrated: boolean }
Actions: hydrate(profileIds: string[]) · setDeviceLocale(l | null) · setProfileLocale(profileId, l | null)
         · setRomanizationMode(profileId, mode)
Selector: activeLocale(state, activeProfileId) = resolveLocale({ profile: byProfile[activeProfileId]?.uiLocale, device, detected })
```

`detected` is computed synchronously at store creation from `platform/locale.ts` (§3.3), so the very first render already has a sensible locale. `hydrateLearnerData()` (`store/bootstrap.ts:10-15`) gains one step after `profileStore.hydrate()`: `await useLocaleStore.getState().hydrate(profiles.map(p => p.id))`. Because `App.tsx:76` renders the navigator only after that resolves, there is no English flash. Hooks: `useMessages(): Messages` and `useLocale(): UiLocale` in `apps/mobile/src/i18n/use-messages.ts` (`getMessages(activeLocale)` memoised; re-renders on change). The hook is a thin selector over the tested store and `getMessages`; it has no unit test of its own (the mobile vitest config cannot render hooks, `apps/mobile/vitest.config.ts:19-25`, the same reason `platform/motion.ts` is excluded) and is exercised by `e2e/web/locale.spec.ts`. Business logic modules stay pure and never import the store (§3.4).

**Web**: `apps/web/src/lib/i18n/safe-storage.ts` (new; try/catch `localStorage`, returns `null` on SSR, private windows or blocked storage — extract the guard that `session.ts:19-27` already has rather than adding a third copy; this is the web stand-in for the missing `packages/hooks`, CLAUDE.md §8), key `hr:console:uiLocale`; `locale-context.tsx` provides `useMessages()` / `useLocale()` / `setLocale()` to client components. Initial value: stored choice → `detectLocale(navigator.languages)` → `'en'`; computed in an effect after mount, so SSR/static HTML is always the locale of the route (English for `/teach`) and the client switches without a layout shift. The learner app (`app.hangulroute.com`) and the site (`hangulroute.com`) are different origins, so their storages are independent; the hand-off is the `?lang=` parameter (§3.3).

- **Given** a device whose browser languages are `['es-MX','en']` and Spanish is `'shipped'`, **when** the learner app starts with no stored settings, **then** `activeLocale` is `es` and `device` stays `null` (detection is a default, not a choice).
- **Given** `device = 'ko'` and profile A has `uiLocale: 'es'`, **when** profile B (no override) is active, **then** the UI is Korean; **when** A is activated, Spanish.
- **Given** stored settings that fail `safeParse` (corrupt JSON), **when** hydrating, **then** the locale falls back to detection and the app starts normally.
- **Given** storage throws on read (iOS private mode), **when** hydrating, **then** `readJson` returns `null` (`storage.ts:13-16`) and the picker still works for the session; nothing is persisted.

### 3.3 Detection and pickers

**Platform detection**: `apps/mobile/src/platform/locale.ts` returns `readonly string[]` — native: `getLocales().map(l => l.languageTag)` from `expo-localization` (add `expo-localization ~16.0.0`, the SDK 52 line; verify the exact range at install — §10); web variant `locale.web.ts` (Metro picks `.web.ts`, precedent `storage.web.ts`): `navigator.languages ?? [navigator.language]`. Both are wrapped in try/catch and return `[]` on failure. Platform lane (>= 70%).

**Web hand-off**: the landing's "Play now" links add `?lang=<locale>` when the visitor is on `/es/` or `/ko/` (the app URL is `APP_URL`, `apps/web/src/app/page.tsx:19`). `locale.web.ts` reads `?lang=`; if it is an available locale **and** `device` was never chosen, it is stored as the device choice, then the parameter is removed with `history.replaceState`. A parameter never overrides a stored choice.

**First run — Welcome** (`WelcomeScreen.tsx`): the screen renders immediately in the detected locale. Below the primary CTA and above the trust line a **language row** shows the endonyms of `availableLocales()` as tappable chips; the active one is marked. Tapping a chip calls `setDeviceLocale(l)` (and records the choice, so detection is no longer consulted) and the whole screen re-renders live. The row is hidden when `availableLocales().length < 2`. It is **not** behind the grown-up gate (first run: nothing to protect). Chip labels are the endonyms, so a person who cannot read the current language can still find their own; accessibility labels are the endonym (`accessibilityLabel` "Español"), with `accessibilityLanguage` / `lang` set to that language where the platform supports it.

**Settings — Profile** (`ProfileScreen.tsx`; the "Profiles & settings" heading is at `:88`, the Sound card at `:153-173`): a **Language card** directly under the Sound card with two parts: (1) "This profile": options `Same as this device (<endonym>)` · English · 한국어 · Español → `setProfileLocale(active.id, l | null)`; (2) "New profiles and this device start in": the same options without "Same as…" → `setDeviceLocale(l)`. Changing to a different locale first shows a small confirm sheet rendered **in the new language** with a prominent "Back to <previous endonym>" action, so a mis-tap into a language you cannot read is one tap from undone. Not PIN-gated: changing display language is reversible and touches no data (decision L7; the wireframe lists "gate or not" as an open question — resolved here: not gated, and F-LEARN-001 L7 does not change that, because a self-only device may have no PIN at all). The two language rows are hidden when only English is available. **The reading-practice switch is always shown** in the same card (D2: it does not depend on a second locale): "Reading practice: hide romanization until I tap", default off, calls `setRomanizationMode(active.id, 'tap' | 'always')`, per profile, not PIN-gated.

**Console** (`ConsoleShell`, `apps/web/src/components/console/ui.tsx:80-104`): a locale `<select>` (native, accessible) in the header `<nav>` next to Billing/Sign out; persists to `hr:console:uiLocale`.

**Landing**: a footer switcher of plain links (`/`, `/es/`, `/ko/`) with `hreflang`; and, on `/` only, a dismissible banner "View in <endonym>" when `navigator.languages` prefers an available non-English locale (never an automatic redirect — the static export has no middleware, `next.config.js:6`). Routing in §3.4.

- **Given** first run on a Spanish phone with Spanish shipped, **when** Welcome renders, **then** it is in Spanish with "Español" marked, and tapping "English" re-renders in English without leaving the screen.
- **Given** a Spanish-detecting phone but `es` hidden, **then** Welcome is English and the language row is absent.
- **Given** an active profile with an override, **when** "Same as this device" is chosen, **then** `settings:${id}.uiLocale` is removed and the device locale applies.
- **Given** the learner opens `https://app.hangulroute.com/?lang=ko` on a fresh device, **then** the device choice becomes `ko` and the URL is cleaned; on a device that already chose English, **then** nothing changes.

### 3.4 String extraction — rules and surface order

**Rules (all surfaces):**

1. Source of truth is `messages/en/*.ts`; the first PR for a surface changes **no visible text** (English snapshot / e2e tests stay green).
2. Namespaces: `common` (buttons, time words, generic errors), `learner` (mobile learner screens, one sub-object per screen: `learner.welcome`, `learner.home`, …), `caregiver` (PIN, parent dashboard, paywall, restore/save/join, install), `console`, `landing` (site metadata, landing, about, legal notices), `a11y` (accessibility labels, tab labels). `COPY` (`copy.ts:2-62`) moves to `messages/en/console.ts` keeping its keys and function messages; `capWarning` stays `(used, total) => string`.
3. **Logic returns codes and structured data, never prose.** Decisions (`gating.ts`: messages at `:40,47,54`, the doc comment at `:15`) already return `reason: GateRejection = 'unknown-quest' | 'episode-not-shipped' | 'stage-locked'` (`:10`); they additionally return `learnerName` instead of a prose `message`, and the screen renders `m.caregiver.gating[reason](name)` (`GateResult.message` is removed once PR 7a has migrated callers). Formatters (`status-line.ts`: `cloudStatusLine` `:11-24`, `saveNowNote` `:27-33`; `join-code.ts`, `restore.ts`, `mission-builder.ts`, `assignment-groups.ts`, `install-guide.ts`, `paywall.ts`) take the relevant message subtree as a parameter (`cloudStatusLine(state, now, m.sync, locale)`), staying pure and unit-testable per locale.
4. Plurals, counts, dates, money: message functions + `plural` / `format*` only. A CI grep (§3.11) bans `=== 1 ? '' : 's'` (and the `?` `'s'` variants) in non-test source.
5. **A message never embeds taught Korean.** A prompt about a letter is a message plus a `KoreanText` element (§3.5). The `en`/`es` dictionaries contain no Hangul at all (tested); only `ko` may.
6. Brand and character: the app name stays "Hangul Route" in every locale; Hoya is "Hoya" in `en`/`es` and "호야" in `ko` (CLAUDE.md §1 names the guide "Hoya (호야)"). Avatar pillar names (`avatar-catalog.ts`, Hangul `pillarName` + `romanization`) are taught-style items and would render with `KoreanText` if they were ever shown; today they are not, and F-LEARN-001 L12 keeps them out of the UI. What the UI shows is the avatar's English `label` ("Book Tiger"), which becomes `m.learner.avatars[kind]` in PR 5 (keyed by `AvatarKind`, so `es`/`ko` can translate it).
7. Server error handling stays code-based; a `caregiver.errors.byCode: Record<string, string>` map plus `generic` renders the code (`api.ts:150-153`, `sync-api.ts:85-88`).
8. **Names are user data, not UI** — see §3.9.

**Surface migration order** (each its own small PR(s); §6): first-run onboarding + tabs + Profile → learner Home/Journey/Library/Episode/Results/Homework → Quest player + minigames → grown-up surfaces (PIN, dashboard, paywall, restore/save/join, sync, install) → web console infra + `COPY` → console pages → landing/legal → content overlays.

**Design system** takes no copy dependency. The five hard-coded accessibility strings become optional props with the current English as default: `Tile.tsx:110` (already has `accessibilityLabel`; callers pass `m.a11y.tile(label)`), `StarRow.tsx:32` (new `accessibilityLabel?: string`; callers pass `m.a11y.stars(n)`), `HoyaBubble.tsx:86` ("Close Hoya message"; new `dismissLabel?: string`), `Hoya.tsx:275` and `HeritageCardArt.tsx:1226` (already have `accessibilityLabel`; callers pass `m.a11y.hoya(pose)` / the localized card title). No visual or API break.

**Web landing routing** (static export, no middleware): English stays at `/` (default, no redirect). `/es/` and `/ko/` are prerendered. `<html lang>` must be correct in the static HTML, and the root layout cannot see a `[locale]` param unless it lives inside that segment, so the site pages move under Next **route groups with separate root layouts**: `app/(site)/…` (English `/`, `/about`, `/privacy`, `/terms`, `lang="en"`), `app/(site-i18n)/[locale]/…` (`generateStaticParams` → `es`, `ko`; layout renders `<html lang={locale}>`), and `app/(app)/…` (`teach`, `parent`, `design-preview`; client-side `LocaleProvider`, no URL prefix — every `/teach` page is `'use client'`). Page bodies become shared components `LandingPage({ locale })`, so no copy is duplicated. Per-locale `generateMetadata` (title, description, `openGraph.locale`, `alternates.languages` for hreflang) replaces the single `siteMetadata` (`landing-copy.ts`, used at `layout.tsx:7`). **Verified in a throwaway prototype** (Next 14.2.35, the repo's line `^14.2.18`; `output: 'export'`; `(en)`, `(loc)/[locale]` with `dynamicParams = false` and `generateStaticParams`, `(console)` groups with separate root layouts): `next build` writes `out/index.html` (`<html lang="en">`), `out/es.html` and `out/ko.html` (`<html lang="es">` / `"ko"`), `out/es/about.html`, `out/teach.html`. **Note the file names**: `trailingSlash` is off (`next.config.js`), so the locale home is `out/es.html`, not `out/es/index.html`; `apps/web/wrangler.toml` has `html_handling = "auto-trailing-slash"`, which serves it at both `/es` and `/es/`. The PR's verification step is therefore: after `next build`, `out/es.html` contains `<html lang="es">` and the hreflang links. Fallback if a later Next upgrade breaks multi-root layouts: a client effect sets `document.documentElement.lang`, with the static `lang` left on the default.

**Moving the pages breaks three existing tests that name paths**: `apps/web/src/app/__tests__/audience-copy.test.ts:20-29` (`PUBLIC_SURFACES` joins `app/layout.tsx`, `app/page.tsx`, `app/about|privacy|terms/page.tsx`), `landing-layout.test.tsx` (imports `../page`) and `apps/web/e2e/landing-layout.spec.ts:14-17` (page list). PR 11b updates all three in the same commit as the move.

**PWA shell** (`apps/mobile`): an effect on locale change sets `document.documentElement.lang` (web variant of `platform/locale`). The manifest stays a single English file (`manifest.webmanifest:12`; it cannot vary per user) and the `<meta name="description">` stays English (`pwa-postbuild.mjs:35`); store listings are localized separately in App Store Connect / Play when native ships. All three dictionaries are bundled statically; the service worker precaches the JS (`pwa-postbuild.mjs:94` glob includes `js`), so every locale works offline.

- **Given** the Spanish locale, **when** the Home streak pill renders with `streak = 1` and `streak = 5`, **then** it reads "Racha de 1 día" and "Racha de 5 días".
- **Given** `gating.ts` returns `{ reason: 'stage-locked', learnerName: 'Jin' }`, **when** rendered in Korean, **then** the sentence uses no particle attached to the variable (see style guide, §3.10).
- **Given** a PR that adds `` `${n} day${n === 1 ? '' : 's'}` `` under `apps/`, **when** CI runs, **then** `scripts/check-i18n.mjs` fails and names the file and line.

### 3.5 Taught Korean in every locale

The product's pedagogical signal "Korean on screen = something I am learning" must survive a Korean UI. Rules:

1. **`KoreanText` component** (new, `packages/design-system/src/components/KoreanText/` — `KoreanText.tsx`, `types.ts`, `index.ts`, same layout as `Tile/`; design mock in `design/components/` first, CLAUDE.md §5). Props: `{ ko: string; romanization: string; gloss?: string; size?; romanizationShown?: boolean; onPress?: () => void; accessibilityLabel?: string; testID? }` — the package has no i18n dependency, so the caller passes the already-localised `accessibilityLabel` (built from `m.a11y.koreanItem`) and the boolean `romanizationShown`. It renders: the Hangul in `typography.family.sansKr` (`tokens.ts:130`) on a **target chip** (an existing-token surface + border, chosen at mid-fi; a new token only through the design-token-sync flow), the romanization line, and the gloss line. The chip + romanization + speaker affordance is the same in all three locales, so the pattern is learned once. For assistive tech: `accessibilityLanguage="ko"` on iOS and `lang="ko"` on web (react-native-web forwards `lang`; verify on device), with `accessibilityLabel` supplied by the caller from `m.a11y.koreanItem({ ko, romanization, gloss })` ("Korean: …" / "한글: …"; default when omitted: `ko, romanization`). **Owner**: this spec (PR 4) is the only creator of `KoreanText`; F-QUEST-002 (Discover, Hangul Check), F-STORY-003 (`ChoiceCard` Korean options, recap chips) and F-STORY-004 (tiles, Culture notes) consume it.
2. **Hangul outside a `KoreanText` is a UI string** and may exist only in `ko` message files. A test over rendered learner-screen output in the `ko` locale (SSR render of the screens' pure view models where available, otherwise a source scan of non-`ko` message files) asserts that taught items are never inlined in messages.
3. **Romanization is always visible by default** (D2), in every locale including `ko`; "hide until tap" (`RomanizationMode = 'tap'`) is an explicit opt-in per profile for reading practice, placement and lecture reveal, set in the Profile screen next to Language (and by a teacher through the same setting in lecture/placement, F-TCH-004 / F-PLC-001). `KoreanText` receives `romanizationShown = romanizationShown(mode, revealedByTap)`. Hiding never removes the gloss.
4. **Gloss in the UI language.** `en` UI: English gloss (`gloss_en` / `en` / `*En`). `es` UI: Spanish gloss from the overlay. `ko` UI: a Korean **definition or description**, not an echo — for 강아지 the Korean gloss is "작고 귀여운 개"-style, not "강아지"; for a jamo, a description of the sound or shape. The validator rejects a Korean gloss identical to the taught string (rule `overlay-circular-gloss`, §3.7) and warns on one that merely contains it as its whole content. The **picture** (illustration / WordArt, D7) remains the primary meaning carrier for pre-readers in all locales.
5. **Where an overlay gloss is missing the English gloss is shown** (fallback) — a visible degradation, counted by `fallbackPaths` and by the validator's `overlay-missing` warning, and an error once the locale is declared complete (§3.7).
6. **Spanish readers** get their own `soundHint` in the jamo overlay ("como la g de gato"), authored fresh — English sound-alikes ("G — sounds like the start of 'go'", `content/episodes/stage-1/jamo.json`) are wrong for Spanish. The **English base** `soundHint` is owned by F-QUEST-002 (`JamoSchema.soundHint`, copy in its Appendix A, Q-1/Q-6); this spec only defines how `es`/`ko` overlays replace it. Revised Romanization stays canonical (`romanization`, D13/F-CNT-002); the hint accompanies it, and audio (F-AUDIO-004) is the real guide.

- **Given** the Korean UI on a word card, **when** it renders, **then** the Hangul sits on the target chip with romanization beneath and a Korean description as the gloss, and the UI sentence around it ("이 글자를 읽어 보세요" or equivalent) is outside the chip.
- **Given** `romanizationMode: 'tap'`, **when** a reading-practice item first appears, **then** romanization is hidden and a "show" affordance reveals it; the gloss stays visible; the setting survives restart (`settings:${profileId}`).

### 3.6 Content overlays — glosses, narration, titles

Keep every `*En` field as the source of truth (renaming would ripple through schemas, validator and tests — audit I18N-05). Translations live **beside** the content, keyed by entity id, partial, with English fallback.

**Files**: `content/i18n/<locale>/<domain>.json`, `<locale>` in `es`, `ko` (an `en` directory is an error). Shape (zod `LocaleOverlayFileSchema`, `packages/content-schema/src/schemas/locale-overlay.ts`, 100% covered):

```json
{
  "locale": "es",
  "domain": "stage1-jamo",
  "entries": {
    "jamo:giyeok": { "gloss": "…", "soundHint": "como la g de gato", "exampleWord.gloss": "cachorro" },
    "card:gangaji": { "title": "…", "blurb": "…", "fact": "…" }
  }
}
```

Entry keys are entity ids (any `^[a-z0-9-]+:[a-z0-9-:.]+$`); field keys are **translatable field names with the `En` suffix stripped**, or the dotted path inside the entity. Allow-list per id prefix (`OVERLAY_FIELDS`, exported and used by the validator):

| id prefix | overlay fields | source (English) field |
|---|---|---|
| `jamo:` | `gloss`, `soundHint`, `exampleWord.gloss`, `nameHint` | JSON `en`, `exampleWord.en`; TS `nameEn`, `exampleWordEn` (`schemas/jamo.ts:16,18`); `soundHint` (base English added by F-QUEST-002) |
| `card:` | `title`, `blurb`, `fact` | JSON `title`/`blurb`/`fact`/`en`; TS `titleEn`/`blurbEn`/`factEn` (`heritage-card.ts:26-30`) |
| `episode:` | `title`, `subtitle`, `hoyaIntro` | `titleEn`/`subtitleEn`/`hoyaIntroEn` (`episode.ts:15-17`) |
| `quest:` | `title`, `blurb`, and `steps.<stepId>.title|body|hoyaLine` | `titleEn`/`blurbEn`; `QuestStep.titleEn`/`bodyEn`/`hoyaLineEn` (`quest.ts:14-16,26-27`) |
| `minigame:` and inline pairs | `label`, `gloss`, `npc`, `prompt` | `labelEn`, `en`, `npcEn` (`minigame-config.ts:12-18`, `minigame.ts:71`) |
| `stage:` / `theme:` | `title`, `oneLiner`, `anchorSkill` | `grid.ts:10-12,20-21` |

**Never overridable** (error): `ko`, `char`, `romanization`, `target`, `answer_ko`, `lang_ko`, `audioRef`, ids, `order`, anything not in the allow-list. Taught Korean and its romanization come only from the base.

**Runtime**: `localize(entity, entityId, locale, overlays)` in `packages/content-schema/src/localize.ts` returns a shallow-copied entity whose `*En` (or JSON `title`/`blurb`/`en`) values are replaced by the overlay's where present, else untouched; for `en` it returns the entity as-is. Typing: `LocalizedFields<T> = { [K in keyof T as K extends \`${infer F}En\` ? F : never]?: string }`. `localizeGloss(pair, locale)` serves the inline `{ ko, en, romanization }` pairs used by the minigames (`minigame-config.ts:99-136`). Call sites that show titles/blurbs/glosses (`LibraryScreen`, `CardDetailScreen`, `EpisodeDetailScreen`, `JourneyScreen`, `HomeScreen`, the minigames) call it with `useLocale()`.

**Pipeline**: `scripts/build-overlays.mjs` merges all `content/i18n/**/*.json` into `packages/content-schema/src/i18n-overlays.generated.ts` (`OVERLAYS: Record<'es'|'ko', Record<string, EntityOverlay>>`), checked in, with `node scripts/build-overlays.mjs --check` as a CI step (same drift-detector idea as `design-token-sync.yml`). The package is consumed by both apps through the workspace `main` (`packages/content-schema/package.json`), so no Metro/Next config for reading files outside the app. The generated file is excluded from coverage (`vitest.config.ts` `exclude`, like `src/logic/minigame-config.ts` in the mobile config). This is the overlay slice of D4's generate/import step; the base-content generation belongs to F-CNT-002 / F-STORY-001.

**Interim for TS-resident content**: until the base content is generated from JSON, ids that exist only in `apps/mobile/src/content/*.ts` are checked by a unit test (`apps/mobile/src/content/__tests__/overlays.test.ts`: every overlay id exists in the shipped modules and every field is in the allow-list); ids in `content/**/*.json` are checked by the validator.

- **Given** `content/i18n/es/stage1-jamo.json` with `jamo:giyeok.soundHint`, **when** the Spanish UI shows ㄱ, **then** the hint is shown next to the unchanged romanization `g` and the Hangul.
- **Given** an overlay trying to set `romanization` on a card, **then** CI fails with `overlay-forbidden-field`.

### 3.7 The F-CNT-001 validator becomes locale-aware

`scripts/validate-content.mjs` keeps every current rule for **base content** (everything under `content/` except `content/i18n/`): `korean-without-romanization`, `korean-without-gloss`, `korean-in-ui-field` (`:84-115`), `banned-on-learner-surface` (`:116-127`), `invalid-json`. The `LEARNER_TEXT_FIELDS` set (`:49-61`) is unchanged for base files. The skip notices (`:133-142`) stay.

New handling for files under `content/i18n/<locale>/` (plain Node, rule-based, no zod — the script's design, header comment `:2-14`):

| Rule | Level | Meaning |
|---|---|---|
| `overlay-bad-shape` | error | not `{ locale, domain, entries }`, or `locale` ≠ the directory name, or `locale` is `en`/unknown |
| `overlay-unknown-id` | error | an entry id that exists in no base `content/**/*.json` entity (`id` fields); entries for TS-only ids are checked by the mobile unit test (§3.6) |
| `overlay-forbidden-field` | error | a field outside `OVERLAY_FIELDS` for the id prefix, or one of `ko`, `romanization`, `target`, `char`, `audioRef` |
| `korean-in-ui-field` | error | **`es` overlays**: any Hangul in any value (Spanish text has no business with Hangul; taught Korean comes from the base). **`ko` overlays**: Hangul is allowed in translatable fields only |
| `overlay-circular-gloss` | error | a `ko` overlay `gloss` equal to the base entity's `ko` string |
| `banned-on-learner-surface` | error | a word from `banned-words.json[locale].learner` in any overlay value (Unicode boundaries for `es`, substring for `ko`); the base rule now reads the `en` list from the same JSON |
| `overlay-missing` | warning (`::warning`) | the base entity has a translatable English field the overlay lacks |
| `overlay-missing` | **error** for locales listed in `HANGUL_ROUTE_STRICT_LOCALES` | set in `content-validation.yml` per locale once `LOCALE_STATUS` is `shipped` |

Sources of the lists: `packages/i18n/src/banned-words.json` and the `OVERLAY_FIELDS` table are read by the script (`readFileSync` of the JSON; `OVERLAY_FIELDS` lives in a small `scripts/overlay-fields.mjs`, mirrored by a test against the TS export so the two cannot drift). The summary line prints a count per locale, e.g. `Content language policy: 7 file(s) scanned, 0 violation(s); es: 12 missing, ko: 0 missing`.

**UI-dictionary counterpart** (in `packages/i18n` tests, §5): no Hangul in `en`/`es` message values; `ko` values may contain Hangul; no `en`/`es` message embeds a Hangul literal even via a function (functions are evaluated with sample arguments); banned words absent from every locale's learner-surface namespaces and, for `caregiver`/`console`, the caregiver list.

Existing assertions that encode the old rule and what happens to them: `apps/web/src/data/__tests__/stage1-cards.test.ts:31-36` (no Hangul in `title`/`en`/`blurb`) and `scripts/__tests__/validate-content.test.mjs:125` (`korean-in-ui-field at .label`) stay **valid** — they test English-source fields. `apps/mobile/src/logic/homework/__tests__/gating.test.ts:63-71` ("caregiver messages are English… never Korean") is rewritten in PR 7a to loop `en`/`es`/`ko`: no shaming word per locale, no Hangul in `en`/`es`. `apps/web/src/lib/console/__tests__/copy.test.ts:13-17` keeps the English `capWarning` assertion and loops all locales for `isCaregiverSafe`.

### 3.8 Safety copy in every locale

- The anti-shame rules (CLAUDE.md §1, revised) hold in every language: no red-X, no public ranking of children, no loss of earned items, no percentages or fractions on learner result screens. The per-locale banned lists (§3.1) are enforced by tests over every dictionary and by the validator over overlays.
- The audience guard (`apps/web/src/app/__tests__/audience-copy.test.ts:20-40`, `KIDS_ONLY_FRAMING`) is extended: its `PUBLIC_SURFACES` gains `packages/i18n/src/messages/*/landing.ts`, and the patterns gain per-locale equivalents (es: `para niños`, `de 5 a 11 años`; ko: `어린이용`, `5~11세`). No locale names an age range or frames the product as kids-only (CLAUDE.md §1 copy rule).
- Wrong answers use the amber nudge and Hoya `thinking` in all locales; translation never introduces a "failure" noun.

### 3.9 Names, dates, numbers, money

- **Learner names are user data, not UI — DONE in PR #97.** `validateDisplayName` (`profile-model.ts:41-49`) accepts Latin letters including accents, Hangul syllables, digits, space, apostrophe (straight or curly) and hyphen in every locale, with explicit ranges instead of `\p{…}` (Hermes): `NAME_CHARS = /^[A-Za-zÀ-ɏ가-힣0-9 '’-]+$/`; emoji, other scripts, control characters and punctuation stay rejected. The code `'non-latin'` is already `'unsupported-character'`, and `profile-model.test.ts:54-64` already asserts `María`/`Zoë`/`수니` valid and `Suni 🐯`/`日本`/`Мария` invalid. `NAME_MAX = 12` and `ProfileSchema.displayName.max(20)` are unchanged. **Remaining work here**: the hint "Please use letters, numbers, spaces, ' or -." (`CreateProfileScreen.tsx:63-64`) and the "Names can be up to N letters." line (`:60-62`) move into `m.learner.createProfile` (PR 5); no pattern or code change. User names are exempt from the content validator and from the "Hangul needs romanization" rule.
- Dates/numbers/money only through `format*` (§3.1). Currency stays USD (payments are not live, D5) — the formatter changes layout, not the amount.
- Sorting by text (`localeCompare`, 19 call sites) is unchanged in this spec (out of scope).

### 3.10 Translation workflow, review, style guide

1. **Authoring**: a new or changed English string lands in `messages/en/*.ts` in the same PR as the feature (rule: no feature PR adds UI text outside the dictionary once its surface is in `scripts/i18n-migrated.json`, §3.11). `es`/`ko` are filled in separate translation PRs.
2. **Draft**: Claude drafts the overlay through routine R8 "Translation Sync" (`docs/blueprints/08-claude-code-routines.md:153-154`, currently "later"; activated by this spec): a `claude/i18n-<locale>-<namespace>` branch, PR labelled `routine-generated` (R3 reviews, CLAUDE.md §7). Drafts follow the style guide below.
3. **Native review**: Korean — owner; Spanish — an external native reviewer (an owner task: identify one before PR 15). Reviewers check tone, anti-shame, length, and that taught Korean is handled by `KoreanText`, not typed into sentences. Sign-off is recorded in `messages/review-ledger.json`: `{ "es": { "learner.home": { "enSha": "<sha256 of messages/en/learner.ts>", "reviewedBy": "<initials>", "reviewedAt": "2026-11-02" } } }` (granularity: namespace file, not key).
4. **Status script**: `node scripts/i18n-status.mjs` prints per locale and namespace: missing keys (via `fallbackPaths`), stale namespaces (English file hash ≠ ledger `enSha`), and the `LOCALE_STATUS`. CI fails on **missing keys in a `'shipped'` locale**; stale namespaces warn.
5. **Release gate**: flipping `LOCALE_STATUS.<locale>` to `'shipped'` requires 100% key coverage (no fallbacks), a ledger entry for every namespace, the validator strict for that locale (`HANGUL_ROUTE_STRICT_LOCALES`), and the layout matrix green (§3.11).

**Style guide** (also the R8 prompt): UI copy stays plain and short — English at CEFR Pre-A1 (CLAUDE.md §1); Spanish and Korean target the same simplicity, so a young reader and an adult beginner both read it. **Spanish**: neutral international Spanish, informal "tú" everywhere (no "usted", no voseo, no regional slang); avoid adjectives that must agree with the learner's gender ("¡Bienvenido/a!" → "¡Hola!"); numbers/dates via the formatters. **Korean**: 해요체 on all app surfaces (learner, grown-up, console); 합니다체 only on legal and pricing text; **never attach a particle (은/는, 이/가, 을/를) to a variable** — the correct form depends on the final consonant of a name the code cannot know; write around it ("학생: {name}", "{name}님", or a colon form); Hoya speaks in short warm sentences in all locales (warmth yes, nursery tone no, CLAUDE.md §1). **All**: whole sentences, no concatenation; no emoji in rendered output; the same anti-shame vocabulary rules.

### 3.11 QA — pseudo-locale, long strings, regression guards

- **Pseudo-locale** (`en-XA`, §3.1): a dev/QA build flag; used by the layout matrix and by an internal toggle on `/design-preview`.
- **Length reality**: Spanish runs about 30% longer than English (pseudo-locale pads 40%); Korean is usually shorter but taller glyphs. Components must wrap, not clip: `Button` sizes by `minHeight` (`Button.tsx:80`), and there is no `numberOfLines` truncation in the design system or screens except the deliberate multiline code box (`RestoreScreen.tsx:126`). The tab bar is no longer a fixed 84 (PR #95: `tabBarMetrics(insets.bottom)`, a 64 pt row above `max(inset, 8)`, `tabs.tsx:15`) and its labels use `caption` size (`tabs.tsx:22`): tab labels get a budget (below).
- **Length budgets** (`messages/length-budget.test.ts`): keys whose last segment is `tab` ≤ 12 characters, `pill` ≤ 24, `cta` ≤ 28 in every locale; any other `es` string must be ≤ 1.5x the English length unless on an allow-list with a reason.
- **Layout matrix** (Playwright, reusing `WIDTHS` from `apps/web/e2e/landing-layout.spec.ts:14` and the viewport helpers of `apps/mobile/e2e/web/layout.spec.ts:13-36` (added by PR #95)): locales `en`, `es`, `ko`, `en-XA` x widths 320 / 375 / 768 x screens Welcome, CreateProfile, Home, Profile, PinEntry, Results (mobile PWA) and `/`, `/es/`, `/ko/`, `/about` (landing): assert no horizontal overflow (`documentElement.scrollWidth <= innerWidth`), every interactive element >= `touchTarget.min`, and that the primary CTA is within the viewport.
- **E2E pinning**: the existing specs use English `getByText` (`apps/mobile/e2e/web/*.spec.ts`); `apps/mobile/playwright.config.ts:13-18` gains `locale: 'en-US'` so they stay English; `locale.spec.ts` covers switching.
- **`scripts/check-i18n.mjs`** (Node + the repo's `typescript`, tests in `scripts/__tests__/check-i18n.test.mjs`, run by `pnpm run test:scripts`, CI step beside `ci.yml:47-48`): (a) bans plural-suffix ternaries (`=== 1 ? '' : 's'` and `!== 1 ? 's' : ''`) in non-test source repo-wide; (b) for every glob in `scripts/i18n-migrated.json` (a ratchet — each surface PR adds its glob), fails on JSX text nodes with letters and on string-literal `label`, `title`, `placeholder`, `alt`, `accessibilityLabel`, `accessibilityHint` JSX attributes; (c) bans bare `Intl.` outside `packages/i18n`.

### 3.12 Telemetry

Add to `TELEMETRY_EVENT_NAMES` (`packages/content-schema/src/schemas/telemetry.ts:9-33`, the one list the API whitelists — `packages/backend/src/routes/telemetry.ts` imports `isTelemetryEventName`):

- `locale.changed` — payload `{ from, to, scope: 'device' | 'profile', source: 'welcome' | 'settings' | 'handoff' }` (locale ids only; no names or ids of people other than the existing `profileId` field).
- `romanization.mode_changed` — payload `{ mode: 'always' | 'tap' }`.

Naming convention for all specs (see `TELEMETRY-NAMES.md`): a unit's lifecycle is `<unit>.start` / `<unit>.complete` (existing: `quest.start`, `episode.complete`); a discrete user action is past tense (`locale.changed`, `space.join.attempted`).

Fired from the locale store actions with `void track(...)` (never throws, `platform/telemetry.ts:129`), following the `onboarding.started` call pattern (`CreateProfileScreen.tsx:75`). The web console has no telemetry client; locale changes there are not tracked. Each new name needs a test that it passes `isTelemetryEventName` and a backend `POST /api/telemetry` case (`packages/backend/src/__tests__/telemetry.test.ts` iterates the shared list, so that case is automatic). Add the names to the exact-list assertion in `packages/content-schema/src/__tests__/telemetry.test.ts:5-34`. Other specs add their own names to the same file in their own PRs; rebase conflicts there are mechanical (one array).

### 3.13 Accessibility, offline, privacy, errors

- **Accessibility**: language chips and rows are `accessibilityRole="button"` with a selected state and 64dp-class targets (`touchTarget` tokens, never raw numbers); labels are the endonym. All accessibility labels come from `a11y` messages. `KoreanText` sets the speech language (§3.5). The confirm sheet is announced in the new language. Reduced motion: the live re-render on language change has no animation.
- **Offline**: no network is involved in choosing or applying a locale; dictionaries are in the bundle (§3.4).
- **Privacy**: locale is a non-identifying display preference stored locally; it is not synced and not sent anywhere except the two telemetry events above (locale codes only).
- **Errors/empty**: unreadable storage → detection result, picker works for the session, nothing persisted; unknown stored locale (e.g., a locale later removed) → ignored; `?lang=` with an unavailable value → ignored; an overlay with a missing key → English fallback (never a blank or the key name).

## 4. Out of scope

- Right-to-left layout (all three languages are LTR).
- Server-side translation of API messages (clients render by error code).
- Translating legal text: `/privacy` and `/terms` stay English-authoritative; `/es/` and `/ko/` show the English text under a localized notice that English is the authoritative version, until legal review (decision L10).
- Spoken Hoya lines and `es-ES` / `es-US` speech (F-AUDIO-004); this spec only exposes `speechLang` in `LOCALE_META`.
- Locale-aware sorting (`localeCompare` call sites), list formatting, and any locale beyond `en`/`es`/`ko`.
- Translating story, vocabulary and heritage-research text (those specs define their content and use the overlay mechanism built here; their translations are separate content PRs).
- Syncing the locale choice across devices; a separate manifest per locale; store-listing localization.
- Level labels and learner type (F-LEARN-001) — they only add their strings to the dictionary (`LEARNER_LEVELS` overlays by level id); `learnerType` is stored on the profile, not in `ProfileSettings`.

## 5. Tests

| File | Coverage |
|---|---|
| `packages/content-schema/src/__tests__/locale.test.ts` | `UiLocaleSchema`, `ProfileSettingsSchema` defaults (`romanizationMode` → `always`), `DeviceSettingsSchema`, unknown locale rejected |
| `packages/content-schema/src/__tests__/locale-overlay.test.ts` | file shape, `en` directory/locale rejected, allow-list per prefix, forbidden fields, dotted paths; `localize()` replaces `*En` and JSON fields, falls back, returns `en` untouched; `localizeGloss` |
| `packages/content-schema/src/__tests__/schemas.test.ts` (extend) | the two new telemetry names are accepted by `isTelemetryEventName` |
| `packages/i18n/src/__tests__/detect.test.ts` | `es-MX`, `ko_KR`, `en-GB`, unknown skipped, empty, hidden locale excluded, order of preference |
| `…/resolve.test.ts` | precedence profile > device > detected > `en`; deep merge; array/function replacement; `fallbackPaths`; explicit-locale API |
| `…/plural.test.ts` | en/es zero/one/other, ko always other, non-integers |
| `…/format.test.ts` | Intl path for all three locales; `intl: null` fallback tables; `describeRelativeDay` (today/yesterday/weekday/date/never); `formatUsd` |
| `…/banned.test.ts` | per-locale learner and caregiver lists; token boundaries with explicit ranges ("dismissed" and "vencidos"-style near-misses behave; `fallaste` hit; accented letters never split a token); ko substring (`실패했어요` hit); JSON is the single source |
| `…/romanization.test.ts` | `romanizationShown` truth table |
| `…/pseudo.test.ts` | strings and function outputs transformed, length +>= 40%, brackets present |
| `…/messages.structure.test.ts` | every `es`/`ko` path exists in `en`; function arity and sample outputs; no Hangul in `en`/`es` (functions evaluated with a `samples` registry); no banned word in any locale; `Messages` type parity |
| `…/length-budget.test.ts` | tab/pill/cta budgets, es <= 1.5x unless allow-listed |
| `apps/mobile/src/platform/__tests__/locale.test.ts` | native/web detection, failure → `[]`, `?lang=` handling (inject `location`, `history`) |
| `apps/mobile/src/store/__tests__/locale-store.test.ts` | hydrate with corrupt/missing/throwing storage, resolution precedence, setters persist and remove keys, telemetry fired once per change, profile removal cleans `settings:${id}` |
| `apps/mobile/src/store/__tests__/bootstrap.test.ts` (extend) | locale hydrated after profiles, before ready |
| `apps/mobile/src/logic/profiles/__tests__/profile-model.test.ts` | **already shipped in PR #97** (accents and Hangul valid; emoji, CJK, Cyrillic, control characters invalid; `unsupported-character`); nothing to add in this spec |
| `apps/mobile/src/logic/homework/__tests__/gating.test.ts` | reason codes; messages per locale with no shaming word |
| `apps/mobile/src/logic/sync/__tests__/status-line.test.ts` | each state in en/es/ko, plural of minutes |
| `apps/mobile/src/content/__tests__/overlays.test.ts` | overlay ids exist in shipped TS modules; fields in allow-list |
| `apps/web/src/lib/i18n/__tests__/safe-storage.test.ts`, `locale-context.test.ts` (pure `pickConsoleLocale`) | storage guarded (throws, null, SSR); precedence stored > navigator > `en` |
| `apps/web/src/lib/console/__tests__/copy.test.ts` (extend), `rollup.test.ts`, `billing.test.ts`, `plans.test.ts`, `routing.test.ts` | per-locale caregiver-safe; dates/plurals via formatters in all locales |
| `apps/web/src/app/__tests__/audience-copy.test.ts` (extend), `landing-locales.test.tsx` | per-locale audience patterns; SSR of `LandingPage` in each locale; metadata + hreflang alternates |
| `packages/design-system/src/__tests__/korean-text.test.ts` | pure helpers behind `KoreanText` (label builder, `romanizationShown` wiring); component files stay excluded from coverage like the rest of `src/components/**` |
| `scripts/__tests__/validate-content.test.mjs` (extend) | each §3.7 rule: bad shape, `en` dir, unknown id, forbidden field, Hangul in `es`, Hangul allowed in `ko` translatable field, circular gloss, banned word per locale, `overlay-missing` warning vs strict error; base-content cases unchanged |
| `scripts/__tests__/check-i18n.test.mjs`, `build-overlays.test.mjs`, `i18n-status.test.mjs` | plural-ternary ban, JSX literal ratchet, `Intl.` ban; generator output and `--check` drift; missing/stale reporting |
| `apps/mobile/e2e/web/locale.spec.ts` (nightly) | Welcome language switch, persistence after reload, Profile override, `?lang=` hand-off; layout matrix (en/es/ko/en-XA x 320/375/768) |
| `apps/web/e2e/landing-locales.spec.ts` (nightly) | `/es/`, `/ko/` no overflow at the three widths, `<html lang>`, switcher links |

Coverage: `packages/i18n` logic files 100% (message files are data and excluded from coverage in its `vitest.config.ts`, like `minigame-config.ts` in the mobile config; they are covered structurally by the tests above) — add `packages/i18n | 100` to `docs/tests/coverage-targets.md` and `coverage-targets.json` (drift detector F-COV-002); `packages/content-schema` stays 100% (generated overlay file excluded); `apps/mobile/src/logic` >= 90%, `src/platform` >= 70%; `apps/web` >= 90% (`src/lib`, `src/data`); `packages/design-system` >= 85%.

## 6. Rollout — PR breakdown (dependency order)

Sizes: S <= ~150 changed lines, M <= ~400, L <= ~800 (translation/content PRs count by files, not lines). Each PR is one conventional commit scope with tests; the English surface PRs ship no visible change.

| # | PR | Size | Depends on |
|---|---|---|---|
| 0 | `docs`: charter + skills + wireframes: CLAUDE.md §2 lists `packages/i18n`, `content/i18n/`, `content/stories/`, `content/vocab/` (§9), §1/§8 wording stays "until this ships" until PR 17; `.github/pull_request_template.md:22` and `.claude/skills/content-skill/SKILL.md` §3.3 (lines 81-87, 146, 291) rewritten to "UI = selected locale"; promote wireframes (Welcome language row, Profile language card, `language-picker.md`); coverage-targets md+json row | S | — |
| 1 | `feat(content-schema)`: `locale.ts` schemas (`ProfileSettings`, `DeviceSettings`), telemetry names, tests | S | 0 |
| 2 | `feat(i18n)`: package scaffold + core (`types`, `locales`, `detect`, `resolve`, `plural`, `format`, `banned` + `banned-words.json`, `romanization`, `pseudo`), `common` + `a11y` English seeds, 100% tests, workspace wiring (`transpilePackages`, `vitest.workspace.ts`) | M | 1 |
| 3 | `feat(mobile)`: `platform/locale(.web).ts`, `locale-store`, bootstrap step, `useMessages`, `<html lang>` effect, `check-i18n.mjs` + CI step (migrated list empty), `expo-localization` dependency (a native rebuild is needed for iOS via Xcode; the PWA is unaffected) | M | 2 |
| 4 | `feat(design-system)`: `KoreanText` (+ design mock) and the label props (`StarRow`, `HoyaBubble`). **Depends only on PR 0** (the component takes `romanizationShown` and `accessibilityLabel` as props, so it needs no i18n package) — this lets F-QUEST-002 and F-STORY-003 consume it before the rest of this spec lands | M | 0 |
| 5 | `refactor(mobile)`: first-run + settings — Welcome, CreateProfile (hint strings only; the name rule shipped in PR #97), FirstQuestPreview, tabs, Profile; language row and Language card (language rows hidden while only `en` is shipped), the always-visible reading-practice switch; telemetry | M | 3, 4 |
| 6a | `refactor(mobile)`: Home, Journey, Library, CardDetail | M | 5 |
| 6b | `refactor(mobile)`: Episode, Results, Homework + their logic prose (`mission-builder`, `assignment-groups`, `journey`, `round-builder`) | M | 6a |
| 7a | `refactor(mobile)`: Quest player + gating reason codes (`gating.ts` returns codes, screens render) | M | 6b |
| 7b | `refactor(mobile)`: minigames + UI labels in `minigame-config` (not the content glosses) | L | 7a |
| 8a | `refactor(mobile)`: grown-up surfaces — PIN, dashboard, paywall (`formatUsd`), SpacesCard, BackupCard | M | 6b |
| 8b | `refactor(mobile)`: Restore/SaveProgress/JoinSpace, `status-line`, `restore`, `join-code`, install sheet, PwaBanners, OopsScreen | M | 8a |
| 9 | `refactor(web)`: console infra — `lib/i18n` (safe storage, provider), header picker, `COPY` → `messages/en/console.ts`, formatters replacing the three `MONTHS`/`relativeDay`/`plural`, banned-text re-export | M | 2 |
| 10a | `refactor(web)`: console pages — `teach/page`, `start`, `home`, `space/page`, `relink`, `ui.tsx`, `use-console` | M | 9 |
| 10b | `refactor(web)`: console pages — `plan`, `billing` | M | 10a |
| 10c | `refactor(web)`: console pages — `settings`, `SchoolAdmin`, `/parent` | M | 10b |
| 11a | `refactor(web)`: landing/about/legal copy into `messages/en/landing.ts`; audience guard extended | M | 9 |
| 11b | `refactor(web)`: route groups `(en)` / `(loc)/[locale]` / `(console)`, the three path-based tests moved with the pages (§3.4), `/es/` `/ko/` prerendered but hidden until shipped (`generateStaticParams` guard) | M | 11a |
| 11c | `feat(web)`: per-locale metadata + hreflang, footer switcher, "View in …" banner, `?lang=` hand-off | M | 11b, 3 |
| 12 | `feat(content)`: overlay schema + `localize` + generator + validator rules + `content/i18n/README.md` + mobile call sites for titles/blurbs/glosses + `overlays.test.ts` | L | 7b |
| 13 | `i18n-status`, review ledger, R8 routine definition, `HANGUL_ROUTE_STRICT_LOCALES` plumbing | S | 12 |
| 14 | `test(e2e)`: layout matrix, locale specs, `en-US` pin | M | 8b, 11c |
| 15 | `content(i18n)`: **Spanish** — dictionary drafts (R8), jamo `soundHint` + glosses, native review, flip `LOCALE_STATUS.es` | L (content) | 12-14 |
| 16 | `content(i18n)`: **Korean** — dictionary drafts, Korean glosses (definitions), owner review, flip `LOCALE_STATUS.ko` | L (content) | 15 |
| 17 | `docs`: CLAUDE.md §1 / §8 final wording, remove "English only until" notes, update F-CNT-001 §1.1 pointer | S | 16 |

**Cross-spec order** (full list in `REVIEW-1.md`): PR 4 (`KoreanText`) and PR 1 (`ProfileSettings`) should land before F-QUEST-002 Q-5a and before any spec reads `romanizationMode`; until PR 2 exists those specs use their interim `romanizationShown` with the same signature. F-LEARN-001 PR 4 (the new CreateProfile) and this spec's PR 5 edit the same screen: land F-LEARN-001 PR 4 first, then PR 5 only moves strings. F-CNT-002 PR 2 and F-STORY-003 3.2 both touch `minigame-config.ts` (romanization of `storySteps`): F-CNT-002 PR 2 owns the values.

Estimated engineering effort: about 14-18 working days plus reviewer time (Spanish about 2-3 days, Korean about 2). Order of risk: ship `en` extraction (PRs 5-11c) before any translation so each can be reviewed as "no visible change". Rollback: flipping `LOCALE_STATUS` back to `'hidden'` removes the pickers and ignores stored non-English choices without a data change.

## 7. Dependencies

- **Upstream**: F-PROF-001 (profile store, onboarding flow), F-SYNC-002 and `platform/storage` (persistence), F-CNT-001 (validator, extended here), F-HW-001 §3.3 and F-CONSOLE-001 §3.5 (anti-shame lists), F-PWA-001 §3.2 (telemetry list), F-COV-002 (targets drift), design-token-sync (any new token for the target chip).
- **Downstream**: F-CNT-002 (romanization policy; base-content generation that makes the overlay validator complete), F-AUDIO-004 (`speechLang`, `es` voices, Hoya lines), F-LEARN-001 (level labels as dictionary strings; extra `ProfileSettings` fields), F-PLC-001 (test language = a locale chosen at start, defaulting to the UI locale, via `getMessages(locale)`), F-STORY-001..006 and F-VOC-001..005 (story/vocab text via overlays; UI strings in `messages/en/learner.ts`), F-QUEST-002, F-TCH-004 / F-PLAN-002 (console `messages`), F-LAYOUT-001 (long-string behaviour), the lecture-mode presenter (D12; renders in the presenter's locale from the same store).
- **External**: a native Spanish reviewer (owner task); `expo-localization` (PR 3).

## 8. Decisions

Binding owner decisions this spec implements: **D2** (EN default, KO, ES; per-device default with per-profile override; chosen on Welcome, changeable in Profile; safe storage; taught Korean always with romanization + UI-language gloss; "hide romanization until tap" opt-in, default visible) · **D4** (JSON-first content; overlays under `content/i18n/**` are the same pipeline; validator scans shipped content) · **D8** (spec id F-I18N-001) · **new `packages/i18n` and `content/i18n/` are approved by D2/D4 for this purpose** — CLAUDE.md §2 lists them in PR 0 (§9) · **D1** (no age framing in any locale; level labels are dictionary strings) · **D3** (anti-shame vocabulary in every locale) · **D10** (test language = explicit locale) · **D13** (Revised Romanization stays canonical; the Spanish `soundHint` accompanies it).

Decisions made in this spec:

| # | Decision |
|---|---|
| L1 | Typed in-repo dictionary, no third-party library; messages are strings or functions, no placeholder templates |
| L2 | Locale is local-first (`device:settings`, `settings:${profileId}`), not in `ProfileSchema`; no migration, no API change |
| L3 | `es` and `ko` ship `'hidden'` until native review; English extraction lands first with no visible change; Spanish before Korean |
| L4 | Logic returns codes/structured data, not prose; formatters take a message subtree |
| L5 | Taught Korean is never inside a message; `KoreanText` (target chip + romanization + gloss) is the one renderer in every locale |
| L6 | Korean-UI gloss is a Korean definition, not an echo; circular glosses fail validation |
| L7 | The language pickers are not behind the grown-up gate (reversible, touches no data); the confirm sheet in the new language offers a one-tap way back |
| L8 | Overlays: `content/i18n/<locale>/<domain>.json`, field names without `En`, never `ko`/`romanization`/`target`; generated into `content-schema` and checked in |
| L9 | Names are user data: Latin (with accents) and Hangul accepted in all locales |
| L10 | Legal pages stay English-authoritative with a localized notice until legal review; the app name stays "Hangul Route"; Hoya is "호야" only in `ko` |
| L11 | Style: Spanish neutral "tú"; Korean 해요체, no particle on a variable; `es-US` speech tag with `es-*` fallback |
| L12 | Landing at `/` English, `/es/` `/ko/` prerendered via route groups; console and app unprefixed; a banner suggests, never redirects |
| L13 | One banned-word JSON, per locale and surface, shared by TypeScript and the validator |

## 9. Charter text to land with PR 0 (for CLAUDE.md §2 and friends)

This spec owns the **one** CLAUDE.md §2 edit for every new package or directory introduced by the Story / Vocab / i18n set (owner approvals: D2 for the locales and `packages/i18n`, D4 for `content/stories/` and `content/vocab/`; the review of 2026-10-10 records these approvals, so PR 0 states them in its description). CLAUDE.md §2 line "이 구조에서 벗어나는 새 디렉토리/패키지가 필요하면 먼저 제안하고 승인받는다" is satisfied by that statement.

- §2 directory tree, under `packages/`: `i18n/  # typed UI dictionary (en/es/ko), plural + Intl helpers, banned-word lists, locale detection (F-I18N-001)`; under `content/`: `stories/  # story JSON, one file per tale (F-STORY-001)`, `vocab/  # vocabulary topics, one file per topic (F-VOC-001)`, `i18n/  # locale overlays (es, ko) keyed by entity id (F-I18N-001)`; a `scripts/` line (`validate-content.mjs`, `check-i18n.mjs`, `build-overlays.mjs`, `i18n-status.mjs`) because the tree does not list it today although CI runs it.
- §1 "Languages": the clause "a new `packages/i18n` needs owner approval" becomes "`packages/i18n` is approved (F-I18N-001)"; the English-only sentence stays until PR 17.
- §8 last bullet: unchanged until PR 17; then drop "(…English only until F-I18N-001)".
- `.github/pull_request_template.md:22`: "Language policy respected — UI strings from the selected locale (en/es/ko); taught Korean via `KoreanText` with romanization + gloss".
- `.claude/skills/content-skill/SKILL.md` §3.3: replace "UI text = English" with "English is the source locale; translations are overlays under `content/i18n/`".
- `docs/tests/coverage-targets.md` + `coverage-targets.json`: add `packages/i18n | 100`.

## 10. Unverified assumptions and open items

- **Hermes `Intl` / `Intl.PluralRules` / regex features**: not testable here; the design avoids relying on them (hand-rolled `plural`, fallback month/weekday tables, explicit character ranges instead of `\p{…}` for names; the Unicode-boundary banned-word regex runs in Node tests and on web — verify on Hermes before the native iOS/Android build).
- **`expo-localization` version** for SDK 52 (`~16.0.0` per the audit): confirm at install; web uses the `navigator.languages` variant and does not need it.
- **Next route groups with multiple root layouts under `output: 'export'`** (PR 11b): verified in a throwaway prototype on Next 14.2.35 (`out/es.html` has `lang="es"`, §3.4); re-run the check in the real app after the move, because `generateMetadata` and the existing `siteMetadata` export were not part of the prototype. Fallback in §3.4.
- **react-native-web forwarding `lang`** on `Text`, and `accessibilityLanguage` being iOS-only: verify with VoiceOver / TalkBack / a screen reader in a browser.
- **A native Spanish reviewer** is not yet identified (owner task before PR 15). The Spanish banned-word list and the Korean 해요체 choice are proposals pending native review.
- **Settings schema ownership**: `ProfileSettingsSchema` / `DeviceSettingsSchema` are created here and nowhere else; F-LEARN-001 adds none (its `learnerType` lives on `ProfileSchema`). A later spec that needs a per-profile preference extends the schema additively (optional field, default in the schema) and updates the storage test here.
- Whether the `ko` UI should also show an English gloss as an opt-in (a Korean-speaking heritage child learning to read) — not decided; default is the Korean description only.
