import { assertSameSend, validateSend } from '@/features/chat/message';
import type { AcceptedMessage, SendMessage } from '@/features/chat/message';
import type { Database } from '@/shared/storage/database';
import { initializeDatabase } from '@/shared/storage/database';

export const MOCK_SERVER_DATABASE = 'fan-chat-mock-server.db';

const schema = `
  CREATE TABLE accepted_messages (
    server_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL UNIQUE,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    accepted_at INTEGER NOT NULL
  );
`;
const columns = `client_id AS clientId, text, created_at AS createdAt,
  server_sequence AS serverSequence, accepted_at AS acceptedAt`;

export async function createAcceptedMessages(db: Database, now = Date.now) {
  await initializeDatabase(db, schema);

  return {
    async accept(message: SendMessage): Promise<AcceptedMessage> {
      validateSend(message);
      // REVIEW: The UNIQUE client ID survives server restarts; retries return the original acceptance.
      await db.run(
        `INSERT INTO accepted_messages (client_id, text, created_at, accepted_at)
         VALUES (?, ?, ?, ?) ON CONFLICT(client_id) DO NOTHING`,
        [message.clientId, message.text, message.createdAt, now()],
      );
      const [stored] = await db.all<AcceptedMessage>(
        `SELECT ${columns} FROM accepted_messages WHERE client_id = ?`,
        [message.clientId],
      );
      if (!stored) throw new Error('The accepted message could not be read back.');
      assertSameSend(stored, message);
      return stored;
    },
    getAfter(serverSequence = 0, limit = 50): Promise<AcceptedMessage[]> {
      if (!Number.isSafeInteger(serverSequence) || serverSequence < 0) {
        throw new Error('Invalid server cursor.');
      }
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw new Error('Page size must be between 1 and 100.');
      }
      return db.all(
        `SELECT ${columns} FROM accepted_messages
         WHERE server_sequence > ? ORDER BY server_sequence ASC LIMIT ?`,
        [serverSequence, limit],
      );
    },
  };
}
