import { NATIVE_AUTH_TELEMETRY_PAYLOADS } from '@hangul-route/content-schema/native-auth-telemetry';
import { describe, expect, it, vi } from 'vitest';
import {
  classifySignInError,
  emailReady,
  firstFactorsOf,
  initialSignInState,
  resendCode,
  secondCodeSent,
  secondStepOf,
  signInFlowPayload,
  signInProof,
  signInReducer,
  submitCode,
  submitEmail,
  submitPassword,
  submitSecond,
  switchToCode,
  type ClerkSignInView,
  type SecondStep,
  type SignInEvent,
  type SignInPort,
  type SignInState,
} from '../sign-in-step';

/**
 * F-AUTH-004 sections 6.3 and 15 (row NS-3): the sign-in step machine over every transition and status
 * (`needs_first_factor`, `needs_second_factor`, the new-device check as the pinned SDK reports it and as
 * `needs_client_trust`, backup codes, `needs_new_password` and unknown statuses), the error table, and one
 * `auth.native.signin` per flow.
 */

const view = (over: Partial<ClerkSignInView> = {}): ClerkSignInView => ({
  status: 'needs_first_factor',
  supportedFirstFactors: [
    { strategy: 'email_code', emailAddressId: 'ea_1' },
    { strategy: 'password' },
  ],
  supportedSecondFactors: null,
  clientTrustState: null,
  createdSessionId: null,
  ...over,
});

const clerkError = (code: string, status = 422): Error & { clerkError: true; status: number; errors: { code: string; message: string }[] } =>
  Object.assign(new Error(`Clerk said ${code}`), { clerkError: true as const, status, errors: [{ code, message: 'English from Clerk' }] });

function fakePort(over: Partial<SignInPort> = {}): SignInPort & { calls: string[] } {
  const calls: string[] = [];
  const log =
    <A extends unknown[], R>(name: string, fn: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      calls.push(`${name}:${JSON.stringify(args[0] ?? null)}`);
      return fn(...args);
    };
  return {
    calls,
    create: log('create', over.create ?? (async () => view())),
    prepareFirstFactor: log('prepareFirstFactor', over.prepareFirstFactor ?? (async () => view())),
    attemptFirstFactor: log('attemptFirstFactor', over.attemptFirstFactor ?? (async () => view({ status: 'complete', createdSessionId: 'sess_1' }))),
    prepareSecondFactor: log('prepareSecondFactor', over.prepareSecondFactor ?? (async () => view({ status: 'needs_second_factor' }))),
    attemptSecondFactor: log('attemptSecondFactor', over.attemptSecondFactor ?? (async () => view({ status: 'complete', createdSessionId: 'sess_2' }))),
    setActive: log('setActive', over.setActive ?? (async () => undefined)),
  };
}

const apply = (state: SignInState, ...events: SignInEvent[]): SignInState => events.reduce(signInReducer, state);

const SECOND: SecondStep = { kind: 'second', strategy: 'totp', factorId: null, backupOffered: true, usingBackup: false };

