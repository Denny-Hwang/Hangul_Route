import type { DeepPartial, Messages } from '../../types';

/** Spanish draft of the Profile plan card's new keys (F-BILL-002 B-6, §6.3), a draft reviewed by the multi-agent ko/es review in the F-I18N-001 translation PR (PR 15) before `es` ships (F-I18N-001 §3.10). */
export const learner = {
  profile: {
    plan: {
      fullRoute: 'Ruta completa',
      open: (source: string | null) => (source === null || source.trim() === '' ? 'Todo está abierto.' : `Todo está abierto, gracias a ${source}.`),
      details: { cta: 'Detalles del plan' },
    },
  },
} satisfies DeepPartial<Messages['learner']>;
