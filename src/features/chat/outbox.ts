import type { Database } from '@/shared/storage/database';
import { initializeDatabase } from '@/shared/storage/database';

import { assertSameSend, validateSend } from './message';
import type { PendingMessage, SendMessage } from './message';

export const CLIENT_DATABASE = 'fan-chat-client.db';

const schema = `
  CREATE TABLE outbox (
    local_order INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL UNIQUE,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`;
const columns = 'client_id AS clientId, text, created_at AS createdAt, local_order AS localOrder';

export async function createOutbox(db: Database) {
  await initializeDatabase(db, schema);

  return {
    async enqueue(message: SendMessage): Promise<PendingMessage> {
      validateSend(message);
      // REVIEW: Await the durable insert before reporting queued; force-stop can happen next.
      await db.run(
        'INSERT INTO outbox (client_id, text, created_at) VALUES (?, ?, ?) ON CONFLICT(client_id) DO NOTHING',
        [message.clientId, message.text, message.createdAt],
      );
      const [stored] = await db.all<PendingMessage>(
        `SELECT ${columns} FROM outbox WHERE client_id = ?`,
        [message.clientId],
      );
      if (!stored) throw new Error('The queued message could not be read back.');
      assertSameSend(stored, message);
      return stored;
    },
    list(): Promise<PendingMessage[]> {
      return db.all(`SELECT ${columns} FROM outbox ORDER BY local_order ASC`);
    },
  };
}