describe('the email step', () => {
  it('Continue waits for an @ (D1)', () => {
    expect(emailReady('')).toBe(false);
    expect(emailReady('dana')).toBe(false);
    expect(emailReady('dana@')).toBe(true);
  });

  it('reads the first factors: the email code with its address id, and the password', () => {
    expect(firstFactorsOf(view())).toEqual({ emailAddressId: 'ea_1', password: true });
    expect(firstFactorsOf(view({ supportedFirstFactors: [{ strategy: 'password' }] }))).toEqual({ emailAddressId: null, password: true });
    expect(firstFactorsOf(view({ supportedFirstFactors: [{ strategy: 'email_code', emailAddressId: '' }, { strategy: 'oauth_google' }] }))).toEqual({ emailAddressId: null, password: false });
    expect(firstFactorsOf(view({ supportedFirstFactors: null }))).toEqual({ emailAddressId: null, password: false });
  });

  it('with the email code: prepares it for that address and goes to the code step (the email trimmed)', async () => {
    const port = fakePort();
    expect(await submitEmail(port, '  dana@example.com ', false)).toEqual({ type: 'to_code', email: 'dana@example.com', factors: { emailAddressId: 'ea_1', password: true } });
    expect(port.calls).toEqual(['create:"dana@example.com"', 'prepareFirstFactor:{"strategy":"email_code","emailAddressId":"ea_1"}']);
  });

  it('D21: while a re-trust is pending, an account with a password goes to the password step first, sending no code', async () => {
    const port = fakePort();
    expect(await submitEmail(port, 'dana@example.com', true)).toMatchObject({ type: 'to_password' });
    expect(port.calls).toEqual(['create:"dana@example.com"']);
  });

  it('D21: a re-trust pending on an account with the email code only still sends the code (R-1)', async () => {
    const port = fakePort({ create: async () => view({ supportedFirstFactors: [{ strategy: 'email_code', emailAddressId: 'ea_1' }] }) });
    expect(await submitEmail(port, 'dana@example.com', true)).toMatchObject({ type: 'to_code', factors: { password: false } });
  });

  it('a password-only account goes to the password step; an account with neither ends in unsupported', async () => {
    expect(await submitEmail(fakePort({ create: async () => view({ supportedFirstFactors: [{ strategy: 'password' }] }) }), 'a@b', false)).toMatchObject({ type: 'to_password' });
    expect(await submitEmail(fakePort({ create: async () => view({ supportedFirstFactors: [{ strategy: 'oauth_google' }, { strategy: 'passkey' }, { strategy: 'email_link', emailAddressId: 'ea' }] }) }), 'a@b', false)).toEqual({ type: 'unsupported' });
  });

  it('an answer that is not "needs_first_factor" ends in unsupported', async () => {
    expect(await submitEmail(fakePort({ create: async () => view({ status: 'needs_identifier' }) }), 'a@b', false)).toEqual({ type: 'unsupported' });
  });

  it('a refused email is cantSignIn whatever Clerk said; a failed code send keeps its own line', async () => {
    expect(await submitEmail(fakePort({ create: async () => Promise.reject(clerkError('form_identifier_not_found')) }), 'a@b', false)).toEqual({ type: 'failed', line: 'cantSignIn', result: 'refused', clear: false });
    expect(await submitEmail(fakePort({ create: async () => Promise.reject(clerkError('form_param_format_invalid')) }), 'a@b', false)).toMatchObject({ line: 'cantSignIn' });
    expect(await submitEmail(fakePort({ prepareFirstFactor: async () => Promise.reject(clerkError('too_many_requests', 429)) }), 'a@b', false)).toMatchObject({ line: 'tooMany', result: 'too_many' });
  });
});

describe('the error table (section 6.3): Clerk’s English never shows', () => {
  it.each([
    [clerkError('form_code_incorrect'), 'other', 'wrongCode', 'wrong_code'],
    [clerkError('verification_expired'), 'other', 'codeExpired', 'expired'],
    [clerkError('verification_failed'), 'other', 'codeExpired', 'expired'],
    [clerkError('form_password_incorrect'), 'other', 'wrongPassword', 'wrong_password'],
    [clerkError('form_identifier_not_found'), 'other', 'cantSignIn', 'refused'],
    [clerkError('form_identifier_not_found', 404), 'identify', 'cantSignIn', 'refused'],
    [clerkError('anything_else', 400), 'identify', 'cantSignIn', 'refused'],
    [Object.assign(new Error('x'), { status: 403 }), 'identify', 'cantSignIn', 'refused'],
    [clerkError('too_many_requests', 429), 'other', 'tooMany', 'too_many'],
    [clerkError('user_locked', 403), 'identify', 'tooMany', 'too_many'],
    [Object.assign(new Error('rate'), { status: 429 }), 'other', 'tooMany', 'too_many'],
    [Object.assign(new Error('offline'), { code: 'network_error' }), 'identify', 'offline', 'offline'],
    [new TypeError('Network request failed'), 'other', 'offline', 'offline'],
    [clerkError('session_exists', 400), 'other', 'generic', 'error'],
    [new Error('boom'), 'identify', 'generic', 'error'],
    [new TypeError('x is undefined'), 'other', 'generic', 'error'],
    ['a string', 'other', 'generic', 'error'],
    [null, 'identify', 'generic', 'error'],
  ] as const)('%s (%s) → %s / %s', (error, phase, line, result) => {
    expect(classifySignInError(error, phase)).toEqual({ line, result });
  });

  it('a Clerk error list with no codes is read as a refusal on the email step only', () => {
    const odd = Object.assign(new Error('odd'), { errors: [{ message: 'no code' }, 'junk'] });
    expect(classifySignInError(odd, 'identify')).toEqual({ line: 'generic', result: 'error' });
    expect(classifySignInError(Object.assign(new Error('odd'), { errors: 'not a list', status: 'x' }), 'identify')).toEqual({ line: 'generic', result: 'error' });
  });
});

