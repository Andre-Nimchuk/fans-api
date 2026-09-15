export type SqlValue = string | number | null;

export interface Database {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  close(): Promise<void>;
}

export async function initializeDatabase(
  db: Database,
  schema: string,
  upgrades: string[] = [],
): Promise<void> {
  await db.exec(
    'PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;',
  );
  await db.exec('BEGIN IMMEDIATE');

  try {
    const [version] = await db.all<{ user_version: number }>('PRAGMA user_version');
    const migrations = [schema, ...upgrades];

    if (!version || version.user_version > migrations.length) {
      throw new Error('Unsupported database version. Existing data was not reset.');
    }

    for (const migration of migrations.slice(version.user_version)) {
      await db.exec(migration);
    }

    await db.exec(`PRAGMA user_version = ${migrations.length}; COMMIT;`);
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}
