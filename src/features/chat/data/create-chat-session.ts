import type { createAcceptedMessages } from '@/services/mock/chat/accepted-messages';
import { createChatSimulation } from '@/services/mock/chat/simulation';

import type { Outbox } from '../model/contracts';
import { createThreadStore } from '../model/thread-store';

export async function createChatSession(
  outbox: Outbox,
  server: Awaited<ReturnType<typeof createAcceptedMessages>>,
  createId: () => string,
) {
  const simulation = createChatSimulation(outbox, server, createId);
  const thread = await createThreadStore(
    simulation.outbox,
    simulation.transport,
    simulation.isOnline,
  );

  return { ...thread, simulation };
}

export type ChatSession = Awaited<ReturnType<typeof createChatSession>>;
