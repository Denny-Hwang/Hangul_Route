// vitest setupFile: pick the Db backend before any suite imports the app.
import { setDevFallbacksDefaultForTests } from '../../lib/runtime';
import './db';

// Tests opt in to the dev fallbacks explicitly (bearer = user id, in-memory /
// SQLite Db without an env.DB binding). The Worker never does — SEC-2.
setDevFallbacksDefaultForTests(true);
