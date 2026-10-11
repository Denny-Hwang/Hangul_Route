import type { AssessmentQuestion, AssessmentResponse } from './question';

/**
 * A linear list of questions with a response log (F-PLC-001 section 3.3).
 * Non-adaptive and pure: every function returns a new session and never reads a
 * clock (the caller passes `nowMs`; deadlines live in clock.ts).
 */
export interface AssessmentSession {
  readonly questions: readonly AssessmentQuestion[];
  readonly responses: readonly AssessmentResponse[];
  /** Set by `expire`; null while the session is open. */
  readonly endedAtMs: number | null;
}

export interface ResponseMeta {
  ms: number;
  /** The sound guide was revealed before answering. */
  assisted?: boolean;
}

export interface Tally {
  asked: number;
  correct: number;
  wrong: number;
  skipped: number;
  /** Correct answers given after the sound guide was revealed (a subset of `correct`). */
  assistedCorrect: number;
}

const MAX_MS = 600_000;

const clampMs = (ms: number): number => (Number.isFinite(ms) ? Math.min(MAX_MS, Math.max(0, Math.round(ms))) : 0);

export const startSession = (questions: readonly AssessmentQuestion[]): AssessmentSession => {
  const seen = new Set<string>();
  for (const q of questions) {
    if (seen.has(q.id)) throw new Error(`duplicate question id in session: ${q.id}`);
    seen.add(q.id);
  }
  return { questions: questions.slice(), responses: [], endedAtMs: null };
};

const openQuestion = (session: AssessmentSession, questionId: string): AssessmentQuestion => {
  if (session.endedAtMs !== null) throw new Error('the session has already ended');
  const question = session.questions.find((q) => q.id === questionId);
  if (question === undefined) throw new Error(`question ${questionId} is not in the session`);
  if (session.responses.some((r) => r.questionId === questionId)) {
    throw new Error(`question ${questionId} already has a response`);
  }
  return question;
};

const withResponse = (session: AssessmentSession, response: AssessmentResponse): AssessmentSession => ({
  ...session,
  responses: [...session.responses, response],
});

/** Records `correct` or `wrong` for an option of the question. */
export const answer = (
  session: AssessmentSession,
  questionId: string,
  optionId: string,
  meta: ResponseMeta,
): AssessmentSession => {
  const question = openQuestion(session, questionId);
  const chosen = question.options.find((o) => o.id === optionId);
  if (chosen === undefined) throw new Error(`option ${optionId} is not an option of question ${questionId}`);
  return withResponse(session, {
    questionId,
    outcome: chosen.isCorrect ? 'correct' : 'wrong',
    chosenOptionId: optionId,
    assisted: meta.assisted === true,
    ms: clampMs(meta.ms),
  });
};

/** "I am not sure" and every other non-answer: `skipped`, never `wrong`. */
export const skip = (session: AssessmentSession, questionId: string, meta: ResponseMeta): AssessmentSession => {
  openQuestion(session, questionId);
  return withResponse(session, {
    questionId,
    outcome: 'skipped',
    chosenOptionId: null,
    assisted: meta.assisted === true,
    ms: clampMs(meta.ms),
  });
};

/**
 * The session clock ran out (the caller decides when, with clock.ts). Every
 * unanswered question becomes `skipped`, **never `wrong`**, and the session
 * ends. Calling it on an ended session returns it unchanged.
 */
export const expire = (session: AssessmentSession, nowMs: number): AssessmentSession => {
  if (session.endedAtMs !== null) return session;
  const answered = new Set(session.responses.map((r) => r.questionId));
  const rest: AssessmentResponse[] = session.questions
    .filter((q) => !answered.has(q.id))
    .map((q) => ({ questionId: q.id, outcome: 'skipped', chosenOptionId: null, assisted: false, ms: 0 }));
  return { ...session, responses: [...session.responses, ...rest], endedAtMs: nowMs };
};

export const tally = (responses: readonly AssessmentResponse[]): Tally => {
  const t: Tally = { asked: responses.length, correct: 0, wrong: 0, skipped: 0, assistedCorrect: 0 };
  for (const r of responses) {
    t[r.outcome] += 1;
    if (r.outcome === 'correct' && r.assisted) t.assistedCorrect += 1;
  }
  return t;
};
