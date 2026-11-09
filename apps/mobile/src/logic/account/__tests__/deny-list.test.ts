import { describe, expect, it } from 'vitest';
import { ACCOUNT_DENY_SYMBOLS, ACCOUNT_DENY_WORDS, PLAN_SCREEN_DENY, accountDenyHits, planScreenHasWord } from '../deny-list';

/**
 * F-AUTH-004 section 9.2 (row NS-2; CS-N5, CS-N10): one module for the Plan screen's list and the native grown-up
 * screens' list. Pins the section 9.2 entries and how each language matches.
 */

describe('the lists of section 9.2', () => {
  it('every en, es and ko word the spec names', () => {
    expect(ACCOUNT_DENY_WORDS.en).toEqual(expect.arrayContaining(['buy', 'purchase', 'price', 'cost', 'upgrade', 'subscribe', 'subscription', 'renew', 'manage', 'trial', 'refund', 'invoice', 'checkout', 'receipt', 'promo', 'billing', 'payment', 'pay', 'card', 'premium', 'unlock', 'web', 'website', 'browser', 'console', 'computer', 'laptop', 'desktop', 'stripe', 'app store', 'google play', 'sign up', 'create an account']));
    expect(ACCOUNT_DENY_WORDS.es).toEqual(expect.arrayContaining(['comprar', 'compra', 'precio', 'costo', 'mejorar', 'suscrib', 'renov', 'gestion', 'prueba gratis', 'reembolso', 'factura', 'recibo', 'promo', 'facturación', 'pago', 'pagar', 'tarjeta', 'premium', 'desbloquear', 'web', 'sitio', 'navegador', 'consola', 'computadora', 'ordenador', 'regístrate']));
    expect(ACCOUNT_DENY_WORDS.ko).toEqual(expect.arrayContaining(['구매', '결제', '가격', '요금', '업그레이드', '구독', '갱신', '환불', '청구', '영수증', '프로모', '카드', '유료', '프리미엄', '잠금 해제', '웹', '사이트', '브라우저', '콘솔', '컴퓨터', '가입']));
    expect(ACCOUNT_DENY_SYMBOLS).toEqual(['$', '€', '£', '₩', 'USD', 'hangulroute.com', 'http']);
  });

  it('the Plan screen list moved here unchanged (F-BILL-002 section 4.8 rule 1)', () => {
    expect(PLAN_SCREEN_DENY).toEqual({
      en: ['web', 'website', 'browser', 'hangulroute.com', 'billing page', 'console'],
      es: ['web', 'sitio', 'navegador', 'hangulroute.com', 'página de facturación', 'consola'],
      ko: ['웹', '사이트', '브라우저', 'hangulroute.com', '결제 페이지', '콘솔'],
    });
  });
});

describe('accountDenyHits', () => {
  it('en: whole words, any case; phrases across spaces', () => {
    expect(accountDenyHits('Buy the plan', 'en')).toEqual(['buy']);
    expect(accountDenyHits('Manage it on the WEB', 'en')).toEqual(['manage', 'web']);
    expect(accountDenyHits('Sign  up today', 'en')).toEqual(['sign up']);
    expect(accountDenyHits('Open the App Store', 'en')).toEqual(['app store']);
    expect(accountDenyHits('Paid by card.', 'en')).toEqual(['card']);
  });

  it('en: not inside other words, and `card` is singular only', () => {
    for (const clean of ['Your cards stay', 'A payload', 'Webster', 'repayment', 'Unlocked doors', 'costume', 'Sign in', 'Signed in as Mina']) {
      expect(accountDenyHits(clean, 'en'), clean).toEqual([]);
    }
  });

  it('es: word starts, any case and accent', () => {
    expect(accountDenyHits('Suscríbete hoy', 'es')).toEqual(['suscrib']);
    expect(accountDenyHits('Renovar el plan', 'es')).toEqual(['renov']);
    expect(accountDenyHits('Gestión del plan', 'es')).toEqual(['gestion']);
    expect(accountDenyHits('REGISTRATE aquí', 'es')).toEqual(['regístrate']);
    expect(accountDenyHits('La facturación', 'es')).toEqual(['factura', 'facturación']);
    expect(accountDenyHits('Comprar ahora', 'es')).toEqual(['comprar', 'compra']);
  });

  it('es: not in the middle of a word', () => {
    for (const clean of ['Entra con tu correo', 'Siempre', 'Las tarjetitas no'.replace('tarjetitas', 'cartas'), 'Docentes: 3']) {
      expect(accountDenyHits(clean, 'es'), clean).toEqual([]);
    }
  });

  it('ko: substrings (particles attach to the word)', () => {
    expect(accountDenyHits('결제를 해요', 'ko')).toEqual(['결제']);
    expect(accountDenyHits('웹사이트에서', 'ko')).toEqual(['웹', '사이트']);
    expect(accountDenyHits('어른 로그인', 'ko')).toEqual([]);
  });

  it('symbols in every language, and a won amount', () => {
    expect(accountDenyHits('$5', 'en')).toEqual(['$']);
    expect(accountDenyHits('5 €', 'es')).toEqual(['€']);
    expect(accountDenyHits('Go to hangulroute.com', 'en')).toEqual(['hangulroute.com']);
    expect(accountDenyHits('https://x', 'ko')).toEqual(['http']);
    expect(accountDenyHits('9,900원', 'ko')).toEqual(['<digit>원']);
    expect(accountDenyHits('3 원', 'ko')).toEqual(['<digit>원']);
    expect(accountDenyHits('어른 공간', 'ko')).toEqual([]);
  });
});

describe('planScreenHasWord (the Plan screen test’s match, moved here)', () => {
  it('whole words in en and es, substrings in ko', () => {
    expect(planScreenHasWord('Open the web page', 'web', 'en')).toBe(true);
    expect(planScreenHasWord('Webster', 'web', 'en')).toBe(false);
    expect(planScreenHasWord('hangulroute.com/teach', 'hangulroute.com', 'en')).toBe(true);
    expect(planScreenHasWord('hangulroutexcom', 'hangulroute.com', 'en')).toBe(false);
    expect(planScreenHasWord('웹에서', '웹', 'ko')).toBe(true);
  });
});
