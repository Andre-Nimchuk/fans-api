import { DatabaseSync } from 'node:sqlite';

import type { Database, SqlValue } from '../../src/shared/storage/database';

export function openNodeDatabase(path: string): Database {
  const db = new DatabaseSync(path);

  return {
    async exec(sql) {
      db.exec(sql);
    },
    async run(sql, params = []) {
      db.prepare(sql).run(...params);
    },
    async all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
      // SQL result types are supplied by the store, just as with Expo's getAllAsync<T>.
      return db
        .prepare(sql)
        .all(...params)
        .map((row) => ({ ...row })) as T[];
    },
    async close() {
      db.close();
    },
  };
}
