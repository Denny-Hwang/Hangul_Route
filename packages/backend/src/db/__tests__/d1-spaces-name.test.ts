import type { Space } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db } from '../d1';
import { MemoryDb } from '../memory';
import type { Db } from '../types';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS section 5.2: the name is written at insert and by `renameSpace` only, so a writer
 * holding a copy read before a rename can never put the old name back. Both backends.
 */
const T = '2026-10-20T00:00:00.000Z';
const space = (over: Partial<Space> = {}): Space => ({
  id: 'space:cls',
  kind: 'class',
  name: 'Room 4',
  parentSpaceId: null,
  ownerAccountId: 'teacher',
  joinCode: null,
  joinCodeExpiresAt: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: T,
  ...over,
});

function nameContract(name: string, make: () => Db): void {
  describe(`space names · ${name}`, () => {
    let db: Db;
    beforeEach(async () => {
      db = make();
      await db.reset();
      await db.putAccount({ id: 'teacher', email: null, displayName: null, consent: null, createdAt: T });
      await db.putSpace(space());
    });

    it('read, rename, then putSpace with the stale copy: the stored name is the new one, the other columns are written', async () => {
      const stale = await db.getSpace('space:cls');
      expect(await db.renameSpace('space:cls', 'Room 4B')).toBe(true);
      await db.putSpace({ ...(stale as Space), settings: { consentMode: 'parent', anonymizeRoster: true }, joinCode: 'ABCDEF', joinCodeExpiresAt: T });
      expect(await db.getSpace('space:cls')).toEqual(space({ name: 'Room 4B', settings: { consentMode: 'parent', anonymizeRoster: true }, joinCode: 'ABCDEF', joinCodeExpiresAt: T }));
    });

    it('the same through an archive and an unarchive of a stale copy', async () => {
      const stale = (await db.getSpace('space:cls')) as Space;
      await db.renameSpace('space:cls', 'Room 4C');
      await db.putSpace({ ...stale, archivedAt: T });
      await db.putSpace({ ...stale, archivedAt: null });
      expect((await db.getSpace('space:cls'))?.name).toBe('Room 4C');
    });

    it('an insert still writes the name; a rename of an archived or unknown space writes nothing', async () => {
      await db.putSpace(space({ id: 'space:new', name: 'Fresh' }));
      expect((await db.getSpace('space:new'))?.name).toBe('Fresh');
      await db.putSpace(space({ id: 'space:old', name: 'Old', archivedAt: T }));
      expect(await db.renameSpace('space:old', 'New')).toBe(false);
      expect((await db.getSpace('space:old'))?.name).toBe('Old');
      expect(await db.renameSpace('space:nope', 'New')).toBe(false);
    });
  });
}

nameContract('memory', () => new MemoryDb());
nameContract('D1 (SQLite)', () => new D1Db(openSqliteD1()));
