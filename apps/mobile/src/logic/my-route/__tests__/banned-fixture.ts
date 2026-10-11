import type { UiLocale } from '@hangul-route/content-schema';

/**
 * My route's own banned list (F-ROUTE-001 section 3.13): a test fixture with
 * es / ko equivalents, deliberately not a change to `banned-words.json`
 * (which would break existing copy). The shared lists apply on top.
 * `en` / `es` match whole words, case-insensitive; `ko` matches substrings
 * because particles attach to the stem. `level` applies to learner copy only
 * (grown-up copy may name the level check).
 */
export interface BannedFixture {
  learner: readonly string[];
  /** Learner-only words: dropped for caregiver copy. */
  learnerOnly: readonly string[];
  speaking: readonly string[];
}

export const MY_ROUTE_BANNED: Readonly<Record<UiLocale, BannedFixture>> = {
  en: {
    learner: ['behind', 'late', 'catch up', 'left', 'remaining', 'still to go', 'only', 'ahead of', 'compared', 'rank', 'score', 'premium', 'price', 'unlock'],
    learnerOnly: ['level'],
    speaking: ['speak', 'speaking', 'say it', 'pronounce', 'microphone'],
  },
  es: {
    learner: ['atrás', 'tarde', 'ponerte al día', 'ponerse al día', 'quedan', 'restante', 'restantes', 'falta', 'faltan', 'solo', 'sólo', 'por delante', 'comparado', 'comparada', 'puesto', 'clasificación', 'puntuación', 'premium', 'precio', 'desbloquear'],
    learnerOnly: ['nivel'],
    speaking: ['hablar', 'habla', 'dilo', 'pronunciar', 'pronuncia', 'micrófono'],
  },
  ko: {
    learner: ['뒤처', '늦었', '늦은', '따라잡', '남은', '남았', '아직 남', '밖에', '앞서', '비교', '순위', '점수', '프리미엄', '가격', '잠금 해제'],
    learnerOnly: ['레벨', '등급'],
    speaking: ['말하기', '말해', '말해 보', '발음', '마이크'],
  },
};
