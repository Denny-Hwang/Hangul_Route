import type { DeepPartial, Messages } from '../../types';

/** Spanish draft of the Plan screen's summary heading (F-BILL-002 B-6), a draft reviewed by the multi-agent ko/es review in the F-I18N-001 translation PR (PR 15) before `es` ships (F-I18N-001 §3.10). */
export const a11y = {
  planStatus: (name: string, state: string) => `${name}: ${state}.`,
} satisfies DeepPartial<Messages['a11y']>;
