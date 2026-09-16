import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

import { CLIENT_DATABASE, createOutbox } from '../../src/features/chat/data/outbox';
import {
  createAcceptedMessages,
  MOCK_SERVER_DATABASE,
} from '../../src/services/mock/chat/accepted-messages';
import { createDatabaseFiles } from '../helpers/database-files';

const message = { clientId: 'send-1', text: "Hello 👋 'quoted'", createdAt: 100 };

test('accepted ID survives server restart independently of deleting the client database', async (t) => {
  const files = await createDatabaseFiles(t);
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
  const files = await createDatabaseFiles(t);
  const first = await createAcceptedMessages(files.open(MOCK_SERVER_DATABASE));
  const second = await createAcceptedMessages(files.open(MOCK_SERVER_DATABASE));
  const results = await Promise.all([first.accept(message), second.accept(message)]);

  assert.deepEqual(results[0], results[1]);
  assert.equal((await first.getAfter()).length, 1);
});

test('different IDs with the same text remain distinct and page by server order', async (t) => {
  const files = await createDatabaseFiles(t);
  const server = await createAcceptedMessages(files.open(MOCK_SERVER_DATABASE));
  const first = await server.accept(message);
  const second = await server.accept({ ...message, clientId: 'send-2', createdAt: 1 });

  assert.deepEqual(await server.getAfter(0, 1), [first]);
  assert.deepEqual(await server.getAfter(first.serverSequence, 1), [second]);
  assert.deepEqual(await server.getAfter(second.serverSequence), []);
});
