import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CLIENT_DATABASE, createOutbox } from '../../src/features/chat/data/outbox';
import {
  createAcceptedMessages,
  MOCK_SERVER_DATABASE,
} from '../../src/services/mock/chat/accepted-messages';
import { initializeDatabase } from '../../src/shared/storage/database';
import { createDatabaseFiles } from '../helpers/database-files';

const message = { clientId: 'send-1', text: "Hello 👋 'quoted'", createdAt: 100 };

test('failed schema initialization rolls back and a newer schema is never silently reset', async (t) => {
  const files = await createDatabaseFiles(t);
  const db = files.open(CLIENT_DATABASE);

  await assert.rejects(initializeDatabase(db, 'CREATE TABLE partial (id INTEGER); INVALID SQL;'));
  assert.deepEqual(await db.all('PRAGMA user_version'), [{ user_version: 0 }]);
  assert.deepEqual(await db.all("SELECT name FROM sqlite_master WHERE name = 'partial'"), []);
  await db.exec('PRAGMA user_version = 999');
  await assert.rejects(createOutbox(db), /Unsupported database version/);
  assert.deepEqual(await db.all('PRAGMA user_version'), [{ user_version: 999 }]);
});

test('acceptance migration preserves v1 history and adds incoming sender identity', async (t) => {
  const files = await createDatabaseFiles(t);
  const db = files.open(MOCK_SERVER_DATABASE);

  await db.exec(`CREATE TABLE accepted_messages (
    server_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL UNIQUE, text TEXT NOT NULL,
    created_at INTEGER NOT NULL, accepted_at INTEGER NOT NULL
  ); INSERT INTO accepted_messages (client_id, text, created_at, accepted_at)
    VALUES ('legacy', 'Keep this', 1, 2); PRAGMA user_version = 1;`);

  const server = await createAcceptedMessages(db);
  const [legacy] = await server.getAfter();

  assert.equal(legacy?.text, 'Keep this');
  assert.equal(legacy?.sender, 'self');

  const incoming = await server.accept(message, 'contact');

  assert.equal(incoming.sender, 'contact');
  await assert.rejects(server.accept(message, 'self'), /different sender/);
});

test('outbox migration preserves pending IDs and text from the previous schema', async (t) => {
  const files = await createDatabaseFiles(t);
  const db = files.open('client.db');

  await db.exec(`CREATE TABLE outbox (
    local_order INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT NOT NULL UNIQUE,
    text TEXT NOT NULL, created_at INTEGER NOT NULL);
    INSERT INTO outbox(client_id, text, created_at) VALUES ('existing', 'Keep my text', 100);
    PRAGMA user_version = 1;`);

  const outbox = await createOutbox(db);

  assert.deepEqual(await outbox.list(), [
    { clientId: 'existing', text: 'Keep my text', createdAt: 100, localOrder: 1, failure: null },
  ]);
});
