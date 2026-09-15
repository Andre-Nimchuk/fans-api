import type { AcceptedMessage, PendingMessage, SendMessage } from './message';

export interface Outbox {
  enqueue(message: SendMessage): Promise<PendingMessage>;
  list(): Promise<PendingMessage[]>;
  remove(clientId: string): Promise<void>;
}

export interface ChatService {
  accept(message: SendMessage): Promise<AcceptedMessage>;
  getBefore(serverSequence?: number, limit?: number): Promise<AcceptedMessage[]>;
}
