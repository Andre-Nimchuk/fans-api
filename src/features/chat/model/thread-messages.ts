import type { AcceptedMessage, PendingMessage } from './message';

type ConfirmedRow = AcceptedMessage & { status: 'sent' };
type PendingRow = PendingMessage & { sender: 'self'; status: 'waiting' | 'failed' | 'unknown' };

export type ThreadMessage = ConfirmedRow | PendingRow;

function pendingRow(message: PendingMessage): PendingRow {
  return { ...message, sender: 'self', status: message.failure ?? 'waiting' };
}

export function createThreadMessages() {
  const confirmed = new Map<string, ConfirmedRow>();
  let orderedConfirmed: ConfirmedRow[] | undefined;
  let pending: PendingRow[] = [];
  let snapshot: ThreadMessage[] | undefined;

  function merge(messages: AcceptedMessage[]) {
    let changed = false;

    for (const message of messages) {
      if (!confirmed.has(message.clientId)) {
        confirmed.set(message.clientId, { ...message, status: 'sent' });
        changed = true;
      }
    }

    if (changed) {
      orderedConfirmed = undefined;
      snapshot = undefined;
    }

    return changed;
  }

  function enqueue(message: PendingMessage) {
    if (!pending.some((row) => row.clientId === message.clientId)) {
      pending = [...pending, pendingRow(message)];
      snapshot = undefined;
    }
  }

  return {
    merge,
    enqueue,
    getPending: () => pending,
    replace(accepted: AcceptedMessage[], queued: PendingMessage[]) {
      confirmed.clear();
      orderedConfirmed = undefined;
      pending = queued.map(pendingRow);
      snapshot = undefined;
      merge(accepted);
    },
    removePending(clientId: string) {
      const remaining = pending.filter((message) => message.clientId !== clientId);

      if (remaining.length === pending.length) {
        return false;
      }

      pending = remaining;
      snapshot = undefined;

      return true;
    },
    setFailure(clientId: string, failure: PendingMessage['failure']) {
      pending = pending.map((message) => {
        if (message.clientId !== clientId || message.failure === failure) {
          return message;
        }

        snapshot = undefined;

        return { ...message, failure, status: failure ?? 'waiting' };
      });
    },
    getSnapshot(): ThreadMessage[] {
      // Preserve row identity so metadata updates and repeated sync do not invalidate memoized bubbles.
      orderedConfirmed ??= [...confirmed.values()].sort(
        (a, b) => b.serverSequence - a.serverSequence,
      );
      snapshot ??= [
        ...pending.filter((message) => !confirmed.has(message.clientId)).reverse(),
        ...orderedConfirmed,
      ];

      return snapshot;
    },
  };
}
