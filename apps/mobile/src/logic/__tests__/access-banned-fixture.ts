import type { UiLocale } from '@hangul-route/i18n';

/**
 * F-ENT-003 section 3.11: the words no learner string of the free limit may use, with their
 * Spanish and Korean equivalents, on top of the shared `banned-words.json` lists. Matched with
 * `findWord` (whole tokens in en and es, substrings in ko).
 */
export const ACCESS_BANNED: Readonly<Record<UiLocale, readonly string[]>> = {
  en: [
    'premium',
    'price',
    'buy',
    'pay',
    'trial',
    'expired',
    'ended',
    'locked',
    'unlock',
    'unlocked',
    'left',
    'only',
    'remaining',
    'late',
    'skipped',
    'wrong',
    'not in your plan',
    'family lifetime',
    'family plan',
    'group license',
    'day',
    'days',
  ],
  es: [
    'premium',
    'precio',
    'comprar',
    'compra',
    'pagar',
    'prueba',
    'caducado',
    'vencido',
    'terminó',
    'bloqueado',
    'bloqueada',
    'desbloquear',
    'quedan',
    'solo',
    'restante',
    'tarde',
    'saltaste',
    'incorrecto',
    'no está en tu plan',
    'plan familiar',
    'licencia de grupo',
    'día',
    'días',
  ],
  ko: ['프리미엄', '가격', '구매', '결제', '체험', '만료', '종료', '잠김', '잠금', '남은', '남았', '뿐', '늦', '건너뛴', '틀렸', '플랜에 없', '패밀리 플랜', '그룹 라이선스', '일째', '일 동안'],
};

/** Also banned on a self-only device's learner strings (CLAUDE.md section 1). */
export const SELF_BANNED: Readonly<Record<UiLocale, readonly string[]>> = {
  en: ['grown-up', 'grown up', 'grownup'],
  es: ['adulto', 'adulta'],
  ko: ['어른', '보호자'],
};

/** A percent sign, a count such as "3/5", any digit. */
export const ACCESS_BANNED_PATTERNS: readonly RegExp[] = [/%/, /\d+ ?\/ ?\d+/, /\d/];