describe('the code and password steps', () => {
  it('a right code completes: the session is set active', async () => {
    const port = fakePort();
    expect(await submitCode(port, ' 482139 ')).toEqual({ type: 'done' });
    expect(port.calls).toEqual(['attemptFirstFactor:{"strategy":"email_code","code":"482139"}', 'setActive:"sess_1"']);
  });

  it('a wrong code keeps the step and clears the field; an expired one says so and clears it too (board 9)', async () => {
    expect(await submitCode(fakePort({ attemptFirstFactor: async () => Promise.reject(clerkError('form_code_incorrect')) }), '1')).toEqual({ type: 'failed', line: 'wrongCode', result: 'wrong_code', clear: true });
    expect(await submitCode(fakePort({ attemptFirstFactor: async () => Promise.reject(clerkError('verification_expired')) }), '1')).toEqual({ type: 'failed', line: 'codeExpired', result: 'expired', clear: true });
  });

  it('a wrong password clears the field; the password goes as typed (never trimmed)', async () => {
    const port = fakePort({ attemptFirstFactor: async () => Promise.reject(clerkError('form_password_incorrect')) });
    expect(await submitPassword(port, ' secret ')).toEqual({ type: 'failed', line: 'wrongPassword', result: 'wrong_password', clear: true });
    expect(port.calls).toEqual(['attemptFirstFactor:{"strategy":"password","password":" secret "}']);
  });

  it('complete with no session, or a refused setActive, is the generic line', async () => {
    expect(await submitPassword(fakePort({ attemptFirstFactor: async () => view({ status: 'complete', createdSessionId: null }) }), 'p')).toMatchObject({ line: 'generic' });
    expect(await submitPassword(fakePort({ attemptFirstFactor: async () => view({ status: 'complete', createdSessionId: '' }) }), 'p')).toMatchObject({ line: 'generic' });
    expect(await submitPassword(fakePort({ setActive: async () => Promise.reject(new Error('no')) }), 'p')).toMatchObject({ line: 'generic', result: 'error' });
  });

  it('needs_new_password, needs_first_factor again and any unknown status end in unsupported', async () => {
    for (const status of ['needs_new_password', 'needs_first_factor', 'needs_identifier', 'abandoned', null]) {
      expect(await submitPassword(fakePort({ attemptFirstFactor: async () => view({ status }) }), 'p'), String(status)).toEqual({ type: 'unsupported' });
    }
  });
});

