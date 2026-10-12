import type { DeepPartial, Messages } from '../../types';

/**
 * Korean draft of the learner Plan screen (F-BILL-002 B-6, §6.2), reviewed by the multi-agent ko/es
 * review in the F-I18N-001 translation PR (PR 16) before `ko` ships (F-I18N-001 §3.10; no review-ledger entry yet, `ko` stays hidden). Status only: no price, no
 * purchase word, and nothing a native build renders mentions the web (§4.8). Names stand before a
 * colon, never before a particle.
 */
export const caregiver = {
  plan: {
    title: '플랜',
    learnerFallback: '학습자',
    covered: {
      title: {
        family: (name: string, source: string) => `${name}: ${source} 플랜이 적용돼요.`,
        self: (source: string) => `${source} 플랜이 적용돼요.`,
      },
      note: { family: '함께하는 동안 모든 레슨이 열려 있어요.', self: '함께하는 동안 모든 레슨이 열려 있어요.' },
      sourceFallback: '반',
    },
    full: {
      title: { family: (name: string) => `${name}: 전체 루트를 이용할 수 있어요.`, self: '전체 루트를 이용할 수 있어요.' },
      fromFamily: { family: '가족이 함께 쓰는 가족 플랜이에요.', self: '내 가족 플랜이에요.' },
      noSource: '모두 열려 있어요.',
    },
    free: {
      title: { family: (name: string) => `${name}: 무료 플랜이에요.`, self: '무료 플랜이에요.' },
      open: '1단계는 언제나 무료예요.',
    },
    openBilling: {
      cta: '결제 화면 열기',
      caption: { family: '플랜과 영수증은 어른용 결제 페이지에 있어요.', self: '내 플랜과 영수증은 결제 페이지에 있어요.' },
      a11yHint: '결제 페이지를 열어요',
    },
    openFailed: (url: string) => `브라우저에서 이 주소를 열어 주세요: ${url}`,
    backToJourney: { cta: '여정으로 돌아가기' },
  },
} satisfies DeepPartial<Messages['caregiver']>;
