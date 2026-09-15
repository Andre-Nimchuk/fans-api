import type { ChatService, Outbox } from '@/features/chat/model/contracts';

import type { createAcceptedMessages } from './accepted-messages';

interface SimulationState {
  offline: boolean;
  failSave: boolean;
  failSend: boolean;
  incomingCount: number;
}

export function createChatSimulation(
  outbox: Outbox,
  server: Awaited<ReturnType<typeof createAcceptedMessages>>,
  createId: () => string,
) {
  let state: SimulationState = {
    offline: false,
    failSave: false,
    failSend: false,
    incomingCount: 0,
  };
  const listeners = new Set<() => void>();

  function update(patch: Partial<SimulationState>) {
    state = { ...state, ...patch };
    for (const listener of listeners) {
      listener();
    }
  }

  function requireOnline() {
    if (state.offline) {
      throw new Error('Simulated connection is offline.');
    }
  }

  const clientOutbox: Outbox = {
    ...outbox,
    async enqueue(message) {
      // REVIEW: Fail before persistence; the composer must retain its draft, with no queued bubble.
      if (state.failSave) {
        update({ failSave: false });
        throw new Error('Simulated local write failure.');
      }

      return outbox.enqueue(message);
    },
  };
  const transport: ChatService = {
    async accept(message) {
      requireOnline();
      // This fault is before acceptance; lost-response-after-commit is a separate scenario.
      if (state.failSend) {
        update({ failSend: false });
        throw new Error('Simulated delivery failure.');
      }

      return server.accept(message);
    },
    async getBefore(cursor, limit) {
      requireOnline();

      return server.getBefore(cursor, limit);
    },
    async getAfter(cursor, limit) {
      requireOnline();

      return server.getAfter(cursor, limit);
    },
  };

  return {
    outbox: clientOutbox,
    transport,
    isOnline: () => !state.offline,
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    setOffline(offline: boolean) {
      update({ offline });
    },
    armSaveFailure(enabled: boolean) {
      update({ failSave: enabled });
    },
    armSendFailure(enabled: boolean) {
      update({ failSend: enabled });
    },
    async addIncoming() {
      if (!state.offline) {
        throw new Error('Go offline before adding missed incoming messages.');
      }

      for (let index = 0; index < 4; index++) {
        await server.accept(
          {
            clientId: createId(),
            text: `Message received while offline (${state.incomingCount + 1})`,
            createdAt: Date.now(),
          },
          'contact',
        );
        update({ incomingCount: state.incomingCount + 1 });
      }
    },
  };
}

export type ChatSimulation = ReturnType<typeof createChatSimulation>;