describe('the second step and the new-device check', () => {
  it('an authenticator: the second step, nothing sent, Use a backup code when the account has backup codes', async () => {
    const port = fakePort({ attemptFirstFactor: async () => view({ status: 'needs_second_factor', supportedSecondFactors: [{ strategy: 'totp' }, { strategy: 'backup_code' }] }) });
    expect(await submitPassword(port, 'p')).toEqual({ type: 'to_second', second: { kind: 'second', strategy: 'totp', factorId: null, backupOffered: true, usingBackup: false } });
    expect(port.calls.some((c) => c.startsWith('prepareSecondFactor'))).toBe(false);
  });

  it('a texted code: prepared for that phone number first', async () => {
    const port = fakePort({ attemptFirstFactor: async () => view({ status: 'needs_second_factor', supportedSecondFactors: [{ strategy: 'phone_code', phoneNumberId: 'pn_1' }] }) });
    expect(await submitCode(port, '1')).toMatchObject({ type: 'to_second', second: { kind: 'second', strategy: 'phone_code', factorId: 'pn_1', backupOffered: false } });
    expect(port.calls).toContain('prepareSecondFactor:{"strategy":"phone_code","phoneNumberId":"pn_1"}');
  });

  it('the pinned SDK reports Clerk’s device check as needs_second_factor with clientTrustState new: the device line (U6)', async () => {
    const port = fakePort({
      attemptFirstFactor: async () => view({ status: 'needs_second_factor', clientTrustState: 'new', supportedSecondFactors: [{ strategy: 'email_code', emailAddressId: 'ea_1' }] }),
    });
    expect(await submitPassword(port, 'p')).toMatchObject({ type: 'to_second', second: { kind: 'device', strategy: 'email_code', factorId: 'ea_1', backupOffered: false } });
    expect(port.calls).toContain('prepareSecondFactor:{"strategy":"email_code","emailAddressId":"ea_1"}');
  });

  it('a raw needs_client_trust status (a later SDK) is the device check, by email or text only', async () => {
    const trust = (factors: { strategy: string; emailAddressId?: string; phoneNumberId?: string }[]): ClerkSignInView => view({ status: 'needs_client_trust', supportedSecondFactors: factors });
    expect(secondStepOf(trust([{ strategy: 'totp' }, { strategy: 'phone_code', phoneNumberId: 'pn' }, { strategy: 'backup_code' }]))).toMatchObject({ kind: 'device', strategy: 'phone_code', factorId: 'pn', backupOffered: false });
    expect(secondStepOf(trust([{ strategy: 'email_code' }]))).toMatchObject({ kind: 'device', strategy: 'email_code', factorId: null });
    expect(secondStepOf(trust([{ strategy: 'totp' }, { strategy: 'email_link', emailAddressId: 'ea' }]))).toBeNull();
    expect(await submitCode(fakePort({ attemptFirstFactor: async () => trust([{ strategy: 'totp' }]) }), '1')).toEqual({ type: 'unsupported' });
  });

  it('a known device with an emailed second factor is the second step, not the device check', () => {
    expect(secondStepOf(view({ status: 'needs_second_factor', clientTrustState: 'known', supportedSecondFactors: [{ strategy: 'email_code', emailAddressId: 'ea' }] }))).toMatchObject({ kind: 'second', strategy: 'email_code' });
    expect(secondStepOf(view({ status: 'needs_second_factor', clientTrustState: 'new', supportedSecondFactors: [{ strategy: 'totp' }] }))).toMatchObject({ kind: 'second', strategy: 'totp' });
    expect(secondStepOf(view({ status: 'needs_second_factor', clientTrustState: 'new', supportedSecondFactors: [{ strategy: 'phone_code' }] }))).toMatchObject({ kind: 'second', strategy: 'phone_code', factorId: null });
  });

  it('no factor this app has (an email link, a backup code alone, none): unsupported', async () => {
    for (const factors of [[{ strategy: 'email_link', emailAddressId: 'ea' }], [{ strategy: 'backup_code' }], [], null]) {
      expect(await submitPassword(fakePort({ attemptFirstFactor: async () => view({ status: 'needs_second_factor', supportedSecondFactors: factors }) }), 'p')).toEqual({ type: 'unsupported' });
    }
  });

  it('a send that fails on the way into the second step keeps its line', async () => {
    const port = fakePort({
      attemptFirstFactor: async () => view({ status: 'needs_second_factor', supportedSecondFactors: [{ strategy: 'email_code' }] }),
      prepareSecondFactor: async () => Promise.reject(clerkError('too_many_requests', 429)),
    });
    expect(await submitCode(port, '1')).toMatchObject({ type: 'failed', line: 'tooMany' });
    expect(port.calls).toContain('prepareSecondFactor:{"strategy":"email_code"}');
  });

  it('Sign in on the second step: its strategy; a second factor that completes is recorded before done', async () => {
    const port = fakePort();
    expect(await submitSecond(port, SECOND, ' 123456 ')).toEqual([{ type: 'second_done', strategy: 'totp' }, { type: 'done' }]);
    expect(port.calls[0]).toBe('attemptSecondFactor:{"strategy":"totp","code":"123456"}');
  });

  it('a backup code goes as backup_code', async () => {
    const port = fakePort();
    expect(await submitSecond(port, { ...SECOND, usingBackup: true }, 'abcd-efgh')).toEqual([{ type: 'second_done', strategy: 'backup_code' }, { type: 'done' }]);
    expect(port.calls[0]).toBe('attemptSecondFactor:{"strategy":"backup_code","code":"abcd-efgh"}');
  });

  it('the device check is not a second factor: done alone', async () => {
    expect(await submitSecond(fakePort(), { ...SECOND, kind: 'device', strategy: 'email_code' }, '1')).toEqual([{ type: 'done' }]);
  });

  it('a wrong second code keeps the step; a second step after the second step is followed', async () => {
    expect(await submitSecond(fakePort({ attemptSecondFactor: async () => Promise.reject(clerkError('form_code_incorrect')) }), SECOND, '1')).toEqual([{ type: 'failed', line: 'wrongCode', result: 'wrong_code', clear: true }]);
    expect(await submitSecond(fakePort({ attemptSecondFactor: async () => view({ status: 'needs_client_trust', supportedSecondFactors: [{ strategy: 'email_code' }] }) }), SECOND, '1')).toEqual([
      { type: 'to_second', second: { kind: 'device', strategy: 'email_code', factorId: null, backupOffered: false, usingBackup: false } },
    ]);
  });

  it('Send a new code shows only for a code that was sent', () => {
    expect(secondCodeSent(SECOND)).toBe(false);
    expect(secondCodeSent({ ...SECOND, strategy: 'phone_code' })).toBe(true);
    expect(secondCodeSent({ ...SECOND, strategy: 'email_code', usingBackup: true })).toBe(false);
  });
});

