import type { ChatService, Outbox } from '@/features/chat/model/contracts';
import { DeliveryError } from '@/features/chat/model/delivery-error';
import { createSerialQueue } from '@/shared/async/serial-queue';

import type { MockChatServer, SimulationSettings } from './contracts';

interface SimulationState {
  offline: boolean;
  failSave: boolean;
  failSend: boolean;
  incomingCount: number;
  loseResponse: boolean;
}

export async function createChatSimulation(
  outbox: Outbox,
  server: MockChatServer,
  createId: () => string,
  history: SimulationSettings,
) {
  const saved = await history.getSettings();
  const exclusive = createSerialQueue();
  let state: SimulationState = {
    offline: saved.offline,
    failSave: false,
    failSend: false,
    incomingCount: saved.incomingCount,
    loseResponse: false,
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
      throw new DeliveryError('offline', 'Simulated connection is offline.');
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

      const loseResponse = state.loseResponse;

      if (loseResponse) {
        update({ loseResponse: false });
      }

      const accepted = await server.accept(message);

      // REVIEW: Throw only AFTER the durable server commit. Retry must reuse the original client ID.
      if (loseResponse || state.offline) {
        throw new DeliveryError('unknown', 'The server response was lost.');
      }

      return accepted;
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
      return exclusive(async () => {
        await history.setOffline(offline);
        update({ offline });
      });
    },
    armLostResponse(enabled: boolean) {
      update({ loseResponse: enabled, failSend: false });
    },
    reset(resetStorage: () => Promise<void>) {
      return exclusive(async () => {
        await resetStorage();
        update({
          offline: false,
          incomingCount: 0,
          failSave: false,
          failSend: false,
          loseResponse: false,
        });
      });
    },
    armSaveFailure(enabled: boolean) {
      update({ failSave: enabled });
    },
    armSendFailure(enabled: boolean) {
      update({ failSend: enabled, loseResponse: false });
    },
    addIncoming() {
      return exclusive(async () => {
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
          await history.setIncomingCount(state.incomingCount + 1);
          update({ incomingCount: state.incomingCount + 1 });
        }
      });
    },
  };
}

export type ChatSimulation = Awaited<ReturnType<typeof createChatSimulation>>;
