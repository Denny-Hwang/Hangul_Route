import type { LearnerType } from '@hangul-route/content-schema';
import { validateDisplayName } from '../profiles/profile-model';
import { formPlan, missingStep, type FormState, type MissingStep } from './create-profile-form';

/**
 * Create a profile in steps — F-LEARN-001 §3.15 (owner decision 2026-10-14).
 * Step 1 asks who is learning (no age wording), step 2 the profile (name,
 * reading level, cub), step 3 the privacy agreement on its own. The steps
 * live in one screen's state, so every answer survives Back and the
 * under-13 switch; the rules of each field are still `formPlan` and
 * `missingStep` (`create-profile-form.ts`), unchanged.
 */
export type SetupStep = 'who' | 'profile' | 'privacy' | 'name';

const ORDER: readonly SetupStep[] = ['who', 'profile', 'privacy'];

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 8.3 (row GU-4): the save after the first quest
 * (`CreateProfile { from: 'guest' }`, `FormState.fromGuest`) has two steps: the name, then Privacy, which opens with
 * who is learning (nothing preselected) and then the agreement card for the answer. Level and cub take the defaults.
 */
const GUEST_ORDER: readonly SetupStep[] = ['name', 'privacy'];

const orderOf = (fromGuest: boolean | undefined): readonly SetupStep[] => (fromGuest === true ? GUEST_ORDER : ORDER);

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

/** [GU] The same on the guest's save: who is learning is asked on the Privacy step. */
const GUEST_STEP_OF: Readonly<Record<MissingStep, SetupStep>> = {
  who: 'privacy',
  name: 'name',
  agree: 'privacy',
  pin: 'privacy',
  email: 'privacy',
};

/** The steps this answer needs: only the question before an answer; Privacy only when a card is drawn. */
export function setupSteps(s: FormState): SetupStep[] {
  // [GU] The guest's save always has both steps: Privacy holds the question too.
  if (s.fromGuest === true) return [...GUEST_ORDER];
  const plan = formPlan(s);
  if (plan === null) return ['who'];
  return plan.card === null ? ['who', 'profile'] : ['who', 'profile', 'privacy'];
}

/** "Step n of N": 1-based; three steps until the answer says otherwise. */
export function stepPosition(step: SetupStep, s: FormState): { n: number; total: number } {
  if (s.fromGuest === true) return { n: GUEST_ORDER.indexOf(step) + 1, total: GUEST_ORDER.length };
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
  // [GU] The guest's name step comes before the question, so it asks for the name alone.
  if (s.fromGuest === true && step === 'name') return validateDisplayName(s.name) === null ? null : 'name';
  const missing = missingStep(s);
  if (missing === null) return null;
  const order = orderOf(s.fromGuest);
  const of = s.fromGuest === true ? GUEST_STEP_OF : STEP_OF;
  return order.indexOf(of[missing]) <= order.indexOf(step) ? missing : null;
}

/** The step Continue opens, `'submit'` on the last one; the question stays put while it has no answer. */
export function nextStep(step: SetupStep, s: FormState): SetupStep | 'submit' {
  if (s.fromGuest === true) return step === 'name' ? 'privacy' : 'submit';
  if (s.learnerType === null) return 'who';
  const steps = setupSteps(s);
  const at = steps.indexOf(step);
  return at === -1 || at === steps.length - 1 ? 'submit' : steps[at + 1]!;
}

/**
 * The step Back opens; `'leave'` on the question (the screen then goes back as before). [GU] On the guest's save,
 * `'leave'` on the name step (back to the save card) and the name step from Privacy, every value kept.
 */
export function previousStep(step: SetupStep, fromGuest = false): SetupStep | 'leave' {
  const order = orderOf(fromGuest);
  const at = order.indexOf(step);
  return at <= 0 ? 'leave' : order[at - 1]!;
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
export function systemBack(step: SetupStep, actionType: string, fromGuest = false): SetupStep | 'leave' | 'ignore' {
  if (!BACK_ACTIONS.has(actionType)) return 'ignore';
  return previousStep(step, fromGuest);
}
