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
