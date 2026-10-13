import type { DeepPartial, Messages } from '../../types';
import { a11y } from './a11y';
import { caregiver } from './caregiver';
import { common } from './common';
import { consoleMsgs } from './console';
import { learner } from './learner';

/**
 * Korean overlay: drafts of the F-BILL-002 B-6 billing and Plan screen keys, and the notes strings of
 * F-FEEDBACK-001 FB-5b (`common.notes`, `learner.notes`, `caregiver.notes`, `console.notes`,
 * `console.shell.nav.notes`, `a11y.notes`); the rest falls back to English. `ko` stays hidden until
 * the F-I18N-001 translation PR (PR 16) passes the multi-agent ko/es review and records the namespaces
 * in the review ledger.
 */
export const ko = { a11y, learner, caregiver, console: consoleMsgs, common } satisfies DeepPartial<Messages>;
