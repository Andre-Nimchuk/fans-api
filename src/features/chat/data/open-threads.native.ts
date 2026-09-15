import { randomUUID } from 'expo-crypto';

import { createAcceptedMessages } from '@/services/mock/chat/accepted-messages';
import { seedMessages } from '@/services/mock/chat/seed';
import { openDatabase } from '@/shared/storage/open-database';

import { createClientHistory } from './client-history';
import { createChatSession } from './create-chat-session';
import type { ChatSession } from './create-chat-session';
import { createOutbox } from './outbox';
import { conversations } from '../model/conversations';
import type { ConversationId } from '../model/conversations';

let opening: Promise<Map<ConversationId, ChatSession>> | undefined;

export function openThreads() {
  opening ??= initialize().catch((error: unknown) => {
    opening = undefined;
    throw error;
  });

  return opening;
}

async function initialize() {
  const stores = new Map<ConversationId, ChatSession>();
  const opened: Awaited<ReturnType<typeof openDatabase>>[] = [];

  try {
    for (const conversation of conversations) {
      // Each conversation owns its queue, cache and mock server files.
      const client = await openDatabase(`chat-${conversation.id}-client.db`);

      opened.push(client);

      const serverDb = await openDatabase(`chat-${conversation.id}-server.db`);

      opened.push(serverDb);

      const historyDb = await openDatabase(`chat-${conversation.id}-history.db`);

      opened.push(historyDb);

      const history = await createClientHistory(historyDb);
      const outbox = await createOutbox(client);
      const server = await createAcceptedMessages(serverDb);

      const baseline = seedMessages(conversation.id);

      for (const message of baseline) {
        await server.accept(message, message.sender);
      }

      stores.set(
        conversation.id,
        await createChatSession(outbox, server, randomUUID, history, baseline),
      );
    }

    return stores;
  } catch (error) {
    await Promise.allSettled(opened.map((db) => db.close()));
    throw error;
  }
}
