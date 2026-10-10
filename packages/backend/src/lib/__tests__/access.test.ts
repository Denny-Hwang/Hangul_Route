import { describe, expect, it } from 'vitest';
import { MemoryDb } from '../../db/memory';
import type { Account } from '../../store';
import { learnerContexts, saveAccount } from '../access';

/** MemoryDb with the D1 `accounts.email UNIQUE` constraint. */
class UniqueEmailDb extends MemoryDb {
  private emails = new Map<string, string>();
  override async putAccount(account: Account): Promise<void> {
    const holder = account.email ? this.emails.get(account.email) : undefined;
    if (holder && holder !== account.id) throw new Error('D1_ERROR: UNIQUE constraint failed: accounts.email');
    if (account.email) this.emails.set(account.email, account.id);
    await super.putAccount(account);
  }
}

const account = (id: string, email: string | null): Account => ({ id, email, displayName: 'Kim', consent: null, createdAt: '2026-10-09T00:00:00.000Z' });

describe('saveAccount', () => {
  it('keeps the email when nobody else holds it', async () => {
    const db = new UniqueEmailDb();
    await saveAccount(db, account('user_dev', 'kim@example.com'));
    expect((await db.getAccount('user_dev'))?.email).toBe('kim@example.com');
  });

  it('saves a new Clerk id for an email already taken, without the email', async () => {
    const db = new UniqueEmailDb();
    await saveAccount(db, account('user_dev', 'kim@example.com'));
    await saveAccount(db, account('user_prod', 'kim@example.com'));
    expect(await db.getAccount('user_prod')).toMatchObject({ id: 'user_prod', email: null, displayName: 'Kim' });
    expect((await db.getAccount('user_dev'))?.email).toBe('kim@example.com');
  });

  it('still surfaces failures that are not about the email', async () => {
    const db = new MemoryDb();
    db.putAccount = async () => {
      throw new Error('D1 down');
    };
    await expect(saveAccount(db, account('user_x', null))).rejects.toThrow('D1 down');
  });
});

describe('learnerContexts (SEC-4)', () => {
  it('leaves out archived spaces, so last year\'s class grants nothing over the learner', async () => {
    const db = new MemoryDb();
    const T = '2026-10-09T00:00:00.000Z';
    const base = { kind: 'class' as const, parentSpaceId: null, ownerAccountId: 't', joinCode: null, joinCodeExpiresAt: null, settings: { consentMode: 'parent' as const, anonymizeRoster: false }, createdAt: T };
    await db.putSpace({ ...base, id: 'space:now', name: 'Now', archivedAt: null });
    await db.putSpace({ ...base, id: 'space:old', name: 'Old', archivedAt: T });
    for (const spaceId of ['space:now', 'space:old', 'space:gone']) await db.addMembership({ spaceId, memberKind: 'learner', memberId: 'profile:a', role: 'student', joinedAt: T });
    expect((await learnerContexts(db, 'profile:a')).map((c) => c.space.id)).toEqual(['space:now']);
  });
});
