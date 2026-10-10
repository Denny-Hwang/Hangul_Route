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
- **Until the i18n layer ships (F-I18N-001)**, English is the only shipped
  UI locale and `content/**/*.json` is the English source. This validator
  therefore keeps enforcing the English source as written below: Korean
  only in Korean-target fields, romanization on every Korean item, and an
  English gloss (`gloss_en` / `en`). Per-locale glosses and UI strings will
  live in locale overlays that F-I18N-001 specifies, with their own rules;
  this spec changes only its policy text, not the validator's behaviour.

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
  spelling accuracy. Tracked as F-CNT-002.
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
