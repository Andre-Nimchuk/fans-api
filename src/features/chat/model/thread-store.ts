import type { ChatService, Outbox } from './contracts';
import type { AcceptedMessage, PendingMessage, SendMessage } from './message';

export type ThreadMessage =
  | (AcceptedMessage & { status: 'sent' })
  | (PendingMessage & { sender: 'self'; status: 'waiting' | 'failed' });

export interface ThreadSnapshot {
  messages: ThreadMessage[];
  hasOlder: boolean;
  loadingOlder: boolean;
  error: string | null;
}

const PAGE_SIZE = 30;

export async function createThreadStore(outbox: Outbox, server: ChatService) {
  let confirmed = await server.getBefore(undefined, PAGE_SIZE);
  let pending = await outbox.list();
  const failed = new Set<string>();
  const listeners = new Set<() => void>();
  let delivering = false;
  let loadingOlder = false;
  let hasOlder = confirmed.length === PAGE_SIZE;
  let error: string | null = null;
  let snapshot: ThreadSnapshot;

  function publish() {
    const acceptedIds = new Set(confirmed.map((message) => message.clientId));

    snapshot = {
      messages: [
        ...pending
          .filter((message) => !acceptedIds.has(message.clientId))
          .slice()
          .reverse()
          .map((message): ThreadMessage => ({
            ...message,
            sender: 'self',
            status: failed.has(message.clientId) ? 'failed' : 'waiting',
          })),
        ...confirmed.map((message): ThreadMessage => ({ ...message, status: 'sent' })),
      ],
      hasOlder,
      loadingOlder,
      error,
    };
    for (const listener of listeners) {
      listener();
    }
  }

  async function flush() {
    if (delivering) {
      return;
    }

    delivering = true;
    try {
      while (pending.length) {
        const message = pending[0];

        if (!message) {
          break;
        }

        try {
          const accepted = await server.accept(message);

          // REVIEW: Server data is durable before queue cleanup; restart can safely repeat acceptance.
          await outbox.remove(message.clientId);
          pending = pending.filter((row) => row.clientId !== message.clientId);
          failed.delete(message.clientId);

          const withoutDuplicate = confirmed.filter((row) => row.clientId !== accepted.clientId);

          confirmed = [...withoutDuplicate, accepted].sort(
            (a, b) => b.serverSequence - a.serverSequence,
          );
          error = null;
          publish();
        } catch {
          failed.add(message.clientId);
          error = 'Message saved on this device. Tap Retry to send it.';
          publish();
          break;
        }
      }
    } finally {
      delivering = false;
    }
  }

  publish();

  const store = {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    async send(message: SendMessage) {
      const saved = await outbox.enqueue(message);

      if (!pending.some((row) => row.clientId === saved.clientId)) {
        pending = [...pending, saved];
      }

      publish();
      void flush();
    },
    retry: flush,
    async loadOlder() {
      if (loadingOlder || !hasOlder) {
        return;
      }

      loadingOlder = true;
      error = null;
      publish();
      try {
        const oldest = confirmed[confirmed.length - 1];
        const page = await server.getBefore(oldest?.serverSequence, PAGE_SIZE);
        const known = new Set(confirmed.map((message) => message.clientId));

        confirmed = [...confirmed, ...page.filter((message) => !known.has(message.clientId))];
        hasOlder = page.length === PAGE_SIZE;
      } catch {
        error = 'Could not load earlier messages. Try scrolling up again.';
      } finally {
        loadingOlder = false;
        publish();
      }
    },
  };

  void flush();

  return store;
}

export type ThreadStore = Awaited<ReturnType<typeof createThreadStore>>;