describe('Send a new code and Email me a code', () => {
  const codeStep = apply(initialSignInState(false), { type: 'to_code', email: 'a@b', factors: { emailAddressId: 'ea_1', password: true } });

  it('on the code step: the email code again', async () => {
    const port = fakePort();
    expect(await resendCode(port, codeStep)).toEqual({ type: 'code_sent' });
    expect(port.calls).toEqual(['prepareFirstFactor:{"strategy":"email_code","emailAddressId":"ea_1"}']);
  });

  it('on the second step: the sent code again; never for an authenticator or a backup code', async () => {
    const port = fakePort();
    const phone = apply(codeStep, { type: 'to_second', second: { ...SECOND, strategy: 'phone_code', factorId: 'pn' } });
    expect(await resendCode(port, phone)).toEqual({ type: 'code_sent' });
    expect(port.calls).toEqual(['prepareSecondFactor:{"strategy":"phone_code","phoneNumberId":"pn"}']);
    expect(await resendCode(fakePort(), apply(codeStep, { type: 'to_second', second: SECOND }))).toMatchObject({ type: 'failed', line: 'generic' });
    expect(await resendCode(fakePort(), { ...phone, second: null })).toMatchObject({ type: 'failed', line: 'generic' });
  });

  it('nowhere else, and a refused send keeps its line', async () => {
    expect(await resendCode(fakePort(), initialSignInState(false))).toMatchObject({ type: 'failed', line: 'generic' });
    expect(await resendCode(fakePort({ prepareFirstFactor: async () => Promise.reject(clerkError('too_many_requests', 429)) }), codeStep)).toMatchObject({ line: 'tooMany' });
  });

  it('Email me a code on the password step: prepared, then the code step with the email kept', async () => {
    const password = apply(codeStep, { type: 'use_password' });
    const port = fakePort();
    expect(await switchToCode(port, password)).toEqual({ type: 'to_code', email: 'a@b', factors: { emailAddressId: 'ea_1', password: true } });
    expect(await switchToCode(fakePort(), { ...password, factors: { emailAddressId: null, password: true } })).toMatchObject({ type: 'failed', line: 'generic' });
    expect(await switchToCode(fakePort({ prepareFirstFactor: async () => Promise.reject(Object.assign(new Error('x'), { code: 'network_error' })) }), password)).toMatchObject({ line: 'offline' });
  });
});

