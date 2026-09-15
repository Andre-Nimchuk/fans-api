import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { TestContext } from 'node:test';

import { replayLostResponse } from './fixtures/lost-response';
import { createDatabaseFiles } from './helpers/database-files';
import { createClientHistory } from '../src/features/chat/data/client-history';
import { createChatSession } from '../src/features/chat/data/create-chat-session';
import { createOutbox } from '../src/features/chat/data/outbox';
import type { ThreadSnapshot, ThreadStore } from '../src/features/chat/model/thread-store';
import { createAcceptedMessages } from '../src/services/mock/chat/accepted-messages';

const message = { clientId: 'outgoing', text: 'Keep this message', createdAt: 100 };

async function fixture(t: TestContext) {
  const files = await createDatabaseFiles(t);

  return async function open() {
    const databases = ['client.db', 'server.db', 'history.db'].map((name) => files.open(name));
    const [clientDb, serverDb, historyDb] = databases;

    assert.ok(clientDb && serverDb && historyDb);

    const outbox = await createOutbox(clientDb);
    const server = await createAcceptedMessages(serverDb);
    const history = await createClientHistory(historyDb);

    return {
      outbox,
      server,
      history,
      close: () => Promise.all(databases.map(files.close)),
      session: () => createChatSession(outbox, server, randomUUID, history),
    };
  };
}

function waitFor(thread: ThreadStore, predicate: (state: ThreadSnapshot) => boolean) {
  return new Promise<void>((resolve, reject) => {
    if (predicate(thread.getSnapshot())) {
      resolve();

      return;
    }

    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('Timed out waiting for delivery state'));
    }, 1500);
    const unsubscribe = thread.subscribe(() => {
      if (predicate(thread.getSnapshot())) {
        clearTimeout(timer);
        unsubscribe();
        resolve();
      }
    });
  });
}

test('offline restart keeps three sends waiting and hides four missed incoming until reconnect', async (t) => {
  const open = await fixture(t);
  let stores = await open();
  let thread = await stores.session();

  await thread.simulation.setOffline(true);
  for (let index = 0; index < 3; index++) {
    await thread.send({ ...message, clientId: `pending-${index}` });
  }

  await thread.simulation.addIncoming();

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

  const accepted = await stores.server.getAfter();

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

test('lost response happens after acceptance; concurrent retry returns the same server record', async (t) => {
  const stores = await (await fixture(t))();
  const thread = await stores.session();

  thread.simulation.armLostResponse(true);
  await thread.send(message);
  await waitFor(thread, (state) => state.messages[0]?.status === 'unknown');

  const [accepted] = await stores.server.getAfter();

  assert.ok(accepted);
  assert.equal((await stores.outbox.list())[0]?.failure, 'unknown');
  await Promise.all([thread.retry(), thread.retry()]);
  assert.deepEqual(await stores.server.getAfter(), [accepted]);
  assert.deepEqual(await stores.outbox.list(), []);
  assert.equal(thread.getSnapshot().messages[0]?.status, 'sent');
});

test('unknown delivery survives offline restart and reconciles by ID on reconnect', async (t) => {
  const open = await fixture(t);
  let stores = await open();
  let thread = await stores.session();

  thread.simulation.armLostResponse(true);
  await thread.send(message);
  await waitFor(thread, (state) => state.messages[0]?.status === 'unknown');
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
  const stores = await (await fixture(t))();

  assert.equal((await replayLostResponse(stores.server, true)).length, 2);
  await stores.server.reset();
  assert.equal((await replayLostResponse(stores.server, false)).length, 1);
});

test('reset waits for in-flight acceptance and prevents old messages from returning', async (t) => {
  const stores = await (await fixture(t))();
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
  const thread = await createChatSession(stores.outbox, server, randomUUID, stores.history);

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
  const open = await fixture(t);
  let stores = await open();

  await stores.outbox.enqueue(message);
  await stores.server.accept(message);
  await stores.history.setOffline(true);
  await stores.history.markReset();
  await stores.close();
  stores = await open();

  const baseline = [{ ...message, clientId: 'seed', sender: 'contact' as const }];
  const thread = await createChatSession(
    stores.outbox,
    stores.server,
    randomUUID,
    stores.history,
    baseline,
  );

  assert.equal(thread.simulation.getSnapshot().offline, false);
  assert.deepEqual(
    (await stores.server.getAfter()).map((row) => row.clientId),
    ['seed'],
  );
  assert.deepEqual(await stores.outbox.list(), []);
  assert.equal(thread.getSnapshot().messages[0]?.clientId, 'seed');
});

test('cursor does not skip incoming around an acknowledged send, including after restart', async (t) => {
  const open = await fixture(t);
  let stores = await open();
  let thread = await stores.session();

  await stores.server.accept({ ...message, clientId: 'missed' }, 'contact');
  await thread.send(message);
  await waitFor(thread, (state) => state.messages[0]?.status === 'sent');
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
  const open = await fixture(t);
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
  const thread = await createChatSession(stores.outbox, stores.server, randomUUID, history);

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

test('pagination and repeated sync preserve unchanged message objects for memoized rows', async (t) => {
  const stores = await (await fixture(t))();

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

test('retry write failure preserves the failed send and allows a later retry', async (t) => {
  const stores = await (await fixture(t))();
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
  const thread = await createChatSession(outbox, stores.server, randomUUID, stores.history);

  thread.simulation.armSendFailure(true);
  await thread.send(message);
  await waitFor(thread, (state) => state.messages[0]?.status === 'failed');
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
