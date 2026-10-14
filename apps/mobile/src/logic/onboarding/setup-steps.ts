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
 * someone a grown-up looks after. The box and any typed PIN are cleared (the
 * statement and the PIN rule change with it); name, email and what the device
 * holds are kept. A "Me" Privacy step exists only on a device with no consent
 * at all, so the step stays, now with the guardian card and a mandatory PIN.
 */
export function switchToGrownUp(s: FormState): FormState {
  return { ...s, learnerType: 'child', agreed: false, pin: null };
}