describe('the reducer', () => {
  const start = initialSignInState(true);

  it('starts on the email step, not busy, with no flow result; the re-trust flag kept', () => {
    expect(start).toMatchObject({ step: 'email', busy: false, line: null, retrustPending: true, flow: { method: 'none', result: null, second: false, ended: false } });
  });

  it('a Clerk call makes it busy and clears the line; every answer ends the wait', () => {
    const failed = apply(start, { type: 'start' }, { type: 'failed', line: 'cantSignIn', result: 'refused', clear: false });
    expect(failed).toMatchObject({ busy: false, line: 'cantSignIn', clearField: 0, flow: { result: 'refused' } });
    expect(apply(failed, { type: 'start' })).toMatchObject({ busy: true, line: null });
  });

  it('a wrong code or password bumps the field (cleared and focused); other lines keep it; every line is counted', () => {
    expect(apply(start, { type: 'failed', line: 'wrongCode', result: 'wrong_code', clear: true }).clearField).toBe(1);
    const twice = apply(start, { type: 'failed', line: 'tooMany', result: 'too_many', clear: false }, { type: 'failed', line: 'tooMany', result: 'too_many', clear: false });
    expect(twice).toMatchObject({ clearField: 0, lineSeq: 2 });
  });

  it('every step change: the new step, its factors, a fresh field; the second step marks the flow', () => {
    const code = apply(start, { type: 'to_code', email: 'a@b', factors: { emailAddressId: 'e', password: true } });
    expect(code).toMatchObject({ step: 'code', email: 'a@b', clearField: 1 });
    expect(apply(start, { type: 'to_password', email: 'a@b', factors: { emailAddressId: null, password: true } })).toMatchObject({ step: 'password', clearField: 1 });
    const second = apply(code, { type: 'to_second', second: SECOND });
    expect(second).toMatchObject({ step: 'second', second: SECOND, flow: { second: true } });
    expect(apply(second, { type: 'code_sent' })).toMatchObject({ step: 'second', clearField: 3, line: null });
  });

  it('Use my password only on the code step of an account with a password', () => {
    const code = apply(start, { type: 'to_code', email: 'a@b', factors: { emailAddressId: 'e', password: true } });
    expect(apply(code, { type: 'use_password' }).step).toBe('password');
    const codeOnly = apply(start, { type: 'to_code', email: 'a@b', factors: { emailAddressId: 'e', password: false } });
    expect(apply(codeOnly, { type: 'use_password' })).toBe(codeOnly);
    const second = apply(code, { type: 'to_second', second: SECOND });
    expect(apply(second, { type: 'use_password' })).toBe(second);
    const email = { ...start, factors: { emailAddressId: 'e', password: true } };
    expect(apply(email, { type: 'use_password' })).toBe(email);
  });

  it('Use a backup code once, where offered: a plain field (D4)', () => {
    const second = apply(start, { type: 'to_second', second: SECOND });
    const backup = apply(second, { type: 'use_backup' });
    expect(backup.second).toMatchObject({ usingBackup: true });
    expect(apply(backup, { type: 'use_backup' })).toBe(backup);
    const none = apply(start, { type: 'to_second', second: { ...SECOND, backupOffered: false } });
    expect(apply(none, { type: 'use_backup' })).toBe(none);
    expect(apply(start, { type: 'use_backup' })).toBe(start);
  });

  it('Use another email: back to the email step, the email kept, the account forgotten', () => {
    const second = apply(start, { type: 'to_code', email: 'a@b', factors: { emailAddressId: 'e', password: true } }, { type: 'to_second', second: SECOND }, { type: 'second_done', strategy: 'totp' });
    expect(apply(second, { type: 'change_email' })).toMatchObject({ step: 'email', email: 'a@b', factors: { emailAddressId: null, password: false }, second: null, secondDone: null });
    expect(apply(start, { type: 'unsupported' }, { type: 'change_email' })).toMatchObject({ step: 'email', line: null, flow: { result: 'unsupported' } });
  });

  it('done: the flow result is ok; ended marks the event sent', () => {
    const done = apply(start, { type: 'attempt', method: 'password' }, { type: 'failed', line: 'wrongPassword', result: 'wrong_password', clear: true }, { type: 'done' });
    // The screen keeps its last step drawn, waiting, while section 6.5 runs.
    expect(done).toMatchObject({ step: 'done', busy: true, flow: { method: 'password', result: 'ok' } });
    expect(apply(done, { type: 'ended' }).flow.ended).toBe(true);
  });
});

