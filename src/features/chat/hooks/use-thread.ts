import { useAppRuntime } from '@/bootstrap/app-provider';

import type { ConversationId } from '../model/conversations';

export function useThread(id: ConversationId) {
  const thread = useAppRuntime().threads.get(id);

  if (!thread) {
    throw new Error('Unknown conversation.');
  }

  return thread;
}
