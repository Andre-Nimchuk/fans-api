import type { ChatSession } from '../data/create-chat-session';
import type { ConversationId } from '../model/conversations';

export async function openThreads(): Promise<Map<ConversationId, ChatSession>> {
  throw new Error('Open this chat on iOS or Android. This step uses native SQLite.');
}
