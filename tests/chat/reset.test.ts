import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { createChatSession } from '../../src/features/chat/data/create-chat-session';
import { createChatFixture, chatMessage as message } from '../helpers/chat-fixture';

test('reset waits for in-flight acceptance and prevents old messages from returning', async (t) => {
  const stores = await (await createChatFixture(t))();
  let release: () => void = () => {};

  let started: () => void = () => {};

  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const server = {
    ...stores.server,
    async accept(value: typeof message) {
      started();
      await gate;

      return stores.server.accept(value);
    },
  };
  const thread = await createChatSession({
    outbox: stores.outbox,
    server,
    createId: randomUUID,
    history: stores.history,
  });

  await thread.send(message);
  await entered;

  const resetting = thread.resetDemo();

  await assert.rejects(thread.send({ ...message, clientId: 'during-reset' }), /reset/i);
  release();
  await resetting;
  assert.deepEqual(await stores.server.getAfter(), []);
  assert.deepEqual(await stores.outbox.list(), []);
  assert.deepEqual(thread.getSnapshot().messages, []);
  assert.equal(thread.getSnapshot().revision, 1);
  assert.equal((await stores.history.getSettings()).resetPending, false);
});

test('startup completes an interrupted reset to the same baseline', async (t) => {
  const open = await createChatFixture(t);
  let stores = await open();

  await stores.outbox.enqueue(message);
  await stores.server.accept(message);
  await stores.history.setOffline(true);
  await stores.history.markReset();
  await stores.close();
  stores = await open();

  const thread = await createChatSession({
    outbox: stores.outbox,
    server: stores.server,
    createId: randomUUID,
    history: stores.history,
    seedHistory: async () => {
      await stores.server.accept({ ...message, clientId: 'seed' }, 'contact');
    },
  });

  assert.equal(thread.simulation.getSnapshot().offline, false);
  assert.deepEqual(
    (await stores.server.getAfter()).map((row) => row.clientId),
    ['seed'],
  );
  assert.deepEqual(await stores.outbox.list(), []);
  assert.equal(thread.getSnapshot().messages[0]?.clientId, 'seed');
});
