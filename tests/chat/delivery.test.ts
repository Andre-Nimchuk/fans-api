import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { createClientHistory } from '../../src/features/chat/data/client-history';
import { createChatSession } from '../../src/features/chat/data/create-chat-session';
import { CLIENT_DATABASE, createOutbox } from '../../src/features/chat/data/outbox';
import { createThreadStore } from '../../src/features/chat/model/thread-store';
import {
  createAcceptedMessages,
  MOCK_SERVER_DATABASE,
} from '../../src/services/mock/chat/accepted-messages';
import { createChatFixture, waitForThread } from '../helpers/chat-fixture';
import { createDatabaseFiles } from '../helpers/database-files';

const message = { clientId: 'send-1', text: "Hello 👋 'quoted'", createdAt: 100 };

test('thread exposes a saved failure, retries it and survives reopening without another copy', async (t) => {
  const files = await createDatabaseFiles(t);
  const clientDb = files.open(CLIENT_DATABASE);
  const serverDb = files.open(MOCK_SERVER_DATABASE);
  const outbox = await createOutbox(clientDb);
  const server = await createAcceptedMessages(serverDb);
  let fail = true;
  const thread = await createThreadStore(
    outbox,
    {
      ...server,
      async accept(value) {
        if (fail) {
          throw new Error('Unavailable');
        }

        return server.accept(value);
      },
    },
    await createClientHistory(files.open('history.db')),
  );

  await thread.send(message);
  await thread.retry();
  assert.equal(thread.getSnapshot().messages[0]?.status, 'failed');
  assert.equal((await outbox.list())[0]?.text, message.text);
  fail = false;
  await thread.retry();
  assert.equal(thread.getSnapshot().messages[0]?.status, 'sent');
  assert.deepEqual(await outbox.list(), []);
  await files.close(clientDb);
  await files.close(serverDb);

  const reopened = await createThreadStore(
    await createOutbox(files.open(CLIENT_DATABASE)),
    await createAcceptedMessages(files.open(MOCK_SERVER_DATABASE)),
    await createClientHistory(files.open('history.db')),
  );

  assert.equal(reopened.getSnapshot().messages.length, 1);
  assert.equal(reopened.getSnapshot().messages[0]?.clientId, message.clientId);
});

test(
  'scenario faults fire once: failed save is not queued, failed delivery needs explicit retry',
  { timeout: 3000 },
  async (t) => {
    const files = await createDatabaseFiles(t);
    const outbox = await createOutbox(files.open(CLIENT_DATABASE));
    const server = await createAcceptedMessages(files.open(MOCK_SERVER_DATABASE));
    const thread = await createChatSession({
      outbox,
      server,
      createId: () => 'incoming',
      history: await createClientHistory(files.open('history.db')),
    });

    thread.simulation.armSaveFailure(true);
    await assert.rejects(thread.send(message), /local write failure/);
    assert.deepEqual(await outbox.list(), []);
    assert.deepEqual(thread.getSnapshot().messages, []);
    assert.equal(thread.simulation.getSnapshot().failSave, false);

    thread.simulation.armSendFailure(true);

    await thread.send(message);
    await waitForThread(thread, (state) => state.messages.some((row) => row.status === 'failed'));
    assert.equal(thread.simulation.getSnapshot().failSend, false);
    assert.equal((await outbox.list())[0]?.text, message.text);
    assert.deepEqual(await server.getAfter(), []);

    await thread.send({ ...message, clientId: 'second' });
    assert.equal(
      thread.getSnapshot().messages.find((row) => row.clientId === message.clientId)?.status,
      'failed',
    );
    assert.deepEqual(await server.getAfter(), []);

    await Promise.all([thread.retry(), thread.retry()]);
    assert.deepEqual(await outbox.list(), []);
    assert.deepEqual(
      (await server.getAfter()).map((row) => row.clientId),
      [message.clientId, 'second'],
    );
    assert.ok(thread.getSnapshot().messages.every((row) => row.status === 'sent'));
  },
);

test('retry write failure preserves the failed send and allows a later retry', async (t) => {
  const stores = await (await createChatFixture(t))();
  let failRetryWrite = true;
  const outbox = {
    ...stores.outbox,
    async fail(...args: Parameters<typeof stores.outbox.fail>) {
      if (args[1] === null && failRetryWrite) {
        throw new Error('SQLite write unavailable');
      }

      return stores.outbox.fail(...args);
    },
  };
  const thread = await createChatSession({
    outbox,
    server: stores.server,
    createId: randomUUID,
    history: stores.history,
  });

  thread.simulation.armSendFailure(true);
  await thread.send(message);
  await waitForThread(thread, (state) => state.messages[0]?.status === 'failed');
  await thread.retry();
  assert.match(thread.getSnapshot().error ?? '', /Could not prepare retry/);
  assert.equal(thread.getSnapshot().messages[0]?.status, 'failed');
  assert.equal((await stores.outbox.list())[0]?.text, message.text);
  assert.deepEqual(await stores.server.getAfter(), []);

  failRetryWrite = false;
  await thread.retry();
  assert.equal(thread.getSnapshot().messages[0]?.status, 'sent');
  assert.equal(thread.getSnapshot().error, null);
  assert.equal((await stores.server.getAfter()).length, 1);
  assert.deepEqual(await stores.outbox.list(), []);
});
