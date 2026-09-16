import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { TestContext } from 'node:test';

import { createDatabaseFiles } from './database-files';
import { createClientHistory } from '../../src/features/chat/data/client-history';
import { createChatSession } from '../../src/features/chat/data/create-chat-session';
import { createOutbox } from '../../src/features/chat/data/outbox';
import type { ThreadSnapshot, ThreadStore } from '../../src/features/chat/model/thread-store';
import { createAcceptedMessages } from '../../src/services/mock/chat/accepted-messages';

export const chatMessage = { clientId: 'outgoing', text: 'Keep this message', createdAt: 100 };

export async function createChatFixture(t: TestContext) {
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
      session: () => createChatSession({ outbox, server, createId: randomUUID, history }),
    };
  };
}

export function waitForThread(thread: ThreadStore, predicate: (state: ThreadSnapshot) => boolean) {
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
