import type { DeepPartial, Messages } from '../../types';
import { a11y } from './a11y';
import { caregiver } from './caregiver';
import { consoleMsgs } from './console';
import { learner } from './learner';

/**
 * Spanish overlay: drafts of the F-BILL-002 B-6 billing and Plan screen keys only; the rest falls back
 * to English. `es` stays hidden until the F-I18N-001 translation PR (PR 15) passes the multi-agent ko/es
 * review and records the namespaces in the review ledger.
 */
export const es = { a11y, learner, caregiver, console: consoleMsgs } satisfies DeepPartial<Messages>;
