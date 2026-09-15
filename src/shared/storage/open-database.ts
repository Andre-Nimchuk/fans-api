import { openDatabaseAsync } from 'expo-sqlite';

import type { Database } from './database';

export async function openDatabase(name: string): Promise<Database> {
  const db = await openDatabaseAsync(name);

  return {
    exec: (sql) => db.execAsync(sql),
    async run(sql, params = []) {
      await db.runAsync(sql, params);
    },
    all: <T>(sql: string, params = []) => db.getAllAsync<T>(sql, params),
    close: () => db.closeAsync(),
  };
}
