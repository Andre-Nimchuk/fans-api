import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CLIENT_DATABASE, createOutbox } from '../../src/features/chat/data/outbox';
import {
  createAcceptedMessages,
  MOCK_SERVER_DATABASE,
} from '../../src/services/mock/chat/accepted-messages';
import { createDatabaseFiles } from '../helpers/database-files';

const message = { clientId: 'send-1', text: "Hello 👋 'quoted'", createdAt: 100 };

test('three queued messages retain IDs, text and local order after closing and reopening SQLite', async (t) => {
  const files = await createDatabaseFiles(t);
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
  const files = await createDatabaseFiles(t);
  const outbox = await createOutbox(files.open(CLIENT_DATABASE));
  const first = await outbox.enqueue(message);

  assert.deepEqual(await outbox.enqueue(message), first);
  assert.equal((await outbox.list()).length, 1);
});

test('reusing an ID with changed content fails without overwriting the stored message', async (t) => {
  const files = await createDatabaseFiles(t);
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
  const files = await createDatabaseFiles(t);
  const db = files.open(CLIENT_DATABASE);
  const outbox = await createOutbox(db);
  const pending = await outbox.enqueue(message);

  await db.exec('PRAGMA query_only = ON');
  await assert.rejects(outbox.enqueue({ ...message, clientId: 'cannot-save' }), /readonly/i);
  assert.deepEqual(await outbox.list(), [pending]);
});
