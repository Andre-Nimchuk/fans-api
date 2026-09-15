import type { ChatService, MessageHistory, Outbox } from './contracts';
import { DeliveryError } from './delivery-error';
import type { AcceptedMessage, PendingMessage, SendMessage } from './message';

export type ThreadMessage =
  | (AcceptedMessage & { status: 'sent' })
  | (PendingMessage & { sender: 'self'; status: 'waiting' | 'failed' | 'unknown' });

export interface ThreadSnapshot {
  messages: ThreadMessage[];
  hasOlder: boolean;
  loadingOlder: boolean;
  resetting: boolean;
  revision: number;
  error: string | null;
}

const PAGE_SIZE = 30;

export async function createThreadStore(
  outbox: Outbox,
  server: ChatService,
  history: MessageHistory,
  isOnline = () => true,
) {
  let confirmed: AcceptedMessage[] = [];
  let pending: PendingMessage[] = [];
  const listeners = new Set<() => void>();
  let work: Promise<unknown> = Promise.resolve();
  let syncing: Promise<void> | undefined;
  let resetting = false;
  let resetRequired = false;
  let revision = 0;
  let pagingCursor: number | undefined;
  let syncCursor = -1;
  let loadingOlder = false;
  let hasOlder = true;
  let error: string | null = null;
  let snapshot: ThreadSnapshot;

  // All delivery, reconciliation and reset writes share one worker; old work cannot finish after reset.
  function schedule<T>(task: () => Promise<T>): Promise<T> {
    const result = work.then(task);

    work = result.catch(() => undefined);

    return result;
  }

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
            status: message.failure ?? 'waiting',
          })),
        ...confirmed.map((message): ThreadMessage => ({ ...message, status: 'sent' })),
      ],
      hasOlder,
      loadingOlder,
      resetting: resetting || resetRequired,
      revision,
      error,
    };
    for (const listener of listeners) {
      listener();
    }
  }

  function merge(messages: AcceptedMessage[]) {
    const byId = new Map(confirmed.map((message) => [message.clientId, message]));
    let changed = false;

    for (const message of messages) {
      if (!byId.has(message.clientId)) {
        byId.set(message.clientId, message);
        changed = true;
      }
    }

    if (changed) {
      confirmed = [...byId.values()].sort((a, b) => b.serverSequence - a.serverSequence);
    }

    return changed;
  }

  async function initialize() {
    syncCursor = (await history.getSettings()).cursor;
    if (syncCursor < 0 && isOnline()) {
      const page = await server.getBefore(undefined, PAGE_SIZE);

      syncCursor = page[0]?.serverSequence ?? 0;
      await history.save(page, syncCursor);
    }

    confirmed = await history.getBefore(undefined, PAGE_SIZE);
    pending = await outbox.list();
    for (const message of pending) {
      if (await history.find(message.clientId)) {
        await outbox.remove(message.clientId);
      }
    }

    pending = await outbox.list();
    pagingCursor = confirmed[confirmed.length - 1]?.serverSequence;
    hasOlder = confirmed.length === PAGE_SIZE;
    error = null;
  }

  async function acknowledge(messages: AcceptedMessage[], cursor?: number) {
    // REVIEW: Cache first, then remove pending. A crash between the files replays safely by client ID.
    await history.save(messages, cursor);
    for (const message of messages) {
      if (pending.some((row) => row.clientId === message.clientId)) {
        await outbox.remove(message.clientId);
        pending = pending.filter((row) => row.clientId !== message.clientId);
      }
    }

    return merge(messages);
  }

  async function deliver() {
    while (pending.length && isOnline() && !resetting && !resetRequired) {
      const message = pending[0];

      if (!message || message.failure) {
        break;
      }

      let accepted = false;

      try {
        const result = await server.accept(message);

        accepted = true;
        await acknowledge([result]);
        error = null;
      } catch (reason) {
        if (reason instanceof DeliveryError && reason.outcome === 'offline') {
          break;
        }

        const failure =
          accepted || (reason instanceof DeliveryError && reason.outcome === 'unknown')
            ? 'unknown'
            : 'failed';

        try {
          await outbox.fail(message.clientId, failure);
        } catch {
          /* The durable outbox still retains the send for restart recovery. */
        }

        pending = pending.map((row) =>
          row.clientId === message.clientId ? { ...row, failure } : row,
        );
        error =
          failure === 'unknown'
            ? 'Delivery not confirmed. Retry safely; the same message will not be added twice.'
            : 'Message saved on this device. Tap Retry to send it.';
        publish();
        break;
      }

      publish();
    }
  }

  async function recover() {
    if (!isOnline() || resetting || resetRequired) {
      return;
    }

    try {
      let changed = false;

      // REVIEW: Cursor advances only after the page is durable. Individual acknowledgments never skip missed incoming.
      while (isOnline() && !resetting) {
        const page = await server.getAfter(Math.max(0, syncCursor), 100);
        const nextCursor = page[page.length - 1]?.serverSequence ?? Math.max(0, syncCursor);

        changed = (await acknowledge(page, nextCursor)) || changed;
        syncCursor = nextCursor;
        if (page.length < 100) {
          break;
        }
      }

      if (changed || error) {
        error = null;
        publish();
      }

      await clearFailures();
      await deliver();
    } catch {
      error = 'Could not sync messages. Tap Sync to try again; your saved messages are safe.';
      publish();
    }
  }

  async function clearFailures() {
    for (const message of pending) {
      if (message.failure) {
        await outbox.fail(message.clientId, null);
      }
    }

    pending = pending.map((message) => ({ ...message, failure: null }));
  }

  function sync(): Promise<void> {
    syncing ??= schedule(recover).finally(() => {
      syncing = undefined;
    });

    return syncing;
  }

  await initialize();
  publish();
  // Reopening online reconciles accepted-but-unacknowledged sends before replaying the queue.
  await recover();

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    async send(message: SendMessage) {
      if (resetting || resetRequired) {
        throw new Error('Demo is resetting. Try again when it finishes.');
      }

      await schedule(async () => {
        if (resetting || resetRequired) {
          throw new Error('Demo is resetting.');
        }

        const saved = await outbox.enqueue(message);

        if (!pending.some((row) => row.clientId === saved.clientId)) {
          pending = [...pending, saved];
        }

        publish();
      });
      void schedule(deliver);
    },
    retry(): Promise<void> {
      return schedule(async () => {
        if (!isOnline() || resetting || resetRequired) {
          return;
        }

        await clearFailures();
        error = null;
        publish();
        await deliver();
      });
    },
    sync,
    async loadOlder() {
      if (loadingOlder || !hasOlder || resetting || resetRequired) {
        return;
      }

      loadingOlder = true;
      publish();
      await schedule(async () => {
        try {
          const page = isOnline()
            ? await server.getBefore(pagingCursor, PAGE_SIZE)
            : await history.getBefore(pagingCursor, PAGE_SIZE);

          await history.save(page);
          merge(page);
          pagingCursor = page[page.length - 1]?.serverSequence ?? pagingCursor;
          if (isOnline()) {
            hasOlder = page.length === PAGE_SIZE;
          }
        } catch {
          error = 'Could not load earlier messages. Try scrolling up again.';
        } finally {
          loadingOlder = false;
          publish();
        }
      });
    },
    async reset(resetStorage: () => Promise<void>) {
      if (resetting) {
        return;
      }

      resetting = true;
      resetRequired = true;
      publish();
      await schedule(async () => {
        try {
          await resetStorage();
          await initialize();
          resetRequired = false;
          revision++;
        } catch (reason) {
          error =
            'Reset did not finish. Tap Reset demo again; restart also completes an interrupted reset.';
          throw reason;
        } finally {
          resetting = false;
          publish();
        }
      });
    },
  };
}

export type ThreadStore = Awaited<ReturnType<typeof createThreadStore>>;
