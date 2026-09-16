import type { MockChatServer } from '@/services/mock/chat/contracts';
import { createChatSimulation } from '@/services/mock/chat/simulation';

import type { ClientHistory } from './client-history';
import type { Outbox } from '../model/contracts';
import { createThreadStore } from '../model/thread-store';

interface ChatSessionOptions {
  outbox: Outbox;
  server: MockChatServer;
  createId: () => string;
  history: ClientHistory;
  seedHistory?: () => Promise<void>;
  requireAccess?: () => void;
}

export async function createChatSession({
  outbox,
  server,
  createId,
  history,
  seedHistory = async () => {},
  requireAccess = () => {},
}: ChatSessionOptions) {
  async function resetStorage() {
    // REVIEW: Durable reset intent makes a crash between the independent databases recoverable.
    await history.markReset();
    await server.reset();
    await seedHistory();

    await outbox.clear();
    await history.clear();
    await history.finishReset();
  }

  if ((await history.getSettings()).resetPending) {
    await resetStorage();
  } else {
    await seedHistory();
  }

  const simulation = await createChatSimulation(outbox, server, createId, history);
  const thread = await createThreadStore(
    simulation.outbox,
    simulation.transport,
    history,
    simulation.isOnline,
    requireAccess,
  );

  return {
    ...thread,
    simulation,
    resetDemo: () => thread.reset(() => simulation.reset(resetStorage)),
  };
}

export type ChatSession = Awaited<ReturnType<typeof createChatSession>>;
