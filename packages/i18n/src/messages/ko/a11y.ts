import type { DeepPartial, Messages } from '../../types';

/** Korean draft of the Plan screen's summary heading (F-BILL-002 B-6), for native review (F-I18N-001 §3.10). */
export const a11y = {
  planStatus: (name: string, state: string) => `${name}: ${state}.`,
} satisfies DeepPartial<Messages['a11y']>;
