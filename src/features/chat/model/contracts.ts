import type { AcceptedMessage, PendingMessage, SendMessage } from './message';

export interface Outbox {
  enqueue(message: SendMessage): Promise<PendingMessage>;
  list(): Promise<PendingMessage[]>;
  fail(clientId: string, failure: 'failed' | 'unknown' | null): Promise<void>;
  clear(): Promise<void>;
  remove(clientId: string): Promise<void>;
}

export interface ChatService {
  accept(message: SendMessage): Promise<AcceptedMessage>;
  getAfter(serverSequence?: number, limit?: number): Promise<AcceptedMessage[]>;
  getBefore(serverSequence?: number, limit?: number): Promise<AcceptedMessage[]>;
}

export interface MessageHistory {
  getSettings(): Promise<{ cursor: number }>;
  getBefore(cursor?: number, limit?: number): Promise<AcceptedMessage[]>;
  find(clientId: string): Promise<AcceptedMessage | undefined>;
  save(messages: AcceptedMessage[], cursor?: number): Promise<void>;
}
