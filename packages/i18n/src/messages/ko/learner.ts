import type { DeepPartial, Messages } from '../../types';

/** Korean draft of the Profile plan card's new keys (F-BILL-002 B-6, §6.3), a draft reviewed by the multi-agent ko/es review in the F-I18N-001 translation PR (PR 16) before `ko` ships (F-I18N-001 §3.10). */
export const learner = {
  profile: {
    plan: {
      fullRoute: '전체 루트',
      open: (source: string | null) => (source === null || source.trim() === '' ? '모두 열려 있어요.' : `${source} 덕분에 모두 열려 있어요.`),
      details: { cta: '플랜 자세히 보기' },
    },
  },
} satisfies DeepPartial<Messages['learner']>;
