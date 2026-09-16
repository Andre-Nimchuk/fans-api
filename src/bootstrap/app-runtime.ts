import type { ChatSession } from '@/features/chat/data/create-chat-session';
import type { ConversationId } from '@/features/chat/model/conversations';
import type { SubscriptionStore } from '@/features/subscription/model/subscription-store';

export interface AppRuntime {
  threads: Map<ConversationId, ChatSession>;
  subscription: SubscriptionStore;
}