describe('the proof (section 7.3) and the one event per flow (section 15)', () => {
  it('a proof only once done after an attempt: the method, the second factor, whether the account has a password', () => {
    const base = apply(initialSignInState(false), { type: 'to_code', email: 'a@b', factors: { emailAddressId: 'e', password: true } });
    expect(signInProof(base)).toBeNull();
    expect(signInProof(apply(base, { type: 'done' }))).toBeNull();
    expect(signInProof(apply(base, { type: 'attempt', method: 'email_code' }, { type: 'second_done', strategy: 'totp' }, { type: 'done' }))).toEqual({ method: 'email_code', second: 'totp', hasPassword: true });
  });

  it('leaving with no result is cancelled; with one, the last; ok once done; nothing once sent', () => {
    const start = initialSignInState(false);
    expect(signInFlowPayload(start, 'ios')).toEqual({ os: 'ios', method: 'none', result: 'cancelled', second: false });
    const refused = apply(start, { type: 'failed', line: 'cantSignIn', result: 'refused', clear: false });
    expect(signInFlowPayload(refused, 'android')).toEqual({ os: 'android', method: 'none', result: 'refused', second: false });
    const done = apply(refused, { type: 'attempt', method: 'email_code' }, { type: 'to_second', second: SECOND }, { type: 'done' });
    expect(signInFlowPayload(done, 'ios')).toEqual({ os: 'ios', method: 'email_code', result: 'ok', second: true });
    expect(signInFlowPayload(apply(done, { type: 'ended' }), 'ios')).toBeNull();
  });

  it('every payload the machine can make passes the Worker’s strict schema (no email, no code, no text)', () => {
    const schema = NATIVE_AUTH_TELEMETRY_PAYLOADS['auth.native.signin'];
    const states = [
      initialSignInState(false),
      apply(initialSignInState(false), { type: 'unsupported' }),
      apply(initialSignInState(false), { type: 'failed', line: 'offline', result: 'offline', clear: false }),
      apply(initialSignInState(false), { type: 'attempt', method: 'password' }, { type: 'done' }),
    ];
    for (const state of states) {
      const payload = signInFlowPayload(state, 'ios');
      expect(schema.safeParse(payload).success, JSON.stringify(payload)).toBe(true);
      expect(JSON.stringify(payload)).not.toMatch(/@|\d{4,}/);
    }
  });
});

describe('ports are only called as the step asks', () => {
  it('a code step never calls create again, and setActive is called once', async () => {
    const setActive = vi.fn(async () => undefined);
    const port = fakePort({ setActive });
    await submitCode(port, '1');
    expect(port.calls.filter((c) => c.startsWith('create'))).toEqual([]);
    expect(setActive).toHaveBeenCalledTimes(1);
  });
});
