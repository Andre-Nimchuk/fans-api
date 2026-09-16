import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { createClientHistory } from '../../src/features/chat/data/client-history';
import { createChatSession } from '../../src/features/chat/data/create-chat-session';
import { createOutbox } from '../../src/features/chat/data/outbox';
import { createAcceptedMessages } from '../../src/services/mock/chat/accepted-messages';
import { seedChatHistory, SEED_MESSAGE_COUNT } from '../../src/services/mock/chat/seed';
import { chatMessage } from '../helpers/chat-fixture';
import { createDatabaseFiles } from '../helpers/database-files';

test('50k history pages into the client, survives reopen and resets deterministically', async (t) => {
  const files = await createDatabaseFiles(t);
  let serverDb = files.open('server.db');
  let server = await createAcceptedMessages(serverDb);
  const historyDb = files.open('history.db');
  const history = await createClientHistory(historyDb);
  const outbox = await createOutbox(files.open('outbox.db'));
  const seedHistory = () => seedChatHistory(serverDb, 'ethan');
  const session = () =>
    createChatSession({ server, history, outbox, createId: randomUUID, seedHistory });
  let thread = await session();

  assert.deepEqual(await serverDb.all('SELECT COUNT(*) AS count FROM accepted_messages'), [
    { count: SEED_MESSAGE_COUNT },
  ]);

  const latest = await server.getBefore();
  const earliest = await server.getAfter(0, 1);

  assert.equal(latest[0]?.serverSequence, 50_000);
  assert.equal(latest[0]?.clientId, 'seed-ethan-49999');
  assert.equal(latest[0]?.sender, 'self');
  assert.equal(earliest[0]?.serverSequence, 1);
  assert.equal(earliest[0]?.sender, 'contact');
  assert.equal(thread.getSnapshot().messages.length, 20);
  assert.deepEqual(await historyDb.all('SELECT COUNT(*) AS count FROM messages'), [{ count: 20 }]);
  await thread.loadOlder();
  assert.equal(thread.getSnapshot().messages.length, 40);
  assert.equal(new Set(thread.getSnapshot().messages.map((row) => row.clientId)).size, 40);
  assert.equal(thread.getSnapshot().hasOlder, true);
  await thread.sync();
  assert.equal(thread.getSnapshot().messages.length, 40);
  await server.accept(chatMessage);
  await files.close(serverDb);
  serverDb = files.open('server.db');
  server = await createAcceptedMessages(serverDb);
  thread = await session();
  assert.equal(thread.getSnapshot().messages[0]?.clientId, chatMessage.clientId);
  assert.equal((await server.getBefore())[0]?.serverSequence, 50_001);
  await thread.resetDemo();
  assert.deepEqual(await server.getBefore(), latest);
  assert.deepEqual(await server.getAfter(0, 1), earliest);
  assert.equal(thread.getSnapshot().messages.length, 20);
  assert.equal((await history.getSettings()).cursor, 50_000);
  assert.deepEqual(await outbox.list(), []);
});

test('interrupted seeding rolls back all batches; existing conversations are never reseeded', async (t) => {
  const files = await createDatabaseFiles(t);
  const db = files.open('server.db');
  const server = await createAcceptedMessages(db);
  let batches = 0;

  await assert.rejects(
    seedChatHistory(
      {
        ...db,
        async run(sql, params) {
          assert.ok(params && params.length <= 500);
          if (++batches === 2) {
            throw new Error('Interrupted seed');
          }

          await db.run(sql, params);
        },
      },
      'alex',
    ),
    /Interrupted seed/,
  );
  assert.deepEqual(await server.getAfter(), []);
  await seedChatHistory(db, 'alex');
  assert.equal((await server.getBefore())[0]?.serverSequence, 50_000);
  assert.equal((await server.getAfter(0, 1))[0]?.clientId, 'seed-alex-0');
  await server.reset();

  const existing = await server.accept(chatMessage);

  await seedChatHistory(db, 'alex');
  assert.deepEqual(await server.getAfter(), [existing]);
});
