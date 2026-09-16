import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { createChatSession } from '../../src/features/chat/data/create-chat-session';
import { createChatFixture, waitForThread, chatMessage as message } from '../helpers/chat-fixture';

test('offline restart keeps three sends waiting and hides four missed incoming until reconnect', async (t) => {
  const open = await createChatFixture(t);
  let stores = await open();
  let thread = await stores.session();

  await thread.simulation.setOffline(true);
  for (let index = 0; index < 3; index++) {
    await thread.send({ ...message, clientId: `pending-${index}`, createdAt: 100 - index });
  }

  assert.deepEqual(
    thread.getSnapshot().messages.map((row) => row.clientId),
    ['pending-2', 'pending-1', 'pending-0'],
  );
  await thread.simulation.addIncoming();
  await thread.sync();
  assert.equal(thread.getSnapshot().messages.length, 3);
  assert.equal((await stores.server.getAfter()).length, 4);

  const pending = await stores.outbox.list();

  await stores.close();

  // REVIEW: Fresh objects and reopened SQLite files, not React remounts, reproduce process recovery.
  stores = await open();
  thread = await stores.session();
  assert.equal(thread.simulation.getSnapshot().offline, true);
  assert.deepEqual(await stores.outbox.list(), pending);
  assert.equal(thread.getSnapshot().messages.length, 3);
  assert.ok(thread.getSnapshot().messages.every((row) => row.status === 'waiting'));
  await thread.simulation.setOffline(false);
  await Promise.all([thread.sync(), thread.sync()]);
  assert.equal(thread.getSnapshot().messages.length, 7);
  assert.deepEqual(await stores.outbox.list(), []);

  await thread.sync();

  const accepted = await stores.server.getAfter();

  assert.equal(accepted.length, 7);
  assert.ok(accepted.slice(0, 4).every((row) => row.sender === 'contact'));

  assert.deepEqual(
    accepted.slice(4).map((row) => row.clientId),
    ['pending-0', 'pending-1', 'pending-2'],
  );
  await stores.close();
  stores = await open();
  thread = await stores.session();
  assert.deepEqual(
    thread.getSnapshot().messages.map((row) => row.clientId),
    accepted
      .slice()
      .reverse()
      .map((row) => row.clientId),
  );
});

test('cursor does not skip incoming around an acknowledged send, including after restart', async (t) => {
  const open = await createChatFixture(t);
  let stores = await open();
  let thread = await stores.session();

  await stores.server.accept({ ...message, clientId: 'missed' }, 'contact');
  await thread.send(message);
  await waitForThread(thread, (state) => state.messages[0]?.status === 'sent');
  assert.equal((await stores.history.getSettings()).cursor, 0);
  await stores.close();
  stores = await open();
  thread = await stores.session();
  assert.deepEqual(
    thread.getSnapshot().messages.map((row) => row.clientId),
    ['outgoing', 'missed'],
  );
});

test('a partial cache write does not advance the cursor and replay fills the missing messages', async (t) => {
  const open = await createChatFixture(t);
  let stores = await open();
  const history = {
    ...stores.history,
    async save(messages: Parameters<typeof stores.history.save>[0], cursor?: number) {
      if (messages.length > 1) {
        await stores.history.save(messages.slice(0, 1));
        throw new Error('Interrupted page write');
      }

      return stores.history.save(messages, cursor);
    },
  };
  const thread = await createChatSession({
    outbox: stores.outbox,
    server: stores.server,
    createId: randomUUID,
    history,
  });

  for (let index = 0; index < 4; index++) {
    await stores.server.accept({ ...message, clientId: `missed-${index}` }, 'contact');
  }

  await thread.sync();
  assert.equal((await stores.history.getSettings()).cursor, 0);
  assert.equal((await stores.history.getBefore()).length, 1);
  await stores.close();
  stores = await open();

  const reopened = await stores.session();

  assert.equal(reopened.getSnapshot().messages.length, 4);
  assert.equal((await stores.history.getSettings()).cursor, 4);
});
