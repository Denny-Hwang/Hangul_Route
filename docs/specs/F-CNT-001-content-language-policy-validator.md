# F-CNT-001 — Content Language Policy Validator

**Status**: `ready`
**Scope**: Infra · CI · Content
**Owner**: solo dev
**Rollout**: MVP (foundational)

---

## 1. Context

The CLAUDE.md language rule (`CLAUDE.md` §1 "Languages", §8) is the
cultural and pedagogical spine of the product. A Korean string leaking into
an English UI field, or a Korean learning item shipped without romanization
or a gloss, breaks the contract.

### 1.1 Language policy (revised 2026-10-09, owner decision)

- **UI strings come from the selected UI locale.** English is the default;
  Korean and Spanish are selectable UI locales.
- **Taught Korean content always shows romanization and a gloss in the UI
  language** (English gloss in the English UI, Spanish gloss in the Spanish
  UI, Korean gloss in the Korean UI).
- Korean as a UI locale is not taught content: in the Korean UI, menus are
  Korean strings from the `ko` locale, and taught items still carry
  romanization and a gloss.
- **The i18n layer has shipped (F-I18N-001).** Which UI locales are public
  is set by `LOCALE_STATUS` (`packages/i18n/src/locales.ts`; `es` and `ko`
  become public when F-I18N-001 rows 15b / 16b flip them), and
  `content/**/*.json` is the English source. This validator therefore keeps
  enforcing the English source as written below: Korean only in
  Korean-target fields, romanization on every Korean item, and an English
  gloss (`gloss_en` / `en`). Per-locale glosses live in the locale overlays
  under `content/i18n/<locale>/` (F-I18N-001 PR 12, `content/i18n/README.md`),
  with their own validator rules; UI strings live in `packages/i18n`. This
  spec changes only its policy text, not the validator's behaviour.

`.github/workflows/content-validation.yml` shipped with a TODO marker
instead of enforcement. This spec replaces that TODO with a small Node
walker that scans `content/**/*.json` and flags violations.

Validator is intentionally rule-based, not schema-based: it works **today**
when `packages/content-schema` is still a stub (`export {};`). When real
zod schemas land (T-016), this validator becomes a second line of defence
behind the schema's own parsing.

## 2. User story

> As a content author landing a new Episode JSON, I want CI to fail my PR
> if I forgot to attach romanization or an English gloss to a Korean
> learning item, so that the language policy is enforced before review.

## 3. Acceptance criteria

- **Given** a JSON file under `content/` containing
  `{ "ko": "안녕", "romanization": "annyeong", "gloss_en": "hello" }`,
  **when** `node scripts/validate-content.mjs` runs,
  **then** the file is reported as scanned and the script exits `0`.

- **Given** a JSON file containing `{ "ko": "안녕" }` (no romanization, no
  gloss),
  **when** the validator runs,
  **then** it prints `::error::… korean-without-romanization at .(root)`
  **and** `::error::… korean-without-gloss at .(root)` annotations and
  exits `1`.

- **Given** a JSON file containing `{ "label": "안녕하세요" }` (Korean in a
  field that is NOT in the allow-list of Korean-target fields:
  `ko`, `korean`, `target`, `answer_ko`, `lang_ko`),
  **when** the validator runs,
  **then** it prints `::error::… korean-in-ui-field at .label` and exits
  `1`.

- **Given** a Korean item whose English gloss opens with its own
  romanization and then ` (`, `, ` or ` — `, such as
  `{ "ko": "김밥", "romanization": "gimbap", "en": "gimbap (seaweed rice roll)" }`
  (compared in NFD, lower case, letters only),
  **when** the validator runs,
  **then** it prints `::error::… gloss-repeats-romanization: … at .en` and
  exits `1`: the romanization is already printed above the gloss, so the
  gloss keeps only the meaning (`seaweed rice roll`). The same rule runs on
  the Spanish overlays (`scripts/overlay-rules.mjs`, one implementation,
  `glossRepeatsRomanization`) and on the TypeScript-resident content
  (`apps/mobile/src/content/__tests__/overlays.test.ts`). Proper names whose
  English is the name itself stay on an explicit allowlist inside the rule
  (서울, 부산, 대전, 대구, 추석, 한가위, 단오, 아리랑, 동의보감, 허준, 장영실,
  장경판전, 조선, 고려, 직지, 호야), a single jamo's sound hint
  (`A — sounds like …`) is not a gloss, and a loanword equal to its English
  (`banana`) has no separator, so it passes. Added 2026-10-17 from the owner
  note on the 김밥 slide ("gimbap" over "gimbap (seaweed rice roll)").

- **Given** `content/` exists but contains no `.json` files,
  **when** the validator runs,
  **then** it prints `::notice::no .json files under content/; skipping`
  and exits `0`.

- **Given** a malformed JSON file,
  **when** the validator runs,
  **then** it records an `invalid-json` violation including the parser
  error message and exits `1`.

## 4. Out of scope

- **Korean string strictness beyond romanization + gloss** — e.g.
  Revised-Romanization-vs-McCune-Reischauer enforcement, romanization
  spelling accuracy. Specified in
  [`F-CNT-002-romanization-policy.md`](F-CNT-002-romanization-policy.md)
  (policy §3.1, checker rules §3.3, scanned sources §3.4) and enforced by
  the romanization vitest suites, not by this validator.
- **CEFR Pre-A1 vocabulary cap on English fields.** Today the validator
  flags Korean-in-UI; it does NOT yet flag English vocabulary above CEFR
  Pre-A1 (plain, short words a young reader and an adult beginner both
  read easily). F-CNT-003.
- **Locale overlays** (Korean / Spanish UI strings and glosses) — F-I18N-001.
- **Zod schema validation** of Episode / Quest / Card shapes. Lives in
  the schema package itself (T-016). The two layers are complementary.
- **Romanization standard auto-fix** — validator only reports.

## 5. UI sketch

N/A — CI script.

## 6. Tests

- Script self-tests deferred (T-019). V1 verified by:
  - Empty state (no `.json` under `content/`): exits `0` with `::notice::`
    (verified locally).
  - Good-fixture: place
    `content/fixtures/_smoke-good.json = { ko, romanization, gloss_en }`
    in a transient branch, run validator, observe exit `0`.
  - Bad-fixture: place `{ ko: "안녕" }` only — observe exit `1` with two
    rule violations.

## 7. Rollout

MVP. Lands with the first wave of CI gate enforcement (T-006/007/008).
Becomes more useful once real Episode / Card JSON arrives (Week 4+).

## 8. Dependencies

- **Upstream**: `.claude/skills/content-skill/SKILL.md` §3.3 is the
  written policy this script encodes.
- **Downstream**:
  - F-CNT-002 stricter romanization rules.
  - F-CNT-003 CEFR Pre-A1 English vocabulary linter.
  - T-016 Quest / Card / Episode zod schemas (complement, not blocker).
- **External**: none.
