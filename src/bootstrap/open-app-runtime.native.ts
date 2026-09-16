import { randomUUID } from 'expo-crypto';

import { createClientHistory } from '@/features/chat/data/client-history';
import { createChatSession } from '@/features/chat/data/create-chat-session';
import type { ChatSession } from '@/features/chat/data/create-chat-session';
import { createOutbox } from '@/features/chat/data/outbox';
import { conversations } from '@/features/chat/model/conversations';
import type { ConversationId } from '@/features/chat/model/conversations';
import { DeliveryError } from '@/features/chat/model/delivery-error';
import { createSubscriptionStore } from '@/features/subscription/model/subscription-store';
import { createMockBilling } from '@/services/mock/billing/billing-service';
import { createAcceptedMessages } from '@/services/mock/chat/accepted-messages';
import { seedMessages } from '@/services/mock/chat/seed';
import { openDatabase } from '@/shared/storage/open-database';

import type { AppRuntime } from './app-runtime';

let opening: Promise<AppRuntime> | undefined;

export function openAppRuntime() {
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
    const billingDb = await openDatabase('fan-billing.db');

    opened.push(billingDb);

    const billing = await createMockBilling(billingDb, randomUUID);
    const subscription = await createSubscriptionStore(
      billing.purchases,
      billing.access,
      billing.scenarios,
    );

    function requireAccess() {
      if (!subscription.canSend()) {
        throw new DeliveryError(
          'access',
          'Confirmed access is required. Open All Access; your saved messages are safe.',
        );
      }
    }

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
        await createChatSession({
          outbox,
          server,
          createId: randomUUID,
          history,
          baseline,
          requireAccess,
        }),
      );
    }

    return { threads: stores, subscription };
  } catch (error) {
    await Promise.allSettled(opened.map((db) => db.close()));
    throw error;
  }
}
