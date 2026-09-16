import assert from 'node:assert/strict';
import { test } from 'node:test';

import { replayLostResponse } from '../fixtures/lost-response';
import { createChatFixture, waitForThread, chatMessage as message } from '../helpers/chat-fixture';

test('lost response happens after acceptance; concurrent retry returns the same server record', async (t) => {
  const stores = await (await createChatFixture(t))();
  const thread = await stores.session();

  thread.simulation.armLostResponse(true);
  await thread.send(message);
  await waitForThread(thread, (state) => state.messages[0]?.status === 'unknown');

  const [accepted] = await stores.server.getAfter();

  assert.ok(accepted);
  assert.equal((await stores.outbox.list())[0]?.failure, 'unknown');
  await Promise.all([thread.retry(), thread.retry()]);
  assert.deepEqual(await stores.server.getAfter(), [accepted]);
  assert.deepEqual(await stores.outbox.list(), []);
  assert.equal(thread.getSnapshot().messages[0]?.status, 'sent');
});

test('unknown delivery survives offline restart and reconciles by ID on reconnect', async (t) => {
  const open = await createChatFixture(t);
  let stores = await open();
  let thread = await stores.session();

  thread.simulation.armLostResponse(true);
  await thread.send(message);
  await waitForThread(thread, (state) => state.messages[0]?.status === 'unknown');
  await thread.simulation.setOffline(true);
  await stores.close();
  stores = await open();
  thread = await stores.session();
  assert.equal(thread.getSnapshot().messages[0]?.status, 'unknown');
  await thread.simulation.setOffline(false);
  await thread.sync();
  assert.equal((await stores.server.getAfter()).length, 1);
  assert.equal(thread.getSnapshot().messages.length, 1);
  assert.deepEqual(await stores.outbox.list(), []);
});

test('same lost-response regression is red with a new retry ID and green with a stable ID', async (t) => {
  const stores = await (await createChatFixture(t))();

  assert.equal((await replayLostResponse(stores.server, true)).length, 2);
  await stores.server.reset();
  assert.equal((await replayLostResponse(stores.server, false)).length, 1);
});
