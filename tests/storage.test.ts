import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';

import type { SendMessage } from '../src/features/chat/message';
import { CLIENT_DATABASE, createOutbox } from '../src/features/chat/outbox';
import {
  createAcceptedMessages,
  MOCK_SERVER_DATABASE,
} from '../src/services/mock/accepted-messages';
import type { Database } from '../src/shared/storage/database';
import { initializeDatabase } from '../src/shared/storage/database';
import { openNodeDatabase } from './helpers/node-database';

const message: SendMessage = { clientId: 'send-1', text: "Hello 👋 'quoted'", createdAt: 100 };

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'fan-chat-test-'));
  const connections = new Set<Database>();
  t.after(async () => {
    for (const db of connections) await db.close();
    await rm(directory, { recursive: true, force: true });
  });
  return {
    open(name: string) {
      const db = openNodeDatabase(join(directory, name));
      connections.add(db);
      return db;
    },
    async close(db: Database) {
      await db.close();
      connections.delete(db);
    },
    directory,
  };
}

test('three queued messages retain IDs, text and local order after closing and reopening SQLite', async (t) => {
  const files = await fixture(t);
  const db = files.open(CLIENT_DATABASE);
  const outbox = await createOutbox(db);
  for (let index = 0; index < 3; index++) {
    await outbox.enqueue({ ...message, clientId: `send-${index}`, createdAt: 100 - index });
  }
  const before = await outbox.list();
  await files.close(db);

  // REVIEW: Reopen a real file with fresh objects; a React remount would not prove persistence.
  const reopened = await createOutbox(files.open(CLIENT_DATABASE));
  assert.deepEqual(await reopened.list(), before);
  assert.deepEqual(
    before.map((row) => row.clientId),
    ['send-0', 'send-1', 'send-2'],
  );
});

test('repeated enqueue preserves one record and the original local order', async (t) => {
  const files = await fixture(t);
  const outbox = await createOutbox(files.open(CLIENT_DATABASE));
  const first = await outbox.enqueue(message);
  assert.deepEqual(await outbox.enqueue(message), first);
  assert.equal((await outbox.list()).length, 1);
});

test('accepted ID survives server restart independently of deleting the client database', async (t) => {
  const files = await fixture(t);
  const clientDb = files.open(CLIENT_DATABASE);
  const serverDb = files.open(MOCK_SERVER_DATABASE);
  const outbox = await createOutbox(clientDb);
  const server = await createAcceptedMessages(serverDb, () => 200);
  await outbox.enqueue(message);
  const accepted = await server.accept(message);
  await files.close(clientDb);
  await files.close(serverDb);
  await rm(join(files.directory, CLIENT_DATABASE));

  const reopened = await createAcceptedMessages(files.open(MOCK_SERVER_DATABASE), () => 999);
  assert.deepEqual(await reopened.accept(message), accepted);
  assert.equal((await reopened.getAfter()).length, 1);
  assert.deepEqual(await (await createOutbox(files.open(CLIENT_DATABASE))).list(), []);
});

test('concurrent acceptance from separate connections yields one server record', async (t) => {
  const files = await fixture(t);
  const first = await createAcceptedMessages(files.open(MOCK_SERVER_DATABASE));
  const second = await createAcceptedMessages(files.open(MOCK_SERVER_DATABASE));
  const results = await Promise.all([first.accept(message), second.accept(message)]);
  assert.deepEqual(results[0], results[1]);
  assert.equal((await first.getAfter()).length, 1);
});

test('different IDs with the same text remain distinct and page by server order', async (t) => {
  const files = await fixture(t);
  const server = await createAcceptedMessages(files.open(MOCK_SERVER_DATABASE));
  const first = await server.accept(message);
  const second = await server.accept({ ...message, clientId: 'send-2', createdAt: 1 });
  assert.deepEqual(await server.getAfter(0, 1), [first]);
  assert.deepEqual(await server.getAfter(first.serverSequence, 1), [second]);
  assert.deepEqual(await server.getAfter(second.serverSequence), []);
});

test('reusing an ID with changed content fails without overwriting the stored message', async (t) => {
  const files = await fixture(t);
  const outbox = await createOutbox(files.open(CLIENT_DATABASE));
  const server = await createAcceptedMessages(files.open(MOCK_SERVER_DATABASE));
  const pending = await outbox.enqueue(message);
  const accepted = await server.accept(message);
  const changed = { ...message, text: 'different text' };
  await assert.rejects(outbox.enqueue(changed), /different send/);
  await assert.rejects(server.accept(changed), /different send/);
  assert.deepEqual(await outbox.list(), [pending]);
  assert.deepEqual(await server.getAfter(), [accepted]);
});

test('a SQLite write failure rejects enqueue and leaves existing text intact', async (t) => {
  const files = await fixture(t);
  const db = files.open(CLIENT_DATABASE);
  const outbox = await createOutbox(db);
  const pending = await outbox.enqueue(message);
  await db.exec('PRAGMA query_only = ON');
  await assert.rejects(outbox.enqueue({ ...message, clientId: 'cannot-save' }), /readonly/i);
  assert.deepEqual(await outbox.list(), [pending]);
});

test('failed schema initialization rolls back and a newer schema is never silently reset', async (t) => {
  const files = await fixture(t);
  const db = files.open(CLIENT_DATABASE);
  await assert.rejects(initializeDatabase(db, 'CREATE TABLE partial (id INTEGER); INVALID SQL;'));
  assert.deepEqual(await db.all('PRAGMA user_version'), [{ user_version: 0 }]);
  assert.deepEqual(await db.all("SELECT name FROM sqlite_master WHERE name = 'partial'"), []);
  await db.exec('PRAGMA user_version = 2');
  await assert.rejects(createOutbox(db), /Unsupported database version/);
  assert.deepEqual(await db.all('PRAGMA user_version'), [{ user_version: 2 }]);
});
