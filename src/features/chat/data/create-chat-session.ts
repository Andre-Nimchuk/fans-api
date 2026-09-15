import type { MockChatServer } from '@/services/mock/chat/contracts';
import { createChatSimulation } from '@/services/mock/chat/simulation';

import type { ClientHistory } from './client-history';
import type { Outbox } from '../model/contracts';
import type { AcceptedMessage, SendMessage } from '../model/message';
import { createThreadStore } from '../model/thread-store';

export async function createChatSession(
  outbox: Outbox,
  server: MockChatServer,
  createId: () => string,
  history: ClientHistory,
  baseline: (SendMessage & { sender: AcceptedMessage['sender'] })[] = [],
) {
  async function resetStorage() {
    // REVIEW: Durable reset intent makes a crash between the independent databases recoverable.
    await history.markReset();
    await server.reset();
    for (const message of baseline) {
      await server.accept(message, message.sender);
    }

    await outbox.clear();
    await history.clear();
    await history.finishReset();
  }

  if ((await history.getSettings()).resetPending) {
    await resetStorage();
  }

  const simulation = await createChatSimulation(outbox, server, createId, history);
  const thread = await createThreadStore(
    simulation.outbox,
    simulation.transport,
    history,
    simulation.isOnline,
  );

  return {
    ...thread,
    simulation,
    resetDemo: () => thread.reset(() => simulation.reset(resetStorage)),
  };
}

export type ChatSession = Awaited<ReturnType<typeof createChatSession>>;
