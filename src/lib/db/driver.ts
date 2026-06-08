/**
 * Internal SQLite driver.
 *
 * Owns the database connection and schema. Nothing outside src/lib/db/
 * should import this module — go through index.ts instead.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqliteDb = any;

// Promise singleton — all concurrent callers share one initialization sequence.
// Without this, two callers that both see _db === null would each start their
// own initialization, producing two separate (empty) database instances.
let _dbPromise: Promise<SqliteDb> | null = null;

export function getDb(): Promise<SqliteDb> {
	if (!_dbPromise) {
		_dbPromise = initDb().catch((err) => {
			_dbPromise = null; // allow a retry on transient failure
			throw err;
		});
	}
	return _dbPromise;
}

async function initDb(): Promise<SqliteDb> {
	const { default: initModule } = await import('@sqlite.org/sqlite-wasm');
	// Silence the sqlite3 banner; errors are still propagated via thrown exceptions.
	const sqlite3 = await initModule({ print: () => {}, printErr: () => {} });

	// Prefer OPFS access-handle-pool VFS: persistent, no SharedArrayBuffer required.
	// Fall back to an in-memory DB if OPFS is unavailable (e.g. non-secure context).
	let db: SqliteDb;
	try {
		const pool = await sqlite3.installOpfsSAHPoolVfs({ clearOnOpen: false });
		db = new pool.OpfsSAHPoolDb('/letterpress.db');
	} catch {
		console.warn('[db] OPFS unavailable — using in-memory SQLite (data will not persist across reloads)');
		db = new sqlite3.oo1.DB(':memory:', 'c');
	}

	db.exec(`
		PRAGMA journal_mode = WAL;
		PRAGMA foreign_keys = ON;

		CREATE TABLE IF NOT EXISTS projects (
			id          TEXT PRIMARY KEY,
			title       TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			preview     BLOB
		);

		CREATE TABLE IF NOT EXISTS files (
			project  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			name     TEXT NOT NULL,
			content  TEXT NOT NULL DEFAULT '',
			PRIMARY KEY (project, name)
		);
	`);

	return db;
}
