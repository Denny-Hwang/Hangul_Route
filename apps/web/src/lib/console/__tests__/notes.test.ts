import { CATALOG, NOTE_PRESET_AUDIENCE, NOTE_PRESET_IDS, NoteSendSchema } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it, vi } from 'vitest';
import {
  NOTE_PAIR_DAILY_LIMIT,
  closedQuestIds,
  composerCheck,
  counterAnnouncement,
  createNotesApi,
  familyActionProblem,
  groupByDay,
  notePreview,
  presetGroups,
  questClosedLine,
  receivedRowView,
  recipientRows,
  sendProblem,
  sendResultLines,
  sentRowView,
  statusText,
  textCounter,
  textProblem,
  withdrawProblem,
  type ComposerInput,
  type NoteRecipient,
  type OversightNote,
  type SentNoteRow,
} from '../notes';

const en = getMessages('en').console.notes;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const QUEST = CATALOG.quests[0]!;

/** F-FEEDBACK-001 FB-10 (section 13 row `apps/web/src/lib/console/__tests__/notes.test.ts`). */
describe('createNotesApi (sections 7.2, 7.8)', () => {
  function api(...answers: Array<Response | Error>) {
    const fetchImpl = vi.fn<typeof fetch>();
    for (const a of answers) {
      if (a instanceof Error) fetchImpl.mockRejectedValueOnce(a);
      else fetchImpl.mockResolvedValueOnce(a);
    }
    return { fetchImpl, client: createNotesApi({ endpoint: 'https://api.example.com', token: 'tok', fetchImpl }) };
  }
  const call = (fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>, i = 0) => {
    const [url, init] = fetchImpl.mock.calls[i] as [string, RequestInit];
    return { url, method: init.method, body: init.body === undefined ? undefined : JSON.parse(String(init.body)), headers: init.headers as Record<string, string> };
  };
  const base = 'https://api.example.com/api/spaces';

  it('reads the recipients with the session bearer', async () => {
    const learners: NoteRecipient[] = [{ id: 'profile:a', displayName: 'Mina', notes: 'all', today: 0 }];
    const { fetchImpl, client } = api(json(200, { data: { learners } }));
    expect(await client.recipients('space:c')).toEqual({ ok: true, data: learners });
    expect(call(fetchImpl)).toMatchObject({ url: `${base}/space%3Ac/notes/recipients`, method: 'GET', headers: { Authorization: 'Bearer tok' } });
  });

  it('sends a note and returns the batch result; a refusal carries status, code and details', async () => {
    const result = { batchId: 'batch:1', sent: 17, skipped: [{ learnerId: 'profile:b', reason: 'notes_off' }], presetsOnly: ['profile:c'] };
    const { fetchImpl, client } = api(
      json(201, { data: result }),
      json(422, { error: { code: 'note_text', details: { problem: 'link', word: 'kim.com' } } }),
      json(404, { error: { code: 'not_found' } }),
      new Error('offline'),
    );
    const body = { to: { kind: 'everyone' as const }, presetId: 'effort_proud' as const };
    expect(await client.send('space:c', body)).toEqual({ ok: true, data: result });
    expect(call(fetchImpl)).toMatchObject({ url: `${base}/space%3Ac/notes`, method: 'POST', body });
    expect(await client.send('space:c', body)).toEqual({ ok: false, failure: { status: 422, code: 'note_text', details: { problem: 'link', word: 'kim.com' } } });
    expect(await client.send('space:c', body)).toEqual({ ok: false, failure: { status: 404, code: 'not_found', details: null } });
    expect(await client.send('space:c', body)).toEqual({ ok: false, failure: { status: -1, code: null, details: null } });
  });

  it('lists sent notes with paging and the learner filter, and takes one back (or its batch)', async () => {
    const { fetchImpl, client } = api(json(200, { data: { rows: [], next: null } }), json(200, { data: { rows: [], next: 'x' } }), json(200, { data: { withdrawn: 18 } }), json(200, { data: { withdrawn: 1 } }));
    expect(await client.sent('space:c')).toEqual({ ok: true, data: { rows: [], next: null } });
    expect(call(fetchImpl).url).toBe(`${base}/space%3Ac/notes`);
    await client.sent('space:c', { before: '2026-10-10T00:00:00.000Z', learner: 'profile:a' });
    expect(call(fetchImpl, 1).url).toBe(`${base}/space%3Ac/notes?before=2026-10-10T00%3A00%3A00.000Z&learner=profile%3Aa`);
    expect(await client.withdraw('space:c', 'note:aaaaaaaa', true)).toEqual({ ok: true, data: { withdrawn: 18 } });
    expect(call(fetchImpl, 2)).toMatchObject({ url: `${base}/space%3Ac/notes/note%3Aaaaaaaaa/withdraw`, method: 'POST', body: { batch: true } });
    await client.withdraw('space:c', 'note:aaaaaaaa');
    expect(call(fetchImpl, 3).body).toEqual({});
  });

  it('reaches every family oversight route of one learner', async () => {
    const { fetchImpl, client } = api(
      json(200, { data: { rows: [], next: null } }),
      json(200, { data: {} }),
      json(201, { data: {} }),
      json(201, { data: {} }),
      json(200, { data: {} }),
      json(200, { data: { blocks: [] } }),
      json(200, { data: { classes: 'all', acknowledged: false, updatedBy: null } }),
      json(200, { data: { classes: 'off', acknowledged: true, updatedBy: 'Mina Park' } }),
      json(200, { data: { senders: [] } }),
      json(200, { data: {} }),
    );
    const learner = `${base}/space%3Af/learners/profile%3Aa`;
    await client.oversight('space:f', 'profile:a', '2026-10-01T00:00:00.000Z');
    expect(call(fetchImpl, 0).url).toBe(`${learner}/notes?before=2026-10-01T00%3A00%3A00.000Z`);
    await client.hide('space:f', 'profile:a', 'note:aaaaaaaa');
    expect(call(fetchImpl, 1)).toMatchObject({ url: `${learner}/notes/note%3Aaaaaaaaa/hide`, method: 'POST' });
    await client.report('space:f', 'profile:a', 'note:aaaaaaaa', { reason: 'unkind' });
    expect(call(fetchImpl, 2)).toMatchObject({ url: `${learner}/notes/note%3Aaaaaaaaa/report`, method: 'POST', body: { reason: 'unkind' } });
    await client.block('space:f', 'profile:a', 'note:aaaaaaaa');
    expect(call(fetchImpl, 3)).toMatchObject({ url: `${learner}/blocks`, method: 'POST', body: { noteId: 'note:aaaaaaaa' } });
    await client.unblock('space:f', 'profile:a', 'ref:1');
    expect(call(fetchImpl, 4)).toMatchObject({ url: `${learner}/blocks/ref%3A1`, method: 'DELETE' });
    expect(await client.blocks('space:f', 'profile:a')).toEqual({ ok: true, data: [] });
    expect(await client.prefs('space:f', 'profile:a')).toEqual({ ok: true, data: { classes: 'all', acknowledged: false, updatedBy: null } });
    expect(call(fetchImpl, 6).url).toBe(`${learner}/note-prefs`);
    await client.putPrefs('space:f', 'profile:a', { classes: 'off', acknowledge: true });
    expect(call(fetchImpl, 7)).toMatchObject({ url: `${learner}/note-prefs`, method: 'PUT', body: { classes: 'off', acknowledge: true } });
    expect(await client.noteSenders('space:f')).toEqual({ ok: true, data: [] });
    expect(call(fetchImpl, 8).url).toBe(`${base}/space%3Af/note-senders`);
    await client.setNoteSender('space:f', 'acct:2', true);
    expect(call(fetchImpl, 9)).toMatchObject({ url: `${base}/space%3Af/note-senders/acct%3A2`, method: 'PUT', body: { canSend: true } });
  });

  it('a session that ended sends nothing; a token provider is asked per request', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const ended = createNotesApi({ endpoint: 'https://api.example.com', token: async () => null, fetchImpl });
    expect(await ended.recipients('space:c')).toEqual({ ok: false, failure: { status: 401, code: null, details: null } });
    expect(fetchImpl).not.toHaveBeenCalled();
    const failing = createNotesApi({ endpoint: 'https://api.example.com', token: () => Promise.reject(new Error('clerk')), fetchImpl });
    expect((await failing.recipients('space:c')).ok).toBe(false);
  });

  it('uses the global fetch when none is given, and reads a body that is not an object as no details', async () => {
    const globalFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('null', { status: 500 }));
    vi.stubGlobal('fetch', globalFetch);
    try {
      const client = createNotesApi({ endpoint: 'https://api.example.com', token: 'tok' });
      expect(await client.recipients('space:c')).toEqual({ ok: false, failure: { status: 500, code: null, details: null } });
      expect(globalFetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('a 200 without data is a failure, never an empty success', async () => {
    const { client } = api(json(200, {}), new Response('not json', { status: 500 }));
    expect(await client.recipients('space:c')).toEqual({ ok: false, failure: { status: 200, code: null, details: null } });
    expect(await client.recipients('space:c')).toEqual({ ok: false, failure: { status: 500, code: null, details: null } });
  });
});

describe('presetGroups (section 6.3)', () => {
  it('lists the four groups in catalogue order, each preset once, in the console locale', () => {
    const groups = presetGroups('teacher', 'en');
    expect(groups.map((g) => g.title)).toEqual(['Effort', 'Progress', 'Next step', 'Warm']);
    const ids = groups.flatMap((g) => g.presets.map((p) => p.id));
    expect(ids).toEqual(NOTE_PRESET_IDS.filter((id) => NOTE_PRESET_AUDIENCE[id] !== 'family'));
    expect(groups[0]?.presets[0]).toEqual({ id: 'effort_keep_trying', text: 'You keep trying. That is how we learn.', needsQuest: false });
    expect(groups[2]?.presets.find((p) => p.id === 'next_try_this')?.needsQuest).toBe(true);
  });

  it('offers a teacher "See you in class soon" and a family "We love learning Korean with you", never the other', () => {
    const teacher = presetGroups('teacher', 'en').flatMap((g) => g.presets.map((p) => p.id));
    const family = presetGroups('family', 'en').flatMap((g) => g.presets.map((p) => p.id));
    expect(teacher).toContain('warm_see_you_in_class');
    expect(teacher).not.toContain('warm_learning_together');
    expect(family).toContain('warm_learning_together');
    expect(family).not.toContain('warm_see_you_in_class');
  });
});

describe('composer text (section 6.4, mirrors checkNoteText)', () => {
  it('an empty box is no text; words pass normalised', () => {
    expect(textProblem('', 'en')).toEqual({ ok: true, text: null });
    expect(textProblem('  Great   work today ', 'en')).toEqual({ ok: true, text: 'Great work today' });
  });

  it('gives a friendly line per problem; link and tone quote the token as typed', () => {
    expect(textProblem('See kim.com', 'en')).toEqual({ ok: false, problem: 'link', message: 'Links can\'t be sent in a note ("kim.com").' });
    expect(textProblem('mail me a@b', 'en')).toMatchObject({ ok: false, problem: 'contact', message: en.composer.problems.contact });
    expect(textProblem('Great \u{1F600}', 'en')).toMatchObject({ ok: false, problem: 'emoji', message: 'Please use words instead of emoji.' });
    expect(textProblem('You are lazy', 'en')).toMatchObject({ ok: false, problem: 'tone', message: 'Please choose a kinder word than "lazy".' });
    expect(textProblem('one\ntwo', 'en')).toMatchObject({ ok: false, problem: 'line_break', message: 'Please keep the note to one line.' });
    expect(textProblem('a'.repeat(121), 'en')).toMatchObject({ ok: false, problem: 'too_long', message: 'Please keep it to 120 characters.' });
    expect(textProblem('   ', 'en')).toMatchObject({ ok: false, problem: 'empty', message: en.composer.problems.empty });
    expect(textProblem('a\u202Eb', 'en')).toMatchObject({ ok: false, problem: 'invalid', message: en.composer.problems.invalid });
  });

  it('a tone or link problem without a token still reads as a sentence', () => {
    expect(textProblem('x', 'en', () => ({ ok: false, problem: 'tone' }))).toMatchObject({ message: 'Please choose a kinder word than "".' });
    expect(textProblem('x', 'en', () => ({ ok: false, problem: 'link' }))).toMatchObject({ message: 'Links can\'t be sent in a note ("").' });
  });

  it('counts code points of the normalised text, so Hangul counts one each', () => {
    expect(textCounter('한글 ok', 'en')).toEqual({ count: 5, line: '5 of 120' });
    expect(textCounter('  a  ', 'en')).toEqual({ count: 1, line: '1 of 120' });
  });

  it('announces the counter politely when it reaches 100 and 120, once each', () => {
    expect(counterAnnouncement(99, 100, 'en')).toBe('100 of 120 characters used');
    expect(counterAnnouncement(98, 103, 'en')).toBe('103 of 120 characters used');
    expect(counterAnnouncement(100, 101, 'en')).toBeNull();
    expect(counterAnnouncement(119, 120, 'en')).toBe('120 of 120 characters used');
    expect(counterAnnouncement(120, 121, 'en')).toBeNull();
    expect(counterAnnouncement(101, 99, 'en')).toBeNull();
  });
});

describe('recipientRows (section 6.1 item 4, section 7.3)', () => {
  const learners: NoteRecipient[] = [
    { id: 'profile:a', displayName: 'Mina', notes: 'all', today: 0 },
    { id: 'profile:b', displayName: 'Jin', notes: 'off', today: 0 },
    { id: 'profile:c', displayName: 'S.K.', notes: 'presets', today: 1 },
    { id: 'profile:d', displayName: 'Ana', notes: 'all', today: NOTE_PAIR_DAILY_LIMIT },
  ];

  it('marks notes off (mode or block, same words), encouragement only, and today\'s limit', () => {
    expect(recipientRows(learners, 'class', 'en')).toEqual([
      { id: 'profile:a', name: 'Mina', selectable: true, line: null, presetsOnly: false },
      { id: 'profile:b', name: 'Jin', selectable: false, line: 'Notes are off for this student', presetsOnly: false },
      { id: 'profile:c', name: 'S.K.', selectable: true, line: 'Encouragement only', presetsOnly: true },
      { id: 'profile:d', name: 'Ana', selectable: false, line: '3 notes today. You can send more tomorrow.', presetsOnly: false },
    ]);
    expect(recipientRows(learners, 'family', 'en')[1]?.line).toBe('Notes are off for this learner');
  });

  it('keeps the API order (never a ranking) and the names as the roster setting gives them', () => {
    expect(recipientRows([...learners].reverse(), 'class', 'en').map((r) => r.id)).toEqual(['profile:d', 'profile:c', 'profile:b', 'profile:a']);
  });
});

describe('composerCheck (sections 6.2, 7.1)', () => {
  const input = (over: Partial<ComposerInput> = {}): ComposerInput => ({
    spaceKind: 'class',
    to: { kind: 'learners', ids: ['profile:a'] },
    presetId: 'effort_proud',
    text: '',
    questId: null,
    label: null,
    ...over,
  });

  it('builds a strict send body: text with the console locale, a quest as a suggestion', () => {
    const check = composerCheck(input({ text: ' Great  work ', questId: QUEST.id }), 'es');
    expect(check).toMatchObject({ canSend: true, questNeeded: false, textProblem: null });
    expect(check.body).toEqual({ to: { kind: 'learners', ids: ['profile:a'] }, presetId: 'effort_proud', text: 'Great work', textLocale: 'es', suggest: { kind: 'quest', id: QUEST.id } });
    expect(NoteSendSchema.safeParse(check.body).success).toBe(true);
  });

  it('a class never sends a label; a family signs "Your family" unless a label is picked', () => {
    expect(composerCheck(input({ label: 'grandma' }), 'en').body).not.toHaveProperty('label');
    expect(composerCheck(input({ spaceKind: 'family' }), 'en').body).toMatchObject({ label: 'family' });
    expect(composerCheck(input({ spaceKind: 'family', label: 'grandma', to: { kind: 'everyone' } }), 'en').body).toEqual({ to: { kind: 'everyone' }, presetId: 'effort_proud', label: 'grandma' });
  });

  it('"Try this quest next" needs a quest before Send', () => {
    const check = composerCheck(input({ presetId: 'next_try_this' }), 'en');
    expect(check).toMatchObject({ canSend: false, questNeeded: true, body: null });
    expect(composerCheck(input({ presetId: 'next_try_this', questId: QUEST.id }), 'en')).toMatchObject({ canSend: true, questNeeded: false });
  });

  it('cannot send without a preset, without a learner, with a text problem or with an unknown quest', () => {
    expect(composerCheck(input({ presetId: null }), 'en').canSend).toBe(false);
    expect(composerCheck(input({ to: { kind: 'learners', ids: [] } }), 'en').canSend).toBe(false);
    const bad = composerCheck(input({ text: 'see www.kim' }), 'en');
    expect(bad).toMatchObject({ canSend: false, textProblem: 'Links can\'t be sent in a note ("www.kim").', body: null });
    expect(composerCheck(input({ questId: 'quest:nowhere' }), 'en')).toMatchObject({ canSend: false, body: null });
    // The strict schema is the last word: an id that is not a learner id never leaves, and the adult is told why.
    expect(composerCheck(input({ to: { kind: 'learners', ids: ['Mina'] } }), 'en')).toMatchObject({
      canSend: false,
      body: null,
      textProblem: null,
      recipientsProblem: 'Choose up to 300 learners.',
    });
  });

  it('sends a learner picked twice once, and says why Send is off for more than 300 learners', () => {
    const twice = composerCheck(input({ to: { kind: 'learners', ids: ['profile:a', 'profile:b', 'profile:a'] } }), 'en');
    expect(twice).toMatchObject({ canSend: true, recipientsProblem: null });
    expect(twice.body?.to).toEqual({ kind: 'learners', ids: ['profile:a', 'profile:b'] });
    const many = Array.from({ length: 301 }, (_, i) => `profile:p${i}`);
    expect(composerCheck(input({ to: { kind: 'learners', ids: many } }), 'en')).toMatchObject({
      canSend: false,
      body: null,
      recipientsProblem: en.composer.recipientsProblem,
    });
    expect(composerCheck(input({ to: { kind: 'learners', ids: many.slice(0, 300) } }), 'en')).toMatchObject({ canSend: true, recipientsProblem: null });
    // Other problems keep their own line, never the recipients one.
    expect(composerCheck(input({ presetId: null }), 'en').recipientsProblem).toBeNull();
  });

  it('never sends a preset the sender\'s side may not pick', () => {
    expect(composerCheck(input({ presetId: 'warm_learning_together' }), 'en').canSend).toBe(false);
    expect(composerCheck(input({ spaceKind: 'family', presetId: 'warm_see_you_in_class' }), 'en').canSend).toBe(false);
  });
});

describe('notePreview (wireframe console/note-composer.md)', () => {
  it('shows what the learner reads: preset, words, the sender label and the quest', () => {
    expect(notePreview({ spaceKind: 'class', spaceName: 'Sunday Class A', presetId: 'progress_reading', text: 'Loved it', questId: QUEST.id, label: null }, 'en')).toEqual({
      preset: 'Your reading is getting stronger.',
      text: 'Loved it',
      from: 'From Your teacher · Sunday Class A',
      quest: `Try this quest: ${QUEST.title}`,
    });
    expect(notePreview({ spaceKind: 'family', spaceName: 'Kim family', presetId: null, text: '', questId: 'quest:nowhere', label: 'grandma' }, 'en')).toEqual({
      preset: null,
      text: null,
      from: 'From Grandma',
      quest: null,
    });
    expect(notePreview({ spaceKind: 'family', spaceName: 'Kim family', presetId: 'effort_proud', text: '  ', questId: null, label: null }, 'en').from).toBe('From Your family');
  });
});

describe('sendResultLines (wireframe B: counts only, never names)', () => {
  it('words what happened', () => {
    const result = { batchId: 'b', sent: 17, skipped: [{ learnerId: 'profile:b', reason: 'notes_off' as const }, { learnerId: 'profile:d', reason: 'limit' as const }], presetsOnly: ['profile:c'] };
    expect(sendResultLines(result, 'class', 'en')).toEqual(['Sent to 17 students.', '1 student has notes off.', '1 student gets the encouragement only.', "1 student is at today's limit."]);
    expect(sendResultLines({ batchId: 'b', sent: 2, skipped: [], presetsOnly: [] }, 'family', 'en')).toEqual(['Sent to 2 learners.']);
    expect(sendResultLines({ batchId: 'b', sent: 0, skipped: [{ learnerId: 'profile:b', reason: 'notes_off' }], presetsOnly: [] }, 'family', 'en')).toEqual([
      "Nothing was sent. Notes are off or today's limit is reached for these learners.",
    ]);
    expect(JSON.stringify(sendResultLines(result, 'class', 'en'))).not.toContain('profile:');
  });
});

describe('server problems (section 7.2 errors, wireframe states)', () => {
  const f = (status: number, code: string | null = null, details: Record<string, unknown> | null = null) => ({ status, code, details });

  it('words every send refusal', () => {
    expect(sendProblem(f(404, 'not_found'), 'class', 'en')).toBe('Sending notes is not open yet.');
    expect(sendProblem(f(403, 'sending_paused'), 'class', 'en')).toBe('Sending notes is paused for this account. Write to hello@hangulroute.com.');
    expect(sendProblem(f(403, 'not_allowed'), 'family', 'en')).toBe('The family owner can let you send notes.');
    expect(sendProblem(f(403, 'not_allowed'), 'class', 'en')).toBe('Only the teachers of this class can send notes.');
    expect(sendProblem(f(409, 'space_archived'), 'class', 'en')).toBe('This class is archived.');
    expect(sendProblem(f(422, 'note_text', { problem: 'tone', word: 'lazy' }), 'class', 'en')).toBe('Please choose a kinder word than "lazy".');
    expect(sendProblem(f(422, 'note_text', { problem: 'contact' }), 'class', 'en')).toBe(en.composer.problems.contact);
    expect(sendProblem(f(422, 'note_text', { problem: 'something_new' }), 'class', 'en')).toBe(en.composer.errors.generic);
    expect(sendProblem(f(422, 'bad_preset'), 'class', 'en')).toBe('Pick a quest for this encouragement.');
    expect(sendProblem(f(422, 'bad_suggest'), 'class', 'en')).toBe('That quest cannot be suggested. Pick another one.');
    expect(sendProblem(f(429, 'too_many', { scope: 'account', retryAfter: 60 }), 'class', 'en')).toBe('You have sent many notes today. You can send more tomorrow.');
    expect(sendProblem(f(429, 'too_many', { scope: 'learner', retryAfter: 3600 }), 'class', 'en')).toBe(en.composer.errors.tooMany);
    expect(sendProblem(f(422, 'not_in_space'), 'class', 'en')).toBe('Someone on this list is no longer in this space. Refresh and try again.');
    expect(sendProblem(f(-1), 'class', 'en')).toBe('Could not send. Check your connection and try again.');
    expect(sendProblem(f(500), 'class', 'en')).toBe('Something went wrong. Please try again.');
  });

  it('a short limiter 429 (several sends in a minute) asks for a minute, never "tomorrow"', () => {
    expect(sendProblem(f(429, 'too_many_attempts', { retryAfterSeconds: 30 }), 'class', 'en')).toBe('Please wait a minute and try again.');
    expect(sendProblem(f(429), 'family', 'en')).toBe(en.composer.errors.wait);
    expect(sendProblem(f(429, 'too_many'), 'family', 'en')).toBe(en.composer.errors.wait);
  });

  it('words a take-back refusal and a family action refusal', () => {
    expect(withdrawProblem(f(409, 'note_reported'), 'en')).toBe('This note can no longer be changed.');
    expect(withdrawProblem(f(500), 'en')).toBe('That did not save. Try again.');
    expect(familyActionProblem(f(429, 'too_many'), 'report', 'en')).toBe('Too many reports today. Write to hello@hangulroute.com if you need help now.');
    expect(familyActionProblem(f(422, 'own_note'), 'report', 'en')).toBe('This is your own note. You can take it back instead.');
    expect(familyActionProblem(f(-1), 'hide', 'en')).toBe('That did not save. Try again.');
  });

  it('only a refused report reads as the daily report limit; any other 429 asks for a minute', () => {
    for (const action of ['hide', 'block', 'unblock', 'prefs', 'senders'] as const) {
      expect(familyActionProblem(f(429, 'too_many'), action, 'en'), action).toBe('Please wait a minute and try again.');
    }
    expect(familyActionProblem(f(429, 'too_many_attempts', { retryAfterSeconds: 20 }), 'report', 'en')).toBe(en.family.wait);
  });
});

describe('statusText (section 9, OD-8)', () => {
  it('uses the neutral words, and never "Opened" for a class sender', () => {
    expect(statusText('sent', 'class', 'en')).toBe('Sent');
    expect(statusText('opened', 'class', 'en')).toBe('Sent');
    expect(statusText('opened', 'family', 'en')).toBe('Opened');
    expect(statusText('not_shown', 'class', 'en')).toBe('Not shown');
    expect(statusText('withdrawn', 'family', 'en')).toBe('Taken back');
  });
});

describe('sentRowView (wireframe console/notes-sent.md)', () => {
  const learnerRow = (over: Partial<Extract<SentNoteRow, { to: 'learner' }>> = {}): SentNoteRow => ({
    id: 'note:aaaaaaaa',
    batchId: 'batch:1',
    to: 'learner',
    learnerId: 'profile:a',
    displayName: 'Mina',
    presetId: 'progress_reading',
    text: 'Loved it',
    suggest: null,
    label: null,
    createdAt: '2026-10-12T09:00:00.000Z',
    status: 'sent',
    reaction: 'thanks',
    mine: true,
    ...over,
  });

  it('one learner: to line, preset, words, status with the answer, Take back for the sender', () => {
    expect(sentRowView(learnerRow(), 'class', 'en')).toEqual({
      key: 'note:aaaaaaaa',
      noteId: 'note:aaaaaaaa',
      batch: false,
      to: 'To Mina',
      preset: 'Your reading is getting stronger.',
      text: 'Loved it',
      quest: null,
      status: 'Sent',
      reaction: 'Thank you',
      signed: null,
      byOther: null,
      canTakeBack: true,
    });
  });

  it('a batch to everyone is one line with its size and no per-learner answers', () => {
    const batch: SentNoteRow = { id: 'note:bbbbbbbb', batchId: 'batch:2', to: 'everyone', size: 18, presetId: 'effort_keep_trying', text: null, suggest: { kind: 'quest', id: QUEST.id }, label: null, createdAt: 't', status: 'sent', mine: true };
    expect(sentRowView(batch, 'class', 'en')).toMatchObject({ key: 'batch:2', batch: true, to: 'To everyone (18 students)', reaction: null, quest: QUEST.title, canTakeBack: true });
  });

  it('a batch row without a note id cannot be taken back from here (never posts to /notes/undefined)', () => {
    const batch: SentNoteRow = { batchId: 'batch:3', to: 'everyone', size: 4, presetId: 'effort_keep_trying', text: null, suggest: null, label: null, createdAt: 't', status: 'sent', mine: true };
    expect(sentRowView(batch, 'class', 'en')).toMatchObject({ key: 'batch:3', noteId: null, batch: true, canTakeBack: false });
    expect(sentRowView({ ...batch, id: '' }, 'class', 'en')).toMatchObject({ noteId: null, canTakeBack: false });
  });

  it('a note of another grown-up has no Take back; not shown and taken back cannot be taken back', () => {
    expect(sentRowView(learnerRow({ mine: false }), 'class', 'en')).toMatchObject({ byOther: 'Sent by another grown-up of this space', canTakeBack: false });
    expect(sentRowView(learnerRow({ status: 'not_shown', reaction: null }), 'class', 'en')).toMatchObject({ status: 'Not shown', canTakeBack: false, reaction: null });
    expect(sentRowView(learnerRow({ status: 'withdrawn' }), 'class', 'en')).toMatchObject({ status: 'Taken back', canTakeBack: false });
  });

  it('a family row says how it was signed and may read "Opened"; a class never does', () => {
    expect(sentRowView(learnerRow({ status: 'opened', label: 'grandma' }), 'family', 'en')).toMatchObject({ status: 'Opened', signed: 'Signed Grandma' });
    expect(sentRowView(learnerRow({ status: 'opened' }), 'class', 'en').status).toBe('Sent');
    expect(sentRowView(learnerRow({ presetId: 'unknown_new', reaction: 'wave' }), 'class', 'en')).toMatchObject({ preset: 'A note for you.', reaction: null });
  });
});

describe('receivedRowView (wireframe console/family-notes.md A, section 8.2)', () => {
  const row = (over: Partial<OversightNote> = {}): OversightNote => ({
    id: 'note:aaaaaaaa',
    spaceId: 'space:c',
    spaceKind: 'class',
    spaceName: 'Sunday Class A',
    from: { role: 'teacher', label: null },
    senderName: null,
    mine: false,
    presetId: 'progress_reading',
    text: 'Loved it',
    suggest: null,
    createdAt: '2026-10-12T09:00:00.000Z',
    status: 'opened',
    reaction: 'thanks',
    hiddenBy: null,
    reportedBy: null,
    ...over,
  });

  it('a class note: from the class (teacher), never an account; status and answer; every action', () => {
    expect(receivedRowView(row(), 'en')).toEqual({
      id: 'note:aaaaaaaa',
      from: 'From Sunday Class A (teacher)',
      sentBy: null,
      preset: 'Your reading is getting stronger.',
      text: 'Loved it',
      quest: null,
      status: 'Opened',
      reaction: 'Thank you',
      canHide: true,
      canReport: true,
      canBlock: true,
    });
  });

  it('a family note names the signing label and the sending account, or "You sent this"', () => {
    const family = row({ spaceKind: 'family', spaceName: 'Kim family', from: { role: 'family', label: 'grandma' }, senderName: 'Sun Park', status: 'live', reaction: null });
    expect(receivedRowView(family, 'en')).toMatchObject({ from: 'From home · signed Grandma', sentBy: 'Sent by Sun Park', status: 'Sent' });
    expect(receivedRowView({ ...family, mine: true }, 'en')).toMatchObject({ sentBy: 'You sent this', canReport: false, canBlock: false, canHide: true });
    expect(receivedRowView({ ...family, from: { role: 'family', label: null } }, 'en').from).toBe('From home · signed Your family');
    expect(receivedRowView({ ...family, senderName: null }, 'en').sentBy).toBeNull();
    expect(receivedRowView({ ...family, suggest: { kind: 'quest', id: QUEST.id } }, 'en').quest).toBe(QUEST.title);
  });

  it('a row from a newer or broken Worker never renders "undefined" or names an account', () => {
    const family = row({ spaceKind: 'family', spaceName: 'Kim family', from: { role: 'family', label: 'grandma' }, senderName: 'Sun Park' });
    // An unknown label id signs "Your family".
    const unknown = { ...family, from: { role: 'family', label: 'cousin' } } as unknown as OversightNote;
    expect(receivedRowView(unknown, 'en').from).toBe('From home · signed Your family');
    // A missing sender reads as a class note, without the account name.
    const noFrom = { ...family, from: undefined } as unknown as OversightNote;
    expect(receivedRowView(noFrom, 'en')).toMatchObject({ from: 'From Kim family (teacher)', sentBy: null });
    expect(JSON.stringify(receivedRowView(unknown, 'en'))).not.toContain('undefined');
  });

  it('words who acted, and leaves only the actions that still apply', () => {
    expect(receivedRowView(row({ status: 'hidden', hiddenBy: 'Sun Park' }), 'en')).toMatchObject({ status: 'Hidden by Sun Park', canHide: false, canReport: true, canBlock: true });
    expect(receivedRowView(row({ status: 'hidden', hiddenBy: 'device' }), 'en').status).toBe('Hidden on a device');
    expect(receivedRowView(row({ status: 'reported', reportedBy: 'Sun Park' }), 'en')).toMatchObject({ status: 'Reported by Sun Park · Our team is looking at it', canReport: false, canHide: false, canBlock: true });
    expect(receivedRowView(row({ status: 'reported', reportedBy: 'device' }), 'en').status).toBe('Reported on a device');
    expect(receivedRowView(row({ status: 'reported', reportedBy: null }), 'en').status).toBe('Reported on a device');
    expect(receivedRowView(row({ status: 'withdrawn' }), 'en')).toMatchObject({ status: 'Taken back by the sender', canHide: false, canReport: true });
    expect(receivedRowView(row({ status: 'not_shown' }), 'en')).toMatchObject({ status: 'Not shown', canHide: false });
    expect(receivedRowView(row({ status: 'hidden', hiddenBy: null }), 'en').status).toBe('Hidden on a device');
  });
});

describe('groupByDay (section 9: send time only)', () => {
  // Built from local components, so the days hold in every time zone the suite runs in.
  const at = (day: number, hour: number) => new Date(2026, 9, day, hour).toISOString();
  const now = new Date(2026, 9, 12, 15);
  const rows = [
    { createdAt: at(12, 10), status: 'not_shown', id: 1 },
    { createdAt: at(12, 8), status: 'sent', id: 2 },
    { createdAt: at(11, 8), status: 'opened', id: 3 },
    { createdAt: at(3, 8), status: 'withdrawn', id: 4 },
  ];

  it('groups by day in the order the API gives (never sorted by status)', () => {
    const groups = groupByDay(rows, now, 'en');
    expect(groups.map((g) => g.day)).toEqual(['Today', 'Yesterday', 'Oct 3']);
    expect(groups.flatMap((g) => g.rows.map((r) => r.id))).toEqual([1, 2, 3, 4]);
    expect(groupByDay([], now, 'en')).toEqual([]);
  });

  it('an unreadable date keeps its row in its own group', () => {
    expect(groupByDay([{ createdAt: 'x', id: 9 }], now, 'en')).toEqual([{ day: '', rows: [{ createdAt: 'x', id: 9 }] }]);
  });

  it('reads the day in the viewer\'s time zone, not in UTC', () => {
    const tz = process.env.TZ;
    try {
      // 01:00 UTC on Oct 12 is the evening of Oct 11 in Los Angeles and the morning of Oct 12 in Seoul.
      const sent = [{ createdAt: '2026-10-12T01:00:00.000Z', id: 1 }];
      const later = new Date('2026-10-12T12:00:00.000Z');
      process.env.TZ = 'America/Los_Angeles';
      expect(groupByDay(sent, later, 'en').map((g) => g.day)).toEqual(['Yesterday']);
      process.env.TZ = 'Asia/Seoul';
      expect(groupByDay(sent, later, 'en').map((g) => g.day)).toEqual(['Today']);
    } finally {
      process.env.TZ = tz;
    }
  });
});

/**
 * The quest picker's closed-quest mark (section 6.2, F-ENT-003 E3-1a `freeRouteQuestIds` and E3-9
 * `contentGatingEnabled()`): only with the free-plan switch on and a space this viewer knows no
 * plan covers. The learner's own device stays the authority on what opens.
 */
describe('quest picker marks', () => {
  const freeLesson = CATALOG.quests.find((q) => q.kind === 'lesson' && q.stage === 'stage1')!;
  const laterLesson = CATALOG.quests.find((q) => q.kind === 'lesson' && q.stage !== 'stage1')!;
  const story = CATALOG.quests.find((q) => q.kind === 'story')!;

  it('marks the lessons past the free route, for an uncovered space with the switch on', () => {
    const closed = closedQuestIds({ gating: true, coverage: 'uncovered' });
    expect(closed.has(laterLesson.id)).toBe(true);
    expect(closed.has(freeLesson.id)).toBe(false);
    expect(questClosedLine(laterLesson.id, { gating: true, coverage: 'uncovered' }, 'en')).toBe(
      'Some learners can open this lesson only with the full route.',
    );
    expect(questClosedLine(freeLesson.id, { gating: true, coverage: 'uncovered' }, 'en')).toBeNull();
  });

  it('marks nothing with the switch off, for a covered space, or when the viewer cannot tell', () => {
    for (const opts of [
      { gating: false, coverage: 'uncovered' as const },
      { gating: true, coverage: 'covered' as const },
      { gating: true, coverage: 'unknown' as const },
    ]) {
      expect(closedQuestIds(opts).size, JSON.stringify(opts)).toBe(0);
      expect(questClosedLine(laterLesson.id, opts, 'en')).toBeNull();
    }
  });

  it('never marks a story or a quest this catalogue does not hold', () => {
    const closed = closedQuestIds({ gating: true, coverage: 'uncovered' });
    expect(closed.has(story.id)).toBe(false);
    expect(questClosedLine('quest:nowhere', { gating: true, coverage: 'uncovered' }, 'en')).toBeNull();
  });
});
