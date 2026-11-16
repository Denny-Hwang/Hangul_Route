import { D1Db, fallbackDb, setFallbackDb } from '../../db';
import { openSqliteD1 } from './sqlite';

/**
 * Which backend the route suites run against. Default: in-memory. With
 * HR_TEST_DB=sqlite every request hits the real migrations through the
 * node:sqlite shim (CI runs both).
 */
export const TEST_BACKEND: 'memory' | 'sqlite' = process.env.HR_TEST_DB === 'sqlite' ? 'sqlite' : 'memory';

if (TEST_BACKEND === 'sqlite') setFallbackDb(new D1Db(openSqliteD1()));

/** The backend the app under test uses for requests without an env.DB binding. */
export const testDb = fallbackDb();

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-16: empties the durable counters (`rate_hits`), so a test that makes many
 * claims, lookups or re-link requests starts from a fresh window. `db.reset()` does this too.
 */
export async function clearRateHits(): Promise<void> {
  await testDb.purgeRateHits(new Date('9999-01-01T00:00:00.000Z'), 1_000_000);
}
