# Check before a new PIN (screen spec, FN-1)

Spec: `docs/specs/AMENDMENTS-FINISH-2026-11.md` row FN-1 (audit SEC-7), F-LEARN-001 §3.5, AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.5 · wireframe `design/wireframes/onboarding/all-ages-onboarding.md` box G2 · mock `mock/pin-reset-check.html` (boards 1 to 7), sheet `mock/pin-reset-check.css` (linked after `profiles.css`) · shots `shots/pin-reset-check-320.png`, `-1280.png`, `-320-text200.png` · **[FN]**

Agent design pass (CLAUDE.md section 5, owner decision 2026-10-12). The parent-gate pattern of Apple App Review 1.3 and Google's Families policy: before the two offline ways of Forgot PIN? (a Rescue Code this device holds, the finished 24-hour wait) open the new-PIN screen, the person types as digits a number written out in words in the UI language. Someone who cannot read that language well gains nothing by poking. The online way (Sign in to the account) is a strong check already and stays as it is (board 7).

The shipped `PinResetScreen` keeps its header (Back, **Reset the PIN**, Aa) and subtitle. The old math gate (`design/wireframes/parent/gate.md`) was retired in 2026-09 and its component removed, so there is nothing to reuse; the card is new and lives in the reset screen only.

## What is drawn

| Piece | Drawn | Key |
|---|---|---|
| Card heading | One more step | `caregiver.pin.reset.check.heading` |
| Prompt | Type this number in digits. | `caregiver.pin.reset.check.prompt` |
| The number | three hundred forty-seven (100 to 999, new each time; `size.prompt` bold, centred, whole words wrap) | `caregiver.pin.reset.check.words(n)`: `numberInWords(locale, n)` of `packages/i18n` |
| Field | the shipped Rescue Code field's look (`surface.sunken`, `border.shape`, `radii.lg`), number keyboard, up to 4 digits, centred; accessible name **Number in digits** | `caregiver.pin.reset.check.fieldLabel` |
| Button | Continue, disabled until a digit is typed | `common.buttons.continue` (existing) |
| After a miss | Not quite. Here is a new number. (polite live region, `text.secondary`) | `caregiver.pin.reset.check.again` |

es: Un paso más · Escribe este número con cifras. · trescientos cuarenta y siete · Número en cifras · Casi. Aquí tienes un número nuevo.
ko: 한 단계 더 · 이 수를 숫자로 적어 주세요. · 삼백사십칠 · 숫자로 적은 수 · 조금 달라요. 여기 새 수가 있어요.

## Boards

1 Rescue Code accepted, check shown, field empty · 2 typed, Continue enabled · 3 after a miss: a new number, field cleared, the calm line · 4 the finished wait opens the same check · 5 Spanish · 6 Korean · 7 Sign in to the account: no check.

## Rules the boards fix

- A miss changes only the number (never the same one twice in a row) and clears the field. No count of tries, no pause, no lock, no red or danger colour, no "wrong" or "failed". The PIN's and the Rescue Code's attempt counters are not touched.
- Right answer: `PinEntry { mode: 'setup', via }` as before (`via` `rescue_code` or `wait`). Nothing else opens setup from this screen.
- Back leaves the whole reset (the PIN screen, as today). A Rescue Code is asked again next time; a finished wait stays finished.
- No "grown-up" word on the card: a self-only device's reset screen shows none (F-LEARN-001 §3.4).
- The number is never shown as digits or as an image; the words come from the i18n layer in the UI locale (Sino-Korean in Hangul for ko).
- 320 px with 200 % text: no horizontal scroll, words wrap whole (checked on the shot).

## Tokens

Card `surface.paper` `radii.lg` `shadows.card`; prompt and miss line `text.secondary` (miss line `size.bodySm`); the number `text.primary` `size.prompt` bold; field `surface.sunken`, `borderWidth.base` `border.shape` (4.55:1 on paper), `radii.lg`, min height `touchTarget.child`.
