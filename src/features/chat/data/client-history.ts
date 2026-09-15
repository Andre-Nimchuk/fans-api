import type { Database } from '@/shared/storage/database';
import { initializeDatabase } from '@/shared/storage/database';

import type { AcceptedMessage } from '../model/message';

const schema = `
  CREATE TABLE messages (
    client_id TEXT PRIMARY KEY, text TEXT NOT NULL, created_at INTEGER NOT NULL,
    sender TEXT NOT NULL, server_sequence INTEGER NOT NULL UNIQUE, accepted_at INTEGER NOT NULL
  );
  CREATE TABLE state (
    id INTEGER PRIMARY KEY CHECK(id = 1), cursor INTEGER NOT NULL DEFAULT -1,
    offline INTEGER NOT NULL DEFAULT 0, incoming_count INTEGER NOT NULL DEFAULT 0,
    reset_pending INTEGER NOT NULL DEFAULT 0
  );
  INSERT INTO state(id) VALUES (1);
`;
const columns = `client_id AS clientId, text, created_at AS createdAt, sender,
  server_sequence AS serverSequence, accepted_at AS acceptedAt`;

export async function createClientHistory(db: Database) {
  await initializeDatabase(db, schema);

  return {
    async getSettings() {
      const [state] = await db.all<{
        cursor: number;
        offline: number;
        incomingCount: number;
        resetPending: number;
      }>(
        'SELECT cursor, offline, incoming_count AS incomingCount, reset_pending AS resetPending FROM state WHERE id = 1',
      );

      if (!state) {
        throw new Error('Client state is missing.');
      }

      return {
        ...state,
        offline: Boolean(state.offline),
        resetPending: Boolean(state.resetPending),
      };
    },
    setOffline(offline: boolean) {
      return db.run('UPDATE state SET offline = ? WHERE id = 1', [Number(offline)]);
    },
    setIncomingCount(count: number) {
      return db.run('UPDATE state SET incoming_count = ? WHERE id = 1', [count]);
    },
    markReset() {
      return db.run('UPDATE state SET reset_pending = 1 WHERE id = 1');
    },
    async clear() {
      await db.exec(
        'DELETE FROM messages; UPDATE state SET cursor = -1, offline = 0, incoming_count = 0 WHERE id = 1;',
      );
    },
    finishReset() {
      return db.run('UPDATE state SET reset_pending = 0 WHERE id = 1');
    },
    getBefore(cursor = Number.MAX_SAFE_INTEGER, limit = 30): Promise<AcceptedMessage[]> {
      return db.all(
        `SELECT ${columns} FROM messages WHERE server_sequence < ? ORDER BY server_sequence DESC LIMIT ?`,
        [cursor, limit],
      );
    },
    async find(clientId: string) {
      const [message] = await db.all<AcceptedMessage>(
        `SELECT ${columns} FROM messages WHERE client_id = ?`,
        [clientId],
      );

      return message;
    },
    async save(messages: AcceptedMessage[], cursor?: number) {
      // REVIEW: Persist every message before advancing the cursor. A crash replays an idempotent page.
      for (const message of messages) {
        await db.run(
          `INSERT INTO messages(client_id, text, created_at, sender, server_sequence, accepted_at)
          VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(client_id) DO NOTHING`,
          [
            message.clientId,
            message.text,
            message.createdAt,
            message.sender,
            message.serverSequence,
            message.acceptedAt,
          ],
        );
      }

      if (cursor !== undefined) {
        await db.run('UPDATE state SET cursor = MAX(cursor, ?) WHERE id = 1', [cursor]);
      }
    },
  };
}

export type ClientHistory = Awaited<ReturnType<typeof createClientHistory>>;
