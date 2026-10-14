import type { UiLocale } from '@hangul-route/i18n';

/**
 * Word checks the screen render tests share (F-BILL-002 B-13; sections 4.7 and 6.5): the purchase
 * and unlock words no learner string uses, per locale, and the shape of a price. It sits under
 * __tests__ with the other test-only Korean (the romanization scan skips test folders).
 */
export const PURCHASE: Record<UiLocale, RegExp> = {
  en: /\b(premium|price|buy|buying|pay|payment|purchase|unlock|unlocks|unlocked|trial|offer|promo|terms|lifetime)\b/i,
  es: /\b(premium|precio|compra|comprar|paga|pagar|desbloquea|prueba|oferta|promo)\b/i,
  ko: /프리미엄|가격|구매|결제하|결제해|체험|잠금 해제|할인/,
};

/** A currency sign, an amount with cents, or a currency code. */
export const PRICE = /[$€£₩]|\d+[.,]\d{2}|\bUSD\b/;
