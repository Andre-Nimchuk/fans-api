export type SqlValue = string | number | null;

export interface Database {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  close(): Promise<void>;
}

export async function initializeDatabase(db: Database, schema: string): Promise<void> {
  await db.exec(
    'PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;',
  );
  const [version] = await db.all<{ user_version: number }>('PRAGMA user_version');
  if (!version || version.user_version > 1) {
    throw new Error('Unsupported database version. Existing data was not reset.');
  }
  if (version.user_version === 1) return;

  await db.exec('BEGIN IMMEDIATE');
  try {
    await db.exec(schema);
    await db.exec('PRAGMA user_version = 1; COMMIT;');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}
