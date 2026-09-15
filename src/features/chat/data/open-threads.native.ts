import { createAcceptedMessages } from '@/services/mock/chat/accepted-messages';
import { seedMessages } from '@/services/mock/chat/seed';
import { openDatabase } from '@/shared/storage/open-database';

import { createOutbox } from './outbox';
import { conversations } from '../model/conversations';
import type { ConversationId } from '../model/conversations';
import { createThreadStore } from '../model/thread-store';
import type { ThreadStore } from '../model/thread-store';

let opening: Promise<Map<ConversationId, ThreadStore>> | undefined;

export function openThreads() {
  opening ??= initialize().catch((error: unknown) => {
    opening = undefined;
    throw error;
  });

  return opening;
}

async function initialize() {
  const stores = new Map<ConversationId, ThreadStore>();
  const opened: Awaited<ReturnType<typeof openDatabase>>[] = [];

  try {
    for (const conversation of conversations) {
      // Fixed mock conversations each own a client/server pair; IDs cannot leak across threads.
      const client = await openDatabase(`chat-${conversation.id}-client.db`);

      opened.push(client);

      const serverDb = await openDatabase(`chat-${conversation.id}-server.db`);

      opened.push(serverDb);

      const outbox = await createOutbox(client);
      const server = await createAcceptedMessages(serverDb);

      for (const message of seedMessages(conversation.id)) {
        await server.accept(message, message.sender);
      }

      stores.set(conversation.id, await createThreadStore(outbox, server));
    }

    return stores;
  } catch (error) {
    await Promise.allSettled(opened.map((db) => db.close()));
    throw error;
  }
}
