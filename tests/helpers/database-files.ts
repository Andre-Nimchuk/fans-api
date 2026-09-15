import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';

import { openNodeDatabase } from './node-database';
import type { Database } from '../../src/shared/storage/database';

export async function createDatabaseFiles(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'fan-chat-test-'));
  const connections = new Set<Database>();

  t.after(async () => {
    for (const db of connections) {
      await db.close();
    }

    await rm(directory, { recursive: true, force: true });
  });

  return {
    open(name: string) {
      const db = openNodeDatabase(join(directory, name));

      connections.add(db);

      return db;
    },
    async close(db: Database) {
      if (connections.has(db)) {
        await db.close();
        connections.delete(db);
      }
    },
    directory,
  };
}
