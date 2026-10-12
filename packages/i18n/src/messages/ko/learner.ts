import type { DeepPartial, Messages } from '../../types';

/** Korean draft of the Profile plan card's new keys (F-BILL-002 B-6, §6.3), for native review (F-I18N-001 §3.10). */
export const learner = {
  profile: {
    plan: {
      fullRoute: '전체 루트',
      open: (source: string | null) => (source === null ? '모두 열려 있어요.' : `모두 열려 있어요. 제공: ${source}`),
      details: { cta: '플랜 자세히 보기' },
    },
  },
} satisfies DeepPartial<Messages['learner']>;
