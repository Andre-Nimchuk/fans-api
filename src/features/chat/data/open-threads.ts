import type { ConversationId } from '../model/conversations';
import type { ThreadStore } from '../model/thread-store';

export async function openThreads(): Promise<Map<ConversationId, ThreadStore>> {
  throw new Error('Open this chat on iOS or Android. This step uses native SQLite.');
}
