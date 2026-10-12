import type { DeepPartial, Messages } from '../../types';
import { a11y } from './a11y';
import { caregiver } from './caregiver';
import { consoleMsgs } from './console';
import { learner } from './learner';

/**
 * Korean overlay: drafts of the F-BILL-002 B-6 billing and Plan screen keys only; the rest falls back
 * to English. `ko` stays hidden until the F-I18N-001 translation PR (PR 16) passes the multi-agent ko/es
 * review and records the namespaces in the review ledger.
 */
export const ko = { a11y, learner, caregiver, console: consoleMsgs } satisfies DeepPartial<Messages>;
