import { assertSameSend, validateSend } from '@/features/chat/model/message';
import type { AcceptedMessage, SendMessage } from '@/features/chat/model/message';
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
const columns = `client_id AS clientId, text, created_at AS createdAt, sender,
  server_sequence AS serverSequence, accepted_at AS acceptedAt`;

export async function createAcceptedMessages(db: Database, now = Date.now) {
  await initializeDatabase(db, schema, [
    "ALTER TABLE accepted_messages ADD COLUMN sender TEXT NOT NULL DEFAULT 'self' CHECK (sender IN ('self', 'contact'));",
  ]);

  return {
    reset(): Promise<void> {
      return db.exec(
        "DELETE FROM accepted_messages; DELETE FROM sqlite_sequence WHERE name = 'accepted_messages';",
      );
    },
    async accept(
      message: SendMessage,
      sender: AcceptedMessage['sender'] = 'self',
    ): Promise<AcceptedMessage> {
      validateSend(message);
      // REVIEW: The UNIQUE client ID survives server restarts; retries return the original acceptance.
      await db.run(
        `INSERT INTO accepted_messages (client_id, text, created_at, accepted_at, sender)
         VALUES (?, ?, ?, ?, ?) ON CONFLICT(client_id) DO NOTHING`,
        [message.clientId, message.text, message.createdAt, now(), sender],
      );

      const [stored] = await db.all<AcceptedMessage>(
        `SELECT ${columns} FROM accepted_messages WHERE client_id = ?`,
        [message.clientId],
      );

      if (!stored) {
        throw new Error('The accepted message could not be read back.');
      }

      assertSameSend(stored, message);
      if (stored.sender !== sender) {
        throw new Error('This client ID belongs to a different sender.');
      }

      return stored;
    },

    getBefore(serverSequence = Number.MAX_SAFE_INTEGER, limit = 30): Promise<AcceptedMessage[]> {
      if (
        !Number.isSafeInteger(serverSequence) ||
        serverSequence < 1 ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100
      ) {
        throw new Error('Invalid history page.');
      }

      return db.all(
        `SELECT ${columns} FROM accepted_messages WHERE server_sequence < ? ORDER BY server_sequence DESC LIMIT ?`,
        [serverSequence, limit],
      );
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
