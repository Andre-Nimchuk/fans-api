import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createClientHistory } from '../../src/features/chat/data/client-history';
import { createOutbox } from '../../src/features/chat/data/outbox';
import { createThreadStore } from '../../src/features/chat/model/thread-store';
import { createAcceptedMessages } from '../../src/services/mock/chat/accepted-messages';
import { createChatFixture } from '../helpers/chat-fixture';
import { createDatabaseFiles } from '../helpers/database-files';

const message = { clientId: 'send-1', text: "Hello 👋 'quoted'", createdAt: 100 };

test('thread pages older history without duplicates and keeps conversation stores independent', async (t) => {
  const files = await createDatabaseFiles(t);
  const server = await createAcceptedMessages(files.open('first-server.db'));
  const outbox = await createOutbox(files.open('first-client.db'));

  for (let index = 0; index < 65; index++) {
    await server.accept({ ...message, clientId: `page-${index}` }, index % 2 ? 'self' : 'contact');
  }

  const thread = await createThreadStore(
    outbox,
    server,
    await createClientHistory(files.open('history.db')),
  );

  assert.equal(thread.getSnapshot().messages.length, 20);

  const latestId = thread.getSnapshot().messages[0]?.clientId;

  await Promise.all([thread.loadOlder(), thread.loadOlder()]);
  assert.equal(thread.getSnapshot().messages.length, 40);
  await thread.loadOlder();
  assert.equal(thread.getSnapshot().messages.length, 60);
  await thread.loadOlder();

  const state = thread.getSnapshot();

  assert.equal(state.messages.length, 65);
  assert.equal(new Set(state.messages.map((row) => row.clientId)).size, 65);
  assert.equal(state.messages[0]?.clientId, latestId);
  assert.equal(state.hasOlder, false);

  const other = await createThreadStore(
    await createOutbox(files.open('second-client.db')),
    await createAcceptedMessages(files.open('second-server.db')),
    await createClientHistory(files.open('other-history.db')),
  );

  assert.deepEqual(other.getSnapshot().messages, []);
});

test('pagination and repeated sync preserve unchanged message objects for memoized rows', async (t) => {
  const stores = await (await createChatFixture(t))();

  for (let index = 0; index < 35; index++) {
    await stores.server.accept({ ...message, clientId: `history-${index}` }, 'contact');
  }

  const thread = await stores.session();
  const initial = thread.getSnapshot().messages;
  const loading = thread.loadOlder();

  assert.equal(thread.getSnapshot().loadingOlder, true);
  assert.strictEqual(thread.getSnapshot().messages, initial);
  await loading;

  const loaded = thread.getSnapshot().messages;

  assert.equal(loaded.length, 35);
  initial.forEach((row, index) => assert.strictEqual(loaded[index], row));
  await thread.sync();
  assert.strictEqual(thread.getSnapshot().messages, loaded);

  await thread.simulation.setOffline(true);
  await thread.send(message);
  assert.equal(thread.getSnapshot().messages[0]?.status, 'waiting');
  loaded.forEach((row, index) => assert.strictEqual(thread.getSnapshot().messages[index + 1], row));
});
