import type { LearnerType } from '@hangul-route/content-schema';
import { formPlan, missingStep, type FormState, type MissingStep } from './create-profile-form';

/**
 * Create a profile in steps — F-LEARN-001 §3.15 (owner decision 2026-10-14).
 * Step 1 asks who is learning (no age wording), step 2 the profile (name,
 * reading level, cub), step 3 the privacy agreement on its own. The steps
 * live in one screen's state, so every answer survives Back and the
 * under-13 switch; the rules of each field are still `formPlan` and
 * `missingStep` (`create-profile-form.ts`), unchanged.
 */
export type SetupStep = 'who' | 'profile' | 'privacy';

const ORDER: readonly SetupStep[] = ['who', 'profile', 'privacy'];

/** Navigator actions that are a back (the others, such as the REPLACE after submit, pass through). */
const BACK_ACTIONS: ReadonlySet<string> = new Set(['GO_BACK', 'POP', 'POP_TO_TOP']);

/** Which captions belong to which step (§3.2 item 6 order inside each). */
const STEP_OF: Readonly<Record<MissingStep, SetupStep>> = {
  who: 'who',
  name: 'profile',
  agree: 'privacy',
  pin: 'privacy',
  email: 'privacy',
};

/** The steps this answer needs: only the question before an answer; Privacy only when a card is drawn. */
export function setupSteps(s: FormState): SetupStep[] {
  const plan = formPlan(s);
  if (plan === null) return ['who'];
  return plan.card === null ? ['who', 'profile'] : ['who', 'profile', 'privacy'];
}

/** "Step n of N": 1-based; three steps until the answer says otherwise. */
export function stepPosition(step: SetupStep, s: FormState): { n: number; total: number } {
  const total = s.learnerType === null ? ORDER.length : setupSteps(s).length;
  return { n: ORDER.indexOf(step) + 1, total };
}

/**
 * What this step still needs before its Continue works, or `null`. A gap of a
 * later step is not this step's business; a gap of an earlier one is (it can
 * only happen when a step is reached out of order, and it keeps the last
 * Continue from submitting an incomplete form).
 */
export function stepMissing(step: SetupStep, s: FormState): MissingStep | null {
  const missing = missingStep(s);
  if (missing === null) return null;
  return ORDER.indexOf(STEP_OF[missing]) <= ORDER.indexOf(step) ? missing : null;
}

/** The step Continue opens, `'submit'` on the last one; the question stays put while it has no answer. */
export function nextStep(step: SetupStep, s: FormState): SetupStep | 'submit' {
  if (s.learnerType === null) return 'who';
  const steps = setupSteps(s);
  const at = steps.indexOf(step);
  return at === -1 || at === steps.length - 1 ? 'submit' : steps[at + 1]!;
}

/** The step Back opens; `'leave'` on the question (the screen then goes back as before). */
export function previousStep(step: SetupStep): SetupStep | 'leave' {
  const at = ORDER.indexOf(step);
  return at <= 0 ? 'leave' : ORDER[at - 1]!;
}

/**
 * "I'm under 13" on the Privacy step of "Me" (§3.15.3): the learner becomes
 * someone a grown-up looks after. The box, any typed PIN and the email are
 * cleared (the email was typed by the learner, so it is never kept as the
 * grown-up's); name, level, cub and what the device holds are kept. A "Me"
 * Privacy step exists only on a device with no consent at all, so the step
 * stays, now with the guardian card and a mandatory PIN.
 */
export function switchToGrownUp(s: FormState): FormState {
  return { ...s, learnerType: 'child', agreed: false, pin: null, email: '' };
}

/**
 * Whether an answer can be picked on step 1 (§3.15.3, the age statement is
 * latched). Once "I'm under 13" was pressed, "Me" stays closed for the life of
 * the form, so going Back cannot bring the "13 or older" box again; leaving
 * the screen starts a new form.
 */
export function canChooseWho(next: LearnerType, under13: boolean): boolean {
  return !(under13 && next === 'self');
}

/** Wording of the profile step after the switch: still first person, the learner holds the device. */
export function profileVoice(learnerType: LearnerType, under13: boolean): LearnerType {
  return under13 ? 'self' : learnerType;
}

/**
 * What a system back (Android back, the iOS swipe is off past step 1) does on
 * this step (§3.15.4): `'leave'` lets the route go, `'ignore'` lets an action
 * that is not a back (a replace after submit, a navigate) through untouched,
 * and a step is the one to open instead of leaving.
 */
export function systemBack(step: SetupStep, actionType: string): SetupStep | 'leave' | 'ignore' {
  if (!BACK_ACTIONS.has(actionType)) return 'ignore';
  return previousStep(step);
}
