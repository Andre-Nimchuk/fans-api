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

export async function createThreadStore(
  outbox: Outbox,
  server: ChatService,
  isOnline = () => true,
) {
  let confirmed = await server.getBefore(undefined, PAGE_SIZE);
  let pending = await outbox.list();
  const failed = new Set<string>();
  const listeners = new Set<() => void>();
  let delivery: Promise<void> | undefined;
  let syncing: Promise<void> | undefined;
  let pagingCursor = confirmed[confirmed.length - 1]?.serverSequence;
  let syncCursor = confirmed[0]?.serverSequence ?? 0;
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

  function flush(): Promise<void> {
    if (delivery) {
      return delivery;
    }

    delivery = deliver().finally(() => {
      delivery = undefined;
    });

    return delivery;
  }

  async function deliver() {
    while (pending.length && isOnline()) {
      const message = pending[0];

      if (!message || failed.has(message.clientId)) {
        break;
      }

      try {
        const accepted = await server.accept(message);

        // REVIEW: Server data is durable before queue cleanup; restart can safely repeat acceptance.
        await outbox.remove(message.clientId);
        pending = pending.filter((row) => row.clientId !== message.clientId);
        failed.delete(message.clientId);
        merge([accepted]);
        error = null;
        publish();
      } catch {
        failed.add(message.clientId);
        error = 'Message saved on this device. Tap Retry to send it.';
        publish();
        break;
      }
    }
  }

  function merge(messages: AcceptedMessage[]) {
    const byId = new Map(confirmed.map((message) => [message.clientId, message]));

    for (const message of messages) {
      byId.set(message.clientId, message);
    }

    confirmed = [...byId.values()].sort((a, b) => b.serverSequence - a.serverSequence);
  }

  async function retry() {
    if (delivery) {
      await delivery;
    }

    failed.clear();
    error = null;
    publish();
    await flush();
  }

  function sync(): Promise<void> {
    syncing ??= recover().finally(() => {
      syncing = undefined;
    });

    return syncing;
  }

  async function recover() {
    if (!isOnline()) {
      return;
    }

    try {
      // REVIEW: Recover missed server messages before replaying outgoing sends; merge by stable ID.
      while (isOnline()) {
        const page = await server.getAfter(syncCursor, 100);

        for (const message of page) {
          if (pending.some((row) => row.clientId === message.clientId)) {
            await outbox.remove(message.clientId);
            pending = pending.filter((row) => row.clientId !== message.clientId);
            failed.delete(message.clientId);
          }
        }

        merge(page);
        syncCursor = page[page.length - 1]?.serverSequence ?? syncCursor;
        if (page.length < 100) {
          break;
        }
      }

      error = null;
      publish();
      await retry();
    } catch {
      error = 'Could not sync messages. Reconnect or tap Sync to try again.';
      publish();
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
    retry,
    sync,
    async loadOlder() {
      if (loadingOlder || !hasOlder || !isOnline()) {
        return;
      }

      loadingOlder = true;
      error = null;
      publish();
      try {
        const page = await server.getBefore(pagingCursor, PAGE_SIZE);
        const known = new Set(confirmed.map((message) => message.clientId));

        merge(page.filter((message) => !known.has(message.clientId)));
        pagingCursor = page[page.length - 1]?.serverSequence ?? pagingCursor;
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
