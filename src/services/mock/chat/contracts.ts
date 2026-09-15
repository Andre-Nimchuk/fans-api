import type { ChatService } from '@/features/chat/model/contracts';
import type { AcceptedMessage, SendMessage } from '@/features/chat/model/message';

export interface MockChatServer extends ChatService {
  accept(message: SendMessage, sender?: AcceptedMessage['sender']): Promise<AcceptedMessage>;
  reset(): Promise<void>;
}

export interface SimulationSettings {
  getSettings(): Promise<{ offline: boolean; incomingCount: number }>;
  setOffline(offline: boolean): Promise<void>;
  setIncomingCount(count: number): Promise<void>;
}
